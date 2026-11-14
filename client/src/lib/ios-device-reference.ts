import { supportsDeviceCommand } from './capabilities';
import { CDP_NEIGHBOR_INTERFACE_TYPES, CDP_NEIGHBORS_HELP_FOOTER, ETHERCHANNEL_HELP, ETHERCHANNEL_HELP_FOOTER, isCiscoCommand, normalizeCommand, type Mode } from './ios-engine';

export type IosDevice = { name: string; kind: string; role?: string; ports: string[] };

export const IOS_PLATFORM_REFERENCES = {
  router: {
    label: 'Cisco IOS 15.3M&T (ISR syntax)',
    url: 'https://www.cisco.com/c/en/us/support/ios-nx-os-software/ios-15-3m-t/products-command-reference-list.html',
  },
  switch: {
    label: 'Catalyst 2960 / IOS 15.2(2)E',
    url: 'https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst2960/software/release/15-2_2_e/command/reference/cr_2960.html',
  },
  layer3Switch: {
    label: 'Catalyst 3560-X / IOS 15.2(2)E',
    url: 'https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst3750x_3560x/software/release/15-2_2_e/command/reference/CR_3750X/ComRef.html',
  },
} as const;

export function iosPlatformReference(device: IosDevice) {
  if (device.kind === 'router') return IOS_PLATFORM_REFERENCES.router;
  if (device.kind === 'switch') return /Layer 3|OSPF Speaker/i.test(device.role || '')
    ? IOS_PLATFORM_REFERENCES.layer3Switch : IOS_PLATFORM_REFERENCES.switch;
  return null;
}

type Entry = { word: string; description: string; example?: string };
const entry = (word: string, description: string, example?: string): Entry => ({ word, description, example });

const NTP_REFERENCE_OPTIONS: Entry[] = [
  entry('access-group', 'Control NTP access'),
  entry('allow', 'Allow processing of packets'),
  entry('authenticate', 'Authenticate time sources'),
  entry('authentication-key', 'Authentication key for trusted time sources'),
  entry('broadcastdelay', 'Estimated round-trip delay'),
  entry('clock-period', 'Length of hardware clock tick'),
  entry('leap-handle', 'Handle leap seconds'),
  entry('logging', 'Enable NTP message logging'),
  entry('master', 'Act as NTP master clock'),
  entry('max-associations', 'Set maximum number of associations'),
  entry('maxdistance', 'Maximum distance for synchronization'),
  entry('mindistance', 'Minimum distance to consider for clock hop'),
  entry('orphan', 'Threshold stratum for orphan mode'),
  entry('panic', 'Reject time updates above the panic threshold'),
  entry('passive', 'NTP passive mode'),
  entry('peer', 'Configure NTP peer'),
  entry('server', 'Configure NTP server', 'ntp server 192.0.2.1'),
  entry('source', 'Configure interface for source address'),
  entry('trusted-key', 'Key numbers for trusted time sources'),
];
const NTP_SWITCH_OPTIONS = new Set(['access-group', 'authenticate', 'authentication-key', 'master', 'peer', 'server', 'source', 'trusted-key']);

