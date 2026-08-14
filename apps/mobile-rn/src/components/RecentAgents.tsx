/**
 * RecentAgents 最近使用智能体 (mobile-rn 端)
 *
 * 对齐 Uniapp 项目 RecentAgents.vue:
 * - 标题"最近使用"
 * - 横向 ScrollView 展示 agent 头像列表
 * - 每项:头像(80rpx → 40dp 圆角 8)+ 名称(24rpx → 12pt)
 * - 点击 → onItemClick(item) 回调(登录校验由调用方负责)
 *
 * 类型零 any;圆角守门(无 rounded-full);无分割线(gap 间距);复用 design-tokens。
 */
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

export interface RecentAgentItem {
  id: string
  name: string
  avatar?: string
  type?: string
  source?: string
}

export interface RecentAgentsProps {
  items: RecentAgentItem[]
  onItemClick: (item: RecentAgentItem) => void
}

export default function RecentAgents({ items, onItemClick }: RecentAgentsProps) {
  if (!items || items.length === 0) return null

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{'最近使用'}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.item}
            onPress={() => onItemClick(item)}
            accessibilityRole="button"
            accessibilityLabel={item.name}
          >
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>
                  {item.name.trim().charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.text.primary,
    marginBottom: 8,
  },
  scroll: {
    gap: 12,
  },
  item: {
    alignItems: 'center',
    width: 56,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  name: {
    marginTop: 4,
    fontSize: 12,
    color: tokens.text.secondary,
    textAlign: 'center',
  },
})
