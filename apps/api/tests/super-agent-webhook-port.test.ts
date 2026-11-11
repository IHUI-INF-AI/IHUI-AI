// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RP-40 webhook 回调落账重放端到端锁：
 * 真路由插件(HMAC 验签 + admin 源管理) + 真账本(文件落盘) + 真泵/真 host，
 * 只打桩派单下游与鉴权闸门（与 super-agent-routes/pump-service 用例同法）。
 *
 * 主链判据：回调落账 ⇒ 泵经 Port 取到 ⇒ host 收到一次 ⇒ 重放幂等
 * （重复回调不重复落账；消费后不再回队；host 层 trigger.id 二次去重）。
 */
import { createHmac } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SUPER_AGENT_POLICY, SuperAgentHost } from '@ihui/shared/super-agent'

const { mockDispatch } = vi.hoisted(() => ({
  mockDispatch: vi.fn<(input: Record<string, unknown>) => Promise<unknown>>(async () => ({
    outcome: 'ok',
    dispatch: { id: 'dispatch-1' },
  })),
}))

vi.mock('../src/services/subagent-dispatch-service.js', () => ({
  subagentDispatchService: { dispatch: mockDispatch },
  setTenantConcurrencyLimitResolver: vi.fn(),
}))
// 测试隔离铁律:持久腿触库的模块必须 mock(pump-service 静态 import user-preferences-queries)
vi.mock('../src/db/user-preferences-queries.js', () => ({
  USER_PREFERENCE_GROUPS: { superAgent: 'super-agent' },
  findUserPreferences: vi.fn(async () => ({ list: [] })),
  upsertUserPreference: vi.fn(async () => undefined),
}))
vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
// lazy-admin-guard 动态 import 的闸门:凭 x-test-admin 头放行,否则 403(形状照齐 requireAdmin)
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async (request: { headers: Record<string, unknown> }, reply: { status: (c: number) => { send: (b: unknown) => unknown } }) => {
    if (request.headers['x-test-admin'] === '1') return
    await reply.status(403).send({ code: 403, message: '需要管理员权限' })
  },
}))

import { superAgentWebhookRoutes } from '../src/routes/super-agent-webhook.js'
import {
  __installSuperAgentHostForTests,
  listTriggerSourcePorts,
  superAgentHost,
  superAgentPump,
  unregisterTriggerSourcePort,
} from '../src/services/super-agent-pump-service.js'
import {
  __resetSuperAgentWebhookLedgerForTests,
  drainPendingWebhookEvents,
  superAgentWebhookLedgerStats,
} from '../src/services/super-agent-webhook-ledger.js'

const OWNER = 'user-hook-owner'
const SOURCE = 'deploy-hook'

let app: FastifyInstance
let tmpRoot = ''
let clockNow = 1_000_000
let seq = 0

function sign(secret: string, payload: Record<string, unknown>): string {
  return createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex')
}

async function createSource(): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/admin/super-agent/webhook-sources',
    headers: { 'x-test-admin': '1' },
    payload: { sourceId: SOURCE, ownerUserId: OWNER },
  })
  expect(res.statusCode).toBe(200)
  const body = res.json() as { data: { source: { secret: string } } }
  return body.data.source.secret
}

async function callback(secret: string | null, payload: Record<string, unknown>, badSig = false) {
  const headers: Record<string, string> = {}
  if (secret !== null) {
    headers['x-webhook-signature'] = badSig ? 'deadbeef'.repeat(8) : sign(secret, payload)
  }
  return app.inject({
    method: 'POST',
    url: `/api/super-agent/webhook-callback/${SOURCE}`,
    headers,
    payload,
  })
}

beforeEach(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'ihui-sa-hook-'))
  process.env.IHUI_SUPER_AGENT_WEBHOOK_LEDGER_PATH = join(tmpRoot, 'ledger.json')
  process.env.IHUI_SUPER_AGENT_WORKSPACE_ROOT = join(tmpRoot, 'ws')
  __resetSuperAgentWebhookLedgerForTests()
  unregisterTriggerSourcePort(SOURCE)
  const host = new SuperAgentHost(undefined, {
    now: () => clockNow,
    id: (prefix: string) => `${prefix}-${++seq}`,
  })
  __installSuperAgentHostForTests(host)
  host.applyPolicy(OWNER, { ...DEFAULT_SUPER_AGENT_POLICY })
  mockDispatch.mockClear()
  app = Fastify({ logger: false })
  await app.register(superAgentWebhookRoutes, { prefix: '/api' })
  await app.ready()
})

afterEach(async () => {
  await app.close()
  rmSync(tmpRoot, { recursive: true, force: true })
  delete process.env.IHUI_SUPER_AGENT_WEBHOOK_LEDGER_PATH
  delete process.env.IHUI_SUPER_AGENT_WORKSPACE_ROOT
  __resetSuperAgentWebhookLedgerForTests()
})

