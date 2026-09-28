// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全屏 TUI —— 整屏帧的合成(纯函数层)。
 *
 * 契约:composeFrame 产出的数组**长度恒等于 rows**,每行**恒占满 cols 列**
 * (fitLine 负责补齐/裁切)。这条不变量是"全屏"的定义本身 ——
 * 少一行就会露出上一帧的残影,多一行就会把终端顶出滚动区(那是行模式的失效形态)。
 * 单测直接钉这两条,不靠人眼看。
 */

import { keyHintLine } from './actions.js'
import { computeBoxes, fitLine, plainLine, textWidth, wrapAll, type FrameLine, type Size, type Tone } from './geometry.js'
import type { VisibleWindow } from './scroll.js'

export interface HeaderInfo {
  model: string
  workspace: string
  /** 会话 id 尾段(完整 id 在 /status 里看,状态栏只给可辨认的前缀) */
  session: string
  /** 权限档,来自 AgentCore 构造入参 —— 端内不自造第二份词汇 */
  permissionMode: string
}

export interface StatusInfo {
  /** 由 `formatTaskStatusLine(viewModel())` 给出:共享层推导,端内不重算 */
  progress: string
  /** 工具活动行(toolActivityLabel 的产物) */
  activity: string
  /** 滚动交代 + LIVE/SCROLL */
  scrollNote: string
  verbose: boolean
}

export interface InputInfo {
  text: string
  /** 码位下标 */
  caret: number
  placeholder: string
}

export interface FrameInput {
  size: Size
  header: HeaderInfo
  /** 未折行的转录逻辑行 */
  transcript: readonly FrameLine[]
  win: VisibleWindow
  status: StatusInfo
  input: InputInfo
  /** 顶部一次性提示(如"正在取消"),为空则不占位 */
  toast?: string
}

function toneForError(text: string): Tone {
  return text === '' ? 'dim' : 'bad'
}

/** 顶栏:左模型/工作区,右会话/权限档,中间补空格。 */
export function renderHeader(info: HeaderInfo, cols: number): FrameLine {
  const left = `${info.model} · ${info.workspace}`
  const right = `session ${info.session || '-'} · ${info.permissionMode}`
  const gap = Math.max(1, cols - textWidth(left) - textWidth(right))
  return fitLine({ segs: [{ text: left, tone: 'accent' }, { text: ' '.repeat(gap), tone: 'plain' }, { text: right, tone: 'dim' }] }, cols)
}

/** 状态区一行:进度 + 活动 + 滚动交代。任何一段为空都不硬凑占位符。 */
export function renderStatus(info: StatusInfo, cols: number): FrameLine {
  const parts: { text: string; tone: Tone }[] = []
  if (info.progress !== '') parts.push({ text: info.progress, tone: 'plain' })
  if (info.activity !== '') parts.push({ text: info.activity, tone: 'accent' })
  if (info.verbose) parts.push({ text: 'verbose', tone: 'dim' })
  const right = info.scrollNote
  if (parts.length === 0) {
    return fitLine({ segs: [{ text: right === '' ? 'idle' : `· ${right}`, tone: 'dim' }] }, cols)
  }
  const body = parts.map((p) => p.text).join('  ')
  const gap = Math.max(1, cols - textWidth(body) - textWidth(right))
  return fitLine(
    {
      segs: [
        ...parts.map((p, i) => ({ text: (i === 0 ? '' : '  ') + p.text, tone: p.tone })),
        { text: ' '.repeat(gap), tone: 'plain' },
        { text: right, tone: 'dim' },
      ],
    },
    cols,
  )
}

/** 输入行:`❯ ` 前缀 + 草稿;空草稿时给占位提示。 */
export function renderInput(info: InputInfo, cols: number): FrameLine {
  const prefix = { text: '❯ ', tone: 'accent' as Tone }
  if (info.text === '') {
    return fitLine({ segs: [prefix, { text: info.placeholder, tone: 'dim' }] }, cols)
  }
  return fitLine({ segs: [prefix, { text: info.text, tone: 'plain' }] }, cols)
}

/**
 * 光标应落在的**可视列**(0 基,相对行首)。
 * 必须按显示宽度算而不是按码位数:CJK 记 2 列,按字符数算会让光标偏左半格 ——
 * 这是中文终端最经典的那一格错位。
 */
export function inputCaretColumn(info: InputInfo): number {
  const upto = [...info.text].slice(0, Math.max(0, info.caret)).join('')
  return 2 + textWidth(upto)
}

/** 底栏快捷键提示(与解码表同源,见 actions.KEY_HINTS);超宽由 fitLine 统一裁。 */
export function renderHints(cols: number): FrameLine {
  return fitLine(plainLine(keyHintLine(), 'dim'), cols)
}

/** 分隔线:用背景色反白的细线,不画 ASCII 横线(横线在 CJK 下会抖)。 */
export function renderRule(cols: number, tone: Tone = 'dim'): FrameLine {
  return fitLine(plainLine('─'.repeat(cols), tone), cols)
}

/**
 * 合成整屏。返回恰好 size.rows 行、每行恰好 size.cols 列。
 * 区域分配失败(computeBoxes 判不可用)时返回全空屏并由调用方负责退出 ——
 * 这里刻意不抛异常:抛在渲染循环里等于把终端留在 alt-screen,是脏状态。
 */
export function composeFrame(input: FrameInput): FrameLine[] {
  const { size } = input
  const boxes = computeBoxes(size)
  const blank = Array.from({ length: size.rows }, () => fitLine(plainLine(''), size.cols))
  if (!boxes) return blank

  const wrapped = wrapAll(input.transcript, size.cols)
  const viewRows = wrapped.slice(input.win.start, input.win.end)

  blank[boxes.header] = renderHeader(input.header, size.cols)
  blank[boxes.status] = renderStatus(input.status, size.cols)
  blank[boxes.hints] = renderHints(size.cols)
  for (let i = 0; i < boxes.inputRows; i++) {
    blank[boxes.input + i] = i === 0 ? renderInput(input.input, size.cols) : fitLine(plainLine(''), size.cols)
  }
  for (let i = 0; i < boxes.transcriptRows; i++) {
    const line = viewRows[i]
    blank[boxes.transcriptTop + i] = line ? fitLine(line, size.cols) : fitLine(plainLine(''), size.cols)
  }
  if (input.toast && input.toast !== '') {
    const at = boxes.transcriptTop
    blank[at] = fitLine(plainLine(input.toast, toneForError(input.toast)), size.cols)
  }
  return blank
}

/** 折出消息区可见行需要的总高 —— 与 composeFrame 用的是同一份 wrapAll,不得两处各折一次。 */
export function wrapTranscript(transcript: readonly FrameLine[], cols: number): FrameLine[] {
  return wrapAll(transcript, cols)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
