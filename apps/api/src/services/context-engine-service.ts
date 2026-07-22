/**
 * Context Engine 服务 — 多维 @ 提及检索后端核心。
 *
 * 职责:
 * 1. symbol 检索:复用 in-process codebaseIndexService(pgvector 语义搜索)→ 返回符号定位
 * 2. database schema 查询:用 drizzle db.execute 查 information_schema(表清单 + 列定义)
 * 3. folder 扫描:用 node:fs 扫描工作区目录(限深度 2 层防爆炸)
 * 4. file 检索:委托 file-queries.findRecentFiles(按 q 过滤)
 *
 * 性能:检索结果带 LRU 缓存(Map<key, {ts, data}>,TTL 60s,容量 100 条)。
 *
 * 跨服务说明:task 约定 "调 ai-service /v1/codebase/search",但该路由实际由
 * apps/api 自身承载(v1-codebase-search.ts),ai-service codebase_indexer 反向调用本服务。
 * 因此 symbol 检索直接复用 in-process codebaseIndexService,避免 HTTP 自调用回环。
 */

import { readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { sql } from 'drizzle-orm'

import { db } from '../db/index.js'
import { codebaseIndexService } from './codebase-index-service.js'
import { findRecentFiles } from '../db/file-queries.js'
import type {
  ContextMention,
  DatabaseColumn,
  DatabaseSchemaResult,
  FolderEntry,
  MentionType,
  SymbolSearchItem,
} from '@ihui/types'

/** LRU 缓存条目 */
interface CacheEntry<T> {
  ts: number
  data: T
}

const CACHE_TTL_MS = 60_000
const CACHE_MAX = 100

class LRUCache<K, V> {
  private map = new Map<K, CacheEntry<V>>()

  get(key: K): V | undefined {
    const entry = this.map.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
      this.map.delete(key)
      return undefined
    }
    // 重插到末尾(LRU 顺序)
    this.map.delete(key)
    this.map.set(key, entry)
    return entry.data
  }

  set(key: K, value: V): void {
    if (this.map.size >= CACHE_MAX) {
      const firstKey = this.map.keys().next().value
      if (firstKey !== undefined) this.map.delete(firstKey)
    }
    this.map.set(key, { ts: Date.now(), data: value })
  }
}

/** 数据库表清单行(information_schema.tables) */
interface TableRow {
  table_name: string
}

/** 数据库列定义行(information_schema.columns) */
interface ColumnRow {
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
}

const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  '__pycache__',
  'dist',
  'build',
  '.vite',
  '.cache',
  'venv',
  '.venv',
  'env',
  '.env',
  '$RECYCLE.BIN',
  '.next',
  '.turbo',
  'coverage',
])

class ContextEngineService {
  private cache = new LRUCache<string, unknown>()

  /** 统一检索入口(按 type 分发) */
  async search(opts: {
    query: string
    type: MentionType
    userId: string
    workspacePath?: string
    limit?: number
  }): Promise<ContextMention[]> {
    const { query, type, userId, workspacePath, limit = 20 } = opts
    const cacheKey = `${type}:${userId}:${workspacePath ?? ''}:${query}:${limit}`
    const cached = this.cache.get(cacheKey) as ContextMention[] | undefined
    if (cached) return cached

    let result: ContextMention[]
    switch (type) {
      case 'file':
        result = await this.searchFiles(query, userId, limit)
        break
      case 'database':
        result = await this.searchDatabaseTables(query, limit)
        break
      case 'symbol': {
        const symbols = await this.searchSymbols(query, limit)
        result = symbols.map((s) => ({
          id: `symbol:${s.symbolName}:${s.filePath}:${s.lineStart ?? 0}`,
          type: 'symbol' as const,
          label: s.symbolName,
          detail: `${s.symbolType} · ${s.filePath}${s.lineStart ? `:${s.lineStart}` : ''}`,
          insertText: `@symbol:${s.symbolName}`,
          meta: {
            symbolName: s.symbolName,
            symbolType: s.symbolType as 'class' | 'function' | 'interface' | 'type' | 'variable',
            filePath: s.filePath,
            lineStart: s.lineStart,
            lineEnd: s.lineEnd,
          },
        }))
        break
      }
      case 'folder':
        result = await this.searchFolders(query, workspacePath, limit)
        break
      case 'web':
        // web 检索为可选项,不强求;返回空数组(前端可走浏览器侧 WebSearch)
        result = []
        break
      default:
        result = []
    }
    this.cache.set(cacheKey, result)
    return result
  }

  /** file 检索:查最近文件,按 q 过滤 */
  private async searchFiles(
    query: string,
    userId: string,
    limit: number,
  ): Promise<ContextMention[]> {
    try {
      const files = await findRecentFiles(userId, Math.max(limit * 3, 50))
      const q = query.trim().toLowerCase()
      const filtered = q
        ? files.filter(
            (f) =>
              f.name.toLowerCase().includes(q) ||
              f.path.toLowerCase().includes(q),
          )
        : files
      return filtered.slice(0, limit).map((f) => ({
        id: `file:${f.id}`,
        type: 'file' as const,
        label: f.name,
        detail: f.path,
        insertText: `@${f.path}`,
        meta: { path: f.path },
      }))
    } catch {
      return []
    }
  }

