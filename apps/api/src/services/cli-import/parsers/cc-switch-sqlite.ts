/**
 * cc-switch SQLite parser
 *
 * 用 sql.js(WASM)读取 ~/.cc-switch/cc-switch.db,查询 providers 表。
 *
 * 表结构(cc-switch SCHEMA_VERSION >= 15):
 *   settings(key TEXT PRIMARY KEY, value TEXT)
 *   providers(
 *     id TEXT PRIMARY KEY,
 *     app_type TEXT,        -- claude/claude-desktop/codex/gemini/opencode/openclaw/hermes
 *     name TEXT,
 *     settings_config TEXT, -- JSON
 *     is_current INTEGER,
 *     created_at TEXT, updated_at TEXT,
 *     category TEXT, website_url TEXT, icon TEXT, icon_color TEXT
 *   )
 *
 * settings_config JSON 字段约定:
 *   { apiBaseUrl, apiKey, model, apiFormat, ... }
 *
 * 注意:
 * - PRAGMA user_version 必须存在,值 >= 15 才认为是新格式;低于 15 走 cc-switch-json fallback
 * - sql.js 的 WASM 路径用 createRequire 解析(避免 ESM 静态导入限制)
 * - settings_config 字段名可能因版本不同(apiBaseUrl / baseUrl / api_base_url),全部容错
 */
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { createRequire } from 'node:module'

import type { CliApiFormat, CliAppType, ImportedProvider } from '@ihui/types'

import {
  deduplicateName,
  inferProviderCode,
  normalizeProvider,
  sanitizeProviderName,
} from '../mapper.js'
import type { ParserInput, ParserResult } from './types.js'

const require = createRequire(import.meta.url)

let sqlPromise: Promise<SqlJsStatic> | null = null

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    // sql.js wasm 路径:从 node_modules 解析
    const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')
    sqlPromise = initSqlJs({ locateFile: () => wasmPath })
  }
  return sqlPromise
}

const VALID_APP_TYPES: CliAppType[] = [
  'claude',
  'claude-desktop',
  'codex',
  'gemini',
  'opencode',
  'openclaw',
  'hermes',
]

interface CcSwitchSettingsConfig {
  apiBaseUrl?: string
  baseUrl?: string
  api_base_url?: string
  apiKey?: string
  api_key?: string
  model?: string
  modelId?: string
  model_id?: string
  apiFormat?: CliApiFormat
  api_format?: string
  category?: string
  websiteUrl?: string
  website_url?: string
  icon?: string
  iconColor?: string
  icon_color?: string
  notes?: string
}

interface CcSwitchProviderRow {
  id: string
  app_type: string
  name: string
  settings_config: string | null
  is_current: number
  category: string | null
  website_url: string | null
  icon: string | null
  icon_color: string | null
}

