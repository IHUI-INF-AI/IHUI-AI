import { logger } from '@/utils/logger'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { updatePassword } from '@/api'
import { useI18n } from '@/i18n'

export default function Password() {
  const { t } = useI18n()
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const tt = useCallback((k: string, fb: string) => {
    const v = t(k)
    return v === k ? fb : v
  }, [t])

  const newPwdValid = newPwd.length >= 6 && newPwd.length <= 20
  const confirmMatch = newPwd !== '' && newPwd === confirmPwd

  async function onSubmit() {
    if (submitting) return
    if (!oldPwd) {
      return Taro.showToast({ title: tt('user.password.enterOld', '请输入原密码'), icon: 'none' })
    }
    if (newPwd.length < 6 || newPwd.length > 20) {
      return Taro.showToast({ title: tt('user.password.tooShort', '密码长度 6-20 位'), icon: 'none' })
    }
    if (newPwd !== confirmPwd) {
      return Taro.showToast({ title: tt('user.password.mismatch', '两次输入的密码不一致'), icon: 'none' })
    }
    if (oldPwd === newPwd) {
      return Taro.showToast({ title: tt('user.password.sameAsOld', '新密码不能与原密码相同'), icon: 'none' })
    }
    setSubmitting(true)
    try {
      await updatePassword(oldPwd, newPwd)
      Taro.showToast({ title: tt('user.password.success', '密码修改成功'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {
      logger.error('user/password', '修改密码', e)
      Taro.showToast({ title: tt('common.failed', '操作失败'), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  function gotoForgot() {
    Taro.navigateTo({ url: '/pages/forgot-password/index' })
  }

  return (
    <View className="min-h-screen bg-background">
      <View className="m-[24rpx] px-[32rpx] bg-card rounded-[12rpx]">
        <View className="py-[32rpx] mb-[16rpx]">
          <Text className="block w-[160rpx] text-[28rpx] text-foreground mb-[16rpx]">{tt('user.password.oldPassword', '原密码')}</Text>
          <View className="relative">
            <Input
              className="w-full h-[72rpx] bg-background rounded-[8rpx] pr-[120rpx] pl-[20rpx] text-[28rpx] box-border"
              password={!showOld}
              maxlength={20}
              placeholder={tt('user.password.oldPlaceholder', '请输入原密码')}
              value={oldPwd}
              onInput={(e) => setOldPwd(e.detail.value)}
            />
            <Text className="absolute right-[20rpx] top-1/2 -translate-y-1/2 text-[24rpx] text-primary" onClick={() => setShowOld((v) => !v)}>
              {showOld ? tt('user.password.hide', '隐藏') : tt('user.password.show', '显示')}
            </Text>
          </View>
        </View>
        <View className="py-[32rpx] mb-[16rpx]">
          <Text className="block w-[160rpx] text-[28rpx] text-foreground mb-[16rpx]">{tt('user.password.newPassword', '新密码')}</Text>
          <View className="relative">
            <Input
              className="w-full h-[72rpx] bg-background rounded-[8rpx] pr-[120rpx] pl-[20rpx] text-[28rpx] box-border"
              password={!showNew}
              maxlength={20}
              placeholder={tt('user.password.newPlaceholder', '请输入新密码')}
              value={newPwd}
              onInput={(e) => setNewPwd(e.detail.value)}
            />
            <Text className="absolute right-[20rpx] top-1/2 -translate-y-1/2 text-[24rpx] text-primary" onClick={() => setShowNew((v) => !v)}>
              {showNew ? tt('user.password.hide', '隐藏') : tt('user.password.show', '显示')}
            </Text>
          </View>
          {newPwd !== '' && !newPwdValid && (
            <Text className="block mt-[12rpx] text-[22rpx] text-destructive">
              {tt('user.password.tooShort', '密码长度 6-20 位')}
            </Text>
          )}
        </View>
        <View className="py-[32rpx]">
          <Text className="block w-[160rpx] text-[28rpx] text-foreground mb-[16rpx]">{tt('user.password.confirmPassword', '确认密码')}</Text>
          <View className="relative">
            <Input
              className="w-full h-[72rpx] bg-background rounded-[8rpx] pr-[120rpx] pl-[20rpx] text-[28rpx] box-border"
              password={!showConfirm}
              maxlength={20}
              placeholder={tt('user.password.confirmPlaceholder', '请再次输入新密码')}
              value={confirmPwd}
              onInput={(e) => setConfirmPwd(e.detail.value)}
            />
            <Text className="absolute right-[20rpx] top-1/2 -translate-y-1/2 text-[24rpx] text-primary" onClick={() => setShowConfirm((v) => !v)}>
              {showConfirm ? tt('user.password.hide', '隐藏') : tt('user.password.show', '显示')}
            </Text>
          </View>
          {confirmPwd !== '' && !confirmMatch && (
            <Text className="block mt-[12rpx] text-[22rpx] text-destructive">
              {tt('user.password.mismatch', '两次输入的密码不一致')}
            </Text>
          )}
        </View>
      </View>

      <View className="mx-[32rpx] mt-[24rpx] text-right text-[24rpx] text-primary" onClick={gotoForgot}>
        <Text>{tt('user.password.forgotOld', '忘记原密码?通过手机验证修改')}</Text>
      </View>

      <View
        className={`mx-[32rpx] mt-[40rpx] h-[88rpx] leading-[88rpx] text-center bg-primary text-foreground text-[30rpx] rounded-[8rpx] ${oldPwd && newPwdValid && confirmMatch && !submitting ? '' : 'opacity-50'}`}
        onClick={onSubmit}
      >
        <Text>{submitting ? tt('user.password.submitting', '修改中…') : tt('user.password.submit', '修改密码')}</Text>
      </View>
    </View>
  )
}
