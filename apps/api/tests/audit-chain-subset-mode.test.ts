// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 审计链「子集验证」判据(G-300)。
 *
 * 要钉的那一型:链是**全局**的(`recordAuditLog` 取链尾用全表 `ORDER BY timestamp DESC LIMIT 1`),
 * 而按用户查回来的只是**子序列**。旧判据把"输入是一段连续区间"当成隐含前提,于是任何与别人
 * 行交错的用户都被报 `prev_hash 链断裂`,并由 `routes/audit-log.ts` 的 verify 端点原样回给管理员
 * —— 数据是好的,告警是假的,而假告警的结局是没人再信这条链的验证结论。
 *
 * 四条必须同时成立(缺一即本文件的目的没达到):
 *  ① 交错用户的子集 ⇒ `valid:true` **且** `continuityProven:false`(前者防假告警,后者防把"没证"写成"证过");
 *  ② 子集里任一行内容被改 ⇒ 仍然判红(放宽邻接**不得**顺手放宽重算);
 *  ③ 连续区间里删掉中间一行 ⇒ 仍然判红(区间档的邻接判据一个字节都没松);
 *  ④ `verifyUserChain` 这个调用点**真的**传了 `subset`(否则 ①②③ 只是函数级绿灯,提交链上无人受益)。
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    AUDIT_LOG_HMAC_SECRET: 'k'.repeat(64),
  },
}))

const { mockSelectAuditLogChain } = vi.hoisted(() => ({
  mockSelectAuditLogChain: vi.fn(),
}))

vi.mock('../src/db/audit-queries.js', () => ({
  selectAuditLogChain: mockSelectAuditLogChain,
  selectAuditLogs: vi.fn(),
  selectAuditLogsRange: vi.fn(),
  countAuditLogs: vi.fn(),
  groupByAction: vi.fn(),
  groupByUser: vi.fn(),
}))

import {
  computeAuditHash,
  verifyAuditLogIntegrity,
  verifyUserChain,
} from '../src/services/audit-log-service.js'
import type { AuditLogChainRow } from '../src/db/audit-queries.js'

const GENESIS = '0'.repeat(64)
const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'

/** 与 `recordAuditLog` 逐字同形的链构造器(同一把 computeAuditHash,不另写一份输入序列)。 */
function buildGlobalChain(): AuditLogChainRow[] {
  const plan: Array<{ userId: string; action: string }> = [
    { userId: USER_A, action: 'auth.login' },
    { userId: USER_B, action: 'data.read' },
    { userId: USER_A, action: 'data.write' },
    { userId: USER_B, action: 'auth.logout' },
  ]
  const rows: AuditLogChainRow[] = []
  let prev = GENESIS
  plan.forEach((spec, i) => {
    const base = {
      timestamp: new Date(Date.UTC(2026, 8, 1, 0, 0, i)).toISOString(),
      userId: spec.userId,
      action: spec.action,
      resourceType: 'chat',
      resourceId: `res-${String(i)}`,
      result: 'success',
      metadata: { seq: i } as Record<string, unknown>,
    }
    const currentHash = computeAuditHash(prev, base)
    rows.push({
      id: `id-${String(i)}`,
      ip: '10.0.0.1',
      userAgent: 'ua',
      ...base,
      prevHash: prev,
      currentHash,
    })
    prev = currentHash
  })
  return rows
}

describe('审计链子集验证(G-300)', () => {
  it('① 交错用户的子集:内容自洽判通过,但区间连续性明写"未证"', () => {
    const chain = buildGlobalChain()
    const subset = [chain[0]!, chain[2]!]

    const span = verifyAuditLogIntegrity(chain)
    expect(span.valid).toBe(true)
    expect(span.continuityProven).toBe(true)
    expect(span.adjacencyBreaks).toBe(0)

    const got = verifyAuditLogIntegrity(subset, 'subset')
    expect(got.valid).toBe(true)
    expect(got.mode).toBe('subset')
    expect(got.totalChecked).toBe(2)
    expect(got.continuityProven).toBe(false)
    expect(got.adjacencyBreaks).toBe(1)
    // 假告警的反面:结论里必须写着"这不是篡改",否则读的人只能去查一个不存在的攻击者
    expect(got.reason ?? '').toContain('不是篡改')
  })

  it('② 子集档只放宽邻接,不放宽重算:改一行 metadata 仍判红', () => {
    const chain = buildGlobalChain()
    const subset = [chain[0]!, chain[2]!]
    const tampered: AuditLogChainRow[] = [
      subset[0]!,
      { ...subset[1]!, metadata: { seq: 999 } },
    ]

    const got = verifyAuditLogIntegrity(tampered, 'subset')
    expect(got.valid).toBe(false)
    expect(got.tamperedIndex).toBe(1)
    expect(got.reason ?? '').toContain('current_hash 不匹配')
  })

  it('③ 区间档的邻接判据一字未松:抽掉中间一行仍判"链断裂"', () => {
    const chain = buildGlobalChain()
    // 去掉第 2 行 ⇒ 第 3 行的 prev_hash 指向被删那行的 current_hash
    const gapped = [chain[0]!, chain[1]!, chain[3]!]

    const got = verifyAuditLogIntegrity(gapped, 'span')
    expect(got.valid).toBe(false)
    expect(got.tamperedIndex).toBe(2)
    expect(got.reason ?? '').toContain('prev_hash 链断裂')
    expect(got.continuityProven).toBe(false)
  })

  it('缺省档仍是 span(既有调用方与保留任务逐字不受影响)', () => {
    const chain = buildGlobalChain()
    expect(verifyAuditLogIntegrity(chain).mode).toBe('span')
    expect(verifyAuditLogIntegrity([]).mode).toBe('span')
    expect(verifyAuditLogIntegrity([]).valid).toBe(true)
  })

  it('④ 装车证明:verifyUserChain 这个调用点真的走 subset 档', async () => {
    const chain = buildGlobalChain()
    // 复刻 selectAuditLogChain 的真实形态:WHERE user_id = ? ⇒ 返回的是全局链的子序列
    mockSelectAuditLogChain.mockResolvedValue([chain[0], chain[2]])

    const got = await verifyUserChain(USER_A, 10)
    expect(mockSelectAuditLogChain).toHaveBeenCalledWith(USER_A, 10)
    expect(got.mode).toBe('subset')
    expect(got.valid).toBe(true)
    expect(got.continuityProven).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
