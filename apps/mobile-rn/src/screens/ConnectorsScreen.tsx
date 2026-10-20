// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 连接器管理屏(mobile-rn 原生实现,对应 Web 端 /connectors)。
 *
 * 平台说明:
 * - 消费 @ihui/api-client/endpoints/connectors 的 getConnectors / setConnectorEnabled /
 *   syncConnector / deleteConnector;未配置(configured=false)的条目不允许同步,
 *   仅提示先配置,不伪造"同步成功"。
 * - 端点返回 ApiResult(成功载荷在 res.data),失败按其 message 显式报错。
 * - 样式与 McpStoreScreen 一致:Tailwind className + resolvedTheme 暗色适配 + NavBar。
 */
import { useCallback, useEffect, useState } from 'react'
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { appAlert } from '../components/BottomPops'
import {
  deleteConnector,
  getConnectors,
  setConnectorEnabled,
  syncConnector,
  type ConnectorEntry,
} from '@ihui/api-client/endpoints/connectors'
import NavBar from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'

/** 未配置的连接器不允许同步:先配置再同步,不给假成功 */
function canSync(entry: ConnectorEntry): boolean {
  return entry.configured && entry.enabled
}

export function ConnectorsScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [connectors, setConnectors] = useState<ConnectorEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState('')

  const isDark = resolvedTheme === 'dark'

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getConnectors()
      if (!res.success) {
        setError(res.error || t('connectors.loadFailed'))
        setConnectors([])
        return
      }
      setConnectors(res.data?.connectors ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectors.loadFailed'))
      setConnectors([])
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

  const onToggleEnabled = useCallback(
    (entry: ConnectorEntry) => {
      setBusyKey(entry.key)
      void (async () => {
        try {
          const res = await setConnectorEnabled(entry.key, !entry.enabled)
          if (!res.success) throw new Error(res.error || t('connectors.actionFailed'))
          await load()
        } catch (e) {
          appAlert(
            t('common.loadFailed'),
            e instanceof Error ? e.message : t('connectors.actionFailed'),
          )
        } finally {
          setBusyKey('')
        }
      })()
    },
    [load, t],
  )

  const onSync = useCallback(
    (entry: ConnectorEntry) => {
      if (!canSync(entry)) {
        appAlert(t('connectors.sync'), t('connectors.notConfigured'))
        return
      }
      setBusyKey(entry.key)
      void (async () => {
        try {
          const res = await syncConnector(entry.key)
          if (!res.success) throw new Error(res.error || t('connectors.syncFailed'))
          await load()
        } catch (e) {
          appAlert(
            t('connectors.syncFailed'),
            e instanceof Error ? e.message : t('connectors.syncFailed'),
          )
        } finally {
          setBusyKey('')
        }
      })()
    },
    [load, t],
  )

  const onDelete = useCallback(
    (entry: ConnectorEntry) => {
      appAlert(t('connectors.confirmDelete'), entry.name, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => {
            setBusyKey(entry.key)
            void (async () => {
              try {
                const res = await deleteConnector(entry.key)
                if (!res.success) throw new Error(res.error || t('connectors.actionFailed'))
                await load()
              } catch (e) {
                appAlert(
                  t('common.loadFailed'),
                  e instanceof Error ? e.message : t('connectors.actionFailed'),
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
        <NavBar title={t('connectors.title')} />
      </NavChrome>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-neutral-500">{t('common.loading')}</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-3 text-sm text-neutral-600 dark:text-neutral-300">{error}</Text>
          <TouchableOpacity onPress={() => void load()} className="rounded-control bg-neutral-900 px-4 py-2">
            <Text className="text-sm text-neutral-50">{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {connectors.length === 0 ? (
            <View className="items-center py-16">
              <Text className="text-sm text-neutral-500">{t('connectors.empty')}</Text>
            </View>
          ) : (
            connectors.map((entry) => (
              <View
                key={entry.key}
                className="mx-4 mb-3 rounded-panel border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {entry.name}
                  </Text>
                  <View
                    className={`rounded-tiny px-2 py-0.5 ${
                      entry.enabled ? 'bg-neutral-900 dark:bg-neutral-100' : 'bg-neutral-200 dark:bg-neutral-800'
                    }`}
                  >
                    <Text
                      className={`text-xs ${entry.enabled ? 'text-neutral-50 dark:text-neutral-900' : 'text-neutral-600 dark:text-neutral-400'}`}
                    >
                      {entry.enabled ? t('connectors.enabled') : t('connectors.disabled')}
                    </Text>
                  </View>
                </View>

                <Text className="mt-1 text-xs text-neutral-500">
                  {entry.type} ·{' '}
                  {entry.configured ? t('connectors.configured') : t('connectors.notConfigured')}
                </Text>
                <Text className="mt-1 text-xs text-neutral-500">
                  {t('connectors.lastSync')}:{' '}
                  {entry.last_sync_at ? entry.last_sync_at : t('connectors.neverSync')}
                </Text>
                {entry.sync_items.length > 0 ? (
                  <Text className="mt-1 text-xs text-neutral-500">
                    {t('connectors.items')}: {entry.sync_items.length}
                  </Text>
                ) : null}
                {entry.last_error ? (
                  <Text className="mt-2 text-xs text-red-600 dark:text-red-400">{entry.last_error}</Text>
                ) : null}

                <View className="mt-3 flex-row items-center">
                  <TouchableOpacity
                    disabled={busyKey === entry.key}
                    onPress={() => onToggleEnabled(entry)}
                    className="mr-2 rounded-control bg-neutral-900 px-3 py-1.5 dark:bg-neutral-100"
                  >
                    <Text className="text-xs text-neutral-50 dark:text-neutral-900">
                      {entry.enabled ? t('connectors.disable') : t('connectors.enable')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={busyKey === entry.key}
                    onPress={() => onSync(entry)}
                    className="mr-2 rounded-control border border-neutral-300 px-3 py-1.5 dark:border-neutral-700"
                  >
                    <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                      {t('connectors.sync')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={busyKey === entry.key}
                    onPress={() => onDelete(entry)}
                    className="rounded-control border border-neutral-300 px-3 py-1.5 dark:border-neutral-700"
                  >
                    <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                      {t('connectors.delete')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  )
}

export default ConnectorsScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
