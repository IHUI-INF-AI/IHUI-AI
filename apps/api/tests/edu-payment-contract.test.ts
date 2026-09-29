// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 缴费登记契约测试(2026-09-29,不连库)。
 *
 * 为什么要有这个文件:契约在当天从「studentId/classId 必填」翻成「enrollmentId 必填」。
 * 翻错、或被人改回去时,typecheck 与其余守门全都不响 —— 旧版就是这个形状:
 * 弹窗把学员姓名/班级名/费用名三个自由文本当 uuid 发给后端,后端 zod 必 400,
 * 「添加缴费记录」从来没成功过一次,而账面一路绿。
 * 所以这条判据必须能在**没有数据库**的情况下被钉住(AGENTS §5 测试隔离铁律:
 * 测试一律禁止连生产库,这里全程 mock,不建连接)。
 */
import { describe, expect, it, vi } from 'vitest'

// 路由模块的顶层 import 链会拉到 db / logger / 通知查询;全部桩掉,保证本文件零 DB 副作用
vi.mock('../src/db/index.js', () => ({ db: {} }))
vi.mock('../src/db/notification-queries.js', () => ({ createNotification: vi.fn() }))
vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('../src/services/wechat-subscribe-message.js', () => ({
  isSubscribeMessageConfigured: vi.fn(() => false),
  getWechatMiniOpenId: vi.fn(async () => null),
  buildFeeReminderData: vi.fn(() => ({})),
  sendSubscribeMessage: vi.fn(async () => ({ ok: false, errcode: 0 })),
}))

import { __test__ } from '../src/routes/edu-ai-management.js'
import { EDU_REMINDER_CHANNELS } from '../src/services/edu-ledger.js'

const { createPaymentRecordSchema, createFeeReminderSchema } = __test__

const UUID_A = '2f7a6e64-3b21-4a11-9a2f-6d1c0d9e4b21'
const UUID_B = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f'
const valid = {
  enrollmentId: UUID_A,
  amount: 800,
  paymentDate: '2026-09-29',
  paymentMethod: 'cash',
}

describe('POST /payment-record 的归属契约 = enrollmentId 必填', () => {
  it('① 只给 enrollmentId + 金额/日期/方式 → 通过(不必再自报 studentId/classId)', () => {
    const r = createPaymentRecordSchema.safeParse(valid)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.enrollmentId).toBe(UUID_A)
  })

  it('② 缺 enrollmentId 必须被拒(旧契约"给 studentId+classId 就行"不再成立)', () => {
    const { enrollmentId: _drop, ...noEnrollment } = valid
    const r = createPaymentRecordSchema.safeParse(noEnrollment)
    expect(r.success).toBe(false)
  })

  it('③ 旧形态(studentId+classId,无归属报名)必须被拒 —— 防止契约被改回去', () => {
    const r = createPaymentRecordSchema.safeParse({
      studentId: UUID_A,
      classId: UUID_B,
      amount: 800,
      paymentDate: '2026-09-29',
      paymentMethod: 'cash',
    })
    expect(r.success).toBe(false)
  })

  it('④ enrollmentId 不是 uuid 时不得放过(否则归属键形同自由文本)', () => {
    const r = createPaymentRecordSchema.safeParse({ ...valid, enrollmentId: '12' })
    expect(r.success).toBe(false)
  })

  it('⑤ 金额必须是整数(单位元;分→元的折算只发生在支付回调那一侧)', () => {
    expect(createPaymentRecordSchema.safeParse({ ...valid, amount: 80.5 }).success).toBe(false)
    expect(createPaymentRecordSchema.safeParse({ ...valid, amount: -1 }).success).toBe(false)
    expect(createPaymentRecordSchema.safeParse({ ...valid, amount: 0 }).success).toBe(true)
  })

  it('⑥ studentId/classId 是可选的一致性校验位,不是归属来源', () => {
    const r = createPaymentRecordSchema.safeParse({
      ...valid,
      studentId: UUID_B,
      classId: UUID_A,
    })
    expect(r.success).toBe(true)
  })
})

describe('催费通道的枚举只有一份真相源', () => {
  it('⑦ zod 接受的通道 = 账目出口导出的 EDU_REMINDER_CHANNELS,逐条同形', () => {
    for (const ch of EDU_REMINDER_CHANNELS) {
      expect(
        createFeeReminderSchema.safeParse({ enrollmentId: UUID_A, channel: ch }).success,
      ).toBe(true)
    }
    // 未列出的通道必须拒:通道清单若两处各写一份,"加了档位却漏一处"会静默不生效
    expect(
      createFeeReminderSchema.safeParse({ enrollmentId: UUID_A, channel: 'email' }).success,
    ).toBe(false)
    expect(
      createFeeReminderSchema.safeParse({ enrollmentId: UUID_A, channel: 'wecom' }).success,
    ).toBe(false)
  })

  it('⑧ 缺省通道是 in_app(站内信必达兜底),不是需要授权的 wechat', () => {
    const r = createFeeReminderSchema.safeParse({ enrollmentId: UUID_A })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.channel).toBe('in_app')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
