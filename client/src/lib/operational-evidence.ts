import type { LabConfig } from '../labs/labDefinitions';
import { ensureOspfOperational, type OspfProcess, type Session } from './ios-engine';
import { namedSessions, type Sessions } from './learning-engine';

export function interfaceEvidence(session: Session | undefined, port: string) {
  const state = session?.interfaces[port];
  const parent = port.includes('.') ? session?.interfaces[port.split('.')[0]] : undefined;
  const up = !!state && !state.shutdown && state.status !== 'err-disabled' && (!port.includes('.') || !!parent && !parent.shutdown);
  const method = state?.dhcpClient ? 'DHCP' : state?.ipv4.length ? 'manual' : 'unset';
  return { port, address: state?.ipv4.join(', ') || 'unassigned', valid: 'YES', method, admin: state?.shutdown === false ? 'up' : 'administratively down', protocol: up ? 'up' : 'down', up };
}
const ipNumber = (ip: string) => ip.split('.').reduce((total, part) => (total << 8) | Number(part), 0) >>> 0;
export function leaseState(lease: { state: string; leaseEnd?: string }, now = Date.now()) {
  return lease.leaseEnd && Date.parse(lease.leaseEnd) <= now ? 'EXPIRED' : lease.state;
}
export function channelForwarding(left: Session | undefined, leftPort: string, right: Session | undefined, rightPort: string) {
  const leftMember = left?.interfaces[leftPort], rightMember = right?.interfaces[rightPort];
  const configured = !!leftMember?.channelGroup || !!rightMember?.channelGroup;
  if (!configured) return { configured, bundled: true, protocol: 'none', reason: 'Not an EtherChannel member' };
  const up = interfaceEvidence(left, leftPort).up && interfaceEvidence(right, rightPort).up;
  const bothMembers = !!leftMember?.channelGroup && !!rightMember?.channelGroup;
  const staticBundle = leftMember?.channelMode === 'on' && rightMember?.channelMode === 'on';
  const lacpBundle = leftMember?.channelMode === 'active' && ['active', 'passive'].includes(rightMember?.channelMode || '') || rightMember?.channelMode === 'active' && leftMember?.channelMode === 'passive';
  const protocol = staticBundle ? 'Static' : 'LACP';
  const bundled = up && bothMembers && (staticBundle || lacpBundle);
  const reason = !up ? 'Member interface down' : !bothMembers ? 'Both ends must join a channel group' : bundled ? protocol === 'LACP' ? 'Active/passive negotiation is compatible' : 'Both static members are configured mode on' : protocol === 'LACP' ? 'Both ends need at least one active LACP member' : 'Static mode must be configured on both ends';
  return { configured, bundled, protocol, reason };
}
export function participation(session: Session, port: string, addressFamily?: 'ipv4' | 'ipv6') {
  const state = session.interfaces[port];
  for (const process of Object.values(session.ospfProcesses)) {
    if (addressFamily && (process.addressFamily || 'ipv4') !== addressFamily) continue;
    const ipv6Area = process.ipv6Interfaces?.[port];
    if (ipv6Area !== undefined && state?.ipv6.length) return { process, area: ipv6Area, address: state.ipv6.find(address => !address.toLowerCase().startsWith('fe80:')) || state.ipv6[0], family: 'ipv6' as const };
    const address = state?.ipv4[0]?.split(' ')[0];
    if (!address) continue;
    for (const network of process.networks) {
      const mask = ~ipNumber(network.wildcard);
      if ((ipNumber(address) & mask) === (ipNumber(network.network) & mask)) return { process, area: network.area, address, family: 'ipv4' as const };
    }
  }
}

function ipv6Words(value: string) {
  const address = value.split('/')[0].toLowerCase();
  const [left, right = ''] = address.split('::');
  const before = left ? left.split(':').filter(Boolean) : [];
  const after = right ? right.split(':').filter(Boolean) : [];
  const missing = Math.max(0, 8 - before.length - after.length);
  return [...before, ...Array.from({ length: missing }, () => '0'), ...after].map(word => parseInt(word || '0', 16));
}
function ipv6PrefixKey(value: string) {
  const prefix = Number(value.split('/')[1] || 128);
  let remaining = prefix;
  const words = ipv6Words(value).map(word => {
    const bits = Math.max(0, Math.min(16, remaining));
    remaining -= bits;
    return bits === 0 ? 0 : word & (0xffff << (16 - bits));
  });
  return `${words.map(word => word.toString(16)).join(':')}/${prefix}`;
}
function ospfSameSubnet(left?: string, right?: string) {
  if (!left || !right) return false;
  if (left.includes(':') || right.includes(':')) return left.includes(':') && right.includes(':') && ipv6PrefixKey(left) === ipv6PrefixKey(right);
  const aa = left.split(' '), bb = right.split(' ');
  if (!aa[1] || !bb[1]) return false;
  return aa[1] === bb[1] && (ipNumber(aa[0]) & ipNumber(aa[1])) === (ipNumber(bb[0]) & ipNumber(bb[1]));
}
export function vlanAllowed(list: string | undefined, vlan: number) {
  if (!list || list === 'all') return true;
  if (list === 'none') return false;
  return list.split(',').some(item => { const [start, end] = item.trim().split('-').map(Number); return vlan >= start && vlan <= (end ?? start); });
}
export function interfaceVlan(session: Session, port: string) {
  const svi = port.match(/^vlan\s*(\d+)$/i);
  return svi ? Number(svi[1]) : session.interfaces[port]?.vlanId;
}

