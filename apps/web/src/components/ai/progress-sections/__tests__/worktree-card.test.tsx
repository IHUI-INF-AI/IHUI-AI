// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  WORKTREE_ACTIONS,
  WORKTREE_HINTS,
  WORKTREE_STATES,
  type WorktreeLifecycleEvent,
  type WorktreeState,
} from '@ihui/shared/chat/worktree-lifecycle'

import { WorktreeCard } from '../worktree-card'

// 只断言**结构与判据**(八态 / 恢复入口 / 磁盘回收入口可见性),文案一律走 key,
// 真实文案覆盖由下面「读真实词包」那组用例守住 —— 组件测试不依赖文案措辞变动。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${JSON.stringify(values)})` : key,
}))

const ev = (
  state: WorktreeState,
  extra: Omit<WorktreeLifecycleEvent, 'state'> = {},
): WorktreeLifecycleEvent => ({ state, ...extra })

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

describe('D72 WorktreeCard / 八态渲染', () => {
  it('八态逐个渲染出对应 data-worktree-state(含极易漏掉的 restoreFailed)', () => {
    for (const state of WORKTREE_STATES) {
      const { container, unmount } = render(<WorktreeCard event={ev(state)} />)
      expect(container.querySelector(`[data-worktree-state="${state}"]`), state).not.toBeNull()
      unmount()
    }
  })

  it('restoreFailed 必须显式渲染:状态标签非空,不得静默留空', () => {
    const { container } = render(<WorktreeCard event={ev('restoreFailed')} />)
    const label = container.querySelector('[data-worktree-state-label="restoreFailed"]')
    expect(label).not.toBeNull()
    expect((label?.textContent ?? '').length).toBeGreaterThan(0)
  })

  it('restored 与 restoreFailed **不同形**(tone 不同,恢复入口不同)', () => {
    const restored = render(<WorktreeCard event={ev('restored')} onAction={() => {}} />)
    const failed = render(<WorktreeCard event={ev('restoreFailed')} onAction={() => {}} />)

    expect(restored.container.querySelector('[data-worktree-state="restored"]')).not.toBeNull()
    expect(failed.container.querySelector('[data-worktree-state="restoreFailed"]')).not.toBeNull()

    const restoredTone = restored.container.querySelector('[data-worktree-state]')?.getAttribute('data-worktree-tone')
    const failedTone = failed.container.querySelector('[data-worktree-state]')?.getAttribute('data-worktree-tone')
    expect(restoredTone).not.toBe(failedTone)

    expect(restored.container.querySelector('[data-action="restore"]')).toBeNull()
    expect(restored.container.querySelector('[data-action="retryRestore"]')).toBeNull()
    expect(failed.container.querySelector('[data-action="retryRestore"]')).not.toBeNull()
    expect(failed.container.querySelector('[data-action="restore"]')).toBeNull()
  })

  it('branch / path / reason 有值才渲染(可选字段缺省不留空壳)', () => {
    const withMeta = render(
      <WorktreeCard
        event={ev('ready', { branch: 'wt/task-1', path: '.worktrees/task-1', reason: 'ok' })}
      />,
    )
    expect(withMeta.container.querySelector('[data-worktree-branch="wt/task-1"]')).not.toBeNull()
    expect(withMeta.container.querySelector('[data-worktree-path=".worktrees/task-1"]')).not.toBeNull()
    expect(withMeta.container.querySelector('[data-worktree-reason="ok"]')).not.toBeNull()

    const bare = render(<WorktreeCard event={ev('ready')} />)
    expect(bare.container.querySelector('[data-worktree-branch]')).toBeNull()
    expect(bare.container.querySelector('[data-worktree-path]')).toBeNull()
    expect(bare.container.querySelector('[data-worktree-reason]')).toBeNull()
  })

  it('无 event 时不崩,且不渲染任何内容', () => {
    let container: HTMLElement | undefined
    expect(() => {
      container = render(<WorktreeCard />).container
    }).not.toThrow()
    expect(container?.firstChild).toBeNull()
  })
})

