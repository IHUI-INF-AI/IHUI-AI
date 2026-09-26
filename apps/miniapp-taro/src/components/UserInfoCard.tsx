// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { aizhsUrl } from '@/constants/icon-urls'
import { useTt, t } from '@/i18n'
import { View, Text, Image } from '@tarojs/components'
import { cn, TARO_RPX_PER_PX } from '@ihui/design-tokens'
import {
  USER_INFO_CARD_ACTION_PADDING_X_PX,
  USER_INFO_CARD_ACTION_PADDING_Y_PX,
  USER_INFO_CARD_BADGE_PADDING_X_PX,
  USER_INFO_CARD_BADGE_PADDING_Y_PX,
  USER_INFO_CARD_HEADER_GAP_PX,
  USER_INFO_CARD_LOGIN_FONT_PX,
  USER_INFO_CARD_NAME_FONT_PX,
  USER_INFO_CARD_PADDING_PX,
  USER_INFO_CARD_ROW_MARGIN_TOP_PX,
  USER_INFO_CARD_SMALL_FONT_PX,
  USER_INFO_CARD_TOKEN_FONT_PX,
  userInfoCardAvatarStyle,
} from '@ihui/shared/ui/user-info-card-spec'
import { rpx } from '@/utils/rpx'
import type { UserInfoCardMinimalProps } from '@ihui/types'

/// 档位数字唯一源在 @ihui/shared/ui/user-info-card-spec(与 RN 端同表);本文件只做 rpx 换算 + 挂 Taro 原语。
/// 书写形态按 design-tokens/geometry.js 的规矩分两路:**有等值 Tailwind 整档时用类名**(下表注释),
/// 没有整档可等值时才用 `toUnit()` 内联(如 14px 上下内边距没有 `py-` 整档 ⇒ `py-3.5` 有,故用类名)。
const toUnit = (logicalPx: number) => rpx(logicalPx * TARO_RPX_PER_PX)
const PAD_STYLE = { padding: toUnit(USER_INFO_CARD_PADDING_PX) }
const HEADER_GAP_STYLE = { gap: toUnit(USER_INFO_CARD_HEADER_GAP_PX) }
/// 头像盒子结构只住在 spec 出口里(方档 + overflow + 居中),端内不得再摆一遍
const AVATAR_STYLE = userInfoCardAvatarStyle(toUnit)
const NAME_FONT_STYLE = { fontSize: toUnit(USER_INFO_CARD_NAME_FONT_PX) }
const SMALL_FONT_STYLE = { fontSize: toUnit(USER_INFO_CARD_SMALL_FONT_PX) }
const TOKEN_FONT_STYLE = { fontSize: toUnit(USER_INFO_CARD_TOKEN_FONT_PX) }
const LOGIN_FONT_STYLE = { fontSize: toUnit(USER_INFO_CARD_LOGIN_FONT_PX) }
/// CSSProperties(Taro)不认 paddingXxxHorizontal/Vertical 简写,拆成四键喂同一档位(参照 Loading.tsx 口径)
const BADGE_PAD_STYLE = {
  paddingLeft: toUnit(USER_INFO_CARD_BADGE_PADDING_X_PX),
  paddingRight: toUnit(USER_INFO_CARD_BADGE_PADDING_X_PX),
  paddingTop: toUnit(USER_INFO_CARD_BADGE_PADDING_Y_PX),
  paddingBottom: toUnit(USER_INFO_CARD_BADGE_PADDING_Y_PX),
}
const ACTION_PAD_STYLE = {
  paddingLeft: toUnit(USER_INFO_CARD_ACTION_PADDING_X_PX),
  paddingRight: toUnit(USER_INFO_CARD_ACTION_PADDING_X_PX),
  paddingTop: toUnit(USER_INFO_CARD_ACTION_PADDING_Y_PX),
  paddingBottom: toUnit(USER_INFO_CARD_ACTION_PADDING_Y_PX),
}
const ROW_MARGIN_STYLE = { marginTop: toUnit(USER_INFO_CARD_ROW_MARGIN_TOP_PX) }
// 本地化远程 CDN 图片:原 aizhs 图库在 H5 模式下加载失败,改为本地 SVG 占位
import vipActIcon from '@/assets/remote-images/user-vip-act.svg'
// 图标引用对齐原项目 zhs_app-ZZ/UserInfoCard.vue
// 本地有副本(@/assets/remote/,从原项目 src/static/ 复制)→ import 引入
const defaultAvatarImg = aizhsUrl('remote-images/daixaodiming.png')
const userIconImg = aizhsUrl('remote-images/userIcon.jpg')
const editIconImg = aizhsUrl('remote-images/xiugai.jpg')
const wirelessLogoImg = aizhsUrl('remote-images/wirelesslogo.jpg')
const rechargeBtnImg = aizhsUrl('remote-images/default/rechargebtn.png')
const vipNorIcon = aizhsUrl('remote-images/userVip_nor.png')

