'use client'

/**
 * 新建发布任务页:状态管理 + 拉取账号 + 组合子组件 + 提交逻辑。
 * 含富文本编辑器 + AI 辅助写作 + 平台预览 + 内容模板库。
 * 任务进度轮询由 SubmitBar 内部管理。AGENTS.md §4:< 250 行 / rounded-md / 无分割线。
 */

import * as React from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { ContentEditorCard, type UploadResult, type Format } from './ContentEditorCard'
import { PlatformSelectorCard } from './PlatformSelectorCard'
import { ScheduleCard, type ScheduleMode } from './ScheduleCard'
import { SubmitBar } from './SubmitBar'
import { AiWritingAssistant } from '@/components/publish/AiWritingAssistant'
import { PlatformPreview } from '@/components/publish/PlatformPreview'
import {
  ContentTemplateLibrary,
  type ContentTemplate,
} from '@/components/publish/ContentTemplateLibrary'

interface Account {
  id: number
  platform: string
  displayName: string
  status: 'active' | 'disabled' | 'expired'
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function uploadWithProgress(file: File, onProgress: (pct: number) => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const fd = new FormData()
    fd.append('file', file, file.name)
    // method: POST (xhr.open 语法无法被 check-api-routes 脚本自动识别,显式标注)
    xhr.open('POST', '/api/publish/upload')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        const raw = JSON.parse(xhr.responseText) as { data?: UploadResult } | UploadResult
        const data = (raw as { data?: UploadResult })?.data ?? (raw as UploadResult)
        if (xhr.status >= 200 && xhr.status < 300) resolve(data)
        else reject(new Error('上传失败'))
      } catch (e) {
        reject(e as Error)
      }
    }
    xhr.onerror = () => reject(new Error('网络错误'))
    xhr.send(fd)
  })
}