// Physical carrier state and successful aggregation are separate evidence.
export function interfaceRelationships(session: Session, port: string, peers: ReturnType<typeof protocolEvidence>) {
  const state = session.interfaces[port];
  const evidence = interfaceEvidence(session, port);
  const aggregate = port.match(/^port-channel\s*(\d+)$/i);
  const members = aggregate ? Object.entries(session.interfaces).filter(([, member]) => member.channelGroup === Number(aggregate[1])).map(([name]) => name) : state?.channelGroup ? [port] : [];
  const memberPeers = peers.filter(row => ['LACP', 'Static'].includes(row.protocol) && members.some(name => row.link.startsWith(`${session.hostname} ${name} <-> `) || row.link.endsWith(` <-> ${session.hostname} ${name}`)));
  const bundled = memberPeers.some(row => row.state === 'BUNDLED');
  const aggregation = aggregate || state?.channelGroup ? bundled ? 'BUNDLED' : memberPeers.length ? 'SUSPENDED' : members.length ? 'NO PEER' : 'NO MEMBERS' : '-';
  const effective = state?.channelGroup ? session.interfaces[`port-channel ${state.channelGroup}`] || state : state;
  const trunk = effective?.switchportMode === 'trunk';
  const vlan = interfaceVlan(session, port);
  const svi = /^vlan\s*\d+$/i.test(port);
  const role = svi ? /management/i.test(session.vlans[String(vlan)] || '') ? 'management SVI' : 'SVI' : trunk ? 'trunk' : effective?.switchportMode === 'access' ? 'access' : vlan !== undefined ? 'routed subinterface' : state?.ipv4.length || state?.ipv6.length ? 'routed' : 'unused / unconfigured';
  return {
    ...evidence,
    protocol: aggregate ? evidence.up && bundled ? 'up' : 'down' : evidence.protocol,
    parent: state?.channelGroup ? `port-channel ${state.channelGroup}` : port.includes('.') ? port.split('.')[0] : '-',
    vlan: vlan ?? (role === 'access' ? effective?.accessVlan ?? 1 : '-'),
    nativeVlan: trunk ? effective?.nativeVlan ?? 1 : '-',
    allowedVlans: trunk ? effective?.allowedVlans || 'all' : '-',
    encapsulation: trunk ? '802.1Q' : state?.encapsulation === 'dot1q' ? `802.1Q ${state.vlanId}` : '-',
    role,
    description: [...(state?.commands || [])].reverse().find(command => command.toLowerCase().startsWith('description '))?.slice('description '.length) || '-',
    aggregation,
  };
}
export function protocolEvidence(lab: LabConfig, sessions: Sessions) {
  const named = namedSessions(lab, sessions);
  const rows: { protocol: string; link: string; state: string; reason: string }[] = [];
  for (const link of ospfTransitLinks(lab, sessions)) {
    const a = lab.topology.devices.find(d => d.id === link.from), b = lab.topology.devices.find(d => d.id === link.to);
    if (!a || !b) continue;
    const sa = named[a.name], sb = named[b.name];
    if (!sa || !sb) continue;
    const label = `${a.name} ${link.fromPort} <-> ${b.name} ${link.toPort}`;
    const up = interfaceEvidence(sa, link.fromPort).up && interfaceEvidence(sb, link.toPort).up;
    const pa = participation(sa, link.fromPort), pb = participation(sb, link.toPort);
    const layer2Peer = (device: typeof a, participant: typeof pa) => device.kind === 'switch' && !device.role.includes('Layer 3') && !participant;
    if ((pa || pb) && !layer2Peer(a, pa) && !layer2Peer(b, pb)) {
      const passive = pa?.process.passiveInterfaces?.some(port => port === 'default' || port === link.fromPort) || pb?.process.passiveInterfaces?.some(port => port === 'default' || port === link.toPort);
      const duplicate = pa?.process.routerId && pa.process.routerId === pb?.process.routerId;
      const leftState = sa.interfaces[link.fromPort], rightState = sb.interfaces[link.toPort];
      const leftAddress = pa?.family === 'ipv6' ? leftState?.ipv6.find(address => !address.toLowerCase().startsWith('fe80:')) || leftState?.ipv6[0] : leftState?.ipv4[0];
      const rightAddress = pb?.family === 'ipv6' ? rightState?.ipv6.find(address => !address.toLowerCase().startsWith('fe80:')) || rightState?.ipv6[0] : rightState?.ipv4[0];
      const subnet = pa?.family === pb?.family && ospfSameSubnet(leftAddress, rightAddress);
      const networkMismatch = (sa.interfaces[link.fromPort]?.ospfNetworkType || 'broadcast') !== (sb.interfaces[link.toPort]?.ospfNetworkType || 'broadcast');
      const areaProfile = (participant: typeof pa) => participant?.process.areas?.[String(participant.area)] || { type: 'normal', authentication: 'none' };
      const leftArea = areaProfile(pa), rightArea = areaProfile(pb);
      const defaultHello = (state: Session['interfaces'][string]) => state?.ospfNetworkType === 'non-broadcast' ? 30 : 10;
      const defaultDead = (state: Session['interfaces'][string]) => state?.ospfNetworkType === 'non-broadcast' ? 120 : 40;
      const timerMismatch = (leftState?.ospfHelloInterval ?? defaultHello(leftState)) !== (rightState?.ospfHelloInterval ?? defaultHello(rightState)) || (leftState?.ospfDeadInterval ?? defaultDead(leftState)) !== (rightState?.ospfDeadInterval ?? defaultDead(rightState));
      const leftAuth = leftState?.ospfAuthentication || leftArea.authentication;
      const rightAuth = rightState?.ospfAuthentication || rightArea.authentication;
      const reason = !up ? 'Interface down' : !pa || !pb ? 'Transit interface missing from OSPF' : pa.area !== pb.area ? 'Area mismatch' : !subnet ? 'Subnet mismatch' : passive ? 'Passive interface suppresses Hellos' : duplicate ? 'Duplicate router ID' : networkMismatch ? 'Network type mismatch' : timerMismatch ? 'Hello/dead timer mismatch' : leftArea.type !== rightArea.type ? 'Area type option mismatch' : leftAuth !== rightAuth ? 'Authentication type mismatch' : 'Hello/dead timers compatible; modeled database synchronization complete';
      rows.push({ protocol: 'OSPF', link: label, state: reason.startsWith('Hello/dead timers compatible') ? 'FULL' : 'DOWN', reason });
    }
    const channel = channelForwarding(sa, link.fromPort, sb, link.toPort);
    if (channel.configured) {
      rows.push({ protocol: channel.protocol, link: label, state: channel.bundled ? 'BUNDLED' : 'SUSPENDED', reason: channel.reason });
    }
  }
  for (const [name, session] of Object.entries(named)) if (session) {
    const client = session.dhcpClient;
    if (client) rows.push({ protocol: 'DHCP', link: `${name} ${client.interface}`, state: leaseState(client), reason: client.ip ? `${client.ip}; lease ends ${client.leaseEnd || 'not modeled'}` : 'Waiting for a reachable server and matching pool' });
  }
  return rows;
}

