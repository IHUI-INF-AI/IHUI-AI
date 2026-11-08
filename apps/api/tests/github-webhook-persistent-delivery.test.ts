// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-346 夹具:webhook 投递必须先落持久面再回 200。
 *
 * 改前(红):
 * - 路由只记进程内 deliveryDedup,回 200 之后异步执行;存储不可用也照回 200;
 * - 同一 delivery 跨实例/重启会再触发一次,崩溃后没有任何持久记录可恢复。
 *
 * 改后(绿):
 * - claim 先于 fire、先于 200;repeat(同进程)与并发重复只执行一次;
 * - 执行失败把持久行落 'failed',重投可重新认领并执行(不静默丢事件);
 * - 持久层不可用/写失败 → 503,不确认投递(让 GitHub 继续重投),且不触发执行。
 *
 * 全程注入内存账本与假执行器,零真实 DB/Redis 连接。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { createHmac } from 'node:crypto'
import type { AgentEventTrigger } from '@ihui/database'
import * as triggerService from '../src/services/agent-event-trigger.js'

const h = vi.hoisted(() => ({
  rows: [] as AgentEventTrigger[],
  secret: 'whsec_f346',
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => Promise.resolve(h.rows) }) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve(undefined) }) }),
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => ({ returning: () => Promise.resolve([{ id: 'claimed' }]) }),
      }),
    }),
  },
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    get GITHUB_WEBHOOK_SECRET() {
      return h.secret
    },
  },
}))

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

type ClaimState = 'claimed' | 'reclaimed' | 'duplicate' | 'unavailable'

interface DeliveryRow {
  deliveryId: string
  eventType: string
  status: 'processing' | 'processed' | 'failed'
  payload: Record<string, unknown>
}

/** 内存账本:claim 原子、按 deliveryId 唯一,settle 只改状态 */
function memoryLedger() {
  const rows = new Map<string, DeliveryRow>()
  const calls: string[] = []
  return {
    rows,
    calls,
    async claimDelivery(input: {
      deliveryId: string
      eventType: string
      payload: Record<string, unknown>
    }): Promise<ClaimState> {
      calls.push(`claim:${input.deliveryId}`)
      const existing = rows.get(input.deliveryId)
      if (!existing) {
        rows.set(input.deliveryId, {
          deliveryId: input.deliveryId,
          eventType: input.eventType,
          status: 'processing',
          payload: input.payload,
        })
        return 'claimed'
      }
      // failed 或遗留 processing(进程崩溃)可重新认领,processed 视为重复
      if (existing.status === 'failed') {
        existing.status = 'processing'
        return 'reclaimed'
      }
      return 'duplicate'
    },
    async settleDelivery(deliveryId: string, status: 'processed' | 'failed') {
      calls.push(`settle:${deliveryId}:${status}`)
      const row = rows.get(deliveryId)
      if (row) row.status = status
    },
    async hasDelivery() {
      return false
    },
    async recordDelivery() {},
    async applyInstallationEvent() {},
    async listInstallations() {
      return []
    },
  }
}

function makeTrigger(overrides: Partial<AgentEventTrigger> = {}): AgentEventTrigger {
  const now = new Date('2026-11-08T00:00:00.000Z')
  return {
    id: 'trig-f346',
    userId: 'user-1',
    repoFullName: REPO,
    event: 'ci_failed',
    action: { prompt: '[{{kind}}] {{job}} @ {{commitSha}}', mode: 'auto', agentId: 'bot-1' },
    enabled: 'true',
    lastFiredAt: null,
    lastResult: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function ciPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'ci_failed',
    repo: REPO,
    workflow: 'CI',
    job: 'typecheck',
    commitSha: 'A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0',
    runUrl: 'https://github.com/IHUI-INF-AI/IHUI-AI/actions/runs/1',
    summary: 'failed',
    ...overrides,
  }
}

async function buildServer(ledger?: ReturnType<typeof memoryLedger>): Promise<FastifyInstance> {
  const server = Fastify({ logger: false })
  await server.register(githubWebhookRoutes, { prefix: BASE, deliveryStore: ledger })
  return server
}

function sign(body: string): string {
  return `sha256=${createHmac('sha256', h.secret).update(body, 'utf8').digest('hex')}`
}

async function deliver(
  server: FastifyInstance,
  delivery: string,
  payload: Record<string, unknown> = ciPayload(),
) {
  const body = JSON.stringify(payload)
  return server.inject({
    method: 'POST',
    url: `${BASE}/github`,
    headers: {
      'content-type': 'application/json',
      'x-github-event': 'ci_failed',
      'x-github-delivery': delivery,
      'x-hub-signature-256': sign(body),
    },
    payload: body,
  })
}

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  triggerService.intakeStormGuard.clear()
  triggerService.deliveryDedup.clear()
  h.rows = [makeTrigger()]
  h.secret = 'whsec_f346'
  fireSpy.mockReset()
})

