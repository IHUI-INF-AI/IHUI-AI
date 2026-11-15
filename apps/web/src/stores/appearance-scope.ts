// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 单条消息外观作用域 store(「外观 v3」后半段)。
 *
 * 立因(2026-11-15):`MessageItem` 在 `外观 v3` 那一批里就 import 了本模块的
 * `useAppearanceScopeStore` / `messageStyleVars`,但本文件当时没随提交入库 ⇒
 * web 的 typecheck 与 build 结构性失败(TS2307 找不到模块),连带把 pre-push 的
 * typecheck 腿拖成 20 分钟也收敛不了的红。本次按 `components/ai/markdown-stream.tsx`
 * 里**已经在消费的变量名**倒推契约补齐实现,而不是重新设计一套。
 *
 * 作用域分层(与 i18n 文案 `appearanceSettings.messageStylesHint` 的口径一致):
 *   - 全局:`stores/appearance-settings.ts`(用户级偏好);
 *   - 单条消息:**本 store**,按 message id 记覆盖,只产出 `--message-*` 增量变量。
 *
 * 覆盖只做加法:消费端写法恒为 `var(--message-x, var(--chat-x, 回退值))`,
 * 未覆盖的字段自动落回全局档 ⇒ 本 store **不复制**全局值,也就不会出现
 * 「改了全局、单条消息还停在旧值」的双写漂移。
 *
 * 消费契约(**唯一真相源是 markdown-stream.tsx;改那边必须同步改这里**):
 *   --message-font-multiplier  字号倍率(基准 15px,与消费端 `calc(15px * ...)` 对齐)
 *   --message-line-height      行高
 *   --message-letter-spacing   字距
 *   --message-font-family      字体族
 *   --message-code-font-size   代码块字号
 *   text-align(普通内联样式)   对齐 —— text-align 可继承,由容器向下透传给 markdown 段落
 */

import type { CSSProperties } from 'react'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  CODE_FONT_SIZE_MAX,
  CODE_FONT_SIZE_MIN,
  type FontFamilyMode,
  type LetterSpacingMode,
  type LineHeightMode,
  type TextAlignMode,
} from './appearance-settings'
import { createPersistConfig } from './persist-helpers'

/* ============================== 常量 ============================== */

/** 消费端基准字号(px)。markdown-stream 写死 `calc(15px * ...)`,这里必须同步。 */
export const MESSAGE_BASE_FONT_SIZE = 15

/** 单条消息字号可选区间(px)。比全局档更宽:单条微调常用来临时放大某段回答。 */
export const MESSAGE_FONT_SIZE_MIN = 12
export const MESSAGE_FONT_SIZE_MAX = 22

/** 覆盖条数上限。消息 id 是短生命周期的,不设上限会让 localStorage 无界增长。 */
export const MESSAGE_OVERRIDE_LIMIT = 500

/* ============================== 类型 ============================== */

/** 单条消息的样式覆盖。全部可缺省:缺省 = 继承(不产出该变量)。 */
export interface MessageStyleOverride {
  /** 字号(px),产出为 `--message-font-multiplier` */
  fontSize?: number
  /** 字体族档 */
  fontFamily?: FontFamilyMode
  /** 行高档 */
  lineHeight?: LineHeightMode
  /** 字距档 */
  letterSpacing?: LetterSpacingMode
  /** 对齐档(text-align) */
  align?: TextAlignMode
  /** 代码块字号(px) */
  codeFontSize?: number
}

/* ============================ 档位映射 ============================ */
/*
 * 一律用 `Record<Union, ...>` 而不是数组:
 * 上游枚举一旦加档,TS 会在这里当场报缺键 ⇒ 强制同步,不会静默漏一个档。
 */

const LINE_HEIGHT_VARS: Record<LineHeightMode, string> = {
  compact: '1.45',
  normal: '1.65',
  relaxed: '1.9',
}

const LETTER_SPACING_VARS: Record<LetterSpacingMode, string> = {
  tight: '-0.01em',
  normal: 'normal',
  wide: '0.02em',
}

/** `system` 档 = 什么都不产出(继承宿主),其余走 design-tokens 的字体令牌。 */
const FONT_FAMILY_VARS: Record<FontFamilyMode, string | undefined> = {
  system: undefined,
  sans: 'var(--font-sans)',
  serif: 'var(--font-serif)',
  mono: 'var(--font-mono)',
}

const TEXT_ALIGN_VARS: Record<TextAlignMode, string> = {
  left: 'left',
  justify: 'justify',
}

/* ============================== 净化 ============================== */

function clampInt(raw: unknown, min: number, max: number): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined
  return Math.min(max, Math.max(min, Math.round(raw)))
}

function pickEnum<T extends string>(raw: unknown, table: Record<T, unknown>): T | undefined {
  if (typeof raw !== 'string') return undefined
  return Object.hasOwn(table, raw) ? (raw as T) : undefined
}

