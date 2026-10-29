// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { rnGeometry, rnRadiusFor, rnSpacing } from '@ihui/design-tokens'

import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/**
 * McpStoreScreen — 跨端共享「MCP 商店 / 已注册 Server 管理屏」(G-921 第三枚,2026-10-21)。
 *
 * 为什么进共享层:守门 39(门体 `scripts/check-rn-app-migration.mjs`)的「屏级共享(V2)」那一维
 * 要求 RN 侧有 `@ihui/rn-app` import 的同时 `packages/app` 里真有同名的那个屏。本文件是该维的
 * 第三枚(也是 G-921 三枚里体量最大的一枚)落地样本,与 `features/payment/PaymentScreen.tsx`
 * 同型:props 注入式,平台只留 API 调用 / 导航 / 二次确认弹层。
 *
 * 平台无关边界(照既有共享屏的写法,不自立门户):
 *  - 导航:只收**可选**的 `onBack`(该屏下沉前 NavBar 未接 onBack,故 wrapper 默认不注入,
 *    不新增交互);
 *  - 数据:条目是平台注入的 `McpStoreItem` —— 共享层不依赖 `@ihui/api-client`(packages/app
 *    的依赖表里确实没有它),列表过滤(all/installed)在共享层按 `filter` 现算;
 *  - 二次确认:安装(高风险)/ 卸载的确认弹层属平台能力(`appAlert`),共享层只发回调 —— 但
 *    "哪些条目禁安装、为什么"是**业务判据**,随屏下沉成 `mcpInstallBlockedKey`,两端共用一枚;
 *  - 文案:`mcpStore.*` / `common.*` 业务键由共享层直接 `t()`(先例:PaymentScreen 的 `payment.*`)。
 */
/** 列表过滤档(全部 / 只看已安装) */
export type McpStoreFilterKey = 'all' | 'installed'

/** MCP 商店条目(平台注入;字段对齐 mobile-rn 侧 api-client 的 McpStoreEntry 子集) */
export interface McpStoreItem {
  /** 条目身份(作为列表 key) */
  key: string
  /** 服务端名(启用/停用与卸载按它寻址,与 key 不同物,勿混用) */
  serverName: string
  name: string
  description: string
  /** 来源:official / community */
  source: string
  transport: string
  toolCount: number
  installed: boolean
  enabled: boolean
  /** 评分等级(可空 = 旧后端无 scoring,不臆造等级) */
  grade?: string | null
  /** 市场审核态(可空 = 不展示该段) */
  reviewStatus?: string | null
  /** 后端标记为高风险 ⇒ 安装前须二次确认 */
  confirmRequired: boolean
  /** 最近一次错误(可空) */
  lastError?: string | null
}

/**
 * 禁安装判据:市场审核被拒(rejected)的条目不许装 —— 后端会 403,前端先拦并说明原因。
 *
 * 返回的是**文案键**而不是布尔:为什么禁装也要两端说同一句话,改口径只改这一处。
 * 这条与 `canSyncConnector`(连接器屏)同一型 —— 业务判据随 UI 一起下沉,不各写一份。
 */
export function mcpInstallBlockedKey(item: McpStoreItem): string | null {
  return item.reviewStatus === 'rejected' ? 'mcpStore.reviewRejected' : null
}

function reviewKeyOf(status: string): string {
  if (status === 'approved') return 'mcpStore.reviewApproved'
  if (status === 'pending') return 'mcpStore.reviewPending'
  return 'mcpStore.reviewRejected'
}

export interface McpStoreScreenProps {
  t: TFunction
  items: McpStoreItem[]
  filter: McpStoreFilterKey
  onFilterChange: (key: McpStoreFilterKey) => void
  loading: boolean
  refreshing: boolean
  /** 错误态文案(非空则渲染错误态 + 重试钮) */
  error: string
  /** 正在操作的条目 key(置忙禁用);空串 = 无 */
  busyKey: string
  /** 启停切换回调(平台注入:setStoreServerEnabled + reload) */
  onToggle: (item: McpStoreItem) => void
  /** 安装回调(平台注入:禁装先拦、高风险先确认,再 installStoreServer + reload) */
  onInstall: (item: McpStoreItem) => void
  /** 卸载回调(平台注入:二次确认后 uninstallStoreServer + reload) */
  onUninstall: (item: McpStoreItem) => void
  /** 下拉刷新回调 */
  onRefresh: () => void
  /** 错误态重试回调(与下拉刷新分开:原实现重试不进刷新态) */
  onRetry: () => void
  /** 返回回调(**可选**):不注入就不渲染返回键 —— 该屏下沉前 NavBar 未接 onBack,不改交互 */
  onBack?: () => void
  colorScheme?: 'light' | 'dark'
}

