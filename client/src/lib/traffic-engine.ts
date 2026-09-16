import type { TrafficPacket } from "@/lib/network-topology";

export type TrafficProtocol = NonNullable<TrafficPacket["protocol"]>;
export type FlowState = "generated" | "established" | "delivered" | "denied";

export type SimulatedTls = {
  serverName: string;
  certificateTrusted: boolean;
  decryptable: boolean;
  inspected: boolean;
};

export type SimulatedFlow = {
  id: string;
  protocol: TrafficProtocol;
  source: string;
  destination: string;
  sourceIp: string;
  destinationIp: string;
  sourcePort?: number;
  destinationPort?: number;
  vlan?: number;
  state: FlowState;
  tls?: SimulatedTls;
  nat?: { translatedSourceIp?: string; translatedSourcePort?: number };
  stages: string[];
};

export type TrafficPolicy = {
  allowedProtocols?: TrafficProtocol[];
  deniedProtocols?: TrafficProtocol[];
  inspectTls?: boolean;
  trustedCertificateAuthorities?: string[];
  denyUntrustedTls?: boolean;
};

export type TrafficDecision = {
  allowed: boolean;
  reason: string;
  flow: SimulatedFlow;
};

const DEFAULT_PORTS: Partial<Record<TrafficProtocol, number>> = {
  dns: 53,
  http: 80,
  https: 443,
  vpn: 500,
};

function makeId(prefix: string): string {
  return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

export function createSimulatedFlow(input: Omit<SimulatedFlow, "id" | "state" | "stages"> & { id?: string }): SimulatedFlow {
  const destinationPort = input.destinationPort ?? DEFAULT_PORTS[input.protocol];
  const tls = input.protocol === "https" && input.tls
    ? { ...input.tls, inspected: input.tls.inspected ?? false }
    : input.tls;
  return {
    ...input,
    id: input.id ?? makeId("flow"),
    destinationPort,
    state: "generated",
    tls,
    stages: ["generated"],
  };
}

export function inspectTls(flow: SimulatedFlow, certificateAuthorityTrusted: boolean): SimulatedFlow {
  if (flow.protocol !== "https" || !flow.tls) return flow;
  return {
    ...flow,
    tls: {
      ...flow.tls,
      certificateTrusted: flow.tls.certificateTrusted && certificateAuthorityTrusted,
      inspected: true,
    },
    stages: flow.stages.concat("tls-terminated", "inspected", "tls-re-encrypted"),
  };
}

export function evaluateTraffic(flow: SimulatedFlow, policy: TrafficPolicy = {}): TrafficDecision {
  if (policy.deniedProtocols?.includes(flow.protocol)) {
    return { allowed: false, reason: "Protocol denied by policy.", flow: { ...flow, state: "denied", stages: flow.stages.concat("denied") } };
  }
  if (policy.allowedProtocols && !policy.allowedProtocols.includes(flow.protocol)) {
    return { allowed: false, reason: "Protocol is not present in the allow policy.", flow: { ...flow, state: "denied", stages: flow.stages.concat("denied") } };
  }
  if (flow.protocol === "https" && flow.tls && policy.denyUntrustedTls && !flow.tls.certificateTrusted) {
    return { allowed: false, reason: "TLS certificate is not trusted by the simulated inspection policy.", flow: { ...flow, state: "denied", stages: flow.stages.concat("certificate-failed", "denied") } };
  }
  const inspected = policy.inspectTls ? inspectTls(flow, true) : flow;
  return { allowed: true, reason: "Flow allowed by the simulated policy.", flow: { ...inspected, state: "delivered", stages: inspected.stages.concat("delivered") } };
}

export function flowToPackets(flow: SimulatedFlow, path: string[], color: string, count = 1): TrafficPacket[] {
  const replyPath = path.slice().reverse();
  const packets: TrafficPacket[] = [];
  for (let index = 0; index < count; index += 1) {
    const sequence = index + 1;
    const delay = index * 0.22;
    packets.push({
      id: flow.id + "-request-" + sequence,
      flowId: flow.id,
      source: flow.source,
      destination: flow.destination,
      path,
      color,
      sequence,
      direction: "request",
      startDelay: delay,
      protocol: flow.protocol,
      sourcePort: flow.sourcePort,
      destinationPort: flow.destinationPort,
      vlan: flow.vlan,
      stage: flow.stages.includes("inspected") ? "inspected" : "forwarded",
      tls: flow.tls,
    });
    packets.push({
      id: flow.id + "-reply-" + sequence,
      flowId: flow.id,
      source: flow.destination,
      destination: flow.source,
      path: replyPath,
      color: "#f5b74b",
      sequence,
      direction: "reply",
      startDelay: delay + path.length * 1.55,
      protocol: flow.protocol,
      sourcePort: flow.destinationPort,
      destinationPort: flow.sourcePort,
      vlan: flow.vlan,
      stage: flow.state === "delivered" ? "delivered" : "forwarded",
      tls: flow.tls,
    });
  }
  return packets;
}

export function trafficSummary(flow: SimulatedFlow): string {
  const port = flow.destinationPort ? ":" + flow.destinationPort : "";
  return flow.protocol.toUpperCase() + " " + flow.sourceIp + " -> " + flow.destinationIp + port + " [" + flow.state + "]";
}
