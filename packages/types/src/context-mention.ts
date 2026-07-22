/**
 * Context Mention 跨端类型契约(2026-07-22 立,对标 Qoder 多维 @ 提及)。
 *
 * 支持 5 类上下文提及:file / database / symbol / folder / web。
 * 由 packages/types 集中导出,apps/api 路由响应 + apps/web store/hooks/组件共用。
 */

/** 提及类型 */
export type MentionType = 'file' | 'database' | 'symbol' | 'folder' | 'web'

/** 符号子类型(class / function / interface / type / variable) */
export type SymbolType = 'class' | 'function' | 'interface' | 'type' | 'variable'

/** 单条上下文提及 */
export interface ContextMention {
  /** 唯一 id(类型 + 路径/表名/符号 key,用于 store 去重) */
  id: string
  /** 提及类型 */
  type: MentionType
  /** 显示名(文件名 / 表名 / 符号名 / 目录名 / URL 标题) */
  label: string
  /** 副标题(路径 / 列定义摘要 / 符号类型 / 子项数 / 域名) */
  detail?: string
  /** 插入到输入框的文本(如 `@path/to/file.ts` 或 `@table:users`) */
  insertText: string
  /** 类型相关元数据 */
  meta?: {
    /** file / folder / symbol 共用:绝对或相对路径 */
    path?: string
    /** database:表名 */
    tableName?: string
    /** database:列定义 JSON 字符串 */
    schema?: string
    /** symbol:符号名 */
    symbolName?: string
    /** symbol:符号类型 */
    symbolType?: SymbolType
    /** symbol:所在文件路径 */
    filePath?: string
    /** symbol:起始行(1-based) */
    lineStart?: number
    /** symbol:结束行(1-based) */
    lineEnd?: number
    /** web:URL */
    url?: string
  }
}

/** 检索结果 */
export interface MentionSearchResult {
  mentions: ContextMention[]
  total: number
}

/** 数据库表 schema 列定义 */
export interface DatabaseColumn {
  columnName: string
  dataType: string
  isNullable: boolean
  columnDefault?: string | null
}

/** 数据库表 schema 查询结果 */
export interface DatabaseSchemaResult {
  tableName: string
  columns: DatabaseColumn[]
}

/** 符号检索结果(由 codebase 语义搜索返回) */
export interface SymbolSearchItem {
  symbolName: string
  symbolType: string
  filePath: string
  lineStart: number
  lineEnd: number
  content?: string
  score?: number
}

/** 文件夹扫描条目 */
export interface FolderEntry {
  name: string
  path: string
  isDirectory: boolean
}
