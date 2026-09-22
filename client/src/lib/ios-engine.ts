/** Packet Observatory shared IOS model: one prompt, one mode machine, reused by curriculum labs and the free topology sandbox. */

export type Mode = "user" | "privileged" | "config" | "vlan" | "interface" | "interface-range" | "subinterface" | "router" | "dhcp" | "line" | "acl" | "object-network";

export type MacEntry = { mac: string; port: string; vlan: number; type: "dynamic" | "static"; lastSeen?: number };
export type ArpEntry = { ip: string; mac: string; interface: string; age: number };
export type Ipv6NeighborEntry = { ipv6: string; linkLocal?: string; mac: string; interface: string; state: "REACHABLE" | "STALE"; discovery: "NS/NA"; neighbor?: string };
export type Route = { prefix: string; nextHop?: string; interface?: string; protocol: "connected" | "static" | "ospf" };
export type DhcpPool = { name: string; network?: string; mask?: string; defaultRouter?: string; dnsServer?: string; domainName?: string };
export type DhcpLease = { mac: string; ip: string; clientId: string; state: "active" | "expired"; pool: string; leaseStart: string; leaseEnd: string };
export type OspfProcess = { id: number; routerId?: string; networks: { network: string; wildcard: string; area: number }[]; passiveInterfaces?: string[] };
export type FhrpGroup = { protocol: "HSRP" | "VRRP" | "GLBP"; group: number; virtualIp?: string; priority?: number; preempt?: boolean; state?: "active" | "standby" | "master" | "backup" };

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
};

export type DhcpClientState = { mac: string; interface: string; state: "INIT" | "OFFERED" | "BOUND" | "EXPIRED"; ip?: string; mask?: string; gateway?: string; dns?: string; poolName?: string; leaseStart?: string; leaseEnd?: string };

export type Session = {
  hostname: string;
  mode: Mode;
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
  dnsServerEnabled: boolean;
  dnsRecords: Record<string, string>;
  dnsCache: Record<string, string>;
  ospfProcesses: Record<string, OspfProcess>;
  fhrpGroups: Record<string, FhrpGroup>;
};

export function boot(name: string, role: string): Session {
  return {
    hostname: name,
    mode: "user",
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
    dnsServerEnabled: false,
    dnsRecords: {},
    dnsCache: {},
    ospfProcesses: {},
    fhrpGroups: {},
    history: [
      "Cisco IOS Software, CCNA Lab Simulator",
      `${name} · ${role}`,
      "Full IOS vocabulary · enter one command, then press Enter.",
    ],
  };
}

