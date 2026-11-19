// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * MessageStyleMenu — 单条消息样式覆盖(2026-11-15 v3)
 *
 * 覆盖只落在 appearance-scope store 的 messages[messageId],
 * 由 MessageItem 编译成消息级 CSS 变量(--message-*)包在正文外层。
 * 「继承」= 删除该字段,回退到工作区/全局作用域,不是写一个默认值。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Palette, RotateCcw } from 'lucide-react'

import {
  MESSAGE_CODE_FONT_SIZE_MAX,
  MESSAGE_CODE_FONT_SIZE_MIN,
  MESSAGE_FONT_SCALE_MAX,
  MESSAGE_FONT_SCALE_MIN,
  useAppearanceScopeStore,
  type MessageStyleOverride,
} from '@/stores/appearance-scope'

const SELECT_CLASS =
  'h-7 rounded-sm border bg-transparent px-1.5 text-[11px] text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2 text-[11px]">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

export function MessageStyleMenu({ messageId }: { messageId: string }) {
  const t = useTranslations('appearanceSettings')
  const override = useAppearanceScopeStore((state) => state.messages[messageId])
  const setMessageOverride = useAppearanceScopeStore((state) => state.setMessageOverride)
  const clearMessageField = useAppearanceScopeStore((state) => state.clearMessageField)
  const clearMessageOverride = useAppearanceScopeStore((state) => state.clearMessageOverride)

  const fontScalePercent = Math.round((override?.fontScale ?? 1) * 100)

  const setField = <K extends keyof MessageStyleOverride>(
    key: K,
    value: MessageStyleOverride[K] | undefined,
  ) => {
    if (value === undefined) clearMessageField(messageId, key)
    else setMessageOverride(messageId, { [key]: value } as MessageStyleOverride)
  }

  return (
    <details className="relative" data-testid={`message-style-${messageId}`}>
      <summary
        aria-label={t('messageStyleTitle')}
        title={t('messageStyleTitle')}
        className="inline-flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground [&::-webkit-details-marker]:hidden"
      >
        <Palette className="h-4 w-4" aria-hidden="true" />
      </summary>

      <div className="absolute right-0 top-9 z-50 w-64 space-y-2 rounded-md border border-stroke-strong bg-popover p-2.5 text-popover-foreground shadow-elevation-md">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium">{t('messageStyleTitle')}</span>
          <button
            type="button"
            onClick={() => clearMessageOverride(messageId)}
            className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            data-testid={`message-style-reset-${messageId}`}
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            {t('resetMessageStyle')}
          </button>
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground">{t('messageStyleHint')}</p>

        <Row label={t('messageStyleFontSize')}>
          <span className="flex items-center gap-1.5">
            <input
              type="range"
              min={MESSAGE_FONT_SCALE_MIN * 100}
              max={MESSAGE_FONT_SCALE_MAX * 100}
              step={5}
              value={fontScalePercent}
              onChange={(event) => {
                const percent = Number(event.target.value)
                setField('fontScale', percent === 100 ? undefined : percent / 100)
              }}
              aria-label={t('messageStyleFontSize')}
              className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-[var(--color-primary)]"
            />
            <span className="w-9 text-right tabular-nums">{fontScalePercent}%</span>
          </span>
        </Row>

        <Row label={t('messageStyleFont')}>
          <select
            value={override?.fontFamily ?? 'inherit'}
            onChange={(event) =>
              setField(
                'fontFamily',
                event.target.value === 'inherit'
                  ? undefined
                  : (event.target.value as NonNullable<MessageStyleOverride['fontFamily']>),
              )
            }
            aria-label={t('messageStyleFont')}
            className={SELECT_CLASS}
          >
            <option value="inherit">{t('inheritOption')}</option>
            <option value="system">{t('fontFamilySystem')}</option>
            <option value="sans">{t('fontFamilySans')}</option>
            <option value="serif">{t('fontFamilySerif')}</option>
            <option value="mono">{t('fontFamilyMono')}</option>
            <option value="legibility">{t('legibilityFont')}</option>
          </select>
        </Row>

        <Row label={t('messageStyleLineHeight')}>
          <select
            value={override?.lineHeight ?? 'inherit'}
            onChange={(event) =>
              setField(
                'lineHeight',
                event.target.value === 'inherit'
                  ? undefined
                  : (event.target.value as NonNullable<MessageStyleOverride['lineHeight']>),
              )
            }
            aria-label={t('messageStyleLineHeight')}
            className={SELECT_CLASS}
          >
            <option value="inherit">{t('inheritOption')}</option>
            <option value="compact">{t('lineHeightCompact')}</option>
            <option value="normal">{t('lineHeightNormal')}</option>
            <option value="relaxed">{t('lineHeightRelaxed')}</option>
          </select>
        </Row>

        <Row label={t('messageStyleLetterSpacing')}>
          <select
            value={override?.letterSpacing ?? 'inherit'}
            onChange={(event) =>
              setField(
                'letterSpacing',
                event.target.value === 'inherit'
                  ? undefined
                  : (event.target.value as NonNullable<MessageStyleOverride['letterSpacing']>),
              )
            }
            aria-label={t('messageStyleLetterSpacing')}
            className={SELECT_CLASS}
          >
            <option value="inherit">{t('inheritOption')}</option>
            <option value="tight">{t('letterSpacingTight')}</option>
            <option value="normal">{t('letterSpacingNormal')}</option>
            <option value="wide">{t('letterSpacingWide')}</option>
          </select>
        </Row>

        <Row label={t('messageStyleAlign')}>
          <select
            value={override?.textAlign ?? 'inherit'}
            onChange={(event) =>
              setField(
                'textAlign',
                event.target.value === 'inherit'
                  ? undefined
                  : (event.target.value as NonNullable<MessageStyleOverride['textAlign']>),
              )
            }
            aria-label={t('messageStyleAlign')}
            className={SELECT_CLASS}
          >
            <option value="inherit">{t('inheritOption')}</option>
            <option value="left">{t('alignLeft')}</option>
            <option value="justify">{t('alignJustify')}</option>
          </select>
        </Row>

        <Row label={t('messageStyleCodeSize')}>
          <select
            value={override?.codeFontSize ?? 'inherit'}
            onChange={(event) =>
              setField(
                'codeFontSize',
                event.target.value === 'inherit' ? undefined : Number(event.target.value),
              )
            }
            aria-label={t('messageStyleCodeSize')}
            className={SELECT_CLASS}
          >
            <option value="inherit">{t('inheritOption')}</option>
            {Array.from(
              { length: MESSAGE_CODE_FONT_SIZE_MAX - MESSAGE_CODE_FONT_SIZE_MIN + 1 },
              (_, index) => MESSAGE_CODE_FONT_SIZE_MIN + index,
            ).map((size) => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
          </select>
        </Row>
      </div>
    </details>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
