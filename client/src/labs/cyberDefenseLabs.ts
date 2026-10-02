import type { LabConfig, LabStep } from './labDefinitions';
import type { Requirement } from '../lib/learning-engine';

type Mode = LabStep['requiredMode'];
type Action = [string, Mode, string, string, string];

const mask = '255.255.255.0';
const requirement = (device: string, path: string[], value: unknown, label: string): Requirement => ({ device, path, value, label });

function topology(tranche: number, endpointRole: string, serviceRole: string, includeAp = false) {
  const devices = [
    { id: 'gateway', name: 'CE-R1', kind: 'router', role: 'Security gateway and incident boundary', x: 90, y: 230, ports: ['g0/0'] },
    { id: 'switch', name: 'CE-SW1', kind: 'switch', role: 'Access switch under investigation', x: 400, y: 230, ports: ['g0/1', 'g0/2', 'g0/3', 'g0/4'] },
    { id: 'endpoint', name: 'HELP-PC1', kind: 'pc', role: endpointRole, x: 710, y: 80, ports: ['eth0'] },
    { id: 'server', name: 'CE-SRV1', kind: 'server', role: serviceRole, x: 710, y: 390, ports: ['eth0'] },
    ...(includeAp ? [{ id: 'ap', name: 'CE-AP1', kind: 'access-point', role: 'Wireless access point under review', x: 1010, y: 230, ports: ['eth0'] }] : []),
  ];
  const links = [
    { id: 'gateway-access', from: 'gateway', to: 'switch', fromPort: 'g0/0', toPort: 'g0/1' },
    { id: 'endpoint-access', from: 'switch', to: 'endpoint', fromPort: 'g0/2', toPort: 'eth0' },
    { id: 'service-access', from: 'switch', to: 'server', fromPort: 'g0/3', toPort: 'eth0' },
    ...(includeAp ? [{ id: 'ap-access', from: 'switch', to: 'ap', fromPort: 'g0/4', toPort: 'eth0' }] : []),
  ];
  const subnet = `10.64.${tranche}`;
  const commands: Record<string, string[]> = {
    'CE-R1': ['enable', 'configure terminal', 'interface g0/0', `ip address ${subnet}.1 ${mask}`, 'no shutdown', 'end'],
    'CE-SW1': ['enable', 'configure terminal', 'vlan 10', 'name USERS', 'exit', 'vlan 99', 'name MANAGEMENT', 'exit', 'interface g0/1', 'switchport mode access', 'switchport access vlan 10', 'no shutdown', 'exit', 'interface g0/2', 'switchport mode access', 'switchport access vlan 10', 'no shutdown', 'exit', 'interface g0/3', 'switchport mode access', 'switchport access vlan 10', 'no shutdown', 'exit', 'interface g0/4', 'switchport mode access', 'switchport access vlan 10', 'no shutdown', 'end'],
    'HELP-PC1': ['enable', 'configure terminal', 'interface eth0', `ip address ${subnet}.20 ${mask}`, 'no shutdown', 'exit', `ip default-gateway ${subnet}.1`, 'end'],
    'CE-SRV1': ['enable', 'configure terminal', 'interface eth0', `ip address ${subnet}.10 ${mask}`, 'no shutdown', 'exit', `ip default-gateway ${subnet}.1`, 'end'],
  };
  if (includeAp) commands['CE-AP1'] = ['enable', 'configure terminal', 'interface eth0', `ip address ${subnet}.40 ${mask}`, 'no shutdown', 'end'];
  return { topology: { devices, links }, commands };
}

function build(masterTranche: 4 | 5, tranche: 1 | 2 | 3 | 4 | 5, slug: string, title: string, description: string, site: ReturnType<typeof topology>, actions: Action[], outcomes: Requirement[], troubleshooting = false): LabConfig {
  return {
    id: `mt${masterTranche}-tr${tranche}-${slug}`,
    masterTranche,
    tranche,
    curriculumOrder: 2,
    type: 'guided',
    status: 'active',
    troubleshooting,
    title,
    description,
    topology: site.topology,
    initialState: { commands: site.commands },
    outcomes,
    steps: actions.filter(([, , expectedCommand]) => expectedCommand !== 'enable').map(([targetDevice, requiredMode, expectedCommand, label, detail], index) => ({
      id: index + 1,
      targetDevice,
      requiredMode,
      expectedCommand,
      label,
      description: detail,
      successMessage: 'Defensive evidence recorded. Continue the incident workflow.',
      validation: () => true,
    })),
  };
}

