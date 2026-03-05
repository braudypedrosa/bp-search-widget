# Changelog

## Unreleased

### Added

- `filterDisplayMode` option with `modal` (default) and `left-slide` variants
- left-slide filter panel mode with stacked top-to-bottom filter cards
- mobile fallback to modal presentation at `<= 640px` when `filterDisplayMode` is `left-slide`

### Changed

- filter width row validation now applies to `modal` mode only (`left-slide` ignores widths by design)
- auto-generated field/filter keys now default to `slugify(label)` (no `bp-` prefix)

## 1.0.0

Initial public release of `bp-search-widget`.

### Included

- booking-style search bar with destination and date fields
- inline custom fields for input, select, checkbox, and radio use cases
- modal filters with input, select, checkbox, radio, and counter controls
- built-in active-filter badge and reset/apply filter actions
- datepicker integration powered by `bp-calendar`
- runtime APIs for adding, removing, and updating fields and filters
