import { Activity, ArrowLeft, ClipboardCheck, CircleAlert, Download, Wrench } from "lucide-react";
import { useState } from "react";
import OperationsViewport, { type ConnectorInspection, type OperationsTool, type FiberEndpoint, type CertificationState } from "@/components/OperationsViewport";
import OperationsSchematicPanel from "@/components/OperationsSchematicPanel";

type OperationsSandboxProps = {
  onExit: () => void;
};

type OperationsScenarioId = "quarterly-endface" | "certify-backbone" | "creeping-degradation";

const scenarioLibrary: { id: OperationsScenarioId; title: string; phase: string; description: string; available: boolean; icon: typeof ClipboardCheck }[] = [
  { id: "quarterly-endface", title: "Quarterly Endface Inspection", phase: "Preventive Maintenance", description: "Inspect, clean, and document connector endfaces before contamination becomes an outage.", available: true, icon: Wrench },
  { id: "certify-backbone", title: "Certify New Fiber Backbone", phase: "Commissioning", description: "Establish a measured baseline for a newly installed fiber link before it goes live.", available: true, icon: ClipboardCheck },
  { id: "creeping-degradation", title: "Detect Creeping Degradation", phase: "Monitoring", description: "Compare current link health against a known-good baseline and identify a marginal link.", available: false, icon: Activity },
];

function initialConnectors(): ConnectorInspection[] {
  return Array.from({ length: 24 }, (_, index) => ({ id: `LC-${String(index + 1).padStart(2, "0")}`, score: [3, 7, 14, 16, 20, 23].includes(index) ? 32 : 86, inspected: false, cleaned: false }));
}

function initialFiberEndpoints(): FiberEndpoint[] {
  return [
    { id: "A-01", label: "LC-01", panel: "CE-PATCH-A", connectorType: "LC-UPC", position: [-2.8, 1.85, -1.37], selected: false },
    { id: "A-02", label: "LC-02", panel: "CE-PATCH-A", connectorType: "LC-UPC", position: [-2.4, 1.85, -1.37], selected: false },
    { id: "B-01", label: "LC-01", panel: "CE-PATCH-B", connectorType: "LC-UPC", position: [2.8, 1.85, -1.37], selected: false },
    { id: "B-02", label: "LC-02", panel: "CE-PATCH-B", connectorType: "LC-UPC", position: [2.4, 1.85, -1.37], selected: false },
  ];
}

