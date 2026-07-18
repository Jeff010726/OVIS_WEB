import {
  AlertTriangle,
  CheckCircle2,
  Download,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import type { UseWorkspacePolicy } from "./workspace-policy.types";

const WINDOWS_SETUP_URL =
  import.meta.env.VITE_WORKSPACE_SETUP_WINDOWS_URL ??
  import.meta.env.VITE_WORKSPACE_SETUP_URL ??
  "https://ovis.aimorelogy.com/downloads/OVIS-Workspace-Setup.exe";
const LINUX_SETUP_URL =
  import.meta.env.VITE_WORKSPACE_SETUP_LINUX_URL ??
  "https://ovis.aimorelogy.com/downloads/OVIS-Workspace-Setup.deb";
const MACOS_SETUP_URL =
  import.meta.env.VITE_WORKSPACE_SETUP_MACOS_URL ??
  "https://ovis.aimorelogy.com/downloads/OVIS-Workspace-Setup.mobileconfig";

interface WorkspaceGateProps {
  policy: UseWorkspacePolicy;
}

export function WorkspaceGate({ policy }: WorkspaceGateProps) {
  const { t } = useTranslation();
  const isChecking = policy.state === "checking";
  const isWaiting = policy.state === "waiting";
  const showDownloads = !isChecking && !isWaiting && policy.state !== "ready";
  const Icon = isChecking || isWaiting
    ? LoaderCircle
    : policy.state === "unsupported" || policy.state === "error"
      ? AlertTriangle
      : ShieldCheck;

  return (
    <div className="workspace-gate-shell">
      <header className="app-header workspace-gate-header">
        <a className="brand" href="./" aria-label={t("workspaceGate.home")}>
          <img
            className="brand__company-logo"
            src={`${import.meta.env.BASE_URL}images/aimorelogy-logo.png`}
            alt=""
          />
          <span className="brand__wordmark">OVIS</span>
          <span className="brand__divider" />
          <span className="brand__product">WORKSPACE</span>
        </a>
        <LanguageSwitcher />
      </header>

      <main className="workspace-gate">
        <section className="workspace-gate__panel" aria-live="polite">
          <div className={`workspace-gate__icon workspace-gate__icon--${policy.state}`}>
            <Icon
              size={27}
              strokeWidth={1.5}
              className={isChecking || isWaiting ? "workspace-gate__spinner" : undefined}
            />
          </div>
          <span className="eyebrow">{t("workspaceGate.eyebrow")}</span>
          <h1>{t(`workspaceGate.states.${policy.state}.title`)}</h1>
          <p>{t(`workspaceGate.states.${policy.state}.detail`)}</p>

          {isWaiting && (
            <div className="workspace-gate__status">
              <CheckCircle2 size={15} />
              <span>{t("workspaceGate.waitingStatus")}</span>
            </div>
          )}
          {isWaiting && policy.longWaiting && (
            <p className="workspace-gate__restart-hint">
              {t("workspaceGate.restartHint")}
            </p>
          )}

          {showDownloads && (
            <div className="workspace-gate__download-section">
              <strong>{t("workspaceGate.downloadTitle")}</strong>
              <div className="workspace-gate__downloads">
                <a
                  className="button button--primary"
                  href={WINDOWS_SETUP_URL}
                  download
                  onClick={policy.startInstallation}
                >
                  <Download size={16} />
                  {t("workspaceGate.downloadWindows")}
                </a>
                <a
                  className="button button--secondary"
                  href={LINUX_SETUP_URL}
                  download
                  onClick={policy.startInstallation}
                >
                  <Download size={16} />
                  {t("workspaceGate.downloadLinux")}
                </a>
                <a
                  className="button button--secondary"
                  href={MACOS_SETUP_URL}
                  download
                  onClick={policy.startInstallation}
                >
                  <Download size={16} />
                  {t("workspaceGate.downloadMacos")}
                </a>
              </div>
            </div>
          )}

          <div className="workspace-gate__actions">
            {!isChecking && (
              <button
                className="button button--secondary"
                type="button"
                onClick={() => void policy.check()}
              >
                <RefreshCw size={15} />
                {t("workspaceGate.recheck")}
              </button>
            )}
          </div>

          {showDownloads && (
            <small className="workspace-gate__installer-note">
              {t("workspaceGate.installerNote")}
            </small>
          )}
          {showDownloads && (
            <small className="workspace-gate__platform-note">
              {t("workspaceGate.platformNote")}
            </small>
          )}
        </section>
      </main>
    </div>
  );
}
