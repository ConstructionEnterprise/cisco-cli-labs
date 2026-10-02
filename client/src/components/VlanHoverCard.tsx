import { useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Topology } from '@/components/NetworkSandbox';
import { modeledDeviceMac, type Session } from '@/lib/ios-engine';

export type VlanHoverDetail = { label: string; value: string };
export type VlanHoverContent = { title: string; subtitle: string; details: VlanHoverDetail[]; note?: string };

export function useVlanHoverCard() {
  const [card, setCard] = useState<(VlanHoverContent & { x: number; y: number }) | null>(null);
  const show = (event: MouseEvent<Element>, content: VlanHoverContent) => {
    setCard({ ...content, x: event.clientX, y: event.clientY });
  };
  const move = (event: MouseEvent<Element>) => {
    setCard(current => current && current.x === event.clientX && current.y === event.clientY ? current : current && { ...current, x: event.clientX, y: event.clientY });
  };
  const hide = () => setCard(null);
  const tooltip = card && createPortal(
    <div role="tooltip" className="pointer-events-none fixed z-[100] w-64 overflow-hidden rounded-xl border border-[#63e6e2]/45 bg-[#0d1922]/95 shadow-[0_18px_48px_rgba(0,0,0,.58)] backdrop-blur-md"
      style={{ left: Math.max(12, Math.min(card.x + 16, window.innerWidth - 272)), top: Math.max(12, Math.min(card.y + 16, window.innerHeight - (110 + card.details.length * 30))) }}>
      <div className="border-b border-[#63e6e2]/20 bg-[#173039] px-3 py-2">
        <div className="font-mono text-[11px] font-semibold tracking-wide text-[#e7ffff]">{card.title}</div>
        <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[.14em] text-[#63e6e2]">{card.subtitle}</div>
      </div>
      <div className="space-y-1.5 px-3 py-2.5">{card.details.map(detail => <div key={detail.label} className="flex items-start justify-between gap-3 text-[10px]"><span className="shrink-0 text-[#849ca5]">{detail.label}</span><span className="break-all text-right font-mono text-[#e5f2f2]">{detail.value}</span></div>)}</div>
      {card.note && <div className="border-t border-white/10 px-3 py-2 text-[9px] leading-4 text-[#9bb2ba]">{card.note}</div>}
    </div>, document.body);
  return { show, move, hide, tooltip };
}

type PortMembership = { kind?: string; vlan?: number; native?: number; allowed?: string; inferred: boolean; label: string };

export function cabledPeer(topology: Topology, deviceId: string, port: string): string {
  const link = topology.links.find(link =>
    (link.from === deviceId && link.fromPort === port) || (link.to === deviceId && link.toPort === port)
  );
  if (!link) return 'Not cabled';
  const peerId = link.from === deviceId ? link.to : link.from;
  const peerPort = link.from === deviceId ? link.toPort : link.fromPort;
  const peerName = topology.nodes.find(node => node.id === peerId)?.name ?? peerId;
  return `${peerName} / ${peerPort}`;
}

function peerLink(topology: Topology, deviceId: string, port: string) {
  return topology.links.find(link =>
    (link.from === deviceId && link.fromPort === port) || (link.to === deviceId && link.toPort === port)
  );
}

export function cabledPeerAddress(topology: Topology, sessions: Record<string, Session>, deviceId: string, port: string): string {
  const link = peerLink(topology, deviceId, port);
  if (!link) return 'Not cabled';
  const peerId = link.from === deviceId ? link.to : link.from;
  const peerPort = link.from === deviceId ? link.toPort : link.fromPort;
  return sessions[peerId]?.interfaces[peerPort]?.ipv4[0] || 'Unassigned';
}

export function cabledPeerMac(topology: Topology, deviceId: string, port: string): string {
  const link = peerLink(topology, deviceId, port);
  if (!link) return 'Not cabled';
  return modeledDeviceMac(link.from === deviceId ? link.to : link.from);
}

export function vlanSvi(topology: Topology, sessions: Record<string, Session>, vlan: number | undefined): string | undefined {
  if (vlan === undefined) return undefined;
  const svi = `vlan ${vlan}`;
  const node = topology.nodes.find(candidate => sessions[candidate.id]?.interfaces[svi]?.ipv4[0]);
  return node ? `${node.name} / ${svi} · ${sessions[node.id].interfaces[svi].ipv4[0]}` : 'Not configured';
}

type HoverIdentity = { portIp?: string; deviceMac?: string; cabledDeviceIp?: string; cabledDeviceMac?: string; vlanSvi?: string };

export function portHoverContent(device: string, port: string, info: PortMembership, status?: string, bundle?: string, cabledTo = 'Not cabled', identity: HoverIdentity = {}): VlanHoverContent {
  const details: VlanHoverDetail[] = [{ label: 'Cabled to', value: cabledTo }];
  details.push({ label: 'Port IP', value: identity.portIp || 'Unassigned' });
  details.push({ label: 'Device MAC', value: identity.deviceMac || 'Unavailable' });
  if (cabledTo !== 'Not cabled') {
    details.push({ label: 'Cabled device IP', value: identity.cabledDeviceIp || 'Unassigned' });
    details.push({ label: 'Cabled device MAC', value: identity.cabledDeviceMac || 'Unavailable' });
  }
  if (info.kind === 'trunk') {
    details.push({ label: 'Native VLAN', value: String(info.native) });
    details.push({ label: 'Allowed VLANs', value: info.allowed || 'all' });
  } else {
    details.push({ label: 'Membership', value: info.vlan === undefined ? 'Unknown' : `VLAN ${info.vlan}` });
    if (info.inferred) details.push({ label: 'Source', value: 'Connected access port' });
  }
  if (identity.vlanSvi !== undefined) details.push({ label: 'VLAN SVI', value: identity.vlanSvi });
  if (status) details.push({ label: 'Port state', value: status });
  if (bundle) details.push({ label: 'EtherChannel', value: bundle });
  return { title: `${device} / ${port}`, subtitle: info.kind === 'trunk' ? '802.1Q trunk' : info.inferred ? 'Inferred endpoint' : info.kind === 'access' ? 'Access port' : info.kind === 'interface' ? 'VLAN interface' : 'Unassigned port', details, note: 'VLAN membership does not prove forwarding.' };
}
