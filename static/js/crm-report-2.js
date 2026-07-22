/**
 * Редактор / CSV / init для CrmReport
 */
(() => {
  const R = window.CrmReport;
  if (!R) return;

  function openEditor(id) {
    const { readonly, modalEl, formEl } = R.state;
    if (readonly || !modalEl || !formEl) return;
    const row = R.findRow(id);
    if (!row) return;

    R.setState({ lastFocus: document.activeElement });
    formEl.row_id.value = row.id;
    formEl.car.value = row.car;
    formEl.client.value = row.client;
    formEl.stage.value = row.stage || R.defaultStage();
    if (formEl.won_price) formEl.won_price.value = String(row.won_price || 0);
    if (formEl.bid) formEl.bid.value = String(row.bid || 0);
    formEl.cost.value = String(row.cost || 0);
    formEl.price.value = String(row.price || 0);
    if (formEl.delivery_cost) formEl.delivery_cost.value = String(row.delivery_cost || 0);
    if (formEl.won_currency) formEl.won_currency.value = row.won_currency || 'CHF';
    if (formEl.bid_currency) formEl.bid_currency.value = row.bid_currency || 'CHF';
    if (formEl.cost_currency) formEl.cost_currency.value = row.cost_currency || 'CHF';
    if (formEl.price_currency) formEl.price_currency.value = row.price_currency || 'CHF';
    if (formEl.delivery_currency) formEl.delivery_currency.value = row.delivery_currency || 'CHF';
    if (formEl.delivery_type) formEl.delivery_type.value = row.delivery_type || 'pickup';

    const deleteBtn = formEl.querySelector('[data-report-edit-delete]');
    const resetBtn = formEl.querySelector('[data-report-edit-reset]');
    if (deleteBtn) deleteBtn.hidden = !R.isCustomRow(row.id);
    if (resetBtn) resetBtn.hidden = !R.isEdited(row.id) || R.isCustomRow(row.id);

    R.updateCalcPreview();
    modalEl.hidden = false;
    modalEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    window.requestAnimationFrame(() => formEl.car.focus());
  }

  async function openNewRow() {
    if (R.state.readonly) return;
    const draft = {
      car: 'Нове авто',
      client: 'Клієнт',
      stage: R.defaultStage(),
      won_price: 0,
      bid: 0,
      cost: 0,
      price: 0,
      delivery_cost: 0,
      delivery_type: 'pickup',
      profit: 0,
      currency: 'CHF',
      won_currency: 'CHF',
      bid_currency: 'CHF',
      cost_currency: 'CHF',
      price_currency: 'CHF',
      delivery_currency: 'CHF',
      month: R.state.monthKey,
      type: R.state.reportType,
    };
    try {
      if (window.CrmApi) {
        const saved = await CrmApi.reports.add(draft);
        const extras = R.getExtras();
        extras.push(saved);
        R.setExtras(extras);
        R.renderTable();
        openEditor(saved.id);
        return;
      }
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Не вдалося додати рядок', 'info');
      return;
    }
    const id = `RPT-NEW-${Date.now()}`;
    const extras = R.getExtras();
    extras.push({ ...draft, id });
    R.setExtras(extras);
    R.renderTable();
    openEditor(id);
  }

  function closeEditor() {
    const { modalEl, lastFocus } = R.state;
    if (!modalEl) return;
    modalEl.hidden = true;
    modalEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    lastFocus?.focus?.();
  }

  async function saveRow(event) {
    event.preventDefault();
    if (R.state.readonly) return;
    const formEl = R.state.formEl;
    const id = formEl.row_id.value;
    const payload = R.recalcRow({
      car: formEl.car.value.trim(),
      client: formEl.client.value.trim(),
      stage: formEl.stage.value || R.defaultStage(),
      won_price: Number(R.sanitizeDigits(formEl.won_price?.value || '0')) || 0,
      bid: Number(R.sanitizeDigits(formEl.bid?.value || '0')) || 0,
      cost: Number(R.sanitizeDigits(formEl.cost.value)) || 0,
      price: Number(R.sanitizeDigits(formEl.price.value)) || 0,
      delivery_cost: Number(R.sanitizeDigits(formEl.delivery_cost?.value || '0')) || 0,
      delivery_type: formEl.delivery_type?.value || 'pickup',
      currency: formEl.price_currency?.value || 'CHF',
      won_currency: formEl.won_currency?.value || 'CHF',
      bid_currency: formEl.bid_currency?.value || 'CHF',
      cost_currency: formEl.cost_currency?.value || 'CHF',
      price_currency: formEl.price_currency?.value || 'CHF',
      delivery_currency: formEl.delivery_currency?.value || 'CHF',
    });

    if (!payload.car || !payload.client) {
      if (typeof showToast === 'function') showToast('Заповніть авто та клієнта', 'info');
      return;
    }

    const found = R.findRow(id);
    const dealId = found ? R.resolveRowDealId(found) : null;
    const pk = found?.pk;

    try {
      if (dealId && window.CrmStore) {
        await CrmStore.saveDealProfile(dealId, {
          car: payload.car,
          client: payload.client,
          execution_label: payload.stage,
          won_price: payload.won_price,
          bid: payload.bid,
          cost: payload.cost,
          price: payload.price,
          delivery_cost: payload.delivery_cost,
          delivery_type: payload.delivery_type,
          profit: payload.profit,
          currency: payload.price_currency || payload.currency,
          won_currency: payload.won_currency,
          bid_currency: payload.bid_currency,
          cost_currency: payload.cost_currency,
          price_currency: payload.price_currency,
          delivery_currency: payload.delivery_currency,
        });
      } else if (pk && window.CrmApi) {
        const saved = await CrmApi.reports.update(pk, payload);
        if (R.isCustomRow(id)) {
          R.setExtras(R.getExtras().map((row) => (row.id === id ? { ...row, ...saved } : row)));
        } else {
          const overrides = R.getOverrides();
          overrides[id] = { ...payload };
          R.setOverrides(overrides);
        }
      } else if (R.isCustomRow(id)) {
        R.setExtras(R.getExtras().map((row) => (row.id === id ? { ...row, ...payload, id } : row)));
      } else {
        const next = R.getOverrides();
        next[id] = { ...payload };
        R.setOverrides(next);
      }
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Помилка збереження', 'info');
      return;
    }

    R.renderTable();
    closeEditor();
    if (typeof showToast === 'function') showToast('Рядок звіту збережено', 'success');
  }

  function resetRow() {
    if (R.state.readonly) return;
    const id = R.state.formEl.row_id.value;
    const overrides = R.getOverrides();
    delete overrides[id];
    R.setOverrides(overrides);
    R.renderTable();
    closeEditor();
    if (typeof showToast === 'function') showToast('Рядок повернуто до початкових даних', 'info');
  }

  async function deleteRow() {
    if (R.state.readonly) return;
    const id = R.state.formEl.row_id.value;
    if (!R.isCustomRow(id)) return;
    const found = R.findRow(id);
    try {
      if (found?.pk && window.CrmApi) await CrmApi.reports.remove(found.pk);
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Помилка видалення', 'info');
      return;
    }
    R.setExtras(R.getExtras().filter((row) => row.id !== id));
    const next = R.getOverrides();
    delete next[id];
    R.setOverrides(next);
    R.renderTable();
    closeEditor();
    if (typeof showToast === 'function') showToast('Рядок видалено', 'info');
  }

  function bindRowHandlers() {
    const { tbodyEl, readonly } = R.state;
    if (!tbodyEl || readonly) return;
    tbodyEl.querySelectorAll('[data-report-row]').forEach((rowEl) => {
      if (rowEl.dataset.reportBound) return;
      rowEl.dataset.reportBound = 'true';
      const open = () => openEditor(rowEl.dataset.reportId);
      rowEl.addEventListener('click', (event) => {
        if (event.target.closest('.report-table__deal-link')) return;
        open();
      });
      rowEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
    });
  }

  function bindMoneyInputs() {
    const formEl = R.state.formEl;
    if (!formEl) return;
    ['won_price', 'bid', 'cost', 'price', 'delivery_cost'].forEach((name) => {
      formEl[name]?.addEventListener('input', () => {
        formEl[name].value = R.sanitizeDigits(formEl[name].value).slice(0, 9);
        R.updateCalcPreview();
      });
    });
  }

  function exportCsv() {
    const rows = R.mergeRows();
    const label = R.state.monthLabel || R.state.monthKey || 'zvit';
    const typeLabel = R.state.reportType === 'confirmed' ? 'pidtverdzheni' : 'vygrani';
    const lines = [['Авто', 'Клієнт', 'Стадія', 'Виграна', 'Ставка', 'Собівартість', 'Клієнту', 'Доставка', 'Прибуток']];
    rows.forEach((row) => {
      const delivery = row.delivery_type === 'ours' ? (Number(row.delivery_cost) || 0) : '';
      lines.push([
        row.car,
        row.client,
        row.stage,
        `${row.won_price || 0} ${row.won_currency || row.currency}`,
        `${row.bid || 0} ${row.bid_currency || row.currency}`,
        `${row.cost} ${row.cost_currency || row.currency}`,
        `${row.price} ${row.price_currency || row.currency}`,
        delivery ? `${delivery} ${row.delivery_currency || row.currency}` : '',
        `${row.profit} ${row.currency}`,
      ]);
    });
    const safeMonth = String(label).replace(/\s+/g, '-').toLowerCase();
    const csv = `\ufeff${lines.map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zvit-${typeLabel}-${safeMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    if (typeof showToast === 'function') showToast('CSV завантажено', 'success');
  }

  function resolveDealReportTabs(deal) {
    const execution = deal?.execution;
    const confirmedBelow = ['confirmed', 'picked', 'in_transit', 'customs', 'delivered'];
    const tabs = ['won'];
    if (confirmedBelow.includes(execution)) tabs.push('confirmed');
    return tabs;
  }

  function upsertDealRow(deal, row) {
    const extras = R.getExtras().filter(
      (item) => item.deal_id !== deal.id && item.id !== deal.id
    );
    const base = (R.state.baseRows || []).filter(
      (item) => item.deal_id !== deal.id && item.id !== deal.id
    );
    const existing = (R.state.baseRows || []).find(
      (item) => item.deal_id === deal.id || item.id === deal.id
    );
    R.setState({
      baseRows: existing
        ? base.concat([{ ...existing, ...row, id: existing.id, pk: existing.pk }])
        : base,
    });
    if (!existing) {
      extras.unshift(row);
      R.setExtras(extras);
    } else {
      R.setExtras(extras);
    }
  }

  function removeDealRow(dealId) {
    R.setState({
      baseRows: (R.state.baseRows || []).filter(
        (item) => item.deal_id !== dealId && item.id !== dealId
      ),
    });
    R.setExtras(R.getExtras().filter(
      (item) => item.deal_id !== dealId && item.id !== dealId
    ));
  }

  function addDealFromStore(deal) {
    if (!deal?.id) return;

    const month = R.ensureMonthRollover(
      R.state.activeMonthKey || R.calendarMonthKey()
    );
    const tabs = resolveDealReportTabs(deal);
    const row = {
      id: deal.id,
      deal_id: deal.id,
      ...(window.CrmStore ? CrmStore.dealToReportRow(deal) : {}),
      stage: deal.execution_label || deal.stage || R.TYPE_STAGE[R.state.reportType],
    };

    /* Сервер sync_deal_to_reports уже пише в БД; тут лише UI поточного місяця */
    if (
      !R.state.readonly
      && R.state.monthKey === month
      && R.state.tbodyEl
    ) {
      if (deal.is_active === false) {
        removeDealRow(deal.id);
      } else if (tabs.includes(R.state.reportType)) {
        upsertDealRow(deal, row);
      } else {
        removeDealRow(deal.id);
      }
      R.renderTable();
    }
  }

  function syncDealToReport(event) {
    const dealId = event?.detail?.dealId;
    if (!dealId || !window.CrmStore) return;
    const deal = CrmStore.getDeal(dealId);
    if (deal) addDealFromStore(deal);
  }

  function mergeSections() {
    return [{ name: R.TYPE_STAGE[R.state.reportType] || 'Звіт', rows: R.mergeRows() }];
  }

  function init() {
    if (!document.getElementById('report-table-body')) return;
    const meta = R.readMeta();
    if (!meta) return;

    const activeMonth = R.ensureMonthRollover(meta.activeMonth || R.calendarMonthKey());
    R.setState({
      reportType: meta.type === 'confirmed' ? 'confirmed' : 'won',
      monthKey: meta.month,
      monthLabel: meta.monthLabel,
      activeMonthKey: activeMonth,
      readonly: meta.readonly,
      baseRows: R.readBase(),
      modalEl: document.getElementById('report-edit'),
      formEl: document.getElementById('report-edit-form'),
      tbodyEl: document.getElementById('report-table-body'),
    });

    R.mountModal();
    R.renderTable();
    bindRowHandlers();

    const { formEl, modalEl, readonly } = R.state;
    if (!readonly && formEl) {
      formEl.addEventListener('submit', saveRow);
      bindMoneyInputs();
      modalEl?.querySelectorAll('[data-report-edit-close]').forEach((btn) => {
        btn.addEventListener('click', closeEditor);
      });
      formEl.querySelector('[data-report-edit-reset]')?.addEventListener('click', resetRow);
      formEl.querySelector('[data-report-edit-delete]')?.addEventListener('click', deleteRow);
      document.querySelector('[data-report-add-row]')?.addEventListener('click', openNewRow);
    }

    document.querySelector('[data-report-export-csv]')?.addEventListener('click', exportCsv);
    document.querySelector('[data-report-print]')?.addEventListener('click', () => window.print());

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modalEl && !modalEl.hidden) {
        event.preventDefault();
        closeEditor();
      }
    });

    document.addEventListener('crm:currency-change', () => {
      R.renderTable();
      bindRowHandlers();
    });
    document.addEventListener('crm:deal-updated', () => {
      if (!R.state.readonly) {
        R.renderTable();
        bindRowHandlers();
      }
    });
  }

  R.bindRowHandlers = bindRowHandlers;
  R.openEditor = openEditor;
  R.openNewRow = openNewRow;
  R.closeEditor = closeEditor;
  R.addDealFromStore = addDealFromStore;
  R.mergeSections = mergeSections;
  R.exportCsv = exportCsv;
  R.init = init;

  const originalRender = R.renderTable;
  R.renderTable = function renderTableWrapped() {
    originalRender();
    bindRowHandlers();
  };

  document.addEventListener('crm:deal-updated', syncDealToReport);
})();

document.addEventListener('DOMContentLoaded', () => {
  window.CrmReport?.init?.();
});

document.addEventListener('crm:render-mounted', () => {
  const tbody = document.getElementById('report-table-body');
  if (!tbody || !window.CrmReport) return;
  tbody.querySelectorAll('tr[data-deal-item]:not([data-report-row])').forEach((node) => {
    node.remove();
  });
  tbody.querySelectorAll('.data-table__actions, .card-delete-btn').forEach((node) => {
    node.remove();
  });
  CrmReport.renderTable();
});
