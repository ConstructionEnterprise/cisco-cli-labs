import type { LabConfig, LabStep } from './labDefinitions';
import { simulatedTargetById } from '../lib/simulated-target-range';

type Scenario = {
  master: 5 | 6;
  tranche: 1 | 2 | 3 | 4 | 5;
  slug: string;
  title: string;
  description: string;
  targetId: string;
  probe: string;
  inspect: string;
  finding: string;
};

const scenarios: Scenario[] = [
  {
    master: 5, tranche: 3, slug: 'purple-dns-answer-integrity', title: 'Purple Team: DNS Spoofing Investigation',
    description: 'Use ATTACKER-KALI to validate the fictional DNS listener, query the payroll record, and enumerate the affected range asset. Review the captured response against the approved address; an inconsistent answer does not identify its cause.',
    targetId: 'dns-1', probe: 'dig @dns-1 payroll.training.example', inspect: 'nmap -sV --version-light dns-1',
    finding: 'The modeled response points to 10.76.20.66 instead of approved 10.76.20.82.',
  },
  {
    master: 5, tranche: 5, slug: 'purple-unknown-cause-containment', title: 'Purple Team: Unknown-Cause Incident Containment',
    description: 'Validate the fictional service, probe its health endpoint, and enumerate its asset context. The captured 503 and integrity alert are evidence of an unknown cause, not a confirmed zero-day.',
    targetId: 'unknown-app', probe: 'curl -i https://unknown-app.example/health', inspect: 'nmap -Pn -p 443 unknown-app',
    finding: 'Service health and logs show an anomaly, but no vulnerability or exploit has been identified.',
  },
  {
    master: 6, tranche: 1, slug: 'red-reflected-html-review', title: 'Red Team: Reflected XSS Candidate',
    description: 'Validate the fictional search listener, probe it with a harmless HTML marker, and enumerate its asset context. The captured unencoded reflection is an XSS candidate, not proof of browser script execution.',
    targetId: 'xss-lab', probe: 'curl -i "https://xss-lab.example/search?q=%3Cb%3Etraining%3C%2Fb%3E"', inspect: 'nmap -Pn -p 443 xss-lab',
    finding: 'The response reflects a harmless HTML element without encoding; browser execution is not modeled.',
  },
  {
    master: 6, tranche: 2, slug: 'red-path-traversal-canary', title: 'Red Team: Path Traversal Canary',
    description: 'Validate the fictional file listener, request the built-in canary outside its modeled web root, and enumerate the asset. The captured response proves only this synthetic path-handling condition; no host file is read.',
    targetId: 'files-lab', probe: 'curl -i "https://files-lab.example/download?file=../training-canary.txt"', inspect: 'nmap -Pn -p 443 files-lab',
    finding: 'The fictional canary is returned from outside the modeled web root.',
  },
  {
    master: 6, tranche: 3, slug: 'red-sudo-boundary', title: 'Red Team: Scoped Privilege Escalation',
    description: 'Validate the fictional Linux listener, run the pre-authorized sudo id probe, and enumerate the asset. The captured uid=0 applies only to /usr/bin/id; no root shell is modeled.',
    targetId: 'linux-lab', probe: "ssh trainee@linux-lab 'sudo -n id'", inspect: 'nmap -Pn -p 22 linux-lab',
    finding: 'The training user can execute /usr/bin/id as root, but cannot open a root shell in this range.',
  },
  {
    master: 6, tranche: 4, slug: 'purple-memory-fault-triage', title: 'Purple Team: Buffer Overflow Triage',
    description: 'Validate the fictional legacy listener, submit a harmless 32-byte parser marker, and enumerate the asset. The captured service error is a modeled memory fault, not proof of code execution.',
    targetId: 'legacy-app', probe: "curl -i --data-binary 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' https://legacy-app.example/input", inspect: 'nmap -Pn -p 443 legacy-app',
    finding: 'The modeled parser overruns a fixed buffer and crashes; that does not prove arbitrary code execution.',
  },
];

