# Changelog

## [2026-10-02] - Guided CLI Prompt Visibility
- Restored the scroll position to the active prompt whenever an IOS step mounts after a worksheet or vocabulary card.
- Restored the guided terminal's 380px default output height and kept a visible scroll lane, while automatically following the active prompt as command history grows or an IOS step returns after a worksheet.

## [2026-10-02] - CLI Scrollback
- Replaced the three-then-ten-line terminal slice with full per-device CLI scrollback in guided labs and Network Sandbox.
- Added visible, internally contained terminal scrollbars, keyboard focus support, and auto-follow for new command output without preventing learners from scrolling back through earlier results.

## [2026-10-02] - STP Operational Evidence
- Added an STP tab to the live operational-evidence panel.
- The tab models VLAN-specific root-bridge election, bridge IDs, Rapid PVST mode, timers, and port role/state, including root, designated, alternate/blocking, edge, PortFast, and BPDU Guard evidence.

## [2026-10-02] - IOS Context-Sensitive Help
- Added Cisco-style `?` help to guided-lab and Network Sandbox IOS terminals, including prompt-level, `show`, `show ip`, `show ipv6`, `show interfaces`, configuration, interface, VLAN, and routing contexts.
- Help is read-only, is not counted as a guided-lab mistake, and remains unavailable in the separate ATTACKER-KALI shell.
- Expanded retained terminal output from three lines to ten lines in both IOS surfaces so help results are readable.

## [2026-10-01] - Networking Vocabulary Review Deck
- Added a `Networking Vocabulary` command-ribbon entry immediately before Master Tranche One.
- The standalone review deck presents every authored vocabulary card in a deterministic four-choice sequence, with progress, answer feedback, previous/next navigation, and restart support.
- The deck honors the existing Guided, Help-if-asked, and Assessment learning modes rather than introducing a separate hint policy.

## [2026-10-01] - Master Tranche Six Target-Range Alignment
- Rebuilt all five Red Team review labs and all five Red Team simulation labs around `ATTACKER-KALI` and named synthetic range targets, replacing generic `ASSESS-PC1` IOS-console workflows.
- Added ATTACKER-KALI evidence steps to the six original Purple Team scenarios so every Red/Purple lab consistently uses a Linux shell for Nmap-shaped inventory and in-app range-reporting commands, while Cisco remains the Blue Team configuration and verification plane.
- Added modeled listener inventories to synthetic portal, API, web, directory, monitoring, camera, sensor, badge, printer, bastion, and legacy-service assets. Nmap version inventory now reports the target's modeled service identity rather than a generic port-443 placeholder.
- Added regression coverage requiring every Master Tranche Six Red and Purple scenario to include a shell-mode ATTACKER-KALI step using a supported synthetic-range command.

## [2026-10-01] - Behavioral Synthetic Container Runtime
- Extended CONTAINER-API-01 from static workload metadata into a deterministic behavioral runtime. The synthetic model now retains ingress TLS/certificate/token/rate-limit state, health, audit findings, TCP listener and backlog state, socket events, namespaces, cgroup limits and counters, retained/dropped capabilities, seccomp identity, and syscall evidence.
- Added ATTACKER-KALI commands for synthetic TLS inspection (`openssl s_client`), authenticated and unauthenticated HTTP status checks (`curl`), deterministic rate-limit burst testing, listener evidence (`ss -tnlp`), modeled process status (`cat /proc/self/status`), and modeled service logs (`journalctl`).
- Added shared-state regression coverage proving that Cisco configuration changes affect the later synthetic TLS, authorization, throttling, socket, and journal output. The model creates no Docker image, process, socket, packet, DNS request, shell, filesystem activity, or outbound connection.

## [2026-09-30] - Master Tranche Six: Authorized Red Team and Blue Team
- Expanded Master Tranche Six to fifteen simulator-only ethical-hacking labs, organized as five Blue Team remediation labs, five Red Team authorized-validation labs, and five Red Team pentesting simulations, one of each in every sub-tranche.
- Blue Team covers asset-edge protection, web/API boundary hardening, credential and remote-access controls, lateral-movement controls, and routing-incident response.
- Red Team covers passive reconnaissance, web/API exposure validation, identity-policy review, segmentation-path review, and control-plane review. These labs are evidence-only: no scanning, exploitation, packet interception, credential attacks, route injection, or real-world target interaction.
- The simulated pentesting track adds deliberately labeled in-app findings for service exposure, web boundaries, remote-access policy, segmentation proof of control, and routing-control-plane review. Each scenario ends at documented proof of control and excludes payloads, login attempts, packet crafting, pivoting, and bypass activity.
- Extended guided curriculum and Network Sandbox navigation from five to six master tranches. Each Master Tranche Six lab has an automatically derived editable sandbox counterpart and regression coverage for the 5/5 team split.

## [2026-09-30] - Simulated Target Range
- Expanded the `Data` modal from Internet Traffic Data into a two-view training data range: deterministic traffic fabric and fictional target assets.
- Added twelve contained in-app targets across websites, assessment/user/admin PCs, application/identity/monitoring servers, and camera/badge/sensor/printer IoT devices.
- Each target shows modeled address, VLAN, zone, condition, and authorized learning boundary. The range is explicitly fictional and supports evidence collection and reporting only, never live scanning or attack execution.

## [2026-09-30] - Target Range Purple Team Scenarios
- Added six simulator-only Master Tranche Six Purple Team labs tied to shared Target Range assets: CAM-01 VLAN boundary, SENSOR-01 DHCP integrity, BADGE-01 ARP integrity, CAM-01 OT segmentation, `training-api.example` boundary, and PRINT-01 recovery drill.
- Each scenario starts with a deliberately modeled condition, guides Red Team evidence and reporting, applies a Blue Team control, and retests the resulting configuration. No attack traffic, payloads, credential activity, industrial protocol interaction, or file encryption is generated.
- Added deterministic IOS-model support and verification output for DHCP snooping, Dynamic ARP Inspection, modeled API rate limiting, and modeled API token enforcement, including switch capability validation. Every new lab receives an editable Network Sandbox counterpart.

## [2026-10-01] - Synthetic Assessment Lifecycle Labs
- Added six fictional target assets: FILE-01, BASTION-01, KDC-01, CACHE-01, LEGACY-FTP-01, and DNS-01, alongside their modeled service, identity, management, application, legacy, and operations zones.
- Added six Target Range Purple Team labs: LEGACY-FTP-01 service retirement, FILE-01 shared access policy, BASTION-01 remote administration hygiene, KDC-01 directory trust boundary, CACHE-01 authentication-anomaly response, and DNS-01 service inventory.
- Separated the IOS-only Cisco console from the ATTACKER-KALI synthetic Linux console. Nmap service/port inventory, SNMP walk, Metasploit console/search/info/module/RHOSTS/run, and Python reporting scripts are now accepted only in the attacker console, while IOS rejects them with standard invalid-input behavior.

## [2026-10-01] - Stateful Synthetic Range Workflows
- Added a stateful METASPLOIT-style catalog workflow for the CONTAINER-API-01 lab: `msfconsole`, `search`, `info`, `use`, `set RHOSTS`, and `run` retain attacker-console state and return deterministic range evidence. The lab now re-scans after the Cisco ACL is applied and reports the modeled port as filtered.
- Added the MONITOR-01 SNMP Management State lab. It uses attacker-console SNMP walk and an explicitly session-scoped SNMP set before applying a least-privilege Cisco management ACL.

## [2026-09-30] - Simulated Container Runtime
- Added CONTAINER-API-01 as a first-class fictional Docker workload with modeled image, runtime, network, published port, environment classification, health, restart policy, volume policy, log summary, and deterministic findings.
- Added the CONTAINER-API-01 Runtime Boundary Purple Team lab, including modeled runtime evidence, TLS, port 8443, rate-limit, token-enforcement, and ingress-ACL verification.

