import type { LabConfig, LabStep } from './labDefinitions';
import type { Requirement } from '../lib/learning-engine';
import { simulatedTargetById } from '../lib/simulated-target-range';

type Mode = LabStep['requiredMode'];
type Action = [string, Mode, string, string, string];

const mask = '255.255.255.0';
const requirement = (device: string, path: string[], value: unknown, label: string): Requirement => ({ device, path, value, label });

function standardTopology(tranche: number, clientRole: string, serviceRole: string, secondSwitch = false) {
  const subnet = `10.76.${tranche}`;
  const devices = [
    { id: 'gateway', name: 'CE-R1', kind: 'router', role: 'Authorized assessment boundary', x: 80, y: 230, ports: ['g0/0'] },
    { id: 'switch', name: 'CE-SW1', kind: 'switch', role: 'Blue Team access switch', x: 370, y: 230, ports: ['g0/1', 'g0/2', 'g0/3'] },
    ...(secondSwitch ? [{ id: 'switch-peer', name: 'CE-SW2', kind: 'switch', role: 'Blue Team distribution peer', x: 630, y: 230, ports: ['g0/1', 'g0/2', 'g0/3'] }] : []),
    { id: 'client', name: 'ASSESS-PC1', kind: 'pc', role: clientRole, x: secondSwitch ? 910 : 700, y: 80, ports: ['eth0'] },
    { id: 'server', name: 'CE-SRV1', kind: 'server', role: serviceRole, x: secondSwitch ? 910 : 700, y: 390, ports: ['eth0'] },
  ];
  const links = [
    { id: 'gateway-switch', from: 'gateway', to: 'switch', fromPort: 'g0/0', toPort: 'g0/1' },
    ...(secondSwitch ? [{ id: 'switch-trunk', from: 'switch', to: 'switch-peer', fromPort: 'g0/2', toPort: 'g0/1' }, { id: 'client-access', from: 'switch-peer', to: 'client', fromPort: 'g0/2', toPort: 'eth0' }, { id: 'server-access', from: 'switch-peer', to: 'server', fromPort: 'g0/3', toPort: 'eth0' }] : [{ id: 'client-access', from: 'switch', to: 'client', fromPort: 'g0/2', toPort: 'eth0' }, { id: 'server-access', from: 'switch', to: 'server', fromPort: 'g0/3', toPort: 'eth0' }]),
  ];
  const switchBaseline = (ports: string[]) => ['enable', 'configure terminal', 'vlan 10', 'name ASSESSMENT', 'exit', 'vlan 99', 'name MANAGEMENT', 'exit', ...ports.flatMap(port => [`interface ${port}`, 'switchport mode access', 'switchport access vlan 10', 'no shutdown', 'exit']), 'end'];
  const commands: Record<string, string[]> = {
    'CE-R1': ['enable', 'configure terminal', 'interface g0/0', `ip address ${subnet}.1 ${mask}`, 'no shutdown', 'end'],
    'CE-SW1': switchBaseline(secondSwitch ? ['g0/1', 'g0/2', 'g0/3'] : ['g0/1', 'g0/2', 'g0/3']),
    'ASSESS-PC1': ['enable', 'configure terminal', 'interface eth0', `ip address ${subnet}.20 ${mask}`, 'no shutdown', 'exit', `ip default-gateway ${subnet}.1`, 'end'],
    'CE-SRV1': ['enable', 'configure terminal', 'interface eth0', `ip address ${subnet}.10 ${mask}`, 'no shutdown', 'exit', `ip default-gateway ${subnet}.1`, 'end'],
  };
  if (secondSwitch) commands['CE-SW2'] = switchBaseline(['g0/1', 'g0/2', 'g0/3']);
  return { topology: { devices, links }, commands };
}

function build(tranche: 1 | 2 | 3 | 4 | 5, slug: string, title: string, description: string, site: ReturnType<typeof standardTopology>, actions: Action[], outcomes: Requirement[], curriculumOrder = 1): LabConfig {
  return {
    id: `mt6-tr${tranche}-${slug}`,
    masterTranche: 6,
    tranche,
    curriculumOrder,
    type: 'guided',
    status: 'active',
    troubleshooting: true,
    title,
    description,
    topology: site.topology,
    initialState: { commands: site.commands },
    outcomes,
    steps: actions.map(([targetDevice, requiredMode, expectedCommand, label, detail], index) => ({ id: index + 1, targetDevice, requiredMode, expectedCommand, label, description: detail, successMessage: 'Authorized assessment evidence recorded. Continue the Red Team / Blue Team workflow.', validation: () => true })),
  };
}

const save = (device: string): Action[] => [
  [device, 'privileged', 'copy running-config startup-config', 'Blue Team: save verified controls', 'Persist only the validated simulator configuration.'],
  [device, 'privileged', 'show startup-config', 'Blue Team: verify saved controls', 'Confirm the simulated control remains after saving.'],
];

const blueAssetSite = targetRangeSite(1, 'portal');
seedTargetAccess(blueAssetSite, 'APPLICATION-DMZ', 'TRAINING-PORTAL APPROVED ASSET');
const passiveRecon = build(1, 'blue-authorized-passive-recon', 'Blue Team: Authorized Asset Defense',
  'ATTACKER-KALI inventories the fictional training portal from the authorized assessment edge. Blue Team reviews the switch evidence and hardens that edge against unapproved identities. No external system is contacted.',
  blueAssetSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light portal', 'Red Team: inventory the scoped portal', 'Use the synthetic target alias from the Linux console.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py portal', 'Red Team: record the portal asset', 'Capture the fictional VLAN, zone, and service identity.'],
    ['CE-SW1', 'privileged', 'show cdp neighbors detail', 'Blue Team: collect modeled neighbor evidence', 'Use the in-scope topology relationship evidence.'],
    ['CE-SW1', 'privileged', 'show mac address-table', 'Blue Team: record modeled Layer 2 identities', 'MAC data is an inventory clue, not personal attribution.'],
    ['CE-SW1', 'privileged', 'show interfaces status', 'Blue Team: review access-port baseline', 'Identify the dedicated assessment workstation edge.'],
    ['CE-SW1', 'privileged', 'configure terminal', 'Blue Team: enter endpoint hardening', 'Apply scoped controls only to the assessment port.'],
    ['CE-SW1', 'config', 'interface g0/2', 'Blue Team: select assessment port', 'g0/2 is cabled to ATTACKER-KALI.'],
    ['CE-SW1', 'interface', 'description ATTACKER-KALI AUTHORIZED SCOPE', 'Blue Team: document authorized scope', 'A description preserves the approved assessment context.'],
    ['CE-SW1', 'interface', 'switchport mode access', 'Blue Team: enforce access mode', 'An assessment endpoint is not a trunk.'],
    ['CE-SW1', 'interface', 'switchport access vlan 10', 'Blue Team: retain assessment VLAN', 'Keep the authorized endpoint in its designated segment.'],
    ['CE-SW1', 'interface', 'switchport port-security', 'Blue Team: enable identity control', 'Enable the modeled access-edge control.'],
    ['CE-SW1', 'interface', 'switchport port-security maximum 1', 'Blue Team: limit source identities', 'One approved assessment endpoint is expected.'],
    ['CE-SW1', 'interface', 'switchport port-security mac-address sticky', 'Blue Team: record authorized identity', 'Sticky learning is modeled configuration evidence only.'],
    ['CE-SW1', 'interface', 'end', 'Blue Team: return to verification', 'Review the final control state.'],
    ['CE-SW1', 'privileged', 'show port-security interface g0/2', 'Blue Team: verify edge control', 'Confirm the intended port-security policy.'],
    ...save('CE-SW1'),
  ], [requirement('CE-SW1', ['runningConfig'], ['switchport port-security maximum 1', 'switchport port-security mac-address sticky'], 'Authorized assessment port is protected')]);

const blueWebSite = targetRangeSite(2, 'api');
seedTargetAccess(blueWebSite, 'APPLICATION-DMZ', 'TRAINING-API APPROVED SERVICE');
const webAssessment = build(2, 'blue-web-api-exposure-review', 'Blue Team: Web and API Exposure Review',
  'Red Team validates the modeled web-service exposure within scope; Blue Team enables the approved TLS listener and limits the service boundary with an explicit policy. This teaches evidence-driven web assessment, not payload delivery, exploitation, or credential attacks.',
  blueWebSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light api', 'Red Team: inventory the scoped API', 'Use the fictional API alias from the Linux console.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py api', 'Red Team: document API scope', 'Record synthetic service and zone metadata.'],
    ['CE-R1', 'privileged', 'show ip http server secure-status', 'Blue Team: inspect modeled TLS exposure', 'Read the simulator service state before changing policy.'],
    ['CE-R1', 'privileged', 'show ip interface brief', 'Blue Team: validate service boundary address', 'Confirm the in-scope gateway interface.'],
    ['CE-SW1', 'privileged', 'show mac address-table', 'Blue Team: record service-path Layer 2 evidence', 'Use topology evidence to document the path.'],
    ['CE-R1', 'privileged', 'configure terminal', 'Blue Team: enter service hardening', 'Publish only the approved encrypted listener.'],
    ['CE-R1', 'config', 'ip http secure-server', 'Blue Team: enable TLS listener', 'Use the modeled HTTPS service rather than plaintext service exposure.'],
    ['CE-R1', 'config', 'ip http secure-port 443', 'Blue Team: set approved HTTPS port', 'Document the standard encrypted service port.'],
    ['CE-R1', 'config', 'ip access-list extended ASSESS-HTTPS', 'Blue Team: create service policy', 'Create a named least-privilege policy.'],
    ['CE-R1', 'acl', 'permit tcp any host 10.76.20.81 eq 443', 'Blue Team: permit approved modeled service', 'Permit the fictional API HTTPS listener, not an unrelated gateway address.'],
    ['CE-R1', 'acl', 'deny ip any any', 'Blue Team: deny other modeled traffic', 'Keep an explicit default deny in the instructional policy.'],
    ['CE-R1', 'acl', 'exit', 'Blue Team: return to global configuration', 'Attach the finished policy at the boundary.'],
    ['CE-R1', 'config', 'interface g0/0', 'Blue Team: select service boundary', 'Apply the policy at the routed edge.'],
    ['CE-R1', 'interface', 'ip access-group ASSESS-HTTPS in', 'Blue Team: attach service policy', 'Record the inbound policy attachment.'],
    ['CE-R1', 'interface', 'end', 'Blue Team: return to verification', 'Confirm both service and policy evidence.'],
    ['CE-R1', 'privileged', 'show ip http server secure-status', 'Blue Team: validate remediation evidence', 'Validate the intended TLS state inside the simulator.'],
    ['CE-R1', 'privileged', 'show access-lists', 'Blue Team: review service policy', 'Review the permit and deny order.'],
    ...save('CE-R1'),
  ], [requirement('CE-R1', ['runningConfig'], ['ip http secure-server', 'ip http secure-port 443', 'ip access-group ASSESS-HTTPS in'], 'TLS service boundary hardened')]);

