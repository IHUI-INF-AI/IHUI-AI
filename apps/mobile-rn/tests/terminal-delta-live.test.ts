// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D19 mobile-rn terminal_delta 增量渲染(AiAssistantN8nScreen live 缓冲)定向测试。
// 覆盖四项判据:
//  ① 一帧增量只进 live 缓冲,不落消息正文/不折进 terminalTasks 模型(与 onDelta 分通道);
//  ② 多帧同 terminalId 累加;
//  ③ 超限保尾部不保头部 + 键数超限逐出最旧(RN 内存敏感,不无上限累积);
//  ④ terminal_end 到达后与整帧 output **取更长者**(web terminal-section 同口径,
//     后端整帧 output 截 8000 字符,live 更长时构建日志尾部不得被截断版顶掉)。
import { describe, expect, it, vi } from 'vitest'

import type { TerminalEndEvent, TerminalStartEvent } from '@ihui/api-client'

// 屏文件 import 面广(expo 原生模块在 vitest 下解析会拖垮整个测试文件,同 vitest.config
// 对 expo-file-system 的注释)。本测试只用屏文件导出的纯函数切片,故替身只补"清单缺失/
// 原生依赖"两类,其余走真实模块 —— 与 agent-screen.test.tsx 同一手法。
vi.mock('@ihui/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  // 别名替身没有 streamChat(屏在模块顶层引它),补齐即可,不参与断言
  streamChat: vi.fn(async () => {}),
}))
vi.mock('expo-media-library', () => ({ __esModule: true }))
vi.mock('expo-image-picker', () => ({ __esModule: true }))
vi.mock('expo-document-picker', () => ({ __esModule: true }))
// VoiceInput 引 expo-audio(原生模块,named 导入必须给齐否则模块解析即失败)
vi.mock('expo-audio', () => ({
  __esModule: true,
  AudioModule: {},
  RecordingPresets: {},
  setAudioModeAsync: vi.fn(async () => {}),
  useAudioRecorder: () => ({}),
}))
// active-tokens 引 react-native-restart:该包被 vite 外部化后其 require('react-native')
// 会打到真实 RN(Flow 源码)→ 'typeof' SyntaxError,与业务无关,替身截断即可。
vi.mock('react-native-restart', () => ({
  __esModule: true,
  default: { restart: vi.fn(), restartAsync: vi.fn() },
}))
// RN 替身的 Platform 没有 select(屏文件 StyleSheet 顶层用 Platform.select 取等宽字体,
// HEAD 即如此,只是此前没有测试 import 过本屏)。在替身对象上补一个 select,不改动共享 mock 文件。
vi.mock('react-native', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>()
  const platform = mod['Platform'] as Record<string, unknown> | undefined
  if (platform && typeof platform.select !== 'function') {
    platform.select = (spec: Record<string, unknown>) =>
      'web' in spec ? spec['web'] : (spec['android'] ?? Object.values(spec)[0])
  }
  return mod
})
// @react-navigation/native 真实包引 Platform.select(RN 替身没有)——与 agent-screen.test.tsx 同法截断
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: vi.fn(),
    goBack: vi.fn(),
    getParent: () => ({ navigate: vi.fn() }),
  }),
  useRoute: () => ({ params: {} }),
}))
vi.mock('@react-navigation/native-stack', () => ({}))
// AuthContext(真实模块)→ lib/sso → expo-web-browser → expo-modules-core 在 vitest 下
// 触 __DEV__ 未定义崩溃;本测试不经过登录态,替身截断(与 agent-screen.test.tsx 同法)。
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ token: null, user: null }),
}))

import {
  applyTerminalDeltaToLive,
  foldTerminalDelta,
  TERMINAL_LIVE_MAX_CHARS,
  TERMINAL_LIVE_MAX_KEYS,
  terminalDisplayOutput,
} from '../src/screens/AiAssistantN8nScreen'
import {
  applyTerminalEnd,
  applyTerminalStart,
  type TerminalTaskItem,
} from '../src/utils/chat-render-model'

function startEvent(terminalId: string): TerminalStartEvent {
  return {
    type: 'terminal_start',
    terminalId,
    command: 'make build',
    startedAt: '2026-09-25T00:00:00.000Z',
  } as unknown as TerminalStartEvent
}

function endEvent(terminalId: string, over: Partial<TerminalEndEvent>): TerminalEndEvent {
  return {
    type: 'terminal_end',
    terminalId,
    status: 'completed',
    endedAt: '2026-09-25T00:00:05.000Z',
    durationMs: 5000,
    ...over,
  } as unknown as TerminalEndEvent
}

