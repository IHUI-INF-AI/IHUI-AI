import { View, Text, Image } from '@tarojs/components'
import type { CSSProperties } from 'react'
import { getRnTokens, type RnThemeMode, type RnThemeTokens } from '@ihui/design-tokens'
import type { UserInfo } from '@ihui/types'

/**
 * Taro 适配层:UserInfoCard
 *
 * 平台特有:依赖 @tarojs/components 的 View/Text/Image + onTap,
 * 不适合共享层。
 *
 * 复用 packages/app/src/components/UserInfoCard 的 props 契约 + 角色/智汇值格式化逻辑(内联),
 * 替换 web 元素(`div`/`img` → `View`/`Image`)+ 事件(`onClick` → `onTap`)。
 * 颜色通过 `getRnTokens(colorScheme)` 共享注入,保持与 web 端主题一致。
 */
export type { UserInfo }

/** 等价 @ihui/shared/utils/getRoleLabel */
function getRoleLabel(isVip?: number, identityType?: number): string {
  if (isVip === 1 && identityType === 1) return '操盘手'
  if (isVip === 1) return '会员'
  return '普通用户'
}

/** 等价 @ihui/shared/utils/formatTokenValue */
function formatTokenValue(value: number | string | undefined): string {
  if (value === undefined || value === null || value === '') return '0'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0'
  if (num >= 100000000) return `${(num / 100000000).toFixed(2)}亿`
  if (num >= 10000) return `${(num / 10000).toFixed(2)}万`
  return String(Math.floor(num))
}

export interface UserInfoCardProps {
  userInfo: UserInfo
  showRechargeBtn?: boolean
  onEdit?: () => void
  onRecharge?: () => void
  onLogin?: () => void
  defaultAvatarUrl?: string
  className?: string
  colorScheme?: RnThemeMode
  t?: (key: string, options?: Record<string, string | number>) => string
}

const DEFAULT_AVATAR = ''
const FALLBACK_USERNAME = '用户'
const FALLBACK_BRAND = 'AI IHUI丨'
const FALLBACK_LOGIN_TEXT = '一键登录'
const FALLBACK_EDIT_TEXT = '编辑'
const FALLBACK_TOKEN_LABEL = '剩余智汇值:'
const FALLBACK_RECHARGE_TEXT = '充值'

const toRpx = (px: number): string => `${px * 2}rpx`

const viewStyles = {
  loggedOutWrap: (): CSSProperties => ({
    marginTop: toRpx(8),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  loginBtn: (tk: RnThemeTokens): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tk.surface.light,
    borderWidth: toRpx(2),
    borderStyle: 'solid',
    borderColor: tk.text.primary,
    borderRadius: toRpx(12),
    paddingTop: toRpx(14),
    paddingBottom: toRpx(14),
    paddingLeft: toRpx(32),
    paddingRight: toRpx(32),
  }),
  card: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(8),
    padding: toRpx(8),
    borderRadius: toRpx(12),
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tk.border.light,
    backgroundColor: 'rgba(195, 190, 255, 0.15)',
  }),
  header: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    padding: toRpx(8),
  }),
  avatarWrap: (tk: RnThemeTokens): CSSProperties => ({
    width: toRpx(56),
    height: toRpx(56),
    borderRadius: toRpx(8),
    overflow: 'hidden',
    backgroundColor: tk.surface.light,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tk.indigo.light,
    flexShrink: 0,
  }),
  avatarPlaceholder: (tk: RnThemeTokens): CSSProperties => ({
    width: toRpx(56),
    height: toRpx(56),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tk.surface.light,
    fontSize: toRpx(20),
    fontWeight: 600,
    color: tk.indigo.DEFAULT,
  }),
  infoWrap: (): CSSProperties => ({
    flex: 1,
    minWidth: 0,
    marginLeft: toRpx(12),
  }),
  nameRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: toRpx(4),
    paddingBottom: toRpx(4),
  }),
  roleRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: toRpx(6),
  }),
  roleBadge: (tk: RnThemeTokens, isVip: boolean): CSSProperties => ({
    paddingLeft: toRpx(8),
    paddingRight: toRpx(8),
    paddingTop: toRpx(2),
    paddingBottom: toRpx(2),
    backgroundColor: isVip ? tk.warning.light : tk.surface.card,
    borderRadius: toRpx(2),
  }),
  tokenRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: toRpx(8),
    paddingLeft: toRpx(8),
    paddingRight: toRpx(8),
    paddingTop: toRpx(6),
    paddingBottom: toRpx(6),
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: toRpx(6),
  }),
  tokenLabelWrap: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  }),
  rechargeBtn: (tk: RnThemeTokens): CSSProperties => ({
    paddingLeft: toRpx(10),
    paddingRight: toRpx(10),
    paddingTop: toRpx(4),
    paddingBottom: toRpx(4),
    backgroundColor: tk.indigo.DEFAULT,
    borderRadius: toRpx(6),
  }),
}

