# CLI Simulator Repair Tasks

- [x] Replace the preloaded fake transcript with state-derived terminal history and prompts.
- [x] Model device mode per router: user EXEC, privileged EXEC, global configuration, interface configuration, and loopback configuration.
- [x] Accept valid Cisco command abbreviations without advancing unrelated objectives.
- [x] Make each guided step represent a coherent set of commands, while preserving manual typing across intermediate commands.
- [x] Keep R1 and R2 configuration state independent when switching consoles.
- [x] Make Run suggested execute the next valid command for the active step and context.
- [x] Ensure reset restores both router states, history, prompt, device selection, and lesson progress.
- [x] Verify manual R1/R2 configuration, static routes, final ping, and error handling.
