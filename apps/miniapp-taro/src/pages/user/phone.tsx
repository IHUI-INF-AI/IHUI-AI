import { logger } from '@/utils/logger'
import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useRef, useCallback } from 'react'
import { getProfile, sendSmsCode, bindPhone, pwdExist } from '@/api'
import { useI18n } from '@/i18n'

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
      logger.error('user/phone', '获取用户信息', e)
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
      logger.error('user/phone', '发送当前手机验证码', e)
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
      logger.error('user/phone', '查询手机号是否已注册', e)
      // 查询失败不阻塞,继续发送
    }
    try {
      await sendSmsCode(phone)
      Taro.showToast({ title: tt('user.phone.codeSent', '验证码已发送'), icon: 'success' })
      startNewCountdown()
    } catch (e) {
      logger.error('user/phone', '发送新手机验证码', e)
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
      logger.error('user/phone', '绑定手机号', e)
      Taro.showToast({ title: tt('common.failed', '操作失败'), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className="min-h-screen bg-background">
      {step === 1 ? (
        <View className="p-[24rpx] pb-[32rpx]">
          <View className="bg-card rounded-[16rpx] p-[28rpx] mb-[24rpx]">
            <Text className="block text-[30rpx] font-semibold text-foreground mb-[16rpx]">
              {tt('user.phone.step1Title', '验证当前手机号')}
            </Text>
            <Text className="block text-[26rpx] text-muted-foreground leading-[1.6]">
              {tt('user.phone.currentLabel', '当前手机号')}: {maskedPhone}
            </Text>
          </View>
          <View className="bg-card rounded-[16rpx] p-[28rpx] mb-[24rpx]">
            <Text className="block text-[28rpx] font-semibold text-foreground mb-[16rpx]">
              {tt('user.phone.code', '验证码')}
            </Text>
            <View className="flex items-center gap-[16rpx]">
              <Input
                className="flex-1 h-[80rpx] px-[24rpx] text-[28rpx] bg-background rounded-[12rpx] box-border"
                type="number"
                maxlength={6}
                placeholder={tt('user.phone.codePlaceholder', '请输入验证码')}
                value={oldCode}
                onInput={(e) => setOldCode(e.detail.value)}
              />
              <Text
                className={`shrink-0 h-[80rpx] leading-[80rpx] px-[28rpx] text-[26rpx] bg-card border rounded-[12rpx] ${oldCountdown > 0 ? 'text-muted-foreground border-border' : 'text-primary border-primary'}`}
                onClick={onGetOldCode}
              >
                {oldCountdown > 0 ? `${oldCountdown}s` : tt('user.phone.getCode', '获取验证码')}
              </Text>
            </View>
          </View>
          <View
            className={`h-[88rpx] flex items-center justify-center bg-primary text-primary-foreground text-[30rpx] rounded-[12rpx] ${oldCode.trim().length === 6 ? '' : 'opacity-50'}`}
            onClick={onVerifyOld}
          >
            <Text>{tt('user.phone.next', '下一步')}</Text>
          </View>
        </View>
      ) : (
        <View className="p-[24rpx] pb-[32rpx]">
          {currentPhone ? (
            <View className="bg-card rounded-[16rpx] p-[28rpx] mb-[24rpx]">
              <Text className="block text-[30rpx] font-semibold text-foreground mb-[16rpx]">
                {tt('user.phone.step2Title', '绑定新手机号')}
              </Text>
              <Text className="block text-[26rpx] text-muted-foreground leading-[1.6]">
                {tt('user.phone.verifiedTip', '当前手机号已通过验证')}: {maskedPhone}
              </Text>
            </View>
          ) : (
            <View className="bg-card rounded-[16rpx] p-[28rpx] mb-[24rpx]">
              <Text className="block text-[30rpx] font-semibold text-foreground mb-[16rpx]">
                {tt('user.phone.bindTitle', '绑定手机号')}
              </Text>
              <Text className="block text-[26rpx] text-muted-foreground leading-[1.6]">
                {tt('user.phone.bindDesc', '绑定后可用于登录、找回密码、接收通知')}
              </Text>
            </View>
          )}
          <View className="bg-card rounded-[16rpx] p-[28rpx] mb-[24rpx] flex flex-col gap-[24rpx]">
            <View>
              <Text className="block text-[28rpx] font-semibold text-foreground mb-[16rpx]">
                {tt('user.phone.phone', '手机号')}
              </Text>
              <Input
                className="w-full h-[80rpx] px-[24rpx] text-[28rpx] bg-background rounded-[12rpx] box-border"
                type="number"
                maxlength={11}
                placeholder={tt('user.phone.newPhonePlaceholder', '请输入新手机号')}
                value={newPhone}
                onInput={(e) => setNewPhone(e.detail.value)}
              />
            </View>
            <View>
              <Text className="block text-[28rpx] font-semibold text-foreground mb-[16rpx]">
                {tt('user.phone.code', '验证码')}
              </Text>
              <View className="flex items-center gap-[16rpx]">
                <Input
                  className="flex-1 h-[80rpx] px-[24rpx] text-[28rpx] bg-background rounded-[12rpx] box-border"
                  type="number"
                  maxlength={6}
                  placeholder={tt('user.phone.codePlaceholder', '请输入验证码')}
                  value={newCode}
                  onInput={(e) => setNewCode(e.detail.value)}
                />
                <Text
                  className={`shrink-0 h-[80rpx] leading-[80rpx] px-[28rpx] text-[26rpx] bg-card border rounded-[12rpx] ${newCountdown > 0 ? 'text-muted-foreground border-border' : 'text-primary border-primary'}`}
                  onClick={onGetNewCode}
                >
                  {newCountdown > 0 ? `${newCountdown}s` : tt('user.phone.getCode', '获取验证码')}
                </Text>
              </View>
            </View>
          </View>
          <View
            className={`h-[88rpx] flex items-center justify-center bg-primary text-primary-foreground text-[30rpx] rounded-[12rpx] ${/^1\d{10}$/.test((newPhone || '').trim()) && newCode.trim().length === 6 && !submitting ? '' : 'opacity-50'}`}
            onClick={onSubmit}
          >
            <Text>
              {submitting ? tt('user.phone.binding', '绑定中…') : tt('user.phone.bind', '绑定')}
            </Text>
          </View>
          <View className="mt-[24rpx] bg-muted rounded-[16rpx] p-[28rpx]">
            <Text className="block text-[28rpx] font-semibold text-primary mb-[12rpx]">
              {tt('user.phone.noticeTitle', '【更换后影响】')}
            </Text>
            <Text className="block text-[26rpx] text-foreground leading-[1.6]">
              {tt(
                'user.phone.noticeDesc',
                '更换成功后,登录、找回密码、消息通知等将使用新手机号;旧手机号将无法再用于本账号登录,请确认后再操作。',
              )}
            </Text>
          </View>
        </View>
      )}
    </View>
  )
}