export function McpStoreScreen({
  t,
  items,
  filter,
  onFilterChange,
  loading,
  refreshing,
  error,
  busyKey,
  onToggle,
  onInstall,
  onUninstall,
  onRefresh,
  onRetry,
  onBack,
  colorScheme = 'light',
}: McpStoreScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const visible = useMemo(
    () => (filter === 'installed' ? items.filter((i) => i.installed) : items),
    [filter, items],
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        ) : null}
        <Text style={onBack ? styles.title : styles.titleNoBack}>{t('mcpStore.title')}</Text>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'installed'] as const).map((k) => {
          const active = filter === k
          return (
            <TouchableOpacity
              key={k}
              onPress={() => onFilterChange(k)}
              style={[styles.filterChip, active ? styles.filterChipOn : styles.filterChipOff]}
              accessibilityRole="button"
              accessibilityLabel={
                k === 'all' ? t('mcpStore.filterAll') : t('mcpStore.filterInstalled')
              }
            >
              <Text style={active ? styles.filterChipOnText : styles.filterChipOffText}>
                {k === 'all' ? t('mcpStore.filterAll') : t('mcpStore.filterInstalled')}
              </Text>
            </TouchableOpacity>
          )
        })}
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
          {visible.length === 0 ? (
            <EmptyState title={t('mcpStore.empty')} colorScheme={colorScheme} />
          ) : (
            visible.map((item) => {
              const busy = busyKey === item.key
              const blockedKey = mcpInstallBlockedKey(item)
              return (
                <View key={item.key} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text numberOfLines={1} style={styles.cardName}>
                      {item.name}
                    </Text>
                    {item.grade ? (
                      <View style={styles.gradeTag}>
                        <Text style={styles.gradeTagText}>
                          {t('mcpStore.grade')}: {item.grade}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.desc}>{item.description}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}>
                      {t(item.source === 'official' ? 'mcpStore.official' : 'mcpStore.community')} ·{' '}
                      {item.transport}
                    </Text>
                    <Text style={styles.meta}>
                      {t('mcpStore.tools')}: {item.toolCount}
                    </Text>
                    {item.reviewStatus ? (
                      <Text style={styles.meta}>{t(reviewKeyOf(item.reviewStatus))}</Text>
                    ) : null}
                  </View>
                  {item.lastError ? <Text style={styles.itemError}>{item.lastError}</Text> : null}

                  <View style={styles.actions}>
                    {item.installed ? (
                      <>
                        <TouchableOpacity
                          disabled={busy}
                          onPress={() => onToggle(item)}
                          style={[styles.actionBtn, styles.actionSolid]}
                          accessibilityRole="button"
                          accessibilityLabel={
                            item.enabled ? t('mcpStore.disable') : t('mcpStore.enable')
                          }
                        >
                          <Text style={styles.actionSolidText}>
                            {item.enabled ? t('mcpStore.disable') : t('mcpStore.enable')}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          disabled={busy}
                          onPress={() => onUninstall(item)}
                          style={[styles.actionBtn, styles.actionOutline]}
                          accessibilityRole="button"
                          accessibilityLabel={t('mcpStore.uninstall')}
                        >
                          <Text style={styles.actionOutlineText}>{t('mcpStore.uninstall')}</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        disabled={busy || Boolean(blockedKey)}
                        onPress={() => onInstall(item)}
                        style={[
                          styles.actionBtn,
                          blockedKey ? styles.actionDisabled : styles.actionSolid,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={t('mcpStore.install')}
                      >
                        <Text
                          style={blockedKey ? styles.actionDisabledText : styles.actionSolidText}
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

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: 10, paddingBottom: rnSpacing.sm },
    title: {
      marginTop: rnSpacing.sm,
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
    filterRow: {
      flexDirection: 'row',
      paddingHorizontal: rnSpacing.md,
      paddingBottom: rnSpacing.sm,
    },
    filterChip: {
      marginRight: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: 6,
      borderRadius: rnRadiusFor.control,
    },
    filterChipOn: { backgroundColor: tk.brand.DEFAULT },
    filterChipOff: { backgroundColor: tk.surface.muted },
    filterChipOnText: { fontSize: rnGeometry.textCaption, color: tk.brand.foreground },
    filterChipOffText: { fontSize: rnGeometry.textCaption, color: tk.text.medium },
    body: { flex: 1 },
    bodyContent: { padding: rnSpacing.md },
    card: {
      marginBottom: rnSpacing.md,
      padding: rnSpacing.md,
      borderRadius: rnRadiusFor.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardName: {
      flex: 1,
      marginRight: rnSpacing.sm,
      fontSize: rnGeometry.textBody,
      fontWeight: '600',
      color: tk.text.primary,
    },
    gradeTag: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadiusFor.chip,
      backgroundColor: tk.surface.muted,
    },
    gradeTagText: { fontSize: rnGeometry.textCaption, color: tk.text.medium },
    desc: { marginTop: rnSpacing.xs, fontSize: rnGeometry.textCaption, color: tk.text.secondary },
    metaRow: {
      marginTop: rnSpacing.sm,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    meta: { marginRight: rnSpacing.md, fontSize: rnGeometry.textCaption, color: tk.text.tertiary },
    itemError: { marginTop: rnSpacing.sm, fontSize: rnGeometry.textCaption, color: tk.error.text },
    actions: { marginTop: rnSpacing.md, flexDirection: 'row', alignItems: 'center' },
    actionBtn: {
      marginRight: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: 6,
      borderRadius: rnRadiusFor.control,
    },
    actionSolid: { backgroundColor: tk.brand.DEFAULT },
    actionOutline: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
    },
    actionDisabled: { backgroundColor: tk.surface.muted },
    actionSolidText: { fontSize: rnGeometry.textCaption, color: tk.brand.foreground },
    actionOutlineText: { fontSize: rnGeometry.textCaption, color: tk.text.medium },
    actionDisabledText: { fontSize: rnGeometry.textCaption, color: tk.text.tertiary },
  })
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
