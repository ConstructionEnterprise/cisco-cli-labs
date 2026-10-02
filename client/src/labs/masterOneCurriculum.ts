import type { LabConfig } from './labDefinitions';

// IDs stay stable for saved attempts; placement is independent of legacy ID prefixes.
export const MASTER_ONE_CURRICULUM = [
  { tranche: 2, title: 'Applied Addressing and Neighbor Discovery', labs: [
    'tr2-ipv4-interface', 'tr5-binary-cidr', 'tr2-ipv6-interface',
    'tr5-ipv6-subnetting', 'tr5-vlsm-dual-stack', 'tr5-broadcast-neighbor-discovery',
  ] },
  { tranche: 3, title: 'Switching and LAN Services', labs: [
    'tr2-vlan-access', 'tr2-trunking', 'tr2-stp', 'tr3-router-on-a-stick', 'tr3-dhcp-server',
  ] },
  { tranche: 4, title: 'Routing and Resilience', labs: [
    'tr3-static-routing', 'tr3-ospfv2', 'tr3-ospf-drbdr', 'tr3-ospfv3', 'tr3-fhrp', 'tr5-multicast',
  ] },
  { tranche: 5, title: 'Security and Edge Policy', labs: [
    'tr4-port-security', 'tr4-ssh-hardening', 'tr4-standard-acl', 'tr4-extended-acl', 'tr4-nat-pat',
  ] },
] as const;

export function applyMasterOneCurriculum(registry: Record<string, LabConfig>) {
  for (const group of MASTER_ONE_CURRICULUM) {
    group.labs.forEach((id, index) => {
      const lab = registry[id];
      if (!lab || lab.type !== 'guided' || (lab.masterTranche ?? 1) !== 1) throw new Error(`Missing Master One curriculum lab: ${id}`);
      lab.masterTranche = 1;
      lab.tranche = group.tranche;
      lab.curriculumOrder = index + 1;
    });
  }
  // Older companion scenarios remain available immediately after their related lesson.
  const companions: Record<string, string> = {
    'sandbox-access-segmentation': 'tr2-vlan-access',
    'sandbox-trunk-etherchannel': 'tr2-trunking',
    'sandbox-routing-core': 'tr3-static-routing',
    'sandbox-ospfv2-multiplatform': 'tr3-ospfv2',
  };
  for (const [id, guidedId] of Object.entries(companions)) {
    const sandbox = registry[id];
    if (!sandbox) continue;
    const guided = registry[guidedId];
    sandbox.masterTranche = 1;
    sandbox.tranche = guided.tranche;
    sandbox.curriculumOrder = guided.curriculumOrder! + 0.5;
  }
}

export function compareCurriculumOrder(a: { curriculumOrder?: number }, b: { curriculumOrder?: number }) {
  return (a.curriculumOrder ?? Number.MAX_SAFE_INTEGER) - (b.curriculumOrder ?? Number.MAX_SAFE_INTEGER);
}
