// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「关于我们」—— 本页是**跨端复用腿的验收件**,不是又一份手写镜像。
 *
 * 渲染真相源 = `packages/app/src/features/about/AboutScreen.tsx`(RN 与小程序同一份文件,
 * 经 src/rn-compat 兼容层在小程序落地)。端内不写任何布局与样式:源头改一笔,两端同动。
 * 这正是 AGENTS §4「一份平台无关组件源 + 平台 adapter,禁止两端各写一份靠对账追平」的落地形态。
 *
 * 平台侧只注入三件本端事实:取词(`t`)、主题档(`colorScheme`)、导航出口(`onBack` / `onOpenPortal`)。
 */
import { useI18n } from '@/i18n'
import ThemeRoot from '@/components/ThemeRoot'
import { WEB_BASE_URL } from '@/constants/web-portal'
import { ABOUT_ENTRY_IDS } from '@ihui/shared/constants'
import { AboutScreen as SharedAboutScreen } from '@ihui/rn-app/features/about/AboutScreen'
import type { OnNavigate } from '@ihui/types'
import Taro from '@tarojs/taro'
import { useCallback } from 'react'

import { onToast } from '@/host/on-toast'
import { useTheme } from '@/rn-compat/theme'

/**
 * B1 契约冻结:共享屏本轮只 assert 端口、尚未调用导航。
 * 真实"逻辑路由名 → 小程序页"映射在 B2 接 `rn-compat/navigation-state` 时补上;
 * 在此之前任何落空都走可见失败,不静默吞。
 */
const onNavigate: OnNavigate = (target) => {
  onToast(`导航未接入: ${target}`, { kind: 'error' })
}

export default function AboutSharedScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const onOpenPortal = useCallback(() => {
    void Taro.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(WEB_BASE_URL)}` })
  }, [])

  return (
    <ThemeRoot>
      <SharedAboutScreen
        t={t}
        colorScheme={resolvedTheme}
        onBack={() => Taro.navigateBack()}
        onOpenPortal={onOpenPortal}
        onNavigate={onNavigate}
        onToast={onToast}
        entries={ABOUT_ENTRY_IDS.map((id: string) => ({
          id,
          label: t(`about.${id}`),
          onPress: onOpenPortal,
        }))}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
