***

# Cisco CLI Labs: Unified Guided Sandbox

**Cisco CLI Labs** is a professional browser-based Cisco IOS training simulator for CCNA 200-301. It utilizes a **Unified Guided Sandbox** architecture, treating all learning paths as visual topologies with an integrated instructional "Mission Brief" overlay.

The simulator is presented as a Construction Enterprises training console. It models a focused set of command contexts, device states, and verification outputs to provide a repeatable, low-stakes environment for mastering the Cisco CLI.

## Learning Platform Improvements

### Master Tranche One: Curriculum Sequence

Master Tranche One's Tranches One-Four include **160 original vocabulary matching cards** across 22 labs and their generated sandbox counterparts. Single four-choice cards are interleaved with existing steps rather than grouped into quiz blocks. The **Networking Vocabulary** ribbon button also provides a standalone, sequential review deck containing every authored card. They cover addressing, switching, routing, services, and introductory security, wireless, and automation terminology. Security vocabulary is previewed before Tranche Five, which remains IOS-only. Guided mode keeps worked explanations visible; Assisted mode provides them on request; Assessment mode hides walkthroughs. When assistance is enabled, checking an answer explains all four choices. Correct card completion contributes to saved lesson evidence. These are learning questions, not actual exam items or a claim of complete CCNA exam coverage.

Original command and worksheet IDs are preserved. Existing checkpoints retain device configurations and answer evidence, but their numeric step position may point to a different section after cards are inserted; use Lab Path to resume the desired section. New vocabulary requires its own completion evidence.

Tranche One retains its four fundamentals lessons followed by VLAN Basics. The remaining existing labs follow this prerequisite-based sequence:

| Tranche | Focus | Lab order |
| --- | --- | --- |
| Two | Applied addressing and discovery | IPv4 Interface Fundamentals; Binary, CIDR, and Broadcast Boundaries; IPv6 Interface Fundamentals; IPv6 Subnetting and Point-to-Point Links; VLSM Dual-Stack Address Plan; Broadcasts and IPv6 Neighbor Discovery |
| Three | Switching and LAN services | VLAN Access Ports; 802.1Q Trunking; STP Root Bridge Basics; Router-on-a-Stick Inter-VLAN Routing; DHCPv4 Server Basics |
| Four | Routing and resilience | Static Route Fundamentals; OSPFv2 Multi-Platform Single-Area Routing; OSPF DR/BDR and Network Types; OSPFv3 IPv6 Routing; First Hop Redundancy Protocols; IPv4 and IPv6 Multicast Foundations |
| Five | Security and edge policy | Switch Port Security; Secure Remote Access with SSH; Standard ACL Filtering; Extended ACL Web Policy; NAT Overload with PAT |

Addressing practice now precedes routed networks, VLANs and trunks precede inter-VLAN routing, static routes precede OSPF, and ACLs precede ACL-based PAT. The older binary/CIDR lab is retained as applied IOS practice after the new worksheet foundations. All 22 existing labs in Tranches Two-Five remain available (6/5/6/5 labs); none were dropped to force equal counts. Sandbox counterparts follow the same placement and order, with older companion scenarios following their related lesson. Stable lab IDs retain their historical prefixes for saved-attempt compatibility; use curriculum placement, not the ID prefix, to identify the current tranche. Master Tranches Two-Five are unchanged by this reorganization.

### Master Tranche One / Tranche One: Addressing Fundamentals

Four additional lessons preserve the existing curriculum and also have Network Sandbox counterparts:

- **Binary and Addressing Foundations:** bits, octets, decimal/binary conversion, hexadecimal, and binary AND.
- **IPv4 Addressing: Every Prefix /0 to /32:** all 33 prefixes, masks, wildcards, boundaries, host-address exceptions, and public/private, multicast, broadcast, and special-purpose ranges.
- **IPv4 Subnet Planning and Wildcard Masks:** capacity, equal-sized subnets, VLSM, overlap, wildcard matching, aggregation, and longest-prefix selection.
- **IPv6 Addressing and Subnetting Masterclass:** notation, subnet IDs, FE80 link-local, ULA, global unicast, multicast scopes, anycast, special-purpose and legacy ranges, NDP, SLAAC, DHCPv6, and interface identifiers.

These lessons use answer-checked worksheets followed by practical router configuration. Guided mode retains full worked explanations throughout; Assisted mode offers explanations on request, and Assessment mode hides walkthroughs. Assistance never fades automatically. Worksheet completion is saved with session/checkpoint evidence, and each lesson ends with IOS address configuration and verification. Standards references are linked within the worksheets.

Successful IPv4 `ping` commands in the Network Sandbox start a persistent cyan request and amber reply flow along the validated cables in Schematic, Logical, and 3D views. The flow includes the checked return route and keeps circulating while its modeled path remains valid. Switching views preserves its timeline. A change that breaks forwarding stops the flow and reports the diagnostic state.

The **Learning workspace** in guided labs and their Network Sandbox counterparts provides:

- **Outcomes:** configuration-state grading, including equivalent VLAN lists, rather than requiring one exact command sequence in assisted and assessment modes.
- **Learning modes:** guided command practice, assisted configuration, and a fresh assessment with command assistance disabled. Starting fresh preserves the previous state as a checkpoint.
- **Diagnostics:** Layer 2 VLAN-path checks and modeled IPv4 hop diagnostics with blocking-port and selected firewall-policy evidence.
- **Protocols:** shared OSPFv2/OSPFv3 process, area, interface, neighbor, LSDB, SPF/timer, capability, event, cost-based route, and segment-local DR/BDR evidence; LACP negotiation; DHCP client/lease evidence; and FHRP state. The FHRP tab models HSRP/VRRP roles and GLBP virtual IPs, AVG election, AVFs, load-sharing algorithm, and forwarding weights. OSPF routes and adjacencies react to modeled configuration faults.
- **Checkpoints:** named local snapshots, configuration comparisons, and restore with an automatic undo snapshot.
- **Skills:** browser-local attempt scores, hint/error counts, and practice recommendations.
- **Authoring:** isolated JSON drafts, validation, and export. Saving a draft does not install it into the curriculum.

### Master Tranche Five: Troubleshooting

Each of the five sub-tranches starts with one seeded-fault exercise: Silent Access Port, Wrong Department VLAN, Pruned Trunk, LACP Passive Deadlock, and OSPF Area Mismatch. Each also has a Network Sandbox counterpart. These additions do not reorganize Master Tranche One.