const blueIdentitySite = targetRangeSite(3, 'bastion-1');
seedTargetAccess(blueIdentitySite, 'MANAGEMENT', 'BASTION-01 APPROVED REMOTE ACCESS');
const credentialDefense = build(3, 'blue-credential-access-review', 'Blue Team: Credential and Remote Access Review',
  'Red Team documents modeled remote-access exposure without guessing credentials or attempting login. Blue Team implements an SSH-only, locally authenticated administrative baseline and validates the saved policy.',
  blueIdentitySite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -Pn -p 22 bastion-1', 'Red Team: inventory the scoped SSH listener', 'Use the fictional bastion alias without attempting login.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py bastion-1', 'Red Team: record remote-access scope', 'Capture the synthetic management-zone metadata.'],
    ['CE-SW1', 'privileged', 'show users', 'Blue Team: review console-session evidence', 'Do not treat this simulator output as real identity attribution.'],
    ['CE-SW1', 'privileged', 'show running-config | section line vty', 'Blue Team: review remote-access policy', 'Document current transport and authentication intent.'],
    ['CE-SW1', 'privileged', 'show ip ssh', 'Blue Team: review SSH status', 'Collect service evidence without performing authentication attempts.'],
    ['CE-SW1', 'privileged', 'configure terminal', 'Blue Team: enter access hardening', 'Apply the approved administration baseline.'],
    ['CE-SW1', 'config', 'ip domain-name assessment.example', 'Blue Team: set management domain', 'Record the SSH domain prerequisite.'],
    ['CE-SW1', 'config', 'username blueadmin privilege 15 secret TRAINING-ONLY-MT6', 'Blue Team: create simulator administrator', 'This value is simulator-only and must never be used in production.'],
    ['CE-SW1', 'config', 'crypto key generate rsa modulus 2048', 'Blue Team: record RSA-key intent', 'The simulator records configuration intent, not an actual key pair.'],
    ['CE-SW1', 'config', 'line vty 0 4', 'Blue Team: select remote terminal lines', 'Harden the VTY control plane.'],
    ['CE-SW1', 'line', 'login local', 'Blue Team: require local authentication', 'Require the modeled local account.'],
    ['CE-SW1', 'line', 'transport input ssh', 'Blue Team: restrict to SSH', 'Exclude Telnet from the baseline.'],
    ['CE-SW1', 'line', 'exec-timeout 5 0', 'Blue Team: set idle timeout', 'Reduce unattended-session exposure.'],
    ['CE-SW1', 'line', 'end', 'Blue Team: return to verification', 'Review remote-access evidence.'],
    ['CE-SW1', 'privileged', 'show running-config | section line vty', 'Blue Team: validate remediated policy', 'Confirm SSH-only and local-login intent.'],
    ['CE-SW1', 'privileged', 'show running-config | section username', 'Blue Team: validate account intent', 'Inspect configuration rather than attempting a login.'],
    ...save('CE-SW1'),
  ], [requirement('CE-SW1', ['settings', 'line:line vty 0 4', 'transport input'], 'ssh', 'Remote access is SSH only'), requirement('CE-SW1', ['settings', 'line:line vty 0 4', 'login'], 'local', 'Remote access requires local authentication')]);

const blueSegmentationSite = targetRangeSite(4, 'cam-1', true);
seedTargetAccess(blueSegmentationSite, 'PHYSICAL-SECURITY', 'CAM-01 APPROVED SEGMENTATION');
const lateralMovement = build(4, 'blue-lateral-movement-controls', 'Blue Team: Lateral Movement Control Validation',
  'Red Team uses the modeled topology and trunk state to document a potential lateral-movement path. Blue Team hardens the user access edge and confirms that endpoint ports cannot become modeled trunks. No pivoting, credential access, or lateral movement is executed.',
  blueSegmentationSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light cam-1', 'Red Team: inventory the scoped camera', 'Use the fictional IoT alias from the Linux console.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py cam-1', 'Red Team: record segmentation scope', 'Capture the synthetic camera VLAN and zone.'],
    ['CE-SW1', 'privileged', 'show cdp neighbors', 'Blue Team: inventory network-capable peers', 'Use only the approved modeled topology.'],
    ['CE-SW1', 'privileged', 'show interfaces trunk', 'Blue Team: inspect allowed VLAN paths', 'Document trunk evidence without attempting VLAN traversal.'],
    ['CE-SW2', 'privileged', 'show vlan brief', 'Blue Team: inspect endpoint VLAN membership', 'Confirm the assessment host remains on its assigned VLAN.'],
    ['CE-SW2', 'privileged', 'show interfaces g0/2 switchport', 'Blue Team: inspect user-edge configuration', 'Review the endpoint port before making changes.'],
    ['CE-SW2', 'privileged', 'configure terminal', 'Blue Team: enter edge hardening', 'Apply the explicit access-port baseline.'],
    ['CE-SW2', 'config', 'interface g0/2', 'Blue Team: select assessment endpoint edge', 'g0/2 connects to ATTACKER-KALI.'],
    ['CE-SW2', 'interface', 'description ATTACKER-KALI SEGMENTED ACCESS', 'Blue Team: document segment ownership', 'Make the security boundary visible to operators.'],
    ['CE-SW2', 'interface', 'switchport mode access', 'Blue Team: force access mode', 'Prevent the endpoint edge from acting as a modeled trunk.'],
    ['CE-SW2', 'interface', 'switchport access vlan 10', 'Blue Team: restore assessment VLAN', 'Keep the endpoint in its authorized segment.'],
    ['CE-SW2', 'interface', 'spanning-tree portfast', 'Blue Team: configure endpoint PortFast', 'Use PortFast only on the endpoint edge.'],
    ['CE-SW2', 'interface', 'spanning-tree bpduguard enable', 'Blue Team: enable BPDU Guard', 'Guard against unexpected bridge behavior on the endpoint port.'],
    ['CE-SW2', 'interface', 'end', 'Blue Team: return to verification', 'Confirm the final edge state.'],
    ['CE-SW2', 'privileged', 'show interfaces g0/2 switchport', 'Blue Team: validate access-only evidence', 'Use the evidence to validate remediation, not to bypass it.'],
    ['CE-SW2', 'privileged', 'show mac address-table', 'Blue Team: review endpoint learning', 'Confirm the modeled endpoint is learned on the expected edge.'],
    ...save('CE-SW2'),
  ], [requirement('CE-SW2', ['interfaces', 'g0/2', 'switchportMode'], 'access', 'Assessment edge is access only'), requirement('CE-SW2', ['interfaces', 'g0/2', 'accessVlan'], 10, 'Assessment edge remains in VLAN 10')]);

const blueRoutingSite = targetRangeSite(5, 'monitor-1');
seedTargetAccess(blueRoutingSite, 'OPERATIONS-SERVICES', 'MONITOR-01 APPROVED ROUTING REVIEW');
const capstone = build(5, 'blue-routing-incident-capstone', 'Blue Team: Routing Incident Capstone',
  'Red Team provides a simulated routing-control finding from the authorized lab; Blue Team constrains OSPF participation and adds authentication intent. Together, both teams validate evidence, controls, and reporting-quality configuration state. No route injection is performed.',
  blueRoutingSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light monitor-1', 'Red Team: inventory the scoped monitor', 'Use the fictional operations alias from the Linux console.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py monitor-1', 'Red Team: record control-plane scope', 'Capture the synthetic monitor identity and zone.'],
    ['CE-R1', 'privileged', 'show ip ospf', 'Blue Team: inspect routing process evidence', 'Document modeled process state and scope.'],
    ['CE-R1', 'privileged', 'show ip ospf interface brief', 'Blue Team: identify participating interfaces', 'Use the simulator control-plane evidence only.'],
    ['CE-R1', 'privileged', 'show ip ospf neighbor', 'Blue Team: inspect adjacency evidence', 'Do not attempt to establish unapproved adjacencies.'],
    ['CE-R1', 'privileged', 'show ip ospf database', 'Blue Team: review modeled LSDB evidence', 'Use LSDB evidence to formulate a defensive finding.'],
    ['CE-R1', 'privileged', 'configure terminal', 'Blue Team: enter routing hardening', 'Constrain the authorization boundary in the modeled process.'],
    ['CE-R1', 'config', 'router ospf 1', 'Blue Team: select OSPF process', 'Apply process-level safeguards.'],
    ['CE-R1', 'router', 'router-id 10.76.5.1', 'Blue Team: assign stable router ID', 'Use a documented deterministic identifier.'],
    ['CE-R1', 'router', 'passive-interface default', 'Blue Team: make interfaces passive by default', 'Prevent unplanned adjacency formation.'],
    ['CE-R1', 'router', 'network 10.76.5.0 0.0.0.255 area 0', 'Blue Team: limit advertised network', 'Advertise only the authorized local network.'],
    ['CE-R1', 'router', 'exit', 'Blue Team: return to global configuration', 'Apply the interface protection.'],
    ['CE-R1', 'config', 'interface g0/0', 'Blue Team: select authorized transit interface', 'Apply the modeled OSPF authentication control.'],
    ['CE-R1', 'interface', 'ip ospf authentication message-digest', 'Blue Team: require message-digest intent', 'The simulator records protocol-control intent; it does not manage shared keys.'],
    ['CE-R1', 'interface', 'end', 'Blue Team: return to verification', 'Review the final Purple Team evidence.'],
    ['CE-R1', 'privileged', 'show ip ospf interface brief', 'Blue Team: validate remediation evidence', 'Check the modeled interface participation after hardening.'],
    ['CE-R1', 'privileged', 'show running-config | section router ospf', 'Blue Team: review final process policy', 'Confirm the passive-default and scoped network intent.'],
    ['CE-R1', 'privileged', 'show ip ospf database', 'Purple Team: document post-change evidence', 'Capture the modeled control-plane state for the training report.'],
    ...save('CE-R1'),
  ], [requirement('CE-R1', ['ospfProcesses', '1', 'passiveInterfaces'], ['default'], 'OSPF defaults to passive interfaces'), requirement('CE-R1', ['interfaces', 'g0/0', 'ospfAuthentication'], 'message-digest', 'OSPF authentication intent recorded')]);

const redReconSite = targetRangeSite(1, 'portal');
seedTargetAccess(redReconSite, 'APPLICATION-DMZ', 'training-portal.example AUTHORIZED RECON');
const redPassiveRecon = build(1, 'red-passive-recon', 'Red Team: Scoped Passive Recon',
  `ATTACKER-KALI inventories only the fictional ${redReconSite.target.name} (${redReconSite.target.address}) in the embedded range. Blue Team records the approved assessment edge. The Nmap-shaped output is deterministic synthetic data, never a live probe.`,
  redReconSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light portal', 'Red Team: inventory scoped portal exposure', 'Use Nmap syntax against the in-app alias only.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py portal', 'Red Team: record portal asset context', 'Capture fictional address, VLAN, zone, and permitted work.'],
    ['CE-SW1', 'privileged', 'show interfaces status', 'Blue Team: review portal edge baseline', 'Confirm the synthetic service port state.'],
    ['CE-SW1', 'privileged', 'configure terminal', 'Blue Team: document authorized scope', 'Keep the assessment authorization visible to operators.'],
    ['CE-SW1', 'config', 'interface g0/2', 'Blue Team: select ATTACKER-KALI edge', 'The dedicated attack workstation remains an access endpoint.'],
    ['CE-SW1', 'interface', 'description ATTACKER-KALI AUTHORIZED SCOPE', 'Blue Team: record assessment authorization', 'Document the contained training boundary.'],
    ['CE-SW1', 'interface', 'end', 'Blue Team: return to verification', 'Conclude the evidence collection workflow.'],
    ['CE-SW1', 'privileged', 'show running-config interface g0/2', 'Blue Team: verify scope record', 'Confirm the authorization marker.'],
    ...save('CE-SW1'),
  ], [requirement('CE-SW1', ['runningConfig'], ['description ATTACKER-KALI AUTHORIZED SCOPE'], 'Authorized Red Team scope documented')], 2);