function initialCertificationState(): CertificationState {
  return {
    sourceEndpoint: null,
    destinationEndpoint: null,
    status: "NOT_READY",
    measuredLossDb: 2.1,
    lossBudgetDb: 3.5,
    sessionId: `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
  };
}

export default function OperationsSandbox({ onExit }: OperationsSandboxProps) {
  const [activeScenario, setActiveScenario] = useState<OperationsScenarioId>("quarterly-endface");
  const [tool, setTool] = useState<OperationsTool | null>(null);
  const [connectors, setConnectors] = useState<ConnectorInspection[]>(initialConnectors());
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const [notice, setNotice] = useState("Select the FI-3000 from the tool bench, then inspect an LC connector.");
  const [endpoints, setEndpoints] = useState<FiberEndpoint[]>(initialFiberEndpoints());
  const [certification, setCertification] = useState<CertificationState>(initialCertificationState());
  const inspectedCount = connectors.filter((connector) => connector.inspected).length;
  const contaminatedCount = connectors.filter((connector) => connector.score < 50 && !connector.cleaned).length;
  const cleanedCount = connectors.filter((connector) => connector.cleaned).length;
  const complete = inspectedCount === connectors.length && contaminatedCount === 0;
  const progress = Math.round((inspectedCount / connectors.length) * 100);
  const selectedConnector = connectors.find((connector) => connector.id === selectedConnectorId);

  function interactWithConnector(id: string) {
    const connector = connectors.find((item) => item.id === id);
    if (!connector) return;
    setSelectedConnectorId(id);
    if (tool === "fi-3000") {
      setConnectors((items) => items.map((item) => item.id === id ? { ...item, inspected: true } : item));
      setNotice(connector.score < 50 && !connector.cleaned ? `${id}: contamination detected. Use Quick Clean, then inspect again.` : `${id}: endface passes visual inspection.`);
      return;
    }
    if (tool === "cleaners") {
      if (!connector.inspected) { setNotice(`${id}: inspect the endface before cleaning it.`); return; }
      if (connector.score >= 50 || connector.cleaned) { setNotice(`${id}: no cleaning action required.`); return; }
      setConnectors((items) => items.map((item) => item.id === id ? { ...item, cleaned: true, score: 92 } : item));
      setNotice(`${id}: endface cleaned. Reinspect with the FI-3000 to verify.`);
      return;
    }
    setNotice("Select a diagnostic tool before interacting with a connector.");
  }

  function selectEndpoint(id: string) {
    if (activeScenario !== "certify-backbone") return;
    if (tool !== "certifiber") {
      setNotice("Select the CertiFiber Pro from the tool bench before selecting endpoints.");
      return;
    }

    const endpoint = endpoints.find((e) => e.id === id);
    if (!endpoint) return;

    // Clear other endpoint if selecting from same panel
    const isSamePanel = certification.sourceEndpoint?.panel === endpoint.panel || certification.destinationEndpoint?.panel === endpoint.panel;

    if (!certification.sourceEndpoint) {
      setCertification((prev) => ({ ...prev, sourceEndpoint: endpoint, status: "NOT_READY" }));
      setEndpoints((prev) => prev.map((e) => e.id === id ? { ...e, selected: true } : { ...e, selected: false }));
      setNotice(`Source endpoint selected: ${endpoint.panel} ${endpoint.label}. Select destination endpoint from the other panel.`);
    } else if (!certification.destinationEndpoint) {
      if (isSamePanel) {
        setNotice("Select an endpoint from the opposite panel as the destination.");
        return;
      }
      setCertification((prev) => ({ ...prev, destinationEndpoint: endpoint, status: "READY_TO_TEST" }));
      setEndpoints((prev) => prev.map((e) => e.id === id ? { ...e, selected: true } : e));
      setNotice(`Both endpoints selected. Run certification test to measure loss.`);
    } else {
      // Reset and start over
      setCertification((prev) => ({ ...prev, sourceEndpoint: endpoint, destinationEndpoint: null, status: "NOT_READY" }));
      setEndpoints((prev) => prev.map((e) => ({ ...e, selected: e.id === id })));
      setNotice(`Source endpoint changed to ${endpoint.panel} ${endpoint.label}. Select destination endpoint.`);
    }
  }

  function runCertificationTest() {
    if (activeScenario !== "certify-backbone") return;
    if (certification.status !== "READY_TO_TEST") {
      setNotice("Select both endpoints before running the certification test.");
      return;
    }

    setCertification((prev) => ({ ...prev, status: "TESTING" }));
    setNotice("Running certification test...");

    // Simulate test delay
    setTimeout(() => {
      const pass = certification.measuredLossDb <= certification.lossBudgetDb;
      setCertification((prev) => ({
        ...prev,
        status: pass ? "PASS" : "FAIL",
      }));
      setNotice(pass ? "Certification PASSED. Loss within budget." : "Certification FAILED. Loss exceeds budget.");
    }, 1500);
  }

  function resetCertification() {
    setCertification(initialCertificationState());
    setEndpoints(initialFiberEndpoints());
    setNotice("Certification reset. Select CertiFiber Pro and endpoints to begin.");
  }

  function exportCertificationReport() {
    if (certification.status !== "PASS" && certification.status !== "FAIL") {
      setNotice("Complete a certification test before exporting the report.");
      return;
    }

    const source = certification.sourceEndpoint;
    const dest = certification.destinationEndpoint;
    if (!source || !dest) return;

    const report = [
      "CONSTRUCTION ENTERPRISES - FIBER BACKBONE CERTIFICATION REPORT",
      "GENERATED BY CE OPERATIONS SANDBOX",
      "",
      `Link ID: ${certification.sessionId}`,
      `Source: ${source.panel} ${source.label}`,
      `Destination: ${dest.panel} ${dest.label}`,
      `Fiber Type: OM4 multimode`,
      `Connector Type: LC/UPC`,
      `Length: 50 meters`,
      `Wavelength: 850 nm`,
      `Loss Budget: ${certification.lossBudgetDb} dB`,
      `Measured Loss: ${certification.measuredLossDb} dB`,
      `Result: ${certification.status}`,
      "",
      `Test Date: ${new Date().toISOString()}`,
    ];

    const blob = new Blob([report.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ce-fiber-certification-${certification.sessionId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("CE certification report exported.");
  }

  function exportLog() {
    const rows = ["Connector,Inspection Score,Inspected,Cleaned", ...connectors.map((connector) => `${connector.id},${connector.score},${connector.inspected},${connector.cleaned}`)];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ce-quarterly-endface-inspection.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("CE inspection log exported.");
  }

  return (
    <main className="min-h-screen bg-[#0b1118] text-[#f2f5f5]">
      <header className="border-b border-white/10 bg-[#0b1118]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onExit} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#63e6e2]/40 bg-[#10252b] text-[#63e6e2] transition hover:border-[#63e6e2]/70 hover:bg-[#173038]" aria-label="Back to curriculum">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[.22em] text-[#63e6e2]">Construction Enterprises</div>
              <div className="font-display text-lg font-semibold tracking-tight">Operations Sandbox</div>
            </div>
          </div>
          <div className="hidden items-center gap-3 text-xs text-[#98a8b0] sm:flex">
            <span>FIELD OPERATIONS SIMULATION</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#f5b74b] shadow-[0_0_10px_#f5b74b]" />
            <span className="font-mono">LAYER 1 - LAYER 3 READINESS</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-5 py-8 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[.2em] text-[#667780]">Operational Readiness</div>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-white">Inspect. Baseline. Restore.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#9eacb2]">Practice commissioning, preventive maintenance, monitoring, diagnosis, repair, and documentation in a dedicated field-operations environment.</p>
          </div>
          <div className="hidden rounded-xl border border-[#f5b74b]/25 bg-[#2a2112] px-4 py-3 text-right md:block">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[#f5b74b]">Module Status</div>
            <div className="mt-1 text-sm text-[#f4d998]">Scenario library ready</div>
          </div>
        </div>

        <nav className="rounded-xl border border-white/10 bg-[#101923] p-2" aria-label="Operations scenario ribbon">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="shrink-0 px-3 font-mono text-[10px] uppercase tracking-[.16em] text-[#f5b74b]">Scenarios</span>
            {scenarioLibrary.map(({ id, title, phase, description, available, icon: Icon }) => (
              <button key={id} type="button" disabled={!available} title={description} onClick={() => setActiveScenario(id)} className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${activeScenario === id ? "border-[#63e6e2]/65 bg-[#173038] text-[#b9eeee]" : "border-white/10 bg-[#0d151e] text-[#8fa0a7] hover:border-white/25 hover:text-white"} ${!available ? "cursor-not-allowed opacity-45" : ""}`}>
                <Icon className="h-3.5 w-3.5" /><span className="font-mono text-[10px] uppercase tracking-wider">{title}</span><span className="font-mono text-[9px] text-[#f5b74b]">{available ? phase : "PLANNED"}</span>
              </button>
            ))}
          </div>
        </nav>

        {activeScenario === "quarterly-endface" ? <section className="mt-5 grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
          <aside className="rounded-xl border border-[#29424a] bg-[#101923] p-5">
            <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[#f5b74b]">Mission Brief</div>
            <h2 className="mt-2 font-display text-xl font-semibold text-white">Quarterly Endface Inspection</h2>
            <p className="mt-2 text-sm leading-6 text-[#8fa0a7]">Inspect every LC connector on CE-PATCH-A. Clean contaminated endfaces and reinspect them before documenting the result.</p>
            <div className="mt-5 space-y-3 border-y border-white/10 py-4 text-xs">
              <div className="flex justify-between"><span className="text-[#778a92]">Tool</span><span className="font-mono text-[#63e6e2]">{tool === "fi-3000" ? "FI-3000" : tool === "cleaners" ? "QUICK CLEAN" : "NONE"}</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Inspected</span><span className="font-mono text-white">{inspectedCount}/24</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Contaminated</span><span className="font-mono text-[#f07178]">{contaminatedCount}</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Cleaned</span><span className="font-mono text-[#63e6e2]">{cleanedCount}</span></div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#63e6e2] transition-all" style={{ width: `${progress}%` }} /></div>
            <div className="mt-3 rounded-lg border border-[#f5b74b]/25 bg-[#2a2112] p-3 text-xs leading-5 text-[#f4d998]">{notice}</div>
            <button type="button" onClick={exportLog} disabled={!complete} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#63e6e2]/35 bg-[#173038] px-3 py-2.5 text-xs text-[#b9eeee] transition hover:border-[#63e6e2]/70 disabled:cursor-not-allowed disabled:opacity-40"><Download className="h-3.5 w-3.5" /> Export inspection log</button>
          </aside>
          <OperationsViewport tool={tool} connectors={connectors} onSelectTool={(nextTool) => { setTool(nextTool); setNotice(nextTool === "fi-3000" ? "FI-3000 selected. Click an LC connector to inspect its endface." : "Quick Clean selected. Click an inspected contaminated connector to clean it."); }} onInspectConnector={interactWithConnector} scenario={activeScenario} certification={undefined} endpoints={undefined} onSelectEndpoint={undefined} />
          <OperationsSchematicPanel tool={tool} connector={selectedConnector} />
        </section> : activeScenario === "certify-backbone" ? <section className="mt-5 grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="rounded-xl border border-[#29424a] bg-[#101923] p-5">
            <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[#f5b74b]">Mission Brief</div>
            <h2 className="mt-2 font-display text-xl font-semibold text-white">Certify New Fiber Backbone</h2>
            <p className="mt-2 text-sm leading-6 text-[#8fa0a7]">Certify a new OM4 multimode fiber backbone before production use using the CertiFiber Pro/OLTS.</p>
            <div className="mt-5 space-y-3 border-y border-white/10 py-4 text-xs">
              <div className="flex justify-between"><span className="text-[#778a92]">Phase</span><span className="font-mono text-[#63e6e2]">Commissioning</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Fiber</span><span className="font-mono text-white">OM4 multimode</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Connector</span><span className="font-mono text-white">LC/UPC</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Length</span><span className="font-mono text-white">50 meters</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Wavelength</span><span className="font-mono text-white">850 nm</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Loss Budget</span><span className="font-mono text-white">{certification.lossBudgetDb} dB</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Measured Loss</span><span className="font-mono text-white">{certification.measuredLossDb} dB</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Status</span><span className={`font-mono ${certification.status === "PASS" ? "text-[#63e6e2]" : certification.status === "FAIL" ? "text-[#f07178]" : "text-white"}`}>{certification.status.replace("_", " ")}</span></div>
            </div>
            <div className="mt-3 rounded-lg border border-[#f5b74b]/25 bg-[#2a2112] p-3 text-xs leading-5 text-[#f4d998]">{notice}</div>
            <div className="mt-4 space-y-2">
              <button type="button" onClick={runCertificationTest} disabled={certification.status !== "READY_TO_TEST"} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#63e6e2]/35 bg-[#173038] px-3 py-2.5 text-xs text-[#b9eeee] transition hover:border-[#63e6e2]/70 disabled:cursor-not-allowed disabled:opacity-40"><ClipboardCheck className="h-3.5 w-3.5" /> Run Certification Test</button>
              <button type="button" onClick={exportCertificationReport} disabled={certification.status !== "PASS" && certification.status !== "FAIL"} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#63e6e2]/35 bg-[#173038] px-3 py-2.5 text-xs text-[#b9eeee] transition hover:border-[#63e6e2]/70 disabled:cursor-not-allowed disabled:opacity-40"><Download className="h-3.5 w-3.5" /> Export Certification Report</button>
              <button type="button" onClick={resetCertification} className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#0d151e] px-3 py-2.5 text-xs text-[#8fa0a7] transition hover:border-white/25">Reset Certification</button>
            </div>
          </aside>
          <OperationsViewport tool={tool} connectors={connectors} onSelectTool={(nextTool) => { setTool(nextTool); setNotice(nextTool === "certifiber" ? "CertiFiber Pro selected. Select source endpoint from CE-PATCH-A." : "Select CertiFiber Pro from the tool bench."); }} onInspectConnector={interactWithConnector} scenario={activeScenario} certification={certification} endpoints={endpoints} onSelectEndpoint={selectEndpoint} />
          <OperationsSchematicPanel tool={tool} connector={selectedConnector} certification={certification} endpoints={endpoints} />
        </section> : <section className="mt-5 rounded-2xl border border-[#f5b74b]/25 bg-[#2a2112] p-6 text-[#f4d998]"><div className="font-mono text-[10px] uppercase tracking-wider text-[#f5b74b]">Scenario planned</div><h2 className="mt-2 font-display text-xl font-semibold text-white">This workflow is queued for the next Operations Sandbox slice.</h2><p className="mt-2 max-w-2xl text-sm leading-6">The scenario remains visible in the library so the operational curriculum is discoverable while we build its procedural tools and acceptance criteria.</p></section>}

        <section className="mt-5 rounded-2xl border border-white/10 bg-[#101923] p-5 lg:p-7">
          <div className="flex items-center gap-3 border-b border-white/10 pb-5">
            <CircleAlert className="h-5 w-5 text-[#f5b74b]" />
            <div>
              <h2 className="font-display text-xl font-semibold text-white">Operations library</h2>
              <p className="mt-1 text-xs text-[#778a92]">Additional commissioning, monitoring, diagnosis, repair, and audit scenarios will use the same procedural scene system.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3"><div className="rounded-lg border border-white/10 bg-[#0d151e] p-4 text-xs text-[#8fa0a7]"><ClipboardCheck className="mb-3 h-4 w-4 text-[#63e6e2]" /><strong className="block text-white">Commissioning</strong>Certify new links and capture known-good baselines.</div><div className="rounded-lg border border-white/10 bg-[#0d151e] p-4 text-xs text-[#8fa0a7]"><Wrench className="mb-3 h-4 w-4 text-[#f5b74b]" /><strong className="block text-white">Maintenance</strong>Inspect and clean infrastructure before failure.</div><div className="rounded-lg border border-white/10 bg-[#0d151e] p-4 text-xs text-[#8fa0a7]"><Activity className="mb-3 h-4 w-4 text-[#63e6e2]" /><strong className="block text-white">Monitoring</strong>Detect degradation and document operational risk.</div></div>
        </section>
      </div>
    </main>
  );
}
