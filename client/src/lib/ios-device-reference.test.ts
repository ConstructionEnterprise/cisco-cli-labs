import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './ios-engine';
import { iosDeviceContextHelp, iosPlatformReference } from './ios-device-reference';
import { executeNetworkCommand } from './sandbox-network-engine';
import { LAB_REGISTRY } from '../labs/labDefinitions';
import { matchesHelpStep, replayLab, gradeLab } from './learning-engine';

const router = { id: 'r1', name: 'CE-R1', kind: 'router' as const, role: 'Branch Router', x: 0, y: 0, ports: ['g0/0', 'g0/1'] };
const switchNode = { id: 'sw1', name: 'CE-SW1', kind: 'switch' as const, role: 'Layer 2 Switch', x: 1, y: 0, ports: ['g0/1', 'g0/2', 'g0/3'] };
const multilayerSwitch = { ...switchNode, role: 'Layer 3 Switch' };
const pc = { id: 'pc1', name: 'CLIENT-PC1', kind: 'pc' as const, role: 'DHCP Client', x: 2, y: 0, ports: ['eth0'] };
const topology = { name: 'help', description: '', nodes: [router, switchNode, pc], links: [] };

test('IOS context help follows device capabilities and actual interface inventory', () => {
  assert.equal(iosPlatformReference(pc), null);
  assert.match(iosPlatformReference(router)!.url, /cisco\.com/);
  assert.match(iosPlatformReference(switchNode)!.url, /cisco\.com/);
  assert.ok(iosDeviceContextHelp('show ?', 'privileged', router)?.some(line => line.startsWith('ip')));
  assert.ok(!iosDeviceContextHelp('?', 'user', router)?.some(line => line.startsWith('exit')));
  assert.ok(!iosDeviceContextHelp('show ?', 'privileged', router)?.some(line => line.startsWith('vlan')));
  assert.ok(iosDeviceContextHelp('show ?', 'privileged', switchNode)?.some(line => line.startsWith('vlan')));
  assert.ok(!iosDeviceContextHelp('show ip ?', 'privileged', switchNode)?.some(line => line.startsWith('route')));
  assert.ok(!iosDeviceContextHelp('show interfaces ?', 'privileged', router)?.some(line => line.startsWith('trunk')));
  assert.ok(iosDeviceContextHelp('interface ?', 'config', switchNode)?.some(line => line.startsWith('g0/3')));
  assert.ok(!iosDeviceContextHelp('interface ?', 'config', switchNode)?.some(line => line.startsWith('g0/4')));
  assert.ok(!iosDeviceContextHelp('?', 'interface', router, 'g0/0')?.some(line => line.startsWith('switchport')));
  assert.ok(iosDeviceContextHelp('?', 'interface', switchNode, 'g0/1')?.some(line => line.startsWith('switchport')));
  assert.match(iosDeviceContextHelp('?', 'user', pc)![0], /not a Cisco IOS device/);
});

test('DHCP context help offers the next argument and optional command completion', () => {
  assert.ok(iosDeviceContextHelp('ip dhcp ?', 'config', router)?.some(line => line.startsWith('excluded-address')));
  assert.ok(iosDeviceContextHelp('ip dhcp excl?', 'config', router)?.some(line => line.startsWith('excluded-address')));
  assert.ok(iosDeviceContextHelp('ip dhcp excluded-address ?', 'config', multilayerSwitch)?.some(line => line.includes('Low IP address')));
  const addressHelp = iosDeviceContextHelp('ip dhcp excluded-address 10.10.10.1 ?', 'config', multilayerSwitch);
  assert.ok(addressHelp?.some(line => line.includes('High IP address')));
  assert.ok(addressHelp?.some(line => line.startsWith('<cr>')));
  assert.deepEqual(iosDeviceContextHelp('ip dhcp excluded-address 10.10.10.1 10.10.10.5 ?', 'config', router)?.map(line => line.trim().split(/\s+/)[0]), ['<cr>']);
  assert.ok(!iosDeviceContextHelp('ip dhcp ?', 'config', switchNode)?.some(line => line.startsWith('excluded-address')));
  assert.ok(iosDeviceContextHelp('?', 'dhcp', router)?.some(line => line.startsWith('network')));
  assert.ok(iosDeviceContextHelp('network 10.10.10.0 ?', 'dhcp', router)?.some(line => line.includes('Network mask')));
  assert.ok(iosDeviceContextHelp('ip helper-address ?', 'interface', router, 'g0/0')?.some(line => line.startsWith('A.B.C.D')));
  assert.ok(iosDeviceContextHelp('ip helper-address 10.20.20.2 ?', 'interface', router, 'g0/0')?.some(line => line.startsWith('<cr>')));
  assert.ok(!iosDeviceContextHelp('ip helper-address ?', 'interface', switchNode, 'g0/1')?.some(line => line.startsWith('A.B.C.D')));
});

