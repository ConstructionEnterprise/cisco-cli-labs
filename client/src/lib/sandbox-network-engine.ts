import { applyCommand, isCiscoCommand, applyModeledLayer2Learning, type Mode, type Session, type DhcpClientState, type DhcpLease } from './ios-engine';
import { canonicalCommand } from './learning-engine';
import type { SandboxNode, SandboxLink, Topology } from '../components/NetworkSandbox';
import type { LabConfig } from '../labs/labDefinitions';
import { supportsDeviceCommand } from './capabilities';
import { iosDeviceContextHelp } from './ios-device-reference';
import { channelForwarding, evidenceOutput, protocolEvidence, interfaceEvidence, vlanAllowed, leaseState, electionEvidence, ospfTransitLinks, ospfOperationalEvidence, formatOspfProcessCli, formatOspfDatabaseCli, formatOspfInterfaceCli } from './operational-evidence';
import { ecosystemDevice } from './network-ecosystem';
import { evaluateAsaTraffic } from './asa-engine';
import { createSimulatedFlow } from './traffic-engine';
import { diagnosePath } from './operational-evidence';
import { aclEntries, evaluateInterfaceAcl } from './ipv4-policy';
import { syncVtp, vtpDigest, vtpDomainDisplay, vtpModeDisplay, vtpState, vtpUpdater, VTP_MAX_VLANS } from './vtp';
import { renderSpanningTree, renderSpanningTreeInterface, renderSpanningTreeRoot, renderSpanningTreeSummary } from './stp';

function traceOneWay(sourceId: string, destinationIp: string, topology: Topology, sessions: Record<string, Session>, establishedFirewalls = new Set<string>(), sourceAddress?: string) {
  const hops: string[] = [];
  const fail = (summary: string) => ({ passed: false, summary, hops, path: [] as string[] });
  if (ipToNumber(destinationIp) === null) return fail('Only IPv4 path diagnostics are modeled; no IPv6 reachability is claimed.');
  const source = topology.nodes.find(node => node.id === sourceId);
  if (!source || !sessions[sourceId]) return fail('Source device is not available.');
  const sourceIp = sourceAddress || Object.entries(sessions[sourceId].interfaces).find(([port, state]) => interfaceEvidence(sessions[sourceId], port).up && state.ipv4.length)?.[1].ipv4[0].split(' ')[0];
  if (!sourceIp) return fail(`${source.name}: no IPv4 address on an enabled source interface.`);
  const destinationNode = topology.nodes.find(node => Object.values(sessions[node.id]?.interfaces || {}).some(state => state.ipv4.some(address => address.split(' ')[0] === destinationIp)));
  if (destinationNode) {
    const destinationSession = sessions[destinationNode.id];
    const enabled = Object.entries(destinationSession.interfaces).some(([port, state]) => interfaceEvidence(destinationSession, port).up && state.ipv4.some(address => address.split(' ')[0] === destinationIp));
    if (!enabled) return fail(`${destinationNode.name}: destination address ${destinationIp} is on a disabled interface.`);
  }
  const resolution = resolveProbePath(sourceId, destinationIp, topology, sessions);
  if ('error' in resolution) {
    const destination = topology.nodes.find(node => Object.values(sessions[node.id]?.interfaces || {}).some(state => state.ipv4.some(address => address.split(' ')[0] === destinationIp)));
    if (destination) hops.push(...diagnosePath({ topology: { devices: topology.nodes, links: topology.links } } as LabConfig, sessions, sourceId, destination.id, clientVlan(sourceId, topology, sessions)).hops);
    return fail(resolution.error);
  }
  const nodes = [sourceId];
  for (const id of resolution.path) {
    const link = topology.links.find(link => link.id === id);
    if (!link) return fail('A path link is missing from the topology.');
    const current = nodes[nodes.length - 1];
    nodes.push(link.from === current ? link.to : link.from);
    for (const [node, port] of [[link.from, link.fromPort], [link.to, link.toPort]]) {
      if (!interfaceEvidence(sessions[node], port).up) return fail(`${node} ${port}: interface down.`);
    }
    hops.push(`${link.from}:${link.fromPort} -> ${link.to}:${link.toPort}: link enabled`);
  }
  for (let index = 0; index < nodes.length; index++) {
    const node = topology.nodes.find(node => node.id === nodes[index])!;
    const session = sessions[node.id];
    const incoming = index > 0 ? topology.links.find(link => link.id === resolution.path[index - 1]) : undefined;
    const outgoing = topology.links.find(link => link.id === resolution.path[index]);
    for (const [link, direction] of [[incoming, 'in'], [outgoing, 'out']] as const) {
      if (!link) continue;
      const port = link.from === node.id ? link.fromPort : link.toPort;
      const decision = evaluateInterfaceAcl(session, port, direction, sourceIp, destinationIp);
      if (decision.reason !== 'No interface ACL bound') hops.push(`${node.name} ${port} ${direction}: ${decision.reason}`);
      if (!decision.allowed) return fail(`${node.name}: ${decision.reason}`);
    }
    if (index < nodes.length - 1 && (node.kind === 'router' || node.role.includes('Layer 3'))) hops.push(`${node.name}: route-selected forwarding validated`);
    if (node.kind === 'firewall' && index > 0 && index < nodes.length - 1) {
      const ingress = topology.links.find(link => link.id === resolution.path[index - 1])!;
      const egress = topology.links.find(link => link.id === resolution.path[index])!;
      const inPort = ingress.from === node.id ? ingress.fromPort : ingress.toPort;
      const outPort = egress.from === node.id ? egress.fromPort : egress.toPort;
      const decision = evaluateAsaTraffic(session, createSimulatedFlow({ protocol: 'icmp', source: source.name, destination: resolution.destination.name, sourceIp, destinationIp }), session.interfaces[inPort]?.nameif || '', session.interfaces[outPort]?.nameif || '');
      hops.push(`${node.name}: ${decision.reason}`);
      if (!decision.allowed && !establishedFirewalls.has(node.id)) return fail(`${node.name}: firewall rejected the packet.`);
      if (establishedFirewalls.has(node.id)) hops.push(`${node.name}: reply follows the modeled established ICMP exchange.`);
    }
  }
  return { passed: true, summary: 'Modeled forwarding and interface policy checks passed.', hops, path: resolution.path };
}

export function tracePacket(sourceId: string, destinationIp: string, topology: Topology, sessions: Record<string, Session>) {
  const forward = traceOneWay(sourceId, destinationIp, topology, sessions);
  if (!forward.passed) return forward;
  const destination = topology.nodes.find(node => Object.values(sessions[node.id]?.interfaces || {}).some(state => state.ipv4.some(address => address.split(' ')[0] === destinationIp)));
  const sourceIp = Object.entries(sessions[sourceId].interfaces).find(([port, state]) => interfaceEvidence(sessions[sourceId], port).up && state.ipv4.length)?.[1].ipv4[0].split(' ')[0];
  if (!destination || !sourceIp) return { ...forward, passed: false, summary: 'Reply cannot be verified: endpoint address is not configured in the session.' };
  const forwardNodes = new Set(forward.path.flatMap(id => { const link = topology.links.find(link => link.id === id)!; return [link.from, link.to]; }));
  const established = new Set(topology.nodes.filter(node => node.kind === 'firewall' && forwardNodes.has(node.id)).map(node => node.id));
  const reverse = traceOneWay(destination.id, sourceIp, topology, sessions, established, destinationIp);
  return { ...forward, replyPath: reverse.path, passed: reverse.passed, summary: reverse.passed ? 'Modeled IPv4 request and reply paths passed route, VLAN, interface and ICMP policy checks.' : `Return path failed: ${reverse.summary}`, hops: [...forward.hops, 'Return path:', ...reverse.hops] };
}
export function executeNetworkCommand(node: SandboxNode, topology: Topology, sessions: Record<string, Session>, raw: string): { accepted: boolean; sessions: Record<string, Session>; output: string[] } {
  // Note: `accepted` is typed as boolean (not a literal union) because the
  // `do`-prefix path recurses through this function, which defeats literal
  // return-type inference.
  const command = canonicalCommand(raw);
  const current = sessions[node.id];
  const help = current ? iosDeviceContextHelp(raw, current.mode, node, current.context) : null;
  if (help) return { accepted: true, sessions, output: help };
  // `do` runs a privileged EXEC command without leaving configuration mode.
  if (current && current.mode !== 'privileged' && current.mode !== 'user' && current.mode !== 'shell') {
    const doInner = command.match(/^do (.+)$/);
    if (doInner) {
      const inner = doInner[1].trim();
      if (!inner || !isCiscoCommand(inner, 'privileged') || !supportsDeviceCommand(inner, node, current.context)) {
        return { accepted: false, sessions, output: ["% Invalid input detected at '^' marker."] };
      }
      const asPrivileged = { ...sessions, [node.id]: { ...current, mode: 'privileged' as Mode, context: null } };
      const innerResult = executeNetworkCommand(node, topology, asPrivileged, inner);
      // `do` always returns to the config prompt it ran from.
      const restored = { ...innerResult.sessions[node.id], mode: current.mode, context: current.context };
      return { ...innerResult, sessions: { ...innerResult.sessions, [node.id]: restored } };
    }
    if (command === 'do' || command.startsWith('do ')) {
      return { accepted: false, sessions, output: ["% Invalid input detected at '^' marker."] };
    }
  }
  if (!current || !isCiscoCommand(command, current.mode) || !supportsDeviceCommand(command, node, current.context)) {
    return { accepted: false, sessions, output: ["% Invalid input detected at '^' marker."] };
  }
  let next = { ...sessions, [node.id]: applyCommand(current, command, current.history) };
  const details: string[] = [];
  const vtpBlocked = ((current.mode === 'config' && /^vlan \d+$/.test(command)) || (current.mode === 'vlan' && command.startsWith('name '))) && (current.vtp?.mode || 'server') === 'client';
  if (vtpBlocked) {
    details.push('% VTP client cannot configure VLANs; configure them on the VTP server.');
  }
  if (current.vtp && next[node.id].vtp && current.vtp.domain !== next[node.id].vtp!.domain) {
    const nextDomain = next[node.id].vtp!.domain || 'NULL';
    details.push(`Changing VTP domain name from ${current.vtp.domain || 'NULL'} to ${nextDomain}`);
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const pad = (value: number) => String(value).padStart(2, '0');
    details.push(`*${months[now.getMonth()]} ${now.getDate()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${String(now.getMilliseconds()).padStart(3, '0')}: %SW_VLAN-6-VTP_DOMAIN_NAME_CHG: VTP domain name changed to ${nextDomain}.`);
  }
  const context = next[node.id].context;
  if (context && (command === 'ip address dhcp' || command === 'no shutdown') && next[node.id].interfaces[context]?.dhcpClient) {
    if (next[node.id].interfaces[context].shutdown) details.push('DHCP: waiting for the client interface to be enabled.');
    else {
      const lease = resolveDhcpLease(node.id, context, topology, next, next[node.id]);
      if ('error' in lease) details.push(lease.error);
      else { next = { ...next, ...lease.learnedSessions, [lease.serverId]: lease.serverSession, [node.id]: lease.clientSession }; details.push(...lease.output); }
    }
  }
  if (context && command === 'power inline auto' && node.kind === 'switch') {
    const result = negotiatePoe(node, context, topology, next[node.id]);
    next[node.id] = result.session; details.push(...result.output);
  }
  if (command.startsWith('nslookup ')) {
    const result = resolveDnsName(node.id, command.slice(9).trim(), topology, next);
    if ('error' in result) details.push(result.error);
    else { next[node.id] = { ...next[node.id], dnsCache: { ...next[node.id].dnsCache, [result.name]: result.address } }; details.push(`Name: ${result.name}`, `Address: ${result.address}`); }
  }
  if (command === 'shutdown' && current.context) {
    next = removeMacEntriesForPort(next, node.id, current.context);
    for (const link of topology.links.filter(l => l.from === node.id && l.fromPort === current.context || l.to === node.id && l.toPort === current.context)) next = removeMacEntriesForLink(next, topology, link);
  }
  next = reconcileOspfRoutes(topology, next);
  next = syncVtp(topology, next);
  const named = Object.fromEntries(topology.nodes.filter(device => next[device.id]).map(device => [device.name, next[device.id]]));
  const learned = applyModeledLayer2Learning(named, { devices: topology.nodes, links: topology.links });
  next = { ...next, ...Object.fromEntries(topology.nodes.filter(device => learned[device.name]).map(device => [device.id, learned[device.name]])) };
  next = ageMacTables(next);
  if (command.startsWith('ping ')) {
    const destination = command.split(' ')[1];
    const diagnostic = tracePacket(node.id, destination, topology, next);
    if (!diagnostic.passed) {
      next[node.id] = { ...next[node.id], arpTable: current.arpTable, macTable: current.macTable };
    } else if (diagnostic.path.length) {
      const firstLink = topology.links.find(link => link.id === diagnostic.path[0]);
      const egress = firstLink?.from === node.id ? firstLink.fromPort : firstLink?.to === node.id ? firstLink.toPort : undefined;
      if (egress) next[node.id] = { ...next[node.id], arpTable: next[node.id].arpTable.map(entry => entry.ip === destination ? { ...entry, interface: egress } : entry) };
    }
  }
  return { accepted: true, sessions: next, output: [...outputFor(command, node, topology, next[node.id], next), ...details] };
}

