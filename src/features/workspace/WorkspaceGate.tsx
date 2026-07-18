import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { FaMicrosoft } from "react-icons/fa6";
import { SiApple, SiLinux } from "react-icons/si";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import type { UseWorkspacePolicy } from "./workspace-policy.types";

type WorkspacePlatform = "windows" | "linux" | "macos";

const VERSION = "1.0.0";
const DOWNLOAD_ROOT = "https://ovis.aimorelogy.com/downloads";
const MACOS_RELEASE_ROOT =
  `https://github.com/Jeff010726/ovis.web.github.io/releases/download/` +
  `ovis-workspace-support-v${VERSION}`;

const DOWNLOAD_URLS = {
  windows:
    import.meta.env.VITE_WORKSPACE_SETUP_WINDOWS_URL ??
    import.meta.env.VITE_WORKSPACE_SETUP_URL ??
    `${DOWNLOAD_ROOT}/OVIS-Workspace-Setup-v1.exe`,
  linuxDeb:
    import.meta.env.VITE_WORKSPACE_SETUP_LINUX_DEB_URL ??
    `${DOWNLOAD_ROOT}/ovis-workspace-support_${VERSION}_all.deb`,
  linuxRpm:
    import.meta.env.VITE_WORKSPACE_SETUP_LINUX_RPM_URL ??
    `${DOWNLOAD_ROOT}/ovis-workspace-support-${VERSION}.noarch.rpm`,
  linuxChecksums:
    import.meta.env.VITE_WORKSPACE_SETUP_LINUX_SHA256_URL ??
    `${DOWNLOAD_ROOT}/SHA256SUMS`,
  macosPkg:
    import.meta.env.VITE_WORKSPACE_SETUP_MACOS_PKG_URL ??
    `${MACOS_RELEASE_ROOT}/OVIS-Workspace-Support-${VERSION}.pkg`,
  macosUninstaller:
    import.meta.env.VITE_WORKSPACE_SETUP_MACOS_UNINSTALLER_URL ??
    `${MACOS_RELEASE_ROOT}/OVIS-Workspace-Support-Uninstaller.pkg`,
  macosMobileconfig:
    import.meta.env.VITE_WORKSPACE_SETUP_MACOS_MOBILECONFIG_URL ??
    `${DOWNLOAD_ROOT}/OVIS-Workspace-Support.mobileconfig`,
  macosChecksums:
    import.meta.env.VITE_WORKSPACE_SETUP_MACOS_SHA256_URL ??
    `${MACOS_RELEASE_ROOT}/SHA256SUMS`,
} as const;

const platformOptions: Array<{
  id: WorkspacePlatform;
  icon: typeof FaMicrosoft;
}> = [
  { id: "windows", icon: FaMicrosoft },
  { id: "linux", icon: SiLinux },
  { id: "macos", icon: SiApple },
];

function detectPlatform(): WorkspacePlatform {
  const currentNavigator = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform = (
    currentNavigator.userAgentData?.platform ??
    currentNavigator.platform ??
    currentNavigator.userAgent
  ).toLowerCase();
  if (platform.includes("mac")) return "macos";
  if (platform.includes("win")) return "windows";
  return "linux";
}

interface WorkspaceGateProps {
  policy: UseWorkspacePolicy;
}

