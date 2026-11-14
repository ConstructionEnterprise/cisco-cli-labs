/** Packet Observatory shared IOS model: one prompt, one mode machine, reused by curriculum labs and the free topology sandbox. */

export type Mode = "user" | "privileged" | "config" | "vlan" | "interface" | "interface-range" | "subinterface" | "router" | "bgp" | "dhcp" | "line" | "acl" | "object-network" | "shell";

export type MacEntry = { mac: string; port: string; vlan: number; type: "dynamic" | "static"; lastSeen?: number };
export type ArpEntry = { ip: string; mac: string; interface: string; age: number };
export type Ipv6NeighborEntry = { ipv6: string; linkLocal?: string; mac: string; interface: string; state: "REACHABLE" | "STALE"; discovery: "NS/NA"; neighbor?: string };
export type Route = { prefix: string; nextHop?: string; interface?: string; protocol: "connected" | "static" | "ospf"; metric?: number };
export type DhcpPool = { name: string; network?: string; mask?: string; defaultRouter?: string; dnsServer?: string; domainName?: string };
export type DhcpLease = { mac: string; ip: string; clientId: string; state: "active" | "expired"; pool: string; leaseStart: string; leaseEnd: string };
export type TransportFlow = { protocol: "TCP" | "UDP"; application: string; source: string; destination: string; state: string; evidence: string };
export type OspfArea = { id: number; type: "normal" | "stub" | "nssa"; authentication: "none" | "simple" | "message-digest"; ranges: string[] };
export type OspfEvent = { tick: number; event: string };
export type OspfProcess = {
  id: number;
  addressFamily?: "ipv4" | "ipv6";
  routerId?: string;
  networks: { network: string; wildcard: string; area: number }[];
  ipv6Interfaces?: Record<string, number>;
  passiveInterfaces?: string[];
  areas?: Record<string, OspfArea>;
  startedTick?: number;
  spfExecutions?: number;
  lastSpfTick?: number;
  lsaSequence?: number;
  eventLog?: OspfEvent[];
  referenceBandwidthMbps?: number;
  timers?: { spfInitialMs: number; spfHoldMs: number; spfMaxWaitMs: number; lsaMinIntervalMs: number; lsaArrivalMs: number; groupPacingSeconds: number; floodPacingMs: number; retransmissionPacingMs: number };
  capabilities?: { tos0Only: boolean; opaqueLsa: boolean; lls: boolean; areaTransit: boolean; nssaRfc3101: boolean; databaseExchangeOptimization: boolean; ietfNsfHelper: boolean; ciscoNsfHelper: boolean };
  incrementalSpf?: boolean;
  maxMetricRouterLsa?: boolean;
  defaultInformationOriginate?: boolean;
  adjacencyLimit?: { initial: number; maximum: number };
};
export type FhrpGroup = {
  protocol: "HSRP" | "VRRP" | "GLBP";
  group: number;
  virtualIp?: string;
  priority?: number;
  preempt?: boolean;
  state?: "active" | "standby" | "master" | "backup";
  glbpLoadBalancing?: "round-robin" | "weighted" | "host-dependent";
  glbpForwarder?: number;
  glbpWeight?: number;
};

export type InterfaceState = {
  ipv4: string[];
  ipv6: string[];
  shutdown: boolean;
  commands: string[];
  switchportMode?: "access" | "trunk";
  accessVlan?: number;
  nativeVlan?: number;
  allowedVlans?: string;
  channelGroup?: number;
  channelMode?: "active" | "passive" | "on";
  encapsulation?: "dot1q";
  vlanId?: number;
  status: "up" | "down" | "err-disabled";
  speed: string;
  duplex: "full" | "half" | "auto";
  errors: { crc: number; collisions: number };
  poe: { enabled: boolean; class: 0 | 1 | 2 | 3 | 4; wattage: number; state: "searching" | "delivering" | "fault" };
  dhcpClient?: boolean;
  nameif?: string;
  securityLevel?: number;
  ospfPriority?: number;
  ospfNetworkType?: "broadcast" | "point-to-point" | "non-broadcast";
  ospfCost?: number;
  ospfHelloInterval?: number;
  ospfDeadInterval?: number;
  ospfRetransmitInterval?: number;
  ospfAuthentication?: "none" | "simple" | "message-digest";
};

export type DhcpClientState = { mac: string; interface: string; state: "INIT" | "OFFERED" | "BOUND" | "EXPIRED"; ip?: string; mask?: string; gateway?: string; dns?: string; poolName?: string; leaseStart?: string; leaseEnd?: string };
export type VtpMode = "server" | "client" | "transparent";
export type VtpState = {
  mode: VtpMode;
  domain: string;
  version: 1 | 2;
  password: string;
  revision: number;
  lastModifiedBy: string;
  lastModifiedAt: string;
};
export type StpMode = "pvst" | "rapid-pvst";
export type StpState = {
  mode: StpMode;
  vlanPriority: Record<string, number>;
  vlanRoot: Record<string, "primary" | "secondary">;
  portfast: Record<string, boolean>;
  bpduguard: Record<string, boolean>;
};
export type SyntheticContainerEvent = { tick: number; level: "info" | "warn" | "error"; source: string; message: string };
export type SyntheticSocketEvent = { tick: number; type: "syn-received" | "accept" | "close" | "refused" | "throttled"; remoteIp: string; remotePort: number; reason?: string };
export type SyntheticContainerRuntime = {
  health: "healthy" | "degraded" | "unavailable";
  ingress: { tlsEnabled: boolean; tlsCertValid: boolean; tokenRequired: boolean; tokenValid: boolean; rateLimitRps: number; burst: number; currentTokens: number };
  kernel: { version: string; namespaces: Record<string, boolean>; cgroups: { memoryLimitMb: number; cpuLimitCores: number; pidsLimit: number; memoryMb: number; cpuPercent: number; pidsCount: number }; seccompProfile: string; droppedCapabilities: string[]; retainedCapabilities: string[]; recentSyscalls: Array<{ tick: number; name: string; result: "allowed" | "blocked" }> };
  socket: { protocol: "tcp"; state: "LISTEN" | "CLOSED"; localIp: string; port: number; interface: string; backlogMax: number; backlogCurrent: number; sendBufferBytes: number; receiveBufferBytes: number; tcpNoDelay: boolean; keepAlive: boolean; reuseAddress: boolean; events: SyntheticSocketEvent[] };
  logs: SyntheticContainerEvent[];
};
// The attacker console owns this state. It shares the lab session record with
// IOS so both consoles can observe the same fictional range and policy state.
export type RangePhase = "validation" | "probe" | "enumeration";
export type RangeEvidence = { targetId: string; phase: RangePhase; command: string; output: string[] };
export type AttackTerminalState = { selectedModule?: string; rhosts?: string; executionLog: string[]; snmpValues: Record<string, string>; containerRuntime: Record<string, SyntheticContainerRuntime>; rangePhase: Record<string, RangePhase>; rangeEvidence: RangeEvidence[] };

export type Session = {
  simulationTick?: number;
  lessonAnswers?: Record<string, boolean>;
  completedLabSteps?: Record<string, boolean>;
  settings?: Record<string, Record<string, string>>;
  hostname: string;
  mode: Mode;
  terminalKind?: "ios" | "attack";
  context: string | null;
  history: string[];
  runningConfig: string[];
  startupConfig: string[];
  interfaces: Record<string, InterfaceState>;
  vlans: Record<string, string>;
  macTable: MacEntry[];
  arpTable: ArpEntry[];
  ipv6Neighbors: Ipv6NeighborEntry[];
  routingTable: Route[];
  dhcpPools: Record<string, DhcpPool>;
  dhcpLeases: DhcpLease[];
  dhcpExcludedAddresses: string[];
  dhcpClient?: DhcpClientState;
  transportFlows: TransportFlow[];
  dnsServerEnabled: boolean;
  dnsRecords: Record<string, string>;
  dnsCache: Record<string, string>;
  ospfProcesses: Record<string, OspfProcess>;
  fhrpGroups: Record<string, FhrpGroup>;
  vtp?: VtpState;
  stp?: StpState;
  attackTerminal?: AttackTerminalState;
};

export function boot(name: string, role: string, terminalKind: "ios" | "attack" = "ios"): Session {
  return {
    hostname: name,
    simulationTick: 0,
    mode: terminalKind === "attack" ? "shell" : "user",
    terminalKind,
    context: null,
    runningConfig: [],
    startupConfig: [],
    interfaces: {},
    vlans: {},
    macTable: [],
    arpTable: [],
    ipv6Neighbors: [],
    routingTable: [],
    dhcpPools: {},
    dhcpLeases: [],
    dhcpExcludedAddresses: [],
    dhcpClient: undefined,
    transportFlows: [],
    dnsServerEnabled: false,
    dnsRecords: {},
    dnsCache: {},
    ospfProcesses: {},
    fhrpGroups: {},
    vtp: { mode: "server", domain: "", version: 1, password: "", revision: 0, lastModifiedBy: "0.0.0.0", lastModifiedAt: "0-0-00 00:00:00" },
    attackTerminal: terminalKind === "attack" ? { executionLog: [], snmpValues: {}, containerRuntime: {}, rangePhase: {}, rangeEvidence: [] } : undefined,
    history: [
      terminalKind === "attack" ? "Kali Linux (synthetic training range)" : "Cisco IOS Software, CCNA Lab Simulator",
      `${name} · ${role}`,
      terminalKind === "attack" ? "Authorized synthetic range only · enter one Linux command, then press Enter." : "Full IOS vocabulary · enter one command, then press Enter.",
    ],
  };
}

