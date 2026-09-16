import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, OrbitControls, Text } from "@react-three/drei";
import { Search, Package, MapPin, Check, RotateCcw, ScanLine } from "lucide-react";

export type InventoryStatus = "Available" | "Low Stock" | "Checked Out";
type InventoryItem = {
  id: string;
  name: string;
  category: string;
  aisle: string;
  location: string;
  quantity: number;
  status: InventoryStatus;
  specs: string;
  function: string;
  coilLength: string;
  unitPrice: number;
  pricePerMeter?: number;
  weight: string;
  manufacturer: string;
  partNumber: string;
  position: [number, number, number];
  color: string;
  kind: "box" | "cylinder" | "rack" | "device";
};

const inventory: InventoryItem[] = [
  { id: "CAB-T568B-001", name: "T568B Patch Cable Kit", category: "Copper & Ethernet", aisle: "Aisle 1", location: "Shelf A / Bin 01", quantity: 18, status: "Available", specs: "Cat6, 1–3 m mixed lengths, T568B terminated", function: "Patch connectivity and cable-order training.", coilLength: "100 m carton", unitPrice: 24.99, weight: "3.2 kg", manufacturer: "Construction Enterprises", partNumber: "T568B-CAT6-100M", position: [-6, 1.1, -2], color: "#e8a53a", kind: "box" },
  { id: "FLK-LINKIQ-001", name: "Fluke LinkIQ Tester", category: "Copper & Ethernet", aisle: "Aisle 1", location: "Display Stand / Bay 02", quantity: 1, status: "Available", specs: "Cable qualification, switch diagnostics, PoE verification", function: "Validate T568B order, wiremap, speed, and PoE.", coilLength: "N/A", unitPrice: 799.0, weight: "1.1 kg", manufacturer: "Fluke Networks", partNumber: "LinkIQ", position: [-4, 1.4, -2], color: "#f4c245", kind: "device" },
  { id: "PNL-48P-CAT6-001", name: "48-Port Patch Panel", category: "Copper & Ethernet", aisle: "Aisle 1", location: "Rack A / U02", quantity: 3, status: "Available", specs: "19-inch, 48-port Cat6 patch panel", function: "Terminate and organize copper horizontal cabling.", coilLength: "N/A", unitPrice: 89.99, weight: "2.4 kg", manufacturer: "Leviton", partNumber: "47611-C6", position: [-2, 1.2, -2], color: "#667783", kind: "rack" },
  { id: "TOOL-005", name: "VAEYI Thermal Stripper", category: "Fiber Tooling", aisle: "Aisle 2", location: "Drawer C / Slot 05", quantity: 4, status: "Available", specs: "Multi-level temperature adjustment, 250μm–900μm coating removal", function: "Remove the 250μm fiber coating before cleaning and cleaving.", coilLength: "N/A", unitPrice: 129.0, weight: "0.8 kg", manufacturer: "VAEYI", partNumber: "VAEYI-TS-250", position: [-6, 1.1, 2], color: "#d47738", kind: "device" },
  { id: "TOOL-006", name: "Fujikura FH-80-12 Fiber Holder", category: "Fiber Tooling", aisle: "Aisle 2", location: "Workbench / Tray 01", quantity: 2, status: "Low Stock", specs: "12-fiber ribbon holder for mass fusion preparation", function: "Hold and align ribbon fibers for splicing.", coilLength: "N/A", unitPrice: 74.0, weight: "0.2 kg", manufacturer: "Fujikura", partNumber: "FH-80-12", position: [-4, 1.1, 2], color: "#2b7890", kind: "device" },
  { id: "TOOL-007", name: "One-Click Cleaning Pen", category: "Fiber Tooling", aisle: "Aisle 2", location: "Drawer C / Slot 08", quantity: 9, status: "Available", specs: "Single-action LC/SC endface cleaning pen", function: "Remove contamination from a prepared fiber endface.", coilLength: "N/A", unitPrice: 18.5, weight: "0.1 kg", manufacturer: "Jonard Tools", partNumber: "FCC-100", position: [-2, 1.1, 2], color: "#e4e7e4", kind: "cylinder" },
  { id: "TOOL-008", name: "Fujikura 100R Mass Fusion Splicer", category: "Fiber Tooling", aisle: "Aisle 2", location: "Cabinet B / Shelf 02", quantity: 1, status: "Checked Out", specs: "Mass fusion splicing platform, estimated insertion loss 0.02 dB", function: "Fuse prepared fibers with an electric arc and certify the splice.", coilLength: "N/A", unitPrice: 18500.0, weight: "17 kg", manufacturer: "Fujikura", partNumber: "100R", position: [-6, 1.2, 2], color: "#30485a", kind: "device" },
  { id: "HW-FGT-100F", name: "FortiGate 100F", category: "Active Hardware", aisle: "Aisle 3", location: "Rack C / U10", quantity: 2, status: "Available", specs: "NGFW/UTM, IPS/IDS, VPN, policy enforcement", function: "Secure, inspect, and route traffic between network zones.", coilLength: "N/A", unitPrice: 3250.0, weight: "5.4 kg", manufacturer: "Fortinet", partNumber: "FG-100F", position: [2, 1.2, -2], color: "#c96735", kind: "rack" },
  { id: "HW-FSW-124F", name: "FortiSwitch 124F", category: "Active Hardware", aisle: "Aisle 3", location: "Rack C / U14", quantity: 2, status: "Available", specs: "Managed access switching with PoE and VLAN support", function: "Provide wired access and power to connected devices.", coilLength: "N/A", unitPrice: 1100.0, weight: "4.8 kg", manufacturer: "Fortinet", partNumber: "FS-124F", position: [4, 1.2, -2], color: "#708b43", kind: "rack" },
  { id: "HW-FAP-431F", name: "FortiAP 431F", category: "Active Hardware", aisle: "Aisle 3", location: "Rack C / Shelf 04", quantity: 5, status: "Low Stock", specs: "Wi-Fi 6 access point with controller-managed radios", function: "Provide wireless access at the network edge.", coilLength: "N/A", unitPrice: 645.0, weight: "0.7 kg", manufacturer: "Fortinet", partNumber: "FAP-431F", position: [6, 1.2, -2], color: "#6b83a2", kind: "device" },
  { id: "CAB-GYTA53-24B1.3", name: "GYTA53-24B1.3 Armored Fiber", category: "Bulk Cabling", aisle: "Aisle 4", location: "Spool Bay / S01", quantity: 2, status: "Available", specs: "24-core, six colored tubes, outdoor direct-burial armored cable", function: "Outdoor backbone cable for long-haul fiber infrastructure.", coilLength: "2,000 m standard spool", unitPrice: 1250.0, pricePerMeter: 0.625, weight: "185 kg", manufacturer: "Hengtong", partNumber: "GYTA53-24B1.3", position: [2, 1.2, 2], color: "#e47d2c", kind: "cylinder" },
  { id: "HW-POE-001", name: "PoE Injector and Media Converter Set", category: "Bulk Cabling", aisle: "Aisle 4", location: "Rack D / Shelf 03", quantity: 6, status: "Available", specs: "PoE injection and copper/fiber media conversion", function: "Extend and power remote network endpoints.", coilLength: "N/A", unitPrice: 149.0, weight: "1.6 kg", manufacturer: "Construction Enterprises", partNumber: "POE-MC-KIT", position: [5, 1.1, 2], color: "#53636c", kind: "box" },
];

