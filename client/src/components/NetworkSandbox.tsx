import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { boot, modePrompt, nextMode, normalizeCommand, type Mode, type Session } from "@/lib/ios-engine";
import { Cable, Check, Copy, Hand, Monitor, MousePointer2, Network, PanelBottom, Plus, Router, Save, Share2, SquareTerminal, SwitchCamera, Trash2, X } from "lucide-react";

/** Packet Observatory design: the sandbox is a dark network instrument with cyan trace lines, amber task focus, and the IOS console as the operational dock. */

type DeviceKind = "pc" | "switch" | "router";
type Tool = "select" | "pan" | "cable";

type SandboxNode = {
  id: string;
  name: string;
  kind: DeviceKind;
  role: string;
  x: number;
  y: number;
  ports: string[];
};

type SandboxLink = {
  id: string;
  from: string;
  to: string;
  fromPort: string;
  toPort: string;
};

type Topology = {
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

const STORAGE_KEY = "ipv6-cli-lab-network-sandbox-v1";
const CANVAS_WIDTH = 1120;
const CANVAS_HEIGHT = 610;

const HQ_FACTORY_TEMPLATE: Topology = {
  name: "Headquarters → Factory to Foundation",
  description: "A reusable dual-site canvas for Construction Enterprises switching and routing practice.",
  nodes: [
    { id: "ce-hq-eng", name: "CE-HQ-ENG-PC1", kind: "pc", role: "Engineering endpoint", x: 70, y: 235, ports: ["eth0"] },
    { id: "ce-hq-dsw", name: "CE-HQ-DSW1", kind: "switch", role: "Headquarters distribution", x: 320, y: 180, ports: ["g0/1", "g0/2", "g0/3", "g0/4"] },
    { id: "ce-hq-r1", name: "CE-HQ-R1", kind: "router", role: "Headquarters edge router", x: 610, y: 90, ports: ["g0/0", "g0/1"] },
    { id: "ftf-acc", name: "FTF-FAB-ACC1", kind: "switch", role: "Factory access", x: 610, y: 340, ports: ["g0/1", "g0/2", "g0/3", "g0/4"] },
    { id: "ftf-prod", name: "FTF-PROD-PC1", kind: "pc", role: "Production endpoint", x: 910, y: 360, ports: ["eth0"] },
  ],
  links: [
    { id: "link-eng", from: "ce-hq-eng", to: "ce-hq-dsw", fromPort: "eth0", toPort: "g0/1" },
    { id: "link-core", from: "ce-hq-dsw", to: "ce-hq-r1", fromPort: "g0/2", toPort: "g0/0" },
    { id: "link-factory", from: "ce-hq-dsw", to: "ftf-acc", fromPort: "g0/3", toPort: "g0/1" },
    { id: "link-prod", from: "ftf-acc", to: "ftf-prod", fromPort: "g0/2", toPort: "eth0" },
  ],
};

const BLANK_TEMPLATE: Topology = {
  name: "Untitled Construction Network",
  description: "Start with a blank canvas and build a topology for the next CCNA objective.",
  nodes: [],
  links: [],
};

function cloneTopology(topology: Topology): Topology {
  return JSON.parse(JSON.stringify(topology)) as Topology;
}

function roleFor(kind: DeviceKind): string {
  if (kind === "pc") return "Construction Enterprises endpoint";
  if (kind === "router") return "Layer 3 routing device";
  return "Layer 2 switching device";
}

function portsFor(kind: DeviceKind): string[] {
  if (kind === "pc") return ["eth0"];
  if (kind === "router") return ["g0/0", "g0/1"];
  return ["g0/1", "g0/2", "g0/3", "g0/4"];
}

function iconFor(kind: DeviceKind) {
  if (kind === "pc") return Monitor;
  if (kind === "router") return Router;
  return SwitchCamera;
}

function initialPersisted(): PersistedSandbox {
  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as PersistedSandbox;
        if (parsed?.topology && Array.isArray(parsed.topology.nodes)) return parsed;
      } catch {
        // A malformed saved scenario should never prevent a clean sandbox from opening.
      }
    }
  }
  const topology = cloneTopology(HQ_FACTORY_TEMPLATE);
  return { topology, savedTopologies: [cloneTopology(topology)], sessions: Object.fromEntries(topology.nodes.map((node) => [node.id, boot(node.name, node.role)])) };
}

