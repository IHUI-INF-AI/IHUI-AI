// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌⁠

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
 *
 * ---
 * **2026-09-01 抛错语义改造**:之前把所有失败吞成 '',前端只能用
 * `audioBlob.size < 2000` 这类启发式猜"是否真录到了内容",
 * 而环境噪音几 KB 经常 >2000,导致误显示"转写失败"。
 *
 * 新语义:
 * - HTTP 非 2xx → **抛 `VoiceSttHttpError`**(携带 `status` / `body`)
 *   调用方 try/catch 后可区分 401(登录过期)/5xx(服务异常)
 * - 网络异常 / JSON 解析失败 → **向上抛**(由调用方 try/catch)
 * - HTTP 200 OK 视为成功,返回 `data.text`(可能是 '' 也可能是后端 stub 占位文字)
 *   调用方对 '' 显示"未识别到语音内容",对非空 stub 文字可原样透出
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
  /** ai-service 基础 URL(默认 http://localhost:8803;也可传同源代理路径 /api/voice/stt) */
  aiServiceUrl?: string
  /** 访问令牌(可选;ai-service 启用 JWT 鉴权后必须携带 Bearer token) */
  token?: string
}

/** 默认 ai-service URL(与 web 端 voice-input.tsx 保持一致)。 */
const DEFAULT_AI_SERVICE_URL =
  typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_AI_SERVICE_URL
    ? process.env.NEXT_PUBLIC_AI_SERVICE_URL
    : 'http://localhost:8803'

/**
 * STT HTTP 错误(响应非 2xx)。
 *
 * 抛出供前端 try/catch 后做精准提示:
 * - 401/403 → "登录已过期,请刷新页面"
 * - 5xx     → "转写服务暂不可用,请稍后重试"
 * - 4xx(非 401/403) → "转写失败"
 *
 * 字段:
 * - `status`:HTTP 状态码
 * - `body`:响应体前 500 字符(便于日志排查)
 */
export class VoiceSttHttpError extends Error {
  readonly status: number
  readonly body: string
  constructor(status: number, body: string) {
    super(`STT 请求失败 HTTP ${status}`)
    this.name = 'VoiceSttHttpError'
    this.status = status
    this.body = body
  }
}

/**
 * 调用 ai-service STT 端点(web/extension 通用版,基于 fetch + Blob)。
 *
 * 使用场景:浏览器环境(web/extension),音频已是 Blob/File/ArrayBuffer。
 *
 * **2026-09-01 抛错语义改造**:HTTP 非 2xx 抛 VoiceSttHttpError;网络异常向上抛;
 * 成功响应(200 OK)返回 `data.text`(空表示"未识别到语音内容",
 * 后端 stub=true 时的占位文字也可一并返回以便透出)。
 *
 * @returns STT 转写文本。失败时**抛 Error**,由调用方 try/catch 处理。
 */
export async function voiceSttFromBlob(params: VoiceSttParams): Promise<string> {
  const {
    blob,
    filename = 'voice.webm',
    mimeType = 'audio/webm',
    language = 'zh',
    aiServiceUrl = DEFAULT_AI_SERVICE_URL,
    token,
  } = params

  if (!blob) return ''

  const formData = new FormData()
  // Blob 类型直接 append;ArrayBuffer 需要 wrap 成 Blob
  const audioBlob = blob instanceof Blob ? blob : new Blob([blob], { type: mimeType })
  formData.append('file', audioBlob, filename)
  if (language) formData.append('language', language)

  const res = await fetch(
    // 支持完整 URL(如 http://localhost:8803)或同源代理路径(如 /api/voice/stt)
    aiServiceUrl.endsWith('/api/voice/stt')
      ? aiServiceUrl
      : `${aiServiceUrl.replace(/\/+$/, '')}/api/voice/stt`,
    {
      method: 'POST',
      body: formData,
      // ai-service 启用 JWT 鉴权(2026-08 起),必须携带 Bearer token
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  )

  if (!res.ok) {
    let body = ''
    try {
      body = (await res.text()).slice(0, 500)
    } catch {
      // ignore
    }
    throw new VoiceSttHttpError(res.status, body)
  }

  const data = (await res.json()) as VoiceSttResponse
  return data.text ?? ''
}

/**
 * 调用 ai-service STT 端点(mobile-rn 版,基于 fetch + FileSystem)。
 *
 * 使用场景:React Native 环境,音频是 file:// URI。
 * 需要 react-native-fs 读取文件字节,再用 FormData 上传。
 *
 * **2026-09-01 抛错语义改造**:与 voiceSttFromBlob 对齐。
 * HTTP 非 2xx 抛 VoiceSttHttpError;网络/超时异常向上抛。
 *
 * @returns STT 转写文本。失败时**抛 Error**。
 */
export async function voiceSttFromReactNative(
  fileUri: string,
  options?: {
    language?: string
    aiServiceUrl?: string
    /** 访问令牌(ai-service 启用 JWT 鉴权后必须携带 Bearer token,2026-08-31 修复) */
    token?: string
  },
): Promise<string> {
  const language = options?.language ?? 'zh'
  const aiServiceUrl = options?.aiServiceUrl ?? DEFAULT_AI_SERVICE_URL
  const token = options?.token

  if (!fileUri) return ''

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
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    let body = ''
    try {
      body = (await res.text()).slice(0, 500)
    } catch {
      // ignore
    }
    throw new VoiceSttHttpError(res.status, body)
  }

  const data = (await res.json()) as VoiceSttResponse
  return data.text ?? ''
}

/** 默认导出:根据环境自动选择实现(web/extension 直接用 voiceSttFromBlob)。 */
export default voiceSttFromBlob
// ⁠‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌⁠
