// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全屏 TUI —— 终端生命周期单测(退出路径 / 不留脏状态)。
 *
 * 这一组断言用的是**假 io**:真终端里"退出来之后光标还在不在、回显还有没有"
 * 只能人眼验收,而恰恰这一格坏掉最伤人(用户的 shell 被留在 raw mode 里)。
 * 所以把"发了哪些字节、setRawMode 被调了几次、别人的信号 handler 有没有被我们吃掉"
 * 全部做成可断言的记账。
 */
import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'

import { createFullScreenTerminal, safeSize, withFullScreen } from '../src/tui/fullscreen/terminal.js'
import { runFullScreenSession, type ConversationHost } from '../src/tui/fullscreen/app.js'
import type { AgentEvent } from '../src/server/agent-core.js'
import { ENTER_ALT_SCREEN, LEAVE_ALT_SCREEN, SHOW_CURSOR } from '../src/tui/fullscreen/render.js'

interface FakeIo {
  stdin: NodeJS.ReadStream & { setRawMode?: (m: boolean) => void }
  stdout: NodeJS.WriteStream
  written: string[]
  rawCalls: boolean[]
}

function makeFakeIo(over: { tty?: boolean; hasSetRawMode?: boolean } = {}): FakeIo {
  const stdinBus = new EventEmitter()
  const stdoutBus = new EventEmitter()
  const written: string[] = []
  const rawCalls: boolean[] = []
  const stdin = {
    isTTY: over.tty ?? true,
    setRawMode: (over.hasSetRawMode ?? true)
      ? (m: boolean): void => {
          rawCalls.push(m)
        }
      : undefined,
    resume: () => {},
    pause: () => {},
    on: stdinBus.on.bind(stdinBus),
    removeListener: stdinBus.removeListener.bind(stdinBus),
    listenerCount: stdinBus.listenerCount.bind(stdinBus),
    emit: stdinBus.emit.bind(stdinBus),
  } as unknown as NodeJS.ReadStream & { setRawMode?: (m: boolean) => void }
  const stdout = {
    isTTY: over.tty ?? true,
    columns: 100,
    rows: 30,
    write: (s: string): boolean => {
      written.push(String(s))
      return true
    },
    on: stdoutBus.on.bind(stdoutBus),
    removeListener: stdoutBus.removeListener.bind(stdoutBus),
    // resize 事件由**终端**发出,所以夹具必须能往外发 —— 缺 emit 时"尺寸变小要退出"那条
    // 用例是拿 io.stdout.emit 直接抛 TypeError 收尾的(测的是夹具,不是产品)。
    emit: stdoutBus.emit.bind(stdoutBus),
    listenerCount: stdoutBus.listenerCount.bind(stdoutBus),
  } as unknown as NodeJS.WriteStream
  return { stdin, stdout, written, rawCalls }
}

const all = (io: FakeIo): string => io.written.join('')

