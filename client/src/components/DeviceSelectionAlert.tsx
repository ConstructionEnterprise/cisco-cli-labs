type DeviceSelectionAlertProps = {
  activeDevice?: string | null;
  requiredDevice?: string | null;
};

export default function DeviceSelectionAlert({ activeDevice, requiredDevice }: DeviceSelectionAlertProps) {
  if (!activeDevice || !requiredDevice || activeDevice === requiredDevice) return null;

  return (
    <div role="alert" className="mt-2 rounded border border-[#f07178]/30 bg-[#f07178]/10 px-3 py-2 text-[10px] leading-4 text-[#f4a3a8]">
      Console open on {activeDevice}. Select {requiredDevice} above before entering this command.
    </div>
  );
}
