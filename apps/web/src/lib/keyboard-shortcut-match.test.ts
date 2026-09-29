// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  formatCommandShortcutLabel,
  isAppleKeyboardPlatform,
  matchesCtrlShortcut,
  matchesPrimaryShortcut,
  matchesShortcutKeyCode,
  type ShortcutKeyEventLike,
} from './keyboard-shortcut-match'

const MAC = { platform: 'MacIntel' }
const WIN = { platform: 'Win32' }

function keyEvent(partial: Partial<ShortcutKeyEventLike>): ShortcutKeyEventLike {
  return {
    key: partial.key ?? '',
    code: partial.code,
    metaKey: partial.metaKey ?? false,
    ctrlKey: partial.ctrlKey ?? false,
    shiftKey: partial.shiftKey ?? false,
    altKey: partial.altKey ?? false,
  }
}

describe('isAppleKeyboardPlatform', () => {
  it('platform 词面判定(mac/iphone/ipad/ipod)', () => {
    expect(isAppleKeyboardPlatform({ platform: 'MacIntel' })).toBe(true)
    expect(isAppleKeyboardPlatform({ platform: 'iPhone' })).toBe(true)
    expect(isAppleKeyboardPlatform({ platform: 'Win32' })).toBe(false)
    expect(isAppleKeyboardPlatform({ platform: 'Linux x86_64' })).toBe(false)
  })

  it('UA 兜底(platform 缺失或谎报时)', () => {
    expect(isAppleKeyboardPlatform({ platform: '', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)' })).toBe(true)
    expect(isAppleKeyboardPlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS)' })).toBe(true)
    expect(isAppleKeyboardPlatform({ platform: 'Win32', userAgent: 'Chrome/1 Windows' })).toBe(false)
  })
})

describe('matchesPrimaryShortcut', () => {
  it('mac 上主快捷键 meta-only:⌘B 命中,Ctrl+B 不触发(mac 的 Ctrl 保留给 Emacs 风格编辑)', () => {
    expect(matchesPrimaryShortcut(keyEvent({ key: 'b', metaKey: true }), 'b', MAC)).toBe(true)
    expect(matchesPrimaryShortcut(keyEvent({ key: 'b', ctrlKey: true }), 'b', MAC)).toBe(false)
  })

  it('Win/Linux ctrl-only:Ctrl+B 命中,meta 不触发', () => {
    expect(matchesPrimaryShortcut(keyEvent({ key: 'b', ctrlKey: true }), 'b', WIN)).toBe(true)
    expect(matchesPrimaryShortcut(keyEvent({ key: 'b', metaKey: true }), 'b', WIN)).toBe(false)
  })

  it('Ctrl+Meta 同按不触发(双平台)', () => {
    expect(matchesPrimaryShortcut(keyEvent({ key: 'b', ctrlKey: true, metaKey: true }), 'b', MAC)).toBe(false)
    expect(matchesPrimaryShortcut(keyEvent({ key: 'b', ctrlKey: true, metaKey: true }), 'b', WIN)).toBe(false)
  })

  it('Shift/Option 参与的组合不触发主快捷键', () => {
    expect(matchesPrimaryShortcut(keyEvent({ key: 'B', metaKey: true, shiftKey: true }), 'b', MAC)).toBe(false)
    expect(matchesPrimaryShortcut(keyEvent({ key: 'b', metaKey: true, altKey: true }), 'b', MAC)).toBe(false)
  })

  it('key 被布局改写时经 code 兜底命中(⌥ 参与改写 key 的场景在 code 匹配层命中)', () => {
    // 某些布局/Option 组合会把 event.key 改写成非拉丁字符,物理 code 不变
    expect(matchesShortcutKeyCode({ key: '∫', code: 'KeyB' }, 'b')).toBe(true)
    // 修饰键层允许(meta 独占)时的完整命中路径
    expect(matchesPrimaryShortcut(keyEvent({ key: '∫', code: 'KeyB', metaKey: true }), 'b', MAC)).toBe(true)
  })

  it('Option 参与的组合不进主快捷键判据(⌥⌘B 整体不触发)', () => {
    expect(matchesPrimaryShortcut(keyEvent({ key: '∫', code: 'KeyB', metaKey: true, altKey: true }), 'b', MAC)).toBe(false)
  })

  it('code 兜底覆盖字母/数字/方括号', () => {
    expect(matchesShortcutKeyCode({ key: 'œ', code: 'KeyQ' }, 'q')).toBe(true)
    expect(matchesShortcutKeyCode({ key: '¡', code: 'Digit1' }, '1')).toBe(true)
    expect(matchesShortcutKeyCode({ key: '«', code: 'BracketLeft' }, '[')).toBe(true)
    expect(matchesShortcutKeyCode({ key: '»', code: 'BracketRight' }, ']')).toBe(true)
    expect(matchesShortcutKeyCode({ key: 'œ', code: 'KeyQ' }, 'w')).toBe(false)
  })

  it('code 缺失时不误命中', () => {
    expect(matchesShortcutKeyCode({ key: '∫' }, 'b')).toBe(false)
  })
})

describe('matchesCtrlShortcut', () => {
  it('Ctrl 独占命中,meta/shift/alt 同按不命中', () => {
    expect(matchesCtrlShortcut(keyEvent({ key: 'k', ctrlKey: true }), 'k')).toBe(true)
    expect(matchesCtrlShortcut(keyEvent({ key: 'k', ctrlKey: true, metaKey: true }), 'k')).toBe(false)
    expect(matchesCtrlShortcut(keyEvent({ key: 'k', ctrlKey: true, shiftKey: true }), 'k')).toBe(false)
    expect(matchesCtrlShortcut(keyEvent({ key: 'k', ctrlKey: true, altKey: true }), 'k')).toBe(false)
  })
})

describe('formatCommandShortcutLabel', () => {
  it('双平台 label 格式化(⌘ B vs Ctrl+B,方括号原样)', () => {
    expect(formatCommandShortcutLabel('b', MAC)).toBe('⌘ B')
    expect(formatCommandShortcutLabel('b', WIN)).toBe('Ctrl+B')
    expect(formatCommandShortcutLabel('[', MAC)).toBe('⌘ [')
    expect(formatCommandShortcutLabel('[', WIN)).toBe('Ctrl+[')
    expect(formatCommandShortcutLabel(']', WIN)).toBe('Ctrl+]')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