## [2026-09-30] - Defensive Cybersecurity Incident Tracks
- Added five Master Tranche Four IT help-desk security incidents: rogue access-device containment, remote-access hardening, rogue wireless-profile review, phishing DNS recovery, and malware containment policy.
- Added five Master Tranche Five advanced network-defense investigations: simulated MITM/ARP defense, VLAN-hopping defense, rogue-DHCP recovery, OSPF route-injection defense, and TLS reverse-proxy hardening.
- Each incident has one lab in every sub-tranche and a generated Network Sandbox counterpart with the same guided objectives, topology, initial state, and outcomes.
- The labs are explicitly defensive. They teach evidence collection, hardening, containment, and validation without providing exploit execution or real credential/attack workflows.

## [2026-09-30] - GLBP Operational Evidence
- Expanded the Live Verification Tables FHRP tab with a dedicated GLBP gateway and forwarding view. It identifies the elected Active Virtual Gateway (AVG), each Active Virtual Forwarder (AVF), its interface and forwarder identifier, the virtual IP, load-sharing algorithm, and modeled forwarding weight.
- Extended the IOS simulator to retain GLBP `load-balancing`, `forwarder`, and `weighting` configuration, and added state-derived `show glbp` / `show glbp brief` output.
- Kept HSRP and VRRP in the shared FHRP table while making the GLBP-specific forwarding data explicit rather than implying it from priority alone.
- Added regression coverage for GLBP grammar and persisted operational state. TypeScript, learning tests, and the full walkthrough audit pass.

## [2026-09-30] - Master Tranche Two Applied Networking Expansion
- Completed the five-by-five Master Tranche Two curriculum with 19 new guided labs and matching generated Network Sandbox counterparts, while retaining the six existing active labs and stable IDs.
- Added time services, SSL/TLS, ICMP diagnostics, wireless roaming/capacity, PPP/LCP WAN, enterprise server services, WAN engineering, Ansible readiness, REST/CRUD API operations, container service networking, VRF segmentation, flexible load balancing, GLBP, virtual-router redundancy, TLS reverse proxy, BGP peering, route reflection, VRF-aware WAN routing, and applied VLSM/supernet policy.
- Added Cisco-style guided command grammar and modeled verification output for NTP, PTP, TLS service state, PPP/LCP, VRF inventory/routes, GLBP/VRRP, and BGP peers/routes.
- Avoided duplicate introductory labs already taught in Master Tranche One. VLSM/supernetting and FHRP return only in applied edge-routing and high-availability contexts.

## [2026-09-30] - Comprehensive OSPF Operational Evidence
- Rebuilt the OSPF verification tab as a multi-section control-plane dashboard covering process identity and uptime, address family, areas, interfaces, neighbors, SPF runs, timers, capabilities, LSDB records, LSA accounting, and the cyclic event log.
- Added deterministic Router, Network, Summary/Inter-Area Prefix, AS External, and NSSA External LSAs with modeled age, sequence, checksum, advertising-router, and checksum-sum evidence. Supported LSA types with no current instances remain visible with zero counts.
- Unified `show ip ospf`, `show ip ospf neighbor`, `show ip ospf interface`, and `show ip ospf database` with the live verification data instead of maintaining separate shallow output paths.
- Added OSPFv3 process and interface state plus `show ipv6 ospf`, neighbor, interface, and database output through the same evidence engine.
- OSPF-affecting commands now advance a deterministic simulator clock and event/SPF model. Interface hello/dead/retransmit timers, network type, cost, priority, authentication, area type/authentication/ranges, reference bandwidth, SPF throttling, maximum metric, and default-route origination are represented in process state.
- Adjacency eligibility now checks address family, subnet/prefix, area, area type, passive state, router ID, network type, hello/dead timers, and authentication type before reaching FULL.
- Added regression coverage for the dashboard, LSDB, shared CLI output, interface timer/authentication state, SPF events, and all OSPF lab families.

## [2026-09-30] - Twenty Additional Vocabulary Cards
- Expanded the vocabulary bank from 140 to 160 unique cards, distributed across ten existing labs in Master Tranche One, Tranches One-Four.
- Added encapsulation, decapsulation, unicast, APIPA, TCP handshake, transport ports, duplex concepts, authentication, authorization, native VLAN mismatch, DTP, broadcast storms, Root Guard, DHCP leases/reservations, next hops, ECMP, throughput, and packet loss.
- Preserved existing card IDs by appending terms within their groups; Tranche Five remains IOS-only.

## [2026-09-30] - Interleaved Vocabulary Cards
- Added 140 original four-choice term/definition cards throughout Master Tranche One, Tranches One-Four, and their generated sandbox counterparts. Tranche Five remains IOS-only.
- Introduced security, wireless, services, and automation vocabulary before the later practical topics. Preserved original steps, IDs, device configuration, and existing outcomes; added independently graded vocabulary evidence.
- Added keyboard-accessible radio cards, answer validation, and explanations for each choice using the existing Guided/Assisted/Assessment settings, without automatic hint fading.
- Added placement, isolation, grading, idempotence, and rendered learning-mode regression tests.

## [2026-09-30] - Master Tranche One Curriculum Progression
- Reorganized Tranches Two-Five into applied addressing/discovery, switching/LAN services, routing/resilience, and security/edge policy.
- Moved applied subnetting ahead of routing and security, and moved ACL lessons ahead of PAT. Retained all 22 existing labs and their stable IDs, steps, topologies, and grading outcomes.
- Added explicit curriculum ordering shared by guided and sandbox menus. Existing companion scenarios move with their related topic.
- Kept Tranche One's five-lesson sequence and all other master tranches unchanged.

## [2026-09-30] - Addressing Fundamentals Masterclass
- Added four lessons under Master Tranche One / Tranche One without replacing existing labs: binary foundations, the complete IPv4 /0-/32 range, IPv4 subnet planning and wildcards, and IPv6 addressing/subnetting.
- Added shared answer-checked worksheets to guided labs and their generated Network Sandbox counterparts, followed by practical IOS router exercises.
- Preserved full Guided walkthroughs; explanations in Assisted mode are available on request. Assessment hides walkthroughs, with no automatic hint fading in any mode.
- Recorded worksheet completion in session evidence for grading, local persistence, and checkpoints.
- Added calculation, answer-normalization, and guided/sandbox replay regression tests. All 53 learning and packet-animation tests passed.

## [2026-09-29] - Sandbox Packet Animation
- Successful modeled IPv4 pings start persistent cyan request and amber reply flows in Schematic, Logical, and 3D views. Flows keep circulating while their modeled request and return paths remain valid.
- Shared timing preserves progress when switching viewports. Packet direction follows the actual connected ports, replies use the independently validated return path, and a configuration change that breaks forwarding stops the affected flow.
- Blocked probes produce diagnostic feedback without a successful transit animation.

## [2026-09-29] - Network Sandbox VLAN Overlay
- Replaced native white browser hover titles with a dark, viewport-aware port card in both Logical and Schematic VLAN views. It shows cable peer device/port, local and cabled-device IPv4 state, deterministic modeled device MAC identities, access/inferred membership, configured VLAN SVI when present, trunk native/allowed VLANs, interface state, and EtherChannel state when applicable. Logical link hover uses the same visual language.
- Access ports correctly show `Unassigned` for their own IP address when they are Layer 2 only; the cabled endpoint address remains visible separately. An absent VLAN SVI is reported as `Not configured` rather than inferred from a router interface.
- Added a Controls toggle and VLAN selector for Logical and Schematic views. Port labels expose access membership and native/allowed trunk VLANs; endpoints infer membership only from directly connected access ports.
- VLAN filtering dims unrelated devices, ports, and links without changing operational link colors or claiming a suspended EtherChannel forwards traffic. Unknown/disconnected memberships remain explicitly unknown.

