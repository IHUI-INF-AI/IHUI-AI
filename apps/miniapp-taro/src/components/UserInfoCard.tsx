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
import { rpx } from '@/utils/rpx'
import LineIcon from './LineIcon'
import type { UserInfoCardMinimalProps } from '@ihui/types'

/// 档位数字唯一源在 @ihui/shared/ui/user-info-card-spec(与 RN 端同表);本文件只做 rpx 换算 + 挂 Taro 原语。
/// 书写形态:**本族全部档位经 `toUnit(具名档)` 内联**,端内不落第二个数字。
/// (此前登录钮的上下档与进度条粗细写过等值 Tailwind 类名 `py-3.5` / `h-2` —— 渲染字节相同,但守门 128
///  的具名档判据只认档名,于是这两档在小程序侧读不出来、被记成"另一端没接线";现收回类名形态,
///  与同文件其余 11 档同一姿势。徽章族的 `px-2`/`py-0.5` 保留,因为同档已由 BADGE_PAD_STYLE 引过常量。)
const toUnit = (logicalPx: number) => rpx(logicalPx * TARO_RPX_PER_PX)
const PAD_STYLE = { padding: toUnit(USER_INFO_CARD_PADDING_PX) }
const HEADER_GAP_STYLE = { gap: toUnit(USER_INFO_CARD_HEADER_GAP_PX) }
/// 头像盒子结构只住在 spec 出口里(方档 + overflow + 居中),端内不得再摆一遍;
/// 边长档由本端显式喂进常量 —— 与 RN 端同形,两端都读得到同一个数(RN 的 `avatar` 样式同样写它),
/// 否则 48 藏在 spec 函数体内,守门 128 在本端面上看不见它。
const AVATAR_STYLE = userInfoCardAvatarStyle(toUnit, USER_INFO_CARD_AVATAR_PX)
const NAME_FONT_STYLE = { fontSize: toUnit(USER_INFO_CARD_NAME_FONT_PX) }
const SMALL_FONT_STYLE = { fontSize: toUnit(USER_INFO_CARD_SMALL_FONT_PX) }
const TOKEN_FONT_STYLE = { fontSize: toUnit(USER_INFO_CARD_TOKEN_FONT_PX) }
const LOGIN_FONT_STYLE = { fontSize: toUnit(USER_INFO_CARD_LOGIN_FONT_PX) }
/// 未登录钮:上下内边距走常量(与 RN 端 `loginBtn.paddingVertical` 同档),全宽条形态是本端机制差异,
/// 按 spec 文件末差异登记第 1 条保持不动。
const LOGIN_BTN_STYLE = {
  paddingTop: toUnit(USER_INFO_CARD_LOGIN_PADDING_Y_PX),
  paddingBottom: toUnit(USER_INFO_CARD_LOGIN_PADDING_Y_PX),
  background: 'var(--color-primary)',
}
/// 成长值进度条粗细:与 RN 端 `growthBarBg.height` 同档(原写 `h-2` 类名,现收进常量)
const GROWTH_BAR_STYLE = { height: toUnit(USER_INFO_CARD_GROWTH_BAR_HEIGHT_PX) }
/// CSSProperties(Taro)不认 paddingXxxHorizontal/Vertical 简写,拆成四键喂同一档位
/// (原写"参照 Loading.tsx 口径" —— 那份零消费者死副本已于 2026-09-26 摘除,不再是指向)
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
/**
 * 图标载体择优 = 矢量优先(守门 128 的 IC 维点名"小程序仍用 CDN 位图")。
 * 本卡原有 6 处位图槽,逐张判定后 **4 处已换载体、2 处带理由保留**:
 *  - userIcon.jpg(20×20 人形线图标)→ `LineIcon name="user"`(同一 lucide 字形,随主题换色)
 *  - xiugai.jpg(16×16 铅笔线图标)  → `LineIcon name="pencil"`
 *  - default/rechargebtn.png(24×20,把「充值智汇值」四个汉字烘进金色渐变图里)
 *    → 文字按钮(与同文件其余操作钮同一档;位图既不随主题反色也不走 i18n)
 *  - userVip_nor.png / user-vip-act.svg(16×40 VIP 徽标)→ 文字徽章,与 RN 同一位置的文字徽章同形
 *    (这一换顺带消掉守门 128 几何维上"仅小程序档 40"—— 40 就是那枚徽标的固定宽)
 * 保留的两处是**真·非线形图**,不是"懒得换":见各自行内 `icon-bitmap-exempt` 的理由。
 */
