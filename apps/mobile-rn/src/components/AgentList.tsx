/**
 * AgentList Agent 列表 (mobile-rn 端)
 *
 * 对齐历史项目 AgentList.vue(AI 助手选择浮层):
 * - FlatList 渲染 Agent 列表,卡片化容器。
 * - 单项:左侧 40×40 圆角头像(URL 优先,缺省回落首字母占位)+
 *   中间 name/description + 右侧操作按钮(›)。
 * - 行样式:浅描边 + 圆角 + 紧凑 padding(对齐历史 chu-row)。
 * - 空态:居中提示文字。
 * - 浅色优雅风,无霓虹/无渐变;颜色全部走 @ihui/design-tokens 的 rnLightTokens。
 * - 类型零 any,精确标注。
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from 'react-native'

/** 单个 Agent 条目 */
export interface AgentListItem {
  id: string
  name: string
  avatar?: string
  description?: string
  category?: string
}

export interface AgentListProps {
  items: AgentListItem[]
  onItemClick: (id: string) => void
  /** 操作按钮回调;不传则不渲染操作按钮 */
  onItemAction?: (id: string) => void
  emptyText?: string
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
}: {
  item: AgentListItem
  onItemClick: (id: string) => void
  onItemAction?: (id: string) => void
}): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => onItemClick(item.id)}
    >
      <Avatar name={item.name} avatar={item.avatar} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        {item.description ? (
          <Text style={styles.description} numberOfLines={1}>
            {item.description}
          </Text>
        ) : null}
      </View>
      {onItemAction ? (
        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.6}
          onPress={() => onItemAction(item.id)}
          accessibilityRole="button"
          accessibilityLabel={`${item.name} 操作`}
        >
          <Text style={styles.actionText}>›</Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  )
}

export default function AgentList({
  items,
  onItemClick,
  onItemAction,
  emptyText = '暂无 Agent',
}: AgentListProps): React.JSX.Element {
  const renderItem: ListRenderItem<AgentListItem> = ({ item }) => (
    <AgentRow item={item} onItemClick={onItemClick} onItemAction={onItemAction} />
  )

  return (
    <View style={styles.container}>
      <FlatList<AgentListItem>
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listBody}
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
    backgroundColor: tokens.surface.bg,
    borderRadius: 8,
    overflow: 'hidden',
  },
  listBody: {
    padding: 8,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 12,
    borderRadius: 8,
    backgroundColor: tokens.surface.light,
    borderWidth: 1,
    borderColor: tokens.border.medium,
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
  avatarFallbackText: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  body: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '500',
    color: tokens.text.primary,
  },
  description: {
    marginTop: 2,
    fontSize: 12,
    color: tokens.text.secondary,
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
  empty: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: tokens.text.tertiary,
  },
})
