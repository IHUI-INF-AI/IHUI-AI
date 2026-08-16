/**
 * AgentShopList AI 应用商店卡片列表 (mobile-rn 端)
 *
 * 对齐历史项目 pages/table/tools/components/Ai-list_b.vue(AI 应用商店主体):
 * - 卡片流:头像(上)+ 名称 + 描述 + 分类标签 + 统计 + 点赞/收藏操作行
 * - 卡片 borderRadius 12.5(原 25rpx),浅色优雅风,无霓虹/无渐变。
 * - 颜色走 @ihui/design-tokens 的 rnLightTokens。
 * - 类型零 any,精确标注。
 *
 * 平台特有:依赖 react-native FlatList/RefreshControl,不适合共享层。
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from 'react-native'

/** 单个 Agent 条目(与 AgentList 弹出选择列表共用契约) */
export interface AgentShopItem {
  id: string
  name: string
  avatar?: string
  description?: string
  /** 分类标签(对齐 Uniapp agentMainCategory name 数组) */
  tags?: string[]
  type?: string
  source?: string
  isCollect?: boolean
  isThumbs?: boolean
  collectCount?: number
  likeCount?: number
  usageCount?: number
  isHot?: boolean
  isNew?: boolean
  userNickname?: string
  userAvatar?: string
}

export interface AgentShopListProps {
  items: AgentShopItem[]
  onItemClick: (id: string) => void
  /** 点赞回调(对齐 Uniapp getAgentLike);不传则不渲染点赞按钮 */
  onItemLike?: (id: string) => void
  /** 收藏回调(对齐 Uniapp getAgentCollect);不传则不渲染收藏按钮 */
  onItemCollect?: (id: string) => void
  emptyText?: string
  /** 下拉刷新状态(可选,传入则启用 RefreshControl) */
  refreshing?: boolean
  /** 下拉刷新回调(可选) */
  onRefresh?: () => void
  /** 内部滚动开关(默认 true);嵌套外层 ScrollView 时传 false */
  scrollEnabled?: boolean
}

function keyExtractor(item: AgentShopItem): string {
  return item.id
}

function ShopAvatar({ name, avatar }: { name: string; avatar?: string }): React.JSX.Element {
  if (avatar) {
    return <Image source={{ uri: avatar }} style={styles.avatar} />
  }
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Text style={styles.avatarFallbackText}>{initial}</Text>
    </View>
  )
}

function ShopRow({
  item,
  onItemClick,
  onItemLike,
  onItemCollect,
}: {
  item: AgentShopItem
  onItemClick: (id: string) => void
  onItemLike?: (id: string) => void
  onItemCollect?: (id: string) => void
}): React.JSX.Element {
  const hasMeta =
    item.usageCount !== undefined || item.collectCount !== undefined || item.likeCount !== undefined

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => onItemClick(item.id)}>
      <View style={styles.cardTop}>
        <ShopAvatar name={item.name} avatar={item.avatar} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
          {item.isNew ? <Text style={styles.newBadge}>{' NEW'}</Text> : null}
        </Text>
        {item.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        {item.tags && item.tags.length > 0 ? (
          <View style={styles.tagRow}>
            {item.tags.slice(0, 3).map((tag) => (
              <Text key={tag} style={styles.tag}>
                {tag}
              </Text>
            ))}
          </View>
        ) : null}
        {hasMeta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {item.usageCount !== undefined ? `使用 ${item.usageCount}` : ''}
            {item.usageCount !== undefined && item.collectCount !== undefined ? ' · ' : ''}
            {item.collectCount !== undefined ? `收藏 ${item.collectCount}` : ''}
            {item.collectCount !== undefined && item.likeCount !== undefined ? ' · ' : ''}
            {item.likeCount !== undefined ? `点赞 ${item.likeCount}` : ''}
          </Text>
        ) : null}
        {onItemLike || onItemCollect ? (
          <View style={styles.reactionRow}>
            {onItemLike ? (
              <TouchableOpacity
                style={styles.reactionBtn}
                activeOpacity={0.6}
                onPress={() => onItemLike(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`${item.name} 点赞`}
              >
                <Text
                  style={[styles.reactionText, item.isThumbs ? styles.reactionTextActive : null]}
                >
                  {`👍 ${item.likeCount ?? 0}`}
                </Text>
              </TouchableOpacity>
            ) : null}
            {onItemCollect ? (
              <TouchableOpacity
                style={styles.reactionBtn}
                activeOpacity={0.6}
                onPress={() => onItemCollect(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`${item.name} 收藏`}
              >
                <Text
                  style={[styles.reactionText, item.isCollect ? styles.reactionTextActive : null]}
                >
                  {`⭐ ${item.collectCount ?? 0}`}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

export default function AgentShopList({
  items,
  onItemClick,
  onItemLike,
  onItemCollect,
  emptyText = '该分类下暂无智能体',
  refreshing = false,
  onRefresh,
  scrollEnabled = true,
}: AgentShopListProps): React.JSX.Element {
  const renderItem: ListRenderItem<AgentShopItem> = ({ item }) => (
    <ShopRow
      item={item}
      onItemClick={onItemClick}
      onItemLike={onItemLike}
      onItemCollect={onItemCollect}
    />
  )

  return (
    <View style={[styles.container, scrollEnabled ? null : styles.containerNested]}>
      <FlatList<AgentShopItem>
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listBody}
        scrollEnabled={scrollEnabled}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
  },
  containerNested: {
    flex: 0,
    alignSelf: 'stretch',
  },
  listBody: {
    padding: 12,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    borderRadius: 12.5,
    backgroundColor: tokens.surface.light,
    borderWidth: 1,
    borderColor: tokens.border.light,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTop: {
    alignItems: 'flex-start',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 12.5,
    backgroundColor: tokens.surface.muted,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 20,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  cardBody: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  newBadge: {
    fontSize: 12,
    color: tokens.danger.DEFAULT,
  },
  description: {
    marginTop: 4,
    fontSize: 12,
    color: tokens.text.secondary,
    lineHeight: 18,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  tag: {
    fontSize: 11,
    color: tokens.text.secondary,
    backgroundColor: tokens.surface.muted,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  meta: {
    marginTop: 6,
    fontSize: 11,
    color: tokens.text.tertiary,
  },
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  reactionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: tokens.surface.muted,
  },
  reactionText: {
    fontSize: 12,
    color: tokens.text.secondary,
  },
  reactionTextActive: {
    color: tokens.brand.DEFAULT,
    fontWeight: '600',
  },
  empty: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: tokens.text.tertiary,
  },
})
