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
import type { CircleMemberItem, CircleMemberScreenProps } from '../../types'

/** 圈子成员列表/Props 类型 re-export(单一来源 @ihui/types) */
export type { CircleMemberItem, CircleMemberScreenProps }

const ROLE_KEYS: Record<CircleMemberItem['role'], string> = {
  owner: 'circleMember.owner',
  admin: 'circleMember.admin',
  member: 'circleMember.member',
}

/**
 * 圈子成员列表共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题)+ 错误提示 + loading 态
 * + 成员卡片(initials 头像 + 昵称 + 加入时间 + 角色徽章)
 * + 下拉刷新 + 空态。平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function CircleMemberScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: CircleMemberScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('circleMember.title')}</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList<CircleMemberItem>
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listBody}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>{t('circleMember.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => onPressItem(item.id)}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <View style={styles.card}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.cardTime}>{item.joinedAt}</Text>
                </View>
                <View
                  style={[
                    styles.roleBadge,
                    item.role === 'owner'
                      ? styles.roleBadgeOwner
                      : item.role === 'admin'
                        ? styles.roleBadgeAdmin
                        : styles.roleBadgeMember,
                  ]}
                >
                  <Text style={styles.roleText}>{t(ROLE_KEYS[item.role])}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 48,
      paddingBottom: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    errorText: { paddingHorizontal: 16, fontSize: 12, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 16, paddingBottom: 32 },
    separator: { height: 8 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    avatarText: { fontSize: 15, fontWeight: '600', color: tk.surface.light },
    cardBody: { flex: 1 },
    cardName: { fontSize: 15, fontWeight: '600', color: tk.text.primary },
    cardTime: { marginTop: 4, fontSize: 11, color: tk.text.tertiary },
    roleBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
    },
    roleBadgeOwner: { backgroundColor: tk.brand.DEFAULT },
    roleBadgeAdmin: { backgroundColor: tk.success.DEFAULT },
    roleBadgeMember: { backgroundColor: tk.text.tertiary },
    roleText: { fontSize: 11, fontWeight: '600', color: tk.surface.light },
  })
}
