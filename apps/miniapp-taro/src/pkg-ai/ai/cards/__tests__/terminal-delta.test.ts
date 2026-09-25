// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D19(本票):miniapp terminal_delta 接线自证 —— 共享 parser(D19-A1)早已产出
// evt.terminalDelta,端内此前 dispatch 无该分支 = 解析了也静默丢帧,终端增量渲染
// parity 未对齐。本测试锁三层:
//  ① 纯逻辑:appendTerminalDelta 的归并语义(追加 / 自建 / 终态不动 / 上限裁剪);
//  ② 源码级接线:dispatch case + 回调表 + chat.tsx 消费点真实存在(摘掉即红);
//  ③ 端到端:真实帧形态(逐字取自 mcp_server._emit_terminal_delta 的生产载荷)经
//     共享 parseSSEChunk 解析后可直接喂给归并层,parse→dispatch→消费类型链同构。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { parseSSEChunk } from '@ihui/shared/utils/sse-parse'

import { appendTerminalDelta, type TerminalTaskView } from '../types'

const END_ROOT = join(__dirname, '..', '..', '..', '..', '..')

/** 后端 apps/ai-service/app/services/mcp_server.py::_emit_terminal_delta 的真实帧形态
 *  (带 text、不带 content/delta;字段与值逐字取自共享 sse-parse-terminal-delta.test.ts 夹具) */
const TERMINAL_DELTA_FRAME =
  'event: terminal_delta\n' +
  'data: {"type":"terminal_delta","terminalId":"tc-1","command":"pnpm test",' +
  '"stream":"stdout","text":"\\n✓ 7 passed\\n","iteration":3,"messageId":"m-1"}\n\n'

const running: TerminalTaskView = { id: 'tc-1', command: 'pnpm test', status: 'running' }

describe('appendTerminalDelta(D19 纯逻辑)', () => {
  it('running 任务逐帧追加,不被覆盖', () => {
    const once = appendTerminalDelta([running], { terminalId: 'tc-1', command: 'pnpm test', text: 'a\n' })
    const twice = appendTerminalDelta(once, { terminalId: 'tc-1', command: 'pnpm test', text: 'b\n' })
    expect(twice[0]?.output).toBe('a\nb\n')
    expect(twice[0]?.status).toBe('running')
  })

  it('start 帧缺失时按帧内 command 自建 running 任务(帧自洽,对齐 web 只按 terminalId 关联)', () => {
    const tasks = appendTerminalDelta([], { terminalId: 'tc-2', command: 'ls -la', text: 'file\n' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({ id: 'tc-2', command: 'ls -la', status: 'running', output: 'file\n' })
  })

  it('已结束任务不再累加(terminal_end 的 output 是权威快照,迟到 delta 不得改写终态)', () => {
    const ended: TerminalTaskView = { id: 'tc-1', command: 'pnpm test', status: 'completed', output: 'done' }
    const tasks = appendTerminalDelta([ended], { terminalId: 'tc-1', command: 'pnpm test', text: 'late\n' })
    expect(tasks[0]?.output).toBe('done')
  })

  it('累加超上限(20000,web appendTerminalOutput 同值)裁剪保留尾部', () => {
    const big = 'x'.repeat(19990)
    let tasks = appendTerminalDelta([running], { terminalId: 'tc-1', command: 'c', text: big })
    tasks = appendTerminalDelta(tasks, { terminalId: 'tc-1', command: 'c', text: 'y'.repeat(30) })
    expect(tasks[0]?.output?.length).toBe(20000)
    expect(tasks[0]?.output?.endsWith('y'.repeat(30))).toBe(true)
  })

  it('terminalId / text 缺一即无操作(宁丢不造;对齐 web onTerminalStart 的守卫口径)', () => {
    expect(appendTerminalDelta([running], { terminalId: '', command: 'c', text: 'x' })).toEqual([running])
    expect(appendTerminalDelta([running], { terminalId: 'tc-1', command: 'c', text: '' })).toEqual([running])
  })

  it('不同 terminalId 互不串扰(多终端并行命令各自累加)', () => {
    const two = [
      { ...running },
      { id: 'tc-9', command: 'npm run dev', status: 'running' as const },
    ]
    const tasks = appendTerminalDelta(two, { terminalId: 'tc-9', command: 'npm run dev', text: 'ready\n' })
    expect(tasks[0]?.output).toBeUndefined()
    expect(tasks[1]?.output).toBe('ready\n')
  })
})

describe('D19 端到端:真实帧经共享 parser 解析后可直接喂归并层', () => {
  it('parseSSEChunk(TERMINAL_DELTA_FRAME) → evt.terminalDelta → appendTerminalDelta', () => {
    const { events } = parseSSEChunk(TERMINAL_DELTA_FRAME)
    const delta = events.find((e) => e.type === 'terminal_delta')?.terminalDelta
    expect(delta).toBeDefined()
    expect(delta).toMatchObject({ terminalId: 'tc-1', command: 'pnpm test', stream: 'stdout' })
    const tasks = appendTerminalDelta([running], delta!)
    expect(tasks[0]?.output).toBe('\n✓ 7 passed\n')
    // 终端输出不得混进聊天正文(D19-A1 的核心判据,端到端侧再钉一次)
    const chunk = events.find((e) => e.type === 'chunk')
    expect(chunk).toBeUndefined()
  })
})

describe('D19 接线自证(源码级):dispatch case / 回调表 / 消费点缺一即红', () => {
  const apiSrc = readFileSync(join(END_ROOT, 'src/api/index.ts'), 'utf8')
  const chatSrc = readFileSync(join(END_ROOT, 'src/pkg-ai/ai/chat.tsx'), 'utf8')

  it('api/index.ts:dispatch 注册 terminal_delta 分支 + 回调表声明 onTerminalDelta', () => {
    expect(apiSrc).toContain("case 'terminal_delta':")
    expect(apiSrc).toMatch(/onTerminalDelta\?: \(evt: TerminalDeltaEvent\) => void/)
    expect(apiSrc).toMatch(/callbacks\?\.onTerminalDelta\?\.\(evt\.terminalDelta\)/)
  })

  it('api/index.ts:TerminalDeltaEvent 类型取自 @ihui/api-client(不端内自造第二份契约)', () => {
    expect(apiSrc).toMatch(/import type \{ TerminalDeltaEvent \} from '@ihui\/api-client'/)
  })

  it('chat.tsx:注册 onTerminalDelta 并经 appendTerminalDelta 归并(不注册 = 静默丢帧)', () => {
    expect(chatSrc).toMatch(/onTerminalDelta: \(evt\) =>/)
    expect(chatSrc).toMatch(/appendTerminalDelta\(c\.terminalTasks, evt\)/)
    expect(chatSrc).toMatch(/import \{[\s\S]*?appendTerminalDelta[\s\S]*?\} from '\.\/cards\/types'/)
  })

  it('chat.tsx:terminal_end 缺 output 时不清空实时累加(evt.output ?? x.output)', () => {
    expect(chatSrc).toContain('output: evt.output ?? x.output,')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
