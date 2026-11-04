'use strict';

const ClosenessAPI = (() => {
  const root = new URL('./', document.currentScript.src);
  const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  const validId = value => typeof value === 'string' && uuid.test(value);
  const timelineURL = id => new URL(`t/${id}`, root).href;

  function pageURL(page, params = {}) {
    const url = new URL(page, root);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url;
  }

  async function request(path, { method = 'GET', body, signal } = {}) {
    const base = (window.CLOSENESS_LINES_API_BASE || '/api').replace(/\/+$/, '');
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let response;
    try {
      response = await fetch(base + path, {
        method, headers, signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error('Could not reach the timeline service. Try again.');
    }
    const payload = await response.json().catch(() => null);
    if (response.status === 409) {
      throw new Error('A newer version was saved through this editing link. Your changes in this tab have not been saved.');
    }
    if (response.status === 404 && path.startsWith('/timelines/') && payload) {
      throw new Error('This timeline link could not be found.');
    }
    if (!payload) throw new Error('Sharing is unavailable from this server right now.');
    if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'The timeline service could not complete the request.');
    return payload;
  }

  function load(id) {
    if (!validId(id)) throw new Error('This timeline link is invalid.');
    return request('/timelines/read', { method: 'POST', body: { id } });
  }

  function save(timeline, { editId, revision, publish }) {
    if (editId && !validId(editId)) throw new Error('This editing link is invalid.');
    return editId
      ? request('/timelines/update', { method: 'POST', body: { id: editId, timeline, revision, publish } })
      : request('/timelines', { method: 'POST', body: { timeline, publish } });
  }

  function gallery(filters, signal) {
    const search = new URLSearchParams(filters);
    return request('/gallery' + (search.size ? '?' + search : ''), { signal });
  }

  return { validId, timelineURL, pageURL, load, save, gallery };
})();
