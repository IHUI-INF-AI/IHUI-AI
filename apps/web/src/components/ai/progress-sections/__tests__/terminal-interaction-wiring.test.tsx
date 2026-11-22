// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D151(2026-09-29 立)终端「等待键盘输入」的 web 消费端装车证明。
//
// 本票诊断的那一型是「服务端会发帧、api-client 会解析、组件也写好了,唯独没人接线」
// (守门 64/70/81/115/138 反复记过的同一型),所以这里的用例分成三层,各证一件事:
//   ① store 切片:写入 / 合并 / 并列清空(新流开始时上一轮的"等待"不得挂到下一轮的卡上);
//   ② **接线**:send-message.ts 的 streamChat options 里 `onTerminalInteraction` 必须是
//      **代码行**(不是注释行),且其函数体真的调用 `setTerminalInteraction(`;
//      把那一行删掉或注释掉,本用例必红 —— 只测组件证不出"挂上了";
//   ③ 上行与失败态:点「发送」真的调 postTerminalInput,且第二个参数**逐字段**等于
//      { terminalId, text };reject 时界面进失败态、那一行留在框里(不静默吞掉)。
//
// 文案断言全部走**真词包**(packages/i18n/messages/{shared,web}/zh-CN.json 深合并,
// 与 apps/web/src/i18n/request.ts 同一口径)—— 用假 t() 就只能证明"组件念了个键",
// 证不出"那五个键真的在"。
// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'

/** 上行出口的唯一 mock(端内不得自拼 fetch,AGENTS §3) */
const { postTerminalInputMock } = vi.hoisted(() => ({ postTerminalInputMock: vi.fn() }))
vi.mock('@ihui/api-client', () => ({ postTerminalInput: postTerminalInputMock }))

// CopyButton 走 radix Tooltip(需 TooltipProvider 在场),与本次要证的等待态无关 → 剪掉
vi.mock('../copy-button', () => ({ CopyButton: () => null }))

vi.mock('next-intl', async () => {
  const { formatIcu } = await import('@ihui/i18n')
  const here = dirname(fileURLToPath(import.meta.url))
  // __tests__ → progress-sections → ai → components → src → web → apps → 仓库根(7 层)
  const root = resolve(here, '../../../../../../../')
  const readPack = (name: string): Record<string, unknown> =>
    JSON.parse(readFileSync(join(root, 'packages/i18n/messages', name), 'utf8')) as Record<
      string,
      unknown
    >
  const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v)
  /** 与 @ihui/i18n mergeMessages 同语义:web 端覆盖 shared */
  const merge = (base: Record<string, unknown>, over: Record<string, unknown>) => {
    const out: Record<string, unknown> = { ...base }
    for (const [k, v] of Object.entries(over)) {
      const b = out[k]
      out[k] = isRecord(b) && isRecord(v) ? merge(b, v) : v
    }
    return out
  }
  const pack = merge(readPack('shared/zh-CN.json'), readPack('web/zh-CN.json'))
  const lookup = (ns: string, key: string): unknown =>
    // next-intl 允许 ns 与 key **各**带点号(t('terminal.title') 在 ns='ai.pane' 下合法),
    // 所以两段都要按路径逐层走 —— 少一层就会把在跑的键念成 MISSING。
    [...ns.split('.'), ...key.split('.')].reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' && !Array.isArray(node)
          ? (node as Record<string, unknown>)[part]
          : undefined,
      pack,
    )
  return {
    useTranslations:
      (ns: string) =>
      (key: string, values?: Record<string, string | number>): string => {
        const raw = lookup(ns, key)
        // 缺键必须喊出来:静默回退成 key 会让"词包没这条"读起来像"组件没渲染"
        if (typeof raw !== 'string' || raw === '') return `MISSING:${ns}.${key}`
        return formatIcu(raw, values ?? {}, { locale: 'zh-CN' })
      },
    useLocale: () => 'zh-CN',
  }
})

import { TerminalSection } from '../terminal-section'
import { useChatStore } from '@/stores/chat'
import type { TerminalTask } from '@/hooks/use-agent-progress'

const SEND_MESSAGE_SRC = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../hooks/use-chat/send-message.ts',
)
const STORE_SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../stores/chat.ts')

