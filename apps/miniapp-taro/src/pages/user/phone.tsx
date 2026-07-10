import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useRef } from 'react'
import { getProfile, sendSmsCode, bindPhone } from '@/api'

export default function Phone() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [counting, setCounting] = useState(false)
  const [count, setCount] = useState(60)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useDidShow(async () => {
    try { setPhone((await getProfile()).phone || '') } catch {}
  })

  function sendCode() {
    if (counting) return
    if (!/^1\d{10}$/.test(phone)) {
      return Taro.showToast({ title: '手机号格式错误', icon: 'none' })
    }
    sendSmsCode(phone).then(() => {
      setCounting(true)
      timerRef.current = setInterval(() => {
        setCount(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            setCounting(false)
            return 60
          }
          return prev - 1
        })
      }, 1000)
    }).catch(() => {})
  }

  async function onSubmit() {
    try {
      await bindPhone(phone, code)
      Taro.showToast({ title: '绑定成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch {}
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="mx-[12px] px-[16px] bg-white rounded-[8px]">
        <View className="flex items-center py-[16px] border-b-[1px] border-solid border-[#f5f5f5]">
          <Text className="w-[70px] text-[14px] text-[#333]">手机号</Text>
          <Input
            className="flex-1 text-[14px]"
            type="number"
            placeholder="请输入手机号"
            maxlength={11}
            value={phone}
            onInput={e => setPhone(e.detail.value)}
          />
        </View>
        <View className="flex items-center py-[16px]">
          <Text className="w-[70px] text-[14px] text-[#333]">验证码</Text>
          <View className="flex-1 flex items-center">
            <Input
              className="flex-1 text-[14px]"
              type="number"
              placeholder="请输入验证码"
              maxlength={6}
              value={code}
              onInput={e => setCode(e.detail.value)}
            />
            <Text
              className={`text-[12px] whitespace-nowrap ${counting ? 'text-[#ccc]' : 'text-[#007aff]'}`}
              onClick={sendCode}
            >
              {counting ? `${count}s` : '获取验证码'}
            </Text>
          </View>
        </View>
      </View>
      <Button
        className={`mx-[16px] mt-[30px] rounded-[20px] text-[16px] ${
          phone && code ? 'bg-[#007aff] text-white' : 'bg-[#ccc] text-white'
        }`}
        disabled={!phone || !code}
        onClick={onSubmit}
      >
        绑定
      </Button>
    </View>
  )
}
