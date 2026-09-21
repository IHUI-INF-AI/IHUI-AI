// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
/**
 * CompressionDivider 单元测试(2026-09-19 立,孤儿组件接线 → compaction 数据模型)
 *
 * 组件已从旧"count/onExpand 折叠展开按钮"重构为"compaction 静态压缩统计分隔线":
 * 链路 compaction 命名帧 → onCompaction → store setMessageCompaction → 只读展示。
 *
 * 覆盖:
 * - 基本渲染:divider 标题 + role="separator" + 默认 data-testid
 * - 节省比例:仅当 compressedTokens < originalTokens 且 originalTokens > 0 时计算
 *   (Math.round 取整;等于/大于/原始为 0 均不渲染节省文本)
 * - 完整 token 前后对比挂 title/aria-label(不占视觉一行)
 * - 视觉细节:左右两条 1px 横线(aria-hidden) + 居中布局
 * - 可选字段 removedCount/trigger 不影响渲染
 * - className + data-testid 透传
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { CompressionDivider } from '../src/components/ai/progress-sections/compression-divider'
import type { MessageCompaction } from '../src/stores/chat'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// ─── next-intl mock:useTranslations 返回 t 函数,支持 key 查表 + 参数插值 ──
// (模式对标 plan-steps-card.test.tsx;组件 useTranslations('chat') 后以相对 key 调用)
const I18N_MAP: Record<string, string> = {
  'compaction.dividerTitle': '上方历史已压缩为摘要',
  'compaction.dividerDescription':
    '上下文已从 {before} tokens 压缩至 {after} tokens,更早的对话被折叠为摘要',
  'compaction.dividerSaved': '节省 {ratio}%',
}
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string | number>) => {
    const tmpl = I18N_MAP[key] ?? key
    if (!params) return tmpl
    return tmpl.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''))
  },
}))

// ─── 构造辅助:默认 10000 → 2000(节省 80%) ──────────────────
const mk = (over: Partial<MessageCompaction> = {}): MessageCompaction => ({
  originalTokens: 10000,
  compressedTokens: 2000,
  ...over,
})

// ─── 基本渲染 ─────────────────────────────────────────
describe('CompressionDivider — 基本渲染', () => {
  it('渲染 divider 标题"上方历史已压缩为摘要"', () => {
    const { container } = render(<CompressionDivider compaction={mk()} />)
    expect(container.textContent).toContain('上方历史已压缩为摘要')
  })

  it('role="separator"(语义分隔线,无交互)', () => {
    render(<CompressionDivider compaction={mk()} />)
    const el = screen.getByTestId('compression-divider') as HTMLElement
    expect(el.getAttribute('role')).toBe('separator')
  })

  it('默认 data-testid="compression-divider"', () => {
    const { container } = render(<CompressionDivider compaction={mk()} />)
    expect(container.querySelector('[data-testid="compression-divider"]')).toBeTruthy()
  })

  it('渲染 div 而非 button(静态展示,无展开交互)', () => {
    const { container } = render(<CompressionDivider compaction={mk()} />)
    expect(container.querySelector('button')).toBeFalsy()
    const el = container.querySelector('[data-testid="compression-divider"]') as HTMLElement
    expect(el.tagName.toLowerCase()).toBe('div')
  })
})

// ─── 节省比例 ─────────────────────────────────────────
describe('CompressionDivider — 节省比例', () => {
  it('10000 → 2000:显示"节省 80%"', () => {
    const { container } = render(<CompressionDivider compaction={mk()} />)
    expect(container.textContent).toContain('节省 80%')
  })

  it('3000 → 2000:四舍五入显示"节省 33%"(1 - 2/3 = 33.33%)', () => {
    const { container } = render(
      <CompressionDivider compaction={mk({ originalTokens: 3000, compressedTokens: 2000 })} />,
    )
    expect(container.textContent).toContain('节省 33%')
  })

  it('100 → 1:显示"节省 99%"', () => {
    const { container } = render(
      <CompressionDivider compaction={mk({ originalTokens: 100, compressedTokens: 1 })} />,
    )
    expect(container.textContent).toContain('节省 99%')
  })

  it('compressedTokens === originalTokens:不渲染节省文本', () => {
    const { container } = render(
      <CompressionDivider compaction={mk({ originalTokens: 5000, compressedTokens: 5000 })} />,
    )
    expect(container.textContent).not.toContain('节省')
  })

  it('compressedTokens > originalTokens(异常数据):不渲染节省文本', () => {
    const { container } = render(
      <CompressionDivider compaction={mk({ originalTokens: 1000, compressedTokens: 3000 })} />,
    )
    expect(container.textContent).not.toContain('节省')
  })

  it('originalTokens = 0:不渲染节省文本(避免除零)', () => {
    const { container } = render(
      <CompressionDivider compaction={mk({ originalTokens: 0, compressedTokens: 0 })} />,
    )
    expect(container.textContent).not.toContain('节省')
  })
})

// ─── 完整描述挂 aria-label(可访问性) ────────────
describe('CompressionDivider — aria-label 完整描述', () => {
  it('aria-label 含压缩前后 token 数(10000/2000)', () => {
    render(<CompressionDivider compaction={mk()} />)
    const el = screen.getByTestId('compression-divider') as HTMLElement
    expect(el.getAttribute('aria-label')).toContain('10000')
    expect(el.getAttribute('aria-label')).toContain('2000')
    expect(el.getAttribute('aria-label')).toContain('压缩')
  })

  it('禁用原生 title(守门 [18]):完整描述仅由 aria-label 承载', () => {
    render(<CompressionDivider compaction={mk()} />)
    const el = screen.getByTestId('compression-divider') as HTMLElement
    expect(el.getAttribute('title')).toBeNull()
    expect(el.getAttribute('aria-label')).toBeTruthy()
  })

  it('视觉文本只占一行:不含完整 token 对比(仅 aria-label 承载)', () => {
    const { container } = render(<CompressionDivider compaction={mk()} />)
    expect(container.textContent).not.toContain('10000')
    expect(container.textContent).not.toContain('2000')
  })
})

// ─── 视觉细节 ─────────────────────────────────────────
describe('CompressionDivider — 视觉细节', () => {
  it('左右两侧 1px 横线(bg-border/50)各一条,共两条', () => {
    const { container } = render(<CompressionDivider compaction={mk()} />)
    const lines = container.querySelectorAll('.h-px.flex-1.bg-border\\/50')
    expect(lines.length).toBe(2) // 左 + 右
  })

  it('两条横线均 aria-hidden(装饰性,读屏忽略)', () => {
    const { container } = render(<CompressionDivider compaction={mk()} />)
    const lines = container.querySelectorAll('.h-px.flex-1.bg-border\\/50')
    lines.forEach((line) => expect(line.getAttribute('aria-hidden')).toBe('true'))
  })

  it('外层居中布局(flex items-center justify-center)', () => {
    const { container } = render(<CompressionDivider compaction={mk()} />)
    const el = container.querySelector('[data-testid="compression-divider"]') as HTMLElement
    expect(el.className).toContain('flex')
    expect(el.className).toContain('items-center')
    expect(el.className).toContain('justify-center')
  })
})

// ─── 可选字段 ─────────────────────────────────────────
describe('CompressionDivider — 可选字段 removedCount/trigger', () => {
  it('携带全字段(removedCount + trigger)正常渲染,不影响核心文本', () => {
    const { container } = render(
      <CompressionDivider compaction={mk({ removedCount: 24, trigger: 'ratio' })} />,
    )
    expect(container.textContent).toContain('上方历史已压缩为摘要')
    expect(container.textContent).toContain('节省 80%')
  })
})

// ─── className + data-testid 透传 ───────────────────────
describe('CompressionDivider — className + data-testid 透传', () => {
  it('className 透传到外层 div', () => {
    const { container } = render(<CompressionDivider compaction={mk()} className="my-cls" />)
    const el = container.querySelector('[data-testid="compression-divider"]') as HTMLElement
    expect(el.className).toContain('my-cls')
  })

  it('data-testid 覆盖默认', () => {
    const { container } = render(
      <CompressionDivider compaction={mk()} data-testid="custom-divider" />,
    )
    expect(container.querySelector('[data-testid="custom-divider"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="compression-divider"]')).toBeFalsy()
  })
})

// ─── 集成场景 ─────────────────────────────────────────
describe('CompressionDivider — 集成场景', () => {
  it('rerender 更新 compaction 数据(压缩统计变化后比例同步)', () => {
    const { container, rerender } = render(<CompressionDivider compaction={mk()} />)
    expect(container.textContent).toContain('节省 80%')
    // 模拟 store setMessageCompaction 后父组件重渲染传入新统计
    rerender(
      <CompressionDivider compaction={mk({ originalTokens: 8000, compressedTokens: 1000 })} />,
    )
    expect(container.textContent).toContain('节省 88%')
  })

  it('大数值 999999 → 999:节省 100%取整边界(99.9001% → 100)', () => {
    const { container } = render(
      <CompressionDivider compaction={mk({ originalTokens: 999999, compressedTokens: 999 })} />,
    )
    // Math.round(99.9001) = 100
    expect(container.textContent).toContain('节省 100%')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
