import type { LabConfig, LabStep } from './labDefinitions';
import type { Requirement } from '../lib/learning-engine';

type Mode = LabStep['requiredMode'];
type Command = [string, Mode, string, string];
type SwitchFault = {
  id: string; tranche: 1 | 2 | 3 | 4; title: string; description: string; port: string; repair: string; note: string;
  devices: any[]; links: any[]; primary: string[]; peer: string[]; outcome: Requirement;
};

function makeSteps(commands: Command[], description: string): LabStep[] {
  return commands.map(([targetDevice, requiredMode, expectedCommand, label], index) => ({
    id: index + 1, targetDevice, requiredMode, expectedCommand, label, description,
    successMessage: 'Evidence recorded. Continue the investigation.', validation: () => true,
  }));
}

function switchWorkflow(fault: SwitchFault): Command[] {
  const a = 'CE-SW1', b = 'CE-SW2', p = fault.port;
  return [
    [a, 'privileged', 'show ip interface brief', 'Establish the local interface baseline'],
    [a, 'privileged', 'show interfaces status', 'Inspect switchport status'],
    [a, 'privileged', 'show interfaces ' + p, 'Inspect the affected physical interface'],
    [a, 'privileged', 'show running-config interface ' + p, 'Read the affected interface configuration'],
    [a, 'privileged', 'show vlan brief', 'Check VLAN membership'],
    [a, 'privileged', 'show mac address-table', 'Check learned Layer 2 evidence'],
    [a, 'privileged', 'show interfaces counters errors', 'Check physical error counters'],
    [a, 'privileged', 'show interfaces trunk', 'Inspect trunk state before repair'],
    [b, 'privileged', 'show ip interface brief', 'Establish the peer interface baseline'],
    [b, 'privileged', 'show interfaces status', 'Inspect the peer switching state'],
    [b, 'privileged', 'show interfaces ' + p, 'Inspect the peer-facing interface'],
    [b, 'privileged', 'show running-config interface ' + p, 'Read the peer interface configuration'],
    [b, 'privileged', 'show vlan brief', 'Confirm peer VLAN membership'],
    [b, 'privileged', 'show mac address-table', 'Compare peer Layer 2 evidence'],
    [b, 'privileged', 'show interfaces trunk', 'Inspect peer trunk state'],
    [a, 'privileged', 'configure terminal', 'Enter repair configuration'],
    [a, 'config', 'interface ' + p, 'Select the affected interface'],
    [a, 'interface', 'description ' + fault.note, 'Document the investigated interface'],
    [a, 'interface', fault.repair, 'Repair the diagnosed fault'],
    [a, 'interface', 'exit', 'Return to global configuration'],
    [a, 'config', 'end', 'Return to verification mode'],
    [a, 'privileged', 'show ip interface brief', 'Verify administrative and protocol state'],
    [a, 'privileged', 'show interfaces ' + p, 'Verify the repaired interface detail'],
    [a, 'privileged', 'show running-config interface ' + p, 'Confirm the saved interface intent'],
    [a, 'privileged', 'show vlan brief', 'Verify VLAN evidence after repair'],
    [a, 'privileged', 'show mac address-table', 'Verify Layer 2 learning after repair'],
    [a, 'privileged', 'show interfaces status', 'Confirm operational switchport status'],
    [b, 'privileged', 'show interfaces ' + p, 'Confirm the peer remains operational'],
    [b, 'privileged', 'show mac address-table', 'Confirm peer learning evidence'],
    [a, 'privileged', 'copy running-config startup-config', 'Persist the verified repair'],
    [a, 'privileged', 'show startup-config', 'Verify the repair was saved'],
  ];
}

const switches = (devices: any[]) => [
  { id: 'sw1', name: 'CE-SW1', kind: 'switch', role: 'Fault-domain access switch', x: 180, y: 210, ports: ['g0/1', 'g0/2', 'g0/3'] },
  { id: 'sw2', name: 'CE-SW2', kind: 'switch', role: 'Distribution peer switch', x: 560, y: 210, ports: ['g0/1', 'g0/2', 'g0/3'] },
  ...devices,
];

function switchBaseline(fault: SwitchFault) {
  const commands: Record<string, string[]> = { 'CE-SW1': [...fault.primary], 'CE-SW2': [...fault.peer] };
  for (const [index, endpoint] of Array.from(fault.devices.entries())) {
    const vlan = fault.tranche === 4 && endpoint.id === 'server' ? 20 : 10;
    commands[endpoint.name] = ['enable', 'configure terminal', `interface ${endpoint.ports[0]}`, `ip address 10.${vlan}.${fault.tranche}.${index + 10} 255.255.255.0`, 'no shutdown', 'end'];
  }
  for (const [id, name] of [['sw1', 'CE-SW1'], ['sw2', 'CE-SW2']]) {
    const existing = commands[name];
    const additions: string[] = ['configure terminal'];
    if (!existing.includes('vlan 10')) additions.push('vlan 10', 'name ENGINEERING', 'exit');
    for (const link of fault.links.filter(link => link.from === id || link.to === id)) {
      const port = link.from === id ? link.fromPort : link.toPort;
      if (existing.includes(`interface ${port}`)) continue;
      const peer = link.from === id ? link.to : link.from;
      // The first LACP cable stays unused; g0/2 is the seeded negotiation fault.
      if (fault.tranche === 4 && peer.startsWith('sw')) continue;
      additions.push(`interface ${port}`);
      if (peer.startsWith('sw')) additions.push('switchport mode trunk', 'switchport trunk allowed vlan 10,20');
      else additions.push('switchport mode access', 'switchport access vlan 10');
      additions.push('no shutdown', 'exit');
    }
    commands[name] = [...existing, ...additions, 'end'];
  }
  return commands;
}

function lacpBaseline(managementIp: string) {
  return ['enable', 'configure terminal',
    ...[[10, 'ENGINEERING'], [20, 'SERVICES'], [99, 'MANAGEMENT'], [999, 'NATIVE_UNUSED']].flatMap(([vlan, name]) => [`vlan ${vlan}`, `name ${name}`, 'exit']),
    'interface vlan 99', `ip address ${managementIp} 255.255.255.0`, 'no shutdown', 'exit',
    'interface port-channel 1', 'switchport mode trunk', 'switchport trunk native vlan 999', 'switchport trunk allowed vlan 10,20,99,999', 'no shutdown', 'exit',
    'interface g0/2', 'switchport mode trunk', 'switchport trunk native vlan 999', 'switchport trunk allowed vlan 10,20,99,999', 'channel-group 1 mode passive', 'no shutdown', 'exit',
    'interface g0/3', 'switchport mode access', `switchport access vlan ${managementIp.endsWith('.1') ? 10 : 20}`, 'no shutdown', 'end'];
}

