'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RefreshCw, Save, Loader2, Settings2, AlertCircle } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import {
  Card,
  CardContent,
  Button,
  Input,
  Label,
  Checkbox,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui-react'
import { Skeleton } from '@/components/ui/skeleton'
import { BackButton } from '@/components/common'

interface ChannelQuota {
  id: string
  name: string
  providerCode: string
  dailyCallLimit: number | null
  monthlyCallLimit: number | null
  dailyTokenLimit: number | null
  monthlyTokenLimit: number | null
  dailyUsedCalls: number
  monthlyUsedCalls: number
  dailyUsedTokens: number
  monthlyUsedTokens: number
}

type EditableField =
  | 'dailyCallLimit'
  | 'monthlyCallLimit'
  | 'dailyTokenLimit'
  | 'monthlyTokenLimit'

const fmt = (n: number): string => new Intl.NumberFormat().format(n)
const usageRate = (used: number, limit: number | null): number =>
  limit !== null && limit > 0 ? Math.min(100, (used / limit) * 100) : 0

/** 将输入字符串解析为 number | null;非法值回退为 null(防御 NaN)。 */
const parseLimitInput = (value: string): number | null => {
  if (value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export default function AdminChannelQuotaPage() {
  const qc = useQueryClient()
  const [rows, setRows] = React.useState<ChannelQuota[]>([])
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [batchOpen, setBatchOpen] = React.useState(false)
  const [batchForm, setBatchForm] = React.useState({
    dailyCallLimit: '',
    monthlyCallLimit: '',
    dailyTokenLimit: '',
    monthlyTokenLimit: '',
  })

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'relay', 'channel-quota'],
    queryFn: async () => {
      const r = await fetchApi<{ list: ChannelQuota[] }>('/api/admin/relay/channels')
      if (!r.success) throw new Error(r.error)
      return r.data.list
    },
  })

  React.useEffect(() => {
    if (data) setRows(data)
  }, [data])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'relay', 'channel-quota'] })
  const saveMut = useMutation({
    mutationFn: async (ch: ChannelQuota) => {
      const r = await fetchApi('/api/admin/relay/channels/' + ch.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyCallLimit: ch.dailyCallLimit,
          monthlyCallLimit: ch.monthlyCallLimit,
          dailyTokenLimit: ch.dailyTokenLimit,
          monthlyTokenLimit: ch.monthlyTokenLimit,
        }),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success('配额已更新')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateField = (id: string, field: EditableField, value: string) => {
    const num = parseLimitInput(value)
    setRows((r) =>
      r.map((c) => {
        if (c.id !== id) return c
        if (field === 'dailyCallLimit') return { ...c, dailyCallLimit: num }
        if (field === 'monthlyCallLimit') return { ...c, monthlyCallLimit: num }
        if (field === 'dailyTokenLimit') return { ...c, dailyTokenLimit: num }
        return { ...c, monthlyTokenLimit: num }
      }),
    )
  }

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set())
    else setSelected(new Set(rows.map((r) => r.id)))
  }

  const applyBatch = () => {
    const patch: Partial<Record<EditableField, number | null>> = {}
    if (batchForm.dailyCallLimit !== '') patch.dailyCallLimit = parseLimitInput(batchForm.dailyCallLimit)
    if (batchForm.monthlyCallLimit !== '') patch.monthlyCallLimit = parseLimitInput(batchForm.monthlyCallLimit)
    if (batchForm.dailyTokenLimit !== '') patch.dailyTokenLimit = parseLimitInput(batchForm.dailyTokenLimit)
    if (batchForm.monthlyTokenLimit !== '') patch.monthlyTokenLimit = parseLimitInput(batchForm.monthlyTokenLimit)
    setRows((r) => r.map((c) => (selected.has(c.id) ? { ...c, ...patch } : c)))
    setBatchOpen(false)
    setBatchForm({ dailyCallLimit: '', monthlyCallLimit: '', dailyTokenLimit: '', monthlyTokenLimit: '' })
    toast.success('已应用到 ' + selected.size + ' 个渠道,请逐行保存')
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">渠道配额管理</h1>
            <p className="text-sm text-muted-foreground">管理各渠道的调用与 Token 配额上限</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3" /> 重试
          </Button>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div className="text-sm text-muted-foreground">
              {(error as Error).message || '加载渠道配额失败'}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-6">
      <BackButton />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">渠道配额管理</h1>
          <p className="text-sm text-muted-foreground">管理各渠道的调用与 Token 配额上限</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button size="sm" variant="outline" onClick={() => setBatchOpen(true)}>
              <Settings2 className="h-3 w-3" /> 批量设置({selected.size})
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3" /> 刷新
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={rows.length > 0 && selected.size === rows.length}
                      onCheckedChange={toggleAll}
                      aria-label="全选"
                    />
                  </TableHead>
                  <TableHead>渠道</TableHead>
                  <TableHead>每日调用</TableHead>
                  <TableHead>每月调用</TableHead>
                  <TableHead>每日 Token</TableHead>
                  <TableHead>每月 Token</TableHead>
                  <TableHead>当日用量</TableHead>
                  <TableHead>当月用量</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      暂无渠道
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((c) => {
                    const dayCallRate = usageRate(c.dailyUsedCalls, c.dailyCallLimit)
                    const monCallRate = usageRate(c.monthlyUsedCalls, c.monthlyCallLimit)
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(c.id)}
                            onCheckedChange={() => toggleSelect(c.id)}
                            aria-label={'选择 ' + c.name}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {c.providerCode}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={c.dailyCallLimit ?? ''}
                            onChange={(e) => updateField(c.id, 'dailyCallLimit', e.target.value)}
                            className="h-8 w-24"
                            placeholder="不限"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={c.monthlyCallLimit ?? ''}
                            onChange={(e) => updateField(c.id, 'monthlyCallLimit', e.target.value)}
                            className="h-8 w-24"
                            placeholder="不限"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={c.dailyTokenLimit ?? ''}
                            onChange={(e) => updateField(c.id, 'dailyTokenLimit', e.target.value)}
                            className="h-8 w-28"
                            placeholder="不限"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={c.monthlyTokenLimit ?? ''}
                            onChange={(e) => updateField(c.id, 'monthlyTokenLimit', e.target.value)}
                            className="h-8 w-28"
                            placeholder="不限"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-xs tabular-nums">
                              {fmt(c.dailyUsedCalls)}
                              {c.dailyCallLimit !== null ? ' / ' + fmt(c.dailyCallLimit) : ''}
                            </div>
                            <div className="text-xs tabular-nums text-muted-foreground">
                              {fmt(c.dailyUsedTokens)} tok
                              {c.dailyTokenLimit !== null ? ' / ' + fmt(c.dailyTokenLimit) : ''}
                            </div>
                            <div className="h-2 w-20 rounded-sm bg-primary/20">
                              <div
                                className="h-2 rounded-sm bg-primary"
                                style={{ width: dayCallRate + '%' }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-xs tabular-nums">
                              {fmt(c.monthlyUsedCalls)}
                              {c.monthlyCallLimit !== null ? ' / ' + fmt(c.monthlyCallLimit) : ''}
                            </div>
                            <div className="text-xs tabular-nums text-muted-foreground">
                              {fmt(c.monthlyUsedTokens)} tok
                              {c.monthlyTokenLimit !== null ? ' / ' + fmt(c.monthlyTokenLimit) : ''}
                            </div>
                            <div className="h-2 w-20 rounded-sm bg-primary/20">
                              <div
                                className="h-2 rounded-sm bg-primary"
                                style={{ width: monCallRate + '%' }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saveMut.isPending}
                            onClick={() => saveMut.mutate(c)}
                          >
                            {saveMut.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}
                            保存
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量设置配额</DialogTitle>
            <DialogDescription>
              将应用到已选中的 {selected.size} 个渠道,留空表示不修改该字段
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="b-dc">每日调用上限</Label>
              <Input
                id="b-dc"
                type="number"
                min={0}
                value={batchForm.dailyCallLimit}
                onChange={(e) => setBatchForm({ ...batchForm, dailyCallLimit: e.target.value })}
                placeholder="留空不修改"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="b-mc">每月调用上限</Label>
              <Input
                id="b-mc"
                type="number"
                min={0}
                value={batchForm.monthlyCallLimit}
                onChange={(e) => setBatchForm({ ...batchForm, monthlyCallLimit: e.target.value })}
                placeholder="留空不修改"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="b-dt">每日 Token 上限</Label>
              <Input
                id="b-dt"
                type="number"
                min={0}
                value={batchForm.dailyTokenLimit}
                onChange={(e) => setBatchForm({ ...batchForm, dailyTokenLimit: e.target.value })}
                placeholder="留空不修改"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="b-mt">每月 Token 上限</Label>
              <Input
                id="b-mt"
                type="number"
                min={0}
                value={batchForm.monthlyTokenLimit}
                onChange={(e) => setBatchForm({ ...batchForm, monthlyTokenLimit: e.target.value })}
                placeholder="留空不修改"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(false)}>
              取消
            </Button>
            <Button onClick={applyBatch}>应用到选中渠道</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
