// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 流式 markdown 未闭合 token 补全(2026-10-13 立,对标 Trae fillInIncompleteTokens)。
 *
 * Trae(Trae CN 3.4.2 静态逆向,@8435426):流式中的 markdown part 以
 * `fillInIncompleteTokens: true` 交给 marked 的 fin() 补全未闭合 token,
 * 让"半截粗体/半截行内代码"在流式期间就渲染成正常样式,流完自动回归真实形态。
 *
 * 我们此前只在未闭合代码围栏时补一行 ```(markdown-stream.tsx hasUnclosedFence)。
 * 本模块把补全面扩到围栏外的三类高频 token:
 *  - 行内代码 span(`…`)
 *  - 粗体分隔(**…**)
 *  - 删除线(~~…~~)
 *
 * 设计取舍(为什么不做完整 parser):
 *  - 流式渲染每帧都在变,完整 token 级 fin() 需要引入 marked 内部 API,成本高且脆;
 *  - 只补「opener 在最后一行」的未闭合 token(流式语义下未闭合几乎总在文末),
 *    只追加闭合符、绝不删改内容;历史行的游离标记(如 "2**3" 字面量)保持原样,
 *    最坏情况是某个临界瞬间渲染成字面符号,下一帧内容补齐后自动回归正常形态;
 *  - 单星 `*` 斜体与列表项 `* ` 前缀存在天然歧义,不做(误伤率高、收益低)。
 */

export interface IncompleteMarkdownHeal {
  /** 补全后的文本(仅追加闭合符,绝不删改原内容) */
  healed: string
  /** 是否补了围栏(调用方用于流式代码块降透明度标记) */
  fenceHealed: boolean
  /** 是否发生任何补全 */
  healedAny: boolean
}

/** 检测未闭合的代码块围栏(奇数个 ``` 表示未闭合,流式中的常见情况)。 */
export function hasUnclosedFence(content: string): boolean {
  const matches = content.match(/```/g)
  return matches !== null && matches.length % 2 === 1
}

/**
 * 对流式中的 markdown 文本做未闭合 token 补全。
 *
 * 规则(贴近 marked fin() 的行内语义):
 *  - 围栏感知:``` 之间的内容是代码,不参与计数也不补全(奇数围栏先把围栏补闭合);
 *  - 只补「未闭合 opener 落在最后一行」的 token——流式语义下,未闭合 token 几乎总是
 *    正在输出的文末行;更早行里没闭合的标记是历史游离标记(如 "2**3" 这类字面量),
 *    补了反而会把中间内容误卷进强调,保持原样最稳。
 *  - 行内代码/粗体/删除线只在围栏外计数。
 */
export function healIncompleteMarkdown(content: string): IncompleteMarkdownHeal {
  // 围栏未闭合:先临时闭合,让围栏内内容按代码块解析(与既有行为一致)
  const fenceHealed = hasUnclosedFence(content)
  let text = fenceHealed ? `${content}\n\`\`\`\n` : content

  // 逐行扫描(带行起始偏移):围栏外统计 token 奇偶,并记录「仍未闭合的 opener」
  // 所在行是否为最后一行
  const lines = text.split('\n')
  let inFence = false
  let offset = 0
  const openers: Record<'backtick' | 'bold' | 'strike', number> = {
    backtick: -1,
    bold: -1,
    strike: -1,
  }
  const parity = { backtick: 0, bold: 0, strike: 0 }
  lines.forEach((line) => {
    const lineStart = offset
    offset += line.length + 1
    // 围栏行(允许缩进):切围栏状态,本身不参与计数
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      return
    }
    if (inFence) return
    const scan = (kind: 'backtick' | 'bold' | 'strike', re: RegExp): void => {
      re.lastIndex = 0
      for (const m of line.matchAll(re)) {
        parity[kind] ^= 1
        if (parity[kind] === 1) openers[kind] = lineStart + (m.index ?? 0)
      }
    }
    scan('backtick', /`/g)
    scan('bold', /\*\*/g)
    scan('strike', /~~/g)
  })

  const suffix =
    (parity.bold === 1 && openers.bold >= 0 && isOnLastLine(lines, openers.bold) ? '**' : '') +
    (parity.strike === 1 && openers.strike >= 0 && isOnLastLine(lines, openers.strike)
      ? '~~'
      : '') +
    (parity.backtick === 1 && openers.backtick >= 0 && isOnLastLine(lines, openers.backtick)
      ? '`'
      : '')

  if (suffix) text += suffix
  return { healed: text, fenceHealed, healedAny: fenceHealed || suffix.length > 0 }
}

/** 给定绝对字符偏移,判断它落在的行是否是(补全时)文本的最后一行。 */
function isOnLastLine(lines: string[], charOffset: number): boolean {
  let offset = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line === undefined) break
    const start = offset
    offset += line.length + 1
    if (charOffset >= start && charOffset < offset) return i === lines.length - 1
  }
  return false
}
