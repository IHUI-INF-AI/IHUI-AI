/**
 * FullRankingList 完整排名列表 (mobile-rn 端)
 *
 * 渲染一个完整的排名榜单。每行左中右结构:
 * 排名徽章(前三名 brand/warning/default 圆形徽章 + 白字) + 涨跌波动(↑涨红/↓跌绿)
 * + 头像(首字符占位,或原版 field1 图标) + 名称/公司 + 关注度(万格式化) + 数值。
 *
 * 历史项目对位:
 * - Ai-WXMiniVue/src/components/FullRankingList.vue(列表渲染逻辑)
 *   · 原版字段:ranking(排名)/rankingUndulation(涨跌图标)/rankingUndulationNum(涨跌数值)
 *     field1(项图标)/name(名称)/company(公司)/undulation(热度图标)/undulationNum(热度)
 *     attention(关注度)
 *
 * 字段契约:保留 mobile-rn 既有 rank/nickname/value/avatarInitial,同时对齐原版可选字段
 * (name/company/field1/attention/rankingUndulation/rankingUndulationNum/undulation/undulationNum),
 * 展示名取 name ?? nickname,头像优先 field1 图标、回退首字符。
 *
 * 颜色全部走 @ihui/design-tokens 的 rnLightTokens,涨红(danger)/跌绿(success),禁用 purple/indigo。
 * 系统字体,无 any,精确类型。
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { ListRenderItem } from 'react-native'

export interface FullRankingItem {
  id: string
  /** 排名(1 起,前三名彩色徽章) */
  rank: number
  /** 名称/昵称(展示名;对齐原版 name,保留 nickname 兼容) */
  nickname: string
  /** 数值(积分等,与 valueLabel 配对展示) */
  value: number
  /** 头像占位首字符(无 field1 图标时回退) */
  avatarInitial?: string

  // ===== 对齐原版 FullRankingList.vue 字段(可选) =====
  /** 名称(原版 name;优先于 nickname 展示) */
  name?: string
  /** 公司名称(原版 company) */
  company?: string
  /** 排名涨跌图标(原版 rankingUndulation;提供时替代 ↑/↓ 文本箭头) */
  rankingUndulation?: string
  /** 排名涨跌数值(原版 rankingUndulationNum;>0 涨红 <0 跌绿 =0 平) */
  rankingUndulationNum?: number
  /** 项图标 URL(原版 field1;优先于首字符头像展示) */
  field1?: string
  /** 热度图标(原版 undulation,预留) */
  undulation?: string
  /** 热度数值(原版 undulationNum,预留) */
  undulationNum?: number
  /** 关注度(原版 attention;>=10000 显示为 1.2万) */
  attention?: number
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

/** 关注度万格式化:>=10000 → 1.2万,其余原值(对齐原版 formatAttention) */
function formatAttention(value: number): string {
  if (value >= 10000) {
    let v = (value / 10000).toFixed(1)
    if (v.endsWith('.0')) v = v.slice(0, -2)
    return `${v}万`
  }
  return String(value)
}

/** 前三名 / 四名之后:彩色 vs 浅色徽章 */
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

/** 涨跌波动:有图标用图标,否则 ↑涨红/↓跌绿/—平,附涨跌数值 */
function RankChange({
  icon,
  num,
}: {
  icon: string | undefined
  num: number | undefined
}): React.ReactElement | null {
  if (num === undefined) return null
  const flat = num === 0
  const up = num > 0
  const color = flat ? tokens.text.tertiary : up ? tokens.danger.DEFAULT : tokens.success.DEFAULT
  return (
    <View style={styles.rankChange}>
      {icon ? (
        <Image source={{ uri: icon }} style={styles.rankChangeIcon} />
      ) : (
        <Text style={[styles.rankChangeArrow, { color }]}>{flat ? '—' : up ? '↑' : '↓'}</Text>
      )}
      {!flat ? <Text style={[styles.rankChangeNum, { color }]}>{Math.abs(num)}</Text> : null}
    </View>
  )
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
  const displayName = item.name ?? item.nickname
  const pressable = onPress !== undefined
  const handlePress = pressable ? () => onPress(item.id) : undefined
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={pressable ? 0.7 : 1}
      onPress={handlePress}
      disabled={!pressable}
    >
      {/* 排名 + 涨跌波动 */}
      <View style={styles.rankCol}>
        <View style={[styles.rankBadge, { backgroundColor: badge.backgroundColor }]}>
          <Text style={[styles.rankText, { color: badge.color }]}>{item.rank}</Text>
        </View>
        <RankChange icon={item.rankingUndulation} num={item.rankingUndulationNum} />
      </View>

      {/* 图标(原版 field1)或首字符头像 */}
      {item.field1 ? (
        <Image source={{ uri: item.field1 }} style={styles.avatar} resizeMode="cover" />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      )}

      {/* 名称 + 公司 */}
      <View style={styles.detailCol}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName || ANONYMOUS_LABEL}
        </Text>
        {item.company ? (
          <Text style={styles.company} numberOfLines={1}>
            {item.company}
          </Text>
        ) : null}
      </View>

      {/* 关注度(万格式化) */}
      {item.attention !== undefined ? (
        <View style={styles.attentionCol}>
          <Text style={styles.attentionValue}>{formatAttention(item.attention)}</Text>
          <Text style={styles.attentionLabel}>关注度</Text>
        </View>
      ) : null}

      {/* 数值(积分等) */}
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
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  separator: {
    height: 4,
  },
  rankCol: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
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
  rankChange: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  rankChangeIcon: {
    width: 10,
    height: 10,
  },
  rankChangeArrow: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 12,
  },
  rankChangeNum: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 12,
    marginLeft: 1,
  },
  avatar: {
    width: 40,
    height: 44,
    borderRadius: 12,
    marginHorizontal: 10,
  },
  avatarPlaceholder: {
    backgroundColor: tokens.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.secondary,
  },
  detailCol: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  company: {
    fontSize: 12,
    color: tokens.text.secondary,
    marginTop: 2,
  },
  attentionCol: {
    alignItems: 'center',
    marginLeft: 8,
    minWidth: 48,
  },
  attentionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  attentionLabel: {
    fontSize: 11,
    color: tokens.text.secondary,
    marginTop: 2,
  },
  valueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginLeft: 8,
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
