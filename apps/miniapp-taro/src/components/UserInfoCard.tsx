import { View, Text, Image } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'
import type { UserInfoCardMinimalProps } from '@ihui/types'
import { aizhsUrl } from '@/constants/icon-urls'
// 图标引用对齐原项目 zhs_app-ZZ/UserInfoCard.vue
// 本地有副本(@/assets/remote/,从原项目 src/static/ 复制)→ import 引入
import defaultAvatarImg from '@/assets/remote/images/daixaodiming.png'
import userIconImg from '@/assets/remote/images/userIcon.jpg'
import editIconImg from '@/assets/remote/images/xiugai.jpg'
import wirelessLogoImg from '@/assets/remote/images/wirelesslogo.jpg'
import rechargeBtnImg from '@/assets/remote/images/default/rechargebtn.png'
import vipNorIcon from '@/assets/remote/images/userVip_nor.png'

// 本地无副本 → 直接用远程 URL(与原项目一致)
// 原项目 src: https://file.aizhs.top/sys-mini/default/home/userVip_act.png
const vipActIcon = aizhsUrl('sys-mini/default/home/userVip_act.png')

// 共享类型 UserInfoCardMinimalProps 已下沉到 @ihui/types,
// 本地 Props extends Minimal 并追加 level/levelTitle/className(miniapp-taro 专属字段)。
export interface UserInfoCardProps extends UserInfoCardMinimalProps {
  level?: number
  levelTitle?: string
  className?: string
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
}: UserInfoCardProps) {
  const displayLevel = levelTitle || (level > 0 ? `Lv.${level}` : '')

  return (
    <View
      className={cn('rounded-lg bg-card border border-border p-3 active:opacity-80', className)}
      onClick={onClick}
    >
      <View className="flex items-center gap-3">
        {/* 头像:有 avatar 用 avatar,无则用原项目默认头像 daixaodiming.png */}
        <Image
          src={avatar || defaultAvatarImg}
          mode="aspectFill"
          className="w-12 h-12 rounded-md bg-muted"
        />
        <View className="flex-1 min-w-0">
          {/* 用户名行:userIcon + 昵称 + VIP 徽标图标 + 编辑图标 */}
          <View className="flex items-center gap-2">
            <Image src={userIconImg} mode="aspectFit" className="w-5 h-5 flex-shrink-0" />
            <Text className="text-sm font-medium text-foreground truncate">{nickname}</Text>
            {/* VIP 徽标:isVip 用 userVip_act.png(远程),非 VIP 用 userVip_nor.png(本地) */}
            {/* 对齐原项目:vipTip 文字叠加在徽标图标上 */}
            <View className="relative flex-shrink-0">
              <Image src={isVip ? vipActIcon : vipNorIcon} mode="aspectFit" className="h-4 w-10" />
              {isVip && vipTitle && (
                <View className="absolute inset-0 flex items-center justify-center">
                  <Text className="text-[20rpx] text-white font-medium leading-none">
                    {vipTitle}
                  </Text>
                </View>
              )}
            </View>
            {/* 编辑图标(xiugai.jpg):对齐原项目 showRechargeBtn 时显示 */}
            {onClick && (
              <Image src={editIconImg} mode="aspectFit" className="w-4 h-4 flex-shrink-0 ml-auto" />
            )}
          </View>
          {/* 等级 + 智汇值行 */}
          <View className="flex items-center gap-2 mt-1">
            {displayLevel && (
              <View className="px-1.5 py-0.5 rounded-sm bg-primary/10 flex-shrink-0">
                <Text className="text-[20rpx] text-primary font-medium">{displayLevel}</Text>
              </View>
            )}
            {/* 智汇值行:wirelesslogo + desc + rechargebtn(对齐原项目 token 显示) */}
            {desc && (
              <View className="flex items-center gap-1 flex-1 min-w-0">
                <Image src={wirelessLogoImg} mode="aspectFit" className="w-4 h-3 flex-shrink-0" />
                <Text className="text-xs text-muted-foreground truncate">{desc}</Text>
                {onClick && (
                  <Image
                    src={rechargeBtnImg}
                    mode="aspectFit"
                    className="w-6 h-5 flex-shrink-0 ml-auto"
                  />
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  )
}
