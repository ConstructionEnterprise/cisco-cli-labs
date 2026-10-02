import { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpenCheck, RotateCcw } from 'lucide-react';
import { networkingVocabularyCards } from '@/labs/vocabularyCards';
import { recordAttempt, type LearningMode } from '@/lib/learning-engine';

const cards = networkingVocabularyCards();

const modeLabels: Record<LearningMode, string> = {
  guided: 'Guided',
  assisted: 'Help if asked',
  assessment: 'Assessment',
};

export default function NetworkingVocabulary({ mode, onMode, onExit }: { mode: LearningMode; onMode: (mode: LearningMode) => void; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [correctCards, setCorrectCards] = useState<Set<string>>(() => new Set());
  const card = cards[index];
  const correct = answer === card.term;
  const showHelp = mode === 'guided' || (mode === 'assisted' && hintOpen);
  const progress = Math.round((correctCards.size / cards.length) * 100);

  const moveTo = (nextIndex: number) => {
    setIndex(Math.max(0, Math.min(cards.length - 1, nextIndex)));
    setAnswer('');
    setChecked(false);
    setHintOpen(false);
  };

  const checkAnswer = () => {
    setChecked(true);
    if (correct) {
      setCorrectCards((current) => new Set(current).add(card.id));
      if (mode === 'guided') recordAttempt('networking-vocabulary', 'hints');
    } else {
      recordAttempt('networking-vocabulary', 'errors');
    }
  };

  const restart = () => {
    setIndex(0);
    setAnswer('');
    setChecked(false);
    setHintOpen(false);
    setCorrectCards(new Set());
  };

  return <main className="min-h-screen bg-[#071017] text-[#edf4f3]">
    <header className="border-b border-white/10 bg-[#0b131b] px-5 py-4 lg:px-8">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onExit} className="inline-flex items-center gap-2 rounded-lg border border-[#29424a] bg-[#101923] px-3 py-2 font-mono text-xs text-[#b9eeee] transition hover:border-[#63e6e2]/70 hover:bg-[#173038]">
          <ArrowLeft className="h-4 w-4" /> Return to curriculum
        </button>
        <div className="flex items-center gap-2" aria-label="Learning workspace mode">
          {(Object.keys(modeLabels) as LearningMode[]).map((choice) => <button key={choice} type="button" onClick={() => onMode(choice)} className={`rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-wider transition ${mode === choice ? 'border-[#63e6e2] bg-[#173038] text-[#63e6e2]' : 'border-[#29424a] bg-[#101923] text-[#8ea0a7] hover:text-white'}`}>{modeLabels[choice]}</button>)}
        </div>
      </div>
    </header>
    <section className="mx-auto max-w-[1000px] px-5 py-10 lg:px-8">
      <div className="rounded-2xl border border-[#63e6e2]/25 bg-[radial-gradient(circle_at_top_right,_rgba(99,230,226,.14),_transparent_38%),#101923] p-6 shadow-2xl shadow-black/20 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.2em] text-[#63e6e2]"><BookOpenCheck className="h-4 w-4" /> Complete Review Deck</div>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">Networking Vocabulary</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#b4c1c5]">Review every vocabulary card authored for the curriculum in one focused quiz path. Your assistance setting applies here exactly as it does in guided labs.</p>
          </div>
          <button type="button" onClick={restart} className="inline-flex items-center gap-2 rounded-lg border border-[#f5b74b]/45 bg-[#2a2112] px-3 py-2 font-mono text-xs text-[#f4d998] transition hover:bg-[#3a2a16]"><RotateCcw className="h-3.5 w-3.5" /> Restart</button>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
          <span className="font-mono text-xs text-[#63e6e2]">CARD {index + 1} / {cards.length}</span>
          <div className="h-2 overflow-hidden rounded-full bg-[#071017]" aria-label={`${progress}% mastered`}><div className="h-full rounded-full bg-[#63e6e2] transition-all duration-300" style={{ width: `${progress}%` }} /></div>
          <span className="font-mono text-xs text-[#b4c1c5]">{correctCards.size} MASTERED</span>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-[#29424a] bg-[#101923] p-5 sm:p-8" aria-label="Networking vocabulary question">
        <div className="font-mono text-[10px] uppercase tracking-[.16em] text-[#8ea0a7]">Definition matching / all curriculum vocabulary</div>
        <h2 className="mt-4 text-2xl font-semibold text-white">Which term matches this definition?</h2>
        <p className="mt-3 text-lg leading-8 text-[#c4d3d5]">{card.definition}</p>
        {showHelp && <div className="mt-6 rounded-xl border border-[#63e6e2]/30 bg-[#10252b] p-4 text-sm leading-6 text-[#c4d3d5]"><div className="font-mono text-xs uppercase tracking-wider text-[#63e6e2]">Full walkthrough</div><p className="mt-2">Identify the idea described by the definition, then compare it with each alternative's purpose. The correct term is <strong className="text-white">{card.term}</strong>.</p></div>}
        {mode === 'assisted' && <button type="button" onClick={() => { if (!hintOpen) recordAttempt('networking-vocabulary', 'hints'); setHintOpen((open) => !open); }} className="mt-5 rounded-lg border border-[#63e6e2]/35 px-3 py-2 text-sm text-[#63e6e2] transition hover:bg-[#173038]">{hintOpen ? 'Hide walkthrough' : 'Need a nudge? Show walkthrough'}</button>}
        <fieldset className="mt-6">
          <legend className="sr-only">Vocabulary choices</legend>
          <div className="grid gap-3 md:grid-cols-2">{card.choices.map((choice) => <label key={choice.label} className={`cursor-pointer rounded-xl border p-4 text-sm transition focus-within:ring-2 focus-within:ring-[#63e6e2] ${answer === choice.label ? 'border-[#63e6e2] bg-[#173038] text-white' : 'border-[#29424a] bg-[#071017] text-[#c4d3d5] hover:border-[#63e6e2]/45'}`}><input type="radio" name={card.id} value={choice.label} checked={answer === choice.label} onChange={() => { setAnswer(choice.label); setChecked(false); }} className="mr-3 accent-[#63e6e2]" />{choice.label}{checked && showHelp && <span className="mt-3 block text-xs leading-5 text-[#b4c1c5]">{choice.label === card.term ? 'Correct: ' : 'Different concept: '}{choice.explanation}</span>}</label>)}</div>
        </fieldset>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button type="button" onClick={checkAnswer} disabled={!answer} className="rounded-lg bg-[#f5b74b] px-4 py-2.5 text-sm font-semibold text-[#17150f] transition hover:bg-[#ffc55b] disabled:cursor-not-allowed disabled:opacity-45">Check answer</button>
          {checked && correct && <button type="button" onClick={() => moveTo(index + 1)} disabled={index === cards.length - 1} className="inline-flex items-center gap-2 rounded-lg border border-[#63e6e2] bg-[#173038] px-4 py-2.5 text-sm text-[#63e6e2] transition hover:bg-[#1b4148] disabled:opacity-45">Next card <ArrowRight className="h-4 w-4" /></button>}
          {index > 0 && <button type="button" onClick={() => moveTo(index - 1)} className="rounded-lg border border-[#29424a] px-4 py-2.5 text-sm text-[#b4c1c5] transition hover:border-[#63e6e2]/45 hover:text-white">Previous</button>}
        </div>
        <p role="status" className={`mt-4 text-sm ${checked && correct ? 'text-[#63e6e2]' : checked ? 'text-[#f5b74b]' : 'text-[#8ea0a7]'}`}>{checked ? correct ? index === cards.length - 1 ? 'Correct. You completed the final card in this review deck.' : 'Correct. Continue when you are ready.' : showHelp ? `Not yet. The correct term is ${card.term}; compare the walkthrough with your choice.` : 'Not yet correct. Try again or enable assistance in Learning Workspace.' : 'Choose the term that best matches the definition.'}</p>
      </section>
    </section>
  </main>;
}
