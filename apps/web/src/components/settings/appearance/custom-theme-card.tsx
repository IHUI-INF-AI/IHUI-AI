// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * CustomThemeCard — 全量自定义主题(2026-11-15 v3)
 *
 * 两套色板(亮/暗)各 6 个颜色,全部用原生 color input;
 * 主色前景由对比度算法自动推导(Provider 内联写入),这里同时展示 WCAG 对比度提示。
 * 开启后优先级高于预设主色(globals.css 的自定义主题段在 accent 段之后)。
 */

import { useTranslations } from 'next-intl'
import { Moon, Palette, RotateCcw, Sun, Wand2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@ihui/ui-react'
import { contrastForeground, contrastRatio } from '@/lib/color-contrast'
import {
  DEFAULT_CUSTOM_THEME,
  type CustomThemePalette,
  useAppearanceStore,
} from '@/stores/appearance-settings'

import { SectionCard, ToggleField } from './controls'

const PALETTE_KEYS = ['primary', 'background', 'foreground', 'card', 'muted', 'border'] as const
type PaletteKey = (typeof PALETTE_KEYS)[number]
type ThemeMode = 'light' | 'dark'

function ContrastBadge({ ratio, threshold }: { ratio: number; threshold: number }) {
  const pass = ratio >= threshold
  return (
    <span
      className={
        pass
          ? 'rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400'
          : 'rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400'
      }
    >
      {ratio.toFixed(2)}:1
    </span>
  )
}

export function CustomThemeCard() {
  const t = useTranslations('appearanceSettings')
  const config = useAppearanceStore()
  const theme = config.customTheme
  const paletteLabels: Record<PaletteKey, string> = {
    primary: t('palettePrimary'),
    background: t('paletteBackground'),
    foreground: t('paletteForeground'),
    card: t('paletteCard'),
    muted: t('paletteMuted'),
    border: t('paletteBorder'),
  }

  const updatePalette = (mode: ThemeMode, key: PaletteKey, value: string) => {
    const palette: CustomThemePalette = { ...theme[mode], [key]: value }
    config.update({ customTheme: { ...theme, [mode]: palette } })
  }

  // 按各自背景亮度把正文一键设为黑/白:用户调背景后不必手动推算可读色
  const autoFixContrast = () => {
    config.update({
      customTheme: {
        ...theme,
        light: { ...theme.light, foreground: contrastForeground(theme.light.background) },
        dark: { ...theme.dark, foreground: contrastForeground(theme.dark.background) },
      },
    })
    toast.success(t('autoContrastDone'))
  }

  return (
    <SectionCard
      icon={Palette}
      title={t('customThemeTitle')}
      desc={t('customThemeDesc')}
      testId="appearance-custom-theme"
    >
      <ToggleField
        label={t('customThemeEnable')}
        hint={t('customThemeHint')}
        checked={theme.enabled}
        onCheckedChange={(enabled) => config.update({ customTheme: { ...theme, enabled } })}
        testId="appearance-custom-theme-enabled"
      />

      {(['light', 'dark'] as const).map((mode) => {
        const palette = theme[mode]
        const primaryFg = contrastForeground(palette.primary)
        return (
          <div key={mode} className="space-y-3 rounded-sm border p-3">
            <div className="flex items-center gap-2 text-body font-medium">
              {mode === 'light' ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
              {mode === 'light' ? t('customThemeLight') : t('customThemeDark')}
            </div>

            <div className="grid grid-cols-1 gap-2 min-[640px]:grid-cols-2">
              {PALETTE_KEYS.map((key) => (
                <label key={key} className="flex items-center justify-between gap-2 text-label">
                  <span className="text-muted-foreground">{paletteLabels[key]}</span>
                  <span className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={palette[key]}
                      onChange={(event) => updatePalette(mode, key, event.target.value)}
                      aria-label={`${mode} ${paletteLabels[key]}`}
                      data-testid={`appearance-custom-${mode}-${key}`}
                      className="h-7 w-9 cursor-pointer rounded-sm border bg-transparent p-0.5"
                    />
                    <span className="w-16 font-mono text-[11px] uppercase text-muted-foreground">
                      {palette[key]}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            {/* 实时预览:直接用当前色板渲染,不受明暗主题影响 */}
            <div
              className="flex flex-wrap items-center gap-2 rounded-sm border p-2.5"
              style={{
                background: palette.background,
                color: palette.foreground,
                borderColor: palette.border,
              }}
            >
              <span
                className="rounded-sm px-2.5 py-1 text-label font-medium"
                style={{ background: palette.primary, color: primaryFg }}
              >
                {t('themePreviewPrimary')}
              </span>
              <span
                className="rounded-lg border px-2.5 py-1 text-label"
                style={{ background: palette.card, borderColor: palette.border }}
              >
                {t('themePreviewOutline')}
              </span>
              <span className="text-label opacity-70">{t('themePreviewText')}</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                {t('contrastPrimary')}
                <ContrastBadge ratio={contrastRatio(primaryFg, palette.primary)} threshold={3} />
              </span>
              <span className="flex items-center gap-1.5">
                {t('contrastBackground')}
                <ContrastBadge
                  ratio={contrastRatio(palette.foreground, palette.background)}
                  threshold={4.5}
                />
              </span>
              <span className="flex items-center gap-1.5">
                {t('contrastCard')}
                <ContrastBadge
                  ratio={contrastRatio(palette.foreground, palette.card)}
                  threshold={4.5}
                />
              </span>
            </div>
          </div>
        )
      })}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <p className="text-[11px] leading-snug text-muted-foreground">{t('autoContrastHint')}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={autoFixContrast}
            data-testid="appearance-custom-theme-auto-contrast"
          >
            <Wand2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t('autoContrast')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              config.update({
                customTheme: { ...DEFAULT_CUSTOM_THEME, enabled: theme.enabled },
              })
            }
            data-testid="appearance-custom-theme-reset"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t('customThemeReset')}
          </Button>
        </div>
      </div>
    </SectionCard>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
