// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui/i18n ICU 子集解释器 — 让非 web 端(miniapp-taro / mobile-rn / cli / extension / api)
// 与 web(next-intl → intl-messageformat)渲染出同一结果。只覆盖对话流措辞实际需要的四形:
// plural / select / selectordinal / number,外加既有的 {name} 与 {{name}} 插值。

import type { IcuFormatOptions } from './types'

const ICU_ARG_RE = /\{\s*[\w$]+\s*,\s*(?:plural|select|selectordinal|number)\b/u

/** 快速判定是否需要走 ICU 解析(不含 ICU 的字符串保持原插值路径,零行为变化) */
export function hasIcuSyntax(text: string): boolean {
  return ICU_ARG_RE.test(text)
}

type Params = Record<string, string | number>

interface Ctx {
  params: Params
  locale: string
}

function matchBrace(text: string, start: number): number {
  let depth = 0
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** 在 depth=0 处找下一个分隔符,返回下标;找不到返回 -1 */
function indexOfTopLevel(text: string, from: number, needle: string): number {
  let depth = 0
  for (let i = from; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') depth++
    else if (ch === '}') depth--
    else if (ch === needle && depth === 0) return i
  }
  return -1
}

function toNumber(value: string | number | undefined): number | null {
  if (value === undefined) return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

type NumberStyle = Intl.NumberFormatOptions['style']

const NUMBER_STYLES = new Set<NumberStyle>(['decimal', 'percent', 'currency', 'unit'])

function formatNumber(value: number, locale: string, style?: NumberStyle): string {
  try {
    return new Intl.NumberFormat(locale, style ? { style } : undefined).format(value)
  } catch {
    return String(value)
  }
}

interface IcuCase {
  key: string
  body: string
}

function parseCases(payload: string): IcuCase[] | null {
  const cases: IcuCase[] = []
  let i = 0
  while (i < payload.length) {
    while (i < payload.length && /\s/u.test(payload.charAt(i))) i++
    if (i >= payload.length) break
    const open = payload.indexOf('{', i)
    if (open === -1) return null
    const key = payload.slice(i, open).trim()
    if (!key) return null
    const close = matchBrace(payload, open)
    if (close === -1) return null
    cases.push({ key, body: payload.slice(open + 1, close) })
    i = close + 1
  }
  return cases.length > 0 ? cases : null
}

function pickCase(cases: IcuCase[], candidates: string[]): string | null {
  for (const cand of candidates) {
    const hit = cases.find((c) => c.key === cand)
    if (hit) return hit.body
  }
  return null
}

function renderCases(body: string, ctx: Ctx, hashValue: string | null): string {
  let out = ''
  let i = 0
  while (i < body.length) {
    const ch = body[i]
    if (ch === '#' && hashValue !== null) {
      out += hashValue
      i++
      continue
    }
    if (ch === '{') {
      const close = matchBrace(body, i)
      if (close === -1) {
        out += ch
        i++
        continue
      }
      const rendered = renderArg(body.slice(i + 1, close), ctx)
      if (rendered === null) {
        out += body.slice(i, close + 1)
        i = close + 1
        continue
      }
      out += rendered
      i = close + 1
      continue
    }
    out += ch
    i++
  }
  return out
}

/** 渲染 `{...}` 内部(不含外层花括号);无法解析时返回 null 触发降级 */
function renderArg(inner: string, ctx: Ctx): string | null {
  const comma = indexOfTopLevel(inner, 0, ',')
  const name = (comma === -1 ? inner : inner.slice(0, comma)).trim()
  if (comma === -1) {
    const raw = ctx.params[name]
    return raw === undefined ? '' : String(raw)
  }
  const rest = inner.slice(comma + 1)
  const typeComma = indexOfTopLevel(rest, 0, ',')
  const type = (typeComma === -1 ? rest : rest.slice(0, typeComma)).trim()
  const payload = typeComma === -1 ? null : rest.slice(typeComma + 1).trim()
  const value = ctx.params[name]

  if (type === 'number') {
    const n = toNumber(value)
    if (n === null) return value === undefined ? '' : String(value)
    // 仅认四种 plain style;ICU `::` skeleton 不支持 → 退化为默认分组格式(宁可少样式,不吐语法残迹)
    const style =
      payload !== null && NUMBER_STYLES.has(payload as NumberStyle)
        ? (payload as NumberStyle)
        : undefined
    return formatNumber(n, ctx.locale, style)
  }

  if (type !== 'plural' && type !== 'selectordinal' && type !== 'select') return null
  if (payload === null) return null
  const cases = parseCases(payload)
  if (!cases) return null

  if (type === 'select') {
    const picked = pickCase(cases, [String(value ?? ''), 'other'])
    return picked === null ? null : renderCases(picked, ctx, null)
  }

  const n = toNumber(value)
  if (n === null) {
    const fallback = pickCase(cases, ['other'])
    return fallback === null ? null : renderCases(fallback, ctx, null)
  }
  let category: string
  try {
    category = new Intl.PluralRules(ctx.locale, {
      type: type === 'selectordinal' ? 'ordinal' : 'cardinal',
    }).select(n)
  } catch {
    category = 'other'
  }
  const hashValue = formatNumber(n, ctx.locale)
  const candidates = type === 'selectordinal' ? [category, 'other'] : [`=${n}`, category, 'other']
  const picked = pickCase(cases, candidates)
  return picked === null ? null : renderCases(picked, ctx, hashValue)
}

function formatPattern(pattern: string, ctx: Ctx): string {
  let out = ''
  let i = 0
  while (i < pattern.length) {
    const ch = pattern[i]
    if (ch === '{') {
      if (pattern[i + 1] === '{') {
        const end = pattern.indexOf('}}', i + 2)
        if (end === -1) {
          out += ch
          i++
          continue
        }
        const raw = ctx.params[pattern.slice(i + 2, end).trim()]
        out += raw === undefined ? '' : String(raw)
        i = end + 2
        continue
      }
      const close = matchBrace(pattern, i)
      if (close === -1) {
        // 花括号未闭合 → 其余部分原样输出(降级不得截断文案)
        out += pattern.slice(i)
        break
      }
      const rendered = renderArg(pattern.slice(i + 1, close), ctx)
      // 解析失败 → 原样保留该段(降级不得打断渲染,也不得吞掉文案)
      out += rendered === null ? pattern.slice(i, close + 1) : rendered
      i = close + 1
      continue
    }
    out += ch
    i++
  }
  return out
}

export function formatIcu(pattern: string, params: Params, options?: IcuFormatOptions): string {
  try {
    return formatPattern(pattern, { params, locale: options?.locale ?? 'zh-CN' })
  } catch {
    return pattern
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
