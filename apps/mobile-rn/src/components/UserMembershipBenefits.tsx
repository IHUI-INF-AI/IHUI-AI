// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * UserMembershipBenefits 会员权益展示(mobile-rn 端)
 *
 * 对齐历史 Uniapp UserMembershipBenefits/UserMembershipBenefits.vue:
 * - 当前等级权益列表(等级徽章 + 到期时间 + 图标权益清单)—— 保留既有 RN 契约
 * - 权益对比表:宣传标题「享受权益」+ 价格(含划线价)+ 普通/会员/操盘手 三档对比(勾✓/叉✗/文字)+ 立即开通按钮
 * - props:level/expireAt/benefits/onPressUpgrade 保留;新增 promoTitle/vipPrice/traderPrice/comparisonRows 可选
 * - 浅色优雅风,主题 token 入口;禁用 purple/indigo;会员金色用 #FFD700(对齐 uniapp VIP 金色语义)
 *
 * 平台特有:依赖 RN 组件,不适合共享。
 */
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import type { ReactNode } from 'react'
import { tokens } from '../theme/active-tokens'
import { Check, CircleCheck, Crown, Sparkles, X, type LucideIcon } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { useI18n } from '../i18n'

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

// 等级徽章文案:i18n 键(§19),消费处 t(LEVEL_LABEL[level]) 解析
const LEVEL_LABEL: Record<MembershipLevel, string> = {
  normal: 'memberBenefits.tnNormal',
  vip: 'memberBenefits.tnVip',
  svip: 'memberBenefits.tnSvip',
}

/** 会员金色(对齐 uniapp VIP 金色语义;禁用 purple/indigo) */
const GOLD = tokens.vip.gold

const LEVEL_COLOR: Record<MembershipLevel, string> = {
  normal: tokens.text.secondary,
  vip: GOLD,
  svip: tokens.success.deep,
}

/** 「享受权益」标题走 i18n(§19):promoTitle 未注入时由组件内 t('memberBenefits.promoTitle') 兜底 */

/**
 * 默认价格档:label 存 i18n key 后缀(§19),渲染处 PriceLine 经 t('memberBenefits.'+label) 解析。
 * price / originalPrice 是纯数字,无需翻译。外部传入的 vipPrice / traderPrice 已是成品字符串。
 */
const DEFAULT_VIP_PRICE: MembershipPrice = {
  price: '588',
  originalPrice: '1288',
  label: 'memberBenefits.vipPriceLabel',
}

const DEFAULT_TRADER_PRICE: MembershipPrice = {
  price: '3888',
  originalPrice: '18888',
  label: 'memberBenefits.traderPriceLabel',
}

/**
 * 默认三档对比表(对齐 Uniapp UserMembershipBenefits.vue listens 静态数据)。
 * 文案字段(title/normal/member/trader)存 i18n key 后缀(§19),渲染处经 t('memberBenefits.comparison.'+key) 解析;
 * 布尔档 true/false 是勾/叉语义,不是文案,不经解析。外部传入的 comparisonRows 已是成品字符串。
 */
const DEFAULT_COMPARISON_ROWS: readonly MembershipComparisonRow[] = [
  {
    title: 'comparison.r1.title',
    normal: 'comparison.r1.normal',
    member: 'comparison.r1.member',
    trader: 'comparison.r1.trader',
  },
  { title: 'comparison.r2.title', normal: false, member: true, trader: true },
  { title: 'comparison.r3.title', normal: true, member: true, trader: true },
  { title: 'comparison.r4.title', normal: true, member: true, trader: true },
  { title: 'comparison.r5.title', normal: true, member: true, trader: true },
  { title: 'comparison.r6.title', normal: false, member: true, trader: true },
  {
    title: 'comparison.r7.title',
    normal: 'comparison.r7.normal',
    member: 'comparison.r7.member',
    trader: 'comparison.r7.trader',
  },
  { title: 'comparison.r8.title', normal: false, member: false, trader: true },
  { title: 'comparison.r9.title', normal: true, member: true, trader: true },
  {
    title: 'comparison.r10.title',
    normal: 'comparison.r10.normal',
    member: 'comparison.r10.member',
    trader: 'comparison.r10.trader',
  },
  { title: 'comparison.r11.title', normal: false, member: false, trader: true },
]

function renderCell(cell: MembershipCell): ReactNode {
  if (cell === true) return <Check size={14} color={tokens.success.deepText} />
  if (cell === false) return <X size={14} color={tokens.danger.DEFAULT} />
  return <Text style={styles.cellText}>{cell}</Text>
}

