import type { ConnectorInspection, OperationsTool, FiberEndpoint, CertificationState, DegradationState, SpliceState, PolarityState } from "@/components/OperationsViewport";

type OperationsSchematicPanelProps = {
  tool: OperationsTool | null;
  connector: ConnectorInspection | undefined;
  certification?: CertificationState | undefined;
  degradation?: DegradationState | undefined;
  splice?: SpliceState | undefined;
  polarity?: PolarityState | undefined;
  endpoints?: FiberEndpoint[] | undefined;
};

function SchematicNode({ label, value, accent }: { label: string; value: string; accent: string }) {
  return <div className="rounded-lg border border-white/10 bg-[#0b151d] p-3"><div className="font-mono text-[9px] uppercase tracking-wider text-[#71858d]">{label}</div><div className="mt-1 text-xs font-semibold" style={{ color: accent }}>{value}</div></div>;
}

function ToolDrawing({ tool }: { tool: OperationsTool | null }) {
  if (!tool) {
    return <svg viewBox="0 0 300 150" className="h-36 w-full" role="img" aria-label="No tool selected"><rect x="1" y="1" width="298" height="148" rx="10" fill="#0b151d" stroke="#29424a" /><path d="M105 76h90" stroke="#31545d" strokeDasharray="5 5" /><circle cx="150" cy="76" r="20" fill="#101923" stroke="#526d74" /><path d="M143 76h14M150 69v14" stroke="#778a92" /><text x="150" y="125" fill="#778a92" fontSize="10" textAnchor="middle" fontFamily="monospace">SELECT A TOOL</text></svg>;
  }
  if (tool === "fi-3000") {
    return <svg viewBox="0 0 300 150" className="h-36 w-full" role="img" aria-label="FI-3000 FiberInspector schematic">
      <rect x="1" y="1" width="298" height="148" rx="10" fill="#0b151d" stroke="#29424a" />
      <text x="16" y="20" fill="#63e6e2" fontSize="9" fontFamily="monospace" letterSpacing="2">FI-3000 / FIBERINSPECTOR</text>
      <rect x="48" y="48" width="151" height="55" rx="12" fill="#176b79" stroke="#63e6e2" strokeWidth="2" />
      <rect x="75" y="60" width="56" height="27" rx="3" fill="#081217" stroke="#b9eeee" />
      <path d="M83 79h38M83 73h24" stroke="#63e6e2" strokeWidth="2" />
      <circle cx="158" cy="73" r="7" fill="#f5b74b" /><circle cx="179" cy="73" r="7" fill="#0b151d" stroke="#b9eeee" />
      <rect x="199" y="63" width="25" height="25" rx="5" fill="#d6d8d4" stroke="#f2f5f5" /><circle cx="237" cy="76" r="13" fill="#15252d" stroke="#d6d8d4" strokeWidth="4" /><circle cx="237" cy="76" r="5" fill="#63e6e2" />
      <path d="M48 76H29" stroke="#d6d8d4" strokeWidth="7" /><path d="M23 66v20" stroke="#f5b74b" strokeWidth="4" />
      <text x="150" y="128" fill="#8fa0a7" fontSize="10" textAnchor="middle" fontFamily="monospace">INSPECTION CAMERA / LC ADAPTER</text>
    </svg>;
  }
  if (tool === "certifiber") {
    return <svg viewBox="0 0 300 150" className="h-36 w-full" role="img" aria-label="CertiFiber Pro/OLTS schematic">
      <rect x="1" y="1" width="298" height="148" rx="10" fill="#0b151d" stroke="#29424a" />
      <text x="16" y="20" fill="#63e6e2" fontSize="9" fontFamily="monospace" letterSpacing="2">CERTIFIBER PRO / OLTS</text>
      <rect x="40" y="45" width="140" height="60" rx="12" fill="#1a4a6e" stroke="#63e6e2" strokeWidth="2" />
      <rect x="55" y="55" width="110" height="40" rx="6" fill="#081217" stroke="#b9eeee" />
      <text x="110" y="75" fill="#63e6e2" fontSize="11" textAnchor="middle" fontFamily="monospace">LOSS: 2.1 dB</text>
      <text x="110" y="88" fill="#f5b74b" fontSize="9" textAnchor="middle" fontFamily="monospace">BUDGET: 3.5 dB</text>
      <rect x="190" y="55" width="30" height="40" rx="4" fill="#26343a" stroke="#d6d8d4" />
      <circle cx="235" cy="75" r="12" fill="#15252d" stroke="#63e6e2" strokeWidth="3" />
      <path d="M230 75h10M235 70v10" stroke="#63e6e2" strokeWidth="2" />
      <path d="M40 75H25" stroke="#d6d8d4" strokeWidth="6" /><path d="M20 65v20" stroke="#f5b74b" strokeWidth="3" />
      <text x="150" y="128" fill="#8fa0a7" fontSize="10" textAnchor="middle" fontFamily="monospace">OPTICAL LOSS TEST SET / LC-UPC</text>
    </svg>;
  }
  if (tool === "optical-meter") {
    return <svg viewBox="0 0 300 150" className="h-36 w-full" role="img" aria-label="Optical Power Meter schematic">
      <rect x="1" y="1" width="298" height="148" rx="10" fill="#0b151d" stroke="#29424a" />
      <text x="16" y="20" fill="#63e6e2" fontSize="9" fontFamily="monospace" letterSpacing="2">OPTICAL POWER METER</text>
      <rect x="52" y="42" width="151" height="66" rx="10" fill="#23627a" stroke="#63e6e2" strokeWidth="2" />
      <rect x="74" y="54" width="78" height="28" rx="4" fill="#081217" stroke="#b9eeee" />
      <text x="113" y="72" fill="#63e6e2" fontSize="11" textAnchor="middle" fontFamily="monospace">-0.5 dBm</text>
      <circle cx="174" cy="68" r="7" fill="#63e6e2" /><circle cx="190" cy="68" r="7" fill="#f5b74b" />
      <rect x="203" y="57" width="25" height="40" rx="5" fill="#26343a" stroke="#d6d8d4" />
      <circle cx="243" cy="77" r="13" fill="#15252d" stroke="#d6d8d4" strokeWidth="4" /><circle cx="243" cy="77" r="5" fill="#63e6e2" />
      <path d="M52 76H31" stroke="#d6d8d4" strokeWidth="7" /><path d="M25 66v20" stroke="#63e6e2" strokeWidth="4" />
      <text x="150" y="128" fill="#8fa0a7" fontSize="10" textAnchor="middle" fontFamily="monospace">OPTICAL LOSS MEASUREMENT / LC ADAPTER</text>
    </svg>;
  }
  if (tool === "multifiber") {
    return <svg viewBox="0 0 300 150" className="h-36 w-full" role="img" aria-label="MultiFiber Pro schematic">
      <rect x="1" y="1" width="298" height="148" rx="10" fill="#0b151d" stroke="#29424a" />
      <text x="16" y="20" fill="#63e6e2" fontSize="9" fontFamily="monospace" letterSpacing="2">MULTIFIBER PRO / MPO-12</text>
      <rect x="40" y="45" width="140" height="60" rx="12" fill="#4a3e5b" stroke="#63e6e2" strokeWidth="2" />
      <rect x="55" y="55" width="110" height="40" rx="6" fill="#081217" stroke="#b9eeee" />
      <text x="110" y="75" fill="#63e6e2" fontSize="11" textAnchor="middle" fontFamily="monospace">POLARITY: METHOD A</text>
      <text x="110" y="88" fill="#f5b74b" fontSize="9" textAnchor="middle" fontFamily="monospace">UPLINK: DOWN</text>
      <rect x="190" y="55" width="30" height="40" rx="4" fill="#26343a" stroke="#d6d8d4" />
      <circle cx="235" cy="75" r="12" fill="#15252d" stroke="#63e6e2" strokeWidth="3" />
      <path d="M230 75h10M235 70v10" stroke="#63e6e2" strokeWidth="2" />
      <path d="M40 75H25" stroke="#d6d8d4" strokeWidth="6" /><path d="M20 65v20" stroke="#f5b74b" strokeWidth="3" />
      <text x="150" y="128" fill="#8fa0a7" fontSize="10" textAnchor="middle" fontFamily="monospace">MPO POLARITY TESTER / MPO-12</text>
    </svg>;
  }
  return <svg viewBox="0 0 300 150" className="h-36 w-full" role="img" aria-label="Quick Clean cleaner schematic">
    <rect x="1" y="1" width="298" height="148" rx="10" fill="#0b151d" stroke="#29424a" />
    <text x="16" y="20" fill="#f5b74b" fontSize="9" fontFamily="monospace" letterSpacing="2">QUICK CLEAN / 1.25 MM TIP</text>
    <rect x="73" y="59" width="137" height="30" rx="15" fill="#d38d2f" stroke="#f5d992" strokeWidth="2" />
    <rect x="204" y="64" width="31" height="20" rx="5" fill="#26343a" stroke="#d6d8d4" />
    <path d="M73 74H48" stroke="#d6d8d4" strokeWidth="8" /><path d="M40 67v14" stroke="#63e6e2" strokeWidth="4" />
    <path d="M105 59v30M137 59v30M169 59v30" stroke="#9b5d1b" strokeWidth="2" />
    <circle cx="227" cy="74" r="4" fill="#63e6e2" />
    <text x="150" y="128" fill="#8fa0a7" fontSize="10" textAnchor="middle" fontFamily="monospace">ENDFACE CLEANING PEN / LC TIP</text>
  </svg>;
}

