// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  resolveRefreshControl,
  resolveScrollViewBox,
  resolveLowerThresholdPx,
  resolveTextLineClamp,
} from './props-resolution'

/**
 * 镜像钉:rn-compat 下拉刷新承接(ScrollView refresher 三件套的解析半边)。
 * 立因(2026-11-01):共享层 113 处 `<RefreshControl refreshing onRefresh>` 在小程序端
 * 三参全被丢弃 ⇒ 下拉刷新整条静默;解析层收进纯函数后,行为在这里逐格钉死。
 * 变异自证:把 resolveRefreshControl 里 `typeof p.onRefresh !== 'function'` 删掉,
 * 「无 onRefresh ⇒ null」两条用例当场红。
 */
function fakeElement(props: unknown): { props: unknown } {
  return { props }
}

describe('resolveRefreshControl', () => {
  it('非元素形(null/undefined/原始值)⇒ null,不开 refresher', () => {
    expect(resolveRefreshControl(null)).toBeNull()
    expect(resolveRefreshControl(undefined)).toBeNull()
    expect(resolveRefreshControl(42)).toBeNull()
    expect(resolveRefreshControl('RefreshControl')).toBeNull()
  })

  it('缺 props 的对象 ⇒ null', () => {
    expect(resolveRefreshControl({})).toBeNull()
    expect(resolveRefreshControl({ props: null })).toBeNull()
    expect(resolveRefreshControl({ props: 42 })).toBeNull()
  })

  it('onRefresh 不是函数 ⇒ null(refresher 开了没人接,只会转圈不止)', () => {
    expect(resolveRefreshControl(fakeElement({ refreshing: true }))).toBeNull()
    expect(resolveRefreshControl(fakeElement({ onRefresh: 'not-a-fn' }))).toBeNull()
  })

  it('标准形:refreshing + onRefresh ⇒ 三参全量解出', () => {
    const onRefresh = () => {}
    const got = resolveRefreshControl(fakeElement({ refreshing: true, onRefresh }))
    expect(got).not.toBeNull()
    expect(got?.refreshing).toBe(true)
    expect(got?.enabled).toBe(true)
    expect(got?.onRefresh).toBe(onRefresh)
  })

  it('refreshing 缺省/非 true ⇒ false(refresherTriggered 不许常亮)', () => {
    const got = resolveRefreshControl(fakeElement({ onRefresh: () => {} }))
    expect(got?.refreshing).toBe(false)
    const got2 = resolveRefreshControl(fakeElement({ refreshing: false, onRefresh: () => {} }))
    expect(got2?.refreshing).toBe(false)
  })

  it('enabled:false ⇒ enabled=false(RN 禁用位不丢)', () => {
    const got = resolveRefreshControl(fakeElement({ onRefresh: () => {}, enabled: false }))
    expect(got?.enabled).toBe(false)
    expect(got?.onRefresh).not.toBeNull()
  })
})

/**
 * ScrollView 高度边界纯函数(2026-11-06)。
 * 阴性对照:旧形制(不做包装、只透传 style)没有 innerStyle ⇒ 下面「flex:1 ⇒ height:100%」
 * 断言在旧行为下必红;阳性照:原语层外包 flex:1 容器后百分比基准成立。
 */