const swInspect = (port: string): Action[] => [
  ['CE-SW1', 'user', 'enable', 'Open the access-switch console', 'Begin with evidence collection before changing the incident state.'],
  ['CE-SW1', 'privileged', 'show interfaces status', 'Review switchport status', 'Identify the affected access or uplink interface.'],
  ['CE-SW1', 'privileged', `show interfaces ${port}`, 'Inspect the affected interface', 'Read link state, speed, and the modeled interface state.'],
  ['CE-SW1', 'privileged', `show running-config interface ${port}`, 'Read the current port intent', 'Compare the running configuration to the approved control.'],
  ['CE-SW1', 'privileged', 'show vlan brief', 'Review VLAN membership', 'Confirm that incident containment does not move unrelated users.'],
  ['CE-SW1', 'privileged', 'show mac address-table', 'Review learned Layer 2 identities', 'Treat MAC evidence as an investigation clue, not proof of an attacker identity.'],
];

const save = (device: string): Action[] => [
  [device, 'privileged', 'copy running-config startup-config', 'Persist the verified control', 'Save only after verification shows the intended defensive state.'],
  [device, 'privileged', 'show startup-config', 'Verify saved configuration', 'Confirm the simulated device retained the remediation.'],
];

const helpdeskRogueDevice = build(4, 1, 'rogue-access-device', 'Rogue Access Device Containment',
  'Ticket SEC-401: a support technician finds an unknown device on an employee access edge. Preserve the employee VLAN while applying approved port-security controls and documenting the investigation. This lab does not identify or attack a real device.',
  topology(1, 'Employee workstation reporting an unknown endpoint', 'Internal ticketing service'), [
    ...swInspect('g0/2'),
    ['CE-SW1', 'privileged', 'configure terminal', 'Enter containment configuration', 'Apply only the approved access-port protections.'],
    ['CE-SW1', 'config', 'interface g0/2', 'Select the employee access port', 'g0/2 is the reported edge, not the router uplink.'],
    ['CE-SW1', 'interface', 'description HELP-PC1 AUTHORIZED ENDPOINT', 'Document approved ownership', 'Record the ticket-approved endpoint purpose.'],
    ['CE-SW1', 'interface', 'switchport mode access', 'Confirm access-port mode', 'Do not create a trunk for an employee endpoint.'],
    ['CE-SW1', 'interface', 'switchport access vlan 10', 'Preserve the user VLAN', 'Contain the incident without disconnecting the department.'],
    ['CE-SW1', 'interface', 'switchport port-security', 'Enable port security', 'Enable the modeled Layer 2 control on the access port.'],
    ['CE-SW1', 'interface', 'switchport port-security maximum 1', 'Limit the port to one MAC', 'One approved endpoint is expected on this workstation connection.'],
    ['CE-SW1', 'interface', 'switchport port-security mac-address sticky', 'Record the learned endpoint identity', 'Sticky learning is modeled configuration intent, not forensic proof.'],
    ['CE-SW1', 'interface', 'switchport port-security violation restrict', 'Set non-destructive violation handling', 'Restrict is used here to preserve evidence during the training incident.'],
    ['CE-SW1', 'interface', 'end', 'Return to verification mode', 'Exit configuration before validating the port.'],
    ['CE-SW1', 'privileged', 'show port-security interface g0/2', 'Verify the containment control', 'Review the modeled port-security state.'],
    ['HELP-PC1', 'user', 'enable', 'Open the employee console', 'Verify that the approved endpoint remains connected.'],
    ['HELP-PC1', 'privileged', 'ping 10.64.1.1', 'Confirm gateway reachability', 'Successful reachability does not prove endpoint trust.'],
    ...save('CE-SW1'),
  ], [requirement('CE-SW1', ['runningConfig'], ['switchport port-security', 'switchport port-security maximum 1', 'switchport port-security mac-address sticky', 'switchport port-security violation restrict'], 'Access port security controls recorded')]);

