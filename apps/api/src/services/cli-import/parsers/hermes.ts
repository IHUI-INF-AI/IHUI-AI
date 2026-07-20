/**
 * Hermes CLI parser
 *
 * 配置:`~/.hermes/config.yaml`(Windows 在 `%LOCALAPPDATA%\hermes\config.yaml`)
 *
 * YAML 结构:
 *   default_provider: openai
 *   custom_providers:
 *     - name: OpenAI
 *       api_base_url: https://api.openai.com/v1
 *       api_key: sk-...
 *       model: gpt-4o
 *       api_format: openai_chat   # openai_chat / anthropic_messages / openai_responses / gemini_native
 *       is_active: true
 *       category: ...
 *       website_url: ...
 *       icon: ...
 *       icon_color: ...
 *
 * 用 js-yaml 解析(已加入 @ihui/api 依赖)。
 */
import yaml from 'js-yaml'

import type { CliApiFormat, ImportedProvider } from '@ihui/types'

import { inferProviderCode, normalizeProvider, sanitizeProviderName } from '../mapper.js'
import type { ParserInput, ParserResult } from './types.js'

interface HermesProvider {
  id?: string
  name?: string
  api_base_url?: string
  apiBaseUrl?: string
  api_key?: string
  apiKey?: string
  model?: string
  api_format?: string
  apiFormat?: string
  is_active?: boolean
  isActive?: boolean
  category?: string
  website_url?: string
  websiteUrl?: string
  icon?: string
  icon_color?: string
  iconColor?: string
}

interface HermesConfig {
  default_provider?: string
  defaultProvider?: string
  custom_providers?: HermesProvider[]
  customProviders?: HermesProvider[]
}

function normalizeApiFormat(raw?: string): CliApiFormat {
  if (!raw) return 'openai_chat'
  const r = raw.toLowerCase()
  if (r === 'anthropic' || r === 'anthropic_messages') return 'anthropic_messages'
  if (r === 'responses' || r === 'openai_responses') return 'openai_responses'
  if (r === 'gemini' || r === 'gemini_native') return 'gemini_native'
  return 'openai_chat'
}

export function parseHermes(input: ParserInput): ParserResult {
  const text = input.text ?? (input.buffer ? input.buffer.toString('utf8') : '')
  if (!text.trim()) {
    throw new Error('hermes parser 输入为空')
  }
  let cfg: HermesConfig
  try {
    cfg = yaml.load(text) as unknown as HermesConfig
  } catch (err) {
    throw new Error(`hermes config.yaml 解析失败: ${(err as Error).message}`)
  }
  if (!cfg) {
    return { providers: [], globalWarnings: ['config.yaml 解析为空'] }
  }
  const providers = cfg.custom_providers ?? cfg.customProviders ?? []
  if (!Array.isArray(providers) || providers.length === 0) {
    return {
      providers: [],
      globalWarnings: ['config.yaml 中未找到 custom_providers 数组或为空'],
    }
  }
  const defaultProvider = cfg.default_provider ?? cfg.defaultProvider
  const globalWarnings: string[] = []
  const result: ImportedProvider[] = []
  providers.forEach((p, idx) => {
    try {
      const baseUrl = p.api_base_url ?? p.apiBaseUrl ?? ''
      const apiKey = p.api_key ?? p.apiKey
      const model = p.model
      const apiFormat = normalizeApiFormat(p.api_format ?? p.apiFormat)
      const sourceId = p.id ?? `hermes::${idx}`
      const rawName = sanitizeProviderName(p.name ?? sourceId)
      const providerCode = inferProviderCode(baseUrl, apiFormat, model)
      const isCurrent =
        (p.is_active ?? p.isActive) === true ||
        defaultProvider === p.name ||
        defaultProvider === sourceId
      const provider: ImportedProvider = {
        sourceId,
        sourceAppType: 'hermes',
        name: rawName,
        providerCode,
        baseUrl,
        apiKey,
        apiFormat,
        modelIdForTest: model,
        meta: {
          category: p.category,
          websiteUrl: p.website_url ?? p.websiteUrl,
          icon: p.icon,
          iconColor: p.icon_color ?? p.iconColor,
          models: model ? [model] : undefined,
        },
        isCurrent,
        warnings: [],
      }
      result.push(normalizeProvider(provider))
    } catch (err) {
      globalWarnings.push(`解析 hermes provider #${idx} 失败: ${(err as Error).message}`)
    }
  })
  return {
    providers: result,
    globalWarnings,
  }
}
