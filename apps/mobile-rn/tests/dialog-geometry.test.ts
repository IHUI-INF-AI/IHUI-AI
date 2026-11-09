// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 弹层高度单一真相源 + ChatScreen 接线回归。
 *
 * 两条腿缺一不可:① 纯函数行为(比例/取整/边界);② 源码接线(样式表里不许再出现
 * 百分比上限、不许再手写比例,且每个弹层消费点都必须带上统一 style)。
 * 第 ② 条是防回归的关键 —— 只修模型列表、漏掉其余弹层,正是本票要根治的那一型。
 *
 * 接线扫描刻意不用正则:逐个切出 style 块再按字面量比对,避免转义写法本身漂移。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  DIALOG_MAX_HEIGHT_RATIO,
  dialogContentHeight,
  dialogContentHeightStyle,
} from '../src/lib/dialog-geometry'

const screenSrc = readFileSync(
  fileURLToPath(new URL('../src/screens/ChatScreen.tsx', import.meta.url)),
  'utf8',
)

const DIALOG_KEYS = ['styles.listDialogContent', 'styles.materialPopup'] as const

/** 切出所有 style={...} 块(目标块内部不含嵌套花括号,按首个右括号收尾即可) */
function styleBlocks(src: string): string[] {
  const out: string[] = []
  let rest = src
  let start = rest.indexOf('style={')
  while (start !== -1) {
    const end = rest.indexOf('}', start)
    if (end === -1) break
    out.push(rest.slice(start, end + 1))
    rest = rest.slice(end + 1)
    start = rest.indexOf('style={')
  }
  return out
}

function countOf(src: string, needle: string): number {
  return src.split(needle).length - 1
}

describe('dialogContentHeight(纯函数)', () => {
  it('比例唯一源为 0.7', () => {
    expect(DIALOG_MAX_HEIGHT_RATIO).toBe(0.7)
  })
  it('按屏高取 70% 并四舍五入到整像素', () => {
    expect(dialogContentHeight(800)).toBe(560)
    expect(dialogContentHeight(733)).toBe(513)
  })
  it('height 与 maxHeight 恒等且同源', () => {
    const style = dialogContentHeightStyle(800)
    expect(style).not.toBeNull()
    expect(style?.height).toBe(style?.maxHeight)
    expect(style?.height).toBe(dialogContentHeight(800))
  })
  it('屏高异常不产出确定高度(避免弹层塌成 0 高)', () => {
    expect(dialogContentHeightStyle(0)).toBeNull()
    expect(dialogContentHeightStyle(-1)).toBeNull()
    expect(dialogContentHeightStyle(Number.NaN)).toBeNull()
  })
})

describe('ChatScreen 弹层接线(防回归)', () => {
  it('样式表里不再出现百分比上限字面量', () => {
    expect(screenSrc).not.toContain("'70%'")
  })
  it('不再手写比例 / modelPickerHeight', () => {
    expect(screenSrc).not.toContain('modelPickerHeight')
    expect(screenSrc).not.toContain('Math.round(windowHeight')
  })
  it('从单一真相源 import 并产出统一 style', () => {
    expect(screenSrc).toContain('dialogContentHeightStyle')
    expect(screenSrc).toContain('const dialogHeightStyle = useMemo(')
  })
  it('所有弹层容器消费点都接上 dialogHeightStyle', () => {
    const refs = DIALOG_KEYS.reduce((n, k) => n + countOf(screenSrc, k), 0)
    const consumers = styleBlocks(screenSrc).filter((b) => DIALOG_KEYS.some((k) => b.includes(k)))
    expect(refs).toBeGreaterThanOrEqual(5)
    expect(consumers.length).toBe(refs)
    for (const block of consumers) {
      expect(block).toContain('dialogHeightStyle')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
