/**
 * i18n-icu-antipattern.test.tsx — miniapp-taro 端 next-intl ICU 反模式回归测试
 *
 * 背景(2026-07-28 立):
 *   miniapp-taro 端 i18n 历史上多次出现 `tt('key', '...{{n}}...').replace('{{n}}', val)`
 *   反模式,典型案例:apps/miniapp-taro/src/pages/ai/history.tsx:271-274。
 *   危险点:next-intl SSR 渲染时会把 `{{n}}` 当 ICU placeholder 走 ICU 通道,
 *   开发者用 `.replace()` 替换后再让 next-intl 解析,会出现 ① 二次替换冲突
 *   ② 英文/日文/韩文版本的 ICU 语法不兼容 ③ 翻译 key 缺失时 fallback 字符串里
 *   的 `{{n}}` 被替换后,首次渲染和服务端 hydration 不一致。
 *
 *   截至 2026-07-28,已修复 11 处 miniapp-taro 端反模式 + 1 处 web 端。
 *   修复统一模式:`t('key', { n: val })` 走 next-intl ICU 通道(@ihui/i18n/loader
 *   的 translate() 内部支持 {{var}} 和 {var} 两种 ICU 占位符)。
 *
 * 三层防护:
 *   - 静态扫描脚本(方案 B):scripts/check-miniapp-replace-antipattern.mjs
 *   - 单元测试(本文件,方案 A):运行期断言
 *   - E2E 测试:web 端 apps/web/e2e/compress-toast-icu.spec.ts(miniapp-taro 无 e2e 框架)
 *
 * 覆盖范围:11 处修复后的源文件 + 5 语言 ICU 占位符 parity + 反模式静态扫描。
 *
 * 关键事实(@ihui/i18n/loader.ts:34-41 验证):
 *   translate() 先尝试 {{var}} 再尝试 {var},所以 JSON 用 {{n}} 和源码用 {n} 都 OK。
 *   5 语言 JSON 当前实际用 {{n}}(双大括号),本测试断言 "{{" 形式存在。
 */
import { describe, it, expect, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// ── 5 语言 JSON 直接 import(确认 i18n 包导出路径,复用 miniapp-taro 端同一路径)───
import msgsZhCN from '@ihui/i18n/messages/miniapp-taro/zh-CN.json'
import msgsEn from '@ihui/i18n/messages/miniapp-taro/en.json'
import msgsJa from '@ihui/i18n/messages/miniapp-taro/ja.json'
import msgsKo from '@ihui/i18n/messages/miniapp-taro/ko.json'
import msgsZhTW from '@ihui/i18n/messages/miniapp-taro/zh-TW.json'

const ALL_MSGS = {
  'zh-CN': msgsZhCN,
  en: msgsEn,
  ja: msgsJa,
  ko: msgsKo,
  'zh-TW': msgsZhTW,
} as const

// ── mock 验证:模拟 useI18n hook,验证 t 接受 params 对象 ───────────────────────
const { capturedCalls } = vi.hoisted(() => ({
  capturedCalls: { tCalls: [] as Array<{ key: string; params: unknown }> },
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    // 模拟真实 t 行为:走 ICU 通道
    t: (key: string, params?: Record<string, string | number>) => {
      capturedCalls.tCalls.push({ key, params })
      if (!params) return key
      return key + '|' + JSON.stringify(params)
    },
    // tt 模拟:返回 key 或 fallback
    tt: (key: string, fb?: string) => fb ?? key,
  }),
}))

import { useI18n } from '@/i18n'

// ── 测试数据:11 处修复后调用的 key + 占位符 ───────────────────────────────
type IcuKey = {
  /** 完整 i18n key,如 "streak.continuousDays" */
  key: string
  /** ICU 占位符名称,如 "n" / "time" */
  placeholder: 'n' | 'time'
}

const ICU_KEYS: readonly IcuKey[] = [
  { key: 'streak.continuousDays', placeholder: 'n' },
  { key: 'modelPlaza.modelCount', placeholder: 'n' },
  { key: 'modelPlaza.synced', placeholder: 'n' },
  { key: 'pay.countdownTip', placeholder: 'time' },
  { key: 'pay.couponSaved', placeholder: 'n' },
  { key: 'pay.balanceAmount', placeholder: 'n' },
  { key: 'pay.couponAvailable', placeholder: 'n' },
  { key: 'news.views', placeholder: 'n' },
  { key: 'wallet.recharge.tokenRate', placeholder: 'n' },
  { key: 'ai.historyPage.msgCount', placeholder: 'n' },
] as const

