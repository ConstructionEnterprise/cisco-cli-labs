export type SimulatedAsset = {
  id: string;
  name: string;
  kind: "Website" | "PC" | "Server" | "IoT" | "Container";
  address: string;
  vlan: number;
  zone: string;
  purpose: string;
  modeledCondition: string;
  permittedWork: string;
  attackLens?: string;
  services?: Array<{ port: number; protocol: "tcp" | "udp"; name: string; product: string }>;
  container?: {
    image: string;
    runtime: "Docker (simulated)";
    network: string;
    publishedPorts: string[];
    environmentClassification: string;
    health: "healthy" | "degraded" | "isolated";
    restartPolicy: string;
    volumePolicy: string;
    logSummary: string;
    simulatedFindings: string[];
    behavior: {
      ingress: { tlsEnabled: boolean; tlsCertValid: boolean; tokenRequired: boolean; rateLimitRps: number; burst: number };
      health: "healthy" | "degraded" | "unavailable";
      kernel: { version: string; memoryLimitMb: number; cpuLimitCores: number; pidsLimit: number; seccompProfile: "docker-default" | "custom"; droppedCapabilities: string[]; retainedCapabilities: string[] };
      socket: { protocol: "tcp"; port: number; interface: string; backlogMax: number; sendBufferBytes: number; receiveBufferBytes: number; tcpNoDelay: boolean; keepAlive: boolean; reuseAddress: boolean };
      initialLogs: Array<{ level: "info" | "warn" | "error"; message: string }>;
    };
  };
};

// These are fictional, in-app curriculum assets. They are never live hosts or websites.
export const simulatedTargetRange: SimulatedAsset[] = [
  { id: "portal", name: "training-portal.example", kind: "Website", address: "10.76.20.80:443", vlan: 20, zone: "Application DMZ", purpose: "Fictional employee self-service portal", modeledCondition: "TLS boundary and access-policy review", permittedWork: "Inspect modeled service metadata, policy evidence, and report findings.", services: [{ port: 443, protocol: "tcp", name: "https", product: "Training Portal TLS" }] },
  { id: "api", name: "training-api.example", kind: "Website", address: "10.76.20.81:443", vlan: 20, zone: "Application DMZ", purpose: "Fictional REST training API", modeledCondition: "Authorization-boundary review", permittedWork: "Review the simulated API inventory and document scope; no requests or payloads.", services: [{ port: 443, protocol: "tcp", name: "https", product: "Training API gateway" }] },
  { id: "assess-pc", name: "ASSESS-PC1", kind: "PC", address: "10.76.10.20", vlan: 10, zone: "Assessment VLAN", purpose: "Authorized in-app assessment workstation", modeledCondition: "Scoped evidence collection source", permittedWork: "Use IOS-style show commands and approved reachability checks only." },
  { id: "staff-pc", name: "STAFF-PC1", kind: "PC", address: "10.76.10.30", vlan: 10, zone: "Employee VLAN", purpose: "Fictional standard user workstation", modeledCondition: "Endpoint and segmentation evidence", permittedWork: "Inspect modeled port, VLAN, MAC, and routing evidence only." },
  { id: "admin-pc", name: "ADMIN-PC1", kind: "PC", address: "10.76.99.20", vlan: 99, zone: "Management VLAN", purpose: "Fictional administrator workstation", modeledCondition: "Remote-access policy review", permittedWork: "Review modeled SSH and VTY configuration; never attempt authentication." },
  { id: "web-1", name: "WEB-01", kind: "Server", address: "10.76.20.80", vlan: 20, zone: "Application DMZ", purpose: "Fictional HTTPS application host", modeledCondition: "Service exposure and TLS evidence", permittedWork: "Validate modeled listener and ACL state, then stop at proof of control.", services: [{ port: 443, protocol: "tcp", name: "https", product: "Synthetic Web TLS" }] },
  { id: "directory-1", name: "DIRECTORY-01", kind: "Server", address: "10.76.30.10", vlan: 30, zone: "Identity Services", purpose: "Fictional directory and authentication service", modeledCondition: "Identity-boundary review", permittedWork: "Inspect policy metadata only; no account or credential activity.", services: [{ port: 389, protocol: "tcp", name: "ldap", product: "Synthetic Directory Service" }] },
  { id: "monitor-1", name: "MONITOR-01", kind: "Server", address: "10.76.40.10", vlan: 40, zone: "Operations Services", purpose: "Fictional monitoring and telemetry server", modeledCondition: "Routing and control-plane evidence", permittedWork: "Review modeled reachability, OSPF, and flow evidence only.", services: [{ port: 443, protocol: "tcp", name: "https", product: "Synthetic Monitoring UI" }, { port: 161, protocol: "udp", name: "snmp", product: "Synthetic Telemetry Agent" }] },
  { id: "cam-1", name: "CAM-01", kind: "IoT", address: "10.76.50.21", vlan: 50, zone: "Physical Security", purpose: "Fictional CCTV camera", modeledCondition: "Device segmentation and service-path review", permittedWork: "Inspect VLAN, port, MAC, and allowed-path evidence only.", services: [{ port: 443, protocol: "tcp", name: "https", product: "Synthetic Camera UI" }] },
  { id: "badge-1", name: "BADGE-01", kind: "IoT", address: "10.76.50.31", vlan: 50, zone: "Physical Security", purpose: "Fictional badge-reader controller", modeledCondition: "IoT isolation review", permittedWork: "Validate modeled network placement and policy evidence only.", services: [{ port: 443, protocol: "tcp", name: "https", product: "Synthetic Badge Controller UI" }] },
  { id: "sensor-1", name: "SENSOR-01", kind: "IoT", address: "10.76.60.41", vlan: 60, zone: "Facilities IoT", purpose: "Fictional environmental sensor", modeledCondition: "IoT network segmentation review", permittedWork: "Observe simulated telemetry path and access controls only.", services: [{ port: 8883, protocol: "tcp", name: "secure-mqtt", product: "Synthetic Sensor Telemetry" }] },
  { id: "printer-1", name: "PRINT-01", kind: "IoT", address: "10.76.70.50", vlan: 70, zone: "Shared Services", purpose: "Fictional network printer", modeledCondition: "Shared-service exposure review", permittedWork: "Use configuration evidence only; no print jobs or service interaction.", services: [{ port: 631, protocol: "tcp", name: "ipp", product: "Synthetic Print Service" }] },
  { id: "file-1", name: "FILE-01", kind: "Server", address: "10.76.70.60", vlan: 70, zone: "Shared Services", purpose: "Fictional team-file service", modeledCondition: "Guest-access policy review", permittedWork: "Inspect modeled access policy and report scope; no share browsing or file access.", services: [{ port: 445, protocol: "tcp", name: "microsoft-ds", product: "Synthetic SMB File Service" }] },
  { id: "bastion-1", name: "BASTION-01", kind: "Server", address: "10.76.99.30", vlan: 99, zone: "Management VLAN", purpose: "Fictional privileged-access jump host", modeledCondition: "Remote-administration hygiene review", permittedWork: "Review modeled SSH and VTY policy only; never authenticate or handle keys.", services: [{ port: 22, protocol: "tcp", name: "ssh", product: "Synthetic Bastion SSH" }] },
  { id: "kdc-1", name: "KDC-01", kind: "Server", address: "10.76.30.11", vlan: 30, zone: "Identity Services", purpose: "Fictional directory ticket service", modeledCondition: "Identity trust-boundary review", permittedWork: "Inspect simulated policy metadata only; no ticket, hash, account, or credential activity.", services: [{ port: 88, protocol: "tcp", name: "kerberos-sec", product: "Synthetic Kerberos Service" }, { port: 389, protocol: "tcp", name: "ldap", product: "Synthetic Directory Service" }] },
  { id: "cache-1", name: "CACHE-01", kind: "Server", address: "10.76.20.90", vlan: 20, zone: "Application DMZ", purpose: "Fictional application cache service", modeledCondition: "Authentication-anomaly containment review", permittedWork: "Review deterministic alert and boundary policy; no connection or command interaction.", services: [{ port: 8443, protocol: "tcp", name: "https-alt", product: "Synthetic Cache Admin API" }] },
  { id: "legacy-ftp-1", name: "LEGACY-FTP-01", kind: "Server", address: "10.76.80.21", vlan: 80, zone: "Legacy Services", purpose: "Fictional retired file-transfer service", modeledCondition: "Service-retirement and compensating-control review", permittedWork: "Inspect modeled inventory and ACL evidence only; no service connection or authentication.", services: [{ port: 21, protocol: "tcp", name: "ftp", product: "Synthetic Legacy FTP" }] },
  { id: "dns-1", name: "DNS-01", kind: "Server", address: "10.76.40.53", vlan: 40, zone: "Operations Services", purpose: "Fictional internal naming service", modeledCondition: "Service inventory and egress-policy review", permittedWork: "Review modeled address and policy evidence only; no queries or enumeration.", attackLens: "ATT&CK analysis: suspicious DNS answer is an observable; adversary-in-the-middle is a hypothesis, not attribution.", services: [{ port: 53, protocol: "tcp", name: "domain", product: "Synthetic DNS Service" }, { port: 53, protocol: "udp", name: "domain", product: "Synthetic DNS Service" }] },
  { id: "xss-lab", name: "xss-lab.example", kind: "Website", address: "10.76.20.111:443", vlan: 20, zone: "Application DMZ", purpose: "Fictional search page with unsafe HTML reflection", modeledCondition: "Reflected-input evidence; browser execution requires separate validation", permittedWork: "Use the harmless training markup marker and inspect the modeled response.", attackLens: "ATT&CK analysis: web input reflection is a finding; execution and initial-access tactics are unconfirmed.", services: [{ port: 443, protocol: "tcp", name: "https", product: "Synthetic Search UI" }] },
  { id: "files-lab", name: "files-lab.example", kind: "Website", address: "10.76.20.112:443", vlan: 20, zone: "Application DMZ", purpose: "Fictional download endpoint with an exposed training canary", modeledCondition: "Path traversal to a synthetic canary, never a host file", permittedWork: "Request only the built-in canary filename; no real filesystem is read.", attackLens: "ATT&CK analysis: synthetic unauthorized file access is observable; collection intent is not established.", services: [{ port: 443, protocol: "tcp", name: "https", product: "Synthetic File UI" }] },
  { id: "linux-lab", name: "LINUX-LAB-01", kind: "Server", address: "10.76.99.41", vlan: 99, zone: "Management VLAN", purpose: "Fictional Linux host with a scoped sudo policy error", modeledCondition: "Training user may run only id with elevated privilege", permittedWork: "Inspect the modeled sudo policy and run id in the contained training session.", attackLens: "ATT&CK tactic: Privilege Escalation is demonstrated for /usr/bin/id only; no shell or persistence.", services: [{ port: 22, protocol: "tcp", name: "ssh", product: "Synthetic Linux SSH" }] },
  { id: "legacy-app", name: "legacy-app.example", kind: "Server", address: "10.76.20.113:443", vlan: 20, zone: "Application DMZ", purpose: "Fictional legacy parser with a memory-fault canary", modeledCondition: "A fixed-length buffer is overrun by the harmless training marker, causing a simulated crash, not code execution", permittedWork: "Submit only the harmless literal marker and inspect synthetic service logs.", attackLens: "ATT&CK analysis: service crash is an impact observable; code execution and attacker intent are unconfirmed.", services: [{ port: 443, protocol: "tcp", name: "https", product: "Synthetic Legacy Parser" }] },
  { id: "unknown-app", name: "unknown-app.example", kind: "Server", address: "10.76.20.114:443", vlan: 20, zone: "Application DMZ", purpose: "Fictional service with an unexplained integrity alert", modeledCondition: "Unknown-cause anomaly requiring isolation and investigation; not a confirmed zero-day", permittedWork: "Read health and synthetic logs, then validate network containment.", attackLens: "ATT&CK classification pending: unknown cause is not evidence of a zero-day exploit or specific tactic.", services: [{ port: 443, protocol: "tcp", name: "https", product: "Synthetic Incident Service" }] },
  {
    id: "container-api-1", name: "CONTAINER-API-01", kind: "Container", address: "10.76.20.100:8443", vlan: 20, zone: "Application DMZ", purpose: "Fictional containerized order-status API", modeledCondition: "Container runtime, identity, and service-boundary review", permittedWork: "Inspect synthetic runtime metadata, logs, policy, and findings; no image pulls, shell access, requests, or execution.", services: [{ port: 8443, protocol: "tcp", name: "https-alt", product: "Synthetic Order Status API" }],
    container: {
      image: "registry.training.local/order-status-api:1.4.2",
      runtime: "Docker (simulated)",
      network: "training-app-dmz",
      publishedPorts: ["8443/tcp"],
      environmentClassification: "Synthetic production-like training data only",
      health: "degraded",
      restartPolicy: "unless-stopped (modeled)",
      volumePolicy: "read-only application image; no host mounts",
      logSummary: "Synthetic alert: authorization policy drift requires review.",
      simulatedFindings: ["Approved TLS listener is required.", "Rate policy must be explicit.", "Token enforcement must be enabled.", "No shell, image, registry, or network action is available."],
      behavior: {
        ingress: { tlsEnabled: false, tlsCertValid: true, tokenRequired: false, rateLimitRps: 60, burst: 60 },
        health: "healthy",
        kernel: { version: "6.1.0-training-alpine", memoryLimitMb: 512, cpuLimitCores: 0.5, pidsLimit: 100, seccompProfile: "docker-default", droppedCapabilities: ["CAP_SYS_ADMIN", "CAP_NET_ADMIN", "CAP_SYS_PTRACE"], retainedCapabilities: ["CAP_NET_BIND_SERVICE"] },
        socket: { protocol: "tcp", port: 8443, interface: "eth0", backlogMax: 128, sendBufferBytes: 16384, receiveBufferBytes: 16384, tcpNoDelay: true, keepAlive: true, reuseAddress: true },
        initialLogs: [{ level: "info", message: "container booted in synthetic runtime" }, { level: "warn", message: "TLS, token, and ingress policy require review" }],
      },
    },
  },
  {
    id: "cyber-vm-01", name: "CYBER-VM-01", kind: "Container", address: "10.76.20.101:8443", vlan: 20, zone: "Application DMZ", purpose: "Fictional containerized practice target for the local model cyber project", modeledCondition: "Virtual-machine practice target: container runtime, service inventory, and boundary review", permittedWork: "Inspect synthetic runtime metadata, logs, policy, and findings; no image pulls, shell access, requests, or execution.", services: [{ port: 8443, protocol: "tcp", name: "https-alt", product: "Synthetic Practice Target API" }],
    container: {
      image: "registry.training.local/cyber-vm:1.0.0",
      runtime: "Docker (simulated)",
      network: "training-app-dmz",
      publishedPorts: ["8443/tcp"],
      environmentClassification: "Synthetic production-like training data only",
      health: "healthy",
      restartPolicy: "unless-stopped (modeled)",
      volumePolicy: "read-only application image; no host mounts",
      logSummary: "Synthetic practice target: runtime and policy review pending.",
      simulatedFindings: ["Approved TLS listener is required.", "Token enforcement must be enabled.", "No shell, image, registry, or network action is available."],
      behavior: {
        ingress: { tlsEnabled: false, tlsCertValid: true, tokenRequired: false, rateLimitRps: 60, burst: 60 },
        health: "healthy",
        kernel: { version: "6.1.0-training-alpine", memoryLimitMb: 512, cpuLimitCores: 0.5, pidsLimit: 100, seccompProfile: "docker-default", droppedCapabilities: ["CAP_SYS_ADMIN", "CAP_NET_ADMIN", "CAP_SYS_PTRACE"], retainedCapabilities: ["CAP_NET_BIND_SERVICE"] },
        socket: { protocol: "tcp", port: 8443, interface: "eth0", backlogMax: 128, sendBufferBytes: 16384, receiveBufferBytes: 16384, tcpNoDelay: true, keepAlive: true, reuseAddress: true },
        initialLogs: [{ level: "info", message: "container booted in synthetic runtime" }, { level: "info", message: "practice target ready for authorized training" }],
      },
    },
  },
];

export const simulatedTargetById = Object.fromEntries(simulatedTargetRange.map((asset) => [asset.id, asset]));
