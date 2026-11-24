// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { UpdateNoticeCard } from './UpdateNoticeCard'

/** Service Worker 侧"新版本已就绪"事件名(PwaUpdateWatcher 派发,此处消费)。 */
export const PWA_UPDATE_AVAILABLE_EVENT = 'pwa-update-available'

interface PWAUpdatePromptProps {
  onUpdate?: () => void
  className?: string
}

/**
 * PWA 更新提示(2026-09 立,2026-10-27 补齐链路)。
 *
 * 链路:新 SW 装上且页面仍由旧 SW 控制 ⇒ PwaUpdateWatcher 派发 PWA_UPDATE_AVAILABLE_EVENT
 * ⇒ 本组件弹卡片 ⇒ 点「更新」执行 onUpdate(默认整页 reload,新 SW 已 skipWaiting 接管)。
 *
 * 2026-10-27 修的两处:
 *   ① 此前**全仓无人派发**该事件 ⇒ 卡片结构上永远不出现(挂载着却不可达);
 *   ② 文案此前硬编码中文 ⇒ 5 语言站上只有中文提示。现走 packages/i18n 的 appUpdate 命名空间,
 *      与 RN 端 components/UpdatePrompt.tsx 共用同一份文案与同一套键名。
 *
 * 2026-11-13 收口(多端统一):定位从「桌面右下角 / 移动顶栏下方」统一为**顶部居中挂住横幅**,
 * 并补滑入/滑出动画(animate-update-banner-in/out,语义与 RN 端 Animated translateY -320→0 对称),
 * 使 web 与 RN 两端更新提示外观语言一致:同一处顶部、下滑入场、上滑退场。视觉版式仍复用
 * UpdateNoticeCard(两端同构),文案仍走 packages/i18n 的 appUpdate 单一真相源。
 */
export function PWAUpdatePrompt({ onUpdate, className }: PWAUpdatePromptProps) {
  const t = useTranslations('appUpdate')
  const [visible, setVisible] = React.useState(false)
  // 退场锁:关闭后先播上滑动画(onAnimationEnd 收尾卸载),否则卡片瞬间消失,看不到"滑回去"。
  // 与 RN 端 components/UpdatePrompt.tsx 的 render 挂载保持对称 —— 两端都是顶部横幅 + 滑入/滑出。
  const [leaving, setLeaving] = React.useState(false)

  React.useEffect(() => {
    const handler = () => setVisible(true)
    window.addEventListener(PWA_UPDATE_AVAILABLE_EVENT, handler)
    return () => window.removeEventListener(PWA_UPDATE_AVAILABLE_EVENT, handler)
  }, [])

  // 点更新直接交给调用方(web 侧通常是整页 reload 应用新 SW),无需先播退场动画
  const handleUpdate = () => {
    onUpdate?.()
  }
  const handleClose = () => setLeaving(true)
  const handleAnimationEnd = () => {
    if (leaving) {
      setVisible(false)
      setLeaving(false)
    }
  }

  if (!visible) return null

  return (
    <div
      className={leaving ? 'animate-update-banner-out' : 'animate-update-banner-in'}
      onAnimationEnd={handleAnimationEnd}
    >
      <UpdateNoticeCard
        title={t('title')}
        body={t('body')}
        actionLabel={t('action')}
        closeLabel={t('close')}
        onAction={handleUpdate}
        onClose={handleClose}
        className={className}
      />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
