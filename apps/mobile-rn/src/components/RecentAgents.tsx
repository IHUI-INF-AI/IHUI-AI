/**
 * RecentAgents 最近使用智能体 (mobile-rn 端)
 *
 * 对齐 Uniapp 项目 RecentAgents.vue:
 * - 标题"最近使用"
 * - 横向 ScrollView 展示 agent 卡片列表(原:bg #f8f9fa 卡片 + 内边距)
 * - 每项:头像(80rpx → 40dp 圆角 8)+ 名称(24rpx → 12pt)
 * - 数据字段 1:1 兼容原项目 agentAvatar / agentName / agentId(缺失回退短字段 name / avatar / id)
 * - 点击 → onItemClick(item) 回调(登录校验 / type 3|5 付费模型 / source n8n 跳转均由调用方负责,预留)
 *
 * 类型零 any;圆角守门(无 rounded-full);无分割线(gap 间距);复用 design-tokens;禁用 purple/indigo。
 */
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

export interface RecentAgentItem {
  id: string
  name: string
  avatar?: string
  type?: string | number
  source?: string
  /** 原项目字段别名(1:1 兼容;缺失回退 name/avatar/id) */
  agentAvatar?: string
  agentName?: string
  agentId?: string
}

export interface RecentAgentsProps {
  items: RecentAgentItem[]
  onItemClick: (item: RecentAgentItem) => void
  /** 默认头像(对齐原项目 defaultAvatar;无 avatar 时优先使用) */
  defaultAvatar?: string
}

export default function RecentAgents({ items, onItemClick, defaultAvatar }: RecentAgentsProps) {
  if (!items || items.length === 0) return null

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{'最近使用'}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {items.map((item, index) => {
          const name = item.agentName ?? item.name ?? ''
          const avatar = item.agentAvatar ?? item.avatar ?? defaultAvatar
          const key = item.agentId ?? item.id ?? `${index}-${name}`
          return (
            <TouchableOpacity
              key={key}
              style={styles.item}
              onPress={() => onItemClick(item)}
              accessibilityRole="button"
              accessibilityLabel={name}
            >
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>
                    {name.trim().charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
            </TouchableOpacity>
          )
        })}
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
    fontSize: 16,
    fontWeight: '700',
    color: tokens.text.primary,
    marginBottom: 8,
  },
  scroll: {
    gap: 10,
  },
  item: {
    alignItems: 'center',
    minWidth: 60,
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderRadius: 12,
    backgroundColor: tokens.surface.muted,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
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
    marginTop: 6,
    maxWidth: 56,
    fontSize: 12,
    color: tokens.text.secondary,
    textAlign: 'center',
  },
})
