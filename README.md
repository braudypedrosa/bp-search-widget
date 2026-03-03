# bp-search-widget

A framework-agnostic vacation rental search widget for stay searches, powered by `@braudypedrosa/bp-calendar`.

It combines destination, dates, inline fields, and optional filters into a single booking-style search bar with a polished modal filter experience.

## Highlights

- compact pill-style search bar
- integrated datepicker powered by `bp-calendar`
- built-in `select`, `checkbox`, `radio`, and `counter` fields
- optional filter modal with reset and apply actions
- active-filter badge on the filter button
- runtime field and filter updates through the public API

## Installation

```bash
npm install github:braudypedrosa/bp-search-widget @braudypedrosa/bp-calendar @fortawesome/fontawesome-free
```

## Usage

```js
import { BPSearchWidget } from '@braudypedrosa/bp-search-widget';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '@braudypedrosa/bp-calendar/styles';
import '@braudypedrosa/bp-search-widget/styles';

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
    console.log(payload);
  },
});
```

The date field is presented as a single control, while the payload always returns `checkIn` and `checkOut` separately.

## Browser global

The package also registers:

- `window.BPSearchWidget`
- `window.BP_SearchWidget`

## Options

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

## FieldDescriptor

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

Notes:

- `options` is required for `select`, `checkbox`, and `radio`
- `position` defaults to `'end'`
- `required` defaults to `false`
- `key` defaults to `bp-${slugify(label)}`
- `icon` accepts a Font Awesome class string

## FilterDescriptor

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

Notes:

- `width` is only supported on filters
- `options` is required for `select`, `checkbox`, and `radio`
- `counter` does not accept `options`
- `counter` defaults to `min = 0`, `max = Infinity`, `step = 1`, `defaultValue = min`

## Returned payload

```js
{
  location: string,
  checkIn: string | null,
  checkOut: string | null,
  customFields: Record<string, string | string[]>,
  filters: Record<string, string | string[] | number>
}
```

## API

- `getValues()`
- `addField(fieldDescriptor)`
- `removeField(key)`
- `updateField(key, patch)`
- `addFilter(filterDescriptor)`
- `removeFilter(key)`
- `updateFilter(key, patch)`
- `updateOptions(newOptions)`
- `destroy()`