### Validation
- TypeScript check, 44 focused learning-regression tests, production build, and `git diff --check` passed.

## [2026-09-29] - Established VLAN Baseline for LACP Troubleshooting
- Clarified interface verification with separate access/SVI, native, and allowed VLAN fields; EtherChannel parent membership; management SVI roles; and separate physical link versus bundle state. Logical Port-channels stay down until a member bundles.
- VLAN tables now include SVIs and only list trunks permitting the VLAN. EtherChannel tables explain suspension; trunk tables expose bundle state.
- Seeded Engineering (10), Services (20), Management (99), and Native (999) VLANs on both LACP lab switches and their derived Network Sandbox counterpart.
- Added matching trunk/native/allowed-VLAN settings on g0/2 and Port-channel 1, management SVIs, and VLAN-appropriate AP/server access ports and server addressing. Passive/passive LACP remains the intended fault.
- Grading now requires preservation of the existing VLAN inventory and member trunk settings alongside the LACP repair.
- Added regression coverage for VLAN output, pre-repair blocking, post-repair management reachability, and preservation of the established VLANs. All 41 regression tests passed.

## [2026-09-28] - Master Tranche Four IT Tech Support
### Added
- Five support-ticket labs, one per Master Tranche Four sub-tranche: workstation onboarding (32 commands), DHCP/internal DNS support (37), shared-printer connectivity (32), AP management/RF-profile support (32), and secure remote-administration handoff (30).
- Matching Network Sandbox counterparts derived from the same topologies, guided steps, initial states, and explicit configuration outcomes. Existing guided modes, command history, verification tables, and device-selection warnings are reused.
- Regression walkthroughs for both versions of every support lab, checking modeled successful ping paths, DHCP lease options, and DNS resolution rather than command acceptance alone.

### Fixed
- PCs and printers accept modeled static IPv4 configuration through the shared capability checks.
- Management-SVI probes resolve through physical VLAN member ports; untagged router access links and DHCP pools honor the connected access VLAN.
- Interface running-configuration output, including SVIs, exposes current address/VLAN/admin state. Endpoint gateways and VTY idle timeouts are tracked for outcome grading.

### Validation
- 40 regression tests passed; 3,430 guided/sandbox commands audited with zero errors and the same three pre-existing command-practice warnings.
- Master Tranche One's authored curriculum is unchanged. Shared engine fixes apply across the application.
- Wireless support verifies management connectivity and profile intent, not actual wireless association. Remote support verifies configuration and SVI reachability, not a real SSH login.

## [2026-09-28] - Learning Platform Foundations and Evidence Hardening
### Added
- Learning workspace shared by tranche labs and Network Sandbox counterparts: state-based outcomes, guided/assisted/assessment modes, diagnostics, protocol evidence, checkpoints, skill records, and validated authoring drafts/export.
- Five seeded-fault troubleshooting labs across Master Tranche Five's five sub-tranches, with corresponding sandbox exercises.
- Expanded each Master Tranche Five troubleshooting lab and matching sandbox exercise into a 31-command investigation, repair, verification, and persistence workflow. Scenarios now include relevant endpoint, IoT, service, and infrastructure equipment rather than an isolated two-device fault.
- Named browser-local checkpoints, configuration comparison, and automatic safety snapshots before restore or fresh assessment.
- Automated authored-command walkthrough audit and regression tests for fault repair, equivalent configuration, interface evidence, OSPF withdrawal, blocked probes, and DHCP expiry.

### Changed
- Fixed empty troubleshooting MAC evidence by connecting the shared command executor to Layer 2 learning, seeding healthy endpoint/link configuration, and using consistent MAC identities across inventory, CLI, and learned-table views. Disabled workstation ports remain absent until repaired; allowed trunks propagate remote source entries.
- Added shared IPv4 route-table evidence, longest-prefix probe forwarding, routing-loop detection, request/reply path checks, and ordered ICMP ACL evaluation including implicit deny.
- Added cost-based OSPF route recalculation and physical-segment DR/BDR evidence; fixed recording passive interfaces on newly configured processes.
- Shared packet diagnostics now infer the configured access VLAN when host metadata omits it and reject destination addresses assigned to disabled interfaces, including local probes.
- OSPF neighbor discovery now follows shared adjacency fault checks. Database output groups configured participation by its actual area and identifies the modeled database limitation; `show vlan brief` includes access-port membership and excludes trunks.
- Troubleshooting labs and their Network Sandbox counterparts now begin in the same guided, step-by-step mode as every other lab. Learners can explicitly switch to Help if asked or Assessment mode when ready.
- Guided tranche labs now use the same device-selection warning as Network Sandbox objectives when the open console does not match the required device.
- IP Interfaces now includes Cisco-style `OK?` address validity and `Method` (`manual`, `DHCP`, or `unset`) columns, and the modeled `show ip interface brief` output uses the same fields.
- Guided and sandbox execution now share network command handling. Assisted repairs can satisfy outcomes without following the authored sequence.
- OSPF evidence checks interface state, participation, area/subnet compatibility, passive interfaces, duplicate router IDs, and stub options; modeled learned routes withdraw after adjacency loss.
- Packet diagnostics report modeled blocking conditions and limitations instead of unconditional ping success.
- EtherChannel tables distinguish LACP negotiation state from merely enabled interfaces. DHCP output uses actual modeled expiry and lease counts instead of fabricated infinite leases or packet counters.
- `switchport trunk allowed vlan add/remove` now mutates the modeled VLAN set used by trunk verification and Layer 2 diagnostics.
- EtherChannel eligibility now uses one shared forwarding rule across the topology link color, verification table, Layer 2 diagnostics, and packet-path checks. Suspended LACP channels no longer appear to forward traffic.
- Packet diagnostics now reject a modeled route when its configured next hop does not match the next topology neighbor on the selected egress.
- Replaced the server build bundling step with a guarded single-entry TypeScript transform to avoid the encountered Windows directory-traversal issue.

### Scope
- Packet diagnostics, cross-view consistency, and protocol fidelity remain bounded instructional models. Cost-based recalculation and ICMP request/reply checks are implemented; real convergence timers, complete RFC OSPF/multi-area behavior, exhaustive ACL/NAT/transport emulation, and exhaustive browser coverage are not complete.
- Checkpoints, assessment records, and author drafts are local to the browser. Author drafts are not automatically installed as live curriculum.

### Validation
- Learning regression suite: 34 tests passed.
- Walkthrough audit: 3,104 authored commands, zero errors, three warnings for exercises without measurable state outcomes.
- Manual browser checks covered out-of-order OSPF repair, fresh assessment reset, checkpoint restoration, and healthy phone/camera entries in the Silent Access Port learned MAC table.
- TypeScript check, production build, and `git diff --check` passed. The build retains a large frontend-bundle advisory.

## [2026-09-27] - Tranche and Network Sandbox Integration
### Added
- **Sandbox counterparts for every guided lab:** Each guided tranche lab now has an editable Network Sandbox scenario derived from the same finalized topology and command sequence.
- **Curriculum parity:** Counterparts inherit their source lab's Master Tranche and sub-tranche placement, so the sandbox scenario browser follows the same learning structure as the guided curriculum.

### Changed
- **Single source of truth:** Sandbox counterpart objectives are copied from the guided registry after lab extensions and verification steps are attached, reducing drift between the two learning experiences.
- **Legacy separation:** Existing free-play scenarios without a guided tranche source remain in the Legacy group.

### Validation
- `pnpm run check` passed.
- `git diff --check` passed.

