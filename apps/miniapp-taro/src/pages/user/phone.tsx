import { logger } from '@/utils/logger'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useRef } from 'react'
import { getProfile, sendSmsCode, bindPhone } from '@/api'
import { useI18n } from '@/i18n'

export default function Phone() {
  const { t } = useI18n()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [counting, setCounting] = useState(false)
  const [count, setCount] = useState(60)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useDidShow(async () => {
    try {
      setPhone((await getProfile()).phone || '')
    } catch (e) {
      logger.error('user/phone', '获取用户信息', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  })

  function sendCode() {
    if (counting) return
    if (!/^1\d{10}$/.test(phone)) {
      return Taro.showToast({ title: t('user.phone.phoneInvalid'), icon: 'none' })
    }
    sendSmsCode(phone)
      .then(() => {
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
      })
      .catch((e) => {
        logger.error('unknown', '验证码发送', e)
        Taro.showToast({ title: t('user.phone.codeSendFailed'), icon: 'none' })
      })
  }

  async function onSubmit() {
    try {
      await bindPhone(phone, code)
      Taro.showToast({ title: t('user.phone.bindSuccess'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {
      logger.error('user/phone', '绑定手机号', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }

  return (
    <View className="min-h-screen bg-background">
      <View className="mx-[12px] px-[16px] bg-card rounded-[8px]">
        <View className="flex items-center py-[16px] border-b-[1px] border-solid border-border">
          <Text className="w-[70px] text-[14px] text-foreground">{t('user.phone.phone')}</Text>
          <Input
            className="flex-1 text-[14px]"
            type="number"
            placeholder={t('user.phone.phonePlaceholder')}
            maxlength={11}
            value={phone}
            onInput={(e) => setPhone(e.detail.value)}
          />
        </View>
        <View className="flex items-center py-[16px]">
          <Text className="w-[70px] text-[14px] text-foreground">{t('user.phone.code')}</Text>
          <View className="flex-1 flex items-center">
            <Input
              className="flex-1 text-[14px]"
              type="number"
              placeholder={t('user.phone.codePlaceholder')}
              maxlength={6}
              value={code}
              onInput={(e) => setCode(e.detail.value)}
            />
            <Text
              className={`text-[12px] whitespace-nowrap ${counting ? 'text-muted-foreground' : 'text-primary'}`}
              onClick={sendCode}
            >
              {counting ? `${count}s` : t('user.phone.getCode')}
            </Text>
          </View>
        </View>
      </View>
      <Button
        className={`mx-[16px] mt-[30px] rounded-[20px] text-[16px] ${
          phone && code ? 'bg-primary text-white' : 'bg-[#ccc] text-white'
        }`}
        disabled={!phone || !code}
        onClick={onSubmit}
      >
        {t('user.phone.bind')}
      </Button>
    </View>
  )
}
