import { test } from 'node:test';
import assert from 'node:assert/strict';
import { troubleshootingLabs } from '../labs/troubleshootingLabs';
import { techSupportLabs } from '../labs/techSupportLabs';
import { cyberDefenseLabs } from '../labs/cyberDefenseLabs';
import { ethicalHackingLabs } from '../labs/ethicalHackingLabs';
import { threatScenarioLabs } from '../labs/threatScenarioLabs';
import { LAB_REGISTRY } from '../labs/labDefinitions';
import { applyCommand, boot, iosContextHelp, isCiscoCommand, modeledDeviceMac, type Session } from './ios-engine';
import { stpBridgeMac } from './stp';
import { canonicalCommand, configurationDiff, DEFAULT_LEARNING_MODE, gradeLab, replayLab, seedSessions, validateLab, vlanSet } from './learning-engine';
import { channelForwarding, diagnosePath, evidenceOutput, interfaceEvidence, interfaceRelationships, interfaceVlan, protocolEvidence, leaseState, electionEvidence, ospfOperationalEvidence } from './operational-evidence';
import { evaluateInterfaceAcl } from './ipv4-policy';
import { vlanOverlay } from './vlan-overlay';
import { cabledPeer, cabledPeerAddress, cabledPeerMac, portHoverContent, vlanSvi } from '../components/VlanHoverCard';
import { executeNetworkCommand, outputFor, tracePacket, reconcileOspfRoutes, ospfNeighbors, ipv4Routes, ageMacTables } from './sandbox-network-engine';
import { executeAttackCommand, isAttackCommand } from './attack-console-engine';
import { simulatedTargetById } from './simulated-target-range';
import { networkingVocabularyCards, shuffleVocabularyCards, VOCABULARY_GROUPS } from '../labs/vocabularyCards';

test('extended web ACL lab seeds distinct client and server networks and reports policy evidence', () => {
  const lab = LAB_REGISTRY['tr4-extended-acl'];
  const topology = { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links };
  const seeded = seedSessions(lab);
  let sessions = Object.fromEntries(topology.nodes.map(node => [node.id, seeded[node.name]]));
  const router = topology.nodes.find(node => node.name === 'CE-R1')!;
  assert.equal(seeded['CE-R1'].mode, 'user');
  assert.equal(seeded['CE-R1'].interfaces['g0/0'].ipv4[0], '192.168.60.1 255.255.255.0');
  assert.equal(seeded['WEB-SRV1'].interfaces.eth0.ipv4[0], '192.168.70.10 255.255.255.0');
  assert.equal(tracePacket(router.id, '192.168.70.10', topology, sessions).passed, true, tracePacket(router.id, '192.168.70.10', topology, sessions).summary);
  for (const step of lab.steps.slice(0, 11)) {
    const result = executeNetworkCommand(router, topology, sessions, step.expectedCommand);
    assert.equal(result.accepted, true, `${step.expectedCommand}: ${result.output.join(' ')}`);
    sessions = result.sessions;
  }
  assert.match(outputFor('show access-lists WEB-POLICY', router, topology, sessions[router.id], sessions).join('\n'), /Extended IP access list web-policy[\s\S]*permit tcp 192\.168\.60\.0/);
  assert.match(outputFor('show ip interface g0/0', router, topology, sessions[router.id], sessions).join('\n'), /Inbound access list is WEB-POLICY/i);
  assert.match(outputFor('show running-config | section access-list', router, topology, sessions[router.id], sessions).join('\n'), /ip access-list extended WEB-POLICY[\s\S]*permit tcp/i);
  assert.equal(tracePacket(router.id, '192.168.70.10', topology, sessions).passed, true);
});

test('extended web ACL verification is a single modeled pass with correct ARP and config evidence', () => {
  const lab = LAB_REGISTRY['tr4-extended-acl'];
  const topology = { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links };
  const router = topology.nodes.find(node => node.name === 'CE-R1')!;
  const seeded = seedSessions(lab);
  let sessions = Object.fromEntries(topology.nodes.map(node => [node.id, seeded[node.name]]));
  assert.equal(lab.steps.length, 24);
  assert.equal(lab.steps.filter(step => step.expectedCommand === 'show ip interface g0/0').length, 1);
  assert.ok(lab.steps.find(step => step.expectedCommand === 'ping 192.168.70.10')?.requireReachability);
  for (const step of lab.steps) {
    const result = executeNetworkCommand(router, topology, sessions, step.expectedCommand);
    assert.equal(result.accepted, true, step.expectedCommand);
    assert.doesNotMatch(result.output.join('\n'), /No modeled operational output/, step.expectedCommand);
    sessions = result.sessions;
    if (step.expectedCommand === 'show ip interface brief') {
      assert.match(result.output.join('\n'), /g0\/0\s+192\.168\.60\.1\s+YES/);
      assert.doesNotMatch(result.output.join('\n'), /192\.168\.60\.1 255\.255\.255\.0/);
    }
    if (step.expectedCommand === 'show running-config') {
      assert.match(result.output.join('\n'), /interface g0\/0\n[\s\S]*ip access-group web-policy in/);
      assert.doesNotMatch(result.output.join('\n'), /hostname CE-R1\nip address/);
    }
    if (step.expectedCommand === 'show arp') assert.match(result.output.join('\n'), /192\.168\.70\.10.*g0\/1/);
    if (step.expectedCommand === 'show startup-config') assert.match(result.output.join('\n'), /interface g0\/0\n[\s\S]*ip access-group web-policy in/);
  }
});

test('VLSM transit lab installs its route only when the next hop resolves and reaches the remote aggregate', () => {
  const lab = LAB_REGISTRY['mt2-tr5-vlsm-supernetting'];
  const topology = { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links };
  const seeded = seedSessions(lab);
  let sessions = Object.fromEntries(topology.nodes.map(node => [node.id, seeded[node.name]]));
  const r1 = topology.nodes.find(node => node.name === 'CE-R1')!;
  const r2 = topology.nodes.find(node => node.name === 'CE-R2')!;
  assert.deepEqual(topology.nodes.map(node => node.name), ['CE-R1', 'CE-SW1', 'CE-R2']);
  assert.equal(lab.steps.at(-1)?.requireReachability, true);
  assert.equal(gradeLab(lab, sessions).passed, false);
  assert.equal(tracePacket(r1.id, '10.93.4.1', topology, sessions).passed, false);
  let checkedDownRoute = false;
  for (const step of lab.steps) {
    const node = topology.nodes.find(candidate => candidate.name === step.targetDevice)!;
    const result = executeNetworkCommand(node, topology, sessions, step.expectedCommand);
    assert.equal(result.accepted, true, `${step.targetDevice}: ${step.expectedCommand}: ${result.output.join(' ')}`);
    sessions = result.sessions;
    if (step.expectedCommand.startsWith('ip route 10.93.4.0')) {
      const down = { ...sessions[r1.id], interfaces: { ...sessions[r1.id].interfaces, 'g0/0': { ...sessions[r1.id].interfaces['g0/0'], shutdown: true } } };
      assert.equal(ipv4Routes(down).some(route => route.protocol === 'static'), false);
      assert.equal(gradeLab(lab, { ...sessions, [r1.id]: down }).passed, false);
      checkedDownRoute = true;
    }
    if (step.expectedCommand === 'show ip route static') assert.match(result.output.join('\n'), /S\s+10\.93\.4\.0\/22.*via 10\.93\.0\.2, g0\/0/);
  }
  assert.equal(checkedDownRoute, true);
  assert.equal(sessions[r2.id].interfaces['g0/0'].ipv4[0], '10.93.0.2 255.255.255.252');
  assert.equal(gradeLab(lab, sessions).passed, true);
  assert.equal(tracePacket(r1.id, '10.93.4.1', topology, sessions).passed, true);
});

test('Networking Vocabulary exposes every authored term as one deterministic four-choice card', () => {
  const cards = networkingVocabularyCards();
  const authoredCount = Object.values(VOCABULARY_GROUPS).flatMap((text) => text.split('\n').filter(Boolean)).length;
  assert.equal(cards.length, authoredCount);
  assert.ok(cards.length >= 160);
  assert.equal(new Set(cards.map((card) => card.id)).size, cards.length);
  for (const card of cards) {
    assert.equal(card.choices.length, 4);
    assert.equal(card.choices.filter((choice) => choice.label === card.term).length, 1);
  }
});

test('Networking Vocabulary shuffles study order without losing or changing cards', () => {
  const authored = networkingVocabularyCards();
  const originalIds = authored.map(card => card.id);
  const shuffled = shuffleVocabularyCards(authored, () => 0);
  assert.notDeepEqual(shuffled.map(card => card.id), originalIds);
  assert.deepEqual(shuffled.map(card => card.id).sort(), [...originalIds].sort());
  assert.deepEqual(authored.map(card => card.id), originalIds);
  for (const card of shuffled) assert.equal(card, authored.find(original => original.id === card.id));
});

test('IOS context help exposes only commands relevant to the current prompt and does not mutate session state', () => {
  assert.deepEqual(iosContextHelp('?', 'user'), ['enable                         Turn on privileged commands', 'exit                           Exit from the EXEC']);
  assert.ok(iosContextHelp('show ip ?', 'privileged')?.some((line) => line.startsWith('route')));
  assert.ok(iosContextHelp('switchport ?', 'interface')?.some((line) => line.startsWith('trunk')));
  assert.ok(iosContextHelp('show ?', 'config')?.[0].startsWith('% Unrecognized command'));
  assert.equal(isCiscoCommand('show ?', 'privileged'), true);
  const session = boot('CE-R1', 'Router');
  assert.equal(applyCommand(session, 'show ?', session.history).mode, 'user');
});

test('Master Tranches Four and Five each include one defensive security incident per sub-tranche', () => {
  const masterFour = Object.values(cyberDefenseLabs).filter(lab => lab.masterTranche === 4);
  const masterFive = Object.values(cyberDefenseLabs).filter(lab => lab.masterTranche === 5);
  for (const labs of [masterFour, masterFive]) {
    assert.equal(labs.length, 5);
    assert.deepEqual(labs.map(lab => lab.tranche).sort(), [1, 2, 3, 4, 5]);
    for (const lab of labs) {
      assert.deepEqual(replayLab(lab).findings, []);
      assert.equal(gradeLab(lab, replayLab(lab).sessions).passed, true);
      const sandbox = LAB_REGISTRY[`sandbox-${lab.id}`];
      assert.equal(sandbox.masterTranche, lab.masterTranche);
      assert.equal(sandbox.tranche, lab.tranche);
      assert.deepEqual(replayLab(sandbox).findings, []);
    }
  }
});

test('Master Tranche Five cables and guided inspection commands match modeled devices', () => {
  const labs = Object.values(LAB_REGISTRY).filter(lab => lab.type === 'guided' && lab.masterTranche === 5);
  assert.equal(labs.length, 12);
  const placeholders: string[] = [];
  for (const lab of labs) {
    const byId = Object.fromEntries(lab.topology.devices.map(device => [device.id, device]));
    const usedPorts = new Set<string>();
    for (const link of lab.topology.links) {
      for (const [deviceId, port] of [[link.from, link.fromPort], [link.to, link.toPort]]) {
        const device = byId[deviceId];
        assert.ok(device, `${lab.id} cable ${link.id} references missing device ${deviceId}`);
        assert.ok(device.ports.includes(port), `${lab.id} cable ${link.id} uses undeclared ${device.name} ${port}`);
        const key = `${deviceId}:${port}`;
        assert.ok(!usedPorts.has(key), `${lab.id} connects multiple cables to ${device.name} ${port}`);
        usedPorts.add(key);
      }
    }
    const sessions = seedSessions(lab);
    const bySessionId = Object.fromEntries(lab.topology.devices.map(device => [device.id, sessions[device.name]]));
    for (const step of lab.steps.filter(item => item.expectedCommand.startsWith('show '))) {
      const device = lab.topology.devices.find(item => item.name === step.targetDevice)!;
      const output = outputFor(step.expectedCommand, device, { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links }, sessions[device.name], bySessionId).join('\n');
      if (output.includes('No modeled operational output')) placeholders.push(`${lab.id} ${device.name}: ${step.expectedCommand}`);
    }
  }
  assert.deepEqual(placeholders, []);
});

test('synthetic threat scenarios advance from captured validation, probe, and enumeration evidence', () => {
  const labs = Object.values(threatScenarioLabs);
  assert.equal(labs.length, 6);
  for (const lab of labs) {
    const attackSteps = lab.steps.filter(step => step.targetDevice === 'ATTACKER-KALI');
    assert.deepEqual(attackSteps.map(step => step.evidencePhase), ['validation', 'probe', 'enumeration']);
    assert.equal(lab.steps.length, 3, `${lab.id} must not require IOS containment to finish`);
    for (const step of attackSteps) assert.ok(isAttackCommand(canonicalCommand(step.expectedCommand)), `${lab.id}: ${step.expectedCommand}`);
    const initial = seedSessions(lab);
    const targetId = lab.rangeTargetId!;
    const unknown = executeAttackCommand(initial['ATTACKER-KALI'], 'ls', initial);
    assert.equal(unknown.accepted, false);
    assert.equal(unknown.session.attackTerminal?.rangeEvidence.length, 0);
    const earlyProbe = executeAttackCommand(initial['ATTACKER-KALI'], canonicalCommand(attackSteps[1].expectedCommand), initial);
    assert.equal(earlyProbe.session.attackTerminal?.rangePhase[targetId], undefined, 'a probe alone cannot skip validation');
    let current = initial['ATTACKER-KALI'];
    for (const step of attackSteps) {
      const result = executeAttackCommand(current, canonicalCommand(step.expectedCommand), { ...initial, 'ATTACKER-KALI': current });
      assert.equal(result.accepted, true);
      assert.equal(result.session.attackTerminal?.rangePhase[targetId], step.evidencePhase);
      assert.deepEqual(result.session.attackTerminal?.rangeEvidence.at(-1)?.output, result.output);
      current = result.session;
    }
    assert.equal(current.attackTerminal?.rangeEvidence.length, 3);
    const replayed = replayLab(lab);
    assert.deepEqual(replayed.findings, [], `${lab.id} walkthrough must replay`);
    assert.equal(gradeLab(lab, replayed.sessions).passed, true);
    assert.match(current.attackTerminal!.rangeEvidence[2].output.join('\n'), /attack_lens=ATT&CK/);
    const target = lab.topology.devices.find(device => device.id === 'target')!;
    const cable = lab.topology.links.find(link => link.to === target.id)!;
    const asset = Object.values(simulatedTargetById).find(item => item.name === target.name)!;
    assert.equal(replayed.sessions['CE-SW2'].interfaces[cable.fromPort].accessVlan, asset.vlan);
  }
});

