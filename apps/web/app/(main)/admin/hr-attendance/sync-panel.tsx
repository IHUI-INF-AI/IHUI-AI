// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 考勤 IM 同步面板(2026-11-13 立,人事自动化收口的前端面)。
 *
 * 把后端已落库的两个同步端点接到界面:
 *   · GET  /api/hr-attendance/sync/status —— 最近一次运行状态(读 view|manage)
 *   · POST /api/hr-attendance/sync/run    —— 手动触发一次全量同步(写 manage)
 *
 * 展示面:同步总开关态 / 扫描用户数 / 尝试次数 / 成功批次数 / 因未实现跳过数 /
 * 错误明细 / 完成时间。手动触发按钮受 hr:attendance:manage 权限闸。
 *
 * 安全边界:触发走后端 requirePermission,前端 HasPermi 只做可见性;同步产出暂存
 * 批次,裁决/确认仍走人工闸,本面板不绕过。
 */

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { RefreshCw, ShieldCheck, ShieldOff } from 'lucide-react'

import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui-react'
import { apiOrThrow as api } from '@/lib/api'
import { PERM, RESOURCE as ATT_RESOURCE } from './helpers'

type TFunc = ReturnType<typeof useTranslations>

/** 最近一次运行状态(对齐 api 侧 SyncLastRunStatus) */
interface SyncLastRun {
  enabled: boolean
  scannedUsers: number
  attempted: number
  syncedBatches: number
  skippedNotImplemented: number
  errors: string[]
  finishedAt: string
}

/** 字段行:标签 + 值 */
function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

export function SyncPanel({ t }: { t: TFunc }) {
  const qc = useQueryClient()

  // 最近一次运行状态(轮询关:手动触发后经 invalidate 刷新)
  const statusQuery = useQuery({
    queryKey: ['hr', 'attendance-sync', 'status'],
    queryFn: async () => {
      const res = await api<{ lastRun: SyncLastRun | null }>(
        `${ATT_RESOURCE}/sync/status`,
      )
      return res.lastRun ?? null
    },
  })

  // 手动触发一次同步(写 manage)
  const runMut = useMutation({
    mutationFn: async () => {
      const res = await api<{ sync: SyncLastRun }>(`${ATT_RESOURCE}/sync/run`, {
        method: 'POST',
      })
      return res.sync
    },
    onSuccess: (d) => {
      if (d.enabled) {
        toast.success(t('syncRan', { syncedBatches: d.syncedBatches }))
      } else {
        toast.info(t('syncDisabled'))
      }
      qc.invalidateQueries({ queryKey: ['hr', 'attendance-sync', 'status'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const last = statusQuery.data
  const hasErrors = (last?.errors.length ?? 0) > 0

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <RefreshCw className="h-4 w-4 text-primary" />
        {t('tabSync')}
      </h2>
      <p className="text-muted-foreground text-body">{t('syncHint')}</p>

      <div className="flex flex-wrap items-center gap-2">
        <HasPermi code={`${PERM}:manage`}>
          <Button
            size="sm"
            disabled={runMut.isPending}
            onClick={() => runMut.mutate()}
          >
            <RefreshCw className="mr-1 h-4 w-4" />
            {runMut.isPending ? t('syncRunning') : t('syncRunNow')}
          </Button>
        </HasPermi>
      </div>

      {statusQuery.isLoading ? (
        <div className="text-muted-foreground text-body">{t('syncLoading')}</div>
      ) : last ? (
        <div className="space-y-2 rounded-lg border bg-muted/50 px-4 py-3 text-body">
          {/* 总开关态:开=绿盾 关=灰盾(只读展示,开关在 system_configs) */}
          <div className="flex items-center gap-2">
            {last.enabled ? (
              <ShieldCheck className="h-4 w-4 text-green-600" />
            ) : (
              <ShieldOff className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-medium">
              {last.enabled ? t('syncEnabled') : t('syncDisabledBadge')}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
            <StatRow label={t('syncScannedUsers')} value={last.scannedUsers} />
            <StatRow label={t('syncAttempted')} value={last.attempted} />
            <StatRow label={t('syncSyncedBatches')} value={last.syncedBatches} />
            <StatRow
              label={t('syncSkippedNotImplemented')}
              value={last.skippedNotImplemented}
            />
            <StatRow label={t('syncFinishedAt')} value={formatTime(last.finishedAt)} />
          </div>

          {hasErrors && (
            <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
              <div className="font-medium text-destructive">
                {t('syncErrors', { count: last.errors.length })}
              </div>
              <ul className="font-[weight:inherit] mt-1 list-inside list-disc space-y-0.5 text-body">
                {last.errors.map((e, i) => (
                  <li key={i} className="text-muted-foreground">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-muted/50 px-4 py-3 text-muted-foreground text-body">
          {t('syncNeverRun')}
        </div>
      )}
    </section>
  )
}

/** ISO 时间 → 本地可读(服务端时区一致性由 Intl 处理) */
function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