const helpdeskRemoteAccess = build(4, 2, 'unauthorized-remote-access', 'Unauthorized Remote Access Hardening',
  'Ticket SEC-402: audit a support switch after a suspected remote-access exposure. Establish SSH-only, locally authenticated administrative access and an idle-session limit. Credentials are simulator-only and must never be reused in production.',
  topology(2, 'Support workstation reviewing management access', 'Internal operations service'), [
    ...swInspect('g0/1'),
    ['CE-SW1', 'privileged', 'show users', 'Check current console evidence', 'The simulator shows state, not real session attribution.'],
    ['CE-SW1', 'privileged', 'configure terminal', 'Enter management hardening', 'Apply the approved remote-administration baseline.'],
    ['CE-SW1', 'config', 'ip domain-name support.example', 'Set the management domain', 'Record the SSH domain prerequisite.'],
    ['CE-SW1', 'config', 'username helpdesk privilege 15 secret TRAINING-ONLY-SEC402', 'Create the training administrator', 'This is an instructional secret, not a production credential.'],
    ['CE-SW1', 'config', 'crypto key generate rsa modulus 2048', 'Record RSA key-generation intent', 'The simulator records intent and does not generate a production key pair.'],
    ['CE-SW1', 'config', 'line vty 0 4', 'Select remote terminal lines', 'Harden the remote terminal policy.'],
    ['CE-SW1', 'line', 'login local', 'Require local authentication', 'Use the modeled local account for VTY access.'],
    ['CE-SW1', 'line', 'transport input ssh', 'Restrict access to SSH', 'Do not permit Telnet in the hardened baseline.'],
    ['CE-SW1', 'line', 'exec-timeout 5 0', 'Set idle-session timeout', 'Reduce unattended management-session exposure.'],
    ['CE-SW1', 'line', 'end', 'Return to verification mode', 'Exit the VTY context.'],
    ['CE-SW1', 'privileged', 'show running-config | section line vty', 'Verify VTY policy', 'Confirm local login, SSH-only transport, and timeout intent.'],
    ['CE-SW1', 'privileged', 'show running-config | section username', 'Verify account configuration', 'Inspect configuration evidence without attempting an authentication attack.'],
    ...save('CE-SW1'),
  ], [requirement('CE-SW1', ['settings', 'line:line vty 0 4', 'transport input'], 'ssh', 'VTY accepts SSH only'), requirement('CE-SW1', ['settings', 'line:line vty 0 4', 'login'], 'local', 'VTY requires local authentication')]);

const helpdeskWireless = build(4, 3, 'rogue-wireless-profile', 'Rogue Wireless Profile Review',
  'Ticket SEC-403: an access point is broadcasting an unapproved RF profile after a suspected rogue-profile change. Restore the approved SSID, band, channel, and power intent while confirming management reachability. RF scanning and wireless authentication attacks are out of scope.',
  topology(3, 'Wireless support analyst workstation', 'Wireless management service', true), [
    ['CE-AP1', 'user', 'enable', 'Open the AP console', 'Start at the affected wireless device.'],
    ['CE-AP1', 'privileged', 'show running-config', 'Inspect the wireless profile', 'Compare the modeled profile to the approved ticket.'],
    ['CE-AP1', 'privileged', 'show ip interface brief', 'Check AP management connectivity', 'Confirm the management interface remains operational.'],
    ...swInspect('g0/4'),
    ['CE-AP1', 'privileged', 'configure terminal', 'Enter AP configuration', 'Restore the approved wireless intent.'],
    ['CE-AP1', 'config', 'dot11 ssid OFFICE-SECURE', 'Set the approved SSID', 'The SSID is configuration intent; client association is not simulated.'],
    ['CE-AP1', 'config', 'wireless band 5ghz', 'Select the approved band', 'Use the ticket-approved 5 GHz profile.'],
    ['CE-AP1', 'config', 'wireless channel 36', 'Set the approved channel', 'This records RF intent, not a spectrum measurement.'],
    ['CE-AP1', 'config', 'wireless power 17', 'Set the approved power level', 'Use the documented training value.'],
    ['CE-AP1', 'config', 'end', 'Return to verification mode', 'Leave AP configuration.'],
    ['CE-AP1', 'privileged', 'show running-config', 'Verify the approved wireless profile', 'Confirm the corrective values are recorded.'],
    ['HELP-PC1', 'user', 'enable', 'Open the support workstation', 'Use a separate device for a management-path check.'],
    ['HELP-PC1', 'privileged', 'ping 10.64.3.40', 'Confirm AP management reachability', 'This verifies the wired management path, not wireless coverage.'],
    ...save('CE-AP1'),
  ], [requirement('CE-AP1', ['settings', 'config:global', 'dot11 ssid'], 'office-secure', 'Approved SSID recorded'), requirement('CE-AP1', ['settings', 'config:global', 'wireless band'], '5ghz', 'Approved RF band recorded')]);

