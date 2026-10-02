import type { LabConfig, LabStep } from './labDefinitions';
import type { Requirement } from '../lib/learning-engine';

type Action = [string, LabStep['requiredMode'], string, string, string];
const mask = '255.255.255.0';
const staticEndpoint = (ip: string, gateway: string) => ['enable', 'configure terminal', 'interface eth0', `ip address ${ip} ${mask}`, 'no shutdown', 'exit', `ip default-gateway ${gateway}`, 'end'];
const inspect = (device: string, command: string, label: string, description: string): Action => [device, 'privileged', command, label, description];
const configure = (device: string, actions: [LabStep['requiredMode'], string, string, string][]): Action[] => [
  [device, 'privileged', 'configure terminal', 'Enter support configuration', 'Make only the changes needed for this ticket.'],
  ...actions.map(([mode, command, label, description]) => [device, mode, command, label, description] as Action),
  [device, 'config', 'end', 'Return to verification', 'Leave configuration mode before testing the repair.'],
];
const save = (device: string): Action[] => [
  inspect(device, 'copy running-config startup-config', 'Save the verified configuration', 'Persist the configuration only after the verification checks.'),
  inspect(device, 'show startup-config', 'Review the saved configuration', 'Compare the saved configuration with the support-ticket requirements.'),
];

function office(tranche: number, endpoints: { name: string; kind: string; role: string; address?: number }[]) {
  const subnet = `10.40.${tranche}`;
  const devices = [
    { id: 'gateway', name: 'CE-R1', kind: 'router', role: 'Office gateway and DHCP service', x: 80, y: 210, ports: ['g0/0'] },
    { id: 'switch', name: 'CE-SW1', kind: 'switch', role: 'IT support access switch', x: 390, y: 210, ports: Array.from({ length: endpoints.length + 1 }, (_, i) => `g0/${i + 1}`) },
    ...endpoints.map((endpoint, i) => ({ id: `endpoint-${i}`, ...endpoint, x: 750 + (i % 2) * 300, y: 70 + Math.floor(i / 2) * 230, ports: ['eth0'] })),
  ];
  const links = [
    { id: 'gateway-access', from: 'gateway', to: 'switch', fromPort: 'g0/0', toPort: 'g0/1' },
    ...endpoints.map((_, i) => ({ id: `access-${i}`, from: 'switch', to: `endpoint-${i}`, fromPort: `g0/${i + 2}`, toPort: 'eth0' })),
  ];
  const commands: Record<string, string[]> = {
    'CE-R1': ['enable', 'configure terminal', 'interface g0/0', `ip address ${subnet}.1 ${mask}`, 'no shutdown', 'end'],
    'CE-SW1': ['enable', 'configure terminal', 'vlan 10', 'name OFFICE', 'exit', ...devices[1].ports.flatMap(port => ['interface ' + port, 'switchport mode access', 'switchport access vlan 10', 'no shutdown', 'exit']), 'end'],
  };
  for (const endpoint of endpoints) commands[endpoint.name] = endpoint.address
    ? staticEndpoint(`${subnet}.${endpoint.address}`, `${subnet}.1`)
    : ['enable', 'configure terminal', 'interface eth0', 'shutdown', 'end'];
  return { subnet, topology: { devices, links }, commands };
}

function build(tranche: 1 | 2 | 3 | 4 | 5, slug: string, title: string, description: string, site: ReturnType<typeof office>, actions: Action[], outcomes: Requirement[]): LabConfig {
  return {
    id: `mt4-tr${tranche}-${slug}`, masterTranche: 4, tranche, type: 'guided', status: 'active', title, description,
    topology: site.topology, initialState: { commands: site.commands }, outcomes,
    steps: actions.map(([targetDevice, requiredMode, expectedCommand, label, detail], index) => ({
      id: index + 1, targetDevice, requiredMode, expectedCommand, label, description: detail,
      successMessage: 'Support evidence recorded. Continue with the next ticket check.', validation: () => true,
    })),
  };
}
const requirement = (device: string, path: string[], value: unknown, label: string): Requirement => ({ device, path, value, label });
const interfaceActions = (port: string, ip: string): [LabStep['requiredMode'], string, string, string][] => [
  ['config', `interface ${port}`, 'Select the endpoint interface', 'Work on the interface connected to the office switch.'],
  ['interface', `ip address ${ip} ${mask}`, 'Assign the documented address', 'Use the ticket address and /24 mask, not an address from another department.'],
  ['interface', 'no shutdown', 'Enable the endpoint interface', 'The endpoint and its connected switchport must both be enabled.'],
  ['interface', 'exit', 'Return to global configuration', 'The default gateway is a global endpoint setting.'],
];

