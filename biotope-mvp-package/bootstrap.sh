#!/usr/bin/env bash
# bootstrap.sh — initialize beads with the Biotope MVP issue seed
#
# Prerequisites:
#   - bd (beads CLI) installed: brew install beads
#   - Run from this package's root directory
#
# What this script does:
#   1. Initializes beads in the current directory (`bd init`) if not already
#   2. Imports each issue from issues.jsonl as a bd issue
#   3. Applies the `_blocked_by` dependency edges
#   4. Applies the `_parent` parent-child edges
#
# Idempotency: re-running is safe. Existing issues are skipped, missing edges
# are added.

set -euo pipefail

readonly PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly ISSUES_FILE="${PACKAGE_DIR}/issues.jsonl"

if ! command -v bd >/dev/null 2>&1; then
  echo "ERROR: bd (beads) is not installed."
  echo "  brew install beads"
  echo "  or: curl -fsSL https://raw.githubusercontent.com/gastownhall/beads/main/scripts/install.sh | bash"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is not installed. Install it from https://jqlang.github.io/jq/"
  exit 1
fi

if [[ ! -f "${ISSUES_FILE}" ]]; then
  echo "ERROR: ${ISSUES_FILE} not found"
  exit 1
fi

# 1. Initialize bd if needed
if [[ ! -d ".beads" ]]; then
  echo "==> bd init --prefix bd"
  bd init --prefix bd --quiet
else
  echo "==> bd already initialized in $(pwd) — skipping init"
fi

# 2. Import each issue
echo "==> Importing $(wc -l < "${ISSUES_FILE}" | tr -d ' ') issues from issues.jsonl"

while IFS= read -r line; do
  [[ -z "$line" ]] && continue

  id=$(echo "$line" | jq -r '.id')
  title=$(echo "$line" | jq -r '.title')
  description=$(echo "$line" | jq -r '.description')
  priority=$(echo "$line" | jq -r '.priority')
  issue_type=$(echo "$line" | jq -r '.issue_type')
  design=$(echo "$line" | jq -r '.design // empty')
  acceptance=$(echo "$line" | jq -r '.acceptance // empty')

  # Skip if already exists
  if bd show "$id" --json >/dev/null 2>&1; then
    continue
  fi

  # Create with the well-known ID. bd create normally generates the ID itself;
  # we use --id to honor the seed file's IDs so the dependency graph is stable.
  args=(create "$title"
        --id "$id"
        -p "$priority"
        -t "$issue_type"
        --description "$description")

  [[ -n "$design"     ]] && args+=(--design "$design")
  [[ -n "$acceptance" ]] && args+=(--acceptance "$acceptance")

  bd "${args[@]}" >/dev/null
  echo "  + $id  $title"
done < "${ISSUES_FILE}"

# 3. Apply parent-child edges
echo "==> Applying parent-child edges"
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  id=$(echo "$line" | jq -r '.id')
  parent=$(echo "$line" | jq -r '._parent // empty')
  [[ -z "$parent" ]] && continue
  bd dep add "$id" "$parent" --type parent-child >/dev/null 2>&1 || true
done < "${ISSUES_FILE}"

# 4. Apply blocking edges
echo "==> Applying blocking edges"
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  id=$(echo "$line" | jq -r '.id')
  blockers=$(echo "$line" | jq -r '._blocked_by[]? // empty')
  [[ -z "$blockers" ]] && continue
  while IFS= read -r blocker; do
    [[ -z "$blocker" ]] && continue
    bd dep add "$id" "$blocker" --type blocks >/dev/null 2>&1 || true
  done <<< "$blockers"
done < "${ISSUES_FILE}"

echo ""
echo "==> Done. Summary:"
bd list --status open --json | jq -r '"Open issues: " + (length | tostring)'

echo ""
echo "==> First ready tasks:"
bd ready --json | jq -r '.[0:5][] | "  \(.id)  P\(.priority)  \(.title)"' || true

echo ""
echo "Next steps:"
echo "  bd show bd-plat.1            # read the first task"
echo "  bd update bd-plat.1 --claim  # claim it to start work"
echo ""
echo "Read AGENTS.md for the full workflow."
