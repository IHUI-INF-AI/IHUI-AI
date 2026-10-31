// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 协议白名单判据(blob: / 同源绝对路径 / http(s))唯一实现住 shared,本端不复制第二份
import { safeMediaUrl } from '@ihui/shared/chat/user-message-parts'

/**
 * 消息富内容解析 — 独立模块(供 ChatScreen 渲染 + 单测共用,避免测试拉入 expo 依赖)。
 *
 * 对齐 Uniapp ai_index2 agent_content_list 结构化 parts 的轻量前端版:
 * 消息模型为纯文本 content(后端未返回结构化 parts),前端解析:
 *   ① ```lang\n...\n``` → code 段(语言标签 + 展开/收起 + 复制,对齐 code-block)
 *   ② http(s) 图片 URL → image 段(渲染图片,点击全屏预览,对齐 previewImage)
 *   ③ [语音] <音频URL> <秒> → audio 段(渲染语音气泡,点击回听;2026-10-16 录音消息上线)
 *   ④ `<video src="…" controls></video>` 整行 → video 段(web 发送侧拍平的视频附件同形)
 *   ⑤ 其余 → text 段
 */
export type ContentSegment =
  | { type: 'text'; text: string }
  | { type: 'code'; language: string; code: string }
  | { type: 'image'; url: string }
  | { type: 'audio'; url: string; durationSec: number }
  | { type: 'video'; url: string }

const IMAGE_URL_RE = /(https?:\/\/[^\s)]+\.(?:png|jpe?g|gif|webp)(?:\?[^\s)]*)?)/i
/**
 * 语音消息标记:`[语音] <url> <秒>`。与 [图片]/[文件] 同一家族(内容即文本,URL 可消费)。
 * 秒数缺省按 0 渲染(气泡只显示 0");扩展名覆盖 m4a/mp3/wav/aac/ogg/opus。
 */
const VOICE_MARKER_RE =
  /\[语音\]\s*(https?:\/\/[^\s)]+\.(?:m4a|mp3|wav|aac|ogg|opus)(?:\?[^\s)]*)?)(?:\s+(\d{1,3}))?/gi

/**
 * 视频消息整行形态:`<video src="…" controls></video>`。
 * 与 web 发送侧拍平产出的确切形态**逐字对齐**(单一真相源 = `packages/shared/src/chat/user-message-parts.ts`
 * 的 VIDEO_LINE,那边改形态这边必须同改):只认整行(行尾允许空格/制表符),散文里讨论该写法的那行不动。
 * `m` 让 ^/$ 按行锚定;`g` + 游标遍历(理由同 VOICE_MARKER_RE:带 g 的 exec 自推进 lastIndex,
 * 必须对原串用游标,不能每轮切串)。
 */
const VIDEO_LINE_RE = /^<video src="([^"]*)" controls><\/video>[ \t]*$/gm

/** 解析消息 content 为分段(代码块优先,再切语音标记/图片 URL,其余文本) */
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

/**
 * 将文本段先按视频整行切出,再交给语音标记/图片 URL 拆分。
 *
 * 视频在最外层消费:它的形态是**整行**标签,一旦落进下面的语音/图片循环,
 * 标签文本会被当成普通散文留下(表现为用户看见一串 `<video …>` 源码)。
 */
function pushTextSegments(segments: ContentSegment[], text: string): void {
  let cursor = 0
  VIDEO_LINE_RE.lastIndex = 0
  let vd: RegExpExecArray | null
  while ((vd = VIDEO_LINE_RE.exec(text)) !== null) {
    if (vd.index > cursor) pushVoiceSegments(segments, text.slice(cursor, vd.index))
    const url = safeMediaUrl(vd[1] ?? '')
    // 协议不合法/URL 为空 ⇒ 不渲染成播放器,但原文必须留在可见文本里
    // (与 web「绝不静默消失」同一条口径,不吞用户内容)
    segments.push(url ? { type: 'video', url } : { type: 'text', text: vd[0] })
    cursor = vd.index + (vd[0]?.length ?? 0)
  }
  if (cursor < text.length) pushVoiceSegments(segments, text.slice(cursor))
}

/**
 * 将文本段进一步按语音标记、图片 URL 拆分(语音标记更具体,优先消费)。
 *
 * ⚠️ 下面两个循环写法**刻意不同,禁止互相抄**:形态由正则**自己带不带 `g` 旗**决定,
 * 抄错一侧的后果不是断言红,是**进程挂死**。
 *
 * - `VOICE_MARKER_RE` 带 `gi` ⇒ `exec` 会推进它自己的 `lastIndex`。此时必须走
 *   **游标 + 对原串 exec**:若每轮再把命中前缀 `slice` 掉,下一轮的 lastIndex 就落在
 *   新串的错误偏移上,第二个语音标记被整段跳过(实测:一条内容两条语音只出第一段)。
 * - `IMAGE_URL_RE` 只有 `i`(**没有 `g`**)`⇒ exec` 永远从 0 开始、lastIndex 不生效。
 *   此时必须走**切串**:每轮把命中前缀 `slice` 掉,下一个 URL 才轮得到。
 *   对它改用游标法 = `exec` 每轮都返回同一处命中 ⇒ **死循环**(实测整个 vitest
 *   worker 被 OOM 掉,表现是"测试没跑就 Worker exited unexpectedly",极难归因)。
 *
 * 想让两边统一,先给 `IMAGE_URL_RE` 补 `g` 旗并把切串那侧一起改成游标 —— 只改一半必炸。
 */
function pushVoiceSegments(segments: ContentSegment[], text: string): void {
  let cursor = 0
  VOICE_MARKER_RE.lastIndex = 0
  let vm: RegExpExecArray | null
  while ((vm = VOICE_MARKER_RE.exec(text)) !== null) {
    if (vm.index > cursor) pushTextAndImages(segments, text.slice(cursor, vm.index))
    const url = vm[1] ?? ''
    if (url) segments.push({ type: 'audio', url, durationSec: Number(vm[2] ?? 0) })
    cursor = vm.index + (vm[0]?.length ?? 0)
  }
  if (cursor < text.length) pushTextAndImages(segments, text.slice(cursor))
}

/** 文本段内的图片 URL 拆分(原 pushTextSegments 主体;切串法,理由见上,勿改成游标) */
function pushTextAndImages(segments: ContentSegment[], text: string): void {
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
