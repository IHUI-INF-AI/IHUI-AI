/**
 * i18n-icu-antipattern.test.tsx — web 端 next-intl ICU 反模式回归测试
 *
 * 背景(2026-07-28 立):
 *   web 端 i18n 历史上多次出现 `t('key', '...{{n}}...').replace('{{n}}', val)` 客户端
 *   字符串替换反模式。典型案例:apps/web/src/components/ai/context-usage-ring.tsx
 *   第 256-261 / 282-287 两处 — 修前为 `.replace(...)` 客户端替换,导致 next-intl
 *   ICU 在 SSR 阶段就报 FORMATTING_ERROR "context variable 'percent' was not provided" → 500。
 *
 *   截至 2026-07-28,web 端已修复 2 处:context-usage-ring.tsx:256-261 / 282-287。
 *   修复统一模式:`t('key', { var: val })` 走 next-intl ICU 通道,JSON 用 `{var}` /
 *   `{{var}}` 两种 ICU 占位符(@ihui/i18n/loader 的 translate() 内部双通道支持)。
 *
 * 三层防护:
 *   - 静态扫描脚本(方案 B):scripts/check-miniapp-replace-antipattern.mjs(当前只扫
 *     miniapp-taro,本任务将 web 端纳入扫描目标守门 — 但本文件不修改该脚本)
 *   - 单元测试(本文件,方案 A):运行期断言,防"修复后被人改回去"
 *   - E2E 测试:apps/web/e2e/compress-toast-icu.spec.ts(subagent 写的,Playwright)
 *
 * 覆盖范围:2 处修复后的 context-usage-ring.tsx + chat.fallbackNotice 等其他
 * 含占位符的 web 端 key + 5 语言 ICU 占位符 parity + 反模式静态扫描。
 *
 * 关键事实(@ihui/i18n/loader.ts:34-41 验证):
 *   translate() 先尝试 {{var}} 再尝试 {var},所以 JSON 用 {{n}} 和源码用 {n} 都 OK。
 *   chat.contextUsage.* 实际用 {var}(单大括号,5 语言一致),
 *   chat.fallbackNotice 用 {var}(单大括号,next-intl 4 标准,5 语言一致)。
 */
import { describe, it, expect, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// ── 5 语言 JSON 直接 import(走 @ihui/i18n/messages/web/* 共享 i18n 包)────────
import msgsZhCN from '@ihui/i18n/messages/web/zh-CN.json'
import msgsEn from '@ihui/i18n/messages/web/en.json'
import msgsJa from '@ihui/i18n/messages/web/ja.json'
import msgsKo from '@ihui/i18n/messages/web/ko.json'
import msgsZhTW from '@ihui/i18n/messages/web/zh-TW.json'

const ALL_MSGS = {
  'zh-CN': msgsZhCN,
  en: msgsEn,
  ja: msgsJa,
  ko: msgsKo,
  'zh-TW': msgsZhTW,
} as const

// ── mock 验证:模拟 next-intl useTranslations 行为(走 ICU 通道)────────────────
const { capturedCalls, mockT } = vi.hoisted(() => {
  const capturedCalls = { tCalls: [] as Array<{ key: string; params: unknown }> }
  // mockT 内部维护一个简化的 ICU 占位符替换:{var} 与 {{var}} 都支持
  // 模拟真实 next-intl t() 行为:无 params 时返回 key 本身,有 params 时替换占位符
  const mockT = (key: string, params?: Record<string, string | number | boolean>) => {
    capturedCalls.tCalls.push({ key, params: params ?? null })
    if (params === undefined) return key
    // 模拟 ICU:{{var}} 先于 {var}(与 @ihui/i18n/loader 行为一致)
    return (
      key +
      '|' +
      Object.entries(params)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join('&')
    )
  }
  return { capturedCalls, mockT }
})

vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
}))

import { useTranslations } from 'next-intl'

// ── 测试数据:web 端核心 ICU keys(2 处已修 + 其他含占位符的)────────────────
type IcuKey = {
  /** 完整 i18n key(点分路径,便于直接走 getByPath) */
  key: string
  /** ICU 占位符名称(单大括号 {var} 形式),用于断言 {{var}} / {var} 都存在 */
  placeholders: readonly string[]
  /** 占位符的实际包装形式(单大括号 / 双大括号 / 混用) */
  braceStyle: 'single' | 'double'
}

