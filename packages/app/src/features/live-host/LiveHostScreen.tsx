// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  LiveHostProduct,
  LiveHostStatus,
  LiveHostStreamData,
  LiveHostScreenProps,
} from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'
import { ScreenSkeleton } from '../../components/ScreenStates'

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
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
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
          {status === 'active' ? t('liveHost.previewActive') : t('liveHost.previewIdle')}
        </Text>
      </View>

      <View style={styles.sectionBox}>
        <Text style={styles.sectionLabel}>{t('liveHost.streamTitle')}</Text>
        <TextField
          colorScheme={colorScheme}
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
          style={[
            styles.actionBtn,
            styles.btnSuccess,
            (loading || status !== 'idle') && styles.btnDisabled,
          ]}
          onPress={onStartLive}
          disabled={loading || status !== 'idle'}
        >
          <Text style={styles.actionBtnText}>
            {loading && status === 'idle' ? t('liveHost.starting') : t('liveHost.startLive')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            styles.btnDanger,
            (loading || status !== 'active') && styles.btnDisabled,
          ]}
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
          <ScreenSkeleton variant="list" count={2} colorScheme={colorScheme} />
        ) : null}
        {productsError ? <Text style={styles.productError}>{productsError}</Text> : null}
        <FlatList<LiveHostProduct>
          data={products}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={<Text style={styles.productHint}>{t('liveHost.productEmpty')}</Text>}
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
      gap: rnSpacing.md,
      paddingHorizontal: 10,
      paddingBottom: rnSpacing.sm,
    },
    title: { fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    badge: { paddingHorizontal: rnSpacing.sm, paddingVertical: 2, borderRadius: rnRadius.md },
    badgeText: { fontSize: rnType.caption.size, color: tk.surface.light },
    errorWrap: { paddingHorizontal: 10, paddingVertical: rnSpacing.xs },
    errorText: { fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    previewArea: {
      height: 176,
      marginHorizontal: 10,
      marginTop: rnSpacing.sm,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.gray[900],
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewText: { fontSize: rnType.body.size, color: tk.text.tertiary },
    sectionBox: {
      marginHorizontal: 10,
      marginTop: rnSpacing.md,
      padding: rnSpacing.md,
      borderRadius: rnRadius.xl,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    lastSection: { marginBottom: rnSpacing['3xl'] },
    sectionLabel: {
      fontSize: rnType.body.size,
      color: tk.text.tertiary,
      marginBottom: rnSpacing.sm,
    },
    sectionTitle: {
      fontSize: rnType.subtitle.size,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: 14,
      fontSize: rnType.title.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.muted,
    },
    streamInfo: { marginTop: rnSpacing.sm },
    streamInfoText: {
      fontSize: rnType.body.size,
      color: tk.text.tertiary,
      marginTop: rnSpacing.sm,
    },
    actionRow: {
      flexDirection: 'row',
      gap: rnSpacing.md,
      marginHorizontal: 10,
      marginTop: rnSpacing.md,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: 15,
      borderRadius: rnRadius.sm,
      alignItems: 'center',
    },
    btnSuccess: { backgroundColor: tk.brand.cta },
    btnDanger: { backgroundColor: tk.danger.DEFAULT },
    btnDisabled: { opacity: 0.5 },
    actionBtnText: {
      color: tk.brand.ctaForeground,
      fontSize: rnType.title.size,
      fontWeight: '600',
    },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap' },
    statItem: { width: '50%', marginBottom: rnSpacing.sm },
    statLabel: { fontSize: rnType.body.size, color: tk.text.tertiary },
    statValue: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    productHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: rnSpacing.sm,
    },
    productAddBtn: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.card,
    },
    productAddText: { fontSize: rnType.body.size, color: tk.success.DEFAULT },
    productHint: {
      fontSize: rnType.body.size,
      color: tk.text.tertiary,
      paddingVertical: rnSpacing.sm,
      textAlign: 'center',
    },
    productError: {
      fontSize: rnType.body.size,
      color: tk.danger.DEFAULT,
      paddingVertical: rnSpacing.sm,
      textAlign: 'center',
    },
    productItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: rnSpacing.sm,
    },
    productName: {
      flex: 1,
      fontSize: rnType.title.size,
      color: tk.text.primary,
      marginRight: rnSpacing.sm,
    },
    productPrice: { fontSize: rnType.title.size, fontWeight: '600', color: tk.danger.DEFAULT },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
