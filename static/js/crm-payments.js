const CrmPayments = (() => {
  const PAYMENT_LABELS = {
    paid: 'Оплачено',
    partial: 'Частково',
    pending: 'Очікує',
    debt: 'Борг',
  };

  function paymentStatus(paid, price, debt) {
    if (debt <= 0) return { payment: 'paid', payment_label: PAYMENT_LABELS.paid };
    if (paid > 0) return { payment: 'partial', payment_label: PAYMENT_LABELS.partial };
    return { payment: 'pending', payment_label: PAYMENT_LABELS.pending };
  }

  function convertAmount(amount, from, to) {
    if (from === to) return amount;
    if (window.CrmCurrency) return Math.round(CrmCurrency.convert(amount, from, to));
    return amount;
  }

  function record(payment) {
    const deal = CrmStore.getDeal(payment.dealId);
    if (!deal) return null;

    const amountInDealCurrency = convertAmount(payment.amount, payment.currency, deal.currency);
    const paid = Math.min(deal.price, (deal.paid || 0) + amountInDealCurrency);
    const debt = Math.max(0, deal.price - paid);
    const status = paymentStatus(paid, deal.price, debt);

    const patch = {
      paid,
      debt,
      payment: status.payment,
      payment_label: status.payment_label,
    };

    CrmStore.saveDealOverride(payment.dealId, patch);
    CrmStore.addPayment(payment);

    return {
      dealId: payment.dealId,
      deal: { ...deal, ...patch },
      payment,
    };
  }

  function formatMoney(amount, currency) {
    if (window.CrmCurrency) return CrmCurrency.display(amount, currency);
    return `${Number(amount || 0).toLocaleString('uk-UA')} ${currency}`;
  }

  function updateDealNodes(dealId, deal) {
    document.querySelectorAll(`[data-deal-id="${CSS.escape(dealId)}"]`).forEach((node) => {
      const priceEl = node.querySelector('.deal-row__price, .deal-card__price, .kanban-card__price, [data-deal-price]');
      if (priceEl) {
        priceEl.dataset.money = String(deal.price);
        priceEl.dataset.moneyCurrency = deal.currency;
        priceEl.textContent = formatMoney(deal.price, deal.currency);
      }

      const debtEl = node.querySelector('.deal-row__debt');
      if (debtEl) {
        if (deal.debt > 0) {
          debtEl.classList.remove('text-green');
          debtEl.dataset.money = String(deal.debt);
          debtEl.dataset.moneyCurrency = deal.currency;
          debtEl.dataset.moneyPrefix = 'борг ';
          debtEl.textContent = `борг ${formatMoney(deal.debt, deal.currency)}`;
        } else {
          delete debtEl.dataset.money;
          debtEl.classList.add('text-green');
          debtEl.textContent = '✓ оплачено';
        }
      }

      node.querySelectorAll('.wf-pill, .pill').forEach((pill) => {
        if (pill.textContent.match(/Оплачено|Частково|Очікує|Борг/)) {
          pill.textContent = deal.payment_label;
        }
      });

      node.dataset.dealDebt = String(deal.debt || 0);
    });

    if (window.CrmCurrency) CrmCurrency.applyAll();
  }

  function appendPaymentItem(payment) {
    const list = document.querySelector('[data-payment-list]');
    if (!list) return;

    const item = document.createElement('div');
    item.className = 'payment-item';
    item.dataset.paymentId = payment.id;
    item.innerHTML = `
      <div>
        <div class="mono" data-money="${payment.amount}" data-money-currency="${payment.currency}">${formatMoney(payment.amount, payment.currency)}</div>
        <div class="text-muted" style="font-size:12px">${payment.place}</div>
      </div>
      <div class="text-muted">${payment.date}</div>`;
    list.prepend(item);
  }

  function updateDealDetailFinance(deal) {
    const paidEl = document.querySelector('[data-deal-paid]');
    const priceEl = document.querySelector('[data-deal-price-total]');
    const progressEl = document.querySelector('[data-deal-progress]');
    const profitEl = document.querySelector('[data-deal-profit]');

    if (paidEl) {
      paidEl.dataset.money = String(deal.paid);
      paidEl.dataset.moneyCurrency = deal.currency;
      paidEl.textContent = Number(deal.paid).toLocaleString('uk-UA');
    }
    if (priceEl) {
      priceEl.dataset.money = String(deal.price);
      priceEl.dataset.moneyCurrency = deal.currency;
      priceEl.textContent = formatMoney(deal.price, deal.currency);
    }
    if (progressEl && deal.price > 0) {
      progressEl.style.width = `${Math.round((deal.paid / deal.price) * 100)}%`;
    }
    if (profitEl) {
      profitEl.dataset.money = String(deal.profit || 0);
      profitEl.dataset.moneyCurrency = deal.currency;
      profitEl.textContent = `+${formatMoney(deal.profit || 0, deal.currency)}`;
    }

    document.querySelectorAll('.dual-pills .pill, .deal-row__pills .wf-pill').forEach((pill) => {
      if (/Оплачено|Частково|Очікує|Борг/.test(pill.textContent)) {
        pill.innerHTML = `<span class="pill__dot"></span>${deal.payment_label}`;
      }
    });
  }

  function refreshUI(result) {
    if (!result) return;
    updateDealNodes(result.dealId, result.deal);
    appendPaymentItem(result.payment);
    updateDealDetailFinance(result.deal);
  }

  return { record, refreshUI, updateDealDetailFinance, updateDealNodes, PAYMENT_LABELS };
})();

window.CrmPayments = CrmPayments;
