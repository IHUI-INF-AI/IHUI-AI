import { View, Text, Button, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { getProfile, updateUserAvatar } from '@/api'

export default function Avatar() {
  const [avatar, setAvatar] = useState('')

  useDidShow(async () => {
    try {
      setAvatar((await getProfile()).avatar || '')
    } catch (e) {
      console.error('[user/avatar] 获取用户信息 failed:', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  })

  function chooseImg() {
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      success: async (res) => {
        const path = res.tempFilePaths[0]!
        try {
          setAvatar(path)
          await updateUserAvatar(path)
          Taro.showToast({ title: '更新成功', icon: 'success' })
        } catch (e) {
          console.error('[user/avatar] 更新头像 failed:', e)
          Taro.showToast({ title: '操作失败', icon: 'none' })
        }
      },
    })
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa] px-[16px] pt-[30px]">
      <View
        className="w-[100px] h-[100px] mx-auto rounded-full overflow-hidden"
        style={{ boxShadow: '0 2px 10px rgba(0,0,0,.1)' }}
      >
        <Image
          className="w-full h-full"
          src={avatar || '/static/default-avatar.png'}
          mode="aspectFill"
        />
      </View>
      <Button
        className="mt-[30px] mb-[16px] bg-[#07c160] text-white rounded-[20px] text-[15px]"
        onClick={chooseImg}
      >
        选择头像
      </Button>
      <View className="text-center">
        <Text className="block text-[11px] text-[#999] leading-[1.8]">支持 JPG、PNG 格式</Text>
        <Text className="block text-[11px] text-[#999] leading-[1.8]">建议尺寸 200×200</Text>
      </View>
    </View>
  )
}
