import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect, useRef, useCallback } from 'react'
import { sendSmsCode, loginBySms, register, bindPhone, type UserInfo } from '@/api'

export type VerifyCodeType = 'register' | 'login' | 'changePhone'

export interface VerifyCodeModalProps {
  visible?: boolean
  phone?: string
  type?: VerifyCodeType
  onClose?: () => void
  onSuccess?: (data: { token?: string; user?: UserInfo }) => void
}

const CODE_LENGTH = 6
const COUNTDOWN_SECONDS = 60

export default function VerifyCodeModal({
  visible = false,
  phone = '',
  type = 'login',
  onClose,
  onSuccess,
}: VerifyCodeModalProps) {
  const [codes, setCodes] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    setCodes(Array(CODE_LENGTH).fill(''))
    setCurrentIndex(0)
    setCountdown(0)
    setSubmitting(false)
    stopTimer()
  }, [stopTimer])

  useEffect(() => {
    if (!visible) reset()
    return stopTimer
  }, [visible, reset, stopTimer])

  const startCountdown = useCallback(() => {
    setCountdown(COUNTDOWN_SECONDS)
    stopTimer()
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          stopTimer()
          return 0
        }
        return c - 1
      })
    }, 1000)
  }, [stopTimer])

  const onSendCode = useCallback(async () => {
    if (countdown > 0) return
    if (!phone) {
      Taro.showToast({ title: '手机号为空', icon: 'none' })
      return
    }
    if (phone.length !== 11) {
      Taro.showToast({ title: '请输入正确手机号', icon: 'none' })
      return
    }
    try {
      await sendSmsCode(phone)
      Taro.showToast({ title: '验证码已发送', icon: 'success' })
      startCountdown()
    } catch {
      // ignore
    }
  }, [phone, countdown, startCountdown])

  const handleInput = useCallback(
    (index: number, value: string) => {
      const digit = value.replace(/\D/g, '').slice(-1)
      const next = [...codes]
      next[index] = digit
      setCodes(next)
      if (digit && index < CODE_LENGTH - 1) {
        setCurrentIndex(index + 1)
      }
    },
    [codes],
  )

  const fullCode = codes.join('')

  const verifyCode = useCallback(async () => {
    if (fullCode.length !== CODE_LENGTH) {
      Taro.showToast({ title: '请输入完整验证码', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      let result: { token?: string; user?: UserInfo } = {}
      if (type === 'register') {
        await register({ phone, code: fullCode })
      } else if (type === 'changePhone') {
        await bindPhone(phone, fullCode)
      } else {
        result = await loginBySms(phone, fullCode)
      }
      Taro.showToast({ title: '验证成功', icon: 'success' })
      onSuccess?.(result)
      onClose?.()
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }, [fullCode, type, phone, onSuccess, onClose])

  if (!visible) return null

  const sendText = countdown > 0 ? `${countdown}s 后重发` : '重新发送'

  return (
    <View className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <View className="absolute inset-0 bg-black/40" />
      <View
        className="relative bg-white rounded-xl mx-8 px-5 py-4 max-w-xs w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <View className="flex items-center justify-between mb-3">
          <Text className="text-base font-medium text-gray-800">获取验证码</Text>
          <Text className="text-sm text-gray-400" onClick={onClose}>
            关闭
          </Text>
        </View>
        <Text className="block text-xs text-gray-500 mb-3 leading-relaxed">
          验证码已发送至 {phone}
        </Text>
        <View className="flex justify-between mb-3">
          {codes.map((c, idx) => (
            <Input
              key={idx}
              className="w-9 h-11 text-center text-base border border-gray-200 rounded-md"
              type="number"
              maxlength={1}
              focus={visible && idx === currentIndex}
              value={c}
              onInput={(e) => handleInput(idx, e.detail.value)}
            />
          ))}
        </View>
        <View
          className={`text-center text-sm mb-4 ${countdown > 0 ? 'text-gray-400' : 'text-indigo-500'}`}
          onClick={onSendCode}
        >
          <Text>{sendText}</Text>
        </View>
        <View className="flex space-x-3">
          <View
            className="flex-1 py-2.5 rounded-full bg-gray-100 text-center"
            onClick={onClose}
          >
            <Text className="text-sm text-gray-600">取消</Text>
          </View>
          <View
            className={`flex-1 py-2.5 rounded-full text-center ${
              submitting ? 'bg-gray-300' : 'bg-indigo-500'
            }`}
            onClick={submitting ? undefined : verifyCode}
          >
            <Text className="text-sm text-white">{submitting ? '验证中...' : '确定'}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
