// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 我的群组页面(/groups)。
 * 与 RN `apps/mobile-rn/src/screens/GroupsScreen.tsx` 共用同一份渲染
 * (`@ihui/rn-app/features/groups/GroupsScreen`,react-native-web 承载)。
 * 本页只保留 web 侧数据编排与平台件:toast、useConfirm、登录态门、页头。
 */

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { UsersRound } from 'lucide-react'
import type { TFunction } from '@ihui/types'
import {
  GroupsScreen as SharedGroupsScreen,
  type GroupFormValues,
  type GroupView,
} from '@ihui/rn-app/features/groups/GroupsScreen'
import { apiOrThrow } from '@/lib/api'
import { formatDate } from '@/lib/date-utils'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/hooks/use-toast'
import { useConfirm } from '@/hooks/use-confirm'
import { AuthGatePrompt, BackButton } from '@/components/common'

type GroupRow = GroupView & { status?: string; updatedAt?: string }

function jsonOptions(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export default function GroupsPage() {
  const t = useTranslations()
  const tGate = useTranslations('chatHistory')
  const locale = useLocale()
  const toast = useToast()
  const { allow } = useAuthGate()
  const { confirm, ConfirmDialogRenderer } = useConfirm()
  const currentUserId = useAuthStore((s) => s.user?.id ?? null)

  const [groups, setGroups] = React.useState<GroupView[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoadError(null)
    try {
      const res = await apiOrThrow<{ list: GroupRow[] }>('/api/groups')
      setGroups(res.list ?? [])
    } catch (err) {
      setGroups([])
      setLoadError(err instanceof Error ? err.message : t('eduAi.groups.error'))
    } finally {
      setLoading(false)
    }
  }, [t])

  React.useEffect(() => {
    if (!allow) {
      setLoading(false)
      return
    }
    void load()
  }, [allow, load])

  const handleCreate = async (values: GroupFormValues) => {
    await apiOrThrow(
      '/api/groups',
      jsonOptions('POST', {
        name: values.name,
        ...(values.description ? { description: values.description } : {}),
      }),
    )
    toast.success(t('eduAi.groups.success'))
    await load()
  }

  const handleUpdate = async (id: string, values: GroupFormValues) => {
    await apiOrThrow(
      `/api/groups/${id}`,
      jsonOptions('PATCH', {
        name: values.name,
        ...(values.description ? { description: values.description } : {}),
      }),
    )
    toast.success(t('eduAi.groups.success'))
    await load()
  }

  const handleDelete = async (id: string) => {
    await apiOrThrow(`/api/groups/${id}`, { method: 'DELETE' })
    toast.success(t('eduAi.groups.success'))
    await load()
  }

  const handleAddMember = async (id: string, userId: string) => {
    await apiOrThrow(`/api/groups/${id}/members`, jsonOptions('POST', { userId }))
    toast.success(t('eduAi.groups.success'))
    await load()
  }

  const handleConfirm = (options: { title: string; message: string; destructive?: boolean }) =>
    confirm({
      title: options.title,
      description: options.message,
      variant: options.destructive ? 'destructive' : 'default',
    })

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4">
      <BackButton fallbackHref="/" />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-display font-bold tracking-tight">
          <UsersRound className="h-7 w-7 text-primary" />
          {t('eduAi.groups.title')}
        </h1>
        <p className="text-label text-muted-foreground">{t('eduAi.groups.subtitle')}</p>
      </header>

      {!allow ? (
        <AuthGatePrompt message={tGate('loginRequired')} />
      ) : (
        <SharedGroupsScreen
          t={t as unknown as TFunction}
          colorScheme="light"
          groups={groups}
          loading={loading}
          error={loadError}
          currentUserId={currentUserId}
          formatDate={(iso) => formatDate(iso, locale)}
          onRefresh={load}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onAddMember={handleAddMember}
          onConfirm={handleConfirm}
        />
      )}
      <ConfirmDialogRenderer />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