test('Pruned Trunk reports three CE-SW2 ports despite four lab-wide links', () => {
  const lab = troubleshootingLabs['mt5-tr3-repair-trunk'];
  const sessions = seedSessions(lab);
  const peer = lab.topology.devices.find(device => device.name === 'CE-SW2')!;
  const topology = { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links };
  const byId = Object.fromEntries(lab.topology.devices.map(device => [device.id, sessions[device.name]]));
  assert.equal(topology.links.length, 4);
  const status = outputFor('show interfaces status', peer, topology, sessions['CE-SW2'], byId);
  assert.equal(status.length, 4);
  assert.match(status[1], /^g0\/1\s+.*connected\s+10\s+/);
  assert.match(status[2], /^g0\/2\s+.*connected\s+trunk\s+/);
  assert.match(status[3], /^g0\/3\s+.*connected\s+10\s+/);
  const uplink = outputFor('show interfaces g0/2', peer, topology, sessions['CE-SW2'], byId).join('\n');
  assert.match(uplink, /Modeled topology peer: CE-SW1 g0\/2/);
  assert.match(uplink, /Switchport mode: trunk/);
  assert.match(uplink, /Allowed VLANs: 10,20/);
  assert.match(outputFor('show interfaces counters errors', peer, topology, sessions['CE-SW2'], byId).join('\n'), /g0\/2\s+0\s+0/);
  sessions['CE-SW1'].interfaces['g0/2'].shutdown = true;
  assert.match(outputFor('show interfaces g0/2', peer, topology, sessions['CE-SW2'], byId)[0], /is down, line protocol is down/);
  assert.match(outputFor('show ip interface brief', peer, topology, sessions['CE-SW2'], byId).find(line => line.startsWith('g0/2')) || '', /down\s+down$/);
  assert.match(outputFor('show interfaces trunk', peer, topology, sessions['CE-SW2'], byId).find(line => line.startsWith('g0/2')) || '', /not-trunking/);
});

test('Master Tranche Six has Blue, Red, simulated-pentest, and target-range Purple Team coverage', () => {
  const labs = Object.values(ethicalHackingLabs);
  const blue = labs.filter(lab => lab.title.startsWith('Blue Team:'));
  const redValidation = labs.filter(lab => lab.title.startsWith('Red Team:'));
  const redSimulation = labs.filter(lab => lab.title.startsWith('Red Team Simulation:'));
  const purpleSimulation = labs.filter(lab => lab.title.startsWith('Purple Team Simulation:'));
  assert.equal(labs.length, 29);
  assert.equal(blue.length, 5);
  assert.equal(redValidation.length, 5);
  assert.equal(redSimulation.length, 5);
  assert.equal(purpleSimulation.length, 14);
  for (const track of [blue, redValidation, redSimulation]) {
    assert.deepEqual(track.map(lab => lab.tranche).sort(), [1, 2, 3, 4, 5]);
    for (const lab of track) {
      assert.deepEqual(replayLab(lab).findings, []);
      assert.equal(gradeLab(lab, replayLab(lab).sessions).passed, true);
      assert.ok(LAB_REGISTRY[`sandbox-${lab.id}`], `${lab.id} must have a Network Sandbox counterpart`);
    }
  }
  for (const lab of purpleSimulation) {
    assert.deepEqual(replayLab(lab).findings, []);
    assert.equal(gradeLab(lab, replayLab(lab).sessions).passed, true);
    assert.ok(LAB_REGISTRY[`sandbox-${lab.id}`], `${lab.id} must have a Network Sandbox counterpart`);
  }

  for (const lab of labs) {
    const attacker = lab.topology.devices.find(device => device.name === 'ATTACKER-KALI');
    assert.ok(attacker, `${lab.id} must include ATTACKER-KALI rather than an IOS assessment workstation`);
    assert.equal(attacker.terminal, 'attack', `${lab.id} must mark ATTACKER-KALI as an attack terminal`);
    const attackerSteps = lab.steps.filter(step => step.targetDevice === 'ATTACKER-KALI');
    assert.ok(attackerSteps.length > 0, `${lab.id} must include attacker-console evidence`);
    assert.ok(attackerSteps.every(step => step.requiredMode === 'shell'), `${lab.id} attacker steps must use the Linux shell mode`);
    assert.ok(attackerSteps.some(step => /^(nmap|python3|snmpwalk|snmpset|msfconsole|openssl|curl)/.test(step.expectedCommand)), `${lab.id} must use a supported Linux-shaped range command`);
    for (const step of lab.steps) {
      const device = lab.topology.devices.find(candidate => candidate.name === step.targetDevice);
      assert.ok(device, `${lab.id} step ${step.id} targets a missing device`);
      if (step.label.startsWith('Red Team:')) assert.equal(step.targetDevice, 'ATTACKER-KALI', `${lab.id} step ${step.id} labels IOS work as Red Team`);
      if (step.requiredMode === 'shell') {
        assert.equal(device.terminal, 'attack', `${lab.id} step ${step.id} runs shell syntax on IOS`);
        assert.equal(isAttackCommand(canonicalCommand(step.expectedCommand)), true, `${lab.id} step ${step.id} uses unsupported Linux syntax`);
      } else {
        assert.notEqual(device.terminal, 'attack', `${lab.id} step ${step.id} runs IOS syntax on ATTACKER-KALI`);
      }
      const alias = canonicalCommand(step.expectedCommand).match(/^nmap (?:-sv --version-light|-pn -p [0-9,]+) ([a-z0-9-]+)$/)?.[1];
      if (!alias) continue;
      const target = simulatedTargetById[alias];
      assert.ok(target, `${lab.id} step ${step.id} scans an unknown synthetic target`);
      const tcpServices = target.services?.filter(service => service.protocol === 'tcp') ?? [];
      assert.ok(tcpServices.length > 0, `${lab.id} target ${alias} has no modeled TCP service`);
      const requestedPorts = step.expectedCommand.match(/-p ([0-9,]+)/)?.[1].split(',').map(Number) ?? [];
      for (const port of requestedPorts) {
        assert.ok(tcpServices.some(service => service.port === port), `${lab.id} scans unmodeled TCP port ${port} on ${alias}`);
      }
      const targetNode = lab.topology.devices.find(candidate => candidate.name === target.name);
      assert.ok(targetNode, `${lab.id} step ${step.id} target ${target.name} is missing from the topology`);
      const cable = lab.topology.links.find(link => link.to === targetNode.id);
      assert.ok(cable, `${lab.id} target ${target.name} is not cabled`);
      const switchName = lab.topology.devices.find(candidate => candidate.id === cable.from)?.name;
      assert.ok(switchName, `${lab.id} target ${target.name} has no connected switch`);
      assert.equal(seedSessions(lab)[switchName].interfaces[cable.fromPort].accessVlan, target.vlan, `${lab.id} target VLAN is not configured on its cabled switch port`);
    }
  }
});

test('GLBP configuration records load sharing and forwarder state for operational evidence', () => {
  assert.equal(isCiscoCommand('glbp 10 load-balancing weighted', 'interface'), true);
  assert.equal(isCiscoCommand('glbp 10 forwarder 2', 'interface'), true);
  assert.equal(isCiscoCommand('glbp 10 weighting 85', 'interface'), true);
  let session = boot('CE-R1', 'Layer 3 routing device');
  for (const command of ['enable', 'configure terminal', 'interface g0/0', 'glbp 10 ip 10.20.10.1', 'glbp 10 priority 125', 'glbp 10 preempt', 'glbp 10 load-balancing weighted', 'glbp 10 forwarder 2', 'glbp 10 weighting 85']) session = applyCommand(session, command, []);
  const group = session.fhrpGroups['g0/0:GLBP:10'];
  assert.deepEqual(group, { protocol: 'GLBP', group: 10, virtualIp: '10.20.10.1', priority: 125, preempt: true, glbpLoadBalancing: 'weighted', glbpForwarder: 2, glbpWeight: 85 });
});

for (const lab of Object.values(techSupportLabs)) {
  test(`${lab.title}: guided and sandbox walkthroughs complete with real modeled evidence`, () => {
    assert.equal(lab.masterTranche, 4);
    assert.ok(lab.steps.length >= 30);
    assert.equal(gradeLab(lab, seedSessions(lab)).passed, false);
    assert.deepEqual(replayLab(lab).findings, []);
    assert.deepEqual(validateLab(lab).filter(f => f.severity === 'error'), []);
    const counterpart = LAB_REGISTRY[`sandbox-${lab.id}`];
    assert.equal(counterpart.masterTranche, 4);
    assert.equal(counterpart.tranche, lab.tranche);
    assert.deepEqual(counterpart.steps, lab.steps);
    for (const exercise of [lab, counterpart]) {
      const seeded = seedSessions(exercise);
      let sessions = Object.fromEntries(exercise.topology.devices.map(device => [device.id, seeded[device.name]]));
      const topology = { name: exercise.title, description: exercise.description, nodes: exercise.topology.devices, links: exercise.topology.links };
      for (const step of exercise.steps) {
        const node = topology.nodes.find(node => node.name === step.targetDevice)!;
        const result = executeNetworkCommand(node, topology, sessions, step.expectedCommand);
        assert.equal(result.accepted, true, `${exercise.id}: ${step.expectedCommand}`);
        sessions = result.sessions;
        if (step.expectedCommand.startsWith('ping ') && !/Reproduce/.test(step.label)) {
          assert.equal(tracePacket(node.id, step.expectedCommand.slice(5), topology, sessions).passed, true, `${exercise.id}: ${step.label}: ${result.output.join(' ')}`);
        }
        if (step.expectedCommand.startsWith('nslookup ')) assert.equal(sessions[node.id].dnsCache['intranet.office.example'], '10.40.2.10');
      }
      assert.equal(gradeLab(exercise, sessions).passed, true);
      if (lab.tranche === 2) {
        const employee = topology.nodes.find(node => node.name === 'HELP-PC1')!;
        assert.equal(sessions[employee.id].dhcpClient?.state, 'BOUND');
        assert.equal(sessions[employee.id].dhcpClient?.gateway, '10.40.2.1');
        assert.equal(sessions[employee.id].dhcpClient?.dns, '10.40.2.10');
      }
    }
  });
}

test('support management SVI respects VLAN isolation and interface configuration reports current state', () => {
  const lab = techSupportLabs['mt4-tr5-secure-remote-support'];
  const topology = { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links };
  const initial = seedSessions(lab);
  let sessions = Object.fromEntries(topology.nodes.map(node => [node.id, initial[node.name]]));
  assert.equal(tracePacket('endpoint-0', '10.40.5.2', topology, sessions).passed, false);
  for (const step of lab.steps) sessions = executeNetworkCommand(topology.nodes.find(node => node.name === step.targetDevice)!, topology, sessions, step.expectedCommand).sessions;
  assert.equal(tracePacket('endpoint-0', '10.40.5.2', topology, sessions).passed, true);
  const output = outputFor('show running-config interface vlan 10', topology.nodes[1], topology, sessions.switch, sessions).join('\n');
  assert.match(output, /ip address 10\.40\.5\.2 255\.255\.255\.0/);
  assert.match(output, /no shutdown/);
  sessions.switch = applyCommand(applyCommand(sessions.switch, 'configure terminal', []), 'interface g0/2', []);
  sessions.switch = applyCommand(sessions.switch, 'switchport access vlan 20', []);
  assert.equal(tracePacket('endpoint-0', '10.40.5.2', topology, sessions).passed, false, 'a management SVI must not bridge a different access VLAN');
});

for (const lab of Object.values(troubleshootingLabs)) {
  test(`${lab.title}: starts broken, completes repair and supports both session key formats`, () => {
    const initial = seedSessions(lab);
    assert.equal(gradeLab(lab, initial).passed, false);
    const final = replayLab(lab);
    assert.deepEqual(final.findings, []);
    assert.equal(gradeLab(lab, final.sessions).passed, true);
    const byId = Object.fromEntries(lab.topology.devices.map(device => [device.id, final.sessions[device.name]]));
    assert.equal(gradeLab(lab, byId).passed, true);
    assert.ok(configurationDiff(initial, final.sessions).length);
    assert.equal(gradeLab(lab, initial).passed, false, 'replay must not mutate checkpoint state');
    assert.deepEqual(validateLab(lab).filter(f => f.severity === 'error'), []);
  });
}
test('guided is the default learning mode for troubleshooting labs', () => {
  assert.equal(DEFAULT_LEARNING_MODE, 'guided');
});
test('OSPF evidence changes from area mismatch to FULL after repair', () => {
  const lab = troubleshootingLabs['mt5-tr5-repair-ospf'];
  assert.equal(protocolEvidence(lab, seedSessions(lab))[0].reason, 'Area mismatch');
  assert.equal(protocolEvidence(lab, replayLab(lab).sessions)[0].state, 'FULL');
});
test('OSPF neighbor discovery agrees with protocol evidence before repair and after shutdown', () => {
  const lab = troubleshootingLabs['mt5-tr5-repair-ospf'];
  const topology = { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links };
  const source = topology.nodes.find(node => node.name === 'CE-R1')!;
  const byId = (sessions: ReturnType<typeof seedSessions>) => Object.fromEntries(topology.nodes.map(node => [node.id, sessions[node.name]]));
  assert.deepEqual(ospfNeighbors(source, topology, byId(seedSessions(lab))), []);
  const repaired = byId(replayLab(lab).sessions);
  assert.equal(ospfNeighbors(source, topology, repaired)[0].state, 'FULL');
  repaired[source.id].interfaces['g0/0'].shutdown = true;
  assert.deepEqual(ospfNeighbors(source, topology, repaired), []);
});

