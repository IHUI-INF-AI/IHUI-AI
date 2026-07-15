import { logger } from '@/utils/logger'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { updatePassword } from '@/api'
import { useI18n } from '@/i18n'

export default function Password() {
  const { t } = useI18n()
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')

  async function onSubmit() {
    if (!oldPwd) {
      return Taro.showToast({ title: t('user.password.enterOld'), icon: 'none' })
    }
    if (newPwd.length < 6) {
      return Taro.showToast({ title: t('user.password.tooShort'), icon: 'none' })
    }
    if (newPwd !== confirmPwd) {
      return Taro.showToast({ title: t('user.password.mismatch'), icon: 'none' })
    }
    try {
      await updatePassword(oldPwd, newPwd)
      Taro.showToast({ title: t('user.password.success'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {
      logger.error('user/password', '修改密码', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="mx-[12px] mt-[12px] px-[16px] bg-white rounded-[8px]">
        <View className="flex items-center py-[16px] border-b-[1px] border-solid border-[#f5f5f5]">
          <Text className="w-[80px] text-[14px] text-[#333]">{t('user.password.oldPassword')}</Text>
          <Input
            className="flex-1 text-[14px]"
            password
            placeholder={t('user.password.oldPlaceholder')}
            value={oldPwd}
            onInput={(e) => setOldPwd(e.detail.value)}
          />
        </View>
        <View className="flex items-center py-[16px] border-b-[1px] border-solid border-[#f5f5f5]">
          <Text className="w-[80px] text-[14px] text-[#333]">{t('user.password.newPassword')}</Text>
          <Input
            className="flex-1 text-[14px]"
            password
            placeholder={t('user.password.newPlaceholder')}
            value={newPwd}
            onInput={(e) => setNewPwd(e.detail.value)}
          />
        </View>
        <View className="flex items-center py-[16px]">
          <Text className="w-[80px] text-[14px] text-[#333]">
            {t('user.password.confirmPassword')}
          </Text>
          <Input
            className="flex-1 text-[14px]"
            password
            placeholder={t('user.password.confirmPlaceholder')}
            value={confirmPwd}
            onInput={(e) => setConfirmPwd(e.detail.value)}
          />
        </View>
      </View>
      <Button
        className={`mx-[16px] mt-[30px] rounded-[20px] text-[16px] ${
          oldPwd && newPwd && confirmPwd ? 'bg-[#07c160] text-white' : 'bg-[#ccc] text-white'
        }`}
        disabled={!oldPwd || !newPwd || !confirmPwd}
        onClick={onSubmit}
      >
        {t('user.password.submit')}
      </Button>
    </View>
  )
}
