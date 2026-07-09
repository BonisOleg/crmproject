/**
 * Блок «Місце оплати»
 * Ввод — у валюті toolbar (CHF/EUR/USD) або форми; збереження — у валюті угоди/рядка
 */
const CrmDuePayments = (() => {
  const PLACES = ['На офісі', 'Біля авто', 'На місці', 'Банк'];

  function sanitizeDigits(value) {
    return String(value ?? '').replace(/\D/g, '');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getInputCurrency(storedCurrency, syncWithToolbar) {
    const stored = storedCurrency || 'CHF';
    if (syncWithToolbar !== false && window.CrmCurrency && CrmCurrency.isActive()) {
      return CrmCurrency.get();
    }
    return stored;
  }

  function convertAmount(amount, from, to) {
    const value = Number(amount) || 0;
    if (from === to) return value;
    if (window.CrmCurrency) return Math.round(CrmCurrency.convert(value, from, to));
    return value;
  }

  function toInputAmount(amount, storedCurrency, inputCurrency) {
    return convertAmount(amount, storedCurrency, inputCurrency);
  }

  function toStoredAmount(amount, storedCurrency, inputCurrency) {
    return convertAmount(amount, inputCurrency, storedCurrency);
  }

  function formatLabel(amount, currency) {
    const code = currency || 'CHF';
    const value = Number(amount) || 0;
    if (window.CrmCurrency) return CrmCurrency.label(value, code);
    return `${value.toLocaleString('uk-UA')} ${code}`;
  }

  function formatAmount(amount, storedCurrency, syncWithToolbar = true) {
    const input = getInputCurrency(storedCurrency, syncWithToolbar);
    return formatLabel(toInputAmount(amount, storedCurrency, input), input);
  }

  function itemsToInput(items, storedCurrency, inputCurrency) {
    return items.map((item) => ({
      ...item,
      amount: toInputAmount(item.amount, storedCurrency, inputCurrency),
    }));
  }

  function reconvertItems(items, storedCurrency, fromInput, toInput) {
    return items.map((item) => ({
      ...item,
      amount: toInputAmount(toStoredAmount(item.amount, storedCurrency, fromInput), storedCurrency, toInput),
    }));
  }

  function placeOptions(selected) {
    return PLACES.map((place) => (
      `<option value="${escapeHtml(place)}"${place === selected ? ' selected' : ''}>${escapeHtml(place)}</option>`
    )).join('');
  }

  function readList(root) {
    const items = [];
    root.querySelectorAll('[data-due-item]').forEach((row) => {
      items.push({
        id: row.dataset.dueId,
        amount: Number(row.dataset.dueAmount) || 0,
        place: row.dataset.duePlace || PLACES[0],
      });
    });
    return items;
  }

  function updateAmountPreview(root, inputCurrency) {
    const input = root.querySelector('[data-due-amount]');
    const preview = root.querySelector('[data-due-preview]');
    const codeEl = root.querySelector('[data-due-currency-code]');
    const code = inputCurrency || 'CHF';

    if (codeEl) codeEl.textContent = code;

    if (!preview || !input) return;
    const amount = Number(sanitizeDigits(input.value)) || 0;
    preview.textContent = amount ? formatLabel(amount, code) : '';
  }

  function renderList(root, items, inputCurrency) {
    const list = root.querySelector('[data-due-list]');
    if (!list) return;

    root.dataset.inputCurrency = inputCurrency;

    if (!items.length) {
      list.innerHTML = '';
      root.classList.remove('crm-due-widget--filled');
      return;
    }

    root.classList.add('crm-due-widget--filled');
    list.innerHTML = items.map((item) => `
      <div class="crm-due-widget__item" data-due-item data-due-id="${escapeHtml(item.id)}" data-due-amount="${item.amount}" data-due-place="${escapeHtml(item.place)}">
        <span class="crm-due-widget__badge">${escapeHtml(item.place)}</span>
        <span class="mono crm-due-widget__item-amount">${formatLabel(item.amount, inputCurrency)}</span>
        <button type="button" class="crm-due-widget__remove" data-due-remove="${escapeHtml(item.id)}" aria-label="Видалити ${escapeHtml(item.place)}">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>`).join('');

    list.querySelectorAll('[data-due-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = readList(root).filter((row) => row.id !== btn.dataset.dueRemove);
        renderList(root, next, inputCurrency);
        root.dispatchEvent(new CustomEvent('crm:due-changed', { bubbles: true }));
      });
    });
  }

  function bindAdd(root, ctx) {
    const amountInput = root.querySelector('[data-due-amount]');
    const placeSelect = root.querySelector('[data-due-place]');
    const addBtn = root.querySelector('[data-due-add]');

    amountInput?.addEventListener('input', () => {
      amountInput.value = sanitizeDigits(amountInput.value).slice(0, 9);
      updateAmountPreview(root, ctx.getInput());
    });

    const addItem = () => {
      const inputCurrency = ctx.getInput();
      const amount = Number(sanitizeDigits(amountInput?.value)) || 0;
      const place = placeSelect?.value || PLACES[0];
      if (!amount) {
        if (typeof showToast === 'function') showToast('Вкажіть суму', 'info');
        amountInput?.focus();
        return;
      }
      const items = readList(root);
      items.push({ id: `due-${Date.now()}`, amount, place });
      if (amountInput) amountInput.value = '';
      updateAmountPreview(root, inputCurrency);
      renderList(root, items, inputCurrency);
      root.dispatchEvent(new CustomEvent('crm:due-changed', { bubbles: true }));
    };

    addBtn?.addEventListener('click', addItem);
    amountInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addItem();
      }
    });
  }

  function mount(root, options = {}) {
    if (!root) return null;
    let storedCurrency = options.currency || 'CHF';
    const syncWithToolbar = options.syncWithToolbar !== false;
    const inputClass = options.inputClass || 'crm-due-widget__input';
    const storedItems = Array.isArray(options.items) ? options.items : [];

    root.innerHTML = `
      <div class="crm-due-widget" data-due-widget>
        <div class="crm-due-widget__list-wrap">
          <div class="crm-due-widget__list" data-due-list></div>
        </div>
        <div class="crm-due-widget__composer">
          <div class="crm-due-widget__row">
            <div class="crm-due-widget__cell crm-due-widget__cell--amount">
              <span class="crm-due-widget__label">Сума</span>
              <div class="crm-due-widget__amount-box">
                <input class="${inputClass}" type="text" data-due-amount inputmode="numeric" maxlength="9" placeholder="1500" autocomplete="off">
                <span class="crm-due-widget__amount-currency" data-due-currency-code></span>
              </div>
            </div>
            <div class="crm-due-widget__cell crm-due-widget__cell--place">
              <span class="crm-due-widget__label">Місце</span>
              <select class="${inputClass}" data-due-place>${placeOptions(PLACES[0])}</select>
            </div>
            <div class="crm-due-widget__cell crm-due-widget__cell--action">
              <span class="crm-due-widget__label crm-due-widget__label--ghost" aria-hidden="true">&nbsp;</span>
              <button type="button" class="crm-due-widget__submit" data-due-add>Додати</button>
            </div>
          </div>
          <span class="crm-due-widget__preview mono" data-due-preview aria-live="polite"></span>
        </div>
      </div>`;

    const widget = root.querySelector('[data-due-widget]') || root;
    const ctx = {
      getStored: () => storedCurrency,
      getInput: () => getInputCurrency(storedCurrency, syncWithToolbar),
      syncWithToolbar,
    };

    renderList(widget, itemsToInput(storedItems, storedCurrency, ctx.getInput()), ctx.getInput());
    bindAdd(widget, ctx);
    updateAmountPreview(widget, ctx.getInput());

    const onToolbarChange = () => {
      if (!syncWithToolbar) return;
      const fromInput = widget.dataset.inputCurrency || ctx.getInput();
      const toInput = getInputCurrency(storedCurrency, syncWithToolbar);
      if (fromInput === toInput) return;
      const items = reconvertItems(readList(widget), storedCurrency, fromInput, toInput);
      renderList(widget, items, toInput);
      updateAmountPreview(widget, toInput);
    };
    document.addEventListener('crm:currency-change', onToolbarChange);

    return {
      read: () => {
        const inputCurrency = ctx.getInput();
        return readList(widget).map((item) => ({
          ...item,
          amount: toStoredAmount(item.amount, storedCurrency, inputCurrency),
        }));
      },
      setCurrency(nextCurrency) {
        const fromInput = ctx.getInput();
        storedCurrency = nextCurrency || 'CHF';
        const toInput = ctx.getInput();
        const items = reconvertItems(readList(widget), storedCurrency, fromInput, toInput);
        renderList(widget, items, toInput);
        updateAmountPreview(widget, toInput);
      },
      destroy() {
        document.removeEventListener('crm:currency-change', onToolbarChange);
      },
    };
  }

  function read(root) {
    const widget = root?.querySelector('[data-due-widget]') || root;
    return widget ? readList(widget) : [];
  }

  return { mount, read, formatAmount, PLACES };
})();

window.CrmDuePayments = CrmDuePayments;
