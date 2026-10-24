// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 团队共享记忆屏(mobile-rn 原生实现,对应 Web 端 /team-memory)。
 *
 * 平台说明:
 * - 消费 @ihui/api-client/endpoints/team-memory 的 listTeamMemories /
 *   createTeamMemory / updateTeamMemory / deleteTeamMemory,不跨端 import web 文件。
 * - 端点形态同 repo-wiki:失败即 throw,统一 try/catch 取 e.message,不读 res.error。
 * - 按 scopeId(teamId 或 workspaceKey)隔离;scopeId 落 AsyncStorage 冷启回填,
 *   关键词与类型过滤不落盘(与 Web 端 localStorage 只存 scope 的口径一致)。
 * - 新建/编辑用内联表单(RN 侧无 Dialog),删除走 appAlert 二次确认。
 * - 样式与 McpStoreScreen 一致:Tailwind className + resolvedTheme 暗色适配 + NavBar。
 */
import { useCallback, useEffect, useState } from 'react'
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { TextField } from '@ihui/rn-app'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { appAlert } from '../components/BottomPops'
import {
  createTeamMemory,
  deleteTeamMemory,
  listTeamMemories,
  updateTeamMemory,
  type TeamMemoryDTO,
  type TeamMemoryKind,
} from '@ihui/api-client/endpoints/team-memory'
import NavBar from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import { tokens } from '../theme/active-tokens'

const SCOPE_KEY = 'ihui:team-memory:scopeId'
const KINDS: TeamMemoryKind[] = ['decision', 'convention', 'pitfall', 'fingerprint']
/** 类型 → 文案:刻意用静态键分支而不用模板串拼键(死键扫描器只认静态 t('...')) */
function kindLabel(t: (k: string) => string, kind: TeamMemoryKind): string {
  if (kind === 'convention') return t('teamMemory.kind.convention')
  if (kind === 'pitfall') return t('teamMemory.kind.pitfall')
  if (kind === 'fingerprint') return t('teamMemory.kind.fingerprint')
  return t('teamMemory.kind.decision')
}

interface EditState {
  id: string | null
  kind: TeamMemoryKind
  title: string
  content: string
  tags: string
}

const EMPTY_EDIT: EditState = { id: null, kind: 'decision', title: '', content: '', tags: '' }

