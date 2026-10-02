import { LAB_REGISTRY } from '../client/src/labs/labDefinitions';
import { replayLab, validateLab, seedSessions, gradeLab } from '../client/src/lib/learning-engine';
import { executeNetworkCommand } from '../client/src/lib/sandbox-network-engine';
import { executeAttackCommand } from '../client/src/lib/attack-console-engine';
import { answerMatches } from '../client/src/lib/addressing-fundamentals';
let errors = 0;
let warnings = 0;
let steps = 0;
for (const lab of Object.values(LAB_REGISTRY)) {
  if (lab.id === 'blank' || lab.status === 'planned') continue;
  const findings = validateLab(lab);
  const seeded = seedSessions(lab);
  let sessions = Object.fromEntries(lab.topology.devices.map(device => [device.id, seeded[device.name]]));
  const topology = { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links };
  for (const step of lab.steps) {
    const node = topology.nodes.find(node => node.name === step.targetDevice);
    if (!node) continue;
    if (step.exercise) {
      if (!step.exercise.fields.length || step.exercise.fields.some(field => !answerMatches(field, field.answer))) {
        findings.push({ severity: 'error', message: `Invalid worksheet answer key: ${step.label}` });
      } else {
        sessions[node.id] = { ...sessions[node.id], lessonAnswers: { ...sessions[node.id].lessonAnswers, [step.id]: true } };
      }
      continue;
    }
    if (sessions[node.id].terminalKind === 'attack') {
      const result = executeAttackCommand(sessions[node.id], step.expectedCommand.toLowerCase(), sessions);
      if (!result.accepted) findings.push({ severity: 'error', message: `Attack executor rejected ${step.expectedCommand} on ${node.name}` });
      sessions[node.id] = result.session;
    } else {
      const result = executeNetworkCommand(node, topology, sessions, step.expectedCommand);
      if (!result.accepted) findings.push({ severity: 'error', message: `Shared executor rejected ${step.expectedCommand} on ${node.name}` });
      sessions = result.sessions;
    }
  }
  const grade = gradeLab(lab, sessions);
  for (const result of grade.results.filter(result => !result.passed)) findings.push({ severity: 'error', message: `Completed walkthrough does not satisfy ${result.label}` });
  steps += lab.steps.length;
  for (const finding of findings) {
    if (finding.severity === 'error') errors++; else warnings++;
    console.log(`${lab.id}: ${finding.severity}: ${finding.message}`);
  }
  if (!replayLab(lab).findings.length) console.log(`${lab.id}: ${lab.steps.length} steps replayed`);
}
console.log(`Walkthrough audit: ${steps} steps, ${errors} errors, ${warnings} warnings`);
process.exitCode = errors ? 1 : 0;