function LinkDrawing({ connector }: { connector: ConnectorInspection | undefined }) {
  const status = connector?.cleaned ? "CLEAN" : connector?.inspected ? connector.score < 50 ? "CONTAMINATED" : "PASS" : "READY";
  const statusColor = status === "CLEAN" || status === "PASS" ? "#63e6e2" : status === "CONTAMINATED" ? "#f07178" : "#f5b74b";
  return <svg viewBox="0 0 300 150" className="h-36 w-full" role="img" aria-label="Fiber and LC connector schematic">
    <rect x="1" y="1" width="298" height="148" rx="10" fill="#0b151d" stroke="#29424a" />
    <text x="16" y="20" fill="#b9eeee" fontSize="9" fontFamily="monospace" letterSpacing="2">OM4 / LC-UPC LINK</text>
    <rect x="24" y="58" width="47" height="37" rx="4" fill="#182830" stroke="#63e6e2" /><path d="M35 67h25M35 75h25M35 83h25" stroke="#63e6e2" strokeWidth="3" />
    <path d="M71 76C108 40 190 40 229 76" fill="none" stroke="#63e6e2" strokeWidth="4" /><path d="M84 76h80" stroke="#b9eeee" strokeWidth="1" strokeDasharray="4 4" />
    <rect x="229" y="58" width="47" height="37" rx="4" fill="#182830" stroke={statusColor} /><circle cx="243" cy="76" r="7" fill={statusColor} /><circle cx="262" cy="76" r="7" fill={statusColor} />
    <text x="150" y="119" fill={statusColor} fontSize="10" textAnchor="middle" fontFamily="monospace">{connector ? `${connector.id} / ${status}` : "SELECT CONNECTOR"}</text>
    <text x="150" y="134" fill="#778a92" fontSize="9" textAnchor="middle" fontFamily="monospace">50 M / 850 NM / LC-UPC</text>
  </svg>;
}

