// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  comboFromKeyEvent,
  effectiveCombo,
  findShortcutConflict,
  formatCombo,
  normalizeCombo,
  parseStoredOverrides,
  serializeOverrides,
} from './shortcut-overrides'

function keyEvent(partial: Partial<KeyboardEvent> & { key: string }): KeyboardEvent {
  return {
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    ...partial,
  } as KeyboardEvent
}

describe('normalizeCombo', () => {
  it('归一修饰键别名与顺序', () => {
    expect(normalizeCombo('ctrl+k')).toBe('Ctrl+K')
    expect(normalizeCombo('shift+alt+ctrl+p')).toBe('Ctrl+Alt+Shift+P')
    expect(normalizeCombo('cmd+k')).toBe('Ctrl+K')
    expect(normalizeCombo('meta+option+arrowup')).toBe('Ctrl+Alt+ArrowUp')
  })

  it('保留标点物理键写法', () => {
    expect(normalizeCombo('Ctrl+Shift+/')).toBe('Ctrl+Shift+/')
    expect(normalizeCombo('Ctrl+Shift+,')).toBe('Ctrl+Shift+,')
  })

  it('拒绝裸键/只有修饰键', () => {
    expect(normalizeCombo('K')).toBe('')
    expect(normalizeCombo('Ctrl+Shift')).toBe('')
    expect(normalizeCombo('')).toBe('')
  })
})

describe('formatCombo', () => {
  it('Mac 用 ⌘ 且省略加号', () => {
    expect(formatCombo('Ctrl+K', true)).toBe('⌘K')
    expect(formatCombo('Ctrl+Shift+P', true)).toBe('⌘ShiftP')
  })

  it('非 Mac 保持 + 连接', () => {
    expect(formatCombo('Ctrl+Alt+V', false)).toBe('Ctrl+Alt+V')
  })
})

describe('comboFromKeyEvent', () => {
  it('字母键使用 event.key', () => {
    expect(comboFromKeyEvent(keyEvent({ key: 'k', ctrlKey: true }))).toBe('Ctrl+K')
  })

  it('标点使用物理 code,Shift+/ 仍是 /', () => {
    expect(
      comboFromKeyEvent(keyEvent({ key: '?', code: 'Slash', ctrlKey: true, shiftKey: true })),
    ).toBe('Ctrl+Shift+/')
    expect(
      comboFromKeyEvent(keyEvent({ key: '<', code: 'Comma', ctrlKey: true, shiftKey: true })),
    ).toBe('Ctrl+Shift+,')
  })

  it('Cmd 在 Mac 上也归一为 Ctrl', () => {
    expect(comboFromKeyEvent(keyEvent({ key: 'p', metaKey: true }))).toBe('Ctrl+P')
  })

  it('拒绝裸键、仅 Shift、纯修饰键与输入法组合态', () => {
    expect(comboFromKeyEvent(keyEvent({ key: 'k' }))).toBeNull()
    expect(comboFromKeyEvent(keyEvent({ key: 'K', shiftKey: true }))).toBeNull()
    expect(comboFromKeyEvent(keyEvent({ key: 'Shift', ctrlKey: true }))).toBeNull()
    expect(
      comboFromKeyEvent(keyEvent({ key: 'k', ctrlKey: true, isComposing: true })),
    ).toBeNull()
  })

  it('功能键与空格', () => {
    expect(comboFromKeyEvent(keyEvent({ key: 'ArrowUp', ctrlKey: true }))).toBe('Ctrl+ArrowUp')
    expect(comboFromKeyEvent(keyEvent({ key: ' ', ctrlKey: true }))).toBe('Ctrl+Space')
    expect(comboFromKeyEvent(keyEvent({ key: 'F5', ctrlKey: true }))).toBe('Ctrl+F5')
  })
})

describe('parseStoredOverrides', () => {
  it('解析带版本号结构', () => {
    expect(parseStoredOverrides(serializeOverrides({ search: 'Ctrl+Alt+F' }))).toEqual({
      search: 'Ctrl+Alt+F',
    })
  })

  it('兼容无版本号直存表', () => {
    expect(parseStoredOverrides('{"search":"ctrl+alt+f"}')).toEqual({ search: 'Ctrl+Alt+F' })
  })

  it('坏 JSON / 非法值回落空表', () => {
    expect(parseStoredOverrides('{oops')).toEqual({})
    expect(parseStoredOverrides('null')).toEqual({})
    expect(parseStoredOverrides('{"search":123}')).toEqual({})
    expect(parseStoredOverrides('{"search":"F"}')).toEqual({})
    expect(parseStoredOverrides(null)).toEqual({})
  })
})

describe('findShortcutConflict / effectiveCombo', () => {
  const bindings = [
    { action: 'search', key: 'Ctrl+P' },
    { action: 'new-chat', key: 'Ctrl+Shift+N' },
  ]

  it('命中其它动作即冲突', () => {
    expect(findShortcutConflict({ action: 'new-chat', combo: 'ctrl+p', bindings })?.action).toBe(
      'search',
    )
  })

  it('自身动作不算冲突', () => {
    expect(findShortcutConflict({ action: 'search', combo: 'Ctrl+P', bindings })).toBeNull()
  })

  it('与无 action 的组件注册项也判冲突', () => {
    expect(
      findShortcutConflict({ action: 'search', combo: 'Ctrl+J', bindings: [{ key: 'Ctrl+J' }] })
        ?.key,
    ).toBe('Ctrl+J')
  })

  it('生效键优先取改键表', () => {
    expect(effectiveCombo('Ctrl+P', 'search', { search: 'Ctrl+Alt+F' })).toBe('Ctrl+Alt+F')
    expect(effectiveCombo('Ctrl+P', 'search', {})).toBe('Ctrl+P')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
