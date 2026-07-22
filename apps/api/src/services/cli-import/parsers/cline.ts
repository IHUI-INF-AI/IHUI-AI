/**
 * Cline (VSCode 扩展) 配置 parser
 *
 * 配置来源(仅解析 text 格式 settings.json,不解析 SQLite state.vscdb):
 *   - VSCode settings.json 中的 cline.* 字段
 *
 * settings.json 格式(扁平 dotted key):
 *   {
 *     "cline.apiProvider": "openai" | "anthropic" | "gemini" | ...,
 *     "cline.apiKey": "sk-...",
 *     "cline.openAiBaseUrl": "https://api.openai.com/v1",
 *     "cline.openAiModelId": "gpt-4"
 *   }
 *
 * apiFormat 根据 cline.apiProvider 映射;providerCode 根据 baseUrl / model 推断。
 */
import type { CliApiFormat, ImportedProvider } from '@ihui/types'

import { inferProviderCode, normalizeProvider, sanitizeProviderName } from '../mapper.js'
import type { ParserInput, ParserResult } from './types.js'

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined
}

function pickApiFormat(apiProvider?: string): CliApiFormat {
  if (!apiProvider) return 'openai_chat'
  const r = apiProvider.toLowerCase()
  if (r === 'anthropic') return 'anthropic_messages'
  if (r === 'gemini' || r === 'google') return 'gemini_native'
  return 'openai_chat'
}

export async function parseCline(input: ParserInput): Promise<ParserResult> {
  const text = input.text ?? (input.buffer ? input.buffer.toString('utf8') : '')
  if (!text.trim()) {
    throw new Error('cline parser 输入为空')
  }
  let settings: Record<string, unknown>
  try {
    settings = JSON.parse(text) as Record<string, unknown>
  } catch (err) {
    throw new Error(`Cline settings.json 解析失败: ${(err as Error).message}`)
  }
  const apiProvider = str(settings['cline.apiProvider'])
  const apiKey = str(settings['cline.apiKey'])
  const baseUrl = str(settings['cline.openAiBaseUrl']) ?? ''
  const model = str(settings['cline.openAiModelId'])
  if (!apiKey) {
    return {
      providers: [],
      globalWarnings: ['Cline settings.json 中未找到 cline.apiKey'],
    }
  }
  const apiFormat = pickApiFormat(apiProvider)
  const warnings: string[] = []
  if (!baseUrl) warnings.push('cline.openAiBaseUrl 未设置')
  const provider: ImportedProvider = {
    sourceId: 'cline-default',
    name: sanitizeProviderName('Cline'),
    providerCode: inferProviderCode(baseUrl, apiFormat, model),
    baseUrl,
    apiKey,
    apiFormat,
    modelIdForTest: model,
    meta: {
      category: 'Cline',
      websiteUrl: 'https://cline.bot',
      models: model ? [model] : undefined,
    },
    isCurrent: true,
    warnings,
  }
  return {
    providers: [normalizeProvider(provider)],
    globalWarnings: [],
  }
}
