// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ChatScrollFades 判据与桥接优先链单测(2026-11-10 立,追加票闭环)。
 *
 * 钉四组事:
 *  ① attachScrollFadesToFlatList 优先链:A(公共事件契约 addEventListener/getScrollMetrics,
 *     detach 时 removeEventListener + HOOK_KEY 复位)⇒ B(私有 _onScroll 包裹 + _scrollMetrics
 *     首帧补测,缺 contentLength 经 _listMetrics.getContentLength 兜底 —— 存量 bug 回归位)
 *     ⇒ C(皆不可用 no-op 不抛);D(同一 vl 重复 attach 只挂一次,HOOK_KEY 去重覆盖 A/B)。
 *  ② computeFadeVisibility 溢出判据(纯函数直测,不为测试引入渲染基建):顶 offset>EPS、
 *     底 contentLength−offset−visibleLength>EPS、视口未测量(visibleLength≤0)⇒ 双 false。
 *  ③ detach 后原 _onScroll 恢复:原生事件不再喂度量(host 的 feed 不再被触发 ⇒ 不再 setState)。
 *
 * 取证边界:jsdom 下测的是桥层契约(假 vl 对象),不是真机滚动;A/B 两级的探测顺序
 * 由「B 面存在但未被包裹」这类反向断言钉死,防未来重构悄悄把优先级颠倒。
 */
import { describe, expect, it, vi } from 'vitest'
import {
  attachScrollFadesToFlatList,
  computeFadeVisibility,
  type ScrollFadeMetrics,
} from '../ChatScrollFades'

/** 与源文件同值的去重标记(测试侧独立声明:值漂开会由用例失败暴露,正是想要的锁) */
const HOOK_KEY = '__ihuiChatScrollFade'

/** 构造原生滚动事件(形状对齐 RN NativeScrollEvent,只填桥接读取的三段) */
const scrollEvent = (offset: number, contentHeight: number, viewportHeight: number) =>
  ({
    nativeEvent: {
      contentOffset: { x: 0, y: offset },
      contentSize: { width: 375, height: contentHeight },
      layoutMeasurement: { width: 375, height: viewportHeight },
    },
  }) as never

/** attach 入参是 FlatList 实例(桥接读 list._listRef);测试按此包装假 vl */
const makeList = (vl: Record<string, unknown>) => ({ _listRef: vl })

const metricsOf = (
  offset: number,
  contentLength: number,
  visibleLength: number,
): ScrollFadeMetrics => ({
  offset,
  contentLength,
  visibleLength,
})

