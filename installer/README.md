# OVIS Workspace support packages

The files in this directory install the same three managed browser policies for
Google Chrome and Microsoft Edge:

- `WebUsbAllowDevicesForUrls`
- `WebAppInstallForceList`
- `ManagedConfigurationPerOrigin`

The canonical policy is
[`policies/ovis-workspace-browser-policies.json`](policies/ovis-workspace-browser-policies.json).
The managed configuration at
`https://ovis.aimorelogy.com/managed/ovis-workspace-policy-v1.json` is immutable.
Publish a new URL and hash when its schema changes.

## Linux

Run `npm run build:installers` on a system with `dpkg-deb`, `rpmbuild`, and
`makensis`. It produces:

- `ovis-workspace-support_1.0.0_all.deb`
- `ovis-workspace-support-1.0.0.noarch.rpm`
- `SHA256SUMS`

The DEB and RPM both scan all other JSON files in the Chrome and Edge managed
policy directories before installation. A duplicate OVIS-owned key or an
unreadable policy file aborts installation. The package then atomically writes
only `ovis-workspace.json`. Removal deletes only that file.

Published package repositories and RPM/DEB repository metadata must be signed
with Aimorelogy's release keys. The repository signing keys are intentionally
not stored in this source tree.

## macOS

`npm run build:installers:macos` must run on macOS with:

- `OVIS_INSTALLER_SIGN_IDENTITY`: a `Developer ID Installer` identity.
- `OVIS_NOTARY_PROFILE`: an `xcrun notarytool` keychain profile.
- Optional `OVIS_WORKSPACE_VERSION`, defaulting to `1.0.0`.

The build signs, notarizes, staples, and verifies both the installer and
uninstaller packages. The GitHub workflow
`build-macos-installers.yml` imports the installer certificate from repository
secrets and publishes verified packages as release assets.

Required repository secrets:

- `MACOS_INSTALLER_CERTIFICATE_P12_BASE64`
- `MACOS_INSTALLER_CERTIFICATE_PASSWORD`
- `MACOS_INSTALLER_SIGN_IDENTITY`
- `MACOS_BUILD_KEYCHAIN_PASSWORD`
- `APPLE_ID`
- `APPLE_TEAM_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`

The normal-user PKG merges only the three OVIS keys into Chrome and Edge
Managed Preferences and preserves unrelated settings. The mobileconfig is a
separate enterprise/MDM artifact and is not the default installation path.
