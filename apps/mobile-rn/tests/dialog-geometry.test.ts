// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 弹层高度单一真相源 + 全量弹层接线回归。
 *
 * 三条腿:① 纯函数行为;② 每个弹层消费点都带上统一 style;③ 消费清单与源码面一致
 * (新增弹层若没登记进清单、或把百分比上限抄回样式表,都必须红)。
 * 第一版只锁 ChatScreen 单文件,结果从它抽出的 AgentSelector / NotesPanel /
 * SlashCommandPalette / VoicePanel 以及另起一屏的 AiAssistantN8nScreen 全部漏带修复,
 * 这一版按「清单 + 全源码扫描」双证收口。
 *
 * 接线扫描刻意不用正则:逐个切出 style 块再按字面量比对,避免转义写法本身漂移。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DIALOG_MAX_HEIGHT_RATIO,
  dialogContentHeight,
  dialogContentHeightStyle,
} from '../src/lib/dialog-geometry'

const SRC_DIR = fileURLToPath(new URL('../src/', import.meta.url))
const HOOK_RE = /dialogContentHeightStyle|useDialogHeightStyle/

/** 每个弹层消费者:相对 src/ 的路径 + 容器样式键 + 至少几个消费点 */
const CONSUMERS = [
  { rel: 'screens/ChatScreen.tsx', keys: ['styles.listDialogContent', 'styles.materialPopup'], min: 5 },
  { rel: 'screens/AiAssistantN8nScreen.tsx', keys: ['pickerStyles.sheet'], min: 1 },
  { rel: 'components/chat/AgentSelector.tsx', keys: ['styles.listDialogContent'], min: 1 },
  { rel: 'components/chat/NotesPanel.tsx', keys: ['styles.listDialogContent'], min: 1 },
  { rel: 'components/chat/SlashCommandPalette.tsx', keys: ['styles.listDialogContent'], min: 1 },
  { rel: 'components/chat/VoicePanel.tsx', keys: ['styles.listDialogContent'], min: 1 },
] as const

const readSrc = (rel: string) => readFileSync(join(SRC_DIR, rel), 'utf8')

function walk(dir: string, base = ''): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const rel = base ? base + '/' + name : name
    if (statSync(full).isDirectory()) out.push(...walk(full, rel))
    else if (/\.tsx?$/.test(name)) out.push(rel)
  }
  return out
}

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

describe('全量弹层接线(防回归)', () => {
  it('所有消费单一真相源的源码文件都登记在清单里(新增弹层必须登记)', () => {
    const actual = walk(SRC_DIR)
      .filter((rel) => HOOK_RE.test(readSrc(rel)))
      .filter((rel) => rel !== 'lib/dialog-geometry.ts' && rel !== 'lib/use-dialog-height.ts')
      .sort()
    expect(actual).toEqual(CONSUMERS.map((c) => c.rel).sort())
  })

  for (const c of CONSUMERS) {
    describe(c.rel, () => {
      const src = readSrc(c.rel)
      it('样式表里不再出现百分比上限 / 手写比例', () => {
        expect(src).not.toContain("'70%'")
        expect(src).not.toContain("'40%'")
        expect(src).not.toContain('modelPickerHeight')
        expect(src).not.toContain('Math.round(windowHeight')
      })
      it('从单一真相源接线并产出统一 style', () => {
        expect(HOOK_RE.test(src)).toBe(true)
        expect(src).toContain('dialogHeightStyle')
      })
      it('所有弹层容器消费点都接上确定高度', () => {
        const refs = c.keys.reduce((n: number, k: string) => n + countOf(src, k), 0)
        const consumers = styleBlocks(src).filter(
          (b) => c.keys.some((k) => b.includes(k)) || b.includes('listDialogStyle'),
        )
        expect(refs).toBeGreaterThanOrEqual(c.min)
        expect(consumers.length).toBeGreaterThanOrEqual(c.min)
        for (const block of consumers)
          expect(block.includes('dialogHeightStyle') || block.includes('listDialogStyle')).toBe(true)
        for (const k of c.keys) expect(src).toContain('[' + k + ', dialogHeightStyle]')
      })
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
