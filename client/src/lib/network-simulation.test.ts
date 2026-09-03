import { describe, expect, it } from "vitest";
import { modePrompt, nextMode, type Mode } from "@/lib/ios-engine";
import { connectCable, createBlankSimulation, createHeadquartersFactorySimulation, deriveState, executeCommand, loadTemplate, validateCable, type SimulationState } from "@/lib/network-simulation";

function run(state: SimulationState, deviceId: string, ...commands: string[]) {
  return commands.reduce((current, command) => {
    const result = executeCommand(current, deviceId, command);
    expect(result.accepted, `${deviceId} rejected ${command}`).toBe(true);
    return result.state;
  }, state);
}

function configureSwitch(state: SimulationState, deviceId: string, accessVlan: number, trunkPorts = "GigabitEthernet0/2 - 3") {
  return run(state, deviceId,
    "enable", "configure terminal", "vlan 10", "name CE-HQ-ENGINEERING", "exit", "vlan 20", "name FTF-PRODUCTION", "exit", "vlan 99", "name CE-NET-MANAGEMENT", "exit", "vlan 999", "name CE-NATIVE-BLACKHOLE", "exit",
    "interface FastEthernet0/1", "switchport mode access", `switchport access vlan ${accessVlan}`, "no shutdown", "exit",
    `interface range ${trunkPorts}`, "switchport mode trunk", "switchport trunk native vlan 999", "switchport trunk allowed vlan 10,20,99,999", "channel-group 1 mode active", "no shutdown", "exit",
    "interface GigabitEthernet0/4", "switchport mode trunk", "switchport trunk native vlan 999", "switchport trunk allowed vlan 10,20,99,999", "no shutdown", "exit",
    "interface Port-channel1", "switchport mode trunk", "switchport trunk native vlan 999", "switchport trunk allowed vlan 10,20,99,999", "no shutdown", "end",
  );
}

function configureRouter(state: SimulationState, deviceId = "ce-hq-r1") {
  return run(state, deviceId, "enable", "configure terminal", "interface GigabitEthernet0/0", "no shutdown", "exit", "interface GigabitEthernet0/0.10", "encapsulation dot1q 10", "ip address 192.168.10.1 255.255.255.0", "ipv6 address 2001:db8:10::1/64", "no shutdown", "exit", "interface GigabitEthernet0/0.20", "encapsulation dot1q 20", "ip address 192.168.20.1 255.255.255.0", "ipv6 address 2001:db8:20::1/64", "no shutdown", "end");
}

describe("shared IOS mode machine", () => {
  it("supports the complete required prompt transition sequence", () => {
    let mode: Mode = "user";
    expect(modePrompt("CE-HQ-DSW1", { mode, context: null, history: [], runningConfig: [], startupConfig: [] })).toBe("CE-HQ-DSW1>");
    mode = nextMode("enable", mode).mode;
    expect(modePrompt("CE-HQ-DSW1", { mode, context: null, history: [], runningConfig: [], startupConfig: [] })).toBe("CE-HQ-DSW1#");
    mode = nextMode("configure terminal", mode).mode;
    expect(modePrompt("CE-HQ-DSW1", { mode, context: null, history: [], runningConfig: [], startupConfig: [] })).toBe("CE-HQ-DSW1(config)#");
    mode = nextMode("vlan 10", mode).mode;
    expect(modePrompt("CE-HQ-DSW1", { mode, context: "10", history: [], runningConfig: [], startupConfig: [] })).toBe("CE-HQ-DSW1(config-vlan)#");
    mode = nextMode("exit", mode).mode;
    mode = nextMode("interface range GigabitEthernet0/2 - 3", mode).mode;
    expect(modePrompt("CE-HQ-DSW1", { mode, context: "GigabitEthernet0/2 - 3", history: [], runningConfig: [], startupConfig: [] })).toBe("CE-HQ-DSW1(config-if-range)#");
    mode = nextMode("exit", mode).mode;
    mode = nextMode("interface GigabitEthernet0/0.10", mode).mode;
    expect(modePrompt("CE-HQ-R1", { mode, context: "GigabitEthernet0/0.10", history: [], runningConfig: [], startupConfig: [] })).toBe("CE-HQ-R1(config-subif)#");
  });

  it("rejects commands from the wrong mode with a caret and explanation", () => {
    const state = createHeadquartersFactorySimulation();
    const result = executeCommand(state, "ce-hq-dsw", "show vlan brief");
    expect(result.accepted).toBe(false);
    expect(result.output.join("\n")).toContain("^");
    expect(result.output.join("\n")).toContain("Current mode is user");
  });
});

