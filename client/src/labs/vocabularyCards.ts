import type { LabConfig, LabStep } from './labDefinitions';
import { requirementsFor } from '../lib/learning-engine';

// Original definition-matching practice, not an exam question bank.
// Each group belongs to one lesson; later-topic vocabulary is explicitly previewed.
export const VOCABULARY_GROUPS: Record<string, string> = {
  'mt1-tr1-binary-foundations': `Bit|A single binary digit with value zero or one.
Octet|A group of eight bits, such as one dotted-decimal IPv4 component.
Hexadecimal|A base-16 number system using digits 0-9 and letters A-F.
Binary AND|A bitwise operation that returns one only when both input bits are one.
Frame|The Layer 2 unit of data used on an Ethernet link.
Packet|The Layer 3 unit of data that carries an IP header.
Encapsulation|Adding protocol headers, and sometimes trailers, around data as it passes down a network stack.
Decapsulation|Removing protocol headers and trailers as received data passes up a network stack.`,
  'mt1-tr1-ipv4-complete-range': `CIDR|Prefix-length notation that identifies how many leading address bits belong to the network.
Subnet mask|A contiguous sequence of network bits followed by host bits, written in IPv4 dotted decimal.
Broadcast address|An IPv4 destination used to reach all hosts in a broadcast domain, subject to forwarding rules.
RFC 1918|The specification defining the three private IPv4 address blocks.
Loopback|An address used to communicate within the local host rather than across a cable.
Multicast|Delivery to members of a subscribed group rather than every host.
Unicast|Delivery addressed to one destination rather than a broadcast or multicast group.
APIPA|Automatic IPv4 link-local addressing used by Windows when normal DHCP address acquisition is unavailable.`,
  'mt1-tr1-ipv4-subnet-planning': `VLSM|Using different prefix lengths to allocate subnets of different sizes.
Wildcard mask|A matching mask where zero means compare the bit and one means ignore it.
Route summarization|Representing suitably aligned contiguous networks with a shorter common prefix.
Longest-prefix match|Selecting the most-specific installed route matching a destination.
Standard ACL|An IPv4 access list that primarily matches source IP addresses.
Extended ACL|An IPv4 access list that can match protocol, source, destination, and transport ports.`,
  'mt1-tr1-ipv6-masterclass': `Link-local|IPv6 unicast addressing restricted to one link, using the FE80::/10 allocation.
ULA|IPv6 internal unicast addressing from FC00::/7, normally locally assigned from FD00::/8.
Anycast|One address assigned to multiple interfaces, with routing selecting one instance.
SLAAC|IPv6 address autoconfiguration using suitable Router Advertisement prefix information.
DAD|Checking whether a tentative IPv6 address is already in use on its link.
Solicited-node multicast|An IPv6 group derived from the final 24 bits of a unicast or anycast address.
Router Advertisement|An ICMPv6 message that can advertise prefixes and default-router information.
DHCPv6|A protocol that can supply IPv6 addresses or settings, but not the default router.`,
  'vlan-basics': `VLAN|A logical Layer 2 broadcast domain within a switched network.
Access port|A switch port normally carrying one untagged data VLAN for an endpoint.
Trunk|A switch link that can carry traffic for multiple VLANs.
SVI|A virtual Layer 3 interface representing a VLAN on a switch.`,
  'tr2-ipv4-interface': `Default gateway|The local router next hop a host uses to reach destinations outside its subnet.
Administrative shutdown|An interface disabled by configuration rather than merely by a missing physical signal.
ICMP|The IP companion protocol used for messages including echo requests, replies, and errors.
ARP|IPv4 neighbor resolution that maps an on-link IPv4 address to a link-layer address.
TCP|A connection-oriented transport providing ordered delivery and retransmission.
UDP|A datagram transport without built-in connection establishment or retransmission.
TCP three-way handshake|The SYN, SYN-ACK, ACK exchange used to establish a TCP connection.
Transport port|A numeric identifier used by TCP or UDP to distinguish application communication endpoints.`,
  'tr5-binary-cidr': `Network address|The first address of an IPv4 prefix block, with its host bits zero.
Directed broadcast|An IPv4 address whose host bits are all one for a particular subnet.
Limited broadcast|The IPv4 destination 255.255.255.255, which routers do not forward.
Host route|A route matching one address, such as an IPv4 /32 or IPv6 /128.`,
  'tr2-ipv6-interface': `Global unicast|IPv6 unicast addressing intended for global scope, with special allocation exceptions.
Interface identifier|The lower portion of an IPv6 address identifying an interface within a typical /64 subnet.
Zone identifier|Local notation identifying the interface or zone for a scoped IPv6 address.
NDP|ICMPv6-based neighbor and router discovery, replacing IPv4 ARP functions among other tasks.`,
  'tr5-ipv6-subnetting': `Point-to-point link|A link joining two endpoints rather than a shared multi-access segment.
Dual stack|Running IPv4 and IPv6 alongside each other on the same system or network.
MTU|The largest network-layer packet size an interface can transmit without fragmentation at that layer.
Path MTU discovery|Discovering the packet size supported across a path to avoid oversized packets.
Full duplex|Communication that can transmit and receive simultaneously on a link.
Duplex mismatch|A link condition where its two ends use incompatible duplex settings, potentially causing poor performance.`,
  'tr5-vlsm-dual-stack': `Address overlap|Two assigned prefix blocks sharing address space, creating ambiguity or conflict.
NAT|Translating IP addresses between address realms.
PAT|Sharing an address among multiple flows by also translating transport identifiers such as ports.
DNS|A distributed naming system that maps names to records such as IPv4 and IPv6 addresses.
A record|A DNS resource record containing an IPv4 address.
AAAA record|A DNS resource record containing an IPv6 address.`,
  'tr5-broadcast-neighbor-discovery': `Neighbor Solicitation|An ICMPv6 message used for neighbor resolution, reachability checks, or duplicate-address detection.
Neighbor Advertisement|An ICMPv6 message announcing neighbor address or reachability information.
MAC address|A link-layer identifier used by Ethernet forwarding.
MAC learning|A switch recording a received frame's source address against its ingress port and VLAN.
Unknown-unicast flooding|Forwarding a unicast frame with an unknown destination to eligible ports in its VLAN except the ingress port.
MAC aging|Removing dynamically learned forwarding entries after their inactivity timer expires.`,
  'tr2-vlan-access': `Broadcast domain|The set of interfaces that can receive a Layer 2 broadcast within the same VLAN.
Port security|A switch feature limiting or controlling source MAC addresses on a port.
Sticky MAC learning|Learning secure MAC addresses and placing them into the running configuration.
PoE|Delivering electrical power to compatible endpoints over Ethernet cabling.
Voice VLAN|A VLAN used to separate IP-phone voice traffic from ordinary endpoint data.
SSID|The network name identifying a wireless service set.
Authentication|Verifying the identity claimed by a user or device.
Authorization|Determining which actions or resources an authenticated identity is permitted to use.`,
  'tr2-trunking': `802.1Q|The Ethernet VLAN-tagging standard used on many trunks.
Native VLAN|The VLAN used for untagged traffic on an ordinary 802.1Q trunk configuration.
Allowed VLAN list|The configured set of VLANs permitted to use a trunk.
EtherChannel|Combining compatible physical links into one logical port-channel.
LACP|A standards-based protocol negotiating link aggregation using active and passive modes.
LLDP|A vendor-neutral protocol advertising neighbor information on a local link.
CDP|Cisco's local-link neighbor discovery protocol.
Native VLAN mismatch|The two ends of a trunk assigning untagged traffic to different VLANs.
DTP|A Cisco protocol used by supported switches to negotiate trunking rather than aggregate links.`,
  'tr2-stp': `STP|A Layer 2 protocol preventing switching loops by controlling which paths forward.
Root bridge|The switch selected as the reference point for a spanning-tree instance.
PortFast|An edge-port feature allowing rapid transition to forwarding, not a way to disable all STP safeguards.
BPDU Guard|A protection that disables a protected edge port when it receives a spanning-tree BPDU.
RSTP|The rapid spanning-tree protocol providing faster topology convergence than classic STP.
BPDU|A control message used by spanning-tree participants.
Broadcast storm|Excessive broadcast traffic that consumes network capacity, often amplified by a Layer 2 loop.
Root Guard|A spanning-tree protection that prevents a port from becoming a root port after receiving superior BPDUs.`,
  'tr3-router-on-a-stick': `Subinterface|A logical subdivision of a physical router interface, often associated with a VLAN tag.
Inter-VLAN routing|Layer 3 forwarding between different VLAN subnets.
Control plane|The functions that learn topology and calculate forwarding decisions.
Data plane|The functions that forward actual user packets according to forwarding state.
Management plane|The functions used to configure, monitor, and administer a device.
SSH|An encrypted protocol for remote terminal access and related secure operations.
AAA|The combined security functions of authentication, authorization, and accounting.`,
  'tr3-dhcp-server': `DHCP|A protocol leasing IPv4 addresses and supplying settings such as gateway and DNS server.
DORA|The Discover, Offer, Request, Acknowledge exchange commonly used to obtain an IPv4 lease.
DHCP relay|Forwarding client DHCP requests between a client subnet and a server on another subnet.
DHCP snooping|A switch security feature that filters DHCP messages and builds a trusted binding database.
Dynamic ARP Inspection|Validating ARP traffic against trusted information to help prevent ARP spoofing.
NTP|Synchronizing device clocks over a network.
Syslog|Sending event messages to logging collectors with severity information.
SNMP|A protocol used to monitor and manage device information through a management information base.
DHCP lease|A time-limited assignment of an IP address and related configuration to a client.
DHCP reservation|A server-side mapping that assigns a particular address to an identified client.`,
  'tr3-static-routing': `Static route|A route explicitly configured by an administrator rather than learned from a routing protocol.
Default route|The least-specific route, used when no more-specific installed route matches.
Administrative distance|A local preference used to choose between route sources for the same prefix.
Routing metric|A protocol-specific value used to compare candidate paths.
Floating static route|A static route configured with a higher administrative distance to serve as a backup.
TTL|An IPv4 header field reduced at each routed hop to limit packet lifetime.
Hop Limit|The IPv6 header field reduced at each routed hop to stop indefinite forwarding.
Next hop|The immediate neighboring router to which a packet is sent along a selected route.
ECMP|Using multiple eligible equal-cost paths toward the same destination prefix.`,
  'tr3-ospfv2': `OSPF|A link-state interior routing protocol that calculates shortest paths within an autonomous system.
Router ID|The 32-bit identifier used to identify an OSPF router.
LSA|An OSPF advertisement describing link-state information.
LSDB|The collection of link-state advertisements used for topology calculation.
SPF|The shortest-path calculation OSPF uses to derive routes from link-state information.
Passive interface|An OSPF interface setting suppressing neighbor formation while allowing its network to be advertised.
Area 0|The OSPF backbone area connecting ordinary non-backbone areas.`,
  'tr3-ospf-drbdr': `DR|The OSPF designated router that reduces adjacency overhead on a broadcast segment.
BDR|The OSPF backup designated router ready to replace the designated router.
DROTHER|An OSPF router on a multi-access segment that is neither DR nor BDR.
ABR|An OSPF router connecting multiple areas, including the backbone in a normal design.
Stub area|An OSPF area that excludes ordinary external LSAs and typically uses an ABR-provided default route.
Convergence|The process of network devices reaching consistent forwarding information after a change.`,
  'tr3-ospfv3': `OSPFv3|An OSPF version commonly used for IPv6 routing, with address-family extensions also available.
REST API|A resource-oriented interface commonly using HTTP methods to interact with systems.
JSON|A structured data format using objects, arrays, strings, numbers, booleans, and null.
Ansible|An automation tool commonly using declarative playbooks for configuration management.
Terraform|An infrastructure-as-code tool using declared desired state and provider integrations.
Controller-based networking|A network architecture in which a controller coordinates policy and control functions.
Predictive AI|Using learned patterns to forecast outcomes such as failures or traffic demand.
Generative AI|Producing new content such as summaries or configuration suggestions that still require validation.`,
  'tr3-fhrp': `FHRP|Protocols providing hosts a resilient first-hop gateway through shared virtual addressing.
HSRP|Cisco's gateway redundancy protocol with active and standby roles.
VRRP|A standards-based virtual-router redundancy protocol.
Preemption|Allowing a higher-priority eligible gateway to reclaim its preferred active role.
QoS|Classifying and treating traffic differently to manage congestion and service requirements.
Latency|The time taken for data to travel from source to destination.
Jitter|Variation in packet delay over time.
Bandwidth|The nominal data-carrying capacity of a link, not a guarantee of application throughput.
Throughput|The rate of data actually delivered over a connection during a measurement interval.
Packet loss|Packets failing to reach their destination, for example because of congestion, errors, or policy drops.`,
  'tr5-multicast': `IGMP|IPv4 host membership signaling for multicast groups.
MLD|IPv6 multicast listener discovery using ICMPv6.
PIM|Multicast routing mechanisms that use unicast routing information for path checks.
RPF check|Checking whether multicast traffic arrived on the expected interface toward its source or rendezvous point.
Stateful firewall|A firewall that evaluates traffic with connection-state context.
Implicit deny|The default rejection at the end of an ACL when no earlier entry permits the traffic.
VPN|A virtual private network providing protected connectivity across another network.
WPA3|A modern Wi-Fi security suite with stronger authentication protections than legacy open or WEP networks.
RF channel|A selected radio-frequency portion of the spectrum used for wireless communication.
WLC|A controller used to coordinate and manage wireless access points.`,
};

