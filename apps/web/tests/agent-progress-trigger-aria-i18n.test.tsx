// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * AgentProgressTrigger aria-label 整串 i18n 锁定(2026-10-22 立,CI e2e run 39710007341 红根因)
 *
 * 根因链(本票要钉死的形态):
 * - `chat.modeBuild` 等模式名在五语言词包里都已翻译(ko = "빌드"),但组件把 aria-label
 *   拼成 `${modeLabel}任务` / `任务进度 ${liveStatusText}` —— 后缀 `任务`、前缀 `任务进度`
 *   是组件内硬编码中文,整条 aria-label 不走 i18n。
 * - 结果 ko 下真值应为 `빌드 작업`(参照同词包 chat.taskProgressOpen = "작업 진행 상황"
 *   与 admin.agentTask.* "에이전트 작업" 的 任务=작업 译法),e2e 却把混血串 `빌드任务`
 *   钉成了基线(AGENTS §19 禁止端内硬编码中文)。
 *
 * 本文件不 mock `next-intl`,而是挂**真的 NextIntlClientProvider + 真词包(mergeMessages
 * shared+web,与 src/providers/i18n-provider.tsx 同一取词口径)** —— 期望串一律从真词包
 * 模板现取(§22c:测试不得复制一份判据/字面量,否则只是复读机)。
 * 正控(zh-CN)证明改后中文形态逐字不变;混血断言(不含任何汉字)只对 en/ko 成立,
 * ja/zh-TW 合法含汉字,只钉精确值。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ReactNode } from 'react'

import { render, cleanup, act } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { AbstractIntlMessages } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mergeMessages } from '@ihui/i18n/loader'
import type { Messages } from '@ihui/i18n/types'

import { useModeStore } from '@/stores/mode'
import { useAgentProgressPaneStore } from '@/stores/agent-progress-pane'
// consistent-type-imports 禁 `typeof import('...')` 内联标注 ⇒ 顶部 type-only 命名空间
// import 后以 `typeof _ns` 引用(类型等值,vi.mock 工厂内仅编译期解析,无运行时影响)。
import type * as _agentProgressNs from '../src/hooks/use-agent-progress'

// useAgentProgress 桩:只驱动 idle/streaming 两分支,数据面与本判据无关
const { mockProgressState } = vi.hoisted(() => ({
  mockProgressState: { isStreaming: false },
}))

vi.mock('@/hooks/use-agent-progress', async () => {
  const actual = await vi.importActual<typeof _agentProgressNs>('../src/hooks/use-agent-progress')
  return {
    ...actual,
    useAgentProgress: () => ({
      overview: { completedSteps: 0 },
      currentTask: { kind: 'idle', label: '' },
      planSteps: [],
      subagents: [],
      terminals: [],
      tools: [],
      changes: [],
      events: [],
      isStreaming: mockProgressState.isStreaming,
      start: () => {},
      stop: () => {},
      clear: () => {},
    }),
  }
})

// Tooltip 会拉进 portal 与 Radix 运行时;aria-label 在被包元素自身,替身不影响判据
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => <span data-stub="tooltip">{children}</span>,
}))

import { AgentProgressTrigger } from '../src/components/ai/agent-progress-trigger'

const here = dirname(fileURLToPath(import.meta.url))
// apps/web/tests → 仓库根 → packages/i18n/messages
const MESSAGES_ROOT = join(here, '..', '..', '..', 'packages', 'i18n', 'messages')

const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const
type Locale = (typeof LOCALES)[number]

/** 与 i18n-provider.tsx 同一取词口径:shared 打底、web 覆盖合并 */
function loadMerged(loc: Locale): AbstractIntlMessages {
  const shared = JSON.parse(
    readFileSync(join(MESSAGES_ROOT, 'shared', `${loc}.json`), 'utf8'),
  ) as Messages
  const web = JSON.parse(
    readFileSync(join(MESSAGES_ROOT, 'web', `${loc}.json`), 'utf8'),
  ) as Messages
  return mergeMessages(shared, web) as unknown as AbstractIntlMessages
}

