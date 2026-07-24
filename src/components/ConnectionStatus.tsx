import { useTranslation } from "react-i18next";
import type { DeviceState } from "../features/device/device.types";

interface ConnectionStatusProps {
  state: DeviceState;
  applicationLocked?: boolean;
}

export function ConnectionStatus({
  state,
  applicationLocked = false,
}: ConnectionStatusProps) {
  const { t } = useTranslation();
  const displayState =
    state === "connected" && applicationLocked ? "recovering" : state;
  const label = t(`status.${displayState}`);
  return (
    <div
      className={`status-indicator status-indicator--${displayState}`}
      role="status"
      aria-label={label}
      title={label}
    >
      <span className="status-indicator__dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