export function electionEvidence(lab: LabConfig, sessions: Sessions) {
  const named = namedSessions(lab, sessions);
  const candidates = lab.topology.devices.flatMap(device => {
    const session = named[device.name];
    return Object.entries(session?.interfaces || {}).flatMap(([port, state]) => {
      const participant = participation(session, port);
      if (!participant || !interfaceEvidence(session, port).up) return [];
      const ipv4 = state.ipv4[0]?.split(' ');
      const ipv6 = state.ipv6.find(address => !address.toLowerCase().startsWith('fe80:')) || state.ipv6[0];
      const subnet = ipv4 ? ipNumber(ipv4[0]) & ipNumber(ipv4[1]) : ipv6PrefixKey(ipv6);
      const mask = ipv4?.[1] || `/${ipv6.split('/')[1] || 128}`;
      return [{ id: device.id, device: device.name, port, area: participant.area, subnet, mask, routerId: participant.process.routerId || ipv4?.[0] || device.name, priority: state.ospfPriority ?? 1, cost: state.ospfCost ?? 1, network: state.ospfNetworkType || 'broadcast', passive: participant.process.passiveInterfaces?.some(value => value === 'default' || value === port) }];
    });
  });
  return candidates.map(candidate => {
    const segmentConnected = (peer: typeof candidate) => {
      const queue = [candidate.id], visited = new Set<string>();
      while (queue.length) {
        const id = queue.shift()!;
        if (id === peer.id) return true;
        if (visited.has(id)) continue;
        visited.add(id);
        const device = lab.topology.devices.find(device => device.id === id)!;
        if (id !== candidate.id && (device.kind !== 'switch' || device.role.includes('Layer 3'))) continue;
        for (const link of lab.topology.links.filter(link => link.from === id || link.to === id)) {
          const localPort = link.from === id ? link.fromPort : link.toPort;
          if (id === candidate.id && localPort !== candidate.port) continue;
          const remoteId = link.from === id ? link.to : link.from;
          const remotePort = link.from === id ? link.toPort : link.fromPort;
          const remote = lab.topology.devices.find(device => device.id === remoteId)!;
          if (remoteId === peer.id && remotePort !== peer.port) continue;
          if (!interfaceEvidence(named[device.name], localPort).up || !interfaceEvidence(named[remote.name], remotePort).up) continue;
          const channel = channelForwarding(named[device.name], localPort, named[remote.name], remotePort);
          if (!channel.bundled) continue;
          queue.push(remoteId);
        }
      }
      return false;
    };
    const peers = candidates.filter(peer => !peer.passive && peer.area === candidate.area && peer.subnet === candidate.subnet && peer.mask === candidate.mask && peer.network === 'broadcast' && peer.priority > 0 && segmentConnected(peer))
      .sort((a, b) => b.priority - a.priority || ipNumber(b.routerId) - ipNumber(a.routerId));
    const role = candidate.passive ? 'PASSIVE' : candidate.network !== 'broadcast' ? 'NO ELECTION' : peers[0] === candidate ? 'DR' : peers[1] === candidate ? 'BDR' : 'DROTHER';
    const segment = candidates.filter(peer => peer.subnet === candidate.subnet && peer.mask === candidate.mask && segmentConnected(peer)).map(peer => `${peer.id}:${peer.port}`).sort().join('|');
    return { ...candidate, role, segment };
  });
}

export function ospfTransitLinks(lab: LabConfig, sessions: Sessions) {
  const links = [...lab.topology.links];
  const candidates = electionEvidence(lab, sessions).filter(row => row.network === 'broadcast');
  for (let i = 0; i < candidates.length; i++) for (let j = i + 1; j < candidates.length; j++) {
    const a = candidates[i], b = candidates[j];
    if (a.id === b.id || a.segment !== b.segment || a.subnet !== b.subnet || a.mask !== b.mask) continue;
    if (links.some(link => link.from === a.id && link.to === b.id || link.from === b.id && link.to === a.id)) continue;
    links.push({ id: `ospf-segment:${a.id}:${a.port}:${b.id}:${b.port}`, from: a.id, fromPort: a.port, to: b.id, toPort: b.port });
  }
  return links;
}

