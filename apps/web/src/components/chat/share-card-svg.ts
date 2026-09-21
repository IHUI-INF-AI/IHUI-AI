// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 会话导出图片分享卡(零依赖):拼 SVG 字符串 → Blob → canvas → PNG 下载。
// 本文件只负责生成 SVG 字符串(纯函数,可单测);下载流程由 conversation-export 驱动。
// 固定 720×360,字体 fallback 系统栈,中文按估算宽度逐字截断,文本统一转义 &<>。

export const SHARE_CARD_WIDTH = 720
export const SHARE_CARD_HEIGHT = 360
export const SHARE_CARD_BRAND_COLOR = '#3b6cff'

export interface ShareCardInput {
  /** 会话标题 */
  title: string
  /** 首条用户消息前 80 字 */
  firstUser: string
  /** 首条 AI 回复前 200 字纯文本 */
  firstAi: string
  /** 时间字符串(已格式化) */
  time: string
  /** 模型名 */
  model: string
  /** 项目品牌色(覆盖默认) */
  brandColor?: string
  /** 角色标签文案(i18n 由调用方传入,默认「用户」) */
  userLabel?: string
}

/** XML 文本转义(& < >),防止注入破坏 SVG。 */
export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 估算单字符显示宽度(无 canvas 环境也可运行,用于按宽度截断)。 */
function charWidth(ch: string, fontSize: number): number {
  if (/[　-〿一-鿿豈-﫿＀-￯]/.test(ch)) return fontSize * 1.0
  if (/\s/.test(ch)) return fontSize * 0.4
  return fontSize * 0.55
}

/** 按估算宽度把文本断行,超过 maxLines 时末行截断并追加 "…"。返回行数组。 */
export function fitText(
  text: string,
  maxWidthPx: number,
  fontSize: number,
  maxLines: number,
): string[] {
  const lines: string[] = []
  let line = ''
  let lineWidth = 0
  for (const ch of text) {
    const w = charWidth(ch, fontSize)
    if (lineWidth + w > maxWidthPx && line) {
      lines.push(line)
      line = ch
      lineWidth = w
      if (lines.length >= maxLines) break
    } else {
      line += ch
      lineWidth += w
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  if (lines.length > maxLines) {
    lines.length = maxLines
    const last = lines[maxLines - 1]
    if (last !== undefined) lines[maxLines - 1] = last.replace(/.$/, '…')
  } else if (lines.length === maxLines && line) {
    // 仍有未排完的内容,末行截断
    const last = lines[maxLines - 1]
    if (last !== undefined) lines[maxLines - 1] = last.replace(/.$/, '…')
  }
  return lines
}

/** 生成分享卡 SVG 字符串(含 xmlns,可直接作为 image/svg+xml Blob)。 */
export function buildShareCardSvg(input: ShareCardInput): string {
  const brand = input.brandColor || SHARE_CARD_BRAND_COLOR
  const pad = 28
  const contentWidth = SHARE_CARD_WIDTH - pad * 2

  const titleLines = fitText(input.title || 'AI Chat', contentWidth, 26, 2)
  const userLines = fitText(input.firstUser || '', contentWidth, 14, 2)
  const aiLines = fitText(input.firstAi || '', contentWidth, 14, 4)

  const titleSpans = titleLines
    .map((l, i) => `<tspan x="${pad}" dy="${i === 0 ? 32 : 32}">${escapeXml(l)}</tspan>`)
    .join('')
  const userSpans = userLines
    .map((l, i) => `<tspan x="${pad}" dy="${i === 0 ? 20 : 20}">${escapeXml(l)}</tspan>`)
    .join('')
  const aiSpans = aiLines
    .map((l, i) => `<tspan x="${pad}" dy="${i === 0 ? 20 : 20}">${escapeXml(l)}</tspan>`)
    .join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SHARE_CARD_WIDTH}" height="${SHARE_CARD_HEIGHT}" viewBox="0 0 ${SHARE_CARD_WIDTH} ${SHARE_CARD_HEIGHT}">` +
    `<rect width="${SHARE_CARD_WIDTH}" height="${SHARE_CARD_HEIGHT}" fill="#ffffff"/>` +
    `<rect width="${SHARE_CARD_WIDTH}" height="8" fill="${brand}"/>` +
    `<text x="${pad}" y="${56}" font-family="system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="26" font-weight="700" fill="#111111">${titleSpans}</text>` +
    `<text x="${pad}" y="${132}" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="${brand}">${escapeXml(input.userLabel || '用户')}</text>` +
    `<text x="${pad}" y="${152}" font-family="system-ui, sans-serif" font-size="14" fill="#1e293b">${userSpans}</text>` +
    `<text x="${pad}" y="${212}" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="${brand}">AI</text>` +
    `<text x="${pad}" y="${232}" font-family="system-ui, sans-serif" font-size="14" fill="#334155">${aiSpans}</text>` +
    `<text x="${pad}" y="${336}" font-family="system-ui, sans-serif" font-size="12" fill="#94a3b8">${escapeXml(input.time)}</text>` +
    `<text x="${SHARE_CARD_WIDTH - pad}" y="${336}" text-anchor="end" font-family="system-ui, sans-serif" font-size="12" fill="${brand}">${escapeXml(input.model || 'AI')}</text>` +
    `</svg>`
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
