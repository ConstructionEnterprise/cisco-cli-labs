import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { applyCommand, boot, isCiscoCommand, modePrompt, normalizeCommand, type DhcpClientState, type DhcpLease, type Mode, type Session } from "@/lib/ios-engine";
import { Cable, Check, Copy, Eraser, Hand, Magnet, Monitor, MousePointer2, Network, PanelBottom, PanelLeftClose, PanelRightClose, Plus, Router, Save, Server, Share2, Shield, SquareTerminal, SwitchCamera, Trash2, Wifi, X, BookOpen, GripVertical, Minimize2, Maximize2 } from "lucide-react";
import { LAB_REGISTRY, SANDBOX_TEMPLATES, type LabConfig } from "@/labs/labDefinitions";
import { NETWORK_CABLES, NETWORK_DEVICES, ecosystemDevice, ecosystemPort, type EcosystemDeviceKind } from "@/lib/network-ecosystem";
import type { PortRef, SelectionRef, TrafficPacket } from "@/lib/network-topology";
import ThreeSandboxViewport from "@/components/ThreeSandboxViewport";
import LogicalDiagramViewport from "@/components/LogicalDiagramViewport";
import TabbedInspector from "@/components/TabbedInspector";
import NetworkDeviceSchematic from "@/components/NetworkDeviceSchematic";
import { supportsCommand } from "@/lib/capabilities";
import { createSimulatedFlow, flowToPackets } from "@/lib/traffic-engine";
import { evaluateAsaTraffic } from "@/lib/asa-engine";

type DeviceKind = EcosystemDeviceKind;
type Tool = "select" | "pan" | "cable" | "erase";

export type SandboxNode = {
  id: string;
  name: string;
  kind: DeviceKind;
  role: string;
  x: number;
  y: number;
  ports: string[];
  ipv4?: string;
  vlan?: number;
  mountType?: "floor" | "desk" | "rack" | "ceiling";
  z?: number;
};

export type SandboxLink = {
  id: string;
  from: string;
  to: string;
  fromPort: string;
  toPort: string;
  cableId?: string;
};

export type Topology = {
  name: string;
  description: string;
  nodes: SandboxNode[];
  links: SandboxLink[];
};

type PersistedSandbox = {
  topology: Topology;
  savedTopologies: Topology[];
  sessions: Record<string, Session>;
};

const STORAGE_KEY = "ipv6-cli-lab-network-sandbox-v3";
const MISSION_STORAGE_PREFIX = "ipv6-cli-lab-mission-v1:";

type PersistedMission = {
  persisted: PersistedSandbox;
  stepIndex: number;
  selectedId: string | null;
  lastFeedback: string;
};

function missionStorageKey(labId: string): string {
  return MISSION_STORAGE_PREFIX + labId;
}

function loadMission(labId: string): PersistedMission | null {
  try {
    const raw = window.localStorage.getItem(missionStorageKey(labId));
    return raw ? JSON.parse(raw) as PersistedMission : null;
  } catch {
    return null;
  }
}

const CANVAS_WIDTH = 1120;
const CANVAS_HEIGHT = 610;

function cloneTopology(topology: Topology): Topology {
  return JSON.parse(JSON.stringify(topology)) as Topology;
}

function roleFor(kind: DeviceKind): string {
  return ecosystemDevice(kind).defaultRole;
}

function portsFor(kind: DeviceKind): string[] {
  return ecosystemDevice(kind).ports;
}

function iconFor(kind: DeviceKind) {
  if (kind === "pc") return Monitor;
  if (kind === "printer") return Monitor;
  if (kind === "router") return Router;
  if (kind === "server") return Server;
  if (kind === "access-point") return Wifi;
  if (kind === "firewall") return Shield;
  if (kind === "modem" || kind === "hub" || kind === "console-server") return Network;
  return SwitchCamera;
}

function initialPersisted(labId: string): PersistedSandbox {
  const config = LAB_REGISTRY[labId] || LAB_REGISTRY["lab-1"];
  // Casting to Topology to fix the "unknown" error
  const topology = {
    name: config.title,
    description: config.description,
    nodes: config.topology.devices as SandboxNode[],
    links: config.topology.links as SandboxLink[]
  };
  return {
    topology,
    savedTopologies: [cloneTopology(topology)],
    sessions: Object.fromEntries(topology.nodes.map((node) => [node.id, boot(node.name, node.role)]))
  };
}

const isValidCommand = isCiscoCommand;

function interfaceSubnet(address: string): number | null {
  const [ip, mask] = address.split(" ");
  const ipNumber = ipToNumber(ip);
  const maskNumber = ipToNumber(mask);
  return ipNumber === null || maskNumber === null ? null : (ipNumber & maskNumber) >>> 0;
}

function ospfNetworksMatch(address: string, networks: { network: string; wildcard: string; area: number }[]): boolean {
  const [ip] = address.split(" ");
  const ipNumber = ipToNumber(ip);
  if (ipNumber === null) return false;
  return networks.some((network) => {
    const networkNumber = ipToNumber(network.network);
    const wildcardNumber = ipToNumber(network.wildcard);
    return networkNumber !== null && wildcardNumber !== null && ((ipNumber & (~wildcardNumber >>> 0)) >>> 0) === ((networkNumber & (~wildcardNumber >>> 0)) >>> 0);
  });
}

function ospfNeighbors(node: SandboxNode, topology: Topology, sessions: Record<string, Session>): { name: string; address: string; state: string }[] {
  const neighbors: { name: string; address: string; state: string }[] = [];
  for (const link of topology.links) {
    const peerId = link.from === node.id ? link.to : link.to === node.id ? link.from : null;
    if (!peerId) continue;
    const peer = topology.nodes.find((candidate) => candidate.id === peerId);
    if (!peer || peer.kind !== "router" || node.kind !== "router") continue;
    const localPort = link.from === node.id ? link.fromPort : link.toPort;
    const peerPort = link.from === node.id ? link.toPort : link.fromPort;
    const localSession = sessions[node.id];
    const peerSession = sessions[peer.id];
    if (!localSession || !peerSession || !Object.keys(localSession.ospfProcesses || {}).length || !Object.keys(peerSession.ospfProcesses || {}).length) continue;
    const localAddresses = localSession.interfaces[localPort]?.ipv4 || [];
    const peerAddresses = peerSession.interfaces[peerPort]?.ipv4 || [];
    const shared = localAddresses.find((localAddress) => peerAddresses.some((peerAddress) => interfaceSubnet(localAddress) !== null && interfaceSubnet(localAddress) === interfaceSubnet(peerAddress) && ospfNetworksMatch(localAddress, Object.values(localSession.ospfProcesses).flatMap((process) => process.networks)) && ospfNetworksMatch(peerAddress, Object.values(peerSession.ospfProcesses).flatMap((process) => process.networks))));
    if (shared) neighbors.push({ name: peer.name, address: peerAddresses[0]?.split(" ")[0] || "unknown", state: "FULL" });
  }
  return neighbors;
}

function prefixLength(mask: string): number {
  const number = ipToNumber(mask);
  if (number === null) return 32;
  let count = 0;
  for (let bit = 31; bit >= 0 && (number & (1 << bit)) !== 0; bit -= 1) count += 1;
  return count;
}

function reconcileOspfRoutes(topology: Topology, sessions: Record<string, Session>): Record<string, Session> {
  const next = Object.fromEntries(Object.entries(sessions).map(([id, session]) => [id, { ...session, routingTable: session.routingTable.filter((route) => route.protocol !== "ospf") }]));
  for (const link of topology.links) {
    const local = topology.nodes.find((node) => node.id === link.from);
    const peer = topology.nodes.find((node) => node.id === link.to);
    if (!local || !peer || local.kind !== "router" || peer.kind !== "router") continue;
    const localSession = next[local.id];
    const peerSession = next[peer.id];
    if (!Object.keys(localSession.ospfProcesses || {}).length || !Object.keys(peerSession.ospfProcesses || {}).length) continue;
    const localAddresses = localSession.interfaces[link.fromPort]?.ipv4 || [];
    const peerAddresses = peerSession.interfaces[link.toPort]?.ipv4 || [];
    const shared = localAddresses.find((localAddress) => peerAddresses.some((peerAddress) => interfaceSubnet(localAddress) !== null && interfaceSubnet(localAddress) === interfaceSubnet(peerAddress) && ospfNetworksMatch(localAddress, Object.values(localSession.ospfProcesses).flatMap((process) => process.networks)) && ospfNetworksMatch(peerAddress, Object.values(peerSession.ospfProcesses).flatMap((process) => process.networks))));
    if (!shared) continue;
    const nextHop = peerAddresses[0]?.split(" ")[0];
    const localRoutes = peerSession.interfaces[link.toPort]?.ipv4.map((address) => {
      const [ip, mask] = address.split(" ");
      return { prefix: `${ip}/${prefixLength(mask)}`, nextHop, interface: link.fromPort, protocol: "ospf" as const };
    }) || [];
    const peerRoutes = localSession.interfaces[link.fromPort]?.ipv4.map((address) => {
      const [ip, mask] = address.split(" ");
      return { prefix: `${ip}/${prefixLength(mask)}`, nextHop: localAddresses[0]?.split(" ")[0], interface: link.toPort, protocol: "ospf" as const };
    }) || [];
    next[local.id] = { ...localSession, routingTable: [...localSession.routingTable, ...localRoutes] };
    next[peer.id] = { ...peerSession, routingTable: [...peerSession.routingTable, ...peerRoutes] };
  }
  return next;
}

