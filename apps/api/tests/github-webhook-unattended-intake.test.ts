// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D30① 投递入口接线回归:CI/守门失败信源经既有 HMAC 鉴权路由 POST /api/webhooks/github
// → 真的调用 fireEventTriggerAsync 入队;窗口内重复由 intakeStormGuard 吞掉且不再入队。
// 全程 mock DB / 执行器 / config,零真实连接(§5 测试隔离铁律)。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { createHmac } from 'node:crypto'
import type { AgentEventTrigger } from '@ihui/database'
import * as triggerService from '../src/services/agent-event-trigger.js'

// 可变夹具:hoisted 供 vi.mock 工厂闭包引用(mock 工厂会被提升到 import 之前求值)。
const h = vi.hoisted(() => ({
  rows: [] as AgentEventTrigger[],
  secret: 'whsec_wiring_test',
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => Promise.resolve(h.rows) }) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve(undefined) }) }),
  },
}))

// config 用 getter 取当前值 ⇒ 同一文件里可分别验「缺 secret」与「secret 在位」。
vi.mock('../src/config/index.js', () => ({
  config: {
    get GITHUB_WEBHOOK_SECRET() {
      return h.secret
    },
  },
}))

// 部分 mock:保留纯函数/去重容器的真实实现,只把"副作用出口"换成可断言的 spy ——
// 断言的正是"路由真的调了它",而不是另造一份等价逻辑。
vi.mock('../src/services/agent-event-trigger.js', async (importOriginal) => {
  const actual = await importOriginal<typeof triggerService>()
  return { ...actual, fireEventTriggerAsync: vi.fn() }
})
vi.mock('../src/services/agent-runtime-stream.js', () => ({
  captureAgentRuntimeStream: vi.fn(),
}))

import githubWebhookRoutes from '../src/routes/github-webhook.js'

const REPO = 'IHUI-INF-AI/IHUI-AI'
const BASE = '/api/webhooks'
const fireSpy = vi.mocked(triggerService.fireEventTriggerAsync)

