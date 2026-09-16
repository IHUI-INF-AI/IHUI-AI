// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/developer/relay/keys/:id/bootstrap — API Key 一键接入配置生成器(2026-09-16 立)。
 *
 * 对标 Sub2API:用户拿到 Key 后,平台为每种主流 CLI/客户端生成即贴可用的接入配置。
 * 端点:GET /developer/relay/keys/:id/bootstrap?client=<client>
 *   - requireAuth 鉴权 + 归属校验(request.userId === developerApiKeys.userId)
 *   - client 枚举:codex | codex-ws | claude-code | opencode | gemini-cli | grok-cli
 *   - 占位用真实 Key 值(developerApiKeys.key 明文字段,与 GET /keys 行为一致)
 *   - BASE_URL = process.env.PUBLIC_API_BASE_URL ?? 'https://aizhs.top'
 *   - 响应:success({ client, keyPrefix, config: [{ title, filePath, language, content }] })
 *   - auth 模式区分 legacy / api-key 的客户端各给两版配置。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { developerApiKeys } from '@ihui/database'
import { success, error } from '../utils/response.js'
import { requireAuth } from '../plugins/require-permission.js'
import { idParamSchema } from './admin/_shared.js'

const clientQuerySchema = z.object({
  client: z.enum(['codex', 'codex-ws', 'claude-code', 'opencode', 'gemini-cli', 'grok-cli']),
})

interface ConfigBlock {
  /** 该配置块标题(如「API Key 模式(推荐)」/「Legacy 兼容模式」) */
  title: string
  /** 配置文件路径说明(如 ~/.codex/config.toml) */
  filePath: string
  /** 代码语言标记(用于前端高亮:bash / toml / json) */
  language: string
  /** 即贴配置文本全文 */
  content: string
}

/** 取真实 Base URL(对外公开 API 网关根地址) */
function resolveBaseUrl(): string {
  return process.env.PUBLIC_API_BASE_URL ?? 'https://aizhs.top'
}