const defaultAvatarImg = aizhsUrl('remote-images/daixaodiming.png') // icon-bitmap-exempt: 多色 3D 吉祥物插画当默认头像(非线形 UI 图标,换 lucide 即改 artwork),RN 同位是 initials 兜底,留待组件源统一票裁 until 2027-09-27
const wirelessLogoImg = aizhsUrl('remote-images/wirelesslogo.jpg') // icon-bitmap-exempt: 品牌标识(源项目 wirelesslogo 官方位图),按 §品牌图标须官方真实图标不得自造矢量近似 until 2027-09-27

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
          上下内边距 = spec LOGIN_PADDING_Y(14),经 LOGIN_BTN_STYLE 内联喂常量
          (此前写 `py-3` = 12 与 RN 分叉,后改等值类名 `py-3.5`,现收进常量)。
          全宽条形态是本端与 RN 胶囊的机制差异,按 spec 文件末差异登记第 1 条保持不动。 */}
      {!isLogged && onLogin ? (
        <View
          className="flex items-center justify-center w-full rounded-sm"
          style={LOGIN_BTN_STYLE}
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
            {/* 头像块是"方档图块"而非正圆(48dp 盒、圆角取卡片档 lg=8),与 RN 端
                avatarWrap / avatarFallback 同一档;这里此前写 md(6) ⇒ 同一头像两端各一档 */}
            <Image
              src={avatar || defaultAvatarImg}
              mode="aspectFill"
              className="rounded-lg bg-muted"
              style={AVATAR_STYLE}
            />
            <View className="flex-1 min-w-0">
              {/* 用户名行:user 矢量图标 + 昵称 + VIP 文字徽章 + 操盘手标识 + pencil 矢量图标 */}
              <View className="flex items-center gap-2">
                <LineIcon name="user" size={40} className="flex-shrink-0" />
                <Text className="font-medium text-foreground truncate" style={NAME_FONT_STYLE}>
                  {nickname}
                </Text>
                {/* VIP 徽章:此前是 16×40 位图(非 VIP 档还是 CDN 灰图 + 空板),同一位置 RN 是
                    文字徽章(roleBadge:warning 底 + warning 字)⇒ 换成同形文字徽章,档位仍取
                    spec 的 BADGE_PADDING_X/Y + SMALL_FONT(与同排「操盘手」徽章同一写法)。
                    非 VIP 不再渲染空灰板 —— 它不表意,而 RN 对非 VIP 在该位什么都不渲染。 */}
                {/* 徽章圆角家族 = 角色档 chip → md(6)。本卡三枚徽章(VIP / 操盘手 / 等级)
                    与 RN 端 roleBadge 是同一角色,此前各写 4 / 2,现统一到 chip 档。 */}
                {isVip ? (
                  <View
                    className="px-2 py-0.5 rounded-md flex-shrink-0"
                    style={{ background: 'var(--color-warning-tint-strong)' }}
                  >
                    <Text
                      className="font-medium"
                      style={{ ...SMALL_FONT_STYLE, color: 'var(--color-warning)' }}
                    >
                      {vipTitle || 'VIP'}
                    </Text>
                  </View>
                ) : null}
                {/* 操盘手身份标识(对齐原项目 identityType=2,不同身份显示不同徽标)
                    徽章内边距与等级徽章同档:spec BADGE_PADDING_X 8 = `px-2` / Y 2 = `py-0.5` */}
                {identityType === 2 ? (
                  <View
                    className="px-2 py-0.5 rounded-md flex-shrink-0"
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
                  <LineIcon name="pencil" size={32} className="ml-auto flex-shrink-0" />
                ) : null}
              </View>
              {/* 等级 + 智汇值行 */}
              <View className="flex items-center gap-2" style={ROW_MARGIN_STYLE}>
                {displayLevel ? (
                  <View
                    className="rounded-md bg-primary/10 flex-shrink-0"
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
                {/* 智汇值行:品牌标识位图(保留,理由见声明处)+ tokenDisplay + 文字充值按钮
                    (对齐原项目 token 显示;充值钮此前是烘了汉字的位图按钮,已矢量化/文字化) */}
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
                      /* 此前这里是一枚 24×20 的位图按钮(把「充值智汇值」四个汉字烘进金色渐变图):
                         既不随主题反色、也不走 i18n 与字号缩放。换成与本卡其余操作钮同一档位的
                         文字按钮(规格档 ACTION_PADDING_X/Y + SMALL_FONT),与 RN 端 rechargeBtn 同形。 */
                      <View
                        className="rounded-sm bg-primary flex-shrink-0 ml-auto"
                        style={ACTION_PAD_STYLE}
                      >
                        <Text
                          className="text-primary-foreground font-medium"
                          style={SMALL_FONT_STYLE}
                        >
                          {tt('wallet.recharge.submit', '充值')}
                        </Text>
                      </View>
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
                  {/* 进度条粗细 = spec USER_INFO_CARD_GROWTH_BAR_HEIGHT_PX(8),经 GROWTH_BAR_STYLE
                      内联喂常量(此前写等值类名 `h-2`,档名读不到 ⇒ 被守门 128 记成"仅 RN 引用");
                      RN 端原写 4 已收口到同一档,改这里只改 spec 一处。 */}
                  {/* 进度条圆角:两端此前各写 `rounded`(裸档=8,在 8dp 高的条上等于半高胶囊)
                      与 RN 端的 xs(2)。条高 8 属"极小元素",角色档 tiny → xs,
                      故本端收小;RN 侧一字未动。 */}
                  <View
                    className="w-full rounded-xs bg-muted overflow-hidden"
                    style={GROWTH_BAR_STYLE}
                  >
                    <View
                      className="h-full rounded-xs"
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
