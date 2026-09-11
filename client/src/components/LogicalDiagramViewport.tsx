import { useEffect, useRef } from "react";
import { Download, ImageDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ecosystemDevice, NETWORK_CABLES } from "@/lib/network-ecosystem";
import type { Session } from "@/lib/ios-engine";
import type { PortRef, SelectionRef } from "@/lib/network-topology";
import type { SandboxLink, SandboxNode, Topology } from "@/components/NetworkSandbox";

const WIDTH = 1120;
const HEIGHT = 610;
const DEVICE_WIDTH = 188;
const DEVICE_HEIGHT = 112;

type LogicalDiagramViewportProps = {
  topology: Topology;
  sessions: Record<string, Session>;
  selection: SelectionRef[];
  onSelectNode: (node: SandboxNode, additive: boolean) => void;
  onSelectPort: (ref: PortRef) => void;
  onSelectLink: (link: SandboxLink, additive: boolean) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  snapToGrid: boolean;
};

function selected(selection: SelectionRef[], kind: SelectionRef["kind"], id: string) {
  return selection.some((item) => item.kind === kind && item.id === id);
}

function portPosition(node: SandboxNode, port: string): [number, number] {
  const index = Math.max(0, node.ports.indexOf(port));
  const x = node.x + 18 + (index % 4) * 38;
  const y = node.y + DEVICE_HEIGHT - (Math.floor(index / 4) * 18 + 18);
  return [x, y];
}

function portState(node: SandboxNode, port: string, sessions: Record<string, Session>) {
  return sessions[node.id]?.interfaces[port];
}

function portColor(node: SandboxNode, port: string, sessions: Record<string, Session>) {
  const state = portState(node, port, sessions);
  if (state?.channelGroup) return "#4b9dff";
  if (state?.switchportMode === "trunk") return "#bf72ff";
  if (state?.status === "up" || state?.shutdown === false || state?.accessVlan) return "#63e6a5";
  return "#60747c";
}

function linkColor(from: SandboxNode, fromPort: string, to: SandboxNode, toPort: string, sessions: Record<string, Session>) {
  const fromState = portState(from, fromPort, sessions);
  const toState = portState(to, toPort, sessions);
  if (fromState?.channelGroup || toState?.channelGroup) return "#4b9dff";
  if (fromState?.switchportMode === "trunk" || toState?.switchportMode === "trunk") return "#bf72ff";
  if (fromState?.status === "up" || toState?.status === "up" || fromState?.shutdown === false || toState?.shutdown === false) return "#63e6a5";
  return "#60747c";
}

function deviceStatus(node: SandboxNode, sessions: Record<string, Session>) {
  const states = node.ports.map((port) => portState(node, port, sessions));
  const upCount = states.filter((state) => state?.status === "up" || state?.shutdown === false).length;
  if (upCount === 0) return { color: "#f06060", label: "OFFLINE" };
  if (upCount < states.length) return { color: "#f5b74b", label: "PARTIAL" };
  return { color: "#63e6a5", label: "UP" };
}