const redWebSite = targetRangeSite(2, 'api');
seedTargetAccess(redWebSite, 'APPLICATION-DMZ', 'training-api.example AUTHORIZED WEB REVIEW');
const redWebValidation = build(2, 'red-web-api-validation', 'Red Team: Web and API Validation',
  `ATTACKER-KALI validates the fictional ${redWebSite.target.name} application boundary with scoped range evidence. Cisco devices show Blue Team policy state; the Linux assessment console never becomes an IOS console.`,
  redWebSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light api', 'Red Team: inventory API service exposure', 'Use the embedded target alias, never a hostname outside the range.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py api', 'Red Team: record API boundary context', 'Capture the synthetic authorization-boundary finding.'],
    ['CE-R1', 'privileged', 'show ip http server secure-status', 'Blue Team: review TLS service state', 'Inspect Cisco-side boundary evidence.'],
    ['CE-R1', 'privileged', 'configure terminal', 'Blue Team: document web assessment boundary', 'Record the approved review context.'],
    ['CE-R1', 'config', 'interface g0/0', 'Blue Team: select service boundary', 'Use the modeled routed edge.'],
    ['CE-R1', 'interface', 'description AUTHORIZED WEB ASSESSMENT BOUNDARY', 'Blue Team: document reviewed exposure', 'Make the approved scope visible to operators.'],
    ['CE-R1', 'interface', 'end', 'Blue Team: return to verification', 'Leave the router in privileged EXEC mode.'],
    ['CE-R1', 'privileged', 'show running-config interface g0/0', 'Blue Team: validate scope documentation', 'Capture final service-boundary evidence.'],
    ...save('CE-R1'),
  ], [requirement('CE-R1', ['runningConfig'], ['description AUTHORIZED WEB ASSESSMENT BOUNDARY'], 'Web assessment boundary documented')], 2);

const redIdentitySite = targetRangeSite(3, 'directory-1');
seedTargetAccess(redIdentitySite, 'IDENTITY-SERVICES', 'DIRECTORY-01 AUTHORIZED IDENTITY REVIEW');
const redIdentityReview = build(3, 'red-identity-policy-review', 'Red Team: Identity Policy Review',
  `ATTACKER-KALI inventories the fictional ${redIdentitySite.target.name} identity boundary. The exercise models service metadata only: it does not perform authentication, credential handling, directory queries, or account activity.`,
  redIdentitySite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light directory-1', 'Red Team: inventory identity-service exposure', 'Use scoped synthetic Nmap evidence only.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py directory-1', 'Red Team: document identity service scope', 'Record fictional service and zone metadata.'],
    ['CE-SW1', 'privileged', 'show running-config | section line vty', 'Blue Team: review management policy', 'Cisco evidence remains on the Cisco device.'],
    ['CE-SW1', 'privileged', 'configure terminal', 'Blue Team: document identity review scope', 'Record the authorized review on the management interface.'],
    ['CE-SW1', 'config', 'interface g0/1', 'Blue Team: select management-facing port', 'Use the modeled gateway-facing connection.'],
    ['CE-SW1', 'interface', 'description AUTHORIZED IDENTITY POLICY REVIEW', 'Blue Team: document assessment scope', 'Preserve context for remediation.'],
    ['CE-SW1', 'interface', 'end', 'Blue Team: return to verification', 'Finish the evidence-only assessment.'],
    ['CE-SW1', 'privileged', 'show running-config interface g0/1', 'Blue Team: validate scope record', 'Confirm the review is documented.'],
    ...save('CE-SW1'),
  ], [requirement('CE-SW1', ['runningConfig'], ['description AUTHORIZED IDENTITY POLICY REVIEW'], 'Identity review scope documented')], 2);

const redSegmentSite = targetRangeSite(4, 'cam-1', true);
seedTargetAccess(redSegmentSite, 'PHYSICAL-SECURITY', 'CAM-01 AUTHORIZED SEGMENTATION REVIEW');
const redSegmentReview = build(4, 'red-segment-path-review', 'Red Team: Segmentation Path Review',
  `ATTACKER-KALI records synthetic ${redSegmentSite.target.name} service and placement metadata while Cisco switches expose the Blue Team segmentation controls. No VLAN hopping, packet crafting, pivoting, or bypass activity is modeled.`,
  redSegmentSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light cam-1', 'Red Team: inventory scoped camera service', 'Use the named synthetic IoT target.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py cam-1', 'Red Team: document camera segment', 'Record asset zone and VLAN context.'],
    ['CE-SW1', 'privileged', 'show interfaces trunk', 'Blue Team: inspect modeled trunk paths', 'Document native and allowed VLAN evidence.'],
    ['CE-SW2', 'privileged', 'configure terminal', 'Blue Team: document segmentation review scope', 'Record the approved assessment on the target edge.'],
    ['CE-SW2', 'config', 'interface g0/3', 'Blue Team: select camera endpoint edge', 'g0/3 is cabled to the fictional camera.'],
    ['CE-SW2', 'interface', 'description AUTHORIZED SEGMENTATION REVIEW', 'Blue Team: document scope', 'Make the exercise context visible to operators.'],
    ['CE-SW2', 'interface', 'end', 'Blue Team: return to verification', 'Conclude the evidence-only review.'],
    ['CE-SW2', 'privileged', 'show running-config interface g0/3', 'Blue Team: validate documented scope', 'Capture final scope evidence.'],
    ...save('CE-SW2'),
  ], [requirement('CE-SW2', ['runningConfig'], ['description AUTHORIZED SEGMENTATION REVIEW'], 'Segmentation review scope documented')], 2);

const redControlSite = targetRangeSite(5, 'monitor-1');
seedTargetAccess(redControlSite, 'OPERATIONS-SERVICES', 'MONITOR-01 AUTHORIZED CONTROL-PLANE REVIEW');
const redControlPlaneReview = build(5, 'red-control-plane-review', 'Red Team: Control Plane Review',
  `ATTACKER-KALI inventories the fictional ${redControlSite.target.name} monitoring service, then Blue Team documents its OSPF control-plane review. No route injection, adjacency formation, or routing modification occurs from the attacker console.`,
  redControlSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light monitor-1', 'Red Team: inventory monitoring service', 'Collect scoped synthetic service metadata.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py monitor-1', 'Red Team: document monitoring scope', 'Record the synthetic operations-service context.'],
    ['CE-R1', 'privileged', 'show ip ospf', 'Blue Team: inspect OSPF process evidence', 'Document process state and configured scope.'],
    ['CE-R1', 'privileged', 'configure terminal', 'Blue Team: document routing review scope', 'Record the authorized assessment boundary.'],
    ['CE-R1', 'config', 'interface g0/0', 'Blue Team: select modeled transit interface', 'Use the gateway boundary interface.'],
    ['CE-R1', 'interface', 'description AUTHORIZED CONTROL PLANE REVIEW', 'Blue Team: document scope', 'Preserve context for follow-up hardening.'],
    ['CE-R1', 'interface', 'end', 'Blue Team: return to verification', 'Conclude the evidence-only review.'],
    ['CE-R1', 'privileged', 'show running-config interface g0/0', 'Blue Team: validate scope documentation', 'Capture final assessment evidence.'],
    ...save('CE-R1'),
  ], [requirement('CE-R1', ['runningConfig'], ['description AUTHORIZED CONTROL PLANE REVIEW'], 'Control-plane review scope documented')], 2);

function seededSimulation(
  tranche: number,
  clientRole: string,
  serviceRole: string,
  seedDevice: string,
  seedCommands: string[],
  secondSwitch = false,
) {
  const site = standardTopology(tranche, clientRole, serviceRole, secondSwitch);
  site.commands[seedDevice].push(...seedCommands);
  return site;
}

function targetRangeSite(tranche: number, targetId: keyof typeof simulatedTargetById, secondSwitch = false) {
  const target = simulatedTargetById[targetId];
  const site = standardTopology(tranche, `${simulatedTargetById['assess-pc'].name} - ${simulatedTargetById['assess-pc'].purpose}`, `${target.name} - ${target.purpose}`, secondSwitch);
  const attacker = site.topology.devices.find(device => device.name === 'ASSESS-PC1')!;
  attacker.name = 'ATTACKER-KALI';
  attacker.role = 'Authorized synthetic Linux attack workstation';
  (attacker as typeof attacker & { terminal?: 'attack' }).terminal = 'attack';
  delete site.commands['ASSESS-PC1'];
  site.commands['ATTACKER-KALI'] = [];
  const server = site.topology.devices.find(device => device.name === 'CE-SRV1')!;
  server.name = target.name;
  server.role = `${target.zone} | ${target.purpose}`;
  site.commands[target.name] = [
    'enable', 'configure terminal', 'interface eth0', `ip address ${target.address.split(':')[0]} ${mask}`,
    'no shutdown', 'exit', `ip default-gateway 10.76.${target.vlan}.1`, 'end',
  ];
  delete site.commands['CE-SRV1'];
  return { site, target };
}

function seedTargetAccess(site: ReturnType<typeof targetRangeSite>, vlanName: string, description: string) {
  const { target } = site;
  const cable = site.site.topology.links.find(link => link.id === 'server-access')!;
  const switchName = site.site.topology.devices.find(device => device.id === cable.from)!.name;
  site.site.commands[switchName].push(
    'configure terminal',
    `vlan ${target.vlan}`,
    `name ${vlanName}`,
    'exit',
    `interface ${cable.fromPort}`,
    'switchport mode access',
    `switchport access vlan ${target.vlan}`,
    `description ${description}`,
    'no shutdown',
    'end',
  );
}

