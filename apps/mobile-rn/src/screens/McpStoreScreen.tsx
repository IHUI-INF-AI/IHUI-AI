// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MCP 商店 / 已注册 Server 管理屏(mobile-rn 原生实现,对应 Web 端 /mcp-store)。
 *
 * 平台说明:
 * - 消费 @ihui/api-client/endpoints/mcp 的 getMcpStore / installStoreServer /
 *   uninstallStoreServer / setStoreServerEnabled,不跨端 import web 文件。
 * - 端点返回 ApiResult(成功载荷在 res.data),失败按其 message 显式报错,不静默。
 * - 高风险条目(scoring.confirm_required)安装前二次确认;rejected 条目禁安装并说明原因。
 * - 样式与 SubagentsScreen 一致:Tailwind className + resolvedTheme 暗色适配 + NavBar。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { appAlert } from '../components/BottomPops'
import {
  getMcpStore,
  installStoreServer,
  setStoreServerEnabled,
  uninstallStoreServer,
  type McpStoreEntry,
} from '@ihui/api-client/endpoints/mcp'
import NavBar from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'

type FilterKey = 'all' | 'installed'

/** 取评分等级文案键(旧后端无 scoring 时判空,不臆造等级) */
function gradeKey(entry: McpStoreEntry): string | null {
  return entry.scoring?.grade ?? null
}

/** 市场审核态 → 是否允许安装(rejected 后端会 403,前端先拦) */
function installBlockedReason(entry: McpStoreEntry): string | null {
  if (entry.review_status === 'rejected') return 'mcpStore.reviewRejected'
  return null
}