function makeTrigger(overrides: Partial<AgentEventTrigger> = {}): AgentEventTrigger {
  const now = new Date('2026-09-26T00:00:00.000Z')
  return {
    id: 'trig-ci-1',
    userId: 'user-1',
    repoFullName: REPO,
    event: 'ci_failed',
    action: {
      prompt: '[{{kind}}] {{job}} @ {{commitSha}} run={{runUrl}} :: {{summary}} gid={{guardianId}}',
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

async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({ logger: false })
  await server.register(githubWebhookRoutes, { prefix: BASE })
  return server
}

function sign(body: string, secret: string = h.secret): string {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`
}

/** 以 CI workflow 的形态投递:签名基于原始字节,body 只 stringify 一次 */
async function deliver(
  server: FastifyInstance,
  event: string,
  payload: unknown,
  delivery: string,
  opts: { secret?: string; signed?: boolean } = {},
) {
  const body = JSON.stringify(payload)
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-github-event': event,
    'x-github-delivery': delivery,
  }
  if (opts.signed !== false) headers['x-hub-signature-256'] = sign(body, opts.secret ?? h.secret)
  return server.inject({ method: 'POST', url: `${BASE}/github`, headers, payload: body })
}

function ciFailedPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'ci_failed',
    repo: REPO,
    workflow: 'CI (Monorepo)',
    job: 'typecheck',
    commitSha: 'A1b2C3D4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
    runUrl: 'https://github.com/IHUI-INF-AI/IHUI-AI/actions/runs/12345',
    summary: 'pnpm --filter @ihui/api typecheck exited with code 2',
    ...overrides,
  }
}

function gateFailedPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'gate_failed',
    repo: REPO,
    workflow: 'unattended-fix-intake',
    job: 'guardian-full',
    commitSha: 'DEADBEEF1234567',
    guardianId: '77',
    runUrl: 'https://github.com/IHUI-INF-AI/IHUI-AI/actions/runs/999',
    summary: 'guardian-runner 全量 1 道门失败:check-radius-single-source',
    ...overrides,
  }
}

/** 取第 n 次入队的实参;缺位即当场失败,而不是把 undefined 交给后续断言(那会伪装成"通过") */
function firedTriggerAt(nth: number): AgentEventTrigger {
  const call = fireSpy.mock.calls[nth]
  if (!call)
    throw new Error(`执行器第 ${nth + 1} 次入队未发生(实际共 ${fireSpy.mock.calls.length} 次)`)
  return call[0]
}

beforeEach(() => {
  // 两个单例跨用例存活 ⇒ 必须显式复位,否则上一条用例的窗口会把下一条判成"重复"
  triggerService.intakeStormGuard.clear()
  triggerService.deliveryDedup.clear()
  h.rows = [makeTrigger()]
  h.secret = 'whsec_wiring_test'
  fireSpy.mockClear()
})

describe('D30① 投递入口接线:ci_failed 真的入队', () => {
  it('合法 ci_failed 投递 → HTTP 200 + accepted:true + 执行器被调用一次', async () => {
    const server = await buildServer()
    const res = await deliver(server, 'ci_failed', ciFailedPayload(), 'dlv-1')
    await server.close()

    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ accepted: true, fired: 1, event: 'ci_failed' })
    expect(fireSpy).toHaveBeenCalledTimes(1)
  })

  it('入队载荷带的是渲染后的 prompt(占位符已替换、sha 已归一小写)', async () => {
    const server = await buildServer()
    await deliver(server, 'ci_failed', ciFailedPayload(), 'dlv-2')
    await server.close()

    expect(fireSpy).toHaveBeenCalledTimes(1)
    const prompt = firedTriggerAt(0).action.prompt
    expect(firedTriggerAt(0).id).toBe('trig-ci-1')
    expect(firedTriggerAt(0).event).toBe('ci_failed')
    expect(prompt).toContain('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0')
    expect(prompt).toContain('typecheck')
    expect(prompt).toContain('actions/runs/12345')
    expect(prompt).toContain('exited with code 2')
    expect(prompt).not.toContain('{{commitSha}}')
  })

  it('gate_failed 入队且 {{guardianId}} 被渲染(守门项名可点名)', async () => {
    h.rows = [makeTrigger({ id: 'trig-gate-1', event: 'gate_failed' })]
    const server = await buildServer()
    const res = await deliver(server, 'gate_failed', gateFailedPayload(), 'dlv-3')
    await server.close()

    expect(res.json().data).toMatchObject({ accepted: true, fired: 1, event: 'gate_failed' })
    const trigger = firedTriggerAt(0)
    expect(trigger.id).toBe('trig-gate-1')
    expect(trigger.action.prompt).toContain('gid=77')
  })
})

describe('D30① 投递入口接线:风暴窗口只吞重复、不吞首投', () => {
  it('同 (kind,repo,sha,job) 换 deliveryId 再投 → 被 intakeStormGuard 吞掉且不再入队', async () => {
    const server = await buildServer()
    const first = await deliver(server, 'ci_failed', ciFailedPayload(), 'dlv-a')
    const second = await deliver(server, 'ci_failed', ciFailedPayload(), 'dlv-b')
    await server.close()

    expect(first.json().data).toMatchObject({ accepted: true })
    // 幂等闸放行(不同 deliveryId),真正拦住的是风暴闸 ⇒ 归因可查
    expect(second.json().data).toMatchObject({ accepted: false, reason: 'intake_window_dedup' })
    expect(fireSpy).toHaveBeenCalledTimes(1)
  })

  it('去重键按 (kind,repo,sha,job) 逐条算:job 不同则各自入队,不会互相压制', async () => {
    const server = await buildServer()
    const typecheck = await deliver(server, 'ci_failed', ciFailedPayload(), 'dlv-c')
    const lint = await deliver(server, 'ci_failed', ciFailedPayload({ job: 'lint' }), 'dlv-d')
    await server.close()

    const keyOf = (res: { json: () => { data?: unknown } }): string =>
      (res.json().data as { dedupKey: string }).dedupKey
    expect(lint.json().data).toMatchObject({ accepted: true })
    expect(keyOf(lint)).not.toBe(keyOf(typecheck))
    expect(fireSpy).toHaveBeenCalledTimes(2)
  })

  it('没有匹配规则时不占窗口额度(配好规则后同 sha 仍能入队)', async () => {
    h.rows = []
    const server = await buildServer()
    const none = await deliver(server, 'ci_failed', ciFailedPayload(), 'dlv-e')
    expect(none.json().data).toMatchObject({ accepted: false, reason: 'no_matching_trigger' })
    expect(fireSpy).toHaveBeenCalledTimes(0)

    h.rows = [makeTrigger()]
    const after = await deliver(server, 'ci_failed', ciFailedPayload(), 'dlv-f')
    await server.close()

    expect(after.json().data).toMatchObject({ accepted: true })
    expect(fireSpy).toHaveBeenCalledTimes(1)
  })

  it('同 deliveryId 重投仍走既有幂等闸(与风暴闸各一份实现,不互抄)', async () => {
    const server = await buildServer()
    await deliver(server, 'ci_failed', ciFailedPayload(), 'dlv-same')
    const dup = await deliver(server, 'ci_failed', ciFailedPayload(), 'dlv-same')
    await server.close()

    expect(dup.json().data).toMatchObject({ accepted: false, reason: 'duplicate_delivery' })
    expect(fireSpy).toHaveBeenCalledTimes(1)
  })
})

describe('D30① 鉴权零放宽:新分支不得成为免签入口', () => {
  it('签名错误 → 401 且执行器一次都没被调用', async () => {
    const server = await buildServer()
    const res = await deliver(server, 'ci_failed', ciFailedPayload(), 'dlv-x', {
      secret: 'wrong-secret',
    })
    await server.close()

    expect(res.statusCode).toBe(401)
    expect(fireSpy).toHaveBeenCalledTimes(0)
  })

  it('无签名头 → 401(缺 secret 也不会降级为放行)', async () => {
    const server = await buildServer()
    const res = await deliver(server, 'ci_failed', ciFailedPayload(), 'dlv-y', { signed: false })
    await server.close()

    expect(res.statusCode).toBe(401)
    expect(fireSpy).toHaveBeenCalledTimes(0)
  })

  it('GITHUB_WEBHOOK_SECRET 未配置 → 503 显式失败,不入队', async () => {
    h.secret = ''
    const server = await buildServer()
    const res = await deliver(server, 'ci_failed', ciFailedPayload(), 'dlv-z')
    await server.close()

    expect(res.statusCode).toBe(503)
    expect(fireSpy).toHaveBeenCalledTimes(0)
  })
})

describe('D30① strict 入参与不回显请求体', () => {
  it('未知字段 → 400 拒收,且请求体原文不出现在响应里', async () => {
    const server = await buildServer()
    const res = await deliver(
      server,
      'ci_failed',
      ciFailedPayload({ evilExtra: 'SENTINEL-must-not-be-echoed', summary: 'SENTINEL-body-value' }),
      'dlv-strict',
    )
    await server.close()

    // 该型下服务层给的路径是 (root)(zod unrecognized_keys 的 issue.path 为空),
    // 于是响应只到"校验失败"这一格 —— 点名具体未知键属服务层待办,不在本票清单内。
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ code: 400 })
    expect(res.body).not.toContain('SENTINEL-must-not-be-echoed')
    expect(res.body).not.toContain('SENTINEL-body-value')
    expect(fireSpy).toHaveBeenCalledTimes(0)
  })

  it('commitSha 非十六进制 → 400 点名该字段,不回显原值', async () => {
    const server = await buildServer()
    const res = await deliver(
      server,
      'ci_failed',
      ciFailedPayload({ commitSha: 'zzz-not-a-sha' }),
      'dlv-sha',
    )
    await server.close()

    expect(res.statusCode).toBe(400)
    expect(res.body).toContain('commitSha')
    expect(res.body).not.toContain('zzz-not-a-sha')
    expect(fireSpy).toHaveBeenCalledTimes(0)
  })

  it('头 kind 与体 kind 不一致 → 400 kind_mismatch(不允许头/体两套真相)', async () => {
    const server = await buildServer()
    const res = await deliver(server, 'ci_failed', gateFailedPayload(), 'dlv-mismatch')
    await server.close()

    expect(res.statusCode).toBe(400)
    expect(res.body).toContain('kind_mismatch')
    expect(fireSpy).toHaveBeenCalledTimes(0)
  })
})

describe('D30① 既有 GitHub 事件路径不受影响', () => {
  it('白名单外事件仍判 unsupported_event(新 kind 不是万能通行证)', async () => {
    const server = await buildServer()
    const res = await deliver(
      server,
      'workflow_run',
      { repository: { full_name: REPO } },
      'dlv-gh-1',
    )
    await server.close()

    expect(res.json().data).toMatchObject({ accepted: false, reason: 'unsupported_event' })
    expect(fireSpy).toHaveBeenCalledTimes(0)
  })

  it('ci_failed 投递不再被当作 unsupported_event 丢掉(本票要接的就是这一格)', async () => {
    const server = await buildServer()
    const res = await deliver(server, 'ci_failed', ciFailedPayload(), 'dlv-gh-2')
    await server.close()

    expect(res.json().data).not.toMatchObject({ reason: 'unsupported_event' })
    expect(fireSpy).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
