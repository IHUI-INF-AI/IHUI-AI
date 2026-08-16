import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AgentScreenProps } from '../../types'

/** Agent 列表共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { AgentScreenProps }

function getInitial(name: string): string {
  return name?.trim().charAt(0)?.toUpperCase() || '?'
}

export function AgentScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: AgentScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading && items.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tk.brand.DEFAULT} />
      </View>
    )
  }
  if (error && items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.btn} onPress={onBack}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{t('agentScreen.title')}</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('common.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPressItem(item.id)}
            style={styles.card}
            accessibilityRole="button"
          >
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatar} resizeMode="cover" />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>{getInitial(item.name)}</Text>
              </View>
            )}
            <View style={styles.cardMain}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.isVipExclusive ? (
                  <View style={styles.vipBadge}>
                    <Text style={styles.vipText}>VIP</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.desc} numberOfLines={2}>
                {item.description}
              </Text>
              {item.useCount !== undefined || item.rating !== undefined ? (
                <Text style={styles.meta}>
                  {item.useCount !== undefined
                    ? `${t('agentScreen.useCount', { count: item.useCount })}`
                    : ''}
                  {item.useCount !== undefined && item.rating !== undefined ? ' · ' : ''}
                  {item.rating !== undefined
                    ? `${t('agentScreen.rating', { score: item.rating.toFixed(1) })}`
                    : ''}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />
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
      padding: 16,
    },
    error: { fontSize: 14, color: tk.danger.DEFAULT, marginBottom: 8, textAlign: 'center' },
    btn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
    },
    btnText: { color: tk.surface.light, fontSize: 16 },
    backBtn: { paddingHorizontal: 10, paddingTop: 12 },
    back: { fontSize: 16, color: tk.text.secondary },
    title: {
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom: 8,
      fontSize: 22,
      fontWeight: '700',
      color: tk.text.primary,
    },
    empty: { alignItems: 'center', paddingVertical: 48 },
    emptyText: { fontSize: 14, color: tk.text.tertiary },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    avatar: { width: 48, height: 48, borderRadius: 12, backgroundColor: tk.surface.muted },
    avatarFallback: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 20, fontWeight: '600', color: tk.text.secondary },
    cardMain: { flex: 1, marginLeft: 12 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name: { flex: 1, fontSize: 16, fontWeight: '600', color: tk.text.primary },
    vipBadge: {
      paddingHorizontal: 6,
      paddingVertical: 4,
      borderRadius: 4,
      backgroundColor: tk.warning.DEFAULT,
    },
    vipText: { fontSize: 10, fontWeight: '600', color: tk.surface.light },
    desc: { marginTop: 8, fontSize: 14, color: tk.text.secondary, lineHeight: 18 },
    meta: { marginTop: 8, fontSize: 11, color: tk.text.tertiary },
  })
}
