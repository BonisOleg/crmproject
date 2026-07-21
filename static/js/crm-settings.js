/**
 * Сторінка «Налаштування»: формула/курси + обліковий запис (superuser / Тимофій).
 */
(function () {
  function toast(msg, type) {
    if (typeof showToast === 'function') showToast(msg, type || 'info');
  }

  function num(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  async function saveFormula() {
    if (!window.CrmApi) throw new Error('API недоступне');
    return CrmApi.settings.update({
      commission_percent: num('setting-commission'),
      logistics_fixed_chf: num('setting-logistics'),
      rate_chf_uah: num('setting-chf-uah'),
      rate_eur_uah: num('setting-eur-uah'),
    });
  }

  async function saveAccount() {
    const card = document.querySelector('[data-account-card]');
    if (!card || !window.CrmApi) return null;

    const email = (document.getElementById('account-email')?.value || '').trim();
    const currentPassword = document.getElementById('account-current-password')?.value || '';
    const newPassword = document.getElementById('account-new-password')?.value || '';
    const confirm = document.getElementById('account-new-password-confirm')?.value || '';

    const payload = { email, current_password: currentPassword };
    if (newPassword || confirm) {
      payload.new_password = newPassword;
      payload.new_password_confirm = confirm;
    }

    if (!currentPassword) {
      // Якщо поля акаунта не чіпали — пропускаємо
      const emailEl = document.getElementById('account-email');
      const initial = (emailEl?.defaultValue || '').trim().toLowerCase();
      if (email.toLowerCase() === initial && !newPassword && !confirm) {
        return null;
      }
      throw new Error('Введіть поточний пароль, щоб змінити логін або пароль');
    }

    return CrmApi.account.update(payload);
  }

  async function onSave() {
    const btn = document.querySelector('[data-settings-save]');
    if (btn) btn.disabled = true;
    try {
      await saveFormula();
      const account = await saveAccount();
      if (account?.email) {
        const emailEl = document.getElementById('account-email');
        if (emailEl) {
          emailEl.value = account.email;
          emailEl.defaultValue = account.email;
        }
        ['account-current-password', 'account-new-password', 'account-new-password-confirm']
          .forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = '';
          });
      }
      toast('Збережено', 'success');
    } catch (err) {
      toast(err.message || 'Помилка збереження', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('[data-settings-save]')) return;
    document.querySelector('[data-settings-save]')?.addEventListener('click', onSave);
  });
})();
