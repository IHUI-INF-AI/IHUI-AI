import { logger } from '@/utils/logger'
import { View, Text, Button, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { getProfile, updateUserAvatar } from '@/api'
import { useI18n } from '@/i18n'

export default function Avatar() {
  const { t } = useI18n()
  const [avatar, setAvatar] = useState('')

  useDidShow(async () => {
    try {
      setAvatar((await getProfile()).avatar || '')
    } catch (e) {
      logger.error('user/avatar', '获取用户信息', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  })

  function chooseImg() {
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      success: async (res) => {
        const path = res.tempFilePaths[0]!
        try {
          setAvatar(path)
          await updateUserAvatar(path)
          Taro.showToast({ title: t('user.avatar.updateSuccess'), icon: 'success' })
        } catch (e) {
          logger.error('user/avatar', '更新头像', e)
          Taro.showToast({ title: t('common.failed'), icon: 'none' })
        }
      },
    })
  }

  return (
    <View className="min-h-screen bg-background px-[16px] pt-[30px]">
      <View
        className="w-[100px] h-[100px] mx-auto rounded-md overflow-hidden"
        style={{ boxShadow: '0 2px 10px rgba(0,0,0,.1)' }}
      >
        <Image
          className="w-full h-full"
          src={avatar || '/static/default-avatar.png'}
          mode="aspectFill"
        />
      </View>
      <Button
        className="mt-[30px] mb-[16px] bg-primary text-white rounded-[20px] text-[15px]"
        onClick={chooseImg}
      >
        {t('user.avatar.choose')}
      </Button>
      <View className="text-center">
        <Text className="block text-[11px] text-muted-foreground leading-[1.8]">
          {t('user.avatar.formatHint')}
        </Text>
        <Text className="block text-[11px] text-muted-foreground leading-[1.8]">
          {t('user.avatar.sizeHint')}
        </Text>
      </View>
    </View>
  )
}
