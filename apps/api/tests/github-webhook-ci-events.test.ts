// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Y-13 收尾:GitHub App 投递 check_suite / workflow_run / check_run 这三类 CI 事件时,
 * 本仓两条 webhook 腿都不许回 400/500。
 *
 * 腿位实测(先分清入口再动手):
 * - `POST /api/github-app/webhook`(routes/github-app.ts)= GitHub App 回调登记的那条腿。
 *   routes/github-app.ts:26-32 的腿位不变量写明 url 必须是
 *   `https://api.aizhs.top/api/github-app/webhook`;routes/developer/webhooks.ts、
 *   routes/webhooks-trigger.ts、routes/admin/webhook-debug.ts 全仓零 GitHub 引用,
 *   不是投递入口(前两条是本平台自己的对外 webhook 管理/触发面)。
 * - `POST /api/webhooks/github`(routes/github-webhook.ts)= agent 事件唤醒腿,
 *   同样接 GitHub 形态投递,票面点名 400 的入口候选,本文件把它一并钉住。
 *
 * 夹具形态取自 GitHub 官方 webhook/REST 对象定义(check suite / workflow run / check run
 * 三个 schema),不自造字段:**status 官方允许 null、workflow_run 另把同一枚 sha 写在
 * head_commit.id、head_branch 在 tag/fork 形态下为 null** —— 这三型正是把合法投递判 400 的
 * 地方(票面 4 枚 400 的 schema 侧成因)。
 *
 * 全程 mock db / config / 执行器 / GitHub transport / 持久层,零真实连接(§5 测试隔离铁律:
 * 生产 PG 8810、Redis 8811 一律不碰)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { createHmac } from 'node:crypto'
import type { AgentEventTrigger } from '@ihui/database'
import * as triggerService from '../src/services/agent-event-trigger.js'