function CertificationDrawing({ certification, endpoints }: { certification: CertificationState | undefined; endpoints: FiberEndpoint[] | undefined }) {
  const status = certification?.status || "NOT_READY";
  const statusColor = status === "PASS" ? "#63e6e2" : status === "FAIL" ? "#f07178" : status === "TESTING" ? "#f5b74b" : "#778a92";
  const source = certification?.sourceEndpoint;
  const dest = certification?.destinationEndpoint;

  return <svg viewBox="0 0 300 150" className="h-36 w-full" role="img" aria-label="Fiber certification schematic">
    <rect x="1" y="1" width="298" height="148" rx="10" fill="#0b151d" stroke="#29424a" />
    <text x="16" y="20" fill="#b9eeee" fontSize="9" fontFamily="monospace" letterSpacing="2">FIBER CERTIFICATION</text>
    <rect x="24" y="58" width="47" height="37" rx="4" fill="#182830" stroke={source ? "#63e6e2" : "#778a92"} />
    <text x="47" y="80" fill={source ? "#63e6e2" : "#778a92"} fontSize="10" textAnchor="middle" fontFamily="monospace">{source ? source.label : "SOURCE"}</text>
    <path d="M71 76C108 40 190 40 229 76" fill="none" stroke={statusColor} strokeWidth="4" />
    <rect x="229" y="58" width="47" height="37" rx="4" fill="#182830" stroke={dest ? "#63e6e2" : "#778a92"} />
    <text x="252" y="80" fill={dest ? "#63e6e2" : "#778a92"} fontSize="10" textAnchor="middle" fontFamily="monospace">{dest ? dest.label : "DEST"}</text>
    <text x="150" y="119" fill={statusColor} fontSize="10" textAnchor="middle" fontFamily="monospace">{status.replace("_", " ")}</text>
    <text x="150" y="134" fill="#778a92" fontSize="9" textAnchor="middle" fontFamily="monospace">OM4 / 50M / 850NM / LC-UPC</text>
  </svg>;
}

