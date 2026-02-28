import { BPCalendar } from '@braudypedrosa/bp-calendar';

const MAIN_FIELD_TYPES = new Set(['input', 'select', 'checkbox', 'radio']);
const FILTER_FIELD_TYPES = new Set(['input', 'select', 'checkbox', 'radio', 'counter']);
const CHOICE_FIELD_TYPES = new Set(['select', 'checkbox', 'radio']);
const ALLOWED_POSITIONS = new Set(['start', 'end']);
const CALENDAR_OPTION_KEYS = [
  'startDate',
  'monthsToShow',
  'breakpoints',
  'dateConfig',
  'defaultMinDays',
  'tooltipLabel',
  'showTooltip',
  'showClearButton',
  'datepickerPlacement',
];

class BPSearchWidget {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!this.container) {
      throw new Error('Container element not found');
    }

    this.calendar = null;
    this.elements = {};
    this.openPopover = null;
    this.isFilterPanelOpen = false;
    this.isDestroyed = false;
    this.boundHandleContainerCaptureClick = this.handleContainerCaptureClick.bind(this);
    this.boundHandleContainerClick = this.handleContainerClick.bind(this);
    this.boundHandleContainerInput = this.handleContainerInput.bind(this);
    this.boundHandleContainerFocusout = this.handleContainerFocusout.bind(this);
    this.boundHandleContainerKeydown = this.handleContainerKeydown.bind(this);
    this.boundHandleDocumentClick = this.handleDocumentClick.bind(this);
    this.boundHandleDocumentKeydown = this.handleDocumentKeydown.bind(this);
    this.boundHandleFilterLayoutScroll = this.handleFilterLayoutScroll.bind(this);
    this.lockedBodyOverflow = '';

    this.state = {
      location: '',
      checkIn: null,
      checkOut: null,
      customFields: {},
      filters: {},
    };

    this.options = this.normalizeOptions(options);
    this.state.customFields = this.buildFieldState(this.options.fields);
    this.state.filters = this.buildFilterState(this.options.filters);

    this.attachEventListeners();
    this.render();
  }

  normalizeOptions(options) {
    const normalizedFields = this.normalizeFields(options.fields || []);
    const normalizedFilters = this.normalizeFilters(options.filters || []);

    this.assertUniqueCollectionKeys(normalizedFields, normalizedFilters);
    this.validateFilterWidths(normalizedFilters);

    return {
      showLocation: options.showLocation !== false,
      showFilterButton: options.showFilterButton !== false,
      locationLabel: typeof options.locationLabel === 'string' && options.locationLabel.trim()
        ? options.locationLabel.trim()
        : 'Location',
      locationPlaceholder: typeof options.locationPlaceholder === 'string'
        ? options.locationPlaceholder
        : 'Where are you going?',
      dateLabel: typeof options.dateLabel === 'string' && options.dateLabel.trim()
        ? options.dateLabel.trim()
        : 'Dates',
      datePlaceholder: typeof options.datePlaceholder === 'string' && options.datePlaceholder.trim()
        ? options.datePlaceholder.trim()
        : 'Check in — Check out',
      fields: normalizedFields,
      filters: normalizedFilters,
      calendarOptions: this.normalizeCalendarOptions(options.calendarOptions || {}),
      onSearch: typeof options.onSearch === 'function' ? options.onSearch : null,
      onFilterClick: typeof options.onFilterClick === 'function' ? options.onFilterClick : null,
    };
  }

  normalizeCalendarOptions(calendarOptions) {
    const normalized = {
      datepickerPlacement: 'auto',
    };

    CALENDAR_OPTION_KEYS.forEach((key) => {
      if (calendarOptions[key] !== undefined) {
        normalized[key] = calendarOptions[key];
      }
    });

    return normalized;
  }

  normalizeFields(fields) {
    if (!Array.isArray(fields)) {
      throw new Error('fields must be an array');
    }

    const seenKeys = new Set();

    return fields.map((field) => {
      const normalized = this.normalizeField(field);

      if (seenKeys.has(normalized.key)) {
        throw new Error(`Duplicate field key: ${normalized.key}`);
      }

      seenKeys.add(normalized.key);
      return normalized;
    });
  }

  normalizeFilters(filters) {
    if (!Array.isArray(filters)) {
      throw new Error('filters must be an array');
    }

    const seenKeys = new Set();

    return filters.map((filter) => {
      const normalized = this.normalizeFilter(filter);

      if (seenKeys.has(normalized.key)) {
        throw new Error(`Duplicate filter key: ${normalized.key}`);
      }

      seenKeys.add(normalized.key);
      return normalized;
    });
  }

  normalizeField(field) {
    const normalized = this.normalizeBaseDescriptor(field, MAIN_FIELD_TYPES, 'Field');

    if (field.width !== undefined) {
      throw new Error('width is only supported on filters');
    }

    const position = ALLOWED_POSITIONS.has(field.position) ? field.position : 'end';

    normalized.position = position;
    normalized.icon = this.normalizeFieldIcon(field.icon);
    normalized.options = CHOICE_FIELD_TYPES.has(normalized.type)
      ? this.normalizeFieldOptions(normalized.label, field.options)
      : [];

    return normalized;
  }

  normalizeFilter(filter) {
    const normalized = this.normalizeBaseDescriptor(filter, FILTER_FIELD_TYPES, 'Filter');

    if (filter.position !== undefined) {
      throw new Error(`Filter ${normalized.label} does not support position`);
    }

    if (filter.icon !== undefined) {
      throw new Error('icon is only supported on fields');
    }

    normalized.width = this.normalizeWidth(filter.width);

    if (normalized.type === 'counter') {
      if (filter.options !== undefined && (!Array.isArray(filter.options) || filter.options.length > 0)) {
        throw new Error(`${normalized.label} counter does not support options`);
      }

      normalized.options = [];
      normalized.min = this.normalizeCounterMin(filter.min);
      normalized.max = this.normalizeCounterMax(filter.max, normalized.min);
      normalized.step = this.normalizeCounterStep(filter.step);
      normalized.defaultValue = this.normalizeCounterValue(
        normalized,
        filter.defaultValue !== undefined ? filter.defaultValue : normalized.min,
        normalized.min,
      );
      return normalized;
    }

    normalized.options = CHOICE_FIELD_TYPES.has(normalized.type)
      ? this.normalizeFieldOptions(normalized.label, filter.options)
      : [];

    return normalized;
  }

  normalizeBaseDescriptor(field, allowedTypes, kindLabel) {
    if (!field || typeof field !== 'object') {
      throw new Error(`Each ${kindLabel.toLowerCase()} must be an object`);
    }

    const label = typeof field.label === 'string' ? field.label.trim() : '';
    if (!label) {
      throw new Error(`${kindLabel} label is required`);
    }

    const type = typeof field.type === 'string' ? field.type.trim() : '';
    if (!allowedTypes.has(type)) {
      throw new Error(`Unsupported ${kindLabel.toLowerCase()} type: ${type}`);
    }

    const key = typeof field.key === 'string' && field.key.trim()
      ? field.key.trim()
      : `bp-${this.slugifyLabel(label)}`;

    return {
      label,
      type,
      key,
      required: field.required === true,
    };
  }

  normalizeFieldOptions(label, options) {
    if (!Array.isArray(options) || options.length === 0) {
      throw new Error(`${label} requires a non-empty options array`);
    }

    return options.map((option) => {
      if (typeof option === 'string') {
        return {
          label: option,
          value: option,
        };
      }

      if (!option || typeof option !== 'object') {
        throw new Error(`${label} has an invalid option`);
      }

      const optionLabel = option.label != null ? String(option.label) : '';
      const optionValue = option.value != null ? String(option.value) : '';

      if (!optionLabel || !optionValue) {
        throw new Error(`${label} options must include label and value`);
      }

      return {
        label: optionLabel,
        value: optionValue,
      };
    });
  }

  normalizeFieldIcon(icon) {
    if (icon === undefined || icon === null) {
      return null;
    }

    if (typeof icon !== 'string') {
      throw new Error('Field icon must be a non-empty string');
    }

    return icon.trim() ? icon.trim() : null;
  }

  normalizeWidth(width) {
    if (width === undefined || width === null || width === '') {
      return null;
    }

    let numericWidth = null;

    if (typeof width === 'number') {
      numericWidth = width;
    } else if (typeof width === 'string') {
      const trimmed = width.trim();
      if (!trimmed.endsWith('%')) {
        throw new Error(`Filter width must be a percentage, received: ${width}`);
      }

      numericWidth = Number.parseFloat(trimmed.slice(0, -1));
    }

    if (!Number.isFinite(numericWidth) || numericWidth <= 0 || numericWidth > 100) {
      throw new Error(`Filter width must be greater than 0 and at most 100, received: ${width}`);
    }

    return numericWidth;
  }

  normalizeCounterMin(value) {
    if (value === undefined) {
      return 0;
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      throw new Error(`Counter min must be a finite number, received: ${value}`);
    }

    return numericValue;
  }

  normalizeCounterMax(value, min) {
    if (value === undefined) {
      return Number.POSITIVE_INFINITY;
    }

    const numericValue = Number(value);
    if (!(Number.isFinite(numericValue) || numericValue === Number.POSITIVE_INFINITY)) {
      throw new Error(`Counter max must be a number, received: ${value}`);
    }

    if (numericValue < min) {
      throw new Error('Counter max must be greater than or equal to min');
    }

    return numericValue;
  }

  normalizeCounterStep(value) {
    if (value === undefined) {
      return 1;
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      throw new Error(`Counter step must be greater than 0, received: ${value}`);
    }

    return numericValue;
  }

  normalizeCounterValue(field, value, fallbackValue) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return this.normalizeCounterValue(field, fallbackValue, field.min);
    }

    const boundedValue = Math.min(field.max, Math.max(field.min, numericValue));
    const stepsFromMin = (boundedValue - field.min) / field.step;
    const snappedValue = field.min + (Math.round(stepsFromMin) * field.step);
    const normalizedValue = Math.min(field.max, Math.max(field.min, snappedValue));

    return this.roundCounterValue(normalizedValue);
  }

  roundCounterValue(value) {
    return Number.parseFloat(value.toFixed(6));
  }

  validateFilterWidths(filters) {
    for (let index = 0; index < filters.length; index += 4) {
      const row = filters.slice(index, index + 4);
      const explicitTotal = row.reduce((sum, field) => sum + (field.width || 0), 0);

      if (explicitTotal > 100.000001) {
        throw new Error(`Filter widths exceed 100% in row ${Math.floor(index / 4) + 1}`);
      }
    }
  }

  assertUniqueCollectionKeys(fields, filters) {
    const knownKeys = new Set(fields.map((field) => field.key));

    filters.forEach((filter) => {
      if (knownKeys.has(filter.key)) {
        throw new Error(`Duplicate key across fields and filters: ${filter.key}`);
      }

      knownKeys.add(filter.key);
    });
  }

  slugifyLabel(label) {
    return label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  buildFieldState(fields, previousState = this.state.customFields) {
    return this.buildCollectionState(fields, previousState, 'fields');
  }

  buildFilterState(filters, previousState = this.state.filters) {
    return this.buildCollectionState(filters, previousState, 'filters');
  }

  buildCollectionState(fields, previousState, collection) {
    const nextState = {};

    fields.forEach((field) => {
      nextState[field.key] = collection === 'filters'
        ? this.coerceFilterValue(field, previousState[field.key])
        : this.coerceFieldValue(field, previousState[field.key]);
    });

    return nextState;
  }

  coerceFieldValue(field, value) {
    if (field.type === 'checkbox') {
      if (!Array.isArray(value)) {
        return [];
      }

      const allowedValues = new Set(field.options.map((option) => option.value));
      return value.filter((entry) => allowedValues.has(entry));
    }

    if (field.type === 'select' || field.type === 'radio') {
      if (typeof value !== 'string') {
        return '';
      }

      const allowedValues = new Set(field.options.map((option) => option.value));
      return allowedValues.has(value) ? value : '';
    }

    return typeof value === 'string' ? value : '';
  }

  coerceFilterValue(field, value) {
    if (field.type === 'counter') {
      return this.normalizeCounterValue(field, value, field.defaultValue);
    }

    return this.coerceFieldValue(field, value);
  }

  attachEventListeners() {
    this.container.addEventListener('click', this.boundHandleContainerCaptureClick, true);
    this.container.addEventListener('click', this.boundHandleContainerClick);
    this.container.addEventListener('input', this.boundHandleContainerInput);
    this.container.addEventListener('focusout', this.boundHandleContainerFocusout);
    this.container.addEventListener('keydown', this.boundHandleContainerKeydown);
    document.addEventListener('click', this.boundHandleDocumentClick);
    document.addEventListener('keydown', this.boundHandleDocumentKeydown);
  }

  detachEventListeners() {
    this.container.removeEventListener('click', this.boundHandleContainerCaptureClick, true);
    this.container.removeEventListener('click', this.boundHandleContainerClick);
    this.container.removeEventListener('input', this.boundHandleContainerInput);
    this.container.removeEventListener('focusout', this.boundHandleContainerFocusout);
    this.container.removeEventListener('keydown', this.boundHandleContainerKeydown);
    document.removeEventListener('click', this.boundHandleDocumentClick);
    document.removeEventListener('keydown', this.boundHandleDocumentKeydown);
  }

  render() {
    const shouldKeepFilterPanelOpen = this.isFilterPanelOpen && this.shouldRenderFilterButton();

    this.destroyCalendar();
    this.closeChoicePopover();
    if (this.isFilterPanelOpen) {
      this.unlockBodyScroll();
    }
    this.elements = {};
    this.isFilterPanelOpen = false;

    this.container.innerHTML = '';
    this.container.classList.add('bp-search-widget-host');

    const root = this.createElement('div', 'bp-search-widget');
    const bar = this.createElement('div', 'bp-search-widget__bar');
    root.appendChild(bar);

    const sections = [];

    if (this.options.showLocation) {
      sections.push(this.renderLocationField());
    }

    this.getFieldsByPosition('start').forEach((field) => {
      sections.push(this.renderCustomField(field));
    });

    sections.push(this.renderDateField());

    this.getFieldsByPosition('end').forEach((field) => {
      sections.push(this.renderCustomField(field));
    });

    if (this.shouldRenderFilterButton()) {
      sections.push(this.renderFilterButton());
    }

    sections.forEach((section, index) => {
      bar.appendChild(section);
      if (index < sections.length - 1) {
        bar.appendChild(this.renderDivider());
      }
    });

    const searchButton = this.renderSearchButton();
    bar.appendChild(searchButton);

    this.elements.root = root;
    this.elements.bar = bar;
    this.elements.searchButton = searchButton;

    this.container.appendChild(root);

    if (shouldKeepFilterPanelOpen) {
      this.openFilterPanel();
    }

    this.mountCalendar();
    this.syncSearchDisabledState();
  }

  renderLocationField() {
    const section = this.createSectionBase('location');
    const icon = this.createIconWrapper(this.getLocationIcon());
    const content = this.createFieldContent();
    const label = this.createFieldLabel(this.options.locationLabel);
    const input = this.createElement('input', 'bp-search-widget__input');

    input.type = 'text';
    input.placeholder = this.options.locationPlaceholder;
    input.value = this.state.location;
    input.setAttribute('data-role', 'location-input');

    content.appendChild(label);
    content.appendChild(input);
    section.appendChild(icon);
    section.appendChild(content);

    return section;
  }

  renderDateField() {
    const section = this.createSectionBase('dates');
    const icon = this.createIconWrapper(this.getCalendarIcon());
    const content = this.createFieldContent();
    const label = this.createFieldLabel(this.options.dateLabel);
    const host = this.createElement('div', 'bp-search-widget__datepicker-host');

    host.setAttribute('data-role', 'datepicker-host');

    content.appendChild(label);
    content.appendChild(host);
    section.appendChild(icon);
    section.appendChild(content);

    this.elements.dateHost = host;
    this.elements.dateSection = section;

    return section;
  }

  renderCustomField(field) {
    if (field.type === 'input') {
      return this.renderInputField(field);
    }

    return this.renderChoiceField(field, 'fields');
  }

  renderInputField(field) {
    const section = this.createSectionBase('custom');
    const content = this.createFieldContent();
    const label = this.createFieldLabel(field.label);
    const input = this.createElement('input', 'bp-search-widget__input');
    const icon = field.icon ? this.createIconWrapper(this.getCustomFieldIcon(field.icon)) : null;

    input.type = 'text';
    input.placeholder = field.label;
    input.value = this.state.customFields[field.key];
    input.setAttribute('data-role', 'custom-input');
    input.setAttribute('data-key', field.key);

    content.appendChild(label);
    content.appendChild(input);
    if (icon) {
      section.classList.add('bp-search-widget__section--has-icon');
      section.appendChild(icon);
    }
    section.appendChild(content);
    section.setAttribute('data-field-key', field.key);

    return section;
  }

  renderChoiceField(field, collection) {
    const section = collection === 'fields'
      ? this.createSectionBase('custom')
      : this.createElement('div', 'bp-search-widget__filter-select');
    const trigger = this.createElement('button', 'bp-search-widget__trigger');
    const triggerValue = this.createElement('span', 'bp-search-widget__trigger-value', this.getFieldSummary(field, collection));
    const triggerChevron = this.createElement('span', 'bp-search-widget__trigger-chevron');

    trigger.type = 'button';
    trigger.setAttribute('data-action', 'toggle-popover');
    trigger.setAttribute('data-key', field.key);
    trigger.setAttribute('data-collection', collection);
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-haspopup', 'dialog');
    triggerChevron.innerHTML = this.getChevronIcon();

    if (collection === 'fields') {
      const content = this.createFieldContent();
      const label = this.createFieldLabel(field.label);
      const icon = field.icon ? this.createIconWrapper(this.getCustomFieldIcon(field.icon)) : null;

      content.appendChild(label);
      trigger.appendChild(triggerValue);
      trigger.appendChild(triggerChevron);
      content.appendChild(trigger);
      if (icon) {
        section.classList.add('bp-search-widget__section--has-icon');
        section.appendChild(icon);
      }
      section.appendChild(content);
      section.setAttribute('data-field-key', field.key);
      section.classList.add('bp-search-widget__section--choice');
      return section;
    }

    trigger.appendChild(triggerValue);
    trigger.appendChild(triggerChevron);
    section.appendChild(trigger);
    section.setAttribute('data-filter-popover-key', field.key);
    return section;
  }

  renderFilterButton() {
    const button = this.createElement('button', 'bp-search-widget__icon-button bp-search-widget__icon-button--filter');
    const activeFilterCount = this.getActiveFilterCount();
    button.type = 'button';
    button.setAttribute('data-action', 'filter');
    button.setAttribute('aria-label', this.getFilterButtonLabel(activeFilterCount));
    button.setAttribute('aria-expanded', String(this.isFilterPanelOpen));
    button.innerHTML = this.getFilterIcon();
    if (activeFilterCount > 0) {
      const badge = this.createElement('span', 'bp-search-widget__filter-badge', String(activeFilterCount));
      badge.setAttribute('data-role', 'filter-badge');
      button.appendChild(badge);
    }
    this.elements.filterButton = button;
    return button;
  }

  renderSearchButton() {
    const button = this.createElement('button', 'bp-search-widget__search-button');
    button.type = 'button';
    button.setAttribute('data-action', 'search');
    button.setAttribute('aria-label', 'Search');
    button.disabled = !this.canSubmitSearch();
    button.innerHTML = this.getSearchIcon();
    return button;
  }

  renderDivider() {
    return this.createElement('div', 'bp-search-widget__divider');
  }

  renderFilterPanel() {
    const panel = this.createElement('div', 'bp-search-widget__filter-panel');
    const backdrop = this.createElement('button', 'bp-search-widget__filter-backdrop');
    const dialog = this.createElement('div', 'bp-search-widget__filter-dialog');
    const header = this.createElement('div', 'bp-search-widget__filter-header');
    const title = this.createElement('h2', 'bp-search-widget__filter-title', 'Filters');
    const closeButton = this.createElement('button', 'bp-search-widget__filter-close');
    const layout = this.createElement('div', 'bp-search-widget__filter-layout');
    const footer = this.createElement('div', 'bp-search-widget__filter-footer');
    const resetButton = this.createElement('button', 'bp-search-widget__filter-reset', 'Reset');
    const applyButton = this.createElement('button', 'bp-search-widget__filter-apply', 'Apply');
    const rows = this.getFilterRows();

    panel.setAttribute('data-role', 'filter-panel');
    backdrop.type = 'button';
    backdrop.setAttribute('data-action', 'close-filter-panel');
    backdrop.setAttribute('data-role', 'filter-backdrop');
    backdrop.setAttribute('aria-label', 'Close filters');
    dialog.setAttribute('data-role', 'filter-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Filters');
    layout.setAttribute('data-role', 'filter-layout');
    closeButton.type = 'button';
    closeButton.setAttribute('data-action', 'close-filter-panel');
    closeButton.setAttribute('aria-label', 'Close filters');
    closeButton.innerHTML = this.getCloseIcon();
    resetButton.type = 'button';
    resetButton.setAttribute('data-action', 'reset-filters');
    applyButton.type = 'button';
    applyButton.setAttribute('data-action', 'apply-filters');
    layout.addEventListener('scroll', this.boundHandleFilterLayoutScroll);
    header.appendChild(title);
    header.appendChild(closeButton);
    footer.appendChild(resetButton);
    footer.appendChild(applyButton);

    rows.forEach((row) => {
      const rowElement = this.createElement('div', 'bp-search-widget__filter-row');

      row.forEach(({ field, width }) => {
        const card = this.renderFilterCard(field, width);
        rowElement.appendChild(card);
      });

      layout.appendChild(rowElement);
    });

    dialog.appendChild(header);
    dialog.appendChild(layout);
    dialog.appendChild(footer);
    panel.appendChild(backdrop);
    panel.appendChild(dialog);
    this.elements.filterDialog = dialog;
    this.elements.filterLayout = layout;
    this.elements.filterResetButton = resetButton;
    this.elements.filterApplyButton = applyButton;
    this.elements.filterCloseButton = closeButton;
    return panel;
  }

  renderFilterCard(field, width) {
    const card = this.createElement('div', `bp-search-widget__filter-card bp-search-widget__filter-card--${field.type}`);
    const label = this.createFieldLabel(field.label);

    card.style.setProperty('--bp-filter-width', `${width}%`);
    card.setAttribute('data-filter-key', field.key);
    card.appendChild(label);

    if (field.type === 'input') {
      card.appendChild(this.renderFilterInput(field));
      return card;
    }

    if (field.type === 'select') {
      card.appendChild(this.renderChoiceField(field, 'filters'));
      return card;
    }

    if (field.type === 'checkbox' || field.type === 'radio') {
      card.appendChild(this.renderFilterChoiceGroup(field));
      return card;
    }

    card.appendChild(this.renderCounterControl(field));
    return card;
  }

  renderFilterInput(field) {
    const input = this.createElement('input', 'bp-search-widget__filter-input');

    input.type = 'text';
    input.placeholder = field.label;
    input.value = this.state.filters[field.key];
    input.setAttribute('data-role', 'filter-input');
    input.setAttribute('data-key', field.key);

    return input;
  }

  renderFilterChoiceGroup(field) {
    const group = this.createElement('div', 'bp-search-widget__filter-choices');

    field.options.forEach((option) => {
      const button = this.createElement('button', 'bp-search-widget__filter-choice');
      const isSelected = this.isOptionSelected(field, option.value, 'filters');

      button.type = 'button';
      button.textContent = option.label;
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('data-key', field.key);
      button.setAttribute('data-value', option.value);
      button.setAttribute('data-action', field.type === 'checkbox' ? 'toggle-filter-checkbox' : 'set-filter-radio');

      group.appendChild(button);
    });

    return group;
  }

  renderCounterControl(field) {
    const control = this.createElement('div', 'bp-search-widget__counter');
    const decrementButton = this.createElement('button', 'bp-search-widget__counter-button bp-search-widget__counter-button--decrement');
    const input = this.createElement('input', 'bp-search-widget__counter-input');
    const incrementButton = this.createElement('button', 'bp-search-widget__counter-button bp-search-widget__counter-button--increment');
    const currentValue = this.state.filters[field.key];

    decrementButton.type = 'button';
    decrementButton.setAttribute('data-action', 'decrement-filter-counter');
    decrementButton.setAttribute('data-key', field.key);
    decrementButton.setAttribute('aria-label', `Decrease ${field.label}`);
    decrementButton.innerHTML = this.getMinusIcon();
    decrementButton.disabled = currentValue <= field.min;

    input.type = 'number';
    input.value = String(currentValue);
    input.min = String(field.min);
    if (Number.isFinite(field.max)) {
      input.max = String(field.max);
    }
    input.step = String(field.step);
    input.setAttribute('data-role', 'filter-counter-input');
    input.setAttribute('data-key', field.key);
    input.setAttribute('aria-label', field.label);

    incrementButton.type = 'button';
    incrementButton.setAttribute('data-action', 'increment-filter-counter');
    incrementButton.setAttribute('data-key', field.key);
    incrementButton.setAttribute('aria-label', `Increase ${field.label}`);
    incrementButton.innerHTML = this.getPlusIcon();
    incrementButton.disabled = currentValue >= field.max;

    control.appendChild(decrementButton);
    control.appendChild(input);
    control.appendChild(incrementButton);

    return control;
  }

  createSectionBase(name) {
    const section = this.createElement('div', `bp-search-widget__section bp-search-widget__section--${name}`);
    section.setAttribute('data-section', name);
    return section;
  }

  createFieldContent() {
    return this.createElement('div', 'bp-search-widget__field-content');
  }

  createFieldLabel(text) {
    return this.createElement('div', 'bp-search-widget__label', text);
  }

  createIconWrapper(iconMarkup) {
    const wrapper = this.createElement('div', 'bp-search-widget__icon');
    wrapper.innerHTML = iconMarkup;
    return wrapper;
  }

  createElement(tag, className, textContent) {
    const element = document.createElement(tag);
    if (className) {
      element.className = className;
    }

    if (textContent !== undefined) {
      element.textContent = textContent;
    }

    return element;
  }

  shouldRenderFilterButton() {
    return this.options.showFilterButton && this.options.filters.length > 0;
  }

  getFieldsByPosition(position) {
    return this.options.fields.filter((field) => field.position === position);
  }

  getFieldByKey(key) {
    return this.options.fields.find((field) => field.key === key) || null;
  }

  getFilterByKey(key) {
    return this.options.filters.find((field) => field.key === key) || null;
  }

  getFieldSummary(field, collection = 'fields') {
    const values = collection === 'filters' ? this.state.filters : this.state.customFields;
    const value = values[field.key];

    if (field.type === 'checkbox') {
      if (!Array.isArray(value) || value.length === 0) {
        return 'Any';
      }

      return value.length === 1 ? '1 selected' : `${value.length} selected`;
    }

    if (field.type === 'select' || field.type === 'radio') {
      if (typeof value !== 'string' || !value) {
        return `Select ${field.label}`;
      }

      const option = field.options.find((entry) => entry.value === value);
      return option ? option.label : `Select ${field.label}`;
    }

    return '';
  }

  getFilterRows() {
    const rows = [];

    for (let index = 0; index < this.options.filters.length; index += 4) {
      const rowFields = this.options.filters.slice(index, index + 4);
      const explicitTotal = rowFields.reduce((sum, field) => sum + (field.width || 0), 0);
      const autoFields = rowFields.filter((field) => field.width == null);
      const autoWidth = autoFields.length > 0 ? (100 - explicitTotal) / autoFields.length : null;

      rows.push(rowFields.map((field) => ({
        field,
        width: field.width != null ? field.width : autoWidth,
      })));
    }

    return rows;
  }

  mountCalendar() {
    if (!this.elements.dateHost) {
      return;
    }

    const selectedRange = this.state.checkIn && this.state.checkOut
      ? {
          start: new Date(`${this.state.checkIn}T00:00:00`),
          end: new Date(`${this.state.checkOut}T00:00:00`),
        }
      : null;

    this.calendar = new BPCalendar(this.elements.dateHost, {
      ...this.options.calendarOptions,
      mode: 'datepicker',
      datepickerAnchorElement: this.elements.dateSection || null,
      selectedRange,
      onRangeSelect: (range) => this.handleCalendarRangeChange(range),
    });

    const dateInput = this.container.querySelector('.bp-calendar-datepicker-input');
    if (dateInput) {
      dateInput.placeholder = this.options.datePlaceholder;
      dateInput.setAttribute('aria-label', this.options.dateLabel);
    }
  }

  destroyCalendar() {
    if (this.calendar && typeof this.calendar.destroy === 'function') {
      this.calendar.destroy();
    }

    this.calendar = null;
  }

  handleCalendarRangeChange(range) {
    if (range?.start && range?.end) {
      this.state.checkIn = this.formatDate(range.start);
      this.state.checkOut = this.formatDate(range.end);
    } else {
      this.state.checkIn = null;
      this.state.checkOut = null;
    }

    this.syncSearchDisabledState();
  }

  handleContainerCaptureClick(event) {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (this.openPopover) {
      const owner = this.openPopover.owner
        || this.getChoiceOwnerElement(this.openPopover.collection, this.openPopover.key);
      const popover = this.openPopover.popover || null;

      if (
        owner
        && !owner.contains(target)
        && (!popover || !popover.contains(target))
      ) {
        this.closeChoicePopover();
      }
    }

    if (this.isFilterPanelOpen && this.isDatepickerTriggerClick(target)) {
      this.closeFilterPanel();
    }
  }

  handleContainerClick(event) {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    const searchButton = target.closest('[data-action="search"]');
    if (searchButton) {
      this.handleSearch();
      return;
    }

    const closeFilterPanelButton = target.closest('[data-action="close-filter-panel"]');
    if (closeFilterPanelButton) {
      this.closeFilterPanel();
      return;
    }

    const applyFiltersButton = target.closest('[data-action="apply-filters"]');
    if (applyFiltersButton) {
      this.closeFilterPanel();
      return;
    }

    const resetFiltersButton = target.closest('[data-action="reset-filters"]');
    if (resetFiltersButton) {
      this.resetFilters();
      return;
    }

    const filterButton = target.closest('[data-action="filter"]');
    if (filterButton) {
      this.handleFilterButtonClick();
      return;
    }

    const popoverTrigger = target.closest('[data-action="toggle-popover"]');
    if (popoverTrigger) {
      const key = popoverTrigger.getAttribute('data-key');
      const collection = popoverTrigger.getAttribute('data-collection') || 'fields';
      this.toggleChoicePopover(key, collection);
      return;
    }

    const selectOption = target.closest('[data-action="select-option"]');
    if (selectOption) {
      const key = selectOption.getAttribute('data-key');
      const value = selectOption.getAttribute('data-value') || '';
      const collection = selectOption.getAttribute('data-collection') || 'fields';
      this.setSingleChoiceValue(key, value, collection);
      return;
    }

    const checkboxOption = target.closest('[data-action="toggle-checkbox"]');
    if (checkboxOption) {
      const key = checkboxOption.getAttribute('data-key');
      const value = checkboxOption.getAttribute('data-value') || '';
      const collection = checkboxOption.getAttribute('data-collection') || 'fields';
      this.toggleCheckboxValue(key, value, collection);
      return;
    }

    const filterRadioOption = target.closest('[data-action="set-filter-radio"]');
    if (filterRadioOption) {
      const key = filterRadioOption.getAttribute('data-key');
      const value = filterRadioOption.getAttribute('data-value') || '';
      this.setSingleChoiceValue(key, value, 'filters');
      this.refreshFilterChoiceGroup(key);
      return;
    }

    const filterCheckboxOption = target.closest('[data-action="toggle-filter-checkbox"]');
    if (filterCheckboxOption) {
      const key = filterCheckboxOption.getAttribute('data-key');
      const value = filterCheckboxOption.getAttribute('data-value') || '';
      this.toggleCheckboxValue(key, value, 'filters');
      this.refreshFilterChoiceGroup(key);
      return;
    }

    const decrementCounterButton = target.closest('[data-action="decrement-filter-counter"]');
    if (decrementCounterButton) {
      const key = decrementCounterButton.getAttribute('data-key');
      this.adjustFilterCounter(key, -1);
      return;
    }

    const incrementCounterButton = target.closest('[data-action="increment-filter-counter"]');
    if (incrementCounterButton) {
      const key = incrementCounterButton.getAttribute('data-key');
      this.adjustFilterCounter(key, 1);
    }
  }

  handleContainerInput(event) {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.matches('[data-role="location-input"]')) {
      this.state.location = target.value;
      this.syncSearchDisabledState();
      return;
    }

    if (target.matches('[data-role="custom-input"]')) {
      const key = target.getAttribute('data-key');
      if (key) {
        this.state.customFields[key] = target.value;
        this.syncSearchDisabledState();
      }
      return;
    }

    if (target.matches('[data-role="filter-input"]')) {
      const key = target.getAttribute('data-key');
      if (key) {
        this.state.filters[key] = target.value;
        this.syncSearchDisabledState();
      }
      return;
    }

    if (target.matches('[data-role="filter-counter-input"]')) {
      const key = target.getAttribute('data-key');
      if (key) {
        this.commitCounterInput(key, target);
      }
    }
  }

  handleContainerFocusout(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.matches('[data-role="filter-counter-input"]')) {
      const key = target.getAttribute('data-key');
      if (key) {
        this.commitCounterInput(key, target);
      }
    }
  }

  handleContainerKeydown(event) {
    if (event.key !== 'Enter') {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (
      target.matches('.bp-search-widget__input')
      || target.matches('.bp-search-widget__filter-input')
      || target.matches('.bp-search-widget__counter-input')
    ) {
      event.preventDefault();
      this.handleSearch();
    }
  }

  handleDocumentClick(event) {
    if (!this.openPopover && !this.isFilterPanelOpen) {
      return;
    }

    if (typeof event.composedPath === 'function') {
      const path = event.composedPath();
      if (path.includes(this.container)) {
        return;
      }
    }

    const target = event.target;
    if (target instanceof Node && this.container.contains(target)) {
      return;
    }

    this.closeChoicePopover();
    this.closeFilterPanel();
  }

  handleFilterLayoutScroll() {
    if (this.openPopover && this.openPopover.collection === 'filters') {
      this.closeChoicePopover();
    }
  }

  handleDocumentKeydown(event) {
    if (event.key === 'Escape') {
      this.closeChoicePopover();
      this.closeFilterPanel();
    }
  }

  handleFilterButtonClick() {
    if (this.isFilterPanelOpen) {
      this.closeFilterPanel();
    } else {
      this.openFilterPanel();
    }

    if (this.options.onFilterClick) {
      this.options.onFilterClick(this.getValues(), this);
    }
  }

  toggleChoicePopover(key, collection = 'fields') {
    if (!key) {
      return;
    }

    if (
      this.openPopover
      && this.openPopover.key === key
      && this.openPopover.collection === collection
    ) {
      this.closeChoicePopover();
      return;
    }

    this.openChoicePopover(key, collection);
  }

  openChoicePopover(key, collection = 'fields') {
    const field = collection === 'filters' ? this.getFilterByKey(key) : this.getFieldByKey(key);
    if (!field) {
      return;
    }

    if (collection === 'filters' && field.type !== 'select') {
      return;
    }

    if (collection === 'fields' && !CHOICE_FIELD_TYPES.has(field.type)) {
      return;
    }

    this.closeChoicePopover();

    const owner = this.getChoiceOwnerElement(collection, key);
    if (!owner) {
      return;
    }

    const trigger = owner.querySelector('[data-action="toggle-popover"]');
    const popover = this.createChoicePopover(field, collection);

    if (collection === 'filters') {
      this.openFloatingFilterPopover(owner, popover);
    } else {
      owner.appendChild(popover);
    }
    owner.classList.add('is-open');
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'true');
    }

    this.openPopover = {
      key,
      collection,
      owner,
      popover,
    };
  }

  closeChoicePopover() {
    if (!this.openPopover) {
      return;
    }

    const owner = this.openPopover.owner
      || this.getChoiceOwnerElement(this.openPopover.collection, this.openPopover.key);
    if (owner) {
      const popover = this.openPopover.popover || owner.querySelector('.bp-search-widget__popover');
      const trigger = owner.querySelector('[data-action="toggle-popover"]');

      if (popover) {
        popover.remove();
      }

      if (trigger) {
        trigger.setAttribute('aria-expanded', 'false');
      }

      owner.classList.remove('is-open');
    }

    this.openPopover = null;
  }

  openFloatingFilterPopover(owner, popover) {
    const dialog = this.elements.filterDialog;
    if (!dialog) {
      owner.appendChild(popover);
      return;
    }
    popover.classList.add('bp-search-widget__popover--floating');
    dialog.appendChild(popover);
    this.positionFloatingFilterPopover(owner, popover, dialog);
  }

  positionFloatingFilterPopover(owner, popover, dialog = this.elements.filterDialog) {
    if (!dialog) {
      return;
    }

    const gap = 8;
    const viewportPadding = 16;
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const ownerRect = owner.getBoundingClientRect();
    const dialogRect = dialog.getBoundingClientRect();

    popover.style.left = `${Math.round(ownerRect.left - dialogRect.left)}px`;
    popover.style.width = `${Math.round(ownerRect.width)}px`;
    popover.style.top = '0px';
    popover.style.maxHeight = '';

    const popoverHeight = popover.getBoundingClientRect().height;
    const availableBelow = Math.max(0, viewportHeight - ownerRect.bottom - viewportPadding);
    const availableAbove = Math.max(0, ownerRect.top - viewportPadding);
    const shouldOpenAbove = popoverHeight > availableBelow && availableAbove > availableBelow;
    const availableSpace = shouldOpenAbove ? availableAbove : availableBelow;
    const maxHeight = Math.max(0, Math.floor(availableSpace));

    if (maxHeight > 0) {
      popover.style.maxHeight = `${maxHeight}px`;
    }

    const visiblePopoverHeight = popover.getBoundingClientRect().height;
    const popoverTop = shouldOpenAbove
      ? ownerRect.top - dialogRect.top - visiblePopoverHeight - gap
      : ownerRect.bottom - dialogRect.top + gap;

    popover.style.top = `${Math.round(Math.max(0, popoverTop))}px`;
    popover.classList.toggle('bp-search-widget__popover--above', shouldOpenAbove);
  }

  openFilterPanel() {
    if (this.isFilterPanelOpen || !this.shouldRenderFilterButton() || !this.elements.root) {
      return;
    }

    this.closeChoicePopover();
    this.hideDatepickerPopup();

    const panel = this.renderFilterPanel();
    this.elements.root.appendChild(panel);
    this.elements.filterPanel = panel;
    this.isFilterPanelOpen = true;
    this.lockBodyScroll();

    if (this.elements.filterButton) {
      this.elements.filterButton.setAttribute('aria-expanded', 'true');
    }

    if (this.elements.filterCloseButton) {
      this.elements.filterCloseButton.focus();
    }
  }

  closeFilterPanel() {
    if (!this.isFilterPanelOpen) {
      return;
    }

    this.closeChoicePopover();

    if (this.elements.filterPanel) {
      this.elements.filterPanel.remove();
      this.elements.filterPanel = null;
    }

    this.elements.filterDialog = null;
    this.elements.filterLayout = null;
    this.elements.filterResetButton = null;
    this.elements.filterApplyButton = null;
    this.elements.filterCloseButton = null;
    this.isFilterPanelOpen = false;
    this.unlockBodyScroll();

    if (this.elements.filterButton) {
      this.elements.filterButton.setAttribute('aria-expanded', 'false');
    }
  }

  createChoicePopover(field, collection = 'fields') {
    const popover = this.createElement('div', 'bp-search-widget__popover');
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', field.label);

    field.options.forEach((option) => {
      const button = this.createElement('button', 'bp-search-widget__choice-option');
      const label = this.createElement('span', 'bp-search-widget__choice-label', option.label);
      const indicator = this.createElement('span', 'bp-search-widget__choice-indicator');
      const isSelected = this.isOptionSelected(field, option.value, collection);

      button.type = 'button';
      button.setAttribute('data-key', field.key);
      button.setAttribute('data-value', option.value);
      button.setAttribute('data-collection', collection);
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('data-action', field.type === 'checkbox' ? 'toggle-checkbox' : 'select-option');

      if (field.type === 'checkbox') {
        indicator.innerHTML = isSelected ? this.getCheckboxCheckedIcon() : this.getCheckboxIcon();
      } else if (field.type === 'radio') {
        indicator.innerHTML = isSelected ? this.getRadioCheckedIcon() : this.getRadioIcon();
      } else {
        indicator.innerHTML = isSelected ? this.getCheckIcon() : '';
      }

      button.appendChild(label);
      button.appendChild(indicator);
      popover.appendChild(button);
    });

    return popover;
  }

  isOptionSelected(field, value, collection = 'fields') {
    const values = collection === 'filters' ? this.state.filters : this.state.customFields;
    const currentValue = values[field.key];

    if (field.type === 'checkbox') {
      return Array.isArray(currentValue) && currentValue.includes(value);
    }

    return currentValue === value;
  }

  setSingleChoiceValue(key, value, collection = 'fields') {
    const field = collection === 'filters' ? this.getFilterByKey(key) : this.getFieldByKey(key);
    if (!field) {
      return;
    }

    if (collection === 'filters') {
      this.state.filters[key] = value;
    } else {
      this.state.customFields[key] = value;
    }

    this.updateChoiceSummary(key, collection);
    this.syncSearchDisabledState();
    this.closeChoicePopover();
  }

  toggleCheckboxValue(key, value, collection = 'fields') {
    const field = collection === 'filters' ? this.getFilterByKey(key) : this.getFieldByKey(key);
    if (!field) {
      return;
    }

    const values = collection === 'filters' ? this.state.filters : this.state.customFields;
    const currentValue = Array.isArray(values[key]) ? [...values[key]] : [];
    const nextValue = currentValue.includes(value)
      ? currentValue.filter((entry) => entry !== value)
      : [...currentValue, value];

    values[key] = nextValue;
    this.updateChoiceSummary(key, collection);
    this.syncSearchDisabledState();

    if (collection === 'fields') {
      const owner = this.getChoiceOwnerElement(collection, key);
      if (!owner) {
        return;
      }

      const existingPopover = owner.querySelector('.bp-search-widget__popover');
      if (existingPopover) {
        const nextPopover = this.createChoicePopover(field, collection);
        existingPopover.replaceWith(nextPopover);

        if (this.openPopover && this.openPopover.collection === collection && this.openPopover.key === key) {
          this.openPopover.popover = nextPopover;
        }
      }
    }
  }

  updateChoiceSummary(key, collection = 'fields') {
    const field = collection === 'filters' ? this.getFilterByKey(key) : this.getFieldByKey(key);
    if (!field) {
      return;
    }

    const owner = this.getChoiceOwnerElement(collection, key);
    if (!owner) {
      return;
    }

    const summary = owner.querySelector('.bp-search-widget__trigger-value');
    if (summary) {
      summary.textContent = this.getFieldSummary(field, collection);
    }
  }

  refreshFilterChoiceGroup(key) {
    const filter = this.getFilterByKey(key);
    const card = this.getFilterCardElement(key);
    if (!filter || !card) {
      return;
    }

    const group = card.querySelector('.bp-search-widget__filter-choices');
    if (group) {
      group.replaceWith(this.renderFilterChoiceGroup(filter));
    }
  }

  adjustFilterCounter(key, direction) {
    const filter = this.getFilterByKey(key);
    if (!filter || filter.type !== 'counter') {
      return;
    }

    const currentValue = this.state.filters[key];
    const nextValue = this.normalizeCounterValue(
      filter,
      currentValue + (filter.step * direction),
      currentValue,
    );

    this.state.filters[key] = nextValue;
    this.updateCounterDisplay(key);
    this.syncSearchDisabledState();
  }

  commitCounterInput(key, input) {
    const filter = this.getFilterByKey(key);
    if (!filter || filter.type !== 'counter') {
      return;
    }

    const currentValue = this.state.filters[key];
    const nextValue = this.normalizeCounterValue(filter, input.value, currentValue);

    this.state.filters[key] = nextValue;
    this.updateCounterDisplay(key);
    this.syncSearchDisabledState();
  }

  resetFilters() {
    this.state.filters = this.buildFilterState(this.options.filters, {});
    this.render();
  }

  updateCounterDisplay(key) {
    const filter = this.getFilterByKey(key);
    const card = this.getFilterCardElement(key);
    if (!filter || !card) {
      return;
    }

    const currentValue = this.state.filters[key];
    const input = card.querySelector('[data-role="filter-counter-input"]');
    const decrementButton = card.querySelector('[data-action="decrement-filter-counter"]');
    const incrementButton = card.querySelector('[data-action="increment-filter-counter"]');

    if (input) {
      input.value = String(currentValue);
    }

    if (decrementButton) {
      decrementButton.disabled = currentValue <= filter.min;
    }

    if (incrementButton) {
      incrementButton.disabled = currentValue >= filter.max;
    }
  }

  handleSearch() {
    if (!this.canSubmitSearch()) {
      return;
    }

    if (this.options.onSearch) {
      this.options.onSearch(this.collectSearchPayload(), this);
    }
  }

  syncSearchDisabledState() {
    if (this.elements.searchButton) {
      this.elements.searchButton.disabled = !this.canSubmitSearch();
    }

    this.syncFilterButtonState();
  }

  syncFilterButtonState() {
    if (!this.elements.filterButton) {
      return;
    }

    const activeFilterCount = this.getActiveFilterCount();
    const button = this.elements.filterButton;
    const existingBadge = button.querySelector('[data-role="filter-badge"]');

    button.setAttribute('aria-label', this.getFilterButtonLabel(activeFilterCount));

    if (activeFilterCount <= 0) {
      if (existingBadge) {
        existingBadge.remove();
      }
      return;
    }

    if (existingBadge) {
      existingBadge.textContent = String(activeFilterCount);
      return;
    }

    const badge = this.createElement('span', 'bp-search-widget__filter-badge', String(activeFilterCount));
    badge.setAttribute('data-role', 'filter-badge');
    button.appendChild(badge);
  }

  hasValidDateRange() {
    return Boolean(this.state.checkIn && this.state.checkOut);
  }

  hasRequiredFieldsFilled() {
    return this.options.fields.every((field) => {
      if (!field.required) {
        return true;
      }

      return this.fieldHasValue(field, this.state.customFields[field.key]);
    });
  }

  hasRequiredFiltersFilled() {
    return this.options.filters.every((field) => {
      if (!field.required) {
        return true;
      }

      return this.fieldHasValue(field, this.state.filters[field.key]);
    });
  }

  fieldHasValue(field, value) {
    if (field.type === 'checkbox') {
      return Array.isArray(value) && value.length > 0;
    }

    if (field.type === 'select' || field.type === 'radio') {
      return typeof value === 'string' && value !== '';
    }

    if (field.type === 'counter') {
      return Number.isFinite(value) && value >= field.min && value <= field.max;
    }

    return typeof value === 'string' && value.trim() !== '';
  }

  isFilterActive(field, value) {
    if (field.type === 'counter') {
      return Number.isFinite(value) && value !== field.defaultValue;
    }

    return this.fieldHasValue(field, value);
  }

  getActiveFilterCount() {
    return this.options.filters.reduce((count, field) => (
      this.isFilterActive(field, this.state.filters[field.key]) ? count + 1 : count
    ), 0);
  }

  canSubmitSearch() {
    return this.hasValidDateRange() && this.hasRequiredFieldsFilled() && this.hasRequiredFiltersFilled();
  }

  collectSearchPayload() {
    return {
      location: this.state.location,
      checkIn: this.state.checkIn,
      checkOut: this.state.checkOut,
      customFields: this.cloneCustomFieldValues(),
      filters: this.cloneFilterValues(),
    };
  }

  cloneCustomFieldValues() {
    return this.cloneValueMap(this.state.customFields);
  }

  cloneFilterValues() {
    return this.cloneValueMap(this.state.filters);
  }

  cloneValueMap(values) {
    const cloned = {};

    Object.keys(values).forEach((key) => {
      const value = values[key];
      cloned[key] = Array.isArray(value) ? [...value] : value;
    });

    return cloned;
  }

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getValues() {
    return {
      location: this.state.location,
      checkIn: this.state.checkIn,
      checkOut: this.state.checkOut,
      customFields: this.cloneCustomFieldValues(),
      filters: this.cloneFilterValues(),
    };
  }

  addField(fieldDescriptor) {
    const normalizedField = this.normalizeField(fieldDescriptor);
    if (this.getFieldByKey(normalizedField.key) || this.getFilterByKey(normalizedField.key)) {
      throw new Error(`Duplicate field key: ${normalizedField.key}`);
    }

    this.options.fields = [...this.options.fields, normalizedField];
    this.state.customFields[normalizedField.key] = this.coerceFieldValue(normalizedField, undefined);
    this.render();
  }

  addFilter(filterDescriptor) {
    const normalizedFilter = this.normalizeFilter(filterDescriptor);
    if (this.getFilterByKey(normalizedFilter.key) || this.getFieldByKey(normalizedFilter.key)) {
      throw new Error(`Duplicate filter key: ${normalizedFilter.key}`);
    }

    const nextFilters = [...this.options.filters, normalizedFilter];
    this.validateFilterWidths(nextFilters);

    this.options.filters = nextFilters;
    this.state.filters[normalizedFilter.key] = this.coerceFilterValue(normalizedFilter, undefined);
    this.render();
  }

  removeField(key) {
    if (!this.getFieldByKey(key)) {
      return;
    }

    if (this.openPopover && this.openPopover.collection === 'fields' && this.openPopover.key === key) {
      this.closeChoicePopover();
    }

    this.options.fields = this.options.fields.filter((field) => field.key !== key);
    delete this.state.customFields[key];
    this.render();
  }

  removeFilter(key) {
    if (!this.getFilterByKey(key)) {
      return;
    }

    if (this.openPopover && this.openPopover.collection === 'filters' && this.openPopover.key === key) {
      this.closeChoicePopover();
    }

    this.options.filters = this.options.filters.filter((field) => field.key !== key);
    delete this.state.filters[key];
    this.render();
  }

  updateField(key, patch) {
    const existingField = this.getFieldByKey(key);
    if (!existingField) {
      throw new Error(`Unknown field key: ${key}`);
    }

    if (patch && patch.key !== undefined && patch.key !== key) {
      throw new Error('Field keys are immutable');
    }

    const mergedField = this.normalizeField({
      ...existingField,
      ...patch,
      key,
    });
    const nextFields = this.options.fields.map((field) => (field.key === key ? mergedField : field));

    this.options.fields = this.normalizeFields(nextFields);
    this.assertUniqueCollectionKeys(this.options.fields, this.options.filters);
    this.state.customFields[key] = this.coerceFieldValue(mergedField, this.state.customFields[key]);
    this.render();
  }

  updateFilter(key, patch) {
    const existingFilter = this.getFilterByKey(key);
    if (!existingFilter) {
      throw new Error(`Unknown filter key: ${key}`);
    }

    if (patch && patch.key !== undefined && patch.key !== key) {
      throw new Error('Filter keys are immutable');
    }

    const mergedFilter = this.normalizeFilter({
      ...existingFilter,
      ...patch,
      key,
    });
    const nextFilters = this.options.filters.map((field) => (field.key === key ? mergedFilter : field));

    this.validateFilterWidths(nextFilters);
    this.options.filters = this.normalizeFilters(nextFilters);
    this.assertUniqueCollectionKeys(this.options.fields, this.options.filters);
    this.state.filters[key] = this.coerceFilterValue(mergedFilter, this.state.filters[key]);
    this.render();
  }

  updateOptions(newOptions = {}) {
    const previousFieldState = this.cloneCustomFieldValues();
    const previousFilterState = this.cloneFilterValues();
    const previousLocation = this.state.location;
    const previousCheckIn = this.state.checkIn;
    const previousCheckOut = this.state.checkOut;

    const mergedOptions = {
      ...this.options,
      ...newOptions,
      fields: newOptions.fields !== undefined ? newOptions.fields : this.options.fields,
      filters: newOptions.filters !== undefined ? newOptions.filters : this.options.filters,
      calendarOptions: newOptions.calendarOptions !== undefined
        ? newOptions.calendarOptions
        : this.options.calendarOptions,
    };

    this.options = this.normalizeOptions(mergedOptions);
    this.state.location = previousLocation;
    this.state.checkIn = previousCheckIn;
    this.state.checkOut = previousCheckOut;
    this.state.customFields = this.buildFieldState(this.options.fields, previousFieldState);
    this.state.filters = this.buildFilterState(this.options.filters, previousFilterState);
    this.render();
  }

  destroy() {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;
    this.closeChoicePopover();
    this.closeFilterPanel();
    this.destroyCalendar();
    this.detachEventListeners();
    this.container.innerHTML = '';
  }

  getLocationIcon() {
    return this.getFaIconMarkup('fa-solid fa-location-dot');
  }

  getCalendarIcon() {
    return this.getFaIconMarkup('fa-solid fa-calendar-days');
  }

  getFilterIcon() {
    return this.getFaIconMarkup('fa-solid fa-sliders');
  }

  getFilterButtonLabel(activeFilterCount) {
    if (activeFilterCount <= 0) {
      return 'Open filters';
    }

    return `Open filters, ${activeFilterCount} active`;
  }

  getSearchIcon() {
    return this.getFaIconMarkup('fa-solid fa-magnifying-glass');
  }

  getCustomFieldIcon(className) {
    return this.getFaIconMarkup(className);
  }

  getChevronIcon() {
    return this.getFaIconMarkup('fa-solid fa-chevron-down');
  }

  getCheckIcon() {
    return this.getFaIconMarkup('fa-solid fa-check');
  }

  getCheckboxIcon() {
    return this.getFaIconMarkup('fa-regular fa-square');
  }

  getCheckboxCheckedIcon() {
    return this.getFaIconMarkup('fa-solid fa-square-check');
  }

  getRadioIcon() {
    return this.getFaIconMarkup('fa-regular fa-circle');
  }

  getRadioCheckedIcon() {
    return this.getFaIconMarkup('fa-solid fa-circle-dot');
  }

  getMinusIcon() {
    return this.getFaIconMarkup('fa-solid fa-minus');
  }

  getPlusIcon() {
    return this.getFaIconMarkup('fa-solid fa-plus');
  }

  getCloseIcon() {
    return this.getFaIconMarkup('fa-solid fa-xmark');
  }

  getFaIconMarkup(className) {
    return `<i class="${className}" aria-hidden="true"></i>`;
  }

  hideDatepickerPopup() {
    if (this.calendar && typeof this.calendar.hidePopup === 'function') {
      this.calendar.hidePopup();
    }
  }

  lockBodyScroll() {
    if (typeof document === 'undefined') {
      return;
    }

    this.lockedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  unlockBodyScroll() {
    if (typeof document === 'undefined') {
      return;
    }

    document.body.style.overflow = this.lockedBodyOverflow;
  }

  isDatepickerTriggerClick(target) {
    if (!(target instanceof Element)) {
      return false;
    }

    return Boolean(
      target.closest('[data-section="dates"]')
      || target.closest('.bp-calendar-datepicker-input')
      || target.closest('.bp-calendar-datepicker-wrapper'),
    );
  }

  getChoiceOwnerElement(collection, key) {
    const selector = collection === 'filters' ? '[data-filter-popover-key]' : '[data-field-key]';
    const attribute = collection === 'filters' ? 'data-filter-popover-key' : 'data-field-key';

    return Array.from(this.container.querySelectorAll(selector))
      .find((element) => element.getAttribute(attribute) === key) || null;
  }

  getFilterCardElement(key) {
    return Array.from(this.container.querySelectorAll('[data-filter-key]'))
      .find((element) => element.getAttribute('data-filter-key') === key) || null;
  }
}

function BP_SearchWidget(container, options = {}) {
  return new BPSearchWidget(container, options);
}

if (typeof window !== 'undefined') {
  window.BPSearchWidget = BPSearchWidget;
  window.BP_SearchWidget = BP_SearchWidget;
}

export { BPSearchWidget, BP_SearchWidget };
