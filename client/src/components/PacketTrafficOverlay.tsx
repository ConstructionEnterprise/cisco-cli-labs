import { useEffect, useRef } from 'react';
import type { Topology, SandboxNode } from './NetworkSandbox';
import type { TrafficPacket } from '../lib/network-topology';
import { packetHops, packetProgress } from '../lib/packet-animation';

function position(node: SandboxNode, port: string, logical: boolean): [number, number] {
  const index = Math.max(0, node.ports.indexOf(port));
  return logical ? [node.x + 18 + (index % 4) * 38, node.y + 94 - Math.floor(index / 4) * 18] : [node.x + 90, node.y + 48];
}

function Particle({ packet, topology, logical }: { packet: TrafficPacket; topology: Topology; logical: boolean }) {
  const marker = useRef<SVGGElement>(null);
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const hops = packetHops(packet, topology);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const progress = packetProgress(packet, performance.now());
      const segment = Math.floor(progress);
      const path = paths.current[segment];
      if (marker.current) {
        marker.current.style.visibility = path ? 'visible' : 'hidden';
        if (path) {
          const point = path.getPointAtLength((progress - segment) * path.getTotalLength());
          marker.current.setAttribute('transform', `translate(${point.x} ${point.y})`);
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [packet]);
  return <g pointerEvents="none" aria-label={`${packet.direction}: ${packet.source} to ${packet.destination}`}>
    {hops.map((hop, index) => {
      const [x1, y1] = position(hop.from, hop.fromPort, logical);
      const [x2, y2] = position(hop.to, hop.toPort, logical);
      const mid = (x1 + x2) / 2;
      const cable = logical ? `C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}` : `L ${mid} ${y1} L ${mid} ${y2} L ${x2} ${y2}`;
      // Include ingress-to-egress travel through intermediate devices.
      const previous = index ? position(hop.from, hops[index - 1].toPort, logical) : [x1, y1];
      return <path key={index} ref={element => { paths.current[index] = element; }} d={`M ${previous[0]} ${previous[1]} L ${x1} ${y1} ${cable}`} fill="none" stroke="none" />;
    })}
    <g ref={marker} style={{ visibility: 'hidden' }}>
      <circle r="10" fill={packet.color} opacity=".2" />
      <circle r="4.5" fill={packet.color} stroke="#ffffff" strokeWidth="1" />
    </g>
  </g>;
}

export default function PacketTrafficOverlay({ packets, topology, logical = false }: { packets: TrafficPacket[]; topology: Topology; logical?: boolean }) {
  return <g>{packets.map(packet => <Particle key={packet.id} packet={packet} topology={topology} logical={logical} />)}</g>;
}