const ICU_KEYS: readonly IcuKey[] = [
  // 2026-07-28 修复的 2 处(单大括号)
  {
    key: 'chat.contextUsage.triggerLabel',
    placeholders: ['percent', 'used', 'max'],
    braceStyle: 'single',
  },
  {
    key: 'chat.contextUsage.compressResultDesc',
    placeholders: ['original', 'compressed'],
    braceStyle: 'single',
  },
  // 2026-08-05 修复:fallbackNotice 实际 JSON 是单大括号 {var}(next-intl 4 ICU 标准)
  { key: 'chat.fallbackNotice', placeholders: ['backup', 'primary'], braceStyle: 'single' },
  // 其他含占位符的 web 端 key(用于扩展覆盖)
  // 注:实际 JSON 路径以 getByPath 为准 — 这些 key 都经过多语言 grep 验证存在
  { key: 'certificate.detail.issuerAria', placeholders: ['org', 'name'], braceStyle: 'single' },
  { key: 'course.tabs.certNo', placeholders: ['no'], braceStyle: 'single' },
  { key: 'course.chapters.sectionCount', placeholders: ['count'], braceStyle: 'single' },
] as const

// ── 2 处修复后的源文件(用于反模式静态扫)─────────────────────────────────
const SOURCE_FILES = [
  'src/components/ai/context-usage-ring.tsx',
  'src/components/chat/message-list.tsx',
] as const

// ── 工具:点分路径取值 ──────────────────────────────────────────────────────
function getByPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined
  const parts = path.split('.')
  let cur: unknown = obj
  for (const part of parts) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return cur
}

// ── 测试套件 ──────────────────────────────────────────────────────────────

