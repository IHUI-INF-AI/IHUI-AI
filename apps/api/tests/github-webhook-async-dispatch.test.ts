// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Y-91(2026-11-06 立)—— webhook 应用侧长尾:async 派发行为锁。
 *
 * 票面读数:`POST /api/github-app/webhook` p95 2217ms、max 19720ms、≥10s 10 枚(n=1910 现读),
 * 而公网腿 100/100 成功、p95 1120ms、源站 /api/health p50 2ms、隧道 concurrent=0
 * ⇒ 长尾住在应用侧"handler 同步等 ai-service + GitHub API",加源站并发无效。
 * 正解 = 签名校验通过、事件判定可处理之后**先回 200**,重活进一次性内存队列。
 *
 * 本文件钉住四件事:
 * 1. 响应时间**不依赖**重活:派发节拍换成手动泵(任务在测试发泵之前一行都不跑),
 *    断言 200 已发出、而 GitHub 侧一次调用都没发生、幂等表一条都没记
 *    (全程零真实等待,禁止真等 10s)。
 * 2. 副作用**最终仍然发生**:发泵 + 放开闸门之后,transport 被调用、投递落表
 *    (二级幂等表不因异步化而漏记 —— 漏记会让重启后同一 delivery 被重放)。
 * 3. 既有同步响应形状**不回退**:预算内跑完 ⇒ `dispatch:'inline'` + 原有 `outcome` 字段;
 *    签名无效仍 401、未知事件仍 200 unsupported_event、事件体不合 schema 仍 400。
 * 4. 队列自身的死亡机制:积压满 ⇒ 路由**就地执行**(宁可慢,不静默丢活)、close 后拒新单、
 *    任务抛错不掀 worker。
 *
 * 全程注入假 transport / 假 store / 假模型,零真实连接(§5 测试隔离铁律:生产 PG 8810、
 * Redis 8811 一律不碰;options.store 显式给假实现,缺省 db 链根本不进射程)。
 */
import { describe, it, expect } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { createHmac } from 'node:crypto'
import githubAppRoutes, { WEBHOOK_PATH } from '../src/routes/github-app.js'
import { createDeliveryDeduper } from '../src/services/github-app/events.js'
import type { GithubAppStore } from '../src/services/github-app/store.js'
import type {
  GithubApiRequest,
  GithubApiResponse,
  GithubTransport,
} from '../src/services/github-app/jwt.js'
import type { TextCompletion } from '../src/services/github-app/pr-review.js'
import {
  createWebhookDispatchQueue,
  resolveResponseBudgetMs,
  DEFAULT_RESPONSE_BUDGET_MS,
  RESPONSE_BUDGET_ENV_KEY,
  type DispatchJobDescriptor,
  type WebhookDispatchQueue,
} from '../src/services/webhook-github-dispatch.js'

const SECRET = 'whsec_y91_async'
const BASE = '/api/github-app'
const REPO = 'octo/demo'
const REVIEW_JSON = JSON.stringify({
  event: 'COMMENT',
  body: '总体结论:这看着还行。',
  comments: [],
})

function sign(body: string, secret: string = SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`
}

// ---------------------------------------------------------------------------
// 夹具
// ---------------------------------------------------------------------------

function pullRequestPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    action: 'opened',
    number: 7,
    pull_request: {
      number: 7,
      title: 'feat: 示例改动',
      state: 'open',
      draft: false,
      head: { ref: 'feature/x', sha: 'abc123' },
      base: { ref: 'main', sha: 'def456' },
      user: { login: 'dev' },
      body: '描述',
    },
    repository: { full_name: REPO, name: 'demo', owner: { login: 'octo' } },
    installation: { id: 9001 },
    ...overrides,
  }
}

function issueCommentPayload(commentBody: string): Record<string, unknown> {
  return {
    action: 'created',
    issue: {
      number: 7,
      title: 'feat: 示例改动',
      state: 'open',
      pull_request: { url: `https://github.com/${REPO}/pull/7` },
    },
    comment: { id: 555, body: commentBody, user: { login: 'dev' } },
    repository: { full_name: REPO, name: 'demo' },
    installation: { id: 9001 },
  }
}