const h = vi.hoisted(() => ({
  rows: [] as AgentEventTrigger[],
  /** 旧腿的 secret 走 config(与 github-webhook-unattended-intake.test.ts 同一夹具形态) */
  secret: 'whsec_y13_ci_leg',
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

// 只把"副作用出口"换成 spy:纯匹配/解析函数用真实实现,断言的是路由真调了它。
vi.mock('../src/services/agent-event-trigger.js', async (importOriginal) => {
  const actual = await importOriginal<typeof triggerService>()
  return { ...actual, fireEventTriggerAsync: vi.fn() }
})
vi.mock('../src/services/agent-runtime-stream.js', () => ({
  captureAgentRuntimeStream: vi.fn(),
}))

import githubAppRoutes, { WEBHOOK_PATH } from '../src/routes/github-app.js'
import { createDeliveryDeduper, parseWebhook } from '../src/services/github-app/events.js'
import githubWebhookRoutes from '../src/routes/github-webhook.js'
import sqliGuard from '../src/plugins/sqli-guard.js'
import type { GithubAppStore } from '../src/services/github-app/store.js'
import type {
  GithubApiRequest,
  GithubApiResponse,
  GithubTransport,
} from '../src/services/github-app/jwt.js'

const APP_SECRET = 'whsec_y13_app'
const APP_BASE = '/api/github-app'
const LEGACY_BASE = '/api/webhooks'
const REPO_FULL_NAME = 'IHUI-INF-AI/IHUI-AI'
const HEAD_SHA = '2f941c5c1e0fad9d62493ffca2d5c2f43528a168'
/** 提供方正文里的真实形态:字符门(`' " ;`)命中 ∧ SQL 结构签名(堆叠语句 + UNION SELECT) */
const INJECTIONISH = "fix: ; SELECT id FROM posts WHERE author='bot' UNION SELECT 1 --"

const repository = {
  id: 100,
  name: 'IHUI-AI',
  full_name: REPO_FULL_NAME,
  owner: { login: 'IHUI-INF-AI', id: 1, type: 'Organization' },
  default_branch: 'main',
}
const sender = { login: 'octocat', id: 1, type: 'User' }
const installation = { id: 9001 }
const simpleCommit = {
  id: HEAD_SHA,
  tree_id: '342605d9b3f855c4f2a1e7b9f0d2c8e5a6b7c8d9',
  message: 'fix(api): CI 事件不再静默失聪',
  timestamp: '2026-11-05T00:00:00Z',
  author: { name: 'octocat', email: 'octocat@example.com', date: '2026-11-05T00:00:00Z' },
  committer: { name: 'octocat', email: 'octocat@example.com', date: '2026-11-05T00:00:00Z' },
}
const appLite = { id: 15368, slug: 'github-actions', name: 'GitHub Actions' }

type CiEventName = 'check_suite' | 'workflow_run' | 'check_run'

/** GitHub `check_suite` 事件体(官方 schema 字段集);默认那枚就是 status=null 的合法投递 */
function checkSuitePayload(subject: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    action: 'completed',
    check_suite: {
      id: 4483963692,
      node_id: 'MDE2OkNoZWNrU3VpdGU0NDgzOTYzNjky',
      head_branch: null,
      head_sha: HEAD_SHA,
      status: null,
      conclusion: 'failure',
      url: `https://api.github.com/repos/${REPO_FULL_NAME}/check-suites/4483963692`,
      before: null,
      after: null,
      pull_requests: [],
      app: appLite,
      created_at: '2026-11-05T00:00:00Z',
      updated_at: '2026-11-05T00:05:00Z',
      latest_check_runs_count: 3,
      check_runs_url: `https://api.github.com/repos/${REPO_FULL_NAME}/check-suites/4483963692/check-runs`,
      head_commit: simpleCommit,
      ...subject,
    },
    repository,
    sender,
    installation,
  }
}

/** GitHub `workflow_run` 事件体(事件根上还带一枚简化的 check_suite —— 官方形态如此) */
function workflowRunPayload(subject: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    action: 'completed',
    check_suite: { id: 4483963692 },
    workflow_run: {
      id: 3969567105,
      name: 'CI (Monorepo)',
      run_number: 13,
      run_attempt: 1,
      event: 'push',
      display_title: 'fix(api): CI 事件',
      status: 'in_progress',
      conclusion: null,
      workflow_id: 193,
      check_suite_id: 4483963692,
      check_suite_node_id: 'MDE2OkNoZWNrU3VpdGU0NDgzOTYzNjky',
      url: `https://api.github.com/repos/${REPO_FULL_NAME}/actions/runs/3969567105`,
      html_url: `https://github.com/${REPO_FULL_NAME}/actions/runs/3969567105`,
      run_url: `https://api.github.com/repos/${REPO_FULL_NAME}/actions/runs/3969567105`,
      artifacts_url: `https://api.github.com/repos/${REPO_FULL_NAME}/actions/runs/3969567105/artifacts`,
      cancel_url: `https://api.github.com/repos/${REPO_FULL_NAME}/actions/runs/3969567105/cancel`,
      check_suite_url: `https://api.github.com/repos/${REPO_FULL_NAME}/actions/runs/3969567105/check-suite`,
      jobs_url: `https://api.github.com/repos/${REPO_FULL_NAME}/actions/runs/3969567105/jobs`,
      logs_url: `https://api.github.com/repos/${REPO_FULL_NAME}/actions/runs/3969567105/logs`,
      rerun_url: `https://api.github.com/repos/${REPO_FULL_NAME}/actions/runs/3969567105/rerun`,
      workflow_url: `https://api.github.com/repos/${REPO_FULL_NAME}/actions/workflows/193`,
      previous_attempt_url: null,
      run_started_at: '2026-11-05T00:00:00Z',
      created_at: '2026-11-05T00:00:00Z',
      updated_at: '2026-11-05T00:05:00Z',
      head_branch: null,
      head_commit: simpleCommit,
      head_sha: HEAD_SHA,
      path: '.github/workflows/ci.yml',
      repository,
      pull_requests: [],
      actor: sender,
      triggering_actor: sender,
      node_id: 'WCRwCUv8ZmYzYTVhMjBk',
      referenced_workflows: [],
      ...subject,
    },
    repository,
    sender,
    installation,
  }
}

/** GitHub `check_run` 事件体(票面那枚 500/dur=10s 就是这一族) */
function checkRunPayload(subject: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    action: 'completed',
    check_run: {
      id: 44,
      name: 'typecheck',
      head_sha: HEAD_SHA,
      external_id: '',
      url: `https://api.github.com/repos/${REPO_FULL_NAME}/check-runs/44`,
      html_url: `https://github.com/${REPO_FULL_NAME}/runs/44`,
      status: 'completed',
      conclusion: 'failure',
      started_at: '2026-11-05T00:00:00Z',
      completed_at: '2026-11-05T00:05:00Z',
      output: {
        title: null,
        summary: null,
        text: null,
        annotations_count: 0,
        annotations_url: `https://api.github.com/repos/${REPO_FULL_NAME}/check-runs/44/annotations`,
      },
      check_suite: {
        id: 4483963692,
        head_branch: null,
        head_sha: HEAD_SHA,
        status: 'completed',
        conclusion: null,
        url: `https://api.github.com/repos/${REPO_FULL_NAME}/check-suites/4483963692`,
        before: null,
        after: null,
        pull_requests: [],
        app: appLite,
        created_at: '2026-11-05T00:00:00Z',
        updated_at: '2026-11-05T00:05:00Z',
      },
      app: appLite,
      pull_requests: [],
      ...subject,
    },
    requested_action: null,
    repository,
    sender,
    installation,
  }
}

