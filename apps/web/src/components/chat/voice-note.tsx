// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 既有 `/api/voice/stt` faster-whisper 端点(`@ihui/api-client` voiceSttFromBlob),
// phase 收敛全部走 `@ihui/shared` 的 transitionVoiceNotePhase(12 相判别联合,
// 非法迁移 no-op),端内不散写 phase 判断。
//
// 降级策略(任务原文):转写端点存在时消费;`sttEnabled=false`(或端点探活失败)
// 时 waitingTranscript 相可达但停留在 pending,给明确文案,不崩。
// 归档最小闭环:localStorage 单桶暂存(VOICE_NOTE_ARCHIVE_LIMIT 上限)+
// 「插入对话」复用既有 draftInput 通道(useChatStore.setState,与 ai-side-panel 同形),
// 不新建消息注入通道。归档/分组/搜索、miniapp 端豁免为台账剩余项,不在本组件内。

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Mic, Square, RefreshCw, X, Trash2, ClipboardPaste } from 'lucide-react'
import { Button } from '@ihui/ui-react'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { voiceSttFromBlob } from '@ihui/api-client'
import { useWebAuthStore } from '@/stores/auth-store'
import { useChatStore } from '@/stores/chat'
import {
  formatVoiceNoteDuration,
  isVoiceNotePhaseTerminal,
  isVoiceNoteTranscriptPending,
  parseVoiceNotes,
  removeVoiceNote,
  transitionVoiceNotePhase,
  upsertVoiceNote,
  voiceNoteHasInsertableText,
  type VoiceNoteEvent,
  type VoiceNotePhase,
  type VoiceNoteRecord,
} from '@ihui/shared/chat/voice-note'

// STT 端点策略与 voice-input.tsx 逐字一致(同源代理优先)
const STT_ENDPOINT =
  typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_AI_SERVICE_URL
    ? process.env.NEXT_PUBLIC_AI_SERVICE_URL
    : '/api/voice/stt'

const NOTES_STORAGE_KEY = 'ihui:voice-notes'

export interface VoiceNoteProps {
  /** 所属会话(会话内暂存标注;无会话上下文传 null) */
  conversationId?: string | null
  /** 转写端点开关:false = 显式降级(转写占位相可达但卡 pending) */
  sttEnabled?: boolean
  /** 归档桶 key(默认全局单桶) */
  storageKey?: string
}

