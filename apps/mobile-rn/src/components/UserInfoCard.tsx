// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * UserInfoCard 用户信息卡片 (mobile-rn 端)
 * 展示用户信息:头像/昵称/等级/VIP
 *
 * 2 变体(对齐历史 Uniapp 项目):
 * - new(默认):新版,带头像 + VIP 徽章 + 等级条 + 智汇值 + 充值按钮
 * - old:旧版简化卡,无 VIP 徽章/渐变背景,仅头像 + 用户名 + VIP 文本 + token + 登出按钮
 *
 * 迁移自旧项目 Vue 组件:
 * - UserInfoCard.vue → variant='new'
 * - UserInfoCardOld.vue → variant='old'
 *
 * 共享类型 UserInfo 已下沉到 @ihui/types,消除两端数据类型重复定义。
 * 本地 Props 用 `userInfo: UserInfo` 对象结构,与 miniapp-taro 扁平 props 结构不同,
 * 不 extends UserInfoCardMinimalProps(该 Minimal 仅作语义参考)。
 */
import { useState } from 'react'
import { tokens } from '../theme/active-tokens'
import { Alert, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { DEFAULT_AVATAR_URL } from '@ihui/shared/constants'
import { formatTokenValue } from '@ihui/shared/utils'
import { getRoleLabel } from '@ihui/shared/utils'
import type { UserInfo } from '@ihui/types'
import {
  USER_INFO_CARD_ACTION_PADDING_X_PX,
  USER_INFO_CARD_ACTION_PADDING_Y_PX,
  USER_INFO_CARD_AVATAR_PX,
  USER_INFO_CARD_BADGE_PADDING_X_PX,
  USER_INFO_CARD_BADGE_PADDING_Y_PX,
  USER_INFO_CARD_GROWTH_BAR_HEIGHT_PX,
  USER_INFO_CARD_HEADER_GAP_PX,
  USER_INFO_CARD_LOGIN_FONT_PX,
  USER_INFO_CARD_LOGIN_PADDING_Y_PX,
  USER_INFO_CARD_NAME_FONT_PX,
  USER_INFO_CARD_PADDING_PX,
  USER_INFO_CARD_ROW_MARGIN_TOP_PX,
  USER_INFO_CARD_SMALL_FONT_PX,
  USER_INFO_CARD_TOKEN_FONT_PX,
  userInfoCardAvatarStyle,
} from '@ihui/shared/ui/user-info-card-spec'

import { rnRadius } from '@ihui/design-tokens'

/**
 * 头像盒子结构只在 spec 出口里摆一次(方档 + overflow + 居中),端内三个头像位
 * (可点外框 / 图片 / initials 兜底)各自 spread 它,不再逐处重摆 width/height。
 * RN 侧 1 逻辑 px = 1 dp,故投影就是恒等函数。
 */
const AVATAR_BOX = userInfoCardAvatarStyle<number>((px) => px)

// 共享类型 UserInfo 已下沉到 @ihui/types,本地 re-export 保持调用方兼容
export type { UserInfo }

/** 用户信息卡片变体 */
export type UserInfoCardVariant = 'new' | 'old'

/**
 * 取用户名首字母作为默认头像 initials(AGENTS.md 强制规范:头像用 initials)。
 * 中文取首个汉字,英文取首字母大写,空值回退 'U'。
 */
function getInitials(name?: string): string {
  if (!name) return 'U'
  const trimmed = name.trim()
  if (!trimmed) return 'U'
  return trimmed.charAt(0).toUpperCase()
}

/**
 * 格式化时间戳为本地可读格式(AGENTS.md 强制规范:时间用 Intl.DateTimeFormat)。
 * 输入可为 ISO 8601 字串或任意 Date 可解析字符串;输出 'YYYY-MM-DD HH:mm'。
 * 解析失败时回退原值,避免显示 'Invalid Date'。
 */
function formatDateTime(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return dateStr
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date)
  } catch {
    return dateStr
  }
}

