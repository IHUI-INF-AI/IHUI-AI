// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

export interface SharePayload {
  message: string
  /** 图片走系统分享的 url 字段(文件 URI 不是文案,塞进 message 只会被当字符串发送)。 */
  url?: string
}

/**
 * XUI-045:RN Share 只能分享文本/URL。
 * 旧实现把 `file://…` 图片 URI 用换行拼进 message,分享出去是一段不可点击的路径文本,
 * 图片本身丢失。这里把图片 URI 移出文案、放进 `url`,文案只保留备注与语音转写。
 */
export function buildSharePayload(input: {
  remark: string
  voiceText: string
  imageUri: string | null
  fallback: string
}): SharePayload {
  const imageUri = input.imageUri?.trim() || null
  const text = [input.remark, input.voiceText]
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n')
  const message = text || input.fallback
  return imageUri ? { message, url: imageUri } : { message }
}
