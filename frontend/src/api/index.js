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
  login:               (data) => api.post('/auth/login', data),
  register:            (data) => api.post('/auth/register', data),
  me:                  ()     => api.get('/auth/me'),
  sendOtp:             (data) => api.post('/auth/register/send-otp', data),
  verifyOtp:           (data) => api.post('/auth/register/verify-otp', data),
  completeRegistration:(data) => api.post('/auth/register/complete', data),
  getProfile:          ()     => api.get('/auth/profile'),
  updateProfile:       (data) => api.patch('/auth/profile', data),
};

export const claimsApi = {
  create:          (data)           => api.post('/claims', data),
  editDraft:       (id, data)       => api.patch(`/claims/${id}`, data),
  addItem:         (id, item)       => api.post(`/claims/${id}/items`, item),
  clearItems:      (id)             => api.delete(`/claims/${id}/items`),
  removeItem:      (id, itemId)     => api.delete(`/claims/${id}/items/${itemId}`),
  submit:          (id)             => api.post(`/claims/${id}/submit`),
  getMy:           ()               => api.get('/claims/my'),
  getById:         (id)             => api.get(`/claims/${id}`),
  getPendingSric:  ()               => api.get('/claims/pending-sric'),
  getDecidedSric:  ()               => api.get('/claims/decided-sric'),
  getPendingDean:  ()               => api.get('/claims/pending-dean'),
  getDecidedDean:  ()               => api.get('/claims/decided-dean'),
  getAllClaims:    (params)         => api.get('/claims/all', { params }),
  getFacultyProfile:(id)            => api.get(`/claims/faculty-profile/${id}`),
  deleteDraft:     (id)             => api.delete(`/claims/${id}`),
};

export const approvalsApi = {
  sricDecide: (id, action, remarks, itemBudgetHeads) => api.post(`/approvals/sric/${id}`, { action, remarks, itemBudgetHeads }),
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