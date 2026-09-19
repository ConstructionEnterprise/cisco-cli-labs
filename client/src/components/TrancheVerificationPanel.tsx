import { useMemo, useState } from "react";
import { Minimize2, Network, Router, Table2 } from "lucide-react";
import type { Session } from "@/lib/ios-engine";
import ResizeGrabBar from "@/components/ResizeGrabBar";

type VerificationTab = "interfaces" | "arp" | "mac" | "trunks" | "etherchannels" | "acls" | "natpat";

const tabs: Array<{ id: VerificationTab; label: string }> = [
  { id: "interfaces", label: "IP Interfaces" },
  { id: "arp", label: "ARP" },
  { id: "mac", label: "MAC Address" },
  { id: "trunks", label: "Trunks" },
  { id: "etherchannels", label: "EtherChannels" },
  { id: "acls", label: "ACLs" },
  { id: "natpat", label: "NAT / PAT" },
];

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-white/10 bg-[#0b141d] px-4 py-7 text-center font-mono text-[10px] text-[#71828a]">{message}</div>;
}

function Table({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) {
  if (!rows.length) return <EmptyState message="No modeled entries yet. Continue configuring the device through the IOS CLI." />;
  return <div className="overflow-x-auto rounded-lg border border-white/10"><table className="w-full min-w-[620px] border-collapse text-left font-mono text-[10px]"><thead className="bg-[#111f28] text-[#63e6e2]"><tr>{headers.map((header) => <th key={header} className="border-b border-white/10 px-3 py-2 font-normal uppercase tracking-wider">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.join("-")}-${index}`} className="border-b border-white/[.06] last:border-0 odd:bg-[#0d1821] even:bg-[#0a141c]">{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className={`px-3 py-2 ${cellIndex === 0 ? "text-[#f4d998]" : "text-[#b7c7ca]"}`}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

export default function TrancheVerificationPanel({ session, deviceName, height, minimized, onToggleMinimized, onResizeStart, onResizeKeyDown }: { session: Session; deviceName: string; height: number; minimized: boolean; onToggleMinimized: () => void; onResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void; onResizeKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void }) {
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
  const interfaceRows = interfaces.map(([name, state]) => [name, state.ipv4.length ? state.ipv4.join(", ") : "unassigned", defaultGateway, state.status, state.shutdown ? "administratively down" : "up", state.switchportMode || "routed"]);
  const arpRows = (session.arpTable || []).map((entry) => [entry.ip, entry.mac, entry.interface, String(entry.age)]);
  const macRows = (session.macTable || []).map((entry) => [entry.vlan, entry.mac, entry.type, entry.port, entry.lastSeen ? new Date(entry.lastSeen).toLocaleTimeString() : "—"]);
  const trunkRows = interfaces.filter(([, state]) => state.switchportMode === "trunk").map(([name, state]) => [name, state.status, state.nativeVlan ?? "1", state.allowedVlans || "all"]);
  const etherChannelRows = interfaces.filter(([, state]) => state.channelGroup !== undefined).map(([name, state]) => [`Po${state.channelGroup}`, name, state.channelMode || "—", state.status, state.switchportMode || "—"]);
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
  const data: Record<VerificationTab, { description: string; headers: string[]; rows: Array<Array<string | number>> }> = {
    interfaces: { description: "Live interface address, default gateway, and operational state from the active IOS session.", headers: ["Interface", "IP Address", "Default Gateway", "Status", "Admin State", "Role"], rows: interfaceRows },
    arp: { description: "Modeled IP-to-MAC neighbor mappings learned by this device.", headers: ["Protocol Address", "Hardware Address", "Interface", "Age"], rows: arpRows },
    mac: { description: "Modeled Layer 2 forwarding entries learned by this device.", headers: ["VLAN", "MAC Address", "Type", "Port", "Last Seen"], rows: macRows },
    trunks: { description: "Configured trunk links, native VLAN, and allowed VLAN state.", headers: ["Interface", "Status", "Native VLAN", "Allowed VLANs"], rows: trunkRows },
    etherchannels: { description: "Configured EtherChannel members and their modeled negotiation mode.", headers: ["Port-Channel", "Member", "Mode", "Status", "Switchport"], rows: etherChannelRows },
    acls: { description: "Numbered and named ACL rules currently present in the active IOS running configuration.", headers: ["ACL", "Type", "Action", "Rule / Match"], rows: aclRows },
    natpat: { description: "Configured NAT and PAT rules from the active IOS running configuration. Translation entries will appear here when the model learns them.", headers: ["Mode", "Source", "Translation", "State"], rows: natPatRows },
  };
  const current = data[activeTab];
  return <section className="mt-6 overflow-hidden rounded-xl border border-[#63e6e2]/20 bg-[#0d1920] shadow-xl">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#111b24] px-5 py-4"><div className="flex items-center gap-3"><div className="rounded-lg border border-[#63e6e2]/25 bg-[#173038] p-2"><Table2 className="h-4 w-4 text-[#63e6e2]" /></div><div><div className="instrument-label text-[#63e6e2]">LIVE VERIFICATION TABLES</div><h2 className="mt-1 text-base font-semibold text-white">{deviceName} operational evidence</h2></div></div><div className="flex items-center gap-3"><div className="font-mono text-[10px] uppercase tracking-wider text-[#71878e]">updates with IOS state</div><button type="button" aria-expanded={!minimized} aria-controls="tranche-verification-body" onClick={onToggleMinimized} className="flex items-center gap-1.5 rounded border border-[#f5b74b]/25 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-[#f4d998] transition hover:border-[#f5b74b]/60 hover:bg-[#2a2112]"><Minimize2 className="h-3.5 w-3.5" /> {minimized ? "Restore tables" : "Minimize tables"}</button></div></div>
    {!minimized && <div id="tranche-verification-body"><div className="flex flex-wrap gap-2 border-b border-white/10 px-5 py-3">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition ${activeTab === tab.id ? "border-[#63e6e2]/55 bg-[#173038] text-[#b9eeee]" : "border-white/10 text-[#71828a] hover:border-[#63e6e2]/35 hover:text-white"}`}><span className="inline-flex items-center gap-1.5">{tab.id === "interfaces" || tab.id === "trunks" || tab.id === "etherchannels" ? <Router className="h-3 w-3" /> : <Network className="h-3 w-3" />}{tab.label}</span></button>)}</div>
    <div className="overflow-y-auto px-5 py-4" style={{ height }}><p className="mb-3 text-xs text-[#8fa0a7]">{current.description}</p><Table headers={current.headers} rows={current.rows} /></div></div>}
    {!minimized && <ResizeGrabBar label="Resize live verification tables" value={height} min={220} max={760} onPointerDown={onResizeStart} onKeyDown={onResizeKeyDown} />}
  </section>;
}
