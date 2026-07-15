import { setTokenProvider } from '@ihui/api-client'
import { useAuthStore } from '@/stores/auth'

setTokenProvider({ getToken: () => useAuthStore.getState().token })

export { fetchApi } from '@ihui/api-client'
export type { ApiResult, ApiResponse } from '@ihui/types'
