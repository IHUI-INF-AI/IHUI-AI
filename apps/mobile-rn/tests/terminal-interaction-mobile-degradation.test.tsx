// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D151(2026-09-29 立)mobile-rn 终端「等待键盘输入」的降级态装车证明。
//
// 本票在这一端要证的不是"组件会不会画两行字",而是**那一行接线在不在**：
// 服务端会发帧、api-client 会解析、组件也写好了,唯独没人接 ⇒ 界面继续空转
// (守门 64/70/81/115/138 反复记过的同一型)。所以用例分三层,各证一件事：
//   ① 接线：AiAssistantN8nScreen.tsx 的 streamChat options 里 `onTerminalInteraction`
//      必须是**代码行**(不是注释行),且其回调体真的调用 `applyTerminalInteraction(`;
//      把那一行改名/删掉/注释掉,本用例必红 —— 只测组件证不出"挂上了";
//   ② 渲染：喂一条假 terminal_interaction 落进状态后的那张卡,必须渲染出**真词包**里
//      chat.terminal.mobileUnsupported 那句原文(期望值取自 src/i18n 的合并档,与
//      I18nProvider 实际喂给 t() 的是同一份 —— 用假 t() 只能证明"组件念了个键");
//   ③ 清空：terminal_end 的接线体必须调用 `clearTerminalWaitingFor`,且清掉之后渲染
//      不再出现等待行(否则"在等人"会永久挂在一条已经结束的卡上)。
// 反向对照(把接线注释掉 ⇒ 必红)写在下面的"注释面不得算接线"用例里,它对判据
// 自身做一次自证：整块注释掉的接线如果被我自己的行首筛漏过,②③ 全绿而门是瞎的。
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'

// 屏文件 import 面广(expo 原生模块在 vitest 下解析会拖垮整个测试文件),与
// terminal-delta-live.test.ts 同一手法：只替身"清单缺失/原生依赖",其余走真实模块。
vi.mock('@ihui/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  // 别名替身没有 streamChat(屏在模块顶层引它),补齐即可,不参与断言
  streamChat: vi.fn(async () => {}),
}))
vi.mock('expo-media-library', () => ({ __esModule: true }))
vi.mock('expo-image-picker', () => ({ __esModule: true }))
vi.mock('expo-document-picker', () => ({ __esModule: true }))
vi.mock('expo-audio', () => ({
  __esModule: true,
  AudioModule: {},
  RecordingPresets: {},
  setAudioModeAsync: vi.fn(async () => {}),
  useAudioRecorder: () => ({}),
}))
vi.mock('react-native', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>()
  const platform = mod['Platform'] as Record<string, unknown> | undefined
  if (platform && typeof platform.select !== 'function') {
    platform.select = (spec: Record<string, unknown>) =>
      'web' in spec ? spec['web'] : (spec['android'] ?? Object.values(spec)[0])
  }
  return mod
})
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: vi.fn(),
    goBack: vi.fn(),
    getParent: () => ({ navigate: vi.fn() }),
  }),
  useRoute: () => ({ params: {} }),
}))
vi.mock('@react-navigation/native-stack', () => ({}))
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ token: null, user: null }),
}))

import {
  applyTerminalInteraction,
  clearTerminalWaitingFor,
  TerminalTaskList,
  type TerminalWaitingMap,
} from '../src/screens/AiAssistantN8nScreen'
import type { TerminalTaskItem } from '../src/utils/chat-render-model'
import { I18nProvider, messages, getValueByPath } from '../src/i18n'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCREEN_SRC = resolve(HERE, '../src/screens/AiAssistantN8nScreen.tsx')

/**
 * 取"代码面"的行：剥掉行注释与块注释(字符串/模板串里的 // 不算注释),**保留缩进**
 * (下面的对账靠缩进认"streamChat options 的同级属性")。
 * 为什么不能"行首是 // 就丢"：块注释的内部行不以 `*` 开头是常态,
 * `/* onTerminalInteraction: (evt) => { … } *\/` 这种整块注释掉的接线会被当代码留下
 * ⇒ 反向对照跑出绿灯,而这条用例存在的全部理由就是让它红。
 * 本函数自带一条自证用例(见最后那个 describe)。
 */
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
      if (c === '"' || c === "'" || c === '`') {
        str = c
      }
      line += c
    }
    out.push(line)
  }
  return out
}

