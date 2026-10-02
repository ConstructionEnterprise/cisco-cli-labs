import type { Topology, SandboxNode } from '../components/NetworkSandbox';
import type { TrafficPacket } from './network-topology';

export const PACKET_HOP_SECONDS = 1.4;

export function packetProgress(packet: TrafficPacket, now: number) {
  const elapsed = ((now - (packet.startedAt ?? now)) / 1000 - (packet.startDelay || 0)) / PACKET_HOP_SECONDS;
  if (elapsed < 0 || packet.path.length === 0) return elapsed;
  return elapsed % packet.path.length;
}

export function packetHops(packet: TrafficPacket, topology: Topology) {
  const source = topology.nodes.find(node => node.id === packet.source || node.name === packet.source);
  if (!source) return [];
  let current: SandboxNode = source;
  const hops = [];
  for (const id of packet.path) {
    const link = topology.links.find(candidate => candidate.id === id);
    if (!link || (link.from !== current.id && link.to !== current.id)) return [];
    const forward: boolean = link.from === current.id;
    const next: SandboxNode | undefined = topology.nodes.find(node => node.id === (forward ? link.to : link.from));
    if (!next) return [];
    hops.push({ from: current, to: next, fromPort: forward ? link.fromPort : link.toPort, toPort: forward ? link.toPort : link.fromPort });
    current = next;
  }
  return hops;
}