describe("configuration and derived state", () => {
  it("creates and names VLANs and assigns an access port", () => {
    const state = configureSwitch(createHeadquartersFactorySimulation(), "ce-hq-dsw", 10);
    const dsw = state.devices["ce-hq-dsw"];
    expect(dsw.vlans[10]).toEqual({ id: 10, name: "CE-HQ-ENGINEERING" });
    expect(dsw.interfaces["FastEthernet0/1"].accessVlan).toBe(10);
    const show = executeCommand(state, "ce-hq-dsw", "show vlan brief");
    expect(show.output.join("\n")).toContain("CE-HQ-ENGINEERING");
    expect(show.output.join("\n")).toContain("FastEthernet0/1");
  });

  it("derives trunk allowed VLAN behavior and deterministic spanning-tree evidence", () => {
    const state = configureSwitch(createHeadquartersFactorySimulation(), "ce-hq-dsw", 10);
    const dsw = state.devices["ce-hq-dsw"];
    expect(dsw.interfaces["GigabitEthernet0/2"].mode).toBe("trunk");
    expect(dsw.interfaces["GigabitEthernet0/2"].allowedVlans).toEqual([10, 20, 99, 999]);
    const show = executeCommand(state, "ce-hq-dsw", "show interfaces trunk");
    expect(show.output.join("\n")).toContain("GigabitEthernet0/2");
    const rootState = run(state, "ce-hq-dsw", "configure terminal", "spanning-tree mode rapid-pvst", "spanning-tree vlan 10,20,99 root primary", "end");
    const spanning = executeCommand(rootState, "ce-hq-dsw", "show spanning-tree");
    expect(spanning.output.join("\n")).toContain("VLAN10");
    expect(spanning.output.join("\n")).toContain("ROOT");
  });

  it("tracks administrative state separately from link state", () => {
    let state = createHeadquartersFactorySimulation();
    state = run(state, "ce-hq-dsw", "enable", "configure terminal", "interface GigabitEthernet0/4", "shutdown", "end");
    expect(state.derived.interfaceStatus["ce-hq-dsw:GigabitEthernet0/4"]).toBe("administratively down");
    state = run(state, "ce-hq-dsw", "configure terminal", "interface GigabitEthernet0/4", "no shutdown", "end");
    expect(state.derived.interfaceStatus["ce-hq-dsw:GigabitEthernet0/4"]).toBe("up/up");
  });

  it("derives compatible LACP member and Port-channel state", () => {
    let state = createHeadquartersFactorySimulation();
    state = configureSwitch(state, "ce-hq-dsw", 10);
    state = configureSwitch(state, "ftf-acc", 20);
    expect(state.etherChannels[1].protocol).toBe("LACP");
    expect(state.etherChannels[1].members).toHaveLength(4);
    expect(state.etherChannels[1].operational).toBe(true);
    const show = executeCommand(state, "ce-hq-dsw", "show etherchannel summary");
    expect(show.output.join("\n")).toContain("(SU)");
  });

  it("derives router subinterface encapsulation and connected routes", () => {
    const state = configureRouter(createHeadquartersFactorySimulation());
    const r1 = state.devices["ce-hq-r1"];
    expect(r1.interfaces["GigabitEthernet0/0.10"].encapsulationVlan).toBe(10);
    expect(r1.interfaces["GigabitEthernet0/0.20"].encapsulationVlan).toBe(20);
    expect(state.derived.routes.some((route) => route.prefix === "192.168.10.1/24" && route.protocol === "C")).toBe(true);
    expect(state.derived.routes.some((route) => route.prefix === "2001:db8:20::1/64" && route.protocol === "C")).toBe(true);
  });

  it("keeps device sessions independent", () => {
    let state = createHeadquartersFactorySimulation();
    state = run(state, "ce-hq-dsw", "enable", "configure terminal");
    state = run(state, "ce-hq-r1", "enable");
    expect(state.sessions["ce-hq-dsw"].mode).toBe("config");
    expect(state.sessions["ce-hq-r1"].mode).toBe("privileged");
  });
});

