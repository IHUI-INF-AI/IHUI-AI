// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * D29 团队级知识引擎页(G-35,2026-09-26 新增)
 *
 * 空间列表(teamId 隔离)→ 选中空间后展示成员角色面板 + 条目列表与修订历史。
 * 全部调用经 @ihui/api-client 的 team-knowledge 端点(§3 禁止端内直连后端)。
 * 组件拆分保持单文件 <250 行(§4)。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { BookOpen, Library, Loader2, Plus, Users } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { Input, Select } from '@/components/form'
import { createKnowledgeSpace, listKnowledgeSpaces, type KnowledgeSpaceDTO } from '@ihui/api-client'
import { SpaceMembersPanel } from './_components/SpaceMembersPanel'
import { KnowledgeItemList } from './_components/KnowledgeItemList'

const TEAM_STORAGE_KEY = 'ihui:team-knowledge:teamId'

export default function TeamKnowledgePage() {
  const t = useTranslations('teamKnowledge')

  const [teamId, setTeamId] = React.useState('')
  const [spaces, setSpaces] = React.useState<KnowledgeSpaceDTO[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [createOpen, setCreateOpen] = React.useState(false)
  const [createName, setCreateName] = React.useState('')
  const [createVisibility, setCreateVisibility] = React.useState('team')
  const [creating, setCreating] = React.useState(false)

  React.useEffect(() => {
    const saved = window.localStorage.getItem(TEAM_STORAGE_KEY)
    if (saved) setTeamId(saved)
  }, [])

  const load = React.useCallback(async (team: string) => {
    if (!team.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await listKnowledgeSpaces({ teamId: team.trim() })
      setSpaces(data)
      setSelectedId((prev) =>
        prev && data.some((s) => s.id === prev) ? prev : (data[0]?.id ?? null),
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleTeamChange = (value: string) => {
    setTeamId(value)
    window.localStorage.setItem(TEAM_STORAGE_KEY, value)
  }

  const handleCreateSpace = async () => {
    if (!createName.trim()) {
      setError(t('needSpaceName'))
      return
    }
    setCreating(true)
    setError(null)
    try {
      const created = await createKnowledgeSpace({
        teamId: teamId.trim(),
        name: createName.trim(),
        visibility: createVisibility === 'restricted' ? 'restricted' : 'team',
      })
      setCreateOpen(false)
      setCreateName('')
      await load(teamId)
      setSelectedId(created.id)
    } catch (e) {
      setError(`${t('saveFailed')}:${(e as Error).message}`)
    } finally {
      setCreating(false)
    }
  }

  const selected = spaces.find((s) => s.id === selectedId) ?? null

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4">
      <div>
        <h1 className="text-lg font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">{t('description')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="w-56"
          value={teamId}
          onChange={(e) => handleTeamChange(e.target.value)}
          placeholder={t('teamPlaceholder')}
          aria-label={t('teamLabel')}
        />
        <Button variant="outline" onClick={() => load(teamId)} disabled={!teamId.trim() || loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <BookOpen className="size-4" />}
          <span>{t('searchBtn')}</span>
        </Button>
        <Button className="ml-auto" onClick={() => setCreateOpen(true)} disabled={!teamId.trim()}>
          <Plus className="size-4" />
          <span>{t('newSpaceBtn')}</span>
        </Button>
      </div>

      {error && <Alert variant="danger" description={error} className="items-start" />}

      {!teamId.trim() && (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Users className="size-4" />
          <span>{t('needTeam')}</span>
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium">{t('spaceListTitle')}</h2>
        {spaces.length === 0 && teamId.trim() && !loading ? (
          <div className="text-muted-foreground mt-2 text-sm">{t('emptySpaces')}</div>
        ) : (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {spaces.map((space) => (
              <Card key={space.id} className={space.id === selectedId ? 'border-cta' : undefined}>
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setSelectedId(space.id)}
                >
                  <CardContent className="flex flex-col gap-1 p-3">
                    <div className="flex items-center gap-2">
                      <Library className="text-muted-foreground size-4" />
                      <span className="flex-1 truncate text-sm font-medium">{space.name}</span>
                      <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">
                        {t(`role.${space.myRole}`)}
                      </span>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                      <span>
                        {space.visibility === 'restricted' ? t('restricted') : t('teamVisible')}
                      </span>
                    </div>
                  </CardContent>
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>

      {selected && <SpaceMembersPanel key={`members-${selected.id}`} space={selected} />}
      {selected && <KnowledgeItemList key={`items-${selected.id}`} space={selected} />}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">{t('newSpaceTitle')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 p-3">
            <Input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder={t('spaceNamePlaceholder')}
              aria-label={t('spaceNameLabel')}
            />
            <Select
              options={[
                { value: 'team', label: t('teamVisible') },
                { value: 'restricted', label: t('restricted') },
              ]}
              value={createVisibility}
              onChange={(v) => setCreateVisibility(String(v))}
              aria-label={t('visibilityLabel')}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                <span>{t('cancelBtn')}</span>
              </Button>
              <Button onClick={handleCreateSpace} disabled={creating}>
                {creating && <Loader2 className="size-4 animate-spin" />}
                <span>{t('saveBtn')}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