## [2026-09-27] - Network Sandbox Curriculum Navigation
### Added
- **Scenario hierarchy:** Reorganized the Network Sandbox scenario browser into Master Tranche One through Master Tranche Five, each with Tranche One through Tranche Five submenus.
- **Legacy scenario group:** Added a Legacy section for sandbox templates that do not correspond to a guided tranche lab, including the management campus, small-business enterprise, and blank-canvas scenarios.

### Changed
- **Master Tranche One scenario mapping:** Grouped the matching VLAN/trunk, OSPF/routing-core, and firewall sandbox scenarios under the corresponding Master Tranche One sub-tranches without changing Master Tranche One guided labs.

## [2026-09-27] - Network Sandbox Viewport Spacing
### Changed
- **Expanded logical diagram grid:** Increased the logical Network Sandbox drawing surface from 1120x610 to 1440x760 so larger scenarios have usable space around their devices and links instead of ending at the old canvas boundary.
- **Viewport zoom controls:** Added bounded zoom in, zoom out, and reset controls to the Network Sandbox Controls menu for inspecting dense topologies at a comfortable scale.

### Validation
- `pnpm run check` passed.
- `git diff --check` passed.

## [2026-09-27] - Small Business Enterprise Sandbox Exercise
### Added
- **Guided small-business deployment:** Added a complete sandbox exercise for the existing Small Business Enterprise topology. The workflow configures CE-R1 inter-VLAN routing and DHCP, CE-SW1/CE-SW2 VLANs and LACP trunks, CE-AP1/CE-AP2 SSIDs and RF settings, CE-FW1 edge policy and PAT, CE-SRV1 DNS, and endpoint addressing.
- **Operational verification:** Added guided checks for interfaces, routes, DHCP, VLANs, trunks, EtherChannel, firewall ACL/translations/connections, server DNS records, modeled reachability, and saved configuration.

### Changed
- **Port-model fidelity:** Aligned the Small Business Enterprise firewall topology ports with the IOS interface names `Ethernet0/0` through `Ethernet0/2`, keeping visual links and command-driven interface state synchronized.
- **Device capabilities:** Enabled modeled IP configuration on servers and trunk capability on access points so the new exercise can validate its intended commands.

### Validation
- `pnpm run check` passed.
- `git diff --check` passed.

## [2026-09-26] - Master Tranche Two Curriculum and Verification Fidelity
### Added
- **Master Tranche Two curriculum:** Added active guided labs across all five sub-tranches: Enterprise Voice and QoS, CCTV Surveillance Networking, Wireless and RF, CDP/LLDP/LACP, Load Balancing/VPC, and OSPFv2 Multi-Area Routing.
- **CCTV Surveillance Network:** Added a dedicated VLAN 50 camera topology with CE-R1, CE-SW1, NVR-01, CAM-01, and CAM-02. The guided sequence covers multicast-ready routing, trunk allowance, camera access ports, and switch verification evidence.

### Changed
- **Interface verification inventory:** Expanded the IP Interfaces table to include every modeled port on the selected device, including unconfigured ports, with description, role, status, administrative state, speed/duplex, and error fields alongside parent, VLAN, encapsulation, and IP relationships.
- **VLAN access fidelity:** Corrected the Sales endpoint path in the VLAN access lab so its modeled `g0/2` port is explicitly configured as an access port in VLAN 20 before the verification commands.
- **Curriculum navigation:** Updated the documentation and tranche navigation so Master Tranche Two is presented as a five-sub-tranche curriculum, while Master Tranche One remains unchanged and Master Tranches Three–Five remain future placeholders.

### Validation
- `pnpm run check` passed.
- `git diff --check` passed.

## [2026-09-26] - Guided OSPFv2 Network Sandbox and CLI Parity
### Added
- **Guided OSPFv2 Network Sandbox:** Added the OSPFv2 Multi-Platform Sandbox with the same guided objects, configuration sequence, interface activation objectives, OSPF verification steps, and evidence passes as TR3-OSPFV2.
- **Sandbox CLI Command History:** Added a per-device Command History panel to the Network Sandbox IOS console. It includes commands entered in user EXEC, privileged EXEC, global configuration, interface, router, and other IOS submodes.

### Changed
- **Network Sandbox IOS Workspace:** Aligned the sandbox console presentation with the tranche CLI. The console now has a labeled Minimize CLI/Restore CLI control and keeps a compact rolling three-line output window so the startup banner scrolls away naturally as commands are entered.
- **OSPF Device Modeling:** Extended sandbox OSPF support to Layer 3 switch, firewall OSPF speaker, and virtual-router roles so the guided multi-platform sequence can operate across all five devices.

### Fixed
- **Command History Prompt Parsing:** Corrected history detection for IOS submode prompts such as `CE-R2(config-router)#`, so commands are displayed regardless of the active IOS context.

### Validation
- `pnpm run check` passed.
- `git diff --check` passed.

## [2026-09-22] - State-Driven NAT/PAT Packet Trace
### Changed
- **NAT/PAT trace trigger:** TR4-NAT-PAT now keeps the operational-context animation in standby while the learner marks inside/outside interfaces and prepares the router. Playback begins only after the accepted `ip nat inside source list 1 interface g0/1 overload` command is entered, aligning the visual flow with the command that actually creates the PAT rule.
- **Transport / Flows verification:** Added a live table for modeled Layer 4 evidence. NAT/PAT creates a deterministic TCP/HTTPS flow with source and destination ports, while DHCP client addressing records a UDP DHCP discovery with its broadcast endpoints.

### Validation
- Confirmed the trigger is scoped to TR4-NAT-PAT and does not change packet-trace playback for other guided tranche labs.