LACP Passive Deadlock starts with a configured office network on both switches: Engineering VLAN 10, Services VLAN 20, Management VLAN 99, and unused native VLAN 999. The AP access port belongs to VLAN 10 and the application server belongs to VLAN 20. Matching physical-member/Port-channel trunk settings and management SVIs are seeded; passive/passive negotiation is the intended fault. The repair must preserve the existing VLANs, allowed list, and native VLAN. The spare g0/1 cable remains unused; g0/2 is the modeled channel member under investigation. Existing saved attempts need a checkpoint and lab reset to load this expanded baseline.

### Master Tranche Four: IT Tech Support

Five support-ticket exercises are distributed across the five sub-tranches, each with an automatically derived Network Sandbox counterpart and the existing guided/help-if-asked/assessment workspace:

| Sub-Tranche | Exercise | Commands |
| --- | --- | --- |
| One | New Employee Workstation Onboarding: access VLAN, endpoint addressing, gateway, and application reachability | 32 |
| Two | DHCP and Internal DNS Service Desk: infrastructure exclusions, scope options, client lease, and internal name resolution | 37 |
| Three | Shared Printer Connectivity Support: incorrect subnet repair, printer gateway, and employee/control-printer tests | 32 |
| Four | Wireless Access Point Support: disabled management uplink and documented SSID/band/channel/power profile | 32 |
| Five | Secure Remote Administration Handoff: management SVI, local account, SSH-only VTY intent, and configuration persistence | 30 |

Each ticket starts with an incomplete or faulty state, provides device-specific inspection/configuration/verification steps, and grades explicit configuration outcomes. Topologies include relevant workstations, switches, gateways, servers, printers, and an access point. This adds five initial labs, not five labs per sub-tranche. Master Tranche One's curriculum definitions are unchanged.

Each Master Tranche Four sub-tranche now also includes a defensive cybersecurity incident: rogue access-device containment, unauthorized remote-access hardening, rogue wireless-profile review, phishing DNS recovery, and malware containment policy. These labs use the same guided and sandbox behavior as support tickets, with an emphasis on careful evidence collection, scoped remediation, escalation context, and post-change verification.

### Master Tranche Five: Advanced Network Defense

Master Tranche Five retains its original troubleshooting sequence and now adds one advanced defensive-security investigation in every sub-tranche: simulated MITM/ARP defense, VLAN-hopping defense, rogue-DHCP recovery, OSPF route-injection defense, and TLS reverse-proxy hardening. The scenarios model the controls and verification workflow required to detect, contain, and recover from these incident classes. They do not simulate exploit execution, packet interception, credential theft, or real-world attack operations.

### Master Tranche Six: Authorized Red Team and Blue Team

Master Tranche Six is a simulator-only ethical-hacking curriculum with Blue Team remediation, Red Team authorized-validation, Red Team pentesting-simulation, and Target Range Purple Team labs. Blue Team exercises cover asset-edge defense, web/API boundaries, remote-access controls, lateral-movement controls, and routing-incident response. Red Team validation exercises cover passive reconnaissance, web/API exposure validation, identity-policy review, segmentation-path review, and control-plane review. The simulated pentesting track covers scoped service exposure, web-boundary validation, remote-access policy, segmentation proof of control, and routing-control-plane findings.

Red Team activities are deliberately evidence-only and scoped to this application. The pentesting simulations use deliberately labeled, in-app conditions and stop at a documented proof of control; they do not include scanning, exploitation, packet interception, credential attacks, route injection, payloads, packet crafting, pivoting, bypass activity, or any interaction with real systems. Every Red Team finding is paired with modeled Blue Team documentation, hardening, or verification behavior.

Fourteen Target Range Purple Team scenarios use the shared fictional assets: CAM-01 VLAN boundary, SENSOR-01 DHCP integrity, BADGE-01 ARP integrity, CAM-01 OT boundary, `training-api.example` service boundary, PRINT-01 synthetic recovery drill, LEGACY-FTP-01 service retirement, FILE-01 shared access policy, BASTION-01 remote administration hygiene, KDC-01 directory trust boundary, CACHE-01 authentication-anomaly response, DNS-01 service inventory, CONTAINER-API-01 runtime boundary, and MONITOR-01 SNMP management state. They pair Red Team evidence collection with Blue Team remediation and retest. DHCP snooping, Dynamic ARP Inspection, modeled API rate limiting, modeled API token enforcement, SSH-only administration, SNMP management state, and explicit service-boundary ACLs are deterministic IOS configuration and verification state; lease exhaustion, rogue offers, ARP anomalies, OT impact, API findings, service inventory, identity risk, authentication anomalies, container policy drift, and file-integrity alerts remain synthetic telemetry rather than external actions.

Target-range labs separate the two operating environments: Cisco nodes expose an IOS-only console, while ATTACKER-KALI exposes a dedicated synthetic Linux attack console. The attacker console supports real-tool-shaped Nmap service and targeted-port inventory, SNMP walk and session-scoped SNMP set, Metasploit console/search/info/module/RHOSTS/run workflow, Python reporting scripts, TLS inspection with `openssl s_client`, HTTP checks with `curl`, and socket, process-status, and journal inspection through `ss`, `/proc`, and `journalctl`. Both consoles observe the same deterministic target and ACL state, so a Cisco ACL can change a later synthetic Nmap result from open to filtered.

Every Master Tranche Six Red Team, Red Team Simulation, and Purple Team lab now uses this target-range architecture. Each has an `ATTACKER-KALI` shell endpoint, a named fictional target, and shell-mode evidence steps backed by that target's address, VLAN, zone, permitted-work boundary, and modeled listener inventory. Cisco commands stay on Cisco devices for configuration and verification; the assessment workstation never accepts IOS commands, and Cisco devices never accept Linux assessment tools.

CONTAINER-API-01 uses a behavioral synthetic runtime rather than an image or live container. It models ingress TLS and certificate state, bearer-token enforcement, a token-bucket rate limit, health, audit events, a TCP listener/backlog, Linux-style namespaces, cgroup resource counters, capabilities, seccomp identity, and allowed/blocked syscall evidence. Commands update only this in-memory model, so a TLS enablement, authorization policy, or ACL deterministically changes later attacker-console results and runtime telemetry. Every attack-console command accepts only a fictional range alias. No image pull, container shell, packet, DNS query, socket, process, host resolution, external tool, account, credential, file, ticket, or network action exists outside the current application session.