export type OspfEvidenceTable = { title: string; description: string; headers: string[]; rows: Array<Array<string | number>> };
export type OspfOperationalEvidence = {
  processes: OspfEvidenceTable;
  areas: OspfEvidenceTable;
  interfaces: OspfEvidenceTable;
  neighbors: OspfEvidenceTable;
  database: OspfEvidenceTable;
  lsaSummary: OspfEvidenceTable;
  timers: OspfEvidenceTable;
  capabilities: OspfEvidenceTable;
  events: OspfEvidenceTable;
};

type ModeledLsa = { area: number | 'AS'; type: number; name: string; linkStateId: string; advertisingRouter: string; age: number; sequence: number; checksum: string; source: string };

const ospfEndpoint = (link: string) => link.match(/^(\S+) (\S+) <-> (\S+) (\S+)$/);
const ospfHex = (value: number, width: number) => `0x${(value >>> 0).toString(16).toUpperCase().padStart(width, '0')}`;
function ospfChecksum(value: string) {
  let hash = 0x1d0f;
  for (const character of value) hash = ((hash << 5) - hash + character.charCodeAt(0)) & 0xffff;
  return ospfHex(hash, 4);
}
function ospfAreaIds(process: OspfProcess) {
  return Array.from(new Set([...process.networks.map(network => network.area), ...Object.values(process.ipv6Interfaces || {}), ...Object.keys(process.areas || {}).map(Number)])).sort((a, b) => a - b);
}
function ospfIntervals(state: Session['interfaces'][string]) {
  const slow = state?.ospfNetworkType === 'non-broadcast';
  return {
    hello: state?.ospfHelloInterval ?? (slow ? 30 : 10),
    dead: state?.ospfDeadInterval ?? (slow ? 120 : 40),
    retransmit: state?.ospfRetransmitInterval ?? 5,
  };
}
function ospfCost(process: OspfProcess, state: Session['interfaces'][string]) {
  if (state?.ospfCost) return state.ospfCost;
  const speed = Number(state?.speed || 0);
  return speed > 0 ? Math.max(1, Math.floor((process.referenceBandwidthMbps || 100) / speed)) : 1;
}

