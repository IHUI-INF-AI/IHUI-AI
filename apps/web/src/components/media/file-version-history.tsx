// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Download, Loader2 } from 'lucide-react'
import { fetchApi, fetchRaw } from '@/lib/api'

/**
 * 文件版本历史(2026-11-28 立)。
 *
 * 版本链的读侧:同一 fileId 下每次「保存 AI 修订稿」追加一行,旧 blob 不删,
 * 这里按 version 倒序列出并允许下载任一旧版本 —— 审稿人需要对照"改之前长什么样"。
 * 只展示服务端已剥掉 path 的元数据(serializeFileVersion 口径),不拼磁盘路径。
 */
interface VersionRow {
  id: string
  version: number
  size: number
  changeLog: string | null
  createdAt: string
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

export function FileVersionHistory({ fileId }: { fileId: string }) {
  const t = useTranslations('docs.projectFiles')
  const [rows, setRows] = React.useState<VersionRow[] | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [downloading, setDownloading] = React.useState<number | null>(null)

  const load = React.useCallback(async () => {
    setFailed(false)
    const res = await fetchApi<{ list?: VersionRow[] }>(
      `/api/workspace/files/${encodeURIComponent(fileId)}/versions`,
    )
    if (!res.success) throw new Error(res.error || 'VERSIONS_FAILED')
    return res.data?.list ?? []
  }, [fileId])

  React.useEffect(() => {
    let cancelled = false
    setRows(null)
    void load()
      .then((list) => {
        if (!cancelled) setRows(list)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [load])

  const download = async (row: VersionRow) => {
    setDownloading(row.version)
    try {
      const blob = await fetchRaw(
        `/api/workspace/files/${encodeURIComponent(fileId)}/versions/${row.version}/content`,
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `v${row.version}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      // 下载失败不弹窗打断阅读:按钮回弹即可,用户可重试
    } finally {
      setDownloading(null)
    }
  }

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
        <span>{t('versionLoadFailed')}</span>
        <button
          type="button"
          onClick={() => {
            setRows(null)
            void load()
              .then(setRows)
              .catch(() => setFailed(true))
          }}
          className="rounded-md border px-3 py-1.5 hover:bg-muted"
        >
          {t('retry')}
        </button>
      </div>
    )
  }

  if (rows === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('versionEmpty')}</p>
  }

  return (
    <ul className="divide-y rounded-lg border" data-testid="file-version-list">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-3 px-4 py-3 text-sm">
          <span className="shrink-0 rounded bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
            v{row.version}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate">{row.changeLog || '—'}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatBytes(row.size)} · {new Date(row.createdAt).toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void download(row)}
            disabled={downloading === row.version}
            aria-label={`${t('versionDownload')} v${row.version}`}
            title={t('versionDownload')}
            className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            {downloading === row.version ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