test('OSPF operational evidence models the process, interfaces, neighbors, timers, events and LSDB', () => {
  const lab = troubleshootingLabs['mt5-tr5-repair-ospf'];
  const repaired = replayLab(lab).sessions;
  const node = lab.topology.devices.find(device => device.name === 'CE-R1')!;
  const topology = { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links };
  const byId = Object.fromEntries(lab.topology.devices.map(device => [device.id, repaired[device.name]]));
  const evidence = ospfOperationalEvidence(lab, repaired, node.name);
  assert.ok(evidence.processes.rows.length);
  assert.ok(evidence.areas.rows.length);
  assert.ok(evidence.interfaces.rows.length);
  assert.equal(evidence.neighbors.rows[0][5], 'FULL');
  assert.ok(evidence.database.rows.some(row => String(row[1]).includes('Router')));
  assert.ok(evidence.lsaSummary.rows.some(row => row[0] === 1 && Number(row[2]) >= 2));
  assert.ok(evidence.timers.rows.some(row => row[0] === 'SPF schedule'));
  assert.ok(evidence.capabilities.rows.some(row => row[0] === 'Opaque LSA' && row[1] === 'supported'));
  assert.ok(evidence.events.rows.some(row => String(row[2]).includes('SPF scheduled')));

  const database = outputFor('show ip ospf database', node, topology, byId[node.id], byId).join('\n');
  assert.match(database, /Link ID\s+ADV Router/);
  assert.match(database, /Router/);
  assert.match(database, /0x800000/);
  assert.doesNotMatch(database, /not simulated/);
  const process = outputFor('show ip ospf', node, topology, byId[node.id], byId).join('\n');
  assert.match(process, /Routing Process "ospf 1"/);
  assert.match(process, /Opaque LSA: supported/);
  assert.match(process, /SPF schedule:/);
  const interfaces = outputFor('show ip ospf interface brief', node, topology, byId[node.id], byId).join('\n');
  assert.match(interfaces, /Interface\s+PID\s+Area/);
  assert.match(interfaces, /g0\/0/);
});

test('OSPF interface commands update deterministic timers, authentication, events and SPF state', () => {
  let session = boot('CE-R1', 'router');
  for (const command of ['enable', 'configure terminal', 'router ospf 1', 'router-id 1.1.1.1', 'network 10.0.0.0 0.0.0.255 area 0', 'exit', 'interface g0/0', 'ip address 10.0.0.1 255.255.255.0', 'ip ospf hello-interval 5', 'ip ospf dead-interval 20', 'ip ospf retransmit-interval 3', 'ip ospf authentication message-digest', 'no shutdown']) session = applyCommand(session, command, []);
  assert.equal(session.interfaces['g0/0'].ospfHelloInterval, 5);
  assert.equal(session.interfaces['g0/0'].ospfDeadInterval, 20);
  assert.equal(session.interfaces['g0/0'].ospfRetransmitInterval, 3);
  assert.equal(session.interfaces['g0/0'].ospfAuthentication, 'message-digest');
  assert.ok((session.ospfProcesses['1'].spfExecutions || 0) >= 3);
  assert.ok(session.ospfProcesses['1'].eventLog?.some(event => event.event.includes('message-digest')));
});

test('OSPFv3 uses the shared process, interface, LSDB and CLI evidence model', () => {
  const lab = LAB_REGISTRY['tr3-ospfv3'];
  const replayed = replayLab(lab).sessions;
  const router = lab.topology.devices.find(device => device.name === 'CE-R1')!;
  const evidence = ospfOperationalEvidence(lab, replayed, router.name, 'ipv6');
  assert.equal(evidence.processes.rows[0][1], 'OSPFv3 / IPv6');
  assert.equal(evidence.interfaces.rows[0][0], 'g0/0');
  assert.equal(evidence.interfaces.rows[0][3], 'unassigned');
  assert.ok(evidence.database.rows.some(row => String(row[1]).includes('Router')));
  const topology = { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links };
  const byId = Object.fromEntries(lab.topology.devices.map(device => [device.id, replayed[device.name]]));
  assert.match(outputFor('show ipv6 ospf', router, topology, byId[router.id], byId).join('\n'), /OSPFv3 \/ IPv6/);
  assert.match(outputFor('show ipv6 ospf database', router, topology, byId[router.id], byId).join('\n'), /Router/);
});

test('VLAN brief reports access membership and excludes trunk ports', () => {
  const lab = troubleshootingLabs['mt5-tr2-repair-vlan'];
  const node = lab.topology.devices[0];
  let session = boot(node.name, node.role);
  for (const command of ['enable', 'configure terminal', 'vlan 50', 'name CCTV', 'exit', 'interface g0/1', 'switchport mode trunk', 'exit', 'interface g0/2', 'switchport mode access', 'switchport access vlan 50', 'end']) session = applyCommand(session, command, []);
  const topology = { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links };
  const output = outputFor('show vlan brief', node, topology, session).join('\n');
  assert.match(output, /50\s+CCTV\s+active\s+g0\/2/);
  assert.doesNotMatch(output, /g0\/1/);
});

test('DHCP expiration uses the actual lease boundary without inventing expiry', () => {
  const end = '2026-09-28T12:00:00.000Z';
  const lease = { state: 'BOUND', leaseEnd: end };
  assert.equal(leaseState(lease, Date.parse(end) - 1), 'BOUND');
  assert.equal(leaseState(lease, Date.parse(end)), 'EXPIRED');
  assert.equal(leaseState({ state: 'INIT' }), 'INIT');
});

test('LACP troubleshooting starts with an established multi-VLAN trunk and preserves it through repair', () => {
  const lab = troubleshootingLabs['mt5-tr4-repair-lacp'];
  const topology = { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links };
  const initial = seedSessions(lab);
  const byId = (named: ReturnType<typeof seedSessions>) => Object.fromEntries(topology.nodes.map(node => [node.id, named[node.name]]));
  let sessions = byId(initial);
  for (const name of ['CE-SW1', 'CE-SW2']) {
    assert.deepEqual(Object.keys(initial[name].vlans).sort(), ['10', '20', '99', '999']);
    assert.equal(initial[name].interfaces['g0/2'].switchportMode, 'trunk');
    assert.equal(initial[name].interfaces['g0/2'].nativeVlan, 999);
    assert.equal(initial[name].interfaces['g0/2'].allowedVlans, '10,20,99,999');
    assert.equal(initial[name].interfaces['port-channel 1'].switchportMode, 'trunk');
    assert.equal(initial[name].interfaces['g0/2'].channelMode, 'passive');
  }
  assert.equal(initial['CE-SW1'].interfaces['g0/3'].accessVlan, 10);
  assert.equal(initial['CE-SW2'].interfaces['g0/3'].accessVlan, 20);
  assert.equal(initial['CE-SRV1'].interfaces.eth0.ipv4[0], '10.20.4.11 255.255.255.0');
  assert.equal(tracePacket('sw1', '10.99.4.2', topology, sessions).passed, false);
  for (const step of lab.steps) {
    const node = topology.nodes.find(node => node.name === step.targetDevice)!;
    const result = executeNetworkCommand(node, topology, sessions, step.expectedCommand);
    assert.equal(result.accepted, true);
    sessions = result.sessions;
  }
  assert.equal(tracePacket('sw1', '10.99.4.2', topology, sessions).passed, true);
  assert.equal(gradeLab(lab, sessions).passed, true);
  for (const node of topology.nodes.filter(node => node.kind === 'switch')) {
    assert.deepEqual(sessions[node.id].vlans, initial[node.name].vlans);
    const output = outputFor('show vlan brief', node, topology, sessions[node.id], sessions).join('\n');
    assert.match(output, /10\s+engineering/i);
    assert.match(output, /20\s+services/i);
    assert.match(output, /99\s+management/i);
    assert.match(output, /999\s+native_unused/i);
  }
});

test('interface relationships distinguish trunk VLANs, management SVIs and suspended LACP', () => {
  const lab = troubleshootingLabs['mt5-tr4-repair-lacp'];
  const sessions = seedSessions(lab);
  const sw = sessions['CE-SW1'];
  const peers = protocolEvidence(lab, sessions);
  const member = interfaceRelationships(sw, 'g0/2', peers);
  assert.equal(member.parent, 'port-channel 1');
  assert.equal(member.vlan, '-');
  assert.equal(member.nativeVlan, 999);
  assert.equal(member.allowedVlans, '10,20,99,999');
  assert.equal(member.protocol, 'up');
  assert.equal(member.aggregation, 'SUSPENDED');
  const channel = interfaceRelationships(sw, 'port-channel 1', peers);
  assert.equal(channel.protocol, 'down');
  assert.equal(channel.admin, 'up');
  assert.equal(channel.aggregation, 'SUSPENDED');
  assert.match(evidenceOutput('show ip interface brief', sw, lab, sessions)!.find(line => line.startsWith('port-channel 1'))!, /up\s+down$/);
  const svi = interfaceRelationships(sw, 'vlan 99', peers);
  assert.equal(svi.vlan, 99);
  assert.equal(svi.role, 'management SVI');
  assert.equal(interfaceVlan(sw, 'vlan 99'), 99);
  assert.equal(interfaceRelationships(sw, 'g0/3', peers).vlan, 10);
  assert.equal(interfaceRelationships(sw, 'g0/1', peers).role, 'unused / unconfigured');
  assert.equal(interfaceRelationships(sw, 'g0/1', peers).admin, 'administratively down');
  for (const command of ['configure terminal', 'interface g0/2', 'channel-group 1 mode active', 'end']) sessions['CE-SW1'] = applyCommand(sessions['CE-SW1'], command, []);
  const repaired = interfaceRelationships(sessions['CE-SW1'], 'port-channel 1', protocolEvidence(lab, sessions));
  assert.equal(repaired.aggregation, 'BUNDLED');
  assert.equal(repaired.protocol, 'up');
  assert.match(evidenceOutput('show ip interface brief', sessions['CE-SW1'], lab, sessions)!.find(line => line.startsWith('port-channel 1'))!, /up\s+up$/);
});

test('LACP passive/passive cannot form a bundle', () => {
  const lab = troubleshootingLabs['mt5-tr4-repair-lacp'];
  assert.equal(protocolEvidence(lab, seedSessions(lab))[0].state, 'SUSPENDED');
  assert.equal(protocolEvidence(lab, replayLab(lab).sessions)[0].state, 'BUNDLED');
});

test('VLAN overlay derives endpoint membership and trunk permissions without claiming forwarding', () => {
  const lab = troubleshootingLabs['mt5-tr4-repair-lacp'];
  const topology = { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links };
  const named = seedSessions(lab);
  const sessions = Object.fromEntries(topology.nodes.map(node => [node.id, named[node.name]]));
  const sw1 = topology.nodes.find(node => node.name === 'CE-SW1')!;
  const ap = topology.nodes.find(node => node.name === 'CE-AP1')!;
  const server = topology.nodes.find(node => node.name === 'CE-SRV1')!;
  const wifi = topology.nodes.find(node => node.name === 'WIFI-PC1')!;
  let view = vlanOverlay(topology, sessions);
  assert.equal(view.portInfo(sw1.id, 'g0/3').vlan, 10);
  assert.equal(view.portInfo(ap.id, 'eth0').vlan, 10);
  assert.equal(view.portInfo(ap.id, 'eth0').inferred, true);
  assert.equal(view.portInfo(server.id, 'eth0').vlan, 20);
  assert.equal(view.portInfo(wifi.id, 'eth0').label, 'VLAN unknown');
  assert.equal(view.portInfo(sw1.id, 'g0/2').native, 999);
  assert.equal(view.portInfo(sw1.id, 'g0/2').matches(20), true);
  assert.equal(view.portInfo(sw1.id, 'g0/2').matches(50), false);
  const trunk = topology.links.find(link => link.fromPort === 'g0/2' && link.toPort === 'g0/2')!;
  assert.equal(view.linkMatches(trunk, 20), true);
  assert.equal(channelForwarding(sessions[trunk.from], trunk.fromPort, sessions[trunk.to], trunk.toPort).bundled, false);
  assert.equal(view.nodeMatches(server.id, 10), false);
  assert.deepEqual(view.vlanIds, [10, 20, 99, 999]);
  for (const command of ['configure terminal', 'interface g0/3', 'switchport access vlan 20', 'end']) sessions[sw1.id] = applyCommand(sessions[sw1.id], command, []);
  view = vlanOverlay(topology, sessions);
  assert.equal(view.portInfo(ap.id, 'eth0').vlan, 20);
  const removed = { ...topology, links: topology.links.filter(link => link.from !== ap.id && link.to !== ap.id) };
  assert.equal(vlanOverlay(removed, sessions).portInfo(ap.id, 'eth0').label, 'VLAN unknown');
  assert.equal(vlanOverlay(topology, named).portInfo(ap.id, 'eth0').vlan, 10);
});

