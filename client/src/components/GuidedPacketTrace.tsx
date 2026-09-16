import { useEffect, useState } from "react";

export type GuidedTraceFrame = {
  name: string;
  detail: string;
  layer2: string;
  layer3: string;
  direction: "forward" | "reverse";
  kind: "broadcast" | "multicast" | "unicast" | "control" | "drop";
};

export type GuidedTraceProfile = {
  title: string;
  frames: GuidedTraceFrame[];
};

const DEFAULT_FRAMES: GuidedTraceFrame[] = [
  { name: "FRAME", detail: "A modeled frame is moving through the active lab path.", layer2: "DESTINATION MAC", layer3: "SOURCE → DESTINATION", direction: "forward", kind: "unicast" },
  { name: "RESPONSE", detail: "The destination returns traffic after processing the frame.", layer2: "SOURCE MAC", layer3: "DESTINATION → SOURCE", direction: "reverse", kind: "unicast" },
];

const PROFILES: Record<string, GuidedTraceProfile> = {
  "tr2-ipv4-interface": {
    title: "IPv4 interface reachability",
    frames: [
      { name: "ARP REQUEST", detail: "The host resolves the router gateway before sending IPv4 traffic.", layer2: "FFFF.FFFF.FFFF", layer3: "ARP / 192.168.10.1", direction: "forward", kind: "broadcast" },
      { name: "ICMP ECHO", detail: "The addressed interface receives an IPv4 echo request.", layer2: "CE-R1 MAC", layer3: "192.168.10.10 → 192.168.10.1", direction: "forward", kind: "unicast" },
      { name: "ICMP REPLY", detail: "The router returns the echo reply to the host.", layer2: "HOST MAC", layer3: "192.168.10.1 → 192.168.10.10", direction: "reverse", kind: "unicast" },
    ],
  },
  "tr2-ipv6-interface": {
    title: "IPv6 neighbor discovery",
    frames: [
      { name: "NEIGHBOR SOLICITATION", detail: "The host uses IPv6 multicast neighbor discovery for the gateway MAC.", layer2: "33:33:FF:00:00:01", layer3: "ff02::1:ff00:1", direction: "forward", kind: "multicast" },
      { name: "ICMPv6 ECHO", detail: "The IPv6 host sends an echo request after discovery.", layer2: "CE-R1 MAC", layer3: "2001:db8:10::10 → 2001:db8:10::1", direction: "forward", kind: "unicast" },
      { name: "ICMPv6 REPLY", detail: "The router returns the IPv6 echo reply.", layer2: "HOST MAC", layer3: "2001:db8:10::1 → 2001:db8:10::10", direction: "reverse", kind: "unicast" },
    ],
  },
  "tr2-vlan-access": {
    title: "VLAN access forwarding",
    frames: [
      { name: "INGRESS FRAME", detail: "An access port accepts an untagged host frame into its assigned VLAN.", layer2: "SWITCH MAC", layer3: "HOST → VLAN 10", direction: "forward", kind: "unicast" },
      { name: "VLAN FORWARD", detail: "The switch forwards the frame only inside the VLAN 10 broadcast domain.", layer2: "VLAN 10 FDB", layer3: "VLAN 10 / ACCESS", direction: "forward", kind: "control" },
      { name: "EGRESS FRAME", detail: "The destination access port sends the frame untagged to the endpoint.", layer2: "DESTINATION MAC", layer3: "VLAN 10 HOST → HOST", direction: "reverse", kind: "unicast" },
    ],
  },
  "tr2-trunking": {
    title: "802.1Q trunk forwarding",
    frames: [
      { name: "VLAN FRAME", detail: "The switch adds an 802.1Q tag before crossing the trunk.", layer2: "DESTINATION MAC", layer3: "VLAN 10 / 802.1Q", direction: "forward", kind: "unicast" },
      { name: "TRUNK TRANSIT", detail: "The tagged frame crosses the inter-switch link without losing its VLAN identity.", layer2: "802.1Q TAG 10", layer3: "SW1 ⇄ SW2", direction: "forward", kind: "control" },
      { name: "ACCESS DELIVERY", detail: "The receiving switch removes the tag on the destination access port.", layer2: "HOST MAC", layer3: "VLAN 10 HOST → HOST", direction: "reverse", kind: "unicast" },
    ],
  },
  "tr2-stp": {
    title: "STP control traffic",
    frames: [
      { name: "BPDU HELLO", detail: "Switches exchange Bridge Protocol Data Units to discover the spanning-tree topology.", layer2: "01:80:C2:00:00:00", layer3: "STP CONTROL", direction: "forward", kind: "multicast" },
      { name: "ROOT UPDATE", detail: "The root bridge information is propagated across the link.", layer2: "01:80:C2:00:00:00", layer3: "ROOT ID / COST", direction: "reverse", kind: "control" },
      { name: "PORT STATE", detail: "The switch places redundant paths into forwarding or blocking state.", layer2: "STP STATE", layer3: "FORWARDING / BLOCKING", direction: "forward", kind: "control" },
    ],
  },
  "tr3-router-on-a-stick": {
    title: "Inter-VLAN routed traffic",
    frames: [
      { name: "VLAN 10 INGRESS", detail: "The switch tags the Engineering frame before sending it to the router.", layer2: "CE-R1 MAC", layer3: "192.168.10.10 → 192.168.20.10", direction: "forward", kind: "unicast" },
      { name: "ROUTING DECISION", detail: "The router removes the VLAN 10 context and selects VLAN 20 as the exit interface.", layer2: "ROUTED HOP", layer3: "192.168.10.0/24 → 192.168.20.0/24", direction: "forward", kind: "control" },
      { name: "VLAN 20 EGRESS", detail: "The router sends the frame back through the trunk with the VLAN 20 tag.", layer2: "DESTINATION MAC", layer3: "192.168.20.1 → 192.168.20.10", direction: "reverse", kind: "unicast" },
    ],
  },
  "tr3-static-routing": {
    title: "Static route forwarding",
    frames: [
      { name: "ICMP ECHO", detail: "The branch host sends traffic toward a remote network.", layer2: "R1 NEXT-HOP MAC", layer3: "192.168.10.10 → 192.168.20.1", direction: "forward", kind: "unicast" },
      { name: "STATIC LOOKUP", detail: "The router matches the destination prefix to its configured static route.", layer2: "R1 ⇄ R2", layer3: "192.168.20.0/24 via 10.0.0.2", direction: "forward", kind: "control" },
      { name: "ICMP REPLY", detail: "The remote router returns the response through the reverse path.", layer2: "BRANCH MAC", layer3: "192.168.20.1 → 192.168.10.10", direction: "reverse", kind: "unicast" },
    ],
  },
  "tr3-ospfv2": {
    title: "OSPFv2 adjacency",
    frames: [
      { name: "OSPF HELLO", detail: "Routers discover one another with IPv4 multicast Hellos.", layer2: "01:00:5E:00:00:05", layer3: "224.0.0.5", direction: "forward", kind: "multicast" },
      { name: "LSA FLOOD", detail: "Link-state information is flooded so both routers can build the same LSDB.", layer2: "OSPF MULTICAST", layer3: "224.0.0.5 / LS UPDATE", direction: "reverse", kind: "multicast" },
      { name: "ROUTE INSTALL", detail: "The SPF result is installed as an OSPF route.", layer2: "R1 ⇄ R2", layer3: "OSPF AREA 0", direction: "forward", kind: "control" },
    ],
  },
  "tr3-ospfv3": {
    title: "OSPFv3 adjacency",
    frames: [
      { name: "OSPFv3 HELLO", detail: "Routers discover one another with IPv6 link-local multicast.", layer2: "33:33:00:00:00:05", layer3: "ff02::5", direction: "forward", kind: "multicast" },
      { name: "LS UPDATE", detail: "OSPFv3 floods link-state information across the adjacency.", layer2: "OSPFv3 MULTICAST", layer3: "ff02::5 / LS UPDATE", direction: "reverse", kind: "multicast" },
      { name: "ROUTE INSTALL", detail: "The SPF result is installed in the IPv6 routing table.", layer2: "R1 ⇄ R2", layer3: "OSPFv3 AREA 0", direction: "forward", kind: "control" },
    ],
  },
  "tr3-dhcp-server": {
    title: "DHCPv4 DORA exchange",
    frames: [
      { name: "DHCPDISCOVER", detail: "Client is searching for a DHCP server.", layer2: "FFFF.FFFF.FFFF", layer3: "255.255.255.255", direction: "reverse", kind: "broadcast" },
      { name: "DHCPOFFER", detail: "Router offers 192.168.30.10/24.", layer2: "CLIENT-PC1 MAC", layer3: "192.168.30.1 → 192.168.30.10", direction: "forward", kind: "unicast" },
      { name: "DHCPREQUEST", detail: "Client requests the offered lease.", layer2: "FFFF.FFFF.FFFF", layer3: "255.255.255.255", direction: "reverse", kind: "broadcast" },
      { name: "DHCPACK", detail: "Router confirms the lease, gateway, and DNS options.", layer2: "CLIENT-PC1 MAC", layer3: "192.168.30.1 → 192.168.30.10", direction: "forward", kind: "unicast" },
    ],
  },
  "tr4-nat-pat": {
    title: "NAT overload flow",
    frames: [
      { name: "INSIDE REQUEST", detail: "A private host sends an outbound session toward the provider.", layer2: "ISP NEXT-HOP MAC", layer3: "10.10.10.10:51514 → 198.51.100.80:443", direction: "forward", kind: "unicast" },
      { name: "PAT TRANSLATION", detail: "The edge router rewrites the private source to its public interface address and port.", layer2: "PUBLIC EDGE MAC", layer3: "203.0.113.2:40001 → 198.51.100.80:443", direction: "forward", kind: "control" },
      { name: "RETURN SESSION", detail: "The router reverses the translation and delivers the response to the inside host.", layer2: "INSIDE HOST MAC", layer3: "198.51.100.80:443 → 10.10.10.10:51514", direction: "reverse", kind: "unicast" },
    ],
  },
  "tr4-standard-acl": {
    title: "Standard ACL decision",
    frames: [
      { name: "INGRESS PACKET", detail: "Traffic enters the router on the protected interface.", layer2: "R1 INTERFACE MAC", layer3: "192.168.50.10 → 192.168.50.1", direction: "forward", kind: "unicast" },
      { name: "ACL MATCH", detail: "The source address is compared against the ordered standard ACL entries.", layer2: "ACL PROCESS", layer3: "SOURCE 192.168.50.10", direction: "forward", kind: "control" },
      { name: "PERMIT / DENY", detail: "The packet continues only when the ACL decision permits it.", layer2: "EGRESS MAC", layer3: "POLICY RESULT", direction: "reverse", kind: "drop" },
    ],
  },
  "tr4-extended-acl": {
    title: "Extended ACL policy",
    frames: [
      { name: "HTTPS REQUEST", detail: "A client sends a protocol- and port-specific web request.", layer2: "SECURITY GATEWAY MAC", layer3: "10.10.60.10:51514 → WEB-SRV1:443", direction: "forward", kind: "unicast" },
      { name: "ACL INSPECTION", detail: "The extended ACL evaluates source, destination, protocol, and port.", layer2: "ACL PROCESS", layer3: "TCP / 443", direction: "forward", kind: "control" },
      { name: "POLICY RESULT", detail: "Permitted HTTPS is forwarded; unmatched traffic is dropped.", layer2: "WEB SERVER MAC", layer3: "PERMIT / IMPLICIT DENY", direction: "reverse", kind: "drop" },
    ],
  },
  "tr4-ssh-hardening": {
    title: "SSH management session",
    frames: [
      { name: "TCP SYN", detail: "The administrator begins a TCP session to the switch VTY service.", layer2: "SWITCH MAC", layer3: "ADMIN-PC1:51514 → CE-SW1:22", direction: "forward", kind: "unicast" },
      { name: "SSH NEGOTIATION", detail: "The switch presents its host key and negotiates an encrypted management session.", layer2: "ADMIN-PC1 MAC", layer3: "TCP 22 / SSH", direction: "reverse", kind: "control" },
      { name: "SECURE CLI", detail: "Credentialed management traffic continues inside the encrypted SSH channel.", layer2: "SWITCH MAC", layer3: "SSH PAYLOAD", direction: "forward", kind: "unicast" },
    ],
  },
  "tr4-port-security": {
    title: "Port-security admission",
    frames: [
      { name: "SOURCE LEARNING", detail: "The switch learns the endpoint MAC on the access port.", layer2: "STAFF-PC1 MAC", layer3: "PORT g0/1", direction: "forward", kind: "control" },
      { name: "SECURITY CHECK", detail: "The learned address is compared with the configured secure MAC policy.", layer2: "SECURE MAC TABLE", layer3: "g0/1 / MAX 1", direction: "forward", kind: "control" },
      { name: "FORWARD / VIOLATION", detail: "Authorized traffic forwards; a violation can shut the port or restrict traffic.", layer2: "ACCESS PORT", layer3: "SECURE / VIOLATION", direction: "reverse", kind: "drop" },
    ],
  },
  "tr5-binary-cidr": {
    title: "Subnet boundary forwarding",
    frames: [
      { name: "HOST DECISION", detail: "The host compares the destination against its CIDR mask.", layer2: "LOCAL MAC", layer3: "192.0.2.70 → 192.0.2.95", direction: "forward", kind: "control" },
      { name: "BROADCAST TEST", detail: "The directed broadcast is evaluated against the subnet boundary.", layer2: "FFFF.FFFF.FFFF", layer3: "192.0.2.95", direction: "forward", kind: "broadcast" },
      { name: "ROUTER RESPONSE", detail: "The router distinguishes local broadcast scope from routed unicast traffic.", layer2: "ROUTER MAC", layer3: "SUBNET / HOST BITS", direction: "reverse", kind: "unicast" },
    ],
  },
  "tr5-vlsm-dual-stack": {
    title: "VLSM dual-stack forwarding",
    frames: [
      { name: "IPv4 ROUTE", detail: "The router selects the longest matching IPv4 prefix for the user LAN.", layer2: "R1 NEXT-HOP MAC", layer3: "10.10.10.10 → 10.10.0.1", direction: "forward", kind: "unicast" },
      { name: "IPv6 ROUTE", detail: "The router independently selects the IPv6 prefix and next hop.", layer2: "R1 NEXT-HOP MAC", layer3: "2001:db8:100:10::10 → 2001:db8:100::1", direction: "forward", kind: "unicast" },
      { name: "DUAL-STACK REPLY", detail: "The destination returns traffic over the matching address family.", layer2: "HOST MAC", layer3: "IPv4 / IPv6 RETURN", direction: "reverse", kind: "unicast" },
    ],
  },
  "tr5-ipv6-subnetting": {
    title: "IPv6 point-to-point forwarding",
    frames: [
      { name: "NEIGHBOR DISCOVERY", detail: "IPv6 resolves the next-hop link-layer address using solicited-node multicast.", layer2: "33:33:FF:00:00:02", layer3: "ff02::1:ff00:2", direction: "forward", kind: "multicast" },
      { name: "IPv6 DATA", detail: "The site router forwards traffic across the /64 point-to-point link.", layer2: "R2 MAC", layer3: "2001:db8:200::1 → 2001:db8:200::2", direction: "forward", kind: "unicast" },
      { name: "ICMPv6 REPLY", detail: "The core router returns the response to the site prefix.", layer2: "R1 MAC", layer3: "2001:db8:200::2 → 2001:db8:200::1", direction: "reverse", kind: "unicast" },
    ],
  },
  "tr5-multicast": {
    title: "IPv4 and IPv6 multicast",
    frames: [
      { name: "GROUP JOIN", detail: "The receiver announces interest in the multicast stream.", layer2: "01:00:5E / 33:33", layer3: "239.1.1.1 / ff02::1", direction: "reverse", kind: "multicast" },
      { name: "MULTICAST STREAM", detail: "The source sends one stream that the router replicates toward interested receivers.", layer2: "MULTICAST MAC", layer3: "239.1.1.1 / ff02::1", direction: "forward", kind: "multicast" },
      { name: "PIM CONTROL", detail: "PIM maintains the forwarding state used to replicate the group traffic.", layer2: "PIM MULTICAST", layer3: "224.0.0.13 / ff02::d", direction: "reverse", kind: "control" },
    ],
  },
  "tr5-broadcast-neighbor-discovery": {
    title: "Broadcast and neighbor discovery",
    frames: [
      { name: "ARP REQUEST", detail: "IPv4 asks every local host who owns the gateway address.", layer2: "FFFF.FFFF.FFFF", layer3: "ARP / 192.168.70.1", direction: "forward", kind: "broadcast" },
      { name: "NEIGHBOR SOLICITATION", detail: "IPv6 uses solicited-node multicast instead of an all-host broadcast.", layer2: "33:33:FF:00:00:01", layer3: "ff02::1:ff00:1", direction: "forward", kind: "multicast" },
      { name: "ADDRESS RESOLUTION", detail: "The gateway replies with a unicast link-layer response.", layer2: "HOST MAC", layer3: "ARP REPLY / ICMPv6 NA", direction: "reverse", kind: "unicast" },
    ],
  },
};