export function interfaceSubnet(address: string): number | null {
  const [ip, mask] = address.split(" ");
  const ipNumber = ipToNumber(ip);
  const maskNumber = ipToNumber(mask);
  return ipNumber === null || maskNumber === null ? null : (ipNumber & maskNumber) >>> 0;
}

export function ospfNetworksMatch(address: string, networks: { network: string; wildcard: string; area: number }[]): boolean {
  const [ip] = address.split(" ");
  const ipNumber = ipToNumber(ip);
  if (ipNumber === null) return false;
  return networks.some((network) => {
    const networkNumber = ipToNumber(network.network);
    const wildcardNumber = ipToNumber(network.wildcard);
    return networkNumber !== null && wildcardNumber !== null && ((ipNumber & (~wildcardNumber >>> 0)) >>> 0) === ((networkNumber & (~wildcardNumber >>> 0)) >>> 0);
  });
}

export function isOspfSpeaker(node: SandboxNode): boolean {
  return node.kind === "router" || node.role.includes("Layer 3") || node.role.includes("OSPF Speaker");
}

// A device maintains an IP routing table only when it can actually forward
// by IP: routers, firewalls, and switches whose role marks them Layer 3 /
// OSPF speakers. A Layer 2 switch forwards by MAC table, not by routing
// table, even when it carries a management SVI address.
export function isRoutedDevice(node: { kind: string; role?: string }): boolean {
  return node.kind === "router" || node.kind === "firewall" || /Layer 3|OSPF Speaker/i.test(node.role || "");
}

export function supportsSandboxCommand(command: string, node: SandboxNode, context: string | null): boolean {
  return supportsDeviceCommand(command, node, context);
}

export function ospfNeighbors(node: SandboxNode, topology: Topology, sessions: Record<string, Session>): { name: string; address: string; state: string }[] {
  const neighbors: { name: string; address: string; state: string }[] = [];
  for (const link of ospfTransitLinks({ topology: { devices: topology.nodes, links: topology.links } } as LabConfig, sessions)) {
    const peerId = link.from === node.id ? link.to : link.to === node.id ? link.from : null;
    if (!peerId) continue;
    const peer = topology.nodes.find((candidate) => candidate.id === peerId);
    if (!peer || !isOspfSpeaker(peer) || !isOspfSpeaker(node)) continue;
    const localPort = link.from === node.id ? link.fromPort : link.toPort;
    const peerPort = link.from === node.id ? link.toPort : link.fromPort;
    const localSession = sessions[node.id];
    const peerSession = sessions[peer.id];
    if (!localSession || !peerSession || !Object.keys(localSession.ospfProcesses || {}).length || !Object.keys(peerSession.ospfProcesses || {}).length) continue;
    const evidence = protocolEvidence({ topology: { devices: topology.nodes, links: [link] } } as LabConfig, sessions);
    if (!evidence.some(row => row.protocol === 'OSPF' && row.state === 'FULL')) continue;
    const localAddresses = localSession.interfaces[localPort]?.ipv4 || [];
    const peerAddresses = peerSession.interfaces[peerPort]?.ipv4 || [];
    const shared = localAddresses.find((localAddress) => peerAddresses.some((peerAddress) => interfaceSubnet(localAddress) !== null && interfaceSubnet(localAddress) === interfaceSubnet(peerAddress) && ospfNetworksMatch(localAddress, Object.values(localSession.ospfProcesses).flatMap((process) => process.networks)) && ospfNetworksMatch(peerAddress, Object.values(peerSession.ospfProcesses).flatMap((process) => process.networks))));
    if (shared) neighbors.push({ name: peer.name, address: peerAddresses[0]?.split(" ")[0] || "unknown", state: "FULL" });
  }
  return neighbors;
}

export function prefixLength(mask: string): number {
  const number = ipToNumber(mask);
  if (number === null) return 32;
  let count = 0;
  for (let bit = 31; bit >= 0 && (number & (1 << bit)) !== 0; bit -= 1) count += 1;
  return count;
}

export function reconcileOspfRoutes(topology: Topology, sessions: Record<string, Session>): Record<string, Session> {
  const next = Object.fromEntries(Object.entries(sessions).map(([id, session]) => [id, { ...session, routingTable: session.routingTable.filter(route => route.protocol !== 'ospf') }]));
  const adjacency = new Map<string, Array<{ peer: string; port: string; nextHop: string; cost: number }>>();
  for (const link of ospfTransitLinks({ topology: { devices: topology.nodes, links: topology.links } } as LabConfig, sessions)) {
    const evidence = protocolEvidence({ topology: { devices: topology.nodes, links: [link] } } as LabConfig, sessions);
    if (!evidence.some(row => row.protocol === 'OSPF' && row.state === 'FULL')) continue;
    for (const [id, peer, port, peerPort] of [[link.from, link.to, link.fromPort, link.toPort], [link.to, link.from, link.toPort, link.fromPort]]) {
      const neighbors = adjacency.get(id) || [];
      neighbors.push({ peer, port, nextHop: sessions[peer].interfaces[peerPort].ipv4[0].split(' ')[0], cost: Math.max(1, sessions[id].interfaces[port].ospfCost || 1) });
      adjacency.set(id, neighbors);
    }
  }
  for (const node of topology.nodes) {
    const session = next[node.id];
    if (!session) continue;
    // Only OSPF speakers learn OSPF routes. A Layer 2 switch never gains
    // protocol entries from an adjacency it cannot participate in, even if
    // a stale routing-table entry or a mis-seeded session claims otherwise.
    if (!isOspfSpeaker(node)) continue;
    const prefix = (address: string) => { const [, mask] = address.split(' '); return `${numberToIp(interfaceSubnet(address) || 0)}/${prefixLength(mask)}`; };
    const connected = new Set(Object.entries(session.interfaces).filter(([port]) => interfaceEvidence(session, port).up).flatMap(([, state]) => state.ipv4.map(prefix)));
    const seen = new Set([node.id]);
    const queue = (adjacency.get(node.id) || []).map(edge => ({ ...edge }));
    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost || a.peer.localeCompare(b.peer));
      const edge = queue.shift()!;
      if (seen.has(edge.peer)) continue;
      seen.add(edge.peer);
      const peer = sessions[edge.peer];
      const networks = Object.values(peer.ospfProcesses).flatMap(process => process.networks);
      for (const [port, state] of Object.entries(peer.interfaces)) {
        if (!interfaceEvidence(peer, port).up) continue;
        for (const address of state.ipv4) {
          const network = prefix(address);
          if (connected.has(network) || !ospfNetworksMatch(address, networks)) continue;
          const metric = edge.cost + Math.max(1, state.ospfCost || 1);
          const existing = session.routingTable.find(route => route.prefix === network);
          if (existing && (existing.protocol !== 'ospf' || (existing.metric ?? Infinity) <= metric)) continue;
          session.routingTable = session.routingTable.filter(route => route.prefix !== network);
          session.routingTable.push({ prefix: network, nextHop: edge.nextHop, interface: edge.port, protocol: 'ospf', metric });
        }
      }
      for (const neighbor of adjacency.get(edge.peer) || []) if (!seen.has(neighbor.peer)) queue.push({ ...edge, peer: neighbor.peer, cost: edge.cost + neighbor.cost });
    }
  }
  return next;
}

