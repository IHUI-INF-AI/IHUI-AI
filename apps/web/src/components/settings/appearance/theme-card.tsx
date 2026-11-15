// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * ThemeCard — 主题深化(2026-11-15 v2)
 *
 * 主色只存枚举,颜色值住在 globals.css 的 data-accent 段(亮/暗各一套);
 * 色板预览点用 [data-accent-preview] 复用同一份变量,避免在 TSX 里复制十六进制。
 * 圆角档同样不存具体像素,由 Provider 乘在 design-tokens 的 --radius-* 上。
 */

import { useTranslations } from 'next-intl'
import { Palette } from 'lucide-react'

import { useAppearanceStore, type AccentColorMode } from '@/stores/appearance-settings'

import { OptionGrid, SectionCard } from './controls'

const ACCENTS: readonly AccentColorMode[] = [
  'default',
  'blue',
  'violet',
  'emerald',
  'amber',
  'rose',
]

const ACCENT_LABEL_KEYS = {
  default: 'accentDefault',
  blue: 'accentBlue',
  violet: 'accentViolet',
  emerald: 'accentEmerald',
  amber: 'accentAmber',
  rose: 'accentRose',
} as const

export function ThemeCard() {
  const t = useTranslations('appearanceSettings')
  const config = useAppearanceStore()

  return (
    <SectionCard
      icon={Palette}
      title={t('themeTitle')}
      desc={t('themeDesc')}
      testId="appearance-theme"
    >
      <div className="space-y-1.5">
        <span className="text-body font-medium">{t('accentColor')}</span>
        <div
          role="radiogroup"
          aria-label={t('accentColor')}
          className="grid grid-cols-3 gap-2 min-[640px]:grid-cols-6"
        >
          {ACCENTS.map((accent) => {
            const active = config.accentColor === accent
            return (
              <button
                key={accent}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => config.update({ accentColor: accent })}
                data-testid={`appearance-accent-${accent}`}
                className={
                  active
                    ? 'flex flex-col items-center gap-1 rounded-sm border border-brand-accent-deep bg-primary/5 px-2 py-2 text-body text-primary'
                    : 'flex flex-col items-center gap-1 rounded-sm border px-2 py-2 text-body hover:bg-accent hover:text-accent-foreground'
                }
              >
                <span
                  {...(accent === 'default' ? {} : { 'data-accent-preview': accent })}
                  className="flex h-5 w-5 items-center justify-center"
                >
                  <span
                    className={
                      accent === 'default'
                        ? 'block h-4 w-4 rounded-full bg-foreground ring-1 ring-black/10'
                        : 'block h-4 w-4 rounded-full bg-[var(--color-primary)] ring-1 ring-black/10'
                    }
                  />
                </span>
                <span className="whitespace-nowrap font-medium">
                  {t(ACCENT_LABEL_KEYS[accent])}
                </span>
              </button>
            )
          })}
        </div>
        {/* 实时预览:主色按钮 + 描边 + 正文,让选择立刻可见 */}
        <div className="flex flex-wrap items-center gap-2 rounded-sm border bg-muted/30 p-2.5">
          <span className="rounded-sm bg-cta px-2.5 py-1 text-label font-medium text-cta-foreground">
            {t('themePreviewPrimary')}
          </span>
          <span className="rounded-sm border border-brand-accent-deep px-2.5 py-1 text-label text-primary">
            {t('themePreviewOutline')}
          </span>
          <span className="text-label text-muted-foreground">{t('themePreviewText')}</span>
        </div>
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