export function ospfProcessDefaults(id: number, tick = 0): OspfProcess {
  return {
    id, addressFamily: 'ipv4', networks: [], ipv6Interfaces: {}, passiveInterfaces: [], areas: {}, startedTick: tick,
    spfExecutions: 0, lastSpfTick: tick, lsaSequence: 0x80000001,
    eventLog: [{ tick, event: `OSPF process ${id} started` }], referenceBandwidthMbps: 100,
    timers: { spfInitialMs: 5000, spfHoldMs: 10000, spfMaxWaitMs: 10000, lsaMinIntervalMs: 5000, lsaArrivalMs: 1000, groupPacingSeconds: 240, floodPacingMs: 33, retransmissionPacingMs: 66 },
    capabilities: { tos0Only: true, opaqueLsa: true, lls: true, areaTransit: true, nssaRfc3101: true, databaseExchangeOptimization: true, ietfNsfHelper: true, ciscoNsfHelper: true },
    incrementalSpf: false, maxMetricRouterLsa: false, adjacencyLimit: { initial: 300, maximum: 300 },
  };
}

export function ensureOspfOperational(process: OspfProcess, tick: number): OspfProcess {
  const defaults = ospfProcessDefaults(process.id, process.startedTick ?? tick);
  return { ...defaults, ...process, networks: [...process.networks], ipv6Interfaces: { ...(process.ipv6Interfaces || {}) }, passiveInterfaces: [...(process.passiveInterfaces || [])],
    areas: Object.fromEntries(Object.entries(process.areas || {}).map(([id, area]) => [id, { ...area, ranges: [...area.ranges] }])),
    eventLog: [...(process.eventLog || defaults.eventLog!)], timers: { ...defaults.timers!, ...process.timers },
    capabilities: { ...defaults.capabilities!, ...process.capabilities }, adjacencyLimit: { ...defaults.adjacencyLimit!, ...process.adjacencyLimit } };
}

function recordOspfEvent(process: OspfProcess, tick: number, event: string, runSpf = false) {
  process.eventLog = [...(process.eventLog || []), { tick, event }].slice(-1000);
  if (runSpf) {
    process.spfExecutions = (process.spfExecutions || 0) + 1;
    process.lastSpfTick = tick;
    process.lsaSequence = Math.min(0xffffffff, (process.lsaSequence || 0x80000001) + 1);
    process.eventLog.push({ tick, event: `SPF scheduled: ${event}` });
  }
}

export function normalizeCommand(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

// `show cdp neighbors ?` interface-type keywords visible in the CML
// reference video (head + tail). The middle of that video list scrolled
// past, so the full IOS image lists additional types between Multilink
// and fcpa — those are deliberately not invented here. Shared by the
// generic help map below and the device-aware help in
// ios-device-reference.ts so both CLIs agree.
export const CDP_NEIGHBOR_INTERFACE_TYPES: Array<[string, string]> = [
  ['Async', 'Async interface'],
  ['Auto-Template', 'Auto-Template interface'],
  ['BVI', 'Bridge-Group Virtual Interface'],
  ['Bluetooth', 'Bluetooth interface'],
  ['CTunnel', 'CTunnel interface'],
  ['Dialer', 'Dialer interface'],
  ['EsconPhy', 'ESCON interface'],
  ['Filter', 'Filter interface'],
  ['Filtergroup', 'Filter Group interface'],
  ['GMPLS', 'MPLS interface'],
  ['GigabitEthernet', 'GigabitEthernet IEEE 802.3z'],
  ['GroupVI', 'Group Virtual Interface'],
  ['LISP', 'Locator/ID Separation Protocol Virtual Interface'],
  ['Lex', 'Lex interface'],
  ['Lspvif', 'LSP virtual interface'],
  ['MFR', 'Multilink Frame Relay bundle interface'],
  ['Multilink', 'Multilink-group interface'],
  ['fcpa', 'Fiber Channel'],
  ['voaBypassIn', 'VOA-Bypass-In interface'],
  ['voaBypassOut', 'VOA-Bypass-Out interface'],
  ['voaFilterIn', 'VOA-Filter-In interface'],
  ['voaFilterOut', 'VOA-Filter-Out interface'],
  ['voaIn', 'VOA-In interface'],
  ['voaOut', 'VOA-Out interface'],
  ['|', 'Output modifiers'],
  ['<cr>', ''],
];

export const CDP_NEIGHBORS_HELP_FOOTER = 'Study reference: interface-type keywords require an interface number in IOS; only show cdp neighbors, detail, and a modeled local-interface filter are simulated.';

// show etherchannel ? — verbatim from the CML screenshot (Percipio CCNA
// Switching Lab, SW2). There is no <cr>: a bare "show etherchannel" is
// incomplete in IOS, and the emulator rejects it the same way.
export const ETHERCHANNEL_HELP: Array<[string, string]> = [
  ['<1-255>', 'Channel group number'],
  ['auto', 'Displays summary of auto formed etherchannel'],
  ['detail', 'Detail information'],
  ['load-balance', 'Load-balance/frame-distribution scheme among ports in port-channel'],
  ['port', 'Port information'],
  ['port-channel', 'Port-channel information'],
  ['protocol', 'Protocol enabled'],
  ['summary', 'One-line summary per channel-group'],
];

export const ETHERCHANNEL_HELP_FOOTER = 'Study reference: Auto LAG is not modeled; load-balance shows the modeled default (src-mac), not a configured scheme.';

const IOS_HELP: Record<string, string[]> = {
  'user:': ['enable                         Turn on privileged commands', 'exit                           Exit from the EXEC'],
  'privileged:': ['clear                          Reset functions', 'configure                      Enter configuration mode', 'copy                           Copy from one file to another', 'disable                        Turn off privileged commands', 'ping                           Send echo messages', 'show                           Show running system information', 'terminal                       Set terminal line parameters', 'traceroute                     Trace route to destination', 'write                          Write running configuration'],
  'privileged:show': ['access-lists                   List access lists', 'arp                            ARP table', 'cdp                            CDP information', 'etherchannel                   EtherChannel information', 'interfaces                     Interface status and configuration', 'ip                             IP information', 'ipv6                           IPv6 information', 'mac                            MAC forwarding information', 'running-config                 Current operating configuration', 'spanning-tree                  Spanning-tree information', 'vlan                           VLAN information', 'vtp                            VTP information'],
  'privileged:show ip': ['arp                            IP ARP table', 'bgp                            BGP routing information', 'dhcp                           DHCP information', 'interface                      Interface IP status and configuration', 'nat                            Network address translation', 'ospf                           OSPF information', 'route                          IP routing table', 'vrf                            VRF information'],
  'privileged:show ipv6': ['interface                      IPv6 interface status and configuration', 'neighbors                      IPv6 neighbor cache', 'ospf                           IPv6 OSPF information', 'route                          IPv6 routing table'],
  'privileged:show interfaces': ['<interface>                    Interface name', 'counters errors                Interface error counters', 'status                         Interface status summary', 'switchport                     Switchport information', 'trunk                          Trunking information'],
  'privileged:show running-config': ['interface                      Interface configuration', '| section                      Include matching configuration section'],
  'privileged:show cdp': ['neighbors                      Show CDP neighbor entries'],
  'privileged:show cdp neighbors': [...CDP_NEIGHBOR_INTERFACE_TYPES.map(([word, description]) => word === '<cr>' ? '<cr>' : `${word.padEnd(30)} ${description}`), CDP_NEIGHBORS_HELP_FOOTER],
  'privileged:show etherchannel': [...ETHERCHANNEL_HELP.map(([word, description]) => `${word.padEnd(30)} ${description}`), ETHERCHANNEL_HELP_FOOTER],
  'privileged:show vtp': ['status                         VTP status'],
  'privileged:show spanning-tree': ['<cr>                           Display spanning-tree information', 'vlan                           Spanning tree for one VLAN', 'root                           Spanning-tree root status', 'summary                        Spanning-tree summary', 'interface                      Spanning tree for an interface'],
  'privileged:configure': ['terminal                       Configure from the terminal'],
  'privileged:copy': ['running-config                  Copy from the running configuration'],
  'privileged:ping': ['A.B.C.D                        IPv4 destination address', 'hostname                       Name resolved by configured DNS'],
  'config:': ['access-list                    Add an access-list entry', 'hostname                       Set system network name', 'interface                      Select an interface to configure', 'ip                             Configure IP parameters', 'ipv6                           Configure IPv6 parameters', 'router                         Enable a routing process', 'spanning-tree                  Configure spanning tree', 'vlan                           Create or select a VLAN', 'vtp                            Configure VTP'],
  'config:vtp': ['mode                           Set VTP mode', 'domain                         Set VTP domain', 'version                        Set VTP version', 'password                       Set VTP password'],
  'config:vtp mode': ['server                         VTP server mode', 'client                         VTP client mode', 'transparent                    VTP transparent mode'],
  'config:vtp domain': ['WORD                           VTP domain name'],
  'config:vtp version': ['1                              VTP version 1', '2                              VTP version 2'],
  'config:vtp password': ['WORD                           VTP password'],
  'config:spanning-tree': ['mode                           Select spanning-tree mode', 'vlan                           Set root or priority for a VLAN'],
  'config:spanning-tree mode': ['pvst                           Per-Vlan spanning tree mode', 'rapid-pvst                     Per-Vlan rapid spanning tree mode'],
  'config:spanning-tree vlan': ['WORD                           vlan range, example: 1,3-5,7,9-11'],
  'config:interface': ['g0/0                           GigabitEthernet interface', 'g0/1                           GigabitEthernet interface', 'loopback                       Loopback interface', 'vlan                           Switched virtual interface'],
  'config:ip': ['access-list                    Configure an IP access list', 'dhcp                           Configure DHCP', 'domain-name                    Define the default domain name', 'route                          Configure a static route'],
  'config:router': ['bgp                            Configure a BGP routing process', 'ospf                           Configure an OSPF routing process'],
  'interface:': ['description                    Add an interface description', 'ip                             Configure IPv4 parameters', 'ipv6                           Configure IPv6 parameters', 'shutdown                       Disable the interface', 'spanning-tree                  Configure interface spanning tree', 'switchport                     Configure switching characteristics', 'no shutdown                    Enable the interface'],
  'interface:spanning-tree': ['portfast                       Enable PortFast on this edge port', 'bpduguard enable               Enable BPDU Guard on this port'],
  'interface:ip': ['address                        Set the IPv4 address', 'access-group                   Apply an IP access list', 'helper-address                 Configure a DHCP relay'],
  'interface:ipv6': ['address                        Set the IPv6 address', 'ospf                           Configure OSPFv3 on this interface'],
  'interface:switchport': ['access                         Configure an access VLAN', 'mode                           Set access or trunk mode', 'trunk                          Configure trunk properties'],
  'vlan:': ['name                           Set the VLAN name', 'exit                           Return to global configuration'],
  'router:': ['network                        Advertise an IPv4 network', 'passive-interface              Suppress OSPF packets on an interface', 'router-id                      Configure the router ID'],
};

/** Cisco IOS-style context help. It is intentionally separate from command execution. */
export function iosContextHelp(value: string, mode: Mode): string[] | null {
  if (mode === 'shell' || !value.trim().endsWith('?')) return null;
  const stem = normalizeCommand(value.slice(0, -1));
  const modeKey = mode === 'subinterface' ? 'interface' : mode;
  // `do` reuses the privileged EXEC help from any configuration mode.
  if (modeKey !== 'privileged' && modeKey !== 'user' && (stem === 'do' || stem.startsWith('do '))) {
    const innerStem = stem === 'do' ? '' : stem.slice(3);
    return IOS_HELP[`privileged:${innerStem}`] || [`% Unrecognized command: ${stem || '?'}`];
  }
  // `spanning-tree vlan <range> root ?` — the range varies, so it is dynamic.
  if (modeKey === 'config' && /^spanning-tree vlan [\d,-]+ root$/.test(stem)) {
    return [
      'primary                        Configure this switch as primary root for this spanning tree',
      'secondary                      Configure switch as secondary root',
    ];
  }
  const exactKey = `${modeKey}:${stem}`;
  const options = IOS_HELP[exactKey] || (stem ? undefined : IOS_HELP[`${modeKey}:`]);
  if (options) return options;
  return [`% Unrecognized command: ${stem || '?'}`];
}

function vlanMembers(value: string | undefined): Set<number> {
  if (!value || value === 'all') return new Set(Array.from({ length: 4094 }, (_, index) => index + 1));
  if (value === 'none') return new Set();
  const vlans = new Set<number>();
  for (const item of value.split(',')) {
    const [first, last = first] = item.trim().split('-').map(Number);
    if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last > 4094 || last < first) continue;
    for (let vlan = first; vlan <= last; vlan += 1) vlans.add(vlan);
  }
  return vlans;
}

