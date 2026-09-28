// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全屏 TUI —— 语义动作与输入缓冲(纯函数层)。
 *
 * 边界说明(重要):`InputBuffer` 是**输入框自己的光标与草稿**,不是对话状态;
 * 对话状态(history / session / usage)恒由 `src/server/agent-core.js` 与
 * `src/commands/session.js` 持有,TUI 只读它们、不另存一份。
 * 提交过的行记在 `InputBuffer.history` 里只为做 ↑/↓ 回查,它不参与任何业务判定。
 */

export type CursorMove = -1 | 0 | 1 | 2

export type KeyAction =
  | { type: 'submit' }
  | { type: 'quit' }
  | { type: 'cancelOrQuit'; running: boolean }
  | { type: 'scroll'; lines: number }
  | { type: 'scrollPage'; dir: number }
  | { type: 'scrollEnd' }
  | { type: 'scrollTop' }
  | { type: 'moveCursor'; dir: CursorMove }
  | { type: 'deleteBackward' }
  | { type: 'deleteForward' }
  | { type: 'deleteWordBack' }
  | { type: 'clearInput' }
  | { type: 'historyUp' }
  | { type: 'historyDown' }
  | { type: 'redraw' }
  | { type: 'toggleVerbose' }
  | { type: 'insert'; text: string }
  | { type: 'unbound'; label: string }

/** 输入缓冲:text 是字符序列,caret 是**码位下标**(不是 UTF-16 长度)。 */
export interface InputBuffer {
  chars: string[]
  caret: number
  /** 已提交历史(最新在末尾),用于 ↑/↓ 回查 */
  history: string[]
  /** 当前浏览到的历史上标;-1 表示正在编辑草稿 */
  historyIndex: number
  /** 浏览历史期间暂存的草稿,退出浏览时还原 */
  draft: string[] | null
}

export function createInputBuffer(): InputBuffer {
  return { chars: [], caret: 0, history: [], historyIndex: -1, draft: null }
}

export function inputText(state: InputBuffer): string {
  return state.chars.join('')
}

function clampCaret(caret: number, len: number): number {
  if (!Number.isFinite(caret)) return 0
  return Math.max(0, Math.min(Math.floor(caret), len))
}

/**
 * 把动作作用到输入缓冲上,返回新缓冲与被吞掉的"非编辑动作"计数。
 * 不修改入参 —— 单测靠这条不变量断言(改了入参的话,同一动作打两遍就会产出不同结果,
 * 而那正是"看起来对、其实状态在偷偷累积"的那一型)。
 */
export function reduceInput(state: InputBuffer, action: KeyAction): InputBuffer {
  switch (action.type) {
    case 'insert': {
      const add = [...action.text]
      const chars = [...state.chars.slice(0, state.caret), ...add, ...state.chars.slice(state.caret)]
      return { ...state, chars, caret: state.caret + add.length }
    }
    case 'deleteBackward': {
      if (state.caret === 0) return state
      const chars = [...state.chars.slice(0, state.caret - 1), ...state.chars.slice(state.caret)]
      return { ...state, chars, caret: state.caret - 1 }
    }
    case 'deleteForward': {
      if (state.caret >= state.chars.length) return state
      const chars = [...state.chars.slice(0, state.caret), ...state.chars.slice(state.caret + 1)]
      return { ...state, chars }
    }
    case 'deleteWordBack': {
      if (state.caret === 0) return state
      let i = state.caret
      while (i > 0 && state.chars[i - 1] === ' ') i--
      while (i > 0 && state.chars[i - 1] !== ' ') i--
      const chars = [...state.chars.slice(0, i), ...state.chars.slice(state.caret)]
      return { ...state, chars, caret: i }
    }
    case 'clearInput':
      return { ...state, chars: [], caret: 0, historyIndex: -1, draft: null }
    case 'moveCursor': {
      if (action.dir === 0) return { ...state, caret: 0 }
      if (action.dir === 2) return { ...state, caret: state.chars.length }
      return { ...state, caret: clampCaret(state.caret + action.dir, state.chars.length) }
    }
    case 'historyUp': {
      if (state.history.length === 0) return state
      const idx = state.historyIndex === -1 ? state.history.length - 1 : Math.max(0, state.historyIndex - 1)
      const entry = state.history[idx] ?? ''
      const draft = state.historyIndex === -1 ? state.chars : state.draft
      return { ...state, historyIndex: idx, draft: draft ?? [], chars: [...entry], caret: entry.length }
    }
    case 'historyDown': {
      if (state.historyIndex === -1) return state
      const idx = state.historyIndex + 1
      if (idx >= state.history.length) {
        const restored = state.draft ?? []
        return { ...state, historyIndex: -1, chars: restored, caret: restored.length, draft: null }
      }
      const entry = state.history[idx] ?? ''
      return { ...state, historyIndex: idx, chars: [...entry], caret: entry.length }
    }
    case 'submit': {
      const text = inputText(state)
      if (text.trim() === '') return state
      return {
        chars: [],
        caret: 0,
        history: [...state.history, text],
        historyIndex: -1,
        draft: null,
      }
    }
    default:
      return state
  }
}

/** 本 TUI 实际绑定的快捷键 —— 提示行与解码表必须同源,否则提示会撒谎。 */
export const KEY_HINTS: readonly { keys: string; what: string }[] = [
  { keys: 'Enter', what: 'send' },
  { keys: '↑/↓', what: 'history' },
  { keys: 'PgUp/PgDn', what: 'scroll' },
  { keys: 'Ctrl+E', what: 'follow' },
  { keys: 'Ctrl+R', what: 'detail' },
  { keys: 'Ctrl+L', what: 'redraw' },
  { keys: 'Ctrl+C', what: 'cancel/quit' },
  { keys: 'Esc', what: 'quit' },
]

/**
 * 快捷键提示的一行文本(渲染层与单测共读这一份,不在两处各写一遍)。
 * 裁切交给 frame 层的 fitLine 做 —— 那里有显示宽度判据,按字符数在这里切会在
 * 宽字符中间断刀。
 */
export function keyHintLine(): string {
  return KEY_HINTS.map((h) => `${h.keys} ${h.what}`).join(' · ')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
