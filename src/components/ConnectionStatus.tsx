import type { DeviceState } from "../features/device/device.types";

const STATE_LABELS: Record<DeviceState, string> = {
  idle: "等待搜索",
  scanning: "正在搜索",
  results: "搜索完成",
  connecting: "正在连接",
  recovering: "设备重启中",
  connected: "设备在线",
  error: "操作异常",
};

interface ConnectionStatusProps {
  state: DeviceState;
  applicationLocked?: boolean;
}

export function ConnectionStatus({
  state,
  applicationLocked = false,
}: ConnectionStatusProps) {
  const displayState =
    state === "connected" && applicationLocked ? "recovering" : state;
  return (
    <div className={`status-indicator status-indicator--${displayState}`} role="status">
      <span className="status-indicator__dot" aria-hidden="true" />
      <span>{STATE_LABELS[displayState]}</span>
    </div>
  );
}