/** 取某个 options 属性体的行(按缩进认同级,遇到缩进回退即结束)。 */
function optionBody(lines: string[], name: string): string[] {
  const start = lines.findIndex((l) => new RegExp(`^\\s+${name}:`).test(l))
  if (start < 0) return []
  const indent = lines[start]!.search(/\S/)
  const body: string[] = []
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]!
    if (line.trim() === '') continue
    if (line.search(/\S/) <= indent && /^\s+\w+:/.test(line)) break
    body.push(line)
  }
  return body
}

const WAITING_KEY = 'chat.terminal.waitingInput'
const UNSUPPORTED_KEY = 'chat.terminal.mobileUnsupported'

/** 期望文案一律从**真词包**取(与 I18nProvider 喂给 t() 的同一份合并档),不在测试里写中文。 */
function realText(path: string): string {
  const merged = messages['zh-CN'] as unknown
  const raw = getValueByPath(merged, path)
  // 缺键必须在这里就喊出来:回退成键名会让"词包没这条"读起来像"组件没渲染"
  expect(typeof raw, `真词包缺键 ${path}`).toBe('string')
  const text = String(raw)
  expect(text.length, `真词包 ${path} 为空串`).toBeGreaterThan(0)
  expect(text).not.toBe(path)
  return text
}

function task(over: Partial<TerminalTaskItem> = {}): TerminalTaskItem {
  return { id: 'tc-1', command: 'pnpm test', status: 'running', ...over }
}

const wrap = (node: ReactNode) => render(<I18nProvider>{node}</I18nProvider>)

describe('D151 ① 接线：屏真的把 onTerminalInteraction 接进 streamChat', () => {
  const lines = codeLines(readFileSync(SCREEN_SRC, 'utf8'))

  it('代码面存在 onTerminalInteraction 属性行(删掉或注释成 // 即红)', () => {
    expect(lines.some((l) => /^\s+onTerminalInteraction:/.test(l))).toBe(true)
  })

  it('该回调体内真的调用 applyTerminalInteraction(接线不是空壳)', () => {
    const body = optionBody(lines, 'onTerminalInteraction')
    expect(body.length).toBeGreaterThan(0)
    expect(body.some((l) => l.includes('applyTerminalInteraction('))).toBe(true)
  })

  it('本端刻意不接上行出口：onTerminalInteraction 体内不得出现 postTerminalInput', () => {
    // 手机上进不去 ai-service 那条进程,复制 web 的输入口就是假 affordance;
    // 这条断言钉住"降级形态只做可见、不做可点"这一设计决定。
    const body = optionBody(lines, 'onTerminalInteraction')
    expect(body.some((l) => l.includes('postTerminalInput('))).toBe(false)
  })

  it('terminal_end 的接线体调用 clearTerminalWaitingFor(等待态不会挂在结束的卡上)', () => {
    const body = optionBody(lines, 'onTerminalEnd')
    expect(body.some((l) => l.includes('clearTerminalWaitingFor('))).toBe(true)
  })
})