export interface UserInfoCardProps {
  userInfo: UserInfo
  showRechargeBtn?: boolean
  onEdit?: () => void
  onRecharge?: () => void
  onLogin?: () => void
  /** 退订回调(对齐 Uniapp unsubscribe,仅 isVip 时显示) */
  onUnsubscribe?: () => void
  /** 邀请码复制回调(不传则内部 Alert 提示) */
  onCopyInviteCode?: (code: string) => void
  /**
   * 成长值进度条点击回调(对齐 Uniapp level-intro 入口)。
   * 未传入时点击成长值条无响应;传入则由调用方决定打开等级介绍弹窗等行为。
   */
  onLevelIntro?: () => void
  /** 变体选择,默认 'new' */
  variant?: UserInfoCardVariant
}

export default function UserInfoCard(props: UserInfoCardProps) {
  const variant = props.variant ?? 'new'
  if (variant === 'old') return <UserInfoCardOld {...props} />
  return <UserInfoCardNew {...props} />
}

// ===== 新版(variant='new',对齐 UserInfoCard.vue)=====

function UserInfoCardNew({
  userInfo,
  showRechargeBtn = true,
  onEdit,
  onRecharge,
  onLogin,
  onUnsubscribe,
  onCopyInviteCode,
  onLevelIntro,
}: UserInfoCardProps) {
  const [levelModalVisible, setLevelModalVisible] = useState(false)

  // 未登录态:显示一键登录按钮
  if (!userInfo.uuid) {
    return (
      <View style={newStyles.loggedOutWrap}>
        <TouchableOpacity style={newStyles.loginBtn} activeOpacity={0.7} onPress={onLogin}>
          <Text style={newStyles.loginBtnText}>一键登录</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const role = getRoleLabel(userInfo.isVip, userInfo.identityType)
  const isVip = userInfo.isVip === 1
  const tokenStr = formatTokenValue(userInfo.tokenQuantity)
  const hasAvatarUrl = Boolean(userInfo.avatarUrl)
  const avatar = userInfo.avatarUrl || DEFAULT_AVATAR_URL

  // 成长值进度条(对齐 Uniapp growthValue/growthMax)
  const growthValue = typeof userInfo.growthValue === 'number' ? userInfo.growthValue : undefined
  const growthMax = typeof userInfo.growthMax === 'number' ? userInfo.growthMax : undefined
  const hasGrowth = growthValue !== undefined && growthMax !== undefined && growthMax > 0
  const growthPercent = hasGrowth ? Math.min(100, Math.round((growthValue! / growthMax!) * 100)) : 0

  // 邀请码(对齐 Uniapp inviteCode)
  const inviteCode = typeof userInfo.inviteCode === 'string' ? userInfo.inviteCode : undefined

  // VIP 等级标题(对齐 Uniapp vipLevel,如"VIP1"/"SVIP")
  const vipLevel = typeof userInfo.vipLevel === 'string' ? userInfo.vipLevel : undefined
  const vipExpireAt = typeof userInfo.vipExpireAt === 'string' ? userInfo.vipExpireAt : undefined

  const handleCopyInviteCode = () => {
    if (!inviteCode) return
    if (onCopyInviteCode) {
      onCopyInviteCode(inviteCode)
    } else {
      Alert.alert('邀请码', `邀请码:${inviteCode}\n(长按复制)`)
    }
  }

  const handleRoleBadgePress = () => {
    setLevelModalVisible(true)
  }

  return (
    <View style={newStyles.card}>
      {/* 顶部:头像 + 昵称/角色 */}
      <View style={newStyles.header}>
        <TouchableOpacity style={newStyles.avatarWrap} activeOpacity={0.8} onPress={onEdit}>
          {hasAvatarUrl ? (
            <Image source={{ uri: avatar }} style={newStyles.avatar} />
          ) : (
            <View style={newStyles.avatarFallback}>
              <Text style={newStyles.avatarFallbackText}>{getInitials(userInfo.username)}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={newStyles.infoWrap}>
          <TouchableOpacity style={newStyles.nameRow} activeOpacity={0.7} onPress={onEdit}>
            <Text style={newStyles.name} numberOfLines={1} ellipsizeMode="tail">
              {userInfo.username ? `AI IHUI丨${userInfo.username}` : '用户'}
            </Text>
            {showRechargeBtn ? <Text style={newStyles.editText}>编辑</Text> : null}
          </TouchableOpacity>

          <View style={newStyles.roleRow}>
            <TouchableOpacity
              style={[newStyles.roleBadge, isVip ? newStyles.roleBadgeVip : null]}
              activeOpacity={0.7}
              onPress={handleRoleBadgePress}
            >
              <Text style={[newStyles.roleText, isVip ? newStyles.roleTextVip : null]}>
                {vipLevel || role}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 成长值进度条(对齐 Uniapp growthValue/growthMax);点击触发等级介绍 onLevelIntro */}
      {hasGrowth ? (
        <TouchableOpacity
          style={newStyles.growthRow}
          activeOpacity={0.7}
          onPress={onLevelIntro}
          disabled={!onLevelIntro}
          accessibilityLabel="成长值进度条,点击查看等级介绍"
          accessibilityRole="button"
        >
          <View style={newStyles.growthLabelWrap}>
            <Text style={newStyles.growthLabel}>成长值</Text>
            <Text style={newStyles.growthValue}>
              {growthValue}/{growthMax}
            </Text>
          </View>
          <View style={newStyles.growthBarBg}>
            <View style={[newStyles.growthBarFill, { width: `${growthPercent}%` }]} />
          </View>
        </TouchableOpacity>
      ) : null}

      {/* 邀请码(对齐 Uniapp inviteCode,带复制提示) */}
      {inviteCode ? (
        <View style={newStyles.inviteRow}>
          <Text style={newStyles.inviteLabel}>邀请码:</Text>
          <Text style={newStyles.inviteCode}>{inviteCode}</Text>
          <TouchableOpacity
            style={newStyles.copyBtn}
            activeOpacity={0.7}
            onPress={handleCopyInviteCode}
          >
            <Text style={newStyles.copyBtnText}>复制</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 智汇值 + 充值按钮(背景色对比分隔,非分割线) */}
      <View style={newStyles.tokenRow}>
        <View style={newStyles.tokenLabelWrap}>
          <Text style={newStyles.tokenLabel}>剩余智汇值:</Text>
          <Text style={newStyles.tokenValue}>{tokenStr}</Text>
        </View>
        {showRechargeBtn ? (
          <TouchableOpacity style={newStyles.rechargeBtn} activeOpacity={0.7} onPress={onRecharge}>
            <Text style={newStyles.rechargeBtnText}>充值</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 退订按钮(对齐 Uniapp unsubscribe,仅 VIP 时显示) */}
      {isVip && onUnsubscribe ? (
        <TouchableOpacity
          style={newStyles.unsubscribeBtn}
          activeOpacity={0.7}
          onPress={onUnsubscribe}
        >
          <Text style={newStyles.unsubscribeText}>退订</Text>
        </TouchableOpacity>
      ) : null}

      {/* 等级弹窗(对齐 Uniapp levelPopup,点击角色徽章触发) */}
      <Modal
        visible={levelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLevelModalVisible(false)}
      >
        <TouchableOpacity
          style={newStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLevelModalVisible(false)}
        >
          <View style={newStyles.modalCard}>
            <Text style={newStyles.modalTitle}>
              {vipLevel || (isVip ? 'VIP 会员' : '普通会员')}
            </Text>
            {isVip && vipExpireAt ? (
              <Text style={newStyles.modalExpireText}>到期时间:{formatDateTime(vipExpireAt)}</Text>
            ) : null}
            <Text style={newStyles.modalDesc}>
              {isVip
                ? '您当前为 VIP 会员,享受专属权益。继续积累成长值可升级至更高等级。'
                : '您当前为普通会员,升级 VIP 可享受更多权益。'}
            </Text>
            <View style={newStyles.modalBenefitList}>
              <Text style={newStyles.modalBenefitItem}>· AI 助手免费次数增加</Text>
              <Text style={newStyles.modalBenefitItem}>· 部分课程免费学习</Text>
              <Text style={newStyles.modalBenefitItem}>· 建立专属知识库</Text>
            </View>
            <TouchableOpacity
              style={newStyles.modalCloseBtn}
              activeOpacity={0.7}
              onPress={() => setLevelModalVisible(false)}
            >
              <Text style={newStyles.modalCloseBtnText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

/**
 * 本表里**刻意仍写着数字**的档位,逐条给出去向(不是漏改):
 *  - `paddingHorizontal: 32`(两枚登录钮)/ `paddingVertical: 4`(nameRow)/ `paddingHorizontal: 8`
 *    + `paddingVertical: 6`(tokenRow / growthRow / inviteRow 的 muted 面板)/ `marginLeft: 4` × 3
 *    + `marginBottom: 4` × 2 / 弹窗整套(`padding: 20`、`fontSize: 18`、`paddingHorizontal: 24`、
 *    `paddingVertical: 8`、`fontSize: 14`、`marginBottom: 16`、`gap: 6`、`lineHeight: 20`)
 *    / initials(`fontSize: 32`、旧变体 `28`)。
 *  共同锚里没有对应的档,原因只有两种:① **小程序端根本不渲染这一格**(登录钮的胶囊横向档、
 *  等级弹窗、邀请码行、initials 兜底、旧变体 —— spec 文件末差异登记第 1/3/4 条);
 *  ② **另一端同一属性没有额外一档**(行级面板容器、nameRow 的上下档 —— 小程序端那些行是平的,
 *  差异登记第 5 条)。把它们搬进 spec 只会让守门 128 看不见,屏幕上什么都不会变 ——
 *  那正是这道门(守门 128 跨端 UI 单一源对账)的失效模式,故宁可留着数字并点名。
 *  另:`marginLeft: 4` / `marginBottom: 4` 与小程序端 `gap-1` / `mb-1` **屏幕同值**,
 *  只是门的类名正则读不到 `gap-*` / `mb-*`(差异登记第 6 条),属测量残留,不是分叉。
 */
const newStyles = StyleSheet.create({
  loggedOutWrap: {
    marginTop: 8,
    alignItems: 'center',
  },
  loginBtn: {
    backgroundColor: tokens.brand.cta,
    borderWidth: 2,
    // 描边不得取墨档 text.primary(亮 #0A0A0A / 暗 #FAFAFA)——项目设计里没有纯黑描边;
    // 本块填充就是 brand.cta,描边同色即"加厚",两态观感与改前一致且不再出现墨档
    borderColor: tokens.brand.cta,
    borderRadius: rnRadius.xl,
    // 上下内边距与小程序端同档(原写死 14,小程序 `py-3` 是 12 ⇒ 同一按钮两个数);
    // 左右 32 是本端胶囊形态,按 spec 文件末差异登记保持不动
    paddingVertical: USER_INFO_CARD_LOGIN_PADDING_Y_PX,
    paddingHorizontal: 32,
  },
  loginBtnText: {
    // 字号唯一源 user-info-card-spec(与小程序端同档)
    fontSize: USER_INFO_CARD_LOGIN_FONT_PX,
    fontWeight: '600',
    color: tokens.brand.ctaForeground,
  },
  card: {
    marginTop: 8,
    padding: USER_INFO_CARD_PADDING_PX,
    borderRadius: rnRadius.xl,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  avatarWrap: {
    // 盒子结构(边长 + overflow + 居中)取自 spec 出口,端内不重摆;
    // 48dp 的唯一源在 user-info-card-spec(≥44 命中块 + Tailwind 整档,与小程序端同值;
    // 原 rpx(163)≈81.5 是 Uniapp 旧稿换算 hack,非注册档,已收口)
    ...AVATAR_BOX,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.surface.card,
    borderWidth: 1,
    borderColor: tokens.brandAccent.light,
  },
  avatar: {
    // ImageStyle 不吃居中/display 那几项(硬 spread 会被 tsc 判死),故这里只取边长档本身,
    // 数字仍住在 spec 常量里 —— 端内没有第二个 48
    width: USER_INFO_CARD_AVATAR_PX,
    height: USER_INFO_CARD_AVATAR_PX,
    resizeMode: 'cover',
  },
  // 无头像 URL 时的 initials 兜底:品牌色底 + 深色文字,深/浅色模式均可见
  avatarFallback: {
    ...AVATAR_BOX,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.brandAccent.DEFAULT,
  },
  avatarFallbackText: {
    // initials 字号:小程序端这一格落的是默认位图头像、根本没有 initials 可渲染
    // ⇒ 单侧档,不进共同锚表(spec 文件末差异登记第 4 条);旧变体同一角色写着 28,是本文件内
    //    的端内一致性缺陷,已登记待组件源统一票处理,不在此凭空立档
    fontSize: 32,
    fontWeight: '700',
    color: tokens.brandAccent.foreground,
  },
  infoWrap: {
    flex: 1,
    marginLeft: USER_INFO_CARD_HEADER_GAP_PX,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  name: {
    flex: 1,
    fontSize: USER_INFO_CARD_NAME_FONT_PX,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  editText: {
    fontSize: USER_INFO_CARD_SMALL_FONT_PX,
    color: tokens.brandAccent.deep,
    marginLeft: 4,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: USER_INFO_CARD_ROW_MARGIN_TOP_PX,
  },
  roleBadge: {
    paddingHorizontal: USER_INFO_CARD_BADGE_PADDING_X_PX,
    paddingVertical: USER_INFO_CARD_BADGE_PADDING_Y_PX,
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.xs,
  },
  roleBadgeVip: {
    backgroundColor: tokens.warning.light,
  },
  roleText: {
    fontSize: USER_INFO_CARD_SMALL_FONT_PX,
    fontWeight: '500',
    color: tokens.text.secondary,
  },
  roleTextVip: {
    color: tokens.warning.DEFAULT,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: USER_INFO_CARD_ROW_MARGIN_TOP_PX,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.md,
  },
  tokenLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenLabel: {
    fontSize: USER_INFO_CARD_TOKEN_FONT_PX,
    color: tokens.brandAccent.deep,
  },
  tokenValue: {
    fontSize: USER_INFO_CARD_TOKEN_FONT_PX,
    fontWeight: '700',
    color: tokens.brandAccent.deep,
    marginLeft: 4,
  },
  rechargeBtn: {
    paddingHorizontal: USER_INFO_CARD_ACTION_PADDING_X_PX,
    paddingVertical: USER_INFO_CARD_ACTION_PADDING_Y_PX,
    backgroundColor: tokens.brandAccent.DEFAULT,
    borderRadius: rnRadius.md,
  },
  rechargeBtnText: {
    fontSize: USER_INFO_CARD_SMALL_FONT_PX,
    color: tokens.brandAccent.foreground,
    fontWeight: '500',
  },
  unsubscribeBtn: {
    alignSelf: 'flex-end',
    // 与上一行的间距:此前写着 6(小程序端的操作按钮行是 8),同一属性漏改的第二个数,已归到行档
    marginTop: USER_INFO_CARD_ROW_MARGIN_TOP_PX,
    paddingHorizontal: USER_INFO_CARD_ACTION_PADDING_X_PX,
    paddingVertical: USER_INFO_CARD_ACTION_PADDING_Y_PX,
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.text.tertiary,
  },
  unsubscribeText: {
    fontSize: USER_INFO_CARD_SMALL_FONT_PX,
    color: tokens.text.tertiary,
  },
  // 成长值进度条
  // 条粗细两端原分叉:小程序 `h-2` = 8 / RN 这里写 4 ⇒ 现同一档 spec GROWTH_BAR_HEIGHT(8)。
  // 细于 8 的进度条在触屏上几乎看不见,故按规则 2 取较大者;改它只改 spec 一处。
  growthRow: {
    marginTop: USER_INFO_CARD_ROW_MARGIN_TOP_PX,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.md,
  },
  growthLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  growthLabel: {
    fontSize: USER_INFO_CARD_SMALL_FONT_PX,
    color: tokens.text.secondary,
  },
  growthValue: {
    fontSize: USER_INFO_CARD_SMALL_FONT_PX,
    fontWeight: '600',
    color: tokens.brandAccent.deep,
  },
  growthBarBg: {
    height: USER_INFO_CARD_GROWTH_BAR_HEIGHT_PX,
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.xs,
    overflow: 'hidden',
  },
  growthBarFill: {
    height: USER_INFO_CARD_GROWTH_BAR_HEIGHT_PX,
    backgroundColor: tokens.brandAccent.DEFAULT,
    borderRadius: rnRadius.xs,
  },
  // 邀请码
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.md,
  },
  inviteLabel: {
    fontSize: USER_INFO_CARD_SMALL_FONT_PX,
    color: tokens.text.secondary,
  },
  inviteCode: {
    flex: 1,
    fontSize: USER_INFO_CARD_SMALL_FONT_PX,
    fontWeight: '600',
    color: tokens.text.primary,
    marginLeft: 4,
  },
  // 复制钮的 8/2 与徽章档同值,但它是单侧结构(小程序端没有邀请码行)⇒ 保持本端数字,
  // 见 spec 文件末差异登记第 3 条
  copyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: tokens.brandAccent.light,
    borderRadius: rnRadius.sm,
  },
  // 此前写着 11(低于 spec 的可读下限 12),属"该端没改成引用",不是另有属性
  copyBtnText: {
    fontSize: USER_INFO_CARD_SMALL_FONT_PX,
    color: tokens.brandAccent.foreground,
    fontWeight: '500',
  },
  // 等级弹窗
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '80%',
    backgroundColor: tokens.surface.card,
    borderRadius: rnRadius.xl,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.text.primary,
    marginBottom: 8,
  },
  modalExpireText: {
    fontSize: USER_INFO_CARD_SMALL_FONT_PX,
    color: tokens.text.tertiary,
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: USER_INFO_CARD_SMALL_FONT_PX,
    color: tokens.text.secondary,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  modalBenefitList: {
    alignSelf: 'stretch',
    gap: 6,
    marginBottom: 16,
  },
  modalBenefitItem: {
    fontSize: USER_INFO_CARD_SMALL_FONT_PX,
    color: tokens.text.primary,
  },
  modalCloseBtn: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    backgroundColor: tokens.brandAccent.DEFAULT,
    borderRadius: rnRadius.xl,
  },
  modalCloseBtnText: {
    fontSize: 14,
    color: tokens.brandAccent.foreground,
    fontWeight: '600',
  },
})

// ===== 旧版(variant='old',对齐 UserInfoCardOld.vue)=====

function UserInfoCardOld({ userInfo, showRechargeBtn = true, onEdit, onLogin }: UserInfoCardProps) {
  // 未登录态:显示登录按钮
  if (!userInfo.uuid) {
    return (
      <View style={oldStyles.loggedOutWrap}>
        <TouchableOpacity style={oldStyles.loginBtn} activeOpacity={0.7} onPress={onLogin}>
          <Text style={oldStyles.loginBtnText}>登录</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const isVip = userInfo.isVip === 1
  const tokenStr = formatTokenValue(userInfo.tokenQuantity)
  const hasAvatarUrl = Boolean(userInfo.avatarUrl)
  const avatar = userInfo.avatarUrl || DEFAULT_AVATAR_URL

  return (
    <View style={oldStyles.card}>
      {/* 头部:用户名 + 编辑按钮 */}
      <View style={oldStyles.header}>
        <Text style={oldStyles.username} numberOfLines={1} ellipsizeMode="tail">
          {userInfo.username ? `AI IHUI丨${userInfo.username}` : '用户'}
        </Text>
        {showRechargeBtn ? (
          <TouchableOpacity style={oldStyles.editBtn} activeOpacity={0.7} onPress={onEdit}>
            <Text style={oldStyles.editBtnText}>修改资料</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 会员状态(简化文本,无徽章) */}
      <View style={oldStyles.membershipRow}>
        <Text style={oldStyles.membershipText}>{isVip ? '' : '未开通会员'}</Text>
        {isVip ? <Text style={oldStyles.vipText}>VIP</Text> : null}
      </View>

      {/* 头像区:无 avatarUrl 时显示 initials 兜底,避免深色背景纯黑块 */}
      <View style={oldStyles.avatarSection}>
        {hasAvatarUrl ? (
          <Image source={{ uri: avatar }} style={oldStyles.avatar} />
        ) : (
          <View style={oldStyles.avatarFallback}>
            <Text style={oldStyles.avatarFallbackText}>{getInitials(userInfo.username)}</Text>
          </View>
        )}
        <Text style={oldStyles.userId}>ID:{userInfo.uuid}</Text>
      </View>

      {/* Token 信息(背景色对比分隔,非分割线) */}
      <View style={oldStyles.tokenInfo}>
        <Text style={oldStyles.tokenLabel}>我的剩余token值</Text>
        <Text style={oldStyles.tokenValue}>{tokenStr}</Text>
      </View>
    </View>
  )
}

const oldStyles = StyleSheet.create({
  loggedOutWrap: {
    marginTop: 8,
    alignItems: 'center',
  },
  loginBtn: {
    backgroundColor: tokens.brand.cta,
    borderWidth: 2,
    // 描边不得取墨档 text.primary(亮 #0A0A0A / 暗 #FAFAFA)——项目设计里没有纯黑描边;
    // 本块填充就是 brand.cta,描边同色即"加厚",两态观感与改前一致且不再出现墨档
    borderColor: tokens.brand.cta,
    borderRadius: rnRadius.xl,
    // 旧变体此前写着 12,而新变体(同一枚登录钮、同一个属性)是 spec 档 ⇒ 收口到同一处
    paddingVertical: USER_INFO_CARD_LOGIN_PADDING_Y_PX,
    paddingHorizontal: 32,
  },
  loginBtnText: {
    fontSize: USER_INFO_CARD_LOGIN_FONT_PX,
    fontWeight: '600',
    color: tokens.brand.ctaForeground,
  },
  card: {
    marginTop: 8,
    // 卡片内边距唯一源 = spec(web `p-3` 同值 12);旧变体此前写 16,是同一根容器的第二个数
    padding: USER_INFO_CARD_PADDING_PX,
    borderRadius: rnRadius.xl,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  username: {
    flex: 1,
    // 昵称字号唯一源 = spec(旧变体此前写 16,与新变体的 14 分叉)
    fontSize: USER_INFO_CARD_NAME_FONT_PX,
    fontWeight: '700',
    color: tokens.text.primary,
  },
  editBtn: {
    backgroundColor: tokens.brandAccent.light,
    borderRadius: rnRadius.xl,
    // 操作按钮内边距与 spec 的 ACTION 档同值(旧变体此前写 12/6,6 低于其它钮的 4 档)
    paddingHorizontal: USER_INFO_CARD_ACTION_PADDING_X_PX,
    paddingVertical: USER_INFO_CARD_ACTION_PADDING_Y_PX,
  },
  editBtnText: {
    fontSize: USER_INFO_CARD_SMALL_FONT_PX,
    fontWeight: '500',
    color: tokens.brandAccent.foreground,
  },
  membershipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  membershipText: {
    fontSize: USER_INFO_CARD_SMALL_FONT_PX,
    color: tokens.text.secondary,
  },
  vipText: {
    fontSize: USER_INFO_CARD_SMALL_FONT_PX,
    fontWeight: '700',
    color: tokens.warning.DEFAULT,
    marginLeft: 4,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    // 头像槽位唯一源 = spec(旧变体此前另写 64,与新变体的 48 是同一角色的第二个数)
    width: USER_INFO_CARD_AVATAR_PX,
    height: USER_INFO_CARD_AVATAR_PX,
    borderRadius: rnRadius.xl,
    borderWidth: 2,
    borderColor: tokens.surface.light,
    backgroundColor: tokens.surface.card,
    marginBottom: 4,
  },
  // 无头像 URL 时的 initials 兜底:品牌色底 + 深色文字,深/浅色模式均可见
  avatarFallback: {
    ...AVATAR_BOX,
    borderRadius: rnRadius.xl,
    backgroundColor: tokens.brandAccent.DEFAULT,
    marginBottom: 4,
  },
  avatarFallbackText: {
    // initials 字号是单侧档(小程序端无头像 URL 时落默认位图,根本不渲染 initials)——
    // 见 spec 文件末差异登记第 4 条。它与新变体同角色写的 32 是本文件内的端内一致性缺陷,
    // 不是两端分叉,留给组件源统一票裁,不在此凭空立档。
    fontSize: 28,
    fontWeight: '700',
    color: tokens.brandAccent.foreground,
  },
  userId: {
    // 此前写着 11,低于 spec 可读下限 12 ⇒ 属"该端没改成引用"
    fontSize: USER_INFO_CARD_SMALL_FONT_PX,
    color: tokens.text.tertiary,
  },
  tokenInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // 面板内边距:旧变体写 8/12、新变体 tokenRow 写 8/6 —— 两个变体各自为政,而共同锚没有
    // "行级面板内边距"这一档(小程序端这些行没有面板容器),故按单侧结构登记、不在此统一
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.xl,
  },
  tokenLabel: {
    fontSize: USER_INFO_CARD_SMALL_FONT_PX,
    color: tokens.text.primary,
  },
  tokenValue: {
    fontSize: USER_INFO_CARD_SMALL_FONT_PX,
    fontWeight: '600',
    color: tokens.text.primary,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
