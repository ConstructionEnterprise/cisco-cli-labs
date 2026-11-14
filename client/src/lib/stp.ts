//
// Spanning-tree model: PVST / Rapid-PVST per-VLAN instances, root election,
// and port roles (root / designated / alternate with blocking) computed as
// the converged spanning tree across the topology's switches, rendered as
// IOS-shaped `show spanning-tree` output.
//
// What is modeled:
// - `spanning-tree mode pvst|rapid-pvst`, `spanning-tree vlan <id> root
//   primary|secondary`, `spanning-tree vlan <id> priority <n>` (global config)
// - `spanning-tree portfast` and `spanning-tree bpduguard enable` (interface)
// - `show spanning-tree` and `show spanning-tree vlan <id>`: per-VLAN blocks
//   with Root ID / Bridge ID / timers and the Interface / Role / Sts / Cost /
//   Prio.Nbr / Type table, in the layout of `show spanning-tree` on IOS.
// - The converged tree: lowest bridge ID (priority + VLAN sys-id-ext, MAC
//   tie-break) among switches reachable over up switch-to-switch links wins
//   the root; each other switch's lowest-cost path picks its root port; each
//   segment's lowest-cost (then lowest bridge ID) end is designated and the
//   other end blocks as an alternate. This is the steady state BPDU exchange
//   converges to, computed directly so the emulator stays deterministic.
// - Down STP ports are listed with their computed role and a DWN state.
//
// What is NOT modeled (stated honestly, never faked):
// - BPDU hello timers are not tick-simulated: the tree shown is the converged
//   result, not a live exchange, so listening/learning transitions and
//   topology-change aging never appear mid-output.
// - MST: `spanning-tree mode mst` is rejected by the grammar, the same way
//   VTPv3 is rejected rather than pretended.
// - Bridge MACs are deterministic modeled values (locally administered),
//   not burned-in addresses.
// - Root election compares bridge IDs across the switches reachable over up
//   switch-to-switch links that carry the VLAN; per-link trunk allowed-VLAN
//   filtering is not factored into the election.
// - `show spanning-tree root`, `show spanning-tree summary`, and
//   `show spanning-tree interface <port> detail` render from the same
//   converged tree. BPDU sent/received counters in the detail view are
//   stated as not modeled rather than invented.
//

import type { Session, StpState } from './ios-engine';
import type { SandboxLink, SandboxNode, Topology } from '../components/NetworkSandbox';

export const STP_DEFAULT_STATE: StpState = {
  mode: 'pvst',
  vlanPriority: {},
  vlanRoot: {},
  portfast: {},
  bpduguard: {},
};

export const stpState = (session: Session | undefined): StpState =>
  session?.stp || STP_DEFAULT_STATE;

/** Effective STP priority for a VLAN: an explicit priority wins, else the 32768 default. */
export function stpVlanPriority(session: Session | undefined, vlan: number): number {
  const configured = stpState(session).vlanPriority[String(vlan)];
  return configured === undefined ? 32768 : configured;
}

/** Deterministic modeled bridge MAC (locally administered 02:xx), not a real burned-in address. */
export function stpBridgeMac(deviceName: string): string {
  const hash = (seed: string): number => {
    let h = 0x811c9dc5;
    for (let i = 0; i < seed.length; i += 1) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
  };
  const a = hash(deviceName);
  const b = hash(`stp:${deviceName}`);
  const byte = (value: number, shift: number): string => ((value >>> shift) & 0xff).toString(16).padStart(2, '0');
  return `02${byte(a, 24)}.${byte(a, 16)}${byte(a, 8)}.${byte(a, 0)}${byte(b, 24)}`.toUpperCase();
}

/** Canonical session key for a port label (`port-channel 1` for `Po1`/`port-channel1`). */
export function stpCanonicalPortKey(port: string): string {
  const match = port.match(/^port-channel ?(\d+)$/i);
  return match ? `port-channel ${match[1]}` : port;
}

/** An STP port is up when its interface entry exists and is not shut down. */
function stpPortUp(session: Session | undefined, portKey: string): boolean {
  const state = session?.interfaces[portKey];
  return !!state && !state.shutdown && state.status === 'up';
}

