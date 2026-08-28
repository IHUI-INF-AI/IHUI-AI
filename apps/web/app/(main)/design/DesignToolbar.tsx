'use client'

import type { Dispatch, RefObject, SetStateAction } from 'react'
import { useTranslations } from 'next-intl'
import { Tooltip } from '@/components/feedback'
import type { ExportFormat } from '@/lib/design/code-exporter'
import { RESPONSIVE_DEVICES } from '@/lib/design/responsive-devices'
import { DeviceIcon } from './DeviceIcon'

interface DesignToolbarProps {
  aiPrompt: string
  onAiPromptChange: (v: string) => void
  onAiGenerate: () => void
  aiGenerating: boolean
  previewName: string
  onPreviewNameChange: (v: string) => void
  onSavePreview: () => void
  saving: boolean
  exportMenuOpen: boolean
  setExportMenuOpen: Dispatch<SetStateAction<boolean>>
  onExport: (format: ExportFormat) => void
  exportRef: RefObject<HTMLDivElement | null>
  selectedDeviceId: string
  onSelectDevice: (id: string) => void
  customInputOpen: boolean
  customInputRef: RefObject<HTMLDivElement | null>
  customWidthInput: string
  onCustomWidthInputChange: (v: string) => void
  onApplyCustomWidth: () => void
  showDeviceFrame: boolean
  setShowDeviceFrame: Dispatch<SetStateAction<boolean>>
  guidesEnabled: boolean
  setGuidesEnabled: Dispatch<SetStateAction<boolean>>
  onOpenTemplates: () => void
}

export function DesignToolbar({
  aiPrompt,
  onAiPromptChange,
  onAiGenerate,
  aiGenerating,
  previewName,
  onPreviewNameChange,
  onSavePreview,
  saving,
  exportMenuOpen,
  setExportMenuOpen,
  onExport,
  exportRef,
  selectedDeviceId,
  onSelectDevice,
  customInputOpen,
  customInputRef,
  customWidthInput,
  onCustomWidthInputChange,
  onApplyCustomWidth,
  showDeviceFrame,
  setShowDeviceFrame,
  guidesEnabled,
  setGuidesEnabled,
  onOpenTemplates,
}: DesignToolbarProps) {
  const t = useTranslations()
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        gap: 8,
        flexWrap: 'wrap',
      }}
    >
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{t('design.title')}</h2>
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flex: 1,
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
        }}
      >
        <Tooltip content={t('design.templates.title')}>
          <button
            type="button"
            onClick={onOpenTemplates}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            aria-label={t('design.templates.title')}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="9" rx="1" />
              <rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="12" width="7" height="9" rx="1" />
              <rect x="3" y="16" width="7" height="5" rx="1" />
            </svg>
            <span>{t('design.templates.title')}</span>
          </button>
        </Tooltip>
        <input
          value={aiPrompt}
          onChange={(e) => onAiPromptChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onAiGenerate()
          }}
          placeholder={t('design.aiGenerate.placeholder')}
          disabled={aiGenerating}
          style={{ width: 240, fontSize: 12 }}
          aria-label={t('design.aiGenerate.button')}
        />
        <button type="button" onClick={onAiGenerate} disabled={aiGenerating || !aiPrompt.trim()}>
          {aiGenerating ? t('common.loading') : t('design.aiGenerate.button')}
        </button>
        <input
          value={previewName}
          onChange={(e) => onPreviewNameChange(e.target.value)}
          placeholder={t('design.previewNamePlaceholder')}
          style={{ width: 140, fontSize: 12 }}
          aria-label={t('design.previewName')}
        />
        <button type="button" onClick={onSavePreview} disabled={saving}>
          {saving ? t('common.loading') : t('design.savePreview')}
        </button>
        <div ref={exportRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setExportMenuOpen((v) => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            aria-label={t('design.export.exportButton')}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>{t('design.export.exportButton')}</span>
          </button>
          {exportMenuOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: 4,
                zIndex: 10,
                minWidth: 140,
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--card)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => onExport('react')}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '6px 10px',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: 'var(--text, inherit)',
                }}
              >
                {t('design.export.exportReact')}
              </button>
              <button
                type="button"
                onClick={() => onExport('vue')}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '6px 10px',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: 'var(--text, inherit)',
                }}
              >
                {t('design.export.exportVue')}
              </button>
              <button
                type="button"
                onClick={() => onExport('html')}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '6px 10px',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: 'var(--text, inherit)',
                }}
              >
                {t('design.export.exportHtml')}
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '0 6px' }}>
          {RESPONSIVE_DEVICES.map((device) => {
            const isLandscape = device.id === 'mobile-landscape' || device.id === 'tablet-landscape'
            const isSelected = selectedDeviceId === device.id
            const title =
              device.width > 0
                ? `${t(device.nameKey)} (${device.width}×${device.height})`
                : t(device.nameKey)
            return (
              <Tooltip key={device.id} content={title}>
                <button
                  type="button"
                  onClick={() => onSelectDevice(device.id)}
                  aria-label={title}
                  aria-pressed={isSelected}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 28,
                    padding: 0,
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: isSelected ? 'var(--accent-soft, rgba(0,0,0,0.06))' : 'transparent',
                    cursor: 'pointer',
                    color: 'var(--text, inherit)',
                  }}
                >
                  <DeviceIcon icon={device.icon} rotate={isLandscape} />
                </button>
              </Tooltip>
            )
          })}
          {customInputOpen && (
            <div
              ref={customInputRef}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <input
                type="number"
                value={customWidthInput}
                onChange={(e) => onCustomWidthInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onApplyCustomWidth()
                }}
                min={200}
                max={3840}
                placeholder={t('design.responsive.customWidth')}
                style={{ width: 80, fontSize: 12 }}
                aria-label={t('design.responsive.customWidth')}
              />
              <button
                type="button"
                onClick={onApplyCustomWidth}
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text, inherit)',
                }}
              >
                {t('design.responsive.apply')}
              </button>
            </div>
          )}
          <Tooltip content={t('design.responsive.deviceFrame')}>
            <button
              type="button"
              onClick={() => setShowDeviceFrame((v) => !v)}
              aria-label={t('design.responsive.deviceFrame')}
              aria-pressed={showDeviceFrame}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 28,
                padding: '0 8px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: showDeviceFrame
                  ? 'var(--accent-soft, rgba(0,0,0,0.06))'
                  : 'transparent',
                fontSize: 11,
                cursor: 'pointer',
                color: 'var(--text, inherit)',
              }}
            >
              {t('design.responsive.deviceFrame')}
            </button>
          </Tooltip>
        </div>
        <Tooltip
          content={guidesEnabled ? t('design.layout.hideGuides') : t('design.layout.showGuides')}
        >
          <button
            type="button"
            onClick={() => setGuidesEnabled((v) => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            aria-label={
              guidesEnabled ? t('design.layout.hideGuides') : t('design.layout.showGuides')
            }
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
            <span>
              {guidesEnabled ? t('design.layout.hideGuides') : t('design.layout.showGuides')}
            </span>
          </button>
        </Tooltip>
      </div>
    </header>
  )
}
