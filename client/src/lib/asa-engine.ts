import type { Session } from "@/lib/ios-engine";
import type { SimulatedFlow } from "@/lib/traffic-engine";

export type AsaTrafficDecision = {
  allowed: boolean;
  reason: string;
  flow: SimulatedFlow;
  ingressZone?: string;
  egressZone?: string;
  translatedSourceIp?: string;
};

type Zone = { name: string; securityLevel: number; interfaceName: string; ipv4?: string };
type AclRule = { acl: string; action: "permit" | "deny"; protocol: string; source: string; destination: string; destinationPort?: number };

function ipFromInterface(address?: string): string | undefined {
  return address?.trim().split(/\s+/)[0];
}

function zones(session: Session): Zone[] {
  return Object.entries(session.interfaces)
    .filter(([, state]) => state.nameif && typeof state.securityLevel === "number")
    .map(([interfaceName, state]) => ({ name: state.nameif as string, securityLevel: state.securityLevel as number, interfaceName, ipv4: ipFromInterface(state.ipv4[0]) }));
}

function ipMatches(token: string, ip: string): boolean {
  if (token === "any") return true;
  if (token === "host") return false;
  return token === ip;
}

function parseAclRules(session: Session): AclRule[] {
  return session.runningConfig.flatMap((line) => {
    const match = line.match(/^access-list (\S+) extended (permit|deny) (\S+) (.+)$/i);
    if (!match) return [];
    const parts = match[4].trim().split(/\s+/);
    const source = parts.shift() || "any";
    const normalizedSource = source.toLowerCase() === "host" ? (parts.shift() || "any") : source;
    const destinationToken = parts.shift() || "any";
    const destination = destinationToken.toLowerCase() === "host" ? (parts.shift() || "any") : destinationToken;
    const eqIndex = parts.findIndex((part) => part.toLowerCase() === "eq");
    const destinationPort = eqIndex >= 0 ? Number(parts[eqIndex + 1]) : undefined;
    return [{ acl: match[1], action: match[2].toLowerCase() as "permit" | "deny", protocol: match[3].toLowerCase(), source: normalizedSource, destination, destinationPort }];
  });
}

function protocolMatches(rule: string, flow: SimulatedFlow): boolean {
  if (rule === "ip") return true;
  if (rule === "tcp") return flow.protocol === "tcp" || flow.protocol === "http" || flow.protocol === "https";
  if (rule === "udp") return flow.protocol === "udp" || flow.protocol === "dns";
  return rule === flow.protocol;
}

function aclAllows(session: Session, zone: string, flow: SimulatedFlow): { allowed: boolean; acl?: string } {
  const binding = session.runningConfig.find((line) => new RegExp(`^access-group\\s+(\\S+)\\s+in\\s+interface\\s+${zone}\\s*$`, "i").test(line));
  if (!binding) return { allowed: true };
  const acl = binding.match(/^access-group\s+(\S+)/i)?.[1];
  const rules = parseAclRules(session).filter((rule) => rule.acl.toLowerCase() === acl?.toLowerCase());
  const rule = rules.find((candidate) => protocolMatches(candidate.protocol, flow)
    && ipMatches(candidate.source.toLowerCase(), flow.sourceIp)
    && ipMatches(candidate.destination.toLowerCase(), flow.destinationIp)
    && (!candidate.destinationPort || candidate.destinationPort === flow.destinationPort));
  return { allowed: rule?.action === "permit", acl };
}

function outsideAddress(session: Session): string | undefined {
  const outside = zones(session).find((zone) => zone.name.toLowerCase() === "outside");
  return outside?.ipv4;
}

export function evaluateAsaTraffic(session: Session, flow: SimulatedFlow, ingressZoneName: string, egressZoneName: string): AsaTrafficDecision {
  const availableZones = zones(session);
  const ingress = availableZones.find((zone) => zone.name.toLowerCase() === ingressZoneName.toLowerCase());
  const egress = availableZones.find((zone) => zone.name.toLowerCase() === egressZoneName.toLowerCase());
  if (!ingress || !egress) {
    return { allowed: false, reason: "ASA zone interfaces are not fully configured.", flow: { ...flow, state: "denied", stages: flow.stages.concat("asa-zone-missing") }, ingressZone: ingressZoneName, egressZone: egressZoneName };
  }

  const acl = aclAllows(session, ingress.name, flow);
  if (!acl.allowed) {
    return { allowed: false, reason: `ASA ACL ${acl.acl || "implicit"} denied the flow.`, flow: { ...flow, state: "denied", stages: flow.stages.concat("asa-acl-denied") }, ingressZone: ingress.name, egressZone: egress.name };
  }
  if (ingress.securityLevel < egress.securityLevel) {
    return { allowed: false, reason: "ASA security levels deny lower-to-higher traffic without an ACL permit.", flow: { ...flow, state: "denied", stages: flow.stages.concat("asa-security-level-denied") }, ingressZone: ingress.name, egressZone: egress.name };
  }

  const hasPat = session.runningConfig.some((line) => /^nat \(inside,outside\) dynamic interface$/i.test(line));
  const translatedSourceIp = ingress.name.toLowerCase() === "inside" && egress.name.toLowerCase() === "outside" && hasPat ? outsideAddress(session) : undefined;
  const translated = translatedSourceIp ? { ...flow, nat: { ...flow.nat, translatedSourceIp }, stages: flow.stages.concat("asa-pat-translated") } : flow;
  return {
    allowed: true,
    reason: translatedSourceIp ? "ASA security levels permitted the flow and object PAT translated the source." : "ASA security levels and ACL policy permitted the flow.",
    flow: { ...translated, state: "delivered", stages: translated.stages.concat("asa-permitted") },
    ingressZone: ingress.name,
    egressZone: egress.name,
    translatedSourceIp,
  };
}
