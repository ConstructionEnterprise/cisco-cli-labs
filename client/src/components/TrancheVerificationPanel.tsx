import { useEffect, useMemo, useState } from "react";
import { Minimize2, Network, Router, Table2 } from "lucide-react";
import { modeledDeviceMac, type Session } from "@/lib/ios-engine";
import ResizeGrabBar from "@/components/ResizeGrabBar";
import { interfaceRelationships, interfaceVlan, vlanAllowed, protocolEvidence, leaseState, electionEvidence, ospfOperationalEvidence, type OspfOperationalEvidence } from '@/lib/operational-evidence';
import { aclEntries } from '@/lib/ipv4-policy';
import { ipv4Routes } from '@/lib/sandbox-network-engine';
import type { LabConfig } from '@/labs/labDefinitions';

type VerificationTab = "interfaces" | "routes" | "vlans" | "stp" | "arp" | "mac" | "ipv6neighbors" | "cdp" | "trunks" | "etherchannels" | "acls" | "natpat" | "transport" | "dhcp" | "ospf" | "drbdr" | "fhrp";
type MacView = "device" | "learned";

const tabs: Array<{ id: VerificationTab; label: string }> = [
  { id: "interfaces", label: "IP Interfaces" },
  { id: "routes", label: "IPv4 Routes" },
  { id: "vlans", label: "VLANs" },
  { id: "stp", label: "STP" },
  { id: "arp", label: "ARP" },
  { id: "mac", label: "MAC Address" },
  { id: "ipv6neighbors", label: "IPv6 Neighbors" },
  { id: "cdp", label: "CDP" },
  { id: "trunks", label: "Trunks" },
  { id: "etherchannels", label: "EtherChannels" },
  { id: "acls", label: "ACLs" },
  { id: "natpat", label: "NAT / PAT" },
  { id: "transport", label: "Transport / Flows" },
  { id: "dhcp", label: "DHCP" },
  { id: "ospf", label: "OSPF" },
  { id: "drbdr", label: "DR / BDR" },
  { id: "fhrp", label: "FHRP" },
];

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-white/10 bg-[#0b141d] px-4 py-7 text-center font-mono text-[10px] text-[#71828a]">{message}</div>;
}

