// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// D5 小程序首页对话腿「受控 scrollTop 滚到底 + 共享气泡渲染」表征测试。
//
// 为什么要这样测(如实登记,不夸大覆盖面):
//   `scrollListToBottom` 本体是 React 页组件里的一句 `setState`(index.tsx:626-628),
//   直测组件要拉起整条 Taro 运行时 + @tarojs/components 的 ScrollView,重且脆,性价比低。
//   但这条修复里**真正承载判据的两块都是纯的、零平台 API 的**,可以便宜地钉死:
//     ① 步长算法 —— `+ 1_000_000` 单调递增超界(靠原生 clamp 到底);本文件用同算法复算
//        并用源码锚点锁住「实现确是这句」,防止有人改回固定常量/小步长/乒乓 hack。
//     ② 跟/停判据 —— shared/chat/stream-follow 的 shouldStickToBottom / 回退即交还 /
//        触底即恢复(三端唯一真相源)。
//   ScrollView 真正把值滚到位属于 Taro 运行时集成行为,靠真机验证,本测试不假装覆盖它。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  initialStreamFollowState,
  reduceStreamFollowOnReachBottom,
  reduceStreamFollowOnScroll,
  shouldStickToBottom,
} from '@ihui/shared/chat/stream-follow'

const ROOT = resolve(__dirname, '../../..')
const INDEX_TSX = resolve(ROOT, 'src/pages/index/index.tsx')
const source = readFileSync(INDEX_TSX, 'utf8')

/** 复现 index.tsx:627 的滚到底步长算法:受控 scrollTop 单调递增一个大步长。 */
const SCROLL_TO_BOTTOM_STEP = 1_000_000
const advanceToBottom = (current: number) => current + SCROLL_TO_BOTTOM_STEP

/** 兜住「到底」的列表高度上界:小程序对话列表实际远到不了这个量级(px)。 */
const LIST_HEIGHT_CEILING_PX = 100_000

describe('D5 滚到底步长算法(受控 scrollTop 单调递增超界)', () => {
  it('连续调用严格递增,且首个到达值即已覆盖列表高度上界', () => {
    let scrollTop = 0
    const observed: number[] = []
    // 模拟流式期间每 40ms 提交一帧才跟滚:连续多次贴底
    for (let frame = 0; frame < 50; frame += 1) {
      scrollTop = advanceToBottom(scrollTop)
      observed.push(scrollTop)
    }
    for (let i = 1; i < observed.length; i += 1) {
      expect(observed[i]).toBeGreaterThan(observed[i - 1])
    }
    // 第一次就把原生 clamp 推到底:任何合理列表高度都被覆盖
    expect(observed[0]).toBeGreaterThanOrEqual(LIST_HEIGHT_CEILING_PX)
    expect(observed.every((v) => Number.isFinite(v))).toBe(true)
  })

  it('每次都变(同值不触发重滚的死路被排除)', () => {
    // 固定常量会让第二次起全空操作 —— 步长算法保证任意两次都不相等
    const seen = new Set<number>()
    let scrollTop = 0
    for (let i = 0; i < 10; i += 1) {
      scrollTop = advanceToBottom(scrollTop)
      expect(seen.has(scrollTop)).toBe(false)
      seen.add(scrollTop)
    }
  })

  it('永不回退(小步长把位置拽回半路的死路被排除)', () => {
    let scrollTop = 0
    let prev = -1
    for (let i = 0; i < 10; i += 1) {
      scrollTop = advanceToBottom(scrollTop)
      expect(scrollTop).toBeGreaterThan(prev)
      prev = scrollTop
    }
  })

  it('源码锚点:scrollListToBottom 确是 +1_000_000 单调递增', () => {
    expect(source).toMatch(/listScrollTop:\s*s\.listScrollTop\s*\+\s*1_000_000/)
  })

  it('源码锚点:ScrollView 绑定受控 scrollTop={state.listScrollTop}', () => {
    expect(source).toMatch(/scrollTop=\{state\.listScrollTop\}/)
  })

  it('源码锚点:旧的 pageScrollTo 滚底路径已废弃,残留仅首屏复位(scrollTop:0)', () => {
    const pageScrollCalls = [...source.matchAll(/Taro\.pageScrollTo\(\{([^}]*)\}\)/g)].map(
      (m) => m[1],
    )
    expect(pageScrollCalls.length).toBeGreaterThan(0)
    for (const args of pageScrollCalls) {
      // 首屏复位是 scrollTop:0,不是滚底;滚底那条跑不通的出路必须已删(§0.8)
      expect(args).toMatch(/scrollTop:\s*0/)
      expect(args).not.toMatch(/scrollTop:\s*9999|scrollTop:\s*1_000_000|listScrollTop/)
    }
  })
})

describe('D5 跟/停判据(shared/chat/stream-follow,三端唯一真相源)', () => {
  it('跟随时内容变化应贴底,停止流式后不再拽底', () => {
    expect(shouldStickToBottom(initialStreamFollowState(), true)).toBe(true)
    expect(shouldStickToBottom(initialStreamFollowState(), false)).toBe(false)
  })

  it('用户上翻(位置回退)即交还滚动权,此后不再贴底', () => {
    let follow = reduceStreamFollowOnScroll(initialStreamFollowState(), 500)
    expect(follow.following).toBe(true)
    follow = reduceStreamFollowOnScroll(follow, 300)
    expect(follow.following).toBe(false)
    expect(shouldStickToBottom(follow, true)).toBe(false)
  })

  it('触底即恢复跟随;亚像素抖动不算上翻', () => {
    let follow = reduceStreamFollowOnScroll(initialStreamFollowState(), 500)
    follow = reduceStreamFollowOnScroll(follow, 300)
    expect(follow.following).toBe(false)
    follow = reduceStreamFollowOnReachBottom(follow)
    expect(follow.following).toBe(true)
    // 亚像素抖动(< EPSILON=2)不改判定
    const jitter = reduceStreamFollowOnScroll(initialStreamFollowState(), 500)
    expect(reduceStreamFollowOnScroll(jitter, 499).following).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