test('port hover details identify the cabled peer separately from VLAN and channel state', () => {
  const topology = {
    nodes: [{ id: 'sw1', name: 'CE-SW1' }, { id: 'sw2', name: 'CE-SW2' }, { id: 'r1', name: 'CE-R1' }],
    links: [{ from: 'sw1', fromPort: 'g0/2', to: 'sw2', toPort: 'g0/4' }],
  } as Parameters<typeof cabledPeer>[0];
  const sessions = {
    sw1: { interfaces: { 'g0/2': { ipv4: [] } } },
    sw2: { interfaces: { 'g0/4': { ipv4: ['10.40.1.30 255.255.255.0'] } } },
    r1: { interfaces: { 'vlan 10': { ipv4: ['10.40.1.1 255.255.255.0'] } } },
  } as Parameters<typeof cabledPeerAddress>[1];
  assert.equal(cabledPeer(topology, 'sw1', 'g0/2'), 'CE-SW2 / g0/4');
  assert.equal(cabledPeer(topology, 'sw2', 'g0/4'), 'CE-SW1 / g0/2');
  assert.equal(cabledPeer(topology, 'sw1', 'g0/1'), 'Not cabled');
  assert.equal(cabledPeerAddress(topology, sessions, 'sw1', 'g0/2'), '10.40.1.30 255.255.255.0');
  assert.equal(cabledPeerMac(topology, 'sw1', 'g0/2'), modeledDeviceMac('sw2'));
  assert.equal(vlanSvi(topology, sessions, 10), 'CE-R1 / vlan 10 · 10.40.1.1 255.255.255.0');
  const trunk = portHoverContent('CE-SW1', 'g0/2', { kind: 'trunk', native: 999, allowed: '10,20,99,999', inferred: false, label: 'Trunk N999 / 10,20,99,999' }, 'Up', 'LACP suspended', cabledPeer(topology, 'sw1', 'g0/2'), { portIp: 'Unassigned', deviceMac: modeledDeviceMac('sw1'), cabledDeviceIp: cabledPeerAddress(topology, sessions, 'sw1', 'g0/2'), cabledDeviceMac: cabledPeerMac(topology, 'sw1', 'g0/2'), vlanSvi: vlanSvi(topology, sessions, 10) });
  assert.equal(trunk.title, 'CE-SW1 / g0/2');
  assert.deepEqual(trunk.details, [
    { label: 'Cabled to', value: 'CE-SW2 / g0/4' },
    { label: 'Port IP', value: 'Unassigned' },
    { label: 'Device MAC', value: modeledDeviceMac('sw1') },
    { label: 'Cabled device IP', value: '10.40.1.30 255.255.255.0' },
    { label: 'Cabled device MAC', value: modeledDeviceMac('sw2') },
    { label: 'Native VLAN', value: '999' },
    { label: 'Allowed VLANs', value: '10,20,99,999' },
    { label: 'VLAN SVI', value: 'CE-R1 / vlan 10 · 10.40.1.1 255.255.255.0' },
    { label: 'Port state', value: 'Up' },
    { label: 'EtherChannel', value: 'LACP suspended' },
  ]);
  const endpoint = portHoverContent('CE-AP1', 'eth0', { kind: 'endpoint', vlan: 10, inferred: true, label: 'VLAN 10 (inferred)' });
  assert.deepEqual(endpoint.details, [{ label: 'Cabled to', value: 'Not cabled' }, { label: 'Port IP', value: 'Unassigned' }, { label: 'Device MAC', value: 'Unavailable' }, { label: 'Membership', value: 'VLAN 10' }, { label: 'Source', value: 'Connected access port' }]);
});

test('a suspended EtherChannel cannot carry a modeled VLAN path', () => {
  const lab = troubleshootingLabs['mt5-tr4-repair-lacp'];
  const seeded = seedSessions(lab);
  const link = lab.topology.links.find(link => link.fromPort === 'g0/2' && link.toPort === 'g0/2')!;
  const left = lab.topology.devices.find(device => device.id === link.from)!;
  const right = lab.topology.devices.find(device => device.id === link.to)!;
  assert.equal(channelForwarding(seeded[left.name], link.fromPort, seeded[right.name], link.toPort).bundled, false);
  assert.ok(diagnosePath(lab, seeded, link.from, link.to, 1).hops.some(hop => hop.includes('EtherChannel is not bundled')));
});
test('trace identifies blocked VLAN and passes after trunk repair', () => {
  const lab = troubleshootingLabs['mt5-tr3-repair-trunk'];
  const source = lab.topology.devices.find(device => device.name === 'CE-SW1')!;
  const destination = lab.topology.devices.find(device => device.name === 'CE-SW2')!;
  const result = diagnosePath(lab, seedSessions(lab), source.id, destination.id, 10);
  assert.equal(result.passed, false);
  assert.ok(result.hops.some(hop => hop.includes('trunk blocks VLAN 10')));
  assert.equal(diagnosePath(lab, replayLab(lab).sessions, source.id, destination.id, 10).passed, true);
});
test('CLI and interface evidence agree on shutdown, aliases normalize', () => {
  const lab = troubleshootingLabs['mt5-tr1-repair-port'];
  const sessions = seedSessions(lab), session = sessions['CE-SW1'];
  assert.equal(interfaceEvidence(session, 'g0/1').protocol, 'down');
  assert.ok(evidenceOutput('show ip interface brief', session, lab, sessions)?.some(line => line.includes('administratively down')));
  assert.equal(canonicalCommand(' INT GigabitEthernet0/1 '), 'interface g0/1');
  const configured = applyCommand(applyCommand(session, 'configure terminal', []), 'interface g0/1', []);
  const repaired = applyCommand(configured, canonicalCommand('no shut'), []);
  assert.equal(interfaceEvidence(repaired, 'g0/1').protocol, 'up');
});

test('interface evidence reports Cisco-style address validity and assignment method', () => {
  let session = applyCommand(applyCommand(boot('SW1', 'switch'), 'configure terminal', []), 'interface g0/1', []);
  assert.deepEqual({ valid: interfaceEvidence(session, 'g0/1').valid, method: interfaceEvidence(session, 'g0/1').method }, { valid: 'YES', method: 'unset' });
  session = applyCommand(session, 'ip address 192.0.2.2 255.255.255.0', []);
  assert.equal(interfaceEvidence(session, 'g0/1').method, 'manual');
  session = applyCommand(session, 'ip address dhcp', []);
  assert.equal(interfaceEvidence(session, 'g0/1').method, 'DHCP');
  assert.ok(evidenceOutput('show ip interface brief', session, troubleshootingLabs['mt5-tr1-repair-port'], { 'CE-SW1': session })?.[0].includes('OK? Method'));
});

test('a repair can complete without following the authored sequence', () => {
  const lab = troubleshootingLabs['mt5-tr5-repair-ospf'];
  const seeded = seedSessions(lab);
  const first = lab.topology.devices.find(device => device.name === 'CE-R1')!;
  const second = lab.topology.devices.find(device => device.name === 'CE-R2')!;
  let sessions = { [first.id]: seeded['CE-R1'], [second.id]: seeded['CE-R2'] };
  const topology = { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links };
  for (const command of ['conf t', 'router ospf 1', 'network 10.0.0.0 0.0.0.3 area 0']) {
    const result = executeNetworkCommand(topology.nodes[0], topology, sessions, command);
    assert.equal(result.accepted, true);
    sessions = result.sessions as typeof sessions;
  }
  assert.equal(gradeLab(lab, sessions).passed, true);
  assert.equal(protocolEvidence(lab, sessions)[0].state, 'FULL');
  const passive = structuredClone(sessions);
  passive[first.id].ospfProcesses['1'].passiveInterfaces = ['default'];
  assert.equal(protocolEvidence(lab, passive)[0].state, 'DOWN');
  const duplicate = structuredClone(sessions);
  duplicate[first.id].ospfProcesses['1'].routerId = '2.2.2.2';
  assert.equal(protocolEvidence(lab, duplicate)[0].reason, 'Duplicate router ID');
  assert.equal(protocolEvidence(lab, sessions)[0].state, 'FULL');
});

test('trunk objectives accept equivalent VLAN list order and ranges', () => {
  const lab = troubleshootingLabs['mt5-tr3-repair-trunk'];
  const sessions = seedSessions(lab);
  sessions['CE-SW1'].interfaces['g0/2'].allowedVlans = '20,10-10';
  assert.equal(gradeLab(lab, sessions).passed, true);
  sessions['CE-SW1'].interfaces['g0/2'].allowedVlans = '20';
  assert.equal(gradeLab(lab, sessions).passed, false);
});

test('a blocked or unresolved ping never reports unconditional success', () => {
  const lab = troubleshootingLabs['mt5-tr5-repair-ospf'];
  const seeded = seedSessions(lab);
  const topology = { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links };
  const first = lab.topology.devices.find(device => device.name === 'CE-R1')!;
  const second = lab.topology.devices.find(device => device.name === 'CE-R2')!;
  let sessions = { [first.id]: seeded['CE-R1'], [second.id]: seeded['CE-R2'] };
  assert.equal(tracePacket(first.id, '203.0.113.99', topology, sessions).passed, false);
  sessions[second.id].interfaces['g0/0'].shutdown = true;
  const result = executeNetworkCommand(first, topology, sessions, 'ping 10.0.0.2');
  assert.ok(result.output.some(line => line.includes('BLOCKED')));
  assert.ok(!result.output.some(line => line.includes('100 percent')));
});

test('OSPF withdrawal removes stale routes and does not invent a remote connected route', () => {
  const lab = troubleshootingLabs['mt5-tr5-repair-ospf'];
  const ready = replayLab(lab).sessions;
  const topology = { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links };
  let peer = ready['CE-R2'];
  for (const command of ['configure terminal', 'interface loopback0', 'ip address 192.0.2.2 255.255.255.255', 'no shutdown', 'exit', 'router ospf 1', 'network 192.0.2.2 0.0.0.0 area 0', 'end']) peer = applyCommand(peer, command, []);
  const first = lab.topology.devices.find(device => device.name === 'CE-R1')!;
  const second = lab.topology.devices.find(device => device.name === 'CE-R2')!;
  const learned = reconcileOspfRoutes(topology, { [first.id]: ready['CE-R1'], [second.id]: peer });
  assert.ok(learned[first.id].routingTable.some(route => route.prefix === '192.0.2.2/32'));
  assert.ok(!learned[first.id].routingTable.some(route => route.protocol === 'ospf' && route.prefix === '10.0.0.0/30'));
  learned[second.id] = { ...learned[second.id], interfaces: { ...learned[second.id].interfaces, 'g0/0': { ...learned[second.id].interfaces['g0/0'], shutdown: true } } };
  assert.equal(reconcileOspfRoutes(topology, learned)[first.id].routingTable.filter(route => route.protocol === 'ospf').length, 0);
});

test('verification commands describe modeled route and trunk state accurately', () => {
  const lab = troubleshootingLabs['mt5-tr3-repair-trunk'];
  const seeded = seedSessions(lab);
  const topology = { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links };
  seeded['CE-SW1'].routingTable = [
    { prefix: '10.0.0.0/24', protocol: 'connected', interface: 'g0/1' },
    { prefix: '198.51.100.0/24', protocol: 'static', nextHop: '10.0.0.2', interface: 'g0/1' },
  ];
  seeded['CE-SW1'].interfaces['g0/1'] = { ...seeded['CE-SW1'].interfaces['g0/1'], ipv4: ['10.0.0.1 255.255.255.0'], shutdown: false };
  seeded['CE-SW1'].interfaces['g0/2'] = {
    ...seeded['CE-SW1'].interfaces['g0/2'],
    switchportMode: 'trunk',
    shutdown: true,
  };
  // A Layer 2 switch has no IP routing table to display, even with a
  // seeded routingTable entry or a management address on an interface.
  // (ipv4Routes itself still returns local connected routes for
  // forwarding — hosts and L2 switches need those to originate traffic.)
  const l2Routes = outputFor('show ip route', topology.nodes[0], topology, seeded['CE-SW1'], { a: seeded['CE-SW1'], b: seeded['CE-SW2'] });
  assert.ok(l2Routes.some(line => line.includes('No modeled IP routing table')));
  assert.ok(!l2Routes.some(line => line.startsWith('C    ') || line.startsWith('S    ')));
  // The same session on a routed device reports its configured routes.
  const routerNode = { id: 'r1', name: 'CE-R1', kind: 'router' as const, role: 'Router', x: 0, y: 0, ports: ['g0/1'] };
  const routes = outputFor('show ip route', routerNode, topology, seeded['CE-SW1'], { a: seeded['CE-SW1'], b: seeded['CE-SW2'] });
  assert.ok(routes.some(line => line.startsWith('C    10.0.0.0/24 is directly connected')));
  assert.ok(routes.some(line => line.startsWith('S    198.51.100.0/24 via 10.0.0.2')));
  // An OSPF entry with no local OSPF process is not a learned route.
  const unlearned = { ...seeded['CE-SW1'], ospfProcesses: {}, routingTable: [{ prefix: '10.1.0.0/24', protocol: 'ospf' as const, nextHop: '10.0.0.2', interface: 'g0/1' }] };
  assert.ok(!ipv4Routes(unlearned).some(route => route.protocol === 'ospf'));
  const trunks = outputFor('show interfaces trunk', topology.nodes[0], topology, seeded['CE-SW1'], { a: seeded['CE-SW1'], b: seeded['CE-SW2'] });
  assert.ok(trunks.some(line => line.includes('not-trunking')));
});