Endpoint commands use the simulator's IOS-style console, not real Windows/Linux shell syntax. Printer drivers/spoolers, RF coverage/interference, WPA authentication, real SSH sessions, and production cryptographic key generation are outside these exercises. Training credentials must never be reused on real devices.

### Training Data Range

The `Data` menu opens the simulated traffic fabric and an in-app target range. The target range contains nineteen fictional websites, PCs, servers, containers, and IoT devices, each with a modeled address, VLAN, zone, condition, and explicit authorized learning boundary. CONTAINER-API-01 additionally exposes fictional image, runtime, network, port, environment, health, restart, volume, log, and finding metadata. These entries are curriculum context for ethical-security labs, not live hosts, live websites, or actionable target information.

### Validation and Model Boundaries

Run `pnpm run check`, `pnpm run test:learning`, `pnpm run audit:labs`, and `pnpm run build` from the project root. The walkthrough audit replays authored commands through the shared executor and checks modeled outcomes; it is not an independent test of real Cisco hardware behavior. Exercises without measurable outcomes are explicitly warned about.

This remains an instructional simulator. OSPF uses a deterministic command-driven clock rather than wall-clock packet scheduling, but it models process lifecycle, SPF events, pacing timers, adjacency compatibility, area types, DR/BDR roles, multi-area summaries, and an instructional LSDB. IPv4 probes use longest-prefix forwarding, detect routing loops, check both request and reply paths, and evaluate ordered standard/extended ICMP ACL rules with implicit deny. Unsupported ACL matches are reported conservatively, not treated as verified delivery. These checks do not emulate every IOS ACL, NAT, transport, or RFC implementation detail. DHCP expiry is evaluated when evidence is rendered or requested, not by a background lease-renewal service. Progress, drafts, and checkpoints are browser-local and are not account-synchronized.

Trunk allowed-VLAN state supports complete lists and `add`/`remove` operations. The sandbox compresses the resulting set into ranges for evidence and path checks; it does not attempt to reproduce every IOS switchport negotiation nuance.

Packet diagnostics infer host VLANs from configured access ports and reject destination addresses on disabled interfaces. Shared OSPF neighbor checks respect adjacency faults; `show ip ospf database` and `show ipv6 ospf database` render the same deterministic per-area LSDB used by live evidence. `show vlan brief` lists configured access-port membership while excluding trunk ports.

The **IPv4 Routes** verification tab and modeled route commands share connected, static, and OSPF route evidence. The **MAC Address > Learned MAC Table** view uses the same identity and forwarding model as the CLI in both guided labs and sandboxes. Troubleshooting baselines seed active endpoints and healthy links: Silent Access Port shows the phone and camera on VLAN 10 before repair, while the workstation is learned only after its port is enabled. Learning represents deterministic modeled source traffic, not captured packets. Existing saved attempts retain their original configuration; reset the lab to load a new baseline, after preserving any work in a checkpoint.

The ten-improvement initiative has working foundations across all ten areas. Packet diagnostics, cross-view evidence consistency, and protocol fidelity remain in hardening; their initial implementation should not be mistaken for complete network emulation.

## Guided Packet Visualization

Every tranche lab can present a compact, protocol-aware packet trace alongside the command objective. The shared `GuidedPacketTrace` component keeps the animation visible in a fixed-height frame so packet movement never pushes the IOS console out of view. Frames are initially shown in standby, then activate as the learner enters meaningful configuration or verification commands.

The traces are instructional models, not live packet captures. Each frame identifies the participating devices, direction, traffic kind, Layer 2 destination, Layer 3 destination, and the protocol event being demonstrated. Profiles cover common CCNA flows including DHCP DORA, IPv4 and IPv6 neighbor discovery, VLAN and trunk traffic, STP control traffic, EtherChannel, router-on-a-stick, static routing, OSPFv2/v3, NAT/PAT, ACL decisions, SSH, port security, CIDR/VLSM, multicast, and broadcast behavior. Tranche labs are separate from the Network Sandbox and Operations Sandbox: they provide guided command practice, while the two sandboxes provide open topology construction and physical field-work simulation.

## CLI Learning Workspace

The guided IOS console is optimized for keeping the next command and the evidence visible together:

