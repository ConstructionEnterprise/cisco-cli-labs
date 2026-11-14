// VTP (VLAN Trunking Protocol) modeling.
//
// The emulator models the VTP concepts a CCNA lab needs: server / client /
// transparent modes, domain, version, password, configuration revision,
// and propagation of the VLAN database across trunk links. It does NOT
// model VTP pruning, VTPv3 primary servers, or real MD5: the digest below
// is a deterministic modeled hash, not a real MD5 computation.
//
// Propagation rules, matching IOS behavior closely enough to teach from:
// - A NULL domain (never configured) never propagates. This also keeps
//   every pre-VTP lab untouched: no lab sets a VTP domain, so sync is a
//   no-op for them.
// - Advertisements only cross trunk links that are administratively up on
//   both ends, and only between switches in the same domain with the same
//   password and version.
// - Transparent switches never adopt a database, but they forward
//   advertisements for their own domain, so propagation can pass through
//   them to clients beyond.
// - Clients relay advertisements too, so a client can pass a newer
//   database onward. The highest revision in the domain wins regardless
//   of mode (except transparent, which never adopts) — the classic
//   rogue-switch-with-a-high-revision scenario is real VTP behavior.
// - Two devices tied at the highest revision with different databases:
//   the first in topology order wins, so sync stays deterministic.

import type { Session, VtpState } from './ios-engine';
import type { Topology } from '../components/NetworkSandbox';

export const VTP_MAX_VLANS = 1005;
export const VTP_DEFAULT_STATE: VtpState = {
  mode: 'server',
  domain: '',
  version: 1,
  password: '',
  revision: 0,
  lastModifiedBy: '0.0.0.0',
  lastModifiedAt: '0-0-00 00:00:00',
};

export const vtpState = (session: Session | undefined): VtpState =>
  session?.vtp || VTP_DEFAULT_STATE;

export const vtpDomainDisplay = (domain: string): string => domain || 'NULL';

export const vtpModeDisplay = (mode: VtpState['mode']): string =>
  mode === 'server' ? 'Server' : mode === 'client' ? 'Client' : 'Transparent';

// "7-16-24 17:57:52" — IOS show vtp status date format, no zero padding
// on month/day/year, zero-padded time.
export function formatVtpDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getMonth() + 1}-${date.getDate()}-${String(date.getFullYear()).slice(2)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Lowest-numbered VLAN interface (SVI) with an IPv4 address. Real IOS
// reports this as the local updater ID.
export function vtpUpdater(session: Session): { id: string; iface: string } {
  const svis = Object.entries(session.interfaces)
    .map(([name, state]) => ({
      vlan: Number(name.match(/^vlan (\d+)$/i)?.[1] || NaN),
      ip: state.ipv4[0]?.split(' ')[0],
    }))
    .filter((entry) => Number.isFinite(entry.vlan) && entry.ip)
    .sort((a, b) => a.vlan - b.vlan);
  if (!svis.length) return { id: '0.0.0.0', iface: 'Vl1' };
  return { id: svis[0].ip!, iface: `Vl${svis[0].vlan}` };
}

// Deterministic modeled digest: FNV-1a over domain, password, revision,
// and the sorted VLAN database, expanded to 16 bytes. Changes whenever
// the database changes, and matches on a client that has adopted the
// server's database — the two properties a lab checks. Not real MD5.
export function vtpDigest(state: VtpState, vlans: Record<string, string>): string[] {
  const material = [
    state.domain,
    state.password,
    String(state.revision),
    ...Object.entries(vlans)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([id, name]) => `${id}:${name}`),
  ].join('|');
  let hash = 0x811c9dc5;
  for (let i = 0; i < material.length; i++) {
    hash ^= material.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  let seed = hash || 1;
  const bytes: number[] = [];
  for (let i = 0; i < 16; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    bytes.push((seed >>> 24) & 0xff);
  }
  const hex = bytes.map((byte) => `0x${byte.toString(16).toUpperCase().padStart(2, '0')}`);
  return [hex.slice(0, 8).join(' '), hex.slice(8).join(' ')];
}

function trunkUp(session: Session | undefined, port: string): boolean {
  const state = session?.interfaces[port];
  const effective = state?.channelGroup
    ? session?.interfaces[`port-channel ${state.channelGroup}`]
    : state;
  return !!effective && !effective.shutdown && effective.status === 'up' && effective.switchportMode === 'trunk';
}

function vtpKey(state: VtpState): string {
  return `${state.domain}\0${state.password}\0${state.version}`;
}

// Is `to` reachable from `from` over trunk links that are up on both ends,
// staying inside switches that share the advertisement's domain key?
// Transparent switches forward without adopting, so they are valid
// transit hops; a NULL-domain or foreign-domain switch stops the flood.
function trunkPathExists(
  from: string,
  to: string,
  key: string,
  topology: Topology,
  sessions: Record<string, Session>,
): boolean {
  const seen = new Set<string>([from]);
  const queue = [from];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === to) return true;
    for (const link of topology.links) {
      const neighbor = link.from === current ? link.to : link.to === current ? link.from : null;
      if (neighbor === null || seen.has(neighbor)) continue;
      const currentNode = topology.nodes.find((node) => node.id === current);
      const neighborNode = topology.nodes.find((node) => node.id === neighbor);
      if (currentNode?.kind !== 'switch' || neighborNode?.kind !== 'switch') continue;
      const currentSession = sessions[current];
      const neighborSession = sessions[neighbor];
      const localPort = link.from === current ? link.fromPort : link.toPort;
      const remotePort = link.from === current ? link.toPort : link.fromPort;
      if (!trunkUp(currentSession, localPort) || !trunkUp(neighborSession, remotePort)) continue;
      if (vtpKey(vtpState(neighborSession)) !== key) continue;
      seen.add(neighbor);
      queue.push(neighbor);
    }
  }
  return false;
}

// Pure: returns a new sessions record with VTP databases synced. Only
// sessions that adopt a newer database are replaced; everything else is
// referentially unchanged.
export function syncVtp(
  topology: Topology,
  sessions: Record<string, Session>,
): Record<string, Session> {
  let next = sessions;
  const groups = new Map<string, string[]>();
  for (const node of topology.nodes) {
    if (node.kind !== 'switch') continue;
    const session = sessions[node.id];
    if (!session) continue;
    const state = vtpState(session);
    if (!state.domain) continue;
    const key = vtpKey(state);
    groups.set(key, [...(groups.get(key) || []), node.id]);
  }
  for (const [key, members] of Array.from(groups.entries())) {
    let winner = '';
    let maxRevision = -1;
    for (const id of members) {
      const revision = vtpState(sessions[id]).revision;
      if (revision > maxRevision) {
        maxRevision = revision;
        winner = id;
      }
    }
    if (!winner) continue;
    const winnerSession = sessions[winner];
    const winnerState = vtpState(winnerSession);
    for (const id of members) {
      if (id === winner) continue;
      const session = sessions[id];
      const state = vtpState(session);
      if (state.mode === 'transparent') continue;
      if (state.revision >= maxRevision) continue;
      if (!trunkPathExists(id, winner, key, topology, sessions)) continue;
      next = {
        ...next,
        [id]: {
          ...session,
          vlans: { ...winnerSession.vlans },
          vtp: {
            ...state,
            revision: maxRevision,
            lastModifiedBy: winnerState.lastModifiedBy,
            lastModifiedAt: winnerState.lastModifiedAt,
          },
        },
      };
    }
  }
  return next;
}
