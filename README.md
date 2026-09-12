***

# Cisco CLI Labs: Unified Guided Sandbox

**Cisco CLI Labs** is a professional browser-based Cisco IOS training simulator for CCNA 200-301. It utilizes a **Unified Guided Sandbox** architecture, treating all learning paths as visual topologies with an integrated instructional "Mission Brief" overlay.

The simulator is presented as a Construction Enterprises training console. It models a focused set of command contexts, device states, and verification outputs to provide a repeatable, low-stakes environment for mastering the Cisco CLI.

## 📐 The "Cockpit" Design

The simulator uses a high-efficiency 3-column professional layout designed for maximum learner focus:

*   **Left Panel (Workspace):** Select/Pan/Cable/Erase tools, snap-to-grid, searchable device palette, multi-select tag filters, and expandable device controls for building custom topologies.
*   **Center Panel (Topology):** A schematic canvas or 3D physical viewport where devices, ports, cable types, and topology relationships can be inspected and edited.
*   **Right Panel (Mission Brief):** A guided instructional rail that tracks the current objective, provides real-time operational feedback (✓/✕), and previews upcoming tasks.
*   **Bottom Dock (IOS Console):** A shared terminal engine that handles mode transitions (`user` $\rightarrow$ `privileged` $\rightarrow$ `config`) and validates commands against the lab registry.

The 3D workspace is intentionally procedural and browser-native. Device bodies, rack details, port markers, dimensions, and cable curves are generated from the network model without requiring external CAD assets.

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
* **Mission Brief:** The left panel tracks the active objective, tool, inspected count, contamination count, cleaning count, progress, feedback, and report export readiness.
* **Operations Schematic:** The right panel provides a true 2D, dependency-free SVG drawing of the selected tool, OM4 fiber path, and LC/UPC connector. It follows the active tool and connector state rather than displaying a static illustration.
* **Inspection export:** A completed inspection can be exported as a CSV record containing connector IDs, inspection scores, inspection state, and cleaning state.

The Operations Sandbox currently uses modeled diagnostic state. It does not claim to be official Fluke hardware or software, and its results are intentionally derived from the simulated connector and link data.
*   **Capability-aware inspection:** Device inspectors expose only the tabs supported by the selected device, with honest empty states for protocol tables that are not yet populated.

Physical cabling is not represented as a fictitious IOS command. Interface configuration, VLAN assignment, trunking, EtherChannel, shutdown state, DHCP pool configuration, DNS records, PoE commands, and OSPF configuration are performed through the IOS console. Packet particles and Cisco-style ping output reflect modeled path transitions; they are not a claim of real network reachability or full transport behavior.

## 🚀 Technical Architecture

The app has moved from a page-based logic to an engine-based logic:

*   **`client/src/labs/labDefinitions.ts`**: The **Single Source of Truth**. Contains the `LAB_REGISTRY` which defines all devices, links, and step-by-step validation logic.
*   **`client/src/components/NetworkSandbox.tsx`**: The **Main Engine**. Handles the visual canvas, drag-and-drop logic, cabling, and the integration between the terminal and the mission rail.
*   **`client/src/components/ThreeSandboxViewport.tsx`**: The **Physical Viewport**. Renders procedural 3D devices, ports, cables, filtering, selection, and state-aware link presentation.
*   **`client/src/components/TabbedInspector.tsx`**: The **Capability-Aware Inspector**. Renders device-specific Summary, Interfaces, IP, VLAN, MAC, ARP, Routing, DHCP, and DNS views from session state.
*   **`client/src/pages/Home.tsx`**: The **Hub**. Manages lab selection and coordinates the transition into the sandbox workspace.
*   **`client/src/lib/network-ecosystem.ts`**: The device, port, cable, connector, dimensions, and tag catalog used by the sandbox.
*   **`client/src/lib/network-topology.ts`**: Shared topology selection and port-reference types.
*   **`client/src/lib/capabilities.ts`**: Device capability matrix and command capability gates.

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
