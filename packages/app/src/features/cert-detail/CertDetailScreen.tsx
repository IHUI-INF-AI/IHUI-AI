/** 证书详情共享屏 — props 注入式跨端组件 */
import { useMemo } from 'react'
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CertDetailScreenProps } from '../../types'

/**
 * 证书详情共享屏 — 平台无关 UI 渲染。
 *
 * 负责 loading / error / null 三态 + 正常态 ScrollView 卡片渲染
 * (header 返回 + 标题 + 证书信息卡片 + 验证按钮)。
 * 平台特定(导航 / API 调用 / 跳转验证页)由 wrapper 通过 props 注入。
 */
export function CertDetailScreen({
  t,
  item,
  loading,
  error,
  onBack,
  onVerify,
  colorScheme = 'light',
}: CertDetailScreenProps) {
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
        <Text style={styles.error}>{error || t('certDetail.loadFailed')}</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('certDetail.title')}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.certTitle}>{item.title}</Text>
          <Text style={styles.certNo}>
            {t('certDetail.certNo')}: {item.certNo}
          </Text>
          <View style={styles.divider} />
          <Text style={styles.label}>{t('certDetail.holder')}</Text>
          <Text style={styles.value}>{item.holder}</Text>
          <Text style={styles.label}>{t('certDetail.issuer')}</Text>
          <Text style={styles.value}>{item.issuer}</Text>
          <Text style={styles.label}>{t('certDetail.score')}</Text>
          <Text style={styles.value}>{item.score}</Text>
          <Text style={styles.label}>{t('certDetail.issuedAt')}</Text>
          <Text style={styles.value}>{item.issuedAt}</Text>
          {item.expiredAt ? (
            <>
              <Text style={styles.label}>{t('certDetail.expiredAt')}</Text>
              <Text style={styles.value}>{item.expiredAt}</Text>
            </>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.verifyBtn}
          onPress={() => onVerify?.(item.certNo)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.verifyText}>{t('certDetail.verify')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
    body: { padding: 10 },
    back: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    card: {
      borderWidth: 2,
      borderColor: tk.success.DEFAULT,
      backgroundColor: `${tk.success.DEFAULT}1A`,
      padding: 12,
      borderRadius: 12,
    },
    certTitle: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    certNo: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    divider: {
      marginVertical: 12,
      height: 1,
      backgroundColor: tk.success.DEFAULT,
    },
    label: { marginTop: 8, fontSize: 11, color: tk.text.tertiary },
    value: { marginTop: 8, fontSize: 16, color: tk.text.primary },
    verifyBtn: {
      marginTop: 16,
      alignSelf: 'center',
      borderWidth: 1,
      borderColor: tk.success.DEFAULT,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 12,
    },
    verifyText: { fontSize: 16, fontWeight: '600', color: tk.success.DEFAULT },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    muted: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
    error: { fontSize: 14, color: tk.danger.DEFAULT, textAlign: 'center' },
    backBtn: { marginTop: 12 },
  })
}
