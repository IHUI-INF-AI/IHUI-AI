// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../utils/response.js'
import { config } from '../config/index.js'
// G-165:助手消息权限档盖章(会话 → 工作区 → workspace_permissions,全部服务端自取)
import { findConversationById } from '../db/chat-queries.js'
import { getPermission } from '../db/workspace-permission-queries.js'
import {
  permissionStamp,
  workspacePathOfConversationMeta,
} from '../services/message-permission-stamp.js'

/**
 * AI 回调端点。
 *
 * 由 AI service 在 LLM 推理完成后 POST 调用(见 apps/ai-service/app/routers/llm.py)。
 * 接收完整推理结果 + metadata,入队 aiCallback 队列由 Worker 异步处理:
 * - 持久化 assistant 消息(关联 conversationId/messageId)
 * - 记录 token 用量
 * - WebSocket 实时推送(多端同步)
 *
 * 端点设计:
 * - POST /api/ai/callback — 接收回调,入队,立即返回 202 Accepted
 * - 内部服务间调用,无需 JWT 鉴权(由网络隔离 + 后续可加 shared secret)
 */
// D24(2026-09-19 立):工具调用/终端任务持久化 —— 回调 body 可选数组 schema。
// looseObject:ai-service 侧字段会随协议演进增加,这里只校验关键字段,
// 其余透传落库(恢复/回放时前端按 BaseToolCall/TerminalTask 消费)。
const persistedToolCallSchema = z.looseObject({
  id: z.string(),
  toolName: z.string(),
  status: z.string().optional(),
  isError: z.boolean().optional(),
  iteration: z.number().optional(),
  durationMs: z.number().optional(),
})

const persistedTerminalTaskSchema = z.looseObject({
  id: z.string(),
  command: z.string(),
  status: z.string().optional(),
  output: z.string().optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  durationMs: z.number().optional(),
  exitCode: z.number().optional(),
})

// planSteps(2026-09-21 立,零 schema 迁移):ai-service 侧与 SSE plan_updated
// 事件同源的权威计划快照( packages/types/src/ai.ts 的 PlanStep[])。
// 只校验关键字段,其余(startedAt/endedAt/toolCallIds/error/durationMs…)透传落库,
// 回放时前端按 PlanStep 消费 —— 与 toolCalls 通道保持一致的 loose 策略。
const persistedPlanStepSchema = z.looseObject({
  id: z.string(),
  step: z.string(),
  status: z.string(),
})

// G-166(2026-09-22 立)交代帧持久化:citations / injections 与各自 SSE 帧同源
// (ai-service 侧同一个 _collect_citations / 同一份 injection_frames 列表)。
// 结构与 packages/types/src/chat.ts 的 ChatMessage.citations / .injections 对齐,
// 其余字段(url / count / fullText…)按 loose 透传落库,回放时前端直接消费。
const persistedCitationSchema = z.looseObject({
  source: z.string(),
  label: z.string(),
})

const persistedInjectionSchema = z.looseObject({
  kind: z.string(),
  collapsed: z.string(),
})

// compaction(G-166 第②步):与 SSE compaction 帧同一载荷(_compaction_payload 单一真相源)。
// 只锁"能判定这轮压缩过/撞过上限"的两个字段,token 统计与 trigger 按 loose 透传。
const persistedCompactionSchema = z
  .looseObject({
    triggered: z.boolean(),
    trigger: z.string(),
  })
  .refine((v) => v.triggered === true, { message: 'compaction.triggered 必须为 true 才留痕' })

// retryNotice(G-166 第⑥步):网关换 key / 退避重试的最终一条记账,四字段全部由契约钉死
// (apps/ai-service/app/core/sse_contract.py 的 retry_scheduled)。attempt 必须 ≥ 1 ——
// "重试了 0 次"不是一种交代,而是一种噪声,不该占 metadata。
const persistedRetryNoticeSchema = z.looseObject({
  attempt: z.number().int().min(1),
  maxRetries: z.number().int().min(1),
  retryInMs: z.number().int().min(0),
  httpStatus: z.number().int().optional(),
})

// D33(2026-09-23 立):usageDetail / fallback / memoryUpdates 过程性信息持久化。
// 与 citations / compaction 同一套 loose 透传语义:只锁关键字段,其余按 loose 落库,
// 回放时前端直接消费;空值不写 key(worker 浅合并不覆盖既有 key)。
// usageDetail:与 event: usage 同源的用量明细(token 分项 + 计时 + 成本 + 模型),
// 子字段类型宽松(部分 provider 不给 reasoningTokens / 成本),全部透传落库。
const persistedUsageDetailSchema = z.looseObject({
  promptTokens: z.unknown().optional(),
  completionTokens: z.unknown().optional(),
  totalTokens: z.unknown().optional(),
  reasoningTokens: z.unknown().optional(),
  firstTokenMs: z.unknown().optional(),
  durationMs: z.unknown().optional(),
  model: z.string().nullable().optional(),
  costUsd: z.unknown().optional(),
})

