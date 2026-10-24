// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 既有 `/api/voice/stt` faster-whisper 端点(`@ihui/api-client` voiceSttFromBlob),
// phase 收敛全部走 `@ihui/shared` 的 transitionVoiceNotePhase(12 相判别联合,
// 非法迁移 no-op),端内不散写 phase 判断。
//
// 降级策略(任务原文):转写端点存在时消费;`sttEnabled=false`(或端点探活失败)
// 时 waitingTranscript 相可达但停留在 pending,给明确文案,不崩。
// 归档事实源:服务端 chat_voice_notes(列表分页 + 乐观上行 + 失败回滚),端内不再持有本地桶
// 「插入对话」复用既有 draftInput 通道(useChatStore.setState,与 ai-side-panel 同形),
// 不新建消息注入通道。归档/分组/搜索、miniapp 端豁免为台账剩余项,不在本组件内。

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Mic, Square, RefreshCw, X, Trash2, ClipboardPaste } from 'lucide-react'
import { Button, SearchInput } from '@ihui/ui-react'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import {
  createVoiceNote,
  deleteVoiceNote,
  listVoiceNotes,
  voiceSttFromBlob,
} from '@ihui/api-client'
import type { VoiceNoteGroupFacet } from '@ihui/types'
import { useWebAuthStore } from '@/stores/auth-store'
import { useChatStore } from '@/stores/chat'
import {
  formatVoiceNoteDuration,
  isVoiceNotePhaseTerminal,
  isVoiceNoteTranscriptPending,
  removeVoiceNote,
  toVoiceNoteRecord,
  transitionVoiceNotePhase,
  upsertVoiceNote,
  VOICE_NOTE_ARCHIVE_LIMIT,
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

export interface VoiceNoteProps {
  /** 所属会话(随笔记落库;无会话上下文传 null) */
  conversationId?: string | null
  /** 转写端点开关:false = 显式降级(转写占位相可达但卡 pending) */
  sttEnabled?: boolean
}

export function VoiceNote({ conversationId = null, sttEnabled = true }: VoiceNoteProps) {
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

  // 归档列表的事实源是服务端 `chat_voice_notes`(D43 第②格);本地不再持有任何桶。
  // archivedRef 只是给回滚用的镜像,不参与渲染。
  const archivedRef = React.useRef<VoiceNoteRecord[]>([])
  archivedRef.current = archived
  const [listError, setListError] = React.useState(false)
  // 检索与分组都落在服务端(票面②「按分组检索→命中」):面板只持有查询条件,不持数据
  const [query, setQuery] = React.useState('')
  const [groupKey, setGroupKey] = React.useState<string | null>(null)
  const [groups, setGroups] = React.useState<VoiceNoteGroupFacet[]>([])

  const loadArchive = React.useCallback(async () => {
    const res = await listVoiceNotes({
      pageSize: VOICE_NOTE_ARCHIVE_LIMIT,
      withGroups: '1',
      ...(query.trim() ? { q: query.trim() } : {}),
      ...(groupKey ? { groupKey } : {}),
    })
    if (!res.success) {
      // 读失败必须喊出来:静默兜空列表会让人以为"笔记都丢了"
      setListError(true)
      return
    }
    setListError(false)
    setArchived(res.data.list.map(toVoiceNoteRecord))
    setGroups(res.data.groups ?? [])
  }, [groupKey, query])

  // 输入即搜,但去抖 300ms:每敲一个字符打一次后端会把列表打抖。
  // 首帧不去抖(打开就该看见已有笔记,不该先空 300ms)。
  const firstLoadRef = React.useRef(true)
  React.useEffect(() => {
    if (firstLoadRef.current) {
      firstLoadRef.current = false
      void loadArchive()
      return
    }
    const timer = setTimeout(() => void loadArchive(), 300)
    return () => clearTimeout(timer)
  }, [loadArchive])

  /**
   * 落一条笔记:先乐观上行,写失败当场回滚 + 显式报错 ——
   * 不留 renderer-only 假记录(那正是本仓反复登记的"看着存上了,刷新就没"那一型)。
   */
  const persistNote = React.useCallback(
    async (text: string | null) => {
      const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const durationMs = durationSecRef.current * 1000
      const optimistic: VoiceNoteRecord = {
        id: pendingId,
        conversationId,
        createdAt: new Date().toISOString(),
        durationMs,
        transcript: text,
      }
      setArchived((prev) => upsertVoiceNote(prev, optimistic))
      const res = await createVoiceNote({
        // 标题优先取转写起首;仅存音频时回落到本命名空间自带的"语音笔记"文案(不写死中文)
        title: (text?.trim() || t('title')).slice(0, 200),
        transcript: text,
        durationMs,
        conversationId,
      })
      if (!res.success) {
        setArchived((prev) => removeVoiceNote(prev, pendingId))
        setErrorCode('saveFailed')
        return
      }
      void loadArchive()
    },
    [conversationId, loadArchive, t],
  )

  const removeNote = React.useCallback(async (id: string) => {
    const snapshot = archivedRef.current
    setArchived(removeVoiceNote(snapshot, id))
    const res = await deleteVoiceNote(id)
    if (!res.success) setArchived(snapshot)
  }, [])

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
        // 空转写不落库:一条没有内容也没有显式存盘意图的记录,不是"笔记"
        if (text.trim().length > 0) void persistNote(text)
        dispatch('transcriptReady')
      } catch {
        setErrorCode('recognitionFailed')
        dispatch('transcriptFailed')
      }
    },
    [dispatch, persistNote, sttEnabled, token],
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
      dispatch('transcriptFailed')
      return
    }
    void transcribe(blob)
  }, [dispatch, releaseStream, stopTimer, transcribe])

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
      // 起新之前先停旧(本文件已有 stopTimer,catch 分支就在用它)——否则重开一次录音
      // 就多一只无人认领的计时器,它会一直改 durationSecRef 并 setState
      stopTimer()
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
                  void persistNote(null)
                  dispatch('dismiss')
                }}
                data-testid="voice-note-save-audio-only"
              >
                {t('action.saveAudioOnly')}
              </Button>
            )}
            {phase !== 'ready' && !busy && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetToReady}
                data-testid="voice-note-reset"
              >
                <X className="h-3.5 w-3.5" />
                {t('action.dismiss')}
              </Button>
            )}
          </div>

          {/* 检索与分组入口(票面②「按分组检索→命中」):条件交给服务端,列表按结果渲染 */}
          <div className="mb-2 space-y-1.5" data-testid="voice-note-filters">
            <SearchInput
              size="sm"
              clearable
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              clearAriaLabel={t('action.dismiss')}
              data-testid="voice-note-search"
            />
            {groups.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <Button
                  size="xs"
                  variant={groupKey === null ? 'secondary' : 'ghost'}
                  data-testid="voice-note-group-chip-all"
                  onClick={() => setGroupKey(null)}
                >
                  {t('groupAll')}
                </Button>
                {groups.map((facet) => (
                  <Button
                    key={facet.groupKey}
                    size="xs"
                    variant={groupKey === facet.groupKey ? 'secondary' : 'ghost'}
                    data-testid="voice-note-group-chip"
                    onClick={() => setGroupKey(facet.groupKey)}
                  >
                    {facet.groupKey}
                    <span className="ml-1 inline-flex min-w-4 items-center justify-center rounded-md bg-muted px-1 text-[10px] font-semibold leading-none tabular-nums">
                      {facet.count}
                    </span>
                  </Button>
                ))}
              </div>
            )}
          </div>
          {/* 归档列表(服务端事实源:新建→落库→插入对话→删除) */}
          {listError && (
            <div
              className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs text-destructive"
              data-testid="voice-note-list-error"
            >
              {t('errors.loadFailed')}
            </div>
          )}
          {archived.length > 0 && (
            <div className="mt-3 pt-2" data-testid="voice-note-archive">
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
                      {/* 无转写=只存了音频,给命名空间自带的"语音笔记"文案,不猜任何相 */}
                      {note.transcript ?? t('title')}
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
                      onClick={() => void removeNote(note.id)}
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
