import type { LabConfig, LabStep } from './labDefinitions';
import type { Requirement } from '../lib/learning-engine';

type Command = [string, LabStep['requiredMode'], string, string, string?];

const ORDER: Record<string, number> = {
  'mt2-tr1-time-services': 3,
  'mt2-tr1-secure-web-services': 4,
  'mt2-tr1-icmp-diagnostics': 5,
  'mt2-tr2-wireless-capacity': 2,
  'mt2-tr2-wan-ppp-lcp': 3,
  'mt2-tr2-enterprise-server-services': 4,
  'mt2-tr2-wan-path-engineering': 5,
  'mt2-tr3-ansible-readiness': 2,
  'mt2-tr3-rest-crud-api': 3,
  'mt2-tr3-container-networking': 4,
  'mt2-tr3-vrf-segmentation': 5,
  'mt2-tr4-flexible-load-balancing': 2,
  'mt2-tr4-glbp-gateway': 3,
  'mt2-tr4-virtual-router-redundancy': 4,
  'mt2-tr4-reverse-proxy': 5,
  'mt2-tr5-bgp-peering': 2,
  'mt2-tr5-bgp-route-reflector': 3,
  'mt2-tr5-vrf-wan': 4,
  'mt2-tr5-vlsm-supernetting': 5,
};

const success = (label: string) => `${label} recorded in the modeled configuration.`;

function steps(commands: Command[]): LabStep[] {
  return commands.map(([targetDevice, requiredMode, expectedCommand, label, description], index) => ({
    id: index + 1,
    targetDevice,
    requiredMode,
    expectedCommand,
    label,
    description: description || `Apply and verify ${label.toLowerCase()}.`,
    successMessage: success(label),
    validation: () => true,
  }));
}

function edgeTopology(serverRole: string, extra: any[] = []): LabConfig['topology'] {
  return {
    devices: [
      { id: 'r1', name: 'CE-R1', kind: 'router', role: 'Enterprise edge router', x: 150, y: 220, ports: ['g0/0', 'g0/1'] },
      { id: 'sw1', name: 'CE-SW1', kind: 'switch', role: 'Services access switch', x: 460, y: 220, ports: ['g0/1', 'g0/2', 'g0/3', 'g0/4'] },
      { id: 'srv1', name: 'CE-SRV1', kind: 'server', role: serverRole, x: 790, y: 130, ports: ['eth0'] },
      { id: 'pc1', name: 'CLIENT-PC1', kind: 'pc', role: 'Enterprise client', x: 790, y: 330, ports: ['eth0'] },
      ...extra,
    ],
    links: [
      { id: 'r1-sw1', from: 'r1', to: 'sw1', fromPort: 'g0/0', toPort: 'g0/1' },
      { id: 'sw1-srv1', from: 'sw1', to: 'srv1', fromPort: 'g0/2', toPort: 'eth0' },
      { id: 'sw1-pc1', from: 'sw1', to: 'pc1', fromPort: 'g0/3', toPort: 'eth0' },
    ],
  };
}

function routedOutcome(address: string, label: string): Requirement[] {
  return [{ device: 'CE-R1', path: ['interfaces', 'g0/0', 'ipv4'], value: [address], label }];
}

function lab(id: string, tranche: 1 | 2 | 3 | 4 | 5, title: string, description: string, commands: Command[], topology: LabConfig['topology'], outcomes: Requirement[]): LabConfig {
  return { id, masterTranche: 2, tranche, curriculumOrder: ORDER[id], status: 'active', type: 'guided', title, description, topology, initialState: {}, steps: steps(commands), outcomes };
}

const edgeBringUp = (address: string, description: string): Command[] => [
  ['CE-R1', 'user', 'enable', 'Router Privileged Mode'],
  ['CE-R1', 'privileged', 'configure terminal', 'Router Global Configuration'],
  ['CE-R1', 'config', 'interface g0/0', 'Select Services Uplink'],
  ['CE-R1', 'interface', `description ${description}`, 'Document Services Uplink'],
  ['CE-R1', 'interface', `ip address ${address}`, 'Address Services Uplink'],
  ['CE-R1', 'interface', 'no shutdown', 'Enable Services Uplink'],
  ['CE-R1', 'interface', 'end', 'Return to Privileged EXEC'],
];

