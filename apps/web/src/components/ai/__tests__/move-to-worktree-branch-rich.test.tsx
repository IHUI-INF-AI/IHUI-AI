// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D102 移交弹层 branch 锚点收敛到唯一渲染表(守门 247 的取证面):
// subtitle 五语言值内嵌 <branch>{branchName}</branch>;历史缺陷是该处曾内联另建
// `(chunks) => <code className="font-mono text-xs">` 第二套渲染器(违反"不得各建一套")。
// 本文件钉三件事:
//   ① 词包腿真 next-intl 渲染出 <code>,类串逐字等值 RICH_ANCHOR_COMPONENTS.branch 的产物;
//   ② 与模型输出腿(RichAnchorText)对同一条(已插值的)串产出的 <code> outerHTML 逐字等值;
//   ③ 旧内联类串 'font-mono text-xs' 不得回潮。
// @ihui/ui-react 走轻量替身(同 move-to-worktree-dialog.test.tsx 的 Radix portal 规避范式),
// next-intl **不 mock** —— 渲染表产物只能在真 t.rich 下取证。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import React, { isValidElement, type ReactElement } from 'react'
import { render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'

import type { RichAnchorTag } from '@ihui/shared/chat'
import { RICH_ANCHOR_COMPONENTS, RichAnchorText } from '@/components/chat/rich-anchor-text'

import { MoveToWorktreeDialog } from '../move-to-worktree-dialog'

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
const BRANCH_NAME = 'feat/main'

function readMessages(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')) as Record<
    string,
    unknown
  >
}

function readSubtitle(locale: string): string {
  const messages = readMessages(locale) as {
    ai?: { pane?: { moveToWorktree?: { subtitle?: unknown } } }
  }
  const raw = messages.ai?.pane?.moveToWorktree?.subtitle
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error(`missing ai.pane.moveToWorktree.subtitle in ${locale}.json`)
  }
  return raw
}

/** 渲染表 entry 派生类串(判据单源,不在测试里硬编码 class string) */
function tableClassName(tag: RichAnchorTag): string {
  const rendered = RICH_ANCHOR_COMPONENTS[tag]('probe')
  if (!isValidElement(rendered)) {
    throw new Error(`渲染表 ${tag} 未产出元素,本用例失去意义`)
  }
  const className = (rendered as ReactElement<{ className?: unknown }>).props.className
  if (typeof className !== 'string') {
    throw new Error(`渲染表 ${tag} 的 entry 没有字符串 className`)
  }
  return className
}

describe('D102 moveToWorktree subtitle / branch 渲染表收敛', () => {
  it('五语言词包腿渲染出的 <code> 类串逐字等值渲染表 branch entry', () => {
    for (const locale of LOCALES) {
      const { container, unmount } = render(
        <NextIntlClientProvider locale={locale} messages={readMessages(locale) as never}>
          <MoveToWorktreeDialog open branchName={BRANCH_NAME} onClose={() => {}} />
        </NextIntlClientProvider>,
      )
      const code = container.querySelector('[data-slot="subtitle"] code')
      expect(code, `${locale} <branch> 锚点没渲染成 <code> 元素`).not.toBeNull()
      expect(code?.textContent, `${locale} 分支名插值`).toBe(BRANCH_NAME)
      expect(code?.className, `${locale} 类串应等于渲染表 entry 的产物`).toBe(
        tableClassName('branch'),
      )
      // 旧内联渲染器(第二套表)不得回潮
      expect(code?.className.includes('font-mono text-xs'), `${locale} 旧类串回潮`).toBe(false)
      unmount()
    }
  })

  it('词包 t.rich 腿与模型输出腿(RichAnchorText)对同一条已插值串产出的 <code> outerHTML 逐字等值', () => {
    for (const locale of LOCALES) {
      const interpolated = readSubtitle(locale).replace('{branchName}', BRANCH_NAME)
      const { container: wordLeg, unmount: unmountWord } = render(
        <NextIntlClientProvider locale={locale} messages={readMessages(locale) as never}>
          <MoveToWorktreeDialog open branchName={BRANCH_NAME} onClose={() => {}} />
        </NextIntlClientProvider>,
      )
      const { container: modelLeg, unmount: unmountModel } = render(
        <RichAnchorText text={interpolated} />,
      )
      const a = wordLeg.querySelector('[data-slot="subtitle"] code')
      const b = modelLeg.querySelector('code')
      expect(a, `${locale} 词包腿 <code>`).not.toBeNull()
      expect(b, `${locale} 模型输出腿 <code>`).not.toBeNull()
      // 同表判据:两条腿的 DOM 签名逐字相同(渲染表由 RICH_ANCHOR_COMPONENTS 单点产出)
      expect(a?.outerHTML, `${locale} 两腿 <code> DOM 签名漂开`).toBe(b?.outerHTML)
      unmountWord()
      unmountModel()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