function Table({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) {
  if (!rows.length) return <EmptyState message="No modeled entries yet. Continue configuring the device through the IOS CLI." />;
  return <div className="overflow-x-auto rounded-lg border border-white/10"><table style={{ minWidth: Math.max(620, headers.length * 100) }} className="w-full border-collapse text-left font-mono text-[10px]"><thead className="bg-[#111f28] text-[#63e6e2]"><tr>{headers.map((header) => <th key={header} className="border-b border-white/10 px-3 py-2 font-normal uppercase tracking-wider">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.join("-")}-${index}`} className="border-b border-white/[.06] last:border-0 odd:bg-[#0d1821] even:bg-[#0a141c]">{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className={`px-3 py-2 ${cellIndex === 0 ? "text-[#f4d998]" : "text-[#b7c7ca]"}`}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function OspfEvidenceView({ evidence }: { evidence: OspfOperationalEvidence }) {
  const sections = [evidence.processes, evidence.areas, evidence.interfaces, evidence.neighbors, evidence.database, evidence.lsaSummary, evidence.timers, evidence.capabilities, evidence.events];
  return <div className="space-y-5">
    <div className="rounded-lg border border-[#63e6e2]/25 bg-[linear-gradient(135deg,#10252c,#0a151d)] px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#63e6e2]">Modeled OSPF control plane</div>
      <p className="mt-1 text-xs leading-5 text-[#9cb0b5]">Every value below is derived from the active IOS configuration, topology, deterministic simulator clock, election state, and adjacency eligibility. Configuration changes recompute the process and LSDB evidence.</p>
    </div>
    {sections.map(section => <section key={section.title} className="rounded-lg border border-white/10 bg-[#0a141c] p-3">
      <div className="mb-3">
        <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-[#f4d998]">{section.title}</h3>
        <p className="mt-1 text-[11px] leading-5 text-[#82979e]">{section.description}</p>
      </div>
      <Table headers={section.headers} rows={section.rows} />
    </section>)}
  </div>;
}

function StpEvidenceView({ vlanRows, portRows }: { vlanRows: Array<Array<string | number>>; portRows: Array<Array<string | number>> }) {
  return <div className="space-y-5">
    <div className="rounded-lg border border-[#63e6e2]/25 bg-[linear-gradient(135deg,#10252c,#0a151d)] px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#63e6e2]">Modeled spanning-tree evidence</div>
      <p className="mt-1 text-xs leading-5 text-[#9cb0b5]">Bridge identity, root election, and port forwarding roles are derived from active modeled switches, IOS spanning-tree configuration, interface state, and topology. This is instructional Rapid PVST-style evidence, not a packet-timed STP implementation.</p>
    </div>
    <section className="rounded-lg border border-white/10 bg-[#0a141c] p-3">
      <div className="mb-3"><h3 className="font-mono text-xs uppercase tracking-[0.16em] text-[#f4d998]">VLAN root and bridge state</h3><p className="mt-1 text-[11px] leading-5 text-[#82979e]">The root bridge is the lowest configured bridge ID for each modeled VLAN.</p></div>
      <Table headers={["VLAN", "Mode", "Root Bridge", "Root ID", "This Bridge", "Bridge ID", "Role", "Timers"]} rows={vlanRows} />
    </section>
    <section className="rounded-lg border border-white/10 bg-[#0a141c] p-3">
      <div className="mb-3"><h3 className="font-mono text-xs uppercase tracking-[0.16em] text-[#f4d998]">Port role and state</h3><p className="mt-1 text-[11px] leading-5 text-[#82979e]">A non-root bridge selects one modeled root port; additional switch-facing paths become alternate/blocking evidence, while endpoint paths remain designated/forwarding.</p></div>
      <Table headers={["VLAN", "Interface", "Role", "State", "Cost", "Type", "PortFast / BPDU Guard"]} rows={portRows} />
    </section>
  </div>;
}

export default function TrancheVerificationPanel({ session, sessions, deviceName, topology, height, minimized, onToggleMinimized, onResizeStart, onResizeKeyDown }: { session: Session; sessions: Record<string, Session>; deviceName: string; topology: { devices: any[]; links: any[] }; height: number; minimized: boolean; onToggleMinimized: () => void; onResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void; onResizeKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void }) {
  const [activeTab, setActiveTab] = useState<VerificationTab>("mac");
  const [macView, setMacView] = useState<MacView>("device");
  useEffect(() => { setActiveTab("mac"); setMacView("device"); }, [topology]);
  const interfaces = useMemo(() => Object.entries(session.interfaces || {}), [session.interfaces]);
  const displayInterfaces = useMemo(() => {
    const device = (topology.devices || []).find((candidate) => (candidate.name || candidate.id) === deviceName);
    const modeledPorts = device?.ports || [];
    const configuredPorts = Object.keys(session.interfaces || {});
    const portNames = Array.from(new Set([...modeledPorts, ...configuredPorts]));
    return portNames.map((name) => [name, session.interfaces[name]] as const);
  }, [deviceName, session.interfaces, topology.devices]);
  const defaultGateway = useMemo(() => {
    for (const command of [...(session.runningConfig || [])].reverse()) {
      const routeMatch = command.match(/^ip route 0\.0\.0\.0 0\.0\.0\.0 ([0-9.]+)/i);
      if (routeMatch) return routeMatch[1];
      const gatewayMatch = command.match(/^ip default-gateway ([0-9.]+)/i);
      if (gatewayMatch) return gatewayMatch[1];
    }
    return "—";
  }, [session.runningConfig]);
  const aggregationEvidence = protocolEvidence({ topology } as LabConfig, sessions).filter(row => ['LACP', 'Static'].includes(row.protocol));
  const interfaceRows = displayInterfaces.map(([name, state]) => {
    const row = interfaceRelationships(session, name, aggregationEvidence);
    return [name, row.parent, row.vlan, row.nativeVlan, row.allowedVlans, row.encapsulation, row.address, row.valid, row.method, row.role, row.description, row.protocol, row.aggregation, row.admin, state ? `${state.speed} / ${state.duplex}` : "—", state ? `CRC ${state.errors.crc} · Coll ${state.errors.collisions}` : "—"];
  });
  const vlanRows = useMemo(() => {
    const rows: Array<Array<string | number>> = [];
    const vlanIds = new Set<string>(Object.keys(session.vlans || {}));
    for (const [, state] of Object.entries(session.interfaces || {})) if (state.accessVlan !== undefined) vlanIds.add(String(state.accessVlan));
    for (const [name] of interfaces) if (interfaceVlan(session, name) !== undefined) vlanIds.add(String(interfaceVlan(session, name)));
    for (const vlanId of Array.from(vlanIds).sort((a, b) => Number(a) - Number(b))) {
      const gateways = interfaces.filter(([name]) => interfaceVlan(session, name) === Number(vlanId)).map(([name]) => name);
      const accessPorts = interfaces.filter(([, state]) => state.switchportMode === 'access' && (state.accessVlan ?? 1) === Number(vlanId)).map(([name]) => name);
      const trunks = interfaces.filter(([, state]) => state.switchportMode === "trunk" && vlanAllowed(state.allowedVlans, Number(vlanId))).map(([name]) => name);
      rows.push([vlanId, session.vlans[vlanId] || "—", gateways.length ? gateways.join(", ") : "—", accessPorts.length ? accessPorts.join(", ") : "—", trunks.length ? trunks.join(", ") : "—", gateways.length ? "SVI / routed interface" : "Layer 2 VLAN"]);
    }
    return rows;
  }, [interfaces, session.interfaces, session.vlans]);
  const stpEvidence = useMemo(() => {
    const devices = new Map((topology.devices || []).map((device) => [device.id, device]));
    const nodeForName = (name: string) => (topology.devices || []).find((device) => (device.name || device.id) === name);
    const switchSessions = Object.entries(sessions).flatMap(([name, peer]) => {
      const node = nodeForName(name);
      return node?.kind === 'switch' ? [{ name, node, peer }] : [];
    });
    const selected = switchSessions.find((item) => item.name === deviceName);
    if (!selected) return { vlanRows: [] as Array<Array<string | number>>, portRows: [] as Array<Array<string | number>> };
    const vlanIds = new Set<number>([1]);
    for (const item of switchSessions) {
      Object.keys(item.peer.vlans || {}).forEach((vlan) => vlanIds.add(Number(vlan)));
      Object.values(item.peer.interfaces || {}).forEach((state) => { if (state.accessVlan) vlanIds.add(state.accessVlan); });
    }
    const priorityFor = (peer: Session, vlan: number) => {
      if (peer.runningConfig.some((line) => line === `spanning-tree vlan ${vlan} root primary`)) return 24576;
      const configured = [...peer.runningConfig].reverse().find((line) => new RegExp(`^spanning-tree vlan ${vlan} priority \\d+$`).test(line));
      return configured ? Number(configured.split(' ').at(-1)) : 32768;
    };
    const modeFor = (peer: Session) => peer.runningConfig.find((line) => /^spanning-tree mode /.test(line))?.slice('spanning-tree mode '.length) || 'rapid-pvst';
    const identityFor = (item: { name: string; node: any; peer: Session }, vlan: number) => {
      const priority = priorityFor(item.peer, vlan);
      const mac = modeledDeviceMac(item.node.id);
      return { ...item, priority, mac, bridgeId: `${priority + vlan}.${mac}` };
    };
    const vlanRows: Array<Array<string | number>> = [];
    const portRows: Array<Array<string | number>> = [];
    for (const vlan of Array.from(vlanIds).filter(Number.isFinite).sort((left, right) => left - right)) {
      const candidates = switchSessions.map((item) => identityFor(item, vlan)).sort((left, right) => left.priority - right.priority || left.mac.localeCompare(right.mac));
      const root = candidates[0];
      const current = identityFor(selected, vlan);
      const isRoot = root?.name === deviceName;
      vlanRows.push([vlan, modeFor(selected.peer), root?.name || '—', root?.bridgeId || '—', deviceName, current.bridgeId, isRoot ? 'Root bridge' : 'Non-root bridge', 'Hello 2s · Max age 20s · Forward delay 15s']);
      const links = (topology.links || []).flatMap((link) => {
        if (link.from === selected.node.id) return [{ port: link.fromPort, peerId: link.to }];
        if (link.to === selected.node.id) return [{ port: link.toPort, peerId: link.from }];
        return [];
      }).filter((link) => link.port);
      const switchLinks = links.filter((link) => devices.get(link.peerId)?.kind === 'switch').sort((left, right) => left.port.localeCompare(right.port));
      const rootPort = !isRoot ? (switchLinks.find((link) => (devices.get(link.peerId)?.name || link.peerId) === root?.name) || switchLinks[0])?.port : undefined;
      const portNames = Array.from(new Set([...(selected.node.ports || []), ...Object.keys(selected.peer.interfaces || {})]));
      for (const port of portNames) {
        const state = selected.peer.interfaces[port];
        const neighbor = devices.get(links.find((item) => item.port === port)?.peerId || '');
        const carriesVlan = state?.switchportMode === 'trunk' ? vlanAllowed(state.allowedVlans, vlan) : (state?.accessVlan || 1) === vlan;
        if (!carriesVlan) continue;
        const enabled = Boolean(state && !state.shutdown && state.status === 'up');
        const switchFacing = neighbor?.kind === 'switch';
        const role = !enabled ? 'Disabled' : isRoot || !switchFacing ? 'Designated' : port === rootPort ? 'Root' : 'Alternate';
        const portFast = state?.commands.includes('spanning-tree portfast') ? 'enabled' : '—';
        const bpduGuard = state?.commands.includes('spanning-tree bpduguard enable') ? 'enabled' : '—';
        portRows.push([vlan, port, role, enabled && role !== 'Alternate' ? 'FWD' : enabled ? 'BLK' : 'DOWN', switchFacing ? 4 : 19, switchFacing ? 'P2p' : 'Edge', `PortFast ${portFast} · BPDU Guard ${bpduGuard}`]);
      }
    }
    return { vlanRows, portRows };
  }, [deviceName, sessions, topology.devices, topology.links]);
  const cdpRows = useMemo(() => {
    const devices = new Map((topology.devices || []).map((device) => [device.id, device]));
    const nameFor = (id: string) => devices.get(id)?.name || id;
    const cdpCapable = (device: any) => ["router", "switch", "firewall", "asa", "modem", "access-point"].includes(device?.kind);
    const rows: Array<Array<string | number>> = [];
    for (const link of topology.links || []) {
      const localId = link.from === devices.get(link.from)?.id && nameFor(link.from) === deviceName ? link.from : link.to === devices.get(link.to)?.id && nameFor(link.to) === deviceName ? link.to : null;
      if (!localId) continue;
      const remoteId = localId === link.from ? link.to : link.from;
      const remote = devices.get(remoteId);
      if (!remote || !cdpCapable(remote)) continue;
      const localPort = localId === link.from ? link.fromPort : link.toPort;
      const remotePort = localId === link.from ? link.toPort : link.fromPort;
      const localState = session.interfaces[localPort];
      const relationship = localState?.switchportMode === "trunk" ? "trunk neighbor" : localState?.vlanId ? `VLAN ${localState.vlanId} gateway path` : "direct neighbor";
      rows.push([nameFor(localId), localPort || "—", nameFor(remoteId), remotePort || "—", remote.role || remote.kind || "network device", relationship]);
    }
    return rows;
  }, [deviceName, session.interfaces, topology.devices, topology.links]);
  const arpRows = (session.arpTable || []).map((entry) => [entry.ip, entry.mac, entry.interface, String(entry.age)]);
  const deviceMacRows = useMemo(() => (topology.devices || []).map((device) => [device.name || device.id, modeledDeviceMac(device.id), device.kind || "network device", device.role || "—", "assigned at initialization"]), [topology.devices]);
  const macRows = useMemo(() => {
    return (session.macTable || []).map((entry) => [entry.vlan, entry.mac, entry.type, entry.port, entry.lastSeen ? new Date(entry.lastSeen).toLocaleTimeString() : "—"]);
  }, [session.macTable]);
  const ipv6NeighborRows = (session.ipv6Neighbors || []).map((entry) => [entry.ipv6, entry.linkLocal || "—", entry.mac, entry.interface, entry.state, entry.discovery, entry.neighbor || "—"]);
  const trunkRows = interfaces.filter(([, state]) => state.switchportMode === "trunk").map(([name]) => {
    const row = interfaceRelationships(session, name, aggregationEvidence);
    return [name, row.protocol, row.aggregation, row.nativeVlan, row.allowedVlans];
  });
  const etherChannelRows = interfaces.filter(([, state]) => state.channelGroup !== undefined).map(([name, state]) => {
    const mode = state.channelMode || "—";
    const protocol = mode === "active" || mode === "passive" ? "LACP" : mode === "on" ? "Static" : "—";
    const peer = aggregationEvidence.find(row => row.link.startsWith(`${deviceName} ${name} <-> `) || row.link.endsWith(` <-> ${deviceName} ${name}`));
    const status = peer?.state || 'NO PEER';
    return [`Po${state.channelGroup}`, name, protocol, mode, status, state.switchportMode || "—", peer?.reason || 'No modeled peer member'];
  });
  const aclRows = useMemo(() => aclEntries(session).map(entry => [entry.acl, entry.type, entry.action, entry.match]), [session.runningConfig]);
  const natPatRows = useMemo(() => {
    const rows: Array<Array<string | number>> = [];
    for (const command of session.runningConfig || []) {
      const pat = command.match(/^ip nat inside source list (\d+) interface (\S+) overload$/i);
      if (pat) {
        rows.push(["PAT overload", `ACL ${pat[1]}`, `Interface ${pat[2]}`, "overload"]);
        continue;
      }
      const staticNat = command.match(/^ip nat inside source static (.+)$/i);
      if (staticNat) {
        rows.push(["Static NAT", staticNat[1], "one-to-one", "configured"]);
        continue;
      }
      const asaPat = command.match(/^nat \(inside,outside\) dynamic interface$/i);
      if (asaPat) rows.push(["Dynamic PAT", "inside → outside", "outside interface", "dynamic"]);
    }
    return rows;
  }, [session.runningConfig]);
  const ospfEvidence = useMemo(() => ospfOperationalEvidence({ topology } as LabConfig, sessions, deviceName), [deviceName, sessions, topology]);
  const dhcpRows = useMemo(() => {
    const rows: Array<Array<string | number>> = [];
    for (const pool of Object.values(session.dhcpPools || {})) {
      rows.push(["Pool", pool.name, pool.network && pool.mask ? `${pool.network} / ${pool.mask}` : "—", "configured", pool.defaultRouter || pool.dnsServer ? `GW ${pool.defaultRouter || "—"} · DNS ${pool.dnsServer || "—"}` : "—", "—"]);
    }
    for (const lease of session.dhcpLeases || []) rows.push(["Lease", lease.clientId, lease.ip, leaseState(lease), lease.mac, lease.pool]);
    for (const address of session.dhcpExcludedAddresses || []) rows.push(["Excluded", address, "reserved", "—", "—", "—"]);
    if (session.dhcpClient) rows.push(["Client", session.dhcpClient.mac, session.dhcpClient.ip || "—", leaseState(session.dhcpClient), session.dhcpClient.gateway || "—", session.dhcpClient.interface]);
    for (const [name, state] of Object.entries(session.interfaces || {})) if (state.dhcpClient && !session.dhcpClient) rows.push(["Client", name, "address pending", "INIT", "—", name]);
    return rows;
  }, [session.dhcpClient, session.dhcpExcludedAddresses, session.dhcpLeases, session.dhcpPools, session.interfaces]);
  const transportRows = useMemo(() => (session.transportFlows || []).map((flow) => [flow.protocol, flow.application, flow.source, flow.destination, flow.state, flow.evidence]), [session.transportFlows]);
  const drbdrRows = useMemo(() => electionEvidence({ topology } as LabConfig, sessions).map(row => [row.device, row.port, row.routerId, row.network, row.priority, row.cost, row.role]), [sessions, topology]);
  const fhrpGroups = useMemo(() => Object.entries(sessions).flatMap(([name, peer]) => Object.entries(peer.fhrpGroups || {}).map(([key, group]) => ({ name, interfaceName: key.split(":")[0], group }))), [sessions]);
  const fhrpRows = useMemo(() => {
    return fhrpGroups.map(({ name, interfaceName, group }) => {
      const peers = fhrpGroups.filter((item) => item.group.protocol === group.protocol && item.group.group === group.group);
      const highest = Math.max(...peers.map((item) => item.group.priority ?? 100));
      const isLeader = (group.priority ?? 100) === highest;
      const role = group.protocol === "HSRP" ? (isLeader ? "active" : "standby") : group.protocol === "VRRP" ? (isLeader ? "master" : "backup") : (isLeader ? "AVG / AVF" : "AVF");
      const forwarder = group.glbpForwarder ?? [...peers].sort((left, right) => left.name.localeCompare(right.name)).findIndex(peer => peer.name === name) + 1;
      const glbp = group.protocol === "GLBP" ? `AVF ${forwarder} · ${group.glbpLoadBalancing || "round-robin"} · wt ${group.glbpWeight || 100}` : "—";
      return [group.protocol, group.group, name, interfaceName, group.virtualIp || "—", group.priority ?? 100, group.preempt ? "yes" : "no", role, glbp];
    });
  }, [fhrpGroups]);
  const glbpRows = useMemo(() => {
    const glbpGroups = fhrpGroups.filter((item) => item.group.protocol === "GLBP");
    const keys = Array.from(new Set(glbpGroups.map((item) => item.group.group))).sort((a, b) => a - b);
    return keys.map((groupNumber) => {
      const peers = glbpGroups.filter((item) => item.group.group === groupNumber).sort((a, b) => (b.group.priority ?? 100) - (a.group.priority ?? 100) || a.name.localeCompare(b.name));
      const avg = peers[0];
      const virtualIp = peers.find((peer) => peer.group.virtualIp)?.group.virtualIp || "unassigned";
      const avfs = peers.map((peer, index) => `${peer.name}/${peer.interfaceName} AVF ${peer.group.glbpForwarder || index + 1}${peer === avg ? " (AVG)" : ""}`).join(" · ");
      const algorithm = peers.find((peer) => peer.group.glbpLoadBalancing)?.group.glbpLoadBalancing || "round-robin";
      const weights = peers.map((peer) => `${peer.name} ${peer.group.glbpWeight || 100}`).join(" · ");
      return [groupNumber, virtualIp, `${avg.name}/${avg.interfaceName}`, avfs, algorithm, weights];
    });
  }, [fhrpGroups]);
  const data: Record<VerificationTab, { description: string; headers: string[]; rows: Array<Array<string | number>> }> = {
    routes: { description: 'Current enabled connected networks, configured static routes, and cost-selected OSPF routes used by packet diagnostics.', headers: ['Prefix', 'Protocol', 'Next Hop', 'Interface', 'OSPF Cost'], rows: ipv4Routes(session).map(route => [route.prefix, route.protocol, route.nextHop || 'direct', route.interface || '-', route.metric ?? '-']) },
    interfaces: { description: "Access/SVI VLAN identifies a single VLAN; trunks carry the allowed VLAN list and use a native VLAN. Physical link up does not mean LACP is bundled. Port-channel protocol state requires a bundled member. Scroll horizontally for all interface details.", headers: ["Interface", "Parent / Aggregate", "Access / SVI VLAN", "Native VLAN", "Allowed VLANs", "Encapsulation", "IP Address", "OK?", "Method", "Role", "Description", "Link / Protocol", "Bundle State", "Admin State", "Speed / Duplex", "Errors"], rows: interfaceRows },
    vlans: { description: "Modeled VLAN relationships across SVIs, routed subinterfaces, access ports, and trunks that permit each VLAN.", headers: ["VLAN", "Name", "SVI / Routed Interface", "Access Ports", "Permitted Trunks", "Role"], rows: vlanRows },
    stp: { description: "The STP tab provides modeled bridge election and per-port forwarding evidence below.", headers: [], rows: [] },
    arp: { description: "Modeled IP-to-MAC neighbor mappings learned by this device.", headers: ["Protocol Address", "Hardware Address", "Interface", "Age"], rows: arpRows },
    mac: macView === "device"
      ? { description: "Every device in the selected lab has a unique hardware identity assigned at initialization. This inventory is independent of traffic, VLAN learning, ARP, and the switch forwarding database.", headers: ["Device", "Unique MAC Address", "Device Type", "Role", "Availability"], rows: deviceMacRows }
      : { description: "The learned Layer 2 forwarding database from modeled traffic. This is separate from the initialized device identity inventory.", headers: ["VLAN", "MAC Address", "Type", "Port", "Last Seen"], rows: macRows },
    ipv6neighbors: { description: "Modeled IPv6 Neighbor Discovery state. A configured, operational IPv6 link sends a Neighbor Solicitation and the connected endpoint responds with a Neighbor Advertisement.", headers: ["IPv6 Address", "Link-Local", "MAC Address", "Interface", "State", "Discovery", "Neighbor"], rows: ipv6NeighborRows },
    cdp: { description: "Topology-backed Cisco Discovery Protocol relationships between this device's local interfaces and network-capable neighbors.", headers: ["Local Device", "Local Interface", "Neighbor", "Remote Interface", "Neighbor Role", "Relationship"], rows: cdpRows },
    trunks: { description: "Configured trunks with separate link/protocol and bundle state. A suspended EtherChannel does not forward just because its physical member is up.", headers: ["Interface", "Link / Protocol", "Bundle State", "Native VLAN", "Allowed VLANs"], rows: trunkRows },
    etherchannels: { description: "Modeled EtherChannel member negotiation and the reason each member is bundled or suspended.", headers: ["Port-Channel", "Member", "Protocol", "Mode", "Status", "Switchport", "Evidence"], rows: etherChannelRows },
    acls: { description: "Numbered and named ACL rules currently present in the active IOS running configuration.", headers: ["ACL", "Type", "Action", "Rule / Match"], rows: aclRows },
    natpat: { description: "Configured NAT and PAT rules from the active IOS running configuration. Translation entries will appear here when the model learns them.", headers: ["Mode", "Source", "Translation", "State"], rows: natPatRows },
    transport: { description: "Modeled Layer 4 evidence, including transport protocol, application context, endpoint ports, session state, and the IOS action that produced the flow.", headers: ["Protocol", "Application", "Source", "Destination", "State", "Evidence"], rows: transportRows },
    dhcp: { description: "Modeled DHCP pools, leases, exclusions, and client state from the active IOS session.", headers: ["Record", "Identity", "Addressing", "Lease / State", "Gateway / MAC", "Interface / Pool"], rows: dhcpRows },
    ospf: { description: "The OSPF tab provides a complete modeled control-plane dashboard below.", headers: [], rows: [] },
    drbdr: { description: "Multi-access OSPF election evidence: network type, priority, interface cost, router ID, and modeled DR/BDR candidate role.", headers: ["Device", "Interface", "Router ID", "Network Type", "Priority", "Cost", "Role"], rows: drbdrRows },
    fhrp: { description: "Modeled HSRP, VRRP, and GLBP gateway redundancy state. GLBP includes the elected active virtual gateway, virtual forwarders, load-sharing algorithm, and modeled forwarding weights.", headers: ["Protocol", "Group", "Device", "Interface", "Virtual IP", "Priority", "Preempt", "Role", "GLBP forwarding"], rows: fhrpRows },
  };
  const current = data[activeTab];
  return <section className="mt-6 overflow-hidden rounded-xl border border-[#63e6e2]/20 bg-[#0d1920] shadow-xl">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#111b24] px-5 py-4"><div className="flex items-center gap-3"><div className="rounded-lg border border-[#63e6e2]/25 bg-[#173038] p-2"><Table2 className="h-4 w-4 text-[#63e6e2]" /></div><div><div className="instrument-label text-[#63e6e2]">LIVE VERIFICATION TABLES</div><h2 className="mt-1 text-base font-semibold text-white">{deviceName} operational evidence</h2></div></div><div className="flex items-center gap-3"><div className="font-mono text-[10px] uppercase tracking-wider text-[#71878e]">updates with IOS state</div><button type="button" aria-expanded={!minimized} aria-controls="tranche-verification-body" onClick={onToggleMinimized} className="flex items-center gap-1.5 rounded border border-[#f5b74b]/25 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-[#f4d998] transition hover:border-[#f5b74b]/60 hover:bg-[#2a2112]"><Minimize2 className="h-3.5 w-3.5" /> {minimized ? "Restore tables" : "Minimize tables"}</button></div></div>
    {!minimized && <div id="tranche-verification-body"><div className="flex flex-wrap gap-2 border-b border-white/10 px-5 py-3">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition ${activeTab === tab.id ? "border-[#63e6e2]/55 bg-[#173038] text-[#b9eeee]" : "border-white/10 text-[#71828a] hover:border-[#63e6e2]/35 hover:text-white"}`}><span className="inline-flex items-center gap-1.5">{tab.id === "interfaces" || tab.id === "trunks" || tab.id === "etherchannels" ? <Router className="h-3 w-3" /> : <Network className="h-3 w-3" />}{tab.label}</span></button>)}</div>
    <div className="overflow-y-auto px-5 py-4" style={{ height }}>{activeTab === "mac" && <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-[#0a141c] p-2"><span className="mr-2 font-mono text-[9px] uppercase tracking-wider text-[#71878e]">MAC view</span>{(["device", "learned"] as MacView[]).map((view) => <button key={view} type="button" onClick={() => setMacView(view)} className={`rounded border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition ${macView === view ? "border-[#63e6e2]/55 bg-[#173038] text-[#b9eeee]" : "border-white/10 text-[#71828a] hover:border-[#63e6e2]/35 hover:text-white"}`}>{view === "device" ? "Initialized Device MACs" : "Learned MAC Table"}</button>)}</div>}{activeTab === 'ospf' ? <OspfEvidenceView evidence={ospfEvidence} /> : activeTab === 'stp' ? <StpEvidenceView vlanRows={stpEvidence.vlanRows} portRows={stpEvidence.portRows} /> : <><p className="mb-3 text-xs text-[#8fa0a7]">{current.description}</p>{activeTab === "fhrp" && glbpRows.length > 0 && <section className="mb-4 rounded-lg border border-[#63e6e2]/25 bg-[linear-gradient(135deg,#10252c,#0a151d)] p-3"><h3 className="font-mono text-xs uppercase tracking-[0.16em] text-[#63e6e2]">GLBP virtual gateway and forwarders</h3><p className="mt-1 mb-3 text-[11px] leading-5 text-[#9cb0b5]">The AVG owns virtual-gateway coordination while AVFs forward client traffic using the configured load-sharing policy. Evidence is recomputed from the active GLBP configuration on each modeled device.</p><Table headers={["Group", "Virtual IP", "AVG", "Active virtual forwarders", "Load sharing", "Weights"]} rows={glbpRows} /></section>}<Table headers={current.headers} rows={current.rows} /></>}</div></div>}
    {!minimized && <ResizeGrabBar label="Resize live verification tables" value={height} min={220} max={760} onPointerDown={onResizeStart} onKeyDown={onResizeKeyDown} />}
  </section>;
}