## [2026-09-19] - Tranche Verification Workspace
### Added
- **Live Verification Tables**: Added a tranche-only panel below the IOS simulator with IP interface, ARP, MAC address, trunk, and EtherChannel tabs. The tables derive from the active IOS session and display explicit empty states when no modeled entries are present.
- **ACL Verification**: Added a numbered and named ACL tab that displays rules as they are entered through standard `access-list` commands or named ACL configuration mode.
- **NAT/PAT Verification**: Added a NAT/PAT tab that displays configured PAT overload, static NAT, and dynamic PAT rules from the active IOS running configuration, with honest empty-state behavior for translations that have not been modeled.
- **OSPF Verification**: Added an OSPF tab that displays process IDs, router IDs, advertised networks, areas, and passive interfaces from the active IOS session, while clearly identifying that neighbor adjacencies are not yet modeled in this panel.
- **LACP Verification**: EtherChannel verification now explicitly labels `channel-group` members using `mode active` or `mode passive` as LACP, while distinguishing static `mode on` bundling. The existing mode column remains visible for direct CLI correlation.
- **Default Gateway Tracking**: Expanded the IP Interfaces table with a live Default Gateway column derived from configured `ip route 0.0.0.0 0.0.0.0 <next-hop>` or `ip default-gateway <address>` commands.
- **Resizable CLI and Verification Panels**: Added keyboard-accessible grab bars to resize both panels upward or downward within bounded heights. Arrow keys make incremental adjustments, while Home and End move directly to the minimum and maximum heights.
- **Independent Minimize Controls**: Added separate minimize and restore buttons for the IOS simulator and Live Verification Tables, leaving each panel header visible while its body is collapsed.
- **Packet Trace Playback**: Made the operational-context slide counter itself an accessible Pause/Resume button. Pausing freezes the current frame without changing guided-lab progress or IOS state.
- **Modeled ARP/MAC Learning**: Added a deterministic ping step to IPv4 Interface Fundamentals. Pinging `192.168.10.10` from the active `g0/0` interface records a corresponding ARP neighbor and dynamic MAC entry, followed by guided `show arp` and `show mac address-table` verification steps.
- **Cross-Tranche Traffic Guidance**: Added topology-specific modeled ping objectives to routed IPv4 tranche labs, including inter-VLAN, static-routing, DHCP, firewall/DMZ, CIDR, VLSM, point-to-point, multicast-baseline, and IPv4 neighbor-discovery exercises. These steps are inserted before generic evidence passes, and duplicate ping commands are removed from the later generic rotation. IPv6-only and Layer 2-only labs remain free of artificial IPv4 traffic steps.
- **DHCP Verification**: Added a DHCP tab to the live verification panel. It displays modeled DHCP pools, active or expired leases, excluded addresses, and DHCP-client state directly from the active IOS session.
- **Interface and VLAN Relationships**: Added modeled 802.1Q encapsulation and VLAN IDs to interface state, derived Router-on-a-Stick subinterface status from the physical parent, expanded IP Interfaces with parent/VLAN/encapsulation/gateway relationships, and added a VLANs tab relating VLAN names to routed gateways, access ports, and trunks. Router-on-a-Stick now guides CE-SW1 VLAN/trunk configuration and correctly targets `show vlan brief` and `show interfaces trunk` at the switch.
- **CDP Verification**: Added a topology-backed CDP tab across applicable tranche labs. It relates each active network device's local interface to a network-capable neighbor and remote port, labels the neighbor role, and distinguishes direct links from trunk or VLAN gateway relationships.
- **ROAS Neighbor Learning Fix**: Corrected modeled ping learning for 802.1Q subinterfaces. A subinterface now qualifies for ARP/MAC learning when its physical parent is operational and the subinterface has dot1Q encapsulation and an IPv4 address, matching the derived interface state shown in the verification panel.
- **IPv6 Neighbor Discovery**: Added an IPv6 Neighbors live verification tab and session-level ND state. Once an IPv6 interface has a global address, link-local address, and active link, the topology engine models a Neighbor Solicitation/Neighbor Advertisement exchange and records reciprocal state on the connected endpoint, including V6-PC1.
- **IPv6 Link-Local Parser Fix**: Corrected interface-mode validation so valid Cisco syntax such as `ipv6 address fe80::1 link-local` is accepted without requiring an IPv6 prefix length.
- **IPv6 CDP Neighbor Context**: Expanded TR2 IPv6 Interface Fundamentals to model `CE-R1 ⇄ CE-SW1 ⇄ V6-PC1`. CDP now has a real router-to-switch neighbor relationship while the ND model resolves the IPv6 host across the Layer 2 switch segment.
- **VLAN MAC Learning**: Added topology-aware dynamic MAC learning for active switch access ports connected to modeled PCs. Learned entries use deterministic host MACs, the configured access VLAN, and the receiving switch port, aligning the MAC table with the packet trace's ingress-frame behavior.
- **State-Aware Trunk Trace**: Corrected the 802.1Q operational-context animation so pre-configuration traffic is shown as untagged/pending. The tagged trunk-transit frame is shown only after the modeled uplink reaches `switchport mode trunk`.
- **Realistic TR2 Trunk Formation**: Rebuilt 802.1Q Trunking as a multi-device sequence: create VLAN 10 and VLAN 999 on CE-SW1 and CE-SW2, configure and align both trunk ends, assign ENG-PC1 to VLAN 10, configure CE-R1 g0/0.10 as the router-on-a-stick gateway, generate a modeled ping, and verify VLAN, MAC, trunk, and interface state on the appropriate devices.
- **Trunk MAC Propagation**: Extended Layer 2 learning beyond directly attached hosts. Active trunks now propagate learned source MACs for permitted VLANs, and the router-on-a-stick gateway contributes a modeled VLAN 10 source MAC, allowing CE-SW1 and CE-SW2 tables to show local and remote forwarding entries.
- **OSPF Show Grammar Fix**: Corrected privileged-EXEC validation so the base `show ip ospf` command is accepted alongside `show ip ospf neighbor` and interface-specific OSPF checks.
- **Multi-Platform OSPF Build**: Expanded TR3 OSPFv2 into an 88-step build-first curriculum across two routers, CE-L3SW1, CE-FW1, and CE-VR1. The sequence configures transit IPs and descriptions, unique router IDs, area 0 participation, and all five devices before ten focused verification steps.
- **Reactive OSPF Trace**: Made the OSPF operational-context animation reflect build progress. It now distinguishes process idle, incomplete device configuration, Hello eligibility, Hello/LSA exchange, DBD neighbor verification, and OSPF route installation.
- **OSPF DR/BDR and Network Types**: Added a dedicated multi-access Ethernet lab for CE-R1, CE-R2, and CE-R3 through CE-SW1. It models broadcast network behavior, priority-based DR/BDR/DROTHER election, interface cost, router IDs, and neighbor-state evidence.
- **FHRP Module**: Added a separate HSRP, VRRP, and GLBP lab with virtual IPs, priority, preemption, active/standby and master/backup roles, and a failover-focused packet trace and live verification tab.
- **Combined MAC Verification**: Consolidated device identity and learned forwarding views into one **MAC Address** tab with an explicit toggle between **Initialized Device MACs** and **Learned MAC Table**. The initialized inventory remains the default when each lab opens.

### Changed
- **Tranche Workspace Layout**: Removed legacy CSS minimum-height constraints from the IOS simulator so the resize state is honored throughout its full range instead of stopping at the old terminal-shell and terminal-output minimums.

### Fixed
- **NAT/PAT Parser Validation**: Added the standard IOS `ip nat inside source list <number> interface <interface> overload` grammar to Global Configuration mode. The focused regression test confirms acceptance in config mode, rejection in interface mode, and preservation of existing `ip nat inside` interface behavior.

### Validation
- Focused NAT/PAT regression test passed.
- `pnpm run check` passed.
- Preview refreshed successfully.
- The parser fix remains local and uncommitted in `client/src/lib/ios-engine.ts`.

### Scope Notes
- These verification and layout controls belong to the guided Tranche Labs. The Network Sandbox and Operations Sandbox retain their separate workflows and presentation behavior.

## [2026-09-16] - 3D Inventory Management and Inspection Library
### Added
- **Interactive Inventory Room**: Added a browser-native Three.js technician tool crib with categorized network, fiber, active-hardware, and bulk-cabling assets.
- **Inspection Workbench**: Added a centered physical workbench with tabletop, legs, storage rails, and an active-asset highlight. Inventory aisles are symmetrically spaced around the center aisle.
- **Asset Inspection Data**: Added SKU, quantity, status, location, manufacturer, part number, weight, unit price, coil/spool length, and price-per-meter fields where applicable.
- **Bill of Materials**: Added multi-item BOM selection and deterministic procurement-cost totals.
- **T568B Training Exercise**: Added a LinkIQ-style wiremap activity using the eight-wire T568B sequence.

### Changed
- **Inspection Interaction**: Single-click now selects an asset and updates the inspector; double-click populates the asset onto the workbench. Return to Shelf restores the original location.
- **Operations Scenario Presentation**: The inventory scenario no longer renders unrelated simulated Internet Traffic or generic Operations Library panels, while the shared Operations Sandbox functionality remains available to scenarios that use it.

### Accuracy Notes
- The inventory room is a modeled training and reference environment. Prices, specifications, quantities, and spatial geometry are deterministic catalog data and are not live procurement or physical inventory records.

## [2026-09-16] - Curriculum Navigation and Sandbox Startup Layout
### Added
- **Master Tranche Navigation**: Added Master Tranche One through Master Tranche Five buttons to the Curriculum ribbon. Each master menu contains nested Tranche One–Five menus; Master Tranche One routes to the existing guided labs, while Master Tranches Two–Five expose disabled generic `Placeholder Lab` entries for future curriculum work.
- **Top-of-Page Startup**: Restored the browser viewport to the top when the application boots, when a lab changes, and when entering or leaving a sandbox view.

