'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'
import type { AgentContentListItem, TaskPollingResult } from './types/ai-talk'

/** 模型清单条目(用于 getModelCode / getModelCodeByName) */
export interface AiModelEntry {
  name: string
  code: string
  [key: string]: unknown
}

export interface UseAiHelpersOptions {
  modelList?: AiModelEntry[]
  currentModelName?: string
}

/** AgentContentListItem.lists 元素类型 */
type ListItem = NonNullable<NonNullable<AgentContentListItem['lists']>[number]>

export interface UseAiHelpersReturn {
  imgsList: Array<{ imgUrl: string }>
  setImgsList: (value: Array<{ imgUrl: string }>) => void
  getImgsList: () => Array<{ imgUrl: string }>
  getPrompt: () => string
  setPrompt: (text: string) => void
  getModelCode: () => string
  getModelCodeByName: (name: string) => string
  filterSpecialMarkers: (content: string) => string
  pushData: (datas: AgentContentListItem) => void
  clearInput: () => void
  clearThinkingProcessLogic: () => void
  processListsData: (res: { lists?: unknown[] }) => ListItem[]
  getaudio: (
    taskId: string,
    onSucceed: (data: TaskPollingResult['data']) => void,
    onFailed: (err: string) => void,
  ) => void
  getvideo: (
    taskId: string,
    onSucceed: (data: TaskPollingResult['data']) => void,
    onFailed: (err: string) => void,
  ) => void
  agentContentList: AgentContentListItem[]
  setAgentContentList: React.Dispatch<React.SetStateAction<AgentContentListItem[]>>
  displayedTexts: string[]
  displayedThinkingTexts: string[]
}

