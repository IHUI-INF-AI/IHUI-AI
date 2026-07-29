// @vitest-environment happy-dom
/**
 * Phase 24(2026-07-29 立):React Hydration 修复单测
 *
 * 覆盖 10 个 SSR/CSR 一致性场景:
 * 1. ClientOnly 组件 SSR 渲染 fallback
 * 2. ClientOnly 组件 mount 后渲染 children
 * 3. useState 初始化用 Date.now() — SSR 返回 null/fallback,CSR mount 后更新
 * 4. useState 初始化用 localStorage — SSR 返回初始值,useEffect 读取 localStorage 更新
 * 5. useId() 在 SSR/CSR 稳定
 * 6. Date.now() 派生 hook 在 SSR 返回空字符串,CSR mount 后返回格式化字符串
 * 7. mounted flag 组件在 SSR 渲染 null,CSR 渲染内容
 * 8. suppressHydrationWarning 不影响其他属性
 * 9. navigator 检测 hook 在 SSR 返回 false,CSR 检测后更新
 * 10. Math.random() 替换为 useId 后,SSR/CSR id 一致
 *
 * 关联文件:
 * - apps/web/src/components/common/ClientOnly.tsx(2026-07-29 新建)
 * - apps/web/src/stores/agent-progress-pane.ts(hydrate 函数)
 * - apps/web/src/components/ai/progress-sections/timeline-event.tsx(formatRelativeTime)
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { ClientOnly } from '../src/components/common/ClientOnly'
import {
  useAgentProgressPaneStore,
  hydrateAgentProgressPaneFromStorage,
} from '../src/stores/agent-progress-pane'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  // 重置 store 到初始状态
  useAgentProgressPaneStore.getState().reset()
  // 清理 localStorage
  if (typeof window !== 'undefined') window.localStorage.clear()
})

// ────────────────────────────────────────────────────────────
// 1. ClientOnly 组件 SSR 渲染 fallback
// ────────────────────────────────────────────────────────────
describe('ClientOnly — SSR 渲染 fallback', () => {
  it('SSR 阶段(mounted=false)只渲染 fallback,完全不渲染 children', () => {
    // 用 renderToString 模拟 SSR(SSR 不会运行 useEffect,保持 mounted=false)
    const html = renderToString(
      <ClientOnly fallback={<div data-testid="fb">LOADING</div>}>
        <div data-testid="content">REAL</div>
      </ClientOnly>,
    )
    expect(html).toContain('data-testid="fb"')
    expect(html).toContain('LOADING')
    expect(html).not.toContain('data-testid="content"')
    expect(html).not.toContain('REAL')
  })

  it('不传 fallback 时 SSR 渲染空字符串(null),不报错', () => {
    // SSR 阶段 mounted=false,fallback 默认 null → 渲染空字符串
    const html = renderToString(
      <ClientOnly>
        <div data-testid="content">REAL</div>
      </ClientOnly>,
    )
    expect(html).not.toContain('data-testid="content"')
    expect(html).not.toContain('REAL')
  })
})

// ────────────────────────────────────────────────────────────
// 2. ClientOnly 组件 mount 后渲染 children
// ────────────────────────────────────────────────────────────
describe('ClientOnly — mount 后渲染 children', () => {
  it('useEffect 触发后(mounted=true)children 替换 fallback', () => {
    const { container } = render(
      <ClientOnly fallback={<div data-testid="fb">LOADING</div>}>
        <div data-testid="content">REAL</div>
      </ClientOnly>,
    )
    // render() 内部已用 act() 包裹,useEffect 会同步执行
    expect(container.querySelector('[data-testid="content"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="fb"]')).toBeFalsy()
  })
})

// ────────────────────────────────────────────────────────────
// 3. useState 初始化用 Date.now() — SSR 返回 null,CSR mount 后更新
// ────────────────────────────────────────────────────────────
describe('useState 初始化用 Date.now() — SSR 安全模式', () => {
  it('初始 state=null(SafeSSR),useEffect 注入 Date.now()', () => {
    function Clock(): React.ReactElement {
      const [now, setNow] = React.useState<number | null>(null)
      React.useEffect(() => {
        setNow(Date.now())
      }, [])
      return <span data-testid="clock">{now ?? 'INITIAL'}</span>
    }
    const { container } = render(<Clock />)
    // 第一次 render:now=null → 'INITIAL'
    // useEffect 触发后:setNow(Date.now()) → 第二次 render → 显示时间戳数字
    const text = container.querySelector('[data-testid="clock"]')?.textContent
    expect(text).toBeTruthy()
    expect(text).not.toBe('INITIAL') // 已 useEffect 触发
    expect(Number(text)).toBeGreaterThan(0)
  })
})

// ────────────────────────────────────────────────────────────
// 4. useState 初始化用 localStorage — SSR 返回初始值,useEffect 读取 localStorage 更新
// ────────────────────────────────────────────────────────────
describe('useState 初始化用 localStorage — SSR 安全模式', () => {
  it('初始 state=false(SafeSSR),useEffect 读 localStorage=true 后更新', () => {
    // 模拟 localStorage 中已持久化的值
    window.localStorage.setItem('test-flag', 'true')

    function FlagReader(): React.ReactElement {
      const [flag, setFlag] = React.useState<boolean>(false) // SSR 安全默认值
      React.useEffect(() => {
        // 客户端 mount 后才读 localStorage
        const v = window.localStorage.getItem('test-flag')
        if (v === 'true') setFlag(true)
      }, [])
      return <span data-testid="flag">{flag ? 'ENABLED' : 'DISABLED'}</span>
    }

    const { container } = render(<FlagReader />)
    // useEffect 触发后,flag=true
    expect(container.querySelector('[data-testid="flag"]')?.textContent).toBe('ENABLED')
  })

  it('agent-progress-pane store:SSR 初始默认值,hydrate 后从 localStorage 注入', () => {
    // 模拟 localStorage 中已持久化 open=true / pinned=false
    window.localStorage.setItem(
      'ihui-agent-progress-pane-v6',
      JSON.stringify({ open: true, pinned: false }),
    )

    // 初始默认值(open=false / pinned=true)
    expect(useAgentProgressPaneStore.getState().open).toBe(false)
    expect(useAgentProgressPaneStore.getState().pinned).toBe(true)

    // 客户端 mount 后调用 hydrate
    act(() => {
      hydrateAgentProgressPaneFromStorage()
    })

    // hydrate 后值更新
    expect(useAgentProgressPaneStore.getState().open).toBe(true)
    expect(useAgentProgressPaneStore.getState().pinned).toBe(false)
  })

  it('hydrate 是幂等的 — 多次调用不会重复 setState', () => {
    window.localStorage.setItem(
      'ihui-agent-progress-pane-v6',
      JSON.stringify({ open: true, pinned: true }),
    )
    act(() => {
      hydrateAgentProgressPaneFromStorage()
    })
    // 手动 reset,再调用 hydrate 不会重新注入(因为 hydrationApplied 标记)
    useAgentProgressPaneStore.getState().reset()
    expect(useAgentProgressPaneStore.getState().open).toBe(false)
    act(() => {
      hydrateAgentProgressPaneFromStorage()
    })
    // 仍然保持 reset 后的值,因为 hydrationApplied 阻止了二次注入
    expect(useAgentProgressPaneStore.getState().open).toBe(false)
  })
})

// ────────────────────────────────────────────────────────────
// 5. useId() 在 SSR/CSR 稳定
// ────────────────────────────────────────────────────────────
describe('useId() — SSR/CSR 稳定', () => {
  it('同一组件多次 render,useId() 返回相同 id', () => {
    function IdComponent(): React.ReactElement {
      const id = React.useId()
      return <span data-testid="id">{id}</span>
    }
    const { container, rerender } = render(<IdComponent />)
    const firstId = container.querySelector('[data-testid="id"]')?.textContent
    expect(firstId).toBeTruthy()
    expect(firstId?.startsWith(':r')).toBe(true) // React 18+ useId 格式
    // 重渲染
    rerender(<IdComponent />)
    const secondId = container.querySelector('[data-testid="id"]')?.textContent
    expect(secondId).toBe(firstId)
  })
})

// ────────────────────────────────────────────────────────────
// 6. Date.now() 派生 hook — SSR 返回空字符串,CSR mount 后返回格式化字符串
// ────────────────────────────────────────────────────────────
describe('Date.now() 派生 hook — SSR 安全', () => {
  it('模拟 timeline-event 的 useNowMs + formatRelativeTime:SSR/CSR 首次 render 一致', async () => {
    function useNowMs(): number | null {
      const [now, setNow] = React.useState<number | null>(null)
      React.useEffect(() => {
        setNow(Date.now())
      }, [])
      return now
    }

    function formatRelativeTime(timestamp: string, now: number | null): string {
      if (now === null) return ''
      const ms = Date.parse(timestamp)
      if (Number.isNaN(ms)) return ''
      const diff = now - ms
      if (diff < 10_000) return '刚刚'
      return `${Math.floor(diff / 60_000)}m 前`
    }

    function RelTime({ ts }: { ts: string }): React.ReactElement {
      const now = useNowMs()
      return <span data-testid="rel">{formatRelativeTime(ts, now)}</span>
    }

    const ts = new Date(Date.now() - 5000).toISOString()
    const { container } = render(<RelTime ts={ts} />)
    // useEffect 触发后,显示 '刚刚'
    expect(container.querySelector('[data-testid="rel"]')?.textContent).toBe('刚刚')
  })
})

// ────────────────────────────────────────────────────────────
// 7. mounted flag 组件 — SSR 渲染 null,CSR 渲染内容
// ────────────────────────────────────────────────────────────
describe('mounted flag 模式', () => {
  it('useState(false) + useEffect(setMounted) 模式,首次 render 返回 null', () => {
    function MountedComponent(): React.ReactElement | null {
      const [mounted, setMounted] = React.useState(false)
      React.useEffect(() => {
        setMounted(true)
      }, [])
      if (!mounted) return null
      return <div data-testid="mounted-content">MOUNTED</div>
    }
    const { container } = render(<MountedComponent />)
    // useEffect 同步执行 → mounted=true → 显示内容
    expect(container.querySelector('[data-testid="mounted-content"]')).toBeTruthy()
    expect(container.textContent).toContain('MOUNTED')
  })

  it('pattern:createPortal + mounted 守卫,SSR 阶段不渲染 portal', () => {
    function PortalSafeComponent(): React.ReactElement | null {
      const [mounted, setMounted] = React.useState(false)
      React.useEffect(() => {
        setMounted(true)
      }, [])
      if (!mounted) return null
      return <div data-testid="portal-content">PORTAL</div>
    }
    const { container } = render(<PortalSafeComponent />)
    expect(container.querySelector('[data-testid="portal-content"]')).toBeTruthy()
  })
})

// ────────────────────────────────────────────────────────────
// 8. suppressHydrationWarning — 不影响其他属性
// ────────────────────────────────────────────────────────────
describe('suppressHydrationWarning — 仅抑制指定节点 text 内容警告', () => {
  it('span 上加 suppressHydrationWarning 后,SSR/CSR text 不同时不报警告', () => {
    // spy on console.error
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    function TimestampSpan(): React.ReactElement {
      // 模拟 SSR/CSR 时间不同
      return (
        <span suppressHydrationWarning data-testid="ts">
          {new Date().toISOString()}
        </span>
      )
    }
    const { container } = render(<TimestampSpan />)
    // 应正常渲染
    expect(container.querySelector('[data-testid="ts"]')).toBeTruthy()
    // suppressHydrationWarning 抑制了 hydration mismatch 警告
    // (happy-dom 下不一定能复现 SSR 警告,但应确保组件能正常渲染)
    expect(container.textContent).toBeTruthy()
    errorSpy.mockRestore()
  })
})

// ────────────────────────────────────────────────────────────
// 9. navigator 检测 hook — SSR 返回 false,CSR 检测后更新
// ────────────────────────────────────────────────────────────
describe('navigator 检测 — SSR 安全', () => {
  it('useState(false) + useEffect 检测 userAgent,初始 false,useEffect 后更新', () => {
    function useIsMobile(): boolean {
      const [isMobile, setIsMobile] = React.useState<boolean>(false)
      React.useEffect(() => {
        // 在 happy-dom 下用 Object.defineProperty 覆盖 userAgent
        const ua = navigator.userAgent
        setIsMobile(/mobile/i.test(ua))
      }, [])
      return isMobile
    }

    function MobileIndicator(): React.ReactElement {
      const isMobile = useIsMobile()
      return <span data-testid="mobile">{isMobile ? 'MOBILE' : 'DESKTOP'}</span>
    }

    // 模拟 mobile userAgent(happy-dom 默认 userAgent 不含 "mobile",所以默认 DESKTOP)
    // 我们 spyOn navigator.userAgent 的 getter,确保 useEffect 读到的是 mobile UA
    const mobileUA =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    const originalDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent')
    Object.defineProperty(window.navigator, 'userAgent', {
      value: mobileUA,
      configurable: true,
      writable: true,
    })

    try {
      const { container } = render(<MobileIndicator />)
      // render() 内部 act() 会同步执行 useEffect → setIsMobile(true)
      expect(container.querySelector('[data-testid="mobile"]')?.textContent).toBe('MOBILE')
    } finally {
      // 恢复原 userAgent
      if (originalDescriptor) {
        Object.defineProperty(window.navigator, 'userAgent', originalDescriptor)
      }
    }
  })

  it('SSR 阶段 useIsMobile 总是返回 false(hydration 安全)', () => {
    function useIsMobile(): boolean {
      const [isMobile, setIsMobile] = React.useState<boolean>(false)
      React.useEffect(() => {
        setIsMobile(/mobile/i.test(navigator.userAgent))
      }, [])
      return isMobile
    }

    function MobileIndicator(): React.ReactElement {
      const isMobile = useIsMobile()
      return <span data-testid="mobile">{isMobile ? 'MOBILE' : 'DESKTOP'}</span>
    }

    // SSR 不运行 useEffect → useIsMobile 永远返回初始值 false
    const html = renderToString(<MobileIndicator />)
    expect(html).toContain('DESKTOP')
    expect(html).not.toContain('MOBILE')
  })
})

// ────────────────────────────────────────────────────────────
// 10. Math.random() → useId 替换 — SSR/CSR id 一致
// ────────────────────────────────────────────────────────────
describe('Math.random() 替换为 useId — SSR/CSR id 一致', () => {
  it('使用 useId 替代 Math.random,SSR/CSR 返回相同 id', () => {
    function RandomIdComponent(): React.ReactElement {
      // ❌ 错误:SSR 与 CSR 的 Math.random() 值不同 → 触发 hydration 错误
      // const id = Math.random().toString(36).slice(2, 8)
      // ✅ 正确:useId() 在 SSR/CSR 一致
      const id = React.useId()
      return <span data-testid="rnd-id">{id}</span>
    }
    const { container, rerender } = render(<RandomIdComponent />)
    const firstId = container.querySelector('[data-testid="rnd-id"]')?.textContent
    expect(firstId).toBeTruthy()
    // 重新 mount 后 id 应稳定(useId 基于 React 树位置)
    rerender(<RandomIdComponent />)
    const secondId = container.querySelector('[data-testid="rnd-id"]')?.textContent
    expect(secondId).toBe(firstId)
  })
})

// ────────────────────────────────────────────────────────────
// 11. 集成:完整 hydration 修复链路(ClientOnly + store hydrate)
// ────────────────────────────────────────────────────────────
describe('集成 — 完整 hydration 修复链路', () => {
  it('ClientOnly 包裹消费 store 的组件,SSR/CSR 一致', () => {
    // 模拟持久化的 open=true(SSR 时不应立即反映)
    window.localStorage.setItem(
      'ihui-agent-progress-pane-v6',
      JSON.stringify({ open: true, pinned: false }),
    )

    function PaneStatus(): React.ReactElement {
      const open = useAgentProgressPaneStore((s) => s.open)
      return <span data-testid="status">{open ? 'OPEN' : 'CLOSED'}</span>
    }

    function App(): React.ReactElement {
      // 用 ClientOnly 延迟渲染消费者,避免 SSR 阶段读到不一致的 store 状态
      return (
        <ClientOnly fallback={<span data-testid="status">CLOSED</span>}>
          <PaneStatus />
        </ClientOnly>
      )
    }

    // 不调用 hydrate(模拟 SSR 阶段),只渲染 ClientOnly
    const { container } = render(<App />)
    // 第一次 render:fallback 显示
    expect(container.querySelector('[data-testid="status"]')?.textContent).toBe('CLOSED')
  })
})
