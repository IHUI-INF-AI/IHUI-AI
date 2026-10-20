// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ConnectorsScreen as SharedConnectorsScreen,
  canSyncConnector,
  type ConnectorItem,
} from '@ihui/rn-app'
import {
  deleteConnector,
  getConnectors,
  setConnectorEnabled,
  syncConnector,
  type ConnectorEntry,
} from '@ihui/api-client/endpoints/connectors'
import { appAlert } from '../components/BottomPops'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'

/**
 * 连接器管理屏(RN 端),对应 Web 端 /connectors。
 *
 * 〔G-921 2026-10-21〕UI 已下沉到共享层 `@ihui/rn-app` 的 ConnectorsScreen —— 本文件改成
 * wrapper,只留平台侧三件事:API 调用(get / setEnabled / sync / delete)、二次确认弹层
 * (`appAlert`)、i18n 与主题注入。列表卡片、启停徽章、加载/错误/空态由共享层渲染,
 * 与 PaymentScreen / DomainHubScreen 同一型 wrapper 模式。
 * **不准**靠"补一条 @ihui/rn-app import"或塞白名单消门 39 的红 —— 那两条都不改真实共享度。
 *
 * 平台说明(沿用下沉前的口径,一条未改):
 * - 端点返回 ApiResult(成功载荷在 res.data),失败按其 message 显式报错;
 * - 未配置(configured=false)的条目**不允许同步**,仅提示先配置,不伪造"同步成功" ——
 *   这条判据随 UI 一起下沉成共享层的 `canSyncConnector`,两端共用同一枚函数。
 */
function toConnectorItem(entry: ConnectorEntry): ConnectorItem {
  return {
    key: entry.key,
    name: entry.name,
    type: entry.type,
    enabled: entry.enabled,
    configured: entry.configured,
    // 时间不做二次格式化:原实现直接渲染后端给的 last_sync_at,空值由共享层回落"从未同步"
    lastSyncText: entry.last_sync_at ?? '',
    syncItemsCount: entry.sync_items?.length ?? 0,
    lastError: entry.last_error ?? null,
  }
}

export function ConnectorsScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [entries, setEntries] = useState<ConnectorEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getConnectors()
      if (!res.success) {
        setError(res.error || t('connectors.loadFailed'))
        setEntries([])
        return
      }
      setEntries(res.data?.connectors ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectors.loadFailed'))
      setEntries([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const items = useMemo(() => entries.map(toConnectorItem), [entries])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load()
  }, [load])

  const onToggle = useCallback(
    (item: ConnectorItem) => {
      setBusyKey(item.key)
      void (async () => {
        try {
          const res = await setConnectorEnabled(item.key, !item.enabled)
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
    (item: ConnectorItem) => {
      if (!canSyncConnector(item)) {
        appAlert(t('connectors.sync'), t('connectors.notConfigured'))
        return
      }
      setBusyKey(item.key)
      void (async () => {
        try {
          const res = await syncConnector(item.key)
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
    (item: ConnectorItem) => {
      appAlert(t('connectors.confirmDelete'), item.name, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => {
            setBusyKey(item.key)
            void (async () => {
              try {
                const res = await deleteConnector(item.key)
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
    <SharedConnectorsScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      busyKey={busyKey}
      onToggle={onToggle}
      onSync={onSync}
      onDelete={onDelete}
      onRefresh={onRefresh}
      onRetry={() => void load()}
      colorScheme={resolvedTheme}
    />
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