// Most help entries are modeled commands. NTP also exposes a clearly marked
// study-only keyword menu because option availability varies by IOS image.
function menu(mode: Mode, stem: string, device: IosDevice, context?: string | null): Entry[] {
  const switchDevice = device.kind === 'switch';
  const routed = device.kind === 'router' || /Layer 3|OSPF Speaker/i.test(device.role || '');
  const ports = device.ports.filter((port) => /^(?:g\d|eth\d|ethernet)/i.test(port));
  // `do` runs privileged EXEC commands from any configuration mode.
  if (mode !== 'user' && mode !== 'privileged' && mode !== 'shell' && (stem === 'do' || stem.startsWith('do '))) {
    if (stem === 'do') {
      return [
        entry('show', 'Show running system information', switchDevice ? 'do show spanning-tree' : routed ? 'do show ip route' : 'do show ip interface brief'),
        entry('ping', 'Send echo messages', 'do ping 192.0.2.1'),
        entry('traceroute', 'Trace route to destination', 'do traceroute 192.0.2.1'),
        entry('copy', 'Copy configuration files', 'do copy running-config startup-config'),
        entry('clear', 'Reset functions', 'do clear counters'),
        entry('terminal', 'Set terminal line parameters', 'do terminal length 24'),
      ];
    }
    return menu('privileged', stem.slice(3), device, null).map((candidate) => candidate.example ? { ...candidate, example: `do ${candidate.example}` } : candidate);
  }
  if (mode === 'user' && !stem) return [entry('enable', 'Turn on privileged commands', 'enable')];
  if (mode === 'privileged') {
    if (!stem) return [entry('show', 'Show running system information'), entry('ping', 'Send echo messages'), entry('traceroute', 'Trace route to destination'), entry('configure', 'Enter configuration mode'), entry('copy', 'Copy configuration files'), entry('write', 'Write running configuration'), entry('terminal', 'Set terminal parameters'), entry('disable', 'Return to user EXEC mode')];
    if (stem === 'show') return [
      entry('interfaces', 'Interface status and configuration', 'show interfaces'),
      entry('running-config', 'Current operating configuration', 'show running-config'),
      entry('ip', 'IPv4 information', 'show ip interface brief'),
      entry('ipv6', 'IPv6 information', 'show ipv6 interface brief'),
      entry('cdp', 'CDP neighbors', 'show cdp neighbors'),
      ...(switchDevice ? [entry('vlan', 'VLAN information', 'show vlan brief'), entry('spanning-tree', 'Spanning-tree information', 'show spanning-tree'), entry('mac', 'MAC address table', 'show mac address-table'), entry('etherchannel', 'EtherChannel information', 'show etherchannel summary'), entry('vtp', 'VTP information', 'show vtp status')] : []),
      ...(routed ? [entry('access-lists', 'IP access lists', 'show access-lists'), entry('arp', 'ARP table', 'show arp')] : []),
    ];
    if (stem === 'show ip') return [
      entry('interface', 'Interface IPv4 status', 'show ip interface brief'),
      ...(routed ? [entry('route', 'IP routing table', 'show ip route'), entry('ospf', 'OSPF information', 'show ip ospf neighbor'), entry('dhcp', 'DHCP information', 'show ip dhcp binding'), entry('nat', 'NAT information', 'show ip nat translations')] : []),
    ];
    if (stem === 'show ipv6') return [entry('interface', 'Interface IPv6 status', 'show ipv6 interface brief'), ...(routed ? [entry('route', 'IPv6 routing table', 'show ipv6 route'), entry('neighbors', 'IPv6 neighbor cache', 'show ipv6 neighbors')] : [])];
    if (stem === 'show cdp') return [entry('neighbors', 'Show CDP neighbor entries', 'show cdp neighbors')];
    if (stem === 'show cdp neighbors') return CDP_NEIGHBOR_INTERFACE_TYPES.map(([word, description]) => word === '<cr>' ? entry(word, 'Show CDP neighbor entries', 'show cdp neighbors') : entry(word, description));
    if (stem === 'show etherchannel') return switchDevice ? ETHERCHANNEL_HELP.map(([word, description]) => word === '<1-255>' ? entry(word, description, 'show etherchannel 1') : entry(word, description, `show etherchannel ${word}`)) : [];
    if (stem === 'show vtp') return switchDevice ? [entry('status', 'VTP status', 'show vtp status')] : [];
    if (/^show etherchannel (?:[1-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])$/.test(stem)) return switchDevice ? [entry('detail', 'Detail information', `${stem} detail`), entry('port', 'Port information', `${stem} port`), entry('port-channel', 'Port-channel information', `${stem} port-channel`), entry('protocol', 'Protocol enabled', `${stem} protocol`), entry('summary', 'One-line summary per channel-group', `${stem} summary`)] : [];
    if (stem === 'show interfaces') return [...ports.map((port) => entry(port, 'Interface', `show interfaces ${port}`)), ...(switchDevice ? [entry('status', 'Interface status summary', 'show interfaces status'), entry('trunk', 'Trunking information', 'show interfaces trunk')] : []), entry('counters', 'Interface error counters', 'show interfaces counters errors')];
    if (stem === 'show interfaces counters') return [entry('errors', 'Interface error counters', 'show interfaces counters errors')];
    if (stem === 'show running-config') return [entry('<cr>', 'Display the current configuration', 'show running-config'), entry('interface', 'Interface configuration', `show running-config interface ${ports[0] || 'g0/0'}`)];
    if (stem === 'configure') return [entry('terminal', 'Configure from the terminal', 'configure terminal')];
    if (stem === 'copy') return [entry('running-config', 'Copy the running configuration', 'copy running-config startup-config')];
    if (stem === 'show vlan') return [entry('brief', 'VLAN summary', 'show vlan brief')];
    if (stem === 'show spanning-tree') return [entry('<cr>', 'Display spanning-tree information', 'show spanning-tree'), entry('vlan', 'Spanning tree for one VLAN', 'show spanning-tree vlan 1'), entry('root', 'Spanning-tree root status', 'show spanning-tree root'), entry('summary', 'Spanning-tree summary', 'show spanning-tree summary'), entry('interface', 'Spanning tree for an interface', `show spanning-tree interface ${ports[0] || 'g0/1'} detail`)];
  }
  if (mode === 'config') {
    if (!stem) return [entry('interface', 'Select an interface to configure'), entry('hostname', 'Set the device name'), entry('ip', 'Configure IPv4 parameters'), entry('ipv6', 'Configure IPv6 parameters'), entry('ntp', 'Configure NTP services', 'ntp server 192.0.2.1'), ...(switchDevice ? [entry('vlan', 'Create or select a VLAN'), entry('spanning-tree', 'Configure spanning tree'), entry('vtp', 'Configure VTP', 'vtp mode server')] : []), ...(routed ? [entry('router', 'Configure a routing process'), entry('access-list', 'Add an access-list entry')] : []), entry('end', 'Return to privileged EXEC mode'), entry('exit', 'Return to privileged EXEC mode')];
    if (stem === 'vtp') return switchDevice ? [entry('mode', 'Set VTP mode', 'vtp mode server'), entry('domain', 'Set VTP domain', 'vtp domain CCNAVTP'), entry('version', 'Set VTP version', 'vtp version 2'), entry('password', 'Set VTP password', 'vtp password cisco123')] : [];
    if (stem === 'vtp mode') return switchDevice ? [entry('server', 'VTP server mode', 'vtp mode server'), entry('client', 'VTP client mode', 'vtp mode client'), entry('transparent', 'VTP transparent mode', 'vtp mode transparent')] : [];
    if (stem === 'vtp domain') return switchDevice ? [entry('WORD', 'VTP domain name', 'vtp domain CCNAVTP')] : [];
    if (stem === 'vtp version') return switchDevice ? [entry('1', 'VTP version 1', 'vtp version 1'), entry('2', 'VTP version 2', 'vtp version 2')] : [];
    if (stem === 'vtp password') return switchDevice ? [entry('WORD', 'VTP password', 'vtp password cisco123')] : [];
    if (stem === 'ntp') return routed ? NTP_REFERENCE_OPTIONS : NTP_REFERENCE_OPTIONS.filter(option => NTP_SWITCH_OPTIONS.has(option.word));
    if (stem === 'ntp server') return [entry('A.B.C.D', 'IPv4 address of the NTP server', 'ntp server 192.0.2.1')];
    if (/^ntp server \d{1,3}(?:\.\d{1,3}){3}$/.test(stem)) return [entry('<cr>', 'Configure this NTP server', stem)];
    if (stem === 'interface') return [...ports.map((port) => entry(port, 'Physical interface', `interface ${port}`)), ...(switchDevice ? [entry('vlan', 'Switch virtual interface', 'interface vlan 1')] : []), ...(routed ? [entry('loopback', 'Loopback interface', 'interface loopback 0')] : [])];
    if (stem === 'ip') return [entry('domain-name', 'Set the default domain name', 'ip domain-name example.com'), ...(routed ? [entry('route', 'Configure a static IPv4 route', 'ip route 10.0.0.0 255.0.0.0 10.0.0.1'), entry('dhcp', 'Configure DHCP', 'ip dhcp pool LAB')] : [])];
    if (stem === 'ip dhcp' && routed) return [entry('excluded-address', 'Exclude addresses from DHCP assignment', 'ip dhcp excluded-address 10.10.10.1'), entry('pool', 'Configure a DHCP address pool', 'ip dhcp pool LAB')];
    if (stem === 'ip dhcp excluded-address' && routed) return [entry('A.B.C.D', 'Low IP address', 'ip dhcp excluded-address 10.10.10.1')];
    if (/^ip dhcp excluded-address \d{1,3}(?:\.\d{1,3}){3}$/.test(stem) && routed) return [entry('A.B.C.D', 'High IP address', `${stem} 10.10.10.5`), entry('<cr>', 'Exclude this single IP address', stem)];
    if (/^ip dhcp excluded-address \d{1,3}(?:\.\d{1,3}){3} \d{1,3}(?:\.\d{1,3}){3}$/.test(stem) && routed) return [entry('<cr>', 'Exclude this address range', stem)];
    if (stem === 'ip dhcp pool' && routed) return [entry('WORD', 'Pool name', 'ip dhcp pool LAB')];
    if (stem === 'router') return [...(routed ? [entry('ospf', 'Configure OSPF', 'router ospf 1'), entry('bgp', 'Configure BGP', 'router bgp 65000')] : [])];
    if (stem === 'spanning-tree') return [entry('mode', 'Select spanning-tree mode', 'spanning-tree mode rapid-pvst'), entry('vlan', 'Set root or priority for a VLAN', 'spanning-tree vlan 1 root primary')];
    if (stem === 'spanning-tree mode') return switchDevice ? [entry('pvst', 'Per-Vlan spanning tree mode', 'spanning-tree mode pvst'), entry('rapid-pvst', 'Per-Vlan rapid spanning tree mode', 'spanning-tree mode rapid-pvst')] : [];
    if (switchDevice && stem === 'spanning-tree vlan') return [entry('WORD', 'vlan range, example: 1,3-5,7,9-11')];
    if (switchDevice && /^spanning-tree vlan [\d,-]+$/.test(stem)) return [entry('root', 'Configure root bridge for VLANs'), entry('priority', 'Set spanning-tree priority for VLANs')];
    if (switchDevice && /^spanning-tree vlan [\d,-]+ root$/.test(stem)) return [entry('primary', 'Configure this switch as primary root for this spanning tree'), entry('secondary', 'Configure switch as secondary root')];
  }
  if (mode === 'interface' || mode === 'subinterface') {
    const svi = context?.startsWith('vlan ') || false;
    if (!stem) return [entry('description', 'Add an interface description', 'description Lab interface'), entry('shutdown', 'Disable this interface', 'shutdown'), entry('no', 'Negate a command'), ...(routed || svi ? [entry('ip', 'Configure IPv4 parameters', 'ip address 10.0.0.1 255.255.255.0'), entry('ipv6', 'Configure IPv6 parameters', 'ipv6 address 2001:db8::1/64')] : []), ...(switchDevice && !svi ? [entry('switchport', 'Configure switching characteristics', 'switchport mode access'), entry('spanning-tree', 'Configure interface STP', 'spanning-tree portfast'), entry('channel-group', 'Assign an EtherChannel', 'channel-group 1 mode active')] : []), entry('exit', 'Return to global configuration')];
    if (stem === 'no') return [entry('shutdown', 'Enable the interface', 'no shutdown')];
    if (switchDevice && !svi && stem === 'spanning-tree') return [entry('portfast', 'Enable PortFast on this edge port', 'spanning-tree portfast'), entry('bpduguard', 'Enable BPDU Guard on this port', 'spanning-tree bpduguard enable')];
    if (stem === 'ip') return [entry('address', 'Set an IPv4 address', 'ip address 10.0.0.1 255.255.255.0'), ...(routed ? [entry('helper-address', 'Configure DHCP relay', 'ip helper-address 10.0.0.2'), entry('access-group', 'Apply an IP access list', 'ip access-group 100 in')] : [])];
    if (stem === 'ip helper-address' && routed) return [entry('A.B.C.D', 'DHCP server address', 'ip helper-address 10.20.20.2')];
    if (/^ip helper-address \d{1,3}(?:\.\d{1,3}){3}$/.test(stem) && routed) return [entry('<cr>', 'Configure this relay destination', stem)];
    if (stem === 'ipv6') return [entry('address', 'Set an IPv6 address', 'ipv6 address 2001:db8::1/64'), ...(routed ? [entry('ospf', 'Configure OSPFv3 on this interface', 'ipv6 ospf 1 area 0')] : [])];
    if (switchDevice && !svi && stem === 'switchport') return [entry('mode', 'Set the switchport operating mode', 'switchport mode access'), entry('access', 'Configure an access VLAN', 'switchport access vlan 10'), entry('trunk', 'Configure trunk properties', 'switchport trunk native vlan 1'), entry('voice', 'Configure voice VLAN', 'switchport voice vlan 20'), entry('port-security', 'Configure port security', 'switchport port-security')];
    if (switchDevice && !svi && stem === 'switchport mode') return [
      entry('access', 'Set trunking mode to ACCESS unconditionally', 'switchport mode access'),
      entry('dot1q-tunnel', 'Set trunking mode to TUNNEL unconditionally (reference only)'),
      entry('dynamic', 'Dynamically negotiate access or trunk mode (reference only)'),
      entry('private-vlan', 'Set private-VLAN mode (reference only)'),
      entry('trunk', 'Set trunking mode to TRUNK unconditionally', 'switchport mode trunk'),
    ];
    if (switchDevice && !svi && stem === 'switchport trunk') return [entry('native', 'Set native VLAN', 'switchport trunk native vlan 1'), entry('allowed', 'Set allowed VLANs', 'switchport trunk allowed vlan 1')];
  }
  if (mode === 'router') {
    if (!stem) return [entry('network', 'Advertise an IPv4 network', 'network 10.0.0.0 0.0.0.255 area 0'), entry('router-id', 'Configure the router ID', 'router-id 1.1.1.1'), entry('passive-interface', 'Suppress OSPF packets', 'passive-interface default'), entry('area', 'Configure an OSPF area', 'area 1 stub'), entry('exit', 'Return to global configuration')];
    if (stem === 'area') return [entry('<area-id>', 'OSPF area number', 'area 1 stub')];
  }
  if (mode === 'vlan' && !stem) return [entry('name', 'Set the VLAN name', 'name USERS'), entry('exit', 'Return to global configuration')];
  if (mode === 'dhcp') {
    if (!stem) return [entry('network', 'Define the pool subnet', 'network 10.10.10.0 255.255.255.0'), entry('default-router', 'Set the client default gateway', 'default-router 10.10.10.1'), entry('dns-server', 'Set a DNS server for clients', 'dns-server 10.10.10.2'), entry('domain-name', 'Set the client domain name', 'domain-name example.com'), entry('exit', 'Return to global configuration')];
    if (stem === 'network') return [entry('A.B.C.D', 'Network address', 'network 10.10.10.0 255.255.255.0')];
    if (/^network \d{1,3}(?:\.\d{1,3}){3}$/.test(stem)) return [entry('A.B.C.D', 'Network mask', `${stem} 255.255.255.0`)];
    if (stem === 'default-router' || stem === 'dns-server') return [entry('A.B.C.D', 'IPv4 address', `${stem} 10.10.10.1`)];
    if (stem === 'domain-name') return [entry('WORD', 'Domain name', 'domain-name example.com')];
  }
  return [];
}

