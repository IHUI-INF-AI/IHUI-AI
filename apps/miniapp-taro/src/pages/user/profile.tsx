import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getProfile, type UserInfo } from '@/api'

export default function Profile() {
  const [form, setForm] = useState<Partial<UserInfo>>({})

  const load = useCallback(async () => {
    try {
      setForm(await getProfile())
    } catch (e) {
      console.error('[user/profile] 获取用户信息 failed:', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }, [])

  function navigate(url: string) {
    Taro.navigateTo({ url })
  }

  useDidShow(() => {
    load()
  })

  const rows = [
    { label: '头像', path: '/pages/user/avatar', value: null, isAvatar: true },
    {
      label: '昵称',
      path: '/pages/user/nickname',
      value: form.nickname || '未设置',
      isAvatar: false,
    },
    { label: '手机号', path: '/pages/user/phone', value: form.phone || '未绑定', isAvatar: false },
    { label: '邮箱', path: '/pages/user/email', value: form.email || '未绑定', isAvatar: false },
    { label: '修改密码', path: '/pages/user/password', value: null, isAvatar: false },
    {
      label: '实名认证',
      path: '/pages/user/realname',
      value: form.realName ? '已认证' : '未认证',
      isAvatar: false,
    },
  ]

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="mx-[12px] bg-white rounded-[8px] overflow-hidden">
        {rows.map((row, idx) => (
          <View
            key={row.path}
            className={`flex justify-between items-center px-[16px] py-[16px] ${
              idx < rows.length - 1 ? 'border-b-[1px] border-solid border-[#f5f5f5]' : ''
            }`}
            onClick={() => navigate(row.path)}
          >
            <Text className="text-[14px] text-[#333]">{row.label}</Text>
            <View className="flex items-center text-[13px] text-[#999]">
              {row.isAvatar ? (
                <Image
                  className="w-[40px] h-[40px] rounded-full bg-[#f5f5f5]"
                  src={form.avatar || '/static/default-avatar.png'}
                  mode="aspectFill"
                />
              ) : (
                <Text>{row.value}</Text>
              )}
              <Text className="text-[#ccc] ml-[8px]">›</Text>
            </View>
          </View>
        ))}
      </View>
      <View className="mx-[12px] bg-white rounded-[8px] overflow-hidden">
        <View
          className="flex justify-between items-center px-[16px] py-[16px]"
          onClick={() => navigate('/pages/user/feedback')}
        >
          <Text className="text-[14px] text-[#333]">意见反馈</Text>
          <View className="flex items-center text-[#ccc]">
            <Text>›</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
