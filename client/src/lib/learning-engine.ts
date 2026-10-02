import { applyCommand, boot, isCiscoCommand, normalizeCommand, type Session } from './ios-engine';
import type { LabConfig } from '../labs/labDefinitions';
import { supportsDeviceCommand } from './capabilities';
import { executeAttackCommand, isAttackCommand } from './attack-console-engine';

export type LearningMode = 'guided' | 'assisted' | 'assessment';
export const DEFAULT_LEARNING_MODE: LearningMode = 'guided';
export type Sessions = Record<string, Session>;
export type Requirement = { device: string; path: string[]; value: unknown; label: string };
export type Finding = { severity: 'error' | 'warning'; message: string };

export function canonicalCommand(raw: string) {
  return normalizeCommand(raw).replace(/^conf t$/, 'configure terminal').replace(/^en$/, 'enable')
    .replace(/^int /, 'interface ').replace(/^sh /, 'show ').replace(/^no shut$/, 'no shutdown')
    .replace(/gigabitethernet\s*(\d+\/\d+)/g, 'g$1');
}

export function seedSessions(lab: LabConfig): Sessions {
  const sessions: Sessions = {};
  for (const device of lab.topology.devices) {
    const isAttackConsole = device.terminal === 'attack';
    let session = boot(device.name || device.id, device.role || 'Lab device', isAttackConsole ? 'attack' : 'ios');
    for (const command of lab.initialState?.commands?.[device.name] || []) {
      session = applyCommand(session, canonicalCommand(command), session.history);
    }
    sessions[device.name || device.id] = session;
  }
  return sessions;
}

export function namedSessions(lab: LabConfig, sessions: Sessions): Sessions {
  return Object.fromEntries(lab.topology.devices.map(device => [device.name || device.id, sessions[device.name] || sessions[device.id]]));
}

export function replayLab(lab: LabConfig) {
  const sessions = seedSessions(lab);
  const findings: Finding[] = [];
  for (const step of lab.steps) {
    const session = sessions[step.targetDevice];
    if (!session) { findings.push({ severity: 'error', message: `Step ${step.id}: missing device ${step.targetDevice}` }); continue; }
    if (step.exercise) {
      if (!step.exercise.fields.length || step.exercise.fields.some(field => !field.answer.trim())) findings.push({ severity: 'error', message: `Step ${step.id}: missing worksheet answer` });
      sessions[step.targetDevice] = { ...session, lessonAnswers: { ...session.lessonAnswers, [step.id]: true } };
      continue;
    }
    const command = canonicalCommand(step.expectedCommand || '');
    const device = lab.topology.devices.find(device => device.name === step.targetDevice);
    if (session.mode === 'shell') {
      if (!isAttackCommand(command)) findings.push({ severity: 'error', message: `Step ${step.id}: invalid Linux attack-console command ${command}` });
      const result = executeAttackCommand(session, command, sessions);
      sessions[step.targetDevice] = result.session;
      continue;
    }
    if (device && !supportsDeviceCommand(command, device, session.context)) findings.push({ severity: 'error', message: `Step ${step.id}: sandbox capability rejects ${command} on ${device.name}` });
    if (session.mode !== step.requiredMode || !isCiscoCommand(command, session.mode)) {
      findings.push({ severity: 'error', message: `Step ${step.id} on ${step.targetDevice}: ${command} requires ${step.requiredMode}, actual ${session.mode}` });
    }
    sessions[step.targetDevice] = applyCommand(session, command, [...session.history, `${session.hostname}> ${command}`]);
  }
  return { sessions, findings };
}

function flatten(value: unknown, path: string[], result: Requirement[], device: string) {
  if (Array.isArray(value)) {
    if (value.length) result.push({ device, path, value, label: `${device}: ${path.join(' / ')}` });
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (['commands', 'errors', 'poe', 'status', 'speed', 'duplex'].includes(key)) continue;
      flatten(child, [...path, key], result, device);
    }
  } else if (value !== undefined) result.push({ device, path, value, label: `${device}: ${path.join(' / ')}` });
}

export function requirementsFor(lab: LabConfig): Requirement[] {
  if (lab.outcomes?.length) return lab.outcomes;
  const { sessions } = replayLab(lab);
  const requirements: Requirement[] = [];
  for (const [device, session] of Object.entries(sessions)) {
    for (const key of ['interfaces', 'vlans', 'ospfProcesses', 'dhcpPools', 'dnsRecords', 'fhrpGroups', 'settings'] as const) {
      flatten(session[key], [key], requirements, device);
    }
    if (session.dnsServerEnabled) flatten(true, ['dnsServerEnabled'], requirements, device);
  }
  return requirements;
}