function isValidCommand(command: string, mode: Mode): boolean {
  if (command === "enable") return mode === "user";
  if (command === "configure terminal") return mode === "privileged";
  if (command === "end") return mode !== "user";
  if (command === "exit") return mode !== "user";
  if (mode === "user") return false;
  if (mode === "privileged") return /^(show |ping |traceroute |copy |write memory|terminal |clear )/.test(command);
  if (mode === "config") return /^(hostname |no ip domain-lookup$|ipv6 unicast-routing$|vlan \d+$|interface |router ospf |ip dhcp pool |line vty |ip access-list |spanning-tree |username |ip route |ipv6 route )/.test(command);
  if (mode === "vlan") return /^name /.test(command);
  if (mode === "interface-range") return /^(description |switchport |channel-group |spanning-tree |no shutdown$|shutdown$)/.test(command);
  if (mode === "interface" || mode === "subinterface") return /^(description |switchport |encapsulation |ip address |ipv6 address |spanning-tree |no shutdown$|shutdown$|channel-group )/.test(command);
  if (mode === "router") return /^(router-id |network |passive-interface |ipv6 router ospf |area |default-information )/.test(command);
  if (mode === "dhcp") return /^(network |default-router |dns-server |domain-name |ipv6 dhcp |exit$)/.test(command);
  if (mode === "line") return /^(login |password |transport input |exec-timeout |logging synchronous)/.test(command);
  if (mode === "acl") return /^(permit |deny |remark )/.test(command);
  return false;
}

function outputFor(command: string, node: SandboxNode, topology: Topology): string[] {
  if (command.startsWith("show ")) {
    if (command === "show vlan brief") return ["VLAN Name                             Status    Ports", "10   CE-HQ-ENGINEERING                active    ", "20   FTF-PRODUCTION                   active    ", "99   CE-NET-MANAGEMENT                active    ", "999  CE-NATIVE-BLACKHOLE              active    ", `✓ ${node.name} VLAN table rendered from the sandbox state.`];
    if (command === "show interfaces trunk") return ["Port        Mode         Encapsulation  Status        Native vlan", "Gi0/1       on           802.1q         trunking      999", `✓ ${topology.links.length} link(s) are modeled on the canvas.`];
    if (command === "show mac address-table") return ["          Mac Address Table", "Vlan    Mac Address       Type       Ports", "10      00d0.ba11.0010    DYNAMIC    Gi0/1", "20      00d0.ba11.0020    DYNAMIC    Gi0/2", "✓ MAC learning evidence is simulated for this sandbox topology."];
    if (command === "show ip interface brief") return ["Interface              IP-Address      OK? Method Status                Protocol", "GigabitEthernet0/0     192.168.10.1    YES manual up                    up", "GigabitEthernet0/0.20  192.168.20.1    YES manual up                    up", "✓ Interface inventory rendered."];
    return ["IOS verification output", `✓ ${command} inspected the ${node.name} sandbox session.`];
  }
  if (command.startsWith("ping ")) return ["Type escape sequence to abort.", "!!!!!", "Success rate is 100 percent (5/5)", "✓ Reachability is modeled across the connected sandbox path."];
  if (command.startsWith("copy ") || command === "write memory") return ["Building configuration...", "[OK]", "✓ Running configuration saved in the sandbox session."];
  return [`✓ ${command} accepted on ${node.name}.`];
}