export function outputFor(command: string, node: SandboxNode, topology: Topology, session: Session, sessions: Record<string, Session> = {}): string[] {
  const shared = evidenceOutput(command, session, { topology: { devices: topology.nodes, links: topology.links } } as LabConfig, { ...sessions, [node.id]: session });
  if (shared) return shared;
  // VTP-aware view: a client shows the database it has adopted from the
  // domain's highest revision, not its stale local copy. executeNetworkCommand
  // already syncs, so this mostly covers direct outputFor callers; sync is
  // idempotent, so running it twice is harmless.
  const view = syncVtp(topology, sessions)[node.id] || session;
  if (command.startsWith("show ")) {
    const physicalPorts = node.ports.filter(port => !/^vlan|^port-channel/i.test(port));
    const portEvidence = (port: string) => {
      const state = session.interfaces[port];
      const link = topology.links.find(item => item.from === node.id && item.fromPort === port || item.to === node.id && item.toPort === port);
      const peerId = link?.from === node.id ? link.to : link?.from;
      const peerPort = link?.from === node.id ? link.toPort : link?.fromPort;
      const peer = topology.nodes.find(item => item.id === peerId);
      const peerState = peerPort ? sessions[peerId || '']?.interfaces[peerPort] : undefined;
      const localUp = !!state && !state.shutdown && state.status === 'up';
      // End hosts power their own NICs: a PC/server/printer runs no IOS
      // session in the labs, so a missing interface entry means its NIC is
      // up, not down. Network devices still default to down until they are
      // configured, and an explicit host shutdown/down entry still wins.
      const hostKinds = ['pc', 'server', 'printer', 'iot', 'access-point'];
      const peerUp = peerState
        ? !peerState.shutdown && peerState.status === 'up'
        : !!peer && hostKinds.includes(peer.kind);
      const status = state?.status === 'err-disabled' ? 'err-disabled' : state?.shutdown ? 'disabled' : link && localUp && peerUp ? 'connected' : 'notconnect';
      return { state, peer, peerPort, status };
    };
    if (command === 'show interfaces status') {
      return ['Port       Name                 Status        Vlan       Duplex Speed  Type', ...physicalPorts.map(port => {
        const { state, status } = portEvidence(port);
        const description = [...(state?.commands || [])].reverse().find(value => value.startsWith('description '))?.slice(12) || '';
        const vlan = state?.switchportMode === 'trunk' ? 'trunk' : state?.switchportMode === 'access' ? String(state.accessVlan || 1) : state?.ipv4.length ? 'routed' : '1';
        return `${port.padEnd(11)}${description.slice(0, 20).padEnd(21)}${status.padEnd(14)}${vlan.padEnd(11)}${(state?.duplex || 'auto').padEnd(7)}${(state?.speed || 'auto').padEnd(7)}Ethernet`;
      })];
    }
    if (command === 'show interfaces counters errors') {
      return ['Port       CRC errors  Collisions', ...physicalPorts.map(port => {
        const counters = session.interfaces[port]?.errors;
        return `${port.padEnd(11)}${String(counters?.crc ?? 'not modeled').padEnd(12)}${counters?.collisions ?? 'not modeled'}`;
      })];
    }
    if (command === 'show version') {
      const platform = node.kind === 'router'
        ? { model: 'Cisco ISR 4331', ios: 'Cisco IOS XE Software, Version 16.09.04', image: 'bootflash:isr4300-universalk9.16.09.04.SPA.bin', register: '0x2102' }
        : node.kind === 'switch'
          ? /Layer 3|OSPF Speaker/i.test(node.role || '')
            ? { model: 'Cisco Catalyst 3560-X', ios: 'Cisco IOS Software, C3560E Software (C3560E-UNIVERSALK9-M), Version 15.0(2)SE7', image: 'flash:c3560e-universalk9-mz.150-2.SE7.bin', register: '0xF' }
            : { model: 'Cisco Catalyst 2960', ios: 'Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 15.0(2)SE7', image: 'flash:c2960-lanbasek9-mz.150-2.SE7.bin', register: '0xF' }
          : node.kind === 'firewall'
            ? { model: 'Cisco ASA 5506-X', ios: 'Cisco Adaptive Security Appliance Software Version 9.12(2)', image: 'disk0:/asa912-smp-k8.bin', register: '0x1' }
            : null;
      if (!platform) return [`% Version information is not available on ${node.name}.`];
      return [
        platform.ios,
        'RELEASE SOFTWARE (fc1)',
        '',
        `${node.name} uptime is not modeled`,
        `System image file is "${platform.image}"`,
        '',
        `${platform.model} (modeled training platform)`,
        `Configuration register is ${platform.register}`,
      ];
    }
    if (command === 'show clock') {
      // The leading '*' is the IOS marker for a clock that is not
      // authoritative (no NTP source modeled), which is the honest state here.
      const now = new Date();
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const pad = (value: number, width = 2) => String(value).padStart(width, '0');
      return [`*${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}.${pad(now.getUTCMilliseconds(), 3)} UTC ${days[now.getUTCDay()]} ${months[now.getUTCMonth()]} ${pad(now.getUTCDate())} ${now.getUTCFullYear()}`];
    }
    if (command === 'show arp') {
      return ['Protocol  Address          Age (min)  Hardware Addr   Type   Interface', ...(session.arpTable.length
        ? session.arpTable.map(entry => `Internet  ${entry.ip.padEnd(17)}${String(entry.age).padEnd(11)}${entry.mac.padEnd(16)}ARPA   ${entry.interface}`)
        : ['% No ARP entries learned.'])];
    }
    const portSecurity = command.match(/^show port-security interface (\S+)$/);
    if (portSecurity) {
      const port = portSecurity[1];
      if (!physicalPorts.includes(port)) return [`% Interface ${port} does not exist on ${node.name}.`];
      const state = session.interfaces[port];
      const enabled = !!state?.commands.includes('switchport port-security');
      const maximum = state?.commands.find(value => value.startsWith('switchport port-security maximum '))?.split(' ').at(-1) || '1';
      const violation = state?.commands.find(value => value.startsWith('switchport port-security violation '))?.split(' ').at(-1) || 'shutdown';
      return [`Port Security              : ${enabled ? 'Enabled' : 'Disabled'}`,
        `Port Status                : ${portEvidence(port).status}`,
        `Violation Mode             : ${enabled ? violation : 'not configured'}`,
        `Maximum MAC Addresses     : ${enabled ? maximum : 'not configured'}`,
        `Learned MAC Addresses     : ${session.macTable.filter(entry => entry.port === port).length}`,
        'Security violation counter: not modeled'];
    }
    if (command === 'show port-security') {
      if (node.kind !== 'switch') return [`% Port security is not available on ${node.name}.`];
      const securePorts = physicalPorts.filter(port => session.interfaces[port]?.commands.includes('switchport port-security'));
      const rows = securePorts.map(port => {
        const state = session.interfaces[port];
        const maximum = state?.commands.find(value => value.startsWith('switchport port-security maximum '))?.split(' ').at(-1) || '1';
        const violation = state?.commands.find(value => value.startsWith('switchport port-security violation '))?.split(' ').at(-1) || 'shutdown';
        const current = session.macTable.filter(entry => entry.port === port).length;
        const action = violation.charAt(0).toUpperCase() + violation.slice(1);
        return `${port.padEnd(14)}${maximum.padEnd(16)}${String(current).padEnd(14)}${'0'.padEnd(20)}${action}`;
      });
      return [
        `${'Secure Port'.padEnd(14)}${'MaxSecureAddr'.padEnd(16)}${'CurrentAddr'.padEnd(14)}${'SecurityViolation'.padEnd(20)}Security Action`,
        `${''.padEnd(14)}${'(Count)'.padEnd(16)}${'(Count)'.padEnd(14)}${'(Count)'.padEnd(20)}`,
        '------------------------------------------------------------------------',
        ...rows,
        ...(rows.length ? ['------------------------------------------------------------------------'] : []),
        'Total Addresses in System (excluding one mac per port)     : 0',
        'Max Addresses limit in System (excluding one mac per port) : 6144',
        'Security violation counts are not modeled; the violation column reports 0.',
      ];
    }
    if (command === 'show access-lists' || command.startsWith('show access-lists ')) {
      const name = command.slice('show access-lists'.length).trim().toLowerCase();
      const entries = aclEntries(session).filter(entry => !name || entry.acl === name);
      if (!entries.length) return [name ? `% Access list ${name} is not configured.` : '% No access lists configured.'];
      const groups = new Map<string, typeof entries>();
      for (const entry of entries) groups.set(entry.acl, [...(groups.get(entry.acl) || []), entry]);
      return Array.from(groups.entries()).flatMap(([acl, rules]) => [
        `${rules[0].type === 'extended' ? 'Extended' : 'Standard'} IP access list ${acl}`,
        ...rules.map((rule, index) => `    ${(index + 1) * 10} ${rule.action} ${rule.match}`),
      ]);
    }
    const renderInterface = (port: string, switchportOnly: boolean): string[] => {
      if (!physicalPorts.includes(port) && !session.interfaces[port]) return [`% Interface ${port} does not exist on ${node.name}.`];
      const { state, peer, peerPort, status } = portEvidence(port);
      if (switchportOnly) return [
        `Name: ${port}`,
        `Administrative Mode: ${state?.switchportMode || 'not configured'}`,
        `Operational Mode: ${status === 'connected' ? state?.switchportMode || 'not configured' : 'down'}`,
        `Access Mode VLAN: ${state?.accessVlan || 1}`,
        `Trunking Native Mode VLAN: ${state?.nativeVlan || 1}`,
        `Trunking VLANs Enabled: ${state?.allowedVlans || 'all'}`,
      ];
      const lineStatus = status === 'connected' ? 'up' : status === 'disabled' ? 'administratively down' : status === 'err-disabled' ? 'down (err-disabled)' : 'down';
      return [
        `${port} is ${lineStatus}, line protocol is ${status === 'connected' ? 'up' : 'down'}`,
        `Description: ${[...(state?.commands || [])].reverse().find(value => value.startsWith('description '))?.slice(12) || 'not configured'}`,
        `Modeled topology peer: ${peer ? `${peer.name} ${peerPort}` : 'not connected'}`,
        `Switchport mode: ${state?.switchportMode || 'not configured'}`,
        ...(state?.switchportMode === 'access' ? [`Access VLAN: ${state.accessVlan || 1}`] : []),
        ...(state?.switchportMode === 'trunk' ? [`Native VLAN: ${state.nativeVlan || 1}`, `Allowed VLANs: ${state?.allowedVlans || 'all'}`] : []),
        `Duplex: ${state?.duplex || 'auto'}, speed: ${state?.speed || 'auto'} Mb/s`,
        `CRC errors: ${state?.errors.crc ?? 'not modeled'}, collisions: ${state?.errors.collisions ?? 'not modeled'}`,
      ];
    };
    if (command === 'show interfaces' || command === 'show interfaces switchport') {
      // Bare `show interfaces` dumps every physical port, as IOS does.
      const switchportOnly = command === 'show interfaces switchport';
      return physicalPorts.flatMap((port, index) => [...(index ? [''] : []), ...renderInterface(port, switchportOnly)]);
    }
    const interfaceCommand = command.match(/^show interfaces (?!trunk$|status$|counters\b)(\S+)(?: switchport)?$/);
    if (interfaceCommand) {
      return renderInterface(interfaceCommand[1], command.endsWith(' switchport'));
    }
    if (command.startsWith('show running-config interface ')) {
      const port = command.slice('show running-config interface '.length);
      const state = session.interfaces[port];
      if (!state) return [`% Interface ${port} is not configured.`];
      const description = [...state.commands].reverse().find(value => value.startsWith('description '));
      const other = state.commands.filter(value => !/^(description |ip address |(?:no )?shutdown$|switchport (?:mode |access vlan |trunk (?:native vlan |allowed vlan )))/.test(value));
      return ['Building configuration...', `interface ${port}`, ...(description ? [` ${description}`] : []),
        ...(state.switchportMode ? [` switchport mode ${state.switchportMode}`] : []),
        ...(state.accessVlan ? [` switchport access vlan ${state.accessVlan}`] : []),
        ...(state.nativeVlan ? [` switchport trunk native vlan ${state.nativeVlan}`] : []),
        ...(state.allowedVlans ? [` switchport trunk allowed vlan ${state.allowedVlans}`] : []),
        ...(state.dhcpClient ? [' ip address dhcp'] : state.ipv4.map(address => ` ip address ${address}`)),
        ...Array.from(new Set(other)).map(value => ` ${value}`), state.shutdown ? ' shutdown' : ' no shutdown', 'end'];
    }
    if (command === "show hosts") {
      const records = Object.entries(session.dnsRecords || {});
      return records.length ? ["Default domain is not set", "Name/address lookup uses domain service", "Name                  Address", ...records.map(([name, address]) => `${name.padEnd(22)}${address}`)] : ["% No static DNS host records configured."];
    }
    if (command === "show ip ospf database") {
      const lab = { topology: { devices: topology.nodes, links: topology.links } } as LabConfig;
      return formatOspfDatabaseCli(ospfOperationalEvidence(lab, { ...sessions, [node.id]: session }, node.name));
    }
    if (command === "show ipv6 ospf database") {
      const lab = { topology: { devices: topology.nodes, links: topology.links } } as LabConfig;
      return formatOspfDatabaseCli(ospfOperationalEvidence(lab, { ...sessions, [node.id]: session }, node.name, 'ipv6'));
    }
    if (command === 'show ip ospf' || command.startsWith('show ip ospf interface')) {
      const lab = { topology: { devices: topology.nodes, links: topology.links } } as LabConfig;
      const evidence = ospfOperationalEvidence(lab, { ...sessions, [node.id]: session }, node.name);
      if (command === 'show ip ospf') return formatOspfProcessCli(evidence);
      const suffix = command.slice('show ip ospf interface'.length).trim();
      return formatOspfInterfaceCli(evidence, suffix && suffix !== 'brief' ? suffix : undefined, suffix === 'brief');
    }
    if (command === 'show ipv6 ospf' || command.startsWith('show ipv6 ospf interface')) {
      const lab = { topology: { devices: topology.nodes, links: topology.links } } as LabConfig;
      const evidence = ospfOperationalEvidence(lab, { ...sessions, [node.id]: session }, node.name, 'ipv6');
      if (command === 'show ipv6 ospf') return formatOspfProcessCli(evidence);
      const suffix = command.slice('show ipv6 ospf interface'.length).trim();
      return formatOspfInterfaceCli(evidence, suffix && suffix !== 'brief' ? suffix : undefined, suffix === 'brief');
    }
    if (command === "show ip route" || command.startsWith('show ip route ')) {
      if (!isRoutedDevice(node)) {
        return ["% No modeled IP routing table on " + node.name + ".", "Layer 2 switches forward by MAC address table; use 'show mac address-table' for forwarding evidence."];
      }
      const code = (protocol: string) => protocol === 'connected' ? 'C' : protocol === 'static' ? 'S' : 'O';
      const detail = (route: { protocol: string; prefix: string; nextHop?: string; interface?: string; metric?: number }) => {
        if (route.protocol === 'connected') return `${code(route.protocol)}    ${route.prefix} is directly connected, ${route.interface || '-'}`;
        const metric = route.protocol === 'ospf' ? ` [110/${route.metric ?? 2}]` : '';
        return `${code(route.protocol)}    ${route.prefix}${metric} via ${route.nextHop || '-'}, ${route.interface || '-'}`;
      };
      const filter = command.slice('show ip route'.length).trim();
      const routes = ipv4Routes(session).filter(route => !filter || ['connected', 'static', 'ospf'].includes(filter) ? !filter || route.protocol === filter : route.prefix.split('/')[0] === filter);
      return routes.length ? ["Codes: C - connected, S - static, O - OSPF", "", ...routes.map(detail)] : ["Codes: C - connected, S - static, O - OSPF", "% No modeled routes are present."];
    }
    if (command === 'show running-config | section interface') {
      return Object.keys(session.interfaces).flatMap(port => outputFor(`show running-config interface ${port}`, node, topology, session, sessions).slice(1, -1));
    }
    if (command === 'show running-config | section access-list') {
      const lines: string[] = [];
      let inAcl = false;
      for (const line of session.runningConfig) {
        if (/^ip access-list /.test(line)) { inAcl = true; lines.push(line); }
        else if (inAcl && /^(?:permit|deny|remark) /.test(line)) lines.push(` ${line}`);
        else { inAcl = false; if (/^access-list /.test(line)) lines.push(line); }
      }
      return lines.length ? lines : ['% No access lists configured.'];
    }
    if (command === "show running-config" || command.startsWith("show running-config |")) {
      const interfaceCommands = new Set(Object.values(session.interfaces).flatMap(state => state.commands.map(line => line.toLowerCase())));
      const globalAndAcl: string[] = [];
      let inAcl = false;
      for (const line of session.runningConfig) {
        if (/^ip access-list /i.test(line)) { inAcl = true; globalAndAcl.push(line); }
        else if (inAcl && /^(?:permit|deny|remark) /i.test(line)) globalAndAcl.push(` ${line}`);
        else { inAcl = false; if (!interfaceCommands.has(line.toLowerCase())) globalAndAcl.push(line); }
      }
      const interfaces = Object.keys(session.interfaces).flatMap(port => outputFor(`show running-config interface ${port}`, node, topology, session, sessions).slice(1, -1));
      return ["Building configuration...", `hostname ${session.hostname}`, ...globalAndAcl, ...interfaces, "!", "end"];
    }
    if (command === "show startup-config") {
      return session.startupConfig.length > 0
        ? session.startupConfig.join('\n') === session.runningConfig.join('\n')
          ? outputFor('show running-config', node, topology, session, sessions).slice(1)
          : [`hostname ${session.hostname}`, ...session.startupConfig, "!", "end"]
        : ["% Startup configuration is empty."];
    }
    if (command === "show vlan brief") {
      const entries = Object.entries(view.vlans);
      return ["VLAN Name                             Status    Ports", ...(entries.length ? entries.map(([id, name]) => {
        const ports = Object.entries(view.interfaces)
          .filter(([, state]) => state.switchportMode === 'access' && String(state.accessVlan || 1) === id)
          .map(([port]) => port).sort();
        return `${id.padEnd(4)} ${name.padEnd(32)} active    ${ports.join(', ')}`;
      }) : ["% No user VLANs configured."])];
    }
    if (command === "show vtp status") {
      if (node.kind !== "switch") return [`% VTP is not available on ${node.name}.`];
      const state = vtpState(view);
      const updater = vtpUpdater(view);
      const digest = vtpDigest(state, view.vlans);
      const existing = 1 + Object.keys(view.vlans).filter((id) => id !== "1").length;
      // The top block follows standard IOS show vtp status layout above the
      // screenshot's visible cut; the emulator supports versions 1–2 only.
      return [
        `${"VTP Version capable".padEnd(34)}: 1 to 2`,
        `${"VTP version running".padEnd(34)}: ${state.version}`,
        `${"VTP Domain Name".padEnd(34)}: ${vtpDomainDisplay(state.domain)}`,
        `${"VTP Pruning Mode".padEnd(34)}: Disabled`,
        `${"VTP Traps Generation".padEnd(34)}: Disabled`,
        "",
        `Configuration last modified by ${state.lastModifiedBy} at ${state.lastModifiedAt}`,
        `Local updater ID is ${updater.id} on interface ${updater.iface} (${updater.id === "0.0.0.0" ? "no VLAN interface with an address found" : "lowest numbered VLAN interface found"})`,
        "",
        "Feature VLAN:",
        "--------------",
        `${"VTP Operating Mode".padEnd(34)}: ${vtpModeDisplay(state.mode)}`,
        `${"Maximum VLANs supported locally".padEnd(34)}: ${VTP_MAX_VLANS}`,
        `${"Number of existing VLANs".padEnd(34)}: ${existing}`,
        `${"Configuration Revision".padEnd(34)}: ${state.revision}`,
        `${"MD5 digest".padEnd(34)}: ${digest[0]}`,
        `${" ".repeat(36)}${digest[1]}`,
      ];
    }
    const spanningTreeVlan = command.match(/^show spanning-tree(?: vlan (\d+))?$/);
    const spanningTreeInterface = command.match(/^show spanning-tree interface (\S+) detail$/);
    if (spanningTreeVlan || spanningTreeInterface || command === 'show spanning-tree root' || command === 'show spanning-tree summary') {
      if (node.kind !== "switch") return [`% Spanning tree is not available on ${node.name}.`];
      // The VLAN list follows the VTP-synced database, so a client shows
      // instances for adopted VLANs. `root`, `summary`, and
      // `interface <port> detail` render from the same converged tree.
      if (spanningTreeInterface) return renderSpanningTreeInterface(node, topology, session, sessions, view.vlans, spanningTreeInterface[1]);
      if (command === 'show spanning-tree root') return renderSpanningTreeRoot(node, topology, session, sessions, view.vlans);
      if (command === 'show spanning-tree summary') return renderSpanningTreeSummary(node, topology, session, sessions, view.vlans);
      return renderSpanningTree(node, topology, session, sessions, view.vlans, spanningTreeVlan![1] === undefined ? undefined : Number(spanningTreeVlan![1]));
    }
    if (command === "show ip dhcp pool") {
      const pools = Object.values(session.dhcpPools || {});
      return pools.length
        ? ["Pool                          Active leases    Network", ...pools.map((pool) => `${pool.name.padEnd(30)} ${(session.dhcpLeases || []).filter(lease => lease.pool === pool.name && leaseState(lease) === 'active').length}    ${pool.network || "not configured"}`)]
        : ["% No DHCP pools configured."];
    }
    if (command === "show ip dhcp binding") {
      const leases = session.dhcpLeases || [];
      return ["Modeled DHCP bindings:", "IP address      Client-ID               Lease expiration (UTC)    State", ...(leases.length ? leases.map((lease) => `${lease.ip.padEnd(16)}${lease.clientId.padEnd(24)}${lease.leaseEnd || 'not modeled'}  ${leaseState(lease)}`) : ["% No DHCP bindings."])];
    }
    if (command === "show ip dhcp conflict") return ["IP address        Detection method   Detection time", "% No address conflicts detected."];
    if (command === "show ip dhcp server statistics") return [`Configured pools: ${Object.keys(session.dhcpPools || {}).length}`, `Active modeled leases: ${(session.dhcpLeases || []).filter(lease => leaseState(lease) === 'active').length}`, 'Packet counters and server memory usage are not modeled.'];
    if (command === "show ip dhcp snooping") {
      const enabled = session.runningConfig.includes("ip dhcp snooping");
      const vlans = session.runningConfig.filter(line => /^ip dhcp snooping vlan /.test(line)).map(line => line.slice("ip dhcp snooping vlan ".length));
      return enabled ? ["Switch DHCP snooping is enabled", `Configured VLANs: ${vlans.join(", ") || "none"}`, "Binding and offer events are deterministic training evidence."] : ["Switch DHCP snooping is disabled"];
    }
    if (command === "show ip arp inspection") {
      const vlans = session.runningConfig.filter(line => /^ip arp inspection vlan /.test(line)).map(line => line.slice("ip arp inspection vlan ".length));
      return vlans.length ? ["Source Mac Validation      : enabled", `ARP inspection VLANs      : ${vlans.join(", ")}`, "Inspection decisions are modeled from configured training policy."] : ["ARP inspection is not configured"];
    }
    if (command.startsWith("show mac address-table")) {
      // The grammar's variants filter the table the way IOS does: `secure`
      // shows only addresses on port-security ports, `dynamic` excludes
      // them, and `interface <port>` shows one port's addresses.
      const securePorts = new Set(physicalPorts.filter(port => session.interfaces[port]?.commands.includes('switchport port-security')));
      let entries = session.macTable;
      if (command === 'show mac address-table secure') entries = entries.filter(entry => securePorts.has(entry.port));
      else if (command === 'show mac address-table dynamic') entries = entries.filter(entry => entry.type === 'dynamic' && !securePorts.has(entry.port));
      else {
        const iface = command.match(/^show mac address-table interface (\S+)$/);
        if (iface) entries = entries.filter(entry => entry.port === iface[1]);
      }
      return [
        "          Mac Address Table",
        "-------------------------------------------",
        "Vlan    Mac Address       Type        Ports",
        "----    -----------       --------    -----",
        ...(entries.length ? entries.map((entry) => `${String(entry.vlan).padEnd(8)}${entry.mac.padEnd(18)}${entry.type.padEnd(12)}${entry.port}`) : ["          % No MAC addresses learned."]),
      ];
    }
    if (command === "show ip interface brief") {
      const entries = Object.entries(session.interfaces);
      return ["Interface              IP-Address      OK? Method Status                Protocol", ...(entries.length ? entries.map(([name, state]) => `${name.padEnd(22)} ${(state.ipv4[0]?.split(" ")[0] || "unassigned").padEnd(15)} YES manual ${state.shutdown ? "administratively down" : "up"}                    ${state.shutdown ? "down" : "up"}`) : ["% No interfaces configured."])];
    }
    if (command === 'show ip interface' || command.startsWith('show ip interface ')) {
      const port = command.slice('show ip interface'.length).trim();
      const ports = port ? [port] : Object.keys(session.interfaces);
      return ports.flatMap(name => {
        const state = session.interfaces[name];
        if (!state) return [`% Interface ${name} is not configured.`];
        const status = portEvidence(name).status === 'connected' ? 'up' : 'down';
        const bindings = state.commands.filter(line => /^ip access-group \S+ (?:in|out)$/.test(line));
        const address = state.ipv4[0]?.split(' ');
        return [`${name} is ${state.shutdown ? 'administratively down' : status}, line protocol is ${status}`,
          `  Internet address is ${address ? `${address[0]}/${prefixLength(address[1])}` : 'unassigned'}`,
          `  Inbound access list is ${[...bindings].reverse().find(line => line.endsWith(' in'))?.split(' ')[2] || 'not set'}`,
          `  Outgoing access list is ${[...bindings].reverse().find(line => line.endsWith(' out'))?.split(' ')[2] || 'not set'}`];
      });
    }
    if (command === "show ntp associations") {
      const server = session.runningConfig.find(line => /^ntp server /.test(line))?.slice("ntp server ".length);
      return server ? ["     remote           refid      st t when poll reach   delay   offset  jitter", `*~${server.padEnd(18)}.TIME.          2 u   24   64   377    0.8    0.1    0.2`, "* sys.peer, ~ configured"] : ["% No NTP associations configured."];
    }
    if (command === "show ptp clock") {
      const mode = session.runningConfig.find(line => /^ptp mode /.test(line))?.slice("ptp mode ".length);
      return mode ? [`PTP clock mode: ${mode}`, "Clock state: LISTENING (instructional modeled state)", "Grandmaster selection is modeled when a compatible time source is configured."] : ["% PTP is not configured."];
    }
    if (command === "show ip http server secure-status") {
      const enabled = session.runningConfig.includes("ip http secure-server");
      const port = session.runningConfig.find(line => /^ip http secure-port /.test(line))?.split(" ").at(-1) || "443";
      const rateLimit = session.runningConfig.find(line => /^ip http rate-limit /.test(line))?.split(" ").at(-1);
      const tokenRequired = session.runningConfig.includes("ip http authentication token-required");
      return enabled ? [
        "HTTP secure server status: Enabled",
        `HTTPS port: ${port}`,
        `Rate-limit policy: ${rateLimit ? `${rateLimit} requests/minute (modeled)` : "not configured"}`,
        `Token enforcement: ${tokenRequired ? "required (modeled)" : "not configured"}`,
        "TLS certificate lifecycle is represented as instructional service intent.",
      ] : ["HTTP secure server status: Disabled"];
    }
    if (command === "show ip vrf") {
      const vrfs = session.runningConfig.filter(line => /^ip vrf /.test(line)).map(line => line.slice("ip vrf ".length));
      return ["Name                             Default RD            Interfaces", ...(vrfs.length ? vrfs.map(vrf => `${vrf.padEnd(33)}not configured        ${Object.entries(session.interfaces).filter(([, state]) => state.commands.includes(`ip vrf forwarding ${vrf}`)).map(([name]) => name).join(", ") || "-"}`) : ["% No VRFs configured."])];
    }
    if (command.startsWith("show ip route vrf ")) {
      const vrf = command.slice("show ip route vrf ".length);
      const interfaces = Object.entries(session.interfaces).filter(([, state]) => state.commands.includes(`ip vrf forwarding ${vrf}`));
      return [`Routing Table: ${vrf}`, "Codes: C - connected, S - static", ...(interfaces.length ? interfaces.flatMap(([name, state]) => state.ipv4.map(address => `C    ${address} is directly connected, ${name}`)) : ["% VRF has no modeled interfaces or routes."])];
    }
    if (command === "show ip bgp summary") {
      const process = session.runningConfig.find(line => /^router bgp /.test(line))?.slice("router bgp ".length) || "not configured";
      const peers = session.runningConfig.filter(line => /^neighbor [0-9.]+ remote-as \d+/.test(line));
      return [`BGP router identifier ${process === "not configured" ? "not configured" : "modeled from local configuration"}, local AS number ${process}`, "Neighbor        V    AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd", ...(peers.length ? peers.map(peer => { const [, neighbor, , asn] = peer.split(" "); return `${neighbor.padEnd(16)}4 ${asn.padStart(5)}       1       1        1    0    0 00:00:12        1`; }) : ["% No BGP peers configured."])];
    }
    if (command === "show ip bgp") {
      const networks = session.runningConfig.filter(line => /^network [0-9.]+ mask [0-9.]+/.test(line));
      return ["   Network          Next Hop            Metric LocPrf Weight Path", ...(networks.length ? networks.map(line => { const [, prefix] = line.split(" "); return `*> ${prefix.padEnd(16)}0.0.0.0                  0         32768 i`; }) : ["% No BGP network statements configured."])];
    }
    if (command === "show glbp" || command === "show glbp brief" || command === "show vrrp brief") {
      const protocol = command.includes("glbp") ? "GLBP" : "VRRP";
      const groups = Object.values(session.fhrpGroups || {}).filter(group => group.protocol === protocol);
      if (!groups.length) return [`% No ${protocol} groups configured.`];
      if (protocol === "GLBP") return [
        "Interface   Grp  Pri  State  Address          AVG / AVF       Load sharing       Weight",
        ...groups.map(group => {
          const name = Object.keys(session.interfaces).find(item => `${item}:${protocol}:${group.group}` in (session.fhrpGroups || {})) || "unknown";
          const forwarder = group.glbpForwarder || 1;
          return `${name.padEnd(12)}${String(group.group).padEnd(5)}${String(group.priority || 100).padEnd(5)}Active ${(group.virtualIp || "unassigned").padEnd(17)}AVG / AVF ${String(forwarder).padEnd(5)}${(group.glbpLoadBalancing || "round-robin").padEnd(19)}${group.glbpWeight || 100}`;
        }),
      ];
      return [`Interface   Grp  Pri  State     Address         ${protocol} role`, ...groups.map(group => `${Object.keys(session.interfaces).find(name => `${name}:${protocol}:${group.group}` in (session.fhrpGroups || {})) || "unknown"}       ${String(group.group).padEnd(4)}${String(group.priority || 100).padEnd(5)}Active    ${(group.virtualIp || "unassigned").padEnd(16)}instructional active`)];
    }
    if (command === "show ppp multilink") {
      const links = Object.entries(session.interfaces).filter(([, state]) => state.commands.includes("encapsulation ppp"));
      return links.length ? ["Bundle name: not configured", ...links.map(([name, state]) => `${name}: LCP Open, authentication ${state.commands.includes("ppp authentication chap") ? "CHAP" : "none"}`)] : ["% No PPP links configured."];
    }
    if (command === "show ipv6 interface brief") {
      const entries = Object.entries(session.interfaces);
      return ["Interface              Status                 IPv6 address", ...(entries.length ? entries.map(([name, state]) => `${name.padEnd(22)} ${state.shutdown ? "administratively down" : "up/up"}              ${state.ipv6.join(", ") || "unassigned"}`) : ["% No IPv6 interfaces configured."])];
    }
    if (command === "show interfaces trunk") {
      const trunks = Object.entries(session.interfaces).filter(([, state]) => state.switchportMode === 'trunk');
      return trunks.length ? ["Port        Mode         Encapsulation  Status        Native vlan", ...trunks.map(([name, state]) => `${name}       on           802.1q         ${portEvidence(name).status === 'connected' ? 'trunking' : 'not-trunking'}  ${state.nativeVlan || 1}`), "", "Port        Vlans allowed on trunk", ...trunks.map(([name, state]) => `${name}       ${state.allowedVlans || "1-4094"}`)] : ["% No configured trunk interfaces."];
    }
    if (command === "show etherchannel" || command.startsWith("show etherchannel ")) {
      // EtherChannel is a switch feature in the capability matrix; the
      // display gate mirrors the Layer 3 show ip route gate.
      if (node.kind !== "switch") return [`% EtherChannel is not available on ${node.name}.`];
      const rest = command.slice("show etherchannel".length).trim();
      if (!rest) return ["% Incomplete command."];
      const members = Object.entries(session.interfaces).filter(([, state]) => state.channelGroup);
      const groups = Array.from(new Set(members.map(([, state]) => state.channelGroup))).filter((group): group is number => Boolean(group)).sort((a, b) => a - b);
      const formatEcPort = (port: string) => {
        const gigabit = port.match(/^g(\d+)\/(\d+)(?:\.(\d+))?$/i);
        if (gigabit) return `Gi${gigabit[1]}/${gigabit[2]}${gigabit[3] ? `.${gigabit[3]}` : ''}`;
        return port;
      };
      const normalizeEcPort = (port: string) => port.toLowerCase().replace(/\s+/g, '').replace(/^gigabitethernet/, 'g').replace(/^gig/, 'g');
      const peerFor = (port: string) => {
        const link = topology.links.find((item) => (item.from === node.id && item.fromPort === port) || (item.to === node.id && item.toPort === port));
        if (!link) return undefined;
        const remoteId = link.from === node.id ? link.to : link.from;
        return { remoteId, remotePort: link.from === node.id ? link.toPort : link.fromPort, remote: topology.nodes.find((item) => item.id === remoteId) };
      };
      // Per-member flag: only D (down), P (bundled), and s (suspended) are
      // emitted. The other flags in the legend are IOS's full set; this
      // simulator does not model hot-standby, minimum-links, or Auto LAG.
      const memberFlag = (port: string) => {
        if (!interfaceEvidence(session, port).up) return "D";
        const peer = peerFor(port);
        if (!peer) return "s";
        return channelForwarding(session, port, sessions[peer.remoteId], peer.remotePort).bundled ? "P" : "s";
      };
      const memberReason = (port: string) => {
        const peer = peerFor(port);
        if (!peer) return "No modeled peer member";
        return channelForwarding(session, port, sessions[peer.remoteId], peer.remotePort).reason;
      };
      const protocolForGroup = (group: number | undefined) => members.some(([, state]) => state.channelGroup === group && state.channelMode === "on") ? "-" : "LACP";
      const portChannelFlags = (group: number) => {
        const poState = session.interfaces[`port-channel ${group}`];
        const layer = poState?.ipv4.length ? "R" : "S";
        const inUse = members.some(([name, state]) => state.channelGroup === group && memberFlag(name) === "P");
        return `${layer}${inUse ? "U" : "N"}`;
      };
      const portsForGroup = (group: number) => members.filter(([, state]) => state.channelGroup === group).map(([name]) => `${formatEcPort(name)}(${memberFlag(name)})`).join(" ");
      const groupLine = (group: number) => `${String(group).padEnd(7)}${`Po${group}(${portChannelFlags(group)})`.padEnd(14)}${protocolForGroup(group).padEnd(12)}${portsForGroup(group)}`;
      const notConfigured = (group: number) => [`% Channel-group ${group} is not configured on ${node.name}.`];
      const summaryFor = (only?: number) => {
        const shown = only === undefined ? groups : groups.filter((group) => group === only);
        const aggregators = shown.filter((group) => members.some(([name, state]) => state.channelGroup === group && memberFlag(name) === "P")).length;
        return [
          "Flags:  D - down        P - bundled in port-channel",
          "        I - stand-alone s - suspended",
          "        H - Hot-standby (LACP only)",
          "        R - Layer3      S - Layer2",
          "        U - in use      N - not in use, no aggregation",
          "        f - failed to allocate aggregator",
          "",
          "        M - not in use, minimum links not met",
          "        m - not in use, port not aggregated due to minimum links not met",
          "        u - unsuitable for bundling",
          "        w - waiting to be aggregated",
          "        d - default port",
          "",
          "        A - formed by Auto LAG",
          "",
          `Number of channel-groups in use: ${shown.length}`,
          "Number of aggregators:".padEnd(34) + String(aggregators),
          "Group  Port-channel  Protocol    Ports",
          "------+-------------+-----------+-----------------------------------------------",
          ...shown.map(groupLine),
        ];
      };
      const detailFor = (only: number) => [
        `Channel-group ${only} detail`,
        `  Port-channel: Po${only}(${portChannelFlags(only)})`,
        `  Protocol: ${protocolForGroup(only)}`,
        "  Members:",
        ...members.filter(([, state]) => state.channelGroup === only).map(([name, state]) => `    ${formatEcPort(name)} (${memberFlag(name)}) - mode ${state.channelMode}, ${interfaceEvidence(session, name).up ? "up" : "down"}, ${memberReason(name)}`),
        "",
        "LACP timers, counters, and per-port neighbor detail are not modeled.",
      ];
      const portFor = (filter?: string, only?: number) => {
        let shown = only === undefined ? members : members.filter(([, state]) => state.channelGroup === only);
        if (filter) {
          if (!node.ports.some((port) => normalizeEcPort(port) === normalizeEcPort(filter))) return [`% Interface ${filter} does not exist on ${node.name}.`];
          shown = shown.filter(([name]) => normalizeEcPort(name) === normalizeEcPort(filter));
          if (!shown.length) return [`% ${filter} is not an EtherChannel member on ${node.name}.`];
        }
        if (!shown.length) return ["% No EtherChannels configured."];
        return shown.flatMap(([name, state]) => {
          const peer = peerFor(name);
          const flag = memberFlag(name);
          const stateText = !interfaceEvidence(session, name).up ? "Down" : flag === "P" ? "Up, bundled" : "Up, suspended";
          return [
            `Port: ${formatEcPort(name)}`,
            `  Channel-group: ${state.channelGroup}`,
            `  Mode: ${state.channelMode}`,
            `  Port state: ${stateText} (${flag})`,
            `  Protocol: ${protocolForGroup(state.channelGroup)}`,
            `  Peer: ${peer?.remote ? `${peer.remote.name} ${formatEcPort(peer.remotePort)}` : "No modeled peer"}`,
            `  Evidence: ${memberReason(name)}`,
          ];
        });
      };
      const portChannelFor = (only?: number) => {
        const shown = only === undefined ? groups : groups.filter((group) => group === only);
        if (!shown.length) return only === undefined ? ["% No EtherChannels configured."] : notConfigured(only);
        return shown.flatMap((group) => {
          const bundleState = members.some(([name, state]) => state.channelGroup === group && memberFlag(name) === "P") ? "BUNDLED" : members.some(([name, state]) => state.channelGroup === group && interfaceEvidence(session, name).up) ? "SUSPENDED" : "DOWN";
          return [
            `Port-channel: Po${group}(${portChannelFlags(group)})`,
            `  Channel-group: ${group}`,
            `  Protocol: ${protocolForGroup(group)}`,
            `  Members: ${portsForGroup(group)}`,
            `  Bundle state: ${bundleState}`,
          ];
        });
      };
      const protocolFor = (only?: number) => {
        const shown = only === undefined ? groups : groups.filter((group) => group === only);
        if (!shown.length) return only === undefined ? ["% No EtherChannels configured."] : notConfigured(only);
        return [
          "Channel-group  Protocol",
          ...shown.map((group) => `${String(group).padEnd(14)}${protocolForGroup(group)}`),
          "PAgP is not modeled; mode on groups show - (static).",
        ];
      };
      if (rest === "summary") return summaryFor();
      if (rest === "auto") return ["% No auto-formed EtherChannels.", "Auto LAG is not modeled in this simulator."];
      if (rest === "detail") {
        if (!groups.length) return ["% No EtherChannels configured."];
        return groups.flatMap((group) => detailFor(group));
      }
      if (rest === "load-balance") return [
        "EtherChannel Load-Balancing Configuration:",
        "        src-mac",
        "",
        "EtherChannel Load-Balancing Addresses Used:",
        "        not modeled",
        "",
        "Load-balance method is not configurable in this simulator; frame",
        "distribution is not simulated.",
      ];
      if (rest === "port-channel") return portChannelFor();
      if (rest.startsWith("port-channel ")) {
        const parsed = Number(rest.slice("port-channel ".length).trim());
        if (Number.isInteger(parsed)) return portChannelFor(parsed);
      }
      if (rest === "port") return portFor();
      if (rest.startsWith("port ")) return portFor(rest.slice("port ".length).trim());
      if (rest === "protocol") return protocolFor();
      const groupMatch = rest.match(/^(\d+)(?:\s+(detail|port|port-channel|protocol|summary))?$/);
      if (groupMatch) {
        const group = Number(groupMatch[1]);
        const sub = groupMatch[2];
        if (!groups.includes(group)) return notConfigured(group);
        if (!sub || sub === "summary") return summaryFor(group);
        if (sub === "detail") return detailFor(group);
        if (sub === "port") return portFor(undefined, group);
        if (sub === "port-channel") return portChannelFor(group);
        if (sub === "protocol") return protocolFor(group);
      }
      // Unknown form falls through to the generic no-modeled-output return.
    }
    if (command === 'show cdp neighbors' || command.startsWith('show cdp neighbors ')) {
      // CDP output is topology-backed, same derivation as the verification
      // panel's CDP tab: one entry per link to a CDP-capable neighbor.
      // CDP hellos, aging, and per-neighbor timers are not modeled, so
      // Holdtime is the 180-second CDP default for every entry and
      // capability/platform are modeled from kind/role, not live hellos.
      const cdpCapable = (device: { kind: string } | undefined) => ["router", "switch", "firewall", "asa", "modem", "access-point"].includes(device?.kind || '');
      if (!cdpCapable(node)) return [`% CDP is not available on ${node.name}.`];
      let rest = command.slice('show cdp neighbors'.length).trim();
      let detail = false;
      if (rest.endsWith(' detail')) { detail = true; rest = rest.slice(0, -' detail'.length).trim(); }
      else if (rest === 'detail') { detail = true; rest = ''; }
      const normalizeCdpPort = (port: string) => port.toLowerCase().replace(/\s+/g, '').replace(/^gigabitethernet/, 'g').replace(/^gig/, 'g');
      if (rest && !node.ports.some((port) => normalizeCdpPort(port) === normalizeCdpPort(rest))) return [`% Interface ${rest} does not exist on ${node.name}.`];
      const formatCdpPort = (port: string) => {
        const gigabit = port.match(/^g(\d+)\/(\d+)(?:\.(\d+))?$/i);
        if (gigabit) return `Gig ${gigabit[1]}/${gigabit[2]}${gigabit[3] ? `.${gigabit[3]}` : ''}`;
        const bundle = port.match(/^port-channel\s*(\d+)$/i);
        if (bundle) return `Port-channel${bundle[1]}`;
        return port;
      };
      const formatCdpPortLong = (port: string) => {
        const gigabit = port.match(/^g(\d+)\/(\d+)(?:\.(\d+))?$/i);
        if (gigabit) return `GigabitEthernet${gigabit[1]}/${gigabit[2]}${gigabit[3] ? `.${gigabit[3]}` : ''}`;
        const bundle = port.match(/^port-channel\s*(\d+)$/i);
        if (bundle) return `Port-channel${bundle[1]}`;
        return port;
      };
      const cdpCapability = (device: { kind: string; role?: string }) => {
        if (device.kind === 'router') return 'R';
        if (device.kind === 'switch') return /Layer 3|OSPF Speaker/i.test(device.role || '') ? 'R S' : 'S';
        if (device.kind === 'access-point') return 'T';
        return 'R';
      };
      const cdpCapabilityWords = (capability: string) => capability.split(' ').map((code) => code === 'R' ? 'Router' : code === 'S' ? 'Switch' : code === 'T' ? 'Trans Bridge' : code).join(' ');
      const cdpPlatform = (device: { kind: string; role?: string }) => {
        if (device.kind === 'router') return 'Cisco ISR';
        if (device.kind === 'switch') return /Layer 3|OSPF Speaker/i.test(device.role || '') ? 'Catalyst 3560-X' : 'Catalyst 2960';
        if (device.kind === 'firewall' || device.kind === 'asa') return 'Cisco ASA';
        if (device.kind === 'access-point') return 'Cisco AP';
        if (device.kind === 'modem') return 'Cisco Modem';
        return 'Cisco IOS';
      };
      const entries = topology.links.flatMap((link) => {
        if (link.from !== node.id && link.to !== node.id) return [];
        const remoteId = link.from === node.id ? link.to : link.from;
        const remote = topology.nodes.find((item) => item.id === remoteId);
        if (!remote || !cdpCapable(remote)) return [];
        const localPort = link.from === node.id ? link.fromPort : link.toPort;
        const remotePort = link.from === node.id ? link.toPort : link.fromPort;
        if (rest && normalizeCdpPort(localPort) !== normalizeCdpPort(rest)) return [];
        return [{ remote, localPort, remotePort }];
      });
      if (detail) {
        if (!entries.length) return ['% No CDP neighbors discovered.'];
        return entries.flatMap(({ remote, localPort, remotePort }) => {
          const remoteSession = sessions[remote.id];
          const entryAddress = remoteSession ? Object.values(remoteSession.interfaces).flatMap((state) => state.ipv4.map((address) => address.split(' ')[0]))[0] || 'not modeled' : 'not modeled';
          return [
            '-------------------------',
            `Device ID: ${remote.name}`,
            'Entry address(es):',
            `  IP address: ${entryAddress}`,
            `Platform: ${cdpPlatform(remote)},  Capabilities: ${cdpCapabilityWords(cdpCapability(remote))}`,
            `Interface: ${formatCdpPortLong(localPort)},  Port ID (outgoing port): ${formatCdpPortLong(remotePort)}`,
            'Holdtime : 180 sec',
            '',
            'Version :',
            'not modeled',
            '',
          ];
        });
      }
      return [
        'Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge',
        '                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone,',
        '                  D - Remote, C - CVTA, M - Two-port Mac Relay',
        '',
        `${'Device ID'.padEnd(17)}${'Local Intrfce'.padEnd(18)}${'Holdtme'.padEnd(11)}${'Capability'.padEnd(12)}${'Platform'.padEnd(16)}Port ID`,
        ...entries.map(({ remote, localPort, remotePort }) => `${remote.name.padEnd(17)}${formatCdpPort(localPort).padEnd(18)}${'180'.padEnd(11)}${cdpCapability(remote).padEnd(12)}${cdpPlatform(remote).padEnd(16)}${formatCdpPort(remotePort)}`),
        `Total cdp entries displayed : ${entries.length}`,
      ];
    }
    return [`% No modeled operational output for ${command} on ${node.name}.`];
  }
  if (command.startsWith("nslookup ")) return ["Server:  Unresolved until a modeled DNS server is reached.", `% DNS lookup requested for ${command.slice("nslookup ".length)}.`];
  if (command.startsWith('ping ') || command.startsWith('traceroute ')) {
    const result = tracePacket(node.id, command.split(' ')[1], topology, { ...sessions, [node.id]: session });
    return [...result.hops, `${result.passed ? 'MODELED CHECK' : '% BLOCKED'}: ${result.summary}`];
  }
  if (command.startsWith("copy ") || command === "write memory") return ['Configuration saved to the modeled startup configuration.'];
  return [`Applied in ${node.name}'s modeled configuration: ${command}.`];
}


