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
- [x] Verify exactly five labs are visible and each can be selected without breaking existing behavior.
