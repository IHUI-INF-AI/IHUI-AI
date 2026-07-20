/**
 * Claude Code CLI settings parser
 *
 * 配置:`~/.claude/settings.json`
 *
 * 结构(关键 env 字段):
 * {
 *   "env": {
 *     "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
 *     "ANTHROPIC_AUTH_TOKEN": "sk-ant-...",
 *     "ANTHROPIC_API_KEY": "sk-ant-...",
 *     "ANTHROPIC_MODEL": "claude-sonnet-4-5",
 *     "ANTHROPIC_SMALL_FAST_MODEL": "claude-3-5-haiku-..."
 *   },
 *   "model": "claude-sonnet-4-5",
 *   "provider": "anthropic",
 *   "mcpServers": { ... }   // 可选
 * }
 *
 * 导出为单一 provider(sourceId 固定为 "claude-cli-default")。
 * apiKey 优先 ANTHROPIC_AUTH_TOKEN,fallback ANTHROPIC_API_KEY。
 * apiFormat 固定 'anthropic_messages'。
 */
import type { CliApiFormat, ImportedMcpServer, ImportedProvider } from '@ihui/types'

import { inferProviderCode, normalizeProvider, sanitizeProviderName } from '../mapper.js'
import type { ParserInput, ParserResult } from './types.js'

interface ClaudeSettings {
  env?: Record<string, string>
  model?: string
  provider?: string
  mcpServers?: Record<string, unknown>
}

const SOURCE_ID = 'claude-cli-default'

export function parseClaudeCli(input: ParserInput): ParserResult {
  const text = input.text ?? (input.buffer ? input.buffer.toString('utf8') : '')
  if (!text.trim()) {
    throw new Error('claude-cli parser 输入为空')
  }
  let s: ClaudeSettings
  try {
    s = JSON.parse(text) as ClaudeSettings
  } catch (err) {
    throw new Error(`~/.claude/settings.json 解析失败: ${(err as Error).message}`)
  }
  const env = s.env ?? {}
  const baseUrl = env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com'
  const apiKey = env.ANTHROPIC_AUTH_TOKEN ?? env.ANTHROPIC_API_KEY
  const model = env.ANTHROPIC_MODEL ?? s.model
  const apiFormat: CliApiFormat = 'anthropic_messages'
  const providerCode = inferProviderCode(baseUrl, apiFormat, model)
  const warnings: string[] = []
  if (!apiKey) warnings.push('未找到 ANTHROPIC_AUTH_TOKEN / ANTHROPIC_API_KEY')

  const provider: ImportedProvider = {
    sourceId: SOURCE_ID,
    sourceAppType: 'claude',
    name: sanitizeProviderName('Claude Code CLI'),
    providerCode,
    baseUrl,
    apiKey,
    apiFormat,
    modelIdForTest: model,
    meta: {
      category: 'Claude',
      websiteUrl: 'https://claude.ai',
      models: model ? [model] : undefined,
    },
    isCurrent: true,
    warnings,
  }

  const mcpServers: ImportedMcpServer[] = []
  if (s.mcpServers && typeof s.mcpServers === 'object') {
    for (const [name, cfg] of Object.entries(s.mcpServers)) {
      mcpServers.push({
        sourceId: `${SOURCE_ID}::mcp::${name}`,
        name,
        serverConfig: cfg as Record<string, unknown>,
        enabledApps: ['claude'],
      })
    }
  }

  return {
    providers: [normalizeProvider(provider)],
    mcpServers: mcpServers.length > 0 ? mcpServers : undefined,
    globalWarnings: warnings.length > 0 ? ['Claude CLI 配置存在警告,详见 provider.warnings'] : [],
  }
}