/** 取"代码面"的行:剥掉**行注释与块注释**(字符串/模板串内的 // 不算注释)。
 *  刻意保留缩进:下面的对账靠缩进认"同级属性"。
 *
 *  为什么必须是状态机而不是"行首是 // 就丢":块注释的**内部行**不以 `*` 开头是常态
 *  (`/* onTerminalInteraction: (evt) => { ... *\/` 这种整块注释掉的接线,裸筛行首会
 *  把它当代码留下 ⇒ 反向对照跑出绿灯,而这条用例存在的全部理由就是让它红。
 *  本用例自己的第一版就是这样,由反向对照当场抓到(见交付报告)。 */
function codeLines(src: string): string[] {
  const out: string[] = []
  let inBlock = false
  for (const raw of src.split('\n')) {
    let line = ''
    let str: '' | '"' | "'" | '`' = ''
    for (let i = 0; i < raw.length; i += 1) {
      const c = raw[i]!
      const n = raw[i + 1] ?? ''
      if (inBlock) {
        if (c === '*' && n === '/') {
          inBlock = false
          i += 1
        }
        continue
      }
      if (str !== '') {
        line += c
        if (c === '\\') {
          line += n
          i += 1
        } else if (c === str) {
          str = ''
        }
        continue
      }
      if (c === '/' && n === '/') break
      if (c === '/' && n === '*') {
        inBlock = true
        i += 1
        continue
      }
      if (c === '"' || c === "'" || c === '`') str = c
      line += c
    }
    if (line.trim() !== '') out.push(line.trimEnd())
  }
  return out
}

/** 取 streamChat options 里某个属性的函数体(从属性行到下一个同级/更浅的同级属性行为止)。
 *  缩进按**命中行自身**算,不写死 4/8 —— 写死就等于把判据绑在一种排版上,
 *  一次 prettier 版本变化就能让"接线还在但用例红"(本仓 §22c 那一型)。 */
function optionBody(lines: string[], optionName: string): string[] {
  const startAt = lines.findIndex((l) => new RegExp(`^\\s+${optionName}:`).test(l))
  if (startAt === -1) return []
  const startIndent = /^\s*/.exec(lines[startAt]!)![0].length
  const body: string[] = []
  for (let i = startAt; i < lines.length; i += 1) {
    const line = lines[i]!
    const indent = /^\s*/.exec(line)![0].length
    if (i > startAt && indent <= startIndent && /^\s*[A-Za-z_$][\w$]*:/.test(line)) break
    body.push(line)
  }
  return body
}

function task(over: Partial<TerminalTask> & { id: string }): TerminalTask {
  return {
    command: 'npm init -y',
    status: 'running',
    startedAt: '2026-09-29T00:00:00.000Z',
    ...over,
  }
}

function seedInteraction(
  terminalId: string,
  opts?: { sessionId?: string; submitting?: boolean },
): void {
  useChatStore.getState().setTerminalInteraction(terminalId, {
    promptTail: 'Password:',
    waitingSinceMs: 1_800,
    maxInputChars: 8,
    submitting: opts?.submitting ?? false,
    failed: false,
    ...(opts?.sessionId ? { sessionId: opts.sessionId } : {}),
  })
}

const byTestId = (container: HTMLElement, id: string): HTMLElement | null =>
  container.querySelector<HTMLElement>(`[data-testid="${id}"]`)

describe('D151 ① store 切片:等待态写入与并列清空', () => {
  beforeEach(() => {
    useChatStore.setState({ terminalInteractions: {}, aiStreamSessionId: null })
  })

  it('setTerminalInteraction 按 terminalId 归键,patch 可逐字段合并', () => {
    seedInteraction('t-a', { sessionId: 'sess-9' })
    // 提交前只动 submitting,不得把帧带来的原文抹掉
    useChatStore.getState().setTerminalInteraction('t-a', { submitting: true })
    const rec = useChatStore.getState().terminalInteractions['t-a']
    expect(rec).toBeDefined()
    expect(rec?.promptTail).toBe('Password:')
    expect(rec?.maxInputChars).toBe(8)
    expect(rec?.sessionId).toBe('sess-9')
    expect(rec?.submitting).toBe(true)
    expect(rec?.failed).toBe(false)
  })

  it('clearTerminalInteraction 删除该键;terminalOutputs 被重置的两处同样重置等待态', () => {
    seedInteraction('t-b')
    useChatStore.getState().clearTerminalInteraction('t-b')
    expect(useChatStore.getState().terminalInteractions['t-b']).toBeUndefined()
    // 新流开始:clearMessages 里 terminalOutputs 与 terminalInteractions 必须并列清空
    seedInteraction('t-c')
    useChatStore.getState().appendTerminalOutput('t-c', 'partial out')
    useChatStore.getState().clearMessages()
    expect(useChatStore.getState().terminalOutputs).toEqual({})
    expect(useChatStore.getState().terminalInteractions).toEqual({})
    expect(useChatStore.getState().aiStreamSessionId).toBeNull()
  })

  it('等待态不进 partialize(promptTail 与键入都不落持久化)', () => {
    const storeLines = codeLines(readFileSync(STORE_SRC, 'utf8'))
    const startAt = storeLines.findIndex((l) => /^\s*partialize:/.test(l))
    expect(startAt).toBeGreaterThanOrEqual(0)
    const body: string[] = []
    for (let i = startAt + 1; i < storeLines.length; i += 1) {
      if (/^\s*\}\),/.test(storeLines[i]!)) break
      body.push(storeLines[i]!)
    }
    // partialize 是白名单:等待态与实时输出都不得出现在里面
    expect(body.some((l) => l.includes('terminalInteractions'))).toBe(false)
    expect(body.some((l) => l.includes('terminalOutputs'))).toBe(false)
  })
})

