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

  function openNewRow() {
    if (R.state.readonly) return;
    const id = `RPT-NEW-${Date.now()}`;
    const extras = R.getExtras();
    extras.push({
      id,
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
    });
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

  function saveRow(event) {
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

    if (dealId && window.CrmStore) {
      CrmStore.saveDealProfile(dealId, {
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
    } else if (R.isCustomRow(id)) {
      const extras = R.getExtras().map((row) => (
        row.id === id ? { ...row, ...payload, id } : row
      ));
      R.setExtras(extras);
    } else {
      const overrides = R.getOverrides();
      overrides[id] = { ...payload };
      R.setOverrides(overrides);
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

  function deleteRow() {
    if (R.state.readonly) return;
    const id = R.state.formEl.row_id.value;
    if (!R.isCustomRow(id)) return;
    R.setExtras(R.getExtras().filter((row) => row.id !== id));
    const overrides = R.getOverrides();
    delete overrides[id];
    R.setOverrides(overrides);
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

  function resolveDealReportType(deal) {
    const execution = deal?.execution;
    if (execution === 'confirmed') return 'confirmed';
    if (execution === 'won') return 'won';
    const label = deal?.execution_label || deal?.stage;
    return R.STAGE_TYPE[label] || 'won';
  }

  function addDealFromStore(deal) {
    if (!deal?.id) return;
    const type = resolveDealReportType(deal);
    const month = R.state.activeMonthKey || R.calendarMonthKey();
    if (type !== 'won' && type !== 'confirmed') return;

    const key = R.extraKey(month, type);
    const extras = R.readJson(key, []);
    if (extras.some((row) => row.deal_id === deal.id || row.id === deal.id)) return;

    extras.unshift({
      id: deal.id,
      deal_id: deal.id,
      ...(window.CrmStore ? CrmStore.dealToReportRow(deal) : {}),
      stage: R.TYPE_STAGE[type],
    });
    R.writeJson(key, extras);

    if (
      !R.state.readonly
      && R.state.monthKey === month
      && R.state.reportType === type
      && R.state.tbodyEl
    ) {
      R.renderTable();
    }
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
})();

document.addEventListener('DOMContentLoaded', () => {
  window.CrmReport?.init?.();
});
