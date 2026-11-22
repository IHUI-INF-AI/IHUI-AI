// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// @vitest-environment jsdom
/**
 * G-816020 面二:MarkdownResultDialog(`apps/web/app/(main)/workspace/[id]/MarkdownResultDialog.tsx`)。
 * result.markdown 走 ReactMarkdown 面;成对用例同 G-826 先例。result 不带 fileId,
 * extractFileAssets 分支不进(api-client 已 mock,防拉真网络面)。
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@ihui/api-client', () => ({ extractFileAssets: vi.fn() }))

import { MarkdownResultDialog } from '../../app/(main)/workspace/[id]/MarkdownResultDialog'

afterEach(cleanup)

describe('G-816020 MarkdownResultDialog — GFM singleTilde 关闭', () => {
  it('~a~ 不渲染 <del>/<s>,原文按字面保留', () => {
    render(
      <MarkdownResultDialog
        result={{ fileName: 'doc.md', markdown: '这段 ~a~ 不该被划掉' }}
        onClose={() => {}}
      />,
    )
    expect(document.body.querySelector('del')).toBeNull()
    expect(document.body.querySelector('s')).toBeNull()
    expect(document.body.textContent).toContain('这段 ~a~ 不该被划掉')
  })

  it('反向对照:~~b~~ 仍照旧判成删除线', () => {
    render(
      <MarkdownResultDialog
        result={{ fileName: 'doc.md', markdown: '废弃 ~~b~~ 方案' }}
        onClose={() => {}}
      />,
    )
    const dels = Array.from(document.body.querySelectorAll('del')).map((d) => d.textContent ?? '')
    expect(dels).toEqual(['b'])
  })
})
