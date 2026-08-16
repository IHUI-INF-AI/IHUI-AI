'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from '@/components/common'

import { detectDangerousCommands } from '@/lib/dangerous-command-detector'
import type { ReferenceItem } from '@/hooks/use-message-references'

/** WebInputCore 句柄 — 与 message-input.tsx 的 WebInputCoreHandle 契约一致。
 * 独立声明(不依赖 message-input.tsx)以避免 hook 反向依赖组件,符合 hooks/ 目录
 * "被组件依赖"的方向性(参考 use-slash-action.ts 的同款做法)。 */
export interface MessageSendInputCoreHandle {
  focus: () => void
  setSelectionRange: (start: number, end: number) => void
  resize: () => void
}

/** 输入参数 */
export interface UseMessageSendParams {
  value: string
  setValue: React.Dispatch<React.SetStateAction<string>>
  isStreaming: boolean
  isHighRisk: boolean
  references: ReferenceItem[]
  resetReferences: () => void
  addFileReference: (file: File) => void
  onSend: (content: string) => Promise<boolean> | boolean
  inputCoreRef: React.RefObject<MessageSendInputCoreHandle | null>
  /** localStorage 草稿 key(发送成功后清空),由主组件传入以保证 key 来源单一 */
  draftKey: string
}

/** 返回值 */
export interface UseMessageSendResult {
  isDragOver: boolean
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void
  handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  submit: () => Promise<void>
  /** 流式期间输入的预备消息(流式结束后自动发送) */
  pendingMessage: { text: string; refs: ReferenceItem[] } | null
  /** 清空预备消息(流式期「取消」悬浮条时调用,把文本退回主输入框编辑) */
  setPendingMessage: React.Dispatch<
    React.SetStateAction<{ text: string; refs: ReferenceItem[] } | null>
  >
  /** 立即发送预备消息(流式结束后调用) */
  sendPendingMessage: () => Promise<void>
}

/**
 * i18n 静态映射表 — 用于消除 `t(`permission.dangerousPattern.${pattern}`)` 单变量动态拼接。
 * key 集合与 apps/web/src/lib/dangerous-command-detector.ts 的 DANGEROUS_PATTERNS[].id 一一对应;
 * 若 detector 新增 pattern 而本表漏改,运行时回退到 'permission.dangerousPattern.unknown'。
 */
const DANGEROUS_PATTERN_KEY: Record<string, string> = {
  rmRrfRoot: 'permission.dangerousPattern.rmRrfRoot',
  ddToDisk: 'permission.dangerousPattern.ddToDisk',
  mkfsDisk: 'permission.dangerousPattern.mkfsDisk',
  redirectToDevice: 'permission.dangerousPattern.redirectToDevice',
  chmodRoot: 'permission.dangerousPattern.chmodRoot',
  sudoAny: 'permission.dangerousPattern.sudoAny',
  curlPipeSh: 'permission.dangerousPattern.curlPipeSh',
  forkBomb: 'permission.dangerousPattern.forkBomb',
  mvRootToNull: 'permission.dangerousPattern.mvRootToNull',
  rmEnv: 'permission.dangerousPattern.rmEnv',
  rmGit: 'permission.dangerousPattern.rmGit',
  forcePushMain: 'permission.dangerousPattern.forcePushMain',
}

/**
 * 消息发送 / 拖拽 / 粘贴 / 文件输入 hook(2026-07-30 提取自 message-input.tsx)
 *
 * 职责:
 * - 维护拖拽高亮状态(isDragOver)
 * - 处理文件拖入 / 粘贴图片 / 文件输入选择,统一调用 addFileReference 添加引用
 * - 处理 submit 发送流程:危险命令检测 → toast 确认(高风险模式)→ 实际发送
 * - 实际发送逻辑(doSend):附件转 markdown + onSend 调用 + 清空输入/引用 + 释放 objectURL
 *
 * 关键边界:
 * - isStreaming 时所有 handler 静默 return(流式中不允许拖拽/粘贴/发送)
 * - 高风险模式(isHighRisk)下,critical/high 危险命令弹 10s 确认 toast,
 *   用户点「仍要发送」才真发;medium 仅警告不阻断
 * - onSend 返回 false 表示未发送(未登录/创建会话失败),保留输入内容不清空
 * - 发送成功后 revoke 所有引用的 objectURL,并清空 localStorage 草稿
 *
 * 与其他 hook 的协作:
 * - useMessageReferences(2026-07-29 提取):提供 references / addFileReference / resetReferences
 * - useSlashAction(2026-07-29 提取):动作型斜杠命令也调用 onSend,与本 hook 互不依赖
 */