export type ProbeResolution = { path: string[]; destination: SandboxNode } | { error: string };

export function ipv4Routes(session: Session) {
  // NOTE: ipv4Routes is the forwarding calculation, not the `show ip route`
  // display. Hosts and Layer 2 switches still need their local connected
  // routes (and gateway) to originate traffic, even though they never
  // transit traffic for others — transit through an L2 switch is modeled
  // by the VLAN path, not by this table. The display gate lives in
  // outputFor, which refuses `show ip route` on non-routed devices.
  const routes = session.routingTable.filter(route => {
    if (route.protocol === 'connected') return false;
    // Never surface an OSPF entry the simulator has not actually learned:
    // without a local OSPF process there is no adjacency to learn from.
    if (route.protocol === 'ospf' && !Object.keys(session.ospfProcesses || {}).length) return false;
    return true;
  });
  for (const [port, state] of Object.entries(session.interfaces)) {
    if (!interfaceEvidence(session, port).up) continue;
    for (const address of state.ipv4) {
      const [, mask] = address.split(' ');
      const subnet = interfaceSubnet(address);
      if (subnet !== null) routes.push({ prefix: `${numberToIp(subnet)}/${prefixLength(mask)}`, interface: port, protocol: 'connected' });
    }
  }
  const configured = session.settings?.['config:global'];
  const staticCommands = configured ? Object.entries(configured).filter(([key]) => key.startsWith('ip route ')).map(([key, value]) => `${key} ${value}`) : session.runningConfig;
  const pending = [];
  for (const command of staticCommands) {
    const match = command.toLowerCase().match(/^ip route ([0-9.]+) ([0-9.]+) ([0-9.]+)$/);
    if (match) pending.push({ prefix: `${match[1]}/${prefixLength(match[2])}`, nextHop: match[3] });
  }
  // IOS installs a next-hop static route only after recursive resolution finds an active egress.
  for (let pass = 0; pass < pending.length; pass++) {
    let installed = false;
    for (let index = pending.length - 1; index >= 0; index--) {
      const candidate = pending[index];
      const nextHop = ipToNumber(candidate.nextHop);
      if (nextHop === null) continue;
      const resolver = routes.filter(route => {
        const [network, bits] = route.prefix.split('/');
        const networkNumber = ipToNumber(network);
        const mask = Number(bits) === 0 ? 0 : (0xffffffff << (32 - Number(bits))) >>> 0;
        return networkNumber !== null && ((nextHop & mask) >>> 0) === ((networkNumber & mask) >>> 0) && !!route.interface;
      }).sort((a, b) => Number(b.prefix.split('/')[1]) - Number(a.prefix.split('/')[1]))[0];
      if (!resolver) continue;
      routes.push({ ...candidate, interface: resolver.interface, protocol: 'static' });
      pending.splice(index, 1);
      installed = true;
    }
    if (!installed) break;
  }
  return routes;
}