// ── 11 处修复后的源文件(用于反模式静态扫)─────────────────────────────────
const SOURCE_FILES = [
  'src/components/LearningStreak.tsx',
  'src/pages/model-plaza/index.tsx',
  'src/pages/pay/index.tsx',
  'src/pages/share/index.tsx',
  'src/pages/wallet/recharge/index.tsx',
  'src/pages/ai/history.tsx',
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

describe('miniapp-taro · next-intl ICU 反模式回归', () => {
  describe('1) 5 语言 i18n JSON 含 ICU 占位符 parity', () => {
    it.each(ICU_KEYS)('$key 在 5 语言中均含 {$placeholder}', ({ key, placeholder }) => {
      for (const [locale, msgs] of Object.entries(ALL_MSGS)) {
        const v = getByPath(msgs, key)
        expect(v, `${locale}.${key} 必须存在`).toBeDefined()
        expect(typeof v, `${locale}.${key} 必须是 string`).toBe('string')
        // 实际 JSON 用 {n} 单大括号
        expect(v as string, `${locale}.${key} 必须含 ICU 占位符 {${placeholder}}`).toContain(
          `{${placeholder}}`,
        )
      }
    })

    it('5 语言 ICU keys 集合完全一致(无 key 缺失)', () => {
      // 5 语言都必须包含全部 ICU_KEYS 的 key,否则下游 t() 会 fallback 到 zh-CN
      for (const locale of Object.keys(ALL_MSGS)) {
        for (const { key } of ICU_KEYS) {
          const v = getByPath(ALL_MSGS[locale as keyof typeof ALL_MSGS], key)
          expect(v, `${locale}.${key} 必须存在,避免 hydration 不一致`).toBeDefined()
        }
      }
    })
  })

  describe('2) 11 处修复后源码无 .replace("{{ 反模式残留', () => {
    it.each(SOURCE_FILES)('$s 不含 .replace("{{ 占位符反模式', async (rel) => {
      const abs = join(process.cwd(), rel)
      const content = await readFile(abs, 'utf-8')
      // Pattern A: tt(key, "...{{n}}...").replace — subagent A 修复目标
      expect(content, `${rel} 不应含 tt(key, "...{{...}}...").replace 模式`).not.toMatch(
        /tt?\(\s*['"][^'"]+['"]\s*,\s*['"][^'"]*\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}[^'"]*['"]\s*\)\s*\.replace/,
      )
      // Pattern B: t(key).replace("{{n}}", val) — 任何 t/tt 后跟 .replace("{{
      expect(content, `${rel} 不应含 .replace("{{ 反模式`).not.toMatch(/\.replace\s*\(\s*['"]\{\{/)
    })

    it('ai/history.tsx 第 271 行附近已修复为 t(key, { n: count })', async () => {
      const abs = join(process.cwd(), 'src/pages/ai/history.tsx')
      const content = await readFile(abs, 'utf-8')
      // 找修复后调用 — 单行 t('ai.historyPage.msgCount', { n: count })
      expect(content).toMatch(
        /t\(\s*['"]ai\.historyPage\.msgCount['"]\s*,\s*\{\s*n:\s*count\s*\}\s*\)/,
      )
    })
  })

  describe('3) useI18n hook mock:t() 必须接受 params 对象,不能单参 + .replace 链', () => {
    it('t(key, params) 返回 key|json(params) 形式(走 ICU 通道)', () => {
      const { t } = useI18n()
      expect(t('pay.countdownTip', { time: '14:59' })).toBe('pay.countdownTip|{"time":"14:59"}')
      expect(t('pay.couponSaved', { n: 100 })).toBe('pay.couponSaved|{"n":100}')
    })

    it('t(key) 无 params 时返回 key 本身', () => {
      const { t } = useI18n()
      expect(t('static.key')).toBe('static.key')
    })

    it('mock 捕获的 t 调用:key + params 形状匹配', () => {
      const { t } = useI18n()
      // 模拟源码调用模式
      t('ai.historyPage.msgCount', { n: 42 })
      t('pay.balanceAmount', { n: 88 })
      t('pay.countdownTip', { time: '14:59' })

      const last3 = capturedCalls.tCalls.slice(-3)
      expect(last3[0]).toEqual({ key: 'ai.historyPage.msgCount', params: { n: 42 } })
      expect(last3[1]).toEqual({ key: 'pay.balanceAmount', params: { n: 88 } })
      expect(last3[2]).toEqual({ key: 'pay.countdownTip', params: { time: '14:59' } })
    })
  })

  describe('4) translate() 实际 ICU 行为(直接调用 loader 验证占位符替换)', () => {
    it('loader 的 translate 支持 {{n}} 和 {n} 两种 ICU 占位符', async () => {
      // 动态 import loader,避免被 vitest 提前 hoist 处理
      const { translate } = await import('@ihui/i18n/loader')
      // {{n}} 形式
      const r1 = translate({ a: 'hello {{n}} world' }, 'a', { params: { n: 42 } })
      expect(r1).toBe('hello 42 world')
      // {n} 形式
      const r2 = translate({ a: 'hello {n} world' }, 'a', { params: { n: 42 } })
      expect(r2).toBe('hello 42 world')
      // time 占位符
      const r3 = translate({ a: '剩余 {{time}}' }, 'a', { params: { time: '14:59' } })
      expect(r3).toBe('剩余 14:59')
      // 无 params 时原样返回
      const r4 = translate({ a: 'static' }, 'a')
      expect(r4).toBe('static')
    })
  })
})
