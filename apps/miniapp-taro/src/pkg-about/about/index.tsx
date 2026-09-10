// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { getAbout } from '@/api'
import LineIcon from '@/components/LineIcon'
import ThemeRoot from '@/components/ThemeRoot'

interface AboutInfo {
  name: string
  version: string
  intro: string
  logo?: string
}

interface MenuItem {
  key: string
  label: string
  url: string
}

export default function AboutIndexPage() {
  const { t } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )
  const [info, setInfo] = useState<AboutInfo>({ name: '', version: '', intro: '' })

  const load = useCallback(async () => {
    try {
      setInfo(await getAbout())
    } catch (e) {
      logger.error('about/index', '获取关于信息', e)
      Taro.showToast({ title: tt('common.failed', '加载失败'), icon: 'none' })
    }
  }, [tt])

  const navigate = useCallback((url: string) => {
    Taro.navigateTo({ url })
  }, [])

  // 返回(对齐 RN AboutScreen header ChevronLeft onPress goBack;页面栈为空时回退到「我的」)
  const goBack = useCallback(() => {
    Taro.navigateBack({
      fail: () => Taro.switchTab({ url: '/pages/user/index' }),
    })
  }, [])

  const menus = useMemo<MenuItem[]>(
    () => [
      {
        key: 'protocol',
        label: tt('about.protocol.title', '用户协议'),
        url: '/pkg-about/about/protocol',
      },
      {
        key: 'privacy',
        label: tt('about.privacy.mainTitle', '隐私政策'),
        url: '/pkg-about/about/privacy',
      },
      {
        key: 'businessLicense',
        label: tt('about.businessLicense.title', '营业执照'),
        url: '/pkg-about/about/business-license/index',
      },
      {
        key: 'icpRecord',
        label: tt('about.icpRecord.title', 'ICP备案'),
        url: '/pkg-about/about/icp-record/index',
      },
      {
        key: 'modelRecord',
        label: tt('about.modelRecord.title', '模型备案'),
        url: '/pkg-about/about/model-record/index',
      },
      {
        key: 'usageRules',
        label: tt('about.usageRules.title', '使用规则'),
        url: '/pkg-about/about/usage-rules/index',
      },
      {
        key: 'apiSettings',
        label: tt('about.apiSettings.title', 'API 设置'),
        url: '/pkg-about/about/api-settings/index',
      },
      {
        key: 'appPermission',
        label: tt('about.appPermission.title', '应用权限'),
        url: '/pkg-about/about/app-permission/index',
      },
      { key: 'help', label: tt('about.help.title', '帮助中心'), url: '/pkg-about/about/help' },
      { key: 'contact', label: tt('about.contact.title', '联系我们'), url: '/pkg-about/about/contact' },
    ],
    [tt],
  )

  useDidShow(() => load())

  return (
    <ThemeRoot>
      {/* 对齐 RN AboutScreen container:bg surface.bg;custom 导航补状态栏 safe-area */}
      <View className="min-h-screen bg-background pt-[calc(env(safe-area-inset-top)+8rpx)]">
        {/* 顶部导航(对齐 RN AboutScreen header:ChevronLeft 40rpx/foreground + 标题 40rpx/700,gap 8 padding 20/24) */}
        <View className="flex items-center gap-[8rpx] px-[20rpx] py-[24rpx]">
          {/* hitSlop 8dp → p 16rpx + 负 margin 抵消,扩大点击区不改视觉间距 */}
          <View className="p-[16rpx] -m-[16rpx]" onClick={goBack} hoverClass="opacity-60">
            <LineIcon name="chevron-left" size={40} color="var(--color-foreground)" />
          </View>
          <Text className="text-[40rpx] font-bold text-foreground">关于我们</Text>
        </View>

        {info.name ? (
          <View className="pt-[80rpx] pb-[60rpx] text-center bg-card">
            <Image
              className="w-[160rpx] h-[160rpx]"
              src={info.logo || '/static/logo.png'}
              mode="aspectFit"
            />
            <Text className="block text-[32rpx] text-foreground font-semibold mt-[24rpx]">
              {info.name}
            </Text>
            <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx]">
              {t('about.version', { version: info.version })}
            </Text>
          </View>
        ) : null}

        <View className="m-[24rpx] p-[32rpx] bg-card rounded-[16rpx]">
          <Text className="text-[26rpx] text-muted-foreground leading-[1.8]">
            {info.intro || tt('about.introFallback', '智汇 AI 致力于打造一站式 AI 服务平台')}
          </Text>
        </View>

        {/* 合规条目卡(对齐 RN sectionCard:白卡圆角 16rpx,条目分隔线 1rpx border.light) */}
        <View className="m-[24rpx] bg-card rounded-[16rpx] overflow-hidden">
          {menus.map((m, idx) => (
            <View
              key={m.key}
              className={`flex items-center justify-between py-[28rpx] px-[24rpx]${idx > 0 ? ' border-t border-border' : ''}`}
              onClick={() => navigate(m.url)}
              hoverClass="opacity-60"
            >
              <Text className="text-[30rpx] text-foreground flex-1">{m.label}</Text>
              {/* 对齐 RN ChevronRight:rpx(24)/text.tertiary/strokeWidth 2 */}
              <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
            </View>
          ))}
        </View>

        <View className="text-center pt-[40rpx] px-[24rpx] pb-[20rpx]">
          <Text className="text-[22rpx] text-muted-foreground">
            {tt('about.copyright', '© 2026 智汇 AI. 保留所有权利')}
          </Text>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
