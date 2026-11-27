// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

/**
 * ThemeCard — 主题(2026-11-27 统一版)
 *
 * 明暗(跟随系统/浅色/深色)与主题色(默认/粉色)收在同一张卡里 —— 设置页只有这一处能切主题。
 * 主题色走既有 customTheme 通道(粉色 = 亮/暗两套色板,跟随上面的明暗),不新增第二套主题系统。
 * 主色档(accent)不再单列:粉色等皮肤自带主色,细调走下方「自定义主题」。
 */

import * as React from 'react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import { Monitor, Moon, Palette, Sun } from 'lucide-react'

import { useAppearanceStore } from '@/stores/appearance-settings'
import { PINK_SKIN, isPinkSkin } from '@/lib/theme-skins'

import { OptionGrid, SectionCard } from './controls'

const MODES = [
  { key: 'system' as const, icon: Monitor, labelKey: 'themeSystem' },
  { key: 'light' as const, icon: Sun, labelKey: 'themeLight' },
  { key: 'dark' as const, icon: Moon, labelKey: 'themeDark' },
]

/** 选中/未选中按钮的同一套外观(与设置页其他单选组一致) */
const BTN = {
  active: 'border-brand-accent-deep bg-primary/5 text-primary',
  idle: 'hover:bg-accent hover:text-accent-foreground',
} as const

export function ThemeCard() {
  const t = useTranslations('appearanceSettings')
  const tm = useTranslations('settings')
  const config = useAppearanceStore()
  const { theme, setTheme } = useTheme()
  // useTheme 在 SSR/首帧是 undefined,水合后才拿到真值;先按未挂载渲染避免不一致
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const pinkActive = isPinkSkin(config.customTheme)
  const neutralActive = !config.customTheme.enabled

  return (
    <SectionCard
      icon={Palette}
      title={t('themeTitle')}
      desc={t('themeDesc')}
      testId="appearance-theme"
    >
      <div className="space-y-1.5">
        <span className="text-body font-medium">{t('themeModeLabel')}</span>
        <div role="radiogroup" aria-label={t('themeModeLabel')} className="grid grid-cols-3 gap-2">
          {MODES.map(({ key, icon: Icon, labelKey }) => {
            const active = mounted && theme === key
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTheme(key)}
                data-testid={`appearance-mode-${key}`}
                className={`flex items-center justify-center gap-2 rounded-sm border px-2 py-2 text-body transition-colors ${active ? BTN.active : BTN.idle}`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="whitespace-nowrap font-medium">{tm(labelKey)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-body font-medium">{t('themeSkinLabel')}</span>
        <div role="radiogroup" aria-label={t('themeSkinLabel')} className="grid grid-cols-2 gap-2">
          <button
            type="button"
            role="radio"
            aria-checked={neutralActive}
            onClick={() =>
              config.update({
                accentColor: 'default',
                customTheme: { ...config.customTheme, enabled: false },
              })
            }
            data-testid="appearance-skin-default"
            className={`flex items-center gap-2 rounded-sm border px-2 py-2 text-body transition-colors ${neutralActive ? BTN.active : BTN.idle}`}
          >
            <span
              className="block h-4 w-4 shrink-0 rounded-full bg-foreground ring-1 ring-black/10"
              aria-hidden="true"
            />
            <span className="whitespace-nowrap font-medium">{t('themeSkinDefault')}</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={pinkActive}
            onClick={() => config.update({ accentColor: 'rose', customTheme: { ...PINK_SKIN } })}
            data-testid="appearance-skin-pink"
            className={`flex items-center gap-2 rounded-sm border px-2 py-2 text-body transition-colors ${pinkActive ? BTN.active : BTN.idle}`}
          >
            <span
              className="block h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10"
              style={{ background: 'linear-gradient(135deg, #f9a8c8, #c23a72)' }}
              aria-hidden="true"
            />
            <span className="whitespace-nowrap font-medium">{t('presetBuiltinPink')}</span>
          </button>
        </div>
        {pinkActive ? (
          <p className="text-label text-muted-foreground">{t('presetBuiltinPinkDesc')}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <span className="text-body font-medium">{t('radiusScale')}</span>
        <OptionGrid
          value={config.radiusScale}
          onChange={(radiusScale) => config.update({ radiusScale })}
          ariaLabel={t('radiusScale')}
          columns={3}
          testIdPrefix="appearance-radius"
          options={[
            { value: 'sharp', label: t('radiusSharp') },
            { value: 'standard', label: t('radiusStandard') },
            { value: 'rounded', label: t('radiusRounded') },
          ]}
        />
        <div className="flex justify-center rounded-sm border bg-muted/30 p-2">
          <div
            className="h-10 w-24 bg-primary/15 ring-1 ring-stroke-selected/30"
            style={{ borderRadius: 'var(--radius-lg)' }}
            aria-hidden="true"
          />
        </div>
      </div>
    </SectionCard>
  )
}
