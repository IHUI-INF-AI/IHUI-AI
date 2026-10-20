// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Repo Wiki 文档浏览屏(mobile-rn 原生实现,对应 Web 端 /repo-wiki)。
 *
 * 平台说明:
 * - 消费 @ihui/api-client/endpoints/repo-wiki 的 listRepoWiki / getRepoWikiDoc /
 *   deleteRepoWikiDoc,不跨端 import web 文件。
 * - 端点形态与 mcp.ts 不同:这三个函数在失败时 **throw**(不是返回 ApiResult),
 *   所以本屏统一 try/catch 取 e.message,不读 res.error。
 * - generateRepoWiki 需要 files[](整个仓库目录的文件清单),依赖浏览器 File System
 *   Access API,RN 侧无等价的目录遍历能力 —— 不做假接通,入口以提示文案如实说明。
 * - 仓库名落在 AsyncStorage,冷启自动回填(对齐 Web 端 localStorage 口径)。
 * - 样式与 McpStoreScreen 一致:Tailwind className + resolvedTheme 暗色适配 + NavBar。
 */
import { useCallback, useEffect, useState } from 'react'
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { TextField } from '@ihui/rn-app'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { appAlert } from '../components/BottomPops'
import {
  deleteRepoWikiDoc,
  getRepoWikiDoc,
  listRepoWiki,
  type RepoWikiDocSummary,
} from '@ihui/api-client/endpoints/repo-wiki'
import NavBar from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import { tokens } from '../theme/active-tokens'

const REPO_NAME_KEY = 'ihui:repo-wiki:repoName'

