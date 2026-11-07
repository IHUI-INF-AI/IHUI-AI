// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 模型编辑页薄壳化形制锁(2026-11-06 路 1)
//
// 本册判的是「页面只剩 wrapper + 共享屏入口,周期/面向群体/加载态/取消键全走显式注入」:
//  ① 小程序三档周期(月/季/年)与两档面向群体(个人/企业)真传参,且与 RN 端口径不同;
//  ② loading / showCancel 两端显式传(小程序 false、RN true);
//  ③ 共享屏不内建这两组选项、取消键按 showCancel 分支渲染;
//  ④ 端内不自绘、不桶导入;共享屏零平台 API;
//  ⑤ 零单端 prop:两端传给共享屏的 prop 名集合逐名对齐(只在其中一端传的 prop 会让本册红)。

import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

const captured = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}))

vi.mock('@ihui/rn-app/features/model-edit/ModelEditScreen', () => ({
  ModelEditScreen: (props: Record<string, unknown>) => {
    captured.props = props
    return createElement('div', { 'data-shell': 'model-edit' })
  },
}))

vi.mock('@tarojs/taro', () => ({
  useRouter: () => ({ params: { id: 'agent-1' } }),
  useDidShow: () => undefined,
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'zh-CN' }),
  useTt: () => (_key: string, fallback: string) => fallback,
  t: (key: string) => key,
}))

vi.mock('@/components/ThemeRoot', () => ({
  default: (props: { children?: ReactNode }) =>
    createElement('div', { 'data-theme-root': '' }, props.children),
}))

vi.mock('@/api', () => ({ get: vi.fn(async () => ({ name: '测试模型', prologue: '开场白' })) }))
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/host/on-toast', () => ({ onToast: vi.fn() }))
vi.mock('@/rn-compat/theme', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('@ihui/shared/utils', () => ({ submitModelEdit: vi.fn() }))
vi.mock('@ihui/api-client', () => ({ updateAgentBilling: vi.fn() }))

import ModelEditPage from '../src/pkg-ai/dev-enter/model-edit/index'

const PAGE_SOURCE = readFileSync(resolve('src/pkg-ai/dev-enter/model-edit/index.tsx'), 'utf8')
const SHARED_SOURCE = readFileSync(
  resolve('../../packages/app/src/features/model-edit/ModelEditScreen.tsx'),
  'utf8',
)
const RN_SOURCE = readFileSync(
  resolve('../../apps/mobile-rn/src/screens/ModelEditScreen.tsx'),
  'utf8',
)

const PLATFORM_TOKENS = [
  'Taro',
  'wx.',
  'react-navigation',
  'Linking',
  'AsyncStorage',
  'localStorage',
  'fetch(',
  'axios',
  'Alert.',
  'canIUse',
  'getRecorderManager',
  'setClipboardData',
]

/** 取某个 `<Tag ... />` 开标签上的 prop 名(两种端都直接写 `name={...}`) */
function jsxPropNames(source: string, tag: string): string[] {
  const start = source.indexOf(`<${tag}`)
  const end = source.indexOf('/>', start)
  const block = source.slice(start, end)
  return [...block.matchAll(/(\w+)=\{/g)].flatMap((m) => (m[1] ? [m[1]] : [])).sort()
}

describe('模型编辑页(壳承载形制)', () => {
  const html = renderToStaticMarkup(createElement(ModelEditPage))

  it('① 共享屏真被渲染,主题根在外层', () => {
    expect(html).toContain('data-shell="model-edit"')
    const theme = html.indexOf('data-theme-root')
    const shell = html.indexOf('data-shell="model-edit"')
    expect(theme).toBeGreaterThanOrEqual(0)
    expect(shell).toBeGreaterThan(theme)
    expect(captured.props).toBeTruthy()
  })

  it('② 小程序三档周期 + 两档面向群体显式传参(与 RN 口径不同)', () => {
    const props = captured.props
    expect(props?.cycleOptions).toEqual([
      { value: 'month', label: '月' },
      { value: 'quarter', label: '季' },
      { value: 'year', label: '年' },
    ])
    expect(props?.audienceOptions).toEqual([
      { value: 'individual', label: '个人' },
      { value: 'enterprise', label: '企业' },
    ])
    const fields = props?.fields as Record<string, unknown>
    expect(fields.cycle).toBe('month')
    expect(fields.audience).toBe('individual')
    expect(fields.freeDur).toBe('7天')
    expect(fields.saleType).toBe('limited')
    // RN 端显式传的是另一组口径:月/年/永久 + 全部/会员
    expect(RN_SOURCE).toContain("value: 'permanent'")
    expect(RN_SOURCE).not.toContain("value: 'quarter'")
    expect(RN_SOURCE).toContain("value: 'all'")
    expect(RN_SOURCE).toContain("value: 'member'")
    expect(RN_SOURCE).not.toContain("value: 'individual'")
    expect(PAGE_SOURCE).toContain("value: 'quarter'")
    expect(PAGE_SOURCE).not.toContain("value: 'permanent'")
  })

  it('③ loading / showCancel 两端显式传不同值', () => {
    expect(captured.props?.loading).toBe(false)
    expect(captured.props?.showCancel).toBe(false)
    expect(RN_SOURCE).toContain('loading={false}')
    expect(RN_SOURCE).toContain('showCancel={true}')
    expect(PAGE_SOURCE).toContain('loading={loading}')
    expect(PAGE_SOURCE).toContain('showCancel={false}')
  })

  it('④ 零单端 prop:两端传给共享屏的 prop 名集合逐名对齐', () => {
    const pageProps = jsxPropNames(PAGE_SOURCE, 'SharedModelEditScreen')
    const rnProps = jsxPropNames(RN_SOURCE, 'SharedModelEditScreen')
    expect(pageProps.length).toBeGreaterThanOrEqual(10)
    expect(pageProps).toEqual(rnProps)
  })

  it('⑤ 端内不自绘、不桶导入', () => {
    expect(PAGE_SOURCE).toContain("from '@ihui/rn-app/features/model-edit/ModelEditScreen'")
    expect(PAGE_SOURCE).not.toMatch(/from '@ihui\/rn-app'\s*$/m)
    expect(PAGE_SOURCE).not.toMatch(/<View\b|<Text\b|<Picker\b|<ScrollView\b|<Image\b|<Input\b/)
  })

  it('⑥ 共享屏零平台 API,注入项真渲染', () => {
    for (const token of PLATFORM_TOKENS) {
      expect(SHARED_SOURCE).not.toContain(token)
    }
    expect(SHARED_SOURCE).toContain('cycleOptions.map')
    expect(SHARED_SOURCE).toContain('audienceOptions.map')
    expect(SHARED_SOURCE).toContain('showCancel ?')
    expect(SHARED_SOURCE).toContain('styles.headerSpacer')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
