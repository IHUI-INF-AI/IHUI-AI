// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 审批人选择件(2026-11-23 立)。
 *
 * 审批链存的是 users.id(通知按 userId 发微信),不是员工档案 id —— 这层区别
 * 以前没人在页面上说过,导致配错 id 后"审批不动也没人收到通知"。
 * 这里让管理员可以从后台用户池直接点选,拉不到用户池时退回手填 UUID。
 */

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'

import { apiOrThrow as api } from '@/lib/api'

export const appField =
  'rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline focus:outline-2 focus:outline-offset-0 focus:outline-stroke-focus'

interface PoolUser {
  id: string
  nickname: string | null
  phone: string | null
  email: string | null
}

export function ApproverChain({
  value,
  onChange,
  label,
}: {
  value: string[]
  onChange: (v: string[]) => void
  label: string
}) {
  const t = useTranslations('hrApproval')
  const [manual, setManual] = React.useState('')

  const pool = useQuery({
    queryKey: ['admin', 'users', 'approver-pool'],
    queryFn: () => api<{ list: PoolUser[] }>('/api/admin/users?page=1&pageSize=200'),
    retry: false,
  })
  const users = pool.data?.list ?? []
  const nameOf = (id: string): string => {
    const u = users.find((x) => x.id === id)
    if (!u) return `${id.slice(0, 8)}…`
    return u.nickname ?? u.phone ?? u.email ?? `${id.slice(0, 8)}…`
  }

  const add = (raw: string) => {
    const v = raw.trim()
    if (!v || value.includes(v)) return
    onChange([...value, v])
  }

  return (
    <div className="space-y-1">
      <span className="text-body">{label}</span>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((id, i) => (
            <span
              key={`${id}-${i}`}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-label"
            >
              {i + 1}. {nameOf(id)}
              <button
                aria-label={t('removeApprover')}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        <input
          className={appField}
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder={t('approverUuidHint')}
        />
        <button
          className="rounded-md border border-stroke-default px-2 py-1 text-xs hover:bg-muted"
          onClick={() => {
            add(manual)
            setManual('')
          }}
        >
          {t('addApprover')}
        </button>
        {users.length > 0 && (
          <select
            className={appField}
            value=""
            onChange={(e) => {
              add(e.target.value)
              e.target.value = ''
            }}
          >
            <option value="">{t('pickFromUsers')}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nickname ?? u.phone ?? u.email ?? u.id.slice(0, 8)}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}

/** 单选审批人(待办面板按 approverId 查本人待审实例用) */
export function ApproverSingle({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  placeholder?: string
}) {
  const pool = useQuery({
    queryKey: ['admin', 'users', 'approver-pool'],
    queryFn: () => api<{ list: PoolUser[] }>('/api/admin/users?page=1&pageSize=200'),
    retry: false,
  })
  const users = pool.data?.list ?? []
  return (
    <label className="text-body">
      {label}
      <div className="flex flex-wrap gap-1">
        <input
          className={appField}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? ''}
        />
        {users.length > 0 && (
          <select
            className={appField}
            value=""
            onChange={(e) => {
              onChange(e.target.value)
              e.target.value = ''
            }}
          >
            <option value="">—</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nickname ?? u.phone ?? u.email ?? u.id.slice(0, 8)}
              </option>
            ))}
          </select>
        )}
      </div>
    </label>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
