// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// @vitest-environment jsdom
/**
 * G-816020 面五:BlogPostContent(`apps/web/app/(main)/blog/[slug]/BlogPostContent.tsx`)。
 * 成对用例:~a~ 不划(单波浪号字面保留)/ ~~b~~ 仍划(反向对照,防"删除线整条坏了"的假绿)。
 * 形态同 G-826 在 markdown-stream 上的先例;每面一份是票面明令("逐面……一处不落")。
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'

vi.mock('@/lib/content', () => ({ markdownComponents: {} }))

import { BlogPostContent } from '../../app/(main)/blog/[slug]/BlogPostContent'

afterEach(cleanup)

describe('G-816020 BlogPostContent — GFM singleTilde 关闭', () => {
  it('~a~ 不渲染 <del>/<s>,原文按字面保留', () => {
    const { container } = render(<BlogPostContent content={'这段 ~a~ 不该被划掉'} />)
    expect(container.querySelector('del')).toBeNull()
    expect(container.querySelector('s')).toBeNull()
    expect(container.textContent).toContain('这段 ~a~ 不该被划掉')
  })

  it('反向对照:~~b~~ 仍照旧判成删除线', () => {
    const { container } = render(<BlogPostContent content={'废弃 ~~b~~ 方案'} />)
    const dels = Array.from(container.querySelectorAll('del')).map((d) => d.textContent ?? '')
    expect(dels).toEqual(['b'])
  })
})
