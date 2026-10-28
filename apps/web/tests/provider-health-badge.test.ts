// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-716 —— provider 健康档:封闭联合 + 词表取词 + 徽章不得直出原始枚举(2026-09-29 立)。
 *
 * 缺陷现读(改动前):
 *   - `app/(main)/settings/llm/types-v2.ts:32/62` 是裸 `healthStatus?: string`;
 *   - `ProviderCardV2.tsx:180-187` 用三档三元猜配色(漏一档静默落进最后一档);
 *   - `ProviderCardV2.tsx:216` **把原始英文枚举直接渲染进徽章** —— 同文件 :203-210 的
 *     noKey 徽章反而走 `t()` ⇒ 同一组件两种口径。
 *   - 词表其实存在,但那是 MCP 能力市场那张(`capabilityMarket.*.unhealthy`),
 *     与本域枚举(`down` / `unknown`)**两域不同形** —— 本票刻意不复用它,理由写在 types-v2.ts。
 *
 * 为什么这个文件存在(而不是只靠 i18n 五道门):
 *   i18n 那几道门判的是"键在不在 / 语种对不对",它们结构上看不见
 *   "渲染面用的是键还是枚举原文" —— 那正是本票的缺陷本体。守门 151 的射程只有
 *   agent-runtime.ts + dag_scheduler.py,provider 健康不在内(票面把"是否扩射程"
 *   交该门持有人,本票不动别人的判据)。所以这里用两条**源码级反向锁**把渲染口径钉住:
 *   ① 徽章必须取词表;② 原始枚举不得再进 JSX。变异自证:把渲染改回
 *   `{provider.healthStatus}` ⇒ 「反向锁」那一条立即红(红语即"徽章不得直出原始枚举")。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  PROVIDER_HEALTH_STATUSES,
  toProviderHealthStatus,
} from '../app/(main)/settings/llm/types-v2'

// 本文件在 apps/web/tests/ ⇒ 到仓根要退三层(apps/web/tests → apps/web → apps → 仓根)。
// 写错一层的症状是 ENOENT 把整档判成"没跑到",而不是某条断言红。
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const LLM_DIR = join(REPO_ROOT, 'apps/web/app/(main)/settings/llm')
const CARD_FILE = join(LLM_DIR, 'ProviderCardV2.tsx')
const TYPES_FILE = join(LLM_DIR, 'types-v2.ts')
const SCHEMA_FILE = join(REPO_ROOT, 'packages/database/src/schema/ai-config.ts')

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

/** llmSettings.v2.health 这张表(五语必须齐) */
function healthTable(locale: (typeof LOCALES)[number]): Record<string, unknown> {
  const file = join(REPO_ROOT, 'packages/i18n/messages/web', `${locale}.json`)
  const messages = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
  const llm = messages.llmSettings as Record<string, unknown> | undefined
  const v2 = llm?.v2 as Record<string, unknown> | undefined
  return (v2?.health ?? {}) as Record<string, unknown>
}

