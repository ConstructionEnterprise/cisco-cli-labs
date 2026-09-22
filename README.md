***

# Cisco CLI Labs: Unified Guided Sandbox

**Cisco CLI Labs** is a professional browser-based Cisco IOS training simulator for CCNA 200-301. It utilizes a **Unified Guided Sandbox** architecture, treating all learning paths as visual topologies with an integrated instructional "Mission Brief" overlay.

The simulator is presented as a Construction Enterprises training console. It models a focused set of command contexts, device states, and verification outputs to provide a repeatable, low-stakes environment for mastering the Cisco CLI.

## Guided Packet Visualization

Every tranche lab can present a compact, protocol-aware packet trace alongside the command objective. The shared `GuidedPacketTrace` component keeps the animation visible in a fixed-height frame so packet movement never pushes the IOS console out of view. Frames are initially shown in standby, then activate as the learner enters meaningful configuration or verification commands.

The traces are instructional models, not live packet captures. Each frame identifies the participating devices, direction, traffic kind, Layer 2 destination, Layer 3 destination, and the protocol event being demonstrated. Profiles cover common CCNA flows including DHCP DORA, IPv4 and IPv6 neighbor discovery, VLAN and trunk traffic, STP control traffic, EtherChannel, router-on-a-stick, static routing, OSPFv2/v3, NAT/PAT, ACL decisions, SSH, port security, CIDR/VLSM, multicast, and broadcast behavior. Tranche labs are separate from the Network Sandbox and Operations Sandbox: they provide guided command practice, while the two sandboxes provide open topology construction and physical field-work simulation.

## CLI Learning Workspace

The guided IOS console is optimized for keeping the next command and the evidence visible together:

* **Three-line live viewport:** The terminal shows the latest three rendered command/result lines. An invalid command consumes two lines, making mistakes visible without allowing old output to crowd out the current task.
* **Scrolling startup context:** The Cisco IOS banner and device identity enter the same scrolling history as later commands instead of remaining as a permanent block.
* **Command History:** The terminal header opens a full per-device command history overlay without changing the console height.
* **Live verification tables:** A dedicated panel below the IOS simulator exposes the active device's IP interface, IP address, default gateway, ARP, MAC address, trunk, EtherChannel, explicit LACP/static bundle protocol, ACL, NAT/PAT, and OSPF state while the learner builds that state through the CLI. Tables are modeled from the current session and show honest empty states when no entries have been learned or configured.
* **Resizable verification workspace:** Grab bars allow the IOS simulator and verification-table panel to be resized upward or downward within bounded heights. Each grab bar also supports keyboard adjustment with the arrow, Home, and End keys.
* **Independent panel minimization:** The IOS simulator and Live Verification Tables each have their own minimize and restore control, preserving the header while collapsing the panel body to reclaim workspace.
* **NAT/PAT command validation:** The guided IOS grammar accepts `ip nat inside source list <number> interface <interface> overload` in Global Configuration mode while continuing to reject the global command from interface configuration mode. Existing `ip nat inside` interface behavior remains supported.
* **Collapsible lab header:** The tranche identifier and lab title remain available in a compact bar while the larger description can be collapsed to make room for the packet trace and CLI.
* **Fixed visual rhythm:** Packet traces use a stable viewport height and compact spacing so activating a new frame does not move the console underneath it.
* **Packet-trace playback control:** The slide counter is an accessible Pause/Resume button. Pausing freezes the current frame and counter without changing lab progress or IOS session state.
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
* **Reactive OSPF packet trace:** The operational context now progresses from process idle, through build-in-progress and Hello eligibility, to Hello/LSA/route-install milestones. The `show ip ospf neighbor` evidence pass emphasizes DBD exchange, while `show ip route ospf` emphasizes route installation.
* **OSPF DR/BDR lab:** Added a dedicated multi-access Ethernet scenario with CE-R1, CE-R2, CE-R3, and CE-SW1. The lab teaches `ip ospf priority`, `ip ospf network broadcast`, and `ip ospf cost`, and the live tables expose router ID, network type, priority, cost, and modeled DR/BDR/DROTHER roles.
* **FHRP module:** Added a separate First Hop Redundancy Protocol lab covering HSRP, VRRP, and GLBP virtual IPs, priorities, preemption, active/standby or master/backup roles, and failover-oriented operational context.
* **MAC inventory versus learning:** The live MAC table now distinguishes deterministic MAC addresses assigned to topology-connected interfaces from dynamic forwarding entries learned after modeled traffic. Connected interface and peer MACs appear immediately; `show mac address-table` remains a verification view of the learned forwarding state.
* **IPv6 access-switch context:** TR2 IPv6 Interface Fundamentals now models `CE-R1 ⇄ CE-SW1 ⇄ V6-PC1`. CDP can therefore show the router-to-switch neighbor while IPv6 Neighbor Discovery traverses the Layer 2 segment to the active V6-PC1 endpoint.

These behaviors preserve the Observe -> Configure -> Verify loop while reducing unnecessary page scrolling during command entry.

### Startup and Curriculum Navigation

The application returns the browser viewport to the top when it boots, when a guided lab is selected, and when the user enters or exits a sandbox view. The Curriculum ribbon provides five master tranche menus. **Master Tranche One** exposes the existing guided labs through nested Tranche One–Five menus; Master Tranches Two–Five establish the same curriculum hierarchy with disabled `Placeholder Lab` entries until those future lab sets are implemented.

The Network Sandbox opens with its workspace and Devices panel collapsed, while retaining the first device as the IOS console target. The IOS console remains visible in a compact expanded dock at a 150px default height, and can be minimized, restored, resized, or closed by the user. Device selection and other expandable controls are user-driven rather than automatically opening additional inspection content.

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
*   **Verification:** The simulator models commands such as `show interfaces trunk` and `show etherchannel summary` from the current session state.
*   **Protocol state foundation:** Router DHCP-server configuration tracks pools, networks, default gateways, DNS servers, and excluded addresses. The DHCP inspector and `show ip dhcp pool` expose that state.
*   **VLAN-aware DHCP path:** Modeled DHCP client requests identify the client VLAN and validate access ports, trunks, allowed VLANs, and router subinterfaces before allocating a lease. Blocked VLAN paths do not bind.
*   **ARP and MAC state:** Successful modeled leases populate gateway/client ARP mappings and dynamic switch MAC entries. Entries are removed when the learned port is shut down or its link is removed, and age after the modeled aging interval.
*   **Router-on-a-stick validation:** Cross-VLAN modeled probes require active router subinterfaces with `encapsulation dot1q` and an IP address on both VLAN paths.
*   **DNS and PoE state:** DNS host records and resolver cache state are modeled through `ip dns server`, `ip host`, and `nslookup`; switch `power inline auto` negotiates a connected AP's modeled class and wattage within the switch budget.
*   **OSPF and modeled ping:** Router OSPF processes, router IDs, network statements, matched neighbor state, and modeled OSPF routes are inspectable through `show ip ospf neighbor`, `show ip ospf database`, and `show ip route`. Resolved ping paths produce Cisco-style modeled results and use the existing port-to-port packet visualization.
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

The protocol features above are modeled state transitions, not claims of real network access. Packet particles visualize a resolved modeled path; they do not represent live ICMP, DHCP, DNS, OSPF, TCP, or UDP traffic. OSPF currently covers directly connected neighbor matching and modeled route installation; timers, authentication, full SPF behavior, multi-area operation, and external reachability remain out of scope.

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
