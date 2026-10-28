// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D30 第三腿:代码扫描告警信源(2026-09-25,用户已批准无人值守修复闭环对外)。
 * GitHub 原生 `code_scanning_alert` 事件进 POST /api/webhooks/github,与 issues/push 同一条
 * 原生事件链(HMAC + delivery 幂等 + 规则匹配),只认三态:
 * created / appeared_in_branch / reopened(fixed 与 closed_by_user 是收敛方向,不唤起修复)。
 *
 * 断言四件事,缺一即假绿:
 *  1. 合法签名 + 三态之一 + 规则命中 ⇒ fired=1 且 prompt 里真的注入了 {{title}}/{{url}};
 *  2. fixed / closed_by_user ⇒ action_not_watched,fire 一次都不调(**未发出**那条断言);
 *  3. 规则不匹配 ⇒ no_matching_trigger(信源可达但没人认领,不误触发);
 *  4. 超长规则描述被截到 300 字符档(与 ci_failed/gate_failed 的 summary 同档,防 prompt 爆)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { createHmac } from 'node:crypto'
import type { AgentEventTrigger } from '@ihui/database'
import * as triggerService from '../src/services/agent-event-trigger.js'

const h = vi.hoisted(() => ({
  secret: 'scan-alert-test-secret-value',
  rows: [] as AgentEventTrigger[],
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => Promise.resolve(h.rows) }) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve(undefined) }) }),
  },
}))
vi.mock('../src/config/index.js', () => ({
  config: {
    get GITHUB_WEBHOOK_SECRET() {
      return h.secret
    },
  },
}))
// 部分 mock:纯函数(matchTriggers/buildTriggerPrompt/deliveryDedup)走真实实现,
// 只把副作用出口换成 spy —— 断言的正是"路由真的调了它",不是另造一份等价逻辑。
vi.mock('../src/services/agent-event-trigger.js', async (importOriginal) => {
  const actual = await importOriginal<typeof triggerService>()
  return { ...actual, fireEventTriggerAsync: vi.fn() }
})
vi.mock('../src/services/agent-runtime-stream.js', () => ({
  captureAgentRuntimeStream: vi.fn(),
}))

import githubWebhookRoutes from '../src/routes/github-webhook.js'

const REPO = 'IHUI-INF-AI/IHUI-AI'
const fireSpy = vi.mocked(triggerService.fireEventTriggerAsync)

function scanRule(overrides: Partial<AgentEventTrigger> = {}): AgentEventTrigger {
  const now = new Date('2026-09-26T00:00:00.000Z')
  return {
    id: 'trig-scan-1',
    userId: 'user-1',
    repoFullName: REPO,
    event: 'code_scanning_alert',
    action: {
      prompt: '修复扫描告警:{{title}} 详情 {{url}} @ {{repo}}',
      mode: 'auto',
      agentId: 'bot-1',
    },
    enabled: 'true',
    lastFiredAt: null,
    lastResult: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function scanPayload(
  action: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    action,
    repository: { full_name: REPO },
    sender: { login: 'code-scanning-bot' },
    alert: {
      rule: { id: 'js/sql-injection', description: 'SQL query built from user-controlled sources' },
      html_url: `https://github.com/${REPO}/security/code-scanning/42`,
    },
    ...overrides,
  }
}

describe('D30 第三腿:code_scanning_alert 信源', () => {
  let server: FastifyInstance
  let seq = 0

  beforeAll(async () => {
    server = Fastify({ logger: false })
    await server.register(githubWebhookRoutes, { prefix: '/api/webhooks' })
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
  })
  beforeEach(() => {
    h.rows.length = 0
    fireSpy.mockClear()
  })

  function deliver(action: string, payloadOverrides: Record<string, unknown> = {}, signed = true) {
    const body = JSON.stringify(scanPayload(action, payloadOverrides))
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-github-event': 'code_scanning_alert',
      'x-github-delivery': `dlv-scan-${++seq}`,
    }
    if (signed) {
      headers['x-hub-signature-256'] =
        'sha256=' + createHmac('sha256', h.secret).update(body).digest('hex')
    }
    return server.inject({ method: 'POST', url: '/api/webhooks/github', headers, payload: body })
  }

  it('created + 规则命中 ⇒ fired=1,prompt 注入 title/url', async () => {
    h.rows.push(scanRule())
    const res = await deliver('created')
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.accepted).toBe(true)
    expect(body.data.fired).toBe(1)
    expect(fireSpy).toHaveBeenCalledTimes(1)
    const fired = fireSpy.mock.calls[0]?.[0]
    expect(fired?.action.prompt).toContain('SQL query built from user-controlled sources')
    expect(fired?.action.prompt).toContain('security/code-scanning/42')
    expect(fired?.action.prompt).toContain(REPO)
    expect(fired?.action.prompt).not.toContain('{{title}}')
    expect(fired?.action.prompt).not.toContain('{{url}}')
  })

  it('appeared_in_branch / reopened 同样触发(三态语义,不是只认 created)', async () => {
    h.rows.push(scanRule())
    for (const action of ['appeared_in_branch', 'reopened']) {
      fireSpy.mockClear()
      const res = await deliver(action)
      expect(res.statusCode).toBe(200)
      expect(res.json().data.accepted).toBe(action === 'appeared_in_branch' || true)
      expect(fireSpy).toHaveBeenCalledTimes(1)
    }
  })

  it.each(['fixed', 'closed_by_user'])(
    '%s 是收敛方向 ⇒ action_not_watched 且不触发',
    async (action) => {
      h.rows.push(scanRule())
      fireSpy.mockClear()
      const res = await deliver(action)
      expect(res.statusCode).toBe(200)
      expect(res.json().data.accepted).toBe(false)
      expect(res.json().data.reason).toBe('action_not_watched')
      expect(fireSpy).not.toHaveBeenCalled()
    },
  )

  it('无匹配规则 ⇒ no_matching_trigger(可达但不误触发)', async () => {
    const res = await deliver('created')
    expect(res.statusCode).toBe(200)
    expect(res.json().data.accepted).toBe(false)
    expect(res.json().data.reason).toBe('no_matching_trigger')
    expect(fireSpy).not.toHaveBeenCalled()
  })

  it('超长规则描述截到 300 字符档(与 ci_failed summary 同档,防 prompt 爆)', async () => {
    h.rows.push(scanRule())
    const long = 'A'.repeat(1200)
    await deliver('created', { alert: { rule: { id: 'r', description: long }, html_url: 'u' } })
    const fired = fireSpy.mock.calls[0]?.[0]
    expect(fired?.action.prompt).toContain('A'.repeat(300))
    expect(fired?.action.prompt).not.toContain('A'.repeat(301))
  })

  it('签名错 ⇒ 401(信源可达不等于免验签)', async () => {
    h.rows.push(scanRule())
    const body = JSON.stringify(scanPayload('created'))
    const res = await server.inject({
      method: 'POST',
      url: '/api/webhooks/github',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'code_scanning_alert',
        'x-github-delivery': `dlv-bad-${++seq}`,
        'x-hub-signature-256': 'sha256=deadbeef',
      },
      payload: body,
    })
    expect(res.statusCode).toBe(401)
    expect(fireSpy).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
