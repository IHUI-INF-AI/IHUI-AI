// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 主播端薄壳锁(apps/miniapp-taro/src/pkg-learn/live/host/index.tsx)。
// 判据:
//   ① 源码零 UI 段(无 @tarojs/components/FocusInput/<View/<Text),只挂 ThemeRoot + LiveHostScreen
//   ② props 全量映射(t 兜底/状态/时长/字节/商品/回调),renderToStaticMarkup 后逐项断言
//   ③ 宿主端口(剪贴板/toast/返回)走 @/host/on-toast 与 Taro 原生
//   (阴性对照:把任一 UI 段搬回页面 ⇒ ① 的红线立即命中;删任一文案兜底 ⇒ ② 回落到裸 key)

import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

const h = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
  toast: vi.fn(),
  modal: vi.fn(),
  clipboard: vi.fn(),
  back: vi.fn(),
  start: vi.fn(),
  end: vi.fn(),
}))

vi.mock('@ihui/rn-app/features/live-host/LiveHostScreen', () => ({
  LiveHostScreen: (p: Record<string, unknown>) => {
    h.props = p
    return createElement('div', { 'data-screen': 'live-host' })
  },
}))

vi.mock('@ihui/api-client', () => ({
  createSrsStream: h.start,
  updateSrsStream: h.end,
}))

vi.mock('@ihui/shared/utils', () => ({
  formatDuration: (s: number) => `00:${String(s).padStart(2, '0')}`,
}))

vi.mock('@/utils/api-bridge', () => ({ unwrapApi: async (p: unknown) => p }))
vi.mock('@/i18n', () => ({
  useTt: () => (key: string, fallback?: string) => fallback ?? key,
}))
vi.mock('@/host/on-toast', () => ({ onToast: h.toast }))
vi.mock('@/components/ThemeRoot', () => ({
  default: (p: { children?: ReactNode }) =>
    createElement('div', { 'data-theme-root': '' }, p.children),
}))
vi.mock('@tarojs/taro', () => {
  const api = { showModal: h.modal, setClipboardData: h.clipboard, navigateBack: h.back }
  return { default: api, ...api }
})

import LiveHost from '@/pkg-learn/live/host/index'

const SOURCE = readFileSync(resolve(__dirname, '../src/pkg-learn/live/host/index.tsx'), 'utf8')

function renderPage() {
  return renderToStaticMarkup(createElement(LiveHost))
}

describe('主播端薄壳', () => {
  it('① 源码零 UI 段:只挂 ThemeRoot + 共享屏(阴性对照:搬回任一 <View/<Text 即红)', () => {
    expect(SOURCE).toContain("from '@ihui/rn-app/features/live-host/LiveHostScreen'")
    expect(SOURCE).not.toContain('@tarojs/components')
    expect(SOURCE).not.toContain('FocusInput')
    expect(SOURCE).not.toMatch(/<View|<Text|<ScrollView/)
    expect(SOURCE).not.toContain('className=')
  })

  it('② props 全量映射:文案兜底/状态/时长/字节/商品', () => {
    const html = renderPage()
    expect(html).toContain('data-screen="live-host"')
    const p = h.props as Record<string, unknown>
    const t = p.t as (k: string) => string
    expect(t('liveHost.title')).toBe('主播中心')
    expect(t('liveHost.productManage')).toBe('商品管理')
    expect(t('liveHost.productEmpty')).toBe('暂无商品')
    expect(t('liveHost.statDuration')).toBe('直播时长')
    expect(t('liveHost.productManage')).not.toBe('liveHost.productManage')
    expect(p.status).toBe('idle')
    expect(p.streamTitle).toBe('')
    expect(p.durationText).toBe('00:00')
    expect(p.recvBytesText).toBe('0 B')
    expect(p.sendBytesText).toBe('0 B')
    expect(p.viewers).toBe(0)
    expect(p.products).toEqual([])
    expect(p.productsLoading).toBe(false)
    expect(p.productsError).toBe('')
  })

  it('③ 宿主端口:添加商品 toast / 复制落剪贴板 / 返回', () => {
    const p = h.props as Record<string, unknown>
    ;(p.onAddProduct as () => void)()
    expect(h.toast).toHaveBeenCalledWith('商品添加功能待接入', { kind: 'info' })
    ;(p.onCopyText as (text: string) => void)('rtmp://push')
    expect(h.clipboard).toHaveBeenCalledWith({ data: 'rtmp://push' })
    expect(h.toast).toHaveBeenCalledWith('已复制到剪贴板', { kind: 'success' })
    ;(p.onBack as () => void)()
    expect(h.back).toHaveBeenCalled()
  })

  it('④ 开播空标题:拦在壳层且不下发 SRS(阴性:删 titleRequired 兜底则文案变裸 key)', async () => {
    const p = h.props as Record<string, unknown>
    await (p.onStartLive as () => Promise<void>)()
    expect(h.start).not.toHaveBeenCalled()
    expect(h.toast).toHaveBeenCalledWith('请输入直播标题', { kind: 'info' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
