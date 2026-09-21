// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 数据库备份作业管理页(2026-09-17 立,PROJECT_PLAN 4-2 条目 48 缺失的管理端补齐)。
 *
 * 背景:48 后端已完整落地(pg_dump|gzip 执行器 + 单行配置表 + cron 调度 + 5 端点 + 迁移
 * 20260916233000),但前端零消费,运维只能调 API。本页补齐后,凭据就位即可自助开启定时备份。
 *
 * 数据源 /api/admin/backup-jobs*(列表 / 立即备份 / 删除 / 读配置 / 改配置)。
 * 注意:立即备份为**同步执行** pg_dump + gzip,大库可能耗时数十秒到数分钟(请求超时放宽到 10 分钟)。
 */
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { HardDriveDownload, Loader2, Play, RefreshCw, Settings2, Trash2 } from 'lucide-react'

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Loader2 as LoaderIcon,
  Switch,
} from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { BackButton, TruncatedText } from '@/components/common'
import { useConfirm } from '@/hooks/use-confirm'

interface BackupJob {
  id: string
  name: string
  type: string
  status: string
  filePath: string | null
  fileSizeBytes: number | null
  durationMs: number | null
  error: string | null
  createdBy: string | null
  createdAt: string
}

interface BackupSettings {
  id: string
  enabled: boolean
  cronExpr: string
  keepCount: number
  backupDir: string
  updatedAt: string
}

const STATUS_LABEL: Record<string, string> = {
  pending: '排队中',
  running: '执行中',
  succeeded: '成功',
  failed: '失败',
}

const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/

/** 字节 → 人类可读(备份产物常见 MB/GB 量级) */
function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

