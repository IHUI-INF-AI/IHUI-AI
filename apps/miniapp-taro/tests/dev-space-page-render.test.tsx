// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 开发者空间页(pkg-ai/dev-space)形制锁 —— 2026-11-01 随「壳承载」迁移重写(枚 0fb91af8f8)。
 *
 * 旧版判的是端内手写实现:段落顺序 / 四入口 / 逐档圆角 / 取词键顺序。该实现已被
 * `scripts/gen-miniapp-mirror.mjs` 以壳承载形制**生成件**取代(端内不写布局、不写数据),
 * 旧判据的对象不复存在 —— 它现在判到的是 RN 壳的内部源码,而壳的正确性归 apps/mobile-rn
 * 自身的测试与构建。留着只会把"改源头"这个正确重构判红。
 *
 * 本册改判迁移后的真不变量,每条都能被破坏、破了就红:
 *  ① 壳真被渲染 —— import 了必须挂进树里("引了没用"是本仓最高频失效型);
 *  ② 主题根仍包在壳外层 —— 取词/主题接回端内真相源,不许壳自己读;
 *  ③ 端内不得偷偷长出第二份实现(入口表 / 取词键 / View 布局 / 圆角档一律不得回潮);
 *  ④ 生成件保持可再生成的干净形态(无 any、无浏览器弹窗、带生成器指纹);
 *  ⑤ 头注仍指向共享屏源头(改这一页的行为要去改源头,不是改生成件)。
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

// 壳边界桩:RN 壳是 Flow / React Native 形态,vitest 的 esbuild 管不了(实测
// `Parse failure: Expected 'from', got 'typeOf'` 打在 react-native/index.js)。
// 本册判的是**页面有没有把壳接上**,不是壳内部实现 ⇒ 在边界处切断。
vi.mock('@rn-shells/DeveloperScreen', () => {
  const Stub = () => createElement('div', { 'data-shell': 'developer-screen' })
  Stub.displayName = 'DeveloperScreenShellStub'
  return { default: Stub }
})

vi.mock('@tarojs/taro', () => {
  const Taro = { setNavigationBarTitle: vi.fn() }
  return { default: Taro, ...Taro }
})

vi.mock('@/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'zh-CN' }),
}))

vi.mock('@/components/ThemeRoot', () => {
  const Stub = (props: { children?: ReactNode }) =>
    createElement('div', { 'data-theme-root': '' }, props.children)
  Stub.displayName = 'ThemeRootStub'
  return { default: Stub }
})

import DevSpace from '../src/pkg-ai/dev-space/index'

const PAGE_SOURCE = readFileSync(resolve('src/pkg-ai/dev-space/index.tsx'), 'utf8')

describe('开发者空间页(壳承载形制)', () => {
  const html = renderToStaticMarkup(createElement(DevSpace))

  it('① 壳真被渲染:引了 @rn-shells/DeveloperScreen 且确实挂进树里', () => {
    expect(PAGE_SOURCE).toContain("from '@rn-shells/DeveloperScreen'")
    expect(html).toContain('data-shell="developer-screen"')
  })

  it('② 主题根包在壳外层(取词/主题接回端内真相源,不由壳自取)', () => {
    const theme = html.indexOf('data-theme-root')
    const shell = html.indexOf('data-shell="developer-screen"')
    expect(theme).toBeGreaterThanOrEqual(0)
    expect(shell).toBeGreaterThan(theme)
  })

  it('③ 端内不写布局/数据:第二份入口表、取词键、View 布局、圆角档一律不得回潮', () => {
    expect(PAGE_SOURCE).not.toContain('DEVELOPER_SPACE_ENTRIES')
    expect(PAGE_SOURCE).not.toContain('entryMyAgents')
    expect(PAGE_SOURCE).not.toMatch(/devSpace\.(entry|faq|contact)/)
    expect(PAGE_SOURCE).not.toMatch(/<View\b/)
    expect(PAGE_SOURCE).not.toMatch(/rounded-/)
  })

  it('④ 生成件干净:无 any、无浏览器弹窗、带生成器指纹', () => {
    expect(PAGE_SOURCE).not.toMatch(/: any\b|as any\b/)
    expect(PAGE_SOURCE).not.toMatch(/\balert\(|\bconfirm\(|\bprompt\(/)
    expect(PAGE_SOURCE).toContain('scripts/gen-miniapp-mirror.mjs')
  })

  it('⑤ 头注(剥掉水印横幅后)仍指向共享屏源头', () => {
    const firstContentLine = PAGE_SOURCE.split('\n')
      .map((l) => l.trim())
      .find(
        (l) =>
          l !== '' &&
          !l.startsWith('// ©') &&
          !l.startsWith('// Provenance') &&
          !l.includes('[IHUI-AI-PROVENANCE]'),
      )
    expect(firstContentLine).toContain(
      'packages/app/src/features/developer/DeveloperScreen.tsx',
    )
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