const switchFaults: SwitchFault[] = [
  {
    id: 'mt5-tr1-repair-port', tranche: 1, title: 'Silent Access Port',
    description: 'An engineering workstation, IP phone, and camera share an access edge. Find and repair the disabled workstation interface without disrupting the rest of the edge.',
    port: 'g0/1', repair: 'no shutdown', note: 'ENG-PC1 ACCESS REPAIRED',
    devices: [
      { id: 'eng', name: 'ENG-PC1', kind: 'pc', role: 'Engineering workstation', x: 70, y: 440, ports: ['eth0'] },
      { id: 'phone', name: 'IP-PHONE1', kind: 'pc', role: 'Voice endpoint', x: 290, y: 440, ports: ['eth0'] },
      { id: 'camera', name: 'CAM-01', kind: 'pc', role: 'IoT surveillance camera', x: 740, y: 440, ports: ['eth0'] },
    ],
    links: [
      { id: 'eng-access', from: 'sw1', to: 'eng', fromPort: 'g0/1', toPort: 'eth0' },
      { id: 'voice-access', from: 'sw1', to: 'phone', fromPort: 'g0/3', toPort: 'eth0' },
      { id: 'uplink', from: 'sw1', to: 'sw2', fromPort: 'g0/2', toPort: 'g0/2' },
      { id: 'camera-access', from: 'sw2', to: 'camera', fromPort: 'g0/1', toPort: 'eth0' },
    ],
    primary: ['enable', 'configure terminal', 'vlan 10', 'name ENGINEERING', 'exit', 'interface g0/1', 'switchport mode access', 'switchport access vlan 10', 'shutdown', 'end'],
    peer: ['enable', 'configure terminal', 'vlan 10', 'name ENGINEERING', 'exit', 'interface g0/1', 'switchport mode access', 'switchport access vlan 10', 'no shutdown', 'end'],
    outcome: { device: 'CE-SW1', path: ['interfaces', 'g0/1', 'shutdown'], value: false, label: 'Engineering access port is enabled' },
  },
  {
    id: 'mt5-tr2-repair-vlan', tranche: 2, title: 'Wrong Department VLAN',
    description: 'Engineering users, a shared printer, and an IoT badge reader are present. Restore the Engineering workstation to VLAN 10 without moving the other departmental devices.',
    port: 'g0/1', repair: 'switchport access vlan 10', note: 'ENG-PC1 VLAN 10 RESTORED',
    devices: [
      { id: 'eng', name: 'ENG-PC1', kind: 'pc', role: 'Engineering workstation', x: 70, y: 440, ports: ['eth0'] },
      { id: 'printer', name: 'ENG-PRN1', kind: 'printer', role: 'Engineering shared printer', x: 390, y: 440, ports: ['eth0'] },
      { id: 'badge', name: 'BADGE-01', kind: 'pc', role: 'IoT badge reader', x: 740, y: 440, ports: ['eth0'] },
    ],
    links: [
      { id: 'eng-access', from: 'sw1', to: 'eng', fromPort: 'g0/1', toPort: 'eth0' },
      { id: 'uplink', from: 'sw1', to: 'sw2', fromPort: 'g0/2', toPort: 'g0/2' },
      { id: 'printer-access', from: 'sw2', to: 'printer', fromPort: 'g0/1', toPort: 'eth0' },
      { id: 'badge-access', from: 'sw2', to: 'badge', fromPort: 'g0/3', toPort: 'eth0' },
    ],
    primary: ['enable', 'configure terminal', 'vlan 10', 'name ENGINEERING', 'exit', 'vlan 20', 'name SALES', 'exit', 'interface g0/1', 'switchport mode access', 'switchport access vlan 20', 'no shutdown', 'end'],
    peer: ['enable', 'configure terminal', 'vlan 10', 'name ENGINEERING', 'exit', 'vlan 20', 'name SALES', 'exit', 'interface g0/1', 'switchport mode access', 'switchport access vlan 10', 'no shutdown', 'end'],
    outcome: { device: 'CE-SW1', path: ['interfaces', 'g0/1', 'accessVlan'], value: 10, label: 'Engineering workstation is in VLAN 10' },
  },
  {
    id: 'mt5-tr3-repair-trunk', tranche: 3, title: 'Pruned Trunk',
    description: 'A surveillance camera and NVR span two switches. VLAN 10 is absent from the uplink allow-list, blocking camera traffic while unrelated VLANs remain available.',
    port: 'g0/2', repair: 'switchport trunk allowed vlan 10,20', note: 'CCTV TRUNK ALLOW-LIST REPAIRED',
    devices: [
      { id: 'camera', name: 'CAM-01', kind: 'pc', role: 'IoT surveillance camera', x: 70, y: 440, ports: ['eth0'] },
      { id: 'nvr', name: 'NVR-01', kind: 'server', role: 'Network video recorder', x: 740, y: 440, ports: ['eth0'] },
      { id: 'tablet', name: 'SEC-TAB1', kind: 'pc', role: 'Security monitoring tablet', x: 390, y: 440, ports: ['eth0'] },
    ],
    links: [
      { id: 'camera-access', from: 'sw1', to: 'camera', fromPort: 'g0/1', toPort: 'eth0' },
      { id: 'trunk', from: 'sw1', to: 'sw2', fromPort: 'g0/2', toPort: 'g0/2' },
      { id: 'nvr-access', from: 'sw2', to: 'nvr', fromPort: 'g0/1', toPort: 'eth0' },
      { id: 'tablet-access', from: 'sw2', to: 'tablet', fromPort: 'g0/3', toPort: 'eth0' },
    ],
    primary: ['enable', 'configure terminal', 'vlan 10', 'name CCTV', 'exit', 'vlan 20', 'name OPERATIONS', 'exit', 'interface g0/2', 'switchport mode trunk', 'switchport trunk allowed vlan 20', 'no shutdown', 'end'],
    peer: ['enable', 'configure terminal', 'vlan 10', 'name CCTV', 'exit', 'vlan 20', 'name OPERATIONS', 'exit', 'interface g0/2', 'switchport mode trunk', 'switchport trunk allowed vlan 10,20', 'no shutdown', 'end'],
    outcome: { device: 'CE-SW1', path: ['interfaces', 'g0/2', 'allowedVlans'], value: '10,20', label: 'CCTV VLAN is allowed across the trunk' },
  },
  {
    id: 'mt5-tr4-repair-lacp', tranche: 4, title: 'LACP Passive Deadlock',
    description: 'An existing office carries Engineering VLAN 10, Services VLAN 20, and Management VLAN 99 over an EtherChannel with native VLAN 999. The access point and application server depend on this trunk. Both LACP partners are passive, so neither starts negotiation.',
    port: 'g0/2', repair: 'channel-group 1 mode active', note: 'LACP INITIATOR ENABLED',
    devices: [
      { id: 'ap', name: 'CE-AP1', kind: 'access-point', role: 'Enterprise wireless access point', x: 70, y: 440, ports: ['eth0'] },
      { id: 'server', name: 'CE-SRV1', kind: 'server', role: 'Application and DNS server', x: 740, y: 440, ports: ['eth0'] },
      { id: 'laptop', name: 'WIFI-PC1', kind: 'pc', role: 'Wireless engineering client', x: 390, y: 440, ports: ['eth0'] },
    ],
    links: [
      { id: 'lacp-1', from: 'sw1', to: 'sw2', fromPort: 'g0/1', toPort: 'g0/1' },
      { id: 'lacp-2', from: 'sw1', to: 'sw2', fromPort: 'g0/2', toPort: 'g0/2' },
      { id: 'ap-access', from: 'sw1', to: 'ap', fromPort: 'g0/3', toPort: 'eth0' },
      { id: 'server-access', from: 'sw2', to: 'server', fromPort: 'g0/3', toPort: 'eth0' },
    ],
    primary: lacpBaseline('10.99.4.1'),
    peer: lacpBaseline('10.99.4.2'),
    outcome: { device: 'CE-SW1', path: ['interfaces', 'g0/2', 'channelMode'], value: 'active', label: 'CE-SW1 starts LACP negotiation' },
  },
];

