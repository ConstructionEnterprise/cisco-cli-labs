import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Bounds, CatmullRomLine, Grid, OrbitControls, PerspectiveCamera, Text } from "@react-three/drei";
import { NETWORK_CABLES, ecosystemDevice, ecosystemPort } from "@/lib/network-ecosystem";
import type { PortRef, SelectionRef } from "@/lib/network-topology";
import type { SandboxLink, SandboxNode, Topology } from "@/components/NetworkSandbox";
import type { Session } from "@/lib/ios-engine";
import type { TrafficPacket } from "@/lib/network-topology";

type ThreeSandboxViewportProps = {
  topology: Topology;
  selection: SelectionRef[];
  activeFilters: string[];
  onSelectNode: (node: SandboxNode, additive: boolean) => void;
  onSelectPort: (ref: PortRef) => void;
  onSelectLink: (link: SandboxLink, additive: boolean) => void;
  connectionStart: PortRef | null;
  selectedPort: PortRef | null;
  selectedCableId: string;
  sessions: Record<string, Session>;
  showAxes: boolean;
};

function DeviceMesh({ node, selected, selectedPort, connectionStart, selectedCableId, onSelect, onSelectPort }: { node: SandboxNode; selected: boolean; selectedPort: PortRef | null; connectionStart: PortRef | null; selectedCableId: string; onSelect: (additive: boolean) => void; onSelectPort: (ref: PortRef) => void }) {
  const device = ecosystemDevice(node.kind);
  const dimensions = device.dimensions;
  const scale = 0.001;
  const size: [number, number, number] = [dimensions.length * scale, dimensions.height * scale, dimensions.width * scale];
  const portY = Math.max(size[1] * 0.18, 0.035);
  const portZ = size[2] / 2 + 0.018;
  const portPosition = (index: number): [number, number, number] => {
    const spread = Math.max(size[0] - 0.12, 0.12);
    const x = node.ports.length === 1 ? 0 : -spread / 2 + (spread * index) / (node.ports.length - 1);
    return [x, portY, portZ];
  };
  const bodyColor = selected ? "#a87524" : node.kind === "firewall" ? "#493047" : node.kind === "access-point" ? "#23616c" : "#1c5961";
  const rackMount = ["switch", "router", "server", "firewall"].includes(node.kind);
  const ventCount = node.kind === "server" ? 8 : 5;
  const elevation = node.z ?? (node.mountType === "ceiling" ? 9 : node.mountType === "rack" ? 1 : node.mountType === "desk" ? 0.5 : 0);
  return (
    <group position={[node.x / 100, size[1] / 2 + elevation, -node.y / 100]} onClick={(event) => { event.stopPropagation(); onSelect(event.ctrlKey || event.metaKey); }}>
      <mesh castShadow receiveShadow>
        {node.kind === "access-point" ? <cylinderGeometry args={[size[0] / 2, size[0] / 2, size[1], 32]} /> : <boxGeometry args={size} />}
        <meshStandardMaterial color={bodyColor} metalness={0.35} roughness={0.55} />
      </mesh>
      <mesh position={[0, size[1] / 2 + 0.025, 0]}>
        <boxGeometry args={[size[0] * 0.82, 0.008, size[2] * 0.72]} />
        <meshStandardMaterial color="#0b151d" metalness={0.1} roughness={0.8} />
      </mesh>
      <mesh position={[0, size[1] * 0.28, size[2] / 2 + 0.01]}>
        <boxGeometry args={[size[0] * 0.82, Math.max(size[1] * 0.22, 0.025), 0.012]} />
        <meshStandardMaterial color="#091219" metalness={0.2} roughness={0.7} />
      </mesh>
      {rackMount && <>
        <mesh position={[-size[0] / 2 - 0.035, 0, 0]}>
          <boxGeometry args={[0.07, size[1] * 0.86, size[2] * 0.74]} />
          <meshStandardMaterial color="#34434a" metalness={0.8} roughness={0.32} />
        </mesh>
        <mesh position={[size[0] / 2 + 0.035, 0, 0]}>
          <boxGeometry args={[0.07, size[1] * 0.86, size[2] * 0.74]} />
          <meshStandardMaterial color="#34434a" metalness={0.8} roughness={0.32} />
        </mesh>
      </>}
      {Array.from({ length: ventCount }, (_, index) => (
        <mesh key={`vent-${index}`} position={[-size[0] * 0.26 + index * size[0] * 0.07, size[1] * 0.52, -size[2] * 0.08]}>
          <boxGeometry args={[0.018, 0.008, size[2] * 0.24]} />
          <meshStandardMaterial color="#050a0e" metalness={0.1} roughness={0.95} />
        </mesh>
      ))}
      {node.kind === "access-point" && <>
        <mesh position={[0, size[1] * 0.9, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.16, 12]} />
          <meshStandardMaterial color="#63e6e2" emissive="#63e6e2" emissiveIntensity={0.8} />
        </mesh>
        <mesh position={[0, size[1] * 1.02, 0]}>
          <sphereGeometry args={[0.026, 16, 16]} />
          <meshStandardMaterial color="#63e6e2" emissive="#63e6e2" emissiveIntensity={1.5} />
        </mesh>
      </>}
      {node.ports.map((port, index) => {
        const position = portPosition(index);
        const portMeta = ecosystemPort(device, port);
        const portSelected = selectedPort?.nodeId === node.id && selectedPort.port === port;
        const connectionTarget = connectionStart && connectionStart.nodeId !== node.id && device.cables.includes(selectedCableId);
        return (
          <group key={port} position={position} onClick={(event) => { event.stopPropagation(); onSelectPort({ nodeId: node.id, port }); }}>
            <mesh>
              <boxGeometry args={[0.045, 0.025, 0.018]} />
              <meshStandardMaterial color={portSelected ? "#f5b74b" : connectionTarget ? "#63e6e2" : "#d6a948"} emissive={portSelected || connectionTarget ? "#63e6e2" : "#6b4a16"} emissiveIntensity={portSelected || connectionTarget ? 1.2 : 0.35} metalness={0.7} roughness={0.25} />
            </mesh>
            {(selected || portSelected || connectionTarget) && <Text position={[0, 0.055, 0.01]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.04} color="#f5d992" anchorX="center" anchorY="middle">{port} · {portMeta.type}</Text>}
          </group>
        );
      })}
      <mesh position={[-size[0] * 0.32, size[1] * 0.25, size[2] / 2 + 0.025]}>
        <sphereGeometry args={[0.018, 12, 12]} />
        <meshStandardMaterial color="#63e6e2" emissive="#63e6e2" emissiveIntensity={2} />
      </mesh>
      <Text position={[0, size[1] + 0.16, 0]} fontSize={0.075} color="#dff9f5" anchorX="center" anchorY="middle">
        {node.name}
      </Text>
      <Text position={[0, size[1] + 0.09, 0]} fontSize={0.035} color="#63e6e2" anchorX="center" anchorY="middle">
        {dimensions.length} x {dimensions.width} x {dimensions.height} mm
      </Text>
    </group>
  );
}