test('show cdp neighbors renders IOS-format topology-backed neighbor entries', () => {
  const topology = {
    name: 'CDP', description: '',
    nodes: [
      { id: 'sw1', name: 'CE-SW1', kind: 'switch' as const, role: 'Layer 2 Switch', x: 0, y: 0, ports: ['g0/1', 'g0/2'] },
      { id: 'sw2', name: 'CE-SW2', kind: 'switch' as const, role: 'Layer 2 Switch', x: 1, y: 0, ports: ['g0/1', 'g0/2'] },
      { id: 'r1', name: 'CE-R1', kind: 'router' as const, role: 'Router', x: 2, y: 0, ports: ['g0/0'] },
      { id: 'pc1', name: 'PC1', kind: 'pc' as const, role: 'Host', x: 3, y: 0, ports: ['eth0'] },
    ],
    links: [
      { id: 'l1', from: 'sw1', fromPort: 'g0/1', to: 'sw2', toPort: 'g0/1' },
      { id: 'l2', from: 'sw1', fromPort: 'g0/2', to: 'r1', toPort: 'g0/0' },
      { id: 'l3', from: 'sw2', fromPort: 'g0/2', to: 'pc1', toPort: 'eth0' },
    ],
  };
  const sessions = { sw1: boot('CE-SW1', 'Layer 2 Switch'), sw2: boot('CE-SW2', 'Layer 2 Switch'), r1: boot('CE-R1', 'Router'), pc1: boot('PC1', 'Host') };
  const output = outputFor('show cdp neighbors', topology.nodes[0], topology, sessions.sw1, sessions);
  assert.ok(output.some(line => line.startsWith('Capability Codes:')));
  assert.ok(output.some(line => line.includes('Device ID') && line.includes('Local Intrfce')));
  assert.ok(output.some(line => line.startsWith('CE-SW2') && line.includes('Gig 0/1') && line.includes('Catalyst 2960')));
  assert.ok(output.some(line => line.startsWith('CE-R1') && line.includes('Gig 0/2') && line.includes('Cisco ISR')));
  assert.ok(output.some(line => line.includes('Total cdp entries displayed : 2')));
  // A PC is not CDP-capable, so it never appears as a neighbor, even linked.
  assert.ok(!output.some(line => line.includes('PC1')));
  // Interface filter narrows to one link; detail shows the neighbor block.
  const filtered = outputFor('show cdp neighbors g0/2', topology.nodes[0], topology, sessions.sw1, sessions);
  assert.ok(filtered.some(line => line.includes('Total cdp entries displayed : 1')));
  assert.ok(filtered.some(line => line.startsWith('CE-R1')));
  assert.ok(!filtered.some(line => line.startsWith('CE-SW2')));
  const detail = outputFor('show cdp neighbors detail', topology.nodes[0], topology, sessions.sw1, sessions);
  assert.ok(detail.some(line => line.includes('Device ID: CE-SW2')));
  assert.ok(detail.some(line => line.includes('Platform: Catalyst 2960')));
  assert.ok(detail.some(line => line.includes('Interface: GigabitEthernet0/1')));
  assert.ok(detail.some(line => line.includes('Holdtime : 180 sec')));
  // An unknown interface is an error, and a PC does not run CDP.
  assert.ok(outputFor('show cdp neighbors g0/9', topology.nodes[0], topology, sessions.sw1, sessions).some(line => line.includes('does not exist')));
  assert.ok(outputFor('show cdp neighbors', topology.nodes[3], topology, sessions.pc1, sessions).some(line => line.includes('not available')));
});

test('show etherchannel renders IOS summary, detail, port, protocol, load-balance, and auto output', () => {
  const configure = (name: string, members: Array<[string, 'active' | 'passive' | 'on']>) => {
    let session = applyCommand(boot(name, 'Layer 2 Switch'), 'enable', []);
    session = applyCommand(session, 'configure terminal', []);
    for (const [port, mode] of members) {
      session = applyCommand(session, `interface ${port}`, []);
      session = applyCommand(session, `channel-group 1 mode ${mode}`, []);
      session = applyCommand(session, 'no shutdown', []);
      session = applyCommand(session, 'exit', []);
    }
    return session;
  };
  const topology = {
    name: 'EtherChannel', description: '',
    nodes: [
      { id: 'sw1', name: 'CE-SW1', kind: 'switch' as const, role: 'Layer 2 Switch', x: 0, y: 0, ports: ['g0/1', 'g0/2', 'g0/3'] },
      { id: 'sw2', name: 'CE-SW2', kind: 'switch' as const, role: 'Layer 2 Switch', x: 1, y: 0, ports: ['g0/1', 'g0/2'] },
      { id: 'r1', name: 'CE-R1', kind: 'router' as const, role: 'Router', x: 2, y: 0, ports: ['g0/0'] },
    ],
    links: [
      { id: 'l1', from: 'sw1', fromPort: 'g0/1', to: 'sw2', toPort: 'g0/1' },
      { id: 'l2', from: 'sw1', fromPort: 'g0/2', to: 'sw2', toPort: 'g0/2' },
    ],
  };
  // g0/3 has a configured member with no peer link, so it stays suspended.
  const sw1 = configure('CE-SW1', [['g0/1', 'active'], ['g0/2', 'active'], ['g0/3', 'active']]);
  const sw2 = configure('CE-SW2', [['g0/1', 'passive'], ['g0/2', 'passive']]);
  const sessions = { sw1, sw2, r1: boot('CE-R1', 'Router') };
  const summary = outputFor('show etherchannel summary', topology.nodes[0], topology, sessions.sw1, sessions);
  assert.ok(summary.some(line => line.startsWith('Flags:') && line.includes('P - bundled in port-channel')));
  assert.ok(summary.some(line => line.includes('Number of channel-groups in use: 1')));
  assert.ok(summary.some(line => line.includes('Number of aggregators:') && line.endsWith('1')));
  assert.ok(summary.some(line => line.includes('Group') && line.includes('Port-channel') && line.includes('Protocol') && line.includes('Ports')));
  assert.ok(summary.some(line => line.includes('Po1(SU)') && line.includes('LACP') && line.includes('Gi0/1(P)') && line.includes('Gi0/2(P)') && line.includes('Gi0/3(s)')));
  // One group alone renders the same table, filtered; an unknown group errors.
  assert.ok(outputFor('show etherchannel 1', topology.nodes[0], topology, sessions.sw1, sessions).some(line => line.includes('Po1(SU)')));
  assert.ok(outputFor('show etherchannel 2', topology.nodes[0], topology, sessions.sw1, sessions).some(line => line.includes('Channel-group 2 is not configured')));
  assert.ok(outputFor('show etherchannel 1 summary', topology.nodes[0], topology, sessions.sw1, sessions).some(line => line.includes('Po1(SU)')));
  // Detail names the member states and the modeled negotiation evidence.
  const detail = outputFor('show etherchannel detail', topology.nodes[0], topology, sessions.sw1, sessions);
  assert.ok(detail.some(line => line.includes('Channel-group 1 detail')));
  assert.ok(detail.some(line => line.includes('Gi0/1 (P)') && line.includes('Active/passive negotiation is compatible')));
  assert.ok(detail.some(line => line.includes('Gi0/3 (s)') && line.includes('No modeled peer member')));
  assert.ok(detail.some(line => line.includes('not modeled')));
  // Port narrows to one member; port-channel and protocol report the group.
  const port = outputFor('show etherchannel port g0/3', topology.nodes[0], topology, sessions.sw1, sessions);
  assert.ok(port.some(line => line.includes('Port: Gi0/3')));
  assert.ok(port.some(line => line.includes('Port state: Up, suspended (s)')));
  assert.ok(!port.some(line => line.includes('Port: Gi0/1')));
  assert.ok(outputFor('show etherchannel port g0/9', topology.nodes[0], topology, sessions.sw1, sessions).some(line => line.includes('does not exist')));
  const portChannel = outputFor('show etherchannel port-channel', topology.nodes[0], topology, sessions.sw1, sessions);
  assert.ok(portChannel.some(line => line.includes('Port-channel: Po1(SU)')));
  assert.ok(portChannel.some(line => line.includes('Bundle state: BUNDLED')));
  const protocol = outputFor('show etherchannel protocol', topology.nodes[0], topology, sessions.sw1, sessions);
  assert.ok(protocol.some(line => line.startsWith('1') && line.includes('LACP')));
  assert.ok(protocol.some(line => line.includes('PAgP is not modeled')));
  // Load-balance shows the modeled default, auto reports Auto LAG as unmodeled.
  const loadBalance = outputFor('show etherchannel load-balance', topology.nodes[0], topology, sessions.sw1, sessions);
  assert.ok(loadBalance.some(line => line.includes('src-mac')));
  assert.ok(loadBalance.some(line => line.includes('not configurable')));
  assert.ok(outputFor('show etherchannel auto', topology.nodes[0], topology, sessions.sw1, sessions).some(line => line.includes('No auto-formed EtherChannels')));
  // A router does not run EtherChannel in the capability matrix.
  assert.ok(outputFor('show etherchannel summary', topology.nodes[2], topology, sessions.r1, sessions).some(line => line.includes('not available')));
  // A switch with no members still renders the IOS summary shape with zero counts.
  const freshSw2 = boot('CE-SW2', 'Layer 2 Switch');
  const empty = outputFor('show etherchannel summary', topology.nodes[1], topology, freshSw2, { ...sessions, sw2: freshSw2 });
  assert.ok(empty.some(line => line.includes('Number of channel-groups in use: 0')));
});

test('trunk VLAN add and remove mutate the modeled allowed set', () => {
  let session = applyCommand(applyCommand(boot('SW1', 'switch'), 'enable', []), 'configure terminal', []);
  session = applyCommand(session, 'interface g0/1', []);
  session = applyCommand(session, 'switchport trunk allowed vlan remove 50', []);
  assert.ok(!vlanSet(session.interfaces['g0/1'].allowedVlans || 'all').includes(50));
  session = applyCommand(session, 'switchport trunk allowed vlan add 50', []);
  assert.equal(session.interfaces['g0/1'].allowedVlans, undefined);
});

test('packet diagnostics reject a route whose next hop is not on the modeled egress', () => {
  const configure = (name: string, interfaces: Array<[string, string]>) => {
    let session = applyCommand(boot(name, 'router'), 'enable', []);
    session = applyCommand(session, 'configure terminal', []);
    for (const [port, address] of interfaces) {
      session = applyCommand(session, `interface ${port}`, []);
      session = applyCommand(session, `ip address ${address} 255.255.255.252`, []);
      session = applyCommand(session, 'no shutdown', []);
      session = applyCommand(session, 'exit', []);
    }
    return session;
  };
  const topology = {
    name: 'Next hop guard', description: 'Regression topology',
    nodes: [
      { id: 'r1', name: 'R1', kind: 'router' as const, role: 'Layer 3', x: 0, y: 0, ports: ['g0/0'] },
      { id: 'r2', name: 'R2', kind: 'router' as const, role: 'Layer 3', x: 1, y: 0, ports: ['g0/0', 'g0/1'] },
      { id: 'r3', name: 'R3', kind: 'router' as const, role: 'Layer 3', x: 2, y: 0, ports: ['g0/0', 'g0/1'] },
    ],
    links: [
      { id: 'r1-r2', from: 'r1', fromPort: 'g0/0', to: 'r2', toPort: 'g0/0' },
      { id: 'r2-r3', from: 'r2', fromPort: 'g0/1', to: 'r3', toPort: 'g0/0' },
    ],
  };
  const r1 = configure('R1', [['g0/0', '10.0.0.1']]);
  const r2 = configure('R2', [['g0/0', '10.0.0.2'], ['g0/1', '10.0.0.5']]);
  const r3 = configure('R3', [['g0/0', '10.0.0.6'], ['g0/1', '192.0.2.3']]);
  r1.routingTable = [{ prefix: '192.0.2.0/30', nextHop: '10.0.0.2', interface: 'g0/0', protocol: 'static' }];
  r2.routingTable = [{ prefix: '192.0.2.0/30', nextHop: '10.0.0.99', interface: 'g0/1', protocol: 'static' }];
  const result = tracePacket('r1', '192.0.2.3', topology, { r1, r2, r3 });
  assert.equal(result.passed, false);
  assert.match(result.summary, /next hop 10\.0\.0\.99 is not a reachable modeled neighbor/);
});

test('packet diagnostics reject a local destination address on a disabled interface', () => {
  let session = boot('R1', 'router');
  for (const command of ['enable', 'configure terminal', 'interface g0/0', 'ip address 10.0.0.1 255.255.255.0', 'no shutdown', 'exit', 'interface g0/1', 'ip address 192.0.2.1 255.255.255.0', 'shutdown', 'end']) session = applyCommand(session, command, []);
  const topology = { name: 'Local probe', description: '', nodes: [{ id: 'r1', name: 'R1', kind: 'router' as const, role: 'Router', x: 0, y: 0, ports: ['g0/0', 'g0/1'] }], links: [] };
  const result = tracePacket('r1', '192.0.2.1', topology, { r1: session });
  assert.equal(result.passed, false);
  assert.match(result.summary, /destination address .* disabled interface/);
  assert.equal(tracePacket('r1', '10.0.0.1', topology, { r1: session }).passed, true);
});

test('packet diagnostics infer a shared access VLAN without node VLAN metadata', () => {
  const topology = { name: 'VLAN 20 hosts', description: '', nodes: [
    { id: 'a', name: 'A', kind: 'pc' as const, role: 'Host', x: 0, y: 0, ports: ['eth0'] },
    { id: 'sw', name: 'SW', kind: 'switch' as const, role: 'Layer 2', x: 1, y: 0, ports: ['g0/1', 'g0/2'] },
    { id: 'b', name: 'B', kind: 'pc' as const, role: 'Host', x: 2, y: 0, ports: ['eth0'] },
  ], links: [
    { id: 'a-sw', from: 'a', fromPort: 'eth0', to: 'sw', toPort: 'g0/1' },
    { id: 'sw-b', from: 'sw', fromPort: 'g0/2', to: 'b', toPort: 'eth0' },
  ] };
  const configure = (name: string, commands: string[]) => commands.reduce((session, command) => applyCommand(session, command, []), boot(name, 'Lab device'));
  const a = configure('A', ['enable', 'configure terminal', 'interface eth0', 'ip address 192.0.2.1 255.255.255.0', 'no shutdown', 'end']);
  const b = configure('B', ['enable', 'configure terminal', 'interface eth0', 'ip address 192.0.2.2 255.255.255.0', 'no shutdown', 'end']);
  const sw = configure('SW', ['enable', 'configure terminal', 'vlan 20', 'exit', 'interface g0/1', 'switchport mode access', 'switchport access vlan 20', 'no shutdown', 'exit', 'interface g0/2', 'switchport mode access', 'switchport access vlan 20', 'no shutdown', 'end']);
  assert.equal(tracePacket('a', '192.0.2.2', topology, { a, b, sw }).passed, true);
});