/**
 * 把任意来路(盘上旧快照 / 导入文件)的覆盖对象收敛成合法形状。
 *
 * 幂等:对已净化的对象再调一次结果逐字相同,所以写入口与读出口可以各调一次
 * (写入防脏数据落盘,读取防盘上旧数据带崩渲染)。
 */
export function sanitizeMessageStyleOverride(raw: unknown): MessageStyleOverride {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const out: MessageStyleOverride = {}
  const fontSize = clampInt(r.fontSize, MESSAGE_FONT_SIZE_MIN, MESSAGE_FONT_SIZE_MAX)
  if (fontSize !== undefined) out.fontSize = fontSize
  const codeFontSize = clampInt(r.codeFontSize, CODE_FONT_SIZE_MIN, CODE_FONT_SIZE_MAX)
  if (codeFontSize !== undefined) out.codeFontSize = codeFontSize
  const fontFamily = pickEnum(r.fontFamily, FONT_FAMILY_VARS)
  if (fontFamily) out.fontFamily = fontFamily
  const lineHeight = pickEnum(r.lineHeight, LINE_HEIGHT_VARS)
  if (lineHeight) out.lineHeight = lineHeight
  const letterSpacing = pickEnum(r.letterSpacing, LETTER_SPACING_VARS)
  if (letterSpacing) out.letterSpacing = letterSpacing
  const align = pickEnum(r.align, TEXT_ALIGN_VARS)
  if (align) out.align = align
  return out
}

/* ========================== 变量生成(纯函数) ========================== */

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

/**
 * 覆盖对象 → 容器内联样式。
 *
 * 空覆盖返回 `{}`(而非 undefined):调用方 `style={messageVars}` 任何情况下都是
 * 合法入参,不必在每个调用点写一次 `?? undefined`。
 */
export function messageStyleVars(override?: MessageStyleOverride): CSSProperties {
  const o = sanitizeMessageStyleOverride(override)
  const vars: Record<string, string> = {}
  if (o.fontSize !== undefined) {
    vars['--message-font-multiplier'] = String(round4(o.fontSize / MESSAGE_BASE_FONT_SIZE))
  }
  if (o.lineHeight) vars['--message-line-height'] = LINE_HEIGHT_VARS[o.lineHeight]
  if (o.letterSpacing) vars['--message-letter-spacing'] = LETTER_SPACING_VARS[o.letterSpacing]
  if (o.fontFamily) {
    const family = FONT_FAMILY_VARS[o.fontFamily]
    if (family) vars['--message-font-family'] = family
  }
  if (o.codeFontSize !== undefined) vars['--message-code-font-size'] = `${o.codeFontSize}px`
  if (o.align) vars.textAlign = TEXT_ALIGN_VARS[o.align]
  // CSS 自定义属性不在 React.CSSProperties 的键里,只能经 unknown 转一次
  return vars as unknown as CSSProperties
}

/* ============================== store ============================== */

export interface AppearanceScopeState {
  /** message id → 覆盖。缺键 = 该消息完全继承全局档 */
  messages: Record<string, MessageStyleOverride>
  /** 写入顺序(最近在末尾),仅用于上限淘汰,不是业务数据 */
  order: string[]
  /** 合并式写入:patch 里缺省的字段保留原值 */
  setMessageStyle: (messageId: string, patch: MessageStyleOverride) => void
  /** 清空单条消息的覆盖(回到继承) */
  clearMessageStyle: (messageId: string) => void
  /** 清空全部单条消息覆盖(设置页「清除全部单条消息样式」的落点) */
  clearAllMessageStyles: () => void
}

export const useAppearanceScopeStore = create<AppearanceScopeState>()(
  persist(
    (set) => ({
      messages: {},
      order: [],
      setMessageStyle: (messageId, patch) =>
        set((s) => {
          if (!messageId) return {}
          const merged = sanitizeMessageStyleOverride({ ...s.messages[messageId], ...patch })
          const messages = { ...s.messages }
          const order = s.order.filter((id) => id !== messageId)
          if (Object.keys(merged).length === 0) {
            // 把每个字段都调回「继承」等价于没有覆盖:不留空对象占位
            delete messages[messageId]
          } else {
            messages[messageId] = merged
            order.push(messageId)
          }
          while (order.length > MESSAGE_OVERRIDE_LIMIT) {
            const evicted = order.shift()
            if (evicted) delete messages[evicted]
          }
          return { messages, order }
        }),
      clearMessageStyle: (messageId) =>
        set((s) => {
          if (!s.messages[messageId]) return {}
          const messages = { ...s.messages }
          delete messages[messageId]
          return { messages, order: s.order.filter((id) => id !== messageId) }
        }),
      clearAllMessageStyles: () => set({ messages: {}, order: [] }),
    }),
    createPersistConfig<AppearanceScopeState>('ihui-appearance-scope', (s) => ({
      messages: s.messages,
      order: s.order,
    })),
  ),
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