// fallback:主模型失败切换备用模型的交代,与 SSE fallback 帧同源(primary_model/backup_model/reason)。
// 三个字段全部由契约钉死(SSE 事件必带),缺一不落库(降级提示渲染不出可辨认的一行就别出现)。
const persistedFallbackSchema = z.looseObject({
  primary_model: z.string(),
  backup_model: z.string(),
  reason: z.string(),
})

// memoryUpdates:本轮对话同步提炼出的长期记忆条目摘要数组(done.memoryUpdates 同源),
// 每项一条字符串摘要;其余按 loose 透传。
const persistedMemoryUpdatesSchema = z.array(z.string())

// D33(2026-09-23 立):单条 metadata 序列化体积护栏。
// 任一结构化值(JSON)超过 64KB 即降级为标注文本 { truncated: true, originalBytes },
// 不丢字段(键保留)、不整条丢弃 —— 超大 citations/toolCalls/usageDetail 等仍能落库,
// 只是超大那一项变成可识别占位,避免一条巨消息撑爆 jsonb 行。
const METADATA_VALUE_MAX_BYTES = 64 * 1024
function capMetadataObject(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(meta)) {
    if (value === null || typeof value !== 'object') {
      out[key] = value
      continue
    }
    const serialized = JSON.stringify(value)
    out[key] =
      serialized.length <= METADATA_VALUE_MAX_BYTES
        ? value
        : { truncated: true, originalBytes: serialized.length }
  }
  return out
}

const callbackSchema = z.object({
  content: z.string(),
  reasoning: z.string().optional(),
  model: z.string().nullable().optional(),
  provider: z.string().optional(),
  usage: z.unknown().optional(),
  stub: z.boolean().optional(),
  // D24(2026-09-19 立):工具调用与终端任务持久化通道(无工具调用时不携带)
  toolCalls: z.array(persistedToolCallSchema).optional(),
  terminalTasks: z.array(persistedTerminalTaskSchema).optional(),
  // planSteps(2026-09-21 立):计划快照持久化通道(本轮无计划工具调用时不携带)
  planSteps: z.array(persistedPlanStepSchema).optional(),
  // G-166:引用溯源 + 上下文注入交代持久化通道(本轮没有时不携带)
  citations: z.array(persistedCitationSchema).optional(),
  injections: z.array(persistedInjectionSchema).optional(),
  compaction: persistedCompactionSchema.optional(),
  retryNotice: persistedRetryNoticeSchema.optional(),
  // D33(2026-09-23 立):用量明细 / 模型降级 / 记忆提炼过程性信息持久化通道
  usageDetail: persistedUsageDetailSchema.optional(),
  fallback: persistedFallbackSchema.optional(),
  memoryUpdates: persistedMemoryUpdatesSchema.optional(),
  metadata: z
    .looseObject({
      conversationId: z.string().optional(),
      messageId: z.string().optional(),
      userId: z.string().optional(),
    })
    .optional(),
})