test('switchport mode help shows the CML choices without accepting unmodeled modes', () => {
  const help = iosDeviceContextHelp('switchport mode ?', 'interface', switchNode, 'g0/2')!;
  assert.deepEqual(help.slice(0, -1).map(line => line.trim().split(/\s+/)[0]), [
    'access', 'dot1q-tunnel', 'dynamic', 'private-vlan', 'trunk',
  ]);
  assert.match(help.at(-1)!, /only access and trunk forwarding are simulated/);
  assert.deepEqual(iosDeviceContextHelp('switchport mode d?', 'interface', switchNode, 'g0/2')?.map(line => line.trim().split(/\s+/)[0]), ['dot1q-tunnel', 'dynamic']);
  assert.equal(iosDeviceContextHelp('switchport mode ?', 'interface', router, 'g0/0')?.[0], '% Unrecognized command');
  assert.equal(iosDeviceContextHelp('switchport mode ?', 'interface', switchNode, 'vlan 1')?.[0], '% Unrecognized command');
  const session = { ...boot(switchNode.name, switchNode.role), mode: 'interface' as const, context: 'g0/2' };
  const sessions = { [switchNode.id]: session };
  const query = executeNetworkCommand(switchNode, topology, sessions, 'switchport mode ?');
  assert.equal(query.accepted, true);
  assert.equal(query.sessions, sessions);
  assert.equal(executeNetworkCommand(switchNode, topology, sessions, 'switchport mode dynamic').accepted, false);
  assert.equal(executeNetworkCommand(switchNode, topology, sessions, 'switchport mode dot1q-tunnel').accepted, false);
  assert.equal(executeNetworkCommand(switchNode, topology, sessions, 'switchport mode private-vlan').accepted, false);
  assert.equal(executeNetworkCommand(switchNode, topology, sessions, 'switchport mode access').accepted, true);
  assert.equal(executeNetworkCommand(switchNode, topology, sessions, 'switchport mode trunk').accepted, true);
});

test('NTP help lists the CML study keywords without accepting unmodeled commands', () => {
  const help = iosDeviceContextHelp('ntp ?', 'config', router)!;
  const keywords = help.slice(0, -1).map(line => line.trim().split(/\s+/)[0]);
  assert.deepEqual(keywords, [
    'access-group', 'allow', 'authenticate', 'authentication-key', 'broadcastdelay',
    'clock-period', 'leap-handle', 'logging', 'master', 'max-associations',
    'maxdistance', 'mindistance', 'orphan', 'panic', 'passive', 'peer', 'server',
    'source', 'trusted-key',
  ]);
  assert.match(help.at(-1)!, /only ntp server is simulated/);
  assert.ok(iosDeviceContextHelp('ntp ?', 'config', switchNode)?.some(line => line.startsWith('server')));
  assert.ok(!iosDeviceContextHelp('ntp ?', 'config', switchNode)?.some(line => line.startsWith('panic')));
  assert.ok(iosDeviceContextHelp('ntp ?', 'config', multilayerSwitch)?.some(line => line.startsWith('panic')));
  assert.deepEqual(iosDeviceContextHelp('ntp server ?', 'config', router)?.map(line => line.trim().split(/\s+/)[0]), ['A.B.C.D']);
  assert.deepEqual(iosDeviceContextHelp('ntp server 192.0.2.1 ?', 'config', router)?.map(line => line.trim().split(/\s+/)[0]), ['<cr>']);
  assert.equal(iosDeviceContextHelp('ntp ?', 'interface', router, 'g0/0')?.[0], '% Unrecognized command');
  const session = { ...boot(router.name, router.role), mode: 'config' as const };
  const result = executeNetworkCommand(router, topology, { [router.id]: session }, 'ntp master 5');
  assert.equal(result.accepted, false);
});