describe('enter / dispose —— 终端状态成对开关', () => {
  it('enter 发 alt-screen 与藏光标,dispose 反向配对(光标显示 + 离开 alt-screen)', () => {
    const io = makeFakeIo()
    const term = createFullScreenTerminal(io)
    term.enter()
    expect(all(io)).toContain(ENTER_ALT_SCREEN)
    expect(all(io)).toContain('\x1b[?25l')
    term.dispose()
    expect(all(io)).toContain(SHOW_CURSOR)
    expect(all(io)).toContain(LEAVE_ALT_SCREEN)
  })

  it('raw mode 开一次关一次,不遗漏', () => {
    const io = makeFakeIo()
    const term = createFullScreenTerminal(io)
    term.enter()
    expect(io.rawCalls).toEqual([true])
    term.dispose()
    expect(io.rawCalls).toEqual([true, false])
  })

  it('dispose 幂等:重复调用不再发第二组还原序列,也不重复关 raw mode', () => {
    const io = makeFakeIo()
    const term = createFullScreenTerminal(io)
    term.enter()
    term.dispose()
    const after = all(io).length
    term.dispose()
    term.dispose()
    expect(all(io).length).toBe(after)
    expect(io.rawCalls).toEqual([true, false])
    expect(term.disposed()).toBe(true)
  })

  it('未 enter 就 dispose 什么都不发(不给非全屏场景凭空写转义)', () => {
    const io = makeFakeIo()
    const term = createFullScreenTerminal(io)
    term.dispose()
    expect(io.written).toEqual([])
    expect(io.rawCalls).toEqual([])
  })

  it('非 TTY / 无 setRawMode 时 enter 抛错且不留半个状态', () => {
    const notTty = makeFakeIo({ tty: false })
    expect(() => createFullScreenTerminal(notTty).enter()).toThrow(/TTY/)
    expect(notTty.written).toEqual([])
    const noRaw = makeFakeIo({ hasSetRawMode: false })
    expect(() => createFullScreenTerminal(noRaw).enter()).toThrow(/setRawMode/)
    expect(noRaw.written).toEqual([])
  })

  it('别人的 SIGINT handler 必须原样装回,不得被我们吃掉', () => {
    let fired = 0
    const foreign = (): void => {
      fired += 1
    }
    process.on('SIGINT', foreign)
    try {
      const before = process.listeners('SIGINT').length
      const io = makeFakeIo()
      const term = createFullScreenTerminal(io)
      term.enter()
      expect(process.listeners('SIGINT').length).toBe(before + 1)
      term.dispose()
      // 摘掉自己的、装回别人的:数量与身份都要复原
      expect(process.listeners('SIGINT').length).toBe(before)
      expect(process.listeners('SIGINT')).toContain(foreign)
      // 装回的 handler 真能触发(不是"列表里有名字"就算复原)
      process.emit('SIGINT', 'SIGINT')
      expect(fired).toBe(1)
    } finally {
      process.removeListener('SIGINT', foreign)
    }
  })

  it('stdin 的 data 监听在 dispose 后被摘掉(留着就会把按键继续喂给已退出的会话)', () => {
    const io = makeFakeIo()
    const term = createFullScreenTerminal(io)
    term.enter()
    const listenerCount = (): number => io.stdin.listenerCount('data')
    expect(listenerCount()).toBe(1)
    term.dispose()
    expect(listenerCount()).toBe(0)
  })
})

describe('withFullScreen —— 任何出口都还原', () => {
  it('body 正常返回后终端已还原', async () => {
    const io = makeFakeIo()
    const r = await withFullScreen(io, async (term) => {
      term.write('hello')
      return 'ok'
    })
    expect(r).toBe('ok')
    expect(all(io)).toContain(LEAVE_ALT_SCREEN)
    expect(io.rawCalls).toEqual([true, false])
  })

  it('body 抛错也还原,且错误原样抛出(吞了异常就等于把故障藏进 alt-screen)', async () => {
    const io = makeFakeIo()
    await expect(
      withFullScreen(io, async () => {
        throw new Error('body blew up')
      }),
    ).rejects.toThrow('body blew up')
    expect(all(io)).toContain(LEAVE_ALT_SCREEN)
    expect(io.rawCalls).toEqual([true, false])
  })
})

describe('paint 合并写出', () => {
  it('一帧一次 write;空 payload 不写(不写就不会闪,也不会给别的进程插队机会)', () => {
    const io = makeFakeIo()
    const term = createFullScreenTerminal(io)
    term.enter()
    io.written.length = 0
    term.paint('frame')
    expect(io.written).toEqual(['frame'])
    term.paint('')
    expect(io.written).toHaveLength(1)
    term.dispose()
  })
})

describe('safeSize', () => {
  it('取不到 columns/rows 时返回 null,不拿 80x24 兜一个假尺寸', () => {
    const io = makeFakeIo()
    expect(safeSize(io)).toEqual({ cols: 100, rows: 30 })
    const blind = makeFakeIo()
    ;(blind.stdout as unknown as { columns?: number }).columns = undefined
    expect(safeSize(blind)).toBeNull()
  })
})

/**
 * 端到端(仍然是假 io):按键 → 提交 → 宿主发事件 → 画面出现该事件的内容 → 退出并还原。
 * 这一条是"真做"的证据:前三组各测一层,只有这条能证明三层连起来跑得通。
 */
