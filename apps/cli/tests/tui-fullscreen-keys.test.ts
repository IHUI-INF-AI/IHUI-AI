// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全屏 TUI —— 键位、输入缓冲、能力三态、ANSI 帧、事件折单测。
 *
 * 这四件各有"必须可断言"的理由:
 *  · 键位:转义序列若被当成字符塞进输入框,用户按一次方向键输入里就多 "[A"(经典终端事故形态);
 *  · 提示行与解码表必须同源 —— 屏幕上写着"Esc quit"而 Esc 其实不退出,比不写更坏;
 *  · 能力三态:判不出必须写"未判定",不得记通过(把没判写成判过了是本仓最高频失效型);
 *  · 折事件:不得改入参,否则流式重绘会把同一段话画两遍。
 */
import { describe, expect, it } from 'vitest'

import { decodeInput } from '../src/tui/fullscreen/keymap.js'
import {
  KEY_HINTS,
  createInputBuffer,
  inputText,
  reduceInput,
  type InputBuffer,
  type KeyAction,
} from '../src/tui/fullscreen/actions.js'
import {
  DEFAULT_FULL_SCREEN,
  decideFullscreenCapability,
  parseForced,
  termLooksCapable,
  type TerminalEnvSlice,
  type TerminalTtySlice,
} from '../src/tui/fullscreen/capability.js'
import { diffFrames, frameToAnsi, lineToAnsi, enterSequence, leaveSequence } from '../src/tui/fullscreen/render.js'
import { plainLine, type FrameLine } from '../src/tui/fullscreen/geometry.js'
import { createTranscript, foldEvent, seedFromHistory, blocksToLines } from '../src/tui/fullscreen/transcript.js'
import type { AgentEvent } from '../src/server/agent-core.js'
import { createLocalHost, type CoreLike } from '../src/commands/tui.js'

const TTY: TerminalTtySlice = { stdinTty: true, stdoutTty: true, columns: 100, rows: 30 }
const ENV: TerminalEnvSlice = { term: 'xterm-256color', noColor: undefined, forced: undefined }

const types = (actions: KeyAction[]): string[] => actions.map((a) => a.type)

describe('decodeInput —— 转义序列不得漏成字符', () => {
  it('方向键 / PgUp / Home 解成语义动作,输入框里不会多出 "[A"', () => {
    expect(types(decodeInput('\x1b[A', { running: false }))).toEqual(['historyUp'])
    expect(types(decodeInput('\x1b[B', { running: false }))).toEqual(['historyDown'])
    expect(types(decodeInput('\x1b[5~', { running: false }))).toEqual(['scrollPage'])
    expect(types(decodeInput('\x1b[6~', { running: false }))).toEqual(['scrollPage'])
    expect(types(decodeInput('\x1b[3~', { running: false }))).toEqual(['deleteForward'])
    expect(types(decodeInput('\x1b[H', { running: false }))).toEqual(['moveCursor'])
  })

  it('PgUp 与 PgDn 的方向不同(同一个动作两个方向算反,就是按 PgUp 往下跳)', () => {
    const up = decodeInput('\x1b[5~', { running: false })[0]
    const down = decodeInput('\x1b[6~', { running: false })[0]
    expect(up && up.type === 'scrollPage' ? up.dir : null).toBe(-1)
    expect(down && down.type === 'scrollPage' ? down.dir : null).toBe(1)
  })

  it('一个 chunk 里的多次按键全部解出(粘贴 / 终端成串发来)', () => {
    expect(types(decodeInput('ab\r', { running: false }))).toEqual(['insert', 'insert', 'submit'])
    expect(types(decodeInput('\x1b[A\x1b[B', { running: false }))).toEqual(['historyUp', 'historyDown'])
  })

  it('Ctrl+C 在运行中与空闲时分叉(取消本轮 vs 退出),这条不能是常量', () => {
    const running = decodeInput('\x03', { running: true })[0]
    const idle = decodeInput('\x03', { running: false })[0]
    expect(running && running.type === 'cancelOrQuit' ? running.running : null).toBe(true)
    expect(idle && idle.type === 'cancelOrQuit' ? idle.running : null).toBe(false)
  })

  it('孤立 ESC = 退出;但 ESC 打头的序列不会被误判成退出', () => {
    expect(types(decodeInput('\x1b', { running: false }))).toEqual(['quit'])
    expect(types(decodeInput('\x1b[C', { running: false }))).toEqual(['moveCursor'])
  })

  it('代理对(emoji)整体插入,不劈成两个坏码位', () => {
    const acts = decodeInput('🙂', { running: false })
    expect(acts).toHaveLength(1)
    expect(acts[0]?.type === 'insert' ? acts[0].text : null).toBe('🙂')
  })

  it('未绑定的键归 unbound,不进输入框也不被静默丢弃(静默 = 用户以为按了没反应)', () => {
    expect(types(decodeInput('\t', { running: false }))).toEqual(['unbound'])
    expect(types(decodeInput('\x1b[Z', { running: false }))).toEqual(['unbound'])
    expect(types(decodeInput('\x07', { running: false }))).toEqual(['unbound'])
  })

  it('畸形/残缺的 CSI 整段吞掉,不把残字符吐进输入', () => {
    expect(types(decodeInput('\x1b[', { running: false }))).toEqual(['unbound'])
    expect(types(decodeInput('\x1bx', { running: false }))).toEqual(['unbound'])
  })
})

