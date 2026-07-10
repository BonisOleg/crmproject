const CrmModal = (() => {
  const FORMS = {
    client: {
      title: 'Новий клієнт',
      submit: 'Додати клієнта',
      storeType: 'clients',
      fields: [
        { name: 'name', label: 'ПІБ / назва', type: 'text', required: true, validate: 'name', placeholder: 'Олександр К.' },
        { name: 'phone', label: 'Телефон', type: 'tel', required: true, validate: 'phone', placeholder: '+380 67 123 4567' },
        { name: 'telegram', label: 'Telegram', type: 'text', validate: 'telegram', placeholder: '@username' },
        {
          name: 'currency',
          label: 'Валюта',
          type: 'select',
          options: [{ value: 'CHF', label: 'CHF' }, { value: 'EUR', label: 'EUR' }],
          default: 'CHF',
        },
      ],
      build(data) {
        return {
          name: data.name.trim(),
          phone: data.phone.trim(),
          telegram: data.telegram.trim(),
          deals: 0,
          debt: 0,
          currency: data.currency,
        };
      },
    },
    lead: {
      title: 'Новий VIP-запит',
      submit: 'Створити запит',
      storeType: 'leads',
      fields: [
        { name: 'client', label: 'Клієнт', type: 'text', required: true, validate: 'name', placeholder: 'Імʼя та прізвище' },
        { name: 'phone', label: 'Телефон', type: 'tel', required: true, validate: 'phone', placeholder: '+380 XX XXX XXXX' },
        {
          name: 'criteria',
          label: 'Критерії пошуку',
          type: 'textarea',
          required: true,
          validate: 'criteria',
          placeholder: 'Марка, рік, бюджет…',
        },
      ],
      build(data) {
        return {
          id: CrmStore.nextId('leads'),
          client: data.client.trim(),
          phone: data.phone.trim(),
          criteria: data.criteria.trim(),
          date: CrmStore.todayISO(),
          manager: 'Тимофій',
          status: 'new',
          status_label: 'Новий',
          candidates: 0,
        };
      },
    },
    deal: {
      title: 'Нова угода',
      submit: 'Створити угоду',
      storeType: 'deals',
      fields: [
        { name: 'car', label: 'Авто', type: 'text', required: true, validate: 'car', placeholder: 'BMW X5 xDrive40d' },
        { name: 'year', label: 'Рік', type: 'text', required: true, validate: 'year', placeholder: '2021' },
        { name: 'client', label: 'Клієнт', type: 'text', required: true, validate: 'name', placeholder: 'Олександр К.' },
        { name: 'phone', label: 'Телефон', type: 'tel', validate: 'phone', placeholder: '+380 67 123 4567' },
        { name: 'lot_url', label: 'Посилання auto-lot.com', type: 'lot_url', placeholder: 'https://auto-lot.com/lot/12345' },
        { name: 'won_price', label: 'Виграна', type: 'amount_currency', currencyName: 'won_currency', validate: 'price', placeholder: '38000' },
        { name: 'bid', label: 'Ставка', type: 'amount_currency', currencyName: 'bid_currency', validate: 'price', placeholder: '37500' },
        { name: 'cost', label: 'Собівартість', type: 'amount_currency', currencyName: 'cost_currency', validate: 'price', placeholder: '34000' },
        { name: 'price', label: 'Клієнту', type: 'amount_currency', currencyName: 'price_currency', required: true, validate: 'price', placeholder: '42500' },
        { name: 'delivery_cost', label: 'Доставка (якщо наша)', type: 'amount_currency', currencyName: 'delivery_currency', validate: 'price', placeholder: '1800' },
        { name: 'commission', label: 'Комісія', type: 'text', validate: 'price', placeholder: '2100', hint: 'Вводиться вручну' },
        {
          name: 'execution',
          label: 'Етап виконання',
          type: 'select',
          options: [
            { value: 'won', label: 'Виграно' },
            { value: 'confirmed', label: 'Підтверджено' },
            { value: 'picked', label: 'Забрано' },
            { value: 'in_transit', label: 'В дорозі' },
            { value: 'customs', label: 'Розмитнено' },
            { value: 'delivered', label: 'Доставлено' },
          ],
          default: 'won',
        },
        { name: 'due_payments', label: 'Місце оплати', type: 'due_payments' },
        { name: 'documents', label: 'Документи', type: 'documents' },
      ],
      build(data) {
        const price = Number(data.price) || 0;
        const EXEC_LABELS = {
          won: 'Виграно', confirmed: 'Підтверджено', picked: 'Забрано',
          in_transit: 'В дорозі', customs: 'Розмитнено', delivered: 'Доставлено',
        };
        return {
          id: CrmStore.nextId('deals'),
          car: data.car.trim(),
          year: Number(data.year),
          client: data.client.trim(),
          phone: data.phone.trim(),
          lot_url: (data.lot_url || '').trim(),
          won_price: Number(data.won_price) || 0,
          bid: Number(data.bid) || 0,
          cost: Number(data.cost) || Math.round(price * 0.82),
          delivery_cost: Number(data.delivery_cost) || 0,
          commission: Number(data.commission) || 0,
          execution: data.execution,
          execution_label: EXEC_LABELS[data.execution] || data.execution,
          payment: 'pending',
          payment_label: 'Очікує',
          price,
          paid: 0,
          debt: price,
          currency: data.price_currency || 'CHF',
          won_currency: data.won_currency || 'CHF',
          bid_currency: data.bid_currency || 'CHF',
          cost_currency: data.cost_currency || 'CHF',
          price_currency: data.price_currency || 'CHF',
          delivery_currency: data.delivery_currency || 'CHF',
          profit: Math.round(price * 0.08),
          vin: '',
          image: _fetchedLotImage || (window.CrmRender ? CrmRender.DEFAULT_CAR_IMAGE : ''),
          delivery_type: Number(data.delivery_cost) > 0 ? 'ours' : 'pickup',
        };
      },
    },
    carrier: {
      title: 'Новий рейс',
      submit: 'Додати рейс',
      storeType: 'carriers',
      fields: [
        { name: 'driver', label: 'Водій', type: 'text', required: true, placeholder: 'Михайло Коваль' },
        { name: 'plate', label: 'Номер автовоза', type: 'text', required: true, placeholder: 'CH-ZH 4821' },
        { name: 'route', label: 'Маршрут', type: 'text', required: true, validate: 'route', autocomplete: 'route', placeholder: 'Цюрих', hint: 'Оберіть місто відправлення, потім прибуття' },
        { name: 'cars', label: 'Кількість авто', type: 'text', required: true, validate: 'integer', min: 1, max: 20, placeholder: '4', hint: 'Від 1 до 20 авто на рейс' },
        { name: 'departure', label: 'Відправлення', type: 'date', required: true, validate: 'date', hint: 'Дата завантаження на автовоз' },
        { name: 'eta', label: 'ETA', type: 'date', required: true, validate: 'date', hint: 'Очікувана дата прибуття в UA' },
        {
          name: 'status',
          label: 'Статус',
          type: 'select',
          options: [
            { value: 'loading', label: 'Завантаження' },
            { value: 'in_transit', label: 'В дорозі' },
          ],
          default: 'loading',
        },
        { name: 'assigned_deals', label: 'Авто на борту (виграні/підтверджені)', type: 'carrier_deals' },
      ],
      build(data) {
        const labels = { loading: 'Завантаження', in_transit: 'В дорозі' };
        const assigned = [];
        document.querySelectorAll('[data-carrier-deal-check]:checked').forEach((el) => {
          assigned.push(el.value);
        });
        return {
          id: CrmStore.nextId('carriers'),
          driver: (data.driver || '').trim(),
          plate: (data.plate || '').trim(),
          route: data.route.trim(),
          cars: Number(data.cars) || 1,
          departure: data.departure,
          eta: data.eta,
          status: data.status,
          status_label: labels[data.status] || data.status,
          assigned_deals: assigned,
          documents: [],
        };
      },
    },
    payment: {
      title: 'Новий платіж',
      submit: 'Записати платіж',
      storeType: 'payments',
      fields: [
        {
          name: 'deal_id',
          label: 'Призначення платежу',
          type: 'select',
          required: true,
          validate: 'select',
          options: [],
          dynamic: 'deals',
          hint: 'Оберіть угоду з несплаченим боргом',
        },
        {
          name: 'amount',
          label: 'Сума',
          type: 'text',
          required: true,
          validate: 'paymentAmount',
          placeholder: '15000',
          hint: 'Часткове або повне погашення боргу',
        },
        {
          name: 'currency',
          label: 'Валюта',
          type: 'select',
          options: [
            { value: 'CHF', label: 'CHF' },
            { value: 'EUR', label: 'EUR' },
            { value: 'USD', label: 'USD' },
          ],
          default: 'CHF',
        },
        {
          name: 'place',
          label: 'Де оплачено',
          type: 'select',
          options: [
            { value: 'На офісі', label: 'На офісі' },
            { value: 'Біля авто', label: 'Біля авто' },
            { value: 'На місці', label: 'На місці' },
            { value: 'Банк', label: 'Банк' },
          ],
          default: 'На офісі',
        },
        {
          name: 'date',
          label: 'Дата',
          type: 'date',
          required: true,
          validate: 'date',
          hint: 'Коли клієнт фактично оплатив',
        },
      ],
      build(data) {
        return {
          id: `PAY-${Date.now()}`,
          dealId: data.deal_id,
          amount: Number(data.amount),
          currency: data.currency,
          place: data.place,
          date: data.date,
        };
      },
    },
  };

  let modalEl;
  let formEl;
  let titleEl;
  let activeType = null;
  let lastFocus = null;
  let openOptions = {};
  let dealDueWidget = null;
  let dealDocWidget = null;
  let _fetchedLotImage = '';
  let scrollLockY = 0;

  function lockBodyScroll() {
    scrollLockY = window.scrollY || window.pageYOffset || 0;
    document.body.classList.add('modal-open');
    document.body.style.top = `-${scrollLockY}px`;
  }

  function unlockBodyScroll() {
    document.body.classList.remove('modal-open');
    document.body.style.top = '';
    window.scrollTo(0, scrollLockY);
  }

  function init() {
    modalEl = document.getElementById('crm-modal');
    formEl = document.getElementById('crm-modal-form');
    titleEl = document.getElementById('crm-modal-title');
    if (!modalEl || !formEl) return;

    document.querySelectorAll('[data-open-modal]').forEach((btn) => {
      btn.dataset.actionBound = 'true';
      btn.addEventListener('click', () => {
        const type = btn.dataset.openModal;
        if (window.CrmPackages && !CrmPackages.guardModal(type)) return;
        open(type, {
          dealId: btn.dataset.paymentDeal || '',
          carrierPreset: btn.dataset.carrierPreset || '',
        });
      });
    });

    modalEl.addEventListener('click', (event) => {
      if (event.target.closest('[data-modal-close]')) {
        close();
      }
    });

    formEl.addEventListener('submit', onSubmit);
    document.addEventListener('keydown', onKeydown);
  }

  function open(type, options = {}) {
    const config = FORMS[type];
    if (!config || !modalEl) return;

    activeType = type;
    openOptions = options;
    lastFocus = document.activeElement;
    titleEl.textContent = type === 'carrier' && options.carrierPreset
      ? 'Зібрати автовоз'
      : config.title;
    const bindConfig = type === 'payment' ? resolveConfig(config, options) : config;
    formEl.innerHTML = buildFormHtml(bindConfig);
    formEl.dataset.modalType = type;
    setDefaultDates(type);
    applyOpenOptions(type, options);

    if (type === 'carrier' && options.carrierPreset) {
      const submitBtn = formEl.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Зібрати автовоз';
    }

    if (window.CrmValidation) CrmValidation.bindForm(formEl, bindConfig);

    _fetchedLotImage = '';

    if (type === 'deal') {
      const fetchBtn = formEl.querySelector('[data-fetch-lot-photo]');
      const lotInput = formEl.querySelector('[name="lot_url"]');
      const preview = formEl.querySelector('[data-lot-preview]');
      if (fetchBtn && lotInput && preview) {
        const hidePreview = () => {
          preview.hidden = true;
          preview.removeAttribute('src');
          preview.setAttribute('aria-hidden', 'true');
        };
        hidePreview();

        preview.addEventListener('error', () => {
          _fetchedLotImage = '';
          hidePreview();
          if (typeof showToast === 'function') showToast('Не вдалося завантажити фото', 'info');
        });

        fetchBtn.addEventListener('click', () => {
          const url = lotInput.value.trim();
          if (!url) { if (typeof showToast === 'function') showToast('Введіть посилання', 'info'); return; }
          fetchBtn.disabled = true;
          fetchBtn.textContent = '…';
          hidePreview();
          fetch('/api/fetch-lot-photo/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
            body: JSON.stringify({ url }),
          })
            .then((r) => r.json())
            .then((resp) => {
              if (resp.image_url) {
                _fetchedLotImage = resp.image_url;
                preview.onload = () => {
                  preview.hidden = false;
                  preview.setAttribute('aria-hidden', 'false');
                  preview.onload = null;
                  if (typeof showToast === 'function') showToast('Фото підтягнуто', 'success');
                };
                preview.src = resp.image_url;
              } else {
                if (typeof showToast === 'function') showToast(resp.error || 'Фото не знайдено', 'info');
              }
            })
            .catch(() => { if (typeof showToast === 'function') showToast('Помилка мережі', 'info'); })
            .finally(() => { fetchBtn.disabled = false; fetchBtn.textContent = 'Підтягнути фото'; });
        });
      }
    }

    if (type === 'deal' && window.CrmDuePayments) {
      const dueRoot = formEl.querySelector('[data-due-root]');
      const currency = formEl.querySelector('[name="currency"]')?.value || 'CHF';
      dealDueWidget?.destroy?.();
      dealDueWidget = CrmDuePayments.mount(dueRoot, {
        items: [],
        currency,
        syncWithToolbar: false,
      });
      const currencySelect = formEl.querySelector('[name="currency"]');
      currencySelect?.addEventListener('change', () => {
        dealDueWidget?.setCurrency(currencySelect.value);
      });
    } else {
      dealDueWidget?.destroy?.();
      dealDueWidget = null;
    }

    if (type === 'deal' && window.CrmDocuments) {
      const docRoot = formEl.querySelector('[data-doc-root]');
      dealDocWidget = CrmDocuments.mount(docRoot, {
        items: [],
        title: 'Документи',
      });
    } else {
      dealDocWidget = null;
    }

    modalEl.hidden = false;
    modalEl.setAttribute('aria-hidden', 'false');
    lockBodyScroll();

    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    if (!isMobile) {
      const firstInput = formEl.querySelector('.crm-modal__input, .crm-modal__select, .crm-modal__textarea');
      window.requestAnimationFrame(() => firstInput?.focus());
    } else {
      formEl.scrollTop = 0;
      modalEl.querySelector('.crm-modal__dialog')?.scrollTo?.(0, 0);
    }
  }

  function close() {
    if (!modalEl) return;
    modalEl.hidden = true;
    modalEl.setAttribute('aria-hidden', 'true');
    unlockBodyScroll();
    formEl.innerHTML = '';
    activeType = null;
    openOptions = {};
    _fetchedLotImage = '';
    dealDueWidget?.destroy?.();
    dealDueWidget = null;
    dealDocWidget = null;
    lastFocus?.focus?.();
  }

  function resolveConfig(config, options) {
    if (config.storeType !== 'payments') return config;
    const deals = CrmStore.listDealsForSelect()
      .filter((deal) => deal.debt > 0)
      .map((deal) => ({
        value: deal.id,
        label: `${deal.id} · ${deal.car} · борг ${Number(deal.debt).toLocaleString('uk-UA')} ${deal.currency}`,
      }));
    if (!deals.length) {
      CrmStore.listDealsForSelect().forEach((deal) => {
        deals.push({
          value: deal.id,
          label: `${deal.id} · ${deal.car}`,
        });
      });
    }
    return {
      ...config,
      fields: config.fields.map((field) => (
        field.name === 'deal_id'
          ? { ...field, options: deals, default: options.dealId || deals[0]?.value }
          : field
      )),
    };
  }

  function applyOpenOptions(type, options) {
    if (type === 'payment') {
      const dealSelect = formEl.querySelector('[name="deal_id"]');
      const currencySelect = formEl.querySelector('[name="currency"]');
      const dateInput = formEl.querySelector('[name="date"]');
      if (dealSelect && options.dealId) dealSelect.value = options.dealId;
      if (dateInput && !dateInput.value) dateInput.value = CrmStore.todayISO();
      if (dealSelect && currencySelect) {
        const deal = CrmStore.getDeal(dealSelect.value);
        if (deal?.currency) currencySelect.value = deal.currency;
        dealSelect.addEventListener('change', () => {
          const selected = CrmStore.getDeal(dealSelect.value);
          if (selected?.currency) currencySelect.value = selected.currency;
        });
      }
      return;
    }

    if (type === 'carrier' && options.carrierPreset === 'ch-ua') {
      const route = formEl.querySelector('[name="route"]');
      const cars = formEl.querySelector('[name="cars"]');
      if (route && !route.value) route.value = 'Цюрих → Львів';
      if (cars && !cars.value) cars.value = '4';
    }
  }

  function onKeydown(event) {
    if (event.key === 'Escape' && !modalEl.hidden) {
      event.preventDefault();
      close();
    }
  }

  function buildFormHtml(config) {
    const fieldsHtml = config.fields.map((field) => renderField(field)).join('');
    return `
      <div class="crm-modal__fields">${fieldsHtml}</div>
      <div class="crm-modal__actions">
        <button type="button" class="btn btn--ghost btn--sm" data-modal-close>Скасувати</button>
        <button type="submit" class="btn btn--primary btn--sm">${config.submit}</button>
      </div>`;
  }

  const CURRENCIES = ['CHF', 'EUR', 'USD'];

  function renderCurrencySelect(name, defaultVal) {
    const opts = CURRENCIES.map((c) => `<option value="${c}"${c === (defaultVal || 'CHF') ? ' selected' : ''}>${c}</option>`).join('');
    return `<select class="crm-modal__currency-select" name="${escapeHtml(name)}">${opts}</select>`;
  }

  function renderField(field) {
    const req = field.required ? '<span aria-hidden="true"> *</span>' : '';
    const id = `crm-field-${field.name}`;

    if (field.type === 'due_payments') {
      return `
        <div class="crm-modal__group crm-modal__group--wide crm-modal__group--due">
          <span class="crm-modal__group-label">${field.label}${req}</span>
          <div data-due-root id="${id}"></div>
        </div>`;
    }

    if (field.type === 'documents') {
      return `
        <div class="crm-modal__group crm-modal__group--wide crm-modal__group--docs">
          <span class="crm-modal__group-label">${field.label}${req}</span>
          <div data-doc-root id="${id}"></div>
        </div>`;
    }

    if (field.type === 'lot_url') {
      return `
        <div class="crm-modal__group crm-modal__group--wide">
          <label for="${id}">${field.label}</label>
          <div class="crm-modal__lot-row">
            <input class="crm-modal__input" id="${id}" type="url" name="${field.name}" placeholder="${escapeHtml(field.placeholder || '')}">
            <button type="button" class="btn btn--ghost btn--sm" data-fetch-lot-photo>Підтягнути фото</button>
          </div>
          <img class="crm-modal__lot-preview" data-lot-preview hidden alt="" aria-hidden="true" referrerpolicy="no-referrer">
          <p class="crm-modal__error" data-error-for="${field.name}" hidden></p>
        </div>`;
    }

    if (field.type === 'amount_currency') {
      const hintHtml = field.hint ? `<p class="crm-modal__hint">${escapeHtml(field.hint)}</p>` : '';
      return `
        <div class="crm-modal__group">
          <label for="${id}">${escapeHtml(field.label)}${req}</label>
          <div class="crm-modal__amount-row">
            <input class="crm-modal__input" id="${id}" type="text" name="${field.name}" inputmode="numeric" maxlength="9" placeholder="${escapeHtml(field.placeholder || '')}"${field.required ? ' required' : ''}>
            ${renderCurrencySelect(field.currencyName, 'CHF')}
          </div>
          ${hintHtml}
          <p class="crm-modal__error" data-error-for="${field.name}" hidden></p>
        </div>`;
    }

    if (field.type === 'carrier_deals') {
      const deals = window.CrmStore
        ? CrmStore.listDealsForSelect().filter((d) => d.execution === 'won' || d.execution === 'confirmed')
        : [];
      if (!deals.length) return '';
      const checkboxes = deals.map((d) => `
        <label class="crm-modal__deal-check">
          <input type="checkbox" name="assigned_deals" value="${escapeHtml(d.id)}" data-carrier-deal-check>
          <span>${escapeHtml(d.id)} · ${escapeHtml(d.car)} (${escapeHtml(d.execution_label || d.execution)})</span>
        </label>`).join('');
      return `
        <div class="crm-modal__group crm-modal__group--wide">
          <span class="crm-modal__group-label">${escapeHtml(field.label)}</span>
          <div class="crm-modal__deal-list">${checkboxes}</div>
        </div>`;
    }

    let control = '';

    if (field.type === 'select') {
      const opts = field.options || [];
      const needsPlaceholder = field.dynamic === 'deals' || field.name === 'deal_id';
      const placeholder = needsPlaceholder
        ? `<option value="" disabled${field.default ? '' : ' selected'}>Оберіть угоду…</option>`
        : '';
      const options = opts.map((opt) => {
        const val = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? opt : opt.label;
        const selected = field.default && val === field.default ? ' selected' : '';
        return `<option value="${escapeHtml(val)}"${selected}>${escapeHtml(label)}</option>`;
      }).join('');
      control = `<select class="crm-modal__select" id="${id}" name="${field.name}"${field.required ? ' required' : ''}>${placeholder}${options}</select>`;
    } else if (field.type === 'textarea') {
      control = `<textarea class="crm-modal__textarea" id="${id}" name="${field.name}" placeholder="${field.placeholder || ''}"${field.required ? ' required' : ''}></textarea>`;
    } else {
      const inputType = field.validate === 'year' || field.validate === 'price' || field.validate === 'integer' || field.validate === 'paymentAmount'
        ? 'text'
        : field.type;
      const attrs = [
        field.required ? 'required' : '',
        field.placeholder ? `placeholder="${field.placeholder}"` : '',
        field.min != null ? `min="${field.min}"` : '',
        field.max != null ? `max="${field.max}"` : '',
        field.validate === 'phone' || field.type === 'tel' ? 'inputmode="tel" autocomplete="tel" maxlength="20"' : '',
        field.validate === 'year' ? 'inputmode="numeric" maxlength="4"' : '',
        field.validate === 'price' || field.validate === 'integer' || field.validate === 'paymentAmount' ? 'inputmode="numeric" maxlength="9"' : '',
        field.validate === 'telegram' ? 'autocomplete="off" maxlength="33"' : '',
      ].filter(Boolean).join(' ');
      control = `<input class="crm-modal__input" id="${id}" type="${inputType}" name="${field.name}" ${attrs}>`;
      if (field.autocomplete === 'route') {
        control = `<div class="crm-modal__combo" data-route-combo>${control}</div>`;
      }
    }

    const rowClass = field.half ? 'crm-modal__group crm-modal__row' : 'crm-modal__group';
    const hintHtml = field.hint
      ? `<p class="crm-modal__hint" data-hint-for="${field.name}">${escapeHtml(field.hint)}</p>`
      : '';
    return `
      <div class="${rowClass}">
        <label for="${id}">${field.label}${req}</label>
        ${control}
        ${hintHtml}
        <p class="crm-modal__error" data-error-for="${field.name}" hidden></p>
      </div>`;
  }

  function setDefaultDates(type) {
    if (type === 'carrier') {
      const dep = formEl.querySelector('[name="departure"]');
      const eta = formEl.querySelector('[name="eta"]');
      const today = CrmStore.todayISO();
      if (dep && !dep.value) dep.value = today;
      if (eta && !eta.value) {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        eta.value = date.toISOString().slice(0, 10);
      }
      return;
    }
    if (type === 'payment') {
      const dateInput = formEl.querySelector('[name="date"]');
      if (dateInput && !dateInput.value) dateInput.value = CrmStore.todayISO();
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    const type = formEl.dataset.modalType;
    const config = FORMS[type];
    if (!config) return;

    const resolved = type === 'payment' ? resolveConfig(config, openOptions) : config;

    clearErrors();
    const data = readFormData(formEl);
    const errors = window.CrmValidation
      ? CrmValidation.validateForm(resolved, data, formEl)
      : validateLegacy(resolved, data);
    if (errors.length) {
      if (window.CrmValidation) {
        CrmValidation.showErrors(formEl, errors);
      } else {
        showErrors(errors);
      }
      return;
    }

    const item = config.build(data);
    const storeType = config.storeType;

    if (storeType === 'payments') {
      const result = CrmPayments.record(item);
      if (!result) {
        if (typeof showToast === 'function') showToast('Угоду не знайдено', 'info');
        return;
      }
      CrmPayments.refreshUI(result);
      close();
      if (typeof showToast === 'function') {
        showToast(successMessage('payment', item, result.deal), 'success');
      }
      return;
    }

    CrmStore.addItem(storeType, item);
    CrmRender.append(storeType, item);
    CrmRender.notifyAdded(storeType, item);

    if (type === 'deal') {
      const dueRoot = formEl.querySelector('[data-due-root]');
      const docRoot = formEl.querySelector('[data-doc-root]');
      const due_payments = dealDueWidget?.read() || (window.CrmDuePayments ? CrmDuePayments.read(dueRoot) : []);
      const documents = dealDocWidget?.read() || (window.CrmDocuments ? CrmDocuments.read(docRoot) : []);
      CrmStore.saveDealProfile(item.id, {
        auction: 'BCP',
        due_payments,
        documents,
        notes: '',
        image: item.image || '',
        lot_url: item.lot_url || '',
        year: item.year || '',
        logistics: { confirmed: CrmStore.todayISO(), picked: null, transit: null, customs: null, delivered: null },
      });
      if (window.CrmReport) CrmReport.addDealFromStore(CrmStore.getDeal(item.id));
    }

    close();
    if (typeof showToast === 'function') {
      showToast(successMessage(type, item), 'success');
    }

    if (type === 'carrier' && window.location.pathname.includes('/cockpit')) {
      window.setTimeout(() => {
        window.location.href = '/carriers/';
      }, 700);
    }
  }

  function readFormData(form) {
    const data = {};
    new FormData(form).forEach((value, key) => {
      data[key] = value;
    });
    return data;
  }

  function validateLegacy(config, data) {
    const errors = [];
    config.fields.forEach((field) => {
      const value = String(data[field.name] ?? '').trim();
      if (field.required && !value) {
        errors.push({ name: field.name, message: 'Заповніть це поле' });
      }
    });

    if (config.storeType === 'carriers' && data.departure && data.eta && data.eta < data.departure) {
      errors.push({ name: 'eta', message: 'ETA не може бути раніше відправлення' });
    }

    return errors;
  }

  function clearErrors() {
    if (window.CrmValidation) {
      CrmValidation.clearErrors(formEl);
      return;
    }
    formEl.querySelectorAll('.crm-modal__input, .crm-modal__select, .crm-modal__textarea')
      .forEach((el) => el.classList.remove('crm-modal__input--error', 'crm-modal__select--error', 'crm-modal__textarea--error'));
    formEl.querySelectorAll('[data-error-for]').forEach((el) => {
      el.hidden = true;
      el.textContent = '';
    });
  }

  function showErrors(errors) {
    errors.forEach(({ name, message }) => {
      const input = formEl.querySelector(`[name="${name}"]`);
      const errEl = formEl.querySelector(`[data-error-for="${name}"]`);
      if (input) {
        input.classList.add(
          input.tagName === 'SELECT' ? 'crm-modal__select--error' : input.tagName === 'TEXTAREA' ? 'crm-modal__textarea--error' : 'crm-modal__input--error'
        );
      }
      if (errEl) {
        errEl.textContent = message;
        errEl.hidden = false;
      }
    });
    formEl.querySelector('.crm-modal__input--error, .crm-modal__select--error, .crm-modal__textarea--error')?.focus();
  }

  function successMessage(type, item, deal) {
    switch (type) {
      case 'client': return `Клієнта «${item.name}» додано`;
      case 'lead': return `Запит ${item.id} створено`;
      case 'deal': return `Угоду ${item.id} створено`;
      case 'carrier': return `Рейс ${item.id} додано`;
      case 'payment': return `Платіж ${Number(item.amount).toLocaleString('uk-UA')} ${item.currency} · ${deal?.client || item.dealId}`;
      default: return 'Збережено';
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getCsrfToken() {
    const meta = document.querySelector('[name="csrfmiddlewaretoken"]');
    if (meta) return meta.value;
    const cookie = document.cookie.split(';').find((c) => c.trim().startsWith('csrftoken='));
    return cookie ? cookie.split('=')[1].trim() : '';
  }

  function confirm({ title, message, confirmLabel = 'Видалити', onConfirm }) {
    if (!modalEl || !formEl) return;

    lastFocus = document.activeElement;
    titleEl.textContent = title;
    formEl.innerHTML = `
      <p class="crm-modal__message">${escapeHtml(message)}</p>
      <div class="crm-modal__actions">
        <button type="button" class="btn btn--ghost btn--sm" data-modal-close>Скасувати</button>
        <button type="button" class="btn btn--danger btn--sm" id="crm-modal-confirm-btn">${escapeHtml(confirmLabel)}</button>
      </div>`;
    formEl.dataset.modalType = 'confirm';

    modalEl.hidden = false;
    modalEl.setAttribute('aria-hidden', 'false');
    lockBodyScroll();

    const confirmBtn = document.getElementById('crm-modal-confirm-btn');
    confirmBtn?.focus();
    confirmBtn?.addEventListener('click', () => {
      onConfirm?.();
      close();
    }, { once: true });
  }

  document.addEventListener('DOMContentLoaded', init);
  return { open, close, confirm };
})();

window.CrmModal = CrmModal;
