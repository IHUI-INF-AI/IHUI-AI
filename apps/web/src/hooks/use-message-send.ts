// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from '@/components/common'

import { detectDangerousCommands } from '@/lib/dangerous-command-detector'
import { compressImage } from '@/lib/file-utils'
import { formatFileSize } from '@/config/downloads.config'
import type { ReferenceItem } from '@/hooks/use-message-references'
import { useAnalytics } from '@/hooks/use-analytics'
import { steerChatStream } from '@ihui/api-client'
import { useChatStore } from '@/stores/chat'
import { answerSideQuestion, tryHandleSideSlash } from '@/hooks/use-chat/slash-commands'

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
  /** 添加文本型引用(引用选中文本/代码片段,展示为 "> 📎 label" 参考块) */
  addTextReference: (text: string) => void
  onSend: (content: string) => Promise<boolean> | boolean
  inputCoreRef: React.RefObject<MessageSendInputCoreHandle | null>
  /** localStorage 草稿 key(发送成功后清空),由主组件传入以保证 key 来源单一 */
  draftKey: string
  /** D36 发送成功后回调(推送该条用户文本到会话输入历史栈),由主组件传入以解耦历史持久化 */
  onSent?: (text: string) => void
}

/** 返回值 */
export interface UseMessageSendResult {
  isDragOver: boolean
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void
  handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  submit: (overrideValue?: string) => Promise<void>
  /** W27 输入队列(2026-09-14 立,对标 Codex/Cursor 多条排队):流式期间输入的预备消息 FIFO 队列,
   *  流式结束后自动发送队首,剩余条目随下一次流式结束继续出队 */
  pendingMessages: Array<{ text: string; refs: ReferenceItem[] }>
  /** 移除队列中指定条目(输入框上方队列条目「取消」时调用,文本退回主输入框) */
  removePendingMessage: (index: number) => void
  /** 立即发送队首预备消息(流式结束后调用) */
  sendPendingMessage: () => Promise<void>
  /** Steer 中途引导(2026-09-19 立):流式期间闪电按钮触发,不打断当前工具执行,
   *  将输入框文本经网关 /chat/steer 注入 ai-service 队列,下一轮 LLM 调用前生效 */
  steer: () => Promise<void>
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

/** 矩阵 A #19:超长纯文本粘贴阈值,超过则转为文本引用 chip 而非塞入 textarea */
const PASTE_LONG_TEXT_THRESHOLD = 4000

/** 矩阵 A #19(2026-09-13 立):位图压缩阈值,超过 1.5MB 的图片入列引用前先压缩
 *  (GIF 动图跳过:compressImage 输出 JPEG 会丢动画帧) */
const IMAGE_COMPRESS_THRESHOLD_BYTES = 1.5 * 1024 * 1024

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
    addTextReference,
    onSend,
    inputCoreRef,
    draftKey,
    onSent,
  } = params
  const t = useTranslations('chat')
  const { track } = useAnalytics()
  const [isDragOver, setIsDragOver] = React.useState(false)
  // W27(2026-09-14):单条 pendingMessage 升级为 FIFO 队列 —— 流式期间可连续排队多条,
  // 每次流式结束自动出队一条;失败条目退回主输入框,剩余条目保留
  const [pendingMessages, setPendingMessages] = React.useState<
    Array<{ text: string; refs: ReferenceItem[] }>
  >([])

  // 矩阵 A #19(2026-09-13 立):图片入列统一走压缩守卫 ——
  // 超过 1.5MB 的位图先 canvas 压缩(1920px/JPEG q0.85),压缩后更小才采用,
  // 否则(含 GIF/压缩失败)回退原图;toast 提示压缩效果
  const addImageFileCompressed = React.useCallback(
    async (file: File) => {
      const shouldCompress = file.size > IMAGE_COMPRESS_THRESHOLD_BYTES && file.type !== 'image/gif'
      if (!shouldCompress) {
        addFileReference(file)
        return
      }
      try {
        const blob = await compressImage(file)
        if (blob.size < file.size) {
          const compressed = new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, {
            type: 'image/jpeg',
          })
          addFileReference(compressed)
          toast(
            t('imageCompressed', {
              before: formatFileSize(file.size),
              after: formatFileSize(blob.size),
            }),
          )
          return
        }
        addFileReference(file)
      } catch {
        // Canvas 不可用等压缩失败:回退原图,不阻断附件流程
        addFileReference(file)
      }
    },
    [addFileReference, t],
  )

  const handleFileInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      files.forEach((f) => {
        if (f.type.startsWith('image/')) void addImageFileCompressed(f)
        else addFileReference(f)
      })
      // 重置 value,允许重复选择同一文件
      e.target.value = ''
    },
    [addFileReference, addImageFileCompressed],
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
      // 矩阵 A #19:拖入图片同样走压缩守卫
      Array.from(e.dataTransfer.files).forEach((f) => {
        if (f.type.startsWith('image/')) void addImageFileCompressed(f)
        else addFileReference(f)
      })
      requestAnimationFrame(() => inputCoreRef.current?.focus())
    },
    [isStreaming, addFileReference, addImageFileCompressed, inputCoreRef],
  )

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (isStreaming) return
      const items = e.clipboardData?.items
      // 矩阵 A #19:超长纯文本粘贴 → 压缩为文本引用 chip,不塞入 textarea。
      // clipboard 同时含文件项时不拦截,保留图片/文件优先的既有行为。
      const hasFileItem = items ? Array.from(items).some((item) => item.kind === 'file') : false
      const plainText = e.clipboardData?.getData('text/plain') ?? ''
      if (!hasFileItem && plainText.length > PASTE_LONG_TEXT_THRESHOLD) {
        e.preventDefault()
        addTextReference(plainText)
        toast(t('pasteLongToChip'), { duration: 5000 })
        return
      }
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
    [isStreaming, addFileReference, addTextReference, t],
  )

  /** 实际发送逻辑(2026-07-25 立,危险命令检测拆分):供 submit / toast action 复用 */
  const doSend = React.useCallback(
    async (text: string, refs: ReferenceItem[]): Promise<boolean> => {
      // 附件作为引用文本随消息发送:图片用 markdown image 语法,视频用 video 标签,
      // 文本引用(超长粘贴 chip)用 fenced code block 内联全文(矩阵 A #19 合同,
      // 2026-09-15 修复:恢复被 48228f5937a 弄丢的 0eabb157844 原始分支——
      // serverUrl 优先于 blob: objectURL,文本引用展开 fenced 全文而非截断 label)
      const attachmentMarkdown = refs
        .map((r) => {
          if (r.type === 'image') {
            const url = r.serverUrl ?? r.thumbnail
            return url ? `![${r.label}](${url})` : `> 📎 ${r.label}`
          }
          if (r.type === 'video') {
            const url = r.serverUrl ?? r.thumbnail
            return url ? `<video src="${url}" controls></video>` : `> 📎 ${r.label}`
          }
          if (r.type === 'text' && r.preview) {
            return `\`\`\`\n${r.preview}\n\`\`\``
          }
          return `> 📎 ${r.label}`
        })
        .join('\n')
      const finalContent = attachmentMarkdown ? `${text}\n\n${attachmentMarkdown}` : text
      // D22 引用回复(2026-09-19 立,对标 Qoder 0.2.x):quotedMessage 非空时把被引用
      // 消息快照以 markdown 引用块附加到正文(用户/AI 分别标注),发送成功后清除;
      // 发送失败保留引用,便于用户重试时仍带上下文。
      const quoted = useChatStore.getState().quotedMessage
      let contentWithQuote = finalContent
      if (quoted) {
        const roleLabel = quoted.role === 'user' ? t('quotedReplyUser') : t('quotedReplyAssistant')
        const quotedBlock = [
          `> 💬 ${roleLabel}:`,
          ...quoted.content.split('\n').map((line) => `> ${line}`),
        ].join('\n')
        contentWithQuote = contentWithQuote ? `${contentWithQuote}\n\n${quotedBlock}` : quotedBlock
      }
      const ok = await onSend(contentWithQuote)
      if (!ok) return false
      // D36:发送成功 → 推送原始用户文本到会话输入历史栈(与附件无关,仅文本)
      if (onSent) onSent(text)
      if (quoted) useChatStore.getState().setQuotedMessage(null)
      // 埋点:聊天消息发送成功(web 端)
      track({ name: 'chat_send', category: 'chat', label: 'web' })
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
    [onSend, draftKey, resetReferences, setValue, inputCoreRef, track, onSent],
  )

  /** overrideValue:外部预填后立即发送场景(如 draftAutoSend)使用,绕开 value state 异步更新
   * 导致的闭包旧值问题(.setValue 后同帧调用 submit 仍读到旧 value) */
  const submit = React.useCallback(
    async (overrideValue?: string) => {
      const text = (overrideValue ?? value).trim()
      if (!text) return
      // D28 /side 输入层统一拦截(2026-09-20 立):置于危险命令检测之前短路处理,
      // 侧问正文不进高风险检测、不进主线发送、不进 W27 队列。
      const side = tryHandleSideSlash(text, t)
      if (side.handled) {
        if (!side.question) {
          // 空参数:仅提示用法并清空输入
          toast.info(t('sideUsage'))
          setValue('')
          requestAnimationFrame(() => inputCoreRef.current?.resize())
          return
        }
        if (isStreaming) {
          // 流式期间:入当前会话侧问队列(按会话分桶存 zustand store,切会话不丢),
          // 流结束后由 message-input.tsx 的流结束 effect 自动出队补答。
          // 不进 W27 pendingMessages、不进 doSend、附件引用不消费(保留给后续主消息)。
          const conversationId = useChatStore.getState().conversationId
          if (!conversationId) {
            // 会话未持久化(极罕见的流中状态):保留输入内容,提示后返回
            toast.error(t('sideNoConversation'))
            return
          }
          useChatStore.getState().enqueueSideQuestion(conversationId, side.question)
          toast.info(t('sideEnqueued'))
          setValue('')
          if (typeof window !== 'undefined') localStorage.removeItem(draftKey)
          requestAnimationFrame(() => inputCoreRef.current?.resize())
          return
        }
        // 非流式:等同 /btw 即答(直调 REST runBestOfN N=1,回答不入主线历史)。
        // 先清空输入让用户感觉"已发出";失败恢复为 /side <问题> 供重试。
        setValue('')
        if (typeof window !== 'undefined') localStorage.removeItem(draftKey)
        requestAnimationFrame(() => inputCoreRef.current?.resize())
        try {
          await answerSideQuestion(side.question, t)
        } catch (e: unknown) {
          toast.error(t('sideAnswerFailed', { error: e instanceof Error ? e.message : String(e) }))
          setValue(`/side ${side.question}`)
          requestAnimationFrame(() => inputCoreRef.current?.resize())
        }
        return
      }
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
        // W27 输入队列(2026-09-14):流式期间入队 FIFO(可连续排队多条),
        // 显示在输入框上方,每次流式结束后自动出队发送
        setPendingMessages((prev) => [...prev, { text, refs: references.map((r) => ({ ...r })) }])
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
    },
    [
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
      onSent,
    ],
  )

  const sendPendingMessage = React.useCallback(async () => {
    // W27:每次流式结束出队队首一条;发送失败退回主输入框,剩余队列保留
    const head = pendingMessages[0]
    if (!head) return
    const { text, refs } = head
    setPendingMessages((prev) => prev.slice(1))
    const ok = await doSend(text, refs)
    if (!ok) {
      // 发送失败恢复输入内容
      setValue(text)
      requestAnimationFrame(() => inputCoreRef.current?.resize())
    }
  }, [pendingMessages, doSend, setValue, inputCoreRef])

  /** W27:移除队列指定条目(「取消」时调用);文本由调用方负责退回主输入框 */
  const removePendingMessage = React.useCallback((index: number) => {
    setPendingMessages((prev) => prev.filter((_, i) => i !== index))
  }, [])

  /** Steer(中途引导,2026-09-19 立):仅流式期间可用(Enter 保持 W27 FIFO 不变,
   *  本函数是闪电按钮专属路径)。取当前流式 assistant 消息 ID(网关凭
   *  conversationId+messageId 反查 upstreamSessionId)调网关 POST /chat/steer,
   *  由 ai-service 在 tool loop 边界注入;badge 由 SSE steer 事件回执驱动
   *  (onSteer → appendSteerNotice),此处不做乐观写入避免重复追加。
   *  入队成功即清空输入框文本(引导为纯文本,不含附件引用);失败保留内容供重试。 */
  const steer = React.useCallback(async () => {
    const text = value.trim()
    // 非流式 / 空输入:静默不动作(闪电按钮在非流式态不渲染,此处为双保险)
    if (!text || !isStreaming) return
    const store = useChatStore.getState()
    const messageId = store.streamingAssistantId
    const conversationId = store.conversationId
    if (!messageId || !conversationId) {
      // 流已收尾或会话未就绪:退化为普通入队(FIFO),不让引导文本丢失
      setPendingMessages((prev) => [...prev, { text, refs: references.map((r) => ({ ...r })) }])
      setValue('')
      resetReferences()
      requestAnimationFrame(() => inputCoreRef.current?.resize())
      return
    }
    try {
      // 2026-09-19 修正:fetchApi 对 4xx(429 队列超限/404 流已结束)返回
      // {success:false} 而非抛错,必须显式检查,否则引导文本被静默清空丢失。
      const result = await steerChatStream({ conversationId, messageId, text })
      if (!result.success) {
        // 失败:保留输入内容供重试(不 setValue('')、不清草稿)
        toast.warning(t('steerFailed'))
        return
      }
      // 埋点:中途引导发送成功(web 端)
      track({ name: 'chat_steer', category: 'chat', label: 'web' })
      setValue('')
      if (typeof window !== 'undefined') localStorage.removeItem(draftKey)
      requestAnimationFrame(() => inputCoreRef.current?.resize())
    } catch {
      // 5xx / 网络失败(fetchApi 抛错路径):同样保留输入内容,toast 提示
      toast.warning(t('steerFailed'))
    }
  }, [value, isStreaming, references, setValue, resetReferences, inputCoreRef, draftKey, track, t])

  return {
    isDragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePaste,
    handleFileInputChange,
    submit,
    pendingMessages,
    removePendingMessage,
    sendPendingMessage,
    steer,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
