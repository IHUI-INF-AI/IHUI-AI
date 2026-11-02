// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 宿主端口运行时判据:replace 缺失不得静默回落 navigate;options.tab 必须透传。
 * 直接测 performHostNavigate(useHostNavigate 的唯一实现体),不渲染 React。
 */
import { describe, expect, it, vi } from 'vitest'

// 只测纯函数 performHostNavigate；不要加载真实 @react-navigation/native
// (其 theming 模块在 node 环境会因 Platform.select 缺失而崩)。
vi.mock('@react-navigation/native', () => ({ useNavigation: vi.fn() }))

import { performHostNavigate, type LooseNavigation } from '../src/host/use-host-ports'

function makeNav(hasReplace: boolean) {
  const navigate = vi.fn()
  const replace = vi.fn()
  const nav = {
    getState: () => ({ routeNames: ['Home', 'About'] }),
    navigate,
    ...(hasReplace ? { replace } : {}),
  } as LooseNavigation
  return { nav, navigate, replace }
}

describe('performHostNavigate', () => {
  it('replace 缺失 ⇒ CAPABILITY_OFF,绝不回落 navigate', () => {
    const { nav, navigate, replace } = makeNav(false)
    const outcome = performHostNavigate(nav, 'About', { id: 1 }, { replace: true })

    expect(outcome).toMatchObject({ status: 'capability-off', capability: 'replace' })
    expect(navigate).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it('replace 存在 ⇒ 只走 replace,不压 navigate', () => {
    const { nav, navigate, replace } = makeNav(true)
    const outcome = performHostNavigate(nav, 'About', { id: 1 }, { replace: true })

    expect(outcome).toMatchObject({ status: 'navigated', mode: 'replace' })
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('About', { id: 1 })
    expect(navigate).not.toHaveBeenCalled()
  })

  it('options.tab ⇒ 第三参透传 { tab: true },交给平台 switchTabIfNeeded', () => {
    const { nav, navigate } = makeNav(true)
    performHostNavigate(nav, 'Home', undefined, { tab: true })

    expect(navigate).toHaveBeenCalledWith('Home', undefined, { tab: true })
  })

  it('未登记 target ⇒ unregistered,不调用任何导航方法', () => {
    const { nav, navigate } = makeNav(true)
    const outcome = performHostNavigate(nav, 'Ghost', undefined, undefined)

    expect(outcome.status).toBe('unregistered')
    expect(navigate).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
