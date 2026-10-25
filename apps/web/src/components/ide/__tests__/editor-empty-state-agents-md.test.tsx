// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * D118 落点② 验收用例(2026-10-25):编辑器空态的「一键生成 AGENTS.md」入口。
 *   ① 空 AGENTS.md(无文件 / 读不到 / 内容为空)⇒ 显示入口;非空 ⇒ 隐藏
 *   ② 点击生成 ⇓ 草稿进可编辑文本域
 *   ③ 保存前不写盘(未调用写接口)
 *
 * 空态判定必须走**真实读取**:只按文件树里有没有这个名字判,会把空文件误当已有约定。
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  save: vi.fn(),
  fetchDraft: vi.fn(),
  readFile: vi.fn(),
  prompt: vi.fn(),
}))

vi.mock('@/components/feedback', () => ({
  confirmDialog: mocks.confirm,
}))
vi.mock('@/lib/workspace-file-save', () => ({
  saveWorkspaceTextFile: mocks.save,
}))
vi.mock('@/hooks/use-confirm', () => ({
  usePrompt: () => ({ prompt: mocks.prompt, PromptDialogRenderer: () => null }),
}))
// store 的 fetchFileContent 走 @ihui/api-client 的 readFile;草稿生成走 fetchAiServiceJson。
vi.mock('@ihui/api-client', () => ({
  fetchAiServiceJson: mocks.fetchDraft,
  readFile: mocks.readFile,
  browseDirectory: vi.fn(),
  runCommand: vi.fn(),
}))

import { EditorEmptyState } from '../editor-empty-state'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import type { FileNode } from '@ihui/types'

const messages = JSON.parse(
  readFileSync(resolve(process.cwd(), '../../packages/i18n/messages/web/zh-CN.json'), 'utf-8'),
) as {
  ide: { agentsMd: Record<string, string>; editorEmpty: Record<string, string> }
  common: Record<string, string>
}

const pack = messages.ide.agentsMd

function k(key: string): string {
  const value = pack[key]
  if (typeof value !== 'string') throw new Error(`词包缺键 ide.agentsMd.${key}`)
  return value
}

const DRAFT = '# AGENTS.md\n\n## 构建\n\n- pnpm build\n'

const AGENTS_MD_NODE: FileNode = {
  id: '/ws/AGENTS.md',
  name: 'AGENTS.md',
  path: '/ws/AGENTS.md',
  type: 'file',
  language: 'markdown',
}

function renderEmptyState() {
  return render(
    <NextIntlClientProvider
      locale="zh-CN"
      messages={{ ide: messages.ide, common: messages.common }}
    >
      <EditorEmptyState />
    </NextIntlClientProvider>,
  )
}

function readReturns(content: string) {
  mocks.readFile.mockResolvedValue({
    success: true,
    data: { content, lines: content.split('\n').length, path: AGENTS_MD_NODE.path },
  })
}

describe('EditorEmptyState · AGENTS.md 空态入口', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useIDEWorkspace.setState({
      workspacePath: '/ws',
      fileTree: [],
      openTabs: [],
      loading: false,
      error: null,
    })
  })
  afterEach(() => cleanup())

  it('① 工作区没有 AGENTS.md ⇒ 显示一键生成入口', () => {
    const ui = renderEmptyState()
    expect(ui.getByRole('button', { name: k('generate') })).not.toBeNull()
    expect(mocks.readFile).not.toHaveBeenCalled()
  })

  it('① AGENTS.md 存在但读不到 ⇒ 仍显示入口(拿不到文件按空态处理)', async () => {
    useIDEWorkspace.setState({ fileTree: [AGENTS_MD_NODE] })
    mocks.readFile.mockResolvedValue({ success: false, error: 'ENOENT' })
    const ui = renderEmptyState()

    await waitFor(() =>
      expect(mocks.readFile).toHaveBeenCalledWith({
        path: '/ws/AGENTS.md',
        workspacePath: '/ws',
      }),
    )
    expect(ui.getByRole('button', { name: k('generate') })).not.toBeNull()
  })

  it('① AGENTS.md 内容为空 ⇒ 显示入口', async () => {
    useIDEWorkspace.setState({ fileTree: [AGENTS_MD_NODE] })
    readReturns('   \n\n')
    const ui = renderEmptyState()

    await waitFor(() => expect(mocks.readFile).toHaveBeenCalledTimes(1))
    expect(ui.getByRole('button', { name: k('generate') })).not.toBeNull()
  })

  it('① AGENTS.md 内容非空 ⇒ 隐藏入口', async () => {
    useIDEWorkspace.setState({ fileTree: [AGENTS_MD_NODE] })
    readReturns('# AGENTS.md\n\n## 约定\n\n- 已有规则\n')
    const ui = renderEmptyState()

    await waitFor(() => expect(mocks.readFile).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(ui.queryByRole('button', { name: k('generate') })).toBeNull())
  })

  it('②③ 点击生成:草稿进可编辑文本域,且保存前不写盘', async () => {
    mocks.confirm.mockResolvedValue(true)
    mocks.fetchDraft.mockResolvedValue({ success: true, data: { ok: true, draft: DRAFT } })
    const ui = renderEmptyState()

    fireEvent.click(ui.getByRole('button', { name: k('generate') }))
    const textarea = (await ui.findByLabelText(k('draftTitle'))) as HTMLTextAreaElement

    expect(textarea.value).toBe(DRAFT)

    const [url, init] = mocks.fetchDraft.mock.calls[0] as [string, { body: string }]
    expect(url).toBe('/api/tools/init-agents-md')
    expect(JSON.parse(init.body)).toEqual({ workspace_root: '/ws' })
    expect(mocks.save).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