* **Three-line live viewport:** The terminal shows the latest three rendered command/result lines. An invalid command consumes two lines, making mistakes visible without allowing old output to crowd out the current task.
* **Scrolling startup context:** The Cisco IOS banner and device identity enter the same scrolling history as later commands instead of remaining as a permanent block.
* **Command History:** The terminal header opens a full per-device command history overlay without changing the console height.
* **Live verification tables:** A dedicated panel below the IOS simulator exposes the active device's modeled interface inventory, IP address, default gateway, ARP, MAC address, trunk, EtherChannel, explicit LACP/static bundle protocol, ACL, NAT/PAT, Transport / Flows, and OSPF state while the learner builds that state through the CLI. The OSPF dashboard includes process, area, interface, neighbor, LSDB, LSA accounting, SPF/pacing timer, capability, and event-log sections. Interface evidence includes every modeled port, parent/VLAN/encapsulation relationships, description, role, status, administrative state, speed/duplex, and error counters. Tables are modeled from the current session and show honest empty states when no entries have been learned or configured.
* **Resizable verification workspace:** Grab bars allow the IOS simulator and verification-table panel to be resized upward or downward within bounded heights. Each grab bar also supports keyboard adjustment with the arrow, Home, and End keys.
* **Independent panel minimization:** The IOS simulator and Live Verification Tables each have their own minimize and restore control, preserving the header while collapsing the panel body to reclaim workspace.
* **NAT/PAT command validation:** The guided IOS grammar accepts `ip nat inside source list <number> interface <interface> overload` in Global Configuration mode while continuing to reject the global command from interface configuration mode. Existing `ip nat inside` interface behavior remains supported.
* **Transport / Flows verification:** The live verification panel now exposes modeled Layer 4 protocol evidence with TCP/UDP, application, source and destination ports, state, and source action. The NAT/PAT overload command creates a deterministic TCP/HTTPS PAT flow, while `ip address dhcp` records a modeled UDP DHCP discovery.
* **Collapsible lab header:** The tranche identifier and lab title remain available in a compact bar while the larger description can be collapsed to make room for the packet trace and CLI.
* **Fixed visual rhythm:** Packet traces use a stable viewport height and compact spacing so activating a new frame does not move the console underneath it.
* **Packet-trace playback control:** The slide counter is an accessible Pause/Resume button. Pausing freezes the current frame and counter without changing lab progress or IOS session state. NAT/PAT playback remains in standby until the accepted `ip nat inside source list 1 interface g0/1 overload` command creates the translation rule, rather than animating during interface preparation.
* **Modeled neighbor learning:** The IPv4 Interface Fundamentals lab includes a deterministic `ping 192.168.10.10` traffic step. The IOS model records the resulting branch-host ARP entry and dynamic MAC entry so the ARP and MAC verification tabs show the same evidence described by the packet trace.
* **Context-aware tranche traffic:** Routed IPv4 labs now place an appropriate modeled `ping` objective immediately after their configuration objectives and before generic evidence passes. Destinations follow each lab's topology, while IPv6-only and Layer 2-only labs are not given an artificial IPv4 ping step.
* **DHCP verification:** The live verification panel includes a DHCP tab for modeled pools, leases, excluded addresses, and DHCP-client state, keeping address-assignment evidence visible alongside interfaces, ARP, MAC, NAT/PAT, and OSPF state.
* **Relationship-aware interface verification:** The IP Interfaces table now shows parent interfaces, VLAN IDs, 802.1Q encapsulation, gateway role, and derived subinterface state. A VLANs tab relates VLAN names to routed gateways, access ports, and trunk interfaces. Router-on-a-Stick explicitly configures and verifies CE-SW1 with `show vlan brief` and `show interfaces trunk`; switch-specific evidence is no longer presented as a CE-R1 command.
* **CDP verification:** Applicable tranche labs now expose a topology-backed CDP tab showing local device/interface, network-capable neighbor, remote interface, neighbor role, and the relationship type. CDP is derived from modeled topology links and does not incorrectly populate ARP or MAC state.
* **IPv6 Neighbor Discovery verification:** IPv6-capable tranche labs now expose an IPv6 Neighbors tab with global address, link-local address, MAC, interface, state, discovery method, and neighbor. When an IPv6 interface has a global address, link-local address, and is active, the engine models a Neighbor Solicitation and deterministic Neighbor Advertisement response from the connected endpoint, including V6-PC1.
* **Context-aware CDP evidence:** Generic `show cdp neighbors` evidence passes are now omitted from labs whose topology contains only hosts on the link, such as TR2 IPv6 Interface Fundamentals. CDP checks remain available where two network-capable devices are actually connected.
* **Modeled Layer 2 learning:** Active switch access ports connected to modeled PCs now learn deterministic dynamic MAC entries with the configured access VLAN and port. The MAC table therefore reflects a host frame arriving on the access link rather than treating VLAN configuration alone as a learned address.
* **State-aware trunk trace:** The 802.1Q trunking packet trace now shows untagged/pending traffic until the uplink is configured with `switchport mode trunk`; tagged 802.1Q transit appears only after the modeled trunk state is active.
* **Realistic trunk formation lab:** TR2 802.1Q Trunking now models `CE-R1 ⇄ CE-SW1 ⇄ CE-SW2 ⇄ ENG-PC1`. The guided sequence creates VLAN 10 and native VLAN 999 on both switches, configures both trunk ends, assigns the host access port, builds the router-on-a-stick VLAN 10 gateway, pings the modeled host, and verifies VLAN, MAC, trunk, and interface state on the correct devices.
* **Trunk MAC propagation:** Dynamic source-MAC learning now propagates across active trunk links for allowed VLANs and includes the router-on-a-stick gateway MAC on the VLAN 10 trunk. Switch tables therefore show locally attached and remote VLAN sources on the correct ingress ports.
* **OSPF show-command grammar:** Privileged EXEC now accepts the base `show ip ospf` command in addition to detailed neighbor and interface variants.
* **Multi-platform OSPF build:** TR3 OSPFv2 is now an extensive 88-step curriculum that builds OSPF across CE-R1, CE-R2, CE-L3SW1, CE-FW1, and CE-VR1. Each device receives Layer 3 transit addressing, interface descriptions, unique router IDs, area 0 network statements, and an explicit build completion before focused verification begins.
* **Guided OSPFv2 Network Sandbox:** Added a dedicated OSPFv2 Multi-Platform Sandbox with the same guided objects, configuration objectives, activation steps, and evidence checks as TR3-OSPFV2, while preserving the sandbox's editable topology and device state.
* **Reactive OSPF packet trace:** The operational context now progresses from process idle, through build-in-progress and Hello eligibility, to Hello/LSA/route-install milestones. The `show ip ospf neighbor` evidence pass emphasizes DBD exchange, while `show ip route ospf` emphasizes route installation.
* **OSPF DR/BDR lab:** Added a dedicated multi-access Ethernet scenario with CE-R1, CE-R2, CE-R3, and CE-SW1. The lab teaches `ip ospf priority`, `ip ospf network broadcast`, and `ip ospf cost`, and the live tables expose router ID, network type, priority, cost, and modeled DR/BDR/DROTHER roles.
* **FHRP module:** Added a separate First Hop Redundancy Protocol lab covering HSRP, VRRP, and GLBP virtual IPs, priorities, preemption, active/standby or master/backup roles, and failover-oriented operational context.
* **Combined MAC verification:** The **MAC Address** tab opens by default with a toggle between **Initialized Device MACs**—the complete unique identity inventory for every topology device—and **Learned MAC Table**—the dynamic Layer 2 forwarding database populated by modeled traffic. These are intentionally separate views inside one tab.
* **IPv6 access-switch context:** TR2 IPv6 Interface Fundamentals now models `CE-R1 ⇄ CE-SW1 ⇄ V6-PC1`. CDP can therefore show the router-to-switch neighbor while IPv6 Neighbor Discovery traverses the Layer 2 segment to the active V6-PC1 endpoint.
* **CCTV and VLAN fidelity:** The Master Tranche Two CCTV lab models a dedicated surveillance VLAN 50, an explicitly permitted trunk, camera access ports, multicast-ready routing, and switch-specific verification with `show vlan brief`, `show interfaces trunk`, and `show interfaces g0/1 switchport`. The VLAN access lab also assigns the modeled Sales endpoint to VLAN 20 before verification.
* **Expanded logical canvas:** The Network Sandbox logical diagram uses a 1440x760 grid with additional room around devices and links. The Controls menu provides bounded viewport zoom so larger topologies can be inspected without clipping or edge crowding.
* **Small Business Enterprise exercise:** The Legacy Small Business Enterprise scenario now has a full guided configuration path covering router-on-a-stick gateways, DHCP scopes, switch VLANs, trunks, LACP, wireless RF profiles, firewall zones/PAT/ACL policy, server DNS, endpoint leases, reachability, and operational verification.

