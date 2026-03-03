# Releasing bp-search-widget (GitHub-only)

## Overview

Releases are now **GitHub-only**. There is no npm publish step.

A “release” is simply:

- a meaningful commit on `main`, pushed to GitHub, and
- (optionally) a version bump in the relevant files.

## Normal flow

1. **Commit your changes**
   - Make sure the working tree is clean.
   - Use a clear, descriptive commit message (e.g. `feat: add filter badge count`).

2. **Push to GitHub**
   - Ensure you are on `main`.
   - Push your branch:

     ```bash
     git push origin main
     ```

   - This is the primary “release” step; consumers will pull from GitHub.

3. **(Optional) Version bump**
   - If you want to tag a meaningful version (e.g. for change logs or external references), bump the version **manually** in all versioned files.
   - Currently, versioning lives in:
     - `package.json` → `version`
     - any other files that explicitly embed a version string (for example, docs or banners if you add them in the future).

   - Recommended pattern:

     ```bash
     # edit package.json version by hand
     git add package.json
     git commit -m "chore: bump version to x.y.z"
     git push origin main
     ```

   - Optionally create a lightweight git tag:

     ```bash
     git tag vX.Y.Z
     git push origin vX.Y.Z
     ```

## Checks (recommended but not enforced)

Before pushing:

- Run tests:

  ```bash
  npm test
  ```

- Build the library:

  ```bash
  npm run build
  ```

These steps are to catch issues early; they are not part of an automated publish flow anymore.

## Quick reference

- **Release** = commit on `main` + push to GitHub.
- **Version bump** = optional, manual edit of version fields, committed and pushed.
- **No npm publish** = consumers use GitHub (or a vendored copy) as the source of truth.
