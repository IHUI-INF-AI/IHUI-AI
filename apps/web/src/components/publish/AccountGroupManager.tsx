'use client'

/**
 * 账号分组管理组件(2026-08-01 新增)。
 *
 * 功能:
 * - 列出所有分组(含成员数)
 * - 创建 / 编辑 / 删除分组
 * - 添加账号到分组(从账号列表勾选)
 * - 从分组移除账号
 * - 查看 分组成员列表
 *
 * AGENTS.md §4:rounded-lg / 无分割线 / subtle 配色 / 禁渐变遮罩
 * AGENTS.md §3:禁 any,精确类型
 */

import * as React from 'react'
import { Plus, Pencil, Trash2, Loader2, Users, ChevronRight, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Button, Card, CardContent, Input, Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import {
  listPublishGroups, createPublishGroup, updatePublishGroup, deletePublishGroup,
  addToPublishGroup, removeFromPublishGroup, listPublishGroupMembers,
  type PublishAccountGroup,
} from '@ihui/api-client'
import { useToast } from '@/hooks/use-toast'
import type { PublishAccount } from '@/hooks/use-publish-accounts'

export interface AccountGroupManagerProps {
  readonly accounts: readonly PublishAccount[]
  readonly onGroupsChanged?: () => void
}

interface GroupWithMembers extends PublishAccountGroup {
  memberCount: number
}

export function AccountGroupManager({ accounts, onGroupsChanged }: AccountGroupManagerProps) {
  const t = useTranslations('publish')
  const tCommon = useTranslations('common')
  const toast = useToast()
  const [groups, setGroups] = React.useState<GroupWithMembers[]>([])
  const [loading, setLoading] = React.useState(true)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [memberIds, setMemberIds] = React.useState<number[]>([])
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<PublishAccountGroup | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<PublishAccountGroup | null>(null)
  const [addAccountsOpen, setAddAccountsOpen] = React.useState<string | null>(null)
  const [selectedAccountIds, setSelectedAccountIds] = React.useState<Set<number>>(new Set())
  const [formName, setFormName] = React.useState('')
  const [formDesc, setFormDesc] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  const loadGroups = React.useCallback(async () => {
    setLoading(true)
    try {
      const r = await listPublishGroups()
      if (r.success && r.data) {
        const withCounts = r.data.items.map((g) => ({
          ...g,
          memberCount: g.account_ids.length,
        }))
        setGroups(withCounts)
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => { void loadGroups() }, [loadGroups])

  async function toggleExpand(groupId: string) {
    if (expandedId === groupId) {
      setExpandedId(null)
      setMemberIds([])
      return
    }
    setExpandedId(groupId)
    try {
      const r = await listPublishGroupMembers(groupId)
      if (r.success && r.data) {
        setMemberIds(r.data.account_ids)
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  function openCreate() {
    setFormName('')
    setFormDesc('')
    setEditTarget(null)
    setCreateOpen(true)
  }

  function openEdit(g: PublishAccountGroup) {
    setFormName(g.name)
    setFormDesc(g.description)
    setEditTarget(g)
    setCreateOpen(true)
  }

  async function submitGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) return
    setSaving(true)
    try {
      if (editTarget) {
        const r = await updatePublishGroup(editTarget.group_id, { name: formName, description: formDesc })
        if (r.success) {
          toast.success(t('groups.updated'))
          await loadGroups()
          setCreateOpen(false)
        } else {
          toast.error(r.error || t('groups.updateFailed'))
        }
      } else {
        const r = await createPublishGroup({ name: formName, description: formDesc })
        if (r.success) {
          toast.success(t('groups.created'))
          await loadGroups()
          setCreateOpen(false)
          onGroupsChanged?.()
        } else {
          toast.error(r.error || t('groups.createFailed'))
        }
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      const r = await deletePublishGroup(deleteTarget.group_id)
      if (r.success) {
        toast.success(t('groups.deleted'))
        await loadGroups()
        onGroupsChanged?.()
      } else {
        toast.error(r.error || t('groups.deleteFailed'))
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setDeleteTarget(null)
    }
  }

  function openAddAccounts(groupId: string) {
    setAddAccountsOpen(groupId)
    setSelectedAccountIds(new Set())
  }

  async function submitAddAccounts() {
    if (!addAccountsOpen || selectedAccountIds.size === 0) return
    try {
      const r = await addToPublishGroup(addAccountsOpen, Array.from(selectedAccountIds))
      if (r.success) {
        toast.success(t('groups.accountsAdded', { count: r.data?.added ?? 0 }))
        await loadGroups()
        if (expandedId === addAccountsOpen) {
          const mr = await listPublishGroupMembers(addAccountsOpen)
          if (mr.success && mr.data) setMemberIds(mr.data.account_ids)
        }
        setAddAccountsOpen(null)
        onGroupsChanged?.()
      } else {
        toast.error(r.error || t('groups.addFailed'))
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function removeMember(accountId: number) {
    if (!expandedId) return
    try {
      const r = await removeFromPublishGroup(expandedId, [accountId])
      if (r.success) {
        toast.success(t('groups.accountRemoved'))
        setMemberIds((prev) => prev.filter((id) => id !== accountId))
        await loadGroups()
        onGroupsChanged?.()
      } else {
        toast.error(r.error || t('groups.removeFailed'))
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const availableAccounts = React.useMemo(() => {
    if (!addAccountsOpen) return []
    const inGroup = new Set(memberIds)
    return accounts.filter((a) => !inGroup.has(a.id))
  }, [addAccountsOpen, accounts, memberIds])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{t('groups.title')}</h3>
          {groups.length > 0 && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{groups.length}</span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />{t('groups.create')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-xs text-muted-foreground">{t('groups.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <Card key={g.group_id} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="flex flex-1 items-center gap-2 text-left"
                    onClick={() => toggleExpand(g.group_id)}
                  >
                    <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', expandedId === g.group_id && 'rotate-90')} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{g.name}</div>
                      {g.description && (
                        <div className="truncate text-xs text-muted-foreground">{g.description}</div>
                      )}
                    </div>
                    <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                      {g.memberCount}
                    </span>
                  </button>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => openAddAccounts(g.group_id)}>
                      <Plus className="h-3 w-3" />{t('groups.addAccount')}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => openEdit(g)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteTarget(g)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {expandedId === g.group_id && (
                  <div className="mt-2 space-y-1 pl-6">
                    {memberIds.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t('groups.noMembers')}</p>
                    ) : (
                      memberIds.map((aid) => {
                        const acc = accounts.find((a) => a.id === aid)
                        return (
                          <div key={aid} className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2 py-1">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary">
                                {(acc?.platform ?? '?').charAt(0).toUpperCase()}
                              </div>
                              <span className="truncate text-xs">{acc?.displayName ?? `#${aid}`}</span>
                              <span className="shrink-0 text-[10px] text-muted-foreground">{acc?.platform ?? ''}</span>
                            </div>
                            <button
                              type="button"
                              className="inline-flex h-9 w-9 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-destructive"
                              onClick={() => removeMember(aid)}
                              aria-label={t('groups.removeAccount')}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 创建/编辑分组 */}
      <Dialog open={createOpen} onOpenChange={(o) => !saving && setCreateOpen(o)}>
        <DialogContent className="min-[640px]:max-w-sm">
          <form onSubmit={submitGroup} className="space-y-3">
            <DialogHeader>
              <DialogTitle>{editTarget ? t('groups.edit') : t('groups.create')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-1">
              <Label className="text-xs">{t('groups.name')}</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} required className="h-8 text-xs" placeholder={t('groups.namePlaceholder')} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('groups.description')}</Label>
              <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="h-8 text-xs" placeholder={t('groups.descPlaceholder')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>{tCommon('cancel')}</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editTarget ? tCommon('save') : tCommon('create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="min-[640px]:max-w-sm">
          <DialogHeader><DialogTitle>{t('groups.delete')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t('groups.deleteConfirm', { name: deleteTarget?.name ?? '' })}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{tCommon('cancel')}</Button>
            <Button variant="destructive" onClick={confirmDelete}>{tCommon('confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加账号到分组 */}
      <Dialog open={!!addAccountsOpen} onOpenChange={(o) => !o && setAddAccountsOpen(null)}>
        <DialogContent className="min-[640px]:max-w-md">
          <DialogHeader><DialogTitle>{t('groups.addAccountTitle')}</DialogTitle></DialogHeader>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {availableAccounts.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">{t('groups.noAvailableAccounts')}</p>
            ) : (
              availableAccounts.map((a) => {
                const checked = selectedAccountIds.has(a.id)
                return (
                  <label
                    key={a.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent',
                      checked && 'bg-accent',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedAccountIds((prev) => {
                          const next = new Set(prev)
                          if (e.target.checked) next.add(a.id)
                          else next.delete(a.id)
                          return next
                        })
                      }}
                      className="h-3.5 w-3.5"
                    />
                    <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary">
                      {a.platform.charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 truncate text-xs">{a.displayName}</span>
                    <span className="text-[10px] text-muted-foreground">{a.platform}</span>
                  </label>
                )
              })
            )}
          </div>
          <DialogFooter className="gap-2 min-[640px]:flex-nowrap">
            <Button variant="outline" onClick={() => setAddAccountsOpen(null)} className="shrink-0">
              <span className="whitespace-nowrap">{tCommon('cancel')}</span>
            </Button>
            <Button onClick={submitAddAccounts} disabled={selectedAccountIds.size === 0} className="shrink-0 min-w-0">
              <span className="min-w-0 flex-1 truncate">{t('groups.addSelected', { count: selectedAccountIds.size })}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