function outputFor(command: string, node: SandboxNode, topology: Topology, session: Session, sessions: Record<string, Session> = {}): string[] {
  if (command.startsWith("show ")) {
    if (command === "show hosts") {
      const records = Object.entries(session.dnsRecords || {});
      return records.length ? ["Default domain is not set", "Name/address lookup uses domain service", "Name                  Address", ...records.map(([name, address]) => `${name.padEnd(22)}${address}`)] : ["% No static DNS host records configured."];
    }
    if (command === "show ip ospf neighbor") {
      const neighbors = ospfNeighbors(node, topology, sessions);
      return neighbors.length ? ["Neighbor ID     Pri   State           Dead Time   Address         Interface", ...neighbors.map((neighbor) => `${neighbor.name.padEnd(16)}1   ${neighbor.state.padEnd(15)} 00:00:33    ${neighbor.address}`)] : ["% No OSPF neighbors in FULL state."];
    }
    if (command === "show ip ospf database") {
      const processes = Object.values(session.ospfProcesses || {});
      return processes.length ? processes.flatMap((process) => [`            OSPF Router with ID (${process.routerId || session.hostname})`, `                Router Link States (Area 0)`, ...process.networks.map((network) => `Link ID ${network.network}  Network ${network.network}  Area ${network.area}`)]) : ["% OSPF is not configured."];
    }
    if (command === "show ip route") {
      return session.routingTable.length ? ["Codes: C - connected, S - static, O - OSPF", "", ...session.routingTable.map((route) => `O    ${route.prefix} [110/2] via ${route.nextHop || "-"}, ${route.interface || "-"}`)] : ["Codes: C - connected, S - static, O - OSPF", "% No modeled routes are present."];
    }
    if (command === "show running-config" || command.startsWith("show running-config |")) {
      return ["Building configuration...", `hostname ${session.hostname}`, ...session.runningConfig, "!", "end"];
    }
    if (command === "show startup-config") {
      return session.startupConfig.length > 0
        ? [`hostname ${session.hostname}`, ...session.startupConfig, "!", "end"]
        : ["% Startup configuration is empty."];
    }
    if (command === "show vlan brief") {
      const entries = Object.entries(session.vlans);
      return ["VLAN Name                             Status    Ports", ...(entries.length ? entries.map(([id, name]) => `${id.padEnd(4)} ${name.padEnd(32)} active`) : ["% No user VLANs configured."])];
    }
    if (command === "show ip dhcp pool") {
      const pools = Object.values(session.dhcpPools || {});
      return pools.length
        ? ["Pool                          Utilization    Mark", ...pools.map((pool) => `${pool.name.padEnd(30)} 0%             Network ${pool.network || "not configured"}`)]
        : ["% No DHCP pools configured."];
    }
    if (command === "show ip dhcp binding") {
      const leases = session.dhcpLeases || [];
      return ["Bindings from all pools not associated with VRF:", "IP address      Client-ID/              Lease expiration        Type", "                 Hardware address/", "                 User name", ...(leases.length ? leases.map((lease) => `${lease.ip.padEnd(16)}${lease.clientId.padEnd(24)}Infinite                 ${lease.state}`) : ["% No active DHCP bindings."])];
    }
    if (command === "show ip dhcp conflict") return ["IP address        Detection method   Detection time", "% No address conflicts detected."];
    if (command === "show ip dhcp server statistics") return ["Memory usage         0", "Address pools        ", `${Object.keys(session.dhcpPools || {}).length} total`, "Database agents     0", "DHCP packets        0 received, 0 sent", "No DHCP client exchanges are modeled yet."];
    if (command.startsWith("show mac address-table")) {
      return [
        "          Mac Address Table",
        "-------------------------------------------",
        "Vlan    Mac Address       Type        Ports",
        "----    -----------       --------    -----",
        ...(session.macTable.length ? session.macTable.map((entry) => `${String(entry.vlan).padEnd(8)}${entry.mac.padEnd(18)}${entry.type.padEnd(12)}${entry.port}`) : ["          % No MAC addresses learned."]),
      ];
    }
    if (command === "show ip interface brief") {
      const entries = Object.entries(session.interfaces);
      return ["Interface              IP-Address      OK? Method Status                Protocol", ...(entries.length ? entries.map(([name, state]) => `${name.padEnd(22)} ${(state.ipv4[0]?.split(" ")[0] || "unassigned").padEnd(15)} YES manual ${state.shutdown ? "administratively down" : "up"}                    ${state.shutdown ? "down" : "up"}`) : ["% No interfaces configured."])];
    }
    if (command === "show ipv6 interface brief") {
      const entries = Object.entries(session.interfaces);
      return ["Interface              Status                 IPv6 address", ...(entries.length ? entries.map(([name, state]) => `${name.padEnd(22)} ${state.shutdown ? "administratively down" : "up/up"}              ${state.ipv6.join(", ") || "unassigned"}`) : ["% No IPv6 interfaces configured."])];
    }
    if (command === "show interfaces trunk") {
      const trunks = Object.entries(session.interfaces).filter(([, state]) => state.commands.some((item) => item.toLowerCase() === "switchport mode trunk"));
      return trunks.length ? ["Port        Mode         Encapsulation  Status        Native vlan", ...trunks.map(([name, state]) => `${name}       on           802.1q         trunking      ${state.nativeVlan || 1}`), "", "Port        Vlans allowed on trunk", ...trunks.map(([name, state]) => `${name}       ${state.allowedVlans || "1-4094"}`)] : ["% No configured trunk interfaces."];
    }
    if (command === "show etherchannel summary") {
      const members = Object.entries(session.interfaces).filter(([, state]) => state.channelGroup);
      const groups = Array.from(new Set(members.map(([, state]) => state.channelGroup))).filter(Boolean);
      return groups.length ? ["Group  Port-channel  Protocol    Ports", ...groups.map((group) => {
        const ports = members.filter(([, state]) => state.channelGroup === group).map(([name, state]) => `${name}(${state.channelMode === "on" ? "P" : "P"})`).join(" ");
        return `${group}     Po${group}           ${members.find(([, state]) => state.channelGroup === group)?.[1].channelMode === "on" ? "-" : "LACP"}         ${ports}`;
      })] : ["% No EtherChannels configured."];
    }
    return [
      "IOS verification output is modeled from the current session state.",
      `Command accepted: ${command}`,
      `Device: ${node.name}; modeled links: ${topology.links.length}.`,
      "This command has no modeled output for the current simulator profile.",
    ];
  }
  if (command.startsWith("nslookup ")) return ["Server:  Unresolved until a modeled DNS server is reached.", `% DNS lookup requested for ${command.slice("nslookup ".length)}.`];
  if (command.startsWith("ping ")) return [
    `Type escape sequence to abort. Sending 5 modeled ICMP echo requests to ${command.slice("ping ".length)}...`,
    "!!!!!",
    "Success rate is 100 percent (5/5), modeled path resolved.",
    "ICMP packet animation reflects the modeled state transition; it is not a claim of real network reachability.",
  ];
  if (command.startsWith("traceroute ")) return [
    "Traceroute path calculation is not implemented for this modeled topology.",
    `No reachability result is claimed for ${command}.`,
  ];
  if (command.startsWith("copy ") || command === "write memory") return [
    "Configuration persistence is not implemented in the browser simulator.",
    `No startup-config write is claimed for ${node.name}.`,
  ];
  return [`Syntax accepted in the current IOS mode: ${command}.`, "Device configuration state is recorded only in the command history."];
}

type ProbeResolution = { path: string[]; destination: SandboxNode } | { error: string };

function resolveProbePath(sourceId: string, destinationIp: string, topology: Topology, sessions: Record<string, Session>): ProbeResolution {
  const destination = topology.nodes.find((node) => node.ipv4 === destinationIp || Object.values(sessions[node.id]?.interfaces || {}).some((state) => state.ipv4.some((address) => address.split(" ")[0] === destinationIp)));
  if (!destination) return { error: `%DESTINATION_UNRESOLVED: ${destinationIp} is not assigned to a modeled host.` };
  const sourceVlan = clientVlan(sourceId, topology, sessions);
  const destinationVlan = destination.vlan || clientVlan(destination.id, topology, sessions);
  if (sourceVlan !== destinationVlan) {
    for (const router of topology.nodes.filter((node) => node.kind === "router")) {
      const ingress = resolveVlanPath(sourceId, router.id, sourceVlan, topology, sessions);
      const egress = resolveVlanPath(router.id, destination.id, destinationVlan, topology, sessions);
      if (!("error" in ingress) && !("error" in egress)) return { path: [...ingress.links, ...egress.links].map((link) => link.id), destination };
    }
    return { error: `%NO_ROUTE: No modeled router-on-a-stick path exists between VLAN ${sourceVlan} and VLAN ${destinationVlan}.` };
  }
  const nodeMap = new Map(topology.nodes.map((node) => [node.id, node]));
  const stateFor = (nodeId: string, port: string) => sessions[nodeId]?.interfaces[port] || {};
  const portVlan = (nodeId: string, port: string) => stateFor(nodeId, port).accessVlan || 1;
  const portMode = (nodeId: string, port: string) => stateFor(nodeId, port).switchportMode || "access";
  const portChannel = (nodeId: string, port: string) => stateFor(nodeId, port).channelGroup;
  const channelTrunk = (nodeId: string, group?: number) => {
    if (!group) return false;
    const state = sessions[nodeId]?.interfaces[`port-channel ${group}`] || sessions[nodeId]?.interfaces[`Port-channel${group}`];
    return state?.switchportMode === "trunk";
  };
  const allowed = (nodeId: string, port: string, vlan: number) => {
    const state = stateFor(nodeId, port);
    if (state.switchportMode !== "trunk") return false;
    const list = state.allowedVlans?.replace(/\s/g, "") || "1-4094";
    return list.split(",").some((entry) => {
      const [low, high] = entry.split("-").map(Number);
      return high ? vlan >= low && vlan <= high : vlan === low;
    });
  };
  const linkUsable = (link: SandboxLink, vlan: number) => {
    const from = nodeMap.get(link.from);
    const to = nodeMap.get(link.to);
    if (!from || !to) return false;
    const fromChannel = portChannel(link.from, link.fromPort);
    const toChannel = portChannel(link.to, link.toPort);
    const isInterSwitch = from.kind === "switch" && to.kind === "switch";
    if (isInterSwitch) {
      const fromTrunk = allowed(link.from, link.fromPort, vlan) || channelTrunk(link.from, fromChannel);
      const toTrunk = allowed(link.to, link.toPort, vlan) || channelTrunk(link.to, toChannel);
      return fromTrunk && toTrunk;
    }
    const switchSide = from.kind === "switch" ? { nodeId: from.id, port: link.fromPort } : to.kind === "switch" ? { nodeId: to.id, port: link.toPort } : null;
    if (!switchSide) return true;
    return portMode(switchSide.nodeId, switchSide.port) === "access" && portVlan(switchSide.nodeId, switchSide.port) === (from.kind === "pc" ? from.vlan : to.vlan);
  };
  const queue = [sourceId];
  const previous = new Map<string, { nodeId: string; linkId: string } | null>([[sourceId, null]]);
  const vlan = destination.vlan || 1;
  while (queue.length) {
    const current = queue.shift()!;
    for (const link of topology.links.filter((item) => item.from === current || item.to === current)) {
      if (!linkUsable(link, vlan)) continue;
      const next = link.from === current ? link.to : link.from;
      if (previous.has(next)) continue;
      previous.set(next, { nodeId: current, linkId: link.id });
      queue.push(next);
    }
  }
  if (!previous.has(destination.id)) {
    const firstBlocked = topology.links.find((link) => link.from === destination.id || link.to === destination.id);
    return { error: firstBlocked ? `%VLAN_NOT_ALLOWED: VLAN ${vlan} is not permitted across the modeled path.` : `%NO_ROUTE: No modeled path exists to ${destinationIp}.` };
  }
  const path: string[] = [];
  let cursor = destination.id;
  while (cursor !== sourceId) {
    const step = previous.get(cursor);
    if (!step) break;
    path.unshift(step.linkId);
    cursor = step.nodeId;
  }
  return { path, destination };
}

