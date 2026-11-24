// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 客户端会话回灌腿「未判定」降噪判据测试(2026-10-31 立)。
 *
 * 立因:qoder/workbuddy 回灌腿在服务身份(LocalSystem)下结构上读不到交互用户的
 * APPDATA/DPAPI,每 10 分钟一条同文 warn。降噪不能把"换了另一种失败"一起吞掉 ——
 * 本测试钉住:首轮必报、同因窗口内只累计、超窗重报、原因变化立即报。
 * 判据 import 自源文件 __test__(§22c,不在测试里复制实现)。
 */
import { describe, it, expect } from 'vitest'
import {
  decideUnjudgedLog,
  unjudgedReasonOf,
  DEFAULT_UNJUDGED_WARN_WINDOW_MS,
  type UnjudgedNoiseState,
} from '../src/services/relay-session-sync-noise.js'

const T0 = Date.parse('2026-10-31T23:00:00')
const REASON = '❌ 提取失败(未判定): 本机捕获失败(exit 1): 未找到 Qoder 数据目录'

describe('decideUnjudgedLog', () => {
  it('首轮必 warn(suppressed=0)', () => {
    const d = decideUnjudgedLog(undefined, REASON, T0)
    expect(d.warn).toBe(true)
    expect(d.suppressed).toBe(0)
    expect(d.state).toEqual({ reason: REASON, lastWarnAt: T0, suppressed: 0 })
  })

  it('同因窗口内不 warn,只累计被压下的轮数', () => {
    let state: UnjudgedNoiseState | undefined
    const first = decideUnjudgedLog(state, REASON, T0)
    state = first.state
    expect(first.warn).toBe(true)

    const second = decideUnjudgedLog(state, REASON, T0 + 10 * 60 * 1000)
    state = second.state
    expect(second.warn).toBe(false)
    expect(second.suppressed).toBe(1)

    const third = decideUnjudgedLog(state, REASON, T0 + 20 * 60 * 1000)
    expect(third.warn).toBe(false)
    expect(third.suppressed).toBe(2)
  })

  it('同因超过窗口 ⇒ 重报一次,并带上被压下的轮数后归零', () => {
    const state: UnjudgedNoiseState | undefined = { reason: REASON, lastWarnAt: T0, suppressed: 5 }
    const after = decideUnjudgedLog(state, REASON, T0 + DEFAULT_UNJUDGED_WARN_WINDOW_MS + 1)
    expect(after.warn).toBe(true)
    expect(after.suppressed).toBe(5)
    expect(after.state.suppressed).toBe(0)
    expect(after.state.lastWarnAt).toBe(T0 + DEFAULT_UNJUDGED_WARN_WINDOW_MS + 1)
  })

  it('原因变化 ⇒ 立即 warn(降噪不吞新失败形态)', () => {
    const state: UnjudgedNoiseState = { reason: REASON, lastWarnAt: T0, suppressed: 3 }
    const d = decideUnjudgedLog(state, '未找到 tsx(apps/api/node_modules/tsx)', T0 + 60_000)
    expect(d.warn).toBe(true)
    expect(d.suppressed).toBe(0)
    expect(d.state.reason).toContain('tsx')
  })

  it('窗口可注入(env 覆盖面),0 = 每轮都报', () => {
    const state: UnjudgedNoiseState = { reason: REASON, lastWarnAt: T0, suppressed: 0 }
    const d = decideUnjudgedLog(state, REASON, T0, 0)
    expect(d.warn).toBe(true)
  })
})

describe('unjudgedReasonOf', () => {
  it('取首个非空行并限长', () => {
    expect(unjudgedReasonOf('\n  \n❌ 回灌未判定\n第二行')).toBe('❌ 回灌未判定')
    expect(unjudgedReasonOf(`x${'y'.repeat(400)}`).length).toBe(200)
  })

  it('空 stderr 给稳定占位(不同失败不折叠成空串)', () => {
    expect(unjudgedReasonOf(undefined)).toBe('未判定(无 stderr)')
    expect(unjudgedReasonOf('   \n')).toBe('未判定(无 stderr)')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
