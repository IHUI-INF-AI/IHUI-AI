// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WATERMARK-PLACEHOLDER(本行由 scripts/watermark.mjs inject 替换为横幅)
 */

/**
 * Artifact 交付物的纯函数渲染/导出层(零 DOM,可 node 直接测)。
 *
 * 消费面:
 *  - apps/api 导出端点(fmt=html|md|csv)—— 三组转换的唯一实现;
 *  - web 产物中心 / 移动端预览(后续票)—— 内联 HTML 预览串同源。
 * 各端禁止另抄一份渲染逻辑(AGENTS.md §3 跨端单一真相源)。
 */

import type {
  ArtifactWithPayload,
  SheetPayload,
  SlidesDeck,
  VideoRefPayload,
} from './types'

/** HTML 文本转义(所有插值一律过它;属性值与文本节点共用同一规则)。 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function isDeck(payload: ArtifactWithPayload['payload']): payload is SlidesDeck {
  return typeof payload === 'object' && payload !== null && Array.isArray((payload as SlidesDeck).slides)
}

function isSheet(payload: ArtifactWithPayload['payload']): payload is SheetPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    Array.isArray((payload as SheetPayload).columns) &&
    Array.isArray((payload as SheetPayload).rows)
  )
}

function isVideoRef(payload: ArtifactWithPayload['payload']): payload is VideoRefPayload {
  return typeof payload === 'object' && payload !== null && typeof (payload as VideoRefPayload).url === 'string'
}

/** slides deck → 内联 HTML 预览串(每页一个 section,notes 落 aside)。 */
function renderSlidesDeck(deck: SlidesDeck): string {
  const sections = deck.slides
    .map((slide, i) => {
      const bullets = slide.bullets
        .map((b) => `<li>${escapeHtml(b)}</li>`)
        .join('')
      const notes = slide.notes
        ? `<aside class="artifact-slide-notes">${escapeHtml(slide.notes)}</aside>`
        : ''
      return (
        `<section class="artifact-slide" data-slide-index="${i}">` +
        `<h2>${escapeHtml(slide.title)}</h2>` +
        `<ul>${bullets}</ul>` +
        `${notes}</section>`
      )
    })
    .join('')
  return `<div class="artifact artifact--slides">${sections}</div>`
}

/** sheet payload → 表格 HTML(thead 用列名,行按列数对齐截断/补空)。 */
function renderSheetTable(sheet: SheetPayload): string {
  const head = sheet.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')
  const body = sheet.rows
    .map((row) => {
      const cells = sheet.columns
        .map((_, ci) => {
          const v = row[ci]
          return `<td>${v === null || v === undefined ? '' : escapeHtml(String(v))}</td>`
        })
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')
  return `<table class="artifact artifact--sheet"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

/**
 * Artifact → 内联 HTML 预览串(统一出口,按 kind 分流):
 *  - html_report → 自包含 HTML 原样返回;
 *  - slides → 演示稿内联预览;sheet → 表格 HTML;
 *  - doc → 转义后按等宽预格式化(无 markdown 渲染依赖,保真不注水);
 *  - video_ref → 外链卡片(只渲染安全转义后的链接,不注入第三方脚本)。
 * payload 形态与 kind 不符时抛错(调用方应先经 zod 校验;这是编程错误,不是数据错误)。
 */
export function renderArtifactToHtml(artifact: ArtifactWithPayload): string {
  const { kind, payload } = artifact
  switch (kind) {
    case 'html_report': {
      if (typeof payload !== 'string') throw new Error('html_report 的 payload 必须是 HTML 字符串')
      return payload
    }
    case 'slides': {
      if (!isDeck(payload)) throw new Error('slides 的 payload 必须是 deck JSON(slides[])')
      return renderSlidesDeck(payload)
    }
    case 'sheet': {
      if (!isSheet(payload)) throw new Error('sheet 的 payload 必须是 {columns, rows}')
      return renderSheetTable(payload)
    }
    case 'doc': {
      if (typeof payload !== 'string') throw new Error('doc 的 payload 必须是 Markdown 字符串')
      return `<pre class="artifact artifact--doc">${escapeHtml(payload)}</pre>`
    }
    case 'video_ref': {
      if (!isVideoRef(payload)) throw new Error('video_ref 的 payload 必须是 {url, provider?}')
      const label = artifact.title
      const provider = payload.provider ? ` · ${escapeHtml(payload.provider)}` : ''
      return (
        `<div class="artifact artifact--video-ref">` +
        `<a href="${escapeHtml(payload.url)}" rel="noopener noreferrer nofollow" target="_blank">` +
        `${escapeHtml(label)}</a>${provider}</div>`
      )
    }
  }
}

/** sheet → RFC 4180 风格 CSV(含逗号/引号/换行的字段加引号;null/undefined 出空串)。 */
export function artifactToCsv(artifact: ArtifactWithPayload): string {
  if (artifact.kind !== 'sheet' || !isSheet(artifact.payload)) {
    throw new Error('仅 sheet 支持 CSV 导出')
  }
  const esc = (v: string): string => (/[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v)
  const lines: string[] = [artifact.payload.columns.map(esc).join(',')]
  for (const row of artifact.payload.rows) {
    lines.push(
      row
        .map((cell) => esc(cell === null || cell === undefined ? '' : String(cell)))
        .join(','),
    )
  }
  return lines.join('\r\n')
}

/**
 * Artifact → Markdown 文本(slides → 大纲;doc/html_report → 正文原样;
 * sheet → GFM 表格;video_ref → 链接行)。
 */
export function artifactToMarkdown(artifact: ArtifactWithPayload): string {
  const { kind, payload } = artifact
  switch (kind) {
    case 'doc':
    case 'html_report': {
      if (typeof payload !== 'string') throw new Error(`${kind} 的 payload 必须是字符串`)
      return payload
    }
    case 'slides': {
      if (!isDeck(payload)) throw new Error('slides 的 payload 必须是 deck JSON')
      return (
        `# ${artifact.title}\n\n` +
        payload.slides
          .map((slide) => {
            const bullets = slide.bullets.map((b) => `- ${b}`).join('\n')
            const notes = slide.notes ? `\n\n> ${slide.notes}` : ''
            return `## ${slide.title}\n${bullets ? `\n${bullets}` : ''}${notes}`
          })
          .join('\n\n')
      )
    }
    case 'sheet': {
      if (!isSheet(payload)) throw new Error('sheet 的 payload 必须是 {columns, rows}')
      const head = `| ${payload.columns.join(' | ')} |`
      const sep = `| ${payload.columns.map(() => '---').join(' | ')} |`
      const body = payload.rows
        .map(
          (row) =>
            `| ${payload.columns
              .map((_, ci) => {
                const v = row[ci]
                return v === null || v === undefined ? '' : String(v)
              })
              .join(' | ')} |`,
        )
        .join('\n')
      return `${head}\n${sep}\n${body}`
    }
    case 'video_ref': {
      if (!isVideoRef(payload)) throw new Error('video_ref 的 payload 必须是 {url, provider?}')
      return `[${artifact.title}](${payload.url})`
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