describe('KEY_HINTS 与解码表同源', () => {
  /** 提示里点名的组合键,必须真能被解码成语义动作 —— 否则提示在撒谎。 */
  const HINT_PROBES: Record<string, string> = {
    Enter: '\r',
    'Ctrl+E': '\x05',
    'Ctrl+R': '\x12',
    'Ctrl+L': '\x0c',
    'Ctrl+C': '\x03',
    Esc: '\x1b',
    '↑/↓': '\x1b[A',
    PgUp: '\x1b[5~',
  }

  it.each(Object.keys(HINT_PROBES))('提示中的 %s 确实被绑定', (label) => {
    const acts = decodeInput(HINT_PROBES[label] ?? '', { running: false })
    expect(acts.length).toBeGreaterThan(0)
    expect(acts.some((a) => a.type !== 'unbound')).toBe(true)
  })

  it('提示表非空,且每条都有键名与说明(缺一边就是写了没人看)', () => {
    expect(KEY_HINTS.length).toBeGreaterThan(0)
    for (const h of KEY_HINTS) {
      expect(h.keys.trim()).not.toBe('')
      expect(h.what.trim()).not.toBe('')
    }
  })
})

describe('reduceInput —— 输入缓冲', () => {
  const withText = (s: string): InputBuffer => {
    let buf = createInputBuffer()
    for (const ch of s) buf = reduceInput(buf, { type: 'insert', text: ch })
    return buf
  }

  it('不修改入参:同一动作打两遍在同一个缓冲上结果必须一致', () => {
    const base = withText('abc')
    const before = JSON.stringify(base)
    const once = reduceInput(base, { type: 'insert', text: 'd' })
    const twice = reduceInput(base, { type: 'insert', text: 'd' })
    expect(JSON.stringify(base)).toBe(before)
    expect(inputText(once)).toBe('abcd')
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once))
  })

  it('光标在中途插入 / 退格 / 删词都在 caret 处发生,不动尾部', () => {
    let buf = withText('hello world')
    buf = reduceInput(buf, { type: 'moveCursor', dir: 0 })
    buf = reduceInput(buf, { type: 'insert', text: 'X' })
    expect(inputText(buf)).toBe('Xhello world')
    buf = reduceInput(buf, { type: 'moveCursor', dir: 2 })
    buf = reduceInput(buf, { type: 'deleteWordBack' })
    expect(inputText(buf)).toBe('Xhello ')
    buf = reduceInput(buf, { type: 'deleteBackward' })
    expect(inputText(buf)).toBe('Xhello')
  })

  it('空草稿的退格 / 删词 / 提交都不产生动作,也不往历史里塞空串', () => {
    const empty = createInputBuffer()
    expect(reduceInput(empty, { type: 'deleteBackward' })).toEqual(empty)
    expect(reduceInput(empty, { type: 'deleteWordBack' })).toEqual(empty)
    const after = reduceInput(empty, { type: 'submit' })
    expect(after.history).toEqual([])
    expect(inputText(after)).toBe('')
  })

  it('提交清空草稿并入历史;↑ 取回上一条,↓ 回到底部还原原草稿,再 ↓ 不动(readline 语义)', () => {
    // 历史住在**同一个** InputBuffer 里(actions.ts 的 history/historyIndex 是缓冲的字段),
    // 所以提交与后续回查必须串在同一条链上 —— 用两个缓冲各演一半,测的是"另一个空历史
    // 缓冲按 ↑ 什么也没有",不是本用例想钉的那件事。
    let buf = withText('first')
    buf = reduceInput(buf, { type: 'submit' })
    expect(inputText(buf)).toBe('')
    buf = reduceInput(buf, { type: 'insert', text: 'draft' })
    expect(inputText(buf)).toBe('draft')
    buf = reduceInput(buf, { type: 'historyUp' })
    expect(inputText(buf)).toBe('first')
    buf = reduceInput(buf, { type: 'historyDown' })
    expect(inputText(buf)).toBe('draft')
    // 已经在最底部再按 ↓:不得把刚还原的草稿清掉(清空型 no-op 会让人以为按错键丢了半句话)。
    // 空草稿时同一位置会落回 '' —— 那一型由下一条 clamp 用例钉着。
    buf = reduceInput(buf, { type: 'historyDown' })
    expect(inputText(buf)).toBe('draft')
  })

  it('↑/↓ 在历史两端被 clamp,不会越界读到 undefined', () => {
    let buf = withText('a')
    buf = reduceInput(buf, { type: 'submit' })
    buf = reduceInput(buf, { type: 'historyUp' })
    buf = reduceInput(buf, { type: 'historyUp' })
    expect(inputText(buf)).toBe('a')
    buf = reduceInput(buf, { type: 'historyDown' })
    buf = reduceInput(buf, { type: 'historyDown' })
    buf = reduceInput(buf, { type: 'historyDown' })
    expect(inputText(buf)).toBe('')
  })
})