/** 假持久层:记录调用,永不碰真库 */
function fakeStore(): GithubAppStore & { recorded: Array<[string, string]>; calls: string[] } {
  const recorded: Array<[string, string]> = []
  const calls: string[] = []
  return {
    recorded,
    calls,
    async hasDelivery(deliveryId) {
      calls.push(`hasDelivery:${deliveryId}`)
      return false
    },
    async recordDelivery(deliveryId, eventType) {
      calls.push(`recordDelivery:${deliveryId}`)
      recorded.push([deliveryId, eventType])
    },
    async claimDelivery(input) {
      calls.push(`claimDelivery:${input.deliveryId}`)
      return 'claimed' as const
    },
    async settleDelivery(deliveryId, status) {
      calls.push(`settleDelivery:${deliveryId}:${status}`)
    },
    async applyInstallationEvent() {
      calls.push('applyInstallationEvent')
    },
    async listInstallations() {
      return []
    },
  }
}

/**
 * 闸门 transport:每次 GitHub 调用都吊在测试控制的 promise 上(现场 ≥10s 长尾的形状)。
 * `releaseAll()` 之后转为常开 —— 后续调用立即返回,因此 `drain()` 不会永挂。
 */
function gatedTransport(reply: GithubApiResponse = { status: 201, body: { id: 777 } }) {
  const calls: GithubApiRequest[] = []
  let open = false
  let gates: Array<() => void> = []
  const transport: GithubTransport = async (request) => {
    calls.push(request)
    if (!open) {
      await new Promise<void>((resolve) => {
        gates.push(resolve)
      })
    }
    return reply
  }
  return {
    calls,
    transport,
    releaseAll(): void {
      open = true
      const pending = gates
      gates = []
      for (const release of pending) release()
    },
  }
}

/** 立即返回的假 transport(GET diff → POST review 的真实调用序列) */
function fastTransport() {
  const calls: GithubApiRequest[] = []
  const transport: GithubTransport = async (request) => {
    calls.push(request)
    if (request.method === 'POST') return { status: 201, body: { id: 777 } }
    return {
      status: 200,
      body: [
        {
          filename: 'src/a.ts',
          status: 'modified',
          additions: 3,
          deletions: 1,
          changes: 4,
          patch: '@@ -1,3 +1,5 @@\n+const x = 1',
        },
      ],
    }
  }
  return { calls, transport }
}

/**
 * 手动泵队列:派发节拍由测试掌握。
 * 不发泵 ⇒ 任务一行都不跑,这正是"应答不等它"的最硬读数。
 */
function manualQueue(options: { maxPending?: number } = {}) {
  const ticks: Array<() => void> = []
  const queue = createWebhookDispatchQueue({
    maxPending: options.maxPending,
    schedule: (run) => {
      ticks.push(run)
    },
  })
  return {
    queue,
    /** 发泵直到没有待发节拍,再等终态(任务体里的 await 靠微任务往下走) */
    async flush(): Promise<void> {
      for (let guard = 0; guard < 100; guard += 1) {
        const pending = ticks.splice(0, ticks.length)
        if (pending.length === 0) break
        for (const tick of pending) tick()
        for (let settle = 0; settle < 20; settle += 1) await Promise.resolve()
      }
      await queue.drain()
    },
  }
}

const textModel: TextCompletion = async () => REVIEW_JSON

async function buildLeg(args: {
  transport: GithubTransport
  store: GithubAppStore | null
  dispatcher?: WebhookDispatchQueue
  responseBudgetMs?: number
  webhookSecret?: string | null
}): Promise<FastifyInstance> {
  const server = Fastify({ logger: false })
  await server.register(githubAppRoutes, {
    prefix: BASE,
    transport: args.transport,
    textModel,
    store: args.store,
    webhookSecret: args.webhookSecret === undefined ? SECRET : args.webhookSecret,
    deduper: createDeliveryDeduper(),
    dispatchQueue: args.dispatcher,
    responseBudgetMs: args.responseBudgetMs,
  })
  await server.ready()
  return server
}