const helpdeskDns = build(4, 4, 'phishing-dns-protection', 'Phishing DNS Service Recovery',
  'Ticket SEC-404: employees report a suspicious internal-name result after a phishing event. Restore the approved internal DNS service record and verify name resolution separately from IP reachability. This teaches remediation and validation, not phishing delivery.',
  topology(4, 'Employee who reported a suspicious link', 'Internal DNS and web service'), [
    ['HELP-PC1', 'user', 'enable', 'Open the reporting workstation', 'Collect the user-side address and resolver evidence.'],
    ['HELP-PC1', 'privileged', 'show ip interface brief', 'Record workstation addressing', 'Confirm the local interface is available before testing DNS.'],
    ['HELP-PC1', 'privileged', 'nslookup portal.support.example', 'Reproduce the name-resolution issue', 'The unresolved name is an incident symptom, not proof of compromise.'],
    ['CE-SRV1', 'user', 'enable', 'Open the internal DNS server', 'Review the approved internal service endpoint.'],
    ['CE-SRV1', 'privileged', 'show hosts', 'Inspect current DNS records', 'Compare the available record inventory to the ticket.'],
    ['CE-SRV1', 'privileged', 'configure terminal', 'Enter DNS remediation', 'Publish the approved internal record.'],
    ['CE-SRV1', 'config', 'ip dns server', 'Enable modeled DNS service', 'Enable the simulator DNS responder.'],
    ['CE-SRV1', 'config', 'ip host portal.support.example 10.64.4.10', 'Publish the approved portal address', 'Use the internal service address from the support ticket.'],
    ['CE-SRV1', 'config', 'end', 'Return to verification mode', 'Leave server configuration.'],
    ['CE-SRV1', 'privileged', 'show hosts', 'Verify the approved record', 'Confirm the internal name maps to the expected address.'],
    ['HELP-PC1', 'privileged', 'nslookup portal.support.example', 'Verify employee name resolution', 'Confirm the simulator resolver returns the approved record.'],
    ['HELP-PC1', 'privileged', 'ping 10.64.4.10', 'Verify the internal service path', 'Keep DNS validation distinct from routed reachability.'],
    ['CE-SW1', 'user', 'enable', 'Open the access switch', 'Check Layer 2 evidence after the service test.'],
    ['CE-SW1', 'privileged', 'show mac address-table', 'Review service-path Layer 2 evidence', 'Learned entries are modeled traffic evidence only.'],
    ...save('CE-SRV1'),
  ], [requirement('CE-SRV1', ['dnsServerEnabled'], true, 'Internal DNS service enabled'), requirement('CE-SRV1', ['dnsRecords', 'portal.support.example'], '10.64.4.10', 'Approved portal record published')]);