describe('能力判定 —— 三态不并桶', () => {
  it('supported 只在真 TTY + 有尺寸 + TERM 认得时给出', () => {
    const v = decideFullscreenCapability(ENV, TTY)
    expect(v.kind).toBe('supported')
    expect(v.kind === 'supported' ? v.size : null).toEqual({ cols: 100, rows: 30 })
  })

  it('NO_COLOR 只关掉颜色,不让全屏变不可用(两件事不得混判)', () => {
    const v = decideFullscreenCapability({ ...ENV, noColor: '1' }, TTY)
    expect(v.kind).toBe('supported')
    expect(v.kind === 'supported' ? v.color : null).toBe(false)
  })

  it('IHUI_TUI=0 优先于一切:即便终端完全够用也判不可用', () => {
    const v = decideFullscreenCapability({ ...ENV, forced: '0' }, TTY)
    expect(v.kind).toBe('unsupported')
    expect(v.kind === 'unsupported' ? v.reason : '').toContain('IHUI_TUI')
  })

  it('非 TTY(管道 / CI / 重定向)判不可用,而不是"降级硬画"', () => {
    expect(decideFullscreenCapability(ENV, { ...TTY, stdoutTty: false }).kind).toBe('unsupported')
    expect(decideFullscreenCapability(ENV, { ...TTY, stdinTty: false }).kind).toBe('unsupported')
  })

  it('拿不到尺寸 = 未判定(不得用 80x24 猜一个,也不得算通过)', () => {
    const v = decideFullscreenCapability(ENV, { stdinTty: true, stdoutTty: true, columns: undefined, rows: undefined })
    expect(v.kind).toBe('undetermined')
    expect(v.kind === 'undetermined' ? v.reason : '').toContain('尺寸')
  })

  it('TERM=dumb / 未设 TERM 判不可用', () => {
    expect(termLooksCapable('dumb')).toBe(false)
    expect(termLooksCapable(undefined)).toBe(false)
    expect(termLooksCapable('xterm-256color')).toBe(true)
    expect(termLooksCapable('screen')).toBe(true)
    expect(decideFullscreenCapability({ ...ENV, term: 'dumb' }, TTY).kind).toBe('unsupported')
  })

  it('parseForced 只认明确写法,乱值按未设(不猜方向)', () => {
    expect(parseForced(undefined)).toBe('unset')
    expect(parseForced('1')).toBe('on')
    expect(parseForced('off')).toBe('off')
    expect(parseForced('maybe')).toBe('unset')
    expect(parseForced('')).toBe('unset')
  })

  it('默认档必须是"行模式" —— 这个值被写进交付说明,不得被顺手改掉', () => {
    expect(DEFAULT_FULL_SCREEN).toBe(false)
  })
})

