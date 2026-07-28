/**
 * 语音转文字(STT)—— Taro 小程序专用实现(2026-07-28 拆分)。
 *
 * 拆分原因(根因修复):
 * - `@ihui/api-client` 是跨端共享包(web/api/miniapp-taro/mobile-rn/extension/desktop/cli)。
 * - 原 `voice-stt.ts` 把 `voiceSttFromTaro` 与 web/RN 通用版混在同文件,并通过 `await import('@tarojs/taro')`
 *   动态加载 Taro。但 turbopack/webpack 在 dev 阶段对动态 import 也会静态分析依赖链,
 *   `@tarojs/taro` → `@tarojs/api` → 解析失败 → web 端 dev server 报 500
 *   (HTTP 500 statusCode=500,模块找不到,影响所有页面)。
 * - 修复策略:把 Taro 专用实现拆出到独立文件 `voice-stt.taro.ts`,**仅 miniapp-taro 通过深路径
 *   `@ihui/api-client/endpoints/voice-stt.taro` 导入**,web/RN/extension 等端永不接触 Taro 代码,
 *   静态依赖链天然干净,无需 webpackIgnore 等 hack。
 *
 * 端适配:
 * - miniapp-taro:本文件,Taro.uploadFile 上传 tempFilePath
 * - web/extension:`voice-stt.ts` 内 `voiceSttFromBlob`(浏览器 fetch + Blob)
 * - mobile-rn:`voice-stt.ts` 内 `voiceSttFromReactNative`(fetch + RN FormData uri)
 *
 * 后端端点:POST {aiServiceUrl}/api/voice/stt(multipart/form-data)
 * 响应:{ text: string, stub: boolean, model: string }
 */

import type { VoiceSttResponse } from './voice-stt'

/** ai-service 基础 URL(与 web 端 voice-input.tsx 保持一致)。 */
const DEFAULT_AI_SERVICE_URL =
  typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_AI_SERVICE_URL
    ? process.env.NEXT_PUBLIC_AI_SERVICE_URL
    : 'http://localhost:8803'

/**
 * 调用 ai-service STT 端点(miniapp-taro 版,基于 Taro.uploadFile)。
 *
 * 使用场景:小程序环境,音频是 tempFilePath。
 *
 * @returns 转写文本;stub=true 或异常时返回空字符串
 */
export async function voiceSttFromTaro(
  tempFilePath: string,
  options?: {
    language?: string
    aiServiceUrl?: string
  },
): Promise<string> {
  const language = options?.language ?? 'zh'
  const aiServiceUrl = options?.aiServiceUrl ?? DEFAULT_AI_SERVICE_URL

  if (!tempFilePath) return ''

  try {
    // 仅在 miniapp-taro 端使用,@tarojs/taro 已在该端 node_modules 中静态可用。
    // 此文件只通过 `@ihui/api-client/endpoints/voice-stt.taro` 深路径被 miniapp-taro 导入,
    // 其他端永不接触,无跨端依赖冲突。
    const Taro = (await import('@tarojs/taro')).default
    const res = await Taro.uploadFile({
      url: `${aiServiceUrl}/api/voice/stt`,
      filePath: tempFilePath,
      name: 'file',
      formData: language ? { language } : undefined,
    })

    if (res.statusCode !== 200) return ''

    const data = JSON.parse(res.data) as VoiceSttResponse
    return data.stub ? '' : (data.text ?? '')
  } catch {
    return ''
  }
}