function routedFixture() {
  const topology = { name: 'Routed checks', description: '', nodes: ['r1', 'r2', 'r3'].map((id, index) => ({ id, name: id.toUpperCase(), kind: 'router' as const, role: 'Layer 3', x: index, y: 0, ports: ['g0/0', 'g0/1'] })), links: [
    { id: 'one', from: 'r1', fromPort: 'g0/0', to: 'r2', toPort: 'g0/0' },
    { id: 'two', from: 'r2', fromPort: 'g0/1', to: 'r3', toPort: 'g0/0' },
  ] };
  const configure = (name: string, addresses: string[]) => {
    let session = boot(name, 'router');
    for (const command of ['enable', 'configure terminal', ...addresses.flatMap((address, i) => [`interface g0/${i}`, `ip address ${address} 255.255.255.252`, 'no shutdown', 'exit']), 'end']) session = applyCommand(session, command, []);
    return session;
  };
  const sessions = { r1: configure('R1', ['10.0.0.1']), r2: configure('R2', ['10.0.0.2', '10.0.0.5']), r3: configure('R3', ['10.0.0.6', '192.0.2.1']) };
  sessions.r1.routingTable.push({ prefix: '192.0.2.0/30', nextHop: '10.0.0.2', protocol: 'static' });
  sessions.r2.routingTable.push({ prefix: '192.0.2.0/30', nextHop: '10.0.0.6', protocol: 'static' });
  return { topology, sessions };
}

test('a reachable forward path fails without a return route and passes after repair', () => {
  const { topology, sessions } = routedFixture();
  assert.match(tracePacket('r1', '192.0.2.1', topology, sessions).summary, /Return path failed/);
  sessions.r3.routingTable.push({ prefix: '10.0.0.0/30', nextHop: '10.0.0.5', protocol: 'static' });
  assert.equal(tracePacket('r1', '192.0.2.1', topology, sessions).passed, true);
});

test('routing loops fail without reporting packet delivery', () => {
  const { topology, sessions } = routedFixture();
  sessions.r2.routingTable[0].nextHop = '10.0.0.1';
  assert.match(tracePacket('r1', '192.0.2.1', topology, sessions).summary, /ROUTING_LOOP/);
});

test('longest prefix wins over a wrong default route', () => {
  const { topology, sessions } = routedFixture();
  sessions.r1.routingTable.unshift({ prefix: '0.0.0.0/0', nextHop: '203.0.113.99', protocol: 'static' });
  sessions.r3.routingTable.push({ prefix: '10.0.0.0/30', nextHop: '10.0.0.5', protocol: 'static' });
  assert.equal(tracePacket('r1', '192.0.2.1', topology, sessions).passed, true);
});

test('ordered numbered and named ACLs enforce ICMP policy and implicit deny', () => {
  let session = boot('R', 'router');
  for (const command of ['enable', 'configure terminal', 'access-list 10 deny host 10.0.0.1', 'access-list 10 permit any', 'interface g0/0', 'ip access-group 10 in', 'exit', 'ip access-list extended REPLY', 'permit icmp host 192.0.2.1 host 10.0.0.1', 'exit', 'interface g0/1', 'ip access-group REPLY out', 'end']) session = applyCommand(session, command, []);
  assert.equal(evaluateInterfaceAcl(session, 'g0/0', 'in', '10.0.0.1', '192.0.2.1').allowed, false);
  assert.equal(evaluateInterfaceAcl(session, 'g0/0', 'in', '10.0.0.2', '192.0.2.1').allowed, true);
  assert.equal(evaluateInterfaceAcl(session, 'g0/1', 'out', '192.0.2.1', '10.0.0.1').allowed, true);
  assert.match(evaluateInterfaceAcl(session, 'g0/1', 'out', '192.0.2.2', '10.0.0.1').reason, /implicit deny/);
});

test('return-path ACL denies are visible and failed probes do not invent ARP entries', () => {
  const { topology, sessions } = routedFixture();
  sessions.r3.routingTable.push({ prefix: '10.0.0.0/30', nextHop: '10.0.0.5', protocol: 'static' });
  let r2 = sessions.r2;
  for (const command of ['configure terminal', 'access-list 10 deny host 192.0.2.1', 'access-list 10 permit any', 'interface g0/1', 'ip access-group 10 in', 'end']) r2 = applyCommand(r2, command, []);
  sessions.r2 = r2;
  const result = tracePacket('r1', '192.0.2.1', topology, sessions);
  assert.match(result.summary, /Return path failed: R2: ACL 10: deny/);
  const command = executeNetworkCommand(topology.nodes[0], topology, sessions, 'ping 192.0.2.1');
  assert.deepEqual(command.sessions.r1.arpTable, sessions.r1.arpTable);
  assert.ok(command.output.join('\n').includes('Return path failed'));
});

test('passive-interface is recorded on a newly configured OSPF process', () => {
  let session = boot('R1', 'router');
  for (const command of ['enable', 'configure terminal', 'router ospf 1', 'passive-interface g0/0']) session = applyCommand(session, command, []);
  assert.deepEqual(session.ospfProcesses['1'].passiveInterfaces, ['g0/0']);
});

test('OSPF selects lower interface cost and recomputes after link loss', () => {
  const { topology, sessions } = routedFixture();
  topology.links.push({ id: 'shortcut', from: 'r1', fromPort: 'g0/1', to: 'r3', toPort: 'g0/1' });
  for (const [id, address] of [['r1', '10.0.1.1'], ['r3', '10.0.1.2']] as const) {
    for (const command of ['configure terminal', 'interface g0/1', `ip address ${address} 255.255.255.252`, 'ip ospf cost 50', 'no shutdown', 'end']) sessions[id] = applyCommand(sessions[id], command, []);
  }
  for (const [index, id] of ['r1', 'r2', 'r3'].entries()) {
    const key = id as keyof typeof sessions;
    sessions[key].routingTable = [];
    for (const command of ['configure terminal', 'router ospf 1', `router-id ${index + 1}.${index + 1}.${index + 1}.${index + 1}`, 'network 10.0.0.0 0.0.255.255 area 0', 'end']) sessions[key] = applyCommand(sessions[key], command, []);
  }
  let routes = reconcileOspfRoutes(topology, sessions);
  assert.equal(routes.r1.routingTable.find(route => route.prefix === '10.0.0.4/30')?.nextHop, '10.0.0.2');
  sessions.r1.interfaces['g0/0'].shutdown = true;
  routes = reconcileOspfRoutes(topology, sessions);
  assert.equal(routes.r1.routingTable.find(route => route.prefix === '10.0.0.4/30')?.nextHop, '10.0.1.2');
});

test('DR election uses numeric router IDs and excludes disabled candidates', () => {
  const { topology, sessions } = routedFixture();
  for (const [id, routerId] of [['r1', '9.9.9.9'], ['r2', '10.10.10.10']] as const) {
    sessions[id].ospfProcesses['1'] = { id: 1, routerId, networks: [{ network: '10.0.0.0', wildcard: '0.0.0.3', area: 0 }] };
  }
  const lab = { topology: { devices: topology.nodes, links: topology.links } } as Parameters<typeof electionEvidence>[0];
  assert.equal(electionEvidence(lab, sessions).find(row => row.device === 'R2')?.role, 'DR');
  sessions.r2.interfaces['g0/0'].shutdown = true;
  assert.equal(electionEvidence(lab, sessions).find(row => row.device === 'R1')?.role, 'DR');
});

test('Silent Access Port exposes healthy endpoint MACs before repair and workstation learning after repair', () => {
  const lab = troubleshootingLabs['mt5-tr1-repair-port'];
  const topology = { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links };
  const seed = seedSessions(lab);
  let sessions = Object.fromEntries(topology.nodes.map(node => [node.id, seed[node.name]]));
  sessions = executeNetworkCommand(topology.nodes[0], topology, sessions, 'show mac address-table').sessions;
  assert.ok(sessions.sw1.macTable.some(entry => entry.mac === modeledDeviceMac('phone') && entry.port === 'g0/3'));
  assert.ok(sessions.sw1.macTable.some(entry => entry.mac === modeledDeviceMac('camera') && entry.port === 'g0/2'));
  assert.ok(!sessions.sw1.macTable.some(entry => entry.mac === modeledDeviceMac('eng')));
  for (const command of ['configure terminal', 'interface g0/1', 'no shutdown', 'end']) sessions = executeNetworkCommand(topology.nodes[0], topology, sessions, command).sessions;
  assert.ok(sessions.sw1.macTable.some(entry => entry.mac === modeledDeviceMac('eng') && entry.port === 'g0/1'));
  assert.ok(outputFor('show mac address-table', topology.nodes[0], topology, sessions.sw1, sessions).join('\n').includes(modeledDeviceMac('eng')));
  for (const command of ['configure terminal', 'interface g0/1', 'shutdown', 'end']) sessions = executeNetworkCommand(topology.nodes[0], topology, sessions, command).sessions;
  assert.ok(!sessions.sw1.macTable.some(entry => entry.mac === modeledDeviceMac('eng')));
});

test('Cisco IOS rejects attack tools while ATTACKER-KALI sees the shared ACL result', () => {
  const lab = ethicalHackingLabs['mt6-tr5-purple-container-runtime-boundary'];
  const sessions = seedSessions(lab);
  const scan = 'nmap -pn -p 8443 container-api-1';
  assert.equal(isCiscoCommand(scan, 'privileged'), false);

  const initial = executeAttackCommand(sessions['ATTACKER-KALI'], scan, sessions);
  assert.equal(initial.accepted, true);
  assert.match(initial.output.join('\n'), /open/);
  sessions['ATTACKER-KALI'] = initial.session;

  const remediationStart = lab.steps.findIndex(step => step.label === 'Blue Team: enter container-service hardening');
  const retest = lab.steps.findIndex(step => step.label === 'Red Team: verify the filtered result');
  for (const step of lab.steps.slice(remediationStart, retest)) {
    if (step.targetDevice !== 'CE-R1') continue;
    const current = sessions['CE-R1'];
    sessions['CE-R1'] = applyCommand(current, canonicalCommand(step.expectedCommand), current.history);
  }
  const filtered = executeAttackCommand(sessions['ATTACKER-KALI'], scan, sessions);
  assert.equal(filtered.accepted, true);
  assert.match(filtered.output.join('\n'), /filtered/);
});

test('synthetic container runtime models TLS, authorization, throttling, sockets, and audit evidence', () => {
  const lab = ethicalHackingLabs['mt6-tr5-purple-container-runtime-boundary'];
  const sessions = seedSessions(lab);

  let result = executeAttackCommand(
    sessions['ATTACKER-KALI'],
    'openssl s_client -connect container-api-1:8443',
    sessions,
  );
  assert.match(result.output.join('\n'), /handshake failure/);
  sessions['ATTACKER-KALI'] = result.session;

  let router = sessions['CE-R1'];
  for (const command of [
    'configure terminal',
    'ip http secure-server',
    'ip http authentication token-required',
    'ip http rate-limit 2',
  ]) router = applyCommand(router, command, router.history);
  sessions['CE-R1'] = router;

  result = executeAttackCommand(
    sessions['ATTACKER-KALI'],
    'openssl s_client -connect container-api-1:8443',
    sessions,
  );
  assert.match(result.output.join('\n'), /TLSv1\.3/);
  sessions['ATTACKER-KALI'] = result.session;

  result = executeAttackCommand(
    sessions['ATTACKER-KALI'],
    'curl -ss https://container-api-1:8443/api/status',
    sessions,
  );
  assert.match(result.output.join('\n'), /401 Unauthorized/);
  sessions['ATTACKER-KALI'] = result.session;

  result = executeAttackCommand(
    sessions['ATTACKER-KALI'],
    'for i in {1..100}; do curl -ss -h "authorization: bearer training-token" https://container-api-1:8443/api/status; done',
    sessions,
  );
  assert.match(result.output.join('\n'), /429 Too Many Requests/);
  sessions['ATTACKER-KALI'] = result.session;

  const sockets = executeAttackCommand(sessions['ATTACKER-KALI'], 'ss -tnlp', sessions);
  assert.match(sockets.output.join('\n'), /LISTEN/);
  const journal = executeAttackCommand(sockets.session, 'journalctl -u container-api-1 --no-pager', sessions);
  assert.match(journal.output.join('\n'), /(TLS handshake|Bearer token|rate limit)/);
  const kernel = executeAttackCommand(journal.session, 'cat /proc/self/status', sessions);
  assert.match(kernel.output.join('\n'), /Seccomp/);
  assert.match(kernel.output.join('\n'), /Namespaces/);
});