test('show cdp neighbors help lists the CML interface types without accepting them as commands', () => {
  const help = iosDeviceContextHelp('show cdp neighbors ?', 'privileged', switchNode)!;
  assert.deepEqual(help.slice(0, -1).map(line => line.trim().split(/\s+/)[0]), [
    'Async', 'Auto-Template', 'BVI', 'Bluetooth', 'CTunnel', 'Dialer', 'EsconPhy',
    'Filter', 'Filtergroup', 'GMPLS', 'GigabitEthernet', 'GroupVI', 'LISP', 'Lex',
    'Lspvif', 'MFR', 'Multilink', 'fcpa', 'voaBypassIn', 'voaBypassOut',
    'voaFilterIn', 'voaFilterOut', 'voaIn', 'voaOut', '|', '<cr>',
  ]);
  assert.match(help.at(-1)!, /only show cdp neighbors, detail/);
  assert.deepEqual(iosDeviceContextHelp('show cdp neighbors gi?', 'privileged', switchNode)?.map(line => line.trim().split(/\s+/)[0]), ['GigabitEthernet']);
  assert.deepEqual(iosDeviceContextHelp('show cdp ?', 'privileged', switchNode)?.map(line => line.trim().split(/\s+/)[0]), ['neighbors']);
  // Interface-type keywords are reference-only: one alone is not a command.
  const session = { ...boot(switchNode.name, switchNode.role), mode: 'privileged' as const };
  const sessions = { [switchNode.id]: session };
  assert.equal(executeNetworkCommand(switchNode, topology, sessions, 'show cdp neighbors GigabitEthernet').accepted, false);
  assert.equal(executeNetworkCommand(switchNode, topology, sessions, 'show cdp neighbors').accepted, true);
  assert.equal(executeNetworkCommand(switchNode, topology, sessions, 'show cdp neighbors detail').accepted, true);
  assert.equal(executeNetworkCommand(switchNode, topology, sessions, 'show cdp neighbors g0/1').accepted, true);
});

test('show etherchannel help lists the CML subcommands and accepts the modeled forms', () => {
  const help = iosDeviceContextHelp('show etherchannel ?', 'privileged', switchNode)!;
  assert.deepEqual(help.slice(0, -1).map(line => line.trim().split(/\s+/)[0]), [
    '<1-255>', 'auto', 'detail', 'load-balance', 'port', 'port-channel', 'protocol', 'summary',
  ]);
  assert.match(help.at(-1)!, /Auto LAG is not modeled/);
  assert.deepEqual(iosDeviceContextHelp('show etherchannel p?', 'privileged', switchNode)?.map(line => line.trim().split(/\s+/)[0]), ['port', 'port-channel', 'protocol']);
  assert.deepEqual(iosDeviceContextHelp('show etherchannel 1 ?', 'privileged', switchNode)?.map(line => line.trim().split(/\s+/)[0]), ['detail', 'port', 'port-channel', 'protocol', 'summary']);
  assert.equal(iosDeviceContextHelp('show etherchannel ?', 'privileged', router)?.[0], '% Unrecognized command');
  const session = { ...boot(switchNode.name, switchNode.role), mode: 'privileged' as const };
  const sessions = { [switchNode.id]: session };
  for (const command of ['show etherchannel summary', 'show etherchannel auto', 'show etherchannel detail', 'show etherchannel load-balance', 'show etherchannel port', 'show etherchannel port-channel', 'show etherchannel protocol', 'show etherchannel 1', 'show etherchannel 1 detail', 'show etherchannel 1 port', 'show etherchannel 1 port-channel', 'show etherchannel 1 protocol', 'show etherchannel 1 summary', 'show etherchannel port g0/1', 'show etherchannel port-channel 1']) {
    assert.equal(executeNetworkCommand(switchNode, topology, sessions, command).accepted, true, command);
  }
  assert.equal(executeNetworkCommand(switchNode, topology, sessions, 'show etherchannel').accepted, false);
  assert.equal(executeNetworkCommand(switchNode, topology, sessions, 'show etherchannel 1 foo').accepted, false);
});

test('sandbox IOS help does not mutate sessions or advance a configuration', () => {
  const session = boot(router.name, router.role);
  const sessions = { [router.id]: { ...session, mode: 'privileged' as const } };
  const result = executeNetworkCommand(router, topology, sessions, 'show ip ?');
  assert.equal(result.accepted, true);
  assert.equal(result.sessions, sessions);
  assert.ok(result.output.some(line => line.startsWith('route')));
});

