// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 分类弹层(FenLeiOverlay)顶距避让状态栏的取证。
//
// 起因(真机实测,非推断):红米 2411DRN47C 首页 NavBar「分类」打开的赛道弹层,首行选项
// 「全公司/技术/设计」落在 y=10..74,而该机状态栏带 = 68px(34dp)—— 整行压在时钟/电量下面。
// 根因是本弹层用 `<Modal statusBarTranslucent>` 把窗口铺满整屏,而 Modal 渲染在
// `App.tsx` 的 `<SafeAreaView edges={['top']}>` 那一单点**之外**(守门 97 的 M1 那一格),
// 面板只写了 `paddingTop: 12`,所以状态栏没人避让。
//
// 为什么用两条对照而不是一条:只测 `insets.top=34 ⇒ 46` 的话,把 46 写死也能过。
// 所以必须同时测 `insets.top=0 ⇒ 12` —— 顶距要随 inset **动**,这才是本票的不变量。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const insetsBox = vi.hoisted(() => ({ top: 0 }))

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: insetsBox.top, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 375, height: 812 }),
}))

import { FenLeiOverlay } from '../src/components/FenLeiOverlay'

const TRACK = [
  { id: '', name: '全公司' },
  { id: 'tech', name: '技术' },
]
const MAIN = [{ id: '', name: '全部' }]

/** 面板 = 标题「分类」的直接父节点;取它落到元素上的实算顶距(不是读 styles 对象) */
function panelPaddingTop(): number {
  const head = Array.from(document.querySelectorAll('span')).find((s) => s.textContent === '分类')
  const panel = head?.parentElement
  if (!panel) throw new Error('未找到分类弹层面板(标题「分类」不在 DOM 里 ⇒ 弹层没渲染)')
  const raw = panel.style.paddingTop
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n))
    throw new Error(`面板 paddingTop 没有落到元素上(实读 ${JSON.stringify(raw)})`)
  return n
}

function openOverlay(): void {
  render(
    <FenLeiOverlay
      visible
      onClose={() => {}}
      trackCategories={TRACK}
      mainCategories={MAIN}
      selectedTrackId=""
      selectedMainId=""
      onConfirm={() => {}}
    />,
  )
}

describe('FenLeiOverlay 顶距避让状态栏', () => {
  beforeEach(() => {
    insetsBox.top = 0
    document.body.innerHTML = ''
  })

  it('真机档位(insets.top=34dp)下面板顶距 = 34 + 12,首行选项落在状态栏带之外', () => {
    insetsBox.top = 34
    openOverlay()
    expect(panelPaddingTop()).toBe(46)
  })

  it('反向对照:insets.top=0 时顶距回到 12 —— 证明加的是 inset,不是写死的 46', () => {
    insetsBox.top = 0
    openOverlay()
    expect(panelPaddingTop()).toBe(12)
  })

  it('顶距恒 >= 当前 inset(任何机型都不把内容送回状态栏带)', () => {
    for (const top of [0, 24, 34, 44, 59]) {
      document.body.innerHTML = ''
      insetsBox.top = top
      openOverlay()
      expect(panelPaddingTop()).toBeGreaterThanOrEqual(top)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
