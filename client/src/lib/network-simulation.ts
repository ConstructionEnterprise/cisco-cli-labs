import { boot, modePrompt, nextMode, normalizeCommand, type Mode, type Session } from "@/lib/ios-engine";

export type DeviceKind = "pc" | "switch" | "router";
export type CableType = "copper" | "fiber";
export type InterfaceMode = "access" | "trunk" | "routed" | "loopback" | "subinterface";
export type LinkStatus = "up" | "down" | "incompatible";

export type InterfaceModel = {
  name: string;
  type: "ethernet" | "loopback" | "subinterface" | "port-channel";
  adminUp: boolean;
  mode: InterfaceMode;
  accessVlan: number | null;
  nativeVlan: number;
  allowedVlans: number[];
  ipv4: string[];
  ipv6: string[];
  description: string;
  peer: { deviceId: string; interfaceName: string } | null;
  portChannel: number | null;
  encapsulationVlan: number | null;
  encapsulationNative: boolean;
}

export type DeviceModel = {
  id: string;
  name: string;
  kind: DeviceKind;
  role: string;
  site: string;
  platform: string;
  x: number;
  y: number;
  interfaces: Record<string, InterfaceModel>;
  vlans: Record<number, { id: number; name: string }>;
  spanningTree: { mode: "rapid-pvst" | "pvst" | "stp"; rootPrimary: number[] };
  host: { ipv4: string | null; ipv6: string | null; vlan: number | null; gateway4: string | null; gateway6: string | null } | null;
}

export type PhysicalLink = {
  id: string;
  a: { deviceId: string; interfaceName: string };
  b: { deviceId: string; interfaceName: string };
  cable: CableType;
  status: LinkStatus;
  portChannel: number | null;
}

export type EtherChannelModel = { group: number; protocol: "LACP" | "PAgP" | "static"; members: string[]; operational: boolean; trunk: boolean; nativeVlan: number; allowedVlans: number[] };
export type VlanModel = { id: number; name: string; members: string[] };
export type Route = { family: "ipv4" | "ipv6"; prefix: string; deviceId: string; protocol: "C" | "L" | "S" | "O"; nextHop: string | null; interfaceName: string };
export type DerivedState = { interfaceStatus: Record<string, "administratively down" | "down" | "up/up">; routes: Route[]; neighbors: string[]; macTable: { vlan: number; mac: string; deviceId: string; interfaceName: string }[]; vlanReachability: { source: string; destination: string; vlan: number; reachable: boolean; reason: string }[] };

export type SimulationState = {
  scenarioName: string;
  scenarioDescription: string;
  devices: Record<string, DeviceModel>;
  links: Record<string, PhysicalLink>;
  vlans: Record<number, VlanModel>;
  etherChannels: Record<number, EtherChannelModel>;
  sessions: Record<string, Session>;
  derived: DerivedState;
};

export type SimulationResult = { state: SimulationState; output: string[]; accepted: boolean; error?: string };

const VLAN_NAMES: Record<number, string> = { 10: "CE-HQ-ENGINEERING", 20: "FTF-PRODUCTION", 99: "CE-NET-MANAGEMENT", 999: "CE-NATIVE-BLACKHOLE" };
const DEFAULT_ALLOWED = [10, 20, 99, 999];

function intf(name: string, kind: InterfaceModel["type"] = "ethernet"): InterfaceModel {
  return { name, type: kind, adminUp: false, mode: kind === "loopback" ? "loopback" : "routed", accessVlan: null, nativeVlan: 1, allowedVlans: [...DEFAULT_ALLOWED], ipv4: [], ipv6: [], description: "", peer: null, portChannel: null, encapsulationVlan: null, encapsulationNative: false };
}
function device(id: string, name: string, kind: DeviceKind, role: string, site: string, x: number, y: number, ports: string[]): DeviceModel {
  const interfaces = Object.fromEntries(ports.map((port) => [port, intf(port)]));
  if (kind === "pc" && interfaces.eth0) interfaces.eth0.adminUp = true;
  return { id, name, kind, role, site, platform: kind === "router" ? "IOS Router" : kind === "switch" ? "IOS Layer 2 Switch" : "IOS Host", x, y, interfaces, vlans: {}, spanningTree: { mode: "stp", rootPrimary: [] }, host: kind === "pc" ? { ipv4: null, ipv6: null, vlan: null, gateway4: null, gateway6: null } : null };
}

