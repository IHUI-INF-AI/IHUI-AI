// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D19 terminal_delta(命令执行期实时输出增量)extension 端消费测试。
// 锁四件事:① foldTerminalDeltaIntoTasks 按 terminalId 折进既有 terminalTasks[].output,
//   空帧/无主帧丢弃、超限保尾部(与 web store.terminalOutputs 同口径);
// ② pickTerminalEndOutput「取更长者」归并(整帧截 8000,流期尾部不能被短整帧吃掉);
// ③ 装车证明 —— ChatPage 的 streamChat opts 真的挂了 onTerminalDelta 并调用被测纯函数;
// ④ 渲染面 —— 折叠后的 output 经 MessageContent 既有终端块渲染(不新建第二套终端 UI)。
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('../src/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'zh-CN' as const,
    setLocale: () => {},
  }),
}))

// ui-react 桶文件正被并行会话改(同 steer-notice.test 的先例),测试只解耦取 stub。
vi.mock('@ihui/ui-react', () => ({
  Button: () => null,
  Input: () => null,
  ContextInjectionList: () => null,
  Tooltip: ({ children }: { children?: unknown }) => children ?? null,
  TooltipTrigger: ({ children }: { children?: unknown }) => children ?? null,
  TooltipContent: ({ children }: { children?: unknown }) => children ?? null,
  TooltipProvider: ({ children }: { children?: unknown }) => children ?? null,
}))

import {
  foldTerminalDeltaIntoTasks,
  pickTerminalEndOutput,
  TERMINAL_LIVE_MAX_CHARS,
} from '../entrypoints/sidepanel/pages/ChatPage'
import { MessageContent } from '../entrypoints/sidepanel/components/MessageContent'
import type { TerminalTask } from '@ihui/types'

const runningTask: TerminalTask = {
  id: 't1',
  command: 'pnpm build',
  status: 'running',
  startedAt: '2026-09-25T00:00:00Z',
}

describe('foldTerminalDeltaIntoTasks(D19 增量折叠)', () => {
  it('命中 terminalId → 追加进该 task 的 output,不动其它字段', () => {
    const tasks = [runningTask]
    const next = foldTerminalDeltaIntoTasks(tasks, { terminalId: 't1', text: 'bundling 42%' })
    expect(next[0]?.output).toBe('bundling 42%')
    expect(next[0]?.command).toBe('pnpm build')
    expect(next[0]?.status).toBe('running')
    // 逐帧累加(流式多次调用不互相覆盖)
    const twice = foldTerminalDeltaIntoTasks(next, { terminalId: 't1', text: '\ndone' })
    expect(twice[0]?.output).toBe('bundling 42%\ndone')
    // 原数组不被就地修改(React state 纪律)
    expect(tasks[0]?.output).toBeUndefined()
  })

  it('空 terminalId / 空 text / 无主帧(没有对应任务)→ 原数组引用返回,静默丢弃', () => {
    const tasks = [runningTask]
    expect(foldTerminalDeltaIntoTasks(tasks, { terminalId: '', text: 'x' })).toBe(tasks)
    expect(foldTerminalDeltaIntoTasks(tasks, { terminalId: 't1', text: '' })).toBe(tasks)
    expect(foldTerminalDeltaIntoTasks(tasks, { terminalId: 'ghost', text: 'x' })).toBe(tasks)
  })

  it('单键超限保尾部(与 web 20000 字符口径同值,长构建日志不被内存撑爆)', () => {
    const tasks = [{ ...runningTask, output: 'a'.repeat(TERMINAL_LIVE_MAX_CHARS - 4) }]
    const next = foldTerminalDeltaIntoTasks(tasks, { terminalId: 't1', text: 'bcde' })
    const out = next[0]?.output ?? ''
    expect(out.length).toBe(TERMINAL_LIVE_MAX_CHARS)
    expect(out.endsWith('bcde')).toBe(true)
    expect(out.startsWith('aa')).toBe(true) // 保的是尾部而非头部截断后的开头一小段
  })
})

describe('pickTerminalEndOutput(D19 terminal_end 归并口径)', () => {
  it('整帧更短 → 保留流期累计的尾部(live 更长用 live,对齐 web effectiveOutput)', () => {
    const live = 'x'.repeat(9000) // 流期累计
    const frame = 'x'.repeat(8000) // 后端整帧截 8000
    expect(pickTerminalEndOutput(frame, live)).toBe(live)
  })
  it('整帧不短 → 用整帧(terminal_end 是权威终态)', () => {
    expect(pickTerminalEndOutput('full output', 'short')).toBe('full output')
    expect(pickTerminalEndOutput('same-lengt', 'same-lengt')).toBe('same-lengt')
  })
  it('两者皆空 → undefined(不造空串假象)', () => {
    expect(pickTerminalEndOutput(undefined, undefined)).toBeUndefined()
  })
})

describe('D19 装车证明:ChatPage 消费点与渲染面', () => {
  const chatPageSource = readFileSync(
    resolve(__dirname, '../entrypoints/sidepanel/pages/ChatPage.tsx'),
    'utf-8',
  )

  it('streamChat opts 显式注册 onTerminalDelta 且调用被测折叠函数(防"造好没装车"回退)', () => {
    expect(chatPageSource).toMatch(
      /onTerminalDelta:\s*\(evt\)\s*=>\s*\{[\s\S]*?foldTerminalDeltaIntoTasks\(/u,
    )
    // terminal_end 也走"取更长者"归并,不再整帧覆盖
    expect(chatPageSource).toMatch(
      /output:\s*pickTerminalEndOutput\(evt\.output,\s*task\.output\)/u,
    )
  })

  it('折叠进 output 的文本经 MessageContent 既有终端块渲染(pre 内可见)', () => {
    const html = renderToStaticMarkup(
      <MessageContent
        message={{
          id: 'm1',
          role: 'assistant',
          content: '',
          terminalTasks: [{ ...runningTask, output: 'live-tail: build ok\nexit 0' }],
        }}
      />,
    )
    expect(html).toContain('pnpm build')
    expect(html).toContain('live-tail: build ok')
    expect(html).toContain('exit 0')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
