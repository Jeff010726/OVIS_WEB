#!/bin/bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macOS installers must be built and notarized on macOS." >&2
  exit 1
fi

: "${OVIS_INSTALLER_SIGN_IDENTITY:?Set OVIS_INSTALLER_SIGN_IDENTITY to a Developer ID Installer identity}"
: "${OVIS_NOTARY_PROFILE:?Set OVIS_NOTARY_PROFILE to an xcrun notarytool keychain profile}"

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="${OVIS_WORKSPACE_VERSION:-1.0.0}"
output_dir="${OVIS_MACOS_OUTPUT_DIR:-$root_dir/dist/installers/macos}"
work_dir="$(mktemp -d "${TMPDIR:-/tmp}/ovis-macos-installer.XXXXXX")"
payload_dir="$work_dir/payload"
support_dir="$payload_dir/Library/Application Support/Aimorelogy/OVIS Workspace"
component_pkg="$work_dir/ovis-workspace-component.pkg"
uninstaller_component="$work_dir/ovis-workspace-uninstaller-component.pkg"
installer="$output_dir/OVIS-Workspace-Support-$version.pkg"
uninstaller="$output_dir/OVIS-Workspace-Support-Uninstaller.pkg"
trap 'rm -rf "$work_dir"' EXIT

mkdir -p "$support_dir" "$output_dir"
install -m 0644 "$root_dir/installer/policies/ovis-workspace-browser-policies.json" \
  "$support_dir/ovis-workspace-browser-policies.json"

pkgbuild \
  --root "$payload_dir" \
  --scripts "$root_dir/installer/macos/scripts" \
  --identifier com.aimorelogy.ovis.workspace.support \
  --version "$version" \
  "$component_pkg"
productbuild \
  --package "$component_pkg" \
  --sign "$OVIS_INSTALLER_SIGN_IDENTITY" \
  "$installer"

pkgbuild \
  --nopayload \
  --scripts "$root_dir/installer/macos/uninstaller-scripts" \
  --identifier com.aimorelogy.ovis.workspace.support.uninstaller \
  --version "$version" \
  "$uninstaller_component"
productbuild \
  --package "$uninstaller_component" \
  --sign "$OVIS_INSTALLER_SIGN_IDENTITY" \
  "$uninstaller"

for package in "$installer" "$uninstaller"; do
  xcrun notarytool submit "$package" --keychain-profile "$OVIS_NOTARY_PROFILE" --wait
  xcrun stapler staple "$package"
  pkgutil --check-signature "$package"
  spctl --assess --type install --verbose=2 "$package"
done

(cd "$output_dir" && shasum -a 256 "$(basename "$installer")" "$(basename "$uninstaller")" > SHA256SUMS)
