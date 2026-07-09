/**
 * Автодоповнення міст у полі маршруту (CH → UA)
 */
const CrmRoute = (() => {
  const ARROW = ' → ';

  const CITIES = [
    'Цюрих', 'Берн', 'Женева', 'Базель', 'Люцерн',
    'Гамбург', 'Мюнхен', 'Берлін', 'Франкфурт', 'Штутгарт', 'Кельн',
    'Львів', 'Київ', 'Одеса', 'Харків', 'Дніпро', 'Запоріжжя', 'Вінниця',
    'Відень', 'Прага',
  ];

  function normalize(str) {
    return String(str ?? '').trim().toLowerCase();
  }

  function parseRoute(value) {
    const match = String(value ?? '').match(/^(.+?)\s*[→\-–—]\s*(.*)$/);
    if (match) {
      return {
        origin: match[1].trim(),
        destination: match[2].trim(),
        hasArrow: true,
      };
    }
    return { origin: String(value ?? '').trim(), destination: '', hasArrow: false };
  }

  function filterCities(query, limit = 8) {
    const q = normalize(query);
    if (!q) return CITIES.slice(0, limit);
    return CITIES.filter((city) => normalize(city).includes(q)).slice(0, limit);
  }

  function bind(formEl) {
    const input = formEl.querySelector('[name="route"]');
    if (!input) return;

    const wrap = input.closest('[data-route-combo]') || input.parentElement;
    let list = wrap.querySelector('.crm-modal__suggest');
    if (!list) {
      list = document.createElement('ul');
      list.className = 'crm-modal__suggest';
      list.setAttribute('role', 'listbox');
      list.hidden = true;
      wrap.appendChild(list);
    }

    let hideTimer = null;

    function hideSuggestions() {
      list.hidden = true;
      list.innerHTML = '';
    }

    function showSuggestions(items, onPick) {
      list.innerHTML = '';
      if (!items.length) {
        hideSuggestions();
        return;
      }
      items.forEach((city) => {
        const li = document.createElement('li');
        li.className = 'crm-modal__suggest-item';
        li.setAttribute('role', 'option');
        li.textContent = city;
        li.addEventListener('mousedown', (event) => {
          event.preventDefault();
          onPick(city);
        });
        list.appendChild(li);
      });
      list.hidden = false;
    }

    function updateHint() {
      if (!window.CrmValidation?.setHint) return;
      const parsed = parseRoute(input.value);
      if (!parsed.origin) {
        CrmValidation.setHint(formEl, 'route', 'Почніть вводити місто відправлення');
        return;
      }
      if (!parsed.hasArrow) {
        CrmValidation.setHint(formEl, 'route', 'Оберіть місто зі списку — стрілку → додамо автоматично');
        return;
      }
      if (!parsed.destination) {
        CrmValidation.setHint(formEl, 'route', 'Тепер оберіть місто прибуття в Україну');
        return;
      }
      CrmValidation.setHint(formEl, 'route', 'Маршрут виглядає коректно', 'ok');
    }

    function pickCity(city) {
      const parsed = parseRoute(input.value);
      if (!parsed.hasArrow) {
        input.value = `${city}${ARROW}`;
        input.focus();
        const pos = input.value.length;
        input.setSelectionRange(pos, pos);
        showSuggestions(filterCities(''), pickCity);
        updateHint();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      input.value = `${parsed.origin}${ARROW}${city}`;
      hideSuggestions();
      updateHint();
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function refreshSuggestions() {
      const parsed = parseRoute(input.value);
      if (parsed.hasArrow && parsed.destination) {
        const exact = CITIES.find((c) => normalize(c) === normalize(parsed.destination));
        if (exact) {
          hideSuggestions();
          updateHint();
          return;
        }
      }

      const query = parsed.hasArrow ? parsed.destination : parsed.origin;
      showSuggestions(filterCities(query), pickCity);
      updateHint();
    }

    input.addEventListener('input', () => {
      window.clearTimeout(hideTimer);
      refreshSuggestions();
      if (window.CrmValidation?.clearFieldError) {
        CrmValidation.clearFieldError(formEl, 'route');
      }
    });

    input.addEventListener('focus', refreshSuggestions);

    input.addEventListener('blur', () => {
      hideTimer = window.setTimeout(hideSuggestions, 180);
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hideSuggestions();
    });

    updateHint();
  }

  return { bind, parseRoute, ARROW, CITIES };
})();

window.CrmRoute = CrmRoute;
