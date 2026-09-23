// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  SIDE_TASK_LIFECYCLE_STATES,
  SIDE_TASK_RUN_LOCATIONS,
  collectExpiredSideTasks,
  sideTaskView,
  type SideTask,
  type SideTaskAction,
  type SideTaskState,
} from '@ihui/shared/chat/side-task-lifecycle'

import { SideTaskLifecycleCard } from '../side-task-lifecycle-card'

// 只断言**结构与判据**(四态 / 显式声明 / 空态 / 确认弹层可见性),文案一律走 key;
// 真实文案由下面「读真实词包」那组用例守住 —— 组件测试不依赖措辞变动。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${JSON.stringify(values)})` : key,
}))

const T0 = 1_800_000_000_000

const task = (
  state: SideTaskState,
  extra: Partial<Omit<SideTask, 'state'>> = {},
): SideTask => ({
  id: `t-${state}`,
  title: `标题-${state}`,
  state,
  createdAt: T0,
  location: 'sameFolder',
  ...extra,
})

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

describe('D75 SideTaskLifecycleCard / 四态与显式声明', () => {
  it('四态逐个渲染出 data-side-task-state,状态标签非空', () => {
    for (const state of SIDE_TASK_LIFECYCLE_STATES) {
      const { container, unmount } = render(<SideTaskLifecycleCard task={task(state)} />)
      expect(container.querySelector(`[data-side-task-state="${state}"]`), state).not.toBeNull()
      const label = container.querySelector(`[data-side-task-state-label="${state}"]`)
      expect((label?.textContent ?? '').length, state).toBeGreaterThan(0)
      unmount()
    }
  })

  it('**显式声明**四态恒在 —— 创建(running)时就有,不等"已清理"后才告知', () => {
    for (const state of SIDE_TASK_LIFECYCLE_STATES) {
      const { container, unmount } = render(<SideTaskLifecycleCard task={task(state)} />)
      const notice = container.querySelector('[data-side-task-ephemeral-notice="true"]')
      expect(notice, state).not.toBeNull()
      expect((notice?.textContent ?? '').includes('ephemeralNotice'), state).toBe(true)
      unmount()
    }
  })

  it('过期提示仅出现在 expired / cleaned(running / completed 不画蛇添足)', () => {
    const expected: Record<string, string | null> = {
      running: null,
      completed: null,
      expired: 'hint.expired',
      cleaned: 'hint.cleaned',
    }
    for (const state of SIDE_TASK_LIFECYCLE_STATES) {
      const { container, unmount } = render(<SideTaskLifecycleCard task={task(state)} />)
      const hint = container.querySelector('[data-side-task-hint]')
      if (expected[state]) {
        expect(hint?.getAttribute('data-side-task-hint'), state).toBe(expected[state])
      } else {
        expect(hint, state).toBeNull()
      }
      unmount()
    }
  })

  it('并行运行位置:两种位置各自渲染出独立的位置标记', () => {
    for (const location of SIDE_TASK_RUN_LOCATIONS) {
      const { container, unmount } = render(
        <SideTaskLifecycleCard task={task('running', { location })} />,
      )
      const node = container.querySelector(`[data-side-task-location="${location}"]`)
      expect(node, location).not.toBeNull()
      expect((node?.textContent ?? '').includes(`location.${location}`), location).toBe(true)
      unmount()
    }
  })

  it('cleaned 态渲染「来自已清理的 {标题}」,且标题原样带在属性上', () => {
    const { container } = render(
      <SideTaskLifecycleCard task={task('cleaned', { title: '重构 parser' })} />,
    )
    const node = container.querySelector('[data-side-task-cleaned-from="重构 parser"]')
    expect(node).not.toBeNull()
    expect((node?.textContent ?? '').includes('"title":"重构 parser"')).toBe(true)
  })

  it('传入批量清理清单 ⇒ 逐条渲染同一「来自已清理的 {标题}」键', () => {
    const tasks: SideTask[] = [
      task('expired', { id: 'a', title: 'A 任务' }),
      task('running', { id: 'b', title: 'B 任务' }),
      task('cleaned', { id: 'c', title: 'C 任务' }),
    ]
    const cleaned = collectExpiredSideTasks(tasks, T0)
    expect(cleaned.map((e) => e.title)).toEqual(['A 任务'])
    const { container } = render(<SideTaskLifecycleCard cleaned={cleaned} />)
    expect(container.querySelector('[data-side-task-cleaned-list="true"]')).not.toBeNull()
    expect(container.querySelector('[data-side-task-cleaned-from="A 任务"]')).not.toBeNull()
  })

  it('无 task 且无清理清单 ⇒ 渲染空态,不带任何状态属性', () => {
    const { container } = render(<SideTaskLifecycleCard />)
    expect(container.querySelector('[data-side-task-empty="true"]')).not.toBeNull()
    expect(container.querySelector('[data-side-task-state]')?.getAttribute('data-side-task-state')).toBe('none')
  })
})

