# IPv6 CLI Lab — Design Brainstorm

## Three stylistic approaches

### Theme Name: Field Console
Very Brief Intro: A warm, paper-and-graphite learning console that treats networking as a field notebook: tactile, calm, and focused on understanding rather than spectacle.
Probability: 0.07

### Theme Name: Packet Observatory
Very Brief Intro: A high-contrast technical instrument panel inspired by network operations centers, with dark navy surfaces, amber telemetry, and crisp terminal focus.
Probability: 0.03

### Theme Name: Signal Atlas
Very Brief Intro: An editorial cartography interface that turns IPv6 prefixes and routes into a living atlas, mixing a cool white canvas with cyan ink, coral alerts, and map-like annotations.
Probability: 0.09

## Selected approach: Packet Observatory

### Design Movement
Contemporary technical editorialism with the clarity of Swiss information design and the quiet intensity of an observability console. The app should feel like a field instrument for learning: legible, purposeful, and slightly cinematic without becoming cyberpunk.

### Core Principles
1. **Evidence over decoration.** Every panel should help the learner configure, inspect, or understand the topology.
2. **Console-first hierarchy.** The simulated terminal is the hero interaction; supporting content frames the task instead of competing with it.
3. **Signal colors carry meaning.** Cyan identifies active IPv6 connectivity, amber marks the current learning task, and coral signals errors or incomplete verification.
4. **Editorial pacing.** Use asymmetry, strong section labels, and short explanatory notes to make the learning sequence feel intentional rather than like a generic dashboard.

### Color Philosophy
The base is a near-black blue-gray that resembles a quiet NOC after hours and keeps terminal output comfortable to read. A signature electric cyan is reserved for IPv6 path lines, active states, and confirmed reachability. Warm amber is used for the learner’s current objective and progress markers, providing human warmth against the technical base. Coral is used sparingly for mistakes and troubleshooting prompts so it reads as a signal, not a brand accent.

### Layout Paradigm
A persistent left rail establishes the learning sequence, while the main canvas uses an asymmetric split: a compact topology/evidence column on the left and a large terminal workbench on the right. Below, a horizontally flowing “route” of lab milestones replaces a generic card grid. On smaller screens the rail becomes a top strip and the terminal remains the first-class surface.

### Signature Elements
1. A thin cyan “packet trace” line that connects topology nodes and animates only when a command succeeds.
2. Small uppercase instrument labels with index numbers, such as `01 / ADDRESSING`, to create a deliberate lab-bench rhythm.
3. Terminal prompts that visually distinguish device context (`R1#`, `R2#`) from learner input, with compact command chips for suggested actions.

### Interaction Philosophy
Interactions should feel like operating a reliable instrument. Commands submit instantly, output appears with a restrained line reveal, and successful actions produce a small trace pulse rather than a noisy celebration. Hints are progressive: first a conceptual nudge, then the exact syntax only if requested. Keyboard focus and the Enter key are central.

### Animation
Use subtle opacity and transform transitions under 240ms. On command success, animate the route trace from the source node to the destination node with a short cyan pulse. Newly unlocked steps should fade and translate upward by a few pixels. Never animate routine keyboard actions or make terminal output type itself so slowly that it impedes learning. Respect `prefers-reduced-motion`.

### Typography System
Use **IBM Plex Sans** for interface labels and explanatory copy, paired with **IBM Plex Mono** for terminal output, addresses, commands, and topology annotations. Headings use IBM Plex Sans at 700 with tight tracking; labels use 600 with 0.12em uppercase tracking; terminal text uses 14–15px mono with generous line height.

### Brand Essence
**IPv6 CLI Lab is a guided network console for learners who want to build real Cisco IPv6 instincts through deliberate practice, not passive reading.** Personality adjectives: **precise, patient, signal-driven**.

### Brand Voice
Headlines are direct and mission-oriented. CTAs sound like the next useful action, never like generic marketing. Microcopy teaches through observation and encourages recovery from errors.

Example lines:

> **Bring the transit link up. Then trust the evidence.**

> **Run the command. Read the route. Explain the path.**

### Wordmark & Logo
The mark is a compact geometric “6” formed from two offset route segments and a central node, designed to work as a small cyan instrument glyph without text. The wordmark pairs a bold `IPV6` with a lighter `CLI LAB` lockup, aligned on a baseline like a console status readout. The logo should be generated as a transparent PNG and used at a clearly visible size in the header and favicon.

### Signature Brand Color
**Trace Cyan — `#63E6E2`**. It represents a confirmed packet path: bright enough to feel alive against the observatory base, but cooler and more disciplined than neon blue.

## Style Decisions

- Use an off-black blue-gray base with warm off-white text, not a pure black or a purple gradient.
- Keep the terminal as the dominant interaction and use a clear left rail instead of a centered landing-page composition.
- Use IBM Plex Sans and IBM Plex Mono; do not use Inter.
- Use cyan for active IPv6 traces, amber for current learning focus, and coral for errors.
- Keep motion short, informative, and reduced-motion safe.
- Prefer crisp 10–14px corner radii, hairline borders, and layered surfaces over uniform rounded cards.