describe('ANSI 帧与行差量', () => {
  const line: FrameLine = { segs: [{ text: 'hi', tone: 'accent' }, { text: '!', tone: 'bad' }] }

  it('color=false 时产出纯文本(管道 / NO_COLOR 场景不得带 SGR)', () => {
    expect(lineToAnsi(line, false)).toBe('hi!')
    expect(lineToAnsi(line, false)).not.toContain('\x1b')
  })

  it('color=true 时带 SGR 且收尾复位(不闭合会把后续所有输出染色)', () => {
    const s = lineToAnsi(line, true)
    expect(s).toContain('\x1b[36m')
    expect(s).toContain('\x1b[31m')
    expect(s.endsWith('\x1b[0m')).toBe(true)
  })

  it('差量:只有变化的行被重写;完全相同则一个字节都不写(不写就不会闪)', () => {
    const a = frameToAnsi([plainLine('one'), plainLine('two')], false)
    expect(diffFrames(a, a)).toBe('')
    const b = frameToAnsi([plainLine('one'), plainLine('TWO')], false)
    const payload = diffFrames(a, b)
    expect(payload).toContain('TWO')
    expect(payload).not.toContain('one')
    expect(payload.split('\x1b[2K')).toHaveLength(2) // 一次清行 = 一行被重写
  })

  it('首帧(prev=null)整屏写', () => {
    const a = frameToAnsi([plainLine('x'), plainLine('y')], false)
    const payload = diffFrames(null, a)
    expect(payload.split('\x1b[2K')).toHaveLength(3) // 两行各一次清 + 末尾空段
  })

  it('enter / leave 序列成对:alt-screen 与光标开关各自一进一出', () => {
    const enter = enterSequence()
    const leave = leaveSequence()
    expect(enter).toContain('\x1b[?1049h')
    expect(enter).toContain('\x1b[?25l')
    expect(leave).toContain('\x1b[?25h')
    expect(leave).toContain('\x1b[?1049l')
  })
})

describe('foldEvent —— 事件折成转录', () => {
  const ev = (e: AgentEvent): AgentEvent => e

  it('不修改入参的 blocks(流式重绘每 token 折一次,就地改会把内容翻倍增)', () => {
    let tr = createTranscript()
    tr = foldEvent(tr, ev({ type: 'token', text: 'a' }))
    const snapshotBlocks = tr.blocks.slice()
    const snapshotJson = JSON.stringify(tr)
    foldEvent(tr, ev({ type: 'token', text: 'b' }))
    expect(JSON.stringify(tr)).toBe(snapshotJson)
    expect(tr.blocks).toEqual(snapshotBlocks)
  })

  it('连续 token 落进同一条 assistant,轮次结束后再来 token 才另起一条', () => {
    let tr = createTranscript()
    tr = foldEvent(tr, ev({ type: 'token', text: 'Hel' }))
    tr = foldEvent(tr, ev({ type: 'token', text: 'lo' }))
    expect(tr.blocks).toHaveLength(1)
    expect(blocksToLines(tr, { verbose: false })[0]).toBeDefined()
    tr = foldEvent(tr, ev({ type: 'done', stopReason: 'end_turn', iterations: 1, usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, estimatedCostUsd: 0 }, sessionId: 's1' }))
    tr = foldEvent(tr, ev({ type: 'token', text: 'again' }))
    const assistants = tr.blocks.filter((b) => b.kind === 'assistant')
    expect(assistants).toHaveLength(2)
  })

  it('工具按"同名最近一次 running"收口;找不到就留一条 unmatched 交代而不是静默', () => {
    let tr = createTranscript()
    tr = foldEvent(tr, ev({ type: 'tool_call', name: 'read_file', args: { path: 'a.ts' } }))
    tr = foldEvent(tr, ev({ type: 'tool_result', name: 'read_file', success: true, output: 'ok\nsecond line' }))
    const tool = tr.blocks.find((b) => b.kind === 'tool')
    expect(tool && tool.kind === 'tool' ? tool.state : null).toBe('ok')
    tr = foldEvent(tr, ev({ type: 'tool_result', name: 'ghost_tool', success: false, output: '' }))
    const notices = tr.blocks.filter((b) => b.kind === 'notice')
    expect(notices).toHaveLength(1)
    expect(notices[0] && notices[0].kind === 'notice' ? notices[0].text : '').toContain('ghost_tool')
  })

  it('tool_delta 只贴在 running 的那条上,clear 之后预览被撤下(留残影就是假 diff)', () => {
    let tr = createTranscript()
    tr = foldEvent(tr, ev({ type: 'tool_call', name: 'edit_file', args: {} }))
    tr = foldEvent(tr, ev({ type: 'tool_delta', name: 'edit_file', toolCallId: 't1', seq: 1, partialText: '@@ -1 +1 @@' }))
    const withPreview = tr.blocks.find((b) => b.kind === 'tool')
    expect(withPreview && withPreview.kind === 'tool' ? withPreview.preview : '').toContain('@@')
    tr = foldEvent(tr, ev({ type: 'tool_delta_clear', name: 'edit_file', toolCallId: 't1' }))
    const cleared = tr.blocks.find((b) => b.kind === 'tool')
    expect(cleared && cleared.kind === 'tool' ? cleared.preview : 'x').toBe('')
  })

  it('未知事件形态留 notice —— core 将来扩枚举而这里没跟时,必须看得见而不是静默吞', () => {
    const tr = foldEvent(createTranscript(), { type: 'brand_new_event' } as unknown as AgentEvent)
    const notice = tr.blocks.find((b) => b.kind === 'notice')
    expect(notice).toBeDefined()
    expect(notice && notice.kind === 'notice' ? notice.text : '').toContain('brand_new_event')
  })

  it('seedFromHistory 把已存会话只读投影进来,且不改传入的 Transcript', () => {
    const base = createTranscript()
    const seeded = seedFromHistory(base, [
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a' },
      { role: 'system', content: 'ignored' },
    ])
    expect(seeded.blocks).toHaveLength(2)
    expect(base.blocks).toHaveLength(0)
  })
})

