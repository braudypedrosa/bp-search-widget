import { afterEach, describe, expect, it, vi } from 'vitest';
import { BPSearchWidget } from '../bp-search-widget.js';

function setupDom() {
  document.body.innerHTML = '<div id="app"></div>';
  return document.querySelector('#app');
}

function createWidget(options = {}) {
  setupDom();
  return new BPSearchWidget('#app', {
    calendarOptions: {
      startDate: new Date('2030-01-01T00:00:00'),
      monthsToShow: 1,
      datepickerPlacement: 'auto',
    },
    ...options,
  });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('BPSearchWidget', () => {
  it('renders location, dates, filter, and search in the expected order', () => {
    const widget = createWidget({
      fields: [
        { label: 'Promo Code', type: 'input', position: 'start' },
        { label: 'Guests', type: 'select', options: ['1', '2'], position: 'end' },
      ],
    });

    const order = Array.from(document.querySelector('.bp-search-widget__bar').children)
      .filter((element) => !element.classList.contains('bp-search-widget__divider'))
      .map((element) => element.getAttribute('data-section') || element.getAttribute('data-action'));

    expect(order).toEqual(['location', 'custom', 'dates', 'custom', 'filter', 'search']);
    widget.destroy();
  });

  it('auto-generates default keys from labels', () => {
    const widget = createWidget({
      fields: [{ label: 'Promo Code', type: 'input' }],
    });

    expect(widget.options.fields[0].key).toBe('bp-promo-code');
    widget.destroy();
  });

  it('rejects duplicate keys and invalid field configs', () => {
    expect(() => createWidget({
      fields: [
        { label: 'Guests', type: 'select', options: ['1'] },
        { label: 'Guests', type: 'input' },
      ],
    })).toThrow(/Duplicate field key/);

    expect(() => createWidget({
      fields: [{ label: 'Pets', type: 'checkbox' }],
    })).toThrow(/requires a non-empty options array/);
  });

  it('preserves declared order within start and end slots', () => {
    const widget = createWidget({
      fields: [
        { label: 'Promo Code', type: 'input', position: 'start' },
        { label: 'Campaign', type: 'input', position: 'start' },
        { label: 'Guests', type: 'select', options: ['1'], position: 'end' },
        { label: 'Pets', type: 'checkbox', options: ['Dog'], position: 'end' },
      ],
    });

    const labels = Array.from(document.querySelectorAll('.bp-search-widget__section--custom .bp-search-widget__label'))
      .map((element) => element.textContent);

    expect(labels).toEqual(['Promo Code', 'Campaign', 'Guests', 'Pets']);
    widget.destroy();
  });

  it('adds and removes fields while keeping slot order and state', () => {
    const widget = createWidget({
      fields: [{ label: 'Guests', type: 'select', options: ['1'], position: 'end' }],
    });

    widget.addField({ label: 'Promo Code', type: 'input', position: 'start' });
    widget.addField({ label: 'Pets', type: 'checkbox', options: ['Dog'], position: 'end' });

    const labelsAfterAdd = Array.from(document.querySelectorAll('.bp-search-widget__section--custom .bp-search-widget__label'))
      .map((element) => element.textContent);
    expect(labelsAfterAdd).toEqual(['Promo Code', 'Guests', 'Pets']);
    expect(widget.getValues().customFields).toEqual({
      'bp-guests': '',
      'bp-promo-code': '',
      'bp-pets': [],
    });

    widget.removeField('bp-guests');

    const labelsAfterRemove = Array.from(document.querySelectorAll('.bp-search-widget__section--custom .bp-search-widget__label'))
      .map((element) => element.textContent);
    expect(labelsAfterRemove).toEqual(['Promo Code', 'Pets']);
    expect(widget.getValues().customFields).toEqual({
      'bp-promo-code': '',
      'bp-pets': [],
    });

    widget.destroy();
  });

  it('updates fields without allowing key changes', () => {
    const widget = createWidget({
      fields: [{ label: 'Guests', type: 'select', options: ['1', '2'] }],
    });

    widget.setSingleChoiceValue('bp-guests', '2');
    widget.updateField('bp-guests', {
      label: 'Adults',
      options: ['2', '3', '4'],
    });

    expect(document.querySelector('.bp-search-widget__section--custom .bp-search-widget__label').textContent).toBe('Adults');
    expect(document.querySelector('.bp-search-widget__trigger-value').textContent).toBe('2');

    expect(() => widget.updateField('bp-guests', { key: 'bp-adults' })).toThrow(/immutable/);
    widget.destroy();
  });

  it('returns the expected payload shape from getValues', () => {
    const widget = createWidget({
      fields: [
        { label: 'Promo Code', type: 'input', position: 'start' },
        { label: 'Guests', type: 'select', options: ['1', '2'], position: 'end' },
      ],
    });

    document.querySelector('[data-role="location-input"]').value = 'Asheville';
    document.querySelector('[data-role="location-input"]').dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-role="custom-input"]').value = 'SAVE10';
    document.querySelector('[data-role="custom-input"]').dispatchEvent(new Event('input', { bubbles: true }));
    widget.setSingleChoiceValue('bp-guests', '2');
    widget.calendar.options.onRangeSelect({
      start: new Date('2030-01-10T00:00:00'),
      end: new Date('2030-01-14T00:00:00'),
    });

    expect(widget.getValues()).toEqual({
      location: 'Asheville',
      checkIn: '2030-01-10',
      checkOut: '2030-01-14',
      customFields: {
        'bp-promo-code': 'SAVE10',
        'bp-guests': '2',
      },
    });

    widget.destroy();
  });

  it('keeps search disabled until both dates are selected', () => {
    const onSearch = vi.fn();
    const widget = createWidget({ onSearch });
    const searchButton = document.querySelector('[data-action="search"]');

    expect(searchButton.disabled).toBe(true);
    searchButton.click();
    expect(onSearch).not.toHaveBeenCalled();

    widget.calendar.options.onRangeSelect({
      start: new Date('2030-01-10T00:00:00'),
      end: new Date('2030-01-12T00:00:00'),
    });

    expect(searchButton.disabled).toBe(false);
    searchButton.click();
    expect(onSearch).toHaveBeenCalledWith({
      location: '',
      checkIn: '2030-01-10',
      checkOut: '2030-01-12',
      customFields: {},
    }, widget);

    widget.destroy();
  });

  it('keeps search disabled until required custom fields are filled', () => {
    const onSearch = vi.fn();
    const widget = createWidget({
      onSearch,
      fields: [
        { label: 'Promo Code', type: 'input', position: 'start', required: true },
        { label: 'Guests', type: 'select', options: ['1', '2'], required: true },
        { label: 'Pets', type: 'checkbox', options: ['Dog', 'Cat'], required: true },
      ],
    });
    const searchButton = document.querySelector('[data-action="search"]');
    const promoInput = document.querySelector('[data-role="custom-input"]');

    widget.calendar.options.onRangeSelect({
      start: new Date('2030-01-10T00:00:00'),
      end: new Date('2030-01-12T00:00:00'),
    });
    expect(searchButton.disabled).toBe(true);

    promoInput.value = '   ';
    promoInput.dispatchEvent(new Event('input', { bubbles: true }));
    expect(searchButton.disabled).toBe(true);

    promoInput.value = 'SAVE10';
    promoInput.dispatchEvent(new Event('input', { bubbles: true }));
    expect(searchButton.disabled).toBe(true);

    widget.setSingleChoiceValue('bp-guests', '2');
    expect(searchButton.disabled).toBe(true);

    widget.toggleCheckboxValue('bp-pets', 'Dog');
    expect(searchButton.disabled).toBe(false);

    searchButton.click();
    expect(onSearch).toHaveBeenCalledWith({
      location: '',
      checkIn: '2030-01-10',
      checkOut: '2030-01-12',
      customFields: {
        'bp-promo-code': 'SAVE10',
        'bp-guests': '2',
        'bp-pets': ['Dog'],
      },
    }, widget);

    widget.destroy();
  });

  it('syncs date selection and clear events from the internal datepicker', () => {
    const widget = createWidget();

    widget.calendar.options.onRangeSelect({
      start: new Date('2030-01-10T00:00:00'),
      end: new Date('2030-01-13T00:00:00'),
    });

    expect(widget.getValues().checkIn).toBe('2030-01-10');
    expect(widget.getValues().checkOut).toBe('2030-01-13');

    widget.calendar.options.onRangeSelect({ start: null, end: null });

    expect(widget.getValues().checkIn).toBeNull();
    expect(widget.getValues().checkOut).toBeNull();
    expect(document.querySelector('[data-action="search"]').disabled).toBe(true);

    widget.destroy();
  });

  it('passes current values to the filter callback', () => {
    const onFilterClick = vi.fn();
    const widget = createWidget({
      onFilterClick,
      fields: [{ label: 'Guests', type: 'select', options: ['1', '2'] }],
    });

    document.querySelector('[data-role="location-input"]').value = 'Sedona';
    document.querySelector('[data-role="location-input"]').dispatchEvent(new Event('input', { bubbles: true }));
    widget.setSingleChoiceValue('bp-guests', '2');
    widget.calendar.options.onRangeSelect({
      start: new Date('2030-01-10T00:00:00'),
      end: new Date('2030-01-12T00:00:00'),
    });

    document.querySelector('[data-action="filter"]').click();

    expect(onFilterClick).toHaveBeenCalledWith({
      location: 'Sedona',
      checkIn: '2030-01-10',
      checkOut: '2030-01-12',
      customFields: {
        'bp-guests': '2',
      },
    }, widget);

    widget.destroy();
  });

  it('opens choice popovers, closes single-choice pickers, and keeps checkbox popovers open', () => {
    const widget = createWidget({
      fields: [
        { label: 'Guests', type: 'select', options: ['1', '2'] },
        { label: 'Pets', type: 'checkbox', options: ['Dog', 'Cat'] },
      ],
    });

    document.querySelector('[data-key="bp-guests"]').click();
    expect(document.querySelector('.bp-search-widget__popover')).not.toBeNull();

    document.querySelector('[data-action="select-option"][data-key="bp-guests"][data-value="2"]').click();
    expect(document.querySelector('.bp-search-widget__popover')).toBeNull();
    expect(document.querySelector('[data-key="bp-guests"] .bp-search-widget__trigger-value').textContent).toBe('2');

    document.querySelector('[data-key="bp-pets"]').click();
    document.querySelector('[data-action="toggle-checkbox"][data-key="bp-pets"][data-value="Dog"]').click();
    expect(document.querySelector('.bp-search-widget__popover')).not.toBeNull();
    expect(document.querySelector('[data-key="bp-pets"] .bp-search-widget__trigger-value').textContent).toBe('1 selected');

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bp-search-widget__popover')).toBeNull();

    document.querySelector('[data-key="bp-pets"]').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.bp-search-widget__popover')).toBeNull();

    widget.destroy();
  });

  it('closes an open choice popover when the datepicker is clicked', () => {
    const widget = createWidget({
      fields: [{ label: 'Guests', type: 'select', options: ['1', '2'] }],
    });

    document.querySelector('[data-key="bp-guests"]').click();
    expect(document.querySelector('.bp-search-widget__popover')).not.toBeNull();

    document.querySelector('.bp-calendar-datepicker-input').click();

    expect(document.querySelector('.bp-search-widget__popover')).toBeNull();
    widget.destroy();
  });

  it('recreates the internal calendar on updateOptions and preserves the selected range', () => {
    const widget = createWidget();
    const originalCalendar = widget.calendar;

    widget.calendar.options.onRangeSelect({
      start: new Date('2030-01-10T00:00:00'),
      end: new Date('2030-01-12T00:00:00'),
    });

    widget.updateOptions({
      calendarOptions: {
        startDate: new Date('2030-02-01T00:00:00'),
        monthsToShow: 2,
      },
    });

    expect(widget.calendar).not.toBe(originalCalendar);
    expect(widget.getValues().checkIn).toBe('2030-01-10');
    expect(widget.getValues().checkOut).toBe('2030-01-12');
    widget.destroy();
  });

  it('destroys DOM and calendar side effects cleanly', () => {
    const widget = createWidget({
      fields: [{ label: 'Pets', type: 'checkbox', options: ['Dog'] }],
    });

    document.querySelector('[data-key="bp-pets"]').click();
    expect(document.querySelector('.bp-calendar-tooltip')).not.toBeNull();

    widget.destroy();

    expect(document.querySelector('#app').innerHTML).toBe('');
    expect(document.querySelector('.bp-calendar-tooltip')).toBeNull();
  });
});
