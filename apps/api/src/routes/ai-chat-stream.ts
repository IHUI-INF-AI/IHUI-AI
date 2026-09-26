// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { repairMessages } from '@ihui/types'
import {
  compressContextIfNeeded,
  estimateMessagesTokens,
  CONTEXT_BUDGET_THRESHOLD,
  type ChatMessage,
} from '@ihui/context-compaction'
import { checkAuth } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { error, success } from '../utils/response.js'
import {
  bindConversationWorkspace,
  createMessage,
  patchConversationMetadata,
  replaceMessages,
} from '../db/chat-queries.js'
import { aiServiceFetch, aiServiceFetchStream } from '../utils/ai-service-fetch.js'
import {
  generateSemanticSummary,
  getCachedSemanticSummary,
  primeSemanticSummary,
} from '../utils/semantic-summary.js'
import { persistMessageArchive } from '../utils/conversation-archive.js'
import { loadRepoWikiContext } from '../services/repo-wiki-context.js'
import { loadKnowledgeContext } from '../services/knowledge-chat-context.js'
import {
  abortConversationStreams,
  createSession,
  detachOnClose,
  emitEvent,
  emitNamedEvent,
  emitUpstreamLine,
  findSession,
  finishSession,
  getReplayEvents,
  takeoverStream,
} from '../utils/sse-stream-registry.js'
import { getReplayWindowStatus, isStreamActive } from '../utils/sse-replay-buffer.js'

// P3-1 SSE 流式对话实时指标(admin 调试用,不直接进 Prometheus;Prometheus 抓取由 business-metrics.ts 负责)
const sseMetrics = {
  timeouts: 0, // SSE 服务端超时次数(5min 兜底超时触发)
  rateLimitHits: 0, // rateLimit 拦截次数(fastify-rate-limit 内部处理,本计数器暂不递增)
  budgetRejects: 0, // 预算校验拦截次数
  retryAfterSent: 0, // Retry-After header 下发次数
  upstreamErrors: 0, // 上游 ai-service 错误次数
}

const chatStreamSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      }),
    )
    .min(1),
  sessionId: z.string().optional(),
  model: z.string().optional(),
  modelId: z.string().optional(), // 向后兼容,优先使用 model
  agentId: z.string().optional(),
  materialContent: z.string().optional(),
  /** 当前绑定的本地工作区路径,透传到 ai-service 用于注入项目记忆(CLAUDE.md/AGENTS.md) */
  workspacePath: z.string().optional(),
  /** 浏览器端预加载的工作区文件内容(2026-09-04 修复透传断链):
   *  web 非 Tauri 环境用 FileSystemDirectoryHandle 读取工作区文件后经此字段上传,
   *  ai-service 优先于 workspace_path 注入 system prompt(优先级见 llm.py _inject_workspace_memory)。
   *  此前该字段未在 schema 中声明 → zod 解析时被剥离 → ai-service 永远收不到,
   *  导致"添加工作区后 AI 读不到任何项目文件"。上限与前端 MAX_TOTAL_SIZE(2MB)对齐。 */
  workspaceContext: z.string().max(2_500_000).optional(),
  /** P1-8(2026-09-13 立,Repo Wiki 对话自动引用):当前对话绑定的仓库名,
   *  后端据此读取 repo_wiki_docs 中最新一版「项目百科」总览并注入 system prompt。
   *  与 workspaceContext 同型坑:不在此声明会被 zod strip 静默丢弃,ai-service 永远收不到。上限与 /repo-wiki 生成接口对齐(200)。 */
  repoName: z.string().max(200).optional(),
  /** 模型上下文窗口大小(tokens),达 88% 阈值自动压缩。0 或不传 = 不压缩 */
  contextLimit: z.number().int().min(0).max(2_000_000).optional(),
  /** Agent 工具名列表(2026-07-22 立,AI 浏览器/电脑控制):
   *  传入工具名列表后,ai-service 走 tool loop(complete→tool_calls→execute→astream)。
   *  如 ["browser_screenshot", "computer_mouse_click"] */
  agentTools: z.array(z.string()).max(100).optional(),
  /** Plan/Act 双模切换(2026-07-24 立)
   * plan=只制定计划不执行工具(后端注入 Plan Mode system prompt),act=正常执行(默认)
   * 前端 extraBody 传 plan_mode(snake_case),透传到 ai-service /api/llm/complete/stream */
  plan_mode: z.string().optional(),
  /** ChatMode 5 态(2026-09-13 矩阵 A #24):ask/build/plan/review/spec。
   *  前端 send-message.ts:475 / send-answer.ts:183 发 mode(当前 ChatMode 选择),
   *  此前未在 schema 声明 → zod strip 静默丢弃,ai-service 永远收不到(链路掐断)。
   *  legacy plan_mode 继续兼容,ai-service 端 _resolve_chat_mode 以 mode 优先。 */
  mode: z.enum(['ask', 'build', 'plan', 'review', 'spec']).optional(),
  /** V3 #58(2026-09-26 立):工作区权限模式档位,透传到 ai-service 审批门
   *  (llm.py permission_mode 字段)。不声明会被 zod strip 静默丢弃 ——
   *  与 workspaceContext/mode 同型断链,审批门将永远按 default 档拦截高危工具。 */
  permissionMode: z.enum(['default', 'accept-edits', 'bypass-permissions', 'plan']).optional(),
  /** 原生 function calling(2026-08-31 立,OpenAI tools 格式弱类型透传):
   *  CLI 直连 ai-service 已支持(tools + tool_choice → tool-call-start SSE 事件),
   *  经网关中转的客户端(Web 等)同样需要透传。元素为 OpenAI tool 定义
   *  {type:'function', function:{name, description, parameters}},结构由 ai-service
   *  LLMCompleteRequest(tools: list[dict]) 负责校验,这里不做强 schema(strip 会丢字段)。 */
  tools: z.array(z.record(z.string(), z.unknown())).max(200).optional(),
  /** 工具选择策略: 'auto'/'none'/'required' 或 {type:'function',function:{name:'xxx'}} */
  tool_choice: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  /** P1-7(2026-09-13 立,四竞品对标 CodeX/Qoder 高级参数面板):
   *  会话级采样参数与自定义 system prompt。此前 model-selector 旁无参数入口,
   *  api-client streamChat 已支持这些字段(body 构造见 client.ts),
   *  但网关 schema 未声明 → zod strip 静默丢弃(与 workspaceContext/mode 同型断链)。
   *  此处补声明并透传到 ai-service /api/llm/complete/stream。 */
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().int().min(1).max(1000).optional(),
  maxTokens: z.number().int().min(1).max(200_000).optional(),
  /** 自定义 system prompt,ai-service 注入到 system 消息最顶部(与工作区记忆叠加)。
   *  上限 8000 字符,与前端 UI 限制对齐,防超长提示词拖垮上下文。 */
  systemPrompt: z.string().max(8000).optional(),
  /** P1 #26(2026-09-16 立,知识库默认注入主聊天):是否注入知识库检索结果。
   *  默认 true(轻量、可关)。关闭后不检索也不注入,降级为纯对话。
   *  检索结果折叠进 system_prompt 末尾(见 streamToClient),与 workspaceContext/wiki 同型:
   *  不在此声明会被 zod strip 静默丢弃。false 时显式关闭知识增强。 */
  knowledgeContext: z.boolean().optional(),
  metadata: z
    .object({
      conversationId: z.string().optional(),
      userId: z.string().optional(),
      messageId: z.string().optional(),
    })
    .optional(),
})

