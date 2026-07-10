import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { realNameAuth, getProfile } from '@/api'

export default function Realname() {
  const [realName, setRealName] = useState('')
  const [idCard, setIdCard] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [authName, setAuthName] = useState('')

  const load = useCallback(async () => {
    try {
      const profile = await getProfile()
      if (profile.realName) {
        setAuthenticated(true)
        setAuthName(profile.realName)
      }
    } catch (e) {}
  }, [])

  useDidShow(() => { load() })

  async function onSubmit() {
    if (!realName.trim()) {
      return Taro.showToast({ title: '请输入真实姓名', icon: 'none' })
    }
    if (idCard.length !== 18) {
      return Taro.showToast({ title: '身份证号需18位', icon: 'none' })
    }
    try {
      await realNameAuth({ realName: realName.trim(), idCard })
      Taro.showToast({ title: '认证成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {}
  }

  if (authenticated) {
    return (
      <View className="min-h-screen bg-[#f7f8fa]">
        <View className="mx-[12px] mt-[30px] py-[40px] bg-white rounded-[8px] flex flex-col items-center">
          <Text className="text-[48px]">✓</Text>
          <Text className="mt-[12px] text-[16px] text-[#333]">已完成实名认证</Text>
          <Text className="mt-[8px] text-[13px] text-[#999]">{authName}</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="mx-[12px] mt-[12px] px-[16px] bg-white rounded-[8px]">
        <View className="flex items-center py-[16px] border-b-[1px] border-solid border-[#f5f5f5]">
          <Text className="w-[80px] text-[14px] text-[#333]">真实姓名</Text>
          <Input
            className="flex-1 text-[14px]"
            type="text"
            placeholder="请输入真实姓名"
            value={realName}
            onInput={e => setRealName(e.detail.value)}
          />
        </View>
        <View className="flex items-center py-[16px]">
          <Text className="w-[80px] text-[14px] text-[#333]">身份证号</Text>
          <Input
            className="flex-1 text-[14px]"
            type="idcard"
            maxlength={18}
            placeholder="请输入身份证号"
            value={idCard}
            onInput={e => setIdCard(e.detail.value)}
          />
        </View>
      </View>
      <Button
        className={`mx-[16px] mt-[30px] rounded-[20px] text-[16px] ${
          realName.trim() && idCard ? 'bg-[#007aff] text-white' : 'bg-[#ccc] text-white'
        }`}
        disabled={!realName.trim() || !idCard}
        onClick={onSubmit}
      >
        提交认证
      </Button>
    </View>
  )
}
