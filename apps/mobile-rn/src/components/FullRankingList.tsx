/**
 * FullRankingList 完整排名列表 (mobile-rn 端)
 *
 * 渲染一个完整的排名榜单:前三名特殊样式(brand / warning / default 圆形徽章
 * + 白字),第四名及之后用浅色徽章(surface.card 底 + text.secondary 字)。
 * 每行左中右三栏:排名 / 头像+昵称 / 数值。
 *
 * 历史项目对位:
 * - Ai-WXMiniVue/src/components/FullRankingList(列表渲染逻辑)
 * - packages/app/src/features/ranking/RankingScreen(余下列表 + 浅色样式参照)
 *
 * 颜色全部走 @ihui/design-tokens 的 rnLightTokens,浅色优雅风,
 * 无渐变 / 无霓虹。系统字体,无 any,精确类型。
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { ListRenderItem } from 'react-native'

export interface FullRankingItem {
  id: string
  rank: number
  nickname: string
  value: number
  avatarInitial?: string
}

export interface FullRankingListProps {
  items: FullRankingItem[]
  onPress?: (id: string) => void
  valueLabel?: string
}

/** 昵称为空时回退占位 */
const ANONYMOUS_LABEL = '匿名'

/** 取昵称首字符作为头像占位 */
function deriveInitial(nickname: string, fallback: string | undefined): string {
  if (fallback && fallback.length > 0) return fallback.slice(0, 1).toUpperCase()
  if (!nickname) return '?'
  return nickname.slice(0, 1).toUpperCase()
}

/** 三名/四名之后:浅色徽章 */
interface RankBadgeStyle {
  backgroundColor: string
  color: string
}

function rankBadgeStyle(rank: number): RankBadgeStyle {
  if (rank === 1) {
    return { backgroundColor: tokens.brand.DEFAULT, color: tokens.surface.light }
  }
  if (rank === 2) {
    return { backgroundColor: tokens.warning.DEFAULT, color: tokens.surface.light }
  }
  if (rank === 3) {
    return { backgroundColor: tokens.text.tertiary, color: tokens.surface.light }
  }
  return { backgroundColor: tokens.surface.card, color: tokens.text.secondary }
}

function Row({
  item,
  onPress,
  valueLabel,
}: {
  item: FullRankingItem
  onPress: ((id: string) => void) | undefined
  valueLabel: string
}): React.ReactElement {
  const badge = rankBadgeStyle(item.rank)
  const initial = deriveInitial(item.nickname, item.avatarInitial)
  const pressable = onPress !== undefined
  const handlePress = pressable ? () => onPress(item.id) : undefined
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={pressable ? 0.7 : 1}
      onPress={handlePress}
      disabled={!pressable}
    >
      <View style={[styles.rankBadge, { backgroundColor: badge.backgroundColor }]}>
        <Text style={[styles.rankText, { color: badge.color }]}>{item.rank}</Text>
      </View>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <Text style={styles.nickname} numberOfLines={1}>
        {item.nickname || ANONYMOUS_LABEL}
      </Text>
      <View style={styles.valueWrap}>
        <Text style={styles.valueText}>{item.value}</Text>
        <Text style={styles.valueLabel}>{valueLabel}</Text>
      </View>
    </TouchableOpacity>
  )
}

export default function FullRankingList({
  items,
  onPress,
  valueLabel = '分',
}: FullRankingListProps): React.ReactElement {
  const renderItem: ListRenderItem<FullRankingItem> = ({ item }) => (
    <Row item={item} onPress={onPress} valueLabel={valueLabel} />
  )
  return (
    <View style={styles.container}>
      <FlatList<FullRankingItem>
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.listBody}
        scrollEnabled={false}
      />
    </View>
  )
}

function Separator(): React.ReactElement {
  return <View style={styles.separator} />
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.surface.muted,
    borderRadius: 12,
    padding: 4,
  },
  listBody: {
    paddingVertical: 0,
  },
  row: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  separator: {
    height: 4,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
  },
  avatar: {
    width: 40,
    height: 44,
    borderRadius: 12,
    backgroundColor: tokens.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.secondary,
  },
  nickname: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  valueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  valueText: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.text.primary,
  },
  valueLabel: {
    fontSize: 12,
    color: tokens.text.secondary,
    marginLeft: 2,
  },
})