// AI 主动提问用户回答接口:接收 questionId + answer + 历史消息,把 answer 追加为 user 消息后继续生成
const chatAnswerSchema = chatStreamSchema.extend({
  questionId: z.string().min(1),
  answer: z.string().min(1),
})

export const aiChatStreamRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // Token 预算三态分档决策结果(2026-09-19 立, 替代原一刀切 429):
  // - allow    放行, 不发任何事件
  // - warning  放行, 流首命名帧 budget {level:'warning', ...} 软提醒
  // - critical 放行, 流首命名帧 budget {level:'critical', ...} 硬预警
  // - block    HTTP 429 硬中断(本函数内已发响应, 调用方直接 return)
  interface BudgetGateResult {
    decision: 'allow' | 'warning' | 'critical' | 'block'
    percent?: number
    usedTokens?: number
    limitTokens?: number
    tier?: string
    resetAt?: string
  }

  // 计算东八区次日 0 点的 ISO 时间串(budget 事件 resetAt 字段)。
  // 东八区无夏令时, 固定 UTC+8: 当前时刻 +8h 得"东八区墙上时钟", 归零到当日 0 点
  // 再 +24h 即东八区次日 0 点, 回退 8h 转回真实 UTC 时刻后 toISOString。
  function nextShanghaiMidnightISO(): string {
    const OFFSET_MS = 8 * 3600 * 1000
    const shanghaiWall = new Date(Date.now() + OFFSET_MS)
    shanghaiWall.setUTCHours(0, 0, 0, 0)
    return new Date(shanghaiWall.getTime() + 24 * 3600 * 1000 - OFFSET_MS).toISOString()
  }

  // Token 预算前置校验: 三态分档显式策略(替代原「超限即 429」一刀切)。
  // 分档语义(判定用 used/limit 比值而非 percent*100, 规避 0.95*100=94.999… 浮点陷阱;
  // percent 仅作展示, 向下取整到 0.1, 保证展示值与档位判定一致):
  //   percent < 80        → allow    放行, 不发事件
  //   80 ≤ percent < 95   → warning  放行, 流首命名帧 budget {level:'warning', ...}
  //   95 ≤ percent < 100  → critical 放行, 流首命名帧 budget {level:'critical', ...}
  //   percent ≥ 100       → block    HTTP 429 硬中断, 响应体顶层 errorCode='BUDGET_EXHAUSTED'
  // 六点边界推演: 79.9→allow 无事件 / 80→warning / 94.9→warning / 95→critical /
  //              99.9→critical / 100→block(判定式 ratio≥1 ⟺ used≥limit)
  // block 判定沿用 checkBudget 同口径 used >= limit(含 limit=0 时恒 block 的既有语义)。
  // 用量查询走 aiCost.getUserBudgetUsage, 异常时降级 allow(与原实现兜底一致)。
  async function checkTokenBudget(
    request: FastifyRequest,
    reply: FastifyReply,
    userId: string | undefined,
    model: string | undefined,
  ): Promise<BudgetGateResult> {
    if (!userId) return { decision: 'allow' } // 无 userId 无法校验, 放行
    try {
      const usage = await server.aiCost.getUserBudgetUsage(userId, model)
      if (!usage) return { decision: 'allow' } // 无预算记录, 放行不参与分档

      const { usedTokens, limitTokens, tier } = usage
      const resetAt = nextShanghaiMidnightISO()

      // block: 与 checkBudget 同口径 used >= limit(limit=0 时恒成立, 保持既有语义)
      if (usedTokens >= limitTokens) {
        // P2-2 日预算超限:下发 Retry-After(60s)让客户端按协商重试,而非无脑指数退避
        sseMetrics.budgetRejects++
        sseMetrics.retryAfterSent++
        reply.header('Retry-After', '60')
        reply.code(429).send({
          code: 429,
          message: '预算超限',
          errorCode: 'BUDGET_EXHAUSTED',
          percent: limitTokens > 0 ? Math.floor((usedTokens / limitTokens) * 1000) / 10 : 100,
          usedTokens,
          limitTokens,
          resetAt,
          data: { reason: 'budget_exceeded', detail: '日 token 预算已用尽' },
        })
        return {
          decision: 'block',
          percent: limitTokens > 0 ? Math.floor((usedTokens / limitTokens) * 1000) / 10 : 100,
          usedTokens,
          limitTokens,
          tier,
          resetAt,
        }
      }

      // 未 block 时必有 limit > 0(used >= limit 不成立且 used ≥ 0), 比值安全
      const ratio = usedTokens / limitTokens
      const percent = Math.floor(ratio * 1000) / 10
      if (ratio >= 0.95) {
        return { decision: 'critical', percent, usedTokens, limitTokens, tier, resetAt }
      }
      if (ratio >= 0.8) {
        return { decision: 'warning', percent, usedTokens, limitTokens, tier, resetAt }
      }
      return { decision: 'allow' }
    } catch (e) {
      // getUserBudgetUsage 不可用或异常:降级为只 log warning 不阻塞主链路
      request.log.warn({ err: e, userId, model }, 'budget gate failed, degrade to allow')
      return { decision: 'allow' }
    }
  }

  // 共享的 SSE 流式转发逻辑:/chat/stream 和 /chat/answer 共用
  // messages 已是最终列表(已 repair + 已压缩 + 已追加 answer),直接透传到 ai-service
  async function streamToClient(
    request: FastifyRequest,
    reply: FastifyReply,
    finalMessages: ChatMessage[],
    opts: {
      sessionId?: string
      resolvedModel?: string
      agentId?: string
      materialContent?: string
      workspacePath?: string
      /** 浏览器端预加载工作区内容,透传为 ai-service 的 workspace_context */
      workspaceContext?: string
      /** P1-8(2026-09-13 立):对话绑定的仓库名,用于读取并注入「项目百科」 */
      repoName?: string
      contextLimit?: number
      agentTools?: string[]
      planMode?: string
      /** ChatMode 5 态(2026-09-13 矩阵 A #24),透传到 ai-service req.mode */
      mode?: 'ask' | 'build' | 'plan' | 'review' | 'spec'
      /** V3 #58(2026-09-26 立):权限模式档位,透传为 ai-service 的 permission_mode(工具审批门) */
      permissionMode?: 'default' | 'accept-edits' | 'bypass-permissions' | 'plan'
      /** 原生 function calling(OpenAI tools 格式),undefined 时 JSON.stringify 自动省略,不注入 */
      tools?: Array<Record<string, unknown>>
      toolChoice?: string | Record<string, unknown>
      /** P1-7(2026-09-13 立):高级参数面板采样参数与自定义 system prompt */
      temperature?: number
      topP?: number
      topK?: number
      maxTokens?: number
      systemPrompt?: string
      /** P1 #26(2026-09-16 立):知识库默认注入开关。undefined/true = 注入(默认);false = 关闭 */
      knowledgeContext?: boolean
      metadata?: { conversationId?: string; userId?: string; messageId?: string }
    },
    extraFirstEvents: Array<{ key: string; payload: unknown }> = [],
  ): Promise<void> {
    reply.hijack()
    const raw = reply.raw
    // 2026-07-27 修复跨域 SSE:reply.hijack() 绕过 @fastify/cors 插件,
    // 实际 POST 响应头缺少 Access-Control-Allow-Origin,浏览器跨域 fetch 阻止响应(Failed to fetch)。
    // 手动回显 Origin + Allow-Credentials(preflight OPTIONS 已由 cors 插件处理,origin 已校验)。
    const origin = request.headers.origin as string | undefined
    const sseHeaders: Record<string, string> = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    }
    if (origin) {
      sseHeaders['Access-Control-Allow-Origin'] = origin
      sseHeaders['Access-Control-Allow-Credentials'] = 'true'
    }
    raw.writeHead(200, sseHeaders)

    // #22(2026-09-16 立)SSE 事件 id + Last-Event-ID 标准重放:
    // replayKey = `${conversationId}:${messageId}`(前端 streamChat metadata 均携带)。
    // 断线重连带 Last-Event-ID 头时优先走接管/重放,避免重新调上游:
    // 1) 原流仍在生成(15s 宽限窗口内)→ 重放缺失段 + 无缝接续原上游流;
    // 2) 原流已中止但缓冲在 60s 保留窗口 → 仅重放缺失段后结束(前端 dedupe 降级);
    // 3) 缓冲也过期/未知 key → 落到下方正常路径重新生成(前端 dedupe 前缀续写降级保留)。
    const replayKey =
      opts.metadata?.conversationId && opts.metadata?.messageId
        ? `${opts.metadata.conversationId}:${opts.metadata.messageId}`
        : null
    const lastEventIdHeader = request.headers['last-event-id']
    if (replayKey && typeof lastEventIdHeader === 'string' && lastEventIdHeader !== '') {
      const lastSeq = Number.parseInt(lastEventIdHeader, 10)
      if (Number.isFinite(lastSeq) && lastSeq >= 0) {
        // 第九轮(2026-09-26 立):发尾巴之前先问"窗口够不够"。
        // 缓冲每流上限 2000 行,超出即 FIFO 裁头;客户端的 lastSeq 落在被裁掉的区间时,
        // 缓冲只剩后半截 —— 照发出去就是"消息少了若干条、界面却看着连续",而 SSE 侧
        // 没有任何字段能表达这个洞(协议不动,见票面约束)。所以这一态并进既有的
        // "缓冲过期:正常路径重新生成"降级出口:宁可重跑一次,不发不可辨的半截。
        const window = getReplayWindowStatus(replayKey, lastSeq)
        if (window.complete) {
          const liveSession = findSession(replayKey)
          if (liveSession && !liveSession.finished) {
            // 接管:重放缺失段(id > Last-Event-ID)后原转发循环继续向本连接实时写
            const missed = takeoverStream(liveSession, lastSeq, raw)
            for (const e of missed) raw.write(`id: ${e.id}\n${e.rawLine}\n\n`)
            // 新连接断开同样走宽限 detach(重复断线/重连安全)
            request.raw.on('close', () => detachOnClose(liveSession))
            request.log.warn(
              { replayKey, lastSeq, replayed: missed.length },
              '[SSEReplay] stream takeover',
            )
            return
          }
          if (isStreamActive(replayKey)) {
            // 原流已中止/完成但缓冲仍在 60s 保留窗口:重放缺失段后结束
            const missed = getReplayEvents(replayKey, lastSeq)
            for (const e of missed) raw.write(`id: ${e.id}\n${e.rawLine}\n\n`)
            request.log.warn(
              { replayKey, lastSeq, replayed: missed.length },
              '[SSEReplay] replay-only (upstream gone)',
            )
            raw.end()
            return
          }
        } else {
          // 有洞 / 窗口已过期:降级为全量重新生成(丢弃必须点名,不许静默)
          request.log.warn(
            {
              replayKey,
              lastSeq,
              lowestBufferedId: window.lowestId,
              droppedCount: window.droppedCount,
              reason: window.known ? 'replay-window-hole' : 'replay-window-expired',
            },
            '[SSEReplay] 重放窗口不足以覆盖 Last-Event-ID,放弃部分重放 → 重新生成',
          )
        }
        // 缓冲过期 / 窗口有洞:落到下方正常路径重新生成(降级,与改造前行为一致)
      }
    }

    // 正常路径:创建会话(启用事件编号 + replay buffer),断线进宽限而非立即 abort
    // Steer(2026-09-19 立):replayKey 存在(主聊天链路带 metadata)时预生成流会话 ID,
    // 同时下发到 ai-service(请求体 streamSessionId 字段)与本地 session(upstreamSessionId
    // 字段)。POST /chat/steer 凭 replayKey = `conversationId:messageId` 找回 session,
    // 取此 ID 拼 ai-service `/llm/complete/stream/{session_id}/steer` 转发地址。
    // 降级流(缺 metadata)不启用:steer 端点无法寻址,注册队列无意义。
    const upstreamSessionId = replayKey ? randomUUID() : null
    const session = createSession(raw, new AbortController(), replayKey, upstreamSessionId)

    // 首事件:压缩通知等
    // 若该流绑定到某个 agent(opts.agentId),在 chunk 顶层注入 agentId,
    // 前端可据此把通知分流到对应 subagent 卡片;缺失时降级为单 agent 模式
    for (const evt of extraFirstEvents) {
      const chunk: Record<string, unknown> = { [evt.key]: evt.payload }
      if (opts.agentId) chunk.agentId = opts.agentId
      // 2026-09-18 立:compaction 升级为标准命名帧 —— `event: compaction` + data 带 type 字段,
      // 与 chunk/done/tool-result 等既有事件同构(此前是 data-only 帧,前端需特判)。
      // 原 `compaction` 键整体保留,既有前端消费路径零变化(纯增量字段 + 增量事件行)。
      if (evt.key === 'compaction') {
        chunk.type = 'compaction'
        emitNamedEvent(session, 'compaction', JSON.stringify(chunk))
        continue
      }
      // 2026-09-19 立:budget 用量提醒命名帧 —— payload 即完整 data(顶层平铺,
      // 与契约 SSEEventPayload budget 成员对齐: {type,level,percent,usedTokens,limitTokens,tier?,resetAt?})。
      // 不注入 agentId(用户级提醒,与 subagent 分流无关);emitNamedEvent 编号进 replay buffer,
      // 断线重连走接管/重放路径时随缓冲一并下发。
      if (evt.key === 'budget') {
        emitNamedEvent(session, 'budget', JSON.stringify(evt.payload))
        continue
      }
      emitEvent(session, JSON.stringify(chunk))
    }

    const controller = session.controller
    // 服务端超时兜底:防 ai-service 卡死时连接无限挂起(5 分钟,正常对话远小于此)
    // timedOut 标记用于区分"服务端超时 abort" vs "客户端主动断开 abort"
    let timedOut = false
    const serverTimeout = setTimeout(() => {
      timedOut = true
      sseMetrics.timeouts++
      controller.abort()
    }, 5 * 60_000)
    // 断线不再立即 abort 上游(#22):进 15s 宽限期等重连接管,超时才 abort
    const onClose = () => detachOnClose(session)
    request.raw.on('close', onClose)

    try {
      const mergedMetadata = {
        conversationId: opts.metadata?.conversationId,
        userId: opts.metadata?.userId ?? request.userId,
        messageId: opts.metadata?.messageId,
      }
      // P1-8(2026-09-13 立):读取「项目百科」总览(失败/未命中一律 null,不阻塞主链路)
      const wiki = await loadRepoWikiContext(mergedMetadata.userId ?? null, opts.repoName)
      // P1 #26(2026-09-16 立):知识库检索注入(失败/未命中一律 null,不阻塞主链路)。
      // 取末尾 user 消息文本(截 500 字符)作 query,检索 top-3 条,折叠进 system prompt 末尾。
      let knowledgeBlock: string | null = null
      if (opts.knowledgeContext !== false) {
        const lastUser = [...finalMessages].reverse().find((m) => m.role === 'user')
        const queryText = lastUser?.content?.slice(0, 500) ?? ''
        const knowledge = await loadKnowledgeContext(mergedMetadata.userId ?? null, queryText)
        knowledgeBlock = knowledge?.block ?? null
        if (knowledge) {
          // P1 #26:命中即合成 citations SSE 事件下发(流首阶段,早于首 token;进 replay buffer,
          // 断线重连自动重放)。复用 #11 前端链路(onCitations → setMessageCitations →
          // CitationBar 渲染 rag 来源标签),前端零新增解析逻辑。
          const citationChunk: Record<string, unknown> = {
            type: 'citations',
            citations: knowledge.citations,
          }
          if (mergedMetadata.messageId) citationChunk.messageId = mergedMetadata.messageId
          emitEvent(session, JSON.stringify(citationChunk))
          console.warn('[KnowledgeContext] hit:', {
            conversationTail: mergedMetadata.conversationId?.slice(-4),
            hitCount: knowledge.hitCount,
            citationCount: knowledge.citations.length,
            blockLength: knowledge.block.length,
          })
        }
      }
      // 与 wiki_context 合计限制在 20000 字符内:知识块超长时截断,防撑爆上下文窗口
      if (knowledgeBlock) {
        const wikiLen = wiki?.content?.length ?? 0
        const budget = 20000 - wikiLen
        if (knowledgeBlock.length > budget) {
          knowledgeBlock = budget > 0 ? knowledgeBlock.slice(0, budget) : ''
        }
      }
      // 折叠知识块进 system_prompt 末尾(用户自定义 systemPrompt 在前,knowledge 在后)
      let finalSystemPrompt: string | undefined = opts.systemPrompt
      if (knowledgeBlock) {
        finalSystemPrompt = opts.systemPrompt
          ? `${opts.systemPrompt}\n\n${knowledgeBlock}`
          : knowledgeBlock
      }
      const resp = await aiServiceFetchStream(request, '/api/llm/complete/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: request.headers.authorization ?? '',
        },
        body: JSON.stringify({
          messages: finalMessages,
          sessionId: opts.sessionId,
          // Steer(2026-09-19 立):流会话 ID 透传,ai-service 以此为键注册 steer 队列
          // (_steer_sessions[session_id],优先于 workspace_context 自生成 id);
          // 工具循环每轮 LLM 调用前 drain 注入。null 时省略不注入(降级流)。
          streamSessionId: upstreamSessionId ?? undefined,
          model: opts.resolvedModel,
          agentId: opts.agentId,
          materialContent: opts.materialContent,
          workspacePath: opts.workspacePath,
          // 2026-09-04 修复:浏览器端工作区上下文透传(此前在网关层被丢弃,见 schema 注释)。
          // undefined 时 JSON.stringify 自动省略,不注入上游请求。
          workspace_context: opts.workspaceContext,
          // P1-8(2026-09-13 立):项目百科透传(undefined 时 JSON.stringify 自动省略,不注入上游请求)。
          wiki_context: wiki?.content,
          wiki_repo: wiki?.repoName,
          contextLimit: opts.contextLimit ?? 0,
          // 2026-07-27 修复 tool loop 不触发:API 层接收前端驼峰 agentTools,
          // 透传到 ai-service 必须用下划线 agent_tools(Pydantic schema 字段名)。
          // 原代码透传 agentTools(驼峰)→ ai-service 端 Field(None) 默认值 None,
          // tool loop 入口 `if req.agent_tools:` 永远 false,从未触发工具调用。
          agent_tools: opts.agentTools,
          plan_mode: opts.planMode,
          mode: opts.mode,
          // V3 #58(2026-09-26 立):权限模式档位透传(snake_case 对齐 ai-service
          // Pydantic 字段名 permission_mode)。undefined 时 JSON.stringify 自动省略,
          // ai-service 端按 default 档处理(高危工具需审批)。
          permission_mode: opts.permissionMode,
          // 原生 function calling 透传:字段名与 ai-service LLMCompleteRequest
          // (tools: list[dict] | None, tool_choice: str | dict | None) 对齐;
          // undefined 时 JSON.stringify 省略该 key,不会注入到上游请求。
          tools: opts.tools,
          tool_choice: opts.toolChoice,
          // P1-7(2026-09-13 立):高级参数面板透传(snake_case 对齐 ai-service Pydantic 字段名)。
          // undefined 时 JSON.stringify 自动省略,不注入上游请求。
          temperature: opts.temperature,
          top_p: opts.topP,
          top_k: opts.topK,
          max_tokens: opts.maxTokens,
          // P1 #26(2026-09-16 立):system_prompt 已折叠知识库检索块(末尾追加,knowledgeContext 默认开)
          system_prompt: finalSystemPrompt,
          metadata: mergedMetadata,
        }),
        signal: controller.signal,
      })

      if (!resp.ok || !resp.body) {
        sseMetrics.upstreamErrors++
        const errText = await resp.text().catch(() => '')
        // 上游错误响应完整透传:尝试 JSON.parse,若成功则原样透传 {errorCode, message, ...}
        // 前端可基于 errorCode 做精准提示(如 MODEL_NOT_CONFIGURED → 提示用户切换模型)
        let errChunk: Record<string, unknown>
        try {
          const parsed = JSON.parse(errText) as Record<string, unknown>
          errChunk =
            typeof parsed === 'object' && parsed !== null
              ? parsed
              : { error: `upstream ${resp.status}: ${errText.slice(0, 200)}` }
        } catch {
          errChunk = { error: `upstream ${resp.status}: ${errText.slice(0, 200)}` }
        }
        if (opts.agentId) errChunk.agentId = opts.agentId
        emitEvent(session, JSON.stringify(errChunk))
        return
      }

      // 逐行注入 agentId:ai-service 返回的 token chunk 默认不带 agentId,
      // 这里对 JSON 格式的 data: 行注入顶层 agentId,让前端能按 agentId 分流到 subagent 卡片。
      // Vercel AI SDK `0:"token"` 格式同样经 emitUpstreamLine 编号+缓冲(#22),透传原样。
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let streamBuffer = ''
      // D1(2026-09-19 立):命名事件配对缓冲 —— `event: usage` 行的事件名暂存,
      // 下一行 `data:` 配对为编号命名帧(emitNamedEvent:编号 + 进回放缓冲)。
      let pendingNamedEvent: string | null = null
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        streamBuffer += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = streamBuffer.indexOf('\n')) !== -1) {
          const line = streamBuffer.slice(0, nl).replace(/\r$/, '')
          streamBuffer = streamBuffer.slice(nl + 1)
          // D1(2026-09-19 立):usage 命名帧透传 —— `event: usage` 已暂存事件名时,
          // 将紧随的 `data:` 行配对为编号命名帧(emitNamedEvent:编号 + 进回放缓冲,
          // 重放后仍是合法命名帧,与 compaction 首事件同源机制)。usage 来自主聊天链路,
          // 不经过 agentId 注入分支(上方 continue 已跳过),避免污染计量帧。
          if (pendingNamedEvent) {
            const data = line.startsWith('data:') ? line.slice(5).replace(/^\s/, '') : null
            if (data && data !== '[DONE]') {
              emitNamedEvent(session, pendingNamedEvent, data)
              pendingNamedEvent = null
              continue
            }
            // data 行缺失(异常帧):回退为通用行透传,避免丢帧
            pendingNamedEvent = null
          }
          // D1(2026-09-19 立):命名帧配对缓冲 —— `event:` 行暂存事件名,下一行 `data:`
          // 配对为编号命名帧(emitNamedEvent:两行整体进回放缓冲,重放保留事件名)。
          // 2026-09-19 扩展:usage + steer/fallback(本任务新增契约事件,与 usage 同为
          // _sse() 构造形态),断线重连重放需同等保真 —— 否则 steer 引导记录与
          // fallback 降级通知在重放后丢事件名,前端 onSteer/onFallback 不触发。
          // 其余命名帧(plan_updated/tool-summary/citations)维持原样透传:其 data
          // 行需走下方 agentId 注入分支(绑 agent 对话的 subagent 分流),通用化捕获会跳过。
          // V3 #58(2026-09-26 立):tool-approval(主对话流工具审批门)同样走原样
          // 行透传 —— event: 行 + data: 行经 emitUpstreamLine 编号进回放缓冲,
          // 断线重连重放后仍是合法命名帧;前端 streamChat 按 data.type 分流解析,
          // 决策回传走 ai-service 流级端点(与 postToolResult 同族,不经网关)。
          const evMatch = /^event:\s*(usage|steer|fallback)\s*$/.exec(line)
          if (evMatch) {
            pendingNamedEvent = evMatch[1] ?? null
            continue
          }
          if (opts.agentId && line.startsWith('data:') && !line.startsWith('data: [DONE]')) {
            const data = line.slice(5).replace(/^\s/, '')
            // 仅对 JSON 对象注入;Vercel AI SDK `0:"..."` / 纯文本透传
            if (data && data !== '[DONE]' && data.startsWith('{')) {
              try {
                const json = JSON.parse(data) as Record<string, unknown>
                if (typeof json === 'object' && json !== null && !json.agentId) {
                  json.agentId = opts.agentId
                  emitUpstreamLine(session, `data: ${JSON.stringify(json)}`)
                  continue
                }
              } catch {
                /* 非 JSON,透传 */
              }
            }
          }
          emitUpstreamLine(session, line)
        }
      }
      if (streamBuffer && session.raw) session.raw.write(streamBuffer)
    } catch (e) {
      const msg =
        (e as Error).name === 'AbortError'
          ? timedOut
            ? '服务端超时'
            : '客户端断开'
          : (e as Error).message
      const errChunk: Record<string, unknown> = { error: msg }
      if (opts.agentId) errChunk.agentId = opts.agentId
      emitEvent(session, JSON.stringify(errChunk))
    } finally {
      request.raw.off('close', onClose)
      clearTimeout(serverTimeout)
      finishSession(session)
      ;(session.raw ?? raw).end()
    }
  }

  server.post(
    '/chat/stream',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
          keyGenerator: (req) => req.userId || req.ip,
        },
      },
    },
    async (request, reply) => {
      const parsed = chatStreamSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const {
        messages: rawMessages,
        sessionId,
        model,
        modelId,
        agentId,
        materialContent,
        workspacePath,
        workspaceContext,
        repoName,
        contextLimit,
        agentTools,
        plan_mode: planMode,
        mode,
        // V3 #58(2026-09-26 立):权限模式档位(工具审批门),透传到 ai-service
        permissionMode,
        tools,
        tool_choice: toolChoice,
        temperature,
        topP,
        topK,
        maxTokens,
        systemPrompt,
        knowledgeContext,
        metadata,
      } = parsed.data
      const resolvedModel = model ?? modelId

      // G-165:把"这次对话绑哪个工作区"记进会话 metadata,供异步回调侧查**服务端自己的**
      // 权限记录给助手消息盖章(web 档位徽章因此可跨刷新/跨端存在)。
      // 幂等(值没变不写),且绝不阻塞流式主链路 —— 失败只 warn。
      if (workspacePath && metadata?.conversationId && request.userId) {
        void bindConversationWorkspace(
          metadata.conversationId,
          request.userId,
          workspacePath,
        ).catch((e: unknown) => {
          request.log.warn(
            { err: e instanceof Error ? e.message : String(e) },
            '[permission-stamp] 会话工作区绑定失败(不阻塞对话)',
          )
        })
      }

      // P38 跨端同步:修复 messages 结构异常(非法 role/空 content/连续重复/开头 assistant/末尾无响应 user)
      // 共享函数 @ihui/types/message-repair,与 CLI repairSessionHistory / ai-service repair_messages 同源
      // keepTrailingUser: 末尾 user 是本次发送的输入,必须保留(否则模型只能看到旧上下文)
      const { repaired: messages } = repairMessages(rawMessages, {
        keepTrailingUser: true,
      })

      // P39 跨端统一:88% 阈值自动压缩上下文(共享包 @ihui/context-compaction)
      // CLI / API / ai-service 共用同一套规则,前端传 contextLimit 触发,压缩结果通过 SSE 通知前端
      let finalMessages: ChatMessage[] = messages
      const extraFirstEvents: Array<{ key: string; payload: unknown }> = []

      if (contextLimit && contextLimit > 0) {
        const tokensBeforeCompress = Math.floor(estimateMessagesTokens(messages))
        const triggerThreshold = Math.floor(contextLimit * 0.88)
        const usageRatio = tokensBeforeCompress / contextLimit
        console.warn('[Compaction] before compress:', {
          contextLimit,
          messageCount: messages.length,
          tokens: tokensBeforeCompress,
          triggerThreshold,
        })
        // 后台预压缩(2026-09-01 立,代差能力 A):70% 占用时 fire-and-forget 预生成语义摘要
        // 缓存(进度条阈值 CONTEXT_BUDGET_THRESHOLD 与共享包一致),到 88% 真压缩时命中缓存,
        // 首 token 零额外延迟——对标程序(Claude Code)的压缩是阻塞式的,这是关键差异点。
        // 预生成失败静默吞掉,绝不影响主链路。
        if (usageRatio >= CONTEXT_BUDGET_THRESHOLD && tokensBeforeCompress < triggerThreshold) {
          void primeSemanticSummary(request, messages, resolvedModel, metadata?.conversationId)
        }
        // LLM 语义摘要(2026-09-01 立):只在确实会触发压缩时才取(88% 阈值与共享包
        // DEFAULT_TRIGGER_RATIO 对齐)。优先命中 70% 阶段预生成的缓存(零延迟),
        // 未命中再实时生成(3 秒超时/失败/stub 一律 null → 静默降级规则摘要)。
        // 三态观测统一前缀 [SemanticSummary] 便于 grep:cache hit(缓存命中) /
        // generated(实时生成成功) / degraded(实时生成失败,走共享包规则摘要)。
        let customSummary: string | null = null
        if (tokensBeforeCompress >= triggerThreshold) {
          const conversationTail = metadata?.conversationId?.slice(-4)
          customSummary = getCachedSemanticSummary(metadata?.conversationId, messages)
          if (customSummary !== null) {
            console.warn('[SemanticSummary] cache hit:', {
              conversationTail,
              summaryLength: customSummary.length,
            })
          } else {
            customSummary = await generateSemanticSummary(
              request,
              messages,
              resolvedModel,
              metadata?.conversationId,
            )
            if (customSummary !== null) {
              console.warn('[SemanticSummary] generated:', {
                conversationTail,
                summaryLength: customSummary.length,
                model: resolvedModel,
              })
            } else {
              console.warn('[SemanticSummary] degraded:', {
                conversationTail,
                model: resolvedModel,
              })
            }
          }
        }
        const result = compressContextIfNeeded(messages, {
          contextLimit,
          customSummary: customSummary ?? undefined,
        })
        console.warn('[Compaction] result:', {
          compressed: result.compressed,
          trigger: result.trigger,
          originalTokens: result.originalTokens,
          compressedTokens: result.compressedTokens,
          removedCount: result.removedCount,
          truncatedCount: result.truncatedCount,
          usageRatio: result.usageRatio,
        })
        if (result.compressed) {
          finalMessages = result.messages
          extraFirstEvents.push({
            key: 'compaction',
            payload: {
              triggered: true,
              trigger: result.trigger,
              tokensBefore: result.originalTokens,
              tokensAfter: result.compressedTokens,
              removedCount: result.removedCount,
              // A10B-8:截断量随帧下发(可选字段;旧消费方读不到即"未知",不会崩)
              truncatedCount: result.truncatedCount,
              usageRatio: result.usageRatio ?? 0,
              compressedMessages: result.messages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
            },
          })

          // 原子性持久化压缩结果：删除旧消息 + 批量插入压缩后的消息
          if (metadata?.conversationId) {
            void replaceMessages(metadata.conversationId, result.messages)
            // 归档记忆(2026-09-01 立,代差能力 C):被压缩的原始消息落库归档,
            // 前端状态条"查看原始消息"弹层可查——压缩透明可逆而非黑箱有损。
            // 归档失败静默降级(console.warn),绝不影响压缩主流程。
            void persistMessageArchive(metadata.conversationId, messages)
          }
        }
      }

      // Token 预算三态分档(2026-09-19 立):block 时 checkTokenBudget 已发 429 直接返回;
      // warning/critical 放行,经流首 budget 命名帧软提醒用量进度;allow 无动作。
      const budgetGate = await checkTokenBudget(
        request,
        reply,
        metadata?.userId ?? request.userId,
        resolvedModel,
      )
      if (budgetGate.decision === 'block') {
        return
      }
      if (budgetGate.decision === 'warning' || budgetGate.decision === 'critical') {
        // undefined 字段(tier/resetAt 缺失时)JSON.stringify 自动省略,与契约可选字段对齐
        extraFirstEvents.push({
          key: 'budget',
          payload: {
            type: 'budget',
            level: budgetGate.decision,
            percent: budgetGate.percent,
            usedTokens: budgetGate.usedTokens,
            limitTokens: budgetGate.limitTokens,
            tier: budgetGate.tier,
            resetAt: budgetGate.resetAt,
          },
        })
      }

      return streamToClient(
        request,
        reply,
        finalMessages,
        {
          sessionId,
          resolvedModel,
          agentId,
          materialContent,
          workspacePath,
          workspaceContext,
          repoName,
          contextLimit,
          agentTools,
          planMode,
          mode,
          // V3 #58(2026-09-26 立):权限模式档位,经上游请求体 permission_mode 字段透传
          permissionMode,
          tools,
          toolChoice,
          // P1-7(2026-09-13):会话级采样参数 + 自定义 system prompt 透传
          temperature,
          topP,
          topK,
          maxTokens,
          systemPrompt,
          // P1 #26(2026-09-16):知识库注入开关(默认开,false 关闭)
          knowledgeContext,
          metadata,
        },
        extraFirstEvents,
      )
    },
  )

  // POST /chat/answer — 用户回答 AI 主动提问,继续生成(不中断对话)
  // 前端收到 SSE question 事件 → 弹窗让用户选择/输入 → 提交答案到本接口
  // 后端把 answer 作为新 user 消息追加到 messages 末尾,然后调用 ai-service 继续流式生成
  //
  // P2 多端同步增强(2026-07-21):
  // 1. 持久化 answer 到 chat_messages(role: user, metadata: { questionId, isAnswer: true })
  // 2. 清除原 assistant 消息 metadata.pendingQuestion(标记已回答)
  // 3. WS 广播 chat_question_answered 通知其他端关闭弹窗
  server.post(
    '/chat/answer',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
          keyGenerator: (req) => req.userId || req.ip,
        },
      },
    },
    async (request, reply) => {
      const parsed = chatAnswerSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const {
        messages: rawMessages,
        sessionId,
        model,
        modelId,
        agentId,
        materialContent,
        workspacePath,
        workspaceContext,
        repoName,
        contextLimit,
        agentTools,
        plan_mode: planMode,
        mode,
        // V3 #58(2026-09-26 立):权限模式档位(工具审批门),透传到 ai-service
        permissionMode,
        tools,
        tool_choice: toolChoice,
        // P1-7(2026-09-13 立):chatAnswerSchema extends chatStreamSchema,
        // 续答同样支持会话级采样参数与自定义 system prompt(否则 zod strip 丢弃)。
        temperature,
        topP,
        topK,
        maxTokens,
        systemPrompt,
        knowledgeContext,
        metadata,
        questionId,
        answer,
      } = parsed.data
      const resolvedModel = model ?? modelId
      const userId = metadata?.userId ?? request.userId
      const conversationId = metadata?.conversationId

      // P2 多端同步:持久化 answer + 清挂起 + WS 广播(fire-and-forget,不阻塞 SSE 流)
      // 失败仅打日志,不影响续流(参考 persistMessageSafe 的容错策略)
      if (conversationId && userId) {
        void (async () => {
          try {
            // 1. 持久化 answer 为 user 消息(metadata 标记 questionId + isAnswer,便于后续查询关联)
            const savedAnswer = await createMessage({
              conversationId,
              role: 'user',
              content: answer,
              metadata: { questionId, isAnswer: true },
            })

            // 2. 清除 conversation.metadata.pendingQuestion(对话级挂起状态,标记已回答)
            //    用 merge 模式,不覆盖 conversation.metadata 的其他 key
            await patchConversationMetadata(conversationId, userId, {
              pendingQuestion: null,
              answeredQuestionId: questionId,
            })

            // 3. WS 广播 chat_question_answered 通知其他端关闭弹窗
            //    pushNotification 已支持 Redis Pub/Sub 多实例,所有端都会收到
            try {
              const push = (
                server as unknown as {
                  pushNotification?: (userId: string, payload: unknown) => void
                }
              ).pushNotification
              // 3a. 推送 chat_message 让其他端看到用户回答(与 POST /conversations/:id/messages 同模式)
              push?.(userId, {
                type: 'chat_message',
                conversationId,
                message: savedAnswer,
              })
              // 3b. 推送 chat_question_answered 让其他端关闭弹窗
              push?.(userId, {
                type: 'chat_question_answered',
                conversationId,
                questionId,
              })
            } catch {
              /* 推送失败不阻塞 */
            }
          } catch (e) {
            request.log.error(
              { err: e, questionId, conversationId },
              'chat/answer persistence failed',
            )
          }
        })()
      }

      // 把用户答案作为新 user 消息追加到 messages 末尾(在 repair 之前,让 repair 统一处理)
      const messagesWithAnswer = [...rawMessages, { role: 'user' as const, content: answer }]

      // keepTrailingUser: 末尾 user 是用户对 question 的回答,必须保留(否则模型答非所问)
      const { repaired: messages } = repairMessages(messagesWithAnswer, {
        keepTrailingUser: true,
      })

      let finalMessages: ChatMessage[] = messages
      const extraFirstEvents: Array<{ key: string; payload: unknown }> = []

      if (contextLimit && contextLimit > 0) {
        const tokensBeforeCompress = Math.floor(estimateMessagesTokens(messages))
        const triggerThreshold = Math.floor(contextLimit * 0.88)
        const usageRatio = tokensBeforeCompress / contextLimit
        // 诊断日志与 /chat/stream 主入口一致:incompressible(压不动)时 compressed=false 走原路径,防循环
        console.warn('[Compaction][answer] before compress:', {
          contextLimit,
          messageCount: messages.length,
          tokens: tokensBeforeCompress,
          triggerThreshold,
        })
        // 后台预压缩:与 /chat/stream 同一策略(70% 占用 fire-and-forget 预生成摘要缓存)
        if (usageRatio >= CONTEXT_BUDGET_THRESHOLD && tokensBeforeCompress < triggerThreshold) {
          void primeSemanticSummary(request, messages, resolvedModel, conversationId)
        }
        // LLM 语义摘要:与 /chat/stream 同一套逻辑(缓存优先→实时生成→失败静默降级),
        // 三态观测统一前缀 [SemanticSummary]:cache hit / generated / degraded。
        let customSummary: string | null = null
        if (tokensBeforeCompress >= triggerThreshold) {
          const conversationTail = conversationId?.slice(-4)
          customSummary = getCachedSemanticSummary(conversationId, messages)
          if (customSummary !== null) {
            console.warn('[SemanticSummary] cache hit:', {
              conversationTail,
              summaryLength: customSummary.length,
            })
          } else {
            customSummary = await generateSemanticSummary(
              request,
              messages,
              resolvedModel,
              conversationId,
            )
            if (customSummary !== null) {
              console.warn('[SemanticSummary] generated:', {
                conversationTail,
                summaryLength: customSummary.length,
                model: resolvedModel,
              })
            } else {
              console.warn('[SemanticSummary] degraded:', {
                conversationTail,
                model: resolvedModel,
              })
            }
          }
        }
        const result = compressContextIfNeeded(messages, {
          contextLimit,
          customSummary: customSummary ?? undefined,
        })
        console.warn('[Compaction][answer] result:', {
          compressed: result.compressed,
          trigger: result.trigger,
          originalTokens: result.originalTokens,
          compressedTokens: result.compressedTokens,
          removedCount: result.removedCount,
          truncatedCount: result.truncatedCount,
          usageRatio: result.usageRatio,
        })
        if (result.compressed) {
          finalMessages = result.messages
          extraFirstEvents.push({
            key: 'compaction',
            payload: {
              triggered: true,
              trigger: result.trigger,
              tokensBefore: result.originalTokens,
              tokensAfter: result.compressedTokens,
              removedCount: result.removedCount,
              // A10B-8:截断量随帧下发(可选字段;旧消费方读不到即"未知",不会崩)
              truncatedCount: result.truncatedCount,
              usageRatio: result.usageRatio ?? 0,
              compressedMessages: result.messages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
            },
          })

          // 原子性持久化压缩结果：删除旧消息 + 批量插入压缩后的消息
          if (conversationId) {
            void replaceMessages(conversationId, result.messages)
            // 归档记忆:被压缩的原始消息落库,前端状态条可查(与 /chat/stream 一致)
            void persistMessageArchive(conversationId, messages)
          }
        }
      }

      // Token 预算三态分档(2026-09-19 立):block 时 checkTokenBudget 已发 429 直接返回;
      // warning/critical 放行,经流首 budget 命名帧软提醒用量进度;allow 无动作。
      const budgetGate = await checkTokenBudget(request, reply, userId, resolvedModel)
      if (budgetGate.decision === 'block') {
        return
      }
      if (budgetGate.decision === 'warning' || budgetGate.decision === 'critical') {
        // undefined 字段(tier/resetAt 缺失时)JSON.stringify 自动省略,与契约可选字段对齐
        extraFirstEvents.push({
          key: 'budget',
          payload: {
            type: 'budget',
            level: budgetGate.decision,
            percent: budgetGate.percent,
            usedTokens: budgetGate.usedTokens,
            limitTokens: budgetGate.limitTokens,
            tier: budgetGate.tier,
            resetAt: budgetGate.resetAt,
          },
        })
      }

      return streamToClient(
        request,
        reply,
        finalMessages,
        {
          sessionId,
          resolvedModel,
          agentId,
          materialContent,
          workspacePath,
          workspaceContext,
          repoName,
          contextLimit,
          agentTools,
          planMode,
          mode,
          // V3 #58(2026-09-26 立):权限模式档位,经上游请求体 permission_mode 字段透传
          permissionMode,
          tools,
          toolChoice,
          // P1-7(2026-09-13):续答透传会话级采样参数
          temperature,
          topP,
          topK,
          maxTokens,
          systemPrompt,
          // P1 #26(2026-09-16):续答同样支持知识库注入开关(默认开)
          knowledgeContext,
          metadata,
        },
        extraFirstEvents,
      )
    },
  )

  // POST /chat/questions — 持久化 AI 主动提问挂起状态 + WS 广播到多端
  // 前端收到 SSE question 事件时主动调用本端点,把挂起状态写入 chat_conversations.metadata.pendingQuestion
  // 其他端通过 WS ai_question 事件收到后 setPendingQuestion 弹窗,实现多端同步
  //
  // 设计权衡(2026-07-21):
  // - 不改 ai-service _fire_callback 链路(避免侵入式修改 Python 端 + ai-callback worker)
  // - 前端是 SSE question 事件的唯一消费者,由前端主动持久化是单一来源
  // - 用 conversation.metadata 而非 message.metadata,因为前端 onQuestion 时 assistantMessageId
  //   是前端 UUID(占位),DB id 要等 ai-callback 完成后才落地,无法立即持久化到 message.metadata
  // - 缺点:用户 A 关闭浏览器前未调本端点 → 挂起状态不持久化(罕见场景,可接受)
  // - 优点:架构简单,不改 ai-service + ai-callback 链路,工作量最小
  const questionSchema = z.object({
    conversationId: z.string().min(1),
    questionId: z.string().min(1),
    prompt: z.string().min(1),
    options: z
      .array(z.object({ id: z.string(), label: z.string() }))
      .max(100)
      .default([]),
    allowCustom: z.boolean().default(false),
    allowMultiple: z.boolean().default(false),
  })

  server.post('/chat/questions', async (request, reply) => {
    const parsed = questionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { conversationId, questionId, prompt, options, allowCustom, allowMultiple } = parsed.data
    const userId = request.userId
    if (!userId) {
      return reply.status(401).send(error(401, '未登录'))
    }

    // 1. 把 pendingQuestion 写入 conversation.metadata(merge 模式,不覆盖其他 key)
    //    若对话不存在或不属于该用户 → 返回 404(前端降级为仅本地弹窗,不影响主流程)
    const updated = await patchConversationMetadata(conversationId, userId, {
      pendingQuestion: { questionId, prompt, options, allowCustom, allowMultiple },
    })
    if (!updated) {
      return reply.status(404).send(error(404, '对话不存在或无权限'))
    }

    // 2. WS 广播 ai_question 通知其他端弹窗(pushNotification 支持 Redis Pub/Sub 多实例)
    try {
      ;(
        server as unknown as {
          pushNotification?: (userId: string, payload: unknown) => void
        }
      ).pushNotification?.(userId, {
        type: 'ai_question',
        conversationId,
        question: { questionId, prompt, options, allowCustom, allowMultiple },
      })
    } catch {
      /* 推送失败不阻塞 */
    }

    return reply.send(success({ ok: true, persisted: true }))
  })

  // POST /chat/abort — 主动中止进行中的对话流(2026-09-18 立)
  // 前端「停止」按钮的服务端闭环:此前只断开 SSE 连接,网关侧上游 fetch 靠 15s
  // 宽限期超时才 abort,期间 ai-service 的工具子进程仍在跑(浪费额度 + 脏状态)。
  // 本端点按 conversationId(可选 messageId 精确匹配)中止对应上游流,并向流内
  // 注入 {type:'cancelled'} 终止帧(多端同步场景下其它客户端可见)。
  const abortSchema = z.object({
    conversationId: z.string().min(1).optional(),
    /** 兼容别名:部分调用方只有 ai-service sessionId;当前会话键即 conversationId */
    sessionId: z.string().min(1).optional(),
    messageId: z.string().min(1).optional(),
  })

  server.post('/chat/abort', async (request, reply) => {
    const parsed = abortSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const conversationId = parsed.data.conversationId ?? parsed.data.sessionId
    if (!conversationId) {
      return reply.status(400).send(error(400, 'conversationId 必填'))
    }
    const count = abortConversationStreams(conversationId, parsed.data.messageId)
    request.log.info(
      { conversationId, messageId: parsed.data.messageId, aborted: count },
      '[ChatAbort] abort requested',
    )
    // 未命中不是错误(流可能刚好自然结束),仍返回 200 便于前端统一处理
    return reply.send(success({ ok: true, aborted: count > 0, count }))
  })

  // POST /chat/steer — 中途引导进行中的对话流(Steer,2026-09-19 立)
  // 流式对话期间用户点闪电按钮提交引导文本:不打断当前工具执行,经网关转发到
  // ai-service `/llm/complete/stream/{session_id}/steer` 入队;tool loop 每轮
  // LLM 调用前 drain 注入 messages 并回发 event: steer(phase=injected)。
  // 寻址:replayKey = `${conversationId}:${messageId}`(与 abort 同键),取
  // streamToClient 预生成并存入 StreamSession.upstreamSessionId 的流会话 ID。
  // 状态码透传:200 入队成功 / 422 text 缺失 / 404 流不存在或已结束 / 429 队列满。
  const steerSchema = z.object({
    conversationId: z.string().min(1),
    messageId: z.string().min(1),
    /** 引导文本;上限与 ai-service 端截断(4000 字符)对齐 */
    text: z.string().min(1).max(4000),
  })

  server.post('/chat/steer', async (request, reply) => {
    const parsed = steerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { conversationId, messageId, text } = parsed.data
    const session = findSession(`${conversationId}:${messageId}`)
    if (!session || session.finished || !session.upstreamSessionId) {
      // 流不存在/已结束/未启用 steer(缺 metadata 的降级流):透传 ai-service 同义 404,
      // 前端 toast「引导失败(队列已满或流已结束)」统一处理
      request.log.info({ conversationId, messageId }, '[ChatSteer] stream not found or finished')
      return reply.status(404).send(error(404, '流不存在或已结束'))
    }
    try {
      const resp = await aiServiceFetch(
        request,
        `/api/llm/complete/stream/${session.upstreamSessionId}/steer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: request.headers.authorization ?? '',
          },
          body: JSON.stringify({ text }),
        },
      )
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
      if (!resp.ok) {
        // 透传 ai-service 状态码(422/404/429),前端据 429 提示队列已满
        return reply.status(resp.status).send(data)
      }
      request.log.info(
        { conversationId, messageId, status: resp.status },
        '[ChatSteer] steer enqueued',
      )
      return reply.status(resp.status).send(data)
    } catch (e) {
      request.log.error({ err: e, conversationId, messageId }, 'steer proxy failed')
      return reply.status(502).send(error(502, (e as Error).message))
    }
  })

  // POST /agent/approval-response — 工具审批响应代理(2026-08-30 立)
  // 前端审批弹窗(组件订阅 /api/agents/tasks/stream 的 tool-approval 事件)点"批准/拒绝"后
  // 调用 /api/ai/agent/approval-response → 本端点 → 转发到 ai-service /api/agents/approval-response。
  // 审批注册表在 ai-service 进程内,响应写回后唤醒 agent_loop_v2 中等待的高危工具协程。
  const approvalResponseSchema = z.object({
    approval_id: z.string().min(1).optional(),
    approvalId: z.string().min(1).optional(),
    decision: z.enum(['approve', 'reject']),
    // D84(2026-09-23):审批作用域(once/session/always)与用户原因,透传到 ai-service;
    // 未携带时 ai-service 侧默认 session(兼容旧客户端行为)。
    scope: z.enum(['once', 'session', 'always']).optional(),
    reason: z.string().max(500).optional(),
  })

  server.post('/agent/approval-response', async (request, reply) => {
    const parsed = approvalResponseSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const approvalId = parsed.data.approval_id ?? parsed.data.approvalId
    if (!approvalId) {
      return reply.status(400).send(error(400, 'approval_id 必填'))
    }
    try {
      const resp = await aiServiceFetch(request, '/api/agents/approval-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: request.headers.authorization ?? '',
        },
        body: JSON.stringify({
          approval_id: approvalId,
          decision: parsed.data.decision,
          scope: parsed.data.scope ?? 'session',
          ...(parsed.data.reason !== undefined ? { reason: parsed.data.reason } : {}),
        }),
      })
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
      if (!resp.ok) {
        return reply.status(resp.status).send(data)
      }
      return reply.send(data)
    } catch (e) {
      request.log.error({ err: e, approvalId }, 'approval-response proxy failed')
      return reply.status(502).send(error(502, (e as Error).message))
    }
  })

  // GET /api/ai/admin/ai/chat/metrics — SSE 流式对话实时指标(admin 调试用)
  // P3-1 简化方案:不引入 prom-client,不改 business-metrics.ts(不在受影响文件清单),
  // 改为 admin JSON 端点暴露细分计数器,供 admin 看板查询。
  // Prometheus 抓取仍由 business-metrics.ts 的 /business-metrics 负责,本端点不直接进 Prometheus。
  // 注意:本插件注册时 prefix=/api/ai(见 routes/index.ts),故路由用相对路径 /admin/ai/chat/metrics,
  // 实际完整路径为 /api/ai/admin/ai/chat/metrics(避免双 /api 拼接 bug)。
  // P1 修复(2026-08-06):内部指标为 admin 调试端点,原只做登录校验(authenticate),
  // 任何登录用户可查看全站实时指标,改为 requireAdmin。
  server.get('/admin/ai/chat/metrics', { preHandler: requireAdmin }, async () => {
    return success(sseMetrics)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
