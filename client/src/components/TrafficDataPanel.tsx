import { useMemo, useState } from "react";
import { Database, LockKeyhole, Network, ShieldCheck, X } from "lucide-react";
import { createSimulatedFlow, trafficSummary, type SimulatedFlow } from "@/lib/traffic-engine";

type TrafficDataPanelProps = {
  onClose: () => void;
};

function buildTrafficCatalog(): SimulatedFlow[] {
  const catalogFlow = (flow: Parameters<typeof createSimulatedFlow>[0], state: SimulatedFlow["state"], stages: string[]) => ({
    ...createSimulatedFlow(flow),
    state,
    stages,
  });

  return [
    catalogFlow({
      id: "internet-https-001",
      protocol: "https",
      source: "INSIDE-PC1",
      destination: "edge.example.net",
      sourceIp: "10.10.10.10",
      destinationIp: "198.51.100.80",
      sourcePort: 49152,
      vlan: 10,
      tls: { serverName: "edge.example.net", certificateTrusted: true, decryptable: true, inspected: true },
      nat: { translatedSourceIp: "203.0.113.10", translatedSourcePort: 49152 },
    }, "delivered", ["generated", "acl-permitted", "nat-translated", "tls-terminated", "inspected", "tls-re-encrypted", "delivered"]),
    catalogFlow({
      id: "internet-dns-002",
      protocol: "dns",
      source: "INSIDE-PC1",
      destination: "resolver.example.net",
      sourceIp: "10.10.10.10",
      destinationIp: "198.51.100.53",
      sourcePort: 53000,
      destinationPort: 53,
      vlan: 10,
    }, "delivered", ["generated", "acl-permitted", "nat-translated", "delivered"]),
    catalogFlow({
      id: "internet-tls-003",
      protocol: "https",
      source: "DMZ-WEB1",
      destination: "updates.example.net",
      sourceIp: "172.16.10.20",
      destinationIp: "198.51.100.44",
      sourcePort: 443,
      vlan: 30,
      tls: { serverName: "updates.example.net", certificateTrusted: false, decryptable: true, inspected: true },
    }, "denied", ["generated", "outside-policy-check", "certificate-failed", "denied"]),
  ];
}

function value(value: string | number | boolean | undefined): string {
  return value === undefined ? "-" : String(value);
}

export default function TrafficDataPanel({ onClose }: TrafficDataPanelProps) {
  const flows = useMemo(buildTrafficCatalog, []);
  const [selectedId, setSelectedId] = useState(flows[0]?.id);
  const selected = flows.find((flow) => flow.id === selectedId) ?? flows[0];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#05090d]/80 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="traffic-data-title">
      <div className="w-full max-w-6xl overflow-hidden rounded-2xl border border-[#63e6e2]/25 bg-[#0d151e] shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-[#63e6e2]"><Database className="h-3.5 w-3.5" /> Internet Traffic Data</div>
            <h2 id="traffic-data-title" className="mt-2 font-display text-2xl font-semibold text-white">Simulated traffic fabric</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#8fa0a7]">Inspect deterministic flow records used by firewall, NAT, VPN, and troubleshooting labs. These records model Internet behavior and never contact the live Internet.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 p-2 text-[#9aabb1] transition hover:border-[#63e6e2]/50 hover:text-white" aria-label="Close Internet Traffic Data"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid gap-5 p-6 lg:grid-cols-[1.1fr_.9fr]">
          <div className="space-y-3">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[.16em] text-[#778a92]"><span>Flow inventory</span><span className="text-[#63e6e2]">{flows.length} records</span></div>
            {flows.map((flow) => (
              <button key={flow.id} type="button" onClick={() => setSelectedId(flow.id)} className={`w-full rounded-xl border p-4 text-left transition ${selected?.id === flow.id ? "border-[#63e6e2]/60 bg-[#173038]" : "border-white/10 bg-[#111c27] hover:border-[#63e6e2]/35"}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs text-[#63e6e2]">{trafficSummary(flow)}</span>
                  <span className={`rounded px-2 py-1 font-mono text-[9px] uppercase ${flow.state === "denied" ? "bg-[#f07178]/10 text-[#f07178]" : "bg-[#63e6e2]/10 text-[#63e6e2]"}`}>{flow.state}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#84969d]"><span>{flow.source}</span><span>to</span><span>{flow.destination}</span>{flow.vlan && <span>VLAN {flow.vlan}</span>}</div>
              </button>
            ))}
          </div>

          {selected && <div className="rounded-xl border border-white/10 bg-[#111c27] p-5">
            <div className="flex items-center justify-between gap-3"><div className="font-mono text-[10px] uppercase tracking-[.16em] text-[#f5b74b]">Selected flow</div><Network className="h-4 w-4 text-[#63e6e2]" /></div>
            <div className="mt-3 break-all font-mono text-sm text-white">{selected.id}</div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
              {[["Protocol", selected.protocol.toUpperCase()], ["Source", `${selected.sourceIp}:${value(selected.sourcePort)}`], ["Destination", `${selected.destinationIp}:${value(selected.destinationPort)}`], ["State", selected.state], ["VLAN", value(selected.vlan)], ["NAT source", value(selected.nat?.translatedSourceIp)]].map(([label, item]) => <div key={label} className="rounded-lg border border-white/10 bg-[#0d151e] p-3"><div className="font-mono text-[9px] uppercase tracking-wider text-[#778a92]">{label}</div><div className="mt-1 break-all font-mono text-[#dce5e5]">{item}</div></div>)}
            </div>
            {selected.tls && <div className="mt-3 rounded-lg border border-[#63e6e2]/20 bg-[#63e6e2]/5 p-3"><div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-[#63e6e2]"><LockKeyhole className="h-3.5 w-3.5" /> TLS metadata</div><div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#b4c1c5]"><span>Server: {selected.tls.serverName}</span><span>Trusted: {selected.tls.certificateTrusted ? "yes" : "no"}</span><span>Decryptable: {selected.tls.decryptable ? "yes" : "no"}</span><span>Inspected: {selected.tls.inspected ? "yes" : "no"}</span></div></div>}
            <div className="mt-5"><div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-[#778a92]"><ShieldCheck className="h-3.5 w-3.5 text-[#63e6e2]" /> Processing stages</div><div className="mt-2 flex flex-wrap gap-2">{selected.stages.map((stage) => <span key={stage} className="rounded border border-white/10 bg-[#0d151e] px-2 py-1 font-mono text-[10px] text-[#aebbc0]">{stage}</span>)}</div></div>
          </div>}
        </div>
      </div>
    </div>
  );
}
