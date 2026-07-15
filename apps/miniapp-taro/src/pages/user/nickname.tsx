import { logger } from '@/utils/logger'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { updateUserNickname, getProfile } from '@/api'
import { useI18n } from '@/i18n'

export default function Nickname() {
  const { t } = useI18n()
  const [nickname, setNickname] = useState('')
  const [original, setOriginal] = useState('')

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
    if (!nickname.trim()) {
      return Taro.showToast({ title: t('user.nickname.enterNickname'), icon: 'none' })
    }
    try {
      await updateUserNickname(nickname.trim())
      Taro.showToast({ title: t('user.nickname.saveSuccess'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {
      logger.error('user/nickname', '修改昵称', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="mx-[12px] mt-[12px] px-[16px] bg-white rounded-[8px]">
        <View className="flex items-center py-[16px] border-b-[1px] border-solid border-[#f5f5f5]">
          <Text className="w-[80px] text-[14px] text-[#333]">{t('user.nickname.current')}</Text>
          <Text className="flex-1 text-[14px] text-[#999]">
            {original || t('user.profile.notSet')}
          </Text>
        </View>
        <View className="flex items-center py-[16px]">
          <Text className="w-[80px] text-[14px] text-[#333]">{t('user.nickname.newNickname')}</Text>
          <Input
            className="flex-1 text-[14px]"
            type="text"
            placeholder={t('user.nickname.nicknamePlaceholder')}
            value={nickname}
            onInput={(e) => setNickname(e.detail.value)}
          />
        </View>
      </View>
      <Button
        className={`mx-[16px] mt-[30px] rounded-[20px] text-[16px] ${
          nickname.trim() ? 'bg-[#07c160] text-white' : 'bg-[#ccc] text-white'
        }`}
        disabled={!nickname.trim()}
        onClick={onSubmit}
      >
        {t('user.nickname.save')}
      </Button>
    </View>
  )
}
