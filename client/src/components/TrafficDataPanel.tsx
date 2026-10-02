import { useMemo, useState } from "react";
import { Database, Globe2, LockKeyhole, Monitor, Network, Server, ShieldCheck, Waypoints, X } from "lucide-react";
import { createSimulatedFlow, trafficSummary, type SimulatedFlow } from "@/lib/traffic-engine";
import { simulatedTargetRange } from "@/lib/simulated-target-range";

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
  const assets = simulatedTargetRange;
  const [view, setView] = useState<"traffic" | "targets">("traffic");
  const [selectedId, setSelectedId] = useState(flows[0]?.id);
  const [selectedAssetId, setSelectedAssetId] = useState(assets[0]?.id);
  const selected = flows.find((flow) => flow.id === selectedId) ?? flows[0];
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? assets[0];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#05090d]/80 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="traffic-data-title">
      <div className="w-full max-w-6xl overflow-hidden rounded-2xl border border-[#63e6e2]/25 bg-[#0d151e] shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-[#63e6e2]"><Database className="h-3.5 w-3.5" /> Training data range</div>
            <h2 id="traffic-data-title" className="mt-2 font-display text-2xl font-semibold text-white">Traffic fabric and simulated targets</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#8fa0a7]">Inspect deterministic flow records or browse the fictional target range used by ethical-security labs. Every asset is contained in this application and is never a live system.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 p-2 text-[#9aabb1] transition hover:border-[#63e6e2]/50 hover:text-white" aria-label="Close Internet Traffic Data"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-white/10 px-6 pt-4">
          <button type="button" onClick={() => setView("traffic")} className={`rounded-t-lg border border-b-0 px-3 py-2 font-mono text-[10px] uppercase tracking-wider transition ${view === "traffic" ? "border-[#63e6e2]/45 bg-[#173038] text-[#63e6e2]" : "border-transparent text-[#778a92] hover:text-white"}`}><Network className="mr-2 inline h-3.5 w-3.5" />Traffic fabric</button>
          <button type="button" onClick={() => setView("targets")} className={`rounded-t-lg border border-b-0 px-3 py-2 font-mono text-[10px] uppercase tracking-wider transition ${view === "targets" ? "border-[#f5b74b]/45 bg-[#2a2112] text-[#f4d998]" : "border-transparent text-[#778a92] hover:text-white"}`}><Waypoints className="mr-2 inline h-3.5 w-3.5" />Target range</button>
        </div>

        {view === "traffic" ? <div className="grid gap-5 p-6 lg:grid-cols-[1.1fr_.9fr]">
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
        </div> : <div className="grid gap-5 p-6 lg:grid-cols-[1.1fr_.9fr]">
          <div className="space-y-3">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[.16em] text-[#778a92]"><span>Fictional asset inventory</span><span className="text-[#f4d998]">{assets.length} in-app assets</span></div>
            {assets.map((asset) => (
              <button key={asset.id} type="button" onClick={() => setSelectedAssetId(asset.id)} className={`w-full rounded-xl border p-4 text-left transition ${selectedAsset?.id === asset.id ? "border-[#f5b74b]/60 bg-[#2a2112]" : "border-white/10 bg-[#111c27] hover:border-[#f5b74b]/35"}`}>
                <div className="flex items-center justify-between gap-3"><span className="font-mono text-xs text-[#f4d998]">{asset.name}</span><span className="rounded bg-[#f5b74b]/10 px-2 py-1 font-mono text-[9px] uppercase text-[#f4d998]">{asset.kind}</span></div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#84969d]"><span>{asset.address}</span><span>VLAN {asset.vlan}</span><span>{asset.zone}</span></div>
              </button>
            ))}
          </div>

          {selectedAsset && <div className="rounded-xl border border-[#f5b74b]/25 bg-[#111c27] p-5">
            <div className="flex items-center justify-between gap-3"><div className="font-mono text-[10px] uppercase tracking-[.16em] text-[#f4d998]">Selected training asset</div>{selectedAsset.kind === "Website" ? <Globe2 className="h-4 w-4 text-[#f4d998]" /> : selectedAsset.kind === "PC" ? <Monitor className="h-4 w-4 text-[#f4d998]" /> : <Server className="h-4 w-4 text-[#f4d998]" />}</div>
            <div className="mt-3 font-mono text-sm text-white">{selectedAsset.name}</div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-xs">{[["Asset type", selectedAsset.kind], ["Address", selectedAsset.address], ["VLAN", String(selectedAsset.vlan)], ["Zone", selectedAsset.zone]].map(([label, item]) => <div key={label} className="rounded-lg border border-white/10 bg-[#0d151e] p-3"><div className="font-mono text-[9px] uppercase tracking-wider text-[#778a92]">{label}</div><div className="mt-1 break-all font-mono text-[#dce5e5]">{item}</div></div>)}</div>
            <div className="mt-4 rounded-lg border border-[#63e6e2]/20 bg-[#63e6e2]/5 p-3"><div className="font-mono text-[9px] uppercase tracking-wider text-[#63e6e2]">Modeled condition</div><p className="mt-1 text-sm leading-6 text-[#c8d5d7]">{selectedAsset.modeledCondition}</p></div>
            {selectedAsset.services && <div className="mt-3 rounded-lg border border-[#63e6e2]/20 bg-[#07171d] p-3"><div className="font-mono text-[9px] uppercase tracking-wider text-[#63e6e2]">Synthetic service inventory</div><div className="mt-2 space-y-1.5 font-mono text-[11px] text-[#c8d5d7]">{selectedAsset.services.map(service => <div key={`${service.protocol}-${service.port}`} className="flex items-center justify-between rounded border border-white/10 bg-[#0d151e] px-2 py-1.5"><span className="text-[#63e6e2]">{service.port}/{service.protocol} {service.name}</span><span className="text-right text-[#98aab0]">{service.product}</span></div>)}</div><p className="mt-2 text-[10px] leading-4 text-[#778a92]">These listeners are deterministic range metadata used by ATTACKER-KALI results; they are not live services.</p></div>}
            {selectedAsset.container && <div className="mt-3 rounded-lg border border-[#9a7aff]/30 bg-[#9a7aff]/5 p-3"><div className="font-mono text-[9px] uppercase tracking-wider text-[#c7b8ff]">Container runtime - simulated</div><div className="mt-3 grid grid-cols-2 gap-3 text-xs">{[["Image", selectedAsset.container.image], ["Runtime", selectedAsset.container.runtime], ["Network", selectedAsset.container.network], ["Published ports", selectedAsset.container.publishedPorts.join(", ")], ["Health", selectedAsset.container.health], ["Restart policy", selectedAsset.container.restartPolicy], ["Environment", selectedAsset.container.environmentClassification], ["Volume policy", selectedAsset.container.volumePolicy]].map(([label, item]) => <div key={label} className="rounded border border-white/10 bg-[#0d151e] p-2"><div className="font-mono text-[8px] uppercase tracking-wider text-[#778a92]">{label}</div><div className="mt-1 break-all font-mono text-[10px] text-[#dce5e5]">{item}</div></div>)}</div><div className="mt-3 rounded border border-[#63e6e2]/20 bg-[#63e6e2]/5 p-2"><div className="font-mono text-[8px] uppercase tracking-wider text-[#63e6e2]">Behavioral ingress model</div><div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-[#c8d5d7]"><span>TLS: {selectedAsset.container.behavior.ingress.tlsEnabled ? "enabled" : "pending policy"}</span><span>Certificate: {selectedAsset.container.behavior.ingress.tlsCertValid ? "valid" : "invalid"}</span><span>Bearer token: {selectedAsset.container.behavior.ingress.tokenRequired ? "required" : "pending policy"}</span><span>Rate limit: {selectedAsset.container.behavior.ingress.rateLimitRps} rps / burst {selectedAsset.container.behavior.ingress.burst}</span></div></div><div className="mt-3 rounded border border-[#63e6e2]/20 bg-[#63e6e2]/5 p-2"><div className="font-mono text-[8px] uppercase tracking-wider text-[#63e6e2]">Synthetic kernel and socket</div><div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-[#c8d5d7]"><span>Kernel: {selectedAsset.container.behavior.kernel.version}</span><span>Seccomp: {selectedAsset.container.behavior.kernel.seccompProfile}</span><span>cgroup: {selectedAsset.container.behavior.kernel.memoryLimitMb} MB / {selectedAsset.container.behavior.kernel.cpuLimitCores} CPU / {selectedAsset.container.behavior.kernel.pidsLimit} PIDs</span><span>Socket: {selectedAsset.container.behavior.socket.protocol.toUpperCase()} LISTEN {selectedAsset.container.behavior.socket.interface}:{selectedAsset.container.behavior.socket.port}</span><span>Backlog: {selectedAsset.container.behavior.socket.backlogMax}</span><span>Dropped caps: {selectedAsset.container.behavior.kernel.droppedCapabilities.join(", ")}</span></div></div><div className="mt-3 rounded border border-[#f5b74b]/20 bg-[#f5b74b]/5 p-2 text-xs text-[#d9d0ba]">{selectedAsset.container.logSummary}</div><div className="mt-2 space-y-1 text-xs text-[#c8d5d7]">{selectedAsset.container.simulatedFindings.map(finding => <div key={finding}>- {finding}</div>)}</div></div>}
            <div className="mt-3 rounded-lg border border-[#f5b74b]/20 bg-[#f5b74b]/5 p-3"><div className="font-mono text-[9px] uppercase tracking-wider text-[#f4d998]">Authorized learning boundary</div><p className="mt-1 text-sm leading-6 text-[#d9d0ba]">{selectedAsset.permittedWork}</p></div>
            <div className="mt-4 flex items-center gap-2 text-[11px] text-[#8fa0a7]"><ShieldCheck className="h-4 w-4 shrink-0 text-[#63e6e2]" />Fictional, in-app asset. No live-network access or attack execution.</div>
          </div>}
        </div>}
      </div>
    </div>
  );
}
