import { logger } from '@/utils/logger'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { updatePassword } from '@/api'
import { useI18n } from '@/i18n'
import './password.css'

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
    <View className="pwd-page">
      <View className="pwd-card">
        <View className="pwd-row pwd-row-divider">
          <Text className="pwd-label">{tt('user.password.oldPassword', '原密码')}</Text>
          <View className="pwd-input-wrap">
            <Input
              className="pwd-input"
              password={!showOld}
              maxlength={20}
              placeholder={tt('user.password.oldPlaceholder', '请输入原密码')}
              value={oldPwd}
              onInput={(e) => setOldPwd(e.detail.value)}
            />
            <Text className="pwd-toggle" onClick={() => setShowOld((v) => !v)}>
              {showOld ? tt('user.password.hide', '隐藏') : tt('user.password.show', '显示')}
            </Text>
          </View>
        </View>
        <View className="pwd-row pwd-row-divider">
          <Text className="pwd-label">{tt('user.password.newPassword', '新密码')}</Text>
          <View className="pwd-input-wrap">
            <Input
              className="pwd-input"
              password={!showNew}
              maxlength={20}
              placeholder={tt('user.password.newPlaceholder', '请输入新密码')}
              value={newPwd}
              onInput={(e) => setNewPwd(e.detail.value)}
            />
            <Text className="pwd-toggle" onClick={() => setShowNew((v) => !v)}>
              {showNew ? tt('user.password.hide', '隐藏') : tt('user.password.show', '显示')}
            </Text>
          </View>
          {newPwd !== '' && !newPwdValid && (
            <Text className="pwd-hint pwd-hint-error">
              {tt('user.password.tooShort', '密码长度 6-20 位')}
            </Text>
          )}
        </View>
        <View className="pwd-row">
          <Text className="pwd-label">{tt('user.password.confirmPassword', '确认密码')}</Text>
          <View className="pwd-input-wrap">
            <Input
              className="pwd-input"
              password={!showConfirm}
              maxlength={20}
              placeholder={tt('user.password.confirmPlaceholder', '请再次输入新密码')}
              value={confirmPwd}
              onInput={(e) => setConfirmPwd(e.detail.value)}
            />
            <Text className="pwd-toggle" onClick={() => setShowConfirm((v) => !v)}>
              {showConfirm ? tt('user.password.hide', '隐藏') : tt('user.password.show', '显示')}
            </Text>
          </View>
          {confirmPwd !== '' && !confirmMatch && (
            <Text className="pwd-hint pwd-hint-error">
              {tt('user.password.mismatch', '两次输入的密码不一致')}
            </Text>
          )}
        </View>
      </View>

      <View className="pwd-forgot" onClick={gotoForgot}>
        <Text>{tt('user.password.forgotOld', '忘记原密码?通过手机验证修改')}</Text>
      </View>

      <View
        className={`pwd-submit ${oldPwd && newPwdValid && confirmMatch && !submitting ? '' : 'disabled'}`}
        onClick={onSubmit}
      >
        <Text>{submitting ? tt('user.password.submitting', '修改中…') : tt('user.password.submit', '修改密码')}</Text>
      </View>
    </View>
  )
}
