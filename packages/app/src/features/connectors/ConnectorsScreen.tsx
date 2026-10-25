// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { rnGeometry, rnRadiusFor } from '@ihui/design-tokens'

import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/**
 * ConnectorsScreen — 跨端共享「连接器管理屏」(G-921 第二枚,2026-10-21)。
 *
 * 为什么进共享层:守门 39(门体 `scripts/check-rn-app-migration.mjs`)在 G-922 后按四维判
 * 迁移 —— 其中「屏级共享(V2)」要求 RN 侧有 `@ihui/rn-app` import 的同时,`packages/app`
 * 里真有同名的那个屏。本文件就是该维的第二枚落地样本(与 `features/payment/PaymentScreen.tsx`
 * 同型:props 注入式,平台只留 API 调用 / 导航 / 二次确认弹层)。
 *
 * 平台无关边界(照既有共享屏的写法,不自立门户):
 *  - 导航:只收 `onBack` 回调,不 import 任何 router(与 PaymentScreen 同一条口径);
 *  - 数据:条目是平台注入的 `ConnectorItem` —— 共享层不依赖 `@ihui/api-client`(packages/app
 *    的依赖表里确实没有它),时间格式化由平台侧做完再注入 `lastSyncText`;
 *  - 二次确认:删除确认弹层属平台能力(`appAlert`),共享层只发 `onDelete(item)` —— 不把
 *    "要不要弹、弹什么"搬进共享层;
 *  - 文案:`connectors.*` / `common.*` 业务键由共享层直接 `t()`(先例:PaymentScreen 的
 *    `payment.*`),`t` 由平台注入。
 */
/** 连接器条目(平台注入;字段对齐 mobile-rn 侧 api-client 的 ConnectorEntry 子集) */
export interface ConnectorItem {
  /** 唯一标识(作为列表 key),格式 {type}:{slug} */
  key: string
  name: string
  /** 类型:yuque|feishu|wecom|dingtalk */
  type: string
  enabled: boolean
  /** 是否已配置(决定能否同步,见 canSyncConnector) */
  configured: boolean
  /** 已格式化的最近同步时间文本(平台注入);空串 = 从未同步(渲染时回落 neverSync) */
  lastSyncText: string
  /** 同步条目数;0 = 不渲染该行 */
  syncItemsCount: number
  /** 最近一次同步错误(可空) */
  lastError?: string | null
}

/**
 * 未配置的连接器不允许同步 —— 先配置再同步,不给假成功。
 *
 * 这条是**业务判据**而不是平台差异,所以随 UI 一起下沉:两端共用同一枚函数,改判据只改一处
 * (mobile-rn 原实现里它是屏内私有函数,web 侧若另写一份就会漂)。
 */
export function canSyncConnector(item: ConnectorItem): boolean {
  return item.configured && item.enabled
}

export interface ConnectorsScreenProps {
  t: TFunction
  items: ConnectorItem[]
  loading: boolean
  refreshing: boolean
  /** 错误态文案(非空则渲染错误态 + 重试钮) */
  error: string
  /** 正在操作的条目 key(置忙禁用);空串 = 无 */
  busyKey: string
  /** 启停切换回调(平台注入:setConnectorEnabled + reload) */
  onToggle: (item: ConnectorItem) => void
  /** 同步回调(平台注入:先按 canSyncConnector 判,再 syncConnector + reload) */
  onSync: (item: ConnectorItem) => void
  /** 删除回调(平台注入:二次确认弹层确认后 deleteConnector + reload) */
  onDelete: (item: ConnectorItem) => void
  /** 下拉刷新回调 */
  onRefresh: () => void
  /** 错误态重试回调(与下拉刷新分开:原实现重试不进刷新态) */
  onRetry: () => void
  /**
   * 返回回调(**可选**):不注入就不渲染返回键 —— mobile-rn 该屏下沉前的 NavBar 未接 onBack
   * (按路由表进,原生返回键兜底),本枚只搬 UI 不改交互,故 wrapper 默认不注入。
   * 后续要补返回键,wrapper 传 `navigation.goBack()` 即可,共享层已具备这一位。
   */
  onBack?: () => void
  colorScheme?: 'light' | 'dark'
}

