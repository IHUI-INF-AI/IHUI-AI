// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D29 团队级知识引擎屏(mobile-rn 原生实现,对应 Web 端 /team-knowledge)。
 *
 * 平台说明:
 * - 消费 @ihui/api-client/endpoints/team-knowledge 的 listKnowledgeSpaces /
 *   createKnowledgeSpace / listKnowledgeSpaceMembers / listKnowledgeSpaceItems /
 *   createKnowledgeSpaceItem / setKnowledgeItemStatus,不跨端 import web 文件。
 * - 端点形态同 repo-wiki:失败即 throw,统一 try/catch 取 e.message,不读 res.error。
 * - 三层下钻:teamId → 知识空间 → (成员角色 + 知识条目);teamId 落 AsyncStorage 冷启回填。
 * - 写操作(发布/归档)走 appAlert 二次确认,与 Web 端 confirmDialog 口径一致。
 * - 条目正文按 Web ItemEditDialog 的形状提交:content = { text } 且同时给 plainText。
 * - 样式与 McpStoreScreen 一致:Tailwind className + resolvedTheme 暗色适配 + NavBar。
 */
import { useCallback, useEffect, useState } from 'react'
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { TextField } from '@ihui/rn-app'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { appAlert } from '../components/BottomPops'
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
  type TeamKnowledgeRole,
  type TeamKnowledgeStatus,
} from '@ihui/api-client/endpoints/team-knowledge'
import NavBar from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import { tokens } from '../theme/active-tokens'

const TEAM_ID_KEY = 'ihui:team-knowledge:teamId'
const KIND_FILTERS: Array<TeamKnowledgeKind | ''> = ['', 'memory', 'wiki', 'card']
/** 角色/类型/状态 → 文案:刻意用静态键分支而不用模板串拼键(死键扫描器只认静态 t('...')) */
function roleLabel(t: (k: string) => string, role: TeamKnowledgeRole): string {
  if (role === 'owner') return t('teamKnowledge.role.owner')
  if (role === 'editor') return t('teamKnowledge.role.editor')
  return t('teamKnowledge.role.viewer')
}

function kindLabel(t: (k: string) => string, kind: TeamKnowledgeKind): string {
  if (kind === 'wiki') return t('teamKnowledge.kind.wiki')
  if (kind === 'card') return t('teamKnowledge.kind.card')
  return t('teamKnowledge.kind.memory')
}

