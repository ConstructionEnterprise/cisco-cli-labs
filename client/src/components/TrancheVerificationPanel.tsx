import { useMemo, useState } from "react";
import { Minimize2, Network, Router, Table2 } from "lucide-react";
import type { Session } from "@/lib/ios-engine";
import ResizeGrabBar from "@/components/ResizeGrabBar";

type VerificationTab = "interfaces" | "vlans" | "arp" | "mac" | "ipv6neighbors" | "cdp" | "trunks" | "etherchannels" | "acls" | "natpat" | "dhcp" | "ospf" | "drbdr" | "fhrp";

const tabs: Array<{ id: VerificationTab; label: string }> = [
  { id: "interfaces", label: "IP Interfaces" },
  { id: "vlans", label: "VLANs" },
  { id: "arp", label: "ARP" },
  { id: "mac", label: "MAC Address" },
  { id: "ipv6neighbors", label: "IPv6 Neighbors" },
  { id: "cdp", label: "CDP" },
  { id: "trunks", label: "Trunks" },
  { id: "etherchannels", label: "EtherChannels" },
  { id: "acls", label: "ACLs" },
  { id: "natpat", label: "NAT / PAT" },
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
  return <div className="overflow-x-auto rounded-lg border border-white/10"><table className="w-full min-w-[620px] border-collapse text-left font-mono text-[10px]"><thead className="bg-[#111f28] text-[#63e6e2]"><tr>{headers.map((header) => <th key={header} className="border-b border-white/10 px-3 py-2 font-normal uppercase tracking-wider">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.join("-")}-${index}`} className="border-b border-white/[.06] last:border-0 odd:bg-[#0d1821] even:bg-[#0a141c]">{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className={`px-3 py-2 ${cellIndex === 0 ? "text-[#f4d998]" : "text-[#b7c7ca]"}`}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

export default function TrancheVerificationPanel({ session, sessions, deviceName, topology, height, minimized, onToggleMinimized, onResizeStart, onResizeKeyDown }: { session: Session; sessions: Record<string, Session>; deviceName: string; topology: { devices: any[]; links: any[] }; height: number; minimized: boolean; onToggleMinimized: () => void; onResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void; onResizeKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void }) {
  const [activeTab, setActiveTab] = useState<VerificationTab>("interfaces");
  const interfaces = useMemo(() => Object.entries(session.interfaces || {}), [session.interfaces]);
  const defaultGateway = useMemo(() => {
    for (const command of [...(session.runningConfig || [])].reverse()) {
      const routeMatch = command.match(/^ip route 0\.0\.0\.0 0\.0\.0\.0 ([0-9.]+)/i);
      if (routeMatch) return routeMatch[1];
      const gatewayMatch = command.match(/^ip default-gateway ([0-9.]+)/i);
      if (gatewayMatch) return gatewayMatch[1];
    }
    return "—";
  }, [session.runningConfig]);
  const interfaceRows = interfaces.map(([name, state]) => {
    const parentName = name.includes(".") ? name.split(".")[0] : "—";
    const parent = parentName === "—" ? undefined : session.interfaces[parentName];
    const derivedStatus = name.includes(".") && parent?.status === "up" && state.encapsulation === "dot1q" && state.ipv4.length ? "up" : state.status;
    return [name, parentName, state.vlanId ?? "—", state.encapsulation === "dot1q" ? `802.1Q ${state.vlanId}` : "—", state.ipv4.length ? state.ipv4.join(", ") : "unassigned", state.vlanId ? `VLAN ${state.vlanId} gateway` : state.switchportMode || "routed", derivedStatus, state.shutdown ? (name.includes(".") ? "inherited parent" : "administratively down") : "up"];
  });
  const vlanRows = useMemo(() => {
    const rows: Array<Array<string | number>> = [];
    const vlanIds = new Set<string>(Object.keys(session.vlans || {}));
    for (const [, state] of Object.entries(session.interfaces || {})) if (state.accessVlan !== undefined) vlanIds.add(String(state.accessVlan));
    for (const [name, state] of Object.entries(session.interfaces || {})) if (state.vlanId !== undefined) vlanIds.add(String(state.vlanId));
    for (const vlanId of Array.from(vlanIds).sort((a, b) => Number(a) - Number(b))) {
      const gateways = interfaces.filter(([, state]) => state.vlanId === Number(vlanId)).map(([name]) => name);
      const accessPorts = interfaces.filter(([, state]) => state.accessVlan === Number(vlanId)).map(([name]) => name);
      const trunks = interfaces.filter(([, state]) => state.switchportMode === "trunk").map(([name]) => name);
      rows.push([vlanId, session.vlans[vlanId] || "—", gateways.length ? gateways.join(", ") : "—", accessPorts.length ? accessPorts.join(", ") : "—", trunks.length ? trunks.join(", ") : "—", gateways.length ? "routed gateway" : "Layer 2 VLAN"]);
    }
    return rows;
  }, [interfaces, session.interfaces, session.vlans]);
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
  const macRows = (session.macTable || []).map((entry) => [entry.vlan, entry.mac, entry.type, entry.port, entry.lastSeen ? new Date(entry.lastSeen).toLocaleTimeString() : "—"]);
  const ipv6NeighborRows = (session.ipv6Neighbors || []).map((entry) => [entry.ipv6, entry.linkLocal || "—", entry.mac, entry.interface, entry.state, entry.discovery, entry.neighbor || "—"]);
  const trunkRows = interfaces.filter(([, state]) => state.switchportMode === "trunk").map(([name, state]) => [name, state.status, state.nativeVlan ?? "1", state.allowedVlans || "all"]);
  const etherChannelRows = interfaces.filter(([, state]) => state.channelGroup !== undefined).map(([name, state]) => {
    const mode = state.channelMode || "—";
    const protocol = mode === "active" || mode === "passive" ? "LACP" : mode === "on" ? "Static" : "—";
    return [`Po${state.channelGroup}`, name, protocol, mode, state.status, state.switchportMode || "—"];
  });
  const aclRows = useMemo(() => {
    const rows: Array<Array<string | number>> = [];
    let namedAcl: { name: string; type: string } | null = null;
    for (const command of session.runningConfig || []) {
      const namedHeader = command.match(/^ip access-list (standard|extended) (\S+)/i);
      if (namedHeader) {
        namedAcl = { type: namedHeader[1].toLowerCase(), name: namedHeader[2] };
        continue;
      }
      const numberedRule = command.match(/^access-list (\S+) (?:(extended) )?(permit|deny) (.+)/i);
      if (numberedRule) {
        rows.push([numberedRule[1], numberedRule[2] ? "extended" : "standard", numberedRule[3].toLowerCase(), numberedRule[4]]);
        namedAcl = null;
        continue;
      }
      const namedRule = command.match(/^(permit|deny|remark) (.+)/i);
      if (namedAcl && namedRule) {
        rows.push([namedAcl.name, namedAcl.type, namedRule[1].toLowerCase(), namedRule[2]]);
        continue;
      }
      if (namedAcl && !command.startsWith(" ")) namedAcl = null;
    }
    return rows;
  }, [session.runningConfig]);
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
  const ospfRows = useMemo(() => {
    const rows: Array<Array<string | number>> = Object.values(session.ospfProcesses || {}).map((process) => ["Process", String(process.id), process.routerId || "—", process.networks.length ? process.networks.map((network) => `${network.network} / ${network.wildcard} (area ${network.area})`).join("; ") : "—", process.passiveInterfaces?.length ? process.passiveInterfaces.join(", ") : "none"]);
    const devices = new Map((topology.devices || []).map((device) => [device.id, device]));
    const nameFor = (id: string) => devices.get(id)?.name || id;
    const localProcess = Object.values(session.ospfProcesses || {})[0];
    if (localProcess?.routerId) for (const link of topology.links || []) {
      const localId = nameFor(link.from) === deviceName ? link.from : nameFor(link.to) === deviceName ? link.to : null;
      if (!localId) continue;
      const remoteId = localId === link.from ? link.to : link.from;
      const remoteName = nameFor(remoteId);
      const remoteSession = sessions[remoteName];
      const remoteProcess = remoteSession ? Object.values(remoteSession.ospfProcesses || {})[0] : undefined;
      const localPort = localId === link.from ? link.fromPort : link.toPort;
      const remotePort = localId === link.from ? link.toPort : link.fromPort;
      const localState = session.interfaces[localPort];
      const remoteState = remoteSession?.interfaces[remotePort];
      if (remoteProcess?.routerId && localState?.status === "up" && remoteState?.status === "up" && localState.ipv4.length && remoteState.ipv4.length) rows.push(["Neighbor", remoteProcess.id, `${remoteName} · ${remoteProcess.routerId}`, `${localPort} ⇄ ${remotePort} · area 0`, "FULL"]);
    }
    return rows;
  }, [deviceName, session.interfaces, session.ospfProcesses, sessions, topology.devices, topology.links]);
  const dhcpRows = useMemo(() => {
    const rows: Array<Array<string | number>> = [];
    for (const pool of Object.values(session.dhcpPools || {})) {
      rows.push(["Pool", pool.name, pool.network && pool.mask ? `${pool.network} / ${pool.mask}` : "—", "configured", pool.defaultRouter || pool.dnsServer ? `GW ${pool.defaultRouter || "—"} · DNS ${pool.dnsServer || "—"}` : "—", "—"]);
    }
    for (const lease of session.dhcpLeases || []) rows.push(["Lease", lease.clientId, lease.ip, lease.state, lease.mac, lease.pool]);
    for (const address of session.dhcpExcludedAddresses || []) rows.push(["Excluded", address, "reserved", "—", "—", "—"]);
    if (session.dhcpClient) rows.push(["Client", session.dhcpClient.mac, session.dhcpClient.ip || "—", session.dhcpClient.state, session.dhcpClient.gateway || "—", session.dhcpClient.interface]);
    for (const [name, state] of Object.entries(session.interfaces || {})) if (state.dhcpClient && !session.dhcpClient) rows.push(["Client", name, "address pending", "INIT", "—", name]);
    return rows;
  }, [session.dhcpClient, session.dhcpExcludedAddresses, session.dhcpLeases, session.dhcpPools, session.interfaces]);
  const drbdrRows = useMemo(() => {
    const rows: Array<Array<string | number>> = [];
    const candidates = (topology.devices || []).flatMap((device) => {
      const name = device.name || device.id;
      const peer = sessions[name];
      const entry = Object.entries(peer?.interfaces || {}).find(([, state]) => state.ospfNetworkType || state.ospfPriority !== undefined);
      if (!entry) return [];
      const process = Object.values(peer.ospfProcesses || {})[0];
      return [{ name, process, state: entry[1] }];
    }).filter((entry) => entry.process);
    const eligible = candidates.filter((entry) => (entry.state.ospfPriority ?? 1) > 0).sort((a, b) => (b.state.ospfPriority ?? 1) - (a.state.ospfPriority ?? 1) || String(b.process?.routerId || "").localeCompare(String(a.process?.routerId || "")));
    const dr = eligible[0]?.name;
    const bdr = eligible[1]?.name;
    for (const device of topology.devices || []) {
      const name = device.name || device.id;
      const peer = sessions[name];
      if (!peer) continue;
      for (const [interfaceName, state] of Object.entries(peer.interfaces || {})) {
        if (!state.ospfNetworkType && state.ospfPriority === undefined) continue;
        const process = Object.values(peer.ospfProcesses || {})[0];
        const priority = state.ospfPriority ?? 1;
        const role = priority === 0 ? "DROTHER" : name === dr ? "DR" : name === bdr ? "BDR" : "DROTHER";
        rows.push([name, interfaceName, process?.routerId || "—", state.ospfNetworkType || "broadcast", priority, state.ospfCost ?? "default", role]);
      }
    }
    return rows;
  }, [sessions, topology.devices]);
  const fhrpRows = useMemo(() => {
    const groups = Object.entries(sessions).flatMap(([name, peer]) => Object.values(peer.fhrpGroups || {}).map((group) => ({ name, group })));
    return groups.map(({ name, group }) => {
      const peers = groups.filter((item) => item.group.protocol === group.protocol && item.group.group === group.group);
      const highest = Math.max(...peers.map((item) => item.group.priority ?? 100));
      const role = group.protocol === "HSRP" ? ((group.priority ?? 100) === highest ? "active" : "standby") : group.protocol === "VRRP" ? ((group.priority ?? 100) === highest ? "master" : "backup") : ((group.priority ?? 100) === highest ? "active virtual gateway" : "active forwarder");
      return [group.protocol, group.group, name, group.virtualIp || "—", group.priority ?? 100, group.preempt ? "yes" : "no", role];
    });
  }, [sessions]);
  const data: Record<VerificationTab, { description: string; headers: string[]; rows: Array<Array<string | number>> }> = {
    interfaces: { description: "Live interface relationships, including parent/subinterface hierarchy, 802.1Q VLAN binding, gateway role, and derived operational state.", headers: ["Interface", "Parent", "VLAN", "Encapsulation", "IP Address", "Role", "Status", "Admin State"], rows: interfaceRows },
    vlans: { description: "Modeled VLAN relationships across routed subinterfaces, access ports, and trunk interfaces.", headers: ["VLAN", "Name", "Routed Gateway", "Access Ports", "Trunk Interfaces", "Role"], rows: vlanRows },
    arp: { description: "Modeled IP-to-MAC neighbor mappings learned by this device.", headers: ["Protocol Address", "Hardware Address", "Interface", "Age"], rows: arpRows },
    mac: { description: "Modeled Layer 2 forwarding entries learned by this device.", headers: ["VLAN", "MAC Address", "Type", "Port", "Last Seen"], rows: macRows },
    ipv6neighbors: { description: "Modeled IPv6 Neighbor Discovery state. A configured, operational IPv6 link sends a Neighbor Solicitation and the connected endpoint responds with a Neighbor Advertisement.", headers: ["IPv6 Address", "Link-Local", "MAC Address", "Interface", "State", "Discovery", "Neighbor"], rows: ipv6NeighborRows },
    cdp: { description: "Topology-backed Cisco Discovery Protocol relationships between this device's local interfaces and network-capable neighbors.", headers: ["Local Device", "Local Interface", "Neighbor", "Remote Interface", "Neighbor Role", "Relationship"], rows: cdpRows },
    trunks: { description: "Configured trunk links, native VLAN, and allowed VLAN state.", headers: ["Interface", "Status", "Native VLAN", "Allowed VLANs"], rows: trunkRows },
    etherchannels: { description: "Configured EtherChannel members, explicitly identifying LACP active/passive negotiation versus static mode-on bundling.", headers: ["Port-Channel", "Member", "Protocol", "Mode", "Status", "Switchport"], rows: etherChannelRows },
    acls: { description: "Numbered and named ACL rules currently present in the active IOS running configuration.", headers: ["ACL", "Type", "Action", "Rule / Match"], rows: aclRows },
    natpat: { description: "Configured NAT and PAT rules from the active IOS running configuration. Translation entries will appear here when the model learns them.", headers: ["Mode", "Source", "Translation", "State"], rows: natPatRows },
    dhcp: { description: "Modeled DHCP pools, leases, exclusions, and client state from the active IOS session.", headers: ["Record", "Identity", "Addressing", "Lease / State", "Gateway / MAC", "Interface / Pool"], rows: dhcpRows },
    ospf: { description: "Configured OSPF processes plus modeled FULL adjacencies across operational transit links whose two endpoints have OSPF participation.", headers: ["Record", "Process", "Router ID / Neighbor", "Networks / Link", "State / Passive"], rows: ospfRows },
    drbdr: { description: "Multi-access OSPF election evidence: network type, priority, interface cost, router ID, and modeled DR/BDR candidate role.", headers: ["Device", "Interface", "Router ID", "Network Type", "Priority", "Cost", "Role"], rows: drbdrRows },
    fhrp: { description: "Modeled HSRP, VRRP, and GLBP gateway redundancy state, including virtual IP, priority, preemption, and active/standby or master/backup role.", headers: ["Protocol", "Group", "Device", "Virtual IP", "Priority", "Preempt", "Role"], rows: fhrpRows },
  };
  const current = data[activeTab];
  return <section className="mt-6 overflow-hidden rounded-xl border border-[#63e6e2]/20 bg-[#0d1920] shadow-xl">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#111b24] px-5 py-4"><div className="flex items-center gap-3"><div className="rounded-lg border border-[#63e6e2]/25 bg-[#173038] p-2"><Table2 className="h-4 w-4 text-[#63e6e2]" /></div><div><div className="instrument-label text-[#63e6e2]">LIVE VERIFICATION TABLES</div><h2 className="mt-1 text-base font-semibold text-white">{deviceName} operational evidence</h2></div></div><div className="flex items-center gap-3"><div className="font-mono text-[10px] uppercase tracking-wider text-[#71878e]">updates with IOS state</div><button type="button" aria-expanded={!minimized} aria-controls="tranche-verification-body" onClick={onToggleMinimized} className="flex items-center gap-1.5 rounded border border-[#f5b74b]/25 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-[#f4d998] transition hover:border-[#f5b74b]/60 hover:bg-[#2a2112]"><Minimize2 className="h-3.5 w-3.5" /> {minimized ? "Restore tables" : "Minimize tables"}</button></div></div>
    {!minimized && <div id="tranche-verification-body"><div className="flex flex-wrap gap-2 border-b border-white/10 px-5 py-3">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition ${activeTab === tab.id ? "border-[#63e6e2]/55 bg-[#173038] text-[#b9eeee]" : "border-white/10 text-[#71828a] hover:border-[#63e6e2]/35 hover:text-white"}`}><span className="inline-flex items-center gap-1.5">{tab.id === "interfaces" || tab.id === "trunks" || tab.id === "etherchannels" ? <Router className="h-3 w-3" /> : <Network className="h-3 w-3" />}{tab.label}</span></button>)}</div>
    <div className="overflow-y-auto px-5 py-4" style={{ height }}><p className="mb-3 text-xs text-[#8fa0a7]">{current.description}</p><Table headers={current.headers} rows={current.rows} /></div></div>}
    {!minimized && <ResizeGrabBar label="Resize live verification tables" value={height} min={220} max={760} onPointerDown={onResizeStart} onKeyDown={onResizeKeyDown} />}
  </section>;
}
