const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const request = async (method, path, body, opts = {}) => {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: opts.isFormData ? { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } : getHeaders(),
    body: opts.isFormData ? body : (body ? JSON.stringify(body) : undefined),
    signal: opts.signal,
  });

  if (res.status === 401) {
    const refreshed = await refreshTokens();
    if (!refreshed) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
      return;
    }
    return request(method, path, body, opts);
  }

  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Request failed');
  return data.data;
};

const refreshTokens = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

export const api = {
  auth: {
    register: (body) => request('POST', '/auth/register', body),
    login: (body) => request('POST', '/auth/login', body),
    logout: () => request('POST', '/auth/logout'),
    googleUrl: () => `${API_BASE}/auth/google`,
  },
  users: {
    me: () => request('GET', '/users/me'),
    update: (body) => request('PATCH', '/users/me', body),
  },
  notebooks: {
    list: () => request('GET', '/notebooks'),
    create: (body) => request('POST', '/notebooks', body),
    get: (id) => request('GET', `/notebooks/${id}`),
    update: (id, body) => request('PATCH', `/notebooks/${id}`, body),
    delete: (id) => request('DELETE', `/notebooks/${id}`),
    share: (id, email, role) => request('POST', `/notebooks/${id}/share`, { email, role }),
    removeCollaborator: (id, userId) => request('DELETE', `/notebooks/${id}/share/${userId}`),
    getCollaborators: (id) => request('GET', `/notebooks/${id}/share`),
  },
  notes: {
    list: (nid) => request('GET', `/notebooks/${nid}/notes`),
    create: (nid, body) => request('POST', `/notebooks/${nid}/notes`, body),
    update: (nid, noteId, body) => request('PATCH', `/notebooks/${nid}/notes/${noteId}`, body),
    delete: (nid, noteId) => request('DELETE', `/notebooks/${nid}/notes/${noteId}`),
  },
  sources: {
    list: (nid) => request('GET', `/notebooks/${nid}/sources`),
    getGraph: (nid) => request('GET', `/notebooks/${nid}/sources/graph`),
    uploadFile: (nid, formData) => request('POST', `/notebooks/${nid}/sources/upload`, formData, { isFormData: true }),
    addYoutube: (nid, body) => request('POST', `/notebooks/${nid}/sources/youtube`, body),
    addWebLink: (nid, body) => request('POST', `/notebooks/${nid}/sources/weblink`, body),
    addText: (nid, body) => request('POST', `/notebooks/${nid}/sources/text`, body),
    delete: (nid, sid) => request('DELETE', `/notebooks/${nid}/sources/${sid}`),
    status: (nid, sid) => request('GET', `/notebooks/${nid}/sources/${sid}/status`),
  },
  chat: {
    createConversation: (nid, body) => request('POST', `/notebooks/${nid}/conversations`, body),
    listConversations: (nid) => request('GET', `/notebooks/${nid}/conversations`),
    getMessages: (cid) => request('GET', `/conversations/${cid}/messages`),
    deleteConversation: (cid) => request('DELETE', `/conversations/${cid}`),
    updateTitle: (cid, title) => request('PATCH', `/conversations/${cid}/title`, { title }),
  },
};

export const streamChat = (cid, body, onToken, onDone, onError) => {
  const token = localStorage.getItem('accessToken');
  const url = `${API_BASE}/conversations/${cid}/chat`;

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  }).then(async (res) => {
    if (!res.ok) { onError('Failed to connect'); return; }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop();

      for (const part of parts) {
        const lines = part.split('\n');
        const eventLine = lines.find(l => l.startsWith('event:'));
        const dataLine = lines.find(l => l.startsWith('data:'));
        if (!eventLine || !dataLine) continue;
        const event = eventLine.replace('event:', '').trim();
        const data = JSON.parse(dataLine.replace('data:', '').trim());
        if (event === 'token') onToken(data.token);
        if (event === 'done') onDone(data);
        if (event === 'error') onError(data.message);
      }
    }
  }).catch(onError);
};
