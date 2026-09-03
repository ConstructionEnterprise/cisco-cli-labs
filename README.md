# Cisco CLI Labs

**Cisco CLI Labs** is a browser-based Cisco IOS training simulator for CCNA learners. It provides a terminal-first practice environment where learners select a virtual device, enter IOS commands manually, read the resulting prompt and evidence, and progress through guided configuration and troubleshooting objectives.

The simulator is presented as a Construction Enterprises and Factory to Foundation training console. It does not connect to physical Cisco hardware or emulate a production IOS image. Instead, it models a focused set of command contexts, device states, guided objectives, verification output, and reachability outcomes for repeatable learning.

## Learning model

Every lab follows the same operational loop:

> **Observe → Configure → Verify → Break → Repair → Explain**

The learner can type commands manually, reveal a contextual hint, copy the exact next command, or run the suggested command. Each lab has its own device sessions, IOS modes, terminal history, progress state, reset behavior, and completion challenge.

The simulator emphasizes the relationship between command syntax, prompt context, configuration state, and verification evidence. It expects full IOS vocabulary rather than app-specific aliases.

## Curriculum

The five-lab sequence groups the major CCNA 200-301 domains into coherent practice environments. Conceptual topics are presented as areas to understand, while command objectives are presented as actions to configure and verify.[1] [2]

| Lab | Domain | Focus |
|---|---|---|
| **Lab 1 — Addressing + CLI Foundations** | Network Fundamentals | IOS modes, Ethernet identity, IPv4 and IPv6 addressing, link-local behavior, interfaces, `show` commands, and reachability |
| **Lab 2 — Switching, VLANs, Trunks, EtherChannel, STP, and Inter-VLAN Routing** | Network Access | Access ports, named VLANs, 802.1Q trunks, native VLANs, LACP EtherChannel, Rapid PVST+, PortFast, BPDU Guard, management SVIs, and router-on-a-stick |
| **Lab 3 — Routing + OSPF Deep Dive** | IP Connectivity | Three-router dual-stack routing, static routes, loopbacks, OSPFv2, OSPFv3, router IDs, network statements, passive interfaces, neighbor state, route selection, OSPF databases, traceroute, and end-to-end reachability |
| **Lab 4 — Services + Management** | IP Services | DHCP, NAT/PAT, NTP, DNS awareness, SSH, syslog, and management verification |
| **Lab 5 — Security + Troubleshooting** | Security and Automation | Local security, SSH hardening, ACLs, port security, DHCP snooping, integrated outage diagnosis, and automation concepts |

### Lab 3 topology

The expanded routing lab uses this dual-stack topology:

```text
CE-HQ-R1  ⇄  CE-MFG-R2  ⇄  FTF-R3
Headquarters    Manufacturing    Factory to Foundation
```

Lab 3 builds and verifies IPv4 and IPv6 paths across all three routers. It includes separate loopback networks for Headquarters, Manufacturing, and Factory to Foundation, plus transit links between adjacent routers. The sequence finishes with route-specific lookups, IPv4 traceroute, IPv4 and IPv6 ping tests, configuration save, and a final routing-table review.

## Project structure

```text
.
├── client/
│   ├── index.html                 # Vite HTML entry point
│   ├── public/                    # Static public assets
│   └── src/
│       ├── App.tsx                # Application shell and routes
│       ├── components/            # Error boundary and reusable UI primitives
│       ├── contexts/              # Theme context
│       ├── hooks/                 # Reusable React hooks
│       ├── pages/
│       │   ├── Home.tsx           # Lab data, simulator state, terminal, and UI
│       │   └── NotFound.tsx        # Fallback route
│       ├── const.ts                # Client constants
│       ├── index.css               # Global styling
│       └── main.tsx                # React entry point
├── server/
│   └── index.ts                   # Express static server for production
├── shared/
│   └── const.ts                   # Shared constants
├── ccna-curriculum.md             # Detailed curriculum and coverage notes
├── ideas.md                       # Product and implementation notes
├── todo.md                        # Completed and pending work items
├── template.json                   # Project template metadata
├── vite.config.ts                 # Vite configuration
├── tsconfig.json                  # TypeScript configuration
└── package.json                   # Scripts and dependencies
```