function formatVlans(vlans: Set<number>) {
  if (vlans.size === 4094) return undefined;
  if (vlans.size === 0) return 'none';
  const ordered = Array.from(vlans).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = ordered[0], previous = start;
  for (const vlan of ordered.slice(1)) {
    if (vlan === previous + 1) { previous = vlan; continue; }
    ranges.push(start === previous ? String(start) : `${start}-${previous}`);
    start = previous = vlan;
  }
  ranges.push(start === previous ? String(start) : `${start}-${previous}`);
  return ranges.join(',');
}

function applyAllowedVlans(current: string | undefined, specification: string) {
  const match = specification.match(/^(add|remove)\s+(.+)$/);
  if (!match) return specification === 'all' ? undefined : specification;
  const next = vlanMembers(current);
  const requested = vlanMembers(match[2]);
  for (const vlan of Array.from(requested)) match[1] === 'add' ? next.add(vlan) : next.delete(vlan);
  return formatVlans(next);
}

function modeledPeerMac(ip: string): string {
  const octets = ip.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return "02AA.BEEF.0001";
  return `02AA.${octets[0].toString(16).padStart(2, "0")}${octets[1].toString(16).padStart(2, "0")}.${octets[2].toString(16).padStart(2, "0")}${octets[3].toString(16).padStart(2, "0")}`.toUpperCase();
}

function modeledIpv6Mac(ip: string): string {
  const hex = ip.replace(/[^0-9a-f]/gi, "").toUpperCase().padStart(8, "0").slice(-8);
  return `02AA.${hex.slice(0, 4)}.${hex.slice(4)}`;
}

function modeledPeerIpv6(localAddress: string, remoteKind?: string): { global: string; linkLocal: string } {
  const address = localAddress.split("/")[0];
  const hostSuffix = remoteKind === "pc" ? "10" : remoteKind === "router" ? "2" : "10";
  return { global: address.replace(/::[0-9a-f]+$/i, `::${hostSuffix}`), linkLocal: `fe80::${hostSuffix}` };
}

export type ModeledTopology = { devices: Array<{ id: string; name?: string; kind?: string; role?: string }>; links: Array<{ from: string; to: string; fromPort?: string; toPort?: string }> };

/** Model a local Neighbor Solicitation and the connected endpoint's Neighbor Advertisement. */
export function applyModeledNeighborDiscovery(sessions: Record<string, Session>, topology: ModeledTopology): Record<string, Session> {
  const devices = new Map((topology.devices || []).map((device) => [device.id, device]));
  const nameFor = (id: string) => devices.get(id)?.name || id;
  const next = Object.fromEntries(Object.entries(sessions).map(([name, session]) => [name, { ...session, ipv6Neighbors: [...(session.ipv6Neighbors || [])] }])) as Record<string, Session>;
  for (const link of topology.links || []) {
    for (const [localId, remoteId, localPort, remotePort] of [[link.from, link.to, link.fromPort, link.toPort], [link.to, link.from, link.toPort, link.fromPort]] as Array<[string, string, string | undefined, string | undefined]>) {
      const localName = nameFor(localId);
      const local = next[localName];
      if (!local || !localPort) continue;
      const state = local.interfaces[localPort];
      if (!state || state.shutdown || state.status !== "up" || !state.ipv6.length) continue;
      const localIpv6 = state.ipv6.find((address) => !address.toLowerCase().startsWith("fe80:"));
      if (!localIpv6) continue;
      const remoteDevice = devices.get(remoteId);
      const endpointLink = remoteDevice?.kind === "switch" ? (topology.links || []).find((candidate) => candidate.from === remoteId && devices.get(candidate.to)?.kind === "pc") || (topology.links || []).find((candidate) => candidate.to === remoteId && devices.get(candidate.from)?.kind === "pc") : undefined;
      const endpointId = endpointLink ? (endpointLink.from === remoteId ? endpointLink.to : endpointLink.from) : remoteId;
      const peer = modeledPeerIpv6(localIpv6, devices.get(endpointId)?.kind);
      const remoteName = nameFor(endpointId);
      const entry: Ipv6NeighborEntry = { ipv6: peer.global, linkLocal: peer.linkLocal, mac: modeledIpv6Mac(peer.global), interface: localPort, state: "REACHABLE", discovery: "NS/NA", neighbor: remoteName };
      local.ipv6Neighbors = [...local.ipv6Neighbors.filter((item) => !(item.interface === localPort && item.ipv6 === entry.ipv6)), entry];
      const remoteSession = next[remoteName];
      const reciprocalPort = endpointLink ? (endpointLink.from === endpointId ? endpointLink.toPort : endpointLink.fromPort) : remotePort;
      if (remoteSession && reciprocalPort) {
        const remoteEntry: Ipv6NeighborEntry = { ipv6: localIpv6.split("/")[0], linkLocal: state.ipv6.find((address) => address.toLowerCase().startsWith("fe80:"))?.split("/")[0], mac: modeledIpv6Mac(localIpv6), interface: reciprocalPort, state: "REACHABLE", discovery: "NS/NA", neighbor: localName };
        remoteSession.ipv6Neighbors = [...remoteSession.ipv6Neighbors.filter((item) => !(item.interface === remotePort && item.neighbor === localName)), remoteEntry];
      }
    }
  }
  return next;
}

export function modeledDeviceMac(name: string): string {
  const value = Array.from(name).reduce((sum, character) => ((sum * 31) + character.charCodeAt(0)) >>> 0, 0);
  return `02AA.${((value >>> 16) & 0xffff).toString(16).padStart(4, "0")}.${(value & 0xffff).toString(16).padStart(4, "0")}`.toUpperCase();
}

