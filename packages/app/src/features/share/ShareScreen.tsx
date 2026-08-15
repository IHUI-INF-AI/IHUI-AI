import { useMemo } from 'react'
import { ScrollView, Text, TouchableOpacity, View, StyleSheet, TextInput } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ShareScreenProps } from '../../types'

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
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.back}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('share.title')}</Text>
          <Text style={styles.targetTitle}>{targetTitle}</Text>
        </>
      )}
      {renderContent ? (
        renderContent()
      ) : (
        <ScrollView contentContainerStyle={mergedContentStyle} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>{t('share.remark')}</Text>
          <TextInput
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
              <Text style={styles.cardValue} numberOfLines={1} selectable>{result.shareUrl}</Text>
              <Text style={styles.cardLabel}>{t('share.code')}</Text>
              <Text style={styles.cardValue} selectable>{result.shareCode}</Text>
              <Text style={styles.cardLabel}>{t('share.expireAt')}</Text>
              <Text style={styles.cardValue}>{result.expireAt}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
      {renderFooter ? (
        renderFooter()
      ) : (
        result ? (
          <View style={styles.shareBtnWrap}>
            <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
              <Text style={styles.shareText}>{t('share.shareNow')}</Text>
            </TouchableOpacity>
          </View>
        ) : null
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    content: { flexGrow: 1 },
    back: { fontSize: 14, color: tk.text.secondary },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary, marginBottom: 4 },
    targetTitle: { fontSize: 14, color: tk.success.DEFAULT, marginBottom: 12 },
    label: { marginTop: 12, fontSize: 12, color: tk.text.secondary },
    input: { marginTop: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: tk.border.light, fontSize: 14, color: tk.text.primary },
    createBtn: { marginTop: 16, paddingVertical: 12, borderRadius: 8, backgroundColor: tk.success.DEFAULT, alignItems: 'center' },
    btnDisabled: { backgroundColor: tk.text.tertiary },
    createText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
    muted: { marginTop: 12, fontSize: 13, color: tk.text.secondary, textAlign: 'center' },
    error: { marginTop: 12, fontSize: 13, color: tk.danger.DEFAULT },
    card: { marginTop: 16, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: tk.border.light },
    cardLabel: { marginTop: 8, fontSize: 11, color: tk.text.tertiary },
    cardValue: { marginTop: 2, fontSize: 14, color: tk.text.primary },
    shareBtnWrap: { paddingHorizontal: 16, paddingVertical: 12 },
    shareBtn: { paddingVertical: 12, borderRadius: 8, backgroundColor: tk.success.DEFAULT, alignItems: 'center' },
    shareText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
  })
}
