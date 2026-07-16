'use client'

import * as React from 'react'
import { toast } from 'sonner'

import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useAIWebSocket, type AIWSMessage } from '@/hooks/use-ai-websocket'
import { useAiHelpers, type UseAiHelpersOptions } from './use-ai-helpers'
import type { AgentContentListItem, AiModelKey, IHuiLlmBody } from './types/ai-talk'

export interface UseAiTalkReturn {
  talk: (modelNameEN: AiModelKey, idstring: string, zidingyican?: unknown) => Promise<void>
  handleCosyVoiceV3: (idstring: string) => Promise<void>
  handleKeling: (idstring: string, zidingyican?: unknown) => Promise<void>
  handleSora2: (idstring: string, zidingyican?: unknown) => Promise<void>
  handleVolcengineT2v: (idstring: string, zidingyican?: unknown) => Promise<void>
  handleDoubaoSeedream40: (idstring: string, zidingyican?: unknown) => Promise<void>
  handleQwenImage: (idstring: string, zidingyican?: unknown) => Promise<void>
  handleQwenImageEdit: (idstring: string, zidingyican?: unknown) => Promise<void>
  handleWan25I2vPreview: (idstring: string, zidingyican?: unknown) => Promise<void>
  handleHunyuanTo3D: (idstring: string, zidingyican?: unknown) => Promise<void>
  handleNanoBanana: (idstring: string, zidingyican?: unknown) => Promise<void>
  handleVeo3Frames: (idstring: string, zidingyican?: unknown) => Promise<void>
  handleHttpModel: (idstring: string, zidingyican?: unknown) => Promise<void>
  handleDashscopeVideoGenerate: (idstring: string, zidingyican?: unknown) => Promise<void>
  handleQwenOmni: (idstring: string, zidingyican?: unknown) => Promise<void>
  agentContentList: AgentContentListItem[]
  setPrompt: (text: string) => void
  setImgsList: (value: Array<{ imgUrl: string }>) => void
  clearInput: () => void
}

const PLACEHOLDER_MARK = '__placeholder__'

function makeItem(partial: Partial<AgentContentListItem>): AgentContentListItem {
  return { content: '', imgUrlList: [], totalTokens: 0, isHaveSikao: false, ...partial }
}

function makePlaceholder(): AgentContentListItem {
  return makeItem({ debugInfo: PLACEHOLDER_MARK })
}

/**
 * AI Talk 入口 Hook。迁移自旧项目 aiBase.js 的 talk + 17 handle 方法,简化为 React hook:
 * talk 按 modelNameEN 分发到 14 个 handle 方法,默认走 handleHttpModel 兜底。
 */
