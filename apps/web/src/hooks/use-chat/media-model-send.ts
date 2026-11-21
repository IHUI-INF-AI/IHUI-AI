// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模态模型发送分流(2026-11-21 立)。
 *
 * 背景:选择器从 2026-11-20 起把 image / video / tts 等专用模型一并展示
 * (`isSelectableChatModel` 只挡 embedding/rerank/guard/other 中间件)。但这些模型
 * **不能送进 /chat/completions** —— 上游是画图/出片端点,按对话协议发过去必然 400,
 * 用户在界面上看到的就是"显示了但选了不能用"。
 *
 * 本模块把"选中模态模型 ⇒ 走生成端点 ⇒ 结果以工具卡上屏"这一段收敛到一处:
 *   - image → `POST /api/image-gen/generate`(后端已接通 Agnes /v1/images/generations)
 *   - video → `POST /api/ai/agnes/video` + 轮询 `/api/ai/agnes/video/tasks/:taskId`
 *
 * 判定只认模型 id 的分隔 token,不做模糊匹配:`vision`/`-vl` 这类对话档不会被误吞。
 * 语音(tts/asr)暂无可用 provider 在册,刻意不在此分流 —— 命中时返回 kind=null,
 * 仍按普通对话送出去(上游会明确报错),不伪造一个"语音生成"卡。
 */

import { generateImage } from '@ihui/api-client'
import { fetchApi } from '@/lib/api'
import type { ToolCall } from '@ihui/types/chat'
import type { WorkspacePermissionMode } from '@ihui/api-client/endpoints/workspace'

export type MediaModelKind = 'image' | 'video' | 'speech' | 'ocr'

/** 图像档命名特征:image / imagen / seedream / flux / recraft / dall-e / ideogram / stable-diffusion */
const IMAGE_ID_RE =
  /(^|[/_.-])(image|imagen|seedream|flux|recraft|dall-?e|ideogram|stable-diffusion)([/_.-]|$)/i
/** 视频档命名特征:video / sora / kling / seedance / veo / runway / luma / pixverse / vidu */
const VIDEO_ID_RE = /(^|[/_.-])(video|sora|kling|seedance|veo|runway|luma|pixverse|vidu)([/_.-]|$)/i
/** 语音档:tts / asr / speech / cosyvoice / melotts / whisper / paraformer / aura / audio */
const SPEECH_ID_RE =
  /(^|[/_.-])(tts|asr|speech|cosyvoice|melotts|whisper|paraformer|aura|audio)([/_.-]|$)/i
/** OCR 档:ocr / paddleocr / tesseract */
const OCR_ID_RE = /(^|[/_.-])(ocr|paddleocr|tesseract)([/_.-]|$)/i

/** 已接通生成通道的裸模型名前缀(图像/视频各自一条,对应后端 agnes 两个端点)。 */
const IMAGE_CHANNEL_PREFIX = 'agnes-image-'
const VIDEO_CHANNEL_PREFIX = 'agnes-video-'

/** 取裸模型名(去掉 provider 前缀),用于通道前缀判定。 */
function bareModelId(modelId: string): string {
  const id = modelId.trim().toLowerCase()
  return id.slice(id.lastIndexOf('/') + 1)
}

/** 判定模型属于哪个生成模态;非模态模型返回 null(=照常走对话链路)。 */
export function mediaKindOfModel(modelId: string | null | undefined): MediaModelKind | null {
  const id = (modelId ?? '').trim()
  if (!id || id === 'auto') return null
  // 顺序有意:先判视频再判图像,`xxx-video-image-edit` 这类混写按视频优先(视频端点是更窄的资源)
  if (VIDEO_ID_RE.test(id)) return 'video'
  if (IMAGE_ID_RE.test(id)) return 'image'
  // 语音/OCR 同属模态档:目录照常展示(机主要求语音可见),但没有可用通道时给明确说明卡
  if (SPEECH_ID_RE.test(id)) return 'speech'
  if (OCR_ID_RE.test(id)) return 'ocr'
  return null
}

/** 供 send-message 注入的最小依赖面(不把 store 类型搬进本模块,避免循环依赖)。 */
export interface MediaSendDeps {
  addMessage: (msg: {
    role: 'user' | 'assistant'
    content: string
    model: string
    permissionMode?: WorkspacePermissionMode
    toolCalls?: ToolCall[]
  }) => string
  updateToolCall: (messageId: string, toolCallId: string, updates: Partial<ToolCall>) => void
  /** 后台持久化(user/assistant 两条各一次,失败不阻断界面) */
  persist: (content: string, role: 'user' | 'assistant') => void
}

interface MediaSendParams {
  text: string
  model: string
  kind: MediaModelKind
  permissionMode?: WorkspacePermissionMode
  deps: MediaSendDeps
}