const textStyles = {
  loginBtnText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(16),
    fontWeight: 600,
    color: tk.text.primary,
  }),
  name: (tk: RnThemeTokens): CSSProperties => ({
    flex: 1,
    fontSize: toRpx(14),
    fontWeight: 600,
    color: tk.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  }),
  editText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(12),
    color: tk.indigo.DEFAULT,
    marginLeft: toRpx(4),
  }),
  roleText: (tk: RnThemeTokens, isVip: boolean): CSSProperties => ({
    fontSize: toRpx(11),
    fontWeight: 500,
    color: isVip ? tk.warning.DEFAULT : tk.gray[600],
  }),
  tokenLabel: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(12),
    color: tk.indigo.DEFAULT,
  }),
  tokenValue: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(12),
    fontWeight: 700,
    color: tk.indigo.DEFAULT,
    marginLeft: toRpx(4),
  }),
  rechargeBtnText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(12),
    color: tk.surface.light,
    fontWeight: 500,
  }),
}

function trOrFallback(
  t: ((key: string, options?: Record<string, string | number>) => string) | undefined,
  key: string,
  fallback: string,
): string {
  if (!t) return fallback
  return t(key)
}

export function UserInfoCard({
  userInfo,
  showRechargeBtn = true,
  onEdit,
  onRecharge,
  onLogin,
  defaultAvatarUrl = DEFAULT_AVATAR,
  className,
  colorScheme = 'light',
  t,
}: UserInfoCardProps) {
  const tk = getRnTokens(colorScheme)

  // 未登录态
  if (!userInfo.uuid) {
    return (
      <View className={className} style={viewStyles.loggedOutWrap()}>
        <View onTap={onLogin} hoverClass="opacity-60" style={viewStyles.loginBtn(tk)}>
          <Text style={textStyles.loginBtnText(tk)}>
            {trOrFallback(t, 'user.login', FALLBACK_LOGIN_TEXT)}
          </Text>
        </View>
      </View>
    )
  }

  const role = getRoleLabel(userInfo.isVip, userInfo.identityType)
  const isVip = userInfo.isVip === 1
  const tokenStr = formatTokenValue(userInfo.tokenQuantity)
  const avatar = userInfo.avatarUrl || defaultAvatarUrl
  const username = userInfo.username || FALLBACK_USERNAME
  const fullName = `${FALLBACK_BRAND}${username}`
  const showAvatarImg = !!avatar
  const initials = username.trim().slice(0, 1) || '?'

  return (
    <View className={className} style={viewStyles.card(tk)}>
      {/* 顶部:头像 + 昵称/角色 */}
      <View style={viewStyles.header()}>
        <View onTap={onEdit} hoverClass="opacity-60" style={viewStyles.avatarWrap(tk)}>
          {showAvatarImg ? (
            <Image
              src={avatar}
              style={{ width: toRpx(56), height: toRpx(56) }}
              mode="aspectFill"
            />
          ) : (
            <View style={viewStyles.avatarPlaceholder(tk)}>
              <Text>{initials}</Text>
            </View>
          )}
        </View>

        <View style={viewStyles.infoWrap()}>
          <View onTap={onEdit} hoverClass="opacity-60" style={viewStyles.nameRow()}>
            <Text style={textStyles.name(tk)}>{fullName}</Text>
            {showRechargeBtn ? (
              <Text style={textStyles.editText(tk)}>
                {trOrFallback(t, 'user.edit', FALLBACK_EDIT_TEXT)}
              </Text>
            ) : null}
          </View>

          <View style={viewStyles.roleRow()}>
            <View style={viewStyles.roleBadge(tk, isVip)}>
              <Text style={textStyles.roleText(tk, isVip)}>{role}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 智汇值 + 充值按钮 */}
      <View style={viewStyles.tokenRow()}>
        <View style={viewStyles.tokenLabelWrap()}>
          <Text style={textStyles.tokenLabel(tk)}>
            {trOrFallback(t, 'user.tokenLabel', FALLBACK_TOKEN_LABEL)}
          </Text>
          <Text style={textStyles.tokenValue(tk)}>{tokenStr}</Text>
        </View>
        {showRechargeBtn ? (
          <View onTap={onRecharge} hoverClass="opacity-60" style={viewStyles.rechargeBtn(tk)}>
            <Text style={textStyles.rechargeBtnText(tk)}>
              {trOrFallback(t, 'user.recharge', FALLBACK_RECHARGE_TEXT)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
