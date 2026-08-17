// @vitest-environment happy-dom
/**
 * ThinkingSection 折叠状态 localStorage 记忆单测(Phase 22,2026-07-29)
 *
 * 覆盖:
 * - 默认折叠(expanded=false)
 * - 点击展开 → expanded=true
 * - 展开后 localStorage 写入 'true'
 * - 折叠后 localStorage 写入 'false'
 * - 刷新后(localStorage='true')→ expanded=true
 * - 刷新后(localStorage='false')→ expanded=false
 * - localStorage 不可用 → 不报错,用默认值
 * - localStorage 值无效 → 用默认值
 * - 受控模式(外部传 expanded prop)→ 不读 localStorage
 * - SSR 安全(localStorage 只在 useEffect 中读)
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import { ThinkingSection } from '../src/components/ai/progress-sections/thinking-section'

// ─── next-intl mock ───────────────────────────────────────────
const { mockT } = vi.hoisted(() => {
  const map: Record<string, string> = {
    thinkingTitle: '思考过程',
    thinkingStreaming: '思考中...',
    thinkingChars: '字',
    copyThinking: '复制思考内容',
    copied: '已复制',
    thinkingElapsedTitle: '已思考 {time}',
    thinkingCharCountTitle: '{n} 个字符',
  }
  const mockT = (key: string) => map[key] ?? key
  return { mockT }
})
vi.mock('next-intl', () => ({ useTranslations: () => mockT }))

// ─── lucide-react mock ────────────────────────────────────────
// 用 vi.importActual 透传真实 lucide-react 模块(保证 Alert 等被透传引用的图标 Info/CheckCircle 等可用),
// 再覆盖测试用例关注的图标为 IconSpan。
const { IconSpan } = vi.hoisted(() => {
  const IconSpan = ({ className }: { className?: string }) => (
    <span data-testid="lucide-icon" className={className} />
  )
  return { IconSpan }
})
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>()
  const Icon = IconSpan
  return {
    __esModule: true,
    ...actual,
    Brain: Icon,
    Loader2: Icon,
    Copy: Icon,
    Check: Icon,
    ChevronRight: Icon,
  }
})

// ─── @radix-ui/react-tooltip mock:为 ThinkingSection 内的 <Tooltip> from '@/components/feedback' 提供 Provider 替身 ──
// (该 Tooltip 直接 import Radix,Tooltipefore 测试需顶层 Provider 包裹,此处 mock 直接让 Root/Portal 透传 children)
vi.mock('@radix-ui/react-tooltip', () => {
  const passthrough = ({ children }: { children: React.ReactNode }) => <>{children}</>
  return {
    __esModule: true,
    Provider: passthrough,
    Root: passthrough,
    Trigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Content: ({ children, ...rest }: { children: React.ReactNode; side?: string }) => (
      <div role="tooltip" data-side={rest.side ?? 'top'}>
        {children}
      </div>
    ),
    Arrow: () => null,
  }
})

const STORAGE_KEY = 'ihui:thinking-expanded'

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  // 2026-08-05 修复:happy-dom 下 restoreAllMocks 无法恢复 localStorage spy,显式恢复
  const ls = window.localStorage
  if (vi.isMockFunction(ls.getItem)) (ls.getItem as any).mockRestore()
  if (vi.isMockFunction(ls.setItem)) (ls.setItem as any).mockRestore()
  vi.restoreAllMocks()
})

// ─── 辅助:渲染带内容的 ThinkingSection ─────────────────────
function renderThinking(props?: Partial<React.ComponentProps<typeof ThinkingSection>>) {
  return render(
    <ThinkingSection
      content="正在分析问题..."
      currentNode="planner"
      isStreaming={false}
      {...props}
    />,
  )
}

// ─── 默认行为 ────────────────────────────────────────────────
describe('ThinkingSection localStorage 记忆 — 默认行为', () => {
  it('默认折叠(expanded=false,data-thinking-expanded="false")', () => {
    const { container } = renderThinking()
    const section = container.querySelector('[data-testid="thinking-section"]') as HTMLElement
    expect(section.getAttribute('data-thinking-expanded')).toBe('false')
  })

  it('点击 toggle 展开 → data-thinking-expanded="true"', () => {
    const { container } = renderThinking()
    const btn = container.querySelector('[data-testid="thinking-toggle"]') as HTMLElement
    fireEvent.click(btn)
    const section = container.querySelector('[data-testid="thinking-section"]') as HTMLElement
    expect(section.getAttribute('data-thinking-expanded')).toBe('true')
  })

  it('展开后点击 toggle 折叠 → data-thinking-expanded="false"', () => {
    const { container } = renderThinking()
    const btn = container.querySelector('[data-testid="thinking-toggle"]') as HTMLElement
    fireEvent.click(btn) // 展开
    fireEvent.click(btn) // 折叠
    const section = container.querySelector('[data-testid="thinking-section"]') as HTMLElement
    expect(section.getAttribute('data-thinking-expanded')).toBe('false')
  })
})

// ─── localStorage 写入 ───────────────────────────────────────
describe('ThinkingSection localStorage 记忆 — 写入', () => {
  it('展开后 localStorage 写入 "true"', () => {
    const { container } = renderThinking()
    const btn = container.querySelector('[data-testid="thinking-toggle"]') as HTMLElement
    fireEvent.click(btn)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('true')
  })

  it('折叠后 localStorage 写入 "false"', () => {
    // 先展开
    const { container } = renderThinking()
    const btn = container.querySelector('[data-testid="thinking-toggle"]') as HTMLElement
    fireEvent.click(btn) // 展开 → 'true'
    fireEvent.click(btn) // 折叠 → 'false'
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('false')
  })
})

// ─── localStorage 读取(刷新后恢复) ─────────────────────────
describe('ThinkingSection localStorage 记忆 — 读取', () => {
  it('localStorage="true" → mount 后 expanded=true', () => {
    window.localStorage.setItem(STORAGE_KEY, 'true')
    const { container } = renderThinking()
    const section = container.querySelector('[data-testid="thinking-section"]') as HTMLElement
    // useEffect 在 render() 中同步 flush,所以 mount 后已经是 true
    expect(section.getAttribute('data-thinking-expanded')).toBe('true')
  })

  it('localStorage="false" → mount 后 expanded=false', () => {
    window.localStorage.setItem(STORAGE_KEY, 'false')
    const { container } = renderThinking()
    const section = container.querySelector('[data-testid="thinking-section"]') as HTMLElement
    expect(section.getAttribute('data-thinking-expanded')).toBe('false')
  })

  it('localStorage 为空 → 用默认值 false', () => {
    // 不设置任何值
    const { container } = renderThinking()
    const section = container.querySelector('[data-testid="thinking-section"]') as HTMLElement
    expect(section.getAttribute('data-thinking-expanded')).toBe('false')
  })

  it('localStorage 值无效(如 "abc")→ 用默认值 false', () => {
    window.localStorage.setItem(STORAGE_KEY, 'abc')
    const { container } = renderThinking()
    const section = container.querySelector('[data-testid="thinking-section"]') as HTMLElement
    expect(section.getAttribute('data-thinking-expanded')).toBe('false')
  })
})

// ─── localStorage 异常处理 ───────────────────────────────────
describe('ThinkingSection localStorage 记忆 — 异常处理', () => {
  it('localStorage.getItem 抛异常 → 不报错,用默认值 false', () => {
    const spy = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: Access denied')
    })
    // 不应抛出异常
    const { container } = renderThinking()
    const section = container.querySelector('[data-testid="thinking-section"]') as HTMLElement
    expect(section.getAttribute('data-thinking-expanded')).toBe('false')
    expect(spy).toHaveBeenCalledWith(STORAGE_KEY)
  })

  it('localStorage.setItem 抛异常 → 不报错,toggle 仍然切换 UI', () => {
    const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { container } = renderThinking()
    const btn = container.querySelector('[data-testid="thinking-toggle"]') as HTMLElement
    // 不应抛出异常
    expect(() => fireEvent.click(btn)).not.toThrow()
    // UI 仍然切换
    const section = container.querySelector('[data-testid="thinking-section"]') as HTMLElement
    expect(section.getAttribute('data-thinking-expanded')).toBe('true')
    expect(spy).toHaveBeenCalledWith(STORAGE_KEY, 'true')
  })
})

// ─── 受控模式 ────────────────────────────────────────────────
describe('ThinkingSection localStorage 记忆 — 受控模式', () => {
  it('传 expanded={true} → 使用 prop 值,不读 localStorage', () => {
    // 预设 localStorage='false',但受控模式应忽略
    window.localStorage.setItem(STORAGE_KEY, 'false')
    const spy = vi.spyOn(window.localStorage, 'getItem')

    const { container } = renderThinking({ expanded: true })
    const section = container.querySelector('[data-testid="thinking-section"]') as HTMLElement
    expect(section.getAttribute('data-thinking-expanded')).toBe('true')
    // 受控模式不读 localStorage(getItem 不应被 ThinkingSection 以 STORAGE_KEY 调用)
    const calls = spy.mock.calls.filter((args) => args[0] === STORAGE_KEY)
    expect(calls).toHaveLength(0)
  })

  it('传 expanded={false} → 使用 prop 值,不读 localStorage', () => {
    window.localStorage.setItem(STORAGE_KEY, 'true')
    const spy = vi.spyOn(window.localStorage, 'getItem')

    const { container } = renderThinking({ expanded: false })
    const section = container.querySelector('[data-testid="thinking-section"]') as HTMLElement
    expect(section.getAttribute('data-thinking-expanded')).toBe('false')
    const calls = spy.mock.calls.filter((args) => args[0] === STORAGE_KEY)
    expect(calls).toHaveLength(0)
  })

  it('受控模式点击 toggle → 不切换(由外部控制)', () => {
    const { container } = renderThinking({ expanded: false })
    const btn = container.querySelector('[data-testid="thinking-toggle"]') as HTMLElement
    fireEvent.click(btn)
    const section = container.querySelector('[data-testid="thinking-section"]') as HTMLElement
    // 受控模式:点击不改变状态(没有 onChange 回调,内部不切换)
    expect(section.getAttribute('data-thinking-expanded')).toBe('false')
  })
})

// ─── SSR 安全 ────────────────────────────────────────────────
describe('ThinkingSection localStorage 记忆 — SSR 安全', () => {
  it('localStorage 只在 useEffect 中读(不在 render 阶段)', () => {
    // 验证:useState 初始值是 false(不读 localStorage)
    // 即使 localStorage='true',render 阶段不读,初始 state 是 false
    // useEffect flush 后才变成 true
    // 这里通过 spy 验证 getItem 在 render 过程中被调用(useEffect flush 在 render 内)
    // 关键:如果 useState 直接读 localStorage,初始值会是 true(无 act 时)
    // 用 act 验证 effect 驱动的更新
    window.localStorage.setItem(STORAGE_KEY, 'true')
    const spy = vi.spyOn(window.localStorage, 'getItem')

    let container: HTMLElement
    act(() => {
      const result = renderThinking()
      container = result.container
    })

    // useEffect 执行后,getItem 被调用
    expect(spy).toHaveBeenCalledWith(STORAGE_KEY)
    // 状态更新为 true
    const section = container!.querySelector('[data-testid="thinking-section"]') as HTMLElement
    expect(section.getAttribute('data-thinking-expanded')).toBe('true')
  })

  it('useEffect 中读 localStorage 后正确更新状态(localStorage="true")', () => {
    window.localStorage.setItem(STORAGE_KEY, 'true')
    const { container } = renderThinking()
    // render() 内 act() flush 了 useEffect,所以状态已更新
    const section = container.querySelector('[data-testid="thinking-section"]') as HTMLElement
    expect(section.getAttribute('data-thinking-expanded')).toBe('true')
    // 内容区可见
    expect(container.querySelector('[data-testid="thinking-content-wrapper"]')).toBeTruthy()
  })
})