describe("topology reachability", () => {
  function readyState() {
    let state = createHeadquartersFactorySimulation();
    state = configureSwitch(state, "ce-hq-dsw", 10);
    state = configureSwitch(state, "ftf-acc", 20);
    return configureRouter(state);
  }

  it("succeeds for IPv4 and IPv6 router-on-a-stick pings", () => {
    const state = readyState();
    const ipv4 = executeCommand(state, "ce-hq-r1", "ping 192.168.20.10");
    const ipv6 = executeCommand(state, "ce-hq-r1", "ping ipv6 2001:db8:20::10");
    expect(ipv4.output.join("\n")).toContain("Success rate is 100 percent");
    expect(ipv6.output.join("\n")).toContain("Success rate is 100 percent");
    expect(state.derived.neighbors.length).toBeGreaterThan(0);
  });

  it("fails when VLAN 20 is removed from the trunk", () => {
    let state = readyState();
    state = run(state, "ce-hq-dsw", "configure terminal", "interface GigabitEthernet0/4", "switchport trunk allowed vlan 10,99,999", "end");
    const result = executeCommand(state, "ce-hq-r1", "ping 192.168.20.10");
    expect(result.output.join("\n")).toContain("VLAN 20 is not permitted on the trunk");
  });

  it("fails when the destination access interface is shut down", () => {
    let state = readyState();
    state = run(state, "ftf-acc", "configure terminal", "interface FastEthernet0/1", "shutdown", "end");
    const result = executeCommand(state, "ce-hq-r1", "ping 192.168.20.10");
    expect(result.output.join("\n")).toContain("administratively down");
  });

  it("updates deterministic MAC and IPv6-neighbor evidence from active state", () => {
    const state = readyState();
    const mac = executeCommand(state, "ce-hq-dsw", "show mac address-table");
    const neighbors = executeCommand(state, "ce-hq-r1", "show ipv6 neighbors");
    expect(mac.output.join("\n")).toContain("DYNAMIC");
    expect(neighbors.output.join("\n")).toContain("CE-HQ-DSW1");
  });
});

describe("cable validation and scenarios", () => {
  it("rejects occupied, nonexistent, same-device, duplicate, and incompatible cables", () => {
    const state = createHeadquartersFactorySimulation();
    expect(validateCable(state, { deviceId: "ce-hq-eng", interfaceName: "eth0" }, { deviceId: "ce-hq-dsw", interfaceName: "FastEthernet0/1" }).ok).toBe(false);
    expect(validateCable(state, { deviceId: "ce-hq-dsw", interfaceName: "missing" }, { deviceId: "ce-hq-r1", interfaceName: "GigabitEthernet0/1" }).reason).toContain("does not exist");
    expect(validateCable(state, { deviceId: "ce-hq-dsw", interfaceName: "GigabitEthernet0/2" }, { deviceId: "ce-hq-dsw", interfaceName: "GigabitEthernet0/3" }).reason).toContain("different devices");
    const blank = createBlankSimulation();
    const connected = connectCable(blank, { deviceId: "a", interfaceName: "eth0" }, { deviceId: "b", interfaceName: "eth0" });
    expect(connected.accepted).toBe(false);
  });

  it("loads clean templates without stale topology or session state", () => {
    const blank = loadTemplate("blank");
    expect(Object.keys(blank.devices)).toHaveLength(0);
    expect(Object.keys(blank.links)).toHaveLength(0);
    const hq = loadTemplate("headquarters-factory");
    expect(Object.keys(hq.devices)).toContain("ce-hq-dsw");
    expect(hq.sessions["ce-hq-dsw"].mode).toBe("user");
    expect(hq.sessions["ce-hq-dsw"].history).toHaveLength(3);
    expect(deriveState(hq).derived.routes).toBeDefined();
  });
});