type StpPort = {
  key: string;
  label: string;
  cost: number;
  portNumber: number;
  up: boolean;
  memberKeys: string[];
  isSwitchLink: boolean;
};

function stpPortNumber(port: string): number {
  const match = port.match(/\/(\d+)$/);
  return match ? Number(match[1]) : 1;
}

/** Id of the peer device reached through a port, if the port is cabled. */
function stpPeerId(topology: Topology, nodeId: string, portKey: string): string | null {
  for (const link of topology.links as SandboxLink[]) {
    if (link.from === nodeId && stpCanonicalPortKey(link.fromPort || '') === portKey) return link.to;
    if (link.to === nodeId && stpCanonicalPortKey(link.toPort || '') === portKey) return link.from;
  }
  return null;
}

/** Kind of the peer device reached through a port, if the port is cabled. */
function stpPeerKind(topology: Topology, nodeId: string, portKey: string): string | null {
  for (const link of topology.links as SandboxLink[]) {
    if (link.from === nodeId && stpCanonicalPortKey(link.fromPort || '') === portKey) {
      return (topology.nodes as SandboxNode[]).find((n) => n.id === link.to)?.kind || null;
    }
    if (link.to === nodeId && stpCanonicalPortKey(link.toPort || '') === portKey) {
      return (topology.nodes as SandboxNode[]).find((n) => n.id === link.from)?.kind || null;
    }
  }
  return null;
}

/**
 * The STP port inventory: bundled member ports collapse to their PoN
 * interface (STP runs on the aggregator, as on IOS). Down ports are listed
 * with their computed role and a DWN state.
 */
function stpPorts(node: SandboxNode, topology: Topology, session: Session | undefined): StpPort[] {
  const ports: StpPort[] = [];
  const seen = new Set<string>();
  const push = (key: string, label: string, cost: number, portNumber: number, memberKeys: string[]) => {
    if (seen.has(key)) return;
    seen.add(key);
    const poShutdown = session?.interfaces[key]?.shutdown === true;
    ports.push({
      key,
      label,
      cost,
      portNumber,
      up: !poShutdown && memberKeys.some((member) => stpPortUp(session, member)),
      memberKeys,
      isSwitchLink: memberKeys.some((member) => stpPeerKind(topology, node.id, member) === 'switch'),
    });
  };
  for (const port of node.ports.filter((name) => !/^vlan/i.test(name) && !/^port-channel/i.test(name))) {
    const group = session?.interfaces[port]?.channelGroup;
    if (group) {
      const key = `port-channel ${group}`;
      if (!seen.has(key)) {
        const members = node.ports.filter((name) => session?.interfaces[name]?.channelGroup === group);
        push(key, `Po${group}`, 3, 64 + group, members);
      }
    } else {
      push(port, port, 4, stpPortNumber(port), [port]);
    }
  }
  for (const key of Object.keys(session?.interfaces || {})) {
    const match = key.match(/^port-channel (\d+)$/i);
    if (match && !seen.has(key)) {
      const members = node.ports.filter((port) => session?.interfaces[port]?.channelGroup === Number(match[1]));
      push(key, `Po${match[1]}`, 3, 64 + Number(match[1]), members.length ? members : [key]);
    }
  }
  return ports;
}

type StpEdge = { to: string; localPort: string; remotePort: string; cost: number };

/** Switch-to-switch links with both ends up. BPDUs only flow over up links. */
function stpEdges(topology: Topology, sessions: Record<string, Session>, nodeId: string): StpEdge[] {
  const edges: StpEdge[] = [];
  for (const link of topology.links as SandboxLink[]) {
    const peer = link.from === nodeId ? link.to : link.to === nodeId ? link.from : null;
    if (!peer || !link.fromPort || !link.toPort) continue;
    const peerNode = (topology.nodes as SandboxNode[]).find((n) => n.id === peer);
    if (!peerNode || peerNode.kind !== 'switch') continue;
    const localKey = stpCanonicalPortKey(link.from === nodeId ? link.fromPort : link.toPort);
    const remoteKey = stpCanonicalPortKey(link.from === nodeId ? link.toPort : link.fromPort);
    if (!stpPortUp(sessions[nodeId], localKey) || !stpPortUp(sessions[peer], remoteKey)) continue;
    const bundled = !!sessions[nodeId]?.interfaces[localKey]?.channelGroup;
    edges.push({ to: peer, localPort: localKey, remotePort: remoteKey, cost: bundled ? 3 : 4 });
  }
  return edges;
}

