import type { EcosystemDeviceKind } from "@/lib/network-ecosystem";

export type DeviceCapability = "vlan" | "trunk" | "etherchannel" | "poe" | "mac-table" | "stp" | "vtp" | "ip" | "routing" | "ospf" | "dhcp-relay" | "acl" | "nat" | "vpn" | "inspection" | "dhcp" | "dns" | "http" | "ftp" | "ssid" | "wpa2" | "wpa3" | "vlan-mapping" | "dhcp-client" | "dns-client" | "wan" | "nat-passthrough";

export const CAPABILITY_MATRIX: Record<EcosystemDeviceKind, DeviceCapability[]> = {
  switch: ["vlan", "trunk", "etherchannel", "poe", "mac-table", "stp", "vtp", "dhcp"],
  router: ["ip", "routing", "ospf", "dhcp", "dhcp-relay", "dns", "acl", "nat"],
  firewall: ["ip", "routing", "acl", "nat", "inspection"],
  server: ["ip", "dhcp", "dns", "http", "ftp"],
  "access-point": ["ssid", "wpa2", "wpa3", "poe", "vlan-mapping", "dhcp-client", "trunk"],
  pc: ["ip", "dhcp-client", "dns-client"],
  printer: ["ip", "dhcp-client"],
  modem: ["wan", "nat-passthrough"],
  hub: [],
  "console-server": [],
};

// Capability ownership describes the device roadmap; this set describes what
// the current simulator release actually models.
export const IMPLEMENTED_CAPABILITIES = new Set<DeviceCapability>([
  "vlan", "trunk", "etherchannel", "poe", "mac-table", "stp", "vtp", "ip", "routing", "ospf", "acl", "nat", "inspection", "dhcp", "dns", "dns-client", "dhcp-client",
]);

export function commandCapability(command: string): DeviceCapability | null {
  // `do` carries the capability of the EXEC command it wraps.
  if (/^do /.test(command)) return commandCapability(command.slice(3));
  if (/^(vlan |show vlan|switchport access vlan)/.test(command)) return "vlan";
  if (/^(switchport trunk|switchport mode trunk|show interfaces trunk)/.test(command)) return "trunk";
  if (/^(channel-group|interface port-channel|show etherchannel)/.test(command)) return "etherchannel";
  if (/^(spanning-tree|show spanning-tree)/.test(command)) return "stp";
  if (/^(vtp (mode|domain|version|password) |show vtp status$)/.test(command)) return "vtp";
  if (/^show mac address-table/.test(command)) return "mac-table";
  if (/^(router ospf|ipv6 router ospf|show ip ospf|show ipv6 ospf)/.test(command)) return "ospf";
  if (/^(ip route|ipv6 route|show ip route|show ipv6 route)/.test(command)) return "routing";
  if (/^route (?:outside|inside|dmz) /.test(command)) return "routing";
  if (/^ip address dhcp$/.test(command)) return "dhcp-client";
  if (/^(ip address|ipv6 address|show ip interface|show ipv6 interface)/.test(command)) return "ip";
  if (/^(ip access|access-list|show access-lists)/.test(command)) return "acl";
  if (/^(access-group|show access-list)/.test(command)) return "acl";
  if (/^(ip dns|ip host|show hosts)/.test(command)) return "dns";
  if (/^nslookup /.test(command)) return "dns-client";
  if (/^(ip nat|show ip nat)/.test(command)) return "nat";
  if (/^(object network|subnet |nat \(inside,outside\)|show xlate)/.test(command)) return "nat";
  if (/^(nameif|security-level|show conn|show interface ip brief)/.test(command)) return "inspection";
  if (/^power inline /.test(command)) return "poe";
  if (/^(ip dhcp|show ip dhcp)/.test(command)) return "dhcp";
  return null;
}

export function supportsCommand(command: string, kind: EcosystemDeviceKind, context?: string | null): boolean {
  if (/^show (?:ip|ipv6) interface/.test(command)) return true;
  if (kind === 'router' && /^show mac address-table/.test(command)) return true;
  const capability = commandCapability(command);
  // A Layer 2 switch can be assigned a management address on an SVI, not on
  // an ordinary physical switchport. Keep the device capability check aware
  // of the current interface context so invalid routed-port commands fail.
  if (capability === "ip" && kind === "switch") return context?.startsWith("vlan ") ?? false;
  return capability === null || (IMPLEMENTED_CAPABILITIES.has(capability) && (CAPABILITY_MATRIX[kind] || []).includes(capability));
}

export function supportsDeviceCommand(command: string, node: { kind: string; role?: string }, context?: string | null) {
  if ((node.kind === 'router' || /Layer 3|OSPF Speaker/.test(node.role || '')) && /^(router ospf \d+|show ip ospf(?: |$))/.test(command)) return true;
  if (/Layer 3/.test(node.role || '') && /^(ip address |show ip interface|ip route |show ip route)/.test(command)) return true;
  return supportsCommand(command, node.kind as EcosystemDeviceKind, context);
}
