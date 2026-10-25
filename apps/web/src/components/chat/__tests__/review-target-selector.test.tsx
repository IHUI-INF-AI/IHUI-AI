// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D06 审查对象选择条(S18,2026-10-24):组件行为 + 接口层纯函数两组用例。
// 组件只断言**结构**(三档入口 / 受控上报 / 取消 / 展开输入),文案一律走 key
// (真实词包五语言由词条文件本身保证,i18n parity 门另守)。REVIEW_DIFF_LIMIT
// 从源模块 import 真值(§22c:测试不复制判据常量)。
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { REVIEW_DIFF_LIMIT } from '@/hooks/use-chat/slash-commands'
import {
  buildReviewContextInline,
  isReviewSelectionReady,
  toReviewSlashText,
} from '../review-context'
import { ReviewTargetSelector } from '../review-target-selector'

type SelectorProps = Parameters<typeof ReviewTargetSelector>[0]

function renderSelector(props: Partial<SelectorProps> = {}) {
  const onChange = vi.fn()
  const utils = render(
    <ReviewTargetSelector visible selection={null} onChange={onChange} {...props} />,
  )
  return { onChange, ...utils }
}

describe('ReviewTargetSelector(组件,受控)', () => {
  it('visible=false ⇒ 整条不渲染', () => {
    const { queryByRole } = renderSelector({ visible: false })
    expect(queryByRole('group')).toBeNull()
  })

  it('visible=true 未选 ⇒ 三源档齐(aria-pressed=false)、无清除钮、无展开输入', () => {
    const { getByTestId, queryByTestId } = renderSelector()
    for (const kind of ['uncommitted', 'file', 'snippet'] as const) {
      const btn = getByTestId(`review-target-kind-${kind}`)
      expect(btn).toBeTruthy()
      expect(btn.getAttribute('aria-pressed')).toBe('false')
    }
    expect(queryByTestId('review-target-clear')).toBeNull()
    expect(queryByTestId('review-target-file-input')).toBeNull()
    expect(queryByTestId('review-target-snippet-input')).toBeNull()
  })

  it('点未提交档 ⇒ 上报 {kind:uncommitted, value:null}(diff 收集归发送链)', () => {
    const { getByTestId, onChange } = renderSelector()
    fireEvent.click(getByTestId('review-target-kind-uncommitted'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ kind: 'uncommitted', value: null })
  })

  it('已激活档再点一次 ⇒ 上报 null(取消)', () => {
    const { getByTestId, onChange } = renderSelector({
      selection: { kind: 'uncommitted', value: null },
    })
    fireEvent.click(getByTestId('review-target-kind-uncommitted'))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('切档重置内容:file 有值时点 snippet ⇒ {kind:snippet, value:""}(不串旧档残留)', () => {
    const { getByTestId, onChange } = renderSelector({
      selection: { kind: 'file', value: 'src/a.ts' },
    })
    fireEvent.click(getByTestId('review-target-kind-snippet'))
    expect(onChange).toHaveBeenCalledWith({ kind: 'snippet', value: '' })
  })

  it('file 档展开路径输入,输入即上报', () => {
    const { getByTestId, onChange } = renderSelector({ selection: { kind: 'file', value: '' } })
    fireEvent.change(getByTestId('review-target-file-input'), { target: { value: 'src/app.ts' } })
    expect(onChange).toHaveBeenCalledWith({ kind: 'file', value: 'src/app.ts' })
  })

  it('snippet 档展开片段输入,粘贴即上报', () => {
    const { getByTestId, onChange } = renderSelector({
      selection: { kind: 'snippet', value: '' },
    })
    fireEvent.change(getByTestId('review-target-snippet-input'), {
      target: { value: 'const a = 1' },
    })
    expect(onChange).toHaveBeenCalledWith({ kind: 'snippet', value: 'const a = 1' })
  })

  it('有选择 ⇒ 清除钮在,点击上报 null', () => {
    const { getByTestId, onChange } = renderSelector({
      selection: { kind: 'snippet', value: 'x' },
    })
    fireEvent.click(getByTestId('review-target-clear'))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})

describe('review-context(接口层纯函数)', () => {
  it('toReviewSlashText:uncommitted 降维成已落地 slash 通道;其余档 null', () => {
    expect(toReviewSlashText({ kind: 'uncommitted', value: null })).toBe('/review uncommitted')
    expect(toReviewSlashText({ kind: 'file', value: 'src/a.ts' })).toBeNull()
    expect(toReviewSlashText({ kind: 'snippet', value: 'x' })).toBeNull()
  })

  it('isReviewSelectionReady:即选即用(uncommitted)与须有内容(file/snippet)分档', () => {
    expect(isReviewSelectionReady(null)).toBe(false)
    expect(isReviewSelectionReady({ kind: 'uncommitted', value: null })).toBe(true)
    expect(isReviewSelectionReady({ kind: 'file', value: '   ' })).toBe(false)
    expect(isReviewSelectionReady({ kind: 'file', value: 'src/a.ts' })).toBe(true)
    expect(isReviewSelectionReady({ kind: 'snippet', value: '\n' })).toBe(false)
    expect(isReviewSelectionReady({ kind: 'snippet', value: 'const a = 1' })).toBe(true)
  })

  it('buildReviewContextInline:uncommitted/空内容 ⇒ 空串(不静默造块)', () => {
    expect(buildReviewContextInline({ kind: 'uncommitted', value: null })).toBe('')
    expect(buildReviewContextInline({ kind: 'file', value: '  ' })).toBe('')
    expect(buildReviewContextInline({ kind: 'snippet', value: '' })).toBe('')
  })

  it('buildReviewContextInline:file 档点名路径 + 指令句 + 围栏', () => {
    const out = buildReviewContextInline({ kind: 'file', value: 'src/app.ts' })
    expect(out).toContain(
      'Review the file src/app.ts below. Report findings with path:line anchors.',
    )
    expect(out).toContain('```')
    expect(out).toContain('src/app.ts')
  })

  it('buildReviewContextInline:snippet 档标 pasted snippet,原样内联', () => {
    const out = buildReviewContextInline({ kind: 'snippet', value: 'function f() { return 2 }' })
    expect(out).toContain('pasted snippet')
    expect(out).toContain('function f() { return 2 }')
  })

  it('buildReviewContextInline:超限截断必须点名(上限 = 源模块真值,不复制常量)', () => {
    const big = 'x'.repeat(REVIEW_DIFF_LIMIT + 5)
    const out = buildReviewContextInline({ kind: 'snippet', value: big })
    expect(out).toContain('snippet truncated at')
    expect(out).toContain('5 characters omitted')
    // 截断后围栏内正文恰好等于上限长度
    const open = out.indexOf('```\n') + '```\n'.length
    const close = out.lastIndexOf('```')
    expect(out.slice(open, close).length).toBe(REVIEW_DIFF_LIMIT)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
