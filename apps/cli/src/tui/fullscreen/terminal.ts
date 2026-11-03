// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全屏 TUI —— 终端驱动(唯一碰真 stdin/stdout 的一层)。
 *
 * 这一层的存在理由只有一个:**把"改终端状态"这件事收在单一出口**。
 * 全屏要开 raw mode、要进 alt-screen、要藏光标 —— 三者中任何一个忘了关,
 * 用户退出后拿到的是一个坏终端(不回显 / 看不见光标 / 滚动条被吃掉),
 * 而 TUI 自己永远不会发现。所以:
 *  ① enter()/dispose() 严格配对,dispose 幂等;
 *  ② 用 withFullScreen() 包住整个会话,任何抛出/正常结束都走 finally;
 *  ③ 额外挂 SIGINT/SIGTERM/exit 兜底:进程被外部打死时也必须还原;
 *  ④ 恢复动作按"进入前实测到的状态"回写,不无条件盲发转义
 *     (例如 setRawMode 只在我们真的开过之后才关 —— 对非 TTY 发它是抛错)。
 */

import { EventEmitter } from 'node:events'
import type { Size } from './geometry.js'
import { enterSequence, leaveSequence, moveTo, SHOW_CURSOR } from './render.js'

export interface TerminalIo {
  stdin: NodeJS.ReadStream & { setRawMode?: (mode: boolean) => void; isTTY?: boolean; resume?: () => void; pause?: () => void }
  stdout: NodeJS.WriteStream
}

export interface FullScreenTerminal extends EventEmitter {
  /** 进入全屏:开 raw mode + 进 alt-screen。非 TTY 直接抛,不静默降级。 */
  enter(): void
  /** 退出并还原终端。可重复调用。 */
  dispose(): void
  /** 已经还原过?(测试与兜底 handler 用它判"是否还要补发还原序列") */
  disposed(): boolean
  write(text: string): void
  size(): Size
  setCursor(row: number, col: number): void
  /** 一帧里所有写出合并成一次 write,避免交错。 */
  paint(payload: string): void
}

/** 收 SIGINT/SIGTERM 用的信号名(Node 类型里是联合,这里只挂我们能处理的那两个)。 */
const SIGNALS = ['SIGINT', 'SIGTERM'] as const

export function createFullScreenTerminal(io: TerminalIo): FullScreenTerminal {
  const bus = new EventEmitter() as FullScreenTerminal & EventEmitter
  let entered = false
  let cleanupArmed = false
  /** 我们自己挂上的信号 handler —— dispose 必须逐个摘掉它,**只摘自己这一个**(见 dispose 处注释)。 */
  const ownSignalHandlers = new Map<NodeJS.Signals, NodeJS.SignalsListener>()

  const onData = (chunk: Buffer | string): void => {
    bus.emit('input', typeof chunk === 'string' ? chunk : chunk.toString('utf8'))
  }
  const onResize = (): void => {
    bus.emit('resize', { cols: io.stdout.columns ?? 80, rows: io.stdout.rows ?? 24 })
  }
  const onExit = (): void => {
    // process.exit / 未捕获异常路径:终端状态必须还原,否则用户的 shell 就废了。
    dispose()
  }

  function dispose(): void {
    if (!entered) return
    entered = false
    if (typeof io.stdin.setRawMode === 'function') {
      try {
        io.stdin.setRawMode(false)
      } catch {
        /* 已断开就没什么可还原的 */
      }
    }
    io.stdin.removeListener('data', onData)
    io.stdout.removeListener('resize', onResize)
    io.stdin.pause?.()
    // 只摘自己那一个:`process.on` 是**追加**,我们从未移除过宿主的同名 handler,
    // 所以"再把它保存的那份装回去"等于把别人注册两次(实测 dispose 后监听数翻倍)——
    // 宿主(cli 启动链上的 crash-handler / updater 等)因此会跑两遍退出逻辑。
    // 需要"独占信号"时才可先 removeAllListeners 再恢复快照,那才是这套保存/装回的意义。
    for (const [sig, ours] of ownSignalHandlers) {
      process.removeListener(sig, ours)
    }
    ownSignalHandlers.clear()
    if (cleanupArmed) {
      process.removeListener('exit', onExit)
      cleanupArmed = false
    }
    // 无条件配对发出 leave 序列:hide↔show、alt↔main 都是成对开关。
    io.stdout.write(SHOW_CURSOR)
    io.stdout.write(leaveSequence())
  }

  function enter(): void {
    if (entered) return
    if (!io.stdout.isTTY) throw new Error('stdout 不是 TTY,拒绝进入全屏(应由能力判定挡住,不该走到这里)')
    if (typeof io.stdin.setRawMode !== 'function') throw new Error('stdin 无 setRawMode,无法接管按键')
    entered = true
    for (const sig of SIGNALS) {
      const ours: NodeJS.SignalsListener = () => {
        dispose()
        // 还原终端后重发同一信号,让宿主的既有语义(退出码、日志刷盘)照旧发生。
        process.kill(process.pid, sig)
      }
      ownSignalHandlers.set(sig, ours)
      process.on(sig, ours)
    }
    process.on('exit', onExit)
    cleanupArmed = true
    io.stdin.setRawMode(true)
    io.stdin.resume?.()
    io.stdin.on('data', onData)
    io.stdout.on('resize', onResize)
    io.stdout.write(enterSequence())
  }

  bus.enter = enter
  bus.dispose = dispose
  bus.disposed = () => !entered
  bus.write = (text: string) => io.stdout.write(text)
  bus.paint = (payload: string) => {
    if (payload !== '') io.stdout.write(payload)
  }
  bus.size = () => ({ cols: io.stdout.columns ?? 80, rows: io.stdout.rows ?? 24 })
  bus.setCursor = (row: number, col: number) => io.stdout.write(moveTo(row, col))

  return bus
}

/**
 * 把 `Size` 的兜底 80x24 留给调用方判断:取不到列宽时**不得**默默按 80 画,
 * 而是回落到能力判定的 undetermined。这里只在"已经判过 supported"之后兜 NaN。
 */
export function safeSize(io: TerminalIo): Size | null {
  const { columns, rows } = io.stdout
  if (typeof columns !== 'number' || typeof rows !== 'number') return null
  return { cols: columns, rows }
}

/**
 * 会话包装器:进全屏 → 跑 body → 无论怎么结束都还原。
 * body 抛错时把错误原样抛出(不吞),但终端先还原 —— 顺序反了就是脏终端 + 看不见堆栈。
 */
export async function withFullScreen<T>(io: TerminalIo, body: (term: FullScreenTerminal) => Promise<T>): Promise<T> {
  const term = createFullScreenTerminal(io)
  term.enter()
  try {
    return await body(term)
  } finally {
    term.dispose()
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
