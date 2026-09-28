// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全屏 TUI —— 按键解码与语义动作(纯函数层)。
 *
 * 为什么单独一层:快捷键映射必须能断言("按 PgUp 到底是滚还是插字符"是
 * 可判定的),而一旦把解码混进 stdin 回调就只能人眼验收。
 *
 * 输入是 stdin 在 raw mode 下收到的**原始字符串**(UTF-8 已解码),输出是语义动作数组 ——
 * 一个 chunk 可能含多个动作(粘贴多行 / 终端把序列成串发来)。
 *
 * 键位分工(刻意与 readline 的既有习惯对齐,避免"同一个键在两个模式里干不同的事"):
 *   ↑/↓   = 输入历史回查(旧 readline 就是这个语义,全屏里改判成滚动会让人误操作)
 *   PgUp/PgDn = 消息区翻页   Ctrl+E = 贴底并恢复跟随   Ctrl+R = 工具详情展开
 *   ←/→/Home/End = 输入框内移动光标
 */

import type { KeyAction } from './actions.js'

/** 与运行态相关的解码上下文:Ctrl+C 在跑与不跑语义不同(取消 vs 退出)。 */
export interface DecodeContext {
  running: boolean
}

/** 单个码位 → 控制键动作构造器(只列本 TUI 真绑定的那几个)。 */
const CONTROL_KEYS: Record<number, (ctx: DecodeContext) => KeyAction> = {
  // Ctrl+C:运行中=取消本轮,空闲=退出。语义分叉由 ctx.running 决定。
  0x03: (ctx) => ({ type: 'cancelOrQuit', running: ctx.running }),
  0x0c: () => ({ type: 'redraw' }),
  0x05: () => ({ type: 'scrollEnd' }), // Ctrl+E
  0x0e: () => ({ type: 'historyDown' }), // Ctrl+N
  0x10: () => ({ type: 'historyUp' }), // Ctrl+P
  // Ctrl+R 在此不做反向搜索(那是另一件事),复用为工具详情开关:提示行与解码同源。
  0x12: () => ({ type: 'toggleVerbose' }),
  0x15: () => ({ type: 'clearInput' }), // Ctrl+U
  0x17: () => ({ type: 'deleteWordBack' }), // Ctrl+W
}

/** 本 TUI 未绑定但必须**吞掉**的 CSI 最终字节(不吞就会把残字符灌进输入框)。 */
const IGNORED_CSI_FINALS = new Set(['h', 'l', 't', 's', 'u', 'V', 'S'])

