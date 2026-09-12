import { Grid, OrbitControls, Text } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

export type OperationsTool = "fi-3000" | "cleaners" | "certifiber";

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
  connectorType: "LC-UPC";
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

type OperationsViewportProps = {
  tool: OperationsTool | null;
  connectors: ConnectorInspection[];
  onSelectTool: (tool: OperationsTool) => void;
  onInspectConnector: (id: string) => void;
  scenario: "quarterly-endface" | "certify-backbone";
  certification?: CertificationState | undefined;
  onSelectEndpoint?: ((endpointId: string) => void) | undefined;
  endpoints?: FiberEndpoint[] | undefined;
};

function ToolMesh({ tool, selected, onSelect }: { tool: OperationsTool; selected: boolean; onSelect: () => void }) {
  const color = tool === "fi-3000" ? "#176b79" : tool === "certifiber" ? "#1a4a6e" : "#d38d2f";
  return (
    <group onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <mesh castShadow>
        <boxGeometry args={[0.55, 0.16, 0.28]} />
        <meshStandardMaterial color={selected ? "#63e6e2" : color} metalness={0.35} roughness={0.5} emissive={selected ? "#63e6e2" : "#000000"} emissiveIntensity={selected ? 0.6 : 0} />
      </mesh>
      <mesh position={[0.16, 0.1, 0]}>
        <boxGeometry args={[0.18, 0.04, 0.18]} />
        <meshStandardMaterial color="#0a141a" emissive={tool === "fi-3000" || tool === "certifiber" ? "#63e6e2" : "#000000"} emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[-0.32, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 0.16, 12]} />
        <meshStandardMaterial color="#d6d8d4" metalness={0.65} roughness={0.28} />
      </mesh>
      <Text position={[0, 0.23, 0]} fontSize={0.09} color={selected ? "#63e6e2" : "#dce5e5"} anchorX="center" anchorY="middle">
        {tool === "fi-3000" ? "FI-3000" : tool === "certifiber" ? "CERTIFIBER" : "QUICK CLEAN"}
      </Text>
    </group>
  );
}

function PatchPanel({ label, position, endpoints, onSelectEndpoint }: { label: string; position: [number, number, number]; endpoints: FiberEndpoint[]; onSelectEndpoint: (id: string) => void }) {
  return (
    <group position={position}>
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
        const x = endpoint.position[0];
        const y = endpoint.position[1];
        const color = endpoint.selected ? "#63e6e2" : "#65767d";
        return (
          <group key={endpoint.id} position={[x, y, 0.43]} onClick={(event) => { event.stopPropagation(); onSelectEndpoint(endpoint.id); }}>
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
    </group>
  );
}

function FiberCable({ startPoint, endPoint, color = "#63e6e2" }: { startPoint: [number, number, number]; endPoint: [number, number, number]; color?: string }) {
  // Simple visual representation using a cylinder
  const dx = endPoint[0] - startPoint[0];
  const dz = endPoint[2] - startPoint[2];
  const length = Math.sqrt(dx * dx + dz * dz);
  const midX = (startPoint[0] + endPoint[0]) / 2;
  const midY = (startPoint[1] + endPoint[1]) / 2 - 0.2;
  const midZ = (startPoint[2] + endPoint[2]) / 2;

  return (
    <mesh position={[midX, midY, midZ]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.015, 0.015, length, 8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} metalness={0.4} roughness={0.5} />
    </mesh>
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
        <FiberCable
          startPoint={certification.sourceEndpoint.position}
          endPoint={certification.destinationEndpoint.position}
          color={certification.status === "PASS" ? "#63e6e2" : certification.status === "FAIL" ? "#f07178" : "#b9eeee"}
        />
      )}

      <group position={[0, 0.55, 1.1]}>
        <mesh position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[1.5, 0.12, 0.75]} />
          <meshStandardMaterial color="#6b4426" roughness={0.75} />
        </mesh>
        <mesh position={[-0.5, 0.4, -0.25]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <mesh position={[0.5, 0.4, -0.25]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <group position={[0, 1.05, 0]}><ToolMesh tool="certifiber" selected={tool === "certifiber"} onSelect={() => onSelectTool("certifiber")} /></group>
        <Text position={[0, 1.43, 0]} fontSize={0.1} color="#f5d992" anchorX="center" anchorY="middle">TOOL BENCH</Text>
      </group>
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
      <group position={[-2.15, 0.55, 1.1]}>
        <mesh position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[1.5, 0.12, 0.75]} />
          <meshStandardMaterial color="#6b4426" roughness={0.75} />
        </mesh>
        <mesh position={[-0.62, 0.4, -0.25]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <mesh position={[0.62, 0.4, -0.25]}><cylinderGeometry args={[0.04, 0.04, 0.8, 10]} /><meshStandardMaterial color="#26343a" /></mesh>
        <group position={[-0.35, 1.05, 0]}><ToolMesh tool="fi-3000" selected={tool === "fi-3000"} onSelect={() => onSelectTool("fi-3000")} /></group>
        <group position={[0.35, 1.05, 0]}><ToolMesh tool="cleaners" selected={tool === "cleaners"} onSelect={() => onSelectTool("cleaners")} /></group>
        <Text position={[0, 1.43, 0]} fontSize={0.1} color="#f5d992" anchorX="center" anchorY="middle">TOOL BENCH</Text>
      </group>
    </group>
  );
}

