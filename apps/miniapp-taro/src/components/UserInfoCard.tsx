import { View, Text, Image } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'

export interface UserInfoCardProps {
  avatar?: string
  nickname?: string
  level?: number
  levelTitle?: string
  isVip?: boolean
  vipTitle?: string
  desc?: string
  onClick?: () => void
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
      className={cn(
        'rounded-lg bg-card border border-border p-3 active:opacity-80',
        className
      )}
      onClick={onClick}
    >
      <View className="flex items-center gap-3">
        {avatar ? (
          <Image
            src={avatar}
            mode="aspectFill"
            className="w-12 h-12 rounded-md bg-muted"
          />
        ) : (
          <View className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center">
            <Text className="text-base font-medium text-primary">
              {nickname.charAt(0) || '?'}
            </Text>
          </View>
        )}
        <View className="flex-1 min-w-0">
          <View className="flex items-center gap-2">
            <Text className="text-sm font-medium text-foreground truncate">
              {nickname}
            </Text>
            {isVip && (
              <View className="px-1.5 py-0.5 rounded-sm bg-[#f59e0b]/10">
                <Text className="text-[10px] text-[#f59e0b] font-medium">
                  {vipTitle || 'VIP'}
                </Text>
              </View>
            )}
          </View>
          <View className="flex items-center gap-2 mt-1">
            {displayLevel && (
              <View className="px-1.5 py-0.5 rounded-sm bg-primary/10">
                <Text className="text-[10px] text-primary font-medium">
                  {displayLevel}
                </Text>
              </View>
            )}
            {desc && (
              <Text className="text-xs text-muted-foreground truncate">
                {desc}
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  )
}