describe('G-716 值域:封闭联合的缺省档必须等于 schema 的 default(反查,不是手抄)', () => {
  it('PROVIDER_HEALTH_STATUSES 含 unknown,且它是数组第一项以外的真实成员', () => {
    expect(PROVIDER_HEALTH_STATUSES).toContain('unknown')
    // 四档封闭:多一档少一档都算改了值域,必须同批改词表与配色
    expect([...PROVIDER_HEALTH_STATUSES].sort()).toEqual(['degraded', 'down', 'healthy', 'unknown'])
  })

  it('schema 的 health_status 缺省档与封闭联合同档(两侧任一改动即红)', () => {
    const schema = readFileSync(SCHEMA_FILE, 'utf8')
    const m = schema.match(/varchar\('health_status'[\s\S]{0,80}?default\('([a-z_]+)'\)/)
    expect(m, 'ai-config.ts 里 health_status 的 default 取值要能现读').not.toBeNull()
    const schemaDefault = m![1]
    // 本票的判据:缺省档必须是值域内的一档,而且**不得**是一个健康结论
    // (把它落成 'healthy' 就是 fail-open 的呈现面版本)
    expect(PROVIDER_HEALTH_STATUSES).toContain(schemaDefault)
    expect(schemaDefault).toBe('unknown')
  })

  it('toProviderHealthStatus 把值域外的串收敛成 unknown,而不是任何一个健康结论', () => {
    expect(toProviderHealthStatus('pending')).toBe('unknown')
    expect(toProviderHealthStatus('')).toBe('unknown')
    expect(toProviderHealthStatus(null)).toBe('unknown')
    expect(toProviderHealthStatus(undefined)).toBe('unknown')
    // 正向对照:值域内逐字保住
    for (const s of PROVIDER_HEALTH_STATUSES) expect(toProviderHealthStatus(s)).toBe(s)
  })
})

describe('G-716 词表:每一档在五语言都取得到词,且取到的不是键名/枚举原文', () => {
  it('五语言的 llmSettings.v2.health 键集与封闭联合逐字相等', () => {
    const expected = [...PROVIDER_HEALTH_STATUSES].sort().join(',')
    for (const locale of LOCALES) {
      expect(Object.keys(healthTable(locale)).sort().join(','), locale).toBe(expected)
    }
  })

  it('逐档逐语言:非空、不等于键名(回显)、不等于枚举原文(那正是原缺陷)', () => {
    for (const locale of LOCALES) {
      const table = healthTable(locale)
      for (const status of PROVIDER_HEALTH_STATUSES) {
        const value = table[status]
        expect(typeof value, `${locale}.${status}`).toBe('string')
        const text = (value as string).trim()
        expect(text.length, `${locale}.${status} 不得是空串`).toBeGreaterThan(0)
        expect(text, `${locale}.${status} 不得回显键名`).not.toBe(`health.${status}`)
        // 关键一条:文案不得就是那个英文枚举原文(改动前徽章渲染的正是它)。
        // 刻意用**逐字等值**而不是 toLowerCase 比:en 的正当标签 "Unknown"/"Healthy"/"Down"
        // 与枚举只差大小写,做大小写归一会把正确的英文文案判成缺陷(本文件第一版就是这么红的)。
        // 枚举原文恒为小写 ⇒ 小写等值即"直出枚举",这条仍然有牙。
        expect(text, `${locale}.${status} 不得直出枚举原文`).not.toBe(status)
      }
    }
  })

  it('不得自套一层(§19 实测形态:orgSaved:{orgSaved:"…"} ⇒ t() 取到对象,提示永远不响)', () => {
    for (const locale of LOCALES) {
      const table = healthTable(locale)
      expect(table.health, `${locale}: health 块里不得再有一个 health 子键`).toBeUndefined()
      for (const status of PROVIDER_HEALTH_STATUSES) {
        expect(typeof table[status], `${locale}.${status} 必须是叶子字符串`).toBe('string')
      }
    }
  })

  it('ko 四档必须是纯谚文(不允许汉字残留 = 守门 2c 的那一型在本票新增面上的复现)', () => {
    const table = healthTable('ko')
    for (const status of PROVIDER_HEALTH_STATUSES) {
      const text = table[status] as string
      expect(text, `ko.${status}`).toMatch(/^[\p{Script=Hangul}\s\d.]+$/u)
    }
  })
})

/**
 * 剥掉注释后再判源码形态(与本仓 ai-ws-business-labels.test.ts 的 stripComments 同一条规矩)。
 * 实测踩到的坑:第一版直接对全文判 `not.toMatch(/healthStatus\?:\s*string\b/)`,
 * 结果被 types-v2.ts 里"改动前这里是裸 string"那句**解释性注释**判红 ——
 * 门把替自己辩护的散文当成了违规(守门 131/70/93 记过同一型,判据失效的表现永远是安静,
 * 而这一型反过来表现为"吵闹的假阳")。散文必须能写旧写法,判据不能因此看不见它。
 */
function stripComments(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

describe('G-716 渲染口径(源码级反向锁):徽章必须取词表,原始枚举不得进 JSX', () => {
  const src = stripComments(readFileSync(CARD_FILE, 'utf8'))
  const typesSrc = stripComments(readFileSync(TYPES_FILE, 'utf8'))

  it('徽章文案来自词表取词,且配色来自按封闭联合建的 Record', () => {
    // \s* 是为了让判据不吃 prettier 的换行形状(lint-staged 会在提交时重排本文件)
    expect(src).toMatch(/t\(\s*HEALTH_LABEL_KEYS\[healthStatus\]\s*\)/)
    expect(src).toMatch(/HEALTH_BADGE_CLASS\[healthStatus\]/)
    // 四档都得有字面量键(动态拼 `health.${status}` 会让静态取词扫描看不见这四档)
    for (const status of PROVIDER_HEALTH_STATUSES) {
      expect(src, `缺 'health.${status}' 字面量键`).toContain(`'health.${status}'`)
    }
  })

  it('渲染面必须先把 provider.healthStatus 过 toProviderHealthStatus 再取值', () => {
    expect(src).toMatch(
      /const healthStatus = toProviderHealthStatus\(\s*provider\.healthStatus\s*\)/,
    )
  })

  it('反向锁:原始枚举不得再直出到 JSX(改回旧写法 ⇒ 本条必红)', () => {
    // JSX 插值形态 {provider.healthStatus} / { provider.healthStatus }
    expect(src, '徽章不得直出原始枚举').not.toMatch(/\{\s*provider\.healthStatus\s*\}/)
    // 三档 if 猜色的旧形态也不得回来(它漏档时静默落进最后一档)
    expect(src, '配色不得再回到三档三元猜').not.toMatch(
      /healthStatus === 'healthy'[\s\S]{0,200}healthStatus === 'degraded'/,
    )
  })

  it('types-v2 的两个字段不得退回裸 string(那让漏档在类型层不可见)', () => {
    expect(typesSrc).not.toMatch(/healthStatus\?:\s*string\b/)
    expect(typesSrc).not.toMatch(/healthStatus:\s*string\b/)
    expect(typesSrc).toMatch(/healthStatus\?:\s*ProviderHealthStatus\b/)
    expect(typesSrc).toMatch(/healthStatus:\s*ProviderHealthStatus\b/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
