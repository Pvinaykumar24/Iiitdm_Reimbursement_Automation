import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      setAuth: (user, token, refreshToken = null) => set((state) => ({
        user,
        token,
        refreshToken: refreshToken || state.refreshToken
      })),
      logout: () => set({ user: null, token: null, refreshToken: null }),
    }),
    { name: 'iiitdm-auth' }
  )
);