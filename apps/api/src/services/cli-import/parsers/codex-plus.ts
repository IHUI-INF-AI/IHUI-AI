/**
 * codex++ BackendSettings parser
 *
 * 配置文件:`~/.codex-session-delete/settings.json`
 *
 * 结构(Rust serde 默认 camelCase):
 * {
 *   "appVersion": "...",
 *   "activeProfileId": "...",
 *   "profiles": [
 *     {
 *       "id": "...",
 *       "name": "...",
 *       "apiBaseUrl": "...",
 *       "apiKey": null | "...",   // ← skip_serializing 可能导致非激活 profile 的 apiKey 缺失
 *       "model": "...",
 *       "isActive": true,
 *       "contextWindow": "...",
 *       "category": "...",
 *       "websiteUrl": "..."
 *     }
 *   ],
 *   "relayMode": "official" | "mixedApi" | "pureApi" | "aggregate",
 *   "protocol": "responses" | "chatCompletions"
 * }
 *
 * 注意:
 * - 非激活 profile 因 #[serde(skip_serializing_if = "Option::is_none")] 可能丢失 apiKey
 *   → parser 标 warning,不阻断导入
 * - relayMode 决定 baseUrl 是 codex 官方 / OpenAI 直连 / 第三方聚合
 * - protocol 决定 apiFormat:responses → openai_responses,chatCompletions → openai_chat
 */
import type { CliApiFormat, ImportedProvider } from '@ihui/types'

import { inferProviderCode, normalizeProvider, sanitizeProviderName } from '../mapper.js'
import type { ParserInput, ParserResult } from './types.js'

type RelayMode = 'official' | 'mixedApi' | 'pureApi' | 'aggregate'
type Protocol = 'responses' | 'chatCompletions'

interface CodexProfile {
  id: string
  name: string
  apiBaseUrl?: string
  apiKey?: string | null
  model?: string
  isActive?: boolean
  contextWindow?: string
  category?: string
  websiteUrl?: string
}

interface BackendSettings {
  appVersion?: string
  activeProfileId?: string
  profiles?: CodexProfile[]
  relayMode?: RelayMode
  protocol?: Protocol
}

function pickApiFormat(protocol?: Protocol): CliApiFormat {
  if (protocol === 'responses') return 'openai_responses'
  return 'openai_chat'
}

export function parseCodexPlus(input: ParserInput): ParserResult {
  const text = input.text ?? (input.buffer ? input.buffer.toString('utf8') : '')
  if (!text.trim()) {
    throw new Error('codex++ parser 输入为空')
  }
  let settings: BackendSettings
  try {
    settings = JSON.parse(text) as BackendSettings
  } catch (err) {
    throw new Error(`codex++ settings.json 解析失败: ${(err as Error).message}`)
  }
  if (!settings.profiles || !Array.isArray(settings.profiles)) {
    return {
      providers: [],
      globalWarnings: ['codex++ settings.json 中未找到 profiles 数组'],
      sourceVersion: settings.appVersion,
    }
  }
  const globalWarnings: string[] = []
  if (settings.profiles.length === 0) {
    globalWarnings.push('profiles 为空数组')
  }
  const providers: ImportedProvider[] = []
  const apiFormat = pickApiFormat(settings.protocol)
  for (const p of settings.profiles) {
    try {
      const baseUrl = p.apiBaseUrl ?? ''
      const apiKey = p.apiKey ?? undefined
      const model = p.model
      const rawName = sanitizeProviderName(p.name || p.id || 'unnamed')
      const providerCode = inferProviderCode(baseUrl, apiFormat, model)
      const warnings: string[] = []
      if (!apiKey) {
        warnings.push('apiKey 缺失(可能是 codex++ skip_serializing 导致)')
      }
      const provider: ImportedProvider = {
        sourceId: p.id,
        // codex++ 不分 app_type,统一视为 codex CLI
        sourceAppType: 'codex',
        name: rawName,
        providerCode,
        baseUrl,
        apiKey,
        apiFormat,
        modelIdForTest: model,
        meta: {
          category: p.category,
          websiteUrl: p.websiteUrl,
          contextWindow: p.contextWindow,
          models: model ? [model] : undefined,
          relayMode: settings.relayMode,
          protocol: settings.protocol,
        },
        isCurrent: p.isActive === true || settings.activeProfileId === p.id,
        warnings,
      }
      providers.push(normalizeProvider(provider))
    } catch (err) {
      globalWarnings.push(`解析 codex++ profile ${p?.id ?? '?'} 失败: ${(err as Error).message}`)
    }
  }
  return {
    providers,
    globalWarnings,
    sourceVersion: settings.appVersion,
  }
}