/** Learn host source MACs on active switch ports after a modeled host frame arrives. */
export function applyModeledLayer2Learning(sessions: Record<string, Session>, topology: ModeledTopology): Record<string, Session> {
  const devices = new Map((topology.devices || []).map((device) => [device.id, device]));
  const nameFor = (id: string) => devices.get(id)?.name || id;
  const next = Object.fromEntries(Object.entries(sessions).map(([name, session]) => [name, { ...session, macTable: [...(session.macTable || [])] }])) as Record<string, Session>;
  const identities = new Set(Array.from(devices.keys()).map(modeledDeviceMac));
  for (const device of Array.from(devices.values())) if (device.kind === 'switch' && next[device.name || device.id]) next[device.name || device.id].macTable = next[device.name || device.id].macTable.filter(entry => entry.type === 'static' || !identities.has(entry.mac));
  const learnedBySwitch = new Map<string, MacEntry[]>();
  const addLearned = (switchName: string, entry: MacEntry) => {
    const entries = learnedBySwitch.get(switchName) || [];
    if (!entries.some(item => item.mac === entry.mac && item.vlan === entry.vlan)) learnedBySwitch.set(switchName, [...entries, entry]);
  };
  const activePort = (deviceName: string, portName: string | undefined) => {
    const port = portName ? next[deviceName]?.interfaces[portName] : undefined;
    return Boolean(port && !port.shutdown && port.status === "up");
  };
  const allows = (port: InterfaceState, vlan: number) => !port.allowedVlans || port.allowedVlans === 'all' || port.allowedVlans.split(',').some(value => { const [low, high = low] = value.split('-').map(Number); return vlan >= low && vlan <= high; });
  for (const link of topology.links || []) {
    for (const [switchId, hostId, switchPort] of [[link.from, link.to, link.fromPort], [link.to, link.from, link.toPort]] as Array<[string, string, string | undefined]>) {
      if (devices.get(switchId)?.kind !== "switch" || !['pc', 'server', 'printer', 'access-point', 'iot'].includes(devices.get(hostId)?.kind || '') || !switchPort) continue;
      const hostPort = switchId === link.from ? link.toPort : link.fromPort;
      // End hosts power their own NICs: a host with no interface entry is
      // up (hosts run no IOS session in the labs, so nothing ever creates
      // one), while an explicit shutdown/down entry still wins.
      const hostState = hostPort ? next[nameFor(hostId)]?.interfaces[hostPort] : undefined;
      if (hostState ? hostState.shutdown || hostState.status !== "up" : !hostPort) continue;
      const switchSession = next[nameFor(switchId)];
      const port = switchSession?.interfaces[switchPort];
      if (!switchSession || !port || port.shutdown || port.status !== "up" || port.switchportMode !== "access") continue;
      const entry: MacEntry = { mac: modeledDeviceMac(hostId), port: switchPort, vlan: port.accessVlan ?? 1, type: "dynamic", lastSeen: Date.now() };
      addLearned(nameFor(switchId), entry);
    }
  }
  for (const link of topology.links || []) {
    const from = devices.get(link.from);
    const to = devices.get(link.to);
    const fromName = nameFor(link.from);
    const toName = nameFor(link.to);
    if (from?.kind === "router" && to?.kind === "switch" && activePort(fromName, link.fromPort) && activePort(toName, link.toPort)) {
      const subinterface = Object.values(next[fromName]?.interfaces || {}).find((state) => state.vlanId !== undefined && state.ipv4.length);
      const port = link.toPort ? next[toName]?.interfaces[link.toPort] : undefined;
      if (subinterface && port && allows(port, subinterface.vlanId!)) addLearned(toName, { mac: modeledDeviceMac(from!.id), port: link.toPort!, vlan: subinterface.vlanId!, type: "dynamic", lastSeen: Date.now() });
    }
    if (to?.kind === "router" && from?.kind === "switch" && activePort(toName, link.toPort) && activePort(fromName, link.fromPort)) {
      const subinterface = Object.values(next[toName]?.interfaces || {}).find((state) => state.vlanId !== undefined && state.ipv4.length);
      const port = link.fromPort ? next[fromName]?.interfaces[link.fromPort] : undefined;
      if (subinterface && port && allows(port, subinterface.vlanId!)) addLearned(fromName, { mac: modeledDeviceMac(to!.id), port: link.fromPort!, vlan: subinterface.vlanId!, type: "dynamic", lastSeen: Date.now() });
    }
  }
  // Propagate learned VLAN source MACs across each operational trunk in both directions.
  for (let pass = 0; pass < topology.links.length; pass += 1) {
    for (const link of topology.links || []) {
      const from = devices.get(link.from);
      const to = devices.get(link.to);
      if (from?.kind !== "switch" || to?.kind !== "switch") continue;
      const fromName = nameFor(link.from);
      const toName = nameFor(link.to);
      const fromPort = link.fromPort ? next[fromName]?.interfaces[link.fromPort] : undefined;
      const toPort = link.toPort ? next[toName]?.interfaces[link.toPort] : undefined;
      if (!fromPort || !toPort || fromPort.switchportMode !== "trunk" || toPort.switchportMode !== "trunk" || !activePort(fromName, link.fromPort) || !activePort(toName, link.toPort)) continue;
      const compatible = !fromPort.channelGroup && !toPort.channelGroup || !!fromPort.channelGroup && !!toPort.channelGroup && (fromPort.channelMode === 'on' && toPort.channelMode === 'on' || fromPort.channelMode === 'active' && ['active', 'passive'].includes(toPort.channelMode || '') || toPort.channelMode === 'active' && fromPort.channelMode === 'passive');
      if (!compatible) continue;
      for (const entry of learnedBySwitch.get(fromName) || []) if (entry.port !== link.fromPort && allows(fromPort, entry.vlan) && allows(toPort, entry.vlan)) addLearned(toName, { ...entry, port: link.toPort!, lastSeen: Date.now() });
      for (const entry of learnedBySwitch.get(toName) || []) if (entry.port !== link.toPort && allows(fromPort, entry.vlan) && allows(toPort, entry.vlan)) addLearned(fromName, { ...entry, port: link.fromPort!, lastSeen: Date.now() });
    }
  }
  Array.from(learnedBySwitch.entries()).forEach(([switchName, entries]) => { next[switchName].macTable = [...next[switchName].macTable, ...entries]; });
  return next;
}

/**
 * Deliberately small IOS command grammar used by both the guided labs and the
 * free sandbox. A command must be valid for the current EXEC/configuration
 * mode before the lab sequence is allowed to consider it.
 */
