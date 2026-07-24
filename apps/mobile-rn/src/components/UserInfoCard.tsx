/**
 * UserInfoCard 用户信息卡片 (mobile-rn 端)
 * 展示用户信息:头像/昵称/等级/VIP
 * 保留卡片样式
 * 迁移自旧项目 Vue 组件 (Ai-WXMiniVue/src/components/UserInfoCard/UserInfoCard.vue)
 */
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export interface UserInfo {
  uuid?: string
  username?: string
  avatarUrl?: string
  isVip?: number
  identityType?: number
  tokenQuantity?: number | string
  [key: string]: unknown
}

export interface UserInfoCardProps {
  userInfo: UserInfo
  showRechargeBtn?: boolean
  onEdit?: () => void
  onRecharge?: () => void
  onLogin?: () => void
}

const AVATAR_FALLBACK = 'https://file.aizhs.top/sys-mini/daixaodiming.png'

function formatTokenValue(value: number | string | undefined): string {
  if (value === undefined || value === null) return '0'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0'
  if (num >= 100000000) return (num / 100000000).toFixed(2) + '亿'
  if (num >= 10000) return (num / 10000).toFixed(2) + '万'
  return String(Math.floor(num))
}

function getRoleLabel(isVip?: number, identityType?: number): string {
  if (isVip === 1 && identityType === 1) return '操盘手'
  if (isVip === 1) return '会员'
  return '普通用户'
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
        <TouchableOpacity
          style={styles.loginBtn}
          activeOpacity={0.7}
          onPress={onLogin}
        >
          <Text style={styles.loginBtnText}>一键登录</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const role = getRoleLabel(userInfo.isVip, userInfo.identityType)
  const isVip = userInfo.isVip === 1
  const tokenStr = formatTokenValue(userInfo.tokenQuantity)
  const avatar = userInfo.avatarUrl || AVATAR_FALLBACK

  return (
    <View style={styles.card}>
      {/* 顶部:头像 + 昵称/角色 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.avatarWrap}
          activeOpacity={0.8}
          onPress={onEdit}
        >
          <Image source={{ uri: avatar }} style={styles.avatar} />
        </TouchableOpacity>

        <View style={styles.infoWrap}>
          <TouchableOpacity
            style={styles.nameRow}
            activeOpacity={0.7}
            onPress={onEdit}
          >
            <Text style={styles.name} numberOfLines={1}>
              AI IHUI丨{userInfo.username || '用户'}
            </Text>
            {showRechargeBtn ? (
              <Text style={styles.editText}>编辑</Text>
            ) : null}
          </TouchableOpacity>

          <View style={styles.roleRow}>
            <View style={[styles.roleBadge, isVip ? styles.roleBadgeVip : null]}>
              <Text style={[styles.roleText, isVip ? styles.roleTextVip : null]}>
                {role}
              </Text>
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
          <TouchableOpacity
            style={styles.rechargeBtn}
            activeOpacity={0.7}
            onPress={onRecharge}
          >
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
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#111827',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  card: {
    marginTop: 8,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e7ff',
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
    color: '#111827',
  },
  editText: {
    fontSize: 12,
    color: '#6366f1',
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
    backgroundColor: '#f3f4f6',
    borderRadius: 2,
  },
  roleBadgeVip: {
    backgroundColor: '#fef3c7',
  },
  roleText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#4b5563',
  },
  roleTextVip: {
    color: '#d97706',
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
    color: '#a5b4fc',
  },
  tokenValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366f1',
    marginLeft: 4,
  },
  rechargeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#6366f1',
    borderRadius: 6,
  },
  rechargeBtnText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
})
