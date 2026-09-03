import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import NetworkSandbox from "@/components/NetworkSandbox";
import { toast } from "sonner";
import { boot, modePrompt, nextMode, type Mode, type Session } from "@/lib/ios-engine";
import { Check, CircleHelp, Copy, Network, Play, RotateCcw, TerminalSquare } from "lucide-react";

/** Packet Observatory design: dark field console, cyan signal, amber evidence, IBM Plex typography. */

type DeviceName = string;
type Step = { title: string; description: string; device: DeviceName; mode: Mode; command: string; success: string };
type Lab = { id: number; code: string; title: string; domain: string; blurb: string; topology: string; devices: { name: string; role: string }[]; steps: Step[] };

const s = (title: string, description: string, device: string, mode: Mode, command: string, success: string): Step => ({ title, description, device, mode, command, success });

const labs: Lab[] = [
  {
    id: 1, code: "LAB 01", title: "Addressing + CLI Foundations", domain: "NETWORK FUNDAMENTALS", blurb: "Build the Construction Enterprises dual-stack baseline: Ethernet identity, IPv4/IPv6 addressing, link-local behavior, and verification.", topology: "CE-HQ-R1 ⇄ FTF-R2 · dual-stack transit", devices: [{ name: "CE-HQ-R1", role: "Headquarters router" }, { name: "FTF-R2", role: "Factory router" }],
    steps: [
      s("Enter privileged EXEC mode", "Start on the Construction Enterprises headquarters router.", "CE-HQ-R1", "user", "enable", "The # prompt indicates privileged EXEC mode."),
      s("Enter global configuration mode", "Open the full IOS configuration context.", "CE-HQ-R1", "privileged", "configure terminal", "The (config)# prompt indicates global configuration mode."),
      s("Set the headquarters hostname", "Name the device before building the path.", "CE-HQ-R1", "config", "hostname CE-HQ-R1", "Hostname applied to the headquarters router."),
      s("Enable IPv6 forwarding", "Enable routing for IPv6 unicast traffic.", "CE-HQ-R1", "config", "ipv6 unicast-routing", "IPv6 forwarding is enabled globally."),
      s("Select the headquarters transit interface", "Configure the link toward Factory to Foundation.", "CE-HQ-R1", "config", "interface GigabitEthernet0/0", "GigabitEthernet0/0 selected."),
      s("Address the headquarters transit link", "Apply the global IPv6 address from the addressing plan.", "CE-HQ-R1", "interface", "ipv6 address 2001:db8:12:12::1/64", "Global IPv6 address applied."),
      s("Set the predictable link-local address", "Use a named link-local next hop for later routing work.", "CE-HQ-R1", "interface", "ipv6 address fe80::1 link-local", "Link-local address fe80::1 applied."),
      s("Enable the headquarters interface", "Bring the transit link administratively up.", "CE-HQ-R1", "interface", "no shutdown", "Interface is administratively enabled."),
      s("Return to global configuration", "Leave the interface context.", "CE-HQ-R1", "interface", "exit", "Returned to global configuration mode."),
      s("Create the headquarters loopback", "Use a stable interface to represent the headquarters LAN.", "CE-HQ-R1", "config", "interface Loopback0", "Loopback0 selected."),
      s("Address the headquarters loopback", "Apply the headquarters LAN prefix.", "CE-HQ-R1", "interface", "ipv6 address 2001:db8:1::1/64", "Headquarters loopback address applied."),
      s("Enable the headquarters loopback", "Loopbacks remain logically up for testing.", "CE-HQ-R1", "interface", "no shutdown", "Loopback0 is enabled."),
      s("Return to privileged EXEC", "Finish the headquarters configuration block.", "CE-HQ-R1", "interface", "end", "Returned to privileged EXEC mode."),
      s("Enter privileged EXEC on FTF-R2", "Switch to the Factory to Foundation router.", "FTF-R2", "user", "enable", "The # prompt indicates privileged EXEC mode."),
      s("Enter global configuration on FTF-R2", "Open the router configuration context.", "FTF-R2", "privileged", "configure terminal", "The (config)# prompt indicates global configuration mode."),
      s("Set the Factory router hostname", "Identify the second site in the topology.", "FTF-R2", "config", "hostname FTF-R2", "Factory to Foundation hostname applied."),
      s("Enable IPv6 forwarding on FTF-R2", "Enable IPv6 routing at the factory.", "FTF-R2", "config", "ipv6 unicast-routing", "IPv6 forwarding is enabled globally."),
      s("Select the factory transit interface", "Configure the link toward headquarters.", "FTF-R2", "config", "interface GigabitEthernet0/0", "GigabitEthernet0/0 selected."),
      s("Address the factory transit link", "Use the shared /64 transit network.", "FTF-R2", "interface", "ipv6 address 2001:db8:12:12::2/64", "Global IPv6 address applied."),
      s("Set the factory link-local address", "Use the predictable factory next hop.", "FTF-R2", "interface", "ipv6 address fe80::2 link-local", "Link-local address fe80::2 applied."),
      s("Enable the factory interface", "Bring the transit interface up.", "FTF-R2", "interface", "no shutdown", "Interface is administratively enabled."),
      s("Return to global configuration", "Leave the interface context.", "FTF-R2", "interface", "exit", "Returned to global configuration mode."),
      s("Create the factory loopback", "Represent the Factory to Foundation LAN.", "FTF-R2", "config", "interface Loopback0", "Loopback0 selected."),
      s("Address the factory loopback", "Apply the factory LAN prefix.", "FTF-R2", "interface", "ipv6 address 2001:db8:2::1/64", "Factory loopback address applied."),
      s("Enable the factory loopback", "Keep the test endpoint logically up.", "FTF-R2", "interface", "no shutdown", "Loopback0 is enabled."),
      s("Return to privileged EXEC on FTF-R2", "Finish the factory configuration block.", "FTF-R2", "interface", "end", "Returned to privileged EXEC mode."),
      s("Add the headquarters route", "Tell FTF-R2 how to reach the headquarters loopback.", "FTF-R2", "privileged", "configure terminal", "Configuration mode reopened."),
      s("Install the FTF-R2 static route", "Use the headquarters link-local next hop and outgoing interface.", "FTF-R2", "config", "ipv6 route 2001:db8:1::/64 fe80::1 GigabitEthernet0/0", "Static IPv6 route installed."),
      s("Return to privileged EXEC", "Prepare to test the path.", "FTF-R2", "config", "end", "Returned to privileged EXEC mode."),
      s("Verify the headquarters loopback", "Prove the dual-stack foundation path is reachable.", "FTF-R2", "privileged", "ping ipv6 2001:db8:1::1", "Success rate is 100 percent. The IPv6 foundation path is reachable.")
    ]
  },
  {
    id: 2, code: "LAB 02", title: "Switching, VLANs + Trunks", domain: "NETWORK ACCESS", blurb: "Switch the Construction Enterprises campus: create named VLANs, assign access ports, build a full LACP trunk, and route Factory to Foundation production traffic.", topology: "CE-HQ-DSW1 ⇄ FTF-FAB-ACC1 ⇄ CE-HQ-R1", devices: [{ name: "CE-HQ-DSW1", role: "Headquarters distribution switch" }, { name: "FTF-FAB-ACC1", role: "Factory access switch" }, { name: "CE-HQ-R1", role: "Headquarters edge router" }],
    steps: [
      s("Enter privileged EXEC on HQ distribution", "Start with the headquarters switch.", "CE-HQ-DSW1", "user", "enable", "The # prompt indicates privileged EXEC mode."),
      s("Enter switch configuration mode", "Open the full IOS configuration context.", "CE-HQ-DSW1", "privileged", "configure terminal", "The (config)# prompt indicates global configuration mode."),
      s("Create engineering VLAN", "Enter the VLAN database context for headquarters engineering.", "CE-HQ-DSW1", "config", "vlan 10", "VLAN 10 created; the prompt is now (config-vlan)#."),
      s("Name engineering VLAN", "Use the Construction Enterprises business name.", "CE-HQ-DSW1", "vlan", "name CE-HQ-ENGINEERING", "VLAN 10 named CE-HQ-ENGINEERING."),
      s("Leave VLAN configuration", "Return to global configuration.", "CE-HQ-DSW1", "vlan", "exit", "Returned to global configuration mode."),
      s("Create production VLAN", "Enter the Factory to Foundation production VLAN.", "CE-HQ-DSW1", "config", "vlan 20", "VLAN 20 created."),
      s("Name production VLAN", "Use the production-floor business name.", "CE-HQ-DSW1", "vlan", "name FTF-PRODUCTION", "VLAN 20 named FTF-PRODUCTION."),
      s("Leave VLAN configuration", "Return to global configuration.", "CE-HQ-DSW1", "vlan", "exit", "Returned to global configuration mode."),
      s("Create management VLAN", "Reserve the management segment.", "CE-HQ-DSW1", "config", "vlan 99", "VLAN 99 created."),
      s("Name management VLAN", "Use the network-management business name.", "CE-HQ-DSW1", "vlan", "name CE-NET-MANAGEMENT", "VLAN 99 named CE-NET-MANAGEMENT."),
      s("Leave VLAN configuration", "Return to global configuration.", "CE-HQ-DSW1", "vlan", "exit", "Returned to global configuration mode."),
      s("Create unused native VLAN", "Create the dedicated native VLAN for trunks.", "CE-HQ-DSW1", "config", "vlan 999", "VLAN 999 created."),
      s("Name unused native VLAN", "Make the trunk intent visible in the configuration.", "CE-HQ-DSW1", "vlan", "name CE-NATIVE-BLACKHOLE", "VLAN 999 named CE-NATIVE-BLACKHOLE."),
      s("Leave VLAN configuration", "Return to global configuration.", "CE-HQ-DSW1", "vlan", "exit", "Returned to global configuration mode."),
      s("Select headquarters engineering port", "Configure the engineering workstation access port.", "CE-HQ-DSW1", "config", "interface FastEthernet0/1", "FastEthernet0/1 selected."),
      s("Describe the engineering endpoint", "Document the connected business endpoint.", "CE-HQ-DSW1", "interface", "description CE-HQ-ENG-PC1", "Engineering endpoint description applied."),
      s("Set access mode", "Make the port a non-trunk access port.", "CE-HQ-DSW1", "interface", "switchport mode access", "Access mode applied."),
      s("Assign engineering VLAN", "Place the headquarters endpoint in VLAN 10.", "CE-HQ-DSW1", "interface", "switchport access vlan 10", "Access VLAN 10 applied."),
      s("Enable PortFast", "Use PortFast only on this endpoint-facing port.", "CE-HQ-DSW1", "interface", "spanning-tree portfast", "PortFast enabled."),
      s("Enable BPDU Guard", "Protect the endpoint edge from unexpected BPDUs.", "CE-HQ-DSW1", "interface", "spanning-tree bpduguard enable", "BPDU Guard enabled."),
      s("Enable engineering port", "Bring the access port up.", "CE-HQ-DSW1", "interface", "no shutdown", "Engineering access port is enabled."),
      s("Return to global configuration", "Leave the endpoint interface.", "CE-HQ-DSW1", "interface", "exit", "Returned to global configuration mode."),
      s("Select LACP member links", "Select both physical links to the Factory access switch.", "CE-HQ-DSW1", "config", "interface range GigabitEthernet0/2 - 3", "Interface range selected; the prompt is now (config-if-range)#."),
      s("Set member links to trunk", "Both physical members must carry the campus VLANs.", "CE-HQ-DSW1", "interface-range", "switchport mode trunk", "Trunk mode applied to the member range."),
      s("Set trunk native VLAN", "Use VLAN 999 as the native VLAN.", "CE-HQ-DSW1", "interface-range", "switchport trunk native vlan 999", "Native VLAN 999 applied."),
      s("Allow campus VLANs", "Restrict the trunk to the required VLAN list.", "CE-HQ-DSW1", "interface-range", "switchport trunk allowed vlan 10,20,99,999", "Allowed VLAN list applied."),
      s("Enable LACP active mode", "Bundle the two physical links with LACP.", "CE-HQ-DSW1", "interface-range", "channel-group 1 mode active", "LACP channel-group 1 configured in active mode."),
      s("Enable the member links", "Bring both LACP members up.", "CE-HQ-DSW1", "interface-range", "no shutdown", "LACP member links are enabled."),
      s("Leave interface range", "Return to global configuration.", "CE-HQ-DSW1", "interface-range", "exit", "Returned to global configuration mode."),
      s("Select Port-channel1", "Configure the logical LACP interface.", "CE-HQ-DSW1", "config", "interface Port-channel1", "Port-channel1 selected."),
      s("Configure logical trunk", "Apply the trunk policy to the logical bundle.", "CE-HQ-DSW1", "interface", "switchport mode trunk", "Port-channel1 is a trunk."),
      s("Set logical native VLAN", "Match the physical member policy.", "CE-HQ-DSW1", "interface", "switchport trunk native vlan 999", "Native VLAN 999 applied to Port-channel1."),
      s("Set logical allowed VLANs", "Match the physical member policy.", "CE-HQ-DSW1", "interface", "switchport trunk allowed vlan 10,20,99,999", "Allowed VLAN list applied to Port-channel1."),
      s("Enable logical bundle", "Bring the logical trunk up.", "CE-HQ-DSW1", "interface", "no shutdown", "Port-channel1 is enabled."),
      s("Return to privileged EXEC", "Finish the headquarters distribution switch block.", "CE-HQ-DSW1", "interface", "end", "Returned to privileged EXEC mode."),
      s("Prepare the Factory access switch", "Switch to the Factory to Foundation access device.", "FTF-FAB-ACC1", "user", "enable", "The # prompt indicates privileged EXEC mode."),
      s("Enter Factory switch configuration", "Open the full IOS configuration context.", "FTF-FAB-ACC1", "privileged", "configure terminal", "The (config)# prompt indicates global configuration mode."),
      s("Create Factory VLANs", "Create the same campus VLANs on the access switch.", "FTF-FAB-ACC1", "config", "vlan 10", "VLAN 10 created on the Factory access switch."),
      s("Name Factory engineering VLAN", "Keep VLAN names consistent across the trunk.", "FTF-FAB-ACC1", "vlan", "name CE-HQ-ENGINEERING", "VLAN 10 name applied."),
      s("Leave VLAN configuration", "Return to global configuration.", "FTF-FAB-ACC1", "vlan", "exit", "Returned to global configuration mode."),
      s("Create Factory production VLAN", "Create the production segment.", "FTF-FAB-ACC1", "config", "vlan 20", "VLAN 20 created."),
      s("Name Factory production VLAN", "Use the Factory to Foundation name.", "FTF-FAB-ACC1", "vlan", "name FTF-PRODUCTION", "VLAN 20 name applied."),
      s("Leave VLAN configuration", "Return to global configuration.", "FTF-FAB-ACC1", "vlan", "exit", "Returned to global configuration mode."),
      s("Create Factory management VLAN", "Create the management segment.", "FTF-FAB-ACC1", "config", "vlan 99", "VLAN 99 created."),
      s("Name Factory management VLAN", "Keep the management name consistent.", "FTF-FAB-ACC1", "vlan", "name CE-NET-MANAGEMENT", "VLAN 99 name applied."),
      s("Leave VLAN configuration", "Return to global configuration.", "FTF-FAB-ACC1", "vlan", "exit", "Returned to global configuration mode."),
      s("Create Factory native VLAN", "Create the native VLAN locally.", "FTF-FAB-ACC1", "config", "vlan 999", "VLAN 999 created."),
      s("Name Factory native VLAN", "Keep the native VLAN intent visible.", "FTF-FAB-ACC1", "vlan", "name CE-NATIVE-BLACKHOLE", "VLAN 999 name applied."),
      s("Leave VLAN configuration", "Return to global configuration.", "FTF-FAB-ACC1", "vlan", "exit", "Returned to global configuration mode."),
      s("Select production access port", "Configure the Factory production workstation.", "FTF-FAB-ACC1", "config", "interface FastEthernet0/1", "FastEthernet0/1 selected."),
      s("Describe production endpoint", "Document the Factory endpoint.", "FTF-FAB-ACC1", "interface", "description FTF-PROD-PC1", "Production endpoint description applied."),
      s("Set production access mode", "Make the port an access edge.", "FTF-FAB-ACC1", "interface", "switchport mode access", "Access mode applied."),
      s("Assign production VLAN", "Place the Factory endpoint in VLAN 20.", "FTF-FAB-ACC1", "interface", "switchport access vlan 20", "Access VLAN 20 applied."),
      s("Enable production PortFast", "Apply edge behavior to the endpoint port.", "FTF-FAB-ACC1", "interface", "spanning-tree portfast", "PortFast enabled."),
      s("Enable production BPDU Guard", "Protect the Factory edge.", "FTF-FAB-ACC1", "interface", "spanning-tree bpduguard enable", "BPDU Guard enabled."),
      s("Enable production port", "Bring the production access port up.", "FTF-FAB-ACC1", "interface", "no shutdown", "Production access port is enabled."),
      s("Return to global configuration", "Leave the endpoint interface.", "FTF-FAB-ACC1", "interface", "exit", "Returned to global configuration mode."),
      s("Select Factory LACP members", "Select the two links toward headquarters.", "FTF-FAB-ACC1", "config", "interface range GigabitEthernet0/2 - 3", "Interface range selected."),
      s("Set Factory members to trunk", "Match the headquarters member policy.", "FTF-FAB-ACC1", "interface-range", "switchport mode trunk", "Trunk mode applied."),
      s("Set Factory native VLAN", "Match native VLAN 999.", "FTF-FAB-ACC1", "interface-range", "switchport trunk native vlan 999", "Native VLAN 999 applied."),
      s("Allow Factory campus VLANs", "Match the allowed VLAN list.", "FTF-FAB-ACC1", "interface-range", "switchport trunk allowed vlan 10,20,99,999", "Allowed VLAN list applied."),
      s("Enable Factory LACP", "Form the matching LACP channel.", "FTF-FAB-ACC1", "interface-range", "channel-group 1 mode active", "LACP channel-group 1 configured in active mode."),
      s("Enable Factory members", "Bring the physical members up.", "FTF-FAB-ACC1", "interface-range", "no shutdown", "Factory LACP members are enabled."),
      s("Leave Factory interface range", "Return to global configuration.", "FTF-FAB-ACC1", "interface-range", "exit", "Returned to global configuration mode."),
      s("Select Factory Port-channel1", "Configure the logical bundle.", "FTF-FAB-ACC1", "config", "interface Port-channel1", "Port-channel1 selected."),
      s("Configure Factory logical trunk", "Match the headquarters trunk policy.", "FTF-FAB-ACC1", "interface", "switchport mode trunk", "Port-channel1 is a trunk."),
      s("Set Factory logical native VLAN", "Match native VLAN 999.", "FTF-FAB-ACC1", "interface", "switchport trunk native vlan 999", "Native VLAN 999 applied."),
      s("Set Factory logical allowed VLANs", "Match the campus VLAN list.", "FTF-FAB-ACC1", "interface", "switchport trunk allowed vlan 10,20,99,999", "Allowed VLAN list applied."),
      s("Enable Factory logical bundle", "Bring Port-channel1 up.", "FTF-FAB-ACC1", "interface", "no shutdown", "Factory Port-channel1 is enabled."),
      s("Return to privileged EXEC", "Finish the Factory access switch block.", "FTF-FAB-ACC1", "interface", "end", "Returned to privileged EXEC mode."),
      s("Select R1 physical trunk", "Move to the headquarters router-on-a-stick interface.", "CE-HQ-R1", "user", "enable", "The # prompt indicates privileged EXEC mode."),
      s("Enter R1 configuration", "Open the router configuration context.", "CE-HQ-R1", "privileged", "configure terminal", "The (config)# prompt indicates global configuration mode."),
      s("Enable R1 IPv6 forwarding", "Enable dual-stack inter-VLAN routing.", "CE-HQ-R1", "config", "ipv6 unicast-routing", "IPv6 forwarding is enabled globally."),
      s("Select R1 physical trunk", "Prepare the parent interface.", "CE-HQ-R1", "config", "interface GigabitEthernet0/0", "GigabitEthernet0/0 selected."),
      s("Describe R1 trunk", "Document the headquarters switch connection.", "CE-HQ-R1", "interface", "description 802.1Q trunk to CE-HQ-DSW1", "Router trunk description applied."),
      s("Enable R1 physical trunk", "Bring the parent interface up.", "CE-HQ-R1", "interface", "no shutdown", "Physical trunk interface is enabled."),
      s("Return to global configuration", "Leave the physical interface.", "CE-HQ-R1", "interface", "exit", "Returned to global configuration mode."),
      s("Select VLAN 10 subinterface", "Create the engineering gateway.", "CE-HQ-R1", "config", "interface GigabitEthernet0/0.10", "Subinterface selected; the prompt is now (config-subif)#."),
      s("Bind VLAN 10 encapsulation", "Map the subinterface to the engineering VLAN.", "CE-HQ-R1", "subinterface", "encapsulation dot1q 10", "802.1Q VLAN 10 encapsulation applied."),
      s("Address VLAN 10 gateway", "Apply the engineering default gateway.", "CE-HQ-R1", "subinterface", "ip address 192.168.10.1 255.255.255.0", "IPv4 gateway applied."),
      s("Address VLAN 10 IPv6 gateway", "Apply the engineering IPv6 gateway.", "CE-HQ-R1", "subinterface", "ipv6 address 2001:db8:10::1/64", "IPv6 gateway applied."),
      s("Leave VLAN 10 subinterface", "Return to global configuration.", "CE-HQ-R1", "subinterface", "exit", "Returned to global configuration mode."),
      s("Select VLAN 20 subinterface", "Create the Factory production gateway.", "CE-HQ-R1", "config", "interface GigabitEthernet0/0.20", "Subinterface selected."),
      s("Bind VLAN 20 encapsulation", "Map the subinterface to production.", "CE-HQ-R1", "subinterface", "encapsulation dot1q 20", "802.1Q VLAN 20 encapsulation applied."),
      s("Address VLAN 20 gateway", "Apply the production default gateway.", "CE-HQ-R1", "subinterface", "ip address 192.168.20.1 255.255.255.0", "IPv4 gateway applied."),
      s("Address VLAN 20 IPv6 gateway", "Apply the production IPv6 gateway.", "CE-HQ-R1", "subinterface", "ipv6 address 2001:db8:20::1/64", "IPv6 gateway applied."),
      s("Leave VLAN 20 subinterface", "Return to global configuration.", "CE-HQ-R1", "subinterface", "exit", "Returned to global configuration mode."),
      s("Select management subinterface", "Create the network-management gateway.", "CE-HQ-R1", "config", "interface GigabitEthernet0/0.99", "Subinterface selected."),
      s("Bind management encapsulation", "Map the subinterface to VLAN 99.", "CE-HQ-R1", "subinterface", "encapsulation dot1q 99", "802.1Q VLAN 99 encapsulation applied."),
      s("Address management gateway", "Apply the management IPv4 gateway.", "CE-HQ-R1", "subinterface", "ip address 192.168.99.1 255.255.255.0", "Management IPv4 gateway applied."),
      s("Leave management subinterface", "Return to global configuration.", "CE-HQ-R1", "subinterface", "exit", "Returned to global configuration mode."),
      s("Select native subinterface", "Define the native VLAN consistently.", "CE-HQ-R1", "config", "interface GigabitEthernet0/0.999", "Native subinterface selected."),
      s("Bind native encapsulation", "Match the switch trunk native VLAN.", "CE-HQ-R1", "subinterface", "encapsulation dot1q 999 native", "Native VLAN 999 encapsulation applied."),
      s("Finish R1 configuration", "Return to privileged EXEC for verification.", "CE-HQ-R1", "subinterface", "end", "Returned to privileged EXEC mode."),
      s("Verify R1 interfaces", "Inspect the dual-stack gateway interfaces.", "CE-HQ-R1", "privileged", "show ip interface brief", "Subinterfaces and gateway states are visible."),
      s("Verify Factory-to-Foundation reachability", "Test the production endpoint through the VLAN 20 gateway.", "CE-HQ-R1", "privileged", "ping 192.168.20.10", "Success rate is 100 percent. Factory-to-Foundation inter-VLAN reachability confirmed.")
    ]
  },
  {
    id: 3, code: "LAB 03", title: "Routing + OSPF", domain: "IP CONNECTIVITY", blurb: "Route between Construction Enterprises sites with IPv4/IPv6 static routes, longest-prefix thinking, OSPFv2, and OSPFv3.", topology: "CE-HQ-R1 ⇄ CE-MFG-R2 ⇄ FTF-R3 · redundant paths", devices: [{ name: "CE-HQ-R1", role: "Headquarters router" }, { name: "CE-MFG-R2", role: "Manufacturing router" }, { name: "FTF-R3", role: "Factory router" }],
    steps: [
      s("Enter CE-HQ-R1 privileged mode", "Begin the routing domain at headquarters.", "CE-HQ-R1", "user", "enable", "Privileged EXEC mode entered."),
      s("Enter CE-HQ-R1 configuration mode", "Open the routing configuration context.", "CE-HQ-R1", "privileged", "configure terminal", "Global configuration mode entered."),
      s("Install the manufacturing IPv4 route", "Use the directly connected CE-MFG-R2 next hop.", "CE-HQ-R1", "config", "ip route 10.20.0.0 255.255.255.0 10.12.0.2", "IPv4 static route installed."),
      s("Install the factory IPv6 route", "Use the Factory to Foundation next hop.", "CE-HQ-R1", "config", "ipv6 route 2001:db8:30::/64 2001:db8:23::3", "IPv6 static route installed."),
      s("Start OSPFv2", "Create the single-area OSPF process.", "CE-HQ-R1", "config", "router ospf 10", "OSPF configuration mode entered."),
      s("Set the HQ router ID", "Make the OSPF identity deterministic.", "CE-HQ-R1", "router", "router-id 1.1.1.1", "OSPF router ID set to 1.1.1.1."),
      s("Advertise the HQ transit network", "Place the headquarters link in area 0.", "CE-HQ-R1", "router", "network 10.12.0.0 0.0.0.255 area 0", "HQ transit network added to area 0."),
      s("Leave OSPF configuration", "Return to global configuration.", "CE-HQ-R1", "router", "exit", "Returned to global configuration mode."),
      s("Enable IPv6 routing at HQ", "Prepare the OSPFv3 interface.", "CE-HQ-R1", "config", "ipv6 unicast-routing", "IPv6 forwarding enabled."),
      s("Select HQ transit interface", "Attach OSPFv3 to the transit link.", "CE-HQ-R1", "config", "interface GigabitEthernet0/0", "Transit interface selected."),
      s("Enable OSPFv3 on HQ transit", "Place the interface in OSPFv3 area 0.", "CE-HQ-R1", "interface", "ipv6 ospf 10 area 0", "OSPFv3 enabled on the HQ transit interface."),
      s("Return to privileged EXEC", "Prepare for neighbor verification.", "CE-HQ-R1", "interface", "end", "Returned to privileged EXEC mode."),
      s("Verify OSPFv2 neighbors", "Inspect the control-plane adjacency.", "CE-HQ-R1", "privileged", "show ip ospf neighbor", "OSPF neighbor state is FULL."),
      s("Verify the routing table", "Confirm longest-prefix route selection.", "CE-HQ-R1", "privileged", "show ip route", "Connected, static, and OSPF routes are visible."),
      s("Verify OSPFv3 neighbors", "Confirm IPv6 adjacency evidence.", "CE-HQ-R1", "privileged", "show ipv6 ospf neighbor", "OSPFv3 neighbor state is FULL."),
      s("Test the Factory route", "Prove the routed path to Factory to Foundation.", "CE-HQ-R1", "privileged", "ping 10.30.0.10", "Success rate is 100 percent. The routed path is reachable.")
    ]
  },
  {
    id: 4, code: "LAB 04", title: "Services + Management", domain: "IP SERVICES", blurb: "Operate the Construction Enterprises network: DHCP, NAT/PAT, NTP, DNS awareness, SSH, syslog, and management verification.", topology: "CE-HQ-R1 · service edge for HQ + Factory", devices: [{ name: "CE-HQ-R1", role: "Services edge router" }, { name: "CE-NET-MGMT", role: "Management workstation" }],
    steps: [
      s("Enter services router privileged mode", "Start at the Construction Enterprises service edge.", "CE-HQ-R1", "user", "enable", "Privileged EXEC mode entered."),
      s("Enter services configuration mode", "Open the full IOS configuration context.", "CE-HQ-R1", "privileged", "configure terminal", "Global configuration mode entered."),
      s("Reserve gateway addresses", "Protect the first addresses in the production subnet.", "CE-HQ-R1", "config", "ip dhcp excluded-address 192.168.20.1 192.168.20.20", "Production gateway range excluded from DHCP."),
      s("Create the production DHCP pool", "Create a named service pool for Factory to Foundation.", "CE-HQ-R1", "config", "ip dhcp pool FTF-PRODUCTION", "DHCP pool configuration mode entered."),
      s("Set the DHCP network", "Define the production client subnet.", "CE-HQ-R1", "dhcp", "network 192.168.20.0 255.255.255.0", "DHCP network applied."),
      s("Set the production default gateway", "Tell clients where to route.", "CE-HQ-R1", "dhcp", "default-router 192.168.20.1", "DHCP default gateway applied."),
      s("Set the production DNS server", "Provide the service resolver address.", "CE-HQ-R1", "dhcp", "dns-server 192.168.99.53", "DHCP DNS server applied."),
      s("Leave DHCP pool mode", "Return to global configuration.", "CE-HQ-R1", "dhcp", "exit", "Returned to global configuration mode."),
      s("Permit inside addresses for NAT", "Define the inside client range.", "CE-HQ-R1", "config", "access-list 1 permit 192.168.20.0 0.0.0.255", "Inside production range permitted for NAT."),
      s("Select the WAN interface", "Mark the service edge outside interface.", "CE-HQ-R1", "config", "interface GigabitEthernet0/1", "WAN interface selected."),
      s("Mark WAN as NAT outside", "Set the public-facing NAT role.", "CE-HQ-R1", "interface", "ip nat outside", "WAN interface marked NAT outside."),
      s("Leave WAN interface", "Return to global configuration.", "CE-HQ-R1", "interface", "exit", "Returned to global configuration mode."),
      s("Select production gateway interface", "Mark the client-facing interface.", "CE-HQ-R1", "config", "interface GigabitEthernet0/0.20", "Production gateway interface selected."),
      s("Mark production as NAT inside", "Set the client-facing NAT role.", "CE-HQ-R1", "subinterface", "ip nat inside", "Production interface marked NAT inside."),
      s("Leave production interface", "Return to global configuration.", "CE-HQ-R1", "subinterface", "exit", "Returned to global configuration mode."),
      s("Enable PAT overload", "Translate production clients through the WAN interface.", "CE-HQ-R1", "config", "ip nat inside source list 1 interface GigabitEthernet0/1 overload", "PAT overload configured."),
      s("Set the NTP source", "Use the management address as the time source.", "CE-HQ-R1", "config", "ntp server 192.168.99.53", "NTP server configured."),
      s("Set the DNS lookup domain", "Prepare the management plane for SSH.", "CE-HQ-R1", "config", "ip domain name construction-enterprises.local", "Domain name configured."),
      s("Create the management user", "Use a local identity for secure access.", "CE-HQ-R1", "config", "username netadmin privilege 15 secret FactoryToFoundation!", "Local management user created."),
      s("Generate SSH keys", "Enable the device’s SSH server capability.", "CE-HQ-R1", "config", "crypto key generate rsa modulus 2048", "RSA keys generated for SSH."),
      s("Select VTY lines", "Configure remote management lines.", "CE-HQ-R1", "config", "line vty 0 4", "VTY line configuration mode entered."),
      s("Use the local user database", "Require the named management identity.", "CE-HQ-R1", "line", "login local", "Local VTY authentication enabled."),
      s("Restrict VTY transport", "Allow secure SSH instead of plaintext Telnet.", "CE-HQ-R1", "line", "transport input ssh", "SSH-only VTY transport configured."),
      s("Return to privileged EXEC", "Finish the services baseline.", "CE-HQ-R1", "line", "end", "Returned to privileged EXEC mode."),
      s("Verify DHCP bindings", "Inspect service state from the CLI.", "CE-HQ-R1", "privileged", "show ip dhcp binding", "DHCP bindings are visible."),
      s("Verify NAT translations", "Inspect active PAT state.", "CE-HQ-R1", "privileged", "show ip nat translations", "NAT translation evidence is visible."),
      s("Verify NTP status", "Confirm clock synchronization evidence.", "CE-HQ-R1", "privileged", "show ntp status", "NTP status is synchronized or awaiting the configured source.")
    ]
  },
  {
    id: 5, code: "LAB 05", title: "Security + Troubleshooting", domain: "SECURITY + AUTOMATION", blurb: "Harden and troubleshoot the Construction Enterprises campus with local security, ACLs, port security, DHCP snooping, and an incident workflow.", topology: "CE-HQ-DSW1 ⇄ FTF-FAB-ACC1 · incident lab", devices: [{ name: "CE-HQ-DSW1", role: "Headquarters secure distribution" }, { name: "FTF-FAB-ACC1", role: "Factory secure access" }, { name: "CE-HQ-R1", role: "Security edge router" }],
    steps: [
      s("Enter secure switch privileged mode", "Start on the headquarters distribution switch.", "CE-HQ-DSW1", "user", "enable", "Privileged EXEC mode entered."),
      s("Enter secure switch configuration", "Open the full IOS configuration context.", "CE-HQ-DSW1", "privileged", "configure terminal", "Global configuration mode entered."),
      s("Set the enable secret", "Protect privileged EXEC mode.", "CE-HQ-DSW1", "config", "enable secret ConstructionSecure!", "Enable secret configured."),
      s("Create the local administrator", "Create an administrative identity for recovery.", "CE-HQ-DSW1", "config", "username netadmin privilege 15 secret ConstructionSecure!", "Local administrator created."),
      s("Set the management domain", "Prepare secure management key generation.", "CE-HQ-DSW1", "config", "ip domain name construction-enterprises.local", "Management domain configured."),
      s("Generate management keys", "Enable SSH cryptography.", "CE-HQ-DSW1", "config", "crypto key generate rsa modulus 2048", "RSA keys generated."),
      s("Select VTY lines", "Secure remote access lines.", "CE-HQ-DSW1", "config", "line vty 0 4", "VTY line configuration mode entered."),
      s("Use local VTY authentication", "Require the local administrator.", "CE-HQ-DSW1", "line", "login local", "Local VTY authentication enabled."),
      s("Allow SSH only", "Disable Telnet transport.", "CE-HQ-DSW1", "line", "transport input ssh", "SSH-only transport configured."),
      s("Return to global configuration", "Leave the VTY context.", "CE-HQ-DSW1", "line", "exit", "Returned to global configuration mode."),
      s("Create the production ACL", "Build the Factory to Foundation edge policy.", "CE-HQ-DSW1", "config", "ip access-list extended FTF-PRODUCTION-EDGE", "Named extended ACL configuration mode entered."),
      s("Permit production web traffic", "Allow the approved HTTPS service.", "CE-HQ-DSW1", "acl", "permit tcp 192.168.20.0 0.0.0.255 any eq 443", "HTTPS traffic permitted."),
      s("Deny unapproved production traffic", "Make the policy boundary explicit.", "CE-HQ-DSW1", "acl", "deny ip 192.168.20.0 0.0.0.255 any log", "Unapproved production traffic denied and logged."),
      s("Return to global configuration", "Leave the named ACL context.", "CE-HQ-DSW1", "acl", "exit", "Returned to global configuration mode."),
      s("Select the Factory edge port", "Apply switch security to the production endpoint.", "FTF-FAB-ACC1", "user", "enable", "Privileged EXEC mode entered."),
      s("Enter Factory switch configuration", "Open the access-switch configuration context.", "FTF-FAB-ACC1", "privileged", "configure terminal", "Global configuration mode entered."),
      s("Enable DHCP snooping", "Protect against unauthorized DHCP servers.", "FTF-FAB-ACC1", "config", "ip dhcp snooping", "DHCP snooping enabled globally."),
      s("Trust the production uplink VLAN", "Scope snooping to the production VLAN.", "FTF-FAB-ACC1", "config", "ip dhcp snooping vlan 20", "DHCP snooping enabled for VLAN 20."),
      s("Select production access port", "Apply endpoint-facing security.", "FTF-FAB-ACC1", "config", "interface FastEthernet0/1", "Production access port selected."),
      s("Enable port security", "Restrict the endpoint MAC address surface.", "FTF-FAB-ACC1", "interface", "switchport port-security", "Port security enabled."),
      s("Limit learned MAC addresses", "Permit only one production endpoint.", "FTF-FAB-ACC1", "interface", "switchport port-security maximum 1", "Maximum secure MAC count set to one."),
      s("Use sticky MAC learning", "Learn and retain the endpoint identity.", "FTF-FAB-ACC1", "interface", "switchport port-security mac-address sticky", "Sticky secure MAC learning enabled."),
      s("Set violation behavior", "Shut down on a security violation.", "FTF-FAB-ACC1", "interface", "switchport port-security violation shutdown", "Violation shutdown behavior configured."),
      s("Return to privileged EXEC", "Prepare for incident verification.", "FTF-FAB-ACC1", "interface", "end", "Returned to privileged EXEC mode."),
      s("Inspect secure MAC state", "Read the evidence before changing anything.", "FTF-FAB-ACC1", "privileged", "show port-security interface FastEthernet0/1", "Port-security state and violation counters are visible."),
      s("Inspect DHCP snooping bindings", "Confirm the trusted path and learned bindings.", "FTF-FAB-ACC1", "privileged", "show ip dhcp snooping binding", "DHCP snooping binding evidence is visible."),
      s("Inspect ACL application", "Verify the named production policy.", "CE-HQ-DSW1", "user", "enable", "Privileged EXEC mode entered."),
      s("Verify ACL matches", "Read the security policy counters.", "CE-HQ-DSW1", "privileged", "show ip access-lists FTF-PRODUCTION-EDGE", "Named ACL entries and hit counters are visible."),
      s("Complete the incident ping", "Use evidence to confirm the approved path remains reachable.", "CE-HQ-R1", "user", "enable", "Privileged EXEC mode entered."),
      s("Test the approved Factory endpoint", "Close the incident workflow with an end-to-end test.", "CE-HQ-R1", "privileged", "ping 192.168.20.10", "Success rate is 100 percent. Security controls and reachability are verified.")
    ]
  }
];


