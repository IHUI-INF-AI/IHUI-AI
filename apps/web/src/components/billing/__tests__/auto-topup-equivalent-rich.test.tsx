// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D100 计费词包腿真渲染(t.rich + chat 侧唯一渲染表):
// wallet.autoTopUp.target.equivalent.text 五语言值内均嵌 <strong>{amount}</strong> 锚点。
// 历史缺陷(本文件所钉):消费点曾走 plain t() ⇒ 标记不解释,用户直接看见
// 「<strong>¥45.00</strong>」字面量。修复 = t.rich + richAnchorRenderer('strong')。
// 同 quota-ownership-rich-link.test.tsx 的取证面:真 NextIntlClientProvider + 真实词包,
// 不 mock next-intl(mock 腿只钉结构,钉不了"渲染表产物")。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isValidElement, type ReactElement } from 'react'
import { render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it } from 'vitest'

import type { RichAnchorTag } from '@ihui/shared/chat'
import { RICH_ANCHOR_COMPONENTS } from '@/components/chat/rich-anchor-text'

import { AutoTopupSettings } from '../auto-topup-settings'

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

function readMessages(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')) as Record<
    string,
    unknown
  >
}

/** 渲染表 entry 派生类串(判据单源,禁止在测试里硬编码 class string) */
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

function renderLoadedEquivalent(locale: string) {
  return render(
    <NextIntlClientProvider locale={locale} messages={readMessages(locale) as never}>
      <AutoTopupSettings
        settings={{ enabled: false, targetCredits: '200', thresholdCredits: '50' }}
        equivalent={{ phase: 'loaded', creditCount: 500, amount: '¥45.00' }}
      />
    </NextIntlClientProvider>,
  )
}

describe('D100 equivalent-text 词包腿真渲染(strong 是元素,不是字面量)', () => {
  it('五语言都渲染出真 <strong> 元素,内文为金额,且界面无 "<strong" 字面量残留', () => {
    for (const locale of LOCALES) {
      const { container, unmount } = renderLoadedEquivalent(locale)
      const line = container.querySelector('[data-equivalent="target.equivalent.text"]')
      expect(line, `${locale} equivalent 行没挂载`).not.toBeNull()

      const strong = line?.querySelector('strong')
      expect(strong, `${locale} <strong> 没渲染成元素 ⇒ t.rich 腿没接上`).not.toBeNull()
      expect(strong?.textContent, `${locale} strong 内文应为插值金额`).toBe('¥45.00')
      // 类串逐字等值渲染表 entry(同一条表,不各建一套)
      expect(strong?.className, `${locale} strong 类串`).toBe(tableClassName('strong'))

      // 失效型反例:plain t() 透传 ⇒ 标记字面量出现在可见文本里
      expect(line?.textContent ?? '', `${locale} 字面量泄漏到界面`).not.toContain('<strong')
      unmount()
    }
  })

  it('等价行文本不丢字:除金额外句子的其余可见文本仍在(strong 只去标记不丢字)', () => {
    const { container, unmount } = renderLoadedEquivalent('zh-CN')
    const line = container.querySelector('[data-equivalent="target.equivalent.text"]')
    const text = line?.textContent ?? ''
    expect(text).toContain('500')
    expect(text).toContain('¥45.00')
    expect(text).toContain('自动充值')
    expect(text).toContain('预计')
    unmount()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
