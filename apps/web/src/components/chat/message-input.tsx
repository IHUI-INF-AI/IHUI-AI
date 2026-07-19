'use client'

import * as React from 'react'
import { Send, Square, FileText, Plus, FilePlus, Slash, AtSign } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { SlashCommandPalette } from '@/components/ai/slash-command-palette'
import { ContextReferencePanel } from '@/components/ai/context-reference-panel'
import { VoiceInput } from '@/components/ai/voice-input'
import { PromptTemplates } from '@/components/ai/prompt-templates'
import { ModelSelector } from '@/components/chat/model-selector'
import { FileMentionPopover } from '@/components/ai/file-mention-popover'
import { Popover } from '@/components/feedback'
import { useTextareaAutoHeight } from '@/hooks/use-textarea-auto-height'
import { getRecentFilesForMention } from '@/lib/workspace-api'
import { useChatStore } from '@/stores/chat'

const MAX_LENGTH = 10000
const MAX_HEIGHT_PX = 320 // 最大约 16 行,超出后滚动
const MIN_HEIGHT_PX = 96 // rows=3 基础高度,与 hook threeLinePx 阈值一致

type ReferenceType = 'file' | 'url' | 'text' | 'image' | 'video'

interface ReferenceItem {
  id: string
  type: ReferenceType
  label: string
  preview?: string
  /** 图片/视频缩略图 URL(objectURL),用于在引用面板中显示视觉缩略图 */
  thumbnail?: string
  /** 原始文件大小(字节),用于在 label 中显示尺寸信息 */
  size?: number
}

const SLASH_COMMAND_IDS = ['summary', 'translate', 'explain', 'code', 'polish'] as const
// 模板源统一为 5 个核心模板,与 message-list 空状态共用同一组 i18n key,
// 避免 email/report/review/refactor 4 个无 i18n key 的项显示原始 key 的问题。
const PROMPT_TEMPLATE_IDS = ['summary', 'translate', 'explain', 'code', 'polish'] as const

/**
 * 把字节数格式化为人类可读字符串(B/KB/MB)。
 * 用于在 @ 提及面板的次要文本中展示文件大小。
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

/**
 * 把后端返回的 mimeType 转换为短标签(image/png → PNG,application/pdf → PDF)。
 * 没有 mimeType 时回退为 "FILE"。
 */
function mimeToLabel(mimeType: string): string {
  if (!mimeType) return 'FILE'
  const sep = mimeType.indexOf('/')
  if (sep < 0) return mimeType.toUpperCase()
  return mimeType.slice(sep + 1).toUpperCase()
}

interface MessageInputProps {
  onSend: (content: string) => void
  onStop: () => void
  isStreaming: boolean
  placeholder: string
  sendLabel: string
  stopLabel: string
  model: string
  onModelChange: (model: string) => void
  modelLabel: string
}

