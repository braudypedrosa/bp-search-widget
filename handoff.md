# bp-search-widget Handoff (Migration Guide)

This document summarizes the current branch changes and how downstream libraries using the older behavior should adapt.

## What Changed

### 1) New filter display mode support
- New option: `filterDisplayMode: 'modal' | 'left-slide'`
- Default remains `'modal'`
- `left-slide` renders filters in a left-anchored panel with stacked cards
- On mobile (`<= 640px`), `left-slide` falls back to modal presentation

### 2) Filter layout behavior differences by mode
- `modal` mode keeps row width logic (`width` values are validated per row)
- `left-slide` mode ignores `width` and stacks filters top-to-bottom (`100%` each)

### 3) Default generated key behavior changed (breaking)
- Previous default: `bp-${slugify(label)}`
- New default: `slugify(label)`
- If `key` is omitted, payload keys are now unprefixed (example: `guests` instead of `bp-guests`)

### 4) Filter panel UX refinements
- Left-slide backdrop no longer has link-like hover affordance (default cursor + no hover shift)
- Filter scroll area now uses a fully custom scrollbar (native scrollbar hidden)

## Impact for Downstream Integrations

### Breaking change to watch
If your consuming library reads payload keys that assume a `bp-` prefix, update mappings.

Old expectation:
- `payload.customFields['bp-guests']`
- `payload.filters['bp-bedrooms']`

New default behavior:
- `payload.customFields['guests']`
- `payload.filters['bedrooms']`

## Migration Options

### Option A (recommended): set explicit keys in widget config
Set `key` explicitly for every field/filter. This avoids future default-key coupling.

```js
const widget = new BPSearchWidget('#widget', {
  fields: [
    { label: 'Guests', type: 'select', options: ['1', '2'], key: 'bp-guests' },
  ],
  filters: [
    { label: 'Bedrooms', type: 'counter', min: 1, defaultValue: 2, key: 'bp-bedrooms' },
  ],
});
```

### Option B: adapt payload keys in consumer layer
Add a compatibility adapter before existing downstream logic.

```js
function addBpPrefixMap(values) {
  const prefixed = {};
  Object.keys(values || {}).forEach((key) => {
    prefixed[`bp-${key}`] = values[key];
  });
  return prefixed;
}

function normalizeWidgetPayloadForLegacy(payload) {
  return {
    ...payload,
    customFields: {
      ...addBpPrefixMap(payload.customFields),
      ...(payload.customFields || {}),
    },
    filters: {
      ...addBpPrefixMap(payload.filters),
      ...(payload.filters || {}),
    },
  };
}
```

## Integration Checklist
- Verify all consumer code paths reading payload field/filter keys
- Decide whether to enforce explicit `key` values upstream
- If using `left-slide`, verify desktop/mobile behavior parity in your host app
- If using filter `width`, confirm expected behavior in `left-slide` (stacked only)
- Re-run host app QA for filter interactions: open/close, apply/reset, escape/backdrop close

## Notes
- Public runtime APIs are unchanged (`addField`, `addFilter`, `updateOptions`, etc.)
- Existing explicit keys continue to work exactly as before
