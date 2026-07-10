import { View, Text, Input, Image, Switch } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getUserInfo, setUserInfo, type UserInfo } from '@/utils/auth'
import { updateProfile } from '@/api'

const defaultAvatar = 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/home.png'

export default function Settings() {
  const [userInfo, setUserInfoState] = useState<UserInfo | null>(null)
  const [nickname, setNickname] = useState('')
  const [notificationOn, setNotificationOn] = useState(true)
  const [cacheSize, setCacheSize] = useState('0KB')

  const refresh = useCallback(() => {
    const info = getUserInfo()
    setUserInfoState(info)
    setNickname(info?.userName || info?.nickname || '')
  }, [])

  const maskPhone = useCallback((phone: string) => {
    if (!phone) return '未绑定'
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
  }, [])

  function changeAvatar() {
    Taro.chooseImage({
      count: 1,
      success: (res) => {
        if (userInfo) {
          setUserInfoState({ ...userInfo, avatar: res.tempFilePaths[0] })
        }
      },
    })
  }

  function toggleNotification() {
    const next = !notificationOn
    setNotificationOn(next)
    Taro.showToast({ title: next ? '已开启通知' : '已关闭通知', icon: 'none' })
  }

  function handleClearCache() {
    Taro.showModal({
      title: '提示',
      content: '确定清除缓存吗？',
      success: (res) => {
        if (res.confirm) {
          Taro.clearStorageSync()
          setCacheSize('0KB')
          Taro.showToast({ title: '缓存已清除', icon: 'success' })
        }
      },
    })
  }

  function showAgreement() {
    Taro.showToast({ title: '协议页待迁移', icon: 'none' })
  }

  function showPrivacy() {
    Taro.showToast({ title: '隐私政策页待迁移', icon: 'none' })
  }

  async function handleSave() {
    try {
      const updated = await updateProfile({ userName: nickname })
      setUserInfo({ ...userInfo, ...updated } as UserInfo)
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 600)
    } catch (e) {
      // 统一提示
    }
  }

  useDidShow(() => { refresh() })

  return (
    <View className="min-h-screen px-[16px] py-[12px]">
      {/* 账号信息 */}
      <View className="mb-[16px] bg-white rounded-[8px] overflow-hidden">
        <Text className="block px-[12px] py-[12px] text-[13px] text-[#999]">账号信息</Text>
        <View className="flex items-center px-[12px] py-[14px] border-b-[1px] border-solid border-[#f5f5f5]">
          <Text className="flex-1 text-[15px] text-[#333]">头像</Text>
          <Image
            className="w-[40px] h-[40px] rounded-full"
            src={userInfo?.avatar || defaultAvatar}
            mode="aspectFill"
            onClick={changeAvatar}
          />
        </View>
        <View className="flex items-center px-[12px] py-[14px] border-b-[1px] border-solid border-[#f5f5f5]">
          <Text className="flex-1 text-[15px] text-[#333]">昵称</Text>
          <Input
            className="text-right text-[14px] text-[#333]"
            placeholder="请输入昵称"
            value={nickname}
            onInput={e => setNickname(e.detail.value)}
          />
        </View>
        <View className="flex items-center px-[12px] py-[14px]">
          <Text className="flex-1 text-[15px] text-[#333]">手机号</Text>
          <Text className="text-[14px] text-[#999]">{maskPhone(userInfo?.phone || '')}</Text>
        </View>
      </View>

      {/* 通用设置 */}
      <View className="mb-[16px] bg-white rounded-[8px] overflow-hidden">
        <Text className="block px-[12px] py-[12px] text-[13px] text-[#999]">通用</Text>
        <View
          className="flex items-center px-[12px] py-[14px] border-b-[1px] border-solid border-[#f5f5f5]"
          onClick={toggleNotification}
        >
          <Text className="flex-1 text-[15px] text-[#333]">消息通知</Text>
          <Switch checked={notificationOn} color="#007aff" onChange={toggleNotification} />
        </View>
        <View className="flex items-center px-[12px] py-[14px]" onClick={handleClearCache}>
          <Text className="flex-1 text-[15px] text-[#333]">清除缓存</Text>
          <Text className="text-[14px] text-[#999]">{cacheSize}</Text>
        </View>
      </View>

      {/* 关于 */}
      <View className="mb-[16px] bg-white rounded-[8px] overflow-hidden">
        <Text className="block px-[12px] py-[12px] text-[13px] text-[#999]">关于</Text>
        <View className="flex items-center px-[12px] py-[14px] border-b-[1px] border-solid border-[#f5f5f5]">
          <Text className="flex-1 text-[15px] text-[#333]">当前版本</Text>
          <Text className="text-[14px] text-[#999]">v1.0.0</Text>
        </View>
        <View
          className="flex items-center px-[12px] py-[14px] border-b-[1px] border-solid border-[#f5f5f5]"
          onClick={showAgreement}
        >
          <Text className="flex-1 text-[15px] text-[#333]">用户协议</Text>
          <Text className="text-[13px] text-[#ccc]">{'>'}</Text>
        </View>
        <View className="flex items-center px-[12px] py-[14px]" onClick={showPrivacy}>
          <Text className="flex-1 text-[15px] text-[#333]">隐私政策</Text>
          <Text className="text-[13px] text-[#ccc]">{'>'}</Text>
        </View>
      </View>

      <View
        className="h-[48px] mt-[24px] leading-[48px] text-center bg-[#007aff] text-white rounded-[24px] text-[16px]"
        onClick={handleSave}
      >
        <Text>保存</Text>
      </View>
    </View>
  )
}
