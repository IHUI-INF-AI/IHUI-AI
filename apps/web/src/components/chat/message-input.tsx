'use client'

import * as React from 'react'
import { Send, Square, Paperclip, FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { SlashCommandPalette } from '@/components/ai/slash-command-palette'
import { ContextReferencePanel } from '@/components/ai/context-reference-panel'
import { VoiceInput } from '@/components/ai/voice-input'
import { PromptTemplates } from '@/components/ai/prompt-templates'

const MAX_LENGTH = 2000

interface ReferenceItem {
  id: string
  type: 'file' | 'url' | 'text' | 'image'
  label: string
  preview?: string
}

const SLASH_COMMANDS = [
  { id: 'summary', label: '/summary', description: '总结当前对话' },
  { id: 'translate', label: '/translate', description: '翻译文本' },
  { id: 'explain', label: '/explain', description: '解释概念' },
  { id: 'code', label: '/code', description: '生成代码' },
  { id: 'polish', label: '/polish', description: '润色文本' },
]

const COMMAND_TEMPLATES: Record<string, string> = {
  summary: '请总结以上对话内容，提炼关键信息',
  translate: '请将以下内容翻译为英文：',
  explain: '请详细解释以下概念：',
  code: '请用代码实现以下功能，并添加注释：',
  polish: '请润色以下文本，使其更专业流畅：',
}

const PROMPT_TEMPLATES = [
  { id: 'email', name: '邮件起草', content: '请帮我起草一封邮件，主题为：', category: '写作' },
  { id: 'report', name: '报告大纲', content: '请为以下主题生成报告大纲：', category: '写作' },
  { id: 'review', name: '代码审查', content: '请审查以下代码，指出潜在问题：', category: '代码' },
  { id: 'refactor', name: '代码重构', content: '请重构以下代码，提升可读性：', category: '代码' },
  { id: 'translate', name: '中英互译', content: '请将以下内容翻译：', category: '翻译' },
  { id: 'summary', name: '内容总结', content: '请总结以下内容的关键信息：', category: '总结' },
]

interface MessageInputProps {
  onSend: (content: string) => void
  onStop: () => void
  isStreaming: boolean
  placeholder: string
  sendLabel: string
  stopLabel: string
}

export function MessageInput({
  onSend,
  onStop,
  isStreaming,
  placeholder,
  sendLabel,
  stopLabel,
}: MessageInputProps) {
  const t = useTranslations('chat')
  const [value, setValue] = React.useState('')
  const [slashOpen, setSlashOpen] = React.useState(false)
  const [templateOpen, setTemplateOpen] = React.useState(false)
  const [references, setReferences] = React.useState<ReferenceItem[]>([])
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // 自动调整高度
  const resize = React.useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
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
    fillInput(COMMAND_TEMPLATES[id] ?? '')
  }

  const handleTemplateSelect = (content: string) => {
    fillInput(content)
    setTemplateOpen(false)
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
    <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-3xl px-4 py-3">
        {references.length > 0 && (
          <div className="mb-2">
            <ContextReferencePanel references={references} onRemove={removeReference} />
          </div>
        )}
        <SlashCommandPalette
          commands={SLASH_COMMANDS}
          onSelect={handleCommandSelect}
          open={slashOpen}
          onClose={() => setSlashOpen(false)}
        />
        {templateOpen && (
          <div className="mb-2 rounded-xl border bg-card p-3 shadow-sm">
            <PromptTemplates templates={PROMPT_TEMPLATES} onSelect={handleTemplateSelect} />
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={isStreaming}
            aria-label={placeholder}
            className={cn(
              'max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none',
              'placeholder:text-muted-foreground/70',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          />
          <button
            type="button"
            onClick={() => setTemplateOpen((v) => !v)}
            disabled={isStreaming}
            aria-label="提示词模板"
            title="提示词模板"
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-50',
              templateOpen
                ? 'bg-accent text-primary'
                : 'bg-muted text-muted-foreground hover:bg-accent',
            )}
          >
            <FileText className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={addTextReference}
            disabled={isStreaming || value.trim().length === 0}
            aria-label="添加为上下文引用"
            title="添加为上下文引用"
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
              'bg-muted text-muted-foreground hover:bg-accent',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <VoiceInput onTranscript={handleVoiceTranscript} disabled={isStreaming} />
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label={stopLabel}
              title={stopLabel}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
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
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                canSend
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'cursor-not-allowed bg-muted text-muted-foreground/50',
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          )}
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