export default function BackupJobsPage() {
  const { confirm, ConfirmDialogRenderer } = useConfirm()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [newName, setNewName] = React.useState('')
  const [settingsForm, setSettingsForm] = React.useState({
    enabled: false,
    cronExpr: '0 3 * * *',
    keepCount: '7',
    backupDir: './backups',
  })
  const [settingsLoaded, setSettingsLoaded] = React.useState(false)

  const jobsQ = useQuery({
    queryKey: ['admin', 'backup-jobs'],
    queryFn: async () => {
      const r = await fetchApi<{ list: BackupJob[]; total: number }>('/api/admin/backup-jobs')
      if (!r.success) throw new Error(r.error)
      return r.data.list
    },
  })

  const settingsQ = useQuery({
    queryKey: ['admin', 'backup-jobs', 'settings'],
    queryFn: async () => {
      const r = await fetchApi<BackupSettings>('/api/admin/backup-jobs/settings')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  /** 服务端配置首次到达时填入表单(此后不再覆盖用户编辑) */
  React.useEffect(() => {
    if (!settingsLoaded && settingsQ.data) {
      setSettingsForm({
        enabled: settingsQ.data.enabled,
        cronExpr: settingsQ.data.cronExpr,
        keepCount: String(settingsQ.data.keepCount),
        backupDir: settingsQ.data.backupDir,
      })
      setSettingsLoaded(true)
    }
  }, [settingsLoaded, settingsQ.data])

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'backup-jobs'] })
  }

  const runMut = useMutation({
    mutationFn: async (name: string) => {
      if (!NAME_RE.test(name)) {
        throw new Error('备份名仅允许字母/数字/下划线/连字符,1-64 位')
      }
      // 同步执行 pg_dump + gzip,大库耗时长 → 超时放宽到 10 分钟
      const r = await fetchApi<BackupJob>('/api/admin/backup-jobs', {
        method: 'POST',
        body: JSON.stringify({ name }),
        timeoutMs: 600_000,
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (job) => {
      invalidate()
      setDialogOpen(false)
      setNewName('')
      if (job.status === 'succeeded') {
        toast.success(`备份完成(${formatBytes(job.fileSizeBytes)})`)
      } else {
        toast.error(job.error ? `备份失败:${job.error}` : '备份失败(见服务日志)')
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi(`/api/admin/backup-jobs/${id}`, { method: 'DELETE' })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      invalidate()
      toast.success('备份记录与产物已删除')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const settingsMut = useMutation({
    mutationFn: async () => {
      const keepCount = Number(settingsForm.keepCount)
      if (!Number.isInteger(keepCount) || keepCount < 1 || keepCount > 365) {
        throw new Error('保留份数需为 1-365 的整数')
      }
      if (!/^[\d*,\-/\s]+$/.test(settingsForm.cronExpr)) {
        throw new Error('cron 表达式含非法字符')
      }
      if (settingsForm.backupDir.includes('..')) throw new Error('备份目录不允许包含 ..')
      const r = await fetchApi<BackupSettings>('/api/admin/backup-jobs/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          enabled: settingsForm.enabled,
          cronExpr: settingsForm.cronExpr.trim(),
          keepCount,
          backupDir: settingsForm.backupDir.trim(),
        }),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (s) => {
      setSettingsLoaded(false)
      void qc.invalidateQueries({ queryKey: ['admin', 'backup-jobs', 'settings'] })
      setSettingsForm({
        enabled: s.enabled,
        cronExpr: s.cronExpr,
        keepCount: String(s.keepCount),
        backupDir: s.backupDir,
      })
      setSettingsLoaded(true)
      toast.success('备份配置已保存,定时调度已重载')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const jobs = jobsQ.data ?? []
  const busy = runMut.isPending || deleteMut.isPending || settingsMut.isPending

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <HardDriveDownload className="h-5 w-5" aria-hidden />
            数据库备份作业
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            pg_dump + gzip 定时备份到本地目录,成功后按保留份数清理超额产物;支持随时手动触发一次。
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void jobsQ.refetch()}
            disabled={jobsQ.isFetching || busy}
          >
            {jobsQ.isFetching ? (
              <LoaderIcon className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            <span>刷新</span>
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)} disabled={busy}>
            <Play className="h-4 w-4" aria-hidden />
            <span>立即备份</span>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border p-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Settings2 className="h-4 w-4" aria-hidden />
          备份配置
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 min-[720px]:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="bj-cron">cron 表达式</Label>
            <Input
              id="bj-cron"
              value={settingsForm.cronExpr}
              onChange={(e) => setSettingsForm((f) => ({ ...f, cronExpr: e.target.value }))}
              placeholder="0 3 * * *"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bj-keep">保留份数</Label>
            <Input
              id="bj-keep"
              inputMode="numeric"
              value={settingsForm.keepCount}
              onChange={(e) => setSettingsForm((f) => ({ ...f, keepCount: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bj-dir">备份目录</Label>
            <Input
              id="bj-dir"
              value={settingsForm.backupDir}
              onChange={(e) => setSettingsForm((f) => ({ ...f, backupDir: e.target.value }))}
              placeholder="./backups"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bj-enabled">定时备份</Label>
            <div className="flex h-9 items-center gap-2">
              <Switch
                id="bj-enabled"
                checked={settingsForm.enabled}
                onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, enabled: v }))}
              />
              <span className="text-xs text-muted-foreground">
                {settingsForm.enabled ? '已开启' : '已关闭'}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" disabled={busy} onClick={() => settingsMut.mutate()}>
            {settingsMut.isPending ? (
              <LoaderIcon className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            <span>保存配置</span>
          </Button>
          {settingsQ.data?.updatedAt && (
            <span className="text-xs text-muted-foreground">
              最后更新 {new Date(settingsQ.data.updatedAt).toLocaleString('zh-CN')}
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">名称</th>
              <th className="px-3 py-2 font-medium">触发</th>
              <th className="px-3 py-2 font-medium">状态</th>
              <th className="px-3 py-2 font-medium">大小</th>
              <th className="px-3 py-2 font-medium">耗时</th>
              <th className="px-3 py-2 font-medium">产物路径</th>
              <th className="px-3 py-2 font-medium">时间</th>
              <th className="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  {jobsQ.isLoading ? '加载中...' : '暂无备份记录,点击「立即备份」创建第一份'}
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">
                    <TruncatedText value={job.name} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {job.type === 'scheduled' ? '定时' : '手动'}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={job.status === 'failed' ? 'destructive' : 'outline'}>
                      {STATUS_LABEL[job.status] ?? job.status}
                    </Badge>
                    {job.status === 'failed' && job.error && (
                      <div className="mt-1 text-muted-foreground">
                        <TruncatedText value={job.error} />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatBytes(job.fileSizeBytes)}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {job.durationMs === null ? '—' : `${(job.durationMs / 1000).toFixed(1)}s`}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {job.filePath ? <TruncatedText value={job.filePath} /> : '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(job.createdAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        void confirm({
                          title: '确认删除备份',
                          description: `确认删除「${job.name}」的记录与产物文件?删除后无法恢复该份备份。`,
                          variant: 'destructive',
                        }).then((ok) => {
                          if (ok) deleteMut.mutate(job.id)
                        })
                      }}
                    >
                      <Trash2 className="h-3 w-3" aria-hidden />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        说明:定时备份依赖服务进程常驻(备份配置改动即时重载调度);异地备份需另配备份目录到云盘/对象存储同步。
      </p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>立即执行备份</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bj-name">备份名称</Label>
              <Input
                id="bj-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="如 manual-20260917"
              />
              <p className="text-xs text-muted-foreground">
                仅允许字母/数字/下划线/连字符(防路径穿越),1-64 位。
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              备份为同步执行 pg_dump + gzip,大库可能耗时数十秒到数分钟,期间请勿关闭页面。
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={runMut.isPending}
            >
              <span>取消</span>
            </Button>
            <Button onClick={() => runMut.mutate(newName.trim())} disabled={runMut.isPending}>
              {runMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              <span>{runMut.isPending ? '备份中...' : '开始备份'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialogRenderer />
      {jobsQ.isLoading && !dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