const taskTools = ["Cable stripping tool", "Thermal stripper", "Cleaning pen", "Cleaver", "Fusion Splicer"];
const t568b = ["White/Orange", "Orange", "White/Green", "Blue", "White/Blue", "Green", "White/Brown", "Brown"];
const WORKBENCH_ORIGIN: [number, number, number] = [0, 0, 0];
const WORKBENCH_TABLETOP_CENTER: [number, number, number] = [0, 1.78, 0];

function AssetMesh({ item, selected, onSelect, onPopulate, onWorkbench }: { item: InventoryItem; selected: boolean; onSelect: () => void; onPopulate: () => void; onWorkbench: boolean }) {
  const size = item.kind === "rack" ? [1.25, 0.55, 0.42] : item.kind === "cylinder" ? [0.38, 0.55, 0.38] : item.kind === "device" ? [0.78, 0.42, 0.48] : [0.8, 0.45, 0.55];
  const position: [number, number, number] = onWorkbench ? WORKBENCH_TABLETOP_CENTER : item.position;
  const groupRef = useRef<any>(null);
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.position.lerp({ x: position[0], y: position[1], z: position[2] }, Math.min(1, delta * 5));
  });
  return <group ref={groupRef} position={position} onClick={(event) => { event.stopPropagation(); onSelect(); }} onDoubleClick={(event) => { event.stopPropagation(); onPopulate(); }}>
    {onWorkbench && <mesh position={[0, -0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.6, 0.76, 32]} /><meshBasicMaterial color="#63e6e2" transparent opacity={0.65} /></mesh>}
    <mesh castShadow rotation={item.kind === "cylinder" ? [Math.PI / 2, 0, 0] : [0, 0, 0]}>
      {item.kind === "cylinder" ? <cylinderGeometry args={[size[0], size[0], size[1], 20]} /> : <boxGeometry args={size as [number, number, number]} />}
      <meshStandardMaterial color={selected ? "#63e6e2" : item.color} metalness={item.kind === "rack" ? 0.5 : 0.2} roughness={0.45} emissive={selected ? "#63e6e2" : "#000000"} emissiveIntensity={selected ? 0.5 : 0} />
    </mesh>
    {item.kind === "rack" && <mesh position={[0, 0.02, 0.23]}><boxGeometry args={[1.05, 0.16, 0.02]} /><meshStandardMaterial color="#121b23" /></mesh>}
    <Text position={[0, 0.48, 0]} fontSize={0.12} color={selected ? "#63e6e2" : "#dbe5e5"} anchorX="center" anchorY="middle" maxWidth={1.7}>{item.name}</Text>
  </group>;
}

