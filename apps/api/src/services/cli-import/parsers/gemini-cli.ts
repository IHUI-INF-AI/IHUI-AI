/**
 * Gemini CLI parser
 *
 * 配置:
 * - `~/.gemini/.env`(KEY=VALUE 格式)
 * - `~/.gemini/settings.json`(JSON,可选)
 *
 * .env 关键字段:
 *   GEMINI_API_KEY=...
 *   GOOGLE_API_KEY=...
 *   GOOGLE_GENAI_USE_VERTEXAI=true|false
 *   GOOGLE_CLOUD_PROJECT=...
 *   GOOGLE_CLOUD_LOCATION=...
 *
 * settings.json:
 *   { "model": "gemini-2.0-flash", "selectedAuthType": "GEMINI_API_KEY" | "VERTEX_AI" | "USE_GEMINI" }
 *
 * 调用约定:
 *   input.text = .env 文件内容
 *   input.extra.settingsJsonText = settings.json 内容(可选)
 *
 * 导出为单一 provider(sourceId 固定为 "gemini-cli-default")。
 * apiFormat 固定 'gemini_native'。
 * 若使用 Vertex AI,baseUrl 指向 https://us-central1-aiplatform.googleapis.com
 */
import type { CliApiFormat, ImportedProvider } from '@ihui/types'

import { inferProviderCode, normalizeProvider, sanitizeProviderName } from '../mapper.js'
import type { ParserInput, ParserResult } from './types.js'

interface GeminiSettings {
  model?: string
  selectedAuthType?: string
}

const SOURCE_ID = 'gemini-cli-default'

function parseEnv(text: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    // 去引号
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

export function parseGeminiCli(input: ParserInput): ParserResult {
  const text = input.text ?? (input.buffer ? input.buffer.toString('utf8') : '')
  if (!text.trim()) {
    throw new Error('gemini-cli parser 输入为空')
  }
  const env = parseEnv(text)
  let settings: GeminiSettings = {}
  const settingsJsonText = input.extra?.settingsJsonText
  if (typeof settingsJsonText === 'string' && settingsJsonText.trim()) {
    try {
      settings = JSON.parse(settingsJsonText) as GeminiSettings
    } catch {
      /* 不阻断,settings 可选 */
    }
  }

  const useVertex = env.GOOGLE_GENAI_USE_VERTEXAI === 'true'
  const apiKey = env.GEMINI_API_KEY ?? env.GOOGLE_API_KEY
  const project = env.GOOGLE_CLOUD_PROJECT
  const location = env.GOOGLE_CLOUD_LOCATION ?? 'us-central1'
  const baseUrl = useVertex
    ? `https://${location}-aiplatform.googleapis.com`
    : 'https://generativelanguage.googleapis.com'
  const model = settings.model
  const apiFormat: CliApiFormat = 'gemini_native'
  const providerCode = inferProviderCode(baseUrl, apiFormat, model)
  const warnings: string[] = []
  if (useVertex && !project) {
    warnings.push('Vertex AI 模式但未设置 GOOGLE_CLOUD_PROJECT')
  }
  if (!apiKey && !useVertex) {
    warnings.push('未找到 GEMINI_API_KEY / GOOGLE_API_KEY')
  }

  const provider: ImportedProvider = {
    sourceId: SOURCE_ID,
    sourceAppType: 'gemini',
    name: sanitizeProviderName('Gemini CLI'),
    providerCode,
    baseUrl,
    apiKey,
    apiFormat,
    modelIdForTest: model,
    meta: {
      category: 'Google',
      websiteUrl: 'https://ai.google.dev',
      models: model ? [model] : undefined,
    },
    isCurrent: true,
    warnings,
  }

  return {
    providers: [normalizeProvider(provider)],
    globalWarnings: warnings.length > 0 ? ['Gemini CLI 配置存在警告,详见 provider.warnings'] : [],
  }
}