export function isCiscoCommand(command: string, mode: Mode): boolean {
  if (mode === "shell") return false;
  if (iosContextHelp(command, mode)) return true;
  // `do` runs a privileged EXEC command from any configuration mode.
  if (command.startsWith("do ") && mode !== "user" && mode !== "privileged") {
    return isCiscoCommand(command.slice(3).trim(), "privileged");
  }
  if (command === "enable") return mode === "user";
  if (command === "disable") return mode === "privileged";
  if (command === "configure terminal") return mode === "privileged";
  if (command === "end") return mode !== "user";
  if (command === "exit") return mode !== "user";
  if (mode === "user") return false;
  if ((mode === 'interface' || mode === 'subinterface') && /^interface (?:g\d+\/\d+(?:\.\d+)?|eth\d+|vlan \d+|loopback \d+)$/.test(command)) return true;
  if (mode === 'privileged' && (command === 'show ipv6 ospf' || command === 'show ipv6 ospf database' || /^show interfaces eth\d+$/.test(command))) return true;
  if (mode === 'privileged' && /^show running-config interface vlan \d+$/.test(command)) return true;

  if (mode === "privileged" && (command === "show hosts" || command === "show ip ospf database" || command === "show access-list" || command === "show xlate" || command === "show conn" || command === "show interface ip brief" || /^nslookup \S+$/.test(command))) return true;
  if (mode === "config" && (/^ip dns server$/.test(command) || /^ip host \S+ [0-9.]+$/.test(command) || /^ip dhcp snooping(?: vlan \d+)?$/.test(command) || /^ip arp inspection vlan \d+$/.test(command) || /^mls qos$/.test(command) || /^lldp run$/.test(command) || /^vpc domain \d+$/.test(command) || /^peer-keepalive destination [0-9.]+$/.test(command) || /^dot11 ssid \S+$/.test(command) || /^wireless (?:channel \d+|band (?:2\.4ghz|5ghz)|power \d+)$/.test(command) || /^ip slb .+$/.test(command) || /^ntp server [0-9.]+$/.test(command) || /^ptp mode (?:boundary|ordinary)$/.test(command) || /^ip http (?:secure-(?:server|port \d+)|rate-limit \d+|authentication token-required)$/.test(command) || /^ip vrf \S+$/.test(command))) return true;
  if (mode === "privileged" && ["show lldp neighbors", "show vpc", "show ip slb", "show ntp associations", "show ptp clock", "show ip http server secure-status", "show ip dhcp snooping", "show ip arp inspection", "show ip vrf", "show glbp", "show glbp brief", "show vrrp brief", "show ppp multilink", "show ip bgp", "show ip bgp summary"].includes(command)) return true;
  if ((mode === "interface" || mode === "subinterface") && command === "power inline auto") return true;

  if (mode === "privileged") {
    return /^(show (access-lists(?: \S+)?|arp|cdp neighbors(?: detail| (?:g\d+\/\d+|gig ?\d+\/\d+|gigabitethernet ?\d+\/\d+|port-channel ?\d+|vlan \d+|loopback \d+|tunnel \d+|serial ?\d+\/\d+)(?: detail)?)?|clock|controllers|crypto key mypubkey rsa|etherchannel(?: summary| auto| detail| load-balance| port-channel(?: \d+)?| port(?: (?:g\d+\/\d+|gig ?\d+\/\d+))?| protocol| \d+(?: (?:detail|port|port-channel|protocol|summary))?)|interfaces(?: (?:g\d+\/\d+(?:\.\d+)?(?: switchport)?|gigabitethernet ?\d+\/\d+(?: switchport)?|port-channel ?\d+(?: switchport)?|status|trunk|counters errors|switchport))?|ip (?:arp inspection|bgp(?: summary)?|dhcp (?:binding|conflict|pool|server statistics|snooping)|http server secure-status|interface(?: brief| \S+)?|mroute|nat (?:translations(?: verbose)?|statistics)|ospf(?: neighbor| interface(?: brief| \S+)?)?|pim (?:neighbor|interface)|protocols|route(?: (?:connected|static|ospf|vrf \S+|\S+))?|vrf)|ipv6 (?:interface(?: brief| \S+)?|mroute|neighbors|ospf(?: neighbor| interface)|route(?: (?:connected|static|ospf|\S+))?|pim (?:neighbor|interface))|mac address-table(?: (?:dynamic|secure|interface \S+))?|port-security(?: interface \S+)?|running-config(?: (?:interface \S+|\| section (?:interface|ipv6|ip route|nat|access-list|dhcp|router ospf|username|line vty|crypto|multicast)))?|spanning-tree(?: (?:vlan \d+|root|summary|interface \S+ detail))?|startup-config|users|version|vlan brief|vtp status|ip ssh|login|ntp associations|ptp clock|ppp multilink|glbp(?: brief)?|vrrp brief)|ping (?:[0-9a-f:.]+|\S+)|traceroute [0-9a-f:.]+|copy running-config startup-config|write memory|terminal (?:length \d+|monitor)|clear (?:counters|ip route|ipv6 route))$/.test(command);
  }

  if (mode === "config") {
    return /^(hostname [a-z0-9][a-z0-9.-]{0,62}|enable secret \S+|no ip domain-lookup|ip domain-name \S+|crypto key generate rsa modulus \d+|ip multicast-routing|ipv6 unicast-routing|ipv6 multicast-routing|vlan (?:[1-9]\d{0,3})|vtp (?:mode (?:server|client|transparent)|domain \S+|version [12]|password \S+)|interface (?:g\d+\/\d+(?:\.\d+)?|gigabitethernet ?\d+\/\d+|ethernet\d+\/\d+|eth\d+|loopback \d+|vlan \d+|port-channel ?\d+)|interface range .+|router (?:ospf|bgp) \d+|ipv6 router ospf \d+|ip dhcp (?:excluded-address [0-9.]+(?: [0-9.]+)?|pool \S+|snooping(?: vlan \d+)?)|ip arp inspection vlan \d+|line (?:vty \d+(?: \d+)?|console \d+)|ip access-list (?:standard|extended) \S+|object network \S+|access-list (?:\d+|\S+) (?:permit|deny|extended) .+|access-group \S+ in interface (?:outside|inside|dmz)|ip nat inside source list \d+ interface (?:g\d+\/\d+|gigabitethernet ?\d+\/\d+) overload|nat \(inside,outside\) dynamic interface|route (?:outside|inside|dmz) [0-9.]+ [0-9.]+ [0-9.]+|spanning-tree (?:mode (?:rapid-pvst|pvst)|vlan \d+(?:[,-]\d+)* (?:root (?:primary|secondary)|priority \d+))|username \S+ (?:privilege \d+ )?secret \S+|ip route [0-9.]+ [0-9.]+ [0-9.]+|ipv6 route [0-9a-f:]+\/\d+ [0-9a-f:]+|ip default-gateway [0-9.]+|mls qos|vpc domain \d+|peer-keepalive destination [0-9.]+|dot11 ssid \S+|wireless (?:channel \d+|band (?:2\.4ghz|5ghz)|power \d+)|ip slb .+|ntp server [0-9.]+|ptp mode (?:boundary|ordinary)|ip http (?:secure-(?:server|port \d+)|rate-limit \d+|authentication token-required)|ip vrf \S+)$/.test(command);
  }

  if (mode === "vlan") return /^(name [a-z0-9][a-z0-9 _.-]{0,31}|exit)$/.test(command);
  if (mode === "interface-range") return /^(description .+|switchport (?:mode (?:access|trunk)|access vlan \d+|trunk (?:native vlan \d+|allowed vlan .+))|channel-group \d+ mode (?:active|passive|on)|spanning-tree portfast|spanning-tree bpduguard enable|(?:no )?shutdown)$/.test(command);
  if (mode === "interface" || mode === "subinterface") {
    return /^(description .+|nameif (?:outside|inside|dmz)|security-level (?:0|[1-9]\d{0,2})|switchport (?:mode (?:access|trunk)|access vlan \d+|voice vlan \d+|trunk (?:native vlan \d+|allowed vlan .+)|port-security(?: (?:maximum \d+|violation (?:shutdown|restrict|protect)|mac-address sticky))?)|encapsulation (?:dot1q \d+(?: native)?|ppp)|ppp authentication chap|ip vrf forwarding \S+|ip address (?:dhcp|[0-9.]+ [0-9.]+)|ip helper-address [0-9.]+|ip nat (?:inside|outside)|ip access-group (?:\d+|\S+) (?:in|out)|ip pim sparse-mode|ip igmp join-group [0-9.]+|ipv6 address (?:[0-9a-f:]+\/\d+|[0-9a-f:]+ link-local)|ipv6 ospf \d+ area \d+|ipv6 pim(?: enable)?|ipv6 mld join-group [0-9a-f:]+|ipv6 nd prefix [0-9a-f:]+\/\d+|ip directed-broadcast|ip ospf (?:cost \d+|priority \d+|network (?:broadcast|point-to-point|non-broadcast)|hello-interval \d+|dead-interval \d+|retransmit-interval \d+|authentication(?: message-digest)?)|standby \d+ (?:ip [0-9.]+|priority \d+|preempt)|vrrp \d+ (?:ip [0-9.]+|priority \d+|preempt)|glbp \d+ (?:ip [0-9.]+|priority \d+|preempt|load-balancing (?:round-robin|weighted|host-dependent)|forwarder \d+|weighting \d+)|vpc peer-link|spanning-tree (?:portfast|bpduguard enable)|channel-group \d+ mode (?:active|passive|on)|(?:no )?shutdown)$/.test(command);
  }
  if (mode === "router") return /^(router-id [0-9.]+|network [0-9.]+ [0-9.]+ area \d+|passive-interface (?:default|loopback ?\d+|(?:g|gigabitethernet) ?\d+\/\d+)|ipv6 router ospf \d+|area \d+ (?:range (?:[0-9.]+ [0-9.]+|[0-9a-f:]+\/\d+)|stub|nssa|authentication(?: message-digest)?)|auto-cost reference-bandwidth \d+|timers throttle spf \d+ \d+ \d+|max-metric router-lsa|default-information originate)$/.test(command);
  if (mode === "bgp") return /^(bgp router-id [0-9.]+|neighbor [0-9.]+ (?:remote-as \d+|route-reflector-client)|network [0-9.]+ mask [0-9.]+)$/.test(command);
  if (mode === "dhcp") return /^(network [0-9.]+ [0-9.]+|default-router [0-9.]+|dns-server [0-9.]+|domain-name \S+|ipv6 dhcp (?:server|pool) \S+)$/.test(command);
  if (mode === "line") return /^(login(?: local)?|password \S+|transport input (?:ssh|telnet|all)|exec-timeout \d+ \d+|logging synchronous)$/.test(command);
  if (mode === "acl") return /^(permit|deny|remark) .+$/.test(command);
  if (mode === "object-network") return /^(subnet [0-9.]+ [0-9.]+|host [0-9.]+|nat \(inside,outside\) dynamic interface)$/.test(command);
  return false;
}

export function modePrompt(name: string, session: Session): string {
  const hostname = session.hostname || name;
  if (session.mode === "shell") return `${hostname.toLowerCase()}@range:~$`;
  if (session.mode === "user") return hostname + ">";
  if (session.mode === "privileged") return hostname + "#";
  if (session.mode === "config") return hostname + "(config)#";
  if (session.mode === "vlan") return hostname + "(config-vlan)#";
  if (session.mode === "interface-range") return hostname + "(config-if-range)#";
  if (session.mode === "subinterface") return hostname + "(config-subif)#";
  if (session.mode === "router") return hostname + "(config-router)#";
  if (session.mode === "bgp") return hostname + "(config-router)#";
  if (session.mode === "dhcp") return hostname + "(dhcp-config)#";
  if (session.mode === "line") return hostname + "(config-line)#";
  if (session.mode === "acl") return hostname + "(config-ext-nacl)#";
  if (session.mode === "object-network") return hostname + "(config-network-object)#";
  return hostname + "(config-if)#";
}

