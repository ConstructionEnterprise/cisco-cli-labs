export type EcosystemDeviceKind =
  | "pc"
  | "switch"
  | "router"
  | "server"
  | "access-point"
  | "modem"
  | "firewall"
  | "hub"
  | "console-server"
  | "printer";

export type CableDefinition = {
  id: string;
  name: string;
  connector: string;
  description: string;
  devices: EcosystemDeviceKind[];
  caveat?: string;
};

export type EcosystemPort = {
  id: string;
  type: "ethernet" | "fiber" | "console" | "serial" | "coax" | "wireless";
  speed?: string;
  role?: string;
};

export type EcosystemDevice = {
  id: string;
  name: string;
  kind: EcosystemDeviceKind;
  description: string;
  defaultRole: string;
  ports: string[];
  portDefinitions?: EcosystemPort[];
  tags?: string[];
  cables: string[];
  dimensions: { length: number; width: number; height: number; unit: "mm" };
};

export const NETWORK_CABLES: CableDefinition[] = [
  { id: "cat6", name: "Cat6 Copper", connector: "RJ-45", description: "Twisted-pair Ethernet for typical copper LAN links up to 100 m.", devices: ["pc", "server", "switch", "router", "access-point", "modem", "firewall", "hub", "console-server", "printer"] },
  { id: "smf", name: "Single-Mode Fiber", connector: "LC / SC / ST", description: "Long-distance fiber using a narrow light path.", devices: ["router", "switch", "server", "firewall"], caveat: "Requires compatible optics and ports; the cable alone does not create a link." },
  { id: "mmf", name: "Multi-Mode Fiber", connector: "LC / SC / ST", description: "Shorter-distance fiber for multimode optics.", devices: ["router", "switch", "server", "firewall"], caveat: "Requires compatible multimode optics at both ends." },
  { id: "rg6", name: "Coaxial RG-6", connector: "F-Type", description: "Coaxial medium commonly used for cable-provider handoffs.", devices: ["router", "modem"] },
  { id: "rollover", name: "Rollover Console Cable", connector: "RJ-45 / USB adapter", description: "Out-of-band console access to compatible network equipment.", devices: ["router", "switch", "console-server"], caveat: "Modern hardware often uses USB console instead of an RJ-45 console connector." },
  { id: "serial", name: "Serial WAN Cable", connector: "V.35 / DB", description: "Legacy point-to-point WAN medium.", devices: ["router"], caveat: "Legacy and platform-specific; not present on most modern routers." },
  { id: "crossover", name: "Ethernet Crossover", connector: "RJ-45", description: "Historically used between similar Ethernet devices without Auto-MDIX.", devices: ["pc", "switch", "router"], caveat: "Many modern interfaces support Auto-MDIX, so a straight-through cable may also work." },
];

export const NETWORK_DEVICES: EcosystemDevice[] = [
  { id: "pc", name: "PC / Laptop", kind: "pc", description: "End system with a host network stack.", defaultRole: "End host", ports: ["eth0"], cables: ["cat6", "crossover"], tags: ["endpoint", "host", "ethernet"], dimensions: { length: 340, width: 240, height: 45, unit: "mm" } },
  { id: "server", name: "Server", kind: "server", description: "High-resource host for services and applications.", defaultRole: "Network server", ports: ["eth0", "eth1"], cables: ["cat6", "smf", "mmf"], tags: ["endpoint", "server", "ethernet", "fiber"], dimensions: { length: 482, width: 550, height: 44, unit: "mm" } },
  { id: "switch", name: "Layer 2 Switch", kind: "switch", description: "MAC-learning Ethernet switch.", defaultRole: "Layer 2 switching device", ports: ["g0/1", "g0/2", "g0/3", "g0/4"], cables: ["cat6", "mmf", "smf", "rollover", "crossover"], tags: ["cisco", "layer2", "switch", "rack"], dimensions: { length: 445, width: 250, height: 44, unit: "mm" } },
  { id: "router", name: "Router", kind: "router", description: "Layer 3 device for inter-network routing.", defaultRole: "Layer 3 routing device", ports: ["g0/0", "g0/1", "console"], cables: ["cat6", "mmf", "smf", "rollover", "rg6", "serial", "crossover"], tags: ["cisco", "layer3", "routing", "wan"], dimensions: { length: 445, width: 300, height: 44, unit: "mm" } },
  { id: "access-point", name: "Wireless Access Point", kind: "access-point", description: "Bridges wireless clients to a wired network.", defaultRole: "Wireless access point", ports: ["eth0"], cables: ["cat6"], tags: ["wireless", "endpoint", "ethernet"], dimensions: { length: 180, width: 180, height: 35, unit: "mm" } },
  { id: "modem", name: "Cable / DSL Modem", kind: "modem", description: "Converts an ISP access medium into an Ethernet handoff.", defaultRole: "ISP edge modem", ports: ["wan", "eth0"], cables: ["rg6", "cat6"], tags: ["isp", "wan", "coax", "ethernet"], dimensions: { length: 190, width: 130, height: 35, unit: "mm" } },
  { id: "firewall", name: "Hardware Firewall", kind: "firewall", description: "Security appliance enforcing policy between zones.", defaultRole: "Security appliance", ports: ["outside", "inside", "dmz"], cables: ["cat6", "mmf", "smf"], tags: ["security", "layer3", "rack", "fiber"], dimensions: { length: 430, width: 260, height: 44, unit: "mm" } },
  { id: "hub", name: "Ethernet Hub", kind: "hub", description: "Legacy Layer 1 repeater that repeats traffic to all ports.", defaultRole: "Legacy Layer 1 repeater", ports: ["port1", "port2", "port3", "port4"], cables: ["cat6"], tags: ["legacy", "layer1", "ethernet"], dimensions: { length: 220, width: 120, height: 35, unit: "mm" } },
  { id: "console-server", name: "Console Server", kind: "console-server", description: "Provides remote out-of-band access to console ports.", defaultRole: "Out-of-band management", ports: ["eth0", "console1", "console2"], cables: ["cat6", "rollover"], tags: ["management", "console", "out-of-band"], dimensions: { length: 280, width: 180, height: 44, unit: "mm" } },
  { id: "printer", name: "Network Printer", kind: "printer", description: "Network printer endpoint for a dedicated services VLAN.", defaultRole: "Shared network printer", ports: ["eth0"], cables: ["cat6"], tags: ["endpoint", "printer", "ethernet"], dimensions: { length: 420, width: 400, height: 250, unit: "mm" } },
];

export function ecosystemDevice(kind: EcosystemDeviceKind): EcosystemDevice {
  return NETWORK_DEVICES.find((device) => device.kind === kind) || NETWORK_DEVICES[0];
}

export function ecosystemPort(device: EcosystemDevice, portId: string): EcosystemPort {
  const defined = device.portDefinitions?.find((port) => port.id === portId);
  if (defined) return defined;
  const type = portId.toLowerCase().includes("console") ? "console" : portId.toLowerCase().includes("wan") ? "coax" : "ethernet";
  return { id: portId, type, speed: type === "ethernet" ? "1G" : undefined, role: type === "console" ? "management" : "data" };
}