type StpTree = {
  rootId: string;
  rootMac: string;
  rootBridgeId: number;
  /** Lowest root path cost per switch in the partition. */
  dist: Map<string, number>;
  /** Root port key per non-root switch in the partition. */
  rootPort: Map<string, string>;
  /** `nodeId:portKey` entries that are designated on their segment. */
  designated: Set<string>;
};

/**
 * The converged spanning tree for one VLAN: root election, root path costs
 * (Dijkstra from the root), root ports, and designated ports per segment.
 * This is the steady state BPDU exchange converges to.
 */
function stpTree(
  topology: Topology,
  sessions: Record<string, Session>,
  localId: string,
  vlan: number,
  localVlans: Record<string, string>,
): StpTree {
  const nodes = topology.nodes as SandboxNode[];
  const nameOf = (id: string): string => nodes.find((n) => n.id === id)?.name || id;
  const macOf = (id: string): string => stpBridgeMac(nameOf(id));
  const bridgeIdOf = (id: string): number => stpVlanPriority(sessions[id], vlan) + vlan;
  const carriesVlan = (id: string): boolean => {
    if (vlan === 1) return true;
    const vlans = id === localId ? localVlans : sessions[id]?.vlans || {};
    return String(vlan) in vlans;
  };
  // Partition: switches reachable over up switch-to-switch links.
  const partition = new Set<string>([localId]);
  const bfs = [localId];
  while (bfs.length) {
    const current = bfs.shift()!;
    for (const edge of stpEdges(topology, sessions, current)) {
      if (!partition.has(edge.to)) {
        partition.add(edge.to);
        bfs.push(edge.to);
      }
    }
  }
  // Root election: lowest bridge ID, MAC tie-break.
  let rootId = localId;
  for (const id of Array.from(partition)) {
    if (!carriesVlan(id)) continue;
    const mine = bridgeIdOf(id);
    const best = bridgeIdOf(rootId);
    if (mine < best || (mine === best && macOf(id) < macOf(rootId))) rootId = id;
  }
  // Root path costs and root ports: Dijkstra from the root.
  const dist = new Map<string, number>([[rootId, 0]]);
  const rootPort = new Map<string, string>();
  const visited = new Set<string>();
  for (;;) {
    let current: string | null = null;
    let best = Infinity;
    for (const id of Array.from(partition)) {
      if (visited.has(id)) continue;
      const distance = dist.get(id);
      if (distance !== undefined && distance < best) {
        best = distance;
        current = id;
      }
    }
    if (!current) break;
    visited.add(current);
    for (const edge of stpEdges(topology, sessions, current)) {
      if (!partition.has(edge.to)) continue;
      const next = dist.get(current)! + edge.cost;
      if (next < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, next);
        rootPort.set(edge.to, edge.remotePort);
      }
    }
  }
  // Designated port per segment: lowest path cost wins, then lowest bridge ID.
  const designated = new Set<string>();
  for (const link of topology.links as SandboxLink[]) {
    const a = link.from;
    const b = link.to;
    if (!partition.has(a) || !partition.has(b) || !link.fromPort || !link.toPort) continue;
    if (nodes.find((n) => n.id === a)?.kind !== 'switch' || nodes.find((n) => n.id === b)?.kind !== 'switch') continue;
    const aKey = stpCanonicalPortKey(link.fromPort);
    const bKey = stpCanonicalPortKey(link.toPort);
    if (!stpPortUp(sessions[a], aKey) || !stpPortUp(sessions[b], bKey)) continue;
    const costA = dist.get(a) ?? Infinity;
    const costB = dist.get(b) ?? Infinity;
    let winner = a;
    let winnerKey = aKey;
    if (costB < costA) {
      winner = b;
      winnerKey = bKey;
    } else if (costA === costB) {
      const idA = bridgeIdOf(a);
      const idB = bridgeIdOf(b);
      if (idB < idA || (idA === idB && macOf(b) < macOf(a))) {
        winner = b;
        winnerKey = bKey;
      }
    }
    designated.add(`${winner}:${winnerKey}`);
  }
  return { rootId, rootMac: macOf(rootId), rootBridgeId: bridgeIdOf(rootId), dist, rootPort, designated };
}

