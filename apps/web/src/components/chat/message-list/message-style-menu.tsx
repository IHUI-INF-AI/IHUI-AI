// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 单条消息样式菜单(「外观 v3」)。
 *
 * **交互与 `MessageVersionMenu`(同目录)同构** —— 图标触发 + PortalPanel 下拉,
 * 不另起第二套弹层语言:用户在消息气泡上看到的还是同一个位置的「这一条的自定义」。
 *
 * 数据面只有一个写入口:`useAppearanceScopeStore.setMessageStyle`。菜单不做本地
 * 草稿态 —— 点一下即生效(所见即所得),面板停留不关闭,方便连续调几档对比。
 *
 * 文案全部走 `appearanceSettings` 命名空间既有键(五语言同批已入库),本文件
 * **不硬编码任何自然语言**;行内数值(1.45 / -0.01em / 13)与字体族的「Aa」预览
 * 本身语言中立,不额外增键。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlignJustify, AlignLeft, Paintbrush, RotateCcw } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { PortalPanel } from '@/components/feedback/portal-panel'
import {
  CODE_FONT_SIZE_MAX,
  CODE_FONT_SIZE_MIN,
  type FontFamilyMode,
  type LetterSpacingMode,
  type LineHeightMode,
  type TextAlignMode,
} from '@/stores/appearance-settings'
import {
  MESSAGE_FONT_SIZE_MAX,
  MESSAGE_FONT_SIZE_MIN,
  useAppearanceScopeStore,
  type MessageStyleOverride,
} from '@/stores/appearance-scope'

export interface MessageStyleMenuProps {
  messageId: string
}

/* ============================ 候选档位 ============================ */
/*
 * 只列「常调到」的几档,不是全区间:这是单条微调,不是设置页的精细面板。
 * 上下界从 store 导入,菜单永远出不了合法范围。
 */

const FONT_SIZE_STEPS: readonly number[] = [13, 15, 17, 19, 21].filter(
  (n) => n >= MESSAGE_FONT_SIZE_MIN && n <= MESSAGE_FONT_SIZE_MAX,
)

const CODE_SIZE_STEPS: readonly number[] = [13, 15, 17, 18].filter(
  (n) => n >= CODE_FONT_SIZE_MIN && n <= CODE_FONT_SIZE_MAX,
)

const LINE_HEIGHT_STEPS: readonly { value: LineHeightMode; label: string }[] = [
  { value: 'compact', label: '1.45' },
  { value: 'normal', label: '1.65' },
  { value: 'relaxed', label: '1.9' },
]

const LETTER_SPACING_STEPS: readonly { value: LetterSpacingMode; label: string }[] = [
  { value: 'tight', label: '-0.01em' },
  { value: 'normal', label: '0' },
  { value: 'wide', label: '0.02em' },
]

/** 「Aa」按各自字体族真渲染 —— 选字体这件事,看一眼比读名字快 */
const FONT_FAMILY_STEPS: readonly { value: FontFamilyMode; style: React.CSSProperties }[] = [
  { value: 'system', style: { fontFamily: 'inherit' } },
  { value: 'sans', style: { fontFamily: 'var(--font-sans)' } },
  { value: 'serif', style: { fontFamily: 'var(--font-serif)' } },
  { value: 'mono', style: { fontFamily: 'var(--font-mono)' } },
]

const ALIGN_STEPS: readonly { value: TextAlignMode; icon: typeof AlignLeft }[] = [
  { value: 'left', icon: AlignLeft },
  { value: 'justify', icon: AlignJustify },
]

/* ============================== 原子件 ============================== */

interface RowItem {
  id: string
  /** 无障碍名与悬浮提示(数值或档名) */
  label: string
  content?: React.ReactNode
  style?: React.CSSProperties
}

