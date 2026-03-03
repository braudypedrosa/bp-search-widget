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

function selectDateRange(widget, start = '2030-01-10', end = '2030-01-12') {
  widget.calendar.options.onRangeSelect({
    start: new Date(`${start}T00:00:00`),
    end: new Date(`${end}T00:00:00`),
  });
}

function openFilters() {
  const button = document.querySelector('[data-action="filter"]');
  button.click();
  return document.querySelector('[data-role="filter-panel"]');
}

function createRect({ top, left, width, height }) {
  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON() {
      return this;
    },
  };
}

function getSelectRoot(key, collection = 'fields') {
  return document.querySelector(`[data-bp-search-widget-control="select"][data-collection="${collection}"][data-key="${key}"]`);
}

function openSelect(key, collection = 'fields') {
  const root = getSelectRoot(key, collection);
  root.querySelector('.bp-ui-select__trigger').click();
  return document.body.querySelector('.bp-ui-select__popover');
}

function chooseOpenSelectOption(value) {
  document.body.querySelector(`.bp-ui-select__popover .bp-ui-select__option[data-value="${value}"]`).click();
}

function getSelectPopover() {
  return document.body.querySelector('.bp-ui-select__popover');
}

function getVisibleSelectPopover() {
  return document.body.querySelector('.bp-ui-select__popover:not([hidden])');
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('BPSearchWidget', () => {
  it('renders location, dates, filter, and search in the expected order when filters exist', () => {
    const widget = createWidget({
      fields: [
        { label: 'Promo Code', type: 'input', position: 'start' },
        { label: 'Guests', type: 'select', options: ['1', '2'], position: 'end' },
      ],
      filters: [
        { label: 'Bedrooms', type: 'counter', min: 1, defaultValue: 1 },
      ],
    });

    const order = Array.from(document.querySelector('.bp-search-widget__bar').children)
      .filter((element) => !element.classList.contains('bp-search-widget__divider'))
      .map((element) => element.getAttribute('data-section') || element.getAttribute('data-action'));

    expect(order).toEqual(['location', 'custom', 'dates', 'custom', 'filter', 'search']);
    widget.destroy();
  });

  it('hides the filter button when no filters are configured', () => {
    const widget = createWidget({
      fields: [{ label: 'Guests', type: 'select', options: ['1', '2'] }],
    });

    expect(document.querySelector('[data-action="filter"]')).toBeNull();
    widget.destroy();
  });

  it('auto-generates default keys from labels for fields and filters', () => {
    const widget = createWidget({
      fields: [{ label: 'Promo Code', type: 'input' }],
      filters: [{ label: 'Stay Length', type: 'counter' }],
    });

    expect(widget.options.fields[0].key).toBe('bp-promo-code');
    expect(widget.options.filters[0].key).toBe('bp-stay-length');
    widget.destroy();
  });

  it('rejects duplicate keys and invalid field or filter configs', () => {
    expect(() => createWidget({
      fields: [
        { label: 'Guests', type: 'select', options: ['1'] },
        { label: 'Guests', type: 'input' },
      ],
    })).toThrow(/Duplicate field key/);

    expect(() => createWidget({
      fields: [{ label: 'Pets', type: 'checkbox' }],
    })).toThrow(/requires a non-empty options array/);

    expect(() => createWidget({
      fields: [{ label: 'Promo Code', type: 'input', width: '30%' }],
    })).toThrow(/width is only supported on filters/);

    expect(() => createWidget({
      filters: [{ label: 'Pets', type: 'checkbox', options: ['Dog'], position: 'end' }],
    })).toThrow(/does not support position/);

    expect(() => createWidget({
      filters: [{ label: 'View', type: 'select', options: ['Ocean'], icon: 'fa-solid fa-eye' }],
    })).toThrow(/icon is only supported on fields/);

    expect(() => createWidget({
      fields: [{ label: 'Guests', type: 'input', key: 'bp-shared' }],
      filters: [{ label: 'Adults', type: 'counter', key: 'bp-shared' }],
    })).toThrow(/Duplicate key across fields and filters/);
  });

  it('rejects filter rows that exceed 100 percent width', () => {
    expect(() => createWidget({
      filters: [
        { label: 'One', type: 'input', width: '60%' },
        { label: 'Two', type: 'input', width: '50%' },
      ],
    })).toThrow(/exceed 100%/);
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

  it('renders custom field icons for inline fields only', () => {
    const widget = createWidget({
      fields: [
        { label: 'Promo Code', type: 'input', position: 'start', icon: 'fa-solid fa-ticket' },
        { label: 'Guests', type: 'select', options: ['1', '2'], icon: 'fa-solid fa-users' },
      ],
    });

    expect(document.querySelector('[data-field-key="bp-promo-code"] .bp-search-widget__icon .fa-ticket')).not.toBeNull();
    expect(document.querySelector('[data-field-key="bp-guests"] .bp-search-widget__icon .fa-users')).not.toBeNull();

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

  it('adds, updates, and removes filters while preserving filter state', () => {
    const widget = createWidget({
      filters: [{ label: 'Bedrooms', type: 'counter', min: 1, defaultValue: 2 }],
    });

    widget.addFilter({ label: 'View', type: 'select', options: ['Ocean', 'Garden'], width: '30%' });
    widget.updateFilter('bp-view', { label: 'Scenery', options: ['Ocean', 'Garden', 'City'] });

    expect(widget.options.filters.map((field) => field.label)).toEqual(['Bedrooms', 'Scenery']);
    expect(widget.getValues().filters).toEqual({
      'bp-bedrooms': 2,
      'bp-view': '',
    });

    widget.removeFilter('bp-view');

    expect(widget.options.filters.map((field) => field.label)).toEqual(['Bedrooms']);
    expect(widget.getValues().filters).toEqual({
      'bp-bedrooms': 2,
    });

    expect(() => widget.updateFilter('bp-bedrooms', { key: 'bp-adults' })).toThrow(/immutable/);
    widget.destroy();
  });

  it('returns the expected payload shape from getValues', () => {
    const widget = createWidget({
      fields: [
        { label: 'Promo Code', type: 'input', position: 'start' },
        { label: 'Guests', type: 'select', options: ['1', '2'], position: 'end' },
      ],
      filters: [
        { label: 'Bedrooms', type: 'counter', min: 1, max: 5, defaultValue: 2 },
        { label: 'View', type: 'select', options: ['Ocean', 'Garden'] },
      ],
    });

    document.querySelector('[data-role="location-input"]').value = 'Asheville';
    document.querySelector('[data-role="location-input"]').dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-role="custom-input"]').value = 'SAVE10';
    document.querySelector('[data-role="custom-input"]').dispatchEvent(new Event('input', { bubbles: true }));
    widget.setSingleChoiceValue('bp-guests', '2');
    openFilters();
    widget.setSingleChoiceValue('bp-view', 'Ocean', 'filters');
    selectDateRange(widget, '2030-01-10', '2030-01-14');

    expect(widget.getValues()).toEqual({
      location: 'Asheville',
      checkIn: '2030-01-10',
      checkOut: '2030-01-14',
      customFields: {
        'bp-promo-code': 'SAVE10',
        'bp-guests': '2',
      },
      filters: {
        'bp-bedrooms': 2,
        'bp-view': 'Ocean',
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

    selectDateRange(widget);

    expect(searchButton.disabled).toBe(false);
    searchButton.click();
    expect(onSearch).toHaveBeenCalledWith({
      location: '',
      checkIn: '2030-01-10',
      checkOut: '2030-01-12',
      customFields: {},
      filters: {},
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

    selectDateRange(widget);
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
      filters: {},
    }, widget);

    widget.destroy();
  });

  it('keeps search disabled until required filters are filled', () => {
    const widget = createWidget({
      filters: [
        { label: 'Keyword', type: 'input', required: true },
        { label: 'View', type: 'select', options: ['Ocean', 'Garden'], required: true },
        { label: 'Amenities', type: 'checkbox', options: ['Pool', 'Spa'], required: true },
        { label: 'Property', type: 'radio', options: ['Villa', 'Cabin'], required: true },
        { label: 'Bedrooms', type: 'counter', min: 0, max: 4, defaultValue: 0, required: true },
      ],
    });

    selectDateRange(widget);
    openFilters();

    const searchButton = document.querySelector('[data-action="search"]');
    const keywordInput = document.querySelector('[data-role="filter-input"]');

    expect(searchButton.disabled).toBe(true);

    keywordInput.value = 'cliffside';
    keywordInput.dispatchEvent(new Event('input', { bubbles: true }));
    expect(searchButton.disabled).toBe(true);

    widget.setSingleChoiceValue('bp-view', 'Ocean', 'filters');
    expect(searchButton.disabled).toBe(true);

    widget.toggleCheckboxValue('bp-amenities', 'Pool', 'filters');
    expect(searchButton.disabled).toBe(true);

    widget.setSingleChoiceValue('bp-property', 'Villa', 'filters');
    expect(searchButton.disabled).toBe(false);

    widget.destroy();
  });

  it('syncs date selection and clear events from the internal datepicker', () => {
    const widget = createWidget();

    selectDateRange(widget, '2030-01-10', '2030-01-13');

    expect(widget.getValues().checkIn).toBe('2030-01-10');
    expect(widget.getValues().checkOut).toBe('2030-01-13');

    widget.calendar.options.onRangeSelect({ start: null, end: null });

    expect(widget.getValues().checkIn).toBeNull();
    expect(widget.getValues().checkOut).toBeNull();
    expect(document.querySelector('[data-action="search"]').disabled).toBe(true);

    widget.destroy();
  });

  it('opens the filter modal, locks scroll, and passes current values to the filter callback', () => {
    const onFilterClick = vi.fn();
    const widget = createWidget({
      onFilterClick,
      fields: [{ label: 'Guests', type: 'select', options: ['1', '2'] }],
      filters: [{ label: 'Bedrooms', type: 'counter', min: 1, max: 5, defaultValue: 2 }],
    });

    document.querySelector('[data-role="location-input"]').value = 'Sedona';
    document.querySelector('[data-role="location-input"]').dispatchEvent(new Event('input', { bubbles: true }));
    widget.setSingleChoiceValue('bp-guests', '2');
    selectDateRange(widget);

    const filterButton = document.querySelector('[data-action="filter"]');
    filterButton.click();

    expect(document.querySelector('[data-role="filter-panel"]')).not.toBeNull();
    expect(document.querySelector('[data-role="filter-dialog"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    expect(onFilterClick).toHaveBeenCalledWith({
      location: 'Sedona',
      checkIn: '2030-01-10',
      checkOut: '2030-01-12',
      customFields: {
        'bp-guests': '2',
      },
      filters: {
        'bp-bedrooms': 2,
      },
    }, widget);

    document.querySelector('[data-action="close-filter-panel"]').click();
    expect(document.querySelector('[data-role="filter-panel"]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(onFilterClick).toHaveBeenCalledTimes(1);

    widget.destroy();
  });

  it('closes the filter modal when Apply is clicked without changing submit validation', () => {
    const widget = createWidget({
      filters: [{ label: 'Keyword', type: 'input', required: true }],
    });

    selectDateRange(widget);
    expect(document.querySelector('[data-action="search"]').disabled).toBe(true);

    openFilters();
    expect(document.querySelector('[data-role="filter-panel"]')).not.toBeNull();

    document.querySelector('[data-action="apply-filters"]').click();
    expect(document.querySelector('[data-role="filter-panel"]')).toBeNull();
    expect(document.querySelector('[data-action="search"]').disabled).toBe(true);

    widget.destroy();
  });

  it('resets filter values, keeps the modal open, and clears validation state', () => {
    const widget = createWidget({
      filters: [
        { label: 'Keyword', type: 'input', required: true },
        { label: 'Budget', type: 'select', options: ['Under $200', '$200-$500'] },
        { label: 'Amenities', type: 'checkbox', options: ['Pool', 'Spa'] },
        { label: 'Bedrooms', type: 'counter', min: 1, max: 8, defaultValue: 2 },
      ],
    });

    selectDateRange(widget);
    openFilters();

    const keywordInput = document.querySelector('[data-role="filter-input"]');
    keywordInput.value = 'oceanfront';
    keywordInput.dispatchEvent(new Event('input', { bubbles: true }));

    widget.setSingleChoiceValue('bp-budget', 'Under $200', 'filters');
    widget.toggleCheckboxValue('bp-amenities', 'Pool', 'filters');
    document.querySelector('.bp-ui-counter__button--increment').click();

    expect(document.querySelector('[data-action="search"]').disabled).toBe(false);
    expect(document.querySelector('[data-role="filter-badge"]').textContent).toBe('4');

    document.querySelector('[data-action="reset-filters"]').click();

    expect(document.querySelector('[data-role="filter-panel"]')).not.toBeNull();
    expect(document.querySelector('[data-role="filter-input"]').value).toBe('');
    expect(document.querySelector('[data-filter-key="bp-budget"] .bp-ui-select__trigger-value').textContent).toBe('Select Budget');
    expect(document.querySelectorAll('.bp-ui-checkbox__option.is-selected')).toHaveLength(0);
    expect(document.querySelector('.bp-ui-counter__input').value).toBe('2');
    expect(document.querySelector('[data-action="search"]').disabled).toBe(true);
    expect(document.querySelector('[data-role="filter-badge"]')).toBeNull();

    widget.destroy();
  });

  it('shows an active-filter badge count on the filter button', () => {
    const widget = createWidget({
      filters: [
        { label: 'Bedrooms', type: 'counter', min: 1, max: 8, defaultValue: 2 },
        { label: 'Budget', type: 'select', options: ['Under $200', '$200-$500'] },
        { label: 'Amenities', type: 'checkbox', options: ['Pool', 'Spa'] },
        { label: 'Keyword', type: 'input' },
      ],
    });

    expect(document.querySelector('[data-role="filter-badge"]')).toBeNull();

    openFilters();
    widget.setSingleChoiceValue('bp-budget', 'Under $200', 'filters');
    expect(document.querySelector('[data-role="filter-badge"]').textContent).toBe('1');

    widget.toggleCheckboxValue('bp-amenities', 'Pool', 'filters');
    expect(document.querySelector('[data-role="filter-badge"]').textContent).toBe('2');

    const keywordInput = document.querySelector('[data-role="filter-input"]');
    keywordInput.value = 'oceanfront';
    keywordInput.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelector('[data-role="filter-badge"]').textContent).toBe('3');

    document.querySelector('.bp-ui-counter__button--increment').click();
    expect(document.querySelector('[data-role="filter-badge"]').textContent).toBe('4');

    document.querySelector('[data-action="apply-filters"]').click();
    expect(document.querySelector('[data-role="filter-panel"]')).toBeNull();
    expect(document.querySelector('[data-role="filter-badge"]').textContent).toBe('4');

    widget.destroy();
  });

  it('opens choice popovers, closes single-choice pickers, and keeps checkbox popovers open', () => {
    const widget = createWidget({
      fields: [
        { label: 'Guests', type: 'select', options: ['1', '2'] },
        { label: 'Pets', type: 'checkbox', options: ['Dog', 'Cat'] },
      ],
    });

    openSelect('bp-guests');
    expect(getVisibleSelectPopover()).not.toBeNull();

    chooseOpenSelectOption('2');
    expect(getVisibleSelectPopover()).toBeNull();
    expect(getSelectPopover()?.hasAttribute('hidden')).toBe(true);
    expect(getSelectRoot('bp-guests').querySelector('.bp-ui-select__trigger-value').textContent).toBe('2');

    document.querySelector('[data-key="bp-pets"]').click();
    document.querySelector('[data-action="toggle-checkbox"][data-key="bp-pets"][data-value="Dog"]').click();
    expect(document.querySelector('.bp-search-widget__popover')).not.toBeNull();
    expect(document.querySelector('[data-field-key="bp-pets"] .bp-search-widget__trigger-value').textContent).toBe('1 selected');

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bp-search-widget__popover')).toBeNull();

    document.querySelector('[data-key="bp-pets"]').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.bp-search-widget__popover')).toBeNull();

    widget.destroy();
  });

  it('opens and closes filter select popovers inside the panel', () => {
    const widget = createWidget({
      filters: [{ label: 'View', type: 'select', options: ['Ocean', 'Garden'] }],
    });

    openFilters();
    openSelect('bp-view', 'filters');
    expect(getVisibleSelectPopover()).not.toBeNull();
    expect(getSelectPopover().parentElement).toBe(document.body);

    chooseOpenSelectOption('Garden');

    expect(getVisibleSelectPopover()).toBeNull();
    expect(getSelectPopover()?.hasAttribute('hidden')).toBe(true);
    expect(getSelectRoot('bp-view', 'filters').querySelector('.bp-ui-select__trigger-value').textContent).toBe('Garden');

    widget.destroy();
  });

  it('keeps filter select popovers open when the modal body scrolls and reuses the shared select behavior', () => {
    const widget = createWidget({
      filters: [
        { label: 'View', type: 'select', options: ['Ocean', 'Garden'] },
        { label: 'Budget', type: 'select', options: ['Under $200', '$200-$500'] },
      ],
    });

    openFilters();
    openSelect('bp-budget', 'filters');
    expect(getVisibleSelectPopover()).not.toBeNull();

    document.querySelector('[data-role="filter-layout"]').dispatchEvent(new Event('scroll'));
    expect(getVisibleSelectPopover()).not.toBeNull();

    widget.destroy();
  });

  it('uses the shared select popover positioning when there is not enough room below', () => {
    const widget = createWidget({
      filters: [{ label: 'Budget', type: 'select', options: ['Under $200', '$200-$500', '$500+'] }],
    });
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function mockRect() {
      if (this.classList?.contains('bp-ui-select__trigger')) {
        return createRect({ top: 520, left: 24, width: 280, height: 52 });
      }

      if (this.classList?.contains('bp-ui-select__popover')) {
        return createRect({ top: 0, left: 0, width: 280, height: 180 });
      }

      return originalGetBoundingClientRect.call(this);
    });
    const innerHeightSpy = vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(640);

    openFilters();
    openSelect('bp-budget', 'filters');

    const popover = getVisibleSelectPopover();

    expect(popover).not.toBeNull();
    expect(getSelectRoot('bp-budget', 'filters').classList.contains('bp-ui-select--above')).toBe(true);
    expect(Number.parseInt(popover.style.top, 10)).toBe(332);

    innerHeightSpy.mockRestore();
    rectSpy.mockRestore();
    widget.destroy();
  });

  it('hides the datepicker popup when the filter modal opens', () => {
    const widget = createWidget({
      filters: [{ label: 'View', type: 'select', options: ['Ocean', 'Garden'] }],
    });

    const dateInput = document.querySelector('.bp-calendar-datepicker-input');
    const popup = document.querySelector('.bp-calendar-datepicker-popup');

    dateInput.click();
    expect(popup.style.display).toBe('block');

    openFilters();

    expect(document.querySelector('[data-role="filter-panel"]')).not.toBeNull();
    expect(popup.style.display).toBe('none');
    widget.destroy();
  });

  it('calculates per-row filter widths for mixed and auto sized filters', () => {
    const widget = createWidget({
      filters: [
        { label: 'One', type: 'input', width: '30%' },
        { label: 'Two', type: 'input', width: 30 },
        { label: 'Three', type: 'input' },
        { label: 'Four', type: 'input' },
        { label: 'Five', type: 'input', width: '50%' },
        { label: 'Six', type: 'input' },
      ],
    });

    openFilters();

    const cards = Array.from(document.querySelectorAll('.bp-search-widget__filter-card'));

    expect(cards[0].style.getPropertyValue('--bp-filter-width')).toBe('30%');
    expect(cards[1].style.getPropertyValue('--bp-filter-width')).toBe('30%');
    expect(cards[2].style.getPropertyValue('--bp-filter-width')).toBe('20%');
    expect(cards[3].style.getPropertyValue('--bp-filter-width')).toBe('20%');
    expect(cards[4].style.getPropertyValue('--bp-filter-width')).toBe('50%');
    expect(cards[5].style.getPropertyValue('--bp-filter-width')).toBe('50%');

    widget.destroy();
  });

  it('supports counter filters with defaults, step changes, bounds, and normalized input', () => {
    const widget = createWidget({
      filters: [{ label: 'Bedrooms', type: 'counter', min: 0, max: 6, step: 2, defaultValue: 2 }],
    });

    openFilters();

    const input = document.querySelector('.bp-ui-counter__input');
    const decrementButton = document.querySelector('.bp-ui-counter__button--decrement');
    const incrementButton = document.querySelector('.bp-ui-counter__button--increment');

    expect(input.value).toBe('2');

    incrementButton.click();
    expect(input.value).toBe('4');

    incrementButton.click();
    expect(input.value).toBe('6');
    expect(incrementButton.disabled).toBe(true);

    decrementButton.click();
    expect(input.value).toBe('4');

    input.value = '5';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    expect(input.value).toBe('6');

    input.value = '100';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    expect(input.value).toBe('6');

    widget.destroy();
  });

  it('recreates the internal calendar on updateOptions and preserves the selected range and filter state', () => {
    const widget = createWidget({
      filters: [{ label: 'View', type: 'select', options: ['Ocean', 'Garden'] }],
    });
    const originalCalendar = widget.calendar;

    selectDateRange(widget);
    widget.setSingleChoiceValue('bp-view', 'Garden', 'filters');

    widget.updateOptions({
      calendarOptions: {
        startDate: new Date('2030-02-01T00:00:00'),
        monthsToShow: 2,
      },
      filters: [{ label: 'Scenery', type: 'select', key: 'bp-view', options: ['Ocean', 'Garden', 'City'] }],
    });

    expect(widget.calendar).not.toBe(originalCalendar);
    expect(widget.getValues().checkIn).toBe('2030-01-10');
    expect(widget.getValues().checkOut).toBe('2030-01-12');
    expect(widget.getValues().filters).toEqual({
      'bp-view': 'Garden',
    });

    widget.destroy();
  });

  it('closes the filter modal and popovers on overlay click and escape', () => {
    const widget = createWidget({
      filters: [{ label: 'View', type: 'select', options: ['Ocean', 'Garden'] }],
    });

    openFilters();
    openSelect('bp-view', 'filters');
    expect(getVisibleSelectPopover()).not.toBeNull();

    document.querySelector('[data-role="filter-backdrop"]').click();
    expect(document.querySelector('[data-role="filter-panel"]')).toBeNull();
    expect(document.body.querySelector('.bp-ui-select__popover')).toBeNull();
    expect(document.body.style.overflow).toBe('');

    openFilters();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('[data-role="filter-panel"]')).toBeNull();
    expect(document.body.style.overflow).toBe('');

    widget.destroy();
  });

  it('destroys DOM and calendar side effects cleanly', () => {
    const widget = createWidget({
      fields: [{ label: 'Pets', type: 'checkbox', options: ['Dog'] }],
      filters: [{ label: 'Bedrooms', type: 'counter', min: 1, defaultValue: 2 }],
    });

    document.querySelector('[data-key="bp-pets"]').click();
    expect(document.querySelector('.bp-calendar-tooltip')).not.toBeNull();
    openFilters();

    widget.destroy();

    expect(document.querySelector('#app').innerHTML).toBe('');
    expect(document.querySelector('.bp-calendar-tooltip')).toBeNull();
  });
});
