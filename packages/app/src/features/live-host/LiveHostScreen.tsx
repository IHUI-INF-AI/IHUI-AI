import { useMemo } from 'react'
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  LiveHostProduct,
  LiveHostStatus,
  LiveHostStreamData,
  LiveHostScreenProps,
} from '../../types'

/** 主播端共享屏 — props 注入式跨端组件(纯 UI,推流/SRS API 由 wrapper 注入) */
export type { LiveHostProduct, LiveHostStatus, LiveHostStreamData, LiveHostScreenProps }

/** 状态徽章颜色:idle=灰 / active=绿 / inactive=深灰 */
function statusBadgeColor(status: LiveHostStatus, tk: AppThemeTokens): string {
  switch (status) {
    case 'active':
      return tk.success.DEFAULT
    case 'inactive':
      return tk.gray[400]
    default:
      return tk.border.medium
  }
}

/** 状态徽章文案 key:idle=未开始 / active=直播中 / inactive=已结束 */
function statusBadgeLabelKey(status: LiveHostStatus): string {
  switch (status) {
    case 'active':
      return 'liveHost.statusActive'
    case 'inactive':
      return 'liveHost.statusInactive'
    default:
      return 'liveHost.statusIdle'
  }
}

export function LiveHostScreen({
  t,
  status,
  streamTitle,
  onStreamTitleChange,
  stream,
  viewers,
  durationText,
  recvBytesText,
  sendBytesText,
  loading,
  error,
  products,
  productsLoading,
  productsError,
  onStartLive,
  onEndLive,
  onAddProduct,
  onCopyText,
  onBack,
  colorScheme = 'light',
}: LiveHostScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const badgeColor = statusBadgeColor(status, tk)
  const stats: { label: string; value: string }[] = [
    { label: t('liveHost.statDuration'), value: durationText },
    { label: t('liveHost.statViewers'), value: String(viewers) },
    { label: t('liveHost.statRecvBytes'), value: recvBytesText },
    { label: t('liveHost.statSendBytes'), value: sendBytesText },
  ]

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('liveHost.title')}</Text>
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{t(statusBadgeLabelKey(status))}</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.previewArea}>
        <Text style={styles.previewText}>
          {status === 'active'
            ? t('liveHost.previewActive')
            : t('liveHost.previewIdle')}
        </Text>
      </View>

      <View style={styles.sectionBox}>
        <Text style={styles.sectionLabel}>{t('liveHost.streamTitle')}</Text>
        <TextInput
          style={styles.input}
          value={streamTitle}
          onChangeText={onStreamTitleChange}
          placeholder={t('liveHost.streamTitlePlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          editable={status === 'idle'}
        />
        {stream ? (
          <View style={styles.streamInfo}>
            <TouchableOpacity
              onPress={() => stream.pushUrl && onCopyText(stream.pushUrl, t('liveHost.pushUrl'))}
            >
              <Text style={styles.streamInfoText} numberOfLines={1}>
                {t('liveHost.pushUrl')}:{stream.pushUrl || '—'}({t('liveHost.copyHint')})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onCopyText(stream.streamKey, t('liveHost.streamKey'))}>
              <Text style={styles.streamInfoText} numberOfLines={1}>
                {t('liveHost.streamKey')}:{stream.streamKey}({t('liveHost.copyHint')})
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.btnSuccess, (loading || status !== 'idle') && styles.btnDisabled]}
          onPress={onStartLive}
          disabled={loading || status !== 'idle'}
        >
          <Text style={styles.actionBtnText}>
            {loading && status === 'idle' ? t('liveHost.starting') : t('liveHost.startLive')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.btnDanger, (loading || status !== 'active') && styles.btnDisabled]}
          onPress={onEndLive}
          disabled={loading || status !== 'active'}
        >
          <Text style={styles.actionBtnText}>
            {loading && status === 'active' ? t('liveHost.ending') : t('liveHost.endLive')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionBox}>
        <Text style={styles.sectionTitle}>{t('liveHost.stats')}</Text>
        <View style={styles.statsRow}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statItem}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.sectionBox, styles.lastSection]}>
        <View style={styles.productHeader}>
          <Text style={styles.sectionTitle}>{t('liveHost.productManage')}</Text>
          <TouchableOpacity onPress={onAddProduct} style={styles.productAddBtn}>
            <Text style={styles.productAddText}>{t('liveHost.productAddBtn')}</Text>
          </TouchableOpacity>
        </View>
        {productsLoading ? (
          <Text style={styles.productHint}>{t('liveHost.productLoading')}</Text>
        ) : null}
        {productsError ? (
          <Text style={styles.productError}>{productsError}</Text>
        ) : null}
        <FlatList<LiveHostProduct>
          data={products}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text style={styles.productHint}>{t('liveHost.productEmpty')}</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.productItem}>
              <Text style={styles.productName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.productPrice}>¥{item.price}</Text>
            </View>
          )}
        />
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
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 48,
      paddingBottom: 8,
    },
    back: { fontSize: 14, color: tk.text.secondary },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    badgeText: { fontSize: 11, color: tk.surface.light },
    errorWrap: { paddingHorizontal: 16, paddingVertical: 4 },
    errorText: { fontSize: 12, color: tk.danger.DEFAULT },
    previewArea: {
      height: 176,
      marginHorizontal: 16,
      marginTop: 8,
      borderRadius: 12,
      backgroundColor: tk.gray[900],
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewText: { fontSize: 13, color: tk.text.tertiary },
    sectionBox: {
      marginHorizontal: 16,
      marginTop: 12,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    lastSection: { marginBottom: 32 },
    sectionLabel: { fontSize: 12, color: tk.text.tertiary, marginBottom: 4 },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: tk.text.primary, marginBottom: 8 },
    input: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: tk.text.primary,
    },
    streamInfo: { marginTop: 8 },
    streamInfoText: { fontSize: 12, color: tk.text.tertiary, marginTop: 4 },
    actionRow: {
      flexDirection: 'row',
      gap: 12,
      marginHorizontal: 16,
      marginTop: 12,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    btnSuccess: { backgroundColor: tk.success.DEFAULT },
    btnDanger: { backgroundColor: tk.danger.DEFAULT },
    btnDisabled: { opacity: 0.5 },
    actionBtnText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap' },
    statItem: { width: '50%', marginBottom: 8 },
    statLabel: { fontSize: 12, color: tk.text.tertiary },
    statValue: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    productHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    productAddBtn: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
    },
    productAddText: { fontSize: 12, color: tk.success.DEFAULT },
    productHint: { fontSize: 12, color: tk.text.tertiary, paddingVertical: 8, textAlign: 'center' },
    productError: { fontSize: 12, color: tk.danger.DEFAULT, paddingVertical: 8, textAlign: 'center' },
    productItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
    },
    productName: { flex: 1, fontSize: 14, color: tk.text.primary, marginRight: 8 },
    productPrice: { fontSize: 14, fontWeight: '600', color: tk.danger.DEFAULT },
  })
}