export type NetworkingVocabularyCard = {
  id: string;
  sourceLabId: string;
  term: string;
  definition: string;
  choices: Array<{ label: string; explanation: string }>;
};

/** Returns every authored vocabulary item as a deterministic four-choice review card. */
export function networkingVocabularyCards(): NetworkingVocabularyCard[] {
  const entries = Object.entries(VOCABULARY_GROUPS).flatMap(([sourceLabId, text]) =>
    text.split('\n').filter(Boolean).map((line, index) => {
      const separator = line.indexOf('|');
      return {
        sourceLabId,
        index,
        term: line.slice(0, separator).trim(),
        definition: line.slice(separator + 1).trim(),
      };
    }),
  );

  return entries.map((entry, index) => {
    const options = [entry, 1, 17, 43].map((candidate, optionIndex) =>
      typeof candidate === 'number' ? entries[(index + candidate) % entries.length] : candidate,
    );
    const rotation = index % options.length;
    const ordered = [...options.slice(rotation), ...options.slice(0, rotation)];
    return {
      id: `networking-vocabulary-${entry.sourceLabId}-${entry.index}`,
      sourceLabId: entry.sourceLabId,
      term: entry.term,
      definition: entry.definition,
      choices: ordered.map((choice) => ({ label: choice.term, explanation: choice.definition })),
    };
  });
}

