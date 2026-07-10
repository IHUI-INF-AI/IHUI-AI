import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'

const menus = [
  { label: '账号绑定', path: '/pages/user/phone' },
  { label: '修改密码', path: '/pages/user/password' },
  { label: '实名认证', path: '/pages/user/realname' },
  { label: '邮箱绑定', path: '/pages/user/email' },
  { label: '意见反馈', path: '/pages/user/feedback' },
  { label: '关于我们', path: '/pages/about/index' },
  { label: '清除缓存', path: '/pages/setting/cache' },
]

export default function Settings() {
  function navigate(url: string) {
    Taro.navigateTo({ url })
  }

  function handleLogout() {
    Taro.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          Taro.clearStorageSync()
          Taro.showToast({ title: '已退出登录', icon: 'success' })
          setTimeout(() => {
            Taro.reLaunch({ url: '/pages/login/login' })
          }, 1000)
        }
      },
    })
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="mx-[12px] mt-[12px] bg-white rounded-[8px] overflow-hidden">
        {menus.map((item, idx) => (
          <View
            key={item.path}
            className={`flex justify-between items-center px-[16px] py-[16px] ${
              idx < menus.length - 1 ? 'border-b-[1px] border-solid border-[#f5f5f5]' : ''
            }`}
            onClick={() => navigate(item.path)}
          >
            <Text className="text-[14px] text-[#333]">{item.label}</Text>
            <Text className="text-[16px] text-[#ccc]">›</Text>
          </View>
        ))}
      </View>
      <View
        className="mx-[12px] mt-[30px] h-[48px] leading-[48px] text-center bg-white rounded-[24px] text-[#dd524d] text-[15px]"
        onClick={handleLogout}
      >
        <Text>退出登录</Text>
      </View>
    </View>
  )
}