/** A deterministic OSPF control-plane projection shared by CLI output and live evidence tables. */
export function ospfOperationalEvidence(lab: LabConfig, sessions: Sessions, deviceName: string, addressFamily?: 'ipv4' | 'ipv6'): OspfOperationalEvidence {
  const named = namedSessions(lab, sessions);
  const session = named[deviceName];
  const currentTick = Math.max(0, ...Object.values(named).map(value => value?.simulationTick || 0));
  const processes = Object.values(session?.ospfProcesses || {}).map(process => ensureOspfOperational(process, currentTick)).filter(process => !addressFamily || process.addressFamily === addressFamily);
  const elections = electionEvidence(lab, sessions);
  const protocols = protocolEvidence(lab, sessions).filter(row => row.protocol === 'OSPF');
  const localElections = elections.filter(row => row.device === deviceName);
  const fullPeers = new Map<string, Set<string>>();
  for (const row of protocols.filter(row => row.state === 'FULL')) {
    const match = ospfEndpoint(row.link);
    if (!match) continue;
    const [, left, , right] = match;
    fullPeers.set(left, new Set([...Array.from(fullPeers.get(left) || []), right]));
    fullPeers.set(right, new Set([...Array.from(fullPeers.get(right) || []), left]));
  }
  const reachable = new Set([deviceName]);
  const queue = [deviceName];
  while (queue.length) for (const peer of Array.from(fullPeers.get(queue.shift()!) || [])) if (!reachable.has(peer)) { reachable.add(peer); queue.push(peer); }

  const processRows = processes.map(process => {
    const areas = ospfAreaIds(process);
    const adjacencyCount = protocols.filter(row => row.state === 'FULL' && row.link.includes(`${deviceName} `)).length;
    return [process.id, process.addressFamily === 'ipv6' ? 'OSPFv3 / IPv6' : 'OSPFv2 / IPv4', process.routerId || 'unset', `${Math.max(0, currentTick - (process.startedTick || 0))} ticks`, areas.join(', ') || 'none', adjacencyCount, process.spfExecutions || 0, `${Math.max(0, currentTick - (process.lastSpfTick || 0))} ticks ago`, `${process.referenceBandwidthMbps} Mbps`];
  });

  const interfaceRows: Array<Array<string | number>> = [];
  for (const process of processes) for (const [port, state] of Object.entries(session?.interfaces || {})) {
    const discovered = participation(session, port, process.addressFamily || 'ipv4');
    const configuredV3Area = process.addressFamily === 'ipv6' ? process.ipv6Interfaces?.[port] : undefined;
    if (configuredV3Area === undefined && (!discovered || discovered.process.id !== process.id || (discovered.process.addressFamily || 'ipv4') !== process.addressFamily)) continue;
    const area = configuredV3Area ?? discovered!.area;
    const address = process.addressFamily === 'ipv6' ? state.ipv6.find(value => !value.toLowerCase().startsWith('fe80:')) || state.ipv6[0] || 'unassigned' : discovered!.address;
    const election = localElections.find(row => row.port === port);
    const intervals = ospfIntervals(state);
    const passive = process.passiveInterfaces?.some(value => value === 'default' || value === port) || false;
    interfaceRows.push([port, process.id, area, address, interfaceEvidence(session, port).up ? passive ? 'PASSIVE' : 'UP' : 'DOWN', state.ospfNetworkType || 'broadcast', ospfCost(process, state), state.ospfPriority ?? 1, election?.role || 'NO ELECTION', `${intervals.hello}/${intervals.dead}/${intervals.retransmit}s`, state.ospfAuthentication || process.areas?.[String(area)]?.authentication || 'none']);
  }

  const neighborRows: Array<Array<string | number>> = [];
  for (const row of protocols.filter(row => row.link.includes(`${deviceName} `))) {
    const match = ospfEndpoint(row.link);
    if (!match) continue;
    const [, leftName, leftPort, rightName, rightPort] = match;
    const localName = leftName === deviceName ? leftName : rightName;
    const localPort = leftName === deviceName ? leftPort : rightPort;
    const peerName = leftName === deviceName ? rightName : leftName;
    const peerPort = leftName === deviceName ? rightPort : leftPort;
    const local = named[localName], peer = named[peerName];
    const localParticipant = local && participation(local, localPort);
    const peerParticipant = peer && participation(peer, peerPort);
    const intervals = ospfIntervals(local?.interfaces[localPort]);
    const elapsed = Math.max(0, currentTick - (localParticipant?.process.lastSpfTick || 0));
    const deadCountdown = row.state === 'FULL' ? Math.max(1, intervals.dead - elapsed % intervals.hello) : 0;
    neighborRows.push([peerParticipant?.process.routerId || peerName, peerName, peerPort, localPort, localParticipant?.area ?? '—', row.state, `${deadCountdown}s`, elections.find(item => item.device === peerName && item.port === peerPort)?.role || '—', row.reason]);
  }

  const areaRows: Array<Array<string | number>> = [];
  const lsas: ModeledLsa[] = [];
  for (const process of processes) {
    const localRouterId = process.routerId || deviceName;
    for (const areaId of ospfAreaIds(process)) {
      const area = process.areas?.[String(areaId)] || { id: areaId, type: 'normal' as const, authentication: 'none' as const, ranges: [] };
      const ports = interfaceRows.filter(row => row[1] === process.id && row[2] === areaId).map(row => String(row[0]));
      const loopbacks = ports.filter(port => port.startsWith('loopback')).length;
      const areaRouters = Object.entries(named).flatMap(([name, peer]) => {
        if (!peer || !reachable.has(name)) return [];
        return Object.values(peer.ospfProcesses || {}).flatMap(raw => {
          const candidate = ensureOspfOperational(raw, currentTick);
          return candidate.addressFamily === process.addressFamily && ospfAreaIds(candidate).includes(areaId) ? [{ name, process: candidate }] : [];
        });
      });
      for (const router of areaRouters) {
        const age = Math.max(0, currentTick - (router.process.lastSpfTick || router.process.startedTick || 0));
        const sequence = router.process.lsaSequence || 0x80000001;
        const advertisingRouter = router.process.routerId || router.name;
        lsas.push({ area: areaId, type: 1, name: 'Router', linkStateId: advertisingRouter, advertisingRouter, age, sequence, checksum: ospfChecksum(`${areaId}:1:${advertisingRouter}:${sequence}`), source: router.name });
      }
      const segments = new Map<string, ReturnType<typeof electionEvidence>[number]>();
      for (const candidate of elections.filter(candidate => candidate.area === areaId && reachable.has(candidate.device) && candidate.role === 'DR')) segments.set(candidate.segment, candidate);
      for (const dr of Array.from(segments.values())) {
        const sequence = process.lsaSequence || 0x80000001;
        const linkStateId = typeof dr.subnet === 'number' ? `${numberToIpv4(dr.subnet)}/${maskPrefix(dr.mask)}` : dr.subnet;
        lsas.push({ area: areaId, type: 2, name: 'Network', linkStateId, advertisingRouter: dr.routerId, age: Math.max(0, currentTick - (process.lastSpfTick || 0)), sequence, checksum: ospfChecksum(`${areaId}:2:${dr.segment}:${sequence}`), source: dr.device });
      }
      for (const [name, peer] of Object.entries(named)) for (const raw of Object.values(peer?.ospfProcesses || {})) {
        const abr = ensureOspfOperational(raw, currentTick);
        const abrAreas = ospfAreaIds(abr);
        if (!reachable.has(name) || abr.addressFamily !== process.addressFamily || abrAreas.length < 2 || !abrAreas.includes(areaId)) continue;
        for (const network of abr.networks.filter(network => network.area !== areaId)) {
          const sequence = abr.lsaSequence || 0x80000001;
          lsas.push({ area: areaId, type: 3, name: 'Summary', linkStateId: network.network, advertisingRouter: abr.routerId || name, age: Math.max(0, currentTick - (abr.lastSpfTick || 0)), sequence, checksum: ospfChecksum(`${areaId}:3:${network.network}:${sequence}`), source: name });
        }
        for (const [port, sourceArea] of Object.entries(abr.ipv6Interfaces || {}).filter(([, sourceArea]) => sourceArea !== areaId)) {
          const prefix = peer.interfaces[port]?.ipv6.find(address => !address.toLowerCase().startsWith('fe80:'));
          if (!prefix) continue;
          const sequence = abr.lsaSequence || 0x80000001;
          lsas.push({ area: areaId, type: 3, name: 'Inter-Area Prefix', linkStateId: ipv6PrefixKey(prefix), advertisingRouter: abr.routerId || name, age: Math.max(0, currentTick - (abr.lastSpfTick || 0)), sequence, checksum: ospfChecksum(`${areaId}:3:${prefix}:${sequence}`), source: name });
        }
      }
      areaRows.push([areaId === 0 ? 'BACKBONE(0)' : areaId, area.type, ports.length ? 'active' : 'inactive', ports.join(', ') || 'none', loopbacks, area.authentication, area.ranges.join(', ') || 'none']);
    }
    for (const [name, peer] of Object.entries(named)) for (const raw of Object.values(peer?.ospfProcesses || {})) {
      const originator = ensureOspfOperational(raw, currentTick);
      if (!reachable.has(name) || originator.addressFamily !== process.addressFamily || !originator.defaultInformationOriginate) continue;
      const sequence = originator.lsaSequence || 0x80000001;
      lsas.push({ area: 'AS', type: 5, name: 'AS External', linkStateId: '0.0.0.0', advertisingRouter: originator.routerId || name, age: Math.max(0, currentTick - (originator.lastSpfTick || 0)), sequence, checksum: ospfChecksum(`AS:5:0.0.0:${sequence}`), source: name });
      for (const area of Object.values(originator.areas || {}).filter(area => area.type === 'nssa')) lsas.push({ area: area.id, type: 7, name: 'NSSA External', linkStateId: '0.0.0.0', advertisingRouter: originator.routerId || name, age: Math.max(0, currentTick - (originator.lastSpfTick || 0)), sequence, checksum: ospfChecksum(`${area.id}:7:0.0.0:${sequence}`), source: name });
    }
    const areaTypeCounts = ospfAreaIds(process).reduce((counts, id) => { const type = process.areas?.[String(id)]?.type || 'normal'; counts[type] += 1; return counts; }, { normal: 0, stub: 0, nssa: 0 });
    if (!areaRows.length) areaRows.push(['—', 'none', 'inactive', 'none', 0, 'none', 'none']);
    areaRows.forEach(row => { if (row.length === 7) row.push(`${areaTypeCounts.normal} normal / ${areaTypeCounts.stub} stub / ${areaTypeCounts.nssa} nssa`); });
    void localRouterId;
  }

  const uniqueLsas = Array.from(new Map(lsas.map(lsa => [`${lsa.area}:${lsa.type}:${lsa.linkStateId}:${lsa.advertisingRouter}`, lsa])).values());
  const databaseRows = uniqueLsas.map(lsa => [lsa.area, `${lsa.type} / ${lsa.name}`, lsa.linkStateId, lsa.advertisingRouter, lsa.age, ospfHex(lsa.sequence, 8), lsa.checksum, lsa.source]);
  const lsaTypes = [[1, 'Router'], [2, 'Network'], [3, 'Summary'], [4, 'ASBR Summary'], [5, 'AS External'], [7, 'NSSA External'], [9, 'Opaque Link'], [10, 'Opaque Area'], [11, 'Opaque AS']] as const;
  const lsaSummaryRows = lsaTypes.map(([type, name]) => {
    const records = uniqueLsas.filter(lsa => lsa.type === type);
    const checksumSum = records.reduce((total, lsa) => (total + parseInt(lsa.checksum.slice(2), 16)) & 0xffffff, 0);
    return [type, name, records.length, ospfHex(checksumSum, 6), records.filter(lsa => lsa.age >= 3600).length, records.filter(lsa => lsa.age >= 1800).length];
  });

  const timerRows = processes.flatMap(process => [
    ['SPF schedule', `${process.timers!.spfInitialMs} / ${process.timers!.spfHoldMs} / ${process.timers!.spfMaxWaitMs} ms`, 'initial / hold / maximum'],
    ['Minimum LSA interval', `${process.timers!.lsaMinIntervalMs} ms`, 'per originator'],
    ['Minimum LSA arrival', `${process.timers!.lsaArrivalMs} ms`, 'per received LSA'],
    ['LSA group pacing', `${process.timers!.groupPacingSeconds} sec`, 'refresh batching'],
    ['Interface flood pacing', `${process.timers!.floodPacingMs} ms`, 'flood queue'],
    ['Retransmission pacing', `${process.timers!.retransmissionPacingMs} ms`, 'retransmission queue'],
  ]);
  const capabilityRows = processes.flatMap(process => [
    ['TOS0 routes only', process.capabilities!.tos0Only ? 'supported' : 'disabled'],
    ['Opaque LSA', process.capabilities!.opaqueLsa ? 'supported' : 'disabled'],
    ['Link-local signaling (LLS)', process.capabilities!.lls ? 'supported' : 'disabled'],
    ['Area transit capability', process.capabilities!.areaTransit ? 'supported' : 'disabled'],
    ['NSSA RFC 3101', process.capabilities!.nssaRfc3101 ? 'supported' : 'disabled'],
    ['Database exchange optimization', process.capabilities!.databaseExchangeOptimization ? 'supported' : 'disabled'],
    ['IETF NSF helper', process.capabilities!.ietfNsfHelper ? 'enabled' : 'disabled'],
    ['Cisco NSF helper', process.capabilities!.ciscoNsfHelper ? 'enabled' : 'disabled'],
    ['Incremental SPF', process.incrementalSpf ? 'enabled' : 'disabled'],
    ['Maximum-metric Router-LSA', process.maxMetricRouterLsa ? 'enabled' : 'disabled'],
    ['Event log', 'enabled / 1000 / cyclic'],
    ['EXCHANGE/LOADING adjacency limit', `${process.adjacencyLimit!.initial} initial / ${process.adjacencyLimit!.maximum} maximum`],
    ['External flood list', '0 pending'],
    ['DoNotAge / DC-bitless LSAs', '0 / 0'],
  ]);
  const eventRows = processes.flatMap(process => [...(process.eventLog || [])].reverse().map(event => [event.tick, `${Math.max(0, currentTick - event.tick)} ticks ago`, event.event]));

  return {
    processes: { title: 'Process overview', description: 'OSPF process identity, address family, modeled uptime, area participation, adjacencies, SPF execution, and reference bandwidth.', headers: ['Process', 'Address Family', 'Router ID', 'Uptime', 'Areas', 'FULL Peers', 'SPF Runs', 'Last SPF', 'Reference BW'], rows: processRows },
    areas: { title: 'Area database', description: 'Per-area type, active interfaces, authentication, configured ranges, and process area composition.', headers: ['Area', 'Type', 'State', 'Interfaces', 'Loopbacks', 'Authentication', 'Ranges', 'Process Areas'], rows: areaRows },
    interfaces: { title: 'OSPF interfaces', description: 'Interface-level participation, network type, cost, election role, timers, and authentication.', headers: ['Interface', 'Process', 'Area', 'Address', 'State', 'Network Type', 'Cost', 'Priority', 'Role', 'Hello/Dead/Rxmt', 'Authentication'], rows: interfaceRows },
    neighbors: { title: 'Neighbors', description: 'Modeled Hello compatibility and adjacency state. Dead time advances on the deterministic simulator clock and refreshes while Hellos remain eligible.', headers: ['Neighbor ID', 'Device', 'Peer Port', 'Local Port', 'Area', 'State', 'Dead Time', 'Role', 'Evidence'], rows: neighborRows },
    database: { title: 'Link-state database', description: 'Deterministic Router, Network, Summary, External, and NSSA LSAs derived from the active topology and process state.', headers: ['Area', 'Type', 'Link State ID', 'Advertising Router', 'Age', 'Sequence', 'Checksum', 'Source'], rows: databaseRows },
    lsaSummary: { title: 'LSA accounting', description: 'Counts and checksum sums by LSA type, including supported types with zero current instances.', headers: ['Type', 'Name', 'Count', 'Checksum Sum', 'MaxAge', 'DoNotAge'], rows: lsaSummaryRows },
    timers: { title: 'SPF and LSA pacing', description: 'Configured deterministic scheduler and pacing values used by the modeled control plane.', headers: ['Timer', 'Value', 'Purpose'], rows: timerRows },
    capabilities: { title: 'Capabilities and safeguards', description: 'Process features, helper modes, limits, and flood-queue state.', headers: ['Capability', 'State'], rows: capabilityRows },
    events: { title: 'Event log', description: 'Cyclic process events generated by OSPF-affecting IOS commands.', headers: ['Tick', 'Age', 'Event'], rows: eventRows },
  };
}