const CI_FIXTURES: Record<CiEventName, () => Record<string, unknown>> = {
  check_suite: () => checkSuitePayload({ status: 'completed' }),
  workflow_run: () => workflowRunPayload({ status: 'completed', conclusion: 'failure' }),
  check_run: checkRunPayload,
}

const fireSpy = vi.mocked(triggerService.fireEventTriggerAsync)

function signature(body: string, secret: string = APP_SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`
}

/** 只记录、永不回应的 transport:一旦 CI 分支去调 GitHub API,calls 就会长出条目 */
function recordingTransport(): { calls: GithubApiRequest[]; transport: GithubTransport } {
  const calls: GithubApiRequest[] = []
  const transport: GithubTransport = async (request) => {
    calls.push(request)
    const reply: GithubApiResponse = { status: 200, body: {} }
    return reply
  }
  return { calls, transport }
}

/**
 * 假持久层:查表/落表都返回**永不 settle 的 Promise**。
 * 这一支就是那枚 `check_run / 500 / dur=10s` 的形状 —— 应答若排在幂等表前面等待,
 * 就会被这条永不回头的 IO 拖死(现场拖到上游超时)。CI 忽略路径若真做到零 IO,
 * 这些方法一次都不会被调用,应答也不会被拖住。
 */
function hangingStore(): GithubAppStore & { hasDelivery: ReturnType<typeof vi.fn> } {
  const never = () => new Promise<never>(() => {})
  return {
    hasDelivery: vi.fn(never),
    recordDelivery: vi.fn(never),
    applyInstallationEvent: vi.fn(never),
    listInstallations: vi.fn(never),
  }
}

async function buildAppLeg(
  opts: {
    store?: GithubAppStore | null
    transport?: GithubTransport
    webhookSecret?: string | null
    deduper?: ReturnType<typeof createDeliveryDeduper>
  } = {},
): Promise<FastifyInstance> {
  const server = Fastify({ logger: false })
  await server.register(githubAppRoutes, {
    prefix: APP_BASE,
    transport: opts.transport,
    textModel: null,
    webhookSecret: opts.webhookSecret === undefined ? APP_SECRET : opts.webhookSecret,
    deduper: opts.deduper ?? createDeliveryDeduper(),
    store: opts.store === undefined ? null : opts.store,
  })
  await server.ready()
  return server
}

async function postApp(
  server: FastifyInstance,
  event: string,
  payload: unknown,
  delivery: string,
  opts: { secret?: string; signed?: boolean; rawBody?: string } = {},
) {
  const body = opts.rawBody ?? JSON.stringify(payload)
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-github-event': event,
    'x-github-delivery': delivery,
  }
  if (opts.signed !== false) {
    headers['x-hub-signature-256'] = signature(body, opts.secret ?? APP_SECRET)
  }
  return server.inject({
    method: 'POST',
    url: `${APP_BASE}${WEBHOOK_PATH}`,
    headers,
    payload: body,
  })
}

// ---------------------------------------------------------------------------
// 1) App 腿:真实形态的三类 CI 事件 → 显式 2xx 忽略
// ---------------------------------------------------------------------------
describe('github-app 腿:真实 GitHub CI 事件体得到显式 2xx 忽略(Y-13)', () => {
  it.each([['check_suite'], ['workflow_run'], ['check_run']] as const)(
    '%s 官方形态事件体 → 200 + reason=ci_event_not_subscribed(不是 400,也不静默丢弃)',
    async (event) => {
      const { calls, transport } = recordingTransport()
      const server = await buildAppLeg({ transport })
      const response = await postApp(server, event, CI_FIXTURES[event](), `d-real-${event}`)
      await server.close()

      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({
        code: 0,
        data: {
          accepted: false,
          reason: 'ci_event_not_subscribed',
          event,
          action: 'completed',
        },
      })
      // 没有处理分支 ⇒ 一个外部调用都不该发(副作用未发生)
      expect(calls).toHaveLength(0)
    },
  )

  it('check_suite.status=null(官方 schema 允许)→ 200,不再被 Zod 判成 400', async () => {
    const server = await buildAppLeg()
    const response = await postApp(server, 'check_suite', checkSuitePayload(), 'd-null-status')
    await server.close()

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      code: 0,
      data: { reason: 'ci_event_not_subscribed', ci: { status: null, headSha: HEAD_SHA } },
    })
  })

  it('workflow_run.status=in_progress ∧ conclusion=null ∧ head_branch=null → 200', async () => {
    const server = await buildAppLeg()
    const response = await postApp(server, 'workflow_run', workflowRunPayload(), 'd-run-inprogress')
    await server.close()

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      data: { ci: { status: 'in_progress', conclusion: null, headSha: HEAD_SHA } },
    })
  })

  it('workflow_run 只把 sha 写在 head_commit.id(官方双写位)→ 200 且 headSha 取到那枚 sha', async () => {
    const server = await buildAppLeg()
    const payload = workflowRunPayload({ head_sha: undefined })
    delete (payload.workflow_run as Record<string, unknown>)['head_sha']
    const response = await postApp(server, 'workflow_run', payload, 'd-run-headcommit')
    await server.close()

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ data: { ci: { headSha: HEAD_SHA } } })
  })

  it('主体定位维全缺(id/status/head_sha 一个都不给)→ 仍 200,unresolved 点名缺的是哪几维', async () => {
    const server = await buildAppLeg()
    const payload = checkSuitePayload()
    payload.check_suite = { conclusion: 'failure', url: 'https://example.invalid' }
    const response = await postApp(server, 'check_suite', payload, 'd-bare-subject')
    await server.close()

    expect(response.statusCode).toBe(200)
    const ci = (response.json() as { data: { ci: { unresolved: string[] } } }).data.ci
    expect(ci.unresolved).toEqual(expect.arrayContaining(['id', 'status', 'head_sha']))
  })
})

// ---------------------------------------------------------------------------
// 2) 应答路径零外部 IO:幂等表永不回应也不拖住 CI 忽略应答(500/dur=10s 那一型的根治)
// ---------------------------------------------------------------------------
describe('github-app 腿:CI 忽略应答不排在持久层 IO 后面', () => {
  it('查表/落表永不 settle 时,CI 投递仍立刻 2xx,且持久层一次都没被触碰', async () => {
    const store = hangingStore()
    const server = await buildAppLeg({ store })
    const startedAt = Date.now()
    const response = await postApp(server, 'check_run', checkRunPayload(), 'd-hanging-store')
    const elapsedMs = Date.now() - startedAt
    await server.close()

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ data: { reason: 'ci_event_not_subscribed' } })
    expect(elapsedMs).toBeLessThan(1_500)
    expect(store.hasDelivery).not.toHaveBeenCalled()
    expect(store.recordDelivery).not.toHaveBeenCalled()
  })

  it('同一 deliveryId 的 CI 重投由内存一级去重吃掉(零 IO 也有幂等)', async () => {
    const deduper = createDeliveryDeduper()
    const server = await buildAppLeg({ store: hangingStore(), deduper })
    const first = await postApp(
      server,
      'workflow_run',
      CI_FIXTURES.workflow_run(),
      'd-ci-redeliver',
    )
    const second = await postApp(
      server,
      'workflow_run',
      CI_FIXTURES.workflow_run(),
      'd-ci-redeliver',
    )
    await server.close()

    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(second.json()).toMatchObject({ data: { accepted: false, reason: 'duplicate_delivery' } })
  })
})

// ---------------------------------------------------------------------------
// 3) 成对正向对照:既有拒绝行为一律不回退(票面禁止把"宽容"做成"不设防")
// ---------------------------------------------------------------------------
describe('github-app 腿:既有拒绝面不回退(Y-13 正向对照)', () => {
  it('签名不对的 CI 投递 → 401(而不是被新放的宽松 schema 兜住)', async () => {
    const store = hangingStore()
    const server = await buildAppLeg({ store })
    const response = await postApp(server, 'check_run', CI_FIXTURES.check_run(), 'd-ci-badsig', {
      secret: 'wrong-secret',
    })
    await server.close()

    expect(response.statusCode).toBe(401)
    expect(store.hasDelivery).not.toHaveBeenCalled()
    expect(fireSpy).toHaveBeenCalledTimes(0)
  })

  it('缺签名头的 CI 投递 → 401', async () => {
    const server = await buildAppLeg()
    const response = await postApp(server, 'check_suite', CI_FIXTURES.check_suite(), 'd-ci-nosig', {
      signed: false,
    })
    await server.close()

    expect(response.statusCode).toBe(401)
  })

  it('secret 未配置 → 503 显式失败(CI 事件也不降级放行)', async () => {
    const server = await buildAppLeg({ webhookSecret: null })
    const response = await postApp(server, 'check_run', CI_FIXTURES.check_run(), 'd-ci-nosecret')
    await server.close()

    expect(response.statusCode).toBe(503)
  })

  it('真正未知的事件名 → 200 + unsupported_event(宽松只开在 CI 三件套上)', async () => {
    const server = await buildAppLeg()
    const response = await postApp(
      server,
      'deployment_status',
      { action: 'created', deployment: { id: 1 }, repository },
      'd-ci-unknown-event',
    )
    await server.close()

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ data: { reason: 'unsupported_event' } })
  })

  it.each([
    ['check_suite', 'check_suite'],
    ['workflow_run', 'workflow_run'],
    ['check_run', 'check_run'],
  ] as const)('CI 事件缺主体维 → 结构化 400 并点名 %s', async (event, subjectKey) => {
    const server = await buildAppLeg()
    const payload = CI_FIXTURES[event]()
    delete payload[subjectKey]
    const response = await postApp(server, event, payload, `d-ci-no-subject-${event}`)
    await server.close()

    expect(response.statusCode).toBe(400)
    const body = response.json() as { code: number; message: string; data: unknown }
    expect(body.code).toBe(400)
    expect(body.data).toBeNull()
    expect(body.message).toContain(event)
    expect(body.message).toContain(subjectKey)
  })

  it('CI 事件缺 repository.full_name → 结构化 400 点名 repository', async () => {
    const server = await buildAppLeg()
    const payload = checkRunPayload()
    delete payload['repository']
    const response = await postApp(server, 'check_run', payload, 'd-ci-no-repo')
    await server.close()

    expect(response.statusCode).toBe(400)
    expect((response.json() as { message: string }).message).toContain('repository')
  })

  it('签名有效但 body 非合法 JSON → 400(不是 500)', async () => {
    const server = await buildAppLeg()
    const rawBody = '{"action":"completed","repository":{'
    const response = await postApp(server, 'check_run', null, 'd-ci-broken-json', { rawBody })
    await server.close()

    expect(response.statusCode).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// 4) 纯函数层:parseWebhook 对官方形态必须认;缺维只进 unresolved,不判 invalid
// ---------------------------------------------------------------------------
describe('parseWebhook 纯函数层(Y-13 schema 面)', () => {
  it.each([['check_suite'], ['workflow_run'], ['check_run']] as const)(
    '%s 官方形态 → status=ok ∧ kind=ci_event',
    (event) => {
      const parsed = parseWebhook({
        eventHeader: event,
        deliveryHeader: 'd-pure',
        payload: CI_FIXTURES[event](),
      })
      expect(parsed.status).toBe('ok')
      if (parsed.status === 'ok') expect(parsed.data.kind).toBe('ci_event')
    },
  )

  it('check_suite.status=null 不得判 invalid(那枚 400 的判据就在这里)', () => {
    const parsed = parseWebhook({
      eventHeader: 'check_suite',
      deliveryHeader: 'd-pure-null-status',
      payload: checkSuitePayload(),
    })
    expect(parsed.status).toBe('ok')
    if (parsed.status === 'ok' && parsed.data.kind === 'ci_event') {
      expect(parsed.data.summary.status).toBeNull()
      expect(parsed.data.summary.headSha).toBe(HEAD_SHA)
    }
  })

  it('installation 缺位不判 invalid(CI 定位仍靠 repo + sha)', () => {
    const payload = checkRunPayload()
    delete payload['installation']
    const parsed = parseWebhook({
      eventHeader: 'check_run',
      deliveryHeader: 'd-pure-no-installation',
      payload,
    })
    expect(parsed.status).toBe('ok')
    if (parsed.status === 'ok') expect(parsed.data.envelope.installationId).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 5) 旧腿 /api/webhooks/github:守卫豁免 + CI 事件 2xx 且留可读日志
// ---------------------------------------------------------------------------
describe('github-webhook 腿(/api/webhooks/github):CI 投递不被判死', () => {
  async function buildLegacyLeg(): Promise<FastifyInstance> {
    const server = Fastify({ logger: false })
    await server.register(sqliGuard)
    await server.register(githubWebhookRoutes, { prefix: LEGACY_BASE })
    // 成对对照:同一把守卫下未豁免的路由必须照旧拦,证明豁免不是把守卫摘空
    server.post('/guarded-control', async (request) => ({
      echoed: (request.body as { note?: string }).note !== undefined,
    }))
    await server.ready()
    return server
  }

  function deliverLegacy(server: FastifyInstance, event: string, body: string, delivery: string) {
    return server.inject({
      method: 'POST',
      url: `${LEGACY_BASE}/github`,
      headers: {
        'content-type': 'application/json',
        'x-github-event': event,
        'x-github-delivery': delivery,
        'x-hub-signature-256': signature(body, h.secret),
      },
      payload: body,
    })
  }

  it.each([['check_suite'], ['workflow_run'], ['check_run']] as const)(
    '%s 官方形态投递 → 2xx(不 400/500),且执行器一次都没被调用',
    async (event) => {
      const server = await buildLegacyLeg()
      const body = JSON.stringify(CI_FIXTURES[event]())
      const response = await deliverLegacy(server, event, body, `d-legacy-${event}`)
      await server.close()

      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({ code: 0, data: { accepted: false } })
      expect(fireSpy).toHaveBeenCalledTimes(0)
    },
  )

  it('正文含注入形态文本的 CI 投递:本腿豁免 → 2xx,未豁免对照路由照旧 400', async () => {
    const server = await buildLegacyLeg()
    const payload = { ...checkRunPayload({ name: INJECTIONISH }), note: INJECTIONISH }
    const body = JSON.stringify(payload)
    const webhookResponse = await deliverLegacy(server, 'check_run', body, 'd-legacy-sqli')
    const controlResponse = await server.inject({
      method: 'POST',
      url: '/guarded-control',
      headers: { 'content-type': 'application/json' },
      payload: body,
    })
    await server.close()

    expect(webhookResponse.statusCode).toBe(200)
    expect(controlResponse.statusCode).toBe(400)
  })

  it('签名无效仍 401:豁免只关守卫,不动鉴权', async () => {
    const server = await buildLegacyLeg()
    const body = JSON.stringify(CI_FIXTURES.check_suite())
    const response = await server.inject({
      method: 'POST',
      url: `${LEGACY_BASE}/github`,
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'check_suite',
        'x-github-delivery': 'd-legacy-badsig',
        'x-hub-signature-256': signature(body, 'not-the-secret'),
      },
      payload: body,
    })
    await server.close()

    expect(response.statusCode).toBe(401)
    expect(fireSpy).toHaveBeenCalledTimes(0)
  })
})

beforeEach(() => {
  h.rows = []
  h.secret = 'whsec_y13_ci_leg'
  // 旧腿的两个单例跨用例存活 ⇒ 显式复位(与 unattended-intake 套件同一手法)
  triggerService.intakeStormGuard.clear()
  triggerService.deliveryDedup.clear()
  fireSpy.mockClear()
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
