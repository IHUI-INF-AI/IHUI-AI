// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  McpStoreScreen as SharedMcpStoreScreen,
  mcpInstallBlockedKey,
  type McpStoreFilterKey,
  type McpStoreItem,
} from '@ihui/rn-app'
import {
  getMcpStore,
  installStoreServer,
  setStoreServerEnabled,
  uninstallStoreServer,
  type McpStoreEntry,
} from '@ihui/api-client/endpoints/mcp'
import { appAlert } from '../components/BottomPops'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'

/**
 * MCP 商店 / 已注册 Server 管理屏(RN 端),对应 Web 端 /mcp-store。
 *
 * 〔G-921 2026-10-21〕UI 已下沉到共享层 `@ihui/rn-app` 的 McpStoreScreen —— 本文件改成 wrapper,
 * 只留平台侧三件事:API 调用(get / install / setEnabled / uninstall)、二次确认弹层(`appAlert`)、
 * i18n 与主题注入。筛选档、列表卡片、加载/错误/空态由共享层渲染,与 PaymentScreen /
 * DomainHubScreen / ConnectorsScreen 同一型 wrapper 模式。
 * **不准**靠"补一条 @ihui/rn-app import"或塞白名单消门 39 的红 —— 那两条都不改真实共享度。
 *
 * 平台说明(沿用下沉前的口径,一条未改):
 * - 端点返回 ApiResult(成功载荷在 res.data),失败按其 message 显式报错,不静默;
 * - 高风险条目(scoring.confirm_required)安装前二次确认;
 * - 审核被拒(rejected)的条目禁安装并说明原因 —— 这条判据随 UI 下沉成共享层的
 *   `mcpInstallBlockedKey`(返回文案键,两端说同一句话),本文件不再各写一份。
 */
function toMcpStoreItem(entry: McpStoreEntry): McpStoreItem {
  return {
    key: entry.key,
    serverName: entry.server_name,
    name: entry.name,
    description: entry.description,
    source: entry.source,
    transport: entry.transport,
    toolCount: entry.tool_count,
    installed: entry.installed,
    enabled: entry.enabled,
    grade: entry.scoring?.grade ?? null,
    reviewStatus: entry.review_status ?? null,
    confirmRequired: Boolean(entry.scoring?.confirm_required),
    lastError: entry.last_error ?? null,
  }
}

export function McpStoreScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [filter, setFilter] = useState<McpStoreFilterKey>('all')
  const [entries, setEntries] = useState<McpStoreEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getMcpStore()
      if (!res.success) {
        setError(res.error || t('mcpStore.loadFailed'))
        setEntries([])
        return
      }
      setEntries(res.data?.servers ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('mcpStore.loadFailed'))
      setEntries([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const items = useMemo(() => entries.map(toMcpStoreItem), [entries])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load()
  }, [load])

  const doInstall = useCallback(
    (item: McpStoreItem, confirmRisk = false) => {
      setBusyKey(item.key)
      void (async () => {
        try {
          const res = await installStoreServer(item.key, {
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
    (item: McpStoreItem) => {
      const blocked = mcpInstallBlockedKey(item)
      if (blocked) {
        appAlert(t('mcpStore.cannotInstall'), t(blocked))
        return
      }
      // 高风险条目(后端标记 confirm_required)安装前二次确认
      if (item.confirmRequired) {
        appAlert(t('mcpStore.confirmRisk'), item.name, [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.confirm'), onPress: () => doInstall(item, true) },
        ])
        return
      }
      doInstall(item)
    },
    [doInstall, t],
  )

  const onToggle = useCallback(
    (item: McpStoreItem) => {
      setBusyKey(item.key)
      void (async () => {
        try {
          const res = await setStoreServerEnabled(item.serverName, !item.enabled)
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

  const onUninstall = useCallback(
    (item: McpStoreItem) => {
      appAlert(t('mcpStore.confirmUninstall'), item.name, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => {
            setBusyKey(item.key)
            void (async () => {
              try {
                const res = await uninstallStoreServer(item.serverName)
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
    <SharedMcpStoreScreen
      t={t}
      items={items}
      filter={filter}
      onFilterChange={setFilter}
      loading={loading}
      refreshing={refreshing}
      error={error}
      busyKey={busyKey}
      onToggle={onToggle}
      onInstall={onInstall}
      onUninstall={onUninstall}
      onRefresh={onRefresh}
      onRetry={() => void load()}
      colorScheme={resolvedTheme}
    />
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
