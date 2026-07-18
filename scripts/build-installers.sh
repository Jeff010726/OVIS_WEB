#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="${OVIS_WORKSPACE_VERSION:-1.0.0}"
output_dir="$root_dir/public/downloads"
work_dir="$(mktemp -d "${TMPDIR:-/tmp}/ovis-workspace-installers.XXXXXX")"
policy_source="$root_dir/installer/policies/ovis-workspace-browser-policies.json"
deb_name="ovis-workspace-support_${version}_all.deb"
rpm_name="ovis-workspace-support-${version}.noarch.rpm"
mobileconfig_name="OVIS-Workspace-Support.mobileconfig"
trap 'rm -rf "$work_dir"' EXIT

mkdir -p \
  "$output_dir" \
  "$work_dir/deb/DEBIAN" \
  "$work_dir/deb/usr/share/ovis-workspace" \
  "$work_dir/deb/usr/lib/ovis-workspace"

install -m 0644 "$root_dir/installer/linux/debian/control" "$work_dir/deb/DEBIAN/control"
install -m 0755 "$root_dir/installer/linux/check-conflicts.py" "$work_dir/deb/DEBIAN/preinst"
install -m 0755 "$root_dir/installer/linux/debian/postinst" "$work_dir/deb/DEBIAN/postinst"
install -m 0755 "$root_dir/installer/linux/debian/prerm" "$work_dir/deb/DEBIAN/prerm"
install -m 0644 "$policy_source" \
  "$work_dir/deb/usr/share/ovis-workspace/ovis-workspace-browser-policies.json"
install -m 0755 "$root_dir/installer/linux/check-conflicts.py" \
  "$work_dir/deb/usr/lib/ovis-workspace/check-conflicts.py"
install -m 0755 "$root_dir/installer/linux/install-policies.sh" \
  "$work_dir/deb/usr/lib/ovis-workspace/install-policies"
dpkg-deb --root-owner-group --build "$work_dir/deb" "$output_dir/$deb_name"

if ! command -v rpmbuild >/dev/null 2>&1; then
  echo "rpmbuild is required to produce $rpm_name" >&2
  exit 1
fi
mkdir -p "$work_dir/rpm"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}
install -m 0644 "$policy_source" "$work_dir/rpm/SOURCES/ovis-workspace-browser-policies.json"
install -m 0755 "$root_dir/installer/linux/check-conflicts.py" "$work_dir/rpm/SOURCES/check-conflicts.py"
install -m 0755 "$root_dir/installer/linux/install-policies.sh" "$work_dir/rpm/SOURCES/install-policies.sh"
install -m 0644 "$root_dir/installer/linux/rpm/ovis-workspace-support.spec" \
  "$work_dir/rpm/SPECS/ovis-workspace-support.spec"
rpmbuild -bb --define "_topdir $work_dir/rpm" \
  "$work_dir/rpm/SPECS/ovis-workspace-support.spec"
install -m 0644 "$(find "$work_dir/rpm/RPMS" -name '*.noarch.rpm' -print -quit)" \
  "$output_dir/$rpm_name"

install -m 0644 "$root_dir/installer/macos/OVIS-Workspace-Setup-v1.mobileconfig" \
  "$output_dir/$mobileconfig_name"

if ! command -v makensis >/dev/null 2>&1; then
  echo "makensis is required to build the Windows installer" >&2
  exit 1
fi
(
  cd "$root_dir/installer/windows"
  makensis -V2 ovis-workspace.nsi
)

(
  cd "$output_dir"
  sha256sum \
    OVIS-Workspace-Setup-v1.exe \
    "$deb_name" \
    "$rpm_name" \
    "$mobileconfig_name" \
    > SHA256SUMS
)