describe('createLocalHost —— 取消必须能打断在飞请求', () => {
  const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 }

  it('cancel() 让传给 core 的 signal 变 aborted', async () => {
    let seen: AbortSignal | null = null
    const core: CoreLike = {
      sendMessage: async (_t, _on, opts) => {
        seen = opts?.signal ?? null
        await new Promise<void>((r) => setTimeout(r, 5))
        return { sessionId: 's1', stopReason: 'end_turn', iterations: 1, usage }
      },
      cancel: () => {},
    }
    const host = createLocalHost(core)
    const outer = new AbortController()
    const p = host.send('hi', () => {}, outer.signal)
    await Promise.resolve()
    expect(seen).not.toBeNull()
    expect(seen?.aborted).toBe(false)
    host.cancel()
    expect(seen?.aborted).toBe(true)
    await p
  })

  it('外部 signal 已 abort 时,core 收到的 signal 立刻是 aborted(不留下"已经拦不住"的窗口)', async () => {
    let seen: AbortSignal | null = null
    const core: CoreLike = {
      sendMessage: async (_t, _on, opts) => {
        seen = opts?.signal ?? null
        return { sessionId: 's', stopReason: 'end_turn', iterations: 0, usage }
      },
      cancel: () => {},
    }
    const host = createLocalHost(core)
    const outer = new AbortController()
    outer.abort()
    await host.send('hi', () => {}, outer.signal)
    expect(seen?.aborted).toBe(true)
  })

  it('core 抛错时 send 把错误冒给会话层(不吞 = 画面会留一条 error 交代)', async () => {
    const core: CoreLike = {
      sendMessage: async () => {
        throw new Error('boom')
      },
      cancel: () => {},
    }
    const host = createLocalHost(core)
    await expect(host.send('hi', () => {}, new AbortController().signal)).rejects.toThrow('boom')
  })

  it('sessionId 在首轮之后被记住(否则每一轮都开一个新会话,历史就断了)', async () => {
    const seenIds: (string | undefined)[] = []
    const core: CoreLike = {
      sendMessage: async (_t, _on, opts) => {
        seenIds.push(opts?.sessionId)
        return { sessionId: 'real-id', stopReason: 'end_turn', iterations: 1, usage }
      },
      cancel: () => {},
    }
    const host = createLocalHost(core)
    await host.send('a', () => {}, new AbortController().signal)
    await host.send('b', () => {}, new AbortController().signal)
    expect(seenIds).toEqual([undefined, 'real-id'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
