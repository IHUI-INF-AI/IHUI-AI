/**
 * ImageGenPage — AI 图像生成(2026-07-25 立)。
 * createAigcTask / getAigcTask / getAigcTasks → /api/ai/aigc/records。
 * 流程:输入 prompt → 创建任务 → 轮询状态 → 展示结果图片 + 历史列表。
 */
import { useEffect, useRef, useState } from 'react'
import {
  createAigcTask,
  getAigcTask,
  getAigcTasks,
  extractMediaUrls,
  type AigcTask,
} from '@ihui/api-client'
import { Card, CardContent, Input } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'
import { fmtDate } from '../../../lib/date-utils'

const POLL_INTERVAL_MS = 2000
const POLL_MAX_ATTEMPTS = 60

export default function ImageGenPage() {
  const { t } = useI18n()
  const [prompt, setPrompt] = useState('')
  const [current, setCurrent] = useState<AigcTask | null>(null)
  const [generating, setGenerating] = useState(false)
  const [history, setHistory] = useState<AigcTask[]>([])
  const [error, setError] = useState('')
  const [historyLoading, setHistoryLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await getAigcTasks({ page: 1, pageSize: 10 })
      if (res.success) setHistory(res.data.list)
    } catch {
      // 静默忽略历史加载失败
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    void loadHistory()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pollTask = async (taskId: string, attempt = 0) => {
    if (attempt >= POLL_MAX_ATTEMPTS) {
      setGenerating(false)
      setError(t('common.failed'))
      return
    }
    try {
      const res = await getAigcTask(taskId)
      if (!res.success) {
        setGenerating(false)
        setError(res.error || t('common.failed'))
        return
      }
      const task = res.data
      setCurrent(task)
      if (task.status === 'succeeded' || task.status === 'failed') {
        setGenerating(false)
        if (task.status === 'failed') setError(task.error || t('common.failed'))
        void loadHistory()
        return
      }
      timerRef.current = setTimeout(() => void pollTask(taskId, attempt + 1), POLL_INTERVAL_MS)
    } catch (e) {
      setGenerating(false)
      setError(e instanceof Error ? e.message : t('common.failed'))
    }
  }

  const generate = async () => {
    const p = prompt.trim()
    if (!p || generating) return
    setGenerating(true)
    setError('')
    setCurrent(null)
    try {
      const res = await createAigcTask({ type: 'image', prompt: p })
      if (!res.success) {
        setGenerating(false)
        setError(res.error || t('common.failed'))
        return
      }
      setCurrent(res.data)
      void pollTask(res.data.taskId)
    } catch (e) {
      setGenerating(false)
      setError(e instanceof Error ? e.message : t('common.failed'))
    }
  }

  const currentUrls = current ? extractMediaUrls(current.result) : []

  return (
    <div className="p-3 md:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('apps.imageGen')}</h3>
      </div>
      <div className="flex flex-col gap-2">
        <Input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t('apps.imageGenDesc')}
          className="text-sm h-9"
          aria-label={t('apps.imageGen')}
          disabled={generating}
        />
        <button
          type="button"
          onClick={() => void generate()}
          disabled={generating || !prompt.trim()}
          className="px-3 py-2 text-xs rounded-md border border-border bg-primary text-primary-foreground cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? t('common.loading') : t('common.submit')}
        </button>
      </div>
      {error ? (
        <div className="bg-destructive/10 text-destructive px-2.5 py-2 rounded-md border border-destructive text-xs">
          {error}
        </div>
      ) : null}
      {current && currentUrls.length > 0 ? (
        <Card className="rounded-md border-border shadow-none">
          <CardContent className="p-3 flex flex-col gap-2">
            <div className="text-[11px] text-muted-foreground">
              {current.status} · {current.taskId.slice(0, 8)}
            </div>
            <div className="flex flex-wrap gap-2">
              {currentUrls.slice(0, 4).map((url) => (
                <img
                  key={url}
                  src={url}
                  alt="generated"
                  loading="lazy"
                  className="w-full rounded-md border border-border object-cover"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
      {historyLoading ? (
        <div className="text-center text-muted-foreground py-4 text-xs">{t('common.loading')}</div>
      ) : history.length === 0 ? (
        <div className="text-center text-muted-foreground py-4 text-xs">{t('common.empty')}</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {history.map((h) => {
            const cover = extractMediaUrls(h.result)[0]
            return (
              <div
                key={h.taskId}
                className="flex items-center gap-2 p-1.5 rounded-md border border-border bg-card"
              >
                {cover ? (
                  <img
                    src={cover}
                    alt=""
                    loading="lazy"
                    className="w-9 h-9 rounded-md object-cover shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-md bg-muted shrink-0 flex items-center justify-center text-xs">
                    🎨
                  </div>
                )}
                <div className="flex-1 min-w-0 text-[11px] text-muted-foreground truncate">
                  {h.status} · {fmtDate(h.createdAt || h.updatedAt)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
