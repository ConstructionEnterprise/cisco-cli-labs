/** Packet Observatory shared IOS model: one prompt, one mode machine, reused by curriculum labs and the free topology sandbox. */

export type Mode = "user" | "privileged" | "config" | "vlan" | "interface" | "interface-range" | "subinterface" | "router" | "dhcp" | "line" | "acl";

export type Session = {
  mode: Mode;
  context: string | null;
  history: string[];
};

export function boot(name: string, role: string): Session {
  return {
    mode: "user",
    context: null,
    history: [
      "Cisco IOS Software, CCNA Lab Simulator",
      `${name} · ${role}`,
      "Full IOS vocabulary · enter one command, then press Enter.",
    ],
  };
}

export function normalizeCommand(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function modePrompt(name: string, session: Session): string {
  if (session.mode === "user") return `${name}>`;
  if (session.mode === "privileged") return `${name}#`;
  if (session.mode === "config") return `${name}(config)#`;
  if (session.mode === "vlan") return `${name}(config-vlan)#`;
  if (session.mode === "interface-range") return `${name}(config-if-range)#`;
  if (session.mode === "subinterface") return `${name}(config-subif)#`;
  if (session.mode === "router") return `${name}(config-router)#`;
  if (session.mode === "dhcp") return `${name}(config-dhcp)#`;
  if (session.mode === "line") return `${name}(config-line)#`;
  if (session.mode === "acl") return `${name}(config-ext-nacl)#`;
  return `${name}(config-if)#`;
}

export function nextMode(command: string, current: Mode): { mode: Mode; context: string | null } {
  if (command === "enable") return { mode: "privileged", context: null };
  if (command === "configure terminal") return { mode: "config", context: null };
  if (command === "end") return { mode: "privileged", context: null };
  if (command === "exit") {
    if (current === "config") return { mode: "privileged", context: null };
    if (current === "privileged" || current === "user") return { mode: current, context: null };
    return { mode: "config", context: null };
  }
  if (command.startsWith("vlan ")) return { mode: "vlan", context: command.slice(5) };
  if (command.startsWith("interface range ")) return { mode: "interface-range", context: command.slice(16) };
  if (command.startsWith("interface ")) return { mode: command.includes(".") ? "subinterface" : "interface", context: command.slice(10) };
  if (command.startsWith("router ospf ")) return { mode: "router", context: command };
  if (command.startsWith("ip dhcp pool ")) return { mode: "dhcp", context: command };
  if (command.startsWith("line vty ")) return { mode: "line", context: command };
  if (command.startsWith("ip access-list ")) return { mode: "acl", context: command };
  return { mode: current, context: null };
}
