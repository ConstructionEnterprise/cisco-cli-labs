import { ecosystemDevice, ecosystemPort, type EcosystemDeviceKind } from "@/lib/network-ecosystem";
import type { InterfaceState, Session } from "@/lib/ios-engine";
import type { PortRef } from "@/lib/network-topology";
import type { SandboxNode } from "@/components/NetworkSandbox";

type NetworkDeviceSchematicProps = {
  node: SandboxNode;
  session: Session;
  selectedPort: PortRef | null;
};

function portState(session: Session, port: string): InterfaceState {
  return session.interfaces[port] || {
    ipv4: [], ipv6: [], shutdown: true, commands: [], status: "down", speed: "1000", duplex: "full",
    errors: { crc: 0, collisions: 0 }, poe: { enabled: false, class: 0, wattage: 0, state: "searching" },
  };
}

function DeviceShape({ kind, ports, session, selectedPort }: { kind: EcosystemDeviceKind; ports: string[]; session: Session; selectedPort: PortRef | null }) {
  const isSelected = (port: string) => selectedPort?.port === port;
  const colorFor = (port: string) => portState(session, port).status === "up" ? "#63e6a5" : "#778a92";
  const portX = (index: number) => 34 + (index % 4) * 58;
  const portY = (index: number) => 89 + Math.floor(index / 4) * 24;

  if (kind === "pc" || kind === "server" || kind === "printer") {
    return <>
      <rect x="48" y="48" width="204" height="72" rx="9" fill={kind === "server" ? "#1a3141" : "#182830"} stroke="#63e6e2" strokeWidth="2" />
      <rect x="72" y="63" width="112" height="38" rx="4" fill="#081217" stroke="#b9eeee" />
      <path d="M88 87h79M88 80h54" stroke="#63e6e2" strokeWidth="2" />
      <path d="M130 120v10M104 130h52" stroke="#78949a" strokeWidth="3" />
      {ports.map((port, index) => <g key={port}><rect x={204 + index * 24} y="83" width="14" height="14" rx="2" fill="#101923" stroke={isSelected(port) ? "#f5b74b" : colorFor(port)} strokeWidth={isSelected(port) ? 3 : 2} /><circle cx={211 + index * 24} cy="90" r="3" fill={colorFor(port)} /></g>)}
    </>;
  }

  if (kind === "access-point") {
    return <><ellipse cx="150" cy="79" rx="84" ry="38" fill="#173038" stroke="#63e6e2" strokeWidth="2" /><path d="M116 82c18-22 50-22 68 0M128 94c11-12 33-12 44 0" fill="none" stroke="#b9eeee" strokeWidth="3" /><circle cx="150" cy="102" r="4" fill="#f5b74b" />{ports.map((port, index) => <rect key={port} x={204 + index * 24} y="72" width="14" height="14" rx="2" fill="#101923" stroke={isSelected(port) ? "#f5b74b" : colorFor(port)} strokeWidth={isSelected(port) ? 3 : 2} />)}</>;
  }

  const fill = kind === "firewall" ? "#4a321d" : kind === "router" ? "#19394a" : "#173038";
  return <>
    <rect x="25" y="47" width="250" height="86" rx="10" fill={fill} stroke="#63e6e2" strokeWidth="2" />
    <path d="M42 69h216M42 113h216" stroke="#31545d" />
    <text x="150" y="62" fill="#b9eeee" fontSize="9" textAnchor="middle" fontFamily="monospace">{kind === "firewall" ? "SECURITY APPLIANCE" : kind === "router" ? "LAYER 3 ROUTER" : "LAYER 2 SWITCH"}</text>
    {ports.map((port, index) => <g key={port}><rect x={portX(index)} y={portY(index)} width="28" height="13" rx="2" fill="#101923" stroke={isSelected(port) ? "#f5b74b" : colorFor(port)} strokeWidth={isSelected(port) ? 3 : 2} /><circle cx={portX(index) + 7} cy={portY(index) + 6.5} r="3" fill={colorFor(port)} /><text x={portX(index) + 16} y={portY(index) + 9} fill="#b9eeee" fontSize="6" textAnchor="middle" fontFamily="monospace">{port.replace("ethernet", "e")}</text></g>)}
  </>;
}

export default function NetworkDeviceSchematic({ node, session, selectedPort }: NetworkDeviceSchematicProps) {
  const device = ecosystemDevice(node.kind);
  const upPorts = node.ports.filter((port) => portState(session, port).status === "up").length;
  const addresses = Object.entries(session.interfaces).flatMap(([port, state]) => state.ipv4.map((address) => `${port} ${address}`));

  return <div className="rounded-xl border border-[#29424a] bg-[#101923] p-4">
    <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[#63e6e2]">Device Schematic</div>
    <div className="mt-2 flex items-baseline justify-between gap-2"><h2 className="font-display text-lg font-semibold text-white">{node.name}</h2><span className="font-mono text-[9px] uppercase text-[#f5b74b]">{device.name}</span></div>
    <p className="mt-1 text-xs leading-5 text-[#778a92]">{node.role} · {device.description}</p>
    <svg viewBox="0 0 300 160" className="mt-3 h-40 w-full" role="img" aria-label={`${node.name} device schematic`}>
      <rect x="1" y="1" width="298" height="158" rx="10" fill="#0b151d" stroke="#29424a" />
      <text x="16" y="20" fill="#b9eeee" fontSize="9" fontFamily="monospace" letterSpacing="2">{node.name} / PORT MAP</text>
      <DeviceShape kind={node.kind} ports={node.ports} session={session} selectedPort={selectedPort} />
      <text x="150" y="151" fill="#778a92" fontSize="8" textAnchor="middle" fontFamily="monospace">{upPorts}/{node.ports.length} PORTS UP · {node.mountType || "floor"} MOUNT</text>
    </svg>
    <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-[#9eb1b5]">
      <div className="rounded border border-white/10 bg-[#0d151e] p-2"><span className="text-[#71858d]">Dimensions</span><br /><b className="text-white">{device.dimensions.length} × {device.dimensions.width} × {device.dimensions.height} {device.dimensions.unit}</b></div>
      <div className="rounded border border-white/10 bg-[#0d151e] p-2"><span className="text-[#71858d]">Interfaces</span><br /><b className="text-[#63e6a5]">{upPorts} up / {node.ports.length} total</b></div>
    </div>
    <div className="mt-2 rounded border border-white/10 bg-[#0d151e] px-2 py-2 font-mono text-[9px] text-[#82979e]">{addresses.length ? addresses.join(" · ") : "No interface addresses configured."}</div>
  </div>;
}