function makeLab(scenario: Scenario): LabConfig {
  const target = simulatedTargetById[scenario.targetId];
  const address = target.address.split(':')[0];
  const devices = [
    { id: 'attacker', name: 'ATTACKER-KALI', kind: 'pc', terminal: 'attack', role: 'Authorized synthetic Linux attack console', x: 70, y: 90, ports: ['eth0'] },
    { id: 'sw1', name: 'CE-SW1', kind: 'switch', role: 'Assessment access switch', x: 310, y: 90, ports: ['g0/1', 'g0/2'] },
    { id: 'r1', name: 'CE-R1', kind: 'router', role: 'Synthetic routed path', x: 550, y: 240, ports: ['g0/0', 'g0/1'] },
    { id: 'sw2', name: 'CE-SW2', kind: 'switch', role: 'Target service switch', x: 790, y: 390, ports: ['g0/1', 'g0/2'] },
    { id: 'target', name: target.name, kind: target.kind === 'Website' ? 'server' : target.kind.toLowerCase(), role: `${target.zone} | ${target.purpose}`, x: 1030, y: 390, ports: ['eth0'] },
  ];
  const links = [
    { id: 'attacker-access', from: 'attacker', to: 'sw1', fromPort: 'eth0', toPort: 'g0/2' },
    { id: 'assessment-boundary', from: 'sw1', to: 'r1', fromPort: 'g0/1', toPort: 'g0/0' },
    { id: 'service-boundary', from: 'r1', to: 'sw2', fromPort: 'g0/1', toPort: 'g0/1' },
    { id: 'target-access', from: 'sw2', to: 'target', fromPort: 'g0/2', toPort: 'eth0' },
  ];
  const switchSeed = (vlan: number) => ['enable', 'configure terminal', `vlan ${vlan}`, 'name SYNTHETIC-RANGE', 'exit', ...['g0/1', 'g0/2'].flatMap(port => [`interface ${port}`, 'switchport mode access', `switchport access vlan ${vlan}`, 'no shutdown', 'exit']), 'end'];
  const commands: Record<string, string[]> = {
    'CE-SW1': switchSeed(10),
    'CE-SW2': switchSeed(target.vlan),
    'CE-R1': ['enable', 'configure terminal', 'interface g0/0', 'ip address 10.76.10.1 255.255.255.0', 'no shutdown', 'exit', 'interface g0/1', `ip address 10.76.${target.vlan}.1 255.255.255.0`, 'no shutdown', 'end'],
    [target.name]: ['enable', 'configure terminal', 'interface eth0', `ip address ${address} 255.255.255.0`, 'no shutdown', 'end'],
  };
  const actions: Array<[LabStep['evidencePhase'], string, string, string]> = [
    ['validation', scenario.inspect, 'Validate the scoped listener', 'Run the Linux inventory command and inspect its captured service result.'],
    ['probe', scenario.probe, 'Probe the modeled condition', scenario.finding],
    ['enumeration', `python3 training/scripts/range_inventory.py ${scenario.targetId}`, 'Enumerate the affected resource', 'Inspect the recorded asset context and review the terminal evidence before drawing conclusions.'],
  ];
  return {
    id: `mt${scenario.master}-tr${scenario.tranche}-${scenario.slug}`,
    title: scenario.title, description: scenario.description, type: 'guided', status: 'active',
    masterTranche: scenario.master, tranche: scenario.tranche, curriculumOrder: scenario.master === 5 ? 3 : 7,
    troubleshooting: true, rangeTargetId: scenario.targetId, topology: { devices, links }, initialState: { commands },
    outcomes: [{ device: 'ATTACKER-KALI', path: ['attackTerminal', 'rangePhase', scenario.targetId], value: 'enumeration', label: 'Validation, probe, and enumeration evidence recorded' }],
    steps: actions.map(([evidencePhase, expectedCommand, label, description], index) => ({ id: index + 1, targetDevice: 'ATTACKER-KALI', requiredMode: 'shell', evidencePhase, expectedCommand, label, description, successMessage: 'Terminal evidence recorded.', validation: () => true })),
  };
}

export const threatScenarioLabs: Record<string, LabConfig> = Object.fromEntries(scenarios.map(scenario => {
  const lab = makeLab(scenario);
  return [lab.id, lab];
}));
