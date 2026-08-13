import { View, Text, Image } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'
import type { UserInfoCardMinimalProps } from '@ihui/types'
// 本地化远程 CDN 图片:原 aizhs 图库在 H5 模式下加载失败,改为本地 SVG 占位
import vipActIcon from '@/assets/remote-images/user-vip-act.svg'
// 图标引用对齐原项目 zhs_app-ZZ/UserInfoCard.vue
// 本地有副本(@/assets/remote/,从原项目 src/static/ 复制)→ import 引入
import defaultAvatarImg from '@/assets/remote/images/daixaodiming.png'
import userIconImg from '@/assets/remote/images/userIcon.jpg'
import editIconImg from '@/assets/remote/images/xiugai.jpg'
import wirelessLogoImg from '@/assets/remote/images/wirelesslogo.jpg'
import rechargeBtnImg from '@/assets/remote/images/default/rechargebtn.png'
import vipNorIcon from '@/assets/remote/images/userVip_nor.png'

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
  nickname = '未登录',
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
  const displayLevel = levelTitle || (level > 0 ? `Lv.${level}` : '')
  // 未登录判定(对齐原项目:无头像 + 昵称为"未登录")
  const isLogged = !!avatar || nickname !== '未登录'
  // 智汇值格式化:tokenValue 优先,无则回退 desc
  const tokenDisplay = tokenValue !== undefined ? formatTokenValue(tokenValue) : desc
  // 成长值进度比例(对齐原项目 growth-bar)
  const showGrowthBar = typeof growthValue === 'number' && typeof growthMax === 'number'
  const growthPercent =
    showGrowthBar && growthMax && growthMax > 0 ? Math.min((growthValue / growthMax) * 100, 100) : 0

  return (
    <View className={cn('rounded-lg bg-card border border-border p-3 active:opacity-80', className)}>
      {/* ===== 未登录态:一键登录按钮(对齐原项目 login-btn-new)===== */}
      {!isLogged && onLogin ? (
        <View
          className="flex items-center justify-center w-full py-3 rounded-md"
          style={{ background: 'var(--color-primary)' }}
          onClick={onLogin}
        >
          <Text className="text-sm text-white font-medium">一键登录</Text>
        </View>
      ) : (
        <View onClick={onClick}>
          <View className="flex items-center gap-3">
            {/* 头像:有 avatar 用 avatar,无则用原项目默认头像 daixaodiming.png(可点击编辑) */}
            <Image
              src={avatar || defaultAvatarImg}
              mode="aspectFill"
              className="w-12 h-12 rounded-md bg-muted"
            />
            <View className="flex-1 min-w-0">
              {/* 用户名行:userIcon + 昵称 + VIP 徽标 + 操盘手标识 + 编辑图标 */}
              <View className="flex items-center gap-2">
                <Image src={userIconImg} mode="aspectFit" className="w-5 h-5 flex-shrink-0" />
                <Text className="text-sm font-medium text-foreground truncate">{nickname}</Text>
                {/* VIP 徽标:isVip 用 userVip_act.png(远程),非 VIP 用 userVip_nor.png(本地) */}
                <View className="relative flex-shrink-0">
                  <Image src={isVip ? vipActIcon : vipNorIcon} mode="aspectFit" className="h-4 w-10" />
                  {isVip && vipTitle ? (
                    <View className="absolute inset-0 flex items-center justify-center">
                      <Text className="text-[20rpx] text-white font-medium leading-none">
                        {vipTitle}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {/* 操盘手身份标识(对齐原项目 identityType=2,不同身份显示不同徽标) */}
                {identityType === 2 ? (
                  <View
                    className="px-1 py-0.5 rounded-sm flex-shrink-0"
                    style={{ background: 'rgba(245, 158, 11, 0.2)' }}
                  >
                    <Text
                      className="text-[20rpx] font-medium"
                      style={{ color: 'var(--color-warning)' }}
                    >
                      操盘手
                    </Text>
                  </View>
                ) : null}
                {onClick ? (
                  <Image src={editIconImg} mode="aspectFit" className="w-4 h-4 flex-shrink-0 ml-auto" />
                ) : null}
              </View>
              {/* 等级 + 智汇值行 */}
              <View className="flex items-center gap-2 mt-1">
                {displayLevel ? (
                  <View
                    className="px-1.5 py-0.5 rounded-sm bg-primary/10 flex-shrink-0"
                    onClick={
                      onOpenLevel
                        ? (e) => {
                            e.stopPropagation()
                            onOpenLevel()
                          }
                        : undefined
                    }
                  >
                    <Text className="text-[20rpx] text-primary font-medium">{displayLevel}</Text>
                  </View>
                ) : null}
                {/* 智汇值行:wirelesslogo + tokenDisplay + rechargebtn(对齐原项目 token 显示) */}
                {tokenDisplay ? (
                  <View
                    className="flex items-center gap-1 flex-1 min-w-0"
                    onClick={
                      onWallet
                        ? (e) => {
                            e.stopPropagation()
                            onWallet()
                          }
                        : undefined
                    }
                  >
                    <Image src={wirelessLogoImg} mode="aspectFit" className="w-4 h-3 flex-shrink-0" />
                    <Text className="text-xs text-muted-foreground truncate">{tokenDisplay}</Text>
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
                <View className="mt-2">
                  <View className="flex items-center justify-between mb-1">
                    <Text className="text-[20rpx] text-muted-foreground">成长值</Text>
                    <Text className="text-[20rpx] text-muted-foreground">
                      {growthValue} / {growthMax}
                    </Text>
                  </View>
                  <View className="w-full h-2 rounded bg-muted overflow-hidden">
                    <View
                      className="h-full rounded"
                      style={{
                        width: growthPercent + '%',
                        background: 'linear-gradient(90deg, var(--color-primary), #93d2f3)',
                      }}
                    />
                  </View>
                </View>
              ) : null}

              {/* ===== 操作按钮行(对齐原项目:开通会员 / 退订 / 充值)===== */}
              <View className="flex items-center gap-2 mt-2">
                {/* 开通会员按钮(仅非 isVip 显示,对齐原项目 openIntroduce) */}
                {!isVip && onOpenVip ? (
                  <View
                    className="px-3 py-1 rounded-sm"
                    style={{ background: 'linear-gradient(90deg, #fbbf24, var(--color-warning))' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenVip()
                    }}
                  >
                    <Text className="text-[22rpx] text-white font-medium">开通会员</Text>
                  </View>
                ) : null}
                {/* 退订按钮(仅 isVip 显示,对齐原项目 unsubscribe) */}
                {isVip && onUnsubscribe ? (
                  <View
                    className="px-3 py-1 rounded-sm border border-border"
                    onClick={(e) => {
                      e.stopPropagation()
                      onUnsubscribe()
                    }}
                  >
                    <Text className="text-[22rpx] text-muted-foreground">退订</Text>
                  </View>
                ) : null}
                {/* 充值按钮(onWallet 且智汇值行未显示时兜底) */}
                {onWallet && !tokenDisplay ? (
                  <View
                    className="px-3 py-1 rounded-sm bg-primary"
                    onClick={(e) => {
                      e.stopPropagation()
                      onWallet()
                    }}
                  >
                    <Text className="text-[22rpx] text-white font-medium">充值</Text>
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