export function WorkspaceGate({ policy }: WorkspaceGateProps) {
  const { t } = useTranslation();
  const [platform, setPlatform] = useState<WorkspacePlatform>(detectPlatform);
  const isChecking = policy.state === "checking";
  const isDownloading = policy.state === "downloading";
  const isWaiting = policy.state === "waiting";
  const isPending = isChecking || isDownloading || isWaiting;
  const showDownloads = !isPending && policy.state !== "ready";
  const Icon = isPending
    ? LoaderCircle
    : policy.state === "unsupported" || policy.state === "error"
      ? AlertTriangle
      : ShieldCheck;

  const downloadStarted = () => policy.startInstallation();

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
              className={isPending ? "workspace-gate__spinner" : undefined}
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
          {isWaiting && (
            <div className="workspace-gate__restart-required">
              <RefreshCw size={17} />
              <div>
                <strong>{t("workspaceGate.restartRequiredTitle")}</strong>
                <span>{t("workspaceGate.restartRequiredDetail")}</span>
              </div>
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
              <div
                className="workspace-gate__platforms"
                role="tablist"
                aria-label={t("workspaceGate.selectPlatform")}
              >
                {platformOptions.map(({ id, icon: PlatformIcon }) => (
                  <button
                    key={id}
                    className="workspace-gate__platform"
                    type="button"
                    role="tab"
                    aria-selected={platform === id}
                    onClick={() => setPlatform(id)}
                  >
                    <PlatformIcon aria-hidden="true" />
                    {t(`workspaceGate.platforms.${id}`)}
                  </button>
                ))}
              </div>

              <div className="workspace-gate__packages" role="tabpanel">
                {platform === "windows" && (
                  <a
                    className="button workspace-gate__download workspace-gate__download--primary"
                    href={DOWNLOAD_URLS.windows}
                    download
                    onClick={downloadStarted}
                  >
                    <FaMicrosoft aria-hidden="true" />
                    <span>
                      <b>{t("workspaceGate.packages.windows")}</b>
                      <small>.exe</small>
                    </span>
                    <Download size={15} />
                  </a>
                )}

                {platform === "linux" && (
                  <>
                    <a
                      className="button workspace-gate__download workspace-gate__download--primary"
                      href={DOWNLOAD_URLS.linuxDeb}
                      download
                      onClick={downloadStarted}
                    >
                      <SiLinux aria-hidden="true" />
                      <span>
                        <b>{t("workspaceGate.packages.deb")}</b>
                        <small>Debian / Ubuntu</small>
                      </span>
                      <Download size={15} />
                    </a>
                    <a
                      className="button workspace-gate__download workspace-gate__download--primary"
                      href={DOWNLOAD_URLS.linuxRpm}
                      download
                      onClick={downloadStarted}
                    >
                      <SiLinux aria-hidden="true" />
                      <span>
                        <b>{t("workspaceGate.packages.rpm")}</b>
                        <small>Fedora / RHEL</small>
                      </span>
                      <Download size={15} />
                    </a>
                    <a className="workspace-gate__checksum" href={DOWNLOAD_URLS.linuxChecksums}>
                      <FileCheck2 size={13} />
                      {t("workspaceGate.sha256")}
                    </a>
                  </>
                )}

                {platform === "macos" && (
                  <>
                    <a
                      className="button workspace-gate__download workspace-gate__download--primary"
                      href={DOWNLOAD_URLS.macosPkg}
                      onClick={downloadStarted}
                    >
                      <SiApple aria-hidden="true" />
                      <span>
                        <b>{t("workspaceGate.packages.macosPkg")}</b>
                        <small>{t("workspaceGate.packages.macosPkgDetail")}</small>
                      </span>
                      <Download size={15} />
                    </a>
                    <a
                      className="button workspace-gate__download workspace-gate__download--primary"
                      href={DOWNLOAD_URLS.macosMobileconfig}
                      download
                      onClick={downloadStarted}
                    >
                      <SiApple aria-hidden="true" />
                      <span>
                        <b>{t("workspaceGate.packages.mobileconfig")}</b>
                        <small>{t("workspaceGate.packages.mobileconfigDetail")}</small>
                      </span>
                      <Download size={15} />
                    </a>
                    <div className="workspace-gate__package-links">
                      <a href={DOWNLOAD_URLS.macosUninstaller}>{t("workspaceGate.uninstaller")}</a>
                      <a href={DOWNLOAD_URLS.macosChecksums}>{t("workspaceGate.sha256")}</a>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="workspace-gate__actions">
            {!isChecking && !isDownloading && (
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
