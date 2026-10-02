import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerMatches, expandedIpv6, subnetFacts } from './addressing-fundamentals';
import { fundamentalsLabs } from '../labs/fundamentalsLabs';
import { LAB_REGISTRY } from '../labs/labDefinitions';
import { gradeLab, replayLab, seedSessions, validateLab } from './learning-engine';
import { MASTER_ONE_CURRICULUM, applyMasterOneCurriculum, compareCurriculumOrder } from '../labs/masterOneCurriculum';
import { SANDBOX_TEMPLATES } from '../labs/labDefinitions';
import { VOCABULARY_GROUPS, addVocabularyCards } from '../labs/vocabularyCards';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FundamentalsWorksheet from '../components/FundamentalsWorksheet';

test('vocabulary is distributed across every Master One lab in tranches 1-4, never tranche 5', () => {
  const terms = Object.values(VOCABULARY_GROUPS).flatMap(group => group.split('\n').map(line => line.split('|')[0]));
  assert.equal(terms.length, 160);
  assert.equal(new Set(terms).size, 160);
  for (const lab of Object.values(LAB_REGISTRY).filter(lab => lab.type === 'guided')) {
    const cards = lab.steps.filter(step => step.exercise?.section === 'Vocabulary match');
    const eligible = (lab.masterTranche ?? 1) === 1 && (lab.tranche ?? 1) <= 4;
    assert.equal(cards.length > 0, eligible, lab.id);
    if (!eligible) continue;
    assert.ok(VOCABULARY_GROUPS[lab.id]);
    assert.equal(new Set(lab.steps.map(step => step.id)).size, lab.steps.length);
    lab.steps.forEach((step, index) => {
      if (step.exercise?.section !== 'Vocabulary match') return;
      assert.notEqual(lab.steps[index + 1]?.exercise?.section, 'Vocabulary match', 'cards must not form a quiz block');
      const field = step.exercise.fields[0];
      assert.equal(field.choices?.length, 4);
      assert.equal(new Set(field.choices?.map(choice => choice.label)).size, 4);
      assert.equal(field.choices?.filter(choice => choice.label === field.answer).length, 1);
      assert.ok(field.choices?.every(choice => choice.explanation.length > 15));
      assert.ok(!step.label.includes(field.answer), 'step label must not reveal the answer');
    });
    const final = replayLab(lab);
    assert.deepEqual(final.findings, []);
    assert.equal(gradeLab(lab, final.sessions).passed, true);
    delete final.sessions[cards[0].targetDevice].lessonAnswers?.[cards[0].id];
    assert.equal(gradeLab(lab, final.sessions).passed, false);
    assert.deepEqual(LAB_REGISTRY[`sandbox-${lab.id}`].steps, lab.steps);
  }
  const before = Object.fromEntries(Object.entries(LAB_REGISTRY).map(([id, lab]) => [id, lab.steps.length]));
  addVocabularyCards(LAB_REGISTRY);
  assert.deepEqual(Object.fromEntries(Object.entries(LAB_REGISTRY).map(([id, lab]) => [id, lab.steps.length])), before);
});

test('multiple-choice cards render accessible radio choices and honor the learning mode', () => {
  const lab = LAB_REGISTRY['vlan-basics'];
  const step = lab.steps.find(step => step.exercise?.section === 'Vocabulary match')!;
  for (const mode of ['guided', 'assisted', 'assessment'] as const) {
    const html = renderToStaticMarkup(createElement(FundamentalsWorksheet, { labId: lab.id, step, mode, onComplete: () => {} }));
    assert.equal((html.match(/type="radio"/g) || []).length, 4);
    assert.ok(html.includes('<fieldset'));
    assert.equal(html.includes('Full walkthrough'), mode === 'guided');
    assert.equal(html.includes('Need a nudge?'), mode === 'assisted');
  }
});

test('Master One progression preserves every existing lab and aligns sandbox placement', () => {
  const expectedIds = MASTER_ONE_CURRICULUM.flatMap(group => [...group.labs]);
  const existing = Object.values(LAB_REGISTRY).filter(lab => lab.type === 'guided' && (lab.masterTranche ?? 1) === 1 && (lab.tranche ?? 1) !== 1);
  assert.equal(new Set(expectedIds).size, 22);
  assert.deepEqual(existing.map(lab => lab.id).sort(), [...expectedIds].sort());
  for (const group of MASTER_ONE_CURRICULUM) {
    const actual = existing.filter(lab => lab.tranche === group.tranche).sort(compareCurriculumOrder);
    assert.deepEqual(actual.map(lab => lab.id), [...group.labs]);
    for (const lab of actual) {
      const sandbox = LAB_REGISTRY[`sandbox-${lab.id}`];
      assert.equal(sandbox.tranche, lab.tranche);
      assert.equal(sandbox.curriculumOrder, lab.curriculumOrder);
      assert.deepEqual(sandbox.steps, lab.steps);
      assert.equal(SANDBOX_TEMPLATES[sandbox.id].curriculumOrder, lab.curriculumOrder);
    }
  }
  assert.equal(LAB_REGISTRY['sandbox-access-segmentation'].tranche, 3);
  assert.equal(LAB_REGISTRY['sandbox-ospfv2-multiplatform'].tranche, 4);
});

