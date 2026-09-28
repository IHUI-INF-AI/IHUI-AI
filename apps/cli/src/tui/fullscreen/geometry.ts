// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全屏 TUI —— 尺寸与换行(纯函数层,零 IO)。
 *
 * 单一真相源:可视宽度一律走 `../../util/text-width.js` 的 `charWidth`(CJK 记 2 列),
 * 本文件不得再实现第二份宽度表(两处算同一件事必漂移,本仓记过多次)。
 *
 * 为什么是纯函数:全屏渲染的"布局对不对"必须能断言,不能只能人眼看。
 * 所以这一层不吃 process、不写 stdout、不读环境变量,输入输出一律显式传参。
 */

import { charWidth } from '../../util/text-width.js'

/** 终端可视区域(列数 / 行数),由宿主探测后传入,本层不猜。 */
export interface Size {
  cols: number
  rows: number
}

/** 着色档位:帧内容只带语义档,不带具体 SGR —— SGR 由 render 层按"是否有色"决定。 */
export type Tone = 'plain' | 'dim' | 'accent' | 'good' | 'warn' | 'bad' | 'reverse'

/** 一段同色文本(换行拆分的最小单位)。 */
export interface Segment {
  text: string
  tone: Tone
}

/** 一屏里的一行:若干段顺序拼接。 */
export interface FrameLine {
  segs: Segment[]
}

/** 屏幕分区:每一区占的行号(0 基)。 */
export interface RegionBoxes {
  /** 顶部:模型 / 工作区 / 会话 */
  header: number
  /** 中部:流式消息区(可滚动) */
  transcriptTop: number
  transcriptRows: number
  /** 状态区:任务进度与工具活动(取共享层推导,端内不自算) */
  status: number
  /** 输入区:可能占 2 行(第一行输入框、第二行预留补全位) */
  input: number
  inputRows: number
  /** 底部:快捷键提示 */
  hints: number
}

/** 能撑起全屏布局的最小尺寸:低于它宁可回退行模式,也不画一个挤成一团的假界面。 */
export const MIN_COLS = 40
export const MIN_ROWS = 8

/**
 * 按总行数分配四个区域。空间不足返回 null —— 调用方必须把它当作
 * "不可用"处理(明确报原因并回退),不得四舍五入硬画。
 */
export function computeBoxes(size: Size): RegionBoxes | null {
  if (!Number.isFinite(size.cols) || !Number.isFinite(size.rows)) return null
  if (size.cols < MIN_COLS || size.rows < MIN_ROWS) return null
  // 固定占位:header 1 + status 1 + hints 1 = 3,输入区按宽度决定 1~2 行,其余给消息区。
  const inputRows = size.rows >= 14 ? 2 : 1
  const transcriptRows = size.rows - 3 - inputRows
  if (transcriptRows < 1) return null
  const header = 0
  const transcriptTop = header + 1
  const status = transcriptTop + transcriptRows
  const input = status + 1
  const hints = input + inputRows
  return { header, transcriptTop, transcriptRows, status, input, inputRows, hints }
}

/** 字符串可视宽度(不含 ANSI;本层的 text 恒为纯文本)。 */
export function textWidth(text: string): number {
  let w = 0
  for (const ch of text) w += charWidth(ch)
  return w
}

/** 单个码位(可能是代理对)的宽度。 */
export function chWidth(ch: string): number {
  return charWidth(ch)
}

/** 拼出一行的纯文本(测试与断言用,不含颜色)。 */
export function lineText(line: FrameLine): string {
  return line.segs.map((s) => s.text).join('')
}

/** 造一行单段文本。 */
export function plainLine(text: string, tone: Tone = 'plain'): FrameLine {
  return { segs: text === '' ? [] : [{ text, tone }] }
}

/** 补齐 / 裁切到恰好 width 列,返回新行(不改入参)。 */
export function fitLine(line: FrameLine, width: number): FrameLine {
  const out: Segment[] = []
  let used = 0
  for (const seg of line.segs) {
    if (used >= width) break
    const remain = width - used
    if (textWidth(seg.text) <= remain) {
      out.push(seg)
      used += textWidth(seg.text)
      continue
    }
    out.push({ text: cutText(seg.text, remain).text, tone: seg.tone })
    used = width
  }
  if (used < width) {
    out.push({ text: ' '.repeat(width - used), tone: 'plain' })
  }
  return { segs: out }
}

/**
 * 按可视宽度裁切。withEllipsis 时末尾留 1 列放 `…`。
 * 返回 { text, rest }:rest 是被切掉的部分(换行需要它继续往下排)。
 */
export function cutText(text: string, width: number, withEllipsis = false): { text: string; rest: string } {
  if (width <= 0) return { text: '', rest: text }
  if (textWidth(text) <= width) return { text, rest: '' }
  const budget = withEllipsis ? Math.max(0, width - 1) : width
  let w = 0
  let i = 0
  for (const ch of text) {
    const cw = charWidth(ch)
    if (w + cw > budget) break
    w += cw
    i += ch.length
  }
  const head = text.slice(0, i)
  const rest = text.slice(i)
  return { text: withEllipsis ? `${head}…` : head, rest }
}

/**
 * 把一行按 width 折成多行(保留 tone)。
 *
 * 逐段填充:先按段内 `\n` 硬拆,再按列宽软拆 —— 软拆不重新分词,纯按列宽切,
 * 因为终端里"列对齐"比"词边界"更硬(按词折行会让右侧留白参差,反而更难看)。
 * 颜色跟着段走,所以折行不会让同一句话断色(旧写法拿整行文本反查每字符归属段,
 * 硬换行处的偏移量算错就会整体串色 —— 那种 bug 只能人眼看出来,正是要避免的形态)。
 */
export function wrapLine(line: FrameLine, width: number): FrameLine[] {
  if (width <= 0) return [plainLine('')]
  const out: FrameLine[] = []
  let cur: FrameLine = plainLine('')
  const current = (): Segment[] => cur.segs
  const used = (): number => cur.segs.reduce((n, s) => n + textWidth(s.text), 0)
  const newLine = (): void => {
    out.push(cur)
    cur = plainLine('')
  }
  for (const seg of line.segs) {
    const hardParts = seg.text.split('\n')
    hardParts.forEach((hard, idx) => {
      let rest = hard
      for (;;) {
        const room = width - used()
        if (room <= 0) {
          newLine()
          continue
        }
        if (textWidth(rest) <= room) {
          if (rest !== '') current().push({ text: rest, tone: seg.tone })
          break
        }
        const { text, rest: tail } = cutText(rest, room)
        // 无进展保护:单个码位比整行还宽时(如 width=1 撞宽字符),
        // cutText 会切出空串 —— 不兜住这里就是死循环。宁可溢出 1 列也不能挂住。
        if (text === '') {
          const it = rest[Symbol.iterator]()
          const first = it.next()
          const ch = first.done ? '' : first.value
          if (ch === '') break
          current().push({ text: ch, tone: seg.tone })
          rest = rest.slice(ch.length)
          newLine()
          continue
        }
        current().push({ text, tone: seg.tone })
        rest = tail
        newLine()
      }
      // 段内硬换行:除最后一片外,每片之后都必须起新行。
      if (idx < hardParts.length - 1) newLine()
    })
  }
  out.push(cur)
  return out.length > 0 ? out : [plainLine('')]
}

/** 把多行折成 flat 列表(消息区滚动就吃这个展平结果)。 */
export function wrapAll(lines: readonly FrameLine[], width: number): FrameLine[] {
  const out: FrameLine[] = []
  for (const l of lines) out.push(...wrapLine(l, width))
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
