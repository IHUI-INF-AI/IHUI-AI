// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 用户自定义属性页(2026-09-17 立,PROJECT_PLAN 4-3 条目 55 缺失的管理端补齐)。
 *
 * 背景:55 标注「待排期」,后端 4 端点(按用户列出 / 覆盖写 / 删除 / 按属性值反查)已落地并注册
 * (routes/index.ts:1150),但前端零消费。本页补齐后 55 具备完整可用闭环。
 *
 * 数据源 /api/admin/relay/user-attributes/*。
 * 用途:给用户挂 KV 标签(tier=vip / source=referral / industry=edu),供分组、风控、运营筛选;
 * 避免把业务标签硬编码进代码或塞进 email 等字段。key 仅允许 [a-z0-9_],value ≤ 255。
 */
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Plus, Tags, Trash2, UserSearch } from 'lucide-react'

import { Badge, Button, Input, Label, Loader2 as LoaderIcon } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { BackButton, TruncatedText } from '@/components/common'
import { useConfirm } from '@/hooks/use-confirm'

interface UserAttribute {
  id: string
  userId: string
  attrKey: string
  attrValue: string
  updatedBy: string | null
  updatedAt: string
}

const KEY_RE = /^[a-z0-9_]{1,64}$/

export default function UserAttributesPage() {
  const { confirm, ConfirmDialogRenderer } = useConfirm()
  const qc = useQueryClient()
  const [userId, setUserId] = React.useState('')
  const [queryUserId, setQueryUserId] = React.useState('')
  const [newKey, setNewKey] = React.useState('')
  const [newValue, setNewValue] = React.useState('')
  const [findKey, setFindKey] = React.useState('')
  const [findValue, setFindValue] = React.useState('')
  const [findResult, setFindResult] = React.useState<string[] | null>(null)

  const attrsQ = useQuery({
    queryKey: ['admin', 'relay', 'user-attributes', queryUserId],
    enabled: queryUserId !== '',
    queryFn: async () => {
      const r = await fetchApi<{ attrs: UserAttribute[]; total: number }>(
        `/api/admin/relay/user-attributes/${encodeURIComponent(queryUserId)}`,
      )
      if (!r.success) throw new Error(r.error)
      return r.data.attrs
    },
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'relay', 'user-attributes'] })
  }

  const setMut = useMutation({
    mutationFn: async (p: { uid: string; key: string; value: string }) => {
      if (!KEY_RE.test(p.key)) {
        throw new Error('key 仅允许小写字母/数字/下划线,1-64 位')
      }
      if (!p.value || p.value.length > 255) throw new Error('value 必填且不超过 255 字符')
      const r = await fetchApi(
        `/api/admin/relay/user-attributes/${encodeURIComponent(p.uid)}/${encodeURIComponent(p.key)}`,
        { method: 'PUT', body: JSON.stringify({ value: p.value }) },
      )
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      invalidate()
      setNewKey('')
      setNewValue('')
      toast.success('属性已保存')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: async (p: { uid: string; key: string }) => {
      const r = await fetchApi(
        `/api/admin/relay/user-attributes/${encodeURIComponent(p.uid)}/${encodeURIComponent(p.key)}`,
        { method: 'DELETE' },
      )
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      invalidate()
      toast.success('属性已删除')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const findMut = useMutation({
    mutationFn: async () => {
      if (!KEY_RE.test(findKey.trim())) throw new Error('key 仅允许小写字母/数字/下划线')
      if (!findValue.trim()) throw new Error('value 不能为空')
      const qs = new URLSearchParams({ key: findKey.trim(), value: findValue.trim() })
      const r = await fetchApi<{ userIds: string[]; total: number }>(
        `/api/admin/relay/user-attributes/find?${qs.toString()}`,
      )
      if (!r.success) throw new Error(r.error)
      return r.data.userIds
    },
    onSuccess: (ids) => {
      setFindResult(ids)
      toast.success(`命中 ${ids.length} 个用户`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const loadUser = () => {
    const uid = userId.trim()
    if (!uid) {
      toast.error('请输入用户 id')
      return
    }
    setQueryUserId(uid)
    setFindResult(null)
  }

  const busy = setMut.isPending || deleteMut.isPending
  const attrs = attrsQ.data ?? []

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Tags className="h-5 w-5" aria-hidden />
          用户自定义属性
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          给中转站用户挂 KV 标签,供分组 / 风控 /
          运营筛选使用。同一用户同键只保留一个值,重复保存即覆盖。
        </p>
      </div>

      <div className="rounded-lg border p-3">
        <h2 className="text-sm font-medium">按用户维护</h2>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[240px] flex-1 space-y-1.5">
            <Label htmlFor="ua-user">用户 id</Label>
            <Input
              id="ua-user"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="users.id(UUID)"
            />
          </div>
          <Button size="sm" onClick={loadUser}>
            <UserSearch className="h-4 w-4" aria-hidden />
            <span>查询</span>
          </Button>
        </div>

        {queryUserId !== '' && (
          <>
            <div className="mt-4 overflow-x-auto rounded-lg border">
              <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">属性键</th>
                    <th className="px-3 py-2 font-medium">属性值</th>
                    <th className="px-3 py-2 font-medium">最后更新人</th>
                    <th className="px-3 py-2 font-medium">更新时间</th>
                    <th className="px-3 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {attrs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                        {attrsQ.isLoading ? '加载中...' : '该用户暂无自定义属性'}
                      </td>
                    </tr>
                  ) : (
                    attrs.map((attr) => (
                      <tr key={attr.id} className="border-t border-border">
                        <td className="px-3 py-2 font-mono">{attr.attrKey}</td>
                        <td className="px-3 py-2">
                          <TruncatedText value={attr.attrValue} />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{attr.updatedBy ?? '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(attr.updatedAt).toLocaleString('zh-CN')}
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                              void confirm({
                                title: '确认删除属性',
                                description: `确认删除「${attr.attrKey}」?依赖该标签的分组/筛选会立即失去依据。`,
                                variant: 'destructive',
                              }).then((ok) => {
                                if (ok) deleteMut.mutate({ uid: queryUserId, key: attr.attrKey })
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

            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="min-w-[160px] flex-1 space-y-1.5">
                <Label htmlFor="ua-new-key">属性键</Label>
                <Input
                  id="ua-new-key"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="tier"
                />
              </div>
              <div className="min-w-[200px] flex-1 space-y-1.5">
                <Label htmlFor="ua-new-value">属性值</Label>
                <Input
                  id="ua-new-value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="vip"
                />
              </div>
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  setMut.mutate({ uid: queryUserId, key: newKey.trim(), value: newValue.trim() })
                }
              >
                {setMut.isPending ? (
                  <LoaderIcon className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden />
                )}
                <span>保存属性</span>
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="rounded-lg border p-3">
        <h2 className="text-sm font-medium">按属性反查用户(运营筛选)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          例:key = tier、value = vip,查出所有 VIP 用户 id(上限 1000,结果按 id 返回)。
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[160px] flex-1 space-y-1.5">
            <Label htmlFor="ua-find-key">属性键</Label>
            <Input
              id="ua-find-key"
              value={findKey}
              onChange={(e) => setFindKey(e.target.value)}
              placeholder="tier"
            />
          </div>
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label htmlFor="ua-find-value">属性值</Label>
            <Input
              id="ua-find-value"
              value={findValue}
              onChange={(e) => setFindValue(e.target.value)}
              placeholder="vip"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={findMut.isPending}
            onClick={() => findMut.mutate()}
          >
            {findMut.isPending ? (
              <LoaderIcon className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <UserSearch className="h-4 w-4" aria-hidden />
            )}
            <span>反查</span>
          </Button>
        </div>
        {findResult !== null && (
          <div className="mt-3 space-y-2">
            <div className="text-xs text-muted-foreground">命中 {findResult.length} 个用户</div>
            <div className="flex flex-wrap gap-1.5">
              {findResult.length === 0 ? (
                <span className="text-xs text-muted-foreground">无匹配用户</span>
              ) : (
                findResult.map((id) => (
                  <Badge key={id} variant="outline">
                    {id}
                  </Badge>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialogRenderer />
      {attrsQ.isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
