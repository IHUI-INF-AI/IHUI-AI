// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 静态判据:IDE 族组件里不得存在「假按钮」(点了没反应的 <button>)。
// 两类假象:① handler 只有 e.stopPropagation();② 完全没有任何交互 handler 也没 disabled。
// 反向哨兵:同一判据必须在测试内构造的哨兵源码上命中,防止解析器失配导致「恒绿」假通过。

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const COMPONENTS_DIR = resolve(__dirname, '../src/components')

interface ButtonBlock {
  /** <button 起、到其开标签结束 > 为止(含)的原文 */
  openTag: string
  /** 元素体原文 */
  body: string
}

/** 从 from 起找到 JSX 开标签的结束 '>'(花括号深度 0 且不在字符串字面量内) */
function findOpenTagEnd(code: string, from: number): number {
  let braceDepth = 0
  let quote: string | null = null
  for (let i = from; i < code.length; i += 1) {
    const ch = code[i] as string
    if (quote) {
      if (ch === '\\') i += 1
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '{') braceDepth += 1
    else if (ch === '}') braceDepth -= 1
    else if (ch === '>' && braceDepth === 0) return i
  }
  return -1
}

/** 提取每个 <button> 的开标签与元素体(按 button 标签计数配平,支持嵌套) */
function extractButtonBlocks(code: string): ButtonBlock[] {
  const blocks: ButtonBlock[] = []
  const openRe = /<button[\s/>]/g
  let match: RegExpExecArray | null
  while ((match = openRe.exec(code)) !== null) {
    const tagEnd = findOpenTagEnd(code, match.index)
    if (tagEnd === -1) continue
    const openTag = code.slice(match.index, tagEnd + 1)
    if (openTag.endsWith('/>')) {
      blocks.push({ openTag, body: '' })
      continue
    }
    // 向后配平 button 标签,找到本元素的 </button>
    const scanRe = /<\/?button[\s/>]/g
    scanRe.lastIndex = tagEnd + 1
    let depth = 1
    let closeStart = -1
    let closeMatch: RegExpExecArray | null
    while ((closeMatch = scanRe.exec(code)) !== null) {
      depth += closeMatch[0].startsWith('</') ? -1 : 1
      if (depth === 0) {
        closeStart = closeMatch.index
        break
      }
    }
    if (closeStart === -1) continue
    blocks.push({ openTag, body: code.slice(tagEnd + 1, closeStart) })
    openRe.lastIndex = closeStart + '</button>'.length
  }
  return blocks
}

/** 取开标签上某个属性的值表达式(仅 {} 包裹的 JSX 表达式),不存在返回 null */
function attrExpression(openTag: string, name: string): string | null {
  const at = openTag.indexOf(`${name}=`)
  if (at === -1) return null
  const first = openTag[at + name.length + 1]
  if (first === '{') {
    let depth = 0
    for (let i = at + name.length + 1; i < openTag.length; i += 1) {
      const ch = openTag[i] as string
      if (ch === '{') depth += 1
      else if (ch === '}') {
        depth -= 1
        if (depth === 0) return openTag.slice(at + name.length + 2, i).trim()
      }
    }
    return null
  }
  if (first === '"' || first === "'") {
    const close = openTag.indexOf(first, at + name.length + 2)
    return close === -1 ? null : openTag.slice(at + name.length + 2, close).trim()
  }
  return null
}

/** 整个 handler 只有 e.stopPropagation() —— 点了没有任何动作 */
const STOP_PROPAGATION_ONLY =
  /^(?:\(\s*[A-Za-z_$][\w$]*\s*\)|[A-Za-z_$][\w$]*)\s*=>\s*(?:\{\s*)?[A-Za-z_$][\w$]*\.stopPropagation\(\)\s*;?\s*(?:\})?$/

function iconOf(block: ButtonBlock): string {
  const m = /<([A-Z][A-Za-z0-9]*)/.exec(block.body)
  return m ? m[1] : '(no-icon)'
}