describe('F-346 先落持久面再回 200', () => {
  it('claim 先于执行器、先于响应;持久行里带可恢复的渲染后规则', async () => {
    const ledger = memoryLedger()
    fireSpy.mockImplementation(async () => true)
    const server = await buildServer(ledger)
    const res = await deliver(server, 'dlv-persist')
    await flushAsync()
    await server.close()

    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ accepted: true, fired: 1 })
    expect(ledger.calls[0]).toBe('claim:dlv-persist')
    expect(ledger.calls).toContain('settle:dlv-persist:processed')

    const row = ledger.rows.get('dlv-persist')
    expect(row?.eventType).toBe('ci_failed')
    expect(row?.status).toBe('processed')
    const triggers = (row?.payload.triggers ?? []) as AgentEventTrigger[]
    expect(triggers).toHaveLength(1)
    expect(triggers[0]?.id).toBe('trig-f346')
    expect(triggers[0]?.action.prompt).not.toContain('{{job}}')
  })

  it('同一 delivery 只触发一次:第二投 accepted:false + 执行器不重复调用', async () => {
    const ledger = memoryLedger()
    fireSpy.mockImplementation(async () => true)
    const server = await buildServer(ledger)
    await deliver(server, 'dlv-twice')
    // 模拟另一实例/重启:进程内一级缓存清空,只剩持久面判重
    triggerService.deliveryDedup.clear()
    const second = await deliver(server, 'dlv-twice')
    await flushAsync()
    await server.close()

    expect(second.json().data).toMatchObject({
      accepted: false,
      reason: 'duplicate_delivery',
      delivery: 'dlv-twice',
    })
    expect(fireSpy).toHaveBeenCalledTimes(1)
    expect(ledger.calls.filter((c) => c.startsWith('claim:'))).toHaveLength(2)
  })

  it('并发两投同一 delivery:账本只放行一次,执行器只跑一次', async () => {
    const ledger = memoryLedger()
    const deferred: Array<() => void> = []
    fireSpy.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          deferred.push(() => resolve(true))
        }),
    )
    const server = await buildServer(ledger)
    const first = deliver(server, 'dlv-concurrent')
    const second = deliver(server, 'dlv-concurrent')
    const [a, b] = await Promise.all([first, second])

    const accepted = [a, b].filter((r) => r.json().data?.accepted === true)
    const duplicates = [a, b].filter((r) => r.json().data?.reason === 'duplicate_delivery')
    expect(accepted).toHaveLength(1)
    expect(duplicates).toHaveLength(1)
    expect(fireSpy).toHaveBeenCalledTimes(1)

    deferred.forEach((run) => run())
    await flushAsync()
    await server.close()
  })

  it('执行失败 → 持久行落 failed;同 delivery 重投可重新认领并执行(不静默丢事件)', async () => {
    const ledger = memoryLedger()
    fireSpy.mockImplementation(async () => false)
    const server = await buildServer(ledger)
    await deliver(server, 'dlv-retry')
    await flushAsync()

    expect(ledger.rows.get('dlv-retry')?.status).toBe('failed')

    // 进程外重投(清空进程内一级缓存,模拟新实例/重启)
    triggerService.deliveryDedup.clear()
    fireSpy.mockImplementation(async () => true)
    const retry = await deliver(server, 'dlv-retry')
    await flushAsync()
    await server.close()

    expect(retry.json().data).toMatchObject({ accepted: true, fired: 1 })
    expect(fireSpy).toHaveBeenCalledTimes(2)
    expect(ledger.rows.get('dlv-retry')?.status).toBe('processed')
  })

  it('持久层写失败 → 503,不确认投递且不执行(不让事件静默丢失)', async () => {
    const ledger = memoryLedger()
    ledger.claimDelivery = async () => {
      throw new Error('db down')
    }
    fireSpy.mockImplementation(async () => true)
    const server = await buildServer(ledger)
    const res = await deliver(server, 'dlv-dbdown')
    await server.close()

    expect(res.statusCode).toBe(503)
    expect(fireSpy).not.toHaveBeenCalled()
    expect(triggerService.deliveryDedup.record('dlv-dbdown')).toBe(true) // 未被记成"已处理"
  })

  it('没有持久层(store=null)→ 503,不假装成功', async () => {
    fireSpy.mockImplementation(async () => true)
    const nullServer = Fastify({ logger: false })
    await nullServer.register(githubWebhookRoutes, { prefix: BASE, deliveryStore: null })
    const res = await deliver(nullServer, 'dlv-nullstore')
    await nullServer.close()

    expect(res.statusCode).toBe(503)
    expect(fireSpy).not.toHaveBeenCalled()
  })
})