async function postEvent(
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
  if (opts.signed !== false) headers['x-hub-signature-256'] = sign(body, opts.secret ?? SECRET)
  return server.inject({ method: 'POST', url: `${BASE}${WEBHOOK_PATH}`, headers, payload: body })
}

// ---------------------------------------------------------------------------
// 1) 队列单元面:节拍可注入、失败不掀 worker、有死亡机制
// ---------------------------------------------------------------------------
describe('webhook 派发队列(Y-91 器物面)', () => {
  it('budgetMs=0 ⇒ 立刻 deferred,任务不取消、随后照样跑完', async () => {
    const pump = manualQueue()
    let sideEffect = 0
    const handle = pump.queue.submit({ deliveryId: 'd1', event: 'pull_request' }, async () => {
      sideEffect += 1
      return 'done'
    })
    expect(handle.accepted).toBe(true)
    // awaitWithin(0) 一次都不等任务:纯异步档的语义就是"先回 200"
    expect(await handle.awaitWithin(0)).toEqual({ phase: 'deferred' })
    expect(sideEffect).toBe(0)
    await pump.flush()
    expect(await handle.settled).toEqual({ phase: 'completed', value: 'done' })
    expect(sideEffect).toBe(1)
  })

  it('预算内跑完 ⇒ completed + 值原样带回(同步响应形状不回退的判据)', async () => {
    const pump = manualQueue()
    const handle = pump.queue.submit({ deliveryId: 'd2', event: 'pull_request' }, async () => 42)
    const waiting = handle.awaitWithin(1000)
    await pump.flush()
    expect(await waiting).toEqual({ phase: 'completed', value: 42 })
  })

  it('任务抛错 ⇒ settled 记 failed + onError 点名,worker 仍继续接活', async () => {
    const failures: Array<{ error: unknown; job: DispatchJobDescriptor }> = []
    const queue = createWebhookDispatchQueue({
      schedule: (run) => run(),
      onError: (error, job) => failures.push({ error, job }),
    })
    const boom = new Error('上游炸了')
    const bad = queue.submit({ deliveryId: 'd3', event: 'issue_comment' }, async () => {
      throw boom
    })
    expect(await bad.settled).toEqual({ phase: 'failed', error: boom })
    expect(failures).toHaveLength(1)
    expect(failures[0]?.job.deliveryId).toBe('d3')

    const good = queue.submit({ deliveryId: 'd4', event: 'issue_comment' }, async () => 'ok')
    expect(good.accepted).toBe(true)
    expect(await good.settled).toEqual({ phase: 'completed', value: 'ok' })
  })

  it('积压满 ⇒ accepted:false + rejectReason=backlog_full(队列不会无限长大)', async () => {
    // 黑洞 schedule:第一枚永远停在 backlog ⇒ 第二枚必被拒
    const queue = createWebhookDispatchQueue({ maxPending: 1, schedule: () => {} })
    const first = queue.submit({ deliveryId: 'd5', event: 'pull_request' }, async () => 'x')
    expect(first.accepted).toBe(true)
    expect(first.depthAfterSubmit).toBe(1)
    const second = queue.submit({ deliveryId: 'd6', event: 'pull_request' }, async () => 'y')
    expect(second.accepted).toBe(false)
    expect(second.rejectReason).toBe('backlog_full')
    expect(queue.depth()).toBe(1)
  })

  it('close() 后只拒新单(closed),在跑的仍能 drain 干净', async () => {
    const queue = createWebhookDispatchQueue({ schedule: (run) => run() })
    let finished = 0
    const job = queue.submit({ deliveryId: 'd7', event: 'pull_request' }, async () => {
      finished += 1
    })
    queue.close()
    expect(queue.closed).toBe(true)
    const after = queue.submit({ deliveryId: 'd8', event: 'pull_request' }, async () => 'never')
    expect(after.accepted).toBe(false)
    expect(after.rejectReason).toBe('closed')
    await queue.drain()
    expect(finished).toBe(1)
    expect(job.depthAfterSubmit).toBeGreaterThanOrEqual(1)
  })

  it('应答预算读数:坏值不猜,一律回落缺省档', () => {
    expect(resolveResponseBudgetMs({})).toBe(DEFAULT_RESPONSE_BUDGET_MS)
    expect(resolveResponseBudgetMs({ [RESPONSE_BUDGET_ENV_KEY]: '0' })).toBe(0)
    expect(resolveResponseBudgetMs({ [RESPONSE_BUDGET_ENV_KEY]: '1500' })).toBe(1500)
    expect(resolveResponseBudgetMs({ [RESPONSE_BUDGET_ENV_KEY]: '-5' })).toBe(
      DEFAULT_RESPONSE_BUDGET_MS,
    )
    expect(resolveResponseBudgetMs({ [RESPONSE_BUDGET_ENV_KEY]: 'abc' })).toBe(
      DEFAULT_RESPONSE_BUDGET_MS,
    )
  })
})

