// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RP-40 事件源适配器端到端:
 * - GitHub webhook:验签通过才入队;同一 delivery 重复投递由引擎判 duplicate(不开第二张工单);
 * - 未知仓库/未知平台/未知归属主体:fail-closed,不入队;
 * - IM 回调:@ 机器人 ⇒ explicit 直接接单;
 * - 定时轮询:复用 automations 扫描客户端,同一条目重复扫描不重复开工单。
 *
 * 纪律:测试不另抄映射表,期望的 ruleId/domain 从 shared 的默认表解析;断言只看可观测结果。
 */

import { createHmac } from 'node:crypto'
import Fastify from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SECRET = 'rp40-test-secret'

vi.mock('../src/config/index.js', () => ({ config: { GITHUB_WEBHOOK_SECRET: 'rp40-test-secret' } }))
vi.mock('../src/db/index.js', () => ({
  db: { select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }) },
}))
vi.mock('../src/db/user-preferences-queries.js', () => ({
  USER_PREFERENCE_GROUPS: { superAgent: 'super_agent' },
  findUserPreferences: vi.fn(async () => ({ list: [], total: 0 })),
  upsertUserPreference: vi.fn(async () => undefined),
}))
vi.mock('../src/services/subagent-dispatch-service.js', () => ({
  subagentDispatchService: { dispatch: vi.fn(async () => ({ ok: true })) },
}))

import githubWebhookRoutes from '../src/routes/github-webhook.js'
import {
  installSuperAgentEventSources,
  ingestGithubWebhook,
  ingestImWebhook,
  stopSuperAgentEventSources,
  superAgentEventSourceHealth,
} from '../src/services/super-agent-event-sources/index.js'
import { superAgentHost, superAgentPump } from '../src/services/super-agent-pump-service.js'

const REPO = 'ihui-ai/IHUI-AI'

function env(owner: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    IHUI_SUPER_AGENT_STATE_ACCOUNT: owner,
    IHUI_SUPER_AGENT_GITHUB_REPOS: REPO,
    IHUI_SUPER_AGENT_GITHUB_OWNER_LOGINS: 'lichunchuan',
    ...extra,
  }
}

function sign(body: string): string {
  return `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`
}

function githubPullPayload(action = 'review_requested') {
  return {
    action,
    repository: { full_name: REPO },
    sender: { login: 'alice' },
    requested_reviewer: { login: 'lichunchuan' },
    pull_request: {
      number: 42,
      title: 'feat: RP-40',
      html_url: 'https://github.com/ihui-ai/IHUI-AI/pull/42',
      updated_at: '2026-11-07T10:00:00Z',
    },
  }
}

async function postGithub(body: Record<string, unknown>, delivery: string, signature?: string) {
  const app = Fastify()
  await app.register(githubWebhookRoutes, { prefix: '/api/webhooks' })
  const raw = JSON.stringify(body)
  const res = await app.inject({
    method: 'POST',
    url: '/api/webhooks/github',
    headers: {
      'content-type': 'application/json',
      'x-github-event': String(body.action === undefined ? 'ping' : 'pull_request'),
      'x-github-delivery': delivery,
      'x-hub-signature-256': signature ?? sign(raw),
    },
    payload: raw,
  })
  await app.close()
  return res
}

function ticketScopes(owner: string): string[] {
  const snap = superAgentHost.snapshot()
  const slice = snap.owners.find((o) => o.ownerUserId === owner)?.slice
  return (slice?.tickets ?? []).map((t) => t.scope)
}

function panelCount(owner: string): number {
  return ticketScopes(owner).length
}

async function install(owner: string, extra: Record<string, string> = {}) {
  superAgentHost.applyPolicy(owner, {
    acceptMode: 'auto',
    sessionIsAllowlist: true,
    quiet: true,
  })
  return installSuperAgentEventSources({ env: env(owner, extra) })
}

beforeEach(() => {
  stopSuperAgentEventSources()
})

afterEach(() => {
  stopSuperAgentEventSources()
  vi.restoreAllMocks()
})

describe('GitHub webhook → 事件源 → 引擎', () => {
  it('签名失败:401,且适配器零入队(验签是唯一入口)', async () => {
    const owner = 'rp40-sig-owner'
    install(owner)
    const res = await postGithub(githubPullPayload(), 'd-sig-bad', 'sha256=deadbeef')
    expect(res.statusCode).toBe(401)
    expect(superAgentEventSourceHealth().pending).toEqual([
      { sourceId: 'github-webhook', pending: 0, taken: 0 },
    ])
    const run = await superAgentPump.runOnce()
    expect(run.ingested).toBe(0)
  })

  it('验签通过 → 点名 review_requested 直接开单;同 delivery 重放判 duplicate', async () => {
    const owner = 'rp40-github-owner'
    install(owner)
    const body = githubPullPayload()
    const first = await postGithub(body, 'd-rp40-1')
    expect(first.statusCode).toBe(200)
    // 未订阅该 action,既有腿返回 action_not_watched;超级智能体适配器已独立入队。
    expect(first.json().data.reason).toBe('action_not_watched')

    const run1 = await superAgentPump.runOnce()
    expect(run1.ingested).toBe(1)
    expect(run1.accepted).toBe(1)
    expect(panelCount(owner)).toBe(1)
    const ticketId = superAgentHost.snapshot().owners.find((o) => o.ownerUserId === owner)?.slice
      .tickets[0]?.id
    expect(ticketId).toBeTruthy()
    expect(ticketScopes(owner)[0]?.startsWith('[code-review] github.pr.review:')).toBe(true)

    // 同一 delivery 重放:适配器不去重,照样入队;引擎判 duplicate,不开第二张单。
    const replay = await postGithub(body, 'd-rp40-1')
    expect(replay.statusCode).toBe(200)
    const run2 = await superAgentPump.runOnce()
    expect(run2.ingested).toBe(1)
    expect(run2.accepted).toBe(0)
    expect(panelCount(owner)).toBe(1)
  })

  it('未知仓库:fail-closed,不入队', async () => {
    const owner = 'rp40-unknown-repo-owner'
    install(owner)
    const result = ingestGithubWebhook({
      deliveryId: 'd-rp40-unknown',
      event: 'pull_request',
      action: 'review_requested',
      payload: { ...githubPullPayload(), repository: { full_name: 'evil/repo' } },
    })
    expect(result.handled).toBe(true)
    expect(result.queued).toBe(0)
    expect(result.rejected[0]?.reason).toBe('unknown_source')
    expect((await superAgentPump.runOnce()).ingested).toBe(0)
  })

  it('未映射事件:不猜规则,不入队', async () => {
    const owner = 'rp40-unmapped-owner'
    install(owner)
    const result = ingestGithubWebhook({
      deliveryId: 'd-rp40-ping',
      event: 'ping',
      action: null,
      payload: { repository: { full_name: REPO } },
    })
    expect(result.queued).toBe(0)
    expect(result.rejected[0]?.reason).toBe('unmapped_event')
  })

  it('未配置来源 ⇒ handled=false,上层业务不受影响', () => {
    stopSuperAgentEventSources()
    const result = ingestGithubWebhook({
      deliveryId: 'd-rp40-disabled',
      event: 'pull_request',
      action: 'review_requested',
      payload: githubPullPayload(),
    })
    expect(result.handled).toBe(false)
    expect(result.queued).toBe(0)
  })
})