test('VTP propagates the VLAN database by revision and blocks mismatched domains, passwords, and versions', () => {
  const topology = {
    name: 'VTP', description: '',
    nodes: [
      { id: 'sw1', name: 'CE-SW1', kind: 'switch' as const, role: 'VTP Server', x: 0, y: 0, ports: ['g0/1'] },
      { id: 'sw2', name: 'CE-SW2', kind: 'switch' as const, role: 'VTP Client', x: 1, y: 0, ports: ['g0/1'] },
    ],
    links: [{ id: 'l1', from: 'sw1', fromPort: 'g0/1', to: 'sw2', toPort: 'g0/1' }],
  };
  const configure = (name: string, commands: string[]) => {
    let session = boot(name, 'Layer 2 Switch');
    for (const command of commands) session = applyCommand(session, command, []);
    return session;
  };
  const serverCommands = ['enable', 'configure terminal', 'vtp version 2', 'vtp domain ccnavtp', 'vtp password cisco123', 'interface g0/1', 'switchport mode trunk', 'no shutdown', 'exit', 'vlan 10', 'name management', 'exit', 'vlan 20', 'name students', 'exit', 'end'];
  const clientCommands = ['enable', 'configure terminal', 'vtp mode client', 'vtp version 2', 'vtp domain ccnavtp', 'vtp password cisco123', 'interface g0/1', 'switchport mode trunk', 'no shutdown', 'end'];
  const sw1 = configure('CE-SW1', serverCommands);
  const sw2 = configure('CE-SW2', clientCommands);
  const sessions = { sw1, sw2 };
  assert.equal(sw1.vtp?.revision, 4);
  assert.equal(sw2.vtp?.revision, 0);
  // The client adopted the server database (revision 4) through the trunk.
  const clientStatus = outputFor('show vtp status', topology.nodes[1], topology, sessions.sw2, sessions);
  assert.ok(clientStatus.some(line => line.includes('VTP Operating Mode') && line.includes('Client')));
  assert.ok(clientStatus.some(line => line.includes('VTP Domain Name') && line.includes('ccnavtp')));
  assert.ok(clientStatus.some(line => line.includes('Configuration Revision') && line.endsWith('4')));
  assert.ok(clientStatus.some(line => line.includes('Number of existing VLANs') && line.endsWith('3')));
  assert.ok(clientStatus.some(line => line.includes('MD5 digest')));
  const clientVlans = outputFor('show vlan brief', topology.nodes[1], topology, sessions.sw2, sessions);
  assert.ok(clientVlans.some(line => line.startsWith('10') && line.includes('management')));
  assert.ok(clientVlans.some(line => line.startsWith('20') && line.includes('students')));
  // Server and client digests match after adoption.
  const serverStatus = outputFor('show vtp status', topology.nodes[0], topology, sessions.sw1, sessions);
  assert.deepEqual(clientStatus.filter(line => line.includes('MD5 digest') || line.trim().startsWith('0x')), serverStatus.filter(line => line.includes('MD5 digest') || line.trim().startsWith('0x')));
  // A client cannot create VLANs: accepted with a rejection message, no state change.
  const blocked = executeNetworkCommand(topology.nodes[1], topology, { ...sessions, sw2: { ...sw2, mode: 'config' as const } }, 'vlan 30');
  assert.equal(blocked.accepted, true);
  assert.ok(blocked.output.some(line => line.includes('VTP client cannot configure VLANs')));
  assert.equal(blocked.sessions.sw2.vlans['30'], undefined);
  assert.equal(blocked.sessions.sw2.mode, 'config');
  // Password mismatch blocks propagation: a client with the wrong password learns nothing.
  const wrongPassword = configure('CE-SW2', [...clientCommands.slice(0, 5), 'vtp password wrongpass', ...clientCommands.slice(6)]);
  const wrongSessions = { sw1, sw2: wrongPassword };
  assert.ok(!outputFor('show vlan brief', topology.nodes[1], topology, wrongSessions.sw2, wrongSessions).some(line => line.startsWith('10')));
  assert.ok(outputFor('show vtp status', topology.nodes[1], topology, wrongSessions.sw2, wrongSessions).some(line => line.includes('Configuration Revision') && line.endsWith('0')));
  // Domain mismatch blocks propagation too.
  const wrongDomain = configure('CE-SW2', [...clientCommands.slice(0, 4), 'vtp domain other', ...clientCommands.slice(5)]);
  const wrongDomainSessions = { sw1, sw2: wrongDomain };
  assert.ok(!outputFor('show vlan brief', topology.nodes[1], topology, wrongDomainSessions.sw2, wrongDomainSessions).some(line => line.startsWith('10')));
  // Transparent mode never learns, even with a matching domain.
  const transparent = configure('CE-SW2', [...clientCommands.slice(0, 2), 'vtp mode transparent', ...clientCommands.slice(3)]);
  const transparentSessions = { sw1, sw2: transparent };
  assert.ok(!outputFor('show vlan brief', topology.nodes[1], topology, transparentSessions.sw2, transparentSessions).some(line => line.startsWith('10')));
  // A NULL domain never propagates: two default switches keep their own VLANs.
  const defaultA = configure('CE-SW1', ['enable', 'configure terminal', 'interface g0/1', 'switchport mode trunk', 'no shutdown', 'exit', 'vlan 10', 'name management', 'exit', 'end']);
  const defaultB = configure('CE-SW2', ['enable', 'configure terminal', 'interface g0/1', 'switchport mode trunk', 'no shutdown', 'end']);
  const defaultSessions = { sw1: defaultA, sw2: defaultB };
  assert.ok(!outputFor('show vlan brief', topology.nodes[1], topology, defaultSessions.sw2, defaultSessions).some(line => line.startsWith('10')));
  // The highest revision wins: a second server ahead of the first pulls it forward.
  const ahead = configure('CE-SW2', ['enable', 'configure terminal', 'vtp version 2', 'vtp domain ccnavtp', 'vtp password cisco123', 'interface g0/1', 'switchport mode trunk', 'no shutdown', 'exit', 'vlan 10', 'name management', 'exit', 'vlan 20', 'name students', 'exit', 'vlan 30', 'name servers', 'exit', 'vlan 40', 'name guests', 'exit', 'vlan 50', 'name iot', 'exit', 'end']);
  const aheadSessions = { sw1, sw2: ahead };
  assert.equal(ahead.vtp?.revision, 10);
  assert.ok(outputFor('show vlan brief', topology.nodes[0], topology, aheadSessions.sw1, aheadSessions).some(line => line.startsWith('50') && line.includes('iot')));
  // Domain changes reset the revision and announce the change.
  const domainChange = executeNetworkCommand(topology.nodes[0], topology, { ...sessions, sw1: { ...sw1, mode: 'config' as const } }, 'vtp domain newdomain');
  assert.equal(domainChange.sessions.sw1.vtp?.domain, 'newdomain');
  assert.equal(domainChange.sessions.sw1.vtp?.revision, 0);
  assert.ok(domainChange.output.some(line => line.includes('Changing VTP domain name from ccnavtp to newdomain')));
  assert.ok(domainChange.output.some(line => line.includes('%SW_VLAN-6-VTP_DOMAIN_NAME_CHG: VTP domain name changed to newdomain.')));
});

test('VTP lab walkthrough reaches the graded outcomes', () => {
  const lab = LAB_REGISTRY['tr2-vtp'];
  assert.equal(lab.masterTranche, 1);
  assert.equal(lab.tranche, 3);
  const topology = { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links };
  const seeded = seedSessions(lab);
  let sessions = Object.fromEntries(topology.nodes.map(node => [node.id, seeded[node.name]]));
  for (const step of lab.steps) {
    const node = topology.nodes.find(node => node.name === step.targetDevice)!;
    if (step.exercise) {
      // Vocabulary cards are interleaved with the IOS steps; completing one
      // is lesson-answer evidence, not a console command.
      sessions[node.id] = { ...sessions[node.id], lessonAnswers: { ...sessions[node.id].lessonAnswers, [step.id]: true } };
      continue;
    }
    const result = executeNetworkCommand(node, topology, sessions, step.expectedCommand);
    assert.equal(result.accepted, true, `Step ${step.id} ${step.expectedCommand} on ${step.targetDevice}`);
    sessions = result.sessions;
  }
  assert.equal(gradeLab(lab, sessions).passed, true);
  assert.deepEqual(replayLab(lab).findings, []);
  assert.deepEqual(validateLab(lab).filter(finding => finding.severity === 'error'), []);
});

test('show spanning-tree renders modeled PVST output with root election', () => {
  const sw1 = { id: 'sw1', name: 'CE-SW1', kind: 'switch' as const, role: 'Access Switch', x: 0, y: 0, ports: ['g0/1', 'g0/2'] };
  const sw2 = { id: 'sw2', name: 'CE-SW2', kind: 'switch' as const, role: 'Access Switch', x: 1, y: 0, ports: ['g0/1', 'g0/2'] };
  const topology = { name: 'stp', description: '', nodes: [sw1, sw2], links: [{ id: 'l1', from: 'sw1', to: 'sw2', fromPort: 'g0/1', toPort: 'g0/1' }] };
  let sessions: Record<string, Session> = { sw1: boot('CE-SW1', 'Access Switch'), sw2: boot('CE-SW2', 'Access Switch') };
  const run = (node: typeof sw1, commands: string[]) => {
    for (const command of commands) {
      const result = executeNetworkCommand(node, topology, sessions, command);
      assert.equal(result.accepted, true, command);
      sessions = result.sessions;
    }
  };
  run(sw1, ['enable', 'configure terminal', 'vlan 10', 'exit', 'spanning-tree vlan 10 root primary', 'interface g0/1', 'switchport mode trunk', 'no shutdown', 'end']);
  run(sw2, ['enable', 'configure terminal', 'vlan 10', 'exit', 'interface g0/1', 'switchport mode trunk', 'no shutdown', 'end']);
  assert.equal(sessions.sw1.stp?.vlanPriority['10'], 24576);
  assert.equal(sessions.sw1.stp?.vlanRoot['10'], 'primary');

  const sw1Out = outputFor('show spanning-tree vlan 10', sw1, topology, sessions.sw1, sessions).join('\n');
  assert.doesNotMatch(sw1Out, /No modeled operational output/);
  assert.match(sw1Out, /VLAN0010/);
  assert.match(sw1Out, /Spanning tree enabled protocol ieee/);
  assert.match(sw1Out, /Root ID    Priority    24586/);
  assert.match(sw1Out, /This bridge is the root/);
  assert.match(sw1Out, /\(priority 24576 sys-id-ext 10\)/);
  assert.match(sw1Out, /g0\/1\s+Desg\s+FWD\s+4\s+128\.1\s+P2p/);

  const sw2Out = outputFor('show spanning-tree vlan 10', sw2, topology, sessions.sw2, sessions).join('\n');
  assert.match(sw2Out, /Root ID    Priority    24586/);
  assert.match(sw2Out, new RegExp(`Address\\s+${stpBridgeMac('CE-SW1')}`));
  assert.match(sw2Out, /Cost        4/);
  assert.match(sw2Out, /Port        1 \(g0\/1\)/);
  assert.match(sw2Out, /g0\/1\s+Root\s+FWD\s+4\s+128\.1\s+P2p/);
  assert.doesNotMatch(sw2Out, /This bridge is the root/);

  const bare = outputFor('show spanning-tree', sw1, topology, sessions.sw1, sessions).join('\n');
  assert.match(bare, /VLAN0001/);
  assert.match(bare, /VLAN0010/);
  assert.match(bare, /Root ID    Priority    32769/);
  // g0/2 was never enabled: down ports are listed with a DWN state.
  assert.match(bare, /g0\/2\s+Desg\s+DWN\s+4\s+128\.2\s+P2p/);

  assert.deepEqual(outputFor('show spanning-tree vlan 99', sw1, topology, sessions.sw1, sessions), ['% VLAN 99 does not exist.']);
});

test('spanning-tree portfast marks edge ports and rapid-pvst changes the protocol', () => {
  const sw1 = { id: 'sw1', name: 'CE-SW1', kind: 'switch' as const, role: 'Access Switch', x: 0, y: 0, ports: ['g0/1', 'g0/2'] };
  const topology = { name: 'stp-edge', description: '', nodes: [sw1], links: [] };
  let sessions: Record<string, Session> = { sw1: boot('CE-SW1', 'Access Switch') };
  for (const command of ['enable', 'configure terminal', 'spanning-tree mode rapid-pvst', 'interface g0/2', 'spanning-tree portfast', 'spanning-tree bpduguard enable', 'no shutdown', 'end']) {
    const result = executeNetworkCommand(sw1, topology, sessions, command);
    assert.equal(result.accepted, true, command);
    sessions = result.sessions;
  }
  assert.equal(sessions.sw1.stp?.mode, 'rapid-pvst');
  assert.equal(sessions.sw1.stp?.portfast['g0/2'], true);
  assert.equal(sessions.sw1.stp?.bpduguard['g0/2'], true);
  const out = outputFor('show spanning-tree', sw1, topology, sessions.sw1, sessions).join('\n');
  assert.match(out, /Spanning tree enabled protocol rstp/);
  assert.match(out, /This bridge is the root/);
  assert.match(out, /g0\/2\s+Desg\s+FWD\s+4\s+128\.2\s+P2p Edge/);
});

test('show spanning-tree is unavailable on non-switch devices', () => {
  const router = { id: 'r1', name: 'CE-R1', kind: 'router' as const, role: 'Branch Router', x: 0, y: 0, ports: ['g0/0'] };
  const topology = { name: 'stp-gate', description: '', nodes: [router], links: [] };
  assert.deepEqual(outputFor('show spanning-tree', router, topology, boot('CE-R1', 'Branch Router'), {}), ['% Spanning tree is not available on CE-R1.']);
});

test('tr2-stp verify step renders modeled spanning-tree output', () => {
  const lab = LAB_REGISTRY['tr2-stp'];
  const topology = { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links };
  const sw1 = topology.nodes.find(node => node.name === 'CE-SW1')!;
  const seeded = seedSessions(lab);
  let sessions = Object.fromEntries(topology.nodes.map(node => [node.id, seeded[node.name]]));
  let verified = 0;
  for (const step of lab.steps) {
    if (!step.expectedCommand) continue; // interleaved vocabulary cards
    const result = executeNetworkCommand(sw1, topology, sessions, step.expectedCommand);
    assert.equal(result.accepted, true, `Step ${step.id} ${step.expectedCommand}`);
    sessions = result.sessions;
    if (step.expectedCommand === 'show spanning-tree') {
      verified += 1;
      const out = result.output.join('\n');
      assert.doesNotMatch(out, /No modeled operational output/);
      assert.match(out, /VLAN0001/);
      assert.match(out, /This bridge is the root/);
      assert.match(out, /Priority    32769/);
      // The lab brings g0/2 up with PortFast, so it appears as an edge port.
      assert.match(out, /g0\/2\s+Desg\s+FWD\s+4\s+128\.2\s+P2p Edge/);
    }
  }
  assert.equal(verified, 1);
});