/** ISO 时间 → `YYYY-MM-DD HH:mm`(不依赖 Intl,Hermes 各版本表现一致) */
function formatStamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function RepoWikiScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [repoName, setRepoName] = useState('')
  const [docs, setDocs] = useState<RepoWikiDocSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  // 详情态:viewingId 非空即进入正文视图
  const [viewingId, setViewingId] = useState('')
  const [viewingTitle, setViewingTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [loadingDetail, setLoadingDetail] = useState(false)

  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    void (async () => {
      const saved = await AsyncStorage.getItem(REPO_NAME_KEY)
      if (saved) setRepoName(saved)
    })()
  }, [])

  const load = useCallback(
    async (name: string, silent = false) => {
      if (!name.trim()) {
        setError(t('repoWiki.needRepoName'))
        return
      }
      setError('')
      if (!silent) setLoading(true)
      try {
        setDocs(await listRepoWiki(name.trim()))
      } catch (e) {
        setError(e instanceof Error ? e.message : t('repoWiki.loadFailed'))
        setDocs([])
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [t],
  )

  const onSearch = useCallback(() => {
    void AsyncStorage.setItem(REPO_NAME_KEY, repoName.trim()).catch(() => {})
    void load(repoName)
  }, [load, repoName])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load(repoName, true)
  }, [load, repoName])

  const onView = useCallback(
    async (doc: RepoWikiDocSummary) => {
      setViewingId(doc.id)
      setViewingTitle(doc.title)
      setDetail('')
      setLoadingDetail(true)
      setError('')
      try {
        const full = await getRepoWikiDoc(doc.id)
        setDetail(full.content)
      } catch (e) {
        setError(e instanceof Error ? e.message : t('repoWiki.loadFailed'))
        setViewingId('')
      } finally {
        setLoadingDetail(false)
      }
    },
    [t],
  )

  const onDelete = useCallback(
    (doc: RepoWikiDocSummary) => {
      appAlert(t('repoWiki.deleteConfirm'), doc.title, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => {
            setBusyId(doc.id)
            void (async () => {
              try {
                await deleteRepoWikiDoc(doc.id)
                setDocs((prev) => prev.filter((d) => d.id !== doc.id))
                if (viewingId === doc.id) {
                  setViewingId('')
                  setDetail('')
                }
              } catch (e) {
                appAlert(
                  t('common.failed'),
                  e instanceof Error ? e.message : t('repoWiki.loadFailed'),
                )
              } finally {
                setBusyId('')
              }
            })()
          },
        },
      ])
    },
    [t, viewingId],
  )

  return (
    <View className={`flex-1 ${isDark ? 'bg-neutral-950' : 'bg-neutral-50'}`}>
      <NavChrome>
        <NavBar title={t('repoWiki.title')} />
      </NavChrome>

      {viewingId ? (
        <View className="flex-1 px-4">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="flex-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {viewingTitle}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setViewingId('')
                setDetail('')
              }}
              className="ml-2 rounded-sm border border-neutral-300 px-3 py-1.5 dark:border-neutral-700"
            >
              <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                {t('repoWiki.backToList')}
              </Text>
            </TouchableOpacity>
          </View>
          {loadingDetail ? (
            <View className="items-center py-10">
              <Text className="text-sm text-neutral-500">{t('repoWiki.loadingDetail')}</Text>
            </View>
          ) : (
            <ScrollView className="flex-1">
              <Text className="text-xs leading-5 text-neutral-800 dark:text-neutral-200">
                {detail}
              </Text>
            </ScrollView>
          )}
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View className="px-4 pt-1">
            <Text className="text-xs text-neutral-600 dark:text-neutral-400">
              {t('repoWiki.description')}
            </Text>
            <View className="mt-2 flex-row items-center">
              <TextField
                colorScheme={resolvedTheme}
                value={repoName}
                onChangeText={setRepoName}
                placeholder={t('repoWiki.repoNamePlaceholder')}
                placeholderTextColor={tokens.text.tertiary}
                autoCapitalize="none"
                autoCorrect={false}
                className="mr-2 h-9 flex-1 rounded-sm border border-neutral-300 px-3 text-sm text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
              />
              <TouchableOpacity
                disabled={loading}
                onPress={onSearch}
                className="rounded-sm bg-neutral-900 px-3 py-2 dark:bg-neutral-100"
              >
                <Text className="text-xs text-neutral-50 dark:text-neutral-900">
                  {t('repoWiki.searchBtn')}
                </Text>
              </TouchableOpacity>
            </View>
            <Text className="mt-2 text-xs text-neutral-500">{t('repoWiki.generateHint')}</Text>
          </View>

          {error ? (
            <View className="mt-3 px-4">
              <Text className="text-sm text-red-600 dark:text-red-400">{error}</Text>
            </View>
          ) : null}

          {loading && docs.length === 0 ? (
            <View className="items-center py-16">
              <Text className="text-sm text-neutral-500">{t('repoWiki.loadingDocs')}</Text>
            </View>
          ) : docs.length === 0 ? (
            <View className="items-center py-16">
              <Text className="text-sm text-neutral-500">{t('repoWiki.emptyList')}</Text>
            </View>
          ) : (
            <View className="px-4 pb-6 pt-3">
              <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {t('repoWiki.listTitle')}
              </Text>
              {docs.map((doc) => (
                <View
                  key={doc.id}
                  className="mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <View className="flex-row items-center">
                    <Text className="flex-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {doc.title}
                    </Text>
                    <View className="rounded-xs bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">
                      <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                        {t(doc.kind === 'module' ? 'repoWiki.kindModule' : 'repoWiki.kindOverview')}
                      </Text>
                    </View>
                  </View>
                  {doc.modulePath ? (
                    <Text className="mt-1 text-xs text-neutral-500">{doc.modulePath}</Text>
                  ) : null}
                  <Text className="mt-1 text-xs text-neutral-500">
                    {t('repoWiki.generatedAt', { time: formatStamp(doc.generatedAt) })}
                    {' · '}
                    {t('repoWiki.fileCount', { count: doc.fileCount })}
                  </Text>
                  <View className="mt-3 flex-row items-center">
                    <TouchableOpacity
                      disabled={loadingDetail}
                      onPress={() => void onView(doc)}
                      className="mr-2 rounded-sm bg-neutral-900 px-3 py-1.5 dark:bg-neutral-100"
                    >
                      <Text className="text-xs text-neutral-50 dark:text-neutral-900">
                        {t('repoWiki.view')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={busyId === doc.id}
                      onPress={() => onDelete(doc)}
                      className="rounded-sm border border-neutral-300 px-3 py-1.5 dark:border-neutral-700"
                    >
                      <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                        {t('repoWiki.delete')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
