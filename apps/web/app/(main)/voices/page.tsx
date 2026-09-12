// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import {
  Loader2,
  RefreshCw,
  Mic,
  Upload,
  Trash2,
  PlayCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@ihui/ui-react'

/** 声纹库管理页(2026-09-09 F4):token6688 克隆音色列表/详情/删除/上传。
 *  调用 /api/voice/voices(ai-service),声纹上传走 multipart 异步克隆。 */

interface VoiceItem {
  voice_id?: string
  id?: string
  name?: string
  status?: string
  created_at?: string
  preview_url?: string
  audio_url?: string
  model?: string
  [key: string]: unknown
}

interface VoiceDetail {
  voice_id?: string
  id?: string
  name?: string
  status?: string
  preview_url?: string
  audio_url?: string
  [key: string]: unknown
}

// 2026-09-09 收尾修复:成功/失败终态集合与后端 provider 对齐
// (_TASK_OK_STATES/_TASK_FAIL_STATES, token6688_provider.py)。
const STATUS_READY = new Set([
  'succeeded',
  'success',
  'completed',
  'complete',
  'done',
  'ok',
  'ready',
  'active',
])
const STATUS_FAILED = new Set(['failed', 'fail', 'error', 'cancelled', 'canceled'])

function voiceId(v: VoiceItem): string {
  return String(v.voice_id ?? v.id ?? '')
}

function voiceName(v: VoiceItem): string {
  return String(v.name ?? voiceId(v) ?? '-')
}

function voiceStatus(v: VoiceItem): string {
  return String(v.status ?? (v.voice_id || v.id ? 'ready' : 'unknown'))
}

function voiceUrl(v: VoiceItem): string | null {
  const u = v.preview_url || v.audio_url
  return typeof u === 'string' && u ? u : null
}

async function api<T>(url: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error || 'Request failed')
  return r.data
}

