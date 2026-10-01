// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L5782 — 桌面端按 Ctrl+Q 毫无反应(三段链中"派发面"的常驻尺子)
 *
 * 病灶(2026-10-02 实测定位):useNativeShortcuts 把 `if (isEditableTarget(e.target)) return`
 * 放在**所有**分支之前,而 Ctrl+Q 的宿主正是这些分支之一。桌面端主界面常年是聊天输入框
 * 持焦(contenteditable / textarea,message-input.tsx 多处 inputCoreRef.current?.focus()),
 * 于是"用户最常处的状态"里这条键结构上永不触发 —— 与"注册缺失"在现象上完全同形。
 *
 * 判据口径:退出是**应用级 accelerator**,必须无视焦点(本键 2026-07-25 前的宿主是 Rust
 * 原生菜单 accelerator,原生 accelerator 本就无视焦点;头注承诺的"等价快捷键"欠到这里)。
 * 其余键(Ctrl+R / F12 / F11 / F5)维持原语义,所以下面既有"quit 在输入框里必派发"的正例,
 * 也有"reload 在输入框里不得派发"的反例 —— 只留前者,就等于允许把整条守卫删掉。
 *
 * 覆盖三段中的可静态判定两段:
 * - 注册面:window 级 keydown 监听在位(每条用例都靠它,摘线即全红)
 * - 派发面:focus 上下文 / modifier 严格匹配 / 键盘布局兜底
 * - 生效面:GlobalShell 的 dispatcher 失败不得被 `void` 吞掉(形状锁)
 *   Rust 侧 quit_app → exit_application 属真机链路,本机未取证(见交付报告)。
 */

import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, fireEvent, cleanup } from '@testing-library/react'
import * as React from 'react'
import { useNativeShortcuts } from '../src/hooks/use-native-shortcuts'

/**
 * 形状锁读源码时的取根逻辑:import.meta.url 在 vitest 4 + Vite SSR 转换下**不保证**是
 * file: URL(实测报 "The URL must be of scheme file"),所以先试它、失败退到
 * "vitest 的工作目录 = apps/web"这一条(vitest 按包跑,config 在该包内)。
 * 两条锚点都落空 ⇒ 当场断言失败并点名 —— 形状锁读不到文件时**绝不许**空转成通过。
 */
function readWebSource(relFromWebRoot: string): string {
  const roots: string[] = []
  try {
    roots.push(resolve(dirname(fileURLToPath(import.meta.url)), '..'))
  } catch {
    /* import.meta.url 不是 file: 形态 ⇒ 交给下面的 cwd 锚 */
  }
  roots.push(process.cwd())
  for (const r of roots) {
    const p = resolve(r, relFromWebRoot)
    if (existsSync(p)) return readFileSync(p, 'utf8')
  }
  throw new Error(
    `形状锁无法定位 ${relFromWebRoot}(试过锚点: ${roots.join(' | ')});读不到源码不等于通过`,
  )
}

let host: HTMLDivElement | null = null

afterEach(() => {
  cleanup()
  host?.remove()
  host = null
})

/** 渲染一个只挂 hook 的探针组件,返回每次派发的 MenuActionId 列表。 */
function mountShortcutProbe() {
  const calls: string[] = []
  function Probe() {
    useNativeShortcuts((id) => {
      calls.push(id)
    })
    return (
      <div>
        <textarea data-testid="ta" defaultValue="" />
        <div data-testid="ce" contentEditable suppressContentEditableWarning />
      </div>
    )
  }
  const utils = render(<Probe />)
  return { calls, ...utils }
}

function press(target: Element | Window, init: Record<string, unknown>) {
  fireEvent.keyDown(target as Element, init)
}