// 共享类型 UserInfoCardMinimalProps 已下沉到 @ihui/types,
// 本地 Props extends Minimal 并追加 level/levelTitle/className(miniapp-taro 专属字段)
// 及 9 项核心功能字段(对齐原项目 zhs_app-ZZ/UserInfoCard.vue)。
export interface UserInfoCardProps extends UserInfoCardMinimalProps {
  level?: number
  levelTitle?: string
  className?: string
  // ===== 9 项核心功能 props(对齐原项目 UserInfoCard.vue)=====
  /** 成长值(当前) */
  growthValue?: number
  /** 成长值(当前等级上限) */
  growthMax?: number
  /** 智汇值(优先于 desc 显示) */
  tokenValue?: number
  /** 身份类型:0=普通用户 / 1=会员 / 2=操盘手 */
  identityType?: 0 | 1 | 2
  /** 充值回调(跳充值页) */
  onWallet?: () => void
  /** 退订回调(仅 isVip 显示) */
  onUnsubscribe?: () => void
  /** 开通会员回调(仅非 isVip 显示) */
  onOpenVip?: () => void
  /** 等级介绍回调 */
  onOpenLevel?: () => void
  /** 一键登录回调(仅未登录显示) */
  onLogin?: () => void
}

/** 智汇值格式化(对齐原项目 formatTokenValue:>=10000 显示 x.xw,>=1000 显示 x.xk) */
function formatTokenValue(v: number): string {
  if (v >= 10000) return (v / 10000).toFixed(1) + 'w'
  if (v >= 1000) return (v / 1000).toFixed(1) + 'k'
  return String(v)
}