test('Master One Tranche Two requires both distinct IOS help forms before configuration', () => {
  const lab = LAB_REGISTRY['mt1-tr2-ios-context-help'];
  assert.equal(lab.masterTranche, 1);
  assert.equal(lab.tranche, 2);
  const helpSteps = lab.steps.filter(step => step.helpQuery);
  assert.deepEqual(helpSteps.map(step => step.expectedCommand), ['ip dhcp excl?', 'ip dhcp excluded-address ?', 'ip dhcp excluded-address 10.10.10.1 ?']);
  for (const step of helpSteps) {
    const help = iosDeviceContextHelp(step.expectedCommand, step.requiredMode, router);
    assert.equal(matchesHelpStep(step, step.expectedCommand, router.name, step.requiredMode, help), true);
    assert.equal(matchesHelpStep(step, step.expectedCommand.replace(' ?', '?'), router.name, step.requiredMode, help), step.expectedCommand === 'ip dhcp excl?');
    assert.equal(matchesHelpStep(step, step.expectedCommand, switchNode.name, step.requiredMode, help), false);
    assert.equal(matchesHelpStep(step, step.expectedCommand, router.name, 'privileged', help), false);
  }
  const { sessions, findings } = replayLab(lab);
  assert.deepEqual(findings, []);
  assert.equal(gradeLab(lab, sessions).passed, true);
  delete sessions[router.name].completedLabSteps?.[helpSteps[0].id];
  assert.equal(gradeLab(lab, sessions).passed, false);
});

test('VTP help lists modes, domain, version, and password without accepting version 3', () => {
  assert.ok(iosDeviceContextHelp('show ?', 'privileged', switchNode)?.some(line => line.startsWith('vtp')));
  assert.ok(!iosDeviceContextHelp('show ?', 'privileged', router)?.some(line => line.startsWith('vtp')));
  assert.deepEqual(iosDeviceContextHelp('show vtp ?', 'privileged', switchNode)?.map(line => line.trim().split(/\s+/)[0]), ['status']);
  assert.equal(iosDeviceContextHelp('show vtp ?', 'privileged', router)?.[0], '% Unrecognized command');
  assert.deepEqual(iosDeviceContextHelp('vtp ?', 'config', switchNode)?.map(line => line.trim().split(/\s+/)[0]), ['mode', 'domain', 'version', 'password']);
  assert.deepEqual(iosDeviceContextHelp('vtp mode ?', 'config', switchNode)?.map(line => line.trim().split(/\s+/)[0]), ['server', 'client', 'transparent']);
  assert.deepEqual(iosDeviceContextHelp('vtp domain ?', 'config', switchNode)?.map(line => line.trim().split(/\s+/)[0]), ['WORD']);
  assert.deepEqual(iosDeviceContextHelp('vtp version ?', 'config', switchNode)?.map(line => line.trim().split(/\s+/)[0]), ['1', '2']);
  assert.deepEqual(iosDeviceContextHelp('vtp password ?', 'config', switchNode)?.map(line => line.trim().split(/\s+/)[0]), ['WORD']);
  assert.equal(iosDeviceContextHelp('vtp ?', 'config', router)?.[0], '% Unrecognized command');
  const session = { ...boot(switchNode.name, switchNode.role), mode: 'config' as const };
  const sessions = { [switchNode.id]: session };
  assert.equal(executeNetworkCommand(switchNode, topology, sessions, 'vtp mode client').accepted, true);
  assert.equal(executeNetworkCommand(switchNode, topology, sessions, 'vtp domain ccnavtp').accepted, true);
  assert.equal(executeNetworkCommand(switchNode, topology, sessions, 'vtp version 2').accepted, true);
  assert.equal(executeNetworkCommand(switchNode, topology, sessions, 'vtp version 3').accepted, false);
  assert.equal(executeNetworkCommand(switchNode, topology, sessions, 'vtp password cisco123').accepted, true);
  assert.equal(executeNetworkCommand(router, topology, { [router.id]: { ...boot(router.name, router.role), mode: 'privileged' as const } }, 'show vtp status').accepted, false);
});