// ---------------------------------------------------------------------------
// 2) 路由面:响应时间不依赖重活,而副作用最终发生
// ---------------------------------------------------------------------------
describe('github-app 腿:先回 200 再异步处理(Y-91 主命题)', () => {
  it('pull_request 重活未起跑:200 已发出,GitHub 零调用、幂等表零记录', async () => {
    const gate = gatedTransport()
    const store = fakeStore()
    const pump = manualQueue()
    const server = await buildLeg({
      transport: gate.transport,
      store,
      dispatcher: pump.queue,
      responseBudgetMs: 0,
    })

    const startedAt = performance.now()
    const response = await postEvent(server, 'pull_request', pullRequestPayload(), 'd-async')
    const elapsedMs = performance.now() - startedAt

    expect(response.statusCode).toBe(200)
    expect(response.json().data).toMatchObject({
      accepted: true,
      event: 'pull_request',
      dispatch: 'async',
    })
    // 断言的是"应答不等它":节拍一次都没发,长尾再长也追不上这条响应
    expect(gate.calls).toHaveLength(0)
    expect(store.recorded).toHaveLength(0)
    expect(elapsedMs).toBeLessThan(200)

    // 发泵 + 放开闸门 ⇒ 副作用最终发生,且二级幂等表照记(异步化不得漏记)
    gate.releaseAll()
    await pump.flush()
    expect(gate.calls.length).toBeGreaterThan(0)
    expect(store.recorded).toEqual([['d-async', 'pull_request']])
    await server.close()
  })

  it('issue_comment 提到机器人时:同样先 200,mention 处理在队列内跑完', async () => {
    const gate = gatedTransport()
    const store = fakeStore()
    const pump = manualQueue()
    const server = await buildLeg({
      transport: gate.transport,
      store,
      dispatcher: pump.queue,
      responseBudgetMs: 0,
    })

    const response = await postEvent(
      server,
      'issue_comment',
      issueCommentPayload('@ihui-ai-bot 帮我看下这次改动的风险'),
      'd-comment',
    )
    expect(response.statusCode).toBe(200)
    expect(response.json().data).toMatchObject({
      accepted: true,
      event: 'issue_comment',
      dispatch: 'async',
    })
    expect(gate.calls).toHaveLength(0)

    gate.releaseAll()
    await pump.flush()
    expect(gate.calls.length).toBeGreaterThan(0)
    expect(store.recorded).toEqual([['d-comment', 'issue_comment']])
    await server.close()
  })

  it('默认预算档:轻任务仍在预算内同步回话,outcome 字段照旧在', async () => {
    const fast = fastTransport()
    const store = fakeStore()
    const server = await buildLeg({ transport: fast.transport, store })

    const response = await postEvent(server, 'pull_request', pullRequestPayload(), 'd-inline')
    expect(response.statusCode).toBe(200)
    const data = response.json().data as Record<string, unknown>
    expect(data['dispatch']).toBe('inline')
    expect(data['accepted']).toBe(true)
    expect(data['outcome']).toBeTypeOf('object')
    // 同步档:应答发出时副作用已经落地
    expect(fast.calls.length).toBeGreaterThan(0)
    expect(store.recorded).toEqual([['d-inline', 'pull_request']])
    await server.close()
  })

  it('队列拒收(积压满)⇒ 就地执行:宁可慢,绝不静默丢活', async () => {
    const fast = fastTransport()
    const store = fakeStore()
    // 黑洞 schedule + maxPending=1 ⇒ 占位单永远停在 backlog,路由这单必被拒
    const saturated = createWebhookDispatchQueue({ maxPending: 1, schedule: () => {} })
    void saturated.submit({ deliveryId: 'blocker', event: 'pull_request' }, async () => '占位')
    const server = await buildLeg({
      transport: fast.transport,
      store,
      dispatcher: saturated,
      responseBudgetMs: 0,
    })

    const response = await postEvent(server, 'pull_request', pullRequestPayload(), 'd-fallback')
    expect(response.statusCode).toBe(200)
    expect(response.json().data).toMatchObject({ accepted: true, dispatch: 'inline' })
    expect(fast.calls.length).toBeGreaterThan(0)
    expect(store.recorded).toEqual([['d-fallback', 'pull_request']])
    await server.close()
  })

  it('同一 delivery 的异步投递仍受一级去重:第二次不会长出第二份重活', async () => {
    const gate = gatedTransport()
    const store = fakeStore()
    const pump = manualQueue()
    const server = await buildLeg({
      transport: gate.transport,
      store,
      dispatcher: pump.queue,
      responseBudgetMs: 0,
    })

    const first = await postEvent(server, 'pull_request', pullRequestPayload(), 'd-dup')
    expect(first.json().data).toMatchObject({ dispatch: 'async' })
    const second = await postEvent(server, 'pull_request', pullRequestPayload(), 'd-dup')
    expect(second.statusCode).toBe(200)
    expect(second.json().data).toMatchObject({
      accepted: false,
      reason: 'duplicate_delivery',
    })

    gate.releaseAll()
    await pump.flush()
    expect(store.recorded).toEqual([['d-dup', 'pull_request']])
    await server.close()
  })

  it('后台重活失败(GitHub 网络异常形态)不影响已发出的 2xx,队列继续接下一单', async () => {
    const store = fakeStore()
    const queue = createWebhookDispatchQueue({ schedule: (run) => run() })
    let mode: 'boom' | 'ok' = 'boom'
    const calls: GithubApiRequest[] = []
    const transport: GithubTransport = async (request) => {
      calls.push(request)
      if (mode === 'boom') throw new Error('connect ECONNREFUSED api.github.com')
      if (request.method === 'POST') return { status: 201, body: { id: 778 } }
      return {
        status: 200,
        body: [
          {
            filename: 'src/a.ts',
            status: 'modified',
            additions: 3,
            deletions: 1,
            changes: 4,
            patch: '@@ -1,3 +1,5 @@\n+const x = 1',
          },
        ],
      }
    }
    const server = await buildLeg({ transport, store, dispatcher: queue, responseBudgetMs: 0 })

    const first = await postEvent(server, 'pull_request', pullRequestPayload(), 'd-bgfail')
    // 应答已经在路上,后台怎么抖都追不回这条 200 —— 这正是本票要的解耦
    expect(first.statusCode).toBe(200)
    expect(first.json().data).toMatchObject({ dispatch: 'async' })
    await queue.drain()
    // runPrReview 把网络异常收敛成 outcome.status='failed'(既有语义,本票不动它),
    // 因此这一枚照旧落幂等表:异步化没有改变"处理收敛即落表"的口径。
    expect(store.recorded).toEqual([['d-bgfail', 'pull_request']])

    // worker 还活着:下一单换个 delivery 照样跑完(队列若被异常掀掉,这里就会永挂)
    mode = 'ok'
    const second = await postEvent(server, 'pull_request', pullRequestPayload(), 'd-after-fail')
    expect(second.statusCode).toBe(200)
    await queue.drain()
    expect(store.recorded).toHaveLength(2)
    expect(queue.depth()).toBe(0)
    await server.close()
  })
})