// CSI 终结字节是 0x40–0x7E(`@`–`~`),中间字节是 0x20–0x2F(` `–`/`)。
// 曾写成 `[@-aAb-HJ-Z\\^_`-~]`:其中 `b-H` 是倒序区间,**模块一 import 就抛
// "Range out of order in character class"**(类型检查看不见,只有真加载才炸)。
const CSI_RE = /^\x1b\[[0-9;?]*[ -/]*([@-~])/
const SS3_RE = /^\x1bO([A-Z])/
const OSC_RE = /^\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/

function csiAction(final: string, params: string): KeyAction | null {
  switch (final) {
    case 'A':
      return { type: 'historyUp' }
    case 'B':
      return { type: 'historyDown' }
    case 'C':
      return { type: 'moveCursor', dir: 1 }
    case 'D':
      return { type: 'moveCursor', dir: -1 }
    case 'H':
      return { type: 'moveCursor', dir: 0 }
    case 'F':
      return { type: 'moveCursor', dir: 2 }
    case 'Z':
      // Shift+Tab:模式切换在本宿主不可达(AgentCore 没有运行期 permissionMode 设值口),
      // 所以这里刻意**不**绑成假动作,显式报未绑定 —— 假动作比无动作更坏(它会让人以为切了)。
      return { type: 'unbound', label: 'Shift+Tab' }
    case 'P':
      return { type: 'unbound', label: 'F1' }
    case 'Q':
      return { type: 'unbound', label: 'F2' }
    case 'R':
      return { type: 'unbound', label: 'F3' }
    case 'S':
      return { type: 'unbound', label: 'F4' }
    case '~':
      // 带参数的 ~ 族:1/7=Home、4/8=End、5=PgUp、6=PgDn、3=Delete。
      if (params === '1' || params === '7') return { type: 'moveCursor', dir: 0 }
      if (params === '4' || params === '8') return { type: 'moveCursor', dir: 2 }
      if (params === '5') return { type: 'scrollPage', dir: -1 }
      if (params === '6') return { type: 'scrollPage', dir: 1 }
      if (params === '3') return { type: 'deleteForward' }
      return null
    default:
      return null
  }
}

/**
 * 解码一个 chunk。未识别的转义序列一律归 `unbound`(只吞不猜),
 * 绝不把 `\x1b` 当普通字符塞进输入框 —— 那会让按一次方向键就在输入里多出 "[A"。
 */
export function decodeInput(chunk: string, ctx: DecodeContext): KeyAction[] {
  const out: KeyAction[] = []
  let rest = chunk
  let guard = 0
  while (rest.length > 0) {
    if (++guard > 10_000) break // 防御:任何解析错都不得让 TUI 卡死在循环里

    // ESC 单独成键 = 退出(与 \x1b[ / \x1bO / \x1b] 序列区分)
    if (rest === '\x1b') {
      out.push({ type: 'quit' })
      break
    }
    const osc = OSC_RE.exec(rest)
    if (osc && osc.index === 0) {
      out.push({ type: 'unbound', label: 'OSC' })
      rest = rest.slice(osc[0].length)
      continue
    }
    if (rest.startsWith('\x1b[')) {
      const m = CSI_RE.exec(rest)
      if (!m) {
        // 序列不完整(终端分批送达)或形态未知:整段吞掉,不污染输入。
        out.push({ type: 'unbound', label: 'CSI' })
        rest = ''
        continue
      }
      const final = m[1] ?? ''
      // 参数 = CSI 与最终字节之间的部分:\x1b[ 占 2 列、最终字节占 1 列。
      const params = m[0].slice(2, m[0].length - 1).split(';')[0] ?? ''
      if (IGNORED_CSI_FINALS.has(final)) {
        out.push({ type: 'unbound', label: `CSI${final}` })
      } else {
        out.push(csiAction(final, params) ?? { type: 'unbound', label: `CSI${final}` })
      }
      rest = rest.slice(m[0].length)
      continue
    }
    if (rest.startsWith('\x1bO')) {
      const m = SS3_RE.exec(rest)
      if (m) {
        const f = m[1] ?? ''
        out.push(csiAction(f, '') ?? { type: 'unbound', label: `SS3${f}` })
        rest = rest.slice(m[0].length)
        continue
      }
      out.push({ type: 'unbound', label: 'SS3' })
      break
    }
    // Alt+字符:本 TUI 未绑定。整对吞掉 —— 只吞 ESC 会把后面的字符当成键入。
    if (rest.startsWith('\x1b') && rest.length >= 2) {
      out.push({ type: 'unbound', label: 'Alt' })
      rest = rest.slice(2)
      continue
    }

    const ch = rest[0]
    if (ch === undefined) break
    // 码位必须从 **整串** 取:`rest[0]` 只有一个 UTF-16 码元,对代理对它拿到的是孤立高位
    // (0xD83D),`> 0xffff` 永假 ⇒ emoji / 生僻字被劈成两个坏码位上屏。
    const cp = rest.codePointAt(0) ?? 0
    if (ch === '\r' || ch === '\n') {
      out.push({ type: 'submit' })
      rest = rest.slice(1)
      continue
    }
    if (ch === '\t') {
      out.push({ type: 'unbound', label: 'Tab' })
      rest = rest.slice(1)
      continue
    }
    if (cp === 0x08 || cp === 0x7f) {
      out.push({ type: 'deleteBackward' })
      rest = rest.slice(1)
      continue
    }
    const control = CONTROL_KEYS[cp]
    if (control) {
      out.push(control(ctx))
      rest = rest.slice(1)
      continue
    }
    if (cp < 0x20) {
      // 其余控制字符(响铃等)一律吞掉,不进输入框。
      out.push({ type: 'unbound', label: `ctrl${cp}` })
      rest = rest.slice(1)
      continue
    }
    // 普通可打印字符:一次吞一个码位(代理对必须整体收,否则 emoji / 生僻字会拆坏)。
    const size = cp > 0xffff ? 2 : 1
    out.push({ type: 'insert', text: rest.slice(0, size) })
    rest = rest.slice(size)
  }
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