function NewPublishPage() {
  const t = useTranslations('publish')
  const toast = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = React.useState<Account[]>([])
  const [title, setTitle] = React.useState('')
  const [format, setFormat] = React.useState<Format>('md')
  const [textContent, setTextContent] = React.useState('')
  const [fileMeta, setFileMeta] = React.useState<UploadResult | null>(null)
  const [coverMeta, setCoverMeta] = React.useState<UploadResult | null>(null)
  const [uploadingKey, setUploadingKey] = React.useState<'file' | 'cover' | null>(null)
  const [fileProgress, setFileProgress] = React.useState(0)
  const [coverProgress, setCoverProgress] = React.useState(0)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [scheduleMode, setScheduleMode] = React.useState<ScheduleMode>('now')
  const [scheduledAt, setScheduledAt] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [submittedTaskId, setSubmittedTaskId] = React.useState<string | null>(null)
  const [tags, setTags] = React.useState<string[]>([])
  const [summary, setSummary] = React.useState('')

  // 2026-08-17 修复:日历页"新建任务"跳转 /publish/new?scheduled=YYYY-MM-DDTHH:mm,
  // 原页面不消费该参数 → 日期未预填(断链)。此处读取并初始化定时发布表单。
  React.useEffect(() => {
    const raw = searchParams.get('scheduled')
    if (raw) {
      const d = new Date(raw)
      if (!Number.isNaN(d.getTime())) {
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
        setScheduledAt(local)
        setScheduleMode('schedule')
      }
    }
  }, [searchParams])

  React.useEffect(() => {
    void (async () => {
      try {
        const data = await api<{ items?: Account[]; list?: Account[] } | Account[]>(
          '/api/publish/accounts/me',
        )
        const list = Array.isArray(data) ? data : (data.items ?? data.list ?? [])
        setAccounts(list.filter((a) => a.status === 'active'))
      } catch (e) {
        toast.error((e as Error).message)
      }
    })()
  }, [toast])

  const platformMap = React.useMemo(() => {
    const m = new Map<string, Account[]>()
    accounts.forEach((a) => {
      const arr = m.get(a.platform) ?? []
      arr.push(a)
      m.set(a.platform, arr)
    })
    return m
  }, [accounts])

  function togglePlatform(p: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  async function uploadFile(file: File, kind: 'file' | 'cover') {
    setUploadingKey(kind)
    if (kind === 'file') setFileProgress(0)
    else setCoverProgress(0)
    try {
      const result = await uploadWithProgress(file, (pct) => {
        if (kind === 'file') setFileProgress(pct)
        else setCoverProgress(pct)
      })
      if (kind === 'file') {
        setFileMeta(result)
        if (result.format !== 'md' && result.format !== 'html') setFormat(result.format as Format)
      } else {
        setCoverMeta(result)
      }
      toast.success(t('new.uploadSuccess', { filename: result.filename }))
    } catch (err) {
      toast.error(t('new.uploadFailed'), (err as Error).message)
    } finally {
      setUploadingKey(null)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return toast.error(t('new.titlePlaceholder'))
    if (selected.size === 0) return toast.error(t('new.selectPlatformsHint'))
    if (scheduleMode === 'schedule' && !scheduledAt) return toast.error(t('new.scheduleAt'))
    setSubmitting(true)
    try {
      const isText = format === 'md' || format === 'html'
      const targets = Array.from(selected).flatMap((p) =>
        (platformMap.get(p) ?? []).map((a) => ({
          platform: p,
          account_id: Number(a.id),
          config: {},
        })),
      )
      const body = JSON.stringify({
        title: title.trim(),
        format,
        text: isText ? textContent : undefined,
        file_path: isText ? undefined : fileMeta?.file_path || undefined,
        cover_path: coverMeta?.file_path || undefined,
        images: [] as string[],
        targets,
        tags: tags.length > 0 ? tags : undefined,
        summary: summary || undefined,
        scheduled_at: scheduleMode === 'schedule' ? new Date(scheduledAt).toISOString() : undefined,
      })
      const resp = await api<{ id?: number; task_id?: string }>('/api/publish/tasks', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })
      toast.success(t('new.submitSuccess'))
      // 2026-08-17 修复:后端 POST /tasks 返回 task_id(字符串 pub-xxx),无数字 id。
      // 原判断 typeof resp.id === 'number' 恒不成立 → 提交后无进度轮询直接跳历史页。
      // 优先用 task_id,兼容旧返回含数字 id 的情况。
      const taskId = resp.task_id ?? (typeof resp.id === 'number' ? String(resp.id) : undefined)
      if (taskId) setSubmittedTaskId(taskId)
      else router.push('/publish/history')
    } catch (e) {
      toast.error(t('new.submitFailed'), (e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const previewPlatform = selected.size > 0 ? (Array.from(selected)[0] ?? 'wechat') : 'wechat'

  function handleApplyTemplate(tpl: ContentTemplate) {
    setTitle(tpl.title)
    setTextContent(tpl.content)
    if (tpl.tags.length > 0) setTags([...tpl.tags])
    toast.success(t('templates.apply'))
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">{t('new.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('new.subtitle')}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-3">
        <div className="space-y-4 min-[1024px]:col-span-2">
          <ContentEditorCard
            title={title}
            onTitleChange={setTitle}
            format={format}
            onFormatChange={setFormat}
            textContent={textContent}
            onTextContentChange={setTextContent}
            fileMeta={fileMeta}
            coverMeta={coverMeta}
            uploadingKey={uploadingKey}
            fileProgress={fileProgress}
            coverProgress={coverProgress}
            onUploadFile={(f) => uploadFile(f, 'file')}
            onUploadCover={(f) => uploadFile(f, 'cover')}
          />
          <PlatformSelectorCard
            platformMap={platformMap}
            selected={selected}
            onToggle={togglePlatform}
            onSelectAll={() => setSelected(new Set(platformMap.keys()))}
            onClearAll={() => setSelected(new Set())}
          />
          {format === 'md' && (
            <PlatformPreview content={textContent} platform={previewPlatform} title={title} />
          )}
        </div>
        <div className="space-y-4">
          <ContentTemplateLibrary
            currentContent={textContent}
            currentTitle={title}
            onApply={handleApplyTemplate}
          />
          <AiWritingAssistant
            content={textContent}
            platform={previewPlatform}
            onApplyTitle={setTitle}
            onApplyContent={setTextContent}
            onApplyTags={setTags}
            onApplySummary={setSummary}
          />
        </div>
      </div>
      <ScheduleCard
        scheduleMode={scheduleMode}
        onScheduleModeChange={setScheduleMode}
        scheduledAt={scheduledAt}
        onScheduledAtChange={setScheduledAt}
      />
      <SubmitBar
        submitting={submitting}
        scheduleMode={scheduleMode}
        onSubmit={submit}
        submittedTaskId={submittedTaskId}
      />
    </form>
  )
}

// A 套壳:output:'export' 模式要求 useSearchParams() 被 <Suspense> 边界包裹(项目惯例)
export default function Page() {
  return (
    <Suspense fallback={null}>
      <NewPublishPage />
    </Suspense>
  )
}
