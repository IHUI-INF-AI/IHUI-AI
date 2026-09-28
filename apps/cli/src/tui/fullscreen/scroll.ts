// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全屏 TUI —— 滚动位置(纯函数层)。
 *
 * 语义:`offsetFromBottom` 是"离最底还差几行",0 = 贴着最新。
 * 用"距底部"而不是"顶部绝对行号",因为消息区在流式追加时绝对行号会一路变,
 * 只有相对底部的位置在"用户读历史"与"新内容到达"之间语义稳定。
 *
 * follow = 是否自动跟随新内容。用户向上滚动即取消跟随;按 End / PgDn 到底重新跟随。
 */

export interface ScrollState {
  /** 距底部的行数(>=0,会被 clamp) */
  offsetFromBottom: number
  /** 是否贴底自动跟随流式输出 */
  follow: boolean
}

export interface VisibleWindow {
  /** 起始下标(含) */
  start: number
  /** 结束下标(不含) */
  end: number
  /** 顶部被卷掉的行数(画滚动条/百分比用) */
  above: number
  /** 底部未显示的行数 */
  below: number
}

export function scrollInitial(): ScrollState {
  return { offsetFromBottom: 0, follow: true }
}

function clampOffset(offset: number, total: number): number {
  if (!Number.isFinite(offset) || offset <= 0) return 0
  return Math.min(Math.floor(offset), Math.max(0, total - 1))
}

/** 相对当前位置移动 dir 行(dir<0 往上读历史,dir>0 往下)。 */
export function scrollBy(state: ScrollState, dir: number, total: number): ScrollState {
  if (total <= 0) return scrollInitial()
  const next = clampOffset(state.offsetFromBottom - dir, total)
  return { offsetFromBottom: next, follow: next === 0 }
}

/** 翻一页:dir=1 向下、-1 向上。pageSize<=0 时退化为按行滚。 */
export function scrollPage(state: ScrollState, dir: number, pageSize: number, total: number): ScrollState {
  const step = pageSize > 0 ? pageSize : 1
  return scrollBy(state, dir * step, total)
}

/** 回到顶部(offset = 总高 - 1,即窗口贴到最上一屏)。 */
export function scrollTop(total: number): ScrollState {
  return { offsetFromBottom: Math.max(0, total - 1), follow: false }
}

/** 贴底并恢复跟随。 */
export function scrollBottom(): ScrollState {
  return { follow: true, offsetFromBottom: 0 }
}

/**
 * 内容追加后的位置调整:grew 行新内容在用户往上读时**不得**把视野顶走,
 * 所以非跟随态要把 offset 同步加上了 grew,才保持"读的还是那一段"。
 */
export function afterContentGrew(state: ScrollState, grew: number): ScrollState {
  if (state.follow || grew <= 0) return state
  return { ...state, offsetFromBottom: state.offsetFromBottom + grew }
}

/** 求出应当渲染的绝对行区间。total<=0 时给空窗。 */
export function visibleWindow(linesCount: number, viewportRows: number, state: ScrollState): VisibleWindow {
  if (linesCount <= 0 || viewportRows <= 0) {
    return { start: 0, end: 0, above: 0, below: 0 }
  }
  const rows = Math.min(viewportRows, linesCount)
  const offset = clampOffset(state.offsetFromBottom, linesCount)
  const end = Math.max(rows, linesCount - offset)
  const start = Math.max(0, end - rows)
  return { start, end: start + rows, above: start, below: Math.max(0, linesCount - (start + rows)) }
}

/** 滚动位置的可读交代(画在状态区右上角,不硬猜)。 */
export function scrollIndicator(win: VisibleWindow, total: number): string {
  if (total <= 0) return ''
  if (win.above === 0 && win.below <= 0) return `${total}/${total}`
  return `${win.start + 1}-${win.end}/${total} +${win.below}`
}

/** 滚得越远提示越明确 —— 贴底与否是两个不同的用户心智,不得混显。 */
export function followLabel(state: ScrollState): 'LIVE' | 'SCROLL' {
  return state.follow ? 'LIVE' : 'SCROLL'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