describe('resolveScrollViewBox', () => {
  it('竖向 flex:1 ⇒ 外包 flex 容器,内层 height:100%(Taro 需要的确定高度)', () => {
    const got = resolveScrollViewBox({ flex: 1 }, false)
    expect(got.wrapperStyle).toEqual({ flex: 1, minHeight: 0, minWidth: 0 })
    expect(got.innerStyle).toEqual({ height: '100%' })
  })

  it('flexGrow:1 与 flex:1 同义', () => {
    const got = resolveScrollViewBox({ flexGrow: 1 }, false)
    expect(got.wrapperStyle).not.toBeNull()
    expect(got.innerStyle.height).toBe('100%')
  })

  it('显式 height ⇒ 已是确定尺寸,不再包容器(不改变既有盒模型)', () => {
    const got = resolveScrollViewBox({ flex: 1, height: 300 }, false)
    expect(got.wrapperStyle).toBeNull()
    expect(got.innerStyle).toEqual({})
  })

  it('无 flex ⇒ 不包容器', () => {
    expect(resolveScrollViewBox({}, false).wrapperStyle).toBeNull()
    expect(resolveScrollViewBox({ height: 200 }, false).wrapperStyle).toBeNull()
  })

  it('横向 flex:1 ⇒ 基准是 width:100%,显式 width 时不包', () => {
    const got = resolveScrollViewBox({ flex: 1 }, true)
    expect(got.innerStyle).toEqual({ width: '100%' })
    expect(resolveScrollViewBox({ flex: 1, width: 375 }, true).wrapperStyle).toBeNull()
  })

  it('flex:0 不是"吃满父级",不触发包容器', () => {
    expect(resolveScrollViewBox({ flex: 0 }, false).wrapperStyle).toBeNull()
    expect(resolveScrollViewBox({ flexGrow: 0 }, false).wrapperStyle).toBeNull()
  })
})

/**
 * onEndReachedThreshold 单位换算(2026-11-06):RN ratio → Taro px。
 * 阴性对照:旧形制把 `onEndThreshold`(px 旧键)直传、完全忽略 `onEndReachedThreshold`
 * ⇒ 0.5 ratio 在 800px 视口下应得 400px,旧形制拿不到任何值。
 */
describe('resolveLowerThresholdPx', () => {
  it('0.5 ratio × 800px 视口 = 400px(RN 语义:距底半个视口触发)', () => {
    expect(resolveLowerThresholdPx(0.5, 800)).toBe(400)
  })

  it('取整与负值收敛:0.123×800=98.4 ⇒ 98;-1 ⇒ 0', () => {
    expect(resolveLowerThresholdPx(0.123, 800)).toBe(98)
    expect(resolveLowerThresholdPx(-1, 800)).toBe(0)
    expect(resolveLowerThresholdPx(0, 800)).toBe(0)
  })

  it('threshold 非数值 ⇒ undefined(保留 Taro 默认,不伪造 0)', () => {
    expect(resolveLowerThresholdPx(undefined, 800)).toBeUndefined()
    expect(resolveLowerThresholdPx(null, 800)).toBeUndefined()
    expect(resolveLowerThresholdPx('0.5', 800)).toBeUndefined()
    expect(resolveLowerThresholdPx(Number.NaN, 800)).toBeUndefined()
  })

  it('视口未知/为 0 ⇒ undefined(不拿 windowHeight 硬套导致过度触发)', () => {
    expect(resolveLowerThresholdPx(0.5, 0)).toBeUndefined()
    expect(resolveLowerThresholdPx(0.5, -1)).toBeUndefined()
  })
})

/**
 * numberOfLines≥2 转发(2026-11-06)。
 * 阴性对照:旧形制只处理 1 行,`resolveTextLineClamp(2/3)` 在旧行为下返回 {} ⇒ 本轮必红。
 */
describe('resolveTextLineClamp', () => {
  it('≥2 ⇒ 注入 numberOfLines 键,交给 style.ts clampFrom 生成 line-clamp', () => {
    expect(resolveTextLineClamp(2)).toEqual({ numberOfLines: 2 })
    expect(resolveTextLineClamp(3)).toEqual({ numberOfLines: 3 })
    expect(resolveTextLineClamp(2.9)).toEqual({ numberOfLines: 2 })
  })

  it('===1 ⇒ 维持旧 nowrap(不改变单行排版)', () => {
    expect(resolveTextLineClamp(1)).toEqual({ whiteSpace: 'nowrap' })
  })

  it('缺省/非法 ⇒ 空(不注入多余样式)', () => {
    expect(resolveTextLineClamp(undefined)).toEqual({})
    expect(resolveTextLineClamp(0)).toEqual({})
    expect(resolveTextLineClamp(-2)).toEqual({})
    expect(resolveTextLineClamp('2')).toEqual({})
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
