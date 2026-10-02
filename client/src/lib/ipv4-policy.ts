import type { Session } from './ios-engine';

export type AclEntry = { acl: string; type: string; action: string; match: string };
export function aclEntries(session: Session): AclEntry[] {
  const entries: AclEntry[] = [];
  let named: { acl: string; type: string } | undefined;
  for (const raw of session.runningConfig) {
    const line = raw.trim().toLowerCase();
    const header = line.match(/^ip access-list (standard|extended) (\S+)$/);
    if (header) { named = { acl: header[2], type: header[1] }; continue; }
    const numbered = line.match(/^access-list (\S+) (?:(extended) )?(permit|deny|remark) (.+)$/);
    if (numbered) {
      const id = Number(numbered[1]);
      entries.push({ acl: numbered[1], type: numbered[2] || (id >= 100 && id <= 199 || id >= 2000 && id <= 2699 ? 'extended' : 'standard'), action: numbered[3], match: numbered[4] });
      named = undefined;
      continue;
    }
    const rule = line.match(/^(?:\d+ )?(permit|deny|remark) (.+)$/);
    if (named && rule) entries.push({ ...named, action: rule[1], match: rule[2] });
    else named = undefined;
  }
  return entries;
}

function number(ip: string): number | undefined {
  const parts = ip.split('.').map(Number);
  return parts.length === 4 && parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255)
    ? parts.reduce((total, part) => total * 256 + part, 0) >>> 0 : undefined;
}

function address(tokens: string[], ip: string): boolean | undefined {
  const token = tokens.shift();
  if (token === 'any') return true;
  if (token === 'host') { const host = tokens.shift(); return host && number(host) !== undefined ? host === ip : undefined; }
  const network = token ? number(token) : undefined, value = number(ip);
  if (network === undefined || value === undefined) return undefined;
  const wildcard = tokens[0] ? number(tokens[0]) : undefined;
  if (wildcard === undefined) return network === value;
  tokens.shift();
  return (network & ~wildcard) === (value & ~wildcard);
}

// Ping diagnostics evaluate only the IP/ICMP subset; uncertain rules stop the probe.
export function evaluateInterfaceAcl(session: Session, port: string, direction: 'in' | 'out', source: string, destination: string) {
  const binding = [...(session.interfaces[port]?.commands || [])].reverse().map(command => command.toLowerCase().match(/^ip access-group (\S+) (in|out)$/)).find(match => match?.[2] === direction);
  if (!binding) return { allowed: true, reason: 'No interface ACL bound' };
  const acl = binding[1];
  for (const entry of aclEntries(session).filter(entry => entry.acl === acl)) {
    if (entry.action === 'remark') continue;
    const tokens = entry.match.split(/\s+/);
    const protocol = entry.type === 'extended' ? tokens.shift() : 'ip';
    if (['tcp', 'udp'].includes(protocol || '')) continue;
    if (!['ip', 'icmp'].includes(protocol || '')) return { allowed: false, reason: `ACL ${acl}: unsupported protocol ${protocol}; reachability unverified` };
    const sourceMatch = address(tokens, source);
    const destinationMatch = entry.type === 'extended' ? address(tokens, destination) : true;
    if (sourceMatch === false || destinationMatch === false) continue;
    if (sourceMatch === undefined || destinationMatch === undefined || tokens.some(token => !['log', 'log-input'].includes(token))) return { allowed: false, reason: `ACL ${acl}: unsupported match; reachability unverified` };
    return { allowed: entry.action === 'permit', reason: `ACL ${acl}: ${entry.action} ${entry.match}` };
  }
  return { allowed: false, reason: `ACL ${acl}: implicit deny` };
}