export default function UserInfoCard({
  avatar,
  nickname = t('profileEdit.notLoggedIn'),
  level = 0,
  levelTitle,
  isVip = false,
  vipTitle,
  desc,
  onClick,
  className = '',
  // 新增 9 项功能 props
  growthValue,
  growthMax,
  tokenValue,
  identityType = 0,
  onWallet,
  onUnsubscribe,
  onOpenVip,
  onOpenLevel,
  onLogin,
}: UserInfoCardProps) {
  const tt = useTt()
  const displayLevel = levelTitle || (level > 0 ? `Lv.${level}` : '')
  // 未登录判定(对齐原项目:无头像 + 昵称为"未登录")
  const isLogged = !!avatar || nickname !== tt('profileEdit.notLoggedIn', '未登录')
  // 智汇值格式化:tokenValue 优先,无则回退 desc
  const tokenDisplay = tokenValue !== undefined ? formatTokenValue(tokenValue) : desc
  // 成长值进度比例(对齐原项目 growth-bar)
  const showGrowthBar = typeof growthValue === 'number' && typeof growthMax === 'number'
  const growthPercent =
    showGrowthBar && growthMax && growthMax > 0 ? Math.min((growthValue / growthMax) * 100, 100) : 0

  return (
    <View className={cn('rounded-lg bg-card border border-border', className)} style={PAD_STYLE}>
      {/* ===== 未登录态:一键登录按钮(对齐原项目 login-btn-new)=====
          上下内边距 = spec LOGIN_PADDING_Y(14);`py-3.5` 是它的等值 Tailwind 整档书写形态
          (此前写 `py-3` = 12,与 RN 端的 14 分叉)。全宽条形态是本端与 RN 胶囊的机制差异,
          按 spec 文件末差异登记第 1 条保持不动。 */}
      {!isLogged && onLogin ? (
        <View
          className="flex items-center justify-center w-full py-3.5 rounded-md"
          style={{ background: 'var(--color-primary)' }}
          hoverClass="opacity-85"
          onClick={onLogin}
        >
          <Text className="text-primary-foreground font-medium" style={LOGIN_FONT_STYLE}>
            {tt('UserInfoCard.login1', '一键登录')}
          </Text>
        </View>
      ) : (
        <View hoverClass="opacity-85" onClick={onClick}>
          <View className="flex items-center" style={HEADER_GAP_STYLE}>
            {/* 头像:有 avatar 用 avatar,无则用原项目默认头像 daixaodiming.png(可点击编辑) */}
            <Image
              src={avatar || defaultAvatarImg}
              mode="aspectFill"
              className="rounded-md bg-muted"
              style={AVATAR_STYLE}
            />
            <View className="flex-1 min-w-0">
              {/* 用户名行:userIcon + 昵称 + VIP 徽标 + 操盘手标识 + 编辑图标 */}
              <View className="flex items-center gap-2">
                <Image src={userIconImg} mode="aspectFit" className="w-5 h-5 flex-shrink-0" />
                <Text className="font-medium text-foreground truncate" style={NAME_FONT_STYLE}>
                  {nickname}
                </Text>
                {/* VIP 徽标:isVip 用 userVip_act.png(远程),非 VIP 用 userVip_nor.png(本地) */}
                <View className="relative flex-shrink-0">
                  <Image
                    src={isVip ? vipActIcon : vipNorIcon}
                    mode="aspectFit"
                    className="h-4 w-10"
                  />
                  {isVip && vipTitle ? (
                    <View className="absolute inset-0 flex items-center justify-center">
                      <Text
                        className="text-[var(--color-white-98)] font-medium leading-none"
                        style={SMALL_FONT_STYLE}
                      >
                        {vipTitle}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {/* 操盘手身份标识(对齐原项目 identityType=2,不同身份显示不同徽标)
                    徽章内边距与等级徽章同档:spec BADGE_PADDING_X 8 = `px-2` / Y 2 = `py-0.5` */}
                {identityType === 2 ? (
                  <View
                    className="px-2 py-0.5 rounded-sm flex-shrink-0"
                    style={{ background: 'var(--color-warning-tint-strong)' }}
                  >
                    <Text
                      className="font-medium"
                      style={{ ...SMALL_FONT_STYLE, color: 'var(--color-warning)' }}
                    >
                      {tt('distribution.index.defaultName', '操盘手')}
                    </Text>
                  </View>
                ) : null}
                {onClick ? (
                  <Image
                    src={editIconImg}
                    mode="aspectFit"
                    className="w-4 h-4 flex-shrink-0 ml-auto"
                  />
                ) : null}
              </View>
              {/* 等级 + 智汇值行 */}
              <View className="flex items-center gap-2" style={ROW_MARGIN_STYLE}>
                {displayLevel ? (
                  <View
                    className="rounded-sm bg-primary/10 flex-shrink-0"
                    style={BADGE_PAD_STYLE}
                    hoverClass="opacity-85"
                    onClick={
                      onOpenLevel
                        ? (e) => {
                            e.stopPropagation()
                            onOpenLevel()
                          }
                        : undefined
                    }
                  >
                    <Text className="text-primary font-medium" style={SMALL_FONT_STYLE}>
                      {displayLevel}
                    </Text>
                  </View>
                ) : null}
                {/* 智汇值行:wirelesslogo + tokenDisplay + rechargebtn(对齐原项目 token 显示) */}
                {tokenDisplay ? (
                  <View
                    className="flex items-center gap-1 flex-1 min-w-0"
                    hoverClass="opacity-85"
                    onClick={
                      onWallet
                        ? (e) => {
                            e.stopPropagation()
                            onWallet()
                          }
                        : undefined
                    }
                  >
                    <Image
                      src={wirelessLogoImg}
                      mode="aspectFit"
                      className="w-4 h-3 flex-shrink-0"
                    />
                    <Text className="text-muted-foreground truncate" style={TOKEN_FONT_STYLE}>
                      {tokenDisplay}
                    </Text>
                    {onWallet ? (
                      <Image
                        src={rechargeBtnImg}
                        mode="aspectFit"
                        className="w-6 h-5 flex-shrink-0 ml-auto"
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>

              {/* ===== 成长值进度条(对齐原项目 growth-bar:外层灰底 + 内层渐变填充)===== */}
              {showGrowthBar ? (
                <View style={ROW_MARGIN_STYLE}>
                  <View className="flex items-center justify-between mb-1">
                    <Text className="text-muted-foreground" style={SMALL_FONT_STYLE}>
                      {tt('member.index.growth', '成长值')}
                    </Text>
                    <Text className="text-muted-foreground" style={SMALL_FONT_STYLE}>
                      {growthValue} / {growthMax}
                    </Text>
                  </View>
                  {/* 进度条粗细 = spec USER_INFO_CARD_GROWTH_BAR_HEIGHT_PX(8);`h-2` 是它的等值
                      Tailwind 整档书写形态,RN 端原写 4 已收口到同一档,改这里必须同批改 spec。 */}
                  <View className="w-full h-2 rounded bg-muted overflow-hidden">
                    <View
                      className="h-full rounded"
                      style={{
                        width: growthPercent + '%',
                        background:
                          'linear-gradient(90deg, var(--color-primary), var(--color-info))',
                      }}
                    />
                  </View>
                </View>
              ) : null}

              {/* ===== 操作按钮行(对齐原项目:开通会员 / 退订 / 充值)===== */}
              <View className="flex items-center gap-2" style={ROW_MARGIN_STYLE}>
                {/* 开通会员按钮(仅非 isVip 显示,对齐原项目 openIntroduce) */}
                {!isVip && onOpenVip ? (
                  <View
                    className="rounded-sm"
                    style={{ ...ACTION_PAD_STYLE, background: 'var(--color-primary)' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenVip()
                    }}
                    hoverClass="opacity-85"
                  >
                    <Text className="text-primary-foreground font-medium" style={SMALL_FONT_STYLE}>
                      {tt('vipTrader.openTitle', '开通会员')}
                    </Text>
                  </View>
                ) : null}
                {/* 退订按钮(仅 isVip 显示,对齐原项目 unsubscribe) */}
                {isVip && onUnsubscribe ? (
                  <View
                    className="rounded-sm border border-border"
                    style={ACTION_PAD_STYLE}
                    onClick={(e) => {
                      e.stopPropagation()
                      onUnsubscribe()
                    }}
                    hoverClass="opacity-85"
                  >
                    <Text className="text-muted-foreground" style={SMALL_FONT_STYLE}>
                      {tt('UserInfoCard.text2', '退订')}
                    </Text>
                  </View>
                ) : null}
                {/* 充值按钮(onWallet 且智汇值行未显示时兜底) */}
                {onWallet && !tokenDisplay ? (
                  <View
                    className="rounded-sm bg-primary"
                    style={ACTION_PAD_STYLE}
                    onClick={(e) => {
                      e.stopPropagation()
                      onWallet()
                    }}
                    hoverClass="opacity-85"
                  >
                    <Text className="text-primary-foreground font-medium" style={SMALL_FONT_STYLE}>
                      {tt('wallet.recharge.submit', '充值')}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
