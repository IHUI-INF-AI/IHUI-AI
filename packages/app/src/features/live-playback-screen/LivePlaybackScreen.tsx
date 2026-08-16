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
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { LivePlaybackScreenItem, LivePlaybackScreenProps } from '../../types'

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
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }
  if (error && items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
          <Text style={styles.retryText}>{t('livePlayback.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
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
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('livePlayback.empty')}</Text>
          </View>
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
              <Text style={styles.playerIcon}>▶</Text>
              <Text style={styles.playerHint}>{t('livePlayback.replayTitle')}</Text>
              {activeItem?.playUrl ? (
                <Text style={styles.playerUrl} numberOfLines={1}>
                  {activeItem.playUrl}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClosePlayer}>
              <Text style={styles.closeBtnText}>{t('common.back')}</Text>
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
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.bg,
      paddingHorizontal: 10,
    },
    muted: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT, textAlign: 'center' },
    retryBtn: {
      marginTop: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
    },
    retryText: { color: tk.surface.light, fontSize: 16 },
    header: { paddingHorizontal: 10, paddingTop: 48, paddingBottom: 8 },
    backText: { fontSize: 16, color: tk.text.secondary },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    userText: { marginTop: 8, fontSize: 11, color: tk.text.tertiary },
    list: { flex: 1, paddingHorizontal: 10 },
    empty: { paddingVertical: 40, alignItems: 'center' },
    emptyText: { fontSize: 14, color: tk.text.tertiary },
    card: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: 10,
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
      marginRight: 8,
    },
    badgeEnded: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
      backgroundColor: tk.surface.card,
    },
    badgeText: { fontSize: 11, color: tk.text.secondary },
    cardMeta: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    cardMetaRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
    cardMetaText: { fontSize: 14, color: tk.text.secondary },
    cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
    playBtn: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
    },
    playBtnDisabled: { backgroundColor: tk.border.medium },
    playBtnText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
    modalOverlay: {
      flex: 1,
      backgroundColor: tk.overlay.modal,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalContent: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: tk.surface.light,
      borderRadius: 16,
      padding: 16,
    },
    modalTitle: { fontSize: 18, fontWeight: '600', color: tk.text.primary, marginBottom: 12 },
    playerArea: {
      aspectRatio: 16 / 9,
      backgroundColor: tk.gray.black,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playerIcon: { fontSize: 36, color: tk.surface.light },
    playerHint: { marginTop: 8, fontSize: 14, color: tk.text.tertiary },
    playerUrl: { marginTop: 8, fontSize: 10, color: tk.text.secondary, paddingHorizontal: 10 },
    closeBtn: {
      marginTop: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
    },
    closeBtnText: { color: tk.surface.light, fontSize: 16, fontWeight: '600' },
  })
}
