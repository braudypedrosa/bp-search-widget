import { BPCalendar } from '@braudypedrosa/bp-calendar';

const ALLOWED_FIELD_TYPES = new Set(['input', 'select', 'checkbox', 'radio']);
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
    this.openPopoverKey = null;
    this.isDestroyed = false;
    this.boundHandleContainerCaptureClick = this.handleContainerCaptureClick.bind(this);
    this.boundHandleContainerClick = this.handleContainerClick.bind(this);
    this.boundHandleContainerInput = this.handleContainerInput.bind(this);
    this.boundHandleContainerKeydown = this.handleContainerKeydown.bind(this);
    this.boundHandleDocumentClick = this.handleDocumentClick.bind(this);
    this.boundHandleDocumentKeydown = this.handleDocumentKeydown.bind(this);

    this.state = {
      location: '',
      checkIn: null,
      checkOut: null,
      customFields: {},
    };

    this.options = this.normalizeOptions(options);
    this.state.customFields = this.buildFieldState(this.options.fields);

    this.attachEventListeners();
    this.render();
  }

  normalizeOptions(options) {
    const normalizedFields = this.normalizeFields(options.fields || []);

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

  normalizeField(field) {
    if (!field || typeof field !== 'object') {
      throw new Error('Each field must be an object');
    }

    const label = typeof field.label === 'string' ? field.label.trim() : '';
    if (!label) {
      throw new Error('Field label is required');
    }

    const type = typeof field.type === 'string' ? field.type.trim() : '';
    if (!ALLOWED_FIELD_TYPES.has(type)) {
      throw new Error(`Unsupported field type: ${type}`);
    }

    const key = typeof field.key === 'string' && field.key.trim()
      ? field.key.trim()
      : `bp-${this.slugifyLabel(label)}`;

    const position = ALLOWED_POSITIONS.has(field.position) ? field.position : 'end';
    const normalized = {
      label,
      type,
      key,
      position,
      required: field.required === true,
    };

    if (type === 'select' || type === 'checkbox' || type === 'radio') {
      normalized.options = this.normalizeFieldOptions(label, field.options);
    } else {
      normalized.options = [];
    }

    return normalized;
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

  slugifyLabel(label) {
    return label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  buildFieldState(fields, previousState = this.state.customFields) {
    const nextState = {};

    fields.forEach((field) => {
      nextState[field.key] = this.coerceFieldValue(field, previousState[field.key]);
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

  attachEventListeners() {
    this.container.addEventListener('click', this.boundHandleContainerCaptureClick, true);
    this.container.addEventListener('click', this.boundHandleContainerClick);
    this.container.addEventListener('input', this.boundHandleContainerInput);
    this.container.addEventListener('keydown', this.boundHandleContainerKeydown);
    document.addEventListener('click', this.boundHandleDocumentClick);
    document.addEventListener('keydown', this.boundHandleDocumentKeydown);
  }

  detachEventListeners() {
    this.container.removeEventListener('click', this.boundHandleContainerCaptureClick, true);
    this.container.removeEventListener('click', this.boundHandleContainerClick);
    this.container.removeEventListener('input', this.boundHandleContainerInput);
    this.container.removeEventListener('keydown', this.boundHandleContainerKeydown);
    document.removeEventListener('click', this.boundHandleDocumentClick);
    document.removeEventListener('keydown', this.boundHandleDocumentKeydown);
  }

  render() {
    this.destroyCalendar();
    this.closeChoicePopover();
    this.elements = {};

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

    if (this.options.showFilterButton) {
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

    return this.renderChoiceField(field);
  }

  renderInputField(field) {
    const section = this.createSectionBase('custom');
    const content = this.createFieldContent();
    const label = this.createFieldLabel(field.label);
    const input = this.createElement('input', 'bp-search-widget__input');

    input.type = 'text';
    input.placeholder = field.label;
    input.value = this.state.customFields[field.key];
    input.setAttribute('data-role', 'custom-input');
    input.setAttribute('data-key', field.key);

    content.appendChild(label);
    content.appendChild(input);
    section.appendChild(content);
    section.setAttribute('data-field-key', field.key);

    return section;
  }

  renderChoiceField(field) {
    const section = this.createSectionBase('custom');
    const content = this.createFieldContent();
    const label = this.createFieldLabel(field.label);
    const trigger = this.createElement('button', 'bp-search-widget__trigger');
    const triggerValue = this.createElement('span', 'bp-search-widget__trigger-value', this.getFieldSummary(field));
    const triggerChevron = this.createElement('span', 'bp-search-widget__trigger-chevron');

    trigger.type = 'button';
    trigger.setAttribute('data-action', 'toggle-popover');
    trigger.setAttribute('data-key', field.key);
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-haspopup', 'dialog');
    triggerChevron.innerHTML = this.getChevronIcon();

    content.appendChild(label);
    trigger.appendChild(triggerValue);
    trigger.appendChild(triggerChevron);
    content.appendChild(trigger);
    section.appendChild(content);
    section.setAttribute('data-field-key', field.key);
    section.classList.add('bp-search-widget__section--choice');

    return section;
  }

  renderFilterButton() {
    const button = this.createElement('button', 'bp-search-widget__icon-button bp-search-widget__icon-button--filter');
    button.type = 'button';
    button.setAttribute('data-action', 'filter');
    button.setAttribute('aria-label', 'Open filters');
    button.innerHTML = this.getFilterIcon();
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

  getFieldsByPosition(position) {
    return this.options.fields.filter((field) => field.position === position);
  }

  getFieldByKey(key) {
    return this.options.fields.find((field) => field.key === key) || null;
  }

  getFieldSummary(field) {
    const value = this.state.customFields[field.key];

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
    if (!(target instanceof Node) || !this.openPopoverKey) {
      return;
    }

    const activeSection = this.getFieldSectionElement(this.openPopoverKey);
    if (activeSection && !activeSection.contains(target)) {
      this.closeChoicePopover();
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

    const filterButton = target.closest('[data-action="filter"]');
    if (filterButton) {
      this.handleFilterClick();
      return;
    }

    const popoverTrigger = target.closest('[data-action="toggle-popover"]');
    if (popoverTrigger) {
      const key = popoverTrigger.getAttribute('data-key');
      this.toggleChoicePopover(key);
      return;
    }

    const selectOption = target.closest('[data-action="select-option"]');
    if (selectOption) {
      const key = selectOption.getAttribute('data-key');
      const value = selectOption.getAttribute('data-value') || '';
      this.setSingleChoiceValue(key, value);
      return;
    }

    const checkboxOption = target.closest('[data-action="toggle-checkbox"]');
    if (checkboxOption) {
      const key = checkboxOption.getAttribute('data-key');
      const value = checkboxOption.getAttribute('data-value') || '';
      this.toggleCheckboxValue(key, value);
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

    if (target.matches('.bp-search-widget__input')) {
      event.preventDefault();
      this.handleSearch();
    }
  }

  handleDocumentClick(event) {
    if (!this.openPopoverKey) {
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
  }

  handleDocumentKeydown(event) {
    if (event.key === 'Escape') {
      this.closeChoicePopover();
    }
  }

  toggleChoicePopover(key) {
    if (!key) {
      return;
    }

    if (this.openPopoverKey === key) {
      this.closeChoicePopover();
      return;
    }

    this.openChoicePopover(key);
  }

  openChoicePopover(key) {
    const field = this.getFieldByKey(key);
    if (!field || field.type === 'input') {
      return;
    }

    this.closeChoicePopover();

    const section = this.getFieldSectionElement(key);
    if (!section) {
      return;
    }

    const trigger = section.querySelector('[data-action="toggle-popover"]');
    const popover = this.createChoicePopover(field);

    section.appendChild(popover);
    section.classList.add('is-open');
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'true');
    }

    this.openPopoverKey = key;
  }

  closeChoicePopover() {
    if (!this.openPopoverKey) {
      return;
    }

    const section = this.getFieldSectionElement(this.openPopoverKey);
    if (section) {
      const popover = section.querySelector('.bp-search-widget__popover');
      const trigger = section.querySelector('[data-action="toggle-popover"]');

      if (popover) {
        popover.remove();
      }

      if (trigger) {
        trigger.setAttribute('aria-expanded', 'false');
      }

      section.classList.remove('is-open');
    }

    this.openPopoverKey = null;
  }

  createChoicePopover(field) {
    const popover = this.createElement('div', 'bp-search-widget__popover');
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', field.label);

    field.options.forEach((option) => {
      const button = this.createElement('button', 'bp-search-widget__choice-option');
      const label = this.createElement('span', 'bp-search-widget__choice-label', option.label);
      const indicator = this.createElement('span', 'bp-search-widget__choice-indicator');
      const isSelected = this.isOptionSelected(field, option.value);

      button.type = 'button';
      button.setAttribute('data-key', field.key);
      button.setAttribute('data-value', option.value);
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

  isOptionSelected(field, value) {
    const currentValue = this.state.customFields[field.key];

    if (field.type === 'checkbox') {
      return Array.isArray(currentValue) && currentValue.includes(value);
    }

    return currentValue === value;
  }

  setSingleChoiceValue(key, value) {
    const field = this.getFieldByKey(key);
    if (!field) {
      return;
    }

    this.state.customFields[key] = value;
    this.updateFieldSummary(key);
    this.syncSearchDisabledState();
    this.closeChoicePopover();
  }

  toggleCheckboxValue(key, value) {
    const field = this.getFieldByKey(key);
    if (!field) {
      return;
    }

    const currentValue = Array.isArray(this.state.customFields[key])
      ? [...this.state.customFields[key]]
      : [];
    const nextValue = currentValue.includes(value)
      ? currentValue.filter((entry) => entry !== value)
      : [...currentValue, value];

    this.state.customFields[key] = nextValue;
    this.updateFieldSummary(key);
    this.syncSearchDisabledState();

    const section = this.getFieldSectionElement(key);
    if (!section) {
      return;
    }

    const existingPopover = section.querySelector('.bp-search-widget__popover');
    if (existingPopover) {
      existingPopover.replaceWith(this.createChoicePopover(field));
    }
  }

  updateFieldSummary(key) {
    const field = this.getFieldByKey(key);
    if (!field) {
      return;
    }

    const section = this.getFieldSectionElement(key);
    if (!section) {
      return;
    }

    const summary = section.querySelector('.bp-search-widget__trigger-value');
    if (summary) {
      summary.textContent = this.getFieldSummary(field);
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

  handleFilterClick() {
    if (this.options.onFilterClick) {
      this.options.onFilterClick(this.getValues(), this);
    }
  }

  syncSearchDisabledState() {
    if (this.elements.searchButton) {
      this.elements.searchButton.disabled = !this.canSubmitSearch();
    }
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

  fieldHasValue(field, value) {
    if (field.type === 'checkbox') {
      return Array.isArray(value) && value.length > 0;
    }

    if (field.type === 'select' || field.type === 'radio') {
      return typeof value === 'string' && value !== '';
    }

    return typeof value === 'string' && value.trim() !== '';
  }

  canSubmitSearch() {
    return this.hasValidDateRange() && this.hasRequiredFieldsFilled();
  }

  collectSearchPayload() {
    return {
      location: this.state.location,
      checkIn: this.state.checkIn,
      checkOut: this.state.checkOut,
      customFields: this.cloneCustomFieldValues(),
    };
  }

  cloneCustomFieldValues() {
    const cloned = {};

    Object.keys(this.state.customFields).forEach((key) => {
      const value = this.state.customFields[key];
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
    };
  }

  addField(fieldDescriptor) {
    const normalizedField = this.normalizeField(fieldDescriptor);
    if (this.getFieldByKey(normalizedField.key)) {
      throw new Error(`Duplicate field key: ${normalizedField.key}`);
    }

    this.options.fields = [...this.options.fields, normalizedField];
    this.state.customFields[normalizedField.key] = this.coerceFieldValue(normalizedField, undefined);
    this.render();
  }

  removeField(key) {
    if (!this.getFieldByKey(key)) {
      return;
    }

    if (this.openPopoverKey === key) {
      this.closeChoicePopover();
    }

    this.options.fields = this.options.fields.filter((field) => field.key !== key);
    delete this.state.customFields[key];
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
    this.state.customFields[key] = this.coerceFieldValue(mergedField, this.state.customFields[key]);
    this.render();
  }

  updateOptions(newOptions = {}) {
    const previousFieldState = this.cloneCustomFieldValues();
    const previousLocation = this.state.location;
    const previousCheckIn = this.state.checkIn;
    const previousCheckOut = this.state.checkOut;

    const mergedOptions = {
      ...this.options,
      ...newOptions,
      fields: newOptions.fields !== undefined ? newOptions.fields : this.options.fields,
      calendarOptions: newOptions.calendarOptions !== undefined
        ? newOptions.calendarOptions
        : this.options.calendarOptions,
    };

    this.options = this.normalizeOptions(mergedOptions);
    this.state.location = previousLocation;
    this.state.checkIn = previousCheckIn;
    this.state.checkOut = previousCheckOut;
    this.state.customFields = this.buildFieldState(this.options.fields, previousFieldState);
    this.render();
  }

  destroy() {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;
    this.closeChoicePopover();
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

  getSearchIcon() {
    return this.getFaIconMarkup('fa-solid fa-magnifying-glass');
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

  getFaIconMarkup(className) {
    return `<i class="${className}" aria-hidden="true"></i>`;
  }

  getFieldSectionElement(key) {
    return Array.from(this.container.querySelectorAll('[data-field-key]'))
      .find((element) => element.getAttribute('data-field-key') === key) || null;
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
