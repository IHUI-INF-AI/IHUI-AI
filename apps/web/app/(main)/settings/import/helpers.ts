/**
 * CLI 配置导入 API 调用函数
 */
import { fetchApi } from '@/lib/api'
import type {
  CliConfigSource,
  CommitResult,
  HistoryData,
  ImportConflictStrategy,
  ParseResult,
  SourcesData,
} from './types'

/** 通用 API 包装:从 ApiResult 解出 data,失败抛错 */
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/** GET /api/user/cli-import/sources — 支持的导入来源 */
export function fetchSources() {
  return api<SourcesData>('/api/user/cli-import/sources')
}

/**
 * POST /api/user/cli-import/parse-file — multipart 上传文件
 *
 * @param source 导入来源
 * @param file 配置文件
 * @param authJsonText 可选,Codex CLI 的 auth.json 内容
 * @param settingsJsonText 可选,Gemini CLI 的 settings.json 内容
 */
export function parseFile(
  source: CliConfigSource,
  file: File,
  opts?: { authJsonText?: string; settingsJsonText?: string },
): Promise<ParseResult> {
  const fd = new FormData()
  fd.append('source', source)
  fd.append('file', file)
  if (opts?.authJsonText) fd.append('authJson', opts.authJsonText)
  if (opts?.settingsJsonText) fd.append('settingsJson', opts.settingsJsonText)
  return api<ParseResult>('/api/user/cli-import/parse-file', {
    method: 'POST',
    body: fd,
  })
}

/** POST /api/user/cli-import/commit — 落库 */
export function commitImport(
  previewId: string,
  selectedProviderIds: string[],
  conflictStrategy: ImportConflictStrategy,
): Promise<CommitResult> {
  return api<CommitResult>('/api/user/cli-import/commit', {
    method: 'POST',
    body: JSON.stringify({ previewId, selectedProviderIds, conflictStrategy }),
  })
}

/** GET /api/user/cli-import/history — 导入历史 */
export function fetchHistory() {
  return api<HistoryData>('/api/user/cli-import/history')
}

/** 文件大小格式化 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * 来源 → i18n key 映射
 */
export function sourceLabelKey(source: CliConfigSource): string {
  const map: Record<CliConfigSource, string> = {
    'cc-switch': 'sourceCcSwitch',
    'codex++': 'sourceCodexPlus',
    'claude-cli': 'sourceClaudeCli',
    'codex-cli': 'sourceCodexCli',
    'gemini-cli': 'sourceGeminiCli',
    hermes: 'sourceHermes',
  }
  return map[source]
}