export function readPath(value: unknown, path: string[]): any {
  return path.reduce<any>((current, key) => current?.[key], value);
}
export function equivalent(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) return Array.isArray(actual) && expected.every(item => actual.some(value => equivalent(value, item)));
  if (expected && typeof expected === 'object') return !!actual && typeof actual === 'object' && Object.entries(expected).every(([key, value]) => equivalent((actual as any)[key], value));
  return typeof expected === 'string' && typeof actual === 'string' ? normalizeCommand(actual) === normalizeCommand(expected) : actual === expected;
}
export function gradeLab(lab: LabConfig, sessions: Sessions) {
  const named = namedSessions(lab, sessions);
  const results = requirementsFor(lab).map(requirement => {
    const actual = readPath(named[requirement.device], requirement.path);
    const passed = requirement.path.at(-1) === 'allowedVlans' && typeof actual === 'string' && typeof requirement.value === 'string'
      ? equivalent(vlanSet(actual), vlanSet(requirement.value)) && equivalent(vlanSet(requirement.value), vlanSet(actual))
      : equivalent(actual, requirement.value);
    return { ...requirement, actual, passed };
  });
  return { results, passed: results.length > 0 && results.every(result => result.passed), percent: results.length ? Math.round(100 * results.filter(result => result.passed).length / results.length) : 0 };
}

export function vlanSet(list: string): number[] {
  if (list === 'all') return Array.from({ length: 4094 }, (_, i) => i + 1);
  if (list === 'none') return [];
  return Array.from(new Set(list.split(',').flatMap(item => {
    const [low, high = low] = item.trim().split('-').map(Number);
    return Number.isInteger(low) && Number.isInteger(high) && low >= 1 && high <= 4094 && high >= low
      ? Array.from({ length: high - low + 1 }, (_, i) => low + i) : [];
  }))).sort((a, b) => a - b);
}

export function validateLab(lab: LabConfig): Finding[] {
  const findings = replayLab(lab).findings;
  const devices = new Map(lab.topology.devices.map(device => [device.id, device]));
  const used = new Set<string>();
  for (const link of lab.topology.links) for (const [id, port] of [[link.from, link.fromPort], [link.to, link.toPort]]) {
    const device = devices.get(id);
    if (!device?.ports?.includes(port)) findings.push({ severity: 'error', message: `Link ${link.id}: ${device?.name || id} has no port ${port}` });
    const key = `${id}:${port}`;
    if (used.has(key)) findings.push({ severity: 'error', message: `Port ${key} is connected more than once` });
    used.add(key);
  }
  const { sessions } = replayLab(lab);
  for (const [name, session] of Object.entries(sessions)) {
    for (const [port, state] of Object.entries(session.interfaces)) {
      if (state.accessVlan && !session.vlans[state.accessVlan]) findings.push({ severity: 'warning', message: `${name} ${port}: access VLAN ${state.accessVlan} has not been created` });
    }
    for (const pool of Object.values(session.dhcpPools)) if (!pool.network || !pool.mask || !pool.defaultRouter) findings.push({ severity: 'warning', message: `${name}: DHCP pool ${pool.name} needs network, mask and gateway` });
  }
  if (!requirementsFor(lab).length) findings.push({ severity: 'warning', message: 'No measurable state outcomes. This exercise currently verifies command practice only.' });
  return findings;
}

export function configurationDiff(before: Sessions, after: Sessions): string[] {
  const differences: string[] = [];
  const visit = (left: any, right: any, path: string) => {
    if (JSON.stringify(left) === JSON.stringify(right)) return;
    if (left && right && typeof left === 'object' && typeof right === 'object' && !Array.isArray(left) && !Array.isArray(right)) {
      for (const key of Array.from(new Set([...Object.keys(left), ...Object.keys(right)]))) {
        if (['history', 'commands', 'lastSeen', 'leaseStart', 'leaseEnd'].includes(key)) continue;
        visit(left[key], right[key], `${path}/${key}`);
      }
    } else differences.push(`${path}: ${JSON.stringify(left) ?? '(unset)'} -> ${JSON.stringify(right) ?? '(unset)'}`);
  };
  visit(before, after, '');
  return differences;
}

export type SkillRecord = { labId: string; mode: LearningMode; score: number; hints: number; errors: number; at: string };
export function readStored<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}
export function writeStored(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function recordAttempt(labId: string, field: 'hints' | 'errors') {
  const key = `observatory:attempt:${labId}`;
  const stats = readStored(key, { hints: 0, errors: 0 });
  try { writeStored(key, { ...stats, [field]: stats[field] + 1 }); } catch { /* The console remains usable when storage is unavailable. */ }
}