function statusLabel(t: (k: string) => string, status: TeamKnowledgeStatus): string {
  if (status === 'published') return t('teamKnowledge.status.published')
  if (status === 'archived') return t('teamKnowledge.status.archived')
  return t('teamKnowledge.status.draft')
}

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
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  // 新建空间 / 新建条目两组内联表单(各一个布尔开关,RN 侧不用 Dialog)
  const [spaceForm, setSpaceForm] = useState(false)
  const [spaceName, setSpaceName] = useState('')
  const [restricted, setRestricted] = useState(false)
  const [itemForm, setItemForm] = useState(false)
  const [itemTitle, setItemTitle] = useState('')
  const [itemText, setItemText] = useState('')
  const [saving, setSaving] = useState(false)

  const isDark = resolvedTheme === 'dark'
  const selected = spaces.find((s) => s.id === selectedId) ?? null

  useEffect(() => {
    void (async () => {
      const saved = await AsyncStorage.getItem(TEAM_ID_KEY)
      if (saved) setTeamId(saved)
    })()
  }, [])

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
      setError('')
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
        setRefreshing(false)
      }
    },
    [kind, loadItems, selectedId, t],
  )

  const onSearch = useCallback(() => {
    void AsyncStorage.setItem(TEAM_ID_KEY, teamId.trim()).catch(() => {})
    void load(teamId)
  }, [load, teamId])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load(teamId, true)
  }, [load, teamId])

  const onPickSpace = useCallback(
    (space: KnowledgeSpaceDTO) => {
      setSelectedId(space.id)
      void loadItems(space.id, kind)
    },
    [kind, loadItems],
  )

  const onPickKind = useCallback(
    (k: TeamKnowledgeKind | '') => {
      setKind(k)
      if (selectedId) void loadItems(selectedId, k)
    },
    [loadItems, selectedId],
  )

  const onCreateSpace = useCallback(() => {
    if (!teamId.trim()) {
      setError(t('teamKnowledge.needTeam'))
      return
    }
    if (!spaceName.trim()) {
      setError(t('teamKnowledge.needSpaceName'))
      return
    }
    setSaving(true)
    setError('')
    void (async () => {
      try {
        await createKnowledgeSpace({
          teamId: teamId.trim(),
          name: spaceName.trim(),
          visibility: restricted ? 'restricted' : 'team',
        })
        setSpaceForm(false)
        setSpaceName('')
        setRestricted(false)
        await load(teamId)
      } catch (e) {
        setError(e instanceof Error ? e.message : t('teamKnowledge.saveFailed'))
      } finally {
        setSaving(false)
      }
    })()
  }, [load, restricted, spaceName, t, teamId])

  const onCreateItem = useCallback(() => {
    if (!selected) return
    if (!itemTitle.trim()) {
      setError(t('teamKnowledge.needTitle'))
      return
    }
    setSaving(true)
    setError('')
    void (async () => {
      try {
        await createKnowledgeSpaceItem(selected.id, {
          kind: 'memory',
          title: itemTitle.trim(),
          content: { text: itemText },
          plainText: itemText,
          tags: [],
        })
        setItemForm(false)
        setItemTitle('')
        setItemText('')
        await loadItems(selected.id, kind)
      } catch (e) {
        setError(e instanceof Error ? e.message : t('teamKnowledge.saveFailed'))
      } finally {
        setSaving(false)
      }
    })()
  }, [itemText, itemTitle, kind, loadItems, selected, t])

  const onSetStatus = useCallback(
    (item: KnowledgeItemDTO, status: 'published' | 'archived') => {
      appAlert(
        t(status === 'published' ? 'teamKnowledge.publishBtn' : 'teamKnowledge.archiveBtn'),
        item.title,
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.confirm'),
            onPress: () => {
              setBusyId(item.id)
              void (async () => {
                try {
                  await setKnowledgeItemStatus(item.id, { status })
                  if (selected) await loadItems(selected.id, kind)
                } catch (e) {
                  appAlert(
                    t('common.failed'),
                    e instanceof Error ? e.message : t('teamKnowledge.saveFailed'),
                  )
                } finally {
                  setBusyId('')
                }
              })()
            },
          },
        ],
      )
    },
    [kind, loadItems, selected, t],
  )

  return (
    <View className={`flex-1 ${isDark ? 'bg-neutral-950' : 'bg-neutral-50'}`}>
      <NavChrome>
        <NavBar title={t('teamKnowledge.title')} />
      </NavChrome>

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="px-4 pt-1">
          <Text className="text-xs text-neutral-600 dark:text-neutral-400">
            {t('teamKnowledge.description')}
          </Text>
          <View className="mt-2 flex-row items-center">
            <TextField
              colorScheme={resolvedTheme}
              value={teamId}
              onChangeText={setTeamId}
              placeholder={t('teamKnowledge.teamPlaceholder')}
              placeholderTextColor={tokens.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
              className="mr-2 h-9 flex-1 rounded-sm border border-neutral-300 px-3 text-sm text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
            />
            <TouchableOpacity
              disabled={loading}
              onPress={onSearch}
              className="mr-2 rounded-sm bg-neutral-900 px-3 py-2 dark:bg-neutral-100"
            >
              <Text className="text-xs text-neutral-50 dark:text-neutral-900">
                {t('teamKnowledge.searchBtn')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSpaceForm((v) => !v)}
              className="rounded-sm border border-neutral-300 px-3 py-2 dark:border-neutral-700"
            >
              <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                {t('teamKnowledge.newSpaceBtn')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {spaceForm ? (
          <View className="mx-4 mt-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
            <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {t('teamKnowledge.newSpaceTitle')}
            </Text>
            <TextField
              colorScheme={resolvedTheme}
              value={spaceName}
              onChangeText={setSpaceName}
              placeholder={t('teamKnowledge.spaceNamePlaceholder')}
              placeholderTextColor={tokens.text.tertiary}
              className="mt-2 h-9 rounded-sm border border-neutral-300 px-3 text-sm text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
            />
            <View className="mt-2 flex-row items-center">
              {(['team', 'restricted'] as const).map((v) => {
                const active = v === 'restricted' ? restricted : !restricted
                return (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setRestricted(v === 'restricted')}
                    className={`mr-2 rounded-sm px-3 py-1.5 ${
                      active
                        ? 'bg-neutral-900 dark:bg-neutral-100'
                        : 'bg-neutral-200 dark:bg-neutral-800'
                    }`}
                  >
                    <Text
                      className={`text-xs ${active ? 'text-neutral-50 dark:text-neutral-900' : 'text-neutral-700 dark:text-neutral-300'}`}
                    >
                      {t(
                        v === 'restricted'
                          ? 'teamKnowledge.restricted'
                          : 'teamKnowledge.teamVisible',
                      )}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <View className="mt-3 flex-row items-center">
              <TouchableOpacity
                disabled={saving}
                onPress={onCreateSpace}
                className="mr-2 rounded-sm bg-neutral-900 px-3 py-1.5 dark:bg-neutral-100"
              >
                <Text className="text-xs text-neutral-50 dark:text-neutral-900">
                  {t('teamKnowledge.saveBtn')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSpaceForm(false)}
                className="rounded-sm border border-neutral-300 px-3 py-1.5 dark:border-neutral-700"
              >
                <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                  {t('teamKnowledge.cancelBtn')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {error ? (
          <View className="mt-3 px-4">
            <Text className="text-sm text-red-600 dark:text-red-400">{error}</Text>
          </View>
        ) : null}

        <View className="px-4 pt-4">
          <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {t('teamKnowledge.spaceListTitle')}
          </Text>
          {loading && spaces.length === 0 ? (
            <View className="items-center py-8">
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">{t('common.loading')}</Text>
            </View>
          ) : spaces.length === 0 ? (
            <View className="items-center py-8">
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">{t('teamKnowledge.emptySpaces')}</Text>
            </View>
          ) : (
            <View className="mt-2 flex-row flex-wrap">
              {spaces.map((space) => {
                const active = space.id === selectedId
                return (
                  <TouchableOpacity
                    key={space.id}
                    onPress={() => onPickSpace(space)}
                    className={`mb-2 mr-2 rounded-xl border px-3 py-2 ${
                      active
                        ? 'border-neutral-900 bg-white dark:border-neutral-100 dark:bg-neutral-900'
                        : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'
                    }`}
                  >
                    <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {space.name}
                    </Text>
                    <Text className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      {roleLabel(t, space.myRole)}
                      {' · '}
                      {t(
                        space.visibility === 'restricted'
                          ? 'teamKnowledge.restricted'
                          : 'teamKnowledge.teamVisible',
                      )}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </View>

        {selected ? (
          <View className="px-4 pt-2">
            <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {t('teamKnowledge.membersTitle')}
            </Text>
            {members.length === 0 ? (
              <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {t('teamKnowledge.emptyMembers')}
              </Text>
            ) : (
              <View className="mt-1 flex-row flex-wrap">
                {members.map((m) => (
                  <View
                    key={m.userId}
                    className="mb-2 mr-2 rounded-xs bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800"
                  >
                    <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                      {m.userId.slice(0, 8)} · {roleLabel(t, m.role)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View className="mt-3 flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {t('teamKnowledge.itemsTitle')}
              </Text>
              <TouchableOpacity onPress={() => setItemForm((v) => !v)}>
                <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                  {t('teamKnowledge.newItemBtn')}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="mt-2 flex-row flex-wrap">
              {KIND_FILTERS.map((k) => {
                const active = kind === k
                return (
                  <TouchableOpacity
                    key={k || 'all'}
                    onPress={() => onPickKind(k)}
                    className={`mb-2 mr-2 rounded-sm px-3 py-1.5 ${
                      active
                        ? 'bg-neutral-900 dark:bg-neutral-100'
                        : 'bg-neutral-200 dark:bg-neutral-800'
                    }`}
                  >
                    <Text
                      className={`text-xs ${active ? 'text-neutral-50 dark:text-neutral-900' : 'text-neutral-700 dark:text-neutral-300'}`}
                    >
                      {k ? kindLabel(t, k) : t('teamKnowledge.kindAll')}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {itemForm ? (
              <View className="mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
                <TextField
                  colorScheme={resolvedTheme}
                  value={itemTitle}
                  onChangeText={setItemTitle}
                  placeholder={t('teamKnowledge.titlePlaceholder')}
                  placeholderTextColor={tokens.text.tertiary}
                  className="h-9 rounded-sm border border-neutral-300 px-3 text-sm text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                />
                <TextField
                  colorScheme={resolvedTheme}
                  value={itemText}
                  onChangeText={setItemText}
                  placeholder={t('teamKnowledge.contentPlaceholder')}
                  placeholderTextColor={tokens.text.tertiary}
                  multiline
                  className="mt-2 min-h-[72px] rounded-sm border border-neutral-300 px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                />
                <View className="mt-3 flex-row items-center">
                  <TouchableOpacity
                    disabled={saving}
                    onPress={onCreateItem}
                    className="mr-2 rounded-sm bg-neutral-900 px-3 py-1.5 dark:bg-neutral-100"
                  >
                    <Text className="text-xs text-neutral-50 dark:text-neutral-900">
                      {t('teamKnowledge.saveBtn')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setItemForm(false)}
                    className="rounded-sm border border-neutral-300 px-3 py-1.5 dark:border-neutral-700"
                  >
                    <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                      {t('teamKnowledge.cancelBtn')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {items.length === 0 ? (
              <View className="items-center py-8">
                <Text className="text-sm text-neutral-500 dark:text-neutral-400">{t('teamKnowledge.emptyItems')}</Text>
              </View>
            ) : (
              items.map((item) => (
                <View
                  key={item.id}
                  className="mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <View className="flex-row items-center">
                    <Text className="flex-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {item.title}
                    </Text>
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400">{statusLabel(t, item.status)}</Text>
                  </View>
                  {item.plainText ? (
                    <Text
                      className="mt-1 text-xs text-neutral-600 dark:text-neutral-400"
                      numberOfLines={3}
                    >
                      {item.plainText}
                    </Text>
                  ) : null}
                  <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {kindLabel(t, item.kind)}
                    {' · '}v{item.revision}
                  </Text>
                  <View className="mt-3 flex-row items-center">
                    <TouchableOpacity
                      disabled={busyId === item.id || item.status === 'published'}
                      onPress={() => onSetStatus(item, 'published')}
                      className="mr-2 rounded-sm bg-neutral-900 px-3 py-1.5 dark:bg-neutral-100"
                    >
                      <Text className="text-xs text-neutral-50 dark:text-neutral-900">
                        {t('teamKnowledge.publishBtn')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={busyId === item.id || item.status === 'archived'}
                      onPress={() => onSetStatus(item, 'archived')}
                      className="rounded-sm border border-neutral-300 px-3 py-1.5 dark:border-neutral-700"
                    >
                      <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                        {t('teamKnowledge.archiveBtn')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        <View className="h-6" />
      </ScrollView>
    </View>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