function stpPortLabel(portKey: string): string {
  const match = portKey.match(/^port-channel (\d+)$/i);
  return match ? `Po${match[1]}` : portKey;
}

function stpPortNumberForKey(portKey: string): number {
  const po = portKey.match(/^port-channel (\d+)$/i);
  return po ? 64 + Number(po[1]) : stpPortNumber(portKey);
}

/** Converged-tree role for one port: root bridge's ports are all designated. */
function stpRoleOf(tree: StpTree, nodeId: string, isRoot: boolean, rootPortKey: string | undefined, port: StpPort): string {
  if (isRoot) return 'Desg';
  if (rootPortKey && port.memberKeys.includes(rootPortKey)) return 'Root';
  if (port.memberKeys.some((member) => tree.designated.has(`${nodeId}:${member}`))) return 'Desg';
  if (port.isSwitchLink) return 'Altn';
  return 'Desg';
}

function renderVlanBlock(
  node: SandboxNode,
  topology: Topology,
  session: Session,
  sessions: Record<string, Session>,
  vlan: number,
  vlans: Record<string, string>,
): string[] {
  const state = stpState(session);
  const protocol = state.mode === 'rapid-pvst' ? 'rstp' : 'ieee';
  const priority = stpVlanPriority(session, vlan);
  const bridgeId = priority + vlan;
  const localMac = stpBridgeMac(node.name);
  const tree = stpTree(topology, sessions, node.id, vlan, vlans);
  const isRoot = tree.rootId === node.id;
  const pathCost = tree.dist.get(node.id) ?? 0;
  const rootPortKey = tree.rootPort.get(node.id);

  const lines = [
    `VLAN${String(vlan).padStart(4, '0')}`,
    `  Spanning tree enabled protocol ${protocol}`,
    `  Root ID    Priority    ${tree.rootBridgeId}`,
    `             Address     ${tree.rootMac}`,
  ];
  if (isRoot) {
    lines.push('             This bridge is the root');
  } else {
    lines.push(`             Cost        ${pathCost}`);
    if (rootPortKey) lines.push(`             Port        ${stpPortNumberForKey(rootPortKey)} (${stpPortLabel(rootPortKey)})`);
  }
  lines.push(
    '             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec',
    '',
    `  Bridge ID  Priority    ${bridgeId}  (priority ${priority} sys-id-ext ${vlan})`,
    `             Address     ${localMac}`,
    '             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec',
    '             Aging Time  300 sec',
    '',
    'Interface           Role Sts Cost      Prio.Nbr Type',
    '------------------- ---- --- --------- -------- --------------------------------',
  );
  // Port role follows the converged tree; state is FWD for forwarding ports,
  // BLK for alternate (blocked) ports, DWN for down ports. BPDU hello timers
  // are not tick-simulated, so listening/learning never appear.
  const roleOf = (port: StpPort): string => stpRoleOf(tree, node.id, isRoot, rootPortKey, port);
  for (const port of stpPorts(node, topology, session)) {
    const role = roleOf(port);
    const portState = !port.up ? 'DWN' : role === 'Altn' ? 'BLK' : 'FWD';
    const type = state.portfast[port.key] ? 'P2p Edge' : 'P2p';
    lines.push(
      port.label.padEnd(19)
      + role.padEnd(5)
      + portState.padEnd(4)
      + String(port.cost).padEnd(10)
      + `128.${port.portNumber}`.padEnd(9)
      + type,
    );
  }
  return lines;
}

/**
 * Render `show spanning-tree` (all VLAN instances) or `show spanning-tree
 * vlan <id>` (one instance). The VLAN list follows the VTP-synced database
 * when provided, so a VTP client shows instances for adopted VLANs.
 */