export function createHeadquartersFactorySimulation(): SimulationState {
  const devices: Record<string, DeviceModel> = {
    "ce-hq-eng": device("ce-hq-eng", "CE-HQ-ENG-PC1", "pc", "Engineering endpoint", "Headquarters", 70, 235, ["eth0"]),
    "ce-hq-dsw": device("ce-hq-dsw", "CE-HQ-DSW1", "switch", "Headquarters distribution switch", "Headquarters", 320, 180, ["FastEthernet0/1", "GigabitEthernet0/2", "GigabitEthernet0/3", "GigabitEthernet0/4"]),
    "ce-hq-r1": device("ce-hq-r1", "CE-HQ-R1", "router", "Headquarters edge router", "Headquarters", 610, 90, ["GigabitEthernet0/0", "GigabitEthernet0/0.10", "GigabitEthernet0/0.20", "GigabitEthernet0/1"]),
    "ftf-acc": device("ftf-acc", "FTF-FAB-ACC1", "switch", "Factory access switch", "Factory to Foundation", 610, 340, ["FastEthernet0/1", "GigabitEthernet0/2", "GigabitEthernet0/3", "GigabitEthernet0/4"]),
    "ftf-prod": device("ftf-prod", "FTF-PROD-PC1", "pc", "Production endpoint", "Factory to Foundation", 910, 360, ["eth0"]),
  };
  const links: Record<string, PhysicalLink> = {
    "link-eng": { id: "link-eng", a: { deviceId: "ce-hq-eng", interfaceName: "eth0" }, b: { deviceId: "ce-hq-dsw", interfaceName: "FastEthernet0/1" }, cable: "copper", status: "up", portChannel: null },
    "link-core": { id: "link-core", a: { deviceId: "ce-hq-dsw", interfaceName: "GigabitEthernet0/4" }, b: { deviceId: "ce-hq-r1", interfaceName: "GigabitEthernet0/0" }, cable: "copper", status: "up", portChannel: null },
    "link-factory": { id: "link-factory", a: { deviceId: "ce-hq-dsw", interfaceName: "GigabitEthernet0/2" }, b: { deviceId: "ftf-acc", interfaceName: "GigabitEthernet0/2" }, cable: "copper", status: "up", portChannel: 1 },
    "link-factory-2": { id: "link-factory-2", a: { deviceId: "ce-hq-dsw", interfaceName: "GigabitEthernet0/3" }, b: { deviceId: "ftf-acc", interfaceName: "GigabitEthernet0/3" }, cable: "copper", status: "up", portChannel: 1 },
    "link-prod": { id: "link-prod", a: { deviceId: "ftf-acc", interfaceName: "FastEthernet0/1" }, b: { deviceId: "ftf-prod", interfaceName: "eth0" }, cable: "copper", status: "up", portChannel: null },
  };
  for (const link of Object.values(links)) {
    devices[link.a.deviceId].interfaces[link.a.interfaceName].peer = link.b;
    devices[link.b.deviceId].interfaces[link.b.interfaceName].peer = link.a;
  }
  devices["ce-hq-eng"].host = { ipv4: "192.168.10.10/24", ipv6: "2001:db8:10::10/64", vlan: 10, gateway4: "192.168.10.1", gateway6: "2001:db8:10::1" };
  devices["ftf-prod"].host = { ipv4: "192.168.20.10/24", ipv6: "2001:db8:20::10/64", vlan: 20, gateway4: "192.168.20.1", gateway6: "2001:db8:20::1" };
  const sessions = Object.fromEntries(Object.values(devices).map((d) => [d.id, boot(d.name, d.role)]));
  return derive({ scenarioName: "Headquarters → Factory to Foundation", scenarioDescription: "Deterministic Construction Enterprises switching and routing sandbox.", devices, links, vlans: {}, etherChannels: {}, sessions, derived: emptyDerived() });
}

