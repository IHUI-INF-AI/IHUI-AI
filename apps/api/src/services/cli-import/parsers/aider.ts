/**
 * Aider AI 配置 parser
 *
 * 配置文件:`~/.aider.conf.yml` 或 `.aider.conf.yml`(YAML 格式)
 *
 * YAML 结构(简单行解析,不引入 js-yaml):
 *   model: gpt-4
 *   openai-api-key: sk-...
 *   openai-api-base: https://api.openai.com/v1
 *   anthropic-api-key: sk-ant-...
 *   anthropic-api-base: https://api.anthropic.com
 *
 * 同时支持 OpenAI 和 Anthropic 两个 provider;model 字段决定哪个为 current。
 */
import type { CliApiFormat, ImportedProvider } from '@ihui/types'

import { inferProviderCode, normalizeProvider, sanitizeProviderName } from '../mapper.js'
import type { ParserInput, ParserResult } from './types.js'

function parseYamlSimple(text: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const colon = trimmed.indexOf(':')
    if (colon <= 0) continue
    const key = trimmed.slice(0, colon).trim()
    let value = trimmed.slice(colon + 1).trim()
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

export async function parseAider(input: ParserInput): Promise<ParserResult> {
  const text = input.text ?? (input.buffer ? input.buffer.toString('utf8') : '')
  if (!text.trim()) {
    throw new Error('aider parser 输入为空')
  }
  const cfg = parseYamlSimple(text)
  const defaultModel = cfg.model
  const globalWarnings: string[] = []
  const providers: ImportedProvider[] = []

  // OpenAI provider
  const openaiKey = cfg['openai-api-key']
  if (openaiKey) {
    const baseUrl = cfg['openai-api-base'] ?? 'https://api.openai.com/v1'
    const model = defaultModel?.startsWith('gpt-') ? defaultModel : undefined
    const apiFormat: CliApiFormat = 'openai_chat'
    providers.push(
      normalizeProvider({
        sourceId: 'aider::openai',
        name: sanitizeProviderName('Aider OpenAI'),
        providerCode: inferProviderCode(baseUrl, apiFormat, model),
        baseUrl,
        apiKey: openaiKey,
        apiFormat,
        modelIdForTest: model,
        meta: { category: 'Aider', websiteUrl: 'https://aider.chat', models: model ? [model] : undefined },
        isCurrent: false,
        warnings: [],
      }),
    )
  }

  // Anthropic provider
  const anthropicKey = cfg['anthropic-api-key']
  if (anthropicKey) {
    const baseUrl = cfg['anthropic-api-base'] ?? 'https://api.anthropic.com'
    const model = defaultModel?.startsWith('claude-') ? defaultModel : undefined
    const apiFormat: CliApiFormat = 'anthropic_messages'
    providers.push(
      normalizeProvider({
        sourceId: 'aider::anthropic',
        name: sanitizeProviderName('Aider Anthropic'),
        providerCode: inferProviderCode(baseUrl, apiFormat, model),
        baseUrl,
        apiKey: anthropicKey,
        apiFormat,
        modelIdForTest: model,
        meta: { category: 'Aider', websiteUrl: 'https://aider.chat', models: model ? [model] : undefined },
        isCurrent: false,
        warnings: [],
      }),
    )
  }

  // 根据 defaultModel 前缀设置 isCurrent
  if (providers.length > 0) {
    const targetId = defaultModel?.startsWith('claude-') ? 'aider::anthropic' : 'aider::openai'
    const idx = Math.max(0, providers.findIndex((p) => p.sourceId === targetId))
    const target = providers[idx]
    if (target) {
      providers[idx] = { ...target, isCurrent: true }
    }
  }

  if (providers.length === 0) {
    globalWarnings.push('aider 配置中未找到 openai-api-key 或 anthropic-api-key')
  }

  return { providers, globalWarnings }
}
