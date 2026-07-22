/**
 * Cursor IDE 配置 parser
 *
 * 配置文件:
 *   - ~/.cursor/settings.json 或 %APPDATA%/Cursor/User/settings.json
 *   - ~/.cursor/cache/models.json(可选)
 *
 * settings.json 中的 AI 配置(扁平 dotted key):
 *   {
 *     "cursor.ai.model": "gpt-4",
 *     "cursor.ai.apiKey": "sk-...",
 *     "cursor.ai.baseUrl": "https://api.openai.com/v1"
 *   }
 *
 * providerCode 根据 baseUrl / model 推断;apiFormat 根据 baseUrl / model 前缀推断。
 */
import type { CliApiFormat, ImportedProvider } from '@ihui/types'

import { inferProviderCode, normalizeProvider, sanitizeProviderName } from '../mapper.js'
import type { ParserInput, ParserResult } from './types.js'

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined
}

function inferApiFormat(baseUrl: string, model?: string): CliApiFormat {
  const u = baseUrl.toLowerCase()
  if (u.includes('anthropic.com') || model?.startsWith('claude-')) return 'anthropic_messages'
  if (u.includes('googleapis.com') || model?.startsWith('gemini-')) return 'gemini_native'
  return 'openai_chat'
}

export async function parseCursor(input: ParserInput): Promise<ParserResult> {
  const text = input.text ?? (input.buffer ? input.buffer.toString('utf8') : '')
  if (!text.trim()) {
    throw new Error('cursor parser 输入为空')
  }
  let settings: Record<string, unknown>
  try {
    settings = JSON.parse(text) as Record<string, unknown>
  } catch (err) {
    throw new Error(`Cursor settings.json 解析失败: ${(err as Error).message}`)
  }
  const apiKey = str(settings['cursor.ai.apiKey'])
  const baseUrl = str(settings['cursor.ai.baseUrl']) ?? 'https://api.openai.com/v1'
  const model = str(settings['cursor.ai.model'])
  if (!apiKey) {
    return {
      providers: [],
      globalWarnings: ['Cursor settings.json 中未找到 cursor.ai.apiKey'],
    }
  }
  const apiFormat = inferApiFormat(baseUrl, model)
  const provider: ImportedProvider = {
    sourceId: 'cursor-default',
    name: sanitizeProviderName('Cursor'),
    providerCode: inferProviderCode(baseUrl, apiFormat, model),
    baseUrl,
    apiKey,
    apiFormat,
    modelIdForTest: model,
    meta: {
      category: 'Cursor',
      websiteUrl: 'https://cursor.sh',
      models: model ? [model] : undefined,
    },
    isCurrent: true,
    warnings: [],
  }
  return {
    providers: [normalizeProvider(provider)],
    globalWarnings: [],
  }
}
