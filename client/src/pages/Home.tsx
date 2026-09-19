import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import NetworkSandbox from "@/components/NetworkSandbox";
import OperationsSandbox from "@/components/OperationsSandbox";
import TrafficDataPanel from "@/components/TrafficDataPanel";
import GuidedPacketTrace, { getGuidedTraceProfile } from "@/components/GuidedPacketTrace";
import TrancheVerificationPanel from "@/components/TrancheVerificationPanel";
import ResizeGrabBar from "@/components/ResizeGrabBar";
import { toast } from "sonner";
import { applyCommand, boot, isCiscoCommand, modePrompt, normalizeCommand, type Mode, type Session } from "@/lib/ios-engine";
import { Check, ChevronDown, ChevronUp, CircleHelp, Copy, Database, History, Minimize2, Network, Play, RotateCcw, TerminalSquare, Wrench } from "lucide-react";
import { LAB_REGISTRY, type LabConfig } from "@/labs/labDefinitions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** 
 * Packet Observatory: Dynamic Engine Version
 * This version reads from the LAB_REGISTRY in labDefinitions.ts
 */

function initialSessions(lab: LabConfig): Record<string, Session> {
  return Object.fromEntries(lab.topology.devices.map((device: any) => [device.name || device.id, boot(device.name || device.id, device.role)]));
}

type LabMenuEntry = { title: string; placeholder?: boolean };

