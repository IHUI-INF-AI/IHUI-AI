// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, act, cleanup } from '@testing-library/react'

const mockPathname = vi.hoisted(() => ({ value: '/' as string | null }))
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname.value,
}))

import { TopBarBackAutoRegister } from '../TopBarBackAutoRegister'
import { useTopBarBackStore } from '@/stores/topbar-back'
import type { TopBarBackConfig } from '@/stores/topbar-back'

function renderAuto() {
  // 注意:本环境(React 19 + RTL)renderHook 不挂载传入的组件元素,用 render(已验证范式)
  return render(<TopBarBackAutoRegister />)
}

describe('TopBarBackAutoRegister', () => {
  beforeEach(() => {
    useTopBarBackStore.setState({ config: null })
    mockPathname.value = '/'
  })

  it('二级子页面(/agents/123):自动声明 fallbackHref=一级父路由', () => {
    mockPathname.value = '/agents/123'
    const { unmount } = renderAuto()
    expect(useTopBarBackStore.getState().config).toEqual({ fallbackHref: '/agents' })
    unmount()
    expect(useTopBarBackStore.getState().config).toBeNull()
  })

  it('一级列表页与首页:不声明(顶栏返回键收起)', () => {
    mockPathname.value = '/agents'
    renderAuto()
    expect(useTopBarBackStore.getState().config).toBeNull()
    cleanup()
    mockPathname.value = '/'
    renderAuto()
    expect(useTopBarBackStore.getState().config).toBeNull()
  })

  it('免返回前缀:分享/认证/h5 壳路由不声明', () => {
    for (const p of [
      '/share/abc',
      '/chat/share/x1',
      '/business-card/share/x2',
      '/ai-world/share/x3',
      '/sso/github',
      '/h5/share/x4',
    ]) {
      mockPathname.value = p
      renderAuto()
      expect(useTopBarBackStore.getState().config).toBeNull()
      cleanup()
    }
  })

  it('en 语言镜像:剥掉 locale 前缀后按深度判定(/en/agents 为一级列表不声明)', () => {
    mockPathname.value = '/en/agents'
    renderAuto()
    expect(useTopBarBackStore.getState().config).toBeNull()
  })

  it('页面级自定义声明优先:已有注册时让位不覆盖', () => {
    mockPathname.value = '/cloud-run'
    const custom: TopBarBackConfig = { onBack: () => {} }
    act(() => useTopBarBackStore.getState().setConfig(custom))
    renderAuto()
    // auto 组件不应顶掉页面级声明
    expect(useTopBarBackStore.getState().config).toBe(custom)
  })

  it('路由切换:旧声明清理,新路由重新声明', () => {
    const { rerender } = renderAuto()
    mockPathname.value = '/agents/1'
    rerender(<TopBarBackAutoRegister />)
    expect(useTopBarBackStore.getState().config).toEqual({ fallbackHref: '/agents' })
    mockPathname.value = '/articles/9'
    rerender(<TopBarBackAutoRegister />)
    expect(useTopBarBackStore.getState().config).toEqual({ fallbackHref: '/articles' })
    mockPathname.value = '/agents'
    rerender(<TopBarBackAutoRegister />)
    expect(useTopBarBackStore.getState().config).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
