'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  UserPlus,
  ChevronDown,
  Shield,
  UsersRound,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { formatDate } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import { BackButton } from '@/components/common'
import { Alert } from '@/components/feedback'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@ihui/ui-react'

// =============================================================================
// 类型定义(与 apps/api/src/routes/groups.ts 的 userGroups 表结构对应)
// =============================================================================

interface Group {
  id: string
  name: string
  type: string
  description?: string | null
  ownerId: string | null
  memberCount: number
  status: 'active' | 'disabled'
  createdAt: string
  updatedAt: string
}

interface GroupListData {
  list: Group[]
}

interface GroupMember {
  id: string
  groupId: string
  userId: string
  role: string
  createdAt: string
}

interface FeedbackState {
  type: 'success' | 'danger'
  message: string
}

// =============================================================================
// API 辅助
// =============================================================================

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetchApi<T>(url, options)
  if (!res.success) throw new Error(res.error)
  return res.data
}

function jsonOptions(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

// =============================================================================
// 成员管理面板
// 后端无 GET /:id/members 端点,展示群主 + 成员数,支持按用户 ID 添加成员
// =============================================================================

function MemberPanel({ group }: { group: Group }) {
  const t = useTranslations('eduAi.groups')
  const queryClient = useQueryClient()

  const [userId, setUserId] = React.useState('')
  const [error, setError] = React.useState('')
  const [success, setSuccess] = React.useState(false)

  const addMember = useMutation({
    mutationFn: async (id: string) => {
      await api<{ member: GroupMember }>(
        `/api/groups/${group.id}/members`,
        jsonOptions('POST', { userId: id }),
      )
    },
    onSuccess: () => {
      setUserId('')
      setSuccess(true)
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  return (
    <div className="space-y-3">
      {success && (
        <Alert
          variant="success"
          description={t('success')}
          closable
          onClose={() => setSuccess(false)}
        />
      )}
      {error && (
        <Alert variant="danger" description={error} closable onClose={() => setError('')} />
      )}

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Shield className="h-3.5 w-3.5 shrink-0 text-primary/70" />
        <span className="truncate">
          {t('owner')}: {group.ownerId ?? '-'}
        </span>
        <span className="ml-auto shrink-0">
          {t('members')}: {group.memberCount}
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder={t('userId')}
          className="h-9"
          aria-label={t('userId')}
        />
        <Button
          size="sm"
          onClick={() => userId.trim() && addMember.mutate(userId.trim())}
          disabled={!userId.trim() || addMember.isPending}
          className="shrink-0"
        >
          {addMember.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="mr-1.5 h-4 w-4" />
          )}
          {t('addMember')}
        </Button>
      </div>
    </div>
  )
}

// =============================================================================
// 编辑群组对话框
// =============================================================================

interface EditGroupDialogProps {
  group: Group | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (payload: { name: string; description?: string }) => Promise<void>
}

function EditGroupDialog({ group, open, onOpenChange, onSave }: EditGroupDialogProps) {
  const t = useTranslations('eduAi.groups')
  const tc = useTranslations('common')

  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (open && group) {
      setName(group.name)
      setDescription(group.description ?? '')
      setError('')
    }
  }, [open, group])

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t('groupNameRequired'))
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({ name: name.trim(), description: description.trim() || undefined })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('edit')}</DialogTitle>
          <DialogDescription>{group?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error && (
            <Alert variant="danger" description={error} closable onClose={() => setError('')} />
          )}
          <div className="space-y-1.5">
            <Label htmlFor="group-name">{t('groupName')}</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('groupName')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group-desc">{t('description')}</Label>
            <Input
              id="group-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('description')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {tc('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// 单个群组卡片
// =============================================================================

