/** Packet Observatory shared IOS model: one prompt, one mode machine, reused by curriculum labs and the free topology sandbox. */

export type Mode = "user" | "privileged" | "config" | "vlan" | "interface" | "interface-range" | "subinterface" | "router" | "dhcp" | "line" | "acl";

export type Session = {
  mode: Mode;
  context: string | null;
  history: string[];
  runningConfig: string[];
  startupConfig: string[];
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
    runningConfig: [],
    startupConfig: [],
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

export function nextMode(command: string, current: Mode, currentContext: string | null = null): { mode: Mode; context: string | null } {
  const trimmed = command.trim().replace(/\s+/g, " ");
  const normalized = normalizeCommand(trimmed);
  if (normalized === "enable") return { mode: "privileged", context: null };
  if (normalized === "configure terminal") return { mode: "config", context: null };
  if (normalized === "end") return { mode: "privileged", context: null };
  if (normalized === "exit") {
    if (current === "config") return { mode: "privileged", context: null };
    if (current === "privileged" || current === "user") return { mode: current, context: null };
    return { mode: "config", context: null };
  }
  if (normalized.startsWith("vlan ")) return { mode: "vlan", context: trimmed.slice(5) };
  if (normalized.startsWith("interface range ")) return { mode: "interface-range", context: trimmed.slice(16) };
  if (normalized.startsWith("interface ")) return { mode: normalized.includes(".") ? "subinterface" : "interface", context: trimmed.slice(10) };
  if (normalized.startsWith("router ospf ")) return { mode: "router", context: trimmed };
  if (normalized.startsWith("ip dhcp pool ")) return { mode: "dhcp", context: trimmed };
  if (normalized.startsWith("line vty ")) return { mode: "line", context: trimmed };
  if (normalized.startsWith("ip access-list ")) return { mode: "acl", context: trimmed };
  return { mode: current, context: currentContext };
}
