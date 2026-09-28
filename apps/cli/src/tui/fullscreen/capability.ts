// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全屏 TUI —— 能力判定(纯判据 + 现读探针)。
 *
 * 为什么这一层必须存在:全屏界面在管道 / CI / 无 TTY / TERM=dumb 上根本画不出来。
 * 那种场合**必须明确判"不可用"并给出原因**,不得"降级成裸 ANSI 硬写"——
 * 后者把终端搞脏,而且账面上一切看起来都跑成功了(本仓最高频失效型就是"安静")。
 *
 * 判据与取数分离:`decideFullscreenCapability` 是纯函数(单测覆盖),
 * `probeTerminal` 才碰 process;调用方永远拿到三态之一,拿不到就是 undetermined。
 */

import type { Size } from './geometry.js'

export interface TerminalEnvSlice {
  /** TERM 环境变量值(undefined = 未设) */
  term: string | undefined
  /** NO_COLOR 约定:非空即要求无色 */
  noColor: string | undefined
  /** IHUI_TUI 显式开关:'1'/'0'/未设 */
  forced: string | undefined
}

export interface TerminalTtySlice {
  stdinTty: boolean
  stdoutTty: boolean
  /** process.stdout.columns(取不到为 undefined,不得当作 0 猜) */
  columns: number | undefined
  /** process.stdout.rows */
  rows: number | undefined
}

export type CapabilityVerdict =
  | { kind: 'supported'; color: boolean; size: Size }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'undetermined'; reason: string }

/** 显式开关的取值解析:只认真假两种写法,其它一律按未设处理(不猜)。 */
export function parseForced(value: string | undefined): 'on' | 'off' | 'unset' {
  if (value === undefined) return 'unset'
  const v = value.trim().toLowerCase()
  if (v === '1' || v === 'true' || v === 'on' || v === 'full' || v === 'fullscreen') return 'on'
  if (v === '0' || v === 'false' || v === 'off' || v === 'line' || v === 'legacy') return 'off'
  return 'unset'
}

/** 声明"支持全屏"的 TERM 特征:dumb/unknown 与 Emacs/VSCode 内置的无 alt-screen 终端排除。 */
const UNSUPPORTED_TERM_MARKERS = ['dumb', 'unknown', 'cons25']

export function termLooksCapable(term: string | undefined): boolean {
  if (term === undefined || term.trim() === '') return false
  const t = term.toLowerCase()
  return !UNSUPPORTED_TERM_MARKERS.some((m) => t.includes(m))
}

/**
 * 纯判据:输入两份环境/TTY 切片,输出一句可问责的三态结论。
 * 顺序刻意是 显式 off > 非 TTY > TERM 能力 > 尺寸 —— 越靠前的理由越硬,
 * 报告里必须先说最硬的那条,否则"没画出来"会被读成"画错了"。
 */
export function decideFullscreenCapability(
  env: TerminalEnvSlice,
  tty: TerminalTtySlice,
): CapabilityVerdict {
  const forced = parseForced(env.forced)
  if (forced === 'off') return { kind: 'unsupported', reason: 'IHUI_TUI 显式设为行模式(off)' }
  if (!tty.stdoutTty) return { kind: 'unsupported', reason: 'stdout 不是 TTY(管道/CI/日志重定向)' }
  if (!tty.stdinTty) return { kind: 'unsupported', reason: 'stdin 不是 TTY,无法接管按键' }
  if (!termLooksCapable(env.term)) {
    return { kind: 'unsupported', reason: `TERM=${env.term ?? '(未设)'} 不保证支持 alt-screen,不硬画` }
  }
  if (tty.columns === undefined || tty.rows === undefined) {
    return { kind: 'undetermined', reason: '取不到终端尺寸(columns/rows 为 undefined),不猜尺寸硬画' }
  }
  if (!Number.isFinite(tty.columns) || !Number.isFinite(tty.rows)) {
    return { kind: 'undetermined', reason: `终端尺寸非有限值 ${String(tty.columns)}x${String(tty.rows)}` }
  }
  const size: Size = { cols: Math.floor(tty.columns), rows: Math.floor(tty.rows) }
  const color = env.noColor === undefined || env.noColor === ''
  return { kind: 'supported', color, size }
}

/** 现读探针:只在**真读不到**时才交 undefined,不得把 0 当"读不到"。 */
export function probeTerminal(): { env: TerminalEnvSlice; tty: TerminalTtySlice } {
  const out = process.stdout as NodeJS.WriteStream & { columns?: number; rows?: number }
  return {
    env: { term: process.env.TERM, noColor: process.env.NO_COLOR, forced: process.env.IHUI_TUI },
    tty: {
      stdinTty: Boolean(process.stdin.isTTY),
      stdoutTty: Boolean(out.isTTY),
      columns: typeof out.columns === 'number' ? out.columns : undefined,
      rows: typeof out.rows === 'number' ? out.rows : undefined,
    },
  }
}

/** 默认档:未显式设置时走哪条路。见 `DEFAULT_MODE_NOTE` —— 这个值必须写进交付说明。 */
export const DEFAULT_FULL_SCREEN = false as const

export const DEFAULT_MODE_NOTE =
  '默认档 = 旧精简行模式(legacy)。全屏 TUI 必须显式开启(`ihui tui`,或 IHUI_TUI=1 让 chat/REPL 入口改走全屏)。' +
  '理由:全屏接管会改变**所有现存交互式调用方**(ACP、桌面 pty、e2e、脚本管道)的可见行为,' +
  '而本次交付只声明"最小可用全屏界面",没声明"替换默认交互";默认接管属未拍板的行为变更。' +
  '回退开关:IHUI_TUI=0 / --no-tui(优先级高于 IHUI_TUI=1,也高于 --tui)。'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
