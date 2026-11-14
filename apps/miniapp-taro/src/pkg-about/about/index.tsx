// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/about/AboutScreen.tsx
//
// 薄壳(2026-11-14 收敛):整页视图委托共享屏 `AboutScreen`,本端只保留三件平台职责:
//   ① 取数 —— GET /about(版本号等);② 导航 —— 返回/注册/开发者门户/合规入口;
//   ③ 轻提示 —— 取数失败时的 onToast。
// 收敛前本页是 247 行手抄副本(段落顺序/文案虽与共享屏同源,样式与几何各写一份);
// 现在任何段落改动只改共享屏一处,三端同动。
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { getAbout } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'
import { navigateToWebView } from '@/pages/webview/index'
import { WEB_BASE_URL } from '@/constants/web-portal'
import { AboutScreen } from '@ihui/rn-app/features/about/AboutScreen'
import { ABOUT_MENUS } from './aboutSections'
import { onToast } from '@/host/on-toast'

interface AboutInfo {
  name: string
  version: string
  intro: string
  logo?: string
}

export default function AboutIndexPage() {
  const { t } = useI18n()
  const [info, setInfo] = useState<AboutInfo>({ name: '', version: '', intro: '' })

  const load = useCallback(async () => {
    try {
      setInfo(await getAbout())
    } catch (e) {
      logger.error('about/index', '获取关于信息', e)
      onToast(t('common.failed'), { kind: 'error' })
    }
  }, [t])

  /** 返回:页面栈空时回退到「我的」(与共享屏 onBack 契约一致) */
  const goBack = useCallback(() => {
    Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/user/index' }) })
  }, [])

  const goRegister = useCallback(() => {
    Taro.navigateTo({ url: '/pages/register/index' })
  }, [])

  const openDeveloper = useCallback(() => {
    navigateToWebView(`${WEB_BASE_URL}/developer`, t('about.ctaSecondary'))
  }, [t])

  /** 合规/帮助入口:共享屏按传入顺序渲染,本端把在册路由映射成回调 */
  const entries = useMemo(
    () =>
      ABOUT_MENUS.map((m) => ({
        id: m.key,
        label: t(m.labelKey),
        onPress: () => Taro.navigateTo({ url: m.url }),
      })),
    [t],
  )

  useDidShow(() => load())

  return (
    <ThemeRoot>
      <AboutScreen
        t={t}
        onBack={goBack}
        onNavigate={(url) => Taro.navigateTo({ url })}
        onToast={onToast}
        onRegister={goRegister}
        onOpenPortal={openDeveloper}
        entries={entries}
        appVersion={info.version || undefined}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
