// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

'use client'

import { useTranslations } from 'next-intl'
import { Switch } from '@ihui/ui-react'
import { DESKTOP_TRAY_MENU_ITEM_KEYS, type DesktopTrayMenuItemKey } from '@/lib/desktop-prefs-bridge'

/**
 * DesktopTrayMenuSection — 托盘右键菜单项开关组(2026-09-28 立)。
 *
 * 从 DesktopSettingsCard 拆出来是因为整张客户端设置卡加上偏好控件会越过 AGENTS.md §4 的
 * 「每页 < 250 行」上限;拆出去后本文件只管一件事:**哪几项出现在托盘菜单里**。
 *
 * 「退出」一项恒开且不可关(宿主契约:`trayMenuItems` 必须含 `quit`,否则托盘里只剩没有出口的
 * 菜单),所以它渲染为 checked + disabled,并给一行原因 —— 不是把它从数组里删掉。
 */
const MENU_LABEL_KEYS: Record<DesktopTrayMenuItemKey, string> = {
  new_chat: 'desktopMenuNewChat',
  show: 'desktopMenuShow',
  hide: 'desktopMenuHide',
  theme: 'desktopMenuTheme',
  settings: 'desktopMenuSettings',
  update: 'desktopMenuUpdate',
  quit: 'desktopMenuQuit',
}

export interface DesktopTrayMenuSectionProps {
  /** 宿主回传的有效集合(顺序按本地封闭集渲染,未知项不参与呈现) */
  items: readonly DesktopTrayMenuItemKey[]
  disabled: boolean
  onToggle: (key: DesktopTrayMenuItemKey, next: boolean) => void
}

export function DesktopTrayMenuSection({
  items,
  disabled,
  onToggle,
}: DesktopTrayMenuSectionProps) {
  const t = useTranslations('settings')

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t('desktopMenuTitle')}</p>
      <div className="grid grid-cols-1 gap-1.5">
        {DESKTOP_TRAY_MENU_ITEM_KEYS.map((key) => {
          const locked = key === 'quit'
          const checked = locked || items.includes(key)
          return (
            <div
              key={key}
              className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate text-xs">{t(MENU_LABEL_KEYS[key])}</p>
                {locked ? (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {t('desktopMenuQuitLocked')}
                  </p>
                ) : null}
              </div>
              <Switch
                checked={checked}
                onCheckedChange={(next) => onToggle(key, next)}
                disabled={disabled || locked}
                aria-label={t(MENU_LABEL_KEYS[key])}
                className="shrink-0"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
