import 'server-only'

import type { ApiResult } from '@ihui/types'

/**
 * 服务端专用 fetch wrapper。
 *
 * 与 `apps/web/src/lib/api.ts` 的客户端 `fetchApi` 区别:
 * - 不依赖 zustand client store(`useAuthStore` / `useLoginDialogStore`)
 * - 不处理 401 弹窗(由客户端路由拦截)
 * - 直接读 `process.env.API_URL` 拼接后端地址
 *
 * 用法(server component / route handler):
 * ```ts
 * const r = await fetchApiServer<ArticleDetail>(`/api/news/articles/${id}`)
 * if (!r.success) notFound()
 * const article = r.data.article
 * ```
 */
export async function fetchApiServer<T>(
  url: string,
  options: RequestInit = {},
): Promise<ApiResult<T>> {
  const base = (process.env.API_URL ?? 'http://localhost:3001').replace(/\/$/, '')
  const full = /^https?:\/\//i.test(url) ? url : `${base}${url.startsWith('/') ? '' : '/'}${url}`

  try {
    const resp = await fetch(full, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
      },
      next: { revalidate: 60, ...options.next },
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      let message = text || `请求失败(${resp.status})`
      let errorCode: string | undefined
      try {
        const parsed = JSON.parse(text)
        if (parsed && typeof parsed.message === 'string') message = parsed.message
        if (parsed && typeof parsed.errorCode === 'string') errorCode = parsed.errorCode
      } catch {
        /* 非 JSON 响应保留 text */
      }
      return { success: false, error: message, status: resp.status, errorCode }
    }

    const json = (await resp.json()) as { code: number; data: T; message?: string; errorCode?: string }
    if (json.code !== 0) {
      return {
        success: false,
        error: json.message || '请求失败',
        status: resp.status,
        errorCode: json.errorCode,
      }
    }
    return { success: true, data: json.data }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '网络异常',
    }
  }
}
