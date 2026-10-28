// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ws-customer-service strict 化回归锁(2026-09-30,票 b76-12c-2)。
 *
 * 病灶:入站控制面 schema 未 strict 化,协议文档(:69)承诺的 `kind` 未登记 —— zod 默认
 * 剥离未声明键,「生产者加了字段、消费者没登记」无声失效,功能不生效且没有任何一层红。
 *
 * 锁三件事(判定直接打在生产判定单点 judgeCsInboundMessage 上,不测平行导出):
 *  1. 「一红一绿」:同一载荷在改前 schema 副本下 kind 被静默剥掉(红),在 strict 边界下
 *     合法保留(绿) —— 证明判据有牙;
 *  2. 未登记键 → 拒 + 计数(unrecognized_key),缺文档必填的 content → 拒(malformed);
 *  3. cs_typing 同边界,合法最小载荷照常放行(不误伤)。
 */
import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// DB / WS 依赖面全部桩掉:本文件只驱动纯判定单点,不连生产 PostgreSQL(8810)/Redis(8811)
vi.mock('../src/db/customer-service-queries.js', () => ({
  createSession: vi.fn(),
  findSessionBySessionId: vi.fn(),
  assignSession: vi.fn(),
  closeSession: vi.fn(),
  pickAvailableAgent: vi.fn(),
  findWaitingSessions: vi.fn(),
  findAgentByUserId: vi.fn(),
  updateAgentStatus: vi.fn(),
}))
vi.mock('../src/plugins/ws-helpers.js', () => ({
  wsAuth: vi.fn(),
  WS_CLOSE: { TOO_MANY_CONNECTIONS: 1009, RATE_LIMITED: 1008 },
  WsUserConnectionLimiter: vi.fn(),
  WsRateLimiter: vi.fn(),
}))
vi.mock('../src/plugins/ws-auto-recovery.js', () => ({
  getWsAutoRecoveryManager: vi.fn(() => ({
    setFastify: vi.fn(),
    registerPlugin: vi.fn(),
  })),
}))

import {
  judgeCsInboundMessage,
  getCsStrictRejectionCount,
} from '../src/plugins/ws-customer-service.js'

/** 改前 schema 副本(HEAD:ws-customer-service.ts :41-47 原样):content optional、无 kind、非 strict */
const legacyCsMessageSchema = z.object({
  type: z.literal('cs_message'),
  data: z.object({
    sessionId: z.string().max(128).optional(),
    content: z.string().max(8000).optional(),
  }),
})

describe('ws-customer-service strict 边界', () => {
  it('一红一绿:改前 schema 把 kind 静默剥掉,strict 边界合法保留', () => {
    const payload = { type: 'cs_message', data: { content: 'hi', kind: 'text' } }

    // 红:改前解析"成功"但 kind 无声消失(生产者字段被剥离,无任何一层报错)
    const legacy = legacyCsMessageSchema.safeParse(payload)
    expect(legacy.success).toBe(true)
    const legacyData = legacy.data as { data: { kind?: string } }
    expect(legacyData.data.kind).toBeUndefined()

    // 绿:strict 边界登记 kind 后合法保留
    const verdict = judgeCsInboundMessage(payload)
    expect(verdict.ok).toBe(true)
    if (verdict.ok && verdict.data.type === 'cs_message') {
      expect(verdict.data.data.kind).toBe('text')
    }
  })

  it('未登记键 → 拒(unrecognized_key)且拒绝计数 +1', () => {
    const before = getCsStrictRejectionCount()
    const verdict = judgeCsInboundMessage({
      type: 'cs_message',
      data: { content: 'hi', smuggled: 'x' },
    })
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.reason).toBe('unrecognized_key')
    expect(getCsStrictRejectionCount()).toBe(before + 1)
  })

  it('缺 data.content(文档必填承诺)→ 拒(malformed)', () => {
    const before = getCsStrictRejectionCount()
    const verdict = judgeCsInboundMessage({ type: 'cs_message', data: { sessionId: 's1' } })
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.reason).toBe('malformed')
    expect(getCsStrictRejectionCount()).toBe(before + 1)
  })

  it('顶层未登记键同样被拒(外层也 strict,不剥不 passthrough)', () => {
    const verdict = judgeCsInboundMessage({
      type: 'cs_message',
      data: { content: 'hi' },
      traceId: 'x',
    })
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.reason).toBe('unrecognized_key')
  })

  it('cs_typing 同边界:未知键拒,isTyping 合法放行', () => {
    const bad = judgeCsInboundMessage({ type: 'cs_typing', data: { isTyping: true, extra: 1 } })
    expect(bad.ok).toBe(false)

    const good = judgeCsInboundMessage({ type: 'cs_typing', data: { isTyping: true } })
    expect(good.ok).toBe(true)
    if (good.ok && good.data.type === 'cs_typing') {
      expect(good.data.data.isTyping).toBe(true)
    }
  })

  it('合法最小载荷(cs_message 仅 content)照常放行 —— strict 不误伤', () => {
    const verdict = judgeCsInboundMessage({ type: 'cs_message', data: { content: 'hello' } })
    expect(verdict.ok).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