const helpdeskMalwareContainment = build(4, 5, 'malware-containment-policy', 'Malware Containment Policy',
  'Ticket SEC-405: a workstation is under malware investigation. Apply a least-privilege inbound ACL at the routed security boundary, retain the support-service path, and document that this model does not replace endpoint isolation, EDR, or forensics.',
  topology(5, 'Workstation under malware investigation', 'Patch and evidence collection server'), [
    ...swInspect('g0/2'),
    ['CE-R1', 'privileged', 'configure terminal', 'Enter containment policy configuration', 'Create the named inbound policy before attaching it at the routed boundary.'],
    ['CE-R1', 'config', 'ip access-list extended QUARANTINE-HELP', 'Create the containment ACL', 'Use a named policy to keep incident intent readable.'],
    ['CE-R1', 'acl', 'permit ip host 10.64.5.20 host 10.64.5.10', 'Permit support-server access', 'Allow only the modeled patch and evidence service.'],
    ['CE-R1', 'acl', 'deny ip any any', 'Deny other modeled traffic', 'This is a training ACL and not a complete production containment policy.'],
    ['CE-R1', 'acl', 'exit', 'Return to global configuration', 'Attach the completed ACL at the boundary interface.'],
    ['CE-R1', 'config', 'interface g0/0', 'Select the routed security boundary', 'Apply containment at the gateway, where the policy can be enforced.'],
    ['CE-R1', 'interface', 'description HELP-PC1 INCIDENT QUARANTINE BOUNDARY', 'Document containment state', 'Make the incident state visible to the next technician.'],
    ['CE-R1', 'interface', 'ip access-group QUARANTINE-HELP in', 'Apply the inbound containment policy', 'Attach the named policy to the modeled interface.'],
    ['CE-R1', 'interface', 'end', 'Return to verification mode', 'Exit configuration before reviewing the result.'],
    ['CE-R1', 'privileged', 'show access-lists', 'Verify containment policy entries', 'Review the ordered permit and deny logic.'],
    ['CE-R1', 'privileged', 'show running-config interface g0/0', 'Verify policy attachment', 'Confirm the ACL is associated with the security boundary.'],
    ...save('CE-R1'),
  ], [requirement('CE-R1', ['runningConfig'], ['permit ip host 10.64.5.20 host 10.64.5.10', 'deny ip any any', 'ip access-group QUARANTINE-HELP in'], 'Containment ACL and attachment recorded')]);

const mitm = build(5, 1, 'mitm-arp-defense', 'MITM ARP Defense Investigation',
  'A simulated man-in-the-middle alert reports inconsistent Layer 2 gateway evidence. Inspect ARP and switch forwarding state, then harden the affected access edge with an approved single-endpoint policy. The lab does not provide interception or spoofing instructions.',
  topology(1, 'User reporting a suspicious gateway certificate', 'Approved internal application server'), [
    ...swInspect('g0/2'),
    ['HELP-PC1', 'user', 'enable', 'Open the reporting endpoint', 'Collect endpoint-side evidence without interacting with an attacker.'],
    ['HELP-PC1', 'privileged', 'show arp', 'Inspect gateway ARP evidence', 'Compare the modeled gateway mapping with switch learning.'],
    ['HELP-PC1', 'privileged', 'ping 10.64.1.1', 'Validate the gateway path', 'A ping is reachability evidence, not a certificate or identity validation.'],
    ['CE-SW1', 'privileged', 'configure terminal', 'Enter access-edge hardening', 'Apply the approved prevention control to the reported port.'],
    ['CE-SW1', 'config', 'interface g0/2', 'Select the reported access interface', 'Do not apply endpoint policy to the gateway uplink.'],
    ['CE-SW1', 'interface', 'description HELP-PC1 MITM INVESTIGATION', 'Document the security investigation', 'Preserve operational context for escalation.'],
    ['CE-SW1', 'interface', 'switchport port-security', 'Enable endpoint identity control', 'Enable the modeled port-security control.'],
    ['CE-SW1', 'interface', 'switchport port-security maximum 1', 'Limit accepted source identities', 'The access port should serve one endpoint.'],
    ['CE-SW1', 'interface', 'switchport port-security mac-address sticky', 'Record the authorized endpoint identity', 'Sticky learning is a configuration control, not an attribution tool.'],
    ['CE-SW1', 'interface', 'switchport port-security violation restrict', 'Use evidence-preserving violation handling', 'Restrict retains a modeled incident signal.'],
    ['CE-SW1', 'interface', 'end', 'Return to verification mode', 'Review the protective state.'],
    ['CE-SW1', 'privileged', 'show port-security interface g0/2', 'Verify the MITM mitigation control', 'Confirm the access policy is recorded.'],
    ...save('CE-SW1'),
  ], [requirement('CE-SW1', ['runningConfig'], ['switchport port-security maximum 1', 'switchport port-security mac-address sticky'], 'Single-endpoint MITM mitigation recorded')], true);

