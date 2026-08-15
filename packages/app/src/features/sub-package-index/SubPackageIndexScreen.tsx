import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Pressable,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { SubPackageIndexScreenProps, SubPackageEntry } from '../../types'

/** Props 类型 re-export(单一来源 @ihui/types) */
export type { SubPackageIndexScreenProps, SubPackageEntry }

/**
 * 子包功能入口聚合页共享屏 — 纯 UI 渲染,平台无关
 *
 * 渲染网格导航入口
 * 导航/数据由 wrapper 通过 props 注入
 */
export function SubPackageIndexScreen({
  t,
  onBack,
  entries,
  colorScheme = 'light',
}: SubPackageIndexScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>更多功能</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {entries.map((entry: SubPackageEntry) => (
            <Pressable
              key={entry.title}
              style={({ pressed }) => [styles.entryCard, pressed ? styles.entryCardPressed : null]}
              onPress={entry.onPress}
              accessibilityRole="button"
              accessibilityLabel={entry.title}
            >
              <Text style={styles.entryIcon}>{entry.icon}</Text>
              <Text style={styles.entryTitle} numberOfLines={1}>
                {entry.title}
              </Text>
              <Text style={styles.entryDesc} numberOfLines={2}>
                {entry.desc}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg } as ViewStyle,
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    } as ViewStyle,
    backText: { fontSize: 14, color: tk.text.medium } as TextStyle,
    headerTitle: { fontSize: 18, fontWeight: '600', color: tk.text.primary } as TextStyle,
    scrollContent: { paddingHorizontal: 16, paddingVertical: 12 } as ViewStyle,
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } as ViewStyle,
    entryCard: {
      width: '47%',
      backgroundColor: tk.surface.card,
      borderRadius: 12,
      padding: 14,
      gap: 6,
      alignItems: 'center',
    } as ViewStyle,
    entryCardPressed: { backgroundColor: tk.surface.muted } as ViewStyle,
    entryIcon: { fontSize: 32 } as TextStyle,
    entryTitle: { fontSize: 14, fontWeight: '600', color: tk.text.primary } as TextStyle,
    entryDesc: {
      fontSize: 12,
      color: tk.text.tertiary,
      textAlign: 'center',
      lineHeight: 16,
    } as TextStyle,
  })
}