const onboarding = office(1, [
  { name: 'NEW-PC1', kind: 'pc', role: 'New employee workstation' },
  { name: 'CE-SRV1', kind: 'server', role: 'Office application server', address: 10 },
  { name: 'STAFF-PC1', kind: 'pc', role: 'Existing employee control workstation', address: 30 },
]);
onboarding.commands['CE-SW1'].push('configure terminal', 'interface g0/2', 'shutdown', 'end');
const onboardingLab = build(1, 'workstation-onboarding', 'New Employee Workstation Onboarding',
  'Ticket IT-401: bring a new workstation online in office VLAN 10, document its access port, and verify access to the gateway and application server without disrupting an existing employee.', onboarding, [
    inspect('CE-SW1', 'show interfaces status', 'Inspect office switchports', 'Identify the disabled new-employee port g0/2; leave other ports unchanged.'),
    inspect('CE-SW1', 'show vlan brief', 'Confirm the office VLAN', 'VLAN 10 must exist before assigning the workstation port.'),
    inspect('CE-SW1', 'show running-config interface g0/2', 'Read the workstation port configuration', 'Record the current administrative state and VLAN.'),
    inspect('NEW-PC1', 'show ip interface brief', 'Record the new workstation baseline', 'The new workstation currently has no usable address.'),
    inspect('CE-R1', 'show ip interface brief', 'Identify the office gateway', 'Use 10.40.1.1 as the office default gateway.'),
    ...configure('CE-SW1', [
      ['config', 'interface g0/2', 'Select the new workstation port', 'g0/2 is cabled to NEW-PC1.'],
      ['interface', 'description NEW-PC1 EMPLOYEE ONBOARDING', 'Document port ownership', 'Make future service-desk investigations easier.'],
      ['interface', 'switchport mode access', 'Set endpoint access mode', 'An employee workstation does not require a trunk.'],
      ['interface', 'switchport access vlan 10', 'Assign the office VLAN', 'Place the workstation in the same office broadcast domain as the gateway.'],
      ['interface', 'spanning-tree portfast', 'Enable endpoint PortFast', 'Use PortFast on this endpoint port, not on a switch-to-switch link.'],
      ['interface', 'no shutdown', 'Enable the workstation switchport', 'Restore only the intended access port.'],
      ['interface', 'exit', 'Leave the access interface', 'Return to global configuration.'],
    ]),
    ...configure('NEW-PC1', [...interfaceActions('eth0', '10.40.1.20'), ['config', 'ip default-gateway 10.40.1.1', 'Set the workstation gateway', 'Document the router used for off-subnet traffic.']]),
    inspect('NEW-PC1', 'show ip interface brief', 'Verify workstation addressing', 'eth0 should have 10.40.1.20 and be enabled.'),
    inspect('NEW-PC1', 'ping 10.40.1.1', 'Test the gateway', 'Verify modeled request and reply paths to the gateway.'),
    inspect('NEW-PC1', 'ping 10.40.1.10', 'Test the application server', 'A successful ping checks IP connectivity, not application login.'),
    inspect('NEW-PC1', 'show arp', 'Inspect workstation neighbor evidence', 'Compare the modeled neighbor evidence with the tested destinations.'),
    inspect('CE-SW1', 'show interfaces g0/2', 'Verify the access interface', 'Confirm the repaired port is enabled.'),
    inspect('CE-SW1', 'show mac address-table', 'Verify workstation learning', 'Look for the workstation source MAC on g0/2.'),
    inspect('STAFF-PC1', 'ping 10.40.1.10', 'Check the existing employee', 'Confirm the change did not disrupt the control workstation.'),
    ...save('CE-SW1'), ...save('NEW-PC1'),
  ], [requirement('CE-SW1', ['interfaces', 'g0/2', 'shutdown'], false, 'New employee switchport enabled'), requirement('CE-SW1', ['interfaces', 'g0/2', 'accessVlan'], 10, 'Workstation belongs to office VLAN'), requirement('NEW-PC1', ['interfaces', 'eth0', 'ipv4'], ['10.40.1.20 ' + mask], 'Correct workstation address'), requirement('NEW-PC1', ['interfaces', 'eth0', 'shutdown'], false, 'Workstation interface enabled')]);