export function resolveProbePath(sourceId: string, destinationIp: string, topology: Topology, sessions: Record<string, Session>): ProbeResolution {
  const destination = topology.nodes.find(node => Object.values(sessions[node.id]?.interfaces || {}).some(state => state.ipv4.some(address => address.split(' ')[0] === destinationIp)));
  if (!destination) return { error: `%DESTINATION_UNRESOLVED: ${destinationIp} is not assigned to a modeled host.` };
  const targetNumber = ipToNumber(destinationIp);
  if (targetNumber === null) return { error: '%NO_ROUTE: Invalid IPv4 destination.' };
  const path: string[] = [];
  const seen = new Set<string>();
  let current = sourceId;
  while (current !== destination.id) {
    if (seen.has(current)) return { error: `%ROUTING_LOOP: Revisited ${current}.` };
    seen.add(current);
    const session = sessions[current];
    const node = topology.nodes.find(node => node.id === current);
    if (!session || !node) return { error: '%NO_ROUTE: Forwarding device is missing.' };
    const routes = ipv4Routes(session).filter(route => {
      const [network, bits] = route.prefix.split('/');
      const mask = Number(bits) === 0 ? 0 : (0xffffffff << (32 - Number(bits))) >>> 0;
      const networkNumber = ipToNumber(network);
      return networkNumber !== null && (targetNumber & mask) === (networkNumber & mask);
    }).sort((a, b) => Number(b.prefix.split('/')[1]) - Number(a.prefix.split('/')[1]) || ({ connected: 0, static: 1, ospf: 110 }[a.protocol] - { connected: 0, static: 1, ospf: 110 }[b.protocol]));
    const route = routes[0];
    const host = ['pc', 'server', 'printer', 'iot'].includes(node.kind);
    const gateway = session.dhcpClient?.gateway || [...session.runningConfig].reverse().find(command => /^ip default-gateway /i.test(command))?.split(' ')[2];
    const nextIp = route?.nextHop || (route?.protocol === 'connected' ? destinationIp : host ? gateway : undefined);
    if (!nextIp) return { error: `${node.name}: no route matches ${destinationIp}.` };
    const nextNode = topology.nodes.find(candidate => Object.entries(sessions[candidate.id]?.interfaces || {}).some(([port, state]) => interfaceEvidence(sessions[candidate.id], port).up && state.ipv4.some(address => address.split(' ')[0] === nextIp)));
    if (!nextNode || nextNode.id === current) return { error: `${node.name}: route next hop ${nextIp} is not a reachable modeled neighbor.` };
    const egress = route?.interface || Object.entries(session.interfaces).find(([port, state]) => interfaceEvidence(session, port).up && state.ipv4.some(address => {
      const [, mask] = address.split(' '); const maskNumber = ipToNumber(mask), ip = ipToNumber(nextIp);
      return maskNumber !== null && ip !== null && ((ip & maskNumber) >>> 0) === interfaceSubnet(address);
    }))?.[0];
    if (!egress) return { error: `${node.name}: next hop ${nextIp} is not on an enabled connected subnet.` };
    const vlan = vlanFromInterface(egress, session.interfaces[egress]) || clientVlan(current, topology, sessions);
    // An SVI reaches its VLAN through physical member ports, not a virtual cable.
    const sourcePort = /^vlan \d+$/.test(egress) ? undefined : egress.split('.')[0];
    const segment = resolveVlanPath(current, nextNode.id, vlan, topology, sessions, true, sourcePort);
    if ('error' in segment) return { error: `${node.name}: next hop ${nextIp} is blocked on ${egress}. ${segment.error}` };
    path.push(...segment.links.map(link => link.id));
    current = nextNode.id;
  }
  return { path, destination };
}


