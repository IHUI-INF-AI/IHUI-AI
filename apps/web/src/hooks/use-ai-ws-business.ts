'use client'

import * as React from 'react'
import { toast } from 'sonner'

import { type AIWSProvider, PROVIDER_PATHS } from '@/hooks/use-ai-websocket'
import { useAuthStore } from '@/stores/auth'

// TODO: 类型应从 @/hooks/types/ai-talk.ts 导入(use-ai-talk.ts 创建后切换)
// 当前 use-ai-talk.ts / types/ai-talk.ts 尚未创建,使用本地 stub

/** AI 模型标识(对应旧项目 name 参数,7 种变体 + 兜底) */
export type AiModelKey =
  | 'wan2.5-i2v-preview'
  | 'wan2.5-i2v-previe'
  | 'qwen-plus'
  | 'Doubao-1.6'
  | 'GLM-4.5'
  | 'qwen-omni'
  | (string & {})

/** Agent 内容列表项(对应旧项目 agent_content_list[i]) */
export interface AgentContentListItem {
  content: string
  content1: string
  imgUrlList: string[]
  videoUrl?: string
  video_ratio?: string
  total_tokens: number
  isHaveSikao: boolean
  thinkingContent?: string
}

/**
 * 4 种 WebSocket 消息类型(对应旧项目 aiWebSocketMixin 处理的事件)
 * 1. conversation.message.delta — 思考增量
 * 2. conversation.chat.completed — 回复增量
 * 3. 流式响应完成 — 关闭 socket
 * 4. code:200 + data.type:success — wan2.5 视频结果
 */
export type WebSocketAiMessage =
  | { event: 'conversation.message.delta'; data: { content: string } }
  | { event: 'conversation.chat.completed'; data: { content: string } }
  | { message: '流式响应完成' }
  | { code: 200; data: { type: 'success'; url?: string } }

/** WebSocket 发送参数(7 种变体的联合对象) */
export interface WebSocketSendParam {
  type?: 'chat'
  model?: string
  prompt?: string
  img_url?: string
  prompt_extend?: boolean
  watermark?: boolean
  images?: Array<{ imgUrl: string }>
  messages?: Array<{ role: string; content: string }>
  thinking?: { type: 'auto' }
  /** 顶层 user_uuid(wan2.5/GLM-4.5/qwen-omni/默认变体使用);type:'chat' 变体放在 data 内 */
  user_uuid?: string
  /** 顶层 chat_id(wan2.5/GLM-4.5/qwen-omni/默认变体使用);type:'chat' 变体放在 data 内 */
  chat_id?: string
  zidingyican?: unknown
  data?: {
    messages: Array<{ role: string; content: string }>
    user_uuid: string
    model?: string
    chat_id: string
    zidingyican?: unknown
  }
  [key: string]: unknown
}

const DEFAULT_WS_PATH = '/v1/ai/capabilities/ws/stream'

/** 模型变体 → WS provider 映射(7 种变体 + 兜底) */
export function modelToProvider(model: string): AIWSProvider {
  if (model.startsWith('wan2.5-i2v')) return 'qwen'
  if (model === 'qwen-plus' || model === 'qwen-omni') return 'qwen'
  if (model === 'Doubao-1.6') return 'doubao'
  if (model === 'GLM-4.5') return 'zhipu'
  return 'generic'
}

/** Token 余额不足关键词 */
const TOKEN_BALANCE_KEYWORDS = ['50000', '余额不足', 'token余额'] as const

export interface UseAiWebSocketOptions {
  prompt?: string
  imgsList?: Array<{ imgUrl: string }>
  modelConfigChangeData?: Record<string, unknown>
  userUuid?: string
  wsPath?: string
  modelName?: string
  onClearInput?: () => void
  onScrollToBottom?: () => void
  onClearThinkingProcessLogic?: () => void
}