export default function LogicalDiagramViewport({ topology, sessions, selection, onSelectNode, onSelectPort, onSelectLink, onMoveNode, snapToGrid }: LogicalDiagramViewportProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const nodes = new Map(topology.nodes.map((node) => [node.id, node]));

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!dragRef.current || !svgRef.current) return;
      const bounds = svgRef.current.getBoundingClientRect();
      const scaleX = WIDTH / bounds.width;
      const scaleY = HEIGHT / bounds.height;
      const rawX = Math.max(12, Math.min(WIDTH - DEVICE_WIDTH - 12, (event.clientX - bounds.left) * scaleX - dragRef.current.dx));
      const rawY = Math.max(48, Math.min(HEIGHT - DEVICE_HEIGHT - 24, (event.clientY - bounds.top) * scaleY - dragRef.current.dy));
      const x = snapToGrid ? Math.round(rawX / 24) * 24 : rawX;
      const y = snapToGrid ? Math.round(rawY / 24) * 24 : rawY;
      onMoveNode(dragRef.current.id, x, y);
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [onMoveNode, snapToGrid]);

  function exportSvg() {
    if (!svgRef.current) return;
    const serialized = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${topology.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-logical-diagram.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportPng() {
    if (!svgRef.current) return;
    const serialized = new XMLSerializer().serializeToString(svgRef.current);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = WIDTH * 2;
      canvas.height = HEIGHT * 2;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(2, 2);
      context.fillStyle = "#081119";
      context.fillRect(0, 0, WIDTH, HEIGHT);
      context.drawImage(image, 0, 0, WIDTH, HEIGHT);
      const anchor = document.createElement("a");
      anchor.href = canvas.toDataURL("image/png");
      anchor.download = `${topology.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-logical-diagram.png`;
      anchor.click();
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#29424a] bg-[#071017] shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#101a23] px-4 py-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[.16em] text-[#63e6e2]">Logical Diagram / Port Map</div>
          <div className="mt-1 text-[10px] text-[#82979e]">CLI-driven logical state · scroll to navigate · drag devices to reposition</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportSvg} className="border-white/15 bg-transparent text-[#b8c5c8] hover:bg-white/10"><Download className="mr-2 h-3.5 w-3.5" />SVG</Button>
          <Button variant="outline" size="sm" onClick={exportPng} className="border-[#63e6e2]/30 bg-transparent text-[#63e6e2] hover:bg-[#63e6e2]/10"><ImageDown className="mr-2 h-3.5 w-3.5" />PNG</Button>
        </div>
      </div>
      <div className="max-w-full overflow-auto">
      <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[610px] min-w-[1120px] w-full" role="img" aria-label="Logical network diagram">
        <defs>
          <pattern id="logical-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#173139" strokeWidth="1" /></pattern>
          <filter id="logical-glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="#071017" />
        <rect width={WIDTH} height={HEIGHT} fill="url(#logical-grid)" opacity=".8" />
        <text x="24" y="32" fill="#6e8c94" fontFamily="monospace" fontSize="10" letterSpacing="2">CONSTRUCTION ENTERPRISES / LOGICAL NETWORK VIEW</text>
        {topology.links.map((link) => {
          const from = nodes.get(link.from);
          const to = nodes.get(link.to);
          if (!from || !to) return null;
          const [x1, y1] = portPosition(from, link.fromPort);
          const [x2, y2] = portPosition(to, link.toPort);
          const linkSelected = selected(selection, "link", link.id);
          const color = linkSelected ? "#ff9d4d" : linkColor(from, link.fromPort, to, link.toPort, sessions);
          const labelX = (x1 + x2) / 2;
          const labelY = (y1 + y2) / 2 - 8;
          return <g key={link.id} onClick={(event) => { event.stopPropagation(); onSelectLink(link, event.ctrlKey || event.metaKey); }} className="cursor-pointer">
            <path d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={linkSelected ? 5 : 3} opacity=".95" filter={linkSelected ? "url(#logical-glow)" : undefined} />
            <circle cx={x1} cy={y1} r={linkSelected ? 7 : 5} fill="#071017" stroke={color} strokeWidth="2" />
            <circle cx={x2} cy={y2} r={linkSelected ? 7 : 5} fill="#071017" stroke={color} strokeWidth="2" />
            <rect x={labelX - 92} y={labelY - 10} width="184" height="16" rx="4" fill="#071017" opacity=".92" />
            <text x={labelX} y={labelY + 1} fill="#c5d6d8" fontFamily="monospace" fontSize="9" textAnchor="middle">{link.fromPort} &lt;-&gt; {link.toPort} - {NETWORK_CABLES.find((cable) => cable.id === link.cableId)?.name || "Ethernet"}</text>
          </g>;
        })}
        {topology.nodes.map((node) => {
          const device = ecosystemDevice(node.kind);
          const status = deviceStatus(node, sessions);
          const nodeSelected = selected(selection, "node", node.id);
          return <g key={node.id} onClick={(event) => { event.stopPropagation(); onSelectNode(node, event.ctrlKey || event.metaKey); }} onPointerDown={(event) => { event.stopPropagation(); const bounds = svgRef.current?.getBoundingClientRect(); if (!bounds) return; const scaleX = WIDTH / bounds.width; const scaleY = HEIGHT / bounds.height; dragRef.current = { id: node.id, dx: (event.clientX - bounds.left) * scaleX - node.x, dy: (event.clientY - bounds.top) * scaleY - node.y }; }} className="cursor-move">
            <rect x={node.x} y={node.y} width={DEVICE_WIDTH} height={DEVICE_HEIGHT} rx="10" fill={nodeSelected ? "#503619" : "#111f2a"} stroke={nodeSelected ? "#ff9d4d" : "#2e5860"} strokeWidth={nodeSelected ? 3 : 1.5} />
            <text x={node.x + 14} y={node.y + 22} fill="#e9f6f3" fontFamily="monospace" fontSize="13">{node.name}</text>
            <text x={node.x + 14} y={node.y + 40} fill="#7f9aa1" fontFamily="sans-serif" fontSize="10">{device.defaultRole}</text>
            <circle cx={node.x + DEVICE_WIDTH - 42} cy={node.y + 18} r="5" fill={status.color} />
            <text x={node.x + DEVICE_WIDTH - 32} y={node.y + 22} fill={status.color} fontFamily="monospace" fontSize="8">{status.label}</text>
            {node.ports.map((port) => { const [px, py] = portPosition(node, port); const color = portColor(node, port, sessions); const isSelected = selectedPort(selection, node.id, port); return <g key={port} onClick={(event) => { event.stopPropagation(); onSelectPort({ nodeId: node.id, port }); }} className="cursor-pointer"><circle cx={px} cy={py} r="10" fill={color} opacity=".16" /><rect x={px - 7} y={py - 7} width="14" height="14" rx="2" fill={color} stroke={isSelected ? "#ff9d4d" : "#dce9e9"} strokeWidth={isSelected ? 3 : 1} /><text x={px} y={py + 20} fill="#d2e0e1" fontFamily="monospace" fontSize="8" textAnchor="middle">{port}</text></g>; })}
          </g>;
        })}
        {topology.links.map((link) => {
          const from = nodes.get(link.from);
          const to = nodes.get(link.to);
          if (!from || !to) return null;
          const [x1, y1] = portPosition(from, link.fromPort);
          const [x2, y2] = portPosition(to, link.toPort);
          const color = selected(selection, "link", link.id) ? "#ff9d4d" : linkColor(from, link.fromPort, to, link.toPort, sessions);
          return <g key={`${link.id}-port-leads`} pointerEvents="none">
            <line x1={x1} y1={y1} x2={x1} y2={from.y + DEVICE_HEIGHT} stroke="#071017" strokeWidth="7" opacity=".95" />
            <line x1={x1} y1={y1} x2={x1} y2={from.y + DEVICE_HEIGHT} stroke={color} strokeWidth="2" opacity=".95" />
            <line x1={x2} y1={y2} x2={x2} y2={to.y + DEVICE_HEIGHT} stroke="#071017" strokeWidth="7" opacity=".95" />
            <line x1={x2} y1={y2} x2={x2} y2={to.y + DEVICE_HEIGHT} stroke={color} strokeWidth="2" opacity=".95" />
            <circle cx={x1} cy={y1} r="5" fill="#071017" stroke={color} strokeWidth="2" />
            <circle cx={x2} cy={y2} r="5" fill="#071017" stroke={color} strokeWidth="2" />
          </g>;
        })}
        <g transform="translate(24 570)"><circle cx="6" cy="-3" r="5" fill="#63e6a5" /><text x="18" y="1" fill="#82979e" fontFamily="monospace" fontSize="9">UP / ACCESS</text><circle cx="112" cy="-3" r="5" fill="#bf72ff" /><text x="124" y="1" fill="#82979e" fontFamily="monospace" fontSize="9">TRUNK</text><circle cx="195" cy="-3" r="5" fill="#4b9dff" /><text x="207" y="1" fill="#82979e" fontFamily="monospace" fontSize="9">ETHERCHANNEL</text><circle cx="322" cy="-3" r="5" fill="#60747c" /><text x="334" y="1" fill="#82979e" fontFamily="monospace" fontSize="9">DOWN</text><text x="414" y="1" fill="#526e76" fontFamily="monospace" fontSize="9">PORT-ANCHORED LINKS / IOS SESSION STATE</text></g>
        <text x="1096" y="590" fill="#526e76" fontFamily="monospace" fontSize="8" textAnchor="end">CONSTRUCTION ENTERPRISES – LOGICAL NETWORK DIAGRAM | REV 1.0 | GENERATED BY CE CISCO SANDBOX</text>
      </svg>
      </div>
    </div>
  );
}

function selectedPort(selection: SelectionRef[], nodeId: string, port: string) {
  return selection.some((item) => item.kind === "node" && item.id === nodeId) || selection.some((item) => item.kind === "port" && item.id === `${nodeId}:${port}`);
}
