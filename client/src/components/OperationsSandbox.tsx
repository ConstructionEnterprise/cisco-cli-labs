import { Activity, ArrowLeft, ClipboardCheck, CircleAlert, Download, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import OperationsViewport, { type ConnectorInspection, type OperationsTool, type FiberEndpoint, type CertificationState, type DegradationState, type SpliceState, type PolarityState } from "@/components/OperationsViewport";
import OperationsSchematicPanel from "@/components/OperationsSchematicPanel";
import InventoryManagementLibrary from "@/components/InventoryManagementLibrary";
import { createSimulatedFlow, evaluateTraffic, trafficSummary, type SimulatedFlow } from "@/lib/traffic-engine";

type OperationsSandboxProps = {
  onExit: () => void;
};

type OperationsScenarioId = "quarterly-endface" | "certify-backbone" | "creeping-degradation" | "splice-loss-acceptance" | "mpo-polarity-failure" | "inventory-management-library";
type OperationsSnapshot = {
  activeScenario: OperationsScenarioId;
  tool: OperationsTool | null;
  connectors: ConnectorInspection[];
  selectedConnectorId: string | null;
  notice: string;
  endpoints: FiberEndpoint[];
  certification: CertificationState;
  degradation: DegradationState;
  splice: SpliceState;
  polarity: PolarityState;
  trafficFlows: SimulatedFlow[];
};

const OPERATIONS_STORAGE_KEY = "ipv6-cli-lab-operations-sandbox-v1";

function loadOperationsSnapshot(): OperationsSnapshot | null {
  try {
    const raw = window.localStorage.getItem(OPERATIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) as OperationsSnapshot : null;
  } catch {
    return null;
  }
}

const scenarioLibrary: { id: OperationsScenarioId; title: string; phase: string; description: string; available: boolean; icon: typeof ClipboardCheck }[] = [
  { id: "quarterly-endface", title: "Quarterly Endface Inspection", phase: "Preventive Maintenance", description: "Inspect, clean, and document connector endfaces before contamination becomes an outage.", available: true, icon: Wrench },
  { id: "certify-backbone", title: "Certify New Fiber Backbone", phase: "Commissioning", description: "Establish a measured baseline for a newly installed fiber link before it goes live.", available: true, icon: ClipboardCheck },
  { id: "creeping-degradation", title: "Detect Creeping Degradation", phase: "Monitoring", description: "Compare current link health against a known-good baseline and identify a marginal link.", available: true, icon: Activity },
  { id: "splice-loss-acceptance", title: "Splice Loss Acceptance", phase: "Diagnosis", description: "Use OTDR to localize a high-loss splice and verify the repair after re-splicing.", available: true, icon: Activity },
  { id: "mpo-polarity-failure", title: "MPO Polarity Failure", phase: "Diagnosis & Repair", description: "Diagnose a polarity mismatch on an MPO trunk and restore connectivity via repatching.", available: true, icon: Wrench },
  { id: "inventory-management-library", title: "3D Inventory Management and Inspection Library", phase: "Inventory & Inspection", description: "Explore a 3D technician tool crib, inspect asset data, and practice inventory workflows.", available: true, icon: ClipboardCheck },
];

function initialConnectors(): ConnectorInspection[] {
  return Array.from({ length: 24 }, (_, index) => ({ id: `LC-${String(index + 1).padStart(2, "0")}`, score: [3, 7, 14, 16, 20, 23].includes(index) ? 32 : 86, inspected: false, cleaned: false }));
}

function initialFiberEndpoints(): FiberEndpoint[] {
  return [
    { id: "A-01", label: "LC-01", panel: "CE-PATCH-A", connectorType: "LC-UPC", position: [-2.8, 1.65, -1.37], selected: false },
    { id: "A-02", label: "LC-02", panel: "CE-PATCH-A", connectorType: "LC-UPC", position: [-2.4, 1.65, -1.37], selected: false },
    { id: "B-01", label: "LC-01", panel: "CE-PATCH-B", connectorType: "LC-UPC", position: [2.8, 1.65, -1.37], selected: false },
    { id: "B-02", label: "LC-02", panel: "CE-PATCH-B", connectorType: "LC-UPC", position: [2.4, 1.65, -1.37], selected: false },
    { id: "MPO-A", label: "MPO-01", panel: "CE-PATCH-A", connectorType: "MPO-12", position: [-1.0, 1.65, -1.37], selected: false },
    { id: "MPO-B", label: "MPO-01", panel: "CE-PATCH-B", connectorType: "MPO-12", position: [1.0, 1.65, -1.37], selected: false },
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

function initialDegradationState(): DegradationState {
  return {
    sourceEndpoint: null,
    destinationEndpoint: null,
    status: "NOT_READY",
    baselineLossDb: 0.5,
    currentLossDb: 0.5,
    warningThresholdDb: 0.3,
    healthStatus: "UNKNOWN",
    sessionId: `DEGR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
  };
}

function initialSpliceState(): SpliceState {
  return {
    isStripped: false,
    isCleaned: false,
    cleaveAngle: 1.5, // Start with poor cleave
    isLoaded: false,
    coreOffset: 0.8, // Start with poor alignment
    arcPower: 1200,
    fusionDuration: 100,
    isSleeveInstalled: false,
    isHeatShrunk: false,
    workflowStatus: "NOT_READY",
    traceResult: "UNKNOWN",
    certificationStatus: "NOT_READY",
    spliceDistanceM: 47,
    measuredLossDb: 0,
    acceptanceThresholdDb: 0.3,
    sessionId: `SPLICE-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    penalties: {},
  };
}

function initialPolarityState(): PolarityState {
  return {
    sourceEndpoint: null,
    destinationEndpoint: null,
    workflowStatus: "NOT_READY",
    currentPolarity: "METHOD_A",
    requiredPolarity: "METHOD_B",
    uplinkStatus: "DOWN",
    fiberMapping: {},
    sessionId: `MPO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
  };
}

export default function OperationsSandbox({ onExit }: OperationsSandboxProps) {
  const saved = loadOperationsSnapshot();
  const [activeScenario, setActiveScenario] = useState<OperationsScenarioId>(() => saved?.activeScenario ?? "quarterly-endface");
  const [tool, setTool] = useState<OperationsTool | null>(() => saved?.tool ?? null);
  const [connectors, setConnectors] = useState<ConnectorInspection[]>(() => saved?.connectors ?? initialConnectors());
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(() => saved?.selectedConnectorId ?? null);
  const [notice, setNotice] = useState(() => saved?.notice ?? "Select the FI-3000 from the tool bench, then inspect an LC connector.");
  const [endpoints, setEndpoints] = useState<FiberEndpoint[]>(() => saved?.endpoints ?? initialFiberEndpoints());
  const [certification, setCertification] = useState<CertificationState>(() => saved?.certification ?? initialCertificationState());
  const [degradation, setDegradation] = useState<DegradationState>(() => saved?.degradation ?? initialDegradationState());
  const [splice, setSplice] = useState<SpliceState>(() => saved?.splice ?? initialSpliceState());
  const [polarity, setPolarity] = useState<PolarityState>(() => saved?.polarity ?? initialPolarityState());
  const [trafficFlows, setTrafficFlows] = useState<SimulatedFlow[]>(() => saved?.trafficFlows ?? []);

  useEffect(() => {
    window.localStorage.setItem(OPERATIONS_STORAGE_KEY, JSON.stringify({
      activeScenario,
      tool,
      connectors,
      selectedConnectorId,
      notice,
      endpoints,
      certification,
      degradation,
      splice,
      polarity,
      trafficFlows,
    } satisfies OperationsSnapshot));
  }, [activeScenario, certification, connectors, degradation, endpoints, notice, polarity, selectedConnectorId, splice, tool, trafficFlows]);
  const inspectedCount = connectors.filter((connector) => connector.inspected).length;
  const contaminatedCount = connectors.filter((connector) => connector.score < 50 && !connector.cleaned).length;
  const cleanedCount = connectors.filter((connector) => connector.cleaned).length;
  const complete = inspectedCount === connectors.length && contaminatedCount === 0;
  const progress = Math.round((inspectedCount / connectors.length) * 100);
  const selectedConnector = connectors.find((connector) => connector.id === selectedConnectorId);

  function selectScenario(id: OperationsScenarioId) {
    setActiveScenario(id);
    setTool(null);
    setSelectedConnectorId(null);
    setCertification(initialCertificationState());
    setDegradation(initialDegradationState());
    setSplice(initialSpliceState());
    setPolarity(initialPolarityState());
    setEndpoints(initialFiberEndpoints());
    setNotice(id === "certify-backbone" ? "Select the CertiFiber Pro from the tool bench to begin certification." : id === "creeping-degradation" ? "Select the Optical Power Meter from the tool bench to start link health monitoring." : id === "splice-loss-acceptance" ? "Select the OptiFiber Pro (OTDR) from the tool bench to localize the splice fault." : id === "mpo-polarity-failure" ? "Select the MultiFiber Pro from the tool bench to diagnose MPO polarity." : id === "inventory-management-library" ? "Select an asset in the 3D inventory room to inspect its SKU, location, and technical data." : "Select the FI-3000 from the tool bench, then inspect an LC connector.");
    setTrafficFlows([]);
  }

  function runSimulatedInternetTest() {
    const flow = createSimulatedFlow({
      protocol: "https",
      source: "FIELD-TESTER",
      destination: activeScenario === "mpo-polarity-failure" ? "MPO-DOCUMENTATION-SVC" : "CE-OPERATIONS-CLOUD",
      sourceIp: "10.10.10.50",
      destinationIp: "198.51.100.80",
      sourcePort: 49152,
      vlan: 10,
      tls: { serverName: "operations.ce-training", certificateTrusted: true, decryptable: true, inspected: false },
    });
    const decision = evaluateTraffic(flow, { inspectTls: true, denyUntrustedTls: true });
    setTrafficFlows((current) => [decision.flow, ...current].slice(0, 6));
    setNotice("Simulated HTTPS flow " + (decision.allowed ? "inspected and delivered." : "denied by policy."));
  }

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
    if (activeScenario !== "certify-backbone" && activeScenario !== "creeping-degradation" && activeScenario !== "mpo-polarity-failure") return;
    const currentTool = activeScenario === "certify-backbone" ? "certifiber" : activeScenario === "creeping-degradation" ? "optical-meter" : "multifiber";
    if (tool !== currentTool) {
      setNotice(`Select the ${currentTool === "certifiber" ? "CertiFiber Pro" : currentTool === "optical-meter" ? "Optical Power Meter" : "MultiFiber Pro"} from the tool bench before selecting endpoints.`);
      return;
    }

    const endpoint = endpoints.find((e) => e.id === id);
    if (!endpoint) return;

    const isSamePanel = (activeScenario === "certify-backbone" ? certification.sourceEndpoint?.panel === endpoint.panel || certification.destinationEndpoint?.panel === endpoint.panel : activeScenario === "creeping-degradation" ? degradation.sourceEndpoint?.panel === endpoint.panel || degradation.destinationEndpoint?.panel === endpoint.panel : polarity.sourceEndpoint?.panel === endpoint.panel || polarity.destinationEndpoint?.panel === endpoint.panel);

    if (activeScenario === "certify-backbone") {
      if (!certification.sourceEndpoint) {
        setCertification((prev: CertificationState) => ({ ...prev, sourceEndpoint: endpoint, status: "NOT_READY" }));
        setEndpoints((prev) => prev.map((e) => e.id === id ? { ...e, selected: true } : { ...e, selected: false }));
        setNotice(`Source endpoint selected: ${endpoint.panel} ${endpoint.label}. Select destination endpoint from the other panel.`);
      } else if (!certification.destinationEndpoint) {
        if (isSamePanel) {
          setNotice("Select an endpoint from the opposite panel as the destination.");
          return;
        }
        setCertification((prev: CertificationState) => ({ ...prev, destinationEndpoint: endpoint, status: "READY_TO_TEST" }));
        setEndpoints((prev) => prev.map((e) => e.id === id ? { ...e, selected: true } : e));
        setNotice(`Both endpoints selected. Run certification test to measure loss.`);
      } else {
        setCertification((prev: CertificationState) => ({ ...prev, sourceEndpoint: endpoint, destinationEndpoint: null, status: "NOT_READY" }));
        setEndpoints((prev) => prev.map((e) => ({ ...e, selected: e.id === id })));
        setNotice(`Source endpoint changed to ${endpoint.panel} ${endpoint.label}. Select destination endpoint.`);
      }
    } else if (activeScenario === "creeping-degradation") {
      if (!degradation.sourceEndpoint) {
        setDegradation((prev: DegradationState) => ({ ...prev, sourceEndpoint: endpoint, status: "NOT_READY" }));
        setEndpoints((prev) => prev.map((e) => e.id === id ? { ...e, selected: true } : { ...e, selected: false }));
        setNotice(`Source endpoint selected: ${endpoint.panel} ${endpoint.label}. Select destination endpoint from the other panel.`);
      } else if (!degradation.destinationEndpoint) {
        if (isSamePanel) {
          setNotice("Select an endpoint from the opposite panel as the destination.");
          return;
        }
        setDegradation((prev: DegradationState) => ({ ...prev, destinationEndpoint: endpoint, status: "NOT_READY" }));
        setEndpoints((prev) => prev.map((e) => e.id === id ? { ...e, selected: true } : e));
        setNotice(`Both endpoints selected. Capture the known-good baseline to begin monitoring.`);
      } else {
        setDegradation((prev: DegradationState) => ({ ...prev, sourceEndpoint: endpoint, destinationEndpoint: null, status: "NOT_READY" }));
        setEndpoints((prev) => prev.map((e) => ({ ...e, selected: e.id === id })));
        setNotice(`Source endpoint changed to ${endpoint.panel} ${endpoint.label}. Select destination endpoint.`);
      }
    } else {
      if (!polarity.sourceEndpoint) {
        setPolarity((prev: PolarityState) => ({ ...prev, sourceEndpoint: endpoint, status: "NOT_READY" }));
        setEndpoints((prev) => prev.map((e) => e.id === id ? { ...e, selected: true } : { ...e, selected: false }));
        setNotice(`Source endpoint selected: ${endpoint.panel} ${endpoint.label}. Select destination endpoint from the other panel.`);
      } else if (!polarity.destinationEndpoint) {
        if (isSamePanel) {
          setNotice("Select an endpoint from the opposite panel as the destination.");
          return;
        }
        setPolarity((prev: PolarityState) => ({ ...prev, destinationEndpoint: endpoint, status: "NOT_READY" }));
        setEndpoints((prev) => prev.map((e) => e.id === id ? { ...e, selected: true } : e));
        setNotice(`Both endpoints selected. Run polarity diagnosis to analyze fiber mapping.`);
      } else {
        setPolarity((prev: PolarityState) => ({ ...prev, sourceEndpoint: endpoint, destinationEndpoint: null, status: "NOT_READY" }));
        setEndpoints((prev) => prev.map((e) => ({ ...e, selected: e.id === id })));
        setNotice(`Source endpoint changed to ${endpoint.panel} ${endpoint.label}. Select destination endpoint.`);
      }
    }
  }

  function runCertificationTest() {
    if (activeScenario !== "certify-backbone") return;
    if (certification.status !== "READY_TO_TEST") {
      setNotice("Select both endpoints before running the certification test.");
      return;
    }

    setCertification((prev: CertificationState) => ({ ...prev, status: "TESTING" }));
    setNotice("Running certification test...");

    setTimeout(() => {
      const pass = certification.measuredLossDb <= certification.lossBudgetDb;
      setCertification((prev: CertificationState) => ({
        ...prev,
        status: pass ? "PASS" : "FAIL",
      }));
      setNotice(pass ? "Certification PASSED. Loss within budget." : "Certification FAILED. Loss exceeds budget.");
    }, 1500);
  }

  function captureBaseline() {
    if (activeScenario !== "creeping-degradation") return;
    if (!degradation.sourceEndpoint || !degradation.destinationEndpoint) {
      setNotice("Select both endpoints before capturing the baseline.");
      return;
    }

    setDegradation((prev: DegradationState) => ({ ...prev, status: "MEASURING" }));
    setNotice("Capturing known-good baseline...");

    setTimeout(() => {
      setDegradation((prev: DegradationState) => ({
        ...prev,
        status: "BASELINE_CAPTURED",
        baselineLossDb: 0.42,
      }));
      setNotice("Baseline captured: 0.42 dB. Now run current measurement to check for degradation.");
    }, 1500);
  }

  function runMeasurement() {
    if (activeScenario !== "creeping-degradation") return;
    if (degradation.status !== "BASELINE_CAPTURED") {
      setNotice("Capture the known-good baseline before running current measurement.");
      return;
    }

    setDegradation((prev: DegradationState) => ({ ...prev, status: "MEASURING" }));
    setNotice("Running current optical loss measurement...");

    setTimeout(() => {
      const currentLoss = 0.85;
      const delta = currentLoss - degradation.baselineLossDb;
      let health: DegradationState["healthStatus"] = "HEALTHY";
      if (delta > degradation.warningThresholdDb * 2) {
        health = "FAILED";
      } else if (delta > degradation.warningThresholdDb) {
        health = "MARGINAL";
      }

      setDegradation((prev: DegradationState) => ({
        ...prev,
        status: "COMPLETED",
        currentLossDb: currentLoss,
        healthStatus: health,
      }));
      setNotice(`Measurement complete: ${currentLoss} dB. Delta: ${delta.toFixed(2)} dB. Status: ${health}.`);
    }, 1500);
  }

  function exportDegradationReport() {
    if (degradation.status !== "COMPLETED") {
      setNotice("Complete the measurement process before exporting the report.");
      return;
    }

    const source = degradation.sourceEndpoint;
    const dest = degradation.destinationEndpoint;
    if (!source || !dest) return;

    const report = [
      "CONSTRUCTION ENTERPRISES - LINK DEGRADATION REPORT",
      "GENERATED BY CE OPERATIONS SANDBOX",
      "",
      `Session ID: ${degradation.sessionId}`,
      `Source: ${source.panel} ${source.label}`,
      `Destination: ${dest.panel} ${dest.label}`,
      `Baseline Loss: ${degradation.baselineLossDb} dB`,
      `Current Loss: ${degradation.currentLossDb} dB`,
      `Loss Delta: ${Math.abs(degradation.currentLossDb - degradation.baselineLossDb).toFixed(2)} dB`,
      `Warning Threshold: ${degradation.warningThresholdDb} dB`,
      `Health Status: ${degradation.healthStatus}`,
      "",
      `Test Date: ${new Date().toISOString()}`,
    ];

    const blob = new Blob([report.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ce-degradation-report-${degradation.sessionId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("CE degradation report exported.");
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

  function calculateSpliceLoss(state: SpliceState): { loss: number; penalties: Record<string, number> } {
    const penalties: Record<string, number> = {};
    let loss = 0.15; // Base loss for a perfect splice

    if (!state.isCleaned) {
      penalties["Contamination"] = 0.20;
      loss += 0.20;
    }
    if (state.cleaveAngle > 0.8) {
      const p = parseFloat(((state.cleaveAngle - 0.8) * 0.15).toFixed(2));
      penalties["Cleave Angle"] = p;
      loss += p;
    }
    if (state.coreOffset > 0.2) {
      const p = parseFloat(((state.coreOffset - 0.2) * 0.10).toFixed(2));
      penalties["Core Offset"] = p;
      loss += p;
    }
    if (state.arcPower < 1100 || state.arcPower > 1300) {
      penalties["Arc Power"] = 0.10;
      loss += 0.10;
    }
    if (state.fusionDuration < 80) {
      penalties["Fusion Duration"] = 0.10;
      loss += 0.10;
    }
    if (!state.isHeatShrunk) {
      penalties["Heat Shrink"] = 0.05;
      loss += 0.05;
    }

    return { loss: parseFloat(loss.toFixed(2)), penalties };
  }

  function stripFiber() {
    if (activeScenario !== "splice-loss-acceptance") return;
    setSplice((prev) => ({ ...prev, isStripped: true, workflowStatus: "PREPPING" }));
    setNotice("Fiber jacket stripped. Now clean the bare fiber.");
  }

  function cleanFiber() {
    if (activeScenario !== "splice-loss-acceptance") return;
    if (!splice.isStripped) {
      setNotice("Strip the fiber jacket before attempting to clean.");
      return;
    }
    setSplice((prev) => ({ ...prev, isCleaned: true }));
    setNotice("Fiber cleaned. Perform a precision cleave.");
  }

  function cleaveFiber() {
    if (activeScenario !== "splice-loss-acceptance") return;
    if (!splice.isCleaned) {
      setNotice("Clean the fiber before cleaving to avoid trapping contaminants.");
      return;
    }
    // Deterministically fail on first attempt; pass only on repair (after a FAIL trace)
    const angle = splice.traceResult === "FAIL" ? 0.6 : 1.5;
    setSplice((prev) => ({ ...prev, cleaveAngle: angle }));
    setNotice(`Fiber cleaved. Angle: ${angle}° ${angle < 1.0 ? " (Pass)" : " (Fail)"}. Load fibers into the splicer.`);
  }

  function loadSplicer() {
    if (activeScenario !== "splice-loss-acceptance") return;
    if (splice.cleaveAngle === 0) {
      setNotice("Perform a precision cleave before loading fibers.");
      return;
    }
    setSplice((prev) => ({ ...prev, isLoaded: true }));
    setNotice("Fibers loaded and aligned. Ready for arc fusion.");
  }

  function fuseFiber() {
    if (activeScenario !== "splice-loss-acceptance") return;
    if (!splice.isLoaded) {
      setNotice("Load fibers into the fusion splicer first.");
      return;
    }
    setSplice((prev) => ({ ...prev, workflowStatus: "FUSING" }));
    setNotice("Initiating arc fusion... aligning cores...");
    setTimeout(() => {
      setSplice((prev) => {
        const finalOffset = prev.traceResult === "FAIL" ? 0.3 : 0.8;
        return { ...prev, coreOffset: finalOffset, workflowStatus: "PROTECTING" };
      });
      setNotice("Fusion complete. Core offset: 0.3μm. Install the splice sleeve.");
    }, 2000);
  }

  function installSleeve() {
    if (activeScenario !== "splice-loss-acceptance") return;
    if (splice.workflowStatus !== "PROTECTING") {
      setNotice("Complete the fusion process before installing the sleeve.");
      return;
    }
    setSplice((prev) => ({ ...prev, isSleeveInstalled: true }));
    setNotice("Splice sleeve installed. Place in oven for heat-shrinking.");
  }

  function heatSleeve() {
    if (activeScenario !== "splice-loss-acceptance") return;
    if (!splice.isSleeveInstalled) {
      setNotice("Install the splice sleeve before heating.");
      return;
    }
    setNotice("Heating sleeve...");
    setTimeout(() => {
      setSplice((prev) => ({ ...prev, isHeatShrunk: true }));
      setNotice("Sleeve heat-shrunk and cooled. Run OTDR trace to verify loss.");
    }, 2000);
  }

  function runOTDRTrace() {
    if (activeScenario !== "splice-loss-acceptance") return;
    if (tool !== "otdr") {
      setNotice("Select the OptiFiber Pro (OTDR) from the tool bench to start the trace.");
      return;
    }
    if (!splice.isHeatShrunk) {
      setNotice("Protect the splice with a heat-shrunk sleeve before tracing.");
      return;
    }

    setSplice((prev: SpliceState) => ({ ...prev, workflowStatus: "TRACING" }));
    setNotice("Sending high-power pulse... analyzing backscatter...");

    setTimeout(() => {
      setSplice((prev) => {
        const { loss, penalties } = calculateSpliceLoss(prev);
        const pass = loss <= 0.3;

        setNotice(pass ? `Trace complete: Splice loss ${loss} dB (PASS).` : `Trace complete: High loss detected at 47m (${loss} dB). Re-splicing required.`);

        return {
          ...prev,
          traceResult: pass ? "PASS" : "FAIL",
          measuredLossDb: loss,
          penalties: penalties,
        };
      });
    }, 2000);
  }

  function runSpliceCertification() {
    if (activeScenario !== "splice-loss-acceptance") return;
    if (tool !== "certifiber") {
      setNotice("Select the CertiFiber Pro (OLTS) from the tool bench to perform final certification.");
      return;
    }
    if (splice.traceResult !== "PASS") {
      setNotice("The splice must pass OTDR verification before final certification.");
      return;
    }

    setSplice((prev: SpliceState) => ({ ...prev, certificationStatus: "TESTING" }));
    setNotice("Running final OLTS certification...");

    setTimeout(() => {
      setSplice((prev: SpliceState) => ({
        ...prev,
        certificationStatus: "PASS",
        workflowStatus: "CERTIFIED",
      }));
      setNotice("Final certification PASSED. Link is now fully operational.");
    }, 1500);
  }

  function exportSpliceReport() {
    if (splice.workflowStatus === "NOT_READY") {
      setNotice("Perform a trace before exporting the report.");
      return;
    }

    const report = [
      "CONSTRUCTION ENTERPRISES - SPLICE ACCEPTANCE REPORT",
      "GENERATED BY CE OPERATIONS SANDBOX",
      "",
      `Session ID: ${splice.sessionId}`,
      `Splice Location: ${splice.spliceDistanceM} meters`,
      `Measured Loss: ${splice.measuredLossDb} dB`,
      `Acceptance Threshold: ${splice.acceptanceThresholdDb} dB`,
      `OTDR Result: ${splice.traceResult}`,
      `Final Certification: ${splice.certificationStatus}`,
      "",
      `Physical State:`,
      `Strip: ${splice.isStripped ? "YES" : "NO"}`,
      `Clean: ${splice.isCleaned ? "YES" : "NO"}`,
      `Cleave Angle: ${splice.cleaveAngle} deg`,
      `Core Offset: ${splice.coreOffset} um`,
      `Sleeve: ${splice.isHeatShrunk ? "HEAT-SHRUNK" : "NOT PROTECTED"}`,
      "",
      `Test Date: ${new Date().toISOString()}`,
    ];

    const blob = new Blob([report.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ce-splice-report-${splice.sessionId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("CE splice report exported.");
  }


  function runPolarityTest() {
    if (activeScenario !== "mpo-polarity-failure") return;
    if (tool !== "multifiber") {
      setNotice("Select the MultiFiber Pro from the tool bench to begin polarity diagnosis.");
      return;
    }
    if (!polarity.sourceEndpoint || !polarity.destinationEndpoint) {
      setNotice("Select both MPO endpoints before running the polarity test.");
      return;
    }
    if (polarity.sourceEndpoint.connectorType !== "MPO-12" || polarity.destinationEndpoint.connectorType !== "MPO-12") {
      setNotice("Invalid connector type. MultiFiber Pro requires MPO-12 endpoints.");
      return;
    }

    setPolarity((prev: PolarityState) => ({ ...prev, workflowStatus: "DIAGNOSING" }));
    setNotice("Scanning MPO fiber cores... analyzing polarity mapping...");

    setTimeout(() => {
      const mapping: Record<number, "PASS" | "FAIL"> = {};
      for (let i = 1; i <= 12; i++) {
        mapping[i] = (i === 1 || i === 12) ? "FAIL" : "PASS";
      }

      setPolarity((prev: PolarityState) => ({
        ...prev,
        workflowStatus: "MISMATCH",
        currentPolarity: "METHOD_A",
        requiredPolarity: "METHOD_B",
        fiberMapping: mapping,
      }));
      setNotice("Polarity MISMATCH detected. Current: Method A, Required: Method B. Repatching required to restore uplink.");
    }, 2000);
  }

  function repatchMPO() {
    if (activeScenario !== "mpo-polarity-failure") return;
    if (polarity.workflowStatus !== "MISMATCH") {
      setNotice("Polarity mismatch must be diagnosed before repatching.");
      return;
    }

    setPolarity((prev: PolarityState) => ({ ...prev, workflowStatus: "REPATCHING" }));
    setNotice("Swapping MPO patch cables to match Method B polarity...");

    setTimeout(() => {
      setPolarity((prev: PolarityState) => ({
        ...prev,
        workflowStatus: "REPATCHED",
        uplinkStatus: "DOWN",
      }));
      setNotice("Repatching complete. Run final certification test to bring the uplink UP.");
    }, 2000);
  }

  function runMPOCertification() {
    if (activeScenario !== "mpo-polarity-failure") return;
    if (tool !== "multifiber") {
      setNotice("Select the MultiFiber Pro from the tool bench to perform final certification.");
      return;
    }
    if (!polarity.sourceEndpoint || !polarity.destinationEndpoint) {
      setNotice("Endpoints missing. Select both MPO endpoints before certification.");
      return;
    }
    if (polarity.sourceEndpoint.connectorType !== "MPO-12" || polarity.destinationEndpoint.connectorType !== "MPO-12") {
      setNotice("Invalid connector type. MultiFiber Pro requires MPO-12 endpoints.");
      return;
    }
    if (polarity.workflowStatus !== "REPATCHED") {
      setNotice("Trunk must be repatched before certification.");
      return;
    }

    setPolarity((prev: PolarityState) => ({ ...prev, workflowStatus: "DIAGNOSING" }));
    setNotice("Running final MPO polarity certification...");

    setTimeout(() => {
      const mapping: Record<number, "PASS" | "FAIL"> = {};
      for (let i = 1; i <= 12; i++) mapping[i] = "PASS";

      setPolarity((prev: PolarityState) => ({
        ...prev,
        workflowStatus: "COMPLETED",
        uplinkStatus: "UP",
        fiberMapping: mapping,
      }));
      setNotice("Certification PASSED. MPO polarity verified. Uplink is now UP.");
    }, 1500);
  }

  function exportMPOReport() {
    if (polarity.workflowStatus === "NOT_READY") {
      setNotice("Perform a polarity test before exporting the report.");
      return;
    }

    const report = [
      "CONSTRUCTION ENTERPRISES - MPO POLARITY REPORT",
      "GENERATED BY CE OPERATIONS SANDBOX",
      "",
      `Session ID: ${polarity.sessionId}`,
      `Required Polarity: ${polarity.requiredPolarity}`,
      `Measured Polarity: ${polarity.currentPolarity}`,
      `Uplink Status: ${polarity.uplinkStatus}`,
      `Workflow Status: ${polarity.workflowStatus}`,
      "",
      "Fiber Mapping:",
      "Fiber,Status",
      ...Object.entries(polarity.fiberMapping).map(([f, s]) => `${f},${s}`),
      "",
      `Test Date: ${new Date().toISOString()}`,
    ];

    const blob = new Blob([report.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ce-mpo-polarity-report-${polarity.sessionId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("CE MPO report exported.");
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
              <button key={id} type="button" disabled={!available} title={description} onClick={() => selectScenario(id)} className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${activeScenario === id ? "border-[#63e6e2]/65 bg-[#173038] text-[#b9eeee]" : "border-white/10 bg-[#0d151e] text-[#8fa0a7] hover:border-white/25 hover:text-white"} ${!available ? "cursor-not-allowed opacity-45" : ""}`}>
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
          <OperationsViewport tool={tool} connectors={connectors} onSelectTool={(nextTool) => { setTool(nextTool); setNotice(nextTool === "fi-3000" ? "FI-3000 selected. Click an LC connector to inspect its endface." : "Quick Clean selected. Click an inspected contaminated connector to clean it."); }} onInspectConnector={interactWithConnector} scenario={activeScenario} certification={undefined} degradation={undefined} endpoints={undefined} onSelectEndpoint={undefined} />
          <OperationsSchematicPanel tool={tool} connector={selectedConnector} certification={undefined} degradation={undefined} endpoints={undefined} />
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
          <OperationsViewport tool={tool} connectors={connectors} onSelectTool={(nextTool) => { setTool(nextTool); setNotice(nextTool === "certifiber" ? "CertiFiber Pro selected. Select source endpoint from CE-PATCH-A." : "Select CertiFiber Pro from the tool bench."); }} onInspectConnector={interactWithConnector} scenario={activeScenario} certification={certification} degradation={undefined} endpoints={endpoints} onSelectEndpoint={selectEndpoint} />
          <OperationsSchematicPanel tool={tool} connector={selectedConnector} certification={certification} degradation={undefined} endpoints={endpoints} />
        </section> : activeScenario === "creeping-degradation" ? <section className="mt-5 grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="rounded-xl border border-[#29424a] bg-[#101923] p-5">
            <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[#f5b74b]">Mission Brief</div>
            <h2 className="mt-2 font-display text-xl font-semibold text-white">Detect Creeping Degradation</h2>
            <p className="mt-2 text-sm leading-6 text-[#8fa0a7]">Monitor a critical fiber link for gradual loss increase. Compare current measurement against the established baseline.</p>
            <div className="mt-5 space-y-3 border-y border-white/10 py-4 text-xs">
              <div className="flex justify-between"><span className="text-[#778a92]">Tool</span><span className="font-mono text-[#63e6e2]">{tool === "optical-meter" ? "OPTICAL METER" : "NONE"}</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Baseline</span><span className="font-mono text-white">{degradation.baselineLossDb} dB</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Current</span><span className="font-mono text-white">{degradation.currentLossDb} dB</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Delta</span><span className="font-mono text-white">{Math.abs(degradation.currentLossDb - degradation.baselineLossDb).toFixed(2)} dB</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Threshold</span><span className="font-mono text-white">{degradation.warningThresholdDb} dB</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Status</span><span className={`font-mono ${degradation.healthStatus === "HEALTHY" ? "text-[#63e6e2]" : degradation.healthStatus === "MARGINAL" ? "text-[#f5b74b]" : degradation.healthStatus === "FAILED" ? "text-[#f07178]" : "text-white"}`}>{degradation.healthStatus.replace("_", " ")}</span></div>
            </div>
            <div className="mt-3 rounded-lg border border-[#f5b74b]/25 bg-[#2a2112] p-3 text-xs leading-5 text-[#f4d998]">{notice}</div>
            <div className="mt-4 space-y-2">
      <button type="button" onClick={captureBaseline} disabled={degradation.status !== "NOT_READY"} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#63e6e2]/35 bg-[#173038] px-3 py-2.5 text-xs text-[#b9eeee] transition hover:border-[#63e6e2]/70 disabled:cursor-not-allowed disabled:opacity-40"><ClipboardCheck className="h-3.5 w-3.5" /> Capture Baseline</button>
              <button type="button" onClick={runMeasurement} disabled={degradation.status !== "BASELINE_CAPTURED"} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#63e6e2]/35 bg-[#173038] px-3 py-2.5 text-xs text-[#b9eeee] transition hover:border-[#63e6e2]/70 disabled:cursor-not-allowed disabled:opacity-40"><Activity className="h-3.5 w-3.5" /> Run Current Measurement</button>
              <button type="button" onClick={exportDegradationReport} disabled={degradation.status !== "COMPLETED"} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#63e6e2]/35 bg-[#173038] px-3 py-2.5 text-xs text-[#b9eeee] transition hover:border-[#63e6e2]/70 disabled:cursor-not-allowed disabled:opacity-40"><Download className="h-3.5 w-3.5" /> Export Degradation Report</button>
              <button type="button" onClick={() => { setDegradation(initialDegradationState()); setEndpoints(initialFiberEndpoints()); setNotice("Degradation scenario reset. Select the Optical Power Meter and endpoints to begin."); }} className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#0d151e] px-3 py-2.5 text-xs text-[#8fa0a7] transition hover:border-white/25">Reset Monitoring</button>
            </div>
          </aside>
          <OperationsViewport tool={tool} connectors={connectors} onSelectTool={(nextTool) => { setTool(nextTool); setNotice(nextTool === "optical-meter" ? "Optical Power Meter selected. Select source endpoint from CE-PATCH-A." : "Select Optical Power Meter from the tool bench."); }} onInspectConnector={interactWithConnector} scenario={activeScenario} certification={undefined} degradation={degradation} endpoints={endpoints} onSelectEndpoint={selectEndpoint} />
          <OperationsSchematicPanel tool={tool} connector={selectedConnector} certification={undefined} degradation={degradation} endpoints={endpoints} />
        </section> : activeScenario === "splice-loss-acceptance" ? <section className="mt-5 grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="rounded-xl border border-[#29424a] bg-[#101923] p-5">
            <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[#f5b74b]">Mission Brief</div>
            <h2 className="mt-2 font-display text-xl font-semibold text-white">Splice Loss Acceptance</h2>
            <p className="mt-2 text-sm leading-6 text-[#8fa0a7]">Localize the high-loss splice using the OTDR, then re-splice the fiber and verify that the loss is now within the 0.3 dB threshold.</p>
            <div className="mt-5 space-y-3 border-y border-white/10 py-4 text-xs">
              <div className="flex justify-between"><span className="text-[#778a92]">Tool</span><span className="font-mono text-[#63e6e2]">{tool === "otdr" ? "OPTIFIBER PRO" : "NONE"}</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Status</span><span className={`font-mono ${splice.workflowStatus === "CERTIFIED" ? "text-[#63e6e2]" : splice.traceResult === "FAIL" ? "text-[#f07178]" : "text-white"}`}>{splice.workflowStatus.replace("_", " ")}</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Measured Loss</span><span className="font-mono text-white">{splice.measuredLossDb} dB</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Threshold</span><span className="font-mono text-white">{splice.acceptanceThresholdDb} dB</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Trace Result</span><span className={`font-mono ${splice.traceResult === "PASS" ? "text-[#63e6e2]" : splice.traceResult === "FAIL" ? "text-[#f07178]" : "text-white"}`}>{splice.traceResult}</span></div>
            </div>
            <div className="mt-3 rounded-lg border border-[#f5b74b]/25 bg-[#2a2112] p-3 text-xs leading-5 text-[#f4d998]">{notice}</div>
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={stripFiber} className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#0d151e] px-3 py-2 text-xs text-[#8fa0a7] transition hover:bg-white/5"><Wrench className="h-3.5 w-3.5" /> Strip Fiber</button>
                <button type="button" onClick={cleanFiber} disabled={!splice.isStripped} className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#0d151e] px-3 py-2 text-xs text-[#8fa0a7] transition hover:bg-white/5 disabled:opacity-40"><Wrench className="h-3.5 w-3.5" /> Clean Fiber</button>
                <button type="button" onClick={cleaveFiber} disabled={!splice.isCleaned} className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#0d151e] px-3 py-2 text-xs text-[#8fa0a7] transition hover:bg-white/5 disabled:opacity-40"><Wrench className="h-3.5 w-3.5" /> Cleave Fiber</button>
                <button type="button" onClick={loadSplicer} disabled={splice.cleaveAngle === 0} className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#0d151e] px-3 py-2 text-xs text-[#8fa0a7] transition hover:bg-white/5 disabled:opacity-40"><Wrench className="h-3.5 w-3.5" /> Load Splicer</button>
                <button type="button" onClick={fuseFiber} disabled={!splice.isLoaded} className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#0d151e] px-3 py-2 text-xs text-[#8fa0a7] transition hover:bg-white/5 disabled:opacity-40"><Wrench className="h-3.5 w-3.5" /> Fuse Fiber</button>
                <button type="button" onClick={installSleeve} disabled={splice.workflowStatus !== "PROTECTING"} className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#0d151e] px-3 py-2 text-xs text-[#8fa0a7] transition hover:bg-white/5 disabled:opacity-40"><Wrench className="h-3.5 w-3.5" /> Install Sleeve</button>
                <button type="button" onClick={heatSleeve} disabled={!splice.isSleeveInstalled} className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#0d151e] px-3 py-2 text-xs text-[#8fa0a7] transition hover:bg-white/5 disabled:opacity-40"><Wrench className="h-3.5 w-3.5" /> Heat Sleeve</button>
              </div>
              <div className="mt-4 space-y-2">
                <button type="button" onClick={runOTDRTrace} disabled={tool !== "otdr" || !splice.isHeatShrunk} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#63e6e2]/35 bg-[#173038] px-3 py-2.5 text-xs text-[#b9eeee] transition hover:border-[#63e6e2]/70 disabled:cursor-not-allowed disabled:opacity-40"><Activity className="h-3.5 w-3.5" /> Run OTDR Trace</button>
                <button type="button" onClick={runSpliceCertification} disabled={tool !== "certifiber" || splice.traceResult !== "PASS"} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#63e6e2]/35 bg-[#173038] px-3 py-2.5 text-xs text-[#b9eeee] transition hover:border-[#63e6e2]/70 disabled:cursor-not-allowed disabled:opacity-40"><ClipboardCheck className="h-3.5 w-3.5" /> Final Certification</button>
                <button type="button" onClick={exportSpliceReport} disabled={splice.workflowStatus === "NOT_READY"} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#63e6e2]/35 bg-[#173038] px-3 py-2.5 text-xs text-[#b9eeee] transition hover:border-[#63e6e2]/70 disabled:cursor-not-allowed disabled:opacity-40"><Download className="h-3.5 w-3.5" /> Export Report</button>
              </div>
              <button type="button" onClick={() => { setSplice(initialSpliceState()); setNotice("Splice scenario reset. Select the OptiFiber Pro and start the trace."); }} className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#0d151e] px-3 py-2.5 text-xs text-[#8fa0a7] transition hover:border-white/25">Reset Diagnosis</button>
            </div>
          </aside>
          <OperationsViewport tool={tool} connectors={connectors} onSelectTool={(nextTool) => { setTool(nextTool); setNotice(nextTool === "otdr" ? "OptiFiber Pro selected. Run the trace to localize the fault." : "Select OptiFiber Pro from the tool bench."); }} onInspectConnector={interactWithConnector} scenario={activeScenario} certification={undefined} degradation={undefined} splice={splice} polarity={undefined} endpoints={endpoints} onSelectEndpoint={undefined} />
          <OperationsSchematicPanel tool={tool} connector={selectedConnector} certification={undefined} degradation={undefined} splice={splice} endpoints={endpoints} />
        </section> : activeScenario === "mpo-polarity-failure" ? <section className="mt-5 grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="rounded-xl border border-[#29424a] bg-[#101923] p-5">
            <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[#f5b74b]">Mission Brief</div>
            <h2 className="mt-2 font-display text-xl font-semibold text-white">MPO Polarity Failure</h2>
            <p className="mt-2 text-sm leading-6 text-[#8fa0a7]">Diagnose a polarity mismatch on an MPO trunk using the MultiFiber Pro and restore the uplink by repatching to the correct method.</p>
            <div className="mt-5 space-y-3 border-y border-white/10 py-4 text-xs">
              <div className="flex justify-between"><span className="text-[#778a92]">Tool</span><span className="font-mono text-[#63e6e2]">{tool === "multifiber" ? "MULTIFIBER PRO" : "NONE"}</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Status</span><span className={`font-mono ${polarity.workflowStatus === "COMPLETED" ? "text-[#63e6e2]" : polarity.workflowStatus === "MISMATCH" ? "text-[#f07178]" : "text-white"}`}>{polarity.workflowStatus.replace("_", " ")}</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Current Polarity</span><span className="font-mono text-white">{polarity.currentPolarity.replace("_", " ")}</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Required Polarity</span><span className="font-mono text-white">{polarity.requiredPolarity.replace("_", " ")}</span></div>
              <div className="flex justify-between"><span className="text-[#778a92]">Uplink Status</span><span className={`font-mono ${polarity.uplinkStatus === "UP" ? "text-[#63e6e2]" : "text-[#f07178]"}`}>{polarity.uplinkStatus}</span></div>
            </div>
            <div className="mt-3 rounded-lg border border-[#f5b74b]/25 bg-[#2a2112] p-3 text-xs leading-5 text-[#f4d998]">{notice}</div>
            <div className="mt-4 space-y-2">
              <button type="button" onClick={runPolarityTest} disabled={tool !== "multifiber"} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#63e6e2]/35 bg-[#173038] px-3 py-2.5 text-xs text-[#b9eeee] transition hover:border-[#63e6e2]/70 disabled:cursor-not-allowed disabled:opacity-40"><Activity className="h-3.5 w-3.5" /> Diagnose Polarity</button>
              <button type="button" onClick={repatchMPO} disabled={polarity.workflowStatus !== "MISMATCH"} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#63e6e2]/35 bg-[#173038] px-3 py-2.5 text-xs text-[#b9eeee] transition hover:border-[#63e6e2]/70 disabled:cursor-not-allowed disabled:opacity-40"><Wrench className="h-3.5 w-3.5" /> Repatch Trunk</button>
              <button type="button" onClick={runMPOCertification} disabled={tool !== "multifiber" || polarity.workflowStatus !== "REPATCHED"} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#63e6e2]/35 bg-[#173038] px-3 py-2.5 text-xs text-[#b9eeee] transition hover:border-[#63e6e2]/70 disabled:cursor-not-allowed disabled:opacity-40"><ClipboardCheck className="h-3.5 w-3.5" /> Run Certification</button>
              <button type="button" onClick={exportMPOReport} disabled={polarity.workflowStatus === "NOT_READY"} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#63e6e2]/35 bg-[#173038] px-3 py-2.5 text-xs text-[#b9eeee] transition hover:border-[#63e6e2]/70 disabled:cursor-not-allowed disabled:opacity-40"><Download className="h-3.5 w-3.5" /> Export Report</button>
              <button type="button" onClick={() => { setPolarity(initialPolarityState()); setNotice("Polarity scenario reset. Select the MultiFiber Pro and diagnose the link."); }} className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#0d151e] px-3 py-2.5 text-xs text-[#8fa0a7] transition hover:border-white/25">Reset Diagnosis</button>
            </div>
          </aside>
          <OperationsViewport tool={tool} connectors={connectors} onSelectTool={(nextTool) => { setTool(nextTool); setNotice(nextTool === "multifiber" ? "MultiFiber Pro selected. Run the polarity test." : "Select MultiFiber Pro from the tool bench."); }} onInspectConnector={interactWithConnector} scenario={activeScenario} certification={undefined} degradation={undefined} splice={undefined} polarity={polarity} endpoints={endpoints} onSelectEndpoint={selectEndpoint} />
          <OperationsSchematicPanel tool={tool} connector={selectedConnector} certification={undefined} degradation={undefined} splice={undefined} polarity={polarity} endpoints={endpoints} />
        </section> : activeScenario === "inventory-management-library" ? <InventoryManagementLibrary /> : <section className="mt-5 rounded-2xl border border-[#f5b74b]/25 bg-[#2a2112] p-6 text-[#f4d998]"><div className="font-mono text-[10px] uppercase tracking-wider text-[#f5b74b]">Scenario planned</div><h2 className="mt-2 font-display text-xl font-semibold text-white">This workflow is queued for the next Operations Sandbox slice.</h2><p className="mt-2 max-w-2xl text-sm leading-6">The scenario remains visible in the library so the operational curriculum is discoverable while we build its procedural tools and acceptance criteria.</p></section>}

        {activeScenario !== "inventory-management-library" && <section className="mt-5 rounded-2xl border border-[#63e6e2]/20 bg-[#101923] p-5 lg:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[#63e6e2]">Simulated Internet Traffic Fabric</div>
              <h2 className="mt-1 font-display text-xl font-semibold text-white">Reusable protocol flow test</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-[#778a92]">Generate deterministic HTTPS traffic for inspection, certificate, NAT, VPN, and troubleshooting workflows. This is modeled traffic, not a live internet connection.</p>
            </div>
            <button type="button" onClick={runSimulatedInternetTest} className="rounded-lg border border-[#63e6e2]/35 bg-[#173038] px-3 py-2 text-xs text-[#b9eeee] transition hover:border-[#63e6e2]/70">Run HTTPS flow test</button>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {trafficFlows.length ? trafficFlows.map((flow) => (
              <div key={flow.id} className="rounded-lg border border-white/10 bg-[#0d151e] p-3 text-xs">
                <div className="font-mono text-[#63e6e2]">{trafficSummary(flow)}</div>
                <div className="mt-1 text-[#8fa0a7]">Stages: {flow.stages.join(" -> ")}</div>
              </div>
            )) : <div className="text-xs text-[#667780]">No simulated flows have been generated in this operations session.</div>}
          </div>
        </section>}

        {activeScenario !== "inventory-management-library" && <section className="mt-5 rounded-2xl border border-white/10 bg-[#101923] p-5 lg:p-7">
          <div className="flex items-center gap-3 border-b border-white/10 pb-5">
            <CircleAlert className="h-5 w-5 text-[#f5b74b]" />
            <div>
              <h2 className="font-display text-xl font-semibold text-white">Operations library</h2>
              <p className="mt-1 text-xs text-[#778a92]">Additional commissioning, monitoring, diagnosis, repair, and audit scenarios will use the same procedural scene system.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3"><div className="rounded-lg border border-white/10 bg-[#0d151e] p-4 text-xs text-[#8fa0a7]"><ClipboardCheck className="mb-3 h-4 w-4 text-[#63e6e2]" /><strong className="block text-white">Commissioning</strong>Certify new links and capture known-good baselines.</div><div className="rounded-lg border border-white/10 bg-[#0d151e] p-4 text-xs text-[#8fa0a7]"><Wrench className="mb-3 h-4 w-4 text-[#f5b74b]" /><strong className="block text-white">Maintenance</strong>Inspect and clean infrastructure before failure.</div><div className="rounded-lg border border-white/10 bg-[#0d151e] p-4 text-xs text-[#8fa0a7]"><Activity className="mb-3 h-4 w-4 text-[#63e6e2]" /><strong className="block text-white">Monitoring</strong>Detect degradation and document operational risk.</div></div>
        </section>}
      </div>
    </main>
  );
}