export function createCurriculumSimulation(deviceDefinitions: { name: string; role: string }[], scenarioName: string, scenarioDescription: string): SimulationState {
  const devices: Record<string, DeviceModel> = {};
  deviceDefinitions.forEach((definition, index) => {
    const role = definition.role.toLowerCase(); const kind: DeviceKind = role.includes("switch") ? "switch" : role.includes("router") || role.includes("edge") ? "router" : "pc";
    const ports = kind === "pc" ? ["eth0"] : kind === "switch" ? ["FastEthernet0/1", "GigabitEthernet0/2", "GigabitEthernet0/3", "GigabitEthernet0/4"] : ["GigabitEthernet0/0", "GigabitEthernet0/0.10", "GigabitEthernet0/0.20", "GigabitEthernet0/1"];
    const id = `curriculum-${index}-${definition.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    devices[id] = device(id, definition.name, kind, definition.role, definition.name.includes("FTF") ? "Factory to Foundation" : "Headquarters", 100 + index * 260, 120 + (index % 2) * 180, ports);
  });
  const ordered = Object.values(devices); const links: Record<string, PhysicalLink> = {};
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const left = ordered[index]; const right = ordered[index + 1];
    const leftIsPc = left.kind === "pc"; const rightIsPc = right.kind === "pc";
    const leftInterface = leftIsPc ? "eth0" : rightIsPc ? (left.kind === "switch" ? "FastEthernet0/1" : "GigabitEthernet0/0") : left.kind === "switch" && right.kind === "switch" ? "GigabitEthernet0/2" : "GigabitEthernet0/4";
    const rightInterface = rightIsPc ? "eth0" : leftIsPc ? (right.kind === "switch" ? "FastEthernet0/1" : "GigabitEthernet0/0") : right.kind === "switch" && left.kind === "switch" ? "GigabitEthernet0/2" : "GigabitEthernet0/0";
    if (!left.interfaces[leftInterface] || !right.interfaces[rightInterface]) continue;
    const linkId = `curriculum-link-${index + 1}`; links[linkId] = { id: linkId, a: { deviceId: left.id, interfaceName: leftInterface }, b: { deviceId: right.id, interfaceName: rightInterface }, cable: "copper", status: "up", portChannel: null };
    left.interfaces[leftInterface].peer = links[linkId].b; right.interfaces[rightInterface].peer = links[linkId].a;
  }
  const sessions = Object.fromEntries(Object.values(devices).map((current) => [current.id, boot(current.name, current.role)]));
  return derive({ scenarioName, scenarioDescription, devices, links, vlans: {}, etherChannels: {}, sessions, derived: emptyDerived() });
}

export function createBlankSimulation(): SimulationState { return derive({ scenarioName: "Untitled Construction Network", scenarioDescription: "Blank topology for the next CCNA objective.", devices: {}, links: {}, vlans: {}, etherChannels: {}, sessions: {}, derived: emptyDerived() }); }
export function cloneSimulation(state: SimulationState): SimulationState { return JSON.parse(JSON.stringify(state)) as SimulationState; }
function emptyDerived(): DerivedState { return { interfaceStatus: {}, routes: [], neighbors: [], macTable: [], vlanReachability: [] }; }
function linkFor(state: SimulationState, deviceId: string, interfaceName: string) { return Object.values(state.links).find((l) => (l.a.deviceId === deviceId && l.a.interfaceName === interfaceName) || (l.b.deviceId === deviceId && l.b.interfaceName === interfaceName)); }
function endpoint(state: SimulationState, link: PhysicalLink, deviceId: string) { return link.a.deviceId === deviceId ? link.b : link.a; }
function operational(state: SimulationState, deviceId: string, name: string): boolean {
  const d = state.devices[deviceId]; const i = d?.interfaces[name]; if (!i || !i.adminUp) return false;
  if (i.type === "loopback") return true;
  if (i.type === "subinterface") { const parent = name.split(".")[0]; return operational(state, deviceId, parent); }
  if (i.type === "port-channel") { const group = Number(name.replace(/\D/g, "")); const channel = state.etherChannels[group]; return Boolean(channel?.operational); }
  const l = linkFor(state, deviceId, name); return Boolean(l && l.status === "up");
}
function cidrPrefix(address: string): string { const [ip, bits] = address.split("/"); return `${ip}/${bits ?? (ip.includes(":") ? 128 : 32)}`; }
function derive(state: SimulationState): SimulationState {
  const interfaceStatus: DerivedState["interfaceStatus"] = {};
  const routes: Route[] = [];
  const macTable: DerivedState["macTable"] = [];
  const vlans: Record<number, VlanModel> = {};
  for (const d of Object.values(state.devices)) {
    for (const i of Object.values(d.interfaces)) {
      interfaceStatus[`${d.id}:${i.name}`] = !i.adminUp ? "administratively down" : operational(state, d.id, i.name) ? "up/up" : "down";
      for (const ip of i.ipv4) routes.push({ family: "ipv4", prefix: cidrPrefix(ip), deviceId: d.id, protocol: "C", nextHop: null, interfaceName: i.name });
      for (const ip of i.ipv6) routes.push({ family: "ipv6", prefix: cidrPrefix(ip), deviceId: d.id, protocol: "C", nextHop: null, interfaceName: i.name });
      if (d.kind === "switch" && i.accessVlan) { vlans[i.accessVlan] ??= { id: i.accessVlan, name: d.vlans[i.accessVlan]?.name ?? VLAN_NAMES[i.accessVlan] ?? `VLAN-${i.accessVlan}`, members: [] }; if (!vlans[i.accessVlan].members.includes(d.id)) vlans[i.accessVlan].members.push(d.id); if (operational(state, d.id, i.name)) macTable.push({ vlan: i.accessVlan, mac: `00d0.ba${d.id.slice(-2)}.${String(i.accessVlan).padStart(4, "0")}`, deviceId: d.id, interfaceName: i.name }); }
    }
    if (d.host?.ipv4) routes.push({ family: "ipv4", prefix: cidrPrefix(d.host.ipv4), deviceId: d.id, protocol: "L", nextHop: null, interfaceName: "eth0" });
    if (d.host?.ipv6) routes.push({ family: "ipv6", prefix: cidrPrefix(d.host.ipv6), deviceId: d.id, protocol: "L", nextHop: null, interfaceName: "eth0" });
  }
  const neighbors = Object.values(state.links).filter((l) => l.status === "up" && operational(state, l.a.deviceId, l.a.interfaceName) && operational(state, l.b.deviceId, l.b.interfaceName)).map((l) => `${state.devices[l.a.deviceId]?.name} ${l.a.interfaceName} ↔ ${state.devices[l.b.deviceId]?.name} ${l.b.interfaceName}`);
  const etherChannels = Object.fromEntries(Object.entries(state.etherChannels).map(([group, channel]) => {
    const members = channel.members.map((member) => { const [deviceId, interfaceName] = member.split(":"); return { deviceId, interfaceName }; });
    const operationalMembers = members.filter((member) => operational(state, member.deviceId, member.interfaceName));
    const peerCompatible = operationalMembers.length > 0 && operationalMembers.every((member) => { const peer = state.devices[member.deviceId]?.interfaces[member.interfaceName]?.peer; return Boolean(peer && members.some((other) => other.deviceId !== member.deviceId && other.interfaceName === peer.interfaceName && other.deviceId === peer.deviceId)); });
    return [group, { ...channel, operational: peerCompatible && operationalMembers.length === members.length }];
  }));
  for (const d of Object.values(state.devices)) for (const vlan of Object.values(d.vlans)) { vlans[vlan.id] ??= { id: vlan.id, name: vlan.name, members: [] }; if (!vlans[vlan.id].members.includes(d.id)) vlans[vlan.id].members.push(d.id); }
  return { ...state, vlans, etherChannels, derived: { interfaceStatus, routes, neighbors, macTable, vlanReachability: [] } };
}

export function deriveState(state: SimulationState): SimulationState { return derive(state); }

export function isCommandAllowed(command: string, mode: Mode): boolean {
  if (command === "enable") return mode === "user";
  if (command === "configure terminal") return mode === "privileged";
  if (command === "end") return mode !== "user";
  if (command === "exit") return mode !== "user";
  if (mode === "user") return false;
  if (mode === "privileged") return /^(show |ping |traceroute |copy |write memory|clear )/.test(command);
  if (mode === "config") return /^(hostname |no ip domain-lookup$|ipv6 unicast-routing$|vlan \d+$|interface |router ospf |ip dhcp pool |ip dhcp excluded-address |line vty |ip access-list |access-list |spanning-tree |username |enable secret |ip route |ipv6 route |ntp server |ip domain name |crypto key generate rsa |ip nat inside source |ip dhcp snooping)/.test(command);
  if (mode === "vlan") return /^name /.test(command);
  if (mode === "interface-range") return /^(description |switchport |channel-group |spanning-tree |no shutdown$|shutdown$)/.test(command);
  if (mode === "interface" || mode === "subinterface") return /^(description |switchport |encapsulation |ip address |ipv6 address |spanning-tree |no shutdown$|shutdown$|channel-group |ip ospf |ipv6 ospf |ip nat inside$|ip nat outside$)/.test(command);
  if (mode === "router") return /^(router-id |network |passive-interface |ipv6 router ospf |area |default-information )/.test(command);
  if (mode === "dhcp") return /^(network |default-router |dns-server |domain-name |ipv6 dhcp |exit$)/.test(command);
  if (mode === "line") return /^(login |password |transport input |exec-timeout |logging synchronous)/.test(command);
  if (mode === "acl") return /^(permit |deny |remark )/.test(command);
  return false;
}

function deviceBySession(state: SimulationState, deviceId: string) { return state.devices[deviceId]; }
function contextInterfaces(state: SimulationState, deviceId: string, session: Session): InterfaceModel[] {
  if (!session.context) return [];
  const context = session.context.replace(/^interface /, "");
  if (session.mode === "interface-range") {
    const range = context.match(/^(.+?)\s+-\s*(\d+)$/);
    if (range) {
      const base = range[1].replace(/\d+$/, ""); const first = Number(range[1].match(/\d+$/)?.[0] ?? 0); const last = Number(range[2]);
      return Array.from({ length: Math.max(0, last - first + 1) }, (_, offset) => state.devices[deviceId]?.interfaces[`${base}${first + offset}`]).filter(Boolean) as InterfaceModel[];
    }
    return context.split(",").map((name) => state.devices[deviceId]?.interfaces[name.trim()]).filter(Boolean) as InterfaceModel[];
  }
  return [state.devices[deviceId]?.interfaces[context]].filter(Boolean) as InterfaceModel[];
}
function vlanOutput(state: SimulationState, d: DeviceModel): string[] { const rows = Object.values(d.vlans).sort((a, b) => a.id - b.id); return ["VLAN Name                             Status    Ports", ...rows.map((v) => { const ports = Object.values(d.interfaces).filter((i) => i.accessVlan === v.id).map((i) => i.name).join(", "); return `${String(v.id).padEnd(5)}${v.name.padEnd(35)}active    ${ports}`; }), "✓ VLAN output is derived from the selected switch configuration."]; }
function trunkOutput(state: SimulationState, d: DeviceModel): string[] { const rows = Object.values(d.interfaces).filter((i) => i.mode === "trunk" && operational(state, d.id, i.name)); return ["Port                    Mode         Status        Native vlan  Allowed VLANs", ...rows.map((i) => `${i.name.padEnd(24)}on           trunking      ${i.nativeVlan}           ${i.allowedVlans.join(",")}`), "✓ Trunk output includes only operational configured trunks."]; }
function etherOutput(state: SimulationState, d: DeviceModel): string[] { const rows = Object.values(state.etherChannels).filter((e) => e.members.some((m) => m.startsWith(`${d.id}:`))); return ["Group  Port-channel  Protocol  Ports", ...rows.map((e) => `${e.group.toString().padEnd(7)}Po${e.group.toString().padEnd(14)}${e.protocol.padEnd(10)}${e.members.map((m) => m.split(":")[1]).join(", ")} ${e.operational ? "(SU)" : "(I)"}`), "✓ EtherChannel state is derived from member links and peer compatibility."]; }
function interfaceOutput(state: SimulationState, d: DeviceModel, ipv6 = false): string[] { const head = ipv6 ? "Interface              IPv6-Address                         Status/Protocol" : "Interface              IP-Address          Status                Protocol"; const rows = Object.values(d.interfaces).map((i) => { const addr = (ipv6 ? i.ipv6[0] : i.ipv4[0]) ?? "unassigned"; const status = state.derived.interfaceStatus[`${d.id}:${i.name}`]; return `${i.name.padEnd(23)}${addr.padEnd(21)}${status}`; }); return [head, ...rows, "✓ Interface evidence is derived from current configuration and links."]; }
function routeOutput(state: SimulationState, d: DeviceModel, ipv6 = false): string[] { const rows = state.derived.routes.filter((r) => r.deviceId === d.id && r.family === (ipv6 ? "ipv6" : "ipv4")); return [ipv6 ? "IPv6 Routing Table" : "Codes: C connected, L local, S static, O OSPF", ...rows.map((r) => `${r.protocol} ${r.prefix} is directly connected, ${r.interfaceName}`), "✓ Routes are derived from configured addresses."]; }
function showOutput(state: SimulationState, d: DeviceModel, command: string): string[] { if (command === "show vlan brief") return vlanOutput(state, d); if (command === "show interfaces trunk") return trunkOutput(state, d); if (command === "show etherchannel summary") return etherOutput(state, d); if (command === "show spanning-tree") return ["Spanning tree enabled protocol", `  ${d.spanningTree.mode === "rapid-pvst" ? "rstp" : d.spanningTree.mode}`, ...Object.keys(d.vlans).sort((a, b) => Number(a) - Number(b)).map((id) => `VLAN${id}  Root: ${d.spanningTree.rootPrimary.includes(Number(id)) ? d.name : "deterministic peer"}  Role: ${d.spanningTree.rootPrimary.includes(Number(id)) ? "ROOT" : "DESIGNATED/FORWARDING"}`), "✓ Spanning-tree evidence is derived from the configured switch state."]; if (command === "show ip interface brief") return interfaceOutput(state, d); if (command === "show ipv6 interface brief") return interfaceOutput(state, d, true); if (command === "show ip route") return routeOutput(state, d); if (command === "show ipv6 route") return routeOutput(state, d, true); if (command === "show ipv6 neighbors") return ["IPv6 Address        Age   Link-layer Addr   Interface", ...state.derived.neighbors.map((n) => `${n}  REACH  simulated`), "✓ Neighbor evidence is derived from active links."]; if (command === "show mac address-table") return ["Vlan    Mac Address       Type       Ports", ...state.derived.macTable.filter((m) => m.deviceId === d.id).map((m) => `${m.vlan}      ${m.mac}    DYNAMIC    ${m.interfaceName}`), "✓ MAC learning evidence is derived from configured access VLANs."]; return ["IOS verification output", `✓ ${command} inspected ${d.name} using the shared simulation state.`]; }

function reachable(state: SimulationState, source: DeviceModel, target: string, ipv6: boolean): { ok: boolean; reason: string } {
  const hosts = Object.values(state.devices).filter((d) => d.kind === "pc" && (ipv6 ? d.host?.ipv6?.split("/")[0] === target : d.host?.ipv4?.split("/")[0] === target));
  const dest = hosts[0]; if (!dest) return { ok: false, reason: "no matching host endpoint in the current topology" };
  if (!dest.host?.vlan) return { ok: false, reason: "destination host requires VLAN membership" };
  const hostAttachment = (host: DeviceModel) => { const hostInterface = Object.values(host.interfaces).find((i) => i.peer?.deviceId); if (!hostInterface?.peer) return null; const accessDevice = state.devices[hostInterface.peer.deviceId]; const accessInterface = accessDevice?.interfaces[hostInterface.peer.interfaceName]; return accessInterface ? { device: accessDevice, intf: accessInterface, hostInterface } : null; };
  const destAttachment = hostAttachment(dest);
  const destAccess = destAttachment?.intf.accessVlan === dest.host.vlan && operational(state, destAttachment.device.id, destAttachment.intf.name) ? destAttachment.intf : null;
  if (!destAccess) { const downAccess = destAttachment?.intf.accessVlan === dest.host.vlan && !destAttachment.intf.adminUp ? destAttachment.intf : null; if (downAccess) return { ok: false, reason: `interface ${downAccess.name} is administratively down` }; return { ok: false, reason: "host is not attached to an operational access port" }; }
  const sourceVlan = source.host?.vlan ?? dest.host.vlan;
  const sourceAttachment = source.host ? hostAttachment(source) : null;
  const sourceAccess = source.host && sourceAttachment && sourceAttachment.intf.accessVlan === source.host.vlan && operational(state, sourceAttachment.device.id, sourceAttachment.intf.name) ? sourceAttachment.intf : null;
  if (source.host && !sourceAccess) return { ok: false, reason: "host is not attached to an operational access port" };
  const routers = Object.values(state.devices).filter((d) => d.kind === "router");
  if (source.host && source.host.vlan !== dest.host.vlan) {
    const hasGateway = routers.some((router) => Object.values(router.interfaces).some((i) => i.type === "subinterface" && i.encapsulationVlan === source.host?.vlan && i.ipv4.length + i.ipv6.length > 0 && operational(state, router.id, i.name)) && Object.values(router.interfaces).some((i) => i.type === "subinterface" && i.encapsulationVlan === dest.host?.vlan && i.ipv4.length + i.ipv6.length > 0 && operational(state, router.id, i.name)));
    if (!hasGateway) return { ok: false, reason: `no matching router subinterface for VLAN ${source.host.vlan} and VLAN ${dest.host.vlan}` };
  }
  if (source.kind === "router") {
    const sourceLink = Object.values(state.links).find((link) => link.a.deviceId === source.id || link.b.deviceId === source.id);
    if (sourceLink) { const sourceInterfaceName = sourceLink.a.deviceId === source.id ? sourceLink.a.interfaceName : sourceLink.b.interfaceName; if (!source.interfaces[sourceInterfaceName]?.adminUp) return { ok: false, reason: `interface ${sourceInterfaceName} is administratively down` }; }
    const hasGateway = Object.values(source.interfaces).some((i) => i.type === "subinterface" && i.encapsulationVlan === dest.host!.vlan && (ipv6 ? i.ipv6.length > 0 : i.ipv4.length > 0) && operational(state, source.id, i.name));
    if (!hasGateway) return { ok: false, reason: `no matching router subinterface for VLAN ${dest.host.vlan}` };
  }
  let blockedVlan: number | null = null;
  const requiredVlans = [sourceVlan, dest.host.vlan].filter((vlan, index, values) => values.indexOf(vlan) === index);
  const queue: { deviceId: string; routed: boolean }[] = [{ deviceId: source.id, routed: source.kind === "router" }];
  const seen = new Set([`${source.id}:${source.kind === "router"}`]);
  while (queue.length) {
    const currentState = queue.shift()!; const current = currentState.deviceId;
    if (current === dest.id && (source.kind === "router" || source.host?.vlan === dest.host.vlan || currentState.routed)) return { ok: true, reason: "path valid" };
    for (const link of Object.values(state.links)) {
      if (link.status !== "up") continue;
      const next = link.a.deviceId === current ? link.b : link.b.deviceId === current ? link.a : null; if (!next) continue;
      const local = state.devices[current].interfaces[link.a.deviceId === current ? link.a.interfaceName : link.b.interfaceName]; const remote = state.devices[next.deviceId].interfaces[next.interfaceName];
      if (local.mode === "trunk" || remote.mode === "trunk") { const missing = requiredVlans.find((vlan) => !local.allowedVlans.includes(vlan) || !remote.allowedVlans.includes(vlan)); if (missing) { blockedVlan = missing; continue; } }
      if (local.adminUp && remote.adminUp) { const routed = currentState.routed || state.devices[next.deviceId].kind === "router"; const key = `${next.deviceId}:${routed}`; if (!seen.has(key)) { seen.add(key); queue.push({ deviceId: next.deviceId, routed }); } }
    }
  }
  if (blockedVlan) return { ok: false, reason: `VLAN ${blockedVlan} is not permitted on the trunk` }; return { ok: false, reason: "no valid operational path between the host endpoints" };
}

function applyConfig(state: SimulationState, deviceId: string, session: Session, command: string): SimulationState {
  const next = cloneSimulation(state); const d = next.devices[deviceId]; const interfaces = contextInterfaces(next, deviceId, session); const i = interfaces[0] ?? null;
  const lower = command.toLowerCase();
  if (lower === "exit" || lower === "end" || lower === "enable" || lower === "configure terminal") return next;
  const vlanMatch = lower.match(/^vlan (\d+)$/); if (vlanMatch) { const id = Number(vlanMatch[1]); d.vlans[id] = { id, name: VLAN_NAMES[id] ?? `VLAN-${id}` }; next.vlans[id] ??= { id, name: d.vlans[id].name, members: [] }; return next; }
  if (session.mode === "vlan") { const name = command.replace(/^name\s+/i, "").trim(); const id = Number(session.context); if (d.vlans[id]) d.vlans[id].name = name; if (next.vlans[id]) next.vlans[id].name = name; return next; }
  if (lower.startsWith("hostname ")) { d.name = command.slice(9).trim(); return next; }
  if (lower === "ipv6 unicast-routing") return next;
  if (lower === "spanning-tree mode rapid-pvst") { d.spanningTree.mode = "rapid-pvst"; return next; }
  const root = lower.match(/^spanning-tree vlan ([\d,]+) root primary$/); if (root) { d.spanningTree.rootPrimary = root[1].split(",").map(Number); return next; }
  if (lower.startsWith("interface ")) { const name = command.slice(10).trim(); const type: InterfaceModel["type"] = name.toLowerCase().startsWith("loopback") ? "loopback" : name.toLowerCase().startsWith("port-channel") ? "port-channel" : name.includes(".") ? "subinterface" : "ethernet"; const target = d.interfaces[name] ?? intf(name, type); target.type = type; if (type === "loopback") target.mode = "loopback"; if (type === "subinterface") target.mode = "subinterface"; if (type === "port-channel") { target.mode = "trunk"; target.portChannel = Number(name.replace(/\D/g, "")); } d.interfaces[name] = target; return next; }
  if (interfaces.length) {
    for (const target of interfaces) {
      if (lower === "no shutdown") target.adminUp = true; if (lower === "shutdown") target.adminUp = false;
      if (lower.startsWith("description ")) target.description = command.slice(12).trim();
    }
    if (lower === "no shutdown" || lower === "shutdown" || lower.startsWith("description ")) return next;
    if (lower.startsWith("description ")) { i!.description = command.slice(12).trim(); return next; }
    const access = lower.match(/^switchport access vlan (\d+)$/); if (access) { interfaces.forEach((target) => { target.accessVlan = Number(access[1]); target.mode = "access"; }); d.vlans[Number(access[1])] ??= { id: Number(access[1]), name: VLAN_NAMES[Number(access[1])] ?? `VLAN-${access[1]}` }; return next; }
    if (lower === "switchport mode access") { interfaces.forEach((target) => { target.mode = "access"; }); return next; } if (lower === "switchport mode trunk") { interfaces.forEach((target) => { target.mode = "trunk"; }); return next; }
    const native = lower.match(/^switchport trunk native vlan (\d+)$/); if (native) { interfaces.forEach((target) => { target.nativeVlan = Number(native[1]); target.mode = "trunk"; }); return next; }
    const allowed = lower.match(/^switchport trunk allowed vlan ([\d, -]+)$/); if (allowed) { const values = allowed[1].split(",").flatMap((part) => { const [a, b] = part.trim().split("-").map(Number); return b ? Array.from({ length: b - a + 1 }, (_, n) => a + n) : [a]; }); interfaces.forEach((target) => { target.allowedVlans = values; target.mode = "trunk"; }); return next; }
    const ip = lower.match(/^ip address (\S+) (\S+)$/); if (ip) { interfaces.forEach((target) => { target.ipv4 = [`${ip[1]}/${ip[2] === "255.255.255.0" ? "24" : "32"}`]; }); return next; }
    const ip6 = lower.match(/^ipv6 address (\S+?)(?:\/([\d]+))?$/); if (ip6) { interfaces.forEach((target) => { target.ipv6 = [`${ip6[1]}${ip6[2] ? `/${ip6[2]}` : ""}`]; }); return next; }
    const enc = lower.match(/^encapsulation dot1q (\d+)( native)?$/); if (enc) { interfaces.forEach((target) => { target.encapsulationVlan = Number(enc[1]); target.encapsulationNative = Boolean(enc[2]); target.mode = "subinterface"; }); return next; }
    const channel = lower.match(/^channel-group (\d+) mode (active|passive|on)$/); if (channel) { const group = Number(channel[1]); const existing = next.etherChannels[group] ?? { group, protocol: channel[2] === "on" ? "static" : "LACP", members: [], operational: false, trunk: false, nativeVlan: 1, allowedVlans: [...DEFAULT_ALLOWED] }; interfaces.forEach((target) => { target.portChannel = group; const key = `${deviceId}:${target.name}`; if (!existing.members.includes(key)) existing.members.push(key); }); existing.trunk = interfaces.some((target) => target.mode === "trunk"); next.etherChannels[group] = existing; return next; }
  }
  if (lower.startsWith("ip route ") || lower.startsWith("ipv6 route ") || lower.startsWith("router ospf ") || lower.startsWith("network ") || lower.startsWith("passive-interface ") || lower.startsWith("ip ospf ") || lower.startsWith("ipv6 ospf ")) return next;
  return next;
}

export function executeCommand(state: SimulationState, deviceId: string, raw: string): SimulationResult {
  const d = deviceBySession(state, deviceId); const session = state.sessions[deviceId]; if (!d || !session) return { state, output: ["% Device session not found."], accepted: false, error: "Device session not found" };
  const command = raw.trim().replace(/\s+/g, " "); const canonical = normalizeCommand(command); if (!canonical) return { state, output: [], accepted: false, error: "Empty command" };
  const history = [...session.history, `${modePrompt(d.name, session)} ${command}`];
  const can = isCommandAllowed(canonical, session.mode);
  if (!can) { const prompt = modePrompt(d.name, session); const output = [`${prompt} ${command}`, `${" ".repeat(prompt.length + 1)}^`, "% Invalid input detected at '^' marker.", `Hint: Current mode is ${session.mode}. Use the exact IOS command for this context.`]; return { state: { ...state, sessions: { ...state.sessions, [deviceId]: { ...session, history: [...history, ...output.slice(1)] } } }, output, accepted: false, error: "Invalid command for current mode" }; }
  let next = state; let output: string[] = [];
  if (canonical.startsWith("show ")) output = showOutput(state, d, canonical);
  else if (canonical.startsWith("ping ")) { const ipv6 = canonical.startsWith("ping ipv6 "); const target = command.split(/\s+/).at(-1)!; const result = reachable(state, d, target, ipv6); output = result.ok ? ["Type escape sequence to abort.", "!!!!!", "Success rate is 100 percent (5/5)", "✓ Reachability is derived from the current topology."] : [`% Destination unreachable: ${result.reason}.`]; }
  else if (canonical.startsWith("copy ") || canonical === "write memory") { next = { ...state, sessions: { ...state.sessions, [deviceId]: { ...session, startupConfig: [...session.runningConfig], history: [...history, "Building configuration...", "[OK]", "✓ Running configuration copied to startup configuration."] } } }; output = ["Building configuration...", "[OK]", "✓ Running configuration copied to startup configuration."]; }
  else { const transition = nextMode(command, session.mode, session.context); next = applyConfig(state, deviceId, session, command); next = { ...next, sessions: { ...next.sessions, [deviceId]: { ...session, ...transition, runningConfig: [...session.runningConfig, command], history: [...history, `✓ ${command} accepted on ${d.name}.`] } } }; next = derive(next); output = [`✓ ${command} accepted on ${d.name}.`]; }
  if (!next.sessions[deviceId] || next.sessions[deviceId] === session) next = { ...next, sessions: { ...next.sessions, [deviceId]: { ...session, history: [...history, ...output] } } };
  return { state: derive(next), output, accepted: true };
}

export function validateCable(state: SimulationState, a: { deviceId: string; interfaceName: string }, b: { deviceId: string; interfaceName: string }, cable: CableType = "copper"): { ok: boolean; reason?: string } {
  if (a.deviceId === b.deviceId) return { ok: false, reason: "A cable must connect two different devices." };
  if (!state.devices[a.deviceId]?.interfaces[a.interfaceName] || !state.devices[b.deviceId]?.interfaces[b.interfaceName]) return { ok: false, reason: "The selected interface does not exist." };
  if (linkFor(state, a.deviceId, a.interfaceName) || linkFor(state, b.deviceId, b.interfaceName)) return { ok: false, reason: "The selected interface is already occupied by another physical link." };
  if (Object.values(state.links).some((l) => (l.a.deviceId === a.deviceId && l.a.interfaceName === a.interfaceName && l.b.deviceId === b.deviceId && l.b.interfaceName === b.interfaceName) || (l.a.deviceId === b.deviceId && l.a.interfaceName === b.interfaceName && l.b.deviceId === a.deviceId && l.b.interfaceName === a.interfaceName))) return { ok: false, reason: "Those interfaces already have a physical link." };
  const aInterface = state.devices[a.deviceId].interfaces[a.interfaceName]; const bInterface = state.devices[b.deviceId].interfaces[b.interfaceName];
  if (aInterface.type !== "ethernet" || bInterface.type !== "ethernet") return { ok: false, reason: "Only physical Ethernet interfaces can be connected with a cable." };
  if (cable === "fiber" && (state.devices[a.deviceId].kind === "pc" || state.devices[b.deviceId].kind === "pc")) return { ok: false, reason: "The requested cable type is incompatible with the selected endpoint." };
  return { ok: true };
}

export function connectCable(state: SimulationState, a: { deviceId: string; interfaceName: string }, b: { deviceId: string; interfaceName: string }, cable: CableType = "copper"): SimulationResult {
  const validation = validateCable(state, a, b, cable); if (!validation.ok) return { state, output: [`% Cable rejected: ${validation.reason}`], accepted: false, error: validation.reason };
  const next = cloneSimulation(state); const id = `link-${Object.keys(next.links).length + 1}`; next.links[id] = { id, a, b, cable, status: "up", portChannel: null }; next.devices[a.deviceId].interfaces[a.interfaceName].peer = b; next.devices[b.deviceId].interfaces[b.interfaceName].peer = a; return { state: derive(next), output: [`✓ ${next.devices[a.deviceId].name} ${a.interfaceName} linked to ${next.devices[b.deviceId].name} ${b.interfaceName}.`], accepted: true };
}

export function resetSimulation(): SimulationState { return createHeadquartersFactorySimulation(); }
export function loadTemplate(template: "headquarters-factory" | "blank"): SimulationState { return template === "blank" ? createBlankSimulation() : createHeadquartersFactorySimulation(); }
