# bp-search-widget

A framework-agnostic vacation rental search widget powered by [`@braudypedrosa/bp-calendar`](https://www.npmjs.com/package/@braudypedrosa/bp-calendar).

Current version: **1.0.0**

## Features

- standalone JavaScript widget with no framework dependency
- compact pill-style layout inspired by the original `widget.html`
- built-in `bp-calendar` datepicker integration
- Font Awesome Free icons bundled through the widget stylesheet
- runtime custom field management with `addField`, `removeField`, and `updateField`
- field types: `input`, `select`, `checkbox`, `radio`
- per-field `required` support for custom search gating
- search callback with normalized `checkIn` and `checkOut` values

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
    { label: 'Guests', type: 'select', options: ['1', '2', '3', '4+'], position: 'end', required: true },
    { label: 'Pets', type: 'checkbox', options: ['Dog', 'Cat'], position: 'end' },
  ],
  calendarOptions: {
    monthsToShow: 2,
    datepickerPlacement: 'auto',
  },
  onSearch: (payload) => {
    console.log('search', payload);
  },
  onFilterClick: (payload) => {
    console.log('filter', payload);
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
- `calendarOptions: WidgetCalendarOptions` default `{ datepickerPlacement: 'auto' }`
- `onSearch: (payload, instance) => void`
- `onFilterClick: (payload, instance) => void`

### `FieldDescriptor`

```js
{
  label: string,
  type: 'input' | 'select' | 'checkbox' | 'radio',
  options?: string[] | Array<{ label: string, value: string }>,
  position?: 'start' | 'end',
  required?: boolean,
  key?: string
}
```

Rules:

- `checkIn` and `checkOut` come from the built-in datepicker field and are always present in the search payload
- `options` is required for `select`, `checkbox`, and `radio`
- `position` defaults to `'end'`
- `required` defaults to `false`
- `key` defaults to `bp-${slugify(label)}`
- Search is enabled only when dates are selected and every required custom field has a value

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
- `updateOptions(newOptions)`
- `destroy()`

### `getValues()`

Returns:

```js
{
  location: string,
  checkIn: string | null,
  checkOut: string | null,
  customFields: Record<string, string | string[]>
}
```

## Runtime Field Updates

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

widget.removeField('bp-pets');
```

## Local Demo

This repo includes a demo page at [`widget.html`](/Users/braudypedorsa/Projects/libraries/bp-search-widget/widget.html).

Run it locally with:

```bash
npm install
npm run dev
```

## License

MIT
