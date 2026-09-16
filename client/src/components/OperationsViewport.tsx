import { CatmullRomLine, Grid, OrbitControls, Text, TransformControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { createContext, useContext, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const WorkspaceInteractionContext = createContext({ transformEnabled: false });

export type OperationsTool = "fi-3000" | "cleaners" | "certifiber" | "optical-meter" | "otdr" | "multifiber" | "splicer" | "oven";

export type ConnectorInspection = {
  id: string;
  score: number;
  inspected: boolean;
  cleaned: boolean;
};

export type FiberEndpoint = {
  id: string;
  label: string;
  panel: string;
  connectorType: "LC-UPC" | "MPO-12";
  position: [number, number, number];
  selected: boolean;
};

export type CertificationState = {
  sourceEndpoint: FiberEndpoint | null;
  destinationEndpoint: FiberEndpoint | null;
  status: "NOT_READY" | "READY_TO_TEST" | "TESTING" | "PASS" | "FAIL";
  measuredLossDb: number;
  lossBudgetDb: number;
  sessionId: string;
};

export type DegradationState = {
  sourceEndpoint: FiberEndpoint | null;
  destinationEndpoint: FiberEndpoint | null;
  status: "NOT_READY" | "BASELINE_CAPTURED" | "MEASURING" | "COMPLETED";
  baselineLossDb: number;
  currentLossDb: number;
  warningThresholdDb: number;
  healthStatus: "HEALTHY" | "MARGINAL" | "FAILED" | "UNKNOWN";
  sessionId: string;
};

export type SpliceState = {
  // Physical State
  isStripped: boolean;
  isCleaned: boolean;
  cleaveAngle: number; // degrees
  isLoaded: boolean;
  coreOffset: number; // microns
  arcPower: number; // mA
  fusionDuration: number; // ms
  isSleeveInstalled: boolean;
  isHeatShrunk: boolean;

  // Workflow & Measurement
  workflowStatus: "NOT_READY" | "PREPPING" | "FUSING" | "PROTECTING" | "TRACING" | "CERTIFYING" | "CERTIFIED";
  traceResult: "UNKNOWN" | "FAIL" | "PASS";
  certificationStatus: "NOT_READY" | "TESTING" | "PASS" | "FAIL";
  spliceDistanceM: number;
  measuredLossDb: number;
  acceptanceThresholdDb: number;
  sessionId: string;
  penalties: Record<string, number>;
};

export type PolarityState = {
  sourceEndpoint: FiberEndpoint | null;
  destinationEndpoint: FiberEndpoint | null;
  workflowStatus: "NOT_READY" | "DIAGNOSING" | "MISMATCH" | "REPATCHING" | "REPATCHED" | "COMPLETED";
  currentPolarity: "METHOD_A" | "METHOD_B";
  requiredPolarity: "METHOD_A" | "METHOD_B";
  uplinkStatus: "DOWN" | "UP";
  fiberMapping: Record<number, "PASS" | "FAIL">;
  sessionId: string;
};

type OperationsViewportProps = {
  tool: OperationsTool | null;
  connectors: ConnectorInspection[];
  onSelectTool: (tool: OperationsTool) => void;
  onInspectConnector: (id: string) => void;
  scenario: "quarterly-endface" | "certify-backbone" | "creeping-degradation" | "splice-loss-acceptance" | "mpo-polarity-failure";
  certification?: CertificationState | undefined;
  degradation?: DegradationState | undefined;
  splice?: SpliceState | undefined;
  polarity?: PolarityState | undefined;
  onSelectEndpoint?: ((endpointId: string) => void) | undefined;
  endpoints?: FiberEndpoint[] | undefined;
};

function MovableGroup({ position, label, children, highlightSize = [1, 1, 1], highlightOffset = [0, 0.5, 0] }: { position: [number, number, number]; label: string; children: React.ReactNode; highlightSize?: [number, number, number]; highlightOffset?: [number, number, number] }) {
  const { transformEnabled } = useContext(WorkspaceInteractionContext);
  const [currentPosition, setCurrentPosition] = useState<[number, number, number]>(position);
  const [selected, setSelected] = useState(false);
  const groupRef = useRef<any>(null);
  return (
    <>
      <group
        ref={groupRef}
        position={currentPosition}
        onClick={(event) => { event.stopPropagation(); setSelected(true); }}
      >
        {children}
        {selected && <mesh position={highlightOffset} raycast={() => null}>
          <boxGeometry args={highlightSize} />
          <meshBasicMaterial color="#63e6e2" transparent opacity={0.16} wireframe />
        </mesh>}
      </group>
      {selected && transformEnabled && <TransformControls
        object={groupRef}
        mode="translate"
        size={0.7}
        onMouseUp={() => {
          const next = groupRef.current?.position;
          if (next) setCurrentPosition([next.x, next.y, next.z]);
        }}
      />}
    </>
  );
}

function ToolMesh({ tool, selected, onSelect, objectLabel }: { tool: OperationsTool; selected: boolean; onSelect: () => void; objectLabel?: string }) {
  const color = tool === "fi-3000" ? "#176b79" : tool === "certifiber" ? "#1a4a6e" : tool === "optical-meter" ? "#23627a" : tool === "otdr" ? "#3e4a5b" : tool === "multifiber" ? "#4a3e5b" : "#d38d2f";
  const label = tool === "fi-3000" ? "FI-3000" : tool === "certifiber" ? "CERTIFIBER" : tool === "optical-meter" ? "OPTICAL METER" : tool === "otdr" ? "OPTIFIBER" : tool === "multifiber" ? "MULTIFIBER" : "QUICK CLEAN";
  return (
    <group onClick={() => { onSelect(); }}>
      <mesh castShadow>
        <boxGeometry args={[0.55, 0.16, 0.28]} />
        <meshStandardMaterial color={selected ? "#63e6e2" : color} metalness={0.35} roughness={0.5} emissive={selected ? "#63e6e2" : "#000000"} emissiveIntensity={selected ? 0.6 : 0} />
      </mesh>
      <mesh position={[0.16, 0.1, 0]}>
        <boxGeometry args={[0.18, 0.04, 0.18]} />
        <meshStandardMaterial color="#0a141a" emissive={tool === "fi-3000" || tool === "certifiber" || tool === "optical-meter" || tool === "otdr" || tool === "multifiber" ? "#63e6e2" : "#000000"} emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[-0.32, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 0.16, 12]} />
        <meshStandardMaterial color="#d6d8d4" metalness={0.65} roughness={0.28} />
      </mesh>
      <Text position={[0, 0.23, 0]} fontSize={0.09} color={selected ? "#63e6e2" : "#dce5e5"} anchorX="center" anchorY="middle">
        {objectLabel || label}
      </Text>
    </group>
  );
}

function SplicerMesh({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  return (
    <group onClick={() => { onSelect(); }}>
      <mesh castShadow>
        <boxGeometry args={[0.8, 0.3, 0.6]} />
        <meshStandardMaterial color="#2a3a4a" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[0.6, 0.05, 0.4]} />
        <meshStandardMaterial color="#0d151e" emissive={selected ? "#63e6e2" : "#000000"} emissiveIntensity={0.5} />
      </mesh>
      <Text position={[0, 0.22, 0]} fontSize={0.07} color={selected ? "#63e6e2" : "#dce5e5"} anchorX="center" anchorY="middle">FUSION SPLICER</Text>
    </group>
  );
}

function OvenMesh({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  return (
    <group onClick={() => { onSelect(); }}>
      <mesh castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.4, 16]} />
        <meshStandardMaterial color="#4a3a2a" metalness={0.5} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.21, 0.21, 0.05, 16]} />
        <meshStandardMaterial color="#d6d8d4" />
      </mesh>
      <Text position={[0, 0.3, 0]} fontSize={0.07} color={selected ? "#63e6e2" : "#dce5e5"} anchorX="center" anchorY="middle">SLEEVE OVEN</Text>
    </group>
  );
}

