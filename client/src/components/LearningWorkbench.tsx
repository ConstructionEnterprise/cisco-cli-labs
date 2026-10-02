import { useMemo, useState } from 'react';
import type { LabConfig } from '../labs/labDefinitions';
import { configurationDiff, gradeLab, readStored, validateLab, writeStored, seedSessions, recordAttempt, type LearningMode, type Sessions, type SkillRecord } from '../lib/learning-engine';
import { diagnosePath, protocolEvidence } from '../lib/operational-evidence';
import { tracePacket } from '../lib/sandbox-network-engine';

type Checkpoint = { id: string; name: string; at: string; sessions: Sessions; step: number; topology: LabConfig['topology'] };
type Props = { lab: LabConfig; sessions: Sessions; step: number; mode: LearningMode; onMode: (mode: LearningMode) => void; onRestore: (sessions: Sessions, step: number, topology: LabConfig['topology']) => void; onSelect?: (id: string) => void; catalog: Record<string, LabConfig> };
const control = 'rounded border border-[#63e6e2]/30 bg-[#101f29] px-3 py-2 text-xs text-[#b9eeee]';

export default function LearningWorkbench({ lab, sessions, step, mode, onMode, onRestore, catalog, onSelect }: Props) {
  const [tab, setTab] = useState('Outcomes');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState('');
  const [from, setFrom] = useState(lab.topology.devices[0]?.id || '');
  const [to, setTo] = useState(lab.topology.devices.at(-1)?.id || '');
  const [vlan, setVlan] = useState(1);
  const [destinationIp, setDestinationIp] = useState('');
  const [probe, setProbe] = useState<ReturnType<typeof diagnosePath> | null>(null);
  const [draft, setDraft] = useState(() => readStored<string>(`observatory:author:${lab.id}`, JSON.stringify(lab, null, 2)));
  const [draftReport, setDraftReport] = useState<string[]>([]);
  const grade = useMemo(() => gradeLab(lab, sessions), [lab, sessions]);
  const protocols = useMemo(() => protocolEvidence(lab, sessions), [lab, sessions]);
  const checkpointKey = `observatory:checkpoints:${lab.id}`;
  const checkpoints = useMemo(() => readStored<Checkpoint[]>(checkpointKey, []), [checkpointKey, revision]);
  const records = useMemo(() => readStored<SkillRecord[]>('observatory:skills', []), [revision]);
  const chosen = checkpoints.find(point => point.id === selected);
  const differences = chosen ? configurationDiff(chosen.sessions, sessions) : [];
  const stats = readStored<{ hints: number; errors: number }>(`observatory:attempt:${lab.id}`, { hints: 0, errors: 0 });
  function persist(key: string, value: unknown) {
    try { writeStored(key, value); setRevision(r => r + 1); return true; }
    catch { setMessage('Browser storage is full or unavailable. Export your work before clearing anything.'); return false; }
  }
  function assess() {
    const record: SkillRecord = { labId: lab.id, mode, score: grade.percent, ...stats, at: new Date().toISOString() };
    if (persist('observatory:skills', [...records, record].slice(-500))) setMessage(grade.results.length ? `Assessment recorded: ${grade.percent}% of ${grade.results.length} state requirements. ${stats.hints} hints, ${stats.errors} rejected commands.` : 'This lab has no modeled configuration outcomes yet; command completion is not an assessment score.');
  }
  function inspectDraft(download = false) {
    try {
      const parsed = JSON.parse(draft);
      if (!parsed.id || !parsed.title || !Array.isArray(parsed.topology?.devices) || !Array.isArray(parsed.topology?.links) || !Array.isArray(parsed.steps)) throw new Error('Provide id, title, topology.devices, topology.links and steps.');
      if (parsed.topology.devices.some((d: any) => !d.id || !d.name || !Array.isArray(d.ports))) throw new Error('Each device needs id, name, and ports.');
      if (parsed.steps.some((s: any) => typeof s.expectedCommand !== 'string' || typeof s.targetDevice !== 'string')) throw new Error('Every step needs a command and target device.');
      const findings = validateLab(parsed);
      setDraftReport(findings.length ? findings.map(f => `${f.severity}: ${f.message}`) : ['Validation passed. Topology and command walkthrough are consistent.']);
      if (download && !findings.some(f => f.severity === 'error')) {
        const url = URL.createObjectURL(new Blob([draft], { type: 'application/json' }));
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'lab-definition.json'; anchor.click(); URL.revokeObjectURL(url);
      }
    } catch (error) { setDraftReport([String(error)]); }
  }
  const recommended = Object.values(catalog).filter(l => l.type === 'guided' && l.status !== 'planned').map(l => {
    const history = records.filter(r => r.labId === l.id);
    const latest = history.at(-1);
    return { lab: l, latest, priority: latest ? 100 - latest.score + latest.errors * 3 + latest.hints * 2 : 20 };
  }).sort((a, b) => b.priority - a.priority).slice(0, 6);
  return <details className="my-4 rounded-xl border border-[#29424a] bg-[#0e1922] text-[#c4d3d5]">
    <summary className="cursor-pointer px-4 py-3 font-mono text-xs text-[#63e6e2]">Learning workspace / {mode} / {grade.percent}% {lab.steps.some(item => item.exercise) ? 'lesson and configuration evidence' : 'configuration evidence'}</summary>
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2"><label htmlFor={`mode-${lab.id}`} className="text-xs">Practice mode</label><select id={`mode-${lab.id}`} className={control} value={mode} onChange={e => { if (mode === 'guided') recordAttempt(lab.id, 'hints'); onMode(e.target.value as LearningMode); setTab('Outcomes'); setMessage('Mode changed. Existing hint and error counts are retained for this attempt.'); }}><option value="guided">Guided: full walkthrough</option><option value="assisted">Help if asked: objectives and hints</option><option value="assessment">Assessment: requirements only</option></select><button className={control} onClick={assess}>Assess progress</button><button className={control} onClick={() => {
        const backup: Checkpoint = { id: crypto.randomUUID(), name: 'Before fresh assessment', at: new Date().toISOString(), sessions: structuredClone(sessions), step, topology: structuredClone(lab.topology) };
        if (!persist(checkpointKey, [...checkpoints, backup].slice(-12))) return;
        if (!persist(`observatory:attempt:${lab.id}`, { hints: 0, errors: 0 })) return;
        const seeded = seedSessions(lab);
        const restored = Object.fromEntries(lab.topology.devices.map(device => [sessions[device.id] ? device.id : device.name, seeded[device.name]]));
        onRestore(restored, 0, structuredClone(lab.topology)); onMode('assessment'); setTab('Outcomes'); setMessage('Fresh assessment started. Previous work is saved as a checkpoint.');
      }}>Start fresh assessment</button></div>
      <p role="status" className="text-xs text-[#f4d998]">{message}</p>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Learning tools">{['Outcomes', 'Diagnostics', 'Protocols', 'Checkpoints', 'Skills', ...(mode === 'assessment' ? [] : ['Author'])].map(t => <button role="tab" aria-selected={t === tab} key={t} className={control} onClick={() => setTab(t)}>{t}</button>)}</div>
      <div role="tabpanel" className="max-h-[420px] overflow-auto space-y-3 text-xs">
        {tab === 'Outcomes' && <><p>{lab.description}</p><p>{lab.steps.some(item => item.exercise) ? 'Lesson checks record correctly answered worksheets and the final device configuration. Progress and answers are saved in checkpoints.' : 'Configuration checks cover modeled interface, VLAN, OSPF, DHCP, DNS and redundancy fields. Other features still require command evidence.'}</p>{grade.results.length ? grade.results.map((r, i) => <div key={i} className={r.passed ? 'text-[#63e6e2]' : 'text-[#f4d998]'}>{r.passed ? 'PASS' : 'PENDING'}: {r.label}{<span> | required {JSON.stringify(r.value)} | observed {JSON.stringify(r.actual) ?? 'unset'}</span>}</div>) : <p>No state requirements defined for this exercise.</p>}</>}
        {tab === 'Diagnostics' && <><p>Trace Layer 2 forwarding prerequisites. This check does not imply routing, firewall or application reachability.</p><div className="flex flex-wrap gap-2">{[['Source', from, setFrom], ['Destination', to, setTo]].map(([label, value, setter]) => <label key={String(label)}>{String(label)}<select className={control} value={String(value)} onChange={e => (setter as (v: string) => void)(e.target.value)}>{lab.topology.devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>)}<label>VLAN <input className={control} type="number" min={1} max={4094} value={vlan} onChange={e => setVlan(Number(e.target.value))} /></label><button className={control} onClick={() => setProbe(diagnosePath(lab, sessions, from, to, vlan))}>Trace path</button><input aria-label="Diagnostic IPv4 destination" className={control} placeholder="Destination IPv4" value={destinationIp} onChange={e => setDestinationIp(e.target.value)} /><button className={control} onClick={() => {
          const byId = Object.fromEntries(lab.topology.devices.map(device => [device.id, sessions[device.id] || sessions[device.name]]));
          setProbe(tracePacket(from, destinationIp, { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links }, byId));
        }}>Check IPv4 packet</button></div>{probe && <><p>{probe.summary}</p>{probe.hops.map((hop, i) => <p key={i}>{i + 1}. {hop}</p>)}</>}</>}
        {tab === 'Protocols' && <><p>Current modeled protocol evidence. OSPF checks interface, subnet, area, passive status, router ID and stub compatibility. LACP checks enabled members and negotiation modes. Full SPF, STP convergence timers and real packet timing are not simulated.</p>{protocols.map((row, i) => <div key={i} className="border-b border-white/10 pb-2"><b>{row.protocol}: {row.state}</b><p>{row.link}</p><p>{row.reason}</p></div>)}{!protocols.length && <p>No configured protocol relationships yet.</p>}</>}
        {tab === 'Checkpoints' && <><div className="flex flex-wrap gap-2"><input aria-label="Checkpoint name" className={control} placeholder="Before firewall changes" value={name} onChange={e => setName(e.target.value)} maxLength={80}/><button className={control} onClick={() => { const point: Checkpoint = { id: crypto.randomUUID(), name: name.trim() || `Checkpoint ${checkpoints.length + 1}`, at: new Date().toISOString(), sessions: structuredClone(sessions), step, topology: structuredClone(lab.topology) }; if (persist(checkpointKey, [...checkpoints, point].slice(-12))) { setSelected(point.id); setMessage('Checkpoint saved with topology, configuration and progress.'); } }}>Save checkpoint</button><select aria-label="Saved checkpoint" className={control} value={selected} onChange={e => setSelected(e.target.value)}><option value="">Choose checkpoint</option>{checkpoints.map(point => <option key={point.id} value={point.id}>{point.name} / {point.at}</option>)}</select><button disabled={!chosen} className={control} onClick={() => { if (!chosen) return; const undo: Checkpoint = { id: crypto.randomUUID(), name: 'Before restore (automatic)', at: new Date().toISOString(), sessions: structuredClone(sessions), step, topology: structuredClone(lab.topology) }; if (persist(checkpointKey, [...checkpoints, undo].slice(-12))) { recordAttempt(lab.id, 'hints'); onRestore(structuredClone(chosen.sessions), chosen.step, structuredClone(chosen.topology)); setMessage('Restored. Your previous state is saved as an automatic checkpoint.'); } }}>Restore checkpoint</button></div>{chosen && <><p>{differences.length} changes since {chosen.name}</p>{differences.map((diff, i) => <pre className="whitespace-pre-wrap break-all" key={i}>{diff}</pre>)}</>}</>}
        {tab === 'Skills' && <><p>Recommendations use your most recent assessment, rejected commands, and hints. Independent mastery requires a fresh assessment, all modeled outcomes, and no assistance. Guided commands, revealed hints and restored checkpoints count as assistance.</p>{recommended.map(({ lab: next, latest }) => <div key={next.id}><button className={control} disabled={!onSelect} onClick={() => onSelect?.(next.id)}>{next.title}</button><p>{latest ? `${latest.score}% / ${latest.mode} / ${latest.hints} hints / ${latest.errors} errors` : 'Not assessed yet'}</p></div>)}{records.slice(-15).reverse().map((record, i) => <p key={i}>{catalog[record.labId]?.title || record.labId}: {record.score}% ({record.mode}), {record.hints} hints, {record.errors} errors</p>)}</>}
        {tab === 'Author' && mode !== 'assessment' && <><p>Edit devices, ports, links, seed commands, objectives and state outcomes. Validate the full walkthrough before exporting your definition. Existing curriculum is unaffected until a definition is integrated.</p><textarea aria-label="Lab definition JSON" className="w-full min-h-64 rounded bg-[#071117] p-3 font-mono text-xs" value={draft} onChange={e => setDraft(e.target.value)} spellCheck={false}/><div className="flex gap-2"><button className={control} onClick={() => { if (persist(`observatory:author:${lab.id}`, draft)) setMessage('Draft saved locally; the curriculum has not been changed.'); }}>Save draft</button><button className={control} onClick={() => inspectDraft()}>Validate walkthrough</button><button className={control} onClick={() => inspectDraft(true)}>Export validated lab</button></div>{draftReport.map((line, i) => <p key={i}>{line}</p>)}</>}
      </div>
    </div>
  </details>;
}
