import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { getProfile, updateUserNickname } from '@/api'

export default function Nickname() {
  const [nickname, setNickname] = useState('')

  useDidShow(async () => {
    try { setNickname((await getProfile()).nickname || '') } catch (e) {}
  })

  async function onSave() {
    if (!nickname) return
    try {
      await updateUserNickname(nickname)
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {}
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="mx-[12px] px-[16px] py-[16px] bg-white rounded-[8px]">
        <Text className="text-[13px] text-[#999]">新昵称</Text>
        <Input
          className="w-full mt-[8px] py-[8px] text-[15px] border-b-[1px] border-solid border-[#f5f5f5]"
          placeholder="请输入新昵称"
          maxlength={20}
          value={nickname}
          onInput={e => setNickname(e.detail.value)}
        />
      </View>
      <Button
        className={`mx-[16px] mt-[30px] rounded-[20px] text-[16px] ${
          nickname ? 'bg-[#007aff] text-white' : 'bg-[#ccc] text-white'
        }`}
        disabled={!nickname}
        onClick={onSave}
      >
        保存
      </Button>
    </View>
  )
}
