// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 号池调度精细控制页(2026-09-17 立,PROJECT_PLAN 4-2 条目 51 缺失的管理端补齐)。
 *
 * 背景:51 交付时后端 2 端点 + channel-router 选路消费已落地(ai_relay_key_pool 三列
 * temp_unschedulable / rate_multiplier / rpm_override),但前端零消费,运营无法自助摘除
 * 抖动账号或临时压下某账号的速率,只能改库。
 *
 * 数据源 /api/admin/relay/key-scheduling(列表)+ PATCH /:id(单 Key 更新)。
 * 语义:PATCH 传 undefined = 不改;传 null = **清除覆盖恢复全局**;页面用「恢复全局」按钮显式传 null。
 * 排队中的 key 不上架任何明文,列表只给 keyPrefix 前缀。
 */
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Gauge, Loader2, RotateCcw } from 'lucide-react'

import { Badge, Button, Input, Label, Loader2 as LoaderIcon, Switch } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { BackButton } from '@/components/common'

interface KeyRow {
  id: string
  providerCode: string
  keyPrefix: string | null
  priority: number
  weight: number | null
  isEnabled: boolean
  tempUnschedulable: boolean
  rateMultiplier: number | null
  rpmOverride: number | null
  healthStatus: string | null
  healthCheckedAt: string | null
}

/** 编辑中的本地草稿(空串代表「未设置/恢复全局」) */
interface Draft {
  rateMultiplier: string
  rpmOverride: string
}

const HEALTH_LABEL: Record<string, string> = {
  up: '正常',
  down: '不可用',
  unknown: '未探测',
  degraded: '降级',
}