function OptionButton({
  active,
  onClick,
  label,
  testId,
  style,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  testId: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      data-testid={testId}
      style={style}
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-sm px-1 text-[10px] leading-none',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

/** 一行档位:第一枚恒为「继承」(= 清掉该字段),其后为候选档 */
function Row({
  label,
  items,
  activeId,
  onPick,
  testIdPrefix,
}: {
  label: string
  items: readonly RowItem[]
  /** 当前档 id;undefined = 继承中 */
  activeId: string | undefined
  onPick: (id: string | null) => void
  testIdPrefix: string
}) {
  const t = useTranslations('appearanceSettings')
  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className="w-14 shrink-0 pt-1 text-[10px] leading-none text-muted-foreground">
        {label}
      </span>
      <div
        className="flex min-w-0 flex-1 flex-wrap items-center gap-1"
        role="group"
        aria-label={label}
      >
        <OptionButton
          active={activeId === undefined}
          onClick={() => onPick(null)}
          label={t('inheritOption')}
          testId={`${testIdPrefix}-inherit`}
        >
          {t('inheritOption')}
        </OptionButton>
        {items.map((it) => (
          <OptionButton
            key={it.id}
            active={activeId === it.id}
            onClick={() => onPick(it.id)}
            label={it.label}
            testId={`${testIdPrefix}-${it.id}`}
            {...(it.style ? { style: it.style } : {})}
          >
            {it.content ?? it.label}
          </OptionButton>
        ))}
      </div>
    </div>
  )
}

/* ============================== 宿主 ============================== */

export function MessageStyleMenu({ messageId }: MessageStyleMenuProps) {
  const t = useTranslations('appearanceSettings')
  const override = useAppearanceScopeStore((s) => s.messages[messageId])
  const setMessageStyle = useAppearanceScopeStore((s) => s.setMessageStyle)
  const clearMessageStyle = useAppearanceScopeStore((s) => s.clearMessageStyle)
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)

  const dirty = !!override && Object.keys(override).length > 0

  /** 写一个字段;`undefined` = 该字段回到继承 */
  const patch = React.useCallback(
    (next: MessageStyleOverride) => setMessageStyle(messageId, next),
    [messageId, setMessageStyle],
  )

  return (
    <div ref={rootRef} className="relative">
      <Tooltip content={t('messageStyleTitle')} side="top">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={t('messageStyleTitle')}
          aria-expanded={open}
          data-testid={`message-style-menu-${messageId}`}
          className={cn(
            'inline-flex h-6 items-center gap-0.5 rounded-sm px-1.5 text-[11px]',
            dirty
              ? 'text-primary hover:bg-muted/60'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          )}
        >
          <Paintbrush className="h-3.5 w-3.5" aria-hidden />
          {dirty && <span aria-hidden>•</span>}
        </button>
      </Tooltip>
      <PortalPanel
        open={open}
        anchorRef={rootRef}
        onClose={() => setOpen(false)}
        side="top"
        align="start"
        gap={4}
        className="w-72 rounded-xl border border-stroke-subtle bg-popover p-2 shadow-elevation-lg"
      >
        <p className="px-1 text-[10px] font-medium text-muted-foreground">
          {t('messageStyleTitle')}
        </p>
        <p className="px-1 pb-1 text-[10px] leading-snug text-muted-foreground/70">
          {t('messageStyleHint')}
        </p>

        <Row
          label={t('messageStyleFontSize')}
          testIdPrefix={`message-style-size-${messageId}`}
          activeId={override?.fontSize !== undefined ? String(override.fontSize) : undefined}
          items={FONT_SIZE_STEPS.map((n) => ({ id: String(n), label: String(n) }))}
          onPick={(id) => patch({ fontSize: id === null ? undefined : Number(id) })}
        />
        <Row
          label={t('messageStyleFont')}
          testIdPrefix={`message-style-font-${messageId}`}
          activeId={override?.fontFamily}
          items={FONT_FAMILY_STEPS.map((f) => ({
            id: f.value,
            label: f.value,
            style: f.style,
            content: <span style={f.style}>Aa</span>,
          }))}
          onPick={(id) => patch({ fontFamily: id === null ? undefined : (id as FontFamilyMode) })}
        />
        <Row
          label={t('messageStyleLineHeight')}
          testIdPrefix={`message-style-lh-${messageId}`}
          activeId={override?.lineHeight}
          items={LINE_HEIGHT_STEPS.map((s) => ({ id: s.value, label: s.label }))}
          onPick={(id) => patch({ lineHeight: id === null ? undefined : (id as LineHeightMode) })}
        />
        <Row
          label={t('messageStyleLetterSpacing')}
          testIdPrefix={`message-style-ls-${messageId}`}
          activeId={override?.letterSpacing}
          items={LETTER_SPACING_STEPS.map((s) => ({ id: s.value, label: s.label }))}
          onPick={(id) =>
            patch({ letterSpacing: id === null ? undefined : (id as LetterSpacingMode) })
          }
        />
        <Row
          label={t('messageStyleAlign')}
          testIdPrefix={`message-style-align-${messageId}`}
          activeId={override?.align}
          items={ALIGN_STEPS.map((a) => {
            const Icon = a.icon
            return {
              id: a.value,
              label: a.value,
              content: <Icon className="h-3 w-3" aria-hidden />,
            }
          })}
          onPick={(id) => patch({ align: id === null ? undefined : (id as TextAlignMode) })}
        />
        <Row
          label={t('messageStyleCodeSize')}
          testIdPrefix={`message-style-code-${messageId}`}
          activeId={
            override?.codeFontSize !== undefined ? String(override.codeFontSize) : undefined
          }
          items={CODE_SIZE_STEPS.map((n) => ({ id: String(n), label: String(n) }))}
          onPick={(id) => patch({ codeFontSize: id === null ? undefined : Number(id) })}
        />

        <button
          type="button"
          onClick={() => clearMessageStyle(messageId)}
          disabled={!dirty}
          data-testid={`message-style-reset-${messageId}`}
          className="mt-1 inline-flex h-6 w-full items-center justify-center gap-1 rounded-sm bg-muted/60 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-muted/60"
        >
          <RotateCcw className="h-3 w-3" aria-hidden />
          {t('resetMessageStyle')}
        </button>
      </PortalPanel>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
