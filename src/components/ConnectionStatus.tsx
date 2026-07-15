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
  return (
    <div className={`status-indicator status-indicator--${displayState}`} role="status">
      <span className="status-indicator__dot" aria-hidden="true" />
      <span>{t(`status.${displayState}`)}</span>
    </div>
  );
}
