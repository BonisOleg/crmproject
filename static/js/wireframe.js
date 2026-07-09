document.addEventListener('DOMContentLoaded', () => {
  initPackageBar();
  if (window.CrmCurrency) CrmCurrency.initToolbar();
  else initCurrencyBarFallback();
  if (window.CrmPackages) CrmPackages.applyAll();
});

document.addEventListener('crm:package-change', () => {
  if (window.CrmPackages) CrmPackages.applyAll();
  if (window.CrmCurrency) CrmCurrency.applyAll();
});

document.addEventListener('crm:currency-change', () => {
  if (window.CrmCurrency) CrmCurrency.applyAll();
});

function initPackageBar() {
  const bar = document.querySelector('.package-bar');
  if (!bar || !window.CrmPackages) return;

  const buttons = bar.querySelectorAll('[data-package]');

  const paint = () => {
    const active = CrmPackages.get();
    buttons.forEach((btn) => {
      const isActive = btn.dataset.package === active;
      btn.classList.toggle('wf-panel-btn--active', isActive);
      btn.style.opacity = isActive ? '1' : '0.72';
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      CrmPackages.set(btn.dataset.package);
      paint();
      const m = CrmPackages.meta(btn.dataset.package);
      if (typeof showToast === 'function') {
        showToast(`Пакет: ${m.label} (${m.code})`, 'success');
      }
    });
  });

  paint();
}

function initCurrencyBarFallback() {
  const group = document.querySelector('.wf-currency');
  if (!group) return;
  const buttons = group.querySelectorAll('[data-currency]');
  let active = localStorage.getItem('autolot-currency') || 'CHF';
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      active = btn.dataset.currency;
      localStorage.setItem('autolot-currency', active);
      buttons.forEach((b) => {
        b.classList.toggle('wf-currency__btn--active', b.dataset.currency === active);
      });
    });
  });
}