export function ConnectorsScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  busyKey,
  onToggle,
  onSync,
  onDelete,
  onRefresh,
  onRetry,
  onBack,
  colorScheme = 'light',
}: ConnectorsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        ) : null}
        <Text style={onBack ? styles.title : styles.titleNoBack}>{t('connectors.title')}</Text>
      </View>

      {loading ? (
        <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {items.length === 0 ? (
            <EmptyState title={t('connectors.empty')} colorScheme={colorScheme} />
          ) : (
            items.map((item) => {
              const busy = busyKey === item.key
              return (
                <View key={item.key} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text numberOfLines={1} style={styles.cardName}>
                      {item.name}
                    </Text>
                    <View style={[styles.badge, item.enabled ? styles.badgeOn : styles.badgeOff]}>
                      <Text style={item.enabled ? styles.badgeOnText : styles.badgeOffText}>
                        {item.enabled ? t('connectors.enabled') : t('connectors.disabled')}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.meta}>
                    {item.type} ·{' '}
                    {item.configured ? t('connectors.configured') : t('connectors.notConfigured')}
                  </Text>
                  <Text style={styles.meta}>
                    {t('connectors.lastSync')}: {item.lastSyncText || t('connectors.neverSync')}
                  </Text>
                  {item.syncItemsCount > 0 ? (
                    <Text style={styles.meta}>
                      {t('connectors.items')}: {item.syncItemsCount}
                    </Text>
                  ) : null}
                  {item.lastError ? <Text style={styles.itemError}>{item.lastError}</Text> : null}

                  <View style={styles.actions}>
                    <TouchableOpacity
                      disabled={busy}
                      onPress={() => onToggle(item)}
                      style={[styles.actionBtn, styles.actionSolid]}
                      accessibilityRole="button"
                      accessibilityLabel={
                        item.enabled ? t('connectors.disable') : t('connectors.enable')
                      }
                    >
                      <Text style={styles.actionSolidText}>
                        {item.enabled ? t('connectors.disable') : t('connectors.enable')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={busy}
                      onPress={() => onSync(item)}
                      style={[styles.actionBtn, styles.actionOutline]}
                      accessibilityRole="button"
                      accessibilityLabel={t('connectors.sync')}
                    >
                      <Text style={styles.actionOutlineText}>{t('connectors.sync')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={busy}
                      onPress={() => onDelete(item)}
                      style={[styles.actionBtn, styles.actionOutline]}
                      accessibilityRole="button"
                      accessibilityLabel={t('connectors.delete')}
                    >
                      <Text style={styles.actionOutlineText}>{t('connectors.delete')}</Text>
                    </TouchableOpacity>
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

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: 10, paddingBottom: 8 },
    title: {
      marginTop: 8,
      fontSize: rnGeometry.textStrong,
      fontWeight: '600',
      color: tk.text.primary,
    },
    /** 无返回键时标题自己顶到上边(否则多出 8 的空档,与原 NavBar 顶距不对齐) */
    titleNoBack: {
      fontSize: rnGeometry.textStrong,
      fontWeight: '600',
      color: tk.text.primary,
    },
    body: { flex: 1 },
    bodyContent: { padding: 12 },
    card: {
      marginBottom: 12,
      padding: 12,
      borderRadius: rnRadiusFor.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardName: {
      flex: 1,
      marginRight: 8,
      fontSize: rnGeometry.textBody,
      fontWeight: '600',
      color: tk.text.primary,
    },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: rnRadiusFor.chip },
    badgeOn: { backgroundColor: tk.brand.DEFAULT },
    badgeOff: { backgroundColor: tk.surface.muted },
    badgeOnText: { fontSize: rnGeometry.textCaption, color: tk.brand.foreground },
    badgeOffText: { fontSize: rnGeometry.textCaption, color: tk.text.secondary },
    meta: { marginTop: 4, fontSize: rnGeometry.textCaption, color: tk.text.tertiary },
    itemError: { marginTop: 8, fontSize: rnGeometry.textCaption, color: tk.error.text },
    actions: { marginTop: 12, flexDirection: 'row', alignItems: 'center' },
    actionBtn: {
      marginRight: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: rnRadiusFor.control,
    },
    actionSolid: { backgroundColor: tk.brand.DEFAULT },
    actionOutline: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
    },
    actionSolidText: { fontSize: rnGeometry.textCaption, color: tk.brand.foreground },
    actionOutlineText: { fontSize: rnGeometry.textCaption, color: tk.text.medium },
  })
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
