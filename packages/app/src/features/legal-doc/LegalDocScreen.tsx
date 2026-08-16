import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { LegalDocSection, LegalDocScreenProps } from '../../types'

/** 法律文档/Props 类型 re-export(单一来源 @ihui/types) */
export type { LegalDocSection, LegalDocScreenProps }

/**
 * 法律文档共享屏 — 通用静态页(隐私政策/用户协议/Cookie 政策等)
 *
 * 平台无关:负责渲染 header(返回 + 标题)+ 副标题卡片(updatedAt)+ sections 列表。
 * 平台特定(导航)由 wrapper 通过 props 注入。
 */
export function LegalDocScreen({
  t,
  title,
  subtitle,
  updatedAt,
  sections,
  onBack,
  colorScheme = 'light',
}: LegalDocScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <Text style={styles.updatedAt}>
            {t('legalDoc.updatedAt')}: {updatedAt}
          </Text>
        </View>
        {sections.map((section: LegalDocSection) => (
          <View key={section.title} style={styles.card}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    body: { padding: 14, paddingBottom: 32 },
    card: {
      padding: 14,
      marginBottom: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    subtitle: { fontSize: 14, color: tk.text.secondary },
    updatedAt: { marginTop: 8, fontSize: 11, color: tk.text.tertiary },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    sectionBody: { marginTop: 8, fontSize: 14, color: tk.text.medium, lineHeight: 18 },
  })
}