function PriceLine({ price, color }: { price: MembershipPrice; color: string }) {
  const { t } = useI18n()
  return (
    <Text style={styles.priceRow}>
      <Text style={{ color }}>{t('memberBenefits.limitedTime', { price: price.price })}</Text>
      {price.originalPrice ? (
        <Text style={[styles.priceStrike, { color }]}>
          {t('memberBenefits.yuanUnit', { price: price.originalPrice })}
        </Text>
      ) : null}
      {price.label ? (
        <Text style={{ color }}>
          {/* label 带 `memberBenefits.` 前缀 = i18n key(§19),经 t 解析;外部传入的成品字符串原样渲染 */}
          {price.label.startsWith('memberBenefits.') ? t(price.label) : price.label}
        </Text>
      ) : null}
    </Text>
  )
}

export function UserMembershipBenefits({
  level,
  expireAt,
  benefits,
  onPressUpgrade,
  promoTitle,
  vipPrice = DEFAULT_VIP_PRICE,
  traderPrice = DEFAULT_TRADER_PRICE,
  comparisonRows = DEFAULT_COMPARISON_ROWS,
}: UserMembershipBenefitsProps) {
  const { t } = useI18n()
  const LevelIcon = level === 'svip' ? Sparkles : Crown
  const levelColor = LEVEL_COLOR[level]
  return (
    <View style={styles.container}>
      {/* 当前等级头部(等级徽章 + 到期时间) */}
      <View style={styles.header}>
        <View style={styles.levelBadge}>
          <LevelIcon size={16} color={levelColor} />
          <Text style={[styles.levelText, { color: levelColor }]}>{t(LEVEL_LABEL[level])}</Text>
        </View>
        {expireAt ? (
          <Text style={styles.expireText}>{`${t('memberBenefits.expirePrefix')}${expireAt}`}</Text>
        ) : null}
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
              <CircleCheck size={16} color={tokens.success.deepText} />
            </View>
          )
        })}
      </View>

      {/* 权益对比表(对齐 Uniapp UserMembershipBenefits.vue) */}
      <View style={styles.compareSection}>
        <Text style={styles.promoTitle}>{promoTitle ?? t('memberBenefits.promoTitle')}</Text>

        {/* 价格(含划线价;后端依赖:价格文案可来自配置,预留 vipPrice/traderPrice 注入) */}
        <View style={styles.priceBlock}>
          <PriceLine price={vipPrice} color={GOLD} />
          <PriceLine price={traderPrice} color={tokens.danger.DEFAULT} />
        </View>

        {/* 三档对比表:普通用户 / 会员 / 操盘手 */}
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.colTitle, styles.headerCell]}>
              {t('memberBenefits.colBenefit')}
            </Text>
            <Text style={[styles.colTier, styles.headerCell, styles.tierNormal]}>
              {t('memberBenefits.colNormal')}
            </Text>
            <Text style={[styles.colTier, styles.headerCell, styles.tierMember]}>
              {t('memberBenefits.colMember')}
            </Text>
            <Text style={[styles.colTier, styles.headerCell, styles.tierTrader]}>
              {t('memberBenefits.colTrader')}
            </Text>
          </View>
          {comparisonRows.map((row, idx) => {
            // DEFAULT_COMPARISON_ROWS 的文案字段存 i18n key 后缀(§19):真 key 带 `comparison.` 前缀,
            // 渲染处仅对带该前缀的字符串走 t() 解析;外部传入的 comparisonRows 是成品字符串
            // (不含该前缀),原样渲染,不会被误当 key 查一遍。布尔档 true/false 是勾/叉语义,不经解析。
            const cell = (v: MembershipCell): MembershipCell =>
              typeof v === 'string' && v.startsWith('comparison.') ? t(`memberBenefits.${v}`) : v
            return (
              <View key={`${row.title}-${idx}`} style={styles.tableRow}>
                <Text style={[styles.colTitle, styles.rowTitle]}>{cell(row.title)}</Text>
                <View style={styles.colTier}>{renderCell(cell(row.normal))}</View>
                <View style={styles.colTier}>{renderCell(cell(row.member))}</View>
                <View style={styles.colTier}>{renderCell(cell(row.trader))}</View>
              </View>
            )
          })}
        </View>

        {/* 立即开通(对齐 Uniapp details-button / openIntroduces;后端依赖:开通/跳转逻辑预留 onPressUpgrade) */}
        {onPressUpgrade ? (
          // 按压态不得写成「函数形态 style」挂在 Pressable 上:Pressable 注册过 cssInterop,
          // interop 对非数组声明执行「展开函数」得到空对象 ⇒ 整份内联 style 静默消失(守门 131
          // 那一型)。外框拿盒与布局(含 marginTop),面层撑满内容盒并只拿 pressed。
          <Pressable
            style={styles.openBtn}
            onPress={onPressUpgrade}
            accessibilityRole="button"
            accessibilityLabel={t('memberBenefits.openNow')}
          >
            {({ pressed }) => (
              <View style={[styles.openBtnFace, pressed ? styles.pressed : null]}>
                <Text style={styles.openBtnText}>{t('memberBenefits.openNow')}</Text>
              </View>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.surface.card,
    borderRadius: rnRadius['2xl'],
    padding: rnSpacing.lg,
    gap: rnSpacing.md,
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rnSpacing['xs-loose'],
  } as ViewStyle,
  levelText: {
    fontSize: rnType.title.size,
    fontWeight: '600',
  } as TextStyle,
  expireText: {
    fontSize: rnType.label.size,
    color: tokens.text.secondary,
  } as TextStyle,
  benefitList: {
    gap: rnSpacing['sm-loose'],
  } as ViewStyle,
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rnSpacing.md,
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.xl,
    paddingHorizontal: rnSpacing.md,
    paddingVertical: rnSpacing['sm-loose'],
  } as ViewStyle,
  benefitIconWrap: {
    width: 32,
    height: 32,
    borderRadius: rnRadius.xl,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  benefitContent: {
    flex: 1,
    gap: rnSpacing['2xs'],
  } as ViewStyle,
  benefitTitle: {
    fontSize: rnType.body.size,
    fontWeight: '500',
    color: tokens.text.primary,
  } as TextStyle,
  benefitDesc: {
    fontSize: rnType.label.size,
    color: tokens.text.secondary,
  } as TextStyle,
  // ── 权益对比表 ──
  compareSection: {
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.xl,
    padding: rnSpacing.md,
    gap: rnSpacing['sm-loose'],
    borderWidth: 1,
    borderColor: tokens.border.light,
  } as ViewStyle,
  promoTitle: {
    fontSize: rnType.title.size,
    fontWeight: '700',
    color: tokens.text.primary,
  } as TextStyle,
  priceBlock: {
    gap: rnSpacing.xs,
  } as ViewStyle,
  priceRow: {
    fontSize: rnType.body.size,
    fontWeight: '600',
  } as TextStyle,
  priceStrike: {
    textDecorationLine: 'line-through',
  } as TextStyle,
  table: {
    gap: rnSpacing.none,
  } as ViewStyle,
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: rnSpacing['xs-loose'],
  } as ViewStyle,
  colTitle: {
    width: '40%',
    textAlign: 'center',
    fontSize: rnType.bodySm.size,
    fontWeight: '600',
    color: tokens.text.primary,
  } as TextStyle,
  colTier: {
    width: '20%',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  headerCell: {
    fontSize: rnType.bodySm.size,
    fontWeight: '700',
    textAlign: 'center',
  } as TextStyle,
  tierNormal: {
    color: tokens.text.secondary,
  } as TextStyle,
  tierMember: {
    color: GOLD,
  } as TextStyle,
  tierTrader: {
    color: tokens.success.deepText,
  } as TextStyle,
  rowTitle: {
    fontWeight: '500',
  } as TextStyle,
  cellCheck: {
    fontSize: rnType.body.size,
    fontWeight: '700',
    color: tokens.success.deepText,
  } as TextStyle,
  cellCross: {
    fontSize: rnType.body.size,
    fontWeight: '700',
    color: tokens.danger.deepText,
  } as TextStyle,
  cellText: {
    fontSize: rnType.label.size,
    textAlign: 'center',
    color: tokens.text.primary,
  } as TextStyle,
  openBtn: {
    height: 44,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brandAccent.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: rnSpacing['2xs'],
  } as ViewStyle,
  // 面层:撑满外框内容盒,承载按压态(见上方守门 131 说明)。
  openBtnFace: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  openBtnText: {
    fontSize: rnType.body.size,
    fontWeight: '600',
    color: tokens.brandAccent.foreground,
  } as TextStyle,
  pressed: { opacity: 0.85 } as ViewStyle,
})

export default UserMembershipBenefits
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
