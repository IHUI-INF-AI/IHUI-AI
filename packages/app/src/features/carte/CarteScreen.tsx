import { useMemo } from 'react'
import { View, Text, TouchableOpacity, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CarteCreator, CarteScreenProps, CarteWork } from '../../types'

/** 创客名片共享屏 — props 注入式跨端组件 */
export type { CarteCreator, CarteScreenProps, CarteWork }

function initials(name: string): string {
  if (!name) return '?'
  return name.slice(0, 1).toUpperCase()
}

export function CarteScreen({
  t,
  creator,
  works,
  skills,
  loading,
  refreshing,
  error,
  onRefresh,
  onRetry,
  onBack,
  colorScheme = 'light',
}: CarteScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading && !creator) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && !creator) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={onRetry}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const stats = creator
    ? [
        { label: t('carte.projects'), value: creator.projects },
        { label: t('carte.skills'), value: creator.skills },
        { label: t('carte.rating'), value: creator.rating },
      ]
    : []

  return (
    <FlatList<CarteWork>
      style={styles.container}
      data={works}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 32 }}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <View style={styles.header}>
            <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.back}>{t('common.back')}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{t('carte.title')}</Text>
          </View>

          {error ? (
            <View style={styles.errorBar}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {creator ? (
            <>
              <View style={styles.profileCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(creator.name)}</Text>
                </View>
                <View style={styles.profileMeta}>
                  <Text style={styles.name}>{creator.name}</Text>
                  <Text style={styles.title2}>{creator.title}</Text>
                </View>
              </View>
              <Text style={styles.bio}>{creator.bio}</Text>

              <View style={styles.statsRow}>
                {stats.map((st) => (
                  <View key={st.label} style={styles.statItem}>
                    <Text style={styles.statValue}>{st.value}</Text>
                    <Text style={styles.statLabel}>{st.label}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.sectionTitle}>{t('carte.skillsTitle')}</Text>
          <View style={styles.skillsRow}>
            {skills.map((sk) => (
              <View key={sk} style={styles.skillBadge}>
                <Text style={styles.skillText}>{sk}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>{t('carte.worksTitle')}</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.muted}>{t('carte.empty')}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.workThumb}>
            <Text style={styles.workThumbText}>{item.category}</Text>
          </View>
          <View style={styles.workBody}>
            <Text style={styles.workTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.workDesc} numberOfLines={2}>
              {item.desc}
            </Text>
            <View style={styles.tagRow}>
              {item.tags.map((tg) => (
                <View key={tg} style={styles.tagBadge}>
                  <Text style={styles.tagText}>{tg}</Text>
                </View>
              ))}
              <Text style={styles.likesText}>♥ {item.likes}</Text>
            </View>
          </View>
        </View>
      )}
    />
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    center: { alignItems: 'center', paddingVertical: 48 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingTop: 48,
      paddingBottom: 12,
    },
    back: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    errorBar: {
      marginBottom: 12,
      padding: 8,
      borderRadius: 8,
      backgroundColor: tk.danger.light,
    },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 16,
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 20, fontWeight: '600', color: tk.brand.DEFAULT },
    profileMeta: { marginLeft: 12, flex: 1 },
    name: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    title2: { marginTop: 8, fontSize: 14, color: tk.brand.DEFAULT },
    bio: {
      marginTop: 12,
      fontSize: 14,
      lineHeight: 20,
      color: tk.text.medium,
    },
    statsRow: {
      flexDirection: 'row',
      marginTop: 12,
      padding: 14,
      borderRadius: 16,
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    statLabel: {
      marginTop: 8,
      fontSize: 11,
      color: tk.text.secondary,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
      marginTop: 16,
      marginBottom: 12,
    },
    skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    skillBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: tk.surface.muted,
    },
    skillText: { fontSize: 14, color: tk.brand.DEFAULT },
    card: {
      flexDirection: 'row',
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    workThumb: {
      width: 64,
      height: 64,
      borderRadius: 12,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    workThumbText: { fontSize: 11, color: tk.text.secondary },
    workBody: { marginLeft: 12, flex: 1 },
    workTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    workDesc: {
      marginTop: 8,
      fontSize: 14,
      lineHeight: 18,
      color: tk.text.secondary,
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
    },
    tagBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 12,
      backgroundColor: tk.surface.muted,
    },
    tagText: { fontSize: 10, color: tk.text.secondary },
    likesText: { fontSize: 11, color: tk.danger.DEFAULT },
    retryBtn: {
      marginTop: 12,
      paddingHorizontal: 10,
      height: 44,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    retryText: { color: tk.surface.light, fontSize: 14 },
    muted: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
  })
}
