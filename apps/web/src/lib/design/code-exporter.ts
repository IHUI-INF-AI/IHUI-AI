/**
 * 代码导出转换器(2026-07-24 立,Design 模式 P1-a 缺口)。
 *
 * 把 DesignPage 画布 HTML 转换为 React/Vue/纯 HTML 组件代码,纯前端转换无需后端:
 *  - DOMParser 解析 HTML,提取 body 内 DOM 结构
 *  - inline style → className(React)/ class(Vue/HTML),样式集中到 CSS 块
 *  - 组件名从预览名派生(PascalCase)
 *
 * 自研实现,不引入新依赖。
 */

export type ExportFormat = 'react' | 'vue' | 'html'

export interface ExportOptions {
  format: ExportFormat
  componentName: string
  html: string
  css?: string
}

export interface ExportResult {
  filename: string
  content: string
  language: string
}

const VOID_TAGS = [
  'br', 'img', 'input', 'hr', 'meta', 'link',
  'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr',
]

/** 从预览名派生 PascalCase 组件名;非 ASCII 回退到 DesignComponent。 */
export function deriveComponentName(name: string): string {
  const trimmed = (name || '').trim()
  if (!trimmed) return 'DesignComponent'
  const words = trimmed.split(/[\s\-_]+/).filter(Boolean)
  if (words.length === 0) return 'DesignComponent'
  const pascal = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
  if (/^[A-Z][a-zA-Z0-9]*$/.test(pascal)) return pascal
  const ascii = pascal.replace(/[^a-zA-Z0-9]/g, '')
  if (/^[A-Z][a-zA-Z0-9]*$/.test(ascii)) return ascii
  return 'DesignComponent'
}

/** 解析 HTML,提取 body innerHTML + 收集 inline style → className。 */
function convertHtml(
  html: string,
  format: ExportFormat,
): { bodyInner: string; cssText: string } {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return { bodyInner: html, cssText: '' }
  }
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // inline style 去重 → 生成 c-1/c-2… className,样式集中到 CSS 块
  const styleMap = new Map<string, string>()
  let counter = 0
  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    const style = el.getAttribute('style')
    if (!style) continue
    const normalized = style.trim().replace(/;\s*$/, '')
    if (!normalized) continue
    let className = styleMap.get(normalized)
    if (!className) {
      counter++
      className = `c-${counter}`
      styleMap.set(normalized, className)
    }
    el.removeAttribute('style')
    const existing = el.getAttribute('class') || ''
    el.setAttribute('class', existing ? `${existing} ${className}` : className)
  }

  let cssText = ''
  for (const [style, className] of styleMap) {
    cssText += `.${className} { ${style}; }\n`
  }

  let bodyInner = doc.body.innerHTML

  // React JSX: class→className, for→htmlFor, void 标签自闭合
  if (format === 'react') {
    bodyInner = bodyInner.replace(/\sclass=/g, ' className=')
    bodyInner = bodyInner.replace(/\sfor=/g, ' htmlFor=')
    const voidPattern = new RegExp(`<(${VOID_TAGS.join('|')})(\\s[^>]*?)?>`, 'gi')
    bodyInner = bodyInner.replace(voidPattern, (_match, tag: string, attrs?: string) => `<${tag}${attrs || ''} />`)
  }

  return { bodyInner, cssText }
}

/** HTML → React functional component (.tsx)。 */
function generateReact(name: string, body: string, css: string): string {
  const styleConst = css ? `const styles = ${JSON.stringify(css)}\n\n` : ''
  const styleTag = css ? `      <style dangerouslySetInnerHTML={{ __html: styles }} />\n` : ''
  const indented = body
    .split('\n')
    .map((line) => `      ${line}`)
    .join('\n')
  return `import React from 'react'

${styleConst}export default function ${name}() {
  return (
    <>
${styleTag}${indented}
    </>
  )
}
`
}

/** HTML → Vue SFC (.vue)。 */
function generateVue(name: string, body: string, css: string): string {
  const indented = body
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n')
  const styleBlock = css ? `\n<style scoped>\n${css}</style>\n` : ''
  return `<template>
  <div class="${name.toLowerCase()}">
${indented}
  </div>
</template>

<script setup lang="ts">
// ${name} component
</script>
${styleBlock}`
}

/** HTML → 完整 HTML 页面 (.html)。 */
function generateHtmlPage(name: string, body: string, css: string): string {
  const styleBlock = css
    ? `    <style>\n${css
        .split('\n')
        .map((line) => `    ${line}`)
        .join('\n')
        .replace(/\n$/, '')}\n    </style>\n`
    : ''
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name}</title>
${styleBlock}</head>
<body>
${body}
</body>
</html>
`
}

/** 主转换入口:HTML → React/Vue/HTML 组件代码。 */
export function exportCode(options: ExportOptions): ExportResult {
  const { format, componentName, html } = options
  const { bodyInner, cssText } = convertHtml(html, format)
  if (format === 'react') {
    return {
      filename: `${componentName}.tsx`,
      language: 'tsx',
      content: generateReact(componentName, bodyInner, cssText),
    }
  }
  if (format === 'vue') {
    return {
      filename: `${componentName}.vue`,
      language: 'vue',
      content: generateVue(componentName, bodyInner, cssText),
    }
  }
  return {
    filename: `${componentName}.html`,
    language: 'html',
    content: generateHtmlPage(componentName, bodyInner, cssText),
  }
}