### Changed
- **Network Sandbox Defaults**: Workspace and Devices panels now start collapsed, while the first device remains the default IOS console target; additional device and inspection interactions remain user-driven.
- **Compact IOS Console Dock**: The Network Sandbox IOS CLI now boots as the first device’s active console in an expanded compact dock with a 150px default height. The dock remains resizable and supports user-controlled minimize, restore, and close actions.

### Accuracy and Scope Notes
- Placeholder labs are navigation stubs only; they do not reuse existing lab definitions or provide executable guided objectives.
- These layout changes affect presentation and startup state only; IOS command validation, topology modeling, session recovery, and sandbox state semantics remain unchanged.

## [2026-09-15] - Guided Protocol Visualization and CLI Workspace
### Added
- **Shared Guided Packet Traces**: Added a reusable `GuidedPacketTrace` component for tranche labs. Protocol-specific profiles now visualize deterministic point-to-point exchanges for DHCP DORA, IPv4 and IPv6 neighbor discovery, VLANs, trunks, STP, EtherChannel, router-on-a-stick, routing, OSPFv2/v3, NAT/PAT, ACLs, SSH, port security, CIDR/VLSM, multicast, and broadcast workflows.
- **Standby Trace Presentation**: Guided traces are visible by default in a standby state and begin cycling through frames after the learner enters a meaningful lab command.
- **Command History Overlay**: Added a per-device Command History control to the IOS console header. The overlay exposes the complete command sequence without changing the terminal layout.
- **Collapsible Guided Headers**: Added compact and expanded header states so lab descriptions can be collapsed when the packet trace and CLI need more room.

### Changed
- **Fixed Trace Height**: Standardized the guided packet trace viewport at a compact fixed height so frame changes no longer move the IOS console vertically.
- **Three-Line CLI Viewport**: The live terminal now retains only the newest three rendered command/result lines. Startup banners scroll away naturally with command entry.
- **Invalid Command Display**: Invalid submissions render the entered command plus one combined IOS error/hint line, consuming two of the three visible lines.
- **Tranche Scope Clarity**: Documented the distinction between guided tranche labs, the open Network Sandbox, and the physical-process Operations Sandbox. The shared packet animation layer applies to tranche labs without changing the sandbox roles.

### Accuracy Notes
- Guided packet traces are deterministic instructional visualizations, not live packet captures or external network traffic.
- The frame metadata is designed to expose CCNA-relevant Layer 2, Layer 3, and protocol behavior while remaining independent of live browser networking.

## [2026-09-14] - Sandbox Session Recovery
### Fixed
- **Per-Lab Refresh Recovery**: Guided labs and sandbox exercises now persist their IOS sessions, topology edits, objective progress, selected device, and operational feedback under an isolated per-lab browser snapshot.
- **Operations Refresh Recovery**: Fiber operations scenarios now persist their selected workflow, tools, inspection results, measurements, endpoints, and notices across refresh.
- **Scenario Isolation**: Switching between labs no longer overwrites or deletes another lab's in-progress state.
- **Mission Restart Semantics**: Restart Mission now clears the active lab snapshot and resets the complete session, including configuration state, selections, packets, and feedback.
- **Firewall Capability Consistency**: ACL and NAT are now marked as implemented capabilities, so valid security commands are no longer rejected by the device capability gate.

### Added
- **Firewall and Edge Security Foundations**: Added a dedicated ASA-style Network Sandbox scenario with a hardware firewall, ISP modem, provider router, inside switch, trusted PC, and DMZ web server.
- **ASA Command Contexts**: Added nameif, security-level, object network, object NAT/PAT, access-group, ASA interface naming, default routes, and firewall verification commands.
- **Simulated Internet Traffic Fabric**: Added a dependency-free reusable flow engine for ICMP, TCP, UDP, DNS, HTTP, HTTPS, DHCP, and VPN metadata, TLS inspection state, certificate trust decisions, NAT metadata, policy decisions, and packet animation stages.
- **Operations Traffic Test**: Operations Sandbox can now generate deterministic HTTPS flows that pass through simulated TLS inspection and record their lifecycle.
- **ASA Traffic Decision Engine**: Connected modeled traffic to the firewall session state. Flows now evaluate configured zones, security levels, ordered ACL rules, access-group bindings, and object PAT before packet animation, with explicit denial reasons and translated-source metadata.

### Reliability Notes
- Recovery is browser-local and does not claim server-side persistence or cross-device synchronization.
- Clearing site storage, private browsing expiration, or changing browser profiles removes the saved snapshots.
- Simulated traffic is deterministic application state, not live internet traffic.

## [2026-09-13] - High-Fidelity Fiber Diagnosis
### Added
- **High-Fidelity Splice Simulator**: Upgraded Splice Loss Acceptance from a demo to a physical process simulator.
    - Implemented procedural workflow: `Stripper` $\rightarrow$ `Wipes` $\rightarrow$ `Cleaver` $\rightarrow$ `Fusion Splicer` $\rightarrow$ `Sleeve Oven` $\rightarrow$ `OTDR` $\rightarrow$ `OLTS`.
    - Added deterministic loss model based on cleave angle, contamination, core offset, arc power, fusion duration, and sleeve state.
    - Implemented "Fail-then-Repair" loop ensuring first attempts fail and require genuine repair sequence.
    - Added professional OTDR event table and penalty breakdown in the schematic panel.
- **MPO Topology Types**: Added explicit `MPO-12` endpoint type to the fiber endpoint model.
    - Implemented connector compatibility validation for MultiFiber Pro tool.
    - Updated MPO scenario to use `MPO-12` endpoints.
- **Build Robustness**: Added quoting to `esbuild` build script in `package.json` to prevent failures on Windows paths with spaces.
- **Diagnostic Tooling**: Added dedicated SVG drawings and procedural 3D meshes for the optical meter, OTDR, MultiFiber Pro, fusion splicer, and sleeve oven.
- **Diagnostic Reports**: Added modeled CSV exports for splice acceptance and MPO polarity results.

### Fixed
- **Router-on-a-Stick Evidence Sequence**: Removed the duplicate `show ip interface brief` evidence pass because it is already the guided lab's final verification command.
- **EtherChannel Traffic Sandbox**: Expanded the scenario to require CE-SW2 configuration, both switch-side LACP members, both Port-channel trunks, VLAN 10 access ports for both PCs, active interfaces, and an SW1 VLAN 10 SVI before the modeled ping.
- **Router-on-a-Stick Context**: Added an explicit parent-interface `exit` objective before requiring Global Configuration mode for `interface g0/0.10`, matching Cisco IOS command context.
- Fixed stale state closures in `fuseFiber` and `runOTDRTrace` using functional state updates.
- Fixed MPO viewport rendering fall-through by making `onSelectEndpoint` optional.
- Fixed schematic tool fallback where MultiFiber Pro rendered as a Quick Clean pen.
- Fixed TS2367 type error in `workflowStatus` comparison.
- Fixed non-deterministic MPO failures by hardcoding failures to Fibers 1 & 12.

### Accuracy Notes
- These operations scenarios are deterministic instructional models, not live OTDR, OLTS, fusion-splicer, or MPO tester emulations.
- The splice-loss formula is derived from modeled cleave, contamination, core-offset, and sleeve conditions; it is not a manufacturer calibration model.
- MPO testing models per-fiber polarity state and uplink recovery, while the shared endpoint catalog remains a simplified training abstraction.

---

