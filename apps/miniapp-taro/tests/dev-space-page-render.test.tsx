// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 开发者空间落地页(pkg-ai/dev-space)渲染测试:把「与 RN 共享屏逐元素同形」钉成机器判据。
// 判据对象是跨端最易漂移的三件事:段落顺序、分段数据来源(共享表)、圆角/描边/CTA 取档。
// 夹具里的 mock 只用于切断平台依赖,不改变被测构成本身。
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  DEVELOPER_SPACE_ENTRIES,
  DEVELOPER_SPACE_PROBLEMS,
} from '@ihui/shared/constants/developer-space'

vi.mock('@tarojs/taro', () => {
  const Taro = {
    setNavigationBarTitle: vi.fn(),
    navigateTo: vi.fn(),
    setClipboardData: vi.fn(),
    showToast: vi.fn(),
    getStorageSync: () => '',
    setStorageSync: () => {},
    useDidShow: vi.fn(),
  }
  return { default: Taro, ...Taro }
})

vi.mock('@tarojs/components', () => {
  const make = (tag: string) => {
    const Comp = (props: Record<string, unknown>) => createElement(tag, props)
    Comp.displayName = `TaroStub_${tag}`
    return Comp
  }
  return {
    View: make('div'),
    Text: make('span'),
    Image: make('img'),
    ScrollView: make('div'),
  }
})

// 取词一律回吐键名:渲染层必须逐字使用共享屏的取词键,否则本断言当场失效
vi.mock('@/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'zh-CN' }),
  useTt: () => (key: string, fb: string) => `${key}::${fb}`,
  t: (key: string) => key,
}))

vi.mock('@/api', () => ({
  getProfile: () => Promise.resolve(null),
  getMyDeveloperSubscription: () => Promise.resolve(null),
}))

vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

vi.mock('@/components/ThemeRoot', () => {
  const Stub = (props: { children?: ReactNode }) => createElement('div', null, props.children)
  Stub.displayName = 'ThemeRootStub'
  return { default: Stub }
})

// LineIcon 用 mask-image 绘字形(与本端真实实现同形),夹具只把字形名暴露成 data 属性
vi.mock('@/components/LineIcon', () => {
  const Stub = (props: { name?: string }) => createElement('i', { 'data-glyph': props.name ?? '' })
  Stub.displayName = 'LineIconStub'
  return { default: Stub }
})

import DevSpace from '../src/pkg-ai/dev-space/index'

const PAGE_FILE = resolve('src/pkg-ai/dev-space/index.tsx')
const PAGE_SOURCE = readFileSync(PAGE_FILE, 'utf8')

describe('开发者空间落地页与共享屏逐元素同形', () => {
  const html = renderToStaticMarkup(createElement(DevSpace))

  it('段落顺序 = 用户卡 CTA → 四入口 → 问题解答标题 → 客服卡', () => {
    const order = [
      'developer.becomeDeveloper::成为开发者',
      'devSpace.entryMyAgents',
      'devSpace.faqHeading',
      'devSpace.contactHeading',
    ].map((marker) => html.indexOf(marker))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('四入口构成/顺序/取词键全部取自共享表,端内没有第二份表', () => {
    expect(DEVELOPER_SPACE_ENTRIES.map((e) => `>${e.labelKey}<`)).toHaveLength(4)
    for (const entry of DEVELOPER_SPACE_ENTRIES) {
      expect(html).toContain(`>${entry.labelKey}<`)
    }
    const positions = DEVELOPER_SPACE_ENTRIES.map((e) => html.indexOf(`>${e.labelKey}<`))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(PAGE_SOURCE).toContain("from '@ihui/shared/constants/developer-space'")
    expect(PAGE_SOURCE).not.toContain('entryMyAgents:')
  })

  it('两张问题卡按 titleKey/descKey/btnKey 取词,顺序同共享表', () => {
    expect(DEVELOPER_SPACE_PROBLEMS).toHaveLength(2)
    const keys = DEVELOPER_SPACE_PROBLEMS.flatMap((p) => [p.titleKey, p.descKey, p.btnKey])
    const positions = keys.map((k) => html.indexOf(`>${k}<`))
    expect(positions.every((i) => i >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('无头像时回落共享表的默认 logo,未登录回落 devSpace.notLoggedIn', () => {
    expect(html).toContain('xtk/devlogo.png')
    expect(html).toContain('>devSpace.notLoggedIn<')
  })

  it('主按钮取 cta 成对档,圆角一律走标准档,全页无描边/分割线', () => {
    expect(html).toContain('rounded-sm bg-cta')
    expect(html).toContain('text-cta-foreground')
    const radius = [...html.matchAll(/rounded-[a-z0-9]*/g)].map((m) => m[0])
    expect(
      radius.every((r) =>
        ['rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl'].includes(r),
      ),
    ).toBe(true)
    expect(html).not.toMatch(/rounded-\[/)
    expect(html).not.toMatch(/border-[a-z]/)
    expect(html).not.toContain('<hr')
    expect(html).not.toMatch(/divide-/)
  })

  it('图标走本端 LineIcon(lucide 名),端内不出现字符箭头与 emoji', () => {
    expect(html).toContain('data-glyph="bot"')
    expect(html).not.toMatch(/[›»→‹←]/)
    expect(PAGE_SOURCE).not.toMatch(/\balert\(|\bconfirm\(|\bprompt\(|title="/)
    expect(PAGE_SOURCE).not.toMatch(/: any\b|as any\b/)
  })

  it('头注首行(剥掉水印横幅后)是真实指向的共享屏路径', () => {
    const firstContentLine = PAGE_SOURCE.split('\n')
      .map((l) => l.trim())
      .find(
        (l) =>
          l !== '' &&
          !l.startsWith('// ©') &&
          !l.startsWith('// Provenance') &&
          !l.includes('[IHUI-AI-PROVENANCE]'),
      )
    expect(firstContentLine).toBe(
      '// 对齐目标(RN 共享屏): packages/app/src/features/developer/DeveloperScreen.tsx',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
