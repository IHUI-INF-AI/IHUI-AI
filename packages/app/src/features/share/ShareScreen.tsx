// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ShareScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'

/** 分享共享屏 — props 注入式跨端组件(平台侧 onShare 注入原生 Share API) */
export type { ShareScreenProps }

export function ShareScreen({
  t,
  targetTitle,
  remark,
  result,
  loading,
  error,
  onRemarkChange,
  onCreate,
  onShare,
  onBack,
  colorScheme = 'light',
  renderHeader,
  renderContent,
  renderFooter,
  containerStyle,
  contentStyle,
}: ShareScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const mergedContainerStyle = [styles.container, containerStyle]
  const mergedContentStyle = [styles.content, contentStyle]

  return (
    <View style={mergedContainerStyle}>
      {renderHeader ? (
        renderHeader()
      ) : (
        <>
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.title}>{t('share.title')}</Text>
          <Text style={styles.targetTitle}>{targetTitle}</Text>
        </>
      )}
      {renderContent ? (
        renderContent()
      ) : (
        <ScrollView contentContainerStyle={mergedContentStyle} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>{t('share.remark')}</Text>
          <TextField
            colorScheme={colorScheme}
            style={styles.input}
            value={remark}
            onChangeText={onRemarkChange}
            placeholder={t('share.remarkPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
          />
          <TouchableOpacity
            style={[styles.createBtn, loading && styles.btnDisabled]}
            onPress={onCreate}
            disabled={loading}
          >
            <Text style={styles.createText}>
              {loading ? t('common.loading') : t('share.create')}
            </Text>
          </TouchableOpacity>
          {loading ? <Text style={styles.muted}>{t('common.loading')}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {result ? (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>{t('share.url')}</Text>
              <Text style={styles.cardValue} numberOfLines={1} selectable>
                {result.shareUrl}
              </Text>
              <Text style={styles.cardLabel}>{t('share.code')}</Text>
              <Text style={styles.cardValue} selectable>
                {result.shareCode}
              </Text>
              <Text style={styles.cardLabel}>{t('share.expireAt')}</Text>
              <Text style={styles.cardValue}>{result.expireAt}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
      {renderFooter ? (
        renderFooter()
      ) : result ? (
        <View style={styles.shareBtnWrap}>
          <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
            <Text style={styles.shareText}>{t('share.shareNow')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    content: { flexGrow: 1 },
    title: {
      marginTop: rnSpacing.sm,
      fontSize: 22,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.sm,
    },
    targetTitle: {
      fontSize: rnType.title.size,
      color: tk.text.primary,
      marginBottom: rnSpacing.md,
    },
    label: { marginTop: rnSpacing.md, fontSize: rnType.body.size, color: tk.text.secondary },
    input: {
      marginTop: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: 14,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: rnType.title.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.muted,
    },
    createBtn: {
      marginTop: rnSpacing.lg,
      paddingVertical: 15,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
    },
    btnDisabled: { backgroundColor: tk.text.tertiary },
    createText: { color: tk.brand.ctaForeground, fontSize: rnType.title.size, fontWeight: '600' },
    muted: {
      marginTop: rnSpacing.md,
      fontSize: rnType.body.size,
      color: tk.text.secondary,
      textAlign: 'center',
    },
    error: { marginTop: rnSpacing.md, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    card: {
      marginTop: rnSpacing.lg,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    cardLabel: { marginTop: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.text.tertiary },
    cardValue: { marginTop: rnSpacing.sm, fontSize: rnType.title.size, color: tk.text.primary },
    shareBtnWrap: { paddingHorizontal: 10, paddingVertical: rnSpacing.md },
    shareBtn: {
      paddingVertical: 15,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
    },
    shareText: { color: tk.brand.ctaForeground, fontSize: rnType.title.size, fontWeight: '600' },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
