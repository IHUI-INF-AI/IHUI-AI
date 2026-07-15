import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'

export async function sendChangePhoneOldCode(): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/auth/change-phone/send-old-code', {
    method: 'POST',
  })
}

export async function verifyChangePhoneOldCode(
  code: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/auth/change-phone/verify-old-code', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export async function sendChangePhoneNewCode(
  phone: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/auth/change-phone/send-new-code', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  })
}

export async function changePhone(
  phone: string,
  code: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/auth/change-phone/confirm', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  })
}
