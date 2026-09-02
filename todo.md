# CLI Simulator Repair Tasks

- [x] Replace the preloaded fake transcript with state-derived terminal history and prompts.
- [x] Model device mode per router: user EXEC, privileged EXEC, global configuration, interface configuration, and loopback configuration.
- [x] Accept valid Cisco command abbreviations without advancing unrelated objectives.
- [x] Make each guided step represent a coherent set of commands, while preserving manual typing across intermediate commands.
- [x] Keep R1 and R2 configuration state independent when switching consoles.
- [x] Make Run suggested execute the next valid command for the active step and context.
- [x] Ensure reset restores both router states, history, prompt, device selection, and lesson progress.
- [x] Verify manual R1/R2 configuration, static routes, final ping, and error handling.
- [x] Accept and explain directly connected global and link-local transit pings.

## Five-Lab CCNA Curriculum

- [x] Create exactly five lab modules with a shared selector and clear progression.
- [x] Lab 1: IPv4 and IPv6 addressing, MAC fundamentals, and basic CLI verification.
- [x] Lab 2: Ethernet switching, MAC tables, VLANs, trunks, and inter-VLAN routing.
- [x] Lab 3: IPv4/IPv6 static routing and OSPF/OSPFv3 fundamentals.
- [x] Lab 4: DHCP, DNS concepts, NAT/PAT, NTP, and basic device services.
- [x] Lab 5: ACLs, port security, wireless/security concepts, and integrated troubleshooting.
- [x] Preserve existing Packet Observatory styling and the working CLI simulator foundation.
- [ ] Add lab-specific objectives, hints, command validation, completion state, and reset behavior.

## In-App Lab 2 Simulator

- [x] Add simulated devices R1, SW1, SW2, PC-A, and PC-B inside the app.
- [x] Add independent Cisco-style CLI state for the router and switches.
- [x] Implement VLAN creation, access-port assignment, trunking, native VLAN, LACP, and Rapid PVST+ commands.
- [x] Implement router subinterfaces, IPv4/IPv6 gateway addresses, and simulated inter-VLAN reachability.
- [x] Add Lab 2-specific verification output for VLANs, trunks, EtherChannel, STP, MAC tables, interfaces, routes, and ping.
- [x] Add Lab 2 hints, suggested commands, progress, reset, and challenge mode.
- [x] Preserve Lab 1 state and behavior when switching curriculum modules.
- [x] Verify the in-app Lab 2 flow and publish a new checkpoint.

## Accuracy and Domain Refactor

- [x] Replace simplified Lab 2 milestone shortcuts with full Cisco IOS command and mode behavior.
- [x] Support exact configuration submodes such as `config-vlan`, `config-if`, `config-subif`, and `config-if-range` where appropriate.
- [x] Preserve full command sequences instead of accepting one representative command as completion.
- [x] Rename devices, VLANs, interfaces, and mission copy around Construction Enterprises and Factory to Foundation.
- [x] Define a coherent named topology for the Construction Enterprises headquarters and Factory to Foundation site.
- [x] Add exact command-specific verification output and no generic fallback names.
- [x] Re-run type-check, build, visual verification, and checkpoint only after the refactor is complete.
- [x] Verify exactly five labs are visible and each can be selected without breaking existing behavior.
