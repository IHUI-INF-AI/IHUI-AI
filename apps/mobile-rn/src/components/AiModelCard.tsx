/**
 * AiModelCard AI 模型卡片 (mobile-rn 端)
 * 展示 AI 模型信息:名称/描述/图标/标签
 * 保留卡片样式 + 点击事件
 * 迁移自旧项目 Vue 组件 (Ai-WXMiniVue/src/components/AiModelCard/index.vue)
 */
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export type ModelUserType = 'freevip' | 'freeuse' | 'freetime' | 'hasbuy' | 'buymonth' | 'none'

export interface AiModelData {
  name: string
  subname?: string
  icon?: string
  mumber?: number | string
  userType?: ModelUserType
  tags?: string[]
  [key: string]: unknown
}

export interface AiModelCardProps {
  data: AiModelData
  type?: 'view' | 'buy'
  onPress?: (data: AiModelData) => void
  onBuyPress?: (data: AiModelData) => void
}

const USER_TYPE_LABEL: Record<ModelUserType, string> = {
  freevip: '会员免费',
  freeuse: '免费使用',
  freetime: '限时免费',
  hasbuy: '已购买',
  buymonth: '包月',
  none: '',
}

export default function AiModelCard({
  data,
  type = 'view',
  onPress,
  onBuyPress,
}: AiModelCardProps) {
  const userType = data.userType ?? 'none'
  const userLabel = USER_TYPE_LABEL[userType]
  const hasTags = data.tags && data.tags.length > 0

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => onPress?.(data)}
    >
      {/* 顶部:图标 + 名称/描述 */}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          {data.icon ? (
            <Image source={{ uri: data.icon }} style={styles.icon} />
          ) : (
            <Text style={styles.iconFallback}>
              {(data.name || 'A').slice(0, 1)}
            </Text>
          )}
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {data.name}
          </Text>
          {data.subname ? (
            <Text style={styles.subname} numberOfLines={1}>
              {data.subname}
            </Text>
          ) : null}
        </View>
        {data.mumber !== undefined ? (
          <Text style={styles.mumber}>{data.mumber}</Text>
        ) : null}
      </View>

      {/* 标签(用 gap-* 分隔) */}
      {hasTags ? (
        <View style={styles.tagsWrap}>
          {data.tags!.map((tag, idx) => (
            <View key={idx} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* 底部:用户类型徽章 + 购买按钮 */}
      {userLabel ? (
        <View style={styles.footer}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{userLabel}</Text>
          </View>
          {type === 'buy' ? (
            <TouchableOpacity
              style={styles.buyBtn}
              activeOpacity={0.7}
              onPress={() => onBuyPress?.(data)}
            >
              <Text style={styles.buyBtnText}>购买</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  icon: {
    width: 48,
    height: 48,
    resizeMode: 'cover',
  },
  iconFallback: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366f1',
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6366f1',
    marginBottom: 4,
  },
  subname: {
    fontSize: 12,
    color: '#4b5563',
  },
  mumber: {
    fontSize: 10,
    color: '#6b7280',
    marginLeft: 8,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#eef2ff',
    borderRadius: 2,
  },
  tagText: {
    fontSize: 11,
    color: '#6366f1',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#fffbeb',
    borderRadius: 2,
  },
  badgeText: {
    fontSize: 11,
    color: '#d97706',
  },
  buyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#6366f1',
    borderRadius: 6,
  },
  buyBtnText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
})
