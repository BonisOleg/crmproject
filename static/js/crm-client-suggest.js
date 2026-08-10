/**
 * Автодоповнення імені клієнта в формі створення угоди (icontains API).
 */
const CrmClientSuggest = (() => {
  const ENDPOINT = '/api/clients/suggest/';
  const MIN_CHARS = 1;
  const DEBOUNCE_MS = 180;

  function bind(formEl) {
    const input = formEl.querySelector('[name="client"]');
    if (!input || input.dataset.clientSuggestBound === '1') return;
    input.dataset.clientSuggestBound = '1';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'words');
    input.setAttribute('spellcheck', 'false');

    const wrap = input.closest('[data-client-combo]') || input.parentElement;
    if (wrap && !wrap.classList.contains('crm-modal__combo')) {
      wrap.classList.add('crm-modal__combo');
    }

    let list = wrap.querySelector('.crm-modal__suggest');
    if (!list) {
      list = document.createElement('ul');
      list.className = 'crm-modal__suggest';
      list.setAttribute('role', 'listbox');
      list.hidden = true;
      wrap.appendChild(list);
    }

    let timer = null;
    let abortCtrl = null;
    let activeIndex = -1;

    function hide() {
      list.hidden = true;
      list.innerHTML = '';
      activeIndex = -1;
    }

    function pick(name) {
      input.value = name;
      hide();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }

    function render(items) {
      list.innerHTML = '';
      activeIndex = -1;
      if (!items.length) {
        hide();
        return;
      }
      items.forEach((item, idx) => {
        const li = document.createElement('li');
        li.className = 'crm-modal__suggest-item';
        li.setAttribute('role', 'option');
        li.dataset.index = String(idx);
        li.textContent = item.name;
        li.addEventListener('mousedown', (event) => {
          event.preventDefault();
          pick(item.name);
        });
        list.appendChild(li);
      });
      list.hidden = false;
    }

    function highlight(next) {
      const items = list.querySelectorAll('.crm-modal__suggest-item');
      if (!items.length) return;
      activeIndex = (next + items.length) % items.length;
      items.forEach((el, i) => {
        el.classList.toggle('crm-modal__suggest-item--active', i === activeIndex);
      });
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }

    function fetchSuggest(q) {
      if (abortCtrl) abortCtrl.abort();
      abortCtrl = new AbortController();
      const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&limit=8`;
      fetch(url, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal: abortCtrl.signal,
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((payload) => {
          const rows = Array.isArray(payload?.data) ? payload.data : (payload?.data?.results || []);
          const items = (Array.isArray(rows) ? rows : [])
            .map((row) => ({ name: String(row.name || row).trim() }))
            .filter((row) => row.name);
          render(items);
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          hide();
        });
    }

    input.addEventListener('input', () => {
      const q = input.value.trim();
      window.clearTimeout(timer);
      if (q.length < MIN_CHARS) {
        hide();
        return;
      }
      // Стан: очікування debounce → запит API → dropdown
      timer = window.setTimeout(() => fetchSuggest(q), DEBOUNCE_MS);
    });

    input.addEventListener('keydown', (event) => {
      if (list.hidden) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        highlight(activeIndex + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        highlight(activeIndex - 1);
      } else if (event.key === 'Enter' && activeIndex >= 0) {
        event.preventDefault();
        const el = list.querySelector(`.crm-modal__suggest-item[data-index="${activeIndex}"]`);
        if (el) pick(el.textContent);
      } else if (event.key === 'Escape') {
        hide();
      }
    });

    input.addEventListener('blur', () => {
      window.setTimeout(hide, 120);
    });
  }

  return { bind };
})();

window.CrmClientSuggest = CrmClientSuggest;
