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
 * 协议正文结构化块:标题/段落/列表项保留文档语义。
 * 标题由共享屏按 level 加 `accessibilityRole="header"` 与字号/字重区分;
 * 列表项由共享屏补项目符号或序号,三端(web/RN/小程序)消费同一份结构。
 */
export type AgreementBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'listItem'; ordered: boolean; index: number; text: string }

const BLOCK_TAGS = new Set([
  'p',
  'div',
  'blockquote',
  'section',
  'article',
  'tr',
  'table',
  'thead',
  'tbody',
  'td',
  'th',
])

/** 自闭合(如 `<br/>`)与带属性标签均需命中:斜杠在 `>` 之前单独放行。 */
const TAG_RE = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)(?:\s[^>]*?)?\s*\/?>/g

/** 实体与空白归一化:与 htmlToParagraphs 的解码口径保持一致。 */
function normalizeAgreementText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 协议正文 HTML → 结构化块(RN 无 SafeHtml 等价物,由共享屏按块渲染)。
 * 支持 h1-h6 / ul / ol / li / p / div / br 等块级边界;其余行内标签仅保留文本。
 */
export function htmlToBlocks(html: string): AgreementBlock[] {
  const blocks: AgreementBlock[] = []
  const listStack: { ordered: boolean; index: number }[] = []
  let headingLevel: 1 | 2 | 3 | null = null
  let listItem: { ordered: boolean; index: number } | null = null
  let buffer = ''

  const flush = () => {
    const lines = buffer.split('\n')
    buffer = ''
    for (const raw of lines) {
      const text = normalizeAgreementText(raw)
      if (!text) continue
      if (headingLevel) {
        blocks.push({ type: 'heading', level: headingLevel, text })
      } else if (listItem) {
        blocks.push({ type: 'listItem', ordered: listItem.ordered, index: listItem.index, text })
      } else {
        blocks.push({ type: 'paragraph', text })
      }
    }
  }

  let lastIndex = 0
  for (const match of html.matchAll(TAG_RE)) {
    const index = match.index ?? 0
    buffer += html.slice(lastIndex, index)
    lastIndex = index + match[0].length

    const closing = match[1] === '/'
    const tag = (match[2] ?? '').toLowerCase()
    if (tag === 'br') {
      buffer += '\n'
      continue
    }

    const headingMatch = /^h([1-6])$/.exec(tag)
    if (headingMatch) {
      flush()
      headingLevel = closing ? null : (Math.min(Number(headingMatch[1]), 3) as 1 | 2 | 3)
      continue
    }

    if (tag === 'ol' || tag === 'ul') {
      flush()
      if (closing) listStack.pop()
      else listStack.push({ ordered: tag === 'ol', index: 0 })
      continue
    }

    if (tag === 'li') {
      flush()
      if (closing) {
        listItem = null
      } else {
        const context = listStack[listStack.length - 1]
        const ordered = context?.ordered ?? false
        const itemIndex = ordered && context ? (context.index += 1) : 0
        listItem = { ordered, index: itemIndex }
      }
      continue
    }

    if (BLOCK_TAGS.has(tag) && closing) {
      flush()
    }
  }

  buffer += html.slice(lastIndex)
  flush()
  return blocks
}

/**
 * 协议正文 HTML → 段落纯文本数组(新闻屏等既有消费方保持原观感,本函数语义不变)。
 * 协议屏改用 htmlToBlocks 保留标题/列表结构;此函数的输出不参与 agreement 渲染。
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
