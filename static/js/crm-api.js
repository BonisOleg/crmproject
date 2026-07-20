/**
 * Session JSON API client (CSRF cookie).
 */
const CrmApi = (() => {
  function csrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
    const input = document.querySelector('[name=csrfmiddlewaretoken]');
    return input ? input.value : '';
  }

  async function request(url, options = {}) {
    const opts = { credentials: 'same-origin', ...options };
    const headers = new Headers(opts.headers || {});
    const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
    if (!isForm && opts.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const method = (opts.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      headers.set('X-CSRFToken', csrfToken());
    }
    opts.headers = headers;

    const response = await fetch(url, opts);
    let payload = null;
    const text = await response.text();
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { ok: false, error: text || 'Невірна відповідь сервера' };
    }

    if (!response.ok || (payload && payload.ok === false)) {
      const err = new Error((payload && payload.error) || `HTTP ${response.status}`);
      err.status = response.status;
      err.payload = payload;
      throw err;
    }
    return payload?.data !== undefined ? payload.data : payload;
  }

  const get = (url) => request(url);
  const post = (url, body) => request(url, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body || {}),
  });
  const patch = (url, body) => request(url, {
    method: 'PATCH',
    body: JSON.stringify(body || {}),
  });
  const put = (url, body) => request(url, {
    method: 'PUT',
    body: JSON.stringify(body || {}),
  });
  const del = (url) => request(url, { method: 'DELETE' });

  return {
    csrfToken,
    request,
    get,
    post,
    patch,
    put,
    del,
    clients: {
      list: () => get('/api/clients/'),
      create: (data) => post('/api/clients/', data),
      update: (pk, data) => patch(`/api/clients/${pk}/`, data),
      remove: (pk) => del(`/api/clients/${pk}/`),
    },
    deals: {
      list: () => get('/api/deals/'),
      create: (data) => post('/api/deals/', data),
      update: (code, data) => patch(`/api/deals/${encodeURIComponent(code)}/`, data),
      remove: (code) => del(`/api/deals/${encodeURIComponent(code)}/`),
      duePayments: (code, items) => put(
        `/api/deals/${encodeURIComponent(code)}/due-payments/`,
        { items },
      ),
      uploadDoc: (code, formData) => post(
        `/api/deals/${encodeURIComponent(code)}/documents/`,
        formData,
      ),
    },
    leads: {
      list: () => get('/api/leads/'),
      create: (data) => post('/api/leads/', data),
      update: (code, data) => patch(`/api/leads/${encodeURIComponent(code)}/`, data),
      remove: (code) => del(`/api/leads/${encodeURIComponent(code)}/`),
    },
    carriers: {
      list: () => get('/api/carriers/'),
      create: (data) => post('/api/carriers/', data),
      update: (code, data) => patch(`/api/carriers/${encodeURIComponent(code)}/`, data),
      remove: (code) => del(`/api/carriers/${encodeURIComponent(code)}/`),
      uploadDoc: (code, formData) => post(
        `/api/carriers/${encodeURIComponent(code)}/documents/`,
        formData,
      ),
    },
    payments: {
      list: () => get('/api/payments/'),
      create: (data) => post('/api/payments/', data),
    },
    documents: {
      remove: (pk) => del(`/api/documents/${pk}/`),
    },
    reports: {
      rows: (month, type) => get(
        `/api/reports/rows/?month=${encodeURIComponent(month)}&type=${encodeURIComponent(type)}`,
      ),
      add: (data) => post('/api/reports/rows/add/', data),
      update: (pk, data) => patch(`/api/reports/rows/${pk}/`, data),
      remove: (pk) => del(`/api/reports/rows/${pk}/`),
      rollover: () => post('/api/reports/rollover/', {}),
      archive: () => get('/api/reports/archive/'),
    },
    settings: {
      get: () => get('/api/settings/'),
      update: (data) => patch('/api/settings/', data),
    },
  };
})();

window.CrmApi = CrmApi;