export function VoiceNote({
  conversationId = null,
  sttEnabled = true,
  storageKey = NOTES_STORAGE_KEY,
}: VoiceNoteProps) {
  const t = useTranslations('chat.voiceNote')
  const token = useWebAuthStore((s) => s.token)

  const [open, setOpen] = React.useState(false)
  const [phase, setPhase] = React.useState<VoiceNotePhase>('ready')
  const [durationSec, setDurationSec] = React.useState(0)
  const [errorCode, setErrorCode] = React.useState<
    'permission' | 'noMicrophone' | 'startFailed' | 'saveFailed' | 'recognitionFailed' | null
  >(null)
  const [transcript, setTranscript] = React.useState('')
  const [archived, setArchived] = React.useState<VoiceNoteRecord[]>([])
  const [emptyResult, setEmptyResult] = React.useState(false)

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = React.useRef(0)
  const durationSecRef = React.useRef(0)

  const dispatch = React.useCallback((event: VoiceNoteEvent) => {
    setPhase((prev) => transitionVoiceNotePhase(prev, event))
  }, [])

  // 归档桶读取(挂载时一次;损坏 JSON 由 parseVoiceNotes 兜空)
  React.useEffect(() => {
    try {
      setArchived(parseVoiceNotes(window.localStorage.getItem(storageKey)))
    } catch {
      setArchived([])
    }
  }, [storageKey])

  const persistArchive = React.useCallback(
    (next: VoiceNoteRecord[]) => {
      setArchived(next)
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // 配额满/隐私模式:内存态继续可用,不崩
      }
    },
    [storageKey],
  )

  const archiveNote = React.useCallback(
    (recordPhase: VoiceNotePhase, text: string | null) => {
      const record: VoiceNoteRecord = {
        id: `vn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conversationId,
        createdAt: new Date().toISOString(),
        durationMs: durationSecRef.current * 1000,
        transcript: text,
        phase: recordPhase,
      }
      setArchived((prev) => {
        const next = upsertVoiceNote(prev, record)
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next))
        } catch {
          // 同上:降级内存态
        }
        return next
      })
    },
    [conversationId, storageKey],
  )

  const stopTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const releaseStream = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
  }, [])

  React.useEffect(
    () => () => {
      stopTimer()
      releaseStream()
    },
    [releaseStream, stopTimer],
  )

  const transcribe = React.useCallback(
    async (blob: Blob) => {
      if (!sttEnabled) {
        // 降级:转写端点缺失 → 占位相可达但停留 pending(明确文案,不崩)
        return
      }
      try {
        const text = await voiceSttFromBlob({
          blob,
          filename: 'voice-note.webm',
          mimeType: 'audio/webm',
          language: 'zh',
          aiServiceUrl: STT_ENDPOINT,
          token: token ?? undefined,
        })
        setEmptyResult(text.trim().length === 0)
        setTranscript(text)
        archiveNote('completed', text)
        dispatch('transcriptReady')
      } catch {
        setErrorCode('recognitionFailed')
        archiveNote('error', null)
        dispatch('transcriptFailed')
      }
    },
    [archiveNote, dispatch, sttEnabled, token],
  )

  const finalize = React.useCallback(() => {
    stopTimer()
    releaseStream()
    dispatch('stop')
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    chunksRef.current = []
    dispatch('saved')
    if (blob.size === 0) {
      setErrorCode('saveFailed')
      archiveNote('failed', null)
      dispatch('transcriptFailed')
      return
    }
    void transcribe(blob)
  }, [archiveNote, dispatch, releaseStream, stopTimer, transcribe])

  const startRecording = React.useCallback(async () => {
    setErrorCode(null)
    setTranscript('')
    setEmptyResult(false)
    dispatch('start')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      dispatch('permissionGranted')
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        // onstop 由 stopRecording 显式收尾,这里不重复 finalize
      }
      recorder.onerror = () => {
        dispatch('interrupt')
        setErrorCode('startFailed')
      }
      streamRef.current = stream
      mediaRecorderRef.current = recorder
      recorder.start()
      dispatch('mediaReady')
      dispatch('connected')
      startedAtRef.current = Date.now()
      durationSecRef.current = 0
      setDurationSec(0)
      timerRef.current = setInterval(() => {
        durationSecRef.current = Math.floor((Date.now() - startedAtRef.current) / 1000)
        setDurationSec(durationSecRef.current)
      }, 1000)
    } catch (e) {
      stopTimer()
      releaseStream()
      // 按 name 判定而非 instanceof DOMException(跨浏览器/happy-dom 下包装对象不失判)
      const name = e instanceof Error ? e.name : ''
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setErrorCode('permission')
        dispatch('permissionDenied')
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setErrorCode('noMicrophone')
        dispatch('permissionDenied')
      } else {
        setErrorCode('startFailed')
        dispatch('permissionDenied')
      }
    }
  }, [dispatch, releaseStream, stopTimer])

  const stopRecording = React.useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
    finalize()
  }, [finalize])

  const resetToReady = React.useCallback(() => {
    stopTimer()
    releaseStream()
    setPhase('ready')
    setErrorCode(null)
    setTranscript('')
    setEmptyResult(false)
  }, [releaseStream, stopTimer])

  const insertToInput = React.useCallback((text: string) => {
    // 与 ai-side-panel.tsx 同形:写 draftInput,MessageInput 消费后填充输入框
    useChatStore.setState({ draftInput: text })
  }, [])

  const busy = !isVoiceNotePhaseTerminal(phase) && phase !== 'ready'
  const showPhaseLabel = busy || isVoiceNotePhaseTerminal(phase)
  const recording = phase === 'recording'

  return (
    <div className="relative" data-testid="voice-note">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        data-testid="voice-note-trigger"
      >
        <Mic className="h-4 w-4" />
        {t('title')}
      </Button>

      {open && (
        <div
          className="z-popover absolute bottom-full left-0 mb-2 w-72 rounded-md border bg-popover p-3 text-popover-foreground shadow-md"
          data-testid="voice-note-panel"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium">{t('title')}</span>
            <button
              type="button"
              aria-label={t('action.dismiss')}
              className="text-muted-foreground hover:text-foreground"
              data-testid="voice-note-close"
              onClick={() => {
                if (recording) stopRecording()
                setOpen(false)
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* phase 徽章(12 相文案逐字对齐原文) */}
          {showPhaseLabel && (
            <div
              className={cn(
                'mb-2 rounded-md border px-2 py-1 text-xs',
                phase === 'completed' && 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600',
                phase === 'cancelled' && 'border-muted bg-muted/30 text-muted-foreground',
                (phase === 'failed' || phase === 'error' || phase === 'interrupted') &&
                  'border-destructive/30 bg-destructive/5 text-destructive',
                busy && phase !== 'failed' && 'border-border bg-muted/30 text-foreground',
              )}
              data-testid="voice-note-phase"
              data-phase={phase}
            >
              {t(`phase.${phase}`)}
              {(recording || phase === 'waitingTranscript') && (
                <span className="ml-2 font-mono tabular-nums">
                  {formatVoiceNoteDuration(durationSec * 1000)}
                </span>
              )}
            </div>
          )}

          {/* 错误文案(权限拒绝/无设备/启动失败/保存失败/识别中断) */}
          {errorCode && (
            <div
              className="mb-2 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs text-destructive"
              data-testid="voice-note-error"
            >
              {t(`errors.${errorCode}`)}
            </div>
          )}

          {/* 转写结果 */}
          {phase === 'completed' && transcript && !emptyResult && (
            <div
              className="mb-2 max-h-32 overflow-auto rounded-md border bg-muted/30 px-2 py-1 text-xs"
              data-testid="voice-note-transcript"
            >
              {transcript}
            </div>
          )}
          {phase === 'completed' && emptyResult && (
            <div className="mb-2 text-xs text-muted-foreground" data-testid="voice-note-empty">
              {t('errors.emptyTranscript')}
            </div>
          )}

          {/* 降级文案:waitingTranscript 停留 pending(端点缺失) */}
          {isVoiceNoteTranscriptPending(phase) && !sttEnabled && (
            <div
              className="mb-2 text-xs text-muted-foreground"
              data-testid="voice-note-stt-pending"
            >
              {t('errors.sttPending')}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            {phase === 'ready' && (
              <Button size="sm" onClick={startRecording} data-testid="voice-note-start">
                <Mic className="h-4 w-4" />
                {t('action.start')}
              </Button>
            )}
            {recording && (
              <Button
                variant="destructive"
                size="sm"
                onClick={stopRecording}
                data-testid="voice-note-stop"
              >
                <Square className="h-3.5 w-3.5" />
                {t('action.stop')}
              </Button>
            )}
            {/* 可恢复失败相:retry */}
            {(phase === 'failed' || phase === 'error' || phase === 'interrupted') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetToReady()
                  dispatch('retry')
                }}
                data-testid="voice-note-retry"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t('action.retry')}
              </Button>
            )}
            {/* 转写 pending 中用户显式存盘(dismiss → completed) */}
            {isVoiceNoteTranscriptPending(phase) && sttEnabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  archiveNote('completed', null)
                  dispatch('dismiss')
                }}
                data-testid="voice-note-save-audio-only"
              >
                {t('action.saveAudioOnly')}
              </Button>
            )}
            {phase !== 'ready' && !busy && (
              <Button variant="ghost" size="sm" onClick={resetToReady} data-testid="voice-note-reset">
                <X className="h-3.5 w-3.5" />
                {t('action.dismiss')}
              </Button>
            )}
          </div>

          {/* 归档列表(最小闭环:暂存 + 插入对话 + 删除) */}
          {archived.length > 0 && (
            <div className="mt-3 border-t pt-2" data-testid="voice-note-archive">
              {archived
                .slice()
                .reverse()
                .map((note) => (
                  <div
                    key={note.id}
                    className="flex items-center gap-1.5 rounded px-1 py-1 text-xs hover:bg-accent"
                    data-testid="voice-note-archive-item"
                  >
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {formatVoiceNoteDuration(note.durationMs)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {note.transcript ?? t(`phase.${note.phase}`)}
                    </span>
                    {voiceNoteHasInsertableText(note) && (
                      <Tooltip content={t('action.insertToInput')}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          data-testid="voice-note-insert"
                          onClick={() => insertToInput(note.transcript ?? '')}
                        >
                          <ClipboardPaste className="h-3.5 w-3.5" />
                        </Button>
                      </Tooltip>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      data-testid="voice-note-archive-delete"
                      onClick={() => persistArchive(removeVoiceNote(archived, note.id))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default VoiceNote
