import { logger } from '@/utils/logger'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { updateUserNickname, getProfile } from '@/api'
import { useI18n } from '@/i18n'

const MAX_LENGTH = 8

export default function Nickname() {
  const { t } = useI18n()
  const [nickname, setNickname] = useState('')
  const [original, setOriginal] = useState('')

  // 本地 fallback:maxLength 提示 key 待主 agent 补,未命中时返回 fb
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

  const load = useCallback(async () => {
    try {
      const profile = await getProfile()
      const name = profile.nickname || ''
      setNickname(name)
      setOriginal(name)
    } catch (e) {
      logger.error('user/nickname', '获取用户信息', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }, [t])

  useDidShow(() => {
    load()
  })

  async function onSubmit() {
    const val = nickname.trim()
    if (!val) {
      return Taro.showToast({ title: t('user.nickname.enterNickname'), icon: 'none' })
    }
    // 对标原项目 account.vue:昵称不能超过 8 个字符
    if (val.length > MAX_LENGTH) {
      return Taro.showToast({ title: tt('user.nickname.maxLength', '昵称不能超过8个字符'), icon: 'none' })
    }
    try {
      await updateUserNickname(val)
      Taro.showToast({ title: t('user.nickname.saveSuccess'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {
      logger.error('user/nickname', '修改昵称', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }

  return (
    <View className="min-h-screen bg-background">
      <View className="mx-[12px] mt-[12px] px-[16px] bg-card rounded-[8px]">
        <View className="flex items-center py-[16px] border-b-[1px] border-solid border-border">
          <Text className="w-[80px] text-[14px] text-foreground">{t('user.nickname.current')}</Text>
          <Text className="flex-1 text-[14px] text-muted-foreground">
            {original || t('user.profile.notSet')}
          </Text>
        </View>
        <View className="flex items-center py-[16px]">
          <Text className="w-[80px] text-[14px] text-foreground">{t('user.nickname.newNickname')}</Text>
          <Input
            className="flex-1 text-[14px]"
            type="text"
            maxlength={MAX_LENGTH}
            placeholder={t('user.nickname.nicknamePlaceholder')}
            value={nickname}
            onInput={(e) => setNickname(e.detail.value)}
          />
        </View>
      </View>
      <Button
        className={`mx-[16px] mt-[30px] rounded-[20px] text-[16px] ${
          nickname.trim() ? 'bg-primary text-white' : 'bg-[#ccc] text-white'
        }`}
        disabled={!nickname.trim()}
        onClick={onSubmit}
      >
        {t('user.nickname.save')}
      </Button>
    </View>
  )
}
