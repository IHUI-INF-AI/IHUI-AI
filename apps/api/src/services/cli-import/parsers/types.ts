/**
 * Parser 通用结果类型。
 *
 * 每个 parser 都返回 ParserResult,由 index.ts 包装为 ImportPreview。
 * 输入形式灵活:Buffer(二进制 db/toml/yaml 文件)或 string(已读出的文本)。
 */
import type { ImportedMcpServer, ImportedProvider } from '@ihui/types'

export interface ParserInput {
  /** 原始字节(适合 db / 二进制) */
  buffer?: Buffer
  /** 原始文本(适合 json/toml/yaml/env),与 buffer 二选一 */
  text?: string
  /** 来源路径(仅用于元信息;Web 上传时为文件名) */
  sourcePath: string
  /**
   * 额外输入(parser 专用)。
   * 如 codex-cli parser 需要 config.toml 主输入 + auth.json 副输入;
   * 调用方可以 { authJsonText: "..." } 传入。
   */
  extra?: Record<string, unknown>
}

export interface ParserResult {
  providers: ImportedProvider[]
  mcpServers?: ImportedMcpServer[]
  globalWarnings: string[]
  sourceVersion?: string
  /** 源工具内部 schema/格式版本(如 cc-switch PRAGMA user_version) */
  sourceSchemaVersion?: number
}

export type ParserFn = (input: ParserInput) => Promise<ParserResult> | ParserResult
