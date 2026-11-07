// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D29 团队级知识引擎屏(mobile-rn 宿主)。
 *
 * 与 web `/team-knowledge` 共用 `@ihui/rn-app/features/team-knowledge/TeamKnowledgeScreen`
 * 的同一份渲染(react-native-web 承载)。本壳只保留:
 * - 数据编排(list / items / members / create / status)与 AsyncStorage 团队 ID 回填;
 * - 平台件(NavBar / NavChrome / appAlert);
 * - DTO → 共享屏 view 的字段映射。
 * 输入、空间列表、默认成员/条目面板、新建表单、发布/归档确认全部由共享屏渲染。
 *
 * 端点形态:失败即 throw,统一 try/catch 取 e.message,不读 res.error。
 */
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createKnowledgeSpace,
  createKnowledgeSpaceItem,
  listKnowledgeSpaceItems,
  listKnowledgeSpaceMembers,
  listKnowledgeSpaces,
  setKnowledgeItemStatus,
  type KnowledgeItemDTO,
  type KnowledgeSpaceDTO,
  type KnowledgeSpaceMemberDTO,
  type TeamKnowledgeKind,
} from '@ihui/api-client/endpoints/team-knowledge'
import { TeamKnowledgeScreen as SharedTeamKnowledgeScreen } from '@ihui/rn-app'
import type {
  TeamKnowledgeConfirmOptions,
  TeamKnowledgeCreateItemValues,
  TeamKnowledgeCreateSpaceValues,
  TeamKnowledgeItemView,
} from '@ihui/rn-app/features/team-knowledge/TeamKnowledgeScreen'
import NavBar from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'

const TEAM_ID_KEY = 'ihui:team-knowledge:teamId'

export function TeamKnowledgeScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()

  const [teamId, setTeamId] = useState('')
  const [spaces, setSpaces] = useState<KnowledgeSpaceDTO[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [members, setMembers] = useState<KnowledgeSpaceMemberDTO[]>([])
  const [items, setItems] = useState<KnowledgeItemDTO[]>([])
  const [kind, setKind] = useState<TeamKnowledgeKind | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const saved = await AsyncStorage.getItem(TEAM_ID_KEY)
      if (saved) setTeamId(saved)
    })()
  }, [])

  const selected = spaces.find((space) => space.id === selectedId) ?? null

  const loadItems = useCallback(
    async (spaceId: string, k: TeamKnowledgeKind | '') => {
      try {
        const [rows, memberRows] = await Promise.all([
          listKnowledgeSpaceItems(spaceId, k ? { kind: k } : {}),
          listKnowledgeSpaceMembers(spaceId),
        ])
        setItems(rows)
        setMembers(memberRows)
      } catch (e) {
        setError(e instanceof Error ? e.message : t('common.loadFailed'))
        setItems([])
        setMembers([])
      }
    },
    [t],
  )

  const load = useCallback(
    async (team: string, silent = false) => {
      if (!team.trim()) {
        setError(t('teamKnowledge.needTeam'))
        return
      }
      setError(null)
      if (!silent) setLoading(true)
      try {
        const rows = await listKnowledgeSpaces({ teamId: team.trim() })
        setSpaces(rows)
        const nextId =
          selectedId && rows.some((s) => s.id === selectedId) ? selectedId : (rows[0]?.id ?? '')
        setSelectedId(nextId)
        if (nextId) await loadItems(nextId, kind)
        else {
          setItems([])
          setMembers([])
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t('common.loadFailed'))
        setSpaces([])
        setItems([])
        setMembers([])
      } finally {
        setLoading(false)
      }
    },
    [kind, loadItems, selectedId, t],
  )

  const handleSearch = useCallback(async () => {
    void AsyncStorage.setItem(TEAM_ID_KEY, teamId.trim()).catch(() => {})
    await load(teamId)
  }, [load, teamId])

  const handleRefresh = useCallback(async () => {
    await load(teamId, true)
  }, [load, teamId])

  const handleSelectSpace = useCallback(
    (id: string) => {
      setSelectedId(id)
      void loadItems(id, kind)
    },
    [kind, loadItems],
  )

  const handleSelectKind = useCallback(
    (k: TeamKnowledgeKind | '') => {
      setKind(k)
      if (selectedId) void loadItems(selectedId, k)
    },
    [loadItems, selectedId],
  )

  const handleCreateSpace = useCallback(
    async (values: TeamKnowledgeCreateSpaceValues) => {
      await createKnowledgeSpace({
        teamId: teamId.trim(),
        name: values.name,
        visibility: values.visibility,
      })
      await load(teamId)
    },
    [load, teamId],
  )

  const handleCreateItem = useCallback(
    async (values: TeamKnowledgeCreateItemValues) => {
      if (!selected) return
      await createKnowledgeSpaceItem(selected.id, {
        kind: 'memory',
        title: values.title,
        content: { text: values.text },
        plainText: values.text,
        tags: [],
      })
      await loadItems(selected.id, kind)
    },
    [kind, loadItems, selected],
  )

  const handleSetStatus = useCallback(
    async (item: TeamKnowledgeItemView, status: 'published' | 'archived') => {
      await setKnowledgeItemStatus(item.id, { status })
      if (selected) await loadItems(selected.id, kind)
    },
    [kind, loadItems, selected],
  )

  const handleConfirm = (options: TeamKnowledgeConfirmOptions) =>
    new Promise<boolean>((resolve) => {
      appAlert(options.title, options.message, [
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        {
          text: t('common.confirm'),
          style: options.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ])
    })

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('teamKnowledge.title')} />
      </NavChrome>
      <SharedTeamKnowledgeScreen
        t={t}
        colorScheme={resolvedTheme}
        teamId={teamId}
        onChangeTeamId={setTeamId}
        spaces={spaces.map((space) => ({
          id: space.id,
          name: space.name,
          myRole: space.myRole,
          visibility: space.visibility,
        }))}
        selectedSpaceId={selectedId}
        onSelectSpace={handleSelectSpace}
        members={members.map((member) => ({ userId: member.userId, role: member.role }))}
        items={items.map((item) => ({
          id: item.id,
          kind: item.kind,
          title: item.title,
          plainText: item.plainText,
          status: item.status,
          revision: item.revision,
          tags: item.tags,
        }))}
        kind={kind}
        onSelectKind={handleSelectKind}
        loading={loading}
        error={error}
        onSearch={handleSearch}
        onRefresh={handleRefresh}
        onCreateSpace={handleCreateSpace}
        onCreateItem={handleCreateItem}
        onSetItemStatus={handleSetStatus}
        onConfirm={handleConfirm}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
