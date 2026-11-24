// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * PresetCard — 外观预设(2026-11-15 v4)
 *
 * 内置预设与用户预设共用同一条应用路径:overrides → appearance-settings.update()。
 * 本卡片不缓存任何"当前预设"状态 —— 预设是动作,不是第二套配置。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { RotateCcw, Save, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button, Input } from '@ihui/ui-react'
import { BUILT_IN_APPEARANCE_PRESETS } from '@/lib/appearance-presets'
import {
  getAppearanceConfig,
  type AppearanceConfig,
  useAppearanceStore,
} from '@/stores/appearance-settings'
import {
  CUSTOM_PRESET_LIMIT,
  PRESET_NAME_MAX,
  useAppearancePresetsStore,
} from '@/stores/appearance-presets'

import { SectionCard } from './controls'

export function PresetCard() {
  const t = useTranslations('appearanceSettings')
  const update = useAppearanceStore((state) => state.update)
  const resetAll = useAppearanceStore((state) => state.resetAll)
  const presets = useAppearancePresetsStore((state) => state.presets)
  const addPreset = useAppearancePresetsStore((state) => state.addPreset)
  const removePreset = useAppearancePresetsStore((state) => state.removePreset)
  const [name, setName] = React.useState('')

  const applyPreset = (label: string, overrides: Partial<AppearanceConfig>) => {
    update(overrides)
    toast.success(t('presetApplied', { name: label }))
  }

  const onSave = () => {
    const trimmed = name.trim()
    const id = trimmed ? addPreset(trimmed, getAppearanceConfig()) : null
    if (!id) {
      toast.error(t('presetSaveFailed'))
      return
    }
    setName('')
    toast.success(t('presetSaved', { name: trimmed.slice(0, PRESET_NAME_MAX) }))
  }

  return (
    <SectionCard
      icon={Sparkles}
      title={t('presetsTitle')}
      desc={t('presetsDesc')}
      testId="appearance-presets"
    >
      <div className="space-y-2">
        <span className="text-body font-medium">{t('presetsBuiltinTitle')}</span>
        <div className="grid grid-cols-1 gap-2 min-[640px]:grid-cols-2">
          {BUILT_IN_APPEARANCE_PRESETS.map((preset) => (
            <div key={preset.id} className="flex flex-col gap-1.5 rounded-sm border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-body font-medium">{t(preset.nameKey)}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(t(preset.nameKey), preset.overrides)}
                  data-testid={`appearance-preset-apply-${preset.id}`}
                >
                  {t('presetApply')}
                </Button>
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">{t(preset.descKey)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-t pt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-body font-medium">{t('presetsCustomTitle')}</span>
          <span className="text-[11px] text-muted-foreground">
            {t('presetsLimitHint', { count: CUSTOM_PRESET_LIMIT })}
          </span>
        </div>

        {presets.length === 0 ? (
          <p className="text-[11px] leading-snug text-muted-foreground">{t('presetsEmpty')}</p>
        ) : (
          <ul className="space-y-1.5">
            {presets.map((preset) => (
              <li
                key={preset.id}
                className="flex items-center justify-between gap-2 rounded-sm border px-2.5 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-body" title={preset.name}>
                  {preset.name}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset.name, preset.overrides)}
                    data-testid={`appearance-preset-apply-custom-${preset.id}`}
                  >
                    {t('presetApply')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`${t('presetDelete')} ${preset.name}`}
                    onClick={() => {
                      if (!window.confirm(t('presetDeleteConfirm', { name: preset.name }))) return
                      removePreset(preset.id)
                      toast.success(t('presetDeleted'))
                    }}
                    data-testid={`appearance-preset-delete-${preset.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2 min-[640px]:flex-row">
          <Input
            value={name}
            maxLength={PRESET_NAME_MAX}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onSave()
            }}
            placeholder={t('presetNamePlaceholder')}
            aria-label={t('presetNamePlaceholder')}
            data-testid="appearance-preset-name"
            className="min-[640px]:flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={onSave}
            data-testid="appearance-preset-save"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t('presetSaveCurrent')}
          </Button>
        </div>
      </div>

      <div className="flex justify-end border-t pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (!window.confirm(t('presetsRestoreConfirm'))) return
            resetAll()
            toast.success(t('presetsRestored'))
          }}
          data-testid="appearance-preset-restore"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t('presetsRestoreDefault')}
        </Button>
      </div>
    </SectionCard>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