export function MessageInput({
  onSend,
  onStop,
  isStreaming,
  placeholder,
  sendLabel,
  stopLabel,
  model,
  onModelChange,
  modelLabel,
}: MessageInputProps) {
  const t = useTranslations('chat')
  const [value, setValue] = React.useState('')
  const [slashOpen, setSlashOpen] = React.useState(false)
  const [mentionOpen, setMentionOpen] = React.useState(false)
  const [references, setReferences] = React.useState<ReferenceItem[]>([])
  const [isDragOver, setIsDragOver] = React.useState(false)
  // @ 提及面板文件列表:首次打开时从 /api/files/recent 懒加载,避免无谓请求
  const [mentionFiles, setMentionFiles] = React.useState<
    { id: string; name: string; path: string }[]
  >([])
  const mentionLoadedRef = React.useRef(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const { ref: textareaRef, resize } = useTextareaAutoHeight<HTMLTextAreaElement>(value, {
    threeLinePx: MIN_HEIGHT_PX,
    maxHeightPx: MAX_HEIGHT_PX,
  })
  // 消费 chat store 中的 draftInput(由 PromptTemplates 等外部触发),填充到 textarea 后清空
  const draftInput = useChatStore((s) => s.draftInput)
  const clearDraftInput = useChatStore((s) => s.clearDraftInput)
  React.useEffect(() => {
    if (draftInput) {
      setValue(draftInput)
      clearDraftInput()
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }, [draftInput, clearDraftInput, textareaRef])

  // 首次打开 @ 提及面板时拉取最近文件列表;失败静默(留空数组,Popover 显示"无匹配文件")
  React.useEffect(() => {
    if (!mentionOpen || mentionLoadedRef.current) return
    mentionLoadedRef.current = true
    getRecentFilesForMention(30)
      .then((res) => {
        if (res.success && res.data?.files) {
          setMentionFiles(
            res.data.files.map((f) => ({
              id: f.id,
              name: f.name,
              // API 不返回 path,用 mimeType · size 作为次要展示文本
              path: `${mimeToLabel(f.mimeType)} · ${formatFileSize(f.size)}`,
            })),
          )
        }
      })
      .catch(() => {
        // 静默失败:未登录/网络错误时保持空数组,Popover 显示"无匹配文件"
      })
  }, [mentionOpen])

  const slashCommands = SLASH_COMMAND_IDS.map((id) => ({
    id,
    label: `/${id}`,
    description: t(`slashCmd.${id}`),
  }))

  const commandTemplates: Record<string, string> = {
    summary: t('cmdSummary'),
    translate: t('cmdTranslate'),
    explain: t('cmdExplain'),
    code: t('cmdCode'),
    polish: t('cmdPolish'),
  }

  // i18n key 为扁平结构(tplSummary / tplSummaryContent),与 message-list 空状态共用同一组 key,
  // 保证附加栏弹窗与空状态 chips 显示的模板内容完全一致。
  const promptTemplates = PROMPT_TEMPLATE_IDS.map((id) => {
    const idCap = id.charAt(0).toUpperCase() + id.slice(1)
    return {
      id,
      name: t(`tpl${idCap}`),
      content: t(`tpl${idCap}Content`),
    }
  })

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value.slice(0, MAX_LENGTH)
    setValue(next)
    // 输入 / 作为首个字符时弹出斜杠命令面板
    if (next === '/' && !slashOpen) {
      setSlashOpen(true)
    }
    // @ 触发文件提及
    if (next.endsWith('@') && !mentionOpen) {
      setMentionOpen(true)
    } else if (mentionOpen && !next.match(/@[\w./-]*$/)) {
      setMentionOpen(false)
    }
  }

  const handleMentionSelect = (file: { id: string; name: string; path: string }) => {
    setValue((prev) => prev.replace(/@$/, `\`${file.path}\` `).slice(0, MAX_LENGTH))
    setMentionOpen(false)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      resize()
    })
  }

  const fillInput = (text: string) => {
    setValue(text)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      const el = textareaRef.current
      if (el) {
        el.setSelectionRange(text.length, text.length)
        resize()
      }
    })
  }

  const handleCommandSelect = (id: string) => {
    fillInput(commandTemplates[id] ?? '')
  }

  const handleTemplateSelect = (content: string) => {
    fillInput(content)
  }

  const handleVoiceTranscript = (text: string) => {
    setValue((prev) => {
      const merged = prev && !prev.endsWith(' ') ? `${prev} ${text}` : `${prev}${text}`
      return merged.slice(0, MAX_LENGTH)
    })
    requestAnimationFrame(resize)
  }

  const addTextReference = () => {
    const text = value.trim()
    if (!text) return
    const ref: ReferenceItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'text',
      label: text.length > 30 ? `${text.slice(0, 30)}...` : text,
      preview: text,
    }
    setReferences((prev) => [...prev, ref])
    setValue('')
    requestAnimationFrame(resize)
  }

  const addFileReference = (file: File) => {
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) return
    const objectUrl = URL.createObjectURL(file)
    const ref: ReferenceItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: isImage ? 'image' : 'video',
      label: file.name,
      preview: `${file.name} · ${formatFileSize(file.size)}`,
      thumbnail: objectUrl,
      size: file.size,
    }
    setReferences((prev) => [...prev, ref])
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    files.forEach(addFileReference)
    // 重置 value,允许重复选择同一文件
    e.target.value = ''
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (isStreaming) return
    // 仅在拖入文件时阻止默认行为(否则浏览器会打开文件)
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      if (!isDragOver) setIsDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // 仅当离开外层容器时才清除高亮(避免子元素 dragenter/dragleave 抖动)
    if (e.currentTarget === e.target) {
      setIsDragOver(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (isStreaming) return
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return
    e.preventDefault()
    setIsDragOver(false)
    Array.from(e.dataTransfer.files).forEach(addFileReference)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
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
  }

  const removeReference = (id: string) => {
    setReferences((prev) => {
      const removed = prev.find((r) => r.id === id)
      // 释放 objectURL 避免内存泄漏
      if (removed?.thumbnail) URL.revokeObjectURL(removed.thumbnail)
      return prev.filter((r) => r.id !== id)
    })
  }

  const submit = () => {
    const text = value.trim()
    if (!text || isStreaming) return
    // 附件作为引用文本随消息发送:图片用 markdown image 语法,视频/其他文件用引用块
    const attachmentMarkdown = references
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
    onSend(finalContent)
    // 释放所有 objectURL
    references.forEach((r) => {
      if (r.thumbnail) URL.revokeObjectURL(r.thumbnail)
    })
    setValue('')
    setReferences([])
    requestAnimationFrame(resize)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  const canSend = value.trim().length > 0 && !isStreaming
  const count = value.length

  return (
    <div>
      <div className="mx-auto max-w-3xl px-4 py-3">
        {references.length > 0 && (
          <div className="mb-2">
            <ContextReferencePanel references={references} onRemove={removeReference} />
          </div>
        )}
        <SlashCommandPalette
          commands={slashCommands}
          onSelect={handleCommandSelect}
          open={slashOpen}
          onClose={() => setSlashOpen(false)}
        />
        <div className="relative">
          <FileMentionPopover
            files={mentionFiles}
            open={mentionOpen}
            onSelect={handleMentionSelect}
            onClose={() => setMentionOpen(false)}
          />
          {/* Trae 风格输入容器:描边卡片 + textarea 主区 + 底部工具栏。拖拽文件时高亮边框 */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'rounded-xl border bg-card transition-colors focus-within:border-foreground/20',
              isDragOver ? 'border-primary ring-2 ring-primary/20' : 'border-border',
            )}
          >
            {/* 拖拽提示遮罩:仅在 isDragOver 时显示 */}
            {isDragOver && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-primary/5">
                <p className="text-sm font-medium text-primary">释放鼠标以添加附件(图片/视频)</p>
              </div>
            )}
            {/* 附加栏:输入框上方的功能条。
                - 左侧:提示词模板 + 添加引用(并列,统一胶囊风格)
                - 右侧:引用计数徽章
                提示词模板按钮从底部工具栏上移至此(用户规则:挪到输入框上方附加栏),
                与空状态 chips 共用同一组 5 个核心模板源,视觉风格协调。 */}
            <div className="flex items-center gap-1 border-b border-border/60 px-2 py-1.5">
              {isStreaming ? (
                <button
                  type="button"
                  disabled
                  aria-label={t('promptTemplate')}
                  title={t('promptTemplate')}
                  className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground/50"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>{t('promptTemplate')}</span>
                </button>
              ) : (
                <Popover
                  content={
                    <div className="w-72">
                      <PromptTemplates
                        templates={promptTemplates}
                        onSelect={handleTemplateSelect}
                      />
                    </div>
                  }
                  position="bottom"
                  trigger="click"
                >
                  <button
                    type="button"
                    aria-label={t('promptTemplate')}
                    title={t('promptTemplate')}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-all',
                      'text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:-translate-y-px',
                    )}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>{t('promptTemplate')}</span>
                  </button>
                </Popover>
              )}
              <button
                type="button"
                onClick={addTextReference}
                disabled={isStreaming}
                aria-label={value.trim() ? t('addContextReference') : t('addContextHint')}
                title={value.trim() ? t('addContextReference') : t('addContextHint')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-all',
                  'text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:-translate-y-px',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                <FilePlus className="h-3.5 w-3.5" />
                <span>{value.trim() ? t('addContextReference') : t('addContextHint')}</span>
              </button>
              {references.length > 0 && (
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {references.length} 个引用
                </span>
              )}
            </div>
            {/* textarea 容器:padding 由容器提供,避免 textarea 滚动时 padding-top 被吃掉 */}
            <div className="px-3 pt-2 pb-2">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={placeholder}
                rows={3}
                disabled={isStreaming}
                aria-label={placeholder}
                style={{ maxHeight: MAX_HEIGHT_PX, minHeight: MIN_HEIGHT_PX }}
                className={cn(
                  'thin-scroll block w-full resize-none bg-transparent text-sm leading-snug outline-none',
                  'placeholder:text-muted-foreground/70',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                )}
              />
            </div>
            {/* 底部工具栏:左侧功能按钮,右侧模型/语音/发送(挨着)
                提示词模板按钮已上移至附加栏(与添加引用并列),此处不再保留 */}
            <div className="flex items-center gap-1 px-2 pb-2 pt-1">
              {/* 独立附件按钮:点击触发 hidden file input,选择图片/视频文件作为附件引用 */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming}
                aria-label="添加附件(图片/视频/文件)"
                title="添加附件(图片/视频/文件)"
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
                  'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                <Plus className="h-4 w-4" />
              </button>
              {/* / 独立按钮:点击在 textarea 末尾插入 / 字符并触发 SlashCommandPalette */}
              <button
                type="button"
                onClick={() => {
                  if (isStreaming) return
                  const el = textareaRef.current
                  if (!el) return
                  const next = (
                    value.endsWith(' ') || value === '' ? `${value}/` : `${value} /`
                  ).slice(0, MAX_LENGTH)
                  setValue(next)
                  setSlashOpen(true)
                  requestAnimationFrame(() => {
                    el.focus()
                    const pos = next.length
                    el.setSelectionRange(pos, pos)
                    resize()
                  })
                }}
                disabled={isStreaming}
                aria-label="斜杠命令"
                title="斜杠命令 (点击或输入 / 字符)"
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
                  'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                <Slash className="h-4 w-4" />
              </button>
              {/* @ 独立按钮:点击在 textarea 末尾插入 @ 字符并触发 FileMentionPopover */}
              <button
                type="button"
                onClick={() => {
                  if (isStreaming) return
                  const el = textareaRef.current
                  if (!el) return
                  const next = (
                    value.endsWith(' ') || value === '' ? `${value}@` : `${value} @`
                  ).slice(0, MAX_LENGTH)
                  setValue(next)
                  setMentionOpen(true)
                  requestAnimationFrame(() => {
                    el.focus()
                    const pos = next.length
                    el.setSelectionRange(pos, pos)
                    resize()
                  })
                }}
                disabled={isStreaming}
                aria-label="提及文件"
                title="提及文件 (点击或输入 @ 字符)"
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
                  'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                <AtSign className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileInputChange}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
              />
              <div className="ml-auto flex items-center gap-1">
                <ModelSelector
                  value={model}
                  onChange={onModelChange}
                  disabled={isStreaming}
                  label={modelLabel}
                />
                {/* 语音入口整合:单一 Mic 按钮直接触发语音转文字,挨着发送键 */}
                <VoiceInput onTranscript={handleVoiceTranscript} disabled={isStreaming} />
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={onStop}
                    aria-label={stopLabel}
                    title={stopLabel}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
                  >
                    <Square className="h-4 w-4" fill="currentColor" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!canSend}
                    aria-label={sendLabel}
                    title={sendLabel}
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
                      canSend
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'cursor-not-allowed bg-muted text-muted-foreground/50',
                    )}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>{t('enterToSend')}</span>
          <span className={count >= MAX_LENGTH ? 'text-destructive' : ''}>
            {count}/{MAX_LENGTH}
          </span>
        </div>
      </div>
    </div>
  )
}

export default MessageInput
