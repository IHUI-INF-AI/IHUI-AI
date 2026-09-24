// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D102 移交弹层测试(G-140)。只断言**结构与判据**(data-* 判据,文案一律走 key),
// 真实文案由「读真实词包」那组用例守住(五语言 parity + zh-CN 逐字 + ja 无简体残留)。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import React from 'react'

import { MOVE_TO_WORKTREE_KEYS } from '@ihui/shared/chat/move-to-worktree'

import { MoveToWorktreeDialog } from '../move-to-worktree-dialog'

const translate = (key: string, values?: Record<string, unknown>) =>
  values ? `${key}(${JSON.stringify(values, (_k, v) => (typeof v === 'function' ? '<fn>' : v))})` : key
;(translate as unknown as { rich: typeof translate }).rich = translate

vi.mock('next-intl', () => ({
  useTranslations: () => translate,
}))

// @ihui/ui-react 轻量替身:Dialog 直接按 open 条件挂载,无需 Radix portal(同 task-detail-dialog 范式)
vi.mock('@ihui/ui-react', () => {
  const Div = (props: React.ComponentProps<'div'>) => <div {...props} />
  return {
    Dialog: ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
      open ? <div>{children}</div> : null,
    DialogContent: Div,
    DialogHeader: Div,
    DialogTitle: Div,
    DialogDescription: Div,
    DialogFooter: Div,
    Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  }
})

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

const baseProps = {
  open: true,
  branchName: 'feat/main',
  defaultBranch: 'main',
  localBranches: ['feat/a', 'feat/b'],
  onClose: () => {},
}

const q = (container: HTMLElement, sel: string) => container.querySelector(sel)