const redServiceSite = targetRangeSite(1, 'legacy-ftp-1');
seedTargetAccess(redServiceSite, 'LEGACY-SERVICES', 'LEGACY-FTP-01 SYNTHETIC SERVICE FINDING');
const redServiceExposureSimulation = build(1, 'red-pentest-service-exposure', 'Red Team Simulation: Scoped Service Exposure',
  `ATTACKER-KALI performs a contained Nmap-shaped inventory of ${redServiceSite.target.name}. The target and result are synthetic; the finding stops at service exposure evidence.`, redServiceSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light legacy-ftp-1', 'Red Team: inventory legacy service', 'Run the real tool-shaped command against only the fictional alias.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py legacy-ftp-1', 'Red Team: record service finding', 'Collect the target dataset and stop at proof of control.'],
    ['CE-SW1', 'privileged', 'configure terminal', 'Blue Team: document finding', 'Record the reviewed exposure at the service edge.'],
    ['CE-SW1', 'config', 'interface g0/3', 'Blue Team: select legacy-service edge', 'The target is cabled to g0/3.'],
    ['CE-SW1', 'interface', 'description LEGACY-FTP-01 FINDING REVIEWED', 'Blue Team: record proof and stop', 'Document the synthetic outcome without service interaction.'],
    ['CE-SW1', 'interface', 'end', 'Blue Team: return to verification', 'Conclude the authorized simulation.'],
    ['CE-SW1', 'privileged', 'show running-config interface g0/3', 'Blue Team: capture finding record', 'Confirm the final evidence marker.'],
    ...save('CE-SW1'),
  ], [requirement('CE-SW1', ['runningConfig'], ['description LEGACY-FTP-01 FINDING REVIEWED'], 'Service-exposure simulation finding documented')], 3);

const redWebBoundarySite = targetRangeSite(2, 'web-1');
seedTargetAccess(redWebBoundarySite, 'APPLICATION-DMZ', 'WEB-01 SYNTHETIC BOUNDARY FINDING');
const redWebBoundarySimulation = build(2, 'red-pentest-web-boundary', 'Red Team Simulation: Web Boundary Validation',
  `ATTACKER-KALI collects scoped service metadata for fictional ${redWebBoundarySite.target.name}. Cisco is used only to document the Blue Team boundary response.`, redWebBoundarySite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light web-1', 'Red Team: inventory web listener', 'Use the named synthetic web target.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py web-1', 'Red Team: document web boundary', 'Capture fictional service metadata, then stop.'],
    ['CE-R1', 'privileged', 'configure terminal', 'Blue Team: enter report documentation', 'Record the authorized assessment result.'],
    ['CE-R1', 'config', 'interface g0/0', 'Blue Team: select web boundary', 'Use the modeled service-facing interface.'],
    ['CE-R1', 'interface', 'description WEB-01 FINDING REVIEWED', 'Blue Team: record proof and stop', 'Document the finding without application exploitation.'],
    ['CE-R1', 'interface', 'end', 'Blue Team: return to verification', 'Finish the safe assessment workflow.'],
    ['CE-R1', 'privileged', 'show running-config interface g0/0', 'Blue Team: capture finding record', 'Verify the simulator finding is documented.'],
    ...save('CE-R1'),
  ], [requirement('CE-R1', ['runningConfig'], ['description WEB-01 FINDING REVIEWED'], 'Web-boundary simulation finding documented')], 3);

const redRemoteSite = targetRangeSite(3, 'bastion-1');
seedTargetAccess(redRemoteSite, 'MANAGEMENT', 'BASTION-01 SYNTHETIC REMOTE-ACCESS FINDING');
const redRemoteAccessSimulation = build(3, 'red-pentest-remote-access', 'Red Team Simulation: Remote Access Policy Finding',
  `ATTACKER-KALI inventories the fictional ${redRemoteSite.target.name} SSH exposure with no login or credential activity. Blue Team records the review in Cisco configuration.`, redRemoteSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -Pn -p 22 bastion-1', 'Red Team: inventory SSH surface', 'Use the embedded target alias; no authentication occurs.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py bastion-1', 'Red Team: document remote-access scope', 'Record synthetic management-zone metadata.'],
    ['CE-SW1', 'privileged', 'configure terminal', 'Blue Team: enter report documentation', 'Record the contained assessment finding.'],
    ['CE-SW1', 'config', 'interface g0/3', 'Blue Team: select bastion edge', 'The target is cabled to g0/3.'],
    ['CE-SW1', 'interface', 'description BASTION-01 FINDING REVIEWED', 'Blue Team: record proof and stop', 'The evidence is recorded; authentication is never attempted.'],
    ['CE-SW1', 'interface', 'end', 'Blue Team: return to verification', 'Conclude the authorized policy assessment.'],
    ['CE-SW1', 'privileged', 'show running-config interface g0/3', 'Blue Team: capture finding record', 'Confirm the report marker is present.'],
    ...save('CE-SW1'),
  ], [requirement('CE-SW1', ['runningConfig'], ['description BASTION-01 FINDING REVIEWED'], 'Remote-access simulation finding documented')], 3);

const redSegmentationSite = targetRangeSite(4, 'sensor-1', true);
seedTargetAccess(redSegmentationSite, 'FACILITIES-IOT', 'SENSOR-01 SYNTHETIC SEGMENTATION FINDING');
const redSegmentationSimulation = build(4, 'red-pentest-segmentation', 'Red Team Simulation: Segmentation Proof of Control',
  `ATTACKER-KALI inventories the fictional ${redSegmentationSite.target.name} from the dedicated synthetic range. Cisco evidence records segmentation controls; no VLAN hopping, packet crafting, pivoting, or bypass occurs.`, redSegmentationSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light sensor-1', 'Red Team: inventory IoT service surface', 'Use the scoped facilities-IoT alias.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py sensor-1', 'Red Team: record segmentation context', 'Capture target VLAN and zone metadata.'],
    ['CE-SW1', 'privileged', 'show interfaces trunk', 'Blue Team: inspect VLAN transit', 'Document permitted VLANs without traversal.'],
    ['CE-SW2', 'privileged', 'configure terminal', 'Blue Team: enter finding documentation', 'Record the observation without changing VLAN policy.'],
    ['CE-SW2', 'config', 'interface g0/3', 'Blue Team: select sensor edge', 'The target is cabled to g0/3.'],
    ['CE-SW2', 'interface', 'description SENSOR-01 FINDING REVIEWED', 'Blue Team: record proof and stop', 'No crafted traffic is used.'],
    ['CE-SW2', 'interface', 'end', 'Blue Team: return to verification', 'End the synthetic assessment.'],
    ['CE-SW2', 'privileged', 'show running-config interface g0/3', 'Blue Team: capture finding record', 'Confirm written assessment evidence.'],
    ...save('CE-SW2'),
  ], [requirement('CE-SW2', ['runningConfig'], ['description SENSOR-01 FINDING REVIEWED'], 'Segmentation simulation finding documented')], 3);

const redControlPlaneSite = targetRangeSite(5, 'monitor-1');
seedTargetAccess(redControlPlaneSite, 'OPERATIONS-SERVICES', 'MONITOR-01 SYNTHETIC CONTROL-PLANE FINDING');
const redControlPlaneSimulation = build(5, 'red-pentest-control-plane', 'Red Team Simulation: Routing Control Plane Finding',
  `ATTACKER-KALI inventories the fictional ${redControlPlaneSite.target.name} monitoring target; Cisco exposes OSPF state for Blue Team analysis. The attacker console cannot inject routes or form adjacencies.`, redControlPlaneSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light monitor-1', 'Red Team: inventory monitoring surface', 'Collect synthetic service data only.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py monitor-1', 'Red Team: document control-plane context', 'Record the operations target dataset.'],
    ['CE-R1', 'privileged', 'show ip ospf', 'Blue Team: inspect routing process', 'Document process scope and timing evidence.'],
    ['CE-R1', 'privileged', 'configure terminal', 'Blue Team: enter report documentation', 'Record the reviewed condition only.'],
    ['CE-R1', 'config', 'interface g0/0', 'Blue Team: select transit interface', 'Use the interface identified by control-plane evidence.'],
    ['CE-R1', 'interface', 'description MONITOR-01 CONTROL PLANE FINDING REVIEWED', 'Blue Team: record proof and stop', 'No routing protocol manipulation is performed.'],
    ['CE-R1', 'interface', 'end', 'Blue Team: return to verification', 'Conclude the authorized simulation.'],
    ['CE-R1', 'privileged', 'show running-config interface g0/0', 'Blue Team: capture finding record', 'Verify the final report marker.'],
    ...save('CE-R1'),
  ], [requirement('CE-R1', ['runningConfig'], ['description MONITOR-01 CONTROL PLANE FINDING REVIEWED'], 'Control-plane simulation finding documented')], 3);

const vlanHoppingSite = targetRangeSite(1, 'cam-1', true);
seedTargetAccess(vlanHoppingSite, 'PHYSICAL-SECURITY', 'CAM-01 SYNTHETIC VLAN BOUNDARY');
const vlanHoppingSimulation = build(1, 'purple-vlan-boundary', 'Purple Team Simulation: CAM-01 VLAN Boundary',
  `A deliberately modeled VLAN-boundary condition protects ${vlanHoppingSite.target.name} (${vlanHoppingSite.target.address}) in ${vlanHoppingSite.target.zone}. Red Team collects trunk and endpoint evidence. Blue Team hardens the native VLAN and endpoint mode, then both teams verify the control. No double-tagging, frame crafting, or bypass traffic is generated.`,
  vlanHoppingSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light cam-1', 'Red Team: inventory CAM-01 synthetic service', 'Collect scoped service metadata from the Linux attack console.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py cam-1', 'Red Team: record CAM-01 target context', 'Capture fictional VLAN and zone data before Blue Team changes.'],
    ['CE-SW1', 'privileged', 'show interfaces trunk', 'Blue Team: inspect CAM-01 transit evidence', 'Record native VLAN and allowed-VLAN state from the synthetic topology.'],
    ['CE-SW1', 'privileged', 'show vlan brief', 'Blue Team: inspect CAM-01 membership', 'Confirm that CAM-01 is modeled in VLAN 50.'],
    ['CE-SW2', 'privileged', 'show interfaces g0/3 switchport', 'Blue Team: inspect the peer endpoint edge', 'Use switchport evidence, not crafted traffic.'],
    ['CE-SW2', 'privileged', 'show mac address-table', 'Blue Team: record CAM-01 Layer 2 placement', 'Source-MAC learning is a topology clue only.'],
    ['CE-SW1', 'privileged', 'configure terminal', 'Blue Team: enter trunk hardening', 'Apply a safe modeled boundary control.'],
    ['CE-SW1', 'config', 'vlan 999', 'Blue Team: reserve unused native VLAN', 'Create an unused VLAN for native-frame hygiene.'],
    ['CE-SW1', 'vlan', 'name UNUSED-NATIVE', 'Blue Team: label native VLAN', 'Make the unused role clear to operators.'],
    ['CE-SW1', 'vlan', 'exit', 'Blue Team: return to global configuration', 'Select the inter-switch transit interface.'],
    ['CE-SW1', 'config', 'interface g0/2', 'Blue Team: select modeled trunk', 'g0/2 is the synthetic switch-to-switch path.'],
    ['CE-SW1', 'interface', 'switchport mode trunk', 'Blue Team: enforce trunk intent', 'Keep the transit link explicitly trunked.'],
    ['CE-SW1', 'interface', 'switchport trunk native vlan 999', 'Blue Team: isolate native VLAN', 'Move untagged traffic to the unused modeled VLAN.'],
    ['CE-SW1', 'interface', 'switchport trunk allowed vlan 10,50,99', 'Blue Team: limit allowed VLANs', 'Permit only documented training segments.'],
    ['CE-SW1', 'interface', 'end', 'Purple Team: return to verification', 'Retest the modeled VLAN boundary.'],
    ['CE-SW1', 'privileged', 'show interfaces trunk', 'Purple Team: verify hardened transit', 'Confirm native VLAN 999 and the restricted allow-list.'],
    ...save('CE-SW1'),
  ], [requirement('CE-SW1', ['interfaces', 'g0/2', 'nativeVlan'], 999, 'CAM-01 transit uses unused native VLAN'), requirement('CE-SW1', ['interfaces', 'g0/2', 'allowedVlans'], '10,50,99', 'CAM-01 transit has a restricted VLAN allow-list')], 4);