These behaviors preserve the Observe -> Configure -> Verify loop while reducing unnecessary page scrolling during command entry.

### Startup and Curriculum Navigation

Both Cisco IOS terminal surfaces support context-sensitive help. Enter `?` at a prompt to list valid commands, or append it after a partial path such as `show ?`, `show ip ?`, `show interfaces ?`, or `switchport ?`. Help is read-only, respects the current IOS mode, and does not advance a guided lab. Each terminal retains full device-local scrollback and follows the active prompt when commands run. The guided CLI opens at its original 380px height with a persistent scroll lane; earlier output, including the startup banner, scrolls out of view as commands are entered. Its output can also be scrolled or resized manually.

The operational-evidence panel includes a modeled **STP** tab. It reports per-VLAN root and bridge identity, Rapid PVST mode, standard timer values, and topology-derived port role/state evidence, including edge-port, PortFast, and BPDU Guard context.

The application returns the browser viewport to the top when it boots, when a guided lab is selected, and when the user enters or exits a sandbox view. The Curriculum ribbon provides six master tranche menus. **Master Tranche One** exposes the existing guided labs through nested Tranche One–Five menus. **Master Tranche Two** contains active networking labs distributed across all five sub-tranches. **Master Tranche Four** contains IT Tech Support and defensive security incidents, **Master Tranche Five** contains troubleshooting and advanced network-defense investigations, and **Master Tranche Six** contains the authorized Red Team / Blue Team curriculum. Each active guided lab has a derived editable Network Sandbox counterpart; unused curriculum slots remain placeholders.

### Master Tranche Two

Master Tranche Two spreads its networking objectives across the five sub-tranches rather than concentrating them in one menu:

* **Tranche One:** Enterprise Voice and QoS; CCTV; NTP/PTP time services; SSL/TLS service delivery; and ICMP diagnostics.
* **Tranche Two:** Wireless and RF; wireless capacity and roaming; PPP/LCP WAN negotiation; enterprise server services; and WAN path engineering.
* **Tranche Three:** CDP/LLDP/LACP operations; Ansible readiness; REST/CRUD API operations; container service networking; and VRF segmentation.
* **Tranche Four:** Load balancing and vPC; flexible application load balancing; GLBP gateway load sharing; virtual router redundancy; and TLS reverse proxy delivery.
* **Tranche Five:** OSPFv2 multi-area routing; BGP peering; BGP route reflection; VRF-aware WAN routing; and VLSM/supernet route policy.

This intentionally avoids duplicating Master Tranche One's introductory VLSM, supernetting, and FHRP instruction. Those concepts return here only as applied enterprise designs: BGP aggregation policy and gateway resilience. These labs use the same guided packet traces, collapsible headers, IOS command history, live verification tables, and Observe -> Configure -> Verify workflow as Master Tranche One. The Network Sandbox and Operations Sandbox remain separate products with their own open-topology and field-operations workflows.

The Network Sandbox opens with its workspace and Devices panel collapsed, while retaining the first device as the IOS console target. The IOS console remains visible in a compact expanded dock at a 150px default height, and can be minimized, restored, resized, or closed by the user. Device selection and other expandable controls are user-driven rather than automatically opening additional inspection content.

The Network Sandbox **Scenarios** browser follows the same curriculum shape: Master Tranche One through Master Tranche Six each contain Tranche One through Tranche Five submenus. Every guided tranche lab also receives an editable sandbox counterpart with the same topology, device names, objectives, and IOS command path, while standalone scenarios with no tranche-lab counterpart remain under **Legacy**.

## Firewall and Traffic Fabric

The application includes a reusable simulated internet traffic layer shared by the Network Sandbox and Operations Sandbox. It models protocol flows, TCP/UDP ports, DNS, HTTP/HTTPS, ICMP, DHCP, VPN metadata, VLAN context, NAT metadata, TLS certificate trust, SSL inspection stages, policy decisions, and packet animation stages without claiming live internet reachability.

The Firewall and Edge Security Foundations sandbox uses a dedicated hardware firewall, ISP modem, provider router, inside access switch, trusted PC, and DMZ web server. Its ASA-style workflow covers outside/inside/DMZ interfaces, nameif, security levels, interface addressing, object network, dynamic PAT, named extended ACLs, access-group, default routing, and verification with interface, ACL, translation, and connection tables.

When a modeled flow crosses the firewall, the ASA decision engine reads the configured interface zones, security levels, ordered ACL entries, access-group bindings, and object PAT configuration. A denied flow stops before packet animation and reports the reason; an allowed inside-to-outside flow records the modeled translated source address. This is deterministic simulator state, not live packet inspection.

The CCNA learning boundary is explicit: ACLs, NAT/PAT, zones, security levels, stateful versus stateless filtering, routing, VPN concepts, IDS/IPS concepts, PKI, and TLS inspection are taught together, while the traffic fabric provides actual deterministic modeled flows. It does not decrypt arbitrary live browser traffic.

## 📐 The "Cockpit" Design

The simulator uses a high-efficiency 3-column professional layout designed for maximum learner focus:

*   **Left Panel (Workspace):** Select/Pan/Cable/Erase tools, snap-to-grid, searchable device palette, multi-select tag filters, and expandable device controls for building custom topologies.
*   **Center Panel (Topology):** A schematic canvas or 3D physical viewport where devices, ports, cable types, and topology relationships can be inspected and edited.
*   **Right Panel (Mission Brief):** A guided instructional rail that tracks the current objective, provides real-time operational feedback (✓/✕), and previews upcoming tasks.
*   **Bottom Dock (IOS Console):** A shared terminal engine that handles mode transitions (`user` $\rightarrow$ `privileged` $\rightarrow$ `config`) and validates commands against the lab registry.

