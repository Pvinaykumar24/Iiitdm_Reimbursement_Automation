import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) useAuthStore.getState().logout();
    return Promise.reject(err);
  }
);

export const authApi = {
  login:    (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me:       ()     => api.get('/auth/me'),
};

export const claimsApi = {
  create:          (data)           => api.post('/claims', data),
  addItem:         (id, item)       => api.post(`/claims/${id}/items`, item),
  removeItem:      (id, itemId)     => api.delete(`/claims/${id}/items/${itemId}`),
  submit:          (id)             => api.post(`/claims/${id}/submit`),
  getMy:           ()               => api.get('/claims/my'),
  getById:         (id)             => api.get(`/claims/${id}`),
  getPendingDean:  ()               => api.get('/claims/pending-dean'),
  getDecidedDean:  ()               => api.get('/claims/decided-dean'),
  deleteDraft:     (id)             => api.delete(`/claims/${id}`),
};

export const approvalsApi = {
  deanDecide: (id, action, remarks) => api.post(`/approvals/dean/${id}`, { action, remarks }),
};

export const projectsApi = {
  getMy:           ()   => api.get('/projects/my'),
  getBudgetHeads:  (id) => api.get(`/projects/${id}/budget-heads`),
};

export const notificationsApi = {
  getAll:   ()   => api.get('/notifications'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
};

export default api;