describe('D151 ② 渲染：等待态出两行(状态 + 不能代答的说明),用真词包断言', () => {
  it('waiting 命中该 terminalId ⇒ 出现 waitingInput 与 mobileUnsupported 两句原文', () => {
    const waiting: TerminalWaitingMap = { 'tc-1': true }
    const { getByText, container } = wrap(<TerminalTaskList tasks={[task()]} waiting={waiting} />)
    // 两行都得在,而且第一行确实和第三行同屏(web 是"状态 + 输入行",本端是"状态 + 说明行")
    getByText(realText(WAITING_KEY))
    getByText(realText(UNSUPPORTED_KEY))
    expect(container.textContent).toContain(realText(UNSUPPORTED_KEY))
  })

  it('反向对照：同一张卡、waiting 为空 ⇒ 两句都不出现(证明渲染 keyed 在等待态上)', () => {
    const { queryByText, container } = wrap(<TerminalTaskList tasks={[task()]} waiting={{}} />)
    expect(queryByText(realText(UNSUPPORTED_KEY))).toBeNull()
    expect(queryByText(realText(WAITING_KEY))).toBeNull()
    expect(container.textContent).not.toBe('')
  })

  it('terminal_end 清掉后再渲染 ⇒ 等待行消失(纯函数 + 渲染两段都判)', () => {
    const afterEnd = clearTerminalWaitingFor({ 'tc-1': true }, 'tc-1')
    expect(afterEnd['tc-1']).toBeUndefined()
    const { queryByText } = wrap(
      <TerminalTaskList tasks={[task({ status: 'completed' })]} waiting={afterEnd} />,
    )
    expect(queryByText(realText(UNSUPPORTED_KEY))).toBeNull()
  })

  it('本端不得出现输入框/发送控件(只有文案,没有假 affordance)', () => {
    // react-native 桩把 Pressable 渲成 button、TextInput 渲成 input ——
    // 等待块若长出输入口,这两条计数就会变;卡片头那一个 button 是本票之前就有的折叠按钮。
    const bare = wrap(<TerminalTaskList tasks={[task()]} waiting={{}} />)
    const waiting = wrap(<TerminalTaskList tasks={[task()]} waiting={{ 'tc-1': true }} />)
    expect(waiting.container.querySelector('input')).toBeNull()
    expect(waiting.container.querySelectorAll('button')).toHaveLength(1)
    expect(
      waiting.container.querySelectorAll('button').length,
      '等待态不得比非等待态多出一个可点元素',
    ).toBe(bare.container.querySelectorAll('button').length)
  })
})

describe('D151 ③ 状态归键：与 terminalLive 并列、按 terminalId 走,不另立第二套终端状态源', () => {
  it('applyTerminalInteraction 空 terminalId 整帧丢弃(宁可不显示也不造无主的等待行)', () => {
    const prev: TerminalWaitingMap = {}
    expect(applyTerminalInteraction(prev, { terminalId: '' })).toBe(prev)
  })

  it('两条命令并行时按 terminalId 各自归键,清一个不影响另一个', () => {
    let s: TerminalWaitingMap = {}
    s = applyTerminalInteraction(s, { terminalId: 'tc-1' })
    s = applyTerminalInteraction(s, { terminalId: 'tc-2' })
    expect(Object.keys(s).sort()).toEqual(['tc-1', 'tc-2'])
    s = clearTerminalWaitingFor(s, 'tc-1')
    expect(s).toEqual({ 'tc-2': true })
  })

  it('重复帧幂等且返回同一引用(不触发无谓重渲染);未命中的 id 清理也返回同一引用', () => {
    const once = applyTerminalInteraction({}, { terminalId: 'tc-1' })
    expect(applyTerminalInteraction(once, { terminalId: 'tc-1' })).toBe(once)
    expect(clearTerminalWaitingFor(once, 'tc-9')).toBe(once)
  })
})

describe('D151 判据自证：注释面不得被算成接线', () => {
  const commented = [
    'await streamChat({',
    '  model: m,',
    '  /* onTerminalInteraction: (event) => {',
    '    setTerminalWaiting((prev) => applyTerminalInteraction(prev, event))',
    '  }, */',
    '  // onTerminalEnd: (event) => clearTerminalWaitingFor(prev, event.terminalId),',
    '})',
  ].join('\n')

  it('整块注释 / 行注释掉的接线,剥注释后一行都不剩', () => {
    const lines = codeLines(commented)
    expect(lines.some((l) => /^\s+onTerminalInteraction:/.test(l))).toBe(false)
    expect(lines.some((l) => /^\s+onTerminalEnd:/.test(l))).toBe(false)
    // 而块注释内部那行(不以 * 开头)若不剥注释就会被行首筛当代码留下 —— 这正是本判据存在的理由
    expect(commented.includes('setTerminalWaiting((prev) => applyTerminalInteraction(prev, event))')).toBe(
      true,
    )
    expect(lines.some((l) => l.includes('applyTerminalInteraction('))).toBe(false)
  })

  it('同一份文本去掉注释符后必须命中(证明上面那条不是恒真)', () => {
    const live = commented.replace(/\/\*|\*\//g, '').replace(/^  \/\//gm, '  ')
    const lines = codeLines(live)
    expect(lines.some((l) => /^\s+onTerminalInteraction:/.test(l))).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
