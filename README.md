# bp-search-widget

A framework-agnostic vacation rental search widget powered by [`@braudypedrosa/bp-calendar`](https://www.npmjs.com/package/@braudypedrosa/bp-calendar).

Current version: **1.0.0**

## Features

- standalone JavaScript widget with no framework dependency
- compact pill-style search bar with a filter modal
- filter modal footer with Reset and Apply actions
- active-filter badge count on the filter button
- built-in `bp-calendar` datepicker integration
- Font Awesome Free icons bundled through the widget stylesheet
- custom Font Awesome icons for inline `fields`
- runtime inline field management with `addField`, `removeField`, and `updateField`
- runtime filter management with `addFilter`, `removeFilter`, and `updateFilter`
- filter types: `input`, `select`, `checkbox`, `radio`, `counter`
- width-aware filter layout with up to 4 cards per row
- search callback with normalized `checkIn`, `checkOut`, inline field values, and filter values

## Installation

```bash
npm install @braudypedrosa/bp-search-widget @braudypedrosa/bp-calendar
```

## Usage

```js
import { BPSearchWidget } from '@braudypedrosa/bp-search-widget';
import '@braudypedrosa/bp-search-widget/styles';
import '@braudypedrosa/bp-calendar/styles';

const widget = new BPSearchWidget('#widget', {
  fields: [
    { label: 'Promo Code', type: 'input', position: 'start', icon: 'fa-solid fa-ticket' },
    { label: 'Guests', type: 'select', options: ['1', '2', '3', '4+'], position: 'end', required: true, icon: 'fa-solid fa-users' },
  ],
  filters: [
    { label: 'Bedrooms', type: 'counter', min: 1, max: 8, defaultValue: 2, width: '30%' },
    { label: 'View', type: 'select', options: ['Ocean', 'Garden', 'City'], width: '30%' },
    { label: 'Amenities', type: 'checkbox', options: ['Pool', 'Spa', 'Gym'] },
    { label: 'Property Type', type: 'radio', options: ['Villa', 'Cabin', 'Suite'] },
  ],
  calendarOptions: {
    monthsToShow: 2,
    datepickerPlacement: 'auto',
  },
  onSearch: (payload) => {
    console.log('search', payload);
  },
  onFilterClick: (payload) => {
    console.log('filter button clicked', payload);
  },
});
```

The visible date UI is a single combined field, but the widget output always exposes separate `checkIn` and `checkOut` values.

`@braudypedrosa/bp-search-widget/styles` pulls in Font Awesome Free internally, so you do not need a separate icon import.

## Browser Global

The module also registers globals on `window`:

- `window.BPSearchWidget`
- `window.BP_SearchWidget`

Example:

```html
<div id="widget"></div>
<script type="module">
  import '@braudypedrosa/bp-calendar/styles';
  import '@braudypedrosa/bp-search-widget/styles';
  import '@braudypedrosa/bp-search-widget';

  new window.BPSearchWidget('#widget', {
    fields: [
      { label: 'Guests', type: 'select', options: ['1', '2', '3', '4+'] },
    ],
    filters: [
      { label: 'Bedrooms', type: 'counter', min: 1, defaultValue: 2, width: '40%' },
      { label: 'View', type: 'select', options: ['Ocean', 'Garden'] },
    ],
    onSearch: (payload) => console.log(payload),
  });
</script>
```

## API

### Constructor

```js
new BPSearchWidget(container, options)
BP_SearchWidget(container, options)
```

- `container`: `HTMLElement | string`
- `options`: object

### Options

- `showLocation: boolean` default `true`
- `showFilterButton: boolean` default `true`
- `locationLabel: string` default `'Location'`
- `locationPlaceholder: string` default `'Where are you going?'`
- `dateLabel: string` default `'Dates'`
- `datePlaceholder: string` default `'Check in — Check out'`
- `fields: FieldDescriptor[]` default `[]`
- `filters: FilterDescriptor[]` default `[]`
- `calendarOptions: WidgetCalendarOptions` default `{ datepickerPlacement: 'auto' }`
- `onSearch: (payload, instance) => void`
- `onFilterClick: (payload, instance) => void`

`showFilterButton` only renders the icon when at least one filter is configured. Clicking the icon opens the filter modal and still calls `onFilterClick`. The modal Reset button clears filter values back to their empty or default state and keeps the modal open. The Apply button just closes the modal; it does not alter validation or trigger search. When filters are active, the filter button shows a badge with the number of active filter fields. `counter` filters only count toward the badge when they differ from their `defaultValue`.

### `FieldDescriptor`

```js
{
  label: string,
  type: 'input' | 'select' | 'checkbox' | 'radio',
  options?: string[] | Array<{ label: string, value: string }>,
  position?: 'start' | 'end',
  required?: boolean,
  key?: string,
  icon?: string
}
```

Rules:

- `options` is required for `select`, `checkbox`, and `radio`
- `position` defaults to `'end'`
- `required` defaults to `false`
- `key` defaults to `bp-${slugify(label)}`
- `icon` accepts a Font Awesome class string such as `'fa-solid fa-users'`
- `width` is not supported on inline `fields`
- `icon` is only supported on inline `fields`, not `filters`

### `FilterDescriptor`

```js
{
  label: string,
  type: 'input' | 'select' | 'checkbox' | 'radio' | 'counter',
  options?: string[] | Array<{ label: string, value: string }>,
  required?: boolean,
  key?: string,
  width?: number | `${number}%`,
  min?: number,
  max?: number,
  step?: number,
  defaultValue?: number
}
```

Rules:

- filters render in declaration order only
- `position` is not supported on filters
- up to 4 filters are placed in a row before wrapping
- `width` is optional and only supported on filters
- `width` accepts either a number or a percentage string such as `'30%'`
- within each row, explicit widths reserve space first and unset widths split the remaining space equally
- `options` is required for `select`, `checkbox`, and `radio`
- `counter` does not accept `options`
- `counter` defaults: `min = 0`, `max = Infinity`, `step = 1`, `defaultValue = min`

### `WidgetCalendarOptions`

The widget forwards these options to the internal `BPCalendar` instance:

- `startDate`
- `monthsToShow`
- `breakpoints`
- `dateConfig`
- `defaultMinDays`
- `tooltipLabel`
- `showTooltip`
- `showClearButton`
- `datepickerPlacement`

The widget always forces:

- `mode: 'datepicker'`
- an internal `onRangeSelect` handler that keeps widget state in sync

### Instance Methods

- `getValues()`
- `addField(fieldDescriptor)`
- `removeField(key)`
- `updateField(key, patch)`
- `addFilter(filterDescriptor)`
- `removeFilter(key)`
- `updateFilter(key, patch)`
- `updateOptions(newOptions)`
- `destroy()`

### `getValues()`

Returns:

```js
{
  location: string,
  checkIn: string | null,
  checkOut: string | null,
  customFields: Record<string, string | string[]>,
  filters: Record<string, string | string[] | number>
}
```

Search is enabled only when dates are selected and every required inline field and required filter has a value.

## Runtime Updates

```js
widget.addField({
  label: 'Promo Code',
  type: 'input',
  position: 'start',
});

widget.updateField('bp-guests', {
  label: 'Adults',
  options: ['1', '2', '3', '4', '5+'],
});

widget.addFilter({
  label: 'Bedrooms',
  type: 'counter',
  min: 1,
  max: 8,
  defaultValue: 2,
  width: '30%',
});

widget.updateFilter('bp-view', {
  label: 'Scenery',
  options: ['Ocean', 'Garden', 'City'],
});

widget.removeFilter('bp-amenities');
```

## Local Demo

This repo includes a demo page at [`index.html`](/Users/braudypedorsa/Projects/libraries/bp-search-widget/index.html).

Run it locally with:

```bash
npm install
npm run dev
```

## License

MIT
