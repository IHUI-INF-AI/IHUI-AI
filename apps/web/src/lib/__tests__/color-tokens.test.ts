import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const GLOBALS_CSS = path.resolve(__dirname, '../../../app/globals.css')

// 核心色族:必须在 @theme(light) 与 .dark 块都有定义。
// 防止浮层透明 bug 复发(2026-07-17:popover/popover-foreground 漏定义导致 Tooltip/Popover/Dropdown 透明)。
const CORE_COLORS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
  'success',
  'success-foreground',
  'warning',
  'warning-foreground',
  'info',
  'info-foreground',
  'sidebar',
  'sidebar-foreground',
  'sidebar-hover',
  'sidebar-active',
  'sidebar-active-hover',
]

describe('色变量守门:防浮层透明 bug 复发', () => {
  const css = fs.readFileSync(GLOBALS_CSS, 'utf8')
  const themeBlock = css.match(/@theme\s*{([\s\S]*?)}/)?.[1] ?? ''
  const darkBlock = css.match(/\.dark\s*{([\s\S]*?)}/)?.[1] ?? ''

  it('核心色族在 @theme(light) 块全部有定义', () => {
    const missing: string[] = []
    for (const name of CORE_COLORS) {
      const re = new RegExp(`--color-${name}\\s*:`)
      if (!re.test(themeBlock)) missing.push(name)
    }
    expect(missing, `light @theme 缺少色变量: ${missing.join(', ')}`).toEqual([])
  })

  it('核心色族在 .dark 块全部有定义(防暗色浮层透明)', () => {
    const missing: string[] = []
    for (const name of CORE_COLORS) {
      const re = new RegExp(`--color-${name}\\s*:`)
      if (!re.test(darkBlock)) missing.push(name)
    }
    expect(missing, `dark .dark 缺少色变量: ${missing.join(', ')}`).toEqual([])
  })

  it('popover 背景色为实色(非 transparent/未空),light 与 dark 都有值', () => {
    const lightPopover = themeBlock.match(/--color-popover:\s*([^;]+);/)?.[1]?.trim()
    const darkPopover = darkBlock.match(/--color-popover:\s*([^;]+);/)?.[1]?.trim()
    expect(lightPopover, 'light --color-popover 必须有值').toBeTruthy()
    expect(darkPopover, 'dark --color-popover 必须有值').toBeTruthy()
    expect(lightPopover, 'light popover 不可为 transparent').not.toBe('transparent')
    expect(darkPopover, 'dark popover 不可为 transparent').not.toBe('transparent')
  })
})
