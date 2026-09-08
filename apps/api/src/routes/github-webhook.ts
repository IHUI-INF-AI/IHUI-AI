// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

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
 */
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
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
  type GitHubEventName,
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
// ⁠[IHUI-AI-PROVENANCE] github-webhook · IHUI AI (智汇AI) · 李春川 · aizhs.top