export function McpStoreScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [servers, setServers] = useState<McpStoreEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState('')

  const isDark = resolvedTheme === 'dark'

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getMcpStore()
      if (!res.success) {
        setError(res.error || t('mcpStore.loadFailed'))
        setServers([])
        return
      }
      setServers(res.data?.servers ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('mcpStore.loadFailed'))
      setServers([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load()
  }, [load])

  const visible = useMemo(
    () => (filter === 'installed' ? servers.filter((s) => s.installed) : servers),
    [filter, servers],
  )

  const onToggleEnabled = useCallback(
    (entry: McpStoreEntry) => {
      setBusyKey(entry.key)
      void (async () => {
        try {
          const res = await setStoreServerEnabled(entry.server_name, !entry.enabled)
          if (!res.success) throw new Error(res.error || t('mcpStore.actionFailed'))
          await load()
        } catch (e) {
          appAlert(
            t('common.loadFailed'),
            e instanceof Error ? e.message : t('mcpStore.actionFailed'),
          )
        } finally {
          setBusyKey('')
        }
      })()
    },
    [load, t],
  )

  const doInstall = useCallback(
    (entry: McpStoreEntry, confirmRisk = false) => {
      setBusyKey(entry.key)
      void (async () => {
        try {
          const res = await installStoreServer(entry.key, {
            ...(confirmRisk ? { confirm_risk: true } : {}),
          })
          if (!res.success) throw new Error(res.error || t('mcpStore.actionFailed'))
          await load()
        } catch (e) {
          appAlert(
            t('common.loadFailed'),
            e instanceof Error ? e.message : t('mcpStore.actionFailed'),
          )
        } finally {
          setBusyKey('')
        }
      })()
    },
    [load, t],
  )

  const onInstall = useCallback(
    (entry: McpStoreEntry) => {
      const blocked = installBlockedReason(entry)
      if (blocked) {
        appAlert(t('mcpStore.cannotInstall'), t(blocked))
        return
      }
      // 高风险条目(后端标记 confirm_required)安装前二次确认
      if (entry.scoring?.confirm_required) {
        appAlert(t('mcpStore.confirmRisk'), entry.name, [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.confirm'), onPress: () => doInstall(entry, true) },
        ])
        return
      }
      doInstall(entry)
    },
    [doInstall, t],
  )

  const onUninstall = useCallback(
    (entry: McpStoreEntry) => {
      appAlert(t('mcpStore.confirmUninstall'), entry.name, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => {
            setBusyKey(entry.key)
            void (async () => {
              try {
                const res = await uninstallStoreServer(entry.server_name)
                if (!res.success) throw new Error(res.error || t('mcpStore.actionFailed'))
                await load()
              } catch (e) {
                appAlert(
                  t('common.loadFailed'),
                  e instanceof Error ? e.message : t('mcpStore.actionFailed'),
                )
              } finally {
                setBusyKey('')
              }
            })()
          },
        },
      ])
    },
    [load, t],
  )

  return (
    <View className={`flex-1 ${isDark ? 'bg-neutral-950' : 'bg-neutral-50'}`}>
      <NavChrome>
        <NavBar title={t('mcpStore.title')} />
      </NavChrome>
      <View className="flex-row px-4 pb-2">
        {(['all', 'installed'] as const).map((k) => {
          const active = filter === k
          return (
            <TouchableOpacity
              key={k}
              onPress={() => setFilter(k)}
              className={`mr-2 rounded-sm px-3 py-1.5 ${
                active ? 'bg-neutral-900 dark:bg-neutral-100' : 'bg-neutral-200 dark:bg-neutral-800'
              }`}
            >
              <Text
                className={`text-xs ${active ? 'text-neutral-50 dark:text-neutral-900' : 'text-neutral-700 dark:text-neutral-300'}`}
              >
                {t(k === 'all' ? 'mcpStore.filterAll' : 'mcpStore.filterInstalled')}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-neutral-500">{t('common.loading')}</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-3 text-sm text-neutral-600 dark:text-neutral-300">{error}</Text>
          <TouchableOpacity
            onPress={() => void load()}
            className="rounded-sm bg-neutral-900 px-4 py-2"
          >
            <Text className="text-sm text-neutral-50">{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {visible.length === 0 ? (
            <View className="items-center py-16">
              <Text className="text-sm text-neutral-500">{t('mcpStore.empty')}</Text>
            </View>
          ) : (
            visible.map((entry) => {
              const blocked = installBlockedReason(entry)
              const grade = gradeKey(entry)
              return (
                <View
                  key={entry.key}
                  className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="flex-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {entry.name}
                    </Text>
                    {grade ? (
                      <View className="rounded-xs bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">
                        <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                          {t('mcpStore.grade')}: {grade}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                    {entry.description}
                  </Text>
                  <View className="mt-2 flex-row flex-wrap items-center">
                    <Text className="mr-3 text-xs text-neutral-500">
                      {t(entry.source === 'official' ? 'mcpStore.official' : 'mcpStore.community')}{' '}
                      · {entry.transport}
                    </Text>
                    <Text className="mr-3 text-xs text-neutral-500">
                      {t('mcpStore.tools')}: {entry.tool_count}
                    </Text>
                    {entry.review_status ? (
                      <Text className="text-xs text-neutral-500">
                        {t(
                          entry.review_status === 'approved'
                            ? 'mcpStore.reviewApproved'
                            : entry.review_status === 'pending'
                              ? 'mcpStore.reviewPending'
                              : 'mcpStore.reviewRejected',
                        )}
                      </Text>
                    ) : null}
                  </View>
                  {entry.last_error ? (
                    <Text className="mt-2 text-xs text-red-600 dark:text-red-400">
                      {entry.last_error}
                    </Text>
                  ) : null}
                  <View className="mt-3 flex-row items-center">
                    {entry.installed ? (
                      <>
                        <TouchableOpacity
                          disabled={busyKey === entry.key}
                          onPress={() => onToggleEnabled(entry)}
                          className="mr-2 rounded-sm bg-neutral-900 px-3 py-1.5 dark:bg-neutral-100"
                        >
                          <Text className="text-xs text-neutral-50 dark:text-neutral-900">
                            {entry.enabled ? t('mcpStore.disable') : t('mcpStore.enable')}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          disabled={busyKey === entry.key}
                          onPress={() => onUninstall(entry)}
                          className="rounded-sm border border-neutral-300 px-3 py-1.5 dark:border-neutral-700"
                        >
                          <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                            {t('mcpStore.uninstall')}
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        disabled={busyKey === entry.key || Boolean(blocked)}
                        onPress={() => onInstall(entry)}
                        className={`rounded-sm px-3 py-1.5 ${
                          blocked
                            ? 'bg-neutral-300 dark:bg-neutral-800'
                            : 'bg-neutral-900 dark:bg-neutral-100'
                        }`}
                      >
                        <Text
                          className={`text-xs ${blocked ? 'text-neutral-600' : 'text-neutral-50 dark:text-neutral-900'}`}
                        >
                          {t('mcpStore.install')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )
            })
          )}
        </ScrollView>
      )}
    </View>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
