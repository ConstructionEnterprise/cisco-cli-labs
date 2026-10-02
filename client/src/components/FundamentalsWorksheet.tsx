import React, { useState } from 'react';
import type { LabStep } from '../labs/labDefinitions';
import { answerMatches } from '../lib/addressing-fundamentals';
import { recordAttempt, type LearningMode } from '../lib/learning-engine';

export default function FundamentalsWorksheet({ step, labId, mode, onComplete }: { step: LabStep; labId: string; mode: LearningMode; onComplete: () => void }) {
  const exercise = step.exercise!;
  const [answers, setAnswers] = useState<string[]>(exercise.fields.map(() => ''));
  const [checked, setChecked] = useState(false);
  const [hint, setHint] = useState(false);
  const results = exercise.fields.map((field, index) => answerMatches(field, answers[index]));
  const passed = checked && results.every(Boolean);
  const showHelp = mode === 'guided' || (mode === 'assisted' && hint);
  return <section className="panel-surface my-4 p-5" aria-label="Addressing worksheet">
    <div className="instrument-label text-[#63e6e2]">{exercise.section} / worksheet</div>
    <h2 className="mt-2 font-display text-2xl text-white">{step.label}</h2>
    <p className="mt-2 text-sm text-[#b4c1c5]">{exercise.fields.some(field => field.choices) ? 'Match the definition to the correct term. Select one answer; no IOS command is needed.' : 'Enter the answers below. This is a calculation or recognition exercise; no IOS command is needed for this step.'}</p>
    {showHelp && <div className="my-5 rounded-xl border border-[#63e6e2]/30 bg-[#10252b] p-4">
      <h3 className="font-mono text-sm text-[#63e6e2]">Full walkthrough</h3>
      <p className="mt-2 text-sm leading-6 text-[#c4d3d5]">{exercise.explanation}</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-[#c4d3d5]">{exercise.worked.map((line, i) => <li key={i}>{line}</li>)}</ol>
      <div className="mt-4 border-t border-white/10 pt-3 text-sm text-[#f4d998]">{exercise.takeaway}</div>
      {exercise.source && <a href={exercise.source} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-[#63e6e2] underline">Standards reference</a>}
    </div>}
    {mode === 'assisted' && <button className="my-3 rounded border border-[#63e6e2]/30 px-3 py-2 text-sm text-[#63e6e2]" onClick={() => { if (!hint) recordAttempt(labId, 'hints'); setHint(!hint); }}>{hint ? 'Hide walkthrough' : 'Need a nudge? Show walkthrough'}</button>}
    <form className="mt-4 space-y-4" onSubmit={event => { event.preventDefault(); setChecked(true); if (!results.every(Boolean)) recordAttempt(labId, 'errors'); else if (mode === 'guided') recordAttempt(labId, 'hints'); }}>
      <div className="grid gap-4 md:grid-cols-2">{exercise.fields.map((field, index) => field.choices ? <fieldset key={index} className="min-w-0 md:col-span-2">
        <legend className="mb-3 text-base leading-7 text-[#c4d3d5]">{field.label}</legend>
        <div className="grid gap-3 md:grid-cols-2">{field.choices.map(choice => <label key={choice.label} className={`cursor-pointer rounded-xl border p-4 text-sm transition focus-within:ring-2 focus-within:ring-[#63e6e2] ${answers[index] === choice.label ? 'border-[#63e6e2] bg-[#173038] text-white' : 'border-[#29424a] bg-[#071017] text-[#c4d3d5]'}`}>
          <input type="radio" name={`vocabulary-${step.id}-${index}`} value={choice.label} checked={answers[index] === choice.label} onChange={() => { setAnswers(current => current.map((value, i) => i === index ? choice.label : value)); setChecked(false); }} className="mr-3 accent-[#63e6e2]" />{choice.label}
          {checked && showHelp && <span className="mt-3 block leading-6">{choice.label === field.answer ? 'Correct match: ' : 'Different concept: '}{choice.explanation}</span>}
        </label>)}</div>
      </fieldset> : <label key={index} className="block min-w-0 text-sm text-[#c4d3d5]">
        {field.label}
        <input aria-label={field.label} aria-invalid={checked && !results[index]} autoComplete="off" spellCheck={false} value={answers[index]} onChange={event => { setAnswers(current => current.map((value, i) => i === index ? event.target.value : value)); setChecked(false); }} className="mt-2 w-full rounded-lg border border-[#29424a] bg-[#071017] px-3 py-3 font-mono text-sm text-white focus:border-[#63e6e2] focus:outline-none" />
        {checked && <span className={`mt-1 block text-xs ${results[index] ? 'text-[#63e6e2]' : 'text-[#f5b74b]'}`}>{results[index] ? 'Correct' : showHelp ? `Review the walkthrough. Expected: ${field.answer}` : 'Not yet correct. Review this answer.'}</span>}
      </label>)}</div>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="rounded-lg bg-[#f5b74b] px-4 py-2 text-sm font-semibold text-[#17150f]">Check answers</button>
        {passed && <button type="button" onClick={onComplete} className="rounded-lg border border-[#63e6e2] bg-[#173038] px-4 py-2 text-sm text-[#63e6e2]">Record answers and continue</button>}
      </div>
      <p role="status" className="text-sm text-[#b4c1c5]">{passed ? 'All answers are correct. Continue when you are ready.' : checked ? 'Check the highlighted answers and try again.' : 'Assistance stays at the level you selected in Learning Workspace.'}</p>
    </form>
  </section>;
}