export default function NetworkSandbox({ onExit }: { onExit: () => void }) {
  const [persisted, setPersisted] = useState<PersistedSandbox>(() => initialPersisted());
  const { topology, savedTopologies, sessions } = persisted;
  const [tool, setTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(topology.nodes[0]?.id ?? null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [cableStart, setCableStart] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(true);
  const [terminalInput, setTerminalInput] = useState("");
  const [notice, setNotice] = useState("Canvas ready");
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const selectedNode = topology.nodes.find((node) => node.id === selectedId) ?? null;
  const selectedSession = selectedNode ? sessions[selectedNode.id] : null;
  const selectedRole = selectedNode?.role ?? "Select a device to open its IOS console";
  const nodeMap = useMemo(() => new Map(topology.nodes.map((node) => [node.id, node])), [topology.nodes]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  }, [persisted]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!dragRef.current || !canvasRef.current) return;
      const bounds = canvasRef.current.getBoundingClientRect();
      const x = Math.max(12, Math.min(CANVAS_WIDTH - 190, event.clientX - bounds.left - dragRef.current.dx));
      const y = Math.max(12, Math.min(CANVAS_HEIGHT - 100, event.clientY - bounds.top - dragRef.current.dy));
      setPersisted((current) => ({ ...current, topology: { ...current.topology, nodes: current.topology.nodes.map((node) => node.id === dragRef.current?.id ? { ...node, x, y } : node) } }));
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  function selectTemplate(template: Topology) {
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

  function addDevice(kind: DeviceKind) {
    const prefix = kind === "pc" ? "CE-HQ-ENG-PC" : kind === "switch" ? "CE-HQ-DSW" : "CE-HQ-R";
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
    const link: SandboxLink = { id: `link-${Date.now()}`, from: firstId, to: secondId, fromPort: first.ports[Math.min(firstUsed, first.ports.length - 1)], toPort: second.ports[Math.min(secondUsed, second.ports.length - 1)] };
    setPersisted((current) => ({ ...current, topology: { ...current.topology, links: [...current.topology.links, link] } }));
    setCableStart(null);
    setNotice(`${first.name} ${link.fromPort} linked to ${second.name} ${link.toPort}`);
  }

  function handleNodeClick(node: SandboxNode) {
    setSelectedId(node.id);
    setSelectedLinkId(null);
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

  function removeSelectedLink() {
    if (!selectedLinkId) return;
    setPersisted((current) => ({ ...current, topology: { ...current.topology, links: current.topology.links.filter((link) => link.id !== selectedLinkId) } }));
    setSelectedLinkId(null);
    setNotice("Cable removed");
  }

  function resetCanvas() {
    selectTemplate(BLANK_TEMPLATE);
    setNotice("Blank canvas ready");
  }

  function submitTerminal(value = terminalInput) {
    if (!selectedNode || !selectedSession) return;
    const raw = value.trim();
    if (!raw) return;
    const command = normalizeCommand(raw);
    const prompt = modePrompt(selectedNode.name, selectedSession);
    const history = [...selectedSession.history, `${prompt} ${raw}`];
    if (!isValidCommand(command, selectedSession.mode)) {
      setPersisted((current) => ({ ...current, sessions: { ...current.sessions, [selectedNode.id]: { ...selectedSession, history: [...history, "% Invalid input detected at '^' marker.", `Hint: Current mode is ${selectedSession.mode}. Use the exact IOS command for this context.`] } } }));
      setTerminalInput("");
      return;
    }
    const transition = nextMode(command, selectedSession.mode);
    const nextSession: Session = { ...selectedSession, mode: transition.mode, context: transition.context, history: [...history, ...outputFor(command, selectedNode, topology)] };
    setPersisted((current) => ({ ...current, sessions: { ...current.sessions, [selectedNode.id]: nextSession } }));
    setTerminalInput("");
  }

  const linkLines = topology.links.map((link) => {
    const from = nodeMap.get(link.from);
    const to = nodeMap.get(link.to);
    if (!from || !to) return null;
    return { link, x1: from.x + 90, y1: from.y + 48, x2: to.x + 90, y2: to.y + 48, midX: (from.x + to.x) / 2 + 90, midY: (from.y + to.y) / 2 + 48 };
  }).filter(Boolean) as { link: SandboxLink; x1: number; y1: number; x2: number; y2: number; midX: number; midY: number }[];

  return <main className="min-h-screen bg-[#0a1017] text-[#edf4f3]">
    <header className="flex items-center justify-between border-b border-white/10 bg-[#0b1118]/95 px-5 py-4 lg:px-8"><div className="flex items-center gap-3"><button type="button" onClick={onExit} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#63e6e2]/35 bg-[#10252b] text-[#63e6e2]" aria-label="Back to curriculum"><Network className="h-5 w-5" /></button><div><div className="font-mono text-[10px] uppercase tracking-[.22em] text-[#63e6e2]">IPv6 CLI Lab</div><div className="font-display text-lg font-semibold">Network Sandbox</div></div></div><div className="hidden items-center gap-3 text-[10px] font-mono uppercase tracking-[.16em] text-[#84969d] sm:flex"><span>CONSTRUCTION ENTERPRISES</span><span className="h-1.5 w-1.5 rounded-full bg-[#63e6e2] shadow-[0_0_10px_#63e6e2]" /><span>TOPOLOGY WORKSPACE</span></div><button type="button" onClick={onExit} className="text-xs text-[#8ea0a7] hover:text-white">Back to curriculum</button></header>
    <div className="border-b border-white/10 bg-[#0d151e] px-5 py-3 lg:px-8"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-2"><div className="instrument-label shrink-0">SANDBOX / {notice}</div><div className="hidden h-px w-24 bg-gradient-to-r from-[#63e6e2] to-transparent md:block" /></div><div className="flex shrink-0 items-center gap-2"><Button variant="outline" size="sm" className="border-white/15 bg-transparent text-[#98aab0] hover:bg-white/10 hover:text-white" onClick={resetCanvas}><Plus className="mr-2 h-3.5 w-3.5" /> New canvas</Button><Button variant="outline" size="sm" className="border-white/15 bg-transparent text-[#98aab0] hover:bg-white/10 hover:text-white" onClick={saveScenario}><Save className="mr-2 h-3.5 w-3.5" /> Save</Button><Button size="sm" className="bg-[#f5b74b] text-[#1c160b] hover:bg-[#ffca69]" onClick={shareScenario}><Share2 className="mr-2 h-3.5 w-3.5" /> Share</Button></div></div></div>
    <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[244px_1fr]">
      <aside className="border-b border-white/10 bg-[#0d151e] p-4 lg:min-h-[calc(100vh-118px)] lg:border-b-0 lg:border-r"><div className="mb-5 flex items-center justify-between"><div><div className="instrument-label">WORKSPACE</div><div className="mt-1 text-sm text-[#b8c5c8]">Build a topology</div></div><MousePointer2 className="h-4 w-4 text-[#63e6e2]" /></div><div className="mb-5 grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-[#101a23] p-1"><button type="button" onClick={() => { setTool("select"); setCableStart(null); }} className={`rounded-md px-2 py-2 text-[10px] uppercase tracking-wider transition ${tool === "select" ? "bg-[#173038] text-[#63e6e2]" : "text-[#71828a] hover:text-white"}`}><MousePointer2 className="mx-auto mb-1 h-3.5 w-3.5" />Select</button><button type="button" onClick={() => setTool("pan")} className={`rounded-md px-2 py-2 text-[10px] uppercase tracking-wider transition ${tool === "pan" ? "bg-[#173038] text-[#63e6e2]" : "text-[#71828a] hover:text-white"}`}><Hand className="mx-auto mb-1 h-3.5 w-3.5" />Pan</button><button type="button" onClick={() => { setTool("cable"); setCableStart(null); }} className={`rounded-md px-2 py-2 text-[10px] uppercase tracking-wider transition ${tool === "cable" ? "bg-[#173038] text-[#63e6e2]" : "text-[#71828a] hover:text-white"}`}><Cable className="mx-auto mb-1 h-3.5 w-3.5" />Cable</button></div><div className="instrument-label mb-3">DEVICES</div><div className="space-y-2">{(["pc", "switch", "router"] as DeviceKind[]).map((kind) => { const Icon = iconFor(kind); const title = kind === "pc" ? "PC" : kind === "switch" ? "Switch" : "Router"; const detail = kind === "pc" ? "End host" : kind === "switch" ? "Layer 2 switching" : "Layer 3 routing"; return <button type="button" key={kind} onClick={() => addDevice(kind)} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#111c27] p-3 text-left transition hover:border-[#63e6e2]/40 hover:bg-[#173038]"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#10252b] text-[#63e6e2]"><Icon className="h-4 w-4" /></span><span><span className="block text-xs font-semibold text-white">{title}</span><span className="block text-[10px] text-[#778890]">{detail}</span></span><Plus className="ml-auto h-3.5 w-3.5 text-[#6b7d84]" /></button>; })}</div><div className="mt-6 border-t border-white/10 pt-5"><div className="instrument-label mb-3">SCENARIOS</div><button type="button" onClick={() => selectTemplate(HQ_FACTORY_TEMPLATE)} className="mb-2 w-full rounded-lg border border-[#63e6e2]/25 bg-[#10252b] px-3 py-2 text-left text-xs text-[#c5d2d3] hover:border-[#63e6e2]/60">Headquarters → Factory</button><button type="button" onClick={() => selectTemplate(BLANK_TEMPLATE)} className="mb-2 w-full rounded-lg border border-white/10 bg-[#111c27] px-3 py-2 text-left text-xs text-[#8ea0a7] hover:border-white/25 hover:text-white">Blank canvas</button>{savedTopologies.slice(0, 4).map((saved) => <button type="button" key={saved.name} onClick={() => selectTemplate(saved)} className="block w-full truncate px-3 py-1.5 text-left text-[10px] text-[#667a82] hover:text-[#c5d2d3]">↳ {saved.name}</button>)}</div><div className="mt-6 rounded-lg border border-[#f5b74b]/20 bg-[#f5b74b]/10 p-3 text-[10px] leading-5 text-[#d8bd7a]"><strong className="font-mono uppercase tracking-wider">How it works</strong><br />Select to move devices. Cable to connect two nodes. Select a device to open the shared IOS console dock.</div></aside>
      <section className="min-w-0 p-4 lg:p-6"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><div className="instrument-label text-[#f5b74b]">TOPOLOGY / {topology.name}</div><h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-white">{topology.name}</h1><p className="mt-1 max-w-2xl text-xs leading-5 text-[#8fa0a7]">{topology.description}</p></div><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[#6f8289]"><span>{topology.nodes.length} devices</span><span>·</span><span>{topology.links.length} links</span><span>·</span><span className="text-[#63e6e2]">{tool === "cable" ? cableStart ? "select destination" : "select cable start" : "select / drag"}</span></div></div><div className="overflow-auto rounded-xl border border-white/10 bg-[#080d13] shadow-2xl"><div ref={canvasRef} className="relative min-h-[610px] min-w-[1120px] overflow-hidden" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(99,230,226,.12) 1px, transparent 0)", backgroundSize: "24px 24px" }} onClick={() => { if (tool === "cable") { setCableStart(null); setNotice("Cable mode ready"); } else { setSelectedLinkId(null); } }}><div className="absolute left-5 top-5 font-mono text-[10px] uppercase tracking-[.2em] text-[#3b555c]">FIELD CANVAS / {topology.name}</div><svg className="pointer-events-none absolute inset-0" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} aria-label="Topology links">{linkLines.map(({ link, x1, y1, x2, y2, midX, midY }) => <g key={link.id}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={selectedLinkId === link.id ? "#f5b74b" : "#3ac9c6"} strokeWidth={selectedLinkId === link.id ? 3 : 2} strokeDasharray={selectedLinkId === link.id ? "8 5" : undefined} /><circle cx={x1} cy={y1} r="4" fill="#63e6e2" /><circle cx={x2} cy={y2} r="4" fill="#63e6e2" /><text x={midX} y={midY - 8} fill="#71878e" fontSize="9" textAnchor="middle" fontFamily="IBM Plex Mono, monospace">{link.fromPort} ↔ {link.toPort}</text></g>)}</svg>{topology.nodes.map((node) => { const Icon = iconFor(node.kind); const isSelected = selectedId === node.id; const isCableStart = cableStart === node.id; return <div key={node.id} role="button" tabIndex={0} aria-label={`Select ${node.name}`} onClick={(event) => { event.stopPropagation(); handleNodeClick(node); }} onPointerDown={(event) => handleNodePointerDown(event, node)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleNodeClick(node); } }} className={`absolute w-[180px] cursor-grab rounded-xl border p-3 text-left shadow-xl transition active:cursor-grabbing ${isSelected ? "border-[#63e6e2]/80 bg-[#142f35] shadow-[0_0_30px_rgba(99,230,226,.14)]" : "border-white/10 bg-[#111a23] hover:border-white/25"} ${isCableStart ? "ring-2 ring-[#f5b74b]" : ""}`} style={{ left: node.x, top: node.y }}><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0b2229] text-[#63e6e2]"><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate font-mono text-xs text-[#dce9e9]">{node.name}</span><span className="block truncate text-[10px] text-[#78909a]">{node.role}</span></span></div><div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 font-mono text-[9px] text-[#66818a]"><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#63e6e2]" /> linked</span><span>{node.ports.length} ports</span></div></div> })}{topology.nodes.length === 0 && <div className="absolute inset-0 flex items-center justify-center"><div className="text-center"><Network className="mx-auto h-8 w-8 text-[#3b555c]" /><p className="mt-3 text-sm text-[#6f8188]">Blank canvas. Add a device from the palette.</p></div></div>}</div></div><div className="mt-4 grid gap-4 xl:grid-cols-[1fr_320px]"><div className="rounded-xl border border-white/10 bg-[#111a23] p-4"><div className="flex items-center justify-between"><div><div className="instrument-label text-[#63e6e2]">LINK INVENTORY</div><div className="mt-1 text-xs text-[#84969d]">Select a cable to inspect or remove it.</div></div>{selectedLinkId && <Button variant="outline" size="sm" className="border-[#f07178]/35 bg-transparent text-[#f07178] hover:bg-[#f07178]/10" onClick={removeSelectedLink}><Trash2 className="mr-2 h-3.5 w-3.5" /> Remove cable</Button>}</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{topology.links.map((link) => { const from = nodeMap.get(link.from); const to = nodeMap.get(link.to); return <button type="button" key={link.id} onClick={() => setSelectedLinkId(link.id)} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-[10px] ${selectedLinkId === link.id ? "border-[#f5b74b]/45 bg-[#f5b74b]/10" : "border-white/10 bg-[#0d151e] hover:border-white/20"}`}><span className="min-w-0 truncate font-mono text-[#b2c1c3]">{from?.name} <span className="text-[#63e6e2]">{link.fromPort} ↔ {link.toPort}</span> {to?.name}</span><span className="ml-2 flex shrink-0 items-center gap-1 text-[#63e6e2]"><span className="h-1.5 w-1.5 rounded-full bg-[#63e6e2]" /> up</span></button>; })}{topology.links.length === 0 && <div className="text-xs text-[#6f8188]">No links yet. Choose Cable, then select two devices.</div>}</div></div><div className="rounded-xl border border-white/10 bg-[#111a23] p-4"><div className="instrument-label">SELECTED DEVICE</div>{selectedNode ? <><div className="mt-2 flex items-center gap-2"><div className="font-mono text-sm text-[#63e6e2]">{selectedNode.name}</div><span className="rounded bg-[#63e6e2]/10 px-1.5 py-0.5 text-[9px] uppercase text-[#8ed9d7]">{selectedNode.kind}</span></div><p className="mt-1 text-xs text-[#758890]">{selectedRole}</p><Button size="sm" className="mt-3 w-full bg-[#173038] text-[#9fe5e2] hover:bg-[#21454d]" onClick={() => setShowTerminal(true)}><PanelBottom className="mr-2 h-3.5 w-3.5" /> Open IOS console</Button></> : <p className="mt-2 text-xs text-[#758890]">Select a node to open its console.</p>}</div></div></section>
    </div>
    {showTerminal && selectedNode && selectedSession && <section className="sticky bottom-0 z-20 border-t border-[#63e6e2]/25 bg-[#0b121a]/95 px-4 py-3 shadow-[0_-20px_50px_rgba(0,0,0,.45)] backdrop-blur lg:px-8"><div className="mx-auto max-w-[1500px]"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><SquareTerminal className="h-4 w-4 shrink-0 text-[#63e6e2]" /><span className="font-mono text-[10px] uppercase tracking-[.16em] text-[#738890]">IOS-SIM / {selectedNode.name}</span><span className="hidden truncate text-[10px] text-[#53666e] sm:block">{selectedRole}</span></div><button type="button" className="text-[#70838b] hover:text-white" onClick={() => setShowTerminal(false)} aria-label="Close IOS console"><X className="h-4 w-4" /></button></div><div className="mt-2 flex max-h-40 flex-col gap-1 overflow-auto rounded-lg border border-white/10 bg-[#080e14] p-3 font-mono text-[11px] leading-5"><div className="text-[#637b83]">Full IOS vocabulary · shared console engine · enter one command, then press Enter.</div>{selectedSession.history.slice(-7).map((line, index) => <div key={`${line}-${index}`} className={line.startsWith("%") ? "text-[#f07178]" : line.startsWith("Hint:") ? "text-[#f5b74b]" : line.startsWith("✓") ? "text-[#b5d8d4]" : "text-[#9fb1b5]"}>{line || "\u00a0"}</div>)}<div className="mt-1 flex items-center gap-2"><span className="text-[#63e6e2]">{modePrompt(selectedNode.name, selectedSession)}</span><input autoFocus value={terminalInput} onChange={(event) => setTerminalInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submitTerminal()} className="min-w-0 flex-1 bg-transparent text-[#edf4f3] outline-none placeholder:text-[#3f555d]" placeholder="type full IOS command..." aria-label="IOS command" /></div></div></div></section>}
  </main>;
}
