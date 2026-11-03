// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// PLACEHOLDER

// @vitest-environment jsdom
/**
 * D07 残余② 验收用例(2026-10-24):
 *   - 未确认 ⇒ 不发请求、不写盘
 *   - 生成只取草稿(绝不带 output_path),写入前需第二次确认
 *   - 生成失败 / 写盘失败(含无 DirectoryHandle)必须 role=alert 可见
 *
 * D07 文案迁移后:断言一律按 `ide.agentsMd.*` 词包取值,不再引用端内常量。
 * 词包取材面 = 工作树 JSON;缺键/render 阶段即抛错,不静默 fallback。
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { render, fireEvent, cleanup } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  save: vi.fn(),
  fetch: vi.fn(),
}))

vi.mock('@/components/feedback', () => ({
  confirmDialog: mocks.confirm,
}))
vi.mock('@/lib/workspace-file-save', () => ({
  saveWorkspaceTextFile: mocks.save,
}))
vi.mock('@ihui/api-client', () => ({
  fetchAiServiceJson: mocks.fetch,
}))

import { AgentsMdGenerator } from '../agents-md-generator'
import { AGENTS_MD_FILENAME } from '@/lib/agents-md-init'

const messages = JSON.parse(
  readFileSync(resolve(process.cwd(), '../../packages/i18n/messages/web/zh-CN.json'), 'utf-8'),
) as { ide: { agentsMd: Record<string, string> } }

const pack = messages.ide.agentsMd

function k(key: string): string {
  const value = pack[key]
  if (typeof value !== 'string') throw new Error(`词包缺键 ide.agentsMd.${key}`)
  return value
}

const DRAFT = '# AGENTS.md\n\n## 构建\n\n- pnpm build\n'

function renderGenerator() {
  return render(
    <NextIntlClientProvider locale="zh-CN" messages={{ ide: { agentsMd: pack } }}>
      <AgentsMdGenerator workspacePath="/ws" />
    </NextIntlClientProvider>,
  )
}

async function generateDraft(ui: ReturnType<typeof renderGenerator>) {
  fireEvent.click(ui.getByRole('button', { name: k('generate') }))
  return ui.findByLabelText(k('draftTitle'))
}

describe('AgentsMdGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => cleanup())

  it('未确认不生成、不写盘(连请求都不发)', async () => {
    mocks.confirm.mockResolvedValue(false)
    const ui = renderGenerator()
    fireEvent.click(ui.getByRole('button', { name: k('generate') }))
    await Promise.resolve()
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
    expect(ui.queryByLabelText(k('draftTitle'))).toBeNull()
    expect(ui.queryByRole('alert')).toBeNull()
  })

  it('确认后只取草稿:不带 output_path,且不自动写盘', async () => {
    mocks.confirm.mockResolvedValue(true)
    mocks.fetch.mockResolvedValue({ success: true, data: { ok: true, draft: DRAFT } })
    const ui = renderGenerator()
    const textarea = (await generateDraft(ui)) as HTMLTextAreaElement
    expect(textarea.value).toBe(DRAFT)

    const [url, init] = mocks.fetch.mock.calls[0] as [string, { body: string }]
    expect(url).toBe('/api/tools/init-agents-md')
    const body = JSON.parse(init.body) as Record<string, unknown>
    expect(body).toEqual({ workspace_root: '/ws' })
    expect('output_path' in body).toBe(false)
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('写盘需第二次确认:取消 ⇒ 不写盘且草稿保留', async () => {
    mocks.confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    mocks.fetch.mockResolvedValue({ success: true, data: { ok: true, draft: DRAFT } })
    const ui = renderGenerator()
    await generateDraft(ui)

    fireEvent.click(ui.getByRole('button', { name: k('write') }))
    await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(2))
    expect(mocks.save).not.toHaveBeenCalled()
    expect(ui.queryByLabelText(k('draftTitle'))).not.toBeNull()
  })

  it('写盘失败(无 DirectoryHandle)必须可见,不得伪报成功', async () => {
    const reason = '当前工作区未授权本地文件写入(缺少 DirectoryHandle)'
    mocks.confirm.mockResolvedValue(true)
    mocks.fetch.mockResolvedValue({ success: true, data: { ok: true, draft: DRAFT } })
    mocks.save.mockResolvedValue({ ok: false, reason: 'no-handle', message: reason })
    const ui = renderGenerator()
    await generateDraft(ui)

    fireEvent.click(ui.getByRole('button', { name: k('write') }))
    const alert = await ui.findByRole('alert')
    expect(alert.textContent).toContain(k('writeFailed'))
    expect(alert.textContent).toContain(reason)
    expect(ui.queryByText(k('written'))).toBeNull()
    expect(mocks.save).toHaveBeenCalledWith(AGENTS_MD_FILENAME, DRAFT)
    // 失败后草稿仍在,允许用户重试
    expect(ui.queryByLabelText(k('draftTitle'))).not.toBeNull()
  })

  it('写盘成功后才显示已写入', async () => {
    mocks.confirm.mockResolvedValue(true)
    mocks.fetch.mockResolvedValue({ success: true, data: { ok: true, draft: DRAFT } })
    mocks.save.mockResolvedValue({ ok: true, bytes: DRAFT.length })
    const ui = renderGenerator()
    await generateDraft(ui)

    fireEvent.click(ui.getByRole('button', { name: k('write') }))
    expect(await ui.findByText(k('written'))).not.toBeNull()
    expect(ui.queryByLabelText(k('draftTitle'))).toBeNull()
  })

  it('生成失败(工具 ok=false)必须可见原因', async () => {
    mocks.confirm.mockResolvedValue(true)
    mocks.fetch.mockResolvedValue({
      success: true,
      data: { ok: false, errorCode: 'WORKSPACE_NOT_FOUND', message: '工作区目录不存在: /nope' },
    })
    const ui = renderGenerator()
    fireEvent.click(ui.getByRole('button', { name: k('generate') }))
    const alert = await ui.findByRole('alert')
    expect(alert.textContent).toContain(k('generateFailed'))
    expect(alert.textContent).toContain('工作区目录不存在: /nope')
    expect(ui.queryByLabelText(k('draftTitle'))).toBeNull()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('空工作区路径:兜底错误串取自词包,且不发请求', async () => {
    mocks.confirm.mockResolvedValue(true)
    const ui = render(
      <NextIntlClientProvider locale="zh-CN" messages={{ ide: { agentsMd: pack } }}>
        <AgentsMdGenerator workspacePath="  " />
      </NextIntlClientProvider>,
    )
    fireEvent.click(ui.getByRole('button', { name: k('generate') }))
    const alert = await ui.findByRole('alert')
    expect(alert.textContent).toContain(k('generateFailed'))
    expect(alert.textContent).toContain(k('errorEmptyWorkspace'))
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('工具未返回草稿:兜底错误串取自词包', async () => {
    mocks.confirm.mockResolvedValue(true)
    mocks.fetch.mockResolvedValue({ success: true, data: { ok: false } })
    const ui = renderGenerator()
    fireEvent.click(ui.getByRole('button', { name: k('generate') }))
    const alert = await ui.findByRole('alert')
    expect(alert.textContent).toContain(k('generateFailed'))
    expect(alert.textContent).toContain(k('errorNoDraft'))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
