/**
 * UserMembershipBenefits 会员权益展示(mobile-rn 端)
 *
 * 对齐历史 Uniapp UserMembershipBenefits/UserMembershipBenefits.vue:
 * - 当前等级权益列表(等级徽章 + 到期时间 + 图标权益清单)—— 保留既有 RN 契约
 * - 权益对比表:宣传标题「享受权益」+ 价格(含划线价)+ 普通/会员/操盘手 三档对比(勾✓/叉✗/文字)+ 立即开通按钮
 * - props:level/expireAt/benefits/onPressUpgrade 保留;新增 promoTitle/vipPrice/traderPrice/comparisonRows 可选
 * - 浅色优雅风,rnLightTokens;禁用 purple/indigo;会员金色用 #FFD700(对齐 uniapp VIP 金色语义)
 *
 * 平台特有:依赖 RN 组件,不适合共享。
 */
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import type { ReactNode } from 'react'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { CircleCheck, Crown, Sparkles, type LucideIcon } from 'lucide-react-native'

export interface BenefitItem {
  id: string
  icon: LucideIcon
  title: string
  desc: string
}

export type MembershipLevel = 'normal' | 'vip' | 'svip'

/** 对比表单元格:true=勾✓ / false=叉✗ / string=文字 */
export type MembershipCell = boolean | string

/** 三档对比行(对齐 Uniapp listens:title / one / two / three → 普通 / 会员 / 操盘手) */
export interface MembershipComparisonRow {
  title: string
  /** 普通用户 */
  normal: MembershipCell
  /** 会员 */
  member: MembershipCell
  /** 操盘手 */
  trader: MembershipCell
}

/** 价格(含划线原价,对齐 Uniapp card-vip 划线价) */
export interface MembershipPrice {
  /** 现价金额(纯数字文本,如 '588') */
  price: string
  /** 划线原价(纯数字文本,如 '1288') */
  originalPrice?: string
  /** 尾缀说明(如 '开通VIP/年') */
  label?: string
}

export interface UserMembershipBenefitsProps {
  level: MembershipLevel
  expireAt?: string
  benefits: readonly BenefitItem[]
  onPressUpgrade?: () => void
  /** 宣传标题(对齐 Uniapp card-title,默认「享受权益」) */
  promoTitle?: string
  /** VIP 价格(含划线价) */
  vipPrice?: MembershipPrice
  /** 操盘手价格(含划线价) */
  traderPrice?: MembershipPrice
  /** 三档对比表(普通/会员/操盘手),缺省使用 uniapp 静态权益数据 */
  comparisonRows?: readonly MembershipComparisonRow[]
}

const LEVEL_LABEL: Record<MembershipLevel, string> = {
  normal: '普通会员',
  vip: 'VIP 会员',
  svip: 'SVIP 会员',
}

/** 会员金色(对齐 uniapp VIP 金色语义;禁用 purple/indigo) */
const GOLD = '#FFD700'

const LEVEL_COLOR: Record<MembershipLevel, string> = {
  normal: tokens.text.secondary,
  vip: GOLD,
  svip: tokens.success.DEFAULT,
}

const DEFAULT_PROMO_TITLE = '享受权益'

const DEFAULT_VIP_PRICE: MembershipPrice = {
  price: '588',
  originalPrice: '1288',
  label: '开通VIP/年',
}

const DEFAULT_TRADER_PRICE: MembershipPrice = {
  price: '3888',
  originalPrice: '18888',
  label: '开通操盘手/年',
}

/** 默认三档对比表(对齐 Uniapp UserMembershipBenefits.vue listens 静态数据) */
const DEFAULT_COMPARISON_ROWS: readonly MembershipComparisonRow[] = [
  {
    title: '终身二级分销收益',
    normal: '分享送智汇值',
    member: '一级分销10%',
    trader: '一级分销40%二级分销10%',
  },
  { title: '获取上千+智能体源码', normal: false, member: true, trader: true },
  { title: 'AI应用Coze官方渠道发布', normal: true, member: true, trader: true },
  { title: 'AI应用限免开放', normal: true, member: true, trader: true },
  { title: 'Coze/N8N无缝接入', normal: true, member: true, trader: true },
  { title: '多对一答疑陪跑', normal: false, member: true, trader: true },
  { title: '算力值赠送', normal: '8万', member: '888万', trader: '1888万' },
  { title: '总部入驻及线下学习实操机会', normal: false, member: false, trader: true },
  { title: '成立一人公司', normal: true, member: true, trader: true },
  { title: '定制Agent', normal: '原价', member: '9.5折', trader: '8折' },
  { title: '入驻社区服务商名列', normal: false, member: false, trader: true },
]

function renderCell(cell: MembershipCell): ReactNode {
  if (cell === true) return <Text style={styles.cellCheck}>✓</Text>
  if (cell === false) return <Text style={styles.cellCross}>✗</Text>
  return <Text style={styles.cellText}>{cell}</Text>
}

function PriceLine({ price, color }: { price: MembershipPrice; color: string }) {
  return (
    <Text style={styles.priceRow}>
      <Text style={{ color }}>限时{price.price}元/</Text>
      {price.originalPrice ? (
        <Text style={[styles.priceStrike, { color }]}>{price.originalPrice}元</Text>
      ) : null}
      {price.label ? <Text style={{ color }}>{price.label}</Text> : null}
    </Text>
  )
}

