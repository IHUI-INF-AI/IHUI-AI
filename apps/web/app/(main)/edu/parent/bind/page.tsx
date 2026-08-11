'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  UserPlus,
  Link as LinkIcon,
  Trash2,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@ihui/ui-react'
import { Alert, ConfirmDialog, Tooltip } from '@/components/feedback'
import { BackButton } from '@/components/common'
import { Input } from '@/components/form'
import { Badge } from '@/components/data'

interface BindingRecord {
  id: string
  parentId: string
  studentId: string
  relationship: string
  status: string
  confirmedAt: string | null
  createdAt: string
}

interface BindingListResponse {
  list: BindingRecord[]
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const RELATIONSHIP_OPTIONS = [
  { value: 'father', label: '父亲' },
  { value: 'mother', label: '母亲' },
  { value: 'guardian', label: '监护人' },
  { value: 'other', label: '其他' },
]

const STATUS_LABELS: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  rejected: '已拒绝',
}

const STATUS_VARIANTS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

export default function ParentBindPage() {
  const t = useTranslations('parentPortal')
  const tc = useTranslations('common')
  const queryClient = useQueryClient()

  const [studentId, setStudentId] = React.useState('')
  const [relationship, setRelationship] = React.useState('father')
  const [showDeleteId, setShowDeleteId] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['parent', 'bindings'],
    queryFn: () => api<BindingListResponse>('/api/edu-ai-management/parent-binding'),
  })

  const bindings = data?.list ?? []

  const createMutation = useMutation({
    mutationFn: (body: { parentId: string; studentId: string; relationship: string }) =>
      api('/api/edu-ai-management/parent-binding', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent', 'bindings'] })
      queryClient.invalidateQueries({ queryKey: ['parent', 'children'] })
      setStudentId('')
      setRelationship('father')
    },
  })

  const confirmMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/edu-ai-management/parent-binding/${id}/confirm`, { method: 'PUT' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent', 'bindings'] })
      queryClient.invalidateQueries({ queryKey: ['parent', 'children'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/edu-ai-management/parent-binding/${id}/reject`, { method: 'PUT' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent', 'bindings'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/edu-ai-management/parent-binding/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent', 'bindings'] })
      queryClient.invalidateQueries({ queryKey: ['parent', 'children'] })
      setShowDeleteId(null)
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentId.trim()) return
    createMutation.mutate({ parentId: '', studentId: studentId.trim(), relationship })
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('bind.title')}</h1>
        <p className="text-xs text-muted-foreground">{t('bind.subtitle')}</p>
      </header>

      {/* 创建绑定 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <UserPlus className="h-4 w-4 text-primary" />
            {t('bind.createTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('bind.studentIdLabel')}</p>
              <Input
                value={studentId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStudentId(e.target.value)}
                placeholder={t('bind.studentIdPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('bind.relationshipLabel')}</p>
              <select
                value={relationship}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRelationship(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {RELATIONSHIP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={createMutation.isPending || !studentId.trim()}>
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LinkIcon className="mr-2 h-4 w-4" />
              )}
              {t('bind.submit')}
            </Button>
            {createMutation.isError && (
              <Alert variant="danger" description={(createMutation.error as Error).message} />
            )}
            {createMutation.isSuccess && (
              <Alert variant="success" description={t('bind.success')} />
            )}
          </form>
        </CardContent>
      </Card>

      {/* 绑定列表 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <LinkIcon className="h-4 w-4 text-primary" />
            {t('bind.listTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : bindings.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t('bind.empty')}</p>
          ) : (
            <div className="space-y-3">
              {bindings.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{b.studentId}</span>
                      <Badge className={STATUS_VARIANTS[b.status] ?? ''}>
                        {STATUS_LABELS[b.status] ?? b.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('bind.relationship')}: {RELATIONSHIP_OPTIONS.find((o) => o.value === b.relationship)?.label ?? b.relationship}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {b.status === 'pending' && (
                      <>
                        <Tooltip content={t('bind.confirm')}>
                          <button
                            onClick={() => confirmMutation.mutate(b.id)}
                            className="rounded-lg p-2 text-emerald-600 transition-colors hover:bg-emerald-50"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        </Tooltip>
                        <Tooltip content={t('bind.reject')}>
                          <button
                            onClick={() => rejectMutation.mutate(b.id)}
                            className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </Tooltip>
                      </>
                    )}
                    <Tooltip content={tc('delete')}>
                      <button
                        onClick={() => setShowDeleteId(b.id)}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={showDeleteId !== null}
        title={t('bind.deleteTitle')}
        content={t('bind.deleteConfirm')}
        variant="danger"
        confirmText={tc('confirm')}
        cancelText={tc('cancel')}
        loading={deleteMutation.isPending}
        onConfirm={() => showDeleteId && deleteMutation.mutate(showDeleteId)}
        onCancel={() => setShowDeleteId(null)}
      />
    </div>
  )
}