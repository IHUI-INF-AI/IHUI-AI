// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * /settings/appearance — 外观与排版(2026-11-15 立)
 *
 * 分区:字体与字号 / 布局与宽度 / 显示与详细度 / AI 回复风格 / 无障碍 / 配置管理。
 * 所有控件直接写 useAppearanceStore,由 AppearanceProvider 实时映射到 CSS 变量;
 * 设置页自身不持有任何镜像状态,避免"界面显示 A、实际生效 B"。
 */

import { useTranslations } from 'next-intl'
import { Palette } from 'lucide-react'

import { BackButton } from '@/components/common'
import { Container } from '@/components/layout'
import { CustomThemeCard } from '@/components/settings/appearance/custom-theme-card'
import { PresetCard } from '@/components/settings/appearance/preset-card'
import { ScopeCard } from '@/components/settings/appearance/scope-card'
import { ThemeCard } from '@/components/settings/appearance/theme-card'
import { TypographyCard } from '@/components/settings/appearance/typography-card'
import { LayoutCard } from '@/components/settings/appearance/layout-card'
import { ReadingCard } from '@/components/settings/appearance/reading-card'
import { AiStyleCard } from '@/components/settings/appearance/ai-style-card'
import { AccessibilityCard, DataCard } from '@/components/settings/appearance/misc-cards'

export default function AppearanceSettingsPage() {
  const t = useTranslations('appearanceSettings')
  // 区块跳转:设置项已接近 50 个,长页需要快速定位;标签复用各卡片既有标题,不新增文案
  const sections = [
    { id: 'appearance-presets', label: t('presetsTitle') },
    { id: 'appearance-theme', label: t('themeTitle') },
    { id: 'appearance-custom-theme', label: t('customThemeTitle') },
    { id: 'appearance-typography', label: t('typographyTitle') },
    { id: 'appearance-layout', label: t('layoutTitle') },
    { id: 'appearance-reading', label: t('readingTitle') },
    { id: 'appearance-ai-style', label: t('aiStyleTitle') },
    { id: 'appearance-scope', label: t('scopeTitle') },
    { id: 'appearance-accessibility', label: t('accessibilityTitle') },
  ]

  return (
    <Container maxWidth="full" padding={false} className="px-4 flex h-full flex-col py-4">
      <BackButton />
      <div className="shrink-0">
        <h1 className="text-display font-bold tracking-tight flex items-center gap-2">
          <Palette className="h-6 w-6 shrink-0" aria-hidden="true" />
          {t('title')}
        </h1>
        <p className="mt-1 text-body text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-8">
        <div className="mx-auto w-full max-w-4xl space-y-4">
          <nav
            aria-label={t('title')}
            data-testid="appearance-section-nav"
            className="flex flex-wrap gap-2"
          >
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() =>
                  document
                    .getElementById(section.id)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                className="rounded-full border border-stroke-default px-3 py-1 text-label transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {section.label}
              </button>
            ))}
          </nav>
          <div id="appearance-presets" className="scroll-mt-4">
            <PresetCard />
          </div>
          <div id="appearance-theme" className="scroll-mt-4">
            <ThemeCard />
          </div>
          <div id="appearance-custom-theme" className="scroll-mt-4">
            <CustomThemeCard />
          </div>
          <div id="appearance-typography" className="scroll-mt-4">
            <TypographyCard />
          </div>
          <div id="appearance-layout" className="scroll-mt-4">
            <LayoutCard />
          </div>
          <div id="appearance-reading" className="scroll-mt-4">
            <ReadingCard />
          </div>
          <div id="appearance-ai-style" className="scroll-mt-4">
            <AiStyleCard />
          </div>
          <div id="appearance-scope" className="scroll-mt-4">
            <ScopeCard />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div id="appearance-accessibility" className="scroll-mt-4">
              <AccessibilityCard />
            </div>
            <DataCard />
          </div>
        </div>
      </div>
    </Container>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
