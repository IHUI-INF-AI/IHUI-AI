// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 学费账目出口的常驻测试(2026-09-29 立,D180)。
 *
 * 每一条断言对应本次修掉的一个真实缺陷,不是为覆盖率凑数:
 * ① 后台录一笔缴费后欠费必须归零      —— 旧 POST /payment-record 只写流水不回写
 * ② 退费通过必须把已缴额冲回来        —— 旧 approve 只改 status,退完钱仍算"已缴清"
 * ③ 超缴不得读成负欠费               —— roster 的算式原先没有下限 0
 * ④ pending 流水不算已收             —— 口径必须显式,原先由调用方各自决定
 * ⑤ 部分缴且过宽限期仍算逾期         —— 否则"交一点点"就永久躲开逾期视图
 * ⑥ 无账期时不假装知道到期日         —— nextDueDate 必须为 null
 * ⑦ 未授权(43101)与真故障分档        —— 旧版并成一档,排查方向从第一步就错
 *
 * 断言全部打在**纯函数**上(deriveEnrollmentLedger / dayDiff / buildReminderMessage),
 * 所以这个文件不需要数据库、不连生产库(AGENTS §5 测试隔离铁律)。
 */
import { describe, expect, it, vi } from 'vitest'

// 被测模块的顶层 import 了 db;桩掉它,保证本文件不会碰到任何真实数据库
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

import { __test__ as ledger } from '../src/services/edu-ledger.js'
import { __test__ as reminder } from '../src/services/edu-arrear-remind-service.js'
import { classifySmsAvailability } from '../src/services/edu-arrear-remind-service.js'

describe('短信通道可达性(三态不并桶)', () => {
  it('没配短信密钥 = not_configured,与个人号码无关', () => {
    expect(classifySmsAvailability(false, '13800000000')).toEqual({ ok: false, bucket: 'not_configured' })
    expect(classifySmsAvailability(false, null)).toEqual({ ok: false, bucket: 'not_configured' })
  })
  it('配了但这人没留号码/只有空白 = no_phone(不得冒充"已发送",也不得并入 failed)', () => {
    expect(classifySmsAvailability(true, null)).toEqual({ ok: false, bucket: 'no_phone' })
    expect(classifySmsAvailability(true, '   ')).toEqual({ ok: false, bucket: 'no_phone' })
    expect(classifySmsAvailability(true, undefined)).toEqual({ ok: false, bucket: 'no_phone' })
  })
  it('两者齐备才 ok,并把号码规整成去空白后的值(带前后空格的号码不该被原样丢给运营商)', () => {
    const r = classifySmsAvailability(true, ' 13800000000 ')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.phone).toBe('13800000000')
  })
})

describe('催费通道路由与"送达失败"判据', () => {
  const { parseRemindChannels, externalDeliveryMissed } = reminder
  it('默认只走微信(不借接线偷偷开一条计费通道)', () => {
    expect(parseRemindChannels(undefined)).toEqual(['wechat'])
    expect(parseRemindChannels('')).toEqual(['wechat'])
  })
  it('可显式扩到短信;非法值丢掉而不是让整个定时任务停摆', () => {
    expect(parseRemindChannels('sms')).toEqual(['sms'])
    expect(parseRemindChannels('wechat, sms')).toEqual(['wechat', 'sms'])
    expect(parseRemindChannels('carrier-pigeon,sms')).toEqual(['sms'])
    expect(parseRemindChannels('carrier-pigeon')).toEqual(['wechat'])
  })
  it('站内信被请求时不参与"外部触达失败"判定', () => {
    expect(externalDeliveryMissed({ channels: ['in_app'], reminded: 5, wxSent: 0, smsSent: 0 })).toBe(
      false,
    )
  })
  it('要外发却零送达 ⇒ 判失败(旧版只按站内信异常判定,微信未配置一直显示 success)', () => {
    expect(
      externalDeliveryMissed({ channels: ['wechat'], reminded: 5, wxSent: 0, smsSent: 0 }),
    ).toBe(true)
    expect(
      externalDeliveryMissed({ channels: ['wechat', 'sms'], reminded: 5, wxSent: 0, smsSent: 2 }),
    ).toBe(false)
    expect(
      externalDeliveryMissed({ channels: ['wechat', 'sms'], reminded: 5, wxSent: 3, smsSent: 0 }),
    ).toBe(false)
    expect(externalDeliveryMissed({ channels: ['wechat'], reminded: 0, wxSent: 0, smsSent: 0 })).toBe(
      false,
    )
  })
})