const dhcpSite = targetRangeSite(2, 'sensor-1');
dhcpSite.site.commands['CE-SW1'].push('configure terminal', 'vlan 60', 'name FACILITIES-IOT', 'exit', 'interface g0/3', 'switchport access vlan 60', 'description SENSOR-01 SYNTHETIC DHCP EVENT', 'end');
const dhcpIntegritySimulation = build(2, 'purple-dhcp-integrity', 'Purple Team Simulation: SENSOR-01 DHCP Integrity',
  `Synthetic lease-exhaustion and rogue-offer telemetry is associated with ${dhcpSite.target.name} (${dhcpSite.target.address}) in ${dhcpSite.target.zone}. Red Team records deterministic DHCP evidence; Blue Team enables snooping for VLAN 60 and verifies the modeled policy. No DHCP flooding or rogue-server operation occurs.`,
  dhcpSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light sensor-1', 'Red Team: inventory SENSOR-01 synthetic service', 'Use the fictional facilities-IoT target alias.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py sensor-1', 'Red Team: record SENSOR-01 target context', 'Capture deterministic asset metadata before remediation.'],
    ['CE-SW1', 'privileged', 'show ip dhcp server statistics', 'Blue Team: inspect synthetic lease telemetry', 'Use pre-generated simulator telemetry; do not generate DHCP requests.'],
    ['CE-SW1', 'privileged', 'show ip dhcp binding', 'Blue Team: review modeled bindings', 'Record current binding evidence for the report.'],
    ['CE-SW1', 'privileged', 'show interfaces status', 'Blue Team: inspect SENSOR-01 edge', 'Identify the synthetic IoT port and status.'],
    ['CE-SW1', 'privileged', 'show running-config interface g0/3', 'Blue Team: confirm target association', 'Confirm the port label links the evidence to SENSOR-01.'],
    ['CE-SW1', 'privileged', 'configure terminal', 'Blue Team: enter DHCP integrity controls', 'Enable the modeled Layer 2 protection.'],
    ['CE-SW1', 'config', 'ip dhcp snooping', 'Blue Team: enable DHCP snooping', 'Enable deterministic DHCP source validation.'],
    ['CE-SW1', 'config', 'ip dhcp snooping vlan 60', 'Blue Team: protect Facilities IoT VLAN', 'Bind snooping policy to SENSOR-01 VLAN 60.'],
    ['CE-SW1', 'config', 'interface g0/3', 'Blue Team: select SENSOR-01 edge', 'The sensor remains an untrusted access endpoint.'],
    ['CE-SW1', 'interface', 'description SENSOR-01 DHCP SNOOPING PROTECTED', 'Blue Team: document protected edge', 'Document the completed control without generating traffic.'],
    ['CE-SW1', 'interface', 'end', 'Purple Team: return to verification', 'Review the modeled snooping state.'],
    ['CE-SW1', 'privileged', 'show ip dhcp snooping', 'Purple Team: verify DHCP integrity control', 'Confirm DHCP snooping is active for VLAN 60.'],
    ...save('CE-SW1'),
  ], [requirement('CE-SW1', ['runningConfig'], ['ip dhcp snooping', 'ip dhcp snooping vlan 60'], 'SENSOR-01 VLAN has DHCP snooping')], 4);

const arpSite = targetRangeSite(3, 'badge-1');
arpSite.site.commands['CE-SW1'].push('configure terminal', 'vlan 50', 'name PHYSICAL-SECURITY', 'exit', 'interface g0/3', 'switchport access vlan 50', 'description BADGE-01 SYNTHETIC ARP ALERT', 'end');
const arpIntegritySimulation = build(3, 'purple-arp-integrity', 'Purple Team Simulation: BADGE-01 ARP Integrity',
  `Synthetic ARP-anomaly telemetry is presented for ${arpSite.target.name} (${arpSite.target.address}) in ${arpSite.target.zone}. Red Team reviews the deterministic alert and Layer 2 evidence. Blue Team enables DHCP snooping and ARP inspection for VLAN 50. No spoofed ARP traffic, interception, or MITM activity is performed.`,
  arpSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light badge-1', 'Red Team: inventory BADGE-01 synthetic service', 'Collect scoped badge-controller metadata from ATTACKER-KALI.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py badge-1', 'Red Team: record BADGE-01 target context', 'Use the in-app dataset only.'],
    ['CE-SW1', 'privileged', 'show arp', 'Blue Team: review synthetic ARP evidence', 'Observe the modeled neighbor table only.'],
    ['CE-SW1', 'privileged', 'show mac address-table', 'Blue Team: record BADGE-01 Layer 2 location', 'Use learned MAC evidence to document the affected edge.'],
    ['CE-SW1', 'privileged', 'show vlan brief', 'Blue Team: confirm physical-security VLAN', 'Confirm the target belongs to VLAN 50.'],
    ['CE-SW1', 'privileged', 'show running-config interface g0/3', 'Blue Team: confirm synthetic alert scope', 'The device label establishes a fictional training condition.'],
    ['CE-SW1', 'privileged', 'configure terminal', 'Blue Team: enter ARP integrity controls', 'Apply the deterministic inspection baseline.'],
    ['CE-SW1', 'config', 'ip dhcp snooping', 'Blue Team: enable binding source', 'DHCP snooping provides modeled binding evidence.'],
    ['CE-SW1', 'config', 'ip dhcp snooping vlan 50', 'Blue Team: protect VLAN 50 bindings', 'Limit binding validation to the physical-security segment.'],
    ['CE-SW1', 'config', 'ip arp inspection vlan 50', 'Blue Team: enable Dynamic ARP Inspection', 'Enable modeled ARP validation for the target VLAN.'],
    ['CE-SW1', 'config', 'interface g0/3', 'Blue Team: select BADGE-01 edge', 'Document the protected physical-security port.'],
    ['CE-SW1', 'interface', 'description BADGE-01 ARP INSPECTION PROTECTED', 'Blue Team: record mitigation', 'Record remediation without sending spoofed frames.'],
    ['CE-SW1', 'interface', 'end', 'Purple Team: return to verification', 'Review ARP inspection output.'],
    ['CE-SW1', 'privileged', 'show ip arp inspection', 'Purple Team: verify ARP inspection policy', 'Confirm VLAN 50 is protected in simulator state.'],
    ...save('CE-SW1'),
  ], [requirement('CE-SW1', ['runningConfig'], ['ip dhcp snooping vlan 50', 'ip arp inspection vlan 50'], 'BADGE-01 VLAN has ARP integrity controls')], 4);

const otSite = targetRangeSite(4, 'cam-1');
otSite.site.commands['CE-SW1'].push('configure terminal', 'vlan 50', 'name PHYSICAL-SECURITY', 'exit', 'interface g0/3', 'switchport access vlan 50', 'description CAM-01 SYNTHETIC OT BOUNDARY', 'end');
const otSegmentationSimulation = build(4, 'purple-ot-segmentation', 'Purple Team Simulation: CAM-01 OT Boundary',
  `The fictional ${otSite.target.name} (${otSite.target.address}) represents an OT-adjacent physical-security asset. Red Team validates the modeled IT/OT path and records the safety impact. Blue Team applies a least-privilege ACL boundary. No Modbus, Profinet, industrial protocol interaction, pivoting, or availability-impacting traffic is generated.`,
  otSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light cam-1', 'Red Team: inventory OT-adjacent camera service', 'Collect synthetic service evidence without OT protocol interaction.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py cam-1', 'Red Team: record OT target context', 'Capture fictional zone and safety context.'],
    ['CE-SW1', 'privileged', 'show vlan brief', 'Blue Team: identify CAM-01 security zone', 'Record the dedicated physical-security VLAN.'],
    ['CE-SW1', 'privileged', 'show mac address-table', 'Blue Team: locate CAM-01', 'Use modeled MAC learning to identify the local edge.'],
    ['CE-R1', 'privileged', 'show ip interface brief', 'Blue Team: review routed boundary', 'Document the gateway boundary without sending OT traffic.'],
    ['CE-R1', 'privileged', 'show access-lists', 'Blue Team: inspect existing IT/OT policy', 'Record policy evidence for the finding.'],
    ['CE-R1', 'privileged', 'configure terminal', 'Blue Team: enter OT boundary hardening', 'Create a least-privilege modeled policy.'],
    ['CE-R1', 'config', 'ip access-list extended OT-BOUNDARY', 'Blue Team: define OT boundary policy', 'Create the named boundary policy.'],
    ['CE-R1', 'acl', 'deny ip any host 10.76.50.21', 'Blue Team: block unapproved IT-to-CAM-01 path', 'Model a deny for unapproved access to the fictional camera.'],
    ['CE-R1', 'acl', 'permit ip any any', 'Blue Team: preserve other modeled services', 'Keep the instructional policy ordered and explicit.'],
    ['CE-R1', 'acl', 'exit', 'Blue Team: return to global configuration', 'Attach the completed policy at the gateway.'],
    ['CE-R1', 'config', 'interface g0/0', 'Blue Team: select routed boundary', 'Apply policy on the modeled IT/OT gateway.'],
    ['CE-R1', 'interface', 'ip access-group OT-BOUNDARY in', 'Blue Team: enforce OT segmentation', 'Record the inbound simulated policy attachment.'],
    ['CE-R1', 'interface', 'end', 'Purple Team: return to verification', 'Retest configuration evidence only.'],
    ['CE-R1', 'privileged', 'show access-lists', 'Purple Team: verify OT boundary control', 'Confirm CAM-01 is represented by explicit policy.'],
    ...save('CE-R1'),
  ], [requirement('CE-R1', ['runningConfig'], ['ip access-group OT-BOUNDARY in'], 'CAM-01 has an IT/OT policy boundary')], 4);

