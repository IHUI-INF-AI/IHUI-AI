// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * LayoutCard — 布局与宽度(2026-11-15 立)
 *
 * 宽度/间距全部经 CSS 变量落到聊天容器:
 *   --chat-content-width / --chat-message-gap / --chat-user-bubble-width
 * 组件侧只读变量,不在每个页面各写一份像素值。
 */

import { useTranslations } from 'next-intl'
import { LayoutTemplate } from 'lucide-react'

import {
  CHAT_INPUT_SCALE_MAX,
  CHAT_INPUT_SCALE_MIN,
  COLLAPSE_LINES_MAX,
  COLLAPSE_LINES_MIN,
  USER_BUBBLE_WIDTH_MAX,
  USER_BUBBLE_WIDTH_MIN,
  useAppearanceStore,
} from '@/stores/appearance-settings'

import { OptionGrid, RangeField, SectionCard, ToggleField } from './controls'

export function LayoutCard() {
  const t = useTranslations('appearanceSettings')
  const config = useAppearanceStore()

  return (
    <SectionCard
      icon={LayoutTemplate}
      title={t('layoutTitle')}
      desc={t('layoutDesc')}
      testId="appearance-layout"
    >
      <div className="space-y-1.5">
        <span className="text-body font-medium">{t('contentWidth')}</span>
        <OptionGrid
          value={config.contentWidth}
          onChange={(contentWidth) => config.update({ contentWidth })}
          ariaLabel={t('contentWidth')}
          columns={5}
          testIdPrefix="appearance-content-width"
          options={[
            { value: 'narrow', label: t('widthNarrow') },
            { value: 'standard', label: t('widthStandard') },
            { value: 'wide', label: t('widthWide') },
            { value: 'xwide', label: t('widthXWide') },
            { value: 'full', label: t('widthFull') },
          ]}
        />
        {/* 宽度示意条:让"窄/标准/宽/超宽/全宽"不必靠文字想象 */}
        <div className="flex justify-center rounded-sm border bg-muted/30 p-2">
          <div
            className="h-8 rounded-xs bg-primary/15 ring-1 ring-stroke-selected/30"
            style={{
              width:
                config.contentWidth === 'full'
                  ? '100%'
                  : `${{ narrow: 62, standard: 75, wide: 88, xwide: 100 }[config.contentWidth]}%`,
            }}
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-body font-medium">{t('messageDensity')}</span>
        <OptionGrid
          value={config.messageDensity}
          onChange={(messageDensity) => config.update({ messageDensity })}
          ariaLabel={t('messageDensity')}
          columns={3}
          testIdPrefix="appearance-message-density"
          options={[
            { value: 'compact', label: t('densityCompact') },
            { value: 'cozy', label: t('densityCozy') },
            { value: 'spacious', label: t('densitySpacious') },
          ]}
        />
      </div>

      <RangeField
        label={t('userBubbleWidth')}
        min={USER_BUBBLE_WIDTH_MIN}
        max={USER_BUBBLE_WIDTH_MAX}
        step={5}
        value={config.userBubbleWidth}
        valueText={t('valuePercent', { value: config.userBubbleWidth })}
        onChange={(userBubbleWidth) => config.update({ userBubbleWidth })}
        testId="appearance-user-bubble-width"
      />

      <RangeField
        label={t('chatInputScale')}
        hint={t('chatInputScaleHint')}
        min={CHAT_INPUT_SCALE_MIN * 100}
        max={CHAT_INPUT_SCALE_MAX * 100}
        step={5}
        value={Math.round(config.chatInputScale * 100)}
        valueText={t('valuePercent', { value: Math.round(config.chatInputScale * 100) })}
        onChange={(value) => config.update({ chatInputScale: value / 100 })}
        testId="appearance-chat-input-scale"
      />

      <div className="space-y-3 border-t pt-3">
        <ToggleField
          label={t('longMessageCollapse')}
          hint={t('longMessageCollapseHint')}
          checked={config.longMessageCollapse}
          onCheckedChange={(longMessageCollapse) => config.update({ longMessageCollapse })}
          testId="appearance-long-message-collapse"
        />
        {config.longMessageCollapse ? (
          <RangeField
            label={t('collapseLines')}
            hint={t('collapseLinesHint')}
            min={COLLAPSE_LINES_MIN}
            max={COLLAPSE_LINES_MAX}
            step={2}
            value={config.collapseLines}
            valueText={String(config.collapseLines)}
            onChange={(collapseLines) => config.update({ collapseLines })}
            testId="appearance-collapse-lines"
          />
        ) : null}
      </div>
    </SectionCard>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
