/**
 * Content Script 工具函数单元测试(纯函数部分,DOM 操作依赖 happy-dom-like 行为需在浏览器实测)。
 * 覆盖:
 * - extractSelectionText / isValidSelection
 * - translationKey / detectLanguage
 * - computeToolbarPosition
 */
import { describe, it, expect } from 'vitest'
import {
  extractSelectionText,
  isValidSelection,
  computeToolbarPosition,
  translationKey,
  detectLanguage,
  MAX_SELECTION_CHARS,
} from '../src/content/content-utils'

function mockSelection(text: string): { toString(): string } {
  return { toString: () => text }
}

describe('content-utils (纯函数)', () => {
  describe('extractSelectionText', () => {
    it('提取并 trim 选区文本', () => {
      expect(extractSelectionText(mockSelection('  hello  '))).toBe('hello')
    })
    it('null selection 返回空字符串', () => {
      expect(extractSelectionText(null)).toBe('')
    })
    it('空 selection 返回空字符串', () => {
      expect(extractSelectionText(mockSelection(''))).toBe('')
    })
  })

  describe('isValidSelection', () => {
    it('普通文本通过', () => {
      expect(isValidSelection('hello')).toBe(true)
    })
    it('空字符串失败', () => {
      expect(isValidSelection('')).toBe(false)
    })
    it('仅空白失败', () => {
      expect(isValidSelection('   \n\t  ')).toBe(false)
    })
    it('超过 MAX_SELECTION_CHARS 失败', () => {
      expect(isValidSelection('a'.repeat(MAX_SELECTION_CHARS + 1))).toBe(false)
    })
  })

  describe('translationKey', () => {
    it('取前 32 字符', () => {
      expect(translationKey('a'.repeat(100))).toBe('a'.repeat(32))
    })
    it('短文本不变', () => {
      expect(translationKey('hello')).toBe('hello')
    })
  })

  describe('detectLanguage', () => {
    it('中文字符多判定为 zh', () => {
      expect(detectLanguage('你好世界 朋友')).toBe('zh')
    })
    it('英文字符多判定为 en', () => {
      expect(detectLanguage('hello world 你')).toBe('en')
    })
    it('空 / 纯数字 / 标点 判定为 other', () => {
      expect(detectLanguage('')).toBe('other')
      expect(detectLanguage('123 !!!')).toBe('other')
    })
  })

  describe('computeToolbarPosition', () => {
    const viewport = { width: 1200, height: 800 }

    it('rect 退化时不显示', () => {
      const pos = computeToolbarPosition(
        { top: 100, left: 100, bottom: 100, width: 0, height: 0 },
        200,
        32,
        viewport,
      )
      expect(pos.visible).toBe(false)
    })

    it('空间足够时优先放上方', () => {
      const pos = computeToolbarPosition(
        { top: 200, left: 100, bottom: 220, width: 200, height: 20 },
        200,
        32,
        viewport,
      )
      expect(pos.placement).toBe('top')
      expect(pos.visible).toBe(true)
      expect(pos.top).toBeLessThan(200)
    })

    it('空间不足时退到下方', () => {
      const pos = computeToolbarPosition(
        { top: 10, left: 100, bottom: 30, width: 200, height: 20 },
        200,
        32,
        viewport,
      )
      expect(pos.placement).toBe('bottom')
      expect(pos.top).toBeGreaterThan(30)
    })

    it('left 自动夹在 viewport 范围内', () => {
      const pos = computeToolbarPosition(
        { top: 400, left: 1100, bottom: 420, width: 100, height: 20 },
        200,
        32,
        viewport,
      )
      expect(pos.left).toBeLessThanOrEqual(viewport.width - 8 - 200)
      expect(pos.left).toBeGreaterThanOrEqual(8)
    })
  })
})