export function formatOspfProcessCli(evidence: OspfOperationalEvidence) {
  if (!evidence.processes.rows.length) return ['% OSPF is not configured.'];
  const lines: string[] = [];
  for (const process of evidence.processes.rows) {
    lines.push(`Routing Process "ospf ${process[0]}" (${process[1]}) with ID ${process[2]}`);
    lines.push(` Start time: ${process[3]}, SPF algorithm executed ${process[6]} times`);
    lines.push(` Last SPF execution: ${process[7]}`);
    for (const [capability, state] of evidence.capabilities.rows) lines.push(` ${capability}: ${state}`);
    lines.push(` Reference bandwidth unit is ${String(process[8]).toLowerCase()}`);
    for (const area of evidence.areas.rows) {
      lines.push(` Area ${area[0]} (${area[2]})`);
      lines.push(`  Area type ${area[1]}, interfaces ${area[3]}, loopbacks ${area[4]}`);
      lines.push(`  Authentication ${area[5]}, ranges ${area[6]}`);
      const areaLsas = evidence.database.rows.filter(row => String(row[0]) === String(area[0]).replace('BACKBONE(0)', '0'));
      const checksum = areaLsas.reduce((sum, row) => (sum + parseInt(String(row[6]).slice(2), 16)) & 0xffffff, 0);
      lines.push(`  Number of LSA ${areaLsas.length}. Checksum Sum ${ospfHex(checksum, 6)}`);
    }
  }
  lines.push(...evidence.timers.rows.map(row => ` ${row[0]}: ${row[1]} (${row[2]})`));
  return lines;
}