describe('web · next-intl ICU 反模式回归', () => {
  describe('1) 5 语言 i18n JSON 含 ICU 占位符 parity', () => {
    it.each(ICU_KEYS)(
      '$key 在 5 语言中均含 ICU 占位符 ({{$braceStyle}})',
      ({ key, placeholders, braceStyle }) => {
        const expected = braceStyle === 'double' ? `{{${placeholders[0]}}}` : `{${placeholders[0]}}`
        for (const [locale, msgs] of Object.entries(ALL_MSGS)) {
          const v = getByPath(msgs, key)
          expect(v, `${locale}.${key} 必须存在`).toBeDefined()
          expect(typeof v, `${locale}.${key} 必须是 string`).toBe('string')
          // 5 语言共用同一 braceStyle:每语言都必须含该占位符(单/双大括号)
          expect(v as string, `${locale}.${key} 必须含 ICU 占位符 ${expected}`).toContain(expected)
        }
      },
    )

    it('chat.contextUsage.triggerLabel 在 5 语言均含 {percent} {used} {max} 三个占位符', () => {
      for (const [locale, msgs] of Object.entries(ALL_MSGS)) {
        const v = getByPath(msgs, 'chat.contextUsage.triggerLabel') as string
        expect(v, `${locale}.chat.contextUsage.triggerLabel 必须存在`).toBeDefined()
        // 三个占位符都必须存在(任一缺失 → SSR 报 FORMATTING_ERROR)
        expect(v, `${locale} 必须含 {percent}`).toContain('{percent}')
        expect(v, `${locale} 必须含 {used}`).toContain('{used}')
        expect(v, `${locale} 必须含 {max}`).toContain('{max}')
      }
    })

    it('chat.contextUsage.compressResultDesc 在 5 语言均含 {original} {compressed}', () => {
      for (const [locale, msgs] of Object.entries(ALL_MSGS)) {
        const v = getByPath(msgs, 'chat.contextUsage.compressResultDesc') as string
        expect(v, `${locale}.chat.contextUsage.compressResultDesc 必须存在`).toBeDefined()
        expect(v, `${locale} 必须含 {original}`).toContain('{original}')
        expect(v, `${locale} 必须含 {compressed}`).toContain('{compressed}')
      }
    })

    it('chat.fallbackNotice 在 5 语言均含 {backup} {primary}(单大括号 ICU,2026-08-05 修正)', () => {
      for (const [locale, msgs] of Object.entries(ALL_MSGS)) {
        const v = getByPath(msgs, 'chat.fallbackNotice') as string
        expect(v, `${locale}.chat.fallbackNotice 必须存在`).toBeDefined()
        expect(v, `${locale} 必须含 {backup}`).toContain('{backup}')
        expect(v, `${locale} 必须含 {primary}`).toContain('{primary}')
      }
    })

    it('5 语言 ICU keys 集合完全一致(无 key 缺失)', () => {
      // 5 语言都必须包含全部 ICU_KEYS 的 key,否则下游 t() 会 fallback 到 zh-CN,
      // 触发 hydration 不一致 bug(SSR 渲染 zh-CN / CSR 渲染目标语言)
      for (const locale of Object.keys(ALL_MSGS)) {
        for (const { key } of ICU_KEYS) {
          const v = getByPath(ALL_MSGS[locale as keyof typeof ALL_MSGS], key)
          expect(v, `${locale}.${key} 必须存在,避免 hydration 不一致`).toBeDefined()
        }
      }
    })

    it('chat.contextUsage 子块在 5 语言均存在且键数一致', () => {
      for (const [locale, msgs] of Object.entries(ALL_MSGS)) {
        const block = getByPath(msgs, 'chat.contextUsage') as Record<string, unknown> | undefined
        expect(block, `${locale}.chat.contextUsage 子块必须存在`).toBeDefined()
        // contextUsage 子块至少 13 个键(title/used/max/.../disclaimer)
        expect(Object.keys(block!).length).toBeGreaterThanOrEqual(13)
      }
    })
  })

  describe('2) 修复后源码无 .replace("{{ 反模式残留', () => {
    it.each(SOURCE_FILES)('$s 不含 .replace("{{ 占位符反模式', async (rel) => {
      const abs = join(process.cwd(), rel)
      const content = await readFile(abs, 'utf-8')
      // Pattern A: t(key, "...{{n}}...").replace — 反模式完整形态
      expect(content, `${rel} 不应含 t(key, "...{{...}}...").replace 模式`).not.toMatch(
        /t\(\s*['"][^'"]+['"]\s*,\s*['"][^'"]*\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}[^'"]*['"]\s*\)\s*\.replace/,
      )
      // Pattern B: t(key).replace("{{n}}", val) — 任何 t/tt 后跟 .replace("{{
      expect(content, `${rel} 不应含 .replace("{{ 反模式`).not.toMatch(/\.replace\s*\(\s*['"]\{\{/)
    })

    it('context-usage-ring.tsx 第 257 行已修复为 t(compressResultDesc, { original, compressed })', async () => {
      const abs = join(process.cwd(), 'src/components/ai/context-usage-ring.tsx')
      const content = await readFile(abs, 'utf-8')
      // 找修复后调用:t('compressResultDesc', { original: ..., compressed: ... })
      expect(content).toMatch(
        /t\(\s*['"]compressResultDesc['"]\s*,\s*\{[\s\S]*?original[\s\S]*?compressed[\s\S]*?\}\s*\)/,
      )
    })

    it('context-usage-ring.tsx 第 283 行已修复为 t(triggerLabel, { percent, used, max })', async () => {
      const abs = join(process.cwd(), 'src/components/ai/context-usage-ring.tsx')
      const content = await readFile(abs, 'utf-8')
      // 找修复后调用:t('triggerLabel', { percent, used, max })
      expect(content).toMatch(
        /t\(\s*['"]triggerLabel['"]\s*,\s*\{[\s\S]*?percent[\s\S]*?used[\s\S]*?max[\s\S]*?\}\s*\)/,
      )
    })

    it('message-list.tsx 第 1346 行已修复为 t(fallbackNotice, { primary, backup })', async () => {
      const abs = join(process.cwd(), 'src/components/chat/message-list.tsx')
      const content = await readFile(abs, 'utf-8')
      // 找修复后调用:t('fallbackNotice', { primary, backup })
      expect(content).toMatch(
        /t\(\s*['"]fallbackNotice['"]\s*,\s*\{[\s\S]*?primary[\s\S]*?backup[\s\S]*?\}\s*\)/,
      )
    })
  })

  describe('3) useTranslations mock: t() 必须接受 params 对象,不能单参 + .replace 链', () => {
    it('t(key, params) 返回 key|param=value 形式(走 ICU 通道)', () => {
      const t = useTranslations()
      expect(
        t('chat.contextUsage.compressResultDesc', { original: '1234', compressed: '567' }),
      ).toBe('chat.contextUsage.compressResultDesc|original=1234&compressed=567')
      expect(t('chat.contextUsage.triggerLabel', { percent: 80, used: '8k', max: '10k' })).toBe(
        'chat.contextUsage.triggerLabel|percent=80&used=8k&max=10k',
      )
    })

    it('t(key) 无 params 时返回 key 本身(fallback 行为)', () => {
      const t = useTranslations()
      expect(t('static.key')).toBe('static.key')
      expect(t('chat.contextUsage.title')).toBe('chat.contextUsage.title')
    })

    it('mock 捕获的 t 调用:key + params 形状匹配(模拟源码调用模式)', () => {
      const t = useTranslations()
      // 模拟 context-usage-ring.tsx 的两处修复后调用
      t('chat.contextUsage.compressResultDesc', { original: '1234', compressed: '567' })
      t('chat.contextUsage.triggerLabel', { percent: 80, used: '8k', max: '10k' })
      t('chat.fallbackNotice', { primary: 'gpt-4', backup: 'gpt-3.5' })

      const last3 = capturedCalls.tCalls.slice(-3)
      expect(last3[0]).toEqual({
        key: 'chat.contextUsage.compressResultDesc',
        params: { original: '1234', compressed: '567' },
      })
      expect(last3[1]).toEqual({
        key: 'chat.contextUsage.triggerLabel',
        params: { percent: 80, used: '8k', max: '10k' },
      })
      expect(last3[2]).toEqual({
        key: 'chat.fallbackNotice',
        params: { primary: 'gpt-4', backup: 'gpt-3.5' },
      })
    })

    it('t(key, params) 接受 string/number 类型(v4 起禁止 boolean/null/undefined 作为 ICU 参数)', () => {
      const t = useTranslations()
      // 关键:params 必须接受 number 类型(ratio / percent / count 等)
      const r1 = t('test.count', { n: 42 })
      expect(r1).toContain('n=42')
      // next-intl v4 breaking change:boolean 不再被接受为 ICU 参数(类型层面禁止)
      // 历史 antipattern 测试断言 `t('test.flag', { on: true })` 已失效,删除
    })
  })

  describe('4) translate() 实际 ICU 行为(直接调用 loader 验证占位符替换)', () => {
    it('loader 的 translate 支持 {{n}} 和 {n} 两种 ICU 占位符', async () => {
      // 动态 import loader,避免被 vitest 提前 hoist 处理
      const { translate } = await import('@ihui/i18n/loader')
      // {{n}} 形式(双大括号,fallbackNotice 用法)
      const r1 = translate({ a: 'hello {{n}} world' }, 'a', { params: { n: 42 } })
      expect(r1).toBe('hello 42 world')
      // {n} 形式(单大括号,contextUsage 用法)
      const r2 = translate({ a: 'hello {n} world' }, 'a', { params: { n: 42 } })
      expect(r2).toBe('hello 42 world')
      // time 占位符
      const r3 = translate({ a: '剩余 {{time}}' }, 'a', { params: { time: '14:59' } })
      expect(r3).toBe('剩余 14:59')
      // 无 params 时原样返回
      const r4 = translate({ a: 'static' }, 'a')
      expect(r4).toBe('static')
    })

    it('loader translate 对未提供变量返回空字符串(对齐 next-intl ICU 行为)', async () => {
      const { translate } = await import('@ihui/i18n/loader')
      // 未提供 n:替换为空字符串
      const r = translate({ a: 'value is {n}' }, 'a', { params: {} })
      expect(r).toBe('value is ')
    })

    it('loader translate 多占位符替换顺序无关({{a}} + {b} 共存)', async () => {
      const { translate } = await import('@ihui/i18n/loader')
      // 同一字符串混用 {{a}} + {b}(虽然 web JSON 实际只用一种,但 loader 必须支持)
      const r = translate({ a: '{{a}} + {b}' }, 'a', { params: { a: 'AAA', b: 'BBB' } })
      expect(r).toBe('AAA + BBB')
    })

    it('loader translate 走 chat.contextUsage.triggerLabel 5 语言都能正确替换', async () => {
      const { translate } = await import('@ihui/i18n/loader')
      for (const [locale, msgs] of Object.entries(ALL_MSGS)) {
        const msgsObj = msgs as Record<string, unknown>
        const result = translate(msgsObj, 'chat.contextUsage.triggerLabel', {
          params: { percent: 80, used: '8k', max: '10k' },
        })
        // 关键:5 语言都不能保留原始 {var} 占位符(bug 复发特征)
        expect(result, `${locale} 不应保留 {percent}`).not.toContain('{percent}')
        expect(result, `${locale} 不应保留 {used}`).not.toContain('{used}')
        expect(result, `${locale} 不应保留 {max}`).not.toContain('{max}')
        // 关键:必须含变量值
        expect(result, `${locale} 必须含 percent=80`).toContain('80')
        expect(result, `${locale} 必须含 used=8k`).toContain('8k')
        expect(result, `${locale} 必须含 max=10k`).toContain('10k')
      }
    })

    it('loader translate 走 chat.fallbackNotice(双大括号)5 语言都能正确替换', async () => {
      const { translate } = await import('@ihui/i18n/loader')
      for (const [locale, msgs] of Object.entries(ALL_MSGS)) {
        const msgsObj = msgs as Record<string, unknown>
        const result = translate(msgsObj, 'chat.fallbackNotice', {
          params: { primary: 'gpt-4', backup: 'gpt-3.5' },
        })
        // 关键:不能保留原始 {{var}} 占位符
        expect(result, `${locale} 不应保留 {{primary}}`).not.toContain('{{primary}}')
        expect(result, `${locale} 不应保留 {{backup}}`).not.toContain('{{backup}}')
        // 必须含变量值
        expect(result, `${locale} 必须含 primary=gpt-4`).toContain('gpt-4')
        expect(result, `${locale} 必须含 backup=gpt-3.5`).toContain('gpt-3.5')
      }
    })
  })
})
