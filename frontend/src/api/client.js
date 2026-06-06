import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      window.location.href = '/login'
      return new Promise(() => {}) // suppress onError — page is navigating away
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (full_name, email, password, confirm_password) =>
    api.post('/auth/register', { full_name, email, password, confirm_password }),
  login: (email, password) =>
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
}

// ── Jobs ──────────────────────────────────────────────────────────────────────
export const jobsApi = {
  list: (params) => api.get('/jobs', { params }),
  get: (id) => api.get(`/jobs/${id}`),
  updateStatus: (id, status) => api.patch(`/jobs/${id}/status`, { status }),
  saveScore: (id, data) => api.patch(`/jobs/${id}/score`, data),
  match: (id) => api.post(`/jobs/${id}/match`),
  delete: (id) => api.delete(`/jobs/${id}`),
  trigger: () => api.post('/jobs/trigger'),
  taskStatus: (taskId) => api.get(`/jobs/task/${taskId}`),
}

// ── CV ────────────────────────────────────────────────────────────────────────
export const cvApi = {
  list: () => api.get('/cv'),
  getActive: () => api.get('/cv/active'),
  upload: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/cv/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  activate: (id) => api.post(`/cv/${id}/activate`),
}

// ── Filters ───────────────────────────────────────────────────────────────────
export const filtersApi = {
  get: () => api.get('/filters'),
  save: (data) => api.put('/filters', data),
}

export default api