const apiSite = targetRangeSite(5, 'api');
seedTargetAccess(apiSite, 'APPLICATION-DMZ', 'TRAINING-API SYNTHETIC AUTHZ REVIEW');
apiSite.site.commands['CE-R1'].push('configure terminal', 'ip http secure-server', 'ip http secure-port 443', 'interface g0/0', 'description TRAINING-API SYNTHETIC AUTHZ REVIEW', 'end');
const apiBoundarySimulation = build(5, 'purple-api-boundary', 'Purple Team Simulation: training-api.example Boundary',
  `The fictional ${apiSite.target.name} (${apiSite.target.address}) is a deterministic API-boundary training asset. Red Team reviews the modeled TLS and policy context, then stops at a documented authorization finding. Blue Team publishes an explicit boundary ACL. No IDOR attempts, token manipulation, JWT forging, requests, or payloads are performed.`,
  apiSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light api', 'Red Team: inventory training API service', 'Use the fictional API alias from the Linux console.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py api', 'Red Team: record API target context', 'Capture synthetic authorization-boundary metadata.'],
    ['CE-R1', 'privileged', 'show ip http server secure-status', 'Blue Team: inspect API TLS intent', 'Review the modeled HTTPS listener only.'],
    ['CE-R1', 'privileged', 'show ip interface brief', 'Blue Team: record API boundary address', 'Confirm the fictional API network context.'],
    ['CE-R1', 'privileged', 'show access-lists', 'Blue Team: inspect API policy baseline', 'Read existing configuration evidence without API interaction.'],
    ['CE-SW1', 'privileged', 'show mac address-table', 'Blue Team: record API path evidence', 'Use Layer 2 evidence for a scoped report.'],
    ['CE-R1', 'privileged', 'configure terminal', 'Blue Team: enter API boundary hardening', 'Create a deterministic permit-and-deny policy.'],
    ['CE-R1', 'config', 'ip http rate-limit 60', 'Blue Team: model API rate limit', 'Record a deterministic request-rate policy in the simulator; no requests are generated.'],
    ['CE-R1', 'config', 'ip http authentication token-required', 'Blue Team: require modeled API token', 'Record token-enforcement intent without issuing, manipulating, or testing credentials.'],
    ['CE-R1', 'config', 'ip access-list extended TRAINING-API-HTTPS', 'Blue Team: define API policy', 'Create the named service boundary.'],
    ['CE-R1', 'acl', 'permit tcp any host 10.76.20.81', 'Blue Team: allow modeled API service', 'The policy represents approved encrypted access in the simulator.'],
    ['CE-R1', 'acl', 'deny ip any any', 'Blue Team: deny other modeled API traffic', 'Keep a final explicit deny for the instructional boundary.'],
    ['CE-R1', 'acl', 'exit', 'Blue Team: return to global configuration', 'Apply the API boundary policy.'],
    ['CE-R1', 'config', 'interface g0/0', 'Blue Team: select API gateway boundary', 'Use the modeled ingress interface.'],
    ['CE-R1', 'interface', 'ip access-group TRAINING-API-HTTPS in', 'Blue Team: enforce API policy', 'Attach the explicit simulator policy.'],
    ['CE-R1', 'interface', 'end', 'Purple Team: return to verification', 'Retest policy evidence only.'],
    ['CE-R1', 'privileged', 'show ip http server secure-status', 'Purple Team: verify API service controls', 'Confirm the modeled TLS, rate-limit, and token-enforcement records.'],
    ['CE-R1', 'privileged', 'show access-lists', 'Purple Team: verify API boundary', 'Confirm the intended policy ordering.'],
    ...save('CE-R1'),
  ], [requirement('CE-R1', ['runningConfig'], ['ip http secure-server', 'ip http rate-limit 60', 'ip http authentication token-required', 'ip access-group TRAINING-API-HTTPS in'], 'training-api.example has modeled TLS, rate-limit, token, and policy controls')], 4);

const ransomwareSite = targetRangeSite(5, 'printer-1');
ransomwareSite.site.commands['CE-SW1'].push('configure terminal', 'vlan 70', 'name SHARED-SERVICES', 'exit', 'interface g0/3', 'switchport access vlan 70', 'description PRINT-01 SYNTHETIC CANARY ALERT', 'end');
const ransomwareRecoverySimulation = build(5, 'purple-ransomware-recovery', 'Purple Team Simulation: PRINT-01 Recovery Drill',
  `A synthetic canary and file-integrity alert is associated with ${ransomwareSite.target.name} (${ransomwareSite.target.address}) in ${ransomwareSite.target.zone}. Red Team reads deterministic evidence and documents impact. Blue Team isolates the modeled edge, validates recovery readiness, and restores service. No files are encrypted, deleted, exfiltrated, or accessed.`,
  ransomwareSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light printer-1', 'Red Team: inventory PRINT-01 synthetic service', 'Collect scoped printer-service metadata without print interaction.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py printer-1', 'Red Team: record PRINT-01 target context', 'Use the fictional recovery-drill dataset only.'],
    ['CE-SW1', 'privileged', 'show interfaces status', 'Blue Team: inspect PRINT-01 edge baseline', 'Use pre-generated alert context, not malware execution.'],
    ['CE-SW1', 'privileged', 'show mac address-table', 'Blue Team: record PRINT-01 identity evidence', 'Capture modeled Layer 2 placement for the incident report.'],
    ['CE-SW1', 'privileged', 'show vlan brief', 'Blue Team: confirm shared-services scope', 'Confirm the target belongs to VLAN 70.'],
    ['CE-SW1', 'privileged', 'show running-config interface g0/3', 'Blue Team: validate synthetic alert marker', 'The port description establishes a fictional recovery drill.'],
    ['CE-SW1', 'privileged', 'configure terminal', 'Blue Team: enter containment workflow', 'Isolate only the fictional training endpoint.'],
    ['CE-SW1', 'config', 'interface g0/3', 'Blue Team: select PRINT-01 edge', 'g0/3 is the modeled shared-service device edge.'],
    ['CE-SW1', 'interface', 'shutdown', 'Blue Team: isolate synthetic incident endpoint', 'Contain the simulated event without touching real systems.'],
    ['CE-SW1', 'interface', 'description PRINT-01 SYNTHETIC INCIDENT ISOLATED', 'Blue Team: record containment', 'Document the isolation decision.'],
    ['CE-SW1', 'interface', 'no shutdown', 'Blue Team: restore after simulated validation', 'Restore service only after the deterministic recovery check.'],
    ['CE-SW1', 'interface', 'description PRINT-01 SYNTHETIC RECOVERY VALIDATED', 'Blue Team: record recovery readiness', 'Record the completed restore drill.'],
    ['CE-SW1', 'interface', 'end', 'Purple Team: return to verification', 'Verify the endpoint is restored and documented.'],
    ['CE-SW1', 'privileged', 'show interfaces g0/3', 'Purple Team: verify restored service edge', 'Confirm the modeled interface is operational.'],
    ['CE-SW1', 'privileged', 'show running-config interface g0/3', 'Purple Team: capture recovery record', 'Close the safe recovery exercise with evidence.'],
    ...save('CE-SW1'),
  ], [requirement('CE-SW1', ['interfaces', 'g0/3', 'shutdown'], false, 'PRINT-01 is restored after synthetic isolation'), requirement('CE-SW1', ['runningConfig'], ['description PRINT-01 SYNTHETIC RECOVERY VALIDATED'], 'PRINT-01 recovery is documented')], 4);

const legacyServiceSite = targetRangeSite(1, 'legacy-ftp-1');
seedTargetAccess(legacyServiceSite, 'LEGACY-SERVICES', 'LEGACY-FTP-01 SYNTHETIC RETIREMENT REVIEW');
const legacyServiceRetirementSimulation = build(1, 'purple-legacy-service-retirement', 'Purple Team Simulation: LEGACY-FTP-01 Service Retirement',
  `The fictional ${legacyServiceSite.target.name} (${legacyServiceSite.target.address}) represents a retired file-transfer service. Red Team inventories the synthetic service record and documents the risk. Blue Team applies an explicit compensating boundary. No FTP connection, anonymous login, file transfer, or password activity occurs.`,
  legacyServiceSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light legacy-ftp-1', 'Red Team: inventory legacy-service exposure', 'Run the real Nmap-shaped command from the synthetic Linux attack workstation.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py legacy-ftp-1', 'Red Team: document legacy-service scope', 'Use the synthetic Linux reporting script to capture approved asset metadata.'],
    ['CE-SW1', 'privileged', 'show vlan brief', 'Blue Team: record legacy-service placement', 'Confirm the dedicated legacy-services VLAN.'],
    ['CE-R1', 'privileged', 'configure terminal', 'Blue Team: enter retirement control workflow', 'Create an explicit modeled policy for the retired service.'],
    ['CE-R1', 'config', 'ip access-list extended LEGACY-FTP-RETIRED', 'Blue Team: define retirement boundary', 'Create a named policy for the fictional target.'],
    ['CE-R1', 'acl', 'deny ip any host 10.76.80.21', 'Blue Team: deny retired service access', 'Block all modeled access to the retired service address.'],
    ['CE-R1', 'acl', 'permit ip any any', 'Blue Team: preserve unrelated modeled services', 'Keep the policy ordered and explicit.'],
    ['CE-R1', 'acl', 'exit', 'Blue Team: return to global configuration', 'Attach the documented policy.'],
    ['CE-R1', 'config', 'interface g0/0', 'Blue Team: select service boundary', 'Use the routed boundary for the synthetic policy.'],
    ['CE-R1', 'interface', 'ip access-group LEGACY-FTP-RETIRED in', 'Blue Team: enforce retirement policy', 'Record the inbound policy attachment.'],
    ['CE-R1', 'interface', 'end', 'Purple Team: return to verification', 'Verify the synthetic retirement control.'],
    ['CE-R1', 'privileged', 'show access-lists', 'Purple Team: verify retirement boundary', 'Confirm the explicit deny and policy attachment evidence.'],
    ...save('CE-R1'),
  ], [requirement('CE-R1', ['runningConfig'], ['ip access-group LEGACY-FTP-RETIRED in'], 'LEGACY-FTP-01 is protected by an explicit retirement boundary')], 5);

const fileAccessSite = targetRangeSite(2, 'file-1');
seedTargetAccess(fileAccessSite, 'SHARED-SERVICES', 'FILE-01 SYNTHETIC SHARE POLICY REVIEW');
const fileAccessSimulation = build(2, 'purple-file-access-policy', 'Purple Team Simulation: FILE-01 Shared Access Policy',
  `The fictional ${fileAccessSite.target.name} (${fileAccessSite.target.address}) represents a shared-file service. Red Team reviews the synthetic guest-access finding and evidence. Blue Team enforces an approved-path policy. No SMB session, share enumeration, file browsing, or guest authentication is performed.`,
  fileAccessSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light file-1', 'Red Team: inventory shared-file service', 'Run the real Nmap-shaped command from the synthetic Linux attack workstation.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py file-1', 'Red Team: document shared-service scope', 'Use the synthetic Linux reporting script; no share connection is made.'],
    ['CE-SW1', 'privileged', 'show mac address-table', 'Blue Team: record FILE-01 edge evidence', 'Use modeled Layer 2 placement for the report.'],
    ['CE-R1', 'privileged', 'configure terminal', 'Blue Team: enter shared-service hardening', 'Publish an explicit approved-source policy.'],
    ['CE-R1', 'config', 'ip access-list extended FILE-01-APPROVED', 'Blue Team: define approved file-service path', 'Create the named synthetic service policy.'],
    ['CE-R1', 'acl', 'permit ip host 10.76.2.20 host 10.76.70.60', 'Blue Team: permit assessment path', 'Represent the approved training path only.'],
    ['CE-R1', 'acl', 'deny ip any host 10.76.70.60', 'Blue Team: deny unapproved file-service paths', 'Block all other modeled paths to FILE-01.'],
    ['CE-R1', 'acl', 'permit ip any any', 'Blue Team: preserve unrelated modeled traffic', 'Keep the policy ordered and explicit.'],
    ['CE-R1', 'acl', 'exit', 'Blue Team: return to global configuration', 'Attach the completed shared-service policy.'],
    ['CE-R1', 'config', 'interface g0/0', 'Blue Team: select routed boundary', 'Apply the policy at the synthetic boundary.'],
    ['CE-R1', 'interface', 'ip access-group FILE-01-APPROVED in', 'Blue Team: enforce approved file-service path', 'Record the least-privilege attachment.'],
    ['CE-R1', 'interface', 'end', 'Purple Team: return to verification', 'Review the resulting configuration evidence.'],
    ['CE-R1', 'privileged', 'show access-lists', 'Purple Team: verify approved file-service policy', 'Confirm the permitted source and deny rule.'],
    ...save('CE-R1'),
  ], [requirement('CE-R1', ['runningConfig'], ['ip access-group FILE-01-APPROVED in'], 'FILE-01 has an explicit approved-path policy')], 5);

