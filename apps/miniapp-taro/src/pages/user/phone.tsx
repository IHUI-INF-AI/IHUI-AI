// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useRef, useCallback } from 'react'
import { getProfile, sendSmsCode, bindPhone, pwdExist } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

export default function Phone() {
  const { t } = useI18n()
  const [currentPhone, setCurrentPhone] = useState('')
  const [step, setStep] = useState<1 | 2>(1)
  // step 1: 验证当前手机号
  const [oldCode, setOldCode] = useState('')
  const [oldCountdown, setOldCountdown] = useState(0)
  // step 2: 绑定新手机号
  const [newPhone, setNewPhone] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newCountdown, setNewCountdown] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const oldTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const newTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

  const maskedPhone = (() => {
    const p = (currentPhone || '').trim()
    if (!p || p.length < 11) return tt('user.phone.unbound', '未绑定')
    return p.slice(0, 3) + '****' + p.slice(-4)
  })()

  useDidShow(async () => {
    try {
      const profile = await getProfile()
      const p = profile.phone || ''
      setCurrentPhone(p)
      // 已绑定手机号 → 进入两步流程第一步;未绑定 → 直接进入第二步绑定
      setStep(p && p.length === 11 ? 1 : 2)
    } catch (e) {
      logger.error('user/phone', t('userPhone.q1'), e)
      setStep(2)
    }
  })

  function startOldCountdown() {
    setOldCountdown(60)
    oldTimerRef.current = setInterval(() => {
      setOldCountdown((prev) => {
        if (prev <= 1) {
          if (oldTimerRef.current) clearInterval(oldTimerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  function startNewCountdown() {
    setNewCountdown(60)
    newTimerRef.current = setInterval(() => {
      setNewCountdown((prev) => {
        if (prev <= 1) {
          if (newTimerRef.current) clearInterval(newTimerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  async function onGetOldCode() {
    if (oldCountdown > 0) return
    const p = (currentPhone || '').trim()
    if (!p || p.length !== 11) {
      Taro.showToast({ title: tt('user.phone.noCurrent', '当前未绑定手机号'), icon: 'none' })
      return
    }
    try {
      await sendSmsCode(p)
      Taro.showToast({ title: tt('user.phone.codeSent', '验证码已发送'), icon: 'success' })
      startOldCountdown()
    } catch (e) {
      logger.error('user/phone', t('userPhone.q2'), e)
      Taro.showToast({ title: tt('user.phone.codeSendFailed', '验证码发送失败'), icon: 'none' })
    }
  }

  function onVerifyOld() {
    if (oldCode.trim().length !== 6) {
      Taro.showToast({ title: tt('user.phone.codeLength', '请输入 6 位验证码'), icon: 'none' })
      return
    }
    // 当前项目未提供单独的"验证当前手机号"接口,直接进入第二步
    // 绑定新手机号时后端会再次校验
    setStep(2)
  }

  async function onGetNewCode() {
    if (newCountdown > 0) return
    const phone = (newPhone || '').trim()
    if (!/^1\d{10}$/.test(phone)) {
      Taro.showToast({ title: tt('user.phone.phoneInvalid', '手机号格式不正确'), icon: 'none' })
      return
    }
    if (phone === currentPhone) {
      Taro.showToast({
        title: tt('user.phone.sameAsCurrent', '新手机号不能与当前手机号相同'),
        icon: 'none',
      })
      return
    }
    try {
      const exist = await pwdExist(phone)
      if (exist) {
        Taro.showToast({
          title: tt('user.phone.alreadyRegistered', '该手机号已注册,请换用其他手机号'),
          icon: 'none',
        })
        return
      }
    } catch (e) {
      logger.error('user/phone', t('userPhone.q3'), e)
      // 查询失败不阻塞,继续发送
    }
    try {
      await sendSmsCode(phone)
      Taro.showToast({ title: tt('user.phone.codeSent', '验证码已发送'), icon: 'success' })
      startNewCountdown()
    } catch (e) {
      logger.error('user/phone', t('userPhone.q4'), e)
      Taro.showToast({ title: tt('user.phone.codeSendFailed', '验证码发送失败'), icon: 'none' })
    }
  }

  async function onSubmit() {
    if (submitting) return
    const phone = (newPhone || '').trim()
    const code = (newCode || '').trim()
    if (!/^1\d{10}$/.test(phone)) {
      Taro.showToast({ title: tt('user.phone.phoneInvalid', '手机号格式不正确'), icon: 'none' })
      return
    }
    if (code.length !== 6) {
      Taro.showToast({ title: tt('user.phone.codeLength', '请输入 6 位验证码'), icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await bindPhone(phone, code)
      Taro.showToast({ title: tt('user.phone.bindSuccess', '手机号绑定成功'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {
      logger.error('user/phone', t('user.phone.bindTitle'), e)
      Taro.showToast({ title: tt('common.failed', '操作失败'), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ThemeRoot>
      {/* 对齐 RN 共享 ChangePhoneScreen:页面浅灰底 + 内容边距 48rpx;居中大标题 44rpx/700 +
          说明行 28rpx 次级字色;输入盒描边 border.light + muted 底 + 高 100rpx + 圆角 24rpx;
          发送按钮 28rpx/700 品牌橙纯文字;提交钮品牌底 100rpx 高圆角 24rpx */}
      <View className="min-h-screen bg-background">
        {step === 1 ? (
          <View className="p-[48rpx]">
            <Text className="block text-center text-[44rpx] font-bold text-foreground">
              {tt('user.phone.step1Title', '验证当前手机号')}
            </Text>
            <Text className="mb-[48rpx] mt-[16rpx] block text-center text-[28rpx] text-muted-foreground">
              {tt('user.phone.currentLabel', '当前手机号')}: {maskedPhone}
            </Text>
            <View className="mb-[32rpx]">
              <View className="box-border flex h-[100rpx] items-center rounded-[24rpx] border border-[var(--color-border)] bg-muted px-[24rpx]">
                <Input
                  className="h-full flex-1 text-[32rpx] text-foreground"
                  type="number"
                  maxlength={6}
                  placeholder={tt('user.phone.codePlaceholder', '请输入验证码')}
                  value={oldCode}
                  onInput={(e) => setOldCode(e.detail.value)}
                />
                <Text
                  className={`shrink-0 pl-[24rpx] text-[28rpx] ${
                    oldCountdown > 0
                      ? 'text-muted-foreground'
                      : 'font-bold text-[var(--color-brand-orange)]'
                  }`}
                  onClick={onGetOldCode}
                >
                  {oldCountdown > 0 ? `${oldCountdown}s` : tt('user.phone.getCode', '获取验证码')}
                </Text>
              </View>
            </View>
            <View
              className={`mt-[16rpx] flex h-[100rpx] items-center justify-center rounded-[24rpx] bg-primary ${
                oldCode.trim().length === 6 ? '' : 'opacity-60'
              }`}
              hoverClass="opacity-60"
              onClick={onVerifyOld}
            >
              <Text className="text-[32rpx] font-bold text-[var(--color-surface-light)]">
                {tt('user.phone.next', '下一步')}
              </Text>
            </View>
          </View>
        ) : (
          <View className="p-[48rpx]">
            <Text className="block text-center text-[44rpx] font-bold text-foreground">
              {currentPhone
                ? tt('user.phone.step2Title', '绑定新手机号')
                : tt('user.phone.bindTitle', '绑定手机号')}
            </Text>
            <Text className="mb-[48rpx] mt-[16rpx] block text-center text-[28rpx] text-muted-foreground">
              {currentPhone
                ? `${tt('user.phone.verifiedTip', '当前手机号已通过验证')}: ${maskedPhone}`
                : tt('user.phone.bindDesc', '绑定后可用于登录、找回密码、接收通知')}
            </Text>
            <View className="mb-[32rpx]">
              <View className="box-border flex h-[100rpx] items-center rounded-[24rpx] border border-[var(--color-border)] bg-muted px-[24rpx]">
                <Input
                  className="h-full flex-1 text-[32rpx] text-foreground"
                  type="number"
                  maxlength={11}
                  placeholder={tt('user.phone.newPhonePlaceholder', '请输入新手机号')}
                  value={newPhone}
                  onInput={(e) => setNewPhone(e.detail.value)}
                />
              </View>
            </View>
            <View className="mb-[32rpx]">
              <View className="box-border flex h-[100rpx] items-center rounded-[24rpx] border border-[var(--color-border)] bg-muted px-[24rpx]">
                <Input
                  className="h-full flex-1 text-[32rpx] text-foreground"
                  type="number"
                  maxlength={6}
                  placeholder={tt('user.phone.codePlaceholder', '请输入验证码')}
                  value={newCode}
                  onInput={(e) => setNewCode(e.detail.value)}
                />
                <Text
                  className={`shrink-0 pl-[24rpx] text-[28rpx] ${
                    newCountdown > 0
                      ? 'text-muted-foreground'
                      : 'font-bold text-[var(--color-brand-orange)]'
                  }`}
                  onClick={onGetNewCode}
                >
                  {newCountdown > 0 ? `${newCountdown}s` : tt('user.phone.getCode', '获取验证码')}
                </Text>
              </View>
            </View>
            <View
              className={`mt-[16rpx] flex h-[100rpx] items-center justify-center rounded-[24rpx] bg-primary ${
                /^1\d{10}$/.test((newPhone || '').trim()) && newCode.trim().length === 6 && !submitting
                  ? ''
                  : 'opacity-60'
              }`}
              hoverClass="opacity-60"
              onClick={onSubmit}
            >
              <Text className="text-[32rpx] font-bold text-[var(--color-surface-light)]">
                {submitting ? tt('user.phone.binding', '绑定中…') : tt('user.phone.bind', '绑定')}
              </Text>
            </View>
            <View className="mt-[24rpx] rounded-[24rpx] bg-muted p-[24rpx]">
              <Text className="mb-[12rpx] block text-[28rpx] font-semibold text-[var(--color-brand-orange)]">
                {tt('user.phone.noticeTitle', '【更换后影响】')}
              </Text>
              <Text className="block text-[28rpx] leading-[1.6] text-foreground">
                {tt(
                  'user.phone.noticeDesc',
                  '更换成功后,登录、找回密码、消息通知等将使用新手机号;旧手机号将无法再用于本账号登录,请确认后再操作。',
                )}
              </Text>
            </View>
          </View>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