export function renderSpanningTree(
  node: SandboxNode,
  topology: Topology,
  session: Session,
  sessions: Record<string, Session>,
  vlans: Record<string, string>,
  onlyVlan?: number,
): string[] {
  const vlanList = onlyVlan !== undefined
    ? [onlyVlan]
    : [1, ...Object.keys(vlans).map(Number).filter((v) => Number.isInteger(v) && v !== 1)].sort((a, b) => a - b);
  if (onlyVlan !== undefined && onlyVlan !== 1 && !(String(onlyVlan) in vlans)) {
    return [`% VLAN ${onlyVlan} does not exist.`];
  }
  // Direct outputFor callers may not include the local node in sessions.
  const allSessions = { ...sessions, [node.id]: session };
  const blocks = vlanList.map((vlan) => renderVlanBlock(node, topology, session, allSessions, vlan, vlans));
  return blocks.flatMap((block, index) => (index === 0 ? block : ['', ...block]));
}

const stpVlanList = (vlans: Record<string, string>): number[] =>
  [1, ...Object.keys(vlans).map(Number).filter((v) => Number.isInteger(v) && v !== 1)].sort((a, b) => a - b);

/**
 * Render `show spanning-tree root`: one row per VLAN instance with the
 * elected root, this bridge's root path cost, and its root port.
 */
export function renderSpanningTreeRoot(
  node: SandboxNode,
  topology: Topology,
  session: Session,
  sessions: Record<string, Session>,
  vlans: Record<string, string>,
): string[] {
  const allSessions = { ...sessions, [node.id]: session };
  const lines = [
    '                                        Root    Hello Max Fwd',
    'Vlan        Root ID                 Cost    Time  Age Dly  Root Port',
    '--------- -------------------- ------- ----- ----- --- ----------------',
  ];
  for (const vlan of stpVlanList(vlans)) {
    const tree = stpTree(topology, allSessions, node.id, vlan, vlans);
    const isRoot = tree.rootId === node.id;
    const rootPortKey = tree.rootPort.get(node.id);
    const rootPortLabel = isRoot ? 'This bridge is the root' : rootPortKey ? stpPortLabel(rootPortKey) : '-';
    lines.push(
      `VLAN${String(vlan).padStart(4, '0')}  `
      + `${tree.rootBridgeId} ${tree.rootMac}`.padEnd(21)
      + String(tree.dist.get(node.id) ?? 0).padEnd(8)
      + '2'.padEnd(6) + '20'.padEnd(6) + '15'.padEnd(4)
      + rootPortLabel,
    );
  }
  return lines;
}

/**
 * Render `show spanning-tree summary`: mode, root-bridge VLANs, and the
 * per-VLAN blocking/forwarding port counts from the converged tree.
 * Listening/learning are always 0 because BPDU timers are not tick-simulated.
 */
export function renderSpanningTreeSummary(
  node: SandboxNode,
  topology: Topology,
  session: Session,
  sessions: Record<string, Session>,
  vlans: Record<string, string>,
): string[] {
  const allSessions = { ...sessions, [node.id]: session };
  const state = stpState(session);
  const vlanList = stpVlanList(vlans);
  const rootFor: string[] = [];
  const rows: string[] = [];
  let totalBlocking = 0;
  let totalForwarding = 0;
  let totalActive = 0;
  for (const vlan of vlanList) {
    const tree = stpTree(topology, allSessions, node.id, vlan, vlans);
    const isRoot = tree.rootId === node.id;
    if (isRoot) rootFor.push(`VLAN${String(vlan).padStart(4, '0')}`);
    const rootPortKey = tree.rootPort.get(node.id);
    let blocking = 0;
    let forwarding = 0;
    let active = 0;
    for (const port of stpPorts(node, topology, session)) {
      if (!port.up) continue;
      active += 1;
      if (stpRoleOf(tree, node.id, isRoot, rootPortKey, port) === 'Altn') blocking += 1;
      else forwarding += 1;
    }
    totalBlocking += blocking;
    totalForwarding += forwarding;
    totalActive += active;
    rows.push(`VLAN${String(vlan).padStart(4, '0')}`.padEnd(21) + String(blocking).padEnd(9) + '0'.padEnd(10) + '0'.padEnd(9) + String(forwarding).padEnd(11) + String(active));
  }
  return [
    `Switch is in ${state.mode} mode`,
    `Root bridge for: ${rootFor.length ? rootFor.join(', ') : 'none'}`,
    'Extended system ID   is enabled',
    `PortFast Default     is ${Object.values(state.portfast).some(Boolean) ? 'enabled on configured ports' : 'disabled'}`,
    `PortFast BPDU Guard Default is ${Object.values(state.bpduguard).some(Boolean) ? 'enabled on configured ports' : 'disabled'}`,
    'Listening and learning counts are always 0: the converged tree is computed directly, BPDU timers are not tick-simulated.',
    '',
    'Name                 Blocking Listening Learning Forwarding STP Active',
    '-------------------- -------- --------- -------- ---------- ----------',
    ...rows,
    '-------------------- -------- --------- -------- ---------- ----------',
    `${vlanList.length} ${vlanList.length === 1 ? 'vlan' : 'vlans'}`.padEnd(21) + String(totalBlocking).padEnd(9) + '0'.padEnd(10) + '0'.padEnd(9) + String(totalForwarding).padEnd(11) + String(totalActive),
  ];
}