function DegradationDrawing({ degradation }: { degradation: DegradationState | undefined }) {
  const status = degradation?.healthStatus || "UNKNOWN";
  const statusColor = status === "HEALTHY" ? "#63e6e2" : status === "MARGINAL" ? "#f5b74b" : status === "FAILED" ? "#f07178" : "#778a92";
  const source = degradation?.sourceEndpoint;
  const dest = degradation?.destinationEndpoint;

  return <svg viewBox="0 0 300 150" className="h-36 w-full" role="img" aria-label="Fiber degradation schematic">
    <rect x="1" y="1" width="298" height="148" rx="10" fill="#0b151d" stroke="#29424a" />
    <text x="16" y="20" fill="#b9eeee" fontSize="9" fontFamily="monospace" letterSpacing="2">FIBER HEALTH MONITORING</text>
    <rect x="24" y="58" width="47" height="37" rx="4" fill="#182830" stroke={source ? "#63e6e2" : "#778a92"} />
    <text x="47" y="80" fill={source ? "#63e6e2" : "#778a92"} fontSize="10" textAnchor="middle" fontFamily="monospace">{source ? source.label : "SOURCE"}</text>
    <path d="M71 76C108 40 190 40 229 76" fill="none" stroke={statusColor} strokeWidth="4" />
    <rect x="229" y="58" width="47" height="37" rx="4" fill="#182830" stroke={dest ? "#63e6e2" : "#778a92"} />
    <text x="252" y="80" fill={dest ? "#63e6e2" : "#778a92"} fontSize="10" textAnchor="middle" fontFamily="monospace">{dest ? dest.label : "DEST"}</text>
    <text x="150" y="117" fill={statusColor} fontSize="10" textAnchor="middle" fontFamily="monospace">{status.replace("_", " ")}</text>
    <text x="150" y="130" fill="#b9eeee" fontSize="8" textAnchor="middle" fontFamily="monospace">BASE {degradation?.baselineLossDb ?? "-"} dB / CURRENT {degradation?.currentLossDb ?? "-"} dB</text>
    <text x="150" y="142" fill="#778a92" fontSize="8" textAnchor="middle" fontFamily="monospace">DELTA {degradation ? Math.abs(degradation.currentLossDb - degradation.baselineLossDb).toFixed(2) : "-"} dB / OM4 / LC-UPC</text>
  </svg>;
}

function SpliceDrawing({ splice }: { splice: SpliceState | undefined }) {
  const status = splice?.traceResult || "UNKNOWN";
  const statusColor = status === "PASS" ? "#63e6e2" : status === "FAIL" ? "#f07178" : "#778a92";

  const events = [
    { dist: 0, type: "Launch", loss: 0.02, ref: -40 },
    { dist: 2, type: "Connector", loss: 0.12, ref: -35 },
    { dist: splice?.spliceDistanceM || 47, type: "Splice", loss: splice?.measuredLossDb || 0, ref: -60 },
    { dist: 100, type: "End of Fiber", loss: 0.05, ref: -70 },
  ];

  return (
    <svg viewBox="0 0 300 280" className="h-64 w-full" role="img" aria-label="Professional OTDR Splice Analysis">
      <rect x="1" y="1" width="298" height="278" rx="10" fill="#0b151d" stroke="#29424a" />
      <text x="16" y="20" fill="#b9eeee" fontSize="9" fontFamily="monospace" letterSpacing="2">OTDR EVENT TABLE / HIGH-RES ANALYSIS</text>

      {/* Trace Visualization */}
      <path d="M24 60 L60 60 L150 75 L229 60" fill="none" stroke={statusColor} strokeWidth="3" />
      <circle cx="150" cy="75" r="4" fill={statusColor} />
      <text x="150" y="55" fill={statusColor} fontSize="8" textAnchor="middle" fontFamily="monospace">{splice?.measuredLossDb} dB</text>

      {/* Event Table */}
      <g transform="translate(24, 90)">
        <rect x="0" y="0" width="252" height="120" rx="4" fill="#081217" stroke="#29424a" />
        <text x="5" y="15" fill="#63e6e2" fontSize="8" fontFamily="monospace" fontWeight="bold">DISTANCE (m)</text>
        <text x="70" y="15" fill="#63e6e2" fontSize="8" fontFamily="monospace" fontWeight="bold">EVENT</text>
        <text x="150" y="15" fill="#63e6e2" fontSize="8" fontFamily="monospace" fontWeight="bold">LOSS (dB)</text>
        <text x="210" y="15" fill="#63e6e2" fontSize="8" fontFamily="monospace" fontWeight="bold">REFL (dB)</text>

        {events.map((e, i) => (
          <g key={i} transform={`translate(0, ${25 + i * 20})`}>
            <text x="5" y="10" fill="#8fa0a7" fontSize="8" fontFamily="monospace">{e.dist}m</text>
            <text x="70" y="10" fill="#f2f5f5" fontSize="8" fontFamily="monospace">{e.type}</text>
            <text x="150" y="10" fill={e.type === "Splice" ? (e.loss <= 0.3 ? "#63e6e2" : "#f07178") : "#8fa0a7"} fontSize="8" fontFamily="monospace">{e.loss} dB</text>
            <text x="210" y="10" fill="#8fa0a7" fontSize="8" fontFamily="monospace">{e.ref} dB</text>
          </g>
        ))}
      </g>

      {/* Penalties Breakdown */}
      <g transform="translate(24, 220)">
        <text x="0" y="0" fill="#63e6e2" fontSize="8" fontFamily="monospace" fontWeight="bold">LOSS PENALTIES</text>
        {Object.entries(splice?.penalties || {}).map(([key, val], i) => (
          <text key={key} x="0" y={12 + i * 12} fill="#8fa0a7" fontSize="7" fontFamily="monospace">{key}: +{val} dB</text>
        ))}
        {Object.keys(splice?.penalties || {}).length === 0 && (
          <text x="0" y="12" fill="#8fa0a7" fontSize="7" fontFamily="monospace">No penalties detected</text>
        )}
      </g>

      <text x="150" y="265" fill={statusColor} fontSize="10" textAnchor="middle" fontFamily="monospace">
        {status === "UNKNOWN" ? "TRACING..." : status === "PASS" ? "SPLICE ACCEPTED" : "SPLICE REJECTED"}
      </text>
    </svg>
  );
}