export function useMessageSend(params: UseMessageSendParams): UseMessageSendResult {
  const {
    value,
    setValue,
    isStreaming,
    isHighRisk,
    references,
    resetReferences,
    addFileReference,
    onSend,
    inputCoreRef,
    draftKey,
  } = params
  const t = useTranslations('chat')
  const [isDragOver, setIsDragOver] = React.useState(false)
  const [pendingMessage, setPendingMessage] = React.useState<{
    text: string
    refs: ReferenceItem[]
  } | null>(null)

  const handleFileInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      files.forEach(addFileReference)
      // 重置 value,允许重复选择同一文件
      e.target.value = ''
    },
    [addFileReference],
  )

  const handleDragOver = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (isStreaming) return
      // 仅在拖入文件时阻止默认行为(否则浏览器会打开文件)
      if (e.dataTransfer.types.includes('Files')) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        if (!isDragOver) setIsDragOver(true)
      }
    },
    [isStreaming, isDragOver],
  )

  const handleDragLeave = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // 仅当离开外层容器时才清除高亮(避免子元素 dragenter/dragleave 抖动)
    if (e.currentTarget === e.target) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (isStreaming) return
      if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return
      e.preventDefault()
      setIsDragOver(false)
      Array.from(e.dataTransfer.files).forEach(addFileReference)
      requestAnimationFrame(() => inputCoreRef.current?.focus())
    },
    [isStreaming, addFileReference, inputCoreRef],
  )

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (isStreaming) return
      const items = e.clipboardData?.items
      if (!items) return
      const imageItems = Array.from(items).filter(
        (item) => item.kind === 'file' && item.type.startsWith('image/'),
      )
      if (imageItems.length === 0) return
      e.preventDefault()
      imageItems.forEach((item) => {
        const file = item.getAsFile()
        if (file) {
          // 粘贴的图片无文件名,用时间戳生成
          const renamed = new File([file], `pasted-${Date.now()}.png`, { type: file.type })
          addFileReference(renamed)
        }
      })
    },
    [isStreaming, addFileReference],
  )

  /** 实际发送逻辑(2026-07-25 立,危险命令检测拆分):供 submit / toast action 复用 */
  const doSend = React.useCallback(
    async (text: string, refs: ReferenceItem[]): Promise<boolean> => {
      // 附件作为引用文本随消息发送:图片用 markdown image 语法,视频/其他文件用引用块
      const attachmentMarkdown = refs
        .map((r) => {
          if (r.type === 'image' && r.thumbnail) {
            return `![${r.label}](${r.thumbnail})`
          }
          if (r.type === 'video' && r.thumbnail) {
            return `<video src="${r.thumbnail}" controls></video>`
          }
          return `> 📎 ${r.label}`
        })
        .join('\n')
      const finalContent = attachmentMarkdown ? `${text}\n\n${attachmentMarkdown}` : text
      const ok = await onSend(finalContent)
      if (!ok) return false
      // 释放所有 objectURL
      refs.forEach((r) => {
        if (r.thumbnail) URL.revokeObjectURL(r.thumbnail)
      })
      if (typeof window !== 'undefined') localStorage.removeItem(draftKey)
      resetReferences()
      setValue('')
      requestAnimationFrame(() => inputCoreRef.current?.resize())
      return true
    },
    [onSend, draftKey, resetReferences, setValue, inputCoreRef],
  )

  const submit = React.useCallback(async () => {
    const text = value.trim()
    if (!text) return
    // 危险命令检测(2026-07-25 立,深度对标 OpenAI Codex CLI safety guard):
    // - 仅在高风险模式(bypass-permissions)下拦截,其他模式不阻断(用户已选择低风险)
    // - critical/high → 弹确认 toast(带「仍要发送」action),用户点 action 才真发
    // - medium → 普通 toast 警告(不阻断,只提醒)
    if (isHighRisk) {
      const detection = detectDangerousCommands(text)
      if (detection.hasDangerous) {
        // 找出最严重的 critical/high 命中的 pattern + reason 展示
        const top = detection.matches.find(
          (m) => m.severity === 'critical' || m.severity === 'high',
        )
        if (top) {
          const patternLabel = t(
            DANGEROUS_PATTERN_KEY[top.pattern] ?? 'permission.dangerousPattern.unknown',
          )
          toast(t('permission.dangerousCommandTitle'), {
            description: t('permission.dangerousCommandDesc', {
              pattern: patternLabel,
              reason: top.reason,
            }),
            duration: 10_000,
            action: {
              label: t('permission.dangerousCommandProceed'),
              onClick: () => {
                void submit()
              },
            },
            cancel: {
              label: t('permission.dangerousCommandCancel'),
              onClick: () => {
                // 仅关闭 toast,保留输入内容
              },
            },
          })
          return
        }
      }
      // 仅 medium → 警告但不阻断
      if (detection.matches.length > 0) {
        const medium = detection.matches[0]!
        const patternLabel = t(
          DANGEROUS_PATTERN_KEY[medium.pattern] ?? 'permission.dangerousPattern.unknown',
        )
        toast.warning(t('permission.dangerousCommandWarningOnly', { pattern: patternLabel }), {
          duration: 5_000,
        })
      }
    }
    if (isStreaming) {
      // 流式期间:保存为预备消息(悬浮显示在输入框上方,流式结束后自动发送)
      setPendingMessage({ text, refs: references.map((r) => ({ ...r })) })
      setValue('')
      resetReferences()
      if (typeof window !== 'undefined') localStorage.removeItem(draftKey)
      requestAnimationFrame(() => inputCoreRef.current?.resize())
      return
    }
    // 非流式:直接发送
    // 先乐观清空输入框,让用户感觉"已发出"(doSend 返回后还会再清空一次,幂等)
    setValue('')
    resetReferences()
    if (typeof window !== 'undefined') localStorage.removeItem(draftKey)
    requestAnimationFrame(() => inputCoreRef.current?.resize())
    const ok = await doSend(text, references)
    if (!ok) {
      // 发送失败恢复输入内容
      setValue(text)
      requestAnimationFrame(() => inputCoreRef.current?.resize())
    }
  }, [
    value,
    isStreaming,
    isHighRisk,
    t,
    doSend,
    references,
    setValue,
    resetReferences,
    draftKey,
    inputCoreRef,
  ])

  const sendPendingMessage = React.useCallback(async () => {
    if (!pendingMessage) return
    const { text, refs } = pendingMessage
    setPendingMessage(null)
    const ok = await doSend(text, refs)
    if (!ok) {
      // 发送失败恢复输入内容
      setValue(text)
      requestAnimationFrame(() => inputCoreRef.current?.resize())
    }
  }, [pendingMessage, doSend, setValue, inputCoreRef])

  return {
    isDragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePaste,
    handleFileInputChange,
    submit,
    pendingMessage,
    setPendingMessage,
    sendPendingMessage,
  }
}