describe('D75 SideTaskLifecycleCard / 文件变更计数与关闭确认', () => {
  it('changedFiles > 0 ⇒ 计数键 + 插值(props(count))', () => {
    const { container } = render(
      <SideTaskLifecycleCard task={task('completed', { changedFiles: 3 })} />,
    )
    const node = container.querySelector('[data-side-task-files="3"]')
    expect(node).not.toBeNull()
    expect(node?.getAttribute('data-side-task-files-empty')).toBe('false')
    expect((node?.textContent ?? '').includes('"count":"3"')).toBe(true)
  })

  it('changedFiles = 0 / 缺省 ⇒ 明确空态文案,不显示孤零零的「0」', () => {
    for (const extra of [{}, { changedFiles: 0 }]) {
      const { container, unmount } = render(
        <SideTaskLifecycleCard task={task('completed', extra)} />,
      )
      const node = container.querySelector('[data-side-task-files]')
      expect(node?.getAttribute('data-side-task-files-empty')).toBe('true')
      const text = node?.textContent ?? ''
      expect(text.includes('files.empty')).toBe(true)
      expect(text.includes('files.changedCount')).toBe(false)
      unmount()
    }
  })

  it('关闭确认判据落到 DOM:运行中 / 有产物必须确认,纯已完成**不打扰**', () => {
    const flagOf = (extra: Partial<Omit<SideTask, 'state'>>, state: SideTaskState = 'completed') => {
      const { container, unmount } = render(<SideTaskLifecycleCard task={task(state, extra)} />)
      const flag = container
        .querySelector('[data-side-task-state]')
        ?.getAttribute('data-side-task-needs-close-confirm')
      unmount()
      return flag
    }
    expect(flagOf({})).toBe('false')
    expect(flagOf({ unsavedArtifacts: 2 })).toBe('true')
    expect(flagOf({ runningChildProcesses: 1 })).toBe('true')
    expect(flagOf({}, 'running')).toBe('true')
    expect(flagOf({ unsavedArtifacts: 2 }, 'cleaned')).toBe('false')
  })

  it('需要确认 + confirmOpen ⇒ 渲染 alertdialog 与确认/取消两个按钮', () => {
    const onAction = vi.fn()
    const { container } = render(
      <SideTaskLifecycleCard task={task('running')} confirmOpen onAction={onAction} />,
    )
    expect(container.querySelector('[role="alertdialog"][data-side-task-confirm="open"]')).not.toBeNull()
    expect(container.querySelector('[data-side-task-confirm-title="true"]')).not.toBeNull()
    expect(container.querySelector('[data-side-task-confirm-desc="true"]')).not.toBeNull()
    ;(container.querySelector('[data-action="confirmClose"]') as HTMLButtonElement).click()
    ;(container.querySelector('[data-action="cancelClose"]') as HTMLButtonElement).click()
    expect(onAction).toHaveBeenCalledWith('confirmClose' as SideTaskAction)
    expect(onAction).toHaveBeenCalledWith('cancelClose' as SideTaskAction)
  })

  it('负例:不需确认时,即便 confirmOpen 也不弹层(纯已完成态不被打扰)', () => {
    const { container } = render(
      <SideTaskLifecycleCard task={task('completed')} confirmOpen onAction={() => {}} />,
    )
    expect(container.querySelector('[data-side-task-confirm="open"]')).toBeNull()
  })

  it('cleanup 入口仅在 expired 态出现;close 入口四态都有', () => {
    for (const state of SIDE_TASK_LIFECYCLE_STATES) {
      const { container, unmount } = render(
        <SideTaskLifecycleCard task={task(state)} onAction={() => {}} />,
      )
      expect(container.querySelector('[data-action="close"]'), state).not.toBeNull()
      const cleanup = container.querySelector('[data-action="cleanup"]')
      if (state === 'expired') expect(cleanup, state).not.toBeNull()
      else expect(cleanup, state).toBeNull()
      unmount()
    }
  })

  it('动作回调带上动作 id;不传 onAction ⇒ 不渲染任何动作按钮', () => {
    const onAction = vi.fn()
    const { container } = render(
      <SideTaskLifecycleCard task={task('expired')} onAction={onAction} />,
    )
    ;(container.querySelector('[data-action="close"]') as HTMLButtonElement).click()
    ;(container.querySelector('[data-action="cleanup"]') as HTMLButtonElement).click()
    expect(onAction).toHaveBeenCalledWith('close')
    expect(onAction).toHaveBeenCalledWith('cleanup')

    const bare = render(<SideTaskLifecycleCard task={task('expired')} />)
    expect(bare.container.querySelector('[data-action]')).toBeNull()
  })
})

