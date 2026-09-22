# Changelog

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