export default function KeySchedulingPage() {
  const qc = useQueryClient()
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({})

  const listQ = useQuery({
    queryKey: ['admin', 'relay', 'key-scheduling'],
    queryFn: async () => {
      const r = await fetchApi<{ list: KeyRow[]; total: number }>('/api/admin/relay/key-scheduling')
      if (!r.success) throw new Error(r.error)
      return r.data.list
    },
  })

  /** 引用稳定:避免 `?? []` 每次渲染new 数组导致 useEffect 依赖失稳反复执行 */
  const rows = React.useMemo(() => listQ.data ?? [], [listQ.data])

  /** 首次渲染时用服务端值填充草稿;用户编辑不动服务端值,保存后由 invalidate 重取 */
  React.useEffect(() => {
    if (rows.length === 0) return
    setDrafts((prev) => {
      const next = { ...prev }
      let changed = false
      for (const row of rows) {
        if (!next[row.id]) {
          next[row.id] = {
            rateMultiplier: row.rateMultiplier === null ? '' : String(row.rateMultiplier),
            rpmOverride: row.rpmOverride === null ? '' : String(row.rpmOverride),
          }
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [rows])

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'relay', 'key-scheduling'] })
  }

  /** 统一更新入口:显式区分「不改(undefined)」与「清除(null)」两种语义 */
  const patchMut = useMutation({
    mutationFn: async (p: {
      id: string
      body: {
        tempUnschedulable?: boolean
        rateMultiplier?: number | null
        rpmOverride?: number | null
      }
      successText: string
    }) => {
      const r = await fetchApi(`/api/admin/relay/key-scheduling/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify(p.body),
      })
      if (!r.success) throw new Error(r.error)
      return p.successText
    },
    onSuccess: (text) => {
      invalidate()
      toast.success(text)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const patchBusy = patchMut.isPending

  const setDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { rateMultiplier: '', rpmOverride: '' }), ...patch },
    }))
  }

  /** 保存倍率/RPM 覆盖:空串 → null(恢复全局);非法数字直接拒绝 */
  const saveOverrides = (row: KeyRow) => {
    const draft = drafts[row.id]
    if (!draft) return
    const rateText = draft.rateMultiplier.trim()
    const rpmText = draft.rpmOverride.trim()
    let rate: number | null = null
    let rpm: number | null = null
    if (rateText !== '') {
      const parsed = Number(rateText)
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        toast.error('倍率需为 0-100 之间的数字,留空表示恢复全局')
        return
      }
      rate = parsed
    }
    if (rpmText !== '') {
      const parsed = Number(rpmText)
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100000) {
        toast.error('RPM 需为 0-100000 的整数,留空表示恢复全局')
        return
      }
      rpm = parsed
    }
    patchMut.mutate({
      id: row.id,
      body: { rateMultiplier: rate, rpmOverride: rpm },
      successText: rate === null && rpm === null ? '已恢复全局调度参数' : '调度参数已更新',
    })
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Gauge className="h-5 w-5" aria-hidden />
          号池调度精细控制
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          账号级临时摘除(不打健康牌)、速率倍率覆盖、RPM 覆盖。留空 =
          恢复全局默认;改动写库后选路即时生效。
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">渠道</th>
              <th className="px-3 py-2 font-medium">Key 前缀</th>
              <th className="px-3 py-2 font-medium">健康</th>
              <th className="px-3 py-2 font-medium">优先级/权重</th>
              <th className="px-3 py-2 font-medium">临时摘除</th>
              <th className="px-3 py-2 font-medium">倍率覆盖</th>
              <th className="px-3 py-2 font-medium">RPM 覆盖</th>
              <th className="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  {listQ.isLoading ? '加载中...' : '号池暂无 Key 条目'}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const draft = drafts[row.id] ?? { rateMultiplier: '', rpmOverride: '' }
                const down = row.healthStatus === 'down'
                return (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{row.providerCode}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">
                      {row.keyPrefix ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={down ? 'destructive' : 'outline'}>
                        {HEALTH_LABEL[row.healthStatus ?? 'unknown'] ?? row.healthStatus ?? '未知'}
                      </Badge>
                      {!row.isEnabled && (
                        <span className="ml-1 text-muted-foreground">(已停用)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.priority} / {row.weight ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Switch
                        checked={row.tempUnschedulable}
                        disabled={patchBusy}
                        onCheckedChange={(v) =>
                          patchMut.mutate({
                            id: row.id,
                            body: { tempUnschedulable: v },
                            successText: v ? '已临时摘除该账号' : '已恢复该账号参与调度',
                          })
                        }
                        aria-label={`临时摘除 ${row.providerCode} ${row.keyPrefix ?? ''}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-7 w-20"
                        inputMode="decimal"
                        value={draft.rateMultiplier}
                        placeholder="全局"
                        aria-label={`倍率覆盖 ${row.providerCode} ${row.keyPrefix ?? ''}`}
                        onChange={(e) => setDraft(row.id, { rateMultiplier: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-7 w-20"
                        inputMode="numeric"
                        value={draft.rpmOverride}
                        placeholder="全局"
                        aria-label={`RPM 覆盖 ${row.providerCode} ${row.keyPrefix ?? ''}`}
                        onChange={(e) => setDraft(row.id, { rpmOverride: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={patchBusy}
                          onClick={() => saveOverrides(row)}
                        >
                          <span>保存覆盖</span>
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={patchBusy}
                          onClick={() => {
                            setDraft(row.id, { rateMultiplier: '', rpmOverride: '' })
                            patchMut.mutate({
                              id: row.id,
                              body: { rateMultiplier: null, rpmOverride: null },
                              successText: '已恢复全局调度参数',
                            })
                          }}
                        >
                          <RotateCcw className="h-3 w-3" aria-hidden />
                          <span>恢复全局</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Label className="text-xs font-normal">说明</Label>
        「临时摘除」不改变健康状态,仅让选路跳过该账号,适合上游抖动但不想打健康牌的场景;
      </p>

      {listQ.isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      )}
      {patchBusy && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs">
          <LoaderIcon className="h-4 w-4 animate-spin" aria-hidden />
          正在写入...
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