The 3D workspace is intentionally procedural and browser-native. Device bodies, rack details, port markers, dimensions, and cable curves are generated from the network model without requiring external CAD assets.

## Session Recovery

Guided labs, network sandbox exercises, and Operations Sandbox workflows save progress locally per scenario. A browser refresh resumes the active lab with its IOS configuration sessions, topology edits, objective progress, selected device, tool selections, measurements, and operational feedback intact. Each scenario uses an isolated snapshot so switching labs cannot overwrite another exercise.

The Restart Mission control is an intentional full reset. It clears the active scenario snapshot and restores the initial topology, device sessions, objective state, selections, packet animations, and feedback. This recovery is browser-local; clearing site data, private browsing cleanup, or changing browser profiles removes it.

## Physical Sandbox Capabilities

The sandbox is designed as a state-driven network workspace rather than a static diagram:

*   **Device ecosystem:** PCs/laptops, servers, Layer 2 switches, routers, wireless access points, modems, firewalls, hubs, and console servers.
*   **Port-aware cabling:** Choose a cable and connector type, then connect compatible port-to-port endpoints. Occupied ports and incompatible cable/device combinations are rejected.
*   **Inspector:** Select a device, port, or cable to view current dimensions, tags, port type, speed, endpoint, and link state. Ctrl/Cmd-click supports multi-selection.
*   **Filtering:** Search the catalog and use expandable multi-select tag filters. Filters affect the device palette and the visible 3D topology.
*   **Switching state:** The IOS model tracks access mode, trunk mode, native VLAN, allowed VLANs, and EtherChannel membership. Trunk and EtherChannel state changes are reflected in cable presentation.
*   **VLAN overlay and port identity:** In Network Sandbox Controls, enable **VLAN overlay (2D)** to label Logical/Schematic ports and links with access VLANs or native/allowed trunk VLANs. Select a VLAN to dim unrelated membership. Endpoint VLANs are inferred from directly connected access ports; unknown or disconnected membership is not guessed. Membership does not imply forwarding, and Logical link colors retain operational state. Hover a port for its cable peer device/port, local and cabled-device IPv4 state, deterministic modeled MAC identities, VLAN membership, configured VLAN SVI, port state, and EtherChannel state. Layer 2 access ports correctly report no local IP; the connected endpoint's address is shown independently. Hover a link for both endpoint VLAN contexts and its operational state.
*   **Verification:** The simulator models commands such as `show interfaces trunk` and `show etherchannel summary` from the current session state.
*   **Protocol state foundation:** Router DHCP-server configuration tracks pools, networks, default gateways, DNS servers, and excluded addresses. The DHCP inspector and `show ip dhcp pool` expose that state.
*   **VLAN-aware DHCP path:** Modeled DHCP client requests identify the client VLAN and validate access ports, trunks, allowed VLANs, and router subinterfaces before allocating a lease. Blocked VLAN paths do not bind.
*   **ARP and MAC state:** Successful modeled leases populate gateway/client ARP mappings and dynamic switch MAC entries. Entries are removed when the learned port is shut down or its link is removed, and age after the modeled aging interval.
*   **Router-on-a-stick validation:** Cross-VLAN modeled probes require active router subinterfaces with `encapsulation dot1q` and an IP address on both VLAN paths.
*   **DNS and PoE state:** DNS host records and resolver cache state are modeled through `ip dns server`, `ip host`, and `nslookup`; switch `power inline auto` negotiates a connected AP's modeled class and wattage within the switch budget.
*   **OSPF and modeled ping:** OSPFv2 and OSPFv3 processes, router IDs, areas, interfaces, neighbors, timers, capabilities, LSAs, SPF events, and modeled routes are inspectable through the corresponding `show ip ospf` and `show ipv6 ospf` command families. Resolved ping paths produce Cisco-style modeled results and use the existing port-to-port packet visualization.
*   **Explicit interface activation practice:** Networked physical interfaces, VLAN SVIs, and port-channels remain administratively down until the learner enters `no shutdown`. Guided labs include that command as an explicit objective so the Logical Diagram visibly reflects the transition from down to up.

The simulator does not automatically bring interfaces online for convenience. Learners must use the same activation workflow expected on Cisco IOS: enter the correct interface context, issue `no shutdown`, and verify the resulting state.

## Operations Sandbox

The Operations Sandbox is a separate field-operations training environment alongside the Labs and Network Sandbox. It models operational work rather than CLI configuration: inspect, baseline, restore, and document physical infrastructure.

Current foundation:

* **Scenario ribbon:** Operations scenarios are selected from a compact command ribbon instead of large static cards. Available, planned, and active scenario states are visible without hiding the operational curriculum.
* **Procedural 3D environment:** The current Quarterly Endface Inspection scenario renders a server-room field view, rack, 24-port LC patch panel, tool bench, FI-3000 FiberInspector, and Quick Clean tool using browser-native Three.js geometry only.
* **Guided inspection workflow:** Select the FI-3000, inspect LC connectors, identify contaminated endfaces, select Quick Clean, clean only previously inspected contaminated connectors, and reinspect them.
* **Fiber backbone certification:** The Certify New Fiber Backbone scenario renders CE-PATCH-A and CE-PATCH-B, an OM4 multimode link, LC/UPC endpoints, and a procedural CertiFiber Pro/OLTS. The learner must select the tool, choose opposite-panel endpoints, run the test, compare measured loss to the loss budget, and export the result.
* **Creeping degradation monitoring:** The Detect Creeping Degradation scenario renders the same fiber path with an Optical Power Meter. The learner selects opposite-panel endpoints, captures a known-good baseline, runs a current loss measurement, compares the delta to the warning threshold, determines a Healthy, Marginal, or Failed state, and exports the diagnostic report.
* **Mission Brief:** The left panel tracks the active objective, tool, inspected count, contamination count, cleaning count, progress, feedback, and report export readiness.
* **Operations Schematic:** The right panel provides true 2D, dependency-free SVG drawings of the selected tool, OM4 fiber path, LC/UPC connector endpoints, certification status, and degradation measurements. It follows active tool, endpoint, and test state rather than displaying a static illustration.
* **Inspection export:** A completed inspection can be exported as a CSV record containing connector IDs, inspection scores, inspection state, and cleaning state.
* **Certification export:** A completed backbone test can be exported as a CE-branded CSV report containing endpoints, fiber specifications, loss budget, measured loss, result, and test-session ID.
* **Degradation export:** A completed monitoring run can be exported as a CE-branded CSV report containing endpoints, baseline loss, current loss, delta, warning threshold, health status, and test-session ID.
* **Splice loss acceptance:** The diagnosis scenario models stripping, cleaning, cleaving, loading, fusion, sleeve installation, heat-shrinking, OTDR verification at 47 meters, final OLTS certification, and a physical-state report.
* **MPO polarity failure:** The diagnosis and repair scenario models a 12-fiber Method A/Method B mismatch, per-fiber PASS/FAIL mapping, repatching, final MultiFiber certification, QSFP+ uplink recovery, and MPO report export.
* **3D Inventory Management and Inspection Library:** The inventory scenario provides a browser-native Three.js technician tool crib with centered, symmetric aisles, a modeled inspection workbench, searchable/filterable assets, and clickable 3D inventory objects. Single-click selects an asset for inspection; double-click populates the workbench; Return to Shelf restores its original position.
* **Inventory procurement and training tools:** Asset inspection includes SKU, quantity, status, location, manufacturer, part number, weight, unit price, coil/spool length, and price-per-meter data where applicable. The scenario also includes a multi-item Bill of Materials cost summary and a T568B LinkIQ wiremap training exercise.