const bastionSite = targetRangeSite(3, 'bastion-1');
seedTargetAccess(bastionSite, 'MANAGEMENT', 'BASTION-01 SYNTHETIC ADMIN REVIEW');
const remoteAdministrationSimulation = build(3, 'purple-remote-administration-hygiene', 'Purple Team Simulation: BASTION-01 Remote Administration Hygiene',
  `The fictional ${bastionSite.target.name} (${bastionSite.target.address}) represents a privileged-access jump host. Red Team reviews synthetic credential-risk telemetry. Blue Team requires local authentication and SSH-only administration. No private key handling, password attempt, hash capture, or remote session occurs.`,
  bastionSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -Pn -p 22 bastion-1', 'Red Team: inventory remote-administration surface', 'Run the real Nmap-shaped command from the synthetic Linux attack workstation.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py bastion-1', 'Red Team: document privileged-access scope', 'Use the synthetic Linux reporting script to capture boundary metadata.'],
    ['CE-SW1', 'privileged', 'show running-config | section line vty', 'Blue Team: inspect administrative access baseline', 'Read VTY configuration without attempting authentication.'],
    ['CE-SW1', 'privileged', 'configure terminal', 'Blue Team: enter remote-administration hardening', 'Apply the SSH-only administrative baseline.'],
    ['CE-SW1', 'config', 'line vty 0 4', 'Blue Team: select remote terminal lines', 'Harden the modeled remote administration plane.'],
    ['CE-SW1', 'line', 'login local', 'Blue Team: require local authentication', 'Require the modeled approved account policy.'],
    ['CE-SW1', 'line', 'transport input ssh', 'Blue Team: restrict administration to SSH', 'Exclude plaintext remote administration.'],
    ['CE-SW1', 'line', 'exec-timeout 5 0', 'Blue Team: set idle timeout', 'Limit unattended privileged sessions.'],
    ['CE-SW1', 'line', 'end', 'Purple Team: return to verification', 'Capture the final policy evidence.'],
    ['CE-SW1', 'privileged', 'show running-config | section line vty', 'Purple Team: verify SSH-only policy', 'Confirm local login, SSH transport, and idle timeout intent.'],
    ...save('CE-SW1'),
  ], [requirement('CE-SW1', ['settings', 'line:line vty 0 4', 'transport input'], 'ssh', 'BASTION-01 administration is modeled as SSH only')], 5);

const directorySite = targetRangeSite(4, 'kdc-1', true);
seedTargetAccess(directorySite, 'IDENTITY-SERVICES', 'KDC-01 SYNTHETIC TRUST REVIEW');
const directoryTrustSimulation = build(4, 'purple-directory-trust-boundary', 'Purple Team Simulation: KDC-01 Directory Trust Boundary',
  `The fictional ${directorySite.target.name} (${directorySite.target.address}) represents an identity ticket service. Red Team studies the synthetic trust-boundary finding; Blue Team limits the approved management path. No directory query, Kerberos ticket request, ticket forgery, pass-the-hash action, or account access is modeled.`,
  directorySite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -Pn -p 88,389 kdc-1', 'Red Team: inventory identity-service surface', 'Run the real Nmap-shaped command from the synthetic Linux attack workstation.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py kdc-1', 'Red Team: document directory trust scope', 'Use the synthetic Linux reporting script; no directory query occurs.'],
    ['CE-SW2', 'privileged', 'show interfaces trunk', 'Blue Team: record identity transit evidence', 'Document the modeled path without attempting traversal.'],
    ['CE-R1', 'privileged', 'configure terminal', 'Blue Team: enter identity-boundary hardening', 'Create a restrictive policy for the fictional directory service.'],
    ['CE-R1', 'config', 'ip access-list extended KDC-01-TRUST', 'Blue Team: define directory trust policy', 'Create an explicit named boundary.'],
    ['CE-R1', 'acl', 'permit ip host 10.76.99.20 host 10.76.30.11', 'Blue Team: permit management review path', 'Represent the approved management source.'],
    ['CE-R1', 'acl', 'deny ip any host 10.76.30.11', 'Blue Team: deny other directory paths', 'Block non-approved modeled access to KDC-01.'],
    ['CE-R1', 'acl', 'permit ip any any', 'Blue Team: preserve unrelated traffic', 'Keep the simulated ACL ordered.'],
    ['CE-R1', 'acl', 'exit', 'Blue Team: return to global configuration', 'Attach the completed policy.'],
    ['CE-R1', 'config', 'interface g0/0', 'Blue Team: select directory boundary', 'Enforce policy at the modeled gateway.'],
    ['CE-R1', 'interface', 'ip access-group KDC-01-TRUST in', 'Blue Team: enforce directory trust boundary', 'Record the in-app policy attachment.'],
    ['CE-R1', 'interface', 'end', 'Purple Team: return to verification', 'Verify the explicit policy record.'],
    ['CE-R1', 'privileged', 'show access-lists', 'Purple Team: verify directory trust policy', 'Confirm approved management path and default restriction.'],
    ...save('CE-R1'),
  ], [requirement('CE-R1', ['runningConfig'], ['ip access-group KDC-01-TRUST in'], 'KDC-01 has an explicit trust boundary')], 5);

const cacheSite = targetRangeSite(5, 'cache-1');
seedTargetAccess(cacheSite, 'APPLICATION-DMZ', 'CACHE-01 SYNTHETIC AUTH ANOMALY REVIEW');
const authenticationAnomalySimulation = build(5, 'purple-authentication-anomaly', 'Purple Team Simulation: CACHE-01 Authentication Anomaly',
  `The fictional ${cacheSite.target.name} (${cacheSite.target.address}) has a deterministic authentication-anomaly alert. Red Team records the simulated alert without generating requests. Blue Team applies modeled rate limiting, token enforcement, and an explicit service policy. No password spray, brute force, login attempt, or credential use occurs.`,
  cacheSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -Pn -p 8443 cache-1', 'Red Team: inventory application-service surface', 'Run the real Nmap-shaped command from the synthetic Linux attack workstation.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py cache-1', 'Red Team: document authentication-anomaly context', 'Use the synthetic Linux reporting script to preserve the alert context.'],
    ['CE-R1', 'privileged', 'show ip http server secure-status', 'Blue Team: inspect modeled service baseline', 'Review the current simulator listener policy.'],
    ['CE-R1', 'privileged', 'configure terminal', 'Blue Team: enter anomaly-containment workflow', 'Apply deterministic service controls without producing traffic.'],
    ['CE-R1', 'config', 'ip http secure-server', 'Blue Team: require modeled TLS service', 'Enable the approved encrypted listener.'],
    ['CE-R1', 'config', 'ip http rate-limit 60', 'Blue Team: apply modeled rate policy', 'Record a request-rate limit in simulator state.'],
    ['CE-R1', 'config', 'ip http authentication token-required', 'Blue Team: require modeled token enforcement', 'Record authorization intent without issuing tokens.'],
    ['CE-R1', 'config', 'ip access-list extended CACHE-01-APPROVED', 'Blue Team: define cache-service boundary', 'Create the named application policy.'],
    ['CE-R1', 'acl', 'permit tcp any host 10.76.20.90', 'Blue Team: permit approved modeled service', 'Represent the approved service path.'],
    ['CE-R1', 'acl', 'deny ip any any', 'Blue Team: deny other modeled cache paths', 'Keep explicit default-deny intent.'],
    ['CE-R1', 'acl', 'exit', 'Blue Team: return to global configuration', 'Attach the service policy.'],
    ['CE-R1', 'config', 'interface g0/0', 'Blue Team: select application boundary', 'Apply the policy at the routed boundary.'],
    ['CE-R1', 'interface', 'ip access-group CACHE-01-APPROVED in', 'Blue Team: enforce cache-service policy', 'Record the in-app enforcement point.'],
    ['CE-R1', 'interface', 'end', 'Purple Team: return to verification', 'Confirm all modeled service controls.'],
    ['CE-R1', 'privileged', 'show ip http server secure-status', 'Purple Team: verify containment controls', 'Confirm TLS, rate-limit, and token-policy evidence.'],
    ['CE-R1', 'privileged', 'show access-lists', 'Purple Team: verify cache-service ACL', 'Confirm policy order and attachment evidence.'],
    ...save('CE-R1'),
  ], [requirement('CE-R1', ['runningConfig'], ['ip http rate-limit 60', 'ip http authentication token-required', 'ip access-group CACHE-01-APPROVED in'], 'CACHE-01 has modeled authentication-anomaly controls')], 5);

