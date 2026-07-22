/**
 * .env 通用环境变量 parser
 *
 * 解析标准 .env 文件,识别常见 AI 厂商环境变量并生成多个 provider。
 *
 * 支持的变量前缀(别名用数组表示,取第一个匹配):
 *   OPENAI / ANTHROPIC / GEMINI+GOOGLE / AZURE_OPENAI / DEEPSEEK /
 *   MOONSHOT / ZHIPU+GLM / BAIDU+QIANFAN
 *   以及任意 <PREFIX>_API_KEY + <PREFIX>_BASE_URL 自定义组合
 *
 * .env 格式:KEY=value / KEY="value" / export KEY=value / # 注释 / 空行
 */
import type { CliApiFormat, ImportedProvider } from '@ihui/types'

import { inferProviderCode, normalizeProvider, sanitizeProviderName } from '../mapper.js'
import type { ParserInput, ParserResult } from './types.js'

interface ProviderSpec {
  prefixes: string[]
  providerCode: string
  apiFormat: CliApiFormat
  defaultBaseUrl: string
  displayName: string
  category: string
  websiteUrl: string
}

const PROVIDER_SPECS: ProviderSpec[] = [
  { prefixes: ['OPENAI'], providerCode: 'openai', apiFormat: 'openai_chat', defaultBaseUrl: 'https://api.openai.com/v1', displayName: 'OpenAI', category: 'OpenAI', websiteUrl: 'https://openai.com' },
  { prefixes: ['ANTHROPIC'], providerCode: 'anthropic', apiFormat: 'anthropic_messages', defaultBaseUrl: 'https://api.anthropic.com', displayName: 'Anthropic', category: 'Anthropic', websiteUrl: 'https://anthropic.com' },
  { prefixes: ['GEMINI', 'GOOGLE'], providerCode: 'google', apiFormat: 'gemini_native', defaultBaseUrl: 'https://generativelanguage.googleapis.com', displayName: 'Google', category: 'Google', websiteUrl: 'https://ai.google.dev' },
  { prefixes: ['AZURE_OPENAI'], providerCode: 'azure', apiFormat: 'openai_chat', defaultBaseUrl: '', displayName: 'Azure OpenAI', category: 'Azure', websiteUrl: 'https://azure.microsoft.com' },
  { prefixes: ['DEEPSEEK'], providerCode: 'deepseek', apiFormat: 'openai_chat', defaultBaseUrl: 'https://api.deepseek.com', displayName: 'DeepSeek', category: 'DeepSeek', websiteUrl: 'https://deepseek.com' },
  { prefixes: ['MOONSHOT'], providerCode: 'moonshot', apiFormat: 'openai_chat', defaultBaseUrl: 'https://api.moonshot.cn/v1', displayName: 'Moonshot', category: 'Moonshot', websiteUrl: 'https://moonshot.cn' },
  { prefixes: ['ZHIPU', 'GLM'], providerCode: 'zhipu', apiFormat: 'openai_chat', defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4', displayName: 'Zhipu AI', category: 'Zhipu', websiteUrl: 'https://zhipuai.cn' },
  { prefixes: ['BAIDU', 'QIANFAN'], providerCode: 'baidu', apiFormat: 'openai_chat', defaultBaseUrl: 'https://qianfan.baidubce.com/v2', displayName: 'Baidu', category: 'Baidu', websiteUrl: 'https://cloud.baidu.com' },
]

function parseEnv(text: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    let trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    if (trimmed.startsWith('export ')) trimmed = trimmed.slice(7).trim()
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
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

function pickByPrefixes(env: Record<string, string>, prefixes: string[], suffix: string): string | undefined {
  for (const p of prefixes) {
    const v = env[`${p}_${suffix}`]
    if (v) return v
  }
  return undefined
}

export async function parseEnvFile(input: ParserInput): Promise<ParserResult> {
  const text = input.text ?? (input.buffer ? input.buffer.toString('utf8') : '')
  if (!text.trim()) {
    throw new Error('env-file parser 输入为空')
  }
  const env = parseEnv(text)
  const globalWarnings: string[] = []
  const providers: ImportedProvider[] = []
  const knownPrefixes = new Set(PROVIDER_SPECS.flatMap((s) => s.prefixes))

  // 已知厂商
  for (const spec of PROVIDER_SPECS) {
    const apiKey = pickByPrefixes(env, spec.prefixes, 'API_KEY')
    if (!apiKey) continue
    const matchedPrefix = spec.prefixes.find((p) => env[`${p}_API_KEY`]) ?? spec.prefixes[0]
    if (!matchedPrefix) continue
    const baseUrl = pickByPrefixes(env, spec.prefixes, 'BASE_URL') ?? spec.defaultBaseUrl
    const model = pickByPrefixes(env, spec.prefixes, 'MODEL') ?? pickByPrefixes(env, spec.prefixes, 'MODEL_ID')
    const warnings: string[] = []
    if (!baseUrl) warnings.push(`${matchedPrefix}_BASE_URL 未设置且无默认值`)
    providers.push(
      normalizeProvider({
        sourceId: `env::${matchedPrefix.toLowerCase()}`,
        name: sanitizeProviderName(spec.displayName),
        providerCode: spec.providerCode,
        baseUrl,
        apiKey,
        apiFormat: spec.apiFormat,
        modelIdForTest: model,
        meta: { category: spec.category, websiteUrl: spec.websiteUrl, models: model ? [model] : undefined },
        isCurrent: providers.length === 0,
        warnings,
      }),
    )
  }

  // 自定义前缀:需同时有 _API_KEY 和 _BASE_URL
  for (const key of Object.keys(env)) {
    const m = key.match(/^(.+)_API_KEY$/)
    if (!m) continue
    const prefix = m[1]
    if (!prefix || knownPrefixes.has(prefix)) continue
    const apiKey = env[key]
    if (!apiKey) continue
    const baseUrl = env[`${prefix}_BASE_URL`]
    if (!baseUrl) continue
    const model = env[`${prefix}_MODEL`] ?? env[`${prefix}_MODEL_ID`]
    const displayName = prefix.charAt(0) + prefix.slice(1).toLowerCase()
    providers.push(
      normalizeProvider({
        sourceId: `env::${prefix.toLowerCase()}`,
        name: sanitizeProviderName(displayName),
        providerCode: inferProviderCode(baseUrl, 'openai_chat', model),
        baseUrl,
        apiKey,
        apiFormat: 'openai_chat',
        modelIdForTest: model,
        meta: { category: 'Custom', models: model ? [model] : undefined },
        isCurrent: providers.length === 0,
        warnings: [],
      }),
    )
  }

  if (providers.length === 0) {
    globalWarnings.push('.env 文件中未识别到任何 *_API_KEY 变量')
  }

  return { providers, globalWarnings }
}
