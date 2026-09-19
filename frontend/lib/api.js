const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

async function request(path, options = {}, token) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.message || 'Unable to complete that request.');
  return body;
}

export async function establishDemoSession() {
  const cached = window.localStorage.getItem('eventpilot-token');
  if (cached) return cached;
  const credentials = { email: 'demo@eventpilot.local', password: 'EventPilotDemo2026!', name: 'Alex Event Manager' };
  try {
    const login = await request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
    window.localStorage.setItem('eventpilot-token', login.token);
    return login.token;
  } catch {
    const register = await request('/auth/register', { method: 'POST', body: JSON.stringify(credentials) });
    window.localStorage.setItem('eventpilot-token', register.token);
    return register.token;
  }
}

export const api = {
  events: (token) => request('/events', {}, token),
  seedEvent: (token, scenario = 'wedding') => request('/events/demo', { method: 'POST', body: JSON.stringify({ scenario }) }, token),
  dashboard: (eventId, token) => request(`/dashboard/event/${eventId}`, {}, token),
  chat: (eventId, message, token) => request('/chat', { method: 'POST', body: JSON.stringify({ eventId, message }) }, token),
  updateTask: (taskId, patch, token) => request(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(patch) }, token),
  createTask: (eventId, task, token) => request(`/tasks/event/${eventId}`, { method: 'POST', body: JSON.stringify(task) }, token)
};