export interface UseAiWebSocketReturn {
  requestByWebSocket: (name: AiModelKey, idstring: string, zidingyican?: unknown) => void
  buildWebSocketParams: (
    name: AiModelKey,
    idstring: string,
    zidingyican: unknown,
    imageUrl?: string,
  ) => WebSocketSendParam
  connectWebSocket: (param: WebSocketSendParam, newIndex: number, name: AiModelKey) => void
  handleWebSocketMessage: (res: { data: string }, newIndex: number, name: AiModelKey) => void
  handleWanVideoResponse: (obj: Record<string, unknown>, newIndex: number) => void
  handleChatResponse: (obj: Record<string, unknown>, newIndex: number) => void
  checkTokenBalance: (messageObj: unknown) => boolean
  sendTask: (param: WebSocketSendParam) => void
  socketTaskRef: React.MutableRefObject<WebSocket | null>
  displayedTexts: string[]
  displayedThinkingTexts: string[]
  agentContentList: AgentContentListItem[]
  loading: boolean
  talking: boolean
}

/**
 * AI WebSocket 业务方法 Hook(迁移自旧项目 aiWebSocketMixin.js)。
 *
 * 8 业务方法:
 * 1. requestByWebSocket — WebSocket 入口
 * 2. buildWebSocketParams — 7 种参数变体构建
 * 3. connectWebSocket — 浏览器 new WebSocket + 事件绑定
 * 4. handleWebSocketMessage — 总分发(checkTokenBalance → wan2.5/chat)
 * 5. handleWanVideoResponse — wan2.5 视频结果处理
 * 6. handleChatResponse — chat 流式增量处理
 * 7. checkTokenBalance — 余额不足检测
 * 8. sendTask — socketTask.send + GLM-4.5 特殊处理
 */
