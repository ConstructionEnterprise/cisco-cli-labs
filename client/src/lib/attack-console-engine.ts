import type { Session, SyntheticContainerRuntime } from './ios-engine';
import { simulatedTargetById } from './simulated-target-range';

const systemOid = '1.3.6.1.2.1.1';
const sysContactOid = `${systemOid}.4.0`;

export function isAttackCommand(command: string): boolean {
  return /^(?:nmap (?:-sv --version-light|-pn -p [0-9,]+) [a-z0-9-]+|snmpwalk -v2c -c trainingro [a-z0-9-]+ 1\.3\.6\.1\.2\.1\.1|snmpset -v2c -c trainingrw [a-z0-9-]+ 1\.3\.6\.1\.2\.1\.1\.4\.0 s range-owner|msfconsole|search type:auxiliary name:http_version|info auxiliary\/scanner\/http\/http_version|use auxiliary\/scanner\/http\/http_version|set rhosts [a-z0-9-]+|run|python3 training\/scripts\/range_inventory\.py [a-z0-9-]+|openssl s_client -connect container-api-1:8443|curl -ss(?: -h "authorization: bearer training-token")? https:\/\/container-api-1:8443\/api\/status|for i in \{1\.\.100\}; do curl -ss -h "authorization: bearer training-token" https:\/\/container-api-1:8443\/api\/status; done|ss -tnlp|cat \/proc\/self\/status|journalctl -u container-api-1 --no-pager)$/.test(command);
}

function targetAddress(address: string) {
  return address.split(':')[0];
}

function isPortFiltered(targetId: string, port: string, sessions: Record<string, Session>) {
  const target = simulatedTargetById[targetId];
  if (!target) return false;
  const address = targetAddress(target.address);
  return Object.values(sessions).some((session) => {
    const config = session.runningConfig || [];
    return config.some((line) => line === `deny tcp any host ${address} eq ${port}`)
      && config.some((line) => /^ip access-group .+ in$/.test(line));
  });
}

function containerMetadata(target: (typeof simulatedTargetById)[string]) {
  return target.container ? [
    `Container image: ${target.container.image}`,
    `Container network: ${target.container.network} | Ports: ${target.container.publishedPorts.join(', ')}`,
    `Container health: ${target.container.health} | Restart: ${target.container.restartPolicy}`,
    `Container volumes: ${target.container.volumePolicy}`,
  ] : [];
}

function containerState(session: Session, targetId: string): SyntheticContainerRuntime | undefined {
  const target = simulatedTargetById[targetId];
  const model = target?.container?.behavior;
  if (!target || !model) return undefined;
  session.attackTerminal!.containerRuntime ||= {};
  const existing = session.attackTerminal!.containerRuntime[targetId];
  if (existing) return existing;
  const runtime: SyntheticContainerRuntime = {
    health: model.health,
    ingress: { ...model.ingress, tokenValid: true, currentTokens: model.ingress.burst },
    kernel: {
      version: model.kernel.version,
      namespaces: { pid: true, net: true, mnt: true, uts: true, ipc: true, user: true, cgroup: true },
      cgroups: { memoryLimitMb: model.kernel.memoryLimitMb, cpuLimitCores: model.kernel.cpuLimitCores, pidsLimit: model.kernel.pidsLimit, memoryMb: 64, cpuPercent: 2, pidsCount: 8 },
      seccompProfile: model.kernel.seccompProfile,
      droppedCapabilities: [...model.kernel.droppedCapabilities], retainedCapabilities: [...model.kernel.retainedCapabilities], recentSyscalls: [],
    },
    socket: { protocol: model.socket.protocol, state: 'LISTEN', localIp: targetAddress(target.address), port: model.socket.port, interface: model.socket.interface, backlogMax: model.socket.backlogMax, backlogCurrent: 0, sendBufferBytes: model.socket.sendBufferBytes, receiveBufferBytes: model.socket.receiveBufferBytes, tcpNoDelay: model.socket.tcpNoDelay, keepAlive: model.socket.keepAlive, reuseAddress: model.socket.reuseAddress, events: [] },
    logs: model.initialLogs.map((entry, index) => ({ tick: index, source: target.name, ...entry })),
  };
  session.attackTerminal!.containerRuntime[targetId] = runtime;
  return runtime;
}

function logContainer(runtime: SyntheticContainerRuntime, source: string, message: string, level: 'info' | 'warn' | 'error' = 'info', socket?: Omit<SyntheticContainerRuntime['socket']['events'][number], 'tick'>) {
  const tick = runtime.logs.length + runtime.socket.events.length + 1;
  runtime.logs.push({ tick, source, message, level });
  runtime.kernel.recentSyscalls.push({ tick, name: 'accept4', result: 'allowed' });
  runtime.kernel.recentSyscalls = runtime.kernel.recentSyscalls.slice(-12);
  runtime.kernel.cgroups.cpuPercent = Math.min(100, runtime.kernel.cgroups.cpuPercent + 1);
  runtime.kernel.cgroups.memoryMb = Math.min(runtime.kernel.cgroups.memoryLimitMb, runtime.kernel.cgroups.memoryMb + 1);
  if (socket) runtime.socket.events.push({ ...socket, tick });
}

