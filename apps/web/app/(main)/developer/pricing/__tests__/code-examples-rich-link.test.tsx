// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D04① 词包 t.rich 腿的可点击载体(票面验收①的字面格):
// developerPricingPage.examplesTip 五语言值把句中本来就在报的站内路由
// /developer/keys 包进 <link> 锚点;渲染点 CodeExamples.tsx 走
// t.rich('examplesTip', { link: richAnchorRenderer('link') })。
// 内文以 "/" 开头过渲染表 SAFE_HREF ⇒ 必须产出**真 <a href>**(断 role/href,
// 不接受"样式像链接");标记字面量不得残留在界面上。
// 取证面同 quota-ownership-rich-link.test.tsx:真 NextIntlClientProvider + 真实词包。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isValidElement, type ReactElement } from 'react'
import { render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it } from 'vitest'

import { RICH_ANCHOR_COMPONENTS } from '@/components/chat/rich-anchor-text'

import { CodeExamples } from '../CodeExamples'

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
const KEYS_PATH = '/developer/keys'

function readMessages(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')) as Record<
    string,
    unknown
  >
}

describe('D04① examplesTip 词包腿产出真可点击链接(唯一渲染表)', () => {
  it('五语言都渲染出 <a href="/developer/keys">(target=_blank + rel=noopener noreferrer)', () => {
    for (const locale of LOCALES) {
      const { container, unmount } = render(
        <NextIntlClientProvider locale={locale} messages={readMessages(locale) as never}>
          <CodeExamples />
        </NextIntlClientProvider>,
      )
      const anchor = container.querySelector<HTMLAnchorElement>(`a[href="${KEYS_PATH}"]`)
      expect(anchor, `${locale} 应产出 href=${KEYS_PATH} 的真链接`).not.toBeNull()
      expect(anchor?.tagName, `${locale} 必须是 HTMLAnchorElement`).toBe('A')
      expect(anchor?.getAttribute('href'), `${locale} href`).toBe(KEYS_PATH)
      expect(anchor?.getAttribute('target'), `${locale} target`).toBe('_blank')
      expect(anchor?.getAttribute('rel'), `${locale} rel`).toBe('noopener noreferrer')
      expect(anchor?.textContent, `${locale} 链接内文逐字为路由本身`).toBe(KEYS_PATH)

      // 不丢字 + 标记不泄漏:锚点外其余 token 逐字还在,"<link" 字面量不在界面
      const tip = anchor?.closest('p')
      expect(tip, `${locale} 链接应落在提示行内`).not.toBeNull()
      const tipText = tip?.textContent ?? ''
      expect(tipText, `${locale} YOUR_API_KEY 丢失`).toContain('YOUR_API_KEY')
      expect(tipText, `${locale} baseURL 丢失`).toContain('baseURL')
      expect(tipText, `${locale} <link> 标记字面量泄漏`).not.toContain('<link')

      // 同一条渲染表:link 族 entry 的类串投影
      expect(anchor?.className, `${locale} link 类串应等于渲染表 link entry 的产物`).toBe(
        linkClassFromTable(),
      )
      unmount()
    }
  })
})

/** 从渲染表派生 link 族类串(不在测试里硬编码 class string) */
function linkClassFromTable(): string {
  const rendered = RICH_ANCHOR_COMPONENTS.link(`http://example.test/${KEYS_PATH}`)
  if (!isValidElement(rendered)) {
    throw new Error('渲染表 link entry 未产出元素,本用例失去意义')
  }
  const className = (rendered as ReactElement<{ className?: unknown }>).props.className
  if (typeof className !== 'string') {
    throw new Error('渲染表 link entry 未产出带字符串 className 的元素')
  }
  return className
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