describe('D151 ② 接线:send-message.ts 真的把 onTerminalInteraction 接进 streamChat', () => {
  const src = readFileSync(SEND_MESSAGE_SRC, 'utf8')
  const lines = codeLines(src)

  it('代码面存在 onTerminalInteraction 属性行(删掉或注释成 // 即红)', () => {
    const hasOption = lines.some((l) => /^\s+onTerminalInteraction:/.test(l))
    expect(hasOption).toBe(true)
  })

  it('该回调体内真的调用 setTerminalInteraction(接线不是空壳)', () => {
    const body = optionBody(lines, 'onTerminalInteraction')
    expect(body.length).toBeGreaterThan(0)
    expect(body.some((l) => l.includes('setTerminalInteraction('))).toBe(true)
    // 键入相关的两维都必须来自帧本身,而非端内自造常量
    expect(body.some((l) => l.includes('evt.maxInputChars'))).toBe(true)
  })

  it('terminal_end 到来时清掉该 terminalId 的等待态(不受 messageId 早退支配)', () => {
    const body = optionBody(lines, 'onTerminalEnd')
    expect(body.length).toBeGreaterThan(0)
    const clearAt = body.findIndex((l) => l.includes('clearTerminalInteraction('))
    const guardAt = body.findIndex((l) => l.includes('if (!evt.messageId) return'))
    expect(clearAt).toBeGreaterThanOrEqual(0)
    // 清除必须排在早退**之前**(或根本没有早退):早退在前时,缺 messageId 的那一型流
    // 结构上看不见清除调用,等待态会永久挂在卡上。
    expect(guardAt === -1 || clearAt < guardAt).toBe(true)
  })

  it('上行寻址优先用帧自带的 sessionId(不靠端内观察猜)', () => {
    const body = optionBody(lines, 'onTerminalInteraction')
    expect(body.length).toBeGreaterThan(0)
    // 帧自带 sessionId 是 D151 的第二枚提交补上的:上行路径里有 {session_id},
    // 猜错会话的表现是"点了发送什么都没发生且不报错"。
    expect(body.some((l) => l.includes('evt.sessionId'))).toBe(true)
  })

  it('同源帧仍登记观察值作旧流兜底(不得把它当唯一地址)', () => {
    const noteLines = lines.filter((l) => l.includes('noteStreamSessionId('))
    expect(noteLines.length).toBeGreaterThanOrEqual(3)
  })
})

