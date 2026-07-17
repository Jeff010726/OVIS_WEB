import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DeviceConnectionErrorCode } from "../features/device/device.types";

interface ErrorMessageProps {
  code: DeviceConnectionErrorCode;
  onRetry: () => void;
  retryLabel?: string;
  onRescan?: () => void;
}

export function ErrorMessage({
  code,
  onRetry,
  retryLabel,
  onRescan,
}: ErrorMessageProps) {
  const { t } = useTranslation();
  const showLocalNetworkHelp =
    code === "PERMISSION_DENIED" ||
    code === "LOCAL_NETWORK_PERMISSION_DENIED";

  return (
    <div className="error-message" role="alert">
      <div className="error-message__icon" aria-hidden="true">
        <AlertTriangle size={19} strokeWidth={1.7} />
      </div>
      <div className="error-message__content">
        <strong>{t(`errors.${code}.title`)}</strong>
        <p>{t(`errors.${code}.detail`)}</p>
        {showLocalNetworkHelp && (
          <div className="local-network-help">
            <strong>{t("localNetworkHelp.title")}</strong>
            <ol>
              <li>{t("localNetworkHelp.stepOne")}</li>
              <li>{t("localNetworkHelp.stepTwo")}</li>
              <li>{t("localNetworkHelp.stepThree")}</li>
              <li>{t("localNetworkHelp.stepFour")}</li>
            </ol>
            <p>{t("localNetworkHelp.fallback")}</p>
          </div>
        )}
      </div>
      <div className="error-message__actions">
        {onRescan && (
          <button
            className="button button--ghost"
            type="button"
            onClick={onRescan}
          >
            <RefreshCw size={15} />
            {t("common.rescan")}
          </button>
        )}
        <button
          className="button button--secondary"
          type="button"
          onClick={onRetry}
        >
          <RotateCcw size={16} />
          {retryLabel ?? t("common.retry")}
        </button>
      </div>
    </div>
  );
}
