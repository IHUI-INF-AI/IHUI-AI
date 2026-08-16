import { useMemo } from 'react'
import { View, Text, TouchableOpacity, FlatList, RefreshControl, StyleSheet } from 'react-native'
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
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={onRetry}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
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
      contentContainerStyle={{ padding: 10, paddingBottom: 32 }}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
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
              <Text style={styles.bio}>{info.bio || t('lecturerDetail.empty')}</Text>
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
                <Text style={[styles.followBtnText, info.isFollowing && styles.followingBtnText]}>
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
    emptyText: { fontSize: 14, color: tk.text.tertiary, marginTop: 8 },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT, marginTop: 8 },
    header: { paddingTop: 48, paddingBottom: 8 },
    backText: { fontSize: 16, color: tk.text.secondary },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    profileCard: {
      padding: 14,
      borderRadius: 12,
      backgroundColor: tk.surface.muted,
      marginBottom: 12,
    },
    name: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    bio: {
      marginTop: 6,
      fontSize: 14,
      color: tk.text.secondary,
      lineHeight: 18,
    },
    statsRow: {
      flexDirection: 'row',
      marginTop: 12,
      justifyContent: 'space-between',
    },
    statItem: { alignItems: 'center', flex: 1 },
    statValue: { fontSize: 20, fontWeight: '600', color: tk.brand.DEFAULT },
    statLabel: {
      marginTop: 8,
      fontSize: 11,
      color: tk.text.secondary,
    },
    followBtn: {
      marginTop: 14,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
    },
    followingBtn: { backgroundColor: tk.surface.card },
    followBtnText: { fontSize: 14, color: tk.surface.light },
    followingBtnText: { color: tk.text.secondary },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
      marginVertical: 8,
    },
    card: {
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    cardMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
      gap: 8,
      flexWrap: 'wrap',
    },
    cardMetaText: { fontSize: 11, color: tk.text.tertiary },
    priceText: { fontSize: 16, fontWeight: '700', color: tk.brand.DEFAULT },
    retryBtn: {
      marginTop: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
    },
    retryBtnText: { color: tk.surface.light, fontSize: 14 },
  })
}