const vlanHopping = build(5, 2, 'vlan-hopping-defense', 'VLAN Hopping Defense Investigation',
  'A simulated segmentation alert suggests an unapproved VLAN is present on an access edge. Inspect switchport and trunk evidence, explicitly fix endpoint mode and VLAN membership, and preserve the approved management VLAN. This is defensive configuration review, not VLAN-hopping execution.',
  topology(2, 'Employee endpoint on the investigated edge', 'Approved departmental service'), [
    ...swInspect('g0/2'),
    ['CE-SW1', 'privileged', 'show interfaces trunk', 'Inspect trunk inventory', 'An endpoint port must not appear as a trunk.'],
    ['CE-SW1', 'privileged', 'configure terminal', 'Enter segmentation repair', 'Reapply the approved endpoint-port baseline.'],
    ['CE-SW1', 'config', 'interface g0/2', 'Select the user access interface', 'g0/2 is cabled to the employee endpoint.'],
    ['CE-SW1', 'interface', 'description HELP-PC1 USERS VLAN 10', 'Document the intended access role', 'Record a clear interface purpose.'],
    ['CE-SW1', 'interface', 'switchport mode access', 'Force access-port mode', 'Prevent the interface from serving as a modeled trunk.'],
    ['CE-SW1', 'interface', 'switchport access vlan 10', 'Restore approved user VLAN', 'Place the endpoint back in its authorized broadcast domain.'],
    ['CE-SW1', 'interface', 'spanning-tree portfast', 'Enable endpoint forwarding behavior', 'Apply PortFast only to the endpoint connection.'],
    ['CE-SW1', 'interface', 'spanning-tree bpduguard enable', 'Guard against unexpected bridge messages', 'Use BPDU Guard as a defensive endpoint control.'],
    ['CE-SW1', 'interface', 'end', 'Return to verification mode', 'Review the final interface state.'],
    ['CE-SW1', 'privileged', 'show interfaces g0/2 switchport', 'Verify endpoint switchport mode', 'Confirm the port is modeled as access VLAN 10.'],
    ['CE-SW1', 'privileged', 'show vlan brief', 'Verify segmentation inventory', 'Ensure the user VLAN remains present.'],
    ['HELP-PC1', 'user', 'enable', 'Open the employee endpoint', 'Perform a limited post-repair reachability check.'],
    ['HELP-PC1', 'privileged', 'ping 10.64.2.1', 'Verify approved gateway reachability', 'Confirm the authorized path remains available.'],
    ...save('CE-SW1'),
  ], [requirement('CE-SW1', ['interfaces', 'g0/2', 'switchportMode'], 'access', 'Investigated port is access-only'), requirement('CE-SW1', ['interfaces', 'g0/2', 'accessVlan'], 10, 'Investigated port belongs to VLAN 10')], true);

