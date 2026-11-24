// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * TypographyCard — 字体与字号(2026-11-15 立)
 *
 * 两套字号互相独立:
 *   - 界面字号:覆盖 design-tokens 的 --text-* 档位,影响全站标题/按钮/菜单;
 *   - AI 对话字号:只乘在对话正文上(--chat-font-scale),界面不变。
 * 代码换行偏好复用 code-block-prefs store(不复制第二份布尔态)。
 */

import { useTranslations } from 'next-intl'
import { Type } from 'lucide-react'

import {
  CHAT_FONT_SCALE_MAX,
  CHAT_FONT_SCALE_MIN,
  CODE_FONT_SIZE_MAX,
  CODE_FONT_SIZE_MIN,
  resolveSizePreset,
  SIZE_PRESETS,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  useAppearanceStore,
} from '@/stores/appearance-settings'
import { useCodeBlockPrefsStore } from '@/stores/code-block-prefs'

import { OptionGrid, RangeField, SectionCard, ToggleField } from './controls'

export function TypographyCard() {
  const t = useTranslations('appearanceSettings')
  const config = useAppearanceStore()
  const codeWrap = useCodeBlockPrefsStore((s) => s.wrap)
  const setCodeWrap = useCodeBlockPrefsStore((s) => s.setWrap)
  const sizePreset = resolveSizePreset(config)

  return (
    <SectionCard
      icon={Type}
      title={t('typographyTitle')}
      desc={t('typographyDesc')}
      testId="appearance-typography"
    >
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-body font-medium">{t('sizePreset')}</span>
          {sizePreset === 'custom' ? (
            <span className="text-label text-muted-foreground">{t('sizeCustom')}</span>
          ) : null}
        </div>
        <OptionGrid
          value={sizePreset}
          onChange={(preset) => {
            if (preset === 'custom') return
            config.update(SIZE_PRESETS[preset])
          }}
          ariaLabel={t('sizePreset')}
          columns={4}
          testIdPrefix="appearance-size-preset"
          options={[
            { value: 'compact', label: t('sizeCompact') },
            { value: 'comfortable', label: t('sizeComfortable') },
            { value: 'large', label: t('sizeLarge') },
            { value: 'custom', label: t('sizeCustom') },
          ]}
        />
      </div>

      <RangeField
        label={t('uiScale')}
        hint={t('uiScaleHint')}
        min={UI_SCALE_MIN * 100}
        max={UI_SCALE_MAX * 100}
        step={5}
        value={Math.round(config.uiScale * 100)}
        valueText={t('valuePercent', { value: Math.round(config.uiScale * 100) })}
        onChange={(value) => config.update({ uiScale: value / 100 })}
        testId="appearance-ui-scale"
      />

      <RangeField
        label={t('chatFontScale')}
        hint={t('chatFontScaleHint')}
        min={CHAT_FONT_SCALE_MIN * 100}
        max={CHAT_FONT_SCALE_MAX * 100}
        step={5}
        value={Math.round(config.chatFontScale * 100)}
        valueText={t('valuePercent', { value: Math.round(config.chatFontScale * 100) })}
        onChange={(value) => config.update({ chatFontScale: value / 100 })}
        testId="appearance-chat-font-scale"
      />

      <div className="space-y-1.5">
        <span className="text-body font-medium">{t('fontFamily')}</span>
        <OptionGrid
          value={config.fontFamily}
          onChange={(fontFamily) => config.update({ fontFamily })}
          ariaLabel={t('fontFamily')}
          columns={4}
          testIdPrefix="appearance-font-family"
          options={[
            { value: 'system', label: t('fontFamilySystem') },
            { value: 'sans', label: t('fontFamilySans') },
            { value: 'serif', label: t('fontFamilySerif') },
            { value: 'mono', label: t('fontFamilyMono') },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2">
        <div className="space-y-1.5">
          <span className="text-body font-medium">{t('bodyWeight')}</span>
          <OptionGrid
            value={config.bodyWeight}
            onChange={(bodyWeight) => config.update({ bodyWeight })}
            ariaLabel={t('bodyWeight')}
            columns={3}
            testIdPrefix="appearance-body-weight"
            options={[
              { value: 'regular', label: t('weightRegular') },
              { value: 'medium', label: t('weightMedium') },
              { value: 'bold', label: t('weightBold') },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-body font-medium">{t('lineHeight')}</span>
          <OptionGrid
            value={config.lineHeight}
            onChange={(lineHeight) => config.update({ lineHeight })}
            ariaLabel={t('lineHeight')}
            columns={3}
            testIdPrefix="appearance-line-height"
            options={[
              { value: 'compact', label: t('lineHeightCompact') },
              { value: 'normal', label: t('lineHeightNormal') },
              { value: 'relaxed', label: t('lineHeightRelaxed') },
            ]}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-body font-medium">{t('letterSpacing')}</span>
        <OptionGrid
          value={config.letterSpacing}
          onChange={(letterSpacing) => config.update({ letterSpacing })}
          ariaLabel={t('letterSpacing')}
          columns={3}
          testIdPrefix="appearance-letter-spacing"
          options={[
            { value: 'tight', label: t('letterSpacingTight') },
            { value: 'normal', label: t('letterSpacingNormal') },
            { value: 'wide', label: t('letterSpacingWide') },
          ]}
        />
      </div>

      <RangeField
        label={t('codeFontSize')}
        min={CODE_FONT_SIZE_MIN}
        max={CODE_FONT_SIZE_MAX}
        step={1}
        value={config.codeFontSize}
        valueText={t('valuePx', { value: config.codeFontSize })}
        onChange={(codeFontSize) => config.update({ codeFontSize })}
        testId="appearance-code-font-size"
      />

      <ToggleField
        label={t('codeWrap')}
        hint={t('codeWrapHint')}
        checked={codeWrap}
        onCheckedChange={setCodeWrap}
        testId="appearance-code-wrap"
      />

      <ToggleField
        label={t('tabularNums')}
        hint={t('tabularNumsHint')}
        checked={config.tabularNums}
        onCheckedChange={(tabularNums) => config.update({ tabularNums })}
        testId="appearance-tabular-nums"
      />

      <div className="space-y-1.5">
        <span className="text-body font-medium">{t('previewTitle')}</span>
        <div
          className="rounded-sm border bg-muted/30 p-3"
          data-testid="appearance-preview"
          style={{
            fontSize: 'calc(15px * var(--chat-font-scale, 1))',
            lineHeight: 'var(--chat-line-height, 1.65)',
            letterSpacing: 'var(--chat-letter-spacing, normal)',
          }}
        >
          <p className="m-0">{t('previewText')}</p>
          <pre
            className="mt-2 overflow-x-auto rounded-xs bg-background/60 p-2"
            style={{ fontSize: 'var(--chat-code-font-size, 15px)', lineHeight: 1.5 }}
          >
            <code className="font-mono">{'const total = items.length * 2'}</code>
          </pre>
        </div>
      </div>
    </SectionCard>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
