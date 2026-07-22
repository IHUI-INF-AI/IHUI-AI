/**
 * 开发者 API Key fetch 封装。
 *
 * 复用 @/lib/api 的 fetchApi(自动处理 { code, message, data } 解析、JWT 注入、401 登录弹窗)。
 * 后端响应 code !== 0 时 fetchApi 返回 { success: false, error },此处统一抛错供 React Query 捕获。
 *
 * 端点契约(后端 apps/api/src/routes/developer.ts + frontend-stub-other-routes.ts):
 * - GET    /api/developer/api-keys          → { list: ApiKeyInfo[] }
 * - POST   /api/developer/api-keys          → { apiKey, secret }(secret 仅此一次)
 * - DELETE /api/developer/api-keys/:id      → { ok: true }
 * - PATCH  /api/developer/api-keys/:id      → { apiKey: ApiKeyInfo }
 * - POST   /api/developer/keys/:id/reset    → { apiKey, secret }(轮换)
 * - GET    /api/developer/api-keys/:id/usage→ ApiKeyQuotaInfo
 */
import { fetchApi } from '@/lib/api'
import type {
  ApiKeyInfo,
  ApiKeyPermission,
  ApiKeyQuotaInfo,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  RotateApiKeyResponse,
} from '@ihui/types'

/** 列出当前用户的 API 密钥(脱敏,不含 secret)。 */
export async function fetchApiKeys(): Promise<ApiKeyInfo[]> {
  const res = await fetchApi<{ list: ApiKeyInfo[] }>('/api/developer/api-keys')
  if (!res.success) throw new Error(res.error)
  return res.data.list
}

/** 创建 API 密钥,返回 { apiKey, secret }(secret 仅此一次返回)。 */
export async function createApiKey(req: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
  const res = await fetchApi<CreateApiKeyResponse>('/api/developer/api-keys', {
    method: 'POST',
    body: JSON.stringify(req),
  })
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** 删除 API 密钥。 */
export async function deleteApiKey(id: string): Promise<void> {
  const res = await fetchApi<{ ok: boolean }>(`/api/developer/api-keys/${id}`, {
    method: 'DELETE',
  })
  if (!res.success) throw new Error(res.error)
}

/** 更新 API 密钥(权限 / 状态 / 名称 / 速率)。 */
export async function updateApiKey(
  id: string,
  patch: {
    name?: string
    permissions?: ApiKeyPermission[]
    rateLimit?: number
    status?: 'active' | 'revoked'
  },
): Promise<ApiKeyInfo> {
  const res = await fetchApi<{ apiKey: ApiKeyInfo }>(`/api/developer/api-keys/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  if (!res.success) throw new Error(res.error)
  return res.data.apiKey
}

/** 轮换 API 密钥 secret,返回新 secret(旧 secret 立即失效)。 */
export async function rotateApiKeySecret(id: string): Promise<RotateApiKeyResponse> {
  const res = await fetchApi<RotateApiKeyResponse>(`/developer/keys/${id}/reset`, {
    method: 'POST',
  })
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** 查询 API 密钥用量。 */
export async function fetchApiKeyUsage(id: string): Promise<ApiKeyQuotaInfo> {
  const res = await fetchApi<ApiKeyQuotaInfo>(`/api/developer/api-keys/${id}/usage`)
  if (!res.success) throw new Error(res.error)
  return res.data
}
