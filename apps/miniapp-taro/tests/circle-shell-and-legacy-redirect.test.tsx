// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序圈子壳页/旧路由重定向锁(2026-11-26)。
 *
 * 判据:① 新入口只包 ThemeRoot + @rn-shells/CircleIndexScreen,不端内自绘圈子列表;
 * ② 三条旧路由(广场/详情/发帖)都 redirectTo 到 group 共享壳,不再把 group 当帖子;
 * ③ 旧 AI 圈子页也不保留第三份帖子流。
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

const h = vi.hoisted(() => ({ rendered: false }))

vi.mock('@rn-shells/CircleIndexScreen', () => ({
  CircleIndexScreen: () => {
    h.rendered = true
    return createElement('div', { 'data-screen': 'circle-index' })
  },
}))

vi.mock('@/components/RnShellPage', () => {
  const Stub = (props: { children?: ReactNode }) =>
    createElement('div', { 'data-rn-shell-page': '' }, props.children)
  Stub.displayName = 'RnShellPageStub'
  return { default: Stub }
})

import CircleIndexPage from '../src/pkg-user/circle-index/index'

const read = (path: string) => readFileSync(resolve(path), 'utf8')

describe('小程序圈子入口', () => {
  it('新入口直引 RN 圈子壳,不端内取数/自绘', () => {
    const source = read('src/pkg-user/circle-index/index.tsx')
    expect(source).toContain("from '@/components/RnShellPage'")
    expect(source).toContain("from '@rn-shells/CircleIndexScreen'")
    expect(source).not.toContain('getCircleList(')
    expect(source).not.toContain('Taro.request')
  })

  it('RnShellPage 为自定义导航壳页垫状态栏顶距', () => {
    const source = read('src/components/RnShellPage.tsx')
    expect(source).toContain('getTopBarMetrics()')
    expect(source).toContain('paddingTop: statusBarHeight')
  })

  it('新入口渲染 @rn-shells/CircleIndexScreen', () => {
    const html = renderToStaticMarkup(createElement(CircleIndexPage))
    expect(html).toContain('data-screen="circle-index"')
    expect(h.rendered).toBe(true)
  })

  it('新入口关闭原生导航栏,避免与 RN NavBar 双顶栏', () => {
    const config = read('src/pkg-user/circle-index/index.config.ts')
    expect(config).toContain("navigationStyle: 'custom'")
    expect(config).toContain('enablePullDownRefresh: false')
  })
})

describe('圈子旧路由重定向', () => {
  it('广场旧页 → pkg-user/circle-index/index', () => {
    const source = read('src/pages/circle/index.tsx')
    expect(source).toContain("redirectTo({ url: '/pkg-user/circle-index/index' })")
  })

  it('详情旧页 → pkg-user/circle-detail/index?id=', () => {
    const source = read('src/pages/circle/detail.tsx')
    expect(source).toContain('/pkg-user/circle-detail/index?id=')
    expect(source).toContain('encodeURIComponent(id)')
  })

  it('发帖旧页 → pkg-content/circle-post/index?circleId=', () => {
    const source = read('src/pages/circle/create.tsx')
    expect(source).toContain('/pkg-content/circle-post/index')
    expect(source).toContain('circleId')
  })

  it('AI 圈子旧页也回广场,不留第三份帖子流', () => {
    const source = read('src/pkg-ai/ai-circle/index.tsx')
    expect(source).toContain("redirectTo({ url: '/pkg-user/circle-index/index' })")
  })

  it('详情/发帖共享壳页也关闭原生导航栏', () => {
    for (const path of [
      'src/pkg-user/circle-detail/index.config.ts',
      'src/pkg-content/circle-post/index.config.ts',
    ]) {
      expect(read(path)).toContain("navigationStyle: 'custom'")
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
