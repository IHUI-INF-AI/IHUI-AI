// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 遗留表历史账段契约测试(G-816106 ⑤,2026-10-07,不连库)。
 *
 * 拍板(2026-10-07 机主):zhs_course_pay(+ 操作日志 zhs_course_pay_log)是旧课程
 * 平台的第三条平行账目 —— 数据**维持遗留表为历史账**(不回填、不改写、不迁数据),
 * 但读数出口并入缴费列表端点,随新流水一起对 web 财务页可见。
 *
 * 为什么要有这个文件:legacy 段的形状约定是「每行必带 source:'legacy' + 自己的操作
 * 日志;没日志的行给空数组而不是 undefined」。这条契约翻坏时 typecheck 不响
 * (web 端 `p.logs.map` 直接炸),所以必须有一条不连库就能钉住的断言
 * (AGENTS §5 测试隔离铁律:全程纯函数,零 DB 副作用)。
 *
 * 口径边界(与端点注释同源):遗留行只读展示、不参与欠费/汇总 ——
 * 欠费口径仍只由账目出口 edu-ledger 持有;遗留行的 user_uuid 是旧平台标识,
 * 与新 users.id 无映射,不得编造归属。
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

import {
  __test__,
  buildLegacySegment,
  type LegacyPayLogRow,
  type LegacyPayRow,
} from '../src/routes/edu-ai-management.js'

const { buildLegacySegment: viaTestExport } = __test__

const row = (payId: number, over: Partial<LegacyPayRow> = {}): LegacyPayRow => ({
  payId,
  userUuid: `legacy-user-${payId}`,
  courseId: 100 + payId,
  orderNo: `NO-${payId}`,
  amount: 800 + payId,
  status: 1,
  createTime: new Date(1_800_000_000_000 + payId),
  ...over,
})

const log = (payId: number, action = 'pay', detail = `d-${payId}`): LegacyPayLogRow => ({
  payId,
  action,
  detail,
  createTime: new Date(1_800_000_100_000),
})

describe('legacy 段组装契约(buildLegacySegment,G-816106 ⑤)', () => {
  it('① 每行带 source:"legacy" 与自己的操作日志(按 payId 分组、保持入参顺序)', () => {
    // SQL 侧已按 createTime 升序取日志;纯函数只分组不重排 —— 顺序翻坏 = 展示乱序
    const pays = [row(1), row(2)]
    const logs = [log(1, 'create'), log(1, 'pay'), log(2, 'refund')]
    const out = buildLegacySegment(pays, logs, 2)
    expect(out.source).toBe('legacy')
    expect(out.total).toBe(2)
    expect(out.list[0].logs.map((l) => l.action)).toEqual(['create', 'pay'])
    expect(out.list[1].logs.map((l) => l.action)).toEqual(['refund'])
    expect(out.list[0].logs[0].payId).toBeUndefined()
  })

  it('② 没日志的行给空数组而不是 undefined —— web 端 p.logs.map 不许炸', () => {
    const out = buildLegacySegment([row(7)], [], 1)
    expect(out.list[0].logs).toEqual([])
  })

  it('③ 日志不串行:payId 对不上的日志不落到别的行,也不产生幽灵行', () => {
    const out = buildLegacySegment([row(1)], [log(999, 'ghost')], 1)
    expect(out.list[0].logs).toEqual([])
    expect(out.list).toHaveLength(1)
  })

  it('④ 输出行保留输入行的全部字段,不丢一列(缺省可空列也要原样透传)', () => {
    const src = row(3, { orderNo: null, status: 2, createTime: null })
    const out = buildLegacySegment([src], [], 1)
    const { logs: _logs, ...rest } = out.list[0]
    expect(rest).toEqual({ ...src, source: 'legacy' })
  })

  it('⑤ 空 pays → list 空、total 原样透传(分页空页也是合法形状)', () => {
    const out = buildLegacySegment([], [log(1)], 0)
    expect(out.list).toEqual([])
    expect(out.total).toBe(0)
    expect(out.source).toBe('legacy')
  })

  it('⑥ __test__ 出口与模块顶层导出是同一个函数(单一真相,不许两份)', () => {
    expect(viaTestExport).toBe(buildLegacySegment)
  })

  it('⑦ total 与 list 长度解耦:total 是全表计数,list 只是当前分页切片', () => {
    // 端点侧传 legacyTotalRow(全表 count)与 pageSize 切片;两者不相等是常态不是 bug
    const out = buildLegacySegment([row(1)], [], 500)
    expect(out.list).toHaveLength(1)
    expect(out.total).toBe(500)
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