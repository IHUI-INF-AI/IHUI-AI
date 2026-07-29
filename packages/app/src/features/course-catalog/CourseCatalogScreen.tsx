import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CourseCatalogItem, CourseCatalogScreenProps } from '../../types'

/** 课程目录/Props 类型 re-export(单一来源 @ihui/types) */
export type { CourseCatalogItem, CourseCatalogScreenProps }

/**
 * 课程目录共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题)+ 错误提示(可选)+ loading 态
 * + 章节列表(序号 + 标题 + type·duration 元数据)+ 空态。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function CourseCatalogScreen({
  t,
  items,
  loading,
  error,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: CourseCatalogScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('courseCatalog.title')}</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listBody}>
          {items.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.muted}>{t('courseCatalog.empty')}</Text>
            </View>
          ) : (
            items.map((item: CourseCatalogItem, index: number) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => onPressItem(item)}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <View style={styles.card}>
                  <View style={styles.cardHead}>
                    <Text style={styles.indexText}>{index + 1}</Text>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </View>
                  <Text style={styles.metaText}>
                    {item.type} · {t('courseCatalog.duration', { n: item.duration })}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    errorText: { paddingHorizontal: 16, fontSize: 12, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 16 },
    card: {
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: 8,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    indexText: {
      width: 24,
      fontSize: 14,
      fontWeight: '600',
      color: tk.indigo.DEFAULT,
    },
    cardTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: tk.text.primary,
    },
    metaText: {
      marginTop: 6,
      marginLeft: 32,
      fontSize: 11,
      color: tk.text.tertiary,
    },
  })
}