export function useAiTalk(options: UseAiHelpersOptions = {}): UseAiTalkReturn {
  const helpers = useAiHelpers(options)
  const ws = useAIWebSocket('generic')
  const wsWaitingRef = React.useRef(false)
  const wsResolverRef = React.useRef<((msg: AIWSMessage) => void) | null>(null)
  const timersRef = React.useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  React.useEffect(() => {
    if (wsWaitingRef.current && wsResolverRef.current && ws.lastMessage) {
      wsWaitingRef.current = false
      const resolver = wsResolverRef.current
      wsResolverRef.current = null
      resolver(ws.lastMessage)
    }
  }, [ws.lastMessage])

  React.useEffect(
    () => () => {
      timersRef.current.forEach((t) => clearTimeout(t))
      timersRef.current.clear()
    },
    [],
  )

  const requestByWebSocket = React.useCallback(
    (payload: unknown, timeoutMs = 60000): Promise<AIWSMessage> => {
      return new Promise<AIWSMessage>((resolve, reject) => {
        if (!ws.isConnected) {
          reject(new Error('WebSocket 未连接'))
          return
        }
        const timer = setTimeout(() => {
          wsWaitingRef.current = false
          wsResolverRef.current = null
          reject(new Error('WebSocket 请求超时'))
        }, timeoutMs)
        wsResolverRef.current = (msg) => {
          clearTimeout(timer)
          resolve(msg)
        }
        wsWaitingRef.current = true
        ws.send(payload)
      })
    },
    [ws.isConnected, ws.send],
  )

  const buildIhuiLlmBody = React.useCallback(
    (idstring: string, extra?: Record<string, unknown>): IHuiLlmBody => ({
      prompt: helpers.getPrompt(),
      model_id: helpers.getModelCode(),
      user_uuid: useAuthStore.getState().user?.id ?? '',
      chat_id: idstring,
      imgsList: helpers.getImgsList().map((i) => ({ imgUrl: i.imgUrl })),
      zidingyican: extra,
    }),
    [helpers],
  )

  const handleCosyVoiceV3 = React.useCallback(
    async (idstring: string) => {
      // TODO: POST /api/ai/cosyvoice 后端校准
      const res = await fetchApi<{ audioUrl?: string; url?: string }>('/api/ai/cosyvoice', {
        method: 'POST',
        body: JSON.stringify({
          copyWriting: helpers.getPrompt(),
          chatId: idstring,
          audioId: '',
          audioPath: '',
        }),
      })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      helpers.pushData(makeItem({ audioUrl: res.data.audioUrl ?? res.data.url }))
    },
    [helpers],
  )

  const handleKeling = React.useCallback(
    async (idstring: string, _zidingyican?: unknown) => {
      const body = buildIhuiLlmBody(idstring)
      // TODO: POST /api/ai/keling/audio/start 后端校准
      const start = await fetchApi<{ task_id: string }>('/api/ai/keling/audio/start', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!start.success) {
        toast.error(start.error)
        return
      }
      helpers.getaudio(
        start.data.task_id,
        (data) => helpers.pushData(makeItem({ audioUrl: data?.audio_url })),
        (err) => toast.error(err),
      )
    },
    [helpers, buildIhuiLlmBody],
  )

  const handleSora2 = React.useCallback(
    async (idstring: string, _zidingyican?: unknown) => {
      const body = buildIhuiLlmBody(idstring)
      // TODO: POST /api/ai/sora/request 后端校准
      const start = await fetchApi<{ id: string; task_id?: string }>('/api/ai/sora/request', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!start.success) {
        toast.error(start.error)
        return
      }
      helpers.getvideo(
        start.data.task_id ?? start.data.id,
        (data) => helpers.pushData(makeItem({ videoUrl: data?.video_url ?? data?.url })),
        (err) => toast.error(err),
      )
    },
    [helpers, buildIhuiLlmBody],
  )

  const handleVolcengineT2v = React.useCallback(
    async (idstring: string, _zidingyican?: unknown) => {
      const body = buildIhuiLlmBody(idstring)
      // TODO: POST /api/ai/llm/chat (volcengine-t2v) 后端校准
      const res = await fetchApi<{ image_url?: string }>('/api/ai/llm/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      helpers.pushData(makeItem({ imgUrlList: res.data.image_url ? [res.data.image_url] : [] }))
    },
    [helpers, buildIhuiLlmBody],
  )

  const handleDoubaoSeedream40 = React.useCallback(
    async (idstring: string, _zidingyican?: unknown) => {
      const body = buildIhuiLlmBody(idstring)
      // TODO: POST /api/ai/llm/chat (doubao-seedream-4.0) 后端校准
      const res = await fetchApi<{ image_url?: string }>('/api/ai/llm/chat', {
        method: 'POST',
        body: JSON.stringify({
          ...body,
          model_id: helpers.getModelCodeByName('doubao-seedream-4.0') || body.model_id,
        }),
      })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      helpers.pushData(makeItem({ imgUrlList: res.data.image_url ? [res.data.image_url] : [] }))
    },
    [helpers, buildIhuiLlmBody],
  )

  const handleQwenImage = React.useCallback(
    async (idstring: string, _zidingyican?: unknown) => {
      const body = buildIhuiLlmBody(idstring)
      // TODO: POST /api/ai/dashscope/image/generate 后端校准,双格式兼容
      const res = await fetchApi<{
        image_url?: string
        data?: { output?: { results?: Array<{ url?: string }> } }
      }>('/api/ai/dashscope/image/generate', { method: 'POST', body: JSON.stringify(body) })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      const url = res.data.image_url ?? res.data.data?.output?.results?.[0]?.url ?? ''
      helpers.pushData(makeItem({ imgUrlList: url ? [url] : [] }))
    },
    [helpers, buildIhuiLlmBody],
  )

  const handleQwenImageEdit = React.useCallback(
    async (idstring: string, _zidingyican?: unknown) => {
      const imgs = helpers.getImgsList()
      if (imgs.length === 0) {
        toast.warning('图片编辑需要 1 张图片')
        return
      }
      const body = buildIhuiLlmBody(idstring, { imgUrl: imgs[0]?.imgUrl ?? '' })
      // TODO: POST /api/ai/dashscope/image-edit 后端校准
      const res = await fetchApi<{ data?: { image?: string } }>('/api/ai/dashscope/image-edit', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      helpers.pushData(makeItem({ imgUrlList: res.data.data?.image ? [res.data.data.image] : [] }))
    },
    [helpers, buildIhuiLlmBody],
  )

  const handleWan25I2vPreview = React.useCallback(
    async (idstring: string, _zidingyican?: unknown) => {
      const body = buildIhuiLlmBody(idstring)
      try {
        const msg = await requestByWebSocket({
          ...body,
          model: 'wan2.5-t2v-plus',
          duration: 5,
          seed: 3,
        })
        const data = (msg.data ?? {}) as Record<string, unknown>
        const videoUrl =
          typeof data.video_url === 'string'
            ? data.video_url
            : typeof data.url === 'string'
              ? data.url
              : ''
        helpers.pushData(makeItem({ videoUrl }))
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'WebSocket 请求失败')
      }
    },
    [helpers, buildIhuiLlmBody, requestByWebSocket],
  )

  const handleHunyuanTo3D = React.useCallback(
    async (idstring: string, _zidingyican?: unknown) => {
      const body = buildIhuiLlmBody(idstring)
      // TODO: POST /api/ai/hunyuan/3d/submit 后端校准
      const submit = await fetchApi<{ task_id: string }>('/api/ai/hunyuan/3d/submit', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!submit.success) {
        toast.error(submit.error)
        return
      }
      // TODO: GET /api/ai/hunyuan/3d/query 后端校准,300s 后轮询
      const timer = setTimeout(() => {
        timersRef.current.delete(timer)
        helpers.getvideo(
          submit.data.task_id,
          (data) => helpers.pushData(makeItem({ videoUrl: data?.url })),
          (err) => toast.error(err),
        )
      }, 300000)
      timersRef.current.add(timer)
    },
    [helpers, buildIhuiLlmBody],
  )

  const handleNanoBanana = React.useCallback(
    async (idstring: string, _zidingyican?: unknown) => {
      const body = buildIhuiLlmBody(idstring)
      // TODO: POST /api/ai/gemini/nano-banana 后端校准 (Gemini 2.5 Flash Image)
      const res = await fetchApi<{ data?: { uploaded_files?: Array<{ image_url?: string }> } }>(
        '/api/ai/gemini/nano-banana',
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (!res.success) {
        toast.error(res.error)
        return
      }
      const urls = (res.data.data?.uploaded_files ?? [])
        .map((f) => f.image_url)
        .filter((u): u is string => !!u)
      helpers.pushData(makeItem({ imgUrlList: urls }))
    },
    [helpers, buildIhuiLlmBody],
  )

  const handleVeo3Frames = React.useCallback(
    async (idstring: string, _zidingyican?: unknown) => {
      const body = buildIhuiLlmBody(idstring)
      // TODO: POST /api/ai/google/veo3 后端校准
      const res = await fetchApi<{ lists?: unknown[]; video_url?: string }>('/api/ai/google/veo3', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      if (res.data.lists) {
        helpers.pushData(makeItem({ hasLists: true, lists: helpers.processListsData(res.data) }))
      } else {
        helpers.pushData(makeItem({ videoUrl: res.data.video_url }))
      }
    },
    [helpers, buildIhuiLlmBody],
  )

  const handleHttpModel = React.useCallback(
    async (idstring: string, _zidingyican?: unknown) => {
      const body = buildIhuiLlmBody(idstring)
      // TODO: HTTP 兜底,5 种返回格式兼容:lists / video_url / image_url / image_urls[] / data.content
      const res = await fetchApi<{
        lists?: unknown[]
        video_url?: string
        image_url?: string
        image_urls?: string[]
        data?: { content?: string }
      }>('/api/ai/llm/chat', { method: 'POST', body: JSON.stringify(body) })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      if (res.data.lists) {
        helpers.pushData(makeItem({ hasLists: true, lists: helpers.processListsData(res.data) }))
      } else if (res.data.video_url) {
        helpers.pushData(makeItem({ videoUrl: res.data.video_url }))
      } else if (res.data.image_url) {
        helpers.pushData(makeItem({ imgUrlList: [res.data.image_url] }))
      } else if (res.data.image_urls && res.data.image_urls.length > 0) {
        helpers.pushData(makeItem({ imgUrlList: res.data.image_urls }))
      } else if (res.data.data?.content) {
        helpers.pushData(makeItem({ content: helpers.filterSpecialMarkers(res.data.data.content) }))
      }
    },
    [helpers, buildIhuiLlmBody],
  )

  const handleDashscopeVideoGenerate = React.useCallback(
    async (idstring: string, _zidingyican?: unknown) => {
      const body = buildIhuiLlmBody(idstring)
      // TODO: POST /api/ai/dashscope/video/generate 后端校准 (扩展)
      const start = await fetchApi<{ task_id: string }>('/api/ai/dashscope/video/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!start.success) {
        toast.error(start.error)
        return
      }
      helpers.getvideo(
        start.data.task_id,
        (data) => helpers.pushData(makeItem({ videoUrl: data?.video_url ?? data?.url })),
        (err) => toast.error(err),
      )
    },
    [helpers, buildIhuiLlmBody],
  )

  const handleQwenOmni = React.useCallback(
    async (idstring: string, _zidingyican?: unknown) => {
      const body = buildIhuiLlmBody(idstring)
      // TODO: POST /api/ai/qwen/omni 后端校准 (qwen-omni 多模态扩展)
      const res = await fetchApi<{ content?: string; lists?: unknown[] }>('/api/ai/qwen/omni', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      if (res.data.lists) {
        helpers.pushData(makeItem({ hasLists: true, lists: helpers.processListsData(res.data) }))
      } else {
        helpers.pushData(
          makeItem({ content: helpers.filterSpecialMarkers(res.data.content ?? '') }),
        )
      }
    },
    [helpers, buildIhuiLlmBody],
  )

  const talk = React.useCallback(
    async (modelNameEN: AiModelKey, idstring: string, zidingyican?: unknown) => {
      helpers.setAgentContentList((prev) => [...prev, makePlaceholder()])
      try {
        switch (modelNameEN) {
          case 'cosyvoice-v3':
            return await handleCosyVoiceV3(idstring)
          case 'keling':
            return await handleKeling(idstring, zidingyican)
          case 'sora-2':
            return await handleSora2(idstring, zidingyican)
          case 'volcengine-t2v':
            return await handleVolcengineT2v(idstring, zidingyican)
          case 'doubao-seedream-4.0':
            return await handleDoubaoSeedream40(idstring, zidingyican)
          case 'qwen-image':
            return await handleQwenImage(idstring, zidingyican)
          case 'qwen-image-Edit':
            return await handleQwenImageEdit(idstring, zidingyican)
          case 'wan2.5-i2v-preview':
          case 'wan2.5-i2v-previe':
            return await handleWan25I2vPreview(idstring, zidingyican)
          case 'hunyuanTo3D':
            return await handleHunyuanTo3D(idstring, zidingyican)
          case 'Nano_Banana':
            return await handleNanoBanana(idstring, zidingyican)
          case 'veo3-frames':
            return await handleVeo3Frames(idstring, zidingyican)
          case 'qwen-omni':
            return await handleQwenOmni(idstring, zidingyican)
          // TODO: qwen-plus / Doubao-1.6 / GLM-4.5 走 WebSocket,暂用 HTTP 兜底
          case 'qwen-plus':
          case 'Doubao-1.6':
          case 'GLM-4.5':
            return await handleHttpModel(idstring, zidingyican)
          default:
            return await handleHttpModel(idstring, zidingyican)
        }
      } catch (e) {
        helpers.pushData(makeItem({ error: e instanceof Error ? e.message : '请求失败' }))
      }
    },
    [
      helpers,
      handleCosyVoiceV3,
      handleKeling,
      handleSora2,
      handleVolcengineT2v,
      handleDoubaoSeedream40,
      handleQwenImage,
      handleQwenImageEdit,
      handleWan25I2vPreview,
      handleHunyuanTo3D,
      handleNanoBanana,
      handleVeo3Frames,
      handleQwenOmni,
      handleHttpModel,
    ],
  )

  return {
    talk,
    handleCosyVoiceV3,
    handleKeling,
    handleSora2,
    handleVolcengineT2v,
    handleDoubaoSeedream40,
    handleQwenImage,
    handleQwenImageEdit,
    handleWan25I2vPreview,
    handleHunyuanTo3D,
    handleNanoBanana,
    handleVeo3Frames,
    handleHttpModel,
    handleDashscopeVideoGenerate,
    handleQwenOmni,
    agentContentList: helpers.agentContentList,
    setPrompt: helpers.setPrompt,
    setImgsList: helpers.setImgsList,
    clearInput: helpers.clearInput,
  }
}
