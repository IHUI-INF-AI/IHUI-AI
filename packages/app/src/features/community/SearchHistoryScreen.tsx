// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Clock, History, Search, Trash2 } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

/**
 * 搜索历史共享屏 —— 承载 web /search/history(同口径:清空全部、逐条删除、结果数与时间元信息)。
 * 降级说明(如实):RN 的 Search 路由为无参路由(RootNavigator `Search: undefined`,本包禁改),
 * web 行点击「带词重搜」不可复刻 ⇒ 行为只读展示,删除/清空两腿全真。
 * 平台无关:GET/DELETE /api/search/history 与时间 Intl 格式化由薄壳注入。
 */
export interface SearchHistoryRowView {
  id: string
  query: string
  /** 薄壳按 web 同参格式化(locale,MM/DD HH:mm)+ resultCount 文案已拼好 */
  metaText: string
}

export interface SearchHistoryScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(与 web useAuthGate 同口径) */
  loginRequiredText: string
  loading: boolean
  error: string | null
  rows: SearchHistoryRowView[]
  clearPending: boolean
  deletingId: string | null
  onClearAll: () => void
  onDelete: (id: string) => void
}

export function SearchHistoryScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  error,
  rows,
  clearPending,
  deletingId,
  onClearAll,
  onDelete,
}: SearchHistoryScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron
          onPress={onBack}
          label={t('searchHistoryPage.back')}
          colorScheme={colorScheme}
        />
        <View style={styles.titleBox}>
          <View style={styles.titleRow}>
            <History size={20} color={tk.brand.DEFAULT} />
            <Text style={styles.title}>{t('searchHistoryPage.title')}</Text>
          </View>
          <Text style={styles.subtitle}>{t('searchHistoryPage.subtitle')}</Text>
        </View>
        {rows.length > 0 && !loginRequiredText ? (
          <TouchableOpacity style={styles.clearBtn} onPress={onClearAll} disabled={clearPending}>
            <Trash2 size={14} color={tk.text.primary} />
            <Text style={styles.clearText}>{t('searchHistoryPage.clearAll')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
          <Text style={styles.muted}>{t('searchHistoryPage.loading')}</Text>
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : rows.length === 0 ? (
        <View style={styles.centerBlock}>
          <Search size={30} color={tk.text.tertiary} />
          <Text style={styles.muted}>{t('searchHistoryPage.empty')}</Text>
        </View>
      ) : (
        <View style={styles.listCard}>
          {rows.map((item) => (
            <View key={item.id} style={styles.row}>
              <Clock size={15} color={tk.text.secondary} />
              <View style={styles.rowMain}>
                <Text style={styles.rowQuery}>{item.query}</Text>
                <Text style={styles.rowMeta}>{item.metaText}</Text>
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => onDelete(item.id)}
                disabled={deletingId !== null}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {deletingId === item.id ? (
                  <ActivityIndicator size="small" color={tk.text.tertiary} />
                ) : (
                  <Trash2 size={15} color={tk.text.secondary} />
                )}
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.md },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      marginTop: rnSpacing.md,
    },
    titleBox: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 2, fontSize: rnType.label.size, color: tk.text.secondary },
    clearBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
    },
    clearText: { fontSize: rnType.label.size, color: tk.text.primary, fontWeight: '500' },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    centerBlock: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    error: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    listCard: {
      marginTop: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      padding: rnSpacing.sm,
      marginBottom: 24,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.md,
    },
    rowMain: { flex: 1, gap: 2 },
    rowQuery: { fontSize: rnType.body.size, fontWeight: '500', color: tk.text.primary },
    rowMeta: { fontSize: rnType.caption.size, color: tk.text.secondary },
    deleteBtn: { padding: rnSpacing.xs },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