type DhcpResolution = { client: DhcpClientState; clientSession: Session; serverId: string; serverSession: Session; learnedSessions: Record<string, Session>; output: string[] } | { error: string };
type DnsResolution = { name: string; address: string; serverId: string } | { error: string };

function ipToNumber(value: string): number | null {
  const octets = value.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
  return (((octets[0] * 256 + octets[1]) * 256 + octets[2]) * 256 + octets[3]) >>> 0;
}

function numberToIp(value: number): string {
  return [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join(".");
}

function deterministicMac(nodeId: string): string {
  let hash = 0;
  for (const character of nodeId) hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
  return `02:ce:${(hash >>> 16 & 255).toString(16).padStart(2, "0")}:${(hash >>> 8 & 255).toString(16).padStart(2, "0")}:${(hash >>> 4 & 255).toString(16).padStart(2, "0")}:${(hash & 255).toString(16).padStart(2, "0")}`;
}

type VlanPath = { nodeIds: string[]; links: SandboxLink[] } | { error: string };
const MAC_AGING_MS = 5 * 60 * 1000;

function ageMacTables(sessions: Record<string, Session>, now = Date.now()): Record<string, Session> {
  return Object.fromEntries(Object.entries(sessions).map(([nodeId, session]) => [nodeId, {
    ...session,
    macTable: session.macTable.filter((entry) => entry.lastSeen === undefined || now - entry.lastSeen < MAC_AGING_MS),
  }]));
}

function removeMacEntriesForPort(sessions: Record<string, Session>, nodeId: string, port: string): Record<string, Session> {
  const session = sessions[nodeId];
  if (!session) return sessions;
  return { ...sessions, [nodeId]: { ...session, macTable: session.macTable.filter((entry) => entry.port !== port) } };
}

function removeMacEntriesForLink(sessions: Record<string, Session>, topology: Topology, link: SandboxLink): Record<string, Session> {
  let next = removeMacEntriesForPort(sessions, link.from, link.fromPort);
  next = removeMacEntriesForPort(next, link.to, link.toPort);
  const from = topology.nodes.find((node) => node.id === link.from);
  const to = topology.nodes.find((node) => node.id === link.to);
  if (from?.kind === "switch") next = removeMacEntriesForPort(next, from.id, link.fromPort);
  if (to?.kind === "switch") next = removeMacEntriesForPort(next, to.id, link.toPort);
  return next;
}

function vlanFromInterface(name: string, state?: Session["interfaces"][string]): number | null {
  const encapsulation = state?.commands.find((command) => /^encapsulation dot1q \d+( native)?$/i.test(command));
  const match = encapsulation?.match(/encapsulation dot1q (\d+)/i);
  return match ? Number(match[1]) : name.includes(".") ? Number(name.split(".").pop()) : null;
}

function portAllowsVlan(node: SandboxNode, port: string, vlan: number, sessions: Record<string, Session>): boolean {
  const state = sessions[node.id]?.interfaces[port];
  if (node.kind === "switch") {
    if (state?.switchportMode === "trunk") {
      const allowed = state.allowedVlans?.replace(/\s/g, "") || "1-4094";
      return allowed.split(",").some((entry) => {
        const [low, high] = entry.split("-").map(Number);
        return high ? vlan >= low && vlan <= high : vlan === low;
      });
    }
    return (state?.accessVlan || 1) === vlan;
  }
  if (node.kind === "router") {
    if (vlanFromInterface(port, state) === vlan) return true;
    return Object.entries(sessions[node.id]?.interfaces || {}).some(([name, candidate]) => {
      if (!name.startsWith(`${port}.`) || vlanFromInterface(name, candidate) !== vlan || candidate.shutdown || candidate.ipv4.length === 0) return false;
      const parent = sessions[node.id]?.interfaces[port];
      return !parent || !parent.shutdown;
    });
  }
  return true;
}

function clientVlan(clientId: string, topology: Topology, sessions: Record<string, Session>): number {
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

function resolveVlanPath(sourceId: string, destinationId: string, vlan: number, topology: Topology, sessions: Record<string, Session>): VlanPath {
  const nodeMap = new Map(topology.nodes.map((node) => [node.id, node]));
  const queue = [sourceId];
  const previous = new Map<string, { nodeId: string; link: SandboxLink } | null>([[sourceId, null]]);
  while (queue.length) {
    const current = queue.shift()!;
    for (const link of topology.links.filter((item) => item.from === current || item.to === current)) {
      const from = nodeMap.get(link.from);
      const to = nodeMap.get(link.to);
      if (!from || !to || !portAllowsVlan(from, link.fromPort, vlan, sessions) || !portAllowsVlan(to, link.toPort, vlan, sessions)) continue;
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

function resolveDhcpLease(clientId: string, interfaceName: string, topology: Topology, sessions: Record<string, Session>, clientSession: Session): DhcpResolution {
  const vlan = clientVlan(clientId, topology, sessions);
  const server = topology.nodes.find((node) => node.id !== clientId && Object.keys(sessions[node.id]?.dhcpPools || {}).length > 0);
  if (!server) return { error: "%DHCP: No modeled DHCP server is present in the topology." };
  const serverSession = sessions[server.id];
  const pool = Object.values(serverSession.dhcpPools || {}).find((candidate) => candidate.network && candidate.mask);
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
  const existing = new Set((serverSession.dhcpLeases || []).map((lease) => lease.ip));
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
  const updatedServerSession: Session = { ...serverSession, dhcpLeases: [...(serverSession.dhcpLeases || []), lease], arpTable: pool.defaultRouter ? [...serverSession.arpTable, { ip: address, mac, interface: gatewayInterface?.[0] || "vlan1", age: 0 }] : serverSession.arpTable };
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

function resolveDnsName(sourceId: string, name: string, topology: Topology, sessions: Record<string, Session>): DnsResolution {
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

function negotiatePoe(switchNode: SandboxNode, port: string, topology: Topology, session: Session): { session: Session; output: string[] } {
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

export default function NetworkSandbox({ onExit, labId = "lab-1" }: { onExit: () => void; labId?: string }) {
  const [activeLabId, setActiveLabId] = useState(labId);
  const config = LAB_REGISTRY[activeLabId] || LAB_REGISTRY["lab-1"];
  const [persisted, setPersisted] = useState<PersistedSandbox>(() => loadMission(labId)?.persisted ?? initialPersisted(labId));
  const { topology, savedTopologies, sessions } = persisted;
  const [tool, setTool] = useState<Tool>("select");
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(false);
  const [workspaceWidth, setWorkspaceWidth] = useState(244);
  const [missionWidth, setMissionWidth] = useState(320);
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false);
  const [missionCollapsed, setMissionCollapsed] = useState(false);
  const [viewportMode, setViewportMode] = useState<"schematic" | "logical" | "3d">("schematic");
  const [selectedId, setSelectedId] = useState<string | null>(() => loadMission(labId)?.selectedId ?? null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [cableStart, setCableStart] = useState<string | null>(null);
  const [connectionStart, setConnectionStart] = useState<PortRef | null>(null);
  const [selectedPort, setSelectedPort] = useState<PortRef | null>(null);
  const [selectedCableId, setSelectedCableId] = useState("cat6");
  const [packets, setPackets] = useState<TrafficPacket[]>([]);
  const [deviceQuery, setDeviceQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selection, setSelection] = useState<SelectionRef[]>([]);
  const [showTerminal, setShowTerminal] = useState(true);
  const [terminalMinimized, setTerminalMinimized] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(150);
  const [terminalInput, setTerminalInput] = useState("");
  const [notice, setNotice] = useState("Canvas ready");
  const [stepIndex, setStepIndex] = useState(() => loadMission(labId)?.stepIndex ?? 0);
  const [lastFeedback, setLastFeedback] = useState<string>(() => loadMission(labId)?.lastFeedback ?? "Welcome to the lab. Start with the first objective.");
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const resizeRef = useRef<{ side: "workspace" | "mission"; startX: number; startWidth: number } | { side: "terminal"; startY: number; startHeight: number } | null>(null);

  const selectedNode = topology.nodes.find((node) => node.id === selectedId) ?? null;
  const selectedSession = selectedNode ? sessions[selectedNode.id] : null;
  const selectedRole = selectedNode?.role ?? "Select a device to open its IOS console";
  const nodeMap = useMemo(() => new Map(topology.nodes.map((node) => [node.id, node])), [topology.nodes]);
  const deviceTags = useMemo(() => Array.from(new Set(NETWORK_DEVICES.flatMap((device) => device.tags || []))).sort(), []);
  const filteredDevices = useMemo(() => NETWORK_DEVICES.filter((device) => {
    const query = deviceQuery.trim().toLowerCase();
    return (!query || `${device.name} ${device.defaultRole} ${(device.tags || []).join(" ")}`.toLowerCase().includes(query)) && (activeFilters.length === 0 || activeFilters.some((tag) => (device.tags || []).includes(tag) || tag === device.kind));
  }), [deviceQuery, activeFilters]);

  const currentStep = config.steps[stepIndex];

  // Keep the sandbox selection synchronized with the curriculum selection.
  useEffect(() => {
    setActiveLabId(labId);
  }, [labId]);

  // Reset the complete mission session whenever the active scenario changes.
  useEffect(() => {
    const freshState = initialPersisted(activeLabId);
    const savedMission = loadMission(activeLabId);
    const nextState = savedMission?.persisted ?? freshState;

    setPersisted(nextState);
    setStepIndex(savedMission?.stepIndex ?? 0);
    setLastFeedback(savedMission?.lastFeedback ?? "Welcome to the lab. Start with the first objective.");
    setSelectedId(nextState.topology.nodes[0]?.id ?? null);
    setSelectedLinkId(null);
    setCableStart(null);
    setConnectionStart(null);
    setSelectedPort(null);
    setSelection([]);
    setPackets([]);
    setTool("select");
    setTerminalMinimized(false);
    setTerminalHeight(150);
    setShowTerminal(true);
    setTerminalInput("");
    dragRef.current = null;
    setNotice(`${freshState.topology.name} loaded`);
  }, [activeLabId, config]);

  useEffect(() => {
    if (config.type === "guided" || config.type === "sandbox") {
      window.localStorage.setItem(missionStorageKey(activeLabId), JSON.stringify({
        persisted,
        stepIndex,
        selectedId,
        lastFeedback
      } satisfies PersistedMission));
    } else if (persisted.topology.name === "Untitled Construction Network") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    }
  }, [activeLabId, config.type, lastFeedback, persisted, selectedId, stepIndex]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (resizeRef.current?.side === "workspace") {
        const delta = event.clientX - resizeRef.current.startX;
        setWorkspaceWidth(Math.max(190, Math.min(420, resizeRef.current.startWidth + delta)));
        return;
      }
      if (resizeRef.current?.side === "mission") {
        const delta = event.clientX - resizeRef.current.startX;
        setMissionWidth(Math.max(260, Math.min(480, resizeRef.current.startWidth - delta)));
        return;
      }
      if (resizeRef.current?.side === "terminal") {
        const delta = resizeRef.current.startY - event.clientY;
        setTerminalHeight(Math.max(150, Math.min(560, resizeRef.current.startHeight + delta)));
        return;
      }
      if (!dragRef.current || !canvasRef.current) return;
      const bounds = canvasRef.current.getBoundingClientRect();
      const rawX = Math.max(12, Math.min(CANVAS_WIDTH - 190, event.clientX - bounds.left - dragRef.current.dx));
      const rawY = Math.max(12, Math.min(CANVAS_HEIGHT - 100, event.clientY - bounds.top - dragRef.current.dy));
      const x = snapToGrid ? Math.round(rawX / 24) * 24 : rawX;
      const y = snapToGrid ? Math.round(rawY / 24) * 24 : rawY;
      setPersisted((current) => ({ ...current, topology: { ...current.topology, nodes: current.topology.nodes.map((node) => node.id === dragRef.current?.id ? { ...node, x, y } : node) } }));
    };
    const up = () => { dragRef.current = null; resizeRef.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  function selectTemplate(template: Topology, scenarioLabId?: string) {
    if (scenarioLabId && LAB_REGISTRY[scenarioLabId]) {
      setActiveLabId(scenarioLabId);
      return;
    }

    const cloned = cloneTopology(template);
    setPersisted((current) => ({ ...current, topology: cloned, sessions: Object.fromEntries(cloned.nodes.map((node) => [node.id, current.sessions[node.id] ?? boot(node.name, node.role)])) }));
    setSelectedId(cloned.nodes[0]?.id ?? null);
    setSelectedLinkId(null);
    setCableStart(null);
    setNotice(`${cloned.name} loaded`);
  }

  function saveScenario() {
    setPersisted((current) => ({ ...current, savedTopologies: [cloneTopology(current.topology), ...current.savedTopologies.filter((item) => item.name !== current.topology.name)].slice(0, 8) }));
    toast("Topology saved", { description: `${topology.name} is available from this browser.` });
  }

  function shareScenario() {
    const payload = JSON.stringify(topology, null, 2);
    navigator.clipboard?.writeText(payload);
    toast("Topology JSON copied", { description: "Paste it into a future scenario brief or keep it as a portable lab blueprint." });
  }

  function exportAsLabDefinition() {
    // 1. Create a unique ID for the new lab
    const labId = `custom-${Date.now()}`;
    const labTitle = topology.name || "Custom Sandbox Lab";
    const labDesc = topology.description || "A custom lab generated from the sandbox.";

    // 2. Format the devices for the registry
    const devicesCode = topology.nodes.map(node =>
      `      { id: "${node.id}", name: "${node.name}", kind: "${node.kind}", role: "${node.role}", x: ${node.x}, y: ${node.y}, ports: ${JSON.stringify(node.ports)} },`
    ).join("\n");

    // 3. Format the links for the registry
    const linksCode = topology.links.map(link =>
      `      { id: "${link.id}", from: "${link.from}", to: "${link.to}", fromPort: "${link.fromPort}", toPort: "${link.toPort}" },`
    ).join("\n");

    // 4. Build the final TypeScript string
    const finalCode = `
export const CUSTOM_LAB_${Date.now()} = {
  title: "${labTitle}",
  description: "${labDesc}",
  type: "sandbox",
  topology: {
    devices: [
${devicesCode}
    ],
    links: [
${linksCode}
    ],
  },
  steps: [], // Add your guided steps here!
};

// ADD THIS TO YOUR LAB_REGISTRY:
// "${labId}": CUSTOM_LAB_${Date.now()},
`;

    navigator.clipboard.writeText(finalCode);
    toast("Lab Blueprint Copied!", {
      description: "Paste the generated code into labDefinitions.ts to make this lab permanent."
    });
  }

  function addDevice(kind: DeviceKind) {
    const prefix = kind === "pc" ? "CE-HQ-ENG-PC" : kind === "printer" ? "CE-HQ-PRN" : kind === "switch" ? "CE-HQ-DSW" : kind === "router" ? "CE-HQ-R" : `CE-HQ-${kind.toUpperCase()}`;
    let suffix = 1;
    while (topology.nodes.some((node) => node.name === `${prefix}${suffix}`)) suffix += 1;
    const node: SandboxNode = { id: `${kind}-${Date.now()}`, name: `${prefix}${suffix}`, kind, role: roleFor(kind), x: 170 + ((topology.nodes.length * 185) % 760), y: 90 + ((topology.nodes.length * 105) % 390), ports: portsFor(kind) };
    setPersisted((current) => ({ ...current, topology: { ...current.topology, nodes: [...current.topology.nodes, node] }, sessions: { ...current.sessions, [node.id]: boot(node.name, node.role) } }));
    setSelectedId(node.id);
    setNotice(`${node.name} placed on the canvas`);
  }

  function connectNodes(firstId: string, secondId: string) {
    if (firstId === secondId) return;
    const duplicate = topology.links.some((link) => (link.from === firstId && link.to === secondId) || (link.from === secondId && link.to === firstId));
    if (duplicate) { setNotice("Those devices are already linked"); setCableStart(null); return; }
    const first = nodeMap.get(firstId);
    const second = nodeMap.get(secondId);
    if (!first || !second) return;
    const firstUsed = topology.links.filter((link) => link.from === firstId || link.to === firstId).length;
    const secondUsed = topology.links.filter((link) => link.from === secondId || link.to === secondId).length;
    const firstCables = ecosystemDevice(first.kind).cables;
    const secondCables = ecosystemDevice(second.kind).cables;
    const cable = NETWORK_CABLES.find((item) => firstCables.includes(item.id) && secondCables.includes(item.id));
    if (!cable) { setNotice(`No compatible cable model connects ${first.name} and ${second.name}`); setCableStart(null); return; }
    const link: SandboxLink = { id: `link-${Date.now()}`, from: firstId, to: secondId, fromPort: first.ports[Math.min(firstUsed, first.ports.length - 1)], toPort: second.ports[Math.min(secondUsed, second.ports.length - 1)], cableId: cable.id };
    setPersisted((current) => ({ ...current, topology: { ...current.topology, links: [...current.topology.links, link] } }));
    setCableStart(null);
    setNotice(`${first.name} ${link.fromPort} linked to ${second.name} ${link.toPort}`);
  }

  function isPortUsed(ref: PortRef) {
    return topology.links.some((link) => (link.from === ref.nodeId && link.fromPort === ref.port) || (link.to === ref.nodeId && link.toPort === ref.port));
  }

  function connectPorts(first: PortRef, second: PortRef) {
    const firstNode = nodeMap.get(first.nodeId);
    const secondNode = nodeMap.get(second.nodeId);
    const cable = NETWORK_CABLES.find((item) => item.id === selectedCableId);
    if (!firstNode || !secondNode || !cable) return;
    if (first.nodeId === second.nodeId) { setNotice("A cable must connect two different devices"); return; }
    if (isPortUsed(first) || isPortUsed(second)) { setNotice("One of those ports is already connected"); return; }
    if (!ecosystemDevice(firstNode.kind).cables.includes(selectedCableId) || !ecosystemDevice(secondNode.kind).cables.includes(selectedCableId)) {
      setNotice(`${cable.name} is not compatible with both selected devices`);
      return;
    }
    const link: SandboxLink = { id: `link-${Date.now()}`, from: first.nodeId, to: second.nodeId, fromPort: first.port, toPort: second.port, cableId: selectedCableId };
    setPersisted((current) => ({ ...current, topology: { ...current.topology, links: [...current.topology.links, link] } }));
    setSelectedLinkId(link.id);
    setSelectedPort(second);
    setConnectionStart(null);
    setNotice(`${firstNode.name} ${first.port} linked to ${secondNode.name} ${second.port} with ${cable.name}`);
  }

  function handlePortSelect(ref: PortRef) {
    const node = nodeMap.get(ref.nodeId);
    if (!node) return;
    setSelectedId(node.id);
    setSelectedLinkId(null);
    setSelectedPort(ref);
    setSelection([{ kind: "port", id: `${ref.nodeId}:${ref.port}` }]);
    if (tool !== "cable") return;
    if (!connectionStart) {
      setConnectionStart(ref);
      setNotice(`Port start: ${node.name} ${ref.port}. Select a destination port.`);
    } else {
      connectPorts(connectionStart, ref);
    }
  }

  function handleNodeSelection(node: SandboxNode, additive: boolean) {
    const ref: SelectionRef = { kind: "node", id: node.id };
    setSelection((current) => additive ? (current.some((item) => item.kind === "node" && item.id === node.id) ? current.filter((item) => !(item.kind === "node" && item.id === node.id)) : [...current, ref]) : [ref]);
    setSelectedId(node.id);
    setSelectedLinkId(null);
    setSelectedPort(null);
  }

  function handleLinkSelection(link: SandboxLink, additive: boolean) {
    const ref: SelectionRef = { kind: "link", id: link.id };
    setSelection((current) => additive ? (current.some((item) => item.kind === "link" && item.id === link.id) ? current.filter((item) => !(item.kind === "link" && item.id === link.id)) : [...current, ref]) : [ref]);
    setSelectedLinkId(link.id);
    setSelectedId(null);
    setSelectedPort(null);
  }

  function spawnPingProbe(sourceId: string, destination: string): boolean {
    const resolution = resolveProbePath(sourceId, destination, topology, sessions);
    if ("error" in resolution) {
      setLastFeedback(`✕ ${resolution.error}`);
      setNotice("Probe stopped by modeled forwarding state");
      return false;
    }
    const sourceName = topology.nodes.find((node) => node.id === sourceId)?.name || sourceId;
    const requestPath = resolution.path;
    const sourceIp = topology.nodes.find((node) => node.id === sourceId)?.ipv4 || "0.0.0.0";
    let flow = createSimulatedFlow({
      protocol: "icmp",
      source: sourceName,
      destination: resolution.destination.name,
      sourceIp,
      destinationIp: destination,
    });
    const firewall = topology.nodes.find((node) => node.kind === "firewall");
    const firewallIndex = firewall ? requestPath.indexOf(firewall.id) : -1;
    if (firewall && firewallIndex > 0 && firewallIndex < requestPath.length - 1) {
      const beforeFirewall = requestPath[firewallIndex - 1];
      const afterFirewall = requestPath[firewallIndex + 1];
      const ingressLink = topology.links.find((link) => (link.from === beforeFirewall && link.to === firewall.id) || (link.to === beforeFirewall && link.from === firewall.id));
      const egressLink = topology.links.find((link) => (link.from === firewall.id && link.to === afterFirewall) || (link.to === firewall.id && link.from === afterFirewall));
      const firewallSession = firewall ? sessions[firewall.id] : undefined;
      const ingressInterface = ingressLink ? (ingressLink.to === firewall.id ? ingressLink.toPort : ingressLink.fromPort) : undefined;
      const egressInterface = egressLink ? (egressLink.from === firewall.id ? egressLink.fromPort : egressLink.toPort) : undefined;
      const ingressZone = ingressInterface ? firewallSession?.interfaces[ingressInterface]?.nameif : undefined;
      const egressZone = egressInterface ? firewallSession?.interfaces[egressInterface]?.nameif : undefined;
      if (firewallSession && ingressZone && egressZone) {
        const decision = evaluateAsaTraffic(firewallSession, flow, ingressZone, egressZone);
        flow = decision.flow;
        setNotice(decision.reason);
        if (!decision.allowed) {
          setLastFeedback(`✕ ${decision.reason}`);
          return false;
        }
      }
    }
    const burst = flowToPackets(flow, requestPath, "#63e6e2", 5);
   /*
   const legacyBurst = Array.from({ length: 5 }, (_, index) => {
     const sequence = index + 1;
     const requestDelay = index * 0.22;
     const replyDelay = requestDelay + requestPath.length * 1.55;
     return [
       { id: `icmp-request-${Date.now()}-${sequence}`, source: sourceName, destination: resolution.destination.name, path: requestPath, color: "#63e6e2", sequence, direction: "request" as const, startDelay: requestDelay },
       { id: `icmp-reply-${Date.now()}-${sequence}`, source: resolution.destination.name, destination: sourceName, path: replyPath, color: "#f5b74b", sequence, direction: "reply" as const, startDelay: replyDelay },
     ];
   }).flat();
   */
    setPackets((current) => [...current, ...burst]);
    return true;
  }

  function handleNodeClick(node: SandboxNode) {
    if (tool === "erase") {
      setPersisted((current) => ({
        ...current,
        topology: {
          ...current.topology,
          nodes: current.topology.nodes.filter((item) => item.id !== node.id),
          links: current.topology.links.filter((link) => link.from !== node.id && link.to !== node.id),
        },
        sessions: Object.fromEntries(Object.entries(current.sessions).filter(([id]) => id !== node.id)),
      }));
      setSelectedId(null);
      setNotice(`${node.name} removed from the canvas`);
      return;
    }
    setSelectedId(node.id);
    setSelectedLinkId(null);
    setSelectedPort(null);
    if (tool === "cable") {
      if (!cableStart) { setCableStart(node.id); setNotice(`Cable start: ${node.name}. Select a second device.`); }
      else connectNodes(cableStart, node.id);
    }
  }

  function handleNodePointerDown(event: React.PointerEvent<HTMLDivElement>, node: SandboxNode) {
    event.stopPropagation();
    if (tool !== "select" || !canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    dragRef.current = { id: node.id, dx: event.clientX - bounds.left - node.x, dy: event.clientY - bounds.top - node.y };
  }

  function moveLogicalNode(nodeId: string, x: number, y: number) {
    setPersisted((current) => ({ ...current, topology: { ...current.topology, nodes: current.topology.nodes.map((node) => node.id === nodeId ? { ...node, x, y } : node) } }));
  }

  function removeSelectedLink() {
    if (!selectedLinkId) return;
    setPersisted((current) => {
      const link = current.topology.links.find((candidate) => candidate.id === selectedLinkId);
      const sessionsAfterRemoval = link ? removeMacEntriesForLink(current.sessions, current.topology, link) : current.sessions;
      return { ...current, topology: { ...current.topology, links: current.topology.links.filter((candidate) => candidate.id !== selectedLinkId) }, sessions: sessionsAfterRemoval };
    });
    setSelectedLinkId(null);
    setNotice("Cable removed");
  }

  function resetCanvas() {
    selectTemplate(SANDBOX_TEMPLATES["blank"]);
    setNotice("Blank canvas ready");
  }

  function resetMission() {
    const freshState = initialPersisted(activeLabId);
    window.localStorage.removeItem(missionStorageKey(activeLabId));
    setPersisted(freshState);
    setStepIndex(0);
    setLastFeedback("Welcome to the lab. Start with the first objective.");
    setSelectedId(freshState.topology.nodes[0]?.id ?? null);
    setSelectedLinkId(null);
    setCableStart(null);
    setConnectionStart(null);
    setSelectedPort(null);
    setSelection([]);
    setPackets([]);
    setTool("select");
    setTerminalMinimized(false);
    setTerminalHeight(150);
    setShowTerminal(true);
    setTerminalInput("");
    dragRef.current = null;
    setNotice(freshState.topology.name + " reset");
  }

   function submitTerminal(value = terminalInput) {
    if (!selectedNode || !selectedSession) return;
    const raw = value.trim();
    if (!raw) return;
    const command = normalizeCommand(raw);
    const prompt = modePrompt(selectedNode.name, selectedSession);
    
    // 1. Create the initial history entry (The command the user typed)
    const history = [...selectedSession.history, `${prompt} ${raw}`];
    let finalHistory = [...history];
    let finalMode = selectedSession.mode;
    let finalContext = selectedSession.context;
    let modeledSession = selectedSession;
    let dhcpResolution: DhcpResolution | null = null;

    // 2. Check Guided Mission Logic
    if (currentStep) {
      const isCorrectDevice = selectedNode.name === currentStep.targetDevice;
      const isCorrectMode = selectedSession.mode === currentStep.requiredMode;
      const isCorrectCmd = command === normalizeCommand(currentStep.expectedCommand);

      const isCiscoValid = isValidCommand(command, finalMode) && supportsCommand(command, selectedNode.kind, selectedSession.context);
      if (isCorrectDevice && isCorrectMode && isCorrectCmd && isCiscoValid) {
        // SUCCESS: Update the mission rail
        setLastFeedback(`✓ ${raw}: ${currentStep.successMessage}`);
        setStepIndex(prev => prev + 1);
        
        // Add the success message to the terminal output as well
        finalHistory.push(`[MISSION] ${currentStep.successMessage}`);
      } else if (isCorrectDevice && isCorrectMode && !isCorrectCmd) {
        setLastFeedback(`✕ Incorrect command. Expected: ${currentStep.expectedCommand}`);
      } else if (isCorrectDevice && isCorrectMode && !isCiscoValid) {
        setLastFeedback(`✕ The command is not valid in Cisco IOS ${finalMode} mode.`);
      } else {
        setLastFeedback(`✕ Context mismatch. Expected ${currentStep.targetDevice} in ${currentStep.requiredMode} mode.`);
      }
    }

    // 3. General IOS Simulator Logic (This ALWAYS runs now)
    if (!isValidCommand(command, finalMode) || !supportsCommand(command, selectedNode.kind, selectedSession.context)) {
      finalHistory.push("% Invalid input detected at '^' marker.");
      finalHistory.push(`Hint: Current mode is ${finalMode}.`);
    } else {
      // Calculate mode transition (e.g., user -> privileged)
      const transitioned = applyCommand(selectedSession, raw, finalHistory);
      finalMode = transitioned.mode;
      finalContext = transitioned.context;
      
      // Get the actual IOS output for this command
      const nextSession = applyCommand(selectedSession, raw, finalHistory);
      modeledSession = nextSession;
      const probeStarted = command.startsWith("ping ") ? spawnPingProbe(selectedNode.id, command.slice(5)) : true;
      const output = outputFor(command, selectedNode, topology, nextSession, sessions);
      if (!command.startsWith("ping ") || probeStarted) finalHistory.push(...output);
      else finalHistory.push(`% Probe stopped: modeled forwarding state rejected ${command}.`);
      if (command === "ip address dhcp" && nextSession.context) {
        dhcpResolution = resolveDhcpLease(selectedNode.id, nextSession.context, topology, sessions, nextSession);
        if ("error" in dhcpResolution) {
          finalHistory.push(dhcpResolution.error);
        } else {
          modeledSession = dhcpResolution.clientSession;
          finalHistory.push(...dhcpResolution.output);
        }
      }
      if (command.startsWith("nslookup ")) {
        const name = command.slice("nslookup ".length).trim();
        const dnsResolution = resolveDnsName(selectedNode.id, name, topology, sessions);
        if ("error" in dnsResolution) {
          finalHistory.push(dnsResolution.error);
        } else {
          modeledSession = { ...modeledSession, dnsCache: { ...modeledSession.dnsCache, [dnsResolution.name.toLowerCase()]: dnsResolution.address } };
          finalHistory.push(`Server: ${topology.nodes.find((node) => node.id === dnsResolution.serverId)?.name || dnsResolution.serverId}`, `Name: ${dnsResolution.name}`, `Address: ${dnsResolution.address}`);
        }
      }
      if (command === "power inline auto" && selectedNode.kind === "switch" && nextSession.context) {
        const poeResult = negotiatePoe(selectedNode, nextSession.context, topology, modeledSession);
        modeledSession = poeResult.session;
        finalHistory.push(...poeResult.output);
      }
    }

    // 4. Update the state once for everything
    setPersisted((current) => {
      let nextSessions = ageMacTables(current.sessions);
      nextSessions = {
        ...nextSessions,
        [selectedNode.id]: { ...modeledSession, mode: finalMode, context: finalContext, history: finalHistory },
        ...(dhcpResolution && !("error" in dhcpResolution) ? { [dhcpResolution.serverId]: dhcpResolution.serverSession, ...dhcpResolution.learnedSessions } : {}),
      };
      if (command === "shutdown" && selectedSession.context) {
        nextSessions = removeMacEntriesForPort(nextSessions, selectedNode.id, selectedSession.context);
        for (const link of topology.links.filter((candidate) => (candidate.from === selectedNode.id && candidate.fromPort === selectedSession.context) || (candidate.to === selectedNode.id && candidate.toPort === selectedSession.context))) {
          nextSessions = removeMacEntriesForLink(nextSessions, topology, link);
        }
      }
      nextSessions = reconcileOspfRoutes(current.topology, nextSessions);
      return { ...current, sessions: nextSessions };
    });
    
    setTerminalInput("");
  }


  const linkLines = topology.links.map((link) => {
    const from = nodeMap.get(link.from);
    const to = nodeMap.get(link.to);
    if (!from || !to) return null;
    return { link, x1: from.x + 90, y1: from.y + 48, x2: to.x + 90, y2: to.y + 48, midX: (from.x + to.x) / 2 + 90, midY: (from.y + to.y) / 2 + 48 };
  }).filter(Boolean) as { link: SandboxLink; x1: number; y1: number; x2: number; y2: number; midX: number; midY: number }[];

  return (
    <main className="min-h-screen bg-[#0a1017] text-[#edf4f3]">
      <header className="flex items-center justify-between border-b border-white/10 bg-[#0b1118]/95 px-5 py-4 lg:px-8">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onExit} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#63e6e2]/35 bg-[#10252b] text-[#63e6e2]" aria-label="Back to curriculum">
            <Network className="h-5 w-5" />
          </button>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[.22em] text-[#63e6e2]">IPv6 CLI Lab</div>
            <div className="font-display text-lg font-semibold">Network Sandbox</div>
          </div>
        </div>
        <div className="hidden items-center gap-3 text-[10px] font-mono uppercase tracking-[.16em] text-[#84969d] sm:flex">
          <span>CONSTRUCTION ENTERPRISES</span>
          <span className="h-1.5 w-1.5 rounded-full bg-[#63e6e2] shadow-[0_0_10px_#63e6e2]" />
          <span>TOPOLOGY WORKSPACE</span>
        </div>
        <button type="button" onClick={onExit} className="text-xs text-[#8ea0a7] hover:text-white">Back to curriculum</button>
      </header>

      <div className="border-b border-white/10 bg-[#0d151e] px-5 py-3 lg:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="instrument-label shrink-0">SANDBOX / {notice}</div>
            <div className="hidden h-px w-24 bg-gradient-to-r from-[#63e6e2] to-transparent md:block" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" className="border-white/15 bg-transparent text-[#98aab0] hover:bg-white/10 hover:text-white" onClick={resetCanvas}>
              <Plus className="mr-2 h-3.5 w-3.5" /> New canvas
            </Button>
            <Button variant="outline" size="sm" className="border-white/15 bg-transparent text-[#98aab0] hover:bg-white/10 hover:text-white" onClick={saveScenario}>
              <Save className="mr-2 h-3.5 w-3.5" /> Save
            </Button>
            <Button variant="outline" size="sm" className="border-[#63e6e2]/30 bg-transparent text-[#63e6e2] hover:bg-[#63e6e2]/10" onClick={exportAsLabDefinition}>
              <Copy className="mr-2 h-3.5 w-3.5" /> Export as Lab
            </Button>
            <Button size="sm" className="bg-[#f5b74b] text-[#1c160b] hover:bg-[#ffca69]" onClick={shareScenario}>
              <Share2 className="mr-2 h-3.5 w-3.5" /> Share
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:[grid-template-columns:var(--workspace-width)_minmax(0,1fr)_var(--mission-width)]" style={{ "--workspace-width": workspaceCollapsed ? "48px" : `${workspaceWidth}px`, "--mission-width": missionCollapsed ? "48px" : `${missionWidth}px` } as React.CSSProperties}>
        <aside className={`relative border-b border-white/10 bg-[#0d151e] lg:min-h-[calc(100vh-118px)] lg:border-b-0 lg:border-r ${workspaceCollapsed ? "p-2" : "p-4"}`}>
          <div className="mb-5 flex items-center justify-between">
            <div className={workspaceCollapsed ? "hidden" : ""}>
              <div className="instrument-label">WORKSPACE</div>
              <div className="mt-1 text-sm text-[#b8c5c8]">Build a topology</div>
            </div>
            {workspaceCollapsed ? <MousePointer2 className="mx-auto h-4 w-4 text-[#63e6e2]" /> : <button type="button" onClick={() => setWorkspaceCollapsed(true)} className="rounded p-1 text-[#71828a] hover:bg-white/10 hover:text-white" aria-label="Minimize workspace panel"><PanelLeftClose className="h-4 w-4" /></button>}
          </div>
          {workspaceCollapsed && <button type="button" onClick={() => setWorkspaceCollapsed(false)} className="absolute inset-x-2 top-14 rounded border border-white/10 p-1.5 text-[#63e6e2] hover:bg-[#173038]" aria-label="Expand workspace panel"><PanelLeftClose className="mx-auto h-4 w-4 rotate-180" /></button>}
          <div className={workspaceCollapsed ? "hidden" : ""}>
          <details className="group mb-3 rounded-lg border border-white/10 bg-[#101a23]" open={activeFilters.length > 0 || Boolean(deviceQuery)}>
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[10px] uppercase tracking-wider text-[#b8c5c8]">
              <span>Filters {activeFilters.length > 0 ? `· ${activeFilters.length}` : ""}</span><span className="text-[#63e6e2] transition group-open:rotate-180">⌄</span>
            </summary>
            <div className="border-t border-white/10 p-3">
              <input value={deviceQuery} onChange={(event) => setDeviceQuery(event.target.value)} placeholder="Search devices or tags" className="mb-2 w-full rounded-lg border border-white/10 bg-[#0d151e] px-3 py-2 text-xs text-white outline-none placeholder:text-[#60747c] focus:border-[#63e6e2]/50" aria-label="Filter devices or tags" />
              <div className="flex flex-wrap gap-1">
                <button type="button" onClick={() => setActiveFilters([])} className={`rounded-full border px-2 py-1 text-[9px] ${activeFilters.length === 0 ? "border-[#63e6e2]/50 bg-[#63e6e2]/10 text-[#63e6e2]" : "border-white/10 text-[#71828a]"}`}>all</button>
                {deviceTags.map((tag) => <button type="button" key={tag} onClick={() => setActiveFilters((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])} className={`rounded-full border px-2 py-1 text-[9px] ${activeFilters.includes(tag) ? "border-[#f5b74b]/60 bg-[#f5b74b]/10 text-[#f5d992]" : "border-white/10 text-[#71828a]"}`}>{tag}</button>)}
              </div>
            </div>
          </details>
          <details className="group mb-4 rounded-lg border border-white/10 bg-[#101a23]">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[10px] uppercase tracking-wider text-[#b8c5c8]"><span>Devices</span><span className="text-[#63e6e2] transition group-open:rotate-180">⌄</span></summary>
            <div className="max-h-[360px] space-y-2 overflow-y-auto border-t border-white/10 p-2">
            {filteredDevices.map((device) => {
              const Icon = iconFor(device.kind);
              const title = device.name;
              const detail = device.defaultRole;
              return (
                <button type="button" key={device.id} onClick={() => addDevice(device.kind)} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#111c27] p-3 text-left transition hover:border-[#63e6e2]/40 hover:bg-[#173038]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#10252b] text-[#63e6e2]">
                    <Icon className="h-4 w-4" />
                  </span>
                    <span>
                      <span className="block text-xs font-semibold text-white">{title}</span>
                      <span className="block text-[10px] text-[#778890]">{detail}</span>
                      <span className="mt-1 block truncate text-[9px] text-[#63e6e2]/70">{(device.tags || []).slice(0, 3).join(" · ")}</span>
                  </span>
                  <Plus className="ml-auto h-3.5 w-3.5 text-[#6b7d84]" />
                </button>
              );
            })}
            {filteredDevices.length === 0 && <p className="px-2 py-3 text-xs text-[#71828a]">No devices match the current filters.</p>}
            </div>
          </details>
          <details className="group mt-6 border-t border-white/10 pt-5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[10px] uppercase tracking-wider text-[#b8c5c8]"><span>Scenarios</span><span className="text-[#63e6e2] transition group-open:rotate-180">⌄</span></summary>
            <div className="mt-3">
              {Object.entries(SANDBOX_TEMPLATES).map(([id, template]) => (
                <button key={id} type="button" onClick={() => selectTemplate(template, id)} className="mb-2 w-full rounded-lg border border-white/10 bg-[#111c27] px-3 py-2 text-left text-xs text-[#8ea0a7] hover:border-white/25 hover:text-white">{template.name}</button>
              ))}
              <div className="mt-2 space-y-1">
                {savedTopologies.slice(0, 4).map((saved) => (
                  <button type="button" key={saved.name} onClick={() => selectTemplate(saved)} className="block w-full truncate px-3 py-1.5 text-left text-[10px] text-[#667a82] hover:text-[#c5d2d3]">↳ {saved.name}</button>
                ))}
              </div>
            </div>
          </details>
          </div>
          {!workspaceCollapsed && <button type="button" onPointerDown={(event) => { event.preventDefault(); resizeRef.current = { side: "workspace", startX: event.clientX, startWidth: workspaceWidth }; }} className="absolute -right-2 top-0 z-30 hidden h-full w-4 cursor-col-resize items-center justify-center text-[#3b555c] hover:text-[#63e6e2] lg:flex" aria-label="Resize workspace panel"><GripVertical className="h-5 w-5" /></button>}
        </aside>

        <section className="min-w-0 p-4 lg:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="instrument-label text-[#f5b74b]">TOPOLOGY / {topology.name}</div>
              <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-white">{topology.name}</h1>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-[#8fa0a7]">{topology.description}</p>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[#6f8289]">
              <span>{topology.nodes.length} devices</span>
              <span>·</span>
              <span>{topology.links.length} links</span>
              <span>·</span>
            <span className="text-[#63e6e2]">{tool === "cable" ? cableStart ? "select destination" : "select cable start" : "select / drag"}</span>
          </div>
          </div>
          <div className="mb-3 flex items-center justify-between rounded-lg border border-white/10 bg-[#101a23] p-1">
            <div className="flex items-center gap-2">
              <details className="relative group">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#b8c5c8] hover:bg-white/5"><span>Controls</span><span className="text-[#63e6e2] transition group-open:rotate-180">⌄</span></summary>
                <div className="absolute left-0 top-full z-40 mt-1 w-64 rounded-lg border border-white/10 bg-[#101a23] p-2 shadow-2xl">
                  <div className="grid grid-cols-2 gap-1">
                    <button type="button" onClick={() => { setTool("select"); setCableStart(null); }} className={`rounded-md px-2 py-2 text-[10px] uppercase tracking-wider transition ${tool === "select" ? "bg-[#173038] text-[#63e6e2]" : "text-[#71828a] hover:bg-white/5 hover:text-white"}`}><MousePointer2 className="mx-auto mb-1 h-3.5 w-3.5" />Select</button>
                    <button type="button" onClick={() => setTool("pan")} className={`rounded-md px-2 py-2 text-[10px] uppercase tracking-wider transition ${tool === "pan" ? "bg-[#173038] text-[#63e6e2]" : "text-[#71828a] hover:bg-white/5 hover:text-white"}`}><Hand className="mx-auto mb-1 h-3.5 w-3.5" />Pan</button>
                    <button type="button" onClick={() => { setTool("cable"); setCableStart(null); }} className={`rounded-md px-2 py-2 text-[10px] uppercase tracking-wider transition ${tool === "cable" ? "bg-[#173038] text-[#63e6e2]" : "text-[#71828a] hover:bg-white/5 hover:text-white"}`}><Cable className="mx-auto mb-1 h-3.5 w-3.5" />Cable</button>
                    <button type="button" onClick={() => { setTool("erase"); setCableStart(null); }} className={`rounded-md px-2 py-2 text-[10px] uppercase tracking-wider transition ${tool === "erase" ? "bg-[#3a2024] text-[#ff8d8d]" : "text-[#71828a] hover:bg-white/5 hover:text-white"}`} title="Remove a device from the canvas"><Eraser className="mx-auto mb-1 h-3.5 w-3.5" />Erase</button>
                  </div>
                  <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                    <button type="button" onClick={() => setSnapToGrid((value) => !value)} className={`flex w-full items-center justify-between rounded-md border px-2 py-2 text-[10px] uppercase tracking-wider transition ${snapToGrid ? "border-[#63e6e2]/40 bg-[#173038] text-[#63e6e2]" : "border-white/10 bg-[#0d151e] text-[#71828a] hover:text-white"}`}><span className="flex items-center gap-2"><Magnet className="h-3.5 w-3.5" />Snap to grid</span><span>{snapToGrid ? "ON" : "OFF"}</span></button>
                    <button type="button" onClick={() => setShowAxes((value) => !value)} className={`flex w-full items-center justify-between rounded-md border px-2 py-2 text-[10px] uppercase tracking-wider transition ${showAxes ? "border-[#63e6e2]/40 bg-[#173038] text-[#63e6e2]" : "border-white/10 bg-[#0d151e] text-[#71828a] hover:text-white"}`} aria-pressed={showAxes}><span>XYZ coordinate widget</span><span>{showAxes ? "ON" : "OFF"}</span></button>
                  </div>
                </div>
              </details>
              <span className="px-1 font-mono text-[10px] uppercase tracking-[.16em] text-[#71878e]">Viewport</span>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => setViewportMode("schematic")} className={`rounded-md px-3 py-1.5 text-[10px] uppercase tracking-wider ${viewportMode === "schematic" ? "bg-[#173038] text-[#63e6e2]" : "text-[#71828a] hover:text-white"}`}>Schematic</button>
              <button type="button" onClick={() => setViewportMode("logical")} className={`rounded-md px-3 py-1.5 text-[10px] uppercase tracking-wider ${viewportMode === "logical" ? "bg-[#173038] text-[#63e6e2]" : "text-[#71828a] hover:text-white"}`}>Logical</button>
              <button type="button" onClick={() => setViewportMode("3d")} className={`rounded-md px-3 py-1.5 text-[10px] uppercase tracking-wider ${viewportMode === "3d" ? "bg-[#173038] text-[#63e6e2]" : "text-[#71828a] hover:text-white"}`}>3D Physical</button>
            </div>
          </div>
          {viewportMode === "3d" ? (
            <ThreeSandboxViewport topology={topology} selection={selection} activeFilters={activeFilters} sessions={sessions} showAxes={showAxes} packets={packets} onPacketComplete={(id) => setPackets((current) => current.filter((packet) => packet.id !== id))} connectionStart={connectionStart} selectedPort={selectedPort} selectedCableId={selectedCableId} onSelectNode={handleNodeSelection} onSelectPort={handlePortSelect} onSelectLink={handleLinkSelection} />
          ) : viewportMode === "logical" ? (
            <LogicalDiagramViewport topology={topology} sessions={sessions} selection={selection} snapToGrid={snapToGrid} onMoveNode={moveLogicalNode} onSelectNode={handleNodeSelection} onSelectPort={handlePortSelect} onSelectLink={handleLinkSelection} />
          ) : <div className="overflow-auto rounded-xl border border-white/10 bg-[#080d13] shadow-2xl">
            <div ref={canvasRef} className="relative min-h-[610px] min-w-[1120px] overflow-hidden" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(99,230,226,.12) 1px, transparent 0)", backgroundSize: "24px 24px" }} onClick={() => { if (tool === "cable") { setCableStart(null); setNotice("Cable mode ready"); } else { setSelectedLinkId(null); } }}>
                <div className="absolute left-5 top-5 font-mono text-[10px] uppercase tracking-[.2em] text-[#3b555c]">FIELD CANVAS / {topology.name} / CAD MODE</div>
              <svg className="pointer-events-none absolute inset-0" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} aria-label="Topology links">
                {linkLines.map(({ link, x1, y1, x2, y2, midX, midY }) => (
                  <g key={link.id}>
                    <polyline points={[x1 + "," + y1, midX + "," + y1, midX + "," + y2, x2 + "," + y2].join(" ")} fill="none" stroke={selectedLinkId === link.id ? "#f5b74b" : "#3ac9c6"} strokeWidth={selectedLinkId === link.id ? 3 : 2} strokeDasharray={selectedLinkId === link.id ? "8 5" : undefined} />
                    <circle cx={x1} cy={y1} r="4" fill="#63e6e2" />
                    <circle cx={x2} cy={y2} r="4" fill="#63e6e2" />
                    <text x={midX} y={midY - 8} fill="#71878e" fontSize="9" textAnchor="middle" fontFamily="IBM Plex Mono, monospace">{link.fromPort} ↔ {link.toPort} / {NETWORK_CABLES.find((cable) => cable.id === link.cableId)?.name || "Ethernet"}</text>
                  </g>
                ))}
              </svg>
              {topology.nodes.map((node) => {
                const Icon = iconFor(node.kind);
                const isSelected = selectedId === node.id;
                const isCableStart = cableStart === node.id;
                return (
                  <div 
                    key={node.id} 
                    role="button" 
                    tabIndex={0} 
                    aria-label={`Select ${node.name}`} 
                    onClick={(event) => { event.stopPropagation(); handleNodeClick(node); }} 
                    onPointerDown={(event) => handleNodePointerDown(event, node)} 
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleNodeClick(node); } }} 
                    className={`absolute w-[180px] cursor-grab rounded-xl border p-3 text-left shadow-xl transition active:cursor-grabbing ${isSelected ? "border-[#63e6e2]/80 bg-[#142f35] shadow-[0_0_30px_rgba(99,230,226,.14)]" : "border-white/10 bg-[#111a23] hover:border-white/25"} ${isCableStart ? "ring-2 ring-[#f5b74b]" : ""}`} 
                    style={{ left: node.x, top: node.y }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0b2229] text-[#63e6e2]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-xs text-[#dce9e9]">{node.name}</span>
                        <span className="block truncate text-[10px] text-[#78909a]">{node.role}</span>
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 font-mono text-[9px] text-[#66818a]">
                      <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#63e6e2]" /> linked</span>
                      <span>{node.ports.length} ports</span>
                    </div>
                  </div>
                );
              })}
              {topology.nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Network className="mx-auto h-8 w-8 text-[#3b55c]" />
                    <p className="mt-3 text-sm text-[#6f8188]">Blank canvas. Add a device from the palette.</p>
                  </div>
                </div>
              )}
            </div>
          </div>}

          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_320px]">
            <div className="rounded-xl border border-white/10 bg-[#111a23] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="instrument-label text-[#63e6e2]">LINK INVENTORY</div>
                  <div className="mt-1 text-xs text-[#84969d]">Select a cable to inspect or remove it.</div>
                </div>
                <details className="relative group">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-white/10 bg-[#0d151e] px-3 py-2 text-[10px] text-[#b8c5c8]">Cable / connector <span className="text-[#63e6e2]">⌄</span></summary>
                  <div className="absolute right-0 z-10 mt-1 w-72 rounded-lg border border-white/10 bg-[#101a23] p-2 shadow-2xl">
                    <select value={selectedCableId} onChange={(event) => setSelectedCableId(event.target.value)} className="w-full rounded border border-white/10 bg-[#0d151e] px-2 py-2 text-[10px] text-[#b8c5c8] outline-none" aria-label="Cable type">
                      {NETWORK_CABLES.map((cable) => <option key={cable.id} value={cable.id}>{cable.name}</option>)}
                    </select>
                    {(() => { const cable = NETWORK_CABLES.find((item) => item.id === selectedCableId); return cable ? <p className="mt-2 text-[10px] leading-4 text-[#82979e]">{cable.connector} · {cable.description}</p> : null; })()}
                  </div>
                </details>
                {selectedLinkId && (
                  <Button variant="outline" size="sm" className="border-[#f07178]/35 bg-transparent text-[#f07178] hover:bg-[#f07178]/10" onClick={removeSelectedLink}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove cable
                  </Button>
                )}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {topology.links.map((link) => {
                  const from = nodeMap.get(link.from);
                  const to = nodeMap.get(link.to);
                  return (
                    <button type="button" key={link.id} onClick={() => setSelectedLinkId(link.id)} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-[10px] ${selectedLinkId === link.id ? "border-[#f5b74b]/45 bg-[#f5b74b]/10" : "border-white/10 bg-[#0d151e] hover:border-white/20"}`}>
                      <span className="min-w-0 truncate font-mono text-[#b2c1c3]">{from?.name} <span className="text-[#63e6e2]">{link.fromPort} ↔ {link.toPort}</span> {to?.name}</span>
                      <span className="ml-2 flex shrink-0 items-center gap-1 text-[#63e6e2]"><span className="h-1.5 w-1.5 rounded-full bg-[#63e6e2]" /> up</span>
                    </button>
                  );
                })}
                {topology.links.length === 0 && <div className="text-xs text-[#6f8188]">No links yet. Choose Cable, then select two devices.</div>}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#111a23] p-4">
              <div className="instrument-label">DEVICE / PORT INSPECTOR</div>
              {selection.length > 1 ? (
                <>
                  <div className="mt-2 font-mono text-sm text-[#f5b74b]">{selection.length} objects selected</div>
                  <div className="mt-2 space-y-1 text-[10px] text-[#9aadb1]">
                    {selection.map((item) => {
                      const node = item.kind === "node" ? nodeMap.get(item.id) : null;
                      const link = item.kind === "link" ? topology.links.find((candidate) => candidate.id === item.id) : null;
                      return <div key={`${item.kind}-${item.id}`} className="rounded border border-white/10 bg-[#0d151e] px-2 py-1.5">{node ? `${node.name} · ${node.kind}` : link ? `Cable · ${NETWORK_CABLES.find((cable) => cable.id === link.cableId)?.name || "Ethernet"}` : item.id}</div>;
                    })}
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-[#82979e]">Ctrl/Cmd-click objects to add or remove them from the selection. Select one device and one cable to inspect their relationship.</p>
                  <div className="mt-3 rounded border border-[#f5b74b]/20 bg-[#f5b74b]/5 px-2 py-2 text-[10px] leading-4 text-[#d8bd7a]">Physical cabling and IOS configuration are separate state machines. Use the IOS console for interface, VLAN, trunk, and shutdown commands; the simulator will not invent a non-Cisco cable-assignment command.</div>
                </>
              ) : selectedNode ? (
                <TabbedInspector
                  node={selectedNode}
                  session={selectedSession!}
                  topology={topology}
                  selectedPort={selectedPort}
                  onSelectPort={handlePortSelect}
                  onOpenConsole={() => setShowTerminal(true)}
                />
              ) : selectedLinkId ? (() => {
                const link = topology.links.find((item) => item.id === selectedLinkId);
                const from = link ? nodeMap.get(link.from) : null;
                const to = link ? nodeMap.get(link.to) : null;
                const cable = link ? NETWORK_CABLES.find((item) => item.id === link.cableId) : null;
                return link ? <>
                  <div className="mt-2 font-mono text-sm text-[#63e6e2]">Cable connection</div>
                  <p className="mt-2 text-xs text-[#b8c5c8]">{cable?.name || "Ethernet"}</p>
                  <p className="mt-1 text-[10px] text-[#82979e]">{from?.name} · {link.fromPort} ↔ {to?.name} · {link.toPort}</p>
                  <p className="mt-2 text-[10px] leading-4 text-[#82979e]">{cable?.description || "Modeled Ethernet connection."}</p>
                </> : <p className="mt-2 text-xs text-[#758890]">Select an object to inspect its current state.</p>;
              })() : (
                <p className="mt-2 text-xs text-[#758890]">Select an object to inspect its current state.</p>
              )}
            </div>
          </div>
        </section>

                {/* Right Panel: Lab Instructions */}
        <aside className={`relative border-l border-white/10 bg-[#0d151e] lg:sticky lg:top-4 lg:max-h-[calc(100vh-7.5rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:min-h-[calc(100vh-118px)] ${missionCollapsed ? "p-2" : "p-4"}`}>
          <div className="mb-5 flex items-center justify-between">
            <div className={missionCollapsed ? "hidden" : ""}>
              <div className="instrument-label">MISSION BRIEF</div>
              <div className="mt-1 text-sm text-[#b8c5c8]">Guided Objectives</div>
            </div>
            {missionCollapsed ? <BookOpen className="mx-auto h-4 w-4 text-[#f5b74b]" /> : <button type="button" onClick={() => setMissionCollapsed(true)} className="rounded p-1 text-[#71828a] hover:bg-white/10 hover:text-white" aria-label="Minimize mission brief panel"><PanelRightClose className="h-4 w-4" /></button>}
          </div>
          {missionCollapsed && <button type="button" onClick={() => setMissionCollapsed(false)} className="absolute inset-x-2 top-14 rounded border border-white/10 p-1.5 text-[#f5b74b] hover:bg-[#2d2518]" aria-label="Expand mission brief panel"><PanelRightClose className="mx-auto h-4 w-4 rotate-180" /></button>}
          <div className={missionCollapsed ? "hidden" : ""}>
          
          {config?.steps && config.steps.length > 0 ? (
            <div className="space-y-6">
              {stepIndex < config.steps.length ? (
                <>
                  {/* Current Step Area - Compact Stack */}
                  <div className="rounded-xl border border-[#f5b74b]/30 bg-[#f5b74b]/5 p-4">

                    {/* CURRENT COMMAND SECTION */}
                    <div className="mb-6">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-[#f5b74b] mb-1">Current Command:</div>
                      <div className="font-mono text-lg font-bold text-[#63e6e2] bg-black/60 p-3 rounded border border-[#63e6e2]/30 shadow-inner">
                        {currentStep?.expectedCommand}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[#aebbc0] italic">
                        {currentStep?.description}
                      </p>
                    </div>

                    {/* DIVIDER */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-px flex-1 bg-white/10"></div>
                      <div className="text-[9px] font-mono uppercase text-[#667a82]">Next Up</div>
                      <div className="h-px flex-1 bg-white/10"></div>
                    </div>

                    {/* NEXT COMMAND SECTION (Compact) */}
                    {stepIndex < (config.steps?.length ?? 0) - 1 ? (
                      <div className="bg-black/30 p-3 rounded border border-white/5">
                        <div className="font-mono text-sm font-medium text-white/70 mb-1">
                          {config.steps[stepIndex + 1]?.label}
                        </div>
                        <div className="font-mono text-xs text-[#63e6e2]/60">
                          {config.steps[stepIndex + 1]?.expectedCommand}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-2 text-[10px] font-mono text-[#667a82] italic">
                        Final objective in progress...
                      </div>
                    )}

                    {/* CONTEXT FOOTER */}
                    <div className="mt-4 flex gap-2 text-[10px] font-mono text-[#f4d998] bg-black/20 p-2 rounded border border-white/5">
                      <span className="opacity-70">Device: {currentStep?.targetDevice || "---"}</span>
                      <span className="opacity-40">|</span>
                      <span className="opacity-70">Mode: {currentStep?.requiredMode || "---"}</span>
                    </div>
                  </div>

                </>
              ) : (
                /* MISSION COMPLETE STATE */
                <div className="text-center py-10 rounded-xl border-2 border-dashed border-[#63e6e2]/30 bg-[#63e6e2]/5">
                  <div className="flex justify-center mb-4">
                    <div className="rounded-full bg-[#63e6e2] p-2 text-[#0b121a]">
                      <Check className="h-6 w-6" />
                    </div>
                  </div>
                  <div className="text-lg font-bold text-white">Mission Accomplished!</div>
                  <p className="mt-2 text-xs text-[#8fa0a7] px-4">All guided objectives for this scenario have been completed successfully.</p>
                  <Button size="sm" className="mt-6 bg-[#63e6e2] text-[#0b121a] hover:bg-[#4bc2be]" onClick={resetMission}>
                    Restart Mission
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="text-xs text-[#667a82]">No guided steps for this sandbox. Free-play mode enabled.</div>
            </div>
          )}
          {selectedNode && selectedSession && <div className="mt-5"><NetworkDeviceSchematic node={selectedNode} session={selectedSession} selectedPort={selectedPort} /></div>}
          </div>
          {!missionCollapsed && <button type="button" onPointerDown={(event) => { event.preventDefault(); resizeRef.current = { side: "mission", startX: event.clientX, startWidth: missionWidth }; }} className="absolute -left-2 top-0 z-30 hidden h-full w-4 cursor-col-resize items-center justify-center text-[#3b555c] hover:text-[#f5b74b] lg:flex" aria-label="Resize mission brief panel"><GripVertical className="h-5 w-5" /></button>}
        </aside>
      </div>

      {showTerminal && selectedNode && selectedSession && (
        <section className={`sticky bottom-0 z-20 flex flex-col border-t border-[#63e6e2]/25 bg-[#0b121a]/95 px-4 py-3 shadow-[0_-20px_50px_rgba(0,0,0,.45)] backdrop-blur lg:px-8 ${terminalMinimized ? "h-12" : ""}`} style={terminalMinimized ? undefined : { height: `${terminalHeight}px` }}>
          <button type="button" onPointerDown={(event) => { event.preventDefault(); resizeRef.current = { side: "terminal", startY: event.clientY, startHeight: terminalHeight }; }} className="absolute -top-3 inset-x-0 z-30 mx-auto flex h-6 w-24 cursor-row-resize items-center justify-center rounded-t border border-white/10 bg-[#101a23] text-[#536b73] hover:text-[#63e6e2]" aria-label="Resize IOS console"><GripVertical className="h-4 w-4 rotate-90" /></button>
          <div className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <SquareTerminal className="h-4 w-4 shrink-0 text-[#63e6e2]" />
                <span className="font-mono text-[10px] uppercase tracking-[.16em] text-[#738890]">IOS-SIM / {selectedNode.name}</span>
                <span className="hidden truncate text-[10px] text-[#53666e] sm:block">{selectedRole}</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="text-[#70838b] hover:text-white" onClick={() => setTerminalMinimized((value) => !value)} aria-label={terminalMinimized ? "Restore IOS console" : "Minimize IOS console"}>
                  {terminalMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                </button>
                <button type="button" className="text-[#70838b] hover:text-white" onClick={() => setShowTerminal(false)} aria-label="Close IOS console">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {!terminalMinimized && <div className="mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-auto rounded-lg border border-white/10 bg-[#080e14] p-3 font-mono text-[11px] leading-5">
              <div className="text-[#637b83]">Full IOS vocabulary · shared console engine · enter one command, then press Enter.</div>
              {selectedSession.history.slice(-7).map((line, index) => (
                <div key={`${line}-${index}`} className={line.startsWith("%") ? "text-[#f07178]" : line.startsWith("Hint:") ? "text-[#f5b74b]" : line.startsWith("✓") ? "text-[#b5d4d4]" : "text-[#9fb1b5]"}>{line || "\u00a0"}</div>
              ))}
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[#63e6e2]">{modePrompt(selectedNode.name, selectedSession)}</span>
                <input 
                  autoFocus 
                  value={terminalInput} 
                  onChange={(event) => setTerminalInput(event.target.value)} 
                  onKeyDown={(event) => event.key === "Enter" && submitTerminal()} 
                  className="min-w-0 flex-1 bg-transparent text-[#edf4f3] outline-none placeholder:text-[#3f555d]" 
                  placeholder="type full IOS command..." 
                  aria-label="IOS command" 
                />
              </div>
            </div>}
          </div>
        </section>
      )}
    </main>
  );
}