const SPECIAL_MARKER_RE = /<\|FunctionCall\|>|<\|FunctionCallEnd\|>|\[\*#\]+/g
const PLACEHOLDER_MARK = '__placeholder__'

/**
 * AI Talk 辅助方法 Hook。
 * 等价自旧项目 ai_index.js (L56-L95 / L807-L873 / L1229-L1330),
 * 提供状态管理、模型编码查询、特殊标记过滤、占位项替换、轮询等 12 个辅助方法。
 */
export function useAiHelpers(options: UseAiHelpersOptions = {}): UseAiHelpersReturn {
  const { modelList = [], currentModelName = '' } = options

  const [imgsList, setImgsListState] = React.useState<Array<{ imgUrl: string }>>([])
  const [agentContentList, setAgentContentList] = React.useState<AgentContentListItem[]>([])
  const [displayedTexts, setDisplayedTexts] = React.useState<string[]>([])
  const [displayedThinkingTexts, setDisplayedThinkingTexts] = React.useState<string[]>([])

  const imgsListRef = React.useRef(imgsList)
  imgsListRef.current = imgsList
  const modelListRef = React.useRef(modelList)
  modelListRef.current = modelList
  const currentModelNameRef = React.useRef(currentModelName)
  currentModelNameRef.current = currentModelName

  const promptRef = React.useRef<string>('')
  const progressIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const progressIntervalaRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const agentContent1TimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioPollingRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const videoPollingRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const setImgsList = React.useCallback((value: Array<{ imgUrl: string }>) => {
    setImgsListState(value)
    imgsListRef.current = value
  }, [])

  const getImgsList = React.useCallback(() => imgsListRef.current, [])

  const getPrompt = React.useCallback(() => promptRef.current, [])

  const setPrompt = React.useCallback((text: string) => {
    promptRef.current = text
  }, [])

  const getModelCode = React.useCallback((): string => {
    const found = modelListRef.current.find((m) => m.name === currentModelNameRef.current)
    return found?.code ?? ''
  }, [])

  const getModelCodeByName = React.useCallback((name: string): string => {
    const found = modelListRef.current.find((m) => m.name === name)
    return found?.code ?? ''
  }, [])

  const filterSpecialMarkers = React.useCallback(
    (content: string): string => content.replace(SPECIAL_MARKER_RE, ''),
    [],
  )

  const pushData = React.useCallback((datas: AgentContentListItem) => {
    setAgentContentList((prev) => {
      const filtered = prev.filter((item) => item.debugInfo !== PLACEHOLDER_MARK)
      return [...filtered, datas]
    })
    if (datas.content) {
      setDisplayedTexts((prev) => [...prev, datas.content])
    }
  }, [])

  const clearInput = React.useCallback(() => {
    promptRef.current = ''
    setImgsListState([])
    imgsListRef.current = []
    setDisplayedTexts([])
    setDisplayedThinkingTexts([])
  }, [])

  const clearThinkingProcessLogic = React.useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    if (progressIntervalaRef.current) {
      clearInterval(progressIntervalaRef.current)
      progressIntervalaRef.current = null
    }
    if (agentContent1TimerRef.current) {
      clearTimeout(agentContent1TimerRef.current)
      agentContent1TimerRef.current = null
    }
    setDisplayedThinkingTexts([])
  }, [])

  const processListsData = React.useCallback(
    (res: { lists?: unknown[] }): ListItem[] => {
      if (!res.lists || !Array.isArray(res.lists)) return []
      return res.lists.map((item): ListItem => {
        const obj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        const rawType = obj.type
        const type: ListItem['type'] =
          rawType === 'image' || rawType === 'text' || rawType === 'video' || rawType === 'audio'
            ? rawType
            : 'text'
        const url = typeof obj.url === 'string' ? obj.url : undefined
        const rawText = typeof obj.text === 'string' ? obj.text : ''
        return { type, url, text: rawText ? filterSpecialMarkers(rawText) : undefined }
      })
    },
    [filterSpecialMarkers],
  )

  const getaudio = React.useCallback(
    (
      taskId: string,
      onSucceed: (data: TaskPollingResult['data']) => void,
      onFailed: (err: string) => void,
    ) => {
      if (audioPollingRef.current) clearInterval(audioPollingRef.current)
      let attempts = 0
      const MAX_ATTEMPTS = 60 // 2 分钟超时(2000ms × 60)
      // TODO: POST /api/ai/keling/audio/end 后端校准
      audioPollingRef.current = setInterval(async () => {
        attempts++
        if (attempts >= MAX_ATTEMPTS) {
          if (audioPollingRef.current) clearInterval(audioPollingRef.current)
          audioPollingRef.current = null
          onFailed('轮询超时')
          return
        }
        const res = await fetchApi<TaskPollingResult>('/api/ai/keling/audio/end', {
          method: 'POST',
          body: JSON.stringify({ task_id: taskId }),
        })
        if (!res.success) {
          if (audioPollingRef.current) clearInterval(audioPollingRef.current)
          audioPollingRef.current = null
          onFailed(res.error)
          return
        }
        const status = res.data.task_status
        if (status === 'succeed' || status === 'completed') {
          if (audioPollingRef.current) clearInterval(audioPollingRef.current)
          audioPollingRef.current = null
          onSucceed(res.data.data)
        } else if (status === 'failed') {
          if (audioPollingRef.current) clearInterval(audioPollingRef.current)
          audioPollingRef.current = null
          onFailed('音频生成失败')
        }
      }, 2000)
    },
    [],
  )

  const getvideo = React.useCallback(
    (
      taskId: string,
      onSucceed: (data: TaskPollingResult['data']) => void,
      onFailed: (err: string) => void,
    ) => {
      if (videoPollingRef.current) clearInterval(videoPollingRef.current)
      let attempts = 0
      const MAX_ATTEMPTS = 60 // 2 分钟超时(2000ms × 60)
      // TODO: POST /api/ai/sora/request/end 后端校准
      videoPollingRef.current = setInterval(async () => {
        attempts++
        if (attempts >= MAX_ATTEMPTS) {
          if (videoPollingRef.current) clearInterval(videoPollingRef.current)
          videoPollingRef.current = null
          onFailed('轮询超时')
          return
        }
        const res = await fetchApi<TaskPollingResult>('/api/ai/sora/request/end', {
          method: 'POST',
          body: JSON.stringify({ task_id: taskId }),
        })
        if (!res.success) {
          if (videoPollingRef.current) clearInterval(videoPollingRef.current)
          videoPollingRef.current = null
          onFailed(res.error)
          return
        }
        const status = res.data.task_status
        if (status === 'succeed' || status === 'completed') {
          if (videoPollingRef.current) clearInterval(videoPollingRef.current)
          videoPollingRef.current = null
          onSucceed(res.data.data)
        } else if (status === 'failed') {
          if (videoPollingRef.current) clearInterval(videoPollingRef.current)
          videoPollingRef.current = null
          onFailed('视频生成失败')
        }
      }, 2000)
    },
    [],
  )

  React.useEffect(() => {
    return () => {
      if (audioPollingRef.current) clearInterval(audioPollingRef.current)
      if (videoPollingRef.current) clearInterval(videoPollingRef.current)
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
      if (progressIntervalaRef.current) clearInterval(progressIntervalaRef.current)
      if (agentContent1TimerRef.current) clearTimeout(agentContent1TimerRef.current)
    }
  }, [])

  return {
    imgsList,
    setImgsList,
    getImgsList,
    getPrompt,
    setPrompt,
    getModelCode,
    getModelCodeByName,
    filterSpecialMarkers,
    pushData,
    clearInput,
    clearThinkingProcessLogic,
    processListsData,
    getaudio,
    getvideo,
    agentContentList,
    setAgentContentList,
    displayedTexts,
    displayedThinkingTexts,
  }
}
