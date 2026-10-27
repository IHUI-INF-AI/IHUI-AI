// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Ban, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Button, Card, CardContent, Input, Label } from '@ihui/ui-react'
import { useConfirm } from '@/hooks/use-confirm'
import { BASE, PHONE_RE, api, fmtTime, maskPhone, normalizePhoneInput } from './helpers'
import type { SmsUnsubscribesResponse } from './types'

const PAGE_SIZE = 20

const SOURCE_LABELS: Record<string, string> = {
  reply: '回复退订',
  admin: '管理员拉黑',
  manual: '手工录入',
}

export function UnsubscribePanel() {
  const qc = useQueryClient()
  const { confirm, ConfirmDialogRenderer } = useConfirm()
  const [offset, setOffset] = React.useState(0)
  const [phone, setPhone] = React.useState('')
  const [reason, setReason] = React.useState('')

  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
  }).toString()
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'sms-operations', 'unsubscribes', params],
    queryFn: () => api<SmsUnsubscribesResponse>(`${BASE}/unsubscribes?${params}`),
  })
  const items = data?.items ?? []
  const total = data?.total ?? 0
  const page = Math.floor(offset / PAGE_SIZE) + 1
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const addMut = useMutation({
    mutationFn: (target: string) =>
      api(`${BASE}/unsubscribes`, {
        method: 'POST',
        body: JSON.stringify({ phone: target, reason: reason.trim() || undefined }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sms-operations'] })
      toast.success('已加入退订黑名单')
      setPhone('')
      setReason('')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const delMut = useMutation({
    mutationFn: (target: string) =>
      api(`${BASE}/unsubscribes/${encodeURIComponent(target)}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sms-operations'] })
      toast.success('已恢复接收')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const target = normalizePhoneInput(phone)
    if (!PHONE_RE.test(target)) {
      toast.error('手机号格式不正确(支持 13800000000 / +8613800000000)')
      return
    }
    addMut.mutate(target)
  }

  async function handleRemove(target: string) {
    const ok = await confirm({
      title: '恢复接收',
      description: `确认将 ${maskPhone(target)} 移出退订黑名单?仅在该用户明确重新同意接收后使用,否则会构成骚扰。`,
      confirmText: '恢复接收',
    })
    if (ok) delMut.mutate(target)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <form className="flex flex-wrap items-end gap-3" onSubmit={submit}>
            <div className="space-y-1">
              <Label htmlFor="unsub-phone">手机号</Label>
              <Input
                id="unsub-phone"
                className="w-48"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="13800000000"
                inputMode="tel"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="unsub-reason">原因</Label>
              <Input
                id="unsub-reason"
                className="w-64"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="用户电话投诉等"
                maxLength={160}
              />
            </div>
            <Button type="submit" size="sm" disabled={addMut.isPending}>
              {addMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              加入黑名单
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              共 {total} 人 · 第 {page}/{totalPages} 页
            </span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => void refetch()}>
              <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              刷新
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">号码</th>
                  <th className="px-3 py-2 font-medium">来源</th>
                  <th className="px-3 py-2 font-medium">原因</th>
                  <th className="px-3 py-2 font-medium">原始回复</th>
                  <th className="px-3 py-2 font-medium">更新时间</th>
                  <th className="px-3 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      加载中…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                      <Ban className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      暂无退订记录
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.phone} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono">{maskPhone(row.phone)}</td>
                      <td className="px-3 py-2">
                        {row.source ? (SOURCE_LABELS[row.source] ?? row.source) : '-'}
                      </td>
                      <td className="max-w-64 truncate px-3 py-2" title={row.reason ?? ''}>
                        {row.reason ?? '-'}
                      </td>
                      <td className="max-w-32 truncate px-3 py-2" title={row.raw_content ?? ''}>
                        {row.raw_content ?? '-'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{fmtTime(row.updated_at)}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                          disabled={delMut.isPending}
                          onClick={() => void handleRemove(row.phone)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          恢复
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              上一页
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              下一页
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialogRenderer />
    </div>
  )
}
