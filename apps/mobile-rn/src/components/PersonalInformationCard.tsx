/**
 * PersonalInformationCard 个人信息卡片 (mobile-rn 端)
 *
 * 对齐历史 Uniapp PersonalInformationCard/index.vue —— 语义为「收入卡」:
 * - 背景图 + 昵称头像(顶部)
 * - 累计收入(元) / 可提现金额(金额为「分」,前端 formatPrice 分→元)
 * - 提现按钮(实名认证校验 / 微信商家转账 / 跳转提现页 均为后端能力,用 onWithdraw 回调预留)
 *
 * 兼容保留原「分销者卡」props(inviteCode / commissionRate / level 均改为可选),
 * 避免 DistributionScreen 等调用方报错;调用方未传收入字段时,收入卡按默认 0.00 展示。
 *
 * 设计原则(对齐 rnLightTokens,禁用 purple/indigo):
 * - 背景用原图 bjcspNew.jpg(已拷贝至 assets/images/common),文字走 surface.light 对比白
 * - 金额字号 22,正文 14,rpx→dp 2:1
 * - 系统字体(不显式指定 fontFamily,走平台默认)
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import {
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { DEFAULT_AVATAR_URL } from '@ihui/shared/constants'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BG_IMAGE = require('../../assets/images/common/bjcspNew.jpg')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WITHDRAW_IMAGE = require('../../assets/images/common/tixian.jpg')

export interface PersonalInformationCardProps {
  /** 头像地址(收入卡顶部昵称旁头像) */
  avatar?: string
  /** 昵称 */
  nickname?: string
  /** [兼容] 邀请码(原分销者卡字段,可选,不再为主视觉) */
  inviteCode?: string
  /** [兼容] 佣金比例(原分销者卡字段,可选,0.2 表示 20%) */
  commissionRate?: number | string
  /** [兼容] 等级/身份标签(原分销者卡字段,可选) */
  level?: string
  /** 累计收入(单位:分,对齐原版 formatPrice 分→元) */
  totalIncome?: number | string
  /** 可提现金额(单位:分) */
  currentAmount?: number | string
  /**
   * 提现回调(待接后端):
   * - 原版点击后先做实名认证校验(certificate/username)
   * - 通过后走微信商家转账(requestMerchantTransfer)或跳转提现页 /pages/withdrawal/index
   * - 金额 <= 0 时提示「可提现金额为 0」
   * 上述逻辑依赖后端与微信能力,此处仅预留回调,由调用方注入。
   */
  onWithdraw?: () => void
}

const AVATAR_WIDTH = 36
const AVATAR_HEIGHT = 32
const AVATAR_RADIUS = 4
const CARD_RADIUS = 12
const CARD_PADDING = 16

/** 对齐原版 utils/time.js formatPrice:分 → 元,保留两位小数 */
function formatPrice(value?: number | string): string {
  const n = Number(value)
  if (!value || Number.isNaN(n)) return '0.00'
  return (n / 100).toFixed(2)
}

export function PersonalInformationCard({
  avatar,
  nickname,
  inviteCode,
  commissionRate,
  level,
  totalIncome,
  currentAmount,
  onWithdraw,
}: PersonalInformationCardProps) {
  const avatarUrl = avatar || DEFAULT_AVATAR_URL

  // 兼容原「分销者卡」字段:仅当调用方仍传入时,以次级信息行展示,避免信息丢失
  const hasLegacyInfo = Boolean(inviteCode || level || commissionRate !== undefined)

  return (
    <ImageBackground
      source={BG_IMAGE}
      style={styles.card}
      imageStyle={styles.cardImage}
      resizeMode="cover"
    >
      {/* 顶部:昵称 + 头像 */}
      <View style={styles.header}>
        <Text style={styles.nickname} numberOfLines={1}>
          {nickname || '用户'}
        </Text>
        <Image source={{ uri: avatarUrl }} style={styles.avatar} resizeMode="cover" />
      </View>

      {/* 累计收入 */}
      <View style={styles.incomeRow}>
        <Text style={styles.incomeLabel}>累计收入(元):</Text>
        <Text style={styles.incomeValue}>{formatPrice(totalIncome)}</Text>
      </View>

      {/* 可提现金额 + 提现按钮 */}
      <View style={styles.withdrawRow}>
        <View style={styles.withdrawInfo}>
          <Text style={styles.withdrawLabel}>可提现金额:</Text>
          <Text style={styles.withdrawValue}>{formatPrice(currentAmount)}</Text>
        </View>
        <Pressable
          onPress={onWithdraw}
          accessibilityRole="button"
          accessibilityLabel="提现"
          style={({ pressed }) => [styles.withdrawBtn, pressed ? styles.pressed : null]}
        >
          <Image source={WITHDRAW_IMAGE} style={styles.withdrawBtnImg} resizeMode="stretch" />
        </Pressable>
      </View>

      {/* [兼容] 原分销者卡次级字段 */}
      {hasLegacyInfo ? (
        <View style={styles.legacyRow}>
          {level ? <Text style={styles.legacyText}>{level}</Text> : null}
          {inviteCode ? <Text style={styles.legacyText}>邀请码 {inviteCode}</Text> : null}
          {commissionRate !== undefined ? (
            <Text style={styles.legacyText}>
              佣金{' '}
              {typeof commissionRate === 'number'
                ? `${(commissionRate * 100).toFixed(1)}%`
                : commissionRate}
            </Text>
          ) : null}
        </View>
      ) : null}
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
    overflow: 'hidden',
  } as ViewStyle,
  cardImage: {
    borderRadius: CARD_RADIUS,
  } as ImageStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,
  nickname: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: tokens.surface.light,
  } as TextStyle,
  avatar: {
    width: AVATAR_WIDTH,
    height: AVATAR_HEIGHT,
    borderRadius: AVATAR_RADIUS,
    backgroundColor: tokens.surface.muted,
  } as ImageStyle,
  incomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  } as ViewStyle,
  incomeLabel: {
    fontSize: 14,
    color: tokens.surface.light,
  } as TextStyle,
  incomeValue: {
    marginLeft: 8,
    fontSize: 22,
    fontWeight: '700',
    color: tokens.surface.light,
  } as TextStyle,
  withdrawRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  } as ViewStyle,
  withdrawInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  withdrawLabel: {
    fontSize: 14,
    color: tokens.surface.light,
  } as TextStyle,
  withdrawValue: {
    marginLeft: 8,
    fontSize: 22,
    fontWeight: '700',
    color: tokens.surface.light,
  } as TextStyle,
  withdrawBtn: {
    width: 60,
    height: 23,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  withdrawBtnImg: {
    width: 60,
    height: 23,
  } as ImageStyle,
  pressed: {
    opacity: 0.85,
  } as ViewStyle,
  legacyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  } as ViewStyle,
  legacyText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
  } as TextStyle,
})

export default PersonalInformationCard