function absolutePortPosition(node: SandboxNode, port: string): [number, number, number] {
  const device = ecosystemDevice(node.kind);
  const scale = 0.001;
  const width = device.dimensions.length * scale;
  const height = device.dimensions.height * scale;
  const depth = device.dimensions.width * scale;
  const elevation = node.z ?? (node.mountType === "ceiling" ? 9 : node.mountType === "rack" ? 1 : node.mountType === "desk" ? 0.5 : 0);
  const index = Math.max(0, node.ports.indexOf(port));
  const spread = Math.max(width - 0.12, 0.12);
  const x = node.ports.length === 1 ? 0 : -spread / 2 + (spread * index) / (node.ports.length - 1);
  return [node.x / 100 + x, height / 2 + elevation + Math.max(height * 0.18, 0.035), -node.y / 100 - depth / 2 - 0.018];
}

function TrafficParticle({ packet, links, nodes, onComplete }: { packet: TrafficPacket; links: Map<string, SandboxLink>; nodes: Map<string, SandboxNode>; onComplete: (id: string) => void }) {
  const mesh = useRef<any>(null);
  const progress = useRef(-(packet.startDelay || 0));
  useFrame((_, delta) => {
    progress.current += delta * 0.7;
    if (progress.current < 0) { if (mesh.current) mesh.current.visible = false; return; }
    if (mesh.current) mesh.current.visible = true;
    if (progress.current >= packet.path.length) { onComplete(packet.id); return; }
    const segment = Math.floor(progress.current);
    const link = links.get(packet.path[segment]);
    if (!link || !mesh.current) return;
    const from = nodes.get(link.from);
    const to = nodes.get(link.to);
    if (!from || !to) return;
    const start = absolutePortPosition(from, link.fromPort);
    const end = absolutePortPosition(to, link.toPort);
    const lift = Math.max(start[1], end[1]) + 0.18;
    const points: [number, number, number][] = [start, [start[0], lift, start[2]], [end[0], lift, end[2]], end];
    const local = progress.current - segment;
    const scaled = local * (points.length - 1);
    const pointIndex = Math.min(points.length - 2, Math.floor(scaled));
    const pointProgress = scaled - pointIndex;
    const a = points[pointIndex];
    const b = points[pointIndex + 1];
    mesh.current.position.set(a[0] + (b[0] - a[0]) * pointProgress, a[1] + (b[1] - a[1]) * pointProgress, a[2] + (b[2] - a[2]) * pointProgress);
  });
  return <mesh ref={mesh}><sphereGeometry args={[0.028, 16, 16]} /><meshStandardMaterial color={packet.color} emissive={packet.color} emissiveIntensity={3} /></mesh>;
}

