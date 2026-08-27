import { useMemo } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { LearnDevelopEntry, LearnDevelopScreenProps } from '../../types'

export type { LearnDevelopEntry, LearnDevelopScreenProps }

/**
 * LearnDevelopScreen 学习导航页(共享层,平台无关 UI)
 *
 * 由端侧 wrapper 通过 props 注入真实学习功能入口(课程星球/学习计划/知识星球等卡片)与跳转,
 * 不再是「课程星球正在开发中」占位桩。卡片列表仅渲染端侧传入的 entries。
 */
export function LearnDevelopScreen({
  t,
  onBack,
  onContact,
  entries = [],
  colorScheme = 'light',
}: LearnDevelopScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('learnDevelop.title', { fallback: '学习开发' })}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {entries.map((entry: LearnDevelopEntry) => (
            <Pressable
              key={entry.title}
              style={({ pressed }) => [styles.entryCard, pressed ? styles.entryCardPressed : null]}
              onPress={entry.onPress}
              accessibilityRole="button"
              accessibilityLabel={entry.title}
            >
              {typeof entry.icon === 'string' ? (
                <Text style={styles.entryIcon}>{entry.icon}</Text>
              ) : entry.icon ? (
                <entry.icon size={32} color={tk.text.primary} />
              ) : null}
              <Text style={styles.entryTitle} numberOfLines={1}>
                {entry.title}
              </Text>
              <Text style={styles.entryDesc} numberOfLines={2}>
                {entry.desc}
              </Text>
            </Pressable>
          ))}
        </View>
        {onContact ? (
          <Pressable
            style={({ pressed }) => [
              styles.detailsButton,
              pressed ? styles.detailsButtonPressed : null,
            ]}
            onPress={onContact}
            accessibilityRole="button"
            accessibilityLabel={t('learnDevelop.contactLabel', { fallback: '直接联系李总' })}
          >
            <Text style={styles.detailsButtonText}>
              {t('learnDevelop.contactLabel', { fallback: '直接联系李总' })}
            </Text>
          </Pressable>
        ) : null}
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
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    } as ViewStyle,
    backText: { fontSize: 16, color: tk.text.medium } as TextStyle,
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary } as TextStyle,
    scrollContent: { paddingHorizontal: 10, paddingVertical: 12, paddingBottom: 24 } as ViewStyle,
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } as ViewStyle,
    entryCard: {
      width: '47%',
      backgroundColor: tk.surface.light,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      padding: 14,
      gap: 6,
      alignItems: 'center',
    } as ViewStyle,
    entryCardPressed: { backgroundColor: tk.surface.muted } as ViewStyle,
    entryIcon: { fontSize: 32 } as TextStyle,
    entryTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary } as TextStyle,
    entryDesc: {
      fontSize: 14,
      color: tk.text.tertiary,
      textAlign: 'center',
      lineHeight: 16,
    } as TextStyle,
    detailsButton: {
      alignSelf: 'center',
      width: 187,
      height: 38,
      marginTop: 24,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.warning.amber,
      elevation: 3,
      shadowColor: tk.warning.amberLight,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 5,
    } as ViewStyle,
    detailsButtonPressed: { opacity: 0.8 } as ViewStyle,
    detailsButtonText: { fontSize: 16, fontWeight: '700', color: tk.text.primary } as TextStyle,
  })
}
