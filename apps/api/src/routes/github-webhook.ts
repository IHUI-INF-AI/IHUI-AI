// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GitHub 事件唤醒 webhook 接收器(2026-09-08 立)。
 *
 * 挂载前缀:/api/webhooks(本仓库已有通用 webhook-trigger 机制,本路由仅新增 /github 子路径,
 * 不与其冲突);端点 POST /github。
 *
 * 闭环(复检报告缺口 #5):
 *   GitHub webhook → 本端点(HMAC-SHA256 真校验)
 *     → 按 (repo,event,action) 匹配 agent_event_triggers 规则
 *     → 命中则复用现有 agent-runtime 执行器自动创建一次 agent 运行
 *     → 结果落 lastFiredAt / lastResult(失败不重试)。
 *
 * 安全面(本任务核心):
 * - GITHUB_WEBHOOK_SECRET 未配置 → 503 拒绝,绝不降级放行。
 * - 签名校验失败 → 401 + 审计日志,secret 绝不写入日志。
 * - 用 X-GitHub-Delivery 头幂等去重,重复投递直接跳过。
 *
 * D30① 追加(2026-09-26):x-github-event 为 ci_failed / gate_failed 时走
 * handleUnattendedIntake —— 同一条 HMAC 鉴权链(不新造匿名端点),入队前再经
 * 服务层 4h 风暴闸 intakeStormGuard;GitHub 事件白名单 WATCHED_EVENTS 不含这两个 kind,
 * 故必须显式分流,否则投递会被判 unsupported_event 丢弃。
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { agentEventTriggers } from '@ihui/database'
import { config } from '../config/index.js'
import { success, error } from '../utils/response.js'
import {
  verifyGitHubSignature,
  matchTriggers,
  buildTriggerPrompt,
  deliveryDedup,
  fireEventTriggerAsync,
  isUnattendedIntakeKind,
  parseUnattendedIntake,
  buildIntakePromptCtx,
  intakeStormGuard,
  type GitHubEventName,
  type UnattendedIntakeKind,
} from '../services/agent-event-trigger.js'

/** GitHub 支持的事件名(本服务订阅子集) */
const WATCHED_EVENTS: GitHubEventName[] = ['pull_request', 'issues', 'push']

/** 判断某事件的 action 是否命中订阅(未列出的 action 忽略,不触发) */
function isActionWatched(event: GitHubEventName, action: string | undefined): boolean {
  if (event === 'pull_request') return action === 'opened' || action === 'synchronize'
  if (event === 'issues') return action === 'opened'
  if (event === 'push') return true // push 无 action 维度
  return false
}

/**
 * parseUnattendedIntake 的 errors 形如 `字段路径: 说明`(或 `kind_mismatch: header=… body=…`)。
 * 响应只回**字段名**,不回说明原文 —— 说明里可能带上模型/CI 传来的取值,而错误响应会被
 * CI 打印、也可能进日志,不得成为请求体的回显通道。
 */
function intakeInvalidFields(errors: readonly string[]): string[] {
  return [...new Set(errors.map((e) => e.split(': ')[0] ?? e))]
}

/**
 * D30① 无人值守修复信源入队(ci_failed / gate_failed)—— 本函数是那条链的**投递入口**。
 *
 * 鉴权零放宽:只在 handler 的 HMAC 校验通过之后被调用(缺 secret → 503、签名不过 → 401
 * 两道分支都在它之前),没有白名单、没有匿名路径。
 *
 * 幂等与去重各只有一份实现:投递级沿用既有 deliveryDedup(X-GitHub-Delivery),
 * 风暴窗口沿用服务层单例 intakeStormGuard(4h,内部即 shouldAcceptIntake),
 * 此处不再抄第三套窗口逻辑。顺序刻意把风暴闸放在"匹配到规则"之后 ——
 * 没匹配到规则就没有入队,不该占用该 (kind,repo,sha,job) 的 4h 额度。
 */
async function handleUnattendedIntake(
  kind: UnattendedIntakeKind,
  payload: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const parsed = parseUnattendedIntake(kind, payload)
  if (!parsed.ok) {
    const fields = intakeInvalidFields(parsed.errors)
    request.log.warn({ kind, fields }, '[github-webhook] 信源入参校验失败')
    return reply.status(400).send(error(400, `payload 校验失败: ${fields.join(', ')}`))
  }
  const { data, dedupKey } = parsed

  const delivery = (request.headers['x-github-delivery'] as string | undefined) ?? ''
  if (delivery && !deliveryDedup.record(delivery)) {
    request.log.info({ delivery }, '[github-webhook] 重复投递,跳过')
    return reply.send(success({ accepted: false, reason: 'duplicate_delivery', delivery }))
  }

  const candidates = await db
    .select()
    .from(agentEventTriggers)
    .where(and(eq(agentEventTriggers.repoFullName, data.repo), eq(agentEventTriggers.event, kind)))
  const matched = matchTriggers(data.repo, kind, candidates)
  if (matched.length === 0) {
    return reply.send(
      success({ accepted: false, reason: 'no_matching_trigger', repo: data.repo, event: kind }),
    )
  }

  if (!intakeStormGuard.accept(dedupKey)) {
    request.log.info({ dedupKey }, '[github-webhook] 窗口内重复信源,跳过入队')
    return reply.send(success({ accepted: false, reason: 'intake_window_dedup', dedupKey }))
  }

  const ctx = buildIntakePromptCtx(data)
  for (const trigger of matched) {
    const rendered = {
      ...trigger,
      action: { ...trigger.action, prompt: buildTriggerPrompt(trigger.action, ctx) },
    }
    fireEventTriggerAsync(rendered, request, request.log)
  }

  request.log.info(
    { repo: data.repo, event: kind, fired: matched.length, commitSha: data.commitSha },
    '[github-webhook] 无人值守修复信源已入队',
  )
  return reply.send(
    success({ accepted: true, fired: matched.length, repo: data.repo, event: kind, dedupKey }),
  )
}

const githubWebhookRoutes: FastifyPluginAsync = async (server) => {
  // 本插件作用域内覆盖 application/json 解析器,使 request.body 保留原始字符串
  // (HMAC 基于原始字节,不能先被 Fastify 解析成对象再 JSON.stringify —— 空白/键序可能不一致)。
  server.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body)
  })

  server.post('/github', async (request, reply) => {
    // 1) secret 未配置 → 503 拒绝(安全底线,绝不降级放行)
    const secret = config.GITHUB_WEBHOOK_SECRET
    if (!secret) {
      request.log.warn('[github-webhook] GITHUB_WEBHOOK_SECRET 未配置,拒绝接收 webhook')
      return reply.status(503).send(error(503, 'webhook secret 未配置'))
    }

    // 2) 读取原始 body 字符串(签名校验基于原始字节)
    const rawBody =
      typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {})

    // 3) HMAC-SHA256 真校验;失败 → 401 + 审计日志(secret 绝不入日志)
    const sigHeader = request.headers['x-hub-signature-256'] as string | undefined
    if (!verifyGitHubSignature(rawBody, sigHeader, secret)) {
      request.log.warn(
        { delivery: request.headers['x-github-delivery'], ip: request.ip },
        '[github-webhook] 签名校验失败',
      )
      return reply.status(401).send(error(401, '签名校验失败'))
    }

    // 4) 解析 payload
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      return reply.status(400).send(error(400, 'payload 非合法 JSON'))
    }

    const eventName = (request.headers['x-github-event'] as string | undefined) ?? ''

    // 4b) D30① 信源分支:ci_failed / gate_failed 不经 GitHub 事件白名单,
    //     单独走"无人值守修复入队"(位置在 HMAC 之后 ⇒ 鉴权面与既有事件完全一致)。
    if (isUnattendedIntakeKind(eventName)) {
      return handleUnattendedIntake(eventName, payload, request, reply)
    }

    if (!WATCHED_EVENTS.includes(eventName as GitHubEventName)) {
      return reply.send(success({ accepted: false, reason: 'unsupported_event', event: eventName }))
    }

    const repo = (payload.repository as { full_name?: string } | undefined)?.full_name
    if (!repo) {
      return reply.send(success({ accepted: false, reason: 'no_repository' }))
    }

    const action = (payload.action as string | undefined) ?? undefined
    if (!isActionWatched(eventName as GitHubEventName, action)) {
      return reply.send(
        success({ accepted: false, reason: 'action_not_watched', event: eventName, action }),
      )
    }

    // 5) 幂等去重:X-GitHub-Delivery 头(每次投递唯一)
    const delivery = (request.headers['x-github-delivery'] as string | undefined) ?? ''
    if (delivery && !deliveryDedup.record(delivery)) {
      request.log.info({ delivery }, '[github-webhook] 重复投递,跳过')
      return reply.send(success({ accepted: false, reason: 'duplicate_delivery', delivery }))
    }

    // 6) 加载候选规则,按 (repo,event) 匹配并过滤启用中
    const candidates = await db
      .select()
      .from(agentEventTriggers)
      .where(
        and(eq(agentEventTriggers.repoFullName, repo), eq(agentEventTriggers.event, eventName)),
      )
    const matched = matchTriggers(repo, eventName, candidates)
    if (matched.length === 0) {
      return reply.send(
        success({ accepted: false, reason: 'no_matching_trigger', repo, event: eventName }),
      )
    }

    // 7) 触发匹配到的规则(复用现有 agent-runtime 执行器,fire-and-forget)
    const ctx: Record<string, string> = {
      repo,
      sender: (payload.sender as { login?: string } | undefined)?.login ?? '',
      action: action ?? '',
      branch: (payload.ref as string | undefined) ?? '',
    }
    for (const trigger of matched) {
      const rendered = {
        ...trigger,
        action: { ...trigger.action, prompt: buildTriggerPrompt(trigger.action, ctx) },
      }
      fireEventTriggerAsync(rendered, request as FastifyRequest, request.log)
    }

    request.log.info(
      { repo, event: eventName, action, fired: matched.length },
      '[github-webhook] 已触发事件唤醒',
    )
    return reply.send(
      success({ accepted: true, fired: matched.length, repo, event: eventName, action }),
    )
  })
}

export default githubWebhookRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