function syncIngressFromIos(runtime: SyntheticContainerRuntime, targetId: string, sessions: Record<string, Session>) {
  const config = Object.values(sessions).flatMap((session) => session.runningConfig || []);
  const target = simulatedTargetById[targetId];
  if (!target?.container) return;
  runtime.ingress.tlsEnabled = config.includes('ip http secure-server') || runtime.ingress.tlsEnabled;
  runtime.ingress.tokenRequired = config.includes('ip http authentication token-required') || runtime.ingress.tokenRequired;
  const rate = config.find((line) => /^ip http rate-limit \d+$/.test(line));
  if (rate) {
    runtime.ingress.rateLimitRps = Number(rate.split(' ').at(-1));
    runtime.ingress.currentTokens = Math.min(runtime.ingress.currentTokens, runtime.ingress.rateLimitRps);
  }
}

export function executeAttackCommand(session: Session, command: string, iosSessions: Record<string, Session>) {
  if (session.terminalKind !== 'attack' || session.mode !== 'shell' || !isAttackCommand(command)) {
    return { accepted: false, session, output: ['bash: command not found'] };
  }

  const next: Session = {
    ...session,
    attackTerminal: {
      selectedModule: session.attackTerminal?.selectedModule,
      rhosts: session.attackTerminal?.rhosts,
      executionLog: [...(session.attackTerminal?.executionLog || [])],
      snmpValues: { ...(session.attackTerminal?.snmpValues || {}) },
      containerRuntime: Object.fromEntries(Object.entries(session.attackTerminal?.containerRuntime || {}).map(([id, runtime]) => [id, { ...runtime, ingress: { ...runtime.ingress }, kernel: { ...runtime.kernel, namespaces: { ...runtime.kernel.namespaces }, cgroups: { ...runtime.kernel.cgroups }, droppedCapabilities: [...runtime.kernel.droppedCapabilities], retainedCapabilities: [...runtime.kernel.retainedCapabilities], recentSyscalls: [...runtime.kernel.recentSyscalls] }, socket: { ...runtime.socket, events: [...runtime.socket.events] }, logs: [...runtime.logs] }])),
    },
  };

  if (command === 'msfconsole') return { accepted: true, session: next, output: [
    'Metasploit Framework 6 (synthetic training range)',
    'msf6 >',
    'Only an in-app, read-only auxiliary catalog is modeled for this authorized lab.',
  ] };
  if (command === 'search type:auxiliary name:http_version') return { accepted: true, session: next, output: [
    'Matching Modules',
    'auxiliary/scanner/http/http_version  | synthetic range metadata scanner',
  ] };
  if (command === 'info auxiliary/scanner/http/http_version') return { accepted: true, session: next, output: [
    'Name: HTTP Version Detection',
    'Purpose: collect modeled HTTP service-banner metadata from an authorized synthetic asset.',
  ] };
  if (command === 'use auxiliary/scanner/http/http_version') {
    next.attackTerminal!.selectedModule = 'auxiliary/scanner/http/http_version';
    return { accepted: true, session: next, output: ['msf6 auxiliary(scanner/http/http_version) >'] };
  }
  const rhosts = command.match(/^set rhosts ([a-z0-9-]+)$/);
  if (rhosts) {
    if (!simulatedTargetById[rhosts[1]]) return { accepted: true, session: next, output: ['RHOSTS is not a synthetic range asset.'] };
    next.attackTerminal!.rhosts = rhosts[1];
    return { accepted: true, session: next, output: [`RHOSTS => ${rhosts[1]}`] };
  }
  if (command === 'run') {
    const targetId = next.attackTerminal!.rhosts;
    const target = targetId ? simulatedTargetById[targetId] : undefined;
    if (!next.attackTerminal!.selectedModule || !target) return { accepted: true, session: next, output: ['[-] Select a module and set RHOSTS before run.'] };
    next.attackTerminal!.executionLog.push(`Read-only ${next.attackTerminal!.selectedModule} against ${target.id}`);
    return { accepted: true, session: next, output: [
      `[*] Running ${next.attackTerminal!.selectedModule} against ${target.name} (${targetAddress(target.address)})`,
      `[*] Synthetic result: ${target.purpose}`,
      '[*] Range result recorded. No external process, payload, or network connection exists.',
    ] };
  }

  if (command === 'ss -tnlp' || command === 'cat /proc/self/status' || command === 'journalctl -u container-api-1 --no-pager') {
    const runtime = containerState(next, 'container-api-1');
    if (!runtime) return { accepted: true, session: next, output: ['No synthetic container runtime is available.'] };
    if (command === 'ss -tnlp') return { accepted: true, session: next, output: [
      'State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process',
      `${runtime.socket.state.padEnd(6)} ${String(runtime.socket.backlogCurrent).padEnd(6)} ${String(runtime.socket.backlogMax).padEnd(6)} ${`${runtime.socket.localIp}:${runtime.socket.port}`.padEnd(19)} 0.0.0.0:* users:(("order-status-api",pid=synthetic,fd=7))`,
      `Synthetic socket events: ${runtime.socket.events.length} | active backlog: ${runtime.socket.backlogCurrent}/${runtime.socket.backlogMax}`,
    ] };
    if (command === 'cat /proc/self/status') return { accepted: true, session: next, output: [
      'Name:\torder-status-api', `State:\t${runtime.health === 'unavailable' ? 'D (unavailable)' : 'S (synthetic sleep)'}`,
      `Pid:\t${runtime.kernel.cgroups.pidsCount}`, `VmRSS:\t${runtime.kernel.cgroups.memoryMb * 1024} kB`,
      `Seccomp:\t${runtime.kernel.seccompProfile}`, `CapEff:\t${runtime.kernel.retainedCapabilities.join(', ') || 'none'}`,
      `Namespaces:\t${Object.entries(runtime.kernel.namespaces).filter(([, enabled]) => enabled).map(([name]) => name).join(', ')}`,
    ] };
    return { accepted: true, session: next, output: runtime.logs.slice(-12).map((entry) => `${String(entry.tick).padStart(4, '0')} ${entry.level.toUpperCase()} ${entry.source}: ${entry.message}`) };
  }

  if (command === 'openssl s_client -connect container-api-1:8443' || command.startsWith('curl ') || command.startsWith('for i in {1..100}')) {
    const target = simulatedTargetById['container-api-1'];
    const runtime = containerState(next, target.id)!;
    syncIngressFromIos(runtime, target.id, iosSessions);
    const requests = command.startsWith('for ') ? 100 : 1;
    const hasToken = command.includes('authorization: bearer training-token');
    const filtered = isPortFiltered(target.id, '8443', iosSessions);
    if (command.startsWith('openssl')) {
      if (filtered) { logContainer(runtime, session.hostname, 'TLS handshake denied by ingress ACL', 'warn', { type: 'refused', remoteIp: '10.76.10.20', remotePort: 49872, reason: 'acl-deny' }); return { accepted: true, session: next, output: ['CONNECTED(00000003)', 'connect: Connection timed out'] }; }
      if (!runtime.ingress.tlsEnabled || !runtime.ingress.tlsCertValid) { logContainer(runtime, session.hostname, 'TLS handshake failed: listener or certificate invalid', 'warn', { type: 'refused', remoteIp: '10.76.10.20', remotePort: 49872, reason: 'tls-fail' }); return { accepted: true, session: next, output: ['CONNECTED(00000003)', 'SSL alert: handshake failure'] }; }
      logContainer(runtime, session.hostname, 'TLS handshake completed', 'info', { type: 'accept', remoteIp: '10.76.10.20', remotePort: 49872 });
      return { accepted: true, session: next, output: ['CONNECTED(00000003)', 'Protocol  : TLSv1.3', 'Verify return code: 0 (ok)'] };
    }
    if (filtered) { logContainer(runtime, session.hostname, 'HTTP request denied by ingress ACL', 'warn', { type: 'refused', remoteIp: '10.76.10.20', remotePort: 49873, reason: 'acl-deny' }); return { accepted: true, session: next, output: ['curl: (28) Connection timed out'] }; }
    if (runtime.health !== 'healthy') { logContainer(runtime, session.hostname, 'HTTP request refused: service health degraded', 'warn', { type: 'refused', remoteIp: '10.76.10.20', remotePort: 49873, reason: 'health' }); return { accepted: true, session: next, output: ['HTTP/1.1 503 Service Unavailable'] };
    }
    let accepted = 0;
    let throttled = 0;
    for (let index = 0; index < requests; index += 1) {
      if (runtime.ingress.currentTokens < 1) { throttled += 1; continue; }
      runtime.ingress.currentTokens -= 1;
      accepted += 1;
    }
    if (throttled) logContainer(runtime, session.hostname, `rate limit throttled ${throttled} synthetic request(s)`, 'warn', { type: 'throttled', remoteIp: '10.76.10.20', remotePort: 49873, reason: 'token-bucket-empty' });
    if (runtime.ingress.tokenRequired && !hasToken) { logContainer(runtime, session.hostname, 'Bearer token rejected', 'warn', { type: 'close', remoteIp: '10.76.10.20', remotePort: 49873, reason: 'unauthorized' }); return { accepted: true, session: next, output: ['HTTP/1.1 401 Unauthorized'] }; }
    if (accepted) logContainer(runtime, session.hostname, `HTTP status request accepted (${accepted} synthetic request(s))`, 'info', { type: 'accept', remoteIp: '10.76.10.20', remotePort: 49873 });
    return { accepted: true, session: next, output: throttled ? [`HTTP/1.1 200 OK x${accepted}`, `HTTP/1.1 429 Too Many Requests x${throttled}`] : ['HTTP/1.1 200 OK', '{"service":"order-status-api","state":"healthy"}'] };
  }

  const nmap = command.match(/^nmap (?:-sv --version-light|-pn -p ([0-9,]+)) ([a-z0-9-]+)$/);
  const snmp = command.match(new RegExp(`^snmpwalk -v2c -c trainingro ([a-z0-9-]+) ${systemOid.replaceAll('.', '\\.')}$`));
  const snmpSet = command.match(new RegExp(`^snmpset -v2c -c trainingrw ([a-z0-9-]+) ${sysContactOid.replaceAll('.', '\\.')} s range-owner$`));
  const script = command.match(/^python3 training\/scripts\/range_inventory\.py ([a-z0-9-]+)$/);
  const targetId = nmap?.[2] || snmp?.[1] || snmpSet?.[1] || script?.[1];
  const target = targetId ? simulatedTargetById[targetId] : undefined;
  if (!target) return { accepted: true, session: next, output: ['Target is not present in the synthetic range.'] };

  if (nmap) {
    const ports = nmap[1]?.split(',')
      ?? target.services?.filter((service) => service.protocol === 'tcp').map((service) => String(service.port))
      ?? [target.container?.publishedPorts[0]?.split('/')[0] ?? '443'];
    const runtime = containerState(next, target.id);
    if (runtime) syncIngressFromIos(runtime, target.id, iosSessions);
    const filtered = ports.every((port) => isPortFiltered(target.id, port, iosSessions));
    if (runtime) logContainer(runtime, session.hostname, filtered ? `TCP probe filtered on port ${ports.join(',')}` : `TCP probe observed on port ${ports.join(',')}`, filtered ? 'warn' : 'info', { type: filtered ? 'refused' : 'syn-received', remoteIp: '10.76.10.20', remotePort: 49871, reason: filtered ? 'acl-deny' : undefined });
    return { accepted: true, session: next, output: [
      'Starting Nmap 7.95 ( https://nmap.org ) at synthetic-range',
      `Nmap scan report for ${target.name} (${targetAddress(target.address)})`,
      'Host is up (0.0012s latency).',
      nmap[1] ? 'PORT      STATE     SERVICE' : 'PORT      STATE     SERVICE       VERSION',
      ...ports.map((port) => {
        const service = target.services?.find((item) => item.protocol === 'tcp' && item.port === Number(port));
        const name = service?.name ?? (port === '8443' ? 'https-alt' : port === '22' ? 'ssh' : 'unknown');
        const product = service?.product ? ` ${service.product}` : '';
        return `${`${port}/tcp`.padEnd(10)}${(filtered ? 'filtered' : 'open').padEnd(10)}${name.padEnd(14)}${nmap[1] ? '' : product}`.trimEnd();
      }),
      ...containerMetadata(target),
      filtered ? 'Synthetic ACL telemetry: the modeled IOS ingress policy filters this port.' : 'Synthetic range telemetry: service is reachable through the current modeled policy.',
    ] };
  }
  if (snmp) return { accepted: true, session: next, output: [
    `SNMPv2-MIB::sysName.0 = STRING: ${target.name}`,
    `SNMPv2-MIB::sysLocation.0 = STRING: ${target.zone}`,
    `SNMPv2-MIB::sysDescr.0 = STRING: ${target.purpose}`,
    `SNMPv2-MIB::sysContact.0 = STRING: ${next.attackTerminal!.snmpValues[`${target.id}:${sysContactOid}`] || 'not configured'}`,
  ] };
  if (snmpSet) {
    next.attackTerminal!.snmpValues[`${target.id}:${sysContactOid}`] = 'range-owner';
    return { accepted: true, session: next, output: [`SNMPv2-MIB::sysContact.0 = STRING: range-owner`, `Synthetic target ${target.name} management state updated for this lab session.`] };
  }
  return { accepted: true, session: next, output: [
    `asset=${target.name}`,
    `address=${target.address}`,
    `vlan=${target.vlan}`,
    `zone=${target.zone}`,
    `condition=${target.modeledCondition}`,
    ...containerMetadata(target),
  ] };
}