The current simulator is intentionally compact: the lab definitions and most command-state behavior live in `client/src/pages/Home.tsx`. The frontend owns the virtual IOS sessions and learning state. The Express server serves the compiled frontend and provides the production fallback for client-side routes; there is no database or external API required for the simulator itself.

## Technology stack

The project uses React 19 with TypeScript and Vite. Styling is implemented with Tailwind CSS and reusable Radix UI primitives. Wouter provides lightweight client-side routing, while Lucide React supplies interface icons. The project also includes Framer Motion, Sonner notifications, React Hook Form, Recharts, and supporting UI packages.[3]

## Requirements

You need Node.js, pnpm, and a modern browser. The repository declares pnpm 10.4.1 as its package manager. No Cisco hardware, emulator image, database, cloud account, or external service credentials are required.

## Local development

Install the dependencies from the repository root:

```bash
pnpm install --frozen-lockfile
```

Start the Vite development server:

```bash
pnpm dev
```

Vite will print the local URL, normally `http://localhost:3000/` unless that port is already in use. The `--host` flag is already included in the project’s `dev` script, so the development server can also be reached from another device on the same network when the environment permits it.

Open the printed URL in a browser. Select a lab from the curriculum bar, choose a device console when the topology has multiple devices, and follow the guided command path. Use **Reset** to return the selected lab to its initial state.

## Useful commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start the Vite development server |
| `pnpm check` | Run the TypeScript compiler without emitting files |
| `pnpm build` | Build the frontend and bundle the production Express server |
| `pnpm start` | Start the compiled production server with `NODE_ENV=production` |
| `pnpm preview` | Preview the Vite production build |
| `pnpm format` | Format the project with Prettier |

A typical verification sequence is:

```bash
pnpm check
pnpm build
```

## Production behavior

The production build first creates the static frontend with Vite and then bundles `server/index.ts` into `dist/index.js`. The Express server serves the compiled frontend from the production public directory and returns `index.html` for unmatched paths so client-side routing continues to work.

```bash
pnpm build
pnpm start
```

The server uses the `PORT` environment variable when provided and otherwise listens on port `3000`.

## Simulator behavior and limitations

The project is a focused educational simulator, not a full IOS implementation. It validates the guided commands and their required device and mode contexts rather than attempting to implement every Cisco command. The virtual devices maintain independent sessions, prompts, modes, and command histories during a lab run.

The simulator does not persist learner progress between browser sessions, authenticate users, connect to real network devices, or provide a real packet-forwarding data plane. Reachability and verification commands produce modeled training evidence associated with the current objective.

The curriculum includes conceptual coverage that is not always modeled as a complete operational subsystem. This is deliberate: the project distinguishes topics learners should understand from CLI tasks it simulates directly.

## Contributing and extending a lab

To extend a lab, add or revise `s(...)` step definitions in `client/src/pages/Home.tsx`. Each step contains a title, explanation, expected device, required IOS mode, exact command, and success message:

```ts
s(
  "Verify the Factory route",
  "Prove the routed path to Factory to Foundation.",
  "CE-HQ-R1",
  "privileged",
  "ping 10.30.0.10",
  "Success rate is 100 percent. The routed path is reachable."
)
```

When adding a command that changes IOS context, update `nextMode()` in the same file so the simulator produces the appropriate prompt and preserves the expected state. Keep device names, topology labels, addressing plans, and verification messages consistent with `ccna-curriculum.md`.

After making changes, run the TypeScript check and production build. Then manually test the relevant lab from a clean reset, including device switching, incorrect-command handling, hints, suggested commands, and final completion.

## Educational references

The curriculum is informed by Cisco’s published CCNA 200-301 exam topics and study material.[1] [2]

## License

This project is licensed under the MIT License as declared in `package.json`.

## References

[1]: https://learningnetwork.cisco.com/s/ccna-exam-topics "Cisco Learning Network — 200-301 CCNA Exam Topics and Study Guide"

[2]: https://learningcontent.cisco.com/documents/marketing/exam-topics/200-301-CCNA-v1.1.pdf "Cisco Public — CCNA Exam v1.1 (200-301)"

[3]: https://github.com/ConstructionEnterprise/cisco-cli-labs/blob/main/package.json "Cisco CLI Labs package manifest"