describe('IM 回调 → 事件源 → 引擎', () => {
  const imEnv = {
    IHUI_SUPER_AGENT_IM_PLATFORMS: 'feishu',
    IHUI_SUPER_AGENT_IM_OWNER_ACCOUNTS: 'ou-owner',
  }

  it('归属主体不匹配 ⇒ 拒绝', async () => {
    const owner = 'rp40-im-owner'
    install(owner, imEnv)
    const result = ingestImWebhook({
      userId: 'other-user',
      platform: 'feishu',
      messageId: 'm-1',
      chatId: 'c-1',
      senderId: 'ou-owner',
      text: '@bot hi',
      mentioned: true,
    })
    expect(result.queued).toBe(0)
    expect(result.rejected[0]?.reason).toBe('unknown_source')
  })

  it('未知平台 ⇒ 拒绝', async () => {
    const owner = 'rp40-im-platform-owner'
    install(owner, imEnv)
    const result = ingestImWebhook({
      userId: owner,
      platform: 'telegram',
      messageId: 'm-2',
      chatId: 'c-1',
      senderId: 'ou-owner',
      text: '@bot hi',
      mentioned: true,
    })
    expect(result.rejected[0]?.reason).toBe('unknown_source')
  })

  it('@机器人 ⇒ explicit 开单;未 @ ⇒ inferred 只记账', async () => {
    const owner = 'rp40-im-e2e-owner'
    install(owner, imEnv)
    const mention = ingestImWebhook({
      userId: owner,
      platform: 'feishu',
      messageId: 'm-3',
      chatId: 'c-1',
      senderId: 'ou-owner',
      text: '帮我看下 CI',
      mentioned: true,
    })
    expect(mention.queued).toBe(1)
    expect(mention.rejected).toEqual([])
    const run = await superAgentPump.runOnce()
    expect(run.accepted).toBe(1)
    expect(panelCount(owner)).toBe(1)

    const plain = ingestImWebhook({
      userId: owner,
      platform: 'feishu',
      messageId: 'm-4',
      chatId: 'c-1',
      senderId: 'ou-owner',
      text: '普通讨论',
      mentioned: false,
    })
    expect(plain.queued).toBe(1)
    const run2 = await superAgentPump.runOnce()
    expect(run2.accepted).toBe(0)
    expect(panelCount(owner)).toBe(1)
  })
})

describe('定时轮询 → 事件源 → 引擎', () => {
  it('复用 automations 扫描:同一条目重复扫描不重复开工单', async () => {
    const owner = 'rp40-poll-owner'
    const calls: string[] = []
    const transport = async (url: string) => {
      calls.push(url)
      if (url.includes('/issues?')) {
        return new Response(
          JSON.stringify([
            { number: 5, title: 'repair me', body: 'detail', html_url: 'https://x/5' },
          ]),
          { status: 200 },
        )
      }
      if (url.includes('/actions/runs?')) {
        return new Response(
          JSON.stringify({
            workflow_runs: [
              { id: 9, name: 'CI', display_title: 'main', html_url: 'https://x/run/9' },
            ],
          }),
          { status: 200 },
        )
      }
      throw new Error(`unexpected ${url}`)
    }
    installSuperAgentEventSources({
      env: env(owner, {
        IHUI_SUPER_AGENT_POLL_ENABLED: 'true',
        IHUI_GITHUB_PAT: 'pat-test',
        IHUI_AUTOMATIONS_REPO: REPO,
        IHUI_AUTOMATIONS_LABEL: 'automations:fix',
      }),
      transport,
    })

    const run1 = await superAgentPump.runOnce()
    expect(run1.ingested).toBe(2)
    // 轮询映射默认 inferred ⇒ 只记账,不替人开工单
    expect(run1.accepted).toBe(0)
    expect(calls.some((u) => u.includes('/issues?'))).toBe(true)
    expect(calls.some((u) => u.includes('/actions/runs?'))).toBe(true)

    const run2 = await superAgentPump.runOnce()
    expect(run2.ingested).toBe(2)
    expect(run2.accepted).toBe(0)
    expect(panelCount(owner)).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