type TrancheMenuProps = {
  name: string;
  labs: Array<[string, LabMenuEntry]>;
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


type MasterTrancheMenuProps = Omit<TrancheMenuProps, "name" | "labs"> & {
  name: string;
  tranches: Array<{ name: string; labs: Array<[string, LabMenuEntry]> }>;
};

function MasterTrancheMenu({ name, tranches, selectedLabId, onSelectLab }: MasterTrancheMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex shrink-0 items-center gap-2 rounded-lg border border-[#f5b74b]/45 bg-[#2a2112] px-3 py-2 text-left text-white transition hover:border-[#f5b74b]/75 hover:bg-[#3a2a16]">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#f4d998]">{name}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#f4d998]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 border-[#5a4522] bg-[#101923] p-2 text-[#edf4f3]">
        <div className="px-2 pb-2 pt-1"><div className="font-mono text-[10px] uppercase tracking-[.16em] text-[#f4d998]">{name}</div><div className="mt-1 text-[11px] text-[#778a92]">Choose a tranche to access its guided labs.</div></div>
        {tranches.map(({ name, labs }) => (
          <DropdownMenuSub key={name}>
            <DropdownMenuSubTrigger className="px-2.5 py-2.5 text-[#d7e4e4] focus:bg-[#2a2112] focus:text-white"><span className="font-mono text-[10px] uppercase tracking-wider text-[#f4d998]">{name}</span></DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-80 border-[#29424a] bg-[#101923] p-2 text-[#edf4f3]">
              <div className="px-2 pb-2 pt-1"><div className="font-mono text-[10px] uppercase tracking-[.16em] text-[#63e6e2]">{name}</div><div className="mt-1 text-[11px] text-[#778a92]">Select a guided lab path.</div></div>
              {labs.length > 0 ? labs.map(([id, item]) => <DropdownMenuItem key={id} onSelect={() => !item.placeholder && onSelectLab(id)} disabled={item.placeholder} className={`cursor-pointer gap-3 px-2.5 py-2.5 ${item.placeholder ? "text-[#667780]" : selectedLabId === id ? "bg-[#173038] text-white focus:bg-[#1b4148]" : "text-[#9aabb1] focus:bg-white/[.06] focus:text-white"}`}><span className="w-28 shrink-0 font-mono text-[10px] text-[#63e6e2]">{id.toUpperCase()}</span><span className="min-w-0 flex-1 truncate text-xs">{item.title}</span>{id === selectedLabId && <span className="rounded bg-[#f5b74b]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#f5b74b]">ACTIVE</span>}</DropdownMenuItem>) : <div className="px-2.5 py-3 text-xs text-[#778a92]">No labs assigned yet.</div>}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Home() {
  // State now uses the lab ID (string) from the registry
  const [selectedLabId, setSelectedLabId] = useState("lab-1");
  const [sandboxOpen, setSandboxOpen] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "sandbox");
  const [operationsOpen, setOperationsOpen] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "operations");
  const [trafficDataOpen, setTrafficDataOpen] = useState(false);
  
  // Derive the current lab config from the registry
  const lab = LAB_REGISTRY[selectedLabId] || LAB_REGISTRY["lab-1"];
  
  const [stepIndex, setStepIndex] = useState(0);
  const [sessions, setSessions] = useState<Record<string, Session>>(() => initialSessions(lab));
  const [activeDevice, setActiveDevice] = useState(lab.topology.devices[0]?.name || lab.topology.devices[0]?.id);
  const [input, setInput] = useState("");
  const [hint, setHint] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [traceRun, setTraceRun] = useState(0);
  const [labHeaderOpen, setLabHeaderOpen] = useState(true);
  const [commandHistoryOpen, setCommandHistoryOpen] = useState(false);
  const [commandHistory, setCommandHistory] = useState<Record<string, string[]>>({});
  const [terminalHeight, setTerminalHeight] = useState(380);
  const [verificationHeight, setVerificationHeight] = useState(320);
  const [terminalMinimized, setTerminalMinimized] = useState(false);
  const [verificationMinimized, setVerificationMinimized] = useState(false);

  const step = lab.steps[Math.min(stepIndex, lab.steps.length - 1)];
  const session = sessions[activeDevice];
  const prompt = session ? modePrompt(activeDevice, session) : "";
  const complete = stepIndex >= lab.steps.length;
  const percent = Math.round((stepIndex / lab.steps.length) * 100);
  const guidedTrace = useMemo(() => getGuidedTraceProfile(selectedLabId, lab.topology.devices.map((device: any) => device.name || device.id)), [selectedLabId, lab]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [selectedLabId, sandboxOpen, operationsOpen]);

  function selectLab(id: string) {
    setSelectedLabId(id); 
    const nextLab = LAB_REGISTRY[id] || LAB_REGISTRY["lab-1"];
    setStepIndex(0); 
    setSessions(initialSessions(nextLab)); 
    setActiveDevice(nextLab.topology.devices[0]?.name || nextLab.topology.devices[0]?.id); 
    setInput(""); 
    setHint(false);
    setTraceRun(0);
    setLabHeaderOpen(true);
    setCommandHistoryOpen(false);
    setCommandHistory({});
    setTerminalHeight(380);
    setVerificationHeight(320);
    setTerminalMinimized(false);
    setVerificationMinimized(false);
  }

  function reset() { 
    setStepIndex(0); 
    setSessions(initialSessions(lab)); 
    setActiveDevice(lab.topology.devices[0]?.name || lab.topology.devices[0]?.id); 
    setInput(""); 
    setHint(false); 
    setTraceRun(0);
    setCommandHistoryOpen(false);
    setCommandHistory({});
    setTerminalHeight(380);
    setVerificationHeight(320);
    setTerminalMinimized(false);
    setVerificationMinimized(false);
    toast("Lab reset", { description: `${lab.title} is ready at the first IOS prompt.` }); 
  }

  function beginResize(event: React.PointerEvent<HTMLDivElement>, setter: React.Dispatch<React.SetStateAction<number>>, startHeight: number, min: number, max: number) {
    event.preventDefault();
    const startY = event.clientY;
    const move = (moveEvent: PointerEvent) => setter(Math.min(max, Math.max(min, startHeight + moveEvent.clientY - startY)));
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  }

  function adjustHeight(setter: React.Dispatch<React.SetStateAction<number>>, current: number, amount: number, min: number, max: number) {
    setter(Math.min(max, Math.max(min, current + amount)));
  }

  function handleResizeKey(event: React.KeyboardEvent<HTMLDivElement>, setter: React.Dispatch<React.SetStateAction<number>>, current: number, min: number, max: number) {
    const amount = event.key === "ArrowUp" ? -24 : event.key === "ArrowDown" ? 24 : event.key === "Home" ? min - current : event.key === "End" ? max - current : 0;
    if (!amount) return;
    event.preventDefault();
    adjustHeight(setter, current, amount, min, max);
  }

  function submit(value = input) {
    const raw = value.trim();
    if (!raw) return;
    if (!session) return;

    const current = sessions[activeDevice];
    const visiblePrompt = modePrompt(activeDevice, current);
    const updatedHistory = [...current.history, `${visiblePrompt} ${raw}`];
    setCommandHistory((all) => ({ ...all, [activeDevice]: [...(all[activeDevice] || []), `${visiblePrompt} ${raw}`] }));
    
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
      setSessions((all) => ({ ...all, [activeDevice]: { ...current, history: [...updatedHistory, `% Invalid input detected at '^' marker. Hint: ${reason}`] } }));
      setInput(""); 
      return;
    }

    const nextSession = applyCommand(current, raw, [...updatedHistory, step.successMessage]);
    
    setSessions((all) => ({ ...all, [activeDevice]: nextSession }));
    setStepIndex((index) => index + 1); 
    if (lab.type === "guided" && !["enable", "configure terminal", "exit", "end"].includes(normalized)) setTraceRun((run) => run + 1);
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

  const recent = session ? session.history.slice(-3) : [];
  const activeCommandHistory = commandHistory[activeDevice] || [];
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
          {["One", "Two", "Three", "Four", "Five"].map((masterName) => (
            <MasterTrancheMenu
              key={masterName}
              name={`Master Tranche ${masterName}`}
              tranches={[1, 2, 3, 4, 5].map((tranche) => ({
                name: `Tranche ${["One", "Two", "Three", "Four", "Five"][tranche - 1]}`,
                labs: masterName === "One"
                  ? labsForTranche(tranche as 1 | 2 | 3 | 4 | 5)
                  : [[`master-${masterName.toLowerCase()}-${tranche}-placeholder`, { title: "Placeholder Lab", placeholder: true }]],
              }))}
              selectedLabId={selectedLabId}
              onSelectLab={selectLab}
            />
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex shrink-0 items-center gap-2 rounded-lg border border-[#63e6e2]/35 bg-[#173038] px-3 py-2 text-left text-white transition hover:border-[#63e6e2]/65 hover:bg-[#1b4148]"><Database className="h-3.5 w-3.5 text-[#63e6e2]" /><span className="font-mono text-[10px] uppercase tracking-wider text-[#63e6e2]">Data</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#63e6e2]" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 border-[#29424a] bg-[#101923] p-2 text-[#edf4f3]">
              <div className="px-2 pb-2 pt-1"><div className="font-mono text-[10px] uppercase tracking-[.16em] text-[#63e6e2]">Data</div><div className="mt-1 text-[11px] text-[#778a92]">Inspect reusable modeled network data.</div></div>
              <DropdownMenuItem onSelect={() => setTrafficDataOpen(true)} className="cursor-pointer gap-3 px-2.5 py-3 text-[#9aabb1] focus:bg-[#173038] focus:text-white"><Database className="h-4 w-4 text-[#63e6e2]" /><span className="text-xs">Internet Traffic Data</span></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            <div className="mb-6 rounded-xl border border-white/10 bg-[#0d151e]/80 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="instrument-label text-[#f5b74b]">{selectedLabId.toUpperCase()} · {lab.title}</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="border-white/15 bg-[#101923]/70 text-[#aab8bd] hover:bg-white/10 hover:text-white" onClick={reset}>
                    <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset
                  </Button>
                  <Button variant="outline" size="sm" aria-expanded={labHeaderOpen} aria-controls="guided-lab-header" className="border-[#63e6e2]/25 bg-[#101923]/70 font-mono text-[10px] uppercase tracking-wider text-[#b9eeee] hover:bg-[#173038] hover:text-white" onClick={() => setLabHeaderOpen((open) => !open)}>
                    {labHeaderOpen ? "Collapse header" : "Expand header"}
                    {labHeaderOpen ? <ChevronUp className="ml-2 h-3.5 w-3.5" /> : <ChevronDown className="ml-2 h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              {labHeaderOpen && <div id="guided-lab-header" className="mt-3">
                <h1 className="max-w-3xl font-display text-3xl font-semibold tracking-[-.03em] text-white md:text-5xl">{lab.title}<br /><span className="text-[#63e6e2]">Practice the signal.</span></h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#b4c1c5]">{lab.description}</p>
              </div>}
            </div>

            <div className="mb-6 grid gap-3 xl:grid-cols-[1.05fr_.95fr]">
              <div className="panel-surface p-4">
                <div className="instrument-label text-[#f5b74b]">PACKET TRACE / OPERATIONAL CONTEXT</div>
                <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0e1720] p-3 font-mono text-center text-xs">
                  {lab.topology.devices.map((device: any, index: number) => (
                    <div key={device.id || index} className="flex min-w-0 flex-1 items-center gap-2">
                      <button type="button" onClick={() => { setActiveDevice(device.name || device.id); setInput(""); setHint(false); }} className={`min-w-0 flex-1 rounded-lg border px-2 py-3 transition hover:border-[#63e6e2]/60 hover:bg-[#173038] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63e6e2] ${activeDevice === (device.name || device.id) ? "border-[#63e6e2]/40 bg-[#173038]" : "border-white/10 bg-[#111c27]"}`}>
                        <div className="truncate text-[#63e6e2]">{device.name || device.id}</div>
                      </button>
                      {index < lab.topology.devices.length - 1 && <div className="h-px w-5 shrink-0 bg-[#385159]" />}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-[#77858d]">
                  <span className="h-px flex-1 bg-gradient-to-r from-[#63e6e2] to-transparent" />
                  <span className="mx-4">{lab.topology.devices.map((d: any) => d.name || d.id).join(" ⇄ ")}</span>
                  <span className="h-px flex-1 bg-gradient-to-l from-[#63e6e2] to-transparent" />
                </div>
                {lab.type === "guided" && <GuidedPacketTrace profile={guidedTrace} run={traceRun} leftLabel={lab.topology.devices[0]?.name || "SOURCE"} rightLabel={lab.topology.devices[lab.topology.devices.length - 1]?.name || "DESTINATION"} />}
              </div>

              <div className="panel-surface p-4">
                <div className="flex items-center justify-between">
                  <div className="instrument-label text-[#63e6e2]">CURRENT PACKET TRACE</div>
                  <span className="status-pill"><span className="status-dot" /> {complete ? "COMPLETE" : `${stepIndex + 1}/${lab.steps.length}`}</span>
                </div>

                {!allDone ? (
                  <>
                    {/* THE "HOW" - The exact command to type */}
                    <div className="mt-3">
                      <div className="text-[10px] font-mono uppercase text-[#84969d] mb-1">Command to enter:</div>
                      <div className="font-mono text-lg font-bold text-[#63e6e2] bg-black/40 p-3 rounded border border-[#63e6e2]/20">
                        {step.expectedCommand}
                      </div>
                    </div>

                    {/* The "What" */}
                    <div className="mt-3 font-display text-xl font-semibold text-white">{step.label}</div>

                    {/* The "Why" (Instructional Description) */}
                    <p className="mt-2 text-sm leading-6 text-[#aebbc0]">{step.description}</p>

                    {/* Context */}
                    <div className="mt-3 rounded-lg border border-[#f5b74b]/20 bg-[#f5b74b]/10 p-3">
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

            <div className="terminal-shell" style={{ minHeight: 0 }}>
              <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#111b24] px-5 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#f07178]" /><span className="h-2.5 w-2.5 rounded-full bg-[#f5b74b]" /><span className="h-2.5 w-2.5 rounded-full bg-[#63e6e2]" />
                  </div>
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[.18em] text-[#74848d]">ios-sim / {activeDevice}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-[#667780]">{prompt}</div>
                  <button type="button" aria-expanded={commandHistoryOpen} onClick={() => setCommandHistoryOpen((open) => !open)} className="flex items-center gap-1.5 rounded border border-[#63e6e2]/25 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-[#b9eeee] transition hover:border-[#63e6e2]/60 hover:bg-[#173038]">
                    <History className="h-3.5 w-3.5" /> Command History
                  </button>
                  <button type="button" aria-expanded={!terminalMinimized} aria-controls="tranche-ios-sim-body" onClick={() => setTerminalMinimized((minimized) => !minimized)} className="flex items-center gap-1.5 rounded border border-[#f5b74b]/25 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-[#f4d998] transition hover:border-[#f5b74b]/60 hover:bg-[#2a2112]"><Minimize2 className="h-3.5 w-3.5" /> {terminalMinimized ? "Restore CLI" : "Minimize CLI"}</button>
                </div>
                {commandHistoryOpen && <div className="absolute right-4 top-full z-30 mt-2 max-h-80 w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-[#63e6e2]/30 bg-[#101923] p-3 shadow-2xl">
                  <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-mono text-[10px] uppercase tracking-[.16em] text-[#63e6e2]">Command History · {activeDevice}</span>
                    <span className="font-mono text-[10px] text-[#778a92]">{activeCommandHistory.length}</span>
                  </div>
                  {activeCommandHistory.length ? activeCommandHistory.map((command, index) => <div key={`${command}-${index}`} className="flex gap-3 border-b border-white/[.06] py-1.5 font-mono text-[10px] text-[#b5c2c6]"><span className="w-5 shrink-0 text-right text-[#667780]">{index + 1}</span><span>{command}</span></div>) : <div className="py-3 text-xs text-[#778a92]">No commands entered on this device yet.</div>}
                </div>}
              </div>
              {!terminalMinimized && <div id="tranche-ios-sim-body" className="terminal-output overflow-y-auto" style={{ height: terminalHeight, minHeight: 0 }} aria-live="polite">
                {recent.map((line, index) => (
                  <div key={`${line}-${index}`} className={`${line.startsWith("%") ? "text-[#f07178]" : line.startsWith("Hint:") ? "text-[#f5b74b]" : line.startsWith("Cisco") || line.includes("·") || line.startsWith("Full IOS") ? "text-[#72848d]" : line.startsWith("✓") || line.includes("applied") || line.includes("enabled") || line.includes("entered") || line.includes("configured") || line.includes("visible") || line.includes("Success") ? "text-[#b5d8d4]" : "text-[#a4b2b7]"}`}>{line || "\u00a0"}</div>
                ))}
                {!complete && (
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-[#63e6e2]">{prompt}</span>
                    <input autoFocus value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} className="min-w-0 flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-[#42535c]" placeholder="type the full Cisco IOS command..." aria-label="Cisco IOS command" />
                  </div>
                )}
              </div>}
              {!terminalMinimized && <div className="border-t border-white/10 bg-[#0e1720] px-5 py-3">
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
              </div>}
            </div>

            {!terminalMinimized && <ResizeGrabBar
              label="Resize IOS simulator"
              value={terminalHeight}
              min={220}
              max={760}
              onPointerDown={(event) => beginResize(event, setTerminalHeight, terminalHeight, 220, 760)}
              onKeyDown={(event) => handleResizeKey(event, setTerminalHeight, terminalHeight, 220, 760)}
            />}

            <TrancheVerificationPanel
              session={session}
              deviceName={activeDevice}
              height={verificationHeight}
              minimized={verificationMinimized}
              onToggleMinimized={() => setVerificationMinimized((minimized) => !minimized)}
              onResizeStart={(event) => beginResize(event, setVerificationHeight, verificationHeight, 220, 760)}
              onResizeKeyDown={(event) => handleResizeKey(event, setVerificationHeight, verificationHeight, 220, 760)}
            />

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
      {trafficDataOpen && <TrafficDataPanel onClose={() => setTrafficDataOpen(false)} />}
    </main>
  );
}