export default function VoicesPage() {
  const t = useTranslations('voicesPage')
  const locale = useLocale()
  const queryClient = useQueryClient()
  // 声纹库是平台共享资源,删除影响所有用户 → 仅 admin(roleId>=1)可见删除按钮,
  // 与后端 delete_voice 的 _require_admin 守卫对齐(2026-09-09 P1)。
  const userRoleId = useAuthStore((s) => s.user?.roleId)
  const isAdmin = (userRoleId ?? 0) >= 1
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [deleting, setDeleting] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const [playing, setPlaying] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [info, setInfo] = React.useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['voices'],
    queryFn: () => api<{ ok: boolean; voices: VoiceItem[]; count: number }>('/voice/voices'),
    // 2026-09-09 F6:声纹克隆是异步任务,存在克隆中(非终态)的声纹时 5s 自动轮询,
    // 克隆完成后自动刷新出可试听/可用的新声纹,无需手动刷新。
    // 2026-09-09 收尾修复:failed/error 等失败终态不再轮询(此前失败会 5s 无限轮询)。
    refetchInterval: (q) => {
      const items = q.state.data?.voices ?? []
      const isTerminal = (s: string) => STATUS_READY.has(s) || STATUS_FAILED.has(s)
      return items.some((v) => !isTerminal(voiceStatus(v).toLowerCase())) ? 5000 : false
    },
  })

  const voices = listQuery.data?.voices ?? []

  const refresh = () => {
    setError(null)
    setInfo(null)
    listQuery.refetch()
  }

  // 2026-09-09 第五轮:上传前置校验(与 token6688_provider.upload_voice 硬限制一致:
  // 仅 MP3/M4A/WAV,严格 <20MiB),超限前端直接拒绝,不再全量传输后等 502。
  const VOICE_MAX_BYTES = 20 * 1024 * 1024
  const VOICE_EXTS = new Set(['mp3', 'm4a', 'wav'])

  const handleUpload = async (file: File) => {
    const parts = file.name.split('.')
    const ext = (parts.length > 1 ? (parts[parts.length - 1] ?? '') : '').toLowerCase()
    if (!VOICE_EXTS.has(ext)) {
      setError(`${t('upload')}失败: ${t('fileBadFormat')}`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (file.size >= VOICE_MAX_BYTES) {
      setError(`${t('upload')}失败: ${t('fileTooLarge')}`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setUploading(true)
    setError(null)
    setInfo(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api<{ voice?: VoiceItem }>('/voice/voices', { method: 'POST', body: fd })
      // 克隆是异步任务:上传成功 ≠ 克隆完成,提示语义要准确,完成由 5s 轮询自动带出
      setInfo(t('cloneSubmitted'))
      await queryClient.invalidateQueries({ queryKey: ['voices'] })
    } catch (e) {
      setError(`${t('upload')}失败: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const deleteVoice = async (id: string) => {
    if (!window.confirm(t('deleteConfirm'))) return
    setDeleting(id)
    setError(null)
    setInfo(null)
    try {
      await api<{ ok: boolean }>(`/voice/voices/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (expanded === id) setExpanded(null)
      await queryClient.invalidateQueries({ queryKey: ['voices'] })
    } catch (e) {
      setError(`${t('delete')}失败: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setDeleting(null)
    }
  }

  const toggleExpand = (id: string) => {
    setExpanded((cur) => (cur === id ? null : id))
  }

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmt = (v?: string) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? v : dateFmt.format(d)
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Mic className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleUpload(f)
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className={cn('mr-1 h-4 w-4', uploading && 'animate-pulse')} />
            {uploading ? t('uploading') : t('upload')}
          </Button>
          <Button variant="outline" size="sm" onClick={refresh} disabled={listQuery.isFetching}>
            <RefreshCw className={cn('mr-1 h-4 w-4', listQuery.isFetching && 'animate-spin')} />
            {t('refresh')}
          </Button>
        </div>
      </header>

      <p className="text-xs text-muted-foreground">{t('uploadHint')}</p>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {info && (
        <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
          {info}
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-border/50 bg-card/50">
        {listQuery.isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        ) : listQuery.error ? (
          <div className="m-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {String((listQuery.error as Error).message ?? '') || t('loadFailed')}
          </div>
        ) : voices.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
            <Mic className="h-8 w-8 opacity-40" />
            <p className="text-sm">{t('empty')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {voices.map((v, idx) => {
              const id = voiceId(v)
              const status = voiceStatus(v).toLowerCase()
              const ready = STATUS_READY.has(status)
              const failed = STATUS_FAILED.has(status)
              const url = voiceUrl(v)
              const isExpanded = expanded === id
              return (
                // 2026-09-09 修复:key 缺 id 时回退 name,重名会导致 key 冲突/状态错乱;
                // 回退加索引保证唯一稳定
                <div key={id || `${voiceName(v)}-${idx}`} className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-sm bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                      <Mic className="mr-1 h-3 w-3" />
                      {voiceName(v)}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium',
                        ready
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                          : failed
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                      )}
                    >
                      {/* 2026-09-09 收尾修复:失败态不再误标"处理中"(三态徽章) */}
                      {ready
                        ? t('statusReady')
                        : failed
                          ? t('statusFailed')
                          : t('statusProcessing')}
                    </span>
                    <span className="text-[11px] text-muted-foreground/60">
                      {fmt(v.created_at)}
                    </span>
                    {v.model ? (
                      <span className="font-mono text-[11px] text-muted-foreground/70">
                        {String(v.model)}
                      </span>
                    ) : null}
                    <div className="ml-auto flex items-center gap-1.5">
                      {url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-1.5 text-[10px]"
                          onClick={() => setPlaying((cur) => (cur === id ? null : id))}
                        >
                          <PlayCircle className="mr-1 h-3 w-3" />
                          {/* 播放按钮用动作文案(此前误用状态词 statusReady/playable) */}
                          {playing === id ? t('hidePreview') : t('playPreview')}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-[10px] text-muted-foreground"
                        onClick={() => toggleExpand(id)}
                        aria-label={t('voiceId')}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                        {id}
                      </Button>
                      {id && isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                          disabled={deleting === id}
                          onClick={() => deleteVoice(id)}
                          aria-label={t('delete')}
                        >
                          {deleting === id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          {deleting === id ? t('deleting') : t('delete')}
                        </Button>
                      )}
                    </div>
                  </div>
                  {playing === id && url && (
                    <audio
                      controls
                      src={url}
                      preload="metadata"
                      className="w-full max-w-md"
                      autoPlay
                    >
                      <track kind="captions" />
                    </audio>
                  )}
                  {isExpanded && <VoiceDetailPanel voiceId={id} />}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {!listQuery.isLoading && !listQuery.error && voices.length > 0 && (
        <p className="text-xs text-muted-foreground">{t('count', { count: voices.length })}</p>
      )}
    </div>
  )
}

function VoiceDetailPanel({ voiceId: vid }: { voiceId: string }) {
  const t = useTranslations('voicesPage')
  const detailQuery = useQuery({
    queryKey: ['voice-detail', vid],
    queryFn: () => api<VoiceDetail>(`/voice/voices/${encodeURIComponent(vid)}`),
    enabled: !!vid,
  })

  if (detailQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  if (detailQuery.error || !detailQuery.data) {
    return (
      <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
        {String((detailQuery.error as Error)?.message ?? '') || t('notFound')}
      </div>
    )
  }

  const d = detailQuery.data
  const fields: [string, unknown][] = [
    [t('voiceId'), voiceId(d)],
    [t('name'), d.name ?? ''],
    [t('status'), d.status ?? ''],
    [t('createdAt'), d.created_at ?? ''],
    [t('previewUrl'), voiceUrl(d) ?? ''],
  ]
  for (const [k, v] of Object.entries(d)) {
    if (
      !['voice_id', 'id', 'name', 'status', 'created_at', 'preview_url', 'audio_url'].includes(k) &&
      !(typeof v === 'object' && v !== null)
    ) {
      fields.push([k, v])
    }
  }

  return (
    <dl className="grid grid-cols-1 gap-1 rounded-sm bg-muted/30 p-2 text-xs sm:grid-cols-2">
      {fields.map(([label, val]) => (
        <div key={label} className="flex items-start gap-2">
          <dt className="shrink-0 text-muted-foreground">{label}:</dt>
          <dd className="min-w-0 break-words font-mono text-muted-foreground/90">
            {String(val ?? '') || '-'}
          </dd>
        </div>
      ))}
    </dl>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