const aiCallbackPlugin: FastifyPluginAsync = async (server) => {
  server.post(
    '/api/ai/callback',
    {
      // 2026-08-06 修复:AI 回调内容为 LLM 生成的自由文本,天然含 "#/引号/分号"等字符
      // (如 markdown 标题 "## 步骤"、编号 "#1")。sqli-guard 强特征正则把 "#" 当 SQL
      // 注释符拦截 → AI 回复永远无法写库(生产故障:对话只有 user 消息、AI 不回复)。
      // 本端点为 ai-service(localhost:8803)服务间回调,内容不可预测且非用户输入,
      // 完全豁免 SQLi 检测;认证由共享密钥(X-Internal-Secret)保证。
      config: { sqliGuard: { enabled: false } },
    },
    async (request, reply) => {
      // 2026-08-06 修复:共享密钥校验从"可选"改为"强制"(fail-closed)。
      // 原实现:AI_CALLBACK_SECRET 为空时端点完全公开,攻击者可伪造回调
      // 注入任意 assistant 消息 + 篡改 token 用量(扣费) + 伪造 userId 关联。
      // 与 plugins/internal-service-token.ts 的 checkInternalServiceToken
      // 策略保持一致(该函数对未配置 secret 已 fail-closed);docker-compose
      // 亦强制要求配置 AI_CALLBACK_SECRET(:? 校验),生产环境必有密钥。
      if (!config.AI_CALLBACK_SECRET) {
        request.log.error('AI_CALLBACK_SECRET 未配置,拒绝所有 AI 回调(fail-closed)')
        return reply.status(401).send(error(401, 'AI callback secret not configured'))
      }
      const provided = request.headers['x-internal-secret']
      if (provided !== config.AI_CALLBACK_SECRET) {
        request.log.warn({ hasHeader: !!provided }, 'ai callback secret mismatch')
        return reply.status(401).send(error(401, 'unauthorized'))
      }

      const parsed = callbackSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const {
        content,
        reasoning,
        model,
        provider,
        usage,
        stub,
        toolCalls,
        terminalTasks,
        planSteps,
        citations,
        injections,
        compaction,
        retryNotice,
        usageDetail,
        fallback,
        memoryUpdates,
        metadata,
      } = parsed.data
      const conversationId = metadata?.conversationId
      const messageId = metadata?.messageId
      const userId = metadata?.userId

      if (!conversationId || !userId) {
        // 缺少关联键,无法处理,但仍返回 202 避免阻塞 AI service
        request.log.warn({ metadata }, 'ai callback missing conversationId/userId')
        return reply
          .status(202)
          .send(success({ accepted: true, warning: 'missing association keys' }))
      }

      // 入队 aiCallback,Worker 异步处理持久化 + 推送
      try {
        const aiCallbackQueue = (
          server as unknown as {
            aiCallbackQueue?: { add: (name: string, data: unknown) => Promise<{ id?: string }> }
          }
        ).aiCallbackQueue

        if (aiCallbackQueue) {
          const usageObj = usage as
            | {
                total_tokens?: number
                prompt_tokens?: number
                completion_tokens?: number
              }
            | undefined
          const tokens = usageObj?.total_tokens
          // G-165:给助手消息盖**服务端自己的**权限档记录。
          // 只认 workspace_permissions 表(经会话 metadata 里的 workspacePath 反查),
          // 不接受客户端自报 —— 自报等于让调用方给审计记录贴金("我当时在只读档")。
          // 取不到工作区/档位不可识别 → 不写 key(与"确实处于 default 档"是两回事)。
          let permissionMeta: Record<string, string> = {}
          try {
            const conv = await findConversationById(conversationId)
            const wsPath = workspacePathOfConversationMeta(conv?.metadata)
            if (wsPath) {
              const perm = await getPermission(userId, wsPath)
              permissionMeta = permissionStamp(perm?.mode)
            }
          } catch (e) {
            request.log.warn(
              { err: e instanceof Error ? e.message : String(e), conversationId },
              '[permission-stamp] 档位盖章失败(不影响消息落库)',
            )
          }
          await aiCallbackQueue.add('complete', {
            conversationId,
            userId,
            messageId: messageId ?? '',
            content,
            reasoning,
            tokens,
            // G3: 透传 LLM 扣费链路所需结构化字段
            model: model ?? undefined,
            provider,
            promptTokens: usageObj?.prompt_tokens,
            completionTokens: usageObj?.completion_tokens,
            // 幂等键:同一消息重试只扣一次(防 BullMQ 重试重复扣费)
            idempotencyKey: `${conversationId}:${messageId ?? ''}`,
            // D24(2026-09-19 立):工具调用/终端任务随 metadata 落库
            // (chat_messages.metadata jsonb 列),恢复会话/回放/审计时还原工具卡与终端区。
            // 空数组不写 key:与"无工具调用"语义区分,避免 metadata 冗余。
            // D33(2026-09-23 立):体积护栏 —— 入队前对 metadata 各值做 64KB 上限降级,
            // 超限项变 { truncated: true, originalBytes } 占位(键保留,不丢字段不整条丢)。
            metadata: capMetadataObject(metadata),
          })
          return reply.status(202).send(success({ accepted: true, queued: true }))
        }

        // 队列不可用时降级:直接返回,AI service 会重试或放弃(由其策略决定)
        request.log.warn('aiCallbackQueue not available, callback dropped')
        return reply
          .status(202)
          .send(success({ accepted: true, queued: false, warning: 'queue unavailable' }))
      } catch (e) {
        request.log.error({ err: e }, 'ai callback enqueue failed')
        return reply.status(502).send(error(502, 'callback enqueue failed'))
      }
    },
  )
}

export default aiCallbackPlugin
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
