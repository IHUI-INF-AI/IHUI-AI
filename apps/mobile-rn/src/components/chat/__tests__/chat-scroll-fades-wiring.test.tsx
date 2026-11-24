// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ChatScrollFades × useChatScrollFades「组件接线」集成测试(2026-11-10 追加票,路 B 常驻回归锁)。
 *
 * 判据本体与桥接优先链已由 chat-scroll-fades.test.tsx 钉死;本套件钉的是接线链一环:
 *   RN 滚动事件(onScroll/onLayout/onContentSizeChange)→ hook 状态 → 遮罩层 DOM 显隐/几何。
 * 事件序列(视口 600 / 内容 2000,与真浏览器 harness 同参):
 *  ① 挂载即双隐藏(一切未测量 ⇒ 无遮罩 DOM);
 *  ② onLayout 测得视口但无内容 ⇒ 仍双隐藏(不把「未测量内容」误判成底部溢出);
 *  ③ onContentSizeChange 溢出 ⇒ 仅底条;④ 滚动中段 ⇒ 双条;触底 ⇒ 仅顶条;回顶 ⇒ 仅底条;
 *  ⑤ 滚动事件视口未测量(layoutMeasurement=0)⇒ 双隐藏;
 *  ⑥ 两条遮罩层几何:24px 高、absolute 定位、inset 透传、pointer-events 穿透、
 *     SVG 渐变方向(顶条边缘实底→内侧透明;底条反向)。
 *
 * 同序列已在真浏览器验证(expo start --web + react-native-web 真 ScrollView 一次性 harness,
 * 2026-11-10:mount⇒仅底;scroll1000⇒双;触底⇒仅顶;回顶⇒仅底,零页面错误)。
 * 本套件是该证据链的常驻形态,CI 可跑。
 */
import { describe, expect, it } from 'vitest'
import { act, render } from '@testing-library/react'
import { View } from 'react-native'
import {
  CHAT_EDGE_FADE_HEIGHT_PX,
  ChatScrollFades,
  useChatScrollFades,
  type UseChatScrollFadesResult,
} from '../ChatScrollFades'

/** 宿主同款入口捕获:测试直接调用 hook 返回的三个事件处理器 */
let fades: UseChatScrollFadesResult | null = null

function WiringHarness({ topInset, bottomInset }: { topInset?: number; bottomInset?: number }) {
  const f = useChatScrollFades()
  fades = f
  return (
    <View style={{ position: 'relative' }}>
      <ChatScrollFades
        topVisible={f.topVisible}
        bottomVisible={f.bottomVisible}
        topInset={topInset}
        bottomInset={bottomInset}
      />
    </View>
  )
}

const layoutEvent = (height: number) =>
  ({ nativeEvent: { layout: { x: 0, y: 0, width: 375, height } } }) as never
const scrollEvent = (offset: number, contentHeight: number, viewportHeight: number) =>
  ({
    nativeEvent: {
      contentOffset: { x: 0, y: offset },
      contentSize: { width: 375, height: contentHeight },
      layoutMeasurement: { width: 375, height: viewportHeight },
    },
  }) as never

/** 当前上屏的渐变层 id(顺序:JSX 顶先底后) */
const layerIds = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('linearGradient'))
    .map((g) => g.id)
    .filter((id) => id.startsWith('ihuiEdgeFade'))

/**
 * 取一层的三层 DOM:渐变本体(svg)→ BottomFadeMask 层(style 携带 pointerEvents:none)
 * → ChatScrollFades 定位层(inset/height)。层级形状即组件源码结构,选择器只按结构取。
 */
const layerOf = (container: HTMLElement, id: string) => {
  const g = container.querySelector(`linearGradient#${id}`)
  expect(g, `遮罩层 ${id} 未上屏`).not.toBeNull()
  const svg = g!.closest('svg')!
  const maskDiv = svg.parentElement as HTMLElement
  const posDiv = maskDiv.parentElement as HTMLElement
  return { id, maskDiv, posDiv, stops: Array.from(svg.querySelectorAll('stop')) }
}

