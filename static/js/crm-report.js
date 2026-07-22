/**
 * Місячні звіти Виграні / Підтверджені (сервер / API)
 */
const CrmReport = (() => {
  const COL_COUNT = 8;
  const TYPE_STAGE = { won: 'Виграно', confirmed: 'Підтверджено' };
  const STAGE_TYPE = { Виграно: 'won', Підтверджено: 'confirmed' };

  let baseRows = [];
  let extras = [];
  let overrides = {};
  let reportType = 'won';
  let monthKey = '';
  let monthLabel = '';
  let activeMonthKey = '';
  let readonly = false;
  let modalEl;
  let formEl;
  let tbodyEl;
  let lastFocus = null;

  function readJson(_key, fallback) {
    return fallback;
  }

  function writeJson() {
    /* SoT — сервер */
  }

  function overrideKey() {
    return '';
  }

  function extraKey() {
    return '';
  }

  function readMeta() {
    const node = document.getElementById('crm-report-meta');
    if (!node) return null;
    return {
      type: node.dataset.reportType || 'won',
      month: node.dataset.reportMonth || '',
      monthLabel: node.dataset.reportMonthLabel || '',
      readonly: node.dataset.reportReadonly === 'true',
      activeMonth: node.dataset.reportActiveMonth || '',
    };
  }

  function readBase() {
    const node = document.getElementById('crm-report-catalog');
    if (!node) return [];
    try {
      return JSON.parse(node.textContent || '[]');
    } catch {
      return [];
    }
  }

  function calendarMonthKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

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

  function formatNum(value) {
    return Math.round(Number(value) || 0).toLocaleString('uk-UA');
  }

  function defaultStage() {
    return TYPE_STAGE[reportType] || 'Виграно';
  }

  function recalcRow(row) {
    const price = Number(row.price) || 0;
    const cost = Number(row.cost) || 0;
    return {
      ...row,
      profit: Math.max(0, price - cost),
      currency: row.currency || 'CHF',
      won_currency: row.won_currency || row.currency || 'CHF',
      bid_currency: row.bid_currency || row.currency || 'CHF',
      cost_currency: row.cost_currency || row.currency || 'CHF',
      price_currency: row.price_currency || row.currency || 'CHF',
      delivery_currency: row.delivery_currency || row.currency || 'CHF',
    };
  }

  function applyDealSync(row) {
    const dealId = row.deal_id || (/^AL-2026-\d+$/.test(String(row.id || '')) ? row.id : null);
    if (!dealId || !window.CrmStore) return row;
    const deal = CrmStore.getDeal(dealId);
    if (!deal) return row;
    return {
      ...row,
      ...CrmStore.dealToReportRow(deal),
      id: row.id,
      deal_id: dealId,
    };
  }

  function mergeRow(row, overrides) {
    if (row.deal_id || /^AL-2026-\d+$/.test(String(row.id || ''))) {
      return recalcRow(applyDealSync(row));
    }
    return recalcRow({ ...row, ...(overrides[row.id] || {}) });
  }

  function getOverrides() {
    return overrides;
  }

  function getExtras() {
    return extras;
  }

  function setOverrides(value) {
    if (readonly) return;
    overrides = value || {};
  }

  function setExtras(value) {
    if (readonly) return;
    extras = Array.isArray(value) ? value : [];
  }

  function mergeRows() {
    const overrides = getOverrides();
    const extras = getExtras();
    const base = baseRows.map((row) => mergeRow(row, overrides));
    const extra = extras.map((row) => mergeRow(row, overrides));
    return [...base, ...extra];
  }

  function resolveRowDealId(row) {
    return row.deal_id || (/^AL-2026-\d+$/.test(String(row.id || '')) ? row.id : null);
  }

  function getRowDocuments(row) {
    if (Array.isArray(row.documents) && row.documents.length) return row.documents;
    const dealId = resolveRowDealId(row);
    if (dealId && window.CrmStore) return CrmStore.getDeal(dealId)?.documents || [];
    return row.documents || [];
  }

  function formatDocBadge(row) {
    const count = getRowDocuments(row).length;
    if (!count) return '';
    return `<span class="report-table__doc-badge" title="${count} док.">📄 ${count}</span>`;
  }

  function renderCarCell(row) {
    const badge = formatDocBadge(row);
    if (!row.deal_id) return `<strong>${escapeHtml(row.car)}</strong>${badge}`;
    return `<a href="/deals/${encodeURIComponent(row.deal_id)}/" class="report-table__deal-link">${escapeHtml(row.car)}</a>${badge}`;
  }

  function isCustomRow(id) {
    return getExtras().some((row) => row.id === id);
  }

  function isEdited(id) {
    return Boolean(getOverrides()[id]) || isCustomRow(id);
  }

  function ensureMonthRollover(serverActiveMonth) {
    const nowMonth = serverActiveMonth || calendarMonthKey();
    if (window.CrmApi) {
      CrmApi.reports.rollover().catch(() => {});
    }
    return nowMonth;
  }

  function updateReportCount(count) {
    const note = document.querySelector('[data-report-currency-note]');
    if (!note) return;
    note.dataset.reportCount = String(count);
    const month = note.dataset.reportMonth || monthLabel;
    note.textContent = `${month} · ${count} угод`;
  }

  function renderTable() {
    if (!tbodyEl) return;
    const rows = mergeRows();
    const overrides = getOverrides();
    updateReportCount(rows.length);

    if (!rows.length) {
      tbodyEl.innerHTML = `<tr class="report-table__empty"><td colspan="${COL_COUNT}">Немає угод у цьому звіті</td></tr>`;
      return;
    }

    tbodyEl.innerHTML = rows.map((row) => {
      const edited = !readonly && (overrides[row.id] || isCustomRow(row.id) || row.deal_id);
      const deliveryCost = Number(row.delivery_cost) || 0;
      const deliveryCell = row.delivery_type === 'ours' && deliveryCost > 0
        ? `<span class="mono">${formatNum(deliveryCost)}</span> <span class="report-table__cur">${escapeHtml(row.delivery_currency || row.currency)}</span>`
        : '—';
      const dealAttr = row.deal_id ? ` data-deal-id="${escapeHtml(row.deal_id)}"` : '';
      const interactive = readonly
        ? ''
        : ' tabindex="0" role="button"';
      const aria = readonly ? '' : ` aria-label="Редагувати ${escapeHtml(row.car)}"`;
      return `
        <tr
          class="report-table__row${edited ? ' report-table__row--edited' : ''}${readonly ? ' report-table__row--readonly' : ''}"
          data-report-row
          data-report-id="${escapeHtml(row.id)}"${dealAttr}${interactive}${aria}
        >
          <td data-col="car" data-label="Авто">${renderCarCell(row)}</td>
          <td data-col="client" data-label="Клієнт"><span>${escapeHtml(row.client)}</span></td>
          <td class="mono report-table__num" data-col="won" data-label="Виграна" data-field="won_price" data-money="${row.won_price || 0}" data-money-currency="${row.won_currency || row.currency}">${formatNum(row.won_price || 0)} <span class="report-table__cur">${escapeHtml(row.won_currency || row.currency)}</span></td>
          <td class="mono report-table__num" data-col="bid" data-label="Ставка" data-field="bid" data-money="${row.bid || 0}" data-money-currency="${row.bid_currency || row.currency}">${formatNum(row.bid || 0)} <span class="report-table__cur">${escapeHtml(row.bid_currency || row.currency)}</span></td>
          <td class="mono report-table__num" data-col="cost" data-label="Собівартість" data-field="cost" data-money="${row.cost}" data-money-currency="${row.cost_currency || row.currency}">${formatNum(row.cost)} <span class="report-table__cur">${escapeHtml(row.cost_currency || row.currency)}</span></td>
          <td class="mono report-table__num" data-col="price" data-label="Клієнту" data-field="price" data-money="${row.price}" data-money-currency="${row.price_currency || row.currency}">${formatNum(row.price)} <span class="report-table__cur">${escapeHtml(row.price_currency || row.currency)}</span></td>
          <td class="mono report-table__num report-table__delivery" data-col="delivery" data-label="Доставка">${deliveryCell}</td>
          <td class="mono report-table__num text-green" data-col="profit" data-label="Прибуток" data-field="profit" data-money="${row.profit}" data-money-currency="${row.currency}" data-money-sign="+">+${formatNum(row.profit)} <span class="report-table__cur">${escapeHtml(row.currency)}</span></td>
        </tr>`;
    }).join('');

    tbodyEl.querySelectorAll('.data-table__actions, .card-delete-btn').forEach((node) => {
      node.remove();
    });

    if (window.CrmCurrency) CrmCurrency.applyAll();
  }

  function findRow(id) {
    return mergeRows().find((item) => item.id === id) || null;
  }

  function updateCalcPreview() {
    const cost = Number(sanitizeDigits(formEl.cost?.value || '0')) || 0;
    const price = Number(sanitizeDigits(formEl.price?.value || '0')) || 0;
    const el = document.getElementById('report-edit-profit');
    if (el) el.textContent = formatNum(Math.max(0, price - cost));
  }

  function mountModal() {
    if (modalEl && modalEl.parentElement !== document.body) {
      document.body.appendChild(modalEl);
    }
  }

  return {
    COL_COUNT,
    TYPE_STAGE,
    STAGE_TYPE,
    get state() {
      return {
        baseRows,
        reportType,
        monthKey,
        monthLabel,
        activeMonthKey,
        readonly,
        modalEl,
        formEl,
        tbodyEl,
        lastFocus,
      };
    },
    setState(partial) {
      if (partial.baseRows !== undefined) baseRows = partial.baseRows;
      if (partial.reportType !== undefined) reportType = partial.reportType;
      if (partial.monthKey !== undefined) monthKey = partial.monthKey;
      if (partial.monthLabel !== undefined) monthLabel = partial.monthLabel;
      if (partial.activeMonthKey !== undefined) activeMonthKey = partial.activeMonthKey;
      if (partial.readonly !== undefined) readonly = partial.readonly;
      if (partial.modalEl !== undefined) modalEl = partial.modalEl;
      if (partial.formEl !== undefined) formEl = partial.formEl;
      if (partial.tbodyEl !== undefined) tbodyEl = partial.tbodyEl;
      if (partial.lastFocus !== undefined) lastFocus = partial.lastFocus;
    },
    readMeta,
    readBase,
    calendarMonthKey,
    sanitizeDigits,
    escapeHtml,
    formatNum,
    defaultStage,
    recalcRow,
    getOverrides,
    getExtras,
    setOverrides,
    setExtras,
    mergeRows,
    resolveRowDealId,
    isCustomRow,
    isEdited,
    ensureMonthRollover,
    renderTable,
    findRow,
    updateCalcPreview,
    mountModal,
    overrideKey,
    extraKey,
    readJson,
    writeJson,
  };
})();

window.CrmReport = CrmReport;
