import { useState, type ReactNode } from "react";
import { PanelBottom } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CAPABILITY_MATRIX } from "@/lib/capabilities";
import { ecosystemDevice, ecosystemPort, type EcosystemDeviceKind } from "@/lib/network-ecosystem";
import type { InterfaceState, Session } from "@/lib/ios-engine";
import type { PortRef } from "@/lib/network-topology";
import type { SandboxNode, Topology } from "@/components/NetworkSandbox";

type TabId = "summary" | "interfaces" | "ip" | "vlans" | "mac" | "arp" | "routing" | "dhcp" | "dns";

type TabbedInspectorProps = {
  node: SandboxNode;
  session: Session;
  topology: Topology;
  selectedPort: PortRef | null;
  onSelectPort: (ref: PortRef) => void;
  onOpenConsole: () => void;
};

function interfaceState(session: Session, port: string): InterfaceState {
  return session.interfaces[port] || {
    ipv4: [], ipv6: [], shutdown: true, commands: [], status: "down", speed: "1000", duplex: "full", errors: { crc: 0, collisions: 0 }, poe: { enabled: false, class: 0, wattage: 0, state: "searching" },
  };
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded border border-white/10 bg-[#0d151e] px-2 py-3 text-[10px] leading-4 text-[#82979e]">{children}</div>;
}

export default function TabbedInspector({ node, session, topology, selectedPort, onSelectPort, onOpenConsole }: TabbedInspectorProps) {
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const device = ecosystemDevice(node.kind);
  const caps = CAPABILITY_MATRIX[node.kind as EcosystemDeviceKind];
  const tabs: { id: TabId; label: string }[] = [
    { id: "summary", label: "Summary" },
    ...(node.kind === "switch" || node.kind === "router" || node.kind === "access-point" || node.kind === "firewall" ? [{ id: "interfaces" as const, label: "Interfaces" }] : []),
    ...(node.kind !== "switch" ? [{ id: "ip" as const, label: "IP Configuration" }] : []),
    ...(node.kind === "switch" ? [{ id: "vlans" as const, label: "VLANs" }, { id: "mac" as const, label: "MAC Table" }] : []),
    ...(node.kind === "router" ? [{ id: "arp" as const, label: "ARP Table" }, { id: "routing" as const, label: "Routing" }] : []),
    ...(node.kind === "server" ? [{ id: "dhcp" as const, label: "DHCP" }, { id: "dns" as const, label: "DNS" }] : []),
  ];
  const upPorts = node.ports.filter((port) => interfaceState(session, port).status === "up").length;
  const selectedPortState = selectedPort?.nodeId === node.id ? interfaceState(session, selectedPort.port) : null;
  const managementSvi = session.interfaces["vlan 1"];
  const userVlans = Object.entries(session.vlans).filter(([id]) => id !== "1");

  return <>
    <div className="mt-2 flex items-center gap-2"><div className="font-mono text-sm text-[#63e6e2]">{node.name}</div><span className="rounded bg-[#63e6e2]/10 px-1.5 py-0.5 text-[9px] uppercase text-[#8ed9d7]">{node.kind}</span></div>
    <p className="mt-1 text-xs text-[#758890]">{node.role}</p>
    <div className="mt-3 flex gap-1 overflow-x-auto border-b border-white/10 pb-1">{tabs.map((tab) => <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id)} className={`shrink-0 rounded px-2 py-1 text-[9px] ${activeTab === tab.id ? "bg-[#173038] text-[#63e6e2]" : "text-[#71828a] hover:text-white"}`}>{tab.label}</button>)}</div>
    <div className="mt-3 max-h-[310px] overflow-y-auto">
      {activeTab === "summary" && <div className="space-y-2 text-[10px] text-[#9eb1b5]"><div className="grid grid-cols-2 gap-2"><span>Hostname<br /><b className="text-white">{session.hostname}</b></span><span>Type<br /><b className="text-white">{device.name}</b></span><span>Mount<br /><b className="text-white">{node.mountType || "floor"}</b></span><span>Ports up<br /><b className="text-[#63e6e2]">{upPorts} / {node.ports.length}</b></span></div><p className="border-t border-white/10 pt-2">Capabilities: {caps.join(", ") || "none modeled"}</p></div>}
      {activeTab === "interfaces" && <div className="space-y-1">{node.ports.map((port) => { const state = interfaceState(session, port); const meta = ecosystemPort(device, port); return <button type="button" key={port} onClick={() => onSelectPort({ nodeId: node.id, port })} className={`w-full rounded border px-2 py-2 text-left text-[10px] ${selectedPort?.nodeId === node.id && selectedPort.port === port ? "border-[#f5b74b]/60 bg-[#f5b74b]/10" : "border-white/10 bg-[#0d151e]"}`}><div className="flex justify-between"><span className="font-mono text-white">{port} <span className="text-[#71878e]">{meta.type}</span></span><span className={state.status === "up" ? "text-[#63e6a5]" : "text-[#82979e]"}>{state.status}</span></div><div className="mt-1 grid grid-cols-3 gap-1 text-[#9eb1b5]"><span>{state.switchportMode || "access"}</span><span>VLAN {state.accessVlan || 1}</span><span>{state.speed} / {state.duplex}</span></div><div className="mt-1 text-[#71878e]">PoE: {state.poe.enabled ? `${state.poe.state} · ${state.poe.wattage}W` : "not enabled"} · CRC {state.errors.crc}</div></button>; })}</div>}
      {activeTab === "ip" && <div className="space-y-2">{session.dhcpClient && <div className="rounded border border-[#63e6e2]/20 bg-[#0d151e] px-2 py-2 text-[10px] text-[#9eb1b5]"><b className="text-[#63e6e2]">DHCP CLIENT · {session.dhcpClient.state}</b><div>Lease: {session.dhcpClient.ip || "unassigned"} · Pool: {session.dhcpClient.poolName || "unknown"}</div><div>Gateway: {session.dhcpClient.gateway || "unassigned"} · DNS: {session.dhcpClient.dns || "unassigned"}</div></div>}{Object.entries(session.interfaces).length ? Object.entries(session.interfaces).map(([name, state]) => <div key={name} className="rounded border border-white/10 bg-[#0d151e] px-2 py-2 text-[10px] text-[#9eb1b5]"><b className="font-mono text-white">{name}</b><div>IPv4: {state.ipv4.join(", ") || "unassigned"}</div><div>IPv6: {state.ipv6.join(", ") || "unassigned"}</div></div>) : <EmptyState>No IP interfaces configured.</EmptyState>}</div>}
      {activeTab === "vlans" && <div className="space-y-1"><div className="rounded border border-[#63e6e2]/20 bg-[#0d151e] px-2 py-2 text-[10px] text-white"><b>VLAN 1 · default</b><div className="mt-1 text-[#9eb1b5]">Default VLAN and management VLAN</div>{managementSvi && <div className="mt-1 text-[#63e6e2]">SVI: {managementSvi.ipv4.join(", ") || "unaddressed"} · {managementSvi.status}</div>}</div>{userVlans.length ? userVlans.map(([id, name]) => <div key={id} className="rounded border border-white/10 bg-[#0d151e] px-2 py-2 text-[10px] text-white">VLAN {id} · {name}</div>) : <EmptyState>No user-created VLANs configured.</EmptyState>}</div>}
      {activeTab === "mac" && <EmptyState>Vlan    Mac Address       Type        Ports<br />----    -----------       --------    -----<br /><br />No MAC entries learned. (Learning engine pending Sprint 5.)</EmptyState>}
      {activeTab === "arp" && <EmptyState>Protocol  Address          Age<br /><br />No ARP entries present. (Discovery engine pending Sprint 5.)</EmptyState>}
      {activeTab === "routing" && <EmptyState>Codes: C - connected, S - static, O - OSPF<br /><br />No routes modeled. (Routing engine pending Sprint 5.)</EmptyState>}
      {activeTab === "dhcp" && <div className="space-y-1">{Object.values(session.dhcpPools || {}).length ? Object.values(session.dhcpPools).map((pool) => <div key={pool.name} className="rounded border border-white/10 bg-[#0d151e] px-2 py-2 text-[10px] text-[#9eb1b5]"><b className="text-white">{pool.name}</b><div>Network: {pool.network || "unconfigured"}{pool.mask ? ` ${pool.mask}` : ""}</div><div>Gateway: {pool.defaultRouter || "unconfigured"} · DNS: {pool.dnsServer || "unconfigured"}</div></div>) : <EmptyState>No DHCP pools configured.</EmptyState>}{session.dhcpLeases?.length ? <div className="mt-2 space-y-1"><div className="font-mono text-[9px] uppercase text-[#f5b74b]">Bindings</div>{session.dhcpLeases.map((lease) => <div key={lease.mac} className="rounded border border-white/10 bg-[#0d151e] px-2 py-2 text-[10px] text-[#9eb1b5]">{lease.ip} · {lease.mac}<div>{lease.state} · {lease.pool}</div></div>)}</div> : <EmptyState>No active DHCP bindings.</EmptyState>}</div>}
      {activeTab === "dns" && <div className="space-y-1">{session.dnsServerEnabled ? <div className="rounded border border-[#63e6e2]/20 bg-[#0d151e] px-2 py-2 text-[10px] text-[#9eb1b5]"><b className="text-[#63e6e2]">DNS SERVER ENABLED</b>{Object.entries(session.dnsRecords).length ? Object.entries(session.dnsRecords).map(([name, address]) => <div key={name} className="mt-1 text-white">{name} · {address}</div>) : <div className="mt-1">No records configured.</div>}</div> : <EmptyState>No modeled DNS server enabled.</EmptyState>}{Object.entries(session.dnsCache || {}).length > 0 && <div className="rounded border border-white/10 bg-[#0d151e] px-2 py-2 text-[10px] text-[#9eb1b5]">Resolver cache{Object.entries(session.dnsCache).map(([name, address]) => <div key={name} className="mt-1 text-white">{name} · {address}</div>)}</div>}</div>}
    </div>
    <Button size="sm" className="mt-3 w-full bg-[#173038] text-[#9fe5e2] hover:bg-[#21454d]" onClick={onOpenConsole}><PanelBottom className="mr-2 h-3.5 w-3.5" /> Open IOS console</Button>
  </>;
}