/**
 * Render `show spanning-tree interface <port> detail`: one block per VLAN
 * instance for the port, from the converged tree. BPDU counters are stated
 * as not modeled instead of invented.
 */
export function renderSpanningTreeInterface(
  node: SandboxNode,
  topology: Topology,
  session: Session,
  sessions: Record<string, Session>,
  vlans: Record<string, string>,
  portQuery: string,
): string[] {
  const allSessions = { ...sessions, [node.id]: session };
  const port = stpPorts(node, topology, session).find(
    (candidate) => candidate.key === stpCanonicalPortKey(portQuery) || candidate.key === portQuery || candidate.label === portQuery,
  );
  if (!port) return [`% Interface ${portQuery} does not exist on ${node.name}.`];
  const state = stpState(session);
  const longName = port.key.startsWith('port-channel')
    ? `Port-channel${port.key.split(' ').at(-1)}`
    : /^g\d/.test(port.key) ? `GigabitEthernet${port.key.slice(1)}` : port.key;
  const nameOf = (id: string): string => (topology.nodes as SandboxNode[]).find((n) => n.id === id)?.name || id;
  const blocks = stpVlanList(vlans).map((vlan) => {
    const tree = stpTree(topology, allSessions, node.id, vlan, vlans);
    const isRoot = tree.rootId === node.id;
    const rootPortKey = tree.rootPort.get(node.id);
    const role = stpRoleOf(tree, node.id, isRoot, rootPortKey, port);
    const portState = !port.up ? 'DWN' : role === 'Altn' ? 'BLK' : 'FWD';
    const stateWord = portState === 'FWD' ? 'forwarding' : portState === 'BLK' ? 'blocking' : 'down';
    // The designated bridge is this switch when its port is designated;
    // on a root or alternate port it is the peer across the link.
    let designatedBridgeId = stpVlanPriority(session, vlan) + vlan;
    let designatedMac = stpBridgeMac(node.name);
    let designatedCost = tree.dist.get(node.id) ?? 0;
    if (role !== 'Desg') {
      const peerId = port.memberKeys.map((member) => stpPeerId(topology, node.id, member)).find((id) => id);
      if (peerId) {
        designatedBridgeId = stpVlanPriority(allSessions[peerId], vlan) + vlan;
        designatedMac = stpBridgeMac(nameOf(peerId));
        designatedCost = tree.dist.get(peerId) ?? 0;
      }
    }
    return [
      ` Port ${port.portNumber} (${longName}) of VLAN${String(vlan).padStart(4, '0')} is ${stateWord}`,
      `   Port path cost ${port.cost}, Port priority 128, Port Identifier 128.${port.portNumber}.`,
      `   Designated root has priority ${tree.rootBridgeId}, address ${tree.rootMac}`,
      `   Designated bridge has priority ${designatedBridgeId}, address ${designatedMac}`,
      `   Designated port id is 128.${port.portNumber}, designated path cost ${designatedCost}`,
      '   Timers: message age 0, forward delay 0, hold 0',
      '   Number of transitions to forwarding state: not modeled',
      state.portfast[port.key]
        ? '   Link type is point-to-point by default, PortFast edge port'
        : '   Link type is point-to-point by default',
      '   BPDU: sent and received counts are not modeled; the converged tree is computed directly',
    ];
  });
  return blocks.flatMap((block, index) => (index === 0 ? block : ['', ...block]));
}
