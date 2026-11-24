// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * agreement/[type] 类型归一化 + 协议正文 HTML → 段落纯文本。
 * TYPE_MAP 与 web apps/web/app/(main)/agreement/[type]/PageClient.tsx 同源。
 */

/** 路由原始 type → 后端 AGREEMENT_TYPES 口径(web TYPE_MAP 逐键拷贝)。 */
export const AGREEMENT_TYPE_MAP: Record<string, string> = {
  user: 'user-agreement',
  'user-protocol': 'user-agreement',
  'user-agreement': 'user-agreement',
  privacy: 'privacy-policy',
  'privacy-policy': 'privacy-policy',
  disclaimer: 'disclaimer',
  terms: 'terms-of-service',
  'terms-of-service': 'terms-of-service',
}

/** 归一化路由 type 为 API type(未知值原样透传,由后端校验,与 web 同口径)。 */
export function normalizeAgreementType(rawType: string): string {
  return AGREEMENT_TYPE_MAP[rawType] ?? rawType
}

/** API type → 标题兜底 i18n 键(web TYPE_TITLE 的 i18n 化)。 */
const TYPE_TITLE_KEYS: Record<string, string> = {
  'user-agreement': 'agreement.titleUserAgreement',
  'privacy-policy': 'agreement.titlePrivacyPolicy',
  disclaimer: 'agreement.titleDisclaimer',
  'terms-of-service': 'agreement.titleTermsOfService',
}

export function agreementTitleKey(apiType: string): string {
  return TYPE_TITLE_KEYS[apiType] ?? 'agreement.title'
}

/**
 * 协议正文 HTML → 段落纯文本数组。
 * RN 端无 SafeHtml 等价物,剥标签后按段落渲染,内容与 web prose 展示同源。
 */
export function htmlToParagraphs(html: string): string[] {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(?:p|div|h[1-6]|li|ul|ol|blockquote|tr|section|article)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** 协议正文结构块:RN 端按 type 渲染原生语义,不把标题压成段落。 */
export type AgreementBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'listItem'; ordered: boolean; index: number; text: string }

const BLOCK_MARK = '\u0000'

function decodeInline(raw: string): string {
  return raw
    // 行内标签按零宽剥除:中文语境下补空格会在句读处冒出错位空隙(单测口径已钉死)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 协议正文 HTML → 结构块(2026-11-08 立)。
 * 先切块级语义(标题/列表)再剥标签:反过来做会把 h1 与 li 压成普通段落,语义就丢了。
 * 口径:标题 h1/h2 原样,h3-h6 收敛到 3;无序列表 index 恒 0,有序列表按 1 起递增。
 */
export function htmlToBlocks(html: string): AgreementBlock[] {
  const marked = String(html ?? '')
    .replace(
      /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi,
      (_m, lv: string, inner: string) =>
        `${BLOCK_MARK}H${Math.min(Number(lv), 3)}${BLOCK_MARK}${decodeInline(inner)}${BLOCK_MARK}`,
    )
    .replace(/<(ul|ol)[^>]*>([\s\S]*?)<\/\1>/gi, (_m, tag: string, inner: string) => {
      const ordered = /^ol$/i.test(tag)
      const items = Array.from(inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map((m) => decodeInline(m[1] ?? ''))
      return items
        .map((t, i) => `${BLOCK_MARK}${ordered ? `O${i + 1}` : 'U'}${BLOCK_MARK}${t}${BLOCK_MARK}`)
        .join('')
    })
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|section|article|blockquote|tr)>/gi, '\n')

  const tokens = marked.split(BLOCK_MARK)
  const blocks: AgreementBlock[] = []
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i] ?? ''
    if (/^H[1-3]$/.test(token)) {
      const text = tokens[i + 1] ?? ''
      if (text) blocks.push({ type: 'heading', level: Number(token.slice(1)) as 1 | 2 | 3, text })
      i += 1
      continue
    }
    if (token === 'U' || /^O\d+$/.test(token)) {
      const text = tokens[i + 1] ?? ''
      if (text) {
        blocks.push({ type: 'listItem', ordered: token !== 'U', index: token === 'U' ? 0 : Number(token.slice(1)), text })
      }
      i += 1
      continue
    }
    for (const line of token.split('\n')) {
      const text = decodeInline(line)
      if (text) blocks.push({ type: 'paragraph', text })
    }
  }
  return blocks
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
