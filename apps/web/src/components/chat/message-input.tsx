'use client'

import * as React from 'react'
import { Send, Square, Paperclip, FileText, Mic } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { SlashCommandPalette } from '@/components/ai/slash-command-palette'
import { ContextReferencePanel } from '@/components/ai/context-reference-panel'
import { VoiceInput } from '@/components/ai/voice-input'
import { PromptTemplates } from '@/components/ai/prompt-templates'
import { FileMentionPopover } from '@/components/ai/file-mention-popover'
import { VoiceRecord } from '@/components/ai/voice-record'
import { Popover } from '@/components/feedback'

const MAX_LENGTH = 2000

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
  const [mentionOpen, setMentionOpen] = React.useState(false)
  const [voiceOpen, setVoiceOpen] = React.useState(false)
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

  const handleRecordComplete = (blob: Blob, duration: number) => {
    const ref: ReferenceItem = {
      id: `voice-${Date.now()}`,
      type: 'file',
      label: t('voiceRecordLabel', { duration }),
      preview: URL.createObjectURL(blob),
    }
    setReferences((prev) => [...prev, ref])
    setVoiceOpen(false)
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
    <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
        {voiceOpen && (
          <div className="mb-2 rounded-xl border bg-card p-3 shadow-sm">
            <VoiceRecord onRecordComplete={handleRecordComplete} maxDuration={30} />
          </div>
        )}
        <div className="relative">
          <FileMentionPopover
            files={MENTION_FILES}
            open={mentionOpen}
            onSelect={handleMentionSelect}
            onClose={() => setMentionOpen(false)}
          />
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
            {isStreaming ? (
              <button
                type="button"
                disabled
                aria-label={t('promptTemplate')}
                title={t('promptTemplate')}
                className="flex h-9 w-9 shrink-0 cursor-not-allowed items-center justify-center rounded-lg bg-muted text-muted-foreground/50"
              >
                <FileText className="h-4 w-4" />
              </button>
            ) : (
              <Popover
                content={
                  <div className="w-72">
                    <PromptTemplates templates={promptTemplates} onSelect={handleTemplateSelect} />
                  </div>
                }
                position="top"
                trigger="click"
              >
                <button
                  type="button"
                  aria-label={t('promptTemplate')}
                  title={t('promptTemplate')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors hover:bg-accent"
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
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                'bg-muted text-muted-foreground hover:bg-accent',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setVoiceOpen((v) => !v)}
              disabled={isStreaming}
              aria-label={t('voiceRecord')}
              title={t('voiceRecord')}
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
                voiceOpen
                  ? 'bg-accent text-primary'
                  : 'bg-muted text-muted-foreground hover:bg-accent',
              )}
            >
              <Mic className="h-4 w-4" />
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