export function iosDeviceContextHelp(value: string, mode: Mode, device: IosDevice, context?: string | null): string[] | null {
  if (mode === 'shell' || !value.trimEnd().endsWith('?')) return null;
  if (!iosPlatformReference(device)) return [`% ${device.name} is not a Cisco IOS device. Select a Cisco router or switch for IOS help.`];
  const beforeQuestion = value.trimEnd().slice(0, -1);
  const hasSpace = /\s$/.test(beforeQuestion);
  const stem = normalizeCommand(beforeQuestion);
  let options = hasSpace || !stem ? menu(mode, stem, device, context) : [];
  if (!hasSpace && stem) {
    const split = stem.lastIndexOf(' ');
    const parent = split < 0 ? '' : stem.slice(0, split);
    const prefix = stem.slice(split + 1);
    options = menu(mode, parent, device, context).filter((candidate) => candidate.word.toLowerCase().startsWith(prefix));
  }
  const available = options.filter((candidate) => !candidate.example || (isCiscoCommand(candidate.example, mode) && supportsDeviceCommand(candidate.example, device, context)));
  if (available.length) {
    const lines = available.map(({ word, description }) => `${word.padEnd(30)} ${description}`);
    if (mode === 'config' && stem === 'ntp') lines.push('Study reference: keyword availability varies by IOS image; only ntp server is simulated.');
    if ((mode === 'interface' || mode === 'subinterface') && stem === 'switchport mode') lines.push('Study reference: availability varies by switch image; only access and trunk forwarding are simulated.');
    if (mode === 'privileged' && stem === 'show cdp neighbors') lines.push(CDP_NEIGHBORS_HELP_FOOTER);
    if (mode === 'privileged' && stem === 'show etherchannel') lines.push(ETHERCHANNEL_HELP_FOOTER);
    return lines;
  }
  if (isCiscoCommand(stem, mode) && supportsDeviceCommand(stem, device, context)) return ['<cr>'];
  return ["% Unrecognized command"];
}
