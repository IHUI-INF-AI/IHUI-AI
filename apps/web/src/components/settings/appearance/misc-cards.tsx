// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * AccessibilityCard / DataCard — 无障碍与配置管理(2026-11-15 立)
 *
 * - 无障碍开关只改 data-* 属性,由 globals.css 的单一选择器组生效;
 * - 配置导入导出只处理 ihui-appearance-settings 这一份配置,坏文件按字段级回退,
 *   不整包失败(见 store.sanitizeConfig)。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Accessibility, Download, HardDriveDownload, RotateCcw, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@ihui/ui-react'
import { useAppearanceStore } from '@/stores/appearance-settings'
import { useAppearancePresetsStore } from '@/stores/appearance-presets'
import { useAppearanceScopeStore } from '@/stores/appearance-scope'
import { useCodeBlockPrefsStore } from '@/stores/code-block-prefs'
import { writeFoldPolicyMode } from '@/components/chat/message-list/fold-policy'

import { OptionGrid, SectionCard, ToggleField } from './controls'

/**
 * 本机字体探测。
 *
 * 不用 document.fonts.check:实测 Chromium 对任意不存在的字体名也返回 true
 * (16px OpenDyslexic 与 16px __IHUI_NoSuchFont__ 同为 true),无法区分"装了"和"没装"。
 * FontFace + local() 在字体缺失时 load() 会 reject;老浏览器再退回画布测宽。
 */
async function detectLocalFont(family: string): Promise<boolean> {
  if (typeof document === 'undefined') return false
  const FontFaceCtor = (globalThis as { FontFace?: typeof FontFace }).FontFace
  if (typeof FontFaceCtor === 'function') {
    try {
      const probe = new FontFaceCtor('__ihui-font-probe__', `local("${family}")`)
      await probe.load()
      return true
    } catch {
      return false
    }
  }
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return false
  const sample = 'mmmmmmmmmmlliWWW1234567890@#%&'
  const measure = (font: string) => {
    context.font = `72px ${font}`
    return context.measureText(sample).width
  }
  return ['monospace', 'serif', 'sans-serif'].some((fallback) => {
    return Math.abs(measure(`"${family}", ${fallback}`) - measure(fallback)) > 0.1
  })
}

export function AccessibilityCard() {
  const t = useTranslations('appearanceSettings')
  const config = useAppearanceStore()
  // 本机是否装了 OpenDyslexic:装了优先本机字体,否则落到内置 Lexend。
  const [hasOpenDyslexic, setHasOpenDyslexic] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    if (!config.legibilityFont) {
      setHasOpenDyslexic(null)
      return
    }
    let cancelled = false
    void detectLocalFont('OpenDyslexic').then((available) => {
      if (!cancelled) setHasOpenDyslexic(available)
    })
    return () => {
      cancelled = true
    }
  }, [config.legibilityFont])

  return (
    <SectionCard
      icon={Accessibility}
      title={t('accessibilityTitle')}
      testId="appearance-accessibility"
    >
      <ToggleField
        label={t('reduceMotion')}
        hint={t('reduceMotionHint')}
        checked={config.reduceMotion}
        onCheckedChange={(reduceMotion) => config.update({ reduceMotion })}
        testId="appearance-reduce-motion"
      />
      <ToggleField
        label={t('highContrast')}
        hint={t('highContrastHint')}
        checked={config.highContrast}
        onCheckedChange={(highContrast) => config.update({ highContrast })}
        testId="appearance-high-contrast"
      />
      <ToggleField
        label={t('linkUnderline')}
        checked={config.linkUnderline}
        onCheckedChange={(linkUnderline) => config.update({ linkUnderline })}
        testId="appearance-link-underline"
      />
      <ToggleField
        label={t('focusRing')}
        hint={t('focusRingHint')}
        checked={config.focusRing}
        onCheckedChange={(focusRing) => config.update({ focusRing })}
        testId="appearance-focus-ring"
      />
      <ToggleField
        label={t('grayscale')}
        hint={t('grayscaleHint')}
        checked={config.grayscale}
        onCheckedChange={(grayscale) =>
          config.update({ grayscale, ...(grayscale ? { colorVision: 'none' as const } : {}) })
        }
        testId="appearance-grayscale"
      />
      <div className="space-y-1.5">
        <span className="text-body font-medium">{t('colorVision')}</span>
        <p className="text-[11px] leading-snug text-muted-foreground">{t('colorVisionHint')}</p>
        <OptionGrid
          value={config.colorVision}
          onChange={(colorVision) =>
            config.update({
              colorVision,
              ...(colorVision !== 'none' ? { grayscale: false } : {}),
            })
          }
          ariaLabel={t('colorVision')}
          columns={5}
          testIdPrefix="appearance-color-vision"
          options={[
            { value: 'none', label: t('colorVisionNone') },
            { value: 'protanopia', label: t('colorVisionProtanopia') },
            { value: 'deuteranopia', label: t('colorVisionDeuteranopia') },
            { value: 'tritanopia', label: t('colorVisionTritanopia') },
            { value: 'achromatopsia', label: t('colorVisionAchromatopsia') },
          ]}
        />
      </div>
      <ToggleField
        label={t('legibilityFont')}
        hint={t('legibilityFontHint')}
        checked={config.legibilityFont}
        onCheckedChange={(legibilityFont) => config.update({ legibilityFont })}
        testId="appearance-legibility-font"
      />
      {config.legibilityFont && hasOpenDyslexic !== null ? (
        <p
          className="-mt-2 text-[11px] leading-snug text-muted-foreground"
          data-testid="appearance-legibility-status"
        >
          {t(hasOpenDyslexic ? 'legibilityFontDetected' : 'legibilityFontFallback')}
        </p>
      ) : null}
      <ToggleField
        label={t('mobileFontBoost')}
        hint={t('mobileFontBoostHint')}
        checked={config.mobileFontBoost}
        onCheckedChange={(mobileFontBoost) => config.update({ mobileFontBoost })}
        testId="appearance-mobile-font-boost"
      />
      <div className="space-y-1.5 border-t pt-3">
        <span className="text-body font-medium">{t('shortcutsTitle')}</span>
        <ul className="space-y-1 text-label text-muted-foreground">
          <li className="flex items-center justify-between gap-3">
            <span>{t('shortcutUiZoom')}</span>
            <kbd className="shrink-0 rounded-xs border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
              Ctrl + = / - / 0
            </kbd>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>{t('shortcutChatZoom')}</span>
            <kbd className="shrink-0 rounded-xs border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
              Ctrl + Shift + = / -
            </kbd>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>{t('shortcutResetAll')}</span>
            <kbd className="shrink-0 rounded-xs border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
              Ctrl + Shift + 0
            </kbd>
          </li>
        </ul>
      </div>
    </SectionCard>
  )
}

