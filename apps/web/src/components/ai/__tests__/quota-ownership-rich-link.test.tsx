// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D04③ 词包腿规模化载位(真渲染,不 mock next-intl):
// degradeHint 内嵌 <link>/models/usage</link>,组件经 t.rich + 共享渲染表
// (richAnchorRenderer('link'))产出**可点击** <a href>;本文件钉三件事——
//   ① 五语言词包腿都真渲染出一枚可点链接(role=link + href 命中,不是"样式像链接");
//   ② 词包 t.rich 腿与模型输出腿(RichAnchorText)对同一条串产出的 <a> DOM 签名**逐字等值**
//      (同一条串渲染表 —— 票面验收②的机器化);
//   ③ 五语言语序各异(D04 论点:同一键在 ja/ko 可自由调语序而不必拆"动词键+宾语键"两套):
//      zh-CN/zh-TW/en 的链接收尾,ja/ko 的链接居中且后面还有续文。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it } from 'vitest'

import { RichAnchorText } from '@/components/chat/rich-anchor-text'
import { QuotaOwnershipCard } from '../quota-ownership-card'

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
const USAGE_PATH = '/models/usage'

type Messages = { ai?: { pane?: Record<string, unknown> } }

function readMessages(locale: string): Messages {
  return JSON.parse(readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')) as Messages
}

function readDegradeHint(locale: string): string {
  const pane = readMessages(locale).ai?.pane
  const node = pane?.quotaOwnership as { degradeHint?: string } | undefined
  const hint = node?.degradeHint
  if (typeof hint !== 'string' || hint.length === 0) {
    throw new Error(`missing ai.pane.quotaOwnership.degradeHint in ${locale}.json`)
  }
  return hint
}

/** 词包腿:真 next-intl provider + 真组件,渲染降级建议(t.rich 链路全真) */
function renderCardWithRealMessages(locale: string) {
  return render(
    <NextIntlClientProvider locale={locale} messages={readMessages(locale) as never}>
      <QuotaOwnershipCard kind="personalDaily" freeTierAvailable />
    </NextIntlClientProvider>,
  )
}

describe('D04③ 词包腿可点链接(真 next-intl + 真实词包)', () => {
  it('五语言都渲染出可点击 <a href="/models/usage">(role=link,不接受"样式像链接")', () => {
    for (const locale of LOCALES) {
      const { container, unmount } = renderCardWithRealMessages(locale)
      const anchor = container.querySelector<HTMLAnchorElement>(
        `[data-quota-degrade-hint] a[href="${USAGE_PATH}"]`,
      )
      expect(anchor, `${locale} 应产出一枚 href=${USAGE_PATH} 的链接`).not.toBeNull()
      expect(anchor?.getAttribute('role') ?? anchor?.tagName.toLowerCase(), locale).toBe('a')
      expect(anchor?.textContent, `${locale} 链接内文`).toBe(USAGE_PATH)
      expect(anchor?.getAttribute('rel'), `${locale} 外链安全协议`).toContain('noopener')
      unmount()
    }
  })

  it('词包 t.rich 腿与模型输出腿对同一条串产出的 <a> DOM 签名逐字等值(同一条串渲染表)', () => {
    for (const locale of LOCALES) {
      const hint = readDegradeHint(locale)
      const { container: wordLeg, unmount: unmountWord } = renderCardWithRealMessages(locale)
      const { container: modelLeg, unmount: unmountModel } = render(<RichAnchorText text={hint} />)
      const a1 = wordLeg.querySelector<HTMLAnchorElement>(`a[href="${USAGE_PATH}"]`)
      const a2 = modelLeg.querySelector<HTMLAnchorElement>(`a[href="${USAGE_PATH}"]`)
      expect(a1, `${locale} 词包腿`).not.toBeNull()
      expect(a2, `${locale} 模型输出腿`).not.toBeNull()
      // 逐字等值的是"渲染表产物"这一层:两腿共用 richAnchorRenderer('link')。
      expect(a1?.outerHTML, `${locale} 两腿 <a> DOM 签名`).toBe(a2?.outerHTML)
      unmountWord()
      unmountModel()
    }
  })

  it('五语言语序各异:zh/zh-TW/en 链接收尾,ja/ko 链接居中带续文(不拆两套键的语序自由度)', () => {
    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      const hint = readDegradeHint(locale)
      expect(hint.endsWith(`<link>${USAGE_PATH}</link>`), `${locale} 链接收尾`).toBe(true)
    }
    for (const locale of ['ja', 'ko'] as const) {
      const hint = readDegradeHint(locale)
      const tail = hint.slice(
        hint.indexOf(`<link>${USAGE_PATH}</link>`) + `<link>${USAGE_PATH}</link>`.length,
      )
      expect(tail.trim().length, `${locale} 链接后仍有续文(语序居中)`).toBeGreaterThan(0)
      expect(tail, `${locale} 续文不带第二个链接`).not.toContain('<link')
    }
  })
})
// [tail-watermark-placeholder]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
