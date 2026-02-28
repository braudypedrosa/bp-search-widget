#!/usr/bin/env bash
set -euo pipefail

BUMP="${1:-patch}"

is_valid_bump=false
case "$BUMP" in
  patch|minor|major)
    is_valid_bump=true
    ;;
esac

if [[ "$is_valid_bump" != "true" && ! "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  echo "Usage: npm run release -- [patch|minor|major|x.y.z]" >&2
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "Release must be run from main. Current branch: $CURRENT_BRANCH" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash changes before releasing." >&2
  exit 1
fi

git fetch origin main --tags
git pull --rebase origin main

if [[ "$is_valid_bump" == "true" ]]; then
  NEW_TAG="$(npm version "$BUMP" -m "chore(release): %s")"
else
  NEW_TAG="$(npm version --allow-same-version "$BUMP" -m "chore(release): %s")"
fi

git push origin main --follow-tags
npm publish

echo "Release complete: ${NEW_TAG#v}"
