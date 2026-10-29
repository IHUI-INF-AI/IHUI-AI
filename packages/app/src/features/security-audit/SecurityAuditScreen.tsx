// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { useMemo } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'

import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

/**
 * 安全审计共享屏(2026-10-29 立)—— 平台无关,只渲染列表。
 *
 * 契约照 web 现读(`apps/web/app/(main)/security-audit/page.tsx` 头注):`GET /api/security/audit`
 * 的 `SecurityLog` 行只有 `action / ip / userAgent / createdAt` 四列,**没有** type 与 description;
 * 故 `type` 由 `action` 归类(未识别落 other),`description` 就是 `action` 原文 —— 不编造后端没有的字段。
 * 分类函数与 web 同一口径,两端同形。
 */
export interface SecurityAuditItem {
  id: string
  action: string
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export type SecurityAuditType = 'login' | 'permission' | 'sensitive' | 'other'

export function auditTypeOf(action: string): SecurityAuditType {
  const a = String(action ?? '').toLowerCase()
  if (a.includes('login') || a.includes('logout') || a.includes('auth')) return 'login'
  if (a.includes('permission') || a.includes('role') || a.includes('password')) return 'permission'
  if (a.includes('sensitive') || a.includes('delete') || a.includes('transfer')) return 'sensitive'
  return 'other'
}

export interface SecurityAuditScreenProps {
  t: (key: string, vars?: Record<string, string | number>) => string
  items: SecurityAuditItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

export function SecurityAuditScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onBack,
  colorScheme = 'light',
}: SecurityAuditScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading && items.length === 0) return <ScreenSkeleton colorScheme={colorScheme} />
  if (error && items.length === 0)
    return <ErrorState message={error} onRetry={onRefresh} colorScheme={colorScheme} />

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('securityAudit.title')}</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tk.text.tertiary}
          />
        }
        ListEmptyComponent={
          <EmptyState title={t('securityAudit.empty')} colorScheme={colorScheme} />
        }
        renderItem={({ item }) => {
          const kind = auditTypeOf(item.action)
          return (
            <View style={styles.row}>
              <View style={styles.rowHead}>
                <Text style={styles.kind}>{t(`securityAudit.type.${kind}`)}</Text>
                <Text style={styles.time}>{item.createdAt}</Text>
              </View>
              <Text style={styles.action}>{item.action}</Text>
              <Text style={styles.meta}>
                {item.ip ?? '-'}
                {item.userAgent ? ` · ${item.userAgent}` : ''}
              </Text>
            </View>
          )
        }}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    title: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    list: { padding: rnSpacing.md, gap: rnSpacing.sm },
    row: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.lg,
      padding: rnSpacing.md,
      gap: rnSpacing.xs,
    },
    rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    kind: { fontSize: rnType.subtitle.size, fontWeight: '600', color: tk.text.primary },
    time: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    action: { fontSize: rnType.body.size, color: tk.text.primary },
    meta: { fontSize: rnType.caption.size, color: tk.text.tertiary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
