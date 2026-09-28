// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全屏 TUI —— 会话编排层。
 *
 * 职责边界(这条最重要):本文件**不持有任何对话状态**。
 * 它只做三件事:① 把宿主(AgentCore 或远程 TuiClient)发来的 `AgentEvent` 折成视图模型;
 * ② 把按键解码成语义动作并作用到"输入框草稿 + 滚动位置"这两件纯 UI 状态上;
 * ③ 提交时把文本交回宿主。
 * 历史、会话、用量、权限档全部住在宿主那一侧 —— 所以这里没有第二份真相源。
 */

import { createTaskStatusLine, formatTaskStatusLine, toolActivityLabel, type TaskStatusLine } from '../../commands/task-status-line.js'
import type { AgentEventHandler } from '../../server/agent-core.js'
import {
  createInputBuffer,
  inputText,
  reduceInput,
  type InputBuffer,
  type KeyAction,
} from './actions.js'
import { computeBoxes, type Size } from './geometry.js'
import { decodeInput } from './keymap.js'
import { composeFrame, inputCaretColumn, wrapTranscript, type HeaderInfo } from './frame.js'
import { diffFrames, frameToAnsi } from './render.js'
import { followLabel, scrollBottom, scrollIndicator, scrollPage, afterContentGrew, scrollBy, visibleWindow, scrollInitial, scrollTop as scrollTopScroll, type ScrollState } from './scroll.js'
import type { FullScreenTerminal } from './terminal.js'
import { blocksToLines, createTranscript, foldEvent, seedFromHistory, type Transcript } from './transcript.js'

/** 一次性提示的存活时长:够读完一行,又不会一直占着顶格。 */
const TOAST_MS = 2_500

/**
 * 对话宿主:本地 AgentCore 与远程 TuiClient 都实现它。
 * 刻意只做"发一句、收事件、能取消"三件事 —— 再多的能力就该长在宿主那一侧,
 * 而不是在 TUI 里再实现一遍。
 */
export interface ConversationHost {
  send(text: string, onEvent: AgentEventHandler, signal: AbortSignal): Promise<void>
  cancel(): void
  dispose(): Promise<void>
}

export interface FullScreenAppOptions {
  term: FullScreenTerminal
  host: ConversationHost
  header: HeaderInfo
  size: Size
  color: boolean
  /** 已存会话的历史(只读投影进来;undefined = 新会话) */
  initialHistory?: readonly { role: string; content: string }[]
  /** 退出原因回调:由调用方决定进程怎么走 */
  onExitNote?: (note: string) => void
}

export interface FullScreenAppState {
  transcript: Transcript
  scroll: ScrollState
  input: InputBuffer
  verbose: boolean
  running: boolean
  toast: string
  activity: string
}

/**
 * 一帧的全部输入 —— 抽成纯函数,单测才能不碰真终端就断言布局
 * ("行数是 rows 吗""每行占满 cols 吗""滚到顶了没"都必须可断言)。
 * `status` 允许传 null:那等于"状态区此刻无话可说",布局必须照常成立
 * (否则测一次布局就要背起整个状态行机器)。
 */
export function snapshotFrame(
  state: FullScreenAppState,
  status: TaskStatusLine | null,
  header: HeaderInfo,
  size: Size,
  color: boolean,
): { lines: string[]; caret: { row: number; col: number } | null } {
  const boxes = computeBoxes(size)
  const logical = blocksToLines(state.transcript, { verbose: state.verbose })
  const wrapped = wrapTranscript(logical, size.cols)
  const win = visibleWindow(wrapped.length, boxes ? boxes.transcriptRows : 0, state.scroll)
  const vm = status ? status.viewModel() : null
  const progress = vm ? formatTaskStatusLine(vm) : ''
  const note = scrollIndicator(win, wrapped.length)
  const frame = composeFrame({
    size,
    header,
    transcript: logical,
    win,
    toast: state.toast,
    status: {
      progress,
      activity: state.activity,
      scrollNote: `${followLabel(state.scroll)}${note === '' ? '' : ` ${note}`}`,
      verbose: state.verbose,
    },
    input: { text: inputText(state.input), caret: state.input.caret, placeholder: 'ask the agent, Enter to send' },
  })
  return {
    lines: frameToAnsi(frame, color),
    // caret=null 是"这尺寸画不了"的信号:paint() 据此**整帧不写**,而不是写一屏空白
    // 把用户已经看到的内容擦掉。尺寸判不可用的处置在 onResize / 能力判定里,不靠这里猜。
    caret: boxes
      ? { row: boxes.input, col: inputCaretColumn({ text: inputText(state.input), caret: state.input.caret, placeholder: '' }) }
      : null,
  }
}

