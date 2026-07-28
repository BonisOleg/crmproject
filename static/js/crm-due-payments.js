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

  function parseComposerAmount(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return 0;
    const digits = sanitizeDigits(text);
    if (digits) {
      const n = Number(digits);
      return Number.isFinite(n) ? n : 0;
    }
    if (window.CrmCurrency?.parseAmount) {
      const n = Math.round(CrmCurrency.parseAmount(text));
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  }

  function getComposerInput(root) {
    return root?.querySelector?.('input[data-due-amount]') || null;
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

  function setAmountError(root, message) {
    const box = root.querySelector('[data-due-amount-box]');
    const err = root.querySelector('[data-due-amount-error]');
    box?.classList.toggle('crm-due-widget__amount-box--error', Boolean(message));
    if (err) {
      err.hidden = !message;
      err.textContent = message || '';
    }
  }

  function readList(root) {
    const items = [];
    root.querySelectorAll('[data-due-item]').forEach((row) => {
      items.push({
        id: row.dataset.dueId,
        amount: Number(row.dataset.dueItemAmount) || 0,
        place: row.dataset.duePlace || PLACES[0],
      });
    });
    return items;
  }

  function updateAmountPreview(root, inputCurrency) {
    const input = getComposerInput(root);
    const preview = root.querySelector('[data-due-preview]');
    const codeEl = root.querySelector('[data-due-currency-code]');
    const code = inputCurrency || 'CHF';

    if (codeEl) codeEl.textContent = code;

    if (!preview || !input) return;
    const amount = parseComposerAmount(input.value);
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
      <div
        class="crm-due-widget__item"
        data-due-item
        data-due-id="${escapeHtml(item.id)}"
        data-due-item-amount="${item.amount}"
        data-due-place="${escapeHtml(item.place)}"
      >
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
    const addBtn = root.querySelector('[data-due-add]');
    let lastKnownAmount = 0;

    const syncKnownAmount = () => {
      const amountInput = getComposerInput(root);
      lastKnownAmount = parseComposerAmount(amountInput?.value);
      return lastKnownAmount;
    };

    root.addEventListener('input', (event) => {
      const amountInput = event.target?.closest?.('input[data-due-amount]');
      if (!amountInput || !root.contains(amountInput)) return;
      amountInput.value = sanitizeDigits(amountInput.value).slice(0, 9);
      setAmountError(root, '');
      syncKnownAmount();
      updateAmountPreview(root, ctx.getInput());
    });

    // iOS Safari: значення інколи «губиться» між blur і click — фіксуємо на pointerdown
    root.addEventListener('pointerdown', (event) => {
      if (!event.target?.closest?.('[data-due-add]')) return;
      syncKnownAmount();
    }, true);

    const addItem = ({ silent = false } = {}) => {
      const amountInput = getComposerInput(root);
      const inputCurrency = ctx.getInput();
      const amount = parseComposerAmount(amountInput?.value) || lastKnownAmount || 0;
      const place = root.querySelector('[data-due-place]')?.value || PLACES[0];

      if (!amount) {
        if (!silent) {
          setAmountError(root, 'Вкажіть суму');
          if (typeof showToast === 'function') showToast('Вкажіть суму', 'info');
          amountInput?.focus();
        }
        return false;
      }

      const items = readList(root);
      items.push({ id: `due-${Date.now()}-${items.length}`, amount, place });
      if (amountInput) amountInput.value = '';
      lastKnownAmount = 0;
      setAmountError(root, '');
      updateAmountPreview(root, inputCurrency);
      renderList(root, items, inputCurrency);
      root.dispatchEvent(new CustomEvent('crm:due-changed', { bubbles: true }));
      return true;
    };

    addBtn?.addEventListener('click', (event) => {
      event.preventDefault();
      addItem();
    });

    root.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      if (!event.target?.closest?.('input[data-due-amount]')) return;
      event.preventDefault();
      addItem();
    });

    root.__crmDueAddItem = addItem;
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
              <div class="crm-due-widget__amount-box" data-due-amount-box>
                <input class="${inputClass}" type="text" data-due-amount inputmode="numeric" maxlength="9" placeholder="1500" autocomplete="off" enterkeyhint="done">
                <span class="crm-due-widget__amount-currency" data-due-currency-code></span>
              </div>
              <p class="crm-due-widget__error" data-due-amount-error hidden></p>
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
        // Якщо сума введена, але «Додати» не натиснули — підхоплюємо чернетку
        widget.__crmDueAddItem?.({ silent: true });
        const inputCurrency = ctx.getInput();
        return readList(widget).map((item) => ({
          ...item,
          amount: toStoredAmount(item.amount, storedCurrency, inputCurrency),
        }));
      },
      commitDraft() {
        return Boolean(widget.__crmDueAddItem?.({ silent: true }));
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
        delete widget.__crmDueAddItem;
      },
    };
  }

  function read(root) {
    const widget = root?.querySelector('[data-due-widget]') || root;
    if (!widget) return [];
    widget.__crmDueAddItem?.({ silent: true });
    return readList(widget);
  }

  return { mount, read, formatAmount, PLACES };
})();

window.CrmDuePayments = CrmDuePayments;
