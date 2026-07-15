import { logger } from '@/utils/logger'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { realNameAuth, getProfile } from '@/api'
import { useI18n } from '@/i18n'

export default function Realname() {
  const { t } = useI18n()
  const [realName, setRealName] = useState('')
  const [idCard, setIdCard] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [authName, setAuthName] = useState('')

  const load = useCallback(async () => {
    try {
      const profile = await getProfile()
      if (profile.realName) {
        setAuthenticated(true)
        setAuthName(profile.realName)
      }
    } catch (e) {
      logger.error('user/realname', '获取用户信息', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }, [t])

  useDidShow(() => {
    load()
  })

  async function onSubmit() {
    if (!realName.trim()) {
      return Taro.showToast({ title: t('user.realname.enterRealName'), icon: 'none' })
    }
    if (idCard.length !== 18) {
      return Taro.showToast({ title: t('user.realname.idCardLength'), icon: 'none' })
    }
    try {
      await realNameAuth({ realName: realName.trim(), idCard })
      Taro.showToast({ title: t('user.realname.authSuccess'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {
      logger.error('user/realname', '提交实名认证', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }

  if (authenticated) {
    return (
      <View className="min-h-screen bg-[#f7f8fa]">
        <View className="mx-[12px] mt-[30px] py-[40px] bg-white rounded-[8px] flex flex-col items-center">
          <Text className="text-[48px]">✓</Text>
          <Text className="mt-[12px] text-[16px] text-[#333]">{t('user.realname.authed')}</Text>
          <Text className="mt-[8px] text-[13px] text-[#999]">{authName}</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="mx-[12px] mt-[12px] px-[16px] bg-white rounded-[8px]">
        <View className="flex items-center py-[16px] border-b-[1px] border-solid border-[#f5f5f5]">
          <Text className="w-[80px] text-[14px] text-[#333]">{t('user.realname.realName')}</Text>
          <Input
            className="flex-1 text-[14px]"
            type="text"
            placeholder={t('user.realname.realNamePlaceholder')}
            value={realName}
            onInput={(e) => setRealName(e.detail.value)}
          />
        </View>
        <View className="flex items-center py-[16px]">
          <Text className="w-[80px] text-[14px] text-[#333]">{t('user.realname.idCard')}</Text>
          <Input
            className="flex-1 text-[14px]"
            type="idcard"
            maxlength={18}
            placeholder={t('user.realname.idCardPlaceholder')}
            value={idCard}
            onInput={(e) => setIdCard(e.detail.value)}
          />
        </View>
      </View>
      <Button
        className={`mx-[16px] mt-[30px] rounded-[20px] text-[16px] ${
          realName.trim() && idCard ? 'bg-[#07c160] text-white' : 'bg-[#ccc] text-white'
        }`}
        disabled={!realName.trim() || !idCard}
        onClick={onSubmit}
      >
        {t('user.realname.submit')}
      </Button>
    </View>
  )
}
