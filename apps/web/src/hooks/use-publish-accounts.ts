'use client'

/**
 * 账号管理 hook:封装 publish accounts 的 CRUD + 验证操作 + toast 反馈
 * 与 apps/api POST/GET/PUT/DELETE /api/publish/accounts 契约对齐
 * 后端透传到 ai-service,字段名 display_name(非 nickname)、user_id 从 JWT 取
 */

import * as React from 'react'
import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

export type PublishAccountStatus = 'active' | 'disabled' | 'expired'

export interface PublishAccount {
  id: number
  platform: string
  displayName: string
  status: PublishAccountStatus
  lastVerifiedAt?: string | null
  credentials?: Record<string, unknown>
}

export interface AccountInput {
  platform: string
  displayName: string
  credentials: Record<string, unknown>
}

type ListResponse = { items?: PublishAccount[]; list?: PublishAccount[] } | PublishAccount[]

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function usePublishAccounts() {
  const toast = useToast()
  const [accounts, setAccounts] = React.useState<PublishAccount[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [verifyingId, setVerifyingId] = React.useState<number | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await api<ListResponse>('/api/publish/accounts/me')
      const list = Array.isArray(data) ? data : (data.items ?? data.list ?? [])
      setAccounts(list)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  const create = React.useCallback(
    async (input: AccountInput): Promise<boolean> => {
      setSaving(true)
      try {
        await api('/api/publish/accounts', {
          method: 'POST',
          body: JSON.stringify({
            platform: input.platform,
            display_name: input.displayName,
            credentials: input.credentials,
          }),
          headers: { 'Content-Type': 'application/json' },
        })
        toast.success('账号已添加')
        await load()
        return true
      } catch (e) {
        toast.error((e as Error).message)
        return false
      } finally {
        setSaving(false)
      }
    },
    [toast, load],
  )

  const update = React.useCallback(
    async (id: number, input: AccountInput): Promise<boolean> => {
      setSaving(true)
      try {
        await api(`/api/publish/accounts/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            platform: input.platform,
            display_name: input.displayName,
            credentials: input.credentials,
          }),
          headers: { 'Content-Type': 'application/json' },
        })
        toast.success('账号已更新')
        await load()
        return true
      } catch (e) {
        toast.error((e as Error).message)
        return false
      } finally {
        setSaving(false)
      }
    },
    [toast, load],
  )

  const verify = React.useCallback(
    async (id: number): Promise<void> => {
      setVerifyingId(id)
      try {
        await api(`/api/publish/accounts/${id}/verify`, { method: 'POST' })
        toast.success('验证通过')
        await load()
      } catch (e) {
        toast.error('验证失败', (e as Error).message)
      } finally {
        setVerifyingId(null)
      }
    },
    [toast, load],
  )

  const remove = React.useCallback(
    async (id: number): Promise<boolean> => {
      try {
        await api(`/api/publish/accounts/${id}`, { method: 'DELETE' })
        toast.success('账号已删除')
        await load()
        return true
      } catch (e) {
        toast.error((e as Error).message)
        return false
      }
    },
    [toast, load],
  )

  React.useEffect(() => {
    void load()
  }, [load])

  return {
    accounts,
    loading,
    saving,
    verifyingId,
    create,
    update,
    verify,
    remove,
    reload: load,
  }
}
