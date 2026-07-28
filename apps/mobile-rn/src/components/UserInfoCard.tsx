/**
 * UserInfoCard 用户信息卡片 (mobile-rn 端)
 * 展示用户信息:头像/昵称/等级/VIP
 * 保留卡片样式
 * 迁移自旧项目 Vue 组件 (Ai-WXMiniVue/src/components/UserInfoCard/UserInfoCard.vue)
 *
 * 共享类型 UserInfo 已下沉到 @ihui/types,消除两端数据类型重复定义。
 * 本地 Props 用 `userInfo: UserInfo` 对象结构,与 miniapp-taro 扁平 props 结构不同,
 * 不 extends UserInfoCardMinimalProps(该 Minimal 仅作语义参考)。
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { DEFAULT_AVATAR_URL } from '@ihui/shared/constants'
import { formatTokenValue } from '@ihui/shared/utils'
import { getRoleLabel } from '@ihui/shared/utils'
import type { UserInfo } from '@ihui/types'

// 共享类型 UserInfo 已下沉到 @ihui/types,本地 re-export 保持调用方兼容
export type { UserInfo }

export interface UserInfoCardProps {
  userInfo: UserInfo
  showRechargeBtn?: boolean
  onEdit?: () => void
  onRecharge?: () => void
  onLogin?: () => void
}

export default function UserInfoCard({
  userInfo,
  showRechargeBtn = true,
  onEdit,
  onRecharge,
  onLogin,
}: UserInfoCardProps) {
  // 未登录态:显示一键登录按钮
  if (!userInfo.uuid) {
    return (
      <View style={styles.loggedOutWrap}>
        <TouchableOpacity style={styles.loginBtn} activeOpacity={0.7} onPress={onLogin}>
          <Text style={styles.loginBtnText}>一键登录</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const role = getRoleLabel(userInfo.isVip, userInfo.identityType)
  const isVip = userInfo.isVip === 1
  const tokenStr = formatTokenValue(userInfo.tokenQuantity)
  const avatar = userInfo.avatarUrl || DEFAULT_AVATAR_URL

  return (
    <View style={styles.card}>
      {/* 顶部:头像 + 昵称/角色 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.avatarWrap} activeOpacity={0.8} onPress={onEdit}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
        </TouchableOpacity>

        <View style={styles.infoWrap}>
          <TouchableOpacity style={styles.nameRow} activeOpacity={0.7} onPress={onEdit}>
            <Text style={styles.name} numberOfLines={1}>
              AI IHUI丨{userInfo.username || '用户'}
            </Text>
            {showRechargeBtn ? <Text style={styles.editText}>编辑</Text> : null}
          </TouchableOpacity>

          <View style={styles.roleRow}>
            <View style={[styles.roleBadge, isVip ? styles.roleBadgeVip : null]}>
              <Text style={[styles.roleText, isVip ? styles.roleTextVip : null]}>{role}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 智汇值 + 充值按钮(背景色对比分隔,非分割线) */}
      <View style={styles.tokenRow}>
        <View style={styles.tokenLabelWrap}>
          <Text style={styles.tokenLabel}>剩余智汇值:</Text>
          <Text style={styles.tokenValue}>{tokenStr}</Text>
        </View>
        {showRechargeBtn ? (
          <TouchableOpacity style={styles.rechargeBtn} activeOpacity={0.7} onPress={onRecharge}>
            <Text style={styles.rechargeBtnText}>充值</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
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
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: tokens.surface.light,
    borderWidth: 1,
    borderColor: tokens.indigo.light,
  },
  avatar: {
    width: 56,
    height: 56,
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
    fontSize: 14,
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
})
