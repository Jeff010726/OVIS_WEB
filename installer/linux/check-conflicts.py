#!/usr/bin/python3
"""Reject another managed policy file defining an OVIS-owned policy key."""

import json
import os
import pathlib
import sys

POLICY_KEYS = {
    "ManagedConfigurationPerOrigin",
    "WebAppInstallForceList",
    "WebUsbAllowDevicesForUrls",
}
DEFAULT_POLICY_DIRS = (
    "/etc/opt/chrome/policies/managed",
    "/etc/opt/edge/policies/managed",
)
OWN_POLICY_NAME = "ovis-workspace.json"


def policy_dirs():
    override = os.environ.get("OVIS_POLICY_DIRS")
    return override.split(os.pathsep) if override else DEFAULT_POLICY_DIRS


def main():
    conflicts = []
    parse_errors = []

    for directory_name in policy_dirs():
        directory = pathlib.Path(directory_name)
        if not directory.is_dir():
            continue

        for policy_path in sorted(directory.glob("*.json")):
            if policy_path.name == OWN_POLICY_NAME:
                continue
            try:
                document = json.loads(policy_path.read_text(encoding="utf-8"))
            except (OSError, UnicodeError, json.JSONDecodeError) as error:
                parse_errors.append(f"{policy_path}: {error}")
                continue

            if not isinstance(document, dict):
                continue
            duplicate_keys = sorted(POLICY_KEYS.intersection(document))
            if duplicate_keys:
                conflicts.append(f"{policy_path}: {', '.join(duplicate_keys)}")

    if parse_errors:
        print(
            "OVIS Workspace support was not installed because existing managed "
            "policy files could not be validated:",
            file=sys.stderr,
        )
        for error in parse_errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    if conflicts:
        print(
            "OVIS Workspace support was not installed because another managed "
            "policy file already defines an OVIS policy:",
            file=sys.stderr,
        )
        for conflict in conflicts:
            print(f"  - {conflict}", file=sys.stderr)
        print(
            "Remove or reconcile the conflicting policy with your administrator, "
            "then run the installer again.",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
