// Packet Observatory design: terminal-first, asymmetric lab console; IBM Plex Sans + IBM Plex Mono; cyan traces, amber focus, coral errors.
import { useMemo, useState } from "react";
import { Check, ChevronRight, CircleHelp, Copy, ExternalLink, Gauge, Network, Play, RotateCcw, TerminalSquare, Wifi, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Step = {
  id: number;
  code: string;
  eyebrow: string;
  title: string;
  description: string;
  device: "R1" | "R2" | "BOTH";
  expected: string[];
  success: string;
  hint: string;
  explain: string;
};

const steps: Step[] = [
  { id: 1, code: "01", eyebrow: "ACCESS", title: "Enter privileged EXEC mode", description: "Start on R1. Move from user EXEC to privileged EXEC so the router will accept configuration commands.", device: "R1", expected: ["enable"], success: "R1 is now in privileged EXEC mode.", hint: "The command is a single word: enable", explain: "The # prompt indicates privileged EXEC mode." },
  { id: 2, code: "02", eyebrow: "FORWARDING", title: "Enable IPv6 forwarding", description: "Turn the router into an IPv6 router. This is the global prerequisite for forwarding packets between interfaces.", device: "R1", expected: ["configure terminal", "conf t", "ipv6 unicast-routing"], success: "IPv6 unicast forwarding is enabled on R1.", hint: "Enter configuration mode first, then use ipv6 unicast-routing.", explain: "IPv6 forwarding is a global router setting, not an interface setting." },
  { id: 3, code: "03", eyebrow: "ADDRESSING", title: "Configure R1’s transit interface", description: "Give G0/0 a global address and a predictable link-local address, then bring the interface up.", device: "R1", expected: ["interface gigabitEthernet 0/0", "int g0/0", "ipv6 address 2001:db8:12:12::1/64", "ipv6 address fe80::1 link-local", "no shutdown"], success: "R1’s transit interface is addressed and up.", hint: "Use the exact address from the addressing plan: 2001:db8:12:12::1/64.", explain: "The /64 prefix identifies the shared transit network. The link-local address stays on that link." },
  { id: 4, code: "04", eyebrow: "SIMULATED LAN", title: "Configure R1’s loopback", description: "Use Loopback0 as a stable simulated LAN prefix so the lab can test routing without a switch or PC.", device: "R1", expected: ["interface loopback 0", "int lo0", "ipv6 address 2001:db8:1::1/64"], success: "R1’s simulated LAN is ready.", hint: "Loopback interfaces stay logically up and are perfect for representing a routed prefix.", explain: "The loopback creates a connected route for 2001:db8:1::/64." },
  { id: 5, code: "05", eyebrow: "PEER CONFIG", title: "Configure R2", description: "Switch to R2 and mirror the transit and loopback design with R2’s addresses.", device: "R2", expected: ["ipv6 unicast-routing", "ipv6 address 2001:db8:12:12::2/64", "ipv6 address fe80::2 link-local", "ipv6 address 2001:db8:2::1/64"], success: "R2 now has IPv6 forwarding and both local prefixes.", hint: "On R2, use ::2 on the transit link and 2001:db8:2::1/64 on Loopback0.", explain: "Both routers now share one transit prefix and each owns one unique LAN prefix." },
  { id: 6, code: "06", eyebrow: "ROUTING", title: "Add static routes", description: "Tell each router how to reach the remote loopback. Use the neighbor’s link-local address and the transit interface.", device: "BOTH", expected: ["ipv6 route 2001:db8:2::/64 fe80::2 gigabitEthernet 0/0", "ipv6 route 2001:db8:1::/64 fe80::1 gigabitEthernet 0/0"], success: "Static routes installed in both directions.", hint: "A link-local next hop needs the outgoing interface: fe80::2 g0/0 from R1, fe80::1 g0/0 from R2.", explain: "The routing table now has an explicit path to the remote simulated LAN." },
  { id: 7, code: "07", eyebrow: "EVIDENCE", title: "Verify the path", description: "Run a reachability test from R1 to R2’s loopback. The packet should cross the transit link and arrive at 2001:db8:2::1.", device: "R1", expected: ["ping ipv6 2001:db8:2::1", "show ipv6 route", "show ipv6 neighbors"], success: "End-to-end IPv6 reachability confirmed.", hint: "Start with ping ipv6 2001:db8:2::1. Then inspect the route and neighbor table.", explain: "A successful ping is the final evidence that addressing, forwarding, routing, and neighbor discovery align." },
];

const outputByDevice: Record<string, string[]> = {
  R1: ["R1> enable", "R1# configure terminal", "R1(config)# ipv6 unicast-routing", "R1(config)# interface g0/0", "R1(config-if)# ipv6 address 2001:db8:12:12::1/64", "R1(config-if)# no shutdown", "R1(config-if)# %LINK-5-CHANGED: Interface GigabitEthernet0/0, changed state to up"],
  R2: ["R2# configure terminal", "R2(config)# ipv6 unicast-routing", "R2(config)# interface g0/0", "R2(config-if)# ipv6 address 2001:db8:12:12::2/64", "R2(config-if)# no shutdown", "R2(config-if)# %LINK-5-CHANGED: Interface GigabitEthernet0/0, changed state to up"],
};

export default function Home() {
  const [activeStep, setActiveStep] = useState(1);
  const [device, setDevice] = useState<"R1" | "R2">("R1");
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>(outputByDevice.R1);
  const [completed, setCompleted] = useState<number[]>([]);
  const [hintVisible, setHintVisible] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  const step = steps[activeStep - 1];
  const percent = Math.round((completed.length / steps.length) * 100);
  const statusLabel = completed.length === steps.length ? "LAB COMPLETE" : `STEP ${String(activeStep).padStart(2, "0")} OF ${String(steps.length).padStart(2, "0")}`;

  const prompt = useMemo(() => {
    if (activeStep === 1) return `${device}>`;
    if (activeStep === 3 || activeStep === 4) return `${device}(config-if)#`;
    return `${device}(config)#`;
  }, [activeStep, device]);

  function submitCommand(value = command) {
    const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
    if (!normalized) return;
    const expected = step.expected.some((item) => normalized === item.toLowerCase() || normalized.includes(item.toLowerCase()));
    const line = `${prompt} ${value.trim()}`;
    setHistory((current) => [...current, line]);
    setCommand("");
    if (!expected) {
      setHistory((current) => [...current, `% Invalid input detected at '^' marker.`, `Hint: ${step.hint}`]);
      toast.error("That command does not complete this step yet.");
      return;
    }
    setHistory((current) => [...current, step.success, `✓ Evidence: ${step.explain}`]);
    if (!completed.includes(step.id)) setCompleted((current) => [...current, step.id]);
    setHintVisible(false);
    toast.success(`Step ${step.code} verified`);
    if (activeStep < steps.length) {
      setActiveStep((current) => current + 1);
      if (step.id === 4) setDevice("R2");
    }
  }

  function resetLab() {
    setActiveStep(1); setDevice("R1"); setCommand(""); setCompleted([]); setHintVisible(false); setHistory(outputByDevice.R1);
    toast("Lab reset", { description: "Your progress was cleared. Start again from R1>" });
  }

  function switchDevice(next: "R1" | "R2") {
    setDevice(next);
    setHistory(outputByDevice[next]);
    toast(`Console switched to ${next}`, { description: "The simulator is ready for the next command." });
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#0b1118] text-[#f2f5f5]">
      <header className="border-b border-white/10 bg-[#0b1118]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-[#63e6e2]/40 bg-[#10252b] shadow-[0_0_22px_rgba(99,230,226,.12)]">
              <img src="/manus-storage/ipv6-trace-mark_f814341b.png" alt="IPv6 CLI Lab mark" className="h-8 w-8 object-contain" />
            </div>
            <div><div className="font-mono text-[11px] uppercase tracking-[.22em] text-[#63e6e2]">Packet Observatory</div><div className="font-display text-lg font-semibold tracking-tight">IPv6 CLI Lab</div></div>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#98a8b0]"><span className="hidden sm:inline">TRAINING CONSOLE</span><span className="h-1.5 w-1.5 rounded-full bg-[#63e6e2] shadow-[0_0_10px_#63e6e2]" /><span className="font-mono">LOCAL SESSION</span></div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[250px_1fr]">
        <aside className="border-b border-white/10 bg-[#0d151e] lg:min-h-[calc(100vh-73px)] lg:border-b-0 lg:border-r">
          <div className="p-5 lg:sticky lg:top-0">
            <div className="mb-7 flex items-center justify-between"><div><div className="instrument-label">LAB PATH</div><div className="mt-1 text-sm text-[#9eacb2]">IPv6 foundations</div></div><Gauge className="h-4 w-4 text-[#f5b74b]" /></div>
            <nav className="space-y-1.5" aria-label="Lab steps">
              {steps.map((item) => {
                const done = completed.includes(item.id); const current = item.id === activeStep;
                return <button key={item.id} onClick={() => setActiveStep(item.id)} className={`group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-all duration-200 ${current ? "bg-[#173038] text-white shadow-[inset_3px_0_0_#63e6e2]" : "text-[#82919a] hover:bg-white/[.04] hover:text-[#dce5e5]"}`}><span className={`font-mono text-[10px] ${current ? "text-[#63e6e2]" : done ? "text-[#f5b74b]" : "text-[#54626a]"}`}>{item.code}</span><span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>{done ? <Check className="h-3.5 w-3.5 text-[#f5b74b]" /> : current ? <ChevronRight className="h-3.5 w-3.5 text-[#63e6e2]" /> : null}</button>;
              })}
            </nav>
            <div className="mt-8 border-t border-white/10 pt-5"><div className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-wider text-[#77858d]"><span>Progress</span><span className="text-[#63e6e2]">{percent}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#63e6e2] transition-all duration-300" style={{ width: `${percent}%` }} /></div><p className="mt-3 text-xs leading-relaxed text-[#6d7b83]">Run the command, read the evidence, explain the path.</p></div>
          </div>
        </aside>

        <section className="relative min-w-0">
          <div className="absolute inset-0 opacity-35" style={{ backgroundImage: "url('/manus-storage/packet-observatory-texture_96a51270.jpg')", backgroundSize: "cover", backgroundPosition: "top right" }} />
          <div className="relative mx-auto max-w-[1240px] px-5 py-7 lg:px-10 lg:py-9">
            <div className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="instrument-label text-[#f5b74b]">{statusLabel}</div><h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold tracking-[-.03em] text-white md:text-5xl">Build the path.<br /><span className="text-[#63e6e2]">Trust the evidence.</span></h1></div><div className="flex gap-2"><Button variant="outline" className="border-white/15 bg-[#101923]/70 text-[#aab8bd] hover:bg-white/10 hover:text-white" onClick={() => setShowGuide((v) => !v)}><CircleHelp className="mr-2 h-4 w-4" /> {showGuide ? "Hide brief" : "Show brief"}</Button><Button variant="outline" className="border-white/15 bg-[#101923]/70 text-[#aab8bd] hover:bg-white/10 hover:text-white" onClick={resetLab}><RotateCcw className="mr-2 h-4 w-4" /> Reset</Button></div></div>

            {showGuide && <div className="mb-7 grid gap-4 xl:grid-cols-[1.15fr_.85fr]"><div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#111c27]/90 p-5 shadow-2xl"><div className="absolute inset-y-0 right-0 w-1/2 opacity-30" style={{ backgroundImage: "url('/manus-storage/ipv6-route-atlas_06f29285.jpg')", backgroundSize: "cover", backgroundPosition: "center" }} /><div className="relative max-w-xl"><div className="instrument-label">MISSION BRIEF</div><p className="mt-3 max-w-lg text-base leading-7 text-[#c2cccf]">Configure a two-router IPv6-only path using the Cisco CLI. Loopbacks stand in for LANs so every route decision stays visible.</p><div className="mt-5 flex flex-wrap gap-2"><span className="data-chip"><Network className="h-3.5 w-3.5 text-[#63e6e2]" /> 2 routers</span><span className="data-chip"><Wifi className="h-3.5 w-3.5 text-[#63e6e2]" /> 1 transit /64</span><span className="data-chip"><TerminalSquare className="h-3.5 w-3.5 text-[#63e6e2]" /> 7 checks</span></div></div></div><div className="rounded-xl border border-[#63e6e2]/20 bg-[#0d171e]/80 p-5"><div className="instrument-label text-[#63e6e2]">ADDRESSING PLAN</div><div className="mt-4 space-y-3 font-mono text-xs"><div className="flex items-center justify-between border-b border-white/10 pb-3"><span className="text-[#74838b]">R1 transit</span><span className="text-[#dce5e5]">2001:db8:12:12::1/64</span></div><div className="flex items-center justify-between border-b border-white/10 pb-3"><span className="text-[#74838b]">R2 transit</span><span className="text-[#dce5e5]">2001:db8:12:12::2/64</span></div><div className="flex items-center justify-between border-b border-white/10 pb-3"><span className="text-[#74838b]">R1 loopback</span><span className="text-[#dce5e5]">2001:db8:1::1/64</span></div><div className="flex items-center justify-between"><span className="text-[#74838b]">R2 loopback</span><span className="text-[#dce5e5]">2001:db8:2::1/64</span></div></div></div></div>}

            <div className="grid gap-6 xl:grid-cols-[.86fr_1.14fr]">
              <div className="space-y-6">
                <section className="panel-surface overflow-hidden"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><div className="instrument-label">TOPOLOGY / LIVE TRACE</div><div className="mt-1 text-sm text-[#aab8bd]">Current route under construction</div></div><span className="status-pill"><span className="status-dot" /> {completed.length ? "SIGNAL ACTIVE" : "STANDBY"}</span></div><div className="relative min-h-[246px] overflow-hidden px-6 py-9"><div className="absolute left-[20%] right-[20%] top-[48%] h-px bg-[#34505a]" /><div className={`packet-line ${completed.length > 0 ? "packet-line-active" : ""}`} /><div className="topology-node left-[12%] top-[32%]"><span className="node-label">R1</span><span className="node-sub">2001:db8:1::/64</span></div><div className="topology-node right-[12%] top-[32%]"><span className="node-label">R2</span><span className="node-sub">2001:db8:2::/64</span></div><div className="absolute left-1/2 top-[51%] -translate-x-1/2 font-mono text-[10px] tracking-widest text-[#63e6e2]">2001:DB8:12:12::/64</div><div className="absolute bottom-5 left-6 right-6 flex justify-between font-mono text-[10px] uppercase tracking-wider text-[#64747d]"><span>g0/0 · fe80::1</span><span>g0/0 · fe80::2</span></div></div></section>
                <section className="panel-surface"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><div className="instrument-label">CURRENT OBJECTIVE</div><div className="mt-1 font-display text-lg font-semibold text-white">{step.title}</div></div><span className="rounded-md bg-[#f5b74b]/10 px-2 py-1 font-mono text-[10px] text-[#f5b74b]">{step.device === "BOTH" ? "R1 + R2" : step.device}</span></div><div className="p-5"><p className="text-sm leading-6 text-[#b7c2c5]">{step.description}</p><div className="mt-5 flex gap-2"><Button className="bg-[#63e6e2] text-[#071014] hover:bg-[#83efec]" onClick={() => setHintVisible((v) => !v)}><CircleHelp className="mr-2 h-4 w-4" /> {hintVisible ? "Hide hint" : "Need a nudge?"}</Button>{hintVisible && <div className="flex-1 rounded-lg border border-[#f5b74b]/20 bg-[#f5b74b]/10 px-3 py-2 text-xs leading-5 text-[#f5d58b]">{step.hint}</div>}</div></div></section>
              </div>

              <section className="terminal-shell"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#111b24] px-5 py-3"><div className="flex items-center gap-2"><div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#f07178]" /><span className="h-2.5 w-2.5 rounded-full bg-[#f5b74b]" /><span className="h-2.5 w-2.5 rounded-full bg-[#63e6e2]" /></div><span className="ml-2 font-mono text-[10px] uppercase tracking-[.18em] text-[#74848d]">ios-sim / console</span></div><div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#0b1118] p-1"><button onClick={() => switchDevice("R1")} className={`rounded px-3 py-1 font-mono text-[11px] transition ${device === "R1" ? "bg-[#173038] text-[#63e6e2]" : "text-[#70818a] hover:text-white"}`}>R1</button><button onClick={() => switchDevice("R2")} className={`rounded px-3 py-1 font-mono text-[11px] transition ${device === "R2" ? "bg-[#173038] text-[#63e6e2]" : "text-[#70818a] hover:text-white"}`}>R2</button></div></div><div className="terminal-output" aria-live="polite"><div className="mb-4 text-[#72848d]">Cisco IOS Software, IPv6 Lab Simulator<br />Press Enter to submit a command. Tab completion is intentionally simplified.</div>{history.map((line, index) => <div key={`${line}-${index}`} className={`${line.startsWith("%") ? "text-[#f07178]" : line.startsWith("✓") ? "text-[#f5b74b]" : line.startsWith("R") ? "text-[#c8d4d7]" : "text-[#85959d]"}`}>{line}</div>)}<div className="mt-3 flex items-center gap-2"><span className="text-[#63e6e2]">{prompt}</span><input autoFocus value={command} onChange={(e) => setCommand(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitCommand()} className="min-w-0 flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-[#42535c]" placeholder="type a command..." aria-label="Cisco CLI command" /></div></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#0e1720] px-5 py-3"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[#667780]"><span className="h-1.5 w-1.5 rounded-full bg-[#63e6e2]" /> session ready</div><div className="flex gap-2"><Button variant="outline" size="sm" className="border-white/15 bg-transparent text-[#94a4aa] hover:bg-white/10 hover:text-white" onClick={() => { navigator.clipboard?.writeText(step.expected[0]); toast("Suggested command copied"); }}><Copy className="mr-2 h-3.5 w-3.5" /> Copy hint</Button><Button size="sm" className="bg-[#f5b74b] text-[#1c160b] hover:bg-[#ffca69]" onClick={() => submitCommand(step.expected[0])}><Play className="mr-2 h-3.5 w-3.5" /> Run suggested</Button></div></div></section>
            </div>

            <div className="mt-6 flex flex-col justify-between gap-3 border-t border-white/10 pt-5 text-xs text-[#687780] sm:flex-row"><span>Isolated training environment · Documentation prefixes only</span><a href="https://www.cisco.com/c/en/us/td/docs/ios/ipv6/configuration/guide/ipv6-xe-16-book-cat8000/m_ip6-addrg-bsc-con.html" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#8ba8aa] hover:text-[#63e6e2]">Cisco IPv6 reference <ExternalLink className="h-3 w-3" /></a></div>
          </div>
        </section>
      </div>
    </main>
  );
}
