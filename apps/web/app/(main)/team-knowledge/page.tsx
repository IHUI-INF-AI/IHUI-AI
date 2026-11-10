// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * D29 团队级知识引擎页(G-35,2026-09-26 新增)
 *
 * 与 RN `apps/mobile-rn/src/screens/TeamKnowledgeScreen.tsx` 共用同一份渲染
 * (`@ihui/rn-app/features/team-knowledge/TeamKnowledgeScreen`,react-native-web 承载)。
 * 本页只保留 web 侧独有的富交互子组件(成员授权/撤权、条目筛选/编辑/版本历史)
 * 与平台件(localStorage 团队 ID 回填);输入、空间列表、默认面板、新建表单、
 * 发布/归档确认均由共享屏渲染。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import type { TFunction } from '@ihui/types'
import {
  createKnowledgeSpace,
  listKnowledgeSpaces,
  type KnowledgeSpaceDTO,
} from '@ihui/api-client'
import {
  TeamKnowledgeScreen as SharedTeamKnowledgeScreen,
  type TeamKnowledgeCreateSpaceValues,
} from '@ihui/rn-app/features/team-knowledge/TeamKnowledgeScreen'
import { SpaceMembersPanel } from './_components/SpaceMembersPanel'
import { KnowledgeItemList } from './_components/KnowledgeItemList'

const TEAM_STORAGE_KEY = 'ihui:team-knowledge:teamId'

export default function TeamKnowledgePage() {
  const t = useTranslations()

  const [teamId, setTeamId] = React.useState('')
  const [spaces, setSpaces] = React.useState<KnowledgeSpaceDTO[]>([])
  const [selectedId, setSelectedId] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

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
        prev && data.some((s) => s.id === prev) ? prev : (data[0]?.id ?? ''),
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

  const handleCreateSpace = async (values: TeamKnowledgeCreateSpaceValues) => {
    const created = await createKnowledgeSpace({
      teamId: teamId.trim(),
      name: values.name,
      visibility: values.visibility,
    })
    await load(teamId)
    setSelectedId(created.id)
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4">
      <h1 className="text-lg font-semibold">{t('teamKnowledge.title')}</h1>

      <SharedTeamKnowledgeScreen
        t={t as unknown as TFunction}
        colorScheme="light"
        teamId={teamId}
        onChangeTeamId={handleTeamChange}
        spaces={spaces.map((space) => ({
          id: space.id,
          name: space.name,
          myRole: space.myRole,
          visibility: space.visibility,
        }))}
        selectedSpaceId={selectedId}
        onSelectSpace={setSelectedId}
        loading={loading}
        error={error}
        onSearch={() => load(teamId)}
        onCreateSpace={handleCreateSpace}
        renderMembers={(spaceId) => {
          const space = spaces.find((s) => s.id === spaceId)
          return space ? <SpaceMembersPanel key={`members-${spaceId}`} space={space} /> : null
        }}
        renderItems={(spaceId) => {
          const space = spaces.find((s) => s.id === spaceId)
          return space ? <KnowledgeItemList key={`items-${spaceId}`} space={space} /> : null
        }}
      />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