export function useAiWebSocket(options: UseAiWebSocketOptions = {}): UseAiWebSocketReturn {
  const {
    prompt = '',
    imgsList = [],
    modelConfigChangeData = {},
    userUuid = '',
    wsPath = DEFAULT_WS_PATH,
    modelName = '',
    onClearInput,
    onScrollToBottom,
    onClearThinkingProcessLogic,
  } = options

  const socketTaskRef = React.useRef<WebSocket | null>(null)
  const [displayedTexts, setDisplayedTexts] = React.useState<string[]>([])
  const [displayedThinkingTexts, setDisplayedThinkingTexts] = React.useState<string[]>([])
  const [agentContentList, setAgentContentList] = React.useState<AgentContentListItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [talking, setTalking] = React.useState(false)

  const displayedAgentContent1Ref = React.useRef('')
  const textIndexRef = React.useRef(0)

  /** 方法 2:按 name 构建 7 种参数变体 */
  const buildWebSocketParams = React.useCallback(
    (
      name: AiModelKey,
      idstring: string,
      zidingyican: unknown,
      imageUrl?: string,
    ): WebSocketSendParam => {
      const hasZidingyican = zidingyican && Array.isArray(zidingyican) && zidingyican.length > 0
      const zidingyicanPayload = hasZidingyican ? { zidingyican } : {}

      if (name === 'wan2.5-i2v-preview' || name === 'wan2.5-i2v-previe') {
        return {
          ...modelConfigChangeData,
          prompt,
          model: name,
          img_url: imageUrl,
          prompt_extend: true,
          watermark: false,
          user_uuid: userUuid,
          chat_id: idstring,
          ...zidingyicanPayload,
        }
      }

      if (name === 'qwen-plus') {
        return {
          type: 'chat',
          data: {
            messages: [{ role: 'user', content: prompt }],
            user_uuid: userUuid,
            model: 'qwen-plus',
            chat_id: idstring,
            ...zidingyicanPayload,
          },
        }
      }

      if (name === 'Doubao-1.6') {
        return {
          type: 'chat',
          data: {
            messages: [{ role: 'user', content: prompt }],
            user_uuid: userUuid,
            chat_id: idstring,
            ...zidingyicanPayload,
          },
        }
      }

      if (name === 'GLM-4.5') {
        return {
          messages: [{ role: 'user', content: prompt }],
          user_uuid: userUuid,
          thinking: { type: 'auto' },
          chat_id: idstring,
          ...zidingyicanPayload,
        }
      }

      if (name === 'qwen-omni') {
        return {
          prompt,
          user_uuid: userUuid,
          model: 'qwen-omni',
          chat_id: idstring,
          ...zidingyicanPayload,
        }
      }

      // 默认参数变体
      return {
        messages: [{ role: 'user', content: prompt }],
        prompt,
        images: imgsList,
        user_uuid: userUuid,
        thinking: { type: 'auto' },
        chat_id: idstring,
        ...zidingyicanPayload,
      }
    },
    [prompt, imgsList, modelConfigChangeData, userUuid],
  )

  /** 方法 7:检测 token 余额不足(50000 / 余额不足 / token余额) */
  const checkTokenBalance = React.useCallback((messageObj: unknown): boolean => {
    if (!messageObj || typeof messageObj !== 'object') return false
    const obj = messageObj as Record<string, unknown>
    const messageText = typeof obj.message === 'string' ? obj.message.toLowerCase() : ''
    const dataText =
      typeof obj.data === 'string'
        ? obj.data.toLowerCase()
        : JSON.stringify(obj.data ?? '').toLowerCase()
    const errorField = typeof obj.error === 'string' ? obj.error.toLowerCase() : ''
    const fullText = JSON.stringify(obj).toLowerCase()

    return TOKEN_BALANCE_KEYWORDS.some(
      (kw) =>
        fullText.includes(kw.toLowerCase()) ||
        messageText.includes(kw.toLowerCase()) ||
        dataText.includes(kw.toLowerCase()) ||
        errorField.includes(kw.toLowerCase()),
    )
  }, [])

  /** 方法 5:处理 wan2.5 视频结果(code:200 + data.type==='success') */
  const handleWanVideoResponse = React.useCallback(
    (obj: Record<string, unknown>, newIndex: number) => {
      if (obj.message === '流式响应完成') return

      const code = obj.code
      const data = obj.data as Record<string, unknown> | undefined
      const isSuccess = Boolean(
        (code === 200 && data) ||
        (data && (data.type === 'success' || data.event === 'video_synthesis.success')),
      )

      onClearThinkingProcessLogic?.()
      const currentIndex = newIndex > 0 ? newIndex - 1 : 0

      if (isSuccess && data) {
        const contentText =
          (typeof data.content === 'string' && data.content) ||
          (typeof data.message === 'string' && data.message) ||
          '视频生成完成'
        const videoUrl = typeof data.video_url === 'string' ? data.video_url : ''
        const totalTokens = typeof data.total_tokens === 'number' ? data.total_tokens : 0
        const videoRatio = typeof data.video_ratio === 'string' ? data.video_ratio : '16:9'

        setAgentContentList((prev) => {
          const next = [...prev]
          const existing = next[currentIndex]
          if (existing) {
            next[currentIndex] = {
              ...existing,
              content: contentText,
              content1: contentText,
              videoUrl,
              video_ratio: videoRatio,
              total_tokens: totalTokens,
              isHaveSikao: true,
            }
          } else {
            next.push({
              content: contentText,
              content1: contentText,
              imgUrlList: [],
              videoUrl,
              video_ratio: videoRatio,
              total_tokens: totalTokens,
              isHaveSikao: true,
            })
          }
          return next
        })
      } else {
        setAgentContentList((prev) => {
          const next = [...prev]
          const existing = next[currentIndex]
          if (existing) {
            next[currentIndex] = {
              ...existing,
              content: '视频生成失败,请重试',
              content1: '',
              videoUrl: '',
              video_ratio: '16:9',
              total_tokens: 0,
              isHaveSikao: false,
            }
          } else {
            next.push({
              content: '视频生成失败,请重试',
              content1: '',
              imgUrlList: [],
              videoUrl: '',
              video_ratio: '16:9',
              total_tokens: 0,
              isHaveSikao: false,
            })
          }
          return next
        })
      }

      setDisplayedTexts((prev) => {
        const next = [...prev]
        if (!next[currentIndex]) next[currentIndex] = ''
        return next
      })

      onClearInput?.()
      onScrollToBottom?.()
    },
    [onClearThinkingProcessLogic, onClearInput, onScrollToBottom],
  )

  /** 方法 6:处理 chat 流式(conversation.message.delta / conversation.chat.completed / 流式响应完成) */
  const handleChatResponse = React.useCallback(
    (obj: Record<string, unknown>, newIndex: number) => {
      const event = obj.event as string | undefined
      const data = obj.data as { content?: string } | undefined
      const textIndex = textIndexRef.current

      if (data && data.content) {
        if (event === 'conversation.message.delta') {
          const filtered = data.content.replace(/[*#]+/g, '')
          displayedAgentContent1Ref.current += filtered
          const targetIndex = newIndex >= 0 ? newIndex : textIndex >= 0 ? textIndex : newIndex
          if (targetIndex >= 0) {
            setDisplayedThinkingTexts((prev) => {
              const next = [...prev]
              next[targetIndex] = displayedAgentContent1Ref.current
              return next
            })
            setAgentContentList((prev) => {
              const existing = prev[targetIndex]
              if (!existing) return prev
              const next = [...prev]
              next[targetIndex] = { ...existing, isHaveSikao: true }
              return next
            })
          }
        } else if (event === 'conversation.chat.completed') {
          onClearThinkingProcessLogic?.()
          const filtered = data.content.replace(/[*#]+/g, '')
          setDisplayedTexts((prev) => {
            const next = [...prev]
            if (next[textIndex] === undefined) next[textIndex] = ''
            const cur = next[textIndex]
            if (cur !== undefined) next[textIndex] = cur + filtered
            return next
          })
        }
        onScrollToBottom?.()
      } else if (obj.message === '流式响应完成') {
        const targetIndex = newIndex >= 0 ? newIndex : textIndex >= 0 ? textIndex : newIndex
        if (displayedAgentContent1Ref.current && targetIndex >= 0) {
          setAgentContentList((prev) => {
            const existing = prev[targetIndex]
            if (!existing) return prev
            const next = [...prev]
            next[targetIndex] = {
              ...existing,
              thinkingContent: displayedAgentContent1Ref.current,
              isHaveSikao: true,
            }
            return next
          })
          setDisplayedThinkingTexts((prev) => {
            const next = [...prev]
            next[targetIndex] = displayedAgentContent1Ref.current
            return next
          })
        }
        onClearThinkingProcessLogic?.()
        onClearInput?.()
        onScrollToBottom?.()
        const ws = socketTaskRef.current
        if (ws) {
          try {
            ws.close()
          } catch {
            /* ignore */
          }
        }
      }
    },
    [onClearThinkingProcessLogic, onClearInput, onScrollToBottom],
  )

  /** 方法 4:总分发 — 先 checkTokenBalance,然后 wan2.5 走 handleWanVideoResponse,其余走 handleChatResponse */
  const handleWebSocketMessage = React.useCallback(
    (res: { data: string }, newIndex: number, name: AiModelKey) => {
      let obj: Record<string, unknown>
      try {
        obj = JSON.parse(res.data) as Record<string, unknown>
      } catch {
        return
      }
      if (!obj) return

      if (checkTokenBalance(obj)) {
        onClearThinkingProcessLogic?.()
        setLoading(false)
        setTalking(false)
        const ws = socketTaskRef.current
        if (ws) {
          try {
            ws.close()
          } catch {
            /* ignore */
          }
        }
        toast.error('智汇值不足', {
          description: '您的智汇值余额小于 50000,无法使用大模型,请前往充值',
        })
        return
      }

      if (name === 'wan2.5-i2v-preview' || name === 'wan2.5-i2v-previe') {
        handleWanVideoResponse(obj, newIndex)
      } else {
        handleChatResponse(obj, newIndex)
      }

      const totalTokens = obj.total_tokens
      if (totalTokens && newIndex > 0) {
        setAgentContentList((prev) => {
          const existing = prev[newIndex - 1]
          if (!existing) return prev
          const next = [...prev]
          next[newIndex - 1] = {
            ...existing,
            total_tokens: typeof totalTokens === 'number' ? totalTokens : 0,
            isHaveSikao: true,
          }
          return next
        })
      }
    },
    [checkTokenBalance, handleWanVideoResponse, handleChatResponse, onClearThinkingProcessLogic],
  )

  /** 方法 8:socketTask.send + GLM-4.5 特殊处理 thinkingProgress=100 */
  const sendTask = React.useCallback(
    (param: WebSocketSendParam) => {
      const ws = socketTaskRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      try {
        ws.send(JSON.stringify(param))
        if (modelName === 'GLM-4.5') {
          setTalking(true)
          setDisplayedTexts((prev) => [...prev, ''])
        }
      } catch {
        setLoading(false)
        onClearThinkingProcessLogic?.()
        setAgentContentList((prev) => [
          ...prev,
          {
            content: '发送失败,请重试',
            content1: '',
            imgUrlList: [],
            total_tokens: 0,
            isHaveSikao: false,
          },
        ])
        try {
          ws.close()
        } catch {
          /* ignore */
        }
      }
    },
    [modelName, onClearThinkingProcessLogic],
  )

  /** 方法 3:浏览器 new WebSocket + onOpen/onMessage/onError/onClose */
  const connectWebSocket = React.useCallback(
    (param: WebSocketSendParam, newIndex: number, name: AiModelKey) => {
      if (typeof window === 'undefined') return
      const token = useAuthStore.getState().token
      if (!token) {
        setLoading(false)
        toast.error('请先登录')
        return
      }
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const provider = modelToProvider(name)
      const path = wsPath !== DEFAULT_WS_PATH ? wsPath : PROVIDER_PATHS[provider]
      const socketUrl = `${proto}//${window.location.host}${path}?token=${encodeURIComponent(token)}`

      let ws: WebSocket
      try {
        ws = new WebSocket(socketUrl)
      } catch {
        setLoading(false)
        setAgentContentList((prev) => [
          ...prev,
          {
            content: '连接失败,请重试',
            content1: '',
            imgUrlList: [],
            total_tokens: 0,
            isHaveSikao: false,
          },
        ])
        toast.error('连接失败')
        return
      }
      socketTaskRef.current = ws

      ws.onopen = () => {
        sendTask(param)
      }

      ws.onmessage = (event: MessageEvent) => {
        handleWebSocketMessage({ data: event.data }, newIndex, name)
      }

      ws.onerror = () => {
        setTalking(false)
        setLoading(false)
        setAgentContentList((prev) => [
          ...prev,
          {
            content: '连接错误,请重试',
            content1: '',
            imgUrlList: [],
            total_tokens: 0,
            isHaveSikao: false,
          },
        ])
        onClearThinkingProcessLogic?.()
        try {
          ws.close()
        } catch {
          /* ignore */
        }
      }

      ws.onclose = () => {
        setTalking(false)
        setLoading(false)
      }
    },
    [wsPath, sendTask, handleWebSocketMessage, onClearThinkingProcessLogic],
  )

  /** 方法 1:WebSocket 入口 — 构建 param + sendTask/connectWebSocket */
  const requestByWebSocket = React.useCallback(
    (name: AiModelKey, idstring: string, zidingyican?: unknown) => {
      setLoading(true)
      const imageUrl = imgsList.length > 0 ? imgsList[0]?.imgUrl : undefined

      if (name === 'wan2.5-i2v-previe' && imgsList.length > 1) {
        toast.error('视频生成只支持上传一张图片')
      }

      const param = buildWebSocketParams(name, idstring, zidingyican ?? null, imageUrl)
      const newIndex = agentContentList.length
      textIndexRef.current = displayedTexts.length

      if (talking) {
        sendTask(param)
      } else {
        connectWebSocket(param, newIndex, name)
      }
    },
    [
      imgsList,
      agentContentList.length,
      displayedTexts.length,
      talking,
      buildWebSocketParams,
      sendTask,
      connectWebSocket,
    ],
  )

  // 卸载时关闭 WS
  React.useEffect(() => {
    return () => {
      const ws = socketTaskRef.current
      if (ws) {
        try {
          ws.close()
        } catch {
          /* ignore */
        }
      }
    }
  }, [])

  return {
    requestByWebSocket,
    buildWebSocketParams,
    connectWebSocket,
    handleWebSocketMessage,
    handleWanVideoResponse,
    handleChatResponse,
    checkTokenBalance,
    sendTask,
    socketTaskRef,
    displayedTexts,
    displayedThinkingTexts,
    agentContentList,
    loading,
    talking,
  }
}
