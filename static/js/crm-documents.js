/**
 * Прикріплення документів до угоди / рядка звіту
 */
const CrmDocuments = (() => {
  const ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function todayISO() {
    return window.CrmStore?.todayISO?.() || new Date().toISOString().slice(0, 10);
  }

  function readList(root) {
    const items = [];
    root.querySelectorAll('[data-doc-item]').forEach((row) => {
      items.push({
        id: row.dataset.docId,
        name: row.dataset.docName || '',
        added: row.dataset.docAdded || '',
      });
    });
    return items;
  }

  function renderList(root, items) {
    const list = root.querySelector('[data-doc-list]');
    if (!list) return;

    if (!items.length) {
      list.innerHTML = '';
      root.classList.remove('crm-doc-widget--filled');
      return;
    }

    root.classList.add('crm-doc-widget--filled');
    list.innerHTML = items.map((doc) => `
      <div class="crm-doc-widget__item" data-doc-item data-doc-id="${escapeHtml(doc.id)}" data-doc-name="${escapeHtml(doc.name)}" data-doc-added="${escapeHtml(doc.added || '')}">
        <span class="crm-doc-widget__icon" aria-hidden="true">📄</span>
        <div class="crm-doc-widget__body">
          <div class="crm-doc-widget__name">${escapeHtml(doc.name)}</div>
          <div class="crm-doc-widget__meta">${escapeHtml(doc.added || '')}</div>
        </div>
        <button type="button" class="crm-doc-widget__remove" data-doc-remove="${escapeHtml(doc.id)}" aria-label="Видалити ${escapeHtml(doc.name)}">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>`).join('');

    list.querySelectorAll('[data-doc-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = readList(root).filter((row) => row.id !== btn.dataset.docRemove);
        renderList(root, next);
        root.dispatchEvent(new CustomEvent('crm:doc-changed', { bubbles: true }));
      });
    });
  }

  function bindUpload(root) {
    const input = root.querySelector('[data-doc-input]');
    input?.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const items = readList(root);
      items.unshift({
        id: `doc-${Date.now()}`,
        name: file.name,
        added: todayISO(),
      });
      renderList(root, items);
      root.dispatchEvent(new CustomEvent('crm:doc-changed', { bubbles: true }));
      if (typeof showToast === 'function') showToast(`Файл «${file.name}» прикріплено`, 'success');
      event.target.value = '';
    });
  }

  function mount(root, options = {}) {
    if (!root) return null;
    const items = Array.isArray(options.items) ? options.items : [];
    const title = options.title || 'Документи';

    root.innerHTML = `
      <div class="crm-doc-widget" data-doc-widget>
        <div class="crm-doc-widget__head">
          <span class="crm-doc-widget__title">${escapeHtml(title)}</span>
          <label class="crm-doc-widget__upload">
            Прикріпити
            <input type="file" data-doc-input accept="${ACCEPT}">
          </label>
        </div>
        <div class="crm-doc-widget__list" data-doc-list></div>
      </div>`;

    const widget = root.querySelector('[data-doc-widget]') || root;
    renderList(widget, items);
    bindUpload(widget);

    return {
      read: () => readList(widget),
    };
  }

  function read(root) {
    const widget = root?.querySelector('[data-doc-widget]') || root;
    return widget ? readList(widget) : [];
  }

  return { mount, read };
})();

window.CrmDocuments = CrmDocuments;
