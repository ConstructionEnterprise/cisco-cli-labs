import { test } from 'node:test';
import assert from 'node:assert/strict';
import { troubleshootingLabs } from '../labs/troubleshootingLabs';
import { techSupportLabs } from '../labs/techSupportLabs';
import { cyberDefenseLabs } from '../labs/cyberDefenseLabs';
import { ethicalHackingLabs } from '../labs/ethicalHackingLabs';
import { LAB_REGISTRY } from '../labs/labDefinitions';
import { applyCommand, boot, iosContextHelp, isCiscoCommand, modeledDeviceMac } from './ios-engine';
import { canonicalCommand, configurationDiff, DEFAULT_LEARNING_MODE, gradeLab, replayLab, seedSessions, validateLab, vlanSet } from './learning-engine';
import { channelForwarding, diagnosePath, evidenceOutput, interfaceEvidence, interfaceRelationships, interfaceVlan, protocolEvidence, leaseState, electionEvidence, ospfOperationalEvidence } from './operational-evidence';
import { evaluateInterfaceAcl } from './ipv4-policy';
import { vlanOverlay } from './vlan-overlay';
import { cabledPeer, cabledPeerAddress, cabledPeerMac, portHoverContent, vlanSvi } from '../components/VlanHoverCard';
import { executeNetworkCommand, outputFor, tracePacket, reconcileOspfRoutes, ospfNeighbors } from './sandbox-network-engine';
import { executeAttackCommand } from './attack-console-engine';
import { networkingVocabularyCards, VOCABULARY_GROUPS } from '../labs/vocabularyCards';

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

  for (const lab of [...redValidation, ...redSimulation, ...purpleSimulation]) {
    const attacker = lab.topology.devices.find(device => device.name === 'ATTACKER-KALI');
    assert.ok(attacker, `${lab.id} must include ATTACKER-KALI rather than an IOS assessment workstation`);
    assert.equal(attacker.terminal, 'attack', `${lab.id} must mark ATTACKER-KALI as an attack terminal`);
    const attackerSteps = lab.steps.filter(step => step.targetDevice === 'ATTACKER-KALI');
    assert.ok(attackerSteps.length > 0, `${lab.id} must include attacker-console evidence`);
    assert.ok(attackerSteps.every(step => step.requiredMode === 'shell'), `${lab.id} attacker steps must use the Linux shell mode`);
    assert.ok(attackerSteps.some(step => /^(nmap|python3|snmpwalk|snmpset|msfconsole|openssl|curl)/.test(step.expectedCommand)), `${lab.id} must use a supported Linux-shaped range command`);
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
  const routes = outputFor('show ip route', topology.nodes[0], topology, seeded['CE-SW1'], { a: seeded['CE-SW1'], b: seeded['CE-SW2'] });
  assert.ok(routes.some(line => line.startsWith('C    10.0.0.0/24 is directly connected')));
  assert.ok(routes.some(line => line.startsWith('S    198.51.100.0/24 via 10.0.0.2')));
  const trunks = outputFor('show interfaces trunk', topology.nodes[0], topology, seeded['CE-SW1'], { a: seeded['CE-SW1'], b: seeded['CE-SW2'] });
  assert.ok(trunks.some(line => line.includes('not-trunking')));
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