## [0.11.0] - Fiber Degradation Monitoring
### Added
- **Detect Creeping Degradation Scenario**: Added a monitoring workflow for comparing a known-good OM4 fiber baseline against a current optical-loss measurement.
- **Optical Power Meter**: Added a dedicated procedural 3D tool model and matching dependency-free SVG schematic for optical loss measurements.
- **Health Classification**: Added state-derived Healthy, Marginal, Failed, and Unknown outcomes based on measured loss delta and the warning threshold.
- **Degradation Report Export**: Added a CE-branded CSV export containing endpoint identity, baseline loss, current loss, delta, warning threshold, health status, and modeled session ID.

### Fixed
- **Tool Rendering Consistency**: Optical Power Meter is no longer rendered or labeled as Quick Clean in the 3D viewport or Operations Schematic.
- **Degradation Schematic Readout**: The monitoring diagram now displays baseline loss, current loss, and calculated delta alongside the link health state.
- **Monitoring Control State**: Baseline capture is disabled while measuring or after capture, preventing duplicate asynchronous baseline runs.

### Accuracy Notes
- Degradation values are modeled diagnostic state for training workflow practice; they are not live optical measurements or official test-instrument output.
- The monitoring workflow requires the correct tool and opposite-panel endpoints before baseline capture and current measurement are available.

## [0.10.0] - Fiber Backbone Certification
### Added
- **Certify New Fiber Backbone Scenario**: Added a commissioning workflow with CE-PATCH-A, CE-PATCH-B, OM4 multimode fiber, LC/UPC endpoints, a modeled CertiFiber Pro/OLTS, and a 50-meter certification profile.
- **Endpoint-Gated Testing**: The learner must select the certification tool and choose endpoints from opposite patch panels before the test can run.
- **Loss-Budget Evaluation**: Certification status is derived from measured loss versus the configured loss budget rather than from a button action alone.
- **Certification Schematic**: Added 2D SVG drawings for the CertiFiber Pro, fiber path, source endpoint, destination endpoint, and test status.
- **Certification Report Export**: Added a CE-branded CSV report with endpoint identity, fiber specifications, loss values, result, and modeled test-session ID.

### Fixed
- **R3F JSX Instrumentation Crash**: Removed DOM-oriented JSX location instrumentation that injected `data-loc` into React Three Fiber objects and caused `Cannot set "data-loc"` runtime failures.
- **Operations State Reset**: Switching between Operations scenarios now clears the selected tool, endpoint selection, certification state, and scenario feedback.
- **Fiber Scene Geometry**: Corrected panel-local endpoint placement and replaced the unreliable straight-cylinder backbone representation with a curved fiber path between the selected endpoints.
- **Local Dev Startup**: The development script now uses Vite's runner config loader, allowing the Desktop workspace to start reliably on `localhost:3001`.

### Accuracy Notes
- Certification output is modeled from the scenario's fiber state and loss budget; it is not a live optical measurement or official Fluke software result.
- The current certification profile passes with 2.1 dB measured loss against a 3.5 dB budget. Additional failed, degraded, and repair-required commissioning variants remain planned.

## [0.9.0] - Operations Sandbox Foundation
### Added
- **Operations Sandbox Module**: Added a separate field-operations environment alongside the Labs and Network Sandbox.
- **Scenario Command Ribbon**: Added a compact operations scenario ribbon with active, available, and planned scenario states.
- **Procedural Server-Room Scene**: Added browser-native Three.js geometry for a rack, 24-port LC patch panel, tool bench, FI-3000 FiberInspector, and Quick Clean tool without external assets or GLTF files.
- **Quarterly Endface Inspection**: Added the first operational workflow: inspect all 24 LC connectors, identify contaminated endfaces, clean them with the modeled Quick Clean tool, reinspect, and export the completed inspection log.
- **Mission Brief Layout**: Added operational progress, tool state, connector counts, contamination counts, cleaning counts, modeled feedback, and report export readiness.
- **Operations Schematic**: Added a dependency-free 2D SVG drawing layer showing the selected tool, OM4 fiber path, LC/UPC connector state.
- **Inspection Export**: Added CSV export for connector IDs, inspection scores, inspected state, and cleaning state.

### Accuracy Notes
- The Operations Sandbox models field procedures and diagnostic state; it does not claim official Fluke hardware or software emulation.
- Tool results are derived from simulated connector state and are not measurements from live fiber or network hardware.
- Additional commissioning, monitoring, diagnosis, repair, and audit scenarios remain planned and are intentionally labeled as such in the scenario ribbon.

## [0.8.0] - Explicit Interface Activation Practice
### Added
- **Guided `no shutdown` Objectives**: Labs and sandbox exercises now include explicit activation steps for eligible physical interfaces, VLAN SVIs, and port-channels when an interface workflow does not already contain `no shutdown`.
- **Logical State Feedback**: The Logical Diagram can now be used as evidence while practicing activation: interfaces remain down until the learner completes the command in the correct IOS interface context.

### Changed
- **No Automatic Port Startup**: The simulator preserves the IOS learning sequence and does not silently enable interfaces. Learners must enter the correct interface mode and use `no shutdown` themselves.
- **Duplicate Protection**: Existing lab-authored `no shutdown` objectives are preserved without adding duplicates, while loopbacks and subinterfaces are not given inappropriate activation steps.

### Accuracy Notes
- A configured address, VLAN, trunk, or EtherChannel does not by itself administratively enable an interface; the modeled interface remains shutdown until `no shutdown` is accepted.
- This change improves command-practice fidelity without claiming that the browser simulator is connected to live Cisco hardware.

## [0.7.0] - OSPF and Modeled Reachability
### Added
- **OSPF Process State**: Added modeled `router ospf`, `router-id`, and `network ... area ...` configuration state.
- **OSPF Verification**: Added `show ip ospf neighbor`, `show ip ospf database`, and OSPF route output through `show ip route`.
- **OSPF Route Reconciliation**: Directly connected routers with matching OSPF network coverage and shared subnets can form modeled `FULL` neighbors and install modeled OSPF routes.
- **Modeled Ping Results**: Successful VLAN-aware and router-on-a-stick paths now produce Cisco-style `!!!!!` output while driving the existing port-to-port packet visualization.

### Accuracy Notes
- Packet particles are a visual reflection of a resolved modeled path, not real ICMP traffic or a claim of external reachability.
- OSPF state currently models directly connected neighbor matching and route installation; full SPF, timers, authentication, multi-area operation, and external reachability remain out of scope.
- TCP/UDP transport behavior, service payloads, and external network access are not simulated.

## [0.6.0] - Inter-VLAN, DNS, and PoE State
### Added
- **Router-on-a-Stick Validation**: Cross-VLAN modeled probes now require reachable VLAN paths through active router subinterfaces with matching `encapsulation dot1q` and IP state.
- **DNS Records and Resolver Cache**: Added modeled `ip dns server`, `ip host`, `show hosts`, and endpoint `nslookup` behavior with session-backed records and cache entries.
- **PoE Negotiation**: Added `power inline auto` state for switch interfaces connected to access points, including modeled class 4 / 30W delivery and budget-exhaustion fault behavior.
- **DNS Inspector State**: DNS server records and client resolver cache entries now appear in the capability-aware inspector.

### Accuracy Notes
- Cross-VLAN path validation does not claim animated packet traversal or complete transport-layer behavior.
- DNS resolution requires a configured modeled DNS server, a matching record, and topology connectivity.
- PoE delivery is a modeled budget/state transition; it does not claim electrical or hardware-level simulation.
- OSPF adjacency and full end-to-end protocol behavior remain future work.