describe('D72 WorktreeCard / 恢复与回收入口可见性', () => {
  it('timeout 给恢复入口,且必带"请检查仓库状态"提示(不得只显示"超时")', () => {
    const { container } = render(<WorktreeCard event={ev('timeout')} onAction={() => {}} />)
    expect(container.querySelector('[data-action="restore"]')).not.toBeNull()
    expect(container.querySelector('[data-worktree-hint="hint.timeout"]')).not.toBeNull()
  })

  it('cleaned 给恢复入口 + 额外给磁盘回收入口', () => {
    const { container } = render(<WorktreeCard event={ev('cleaned')} onAction={() => {}} />)
    expect(container.querySelector('[data-action="restore"]')).not.toBeNull()
    expect(container.querySelector('[data-action="reclaimDisk"]')).not.toBeNull()
  })

  it('initFailed 给恢复入口,不给磁盘回收入口', () => {
    const { container } = render(<WorktreeCard event={ev('initFailed')} onAction={() => {}} />)
    expect(container.querySelector('[data-action="restore"]')).not.toBeNull()
    expect(container.querySelector('[data-action="reclaimDisk"]')).toBeNull()
  })

  it('ready 提示单写者约束', () => {
    const { container } = render(<WorktreeCard event={ev('ready')} />)
    expect(container.querySelector('[data-worktree-hint="hint.singleWriter"]')).not.toBeNull()
  })

  it('负例:进行中态(creating / restoring)与已就绪(ready)不得出现恢复 / 回收入口', () => {
    for (const state of ['creating', 'restoring', 'ready'] as const) {
      const { container } = render(<WorktreeCard event={ev(state)} onAction={() => {}} />)
      expect(container.querySelector('[data-action="restore"]'), state).toBeNull()
      expect(container.querySelector('[data-action="retryRestore"]'), state).toBeNull()
      expect(container.querySelector('[data-action="reclaimDisk"]'), state).toBeNull()
    }
  })

  it('负例:非 cleaned 态一律不得出现磁盘回收入口(避免误删可控 worktree)', () => {
    for (const state of WORKTREE_STATES) {
      const { container, unmount } = render(<WorktreeCard event={ev(state)} onAction={() => {}} />)
      const reclaim = container.querySelector('[data-action="reclaimDisk"]')
      if (state === 'cleaned') expect(reclaim, state).not.toBeNull()
      else expect(reclaim, state).toBeNull()
      unmount()
    }
  })

  it('不传 onAction → 不渲染动作行(纯展示)', () => {
    const { container } = render(<WorktreeCard event={ev('cleaned')} />)
    expect(container.querySelector('[data-action]')).toBeNull()
  })

  it('动作点击回调带上动作 id', () => {
    const onAction = vi.fn()
    const { container } = render(<WorktreeCard event={ev('cleaned')} onAction={onAction} />)
    ;(container.querySelector('[data-action="reclaimDisk"]') as HTMLButtonElement).click()
    ;(container.querySelector('[data-action="restore"]') as HTMLButtonElement).click()
    ;(container.querySelector('[data-action="dismiss"]') as HTMLButtonElement).click()
    expect(onAction).toHaveBeenCalledWith('reclaimDisk')
    expect(onAction).toHaveBeenCalledWith('restore')
    expect(onAction).toHaveBeenCalledWith('dismiss')
  })
})

describe('D72 词包覆盖(读真实词包,不 mock)', () => {
  const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
    )

  const readWorktree = (locale: string): Record<string, unknown> => {
    const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
    const parsed = JSON.parse(raw) as { ai?: { pane?: { worktree?: Record<string, unknown> } } }
    const node = parsed.ai?.pane?.worktree
    if (!node) throw new Error(`missing ai.pane.worktree in ${locale}.json`)
    return node
  }

  it('五语言键集完全一致(parity)', () => {
    const base = flat(readWorktree('zh-CN')).sort()
    expect(base.length).toBeGreaterThan(0)
    for (const locale of LOCALES) {
      expect(flat(readWorktree(locale)).sort(), locale).toEqual(base)
    }
  })

  it('八态 / 三提示 / 四动作 / title / ariaLabel 键全齐', () => {
    for (const locale of LOCALES) {
      const keys = flat(readWorktree(locale))
      for (const state of WORKTREE_STATES) expect(keys, `${locale} state.${state}`).toContain(`state.${state}`)
      for (const hint of WORKTREE_HINTS) expect(keys, `${locale} hint.${hint}`).toContain(`hint.${hint}`)
      for (const action of WORKTREE_ACTIONS) {
        expect(keys, `${locale} action.${action}`).toContain(`action.${action}`)
      }
      expect(keys, `${locale} title`).toContain('title')
      expect(keys, `${locale} ariaLabel`).toContain('ariaLabel')
    }
  })

  it('所有语言取值非空(不得留空串占位)', () => {
    for (const locale of LOCALES) {
      const entries = flat(readWorktree(locale))
      expect(entries.length).toBeGreaterThan(0)
      const walk = (obj: Record<string, unknown>): void => {
        for (const value of Object.values(obj)) {
          if (value && typeof value === 'object') walk(value as Record<string, unknown>)
          else expect(typeof value === 'string' && value.trim().length > 0, `${locale}`).toBe(true)
        }
      }
      walk(readWorktree(locale))
    }
  })

  it('zh-CN 关键文案与台账原文逐字一致(防自创措辞)', () => {
    const node = readWorktree('zh-CN') as {
      state: Record<string, string>
      hint: Record<string, string>
    }
    // cleaned 文案 = 台账 D72 原文
    expect(node.state.cleaned).toBe('此任务的 Worktree 已被清理以释放磁盘空间。')
    // timeout 必须带"请检查仓库状态"
    expect(node.hint.timeout).toBe('请检查仓库状态')
    expect(node.state.creating).toBe('创建中')
    expect(node.state.ready).toBe('已创建')
    expect(node.state.initFailed).toBe('初始化失败')
    expect(node.state.timeout).toBe('超时')
    expect(node.state.restoring).toBe('恢复中')
    expect(node.state.restored).toBe('已恢复')
    expect(node.state.restoreFailed).toBe('无法恢复')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
