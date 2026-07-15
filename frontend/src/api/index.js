import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
    if (err.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/login')) {
        useAuthStore.getState().logout();
        return Promise.reject(err);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const rToken = useAuthStore.getState().refreshToken;
      if (!rToken) {
        useAuthStore.getState().logout();
        isRefreshing = false;
        return Promise.reject(err);
      }

      try {
        const response = await axios.post(`${import.meta.env.VITE_API_URL}/auth/refresh`, { refresh_token: rToken });
        const { token, refreshToken: newRToken } = response.data;
        useAuthStore.getState().setAuth(useAuthStore.getState().user, token, newRToken || rToken);
        processQueue(null, token);
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        useAuthStore.getState().logout();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  sendOtp: (data) => api.post('/auth/register/send-otp', data),
  verifyOtp: (data) => api.post('/auth/register/verify-otp', data),
  completeRegistration: (data) => api.post('/auth/register/complete', data),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.patch('/auth/profile', data),
};

export const claimsApi = {
  create: (data) => api.post('/claims', data),
  editDraft: (id, data) => api.patch(`/claims/${id}`, data),
  addItem: (id, item) => api.post(`/claims/${id}/items`, item),
  clearItems: (id) => api.delete(`/claims/${id}/items`),
  removeItem: (id, itemId) => api.delete(`/claims/${id}/items/${itemId}`),
  submit: (id) => api.post(`/claims/${id}/submit`),
  getMy: () => api.get('/claims/my'),
  getById: (id) => api.get(`/claims/${id}`),
  getPendingSric: () => api.get('/claims/pending-sric'),
  getDecidedSric: () => api.get('/claims/decided-sric'),
  getPendingDean: () => api.get('/claims/pending-dean'),
  getDecidedDean: () => api.get('/claims/decided-dean'),
  getAllClaims: (params) => api.get('/claims/all', { params }),
  getBudgetSummary: (params) => api.get('/claims/budget-summary', { params }),
  getFacultyProfile: (id) => api.get(`/claims/faculty-profile/${id}`),
  deleteDraft: (id) => api.delete(`/claims/${id}`),
};

export const approvalsApi = {
  sricDecide: (id, action, remarks, itemBudgetHeads) => api.post(`/approvals/sric/${id}`, { action, remarks, itemBudgetHeads }),
  deanDecide: (id, action, remarks) => api.post(`/approvals/dean/${id}`, { action, remarks }),
  updateSricSegregation: (id, itemBudgetHeads) => api.patch(`/approvals/sric/update-segregation/${id}`, { itemBudgetHeads }),
};

export const projectsApi = {
  getMy: () => api.get('/projects/my'),
  getBudgetHeads: (id) => api.get(`/projects/${id}/budget-heads`),
  getAll: () => api.get('/projects'),
  assignPI: (id, piEmployeeId, coPiEmployeeIds) => api.patch(`/projects/${id}/assign`, { pi_employee_id: piEmployeeId, co_pi_employee_ids: coPiEmployeeIds }),
  create: (data) => api.post('/projects', data),
  getFaculties: () => api.get('/projects/faculties'),
};

export const notificationsApi = {
  getAll: () => api.get('/notifications'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
};

export default api;