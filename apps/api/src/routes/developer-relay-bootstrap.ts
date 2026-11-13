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
 *   - 占位用真实凭据(developerApiKeys.key 明文字段 + 一次性 secret)
 *   - BASE_URL = process.env.PUBLIC_API_BASE_URL ?? 'https://aizhs.top'
 *   - 响应:success({ client, keyPrefix, config: [{ title, filePath, language, content }] })
 *   - auth 模式区分 legacy / api-key 的客户端各给两版配置。
 *
 * F-392(2026-11-13):鉴权要求 key+secret 双因子,而 secret 库里只存哈希、无法回显,
 * 旧实现只把公开 key 写进配置 ⇒ 引导产出的配置必然 401。现约定:
 *   - 默认(GET 只读)仍只下发 key,响应带 secretNotice 指引;
 *   - 显式 `?rotateSecret=1|true` 时轮换 secret(哈希落库),明文仅本次响应返回一次,
 *     配置写入 `<key>.<secret>` 组合凭据,客户端单个 Key 输入框即可完成双因子;
 *   - 轮换会下发明文凭据,故与创建/重置同级要求 2FA step-up;明文不入日志、不入库。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { developerApiKeys } from '@ihui/database'
import { success, error } from '../utils/response.js'
import { requireAuth } from '../plugins/require-permission.js'
import { idParamSchema } from './admin/_shared.js'
import { isUuidString } from '../utils/uuid.js'
import { composeApiCredential } from '../utils/api-key-credential.js'
import { generateApiKey, hashSecret } from '../utils/api-key-hash.js'
import { requireStepUpForTwoFactorUser } from '../services/two-factor-step-up-store.js'

