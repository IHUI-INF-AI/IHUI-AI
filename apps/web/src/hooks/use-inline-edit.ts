'use client'

import * as React from 'react'
import { streamChat, formatSSEError } from '@ihui/api-client'
import { toast } from 'sonner'

import { useInlineEditStore, type InlineEditSelection } from '@/stores/inline-edit'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { useAiPanelStore } from '@/stores/ai-panel'

/**
 * Inline Edit hook:Cmd+K 选区修改流程。
 *
 * 流程:
 * 1. CodeEditor 通过 registerApplyPatchCallback + window 'global-shortcut:inline-edit' 事件桥接
 * 2. 当事件触发时,CodeEditor 自身把当前选区 push 到 store(useInlineEditStore.open)
 * 3. 用户在 InlineEditDialog 输入指令 → startEdit(instruction)
 * 4. startEdit 调 streamChat 流式生成 patch,onDelta 累积到 store.generatedPatch
 * 5. 用户 Accept → store.acceptPatch() → callback 替换 Monaco 选区文本
 *
 * 注意:窗口事件 'global-shortcut:inline-edit' 由 use-global-shortcuts /
 * use-ide-shortcuts 在编辑器聚焦时派发。
 */

/** 从 AI 流输出中提取代码块内容(AI 通常以 ```lang\n...\n``` 包裹) */
function extractCodeBlock(raw: string): string {
  if (!raw) return ''
  // 优先匹配带语言标签的代码块
  const fenced = raw.match(/```[\w-]*\r?\n([\s\S]*?)```/)
  if (fenced && fenced[1] !== undefined) return fenced[1].replace(/\r?\n$/, '')
  // 无代码块围栏 → 直接返回原文本(已剥除首尾空白)
  return raw.trim()
}

export function useInlineEdit() {
  const abortRef = React.useRef<AbortController | null>(null)

  /** 触发 AI 生成 patch:流式调用 streamChat */
  const startEdit = React.useCallback(async (instruction: string) => {
    const store = useInlineEditStore.getState()
    const selection = store.selection
    if (!selection || !instruction.trim()) return

    // 中断上一次未完成的请求
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    store.setStatus('loading')
    store.setError(null)
    store.setGeneratedPatch('')

    const model = useChatStore.getState().currentModel
    const userId = useAuthStore.getState().user?.id ?? ''
    const workspacePath = useAiPanelStore.getState().activeWorkspace?.path

    const prompt = [
      '请修改以下选中代码,按照用户指令:' + instruction,
      '',
      '选中代码:',
      '```' + (selection.language || ''),
      selection.selectedText,
      '```',
      '',
      '请输出修改后的完整代码块(用 ``` 包裹),不要解释。',
    ].join('\n')

    let raw = ''
    try {
      await streamChat({
        model,
        messages: [{ role: 'user', content: prompt }],
        signal: controller.signal,
        metadata: {
          userId,
        },
        workspacePath,
        onDelta: (delta) => {
          raw += delta
          // 实时更新 store(展示流式输出)
          useInlineEditStore.getState().setGeneratedPatch(raw)
        },
        onDone: () => {
          const final = extractCodeBlock(raw)
          const s = useInlineEditStore.getState()
          s.setGeneratedPatch(final)
          s.setStatus('done')
        },
        onError: (errMsg) => {
          const s = useInlineEditStore.getState()
          s.setStatus('error')
          s.setError(errMsg)
          const f = formatSSEError(new Error(errMsg))
          toast.error(f.title, { description: f.message })
        },
      })
    } catch (err) {
      // AbortError 是用户主动取消,静默
      if (err instanceof DOMException && err.name === 'AbortError') return
      const s = useInlineEditStore.getState()
      const f = formatSSEError(err)
      s.setStatus('error')
      s.setError(f.message)
      toast.error(f.title, { description: f.message })
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [])

  /** 中断当前生成 */
  const abort = React.useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    useInlineEditStore.getState().setStatus('idle')
  }, [])

  /** 接受 patch:委托给 store(由 store 调 applyPatchCallback) */
  const acceptPatch = React.useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    useInlineEditStore.getState().acceptPatch()
  }, [])

  /** 拒绝 patch */
  const rejectPatch = React.useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    useInlineEditStore.getState().rejectPatch()
  }, [])

  /**
   * 打开对话框:由 CodeEditor 在收到 'global-shortcut:inline-edit' 事件时调用。
   * selection 来自 Monaco editor.onDidChangeCursorSelection 的最新值。
   */
  const openInlineEdit = React.useCallback((selection: InlineEditSelection) => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    useInlineEditStore.getState().open(selection)
  }, [])

  /** 关闭对话框 */
  const closeInlineEdit = React.useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    useInlineEditStore.getState().close()
  }, [])

  // 卸载时中断未完成的请求
  React.useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  return {
    startEdit,
    abort,
    acceptPatch,
    rejectPatch,
    openInlineEdit,
    closeInlineEdit,
  }
}
