'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Mic, Upload, FileAudio, Loader2, Play, X } from 'lucide-react'
import { Button, Card, CardContent, Label } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'
import { useAuthStore } from '@/stores/auth'

const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL ?? 'http://localhost:8803'

/** 转写语言选项(value=auto 时不上传 language,由服务端自动检测) */
const LANGUAGE_OPTIONS = [
  { value: 'auto', labelKey: 'auto' },
  { value: 'zh', labelKey: 'zh' },
  { value: 'en', labelKey: 'en' },
  { value: 'ja', labelKey: 'ja' },
] as const

interface STTResponse {
  text: string
  stub: boolean
  model: string
}

function isSTTResponse(value: unknown): value is STTResponse {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.text === 'string' &&
    typeof record.stub === 'boolean' &&
    typeof record.model === 'string'
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * 直连 ai-service(8803)调用语音转写接口。
 * multipart/form-data 上传音频,需 JWT Bearer 鉴权。
 * Whisper 本地模型转写可能较慢,超时放宽至 90s。
 */
async function transcribeAudio(
  file: File,
  language: string,
  token: string | null,
): Promise<STTResponse> {
  const fd = new FormData()
  fd.append('file', file)
  if (language && language !== 'auto') fd.append('language', language)

  // multipart 边界由浏览器自动生成,不能手动设置 Content-Type
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${AI_SERVICE_URL}/api/voice/stt`, {
    method: 'POST',
    headers,
    body: fd,
    signal: AbortSignal.timeout(90_000),
  })

  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    json = null
  }

  if (!res.ok) {
    const message =
      typeof json === 'object' && json !== null && 'message' in json
        ? String((json as Record<string, unknown>).message)
        : undefined
    throw new Error(message ?? `语音转写请求失败:${res.status}`)
  }

  if (!isSTTResponse(json)) {
    throw new Error('语音转写返回格式异常')
  }
  return json
}

export default function VoiceSttPage() {
  const t = useTranslations('eduAi.stt')
  const tc = useTranslations('common')
  const token = useAuthStore((s) => s.token)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [file, setFile] = React.useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [language, setLanguage] = React.useState('auto')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<STTResponse | null>(null)

  // 预览 URL 变化(或卸载)时回收旧资源,避免内存泄漏
  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
    setError(null)
    setResult(null)
  }

  function handleClearFile() {
    setFile(null)
    setPreviewUrl(null)
    setResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleTranscribe() {
    if (!file) {
      setError(t('noFile'))
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      setResult(await transcribeAudio(file, language, token))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = file !== null && !loading

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton fallbackHref="/tools" />

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Mic className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Card>
        <CardContent className="space-y-4 p-4 min-[768px]:p-6 min-[640px]:p-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileChange}
            aria-hidden
          />

          {/* 上传区:未选文件时显示空状态 */}
          {file ? (
            <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <FileAudio className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFile}
                  disabled={loading}
                  aria-label={tc('cancel')}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4 shrink-0 text-muted-foreground" />
                {/* eslint-disable-next-line jsx-a11y/media-has-caption -- 用户上传的音频预览，无可用字幕 */}
                <audio controls src={previewUrl ?? undefined} className="w-full" />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 py-10 text-center transition-colors hover:border-primary/50 hover:bg-accent"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">{t('selectFile')}</span>
              <span className="text-xs text-muted-foreground">{t('supported')}</span>
            </button>
          )}

          {/* 语言选择 */}
          <div className="space-y-2">
            <Label htmlFor="stt-language">{t('language')}</Label>
            <select
              id="stt-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={loading}
              className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>

          {/* 操作按钮 + 错误提示 */}
          <div className="flex items-center gap-3">
            <Button onClick={handleTranscribe} disabled={!canSubmit}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mic className="mr-2 h-4 w-4" />
              )}
              {loading ? t('transcribing') : t('transcribe')}
            </Button>
            {error && (
              <Alert variant="danger" title={t('error')} description={error} className="flex-1" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* 转写结果 */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t('transcribing')}
        </div>
      ) : result ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            {result.stub && <Alert variant="warning" description={t('stubWarning')} />}
            <div className="space-y-2">
              <Label htmlFor="stt-result">{t('result')}</Label>
              <textarea
                id="stt-result"
                readOnly
                value={result.text}
                rows={8}
                className="flex w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            {result.model && (
              <p className="text-xs text-muted-foreground">
                {t('model')}: {result.model}
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
