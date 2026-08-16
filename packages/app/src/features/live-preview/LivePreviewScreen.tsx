import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { LivePreviewItem, LivePreviewScreenProps } from '../../types'

/** 直播预告共享屏 — props 注入式跨端组件(纯 UI,API 调用由 wrapper 注入) */
export type { LivePreviewItem, LivePreviewScreenProps }

export function LivePreviewScreen({
  t,
  item,
  loading,
  error,
  subscribing,
  onSubscribe,
  onBack,
  colorScheme = 'light',
}: LivePreviewScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }
  if (error || !item) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || t('livePreview.empty')}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const btnDisabled = item.subscribed || subscribing

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('livePreview.title')}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.liveTitle}>{item.title}</Text>
        <Text style={styles.meta}>
          {t('livePreview.lecturer')}: {item.lecturer}
        </Text>
        <Text style={styles.meta}>
          {t('livePreview.startAt')}: {item.startAt}
        </Text>
        <Text style={styles.intro}>{item.intro}</Text>
        <TouchableOpacity
          style={[styles.btn, btnDisabled && styles.btnDisabled]}
          onPress={onSubscribe}
          disabled={btnDisabled}
        >
          <Text style={styles.btnText}>
            {item.subscribed
              ? t('livePreview.subscribed')
              : subscribing
                ? t('livePreview.subscribing')
                : t('livePreview.subscribe')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      backgroundColor: tk.surface.bg,
    },
    muted: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT, textAlign: 'center' },
    backBtn: { marginTop: 12 },
    backText: { fontSize: 16, color: tk.text.medium },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 10,
      paddingVertical: 12,
    },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    body: { padding: 10 },
    liveTitle: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    meta: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    intro: { marginTop: 12, fontSize: 16, color: tk.text.medium, lineHeight: 22 },
    btn: {
      marginTop: 20,
      backgroundColor: tk.brand.DEFAULT,
      paddingVertical: 15,
      borderRadius: 12,
      alignItems: 'center',
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: tk.surface.light, fontSize: 16, fontWeight: '600' },
  })
}
