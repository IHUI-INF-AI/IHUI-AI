// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D89 输入源三小卡 —— 组件测试。
// 上组:只断言**结构与判据**(data-*,文案走 key,mock next-intl,同 D72 worktree-card 范式);
// 下组:读真实词包,断言五语言键集一致 + zh-CN 逐字 + 同批键存活 + ja 无简体残留。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  SNAPSHOT_STATES,
  UNDO_RESTORE_PHASES,
  type SnapshotState,
  type UndoRestorePhase,
} from '@ihui/shared/chat/input-sources'

import { MemoryRefCard, QueueCommandCard, SnapshotSourceCard } from '../input-source-cards'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${JSON.stringify(values)})` : key,
}))

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

describe('D89 ① SnapshotSourceCard / 三态渲染', () => {
  it('三态逐个渲染出对应 data-snapshot-state(含极易漏掉的 failed)', () => {
    for (const state of SNAPSHOT_STATES) {
      const { container, unmount } = render(<SnapshotSourceCard state={state} />)
      expect(container.querySelector(`[data-snapshot-state="${state}"]`), state).not.toBeNull()
      unmount()
    }
  })

  it('disabled 给启用动作,enabled 不给(避免二次点击歧义)', () => {
    const off = render(<SnapshotSourceCard state="disabled" onToggle={() => {}} />)
    expect(off.container.querySelector('[data-action="enable"]')).not.toBeNull()
    const on = render(<SnapshotSourceCard state="enabled" onToggle={() => {}} />)
    expect(on.container.querySelector('[data-action="enable"]')).toBeNull()
  })

  it('failed 必须显式渲染失败说明(hint 非空,不得静默留空)+ 启用(重试)入口', () => {
    const { container } = render(<SnapshotSourceCard state="failed" onToggle={() => {}} />)
    const hint = container.querySelector('[data-snapshot-hint="failedHint"]')
    expect(hint).not.toBeNull()
    expect((hint?.textContent ?? '').length).toBeGreaterThan(0)
    expect(container.querySelector('[data-action="enable"]')).not.toBeNull()
  })

  it('首用引导只出一次:enabled+未引导 ⇒ 有引导;引导过 ⇒ 无;失败/未启用 ⇒ 无', () => {
    const first = render(<SnapshotSourceCard state="enabled" guidedBefore={false} />)
    expect(first.container.querySelector('[data-snapshot-guide="first-run"]')).not.toBeNull()
    const again = render(<SnapshotSourceCard state="enabled" guidedBefore={true} />)
    expect(again.container.querySelector('[data-snapshot-guide]')).toBeNull()
    for (const state of ['disabled', 'failed'] as const) {
      const { container, unmount } = render(<SnapshotSourceCard state={state} guidedBefore={false} />)
      expect(container.querySelector('[data-snapshot-guide]'), state).toBeNull()
      unmount()
    }
  })

  it('「附加 {appName}」:有应用名才渲染(带插值),空名不渲染空壳', () => {
    const withApp = render(<SnapshotSourceCard state="enabled" appName="IHUI 桌面端" />)
    const node = withApp.container.querySelector('[data-snapshot-app="IHUI 桌面端"]')
    expect(node).not.toBeNull()
    expect(node?.textContent).toContain('attachApp')
    const noApp = render(<SnapshotSourceCard state="enabled" />)
    expect(noApp.container.querySelector('[data-snapshot-app]')).toBeNull()
  })

  it('不传 onToggle → 不渲染动作按钮(纯展示)', () => {
    const { container } = render(<SnapshotSourceCard state="disabled" />)
    expect(container.querySelector('[data-action]')).toBeNull()
  })
})

describe('D89 ② QueueCommandCard / 命令化 + Undo 三态', () => {
  it('两命令项都渲染,semantic 与判定层一致', () => {
    const { container } = render(<QueueCommandCard onCommand={() => {}} />)
    const queue = container.querySelector('[data-command="queuePrompt"]')
    const steer = container.querySelector('[data-command="steerPrompt"]')
    expect(queue).not.toBeNull()
    expect(steer).not.toBeNull()
    expect(queue?.getAttribute('data-command-semantic')).toBe('w27-pending')
    expect(steer?.getAttribute('data-command-semantic')).toBe('steer')
    expect(container.querySelector('[data-command-label="queuePrompt"]')).not.toBeNull()
    expect(container.querySelector('[data-command-label="steerPrompt"]')).not.toBeNull()
  })

  it('Undo 三态逐个渲染(data-undo-phase),缺省不渲染 Undo 行', () => {
    for (const phase of UNDO_RESTORE_PHASES) {
      const { container, unmount } = render(<QueueCommandCard undoPhase={phase} />)
      expect(container.querySelector(`[data-undo-phase="${phase}"]`), phase).not.toBeNull()
      unmount()
    }
    const bare = render(<QueueCommandCard />)
    expect(bare.container.querySelector('[data-undo-phase]')).toBeNull()
  })

  it('restored 双变体渲染不同文案键(队列/排队 同族两条)', () => {
    const q = render(<QueueCommandCard undoPhase="restored" undoVariant="queue" />)
    expect(q.container.querySelector('[data-undo-label="undo.restored"]')).not.toBeNull()
    const queued = render(<QueueCommandCard undoPhase="restored" undoVariant="queued" />)
    expect(queued.container.querySelector('[data-undo-label="undo.restoredQueued"]')).not.toBeNull()
  })

  it('命令回调带命令 id;不传 onCommand → 命令禁用且不触发', () => {
    const onCommand = vi.fn()
    const { container } = render(<QueueCommandCard onCommand={onCommand} />)
    ;(container.querySelector('[data-command="queuePrompt"]') as HTMLButtonElement).click()
    ;(container.querySelector('[data-command="steerPrompt"]') as HTMLButtonElement).click()
    expect(onCommand).toHaveBeenCalledWith('queuePrompt')
    expect(onCommand).toHaveBeenCalledWith('steerPrompt')

    const readonly = render(<QueueCommandCard />)
    const btn = readonly.container.querySelector('[data-command="queuePrompt"]') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })
})

describe('D89 ③ MemoryRefCard / 计数空态 + goal 耗时', () => {
  it('count=0 → 空态(data-memory-ref-empty=true),不显示「0 条」计数键', () => {
    const { container } = render(<MemoryRefCard count={0} />)
    const node = container.querySelector('[data-memory-ref-count="0"]')
    expect(node).not.toBeNull()
    expect(node?.getAttribute('data-memory-ref-empty')).toBe('true')
    expect(node?.textContent).toContain('memoryRefs.empty')
  })

  it('count>0 → 计数键 + tooltip(title=「引用的记忆」键)', () => {
    const { container } = render(<MemoryRefCard count={5} />)
    const node = container.querySelector('[data-memory-ref-count="5"]')
    expect(node).not.toBeNull()
    expect(node?.getAttribute('data-memory-ref-empty')).toBe('false')
    expect(node?.getAttribute('title')).toContain('memoryRefs.tooltip')
    expect(node?.textContent).toContain('memoryRefs.count')
  })

  it('不传 totalTimeMs → 不渲染 goal 耗时行;传了 → 渲染并带插值', () => {
    const bare = render(<MemoryRefCard count={3} />)
    expect(bare.container.querySelector('[data-goal-achieved]')).toBeNull()
    const withGoal = render(<MemoryRefCard count={3} totalTimeMs={9_000_000} />)
    const goal = withGoal.container.querySelector('[data-goal-achieved="goal.achievedIn"]')
    expect(goal).not.toBeNull()
    expect(goal?.textContent).toContain('2小时30分')
  })
})

// ---------------------------------------------------------------------------
// 词包覆盖(读真实词包,不 mock)
// ---------------------------------------------------------------------------

describe('D89 词包覆盖 / ai.pane.inputSources', () => {
  const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
    )

  const readPane = (locale: string): Record<string, unknown> => {
    const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
    const parsed = JSON.parse(raw) as { ai?: { pane?: Record<string, unknown> } }
    const node = parsed.ai?.pane
    if (!node) throw new Error(`missing ai.pane in ${locale}.json`)
    return node
  }

  const readSources = (locale: string): Record<string, unknown> => {
    const node = readPane(locale).inputSources
    if (!node) throw new Error(`missing ai.pane.inputSources in ${locale}.json`)
    return node as Record<string, unknown>
  }

  it('五语言键集完全一致(parity)', () => {
    const base = flat(readSources('zh-CN')).sort()
    expect(base.length).toBeGreaterThan(0)
    for (const locale of LOCALES) {
      expect(flat(readSources(locale)).sort(), locale).toEqual(base)
    }
  })

  it('三段键全齐(快照三态/首用引导/附加/分流,两命令+描述,Undo 四键,计数+tooltip+空态,goal 耗时)', () => {
    const required = [
      'ariaLabel',
      'snapshot.attachApp',
      'snapshot.state.disabled',
      'snapshot.state.enabled',
      'snapshot.state.failed',
      'snapshot.enable',
      'snapshot.firstRunGuideTitle',
      'snapshot.firstRunGuideBody',
      'snapshot.failedHint',
      'route.appSnapshot',
      'route.remoteFile',
      'route.remotePhoto',
      'command.queuePrompt',
      'command.queuePromptDesc',
      'command.steerPrompt',
      'command.steerPromptDesc',
      'undo.restoring',
      'undo.restored',
      'undo.restoredQueued',
      'undo.failed',
      'memoryRefs.count',
      'memoryRefs.tooltip',
      'memoryRefs.empty',
      'goal.achievedIn',
    ]
    for (const locale of LOCALES) {
      const keys = flat(readSources(locale))
      for (const key of required) {
        expect(keys, `${locale} ${key}`).toContain(key)
      }
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
      walk(readSources(locale))
    }
  })

  it('zh-CN 关键文案与台账原文逐字一致(防自创措辞)', () => {
    const node = readSources('zh-CN') as Record<string, never>
    const get = (path: string): string =>
      path.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], node) as string
    // ① 智能快照
    expect(get('snapshot.attachApp')).toBe('附加 {appName}')
    expect(get('snapshot.enable')).toBe('启用智能快照')
    // ② 队列命令化 + Undo(判据原文同族两条)
    expect(get('command.queuePrompt')).toBe('将提示加入队列')
    expect(get('command.steerPrompt')).toBe('引导提示')
    expect(get('undo.restored')).toBe('已恢复队列中的消息')
    expect(get('undo.restoredQueued')).toBe('已恢复排队的消息')
    // ③ 记忆引用 + goal 耗时
    expect(get('memoryRefs.count')).toBe('{count} 条记忆引用')
    expect(get('memoryRefs.tooltip')).toBe('引用的记忆')
    expect(get('goal.achievedIn')).toBe('已在 {totalTime} 内达成目标')
  })

  it('同批键存活:ai.pane.inputNotices / voiceSubtitles / quotaOwnership 仍在(并行写入互不冲掉)', () => {
    for (const locale of LOCALES) {
      const pane = readPane(locale)
      for (const key of ['inputNotices', 'voiceSubtitles', 'quotaOwnership']) {
        expect(pane[key], `${locale} ai.pane.${key}`).toBeDefined()
      }
    }
  })

  it('ja 无简体中文残留(协作/概览/绑定 等词不得出现)', () => {
    const raw = JSON.stringify(readSources('ja'))
    for (const word of ['协作', '概览', '绑定', '队列', '恢复', '记录', '设置']) {
      expect(raw.includes(word), `ja 词包不得出现简体词「${word}」`).toBe(false)
    }
  })
})
// ⁠[tail-watermark-placeholder]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
