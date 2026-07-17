import { create } from 'zustand'

export type LoginDialogMode = 'login' | 'register' | 'forgot'

interface LoginDialogState {
  isOpen: boolean
  mode: LoginDialogMode
  redirectUrl: string | null
  open: (mode?: LoginDialogMode, redirectUrl?: string) => void
  close: () => void
  setMode: (mode: LoginDialogMode) => void
}

export const useLoginDialogStore = create<LoginDialogState>((set) => ({
  isOpen: false,
  mode: 'login',
  redirectUrl: null,
  open: (mode = 'login', redirectUrl) =>
    set({ isOpen: true, mode, redirectUrl: redirectUrl ?? null }),
  close: () => set({ isOpen: false, redirectUrl: null }),
  setMode: (mode) => set({ mode }),
}))
