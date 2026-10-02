// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// @vitest-environment jsdom
/**
 * G-816020 面一:AnswerArea(`apps/web/app/(main)/share/[code]/AnswerArea.tsx`)。
 * answer.text 走 ReactMarkdown 面;成对用例同 G-826 先例。answer 只给 text 字段,
 * thinking/images/lists/audio 分支不进(各自有条件渲染守卫)。
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('next/image', () => ({
  default: ({ alt, ...props }: Record<string, unknown> & { alt?: string }) => (
    /* eslint-disable-next-line @next/next/no-img-element -- 测试桩:镜像 next/image 的透传形态 */
    <img alt={typeof alt === 'string' ? alt : ''} {...props} />
  ),
}))
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }))
vi.mock('@/components/media', () => ({ VideoPlayer: () => <div data-testid="video-stub" /> }))
vi.mock('../../app/(main)/share/[code]/helpers', () => ({ formatAudioTime: () => '' }))

import { AnswerArea } from '../../app/(main)/share/[code]/AnswerArea'

afterEach(cleanup)

const answerOf = (text: string) => ({ text }) as never

describe('G-816020 AnswerArea — GFM singleTilde 关闭', () => {
  it('~a~ 不渲染 <del>/<s>,原文按字面保留', () => {
    const { container } = render(<AnswerArea answer={answerOf('这段 ~a~ 不该被划掉')} />)
    expect(container.querySelector('del')).toBeNull()
    expect(container.querySelector('s')).toBeNull()
    expect(container.textContent).toContain('这段 ~a~ 不该被划掉')
  })

  it('反向对照:~~b~~ 仍照旧判成删除线', () => {
    const { container } = render(<AnswerArea answer={answerOf('废弃 ~~b~~ 方案')} />)
    const dels = Array.from(container.querySelectorAll('del')).map((d) => d.textContent ?? '')
    expect(dels).toEqual(['b'])
  })
})