const services = office(2, [
  { name: 'HELP-PC1', kind: 'pc', role: 'Employee requesting DHCP and DNS support' },
  { name: 'CE-SRV1', kind: 'server', role: 'Internal DNS and application server', address: 10 },
  { name: 'STAFF-PC1', kind: 'pc', role: 'Healthy control workstation', address: 30 },
]);
const servicesLab = build(2, 'dhcp-dns-support', 'DHCP and Internal DNS Service Desk',
  'Ticket IT-402: an employee cannot obtain an address or resolve the internal application name. Build the office DHCP scope, reserve infrastructure addresses, publish a DNS record, and test the employee lease and name resolution.', services, [
    inspect('HELP-PC1', 'show ip interface brief', 'Record the employee address state', 'The employee interface starts disabled and unaddressed.'),
    inspect('CE-SW1', 'show vlan brief', 'Confirm the client broadcast domain', 'The employee, gateway, and DNS server share office VLAN 10.'),
    inspect('CE-R1', 'show ip dhcp pool', 'Inspect existing scopes', 'No office scope is configured yet.'),
    inspect('CE-R1', 'show ip dhcp binding', 'Inspect existing leases', 'Record the baseline before requesting a client lease.'),
    ...configure('CE-R1', [
      ['config', 'ip dhcp excluded-address 10.40.2.1 10.40.2.30', 'Reserve infrastructure addresses', 'Keep the gateway, server, and static control workstation out of the lease range.'],
      ['config', 'ip dhcp pool OFFICE', 'Create the office scope', 'Use one scope for the local /24 office network.'],
      ['dhcp', 'network 10.40.2.0 255.255.255.0', 'Set the DHCP network', 'The pool must match the client VLAN subnet.'],
      ['dhcp', 'default-router 10.40.2.1', 'Advertise the default gateway', 'Clients need the router address, not the DNS server address, as their gateway.'],
      ['dhcp', 'dns-server 10.40.2.10', 'Advertise the internal resolver', 'The DNS server is CE-SRV1.'],
      ['dhcp', 'domain-name office.example', 'Set the training domain', 'This is a local modeled domain, not an Internet DNS registration.'],
      ['dhcp', 'exit', 'Leave the DHCP scope', 'Return to global configuration.'],
    ]),
    ...configure('CE-SRV1', [
      ['config', 'ip dns server', 'Enable modeled DNS service', 'The server will answer the simulator name-resolution requests.'],
      ['config', 'ip host intranet.office.example 10.40.2.10', 'Publish the application name', 'Map the intranet name to the internal server address.'],
    ]),
    inspect('CE-SRV1', 'show hosts', 'Verify the DNS record', 'Confirm the record before changing the client.'),
    ...configure('HELP-PC1', [
      ['config', 'interface eth0', 'Select the employee interface', 'Use the interface cabled to the office switch.'],
      ['interface', 'ip address dhcp', 'Enable DHCP addressing', 'The request waits until the interface is enabled.'],
      ['interface', 'no shutdown', 'Bring up the employee interface', 'This triggers modeled discovery, offer, request, and acknowledgement.'],
      ['interface', 'exit', 'Leave the employee interface', 'Return to global configuration.'],
    ]),
    inspect('HELP-PC1', 'show ip interface brief', 'Verify the assigned lease', 'Check the DHCP address and interface state.'),
    inspect('CE-R1', 'show ip dhcp binding', 'Confirm the server lease', 'The lease address should be outside the excluded range.'),
    inspect('CE-R1', 'show ip dhcp pool', 'Review scope usage', 'Compare the lease count with the requested client.'),
    inspect('HELP-PC1', 'ping 10.40.2.1', 'Test the leased gateway', 'Separate IP connectivity from DNS resolution.'),
    inspect('HELP-PC1', 'nslookup intranet.office.example', 'Verify the internal name', 'The modeled resolver should return 10.40.2.10.'),
    inspect('HELP-PC1', 'ping 10.40.2.10', 'Test the resolved server address', 'Name resolution and IP reachability are separate checks.'),
    inspect('CE-SW1', 'show mac address-table', 'Inspect client Layer 2 learning', 'Confirm the employee MAC is learned on its access port.'),
    ...save('CE-R1'), ...save('CE-SRV1'), ...save('HELP-PC1'),
  ], [requirement('CE-R1', ['dhcpPools', 'office', 'network'], '10.40.2.0', 'Office DHCP network configured'), requirement('CE-R1', ['dhcpPools', 'office', 'defaultRouter'], '10.40.2.1', 'Correct DHCP gateway'), requirement('CE-R1', ['dhcpPools', 'office', 'dnsServer'], '10.40.2.10', 'Internal DNS advertised'), requirement('CE-SRV1', ['dnsServerEnabled'], true, 'DNS service enabled'), requirement('CE-SRV1', ['dnsRecords', 'intranet.office.example'], '10.40.2.10', 'Intranet DNS record published'), requirement('HELP-PC1', ['interfaces', 'eth0', 'dhcpClient'], true, 'Employee uses DHCP')]);

