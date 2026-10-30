// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回答正文媒资抽取(承接 255fa96933 摘除的端内手写页 extractImageUrls/isValidImageUrl 判据)。
 *
 * 口径来源:被摘页对 delta 流逐段抽图(IMG_EXT/IMG_DOMAINS 逐字沿用),
 * 本次补齐把同一把尺子扩展到视频与音频(扩展名集与 chat.tsx 上传分类
 * handleFileSelect 的 mp4/mov/avi/mkv 同一族,另加 webm;音频 mp3/wav/m4a/aac/flac/ogg)。
 * 渲染面不在此文件:图预览/视频播放/语音气泡由 ChatMessageItem 按
 * msg.images / msg.videos / msg.audioUrl 消费(渲染腿此前已在,缺的只是抽取腿)。
 */
import type { ChatMessage } from '@/api'

/** 通用 URL 切分(逐字沿用被摘页的正则,改动即换尺子,§12f) */
const URL_RE = /https?:\/\/[^\s<>"'\n\r\t,。!?:;()\[\]{}]+/gi
/** 去尾标点(逐字沿用被摘页) */
const TRAILING_PUNCT_RE = /[.,;!?)\]}]+$/
const IMG_EXT = /\.(jpeg|jpg|png|gif|webp|bmp|svg)(\?.*)?$/i
const IMG_DOMAINS = ['volces.com', 'fyshark.com', 's.coze.cn', 'coze.cn']
const VIDEO_EXT = /\.(mp4|mov|avi|mkv|webm)(\?.*)?$/i
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|flac|ogg)(\?.*)?$/i

export interface AnswerMedia {
  images: string[]
  videos: string[]
  audios: string[]
}

function normalizeUrl(raw: string): string {
  return raw.replace(TRAILING_PUNCT_RE, '')
}

function pathname(url: string): string {
  return (url.split('?')[0] ?? url).toLowerCase()
}

function isImageUrl(url: string): boolean {
  if (!url || !/^https?:\/\//.test(url)) return false
  if (IMG_EXT.test(pathname(url))) return true
  // 无扩展名但命中已知图床域(被摘页口径:includes,不要求 host 边界)
  return IMG_DOMAINS.some((d) => url.includes(d))
}

/** 从一段正文(流式 delta 或全文)抽取可预览/可播放的媒资 URL;去重保序。 */
export function extractAnswerMedia(content?: string): AnswerMedia {
  const media: AnswerMedia = { images: [], videos: [], audios: [] }
  if (!content) return media
  const matches = content.match(URL_RE) || []
  const seen = new Set<string>()
  for (const raw of matches) {
    const url = normalizeUrl(raw)
    if (!url || seen.has(url)) continue
    // 视频/音频按扩展名优先归类(带扩展名的图床 URL 不会撞这两档);
    // 其余再过图片判定(含无扩展名图床域)。
    const lower = pathname(url)
    if (VIDEO_EXT.test(lower)) {
      seen.add(url)
      media.videos.push(url)
    } else if (AUDIO_EXT.test(lower)) {
      seen.add(url)
      media.audios.push(url)
    } else if (isImageUrl(url)) {
      seen.add(url)
      media.images.push(url)
    } else {
      seen.add(url) // 非媒资 URL 也去重,避免同串重复走一遍判定
    }
  }
  return media
}

export function hasAnyMedia(media: AnswerMedia): boolean {
  return media.images.length > 0 || media.videos.length > 0 || media.audios.length > 0
}

/**
 * 把抽取结果合并进消息:数组字段增量合并(服务端已给的 images/videos 不被覆盖清空);
 * audios 首条写入 audioUrl —— ChatMessageItem 的语音气泡腿(有 audioUrl 即渲染可播)。
 * 无媒资时原样返回(不产生新对象,流式高频调用不白增渲染)。
 */
export function applyAnswerMedia(msg: ChatMessage, media: AnswerMedia): ChatMessage {
  if (!hasAnyMedia(media)) return msg
  const mergedImages = msg.images ? [...new Set([...msg.images, ...media.images])] : media.images
  const mergedVideos = msg.videos ? [...new Set([...msg.videos, ...media.videos])] : msg.videos
  const next: ChatMessage = {
    ...msg,
    images: mergedImages,
    ...(mergedVideos ? { videos: mergedVideos } : {}),
  }
  // audioUrl 是 ChatMessage 的可选音频腿(api/index.ts 类型注释为准);只补第一条,不覆盖已有
  if (media.audios.length > 0 && next.audioUrl === undefined) {
    next.audioUrl = media.audios[0]
  }
  return next
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