describe('D151 ③ 渲染与上行:等待输入行在同一张终端卡里,发送只走 api-client', () => {
  beforeEach(() => {
    postTerminalInputMock.mockReset()
    postTerminalInputMock.mockResolvedValue({ ok: true, accepted: true })
    useChatStore.setState({ terminalInteractions: {}, aiStreamSessionId: null })
  })

  afterEach(() => cleanup())

  it('喂一条等待态 ⇒ 渲染出真词包的「等待你的输入」与提示原文', () => {
    seedInteraction('t-wait', { sessionId: 'sess-9' })
    const { container } = render(<TerminalSection terminals={[task({ id: 't-wait' })]} />)
    expect(byTestId(container, 'terminal-interaction-t-wait')).not.toBeNull()
    const text = container.textContent ?? ''
    expect(text).toContain('等待你的输入')
    expect(text).toContain('命令提示：Password:')
    expect(text).not.toContain('MISSING:')
    const input = byTestId(container, 'terminal-interaction-input-t-wait')
    expect(input?.getAttribute('maxlength')).toBe('8')
  })

  it('点发送 ⇒ postTerminalInput(sessionId, { terminalId, text }) 第二参数逐字段相等,成功后清除等待态', async () => {
    seedInteraction('t-wait', { sessionId: 'sess-9' })
    const { container } = render(<TerminalSection terminals={[task({ id: 't-wait' })]} />)
    const input = byTestId(container, 'terminal-interaction-input-t-wait') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'y' } })
    fireEvent.click(byTestId(container, 'terminal-interaction-submit-t-wait') as HTMLElement)

    await waitFor(() => expect(postTerminalInputMock).toHaveBeenCalledTimes(1))
    const args = postTerminalInputMock.mock.calls[0] as unknown as [string, Record<string, string>]
    expect(args[0]).toBe('sess-9')
    // 逐字段等值(多一维少一维都算红):键入是密码候选,不许顺手回带别的东西
    expect(args[1]).toEqual({ terminalId: 't-wait', text: 'y' })
    await waitFor(() =>
      expect(useChatStore.getState().terminalInteractions['t-wait']).toBeUndefined(),
    )
  })

  it('HTTP 200 但 ack.ok=false ⇒ 同样进失败态(服务端对"没这条/不是你的"刻意同形回 200)', async () => {
    // 这一型是只看 resp.ok 的客户端**结构上看不见**的失败:不判 ack 就等于把
    // "命令一个字节都没收到"演成"已发送"。postTerminalInput 现在把 ack 交回调用方,正是为了这条。
    postTerminalInputMock.mockResolvedValueOnce({ ok: false })
    seedInteraction('t-wait', { sessionId: 'sess-9' })
    const { container } = render(<TerminalSection terminals={[task({ id: 't-wait' })]} />)
    const input = byTestId(container, 'terminal-interaction-input-t-wait') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'y' } })
    fireEvent.click(byTestId(container, 'terminal-interaction-submit-t-wait') as HTMLElement)

    await waitFor(() =>
      expect(byTestId(container, 'terminal-interaction-failed-t-wait')).not.toBeNull(),
    )
    expect(useChatStore.getState().terminalInteractions['t-wait']).toBeDefined()
  })

  it('上行失败 ⇒ 进入失败态而不是静默,那一行留在框里', async () => {
    postTerminalInputMock.mockRejectedValueOnce(new Error('postTerminalInput failed: HTTP 500'))
    seedInteraction('t-wait', { sessionId: 'sess-9' })
    const { container } = render(<TerminalSection terminals={[task({ id: 't-wait' })]} />)
    const input = byTestId(container, 'terminal-interaction-input-t-wait') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'hunter2' } })
    fireEvent.click(byTestId(container, 'terminal-interaction-submit-t-wait') as HTMLElement)

    await waitFor(() =>
      expect(byTestId(container, 'terminal-interaction-failed-t-wait')).not.toBeNull(),
    )
    expect(input.value).toBe('hunter2')
    // 失败态留在 store(提交中复位),但**失败原因**不含键入内容
    const rec = useChatStore.getState().terminalInteractions['t-wait']
    expect(rec?.failed).toBe(true)
    expect(rec?.submitting).toBe(false)
  })

  it('拿不到 sessionId ⇒ 不发请求、直接如实报失败(不把一行字 POST 到猜出来的地址)', () => {
    seedInteraction('t-wait', { sessionId: undefined })
    const { container } = render(<TerminalSection terminals={[task({ id: 't-wait' })]} />)
    const input = byTestId(container, 'terminal-interaction-input-t-wait') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'y' } })
    fireEvent.click(byTestId(container, 'terminal-interaction-submit-t-wait') as HTMLElement)
    expect(postTerminalInputMock).not.toHaveBeenCalled()
    expect(byTestId(container, 'terminal-interaction-failed-t-wait')).not.toBeNull()
  })

  it('提交在途时按钮与输入框禁用(防一帧重复送回)', () => {
    seedInteraction('t-wait', { sessionId: 'sess-9', submitting: true })
    const { container } = render(<TerminalSection terminals={[task({ id: 't-wait' })]} />)
    expect(
      (byTestId(container, 'terminal-interaction-submit-t-wait') as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      (byTestId(container, 'terminal-interaction-input-t-wait') as HTMLInputElement).disabled,
    ).toBe(true)
  })

  it('无等待态的终端卡不渲染输入行(不得凭空给每条命令一个框)', () => {
    const { container } = render(<TerminalSection terminals={[task({ id: 't-quiet' })]} />)
    expect(byTestId(container, 'terminal-interaction-t-quiet')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
