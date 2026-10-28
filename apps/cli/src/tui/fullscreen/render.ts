// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全屏 TUI —— 帧 → ANSI(纯函数层,不吃 IO)。
 *
 * 只重画变化的行:全屏宿主每 token 就重绘一次,整屏重写会在部分终端上闪。
 * 按行 diff 后把"要写的一串转义 + 文本"拼成一个字符串一次写出,
 * 因为**逐段 write() 会让别的进程插在中间**(共享 stdout),那等于两个程序交错画同一屏。
 */

import type { FrameLine, Tone } from './geometry.js'

/** SGR 参数串;'' 表示不加工。reverse 用作选中/强调档。 */
const TONE_SGR: Record<Tone, string> = {
  plain: '',
  dim: '2',
  accent: '36',
  good: '32',
  warn: '33',
  bad: '31',
  reverse: '7',
}

const RESET = '\x1b[0m'

/** 一行 → 带色字符串;color=false 时退化为纯文本(NO_COLOR / 管道场景)。 */
export function lineToAnsi(line: FrameLine, color: boolean): string {
  if (!color) return line.segs.map((s) => s.text).join('')
  let out = ''
  let active: string | null = null
  for (const seg of line.segs) {
    const sgr = TONE_SGR[seg.tone] ?? ''
    if (sgr !== active) {
      out += active === null ? '' : RESET
      if (sgr !== '') out += `\x1b[${sgr}m`
      active = sgr
    }
    out += seg.text
  }
  return active === null || active === '' ? out : `${out}${RESET}`
}

export function frameToAnsi(lines: readonly FrameLine[], color: boolean): string[] {
  return lines.map((l) => lineToAnsi(l, color))
}

/** 光标定位(1 基行列)。 */
export function moveTo(row: number, col: number): string {
  return `\x1b[${row + 1};${col + 1}H`
}

/** 清整行(不含换行)—— 行内重画必须先清,否则短行会留上一帧的尾巴。 */
export const CLEAR_LINE = '\x1b[2K'

/**
 * 计算"把 prev 变成 next 需要写什么"。
 * prev=null 表示首帧(整屏写)。返回空串表示无变化(不写任何东西,也就不会闪)。
 */
export function diffFrames(prev: readonly string[] | null, next: readonly string[]): string {
  let out = ''
  for (let i = 0; i < next.length; i++) {
    if (prev && prev[i] === next[i]) continue
    out += moveTo(i, 0) + CLEAR_LINE + next[i]
  }
  return out
}

export const ENTER_ALT_SCREEN = '\x1b[?1049h'
export const LEAVE_ALT_SCREEN = '\x1b[?1049l'
export const HIDE_CURSOR = '\x1b[?25l'
export const SHOW_CURSOR = '\x1b[?25h'
export const CLEAR_SCREEN = '\x1b[2J'

/** 进全屏的字节序列(顺序要紧:先进 alt-screen 再清屏,否则会擦掉用户滚动态)。 */
export function enterSequence(): string {
  return ENTER_ALT_SCREEN + CLEAR_SCREEN + HIDE_CURSOR
}

/**
 * 退全屏的字节序列。**必须与 enterSequence 严格配对**,且写入时不得再被别的帧插队。
 * alt-screen 一出,主屏内容自动回到原样,所以这里不重画主屏。
 */
export function leaveSequence(): string {
  return SHOW_CURSOR + LEAVE_ALT_SCREEN
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