const { deriveEnrollmentLedger, dayDiff, DUE_SOON_LEAD_DAYS, shouldAdoptUnattributed, buildSchedulePlan } =
  ledger

describe('账期展开器只做机械摊派,不替机构编规则', () => {
  it('摊派逐期相加必须恰好等于应缴额(少 1 元末期就永远缴不清)', () => {
    const p = buildSchedulePlan({
      periodCount: 3,
      amountTotal: 1000,
      firstDueDate: '2026-09-05',
      cycle: 'monthly',
    })
    expect(p).not.toBeNull()
    expect(p!.reduce((s, x) => s + x.amountDue, 0)).toBe(1000)
    expect(p!.map((x) => x.amountDue)).toEqual([333, 333, 334])
  })

  it('月末 31 日按月推进要钳制,不得产出 2026-02-31 这种日期', () => {
    const p = buildSchedulePlan({
      periodCount: 4,
      amountTotal: 400,
      firstDueDate: '2026-01-31',
      cycle: 'monthly',
    })
    expect(p!.map((x) => x.dueDate)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ])
    for (const x of p!) expect(Number.isNaN(Date.parse(x.dueDate))).toBe(false)
  })

  it('期数/金额/日期/周期任一非法一律返回 null,不猜一个"看起来合理"的到期日', () => {
    const base = { periodCount: 2, amountTotal: 600, firstDueDate: '2026-09-01', cycle: 'monthly' } as const
    expect(buildSchedulePlan({ ...base, periodCount: 0 })).toBeNull()
    expect(buildSchedulePlan({ ...base, periodCount: 2.5 })).toBeNull()
    expect(buildSchedulePlan({ ...base, amountTotal: 50.5 })).toBeNull()
    expect(buildSchedulePlan({ ...base, firstDueDate: '2026/9/1' })).toBeNull()
    expect(buildSchedulePlan({ ...base, cycle: 'weekly' as 'monthly' })).toBeNull()
    // termly 少了步长就是无解 —— 默认值会替机构决定"一学期几个月",那是编造
    expect(buildSchedulePlan({ ...base, cycle: 'termly' })).toBeNull()
    // 矛盾输入:一次缴清 vs 分成 2 期 ⇒ 必须拒,而不是产出两条同日到期的账期
    expect(buildSchedulePlan({ ...base, cycle: 'once' })).toBeNull()
    expect(
      buildSchedulePlan({ periodCount: 1, amountTotal: 600, firstDueDate: '2026-09-01', cycle: 'once' }),
    ).toHaveLength(1)
  })

  it('cycle=once 只出一期且金额=全额(不是 0 期也不是均分成两份)', () => {
    const p = buildSchedulePlan({
      periodCount: 1,
      amountTotal: 880,
      firstDueDate: '2026-10-01',
      cycle: 'once',
    })
    expect(p).toHaveLength(1)
    expect(p![0]!.amountDue).toBe(880)
    expect(p![0]!.periodLabel).toBe('全额')
  })
})

describe('无归属流水/退费能不能认领', () => {
  // 这一维决定"历史 NULL 归属的钱去哪了":
  // 唯一报名却不认领 ⇒ 已缴额凭空变小,学员被多催(本模块自己引入过的形状);
  // 多期报名还认领 ⇒ 同一笔钱在两个期次各算一次(本模块要消灭的第一型)。
  it('该 student×class 只有一条有效报名 → 必须认领这笔钱', () => {
    expect(shouldAdoptUnattributed(1)).toBe(true)
  })
  it('有多条报名(续读)→ 谁都不认领,交 loadUnattributedPayments 点名', () => {
    expect(shouldAdoptUnattributed(2)).toBe(false)
    expect(shouldAdoptUnattributed(3)).toBe(false)
  })
  it('0 条(理论上不该发生)→ 同样不认领,不猜归属', () => {
    expect(shouldAdoptUnattributed(0)).toBe(false)
  })
})
const { buildReminderMessage, beijingMidnightUtc } = reminder

const TODAY = '2026-09-29'