interface AgnesVideoTask {
  taskId?: string
  status?: string
  result?: { video_url?: string; videoUrl?: string }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** 视频任务轮询上限:4s × 40 = 160s(Agnes 2.5-flash 实测 60-120s 出片)。 */
const VIDEO_POLL_INTERVAL_MS = 4_000
const VIDEO_POLL_MAX_TRIES = 40

/**
 * 该模态档此刻**没有**可执行通道时返回一句明确说明(返回 null = 有通道,可继续);
 * 说明卡的语义是"告诉用户为什么这条路走不通",而不是伪造一次成功。
 */
export function unavailableReason(kind: MediaModelKind, model: string): string | null {
  const bare = bareModelId(model)
  if (kind === 'image') {
    if (bare.startsWith(IMAGE_CHANNEL_PREFIX)) return null
    return `图像模型「${model}」当前没有接通的生成通道(能真出图的只有 Agnes 系列)。请选用「图像」分组里的 agnes-image-2.5-flash。`
  }
  if (kind === 'video') {
    if (bare.startsWith(VIDEO_CHANNEL_PREFIX)) return null
    return `视频模型「${model}」当前没有接通的生成通道(能真出片的只有 Agnes 系列;Sora 已于 2026-09-24 停服)。请选用「视频」分组里的 agnes-video-2.5-flash。`
  }
  if (kind === 'speech') {
    return '当前没有可用的语音通道:通义 Dashscope 语音合成账号欠费(上游返回 Arrearage),其余厂商尚未接产品端点。这条消息不会生成音频、也不会计费。'
  }
  return '当前没有接通的 OCR 通道。这条消息不会执行文字识别,也不会计费。'
}

/**
 * 处理一次"选中模态模型后的发送"。返回 true = 已接管本轮(调用方直接结束),
 * false = 本模块没接手(理论上不会发生,调用方已按 kind 判定过)。
 */
export async function handleMediaModelSend(params: MediaSendParams): Promise<boolean> {
  const { text, model, kind, permissionMode, deps } = params

  deps.addMessage({ role: 'user', content: text, model })
  deps.persist(text, 'user')

  // 没有通道的模态档:只给一句明确说明,不建工具卡、不调上游(不伪造"生成中")
  const unavailable = unavailableReason(kind, model)
  if (unavailable) {
    deps.addMessage({ role: 'assistant', content: unavailable, model, permissionMode })
    deps.persist(unavailable, 'assistant')
    return true
  }

  const toolName = kind === 'image' ? 'image_generation' : 'video_generation'
  const toolCallId = `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const assistantId = deps.addMessage({
    role: 'assistant',
    content: '',
    model,
    permissionMode,
    toolCalls: [
      {
        id: toolCallId,
        toolName,
        args: { prompt: text, model },
        status: 'running',
      },
    ],
  })

  if (kind === 'image') {
    let imageUrl: string | undefined
    let failure = ''
    try {
      const res = await generateImage({ prompt: text, model })
      if (!res.success) failure = res.error || '图像生成失败'
      else imageUrl = res.data?.imageUrl
      if (!imageUrl && !failure) failure = '图像生成失败: 服务端未返回图片地址'
    } catch (e) {
      failure = e instanceof Error ? e.message : '图像生成失败'
    }
    if (imageUrl) {
      deps.updateToolCall(assistantId, toolCallId, {
        status: 'success',
        image_url: imageUrl,
        result: { image_url: imageUrl },
      })
      deps.persist(`已生成图像：${text}`, 'assistant')
      return true
    }
    deps.updateToolCall(assistantId, toolCallId, {
      status: 'error',
      isError: true,
      error: failure,
      result: { error: failure },
    })
    return true
  }

  // 视频:建任务 → 轮询到成片地址
  let taskId = ''
  let failure = ''
  try {
    const create = await fetchApi<{ taskId?: string }>('/api/ai/agnes/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text, mode: 'text' }),
    })
    if (!create.success) failure = create.error || '视频任务创建失败'
    else taskId = create.data?.taskId ?? ''
    if (!taskId && !failure) failure = '视频任务创建失败: 未返回 taskId'
  } catch (e) {
    failure = e instanceof Error ? e.message : '视频任务创建失败'
  }
  if (!taskId) {
    deps.updateToolCall(assistantId, toolCallId, {
      status: 'error',
      isError: true,
      error: failure,
      result: { error: failure },
    })
    return true
  }

  deps.updateToolCall(assistantId, toolCallId, {
    status: 'running',
    result: { task_id: taskId, status: 'queued' },
  })

  for (let i = 0; i < VIDEO_POLL_MAX_TRIES; i += 1) {
    await sleep(VIDEO_POLL_INTERVAL_MS)
    try {
      const r = await fetchApi<AgnesVideoTask>(`/api/ai/agnes/video/tasks/${taskId}`)
      if (!r.success) {
        failure = r.error || '视频任务查询失败'
        break
      }
      const videoUrl = r.data?.result?.video_url || r.data?.result?.videoUrl
      if (videoUrl) {
        deps.updateToolCall(assistantId, toolCallId, {
          status: 'success',
          result: { video_url: videoUrl, task_id: taskId },
        })
        deps.persist(`已生成视频：${text}`, 'assistant')
        return true
      }
      if (r.data?.status === 'failed') {
        failure = '视频生成失败(上游任务失败)'
        break
      }
      deps.updateToolCall(assistantId, toolCallId, {
        status: 'running',
        result: { task_id: taskId, status: r.data?.status ?? 'running' },
      })
    } catch (e) {
      failure = e instanceof Error ? e.message : '视频任务查询失败'
      break
    }
  }
  if (!failure) failure = '视频生成超时(160s 未出片)'
  deps.updateToolCall(assistantId, toolCallId, {
    status: 'error',
    isError: true,
    error: failure,
    result: { task_id: taskId, error: failure },
  })
  return true
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
