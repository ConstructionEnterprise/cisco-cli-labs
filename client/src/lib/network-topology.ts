export type PortRef = {
  nodeId: string;
  port: string;
};

export type SelectionRef =
  | { kind: "node"; id: string }
  | { kind: "link"; id: string }
  | { kind: "port"; id: string };

export type TrafficPacket = {
  id: string;
  source: string;
  destination: string;
  path: string[];
  color: string;
  sequence: number;
  direction: "request" | "reply";
  startDelay?: number;
  flowId?: string;
  protocol?: "icmp" | "tcp" | "udp" | "dns" | "http" | "https" | "dhcp" | "vpn";
  sourcePort?: number;
  destinationPort?: number;
  vlan?: number;
  stage?: "generated" | "forwarded" | "inspected" | "translated" | "delivered" | "denied";
  tls?: {
    serverName: string;
    certificateTrusted: boolean;
    decryptable: boolean;
    inspected?: boolean;
  };
};
