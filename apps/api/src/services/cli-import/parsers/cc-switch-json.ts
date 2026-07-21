/**
 * cc-switch config.json parser(旧版兼容)
 *
 * 早期 cc-switch 用 JSON 文件存储(~/.cc-switch/config.json)。
 * 格式与 SQLite 行结构相同,字段名走 camelCase。
 *
 * {
 *   "schemaVersion": 15,
 *   "providers": [
 *     {
 *       "id": "...",
 *       "appType": "claude" | "codex" | ...,
 *       "name": "...",
 *       "settingsConfig": { "apiBaseUrl", "apiKey", "model", "apiFormat", ... },
 *       "isCurrent": true,
 *       "category": "...",
 *       "websiteUrl": "...",
 *       "icon": "...",
 *       "iconColor": "..."
 *     }
 *   ]
 * }
 */
import type { CliApiFormat, CliAppType, ImportedProvider } from '@ihui/types'

import {
  deduplicateName,
  inferProviderCode,
  normalizeProvider,
  sanitizeProviderName,
} from '../mapper.js'
import type { ParserInput, ParserResult } from './types.js'

const VALID_APP_TYPES: CliAppType[] = [
  'claude',
  'claude-desktop',
  'codex',
  'gemini',
  'opencode',
  'openclaw',
  'hermes',
]

interface SettingsConfig {
  apiBaseUrl?: string
  baseUrl?: string
  apiKey?: string
  model?: string
  modelId?: string
  apiFormat?: CliApiFormat
  category?: string
  websiteUrl?: string
  icon?: string
  iconColor?: string
  notes?: string
}

interface JsonProvider {
  id: string
  appType?: string
  name: string
  settingsConfig?: SettingsConfig
  isCurrent?: boolean
  category?: string
  websiteUrl?: string
  icon?: string
  iconColor?: string
}

interface CcSwitchJsonFile {
  schemaVersion?: number
  version?: string
  providers?: JsonProvider[]
}

function normalizeApiFormat(raw?: string): CliApiFormat {
  if (!raw) return 'openai_chat'
  const r = raw.toLowerCase()
  if (r === 'anthropic' || r === 'anthropic_messages') return 'anthropic_messages'
  if (r === 'responses' || r === 'openai_responses') return 'openai_responses'
  if (r === 'gemini' || r === 'gemini_native') return 'gemini_native'
  return 'openai_chat'
}

export function parseCcSwitchJson(input: ParserInput): ParserResult {
  const text = input.text ?? (input.buffer ? input.buffer.toString('utf8') : '')
  if (!text.trim()) {
    throw new Error('cc-switch-json parser 输入为空')
  }
  let parsed: CcSwitchJsonFile
  try {
    parsed = JSON.parse(text) as CcSwitchJsonFile
  } catch (err) {
    throw new Error(`cc-switch config.json 解析失败: ${(err as Error).message}`)
  }
  if (!parsed.providers || !Array.isArray(parsed.providers)) {
    return {
      providers: [],
      globalWarnings: ['config.json 中未找到 providers 数组'],
      sourceVersion: parsed.version,
      sourceSchemaVersion: parsed.schemaVersion,
    }
  }
  const globalWarnings: string[] = []
  const providers: ImportedProvider[] = []
  for (const p of parsed.providers) {
    try {
      const sc = p.settingsConfig ?? {}
      const baseUrl = sc.apiBaseUrl ?? sc.baseUrl ?? ''
      const apiKey = sc.apiKey
      const model = sc.model ?? sc.modelId
      const apiFormat = normalizeApiFormat(sc.apiFormat as string | undefined)
      const appType =
        p.appType && VALID_APP_TYPES.includes(p.appType as CliAppType)
          ? (p.appType as CliAppType)
          : undefined
      const rawName = sanitizeProviderName(p.name || p.id || 'unnamed')
      const name = deduplicateName(rawName, appType)
      const providerCode = inferProviderCode(baseUrl, apiFormat, model)
      const provider: ImportedProvider = {
        sourceId: p.id,
        sourceAppType: appType,
        name,
        providerCode,
        baseUrl,
        apiKey,
        apiFormat,
        modelIdForTest: model,
        meta: {
          category: p.category ?? sc.category,
          websiteUrl: p.websiteUrl ?? sc.websiteUrl,
          icon: p.icon ?? sc.icon,
          iconColor: p.iconColor ?? sc.iconColor,
          notes: sc.notes,
          models: model ? [model] : undefined,
        },
        isCurrent: p.isCurrent === true,
        warnings: [],
      }
      providers.push(normalizeProvider(provider))
    } catch (err) {
      globalWarnings.push(`解析 provider ${p?.id ?? '?'} 失败: ${(err as Error).message}`)
    }
  }
  return {
    providers,
    globalWarnings,
    sourceVersion: parsed.version,
    sourceSchemaVersion: parsed.schemaVersion,
  }
}