export function formatOspfDatabaseCli(evidence: OspfOperationalEvidence) {
  if (!evidence.processes.rows.length) return ['% OSPF is not configured.'];
  const rows = evidence.database.rows;
  return [
    `OSPF Router with ID (${evidence.processes.rows[0][2]}) (Process ID ${evidence.processes.rows[0][0]}, ${evidence.processes.rows[0][1]})`,
    '',
    'Type  Area  Link ID          ADV Router       Age  Seq#        Checksum  Source',
    ...(rows.length ? rows.map(row => `${String(row[1]).padEnd(18)}${String(row[0]).padEnd(6)}${String(row[2]).padEnd(17)}${String(row[3]).padEnd(17)}${String(row[4]).padEnd(5)}${String(row[5]).padEnd(12)}${String(row[6]).padEnd(10)}${row[7]}`) : ['% The modeled link-state database is empty.']),
    '',
    'LSA Type Accounting',
    ...evidence.lsaSummary.rows.map(row => `${String(row[0]).padEnd(5)}${String(row[1]).padEnd(20)} count ${String(row[2]).padEnd(4)} checksum ${row[3]}`),
  ];
}

export function formatOspfInterfaceCli(evidence: OspfOperationalEvidence, port?: string, brief = false) {
  const rows = evidence.interfaces.rows.filter(row => !port || String(row[0]).toLowerCase() === port.toLowerCase());
  if (!rows.length) return [port ? `% Interface ${port} is not participating in OSPF.` : '% No OSPF interfaces configured.'];
  if (brief) return ['Interface    PID   Area  Address          State       Cost  Pri  Role', ...rows.map(row => `${String(row[0]).padEnd(13)}${String(row[1]).padEnd(6)}${String(row[2]).padEnd(6)}${String(row[3]).padEnd(17)}${String(row[4]).padEnd(12)}${String(row[6]).padEnd(6)}${String(row[7]).padEnd(5)}${row[8]}`)];
  return rows.flatMap(row => [
    `${row[0]} is ${row[4]}, line protocol is ${row[4] === 'DOWN' ? 'down' : 'up'}`,
    ` Internet Address ${row[3]}, Area ${row[2]}, Process ID ${row[1]}`,
    ` Network Type ${row[5]}, Cost: ${row[6]}, State ${row[8]}, Priority ${row[7]}`,
    ` Timer intervals configured, Hello ${String(row[9]).split('/')[0]}, Dead ${String(row[9]).split('/')[1]}, Retransmit ${String(row[9]).split('/')[2]}`,
    ` Authentication ${row[10]}`,
  ]);
}