export function UserMembershipBenefits({
  level,
  expireAt,
  benefits,
  onPressUpgrade,
  promoTitle = DEFAULT_PROMO_TITLE,
  vipPrice = DEFAULT_VIP_PRICE,
  traderPrice = DEFAULT_TRADER_PRICE,
  comparisonRows = DEFAULT_COMPARISON_ROWS,
}: UserMembershipBenefitsProps) {
  const LevelIcon = level === 'svip' ? Sparkles : Crown
  const levelColor = LEVEL_COLOR[level]
  return (
    <View style={styles.container}>
      {/* 当前等级头部(等级徽章 + 到期时间) */}
      <View style={styles.header}>
        <View style={styles.levelBadge}>
          <LevelIcon size={16} color={levelColor} />
          <Text style={[styles.levelText, { color: levelColor }]}>{LEVEL_LABEL[level]}</Text>
        </View>
        {expireAt ? <Text style={styles.expireText}>到期:{expireAt}</Text> : null}
      </View>

      {/* 当前等级权益列表(图标 + 名称 + 描述) */}
      <View style={styles.benefitList}>
        {benefits.map((b) => {
          const Icon = b.icon
          return (
            <View key={b.id} style={styles.benefitItem}>
              <View style={styles.benefitIconWrap}>
                <Icon size={18} color={tokens.brand.DEFAULT} />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitDesc}>{b.desc}</Text>
              </View>
              <CircleCheck size={16} color={tokens.success.DEFAULT} />
            </View>
          )
        })}
      </View>

      {/* 权益对比表(对齐 Uniapp UserMembershipBenefits.vue) */}
      <View style={styles.compareSection}>
        <Text style={styles.promoTitle}>{promoTitle}</Text>

        {/* 价格(含划线价;后端依赖:价格文案可来自配置,预留 vipPrice/traderPrice 注入) */}
        <View style={styles.priceBlock}>
          <PriceLine price={vipPrice} color={GOLD} />
          <PriceLine price={traderPrice} color={tokens.danger.DEFAULT} />
        </View>

        {/* 三档对比表:普通用户 / 会员 / 操盘手 */}
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.colTitle, styles.headerCell]}>权益名称</Text>
            <Text style={[styles.colTier, styles.headerCell, styles.tierNormal]}>普通用户</Text>
            <Text style={[styles.colTier, styles.headerCell, styles.tierMember]}>会员</Text>
            <Text style={[styles.colTier, styles.headerCell, styles.tierTrader]}>操盘手</Text>
          </View>
          {comparisonRows.map((row, idx) => (
            <View key={`${row.title}-${idx}`} style={styles.tableRow}>
              <Text style={[styles.colTitle, styles.rowTitle]}>{row.title}</Text>
              <View style={styles.colTier}>{renderCell(row.normal)}</View>
              <View style={styles.colTier}>{renderCell(row.member)}</View>
              <View style={styles.colTier}>{renderCell(row.trader)}</View>
            </View>
          ))}
        </View>

        {/* 立即开通(对齐 Uniapp details-button / openIntroduces;后端依赖:开通/跳转逻辑预留 onPressUpgrade) */}
        {onPressUpgrade ? (
          <Pressable
            style={({ pressed }) => [styles.openBtn, pressed ? styles.pressed : null]}
            onPress={onPressUpgrade}
            accessibilityRole="button"
            accessibilityLabel="立即开通"
          >
            <Text style={styles.openBtnText}>立即开通</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.surface.card,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  } as ViewStyle,
  levelText: {
    fontSize: 16,
    fontWeight: '600',
  } as TextStyle,
  expireText: {
    fontSize: 12,
    color: tokens.text.tertiary,
  } as TextStyle,
  benefitList: {
    gap: 10,
  } as ViewStyle,
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: tokens.surface.muted,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  } as ViewStyle,
  benefitIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  benefitContent: {
    flex: 1,
    gap: 2,
  } as ViewStyle,
  benefitTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: tokens.text.primary,
  } as TextStyle,
  benefitDesc: {
    fontSize: 12,
    color: tokens.text.secondary,
  } as TextStyle,
  // ── 权益对比表 ──
  compareSection: {
    backgroundColor: tokens.surface.muted,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: tokens.border.light,
  } as ViewStyle,
  promoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.text.primary,
  } as TextStyle,
  priceBlock: {
    gap: 4,
  } as ViewStyle,
  priceRow: {
    fontSize: 14,
    fontWeight: '600',
  } as TextStyle,
  priceStrike: {
    textDecorationLine: 'line-through',
  } as TextStyle,
  table: {
    gap: 0,
  } as ViewStyle,
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: tokens.border.light,
  } as ViewStyle,
  colTitle: {
    width: '40%',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: tokens.text.primary,
  } as TextStyle,
  colTier: {
    width: '20%',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  headerCell: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  } as TextStyle,
  tierNormal: {
    color: tokens.text.tertiary,
  } as TextStyle,
  tierMember: {
    color: GOLD,
  } as TextStyle,
  tierTrader: {
    color: tokens.success.DEFAULT,
  } as TextStyle,
  rowTitle: {
    fontWeight: '500',
  } as TextStyle,
  cellCheck: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.success.DEFAULT,
  } as TextStyle,
  cellCross: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.danger.DEFAULT,
  } as TextStyle,
  cellText: {
    fontSize: 12,
    textAlign: 'center',
    color: tokens.text.primary,
  } as TextStyle,
  openBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  } as ViewStyle,
  openBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.surface.light,
  } as TextStyle,
  pressed: { opacity: 0.85 } as ViewStyle,
})

export default UserMembershipBenefits