const ospfCommands: Command[] = [
  ['CE-R1', 'privileged', 'show ip ospf neighbor', 'Check adjacency state'],
  ['CE-R1', 'privileged', 'show ip ospf interface brief', 'Inspect OSPF interface participation'],
  ['CE-R1', 'privileged', 'show ip interface brief', 'Confirm transit interface state'],
  ['CE-R1', 'privileged', 'show ip route ospf', 'Check learned OSPF routes'],
  ['CE-R1', 'privileged', 'show ip ospf database', 'Inspect link-state database evidence'],
  ['CE-R1', 'privileged', 'show running-config | section router ospf', 'Read CE-R1 OSPF configuration'],
  ['CE-R1', 'privileged', 'show ip ospf neighbor', 'Record a second CE-R1 adjacency observation'],
  ['CE-R2', 'privileged', 'show ip ospf neighbor', 'Check peer adjacency state'],
  ['CE-R2', 'privileged', 'show ip ospf interface brief', 'Inspect CE-R2 participation'],
  ['CE-R2', 'privileged', 'show ip interface brief', 'Confirm CE-R2 transit interface'],
  ['CE-R2', 'privileged', 'show ip route ospf', 'Check peer learned routes'],
  ['CE-R2', 'privileged', 'show ip ospf database', 'Inspect peer database evidence'],
  ['CE-R2', 'privileged', 'show running-config | section router ospf', 'Read CE-R2 OSPF configuration'],
  ['CE-R2', 'privileged', 'show ip ospf neighbor', 'Record a second CE-R2 adjacency observation'],
  ['CE-R1', 'privileged', 'configure terminal', 'Enter CE-R1 repair configuration'],
  ['CE-R1', 'config', 'interface g0/0', 'Select the transit interface'],
  ['CE-R1', 'interface', 'description AREA-0 TRANSIT TO CE-R2', 'Document the repaired transit'],
  ['CE-R1', 'interface', 'exit', 'Return to routing configuration'],
  ['CE-R1', 'config', 'router ospf 1', 'Select the OSPF process'],
  ['CE-R1', 'router', 'network 10.0.0.0 0.0.0.3 area 0', 'Repair the area membership'],
  ['CE-R1', 'router', 'exit', 'Return to global configuration'],
  ['CE-R1', 'config', 'end', 'Return to verification mode'],
  ['CE-R1', 'privileged', 'show ip ospf neighbor', 'Verify OSPF adjacency'],
  ['CE-R1', 'privileged', 'show ip ospf interface brief', 'Verify CE-R1 area participation'],
  ['CE-R1', 'privileged', 'show ip route ospf', 'Verify learned routes'],
  ['CE-R1', 'privileged', 'show ip ospf database', 'Verify database synchronization'],
  ['CE-R1', 'privileged', 'show running-config | section router ospf', 'Confirm the repaired process configuration'],
  ['CE-R2', 'privileged', 'show ip ospf neighbor', 'Confirm peer adjacency'],
  ['CE-R2', 'privileged', 'show ip route ospf', 'Confirm peer route learning'],
  ['CE-R1', 'privileged', 'copy running-config startup-config', 'Persist the repaired routing configuration'],
  ['CE-R1', 'privileged', 'show startup-config', 'Verify the OSPF repair was saved'],
];

