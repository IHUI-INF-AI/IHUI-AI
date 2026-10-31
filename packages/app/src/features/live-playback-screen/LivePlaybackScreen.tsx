// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { ChevronLeft, Play } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { LivePlaybackScreenItem, LivePlaybackScreenProps } from '../../types'

import { rnRadius, rnSpacing } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/** 直播回放共享屏 — props 注入式跨端组件(纯 UI,API/Modal 状态由 wrapper 注入) */
export type { LivePlaybackScreenItem, LivePlaybackScreenProps }

export function LivePlaybackScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  activeItem,
  userName,
  onRefresh,
  onPressItem,
  onClosePlayer,
  onBack,
  colorScheme = 'light',
}: LivePlaybackScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading && items.length === 0) {
    return <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
  }
  if (error && items.length === 0) {
    return (
      <ErrorState
        message={error}
        onRetry={onRefresh}
        retryLabel={t('livePlayback.retry') || undefined}
        colorScheme={colorScheme}
      />
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('livePlayback.title')}</Text>
        <Text style={styles.subtitle}>{t('livePlayback.subtitle')}</Text>
        {userName ? <Text style={styles.userText}>{userName}</Text> : null}
      </View>

      <FlatList<LivePlaybackScreenItem>
        style={styles.list}
        data={items}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <EmptyState title={t('livePlayback.empty')} colorScheme={colorScheme} />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.badgeEnded}>
                <Text style={styles.badgeText}>{t('livePlayback.ended')}</Text>
              </View>
            </View>
            {item.lecturerName ? (
              <Text style={styles.cardMeta}>
                {t('livePlayback.lecturer')}:{item.lecturerName}
              </Text>
            ) : null}
            <Text style={styles.cardMeta}>
              {t('livePlayback.startAt')}:{item.startTimeText || '—'}
            </Text>
            <View style={styles.cardMetaRow}>
              <Text style={styles.cardMetaText}>
                {t('livePlayback.duration')}:{item.durationText}
              </Text>
              <Text style={styles.cardMetaText}>
                {t('livePlayback.viewerCount', { count: item.viewCount })}
              </Text>
            </View>
            <View style={styles.cardFooter}>
              <TouchableOpacity
                style={[styles.playBtn, !item.playUrl && styles.playBtnDisabled]}
                onPress={() => onPressItem(item)}
                disabled={!item.playUrl}
              >
                <Text style={styles.playBtnText}>
                  {item.playUrl ? t('livePlayback.play') : t('livePlayback.noReplay')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal
        visible={!!activeItem}
        animationType="slide"
        transparent
        onRequestClose={onClosePlayer}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{activeItem?.title}</Text>
            <View style={styles.playerArea}>
              <Play size={36} color={tk.surface.light} />
              <Text style={styles.playerHint}>{t('livePlayback.replayTitle')}</Text>
              {activeItem?.playUrl ? (
                <Text style={styles.playerUrl} numberOfLines={1}>
                  {activeItem.playUrl}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClosePlayer}
              accessibilityLabel={t('common.back')}
            >
              <ChevronLeft size={16} color={tk.brand.ctaForeground} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: rnSpacing['sm-loose'], paddingBottom: rnSpacing.sm },
    title: { marginTop: rnSpacing.sm, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: rnSpacing.sm, fontSize: 14, color: tk.text.secondary },
    userText: { marginTop: rnSpacing.sm, fontSize: 11, color: tk.text.tertiary },
    list: { flex: 1, paddingHorizontal: rnSpacing['sm-loose'] },
    card: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: rnSpacing['sm-loose'],
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    cardTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
      marginRight: rnSpacing.sm,
    },
    badgeEnded: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.card,
    },
    badgeText: { fontSize: 11, color: tk.text.secondary },
    cardMeta: { marginTop: rnSpacing.sm, fontSize: 14, color: tk.text.secondary },
    cardMetaRow: { flexDirection: 'row', gap: rnSpacing.md, marginTop: rnSpacing.sm },
    cardMetaText: { fontSize: 14, color: tk.text.secondary },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: rnSpacing['sm-loose'],
    },
    playBtn: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    playBtnDisabled: { backgroundColor: tk.border.medium },
    playBtnText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
    modalOverlay: {
      flex: 1,
      backgroundColor: tk.overlay.modal,
      justifyContent: 'center',
      alignItems: 'center',
      padding: rnSpacing.lg,
    },
    modalContent: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius['2xl'],
      padding: rnSpacing.lg,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.md,
    },
    playerArea: {
      aspectRatio: 16 / 9,
      backgroundColor: tk.gray.black,
      borderRadius: rnRadius.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playerIcon: { fontSize: 36, color: tk.surface.light },
    playerHint: { marginTop: rnSpacing.sm, fontSize: 14, color: tk.text.tertiary },
    playerUrl: {
      marginTop: rnSpacing.sm,
      fontSize: 10,
      color: tk.text.secondary,
      paddingHorizontal: rnSpacing['sm-loose'],
    },
    closeBtn: {
      marginTop: rnSpacing.md,
      paddingVertical: rnSpacing['sm-loose'],
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
