// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 消息富内容解析 — 独立模块(供 ChatScreen 渲染 + 单测共用,避免测试拉入 expo 依赖)。
 *
 * 对齐 Uniapp ai_index2 agent_content_list 结构化 parts 的轻量前端版:
 * 消息模型为纯文本 content(后端未返回结构化 parts),前端解析:
 *   ① ```lang\n...\n``` → code 段(语言标签 + 展开/收起 + 复制,对齐 code-block)
 *   ② http(s) 图片 URL → image 段(渲染图片,点击全屏预览,对齐 previewImage)
 *   ③ 其余 → text 段
 */
export type ContentSegment =
  | { type: 'text'; text: string }
  | { type: 'code'; language: string; code: string }
  | { type: 'image'; url: string }

const IMAGE_URL_RE = /(https?:\/\/[^\s)]+\.(?:png|jpe?g|gif|webp)(?:\?[^\s)]*)?)/i

/** 解析消息 content 为分段(代码块优先,再切图片 URL,其余文本) */
export function parseMessageContent(content: string): ContentSegment[] {
  if (!content) return []
  const segments: ContentSegment[] = []
  const codeRe = /```([\w+#.-]*)\r?\n([\s\S]*?)```/g
  let lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = codeRe.exec(content)) !== null) {
    if (m.index > lastIndex) pushTextSegments(segments, content.slice(lastIndex, m.index))
    const codeBody = m[2] ?? ''
    // LF 场景 strip 尾部 \n(对齐代码块内容整理);CRLF 场景保留 \r\n(保护代码块原样内容)
    segments.push({ type: 'code', language: m[1] || '', code: codeBody.replace(/(?<!\r)\n$/, '') })
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < content.length) pushTextSegments(segments, content.slice(lastIndex))
  return segments
}

/** 将文本段进一步按图片 URL 拆分 */
function pushTextSegments(segments: ContentSegment[], text: string): void {
  let rest = text
  let im: RegExpExecArray | null
  while ((im = IMAGE_URL_RE.exec(rest)) !== null) {
    if (im.index > 0) segments.push({ type: 'text', text: rest.slice(0, im.index) })
    const url = im[1] ?? ''
    if (url) segments.push({ type: 'image', url })
    rest = rest.slice(im.index + (im[0]?.length ?? 0))
  }
  if (rest) segments.push({ type: 'text', text: rest })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