// ---------------------------------------------------------------------------
// 3) 正向对照:既有拒绝面不得被异步化放过
// ---------------------------------------------------------------------------
describe('github-app 腿:既有拒绝面不回退(Y-91 对照)', () => {
  it('签名不对的 pull_request ⇒ 401,队列一次都没被投进去', async () => {
    const fast = fastTransport()
    const store = fakeStore()
    let submitted = 0
    const inner = createWebhookDispatchQueue({ schedule: () => {} })
    const counting: WebhookDispatchQueue = {
      submit(job, task) {
        submitted += 1
        return inner.submit(job, task)
      },
      depth: () => inner.depth(),
      drain: () => inner.drain(),
      close: () => inner.close(),
      get closed() {
        return inner.closed
      },
    }
    const server = await buildLeg({
      transport: fast.transport,
      store,
      dispatcher: counting,
      responseBudgetMs: 0,
    })

    const response = await postEvent(server, 'pull_request', pullRequestPayload(), 'd-badsig', {
      secret: 'whsec_not_mine',
    })
    expect(response.statusCode).toBe(401)
    expect(fast.calls).toHaveLength(0)
    expect(submitted).toBe(0)
    expect(store.calls).toHaveLength(0)
    await server.close()
  })

  it('缺签名头 ⇒ 401(异步化不放宽准入)', async () => {
    const fast = fastTransport()
    const server = await buildLeg({ transport: fast.transport, store: fakeStore() })
    const response = await postEvent(server, 'pull_request', pullRequestPayload(), 'd-nosig', {
      signed: false,
    })
    expect(response.statusCode).toBe(401)
    expect(fast.calls).toHaveLength(0)
    await server.close()
  })

  it('secret 未配置 ⇒ 503(不因"先回 200"降级放行)', async () => {
    const fast = fastTransport()
    const server = await buildLeg({
      transport: fast.transport,
      store: fakeStore(),
      webhookSecret: null,
    })
    const response = await postEvent(server, 'pull_request', pullRequestPayload(), 'd-nosecret')
    expect(response.statusCode).toBe(503)
    await server.close()
  })

  it('真正未知的事件名 ⇒ 200 + unsupported_event(不进队列)', async () => {
    const fast = fastTransport()
    const store = fakeStore()
    const server = await buildLeg({ transport: fast.transport, store })
    const response = await postEvent(server, 'deployment_protection_rule', {}, 'd-unknown')
    expect(response.statusCode).toBe(200)
    expect(response.json().data).toMatchObject({ accepted: false, reason: 'unsupported_event' })
    expect(fast.calls).toHaveLength(0)
    expect(store.calls).toHaveLength(0)
    await server.close()
  })

  it('pull_request 事件体不合 schema ⇒ 仍 400(校验仍排在应答之前)', async () => {
    const fast = fastTransport()
    const server = await buildLeg({ transport: fast.transport, store: fakeStore() })
    const response = await postEvent(server, 'pull_request', { action: 'opened' }, 'd-invalid')
    expect(response.statusCode).toBe(400)
    expect(fast.calls).toHaveLength(0)
    await server.close()
  })

  it('CI 三件套仍走零 IO 忽略路径:不进队列、不碰持久层', async () => {
    const fast = fastTransport()
    const store = fakeStore()
    const server = await buildLeg({ transport: fast.transport, store, responseBudgetMs: 0 })
    const fixtures: Array<[string, Record<string, unknown>]> = [
      [
        'check_suite',
        {
          action: 'completed',
          check_suite: { id: 1, status: 'completed', head_sha: 'abc123' },
          repository: { full_name: REPO },
        },
      ],
      [
        'workflow_run',
        {
          action: 'completed',
          workflow_run: { id: 2, status: 'completed', conclusion: 'failure', head_sha: 'abc123' },
          repository: { full_name: REPO },
        },
      ],
      [
        'check_run',
        {
          action: 'completed',
          check_run: { id: 3, status: 'queued', head_sha: 'abc123' },
          repository: { full_name: REPO },
        },
      ],
    ]
    for (const [event, body] of fixtures) {
      const response = await postEvent(server, event, body, `d-ci-${event}`)
      expect(response.statusCode).toBe(200)
      expect(response.json().data).toMatchObject({ reason: 'ci_event_not_subscribed' })
    }
    expect(fast.calls).toHaveLength(0)
    expect(store.calls).toHaveLength(0)
    await server.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