export function DataCard() {
  const t = useTranslations('appearanceSettings')
  const exportConfig = useAppearanceStore((s) => s.exportConfig)
  const importConfig = useAppearanceStore((s) => s.importConfig)
  const resetAll = useAppearanceStore((s) => s.resetAll)
  const applySnapshot = useAppearanceScopeStore((s) => s.applySnapshot)
  const resetScope = useAppearanceScopeStore((s) => s.resetScope)
  const exportPresets = useAppearancePresetsStore((s) => s.exportPresets)
  const applyPresets = useAppearancePresetsStore((s) => s.applyPresets)
  // 代码换行与折叠策略住各自 store(单一源),恢复默认时一并归零,
  // 避免「点了恢复默认,但代码还在换行 / 步骤还强制展开」的割裂。
  const setCodeWrap = useCodeBlockPrefsStore((s) => s.setWrap)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const onExport = () => {
    // v3:导出整包 = 全局配置 + 工作区/消息作用域 + 自定义预设,单文件可完整迁移
    const payload = {
      version: 3,
      appearance: JSON.parse(exportConfig()) as unknown,
      scope: useAppearanceScopeStore.getState().exportSnapshot(),
      presets: exportPresets(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'ihui-appearance.json'
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success(t('exportSuccess'))
  }

  const onImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const text = await file.text()
    try {
      const parsed: unknown = JSON.parse(text)
      const parsedRecord =
        typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null
      // v3 新增 presets;v2 整包仍可导入(没有 presets 时保留本机预设)
      const isBundle =
        parsedRecord !== null &&
        (parsedRecord.version === 2 || parsedRecord.version === 3) &&
        'appearance' in parsedRecord
      if (isBundle && parsedRecord) {
        const bundle = parsed as { appearance: unknown; scope?: unknown; presets?: unknown }
        if (!importConfig(JSON.stringify(bundle.appearance))) {
          toast.error(t('importFailed'))
          return
        }
        if (bundle.scope) applySnapshot(bundle.scope)
        if (parsedRecord.version === 3 && bundle.presets !== undefined) {
          applyPresets(bundle.presets)
        }
        toast.success(t('importSuccess'))
        return
      }
    } catch {
      // 落到兼容分支:旧版单配置 JSON
    }
    if (importConfig(text)) toast.success(t('importSuccess'))
    else toast.error(t('importFailed'))
  }

  return (
    <SectionCard icon={HardDriveDownload} title={t('dataTitle')} testId="appearance-data">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onExport} data-testid="appearance-export">
          <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t('exportConfig')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          data-testid="appearance-import"
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t('importConfig')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (window.confirm(t('resetConfirm'))) {
              resetAll()
              resetScope()
              setCodeWrap(false)
              writeFoldPolicyMode('auto')
              toast.success(t('resetDone'))
            }
          }}
          data-testid="appearance-reset"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t('resetConfig')}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onImportFile}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
    </SectionCard>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