function PolarityDrawing({ polarity }: { polarity: PolarityState | undefined }) {
  const status = polarity?.uplinkStatus || "DOWN";
  const statusColor = status === "UP" ? "#63e6e2" : "#f07178";

  const fibers = Array.from({ length: 12 }, (_, i) => i + 1);

  return <svg viewBox="0 0 300 150" className="h-36 w-full" role="img" aria-label="MPO polarity schematic">
    <rect x="1" y="1" width="298" height="148" rx="10" fill="#0b151d" stroke="#29424a" />
    <text x="16" y="20" fill="#b9eeee" fontSize="9" fontFamily="monospace" letterSpacing="2">MPO POLARITY ANALYSIS</text>

    {/* Fiber Mapping Chart */}
    <rect x="40" y="35" width="220" height="60" rx="4" fill="#081217" stroke="#29424a" />
    <text x="45" y="45" fill="#778a92" fontSize="7" fontFamily="monospace">FIBER MAPPING (1-12)</text>
    {fibers.map((f, i) => {
      const x = 50 + (i * 17);
      const fiberStatus = polarity?.fiberMapping?.[f] || "UNKNOWN";
      const color = fiberStatus === "PASS" ? "#63e6e2" : fiberStatus === "FAIL" ? "#f07178" : "#31545d";
      return (
        <g key={f}>
          <rect x={x} y="55" width="12" height="25" rx="2" fill="#101923" stroke={color} strokeWidth="1" />
          <text x={x + 6} y="73" fill={color} fontSize="7" textAnchor="middle" fontFamily="monospace">{f}</text>
          <circle cx={x + 6} cy="90" r="2" fill={color} />
        </g>
      );
    })}

    <rect x="24" y="105" width="47" height="37" rx="4" fill="#182830" stroke="#63e6e2" />
    <text x="47" y="127" fill="#63e6e2" fontSize="10" textAnchor="middle" fontFamily="monospace">SW-01</text>
    <path d="M71 121C108 85 190 85 229 121" fill="none" stroke={statusColor} strokeWidth="4" />
    <rect x="229" y="105" width="47" height="37" rx="4" fill="#182830" stroke="#63e6e2" />
    <text x="252" y="127" fill="#63e6e2" fontSize="10" textAnchor="middle" fontFamily="monospace">SW-02</text>

    <text x="150" y="110" fill={statusColor} fontSize="10" textAnchor="middle" fontFamily="monospace">{status === "UP" ? "UPLINK ACTIVE" : "UPLINK DOWN"}</text>
    <text x="150" y="140" fill="#778a92" fontSize="8" textAnchor="middle" fontFamily="monospace">MPO-12 TRUNK / OM4 / 12-FIBER</text>
  </svg>;
}

