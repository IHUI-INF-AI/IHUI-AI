import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useMemo } from 'react'
import { getProfile, realNameAuth } from '@/api'

export default function Realname() {
  const [form, setForm] = useState<{ realName: string; idCard: string }>({ realName: '', idCard: '' })
  const [verified, setVerified] = useState(false)

  const maskedId = useMemo(() => {
    if (!form.idCard) return ''
    return form.idCard.slice(0, 4) + '**********' + form.idCard.slice(-4)
  }, [form.idCard])

  useDidShow(async () => {
    try {
      const p = await getProfile() as any
      if (p.realName) {
        setForm({ realName: p.realName, idCard: p.idCard || '' })
        setVerified(true)
      }
    } catch (e) {}
  })

  async function onSubmit() {
    if (!/^[\u4e00-\u9fa5]{2,10}$/.test(form.realName)) {
      return Taro.showToast({ title: '姓名格式错误', icon: 'none' })
    }
    if (!/^\d{17}[\dXx]$/.test(form.idCard)) {
      return Taro.showToast({ title: '身份证号格式错误', icon: 'none' })
    }
    try {
      await realNameAuth(form)
      Taro.showToast({ title: '认证成功', icon: 'success' })
      setVerified(true)
    } catch (e) {}
  }

  if (verified) {
    return (
      <View className="min-h-screen bg-[#f7f8fa]">
        <View className="pt-[60px] pb-[60px] text-center bg-white">
          <View
            className="w-[70px] h-[70px] leading-[70px] mx-auto rounded-full bg-[#4caf50] text-white text-[35px]"
          >
            ✓
          </View>
          <Text className="block text-[16px] text-[#333] mt-[16px]">已实名认证</Text>
          <Text className="block text-[14px] text-[#666] mt-[8px]">{form.realName}</Text>
          <Text className="block text-[13px] text-[#999] mt-[4px]">{maskedId}</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="mx-[12px] px-[16px] bg-white rounded-[8px]">
        <View className="flex items-center py-[16px] border-b-[1px] border-solid border-[#f5f5f5]">
          <Text className="w-[80px] text-[14px] text-[#333]">真实姓名</Text>
          <Input
            className="flex-1 text-[14px]"
            placeholder="请输入真实姓名"
            value={form.realName}
            onInput={e => setForm(prev => ({ ...prev, realName: e.detail.value }))}
          />
        </View>
        <View className="flex items-center py-[16px]">
          <Text className="w-[80px] text-[14px] text-[#333]">身份证号</Text>
          <Input
            className="flex-1 text-[14px]"
            placeholder="请输入身份证号"
            maxlength={18}
            value={form.idCard}
            onInput={e => setForm(prev => ({ ...prev, idCard: e.detail.value }))}
          />
        </View>
      </View>
      <View className="px-[16px] py-[12px]">
        <Text className="block text-[11px] text-[#999] leading-[1.8]">实名信息一经认证不可修改</Text>
        <Text className="block text-[11px] text-[#999] leading-[1.8]">请确保信息与身份证一致</Text>
      </View>
      <Button
        className={`mx-[16px] mt-[30px] rounded-[20px] text-[16px] ${
          form.realName && form.idCard ? 'bg-[#007aff] text-white' : 'bg-[#ccc] text-white'
        }`}
        disabled={!form.realName || !form.idCard}
        onClick={onSubmit}
      >
        立即认证
      </Button>
    </View>
  )
}
