import type { CSSProperties } from 'react'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../theme/tokens'
import type { UserInfo } from '@ihui/types'

/**
 * UserInfoCard 用户信息卡片(跨端共享层)。
 *
 * 对齐 mobile-rn/UserInfoCard.tsx 的"头像 + 昵称/角色 + 智汇值 + 充值"布局。
 *
 * 平台无关:
 * - 不依赖 @tarojs/* 或 react-native,使用 div/span/img + onClick
 * - 数据使用共享类型 `UserInfo`(来自 @ihui/types)
 * - 角色文案/智汇值格式化内联实现(等价 @ihui/shared/utils 的 getRoleLabel/formatTokenValue,
 *   不引入新依赖)
 * - 头像兜底通过 `defaultAvatarUrl` prop 注入(替代原 DEFAULT_AVATAR_URL 共享常量)
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
  /** 是否显示充值按钮(默认 true) */
  showRechargeBtn?: boolean
  onEdit?: () => void
  onRecharge?: () => void
  /** 未登录态一键登录回调 */
  onLogin?: () => void
  /** 头像兜底 URL;web 端可传 CDN URL */
  defaultAvatarUrl?: string
  className?: string
  /** 已解析主题,默认 'light' */
  colorScheme?: AppThemeMode
  /** i18n 翻译函数(可选用,提供 i18n key → 字符串) */
  t?: (key: string, options?: Record<string, string | number>) => string
}

const DEFAULT_AVATAR = ''
const FALLBACK_USERNAME = '用户'
const FALLBACK_BRAND = 'AI IHUI丨'
const FALLBACK_LOGIN_TEXT = '一键登录'
const FALLBACK_EDIT_TEXT = '编辑'
const FALLBACK_TOKEN_LABEL = '剩余智汇值:'
const FALLBACK_RECHARGE_TEXT = '充值'

const viewStyles = {
  loggedOutWrap: (): CSSProperties => ({
    marginTop: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  loginBtn: (tk: AppThemeTokens): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tk.surface.light,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: tk.text.primary,
    borderRadius: 12,
    paddingTop: 14,
    paddingBottom: 14,
    paddingLeft: 32,
    paddingRight: 32,
    cursor: 'pointer',
  }),
  card: (tk: AppThemeTokens): CSSProperties => ({
    marginTop: 8,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tk.border.light,
    backgroundColor: 'rgba(195, 190, 255, 0.15)',
  }),
  header: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  }),
  avatarWrap: (tk: AppThemeTokens): CSSProperties => ({
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: tk.surface.light,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tk.indigo.light,
    flexShrink: 0,
    cursor: 'pointer',
  }),
  avatar: (): CSSProperties => ({
    width: 56,
    height: 56,
    objectFit: 'cover',
    display: 'block',
  }),
  infoWrap: (): CSSProperties => ({
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  }),
  nameRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 4,
  }),
  roleRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  }),
  roleBadge: (tk: AppThemeTokens, isVip: boolean): CSSProperties => ({
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 2,
    paddingBottom: 2,
    backgroundColor: isVip ? tk.warning.light : tk.surface.card,
    borderRadius: 2,
  }),
  tokenRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 6,
    paddingBottom: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 6,
  }),
  tokenLabelWrap: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  }),
  rechargeBtn: (tk: AppThemeTokens): CSSProperties => ({
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 4,
    paddingBottom: 4,
    backgroundColor: tk.indigo.DEFAULT,
    borderRadius: 6,
    cursor: 'pointer',
  }),
}

const textStyles = {
  loginBtnText: (tk: AppThemeTokens): CSSProperties => ({
    fontSize: 16,
    fontWeight: 600,
    color: tk.text.primary,
  }),
  name: (tk: AppThemeTokens): CSSProperties => ({
    flex: 1,
    fontSize: 14,
    fontWeight: 600,
    color: tk.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  }),
  editText: (tk: AppThemeTokens): CSSProperties => ({
    fontSize: 12,
    color: tk.indigo.DEFAULT,
    marginLeft: 4,
  }),
  roleText: (tk: AppThemeTokens, isVip: boolean): CSSProperties => ({
    fontSize: 11,
    fontWeight: 500,
    color: isVip ? tk.warning.DEFAULT : tk.gray[600],
  }),
  tokenLabel: (tk: AppThemeTokens): CSSProperties => ({
    fontSize: 12,
    color: tk.indigo.DEFAULT,
  }),
  tokenValue: (tk: AppThemeTokens): CSSProperties => ({
    fontSize: 12,
    fontWeight: 700,
    color: tk.indigo.DEFAULT,
    marginLeft: 4,
  }),
  rechargeBtnText: (tk: AppThemeTokens): CSSProperties => ({
    fontSize: 12,
    color: tk.surface.light,
    fontWeight: 500,
  }),
}