describe('RP-40 webhook 落账重放主链', () => {
  it('回调落账⇒泵取到⇒host 收到一次⇒重放幂等', async () => {
    const secret = await createSource()
    expect(listTriggerSourcePorts()).toContainEqual({ sourceId: SOURCE, ownerUserId: OWNER })

    const evt = { eventId: 'evt-1', text: '部署反馈：生产回滚完成，请复盘' }
    const first = await callback(secret, evt)
    expect(first.statusCode).toBe(202)
    expect((first.json() as { data: { recorded: boolean } }).data.recorded).toBe(true)

    // 同事件重复回调 ⇒ duplicate，不重复落账（幂等键 sourceId+eventId）。
    const replay = await callback(secret, evt)
    expect(replay.statusCode).toBe(200)
    expect((replay.json() as { data: { duplicate: boolean } }).data.duplicate).toBe(true)
    expect(superAgentWebhookLedgerStats().pending).toBe(1)

    // 泵一拍：从账上取未消费事件灌 host，收到一次并派发一次。
    const r1 = await superAgentPump.runOnce()
    expect(r1.ingested).toBe(1)
    expect(r1.accepted).toBe(1)
    expect(r1.dispatched).toBe(1)
    expect(mockDispatch).toHaveBeenCalledTimes(1)
    const snap = superAgentHost.snapshot()
    const slice = snap.owners.find((o) => o.ownerUserId === OWNER)
    expect(slice?.slice.tickets).toHaveLength(1)
    expect(slice?.slice.tickets[0]?.mandate?.route).toBe('explicit')
    // host 层 trigger.id 去重：账上事件已被 trigger 台账认下。
    expect(slice?.slice.triggers.map((t) => t.id)).toEqual([`wh:${SOURCE}:evt-1`])

    // 消费后不再回队：再拍零进食；重复回调依旧 duplicate ⇒ 全程 host 只收到一次。
    const r2 = await superAgentPump.runOnce()
    expect(r2.ingested).toBe(0)
    const replayAgain = await callback(secret, evt)
    expect((replayAgain.json() as { data: { duplicate: boolean } }).data.duplicate).toBe(true)
    const r3 = await superAgentPump.runOnce()
    expect(r3.ingested).toBe(0)
    expect(mockDispatch).toHaveBeenCalledTimes(1)
    expect(superAgentHost.snapshot().owners.find((o) => o.ownerUserId === OWNER)?.slice.tickets).toHaveLength(1)
  })

  it('验签口径：坏签名 401、缺签名 401、未登记来源 404、形状坏 400', async () => {
    const secret = await createSource()
    expect((await callback(secret, { eventId: 'e', text: 'x' }, true)).statusCode).toBe(401)
    expect((await callback(null, { eventId: 'e', text: 'x' })).statusCode).toBe(401)
    expect((await callback(secret, { text: '缺 eventId' })).statusCode).toBe(400)

    const unknown = await app.inject({
      method: 'POST',
      url: '/api/super-agent/webhook-callback/no-such-src',
      headers: { 'x-webhook-signature': 'a'.repeat(64) },
      payload: { eventId: 'e', text: 'x' },
    })
    expect(unknown.statusCode).toBe(404)
    // 401/404/400 路径零落账
    expect(superAgentWebhookLedgerStats().pending).toBe(0)
  })

  it('落盘与恢复：重置内存态后从文件重读，pending/consumed 标记不丢', async () => {
    const secret = await createSource()
    await callback(secret, { eventId: 'evt-p1', text: '告警一' })
    await callback(secret, { eventId: 'evt-p2', text: '告警二' })

    __resetSuperAgentWebhookLedgerForTests()
    expect(superAgentWebhookLedgerStats()).toMatchObject({ sources: 1, pending: 2, consumed: 0 })

    const drained = drainPendingWebhookEvents(SOURCE)
    expect(drained.map((t) => t.id)).toEqual([`wh:${SOURCE}:evt-p1`, `wh:${SOURCE}:evt-p2`])

    __resetSuperAgentWebhookLedgerForTests()
    expect(superAgentWebhookLedgerStats()).toMatchObject({ pending: 0, consumed: 2 })
    // duplicate 判定跨重启仍成立（幂等键在盘上）。
    const replay = await callback(secret, { eventId: 'evt-p1', text: '告警一' })
    expect((replay.json() as { data: { duplicate: boolean } }).data.duplicate).toBe(true)
  })

  it('admin 面闸门与注销：无 admin 头 403；DELETE 后端口摘除、回调 404', async () => {
    const denied = await app.inject({ method: 'GET', url: '/api/admin/super-agent/webhook-sources' })
    expect(denied.statusCode).toBe(403)

    await createSource()
    expect(listTriggerSourcePorts().some((p) => p.sourceId === SOURCE)).toBe(true)

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/admin/super-agent/webhook-sources/${SOURCE}`,
      headers: { 'x-test-admin': '1' },
    })
    expect(del.statusCode).toBe(200)
    expect(listTriggerSourcePorts().some((p) => p.sourceId === SOURCE)).toBe(false)
    expect((await callback('whatever', { eventId: 'e', text: 'x' })).statusCode).toBe(404)
  })

  it('来源列表脱敏：secret 不回全量', async () => {
    const secret = await createSource()
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/super-agent/webhook-sources',
      headers: { 'x-test-admin': '1' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { list: { secret: string }[] } }
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0]?.secret).not.toBe(secret)
    expect(secret.length).toBeGreaterThanOrEqual(8)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
