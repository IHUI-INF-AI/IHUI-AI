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
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { Alert, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { DEFAULT_AVATAR_URL } from '@ihui/shared/constants'
import { formatTokenValue } from '@ihui/shared/utils'
import { getRoleLabel } from '@ihui/shared/utils'
import type { UserInfo } from '@ihui/types'

// 共享类型 UserInfo 已下沉到 @ihui/types,本地 re-export 保持调用方兼容
export type { UserInfo }

/** 用户信息卡片变体 */
export type UserInfoCardVariant = 'new' | 'old'

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
          <Image source={{ uri: avatar }} style={newStyles.avatar} />
        </TouchableOpacity>

        <View style={newStyles.infoWrap}>
          <TouchableOpacity style={newStyles.nameRow} activeOpacity={0.7} onPress={onEdit}>
            <Text style={newStyles.name} numberOfLines={1}>
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
              <Text style={newStyles.modalExpireText}>到期时间:{vipExpireAt}</Text>
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

const newStyles = StyleSheet.create({
  loggedOutWrap: {
    marginTop: 8,
    alignItems: 'center',
  },
  loginBtn: {
    backgroundColor: tokens.surface.light,
    borderWidth: 2,
    borderColor: tokens.text.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  card: {
    marginTop: 8,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: 'rgba(195, 190, 255, 0.15)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  avatarWrap: {
    width: 60,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: tokens.surface.light,
    borderWidth: 1,
    borderColor: tokens.indigo.light,
  },
  avatar: {
    width: 60,
    height: 60,
    resizeMode: 'cover',
  },
  infoWrap: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  name: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  editText: {
    fontSize: 12,
    color: tokens.indigo.DEFAULT,
    marginLeft: 4,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: tokens.surface.card,
    borderRadius: 2,
  },
  roleBadgeVip: {
    backgroundColor: tokens.warning.light,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '500',
    color: tokens.gray[600],
  },
  roleTextVip: {
    color: tokens.warning.DEFAULT,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 6,
  },
  tokenLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenLabel: {
    fontSize: 12,
    color: tokens.indigo.DEFAULT,
  },
  tokenValue: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.indigo.DEFAULT,
    marginLeft: 4,
  },
  rechargeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: tokens.indigo.DEFAULT,
    borderRadius: 6,
  },
  rechargeBtnText: {
    fontSize: 12,
    color: tokens.surface.light,
    fontWeight: '500',
  },
  unsubscribeBtn: {
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: tokens.text.tertiary,
  },
  unsubscribeText: {
    fontSize: 11,
    color: tokens.text.tertiary,
  },
  // 成长值进度条
  growthRow: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 6,
  },
  growthLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  growthLabel: {
    fontSize: 11,
    color: tokens.text.secondary,
  },
  growthValue: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.indigo.DEFAULT,
  },
  growthBarBg: {
    height: 4,
    backgroundColor: tokens.surface.muted,
    borderRadius: 2,
    overflow: 'hidden',
  },
  growthBarFill: {
    height: 4,
    backgroundColor: tokens.indigo.DEFAULT,
    borderRadius: 2,
  },
  // 邀请码
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 6,
  },
  inviteLabel: {
    fontSize: 12,
    color: tokens.text.secondary,
  },
  inviteCode: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: tokens.text.primary,
    marginLeft: 4,
  },
  copyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: tokens.indigo.light,
    borderRadius: 4,
  },
  copyBtnText: {
    fontSize: 11,
    color: tokens.surface.light,
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
    borderRadius: 12,
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
    fontSize: 12,
    color: tokens.text.tertiary,
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 12,
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
    fontSize: 12,
    color: tokens.text.primary,
  },
  modalCloseBtn: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    backgroundColor: tokens.indigo.DEFAULT,
    borderRadius: 12,
  },
  modalCloseBtnText: {
    fontSize: 14,
    color: tokens.surface.light,
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
  const avatar = userInfo.avatarUrl || DEFAULT_AVATAR_URL

  return (
    <View style={oldStyles.card}>
      {/* 头部:用户名 + 编辑按钮 */}
      <View style={oldStyles.header}>
        <Text style={oldStyles.username} numberOfLines={1}>
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

      {/* 头像区 */}
      <View style={oldStyles.avatarSection}>
        <Image source={{ uri: avatar }} style={oldStyles.avatar} />
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
    backgroundColor: tokens.surface.light,
    borderWidth: 2,
    borderColor: tokens.text.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  card: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.light,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  username: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: tokens.text.primary,
  },
  editBtn: {
    backgroundColor: tokens.indigo.light,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: tokens.surface.light,
  },
  membershipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  membershipText: {
    fontSize: 12,
    color: tokens.text.secondary,
  },
  vipText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.warning.DEFAULT,
    marginLeft: 4,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: tokens.surface.light,
    backgroundColor: tokens.surface.card,
    marginBottom: 4,
  },
  userId: {
    fontSize: 11,
    color: tokens.text.tertiary,
  },
  tokenInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: tokens.surface.muted,
    borderRadius: 12,
  },
  tokenLabel: {
    fontSize: 12,
    color: tokens.text.primary,
  },
  tokenValue: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.text.primary,
  },
})