function initialSessions(lab: Lab): Record<string, Session> {
  return Object.fromEntries(lab.devices.map((device) => [device.name, boot(device.name, device.role)]));
}


export default function Home() {
  const [selectedLab, setSelectedLab] = useState(1);
  const [sandboxOpen, setSandboxOpen] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "sandbox");
  const lab = labs[selectedLab - 1];
  const [stepIndex, setStepIndex] = useState(0);
  const [sessions, setSessions] = useState<Record<string, Session>>(() => initialSessions(lab));
  const [activeDevice, setActiveDevice] = useState(lab.steps[0].device);
  const [input, setInput] = useState("");
  const [hint, setHint] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const step = lab.steps[Math.min(stepIndex, lab.steps.length - 1)];
  const session = sessions[activeDevice];
  const prompt = modePrompt(activeDevice, session);
  const complete = stepIndex >= lab.steps.length;
  const percent = Math.round((stepIndex / lab.steps.length) * 100);

  function selectLab(id: number) {
    const nextLab = labs[id - 1];
    setSelectedLab(id); setStepIndex(0); setSessions(initialSessions(nextLab)); setActiveDevice(nextLab.steps[0].device); setInput(""); setHint(false);
  }
  function reset() { setStepIndex(0); setSessions(initialSessions(lab)); setActiveDevice(lab.steps[0].device); setInput(""); setHint(false); toast("Lab reset", { description: `${lab.code} is ready at the first IOS prompt.` }); }
  function submit(value = input) {
    const raw = value.trim();
    if (!raw) return;
    const current = sessions[activeDevice];
    const visiblePrompt = modePrompt(activeDevice, current);
    const updatedHistory = [...current.history, `${visiblePrompt} ${raw}`];
    const expectedDevice = step.device;
    const expectedMode = step.mode;
    const normalized = raw.replace(/\s+/g, " ");
    if (complete) {
      setSessions((all) => ({ ...all, [activeDevice]: { ...current, history: [...updatedHistory, "Lab complete. Reset to run this sequence again."] } })); setInput(""); return;
    }
    if (activeDevice !== expectedDevice || current.mode !== expectedMode || normalized !== step.command) {
      const reason = activeDevice !== expectedDevice ? `Switch to ${expectedDevice}.` : current.mode !== expectedMode ? `Use the ${expectedMode === "user" ? "user EXEC" : expectedMode === "privileged" ? "privileged EXEC" : expectedMode} prompt.` : `Expected the full command: ${step.command}`;
      setSessions((all) => ({ ...all, [activeDevice]: { ...current, history: [...updatedHistory, "% Invalid input detected at '^' marker.", `Hint: ${reason}`] } })); setInput(""); return;
    }
    const transition = nextMode(normalized, current.mode);
    const nextSession: Session = { ...current, mode: transition.mode, context: transition.context, history: [...updatedHistory, step.success] };
    setSessions((all) => ({ ...all, [activeDevice]: nextSession }));
    setStepIndex((index) => index + 1); setInput(""); setHint(false);
  }
  function runSuggested() {
    if (complete) return;
    if (activeDevice !== step.device) { setPendingCommand(step.command); setActiveDevice(step.device); setInput(""); setHint(false); return; }
    if (session.mode !== step.mode) { setInput(step.mode === "privileged" ? "enable" : step.mode === "config" ? "configure terminal" : step.mode === "user" ? "" : "exit"); setHint(true); return; }
    submit(step.command);
  }
  const recent = session.history.slice(-12);
  const currentDeviceRole = lab.devices.find((device) => device.name === activeDevice)?.role;
  const allDone = useMemo(() => complete, [complete]);
  useEffect(() => {
    if (pendingCommand && activeDevice === step.device) {
      const command = pendingCommand;
      setPendingCommand(null);
      submit(command);
    }
  }, [activeDevice, pendingCommand, step.device]);
  if (sandboxOpen) return <NetworkSandbox onExit={() => setSandboxOpen(false)} />;

  return <main className="min-h-screen overflow-hidden bg-[#0b1118] text-[#f2f5f5]">
    <header className="border-b border-white/10 bg-[#0b1118]/95 backdrop-blur-md"><div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 lg:px-8"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#63e6e2]/40 bg-[#10252b]"><img src="/manus-storage/ipv6-trace-mark_f814341b.png" alt="Cisco CLI Labs mark" className="h-8 w-8 object-contain" /></div><div><div className="font-mono text-[11px] uppercase tracking-[.22em] text-[#63e6e2]">IPv6 CLI Lab</div><div className="font-display text-lg font-semibold tracking-tight">Packet Observatory</div></div></div><div className="hidden items-center gap-3 text-xs text-[#98a8b0] sm:flex"><span>CONSTRUCTION ENTERPRISES</span><span className="h-1.5 w-1.5 rounded-full bg-[#63e6e2] shadow-[0_0_10px_#63e6e2]" /><span className="font-mono">CISCO IOS TRAINING CONSOLE</span></div></div></header>
    <nav className="border-b border-white/10 bg-[#0d151e] px-5 py-3 lg:px-8"><div className="mx-auto flex max-w-[1500px] items-center gap-2 overflow-x-auto"><span className="mr-2 shrink-0 font-mono text-[10px] uppercase tracking-[.16em] text-[#667780]">Curriculum</span><button type="button" onClick={() => setSandboxOpen(true)} className="flex shrink-0 items-center gap-2 rounded-lg border border-[#f5b74b]/40 bg-[#2a2112] px-3 py-2 text-left text-[#f4d998] transition hover:border-[#f5b74b]/70 hover:bg-[#3a2a16]"><Network className="h-3.5 w-3.5" /><span className="font-mono text-[10px] uppercase tracking-wider">Network Sandbox</span></button>{labs.map((item) => <button key={item.id} onClick={() => selectLab(item.id)} className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${selectedLab === item.id ? "border-[#63e6e2]/40 bg-[#173038] text-white" : "border-white/10 bg-[#101923] text-[#7f9098] hover:border-white/20 hover:text-white"}`}><span className="font-mono text-[10px] text-[#63e6e2]">{item.code}</span><span className="text-xs">{item.title}</span>{item.id === selectedLab && <span className="rounded bg-[#f5b74b]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#f5b74b]">ACTIVE</span>}</button>)}</div></nav>
    <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[270px_1fr]">
      <aside className="border-b border-white/10 bg-[#0d151e] lg:min-h-[calc(100vh-121px)] lg:border-b-0 lg:border-r"><div className="p-5 lg:sticky lg:top-0"><div className="mb-7 flex items-center justify-between"><div><div className="instrument-label">LAB PATH</div><div className="mt-1 text-sm text-[#9eacb2]">{lab.domain}</div></div><TerminalSquare className="h-4 w-4 text-[#f5b74b]" /></div><div className="mb-6 rounded-xl border border-white/10 bg-[#111c27] p-4"><div className="text-xs font-semibold text-white">{lab.title}</div><p className="mt-2 text-xs leading-5 text-[#8fa0a7]">{lab.blurb}</p><div className="mt-4 font-mono text-[10px] uppercase tracking-wider text-[#63e6e2]">{lab.topology}</div></div><nav className="space-y-1.5" aria-label="Lab command path">{lab.steps.slice(0, Math.min(lab.steps.length, 16)).map((item, index) => { const done = index < stepIndex; const current = index === stepIndex && !complete; return <button key={`${item.command}-${index}`} onClick={() => { setActiveDevice(item.device); if (index <= stepIndex) setStepIndex(index); }} className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${current ? "bg-[#173038] text-white shadow-[inset_3px_0_0_#63e6e2]" : "text-[#82919a] hover:bg-white/[.04] hover:text-white"}`}><span className="w-5 font-mono text-[10px] text-[#667780]">{String(index + 1).padStart(2, "0")}</span>{done ? <Check className="h-3.5 w-3.5 text-[#63e6e2]" /> : <span className="h-3.5 w-3.5 rounded-full border border-[#53646d]" />}<span className="min-w-0 flex-1 truncate text-xs">{item.title}</span></button>; })}{lab.steps.length > 16 && <div className="px-3 py-2 font-mono text-[10px] text-[#667780]">+ {lab.steps.length - 16} more IOS commands below</div>}</nav><div className="mt-7 border-t border-white/10 pt-5"><div className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-wider text-[#77858d]"><span>Progress</span><span className="text-[#63e6e2]">{percent}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#63e6e2] transition-all duration-300" style={{ width: `${percent}%` }} /></div><p className="mt-3 text-xs leading-relaxed text-[#6d7b83]">Type the command. Read the prompt. Trust the evidence.</p></div></div></aside>
      <section className="relative min-w-0"><div className="absolute inset-0 opacity-25" style={{ backgroundImage: "url('/manus-storage/packet-observatory-texture_96a51270.jpg')", backgroundSize: "cover", backgroundPosition: "top right" }} /><div className="relative mx-auto max-w-[1240px] px-5 py-7 lg:px-10 lg:py-9"><div className="mb-6 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="instrument-label text-[#f5b74b]">{lab.code} · {lab.domain}</div><h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold tracking-[-.03em] text-white md:text-5xl">{lab.title}<br /><span className="text-[#63e6e2]">Practice the signal.</span></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#b4c1c5]">{lab.blurb}</p></div><Button variant="outline" className="border-white/15 bg-[#101923]/70 text-[#aab8bd] hover:bg-white/10 hover:text-white" onClick={reset}><RotateCcw className="mr-2 h-4 w-4" /> Reset {lab.code}</Button></div>
        <div className="mb-7 grid gap-4 xl:grid-cols-[1.05fr_.95fr]"><div className="panel-surface p-5"><div className="instrument-label text-[#f5b74b]">PACKET TRACE / OPERATIONAL CONTEXT</div><div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0e1720] p-4 font-mono text-center text-xs">{lab.devices.map((device, index) => <div key={device.name} className="flex min-w-0 flex-1 items-center gap-2"><button type="button" aria-pressed={activeDevice === device.name} aria-label={`Connect console to ${device.name}`} onClick={() => { setActiveDevice(device.name); setInput(""); setHint(false); }} className={`min-w-0 flex-1 rounded-lg border px-2 py-3 transition hover:border-[#63e6e2]/60 hover:bg-[#173038] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63e6e2] ${activeDevice === device.name ? "border-[#63e6e2]/40 bg-[#173038]" : "border-white/10 bg-[#111c27]"}`}><div className="truncate text-[#63e6e2]">{device.name}</div><div className="mt-1 truncate text-[9px] text-[#718189]">{device.role}</div></button>{index < lab.devices.length - 1 && <div className="h-px w-5 shrink-0 bg-[#385159]" />}</div>)}</div><div className="mt-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-[#77858d]"><span className="h-px flex-1 bg-gradient-to-r from-[#63e6e2] to-transparent" /><span>{lab.topology}</span><span className="h-px flex-1 bg-gradient-to-l from-[#63e6e2] to-transparent" /></div></div><div className="panel-surface p-5"><div className="flex items-center justify-between"><div className="instrument-label text-[#63e6e2]">CURRENT PACKET TRACE</div><span className="status-pill"><span className="status-dot" /> {complete ? "COMPLETE" : `${stepIndex + 1}/${lab.steps.length}`}</span></div><div className="mt-3 font-display text-xl font-semibold text-white">{allDone ? "Evidence accepted." : step.title}</div><p className="mt-2 text-sm leading-6 text-[#aebbc0]">{allDone ? "You completed the full IOS command path for this lab." : step.description}</p>{!allDone && <div className="mt-4 rounded-lg border border-[#f5b74b]/20 bg-[#f5b74b]/10 p-3"><div className="font-mono text-[10px] uppercase tracking-wider text-[#f5b74b]">Required context</div><div className="mt-2 flex flex-wrap gap-2 text-xs text-[#f4d998]"><span>{step.device}</span><span>·</span><span>{step.mode === "user" ? "user EXEC" : step.mode === "privileged" ? "privileged EXEC" : step.mode}</span></div>{hint && <div className="mt-3 border-t border-[#f5b74b]/20 pt-3 font-mono text-xs leading-5 text-[#f4d998]">Next exact command: <strong>{step.command}</strong></div>}</div>}</div></div>
        <div className="terminal-shell"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#111b24] px-5 py-3"><div className="flex items-center gap-2"><div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#f07178]" /><span className="h-2.5 w-2.5 rounded-full bg-[#f5b74b]" /><span className="h-2.5 w-2.5 rounded-full bg-[#63e6e2]" /></div><span className="ml-2 font-mono text-[10px] uppercase tracking-[.18em] text-[#74848d]">ios-sim / {activeDevice}</span></div><span className="font-mono text-[10px] uppercase tracking-wider text-[#667780]">{currentDeviceRole}</span></div><div className="terminal-output min-h-[380px]" aria-live="polite">{recent.map((line, index) => <div key={`${line}-${index}`} className={`${line.startsWith("%") ? "text-[#f07178]" : line.startsWith("Hint:") ? "text-[#f5b74b]" : line.startsWith("Cisco") || line.includes("·") || line.startsWith("Full IOS") ? "text-[#72848d]" : line.startsWith("✓") || line.includes("applied") || line.includes("enabled") || line.includes("entered") || line.includes("configured") || line.includes("visible") || line.includes("Success") ? "text-[#b5d8d4]" : "text-[#a4b2b7]"}`}>{line || "\u00a0"}</div>)}{!complete && <div className="mt-4 flex items-center gap-2"><span className="text-[#63e6e2]">{prompt}</span><input autoFocus value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} className="min-w-0 flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-[#42535c]" placeholder="type the full Cisco IOS command..." aria-label="Cisco IOS command" /></div>}</div><div className="border-t border-white/10 bg-[#0e1720] px-5 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><Button variant="outline" size="sm" className="border-white/15 bg-transparent text-[#94a4aa] hover:bg-white/10 hover:text-white" onClick={() => setHint((value) => !value)}><CircleHelp className="mr-2 h-3.5 w-3.5" /> {hint ? "Hide hint" : "Need a nudge?"}</Button><Button variant="outline" size="sm" className="border-white/15 bg-transparent text-[#94a4aa] hover:bg-white/10 hover:text-white" onClick={() => { navigator.clipboard?.writeText(step.command); toast("Exact command copied"); }}><Copy className="mr-2 h-3.5 w-3.5" /> Copy command</Button></div><Button size="sm" className="bg-[#f5b74b] text-[#1c160b] hover:bg-[#ffca69]" onClick={runSuggested}><Play className="mr-2 h-3.5 w-3.5" /> Run suggested</Button></div></div></div>
        <div className="mt-6 grid gap-4 md:grid-cols-3"><div className="panel-surface p-4"><div className="instrument-label">ACTIVE DEVICE</div><div className="mt-2 font-mono text-sm text-[#63e6e2]">{activeDevice}</div><div className="mt-1 text-xs text-[#74838b]">{currentDeviceRole}</div></div><div className="panel-surface p-4"><div className="instrument-label">IOS PROMPT</div><div className="mt-2 font-mono text-sm text-[#f5b74b]">{prompt}</div><div className="mt-1 text-xs text-[#74838b]">Mode is derived from the command state.</div></div><div className="panel-surface p-4"><div className="instrument-label">LAB STANDARD</div><div className="mt-2 text-sm text-[#dce5e5]">Full IOS vocabulary</div><div className="mt-1 text-xs text-[#74838b]">No app-only command aliases.</div></div></div>
      </div></section>
    </div>
    <footer className="mx-auto max-w-[1500px] border-t border-white/10 px-5 py-5 font-mono text-[10px] uppercase tracking-wider text-[#687780] lg:px-10">Construction Enterprises · Factory to Foundation · Browser-based IOS training simulator · Documentation addresses only</footer>
  </main>;
}