const dhcpRogue = build(5, 3, 'rogue-dhcp-triage', 'Rogue DHCP Triage and Recovery',
  'A simulated rogue-DHCP alert reports that a user received inconsistent addressing. Establish the approved DHCP scope and excluded infrastructure range, then renew modeled endpoint addressing and verify the expected lease. The lab does not simulate rogue-server deployment.',
  topology(3, 'Endpoint with suspicious address-assignment symptoms', 'Approved DHCP and DNS service'), [
    ['HELP-PC1', 'user', 'enable', 'Open the affected endpoint', 'Collect address evidence before changing the scope.'],
    ['HELP-PC1', 'privileged', 'show ip interface brief', 'Inspect current address state', 'Use the interface state as an incident baseline.'],
    ['CE-R1', 'user', 'enable', 'Open the gateway and DHCP service', 'Inspect the approved source of address assignment.'],
    ['CE-R1', 'privileged', 'show ip dhcp pool', 'Inspect approved DHCP scopes', 'No trusted scope is configured in this simulated incident.'],
    ['CE-R1', 'privileged', 'show ip dhcp binding', 'Inspect current leases', 'Record the lease baseline.'],
    ['CE-R1', 'privileged', 'configure terminal', 'Enter DHCP recovery configuration', 'Create the authorized local scope.'],
    ['CE-R1', 'config', 'ip dhcp excluded-address 10.64.3.1 10.64.3.30', 'Reserve infrastructure addresses', 'Keep gateway and static services outside the lease pool.'],
    ['CE-R1', 'config', 'ip dhcp pool TRUSTED-USERS', 'Create the trusted user scope', 'Use the documented user subnet.'],
    ['CE-R1', 'dhcp', 'network 10.64.3.0 255.255.255.0', 'Set the trusted network', 'The scope must match the user VLAN subnet.'],
    ['CE-R1', 'dhcp', 'default-router 10.64.3.1', 'Advertise the trusted gateway', 'Clients require the legitimate gateway address.'],
    ['CE-R1', 'dhcp', 'dns-server 10.64.3.10', 'Advertise trusted DNS', 'Use the approved internal resolver.'],
    ['CE-R1', 'dhcp', 'exit', 'Leave DHCP configuration', 'Return to global configuration.'],
    ['CE-R1', 'config', 'end', 'Return to verification mode', 'Review scope state before client renewal.'],
    ['HELP-PC1', 'privileged', 'configure terminal', 'Enter endpoint configuration', 'Request a new modeled address from the trusted scope.'],
    ['HELP-PC1', 'config', 'interface eth0', 'Select the endpoint interface', 'Use the cabled user interface.'],
    ['HELP-PC1', 'interface', 'ip address dhcp', 'Request DHCP addressing', 'The modeled client requests a lease after the interface is enabled.'],
    ['HELP-PC1', 'interface', 'no shutdown', 'Enable the endpoint interface', 'Complete the modeled DHCP exchange.'],
    ['HELP-PC1', 'interface', 'end', 'Return to verification mode', 'Review the assigned client state.'],
    ['HELP-PC1', 'privileged', 'show ip interface brief', 'Verify trusted client addressing', 'Confirm an address is assigned from the approved scope.'],
    ['CE-R1', 'privileged', 'show ip dhcp binding', 'Verify the trusted lease', 'Check the modeled binding at the authorized DHCP service.'],
    ...save('CE-R1'),
  ], [requirement('CE-R1', ['dhcpPools', 'trusted-users', 'network'], '10.64.3.0', 'Trusted DHCP scope configured'), requirement('HELP-PC1', ['interfaces', 'eth0', 'dhcpClient'], true, 'Endpoint uses DHCP')], true);

const ospfInjection = build(5, 4, 'ospf-route-injection-defense', 'OSPF Route Injection Defense',
  'A simulated routing-security review identifies an untrusted interface participating in OSPF. Inspect control-plane evidence, constrain OSPF participation to the intended transit, and apply message-digest authentication intent. This lab models defensive controls only.',
  topology(4, 'Routing analyst workstation', 'Internal route-monitoring service'), [
    ['CE-R1', 'user', 'enable', 'Open the routing gateway', 'Collect OSPF evidence before applying controls.'],
    ['CE-R1', 'privileged', 'show ip ospf', 'Inspect OSPF process evidence', 'Review current process and area state.'],
    ['CE-R1', 'privileged', 'show ip ospf interface brief', 'Inspect participating interfaces', 'Identify the intended routed interface.'],
    ['CE-R1', 'privileged', 'show ip ospf neighbor', 'Inspect adjacency evidence', 'An adjacency list is operational evidence, not an attack attribution record.'],
    ['CE-R1', 'privileged', 'show ip ospf database', 'Inspect modeled LSDB evidence', 'Use the dashboard and CLI output to compare route-origin evidence.'],
    ['CE-R1', 'privileged', 'configure terminal', 'Enter routing-defense configuration', 'Constrain the instructional OSPF process.'],
    ['CE-R1', 'config', 'router ospf 1', 'Select the OSPF process', 'Apply process-level interface restrictions.'],
    ['CE-R1', 'router', 'passive-interface default', 'Make interfaces passive by default', 'Only explicitly intended transit links should form adjacencies.'],
    ['CE-R1', 'router', 'router-id 10.64.4.1', 'Set a stable router ID', 'Use a documented deterministic identifier.'],
    ['CE-R1', 'router', 'network 10.64.4.0 0.0.0.255 area 0', 'Limit the modeled OSPF network', 'Advertise only the authorized local network.'],
    ['CE-R1', 'router', 'exit', 'Return to global configuration', 'Apply interface authentication intent next.'],
    ['CE-R1', 'config', 'interface g0/0', 'Select the approved transit interface', 'Apply the interface-level OSPF control.'],
    ['CE-R1', 'interface', 'ip ospf authentication message-digest', 'Require message-digest authentication intent', 'The simulator records the protocol-control intent; it does not manage shared keys.'],
    ['CE-R1', 'interface', 'end', 'Return to verification mode', 'Review final OSPF evidence.'],
    ['CE-R1', 'privileged', 'show ip ospf interface brief', 'Verify intended OSPF participation', 'Confirm the modeled interface state.'],
    ['CE-R1', 'privileged', 'show running-config | section router ospf', 'Verify process restrictions', 'Review passive-default and network configuration.'],
    ...save('CE-R1'),
  ], [requirement('CE-R1', ['ospfProcesses', '1', 'passiveInterfaces'], ['default'], 'OSPF defaults to passive interfaces'), requirement('CE-R1', ['interfaces', 'g0/0', 'ospfAuthentication'], 'message-digest', 'OSPF authentication intent configured')], true);

