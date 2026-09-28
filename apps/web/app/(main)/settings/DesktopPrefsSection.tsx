// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useTranslations } from 'next-intl'
import { Eye, MousePointerClick, BadgeCheck, Rocket, SquareX } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button, Switch } from '@ihui/ui-react'
import type {
  DesktopCloseBehavior,
  DesktopPrefs,
  DesktopPrefsPatch,
  DesktopTrayMenuItemKey,
  DesktopTraySingleClick,
} from '@/lib/desktop-prefs-bridge'
import { DesktopTrayMenuSection } from './DesktopTrayMenuSection'

/**
 * 客户端设置卡的「行控件」+ 托盘/关闭偏好组(2026-09-28 立)。
 *
 * 从 DesktopSettingsCard 拆出来只为一件事:整张卡把偏好六行 + 两种行控件都收在同一个文件里会
 * 越过 AGENTS.md §4 的「每页 < 250 行」上限(拆前 435 行)。本文件承载的都是**本次新增的偏好面**,
 * 卡里其余既有区块(版本、快捷键、窗口控制、高级操作)一行都没动。
 *
 * `SwitchRow` / `ChoiceRow` 一并导出:卡片自身的既有行(开机自启、托盘常驻)用的就是同一对控件,
 * 复制一份就会出现"两处形状、改一处忘一处"。
 */

/**
 * 一行「图标 + 标题/说明 + 开关」的控件行(本卡内三种开关行同形,只写一遍)。
 */
export function SwitchRow(props: {
  icon: LucideIcon
  title: string
  desc: string
  checked: boolean
  disabled: boolean
  onCheckedChange: (next: boolean) => void
}) {
  const { icon: Icon, title, desc, checked, disabled, onCheckedChange } = props
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="whitespace-nowrap text-sm font-medium">{title}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={title}
        className="shrink-0"
      />
    </div>
  )
}

/**
 * 一行互斥档位选择(分段控件)。
 * `disabledValue` 是**被禁掉的那一档**(不是"整组禁用"):它仍然显示当前值,只是按不下去,
 * 并在下面给一行原因 —— 把档位从界面上抹掉会让人以为设置丢了,而它只是暂时不可选。
 */
export function ChoiceRow<T extends string>(props: {
  icon: LucideIcon
  title: string
  value: T
  options: readonly { value: T; label: string }[]
  disabledValue?: T
  disabledHint?: string
  disabled: boolean
  onSelect: (next: T) => void
}) {
  const { icon: Icon, title, value, options, disabledValue, disabledHint, disabled, onSelect } = props
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="whitespace-nowrap">{title}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value
          const blocked = disabled || option.value === disabledValue
          return (
            <Button
              key={option.value}
              variant={selected ? 'default' : 'outline'}
              size="xs"
              disabled={blocked}
              onClick={() => onSelect(option.value)}
              aria-pressed={selected}
              className="shrink-0 flex-nowrap"
            >
              {option.label}
            </Button>
          )
        })}
      </div>
      {disabledValue === undefined ? null : disabledHint ? (
        <p className="line-clamp-2 text-[11px] text-muted-foreground">{disabledHint}</p>
      ) : null}
    </div>
  )
}

/** 分段控件用的短名 —— 联合值只定义一份(在 `desktop-prefs-bridge`,与 Rust 侧 serde 同形)。 */
type CloseBehavior = DesktopCloseBehavior
type TraySingleClick = DesktopTraySingleClick

export interface DesktopPrefsSectionProps {
  /** 宿主回传的有效偏好(不是本地乐观值) */
  prefs: DesktopPrefs
  /** 初值未到位 / 写入进行中:整组按不下去 */
  disabled: boolean
  /** 发一项 patch;落有效值与提示成败由调用方(commit)负责 */
  onPatch: (patch: DesktopPrefsPatch) => void
}

/**
 * 托盘与关闭偏好组(显示托盘图标 / 点关闭按钮时 / 启动后先进托盘 / 托盘单击 / 未读提醒 / 菜单项)。
 *
 * 互斥组合**不由这里裁定**:关掉「显示托盘图标」时只发 `{ showTrayIcon: false }` 这一项,
 * 「隐藏到托盘」是否还可用、`closeBehavior` 落回哪一档,全部认宿主回传的有效值(第二份真相
 * 在前端重算一遍,就只是把它已经纠正过的决定又改回去的窗口)。
 */
export function DesktopPrefsSection({ prefs, disabled, onPatch }: DesktopPrefsSectionProps) {
  const t = useTranslations('settings')

  const closeBehaviorOptions: readonly { value: CloseBehavior; label: string }[] = [
    { value: 'hide', label: t('desktopCloseHide') },
    { value: 'quit', label: t('desktopCloseQuit') },
    { value: 'ask', label: t('desktopCloseAsk') },
  ]
  const trayClickOptions: readonly { value: TraySingleClick; label: string }[] = [
    { value: 'menu', label: t('desktopTrayClickMenu') },
    { value: 'toggle_window', label: t('desktopTrayClickToggle') },
  ]

  const toggleTrayMenuItem = (key: DesktopTrayMenuItemKey, next: boolean) => {
    const items = next
      ? Array.from(new Set([...prefs.trayMenuItems, key]))
      : prefs.trayMenuItems.filter((item) => item !== key)
    onPatch({ trayMenuItems: items })
  }

  return (
    <>
      <SwitchRow
        icon={Eye}
        title={t('desktopShowTrayTitle')}
        desc={t('desktopShowTrayDesc')}
        checked={prefs.showTrayIcon}
        disabled={disabled}
        onCheckedChange={(checked) => {
          onPatch({ showTrayIcon: checked })
        }}
      />

      <ChoiceRow<CloseBehavior>
        icon={SquareX}
        title={t('desktopCloseTitle')}
        value={prefs.closeBehavior}
        options={closeBehaviorOptions}
        disabledValue={prefs.showTrayIcon ? undefined : 'hide'}
        disabledHint={prefs.showTrayIcon ? undefined : t('desktopCloseDisabledHint')}
        disabled={disabled}
        onSelect={(next) => {
          onPatch({ closeBehavior: next })
        }}
      />

      <SwitchRow
        icon={Rocket}
        title={t('desktopLaunchMinTitle')}
        desc={t('desktopLaunchMinDesc')}
        checked={prefs.launchMinimized}
        disabled={disabled}
        onCheckedChange={(checked) => {
          onPatch({ launchMinimized: checked })
        }}
      />

      <ChoiceRow<TraySingleClick>
        icon={MousePointerClick}
        title={t('desktopTrayClickTitle')}
        value={prefs.traySingleClick}
        options={trayClickOptions}
        disabled={disabled}
        onSelect={(next) => {
          onPatch({ traySingleClick: next })
        }}
      />

      <SwitchRow
        icon={BadgeCheck}
        title={t('desktopBadgeTitle')}
        desc={t('desktopBadgeDesc')}
        checked={prefs.unreadBadge}
        disabled={disabled}
        onCheckedChange={(checked) => {
          onPatch({ unreadBadge: checked })
        }}
      />

      <DesktopTrayMenuSection items={prefs.trayMenuItems} disabled={disabled} onToggle={toggleTrayMenuItem} />
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
