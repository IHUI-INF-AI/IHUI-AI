// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * alipay.formatTimestamp —— 支付宝 OpenAPI `timestamp` 必须与宿主时区无关。
 *
 * 立项因由:本机宿主时区 2026-09-04 被静默改成 UTC(25 天无人发现),而旧实现用 Date 的
 * 本地 getter(getFullYear/getHours…)取值 ⇒ 每一笔请求被签成"8 小时之前",支付宝在容差
 * 窗口外拒单(支付网关的真实集成故障,不是账面难看)。
 *
 * 三条判据各堵一种"假绿":
 *  1. **先证明改 process.env.TZ 在本进程里真的改变 Date 本地读数** —— 缺这一条,"三档输出
 *     相同"完全可能只是 TZ 没生效,那整道测试就从写下起恒绿(它什么都没说)。
 *  2. 固定瞬间 + **硬编码北京真值**当 oracle —— 只把两个代码路径互相比,谁都不对也照样绿。
 *  3. 同一瞬间在 UTC / Asia/Shanghai / America/New_York 三档下逐字相同。
 *
 * 取样刻意压在**北京日界**:1764000000000 是北京 00:00:00(同时踩 Intl `hour12:false`
 * 在午夜可能给出 "24" 的那一档),1764001800000 是北京 00:30:00(UTC 侧仍是前一天 ⇒
 * 旧的宿主本地写法连"日期"都会一起错,不只是错 8 小时)。
 */
import { describe, it, expect, afterAll } from 'vitest'
import { formatTimestamp } from '../alipay'

const HOST_ZONES = ['UTC', 'Asia/Shanghai', 'America/New_York'] as const
const ORIGINAL_TZ = process.env.TZ

const BEIJING_MIDNIGHT = 1764000000000
const BEIJING_MIDNIGHT_TEXT = '2025-11-25 00:00:00'
const NEAR_DAY_BOUNDARY = 1764001800000
const NEAR_DAY_BOUNDARY_TEXT = '2025-11-25 00:30:00'

afterAll(() => {
  // 原先未设 TZ 时必须 delete:赋值 undefined 会被写成字符串 "undefined",
  // 那等于给同一进程后续所有测试留下一个不存在的时区。
  if (ORIGINAL_TZ === undefined) {
    delete process.env.TZ
  } else {
    process.env.TZ = ORIGINAL_TZ
  }
})

describe('alipay formatTimestamp — 与宿主时区无关', () => {
  it('前置判据:改 process.env.TZ 确实改变 Date 本地读数(否则本文件全部断言都是恒绿的)', () => {
    process.env.TZ = 'UTC'
    const inUtc = new Date(BEIJING_MIDNIGHT).getHours()
    process.env.TZ = 'Asia/Shanghai'
    const inShanghai = new Date(BEIJING_MIDNIGHT).getHours()
    // 北京 00:00 == UTC 16:00;两值相同就说明 TZ 没生效,后面两条判据将无从证伪
    expect({ inUtc, inShanghai }).toEqual({ inUtc: 16, inShanghai: 0 })
  })

  it('固定瞬间 → 硬编码的北京时间真值(oracle,不是两路互比)', () => {
    process.env.TZ = 'Asia/Shanghai'
    expect(formatTimestamp(new Date(BEIJING_MIDNIGHT))).toBe(BEIJING_MIDNIGHT_TEXT)
    expect(formatTimestamp(new Date(NEAR_DAY_BOUNDARY))).toBe(NEAR_DAY_BOUNDARY_TEXT)
  })

  it('同一瞬间在 UTC / Asia/Shanghai / America/New_York 三档宿主时区下逐字相同', () => {
    for (const zone of HOST_ZONES) {
      process.env.TZ = zone
      // 把档位名拼进被比较值:红了的时候直接看得出是哪一档漏了,不必回读源码
      expect(`${zone} ${formatTimestamp(new Date(BEIJING_MIDNIGHT))}`).toBe(
        `${zone} ${BEIJING_MIDNIGHT_TEXT}`,
      )
      expect(`${zone} ${formatTimestamp(new Date(NEAR_DAY_BOUNDARY))}`).toBe(
        `${zone} ${NEAR_DAY_BOUNDARY_TEXT}`,
      )
    }
  })

  it('无论宿主时区,输出形状恒为支付宝协议要求的 yyyy-MM-dd HH:mm:ss', () => {
    for (const zone of HOST_ZONES) {
      process.env.TZ = zone
      expect(formatTimestamp(new Date())).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