/** 生成单个客户端的即贴配置块数组 */
function buildConfig(client: string, apiKey: string, base: string): ConfigBlock[] {
  const openaiBase = `${base}/v1`
  const anthropicBase = `${base}/v1/anthropic`

  switch (client) {
    case 'codex':
      return [
        {
          title: 'API Key 模式（推荐）',
          filePath: '~/.codex/config.toml',
          language: 'toml',
          content: `[auth]
api_key = "${apiKey}"

[model_providers.openai]
name = "OpenAI"
base_url = "${openaiBase}"
`,
        },
        {
          title: 'Legacy 兼容模式',
          filePath: '~/.bashrc',
          language: 'bash',
          content: `# Legacy 兼容:旧版 Codex 读取 OPENAI_API_BASE
export OPENAI_API_KEY="${apiKey}"
export OPENAI_API_BASE="${openaiBase}"
`,
        },
      ]
    case 'codex-ws':
      return [
        {
          title: 'API Key 模式（推荐，WebSocket 流式）',
          filePath: '~/.bashrc',
          language: 'bash',
          content: `export OPENAI_API_KEY="${apiKey}"
export OPENAI_BASE_URL="${openaiBase}"
# 启用 WebSocket 流式传输(Codex WS 模式)
export CODEX_WS=1
`,
        },
        {
          title: 'Legacy 兼容模式',
          filePath: '~/.bashrc',
          language: 'bash',
          content: `# Legacy 兼容:旧版 Codex 读取 OPENAI_API_BASE
export OPENAI_API_KEY="${apiKey}"
export OPENAI_API_BASE="${openaiBase}"
`,
        },
      ]
    case 'claude-code':
      return [
        {
          title: 'API Key 模式（推荐）',
          filePath: '~/.bashrc',
          language: 'bash',
          content: `export ANTHROPIC_API_KEY="${apiKey}"
export ANTHROPIC_BASE_URL="${anthropicBase}"
`,
        },
        {
          title: 'Legacy 兼容模式',
          filePath: '~/.bashrc',
          language: 'bash',
          content: `# Legacy 兼容:旧版 Claude Code 读取 ANTHROPIC_API_BASE
export ANTHROPIC_API_KEY="${apiKey}"
export ANTHROPIC_API_BASE="${anthropicBase}"
`,
        },
        {
          title: '配置文件（~/.claude.json）',
          filePath: '~/.claude.json',
          language: 'json',
          content: `{
  "env": {
    "ANTHROPIC_BASE_URL": "${anthropicBase}",
    "ANTHROPIC_API_KEY": "${apiKey}"
  }
}
`,
        },
      ]
    case 'opencode':
      return [
        {
          title: 'API Key 模式（推荐）',
          filePath: '~/.config/opencode/opencode.json',
          language: 'json',
          content: `{
  "models": {
    "openai": {
      "base_url": "${openaiBase}",
      "api_key": "${apiKey}"
    }
  }
}
`,
        },
        {
          title: 'Legacy 兼容模式',
          filePath: '~/.config/opencode/opencode.json',
          language: 'json',
          content: `{
  "models": {
    "openai": {
      "base_url": "${openaiBase}",
      "api_key": "${apiKey}",
      "compat": "openai"
    }
  }
}
`,
        },
      ]
    case 'gemini-cli':
      return [
        {
          title: 'API Key 模式（推荐，OpenAI 兼容）',
          filePath: '~/.bashrc',
          language: 'bash',
          content: `# Gemini CLI 以 OpenAI 兼容模式接入 IHUI 中转站
export OPENAI_API_KEY="${apiKey}"
export OPENAI_BASE_URL="${openaiBase}"
`,
        },
        {
          title: 'Legacy 兼容模式',
          filePath: '~/.bashrc',
          language: 'bash',
          content: `# Legacy 兼容:旧版 Gemini CLI 读取 OPENAI_API_BASE
export OPENAI_API_KEY="${apiKey}"
export OPENAI_API_BASE="${openaiBase}"
`,
        },
      ]
    case 'grok-cli':
      return [
        {
          title: 'API Key 模式（推荐）',
          filePath: '~/.bashrc',
          language: 'bash',
          content: `export OPENAI_API_KEY="${apiKey}"
export OPENAI_BASE_URL="${openaiBase}"
`,
        },
        {
          title: 'Legacy 兼容模式',
          filePath: '~/.bashrc',
          language: 'bash',
          content: `# Legacy 兼容:旧版 Grok CLI 读取 OPENAI_API_BASE
export OPENAI_API_KEY="${apiKey}"
export OPENAI_API_BASE="${openaiBase}"
`,
        },
      ]
    default:
      return []
  }
}

const developerRelayBootstrapRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAuth)

  // ===== GET /developer/relay/keys/:id/bootstrap — 一键接入配置生成 =====
  server.get('/developer/relay/keys/:id/bootstrap', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))

    const q = clientQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))

    try {
      // 归属校验:确认 Key 属于当前用户
      const [row] = await dbRead
        .select({
          id: developerApiKeys.id,
          userId: developerApiKeys.userId,
          key: developerApiKeys.key,
        })
        .from(developerApiKeys)
        .where(eq(developerApiKeys.id, p.data.id))
        .limit(1)
      if (!row || row.userId !== userId)
        return reply.status(404).send(error(404, 'API Key 不存在或无权操作'))

      const base = resolveBaseUrl()
      const config = buildConfig(q.data.client, row.key, base)
      const keyPrefix =
        row.key.length > 10 ? `${row.key.slice(0, 4)}****${row.key.slice(-4)}` : row.key

      return reply.send(success({ client: q.data.client, keyPrefix, config }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '生成接入配置失败'))
    }
  })
}

export default developerRelayBootstrapRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