/** i18n fallback helper */
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
  const tk = getTokens(colorScheme)

  // 未登录态:显示一键登录按钮
  if (!userInfo.uuid) {
    return (
      <div className={className} style={viewStyles.loggedOutWrap()}>
        <div
          role="button"
          tabIndex={0}
          onClick={onLogin}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && onLogin) {
              e.preventDefault()
              onLogin()
            }
          }}
          style={viewStyles.loginBtn(tk)}
        >
          <span style={textStyles.loginBtnText(tk)}>
            {trOrFallback(t, 'user.login', FALLBACK_LOGIN_TEXT)}
          </span>
        </div>
      </div>
    )
  }

  const role = getRoleLabel(userInfo.isVip, userInfo.identityType)
  const isVip = userInfo.isVip === 1
  const tokenStr = formatTokenValue(userInfo.tokenQuantity)
  const avatar = userInfo.avatarUrl || defaultAvatarUrl
  const username = userInfo.username || FALLBACK_USERNAME
  const fullName = `${FALLBACK_BRAND}${username}`
  // 头像兜底:无 URL 时渲染一个 initials placeholder(避免 jsdom/浏览器对空 src 警告)
  const showAvatarImg = !!avatar
  const initials = username.trim().slice(0, 1) || '?'

  return (
    <div className={className} style={viewStyles.card(tk)}>
      {/* 顶部:头像 + 昵称/角色 */}
      <div style={viewStyles.header()}>
        <div
          role="button"
          tabIndex={0}
          onClick={onEdit}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && onEdit) {
              e.preventDefault()
              onEdit()
            }
          }}
          style={viewStyles.avatarWrap(tk)}
          aria-label="编辑头像"
        >
          {showAvatarImg ? (
            <img src={avatar} alt={username} style={viewStyles.avatar()} />
          ) : (
            <div
              style={{
                ...viewStyles.avatar(),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                fontWeight: 600,
                color: tk.indigo.DEFAULT,
              }}
            >
              <span>{initials}</span>
            </div>
          )}
        </div>

        <div style={viewStyles.infoWrap()}>
          <div
            role="button"
            tabIndex={0}
            onClick={onEdit}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && onEdit) {
                e.preventDefault()
                onEdit()
              }
            }}
            style={viewStyles.nameRow()}
          >
            <span style={textStyles.name(tk)}>{fullName}</span>
            {showRechargeBtn ? (
              <span style={textStyles.editText(tk)}>
                {trOrFallback(t, 'user.edit', FALLBACK_EDIT_TEXT)}
              </span>
            ) : null}
          </div>

          <div style={viewStyles.roleRow()}>
            <div style={viewStyles.roleBadge(tk, isVip)}>
              <span style={textStyles.roleText(tk, isVip)}>{role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 智汇值 + 充值按钮(背景色对比分隔,非分割线) */}
      <div style={viewStyles.tokenRow()}>
        <div style={viewStyles.tokenLabelWrap()}>
          <span style={textStyles.tokenLabel(tk)}>
            {trOrFallback(t, 'user.tokenLabel', FALLBACK_TOKEN_LABEL)}
          </span>
          <span style={textStyles.tokenValue(tk)}>{tokenStr}</span>
        </div>
        {showRechargeBtn ? (
          <div
            role="button"
            tabIndex={0}
            onClick={onRecharge}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && onRecharge) {
                e.preventDefault()
                onRecharge()
              }
            }}
            style={viewStyles.rechargeBtn(tk)}
            aria-label={trOrFallback(t, 'user.recharge', FALLBACK_RECHARGE_TEXT)}
          >
            <span style={textStyles.rechargeBtnText(tk)}>
              {trOrFallback(t, 'user.recharge', FALLBACK_RECHARGE_TEXT)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