const serverBringUp = (address: string, description: string): Command[] => [
  ['CE-SRV1', 'user', 'enable', 'Server Privileged Mode'],
  ['CE-SRV1', 'privileged', 'configure terminal', 'Server Global Configuration'],
  ['CE-SRV1', 'config', 'interface eth0', 'Select Server NIC'],
  ['CE-SRV1', 'interface', `description ${description}`, 'Document Server NIC'],
  ['CE-SRV1', 'interface', `ip address ${address}`, 'Address Server NIC'],
  ['CE-SRV1', 'interface', 'no shutdown', 'Enable Server NIC'],
  ['CE-SRV1', 'interface', 'end', 'Return Server to Privileged EXEC'],
];

export const masterTwoExpansionLabs: Record<string, LabConfig> = {
  'mt2-tr1-time-services': lab(
    'mt2-tr1-time-services', 1, 'NTP and PTP Time Services',
    'Establish consistent enterprise time with NTP for management systems and PTP for a latency-sensitive media segment.',
    [
      ...edgeBringUp('10.60.0.1 255.255.255.0', 'TIME SERVICES GATEWAY'),
      ...serverBringUp('10.60.0.10 255.255.255.0', 'NTP PTP GRANDMASTER'),
      ['CE-R1', 'privileged', 'configure terminal', 'Return to Router Configuration'],
      ['CE-R1', 'config', 'ntp server 10.60.0.10', 'Configure NTP Server'],
      ['CE-R1', 'config', 'ptp mode boundary', 'Configure PTP Boundary Clock'],
      ['CE-R1', 'config', 'end', 'Return to Verification'],
      ['CE-R1', 'privileged', 'show ntp associations', 'Verify NTP Association'],
      ['CE-R1', 'privileged', 'show ptp clock', 'Verify PTP Clock'],
    ], edgeTopology('NTP/PTP grandmaster'), routedOutcome('10.60.0.1 255.255.255.0', 'Time-services gateway is addressed')
  ),
  'mt2-tr1-secure-web-services': lab(
    'mt2-tr1-secure-web-services', 1, 'SSL and TLS Service Delivery',
    'Publish an internal web service over TLS and distinguish the encrypted application endpoint from the underlying IP path.',
    [
      ...edgeBringUp('10.61.0.1 255.255.255.0', 'SECURE SERVICES GATEWAY'),
      ...serverBringUp('10.61.0.10 255.255.255.0', 'TLS APPLICATION SERVER'),
      ['CE-SRV1', 'privileged', 'configure terminal', 'Return to Server Configuration'],
      ['CE-SRV1', 'config', 'ip http secure-server', 'Enable HTTPS Service'],
      ['CE-SRV1', 'config', 'ip http secure-port 443', 'Set TLS Service Port'],
      ['CE-SRV1', 'config', 'ip host portal.corp.example 10.61.0.10', 'Publish Secure Service Name'],
      ['CE-SRV1', 'config', 'end', 'Return to Verification'],
      ['CE-SRV1', 'privileged', 'show ip http server secure-status', 'Verify TLS Service'],
      ['CE-SRV1', 'privileged', 'show hosts', 'Verify DNS Record'],
    ], edgeTopology('TLS application server'), routedOutcome('10.61.0.1 255.255.255.0', 'Secure-services gateway is addressed')
  ),
  'mt2-tr1-icmp-diagnostics': lab(
    'mt2-tr1-icmp-diagnostics', 1, 'ICMP Operations and Diagnostics',
    'Use ICMP echo and traceroute evidence to separate basic reachability from application availability and policy decisions.',
    [
      ...edgeBringUp('10.62.0.1 255.255.255.0', 'ICMP DIAGNOSTICS LAN'),
      ...serverBringUp('10.62.0.10 255.255.255.0', 'DIAGNOSTIC TARGET SERVER'),
      ['CE-R1', 'privileged', 'ping 10.62.0.10', 'Generate ICMP Echo Evidence'],
      ['CE-R1', 'privileged', 'traceroute 10.62.0.10', 'Trace the Routed Path'],
      ['CE-R1', 'privileged', 'show arp', 'Inspect ICMP Neighbor Evidence'],
      ['CE-R1', 'privileged', 'show ip route', 'Inspect Routing Evidence'],
    ], edgeTopology('ICMP diagnostic target'), routedOutcome('10.62.0.1 255.255.255.0', 'ICMP diagnostic gateway is addressed')
  ),

  'mt2-tr2-wireless-capacity': lab(
    'mt2-tr2-wireless-capacity', 2, 'Wireless Capacity and Roaming',
    'Plan non-overlapping RF cells, channel reuse, and a wired uplink that can support roaming enterprise clients.',
    [
      ['CE-AP1', 'user', 'enable', 'AP Privileged Mode'],
      ['CE-AP1', 'privileged', 'configure terminal', 'AP Global Configuration'],
      ['CE-AP1', 'config', 'dot11 ssid CORP-ROAM', 'Create Roaming SSID'],
      ['CE-AP1', 'config', 'wireless channel 1', 'Select Non-Overlapping Channel'],
      ['CE-AP1', 'config', 'wireless band 5ghz', 'Prefer 5 GHz Capacity Band'],
      ['CE-AP1', 'config', 'wireless power 14', 'Tune Cell Transmit Power'],
      ['CE-AP1', 'config', 'interface eth0', 'Select Wired AP Uplink'],
      ['CE-AP1', 'interface', 'description ROAMING WLAN UPLINK', 'Document AP Uplink'],
      ['CE-AP1', 'interface', 'no shutdown', 'Enable AP Uplink'],
      ['CE-AP1', 'interface', 'end', 'Return to Verification'],
      ['CE-AP1', 'privileged', 'show interfaces eth0', 'Verify AP Uplink'],
    ],
    { devices: [
      { id: 'r1', name: 'CE-R1', kind: 'router', role: 'Wireless distribution router', x: 130, y: 230, ports: ['g0/0'] },
      { id: 'ap1', name: 'CE-AP1', kind: 'access-point', role: 'West-floor roaming access point', x: 450, y: 180, ports: ['eth0', 'wlan0'] },
      { id: 'ap2', name: 'CE-AP2', kind: 'access-point', role: 'East-floor roaming access point', x: 450, y: 360, ports: ['eth0', 'wlan0'] },
      { id: 'pc1', name: 'WIFI-PC1', kind: 'pc', role: 'Roaming wireless client', x: 800, y: 260, ports: ['eth0'] },
    ], links: [
      { id: 'r1-ap1', from: 'r1', to: 'ap1', fromPort: 'g0/0', toPort: 'eth0' },
      { id: 'ap1-client', from: 'ap1', to: 'pc1', fromPort: 'wlan0', toPort: 'eth0' },
    ] }, []
  ),
  'mt2-tr2-wan-ppp-lcp': lab(
    'mt2-tr2-wan-ppp-lcp', 2, 'WAN PPP and LCP Negotiation',
    'Bring up a provider-facing PPP link, establish LCP options, and apply CHAP authentication before carrying routed traffic.',
    [
      ['CE-R1', 'user', 'enable', 'Branch Router Privileged Mode'],
      ['CE-R1', 'privileged', 'configure terminal', 'Branch Router Global Configuration'],
      ['CE-R1', 'config', 'interface g0/1', 'Select WAN Circuit'],
      ['CE-R1', 'interface', 'description PPP WAN TO PROVIDER', 'Document WAN Circuit'],
      ['CE-R1', 'interface', 'encapsulation ppp', 'Enable PPP Encapsulation'],
      ['CE-R1', 'interface', 'ppp authentication chap', 'Require CHAP Authentication'],
      ['CE-R1', 'interface', 'ip address 198.51.100.2 255.255.255.252', 'Address PPP WAN Circuit'],
      ['CE-R1', 'interface', 'no shutdown', 'Enable WAN Circuit'],
      ['CE-R1', 'interface', 'end', 'Return to Verification'],
      ['CE-R1', 'privileged', 'show interfaces g0/1', 'Verify PPP Link State'],
      ['CE-R1', 'privileged', 'show ppp multilink', 'Inspect LCP Negotiation'],
    ], edgeTopology('WAN provider test server'), [{ device: 'CE-R1', path: ['interfaces', 'g0/1', 'ipv4'], value: ['198.51.100.2 255.255.255.252'], label: 'PPP WAN interface is addressed' }]
  ),
  'mt2-tr2-enterprise-server-services': lab(
    'mt2-tr2-enterprise-server-services', 2, 'Enterprise Server Services',
    'Deploy an infrastructure server that provides DHCP, DNS, and HTTPS service discovery to an enterprise access segment.',
    [
      ...serverBringUp('10.64.0.10 255.255.255.0', 'INFRASTRUCTURE SERVICES'),
      ['CE-SRV1', 'privileged', 'configure terminal', 'Return to Server Configuration'],
      ['CE-SRV1', 'config', 'ip dns server', 'Enable DNS Server'],
      ['CE-SRV1', 'config', 'ip host intranet.corp.example 10.64.0.10', 'Create Intranet Record'],
      ['CE-SRV1', 'config', 'ip http secure-server', 'Enable HTTPS Server'],
      ['CE-SRV1', 'config', 'end', 'Return to Verification'],
      ['CE-SRV1', 'privileged', 'show hosts', 'Verify DNS Records'],
      ['CE-SRV1', 'privileged', 'show ip http server secure-status', 'Verify HTTPS Service'],
    ], edgeTopology('DHCP, DNS, and HTTPS services server'), [{ device: 'CE-SRV1', path: ['interfaces', 'eth0', 'ipv4'], value: ['10.64.0.10 255.255.255.0'], label: 'Infrastructure server is addressed' }]
  ),
  'mt2-tr2-wan-path-engineering': lab(
    'mt2-tr2-wan-path-engineering', 2, 'WAN Path Engineering',
    'Use static routing, interface evidence, and controlled probes to document an enterprise WAN path and its service-level assumptions.',
    [
      ...edgeBringUp('172.20.0.1 255.255.255.252', 'WAN PRIMARY CIRCUIT'),
      ['CE-R1', 'privileged', 'configure terminal', 'Return to Router Configuration'],
      ['CE-R1', 'config', 'ip route 10.65.0.0 255.255.255.0 172.20.0.2', 'Install Remote Site Route'],
      ['CE-R1', 'config', 'end', 'Return to Verification'],
      ['CE-R1', 'privileged', 'show ip route static', 'Verify WAN Route'],
      ['CE-R1', 'privileged', 'show interfaces g0/0', 'Verify WAN Interface'],
      ['CE-R1', 'privileged', 'traceroute 10.65.0.10', 'Trace Remote Site Path'],
    ], edgeTopology('Remote-site services host'), routedOutcome('172.20.0.1 255.255.255.252', 'WAN path interface is addressed')
  ),

  'mt2-tr3-ansible-readiness': lab(
    'mt2-tr3-ansible-readiness', 3, 'Ansible Network Automation Readiness',
    'Prepare a Cisco device for inventory-driven configuration management: naming, SSH access, an automation account, and idempotent show-command verification.',
    [
      ['CE-SW1', 'user', 'enable', 'Switch Privileged Mode'],
      ['CE-SW1', 'privileged', 'configure terminal', 'Switch Global Configuration'],
      ['CE-SW1', 'config', 'hostname CE-SW1-AUTOMATED', 'Set Stable Inventory Name'],
      ['CE-SW1', 'config', 'ip domain-name corp.example', 'Set Automation Domain'],
      ['CE-SW1', 'config', 'username ansible privilege 15 secret cisco', 'Create Automation Account'],
      ['CE-SW1', 'config', 'crypto key generate rsa modulus 2048', 'Create SSH Key Material'],
      ['CE-SW1', 'config', 'line vty 0 4', 'Select Remote Access Lines'],
      ['CE-SW1', 'line', 'login local', 'Use Local Automation Account'],
      ['CE-SW1', 'line', 'transport input ssh', 'Permit SSH Automation Only'],
      ['CE-SW1', 'line', 'end', 'Return to Verification'],
      ['CE-SW1', 'privileged', 'show running-config', 'Review Idempotent Device Intent'],
      ['CE-SW1', 'privileged', 'show ip ssh', 'Verify SSH Readiness'],
    ], edgeTopology('Ansible control and inventory server'), []
  ),
  'mt2-tr3-rest-crud-api': lab(
    'mt2-tr3-rest-crud-api', 3, 'REST and CRUD Network API',
    'Expose a modeled HTTPS API endpoint and use Create, Read, Update, and Delete as an operational framework for safely changing network intent.',
    [
      ...serverBringUp('10.70.0.10 255.255.255.0', 'REST API SERVER'),
      ['CE-SRV1', 'privileged', 'configure terminal', 'Return to API Server Configuration'],
      ['CE-SRV1', 'config', 'ip http secure-server', 'Enable REST Transport Security'],
      ['CE-SRV1', 'config', 'ip http secure-port 443', 'Set API HTTPS Port'],
      ['CE-SRV1', 'config', 'ip host inventory-api.corp.example 10.70.0.10', 'Create API Service Record'],
      ['CE-SRV1', 'config', 'end', 'Return to API Verification'],
      ['CE-SRV1', 'privileged', 'show ip http server secure-status', 'Read API Transport State'],
      ['CE-SRV1', 'privileged', 'show hosts', 'Read API Name Record'],
    ], edgeTopology('REST inventory API server'), [{ device: 'CE-SRV1', path: ['interfaces', 'eth0', 'ipv4'], value: ['10.70.0.10 255.255.255.0'], label: 'REST API server is addressed' }]
  ),
  'mt2-tr3-container-networking': lab(
    'mt2-tr3-container-networking', 3, 'Container Service Networking',
    'Publish a container-hosted application through a stable service address, DNS name, and TLS listener while keeping the physical infrastructure observable.',
    [
      ...serverBringUp('10.71.0.20 255.255.255.0', 'CONTAINER APPLICATION HOST'),
      ['CE-SRV1', 'privileged', 'configure terminal', 'Return to Container Host Configuration'],
      ['CE-SRV1', 'config', 'ip dns server', 'Enable Container Service DNS'],
      ['CE-SRV1', 'config', 'ip host orders.corp.example 10.71.0.20', 'Publish Container Service Name'],
      ['CE-SRV1', 'config', 'ip http secure-server', 'Publish TLS Service Listener'],
      ['CE-SRV1', 'config', 'end', 'Return to Verification'],
      ['CE-SRV1', 'privileged', 'show hosts', 'Verify Service Discovery'],
      ['CE-SRV1', 'privileged', 'show ip interface brief', 'Verify Container Host Underlay'],
    ], edgeTopology('Container application host'), [{ device: 'CE-SRV1', path: ['interfaces', 'eth0', 'ipv4'], value: ['10.71.0.20 255.255.255.0'], label: 'Container host underlay is addressed' }]
  ),
  'mt2-tr3-vrf-segmentation': lab(
    'mt2-tr3-vrf-segmentation', 3, 'VRF Service Segmentation',
    'Separate production and management routing contexts with VRF forwarding, then verify that route lookups occur in the intended tenant table.',
    [
      ['CE-R1', 'user', 'enable', 'Router Privileged Mode'],
      ['CE-R1', 'privileged', 'configure terminal', 'Router Global Configuration'],
      ['CE-R1', 'config', 'ip vrf PROD', 'Create Production VRF'],
      ['CE-R1', 'config', 'ip vrf MGMT', 'Create Management VRF'],
      ['CE-R1', 'config', 'interface g0/0', 'Select Production Interface'],
      ['CE-R1', 'interface', 'ip vrf forwarding PROD', 'Assign Production VRF'],
      ['CE-R1', 'interface', 'ip address 10.72.0.1 255.255.255.0', 'Address Production VRF'],
      ['CE-R1', 'interface', 'no shutdown', 'Enable Production Interface'],
      ['CE-R1', 'interface', 'end', 'Return to Verification'],
      ['CE-R1', 'privileged', 'show ip vrf', 'Verify VRF Inventory'],
      ['CE-R1', 'privileged', 'show ip route vrf PROD', 'Verify Production Route Table'],
    ], edgeTopology('VRF-aware services server'), routedOutcome('10.72.0.1 255.255.255.0', 'Production VRF interface is addressed')
  ),

  'mt2-tr4-flexible-load-balancing': lab(
    'mt2-tr4-flexible-load-balancing', 4, 'Flexible Application Load Balancing',
    'Build a virtual service with multiple application members and inspect the service pool as a foundation for health-aware traffic distribution.',
    [
      ...edgeBringUp('10.80.0.1 255.255.255.0', 'APPLICATION DELIVERY GATEWAY'),
      ['CE-R1', 'privileged', 'configure terminal', 'Return to Load Balancer Configuration'],
      ['CE-R1', 'config', 'ip slb serverfarm WEB-FARM', 'Create Web Server Farm'],
      ['CE-R1', 'config', 'ip slb server WEB-01 10.80.0.11', 'Add First Pool Member'],
      ['CE-R1', 'config', 'ip slb server WEB-02 10.80.0.12', 'Add Second Pool Member'],
      ['CE-R1', 'config', 'ip slb virtual 10.80.0.100 tcp', 'Publish Virtual Service'],
      ['CE-R1', 'config', 'end', 'Return to Verification'],
      ['CE-R1', 'privileged', 'show ip slb', 'Verify Flexible Service Pool'],
    ], edgeTopology('Application server farm'), routedOutcome('10.80.0.1 255.255.255.0', 'Application delivery gateway is addressed')
  ),
  'mt2-tr4-glbp-gateway': lab(
    'mt2-tr4-glbp-gateway', 4, 'GLBP Gateway Load Sharing',
    'Configure a GLBP virtual gateway so first-hop redundancy can also distribute client forwarding across multiple active virtual forwarders.',
    [
      ['CE-R1', 'user', 'enable', 'Gateway One Privileged Mode'],
      ['CE-R1', 'privileged', 'configure terminal', 'Gateway One Global Configuration'],
      ['CE-R1', 'config', 'interface g0/0', 'Select Client VLAN Gateway'],
      ['CE-R1', 'interface', 'ip address 10.81.0.2 255.255.255.0', 'Address Gateway One'],
      ['CE-R1', 'interface', 'glbp 10 ip 10.81.0.1', 'Create GLBP Virtual Gateway'],
      ['CE-R1', 'interface', 'glbp 10 priority 120', 'Set GLBP Gateway Priority'],
      ['CE-R1', 'interface', 'glbp 10 preempt', 'Enable GLBP Preemption'],
      ['CE-R1', 'interface', 'no shutdown', 'Enable Client VLAN Gateway'],
      ['CE-R1', 'interface', 'end', 'Return to Verification'],
      ['CE-R1', 'privileged', 'show glbp brief', 'Verify GLBP Gateway State'],
    ], edgeTopology('GLBP client services'), routedOutcome('10.81.0.2 255.255.255.0', 'GLBP gateway interface is addressed')
  ),
  'mt2-tr4-virtual-router-redundancy': lab(
    'mt2-tr4-virtual-router-redundancy', 4, 'Virtual Router Redundancy Design',
    'Compare HSRP and VRRP behavior by configuring a virtual default gateway with priority and preemption controls.',
    [
      ['CE-R1', 'user', 'enable', 'Gateway Privileged Mode'],
      ['CE-R1', 'privileged', 'configure terminal', 'Gateway Global Configuration'],
      ['CE-R1', 'config', 'interface g0/0', 'Select User Gateway Interface'],
      ['CE-R1', 'interface', 'ip address 10.82.0.2 255.255.255.0', 'Address Physical Gateway'],
      ['CE-R1', 'interface', 'vrrp 20 ip 10.82.0.1', 'Create VRRP Virtual Gateway'],
      ['CE-R1', 'interface', 'vrrp 20 priority 120', 'Set VRRP Priority'],
      ['CE-R1', 'interface', 'vrrp 20 preempt', 'Enable VRRP Preemption'],
      ['CE-R1', 'interface', 'no shutdown', 'Enable Gateway Interface'],
      ['CE-R1', 'interface', 'end', 'Return to Verification'],
      ['CE-R1', 'privileged', 'show vrrp brief', 'Verify Virtual Router State'],
    ], edgeTopology('Virtual gateway client services'), routedOutcome('10.82.0.2 255.255.255.0', 'Virtual-router interface is addressed')
  ),
  'mt2-tr4-reverse-proxy': lab(
    'mt2-tr4-reverse-proxy', 4, 'TLS Reverse Proxy',
    'Publish a single TLS-facing virtual address in front of internal application servers, separating client-facing service identity from server placement.',
    [
      ...edgeBringUp('10.83.0.1 255.255.255.0', 'REVERSE PROXY FRONT END'),
      ['CE-R1', 'privileged', 'configure terminal', 'Return to Proxy Configuration'],
      ['CE-R1', 'config', 'ip slb serverfarm API-FARM', 'Create API Server Farm'],
      ['CE-R1', 'config', 'ip slb server API-01 10.83.0.11', 'Add API Server Member'],
      ['CE-R1', 'config', 'ip slb virtual 10.83.0.100 tcp', 'Publish Reverse Proxy VIP'],
      ['CE-R1', 'config', 'end', 'Return to Verification'],
      ['CE-R1', 'privileged', 'show ip slb', 'Verify Reverse Proxy Service'],
    ], edgeTopology('Reverse proxy application server'), routedOutcome('10.83.0.1 255.255.255.0', 'Reverse-proxy interface is addressed')
  ),

  'mt2-tr5-bgp-peering': lab(
    'mt2-tr5-bgp-peering', 5, 'BGP Enterprise Edge Peering',
    'Build a basic eBGP peering session, advertise an enterprise prefix, and inspect the resulting peer and route evidence.',
    [
      ['CE-R1', 'user', 'enable', 'Enterprise Edge Privileged Mode'],
      ['CE-R1', 'privileged', 'configure terminal', 'Enterprise Edge Global Configuration'],
      ['CE-R1', 'config', 'interface g0/1', 'Select Provider Edge Link'],
      ['CE-R1', 'interface', 'ip address 203.0.113.2 255.255.255.252', 'Address Provider Edge Link'],
      ['CE-R1', 'interface', 'no shutdown', 'Enable Provider Edge Link'],
      ['CE-R1', 'interface', 'exit', 'Return to Global Configuration'],
      ['CE-R1', 'config', 'router bgp 65001', 'Create Enterprise BGP Process'],
      ['CE-R1', 'bgp', 'neighbor 203.0.113.1 remote-as 65010', 'Define Provider eBGP Neighbor'],
      ['CE-R1', 'bgp', 'network 10.90.0.0 mask 255.255.255.0', 'Advertise Enterprise Prefix'],
      ['CE-R1', 'bgp', 'end', 'Return to Verification'],
      ['CE-R1', 'privileged', 'show ip bgp summary', 'Verify BGP Peer'],
      ['CE-R1', 'privileged', 'show ip bgp', 'Verify BGP Routes'],
    ], edgeTopology('Provider edge services'), [{ device: 'CE-R1', path: ['interfaces', 'g0/1', 'ipv4'], value: ['203.0.113.2 255.255.255.252'], label: 'BGP provider edge interface is addressed' }]
  ),
  'mt2-tr5-bgp-route-reflector': lab(
    'mt2-tr5-bgp-route-reflector', 5, 'BGP Route Reflector Design',
    'Reduce full-mesh iBGP requirements by configuring a route-reflector client relationship and inspecting reflected route intent.',
    [
      ['CE-R1', 'user', 'enable', 'Route Reflector Privileged Mode'],
      ['CE-R1', 'privileged', 'configure terminal', 'Route Reflector Global Configuration'],
      ['CE-R1', 'config', 'router bgp 65001', 'Create iBGP Process'],
      ['CE-R1', 'bgp', 'bgp router-id 10.255.255.1', 'Set Route Reflector ID'],
      ['CE-R1', 'bgp', 'neighbor 10.255.255.2 remote-as 65001', 'Define iBGP Client'],
      ['CE-R1', 'bgp', 'neighbor 10.255.255.2 route-reflector-client', 'Mark Route Reflector Client'],
      ['CE-R1', 'bgp', 'network 10.91.0.0 mask 255.255.255.0', 'Advertise Reflected Prefix'],
      ['CE-R1', 'bgp', 'end', 'Return to Verification'],
      ['CE-R1', 'privileged', 'show ip bgp summary', 'Verify Route Reflector Peer'],
      ['CE-R1', 'privileged', 'show ip bgp', 'Inspect Reflected Prefix'],
    ], edgeTopology('iBGP route-reflector client'), [{ device: 'CE-R1', path: ['settings', 'bgp:router bgp 65001', 'neighbor 10.255.255.2 remote-as'], value: '65001', label: 'Route-reflector client is configured' }]
  ),
  'mt2-tr5-vrf-wan': lab(
    'mt2-tr5-vrf-wan', 5, 'VRF-Aware WAN Routing',
    'Carry separate tenant routing contexts across a WAN edge and verify that a route lookup remains inside the correct VRF.',
    [
      ['CE-R1', 'user', 'enable', 'WAN Edge Privileged Mode'],
      ['CE-R1', 'privileged', 'configure terminal', 'WAN Edge Global Configuration'],
      ['CE-R1', 'config', 'ip vrf CUSTOMER-A', 'Create Customer VRF'],
      ['CE-R1', 'config', 'interface g0/1', 'Select Customer WAN Interface'],
      ['CE-R1', 'interface', 'ip vrf forwarding CUSTOMER-A', 'Bind Interface to Customer VRF'],
      ['CE-R1', 'interface', 'ip address 10.92.0.1 255.255.255.252', 'Address Customer WAN Interface'],
      ['CE-R1', 'interface', 'no shutdown', 'Enable Customer WAN Interface'],
      ['CE-R1', 'interface', 'end', 'Return to Verification'],
      ['CE-R1', 'privileged', 'show ip vrf', 'Verify Customer VRF'],
      ['CE-R1', 'privileged', 'show ip route vrf CUSTOMER-A', 'Verify VRF WAN Routes'],
    ], edgeTopology('VRF-aware WAN services'), [{ device: 'CE-R1', path: ['interfaces', 'g0/1', 'ipv4'], value: ['10.92.0.1 255.255.255.252'], label: 'VRF WAN interface is addressed' }]
  ),
  'mt2-tr5-vlsm-supernetting': lab(
    'mt2-tr5-vlsm-supernetting', 5, 'VLSM and Supernet Route Policy',
    'Apply variable-length addressing at the edge, then summarize contiguous networks into an aggregate route for scalable routing policy.',
    [
      ['CE-R1', 'user', 'enable', 'Router Privileged Mode'],
      ['CE-R1', 'privileged', 'configure terminal', 'Router Global Configuration'],
      ['CE-R1', 'config', 'interface g0/0', 'Select VLSM Transit Interface'],
      ['CE-R1', 'interface', 'ip address 10.93.0.1 255.255.255.252', 'Address /30 Transit Link'],
      ['CE-R1', 'interface', 'no shutdown', 'Enable VLSM Transit Link'],
      ['CE-R1', 'interface', 'exit', 'Return to Global Configuration'],
      ['CE-R1', 'config', 'ip route 10.93.4.0 255.255.252.0 10.93.0.2', 'Install /22 Supernet Route'],
      ['CE-R1', 'config', 'end', 'Return to Verification'],
      ['CE-R1', 'privileged', 'show ip route static', 'Verify Supernet Route'],
      ['CE-R1', 'privileged', 'show ip interface brief', 'Verify VLSM Interface'],
    ], edgeTopology('Aggregated enterprise prefixes'), routedOutcome('10.93.0.1 255.255.255.252', 'VLSM transit interface is addressed')
  ),
};
