// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D185「能力引用模拟预览编辑器」装车证明(2026-09-30 立,对标竞品 composer.referencePreview.*)。
// 竞品串:available=模拟能力可用 / editor=能力引用输入框 / placeholder=粘贴完整引用或输入 @名称… /
//   send=发送预览 / select=选择示例能力 / clear=新建输入 / source=原始输入正文;
// 例外行 authorization 判 FALSE —— 复用 D68 既有 unifiedSuggestion.authorizationNotice,不另立第二套键。
// 对账三面:
//   ① 叶子:UnifiedPasteReferencePreview 不传 onSend 保持 D68 被动预览条(零回归);
//     传 onSend 升级为可编辑模拟预览编辑器(徽章/编辑框/原始输入正文/选择/新建/发送/授权声明)。
//   ② 行为:草稿预填原始输入正文 → 编辑 → 发送回调携带编辑后文本并撤收;select 追加示例能力
//     token;clear 清空后空草稿 send 禁用。
//   ③ 容器:ContextChipsRow 的 onSendPastePreview 透传至叶子(本容器只透传不持有文本)。

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// 本仓测试环境未开 RTL 全局 auto-cleanup,此处显式收尾防跨用例 DOM 串染
afterEach(cleanup)

import { ContextChipsRow } from '../context-chips-row'
import {
  UnifiedPasteReferencePreview,
  type UnifiedPasteReferencePreviewProps,
} from '../unified-suggestion-panel'
import type { PastedReferencePreview } from '../unified-suggestion-sources'

const PREVIEWS: PastedReferencePreview[] = [
  { raw: '@src/a.ts', normalized: 'src/a.ts', recognized: true },
  { raw: '@nope', normalized: 'nope', recognized: false },
]

function renderLeaf(overrides: Partial<UnifiedPasteReferencePreviewProps> = {}) {
  const onDismiss = vi.fn()
  const onSend = vi.fn()
  const utils = render(
    <UnifiedPasteReferencePreview
      previews={PREVIEWS}
      onDismiss={onDismiss}
      onSend={onSend}
      {...overrides}
    />,
  )
  return { ...utils, onDismiss, onSend }
}

describe('D185 叶子:被动条与编辑器双形态', () => {
  it('不传 onSend → 保持 D68 被动预览条,不出现编辑器(零回归)', () => {
    const { onSend } = renderLeaf({ onSend: undefined })
    expect(screen.getByTestId('unified-paste-reference-preview')).toBeTruthy()
    expect(screen.queryByTestId('unified-paste-reference-editor')).toBeNull()
    expect(onSend).not.toHaveBeenCalled()
  })

  it('传 onSend + 非空 previews → 编辑器七件套齐备(六键 + 复用的授权声明)', () => {
    renderLeaf()
    expect(screen.getByTestId('unified-paste-reference-editor')).toBeTruthy()
    expect(screen.queryByTestId('unified-paste-reference-preview')).toBeNull()
    // mock 的 t 返回键字面量(不含 namespace 前缀),断言用键末段全路径
    expect(screen.getByTestId('unified-paste-editor-mock-badge').textContent).toBe(
      'referencePreview.available',
    )
    expect(screen.getByTestId('unified-paste-editor-input').getAttribute('aria-label')).toBe(
      'referencePreview.editor',
    )
    expect(
      (screen.getByTestId('unified-paste-editor-input') as HTMLTextAreaElement).placeholder,
    ).toBe('referencePreview.placeholder')
    expect(screen.getByTestId('unified-paste-editor-source').textContent).toBe('@src/a.ts\n@nope')
    expect(screen.getByTestId('unified-paste-editor-select').textContent).toBe(
      'referencePreview.select',
    )
    expect(screen.getByTestId('unified-paste-editor-clear').textContent).toBe(
      'referencePreview.clear',
    )
    expect(screen.getByTestId('unified-paste-editor-send').textContent).toBe(
      'referencePreview.send',
    )
    expect(screen.getByTestId('unified-paste-editor-authorization').textContent).toBe(
      'authorizationNotice',
    )
  })

  it('previews 空集 → 即使传 onSend 也不渲染(不占位、不闪现)', () => {
    renderLeaf({ previews: [] })
    expect(screen.queryByTestId('unified-paste-reference-editor')).toBeNull()
    expect(screen.queryByTestId('unified-paste-reference-preview')).toBeNull()
  })
})

describe('D185 编辑器行为面', () => {
  it('草稿预填原始输入正文;编辑后发送 → onSend 携带编辑文本 + onDismiss 撤收', () => {
    const { onDismiss, onSend } = renderLeaf()
    const input = screen.getByTestId('unified-paste-editor-input') as HTMLTextAreaElement
    expect(input.value).toBe('@src/a.ts\n@nope')
    fireEvent.change(input, { target: { value: '@src/a.ts 解释这个文件' } })
    fireEvent.click(screen.getByTestId('unified-paste-editor-send'))
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith('@src/a.ts 解释这个文件')
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('select 追加示例能力 token;clear 清空后空草稿 send 禁用', () => {
    renderLeaf({ previews: [{ raw: '@src/a.ts', normalized: 'src/a.ts', recognized: true }] })
    const input = screen.getByTestId('unified-paste-editor-input') as HTMLTextAreaElement
    fireEvent.click(screen.getByTestId('unified-paste-editor-select'))
    expect(input.value).toBe('@src/a.ts @capability')
    fireEvent.click(screen.getByTestId('unified-paste-editor-clear'))
    expect(input.value).toBe('')
    const send = screen.getByTestId('unified-paste-editor-send') as HTMLButtonElement
    expect(send.disabled).toBe(true)
  })
})

describe('D185 容器透传:ContextChipsRow.onSendPastePreview → 叶子 onSend', () => {
  it('点击叶子发送 → 容器回调原样收到文本(只透传不持有文本)', () => {
    const onSendPastePreview = vi.fn()
    const onDismissPastePreviews = vi.fn()
    render(
      <ContextChipsRow
        references={[]}
        onRemoveReference={vi.fn()}
        tools={[]}
        onRemoveTool={vi.fn()}
        quoted={null}
        onClearQuoted={vi.fn()}
        hasMentions={false}
        onRemoveMention={vi.fn()}
        pastePreviews={PREVIEWS}
        onDismissPastePreviews={onDismissPastePreviews}
        onSendPastePreview={onSendPastePreview}
        queueItems={[]}
        onQueueRemove={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('unified-paste-editor-send'))
    expect(onSendPastePreview).toHaveBeenCalledWith('@src/a.ts\n@nope')
    expect(onDismissPastePreviews).toHaveBeenCalledTimes(1)
  })

  it('未传 onSendPastePreview → 容器回落被动预览条', () => {
    render(
      <ContextChipsRow
        references={[]}
        onRemoveReference={vi.fn()}
        tools={[]}
        onRemoveTool={vi.fn()}
        quoted={null}
        onClearQuoted={vi.fn()}
        hasMentions={false}
        onRemoveMention={vi.fn()}
        pastePreviews={PREVIEWS}
        onDismissPastePreviews={vi.fn()}
        queueItems={[]}
        onQueueRemove={vi.fn()}
      />,
    )
    expect(screen.getByTestId('unified-paste-reference-preview')).toBeTruthy()
    expect(screen.queryByTestId('unified-paste-reference-editor')).toBeNull()
  })
})
