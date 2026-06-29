/**
 * 管理后台 - OAuth 审计日志 API (Round 27-C 新增)
 * 后端约定: /api/v1/agents/oauth-apps/audit-logs (与 oauth_apps.py list_oauth_audit_logs 对接)
 *
 * 用途: 管理员审计追溯所有 OAuth 敏感操作.
 * 覆盖事件: app_create / app_delete / app_reset_secret / authorize_grant /
 *           authorize_deny / token_issue / token_refresh / protected_access
 */
import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { normalizeApiResponse } from '@/utils/api-response'

/** OAuth 审计日志条目 */
export interface AdminOAuthAuditLog {
  id: number
  event: string
  client_id: string | null
  user_uuid: string | null
  ip: string | null
  status: string // success / failure
  detail: string | null
  request_summary: Record<string, unknown> | null
  created_at: string | null
}

/** 审计日志查询参数 */
export interface AdminOAuthAuditLogQueryParams {
  event?: string
  client_id?: string
  user_uuid?: string
  status?: string
  start_time?: string
  end_time?: string
  page?: number
  page_size?: number
}

/** 审计日志分页返回 */
export interface AdminOAuthAuditLogPage {
  list: AdminOAuthAuditLog[]
  total: number
  page: number
  page_size: number
}

/** 事件类型选项 (与后端 _log_oauth_audit 调用点对齐) */
export const OAUTH_AUDIT_EVENTS: Array<{ value: string; label: string }> = [
  { value: 'app_create', label: '创建应用' },
  { value: 'app_delete', label: '删除应用' },
  { value: 'app_reset_secret', label: '重置密钥' },
  { value: 'authorize_grant', label: '授权签发 code' },
  { value: 'authorize_deny', label: '用户拒绝授权' },
  { value: 'token_issue', label: 'code 换 token' },
  { value: 'token_refresh', label: '刷新 token' },
  { value: 'protected_access', label: '受保护资源访问' },
]

/** 状态选项 */
export const OAUTH_AUDIT_STATUSES: Array<{ value: string; label: string }> = [
  { value: 'success', label: '成功' },
  { value: 'failure', label: '失败' },
]

/**
 * 查询 OAuth 审计日志 (分页).
 * 后端: GET /api/v1/agents/oauth-apps/audit-logs
 */
export async function getAdminOAuthAuditLogs(
  params?: AdminOAuthAuditLogQueryParams
): Promise<ApiResponse<AdminOAuthAuditLog[]>> {
  try {
    const response = await request.get<AdminOAuthAuditLog[]>(
      '/api/v1/agents/oauth-apps/audit-logs',
      { params }
    )
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '请求失败',
      data: [],
      success: false,
      timestamp: Date.now(),
    }
  }
}

/**
 * 导出 OAuth 审计日志为 CSV (Round 29-C 新增).
 * 后端: GET /api/v1/agents/oauth-apps/audit-logs/export
 *
 * 返回 Blob (text/csv, 含 UTF-8 BOM 头确保 Excel 中文不乱码).
 * 前端用 downloadBlob 工具触发浏览器下载, 文件名由后端 Content-Disposition 指定.
 *
 * 注意: 因后端 require_login 通过 Authorization header 校验, 无法用 window.open,
 * 必须用 axios responseType: 'blob' 拉取后再触发下载.
 *
 * @param params 筛选条件 (与 getAdminOAuthAuditLogs 一致, 但分页参数被忽略, 导出全量)
 * @param onProgress 可选进度回调 (loaded/total/percentage)
 * @returns 下载是否成功 (true=已触发浏览器下载, false=失败)
 */
export async function exportAdminOAuthAuditLogs(
  params?: AdminOAuthAuditLogQueryParams,
  onProgress?: (loaded: number, total: number) => void
): Promise<boolean> {
  try {
    const response = await request.get<Blob>(
      '/api/v1/agents/oauth-apps/audit-logs/export',
      {
        params,
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            onProgress(progressEvent.loaded, progressEvent.total)
          }
        },
      }
    )
    const blob = response as unknown as Blob
    // 从 Content-Disposition 提取文件名, 失败则用默认名
    let filename = `oauth-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
    // axios 响应头在 response.headers (此处 request 拦截器可能已剥离, 用安全访问)
    try {
      const headers = (response as { headers?: Record<string, string> })?.headers || {}
      const cd = headers['content-disposition'] || headers['Content-Disposition']
      if (cd) {
        const match = /filename="?([^";]+)"?/.exec(cd)
        if (match && match[1]) filename = decodeURIComponent(match[1])
      }
    } catch {
      // 保持默认 filename
    }
    const { downloadBlob } = await import('@/utils/download')
    downloadBlob(blob, filename)
    return true
  } catch (e) {
    // 导出失败时, 尝试读取 Blob 中的错误信息 (后端可能返回 JSON 错误)
    try {
      const errBlob = (e as { response?: { data?: Blob } })?.response?.data
      if (errBlob && errBlob instanceof Blob) {
        const text = await errBlob.text()
        const errObj = JSON.parse(text)
        throw new Error(errObj?.message || '导出失败')
      }
    } catch (parseErr) {
      if (parseErr instanceof Error && parseErr.message !== '导出失败') {
        throw parseErr
      }
    }
    throw new Error((e as Error)?.message || '导出失败')
  }
}
