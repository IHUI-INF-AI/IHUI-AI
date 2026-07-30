/**
 * 语音转文字(STT)—— 跨端共用封装(不含 Taro 专用实现)。
 *
 * 2026-07-28 拆分:将 miniapp-taro 专用实现 `voiceSttFromTaro` 移至
 * `./voice-stt.taro.ts`,仅通过深路径 `@ihui/api-client/endpoints/voice-stt.taro`
 * 暴露给 miniapp-taro。其他端(web/api/mobile-rn/extension/desktop/cli)永不接触
 * `@tarojs/taro`,避免跨端依赖污染导致 dev 阶段静态解析失败。
 *
 * 本文件提供的端适配:
 * - web/extension:浏览器直连 ai-service(http://localhost:8803 或生产域名)
 * - mobile-rn:fetch + FormData 上传音频 URI 对应文件
 *
 * 后端端点:POST {aiServiceUrl}/api/voice/stt(multipart/form-data)
 * 响应:{ text: string, stub: boolean, model: string }
 */

/** STT 响应结构(与 ai-service STTResponse 对齐)。 */
export interface VoiceSttResponse {
  /** 转写文本(stub=true 时为占位提示) */
  text: string
  /** 是否降级 stub(模型未安装/转写失败时 true) */
  stub: boolean
  /** 模型名(如 "whisper-base-local") */
  model: string
}

/** STT 请求参数。 */
export interface VoiceSttParams {
  /** 音频数据(Blob/File/ArrayBuffer,web/extension 用) */
  blob?: Blob | File | ArrayBuffer
  /** 音频文件路径(miniapp-taro tempFilePath / mobile-rn URI) */
  filePath?: string
  /** 文件名(默认 voice.webm) */
  filename?: string
  /** MIME 类型(默认 audio/webm) */
  mimeType?: string
  /** 语言提示(如 zh/en/ja,可选) */
  language?: string
  /** ai-service 基础 URL(默认 http://localhost:8803) */
  aiServiceUrl?: string
}

/** 默认 ai-service URL(与 web 端 voice-input.tsx 保持一致)。 */
const DEFAULT_AI_SERVICE_URL =
  typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_AI_SERVICE_URL
    ? process.env.NEXT_PUBLIC_AI_SERVICE_URL
    : 'http://localhost:8803'

/**
 * 调用 ai-service STT 端点(web/extension 通用版,基于 fetch + Blob)。
 *
 * 使用场景:浏览器环境(web/extension),音频已是 Blob/File/ArrayBuffer。
 *
 * @returns 转写文本;stub=true 或异常时返回空字符串(不抛错,避免阻塞用户输入)
 */
export async function voiceSttFromBlob(params: VoiceSttParams): Promise<string> {
  const {
    blob,
    filename = 'voice.webm',
    mimeType = 'audio/webm',
    language = 'zh',
    aiServiceUrl = DEFAULT_AI_SERVICE_URL,
  } = params

  if (!blob) return ''

  try {
    const formData = new FormData()
    // Blob 类型直接 append;ArrayBuffer 需要 wrap 成 Blob
    const audioBlob = blob instanceof Blob ? blob : new Blob([blob], { type: mimeType })
    formData.append('file', audioBlob, filename)
    if (language) formData.append('language', language)

    const res = await fetch(`${aiServiceUrl}/api/voice/stt`, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) return ''

    const data = (await res.json()) as VoiceSttResponse
    // stub 响应不返回给用户(避免占位文字污染输入框)
    return data.stub ? '' : (data.text ?? '')
  } catch {
    // 静默处理失败(不阻塞用户输入)
    return ''
  }
}

/**
 * 调用 ai-service STT 端点(mobile-rn 版,基于 fetch + FileSystem)。
 *
 * 使用场景:React Native 环境,音频是 file:// URI。
 * 需要 react-native-fs 读取文件字节,再用 FormData 上传。
 *
 * @returns 转写文本;stub=true 或异常时返回空字符串
 */
export async function voiceSttFromReactNative(
  fileUri: string,
  options?: {
    language?: string
    aiServiceUrl?: string
  },
): Promise<string> {
  const language = options?.language ?? 'zh'
  const aiServiceUrl = options?.aiServiceUrl ?? DEFAULT_AI_SERVICE_URL

  if (!fileUri) return ''

  try {
    const filename = fileUri.split('/').pop() ?? 'voice.m4a'
    const mimeType = filename.endsWith('.wav')
      ? 'audio/wav'
      : filename.endsWith('.mp3')
        ? 'audio/mp3'
        : 'audio/m4a'

    // RN FormData 支持 { uri, type, name } 结构(原生 fetch 会读取文件并上传)
    const fd = new FormData()
    fd.append('file', { uri: fileUri, type: mimeType, name: filename } as never)
    if (language) fd.append('language', language)

    const res = await fetch(`${aiServiceUrl}/api/voice/stt`, {
      method: 'POST',
      body: fd,
    })

    if (!res.ok) return ''

    const data = (await res.json()) as VoiceSttResponse
    return data.stub ? '' : (data.text ?? '')
  } catch {
    return ''
  }
}

/** 默认导出:根据环境自动选择实现(web/extension 直接用 voiceSttFromBlob)。 */
export default voiceSttFromBlob
