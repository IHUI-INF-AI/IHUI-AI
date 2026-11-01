// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { resolveRefreshControl } from './props-resolution'

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