export function normalizeCommand(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
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

function modeledDeviceMac(name: string): string {
  const value = Array.from(name).reduce((sum, character) => ((sum * 33) + character.charCodeAt(0)) >>> 0, 0);
  return `02AA.${((value >>> 16) & 0xffff).toString(16).padStart(4, "0")}.${(value & 0xffff).toString(16).padStart(4, "0")}`.toUpperCase();
}

/** Learn host source MACs on active switch ports after a modeled host frame arrives. */
export function applyModeledLayer2Learning(sessions: Record<string, Session>, topology: ModeledTopology): Record<string, Session> {
  const devices = new Map((topology.devices || []).map((device) => [device.id, device]));
  const nameFor = (id: string) => devices.get(id)?.name || id;
  const next = Object.fromEntries(Object.entries(sessions).map(([name, session]) => [name, { ...session, macTable: [...(session.macTable || [])] }])) as Record<string, Session>;
  const learnedBySwitch = new Map<string, MacEntry[]>();
  const addLearned = (switchName: string, entry: MacEntry) => {
    const entries = learnedBySwitch.get(switchName) || [];
    learnedBySwitch.set(switchName, [...entries.filter((item) => !(item.mac === entry.mac && item.port === entry.port)), entry]);
  };
  const activePort = (deviceName: string, portName: string | undefined) => {
    const port = portName ? next[deviceName]?.interfaces[portName] : undefined;
    return Boolean(port && !port.shutdown && port.status === "up");
  };
  const allows = (port: InterfaceState, vlan: number) => !port.allowedVlans || port.allowedVlans.split(",").some((value) => value.trim() === String(vlan));
  for (const link of topology.links || []) {
    for (const [switchId, hostId, switchPort] of [[link.from, link.to, link.fromPort], [link.to, link.from, link.toPort]] as Array<[string, string, string | undefined]>) {
      if (devices.get(switchId)?.kind !== "switch" || devices.get(hostId)?.kind !== "pc" || !switchPort) continue;
      const switchSession = next[nameFor(switchId)];
      const port = switchSession?.interfaces[switchPort];
      if (!switchSession || !port || port.shutdown || port.status !== "up" || port.switchportMode !== "access") continue;
      const entry: MacEntry = { mac: modeledDeviceMac(nameFor(hostId)), port: switchPort, vlan: port.accessVlan ?? 1, type: "dynamic", lastSeen: Date.now() };
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
      if (subinterface && port && allows(port, subinterface.vlanId!)) addLearned(toName, { mac: modeledDeviceMac(fromName), port: link.toPort!, vlan: subinterface.vlanId!, type: "dynamic", lastSeen: Date.now() });
    }
    if (to?.kind === "router" && from?.kind === "switch" && activePort(toName, link.toPort) && activePort(fromName, link.fromPort)) {
      const subinterface = Object.values(next[toName]?.interfaces || {}).find((state) => state.vlanId !== undefined && state.ipv4.length);
      const port = link.fromPort ? next[fromName]?.interfaces[link.fromPort] : undefined;
      if (subinterface && port && allows(port, subinterface.vlanId!)) addLearned(fromName, { mac: modeledDeviceMac(toName), port: link.fromPort!, vlan: subinterface.vlanId!, type: "dynamic", lastSeen: Date.now() });
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
      for (const entry of learnedBySwitch.get(fromName) || []) if (allows(toPort, entry.vlan)) addLearned(toName, { ...entry, port: link.toPort!, lastSeen: Date.now() });
      for (const entry of learnedBySwitch.get(toName) || []) if (allows(fromPort, entry.vlan)) addLearned(fromName, { ...entry, port: link.fromPort!, lastSeen: Date.now() });
    }
  }
  Array.from(learnedBySwitch.entries()).forEach(([switchName, entries]) => { next[switchName].macTable = entries; });
  return next;
}

/**
 * Deliberately small IOS command grammar used by both the guided labs and the
 * free sandbox. A command must be valid for the current EXEC/configuration
 * mode before the lab sequence is allowed to consider it.
 */
export function isCiscoCommand(command: string, mode: Mode): boolean {
  if (command === "enable") return mode === "user";
  if (command === "disable") return mode === "privileged";
  if (command === "configure terminal") return mode === "privileged";
  if (command === "end") return mode !== "user";
  if (command === "exit") return mode !== "user";
  if (mode === "user") return false;

  if (mode === "privileged" && (command === "show hosts" || command === "show ip ospf database" || command === "show access-list" || command === "show xlate" || command === "show conn" || command === "show interface ip brief" || /^nslookup \S+$/.test(command))) return true;
  if (mode === "config" && (/^ip dns server$/.test(command) || /^ip host \S+ [0-9.]+$/.test(command))) return true;
  if ((mode === "interface" || mode === "subinterface") && command === "power inline auto") return true;

  if (mode === "privileged") {
    return /^(show (access-lists(?: \S+)?|arp|cdp neighbors(?: detail)?|clock|controllers|crypto key mypubkey rsa|etherchannel summary|interfaces(?: (?:g\d+\/\d+(?:\.\d+)?(?: switchport)?|gigabitethernet ?\d+\/\d+(?: switchport)?|port-channel ?\d+(?: switchport)?|status|trunk|counters errors|switchport))?|ip (?:dhcp (?:binding|conflict|pool|server statistics)|interface(?: brief| \S+)?|mroute|nat (?:translations(?: verbose)?|statistics)|ospf(?: neighbor| interface(?: brief| \S+)?)?|pim (?:neighbor|interface)|protocols|route(?: (?:connected|static|ospf|\S+))?)|ipv6 (?:interface(?: brief| \S+)?|mroute|neighbors|ospf(?: neighbor| interface)|route(?: (?:connected|static|ospf|\S+))?|pim (?:neighbor|interface))|mac address-table(?: (?:dynamic|secure|interface \S+))?|port-security(?: interface \S+)?|running-config(?: (?:interface \S+|\| section (?:interface|ipv6|ip route|nat|access-list|dhcp|router ospf|username|line vty|crypto|multicast)))?|spanning-tree(?: (?:vlan \d+|root|summary|interface \S+ detail))?|startup-config|users|version|vlan brief|ip ssh|login)|ping (?:[0-9a-f:.]+|\S+)|traceroute [0-9a-f:.]+|copy running-config startup-config|write memory|terminal (?:length \d+|monitor)|clear (?:counters|ip route|ipv6 route))$/.test(command);
  }

  if (mode === "config") {
    return /^(hostname [a-z0-9][a-z0-9.-]{0,62}|enable secret \S+|no ip domain-lookup|ip domain-name \S+|crypto key generate rsa modulus \d+|ip multicast-routing|ipv6 unicast-routing|ipv6 multicast-routing|vlan (?:[1-9]\d{0,3})|interface (?:g\d+\/\d+(?:\.\d+)?|gigabitethernet ?\d+\/\d+|ethernet\d+\/\d+|eth\d+|loopback \d+|vlan \d+|port-channel ?\d+)|interface range .+|router ospf \d+|ipv6 router ospf \d+|ip dhcp (?:excluded-address [0-9.]+(?: [0-9.]+)?|pool \S+)|line (?:vty \d+(?: \d+)?|console \d+)|ip access-list (?:standard|extended) \S+|object network \S+|access-list (?:\d+|\S+) (?:permit|deny|extended) .+|access-group \S+ in interface (?:outside|inside|dmz)|ip nat inside source list \d+ interface (?:g\d+\/\d+|gigabitethernet ?\d+\/\d+) overload|nat \(inside,outside\) dynamic interface|route (?:outside|inside|dmz) [0-9.]+ [0-9.]+ [0-9.]+|spanning-tree (?:mode (?:rapid-pvst|pvst)|vlan \d+ (?:root (?:primary|secondary)|priority \d+))|username \S+ (?:privilege \d+ )?secret \S+|ip route [0-9.]+ [0-9.]+ [0-9.]+|ipv6 route [0-9a-f:]+\/\d+ [0-9a-f:]+|ip default-gateway [0-9.]+)$/.test(command);
  }

  if (mode === "vlan") return /^(name [a-z0-9][a-z0-9 _.-]{0,31}|exit)$/.test(command);
  if (mode === "interface-range") return /^(description .+|switchport (?:mode (?:access|trunk)|access vlan \d+|trunk (?:native vlan \d+|allowed vlan .+))|channel-group \d+ mode (?:active|passive|on)|spanning-tree portfast|spanning-tree bpduguard enable|(?:no )?shutdown)$/.test(command);
  if (mode === "interface" || mode === "subinterface") {
    return /^(description .+|nameif (?:outside|inside|dmz)|security-level (?:0|[1-9]\d{0,2})|switchport (?:mode (?:access|trunk)|access vlan \d+|trunk (?:native vlan \d+|allowed vlan .+)|port-security(?: (?:maximum \d+|violation (?:shutdown|restrict|protect)|mac-address sticky))?)|encapsulation dot1q \d+(?: native)?|ip address (?:dhcp|[0-9.]+ [0-9.]+)|ip helper-address [0-9.]+|ip nat (?:inside|outside)|ip access-group (?:\d+|\S+) (?:in|out)|ip pim sparse-mode|ipv6 address (?:[0-9a-f:]+\/\d+|[0-9a-f:]+ link-local)|ipv6 ospf \d+ area \d+|ipv6 pim(?: enable)?|ipv6 mld join-group [0-9a-f:]+|ip igmp join-group [0-9.]+|ipv6 nd prefix [0-9a-f:]+\/\d+|ip directed-broadcast|ip ospf (?:cost \d+|priority \d+|network (?:broadcast|point-to-point|non-broadcast))|standby \d+ (?:ip [0-9.]+|priority \d+|preempt)|vrrp \d+ (?:ip [0-9.]+|priority \d+|preempt)|glbp \d+ (?:ip [0-9.]+|priority \d+|preempt)|spanning-tree (?:portfast|bpduguard enable)|channel-group \d+ mode (?:active|passive|on)|(?:no )?shutdown)$/.test(command);
  }
  if (mode === "router") return /^(router-id [0-9.]+|network [0-9.]+ [0-9.]+ area \d+|passive-interface (?:default|loopback ?\d+|(?:g|gigabitethernet) ?\d+\/\d+)|ipv6 router ospf \d+|area \d+ (?:range [0-9a-f:]+\/\d+|stub)|default-information originate)$/.test(command);
  if (mode === "dhcp") return /^(network [0-9.]+ [0-9.]+|default-router [0-9.]+|dns-server [0-9.]+|domain-name \S+|ipv6 dhcp (?:server|pool) \S+)$/.test(command);
  if (mode === "line") return /^(login(?: local)?|password \S+|transport input (?:ssh|telnet|all)|exec-timeout \d+ \d+|logging synchronous)$/.test(command);
  if (mode === "acl") return /^(permit|deny|remark) .+$/.test(command);
  if (mode === "object-network") return /^(subnet [0-9.]+ [0-9.]+|host [0-9.]+|nat \(inside,outside\) dynamic interface)$/.test(command);
  return false;
}

export function modePrompt(name: string, session: Session): string {
  const hostname = session.hostname || name;
  if (session.mode === "user") return hostname + ">";
  if (session.mode === "privileged") return hostname + "#";
  if (session.mode === "config") return hostname + "(config)#";
  if (session.mode === "vlan") return hostname + "(config-vlan)#";
  if (session.mode === "interface-range") return hostname + "(config-if-range)#";
  if (session.mode === "subinterface") return hostname + "(config-subif)#";
  if (session.mode === "router") return hostname + "(config-router)#";
  if (session.mode === "dhcp") return hostname + "(dhcp-config)#";
  if (session.mode === "line") return hostname + "(config-line)#";
  if (session.mode === "acl") return hostname + "(config-ext-nacl)#";
  if (session.mode === "object-network") return hostname + "(config-network-object)#";
  return hostname + "(config-if)#";
}

export function applyCommand(session: Session, command: string, history: string[]): Session {
  const typed = command.trim().replace(/\s+/g, " ");
  const canonical = normalizeCommand(typed);
  const transition = nextMode(canonical, session.mode, session.context);
  const next: Session = {
    ...session,
    hostname: session.mode === "config" && canonical.startsWith("hostname ")
      ? typed.slice("hostname ".length).trim()
      : session.hostname,
    mode: transition.mode,
    context: transition.context,
    history,
    runningConfig: [...session.runningConfig],
    startupConfig: [...session.startupConfig],
    interfaces: Object.fromEntries(Object.entries(session.interfaces).map(([name, state]) => [name, { ...state, ipv4: [...state.ipv4], ipv6: [...state.ipv6], commands: [...state.commands], errors: { ...state.errors }, poe: { ...state.poe } }])),
    vlans: { ...session.vlans },
    macTable: (session.macTable || []).map((entry) => ({ ...entry })),
    arpTable: (session.arpTable || []).map((entry) => ({ ...entry })),
    routingTable: (session.routingTable || []).map((entry) => ({ ...entry })),
    dhcpPools: Object.fromEntries(Object.entries(session.dhcpPools || {}).map(([name, pool]) => [name, { ...pool }])),
    dhcpLeases: (session.dhcpLeases || []).map((lease) => ({ ...lease })),
    dhcpExcludedAddresses: [...(session.dhcpExcludedAddresses || [])],
    dhcpClient: session.dhcpClient ? { ...session.dhcpClient } : undefined,
    dnsServerEnabled: session.dnsServerEnabled || false,
    dnsRecords: { ...(session.dnsRecords || {}) },
    dnsCache: { ...(session.dnsCache || {}) },
    ospfProcesses: Object.fromEntries(Object.entries(session.ospfProcesses || {}).map(([id, process]) => [id, { ...process, networks: [...process.networks], passiveInterfaces: [...(process.passiveInterfaces || [])] }])),
  };

  if (canonical === "copy running-config startup-config" || canonical === "write memory") {
    next.startupConfig = [...next.runningConfig];
  }
  if (session.mode === "config" && canonical.startsWith("vlan ")) {
    next.vlans[canonical.slice(5)] = next.vlans[canonical.slice(5)] || "default";
  }
  if (session.mode === "vlan" && session.context && canonical.startsWith("name ")) {
    next.vlans[session.context] = typed.slice("name ".length).trim();
  }
  if (session.mode === "config" && canonical.startsWith("ip dhcp pool ")) {
    const name = canonical.slice("ip dhcp pool ".length).trim();
    next.dhcpPools[name] = next.dhcpPools[name] || { name: typed.slice("ip dhcp pool ".length).trim() };
  }
  if (session.mode === "config" && canonical.startsWith("ip dhcp excluded-address ")) {
    const address = typed.slice("ip dhcp excluded-address ".length).trim();
    if (!next.dhcpExcludedAddresses.includes(address)) next.dhcpExcludedAddresses.push(address);
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
    next.ospfProcesses[id] = next.ospfProcesses[id] || { id: Number(id), networks: [] };
  }
  if (session.mode === "router" && session.context?.startsWith("router ospf ")) {
    const id = session.context.slice("router ospf ".length).trim();
    const process = next.ospfProcesses[id] || { id: Number(id), networks: [], passiveInterfaces: [] };
    if (canonical.startsWith("router-id ")) process.routerId = typed.slice("router-id ".length).trim();
    const network = canonical.match(/^network ([0-9.]+) ([0-9.]+) area (\d+)$/);
    if (network && !process.networks.some((item) => item.network === network[1] && item.wildcard === network[2] && item.area === Number(network[3]))) process.networks.push({ network: network[1], wildcard: network[2], area: Number(network[3]) });
    if (canonical.startsWith("passive-interface ")) {
      const passiveInterface = typed.slice("passive-interface ".length).trim();
      if (!process.passiveInterfaces?.includes(passiveInterface)) process.passiveInterfaces?.push(passiveInterface);
    }
    next.ospfProcesses[id] = process;
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
    if (canonical.startsWith("ip address ")) state.ipv4.push(typed.slice("ip address ".length));
    if (canonical.startsWith("nameif ")) state.nameif = typed.slice("nameif ".length).trim();
    if (canonical.startsWith("security-level ")) state.securityLevel = Number(canonical.slice("security-level ".length));
    if (canonical === "ip address dhcp") { state.dhcpClient = true; state.ipv4 = []; }
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
    if (canonical.startsWith("switchport trunk allowed vlan ")) state.allowedVlans = typed.slice("switchport trunk allowed vlan ".length);
    const channelGroup = canonical.match(/^channel-group (\d+) mode (active|passive|on)$/);
    if (channelGroup) { state.channelGroup = Number(channelGroup[1]); state.channelMode = channelGroup[2] as "active" | "passive" | "on"; }
    const ospfCost = canonical.match(/^ip ospf cost (\d+)$/);
    if (ospfCost) state.ospfCost = Number(ospfCost[1]);
    const ospfPriority = canonical.match(/^ip ospf priority (\d+)$/);
    if (ospfPriority) state.ospfPriority = Number(ospfPriority[1]);
    const ospfNetwork = canonical.match(/^ip ospf network (broadcast|point-to-point|non-broadcast)$/);
    if (ospfNetwork) state.ospfNetworkType = ospfNetwork[1] as InterfaceState["ospfNetworkType"];
    const fhrp = canonical.match(/^(standby|vrrp|glbp) (\d+) (ip ([0-9.]+)|priority (\d+)|preempt)$/);
    if (fhrp) {
      const protocol = fhrp[1] === "standby" ? "HSRP" : fhrp[1] === "vrrp" ? "VRRP" : "GLBP";
      const key = `${name}:${protocol}:${fhrp[2]}`;
      const group = next.fhrpGroups[key] || { protocol, group: Number(fhrp[2]) };
      if (fhrp[4]) group.virtualIp = fhrp[4];
      if (fhrp[5]) group.priority = Number(fhrp[5]);
      if (fhrp[3] === "preempt") group.preempt = true;
      next.fhrpGroups[key] = group;
    }
    if (!canonical.startsWith("exit") && !canonical.startsWith("end")) state.commands.push(typed);
    next.interfaces[name] = state;
  }
  if (session.mode === "config" && !["configure terminal", "end", "exit"].includes(canonical) && !canonical.startsWith("interface ")) next.runningConfig.push(typed);
  if ((session.mode === "interface" || session.mode === "subinterface") && !["end", "exit"].includes(canonical)) next.runningConfig.push(typed);
  if (session.mode === "acl" && !["end", "exit"].includes(canonical)) next.runningConfig.push(typed);
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
    if (current === "router") return { mode: "config", context: null };
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
  if (command.startsWith("ip dhcp pool ")) return { mode: "dhcp", context: command };
  if (command.startsWith("line vty ") || command.startsWith("line console ")) return { mode: "line", context: command };
  if (command.startsWith("ip access-list ")) return { mode: "acl", context: command };
  return { mode: current, context: currentContext };
}
