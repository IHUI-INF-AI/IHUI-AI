// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Pin, PinOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { TOPBAR_BTN_BASE, TOPBAR_BTN_W9 } from '@/lib/nav-styles'
import { Tooltip } from '@/components/feedback'
import { useDesktop } from '@/hooks/use-desktop'

/**
 * TopBarPinButton — 桌面端「窗口置顶」开关（2026-11-18 立）
 *
 * 立因：用户实报「桌面端默认就在电脑上置顶，切其他程序根本看不到」。壳层已改成
 * 「默认不置顶 + 启动按真实句柄清掉 WS_EX_TOPMOST」，但置顶本身是合理诉求
 * （AI 对话悬浮场景），所以给用户一枚**显式**开关，而不是把能力整个删掉：
 * - 真值只认宿主偏好 `desktopPrefs.alwaysOnTop`（壳层落盘 desktop-behavior.json），
 *   前端不自建一份"我以为是置顶"的状态 —— 那是第二份真相；
 * - 点击走 `updateDesktopPrefs` → `set_desktop_prefs`，宿主保存后**立即应用到窗口**
 *   并把归一后的 effective 值回传，重启后按该值恢复；
 * - 宿主不支持这套偏好（旧安装包）或偏好还没读到值时**不渲染**，
 *   不给一枚点了没有任何效果的按钮。
 *
 * 平台独占：web 端（桌面壳）专属；浏览器里 isDesktop=false ⇒ null。
 */
export function TopBarPinButton() {
  const {
    isDesktop,
    desktopPrefs,
    desktopPrefsLoading,
    desktopPrefsSupported,
    updateDesktopPrefs,
  } = useDesktop()
  // 词条在 ide.topBar 下(与 GlobalTopBar 同一命名空间:它用 useTranslations('ide'))
  const t = useTranslations('ide')
  const [pending, setPending] = React.useState(false)

  if (!isDesktop || desktopPrefsLoading || !desktopPrefsSupported) return null

  const pinned = desktopPrefs.alwaysOnTop
  const label = pinned ? t('topBar.unpin') : t('topBar.pin')

  const handleClick = async (): Promise<void> => {
    if (pending) return
    setPending(true)
    try {
      await updateDesktopPrefs({ alwaysOnTop: !pinned })
    } catch (e) {
      // 宿主不可达时 updateDesktopPrefs 自己返回 null（不改本地态）；
      // 这里只兜 IPC 层异常，不能让一次失败把按钮焊在 pending 上。
      console.warn('[topbar-pin] 置顶偏好写入失败:', e)
    } finally {
      setPending(false)
    }
  }

  return (
    <Tooltip content={label} side="bottom">
      <button
        type="button"
        onClick={() => {
          void handleClick()
        }}
        aria-label={label}
        aria-pressed={pinned}
        disabled={pending}
        // 自写 popover 同族：显式 data-state，配合 globals.css 的关闭态焦点环抑制
        data-state={pinned ? 'on' : 'off'}
        className={cn(
          TOPBAR_BTN_BASE,
          TOPBAR_BTN_W9,
          pinned ? 'bg-accent text-foreground' : 'dark:bg-shell-panel',
          pending && 'opacity-60',
        )}
      >
        {pinned ? <PinOff /> : <Pin />}
      </button>
    </Tooltip>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
