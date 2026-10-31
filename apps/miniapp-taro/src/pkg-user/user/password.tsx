// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/change-pwd/ChangePwdScreen.tsx

import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import { FocusInput } from '@/components/FocusField'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { changePassword } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

export default function Password() {
  const { t } = useI18n()
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

  const newPwdValid = newPwd.length >= 6 && newPwd.length <= 20
  const confirmMatch = newPwd !== '' && newPwd === confirmPwd

  async function onSubmit() {
    if (submitting) return
    if (!oldPwd) {
      return Taro.showToast({ title: tt('user.password.enterOld', '请输入原密码'), icon: 'none' })
    }
    if (newPwd.length < 6 || newPwd.length > 20) {
      return Taro.showToast({
        title: tt('user.password.tooShort', '密码长度 6-20 位'),
        icon: 'none',
      })
    }
    if (newPwd !== confirmPwd) {
      return Taro.showToast({
        title: tt('user.password.mismatch', '两次输入的密码不一致'),
        icon: 'none',
      })
    }
    if (oldPwd === newPwd) {
      return Taro.showToast({
        title: tt('user.password.sameAsOld', '新密码不能与原密码相同'),
        icon: 'none',
      })
    }
    setSubmitting(true)
    try {
      /* 端点契约 = `PUT /api/auth/password { oldPassword, newPassword }`
         (apps/api/src/routes/auth.ts:1768-1786)。此前走 `updatePassword(oldPwd,newPwd)`
         → `POST /api/user/password` 发 `{ oldPwd, newPwd }`(api/index.ts:1028),与该
         handler 的 zod 字段名不符(miniapp-compat-routes.ts:2490-2497)⇒ 必 400,
         `user.password.success` 那一支从来渲染不出来。 */
      await changePassword({ oldPassword: oldPwd, newPassword: newPwd })
      Taro.showToast({ title: tt('user.password.success', '密码修改成功'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {
      logger.error('user/password', '修改密码', e)
      /* `common.failed` 五语言词条是「加载失败」,用在提交失败处是说谎文案;
         取已在册且语义精确的 `settings.pwdChangeFailed`(与设置页密码弹层同一句)。 */
      Taro.showToast({ title: t('settings.pwdChangeFailed'), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  function gotoForgot() {
    Taro.navigateTo({ url: '/pages/forgot-password/index' })
  }

  return (
    <ThemeRoot>
      {/* 对齐 RN 共享 ChangePwdScreen:页面浅灰底 + 无卡片平铺(体 padding 28rpx + 字段间距 24rpx);
          label 32rpx 次级字色;输入盒 muted 底 / 圆角 24rpx / 高 100rpx / 字 32rpx(无描边);
          提交钮品牌底 100rpx 高圆角 24rpx,字 32rpx/600 对比白 */}
      <View className="min-h-screen bg-background">
        <View className="flex flex-col gap-[24rpx] p-[28rpx]">
          <View className="flex flex-col gap-[12rpx]">
            <Text className="text-[length:32rpx] text-muted-foreground">
              {tt('settings.oldPassword', '旧密码')}
            </Text>
            <View className="relative flex h-[100rpx] items-center rounded-xl bg-muted px-[24rpx]">
              <FocusInput
                className="box-border h-full w-full bg-transparent pr-[120rpx] text-[length:32rpx] text-foreground"
                password={!showOld}
                maxlength={20}
                placeholder={tt('user.password.oldPlaceholder', '请输入原密码')}
                value={oldPwd}
                onInput={(e) => setOldPwd(e.detail.value)}
              />
              <Text
                className="absolute right-[24rpx] text-body text-muted-foreground"
                onClick={() => setShowOld((v) => !v)}
              >
                {showOld ? tt('user.password.hide', '隐藏') : tt('user.password.show', '显示')}
              </Text>
            </View>
          </View>
          <View className="flex flex-col gap-[12rpx]">
            <Text className="text-[length:32rpx] text-muted-foreground">
              {tt('user.password.newPassword', '新密码')}
            </Text>
            <View className="relative flex h-[100rpx] items-center rounded-xl bg-muted px-[24rpx]">
              <FocusInput
                className="box-border h-full w-full bg-transparent pr-[120rpx] text-[length:32rpx] text-foreground"
                password={!showNew}
                maxlength={20}
                placeholder={tt('user.password.newPlaceholder', '请输入新密码')}
                value={newPwd}
                onInput={(e) => setNewPwd(e.detail.value)}
              />
              <Text
                className="absolute right-[24rpx] text-body text-muted-foreground"
                onClick={() => setShowNew((v) => !v)}
              >
                {showNew ? tt('user.password.hide', '隐藏') : tt('user.password.show', '显示')}
              </Text>
            </View>
            {newPwd !== '' && !newPwdValid && (
              <Text className="mt-[12rpx] text-caption text-destructive">
                {tt('user.password.tooShort', '密码长度 6-20 位')}
              </Text>
            )}
          </View>
          <View className="flex flex-col gap-[12rpx]">
            <Text className="text-[length:32rpx] text-muted-foreground">
              {tt('settings.confirmPassword', '确认新密码')}
            </Text>
            <View className="relative flex h-[100rpx] items-center rounded-xl bg-muted px-[24rpx]">
              <FocusInput
                className="box-border h-full w-full bg-transparent pr-[120rpx] text-[length:32rpx] text-foreground"
                password={!showConfirm}
                maxlength={20}
                placeholder={tt('user.password.confirmPlaceholder', '请再次输入新密码')}
                value={confirmPwd}
                onInput={(e) => setConfirmPwd(e.detail.value)}
              />
              <Text
                className="absolute right-[24rpx] text-body text-muted-foreground"
                onClick={() => setShowConfirm((v) => !v)}
              >
                {showConfirm ? tt('user.password.hide', '隐藏') : tt('user.password.show', '显示')}
              </Text>
            </View>
            {confirmPwd !== '' && !confirmMatch && (
              <Text className="mt-[12rpx] text-caption text-destructive">
                {tt('user.password.mismatch', '两次输入的密码不一致')}
              </Text>
            )}
          </View>

          <Text className="text-right text-body text-primary" onClick={gotoForgot}>
            {tt('user.password.forgotOld', '忘记原密码?通过手机验证修改')}
          </Text>

          <View
            className={`mt-[16rpx] flex h-[100rpx] items-center justify-center rounded-xl bg-primary ${
              oldPwd && newPwdValid && confirmMatch && !submitting ? '' : 'opacity-60'
            }`}
            hoverClass="opacity-70"
            onClick={onSubmit}
          >
            <Text className="text-[length:32rpx] font-semibold text-[var(--color-surface-light)]">
              {submitting
                ? tt('user.password.submitting', '修改中…')
                : tt('user.password.submit', '修改密码')}
            </Text>
          </View>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
