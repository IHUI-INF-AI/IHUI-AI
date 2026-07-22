/**
 * Windsurf (Codeium) IDE 配置 parser
 *
 * 配置文件:
 *   - ~/.codeium/windsurf/settings.json
 *   - %APPDATA%/Windsurf/User/settings.json
 *
 * settings.json 中的 AI 配置(扁平 dotted key):
 *   {
 *     "windsurf.ai.model": "claude-3-opus",
 *     "windsurf.ai.apiKey": "sk-...",
 *     "windsurf.ai.baseUrl": "https://api.anthropic.com"
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
  if (u.includes('googleapis.com') || u.includes('generativelanguage') || model?.startsWith('gemini-')) return 'gemini_native'
  if (u.includes('openai.com') || u.includes('githubcopilot')) return 'openai_chat'
  return 'openai_chat'
}

export async function parseWindsurf(input: ParserInput): Promise<ParserResult> {
  const text = input.text ?? (input.buffer ? input.buffer.toString('utf8') : '')
  if (!text.trim()) {
    throw new Error('windsurf parser 输入为空')
  }
  let settings: Record<string, unknown>
  try {
    settings = JSON.parse(text) as Record<string, unknown>
  } catch (err) {
    throw new Error(`Windsurf settings.json 解析失败: ${(err as Error).message}`)
  }
  const apiKey = str(settings['windsurf.ai.apiKey'])
  const baseUrl = str(settings['windsurf.ai.baseUrl'])
  const model = str(settings['windsurf.ai.model'])
  if (!apiKey) {
    return {
      providers: [],
      globalWarnings: ['Windsurf settings.json 中未找到 windsurf.ai.apiKey'],
    }
  }
  if (!baseUrl) {
    return {
      providers: [],
      globalWarnings: ['Windsurf settings.json 中未找到 windsurf.ai.baseUrl,Windsurf 无默认 API 端点'],
    }
  }
  const apiFormat = inferApiFormat(baseUrl, model)
  const provider: ImportedProvider = {
    sourceId: 'windsurf-default',
    name: sanitizeProviderName('Windsurf'),
    providerCode: inferProviderCode(baseUrl, apiFormat, model),
    baseUrl,
    apiKey,
    apiFormat,
    modelIdForTest: model,
    meta: {
      category: 'Windsurf',
      websiteUrl: 'https://codeium.com',
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