export function TeamMemoryScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [scopeId, setScopeId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [kind, setKind] = useState<TeamMemoryKind | ''>('')
  const [rows, setRows] = useState<TeamMemoryDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')

  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    void (async () => {
      const saved = await AsyncStorage.getItem(SCOPE_KEY)
      if (saved) setScopeId(saved)
    })()
  }, [])

  const load = useCallback(
    async (scope: string, k: TeamMemoryKind | '', kw: string, silent = false) => {
      if (!scope.trim()) {
        setError(t('teamMemory.needScope'))
        return
      }
      setError('')
      if (!silent) setLoading(true)
      try {
        setRows(
          await listTeamMemories({
            scopeId: scope.trim(),
            kind: k || undefined,
            keyword: kw.trim() || undefined,
          }),
        )
      } catch (e) {
        setError(e instanceof Error ? e.message : t('common.loadFailed'))
        setRows([])
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [t],
  )

  const onSearch = useCallback(() => {
    void AsyncStorage.setItem(SCOPE_KEY, scopeId.trim()).catch(() => {})
    void load(scopeId, kind, keyword)
  }, [keyword, kind, load, scopeId])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load(scopeId, kind, keyword, true)
  }, [keyword, kind, load, scopeId])

  const onPickKind = useCallback(
    (k: TeamMemoryKind | '') => {
      setKind(k)
      if (scopeId.trim()) void load(scopeId, k, keyword, true)
    },
    [keyword, load, scopeId],
  )

  const startCreate = useCallback(() => {
    if (!scopeId.trim()) {
      setError(t('teamMemory.needScope'))
      return
    }
    setError('')
    setEditing({ ...EMPTY_EDIT })
  }, [scopeId, t])

  const startEdit = useCallback((row: TeamMemoryDTO) => {
    setError('')
    setEditing({
      id: row.id,
      kind: row.kind,
      title: row.title,
      content: row.content,
      tags: row.tags.join(', '),
    })
  }, [])

  const onSave = useCallback(() => {
    if (!editing) return
    if (!editing.title.trim()) {
      setError(t('teamMemory.needTitle'))
      return
    }
    if (!editing.content.trim()) {
      setError(t('teamMemory.needContent'))
      return
    }
    const tags = editing.tags
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
    setSaving(true)
    setError('')
    void (async () => {
      try {
        if (editing.id) {
          await updateTeamMemory(editing.id, {
            kind: editing.kind,
            title: editing.title.trim(),
            content: editing.content.trim(),
            tags,
          })
        } else {
          await createTeamMemory({
            scopeId: scopeId.trim(),
            kind: editing.kind,
            title: editing.title.trim(),
            content: editing.content.trim(),
            tags,
          })
        }
        setEditing(null)
        await load(scopeId, kind, keyword)
      } catch (e) {
        setError(e instanceof Error ? e.message : t('teamMemory.saveFailed'))
      } finally {
        setSaving(false)
      }
    })()
  }, [editing, keyword, kind, load, scopeId, t])

  const onDelete = useCallback(
    (row: TeamMemoryDTO) => {
      appAlert(t('teamMemory.deleteConfirm'), row.title, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => {
            setBusyId(row.id)
            void (async () => {
              try {
                await deleteTeamMemory(row.id)
                await load(scopeId, kind, keyword)
              } catch (e) {
                appAlert(
                  t('common.failed'),
                  e instanceof Error ? e.message : t('teamMemory.saveFailed'),
                )
              } finally {
                setBusyId('')
              }
            })()
          },
        },
      ])
    },
    [keyword, kind, load, scopeId, t],
  )

  return (
    <View className={`flex-1 ${isDark ? 'bg-neutral-950' : 'bg-neutral-50'}`}>
      <NavChrome>
        <NavBar title={t('teamMemory.title')} />
      </NavChrome>

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="px-4 pt-1">
          <Text className="text-xs text-neutral-600 dark:text-neutral-400">
            {t('teamMemory.description')}
          </Text>
          <TextField
            colorScheme={resolvedTheme}
            value={scopeId}
            onChangeText={setScopeId}
            placeholder={t('teamMemory.scopePlaceholder')}
            placeholderTextColor={tokens.text.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            className="mt-2 h-9 rounded-sm border border-neutral-300 px-3 text-sm text-neutral-900 dark:border-neutral-700 dark:text-neutral-100 min-h-[44px]"
          />
          <View className="mt-2 flex-row items-center">
            <TextField
              colorScheme={resolvedTheme}
              value={keyword}
              onChangeText={setKeyword}
              placeholder={t('teamMemory.searchPlaceholder')}
              placeholderTextColor={tokens.text.tertiary}
              className="mr-2 h-9 flex-1 rounded-sm border border-neutral-300 px-3 text-sm text-neutral-900 dark:border-neutral-700 dark:text-neutral-100 min-h-[44px]"
            />
            <TouchableOpacity
              disabled={loading}
              onPress={onSearch}
              className="rounded-sm bg-neutral-900 px-3 py-2 dark:bg-neutral-100 min-h-[44px]"
            >
              <Text className="text-xs text-neutral-50 dark:text-neutral-900">
                {t('teamMemory.searchBtn')}
              </Text>
            </TouchableOpacity>
          </View>
          <View className="mt-2 flex-row flex-wrap">
            {(['', ...KINDS] as const).map((k) => {
              const active = kind === k
              return (
                <TouchableOpacity
                  key={k || 'all'}
                  onPress={() => onPickKind(k)}
                  className={`mb-2 mr-2 rounded-sm px-3 py-1.5 min-h-[44px] ${
                    active
                      ? 'bg-neutral-900 dark:bg-neutral-100'
                      : 'bg-neutral-200 dark:bg-neutral-800'
                  }`}
                >
                  <Text
                    className={`text-xs ${active ? 'text-neutral-50 dark:text-neutral-900' : 'text-neutral-700 dark:text-neutral-300'}`}
                  >
                    {k ? kindLabel(t, k) : t('teamMemory.kindAll')}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {error ? (
          <View className="mt-1 px-4">
            <Text className="text-sm text-red-600 dark:text-red-400">{error}</Text>
          </View>
        ) : null}

        <View className="flex-row items-center justify-between px-4 pt-2">
          <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {t('teamMemory.listTitle')}
          </Text>
          <TouchableOpacity onPress={startCreate} disabled={saving}>
            <Text className="text-xs text-neutral-700 dark:text-neutral-300">
              {t('teamMemory.newBtn')}
            </Text>
          </TouchableOpacity>
        </View>

        {editing ? (
          <View className="mx-4 mt-2 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
            <TextField
              colorScheme={resolvedTheme}
              value={editing.title}
              onChangeText={(v) => setEditing((prev) => (prev ? { ...prev, title: v } : prev))}
              placeholder={t('teamMemory.titlePlaceholder')}
              placeholderTextColor={tokens.text.tertiary}
              className="h-9 rounded-sm border border-neutral-300 px-3 text-sm text-neutral-900 dark:border-neutral-700 dark:text-neutral-100 min-h-[44px]"
            />
            <TextField
              colorScheme={resolvedTheme}
              value={editing.content}
              onChangeText={(v) => setEditing((prev) => (prev ? { ...prev, content: v } : prev))}
              placeholder={t('teamMemory.contentPlaceholder')}
              placeholderTextColor={tokens.text.tertiary}
              multiline
              className="mt-2 min-h-[72px] rounded-sm border border-neutral-300 px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
            />
            <TextField
              colorScheme={resolvedTheme}
              value={editing.tags}
              onChangeText={(v) => setEditing((prev) => (prev ? { ...prev, tags: v } : prev))}
              placeholder={t('teamMemory.tagsPlaceholder')}
              placeholderTextColor={tokens.text.tertiary}
              className="mt-2 h-9 rounded-sm border border-neutral-300 px-3 text-sm text-neutral-900 dark:border-neutral-700 dark:text-neutral-100 min-h-[44px]"
            />
            <View className="mt-2 flex-row flex-wrap">
              {KINDS.map((k) => {
                const active = editing.kind === k
                return (
                  <TouchableOpacity
                    key={k}
                    onPress={() => setEditing((prev) => (prev ? { ...prev, kind: k } : prev))}
                    className={`mb-2 mr-2 rounded-sm px-3 py-1.5 min-h-[44px] ${
                      active
                        ? 'bg-neutral-900 dark:bg-neutral-100'
                        : 'bg-neutral-200 dark:bg-neutral-800'
                    }`}
                  >
                    <Text
                      className={`text-xs ${active ? 'text-neutral-50 dark:text-neutral-900' : 'text-neutral-700 dark:text-neutral-300'}`}
                    >
                      {kindLabel(t, k)}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <View className="mt-1 flex-row items-center">
              <TouchableOpacity
                disabled={saving}
                onPress={onSave}
                className="mr-2 rounded-sm bg-neutral-900 px-3 py-1.5 dark:bg-neutral-100 min-h-[44px]"
              >
                <Text className="text-xs text-neutral-50 dark:text-neutral-900">
                  {t('teamMemory.saveBtn')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEditing(null)}
                className="rounded-sm border border-neutral-300 px-3 py-1.5 dark:border-neutral-700 min-h-[44px]"
              >
                <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                  {t('teamMemory.cancelBtn')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {loading && rows.length === 0 ? (
          <View className="items-center py-16">
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">{t('teamMemory.loading')}</Text>
          </View>
        ) : rows.length === 0 ? (
          <View className="items-center py-16">
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">{t('teamMemory.empty')}</Text>
          </View>
        ) : (
          <View className="px-4 pb-6 pt-2">
            {rows.map((row) => (
              <View
                key={row.id}
                className="mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <View className="flex-row items-center">
                  <Text className="flex-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {row.title}
                  </Text>
                  <View className="rounded-xs bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">
                    <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                      {kindLabel(t, row.kind)}
                    </Text>
                  </View>
                </View>
                <Text
                  className="mt-1 text-xs text-neutral-600 dark:text-neutral-400"
                  numberOfLines={3}
                >
                  {row.content}
                </Text>
                {row.tags.length > 0 ? (
                  <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{row.tags.join(' · ')}</Text>
                ) : null}
                <View className="mt-3 flex-row items-center">
                  <TouchableOpacity
                    disabled={saving}
                    onPress={() => startEdit(row)}
                    className="mr-2 rounded-sm bg-neutral-900 px-3 py-1.5 dark:bg-neutral-100 min-h-[44px]"
                  >
                    <Text className="text-xs text-neutral-50 dark:text-neutral-900">
                      {t('teamMemory.editBtn')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={busyId === row.id}
                    onPress={() => onDelete(row)}
                    className="rounded-sm border border-neutral-300 px-3 py-1.5 dark:border-neutral-700 min-h-[44px]"
                  >
                    <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                      {t('teamMemory.deleteBtn')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
