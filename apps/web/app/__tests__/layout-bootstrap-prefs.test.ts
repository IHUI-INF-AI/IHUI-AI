// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 首屏偏好快照完整性测试(竞品对标 Cursor moltenBootPrefs/moltenBootThemes
 * preload.cjs:1127 —— 主进程一次性注入全部 boot 偏好,渲染期同步可读、零闪烁)。
 *
 * 回归缺口:bootstrap IIFE 里 AI 面板宽度分支的 `return` 会提前退出,
 * 使后续主题初始化被跳过;存过合法面板宽度的 Tauri 用户首屏主题失效(闪白)。
 * 本测试直接抽取 layout.tsx 的真实 inline script 在 jsdom 执行,不对实现做替身。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { rnGeometry } from '@ihui/design-tokens'

function extractBootScript(): string {
  const src = readFileSync(resolve(process.cwd(), 'app/layout.tsx'), 'utf8')
  const m = src.match(/__html: `((?:\\.|[^`\\])*)`/)
  const raw = m?.[1]
  if (!raw) throw new Error('bootstrap script not found in layout.tsx')
  return raw
    .replace(/\$\{rnGeometry\.drawerWidth\}/g, String(rnGeometry.drawerWidth))
    .replace(/\$\{rnGeometry\.sidebarMaxWidth\}/g, String(rnGeometry.sidebarMaxWidth))
    .replace(/\$\{rnGeometry\.sidebarCollapsedWidth\}/g, String(rnGeometry.sidebarCollapsedWidth))
}

function runBoot(opts: {
  panelWidth?: number
  theme?: string
  tauri?: boolean
} = {}): void {
  window.localStorage.clear()
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  delete (window as unknown as Record<string, unknown>).__TAURI__
  document.documentElement.className = ''
  document.documentElement.style.colorScheme = ''
  for (const k of ['--ai-panel-width', '--ai-panel-occupy', '--sidebar-width']) {
    document.documentElement.style.removeProperty(k)
  }
  if (opts.panelWidth !== undefined) {
    window.localStorage.setItem('ihui-ai-panel', JSON.stringify({ state: { width: opts.panelWidth } }))
  }
  if (opts.theme !== undefined) window.localStorage.setItem('theme', opts.theme)
  if (opts.tauri) (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}

  // eslint-disable-next-line no-new-func
  new Function(extractBootScript())()
}

describe('首屏 boot 偏好快照完整性', () => {
  beforeEach(() => runBoot())
  afterEach(() => runBoot())

  it('存过合法 AI 面板宽度的 Tauri 用户:首屏主题仍初始化(不被 return 跳过)', () => {
    runBoot({ panelWidth: 600, tauri: true })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('存过合法 AI 面板宽度:面板宽度仍正确应用,不被主题修复破坏', () => {
    runBoot({ panelWidth: 600, tauri: true })
    expect(document.documentElement.style.getPropertyValue('--ai-panel-width')).toBe('600px')
    expect(document.documentElement.style.getPropertyValue('--ai-panel-occupy')).toBe('606px')
  })

  it('无面板偏好:主题与默认面板宽度均正常', () => {
    runBoot({ tauri: true })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.getPropertyValue('--ai-panel-width')).toBe('480px')
  })

  it('显式浅色主题:即使 Tauri 也不加 dark(用户选择优先)', () => {
    runBoot({ panelWidth: 600, theme: 'light', tauri: true })
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.getPropertyValue('--ai-panel-width')).toBe('600px')
  })

  it('非法面板宽度:回退默认并继续主题初始化', () => {
    runBoot({ panelWidth: 100, tauri: true })
    expect(document.documentElement.style.getPropertyValue('--ai-panel-width')).toBe('480px')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('非 Tauri Web 端:不注入桌面深色,但面板宽度照常', () => {
    runBoot({ panelWidth: 640 })
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.getPropertyValue('--ai-panel-width')).toBe('640px')
  })
})
