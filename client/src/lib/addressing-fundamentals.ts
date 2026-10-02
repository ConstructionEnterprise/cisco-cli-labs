export type AnswerField = { label: string; answer: string; format?: 'text' | 'number' | 'binary' | 'ipv6'; alternatives?: string[]; choices?: { label: string; explanation: string }[] };
export type FundamentalsExercise = { section: string; explanation: string; worked: string[]; fields: AnswerField[]; takeaway: string; source?: string };

export function ipv4Number(address: string): number {
  const parts = address.split('.');
  if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part) || Number(part) > 255)) throw new Error('Use four decimal octets from 0 to 255.');
  return parts.reduce((value, part) => value * 256 + Number(part), 0);
}
export function dotted(value: number): string {
  return [24, 16, 8, 0].map(shift => Math.floor(value / 2 ** shift) % 256).join('.');
}
export function subnetFacts(address: string, prefix: number) {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) throw new Error('IPv4 prefixes range from /0 through /32.');
  const total = 2 ** (32 - prefix);
  const network = Math.floor(ipv4Number(address) / total) * total;
  return { prefix, hostBits: 32 - prefix, total, mask: dotted(2 ** 32 - total), wildcard: dotted(total - 1), network: dotted(network), last: dotted(network + total - 1) };
}

export function expandedIpv6(raw: string): string | null {
  const input = raw.trim().toLowerCase();
  if (!/^[0-9a-f:]+$/.test(input) || input.split('::').length > 2) return null;
  const compressed = input.includes('::');
  const halves = input.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  if ([...left, ...right].some(group => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  const missing = 8 - left.length - right.length;
  if (compressed ? missing < 1 : missing !== 0) return null;
  return [...left, ...Array(compressed ? missing : 0).fill('0'), ...right].map(group => group.padStart(4, '0')).join(':');
}
export function answerMatches(field: AnswerField, raw: string): boolean {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!raw.trim()) return false;
  if (field.format === 'ipv6') return expandedIpv6(raw) !== null && expandedIpv6(raw) === expandedIpv6(field.answer);
  if (field.format === 'binary') return /^[01\s]+$/.test(raw) && raw.replace(/\s/g, '') === field.answer.replace(/\s/g, '');
  if (field.format === 'number') return /^\d[\d,]*$/.test(raw.trim()) && Number(raw.replace(/,/g, '')) === Number(field.answer);
  return [field.answer, ...(field.alternatives || [])].some(answer => normalize(raw) === normalize(answer));
}
