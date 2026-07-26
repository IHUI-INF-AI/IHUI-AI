/**
 * CLI 配置导入前端类型定义
 *
 * 与后端 @ihui/types 共享类型,这里仅声明 UI 专用辅助类型。
 */
import type {
  CliConfigSource,
  ImportConflictStrategy,
  ImportHistoryItem,
  ImportPreview,
  ImportedProvider,
} from '@ihui/types'

export type {
  CliConfigSource,
  ImportConflictStrategy,
  ImportHistoryItem,
  ImportPreview,
  ImportedProvider,
}

/** GET /cli-import/sources 响应 */
export interface SourceInfo {
  source: CliConfigSource
  description: string
}

export interface SourcesData {
  sources: SourceInfo[]
}

/** POST /cli-import/parse-file | parse-payload 响应 */
export interface ParseResult {
  preview: ImportPreview
}

/** POST /cli-import/commit 响应 */
export interface CommitResult {
  importId: string
  imported: number
  skipped: number
  failed: number
  failedDetails: Array<{ sourceId: string; reason: string }>
  configIds: number[]
}

/** GET /cli-import/history 响应 */
export interface HistoryData {
  list: ImportHistoryItem[]
  total: number
}

/** UI 状态:选中来源 + 选中文件 + preview + commit 进度 */
export interface ImportPageState {
  selectedSource: CliConfigSource | ''
  file: File | null
  preview: ImportPreview | null
  conflictStrategy: ImportConflictStrategy
  selectedProviderIds: Set<string>
  committing: boolean
  parsing: boolean
}