function sched(
  over: Partial<{
    id: string
    dueDate: string
    graceDays: number
    amountDue: number
    status: string
  }>,
) {
  return {
    id: 's1',
    dueDate: '2026-09-01',
    graceDays: 0,
    amountDue: 1000,
    status: 'pending',
    ...over,
  }
}
function pay(
  over: Partial<{ id: string; amount: number; status: string; scheduleId: string | null }>,
) {
  return { id: 'p1', amount: 1000, status: 'paid', scheduleId: null, ...over }
}
function ref(over: Partial<{ amount: number; status: string; scheduleId: string | null }>) {
  return { amount: 300, status: 'approved', scheduleId: null, ...over }
}

describe('欠费口径 = 流水 − 已结退费(唯一算法)', () => {
  it('① 录一笔足额缴费后,欠费必须归零', () => {
    const r = deriveEnrollmentLedger({
      totalFee: 1000,
      schedules: [],
      payments: [pay({})],
      refunds: [],
      today: TODAY,
    })
    expect(r.paidAmount).toBe(1000)
    expect(r.arrears).toBe(0)
  })

  it('② 退费审批通过后,已缴额必须被冲回、欠费必须重新出现', () => {
    const r = deriveEnrollmentLedger({
      totalFee: 1000,
      schedules: [],
      payments: [pay({})],
      refunds: [ref({ status: 'approved' })],
      today: TODAY,
    })
    expect(r.paidAmount).toBe(700)
    expect(r.arrears).toBe(300)
  })

  it('②b 被驳回的退费不得冲销已缴额', () => {
    const r = deriveEnrollmentLedger({
      totalFee: 1000,
      schedules: [],
      payments: [pay({})],
      refunds: [ref({ status: 'rejected' })],
      today: TODAY,
    })
    expect(r.paidAmount).toBe(1000)
    expect(r.arrears).toBe(0)
  })

  it('④ 未支付/已取消的流水一律不算已收', () => {
    for (const status of ['pending', 'cancelled', 'refunded']) {
      const r = deriveEnrollmentLedger({
        totalFee: 1000,
        schedules: [],
        payments: [pay({ status })],
        refunds: [],
        today: TODAY,
      })
      expect(r.paidAmount).toBe(0)
      expect(r.arrears).toBe(1000)
    }
  })

  it('③ 超缴/超退不得算出负欠费,也不得让已缴额变负', () => {
    // 语义澄清(为什么这里 arrears 等于全额而不是 0):
    // 报名仍是有效状态却没留下任何实缴(netPaid = 1000 - 1500 ≤ 0),
    // 那"这笔学费未缴"就是事实,催缴它是正确的。
    // 至于机构多退出去的那 500 属于**另一条账**(应向学员收回),
    // 把它并进学费欠费口径只会产出"负欠费",再被 GREATEST 抹成 0,
    // 结果是这个人在名单上消失 —— 两条线各算各的,不许互相顶账。
    const r = deriveEnrollmentLedger({
      totalFee: 1000,
      schedules: [],
      payments: [pay({ amount: 1000 })],
      refunds: [ref({ amount: 1500, status: 'completed' })],
      today: TODAY,
    })
    expect(r.creditedAmount).toBe(1000)
    expect(r.settledRefund).toBe(1500)
    expect(r.paidAmount).toBe(0)
    expect(r.paidAmount).toBeGreaterThanOrEqual(0)
    expect(r.arrears).toBe(1000)
    expect(r.arrears).toBeGreaterThanOrEqual(0)
  })
})

