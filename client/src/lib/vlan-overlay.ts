import type { Topology } from '../components/NetworkSandbox';
import type { Session } from './ios-engine';
import { interfaceVlan, vlanAllowed } from './operational-evidence';

type Membership = { kind: string; vlan?: number; native?: number; allowed?: string; inferred: boolean };

export function vlanOverlay(topology: Topology, sessions: Record<string, Session>) {
  const sessionFor = (id: string) => sessions[id] || sessions[topology.nodes.find(node => node.id === id)?.name || ''];
  const configured = (id: string, port: string): Membership | undefined => {
    const session = sessionFor(id);
    const state = session?.interfaces[port];
    const effective = state?.channelGroup ? session?.interfaces[`port-channel ${state.channelGroup}`] || state : state;
    const tagged = session ? interfaceVlan(session, port) : undefined;
    if (effective?.switchportMode === 'trunk') return { kind: 'trunk', vlan: undefined, native: effective.nativeVlan ?? 1, allowed: effective.allowedVlans || 'all', inferred: false };
    if (effective?.switchportMode === 'access') return { kind: 'access', vlan: effective.accessVlan ?? 1, native: undefined, allowed: undefined, inferred: false };
    if (tagged !== undefined) return { kind: 'interface', vlan: tagged, native: undefined, allowed: undefined, inferred: false };
    return undefined;
  };
  const portInfo = (id: string, port: string) => {
    let info = configured(id, port);
    if (!info) {
      // Only a directly connected access port establishes an endpoint VLAN.
      const neighbors = topology.links.flatMap(link => link.from === id && link.fromPort === port ? [configured(link.to, link.toPort)] : link.to === id && link.toPort === port ? [configured(link.from, link.fromPort)] : []);
      const memberships = neighbors.filter(peer => peer?.kind === 'access');
      const vlans = new Set(memberships.map(peer => peer!.vlan));
      if (vlans.size === 1) info = { ...memberships[0]!, kind: 'endpoint', inferred: true };
    }
    const label = !info ? 'VLAN unknown' : info.kind === 'trunk' ? `Trunk N${info.native} / ${info.allowed}` : `VLAN ${info.vlan}${info.inferred ? ' (inferred)' : ''}`;
    return { kind: info?.kind, vlan: info?.vlan, native: info?.native, allowed: info?.allowed, inferred: info?.inferred ?? false, label, compact: !info ? '?' : info.kind === 'trunk' ? 'TRUNK' : `V${info.vlan}`, matches: (vlan: number | null) => vlan === null || !!info && (info.kind === 'trunk' ? vlanAllowed(info.allowed, vlan) : info.vlan === vlan) };
  };
  const vlanIds = new Set<number>();
  for (const node of topology.nodes) {
    const session = sessionFor(node.id);
    for (const vlan of Object.keys(session?.vlans || {})) vlanIds.add(Number(vlan));
    for (const port of Array.from(new Set([...node.ports, ...Object.keys(session?.interfaces || {})]))) {
      const info = portInfo(node.id, port);
      if (info.vlan !== undefined) vlanIds.add(info.vlan);
      if (info.native !== undefined) vlanIds.add(info.native);
      for (const item of info.allowed?.split(',') || []) {
        const [start, end = start] = item.split('-').map(Number);
        if (Number.isInteger(start) && start >= 1 && end <= 4094) for (let vlan = start; vlan <= end; vlan++) vlanIds.add(vlan);
      }
    }
  }
  return {
    portInfo,
    vlanIds: Array.from(vlanIds).filter(vlan => vlan >= 1 && vlan <= 4094).sort((a, b) => a - b),
    nodeMatches: (id: string, vlan: number | null) => vlan === null || Array.from(new Set([...(topology.nodes.find(node => node.id === id)?.ports || []), ...Object.keys(sessionFor(id)?.interfaces || {})])).some(port => portInfo(id, port).matches(vlan)),
    linkMatches: (link: Topology['links'][number], vlan: number | null) => portInfo(link.from, link.fromPort).matches(vlan) && portInfo(link.to, link.toPort).matches(vlan),
  };
}
