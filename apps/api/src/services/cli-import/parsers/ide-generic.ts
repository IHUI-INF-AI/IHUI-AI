/**
 * 通用 IDE / AI 工具配置 parser(工厂模式)
 *
 * 13 个平台共享同一解析逻辑,仅 key 前缀和默认值不同:
 *   trae / trae-work / qoder / qoder-work
 *   codex-desktop / claude-code-desktop
 *   github-copilot / amazon-q / continue / tabnine / cody / zed
 *   antigravity (Google)
 *
 * 每个平台的 URL / 协议 / 默认值经深度分析确定,不可搞混:
 *   - Google Antigravity → gemini_native → generativelanguage.googleapis.com
 *   - Claude Code Desktop → anthropic_messages → api.anthropic.com
 *   - Codex Desktop → openai_chat → api.openai.com/v1
 *   - GitHub Copilot → openai_chat → api.githubcopilot.com
 *   - 其他 IDE(trae/qoder/zed 等)→ 从配置提取,无默认值,缺失则 warning
 *
 * 配置格式:JSON settings.json,扁平 dotted key 或嵌套 JSON
 */
import type { CliApiFormat, ImportedProvider } from '@ihui/types'

import { inferProviderCode, normalizeProvider, sanitizeProviderName } from '../mapper.js'
import type { ParserInput, ParserResult } from './types.js'

interface IdeConfig {
  prefix: string
  name: string
  websiteUrl: string
  /** 默认 baseUrl,仅对有确定 API 端点的平台设置 */
  defaultBaseUrl?: string
  /** 默认 providerCode,仅对有确定厂商的平台设置 */
  defaultProviderCode?: string
  /** 默认 API 协议格式 */
  defaultApiFormat?: CliApiFormat
}

const CONFIGS: Record<string, IdeConfig> = {
  // ── IDE 类(从配置提取,无固定默认值)──
  'trae': { prefix: 'trae.ai', name: 'Trae', websiteUrl: 'https://trae.ai', defaultApiFormat: 'openai_chat' },
  'trae-work': { prefix: 'trae.work.ai', name: 'Trae Work', websiteUrl: 'https://trae.ai', defaultApiFormat: 'openai_chat' },
  'qoder': { prefix: 'qoder.ai', name: 'Qoder', websiteUrl: 'https://qoder.com', defaultApiFormat: 'openai_chat' },
  'qoder-work': { prefix: 'qoder.work.ai', name: 'Qoder Work', websiteUrl: 'https://qoder.com', defaultApiFormat: 'openai_chat' },
  'continue': { prefix: 'continue', name: 'Continue', websiteUrl: 'https://continue.dev', defaultApiFormat: 'openai_chat' },
  'tabnine': { prefix: 'tabnine', name: 'Tabnine', websiteUrl: 'https://tabnine.com', defaultApiFormat: 'openai_chat' },
  'zed': { prefix: 'zed', name: 'Zed', websiteUrl: 'https://zed.dev', defaultApiFormat: 'openai_chat' },

  // ── 桌面端(有确定 API 端点)──
  'codex-desktop': {
    prefix: 'codex', name: 'Codex Desktop', websiteUrl: 'https://openai.com',
    defaultBaseUrl: 'https://api.openai.com/v1', defaultProviderCode: 'openai', defaultApiFormat: 'openai_chat',
  },
  'claude-code-desktop': {
    prefix: 'claude', name: 'Claude Code Desktop', websiteUrl: 'https://claude.ai',
    defaultBaseUrl: 'https://api.anthropic.com', defaultProviderCode: 'anthropic', defaultApiFormat: 'anthropic_messages',
  },

  // ── 平台扩展(有确定 API 端点)──
  'github-copilot': {
    prefix: 'github.copilot', name: 'GitHub Copilot', websiteUrl: 'https://github.com/features/copilot',
    defaultBaseUrl: 'https://api.githubcopilot.com', defaultProviderCode: 'openai', defaultApiFormat: 'openai_chat',
  },
  'amazon-q': {
    prefix: 'amazon.q', name: 'Amazon Q', websiteUrl: 'https://aws.amazon.com/q',
    defaultApiFormat: 'openai_chat',
  },
  'cody': {
    prefix: 'cody', name: 'Sourcegraph Cody', websiteUrl: 'https://sourcegraph.com/cody',
    defaultApiFormat: 'openai_chat',
  },

  // ── Google Antigravity(Gemini 系列)──
  'antigravity': {
    prefix: 'antigravity', name: 'Google Antigravity', websiteUrl: 'https://antigravity.google',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultProviderCode: 'google', defaultApiFormat: 'gemini_native',
  },
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined
}

function inferApiFormat(baseUrl: string, model?: string, fallback?: CliApiFormat): CliApiFormat {
  const u = baseUrl.toLowerCase()
  if (u.includes('anthropic.com') || model?.startsWith('claude-')) return 'anthropic_messages'
  if (u.includes('googleapis.com') || u.includes('generativelanguage') || model?.startsWith('gemini-')) return 'gemini_native'
  if (u.includes('openai.com') || u.includes('githubcopilot')) return 'openai_chat'
  return fallback ?? 'openai_chat'
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
    const baseUrl = extract(settings, cfg.prefix, 'baseUrl') ?? extract(settings, cfg.prefix, 'base_url') ?? cfg.defaultBaseUrl
    const model = extract(settings, cfg.prefix, 'model')

    if (!apiKey) {
      return {
        providers: [],
        globalWarnings: [`${cfg.name} 配置中未找到 ${cfg.prefix}.apiKey`],
      }
    }
    if (!baseUrl) {
      return {
        providers: [],
        globalWarnings: [`${cfg.name} 配置中未找到 ${cfg.prefix}.baseUrl,且该平台无默认值`],
      }
    }

    const apiFormat = inferApiFormat(baseUrl, model, cfg.defaultApiFormat)
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
export const parseAntigravity = createIdeParser('antigravity')
