const CrmValidation = (() => {
  const RULES = {
    phone(value, required) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Заповніть номер телефону' : null;
      if (/[a-zA-Zа-яА-ЯіїєґІЇЄҐ]/.test(v)) return 'Лише цифри, +, пробіли та дужки';
      const digits = v.replace(/\D/g, '');
      if (digits.length < 10) return 'Мінімум 10 цифр';
      if (digits.length > 15) return 'Занадто довгий номер';
      return null;
    },

    name(value, required) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Заповніть це поле' : null;
      if (v.length < 2) return 'Мінімум 2 символи';
      if (/\d/.test(v)) return 'Не використовуйте цифри';
      if (!/^[\p{L}\s.'\-]+$/u.test(v)) return 'Лише літери та пробіли';
      return null;
    },

    text(value, required) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Заповніть це поле' : null;
      if (v.length < 2) return 'Мінімум 2 символи';
      return null;
    },

    car(value, required) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Вкажіть модель авто' : null;
      if (v.length < 2) return 'Мінімум 2 символи';
      return null;
    },

    criteria(value, required) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Опишіть критерії пошуку' : null;
      if (v.length < 8) return 'Мінімум 8 символів';
      return null;
    },

    telegram(value) {
      const v = String(value ?? '').trim();
      if (!v) return null;
      if (!/^@[a-zA-Z0-9_]{3,32}$/.test(v)) return 'Формат: @username (латиниця, цифри, _)';
      return null;
    },

    year(value, required) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Вкажіть рік' : null;
      if (!/^\d{4}$/.test(v)) return '4 цифри, напр. 2021';
      const year = Number(v);
      const max = new Date().getFullYear() + 1;
      if (year < 1990 || year > max) return `Рік від 1990 до ${max}`;
      return null;
    },

    price(value, required) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Вкажіть ціну' : null;
      if (!/^\d+$/.test(v)) return 'Лише цілі числа';
      const num = Number(v);
      if (num <= 0) return 'Ціна має бути більше 0';
      if (num > 9999999) return 'Занадто велика сума';
      return null;
    },

    integer(value, required, field) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Заповніть значення' : null;
      if (!/^\d+$/.test(v)) return 'Лише цілі числа';
      const num = Number(v);
      if (field.min != null && num < field.min) return `Мінімум ${field.min}`;
      if (field.max != null && num > field.max) return `Максимум ${field.max}`;
      return null;
    },

    route(value, required) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Вкажіть маршрут' : null;
      if (v.length < 5) return 'Мінімум 5 символів';
      if (!/[→\-–—]/.test(v)) return 'Вкажіть маршрут через → або -';
      return null;
    },

    select(value, required) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Оберіть значення зі списку' : null;
      return null;
    },

    paymentAmount(value, required, field, formEl) {
      const priceError = RULES.price(value, required);
      if (priceError) return priceError;
      if (!formEl || !window.CrmStore) return null;

      const dealId = getInput(formEl, 'deal_id')?.value;
      if (!dealId) return 'Спочатку оберіть угоду';

      const deal = CrmStore.getDeal(dealId);
      if (!deal) return 'Угоду не знайдено';
      if ((deal.debt || 0) <= 0) return 'У цієї угоди немає боргу';

      const amount = Number(value);
      const payCurrency = getInput(formEl, 'currency')?.value || deal.currency;
      let inDealCurrency = amount;
      if (window.CrmCurrency && payCurrency !== deal.currency) {
        inDealCurrency = Math.round(CrmCurrency.convert(amount, payCurrency, deal.currency));
      }
      if (inDealCurrency > deal.debt) {
        return `Максимум ${deal.debt.toLocaleString('uk-UA')} ${deal.currency} (поточний борг)`;
      }
      return null;
    },

    date(value, required) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Оберіть дату' : null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Некоректна дата';
      return null;
    },
  };

  function sanitizePhone(value) {
    return String(value ?? '').replace(/[^\d+\s\-()]/g, '');
  }

  function sanitizeDigits(value) {
    return String(value ?? '').replace(/\D/g, '');
  }

  function sanitizeTelegram(value) {
    let v = String(value ?? '').trim();
    if (!v) return '';
    v = v.replace(/\s/g, '');
    if (!v.startsWith('@')) v = `@${v.replace(/^@+/, '')}`;
    return v.replace(/[^@a-zA-Z0-9_]/g, '').slice(0, 33);
  }

  function getInput(formEl, name) {
    return formEl.querySelector(`[name="${name}"]`);
  }

  function clearFieldError(formEl, name) {
    const input = getInput(formEl, name);
    const errEl = formEl.querySelector(`[data-error-for="${name}"]`);
    input?.classList.remove('crm-modal__input--error', 'crm-modal__select--error', 'crm-modal__textarea--error');
    input?.removeAttribute('aria-invalid');
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
  }

  function showFieldError(formEl, name, message) {
    const input = getInput(formEl, name);
    const errEl = formEl.querySelector(`[data-error-for="${name}"]`);
    if (input) {
      const cls = input.tagName === 'SELECT'
        ? 'crm-modal__select--error'
        : input.tagName === 'TEXTAREA'
          ? 'crm-modal__textarea--error'
          : 'crm-modal__input--error';
      input.classList.add(cls);
      input.setAttribute('aria-invalid', 'true');
    }
    if (errEl) {
      errEl.textContent = message;
      errEl.hidden = false;
    }
  }

  function clearErrors(formEl) {
    formEl.querySelectorAll('.crm-modal__input, .crm-modal__select, .crm-modal__textarea').forEach((el) => {
      el.classList.remove('crm-modal__input--error', 'crm-modal__select--error', 'crm-modal__textarea--error');
      el.removeAttribute('aria-invalid');
    });
    formEl.querySelectorAll('[data-error-for]').forEach((el) => {
      el.hidden = true;
      el.textContent = '';
    });
  }

  function showErrors(formEl, errors) {
    errors.forEach(({ name, message }) => showFieldError(formEl, name, message));
    formEl.querySelector('.crm-modal__input--error, .crm-modal__select--error, .crm-modal__textarea--error')?.focus();
  }

  function setHint(formEl, name, text, tone = 'neutral') {
    const el = formEl.querySelector(`[data-hint-for="${name}"]`);
    if (!el) return;
    el.textContent = text;
    el.classList.remove('crm-modal__hint--ok', 'crm-modal__hint--warn');
    if (tone === 'ok') el.classList.add('crm-modal__hint--ok');
    if (tone === 'warn') el.classList.add('crm-modal__hint--warn');
  }

  function formatMoney(amount, currency) {
    return `${Number(amount || 0).toLocaleString('uk-UA')} ${currency}`;
  }

  function convertToDealCurrency(amount, from, to) {
    if (from === to) return amount;
    if (window.CrmCurrency) return Math.round(CrmCurrency.convert(amount, from, to));
    return amount;
  }

  function validateField(field, value, formEl) {
    const rule = field.validate || (field.type === 'select' ? 'select' : field.type === 'tel' ? 'phone' : field.type === 'date' ? 'date' : 'text');
    const fn = RULES[rule] || RULES.text;
    if (rule === 'paymentAmount') return fn(value, Boolean(field.required), field, formEl);
    return fn(value, Boolean(field.required), field);
  }

  function validateForm(config, data, formEl) {
    const errors = [];

    config.fields.forEach((field) => {
      const message = validateField(field, data[field.name], formEl);
      if (message) errors.push({ name: field.name, message });
    });

    if (config.storeType === 'carriers' && data.departure && data.eta && data.eta < data.departure) {
      errors.push({ name: 'eta', message: 'ETA не може бути раніше відправлення' });
    }

    if (config.storeType === 'payments' && data.date) {
      const today = CrmStore?.todayISO?.() || new Date().toISOString().slice(0, 10);
      if (data.date > today) {
        errors.push({ name: 'date', message: 'Дата платежу не може бути в майбутньому' });
      }
    }

    return errors;
  }

  function bindInputHandlers(formEl, field) {
    const input = getInput(formEl, field.name);
    if (!input) return;

    const rule = field.validate || (field.type === 'tel' ? 'phone' : null);

    if (rule === 'phone' || field.type === 'tel') {
      input.inputMode = 'tel';
      input.autocomplete = 'tel';
      input.maxLength = 20;
      input.addEventListener('input', () => {
        const next = sanitizePhone(input.value);
        if (next !== input.value) input.value = next;
        clearFieldError(formEl, field.name);
      });
    }

    if (rule === 'telegram') {
      input.autocomplete = 'off';
      input.maxLength = 33;
      input.addEventListener('input', () => {
        const next = sanitizeTelegram(input.value);
        if (next !== input.value) input.value = next;
        clearFieldError(formEl, field.name);
      });
    }

    if (rule === 'year' || rule === 'price' || rule === 'integer' || rule === 'paymentAmount') {
      input.inputMode = 'numeric';
      input.addEventListener('input', () => {
        const next = sanitizeDigits(input.value);
        if (field.validate === 'year') {
          input.value = next.slice(0, 4);
        } else {
          input.value = next.slice(0, 9);
        }
        clearFieldError(formEl, field.name);
      });
    }

    if (rule === 'name' || rule === 'car' || rule === 'text' || rule === 'criteria' || rule === 'route') {
      input.addEventListener('input', () => clearFieldError(formEl, field.name));
    }

    if (field.type === 'date') {
      input.addEventListener('change', () => clearFieldError(formEl, field.name));
    }

    input.addEventListener('blur', () => {
      const message = validateField(field, input.value, formEl);
      if (message) showFieldError(formEl, field.name, message);
    });

    if (field.type === 'select') {
      input.addEventListener('change', () => clearFieldError(formEl, field.name));
    }
  }

  function bindCarrierHints(formEl) {
    const carsInput = getInput(formEl, 'cars');
    const dep = getInput(formEl, 'departure');
    const eta = getInput(formEl, 'eta');

    const refreshCars = () => {
      const num = Number(carsInput?.value || 0);
      if (!num) {
        setHint(formEl, 'cars', 'Від 1 до 20 авто на один рейс');
        return;
      }
      if (num > 4) {
        setHint(formEl, 'cars', `${num} авто — перевищує типовий кузов (4)`, 'warn');
        return;
      }
      setHint(formEl, 'cars', `На возі буде ${num} з 4 місць`, 'ok');
    };

    const refreshDates = () => {
      if (dep?.value && eta?.value && eta.value < dep.value) {
        setHint(formEl, 'eta', 'ETA має бути не раніше дати відправлення', 'warn');
        return;
      }
      if (dep?.value && eta?.value) {
        const days = Math.round((new Date(eta.value) - new Date(dep.value)) / 86400000);
        setHint(formEl, 'eta', days > 0 ? `В дорозі ~${days} дн.` : 'ETA в той самий день', 'ok');
        return;
      }
      setHint(formEl, 'departure', 'Дата завантаження на автовоз');
      setHint(formEl, 'eta', 'Очікувана дата прибуття в Україну');
    };

    carsInput?.addEventListener('input', () => {
      refreshCars();
      clearFieldError(formEl, 'cars');
    });
    dep?.addEventListener('change', () => {
      refreshDates();
      clearFieldError(formEl, 'departure');
    });
    eta?.addEventListener('change', () => {
      refreshDates();
      clearFieldError(formEl, 'eta');
    });

    refreshCars();
    refreshDates();
  }

  function bindPaymentHints(formEl) {
    const dealSelect = getInput(formEl, 'deal_id');
    const amountInput = getInput(formEl, 'amount');
    const currencySelect = getInput(formEl, 'currency');
    const dateInput = getInput(formEl, 'date');

    const refreshDealHint = () => {
      const deal = dealSelect?.value ? CrmStore.getDeal(dealSelect.value) : null;
      if (!deal) {
        setHint(formEl, 'deal_id', 'Оберіть угоду з несплаченим боргом');
        return;
      }
      if ((deal.debt || 0) <= 0) {
        setHint(formEl, 'deal_id', 'У цієї угоди немає боргу — оберіть іншу', 'warn');
      } else {
        setHint(formEl, 'deal_id', `Поточний борг: ${formatMoney(deal.debt, deal.currency)}`);
      }
      if (currencySelect && deal.currency) currencySelect.value = deal.currency;
      refreshAmountHint();
    };

    const refreshAmountHint = () => {
      const deal = dealSelect?.value ? CrmStore.getDeal(dealSelect.value) : null;
      const raw = String(amountInput?.value ?? '').trim();
      if (!deal) {
        setHint(formEl, 'amount', 'Сума часткового або повного погашення боргу');
        return;
      }
      if (!raw) {
        setHint(formEl, 'amount', `Можна внести до ${formatMoney(deal.debt, deal.currency)}`);
        return;
      }
      const amount = Number(raw);
      const payCurrency = currencySelect?.value || deal.currency;
      const inDealCurrency = convertToDealCurrency(amount, payCurrency, deal.currency);
      if (Number.isNaN(amount) || amount <= 0) {
        setHint(formEl, 'amount', 'Вкажіть суму цілим числом', 'warn');
        return;
      }
      if (inDealCurrency > deal.debt) {
        setHint(formEl, 'amount', `Перевищує борг — max ${formatMoney(deal.debt, deal.currency)}`, 'warn');
        return;
      }
      const left = deal.debt - inDealCurrency;
      if (left <= 0) {
        setHint(formEl, 'amount', 'Угода буде повністю оплачена', 'ok');
        return;
      }
      setHint(formEl, 'amount', `Залишиться борг: ${formatMoney(left, deal.currency)}`, 'ok');
    };

    const refreshDateHint = () => {
      const today = CrmStore.todayISO();
      if (!dateInput?.value) {
        setHint(formEl, 'date', 'Дата отримання коштів від клієнта');
        return;
      }
      if (dateInput.value > today) {
        setHint(formEl, 'date', 'Дата не може бути в майбутньому', 'warn');
        return;
      }
      setHint(formEl, 'date', 'Дата платежу коректна', 'ok');
    };

    dealSelect?.addEventListener('change', () => {
      refreshDealHint();
      clearFieldError(formEl, 'deal_id');
    });
    amountInput?.addEventListener('input', () => {
      refreshAmountHint();
      clearFieldError(formEl, 'amount');
    });
    currencySelect?.addEventListener('change', () => {
      refreshAmountHint();
      clearFieldError(formEl, 'amount');
    });
    dateInput?.addEventListener('change', () => {
      refreshDateHint();
      clearFieldError(formEl, 'date');
    });

    refreshDealHint();
    refreshDateHint();
  }

  function bindCrossField(formEl, config) {
    if (config.storeType === 'carriers') {
      const dep = getInput(formEl, 'departure');
      const eta = getInput(formEl, 'eta');
      const check = () => {
        if (dep?.value && eta?.value && eta.value < dep.value) {
          showFieldError(formEl, 'eta', 'ETA не може бути раніше відправлення');
          return;
        }
        if (eta?.value) clearFieldError(formEl, 'eta');
      };
      dep?.addEventListener('change', check);
      eta?.addEventListener('change', check);
      return;
    }

    if (config.storeType === 'payments') {
      const amountInput = getInput(formEl, 'amount');
      const dealSelect = getInput(formEl, 'deal_id');
      const check = () => {
        const field = config.fields.find((f) => f.name === 'amount');
        const message = validateField(field, amountInput?.value, formEl);
        if (message && amountInput?.value) showFieldError(formEl, 'amount', message);
      };
      amountInput?.addEventListener('blur', check);
      dealSelect?.addEventListener('change', check);
    }
  }

  function bindLiveHints(formEl, config) {
    if (config.storeType === 'payments') bindPaymentHints(formEl);
    if (config.storeType === 'carriers') {
      if (window.CrmRoute) CrmRoute.bind(formEl);
      bindCarrierHints(formEl);
    }
  }

  function bindForm(formEl, config) {
    if (!formEl || !config) return;
    config.fields.forEach((field) => bindInputHandlers(formEl, field));
    bindCrossField(formEl, config);
    bindLiveHints(formEl, config);
  }

  return {
    bindForm,
    validateForm,
    clearErrors,
    showErrors,
    showFieldError,
    clearFieldError,
    setHint,
  };
})();

window.CrmValidation = CrmValidation;