function pickString(...vals: (string | undefined | null)[]): string | undefined {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

function normalizeApiFormat(raw?: string): CliApiFormat {
  if (!raw) return 'openai_chat'
  const r = raw.toLowerCase()
  if (r === 'anthropic' || r === 'anthropic_messages') return 'anthropic_messages'
  if (r === 'responses' || r === 'openai_responses') return 'openai_responses'
  if (r === 'gemini' || r === 'gemini_native') return 'gemini_native'
  return 'openai_chat'
}

function rowToProvider(row: CcSwitchProviderRow, warnings: string[]): ImportedProvider {
  const settingsConfig: CcSwitchSettingsConfig = row.settings_config
    ? (JSON.parse(row.settings_config) as CcSwitchSettingsConfig)
    : {}

  const baseUrl =
    pickString(settingsConfig.apiBaseUrl, settingsConfig.baseUrl, settingsConfig.api_base_url) ?? ''
  const apiKey = pickString(settingsConfig.apiKey, settingsConfig.api_key)
  const model = pickString(settingsConfig.model, settingsConfig.modelId, settingsConfig.model_id)
  const apiFormat = normalizeApiFormat(
    settingsConfig.apiFormat ?? (settingsConfig.api_format as string | undefined),
  )
  const appType = VALID_APP_TYPES.includes(row.app_type as CliAppType)
    ? (row.app_type as CliAppType)
    : undefined

  const rawName = sanitizeProviderName(row.name || row.id || 'unnamed')
  const name = deduplicateName(rawName, appType)
  const providerCode = inferProviderCode(baseUrl, apiFormat, model)

  if (!row.settings_config) {
    warnings.push(`provider ${row.id} settings_config 为空,仅能导入元信息`)
  }

  const provider: ImportedProvider = {
    sourceId: row.id,
    sourceAppType: appType,
    name,
    providerCode,
    baseUrl,
    apiKey,
    apiFormat,
    modelIdForTest: model,
    meta: {
      category: row.category ?? settingsConfig.category,
      websiteUrl: row.website_url ?? settingsConfig.websiteUrl,
      icon: row.icon ?? settingsConfig.icon,
      iconColor: row.icon_color ?? settingsConfig.iconColor,
      notes: settingsConfig.notes,
      models: model ? [model] : undefined,
    },
    isCurrent: row.is_current === 1,
    warnings: [],
  }
  return normalizeProvider(provider)
}

/**
 * 解析 cc-switch SQLite db 文件。
 *
 * - 输入 buffer 必须是 SQLite 二进制
 * - 若 PRAGMA user_version < 15,抛出明确错误让上层走 cc-switch-json fallback
 */
export async function parseCcSwitchSqlite(input: ParserInput): Promise<ParserResult> {
  if (!input.buffer) {
    throw new Error('cc-switch-sqlite parser 需要二进制 buffer 输入')
  }
  const SQL = await getSqlJs()
  const db: Database = new SQL.Database(new Uint8Array(input.buffer))

  try {
    // 1. 检查 schema_version
    let schemaVersion = 0
    try {
      const svRes = db.exec('PRAGMA user_version')
      const first = svRes[0]
      if (first) {
        const v = first.values[0]?.[0]
        schemaVersion = typeof v === 'number' ? v : 0
      }
    } catch {
      /* PRAGMA 可能失败,继续 */
    }
    if (schemaVersion > 0 && schemaVersion < 15) {
      throw new Error(
        `cc-switch SQLite schema_version=${schemaVersion} 低于 15,请走 config.json 兼容路径`,
      )
    }

    // 2. 读 settings 表(取 version 信息)
    let appVersion: string | undefined
    try {
      const settingsRes = db.exec("SELECT value FROM settings WHERE key = 'app_version'")
      const first = settingsRes[0]
      if (first) {
        const v = first.values[0]?.[0]
        if (typeof v === 'string') appVersion = v
      }
    } catch {
      /* settings 表可能不存在 */
    }

    // 3. 查 providers 表
    const globalWarnings: string[] = []
    const providers: ImportedProvider[] = []

    // 表结构容错:用 PRAGMA table_info 探测列
    const tableInfoRes = db.exec("PRAGMA table_info('providers')")
    const tableInfo = tableInfoRes[0]
    if (!tableInfo) {
      return {
        providers: [],
        globalWarnings: ['cc-switch.db 中未找到 providers 表'],
        sourceVersion: appVersion,
        sourceSchemaVersion: schemaVersion,
      }
    }
    const columns = new Set<string>()
    for (const row of tableInfo.values) {
      const colName = row[1]
      if (typeof colName === 'string') columns.add(colName)
    }

    // 构造查询:缺失字段用 NULL 占位
    const col = (name: string): string => (columns.has(name) ? name : 'NULL')
    const sql = `SELECT
      ${col('id')} AS id,
      ${col('app_type')} AS app_type,
      ${col('name')} AS name,
      ${col('settings_config')} AS settings_config,
      ${col('is_current')} AS is_current,
      ${col('category')} AS category,
      ${col('website_url')} AS website_url,
      ${col('icon')} AS icon,
      ${col('icon_color')} AS icon_color
      FROM providers`

    const res = db.exec(sql)
    const resultRows = res[0]
    if (!resultRows) {
      return {
        providers: [],
        globalWarnings: ['providers 表为空'],
        sourceVersion: appVersion,
        sourceSchemaVersion: schemaVersion,
      }
    }
    const colNames = resultRows.columns
    for (const row of resultRows.values) {
      try {
        const obj: Record<string, unknown> = {}
        colNames.forEach((c, i) => {
          obj[c] = row[i]
        })
        const providerRow: CcSwitchProviderRow = {
          id: String(obj.id ?? ''),
          app_type: String(obj.app_type ?? ''),
          name: String(obj.name ?? ''),
          settings_config:
            obj.settings_config === null || obj.settings_config === undefined
              ? null
              : String(obj.settings_config),
          is_current: Number(obj.is_current ?? 0) || 0,
          category:
            obj.category === null || obj.category === undefined ? null : String(obj.category),
          website_url:
            obj.website_url === null || obj.website_url === undefined
              ? null
              : String(obj.website_url),
          icon: obj.icon === null || obj.icon === undefined ? null : String(obj.icon),
          icon_color:
            obj.icon_color === null || obj.icon_color === undefined ? null : String(obj.icon_color),
        }
        const provider = rowToProvider(providerRow, globalWarnings)
        providers.push(provider)
      } catch (err) {
        globalWarnings.push(`解析 provider 行失败: ${(err as Error).message}`)
      }
    }

    return {
      providers,
      globalWarnings,
      sourceVersion: appVersion ?? `schema v${schemaVersion}`,
      sourceSchemaVersion: schemaVersion,
    }
  } finally {
    db.close()
  }
}