export function getGuidedTraceProfile(labId: string, deviceNames: string[]): GuidedTraceProfile {
  const profile = PROFILES[labId];
  if (profile) return profile;
  const [source = "SOURCE", destination = "DESTINATION"] = deviceNames;
  return {
    title: `${source} to ${destination} traffic`,
    frames: DEFAULT_FRAMES.map((frame) => ({
      ...frame,
      detail: frame.direction === "forward" ? `${source} sends a modeled frame toward ${destination}.` : `${destination} returns a modeled response to ${source}.`,
    })),
  };
}

function kindColor(kind: GuidedTraceFrame["kind"]) {
  if (kind === "broadcast") return { dot: "bg-[#63e6e2]", text: "text-[#63e6e2]" };
  if (kind === "multicast") return { dot: "bg-[#b88cff]", text: "text-[#c7a8ff]" };
  if (kind === "drop") return { dot: "bg-[#f07178]", text: "text-[#f07178]" };
  if (kind === "control") return { dot: "bg-[#f5b74b]", text: "text-[#f5b74b]" };
  return { dot: "bg-[#f5b74b]", text: "text-[#f4d998]" };
}

export default function GuidedPacketTrace({ profile, run, leftLabel, rightLabel }: { profile: GuidedTraceProfile; run: number; leftLabel: string; rightLabel: string }) {
  const [frameIndex, setFrameIndex] = useState(0);
  const frame = profile.frames[frameIndex] || profile.frames[0];
  const colors = kindColor(frame.kind);

  useEffect(() => {
    if (!run) return;
    setFrameIndex(0);
    const timer = window.setInterval(() => setFrameIndex((index) => (index + 1) % profile.frames.length), 1150);
    return () => window.clearInterval(timer);
  }, [profile, run]);

  if (!frame) return null;

  return (
    <div className="mt-3 flex h-[236px] min-h-[236px] flex-col overflow-hidden rounded-xl border border-[#63e6e2]/25 bg-[#09151d] p-3" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[.16em] text-[#63e6e2]">{profile.title} · packet trace</div>
        <span className="rounded bg-[#63e6e2]/10 px-2 py-1 font-mono text-[9px] uppercase text-[#63e6e2]">{run ? `${frameIndex + 1}/${profile.frames.length}` : "STANDBY"}</span>
      </div>
      <div className="relative mt-3 flex shrink-0 items-center justify-between gap-3 font-mono text-[10px]">
        <div className="rounded-lg border border-[#f5b74b]/35 bg-[#2a2112] px-3 py-2 text-[#f4d998]">{leftLabel}</div>
        <div className="relative h-10 flex-1 border-y border-dashed border-[#385159]">
          <div className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full shadow-[0_0_14px_#63e6e2] transition-all duration-700 ${frame.direction === "forward" ? `left-[78%] ${colors.dot}` : `left-[12%] ${colors.dot}`}`} />
          <div className={`absolute top-1/2 -translate-y-1/2 text-[9px] uppercase tracking-wider ${colors.text} ${frame.direction === "forward" ? "right-1/2" : "left-1/2"}`}>{frame.kind}</div>
        </div>
        <div className="rounded-lg border border-[#63e6e2]/35 bg-[#173038] px-3 py-2 text-[#b9eeee]">{rightLabel}</div>
      </div>
      <div className="mt-2 grid shrink-0 gap-2 sm:grid-cols-[auto_1fr_1fr] sm:items-center">
        <div className="font-mono text-sm font-semibold text-white">{frame.name}</div>
        <div className="rounded border border-white/10 bg-[#0e1720] px-2 py-2 text-[#aebbc0]">L2: <span className="text-[#63e6e2]">{frame.layer2}</span></div>
        <div className="rounded border border-white/10 bg-[#0e1720] px-2 py-2 text-[#aebbc0]">L3: <span className="text-[#63e6e2]">{frame.layer3}</span></div>
      </div>
      <div className="mt-auto pt-2 text-xs text-[#778a92]">{run ? frame.detail : "Awaiting the lab action that activates this protocol exchange."}</div>
    </div>
  );
}