const printing = office(3, [
  { name: 'CE-PRN1', kind: 'printer', role: 'Shared office printer', address: 50 },
  { name: 'HELP-PC1', kind: 'pc', role: 'Employee reporting printer unreachable', address: 20 },
  { name: 'CE-PRN2', kind: 'printer', role: 'Healthy control printer', address: 51 },
  { name: 'CE-SRV1', kind: 'server', role: 'Office services server', address: 10 },
]);
printing.commands['CE-PRN1'] = staticEndpoint('10.99.3.50', '10.99.3.1');
const printingLab = build(3, 'shared-printer-support', 'Shared Printer Connectivity Support',
  'Ticket IT-403: a replacement printer retained an address from another office. Compare it with a healthy printer, restore the documented office address and gateway, and verify employee connectivity. Print drivers and spoolers are outside this network exercise.', printing, [
    inspect('HELP-PC1', 'ping 10.40.3.50', 'Reproduce the reported failure', 'The intended printer address is not currently assigned.'),
    inspect('CE-PRN1', 'show ip interface brief', 'Inspect the replacement printer', 'Identify its incorrect 10.99.3.50 address.'),
    inspect('CE-PRN1', 'show running-config', 'Record printer settings', 'Compare address and gateway with the office ticket.'),
    inspect('CE-PRN2', 'show ip interface brief', 'Compare the healthy printer', 'The control printer uses the correct 10.40.3.0/24 network.'),
    inspect('CE-SW1', 'show interfaces status', 'Check printer link state', 'Rule out an administratively disabled switchport.'),
    inspect('CE-SW1', 'show vlan brief', 'Confirm printer VLAN membership', 'Both printers should be in office VLAN 10.'),
    ...configure('CE-SW1', [
      ['config', 'interface g0/2', 'Select the replacement printer port', 'g0/2 is connected to CE-PRN1.'],
      ['interface', 'description CE-PRN1 SHARED OFFICE PRINTER', 'Label the printer connection', 'Record port ownership for future support tickets.'],
      ['interface', 'switchport mode access', 'Use endpoint access mode', 'Do not trunk the printer link.'],
      ['interface', 'switchport access vlan 10', 'Confirm office VLAN assignment', 'Keep the replacement printer in the office broadcast domain.'],
      ['interface', 'spanning-tree portfast', 'Enable endpoint PortFast', 'This is a printer endpoint, not an uplink.'],
      ['interface', 'no shutdown', 'Confirm printer switchport enabled', 'Keep the access link enabled.'],
      ['interface', 'exit', 'Leave the printer access port', 'Return to global configuration.'],
    ]),
    ...configure('CE-PRN1', [...interfaceActions('eth0', '10.40.3.50'), ['config', 'ip default-gateway 10.40.3.1', 'Correct the printer gateway', 'Replace the old-office gateway with CE-R1.']]),
    inspect('CE-PRN1', 'show ip interface brief', 'Verify the corrected printer address', 'The address should be 10.40.3.50/24.'),
    inspect('CE-PRN1', 'ping 10.40.3.1', 'Test printer gateway reachability', 'Verify modeled request and reply paths.'),
    inspect('HELP-PC1', 'ping 10.40.3.50', 'Retest employee-to-printer connectivity', 'A successful ping confirms network reachability, not a successful print job.'),
    inspect('HELP-PC1', 'ping 10.40.3.51', 'Confirm the control printer still works', 'Verify the repair did not disrupt the second printer.'),
    inspect('CE-SW1', 'show mac address-table', 'Inspect printer MAC learning', 'Compare source entries with the two printer ports.'),
    inspect('CE-SW1', 'show running-config interface g0/2', 'Review the documented printer port', 'Confirm the access VLAN and port description.'),
    ...save('CE-PRN1'), ...save('CE-SW1'),
  ], [requirement('CE-PRN1', ['interfaces', 'eth0', 'ipv4'], ['10.40.3.50 ' + mask], 'Printer uses the office address'), requirement('CE-PRN1', ['interfaces', 'eth0', 'shutdown'], false, 'Printer interface enabled'), requirement('CE-SW1', ['interfaces', 'g0/2', 'accessVlan'], 10, 'Printer remains in office VLAN')]);

