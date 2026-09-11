# Changelog

All notable changes to the CCNA CLI Simulator will be documented in this file.

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
- OSPF state currently models directly connected neighbor matching and route installation; full SPF, timers, authentication, and multi-area behavior remain future work.
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