The Operations Sandbox currently uses modeled diagnostic state. It does not claim to be official Fluke hardware or software, and its results are intentionally derived from the simulated connector and link data. The development server uses Vite's runner config loader so the local Desktop workspace can start reliably on a selected port such as `3001`.
* **Capability-aware inspection:** Device inspectors expose only the tabs supported by the selected device, with honest empty states for protocol tables that are not yet populated.

Physical cabling is not represented as a fictitious IOS command. Interface configuration, VLAN assignment, trunking, EtherChannel, shutdown state, DHCP pool configuration, DNS records, PoE commands, and OSPF configuration are performed through the IOS console. Packet particles and Cisco-style ping output reflect modeled path transitions; they are not a claim of real network reachability or full transport behavior.

### Fiber Operations Accuracy Boundary

The fiber scenarios are procedural training simulations, not live Fluke instrument emulators. Splice loss, OTDR events, OLTS results, MPO polarity mapping, and QSFP+ link state are derived from the scenario state machine. The splice workflow calculates modeled loss from preparation and fusion properties; the MPO workflow models per-fiber polarity status and certification prerequisites. These values are intentionally deterministic so learners can repeat the same workflow and compare outcomes.

## Splice Loss Acceptance Simulator

The Splice Loss Acceptance scenario is a state-driven physical-process simulator. The workflow is:

`Stripper -> Wipes -> Cleaver -> Fusion Splicer -> Sleeve Oven -> OTDR -> OLTS`

The simulator tracks stripping, cleaning, cleave angle, fiber loading, core offset, arc power, fusion duration, sleeve installation, and heat-shrink state. Measured splice loss is deterministically derived from these physical properties. The modeled event occurs at `47 m`, uses a `0.30 dB` acceptance threshold, and enforces a strict fail-then-repair sequence where poor preparation leads to a failed OTDR trace, requiring the technician to repeat the physical process before final certification.

## MPO Polarity Failure Simulator

The MPO scenario models a data-center-style 12-fiber trunk with Method A installed polarity and Method B required polarity. MultiFiber diagnosis identifies the reversed fibers via a per-fiber mapping grid, repatching changes the polarity to Method B, and final certification verifies all 12 fibers. The QSFP+ uplink changes from `DOWN` to `UP` only after successful MPO certification. The simulator validates connector compatibility, ensuring only MPO-12 endpoints are used for diagnosis and certification.

These operational scenarios use browser-native procedural geometry and dependency-free SVG schematics. They are designed to teach repeatable field workflows and evidence collection, not to claim live optical power, OTDR, OLTS, or QSFP hardware behavior.

## 🚀 Technical Architecture

The app has moved from a page-based logic to an engine-based logic:

*   **`client/src/labs/labDefinitions.ts`**: The **Single Source of Truth**. Contains the `LAB_REGISTRY` which defines all devices, links, and step-by-step validation logic.
*   **`client/src/components/NetworkSandbox.tsx`**: The **Main Engine**. Handles the visual canvas, drag-and-drop logic, cabling, and the integration between the terminal and the mission rail.
*   **`client/src/components/ThreeSandboxViewport.tsx`**: The **Physical Viewport**. Renders procedural 3D devices, ports, cables, filtering, selection, and state-aware link presentation.
*   **`client/src/components/GuidedPacketTrace.tsx`**: The **Shared Protocol Visualization**. Renders deterministic, lab-specific packet frames for guided tranche objectives.
*   **`client/src/components/TabbedInspector.tsx`**: The **Capability-Aware Inspector**. Renders device-specific Summary, Interfaces, IP, VLAN, MAC, ARP, Routing, DHCP, and DNS views from session state.
*   **`client/src/pages/Home.tsx`**: The **Hub**. Manages lab selection and coordinates the transition into the sandbox workspace.
*   **`client/src/lib/network-ecosystem.ts`**: The device, port, cable, connector, dimensions, and tag catalog used by the sandbox.
*   **`client/src/lib/network-topology.ts`**: Shared topology selection and port-reference types.
*   **`client/src/lib/capabilities.ts`**: Device capability matrix and command capability gates.
*   **`client/src/lib/traffic-engine.ts`**: Reusable deterministic internet-traffic metadata and flow lifecycle model.
*   **`client/src/lib/asa-engine.ts`**: ASA-style zone, ACL, NAT/PAT, and connection decision logic for the firewall sandbox.

## Learning Model

The simulator follows the **Observe → Configure → Verify** loop. Depending on the lab type, users experience two different modes:
1.  **Guided Lab:** A strict path with required steps and precise validation to ensure foundational mastery.
2.  **Sandbox Mode:** A flexible environment for free-play, allowing users to build their own topologies and test commands without a predefined path.

## Curriculum

