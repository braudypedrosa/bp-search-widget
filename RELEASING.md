# Releasing bp-search-widget

## Overview

This repository releases from the `main` branch using `scripts/release.sh`.

The script handles the version bump, release commit, git tag, push, and npm publish for `@braudypedrosa/bp-search-widget`.

## Versioning

This project uses semantic versioning:

- `patch`: update the last digit
  - example: `1.0.0 -> 1.0.1`
- `minor`: update the middle digit
  - example: `1.0.0 -> 1.1.0`
- `major`: update the first digit
  - example: `1.0.0 -> 2.0.0`

## Prerequisites

Before releasing:

- make sure you are on `main`
- make sure the working tree is clean
- make sure npm auth is valid with `npm whoami`
- make sure checks are passing:
  - `npm test`
  - `npx vite build`

## Pre-release Checklist

1. Commit the product changes you want in the release.
2. Confirm the release branch is `main`.
3. Confirm there are no uncommitted changes.
4. Run:
   - `npm test`
   - `npx vite build`
5. Confirm npm auth:
   - `npm whoami`

## Standard Release Commands

Use these commands for normal semantic version bumps:

```bash
npm run release -- patch
npm run release -- minor
npm run release -- major
```

What each command does:

- `patch`: bumps the last digit
- `minor`: bumps the middle digit
- `major`: bumps the first digit

## Exact Version Releases

If you need to release a specific version directly, use:

```bash
npm run release -- 1.2.3
```

This is useful when:

- you need to align a release with a predetermined version
- you need to rerun a release flow with an explicit semver target

## What the Release Script Does

`scripts/release.sh` performs these steps:

1. Verifies the argument is valid.
2. Verifies the current branch is `main`.
3. Verifies the working tree is clean.
4. Fetches `origin/main` and tags.
5. Rebases local `main` onto `origin/main`.
6. Runs `npm version` with the requested bump.
7. Creates the release commit:
   - `chore(release): x.y.z`
8. Creates the git tag:
   - `vx.y.z`
9. Pushes `main` and tags to `origin`.
10. Publishes the package to npm.

## Recommended Flow

Use this release sequence:

1. Commit the product work.
2. Run:
   - `npm test`
   - `npx vite build`
3. Run the release command:
   - `npm run release -- patch`
   - or `minor`
   - or `major`
4. Verify the release in git and npm.

## Verification

After the release completes, verify:

```bash
git status --short --branch
git log --oneline --decorate --max-count=5
git tag --list
npm view @braudypedrosa/bp-search-widget version
```

Expected results:

- `git status` is clean
- the release commit is present
- the new tag is present
- npm reports the new published version

## Failure Cases

Common issues:

- dirty working tree
  - fix: commit or stash changes before releasing
- wrong branch
  - fix: switch to `main`
- npm auth failure
  - fix: run `npm whoami` and refresh login/token before releasing
- publish succeeds but verification lags
  - fix: wait briefly and rerun `npm view @braudypedrosa/bp-search-widget version`
- rebase/push conflict
  - fix: re-sync `main`, resolve the conflict cleanly, then rerun the release command

## Examples

Patch release:

```bash
# 1.0.0 -> 1.0.1
npm run release -- patch
```

Minor release:

```bash
# 1.0.0 -> 1.1.0
npm run release -- minor
```

Major release:

```bash
# 1.0.0 -> 2.0.0
npm run release -- major
```

Exact version release:

```bash
npm run release -- 1.2.3
```