const clientQuerySchema = z.object({
  client: z.enum([
    'codex',
    'codex-ws',
    'claude-code',
    'opencode',
    'gemini-cli',
    'grok-cli',
    'ccswitch',
  ]),
  /** F-392:显式轮换才一次性下发明文 secret,避免每次打开接入弹窗都让存量客户端失效 */
  rotateSecret: z.enum(['1', 'true']).optional(),
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

/**
 * 生成单个客户端的即贴配置块数组。
 * `credential` 为 `<ihui_key>.<sk_secret>` 组合凭据(无 secret 时退化为纯 key),
 * 客户端只要把这一串放进单个 Key 输入框即可同时携带双因子。
 */
function buildConfig(client: string, credential: string, base: string): ConfigBlock[] {
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
api_key = "${credential}"

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
export OPENAI_API_KEY="${credential}"
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
          content: `export OPENAI_API_KEY="${credential}"
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
export OPENAI_API_KEY="${credential}"
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
          content: `export ANTHROPIC_API_KEY="${credential}"
export ANTHROPIC_BASE_URL="${anthropicBase}"
`,
        },
        {
          title: 'Legacy 兼容模式',
          filePath: '~/.bashrc',
          language: 'bash',
          content: `# Legacy 兼容:旧版 Claude Code 读取 ANTHROPIC_API_BASE
export ANTHROPIC_API_KEY="${credential}"
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
    "ANTHROPIC_API_KEY": "${credential}"
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
      "api_key": "${credential}"
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
      "api_key": "${credential}",
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
export OPENAI_API_KEY="${credential}"
export OPENAI_BASE_URL="${openaiBase}"
`,
        },
        {
          title: 'Legacy 兼容模式',
          filePath: '~/.bashrc',
          language: 'bash',
          content: `# Legacy 兼容:旧版 Gemini CLI 读取 OPENAI_API_BASE
export OPENAI_API_KEY="${credential}"
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
          content: `export OPENAI_API_KEY="${credential}"
export OPENAI_BASE_URL="${openaiBase}"
`,
        },
        {
          title: 'Legacy 兼容模式',
          filePath: '~/.bashrc',
          language: 'bash',
          content: `# Legacy 兼容:旧版 Grok CLI 读取 OPENAI_API_BASE
export OPENAI_API_KEY="${credential}"
export OPENAI_BASE_URL="${openaiBase}"
`,
        },
      ]
    case 'ccswitch':
      // CC Switch（Claude Code Switch，国内主流 Claude 多供应商切换器）
      // provider 条目片段,anthropic 兼容入口 /v1/anthropic
      return [
        {
          title: 'Provider 配置片段（~/.cc-switch/config.json）',
          filePath: '~/.cc-switch/config.json',
          language: 'json',
          content: `{
  "name": "IHUI",
  "baseUrl": "${anthropicBase}",
  "apiKey": "${credential}",
  "category": "custom"
}
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
    // 形状闸(2026-09-28 普查收口):下面这些 :id 最终会被喂进 uuid 列,非 uuid 字面量让 Postgres
    // 抛 22P02 invalid input syntax for type uuid,而未被兜住就是 500 —— 于是"这条不存在"与
    // "服务坏了"在响应上完全同形。判据只有一份(utils/uuid.ts 的 isUuidString),闸必须在进 SQL 之前。
    if (!isUuidString(p.data.id))
      return reply.status(404).send(error(404, 'API Key 不存在或无权操作'))

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

      // F-392:secret 库里只存哈希、无法回显。显式 rotateSecret 时轮换一次并把明文交出去,
      // 否则只能给纯 key 配置(客户端另配 X-Api-Secret 也无法得到值)。
      let secret: string | null = null
      if (q.data.rotateSecret) {
        // 明文凭据下发与创建/重置同级敏感,已开 2FA 的账号须先 step-up(F-391 同一判据)。
        const stepUp = await requireStepUpForTwoFactorUser({ userId, redis: request.server.redis })
        if (!stepUp.ok) {
          return reply
            .status(401)
            .send(
              error(
                401,
                stepUp.code === 'STEP_UP_REQUIRED'
                  ? '该操作需要二次验证：请先调用 POST /auth/2fa/step-up 提交当前 TOTP 验证码（5 分钟内有效）'
                  : '暂时无法确认该账号的两步验证状态，请稍后重试',
                stepUp.code,
              ),
            )
        }
        const generated = generateApiKey()
        secret = generated.secret
        // 落库只写哈希;明文只存在于本次响应,不入库、不进日志。
        const [updated] = await db
          .update(developerApiKeys)
          .set({ secret: hashSecret(secret), updatedAt: new Date() })
          .where(and(eq(developerApiKeys.id, row.id), eq(developerApiKeys.userId, userId)))
          .returning({ id: developerApiKeys.id })
        if (!updated) return reply.status(404).send(error(404, 'API Key 不存在或无权操作'))
        request.skipResponseSanitization = true
      }

      const base = resolveBaseUrl()
      // 组合凭据 `ihui_xxx.sk_yyy`:鉴权侧 parseApiCredential 会拆出内联 secret,
      // 因此只有一个 Key 输入框的客户端也能通过双因子校验。
      const credential = composeApiCredential(row.key, secret)
      const config = buildConfig(q.data.client, credential, base)
      const keyPrefix =
        row.key.length > 10 ? `${row.key.slice(0, 4)}****${row.key.slice(-4)}` : row.key

      return reply.send(
        success({
          client: q.data.client,
          keyPrefix,
          config,
          ...(secret
            ? {
                secret,
                credential,
                secretRotated: true,
                secretNotice:
                  'secret 仅显示一次：请立即保存配置；离开本页后无法再次查看，遗失只能重置(轮换)',
              }
            : {
                secretNotice:
                  '该 Key 的 secret 仅在创建时显示一次，无法回显；需要含 secret 的可直接使用的配置请带 rotateSecret=1(会轮换 secret，旧 secret 立即失效)',
              }),
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '生成接入配置失败'))
    }
  })
}

export default developerRelayBootstrapRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