const merged = Object.fromEntries(LOCALES.map((loc) => [loc, loadMerged(loc)])) as Record<
  Locale,
  Record<string, Record<string, string>>
>

/** 期望 idle aria-label = 真词包 chat.modeTaskAria 模板填入 chat.mode<Mode>(单占位符,
 *  与 next-intl 对该模板的渲染逐字一致)。 */
const expectIdleAria = (loc: Locale, modeKey: 'modeBuild' | 'modePlan'): string =>
  merged[loc]!.chat.modeTaskAria!.replace('{mode}', merged[loc]!.chat[modeKey]!)

/** 期望 streaming aria-label 前缀 = 真词包 chat.taskProgressAria 去占位符后的头部 */
const expectProgressAriaPrefix = (loc: Locale): string =>
  merged[loc]!.chat.taskProgressAria!.replace('{status}', '')

const renderTrigger = (loc: Locale) =>
  render(
    <NextIntlClientProvider
      locale={loc}
      messages={merged[loc] as AbstractIntlMessages}
      timeZone="Asia/Shanghai"
    >
      <AgentProgressTrigger iconOnly />
    </NextIntlClientProvider>,
  )

const ariaOf = (): string => {
  const el = document.querySelector('[data-testid="agent-progress-trigger"]')
  expect(el, 'trigger 必须挂载').not.toBeNull()
  return (el as HTMLElement).getAttribute('aria-label') ?? ''
}

const HAN = /[\u4e00-\u9fff]/

beforeEach(() => {
  useAgentProgressPaneStore.getState().reset()
  act(() => {
    useModeStore.getState().setMode('build')
  })
  mockProgressState.isStreaming = false
})

afterEach(() => {
  // 本仓 vitest 配置 globals:false ⇒ RTL 自动 cleanup 不注册,必须手动卸载
  cleanup()
})

describe('AgentProgressTrigger aria-label 整串走 i18n(禁止组件内硬编码中文后缀)', () => {
  it('zh-CN 正控:idle build aria-label 仍为词包模板渲染的「构建任务」(形态逐字不变)', () => {
    renderTrigger('zh-CN')
    expect(ariaOf()).toBe(expectIdleAria('zh-CN', 'modeBuild'))
    expect(ariaOf()).toBe('构建任务')
  })

  for (const loc of ['en', 'ja', 'zh-TW'] as const) {
    it(`${loc}: idle build aria-label === 词包模板现取值`, () => {
      renderTrigger(loc)
      expect(ariaOf()).toBe(expectIdleAria(loc, 'modeBuild'))
    })
  }

  it('ko: idle build aria-label 为整韩「빌드 작업」,且不含任何汉字(混血串即红)', () => {
    renderTrigger('ko')
    expect(ariaOf()).toBe(expectIdleAria('ko', 'modeBuild'))
    expect(ariaOf()).toBe('빌드 작업')
    expect(ariaOf()).not.toMatch(HAN)
  })

  it('ko: 切到 plan 模式后 aria-label 为「계획 작업」,无汉字残留', () => {
    renderTrigger('ko')
    act(() => {
      useModeStore.getState().setMode('plan')
    })
    expect(ariaOf()).toBe(expectIdleAria('ko', 'modePlan'))
    expect(ariaOf()).toBe('계획 작업')
    expect(ariaOf()).not.toMatch(HAN)
  })

  it('ko: streaming 态 aria-label 前缀为「작업 진행 상황」,无汉字残留', () => {
    // 挂载前置位(桩 hook 每次 render 现读状态;render 后改外部变量不触发重渲染)
    mockProgressState.isStreaming = true
    renderTrigger('ko')
    const aria = ariaOf()
    expect(aria.startsWith(expectProgressAriaPrefix('ko'))).toBe(true)
    expect(aria).not.toMatch(HAN)
  })

  it('en: streaming 态 aria-label 前缀为词包 taskProgressAria,无汉字残留', () => {
    mockProgressState.isStreaming = true
    renderTrigger('en')
    const aria = ariaOf()
    expect(aria.startsWith(expectProgressAriaPrefix('en'))).toBe(true)
    expect(aria).not.toMatch(HAN)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
