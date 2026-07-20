/**
 * Codex CLI 原生配置 parser
 *
 * 主配置:`~/.codex/config.toml`(TOML 格式)
 * 凭证:`~/.codex/auth.json`(JSON 格式,可选)
 *
 * config.toml 结构:
 *   model = "gpt-5"
 *   model_provider = "openai"
 *
 *   [model_providers.openai]
 *   name = "OpenAI"
 *   base_url = "https://api.openai.com/v1"
 *   wire_api = "responses"   # or "chat"
 *   env_key = "OPENAI_API_KEY"
 *
 *   [model_providers.custom]
 *   name = "Custom"
 *   base_url = "https://api.example.com/v1"
 *   wire_api = "chat"
 *   env_key = "CUSTOM_API_KEY"
 *
 * auth.json:
 *   { "OPENAI_API_KEY": "sk-...", "CUSTOM_API_KEY": "..." }
 *
 * 调用约定:
 *   input.text = config.toml 内容(主输入)
 *   input.extra.authJsonText = auth.json 内容(可选,CLI/Desktop 提供)
 *
 * Web 上传场景:用户只能上传单个 config.toml,apiKey 缺失,标 warning
 */
import { parse as parseToml } from 'smol-toml'

import type { CliApiFormat, ImportedProvider } from '@ihui/types'

import { inferProviderCode, normalizeProvider, sanitizeProviderName } from '../mapper.js'
import type { ParserInput, ParserResult } from './types.js'

interface CodexModelProvider {
  name?: string
  base_url?: string
  baseUrl?: string
  wire_api?: string
  wireApi?: string
  env_key?: string
  envKey?: string
}

interface CodexConfigToml {
  model?: string
  model_provider?: string
  modelProvider?: string
  model_providers?: Record<string, CodexModelProvider>
  modelProviders?: Record<string, CodexModelProvider>
}

interface CodexAuthJson {
  [key: string]: string
}

function pickApiFormat(wireApi?: string): CliApiFormat {
  if (!wireApi) return 'openai_responses'
  const r = wireApi.toLowerCase()
  if (r === 'chat' || r === 'chatcompletions' || r === 'chat_completions') return 'openai_chat'
  return 'openai_responses'
}

export function parseCodexCli(input: ParserInput): ParserResult {
  const text = input.text ?? (input.buffer ? input.buffer.toString('utf8') : '')
  if (!text.trim()) {
    throw new Error('codex-cli parser 输入为空')
  }
  let cfg: CodexConfigToml
  try {
    cfg = parseToml(text) as unknown as CodexConfigToml
  } catch (err) {
    throw new Error(`~/.codex/config.toml 解析失败: ${(err as Error).message}`)
  }

  // auth.json 可选
  let auth: CodexAuthJson = {}
  const authJsonText = input.extra?.authJsonText
  if (typeof authJsonText === 'string' && authJsonText.trim()) {
    try {
      auth = JSON.parse(authJsonText) as CodexAuthJson
    } catch (err) {
      // 不阻断,标 warning
      return {
        providers: [],
        globalWarnings: [`auth.json 解析失败: ${(err as Error).message}`],
      }
    }
  }

  const modelProviders = cfg.model_providers ?? cfg.modelProviders ?? {}
  const providerKeys = Object.keys(modelProviders)
  if (providerKeys.length === 0) {
    return {
      providers: [],
      globalWarnings: ['config.toml 中未定义任何 [model_providers.*]'],
    }
  }

  const defaultModel = cfg.model
  const defaultProviderKey = cfg.model_provider ?? cfg.modelProvider

  const globalWarnings: string[] = []
  if (!authJsonText) {
    globalWarnings.push('未提供 auth.json,所有 provider 的 apiKey 将为空')
  }

  const providers: ImportedProvider[] = []
  for (const key of providerKeys) {
    const p = modelProviders[key]
    if (!p) continue
    const baseUrl = p.base_url ?? p.baseUrl ?? ''
    const wireApi = p.wire_api ?? p.wireApi
    const apiFormat = pickApiFormat(wireApi)
    const envKey = p.env_key ?? p.envKey ?? `${key.toUpperCase()}_API_KEY`
    const apiKey = auth[envKey]
    const model = defaultModel
    const rawName = sanitizeProviderName(p.name ?? key)
    const providerCode = inferProviderCode(baseUrl, apiFormat, model)
    const warnings: string[] = []
    if (!apiKey) {
      warnings.push(`auth.json 中未找到 ${envKey}`)
    }
    const isCurrent = defaultProviderKey ? defaultProviderKey === key : providerKeys.length === 1
    const provider: ImportedProvider = {
      sourceId: `codex-cli::${key}`,
      sourceAppType: 'codex',
      name: rawName,
      providerCode,
      baseUrl,
      apiKey,
      apiFormat,
      modelIdForTest: model,
      meta: {
        category: 'Codex',
        models: model ? [model] : undefined,
        protocol: wireApi === 'chat' ? 'chatCompletions' : 'responses',
      },
      isCurrent,
      warnings,
    }
    providers.push(normalizeProvider(provider))
  }

  return {
    providers,
    globalWarnings,
  }
}