test('spanning-tree help lists show options, modes, and interface options without mst', () => {
  assert.ok(iosDeviceContextHelp('show ?', 'privileged', switchNode)?.some(line => line.startsWith('spanning-tree')));
  assert.ok(!iosDeviceContextHelp('show ?', 'privileged', router)?.some(line => line.startsWith('spanning-tree')));
  assert.deepEqual(iosDeviceContextHelp('show spanning-tree ?', 'privileged', switchNode)?.map(line => line.trim().split(/\s+/)[0]), ['<cr>', 'vlan', 'root', 'summary', 'interface']);
  assert.equal(iosDeviceContextHelp('show spanning-tree ?', 'privileged', router)?.[0], '% Unrecognized command');
  assert.deepEqual(iosDeviceContextHelp('spanning-tree ?', 'config', switchNode)?.map(line => line.trim().split(/\s+/)[0]), ['mode', 'vlan']);
  assert.deepEqual(iosDeviceContextHelp('spanning-tree mode ?', 'config', switchNode)?.map(line => line.trim().split(/\s+/)[0]), ['pvst', 'rapid-pvst']);
  assert.ok(!iosDeviceContextHelp('spanning-tree mode ?', 'config', switchNode)?.some(line => line.startsWith('mst')));
  assert.deepEqual(iosDeviceContextHelp('spanning-tree ?', 'interface', switchNode, 'g0/1')?.map(line => line.trim().split(/\s+/)[0]), ['portfast', 'bpduguard']);
  assert.equal(iosDeviceContextHelp('spanning-tree ?', 'interface', router, 'g0/0')?.[0], '% Unrecognized command');
  assert.equal(iosDeviceContextHelp('spanning-tree ?', 'config', router)?.[0], '% Unrecognized command');
  const session = { ...boot(switchNode.name, switchNode.role), mode: 'config' as const };
  const sessions = { [switchNode.id]: session };
  assert.equal(executeNetworkCommand(switchNode, topology, sessions, 'spanning-tree mode rapid-pvst').accepted, true);
  assert.equal(executeNetworkCommand(switchNode, topology, sessions, 'spanning-tree mode pvst').accepted, true);
  assert.equal(executeNetworkCommand(switchNode, topology, sessions, 'spanning-tree mode mst').accepted, false);
  assert.equal(executeNetworkCommand(switchNode, topology, sessions, 'spanning-tree vlan 10 root primary').accepted, true);
  assert.equal(executeNetworkCommand(switchNode, topology, sessions, 'spanning-tree vlan 10 priority 8192').accepted, true);
});

test('do help lists EXEC commands from config modes and delegates deeper', () => {
  const words = (value: string | null | undefined) => (value || '').split('\n').map(line => line.trim().split(/\s+/)[0]);
  const doHelp = iosDeviceContextHelp('do ?', 'config', switchNode)!;
  assert.ok(doHelp.some(line => line.startsWith('show')));
  assert.ok(doHelp.some(line => line.startsWith('ping')));
  assert.ok(doHelp.some(line => line.startsWith('copy')));
  assert.deepEqual(words(iosDeviceContextHelp('do show spanning-tree ?', 'config', switchNode)?.join('\n')).filter(Boolean), ['<cr>', 'vlan', 'root', 'summary', 'interface']);
  assert.ok(iosDeviceContextHelp('do show ?', 'config', switchNode)?.some(line => line.startsWith('spanning-tree')));
  // do is not offered at the privileged prompt.
  assert.equal(iosDeviceContextHelp('do ?', 'privileged', switchNode)?.[0], '% Unrecognized command');
  // Interface submodes get do as well.
  assert.ok(iosDeviceContextHelp('do ?', 'interface', switchNode, 'g0/1')?.some(line => line.startsWith('show')));
  // A router gets do help too, without switch-only entries.
  const routerDo = iosDeviceContextHelp('do ?', 'config', router)!;
  assert.ok(routerDo.some(line => line.startsWith('show')));
  assert.ok(!iosDeviceContextHelp('do show spanning-tree ?', 'config', router)?.some(line => line.startsWith('vlan')));
});

test('spanning-tree vlan help covers ranges and root choices', () => {
  const words = (lines: string[] | null | undefined) => (lines || []).map(line => line.trim().split(/\s+/)[0]);
  assert.deepEqual(words(iosDeviceContextHelp('spanning-tree vlan ?', 'config', switchNode)), ['WORD']);
  assert.ok(iosDeviceContextHelp('spanning-tree vlan ?', 'config', switchNode)?.some(line => line.includes('1,3-5,7,9-11')));
  assert.deepEqual(words(iosDeviceContextHelp('spanning-tree vlan 1-300 ?', 'config', switchNode)), ['root', 'priority']);
  const rootHelp = iosDeviceContextHelp('spanning-tree vlan 1-300 root ?', 'config', switchNode)!;
  assert.deepEqual(words(rootHelp), ['primary', 'secondary']);
  assert.ok(rootHelp.some(line => line.includes('primary root for this spanning tree')));
  // A router does not get spanning-tree vlan help.
  assert.equal(iosDeviceContextHelp('spanning-tree vlan ?', 'config', router)?.[0], '% Unrecognized command');
});
