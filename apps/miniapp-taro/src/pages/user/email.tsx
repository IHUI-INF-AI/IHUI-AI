import { logger } from '@/utils/logger'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useRef } from 'react'
import { getProfile, bindEmail } from '@/api'
import { useI18n } from '@/i18n'

export default function Email() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [counting, setCounting] = useState(false)
  const [count, setCount] = useState(60)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useDidShow(async () => {
    try {
      setEmail((await getProfile()).email || '')
    } catch (e) {
      logger.error('user/email', '获取用户信息', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  })

  function sendCode() {
    if (counting) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Taro.showToast({ title: t('user.email.emailInvalid'), icon: 'none' })
    }
    // 复用短信发送逻辑（实际应调用邮箱验证码接口）
    setCounting(true)
    timerRef.current = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          setCounting(false)
          return 60
        }
        return prev - 1
      })
    }, 1000)
  }

  async function onSubmit() {
    try {
      await bindEmail(email, code)
      Taro.showToast({ title: t('user.email.bindSuccess'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {
      logger.error('user/email', '绑定邮箱', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }

  return (
    <View className="min-h-screen bg-background">
      <View className="mx-[12px] px-[16px] bg-card rounded-[8px]">
        <View className="flex items-center py-[16px] border-b-[1px] border-solid border-border">
          <Text className="w-[70px] text-[14px] text-foreground">{t('user.email.email')}</Text>
          <Input
            className="flex-1 text-[14px]"
            type="text"
            placeholder={t('user.email.emailPlaceholder')}
            value={email}
            onInput={(e) => setEmail(e.detail.value)}
          />
        </View>
        <View className="flex items-center py-[16px]">
          <Text className="w-[70px] text-[14px] text-foreground">{t('user.email.code')}</Text>
          <View className="flex-1 flex items-center">
            <Input
              className="flex-1 text-[14px]"
              type="number"
              placeholder={t('user.email.codePlaceholder')}
              maxlength={6}
              value={code}
              onInput={(e) => setCode(e.detail.value)}
            />
            <Text
              className={`text-[12px] whitespace-nowrap ${counting ? 'text-muted-foreground' : 'text-primary'}`}
              onClick={sendCode}
            >
              {counting ? `${count}s` : t('user.email.getCode')}
            </Text>
          </View>
        </View>
      </View>
      <Button
        className={`mx-[16px] mt-[30px] rounded-[20px] text-[16px] ${
          email && code ? 'bg-primary text-white' : 'bg-muted text-white'
        }`}
        disabled={!email || !code}
        onClick={onSubmit}
      >
        {t('user.email.bind')}
      </Button>
    </View>
  )
}
