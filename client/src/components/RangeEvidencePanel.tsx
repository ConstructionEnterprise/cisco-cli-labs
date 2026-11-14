import type { AttackTerminalState, RangePhase } from '../lib/ios-engine';
import { simulatedTargetById } from '../lib/simulated-target-range';

const phases: RangePhase[] = ['validation', 'probe', 'enumeration'];

export default function RangeEvidencePanel({ targetId, terminal }: { targetId: string; terminal?: AttackTerminalState }) {
  const target = simulatedTargetById[targetId];
  const evidence = (terminal?.rangeEvidence || []).filter(item => item.targetId === targetId);
  const current = terminal?.rangePhase?.[targetId];
  return <section className="mt-3 rounded-xl border border-[#63e6e2]/25 bg-[#08161c] p-3" aria-label="Captured terminal evidence">
    <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[.15em] text-[#63e6e2]">
      <span>Captured terminal evidence / {target?.name || targetId}</span>
      <span>{evidence.length}/3 phases</span>
    </div>
    <div className="mt-3 grid grid-cols-3 gap-1.5">
      {phases.map((phase, index) => <div key={phase} className={`rounded border px-2 py-1.5 font-mono text-[10px] uppercase ${current && phases.indexOf(current) >= index ? 'border-[#63e6e2]/50 bg-[#173038] text-[#b9eeee]' : 'border-white/10 text-[#6f8289]'}`}>{index + 1}. {phase}</div>)}
    </div>
    {evidence.length ? <div className="mt-3 max-h-60 space-y-2 overflow-y-auto" aria-live="polite">
      {evidence.map((item, index) => <div key={`${item.command}-${index}`} className="rounded border border-white/10 bg-[#0c1118] p-2 font-mono text-[10px] leading-4">
        <div className="text-[#f5b74b]">{item.phase.toUpperCase()} / {item.command}</div>
        <pre className="mt-1 whitespace-pre-wrap break-all text-[#aebfc3]">{item.output.join('\n')}</pre>
      </div>)}
    </div> : <p className="mt-3 text-xs text-[#8499a0]">Run the scoped Linux command. Valid results appear here exactly as returned to the terminal.</p>}
    {current === 'enumeration' && <p className="mt-3 border-t border-white/10 pt-2 text-xs text-[#f5b74b]">Review the captured results before drawing a conclusion. This panel reflects terminal output, not a live packet capture.</p>}
  </section>;
}