function SpliceScene({ tool, splice, endpoints, onSelectTool, onSelectEndpoint }: { tool: OperationsTool | null; splice: SpliceState; endpoints: FiberEndpoint[]; onSelectTool: (tool: OperationsTool) => void; onSelectEndpoint: (id: string) => void }) {
  const patchPanelA = endpoints.filter(e => e.panel === "CE-PATCH-A");
  const patchPanelB = endpoints.filter(e => e.panel === "CE-PATCH-B");

  return (
    <group>
      <PatchPanel label="ENCLOSURE-1 / LC-UPC" position={[-2.5, 0, -1.8]} endpoints={patchPanelA} onSelectEndpoint={onSelectEndpoint} />
      <PatchPanel label="ENCLOSURE-2 / LC-UPC" position={[2.5, 0, -1.8]} endpoints={patchPanelB} onSelectEndpoint={onSelectEndpoint} />

      {splice.workflowStatus !== "NOT_READY" && (
        <CatmullRomLine
          points={[endpoints[0].position, [0, 2.35, -1.37], endpoints[2].position]}
          color={splice.traceResult === "PASS" ? "#63e6e2" : splice.traceResult === "FAIL" ? "#f07178" : "#b9eeee"}
          lineWidth={4}
          segments={24}
        />
      )}

      <MovableGroup position={[0, 0, 1.1]} label="Splice tool bench" highlightSize={[3.6, 1.9, 1.7]} highlightOffset={[0, 0.9, 0]}>
        <mesh position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[3.4, 0.12, 1.5]} />
          <meshStandardMaterial color="#6b4426" roughness={0.75} />
        </mesh>
        <mesh position={[-1.15, 0.4, -0.5]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <mesh position={[1.15, 0.4, -0.5]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <mesh position={[-1.15, 0.4, 0.5]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <mesh position={[1.15, 0.4, 0.5]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>

        <MovableGroup position={[-0.95, 1.05, 0]} label="Fusion splicer" highlightSize={[1.1, 0.55, 0.85]}>
          <SplicerMesh selected={tool === "splicer"} onSelect={() => onSelectTool("splicer" as any)} />
        </MovableGroup>
        <MovableGroup position={[0.95, 1.05, 0]} label="Sleeve oven" highlightSize={[0.55, 0.75, 0.55]}>
          <OvenMesh selected={tool === "oven"} onSelect={() => onSelectTool("oven" as any)} />
        </MovableGroup>
        <MovableGroup position={[0, 1.05, 0.45]} label="OTDR" highlightSize={[0.9, 0.5, 0.65]}>
          <ToolMesh tool="otdr" selected={tool === "otdr"} onSelect={() => onSelectTool("otdr")} />
        </MovableGroup>
        <Text position={[0, 1.43, 0]} fontSize={0.1} color="#f5d992" anchorX="center" anchorY="middle">SPLICE TOOL BENCH</Text>
      </MovableGroup>
    </group>
  );
}

function PolarityScene({ tool, polarity, endpoints, onSelectTool, onSelectEndpoint }: { tool: OperationsTool | null; polarity: PolarityState; endpoints: FiberEndpoint[]; onSelectTool: (tool: OperationsTool) => void; onSelectEndpoint: (id: string) => void }) {
  const sourceEndpoint = endpoints.find((endpoint) => endpoint.id === "MPO-A");
  const destinationEndpoint = endpoints.find((endpoint) => endpoint.id === "MPO-B");

  return (
    <group>
      <SwitchDevice label="SW-01" position={[-2.5, 0, -1.8]} uplinkStatus={polarity.uplinkStatus} endpoint={sourceEndpoint} onSelectEndpoint={onSelectEndpoint} />
      <SwitchDevice label="SW-02" position={[2.5, 0, -1.8]} uplinkStatus={polarity.uplinkStatus} endpoint={destinationEndpoint} onSelectEndpoint={onSelectEndpoint} />

      {polarity.workflowStatus !== "NOT_READY" && (
        <CatmullRomLine
          points={[[-2.5, 0.5, -1.8], [0, 2.35, -1.37], [2.5, 0.5, -1.8]]}
          color={polarity.uplinkStatus === "UP" ? "#63e6e2" : "#f07178"}
          lineWidth={6}
          segments={24}
        />
      )}

      <MovableGroup position={[0, 0, 1.1]} label="MPO tool bench" highlightSize={[3.4, 1.9, 1.55]} highlightOffset={[0, 0.9, 0]}>
        <mesh position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[3.2, 0.12, 1.35]} />
          <meshStandardMaterial color="#6b4426" roughness={0.75} />
        </mesh>
        <mesh position={[-1.05, 0.4, -0.45]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <mesh position={[1.05, 0.4, -0.45]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <mesh position={[-1.05, 0.4, 0.45]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <mesh position={[1.05, 0.4, 0.45]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <MovableGroup position={[0, 1.05, 0]} label="MultiFiber Pro" highlightSize={[0.95, 0.5, 0.65]}><ToolMesh tool="multifiber" selected={tool === "multifiber"} onSelect={() => onSelectTool("multifiber")} /></MovableGroup>
        <Text position={[0, 1.43, 0]} fontSize={0.1} color="#f5d992" anchorX="center" anchorY="middle">TOOL BENCH</Text>
      </MovableGroup>
    </group>
  );
}

function SwitchDevice({ label, position, uplinkStatus, endpoint, onSelectEndpoint }: { label: string; position: [number, number, number]; uplinkStatus: "UP" | "DOWN"; endpoint?: FiberEndpoint; onSelectEndpoint?: (id: string) => void }) {
  return (
    <MovableGroup position={position} label={label} highlightSize={[2.8, 1.8, 1.8]} highlightOffset={[0, 0.9, 0]}>
      <group position={[0, 0.75, 0]}>
      <mesh castShadow>
        <boxGeometry args={[2.5, 1.5, 1.5]} />
        <meshStandardMaterial color="#1a2a3a" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.76, 0.76]}>
        <boxGeometry args={[2.2, 0.1, 0.1]} />
        <meshStandardMaterial color="#0d151e" />
      </mesh>
      <Text position={[0, 0.8, 0.8]} fontSize={0.1} color="#63e6e2" anchorX="center" anchorY="middle">{label}</Text>
      <group position={[0, 0.5, 0.76]} onClick={(event) => { if (!endpoint || !onSelectEndpoint) return; event.stopPropagation(); onSelectEndpoint(endpoint.id); }}>
        <mesh>
          <boxGeometry args={[0.2, 0.2, 0.1]} />
          <meshStandardMaterial color={endpoint?.selected ? "#63e6e2" : uplinkStatus === "UP" ? "#63e6e2" : "#f07178"} emissive={endpoint?.selected ? "#63e6e2" : uplinkStatus === "UP" ? "#63e6e2" : "#f07178"} emissiveIntensity={2} />
        </mesh>
        <Text position={[0.3, 0, 0]} fontSize={0.06} color={endpoint?.selected ? "#63e6e2" : "#778a92"} anchorX="left" anchorY="middle">{endpoint?.label || "QSFP+ UPLINK"}</Text>
      </group>
      </group>
    </MovableGroup>
  );
}

function PatchPanel({ label, position, endpoints, onSelectEndpoint }: { label: string; position: [number, number, number]; endpoints: FiberEndpoint[]; onSelectEndpoint: (id: string) => void }) {
  return (
    <MovableGroup position={position} label={label} highlightSize={[3.2, 3.4, 0.9]} highlightOffset={[0, 1.55, 0]}>
      <mesh position={[0, 1.45, 0]} castShadow>
        <boxGeometry args={[2.9, 3.1, 0.7]} />
        <meshStandardMaterial color="#1b252c" metalness={0.6} roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.55, 0.38]}>
        <boxGeometry args={[2.45, 0.5, 0.045]} />
        <meshStandardMaterial color="#0b151d" metalness={0.25} roughness={0.75} />
      </mesh>
      <Text position={[0, 1.93, 0.42]} fontSize={0.12} color="#63e6e2" anchorX="center" anchorY="middle">{label}</Text>
      {endpoints.map((endpoint) => {
        const x = endpoint.position[0] - position[0];
        const y = endpoint.position[1] - position[1];
        const z = endpoint.position[2] - position[2];
        const color = endpoint.selected ? "#63e6e2" : "#65767d";
        return (
          <group key={endpoint.id} position={[x, y, z]} onClick={(event) => { event.stopPropagation(); onSelectEndpoint(endpoint.id); }}>
            <mesh>
              <cylinderGeometry args={[0.045, 0.045, 0.06, 12]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={endpoint.selected ? 1.4 : 0.25} metalness={0.5} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0, 0.045]}>
              <boxGeometry args={[0.07, 0.055, 0.025]} />
              <meshStandardMaterial color="#182830" metalness={0.2} roughness={0.7} />
            </mesh>
            {endpoint.selected && <Text position={[0, 0.09, 0.03]} fontSize={0.045} color={color} anchorX="center" anchorY="middle">SELECTED</Text>}
          </group>
        );
      })}
    </MovableGroup>
  );
}

function CertiFiberScene({ tool, certification, endpoints, onSelectTool, onSelectEndpoint }: { tool: OperationsTool | null; certification: CertificationState; endpoints: FiberEndpoint[]; onSelectTool: (tool: OperationsTool) => void; onSelectEndpoint: (id: string) => void }) {
  const patchPanelA = endpoints.filter(e => e.panel === "CE-PATCH-A");
  const patchPanelB = endpoints.filter(e => e.panel === "CE-PATCH-B");

  return (
    <group>
      <PatchPanel label="CE-PATCH-A / LC-UPC" position={[-2.5, 0, -1.8]} endpoints={patchPanelA} onSelectEndpoint={onSelectEndpoint} />
      <PatchPanel label="CE-PATCH-B / LC-UPC" position={[2.5, 0, -1.8]} endpoints={patchPanelB} onSelectEndpoint={onSelectEndpoint} />

      {certification.sourceEndpoint && certification.destinationEndpoint && (
        <CatmullRomLine points={[certification.sourceEndpoint.position, [0, 2.35, -1.37], certification.destinationEndpoint.position]} color={certification.status === "PASS" ? "#63e6e2" : certification.status === "FAIL" ? "#f07178" : "#b9eeee"} lineWidth={4} segments={24} />
      )}

      <MovableGroup position={[0, 0, 1.1]} label="Certification tool bench" highlightSize={[3.4, 1.9, 1.55]} highlightOffset={[0, 0.9, 0]}>
        <mesh position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[3.2, 0.12, 1.35]} />
          <meshStandardMaterial color="#6b4426" roughness={0.75} />
        </mesh>
        <mesh position={[-1.05, 0.4, -0.45]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <mesh position={[1.05, 0.4, -0.45]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <mesh position={[-1.05, 0.4, 0.45]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <mesh position={[1.05, 0.4, 0.45]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <MovableGroup position={[0, 1.05, 0]} label="CertiFiber Pro" highlightSize={[0.95, 0.5, 0.65]}><ToolMesh tool="certifiber" selected={tool === "certifiber"} onSelect={() => onSelectTool("certifiber")} /></MovableGroup>
        <Text position={[0, 1.43, 0]} fontSize={0.1} color="#f5d992" anchorX="center" anchorY="middle">TOOL BENCH</Text>
      </MovableGroup>
    </group>
  );
}

function DegradationScene({ tool, degradation, endpoints, onSelectTool, onSelectEndpoint }: { tool: OperationsTool | null; degradation: DegradationState; endpoints: FiberEndpoint[]; onSelectTool: (tool: OperationsTool) => void; onSelectEndpoint: (id: string) => void }) {
  const patchPanelA = endpoints.filter(e => e.panel === "CE-PATCH-A");
  const patchPanelB = endpoints.filter(e => e.panel === "CE-PATCH-B");

  return (
    <group>
      <PatchPanel label="CE-PATCH-A / LC-UPC" position={[-2.5, 0, -1.8]} endpoints={patchPanelA} onSelectEndpoint={onSelectEndpoint} />
      <PatchPanel label="CE-PATCH-B / LC-UPC" position={[2.5, 0, -1.8]} endpoints={patchPanelB} onSelectEndpoint={onSelectEndpoint} />

      {degradation.sourceEndpoint && degradation.destinationEndpoint && (
        <CatmullRomLine
          points={[degradation.sourceEndpoint.position, [0, 2.35, -1.37], degradation.destinationEndpoint.position]}
          color={degradation.healthStatus === "HEALTHY" ? "#63e6e2" : degradation.healthStatus === "MARGINAL" ? "#f5b74b" : degradation.healthStatus === "FAILED" ? "#f07178" : "#b9eeee"}
          lineWidth={4}
          segments={24}
        />
      )}

      <MovableGroup position={[0, 0, 1.1]} label="Monitoring tool bench" highlightSize={[3.4, 1.9, 1.55]} highlightOffset={[0, 0.9, 0]}>
        <mesh position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[3.2, 0.12, 1.35]} />
          <meshStandardMaterial color="#6b4426" roughness={0.75} />
        </mesh>
        <mesh position={[-1.05, 0.4, -0.45]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <mesh position={[1.05, 0.4, -0.45]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <mesh position={[-1.05, 0.4, 0.45]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <mesh position={[1.05, 0.4, 0.45]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <MovableGroup position={[0, 1.05, 0]} label="Optical power meter" highlightSize={[0.95, 0.5, 0.65]}><ToolMesh tool="optical-meter" selected={tool === "optical-meter"} onSelect={() => onSelectTool("optical-meter")} /></MovableGroup>
        <Text position={[0, 1.43, 0]} fontSize={0.1} color="#f5d992" anchorX="center" anchorY="middle">TOOL BENCH</Text>
      </MovableGroup>
    </group>
  );
}

function Rack({ connectors, tool, onSelectTool, onInspectConnector }: OperationsViewportProps) {
  return (
    <group position={[0, 0, -1.8]}>
      <mesh position={[0, 1.45, 0]} castShadow>
        <boxGeometry args={[2.9, 3.1, 0.7]} />
        <meshStandardMaterial color="#1b252c" metalness={0.6} roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.55, 0.38]}>
        <boxGeometry args={[2.45, 0.5, 0.045]} />
        <meshStandardMaterial color="#0b151d" metalness={0.25} roughness={0.75} />
      </mesh>
      <Text position={[0, 1.93, 0.42]} fontSize={0.12} color="#63e6e2" anchorX="center" anchorY="middle">CE-PATCH-A / LC-24</Text>
      {connectors.map((connector, index) => {
        const column = index % 12;
        const row = Math.floor(index / 12);
        const x = -1.03 + column * 0.187;
        const y = 1.65 + (row === 0 ? 0 : -0.22);
        const color = connector.cleaned ? "#63e6e2" : connector.inspected ? connector.score < 50 ? "#f07178" : "#63e6e2" : "#65767d";
        return (
          <group key={connector.id} position={[x, y, 0.43]} onClick={(event) => { event.stopPropagation(); onInspectConnector(connector.id); }}>
            <mesh>
              <cylinderGeometry args={[0.045, 0.045, 0.06, 12]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={connector.inspected ? 1.4 : 0.25} metalness={0.5} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0, 0.045]}>
              <boxGeometry args={[0.07, 0.055, 0.025]} />
              <meshStandardMaterial color="#182830" metalness={0.2} roughness={0.7} />
            </mesh>
            {(connector.inspected || connector.cleaned) && <Text position={[0, 0.09, 0.03]} fontSize={0.045} color={color} anchorX="center" anchorY="middle">{connector.cleaned ? "CLEAN" : connector.score < 50 ? "FAIL" : "PASS"}</Text>}
          </group>
        );
      })}
      <MovableGroup position={[-2.15, 0, 1.1]} label="Inspection tool bench" highlightSize={[3.4, 1.9, 1.55]} highlightOffset={[0, 0.9, 0]}>
        <mesh position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[3.2, 0.12, 1.35]} />
          <meshStandardMaterial color="#6b4426" roughness={0.75} />
        </mesh>
        <mesh position={[-1.05, 0.4, -0.45]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <mesh position={[1.05, 0.4, -0.45]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <mesh position={[-1.05, 0.4, 0.45]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <mesh position={[1.05, 0.4, 0.45]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <MovableGroup position={[-0.7, 1.05, 0]} label="FI-3000" highlightSize={[0.95, 0.5, 0.65]}><ToolMesh tool="fi-3000" selected={tool === "fi-3000"} onSelect={() => onSelectTool("fi-3000")} /></MovableGroup>
        <MovableGroup position={[0.7, 1.05, 0]} label="Quick Clean" highlightSize={[0.95, 0.5, 0.65]}><ToolMesh tool="cleaners" selected={tool === "cleaners"} onSelect={() => onSelectTool("cleaners")} /></MovableGroup>
        <Text position={[0, 1.43, 0]} fontSize={0.1} color="#f5d992" anchorX="center" anchorY="middle">TOOL BENCH</Text>
      </MovableGroup>
    </group>
  );
}

export default function OperationsViewport(props: OperationsViewportProps) {
  const [transformEnabled, setTransformEnabled] = useState(false);
  const workspace = { transformEnabled };

  const controls = (
    <div className="pointer-events-auto absolute right-4 top-3 z-20">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={`flex items-center gap-1 border-b px-1.5 py-1 font-mono text-[10px] uppercase tracking-[.16em] transition ${transformEnabled ? "border-[#63e6e2] text-[#63e6e2]" : "border-transparent text-[#6e8c94] hover:border-[#63e6e2]/50 hover:text-[#b9eeee]"}`} aria-pressed={transformEnabled}>
            Controls <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 border-[#29424a] bg-[#101923] p-2 text-[#edf4f3]">
          <div className="px-2 pb-2 pt-1"><div className="font-mono text-[10px] uppercase tracking-[.16em] text-[#63e6e2]">Viewport controls</div><div className="mt-1 text-[11px] text-[#778a92]">Select an object, then choose a transform action.</div></div>
          <DropdownMenuItem onSelect={() => setTransformEnabled((value) => !value)} className="cursor-pointer justify-between gap-3 px-2.5 py-2.5 text-xs text-[#9aabb1] focus:bg-[#173038] focus:text-white"><span>Transform</span><span className={`font-mono text-[9px] ${transformEnabled ? "text-[#63e6e2]" : "text-[#778a92]"}`}>{transformEnabled ? "ON" : "OFF"}</span></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  if (props.scenario === "certify-backbone" && props.certification && props.endpoints && props.onSelectEndpoint) {
    return (
      <div className="relative h-[560px] overflow-hidden rounded-xl border border-[#29424a] bg-[#071017] shadow-2xl">
        {controls}
        <WorkspaceInteractionContext.Provider value={workspace}><Canvas shadows camera={{ position: [0, 3.5, 8], fov: 45 }}>
          <color attach="background" args={["#071017"]} />
          <ambientLight intensity={0.7} />
          <directionalLight castShadow position={[4, 7, 4]} intensity={2.2} />
          <Grid args={[16, 12]} cellSize={0.25} sectionSize={1.25} sectionColor="#28525a" cellColor="#153139" fadeDistance={18} infiniteGrid />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow><planeGeometry args={[16, 12]} /><meshStandardMaterial color="#0b151d" roughness={0.92} /></mesh>
          <mesh position={[0, 2.8, -3.5]}><boxGeometry args={[9, 5.7, 0.1]} /><meshStandardMaterial color="#101d24" roughness={0.95} /></mesh>
          <CertiFiberScene tool={props.tool} certification={props.certification} endpoints={props.endpoints} onSelectTool={props.onSelectTool} onSelectEndpoint={props.onSelectEndpoint} />
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} target={[0, 1.1, 0]} />
        </Canvas></WorkspaceInteractionContext.Provider>
        <div className="pointer-events-none relative -mt-[560px] flex justify-between p-4 pr-32 font-mono text-[10px] uppercase tracking-[.16em] text-[#6e8c94]">
          <span>FIBER COMMISSIONING / PROCEDURAL FIELD VIEW · OM4 BACKBONE / CERTIFICATION MODE</span>
        </div>
      </div>
    );
  }

  if (props.scenario === "creeping-degradation" && props.degradation && props.endpoints && props.onSelectEndpoint) {
    return (
      <div className="relative h-[560px] overflow-hidden rounded-xl border border-[#29424a] bg-[#071017] shadow-2xl">
        {controls}
        <WorkspaceInteractionContext.Provider value={workspace}><Canvas shadows camera={{ position: [0, 3.5, 8], fov: 45 }}>
          <color attach="background" args={["#071017"]} />
          <ambientLight intensity={0.7} />
          <directionalLight castShadow position={[4, 7, 4]} intensity={2.2} />
          <Grid args={[16, 12]} cellSize={0.25} sectionSize={1.25} sectionColor="#28525a" cellColor="#153139" fadeDistance={18} infiniteGrid />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow><planeGeometry args={[16, 12]} /><meshStandardMaterial color="#0b151d" roughness={0.92} /></mesh>
          <mesh position={[0, 2.8, -3.5]}><boxGeometry args={[9, 5.7, 0.1]} /><meshStandardMaterial color="#101d24" roughness={0.95} /></mesh>
          <DegradationScene tool={props.tool} degradation={props.degradation} endpoints={props.endpoints} onSelectTool={props.onSelectTool} onSelectEndpoint={props.onSelectEndpoint} />
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} target={[0, 1.1, 0]} />
        </Canvas></WorkspaceInteractionContext.Provider>
        <div className="pointer-events-none relative -mt-[560px] flex justify-between p-4 pr-32 font-mono text-[10px] uppercase tracking-[.16em] text-[#6e8c94]">
          <span>FIBER MONITORING / PROCEDURAL FIELD VIEW · OM4 BACKBONE / DEGRADATION MODE</span>
        </div>
      </div>
    );
  }

  if (props.scenario === "splice-loss-acceptance" && props.splice && props.endpoints) {
    return (
      <div className="relative h-[560px] overflow-hidden rounded-xl border border-[#29424a] bg-[#071017] shadow-2xl">
        {controls}
        <WorkspaceInteractionContext.Provider value={workspace}><Canvas shadows camera={{ position: [0, 3.5, 8], fov: 45 }}>
          <color attach="background" args={["#071017"]} />
          <ambientLight intensity={0.7} />
          <directionalLight castShadow position={[4, 7, 4]} intensity={2.2} />
          <Grid args={[16, 12]} cellSize={0.25} sectionSize={1.25} sectionColor="#28525a" cellColor="#153139" fadeDistance={18} infiniteGrid />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow><planeGeometry args={[16, 12]} /><meshStandardMaterial color="#0b151d" roughness={0.92} /></mesh>
          <mesh position={[0, 2.8, -3.5]}><boxGeometry args={[9, 5.7, 0.1]} /><meshStandardMaterial color="#101d24" roughness={0.95} /></mesh>
          <SpliceScene tool={props.tool} splice={props.splice} endpoints={props.endpoints} onSelectTool={props.onSelectTool} onSelectEndpoint={() => {}} />
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} target={[0, 1.1, 0]} />
        </Canvas></WorkspaceInteractionContext.Provider>
        <div className="pointer-events-none relative -mt-[560px] flex justify-between p-4 pr-32 font-mono text-[10px] uppercase tracking-[.16em] text-[#6e8c94]">
          <span>FIBER DIAGNOSIS / PROCEDURAL FIELD VIEW · SPLICE LOSS ANALYSIS / OTDR MODE</span>
        </div>
      </div>
    );
  }

  if (props.scenario === "mpo-polarity-failure" && props.polarity && props.endpoints && props.onSelectEndpoint) {
    return (
      <div className="relative h-[560px] overflow-hidden rounded-xl border border-[#29424a] bg-[#071017] shadow-2xl">
        {controls}
        <WorkspaceInteractionContext.Provider value={workspace}><Canvas shadows camera={{ position: [0, 3.5, 8], fov: 45 }}>
          <color attach="background" args={["#071017"]} />
          <ambientLight intensity={0.7} />
          <directionalLight castShadow position={[4, 7, 4]} intensity={2.2} />
          <Grid args={[16, 12]} cellSize={0.25} sectionSize={1.25} sectionColor="#28525a" cellColor="#153139" fadeDistance={18} infiniteGrid />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow><planeGeometry args={[16, 12]} /><meshStandardMaterial color="#0b151d" roughness={0.92} /></mesh>
          <mesh position={[0, 2.8, -3.5]}><boxGeometry args={[9, 5.7, 0.1]} /><meshStandardMaterial color="#101d24" roughness={0.95} /></mesh>
          <PolarityScene tool={props.tool} polarity={props.polarity} endpoints={props.endpoints} onSelectTool={props.onSelectTool} onSelectEndpoint={props.onSelectEndpoint} />
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} target={[0, 1.1, 0]} />
        </Canvas></WorkspaceInteractionContext.Provider>
        <div className="pointer-events-none relative -mt-[560px] flex justify-between p-4 pr-32 font-mono text-[10px] uppercase tracking-[.16em] text-[#6e8c94]">
          <span>MPO DIAGNOSIS / PROCEDURAL FIELD VIEW · POLARITY MAPPING / MULTIFIBER MODE</span>
        </div>
      </div>
    );
  }



  return (
    <div className="relative h-[560px] overflow-hidden rounded-xl border border-[#29424a] bg-[#071017] shadow-2xl">
      {controls}
      <WorkspaceInteractionContext.Provider value={workspace}><Canvas shadows camera={{ position: [4.7, 3.5, 6.5], fov: 45 }}>
        <color attach="background" args={["#071017"]} />
        <ambientLight intensity={0.7} />
        <directionalLight castShadow position={[4, 7, 4]} intensity={2.2} />
        <Grid args={[16, 12]} cellSize={0.25} sectionSize={1.25} sectionColor="#28525a" cellColor="#153139" fadeDistance={18} infiniteGrid />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow><planeGeometry args={[16, 12]} /><meshStandardMaterial color="#0b151d" roughness={0.92} /></mesh>
        <mesh position={[0, 2.8, -3.5]}><boxGeometry args={[9, 5.7, 0.1]} /><meshStandardMaterial color="#101d24" roughness={0.95} /></mesh>
        <Rack {...props} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} target={[0, 1.1, -0.7]} />
      </Canvas></WorkspaceInteractionContext.Provider>
      <div className="pointer-events-none relative -mt-[560px] flex justify-between p-4 pr-32 font-mono text-[10px] uppercase tracking-[.16em] text-[#6e8c94]">
        <span>SERVER ROOM / PROCEDURAL FIELD VIEW · 24 LC PORTS / INTERACTIVE</span>
      </div>
    </div>
  );
}