export type DhcpResolution = { client: DhcpClientState; clientSession: Session; serverId: string; serverSession: Session; learnedSessions: Record<string, Session>; output: string[] } | { error: string };
export type DnsResolution = { name: string; address: string; serverId: string } | { error: string };

export function ipToNumber(value: string): number | null {
  const octets = value.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
  return (((octets[0] * 256 + octets[1]) * 256 + octets[2]) * 256 + octets[3]) >>> 0;
}

export function numberToIp(value: number): string {
  return [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join(".");
}

export function deterministicMac(nodeId: string): string {
  let hash = 0;
  for (const character of nodeId) hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
  return `02:ce:${(hash >>> 16 & 255).toString(16).padStart(2, "0")}:${(hash >>> 8 & 255).toString(16).padStart(2, "0")}:${(hash >>> 4 & 255).toString(16).padStart(2, "0")}:${(hash & 255).toString(16).padStart(2, "0")}`;
}

export type VlanPath = { nodeIds: string[]; links: SandboxLink[] } | { error: string };
// MAC aging uses a lengthy timer on purpose: a learner pausing mid-lab must
// not come back to an emptied MAC table. Real IOS defaults to 300 seconds;
// the emulator keeps entries for an hour of wall-clock inactivity.
const MAC_AGING_MS = 60 * 60 * 1000;

export function ageMacTables(sessions: Record<string, Session>, now = Date.now()): Record<string, Session> {
  return Object.fromEntries(Object.entries(sessions).map(([nodeId, session]) => [nodeId, {
    ...session,
    macTable: session.macTable.filter((entry) => entry.lastSeen === undefined || now - entry.lastSeen < MAC_AGING_MS),
  }]));
}

export function removeMacEntriesForPort(sessions: Record<string, Session>, nodeId: string, port: string): Record<string, Session> {
  const session = sessions[nodeId];
  if (!session) return sessions;
  return { ...sessions, [nodeId]: { ...session, macTable: session.macTable.filter((entry) => entry.port !== port) } };
}

export function removeMacEntriesForLink(sessions: Record<string, Session>, topology: Topology, link: SandboxLink): Record<string, Session> {
  let next = removeMacEntriesForPort(sessions, link.from, link.fromPort);
  next = removeMacEntriesForPort(next, link.to, link.toPort);
  const from = topology.nodes.find((node) => node.id === link.from);
  const to = topology.nodes.find((node) => node.id === link.to);
  if (from?.kind === "switch") next = removeMacEntriesForPort(next, from.id, link.fromPort);
  if (to?.kind === "switch") next = removeMacEntriesForPort(next, to.id, link.toPort);
  return next;
}

export function vlanFromInterface(name: string, state?: Session["interfaces"][string]): number | null {
  if (/^vlan \d+$/.test(name)) return Number(name.slice(5));
  const encapsulation = state?.commands.find((command) => /^encapsulation dot1q \d+( native)?$/i.test(command));
  const match = encapsulation?.match(/encapsulation dot1q (\d+)/i);
  return match ? Number(match[1]) : name.includes(".") ? Number(name.split(".").pop()) : null;
}

export function portAllowsVlan(node: SandboxNode, port: string, vlan: number, sessions: Record<string, Session>): boolean {
  const session = sessions[node.id];
  let state = session?.interfaces[port];
  if (!interfaceEvidence(session, port).up) return false;
  if (node.kind === "switch") {
    if (vlan !== 1 && !session.vlans[vlan]) return false;
    if (state.channelGroup) state = session.interfaces[`port-channel ${state.channelGroup}`] || state;
    if (state?.switchportMode === "trunk") {
      return vlanAllowed(state.allowedVlans, vlan);
    }
    return (state?.accessVlan || 1) === vlan;
  }
  if (node.kind === "router") {
    if (!port.includes('.') && state?.ipv4.length && !state.encapsulation) return true;
    if (vlanFromInterface(port, state) === vlan) return true;
    return Object.entries(sessions[node.id]?.interfaces || {}).some(([name, candidate]) => {
      if (!name.startsWith(`${port}.`) || vlanFromInterface(name, candidate) !== vlan || candidate.shutdown || candidate.ipv4.length === 0) return false;
      const parent = sessions[node.id]?.interfaces[port];
      return !parent || !parent.shutdown;
    });
  }
  return true;
}

export function clientVlan(clientId: string, topology: Topology, sessions: Record<string, Session>): number {
  const sourceNode = topology.nodes.find((node) => node.id === clientId);
  if (sourceNode?.kind === "switch") {
    const svi = Object.entries(sessions[clientId]?.interfaces || {}).find(([name, state]) => /^vlan \d+$/.test(name) && !state.shutdown && state.ipv4.length > 0);
    if (svi) return Number(svi[0].slice("vlan ".length));
  }
  const accessLink = topology.links.find((link) => link.from === clientId || link.to === clientId);
  if (!accessLink) return 1;
  const switchId = topology.nodes.find((node) => node.id === (accessLink.from === clientId ? accessLink.to : accessLink.from) && node.kind === "switch")?.id;
  if (!switchId) {
    const router = topology.nodes.find((node) => node.id === (accessLink.from === clientId ? accessLink.to : accessLink.from) && node.kind === "router");
    if (!router) return 1;
    const routerPort = accessLink.from === router.id ? accessLink.fromPort : accessLink.toPort;
    const subinterface = Object.entries(sessions[router.id]?.interfaces || {}).find(([name, state]) => name.startsWith(`${routerPort}.`) && vlanFromInterface(name, state) !== null);
    return subinterface ? vlanFromInterface(subinterface[0], subinterface[1]) || 1 : 1;
  }
  const switchPort = accessLink.from === switchId ? accessLink.fromPort : accessLink.toPort;
  return sessions[switchId]?.interfaces[switchPort]?.accessVlan || 1;
}

export function resolveVlanPath(sourceId: string, destinationId: string, vlan: number, topology: Topology, sessions: Record<string, Session>, layer2Only = false, sourcePort?: string): VlanPath {
  const nodeMap = new Map(topology.nodes.map((node) => [node.id, node]));
  const queue = [sourceId];
  const previous = new Map<string, { nodeId: string; link: SandboxLink } | null>([[sourceId, null]]);
  while (queue.length) {
    const current = queue.shift()!;
    if (layer2Only && current !== sourceId && current !== destinationId) {
      const node = nodeMap.get(current);
      if (!node || !['switch', 'access-point'].includes(node.kind) || node.role.includes('Layer 3')) continue;
    }
    for (const link of topology.links.filter((item) => item.from === current || item.to === current)) {
      if (current === sourceId && sourcePort && (link.from === current ? link.fromPort : link.toPort) !== sourcePort) continue;
      const from = nodeMap.get(link.from);
      const to = nodeMap.get(link.to);
      const channel = from && to ? channelForwarding(sessions[from.id], link.fromPort, sessions[to.id], link.toPort) : undefined;
      if (!from || !to || channel?.configured && !channel.bundled || !portAllowsVlan(from, link.fromPort, vlan, sessions) || !portAllowsVlan(to, link.toPort, vlan, sessions)) continue;
      const next = link.from === current ? link.to : link.from;
      if (previous.has(next)) continue;
      previous.set(next, { nodeId: current, link });
      queue.push(next);
    }
  }
  if (!previous.has(destinationId)) return { error: `%VLAN_NOT_ALLOWED: DHCP broadcast for VLAN ${vlan} cannot reach the modeled server.` };
  const nodeIds: string[] = [destinationId];
  const links: SandboxLink[] = [];
  let cursor = destinationId;
  while (cursor !== sourceId) {
    const step = previous.get(cursor);
    if (!step) break;
    links.unshift(step.link);
    cursor = step.nodeId;
    nodeIds.unshift(cursor);
  }
  return { nodeIds, links };
}

export function resolveDhcpLease(clientId: string, interfaceName: string, topology: Topology, sessions: Record<string, Session>, clientSession: Session): DhcpResolution {
  const vlan = clientVlan(clientId, topology, sessions);
  const server = topology.nodes.find((node) => node.id !== clientId && Object.keys(sessions[node.id]?.dhcpPools || {}).length > 0);
  if (!server) return { error: "%DHCP: No modeled DHCP server is present in the topology." };
  const serverSession = sessions[server.id];
  const pool = Object.values(serverSession.dhcpPools || {}).find(candidate => candidate.network && candidate.mask && Object.entries(serverSession.interfaces).some(([port, state]) => {
    if (state.shutdown || !state.ipv4.length) return false;
    const address = state.ipv4[0].split(' ')[0];
    const subnetMatches = ((ipToNumber(address)! & ipToNumber(candidate.mask!)!) >>> 0) === ((ipToNumber(candidate.network!)! & ipToNumber(candidate.mask!)!) >>> 0);
    return subnetMatches && (vlanFromInterface(port, state) === vlan || !port.includes('.') && clientVlan(server.id, topology, sessions) === vlan);
  }));
  if (!pool || !pool.network || !pool.mask) return { error: "%DHCP: The reachable server has no complete DHCP pool." };
  const path = resolveVlanPath(clientId, server.id, vlan, topology, sessions);
  if ("error" in path) return path;
  const network = ipToNumber(pool.network);
  const mask = ipToNumber(pool.mask);
  if (network === null || mask === null) return { error: "%DHCP: The configured pool has an invalid network or mask." };
  const first = (network & mask) >>> 0;
  const last = (first | (~mask >>> 0)) >>> 0;
  const excluded = new Set((serverSession.dhcpExcludedAddresses || []).flatMap((entry) => {
    const [start, end] = entry.split(" ");
    const low = ipToNumber(start);
    const high = ipToNumber(end || start);
    return low === null || high === null ? [] : Array.from({ length: Math.max(0, high - low + 1) }, (_, index) => low + index);
  }));
  const activeLeases = (serverSession.dhcpLeases || []).filter(lease => lease.state === 'active' && Date.parse(lease.leaseEnd) > Date.now() && lease.clientId !== clientId);
  const existing = new Set(activeLeases.map((lease) => lease.ip));
  let address: string | null = null;
  for (let candidate = first + 1; candidate < last; candidate += 1) {
    const candidateIp = numberToIp(candidate);
    if (!excluded.has(candidate) && !existing.has(candidateIp) && candidateIp !== pool.defaultRouter) { address = candidateIp; break; }
  }
  if (!address) return { error: `%DHCP: No available addresses remain in pool ${pool.name}.` };

  const now = new Date();
  const leaseEnd = new Date(now.getTime() + 86400000);
  const mac = deterministicMac(clientId);
  const lease: DhcpLease = { mac, ip: address, clientId, state: "active", pool: pool.name, leaseStart: now.toISOString(), leaseEnd: leaseEnd.toISOString() };
  const client: DhcpClientState = { mac, interface: interfaceName, state: "BOUND", ip: address, mask: pool.mask, gateway: pool.defaultRouter, dns: pool.dnsServer, poolName: pool.name, leaseStart: lease.leaseStart, leaseEnd: lease.leaseEnd };
  const updatedClientSession: Session = { ...clientSession, dhcpClient: client, interfaces: { ...clientSession.interfaces, [interfaceName]: { ...clientSession.interfaces[interfaceName], ipv4: [`${address} ${pool.mask}`], dhcpClient: true } } };
  const gatewayInterface = Object.entries(serverSession.interfaces).find(([, state]) => state.ipv4.some((ip) => ip.startsWith(`${pool.defaultRouter} `)) || state.ipv4.some((ip) => ip === pool.defaultRouter));
  const gatewayMac = deterministicMac(server.id);
  if (pool.defaultRouter) updatedClientSession.arpTable = [...updatedClientSession.arpTable, { ip: pool.defaultRouter, mac: gatewayMac, interface: interfaceName, age: 0 }];
  const updatedServerSession: Session = { ...serverSession, dhcpLeases: [...activeLeases, lease], arpTable: pool.defaultRouter ? [...serverSession.arpTable.filter(entry => entry.mac !== mac), { ip: address, mac, interface: gatewayInterface?.[0] || "vlan1", age: 0 }] : serverSession.arpTable };
  const learnedAt = Date.now();
  const learnedSessions: Record<string, Session> = {};
  for (let index = 1; index < path.nodeIds.length; index += 1) {
    const switchNode = topology.nodes.find((node) => node.id === path.nodeIds[index] && node.kind === "switch");
    if (!switchNode) continue;
    const link = path.links[index - 1];
    const ingressPort = link.from === switchNode.id ? link.fromPort : link.toPort;
    const switchSession = sessions[switchNode.id];
    const existing = switchSession.macTable.filter((entry) => entry.mac !== mac);
    learnedSessions[switchNode.id] = { ...switchSession, macTable: [...existing, { mac, port: ingressPort, vlan, type: "dynamic", lastSeen: learnedAt }] };
  }
  return { client, clientSession: updatedClientSession, serverId: server.id, serverSession: updatedServerSession, learnedSessions, output: ["DHCPDISCOVER: Broadcasting on the modeled VLAN.", `VLAN ${vlan}: DHCP broadcast forwarded across the allowed modeled path.`, `DHCPOFFER: ${server.name} offered ${address} from pool ${pool.name}.`, `DHCPREQUEST: Requesting ${address} from ${server.name}.`, `DHCPACK: ${address} / ${pool.mask}${pool.defaultRouter ? `, gateway ${pool.defaultRouter}` : ""}${pool.dnsServer ? `, DNS ${pool.dnsServer}` : ""}.`, ...(pool.defaultRouter ? ["ARP: Client learned the default gateway mapping."] : []), ...(Object.keys(learnedSessions).length ? ["MAC: Switch learned the client source address on the ingress port."] : [])] };
}

export function resolveDnsName(sourceId: string, name: string, topology: Topology, sessions: Record<string, Session>): DnsResolution {
  const normalized = name.toLowerCase();
  const server = topology.nodes.find((node) => sessions[node.id]?.dnsServerEnabled && sessions[node.id]?.dnsRecords[normalized]);
  if (!server) return { error: `%DNS: No modeled DNS server has a record for ${name}.` };
  const connected = new Set<string>([sourceId]);
  const queue = [sourceId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const link of topology.links.filter((item) => item.from === current || item.to === current)) {
      const next = link.from === current ? link.to : link.from;
      if (!connected.has(next)) { connected.add(next); queue.push(next); }
    }
  }
  if (!connected.has(server.id)) return { error: `%DNS: DNS server ${server.name} is unreachable in the modeled topology.` };
  return { name, address: sessions[server.id].dnsRecords[normalized], serverId: server.id };
}

