const CrmDelete = (() => {
  const TRASH_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>`;

  const CARD_RULES = [
    {
      type: 'clients',
      selector: '[data-clients-list] .client-card',
      readKey(card) {
        return card.dataset.crmKey
          || card.dataset.clientId
          || card.querySelector('.client-card__name')?.textContent?.trim();
      },
      label(card) {
        return card.querySelector('.client-card__name')?.textContent?.trim() || 'клієнта';
      },
    },
    {
      type: 'leads',
      selector: '[data-leads-list] .lead-card',
      readKey(card) {
        return card.dataset.crmKey
          || card.dataset.leadId
          || card.querySelector('.lead-card__id')?.textContent?.trim();
      },
      label(card) {
        const id = card.querySelector('.lead-card__id')?.textContent?.trim();
        const name = card.querySelector('.lead-card__name')?.textContent?.trim();
        return id && name ? `${id} · ${name}` : (name || 'запит');
      },
    },
    {
      type: 'carriers',
      selector: '[data-carriers-list] .carrier-card',
      readKey(card) {
        return card.dataset.crmKey
          || card.dataset.carrierId
          || card.querySelector('.mono.text-accent')?.textContent?.trim();
      },
      label(card) {
        const id = card.querySelector('.mono.text-accent')?.textContent?.trim();
        const route = card.querySelector('.carrier-card__route')?.textContent?.trim();
        return id && route ? `${id} · ${route}` : (route || 'рейс');
      },
    },
    {
      type: 'deals',
      selector: '[data-crm-card="deals"]',
      readKey(card) {
        return card.dataset.crmKey
          || card.dataset.dealId
          || card.querySelector('.deal-card__id, .kanban-card__id')?.textContent?.trim();
      },
      label(card) {
        const id = card.querySelector('.deal-card__id, .kanban-card__id')?.textContent?.trim();
        const title = card.querySelector('.deal-card__title, .kanban-card__title')?.textContent?.trim();
        return id && title ? `${id} · ${title}` : (title || 'угоду');
      },
    },
  ];

  function init() {
    enhanceAll();
    purgeHidden();
    document.addEventListener('crm:added', onItemAdded);
  }

  function onItemAdded() {
    enhanceAll();
  }

  function enhanceAll() {
    CARD_RULES.forEach((rule) => {
      document.querySelectorAll(rule.selector).forEach((card) => {
        enhanceCard(card, rule);
      });
    });
  }

  function createDeleteButton(card, rule) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card-delete-btn';
    btn.dataset.crmDelete = '';
    btn.setAttribute('aria-label', 'Видалити');
    btn.innerHTML = TRASH_ICON;
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      requestDelete(card, rule);
    });
    return btn;
  }

  function enhanceCard(card, rule) {
    if (!rule) {
      rule = CARD_RULES.find((item) => card.matches(item.selector));
    }
    if (!rule) return card;

    const key = rule.readKey(card);
    if (!key) return card;

    card.dataset.crmCard = rule.type;
    card.dataset.crmKey = key;
    card.classList.add('crm-card--deletable');

    if (rule.type === 'clients') card.dataset.clientId = key;
    if (rule.type === 'leads') card.dataset.leadId = key;
    if (rule.type === 'carriers') card.dataset.carrierId = key;
    if (rule.type === 'deals') card.dataset.dealId = key;

    const existingBtn = card.querySelector('[data-crm-delete]');
    if (existingBtn) {
      existingBtn.remove();
    }

    const btn = createDeleteButton(card, rule);

    if (card.tagName === 'TR') {
      let actionsCell = card.querySelector('.data-table__actions');
      if (!actionsCell) {
        actionsCell = document.createElement('td');
        actionsCell.className = 'data-table__actions';
        actionsCell.addEventListener('click', (event) => event.stopPropagation());
        card.appendChild(actionsCell);
      }
      actionsCell.appendChild(btn);
      return card;
    }

    card.appendChild(btn);
    return card;
  }

  function purgeHidden() {
    document.querySelectorAll('[data-crm-card][data-crm-key]').forEach((card) => {
      const type = card.dataset.crmCard;
      const key = card.dataset.crmKey;
      if (type && key && CrmStore.isHidden(type, key)) {
        card.remove();
      }
    });
  }

  function requestDelete(card, rule) {
    const type = card.dataset.crmCard || rule?.type;
    const key = card.dataset.crmKey;
    if (!type || !key) return;

    const activeRule = rule || CARD_RULES.find((item) => item.type === type);
    const label = activeRule ? activeRule.label(card) : 'запис';

    if (typeof CrmModal?.confirm !== 'function') {
      if (window.confirm(`Видалити «${label}»?`)) {
        performDelete(type, key, card.dataset.customItem === 'true');
      }
      return;
    }

    CrmModal.confirm({
      title: 'Видалити?',
      message: `«${label}» буде прибрано зі списку.`,
      onConfirm: () => performDelete(type, key, card.dataset.customItem === 'true'),
    });
  }

  async function performDelete(type, key, isCustom) {
    try {
      await CrmStore.removeItem(type, key);
    } catch {
      return;
    }

    removeFromDom(type, key);
    notifyRemoved(type);

    if (typeof showToast === 'function') {
      showToast('Запис видалено', 'info');
    }
  }

  function removeFromDom(type, key) {
    document.querySelectorAll(`[data-crm-card="${type}"]`).forEach((node) => {
      if (node.dataset.crmKey !== key) return;
      node.classList.add('card--removing');
      window.setTimeout(() => node.remove(), 260);
    });
  }

  function notifyRemoved(type) {
    document.dispatchEvent(new CustomEvent('crm:removed', { detail: { type } }));
    if (type === 'leads' && typeof window.refreshLeadFilters === 'function') {
      window.refreshLeadFilters();
    }
    if (type === 'deals' && typeof window.refreshDealFilters === 'function') {
      window.refreshDealFilters();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  return { enhanceCard, enhanceAll };
})();

window.CrmDelete = CrmDelete;