export function applyCommand(session: Session, command: string, history: string[]): Session {
  const typed = command.trim().replace(/\s+/g, " ");
  const canonical = normalizeCommand(typed);
  if (session.mode === 'interface-range' && session.context && !['exit', 'end'].includes(canonical)) {
    const range = session.context.match(/^(g\d+\/)(\d+)\s*-\s*(?:g\d+\/)?(\d+)$/);
    const ports = range ? Array.from({ length: Math.max(0, Math.min(96, Number(range[3]) - Number(range[2]) + 1)) }, (_, index) => `${range[1]}${Number(range[2]) + index}`) : session.context.split(',').map(port => port.trim());
    let next = session;
    for (const port of ports) next = applyCommand({ ...next, mode: 'interface', context: port }, command, history);
    return { ...next, mode: 'interface-range', context: session.context };
  }
  const transition = nextMode(canonical, session.mode, session.context);
  const next: Session = {
    ...session,
    simulationTick: (session.simulationTick || 0) + 1,
    hostname: session.mode === "config" && canonical.startsWith("hostname ")
      ? typed.slice("hostname ".length).trim()
      : session.hostname,
    mode: transition.mode,
    context: transition.context,
    history,
    settings: Object.fromEntries(Object.entries(session.settings || {}).map(([scope, values]) => [scope, { ...values }])),
    runningConfig: [...session.runningConfig],
    startupConfig: [...session.startupConfig],
    interfaces: Object.fromEntries(Object.entries(session.interfaces).map(([name, state]) => [name, { ...state, ipv4: [...state.ipv4], ipv6: [...state.ipv6], commands: [...state.commands], errors: { ...state.errors }, poe: { ...state.poe } }])),
      vlans: { ...session.vlans },
      fhrpGroups: Object.fromEntries(Object.entries(session.fhrpGroups || {}).map(([id, group]) => [id, { ...group }])),
      vtp: session.vtp ? { ...session.vtp } : undefined,
    attackTerminal: session.attackTerminal ? { selectedModule: session.attackTerminal.selectedModule, rhosts: session.attackTerminal.rhosts, executionLog: [...session.attackTerminal.executionLog], snmpValues: { ...session.attackTerminal.snmpValues }, containerRuntime: { ...session.attackTerminal.containerRuntime }, rangePhase: { ...session.attackTerminal.rangePhase }, rangeEvidence: [...(session.attackTerminal.rangeEvidence || [])] } : undefined,
    macTable: (session.macTable || []).map((entry) => ({ ...entry })),
    arpTable: (session.arpTable || []).map((entry) => ({ ...entry })),
    routingTable: (session.routingTable || []).map((entry) => ({ ...entry })),
    dhcpPools: Object.fromEntries(Object.entries(session.dhcpPools || {}).map(([name, pool]) => [name, { ...pool }])),
    dhcpLeases: (session.dhcpLeases || []).map((lease) => ({ ...lease })),
    dhcpExcludedAddresses: [...(session.dhcpExcludedAddresses || [])],
    dhcpClient: session.dhcpClient ? { ...session.dhcpClient } : undefined,
    transportFlows: (session.transportFlows || []).map((flow) => ({ ...flow })),
    dnsServerEnabled: session.dnsServerEnabled || false,
    dnsRecords: { ...(session.dnsRecords || {}) },
    dnsCache: { ...(session.dnsCache || {}) },
    ospfProcesses: Object.fromEntries(Object.entries(session.ospfProcesses || {}).map(([id, process]) => [id, ensureOspfOperational(process, session.simulationTick || 0)])),
  };

  // Preserve configuration by context and setting, so later edits replace values.
  if (!['user', 'privileged'].includes(session.mode) && !/^(exit|end|interface |router ospf |ipv6 router ospf |vlan |line |ip dhcp pool )/.test(canonical)) {
    const scope = `${session.mode}:${session.context || 'global'}`;
    const setting = canonical.match(/^(hostname|enable secret|ip domain-name|username \S+|transport input|login|password|wireless (?:channel|band|power)|dot11 ssid|switchport voice vlan|switchport port-security maximum|switchport port-security violation|spanning-tree vlan [\d,-]+ (?:priority|root)|ip route \S+ \S+|ipv6 route \S+|area \d+ stub|vpc domain|peer-keepalive destination|ip slb \S+)/)?.[1];
    if (setting) next.settings![scope] = { ...next.settings![scope], [setting]: canonical.slice(setting.length).trim() || 'enabled' };
  }

  if (canonical === "copy running-config startup-config" || canonical === "write memory") {
    next.startupConfig = [...next.runningConfig];
  }
  if (session.mode === 'config' && canonical.startsWith('ip default-gateway ')) {
    next.settings!['config:global'] = { ...next.settings!['config:global'], 'ip default-gateway': canonical.slice(19) };
  }
  if (session.mode === 'line' && canonical.startsWith('exec-timeout ')) {
    const scope = `line:${session.context}`;
    next.settings![scope] = { ...next.settings![scope], 'exec-timeout': canonical.slice(13) };
  }
  // VTP revision bookkeeping: creating a VLAN or renaming one changes the
  // VLAN database, so a server or transparent switch bumps its revision.
  // A client cannot change the database at all — the command is a no-op
  // (executeNetworkCommand surfaces the rejection message) and the
  // session stays in global configuration, as on real IOS.
  const vtpDefaults: VtpState = { mode: "server", domain: "", version: 1, password: "", revision: 0, lastModifiedBy: "0.0.0.0", lastModifiedAt: "0-0-00 00:00:00" };
  const bumpVtpRevision = () => {
    const current = next.vtp || vtpDefaults;
    const updater = Object.entries(next.interfaces)
      .map(([name, state]) => ({ vlan: Number(name.match(/^vlan (\d+)$/i)?.[1] || NaN), ip: state.ipv4[0]?.split(" ")[0] }))
      .filter((entry) => Number.isFinite(entry.vlan) && entry.ip)
      .sort((a, b) => a.vlan - b.vlan)[0];
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    next.vtp = {
      ...current,
      revision: current.revision + 1,
      lastModifiedBy: updater?.ip || "0.0.0.0",
      lastModifiedAt: `${now.getMonth() + 1}-${now.getDate()}-${String(now.getFullYear()).slice(2)} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    };
  };
  if (session.mode === "config" && canonical.startsWith("vlan ")) {
    const id = canonical.slice(5);
    if ((session.vtp?.mode || "server") === "client") {
      next.mode = "config";
      next.context = null;
    } else {
      const isNew = !(id in next.vlans);
      next.vlans[id] = next.vlans[id] || "default";
      if (isNew) bumpVtpRevision();
    }
  }
  if (session.mode === "vlan" && session.context && canonical.startsWith("name ")) {
    const name = typed.slice("name ".length).trim();
    if ((session.vtp?.mode || "server") !== "client" && next.vlans[session.context] !== name) {
      next.vlans[session.context] = name;
      bumpVtpRevision();
    }
  }
  if (session.mode === "config" && canonical.startsWith("vtp ")) {
    const current = next.vtp || vtpDefaults;
    next.vtp = { ...current };
    const mode = canonical.match(/^vtp mode (server|client|transparent)$/);
    if (mode) next.vtp.mode = mode[1] as VtpMode;
    const domain = canonical.match(/^vtp domain (\S+)$/);
    if (domain) {
      const name = typed.slice("vtp domain ".length).trim();
      if (name !== current.domain) {
        // Changing the domain resets the configuration revision, as on IOS.
        next.vtp.domain = name;
        next.vtp.revision = 0;
        next.vtp.lastModifiedBy = "0.0.0.0";
        next.vtp.lastModifiedAt = "0-0-00 00:00:00";
      }
    }
    const version = canonical.match(/^vtp version ([12])$/);
    if (version) next.vtp.version = Number(version[1]) as 1 | 2;
    const password = canonical.match(/^vtp password (\S+)$/);
    if (password) next.vtp.password = typed.slice("vtp password ".length).trim();
  }
  // Spanning-tree configuration is stored so `show spanning-tree` reflects
  // the configured mode, per-VLAN priority/root, and edge-port settings.
  // `spanning-tree mode mst` stays rejected by the grammar: MST is not
  // modeled, the same way VTPv3 is rejected rather than pretended.
  if (session.mode === "config" && canonical.startsWith("spanning-tree ")) {
    const current = next.stp || { mode: "pvst" as StpMode, vlanPriority: {}, vlanRoot: {}, portfast: {}, bpduguard: {} };
    next.stp = {
      mode: current.mode,
      vlanPriority: { ...current.vlanPriority },
      vlanRoot: { ...current.vlanRoot },
      portfast: { ...current.portfast },
      bpduguard: { ...current.bpduguard },
    };
    const stpMode = canonical.match(/^spanning-tree mode (pvst|rapid-pvst)$/);
    if (stpMode) next.stp.mode = stpMode[1] as StpMode;
    const stpRoot = canonical.match(/^spanning-tree vlan ([\d,-]+) root (primary|secondary)$/);
    if (stpRoot) {
      // A VLAN range applies the root role to every VLAN in the range.
      for (const id of Array.from(vlanMembers(stpRoot[1]))) {
        next.stp.vlanRoot[String(id)] = stpRoot[2] as "primary" | "secondary";
        next.stp.vlanPriority[String(id)] = stpRoot[2] === "primary" ? 24576 : 28672;
      }
    }
    const stpPriority = canonical.match(/^spanning-tree vlan ([\d,-]+) priority (\d+)$/);
    if (stpPriority) {
      for (const id of Array.from(vlanMembers(stpPriority[1]))) next.stp.vlanPriority[String(id)] = Number(stpPriority[2]);
    }
  }
  if ((session.mode === "interface" || session.mode === "subinterface") && session.context && canonical.startsWith("spanning-tree ")) {
    const ifname = session.context.replace(/^port-channel(\d+)$/, "port-channel $1");
    const current = next.stp || { mode: "pvst" as StpMode, vlanPriority: {}, vlanRoot: {}, portfast: {}, bpduguard: {} };
    next.stp = {
      mode: current.mode,
      vlanPriority: { ...current.vlanPriority },
      vlanRoot: { ...current.vlanRoot },
      portfast: { ...current.portfast },
      bpduguard: { ...current.bpduguard },
    };
    if (canonical === "spanning-tree portfast") next.stp.portfast[ifname] = true;
    if (canonical === "spanning-tree bpduguard enable") next.stp.bpduguard[ifname] = true;
  }
  if (session.mode === "config" && canonical.startsWith("ip dhcp pool ")) {
    const name = canonical.slice("ip dhcp pool ".length).trim();
    next.dhcpPools[name] = next.dhcpPools[name] || { name: typed.slice("ip dhcp pool ".length).trim() };
  }
  if (session.mode === "config" && canonical.startsWith("ip dhcp excluded-address ")) {
    const address = typed.slice("ip dhcp excluded-address ".length).trim();
    if (!next.dhcpExcludedAddresses.includes(address)) next.dhcpExcludedAddresses.push(address);
  }
  if (session.mode === "config" && canonical === "ip nat inside source list 1 interface g0/1 overload") {
    next.transportFlows = [...next.transportFlows.filter((flow) => flow.application !== "HTTPS / PAT"), {
      protocol: "TCP",
      application: "HTTPS / PAT",
      source: "192.168.40.10:51514",
      destination: "198.51.100.80:443",
      state: "ESTABLISHED",
      evidence: "modeled NAT overload flow",
    }];
  }
  if (session.mode === "config" && canonical === "ip dns server") next.dnsServerEnabled = true;
  if (session.mode === "config" && canonical.startsWith("ip host ")) {
    const parts = typed.slice("ip host ".length).trim().split(" ");
    if (parts.length === 2) next.dnsRecords[parts[0].toLowerCase()] = parts[1];
  }
  const ping = session.mode === "privileged" ? canonical.match(/^ping ([0-9.]+)$/) : null;
  if (ping) {
    const [interfaceName, interfaceState] = Object.entries(next.interfaces).find(([name, state]) => {
      const parentName = name.includes(".") ? name.split(".")[0] : null;
      const parent = parentName ? next.interfaces[parentName] : undefined;
      const operational = state.status === "up" && !state.shutdown || Boolean(parent && parent.status === "up" && !parent.shutdown && state.encapsulation === "dot1q");
      return operational && state.ipv4.length;
    }) || [];
    if (interfaceName && interfaceState) {
      const mac = modeledPeerMac(ping[1]);
      const vlan = interfaceState.vlanId ?? interfaceState.accessVlan ?? 1;
      const arpEntry = { ip: ping[1], mac, interface: interfaceName, age: 0 };
      const macEntry = { mac, port: interfaceName, vlan, type: "dynamic" as const, lastSeen: Date.now() };
      next.arpTable = [...next.arpTable.filter((entry) => entry.ip !== ping[1]), arpEntry];
      next.macTable = [...next.macTable.filter((entry) => !(entry.mac === mac && entry.port === interfaceName)), macEntry];
    }
  }
  if (session.mode === "config" && canonical.startsWith("router ospf ")) {
    const id = canonical.slice("router ospf ".length).trim();
    next.ospfProcesses[id] = next.ospfProcesses[id] || ospfProcessDefaults(Number(id), next.simulationTick);
  }
  if (session.mode === "config" && canonical.startsWith("ipv6 router ospf ")) {
    const id = canonical.slice("ipv6 router ospf ".length).trim();
    next.ospfProcesses[`v3:${id}`] = next.ospfProcesses[`v3:${id}`] || { ...ospfProcessDefaults(Number(id), next.simulationTick), addressFamily: 'ipv6' };
  }
  if (session.mode === "router" && (session.context?.startsWith("router ospf ") || session.context?.startsWith("ipv6 router ospf "))) {
    const ipv6 = session.context.startsWith('ipv6 router ospf ');
    const id = session.context.slice(ipv6 ? "ipv6 router ospf ".length : "router ospf ".length).trim();
    const key = ipv6 ? `v3:${id}` : id;
    const process = ensureOspfOperational(next.ospfProcesses[key] || { ...ospfProcessDefaults(Number(id), next.simulationTick), addressFamily: ipv6 ? 'ipv6' : 'ipv4' }, next.simulationTick || 0);
    if (canonical.startsWith("router-id ")) { process.routerId = typed.slice("router-id ".length).trim(); recordOspfEvent(process, next.simulationTick || 0, `Router ID set to ${process.routerId}`, true); }
    const network = canonical.match(/^network ([0-9.]+) ([0-9.]+) area (\d+)$/);
    if (network) {
      process.networks = [...process.networks.filter(item => item.network !== network[1] || item.wildcard !== network[2]), { network: network[1], wildcard: network[2], area: Number(network[3]) }];
      const area = network[3];
      process.areas![area] = process.areas![area] || { id: Number(area), type: 'normal', authentication: 'none', ranges: [] };
      recordOspfEvent(process, next.simulationTick || 0, `Network ${network[1]} ${network[2]} joined area ${area}`, true);
    }
    if (canonical.startsWith("passive-interface ")) {
      const passiveInterface = typed.slice("passive-interface ".length).trim();
      process.passiveInterfaces = Array.from(new Set([...(process.passiveInterfaces || []), passiveInterface]));
      recordOspfEvent(process, next.simulationTick || 0, `Passive interface ${passiveInterface}`, true);
    }
    const areaType = canonical.match(/^area (\d+) (stub|nssa)$/);
    if (areaType) { const area = process.areas![areaType[1]] || { id: Number(areaType[1]), type: 'normal' as const, authentication: 'none' as const, ranges: [] }; area.type = areaType[2] as 'stub' | 'nssa'; process.areas![areaType[1]] = area; recordOspfEvent(process, next.simulationTick || 0, `Area ${area.id} set to ${area.type}`, true); }
    const areaRange = canonical.match(/^area (\d+) range ([0-9.]+ [0-9.]+|[0-9a-f:]+\/\d+)$/);
    if (areaRange) { const area = process.areas![areaRange[1]] || { id: Number(areaRange[1]), type: 'normal' as const, authentication: 'none' as const, ranges: [] }; area.ranges = Array.from(new Set([...area.ranges, areaRange[2]])); process.areas![areaRange[1]] = area; recordOspfEvent(process, next.simulationTick || 0, `Area ${area.id} range ${areaRange[2]}`, true); }
    const areaAuthentication = canonical.match(/^area (\d+) authentication(?: (message-digest))?$/);
    if (areaAuthentication) { const area = process.areas![areaAuthentication[1]] || { id: Number(areaAuthentication[1]), type: 'normal' as const, authentication: 'none' as const, ranges: [] }; area.authentication = areaAuthentication[2] === 'message-digest' ? 'message-digest' : 'simple'; process.areas![areaAuthentication[1]] = area; recordOspfEvent(process, next.simulationTick || 0, `Area ${area.id} authentication ${area.authentication}`, true); }
    const reference = canonical.match(/^auto-cost reference-bandwidth (\d+)$/);
    if (reference) { process.referenceBandwidthMbps = Number(reference[1]); recordOspfEvent(process, next.simulationTick || 0, `Reference bandwidth ${reference[1]} Mbps`, true); }
    const spfTimers = canonical.match(/^timers throttle spf (\d+) (\d+) (\d+)$/);
    if (spfTimers) { process.timers = { ...process.timers!, spfInitialMs: Number(spfTimers[1]), spfHoldMs: Number(spfTimers[2]), spfMaxWaitMs: Number(spfTimers[3]) }; recordOspfEvent(process, next.simulationTick || 0, 'SPF throttle timers updated'); }
    if (canonical === 'max-metric router-lsa') { process.maxMetricRouterLsa = true; recordOspfEvent(process, next.simulationTick || 0, 'Maximum-metric Router-LSA enabled', true); }
    if (canonical === 'default-information originate') { process.defaultInformationOriginate = true; recordOspfEvent(process, next.simulationTick || 0, 'Default route origination enabled', true); }
    next.ospfProcesses[key] = process;
  }
  if (session.mode === "dhcp" && session.context) {
    const name = session.context.slice("ip dhcp pool ".length).trim();
    const pool = next.dhcpPools[name] || { name };
    if (canonical.startsWith("network ")) {
      const parts = typed.slice("network ".length).trim().split(" ");
      pool.network = parts[0];
      pool.mask = parts[1];
    }
    if (canonical.startsWith("default-router ")) pool.defaultRouter = typed.slice("default-router ".length).trim();
    if (canonical.startsWith("dns-server ")) pool.dnsServer = typed.slice("dns-server ".length).trim();
    if (canonical.startsWith("domain-name ")) pool.domainName = typed.slice("domain-name ".length).trim();
    next.dhcpPools[name] = pool;
  }
  if ((session.mode === "interface" || session.mode === "subinterface") && session.context) {
    const name = session.context;
    const state = next.interfaces[name] || { ipv4: [], ipv6: [], shutdown: true, commands: [], status: "down" as const, speed: "1000", duplex: "full" as const, errors: { crc: 0, collisions: 0 }, poe: { enabled: false, class: 0 as const, wattage: 0, state: "searching" as const } };
    if (canonical.startsWith("ip address ")) state.ipv4 = [typed.slice("ip address ".length)];
    if (canonical.startsWith("nameif ")) state.nameif = typed.slice("nameif ".length).trim();
    if (canonical.startsWith("security-level ")) state.securityLevel = Number(canonical.slice("security-level ".length));
    if (canonical === "ip address dhcp") {
      state.dhcpClient = true;
      state.ipv4 = [];
      next.transportFlows = [...next.transportFlows.filter((flow) => flow.application !== "DHCP"), {
        protocol: "UDP",
        application: "DHCP",
        source: "0.0.0.0:68",
        destination: "255.255.255.255:67",
        state: "DISCOVER",
        evidence: "modeled DHCP client request",
      }];
    }
    if (canonical.startsWith("ipv6 address ")) state.ipv6.push(typed.slice("ipv6 address ".length));
    const dot1q = canonical.match(/^encapsulation dot1q (\d+)$/);
    if (dot1q) { state.encapsulation = "dot1q"; state.vlanId = Number(dot1q[1]); }
    if (canonical === "no shutdown") { state.shutdown = false; state.status = "up"; }
    if (canonical === "shutdown") { state.shutdown = true; state.status = "down"; }
    if (canonical === "power inline auto") state.poe.enabled = true;
    if (canonical === "switchport mode access") state.switchportMode = "access";
    if (canonical === "switchport mode trunk") state.switchportMode = "trunk";
    if (canonical.startsWith("switchport access vlan ")) state.accessVlan = Number(canonical.slice("switchport access vlan ".length));
    if (canonical.startsWith("switchport trunk native vlan ")) state.nativeVlan = Number(canonical.slice("switchport trunk native vlan ".length));
    if (canonical.startsWith("switchport trunk allowed vlan ")) state.allowedVlans = applyAllowedVlans(state.allowedVlans, canonical.slice("switchport trunk allowed vlan ".length));
    const channelGroup = canonical.match(/^channel-group (\d+) mode (active|passive|on)$/);
    if (channelGroup) { state.channelGroup = Number(channelGroup[1]); state.channelMode = channelGroup[2] as "active" | "passive" | "on"; }
    const ospfCost = canonical.match(/^ip ospf cost (\d+)$/);
    if (ospfCost) state.ospfCost = Number(ospfCost[1]);
    const ospfPriority = canonical.match(/^ip ospf priority (\d+)$/);
    if (ospfPriority) state.ospfPriority = Number(ospfPriority[1]);
    const ospfNetwork = canonical.match(/^ip ospf network (broadcast|point-to-point|non-broadcast)$/);
    if (ospfNetwork) state.ospfNetworkType = ospfNetwork[1] as InterfaceState["ospfNetworkType"];
    const ospfHello = canonical.match(/^ip ospf hello-interval (\d+)$/);
    if (ospfHello) state.ospfHelloInterval = Number(ospfHello[1]);
    const ospfDead = canonical.match(/^ip ospf dead-interval (\d+)$/);
    if (ospfDead) state.ospfDeadInterval = Number(ospfDead[1]);
    const ospfRetransmit = canonical.match(/^ip ospf retransmit-interval (\d+)$/);
    if (ospfRetransmit) state.ospfRetransmitInterval = Number(ospfRetransmit[1]);
    if (canonical === 'ip ospf authentication') state.ospfAuthentication = 'simple';
    if (canonical === 'ip ospf authentication message-digest') state.ospfAuthentication = 'message-digest';
    if (/^ip ospf (?:cost|priority|network|hello-interval|dead-interval|retransmit-interval|authentication)/.test(canonical)) {
      for (const [id, configured] of Object.entries(next.ospfProcesses)) {
        const process = ensureOspfOperational(configured, next.simulationTick || 0);
        recordOspfEvent(process, next.simulationTick || 0, `${name}: ${canonical}`, /^(?:ip ospf (?:cost|network|authentication))/.test(canonical));
        next.ospfProcesses[id] = process;
      }
    }
    const ospfv3 = canonical.match(/^ipv6 ospf (\d+) area (\d+)$/);
    if (ospfv3) {
      const key = `v3:${ospfv3[1]}`;
      const process = ensureOspfOperational(next.ospfProcesses[key] || { ...ospfProcessDefaults(Number(ospfv3[1]), next.simulationTick), addressFamily: 'ipv6' }, next.simulationTick || 0);
      process.addressFamily = 'ipv6';
      process.ipv6Interfaces = { ...process.ipv6Interfaces, [name]: Number(ospfv3[2]) };
      process.areas![ospfv3[2]] = process.areas![ospfv3[2]] || { id: Number(ospfv3[2]), type: 'normal', authentication: 'none', ranges: [] };
      recordOspfEvent(process, next.simulationTick || 0, `${name} joined OSPFv3 area ${ospfv3[2]}`, true);
      next.ospfProcesses[key] = process;
    }
    const fhrp = canonical.match(/^(standby|vrrp|glbp) (\d+) (ip ([0-9.]+)|priority (\d+)|preempt|load-balancing (round-robin|weighted|host-dependent)|forwarder (\d+)|weighting (\d+))$/);
    if (fhrp) {
      const protocol = fhrp[1] === "standby" ? "HSRP" : fhrp[1] === "vrrp" ? "VRRP" : "GLBP";
      const key = `${name}:${protocol}:${fhrp[2]}`;
      const group = next.fhrpGroups[key] || { protocol, group: Number(fhrp[2]) };
      if (fhrp[4]) group.virtualIp = fhrp[4];
      if (fhrp[5]) group.priority = Number(fhrp[5]);
      if (fhrp[3] === "preempt") group.preempt = true;
      if (fhrp[6]) group.glbpLoadBalancing = fhrp[6] as FhrpGroup["glbpLoadBalancing"];
      if (fhrp[7]) group.glbpForwarder = Number(fhrp[7]);
      if (fhrp[8]) group.glbpWeight = Number(fhrp[8]);
      next.fhrpGroups[key] = group;
    }
    if (!canonical.startsWith("exit") && !canonical.startsWith("end")) state.commands.push(typed);
    if (!canonical.startsWith('interface ')) next.interfaces[name] = state;
  }
  if (session.mode === "config" && !["configure terminal", "end", "exit"].includes(canonical) && !canonical.startsWith("interface ")) next.runningConfig.push(typed);
  if ((session.mode === "interface" || session.mode === "subinterface") && !["end", "exit"].includes(canonical)) next.runningConfig.push(typed);
  if (session.mode === "acl" && !["end", "exit"].includes(canonical)) next.runningConfig.push(typed);
  if (session.mode === "router" && /^(?:area \d+ (?:stub|nssa|range .+|authentication(?: message-digest)?)|auto-cost reference-bandwidth \d+|timers throttle spf \d+ \d+ \d+|max-metric router-lsa|default-information originate)$/.test(canonical) && !next.runningConfig.includes(canonical)) next.runningConfig.push(canonical);
  if (session.mode === "bgp" && !["end", "exit"].includes(canonical)) {
    next.runningConfig.push(typed);
    const scope = `bgp:${session.context || 'global'}`;
    const setting = canonical.match(/^(bgp router-id|neighbor [0-9.]+ (?:remote-as|route-reflector-client)|network [0-9.]+ mask)/)?.[1];
    if (setting) next.settings![scope] = { ...next.settings![scope], [setting]: canonical.slice(setting.length).trim() || 'enabled' };
  }
  if (session.mode === "object-network" && !["end", "exit"].includes(canonical)) next.runningConfig.push(typed);
  return next;
}

export function nextMode(command: string, current: Mode, currentContext: string | null = null): { mode: Mode; context: string | null } {
  if (command === "enable") return { mode: "privileged", context: null };
  if (command === "disable") return { mode: "user", context: null };
  if (command === "configure terminal") return { mode: "config", context: null };
  if (command === "end") return { mode: "privileged", context: null };
  if (command === "exit") {
    if (current === "config") return { mode: "privileged", context: null };
    if (current === "vlan") return { mode: "config", context: null };
    if (current === "interface" || current === "subinterface") return { mode: "config", context: null };
    if (current === "router" || current === "bgp") return { mode: "config", context: null };
    if (current === "dhcp") return { mode: "config", context: null };
    if (current === "line") return { mode: "config", context: null };
    if (current === "acl") return { mode: "config", context: null };
    if (current === "object-network") return { mode: "config", context: null };
    if (current === "privileged" || current === "user") return { mode: current, context: null };
    return { mode: "config", context: null };
  }
  if (command.startsWith("vlan ")) return { mode: "vlan", context: command.slice(5) };
  if (command.startsWith("interface range ")) return { mode: "interface-range", context: command.slice(16) };
  if (command.startsWith("interface ")) {
    // Handle loopback interfaces
    if (command.includes("loopback")) return { mode: "interface", context: command.slice(10) };
    return { mode: command.includes(".") ? "subinterface" : "interface", context: command.slice(10) };
  }
  if (command.startsWith("ip access-list ")) return { mode: "acl", context: command };
  if (command.startsWith("object network ")) return { mode: "object-network", context: command };
  if (command.startsWith("ipv6 router ospf ")) return { mode: "router", context: command };
  if (command.startsWith("router ospf ")) return { mode: "router", context: command };
  if (command.startsWith("router bgp ")) return { mode: "bgp", context: command };
  if (command.startsWith("ip dhcp pool ")) return { mode: "dhcp", context: command };
  if (command.startsWith("line vty ") || command.startsWith("line console ")) return { mode: "line", context: command };
  if (command.startsWith("ip access-list ")) return { mode: "acl", context: command };
  return { mode: current, context: currentContext };
}
