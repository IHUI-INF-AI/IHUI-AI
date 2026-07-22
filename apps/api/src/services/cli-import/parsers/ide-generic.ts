/**
 * 通用 IDE / AI 工具配置 parser(工厂模式)
 *
 * 12 个平台共享同一解析逻辑,仅 key 前缀和默认值不同:
 *   trae / trae-work / qoder / qoder-work
 *   codex-desktop / claude-code-desktop
 *   github-copilot / amazon-q / continue / tabnine / cody / zed
 *
 * 配置格式:JSON settings.json,扁平 dotted key
 *   { "<prefix>.apiKey": "sk-...", "<prefix>.baseUrl": "...", "<prefix>.model": "..." }
 *   也支持嵌套 JSON: { "<prefix>": { "apiKey": "...", "baseUrl": "..." } }
 */
import type { CliApiFormat, ImportedProvider } from '@ihui/types'

import { inferProviderCode, normalizeProvider, sanitizeProviderName } from '../mapper.js'
import type { ParserInput, ParserResult } from './types.js'

interface IdeConfig {
  prefix: string
  name: string
  websiteUrl: string
  defaultBaseUrl?: string
  defaultProviderCode?: string
}

const CONFIGS: Record<string, IdeConfig> = {
  'trae': { prefix: 'trae.ai', name: 'Trae', websiteUrl: 'https://trae.ai' },
  'trae-work': { prefix: 'trae.work.ai', name: 'Trae Work', websiteUrl: 'https://trae.ai' },
  'qoder': { prefix: 'qoder.ai', name: 'Qoder', websiteUrl: 'https://qoder.com' },
  'qoder-work': { prefix: 'qoder.work.ai', name: 'Qoder Work', websiteUrl: 'https://qoder.com' },
  'codex-desktop': { prefix: 'codex', name: 'Codex Desktop', websiteUrl: 'https://openai.com', defaultBaseUrl: 'https://api.openai.com/v1', defaultProviderCode: 'openai' },
  'claude-code-desktop': { prefix: 'claude', name: 'Claude Code Desktop', websiteUrl: 'https://claude.ai', defaultBaseUrl: 'https://api.anthropic.com', defaultProviderCode: 'anthropic' },
  'github-copilot': { prefix: 'github.copilot', name: 'GitHub Copilot', websiteUrl: 'https://github.com/features/copilot', defaultBaseUrl: 'https://api.githubcopilot.com', defaultProviderCode: 'openai' },
  'amazon-q': { prefix: 'amazon.q', name: 'Amazon Q', websiteUrl: 'https://aws.amazon.com/q', defaultProviderCode: 'amazon' },
  'continue': { prefix: 'continue', name: 'Continue', websiteUrl: 'https://continue.dev' },
  'tabnine': { prefix: 'tabnine', name: 'Tabnine', websiteUrl: 'https://tabnine.com' },
  'cody': { prefix: 'cody', name: 'Sourcegraph Cody', websiteUrl: 'https://sourcegraph.com/cody', defaultProviderCode: 'sourcegraph' },
  'zed': { prefix: 'zed', name: 'Zed', websiteUrl: 'https://zed.dev' },
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined
}

function inferApiFormat(baseUrl: string, model?: string): CliApiFormat {
  const u = baseUrl.toLowerCase()
  if (u.includes('anthropic.com') || model?.startsWith('claude-')) return 'anthropic_messages'
  if (u.includes('googleapis.com') || model?.startsWith('gemini-')) return 'gemini_native'
  return 'openai_chat'
}

/** 从扁平 dotted-key JSON 或嵌套 JSON 中提取值 */
function extract(settings: Record<string, unknown>, prefix: string, field: string): string | undefined {
  const flatKey = `${prefix}.${field}`
  const camelKey = `${prefix}.${field.charAt(0).toUpperCase()}${field.slice(1)}`
  const kebabKey = `${prefix}.${field.replace(/([A-Z])/g, '-$1').toLowerCase()}`
  const flat = str(settings[flatKey]) ?? str(settings[camelKey]) ?? str(settings[kebabKey])
  if (flat) return flat
  const nested = settings[prefix]
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const obj = nested as Record<string, unknown>
    return str(obj[field]) ?? str(obj[field.charAt(0).toUpperCase() + field.slice(1)])
  }
  return undefined
}

function createIdeParser(sourceKey: string) {
  return async function parseIde(input: ParserInput): Promise<ParserResult> {
    const cfg = CONFIGS[sourceKey]
    if (!cfg) throw new Error(`Unknown IDE source: ${sourceKey}`)
    const text = input.text ?? (input.buffer ? input.buffer.toString('utf8') : '')
    if (!text.trim()) {
      throw new Error(`${cfg.name} parser 输入为空`)
    }
    let settings: Record<string, unknown>
    try {
      settings = JSON.parse(text) as Record<string, unknown>
    } catch (err) {
      throw new Error(`${cfg.name} JSON 解析失败: ${(err as Error).message}`)
    }

    // 尝试提取 apiKey / baseUrl / model
    const apiKey = extract(settings, cfg.prefix, 'apiKey') ?? extract(settings, cfg.prefix, 'api_key')
    const baseUrl = extract(settings, cfg.prefix, 'baseUrl') ?? extract(settings, cfg.prefix, 'base_url') ?? cfg.defaultBaseUrl ?? 'https://api.openai.com/v1'
    const model = extract(settings, cfg.prefix, 'model')

    if (!apiKey) {
      return {
        providers: [],
        globalWarnings: [`${cfg.name} 配置中未找到 ${cfg.prefix}.apiKey`],
      }
    }

    const apiFormat = inferApiFormat(baseUrl, model)
    const provider: ImportedProvider = {
      sourceId: `${sourceKey}-default`,
      name: sanitizeProviderName(cfg.name),
      providerCode: cfg.defaultProviderCode ?? inferProviderCode(baseUrl, apiFormat, model),
      baseUrl,
      apiKey,
      apiFormat,
      modelIdForTest: model,
      meta: {
        category: cfg.name,
        websiteUrl: cfg.websiteUrl,
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
}

export const parseTrae = createIdeParser('trae')
export const parseTraeWork = createIdeParser('trae-work')
export const parseQoder = createIdeParser('qoder')
export const parseQoderWork = createIdeParser('qoder-work')
export const parseCodexDesktop = createIdeParser('codex-desktop')
export const parseClaudeCodeDesktop = createIdeParser('claude-code-desktop')
export const parseGithubCopilot = createIdeParser('github-copilot')
export const parseAmazonQ = createIdeParser('amazon-q')
export const parseContinue = createIdeParser('continue')
export const parseTabnine = createIdeParser('tabnine')
export const parseCody = createIdeParser('cody')
export const parseZed = createIdeParser('zed')
