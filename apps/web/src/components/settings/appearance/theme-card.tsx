// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

/**
 * ThemeCard — 主题(2026-11-27 三字主题色版)
 *
 * 主题色 = 随系统 / 珍珠白 / 曜石黑 / 樱花粉,一行选完:前三个是中性皮肤的明暗档
 * (随系统跟随设备、珍珠白固定浅色、曜石黑固定深色),樱花粉 = 粉色皮肤(亮暗自适应)。
 * 主题色走既有 customTheme 通道(粉色 = 亮/暗两套色板),不新增第二套主题系统。
 * 细调仍走下方「自定义主题」。
 */

import * as React from 'react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import { Monitor, Palette } from 'lucide-react'

import { useAppearanceStore } from '@/stores/appearance-settings'
import { PINK_SKIN, isPinkSkin } from '@/lib/theme-skins'

import { OptionGrid, SectionCard } from './controls'

/** 选中/未选中按钮的同一套外观(与设置页其他单选组一致) */
const BTN = {
  active: 'border-brand-accent-deep bg-primary/5 text-primary',
  idle: 'hover:bg-accent hover:text-accent-foreground',
} as const

export function ThemeCard() {
  const t = useTranslations('appearanceSettings')
  const config = useAppearanceStore()
  const { theme, setTheme } = useTheme()
  // useTheme 在 SSR/首帧是 undefined,水合后才拿到真值;先按未挂载渲染避免不一致
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const pinkActive = isPinkSkin(config.customTheme)
  const neutralActive = !config.customTheme.enabled
  const systemActive = neutralActive && mounted && theme === 'system'
  const pearlActive = neutralActive && mounted && theme === 'light'
  const obsidianActive = neutralActive && mounted && theme === 'dark'

  const applyNeutral = () => {
    config.update({
      accentColor: 'default',
      customTheme: { ...config.customTheme, enabled: false },
    })
  }

  const skins = [
    {
      id: 'system',
      label: t('themeSkinDefault'),
      active: systemActive,
      onClick: () => {
        applyNeutral()
        setTheme('system')
      },
      swatch: <Monitor className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      id: 'pearl',
      label: t('themeSkinPearl'),
      active: pearlActive,
      onClick: () => {
        applyNeutral()
        setTheme('light')
      },
      swatch: (
        <span
          className="block h-4 w-4 shrink-0 rounded-full bg-white ring-1 ring-black/20"
          aria-hidden="true"
        />
      ),
    },
    {
      id: 'obsidian',
      label: t('themeSkinObsidian'),
      active: obsidianActive,
      onClick: () => {
        applyNeutral()
        setTheme('dark')
      },
      swatch: (
        <span
          className="block h-4 w-4 shrink-0 rounded-full ring-1 ring-black/40"
          style={{ background: '#141416' }}
          aria-hidden="true"
        />
      ),
    },
    {
      id: 'pink',
      label: t('presetBuiltinPink'),
      active: pinkActive,
      onClick: () => {
        config.update({ accentColor: 'rose', customTheme: { ...PINK_SKIN } })
        setTheme('system')
      },
      swatch: (
        <span
          className="block h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10"
          style={{ background: 'linear-gradient(135deg, #f9a8c8, #c23a72)' }}
          aria-hidden="true"
        />
      ),
    },
  ]

  return (
    <SectionCard
      icon={Palette}
      title={t('themeTitle')}
      desc={t('themeDesc')}
      testId="appearance-theme"
    >
      <div className="space-y-1.5">
        <span className="text-body font-medium">{t('themeSkinLabel')}</span>
        <div role="radiogroup" aria-label={t('themeSkinLabel')} className="grid grid-cols-2 gap-2">
          {skins.map((skin) => (
            <button
              key={skin.id}
              type="button"
              role="radio"
              aria-checked={skin.active}
              onClick={skin.onClick}
              data-testid={`appearance-skin-${skin.id}`}
              className={`flex items-center gap-2 rounded-sm border px-2 py-2 text-body transition-colors ${skin.active ? BTN.active : BTN.idle}`}
            >
              {skin.swatch}
              <span className="whitespace-nowrap font-medium">{skin.label}</span>
            </button>
          ))}
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