function RoomScene({ items, selectedId, workbenchId, onSelect, onPopulate }: { items: InventoryItem[]; selectedId: string | null; workbenchId: string | null; onSelect: (id: string) => void; onPopulate: (id: string) => void }) {
  return <Canvas camera={{ position: [0, 8.5, 12], fov: 42 }} shadows>
    <color attach="background" args={["#071018"]} />
    <ambientLight intensity={1.2} /><directionalLight position={[4, 9, 5]} intensity={2.1} castShadow />
    <Grid args={[18, 12]} cellSize={1} cellThickness={0.6} cellColor="#25444d" sectionSize={4} sectionThickness={1.1} sectionColor="#38616a" position={[0, 0, 0]} />
    <mesh position={[0, 0.15, -0.1]}><boxGeometry args={[16, 0.3, 5.5]} /><meshStandardMaterial color="#101c25" /></mesh>
    <group position={WORKBENCH_ORIGIN}>
      <mesh position={[0, 1.2, 0]} castShadow><boxGeometry args={[3.3, 0.18, 1.25]} /><meshStandardMaterial color="#815333" roughness={0.7} /></mesh>
      {[-1.35, 1.35].flatMap((x) => [-0.42, 0.42].map((z) => <mesh key={`${x}-${z}`} position={[x, 0.58, z]} castShadow><boxGeometry args={[0.14, 1.2, 0.14]} /><meshStandardMaterial color="#394953" metalness={0.5} /></mesh>))}
      {[-1.15, 0, 1.15].map((x) => <mesh key={x} position={[x, 2.1, -0.38]}><boxGeometry args={[0.85, 0.08, 0.08]} /><meshStandardMaterial color="#63e6e2" emissive="#63e6e2" emissiveIntensity={0.25} /></mesh>)}
      <Text position={[0, 2.9, -0.38]} fontSize={0.16} color="#63e6e2" anchorX="center">INSPECTION WORKBENCH</Text>
    </group>
    <group>
      {[-6.8, -2.25, 2.25, 6.8].map((x) => <mesh key={x} position={[x, 0.33, 0]}><boxGeometry args={[0.025, 0.012, 4.5]} /><meshBasicMaterial color="#38616a" /></mesh>)}
      <Text position={[-4.5, 0.35, -2.15]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.22} color="#63e6e2" anchorX="center">AISLE 1–2</Text>
      <Text position={[4.5, 0.35, -2.15]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.22} color="#63e6e2" anchorX="center">AISLE 3–4</Text>
    </group>
    {items.map((item) => <AssetMesh key={item.id} item={item} selected={selectedId === item.id} onWorkbench={workbenchId === item.id} onSelect={() => onSelect(item.id)} onPopulate={() => onPopulate(item.id)} />)}
    <OrbitControls makeDefault target={[0, 1, 0]} minDistance={7} maxDistance={19} />
  </Canvas>;
}

