'use client'

import { toast } from 'sonner'

export interface UseToastReturn {
  toast: typeof toast
  success: (message: string, description?: string) => void
  error: (message: string, description?: string) => void
  warning: (message: string, description?: string) => void
  info: (message: string, description?: string) => void
}

export function useToast(): UseToastReturn {
  const success = (message: string, description?: string) =>
    toast.success(message, description ? { description } : undefined)
  const error = (message: string, description?: string) =>
    toast.error(message, description ? { description } : undefined)
  const warning = (message: string, description?: string) =>
    toast.warning(message, description ? { description } : undefined)
  const info = (message: string, description?: string) =>
    toast.info(message, description ? { description } : undefined)

  return { toast, success, error, warning, info }
}
