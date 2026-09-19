import { GripHorizontal } from "lucide-react";

type ResizeGrabBarProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
};

export default function ResizeGrabBar({ label, value, min, max, onPointerDown, onKeyDown }: ResizeGrabBarProps) {
  return <div
    role="separator"
    aria-label={label}
    aria-orientation="horizontal"
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={value}
    tabIndex={0}
    onPointerDown={onPointerDown}
    onKeyDown={onKeyDown}
    className="group flex h-5 cursor-row-resize select-none items-center justify-center border-y border-white/10 bg-[#0b141c] text-[#536a72] outline-none transition hover:bg-[#173038] hover:text-[#63e6e2] focus-visible:bg-[#173038] focus-visible:text-[#63e6e2]"
  >
    <span className="sr-only">Drag to resize. Use the arrow keys for precise adjustments.</span>
    <GripHorizontal className="h-4 w-8" aria-hidden="true" />
  </div>;
}