const ospfLab: LabConfig = {
  id: 'mt5-tr5-repair-ospf', type: 'guided', masterTranche: 5, tranche: 5, status: 'active', troubleshooting: true,
  title: 'OSPF Area Mismatch',
  description: 'A routed services path crosses two routers, a Layer 3 switch, firewall, virtual router, and application server. CE-R1 and CE-R2 cannot form their transit adjacency because their area assignments disagree.',
  topology: { devices: [
    { id: 'r1', name: 'CE-R1', kind: 'router', role: 'Core routing investigation point', x: 100, y: 250, ports: ['g0/0', 'g0/1'] },
    { id: 'r2', name: 'CE-R2', kind: 'router', role: 'Transit routing peer', x: 340, y: 250, ports: ['g0/0', 'g0/1'] },
    { id: 'l3', name: 'CE-L3SW1', kind: 'switch', role: 'Layer 3 services switch', x: 580, y: 100, ports: ['g0/0', 'g0/1'] },
    { id: 'fw', name: 'CE-FW1', kind: 'firewall', role: 'Security transit appliance', x: 580, y: 410, ports: ['g0/0', 'g0/1'] },
    { id: 'vr', name: 'CE-VR1', kind: 'router', role: 'Virtual router services peer', x: 820, y: 250, ports: ['g0/0', 'g0/1'] },
    { id: 'server', name: 'CE-SRV1', kind: 'server', role: 'Application server', x: 900, y: 480, ports: ['eth0'] },
  ], links: [
    { id: 'r1-r2', from: 'r1', to: 'r2', fromPort: 'g0/0', toPort: 'g0/0' },
    { id: 'r2-l3', from: 'r2', to: 'l3', fromPort: 'g0/1', toPort: 'g0/0' },
    { id: 'l3-fw', from: 'l3', to: 'fw', fromPort: 'g0/1', toPort: 'g0/0' },
    { id: 'fw-vr', from: 'fw', to: 'vr', fromPort: 'g0/1', toPort: 'g0/0' },
    { id: 'vr-server', from: 'vr', to: 'server', fromPort: 'g0/1', toPort: 'eth0' },
  ] },
  initialState: { commands: {
    'CE-R1': ['enable', 'configure terminal', 'interface g0/0', 'ip address 10.0.0.1 255.255.255.252', 'no shutdown', 'exit', 'router ospf 1', 'router-id 1.1.1.1', 'network 10.0.0.0 0.0.0.3 area 1', 'end'],
    'CE-R2': ['enable', 'configure terminal', 'interface g0/0', 'ip address 10.0.0.2 255.255.255.252', 'no shutdown', 'exit', 'router ospf 1', 'router-id 2.2.2.2', 'network 10.0.0.0 0.0.0.3 area 0', 'end'],
  } },
  outcomes: [{ device: 'CE-R1', path: ['ospfProcesses', '1', 'networks'], value: [{ network: '10.0.0.0', wildcard: '0.0.0.3', area: 0 }], label: 'CE-R1 transit network belongs to OSPF area 0' }],
  steps: makeSteps(ospfCommands, 'Compare OSPF evidence on both routers, correct the single area mismatch, then verify adjacency and route learning across the wider routed services domain.'),
};

export const troubleshootingLabs: Record<string, LabConfig> = Object.fromEntries([
  ...switchFaults.map(fault => ({
    id: fault.id, type: 'guided' as const, masterTranche: 5 as const, tranche: fault.tranche, status: 'active' as const, troubleshooting: true,
    title: fault.title, description: fault.description,
    topology: { devices: switches(fault.devices), links: fault.links },
    initialState: { commands: switchBaseline(fault) },
    outcomes: [fault.outcome, ...(fault.tranche === 4 ? ['CE-SW1', 'CE-SW2'].flatMap(device => [
      { device, path: ['vlans'], value: { '10': 'ENGINEERING', '20': 'SERVICES', '99': 'MANAGEMENT', '999': 'NATIVE_UNUSED' }, label: `${device}: existing office VLANs preserved` },
      { device, path: ['interfaces', 'g0/2', 'allowedVlans'], value: '10,20,99,999', label: `${device}: office trunk VLANs preserved` },
      { device, path: ['interfaces', 'g0/2', 'nativeVlan'], value: 999, label: `${device}: native VLAN preserved` },
    ]) : [])],
    steps: makeSteps(switchWorkflow(fault), fault.description),
  })),
  ospfLab,
].map(lab => [lab.id, lab]));