const tlsProxy = build(5, 5, 'tls-proxy-defense', 'TLS Reverse Proxy Defense Review',
  'A simulated application-security incident requires the network team to restore encrypted service exposure through the approved reverse-proxy endpoint. Verify TLS service state and apply a restrictive access policy around the service interface. This is a defensive service-control exercise, not exploitation training.',
  topology(5, 'Application support analyst', 'Internal reverse-proxy application service'), [
    ['CE-R1', 'user', 'enable', 'Open the service gateway', 'Inspect the current encrypted-service state.'],
    ['CE-R1', 'privileged', 'show ip http server secure-status', 'Check TLS service status', 'Confirm whether the modeled HTTPS listener is enabled.'],
    ['CE-R1', 'privileged', 'show ip interface brief', 'Inspect the service interface', 'Review address and administrative state before publishing service intent.'],
    ['CE-R1', 'privileged', 'configure terminal', 'Enter reverse-proxy hardening', 'Enable the approved TLS listener and access policy.'],
    ['CE-R1', 'config', 'ip http secure-server', 'Enable the HTTPS service', 'Expose the modeled service through TLS only.'],
    ['CE-R1', 'config', 'ip http secure-port 443', 'Set the standard TLS service port', 'Use the approved HTTPS port.'],
    ['CE-R1', 'config', 'ip access-list extended HTTPS-ONLY', 'Create the reverse-proxy policy', 'Define a readable service access policy.'],
    ['CE-R1', 'acl', 'permit tcp any host 10.64.5.1', 'Permit modeled HTTPS service traffic', 'This training policy represents the authorized service path.'],
    ['CE-R1', 'acl', 'deny ip any any', 'Deny other modeled traffic', 'Retain a least-privilege default deny.'],
    ['CE-R1', 'acl', 'exit', 'Return to global configuration', 'Attach the completed policy.'],
    ['CE-R1', 'config', 'interface g0/0', 'Select the service interface', 'Apply the policy at the approved boundary.'],
    ['CE-R1', 'interface', 'description TLS REVERSE PROXY SERVICE', 'Document the protected service edge', 'Make service intent visible to future responders.'],
    ['CE-R1', 'interface', 'ip access-group HTTPS-ONLY in', 'Apply the service access policy', 'Attach the named inbound policy.'],
    ['CE-R1', 'interface', 'end', 'Return to verification mode', 'Review the protected service state.'],
    ['CE-R1', 'privileged', 'show ip http server secure-status', 'Verify TLS listener state', 'Confirm the modeled HTTPS listener is active.'],
    ['CE-R1', 'privileged', 'show access-lists', 'Verify reverse-proxy policy', 'Review the explicit permit and deny entries.'],
    ['CE-R1', 'privileged', 'show running-config interface g0/0', 'Verify policy attachment', 'Confirm the service-boundary control is present.'],
    ...save('CE-R1'),
  ], [requirement('CE-R1', ['runningConfig'], ['ip http secure-server', 'ip http secure-port 443', 'permit tcp any host 10.64.5.1', 'deny ip any any', 'ip access-group HTTPS-ONLY in'], 'TLS service and reverse-proxy policy recorded')], true);

export const cyberDefenseLabs: Record<string, LabConfig> = Object.fromEntries([
  helpdeskRogueDevice,
  helpdeskRemoteAccess,
  helpdeskWireless,
  helpdeskDns,
  helpdeskMalwareContainment,
  mitm,
  vlanHopping,
  dhcpRogue,
  ospfInjection,
  tlsProxy,
].map(lab => [lab.id, lab]));
