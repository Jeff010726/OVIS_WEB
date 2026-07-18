#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work_dir="$(mktemp -d "${TMPDIR:-/tmp}/ovis-linux-installer-test.XXXXXX")"
chrome_dir="$work_dir/chrome"
edge_dir="$work_dir/edge"
export OVIS_POLICY_DIRS="$chrome_dir:$edge_dir"
export OVIS_POLICY_SOURCE="$root_dir/installer/policies/ovis-workspace-browser-policies.json"
export OVIS_SKIP_CONFLICT_CHECK=1
trap 'rm -rf "$work_dir"' EXIT

mkdir -p "$chrome_dir" "$edge_dir"
python3 "$root_dir/installer/linux/check-conflicts.py"

printf '%s\n' '{"WebUsbAllowDevicesForUrls": []}' >"$chrome_dir/existing-policy.json"
if python3 "$root_dir/installer/linux/check-conflicts.py" >/dev/null 2>&1; then
  echo "Conflict detection accepted a duplicate managed policy" >&2
  exit 1
fi
rm "$chrome_dir/existing-policy.json"

bash "$root_dir/installer/linux/install-policies.sh" install
bash "$root_dir/installer/linux/install-policies.sh" install
for directory in "$chrome_dir" "$edge_dir"; do
  cmp "$directory/ovis-workspace.json" "$OVIS_POLICY_SOURCE"
  [[ "$(stat -c '%a' "$directory/ovis-workspace.json")" == "644" ]]
  printf '%s\n' '{"HomepageLocation": "https://example.test"}' >"$directory/unrelated.json"
done

bash "$root_dir/installer/linux/install-policies.sh" uninstall
for directory in "$chrome_dir" "$edge_dir"; do
  [[ ! -e "$directory/ovis-workspace.json" ]]
  [[ -e "$directory/unrelated.json" ]]
done