export function formatOspfNeighborCli(evidence: OspfOperationalEvidence) {
  if (!evidence.neighbors.rows.length) return ['No OSPF peers configured.'];
  return ['Neighbor ID      Pri   State          Dead Time   Address / Device  Interface', ...evidence.neighbors.rows.map(row => `${String(row[0]).padEnd(17)}${String(row[7] === 'DR' ? 1 : 0).padEnd(6)}${String(row[5]).padEnd(15)}${String(row[6]).padEnd(12)}${String(row[1]).padEnd(18)}${row[3]}`)];
}

function numberToIpv4(value: number) {
  return [24, 16, 8, 0].map(shift => (value >>> shift) & 255).join('.');
}
function maskPrefix(mask: string) {
  return mask.split('.').reduce((count, octet) => count + Number(octet).toString(2).split('1').length - 1, 0);
}

export function diagnosePath(lab: LabConfig, sessions: Sessions, from: string, to: string, vlan: number) {
  const named = namedSessions(lab, sessions);
  const queue = [{ id: from, hops: [] as string[], seen: [from] }];
  const failures: string[] = [];
  while (queue.length) {
    const current = queue.shift()!;
    if (current.id === to) return { passed: true, hops: current.hops, summary: `Layer 2 VLAN ${vlan} path is available. Routing, ACL and application checks are separate.` };
    for (const link of lab.topology.links) {
      const peerId = link.from === current.id ? link.to : link.to === current.id ? link.from : undefined;
      if (!peerId || current.seen.includes(peerId)) continue;
      const reasons: string[] = [];
      const leftNode = lab.topology.devices.find(node => node.id === link.from);
      const rightNode = lab.topology.devices.find(node => node.id === link.to);
      const channel = channelForwarding(named[leftNode?.name], link.fromPort, named[rightNode?.name], link.toPort);
      if (channel.configured && !channel.bundled) reasons.push(`${leftNode?.name || link.from} ${link.fromPort} <-> ${rightNode?.name || link.to} ${link.toPort}: EtherChannel is not bundled (${channel.reason})`);
      for (const [id, port] of [[link.from, link.fromPort], [link.to, link.toPort]]) {
        const node = lab.topology.devices.find(d => d.id === id);
        const session = named[node?.name];
        const state = session?.interfaces[port];
        const label = `${node?.name || id} ${port}`;
        if (!interfaceEvidence(session, port).up) reasons.push(`${label}: interface is down or unconfigured`);
        if (node?.kind === 'switch' && state) {
          const effective = state.channelGroup ? session?.interfaces[`port-channel ${state.channelGroup}`] || state : state;
          if (effective.switchportMode === 'trunk' && !vlanAllowed(effective.allowedVlans, vlan)) reasons.push(`${label}: trunk blocks VLAN ${vlan}`);
          if (effective.switchportMode !== 'trunk' && (effective.accessVlan ?? 1) !== vlan) reasons.push(`${label}: access VLAN is ${effective.accessVlan ?? 1}, requested ${vlan}`);
          if (vlan !== 1 && !session?.vlans[vlan]) reasons.push(`${label}: VLAN ${vlan} does not exist`);
        }
      }
      if (reasons.length) failures.push(...reasons);
      else queue.push({ id: peerId, seen: [...current.seen, peerId], hops: [...current.hops, `${link.from}:${link.fromPort} -> ${link.to}:${link.toPort}: forwarding VLAN ${vlan}`] });
    }
  }
  return { passed: false, hops: Array.from(new Set(failures)), summary: 'No usable Layer 2 path. Inspect the blocking ports below.' };
}

export function evidenceOutput(command: string, session: Session, lab: LabConfig, sessions: Sessions): string[] | undefined {
  if (command === 'show ip interface brief' || command === 'show interface ip brief') {
    const device = lab.topology.devices.find(d => d.name === session.hostname);
    const ports = Array.from(new Set<string>([...(device?.ports || []), ...Object.keys(session.interfaces)]));
    const peers = protocolEvidence(lab, sessions);
    return ['Interface          IP-Address                  OK? Method Status                 Protocol', ...ports.map(port => { const row = interfaceRelationships(session, port, peers); return `${port.padEnd(18)} ${row.address.padEnd(27)} ${row.valid.padEnd(3)} ${row.method.padEnd(6)} ${row.admin.padEnd(22)} ${row.protocol}`; })];
  }
  if (command === 'show ip ospf neighbor' || command === 'show ipv6 ospf neighbor' || command === 'show etherchannel summary') {
    const ospf = command.includes('ospf');
    if (ospf) return formatOspfNeighborCli(ospfOperationalEvidence(lab, sessions, session.hostname, command.startsWith('show ipv6') ? 'ipv6' : 'ipv4'));
    const rows = protocolEvidence(lab, sessions).filter(row => (ospf ? row.protocol === 'OSPF' : ['LACP', 'Static'].includes(row.protocol)) && row.link.includes(`${session.hostname} `));
    return rows.length ? rows.map(row => `${row.link} | ${row.state} | ${row.reason}`) : [ospf ? 'No OSPF peers configured.' : 'No EtherChannel peers configured.'];
  }
  return undefined;
}