const dnsSite = targetRangeSite(5, 'dns-1');
seedTargetAccess(dnsSite, 'OPERATIONS-SERVICES', 'DNS-01 SYNTHETIC SERVICE INVENTORY REVIEW');
const dnsInventorySimulation = build(5, 'purple-dns-service-inventory', 'Purple Team Simulation: DNS-01 Service Inventory',
  `The fictional ${dnsSite.target.name} (${dnsSite.target.address}) represents an internal naming service. Red Team documents a modeled service-inventory finding, then Blue Team restricts the approved management path. No DNS query, zone transfer, enumeration, packet capture, or external scan is generated.`,
  dnsSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -sV --version-light dns-1', 'Red Team: inventory naming-service exposure', 'Run the real Nmap-shaped command from the synthetic Linux attack workstation.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py dns-1', 'Red Team: document naming-service scope', 'Use the synthetic Linux reporting script; no DNS query is made.'],
    ['CE-SW1', 'privileged', 'show interfaces status', 'Blue Team: record DNS-01 edge baseline', 'Capture modeled port state for the assessment report.'],
    ['CE-R1', 'privileged', 'configure terminal', 'Blue Team: enter naming-service hardening', 'Create a least-privilege modeled boundary.'],
    ['CE-R1', 'config', 'ip access-list extended DNS-01-MANAGEMENT', 'Blue Team: define naming-service policy', 'Create the explicit approved source policy.'],
    ['CE-R1', 'acl', 'permit ip host 10.76.99.20 host 10.76.40.53', 'Blue Team: permit management path', 'Represent the approved management route only.'],
    ['CE-R1', 'acl', 'deny ip any host 10.76.40.53', 'Blue Team: deny unapproved naming-service paths', 'Block other modeled access to DNS-01.'],
    ['CE-R1', 'acl', 'permit ip any any', 'Blue Team: preserve unrelated services', 'Keep the simulator policy explicit.'],
    ['CE-R1', 'acl', 'exit', 'Blue Team: return to global configuration', 'Attach the reviewed policy.'],
    ['CE-R1', 'config', 'interface g0/0', 'Blue Team: select operations boundary', 'Apply policy at the modeled gateway.'],
    ['CE-R1', 'interface', 'ip access-group DNS-01-MANAGEMENT in', 'Blue Team: enforce naming-service policy', 'Record the in-app enforcement point.'],
    ['CE-R1', 'interface', 'end', 'Purple Team: return to verification', 'Capture final evidence.'],
    ['CE-R1', 'privileged', 'show access-lists', 'Purple Team: verify naming-service boundary', 'Confirm the intended permit and deny rules.'],
    ...save('CE-R1'),
  ], [requirement('CE-R1', ['runningConfig'], ['ip access-group DNS-01-MANAGEMENT in'], 'DNS-01 has an explicit management boundary')], 5);

const containerApiSite = targetRangeSite(5, 'container-api-1');
seedTargetAccess(containerApiSite, 'APPLICATION-DMZ', 'CONTAINER-API-01 SYNTHETIC RUNTIME REVIEW');
const containerRuntimeSimulation = build(5, 'purple-container-runtime-boundary', 'Purple Team Simulation: CONTAINER-API-01 Runtime Boundary',
  `The fictional ${containerApiSite.target.name} (${containerApiSite.target.address}) is a first-class simulated Docker workload. Red Team inspects its image, runtime, network, published port, health, volume policy, synthetic log, and deterministic findings. Blue Team applies TLS, rate, token, and ACL controls. No image pull, container shell, registry access, request, process execution, or network connection occurs.`,
  containerApiSite.site, [
    ['ATTACKER-KALI', 'shell', 'nmap -Pn -p 8443 container-api-1', 'Red Team: inventory container service exposure', 'Run Nmap from the synthetic Linux attack workstation, never from IOS.'],
    ['ATTACKER-KALI', 'shell', 'msfconsole', 'Red Team: open Metasploit training catalog', 'Use the separate synthetic Linux attack console.'],
    ['ATTACKER-KALI', 'shell', 'search type:auxiliary name:http_version', 'Red Team: locate a read-only HTTP inspection module', 'Practice Metasploit catalog-search syntax in the attack console.'],
    ['ATTACKER-KALI', 'shell', 'info auxiliary/scanner/http/http_version', 'Red Team: inspect read-only module intent', 'Review module metadata before using the modeled workflow.'],
    ['ATTACKER-KALI', 'shell', 'use auxiliary/scanner/http/http_version', 'Red Team: select the synthetic inspection workflow', 'Use authentic module-selection syntax in the in-app attacker console.'],
    ['ATTACKER-KALI', 'shell', 'set RHOSTS container-api-1', 'Red Team: set fictional container target', 'RHOSTS accepts only a fictional range alias, never an external address or hostname.'],
    ['ATTACKER-KALI', 'shell', 'run', 'Red Team: execute modeled module workflow', 'The synthetic range records deterministic service metadata only.'],
    ['ATTACKER-KALI', 'shell', 'python3 training/scripts/range_inventory.py container-api-1', 'Red Team: record container runtime metadata', 'Capture modeled image, network, port, health, restart, volume, log, and finding data.'],
    ['CE-SW1', 'privileged', 'show mac address-table', 'Blue Team: record container service edge', 'Use Layer 2 evidence to document the synthetic service path.'],
    ['CE-R1', 'privileged', 'configure terminal', 'Blue Team: enter container-service hardening', 'Apply deterministic ingress controls for the fictional workload.'],
    ['CE-R1', 'config', 'ip http secure-server', 'Blue Team: require modeled TLS listener', 'Enable the approved encrypted service boundary.'],
    ['CE-R1', 'config', 'ip http secure-port 8443', 'Blue Team: record published container port', 'Match the modeled published service port.'],
    ['CE-R1', 'config', 'ip http rate-limit 60', 'Blue Team: apply modeled rate policy', 'Record deterministic request-rate policy only.'],
    ['CE-R1', 'config', 'ip http authentication token-required', 'Blue Team: require modeled token enforcement', 'Record authorization policy without issuing or processing tokens.'],
    ['CE-R1', 'config', 'ip access-list extended CONTAINER-API-01-INGRESS', 'Blue Team: define container ingress policy', 'Create a named allow-and-deny service boundary.'],
    ['CE-R1', 'acl', 'permit tcp any host 10.76.20.100', 'Blue Team: allow approved modeled ingress', 'Represent the single approved service address in the simulator.'],
    ['CE-R1', 'acl', 'deny tcp any host 10.76.20.100 eq 8443', 'Blue Team: filter the container service port', 'Block the exact modeled exposed port at the routed ingress.'],
    ['CE-R1', 'acl', 'permit ip any any', 'Blue Team: preserve unrelated services', 'Keep the synthetic policy explicit.'],
    ['CE-R1', 'acl', 'exit', 'Blue Team: return to global configuration', 'Attach the completed ingress policy.'],
    ['CE-R1', 'config', 'interface g0/0', 'Blue Team: select application boundary', 'Use the modeled routed ingress edge.'],
    ['CE-R1', 'interface', 'ip access-group CONTAINER-API-01-INGRESS in', 'Blue Team: enforce container ingress policy', 'Record the in-app ACL attachment.'],
    ['CE-R1', 'interface', 'end', 'Purple Team: return to verification', 'Confirm the container boundary state.'],
    ['CE-R1', 'privileged', 'show ip http server secure-status', 'Purple Team: verify service controls', 'Confirm modeled TLS, port, rate limit, and token enforcement.'],
    ['CE-R1', 'privileged', 'show access-lists', 'Purple Team: verify container ingress ACL', 'Confirm the explicit ingress policy evidence.'],
    ['ATTACKER-KALI', 'shell', 'nmap -Pn -p 8443 container-api-1', 'Red Team: verify the filtered result', 'The same scan now reflects the Cisco ACL state through shared synthetic telemetry.'],
    ...save('CE-R1'),
  ], [requirement('CE-R1', ['runningConfig'], ['ip http secure-port 8443', 'ip http rate-limit 60', 'ip http authentication token-required', 'ip access-group CONTAINER-API-01-INGRESS in'], 'CONTAINER-API-01 has modeled runtime and ingress controls')], 6);

const snmpMonitorSite = targetRangeSite(4, 'monitor-1');
seedTargetAccess(snmpMonitorSite, 'OPERATIONS-SERVICES', 'MONITOR-01 SYNTHETIC SNMP REVIEW');
const snmpManagementSimulation = build(4, 'purple-snmp-management-state', 'Purple Team Simulation: MONITOR-01 SNMP Management State',
  `The fictional ${snmpMonitorSite.target.name} (${snmpMonitorSite.target.address}) models an operations telemetry service. Red Team uses authentic SNMP walk and SNMP set syntax against the embedded range alias, observes the session-scoped state change, then Blue Team restricts management access. No SNMP packet leaves the application and no external device is modified.`,
  snmpMonitorSite.site, [
    ['ATTACKER-KALI', 'shell', 'snmpwalk -v2c -c trainingRO monitor-1 1.3.6.1.2.1.1', 'Red Team: collect modeled SNMP system metadata', 'Run authentic SNMP syntax from the synthetic Linux attack console.'],
    ['ATTACKER-KALI', 'shell', 'snmpset -v2c -c trainingRW monitor-1 1.3.6.1.2.1.1.4.0 s range-owner', 'Red Team: model an authorized management-state change', 'The state update exists only in the fictional target range.'],
    ['ATTACKER-KALI', 'shell', 'snmpwalk -v2c -c trainingRO monitor-1 1.3.6.1.2.1.1', 'Red Team: verify modeled SNMP state change', 'Confirm the synthetic sysContact value through the separate Linux workflow.'],
    ['CE-R1', 'privileged', 'configure terminal', 'Blue Team: enter SNMP management boundary hardening', 'Restrict approved management access to the fictional monitoring service.'],
    ['CE-R1', 'config', 'ip access-list extended MONITOR-01-MANAGEMENT', 'Blue Team: define telemetry management policy', 'Create an explicit approved-source boundary.'],
    ['CE-R1', 'acl', 'permit ip host 10.76.99.20 host 10.76.40.10', 'Blue Team: permit management monitoring path', 'Represent the approved management path in the simulator.'],
    ['CE-R1', 'acl', 'deny ip any host 10.76.40.10', 'Blue Team: deny other telemetry management paths', 'Block other modeled access paths.'],
    ['CE-R1', 'acl', 'permit ip any any', 'Blue Team: preserve unrelated services', 'Keep policy order explicit.'],
    ['CE-R1', 'acl', 'exit', 'Blue Team: return to global configuration', 'Attach the policy at the modeled boundary.'],
    ['CE-R1', 'config', 'interface g0/0', 'Blue Team: select operations boundary', 'Enforce policy at the routed ingress.'],
    ['CE-R1', 'interface', 'ip access-group MONITOR-01-MANAGEMENT in', 'Blue Team: enforce monitoring policy', 'Record the simulated ACL attachment.'],
    ['CE-R1', 'interface', 'end', 'Purple Team: return to verification', 'Review policy evidence and persisted state.'],
    ['CE-R1', 'privileged', 'show access-lists', 'Purple Team: verify management boundary', 'Confirm the approved and denied paths.'],
    ...save('CE-R1'),
  ], [requirement('CE-R1', ['runningConfig'], ['ip access-group MONITOR-01-MANAGEMENT in'], 'MONITOR-01 has an explicit management boundary')], 6);

export const ethicalHackingLabs: Record<string, LabConfig> = Object.fromEntries([
  passiveRecon,
  webAssessment,
  credentialDefense,
  lateralMovement,
  capstone,
  redPassiveRecon,
  redWebValidation,
  redIdentityReview,
  redSegmentReview,
  redControlPlaneReview,
  redServiceExposureSimulation,
  redWebBoundarySimulation,
  redRemoteAccessSimulation,
  redSegmentationSimulation,
  redControlPlaneSimulation,
  vlanHoppingSimulation,
  dhcpIntegritySimulation,
  arpIntegritySimulation,
  otSegmentationSimulation,
  apiBoundarySimulation,
  ransomwareRecoverySimulation,
  legacyServiceRetirementSimulation,
  fileAccessSimulation,
  remoteAdministrationSimulation,
  directoryTrustSimulation,
  authenticationAnomalySimulation,
  dnsInventorySimulation,
  containerRuntimeSimulation,
  snmpManagementSimulation,
].map(lab => [lab.id, lab]));
