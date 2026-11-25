// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 设备与派单(小程序壳) —— 屏体在 packages/app/src/features/devices/DevicesScreen.tsx,
 * 与 RN 用同一份实现,这里只注入平台差异:主题档、返回、轻提示、确认框。
 *
 * 为什么要有这一页:手机派单原来只有 RN(要装 App)和 Web(要开浏览器)两个入口,
 * 而用户真正随手能打开的是微信里的小程序。缺了这一页,"手机上派单"这条链路
 * 对多数人等于不存在。
 */

import { View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useMemo } from 'react'
import { DevicesScreen } from '@ihui/rn-app/features/devices/DevicesScreen'
import ThemeRoot from '@/components/ThemeRoot'
import { useI18n } from '@/i18n'
import { useAppTheme } from '@/lib/theme'
import { getTopBarMetrics } from '@/utils/system-info'

export default function DevicesPage() {
  const { t, locale } = useI18n()
  const { resolved } = useAppTheme()
  // 自定义导航栏下页头要自己让开状态栏:读一次系统信息,失败回 0(不让页面炸)
  const insetTop = useMemo(() => {
    try {
      return getTopBarMetrics().statusBarHeight
    } catch {
      return 0
    }
  }, [])

  // 轻提示:一句话结论。长文案用 icon:'none' 才不会被 7 字截断
  const onToast = useCallback((message: string) => {
    void Taro.showToast({ title: message, icon: 'none', duration: 3000 })
  }, [])

  // 撤销设备这类不可逆动作必须先问:showModal 返回 confirm 才继续
  const onConfirm = useCallback(
    (title: string, message: string, confirmText: string): Promise<boolean> =>
      Taro.showModal({
        title,
        content: message,
        confirmText,
        cancelText: t('common.cancel'),
        confirmColor: '#d93025',
      })
        .then((res) => Boolean(res.confirm))
        .catch(() => false),
    [t],
  )

  return (
    <ThemeRoot>
      <View>
        <DevicesScreen
          t={t}
          locale={locale}
          colorScheme={resolved}
          headerInsetTop={insetTop}
          onBack={() => void Taro.navigateBack()}
          onToast={onToast}
          onConfirm={onConfirm}
        />
      </View>
    </ThemeRoot>
  )
}
