#!/usr/bin/env bash
# Publish this repo to GitHub, tag it, and print the exact next actions.
#
#   tools/push-to-github.sh            # uses `gh` if present, else prints the git commands
#   REPO=device-agent tools/push-to-github.sh
#
# Nothing is pushed without an existing authenticated remote: this script never
# asks you for a token and never writes one to disk.

set -euo pipefail
cd "$(dirname "$0")/.."

REPO="${REPO:-device-agent}"
VIS="${VIS:-public}"
DESC="The agent that runs on your own hardware. Hash-chained receipts for every step, hard budget caps, deny-by-default tools."
TOPICS="ai-agent android on-device self-hosted llm mcp privacy accessibility local-first agents"

echo "→ running the gate before anything leaves the machine"
npm test >/dev/null
node apps/cli/index.js --mock --yes --data /tmp/pushcheck --root . "what is in this repo" >/dev/null
node apps/cli/index.js --verify --data /tmp/pushcheck >/dev/null
node tools/demo-denial.js >/dev/null
echo "  tests + demo + chain verify + denial demo: green"

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  OWNER="$(gh api user --jq .login)"
  if gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
    echo "→ $OWNER/$REPO exists; pushing to it"
    git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$OWNER/$REPO.git"
  else
    echo "→ creating $OWNER/$REPO"
    gh repo create "$REPO" --"$VIS" --description "$DESC" --source . --remote origin --push
  fi
  gh repo edit --description "$DESC" --add-topic "$(echo "$TOPICS" | tr ' ' ',')" >/dev/null || true
  git push -u origin HEAD
  git push origin --tags
  echo
  echo "→ done. next:"
  echo "  1. set the social preview image to docs/demo.png (Settings → Social preview)"
  echo "  2. file the ten issues in docs/GOOD-FIRST-ISSUES.md with the 'good first issue' label"
  echo "  3. post the Show HN text in docs/LAUNCH-POST.md, Tuesday–Thursday, 13:00–15:00 UTC"
  exit 0
fi

echo
echo "No authenticated 'gh'. Run these two lines yourself, then re-run this script:"
echo
echo "  git remote add origin https://github.com/<you>/$REPO.git"
echo "  git push -u origin HEAD && git push origin --tags"
echo
echo "Then, in the GitHub UI:"
echo "  • description: $DESC"
echo "  • topics:      $TOPICS"
echo "  • social preview: docs/demo.png"