test('curriculum placement changes metadata only and leaves other master tranches untouched', () => {
  const copy = Object.fromEntries(Object.entries(LAB_REGISTRY).map(([id, lab]) => [id, { ...lab }]));
  const payloads = (registry: typeof LAB_REGISTRY) => Object.fromEntries(Object.entries(registry).map(([id, lab]) => {
    const { tranche, masterTranche, curriculumOrder, ...payload } = lab;
    return [id, payload];
  }));
  const before = payloads(copy);
  applyMasterOneCurriculum(copy);
  assert.deepEqual(payloads(copy), before);
  for (const lab of Object.values(LAB_REGISTRY).filter(lab => (lab.masterTranche ?? 1) !== 1 || (lab.tranche ?? 1) === 1)) {
    assert.deepEqual(copy[lab.id], lab);
  }
});

test('first tranche contains four fundamentals followed by VLAN Basics, without retired lab', () => {
  const labs = Object.values(LAB_REGISTRY).filter(lab => lab.type === 'guided' && (lab.masterTranche ?? 1) === 1 && (lab.tranche ?? 1) === 1);
  assert.deepEqual(labs.map(lab => lab.id), [...Object.keys(fundamentalsLabs), 'vlan-basics']);
  assert.equal(LAB_REGISTRY['lab-1'], undefined);
  assert.equal(LAB_REGISTRY['sandbox-lab-1'], undefined);
  assert.equal(LAB_REGISTRY['sandbox-vlan-basics'].tranche, 1);
});

test('IPv4 prefix calculations cover all 33 prefixes without signed overflow', () => {
  for (let prefix = 0; prefix <= 32; prefix++) {
    const facts = subnetFacts('192.168.10.77', prefix);
    assert.equal(facts.total, 2 ** (32 - prefix));
    const maskBits = facts.mask.split('.').map(n => Number(n).toString(2).padStart(8, '0')).join('');
    assert.equal(maskBits, '1'.repeat(prefix) + '0'.repeat(32 - prefix));
    assert.equal(facts.wildcard, facts.mask.split('.').map(n => 255 - Number(n)).join('.'));
  }
  assert.equal(subnetFacts('192.168.10.77', 0).last, '255.255.255.255');
  assert.equal(subnetFacts('192.168.10.77', 0).network, '0.0.0.0');
  assert.equal(subnetFacts('192.168.10.77', 27).network, '192.168.10.64');
  assert.equal(subnetFacts('192.168.10.77', 27).last, '192.168.10.95');
  assert.equal(subnetFacts('192.168.10.77', 31).network, '192.168.10.76');
  assert.equal(subnetFacts('192.168.10.77', 32).network, '192.168.10.77');
  assert.throws(() => subnetFacts('256.1.1.1', 24));
  assert.throws(() => subnetFacts('1.1.1.1', 33));
});

test('answer checking accepts equivalent IPv6 and rejects malformed answers', () => {
  assert.equal(expandedIpv6('::'), '0000:0000:0000:0000:0000:0000:0000:0000');
  assert.equal(expandedIpv6('2001::db8::1'), null);
  assert.equal(expandedIpv6('1:2:3:4:5:6:7:8::'), null);
  assert.ok(answerMatches({ label: 'IPv6', answer: 'fe80::1', format: 'ipv6' }, 'FE80:0:0:0:0:0:0:1'));
  assert.ok(answerMatches({ label: 'Binary', answer: '11000000', format: 'binary' }, '1100 0000'));
  assert.equal(answerMatches({ label: 'Binary', answer: '11000000', format: 'binary' }, '11000002'), false);
  assert.equal(answerMatches({ label: 'Number', answer: '0', format: 'number' }, ''), false);
});

for (const lab of Object.values(fundamentalsLabs)) {
  test(`${lab.title}: worksheets and IOS practice grade in tranche and sandbox`, () => {
    assert.equal(lab.masterTranche, 1);
    assert.equal(lab.tranche, 1);
    assert.equal(gradeLab(lab, seedSessions(lab)).passed, false);
    const counterpart = LAB_REGISTRY[`sandbox-${lab.id}`];
    assert.deepEqual(counterpart.steps, lab.steps);
    assert.equal(new Set(lab.steps.map(step => step.id)).size, lab.steps.length);
    for (const step of lab.steps) {
      if (!step.exercise) continue;
      assert.ok(step.exercise.worked.length > 0);
      for (const field of step.exercise.fields) assert.ok(answerMatches(field, field.answer), `${step.label}: ${field.label}`);
    }
    for (const config of [lab, counterpart]) {
      const result = replayLab(config);
      assert.deepEqual(result.findings, []);
      assert.deepEqual(validateLab(config).filter(f => f.severity === 'error'), []);
      assert.equal(gradeLab(config, result.sessions).passed, true);
      assert.equal(gradeLab(config, JSON.parse(JSON.stringify(result.sessions))).passed, true);
      delete result.sessions['CE-R1'].lessonAnswers?.['1'];
      assert.equal(gradeLab(config, result.sessions).passed, false);
    }
  });
}
