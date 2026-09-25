// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 空间成员与角色面板(G-35,2026-09-26)
 * owner 可授权/改角色/撤权(role=null);其余角色只读列表。
 * 权限判定在服务端,这里的致灰只是观感,不是安全边界。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, UserPlus } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { confirmDialog } from '@/components/feedback'
import { Input, Select } from '@/components/form'
import {
  listKnowledgeSpaceMembers,
  setKnowledgeSpaceMember,
  type KnowledgeSpaceDTO,
  type KnowledgeSpaceMemberDTO,
  type TeamKnowledgeRole,
} from '@ihui/api-client'

const ROLES: TeamKnowledgeRole[] = ['viewer', 'editor', 'owner']

export function SpaceMembersPanel({ space }: { space: KnowledgeSpaceDTO }) {
  const t = useTranslations('teamKnowledge')

  const [members, setMembers] = React.useState<KnowledgeSpaceMemberDTO[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [userId, setUserId] = React.useState('')
  const [role, setRole] = React.useState<TeamKnowledgeRole>('viewer')
  const [busy, setBusy] = React.useState(false)

  const canManage = space.myRole === 'owner'

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setMembers(await listKnowledgeSpaceMembers(space.id))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [space.id])

  React.useEffect(() => {
    void load()
  }, [load])

  const grant = async () => {
    if (!userId.trim()) {
      setError(t('needUserId'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await setKnowledgeSpaceMember(space.id, { userId: userId.trim(), role })
      setUserId('')
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (member: KnowledgeSpaceMemberDTO) => {
    const ok = await confirmDialog({ title: t('revokeConfirm'), variant: 'danger' })
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      await setKnowledgeSpaceMember(space.id, { userId: member.userId, role: null })
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <CardTitle className="text-sm">{t('membersTitle')}</CardTitle>
        {loading && <Loader2 className="size-4 animate-spin" />}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-64"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder={t('userIdPlaceholder')}
              aria-label={t('userIdLabel')}
            />
            <Select
              options={ROLES.map((r) => ({ value: r, label: t(`role.${r}`) }))}
              value={role}
              onChange={(v) => setRole(String(v) as TeamKnowledgeRole)}
              aria-label={t('roleLabel')}
            />
            <Button size="sm" onClick={grant} disabled={busy}>
              <UserPlus className="size-4" />
              <span>{t('grantBtn')}</span>
            </Button>
          </div>
        )}
        {members.length === 0 && !loading ? (
          <div className="text-muted-foreground text-sm">{t('emptyMembers')}</div>
        ) : (
          <div className="flex flex-col gap-1">
            {members.map((m) => (
              <div key={m.userId} className="bg-muted/40 flex items-center gap-2 rounded px-3 py-2">
                <span className="flex-1 truncate text-xs font-mono">{m.userId}</span>
                <span className="bg-background rounded px-2 py-0.5 text-xs">
                  {t(`role.${m.role}`)}
                </span>
                {canManage && (
                  <Button size="xs" variant="outline" onClick={() => revoke(m)} disabled={busy}>
                    <span>{t('revokeBtn')}</span>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
