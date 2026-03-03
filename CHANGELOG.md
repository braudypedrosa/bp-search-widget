# Changelog

All notable changes to this project are documented in this file.

## [1.1.0] - 2026-03-04

### Added
- Added a self-contained compiled `./styles` export that bundles the shared `bp-ui-components` styles and embedded `bp-calendar` datepicker styles.
- Added CI workflow coverage for test and CSS build verification.

### Changed
- Replaced custom filter counter behavior with `BPUICounter`.
- Replaced search/select dropdown implementations with `BPUISelect`.
- Replaced modal checkbox and radio filter groups with shared `bp-ui-components` controls.
- Removed duplicated inline reset styles and now apply `.bp-widget-reset` at the widget root.
- Upgraded the local tooling baseline to Vite 7, Vitest 4, jsdom 28, and `sass-embedded` 1.97.3.