const wireless = office(4, [
  { name: 'CE-AP1', kind: 'access-point', role: 'Office access point management uplink', address: 40 },
  { name: 'HELP-PC1', kind: 'pc', role: 'Wired support workstation', address: 20 },
  { name: 'CE-SRV1', kind: 'server', role: 'Office application server', address: 10 },
]);
wireless.commands['CE-AP1'].push('configure terminal', 'dot11 ssid OLD-OFFICE', 'wireless band 2.4ghz', 'wireless channel 1', 'wireless power 10', 'interface eth0', 'shutdown', 'end');
const wirelessLab = build(4, 'wireless-helpdesk', 'Wireless Access Point Support',
  'Ticket IT-404: an office AP has a disabled wired uplink and an outdated RF profile. Restore management connectivity and the documented OFFICE-STAFF / 5 GHz / channel 36 profile. RF coverage, WPA authentication, and actual wireless association are not simulated.', wireless, [
    inspect('CE-AP1', 'show ip interface brief', 'Inspect the AP uplink', 'Identify the disabled management interface.'),
    inspect('CE-AP1', 'show running-config', 'Record the current RF profile', 'Compare SSID, band, channel, and power with the ticket.'),
    inspect('HELP-PC1', 'ping 10.40.4.40', 'Reproduce AP management failure', 'The disabled AP interface cannot answer the modeled probe.'),
    inspect('CE-SW1', 'show interfaces g0/2', 'Check the AP switchport', 'The connected switchport is enabled; investigate the AP side.'),
    inspect('CE-SW1', 'show vlan brief', 'Confirm AP management VLAN', 'The management uplink uses office VLAN 10.'),
    ...configure('CE-AP1', [
      ['config', 'dot11 ssid OFFICE-STAFF', 'Replace the outdated SSID', 'Store the ticket SSID in the modeled AP profile.'],
      ['config', 'wireless band 5ghz', 'Set the requested RF band', 'Use the documented 5 GHz training profile.'],
      ['config', 'wireless channel 36', 'Set the requested RF channel', 'This records channel intent; it does not measure interference or regulatory availability.'],
      ['config', 'wireless power 17', 'Set the modeled power profile', 'Use the ticket value; this is not an RF coverage measurement.'],
      ['config', 'interface eth0', 'Select the AP management uplink', 'The physical uplink connects to CE-SW1 g0/2.'],
      ['interface', 'description OFFICE AP MANAGEMENT', 'Document the AP uplink', 'Label its management purpose.'],
      ['interface', 'no shutdown', 'Restore AP management connectivity', 'Enable the existing correctly addressed interface.'],
      ['interface', 'exit', 'Leave the AP interface', 'Return to global configuration.'],
    ]),
    ...configure('CE-SW1', [
      ['config', 'interface g0/2', 'Select the AP access switchport', 'This scenario uses an untagged management uplink, not multiple SSID VLANs.'],
      ['interface', 'description CE-AP1 OFFICE MANAGEMENT', 'Label the AP switchport', 'Document which AP this port serves.'],
      ['interface', 'switchport mode access', 'Keep management access mode', 'Use the single management VLAN in this exercise.'],
      ['interface', 'switchport access vlan 10', 'Confirm the management VLAN', 'Match the gateway and support workstation broadcast domain.'],
      ['interface', 'no shutdown', 'Confirm the AP switchport enabled', 'Both ends must be enabled for management connectivity.'],
      ['interface', 'exit', 'Leave the AP switchport', 'Return to global configuration.'],
    ]),
    inspect('CE-AP1', 'show running-config', 'Verify the corrected RF profile', 'Read SSID, band, channel, and power from configuration evidence.'),
    inspect('CE-AP1', 'show ip interface brief', 'Verify AP management interface', 'Confirm eth0 is enabled with 10.40.4.40.'),
    inspect('HELP-PC1', 'ping 10.40.4.40', 'Retest AP management connectivity', 'Verify wired management reachability; do not infer client association.'),
    inspect('CE-AP1', 'ping 10.40.4.1', 'Test AP-to-gateway connectivity', 'Confirm the AP can reach the office gateway.'),
    inspect('CE-SW1', 'show mac address-table', 'Verify AP source learning', 'Look for the AP source on g0/2.'),
    ...save('CE-AP1'), ...save('CE-SW1'),
  ], [requirement('CE-AP1', ['interfaces', 'eth0', 'shutdown'], false, 'AP uplink enabled'), requirement('CE-AP1', ['settings', 'config:global', 'dot11 ssid'], 'office-staff', 'Office SSID configured'), requirement('CE-AP1', ['settings', 'config:global', 'wireless band'], '5ghz', '5 GHz profile configured'), requirement('CE-AP1', ['settings', 'config:global', 'wireless channel'], '36', 'Ticket channel configured'), requirement('CE-AP1', ['settings', 'config:global', 'wireless power'], '17', 'Ticket power configured')]);