export function findFakeButtons(code: string): string[] {
  const fake: string[] = []
  for (const block of extractButtonBlocks(code)) {
    const click = attrExpression(block.openTag, 'onClick')
    if (click !== null) {
      if (STOP_PROPAGATION_ONLY.test(click)) fake.push(iconOf(block))
      continue
    }
    const hasOtherHandler = ['onMouseDown', 'onPointerDown', 'onKeyDown'].some(
      (n) => attrExpression(block.openTag, n) !== null,
    )
    const inert = /[\s"]disabled\s*=|aria-disabled/.test(block.openTag)
    const submits = attrExpression(block.openTag, 'type') === 'submit'
    if (!hasOtherHandler && !inert && !submits) fake.push(iconOf(block))
  }
  return fake
}

const read = (rel: string) => readFileSync(resolve(COMPONENTS_DIR, rel), 'utf8')

/**
 * status-bar 里「尚无真实动作」的装饰性按钮基线(2026-09-23 a11y 审计登记)。
 * 分支钮 / 错误 / 警告 / 通知 / Check 全部依赖未接线的真实状态(status-bar.tsx 里
 * errors / warnings / notifications / cursor / gitSync 仍是硬编码 mock),
 * 补 aria-label 只是化妆,故先冻结基线:数量或种类增加一律红。
 */
const STATUS_BAR_KNOWN_FAKE_BASELINE = [
  'AlertCircle',
  'AlertTriangle',
  'Bell',
  'Check',
  'GitBranch',
]

describe('IDE 假按钮(no fake affordance)', () => {
  it('反向哨兵:判据能在构造源码上命中,且不误伤真按钮', () => {
    const sentinel = `
export function S() {
  return (
    <div>
      <button onClick={(e) => e.stopPropagation()} className="a"><Plus className="h-3 w-3" /></button>
      <button className="b"><RotateCcw className="h-3 w-3" /></button>
      <button onClick={() => run({ deep: '}' })} aria-label="ok"><Check className="h-3 w-3" /></button>
      <button type="button" disabled aria-disabled="true"><Bell className="h-3 w-3" /></button>
    </div>
  )
}
`
    // 解析器必须真的看到 4 个 button(0 命中 = 正则失配假绿)
    expect(extractButtonBlocks(sentinel)).toHaveLength(4)
    expect(findFakeButtons(sentinel)).toEqual(['Plus', 'RotateCcw'])
  })

  it('diff-file-list:操作位已降级为非交互元素,无假按钮', () => {
    const code = read('ide/diff-file-list.tsx')
    // 行内 checkbox 仍需 onClick={(e) => e.stopPropagation()}(阻止冒泡到行),
    // 那是正当用法,故判据只针对 <button> 元素:整文件不允许再出现 <button。
    expect(extractButtonBlocks(code)).toEqual([])
    expect(findFakeButtons(code)).toEqual([])
  })

  it('status-bar:刷新钮已接到真实动作,剩余假按钮不得超出基线', () => {
    const code = read('ide/status-bar.tsx')
    const fake = findFakeButtons(code).sort()
    expect(code).toContain('onClick={() => void fetchDiffFiles()}')
    expect(fake).not.toContain('RefreshCw')
    expect(fake).toEqual(STATUS_BAR_KNOWN_FAKE_BASELINE)
  })

  it('对照正例:source-control-panel 的暂存钮仍走真实 handler', () => {
    const code = read('ide/source-control-panel.tsx')
    expect(code).toContain('onClick={() => toggleStage(file)}')
    expect(code).toContain(
      "aria-label={staged ? t('sourceControl.unstage') : t('sourceControl.stage')}",
    )
  })
})

describe('图标钮可访问名(a11y name)', () => {
  it('UserUpload 附件移除钮有名字', () => {
    expect(read('user/UserUpload.tsx')).toContain("aria-label={tA11y('removeAttachment')}")
  })

  it('UnifiedTaskDashboard @引用 chip 关闭钮有名字', () => {
    expect(read('agents/UnifiedTaskDashboard.tsx')).toContain("aria-label={tA11y('close')}")
  })

  it('TiptapToolbar 全部图标钮经 ToolbarBtn 拿到 aria-label(Tooltip 只给 describedby,不给 name)', () => {
    const code = read('form/TiptapToolbar.tsx')
    expect(code).toContain('aria-label={title}')
    // 按钮一律走 ToolbarBtn,不允许绕开命名判据的裸图标钮
    expect(findFakeButtons(code)).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
