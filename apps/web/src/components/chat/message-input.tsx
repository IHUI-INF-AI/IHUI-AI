'use client'

import * as React from 'react'
import { Send, Square, Paperclip, FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { SlashCommandPalette } from '@/components/ai/slash-command-palette'
import { ContextReferencePanel } from '@/components/ai/context-reference-panel'
import { VoiceInput } from '@/components/ai/voice-input'
import { PromptTemplates } from '@/components/ai/prompt-templates'
import { ModelSelector } from '@/components/chat/model-selector'
import { FileMentionPopover } from '@/components/ai/file-mention-popover'
import { Popover } from '@/components/feedback'

const MAX_LENGTH = 2000
// textarea 无 padding(由外层容器提供)
// scrollHeight 阈值:3 行 ≈ 58px,6 行 ≈ 116px(text-sm + leading-snug)
const THREE_LINE_PX = 60 // 内容 ≤ 3 行的阈值,低于此值用 rows={3} 原生渲染
const MAX_HEIGHT_PX = 120 // 最大 6 行,超出后滚动

interface ReferenceItem {
  id: string
  type: 'file' | 'url' | 'text' | 'image'
  label: string
  preview?: string
}

const SLASH_COMMAND_IDS = ['summary', 'translate', 'explain', 'code', 'polish'] as const
const PROMPT_TEMPLATE_IDS = [
  'email',
  'report',
  'review',
  'refactor',
  'translate',
  'summary',
] as const

const MENTION_FILES = [
  { id: 'f1', name: 'auth.ts', path: 'src/auth.ts' },
  { id: 'f2', name: 'user.ts', path: 'src/user.ts' },
  { id: 'f3', name: 'README.md', path: 'README.md' },
  { id: 'f4', name: 'package.json', path: 'package.json' },
]

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
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

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

  const promptTemplates = PROMPT_TEMPLATE_IDS.map((id) => ({
    id,
    name: t(`tpl.${id}.name`),
    content: t(`tpl.${id}.content`),
    category: t(`tpl.${id}.category`),
  }))

  // 自动调整高度:空内容用 rows={3} 原生渲染,有内容按 scrollHeight 撑高,>6 行保持 6 行 + 滚动
  const resize = React.useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    // 空内容:强制清除 inline height,用 rows={3} 原生渲染(浏览器绝对保证 3 行)
    if (!el.value) {
      el.style.height = ''
      el.style.overflowY = 'hidden'
      return
    }
    el.style.height = 'auto' // 临时重置以测量真实内容
    const sh = el.scrollHeight
    if (sh < THREE_LINE_PX) {
      // 1-3 行:清除 inline height,用 rows={3} 原生渲染(保持 3 行不缩)
      el.style.height = ''
      el.style.overflowY = 'hidden'
    } else if (sh <= MAX_HEIGHT_PX) {
      // 4-6 行:撑高到内容高度
      el.style.height = `${sh}px`
      el.style.overflowY = 'hidden'
    } else {
      // 7+ 行:保持最大高度 + 滚动条
      el.style.height = `${MAX_HEIGHT_PX}px`
      el.style.overflowY = 'auto'
    }
  }, [])

  React.useEffect(() => {
    resize()
  }, [value, resize])

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

  const removeReference = (id: string) => {
    setReferences((prev) => prev.filter((r) => r.id !== id))
  }

  const submit = () => {
    const text = value.trim()
    if (!text || isStreaming) return
    onSend(text)
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
            files={MENTION_FILES}
            open={mentionOpen}
            onSelect={handleMentionSelect}
            onClose={() => setMentionOpen(false)}
          />
          {/* Trae 风格输入容器:描边卡片 + textarea 主区 + 底部工具栏 */}
          <div className="rounded-xl border border-border bg-card transition-colors focus-within:border-foreground/20">
            {/* textarea 容器:padding 由容器提供,避免 textarea 滚动时 padding-top 被吃掉 */}
            <div className="px-3 pt-2 pb-2">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={3}
                disabled={isStreaming}
                aria-label={placeholder}
                style={{ maxHeight: MAX_HEIGHT_PX }}
                className={cn(
                  'thin-scroll block w-full resize-none bg-transparent text-sm leading-snug outline-none',
                  'placeholder:text-muted-foreground/70',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                )}
              />
            </div>
            {/* 底部工具栏:左侧功能按钮,右侧模型/语音/发送(挨着) */}
            <div className="flex items-center gap-1 px-2 pb-2 pt-1">
              {isStreaming ? (
                <button
                  type="button"
                  disabled
                  aria-label={t('promptTemplate')}
                  title={t('promptTemplate')}
                  className="flex h-8 w-8 shrink-0 cursor-not-allowed items-center justify-center rounded-md bg-muted text-muted-foreground/50"
                >
                  <FileText className="h-4 w-4" />
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
                  position="top"
                  trigger="click"
                >
                  <button
                    type="button"
                    aria-label={t('promptTemplate')}
                    title={t('promptTemplate')}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                </Popover>
              )}
              <button
                type="button"
                onClick={addTextReference}
                disabled={isStreaming || value.trim().length === 0}
                aria-label={t('addContextReference')}
                title={t('addContextReference')}
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
                  'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                <Paperclip className="h-4 w-4" />
              </button>
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