const remote = office(5, [
  { name: 'ADMIN-PC1', kind: 'pc', role: 'IT administration workstation', address: 20 },
  { name: 'STAFF-PC1', kind: 'pc', role: 'Employee connectivity control', address: 30 },
  { name: 'CE-SRV1', kind: 'server', role: 'Office services server', address: 10 },
]);
const remoteLab = build(5, 'secure-remote-support', 'Secure Remote Administration Handoff',
  'Ticket IT-405: give the support team a documented management SVI and SSH-only VTY configuration. Verify management reachability, local authentication intent, and saved configuration. This models configuration, not a live SSH login or cryptographic handshake.', remote, [
    inspect('CE-SW1', 'show ip interface brief', 'Inspect management addressing', 'No management SVI address is configured yet.'),
    inspect('CE-SW1', 'show vlan brief', 'Verify management VLAN exists', 'This introductory office exercise uses VLAN 10 for management.'),
    inspect('CE-SW1', 'show running-config | section line vty', 'Inspect remote-access policy', 'Record the current VTY configuration before changing it.'),
    inspect('CE-SW1', 'show running-config | section username', 'Inspect local authentication intent', 'No support account is configured yet.'),
    inspect('ADMIN-PC1', 'show ip interface brief', 'Confirm the admin workstation', 'ADMIN-PC1 is already in the office subnet.'),
    ...configure('CE-SW1', [
      ['config', 'interface vlan 10', 'Select the management SVI', 'Assign management addressing to an SVI, not to a Layer 2 physical port.'],
      ['interface', 'description IT SUPPORT MANAGEMENT', 'Document the management interface', 'Record its support-team purpose.'],
      ['interface', 'ip address 10.40.5.2 255.255.255.0', 'Assign the management address', 'Use the documented switch management address.'],
      ['interface', 'no shutdown', 'Enable the management SVI', 'The modeled management interface must be enabled.'],
      ['interface', 'exit', 'Leave the management SVI', 'Configure the gateway globally.'],
      ['config', 'ip default-gateway 10.40.5.1', 'Set the management gateway', 'Use the office router for off-subnet management traffic.'],
      ['config', 'ip domain-name office.example', 'Set the SSH domain', 'Supply the device-domain prerequisite for the training key-generation command.'],
      ['config', 'username support privilege 15 secret TRAINING-ONLY-405', 'Create a training support account', 'This is a simulator-only credential. Never reuse it on production equipment.'],
      ['config', 'crypto key generate rsa modulus 2048', 'Record RSA key-generation intent', 'The simulator records the command; it does not generate production cryptographic keys.'],
      ['config', 'line vty 0 4', 'Select remote terminal lines', 'Configure the remote-access policy in VTY context.'],
      ['line', 'login local', 'Use local authentication', 'Require the modeled local account instead of unauthenticated access.'],
      ['line', 'transport input ssh', 'Restrict VTY transport to SSH', 'Do not enable Telnet in this support handoff.'],
      ['line', 'exec-timeout 5 0', 'Set a five-minute idle timeout', 'Record the requested idle-session timeout.'],
      ['line', 'exit', 'Leave the VTY lines', 'Return to global configuration.'],
    ]),
    inspect('CE-SW1', 'show ip interface brief', 'Verify management SVI evidence', 'Vlan 10 should show 10.40.5.2 and be enabled.'),
    inspect('CE-SW1', 'show running-config | section line vty', 'Verify SSH-only VTY intent', 'Check login local, transport input ssh, and the timeout.'),
    inspect('CE-SW1', 'show running-config | section username', 'Verify the support account intent', 'Review the simulator account configuration without treating it as a live login test.'),
    inspect('CE-SW1', 'show running-config | section crypto', 'Verify key-generation configuration evidence', 'Confirm the authored key-generation command is recorded.'),
    inspect('ADMIN-PC1', 'ping 10.40.5.2', 'Test switch management reachability', 'Verify modeled request and reply paths to the management SVI; this is not an SSH login test.'),
    inspect('STAFF-PC1', 'ping 10.40.5.10', 'Verify employee traffic is unaffected', 'Confirm the management configuration did not disrupt the office application path.'),
    inspect('CE-SW1', 'show running-config interface vlan 10', 'Review the management handoff', 'Verify the documented SVI configuration before saving.'),
    ...save('CE-SW1'),
  ], [requirement('CE-SW1', ['interfaces', 'vlan 10', 'ipv4'], ['10.40.5.2 ' + mask], 'Management SVI has the ticket address'), requirement('CE-SW1', ['interfaces', 'vlan 10', 'shutdown'], false, 'Management SVI enabled'), requirement('CE-SW1', ['settings', 'config:global', 'ip domain-name'], 'office.example', 'Management domain configured'), requirement('CE-SW1', ['settings', 'line:line vty 0 4', 'login'], 'local', 'VTY uses local authentication'), requirement('CE-SW1', ['settings', 'line:line vty 0 4', 'transport input'], 'ssh', 'VTY accepts SSH only')]);

export const techSupportLabs: Record<string, LabConfig> = Object.fromEntries([
  onboardingLab, servicesLab, printingLab, wirelessLab, remoteLab,
].map(lab => [lab.id, lab]));

for (const [lab, device, gateway] of [
  [onboardingLab, 'NEW-PC1', '10.40.1.1'],
  [printingLab, 'CE-PRN1', '10.40.3.1'],
  [remoteLab, 'CE-SW1', '10.40.5.1'],
] as const) lab.outcomes!.push(requirement(device, ['settings', 'config:global', 'ip default-gateway'], gateway, 'Documented default gateway configured'));
remoteLab.outcomes!.push(
  requirement('CE-SW1', ['settings', 'config:global', 'username support'], 'privilege 15 secret training-only-405', 'Simulator-only support account configured'),
  requirement('CE-SW1', ['runningConfig'], ['crypto key generate rsa modulus 2048'], 'RSA key-generation intent recorded'),
  requirement('CE-SW1', ['settings', 'line:line vty 0 4', 'exec-timeout'], '5 0', 'VTY idle timeout configured'),
);