describe('D102 MoveToWorktreeDialog / 结构与判据', () => {
  it('open=false 渲染 null;open=true 出标题与 continue(动词键,独立于 cancel)', () => {
    const closed = render(<MoveToWorktreeDialog {...baseProps} open={false} />)
    expect(closed.container.firstElementChild).toBeNull()

    const { container } = render(<MoveToWorktreeDialog {...baseProps} />)
    expect(q(container, '[data-slot="title"]')?.textContent).toBe('title')
    const cont = q(container, '[data-action="continue"]')
    expect(cont?.textContent).toBe('continue')
    expect(q(container, '[data-action="cancel"]')?.textContent).toBe('cancel')
    // 副标题富文本:插值分支名在位(data-branch 判据)
    expect(q(container, '[data-slot="subtitle"]')?.getAttribute('data-branch')).toBe('feat/main')
  })

  it('两目标选项齐备,点击切换 data-target(createNew ⇄ existing)', () => {
    const { container } = render(<MoveToWorktreeDialog {...baseProps} />)
    expect(q(container, '[data-target-option="createNew"]')).not.toBeNull()
    expect(q(container, '[data-target-option="existing"]')).not.toBeNull()
    const root = q(container, '[data-testid="move-to-worktree-dialog"]')
    expect(root?.getAttribute('data-target')).toBe('createNew')
    fireEvent.click(q(container, '[data-target-option="existing"]') as HTMLElement)
    expect(root?.getAttribute('data-target')).toBe('existing')
    fireEvent.click(q(container, '[data-target-option="createNew"]') as HTMLElement)
    expect(root?.getAttribute('data-target')).toBe('createNew')
  })

  it('ariaLabel 在位:分支输入框带 worktreeBranchAriaLabel 键的 aria-label', () => {
    const { container } = render(<MoveToWorktreeDialog {...baseProps} />)
    const input = q(container, '[data-slot="branch-input"]')
    expect(input?.getAttribute('aria-label')).toBe('worktreeBranchAriaLabel')
  })

  it('四条校验错误逐条渲染(data-branch-error 判据;required 由 continue 门兜住)', () => {
    const { container } = render(
      <MoveToWorktreeDialog {...baseProps} existingWorktreeBranches={['wt/dup']} />,
    )
    const root = q(container, '[data-testid="move-to-worktree-dialog"]')
    const input = q(container, '[data-slot="branch-input"]') as HTMLInputElement

    // required:空输入不即时报错,但 continue 禁用
    expect(q(container, '[data-branch-error]')).toBeNull()
    expect(root?.getAttribute('data-can-continue')).toBe('false')

    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    const fire = (v: string) => {
      set.call(input, v)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }

    fire('wt/')
    expect(q(container, '[data-branch-error="trailingSlashError"]')).not.toBeNull()
    fire('main')
    expect(q(container, '[data-branch-error="defaultBranchError"]')).not.toBeNull()
    fire('wt/dup')
    expect(q(container, '[data-branch-error="branchAlreadyExists"]')).not.toBeNull()
    fire('feat/ok')
    expect(q(container, '[data-branch-error]')).toBeNull()
    expect(root?.getAttribute('data-can-continue')).toBe('true')
  })

  it('运行中禁止态:turn 活跃 → existingWorktreeRunning 在位 + continue 禁用;终态恢复', () => {
    const running = render(<MoveToWorktreeDialog {...baseProps} turnState="thinking" />)
    expect(q(running.container, '[data-block="existingWorktreeRunning"]')).not.toBeNull()
    expect((q(running.container, '[data-action="continue"]') as HTMLButtonElement).disabled).toBe(true)

    const done = render(<MoveToWorktreeDialog {...baseProps} turnState="completed" />)
    expect(q(done.container, '[data-block="existingWorktreeRunning"]')).toBeNull()
    // 终态 + 合法分支名 ⇒ continue 可用(运行中是唯一硬闸,这里排除 required 干扰)
    const input = q(done.container, '[data-slot="branch-input"]') as HTMLInputElement
    fireEvent.input(input, { target: { value: 'feat/ok' } })
    expect((q(done.container, '[data-action="continue"]') as HTMLButtonElement).disabled).toBe(false)
  })

  it('前置检查三态:loading 行 / error+重试入口 / ready+空态 noTargetBranch / ready+可选分支', () => {
    const loading = render(<MoveToWorktreeDialog {...baseProps} precheck="loading" />)
    expect(q(loading.container, '[data-precheck-line="loading"]')).not.toBeNull()
    expect(q(loading.container, '[data-branches-status="branchesLoading"]')).not.toBeNull()

    const error = render(
      <MoveToWorktreeDialog {...baseProps} precheck="error" onRetry={() => {}} />,
    )
    expect(q(error.container, '[data-branches-status="branchesError"]')).not.toBeNull()
    expect(q(error.container, '[data-action="retry"]')).not.toBeNull()

    const empty = render(<MoveToWorktreeDialog {...baseProps} localBranches={[]} />)
    expect(q(empty.container, '[data-empty="noTargetBranch"]')).not.toBeNull()

    const ready = render(<MoveToWorktreeDialog {...baseProps} />)
    expect(q(ready.container, '[data-slot="local-branch-select"]')).not.toBeNull()
    expect(ready.container.querySelectorAll('[data-slot="local-branch-select"] option').length).toBe(3)
  })

  it('提交:校验通过点击 continue 回调 (target, branch);existing 目标选中分支后移交', () => {
    const onSubmit = vi.fn()
    const { container } = render(<MoveToWorktreeDialog {...baseProps} onSubmit={onSubmit} />)
    const input = q(container, '[data-slot="branch-input"]') as HTMLInputElement
    fireEvent.input(input, { target: { value: 'feat/next' } })
    fireEvent.click(q(container, '[data-action="continue"]') as HTMLElement)
    expect(onSubmit).toHaveBeenCalledWith('createNew', 'feat/next')

    const onSubmit2 = vi.fn()
    const { container: c2 } = render(
      <MoveToWorktreeDialog
        {...baseProps}
        onSubmit={onSubmit2}
        existingWorktreeBranches={['wt/one', 'wt/two']}
      />,
    )
    fireEvent.click(q(c2, '[data-target-option="existing"]') as HTMLElement)
    fireEvent.click(q(c2, '[data-existing-branch="wt/two"]') as HTMLElement)
    fireEvent.click(q(c2, '[data-action="continue"]') as HTMLElement)
    expect(onSubmit2).toHaveBeenCalledWith('existing', 'wt/two')
  })

  it('cancel 点击回调 onClose', () => {
    const onClose = vi.fn()
    const { container } = render(<MoveToWorktreeDialog {...baseProps} onClose={onClose} />)
    fireEvent.click(q(container, '[data-action="cancel"]') as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('D102 词包覆盖(读真实词包,不 mock)', () => {
  const readNode = (locale: string): Record<string, string> => {
    const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
    const parsed = JSON.parse(raw) as { ai?: { pane?: { moveToWorktree?: Record<string, string> } } }
    const node = parsed.ai?.pane?.moveToWorktree
    if (!node) throw new Error(`missing ai.pane.moveToWorktree in ${locale}.json`)
    return node
  }

  it('五语言键集 = MOVE_TO_WORKTREE_KEYS(21 键 parity)', () => {
    const expected = [...MOVE_TO_WORKTREE_KEYS].sort()
    for (const locale of LOCALES) {
      expect(Object.keys(readNode(locale)).sort(), locale).toEqual(expected)
    }
  })

  it('所有语言取值非空(不得留空串占位)', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(readNode(locale))) {
        expect(typeof value === 'string' && value.trim().length > 0, `${locale}.${key}`).toBe(true)
      }
    }
  })

  it('zh-CN 关键文案与任务原文逐字一致(continue 是动词"移交",不是"确定")', () => {
    const node = readNode('zh-CN')
    expect(node.title).toBe('将对话移交至工作树')
    expect(node.subtitle).toBe('在新工作树中检出分支 <branch>{branchName}</branch>，以继续并行工作。')
    expect(node.continue).toBe('移交')
    expect(node.continue).not.toBe('确定')
    expect(node.loading).toBe('正在检查能否移交…')
    expect(node.existingWorktreeRunning).toBe('请等待当前回复完成后再移动此聊天')
    expect(node.existingWorktreeLabel).toBe('已有工作树')
    expect(node.localCheckoutLabel).toBe('本地工作空间将切换至')
    expect(node.localBranchPlaceholder).toBe('选择本地检出分支')
    expect(node.noTargetBranch).toBe('没有其他本地分支可用')
    expect(node.defaultBranchError).toBe('工作树分支必须不同于默认分支。')
    expect(node.trailingSlashError).toBe('分支名不能以"/"结尾。')
  })

  it('ja 不得残留简体中文专用字(协/览/绑/检/树/态/设/变/续/试/误/载/确/进/选/对/场)', () => {
    const simplifiedOnly = ['协', '览', '绑', '检', '树', '态', '设', '变', '续', '试', '误', '载', '确', '进', '选', '对', '场']
    for (const [key, value] of Object.entries(readNode('ja'))) {
      for (const ch of simplifiedOnly) {
        expect(value.includes(ch), `ja.${key} contains "${ch}"`).toBe(false)
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