export default function ThreeSandboxViewport({ topology, selection, activeFilters, onSelectNode, onSelectPort, onSelectLink, connectionStart, selectedPort, selectedCableId, sessions, showAxes, packets, onPacketComplete }: ThreeSandboxViewportProps & { packets: TrafficPacket[]; onPacketComplete: (id: string) => void }) {
  const nodes = new Map(topology.nodes.map((node) => [node.id, node]));
  const links = new Map(topology.links.map((link) => [link.id, link]));
  const matchesFilter = (node: SandboxNode) => {
    if (activeFilters.length === 0) return true;
    const tags = ecosystemDevice(node.kind).tags || [];
    return activeFilters.some((tag) => tags.includes(tag) || tag === node.kind);
  };
  return (
    <div className="h-[610px] overflow-hidden rounded-xl border border-[#29424a] bg-[#071017] shadow-2xl">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[7, 7, 9]} fov={45} />
        <color attach="background" args={["#071017"]} />
        <ambientLight intensity={0.65} />
        <directionalLight castShadow position={[5, 9, 4]} intensity={2} />
        <Grid args={[18, 12]} cellSize={0.24} sectionSize={1.2} sectionColor="#28525a" cellColor="#153139" fadeDistance={20} infiniteGrid />
        <Grid args={[18, 12]} cellSize={0.24} sectionSize={1.2} sectionColor="#22414a" cellColor="#122a31" fadeDistance={16} infiniteGrid position={[0, 9, 0]} rotation={[0, 0, 0]} />
        {showAxes && <axesHelper args={[3]} />}
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} target={[5.5, 0, -3]} />
        <Bounds fit clip observe margin={1.35}>
        {topology.links.map((link) => {
          const from = nodes.get(link.from);
          const to = nodes.get(link.to);
          if (!from || !to) return null;
          const start = absolutePortPosition(from, link.fromPort);
          const end = absolutePortPosition(to, link.toPort);
          const lift = Math.max(start[1], end[1]) + 0.18;
          const points: [number, number, number][] = [start, [start[0], lift, start[2]], [end[0], lift, end[2]], end];
          const cable = NETWORK_CABLES.find((item) => item.id === link.cableId);
          const cableColor = cable?.id === "smf" || cable?.id === "mmf" ? "#a6f5ff" : cable?.id === "rollover" ? "#f5b74b" : cable?.id === "serial" ? "#bf8cff" : "#3789b5";
          const selected = selection.some((item) => item.kind === "link" && item.id === link.id);
          const fromState = sessions[link.from]?.interfaces[link.fromPort];
          const toState = sessions[link.to]?.interfaces[link.toPort];
          const trunk = fromState?.switchportMode === "trunk" || toState?.switchportMode === "trunk";
          const etherChannel = fromState?.channelGroup || toState?.channelGroup;
          if (!matchesFilter(from) && !matchesFilter(to)) return null;
          return <CatmullRomLine key={link.id} points={points} color={selected ? "#ff8b3d" : etherChannel ? "#bf8cff" : trunk ? "#d66bff" : cableColor} lineWidth={selected ? 6 : etherChannel ? 5 : trunk ? 4 : 3} curveType="centripetal" tension={0.35} segments={20} onClick={(event) => { event.stopPropagation(); onSelectLink(link, event.ctrlKey || event.metaKey); }} />;
        })}
        {topology.nodes.filter(matchesFilter).map((node) => <DeviceMesh key={node.id} node={node} selected={selection.some((item) => item.kind === "node" && item.id === node.id)} selectedPort={selectedPort} connectionStart={connectionStart} selectedCableId={selectedCableId} onSelect={(additive) => onSelectNode(node, additive)} onSelectPort={onSelectPort} />)}
        {packets.map((packet) => <TrafficParticle key={packet.id} packet={packet} links={links} nodes={nodes} onComplete={onPacketComplete} />)}
        </Bounds>
      </Canvas>
      <div className="pointer-events-none relative -mt-[610px] flex justify-between p-4 font-mono text-[10px] uppercase tracking-[.16em] text-[#6e8c94]">
        <span>3D PHYSICAL VIEW / ORBIT TO INSPECT</span>
        <span>{topology.nodes.length} DEVICES / {topology.links.length} LINKS</span>
      </div>
    </div>
  );
}
