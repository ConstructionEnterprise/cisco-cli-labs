# Five-Lab CCNA Cisco CLI Curriculum

This five-lab sequence is aligned to Cisco’s current CCNA 200-301 v1.1 domains: Network Fundamentals, Network Access, IP Connectivity, IP Services, Security Fundamentals, and Automation and Programmability. [1] [2]

## Lab 1 — Addressing, Ethernet, and CLI Foundations

**Purpose:** Build comfort with Cisco IOS modes and the fundamentals beneath every later lab.

**Topics:** OSI/TCP-IP orientation; Ethernet frames; MAC addresses and MAC address tables; IPv4 address classes as historical context; subnetting; private IPv4; IPv6 global, unique-local, link-local, multicast, and anycast concepts; interface addressing; `show` and `ping` verification; basic cabling and interface states.

**Topology:** One switch, two routers, and two hosts; a dual-stack management segment plus one IPv6 transit segment.

**Capstone:** Correct a misaddressed interface and prove local and remote reachability using `show interfaces`, `show ip interface brief`, `show ipv6 interface brief`, `show mac address-table`, and ping.

## Lab 2 — Switching, VLANs, Trunks, and Wireless Access

**Purpose:** Learn how switches forward frames and separate broadcast domains.

**Topics:** MAC learning and aging; access ports; voice VLAN concept; default VLAN; VLAN creation; 802.1Q trunks; native VLAN; inter-VLAN routing using router-on-a-stick; CDP and LLDP; EtherChannel with LACP; Rapid PVST+ roles and states; PortFast and BPDU Guard; wireless SSID, channels, RF, WPA2/WPA3, AP and WLC placement.

**Topology:** Two switches, one router, three VLANs, an EtherChannel between switches, and a simulated access point.

**Capstone:** Repair a trunk/access mismatch and restore communication between two VLANs while preserving the management VLAN.

## Lab 3 — Routing and Path Selection

**Purpose:** Turn connected networks into a routed topology and learn how routers choose paths.

**Topics:** Routing-table fields; connected, local, and static routes; IPv4 and IPv6 network, host, default, and floating static routes; longest-prefix match; administrative distance; metric; single-area OSPFv2; OSPF neighbor adjacency; router ID; point-to-point and broadcast concepts; DR/BDR; first-hop redundancy concepts.

**Topology:** Three routers with dual-stack loopbacks and redundant paths.

**Capstone:** Diagnose a broken route, restore OSPFv2 adjacency, and explain why the selected path wins.

## Lab 4 — Network Services and Device Management

**Purpose:** Configure the services that make an IP network usable and operable.

**Topics:** DHCP server, DHCP client, DHCP relay; DNS role; NAT/PAT and inside-source static and pool concepts; NTP client/server; syslog facilities and severity levels; SNMP purpose; SSH remote access; console and HTTP/HTTPS management; TFTP/FTP capabilities; QoS classification, marking, queuing, policing, and shaping concepts.

**Topology:** Router, switch, client VLANs, simulated service segment, and an upstream provider router.

**Capstone:** Restore client addressing and remote management after a DHCP relay, NAT, and NTP configuration failure.

## Lab 5 — Security, Automation, and Integrated Troubleshooting

**Purpose:** Combine operational security and modern management concepts in a realistic final challenge.

**Topics:** Threats, vulnerabilities, exploits, and mitigations; local passwords and password policy; SSH hardening; standard and extended IPv4 ACL concepts; IPv6 ACL considerations; port security; DHCP snooping; Dynamic ARP Inspection; AAA concepts; wireless security; IPsec remote-access and site-to-site VPN concepts; controller-based networking; control/data plane separation; overlay/underlay/fabric; REST APIs, CRUD, HTTP verbs, JSON; Ansible and Terraform recognition; predictive and generative AI in network operations.

**Topology:** Dual-stack campus with users, server segment, wireless segment, edge router, and a management/controller segment.

**Capstone:** Work through a multi-symptom outage involving an ACL, port-security violation, incorrect gateway, and OSPF route issue, then interpret a small JSON/REST automation example.

## Progression design

Each lab should use the same learning loop: **Observe → Configure → Verify → Break → Repair → Explain**. The learner should always be able to type commands manually, reveal a conceptual hint, or run the next suggested command. Each lab has independent device state, step progress, reset behavior, and a final verification challenge.

## Coverage note

Five labs cannot provide the depth of a full certification course, so the design groups related exam topics into coherent practice environments. The app should label conceptual topics as “understand” and CLI tasks as “configure/verify” so the learner knows which skills are being simulated directly.

## References

[1]: https://learningnetwork.cisco.com/s/ccna-exam-topics "Cisco Learning Network — 200-301 CCNA Exam Topics and Study Guide"

[2]: https://learningcontent.cisco.com/documents/marketing/exam-topics/200-301-CCNA-v1.1.pdf "Cisco Public — CCNA Exam v1.1 (200-301)"
