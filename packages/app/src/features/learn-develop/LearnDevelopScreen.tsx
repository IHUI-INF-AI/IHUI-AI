import { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet, type TextStyle, type ViewStyle } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { LearnDevelopScreenProps } from '../../types'

export type { LearnDevelopScreenProps }

export function LearnDevelopScreen({
  t,
  onBack,
  onContact,
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
      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.cardGradientTop} />
          <View style={styles.cardGradientBottom} />
          <View style={styles.cardContent}>
            <View style={styles.benefitsList}>
              <Text style={styles.benefitText}>{t('learnDevelop.comingSoon', { fallback: '课程星球正在开发中' })}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.detailsButton, pressed ? styles.detailsButtonPressed : null]}
              onPress={onContact}
              accessibilityRole="button"
              accessibilityLabel={t('learnDevelop.contactLabel', { fallback: '直接联系李总' })}
            >
              <Text style={styles.detailsButtonText}>{t('learnDevelop.contactLabel', { fallback: '直接联系李总' })}</Text>
            </Pressable>
          </View>
        </View>
      </View>
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
    body: {
      flex: 1,
      backgroundColor: '#cbeaf1',
      alignItems: 'center',
    } as ViewStyle,
    card: {
      width: '90%',
      height: 200,
      marginTop: 75,
      borderRadius: 15,
      overflow: 'hidden',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
    } as ViewStyle,
    cardGradientTop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 70,
      backgroundColor: '#FFE09E',
    } as ViewStyle,
    cardGradientBottom: {
      position: 'absolute',
      top: 70,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#FFFFFF',
    } as ViewStyle,
    cardContent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
    } as ViewStyle,
    benefitsList: {
      width: '80%',
      height: '60%',
      marginTop: 50,
      marginBottom: 20,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    benefitText: {
      fontSize: 25,
      color: '#333333',
      textAlign: 'center',
    } as TextStyle,
    detailsButton: {
      width: 187,
      height: 38,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFAA36',
      elevation: 3,
      shadowColor: '#FFB382',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 5,
    } as ViewStyle,
    detailsButtonPressed: {
      opacity: 0.8,
    } as ViewStyle,
    detailsButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    } as TextStyle,
  })
}
