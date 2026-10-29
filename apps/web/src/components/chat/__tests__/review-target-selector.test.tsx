// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D06 审查对象选择条(S18,2026-10-24):组件行为 + 接口层纯函数两组用例。
// 组件只断言**结构**(三档入口 / 受控上报 / 取消 / 展开输入),文案一律走 key
// (真实词包五语言由词条文件本身保证,i18n parity 门另守)。REVIEW_DIFF_LIMIT
// 从源模块 import 真值(§22c:测试不复制判据常量)。
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

// 本文件此前零 cleanup(vitest setupFiles 只 configure,不注册 cleanup)
// ⇒ 前一用例的 DOM 残留到下一用例,getByTestId 撞上同 testid 的两份。
afterEach(() => {
  cleanup()
})

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

  it('visible=true 未选 ⇒ 五档齐(含票面三类 git 目标)、无清除钮、无展开输入', () => {
    const { getByTestId, queryByTestId } = renderSelector()
    for (const kind of ['uncommitted', 'branch', 'commit', 'file', 'snippet'] as const) {
      const btn = getByTestId(`review-target-kind-${kind}`)
      expect(btn).toBeTruthy()
      expect(btn.getAttribute('aria-pressed')).toBe('false')
    }
    expect(getByTestId('review-target-kind-branch')).toBeTruthy()
    expect(getByTestId('review-target-kind-commit')).toBeTruthy()
    expect(queryByTestId('review-target-clear')).toBeNull()
    expect(queryByTestId('review-target-branch-input')).toBeNull()
    expect(queryByTestId('review-target-commit-input')).toBeNull()
    expect(queryByTestId('review-target-file-input')).toBeNull()
    expect(queryByTestId('review-target-snippet-input')).toBeNull()
  })

  it('点指定分支档 ⇒ 上报 {kind:branch, value:""},展开分支名输入', () => {
    const { getByTestId, onChange, rerender } = renderSelector()
    fireEvent.click(getByTestId('review-target-kind-branch'))
    expect(onChange).toHaveBeenCalledWith({ kind: 'branch', value: '' })
    rerender(
      <ReviewTargetSelector
        visible
        selection={{ kind: 'branch', value: '' }}
        onChange={onChange}
      />,
    )
    fireEvent.change(getByTestId('review-target-branch-input'), { target: { value: 'feature/x' } })
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'branch', value: 'feature/x' })
  })

  it('点指定 commit 档 ⇒ 上报 {kind:commit, value:""},展开 SHA 输入', () => {
    const { getByTestId, onChange, rerender } = renderSelector()
    fireEvent.click(getByTestId('review-target-kind-commit'))
    expect(onChange).toHaveBeenCalledWith({ kind: 'commit', value: '' })
    rerender(
      <ReviewTargetSelector
        visible
        selection={{ kind: 'commit', value: '' }}
        onChange={onChange}
      />,
    )
    fireEvent.change(getByTestId('review-target-commit-input'), { target: { value: '9cb7c5a' } })
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'commit', value: '9cb7c5a' })
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

describe('review 选择条词条(票面三类目标新增键,五语齐备)', () => {
  // 2026-10-27 装车新增的六个键:选择条文案走 key,组件测试只能用 key=>key 桩,
  // 真实词包由这一条直读文件守住(缺一语言 ⇒ 该语下按钮显示原始 key)。
  const NEW_KEYS = [
    'reviewTargetBranch',
    'reviewTargetBranchLabel',
    'reviewTargetBranchPlaceholder',
    'reviewTargetCommit',
    'reviewTargetCommitLabel',
    'reviewTargetCommitPlaceholder',
  ] as const
  const here = dirname(fileURLToPath(import.meta.url))
  const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')

  it.each(['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const)('%s 六键齐备且非空', (locale) => {
    const pack = JSON.parse(readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')) as {
      chat?: Record<string, unknown>
    }
    for (const key of NEW_KEYS) {
      const value = pack.chat?.[key]
      expect(typeof value, `${locale}.${key}`).toBe('string')
      expect((value as string).length, `${locale}.${key}`).toBeGreaterThan(0)
    }
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
    // 实现用 join('\n')(review-context.ts:100),围栏内实为 body + '\n',
    // 故取到围栏末尾时要减掉那个分隔换行,否则恒多 1。
    const open = out.indexOf('```\n') + '```\n'.length
    const close = out.lastIndexOf('```')
    expect(out.slice(open, close).replace(/\n$/, '').length).toBe(REVIEW_DIFF_LIMIT)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