  /** database 检索:查 information_schema.tables,按 q 过滤表名 */
  async searchDatabaseTables(query: string, limit: number): Promise<ContextMention[]> {
    const q = query.trim().toLowerCase()
    const cacheKey = `db:tables:${q}:${limit}`
    const cached = this.cache.get(cacheKey) as ContextMention[] | undefined
    if (cached) return cached
    try {
      const rows = (await db.execute(sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ${q ? sql`AND table_name ILIKE ${'%' + q + '%'}` : sql``}
        ORDER BY table_name
        LIMIT ${limit}
      `)) as unknown as TableRow[]
      const result: ContextMention[] = rows.map((r) => ({
        id: `database:${r.table_name}`,
        type: 'database' as const,
        label: r.table_name,
        detail: '数据表',
        insertText: `@table:${r.table_name}`,
        meta: { tableName: r.table_name },
      }))
      this.cache.set(cacheKey, result)
      return result
    } catch {
      return []
    }
  }

  /** database schema 查询:返回指定表的列定义 */
  async getTableSchema(tableName: string): Promise<DatabaseSchemaResult> {
    const cacheKey = `db:schema:${tableName}`
    const cached = this.cache.get(cacheKey) as DatabaseSchemaResult | undefined
    if (cached) return cached
    try {
      const rows = (await db.execute(sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${tableName}
        ORDER BY ordinal_position
      `)) as unknown as ColumnRow[]
      const columns: DatabaseColumn[] = rows.map((r) => ({
        columnName: r.column_name,
        dataType: r.data_type,
        isNullable: r.is_nullable === 'YES',
        columnDefault: r.column_default,
      }))
      const result: DatabaseSchemaResult = { tableName, columns }
      this.cache.set(cacheKey, result)
      return result
    } catch {
      return { tableName, columns: [] }
    }
  }

  /** symbol 检索:复用 codebaseIndexService 语义搜索(pgvector ANN) */
  async searchSymbols(query: string, limit: number): Promise<SymbolSearchItem[]> {
    if (!query.trim()) return []
    const cacheKey = `symbol:${query}:${limit}`
    const cached = this.cache.get(cacheKey) as SymbolSearchItem[] | undefined
    if (cached) return cached
    try {
      const chunks = await codebaseIndexService.search({
        query,
        topK: limit,
      })
      const result: SymbolSearchItem[] = chunks
        .filter((c) => c.symbolName)
        .map((c) => ({
          symbolName: c.symbolName ?? '',
          symbolType: c.symbolType ?? 'function',
          filePath: c.filePath,
          lineStart: c.lineStart,
          lineEnd: c.lineEnd,
          content: c.content,
          score: c.score,
        }))
      this.cache.set(cacheKey, result)
      return result
    } catch {
      return []
    }
  }

  /** folder 扫描:用 fs 扫描工作区目录(限深度 2 层防爆炸) */
  async searchFolders(
    query: string,
    workspacePath: string | undefined,
    limit: number,
  ): Promise<ContextMention[]> {
    if (!workspacePath) return []
    const cacheKey = `folder:${workspacePath}:${query}:${limit}`
    const cached = this.cache.get(cacheKey) as ContextMention[] | undefined
    if (cached) return cached
    try {
      const entries = this.scanFolders(workspacePath, 2)
      const q = query.trim().toLowerCase()
      const filtered = q
        ? entries.filter((e) => e.name.toLowerCase().includes(q) || e.path.toLowerCase().includes(q))
        : entries
      const result: ContextMention[] = filtered
        .slice(0, limit)
        .map((e) => ({
          id: `folder:${e.path}`,
          type: 'folder' as const,
          label: e.name,
          detail: relative(workspacePath, e.path).split(sep).join('/'),
          insertText: `@${relative(workspacePath, e.path).split(sep).join('/')}/`,
          meta: { path: e.path },
        }))
      this.cache.set(cacheKey, result)
      return result
    } catch {
      return []
    }
  }

  /** 递归扫描目录(限深度),只返回目录条目 */
  private scanFolders(root: string, maxDepth: number): FolderEntry[] {
    const result: FolderEntry[] = []
    const walk = (dir: string, depth: number) => {
      if (depth > maxDepth) return
      let entries: string[]
      try {
        entries = readdirSync(dir)
      } catch {
        return
      }
      for (const name of entries) {
        if (IGNORE_DIRS.has(name)) continue
        const full = join(dir, name)
        let st
        try {
          st = statSync(full)
        } catch {
          continue
        }
        if (st.isDirectory()) {
          result.push({ name, path: full, isDirectory: true })
          walk(full, depth + 1)
        }
      }
    }
    walk(root, 0)
    return result
  }
}

export const contextEngineService = new ContextEngineService()
