#!/usr/bin/env bash
set -euo pipefail

action="${1:-}"
policy_source="${OVIS_POLICY_SOURCE:-/usr/share/ovis-workspace/ovis-workspace-browser-policies.json}"
policy_dirs=(
  /etc/opt/chrome/policies/managed
  /etc/opt/edge/policies/managed
)

if [[ -n "${OVIS_POLICY_DIRS:-}" ]]; then
  IFS=: read -r -a policy_dirs <<<"$OVIS_POLICY_DIRS"
fi

case "$action" in
  install)
    if [[ "${OVIS_SKIP_CONFLICT_CHECK:-0}" != "1" ]]; then
      /usr/lib/ovis-workspace/check-conflicts.py
    fi
    for policy_dir in "${policy_dirs[@]}"; do
      if [[ "$(id -u)" == "0" ]]; then
        install -d -o root -g root -m 0755 "$policy_dir"
      else
        install -d -m 0755 "$policy_dir"
      fi
      temporary_policy="$(mktemp "$policy_dir/.ovis-workspace.json.XXXXXX")"
      trap 'rm -f "${temporary_policy:-}"' EXIT
      install -m 0644 "$policy_source" "$temporary_policy"
      if [[ "$(id -u)" == "0" ]]; then
        chown root:root "$temporary_policy"
      fi
      mv -f "$temporary_policy" "$policy_dir/ovis-workspace.json"
      trap - EXIT
    done
    echo "OVIS Workspace policies installed. Fully restart Chrome or Edge to apply them."
    ;;
  uninstall)
    for policy_dir in "${policy_dirs[@]}"; do
      rm -f "$policy_dir/ovis-workspace.json"
    done
    echo "OVIS Workspace policies removed. Fully restart Chrome or Edge to apply the change."
    ;;
  *)
    echo "Usage: $0 install|uninstall" >&2
    exit 2
    ;;
esac
