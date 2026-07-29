import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  LecturerDetailCourse,
  LecturerDetailInfo,
  LecturerDetailScreenProps,
} from '../../types'

/** 讲师详情共享屏 — props 注入式跨端组件 */
export type { LecturerDetailCourse, LecturerDetailInfo, LecturerDetailScreenProps }

export function LecturerDetailScreen({
  t,
  info,
  courses,
  loading,
  refreshing,
  error,
  followLoading,
  onRefresh,
  onFollow,
  onRetry,
  onBack,
  colorScheme = 'light',
}: LecturerDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && !info) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.retryBtnText}>{t('lecturerDetail.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <FlatList<LecturerDetailCourse>
      data={courses}
      keyExtractor={(item) => item.id}
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <View style={styles.header}>
            <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.backText}>{t('common.back')}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{t('lecturerDetail.title')}</Text>
            <Text style={styles.subtitle}>{t('lecturerDetail.subtitle')}</Text>
          </View>

          {info ? (
            <View style={styles.profileCard}>
              <Text style={styles.name}>{info.nickname}</Text>
              <Text style={styles.bio}>
                {info.bio || t('lecturerDetail.empty')}
              </Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{info.courseCount}</Text>
                  <Text style={styles.statLabel}>{t('lecturerDetail.courses')}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{info.studentCount}</Text>
                  <Text style={styles.statLabel}>{t('lecturerDetail.students')}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{info.followers}</Text>
                  <Text style={styles.statLabel}>{t('lecturerDetail.followers')}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.followBtn, info.isFollowing && styles.followingBtn]}
                onPress={onFollow}
                disabled={followLoading}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Text
                  style={[
                    styles.followBtnText,
                    info.isFollowing && styles.followingBtnText,
                  ]}
                >
                  {info.isFollowing
                    ? t('lecturerDetail.unfollowBtn')
                    : t('lecturerDetail.followBtn')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>{t('lecturerDetail.courses')}</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t('lecturerDetail.empty')}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.cardMetaRow}>
            <Text style={styles.cardMetaText}>
              {t('lecturerDetail.level')}: {item.level}
            </Text>
            <Text style={styles.cardMetaText}>
              {t('lecturerDetail.studentCount', { count: item.studentCount })}
            </Text>
            <Text style={styles.priceText}>
              {item.price === 0 ? t('lecturerDetail.free') : `¥${item.price}`}
            </Text>
          </View>
        </View>
      )}
    />
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
      padding: 16,
    },
    emptyText: { fontSize: 12, color: tk.text.tertiary, marginTop: 8 },
    errorText: { fontSize: 12, color: tk.danger.DEFAULT, marginTop: 4 },
    header: { paddingTop: 48, paddingBottom: 8 },
    backText: { fontSize: 14, color: tk.text.secondary },
    title: { marginTop: 4, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 4, fontSize: 13, color: tk.text.secondary },
    profileCard: {
      padding: 16,
      borderRadius: 8,
      backgroundColor: tk.surface.muted,
      marginBottom: 12,
    },
    name: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    bio: {
      marginTop: 6,
      fontSize: 13,
      color: tk.text.secondary,
      lineHeight: 18,
    },
    statsRow: {
      flexDirection: 'row',
      marginTop: 12,
      justifyContent: 'space-between',
    },
    statItem: { alignItems: 'center', flex: 1 },
    statValue: { fontSize: 18, fontWeight: '600', color: tk.success.DEFAULT },
    statLabel: {
      marginTop: 2,
      fontSize: 11,
      color: tk.text.secondary,
    },
    followBtn: {
      marginTop: 14,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: tk.success.DEFAULT,
      alignItems: 'center',
    },
    followingBtn: { backgroundColor: tk.surface.card },
    followBtnText: { fontSize: 13, color: tk.surface.light },
    followingBtnText: { color: tk.text.secondary },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.text.primary,
      marginVertical: 8,
    },
    card: {
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    cardTitle: { fontSize: 15, fontWeight: '600', color: tk.text.primary },
    cardMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
      gap: 8,
      flexWrap: 'wrap',
    },
    cardMetaText: { fontSize: 11, color: tk.text.tertiary },
    priceText: { fontSize: 13, fontWeight: '600', color: tk.success.DEFAULT },
    retryBtn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.success.DEFAULT,
    },
    retryBtnText: { color: tk.surface.light, fontSize: 13 },
  })
}