function GroupCard({
  group,
  onEdit,
  onDelete,
}: {
  group: Group
  onEdit: (group: Group) => void
  onDelete: (group: Group) => void
}) {
  const t = useTranslations('eduAi.groups')
  const locale = useLocale()

  const [membersOpen, setMembersOpen] = React.useState(false)
  const isCustomType = group.type === 'custom'

  return (
    <Card className="flex flex-col">
      <CardHeader className="gap-1.5 p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-1 text-base">{group.name}</CardTitle>
          <span
            className={cn(
              'shrink-0 rounded-md px-2 py-0.5 text-xs',
              isCustomType ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
            )}
          >
            {isCustomType ? t('custom') : group.type}
          </span>
        </div>
        {group.description && (
          <CardDescription className="line-clamp-2 text-xs">{group.description}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-2 p-4 pt-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 shrink-0" />
            {t('members')}: {group.memberCount}
          </span>
          <span className="flex items-center gap-1.5">
            <UsersRound className="h-3.5 w-3.5 shrink-0" />
            {t('createdAt')}: {formatDate(group.createdAt, locale)}
          </span>
        </div>

        {membersOpen && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <MemberPanel group={group} />
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            aria-expanded={membersOpen}
            onClick={() => setMembersOpen((o) => !o)}
          >
            {t('memberList')}
            <ChevronDown
              className={cn('ml-1 h-3.5 w-3.5 transition-transform', membersOpen && 'rotate-180')}
            />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(group)}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            {t('edit')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onDelete(group)}>
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            {t('delete')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// =============================================================================
// 页面主体
// =============================================================================

export default function GroupsPage() {
  const t = useTranslations('eduAi.groups')
  const tc = useTranslations('common')
  const queryClient = useQueryClient()

  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [feedback, setFeedback] = React.useState<FeedbackState | null>(null)
  const [editingGroup, setEditingGroup] = React.useState<Group | null>(null)
  const [editOpen, setEditOpen] = React.useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api<GroupListData>('/api/groups'),
  })

  const createGroup = useMutation({
    mutationFn: async (payload: { name: string; description?: string }) => {
      const res = await api<{ group: Group }>('/api/groups', jsonOptions('POST', payload))
      return res.group
    },
    onSuccess: () => {
      setName('')
      setDescription('')
      setFeedback({ type: 'success', message: t('success') })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
    onError: (err: Error) => setFeedback({ type: 'danger', message: err.message }),
  })

  const updateGroup = useMutation({
    mutationFn: async (payload: { id: string; name: string; description?: string }) => {
      const { id, ...rest } = payload
      await api<{ group: Group }>(`/api/groups/${id}`, jsonOptions('PATCH', rest))
    },
    onSuccess: () => {
      setFeedback({ type: 'success', message: t('success') })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
    onError: (err: Error) => setFeedback({ type: 'danger', message: err.message }),
  })

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      await api<{ ok: boolean }>(`/api/groups/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      setFeedback({ type: 'success', message: t('success') })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
    onError: (err: Error) => setFeedback({ type: 'danger', message: err.message }),
  })

  const handleDelete = (group: Group) => {
    if (!window.confirm(t('confirmDelete'))) return
    deleteGroup.mutate(group.id)
  }

  const handleEditSave = async (payload: { name: string; description?: string }) => {
    if (!editingGroup) return
    await updateGroup.mutateAsync({ id: editingGroup.id, ...payload })
  }

  const groups = data?.list ?? []

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton fallbackHref="/" />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <UsersRound className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      {feedback && (
        <Alert
          variant={feedback.type}
          description={feedback.message}
          closable
          onClose={() => setFeedback(null)}
        />
      )}

      {/* 创建区 */}
      <Card>
        <CardHeader className="p-4 pb-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4 text-primary" />
            {t('createGroup')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('groupName')}
            className="sm:max-w-xs"
            aria-label={t('groupName')}
          />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('description')}
            className="flex-1"
            aria-label={t('description')}
          />
          <Button
            onClick={() =>
              createGroup.mutate({
                name: name.trim(),
                description: description.trim() || undefined,
              })
            }
            disabled={!name.trim() || createGroup.isPending}
            className="shrink-0"
          >
            {createGroup.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-4 w-4" />
            )}
            {t('createGroup')}
          </Button>
        </CardContent>
      </Card>

      {/* 群组列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <Alert variant="danger" description={(error as Error).message} />
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
          <UsersRound className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{tc('empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onEdit={(g) => {
                setEditingGroup(g)
                setEditOpen(true)
              }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <EditGroupDialog
        group={editingGroup}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={handleEditSave}
      />
    </div>
  )
}