describe('L5782 · Ctrl+Q 退出必须无视焦点', () => {
  it('焦点在 <textarea> 内 → 仍派发 file.quit(修复前此条必红)', () => {
    const { calls, getByTestId } = mountShortcutProbe()
    const ta = getByTestId('ta')
    ;(ta as HTMLTextAreaElement).focus()
    press(ta, { key: 'q', code: 'KeyQ', ctrlKey: true })
    expect(calls).toEqual(['file.quit'])
  })

  it('焦点在 contenteditable(聊天输入框)内 → 仍派发 file.quit', () => {
    const { calls, getByTestId } = mountShortcutProbe()
    const ce = getByTestId('ce')
    press(ce, { key: 'q', code: 'KeyQ', ctrlKey: true })
    expect(calls).toEqual(['file.quit'])
  })

  it('焦点在 body → 派发 file.quit(原有效路径不得回归)', () => {
    const { calls } = mountShortcutProbe()
    press(document.body, { key: 'q', code: 'KeyQ', ctrlKey: true })
    expect(calls).toEqual(['file.quit'])
  })

  it('Ctrl+R 在输入框内仍不派发(守卫对其他键保持在位,不得整块删除)', () => {
    const { calls, getByTestId } = mountShortcutProbe()
    const ta = getByTestId('ta')
    press(ta, { key: 'r', code: 'KeyR', ctrlKey: true })
    expect(calls).toEqual([])
  })

  it('F12 在输入框内仍不派发(同上,另一条其他键)', () => {
    const { calls, getByTestId } = mountShortcutProbe()
    press(getByTestId('ta'), { key: 'F12', code: 'F12' })
    expect(calls).toEqual([])
  })

  it('modifier 严格:Ctrl+Shift+Q 不派发;Alt+Ctrl+Q 不派发', () => {
    const { calls } = mountShortcutProbe()
    press(document.body, { key: 'q', code: 'KeyQ', ctrlKey: true, shiftKey: true })
    press(document.body, { key: 'q', code: 'KeyQ', ctrlKey: true, altKey: true })
    expect(calls).toEqual([])
  })

  it('单按 Q(无修饰键)在输入框内不得被拦截成派发', () => {
    const { calls, getByTestId } = mountShortcutProbe()
    press(getByTestId('ta'), { key: 'q', code: 'KeyQ' })
    expect(calls).toEqual([])
  })

  it('键盘布局/IME 改写 e.key 时按物理 code 兜底命中(body)', () => {
    const { calls } = mountShortcutProbe()
    // 复用 matchesShortcutKeyCode 的那一份实现:key 被布局改写(œ)但 code 仍是 KeyQ
    press(document.body, { key: 'œ', code: 'KeyQ', ctrlKey: true })
    expect(calls).toEqual(['file.quit'])
  })

  it('macOS Cmd+Q 仍派发(hook 原语义 ctrl||meta 同认)', () => {
    const { calls } = mountShortcutProbe()
    press(document.body, { key: 'q', code: 'KeyQ', metaKey: true })
    expect(calls).toEqual(['file.quit'])
  })

  it('preventDefault 落在 quit 这一支(浏览器/WebView 默认行为不得继续)', () => {
    const { getByTestId } = mountShortcutProbe()
    const ta = getByTestId('ta')
    const event = new KeyboardEvent('keydown', {
      key: 'q',
      code: 'KeyQ',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    ta.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })
})

describe('L5782 · 派发失败不得静默(GlobalShell 形状锁)', () => {
  it('useNativeShortcuts 的 dispatcher 必须带 catch(旧写法 void 吞 rejection)', () => {
    const src = readWebSource('src/components/layout/GlobalShell.tsx')
    const idx = src.indexOf('useNativeShortcuts(')
    expect(idx, 'GlobalShell 必须仍挂载 useNativeShortcuts(摘线即本型回归)').toBeGreaterThan(-1)
    const call = src.slice(idx, idx + 600)
    expect(call, '派发失败必须被喊出(.catch),不得只 void').toMatch(/\.catch\(/)
    expect(call, '不得退回 `void dispatchMenuAction(id)` 单行吞异常的写法').not.toMatch(
      /useNativeShortcuts\(\s*\(id\)\s*=>\s*void dispatchMenuAction\(id\)\s*\)/,
    )
  })

  it('hook 本体仍走 window 级 keydown(注册面摘线 ⇒ 上面全部用例必红,此处再钉一次)', () => {
    const src = readWebSource('src/hooks/use-native-shortcuts.ts')
    expect(src).toMatch(/window\.addEventListener\('keydown'/)
    expect(src).toMatch(/window\.removeEventListener\('keydown'/)
    // 判据必须有牙:quit 分支必须在 isEditableTarget 早退**之前**
    const quitIdx = src.search(/matchesShortcutKeyCode\(\s*e,\s*'q'\s*\)/)
    const guardIdx = src.search(/if \(isEditableTarget\(e\.target\)\) return/)
    expect(quitIdx, 'Ctrl+Q 分支必须复用 keyboard-shortcut-match 的 key/code 判据').toBeGreaterThan(-1)
    expect(guardIdx, '其他键的焦点守卫不得被整块删除').toBeGreaterThan(-1)
    expect(quitIdx, 'Ctrl+Q 必须排在焦点早退之前(否则输入框持焦时永不触发)')
      .toBeLessThan(guardIdx)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
