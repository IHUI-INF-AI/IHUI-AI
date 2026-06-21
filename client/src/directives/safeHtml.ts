import DOMPurify from 'dompurify'
import type { Directive, DirectiveBinding, App } from 'vue'

interface SafeHtmlOptions {
  allowedTags?: string[]
  allowedAttributes?: Record<string, string[]>
  allowDataAttributes?: boolean
}

type SafeHtmlValue = string | { html: string; options?: SafeHtmlOptions }

const defaultAllowedTags = [
  'a', 'b', 'br', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'i', 'img', 'li', 'ol', 'p', 'span', 'strong', 'table', 'tbody',
  'td', 'th', 'thead', 'tr', 'u', 'ul', 'code', 'pre', 'blockquote',
]

const defaultAllowedAttributes: Record<string, string[]> = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  div: ['class', 'id'],
  span: ['class', 'id'],
  p: ['class', 'id'],
  table: ['class', 'id'],
  td: ['class', 'id', 'colspan', 'rowspan'],
  th: ['class', 'id', 'colspan', 'rowspan'],
}

function sanitizeHtml(html: string, options: SafeHtmlOptions = {}): string {
  const {
    allowedTags = defaultAllowedTags,
    allowedAttributes = defaultAllowedAttributes,
    allowDataAttributes = false,
  } = options

  const purifyConfig: Record<string, unknown> = {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowDataAttributes ? ['*'] : [],
    ALLOW_DATA_ATTR: allowDataAttributes,
    ADD_ATTR: ['target'],
    FORCE_BODY: true,
  }

  Object.entries(allowedAttributes).forEach(([_tag, attrs]) => {
    const allowedAttr = purifyConfig.ALLOWED_ATTR as string[]
    attrs.forEach((attr) => {
      if (!allowedAttr.includes(attr)) {
        allowedAttr.push(attr)
      }
    })
  })

  return DOMPurify.sanitize(html, purifyConfig as Parameters<typeof DOMPurify.sanitize>[1]) as string
}

function updateElement(
  el: Element,
  binding: DirectiveBinding
) {
  const value = binding.value as SafeHtmlValue
  let html: string
  let options: SafeHtmlOptions = {}

  if (typeof value === 'string') {
    html = value
  } else if (value && typeof value === 'object') {
    html = value.html || ''
    options = value.options || {}
  } else {
    html = ''
  }

  const sanitized = sanitizeHtml(html, options)
  ;(el as HTMLElement).innerHTML = sanitized
}

export const vSafeHtml: Directive = {
  mounted(el, binding) {
    updateElement(el, binding)
  },
  updated(el, binding) {
    updateElement(el, binding)
  },
}

export function sanitizeMarkdown(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      ...defaultAllowedTags,
      'hr', 'del', 's', 'sup', 'sub', 'details', 'summary',
    ],
    allowedAttributes: {
      ...defaultAllowedAttributes,
      a: ['href', 'title', 'target', 'rel', 'id'],
      code: ['class', 'id'],
      pre: ['class', 'id'],
      details: ['class', 'id', 'open'],
    },
  })
}

export function sanitizeUserContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ['b', 'i', 'u', 'em', 'strong', 'br', 'p', 'span'],
    allowedAttributes: {
      span: ['class'],
      p: ['class'],
    },
    allowDataAttributes: false,
  })
}

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: defaultAllowedTags,
    allowedAttributes: defaultAllowedAttributes,
    allowDataAttributes: false,
  })
}

export { sanitizeHtml }

export function install(app: App): void {
  app.directive('safe-html', vSafeHtml)
}
