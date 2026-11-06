// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 镜像 packages/app/src/features/about/AboutScreen.tsx
import { useI18n } from '@/i18n'
import Taro from '@tarojs/taro'
import { useCallback } from 'react'
import ThemeRoot from '@/components/ThemeRoot'
import { onToast } from '@/host/on-toast'
import { useTheme } from '@/rn-compat/theme'
import { navigateToWebView } from '@/pages/webview/index'
import { WEB_BASE_URL } from '@/constants/web-portal'
import { AboutScreen as SharedAboutScreen } from '@ihui/rn-app/features/about/AboutScreen'
import type { OnNavigate } from '@ihui/types'
import { ABOUT_MENUS } from './aboutSections'

/**
 * 「关于我们」跨端共享屏承载页 —— 端内不写布局与样式,渲染真相源 =
 * `packages/app/src/features/about/AboutScreen.tsx`(RN 与小程序同一份,经
 * `src/rn-compat` 兼容层在小程序落地)。本页只注入本端事实:取词 `t`、主题档
 * `colorScheme`、导航出口 `onBack` / `onNavigate` / `onOpenPortal` / `entries`
 * (合规/帮助入口 → 本端在册路由)、轻提示 `onToast`。
 *
 * 段落与取词顺序由共享屏决定(Hero → 故事 → 价值观 → 平台能力 → 数字见证 →
 * CTA → 合规/帮助入口);本端只保留 shared 屏不承载的真实出口(注册页、开发者门户、
 * 合规/帮助在册路由)。原手写页的「版本号」展示属 shared 屏未渲染的字段,按
 * 承载形制收敛为共享屏真相源,不在本层另补。
 */
const onNavigate: OnNavigate = (target) => {
  // B1 契约冻结:共享屏本轮只 assert 端口、尚未调用导航;落空走可见失败,不静默吞。
  onToast(`导航未接入: ${target}`, { kind: 'error' })
}

export default function AboutIndexPage() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()

  const onBack = useCallback(() => {
    Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/user/index' }) })
  }, [])

  const onRegister = useCallback(() => {
    void Taro.navigateTo({ url: '/pages/register/index' })
  }, [])

  const onOpenPortal = useCallback(() => {
    navigateToWebView(`${WEB_BASE_URL}/developer`, t('about.ctaSecondary'))
  }, [t])

  return (
    <ThemeRoot>
      <SharedAboutScreen
        t={t}
        colorScheme={resolvedTheme}
        onBack={onBack}
        onNavigate={onNavigate}
        onToast={onToast}
        onRegister={onRegister}
        onOpenPortal={onOpenPortal}
        entries={ABOUT_MENUS.map((m) => ({
          id: m.key,
          label: t(m.labelKey),
          onPress: () => {
            void Taro.navigateTo({ url: m.url })
          },
        }))}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