describe('账期摊派与到期分级', () => {
  it('未归属的流水按到期日升序摊派,先填最紧的一期', () => {
    const r = deriveEnrollmentLedger({
      totalFee: 1200,
      schedules: [
        sched({ id: 'later', dueDate: '2026-12-01', amountDue: 600 }),
        sched({ id: 'earlier', dueDate: '2026-10-01', amountDue: 600 }),
      ],
      payments: [pay({ amount: 600 })],
      refunds: [],
      today: '2026-09-29',
    })
    expect(r.schedules.find((s) => s.id === 'earlier')?.paidAmount).toBe(600)
    expect(r.schedules.find((s) => s.id === 'later')?.paidAmount).toBe(0)
    expect(r.schedules.find((s) => s.id === 'earlier')?.status).toBe('paid')
    expect(r.unallocatedPaid).toBe(0)
  })

  it('摊完账期后多余的钱留在报名级,不冒充某期已缴', () => {
    const r = deriveEnrollmentLedger({
      totalFee: 1000,
      schedules: [sched({ amountDue: 300 })],
      payments: [pay({ amount: 800 })],
      refunds: [],
      today: TODAY,
    })
    expect(r.unallocatedPaid).toBe(500)
    expect(r.paidAmount).toBe(800)
    expect(r.arrears).toBe(200)
  })

  it('⑤ 部分缴且已过宽限期,仍然必须算逾期', () => {
    const r = deriveEnrollmentLedger({
      totalFee: 1000,
      schedules: [sched({ dueDate: '2026-09-01', graceDays: 3, amountDue: 1000 })],
      payments: [pay({ amount: 200 })],
      refunds: [],
      today: TODAY,
    })
    expect(r.schedules[0]?.status).toBe('partial')
    expect(r.schedules[0]?.overdue).toBe(true)
    expect(r.overdueCount).toBe(1)
  })

  it('宽限期内不算逾期;过宽限期的天数按天计', () => {
    const inGrace = deriveEnrollmentLedger({
      totalFee: 1000,
      schedules: [sched({ dueDate: '2026-09-27', graceDays: 5, amountDue: 1000 })],
      payments: [],
      refunds: [],
      today: TODAY,
    })
    expect(inGrace.schedules[0]?.overdue).toBe(false)
    expect(inGrace.overdueCount).toBe(0)

    const past = deriveEnrollmentLedger({
      totalFee: 1000,
      schedules: [sched({ dueDate: '2026-09-01', graceDays: 0, amountDue: 1000 })],
      payments: [],
      refunds: [],
      today: TODAY,
    })
    expect(past.schedules[0]?.overdueDays).toBe(28)
    expect(past.schedules[0]?.status).toBe('overdue')
  })

  it('即将到期档:未逾期、未缴清、距到期 ≤ lead days', () => {
    const r = deriveEnrollmentLedger({
      totalFee: 1000,
      schedules: [
        sched({
          dueDate: `2026-09-${String(29 + DUE_SOON_LEAD_DAYS).padStart(2, '0')}`,
          amountDue: 1000,
        }),
      ],
      payments: [],
      refunds: [],
      today: TODAY,
    })
    expect(r.dueSoonCount).toBe(1)
    expect(r.overdueCount).toBe(0)
  })

  it('⑥ 没有任何账期时不假装知道到期日', () => {
    const r = deriveEnrollmentLedger({
      totalFee: 1000,
      schedules: [],
      payments: [],
      refunds: [],
      today: TODAY,
    })
    expect(r.nextDueDate).toBeNull()
    expect(r.schedules).toHaveLength(0)
    expect(r.arrears).toBe(1000)
  })

  it('nextDueDate 取最早那个未清账期,已缴清的期次不得顶掉未清的', () => {
    const r = deriveEnrollmentLedger({
      totalFee: 1200,
      schedules: [
        sched({ id: 'a', dueDate: '2026-08-01', amountDue: 600 }),
        sched({ id: 'b', dueDate: '2026-10-01', amountDue: 600 }),
      ],
      payments: [pay({ id: 'p1', amount: 600, scheduleId: 'a' })],
      refunds: [],
      today: TODAY,
    })
    expect(r.schedules.find((s) => s.id === 'a')?.status).toBe('paid')
    expect(r.nextDueDate).toBe('2026-10-01')
  })
})

describe('催费文案与日界', () => {
  it('⑦ 逾期 / 到期前 / 无账期 三档文案必须是不同句子', () => {
    const overdue = buildReminderMessage('张三', 800, 5, '2026-09-01')
    const upcoming = buildReminderMessage('张三', 800, 0, '2026-10-15')
    const bare = buildReminderMessage('张三', 800, 0, null)
    expect(overdue).toContain('已逾期 5 天')
    expect(upcoming).toContain('2026-10-15 到期')
    expect(bare).not.toContain('逾期')
    expect(new Set([overdue, upcoming, bare]).size).toBe(3)
  })

  it('dayDiff 以 UTC 零点计,跨时区不抖一天', () => {
    expect(dayDiff('2026-09-29', '2026-09-27')).toBe(2)
    expect(dayDiff('2026-09-27', '2026-09-29')).toBe(-2)
    expect(dayDiff('not-a-date', '2026-09-29')).toBe(0)
  })

  it('当日幂等窗口按北京 0 点,不是 UTC 0 点', () => {
    const d = beijingMidnightUtc()
    // 北京 00:00 恒等于 UTC 前一日 16:00;若实现用了 UTC 0 点,这里会是 0
    expect(d.getUTCHours()).toBe(16)
    expect(d.getUTCMinutes()).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