describe('runFullScreenSession —— 一次完整会话', () => {
  const usage = { promptTokens: 1, completionTokens: 2, totalTokens: 3, estimatedCostUsd: 0 }

  it('输入并回车后,转录出现在屏上;Esc 退出后终端还原', async () => {
    const io = makeFakeIo()
    const term = createFullScreenTerminal(io)
    let emit: ((e: AgentEvent) => void) | null = null
    const host: ConversationHost & { resolve?: () => void } = {
      send: async (_text, onEvent) => {
        emit = onEvent
        onEvent({ type: 'token', text: 'assistant says hi' })
        await new Promise<void>((r) => {
          host.resolve = r
        })
        onEvent({ type: 'done', stopReason: 'end_turn', iterations: 1, usage, sessionId: 'sid-abcdef123456' })
      },
      cancel: () => {
        host.resolve?.()
      },
      dispose: async () => {},
    }
    term.enter()
    const done = runFullScreenSession({
      term,
      host,
      header: { model: 'm', workspace: 'w', session: '', permissionMode: 'default' },
      size: { cols: 100, rows: 30 },
      color: false,
    })

    // 键入一句并提交:必须先看到正文进了帧,再看到退出还原
    io.stdin.emit('data', 'hello there')
    io.stdin.emit('data', '\r')
    await new Promise((r) => setImmediate(r))
    io.stdin.emit('data', '\x1b')
    const reason = await done
    expect(reason).toBe('quit')
    const painted = io.written.join('')
    expect(painted).toContain('hello there')
    expect(painted).toContain('assistant says hi')
    expect(painted).toContain(LEAVE_ALT_SCREEN)
    expect(io.rawCalls).toEqual([true, false])

    // 退出之后迟到的事件**不得**再往 stdout 写任何东西:还原序列已经发出去了,
    // 再写一次就是把用户的 shell 画花(而且没有任何界面会显示它)。
    const afterQuit = io.written.length
    emit?.({ type: 'token', text: 'late token after quit' })
    await new Promise((r) => setImmediate(r))
    expect(io.written.length).toBe(afterQuit)
    expect(io.written.join('')).not.toContain('late token after quit')
  })

  it('Ctrl+C 在运行中是"取消本轮"而不是退出;空闲时才是退出', async () => {
    const io = makeFakeIo()
    const term = createFullScreenTerminal(io)
    let cancelled = 0
    let release: (() => void) | null = null
    const host: ConversationHost = {
      send: async (_text, onEvent) => {
        onEvent({ type: 'token', text: 'working' })
        await new Promise<void>((r) => {
          release = r
        })
      },
      cancel: () => {
        cancelled += 1
        release?.()
      },
      dispose: async () => {},
    }
    term.enter()
    const done = runFullScreenSession({
      term,
      host,
      header: { model: 'm', workspace: 'w', session: '', permissionMode: 'default' },
      size: { cols: 100, rows: 30 },
      color: false,
    })
    io.stdin.emit('data', 'go\r')
    await new Promise((r) => setImmediate(r))
    io.stdin.emit('data', '\x03') // 运行中 → 取消
    await new Promise((r) => setImmediate(r))
    expect(cancelled).toBe(1)
    const afterCancel = io.written.join('')
    expect(afterCancel).toContain('cancel')
    io.stdin.emit('data', '\x03') // 已空闲 → 退出
    expect(await done).toBe('quit')
  })

  it('被拖到撑不起布局的尺寸时主动退出并报原因,不留在"冻结的旧屏 + 不响的界面"', async () => {
    const io = makeFakeIo()
    const term = createFullScreenTerminal(io)
    const host: ConversationHost = {
      send: async () => {},
      cancel: () => {},
      dispose: async () => {},
    }
    term.enter()
    const done = runFullScreenSession({
      term,
      host,
      header: { model: 'm', workspace: 'w', session: '', permissionMode: 'default' },
      size: { cols: 100, rows: 30 },
      color: false,
    })
    io.stdout.emit('resize')
    io.written.length = 0
    // 终端报一个 3 行的尺寸
    ;(io.stdout as unknown as { rows: number }).rows = 3
    term.emit('resize', { cols: 100, rows: 3 })
    const reason = await done
    expect(reason).toContain('too small')
    expect(io.written.join('')).toContain(LEAVE_ALT_SCREEN)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
