import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packetHops, packetProgress } from './packet-animation';
import type { Topology } from '../components/NetworkSandbox';
import type { TrafficPacket } from './network-topology';

const topology: Topology = {
  name: 'Reversed cable orientation', description: '',
  nodes: ['a', 'b', 'c'].map(id => ({ id, name: id.toUpperCase(), kind: 'pc', role: '', x: 0, y: 0, ports: ['eth0', 'eth1'] })),
  links: [
    { id: 'ab', from: 'b', to: 'a', fromPort: 'eth0', toPort: 'eth0' },
    { id: 'bc', from: 'b', to: 'c', fromPort: 'eth1', toPort: 'eth0' },
  ],
};
const packet: TrafficPacket = { id: 'test', source: 'A', destination: 'C', path: ['ab', 'bc'], direction: 'request', color: '#fff', sequence: 1, startedAt: 1000, startDelay: 0.2 };

test('request and reply follow connected ports regardless of cable orientation', () => {
  const request = packetHops(packet, topology);
  assert.deepEqual(request.map(hop => [hop.from.id, hop.to.id]), [['a', 'b'], ['b', 'c']]);
  const reply = packetHops({ ...packet, source: 'C', destination: 'A', path: ['bc', 'ab'] }, topology);
  assert.deepEqual(reply.map(hop => [hop.from.id, hop.fromPort, hop.to.id, hop.toPort]), [['c', 'eth0', 'b', 'eth1'], ['b', 'eth0', 'a', 'eth0']]);
  assert.deepEqual(packetHops({ ...packet, path: ['bc'] }, topology), []);
  assert.deepEqual(packetHops({ ...packet, path: ['missing'] }, topology), []);
});

test('a local ping has no cable hops and does not produce an overlay path', () => {
  assert.deepEqual(packetHops({ ...packet, source: 'A', destination: 'A', path: [] }, topology), []);
});

test('shared timeline retains progress across viewport mounts and repeats after its delay', () => {
  assert.ok(packetProgress(packet, 1100) < 0);
  assert.ok(Math.abs(packetProgress(packet, 2600) - 1) < 1e-9);
  assert.ok(Math.abs(packetProgress(packet, 4000)) < 1e-9);
});