## [0.5.0] - VLAN-Aware DHCP and Layer-2 Learning
### Added
- **VLAN-Aware DHCP Forwarding**: DHCP client requests now identify the client VLAN and validate access-port VLANs, trunk allowed lists, and router subinterfaces before reaching a modeled DHCP server.
- **ARP Population**: A successful lease can create the client's gateway mapping and the router's client mapping when a default gateway is configured.
- **Dynamic MAC Learning**: Modeled DHCP traffic creates dynamic MAC entries on traversed switches with VLAN and ingress-port metadata.
- **MAC Aging**: Dynamic entries age after the modeled five-minute interval and are removed when their interface is shut down or their physical link is removed.

### Changed
- **DHCP Evidence**: Successful lease history now records the modeled VLAN forwarding, DORA result, ARP learning, and MAC learning evidence without claiming animated packet traversal.

### Accuracy Notes
- A disallowed VLAN path returns a modeled `%VLAN_NOT_ALLOWED` result and does not create a lease, ARP entry, or MAC entry.
- ARP and MAC state are modeled state transitions. They are not yet a complete packet-forwarding engine.
- Animated packet traversal, inter-VLAN routing, DNS, PoE delivery, and OSPF remain future protocol slices.

## [0.4.0] - Protocol State Foundation
### Added
- **Router DHCP Capability**: Routers can now accept the modeled Cisco IOS DHCP-server configuration commands through the capability matrix.
- **DHCP Pool State**: Track pool names, network/mask, default gateway, DNS server, and excluded addresses in the IOS session state.
- **DHCP Verification Output**: Added modeled output for `show ip dhcp pool`, `show ip dhcp binding`, `show ip dhcp conflict`, and `show ip dhcp server statistics`.
- **DHCP Inspector State**: The capability-aware inspector now renders configured DHCP pools instead of displaying only a placeholder.

### Fixed
- **Sticky IOS Submode Context**: Repeated commands now preserve interface, router, ACL, line, VLAN, and DHCP submode context until the user explicitly enters `exit` or `end`.
- **DHCP Pool Casing**: Pool identifiers are normalized for state lookup so `ip dhcp pool USERS` and `ip dhcp pool users` do not create duplicate logical pools.

### Accuracy Notes
- DHCP pool configuration is modeled state, not a completed client protocol exchange.
- `show ip dhcp binding` remains honestly empty until DHCP client discovery, offer, request, and acknowledgement behavior is implemented.
- ARP entries, learned MAC addresses, inter-VLAN forwarding, DNS, PoE delivery, OSPF adjacency, and end-to-end reachability remain planned protocol-engine work.
- The next Sprint 5 slice will add DHCP client capability and lease generation for supported endpoint devices.

## [0.3.0] - Physical Sandbox Workspace
### Added
- **3D Physical Viewport**: Added a browser-native Three.js/R3F viewport with procedural device bodies, rack details, port markers, cable curves, dimensions, and orbit controls.
- **Network Ecosystem Catalog**: Added PCs, servers, Layer 2 switches, routers, wireless access points, modems, firewalls, hubs, console servers, and modeled cable/connector definitions.
- **Port-Aware Cabling**: Users can choose a cable type and connect specific port-to-port endpoints in the 3D viewport. Cable compatibility and occupied-port checks prevent impossible links.
- **Device and Port Inspector**: Added dimensions, device roles, tags, port types, speeds, link status, cable endpoints, and physical connection details.
- **Multi-Selection**: Added Ctrl/Cmd-click selection for multiple devices and cables with aggregate inspector output and visual highlighting.
- **Viewport Filtering**: Added searchable, multi-select tag filters that affect both the device palette and visible 3D topology.
- **Collapsible Workspace Controls**: Consolidated filters, devices, and cable/connector selection into expandable controls to reduce sidebar clutter.
- **Switching State Modeling**: Added IOS state for access ports, trunk ports, native VLANs, allowed VLANs, and EtherChannel membership.
- **EtherChannel Verification**: Added validation and modeled output for `channel-group ... mode active|passive|on`, `interface port-channel`, and `show etherchannel summary`.

### Changed
- **Cable Rendering**: Cable appearance now reflects modeled access, trunk, and EtherChannel state instead of using only cable type colors.
- **Sandbox Interaction**: The viewport is now driven by topology and IOS session state; geometry is a presentation of the network model rather than the source of truth.

### Accuracy Notes
- Physical cabling and IOS configuration remain separate state machines. Cisco IOS does not provide a command that assigns a physical cable; interface, VLAN, trunk, and shutdown behavior must be configured through the IOS console.
- Animated packet traversal and full forwarding behavior are not yet claimed as complete simulator features.

## [0.2.3] - Sandbox Scenario State Reset
### Fixed
- **Ghost Lab State**: Scenario buttons now update the active lab configuration together with the displayed topology, preventing objectives and operational feedback from referring to a previous lab.
- **Sandbox Session Reset**: Switching scenarios now resets the mission step, selected device, terminal input, canvas tool, feedback, and device sessions.
- **User EXEC Initialization**: Devices in a newly selected sandbox scenario consistently begin in User EXEC mode (`>`).

## [0.2.2] - Local Development & Runtime Cleanup
### Fixed
- **Analytics Startup Warnings**: Removed unresolved Vite HTML placeholders and load the optional Umami script only when both analytics environment variables are configured.
- **pnpm Configuration Warning**: Moved `patchedDependencies` and `overrides` into `pnpm-workspace.yaml`, where current pnpm versions read them.
- **Development Setup Documentation**: Corrected the documented commands to run from the repository root instead of the `client` directory.

### Changed
- **Package Manager**: Pinned the project to pnpm `10.18.1`, matching the installed lockfile dependency version.

## [0.2.0] - The "Cockpit" Update
### Added
- **Unified Guided Sandbox Engine**: Integrated guided labs and free-play sandbox into a single component.
- **The "Cockpit" Layout**: Implemented a professional 3-column viewport (Workspace | Topology | Mission Brief).
- **Visual Topology Canvas**: Added drag-and-drop device placement and logical cabling.
- **Single Source of Truth**: Moved all lab data into `LAB_REGISTRY` within `labDefinitions.ts`.
- **Sandbox Templates**: Added the ability to load "Blank" or "Scenario" templates.
- **Persistence**: Added LocalStorage support to save custom topologies in the browser.

### Changed
- **Architecture**: Shifted logic from `Home.tsx` (page-based) to `NetworkSandbox.tsx` (engine-based).
- **Mission Rail**: Updated the instructional panel to show "Current Objective," "Operational Feedback," and "Next Up" previews.

---

## [0.1.x] - Stability & Logic Patches
### Fixed
- **Crash on Render**: Resolved `TypeError: Cannot read properties of undefined (reading 'label')` by implementing optional chaining in the Mission Brief.
- **Guided Logic Flow**: Merged the Guided Mission check with the IOS Simulator logic to ensure the terminal updates prompts and history immediately after a correct answer.
- **IOS Mode Logic**: Added the `disable` command to allow users to move from Privileged Mode (`#`) back to User Mode (`>`), preventing users from getting "trapped" in high-privilege modes.

---

## [0.1.0] - Initial Release
### Added
- Basic terminal simulation with mode transitions.
- Fixed-path guided labs.
- Home page for lab selection.
- Basic IOS command validation.

## [0.2.1] - Developer Tooling & IOS Refinement
### Added
- **Lab Blueprint Generator**: Implemented `exportAsLabDefinition` to allow users to export custom topologies as TypeScript code for the `LAB_REGISTRY`.
- **Export UI**: Added a dedicated "Export as Lab" button to the Cockpit header with a teal/cyan theme.

### Fixed
- **IOS Mode Transition**: Added the `disable` command to `isValidCommand` and `nextMode`, allowing users to transition from Privileged Mode (`#`) back to User Mode (`>`).
- **Guided Progression**: Fixed a bug where users were "trapped" in Privileged Mode, preventing them from completing User-mode objectives.
