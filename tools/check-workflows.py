#!/usr/bin/env python3
"""Fail loudly if a workflow file is not valid YAML, or has lost its triggers.

Written after both workflows shipped unparseable: `with { ... }` without the
colon, and a step name containing an unquoted colon. GitHub rejects such a file
with a 0-second run and no logs, which reads like a silent failure rather than a
syntax error. This catches it in a second, on every push.

    python3 tools/check-workflows.py
"""
import glob
import sys

try:
    import yaml
except ImportError:
    print("pyyaml missing: pip install pyyaml", file=sys.stderr)
    sys.exit(2)

REQUIRED_TRIGGERS = {
    ".github/workflows/ci.yml": {"push", "pull_request", "workflow_dispatch"},
    ".github/workflows/build-apk.yml": {"push", "workflow_dispatch"},
}

bad = 0
for path in sorted(glob.glob(".github/workflows/*.yml")):
    name = path.replace("\\", "/")
    try:
        doc = yaml.safe_load(open(path, encoding="utf-8"))
    except Exception as exc:
        print(f"FAIL {name}: {exc}")
        bad += 1
        continue

    # YAML 1.1 turns the bare key `on` into True. Handle both so this script does
    # not itself become a source of false confidence.
    triggers = doc.get("on") or doc.get(True) or {}
    if isinstance(triggers, str):
        triggers = {triggers: None}
    got = set(triggers.keys())
    want = REQUIRED_TRIGGERS.get(name, set())

    problems = []
    if not doc.get("jobs"):
        problems.append("no jobs")
    if ":" in name and not got:
        problems.append("no triggers")
    missing = want - got
    if missing:
        problems.append(f"missing triggers: {sorted(missing)}")

    if problems:
        print(f"FAIL {name}: {'; '.join(problems)}")
        bad += 1
    else:
        jobs = ", ".join(doc["jobs"].keys())
        print(f"OK   {name}  triggers={sorted(got)}  jobs=[{jobs}]")

print(f"\n{len(glob.glob('.github/workflows/*.yml'))} workflow file(s), {bad} invalid")
sys.exit(1 if bad else 0)