test('show spanning-tree blocks the redundant port in a triangle', () => {
  const sw1 = { id: 'sw1', name: 'CE-SW1', kind: 'switch' as const, role: 'Access Switch', x: 0, y: 0, ports: ['g0/1', 'g0/2'] };
  const sw2 = { id: 'sw2', name: 'CE-SW2', kind: 'switch' as const, role: 'Access Switch', x: 1, y: 0, ports: ['g0/1', 'g0/2'] };
  const sw3 = { id: 'sw3', name: 'CE-SW3', kind: 'switch' as const, role: 'Access Switch', x: 2, y: 0, ports: ['g0/1', 'g0/2'] };
  const topology = {
    name: 'stp-triangle', description: '', nodes: [sw1, sw2, sw3],
    links: [
      { id: 'l1', from: 'sw1', to: 'sw2', fromPort: 'g0/1', toPort: 'g0/1' },
      { id: 'l2', from: 'sw1', to: 'sw3', fromPort: 'g0/2', toPort: 'g0/1' },
      { id: 'l3', from: 'sw2', to: 'sw3', fromPort: 'g0/2', toPort: 'g0/2' },
    ],
  };
  let sessions: Record<string, Session> = { sw1: boot('CE-SW1', 'Access Switch'), sw2: boot('CE-SW2', 'Access Switch'), sw3: boot('CE-SW3', 'Access Switch') };
  const run = (node: typeof sw1, commands: string[]) => {
    for (const command of commands) {
      const result = executeNetworkCommand(node, topology, sessions, command);
      assert.equal(result.accepted, true, command);
      sessions = result.sessions;
    }
  };
  // Deterministic priorities: SW1 root, SW2 beats SW3 on the 2-3 segment.
  run(sw1, ['enable', 'configure terminal', 'spanning-tree vlan 1 priority 4096', 'interface g0/1', 'no shutdown', 'interface g0/2', 'no shutdown', 'end']);
  run(sw2, ['enable', 'configure terminal', 'spanning-tree vlan 1 priority 16384', 'interface g0/1', 'no shutdown', 'interface g0/2', 'no shutdown', 'end']);
  run(sw3, ['enable', 'configure terminal', 'interface g0/1', 'no shutdown', 'interface g0/2', 'no shutdown', 'end']);

  const sw3Out = outputFor('show spanning-tree', sw3, topology, sessions.sw3, sessions).join('\n');
  assert.match(sw3Out, /Root ID    Priority    4097/);
  assert.doesNotMatch(sw3Out, /This bridge is the root/);
  assert.match(sw3Out, /Cost        4/);
  assert.match(sw3Out, /Port        1 \(g0\/1\)/);
  assert.match(sw3Out, /g0\/1\s+Root\s+FWD\s+4\s+128\.1\s+P2p/);
  // The SW2-SW3 segment is redundant: SW3's end is the alternate and blocks.
  assert.match(sw3Out, /g0\/2\s+Altn\s+BLK\s+4\s+128\.2\s+P2p/);

  const sw2Out = outputFor('show spanning-tree', sw2, topology, sessions.sw2, sessions).join('\n');
  assert.match(sw2Out, /g0\/1\s+Root\s+FWD\s+4\s+128\.1\s+P2p/);
  assert.match(sw2Out, /g0\/2\s+Desg\s+FWD\s+4\s+128\.2\s+P2p/);

  const sw1Out = outputFor('show spanning-tree', sw1, topology, sessions.sw1, sessions).join('\n');
  assert.match(sw1Out, /This bridge is the root/);
  assert.match(sw1Out, /g0\/1\s+Desg\s+FWD\s+4\s+128\.1\s+P2p/);
  assert.match(sw1Out, /g0\/2\s+Desg\s+FWD\s+4\s+128\.2\s+P2p/);
});

test('do runs privileged EXEC commands without leaving configuration mode', () => {
  const sw1 = { id: 'sw1', name: 'CE-SW1', kind: 'switch' as const, role: 'Access Switch', x: 0, y: 0, ports: ['g0/1'] };
  const topology = { name: 'do-test', description: '', nodes: [sw1], links: [] };
  let sessions: Record<string, Session> = { sw1: boot('CE-SW1', 'Access Switch') };
  for (const command of ['enable', 'configure terminal']) {
    const result = executeNetworkCommand(sw1, topology, sessions, command);
    assert.equal(result.accepted, true, command);
    sessions = result.sessions;
  }
  assert.equal(sessions.sw1.mode, 'config');

  const doShow = executeNetworkCommand(sw1, topology, sessions, 'do show spanning-tree');
  assert.equal(doShow.accepted, true);
  assert.match(doShow.output.join('\n'), /VLAN0001/);
  assert.match(doShow.output.join('\n'), /This bridge is the root/);
  assert.equal(doShow.sessions.sw1.mode, 'config', 'do returns to the config prompt');
  sessions = doShow.sessions;

  const toInterface = executeNetworkCommand(sw1, topology, sessions, 'interface g0/1');
  sessions = toInterface.sessions;
  const doVlan = executeNetworkCommand(sw1, topology, sessions, 'do show vlan brief');
  assert.equal(doVlan.accepted, true);
  assert.match(doVlan.output.join('\n'), /VLAN/);
  assert.equal(doVlan.sessions.sw1.mode, 'interface');
  assert.equal(doVlan.sessions.sw1.context, 'g0/1');
  sessions = doVlan.sessions;

  // A configuration command is not valid after do.
  assert.equal(executeNetworkCommand(sw1, topology, sessions, 'do hostname FOO').accepted, false);
  // do is not available at the privileged prompt.
  const privileged = { sw1: { ...sessions.sw1, mode: 'privileged' as const, context: null } };
  assert.equal(executeNetworkCommand(sw1, topology, privileged, 'do show spanning-tree').accepted, false);
  // A device without the capability still rejects the inner command.
  const router = { id: 'r1', name: 'CE-R1', kind: 'router' as const, role: 'Branch Router', x: 1, y: 0, ports: ['g0/0'] };
  const routerTopo = { name: 'do-router', description: '', nodes: [router], links: [] };
  const routerSessions: Record<string, Session> = { r1: { ...boot('CE-R1', 'Branch Router'), mode: 'config' as const } };
  assert.equal(executeNetworkCommand(router, routerTopo, routerSessions, 'do show spanning-tree').accepted, false);
  assert.equal(executeNetworkCommand(router, routerTopo, routerSessions, 'do show ip route').accepted, true);
});

test('MAC aging keeps recent entries and drops stale ones after a lengthy timer', () => {
  const now = Date.now();
  const sessions: Record<string, Session> = {
    sw1: {
      ...boot('CE-SW1', 'Access Switch'),
      macTable: [
        { mac: 'AAAA.BBBB.CCCC', port: 'g0/1', vlan: 1, type: 'dynamic' as const, lastSeen: now - 30 * 60 * 1000 },
        { mac: 'DDDD.EEEE.FFFF', port: 'g0/2', vlan: 1, type: 'dynamic' as const, lastSeen: now - 2 * 60 * 60 * 1000 },
        { mac: '0011.2233.4455', port: 'g0/3', vlan: 1, type: 'static' as const },
      ],
    },
  };
  const aged = ageMacTables(sessions, now);
  assert.deepEqual(aged.sw1.macTable.map((entry) => entry.mac), ['AAAA.BBBB.CCCC', '0011.2233.4455']);
});

test('spanning-tree vlan ranges apply root and priority to every VLAN in the range', () => {
  const sw1 = { id: 'sw1', name: 'CE-SW1', kind: 'switch' as const, role: 'Access Switch', x: 0, y: 0, ports: ['g0/1'] };
  const topology = { name: 'stp-range', description: '', nodes: [sw1], links: [] };
  let sessions: Record<string, Session> = { sw1: boot('CE-SW1', 'Access Switch') };
  for (const command of ['enable', 'configure terminal', 'vlan 10', 'exit', 'vlan 20', 'exit', 'spanning-tree vlan 10,20 root primary', 'spanning-tree vlan 30-31 priority 8192']) {
    const result = executeNetworkCommand(sw1, topology, sessions, command);
    assert.equal(result.accepted, true, command);
    sessions = result.sessions;
  }
  assert.equal(sessions.sw1.stp?.vlanPriority['10'], 24576);
  assert.equal(sessions.sw1.stp?.vlanPriority['20'], 24576);
  assert.equal(sessions.sw1.stp?.vlanPriority['30'], 8192);
  assert.equal(sessions.sw1.stp?.vlanPriority['31'], 8192);
  assert.equal(sessions.sw1.stp?.vlanRoot['10'], 'primary');
});

test('spanning-tree root, summary, and interface detail render from the converged tree', () => {
  const sw1 = { id: 'sw1', name: 'CE-SW1', kind: 'switch' as const, role: 'Access Switch', x: 0, y: 0, ports: ['g0/1', 'g0/2'] };
  const sw2 = { id: 'sw2', name: 'CE-SW2', kind: 'switch' as const, role: 'Access Switch', x: 1, y: 0, ports: ['g0/1', 'g0/2'] };
  const topology = { name: 'stp-views', description: '', nodes: [sw1, sw2], links: [{ id: 'l1', from: 'sw1', to: 'sw2', fromPort: 'g0/1', toPort: 'g0/1' }] };
  let sessions: Record<string, Session> = { sw1: boot('CE-SW1', 'Access Switch'), sw2: boot('CE-SW2', 'Access Switch') };
  const run = (node: typeof sw1, commands: string[]) => {
    for (const command of commands) {
      const result = executeNetworkCommand(node, topology, sessions, command);
      assert.equal(result.accepted, true, command);
      sessions = result.sessions;
    }
  };
  run(sw1, ['enable', 'configure terminal', 'vlan 10', 'exit', 'spanning-tree vlan 10 root primary', 'interface g0/1', 'switchport mode trunk', 'no shutdown', 'end']);
  run(sw2, ['enable', 'configure terminal', 'vlan 10', 'exit', 'interface g0/1', 'switchport mode trunk', 'no shutdown', 'end']);

  const rootSw1 = outputFor('show spanning-tree root', sw1, topology, sessions.sw1, sessions).join('\n');
  assert.doesNotMatch(rootSw1, /No modeled operational output/);
  assert.match(rootSw1, /VLAN0010\s+24586/);
  assert.match(rootSw1, /This bridge is the root/);
  const rootSw2 = outputFor('show spanning-tree root', sw2, topology, sessions.sw2, sessions).join('\n');
  assert.match(rootSw2, /VLAN0010\s+24586/);
  assert.match(rootSw2, /g0\/1\s*$/m);

  const summary = outputFor('show spanning-tree summary', sw1, topology, sessions.sw1, sessions).join('\n');
  assert.doesNotMatch(summary, /No modeled operational output/);
  assert.match(summary, /Switch is in pvst mode/);
  assert.match(summary, /Root bridge for:.*VLAN0010/);
  // VLAN0010 on SW1: g0/1 forwarding, g0/2 down and excluded from the counts.
  assert.match(summary, /VLAN0010\s+0\s+0\s+0\s+1\s+1/);

  const detail = outputFor('show spanning-tree interface g0/1 detail', sw2, topology, sessions.sw2, sessions).join('\n');
  assert.doesNotMatch(detail, /No modeled operational output/);
  assert.match(detail, /Port 1 \(GigabitEthernet0\/1\) of VLAN0010 is forwarding/);
  assert.match(detail, /Designated root has priority 24586/);
  assert.match(detail, /Designated bridge has priority 24586/);
  assert.deepEqual(outputFor('show spanning-tree interface g0/9 detail', sw2, topology, sessions.sw2, sessions), ['% Interface g0/9 does not exist on CE-SW2.']);
});

test('port-security lab: the staff PC brings the secure port up, its MAC is learned, and every evidence command renders', () => {
  const lab = LAB_REGISTRY['tr4-port-security'];
  const topology = { name: lab.title, description: lab.description, nodes: lab.topology.devices, links: lab.topology.links };
  const sw1 = topology.nodes.find(node => node.name === 'CE-SW1')!;
  const seeded = seedSessions(lab);
  let sessions: Record<string, Session> = Object.fromEntries(topology.nodes.map(node => [node.id, seeded[node.name]]));
  for (const command of ['enable', 'configure terminal', 'interface g0/1', 'switchport mode access', 'switchport port-security', 'switchport port-security maximum 1', 'switchport port-security mac-address sticky', 'switchport port-security violation restrict', 'no shutdown', 'end']) {
    const result = executeNetworkCommand(sw1, topology, sessions, command);
    assert.equal(result.accepted, true, command);
    sessions = result.sessions;
  }
  const out = (command: string) => outputFor(command, sw1, topology, sessions.sw1, sessions).join('\n');

  // The PC powers its own NIC, so the link comes up and the host MAC is
  // learned on the secure access port even though the PC runs no commands.
  assert.match(out('show interfaces status'), /g0\/1\s+connected/);
  assert.match(out('show interfaces'), /g0\/1 is up, line protocol is up/);
  assert.match(out('show interfaces switchport'), /Name: g0\/1/);
  const pcMac = modeledDeviceMac('pc1');
  assert.ok(sessions.sw1.macTable.some(entry => entry.port === 'g0/1' && entry.mac === pcMac), 'STAFF-PC1 MAC learned on g0/1');
  assert.match(out('show mac address-table'), new RegExp(pcMac.replace(/\./g, '\\.')));
  assert.match(out('show mac address-table secure'), new RegExp(pcMac.replace(/\./g, '\\.')));
  assert.match(out('show mac address-table interface g0/1'), new RegExp(pcMac.replace(/\./g, '\\.')));
  assert.doesNotMatch(out('show mac address-table dynamic'), new RegExp(pcMac.replace(/\./g, '\\.')));

  assert.match(out('show port-security interface g0/1'), /Port Status\s+: connected/);
  assert.match(out('show port-security interface g0/1'), /Learned MAC Addresses\s+: 1/);
  const summary = out('show port-security');
  assert.doesNotMatch(summary, /No modeled operational output/);
  assert.match(summary, /Secure Port/);
  assert.match(summary, /g0\/1\s+1\s+1\s+0\s+Restrict/);

  assert.match(out('show version'), /Catalyst 2960/);
  assert.match(out('show clock'), /^\*\d{2}:\d{2}:\d{2}\.\d{3} UTC \w{3} \w{3} \d{2} \d{4}$/);
  assert.match(out('show spanning-tree interface g0/1 detail'), /VLAN0001 is forwarding/);

  // The lab's full evidence-pass command cycle (CDP excluded: the filter
  // drops it because the only peer is a PC) must never hit the placeholder.
  for (const command of ['show port-security', 'show port-security interface g0/1', 'show interfaces g0/1 switchport', 'show interfaces status', 'show mac address-table', 'show mac address-table secure', 'show mac address-table interface g0/1', 'show spanning-tree interface g0/1 detail', 'show running-config', 'show running-config interface g0/1', 'show interfaces counters errors', 'show version', 'show clock', 'show startup-config']) {
    assert.doesNotMatch(out(command), /No modeled operational output/, command);
  }
});