export default function OperationsViewport(props: OperationsViewportProps) {
  if (props.scenario === "certify-backbone" && props.certification && props.endpoints && props.onSelectEndpoint) {
    return (
      <div className="h-[560px] overflow-hidden rounded-xl border border-[#29424a] bg-[#071017] shadow-2xl">
        <Canvas shadows camera={{ position: [0, 3.5, 8], fov: 45 }}>
          <color attach="background" args={["#071017"]} />
          <ambientLight intensity={0.7} />
          <directionalLight castShadow position={[4, 7, 4]} intensity={2.2} />
          <Grid args={[16, 12]} cellSize={0.25} sectionSize={1.25} sectionColor="#28525a" cellColor="#153139" fadeDistance={18} infiniteGrid />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow><planeGeometry args={[16, 12]} /><meshStandardMaterial color="#0b151d" roughness={0.92} /></mesh>
          <mesh position={[0, 2.8, -3.5]}><boxGeometry args={[9, 5.7, 0.1]} /><meshStandardMaterial color="#101d24" roughness={0.95} /></mesh>
          <CertiFiberScene tool={props.tool} certification={props.certification} endpoints={props.endpoints} onSelectTool={props.onSelectTool} onSelectEndpoint={props.onSelectEndpoint} />
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} target={[0, 1.1, 0]} />
        </Canvas>
        <div className="pointer-events-none relative -mt-[560px] flex justify-between p-4 font-mono text-[10px] uppercase tracking-[.16em] text-[#6e8c94]">
          <span>FIBER COMMISSIONING / PROCEDURAL FIELD VIEW</span>
          <span>OM4 BACKBONE / CERTIFICATION MODE</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[560px] overflow-hidden rounded-xl border border-[#29424a] bg-[#071017] shadow-2xl">
      <Canvas shadows camera={{ position: [4.7, 3.5, 6.5], fov: 45 }}>
        <color attach="background" args={["#071017"]} />
        <ambientLight intensity={0.7} />
        <directionalLight castShadow position={[4, 7, 4]} intensity={2.2} />
        <Grid args={[16, 12]} cellSize={0.25} sectionSize={1.25} sectionColor="#28525a" cellColor="#153139" fadeDistance={18} infiniteGrid />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow><planeGeometry args={[16, 12]} /><meshStandardMaterial color="#0b151d" roughness={0.92} /></mesh>
        <mesh position={[0, 2.8, -3.5]}><boxGeometry args={[9, 5.7, 0.1]} /><meshStandardMaterial color="#101d24" roughness={0.95} /></mesh>
        <Rack {...props} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} target={[0, 1.1, -0.7]} />
      </Canvas>
      <div className="pointer-events-none relative -mt-[560px] flex justify-between p-4 font-mono text-[10px] uppercase tracking-[.16em] text-[#6e8c94]">
        <span>SERVER ROOM / PROCEDURAL FIELD VIEW</span>
        <span>24 LC PORTS / INTERACTIVE</span>
      </div>
    </div>
  );
}