export default function InventoryManagementLibrary() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(inventory[0].id);
  const [workbenchId, setWorkbenchId] = useState<string | null>(null);
  const [task, setTask] = useState<string[]>([]);
  const [testerOrder, setTesterOrder] = useState<string[]>([]);
  const [bomIds, setBomIds] = useState<string[]>([]);
  const selected = inventory.find((item) => item.id === selectedId) || null;
  const categories = ["All", ...Array.from(new Set(inventory.map((item) => item.category)))];
  const filtered = useMemo(() => inventory.filter((item) => (category === "All" || item.category === category) && `${item.name} ${item.id} ${item.location}`.toLowerCase().includes(query.toLowerCase())), [category, query]);
  const testerPassed = testerOrder.join("|") === t568b.join("|");
  const bomItems = inventory.filter((item) => bomIds.includes(item.id));
  const bomTotal = bomItems.reduce((total, item) => total + item.unitPrice, 0);
  function selectAsset(id: string) { setSelectedId(id); }
  function populateWorkbench(id: string) { setSelectedId(id); setWorkbenchId(id); }
  function returnToShelf() { setWorkbenchId(null); }
  function addToBom() { if (selectedId) setBomIds((current) => current.includes(selectedId) ? current : [...current, selectedId]); }
  function toggleTask(name: string) { setTask((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]); }
  function addTesterColor(color: string) { if (testerOrder.length < t568b.length) setTesterOrder((current) => [...current, color]); }
  return <div className="mt-5 space-y-5">
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="overflow-hidden rounded-xl border border-[#63e6e2]/25 bg-[#081119] shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3"><div><div className="instrument-label text-[#63e6e2]">3D INVENTORY ROOM</div><h2 className="mt-1 text-lg font-semibold text-white">Network Technician's Tool Crib</h2></div><div className="font-mono text-[10px] uppercase text-[#71878e]">{filtered.length} visible assets · click to inspect · double-click to populate</div></div>
        <div className="h-[560px]"><RoomScene items={filtered} selectedId={selectedId} workbenchId={workbenchId} onSelect={selectAsset} onPopulate={populateWorkbench} /></div>
      </section>
      <aside className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-[#101a23] p-4"><div className="flex items-center gap-2 text-[#63e6e2]"><Search className="h-4 w-4" /><span className="instrument-label">INVENTORY SEARCH</span></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search SKU, tool, or location" className="mt-3 w-full rounded-lg border border-white/10 bg-[#0b141d] px-3 py-2 text-xs text-white outline-none placeholder:text-[#5f747d]" /><div className="mt-3 flex flex-wrap gap-1">{categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`rounded-full border px-2 py-1 text-[9px] ${category === item ? "border-[#63e6e2]/60 bg-[#173038] text-[#63e6e2]" : "border-white/10 text-[#71828a]"}`}>{item}</button>)}</div></div>
        <div className="rounded-xl border border-white/10 bg-[#101a23] p-4">{selected ? <><div className="flex items-start justify-between gap-3"><div><div className="instrument-label text-[#f5b74b]">ASSET INSPECTOR</div><h3 className="mt-1 text-lg font-semibold text-white">{selected.name}</h3></div><Package className="h-5 w-5 text-[#f5b74b]" /></div><div className="mt-3 space-y-2 text-xs"><div className="font-mono text-[#63e6e2]">{selected.id}</div><div className="flex justify-between gap-2"><span className="text-[#71828a]">Status</span><span className={selected.status === "Available" ? "text-[#63e6e2]" : selected.status === "Low Stock" ? "text-[#f5b74b]" : "text-[#f07178]"}>{selected.status}</span></div><div className="flex justify-between gap-2"><span className="text-[#71828a]">Quantity</span><span className="text-white">{selected.quantity}</span></div><div className="flex justify-between gap-2"><span className="text-[#71828a]">Location</span><span className="text-right text-white">{selected.aisle}, {selected.location}</span></div><div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/10 pt-3"><span className="text-[#71828a]">Unit price</span><span className="text-right text-white">${selected.unitPrice.toFixed(2)}</span><span className="text-[#71828a]">Coil / spool</span><span className="text-right text-white">{selected.coilLength}</span>{selected.pricePerMeter !== undefined && <><span className="text-[#71828a]">Price / meter</span><span className="text-right text-white">${selected.pricePerMeter.toFixed(3)}</span></>}<span className="text-[#71828a]">Weight</span><span className="text-right text-white">{selected.weight}</span><span className="text-[#71828a]">Manufacturer</span><span className="text-right text-white">{selected.manufacturer}</span><span className="text-[#71828a]">Part number</span><span className="text-right font-mono text-[#b9eeee]">{selected.partNumber}</span></div><p className="border-t border-white/10 pt-3 leading-5 text-[#9aadb2]">{selected.function}</p><p className="leading-5 text-[#b9c9cb]">{selected.specs}</p></div><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={returnToShelf} className="flex items-center justify-center gap-2 rounded-lg border border-white/10 px-2 py-2 text-[10px] uppercase text-[#aebcc0] hover:border-[#63e6e2]/50 hover:text-white"><MapPin className="h-3.5 w-3.5" /> Return to shelf</button><button type="button" onClick={addToBom} className="rounded-lg border border-[#f5b74b]/35 bg-[#2a2112] px-2 py-2 text-[10px] uppercase text-[#f4d998] hover:border-[#f5b74b]/70">Add to BOM</button></div></> : <p className="text-xs text-[#71828a]">Select an asset in the room.</p>}</div>
      </aside>
    </div>
    <section className="rounded-xl border border-[#f5b74b]/25 bg-[#17130d] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="instrument-label text-[#f5b74b]">BILL OF MATERIALS</div><h3 className="mt-1 text-sm font-semibold text-white">Job packing list</h3></div><div className="font-mono text-sm text-[#f4d998]">{bomItems.length} items · ${bomTotal.toFixed(2)}</div></div>{bomItems.length ? <div className="mt-3 flex flex-wrap gap-2">{bomItems.map((item) => <button key={item.id} type="button" onClick={() => setBomIds((current) => current.filter((id) => id !== item.id))} className="rounded border border-white/10 bg-[#2a2112] px-2 py-1 text-[10px] text-[#f4d998]">{item.name} · ${item.unitPrice.toFixed(2)} ×</button>)}</div> : <p className="mt-2 text-xs text-[#8f9c9e]">Select an asset, then choose Add to BOM to build a quote for the job.</p>}</section>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-[#f5b74b]/25 bg-[#17130d] p-4"><div className="flex items-center justify-between"><div><div className="instrument-label text-[#f5b74b]">TRAINING TASK</div><h3 className="mt-1 text-sm font-semibold text-white">Terminate a 24-core outdoor fiber cable</h3></div><ScanLine className="h-5 w-5 text-[#f5b74b]" /></div><p className="mt-2 text-xs text-[#9eaaa9]">Select the correct tools in sequence. This first workflow slice uses the inventory catalog as the tool crib.</p><div className="mt-3 grid gap-1.5 sm:grid-cols-2">{taskTools.map((toolName, index) => <button type="button" key={toolName} onClick={() => toggleTask(toolName)} className={`flex items-center gap-2 rounded border px-2.5 py-2 text-left text-[10px] ${task.includes(toolName) ? "border-[#63e6e2]/50 bg-[#173038] text-[#63e6e2]" : "border-white/10 text-[#a3b1b3] hover:border-white/25"}`}><span className="font-mono text-[#f5b74b]">{index + 1}</span>{task.includes(toolName) && <Check className="h-3 w-3" />}{toolName}</button>)}</div><div className="mt-3 text-[10px] text-[#71828a]">Progress: {task.length}/{taskTools.length} tools selected</div></section>
      <section className="rounded-xl border border-[#63e6e2]/25 bg-[#0d1920] p-4"><div className="flex items-center justify-between"><div><div className="instrument-label text-[#63e6e2]">FLUKE LINKIQ MINI-GAME</div><h3 className="mt-1 text-sm font-semibold text-white">Build the T568B wiremap</h3></div><button type="button" onClick={() => setTesterOrder([])} className="text-[#71828a] hover:text-white" aria-label="Reset tester order"><RotateCcw className="h-4 w-4" /></button></div><p className="mt-2 text-xs text-[#9eaaa9]">Click the colors in the correct pin order. Pins 4, 5, 7, and 8 carry PoE Mode B.</p><div className="mt-3 flex flex-wrap gap-1.5">{t568b.map((color) => <button type="button" key={color} onClick={() => addTesterColor(color)} className="rounded border border-white/10 bg-[#111f28] px-2 py-1.5 text-[10px] text-[#c6d3d4] hover:border-[#63e6e2]/50">{color}</button>)}</div><div className="mt-3 min-h-8 rounded border border-white/10 bg-[#081119] p-2 font-mono text-[9px] text-[#63e6e2]">{testerOrder.length ? testerOrder.map((color, index) => `${index + 1}:${color}`).join(" · ") : "Awaiting wiremap input..."}</div>{testerPassed && <div className="mt-2 text-xs text-[#63e6e2]">PASS — T568B wiremap accepted.</div>}</section>
    </div>
  </div>;
}