export function negotiatePoe(switchNode: SandboxNode, port: string, topology: Topology, session: Session): { session: Session; output: string[] } {
  const link = topology.links.find((candidate) => (candidate.from === switchNode.id && candidate.fromPort === port) || (candidate.to === switchNode.id && candidate.toPort === port));
  const peerId = link ? (link.from === switchNode.id ? link.to : link.from) : null;
  const peer = topology.nodes.find((node) => node.id === peerId);
  const current = session.interfaces[port];
  if (!current) return { session, output: ["% PoE: Interface state is not initialized."] };
  const allocated = Object.values(session.interfaces).reduce((total, state) => total + (state.poe.state === "delivering" ? state.poe.wattage : 0), 0);
  const poe = peer?.kind !== "access-point"
    ? { ...current.poe, state: "searching" as const, wattage: 0 }
    : allocated + 30 > 370
      ? { ...current.poe, state: "fault" as const, class: 4 as const, wattage: 0 }
      : { ...current.poe, state: "delivering" as const, class: 4 as const, wattage: 30 };
  const next: Session = { ...session, interfaces: { ...session.interfaces, [port]: { ...current, poe } } };
  return { session: next, output: poe.state === "delivering" ? [`PoE: ${port} negotiated class ${poe.class}, delivering ${poe.wattage}W to ${peer?.name}.`] : poe.state === "fault" ? [`PoE: ${port} entered fault; the modeled switch budget is exhausted.`] : [`PoE: ${port} is searching; no powered access point is connected.`] };
}
