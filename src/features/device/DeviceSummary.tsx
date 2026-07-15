import { Cpu, Radio, RefreshCw, Unplug } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { OvisDeviceInfo } from "./device.types";

interface DeviceSummaryProps {
  device: OvisDeviceInfo;
  apiBaseUrl: string;
  connectedAt: Date | null;
  onDisconnect: () => void;
  onRescan: () => void;
}

const formatConnectionTime = (value: Date | null, locale: string) =>
  value
    ? new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(value)
    : "-";

const formatEndpoint = (apiBaseUrl: string) =>
  apiBaseUrl.replace(/^https?:\/\//, "");

export function DeviceSummary({
  device,
  apiBaseUrl,
  connectedAt,
  onDisconnect,
  onRescan,
}: DeviceSummaryProps) {
  const { t, i18n } = useTranslation();
  const identityItems = [
    [t("summary.model"), device.model],
    [t("summary.name"), device.name],
    [t("summary.serial"), device.serial],
    [t("summary.address"), formatEndpoint(apiBaseUrl)],
  ];
  const systemItems = [
    [t("summary.firmware"), device.firmware_version],
    [t("summary.manager"), device.manager_version],
    [t("summary.api"), `v${device.api_version}`],
  ];

  return (
    <div className="device-summary">
      <section className="device-identity" aria-labelledby="device-name">
        <div className="device-identity__copy">
          <div className="eyebrow">
            <Radio size={13} /> LIVE DEVICE
          </div>
          <h2 id="device-name">{device.name}</h2>
          <p>{device.device_id}</p>
        </div>
        <div className="device-identity__online">
          <span />
          {t("summary.healthy")}
        </div>
      </section>

      <div className="device-grid">
        <section className="info-section" aria-labelledby="identity-heading">
          <div className="info-section__heading">
            <span>01</span>
            <h3 id="identity-heading">{t("summary.identity")}</h3>
          </div>
          <dl>
            {identityItems.map(([label, value]) => (
              <div className="info-row" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="info-section" aria-labelledby="system-heading">
          <div className="info-section__heading">
            <span>02</span>
            <h3 id="system-heading">{t("summary.system")}</h3>
          </div>
          <dl>
            {systemItems.map(([label, value]) => (
              <div className="info-row" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <footer className="device-summary__footer">
        <div className="connection-time">
          <Cpu size={16} />
          <span>{t("summary.currentConnection")}</span>
          <time>{formatConnectionTime(connectedAt, i18n.resolvedLanguage ?? "en")}</time>
        </div>
        <div className="device-summary__actions">
          <button
            className="button button--ghost"
            type="button"
            onClick={onRescan}
          >
            <RefreshCw size={15} />
            {t("common.rescan")}
          </button>
          <button
            className="button button--secondary button--disconnect"
            type="button"
            onClick={onDisconnect}
          >
            <Unplug size={16} />
            {t("summary.disconnect")}
          </button>
        </div>
      </footer>
    </div>
  );
}
