// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  HIGHLIGHT_WORD_STORAGE_KEY,
  decideHighlightToggle,
  highlightedWordFromApplied,
  highlightWordToRestore,
} from '../lib/highlight-state'

describe('高亮单一状态 (DBG-70)', () => {
  it('没有当前词时,点击选区是打开', () => {
    expect(decideHighlightToggle(null, 'alpha')).toEqual({ word: 'alpha', enabled: true })
  })

  it('当前词与选区相同则关闭,不同则换成选区', () => {
    expect(decideHighlightToggle('alpha', 'alpha')).toEqual({ word: null, enabled: false })
    expect(decideHighlightToggle('alpha', 'beta')).toEqual({ word: 'beta', enabled: true })
  })

  it('highlight.applied 的 matches=0 清除,即使 word 还在', () => {
    expect(highlightedWordFromApplied({ word: 'alpha', matches: 0 })).toBe(null)
    expect(highlightedWordFromApplied({ word: 'alpha', matches: 1 })).toBe('alpha')
    expect(highlightedWordFromApplied({ word: '', matches: 1 })).toBe(null)
  })

  it('刷新回填不覆盖用户已经点出来的词', () => {
    expect(highlightWordToRestore(null, 'alpha')).toBe('alpha')
    expect(highlightWordToRestore('beta', 'alpha')).toBe(null)
    expect(highlightWordToRestore(null, '')).toBe(null)
    expect(highlightWordToRestore(null, null)).toBe(null)
  })

  it('工具栏走 highlight.toggle,启动走 highlight.get,不再用本地布尔', () => {
    const content = readFileSync(
      fileURLToPath(new URL('../entrypoints/content.ts', import.meta.url)),
      'utf8',
    )
    expect(content).toContain('decideHighlightToggle')
    expect(content).toContain("type: 'highlight.toggle'")
    expect(content).toContain("type: 'highlight.get'")
    expect(content).toContain('highlightedWordFromApplied')
    expect(content).not.toContain('highlightEnabled')
    const background = readFileSync(
      fileURLToPath(new URL('../entrypoints/background.ts', import.meta.url)),
      'utf8',
    )
    expect(background).toContain('HIGHLIGHT_WORD_STORAGE_KEY')
    expect(background).toContain("case 'highlight.get'")
    expect(HIGHLIGHT_WORD_STORAGE_KEY).toBe('ihui_highlight_word')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
