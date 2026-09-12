import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import NetworkSandbox from "@/components/NetworkSandbox";
import OperationsSandbox from "@/components/OperationsSandbox";
import { toast } from "sonner";
import { applyCommand, boot, isCiscoCommand, modePrompt, normalizeCommand, type Mode, type Session } from "@/lib/ios-engine";
import { Check, ChevronDown, CircleHelp, Copy, Network, Play, RotateCcw, TerminalSquare, Wrench } from "lucide-react";
import { LAB_REGISTRY, type LabConfig } from "@/labs/labDefinitions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** 
 * Packet Observatory: Dynamic Engine Version
 * This version reads from the LAB_REGISTRY in labDefinitions.ts
 */

function initialSessions(lab: LabConfig): Record<string, Session> {
  return Object.fromEntries(lab.topology.devices.map((device: any) => [device.name || device.id, boot(device.name || device.id, device.role)]));
}

type TrancheMenuProps = {
  name: string;
  labs: Array<[string, LabConfig]>;
  selectedLabId: string;
  onSelectLab: (id: string) => void;
};

function TrancheMenu({ name, labs, selectedLabId, onSelectLab }: TrancheMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex shrink-0 items-center gap-2 rounded-lg border border-[#63e6e2]/35 bg-[#173038] px-3 py-2 text-left text-white transition hover:border-[#63e6e2]/65 hover:bg-[#1b4148]">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#63e6e2]">{name}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#63e6e2]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 border-[#29424a] bg-[#101923] p-2 text-[#edf4f3]">
        <div className="px-2 pb-2 pt-1">
          <div className="font-mono text-[10px] uppercase tracking-[.16em] text-[#63e6e2]">{name}</div>
          <div className="mt-1 text-[11px] text-[#778a92]">Select a guided lab path.</div>
        </div>
        {labs.length > 0 ? labs.map(([id, item]) => (
          <DropdownMenuItem
            key={id}
            onSelect={() => onSelectLab(id)}
            className={`cursor-pointer gap-3 px-2.5 py-2.5 ${selectedLabId === id ? "bg-[#173038] text-white focus:bg-[#1b4148]" : "text-[#9aabb1] focus:bg-white/[.06] focus:text-white"}`}
          >
            <span className="w-28 shrink-0 font-mono text-[10px] text-[#63e6e2]">{id.toUpperCase()}</span>
            <span className="min-w-0 flex-1 truncate text-xs">{item.title}</span>
            {id === selectedLabId && <span className="rounded bg-[#f5b74b]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#f5b74b]">ACTIVE</span>}
          </DropdownMenuItem>
        )) : (
          <div className="px-2.5 py-3 text-xs text-[#778a92]">No labs assigned yet.</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Home() {
  // State now uses the lab ID (string) from the registry
  const [selectedLabId, setSelectedLabId] = useState("lab-1");
  const [sandboxOpen, setSandboxOpen] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "sandbox");
  const [operationsOpen, setOperationsOpen] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "operations");
  
  // Derive the current lab config from the registry
  const lab = LAB_REGISTRY[selectedLabId] || LAB_REGISTRY["lab-1"];
  
  const [stepIndex, setStepIndex] = useState(0);
  const [sessions, setSessions] = useState<Record<string, Session>>(() => initialSessions(lab));
  const [activeDevice, setActiveDevice] = useState(lab.topology.devices[0]?.name || lab.topology.devices[0]?.id);
  const [input, setInput] = useState("");
  const [hint, setHint] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);

  const step = lab.steps[Math.min(stepIndex, lab.steps.length - 1)];
  const session = sessions[activeDevice];
  const prompt = session ? modePrompt(activeDevice, session) : "";
  const complete = stepIndex >= lab.steps.length;
  const percent = Math.round((stepIndex / lab.steps.length) * 100);

  function selectLab(id: string) {
    setSelectedLabId(id); 
    const nextLab = LAB_REGISTRY[id] || LAB_REGISTRY["lab-1"];
    setStepIndex(0); 
    setSessions(initialSessions(nextLab)); 
    setActiveDevice(nextLab.topology.devices[0]?.name || nextLab.topology.devices[0]?.id); 
    setInput(""); 
    setHint(false);
  }

  function reset() { 
    setStepIndex(0); 
    setSessions(initialSessions(lab)); 
    setActiveDevice(lab.topology.devices[0]?.name || lab.topology.devices[0]?.id); 
    setInput(""); 
    setHint(false); 
    toast("Lab reset", { description: `${lab.title} is ready at the first IOS prompt.` }); 
  }

  function submit(value = input) {
    const raw = value.trim();
    if (!raw) return;
    if (!session) return;

    const current = sessions[activeDevice];
    const visiblePrompt = modePrompt(activeDevice, current);
    const updatedHistory = [...current.history, `${visiblePrompt} ${raw}`];
    
    const expectedDevice = step.targetDevice;
    const expectedMode = step.requiredMode;
    const normalized = normalizeCommand(raw);

    if (complete) {
      setSessions((all) => ({ ...all, [activeDevice]: { ...current, history: [...updatedHistory, "Lab complete. Reset to run this sequence again."] } })); 
      setInput(""); 
      return;
    }

    if (activeDevice !== expectedDevice || current.mode !== expectedMode || !isCiscoCommand(normalized, current.mode) || normalized !== normalizeCommand(step.expectedCommand)) {
      const reason = activeDevice !== expectedDevice ? `Switch to ${expectedDevice}.` : current.mode !== expectedMode ? `Use the ${expectedMode === "user" ? "user EXEC" : expectedMode === "privileged" ? "privileged EXEC" : expectedMode} prompt.` : !isCiscoCommand(normalized, current.mode) ? `That command is not valid in Cisco IOS ${current.mode} mode.` : `Expected the full command: ${step.expectedCommand}`;
      setSessions((all) => ({ ...all, [activeDevice]: { ...current, history: [...updatedHistory, "% Invalid input detected at '^' marker.", `Hint: ${reason}`] } })); 
      setInput(""); 
      return;
    }

    const nextSession = applyCommand(current, raw, [...updatedHistory, step.successMessage]);
    
    setSessions((all) => ({ ...all, [activeDevice]: nextSession }));
    setStepIndex((index) => index + 1); 
    setInput(""); 
    setHint(false);
  }

  function runSuggested() {
    if (complete) return;
    if (activeDevice !== step.targetDevice) { 
      setPendingCommand(step.expectedCommand); 
      setActiveDevice(step.targetDevice); 
      setInput(""); 
      setHint(false); 
      return; 
    }
    if (session?.mode !== step.requiredMode) { 
      setInput(step.requiredMode === "privileged" ? "enable" : step.requiredMode === "config" ? "configure terminal" : step.requiredMode === "user" ? "" : "exit"); 
      setHint(true); 
      return; 
    }
    submit(step.expectedCommand);
  }

  const recent = session ? session.history.slice(-12) : [];
  const allDone = useMemo(() => complete, [complete]);
  const labsForTranche = (tranche: 1 | 2 | 3 | 4 | 5) => Object.entries(LAB_REGISTRY).filter(([id, item]) => id !== "blank" && (item.tranche ?? 1) === tranche);

  useEffect(() => {
    if (pendingCommand && activeDevice === step.targetDevice) {
      const command = pendingCommand;
      setPendingCommand(null);
      submit(command);
    }
  }, [activeDevice, pendingCommand, step.targetDevice]);

  if (operationsOpen) return <OperationsSandbox onExit={() => setOperationsOpen(false)} />;
  if (sandboxOpen) return <NetworkSandbox onExit={() => setSandboxOpen(false)} labId={selectedLabId} />;

  return (
    <main className="min-h-screen overflow-hidden bg-[#0b1118] text-[#f2f5f5]">
      <header className="border-b border-white/10 bg-[#0b1118]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#63e6e2]/40 bg-[#10252b]">
              <img src="/manus-storage/ipv6-trace-mark_f814341b.png" alt="Cisco CLI Labs mark" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[.22em] text-[#63e6e2]">IPv6 CLI Lab</div>
              <div className="font-display text-lg font-semibold tracking-tight">Packet Observatory</div>
            </div>
          </div>
          <div className="hidden items-center gap-3 text-xs text-[#98a8b0] sm:flex">
            <span>CONSTRUCTION ENTERPRISES</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#63e6e2] shadow-[0_0_10px_#63e6e2]" />
            <span className="font-mono">CISCO IOS TRAINING CONSOLE</span>
          </div>
        </div>
      </header>

      <nav className="border-b border-white/10 bg-[#0d151e] px-5 py-3 lg:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center gap-2 overflow-x-auto pb-1">
          <span className="mr-2 shrink-0 font-mono text-[10px] uppercase tracking-[.16em] text-[#667780]">Curriculum</span>
          <button type="button" onClick={() => { setOperationsOpen(true); setSandboxOpen(false); }} className="flex shrink-0 items-center gap-2 rounded-lg border border-[#63e6e2]/35 bg-[#173038] px-3 py-2 text-left text-[#b9eeee] transition hover:border-[#63e6e2]/70 hover:bg-[#1b4148]">
            <Wrench className="h-3.5 w-3.5" /><span className="font-mono text-[10px] uppercase tracking-wider">Operations Sandbox</span>
          </button>
          <button type="button" onClick={() => setSandboxOpen(true)} className="flex shrink-0 items-center gap-2 rounded-lg border border-[#f5b74b]/40 bg-[#2a2112] px-3 py-2 text-left text-[#f4d998] transition hover:border-[#f5b74b]/70 hover:bg-[#3a2a16]">
            <Network className="h-3.5 w-3.5" /><span className="font-mono text-[10px] uppercase tracking-wider">Network Sandbox</span>
          </button>
          <TrancheMenu name="Tranche One" labs={labsForTranche(1)} selectedLabId={selectedLabId} onSelectLab={selectLab} />
          <TrancheMenu name="Tranche Two" labs={labsForTranche(2)} selectedLabId={selectedLabId} onSelectLab={selectLab} />
          <TrancheMenu name="Tranche Three" labs={labsForTranche(3)} selectedLabId={selectedLabId} onSelectLab={selectLab} />
          <TrancheMenu name="Tranche Four" labs={labsForTranche(4)} selectedLabId={selectedLabId} onSelectLab={selectLab} />
          <TrancheMenu name="Tranche Five" labs={labsForTranche(5)} selectedLabId={selectedLabId} onSelectLab={selectLab} />
        </div>
      </nav>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[270px_1fr]">
        <aside className="border-b border-white/10 bg-[#0d151e] p-5 lg:min-h-[calc(100vh-121px)] lg:border-b-0 lg:border-r">
          <div className="mb-7 flex items-center justify-between">
            <div>
              <div className="instrument-label">LAB PATH</div>
              <div className="mt-1 text-sm text-[#9eacb2]">{lab.title}</div>
            </div>
            <TerminalSquare className="h-4 w-4 text-[#f5b74b]" />
          </div>
          <div className="mb-6 rounded-xl border border-white/10 bg-[#111c27] p-4">
            <div className="text-xs font-semibold text-white">{lab.title}</div>
            <p className="mt-2 text-xs leading-5 text-[#8fa0a7]">{lab.description}</p>
            <div className="mt-4 font-mono text-[10px] uppercase tracking-wider text-[#63e6e2]">{lab.topology.devices.map((d: any) => d.name || d.id).join(" ⇄ ")}</div>
          </div>
          <nav className="max-h-[calc(100vh-28rem)] space-y-1.5 overflow-y-auto pr-1" aria-label="Lab command path">
            {lab.steps.map((item, index) => { 
              const done = index < stepIndex; 
              const current = index === stepIndex && !complete; 
              return (
                <button 
                  key={`${item.expectedCommand}-${index}`} 
                  onClick={() => { setActiveDevice(item.targetDevice); if (index <= stepIndex) setStepIndex(index); }} 
                  className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${current ? "bg-[#173038] text-white shadow-[inset_3px_0_0_#63e6e2]" : "text-[#82919a] hover:bg-white/[.04] hover:text-white"}`}
                >
                  <span className="w-5 font-mono text-[10px] text-[#667780]">{String(index + 1).padStart(2, "0")}</span>
                  {done ? <Check className="h-3.5 w-3.5 text-[#63e6e2]" /> : <span className="h-3.5 w-3.5 rounded-full border border-[#53646d]" />}
                  <span className="min-w-0 flex-1 truncate text-xs">{item.label}</span>
                </button>
              ); 
            })}
            {lab.steps.length > 16 && <div className="px-3 py-2 font-mono text-[10px] text-[#667780]">+ {lab.steps.length - 16} more IOS commands below</div>}
          </nav>
          <div className="mt-7 border-t border-white/10 pt-5">
            <div className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-wider text-[#77858d]">
              <span>Progress</span><span className="text-[#63e6e2]">{percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#63e6e2] transition-all duration-300" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[#6d7b83]">Type the command. Read the prompt. Trust the evidence.</p>
          </div>
        </aside>

        <section className="relative min-w-0">
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "url('/manus-storage/packet-observatory-texture_96a51270.jpg')", backgroundSize: "cover", backgroundPosition: "top right" }} />
          <div className="relative mx-auto max-w-[1240px] px-5 py-7 lg:px-10 lg:py-9">
            <div className="mb-6 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <div className="instrument-label text-[#f5b74b]">{selectedLabId.toUpperCase()} · {lab.title}</div>
                <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold tracking-[-.03em] text-white md:text-5xl">{lab.title}<br /><span className="text-[#63e6e2]">Practice the signal.</span></h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#b4c1c5]">{lab.description}</p>
              </div>
              <Button variant="outline" className="border-white/15 bg-[#101923]/70 text-[#aab8bd] hover:bg-white/10 hover:text-white" onClick={reset}>
                <RotateCcw className="mr-2 h-4 w-4" /> Reset {selectedLabId.toUpperCase()}
              </Button>
            </div>

            <div className="mb-7 grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
              <div className="panel-surface p-5">
                <div className="instrument-label text-[#f5b74b]">PACKET TRACE / OPERATIONAL CONTEXT</div>
                <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0e1720] p-4 font-mono text-center text-xs">
                  {lab.topology.devices.map((device: any, index: number) => (
                    <div key={device.id || index} className="flex min-w-0 flex-1 items-center gap-2">
                      <button type="button" onClick={() => { setActiveDevice(device.name || device.id); setInput(""); setHint(false); }} className={`min-w-0 flex-1 rounded-lg border px-2 py-3 transition hover:border-[#63e6e2]/60 hover:bg-[#173038] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63e6e2] ${activeDevice === (device.name || device.id) ? "border-[#63e6e2]/40 bg-[#173038]" : "border-white/10 bg-[#111c27]"}`}>
                        <div className="truncate text-[#63e6e2]">{device.name || device.id}</div>
                      </button>
                      {index < lab.topology.devices.length - 1 && <div className="h-px w-5 shrink-0 bg-[#385159]" />}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-[#77858d]">
                  <span className="h-px flex-1 bg-gradient-to-r from-[#63e6e2] to-transparent" />
                  <span className="mx-4">{lab.topology.devices.map((d: any) => d.name || d.id).join(" ⇄ ")}</span>
                  <span className="h-px flex-1 bg-gradient-to-l from-[#63e6e2] to-transparent" />
                </div>
              </div>

              <div className="panel-surface p-5">
                <div className="flex items-center justify-between">
                  <div className="instrument-label text-[#63e6e2]">CURRENT PACKET TRACE</div>
                  <span className="status-pill"><span className="status-dot" /> {complete ? "COMPLETE" : `${stepIndex + 1}/${lab.steps.length}`}</span>
                </div>

                {!allDone ? (
                  <>
                    {/* THE "HOW" - The exact command to type */}
                    <div className="mt-4">
                      <div className="text-[10px] font-mono uppercase text-[#84969d] mb-1">Command to enter:</div>
                      <div className="font-mono text-lg font-bold text-[#63e6e2] bg-black/40 p-3 rounded border border-[#63e6e2]/20">
                        {step.expectedCommand}
                      </div>
                    </div>

                    {/* The "What" */}
                    <div className="mt-4 font-display text-xl font-semibold text-white">{step.label}</div>

                    {/* The "Why" (Instructional Description) */}
                    <p className="mt-2 text-sm leading-6 text-[#aebbc0]">{step.description}</p>

                    {/* Context */}
                    <div className="mt-4 rounded-lg border border-[#f5b74b]/20 bg-[#f5b74b]/10 p-3">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-[#f5b74b]">Required context</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#f4d998]">
                        <span>{step.targetDevice}</span><span>·</span><span>{step.requiredMode}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-3 font-display text-xl font-semibold text-white">Evidence accepted.</div>
                    <p className="mt-2 text-sm leading-6 text-[#aebbc0]">You completed the full IOS command path for this lab.</p>
                  </>
                )}
              </div>
            </div>

            <div className="terminal-shell">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#111b24] px-5 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#f07178]" /><span className="h-2.5 w-2.5 rounded-full bg-[#f5b74b]" /><span className="h-2.5 w-2.5 rounded-full bg-[#63e6e2]" />
                  </div>
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[.18em] text-[#74848d]">ios-sim / {activeDevice}</span>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-[#667780]">{prompt}</div>
              </div>
              <div className="terminal-output min-h-[380px]" aria-live="polite">
                {recent.map((line, index) => (
                  <div key={`${line}-${index}`} className={`${line.startsWith("%") ? "text-[#f07178]" : line.startsWith("Hint:") ? "text-[#f5b74b]" : line.startsWith("Cisco") || line.includes("·") || line.startsWith("Full IOS") ? "text-[#72848d]" : line.startsWith("✓") || line.includes("applied") || line.includes("enabled") || line.includes("entered") || line.includes("configured") || line.includes("visible") || line.includes("Success") ? "text-[#b5d8d4]" : "text-[#a4b2b7]"}`}>{line || "\u00a0"}</div>
                ))}
                {!complete && (
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-[#63e6e2]">{prompt}</span>
                    <input autoFocus value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} className="min-w-0 flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-[#42535c]" placeholder="type the full Cisco IOS command..." aria-label="Cisco IOS command" />
                  </div>
                )}
              </div>
              <div className="border-t border-white/10 bg-[#0e1720] px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="border-white/15 bg-transparent text-[#94a4aa] hover:bg-white/10 hover:text-white" onClick={() => setHint((value) => !value)}>
                      <CircleHelp className="mr-2 h-3.5 w-3.5" /> {hint ? "Hide hint" : "Need a nudge?"}
                    </Button>
                    <Button variant="outline" size="sm" className="border-white/15 bg-transparent text-[#94a4aa] hover:bg-white/10 hover:text-white" onClick={() => { navigator.clipboard?.writeText(step.expectedCommand); toast("Exact command copied"); }}>
                      <Copy className="mr-2 h-3.5 w-3.5" /> Copy command
                    </Button>
                  </div>
                  <Button size="sm" className="bg-[#f5b74b] text-[#1c160b] hover:bg-[#ffca69]" onClick={runSuggested}>
                    <Play className="mr-2 h-3.5 w-3.5" /> Run suggested
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="panel-surface p-4">
                <div className="instrument-label">ACTIVE DEVICE</div>
                <div className="mt-2 font-mono text-sm text-[#63e6e2]">{activeDevice}</div>
              </div>
              <div className="panel-surface p-4">
                <div className="instrument-label">IOS PROMPT</div>
                <div className="mt-2 font-mono text-sm text-[#f5b74b]">{prompt}</div>
              </div>
              <div className="panel-surface p-4">
                <div className="instrument-label">LAB STANDARD</div>
                <div className="mt-2 text-sm text-[#dce5e5]">Full IOS vocabulary</div>
              </div>
            </div>
          </div>
        </section>
      </div>
      <footer className="mx-auto max-w-[1500px] border-t border-white/10 px-5 py-5 font-mono text-[10px] uppercase tracking-wider text-[#687780] lg:px-10">Construction Enterprises · Factory to Foundation · Browser-based IOS training simulator · Documentation addresses only</footer>
    </main>
  );
}
