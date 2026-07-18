Name:           ovis-workspace-support
Version:        1.0.0
Release:        1%{?dist}
Summary:        Managed browser policies for OVIS Workspace
License:        Proprietary
URL:            https://ovis.aimorelogy.com
BuildArch:      noarch
Requires:       python3

%description
Installs Google Chrome and Microsoft Edge policies for OVIS Workspace.
No service, extension, driver, or kernel module is installed.

%install
install -d %{buildroot}/usr/share/ovis-workspace
install -d %{buildroot}/usr/lib/ovis-workspace
install -m 0644 %{_sourcedir}/ovis-workspace-browser-policies.json \
  %{buildroot}/usr/share/ovis-workspace/ovis-workspace-browser-policies.json
install -m 0755 %{_sourcedir}/check-conflicts.py \
  %{buildroot}/usr/lib/ovis-workspace/check-conflicts.py
install -m 0755 %{_sourcedir}/install-policies.sh \
  %{buildroot}/usr/lib/ovis-workspace/install-policies

%pre
/usr/bin/python3 - <<'PY'
import json
import pathlib
import sys

keys = {
    "ManagedConfigurationPerOrigin",
    "WebAppInstallForceList",
    "WebUsbAllowDevicesForUrls",
}
problems = []
for directory_name in (
    "/etc/opt/chrome/policies/managed",
    "/etc/opt/edge/policies/managed",
):
    directory = pathlib.Path(directory_name)
    if not directory.is_dir():
        continue
    for path in sorted(directory.glob("*.json")):
        if path.name == "ovis-workspace.json":
            continue
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except Exception as error:
            problems.append(f"{path}: cannot validate file ({error})")
            continue
        duplicates = sorted(keys.intersection(value if isinstance(value, dict) else {}))
        if duplicates:
            problems.append(f"{path}: {', '.join(duplicates)}")
if problems:
    print("OVIS Workspace policy conflict detected:", file=sys.stderr)
    for problem in problems:
        print(f"  - {problem}", file=sys.stderr)
    raise SystemExit(1)
PY

%post
/usr/lib/ovis-workspace/install-policies install

%preun
if [ "$1" -eq 0 ]; then
  /usr/lib/ovis-workspace/install-policies uninstall
fi

%files
%dir /usr/share/ovis-workspace
%dir /usr/lib/ovis-workspace
%attr(0644,root,root) /usr/share/ovis-workspace/ovis-workspace-browser-policies.json
%attr(0755,root,root) /usr/lib/ovis-workspace/check-conflicts.py
%attr(0755,root,root) /usr/lib/ovis-workspace/install-policies

%changelog
* Sat Jul 18 2026 Aimorelogy <support@aimorelogy.com> - 1.0.0-1
- Initial Linux support package