describe('D19 ① 增量只进 live 缓冲,不落消息正文', () => {
  it('一帧 delta 后 live 缓冲含该行,而 terminalTasks 模型不含它(正文通道为 onDelta,另属一路)', () => {
    const tasks = applyTerminalStart(undefined, startEvent('t1'))
    const live = applyTerminalDeltaToLive({}, { terminalId: 't1', text: 'compiling main.c\n' })
    expect(live['t1']).toBe('compiling main.c\n')
    // 增量的落点是独立缓冲:任务项的 output(整帧字段)与状态均未被 delta 触碰
    expect(tasks[0]?.output).toBeUndefined()
    expect(tasks[0]?.status).toBe('running')
  })

  it('空 terminalId / 空 text 帧整帧丢弃,返回原引用(不触发无谓重渲染)', () => {
    const base = { t1: 'x' }
    expect(applyTerminalDeltaToLive(base, { terminalId: '', text: 'y' })).toBe(base)
    expect(applyTerminalDeltaToLive(base, { terminalId: 't2', text: '' })).toBe(base)
  })
})

describe('D19 ② 多帧同 terminalId 累加', () => {
  it('三帧按序拼接', () => {
    let live: Record<string, string> = {}
    live = applyTerminalDeltaToLive(live, { terminalId: 't1', text: 'a' })
    live = applyTerminalDeltaToLive(live, { terminalId: 't1', text: 'b\n' })
    live = applyTerminalDeltaToLive(live, { terminalId: 't1', text: 'c' })
    expect(live['t1']).toBe('ab\nc')
  })

  it('不同 terminalId 各占一键,互不串写', () => {
    let live = applyTerminalDeltaToLive({}, { terminalId: 't1', text: 'one' })
    live = applyTerminalDeltaToLive(live, { terminalId: 't2', text: 'two' })
    expect(live['t1']).toBe('one')
    expect(live['t2']).toBe('two')
  })
})

describe('D19 ③ 超限保尾部不保头部(保最新输出,RN 内存敏感)', () => {
  it('单键超 20000 字符时截掉的是头部,尾部逐字保留', () => {
    const head = 'H'.repeat(TERMINAL_LIVE_MAX_CHARS - 5)
    const tail = 'TAILMARKER'
    const out = foldTerminalDelta({ t1: head }, 't1', tail)
    const v = out['t1'] ?? ''
    expect(v.length).toBe(TERMINAL_LIVE_MAX_CHARS)
    expect(v.endsWith(tail)).toBe(true)
    expect(v).toBe('H'.repeat(TERMINAL_LIVE_MAX_CHARS - tail.length) + tail)
  })

  it('一帧即超限也只留尾部', () => {
    const huge = 'Z'.repeat(TERMINAL_LIVE_MAX_CHARS + 1234)
    const out = foldTerminalDelta({}, 't1', huge)
    expect((out['t1'] ?? '').length).toBe(TERMINAL_LIVE_MAX_CHARS)
  })

  it('键数超上限时逐出最旧,不无上限累积', () => {
    let live: Record<string, string> = {}
    for (let i = 0; i < TERMINAL_LIVE_MAX_KEYS + 5; i++) {
      live = foldTerminalDelta(live, `term-${i}`, 'x')
    }
    const keys = Object.keys(live)
    expect(keys.length).toBe(TERMINAL_LIVE_MAX_KEYS)
    expect(live['term-0']).toBeUndefined()
    expect(live[`term-${TERMINAL_LIVE_MAX_KEYS + 4}`]).toBe('x')
  })
})

describe('D19 ④ terminal_end 后与整帧 output 取更长者', () => {
  it('live 比后端截断的 8000 字符整帧长 → 用 live(构建日志尾部不被截掉)', () => {
    const tasks = applyTerminalStart(undefined, startEvent('t1'))
    const live = foldTerminalDelta({}, 't1', 'x'.repeat(9000))
    const done = applyTerminalEnd(
      tasks,
      endEvent('t1', { output: 'y'.repeat(8000), truncated: true }),
    )
    const task = done[0] as TerminalTaskItem
    expect(task.status).toBe('completed')
    expect(terminalDisplayOutput(task, live['t1'])).toBe(live['t1'])
  })

  it('整帧 output 更长 → 用整帧(live 缺帧/更短不得反客为主)', () => {
    const task: TerminalTaskItem = {
      id: 't1',
      command: 'ls',
      status: 'completed',
      output: 'z'.repeat(100),
    }
    expect(terminalDisplayOutput(task, 'short')).toBe(task.output)
    expect(terminalDisplayOutput(task, undefined)).toBe(task.output)
  })

  it('两者皆空 → 无输出可渲染(undefined,面板不出输出块)', () => {
    const task: TerminalTaskItem = { id: 't1', command: 'ls', status: 'running' }
    expect(terminalDisplayOutput(task, undefined)).toBeUndefined()
    expect(terminalDisplayOutput(task, '')).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
