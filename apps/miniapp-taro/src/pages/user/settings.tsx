import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useI18n } from '../../i18n'

export default function Settings() {
  const { t } = useI18n()

  const menus = [
    { label: t('setting.accountBinding'), path: '/pages/user/phone' },
    { label: t('setting.changePassword'), path: '/pages/user/password' },
    { label: t('setting.realNameAuth'), path: '/pages/user/realname' },
    { label: t('setting.emailBinding'), path: '/pages/user/email' },
    { label: t('setting.feedback'), path: '/pages/user/feedback' },
    { label: t('setting.language'), path: '/pages/setting/language' },
    { label: t('setting.aboutUs'), path: '/pages/about/index' },
    { label: t('setting.clearCache'), path: '/pages/setting/cache' },
  ]

  function navigate(url: string) {
    Taro.navigateTo({ url })
  }

  function handleLogout() {
    Taro.showModal({
      title: t('common.hint'),
      content: t('setting.logoutConfirm'),
      success: (res) => {
        if (res.confirm) {
          Taro.clearStorageSync()
          Taro.showToast({ title: t('user.loggedOut'), icon: 'success' })
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
        <Text>{t('user.logout')}</Text>
      </View>
    </View>
  )
}