describe('D75 SideTaskLifecycleCard / 与 /side 队列语义不冲突(W27 预备消息优先)', () => {
  const readSrc = (rel: string): string =>
    readFileSync(join(here, rel), 'utf8')

  it('W27 规则原文仍在,且**预备消息分支在前**:pendingMessages > 0 先出队,仅无预备消息才补答侧问', () => {
    const src = readSrc('../../chat/message-input.tsx')
    const pendIdx = src.indexOf('if (pendingMessages.length > 0)')
    const sideIdx = src.indexOf('} else if (sideQueue && sideQueue.length > 0)')
    expect(pendIdx).toBeGreaterThan(-1)
    expect(sideIdx).toBeGreaterThan(-1)
    expect(pendIdx).toBeLessThan(sideIdx)
    // 分支体内:预备消息走发送,侧问走补答
    expect(src).toMatch(
      /if \(pendingMessages\.length > 0\) \{[\s\S]{0,120}?sendPendingMessage\(\)[\s\S]{0,120}?\} else if \(sideQueue && sideQueue\.length > 0\) \{[\s\S]{0,160}?answerCurrentSideQuestion\(\)/,
    )
  })

  it('/side 提交路径仍明文排除 W27 队列(侧问不进 pendingMessages)', () => {
    const src = readSrc('../../../hooks/use-message-send.ts')
    expect(src).toContain('侧问正文不进高风险检测、不进主线发送、不进 W27 队列')
  })

  it('本卡与判定层**不接队列**:代码里没有任何 chat store / 队列 / 预备消息 API', () => {
    const cardSrc = readSrc('../side-task-lifecycle-card.tsx')
    // 只查**代码**:注释里讨论队列是刻意的举证,不算接线 —— 故先剥注释再看标识符
    const code = cardSrc
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//'))
      .join('\n')
    for (const forbidden of [
      'useChatStore',
      '@/stores/chat',
      'sideQueueByConversation',
      'enqueueSideQuestion',
      'shiftSideQuestion',
      'pendingMessages',
      'sendPendingMessage',
      'answerSideQuestion',
    ]) {
      expect(code.includes(forbidden), `card 代码含 ${forbidden}`).toBe(false)
    }
  })

  it('判定层消费队列数据只读:走查前后顺序与内容完全一致', () => {
    // W27 预备消息优先的前提是「侧队列本身不被第三方改写」。逐条断言:
    // 判定层只读,不做任何队列写操作(JSON 快照前后一致)。
    const queue: SideTask[] = [
      task('running', { id: 'q1', title: '队列首条' }),
      task('completed', { id: 'q2', title: '队列次条', changedFiles: 2 }),
    ]
    const before = JSON.stringify(queue)
    for (const item of queue) sideTaskView(item)
    collectExpiredSideTasks(queue, T0 + 10)
    expect(JSON.stringify(queue)).toBe(before)
    expect(queue.map((q) => q.id)).toEqual(['q1', 'q2'])
  })
})

describe('D75 词包覆盖(读真实词包,不 mock)', () => {
  const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
    )
  const VAL = (obj: Record<string, unknown>, path: string): string => {
    const parts = path.split('.')
    let cur: unknown = obj
    for (const p of parts) cur = (cur as Record<string, unknown>)?.[p]
    return typeof cur === 'string' ? cur : ''
  }

  const readSideTask = (locale: string): Record<string, unknown> => {
    const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
    const parsed = JSON.parse(raw) as { ai?: { pane?: { sideTask?: Record<string, unknown> } } }
    const node = parsed.ai?.pane?.sideTask
    if (!node) throw new Error(`missing ai.pane.sideTask in ${locale}.json`)
    return node
  }

  it('五语言键集完全一致(parity)', () => {
    const base = flat(readSideTask('zh-CN')).sort()
    expect(base.length).toBeGreaterThan(0)
    for (const locale of LOCALES) {
      expect(flat(readSideTask(locale)).sort(), locale).toEqual(base)
    }
  })

  it('四态 / aria / 提示 / 位置 / 计数 / 关闭确认 / 声明 / 空态 / ariaLabel 键全齐', () => {
    const required = [
      'title',
      'ariaLabel',
      'ephemeralNotice',
      'empty',
      'cleanedFrom',
      'state.running',
      'state.completed',
      'state.expired',
      'state.cleaned',
      'aria.running',
      'aria.completed',
      'aria.expired',
      'aria.cleaned',
      'hint.expired',
      'hint.cleaned',
      'location.label',
      'location.sameFolder',
      'location.sameEnvironment',
      'files.label',
      'files.changedCount',
      'files.empty',
      'action.close',
      'action.cleanup',
      'closeConfirm.title',
      'closeConfirm.desc',
      'closeConfirm.confirm',
      'closeConfirm.cancel',
    ]
    for (const locale of LOCALES) {
      const keys = flat(readSideTask(locale))
      for (const key of required) expect(keys, `${locale} ${key}`).toContain(key)
    }
  })

  it('所有语言取值非空(不得留空串占位)', () => {
    for (const locale of LOCALES) {
      const walk = (obj: Record<string, unknown>): void => {
        for (const value of Object.values(obj)) {
          if (value && typeof value === 'object') walk(value as Record<string, unknown>)
          else expect(typeof value === 'string' && value.trim().length > 0, `${locale}`).toBe(true)
        }
      }
      walk(readSideTask(locale))
    }
  })

  it('插值占位在五语言里一个不少({title} / {count} / {artifacts} / {children})', () => {
    for (const locale of LOCALES) {
      const node = readSideTask(locale)
      expect(VAL(node, 'cleanedFrom').includes('{title}'), locale).toBe(true)
      expect(VAL(node, 'files.changedCount').includes('{count}'), locale).toBe(true)
      expect(VAL(node, 'closeConfirm.desc').includes('{artifacts}'), locale).toBe(true)
      expect(VAL(node, 'closeConfirm.desc').includes('{children}'), locale).toBe(true)
    }
  })

  it('zh-CN 关键文案与台账原文对齐(防自创措辞)', () => {
    const node = readSideTask('zh-CN')
    // 四态:任务原文「运行中 / 已完成 / 已过期 / 已清理」
    expect(VAL(node, 'state.running')).toBe('运行中')
    expect(VAL(node, 'state.completed')).toBe('已完成')
    expect(VAL(node, 'state.expired')).toBe('已过期')
    expect(VAL(node, 'state.cleaned')).toBe('已清理')
    // 显式声明:临时任务关闭后消失
    expect(VAL(node, 'ephemeralNotice')).toContain('临时任务')
    expect(VAL(node, 'ephemeralNotice')).toContain('消失')
    // 来自已清理的 {标题}
    expect(VAL(node, 'cleanedFrom')).toBe('来自已清理的 {title}')
    // 并行运行位置:同文件夹 / 同环境
    expect(VAL(node, 'location.sameFolder')).toBe('与主任务在同一文件夹')
    expect(VAL(node, 'location.sameEnvironment')).toBe('与主任务在同一运行环境')
    // 计数空态不得是「0」了事
    expect(VAL(node, 'files.empty')).not.toContain('0')
    expect(VAL(node, 'files.empty').length).toBeGreaterThan(4)
  })

  it('ja 里没有简体中文残留,也不是 zh-CN 的复刻', () => {
    const ja = readSideTask('ja')
    const zh = readSideTask('zh-CN')
    // 简体特有字(台账点名的 协作/概览/绑定 及其同族)一律不得出现
    const simplified = ['协', '务', '览', '绑', '临', '时', '关', '闭', '语', '档', '问', '机', '电', '车', '动']
    const flatKeys = flat(ja)
    for (const key of flatKeys) {
      const value = VAL(ja, key)
      for (const ch of simplified) expect(value.includes(ch), `ja ${key} 含简体字 ${ch}`).toBe(false)
    }
    // 除插值键本身(键名/占位相同是刻意的)外,取值必须与 zh-CN 不同
    for (const key of flatKeys) {
      if (key === 'cleanedFrom' || key.startsWith('files.') || key.startsWith('closeConfirm.')) continue
      expect(VAL(ja, key), `ja ${key} 与 zh-CN 同值`).not.toBe(VAL(zh, key))
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
