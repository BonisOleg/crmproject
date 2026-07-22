/**
 * Мультивалютність Autolot CRM (CHF · EUR · USD)
 * Курси через CHF; EUR з налаштувань (44.85/47.20 UAH)
 */
const CrmCurrency = (() => {
  const STORAGE_KEY = 'autolot-currency';
  const CODES = ['CHF', 'EUR', 'USD'];

  /** Скільки CHF в 1 одиниці валюти */
  const TO_CHF = {
    CHF: 1,
    EUR: 44.85 / 47.2,
    USD: 0.892,
  };

  function get() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return CODES.includes(saved) ? saved : 'CHF';
  }

  function isActive() {
    return !window.CrmPackages || CrmPackages.has('currency_switch');
  }

  function convert(amount, from, to) {
    const value = parseAmount(amount);
    const src = TO_CHF[from] ?? 1;
    const dst = TO_CHF[to] ?? 1;
    if (from === to) return value;
    return (value * src) / dst;
  }

  function formatNum(value) {
    return Math.round(Number(value) || 0).toLocaleString('uk-UA');
  }

  /** Парсить суми з data-атрибутів (uk: "4800,00" / "4 800,00"). */
  function parseAmount(value) {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    let raw = String(value ?? '').trim();
    if (!raw) return 0;
    raw = raw.replace(/\s/g, '').replace(/'/g, '');
    if (raw.includes(',') && raw.includes('.')) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else if (raw.includes(',')) {
      raw = raw.replace(',', '.');
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function label(amount, currency) {
    return `${formatNum(amount)} ${currency}`;
  }

  function display(amount, fromCurrency, targetCurrency) {
    const target = targetCurrency || (isActive() ? get() : fromCurrency);
    if (!isActive() || target === fromCurrency) {
      return label(amount, fromCurrency);
    }
    return label(convert(amount, fromCurrency, target), target);
  }

  function saveOriginal(el, prop) {
    const key = prop === 'html' ? 'moneyOriginalHtml' : 'moneyOriginalText';
    if (el.dataset[key] == null) {
      el.dataset[key] = prop === 'html' ? el.innerHTML : el.textContent;
    }
  }

  function restore(el, prop) {
    const key = prop === 'html' ? 'moneyOriginalHtml' : 'moneyOriginalText';
    if (el.dataset[key] != null) {
      if (prop === 'html') el.innerHTML = el.dataset[key];
      else el.textContent = el.dataset[key];
    }
  }

  function applyMoneyNodes() {
    document.querySelectorAll('[data-money]').forEach((el) => {
      saveOriginal(el, 'text');
      if (!isActive()) {
        restore(el, 'text');
        return;
      }
      const amount = parseAmount(el.dataset.money);
      const from = el.dataset.moneyCurrency || 'CHF';
      const prefix = el.dataset.moneyPrefix || '';
      const sign = el.dataset.moneySign || '';
      const converted = convert(amount, from, get());
      const value = `${formatNum(converted)} ${get()}`;
      if (sign === '+') {
        el.textContent = `${prefix}+${value}`;
      } else if (sign === '−' || sign === '-') {
        el.textContent = `${prefix}−${value}`;
      } else {
        el.textContent = `${prefix}${value}`;
      }
    });
  }

  function applyCompositeNodes() {
    document.querySelectorAll('[data-money-composite]').forEach((el) => {
      const mode = el.dataset.moneyCompositeMode || 'breakdown';
      const storeAs = mode === 'total' ? 'text' : 'html';
      saveOriginal(el, storeAs);
      el.hidden = false;

      if (!isActive()) {
        restore(el, storeAs);
        return;
      }

      let parts;
      try {
        parts = JSON.parse(el.dataset.moneyComposite);
      } catch {
        return;
      }

      const target = get();
      const prefix = el.dataset.moneyPrefix || '';

      if (mode === 'total') {
        if (target === 'CHF') {
          el.hidden = true;
          return;
        }
        const total = parts.reduce(
          (sum, part) => sum + convert(part.amount, part.currency, target),
          0
        );
        el.textContent = prefix + label(total, target);
        return;
      }

      if (target === 'CHF') {
        const totalAmount = el.dataset.moneyCompositeTotal;
        const totalCurrency = el.dataset.moneyCompositeTotalCurrency || 'CHF';
        if (totalAmount) {
          el.textContent = label(parseAmount(totalAmount), totalCurrency);
        } else {
          const total = parts.reduce(
            (sum, part) => sum + convert(part.amount, part.currency, 'CHF'),
            0
          );
          el.textContent = label(total, 'CHF');
        }
        return;
      }

      const lines = parts.map((part) => label(convert(part.amount, part.currency, target), target));
      el.innerHTML = lines.join('<br>');
    });
  }

  function applyReportNote() {
    document.querySelectorAll('[data-report-currency-note]').forEach((el) => {
      saveOriginal(el, 'text');
      if (!isActive()) {
        restore(el, 'text');
        return;
      }
      const month = el.dataset.reportMonth || '';
      const count = el.dataset.reportCount || '';
      el.textContent = `${month} · усі суми у ${get()} · ${count} угод`;
    });
  }

  function applyToolbar() {
    const group = document.querySelector('.wf-currency');
    if (!group) return;
    const active = get();
    group.querySelectorAll('[data-currency]').forEach((btn) => {
      btn.classList.toggle('wf-currency__btn--active', btn.dataset.currency === active);
    });
    document.documentElement.dataset.currency = active;
  }

  function applyAll() {
    applyToolbar();
    applyMoneyNodes();
    applyCompositeNodes();
    applyReportNote();
  }

  function set(code) {
    if (!CODES.includes(code)) return;
    if (!isActive()) {
      if (window.CrmPackages) CrmPackages.notifyLocked('currency_switch');
      return;
    }
    localStorage.setItem(STORAGE_KEY, code);
    applyAll();
    document.dispatchEvent(new CustomEvent('crm:currency-change', { detail: { currency: code } }));
    if (typeof showToast === 'function') {
      showToast(`Валюта відображення: ${code}`, 'success');
    }
  }

  function initToolbar() {
    const group = document.querySelector('.wf-currency');
    if (!group) return;

    group.querySelectorAll('[data-currency]').forEach((btn) => {
      if (btn.dataset.currencyBound) return;
      btn.dataset.currencyBound = 'true';
      btn.addEventListener('click', () => set(btn.dataset.currency));
    });

    applyToolbar();
    applyAll();
  }

  document.documentElement.dataset.currency = get();

  return {
    get,
    set,
    convert,
    display,
    label,
    formatNum,
    parseAmount,
    isActive,
    applyAll,
    initToolbar,
    TO_CHF,
  };
})();

window.CrmCurrency = CrmCurrency;

document.addEventListener('crm:added', () => {
  CrmCurrency.applyAll();
});
