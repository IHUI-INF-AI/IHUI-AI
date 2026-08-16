/**
 * AgentList Agent 列表 (mobile-rn 端)
 *
 * 对齐历史项目 AgentList.vue(AI 助手选择浮层):
 * - FlatList 渲染 Agent 列表,卡片化容器(垂直布局:头像在上,文字在下)。
 * - 单项:顶部头像(60×60 圆角 12)+ 操作按钮(›),下方名称(16pt)+描述(12pt)+统计。
 * - 卡片样式:borderRadius 12(rounded-xl)+ subtle shadow(iOS shadowOpacity 0.05 / Android elevation 2)。
 * - 空态:居中提示文字。
 * - 浅色优雅风,无霓虹/无渐变;颜色全部走 @ihui/design-tokens 的 rnLightTokens。
 * - 类型零 any,精确标注。
 * - onItemAction 可选(收藏等),不传则不渲染按钮。
 * - 可选 RefreshControl(通过 refreshing/onRefresh props 注入)。
 * - 点赞/收藏回调可选(对齐 Uniapp tools ai-list 的 getAgentLike/getAgentCollect):
 *   onItemLike/onItemCollect 传入时在卡片底部渲染 👍/⭐ 操作按钮(带计数与选中态)。
 * - scrollEnabled 可选(默认 true):嵌套外层 ScrollView 时传 false 关闭内部滚动,由内容撑开高度。
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

/** 单个 Agent 条目(对齐 Uniapp 20+ 字段契约,可选字段 API 未返回时省略) */
export interface AgentListItem {
  id: string
  name: string
  avatar?: string
  description?: string
  category?: string
  /** P1-3 扩展字段(对齐 Uniapp AgentListItem) */
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
  prologue?: string
}

export interface AgentListProps {
  items: AgentListItem[]
  onItemClick: (id: string) => void
  /** 操作按钮回调;不传则不渲染操作按钮 */
  onItemAction?: (id: string) => void
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

function keyExtractor(item: AgentListItem): string {
  return item.id
}

function Avatar({ name, avatar }: { name: string; avatar?: string }): React.JSX.Element {
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

function AgentRow({
  item,
  onItemClick,
  onItemAction,
  onItemLike,
  onItemCollect,
}: {
  item: AgentListItem
  onItemClick: (id: string) => void
  onItemAction?: (id: string) => void
  onItemLike?: (id: string) => void
  onItemCollect?: (id: string) => void
}): React.JSX.Element {
  const hasMeta =
    item.usageCount !== undefined || item.collectCount !== undefined || item.likeCount !== undefined

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => onItemClick(item.id)}>
      <View style={styles.cardTop}>
        <Avatar name={item.name} avatar={item.avatar} />
        {onItemAction ? (
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.6}
            onPress={() => onItemAction(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name} 操作`}
          >
            <Text style={styles.actionText}>{'›'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {item.name}
      </Text>
      {item.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
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
      {/* 点赞/收藏操作行(对齐 Uniapp ai-list 卡片 👍/⭐,回调传入才渲染) */}
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
              <Text style={[styles.reactionText, item.isThumbs ? styles.reactionTextActive : null]}>
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
    </TouchableOpacity>
  )
}

export default function AgentList({
  items,
  onItemClick,
  onItemAction,
  onItemLike,
  onItemCollect,
  emptyText = '暂无 Agent',
  refreshing = false,
  onRefresh,
  scrollEnabled = true,
}: AgentListProps): React.JSX.Element {
  const renderItem: ListRenderItem<AgentListItem> = ({ item }) => (
    <AgentRow
      item={item}
      onItemClick={onItemClick}
      onItemAction={onItemAction}
      onItemLike={onItemLike}
      onItemCollect={onItemCollect}
    />
  )

  return (
    <View style={[styles.container, scrollEnabled ? null : styles.containerNested]}>
      <FlatList<AgentListItem>
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
  // 嵌套外层 ScrollView 时:取消 flex 撑开,由内容决定高度
  containerNested: {
    flex: 0,
    alignSelf: 'stretch',
  },
  listBody: {
    padding: 12,
    gap: 12,
  },
  card: {
    borderRadius: 12,
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 12,
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
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 18,
    lineHeight: 20,
    color: tokens.text.secondary,
  },
  name: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  description: {
    marginTop: 4,
    fontSize: 12,
    color: tokens.text.secondary,
    lineHeight: 18,
  },
  meta: {
    marginTop: 6,
    fontSize: 11,
    color: tokens.text.tertiary,
  },
  // ── 点赞/收藏操作行(对齐 Uniapp ai-list 卡片操作按钮) ──
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