| Lab | Domain | Focus |
|---|---|---|
| **Lab 1 — CLI Foundations** | Network Fundamentals | IOS modes, IPv4/v6 addressing, `show` commands, and reachability |
| **Lab 2 — Switching & VLANs** | Network Access | VLANs, 802.1Q trunks, LACP EtherChannel, STP, and Inter-VLAN Routing |
| **Lab 3 — Routing & OSPF** | IP Connectivity | Dual-stack routing, OSPFv2/v3, router IDs, and neighbor states |
| **Lab 4 — Services** | IP Services | DHCP, NAT/PAT, NTP, DNS, and SSH management |
| **Lab 5 — Security** | Security | ACLs, port security, DHCP snooping, and hardening |

The ribbon organizes these guided paths under the master tranche hierarchy while keeping the Network Sandbox, Operations Sandbox, and modeled Data tools available as separate top-level controls.

## Project Structure

```text
.
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── NetworkSandbox.tsx  # Build/configure/verify topology workspace
│   │   │   ├── OperationsSandbox.tsx # Field-operations scenario shell
│   │   │   ├── OperationsViewport.tsx # Procedural 3D operations scene
│   │   │   ├── OperationsSchematicPanel.tsx # 2D tool/cable/connector diagram
│   │   │   └── ThreeSandboxViewport.tsx # Network 3D physical viewport
│   │   ├── labs/
│   │   │   └── labDefinitions.ts    # Single Source of Truth (LAB_REGISTRY)
│   │   ├── pages/
│   │   │   └── Home.tsx             # Lab Selection Hub
│   │   └── lib/
│   │       ├── ios-engine.ts        # Low-level IOS command/mode logic
│   │       ├── network-ecosystem.ts # Devices, ports, cables, connectors, tags
│   │       └── network-topology.ts  # Shared selection and port-reference types
├── server/
│   └── index.ts                    # Production Express server
├── package.json                    # Project scripts and dependencies
├── pnpm-workspace.yaml             # pnpm patches and overrides
└── vite.config.ts                  # Vite configuration
```

## Local Development

Run development commands from the repository root, where `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` are located.

1. **Navigate to the repository root:**
   ```bash
   cd cisco-cli-labs-main
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Start the development server:**
   ```bash
   pnpm run dev
   ```

Open the local URL printed by Vite to launch the simulator. The project currently binds with `--host`, so Vite may also print a network URL.

The project uses pnpm `10.18.1`. If your global pnpm version differs, use the repository-local executable:

```powershell
.\node_modules\.bin\pnpm.cmd run dev
```

Analytics is optional. The Umami script is loaded only when both `VITE_ANALYTICS_ENDPOINT` and `VITE_ANALYTICS_WEBSITE_ID` are defined; local development does not require either variable.

When switching between sandbox scenarios, select the scenario from the **Scenarios** panel. The selected topology and its guided objectives are reset together, and each device starts in User EXEC mode (`>`).

### Sprint 5 Checkpoint

Sprint 5 completed the first protocol-state stack for the sandbox. The current implementation includes:

- DHCP server pools, exclusions, client leases, and modeled DORA evidence.
- VLAN-aware DHCP path validation across access ports, trunks, allowed VLANs, and router subinterfaces.
- ARP mappings after successful modeled leases.
- Dynamic MAC learning, five-minute modeled aging, and cleanup on shutdown or link removal.
- Router-on-a-stick path validation for cross-VLAN probes.
- DNS records, `show hosts`, `nslookup`, and resolver-cache state.
- PoE `power inline auto` state with connected AP detection, class 4 / 30W delivery, and budget faults.
- OSPF process state, router IDs, network statements, directly matched neighbor state, and modeled OSPF routes.
- Cisco-style modeled ping output and the existing port-to-port packet visualization.

Representative DHCP configuration:

```text
R1(config)# ip dhcp excluded-address 192.168.10.1
R1(config)# ip dhcp pool USERS
R1(dhcp-config)# network 192.168.10.0 255.255.255.0
R1(dhcp-config)# default-router 192.168.10.1
R1(dhcp-config)# dns-server 192.168.10.53
R1# show ip dhcp pool
```

The engine preserves IOS submode context until `exit` or `end` is entered and normalizes pool keys so command casing cannot create duplicate logical pools.

### Accuracy Boundaries

The protocol features above are modeled state transitions, not claims of real network access. Packet particles visualize a resolved modeled path; they do not represent live ICMP, DHCP, DNS, OSPF, TCP, or UDP traffic. OSPF uses a deterministic simulator clock and command-derived LSDB rather than live Hello packets, yet exposes modeled timer compatibility, authentication type, SPF execution, multi-area summaries, external/default origination, and route installation from one shared control-plane state.

### Resume Point: Validation and UI/UX Pass

The next work should validate the implemented behavior before adding more protocol features.

1. **DHCP success path:** Configure a router pool, connect a supported endpoint, run `ip address dhcp`, verify the lease, client IP configuration, ARP state, MAC table, and `show ip dhcp binding`.
2. **DHCP failure path:** Remove a VLAN from a trunk's allowed list and verify `%VLAN_NOT_ALLOWED`, no lease, no ARP entry, and no new MAC entry.
3. **Inter-VLAN path:** Configure active router subinterfaces with `encapsulation dot1q`, IP addresses, and `no shutdown`; verify modeled ping success and failure when a prerequisite is missing.
4. **DNS path:** Configure `ip dns server` and `ip host`, run `nslookup`, and verify the resolver cache and DNS inspector tab.
5. **PoE path:** Connect APs, run `power inline auto`, verify delivery state, then exceed the modeled budget and verify the fault state.
6. **OSPF path:** Configure matching router IDs and network statements, verify neighbors, database output, learned routes, and modeled ping behavior.
7. **UI/UX adjustments:** Record confusing prompts, inspector labels, feedback messages, tab placement, packet visibility, and failure-state explanations before changing layout or styling.

The immediate next deliverable is a test-driven UI/UX pass over the existing labs and sandbox exercises, not another protocol expansion.

## Contributing and Extending Labs

To add a new lab or modify an existing one, you no longer edit the UI components. Instead, modify the `LAB_REGISTRY` in `client/src/labs/labDefinitions.ts`.

Each lab step is defined as an object containing:
*   `label`: The name of the objective.
*   `description`: Instructions for the learner.
*   `targetDevice`: The device name (e.g., `"R1"`) where the command must be entered.
*   `requiredMode`: The IOS mode required (e.g., `"privileged"`, `"config"`).
*   `expectedCommand`: The exact CLI string required to pass.
*   `successMessage`: The feedback given upon successful completion.

## License
This project is licensed under the MIT License.
