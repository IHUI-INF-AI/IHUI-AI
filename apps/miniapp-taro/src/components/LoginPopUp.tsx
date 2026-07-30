import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, Input, Button } from '@tarojs/components'
import { useTt } from '@/i18n'

/**
 * LoginPopUp 登录弹窗 — 对齐原项目 loginPopUp/index.vue
 * 含:遮罩 + 弹窗主体 + 头像选择 + 昵称输入 + 角色显示(普通用户/会员/操盘手) + 升级按钮
 *
 * 角色判定(对齐原项目 loginPopUp/index.vue line 35-39):
 * - isVip==0 && identityTypy==0 → 普通用户(text-muted-foreground)
 * - isVip==1 && identityTypy==0 → 会员(text-warning)
 * - isVip==1 && identityTypy==1 → 操盘手(text-primary)
 *
 * 升级按钮显示条件(对齐原项目 line 41):仅 isVip===0 && identityTypy===0 时显示。
 *
 * 注:identityTypy 字段保留原项目拼写(原项目 loginPopUp/index.vue line 35 即为 identityTypy,
 * 非 identityType),本组件沿用以保持与后端契约一致。
 */
export interface LoginPopUpProps {
  visible?: boolean
  /** 默认头像 URL */
  defaultAvatar?: string
  /** 当前用户信息 */
  userInfo?: {
    nickname?: string
    avatar?: string
    isVip?: number // 0=普通 1=VIP
    // 原项目拼写为 identityTypy,保留原拼写(不修正为 identityType)
    identityTypy?: number // 0=普通/操盘手 1=操盘手
  }
  onClose?: () => void
  onChooseAvatar?: (avatarUrl: string) => void
  onNicknameChange?: (nickname: string) => void
  onUpgrade?: () => void
}

const DEFAULT_AVATAR = '/static/default-avatar.png'

export default function LoginPopUp({
  visible = false,
  defaultAvatar = DEFAULT_AVATAR,
  userInfo,
  onClose,
  onChooseAvatar,
  onNicknameChange,
  onUpgrade,
}: LoginPopUpProps) {
  const tt = useTt()

  const [nickname, setNickname] = useState<string>(userInfo?.nickname ?? '')
  const [avatar, setAvatar] = useState<string>(userInfo?.avatar ?? '')

  if (!visible) return null

  const isVip = userInfo?.isVip ?? 0
  const identityTypy = userInfo?.identityTypy ?? 0

  // 角色显示(对齐原项目 loginPopUp/index.vue line 35-39)
  const isOperator = isVip === 1 && identityTypy === 1
  const isMember = isVip === 1 && identityTypy === 0
  const isNormal = isVip === 0 && identityTypy === 0
  const roleText = isOperator
    ? tt('user.operator', '操盘手')
    : isMember
      ? tt('user.member', '会员')
      : tt('user.normalUser', '普通用户')
  const roleClass = isOperator
    ? 'text-primary'
    : isMember
      ? 'text-warning'
      : 'text-muted-foreground'

  // 升级按钮:仅 普通用户(isVip===0 && identityTypy===0) 显示(对齐原项目 line 41)
  const showUpgrade = isNormal

  // 头像选择:微信小程序用 <Button open-type="chooseAvatar"> + onChooseAvatar 事件
  // (对齐原项目 loginPopUp/index.vue 的 chooseAvatar 实现)。
  // H5 端 openType 不生效,用 Taro.chooseImage 兜底(见 Button onClick)。

  const handleNicknameInput = (e: { detail: { value?: string } }) => {
    const val = e.detail.value ?? ''
    setNickname(val)
    onNicknameChange?.(val)
  }

  return (
    <View
      className="fixed inset-0 z-[1500] flex items-center justify-center"
      onClick={onClose}
    >
      {/* 遮罩层 */}
      <View className="absolute inset-0 bg-black/50" />
      {/* 弹窗主体 */}
      <View
        className="relative bg-card rounded-2xl p-6 w-[85%] max-w-[600rpx]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头像区:圆形头像(rounded-full 豁免,AGENTS.md §4 头像豁免) */}
        <View className="flex flex-col items-center mb-4">
          <Button
            openType="chooseAvatar"
            onChooseAvatar={(e: { detail: { avatarUrl?: string } }) => {
              const url = e.detail.avatarUrl ?? ''
              if (url) {
                setAvatar(url)
                onChooseAvatar?.(url)
              }
            }}
            onClick={() => {
              // H5 端 openType 不生效,用 Taro.chooseImage 兜底
              if (process.env.TARO_ENV === 'h5') {
                Taro.chooseImage({
                  count: 1,
                  sizeType: ['compressed'],
                  success: (res) => {
                    const url = res.tempFilePaths[0] ?? ''
                    if (url) {
                      setAvatar(url)
                      onChooseAvatar?.(url)
                    }
                  },
                })
              }
            }}
            className="!p-0 !bg-transparent !border-none w-[140rpx] h-[140rpx] rounded-full overflow-hidden"
          >
            <Image
              src={avatar || defaultAvatar}
              mode="aspectFill"
              className="w-[140rpx] h-[140rpx] rounded-full bg-muted border border-primary/20"
            />
          </Button>
          <Text className="text-xs text-muted-foreground mt-2">
            {tt('user.profile.clickToChange', '点击更换头像')}
          </Text>
        </View>

        {/* 昵称输入 */}
        <View className="mb-3">
          <Input
            value={nickname}
            placeholder={tt('user.profile.nicknamePlaceholder', '请输入用户名')}
            maxlength={20}
            onInput={handleNicknameInput}
            className="w-full px-3 py-2 rounded-md bg-muted text-sm text-foreground"
          />
        </View>

        {/* 角色显示 + 升级按钮 */}
        <View className="flex items-center justify-between mb-4">
          <Text className={`text-sm font-medium ${roleClass}`}>{roleText}</Text>
          {showUpgrade && (
            <View
              className="bg-warning rounded-md px-4 py-2"
              onClick={onUpgrade}
            >
              <Text className="text-sm text-white">
                {tt('vip.upgradeNow', '立即升级')}
              </Text>
            </View>
          )}
        </View>

        {/* 关闭按钮 */}
        <View
          className="w-full py-2 rounded-md bg-muted text-center"
          onClick={onClose}
        >
          <Text className="text-sm text-foreground">
            {tt('common.close', '关闭')}
          </Text>
        </View>
      </View>
    </View>
  )
}