describe('attachScrollFadesToFlatList 优先链', () => {
  it('A:公共事件契约优先 —— 订阅 scroll、首帧 getScrollMetrics 归一化喂入、detach 退订并复位标记', () => {
    const addEventListener = vi.fn()
    const removeEventListener = vi.fn()
    const origOnScroll = vi.fn() // B 面同时存在:必须证明 A 优先、B 未被启用
    const vl: Record<string, unknown> = {
      getNativeScrollRef: () => ({ addEventListener, removeEventListener }),
      getScrollMetrics: () => ({
        contentOffset: { x: 0, y: 100 },
        contentLength: 1000,
        visibleLength: 600,
      }),
      _onScroll: origOnScroll,
      forceUpdate: vi.fn(),
    }
    const onMetrics = vi.fn()
    const detach = attachScrollFadesToFlatList(makeList(vl), onMetrics)

    expect(addEventListener).toHaveBeenCalledTimes(1)
    expect(addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function))
    // 首帧:公共 getScrollMetrics 的 contentOffset.y 归一化为 offset
    expect(onMetrics).toHaveBeenCalledWith(metricsOf(100, 1000, 600))
    // A 生效 ⇒ 私有 _onScroll 未被包裹(优先级锁:颠倒即此断言翻红)
    expect(vl._onScroll).toBe(origOnScroll)
    expect((vl as Record<string, unknown>)[HOOK_KEY]).toBe(true)

    // 事件喂的度量来自 nativeEvent 三段
    const cb = addEventListener.mock.calls[0]?.[1] as (e: unknown) => void
    cb(scrollEvent(250, 1200, 600))
    expect(onMetrics).toHaveBeenLastCalledWith(metricsOf(250, 1200, 600))

    detach()
    expect(removeEventListener).toHaveBeenCalledWith('scroll', cb)
    expect((vl as Record<string, unknown>)[HOOK_KEY]).toBe(false)
  })

  it('B:无公共契约 ⇒ 包裹 _onScroll + forceUpdate;_scrollMetrics 缺 contentLength 由 _listMetrics 兜底(存量 bug 回归)', () => {
    const orig = vi.fn()
    const forceUpdate = vi.fn()
    const vl: Record<string, unknown> = {
      // RN 0.86 私有 _scrollMetrics 真实形状:有 offset/visibleLength,没有 contentLength
      _scrollMetrics: { offset: 50, visibleLength: 400, dt: 16, timestamp: 123, velocity: 0 },
      _listMetrics: { getContentLength: () => 900 },
      _onScroll: orig,
      forceUpdate,
    }
    const onMetrics = vi.fn()
    const detach = attachScrollFadesToFlatList(makeList(vl), onMetrics)

    expect(forceUpdate).toHaveBeenCalledTimes(1)
    expect(vl._onScroll).not.toBe(orig) // 已包裹
    expect((vl as Record<string, unknown>)[HOOK_KEY]).toBe(true)
    // 首帧补测:contentLength 兜底自 _listMetrics.getContentLength(修复前此处喂 undefined)
    expect(onMetrics).toHaveBeenCalledWith(metricsOf(50, 900, 400))

    // 包裹版:先透传原逻辑,再喂事件度量
    const wrapped = vl._onScroll as (e: unknown) => void
    wrapped(scrollEvent(300, 1100, 400))
    expect(orig).toHaveBeenCalledTimes(1)
    expect(onMetrics).toHaveBeenLastCalledWith(metricsOf(300, 1100, 400))

    detach()
    expect(vl._onScroll).toBe(orig) // 原函数恢复
    expect((vl as Record<string, unknown>)[HOOK_KEY]).toBe(false)
    // detach 后事件不再喂度量 ⇒ host 的 feed 不再被触发(不再 setState)
    const n = onMetrics.mock.calls.length
    orig(scrollEvent(999, 1100, 400))
    expect(onMetrics).toHaveBeenCalledTimes(n)
  })

  it('C:可桥面全缺 ⇒ no-op,detach 不抛、零喂入;list 为空同样安全', () => {
    const onMetrics = vi.fn()
    const detach = attachScrollFadesToFlatList(makeList({}), onMetrics)
    expect(onMetrics).not.toHaveBeenCalled()
    expect(() => detach()).not.toThrow()
    expect(() => attachScrollFadesToFlatList(undefined, onMetrics)()).not.toThrow()
    expect(onMetrics).not.toHaveBeenCalled()
  })

  it('D:同一 vl 重复 attach 只挂一次(HOOK_KEY 去重,覆盖 A/B 两种模式)', () => {
    // A 模式:第二次 attach 不重复订阅、不重复首帧喂入,返回的 detach 为空操作
    const addEventListener = vi.fn()
    const vlA: Record<string, unknown> = {
      getNativeScrollRef: () => ({ addEventListener, removeEventListener: vi.fn() }),
      getScrollMetrics: () => ({
        contentOffset: { x: 0, y: 0 },
        contentLength: 500,
        visibleLength: 600,
      }),
    }
    const onA = vi.fn()
    attachScrollFadesToFlatList(makeList(vlA), onA)
    const callsAfterFirst = onA.mock.calls.length
    const detachSecond = attachScrollFadesToFlatList(makeList(vlA), onA)
    expect(addEventListener).toHaveBeenCalledTimes(1)
    expect(onA).toHaveBeenCalledTimes(callsAfterFirst)
    detachSecond() // 空操作:不得把第一次挂载的订阅退掉
    const cb = addEventListener.mock.calls[0]?.[1] as (e: unknown) => void
    cb(scrollEvent(120, 900, 600))
    expect(onA).toHaveBeenCalledTimes(callsAfterFirst + 1)

    // B 模式:第二次 attach 不再套一层(调用一次只喂一次;双套会喂两次)
    const orig = vi.fn()
    const vlB: Record<string, unknown> = {
      _onScroll: orig,
      forceUpdate: vi.fn(),
      _scrollMetrics: { offset: 10, contentLength: 800, visibleLength: 500 },
    }
    const onB = vi.fn()
    const d1 = attachScrollFadesToFlatList(makeList(vlB), onB) // 首帧 1 次
    attachScrollFadesToFlatList(makeList(vlB), onB) // 被 HOOK_KEY 拦下
    const wrapped = vlB._onScroll as (e: unknown) => void
    wrapped(scrollEvent(20, 800, 500))
    expect(onB).toHaveBeenCalledTimes(2) // 首帧 1 + 事件 1;若被二次包裹会是 3+
    d1()
  })
})

describe('computeFadeVisibility 溢出判据(与 Web 定稿一致)', () => {
  it('顶部:仅 offset > EPS(0.5) 才显示', () => {
    expect(computeFadeVisibility(metricsOf(0.5, 2000, 600)).topVisible).toBe(false)
    expect(computeFadeVisibility(metricsOf(0.6, 2000, 600)).topVisible).toBe(true)
  })
  it('底部:仅 contentLength − offset − visibleLength > EPS 才显示(视口底已到内容底则隐藏)', () => {
    expect(computeFadeVisibility(metricsOf(0, 600.5, 600)).bottomVisible).toBe(false)
    expect(computeFadeVisibility(metricsOf(0, 600.6, 600)).bottomVisible).toBe(true)
    expect(computeFadeVisibility(metricsOf(1400, 2000, 600)).bottomVisible).toBe(false) // 已滚到底
  })
  it('视口未测量(visibleLength ≤ 0)⇒ 双 false(不把「未测量」误判成底部溢出)', () => {
    expect(computeFadeVisibility(metricsOf(0, 5000, 0))).toEqual({
      topVisible: false,
      bottomVisible: false,
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
