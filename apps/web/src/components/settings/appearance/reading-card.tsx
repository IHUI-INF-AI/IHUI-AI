// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * ReadingCard — 显示与详细度(2026-11-15 立)
 *
 * 三档预设一次改 5 个开关 + 中间步骤档位 + 折叠策略;单开关改动后预设自动显示「自定义」
 * (由 resolveVerbosityPreset 反推,不落盘第二份预设状态)。
 *
 * 中间步骤档位复用 conversation-detail-mode store;折叠策略复用 fold-policy 模块,
 * 本卡片不新建任何平行状态。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ListTree } from 'lucide-react'

import {
  resolveVerbosityPreset,
  VERBOSITY_PRESETS,
  useAppearanceStore,
  type VerbosityPreset,
} from '@/stores/appearance-settings'
import {
  FOLD_POLICY_EVENT,
  readFoldPolicyMode,
  writeFoldPolicyMode,
  type FoldPolicyMode,
} from '@/components/chat/message-list/fold-policy'

import { OptionGrid, SectionCard, ToggleField } from './controls'

export function ReadingCard() {
  const t = useTranslations('appearanceSettings')
  const config = useAppearanceStore()
  // 折叠策略住在 fold-policy(localStorage + 事件广播),用 useSyncExternalStore 单向订阅,
  // 不复制第二份状态;在别处改策略后本卡片会自动切成「自定义」。
  const foldMode = React.useSyncExternalStore(
    (onChange) => {
      window.addEventListener(FOLD_POLICY_EVENT, onChange)
      return () => window.removeEventListener(FOLD_POLICY_EVENT, onChange)
    },
    readFoldPolicyMode,
    () => 'auto' as FoldPolicyMode,
  )
  const activePreset = resolveVerbosityPreset(config, foldMode)

  const applyPreset = (preset: Exclude<VerbosityPreset, 'custom'>) => {
    config.update(VERBOSITY_PRESETS[preset])
    if (preset === 'concise') {
      writeFoldPolicyMode('collapsed')
    } else if (preset === 'detailed') {
      writeFoldPolicyMode('expanded')
    } else {
      writeFoldPolicyMode('auto')
    }
  }

  return (
    <SectionCard
      icon={ListTree}
      title={t('readingTitle')}
      desc={t('readingDesc')}
      testId="appearance-reading"
    >
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-body font-medium">{t('verbosity')}</span>
          {activePreset === 'custom' ? (
            <span className="text-label text-muted-foreground">{t('verbosityCustom')}</span>
          ) : null}
        </div>
        <OptionGrid
          value={activePreset === 'custom' ? 'custom' : activePreset}
          onChange={(preset) => {
            if (preset === 'custom') return
            applyPreset(preset)
          }}
          ariaLabel={t('verbosity')}
          columns={4}
          testIdPrefix="appearance-verbosity"
          options={[
            {
              value: 'concise',
              label: t('verbosityConcise'),
              desc: t('verbosityConciseDesc'),
            },
            {
              value: 'standard',
              label: t('verbosityStandard'),
              desc: t('verbosityStandardDesc'),
            },
            {
              value: 'detailed',
              label: t('verbosityDetailed'),
              desc: t('verbosityDetailedDesc'),
            },
            { value: 'custom', label: t('verbosityCustom') },
          ]}
        />
      </div>

      <div className="space-y-1.5">
        <span className="text-body font-medium">{t('timestampFormat')}</span>
        <OptionGrid
          value={config.timestampFormat}
          onChange={(timestampFormat) => config.update({ timestampFormat })}
          ariaLabel={t('timestampFormat')}
          columns={3}
          testIdPrefix="appearance-timestamp-format"
          options={[
            { value: '24h', label: t('timestamp24h') },
            { value: '12h', label: t('timestamp12h') },
            { value: 'relative', label: t('timestampRelative') },
          ]}
        />
      </div>

      <div className="space-y-1.5">
        <span className="text-body font-medium">{t('textAlign')}</span>
        <OptionGrid
          value={config.textAlign}
          onChange={(textAlign) => config.update({ textAlign })}
          ariaLabel={t('textAlign')}
          columns={2}
          testIdPrefix="appearance-text-align"
          options={[
            { value: 'left', label: t('alignLeft') },
            { value: 'justify', label: t('alignJustify') },
          ]}
        />
      </div>

      <div className="space-y-3 border-t pt-3">
        <span className="text-body font-medium">{t('readingAids')}</span>
        <ToggleField
          label={t('bionicReading')}
          hint={t('bionicReadingHint')}
          checked={config.bionicReading}
          onCheckedChange={(bionicReading) => config.update({ bionicReading })}
          testId="appearance-bionic-reading"
        />
        <ToggleField
          label={t('readingRuler')}
          hint={t('readingRulerHint')}
          checked={config.readingRuler}
          onCheckedChange={(readingRuler) => config.update({ readingRuler })}
          testId="appearance-reading-ruler"
        />
        <ToggleField
          label={t('paragraphGap')}
          hint={t('paragraphGapHint')}
          checked={config.paragraphGap}
          onCheckedChange={(paragraphGap) => config.update({ paragraphGap })}
          testId="appearance-paragraph-gap"
        />
        <ToggleField
          label={t('firstLineIndent')}
          hint={t('firstLineIndentHint')}
          checked={config.firstLineIndent}
          onCheckedChange={(firstLineIndent) => config.update({ firstLineIndent })}
          testId="appearance-first-line-indent"
        />
        <ToggleField
          label={t('tableZebra')}
          hint={t('tableZebraHint')}
          checked={config.tableZebra}
          onCheckedChange={(tableZebra) => config.update({ tableZebra })}
          testId="appearance-table-zebra"
        />
      </div>

      <div className="space-y-3 border-t pt-3">
        <ToggleField
          label={t('showTimestamps')}
          checked={config.showTimestamps}
          onCheckedChange={(showTimestamps) => config.update({ showTimestamps })}
          testId="appearance-show-timestamps"
        />
        <ToggleField
          label={t('showUsage')}
          checked={config.showUsage}
          onCheckedChange={(showUsage) => config.update({ showUsage })}
          testId="appearance-show-usage"
        />
        <ToggleField
          label={t('showActions')}
          checked={config.showActions}
          onCheckedChange={(showActions) => config.update({ showActions })}
          testId="appearance-show-actions"
        />
        <ToggleField
          label={t('showReasoning')}
          checked={config.showReasoning}
          onCheckedChange={(showReasoning) => config.update({ showReasoning })}
          testId="appearance-show-reasoning"
        />
        <ToggleField
          label={t('showToolCalls')}
          checked={config.showToolCalls}
          onCheckedChange={(showToolCalls) => config.update({ showToolCalls })}
          testId="appearance-show-tool-calls"
        />
      </div>
    </SectionCard>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