/**
 * 跑一个全屏会话。返回退出原因字符串(调用方打印在 alt-screen 之外)。
 * 终端状态的还原由 `withFullScreen()` 负责,本函数只管"什么时候请求退出"。
 */
export async function runFullScreenSession(opts: FullScreenAppOptions): Promise<string> {
  const { term, host, header, color } = opts
  let size: Size = opts.size

  const state: FullScreenAppState = {
    transcript: opts.initialHistory ? seedFromHistory(createTranscript(), opts.initialHistory) : createTranscript(),
    scroll: scrollInitial(),
    input: createInputBuffer(),
    verbose: false,
    running: false,
    toast: '',
    activity: '',
  }

  // 状态区真相源:共享层推导(端内不数步骤、不算百分比)。
  // write 注入成 no-op —— 全屏宿主里"追加一行"会顶掉整屏,状态必须走 viewModel() 渲染。
  const status = createTaskStatusLine({
    write: () => {},
    enabled: () => true,
    columns: () => size.cols,
  })

  let quitRequested: ((reason: string) => void) | null = null
  const exitPromise = new Promise<string>((resolve) => {
    quitRequested = resolve
  })

  /**
   * 当前轮次的取消句柄。用**对象持有**而不是裸 `let abort: AbortController | null`:
   * 后者在 finally 里被赋成 null 后,tsc 的流分析会把退出路径上的读取窄化成 never
   * (实测报 "Property 'abort' does not exist on type 'never'"),
   * 那等于编译器替我们断定"这里不可能有在飞的请求" —— 而它凭什么知道。
   */
  const abortRef: { current: AbortController | null } = { current: null }
  let prevFrame: string[] | null = null
  let scheduled = false
  let disposed = false
  let toastTimer: NodeJS.Timeout | null = null

  const paint = (): void => {
    const { lines, caret } = snapshotFrame(state, status, header, size, color)
    // caret=null ⇒ 当前尺寸撑不起四个区域。整帧**不写**:写一屏空白等于把用户
    // 已经读到的内容擦掉,而"画不出来"不等于"没有内容"。
    if (!caret) return
    const payload = diffFrames(prevFrame, lines)
    prevFrame = lines
    if (payload !== '') term.paint(payload)
    term.setCursor(caret.row, caret.col)
  }

  /**
   * 帧节流:token 事件每秒可到几十次,同步重绘会把 CPU 打在画面上、
   * 并把 stdout 写成一串交错碎片(部分终端还会闪)。setImmediate 合帧足够。
   */
  const schedule = (): void => {
    if (scheduled || disposed) return
    scheduled = true
    setImmediate(() => {
      scheduled = false
      if (!disposed) paint()
    })
  }

  const setToast = (text: string): void => {
    state.toast = text
    if (toastTimer) clearTimeout(toastTimer)
    // 提示必须自己会消失:常驻的"上一次按错键"文案比没有文案更误导。
    toastTimer = setTimeout(() => {
      toastTimer = null
      if (state.toast === text) {
        state.toast = ''
        schedule()
      }
    }, TOAST_MS)
    toastTimer.unref?.()
    schedule()
  }

  /** 消息区折行后的总高:滚动量的唯一算法,三个滚动分支共用一份(两处各折一次必漂移)。 */
  const scrollTotal = (): number =>
    wrapTranscript(blocksToLines(state.transcript, { verbose: state.verbose }), size.cols).length

  const submit = (): void => {
    const text = inputText(state.input)
    if (text.trim() === '') return
    if (state.running) {
      // 运行中提交 = 插话。AgentCore 没有"运行中注入"的公开出口(repl 那套靠自己的
      // interjectionBuffer),所以这里明确交代"做不到",绝不让用户以为消息已送出。
      setToast('agent is running — Ctrl+C to interrupt, then send')
      return
    }
    state.input = reduceInput(state.input, { type: 'submit' })
    state.transcript = {
      ...state.transcript,
      blocks: [...state.transcript.blocks, { kind: 'user', text }],
    }
    state.scroll = scrollBottom()
    void runTurn(text)
  }

  const runTurn = async (text: string): Promise<void> => {
    state.running = true
    status.beginTurn()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const onEvent: AgentEventHandler = (ev) => {
      const before = state.transcript.blocks.length
      state.transcript = foldEvent(state.transcript, ev)
      if (state.transcript.blocks.length !== before) {
        state.scroll = afterContentGrew(state.scroll, state.transcript.blocks.length - before)
      }
      if (ev.type === 'tool_call') {
        status.recordToolCall({ toolName: ev.name, args: ev.args })
        state.activity = toolActivityLabel(ev.name, ev.args)
      } else if (ev.type === 'tool_result') {
        status.recordToolResult(ev.name, ev.success, ev.output)
        state.activity = ''
      } else if (ev.type === 'iteration') {
        status.setCurrentActivity(`iter ${ev.count}/${ev.max}`)
      } else if (ev.type === 'error') {
        state.activity = ''
      } else if (ev.type === 'done') {
        state.activity = ''
      }
      schedule()
    }
    try {
      await host.send(text, onEvent, ctrl.signal)
      status.endTurn('completed')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      state.transcript = {
        ...state.transcript,
        blocks: [...state.transcript.blocks, { kind: 'notice', tone: 'bad', text: message }],
      }
      status.endTurn('failed')
    } finally {
      state.running = false
      abortRef.current = null
      schedule()
    }
  }

  const dispatch = (action: KeyAction): void => {
    switch (action.type) {
      case 'insert':
      case 'deleteBackward':
      case 'deleteForward':
      case 'deleteWordBack':
      case 'clearInput':
      case 'historyUp':
      case 'historyDown':
      case 'moveCursor':
        state.input = reduceInput(state.input, action)
        break
      case 'submit':
        submit()
        break
      case 'toggleVerbose':
        state.verbose = !state.verbose
        break
      case 'redraw':
        prevFrame = null
        break
      case 'scrollEnd':
        state.scroll = scrollBottom()
        break
      case 'scrollTop':
        state.scroll = scrollTopScroll(scrollTotal())
        break
      case 'scroll': {
        const boxes = computeBoxes(size)
        state.scroll = scrollBy(state.scroll, action.lines, Math.max(scrollTotal(), boxes ? boxes.transcriptRows : 1))
        break
      }
      case 'scrollPage': {
        const boxes = computeBoxes(size)
        state.scroll = scrollPage(state.scroll, action.dir, boxes ? boxes.transcriptRows : 10, Math.max(scrollTotal(), 1))
        break
      }
      case 'cancelOrQuit': {
        const inflight = action.running ? abortRef.current : null
        if (inflight) {
          inflight.abort()
          host.cancel()
          setToast('cancelling current turn…')
        } else {
          quitRequested?.('quit')
        }
        return
      }
      case 'quit':
        quitRequested?.('quit')
        return
      case 'unbound':
        setToast(`unbound key: ${action.label}`)
        return
      default:
        break
    }
    schedule()
  }

  const onInput = (chunk: string): void => {
    for (const action of decodeInput(chunk, { running: state.running })) dispatch(action)
  }
  const onResize = (next: Size): void => {
    size = next
    prevFrame = null // 尺寸变了,旧帧的行号全部失效 —— 不整屏重画就会串行
    // 被拖到撑不起布局的尺寸时:主动退出并说明原因。留在"什么都不画"的状态里,
    // 用户看到的是冻结的旧屏 + 一个不响的界面,那比退出来更糟。
    if (!computeBoxes(size)) quitRequested?.(`terminal too small (${size.cols}x${size.rows})`)
    schedule()
  }

  term.on('input', onInput)
  term.on('resize', onResize)
  paint()

  const reason = await exitPromise
  disposed = true
  if (toastTimer) clearTimeout(toastTimer)
  term.off('input', onInput)
  term.off('resize', onResize)
  // 终端还原归本函数,不归调用方:它已经写过 enterSequence / HideCursor 的第一帧,就有义务在
  // **任何**退出路径上把 alt-screen 与光标还回去 —— 留给调用方去 dispose,意味着 host.dispose()
  // 或 abort 之前抛错的会话会把用户的终端永久留在 alt-screen 里(raw mode 也一起没关)。
  // 放在 host.dispose() **之前**:dispose 幂等,调用方再兜一次不会发出第二组还原序列。
  term.dispose()
  abortRef.current?.abort()
  if (state.running) host.cancel()
  status.reset()
  await host.dispose()
  return reason
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
