// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 对账「昨日账单日」必须是北京日历日 —— 与宿主时区无关。
 *
 * 立项因由:宿主时区 2026-09-04 被静默改成 UTC(25 天无人发现),而 reconciliation-service 的
 * formatDate 用 Date 的本地 getter 取值 ⇒ 每日 03:00 的自动对账请求了错误的账单日。
 * 修复出口 = 共享层唯一时区出口 `formatDateByTemplate`(与 alipay.formatTimestamp 同一份实现)。
 *
 * 三条判据各堵一种"假绿":
 *  1. **先证明改 process.env.TZ 在本进程里真的改变 Date 本地读数** —— 缺这一条,下面的
 *     "三档相同"完全可能只是 TZ 没生效,那整套断言从写下起恒绿(它什么都没说)。
 *  2. 固定瞬间 + **硬编码北京日历日**当 oracle —— 只把两个代码路径互相比,谁都不对也照样绿。
 *  3. 接线证明:`autoReconcileYesterday()` 真的把那个值交给账单下载口(而不是"helper 在位
 *     但没人调用" —— 本仓最高频失效型,见守门 64/70/81/115 同族)。
 *
 * 取样压在**争议窗口**:1764010800000 = 北京 2025-11-25 03:00(= UTC 2025-11-24 19:00)。
 * 该瞬间"昨日"的北京日历日是 2025-11-24;而 UTC 日历日 / 宿主本地(当宿主为 UTC 时)都是
 * 2025-11-23 —— 只有这一档能把对与错分开,午后取样则两种写法同值、测不出差异。
 */
import type * as AlipayModuleForMock from '../alipay.js'
import type * as WechatPayModuleForMock from '../wechat-pay.js'
import type * as OrderServiceModuleForMock from '../order-service.js'
import { describe, it, expect, afterAll, afterEach, vi } from 'vitest'

// 账单下载口与订单查询全部 mock:本文件只判"请求的是哪一天",不碰网络也不碰库。
const billCalls = vi.hoisted(() => ({ alipay: [] as string[], wechat: [] as string[] }))

vi.mock('../alipay.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AlipayModuleForMock>()
  return {
    ...actual,
    downloadBillUrl: vi.fn((billDate: string) => {
      billCalls.alipay.push(billDate)
      throw new Error('stub: 不发起真实下载')
    }),
    closeOrder: actual.closeOrder,
  }
})

vi.mock('../wechat-pay.js', async (importOriginal) => {
  const actual = await importOriginal<typeof WechatPayModuleForMock>()
  return {
    ...actual,
    downloadBill: vi.fn((billDate: string) => {
      billCalls.wechat.push(billDate)
      throw new Error('stub: 不发起真实下载')
    }),
  }
})

vi.mock('../order-service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof OrderServiceModuleForMock>()
  return {
    ...actual,
    findPaidOrdersByDate: vi.fn(async () => []),
    findExpiredOrders: vi.fn(async () => []),
  }
})

import { billDateForYesterday, autoReconcileYesterday } from '../reconciliation-service.js'

const HOST_ZONES = ['UTC', 'Asia/Shanghai', 'America/New_York'] as const
const ORIGINAL_TZ = process.env.TZ

/** 北京 2025-11-25 03:00(争议窗口内)。 */
const DISPUTED_NOW = 1764010800000
/** 该瞬间"昨天"的北京日历日 —— 人工核对的 oracle,不是任何一段代码的输出。 */
const EXPECTED_BEIJING_YESTERDAY = '2025-11-24'
/** 同一瞬间的 UTC 日历日(即被本票否定的那种写法会给出的值)。 */
const UTC_DAY_OF_PREVIOUS_INSTANT = '2025-11-23'

afterEach(() => {
  billCalls.alipay.length = 0
  billCalls.wechat.length = 0
  vi.restoreAllMocks()
})

afterAll(() => {
  // 原先未设 TZ 时必须 delete:赋值 undefined 会被写成字符串 "undefined",
  // 那等于给同一进程后续所有测试留下一个不存在的时区。
  if (ORIGINAL_TZ === undefined) {
    delete process.env.TZ
  } else {
    process.env.TZ = ORIGINAL_TZ
  }
})

describe('reconciliation-service.billDateForYesterday — 北京日历日,与宿主时区无关', () => {
  it('前置判据:改 process.env.TZ 确实改变 Date 本地读数(否则本文件全部断言都是恒绿的)', () => {
    process.env.TZ = 'UTC'
    const inUtc = new Date(DISPUTED_NOW).getHours()
    process.env.TZ = 'Asia/Shanghai'
    const inShanghai = new Date(DISPUTED_NOW).getHours()
    // 北京 03:00 == UTC 19:00;两值相同就说明 TZ 没生效,后面的判据将无从证伪
    expect({ inUtc, inShanghai }).toEqual({ inUtc: 19, inShanghai: 3 })
  })

  it('固定瞬间 → 硬编码的北京昨日日历日(oracle,不是两路互比)', () => {
    process.env.TZ = 'Asia/Shanghai'
    expect(billDateForYesterday(DISPUTED_NOW)).toBe(EXPECTED_BEIJING_YESTERDAY)
    // 控制组:同一瞬间的 UTC 日历日确实是前一天,证明上面那条不是"两个数本来就相等"
    expect(new Date(DISPUTED_NOW - 86400_000).toISOString().slice(0, 10)).toBe(
      UTC_DAY_OF_PREVIOUS_INSTANT,
    )
  })

  it('同一瞬间在 UTC / Asia/Shanghai / America/New_York 三档宿主时区下逐字相同', () => {
    for (const zone of HOST_ZONES) {
      process.env.TZ = zone
      // 把档位名拼进被比较值:红了的时候直接看得出是哪一档漏了,不必回读源码
      expect(`${zone} ${billDateForYesterday(DISPUTED_NOW)}`).toBe(
        `${zone} ${EXPECTED_BEIJING_YESTERDAY}`,
      )
    }
  })

  it('输出形状恒为网关协议要求的 yyyy-MM-dd', () => {
    for (const zone of HOST_ZONES) {
      process.env.TZ = zone
      expect(billDateForYesterday()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('接线:autoReconcileYesterday() 把北京昨日交给两个账单下载口(三档宿主时区同值)', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(DISPUTED_NOW)
    for (const zone of HOST_ZONES) {
      process.env.TZ = zone
      billCalls.alipay.length = 0
      billCalls.wechat.length = 0
      const result = await autoReconcileYesterday()
      expect({ zone, date: result.date }).toEqual({ zone, date: EXPECTED_BEIJING_YESTERDAY })
      expect({ zone, alipay: billCalls.alipay }).toEqual({
        zone,
        alipay: [EXPECTED_BEIJING_YESTERDAY],
      })
      expect({ zone, wechat: billCalls.wechat }).toEqual({
        zone,
        wechat: [EXPECTED_BEIJING_YESTERDAY],
      })
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