export default function OperationsSchematicPanel({ tool, connector, certification, degradation, splice, polarity, endpoints }: OperationsSchematicPanelProps) {
  const isCertificationScenario = !!certification && !!endpoints;
  const isDegradationScenario = !!degradation && !!endpoints;

  if (isCertificationScenario) {
    const toolName = tool === "certifiber" ? "CertiFiber Pro/OLTS" : "No tool selected";
    const toolStatus = tool === "certifiber" ? "SELECTED" : tool ? "WRONG TOOL" : "STANDBY";
    const certStatus = certification.status.replace("_", " ");
    const certColor = certification.status === "PASS" ? "#63e6e2" : certification.status === "FAIL" ? "#f07178" : certification.status === "TESTING" ? "#f5b74b" : "#778a92";

    return (
      <aside className="rounded-xl border border-[#29424a] bg-[#101923] p-5">
        <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[#63e6e2]">Operations Schematic</div>
        <h2 className="mt-2 font-display text-lg font-semibold text-white">Fiber Certification</h2>
        <p className="mt-1 text-xs leading-5 text-[#778a92]">CertiFiber Pro, fiber path, and certification status.</p>
        <div className="mt-4 space-y-2"><ToolDrawing tool={tool} /><CertificationDrawing certification={certification} endpoints={endpoints} /></div>
        <div className="mt-5 space-y-2">
          <SchematicNode label="Tool" value={toolName} accent={tool ? "#63e6e2" : "#778a92"} />
          <div className="mx-auto h-5 w-px bg-[#31545d]" />
          <SchematicNode label="Fiber" value="OM4 multimode · 50 m" accent="#b9eeee" />
          <div className="mx-auto h-5 w-px bg-[#31545d]" />
          <SchematicNode label="Status" value={certStatus} accent={certColor} />
        </div>
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="flex justify-between text-xs"><span className="text-[#778a92]">Tool state</span><span className="font-mono text-[#63e6e2]">{toolStatus}</span></div>
          <div className="mt-3 flex justify-between text-xs"><span className="text-[#778a92]">Certification status</span><span className="font-mono" style={{ color: certColor }}>{certStatus}</span></div>
          <div className="mt-3 flex justify-between text-xs"><span className="text-[#778a92]">Measured loss</span><span className="font-mono text-white">{certification.measuredLossDb} dB</span></div>
          <div className="mt-3 flex justify-between text-xs"><span className="text-[#778a92]">Loss budget</span><span className="font-mono text-white">{certification.lossBudgetDb} dB</span></div>
        </div>
        <div className="mt-5 rounded-lg border border-[#63e6e2]/15 bg-[#0b151d] p-3 text-[11px] leading-5 text-[#8fa0a7]">Select CertiFiber Pro, then source and destination endpoints. Run certification test to measure loss.</div>
      </aside>
    );
  }

  if (isDegradationScenario) {
    const toolName = tool === "optical-meter" ? "Optical Power Meter" : "No tool selected";
    const toolStatus = tool === "optical-meter" ? "SELECTED" : tool ? "WRONG TOOL" : "STANDBY";
    const degStatus = degradation.healthStatus.replace("_", " ");
    const degColor = degradation.healthStatus === "HEALTHY" ? "#63e6e2" : degradation.healthStatus === "MARGINAL" ? "#f5b74b" : degradation.healthStatus === "FAILED" ? "#f07178" : "#778a92";

    return (
      <aside className="rounded-xl border border-[#29424a] bg-[#101923] p-5">
        <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[#63e6e2]">Operations Schematic</div>
        <h2 className="mt-2 font-display text-lg font-semibold text-white">Link Degradation</h2>
        <p className="mt-1 text-xs leading-5 text-[#778a92]">Optical Power Meter, fiber path, and health status.</p>
        <div className="mt-4 space-y-2"><ToolDrawing tool={tool} /><DegradationDrawing degradation={degradation} /></div>
        <div className="mt-5 space-y-2">
          <SchematicNode label="Tool" value={toolName} accent={tool ? "#63e6e2" : "#778a92"} />
          <div className="mx-auto h-5 w-px bg-[#31545d]" />
          <SchematicNode label="Fiber" value="OM4 multimode · 50 m" accent="#b9eeee" />
          <div className="mx-auto h-5 w-px bg-[#31545d]" />
          <SchematicNode label="Status" value={degStatus} accent={degColor} />
        </div>
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="flex justify-between text-xs"><span className="text-[#778a92]">Tool state</span><span className="font-mono text-[#63e6e2]">{toolStatus}</span></div>
          <div className="mt-3 flex justify-between text-xs"><span className="text-[#778a92]">Baseline loss</span><span className="font-mono text-white">{degradation.baselineLossDb} dB</span></div>
          <div className="mt-3 flex justify-between text-xs"><span className="text-[#778a92]">Current loss</span><span className="font-mono text-white">{degradation.currentLossDb} dB</span></div>
          <div className="mt-3 flex justify-between text-xs"><span className="text-[#778a92]">Loss delta</span><span className="font-mono text-white">{Math.abs(degradation.currentLossDb - degradation.baselineLossDb).toFixed(2)} dB</span></div>
          <div className="mt-3 flex justify-between text-xs"><span className="text-[#778a92]">Threshold</span><span className="font-mono text-white">{degradation.warningThresholdDb} dB</span></div>
          <div className="mt-3 flex justify-between text-xs"><span className="text-[#778a92]">Health status</span><span className="font-mono" style={{ color: degColor }}>{degStatus}</span></div>
        </div>
        <div className="mt-5 rounded-lg border border-[#63e6e2]/15 bg-[#0b151d] p-3 text-[11px] leading-5 text-[#8fa0a7]">Select the Optical Power Meter, then source and destination endpoints. Capture baseline, then run current measurement.</div>
      </aside>
    );
  }

  if (splice) {
    const toolName = tool === "otdr" ? "OptiFiber Pro (OTDR)" : "No tool selected";
    const toolStatus = tool === "otdr" ? "SELECTED" : tool ? "WRONG TOOL" : "STANDBY";
    const spliceStatus = splice.workflowStatus.replace("_", " ");
    const spliceColor = splice.traceResult === "PASS" ? "#63e6e2" : splice.traceResult === "FAIL" ? "#f07178" : "#778a92";

    return (
      <aside className="rounded-xl border border-[#29424a] bg-[#101923] p-5">
        <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[#63e6e2]">Operations Schematic</div>
        <h2 className="mt-2 font-display text-lg font-semibold text-white">Splice Acceptance</h2>
        <p className="mt-1 text-xs leading-5 text-[#778a92]">OTDR trace, splice location, and loss verification.</p>
        <div className="mt-4 space-y-2"><ToolDrawing tool={tool} /><SpliceDrawing splice={splice} /></div>
        <div className="mt-5 space-y-2">
          <SchematicNode label="Tool" value={toolName} accent={tool ? "#63e6e2" : "#778a92"} />
          <div className="mx-auto h-5 w-px bg-[#31545d]" />
          <SchematicNode label="Location" value={`${splice.spliceDistanceM} meters`} accent="#b9eeee" />
          <div className="mx-auto h-5 w-px bg-[#31545d]" />
          <SchematicNode label="Status" value={spliceStatus} accent={spliceColor} />
        </div>
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="flex justify-between text-xs"><span className="text-[#778a92]">Tool state</span><span className="font-mono text-[#63e6e2]">{toolStatus}</span></div>
          <div className="mt-3 flex justify-between text-xs"><span className="text-[#778a92]">Trace result</span><span className="font-mono" style={{ color: spliceColor }}>{splice.traceResult}</span></div>
          <div className="mt-3 flex justify-between text-xs"><span className="text-[#778a92]">Measured loss</span><span className="font-mono text-white">{splice.measuredLossDb} dB</span></div>
          <div className="mt-3 flex justify-between text-xs"><span className="text-[#778a92]">Acceptance threshold</span><span className="font-mono text-white">{splice.acceptanceThresholdDb} dB</span></div>
        </div>
        <div className="mt-5 rounded-lg border border-[#63e6e2]/15 bg-[#0b151d] p-3 text-[11px] leading-5 text-[#8fa0a7]">Select the OptiFiber Pro, then run the trace. If loss exceeds threshold, re-splice the fiber and verify.</div>
      </aside>
    );
  }

  if (polarity) {
    const toolName = tool === "multifiber" ? "MultiFiber Pro" : "No tool selected";
    const toolStatus = tool === "multifiber" ? "SELECTED" : tool ? "WRONG TOOL" : "STANDBY";
    const polStatus = polarity.workflowStatus.replace("_", " ");
    const polColor = polarity.uplinkStatus === "UP" ? "#63e6e2" : "#f07178";

    return (
      <aside className="rounded-xl border border-[#29424a] bg-[#101923] p-5">
        <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[#63e6e2]">Operations Schematic</div>
        <h2 className="mt-2 font-display text-lg font-semibold text-white">MPO Polarity</h2>
        <p className="mt-1 text-xs leading-5 text-[#778a92]">MultiFiber Pro, MPO trunk, and polarity mapping.</p>
        <div className="mt-4 space-y-2"><ToolDrawing tool={tool} /><PolarityDrawing polarity={polarity} /></div>
        <div className="mt-5 space-y-2">
          <SchematicNode label="Tool" value={toolName} accent={tool ? "#63e6e2" : "#778a92"} />
          <div className="mx-auto h-5 w-px bg-[#31545d]" />
          <SchematicNode label="Current" value={polarity.currentPolarity.replace("_", " ")} accent={polarity.currentPolarity === polarity.requiredPolarity ? "#63e6e2" : "#f07178"} />
          <div className="mx-auto h-5 w-px bg-[#31545d]" />
          <SchematicNode label="Required" value={polarity.requiredPolarity.replace("_", " ")} accent="#b9eeee" />
        </div>
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="flex justify-between text-xs"><span className="text-[#778a92]">Tool state</span><span className="font-mono text-[#63e6e2]">{toolStatus}</span></div>
          <div className="mt-3 flex justify-between text-xs"><span className="text-[#778a92]">Uplink status</span><span className="font-mono" style={{ color: polColor }}>{polarity.uplinkStatus}</span></div>
          <div className="mt-3 flex justify-between text-xs"><span className="text-[#778a92]">Polarity status</span><span className="font-mono" style={{ color: polColor }}>{polStatus}</span></div>
        </div>
        <div className="mt-5 rounded-lg border border-[#63e6e2]/15 bg-[#0b151d] p-3 text-[11px] leading-5 text-[#8fa0a7]">Select the MultiFiber Pro, then run the polarity test. If a mismatch is found, repatch the trunk cables to restore connectivity.</div>
      </aside>
    );
  }

  const toolName = tool === "fi-3000" ? "FI-3000 FiberInspector" : tool === "cleaners" ? "Quick Clean Cleaners" : "No tool selected";
  const toolStatus = tool ? "SELECTED" : "STANDBY";
  const connectorStatus = connector?.cleaned ? "CLEAN" : connector?.inspected ? connector.score < 50 ? "CONTAMINATED" : "PASS" : "NOT INSPECTED";
  const connectorColor = connectorStatus === "PASS" || connectorStatus === "CLEAN" ? "#63e6e2" : connectorStatus === "CONTAMINATED" ? "#f07178" : "#f5b74b";

  return (
    <aside className="rounded-xl border border-[#29424a] bg-[#101923] p-5">
      <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[#63e6e2]">Operations Schematic</div>
      <h2 className="mt-2 font-display text-lg font-semibold text-white">Test chain</h2>
      <p className="mt-1 text-xs leading-5 text-[#778a92]">Selected tool, fiber path, and connector state.</p>
      <div className="mt-4 space-y-2"><ToolDrawing tool={tool} /><LinkDrawing connector={connector} /></div>
      <div className="mt-5 space-y-2">
        <SchematicNode label="Tool" value={toolName} accent={tool ? "#63e6e2" : "#778a92"} />
        <div className="mx-auto h-5 w-px bg-[#31545d]" />
        <SchematicNode label="Cable" value="OM4 multimode · 50 m" accent="#b9eeee" />
        <div className="mx-auto h-5 w-px bg-[#31545d]" />
        <SchematicNode label="Connector" value={connector ? `${connector.id} · LC/UPC` : "Select an LC connector"} accent={connectorColor} />
      </div>
      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex justify-between text-xs"><span className="text-[#778a92]">Tool state</span><span className="font-mono text-[#63e6e2]">{toolStatus}</span></div>
        <div className="mt-3 flex justify-between text-xs"><span className="text-[#778a92]">Connector state</span><span className="font-mono" style={{ color: connectorColor }}>{connectorStatus}</span></div>
        {connector && <div className="mt-3 flex justify-between text-xs"><span className="text-[#778a92]">Endface score</span><span className="font-mono text-white">{connector.score}/100</span></div>}
      </div>
      <div className="mt-5 rounded-lg border border-[#63e6e2]/15 bg-[#0b151d] p-3 text-[11px] leading-5 text-[#8fa0a7]">Click a tool on the bench, then click a connector in the 3D view. The schematic follows the active selection.</div>
    </aside>
  );
}