describe('ChatScrollFades × useChatScrollFades 接线:事件序列驱动显隐', () => {
  it('顶对齐,底部溢出⇒仅底条;中段⇒双条;触底⇒仅顶条;回顶⇒仅底条', () => {
    const { container } = render(<WiringHarness />)
    expect(fades).not.toBeNull()
    // ① 挂载即双隐藏
    expect(layerIds(container)).toEqual([])
    // ② 视口测得但内容未报 ⇒ 仍双隐藏
    act(() => fades!.onLayout(layoutEvent(600)))
    expect(layerIds(container)).toEqual([])
    // ③ 内容溢出 ⇒ 仅底条
    act(() => fades!.onContentSizeChange(375, 2000))
    expect(layerIds(container)).toEqual(['ihuiEdgeFade-bottom'])
    // ④ 中段双条 → 触底仅顶 → 回顶仅底
    act(() => fades!.onScroll(scrollEvent(500, 2000, 600)))
    expect(layerIds(container)).toEqual(['ihuiEdgeFade-top', 'ihuiEdgeFade-bottom'])
    act(() => fades!.onScroll(scrollEvent(1400, 2000, 600)))
    expect(layerIds(container)).toEqual(['ihuiEdgeFade-top'])
    act(() => fades!.onScroll(scrollEvent(0, 2000, 600)))
    expect(layerIds(container)).toEqual(['ihuiEdgeFade-bottom'])
  })

  it('滚动事件视口未测量(layoutMeasurement=0)⇒ 双隐藏(不误判成底部溢出)', () => {
    const { container } = render(<WiringHarness />)
    act(() => {
      fades!.onLayout(layoutEvent(600))
      fades!.onContentSizeChange(375, 2000)
    })
    expect(layerIds(container)).toEqual(['ihuiEdgeFade-bottom'])
    act(() => fades!.onScroll(scrollEvent(100, 2000, 0)))
    expect(layerIds(container)).toEqual([])
    // 视口重新测得即恢复
    act(() => fades!.onLayout(layoutEvent(600)))
    expect(layerIds(container)).toEqual(['ihuiEdgeFade-top', 'ihuiEdgeFade-bottom'])
  })

  it('两条遮罩层几何:24px 高、absolute、inset 透传、pointer-events 穿透、渐变方向正确', () => {
    const { container } = render(<WiringHarness topInset={8} bottomInset={40} />)
    act(() => {
      fades!.onLayout(layoutEvent(600))
      fades!.onScroll(scrollEvent(500, 2000, 600))
    })
    const top = layerOf(container, 'ihuiEdgeFade-top')
    const bottom = layerOf(container, 'ihuiEdgeFade-bottom')
    // 定位层:贴边 24px 带,inset 由宿主透传
    for (const l of [top, bottom]) {
      expect(l.posDiv.style.position).toBe('absolute')
      expect(l.posDiv.style.height).toBe(`${CHAT_EDGE_FADE_HEIGHT_PX}px`)
      expect(l.posDiv.style.left).toBe('0px')
      expect(l.posDiv.style.right).toBe('0px')
    }
    expect(top.posDiv.style.top).toBe('8px')
    expect(bottom.posDiv.style.bottom).toBe('40px')
    // 穿透:渐变本体层 style 携带 pointerEvents:none(不挡滚动与点击)
    expect(top.maskDiv.style.pointerEvents).toBe('none')
    expect(bottom.maskDiv.style.pointerEvents).toBe('none')
    // 外层 overlay:absoluteFill 铺满四边
    const overlay = top.posDiv.parentElement as HTMLElement
    expect(overlay.style.position).toBe('absolute')
    expect(overlay.style.top).toBe('0px')
    expect(overlay.style.bottom).toBe('0px')
    // 渐变方向:顶条边缘(0%)实底→内侧(100%)透明;底条反向
    expect(top.stops.map((s) => s.getAttribute('stop-opacity'))).toEqual(['1', '0'])
    expect(bottom.stops.map((s) => s.getAttribute('stop-opacity'))).toEqual(['0', '1'])
    // 两层共用同一底色(默认页面背景令牌)
    expect(top.stops[0]?.getAttribute('stop-color')).toBe(
      bottom.stops[0]?.getAttribute('stop-color'),
    )
  })

  it('宿主可覆盖渐变高度与底色(抽屉面板场景)', () => {
    const { container } = render(<WiringHarness />)
    act(() => {
      fades!.onLayout(layoutEvent(600))
      fades!.onContentSizeChange(375, 2000)
    })
    const bottom = layerOf(container, 'ihuiEdgeFade-bottom')
    const bg = bottom.stops[0]?.getAttribute('stop-color')
    expect(bg).toBeTruthy()
    // color prop 覆盖后两层 stopColor 同变(面板底色场景)
    const { container: c2 } = render(
      <ChatScrollFades topVisible bottomVisible color="#123456" heightPx={32} />,
    )
    const t = layerOf(c2, 'ihuiEdgeFade-top')
    const b = layerOf(c2, 'ihuiEdgeFade-bottom')
    expect(t.posDiv.style.height).toBe('32px')
    expect(t.stops[0]?.getAttribute('stop-color')).toBe('#123456')
    expect(b.stops[0]?.getAttribute('stop-color')).toBe('#123456')
    expect(t.stops[0]?.getAttribute('stop-color')).not.toBe(bg)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
