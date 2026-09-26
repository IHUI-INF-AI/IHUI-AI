// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui/i18n ICU 子集解释器 — 让非 web 端(miniapp-taro / mobile-rn / cli / extension / api)
// 与 web(next-intl → intl-messageformat)渲染出同一结果。只覆盖对话流措辞实际需要的四形:
// plural / select / selectordinal / number,外加既有的 {name} 与 {{name}} 插值。
//
// 子集边界(与 intl-messageformat 有意不一致,均降级为原文 + console.warn,不抛错):
// - plural `offset:N` 不支持 → 整段降级(宁可原文,不错选分支)
// - `{v, number, ::skeleton}` 不解析 → 按默认分组格式渲染
// - `'` 转义(apos quoting)不解析 → 按字面量处理(日常文案的 don't 等不受影响,
//   仅 `'{` / `''` 这类转义序列与标准语义不同,词表内禁用此类写法)
// - plural/selectordinal 的数值参数允许 string 数字("2"按 2 处理),intl-messageformat
//   要求 number 类型 —— 跨引擎夹具只喂 number,此处宽松是为了兼容端内透传的字符串量

import type { IcuFormatOptions } from './types.js'

const ICU_ARG_RE = /\{\s*[\w$]+\s*,\s*(?:plural|select|selectordinal|number)\b/u

/** 快速判定是否需要走 ICU 解析(不含 ICU 的字符串保持原插值路径,零行为变化) */
export function hasIcuSyntax(text: string): boolean {
  return ICU_ARG_RE.test(text)
}

type Params = Record<string, string | number>

interface Ctx {
  params: Params
  locale: string
  /** 解析降级原因(只记首次;formatIcu 收尾 console.warn 一次) */
  degraded?: string
}

function degrade(ctx: Ctx, reason: string): null {
  if (ctx.degraded === undefined) ctx.degraded = reason
  return null
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
      // case 体内的 {{name}} 双花括号插值(与顶层 formatPattern 同语义;
      // 注意 plural 的 `other {{count} 条}` 经 parseCases 剥掉一层后此处看到的是
      // `{count} 条`,走下面的单花括号分支,不进此分支)
      if (body[i + 1] === '{') {
        const end = body.indexOf('}}', i + 2)
        if (end === -1) {
          out += ch
          i++
          continue
        }
        const raw = ctx.params[body.slice(i + 2, end).trim()]
        out += raw === undefined ? '' : String(raw)
        i = end + 2
        continue
      }
      const close = matchBrace(body, i)
      if (close === -1) {
        out += ch
        i++
        continue
      }
      // 嵌套一层:select/plural 均可再嵌套一层(与 web 侧同构,见跨引擎夹具)
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

  if (type !== 'plural' && type !== 'selectordinal' && type !== 'select') {
    return degrade(ctx, `unknown-type:${type}`)
  }
  if (payload === null) return degrade(ctx, `missing-payload:${type}`)
  // offset:N 不在子集内:parseCases 会把它吞成 case key 的一部分导致静默错选分支,
  // 必须显式降级(词表内禁用 offset 写法,见跨引擎夹具)
  if (
    (type === 'plural' || type === 'selectordinal') &&
    /^\s*offset\s*:/u.test(payload)
  ) {
    return degrade(ctx, 'offset-unsupported:plural')
  }
  const cases = parseCases(payload)
  if (!cases) return degrade(ctx, `parse-cases:${type}`)

  if (type === 'select') {
    const picked = pickCase(cases, [String(value ?? ''), 'other'])
    if (picked === null) return degrade(ctx, `select-no-match:${String(value ?? '')}`)
    // 与 intl-messageformat 实测一致:# 的作用域止于各自 plural,select 内一律字面量
    // (探针:intl-messageformat@11.2.13 `{c, plural, other {{s, select, a {#} other {o}}}}`
    //  c=3/s=a 渲染为 "#" 而非 "3";词表内避免在 select 里写 #)
    return renderCases(picked, ctx, null)
  }

  const n = toNumber(value)
  if (n === null) {
    const fallback = pickCase(cases, ['other'])
    if (fallback === null) return degrade(ctx, `non-numeric-no-other:${type}`)
    return renderCases(fallback, ctx, null)
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
  // plural 与 selectordinal 均支持 =N 精确匹配(next-intl/intl-messageformat 同语义)
  const candidates = [`=${n}`, category, 'other']
  const picked = pickCase(cases, candidates)
  if (picked === null) return degrade(ctx, `${type}-no-match:${n}`)
  return renderCases(picked, ctx, hashValue)
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
        degrade(ctx, 'unclosed-brace')
        out += pattern.slice(i)
        break
      }
      const rendered = renderArg(pattern.slice(i + 1, close), ctx)
      if (rendered === null) {
        // 解析失败 → 原样保留该段(降级不得打断渲染,也不得吞掉文案)
        degrade(ctx, 'render-arg')
        out += pattern.slice(i, close + 1)
      } else {
        out += rendered
      }
      i = close + 1
      continue
    }
    out += ch
    i++
  }
  return out
}

const MAX_WARN_PATTERN_LEN = 120

function warnDegraded(pattern: string, reason: string): void {
  const short = pattern.length > MAX_WARN_PATTERN_LEN ? `${pattern.slice(0, MAX_WARN_PATTERN_LEN)}…` : pattern
  console.warn(`[ihui-i18n] ICU 解析失败已降级为原文(${reason}): ${short}`)
}

export function formatIcu(pattern: string, params: Params, options?: IcuFormatOptions): string {
  const ctx: Ctx = { params, locale: options?.locale ?? 'zh-CN' }
  try {
    const out = formatPattern(pattern, ctx)
    if (ctx.degraded !== undefined) warnDegraded(pattern, ctx.degraded)
    return out
  } catch (err) {
    warnDegraded(pattern, err instanceof Error ? err.message : String(err))
    return pattern
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
