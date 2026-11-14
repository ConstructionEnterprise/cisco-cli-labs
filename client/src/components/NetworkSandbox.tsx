import FundamentalsWorksheet from "./FundamentalsWorksheet";
import { compareCurriculumOrder } from '@/labs/masterOneCurriculum';
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { applyCommand, boot, isCiscoCommand, modeledDeviceMac, modePrompt, normalizeCommand, type DhcpClientState, type DhcpLease, type Mode, type Session } from "@/lib/ios-engine";
import { Cable, Check, Copy, Eraser, Hand, History, Magnet, Monitor, MousePointer2, Network, PanelBottom, PanelLeftClose, PanelRightClose, Plus, Router, Save, Server, Share2, Shield, SquareTerminal, SwitchCamera, Trash2, Wifi, X, BookOpen, GripVertical, Minimize2, Maximize2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { LAB_REGISTRY, SANDBOX_TEMPLATES, type LabConfig } from "@/labs/labDefinitions";
import { NETWORK_CABLES, NETWORK_DEVICES, ecosystemDevice, ecosystemPort, type EcosystemDeviceKind } from "@/lib/network-ecosystem";
import type { PortRef, SelectionRef, TrafficPacket } from "@/lib/network-topology";
import ThreeSandboxViewport from "@/components/ThreeSandboxViewport";
import LogicalDiagramViewport from "@/components/LogicalDiagramViewport";
import PacketTrafficOverlay from "./PacketTrafficOverlay";
import { vlanOverlay } from '@/lib/vlan-overlay';
import { cabledPeer, cabledPeerAddress, cabledPeerMac, portHoverContent, useVlanHoverCard, vlanSvi } from '@/components/VlanHoverCard';
import { channelForwarding, interfaceEvidence } from '@/lib/operational-evidence';
import TabbedInspector from "@/components/TabbedInspector";
import NetworkDeviceSchematic from "@/components/NetworkDeviceSchematic";
import DeviceSelectionAlert from "@/components/DeviceSelectionAlert";
import { supportsDeviceCommand } from "@/lib/capabilities";
import { iosDeviceContextHelp, iosPlatformReference } from '@/lib/ios-device-reference';
import { createSimulatedFlow, flowToPackets } from "@/lib/traffic-engine";
import { evaluateAsaTraffic } from "@/lib/asa-engine";
import LearningWorkbench from './LearningWorkbench';
import RangeEvidencePanel from './RangeEvidencePanel';
import { canonicalCommand, DEFAULT_LEARNING_MODE, seedSessions, gradeLab, matchesHelpStep, recordAttempt, type LearningMode } from '../lib/learning-engine';
import { executeNetworkCommand, tracePacket } from '../lib/sandbox-network-engine';
import { executeAttackCommand, isAttackCommand } from '../lib/attack-console-engine';
import { interfaceSubnet, ospfNetworksMatch, isOspfSpeaker, supportsSandboxCommand, ospfNeighbors, prefixLength, reconcileOspfRoutes, outputFor, resolveProbePath, ipToNumber, numberToIp, deterministicMac, ageMacTables, removeMacEntriesForPort, removeMacEntriesForLink, vlanFromInterface, portAllowsVlan, clientVlan, resolveVlanPath, resolveDhcpLease, resolveDnsName, negotiatePoe, type ProbeResolution, type DhcpResolution, type DnsResolution, type VlanPath } from '../lib/sandbox-network-engine';

type DeviceKind = EcosystemDeviceKind;
type Tool = "select" | "pan" | "cable" | "erase";

export type SandboxNode = {
  id: string;
  name: string;
  kind: DeviceKind;
  role: string;
  x: number;
  y: number;
  ports: string[];
  ipv4?: string;
  vlan?: number;
  mountType?: "floor" | "desk" | "rack" | "ceiling";
  z?: number;
  terminal?: "attack";
};

export type SandboxLink = {
  id: string;
  from: string;
  to: string;
  fromPort: string;
  toPort: string;
  cableId?: string;
};

export type Topology = {
  name: string;
  description: string;
  nodes: SandboxNode[];
  links: SandboxLink[];
};

type PersistedSandbox = {
  topology: Topology;
  savedTopologies: Topology[];
  sessions: Record<string, Session>;
};

const STORAGE_KEY = "ipv6-cli-lab-network-sandbox-v3";
const MISSION_STORAGE_PREFIX = "ipv6-cli-lab-mission-v1:";

type PersistedMission = {
  version?: number;
  persisted: PersistedSandbox;
  stepIndex: number;
  selectedId: string | null;
  lastFeedback: string;
};

function missionStorageKey(labId: string): string {
  return MISSION_STORAGE_PREFIX + labId;
}

function loadMission(labId: string): PersistedMission | null {
  try {
    const raw = window.localStorage.getItem(missionStorageKey(labId));
    const mission = raw ? JSON.parse(raw) as PersistedMission : null;
    if (labId.includes('mt2-tr5-vlsm-supernetting') && mission?.version !== 2) return null;
    if (labId.includes('tr4-extended-acl') && mission?.version !== 3) return null;
    return mission;
  } catch {
    return null;
  }
}

const CANVAS_WIDTH = 1120;
const CANVAS_HEIGHT = 610;

function cloneTopology(topology: Topology): Topology {
  return JSON.parse(JSON.stringify(topology)) as Topology;
}

function roleFor(kind: DeviceKind): string {
  return ecosystemDevice(kind).defaultRole;
}

function portsFor(kind: DeviceKind): string[] {
  return ecosystemDevice(kind).ports;
}

function iconFor(kind: DeviceKind) {
  if (kind === "pc") return Monitor;
  if (kind === "printer") return Monitor;
  if (kind === "router") return Router;
  if (kind === "server") return Server;
  if (kind === "access-point") return Wifi;
  if (kind === "firewall") return Shield;
  if (kind === "modem" || kind === "hub" || kind === "console-server") return Network;
  return SwitchCamera;
}

function initialPersisted(labId: string): PersistedSandbox {
  const config = LAB_REGISTRY[labId] || LAB_REGISTRY["mt1-tr1-binary-foundations"];
  // Casting to Topology to fix the "unknown" error
  const topology = {
    name: config.title,
    description: config.description,
    nodes: config.topology.devices as SandboxNode[],
    links: config.topology.links as SandboxLink[]
  };
  return {
    topology,
    savedTopologies: [cloneTopology(topology)],
    sessions: Object.fromEntries(topology.nodes.map((node) => [node.id, seedSessions(config)[node.name]]))
  };
}

const isValidCommand = isCiscoCommand;

const SANDBOX_MASTER_NAMES = ["One", "Two", "Three", "Four", "Five", "Six"] as const;

function sandboxTrancheName(tranche: number): string {
  return `Tranche ${SANDBOX_MASTER_NAMES[tranche - 1] || tranche}`;
}

// Pure command and network calculations are shared with the walkthrough tests.

export default function NetworkSandbox({ onExit, labId = "mt1-tr1-binary-foundations" }: { onExit: () => void; labId?: string }) {
  const [activeLabId, setActiveLabId] = useState(labId);
  const config = LAB_REGISTRY[activeLabId] || LAB_REGISTRY["mt1-tr1-binary-foundations"];
  const [learningMode, setLearningMode] = useState<LearningMode>(DEFAULT_LEARNING_MODE);
  const [persisted, setPersisted] = useState<PersistedSandbox>(() => loadMission(labId)?.persisted ?? initialPersisted(labId));
  const { topology, savedTopologies, sessions } = persisted;
  const [tool, setTool] = useState<Tool>("select");
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(false);
  const [workspaceWidth, setWorkspaceWidth] = useState(244);
  const [missionWidth, setMissionWidth] = useState(320);
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false);
  const [missionCollapsed, setMissionCollapsed] = useState(false);
  const [viewportMode, setViewportMode] = useState<"schematic" | "logical" | "3d">("schematic");
  const [viewportZoom, setViewportZoom] = useState(1);
  const [showVlans, setShowVlans] = useState(false);
  const [selectedVlan, setSelectedVlan] = useState<number | null>(null);
  const vlanView = useMemo(() => vlanOverlay(topology, sessions), [topology, sessions]);
  const vlanHover = useVlanHoverCard();
  const vlanFilter = selectedVlan !== null && vlanView.vlanIds.includes(selectedVlan) ? selectedVlan : null;
  const [selectedId, setSelectedId] = useState<string | null>(() => loadMission(labId)?.selectedId ?? null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [cableStart, setCableStart] = useState<string | null>(null);
  const [connectionStart, setConnectionStart] = useState<PortRef | null>(null);
  const [selectedPort, setSelectedPort] = useState<PortRef | null>(null);
  const [selectedCableId, setSelectedCableId] = useState("cat6");
  const [packets, setPackets] = useState<TrafficPacket[]>([]);
  useEffect(() => {
    setPackets(current => {
      const stoppedFlows = new Set(current.filter(packet => packet.direction === 'request' && packet.probeSourceId && packet.probeDestinationIp && !tracePacket(packet.probeSourceId, packet.probeDestinationIp, topology, sessions).passed).map(packet => packet.flowId || packet.id));
      if (!stoppedFlows.size) return current;
      setNotice('A modeled packet flow stopped because its path is no longer valid.');
      return current.filter(packet => !stoppedFlows.has(packet.flowId || packet.id));
    });
  }, [topology, sessions]);
  const [deviceQuery, setDeviceQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selection, setSelection] = useState<SelectionRef[]>([]);
  const [showTerminal, setShowTerminal] = useState(true);
  const [terminalMinimized, setTerminalMinimized] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(150);
  const [commandHistoryOpen, setCommandHistoryOpen] = useState(false);
  const [terminalInput, setTerminalInput] = useState("");
  const [notice, setNotice] = useState("Canvas ready");
  const [stepIndex, setStepIndex] = useState(() => loadMission(labId)?.stepIndex ?? 0);
  const [lastFeedback, setLastFeedback] = useState<string>(() => loadMission(labId)?.lastFeedback ?? "Welcome to the lab. Start with the first objective.");
  const canvasRef = useRef<HTMLDivElement>(null);
  const terminalScrollbackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const resizeRef = useRef<{ side: "workspace" | "mission"; startX: number; startWidth: number } | { side: "terminal"; startY: number; startHeight: number } | null>(null);

  const selectedNode = topology.nodes.find((node) => node.id === selectedId) ?? null;
  const selectedSession = selectedNode ? sessions[selectedNode.id] : null;
  const selectedIosReference = selectedNode && selectedSession?.terminalKind !== 'attack' ? iosPlatformReference(selectedNode) : null;
  const selectedRole = selectedNode?.role ?? "Select a device to open its IOS console";
  const terminalLines = selectedSession?.history ?? [];
  useEffect(() => {
    const terminal = terminalScrollbackRef.current;
    if (terminal && !terminalMinimized) terminal.scrollTo({ top: terminal.scrollHeight, behavior: 'smooth' });
  }, [selectedNode?.id, selectedSession?.history.length, terminalMinimized]);
  const activeCommandHistory = selectedNode && selectedSession
    ? selectedSession.history.filter((line) => line.startsWith(selectedNode.name) && /[>#]\s/.test(line))
    : [];
  const nodeMap = useMemo(() => new Map(topology.nodes.map((node) => [node.id, node])), [topology.nodes]);
  const deviceTags = useMemo(() => Array.from(new Set(NETWORK_DEVICES.flatMap((device) => device.tags || []))).sort(), []);
  const filteredDevices = useMemo(() => NETWORK_DEVICES.filter((device) => {
    const query = deviceQuery.trim().toLowerCase();
    return (!query || `${device.name} ${device.defaultRole} ${(device.tags || []).join(" ")}`.toLowerCase().includes(query)) && (activeFilters.length === 0 || activeFilters.some((tag) => (device.tags || []).includes(tag) || tag === device.kind));
  }), [deviceQuery, activeFilters]);
  const sandboxScenarioGroups = useMemo(() => {
    const grouped = SANDBOX_MASTER_NAMES.map((name, index) => ({
      name: `Master Tranche ${name}`,
      tranches: [1, 2, 3, 4, 5].map((tranche) => ({
        name: sandboxTrancheName(tranche),
        scenarios: Object.entries(SANDBOX_TEMPLATES).filter(([, template]) => template.masterTranche === index + 1 && template.tranche === tranche).sort(([, a], [, b]) => compareCurriculumOrder(a, b)),
      })),
    }));
    return {
      grouped,
      legacy: Object.entries(SANDBOX_TEMPLATES).filter(([, template]) => !template.masterTranche),
    };
  }, []);

  const currentStep = config.steps[stepIndex];

  // Keep the sandbox selection synchronized with the curriculum selection.
  useEffect(() => {
    setActiveLabId(labId);
  }, [labId]);

  // Reset the complete mission session whenever the active scenario changes.
  useEffect(() => {
    const freshState = initialPersisted(activeLabId);
    const savedMission = loadMission(activeLabId);
    const nextState = savedMission?.persisted ?? freshState;

    setPersisted(nextState);
    setLearningMode(DEFAULT_LEARNING_MODE);
    setStepIndex(savedMission?.stepIndex ?? 0);
    setLastFeedback(savedMission?.lastFeedback ?? "Welcome to the lab. Start with the first objective.");
    setSelectedId(nextState.topology.nodes[0]?.id ?? null);
    setSelectedLinkId(null);
    setCableStart(null);
    setConnectionStart(null);
    setSelectedPort(null);
    setSelection([]);
    setPackets([]);
    setTool("select");
    setTerminalMinimized(false);
    setTerminalHeight(150);
    setShowTerminal(true);
    setCommandHistoryOpen(false);
    setTerminalInput("");
    dragRef.current = null;
    setNotice(`${freshState.topology.name} loaded`);
  }, [activeLabId, config]);

  useEffect(() => {
    if (config.type === "guided" || config.type === "sandbox") {
      window.localStorage.setItem(missionStorageKey(activeLabId), JSON.stringify({
        version: activeLabId.includes('tr4-extended-acl') ? 3 : activeLabId.includes('mt2-tr5-vlsm-supernetting') ? 2 : undefined,
        persisted,
        stepIndex,
        selectedId,
        lastFeedback
      } satisfies PersistedMission));
    } else if (persisted.topology.name === "Untitled Construction Network") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    }
  }, [activeLabId, config.type, lastFeedback, persisted, selectedId, stepIndex]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (resizeRef.current?.side === "workspace") {
        const delta = event.clientX - resizeRef.current.startX;
        setWorkspaceWidth(Math.max(190, Math.min(420, resizeRef.current.startWidth + delta)));
        return;
      }
      if (resizeRef.current?.side === "mission") {
        const delta = event.clientX - resizeRef.current.startX;
        setMissionWidth(Math.max(260, Math.min(480, resizeRef.current.startWidth - delta)));
        return;
      }
      if (resizeRef.current?.side === "terminal") {
        const delta = resizeRef.current.startY - event.clientY;
        setTerminalHeight(Math.max(150, Math.min(560, resizeRef.current.startHeight + delta)));
        return;
      }
      if (!dragRef.current || !canvasRef.current) return;
      const bounds = canvasRef.current.getBoundingClientRect();
      const rawX = Math.max(12, Math.min(CANVAS_WIDTH - 190, event.clientX - bounds.left - dragRef.current.dx));
      const rawY = Math.max(12, Math.min(CANVAS_HEIGHT - 100, event.clientY - bounds.top - dragRef.current.dy));
      const x = snapToGrid ? Math.round(rawX / 24) * 24 : rawX;
      const y = snapToGrid ? Math.round(rawY / 24) * 24 : rawY;
      setPersisted((current) => ({ ...current, topology: { ...current.topology, nodes: current.topology.nodes.map((node) => node.id === dragRef.current?.id ? { ...node, x, y } : node) } }));
    };
    const up = () => { dragRef.current = null; resizeRef.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  function selectTemplate(template: Topology, scenarioLabId?: string) {
    if (scenarioLabId && LAB_REGISTRY[scenarioLabId]) {
      setActiveLabId(scenarioLabId);
      return;
    }

    const cloned = cloneTopology(template);
    setPersisted((current) => ({ ...current, topology: cloned, sessions: Object.fromEntries(cloned.nodes.map((node) => [node.id, current.sessions[node.id] ?? boot(node.name, node.role)])) }));
    setSelectedId(cloned.nodes[0]?.id ?? null);
    setSelectedLinkId(null);
    setCableStart(null);
    setNotice(`${cloned.name} loaded`);
  }

  function saveScenario() {
    setPersisted((current) => ({ ...current, savedTopologies: [cloneTopology(current.topology), ...current.savedTopologies.filter((item) => item.name !== current.topology.name)].slice(0, 8) }));
    toast("Topology saved", { description: `${topology.name} is available from this browser.` });
  }

  function shareScenario() {
    const payload = JSON.stringify(topology, null, 2);
    navigator.clipboard?.writeText(payload);
    toast("Topology JSON copied", { description: "Paste it into a future scenario brief or keep it as a portable lab blueprint." });
  }

  function exportAsLabDefinition() {
    // 1. Create a unique ID for the new lab
    const labId = `custom-${Date.now()}`;
    const labTitle = topology.name || "Custom Sandbox Lab";
    const labDesc = topology.description || "A custom lab generated from the sandbox.";

    // 2. Format the devices for the registry
    const devicesCode = topology.nodes.map(node =>
      `      { id: "${node.id}", name: "${node.name}", kind: "${node.kind}", role: "${node.role}", x: ${node.x}, y: ${node.y}, ports: ${JSON.stringify(node.ports)} },`
    ).join("\n");

    // 3. Format the links for the registry
    const linksCode = topology.links.map(link =>
      `      { id: "${link.id}", from: "${link.from}", to: "${link.to}", fromPort: "${link.fromPort}", toPort: "${link.toPort}" },`
    ).join("\n");

    // 4. Build the final TypeScript string
    const finalCode = `
export const CUSTOM_LAB_${Date.now()} = {
  title: "${labTitle}",
  description: "${labDesc}",
  type: "sandbox",
  topology: {
    devices: [
${devicesCode}
    ],
    links: [
${linksCode}
    ],
  },
  steps: [], // Add your guided steps here!
};

// ADD THIS TO YOUR LAB_REGISTRY:
// "${labId}": CUSTOM_LAB_${Date.now()},
`;

    navigator.clipboard.writeText(finalCode);
    toast("Lab Blueprint Copied!", {
      description: "Paste the generated code into labDefinitions.ts to make this lab permanent."
    });
  }

  function addDevice(kind: DeviceKind) {
    const prefix = kind === "pc" ? "CE-HQ-ENG-PC" : kind === "printer" ? "CE-HQ-PRN" : kind === "switch" ? "CE-HQ-DSW" : kind === "router" ? "CE-HQ-R" : `CE-HQ-${kind.toUpperCase()}`;
    let suffix = 1;
    while (topology.nodes.some((node) => node.name === `${prefix}${suffix}`)) suffix += 1;
    const node: SandboxNode = { id: `${kind}-${Date.now()}`, name: `${prefix}${suffix}`, kind, role: roleFor(kind), x: 170 + ((topology.nodes.length * 185) % 760), y: 90 + ((topology.nodes.length * 105) % 390), ports: portsFor(kind) };
    setPersisted((current) => ({ ...current, topology: { ...current.topology, nodes: [...current.topology.nodes, node] }, sessions: { ...current.sessions, [node.id]: boot(node.name, node.role) } }));
    setSelectedId(node.id);
    setNotice(`${node.name} placed on the canvas`);
  }

  function connectNodes(firstId: string, secondId: string) {
    if (firstId === secondId) return;
    const duplicate = topology.links.some((link) => (link.from === firstId && link.to === secondId) || (link.from === secondId && link.to === firstId));
    if (duplicate) { setNotice("Those devices are already linked"); setCableStart(null); return; }
    const first = nodeMap.get(firstId);
    const second = nodeMap.get(secondId);
    if (!first || !second) return;
    const firstUsed = topology.links.filter((link) => link.from === firstId || link.to === firstId).length;
    const secondUsed = topology.links.filter((link) => link.from === secondId || link.to === secondId).length;
    const firstCables = ecosystemDevice(first.kind).cables;
    const secondCables = ecosystemDevice(second.kind).cables;
    const cable = NETWORK_CABLES.find((item) => firstCables.includes(item.id) && secondCables.includes(item.id));
    if (!cable) { setNotice(`No compatible cable model connects ${first.name} and ${second.name}`); setCableStart(null); return; }
    const link: SandboxLink = { id: `link-${Date.now()}`, from: firstId, to: secondId, fromPort: first.ports[Math.min(firstUsed, first.ports.length - 1)], toPort: second.ports[Math.min(secondUsed, second.ports.length - 1)], cableId: cable.id };
    setPersisted((current) => ({ ...current, topology: { ...current.topology, links: [...current.topology.links, link] } }));
    setCableStart(null);
    setNotice(`${first.name} ${link.fromPort} linked to ${second.name} ${link.toPort}`);
  }

  function isPortUsed(ref: PortRef) {
    return topology.links.some((link) => (link.from === ref.nodeId && link.fromPort === ref.port) || (link.to === ref.nodeId && link.toPort === ref.port));
  }

  function connectPorts(first: PortRef, second: PortRef) {
    const firstNode = nodeMap.get(first.nodeId);
    const secondNode = nodeMap.get(second.nodeId);
    const cable = NETWORK_CABLES.find((item) => item.id === selectedCableId);
    if (!firstNode || !secondNode || !cable) return;
    if (first.nodeId === second.nodeId) { setNotice("A cable must connect two different devices"); return; }
    if (isPortUsed(first) || isPortUsed(second)) { setNotice("One of those ports is already connected"); return; }
    if (!ecosystemDevice(firstNode.kind).cables.includes(selectedCableId) || !ecosystemDevice(secondNode.kind).cables.includes(selectedCableId)) {
      setNotice(`${cable.name} is not compatible with both selected devices`);
      return;
    }
    const link: SandboxLink = { id: `link-${Date.now()}`, from: first.nodeId, to: second.nodeId, fromPort: first.port, toPort: second.port, cableId: selectedCableId };
    setPersisted((current) => ({ ...current, topology: { ...current.topology, links: [...current.topology.links, link] } }));
    setSelectedLinkId(link.id);
    setSelectedPort(second);
    setConnectionStart(null);
    setNotice(`${firstNode.name} ${first.port} linked to ${secondNode.name} ${second.port} with ${cable.name}`);
  }

  function handlePortSelect(ref: PortRef) {
    const node = nodeMap.get(ref.nodeId);
    if (!node) return;
    setSelectedId(node.id);
    setSelectedLinkId(null);
    setSelectedPort(ref);
    setSelection([{ kind: "port", id: `${ref.nodeId}:${ref.port}` }]);
    if (tool !== "cable") return;
    if (!connectionStart) {
      setConnectionStart(ref);
      setNotice(`Port start: ${node.name} ${ref.port}. Select a destination port.`);
    } else {
      connectPorts(connectionStart, ref);
    }
  }

  function handleNodeSelection(node: SandboxNode, additive: boolean) {
    const ref: SelectionRef = { kind: "node", id: node.id };
    setSelection((current) => additive ? (current.some((item) => item.kind === "node" && item.id === node.id) ? current.filter((item) => !(item.kind === "node" && item.id === node.id)) : [...current, ref]) : [ref]);
    setSelectedId(node.id);
    setSelectedLinkId(null);
    setSelectedPort(null);
  }

  function handleLinkSelection(link: SandboxLink, additive: boolean) {
    const ref: SelectionRef = { kind: "link", id: link.id };
    setSelection((current) => additive ? (current.some((item) => item.kind === "link" && item.id === link.id) ? current.filter((item) => !(item.kind === "link" && item.id === link.id)) : [...current, ref]) : [ref]);
    setSelectedLinkId(link.id);
    setSelectedId(null);
    setSelectedPort(null);
  }

  function spawnPingProbe(sourceId: string, destination: string): boolean {
    const diagnostic = tracePacket(sourceId, destination, topology, sessions);
    if (!diagnostic.passed) { setLastFeedback(diagnostic.summary); setNotice(diagnostic.summary); return false; }
    const resolution = resolveProbePath(sourceId, destination, topology, sessions);
    if ("error" in resolution) {
      setLastFeedback(`✕ ${resolution.error}`);
      setNotice("Probe stopped by modeled forwarding state");
      return false;
    }
    if (diagnostic.path.length === 0) {
      setLastFeedback(`✓ ${destination} is configured on the current device. The ping completed locally, so no network cable was traversed.`);
      setNotice('Local ping completed - no packet path to animate');
      return true;
    }
    const sourceName = topology.nodes.find((node) => node.id === sourceId)?.name || sourceId;
    const sourceIp = Object.entries(sessions[sourceId].interfaces).find(([port, state]) => interfaceEvidence(sessions[sourceId], port).up && state.ipv4.length)?.[1].ipv4[0].split(' ')[0] || "0.0.0.0";
    const flow = createSimulatedFlow({
      protocol: "icmp",
      source: sourceName,
      destination: resolution.destination.name,
      sourceIp,
      destinationIp: destination,
    });
    const startedAt = performance.now();
    const burst = flowToPackets(flow, diagnostic.path, "#63e6e2", 5).map(packet => ({
      ...packet, startedAt,
      probeSourceId: sourceId,
      probeDestinationIp: destination,
      source: packet.direction === 'reply' ? resolution.destination.id : sourceId,
      destination: packet.direction === 'reply' ? sourceId : resolution.destination.id,
      path: packet.direction === 'reply' && 'replyPath' in diagnostic ? diagnostic.replyPath : packet.path,
    }));
    setPackets((current) => [...current, ...burst]);
    return true;
  }

  function handleNodeClick(node: SandboxNode) {
    if (tool === "erase") {
      setPersisted((current) => ({
        ...current,
        topology: {
          ...current.topology,
          nodes: current.topology.nodes.filter((item) => item.id !== node.id),
          links: current.topology.links.filter((link) => link.from !== node.id && link.to !== node.id),
        },
        sessions: Object.fromEntries(Object.entries(current.sessions).filter(([id]) => id !== node.id)),
      }));
      setSelectedId(null);
      setNotice(`${node.name} removed from the canvas`);
      return;
    }
    setSelectedId(node.id);
    setSelectedLinkId(null);
    setSelectedPort(null);
    if (tool === "cable") {
      if (!cableStart) { setCableStart(node.id); setNotice(`Cable start: ${node.name}. Select a second device.`); }
      else connectNodes(cableStart, node.id);
    }
  }

  function handleNodePointerDown(event: React.PointerEvent<HTMLDivElement>, node: SandboxNode) {
    event.stopPropagation();
    if (tool !== "select" || !canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    dragRef.current = { id: node.id, dx: event.clientX - bounds.left - node.x, dy: event.clientY - bounds.top - node.y };
  }

  function moveLogicalNode(nodeId: string, x: number, y: number) {
    setPersisted((current) => ({ ...current, topology: { ...current.topology, nodes: current.topology.nodes.map((node) => node.id === nodeId ? { ...node, x, y } : node) } }));
  }

  function removeSelectedLink() {
    if (!selectedLinkId) return;
    setPersisted((current) => {
      const link = current.topology.links.find((candidate) => candidate.id === selectedLinkId);
      const sessionsAfterRemoval = link ? removeMacEntriesForLink(current.sessions, current.topology, link) : current.sessions;
      return { ...current, topology: { ...current.topology, links: current.topology.links.filter((candidate) => candidate.id !== selectedLinkId) }, sessions: sessionsAfterRemoval };
    });
    setSelectedLinkId(null);
    setNotice("Cable removed");
  }

  function resetCanvas() {
    selectTemplate(SANDBOX_TEMPLATES["blank"]);
    setNotice("Blank canvas ready");
  }

  function resetMission() {
    const freshState = initialPersisted(activeLabId);
    window.localStorage.removeItem(missionStorageKey(activeLabId));
    setPersisted(freshState);
    setStepIndex(0);
    setLastFeedback("Welcome to the lab. Start with the first objective.");
    setSelectedId(freshState.topology.nodes[0]?.id ?? null);
    setSelectedLinkId(null);
    setCableStart(null);
    setConnectionStart(null);
    setSelectedPort(null);
    setSelection([]);
    setPackets([]);
    setTool("select");
    setTerminalMinimized(false);
    setTerminalHeight(150);
    setShowTerminal(true);
    setCommandHistoryOpen(false);
    setTerminalInput("");
    dragRef.current = null;
    setNotice(freshState.topology.name + " reset");
  }

  function submitIosHelp(query: string) {
    if (!selectedNode || !selectedSession || selectedSession.terminalKind === 'attack') return false;
    const help = iosDeviceContextHelp(query, selectedSession.mode, selectedNode, selectedSession.context);
    if (!help) return false;
    const matches = matchesHelpStep(currentStep, query, selectedNode.name, selectedSession.mode, help);
    setPersisted(current => ({ ...current, sessions: { ...current.sessions, [selectedNode.id]: { ...selectedSession, history: [...selectedSession.history, `${modePrompt(selectedNode.name, selectedSession)} ${query}`, ...help], completedLabSteps: matches ? { ...selectedSession.completedLabSteps, [currentStep.id]: true } : selectedSession.completedLabSteps } } }));
    if (matches) { setTerminalInput(''); setStepIndex(index => index + 1); setLastFeedback(currentStep.successMessage); }
    return true;
  }

  function submitTerminal(value = terminalInput) {
    if (!selectedNode || !selectedSession || !value.trim()) return;
    const raw = value.trim();
    if (submitIosHelp(raw)) { setTerminalInput(''); return; }
    const command = canonicalCommand(raw);
    const isAttackConsole = selectedSession.terminalKind === 'attack';
    if (isAttackConsole) {
      const history = [...selectedSession.history, `${modePrompt(selectedNode.name, selectedSession)} ${raw}`];
      const result = executeAttackCommand(selectedSession, command, sessions);
      if (!isAttackCommand(command) || !result.accepted) {
        setPersisted(current => ({ ...current, sessions: { ...current.sessions, [selectedNode.id]: { ...selectedSession, history: [...history, 'bash: command not found'] } } }));
        setTerminalInput('');
        return;
      }
      if (result.accepted && currentStep) {
        const observed = !currentStep.evidencePhase || result.session.attackTerminal?.rangeEvidence.length !== selectedSession.attackTerminal?.rangeEvidence.length
          && result.session.attackTerminal?.rangeEvidence.at(-1)?.phase === currentStep.evidencePhase
          && result.session.attackTerminal?.rangeEvidence.at(-1)?.targetId === config.rangeTargetId;
        const matches = selectedNode.name === currentStep.targetDevice && selectedSession.mode === currentStep.requiredMode && observed
          && (currentStep.evidencePhase || command === canonicalCommand(currentStep.expectedCommand));
        if (matches) { setStepIndex(index => index + 1); setLastFeedback(currentStep.successMessage); }
      }
      setPersisted(current => ({ ...current, sessions: { ...current.sessions, [selectedNode.id]: { ...result.session, history: [...history, ...result.output] } } }));
      setTerminalInput('');
      return;
    }
    if (learningMode === 'guided') recordAttempt(config.id, 'hints');
    const history = [...selectedSession.history, `${modePrompt(selectedNode.name, selectedSession)} ${raw}`];
    const result = executeNetworkCommand(selectedNode, topology, sessions, command);
    if (!result.accepted) recordAttempt(config.id, 'errors');
    if (result.accepted && currentStep) {
      const reachable = !currentStep.requireReachability || tracePacket(selectedNode.id, command.slice(5), topology, result.sessions).passed;
      const matches = selectedNode.name === currentStep.targetDevice && selectedSession.mode === currentStep.requiredMode && command === canonicalCommand(currentStep.expectedCommand) && reachable;
      if (matches) { setStepIndex(index => index + 1); setLastFeedback(currentStep.successMessage); }
      else if (currentStep.requireReachability && !reachable) setLastFeedback('The modeled request/reply path is not reachable yet. Check both router interfaces and the switch ports.');
      else if (learningMode === 'guided') setLastFeedback(`Command accepted. Next guided step: ${currentStep.targetDevice} / ${currentStep.expectedCommand}`);
    }
    if (result.accepted && command.startsWith('ping ')) spawnPingProbe(selectedNode.id, command.slice(5));
    const output = result.output;
    setPersisted(current => ({ ...current, sessions: { ...result.sessions, [selectedNode.id]: { ...result.sessions[selectedNode.id], history: [...history, ...output] } } }));
    setTerminalInput('');
  }


  const linkLines = topology.links.map((link) => {
    const from = nodeMap.get(link.from);
    const to = nodeMap.get(link.to);
    if (!from || !to) return null;
    return { link, x1: from.x + 90, y1: from.y + 48, x2: to.x + 90, y2: to.y + 48, midX: (from.x + to.x) / 2 + 90, midY: (from.y + to.y) / 2 + 48 };
  }).filter(Boolean) as { link: SandboxLink; x1: number; y1: number; x2: number; y2: number; midX: number; midY: number }[];

  return (
    <main className="min-h-screen bg-[#0a1017] text-[#edf4f3]">
      <header className="flex items-center justify-between border-b border-white/10 bg-[#0b1118]/95 px-5 py-4 lg:px-8">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onExit} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#63e6e2]/35 bg-[#10252b] text-[#63e6e2]" aria-label="Back to curriculum">
            <Network className="h-5 w-5" />
          </button>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[.22em] text-[#63e6e2]">IPv6 CLI Lab</div>
            <div className="font-display text-lg font-semibold">Network Sandbox</div>
          </div>
        </div>
        <div className="hidden items-center gap-3 text-[10px] font-mono uppercase tracking-[.16em] text-[#84969d] sm:flex">
          <span>CONSTRUCTION ENTERPRISES</span>
          <span className="h-1.5 w-1.5 rounded-full bg-[#63e6e2] shadow-[0_0_10px_#63e6e2]" />
          <span>TOPOLOGY WORKSPACE</span>
        </div>
        <button type="button" onClick={onExit} className="text-xs text-[#8ea0a7] hover:text-white">Back to curriculum</button>
      </header>

      <div className="border-b border-white/10 bg-[#0d151e] px-5 py-3 lg:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="instrument-label shrink-0">SANDBOX / {notice}</div>
            <div className="hidden h-px w-24 bg-gradient-to-r from-[#63e6e2] to-transparent md:block" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" className="border-white/15 bg-transparent text-[#98aab0] hover:bg-white/10 hover:text-white" onClick={resetCanvas}>
              <Plus className="mr-2 h-3.5 w-3.5" /> New canvas
            </Button>
            <Button variant="outline" size="sm" className="border-white/15 bg-transparent text-[#98aab0] hover:bg-white/10 hover:text-white" onClick={saveScenario}>
              <Save className="mr-2 h-3.5 w-3.5" /> Save
            </Button>
            <Button variant="outline" size="sm" className="border-[#63e6e2]/30 bg-transparent text-[#63e6e2] hover:bg-[#63e6e2]/10" onClick={exportAsLabDefinition}>
              <Copy className="mr-2 h-3.5 w-3.5" /> Export as Lab
            </Button>
            <Button size="sm" className="bg-[#f5b74b] text-[#1c160b] hover:bg-[#ffca69]" onClick={shareScenario}>
              <Share2 className="mr-2 h-3.5 w-3.5" /> Share
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:[grid-template-columns:var(--workspace-width)_minmax(0,1fr)_var(--mission-width)]" style={{ "--workspace-width": workspaceCollapsed ? "48px" : `${workspaceWidth}px`, "--mission-width": missionCollapsed ? "48px" : `${missionWidth}px` } as React.CSSProperties}>
        <aside className={`relative border-b border-white/10 bg-[#0d151e] lg:min-h-[calc(100vh-118px)] lg:border-b-0 lg:border-r ${workspaceCollapsed ? "p-2" : "p-4"}`}>
          <div className="mb-5 flex items-center justify-between">
            <div className={workspaceCollapsed ? "hidden" : ""}>
              <div className="instrument-label">WORKSPACE</div>
              <div className="mt-1 text-sm text-[#b8c5c8]">Build a topology</div>
            </div>
            {workspaceCollapsed ? <MousePointer2 className="mx-auto h-4 w-4 text-[#63e6e2]" /> : <button type="button" onClick={() => setWorkspaceCollapsed(true)} className="rounded p-1 text-[#71828a] hover:bg-white/10 hover:text-white" aria-label="Minimize workspace panel"><PanelLeftClose className="h-4 w-4" /></button>}
          </div>
          {workspaceCollapsed && <button type="button" onClick={() => setWorkspaceCollapsed(false)} className="absolute inset-x-2 top-14 rounded border border-white/10 p-1.5 text-[#63e6e2] hover:bg-[#173038]" aria-label="Expand workspace panel"><PanelLeftClose className="mx-auto h-4 w-4 rotate-180" /></button>}
          <div className={workspaceCollapsed ? "hidden" : ""}>
          <details className="group mb-3 rounded-lg border border-white/10 bg-[#101a23]" open={activeFilters.length > 0 || Boolean(deviceQuery)}>
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[10px] uppercase tracking-wider text-[#b8c5c8]">
              <span>Filters {activeFilters.length > 0 ? `· ${activeFilters.length}` : ""}</span><span className="text-[#63e6e2] transition group-open:rotate-180">⌄</span>
            </summary>
            <div className="border-t border-white/10 p-3">
              <input value={deviceQuery} onChange={(event) => setDeviceQuery(event.target.value)} placeholder="Search devices or tags" className="mb-2 w-full rounded-lg border border-white/10 bg-[#0d151e] px-3 py-2 text-xs text-white outline-none placeholder:text-[#60747c] focus:border-[#63e6e2]/50" aria-label="Filter devices or tags" />
              <div className="flex flex-wrap gap-1">
                <button type="button" onClick={() => setActiveFilters([])} className={`rounded-full border px-2 py-1 text-[9px] ${activeFilters.length === 0 ? "border-[#63e6e2]/50 bg-[#63e6e2]/10 text-[#63e6e2]" : "border-white/10 text-[#71828a]"}`}>all</button>
                {deviceTags.map((tag) => <button type="button" key={tag} onClick={() => setActiveFilters((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])} className={`rounded-full border px-2 py-1 text-[9px] ${activeFilters.includes(tag) ? "border-[#f5b74b]/60 bg-[#f5b74b]/10 text-[#f5d992]" : "border-white/10 text-[#71828a]"}`}>{tag}</button>)}
              </div>
            </div>
          </details>
          <details className="group mb-4 rounded-lg border border-white/10 bg-[#101a23]">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[10px] uppercase tracking-wider text-[#b8c5c8]"><span>Devices</span><span className="text-[#63e6e2] transition group-open:rotate-180">⌄</span></summary>
            <div className="max-h-[360px] space-y-2 overflow-y-auto border-t border-white/10 p-2">
            {filteredDevices.map((device) => {
              const Icon = iconFor(device.kind);
              const title = device.name;
              const detail = device.defaultRole;
              return (
                <button type="button" key={device.id} onClick={() => addDevice(device.kind)} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#111c27] p-3 text-left transition hover:border-[#63e6e2]/40 hover:bg-[#173038]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#10252b] text-[#63e6e2]">
                    <Icon className="h-4 w-4" />
                  </span>
                    <span>
                      <span className="block text-xs font-semibold text-white">{title}</span>
                      <span className="block text-[10px] text-[#778890]">{detail}</span>
                      <span className="mt-1 block truncate text-[9px] text-[#63e6e2]/70">{(device.tags || []).slice(0, 3).join(" · ")}</span>
                  </span>
                  <Plus className="ml-auto h-3.5 w-3.5 text-[#6b7d84]" />
                </button>
              );
            })}
            {filteredDevices.length === 0 && <p className="px-2 py-3 text-xs text-[#71828a]">No devices match the current filters.</p>}
            </div>
          </details>
          <details className="group mt-6 border-t border-white/10 pt-5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[10px] uppercase tracking-wider text-[#b8c5c8]"><span>Scenarios</span><span className="text-[#63e6e2] transition group-open:rotate-180">⌄</span></summary>
            <div className="mt-3 space-y-2">
              {sandboxScenarioGroups.grouped.map((master) => (
                <details key={master.name} className="group/scenario rounded-lg border border-white/10 bg-[#101a23]">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[10px] uppercase tracking-wider text-[#f4d998]"><span>{master.name}</span><span className="text-[#63e6e2] transition group-open/scenario:rotate-180">⌄</span></summary>
                  <div className="space-y-1 border-t border-white/10 p-2">
                    {master.tranches.map((tranche) => (
                      <details key={tranche.name} className="group/subtranche rounded border border-white/10 bg-[#0d151e]">
                        <summary className="flex cursor-pointer list-none items-center justify-between px-2.5 py-2 text-[9px] uppercase tracking-wider text-[#9aabb1]"><span>{tranche.name}</span><span className="text-[#63e6e2] transition group-open/subtranche:rotate-180">⌄</span></summary>
                        <div className="border-t border-white/10 p-1.5">
                          {tranche.scenarios.length > 0 ? tranche.scenarios.map(([id, template]) => (
                            <button key={id} type="button" onClick={() => selectTemplate(template, id)} className="mb-1 w-full rounded-lg border border-white/10 bg-[#111c27] px-2.5 py-2 text-left text-xs text-[#8ea0a7] hover:border-[#63e6e2]/40 hover:text-white">{template.name}</button>
                          )) : <div className="px-2 py-2 text-[10px] text-[#60747c]">No sandbox scenarios assigned.</div>}
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              ))}
              <details className="group/legacy rounded-lg border border-[#f5b74b]/20 bg-[#17150f]" open>
                <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[10px] uppercase tracking-wider text-[#f4d998]"><span>Legacy</span><span className="text-[#f5b74b] transition group-open/legacy:rotate-180">⌄</span></summary>
                <div className="border-t border-[#f5b74b]/15 p-1.5">
                  {sandboxScenarioGroups.legacy.map(([id, template]) => (
                    <button key={id} type="button" onClick={() => selectTemplate(template, id)} className="mb-1 w-full rounded-lg border border-white/10 bg-[#111c27] px-2.5 py-2 text-left text-xs text-[#8ea0a7] hover:border-[#f5b74b]/40 hover:text-white">{template.name}</button>
                  ))}
                </div>
              </details>
              <div className="mt-2 space-y-1">
                {savedTopologies.slice(0, 4).map((saved) => (
                  <button type="button" key={saved.name} onClick={() => selectTemplate(saved)} className="block w-full truncate px-3 py-1.5 text-left text-[10px] text-[#667a82] hover:text-[#c5d2d3]">↳ {saved.name}</button>
                ))}
              </div>
            </div>
          </details>
          </div>
          {!workspaceCollapsed && <button type="button" onPointerDown={(event) => { event.preventDefault(); resizeRef.current = { side: "workspace", startX: event.clientX, startWidth: workspaceWidth }; }} className="absolute -right-2 top-0 z-30 hidden h-full w-4 cursor-col-resize items-center justify-center text-[#3b555c] hover:text-[#63e6e2] lg:flex" aria-label="Resize workspace panel"><GripVertical className="h-5 w-5" /></button>}
        </aside>

        <section className="min-w-0 p-4 lg:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="instrument-label text-[#f5b74b]">TOPOLOGY / {topology.name}</div>
              <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-white">{topology.name}</h1>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-[#8fa0a7]">{topology.description}</p>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[#6f8289]">
              <span>{topology.nodes.length} devices</span>
              <span>·</span>
              <span>{topology.links.length} links</span>
              <span>·</span>
            <span className="text-[#63e6e2]">{tool === "cable" ? cableStart ? "select destination" : "select cable start" : "select / drag"}</span>
          </div>
          </div>
          <div className="mb-3 flex items-center justify-between rounded-lg border border-white/10 bg-[#101a23] p-1">
            <div className="flex items-center gap-2">
              <details className="relative group">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#b8c5c8] hover:bg-white/5"><span>Controls</span><span className="text-[#63e6e2] transition group-open:rotate-180">⌄</span></summary>
                <div className="absolute left-0 top-full z-40 mt-1 w-64 rounded-lg border border-white/10 bg-[#101a23] p-2 shadow-2xl">
                  <div className="grid grid-cols-2 gap-1">
                    <button type="button" onClick={() => { setTool("select"); setCableStart(null); }} className={`rounded-md px-2 py-2 text-[10px] uppercase tracking-wider transition ${tool === "select" ? "bg-[#173038] text-[#63e6e2]" : "text-[#71828a] hover:bg-white/5 hover:text-white"}`}><MousePointer2 className="mx-auto mb-1 h-3.5 w-3.5" />Select</button>
                    <button type="button" onClick={() => setTool("pan")} className={`rounded-md px-2 py-2 text-[10px] uppercase tracking-wider transition ${tool === "pan" ? "bg-[#173038] text-[#63e6e2]" : "text-[#71828a] hover:bg-white/5 hover:text-white"}`}><Hand className="mx-auto mb-1 h-3.5 w-3.5" />Pan</button>
                    <button type="button" onClick={() => { setTool("cable"); setCableStart(null); }} className={`rounded-md px-2 py-2 text-[10px] uppercase tracking-wider transition ${tool === "cable" ? "bg-[#173038] text-[#63e6e2]" : "text-[#71828a] hover:bg-white/5 hover:text-white"}`}><Cable className="mx-auto mb-1 h-3.5 w-3.5" />Cable</button>
                    <button type="button" onClick={() => { setTool("erase"); setCableStart(null); }} className={`rounded-md px-2 py-2 text-[10px] uppercase tracking-wider transition ${tool === "erase" ? "bg-[#3a2024] text-[#ff8d8d]" : "text-[#71828a] hover:bg-white/5 hover:text-white"}`} title="Remove a device from the canvas"><Eraser className="mx-auto mb-1 h-3.5 w-3.5" />Erase</button>
                  </div>
                  <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                    <button type="button" aria-pressed={showVlans} onClick={() => { setShowVlans(value => !value); if (viewportMode === '3d') setViewportMode('logical'); }} className="flex w-full items-center justify-between rounded-md border border-[#63e6e2]/30 px-2 py-2 text-[10px] text-[#63e6e2]"><span>VLAN overlay (2D)</span><span>{showVlans ? 'ON' : 'OFF'}</span></button>
                    {showVlans && <label className="block px-1 py-2 text-[10px] text-[#b8c5c8]">Highlight VLAN<select aria-label="Highlight VLAN" value={vlanFilter ?? 'all'} onChange={event => setSelectedVlan(event.target.value === 'all' ? null : Number(event.target.value))} className="mt-1 w-full rounded border border-white/10 bg-[#0d151e] p-2"><option value="all">All VLANs</option>{vlanView.vlanIds.map(vlan => <option key={vlan} value={vlan}>VLAN {vlan}</option>)}</select></label>}
                    <button type="button" onClick={() => setSnapToGrid((value) => !value)} className={`flex w-full items-center justify-between rounded-md border px-2 py-2 text-[10px] uppercase tracking-wider transition ${snapToGrid ? "border-[#63e6e2]/40 bg-[#173038] text-[#63e6e2]" : "border-white/10 bg-[#0d151e] text-[#71828a] hover:text-white"}`}><span className="flex items-center gap-2"><Magnet className="h-3.5 w-3.5" />Snap to grid</span><span>{snapToGrid ? "ON" : "OFF"}</span></button>
                    <button type="button" onClick={() => setShowAxes((value) => !value)} className={`flex w-full items-center justify-between rounded-md border px-2 py-2 text-[10px] uppercase tracking-wider transition ${showAxes ? "border-[#63e6e2]/40 bg-[#173038] text-[#63e6e2]" : "border-white/10 bg-[#0d151e] text-[#71828a] hover:text-white"}`} aria-pressed={showAxes}><span>XYZ coordinate widget</span><span>{showAxes ? "ON" : "OFF"}</span></button>
                    <div className="flex items-center gap-1 rounded-md border border-white/10 bg-[#0d151e] p-1">
                      <button type="button" onClick={() => setViewportZoom((value) => Math.max(0.6, Number((value - 0.1).toFixed(1))))} className="flex flex-1 items-center justify-center rounded px-2 py-2 text-[#71828a] transition hover:bg-white/5 hover:text-white" aria-label="Zoom out viewport" title="Zoom out"><ZoomOut className="h-3.5 w-3.5" /></button>
                      <span className="min-w-12 text-center font-mono text-[10px] text-[#63e6e2]">{Math.round(viewportZoom * 100)}%</span>
                      <button type="button" onClick={() => setViewportZoom((value) => Math.min(1.4, Number((value + 0.1).toFixed(1))))} className="flex flex-1 items-center justify-center rounded px-2 py-2 text-[#71828a] transition hover:bg-white/5 hover:text-white" aria-label="Zoom in viewport" title="Zoom in"><ZoomIn className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => setViewportZoom(1)} className="flex items-center justify-center rounded px-2 py-2 text-[#71828a] transition hover:bg-white/5 hover:text-white" aria-label="Reset viewport zoom" title="Reset zoom"><RotateCcw className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>
              </details>
              <span className="px-1 font-mono text-[10px] uppercase tracking-[.16em] text-[#71878e]">Viewport</span>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => setViewportMode("schematic")} className={`rounded-md px-3 py-1.5 text-[10px] uppercase tracking-wider ${viewportMode === "schematic" ? "bg-[#173038] text-[#63e6e2]" : "text-[#71828a] hover:text-white"}`}>Schematic</button>
              <button type="button" onClick={() => setViewportMode("logical")} className={`rounded-md px-3 py-1.5 text-[10px] uppercase tracking-wider ${viewportMode === "logical" ? "bg-[#173038] text-[#63e6e2]" : "text-[#71828a] hover:text-white"}`}>Logical</button>
              <button type="button" onClick={() => setViewportMode("3d")} className={`rounded-md px-3 py-1.5 text-[10px] uppercase tracking-wider ${viewportMode === "3d" ? "bg-[#173038] text-[#63e6e2]" : "text-[#71828a] hover:text-white"}`}>3D Physical</button>
            </div>
          </div>
          {showVlans && <div className="mb-3 rounded border border-[#63e6e2]/25 bg-[#0d1920] px-3 py-2 text-[10px] text-[#b8c5c8]">VLAN overlay {vlanFilter === null ? '/ all VLANs' : `/ VLAN ${vlanFilter}`} · Membership is not forwarding status. Logical link colors retain operational state. Endpoint labels are inferred from connected access ports. {viewportMode === '3d' && 'Switch to Logical or Schematic to see the overlay.'}</div>}
          {currentStep?.exercise && <FundamentalsWorksheet key={config.id + ':' + currentStep.id + ':' + learningMode} step={currentStep} labId={config.id} mode={learningMode} onComplete={() => {
            const device = topology.nodes.find(node => node.name === currentStep.targetDevice);
            if (!device) return;
            setPersisted(current => ({ ...current, sessions: { ...current.sessions, [device.id]: { ...current.sessions[device.id], lessonAnswers: { ...current.sessions[device.id]?.lessonAnswers, [currentStep.id]: true } } } }));
            setStepIndex(index => Math.min(index + 1, config.steps.length));
          }} />}
          <div style={{ zoom: viewportZoom } as React.CSSProperties}>
          <div className="mb-2 rounded-lg border border-[#63e6e2]/20 bg-[#101a23] px-3 py-2 font-mono text-[10px] text-[#9ab0b5]" role="status">
            <span className="text-[#63e6e2]">Request</span> / <span className="text-[#f5b74b]">Reply</span>
            {packets.length ? ' - Verified packets are circulating through the current path.' : ' - Run ping to an addressed device to start a modeled packet flow.'}
          </div>
          {viewportMode === "3d" ? (
            <ThreeSandboxViewport topology={topology} selection={selection} activeFilters={activeFilters} sessions={sessions} showAxes={showAxes} packets={packets} connectionStart={connectionStart} selectedPort={selectedPort} selectedCableId={selectedCableId} onSelectNode={handleNodeSelection} onSelectPort={handlePortSelect} onSelectLink={handleLinkSelection} />
          ) : viewportMode === "logical" ? (
            <LogicalDiagramViewport topology={topology} sessions={sessions} selection={selection} packets={packets} snapToGrid={snapToGrid} showVlans={showVlans} selectedVlan={vlanFilter} onMoveNode={moveLogicalNode} onSelectNode={handleNodeSelection} onSelectPort={handlePortSelect} onSelectLink={handleLinkSelection} />
          ) : <div className="overflow-auto rounded-xl border border-white/10 bg-[#080d13] shadow-2xl">
            <div ref={canvasRef} className="relative min-h-[610px] min-w-[1120px] overflow-hidden" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(99,230,226,.12) 1px, transparent 0)", backgroundSize: "24px 24px" }} onClick={() => { if (tool === "cable") { setCableStart(null); setNotice("Cable mode ready"); } else { setSelectedLinkId(null); } }}>
                <div className="absolute left-5 top-5 font-mono text-[10px] uppercase tracking-[.2em] text-[#3b555c]">FIELD CANVAS / {topology.name} / CAD MODE</div>
              <svg className="pointer-events-none absolute inset-0" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} aria-label="Topology links">
                {linkLines.map(({ link, x1, y1, x2, y2, midX, midY }) => (
                  <g key={link.id} opacity={showVlans && !vlanView.linkMatches(link, vlanFilter) ? .18 : 1}>
                    <polyline points={[x1 + "," + y1, midX + "," + y1, midX + "," + y2, x2 + "," + y2].join(" ")} fill="none" stroke={selectedLinkId === link.id ? "#f5b74b" : "#3ac9c6"} strokeWidth={selectedLinkId === link.id ? 3 : 2} strokeDasharray={selectedLinkId === link.id ? "8 5" : undefined} />
                    <circle cx={x1} cy={y1} r="4" fill="#63e6e2" />
                    <circle cx={x2} cy={y2} r="4" fill="#63e6e2" />
                    <text x={midX} y={midY - 8} fill="#71878e" fontSize="9" textAnchor="middle" fontFamily="IBM Plex Mono, monospace">{link.fromPort} ↔ {link.toPort} / {NETWORK_CABLES.find((cable) => cable.id === link.cableId)?.name || "Ethernet"}</text>
                    {showVlans && <text x={midX} y={midY + 6} fill="#63e6e2" fontSize="9" textAnchor="middle">{vlanView.portInfo(link.from, link.fromPort).label === vlanView.portInfo(link.to, link.toPort).label ? vlanView.portInfo(link.from, link.fromPort).label : `${vlanView.portInfo(link.from, link.fromPort).label} / ${vlanView.portInfo(link.to, link.toPort).label}`}</text>}
                  </g>
                ))}
              </svg>
              <svg className="pointer-events-none absolute inset-0 z-20" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} aria-label="Modeled packet traffic"><PacketTrafficOverlay packets={packets} topology={topology} /></svg>
              {topology.nodes.map((node) => {
                const Icon = iconFor(node.kind);
                const isSelected = selectedId === node.id;
                const isCableStart = cableStart === node.id;
                return (
                  <div 
                    key={node.id} 
                    role="button" 
                    tabIndex={0} 
                    aria-label={`Select ${node.name}`} 
                    onClick={(event) => { event.stopPropagation(); handleNodeClick(node); }} 
                    onPointerDown={(event) => handleNodePointerDown(event, node)} 
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleNodeClick(node); } }} 
                    className={`absolute w-[180px] cursor-grab rounded-xl border p-3 text-left shadow-xl transition active:cursor-grabbing ${isSelected ? "border-[#63e6e2]/80 bg-[#142f35] shadow-[0_0_30px_rgba(99,230,226,.14)]" : "border-white/10 bg-[#111a23] hover:border-white/25"} ${isCableStart ? "ring-2 ring-[#f5b74b]" : ""}`} 
                    style={{ left: node.x, top: node.y, opacity: showVlans && !vlanView.nodeMatches(node.id, vlanFilter) ? .25 : 1 }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0b2229] text-[#63e6e2]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-xs text-[#dce9e9]">{node.name}</span>
                        <span className="block truncate text-[10px] text-[#78909a]">{node.role}</span>
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 font-mono text-[9px] text-[#66818a]">
                      <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#63e6e2]" /> linked</span>
                      <span>{node.ports.length} ports</span>
                    </div>
                    {showVlans && <div className="mt-2 max-h-20 space-y-1 overflow-y-auto border-t border-white/10 pt-2 font-mono text-[9px] text-[#63e6e2]">{node.ports.map(port => { const info = vlanView.portInfo(node.id, port); const evidence = interfaceEvidence(sessions[node.id], port); const status = evidence.up ? 'Up' : 'Down'; const link = topology.links.find(link => link.from === node.id && link.fromPort === port || link.to === node.id && link.toPort === port); const peer = link && channelForwarding(sessions[link.from], link.fromPort, sessions[link.to], link.toPort); const bundle = peer?.configured ? peer.bundled ? 'Bundled' : `${peer.protocol} suspended` : undefined; const cabledTo = cabledPeer(topology, node.id, port); const identity = { portIp: evidence.address, deviceMac: modeledDeviceMac(node.id), cabledDeviceIp: cabledPeerAddress(topology, sessions, node.id, port), cabledDeviceMac: cabledPeerMac(topology, node.id, port), vlanSvi: vlanSvi(topology, sessions, info.vlan) }; return <div key={port} aria-label={`${node.name} ${port}: cabled to ${cabledTo}, ${info.label}, ${status}${bundle ? `, ${bundle}` : ''}`} onMouseEnter={event => vlanHover.show(event, portHoverContent(node.name, port, info, status, bundle, cabledTo, identity))} onMouseMove={vlanHover.move} onMouseLeave={vlanHover.hide} style={{ opacity: info.matches(vlanFilter) ? 1 : .25 }}>{port} · {info.label}</div>; })}</div>}
                  </div>
                );
              })}
              {topology.nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Network className="mx-auto h-8 w-8 text-[#3b55c]" />
                    <p className="mt-3 text-sm text-[#6f8188]">Blank canvas. Add a device from the palette.</p>
                  </div>
                </div>
              )}
            </div>
          </div>}
          </div>
          {vlanHover.tooltip}

          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_320px]">
            <div className="rounded-xl border border-white/10 bg-[#111a23] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="instrument-label text-[#63e6e2]">LINK INVENTORY</div>
                  <div className="mt-1 text-xs text-[#84969d]">Select a cable to inspect or remove it.</div>
                </div>
                <details className="relative group">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-white/10 bg-[#0d151e] px-3 py-2 text-[10px] text-[#b8c5c8]">Cable / connector <span className="text-[#63e6e2]">⌄</span></summary>
                  <div className="absolute right-0 z-10 mt-1 w-72 rounded-lg border border-white/10 bg-[#101a23] p-2 shadow-2xl">
                    <select value={selectedCableId} onChange={(event) => setSelectedCableId(event.target.value)} className="w-full rounded border border-white/10 bg-[#0d151e] px-2 py-2 text-[10px] text-[#b8c5c8] outline-none" aria-label="Cable type">
                      {NETWORK_CABLES.map((cable) => <option key={cable.id} value={cable.id}>{cable.name}</option>)}
                    </select>
                    {(() => { const cable = NETWORK_CABLES.find((item) => item.id === selectedCableId); return cable ? <p className="mt-2 text-[10px] leading-4 text-[#82979e]">{cable.connector} · {cable.description}</p> : null; })()}
                  </div>
                </details>
                {selectedLinkId && (
                  <Button variant="outline" size="sm" className="border-[#f07178]/35 bg-transparent text-[#f07178] hover:bg-[#f07178]/10" onClick={removeSelectedLink}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove cable
                  </Button>
                )}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {topology.links.map((link) => {
                  const from = nodeMap.get(link.from);
                  const to = nodeMap.get(link.to);
                  return (
                    <button type="button" key={link.id} onClick={() => setSelectedLinkId(link.id)} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-[10px] ${selectedLinkId === link.id ? "border-[#f5b74b]/45 bg-[#f5b74b]/10" : "border-white/10 bg-[#0d151e] hover:border-white/20"}`}>
                      <span className="min-w-0 truncate font-mono text-[#b2c1c3]">{from?.name} <span className="text-[#63e6e2]">{link.fromPort} ↔ {link.toPort}</span> {to?.name}</span>
                      <span className="ml-2 flex shrink-0 items-center gap-1 text-[#63e6e2]"><span className="h-1.5 w-1.5 rounded-full bg-[#63e6e2]" /> up</span>
                    </button>
                  );
                })}
                {topology.links.length === 0 && <div className="text-xs text-[#6f8188]">No links yet. Choose Cable, then select two devices.</div>}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#111a23] p-4">
              <div className="instrument-label">DEVICE / PORT INSPECTOR</div>
              {selection.length > 1 ? (
                <>
                  <div className="mt-2 font-mono text-sm text-[#f5b74b]">{selection.length} objects selected</div>
                  <div className="mt-2 space-y-1 text-[10px] text-[#9aadb1]">
                    {selection.map((item) => {
                      const node = item.kind === "node" ? nodeMap.get(item.id) : null;
                      const link = item.kind === "link" ? topology.links.find((candidate) => candidate.id === item.id) : null;
                      return <div key={`${item.kind}-${item.id}`} className="rounded border border-white/10 bg-[#0d151e] px-2 py-1.5">{node ? `${node.name} · ${node.kind}` : link ? `Cable · ${NETWORK_CABLES.find((cable) => cable.id === link.cableId)?.name || "Ethernet"}` : item.id}</div>;
                    })}
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-[#82979e]">Ctrl/Cmd-click objects to add or remove them from the selection. Select one device and one cable to inspect their relationship.</p>
                  <div className="mt-3 rounded border border-[#f5b74b]/20 bg-[#f5b74b]/5 px-2 py-2 text-[10px] leading-4 text-[#d8bd7a]">Physical cabling and IOS configuration are separate state machines. Use the IOS console for interface, VLAN, trunk, and shutdown commands; the simulator will not invent a non-Cisco cable-assignment command.</div>
                </>
              ) : selectedNode ? (
                <TabbedInspector
                  node={selectedNode}
                  session={selectedSession!}
                  topology={topology}
                  selectedPort={selectedPort}
                  onSelectPort={handlePortSelect}
                  onOpenConsole={() => setShowTerminal(true)}
                />
              ) : selectedLinkId ? (() => {
                const link = topology.links.find((item) => item.id === selectedLinkId);
                const from = link ? nodeMap.get(link.from) : null;
                const to = link ? nodeMap.get(link.to) : null;
                const cable = link ? NETWORK_CABLES.find((item) => item.id === link.cableId) : null;
                return link ? <>
                  <div className="mt-2 font-mono text-sm text-[#63e6e2]">Cable connection</div>
                  <p className="mt-2 text-xs text-[#b8c5c8]">{cable?.name || "Ethernet"}</p>
                  <p className="mt-1 text-[10px] text-[#82979e]">{from?.name} · {link.fromPort} ↔ {to?.name} · {link.toPort}</p>
                  <p className="mt-2 text-[10px] leading-4 text-[#82979e]">{cable?.description || "Modeled Ethernet connection."}</p>
                </> : <p className="mt-2 text-xs text-[#758890]">Select an object to inspect its current state.</p>;
              })() : (
                <p className="mt-2 text-xs text-[#758890]">Select an object to inspect its current state.</p>
              )}
            </div>
          </div>
        </section>

                {/* Right Panel: Lab Instructions */}
        <aside className={`relative border-l border-white/10 bg-[#0d151e] lg:sticky lg:top-4 lg:max-h-[calc(100vh-7.5rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:min-h-[calc(100vh-118px)] ${missionCollapsed ? "p-2" : "p-4"}`}>
          <div className="mb-5 flex items-center justify-between">
            <div className={missionCollapsed ? "hidden" : ""}>
              <div className="instrument-label">MISSION BRIEF</div>
              <div className="mt-1 text-sm text-[#b8c5c8]">Guided Objectives</div>
            </div>
            {missionCollapsed ? <BookOpen className="mx-auto h-4 w-4 text-[#f5b74b]" /> : <button type="button" onClick={() => setMissionCollapsed(true)} className="rounded p-1 text-[#71828a] hover:bg-white/10 hover:text-white" aria-label="Minimize mission brief panel"><PanelRightClose className="h-4 w-4" /></button>}
          </div>
          {missionCollapsed && <button type="button" onClick={() => setMissionCollapsed(false)} className="absolute inset-x-2 top-14 rounded border border-white/10 p-1.5 text-[#f5b74b] hover:bg-[#2d2518]" aria-label="Expand mission brief panel"><PanelRightClose className="mx-auto h-4 w-4 rotate-180" /></button>}
          <div className={missionCollapsed ? "hidden" : ""}>
          <LearningWorkbench key={activeLabId} lab={{ ...config, topology: { devices: topology.nodes, links: topology.links } }} catalog={LAB_REGISTRY} sessions={sessions} step={stepIndex} mode={learningMode} onMode={setLearningMode} onRestore={(restored, index, restoredTopology) => { setPersisted(current => ({ ...current, sessions: restored, topology: { ...current.topology, nodes: restoredTopology.devices, links: restoredTopology.links } })); setStepIndex(index); setTerminalInput(''); }} />
          {config.rangeTargetId && <div className="mb-4"><RangeEvidencePanel targetId={config.rangeTargetId} terminal={Object.values(sessions).find(item => item?.terminalKind === 'attack')?.attackTerminal} /></div>}
          
          {currentStep?.exercise ? <div className="rounded-xl border border-[#63e6e2]/30 p-4 text-sm text-[#b9eeee]">{currentStep.label}<p className="mt-2">Complete the addressing worksheet above the viewport. No device selection is required for this step.</p></div> : learningMode !== 'guided' ? <div className="rounded-xl border border-[#63e6e2]/30 p-4 text-xs"><p>{config.description}</p><p className="mt-3">{gradeLab(config, sessions).passed ? 'All modeled configuration requirements are satisfied.' : 'Inspect the network and meet the requirements in the learning workspace. Commands may be entered in any order.'}</p></div> : config?.steps && config.steps.length > 0 ? (
            <div className="space-y-6">
              {stepIndex < config.steps.length ? (
                <>
                  {/* Current Step Area - Compact Stack */}
                  <div className="rounded-xl border border-[#f5b74b]/30 bg-[#f5b74b]/5 p-4">

                    {/* CURRENT COMMAND SECTION */}
                    <div className="mb-6">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-[#f5b74b] mb-1">{currentStep?.helpQuery ? 'Help to request:' : 'Current Command:'}</div>
                      <div className="font-mono text-lg font-bold text-[#63e6e2] bg-black/60 p-3 rounded border border-[#63e6e2]/30 shadow-inner">
                        {learningMode === 'guided' ? currentStep?.expectedCommand : config.description}
                      </div>
                      {currentStep?.helpQuery && <p className="mt-2 text-xs leading-5 text-[#b9eeee]">Type the full help query, including ?, then press Enter. Help does not change the configuration.</p>}
                      <button
                        type="button"
                        onClick={() => {
                          const target = topology.nodes.find((node) => node.name === currentStep?.targetDevice);
                          if (target) {
                            setSelectedId(target.id);
                            setShowTerminal(true);
                          }
                        }}
                        className="mt-3 flex w-full items-center justify-between rounded border border-[#63e6e2]/25 bg-[#10252b] px-3 py-2 text-left font-mono text-[10px] text-[#b9eeee] transition hover:border-[#63e6e2]/60 hover:bg-[#173038]"
                        aria-label={`Select ${currentStep?.targetDevice} for this objective`}
                      >
                        <span><span className="text-[#718b92]">RUN ON:</span> {currentStep?.targetDevice}</span>
                        <span className="text-[#63e6e2]">{currentStep?.requiredMode}</span>
                      </button>
                      <DeviceSelectionAlert activeDevice={selectedNode?.name} requiredDevice={currentStep?.targetDevice} />
                      <p className="mt-2 text-xs leading-5 text-[#aebbc0] italic">
                        {currentStep?.description}
                      </p>
                    </div>

                    {/* DIVIDER */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-px flex-1 bg-white/10"></div>
                      <div className="text-[9px] font-mono uppercase text-[#667a82]">Next Up</div>
                      <div className="h-px flex-1 bg-white/10"></div>
                    </div>

                    {/* NEXT COMMAND SECTION (Compact) */}
                    {stepIndex < (config.steps?.length ?? 0) - 1 ? (
                      <div className="bg-black/30 p-3 rounded border border-white/5">
                        <div className="font-mono text-sm font-medium text-white/70 mb-1">
                          {config.steps[stepIndex + 1]?.label}
                        </div>
                        <div className="font-mono text-xs text-[#63e6e2]/60">
                          {learningMode === 'guided' ? config.steps[stepIndex + 1]?.expectedCommand : 'Use the learning workspace to assess your configuration.'}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-2 text-[10px] font-mono text-[#667a82] italic">
                        Final objective in progress...
                      </div>
                    )}

                  </div>

                </>
              ) : (
                /* MISSION COMPLETE STATE */
                <div className="text-center py-10 rounded-xl border-2 border-dashed border-[#63e6e2]/30 bg-[#63e6e2]/5">
                  <div className="flex justify-center mb-4">
                    <div className="rounded-full bg-[#63e6e2] p-2 text-[#0b121a]">
                      <Check className="h-6 w-6" />
                    </div>
                  </div>
                  <div className="text-lg font-bold text-white">Mission Accomplished!</div>
                  <p className="mt-2 text-xs text-[#8fa0a7] px-4">All guided objectives for this scenario have been completed successfully.</p>
                  <Button size="sm" className="mt-6 bg-[#63e6e2] text-[#0b121a] hover:bg-[#4bc2be]" onClick={resetMission}>
                    Restart Mission
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="text-xs text-[#667a82]">No guided steps for this sandbox. Free-play mode enabled.</div>
            </div>
          )}
          {selectedNode && selectedSession && <div className="mt-5"><NetworkDeviceSchematic node={selectedNode} session={selectedSession} selectedPort={selectedPort} /></div>}
          </div>
          {!missionCollapsed && <button type="button" onPointerDown={(event) => { event.preventDefault(); resizeRef.current = { side: "mission", startX: event.clientX, startWidth: missionWidth }; }} className="absolute -left-2 top-0 z-30 hidden h-full w-4 cursor-col-resize items-center justify-center text-[#3b555c] hover:text-[#f5b74b] lg:flex" aria-label="Resize mission brief panel"><GripVertical className="h-5 w-5" /></button>}
        </aside>
      </div>

      {showTerminal && selectedNode && selectedSession && (
        <section className={`sticky bottom-0 z-20 flex flex-col border-t border-[#63e6e2]/25 bg-[#0b121a]/95 px-4 py-3 shadow-[0_-20px_50px_rgba(0,0,0,.45)] backdrop-blur lg:px-8 ${terminalMinimized ? "h-12" : ""}`} style={terminalMinimized ? undefined : { height: `${terminalHeight}px` }}>
          <button type="button" onPointerDown={(event) => { event.preventDefault(); resizeRef.current = { side: "terminal", startY: event.clientY, startHeight: terminalHeight }; }} className="absolute -top-3 inset-x-0 z-30 mx-auto flex h-6 w-24 cursor-row-resize items-center justify-center rounded-t border border-white/10 bg-[#101a23] text-[#536b73] hover:text-[#63e6e2]" aria-label="Resize IOS console"><GripVertical className="h-4 w-4 rotate-90" /></button>
          <div className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col">
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <SquareTerminal className="h-4 w-4 shrink-0 text-[#63e6e2]" />
                <span className="font-mono text-[10px] uppercase tracking-[.16em] text-[#738890]">{selectedSession.terminalKind === 'attack' ? 'ATTACK-CONSOLE /' : selectedIosReference ? 'IOS-SIM /' : 'DEVICE-SIM /'} {selectedNode.name}</span>
                <span className="hidden truncate text-[10px] text-[#53666e] sm:block">{selectedRole}</span>
                {selectedIosReference && <a href={selectedIosReference.url} target="_blank" rel="noopener noreferrer" className="hidden shrink-0 text-[10px] text-[#8fc9c8] underline underline-offset-2 hover:text-white lg:block" title="Official Cisco platform documentation; the simulator implements only a subset of commands">{selectedIosReference.label} reference</a>}
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden font-mono text-[10px] text-[#53666e] sm:block">{modePrompt(selectedNode.name, selectedSession)}</span>
                <button type="button" aria-expanded={commandHistoryOpen} onClick={() => setCommandHistoryOpen((open) => !open)} className="flex items-center gap-1.5 rounded border border-[#63e6e2]/25 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-[#b9eeee] transition hover:border-[#63e6e2]/60 hover:bg-[#173038]">
                  <History className="h-3.5 w-3.5" /> Command History
                </button>
                <button type="button" aria-expanded={!terminalMinimized} onClick={() => setTerminalMinimized((value) => !value)} className="flex items-center gap-1.5 rounded border border-[#f5b74b]/25 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-[#f4d998] transition hover:border-[#f5b74b]/60 hover:bg-[#2a2112]">
                  {terminalMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />} {terminalMinimized ? "Restore CLI" : "Minimize CLI"}
                </button>
                <button type="button" className="text-[#70838b] hover:text-white" onClick={() => setShowTerminal(false)} aria-label="Close IOS console">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {commandHistoryOpen && <div className="absolute right-10 top-full z-30 mt-2 max-h-80 w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-[#63e6e2]/30 bg-[#101923] p-3 shadow-2xl">
                <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="font-mono text-[10px] uppercase tracking-[.16em] text-[#63e6e2]">Command History · {selectedNode.name}</span>
                  <span className="font-mono text-[10px] text-[#778a92]">{activeCommandHistory.length}</span>
                </div>
                {activeCommandHistory.length
                  ? activeCommandHistory.map((command, index) => <div key={`${command}-${index}`} className="flex gap-3 border-b border-white/[.06] py-1.5 font-mono text-[10px] text-[#b5c2c6]"><span className="w-5 shrink-0 text-right text-[#667780]">{index + 1}</span><span>{command}</span></div>)
                  : <div className="py-3 text-xs text-[#778a92]">No commands entered on this device yet.</div>}
              </div>}
            </div>
            {!terminalMinimized && <div ref={terminalScrollbackRef} className="terminal-scrollback mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-auto rounded-lg border border-white/10 bg-[#080e14] p-3 font-mono text-[11px] leading-5" aria-label="Scrollable IOS terminal output" tabIndex={0}>
              {terminalLines.map((line, index) => (
                <div key={`${line}-${index}`} className={line.startsWith("%") ? "text-[#f07178]" : line.startsWith("Hint:") ? "text-[#f5b74b]" : line.startsWith("✓") ? "text-[#b5d4d4]" : "text-[#9fb1b5]"}>{line || "\u00a0"}</div>
              ))}
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[#63e6e2]">{modePrompt(selectedNode.name, selectedSession)}</span>
                <input 
                  autoFocus 
                  value={terminalInput} 
                  onChange={(event) => setTerminalInput(event.target.value)} 
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') submitTerminal();
                  }}
                  className="min-w-0 flex-1 bg-transparent text-[#edf4f3] outline-none placeholder:text-[#3f555d]" 
                  placeholder={selectedSession.terminalKind === 'attack' ? 'type a synthetic Linux range command...' : selectedIosReference ? 'type IOS command or ? for help, then press Enter...' : 'type a modeled device command...'}
                  aria-label={selectedSession.terminalKind === 'attack' ? 'Linux attack console command' : selectedIosReference ? 'IOS command' : 'Modeled device command'}
                />
              </div>
            </div>}
          </div>
        </section>
      )}
    </main>
  );
}