export function addVocabularyCards(registry: Record<string, LabConfig>) {
  Object.entries(VOCABULARY_GROUPS).forEach(([id, text], groupIndex) => {
    const lab = registry[id];
    if (!lab || lab.type !== 'guided' || (lab.masterTranche ?? 1) !== 1 || (lab.tranche ?? 1) > 4) throw new Error(`Invalid vocabulary placement: ${id}`);
    if (lab.steps.some(step => step.exercise?.section === 'Vocabulary match')) return;
    const terms = text.split('\n').map(line => { const [term, definition] = line.split('|'); return { term, definition }; });
    const original = lab.steps;
    const outcomes = [...requirementsFor(lab)];
    const insertions = new Map<number, LabStep[]>();
    terms.forEach((entry, index) => {
      // Space single cards through the existing lesson, keeping original step IDs intact.
      const position = Math.floor(index * original.length / terms.length);
      const anchor = original[position];
      const choices = Array.from({ length: 4 }, (_, offset) => terms[(index + offset) % terms.length]);
      const rotation = index % choices.length;
      const ordered = [...choices.slice(rotation), ...choices.slice(0, rotation)];
      const stepId = 10000 + groupIndex * 100 + index;
      const question = `Which term matches this definition? ${entry.definition}`;
      const card: LabStep = {
        id: stepId, label: `Vocabulary match ${index + 1}`, description: question,
        targetDevice: anchor.targetDevice, requiredMode: anchor.requiredMode, expectedCommand: '', validation: () => true,
        successMessage: `${entry.term}: ${entry.definition}`,
        exercise: { section: 'Vocabulary match', explanation: question,
          worked: [`${entry.term}: ${entry.definition}`, 'Compare the purpose of each alternative rather than choosing by a familiar acronym.'],
          takeaway: `Connect this term to the current lab or the later topic it prepares you for.`,
          fields: [{ label: question, answer: entry.term, choices: ordered.map(choice => ({ label: choice.term, explanation: choice.definition })) }],
        },
      };
      insertions.set(position, [...(insertions.get(position) || []), card]);
      outcomes.push({ device: anchor.targetDevice, path: ['lessonAnswers', String(stepId)], value: true, label: `Vocabulary: ${entry.term}` });
    });
    lab.steps = original.flatMap((step, index) => [...(insertions.get(index) || []), step]);
    lab.outcomes = outcomes;
  });
}
