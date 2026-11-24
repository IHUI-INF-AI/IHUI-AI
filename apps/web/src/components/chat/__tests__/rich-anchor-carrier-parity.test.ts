// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D04 消息串内富文本动作锚点 · 词包载体一致性 + 「标签外露」侦测。
 *
 * 为什么钉这条(实测缺陷,不是推测):`wallet.autoTopUp.target.equivalent.text` 五语言值都带
 * `<strong>{amount}</strong>`,而消费点曾走 plain `t()` ⇒ 标记不解释,用户直接看见
 * 「<strong>¥45.00</strong>」字面量。D04 的结论是"把该机制定为对话流措辞的强制载体",
 * 而"强制"只能靠机器判据落地,否则下一个带标签的键照样漏。
 *
 * 两条判据:
 *  ① **载体一致性** —— 同一语义键在五语言里的**标签多重集**必须相同(语序可变,标签集不可变);
 *  ② **无裸消费** —— 带白名单标签的键,其消费点必须是 `t.rich(...)` 或 `<RichAnchorText>`;
 *     出现 plain `t('key')` / `tStream('key')` 即判红(测试文件与探针键除外,理由见下)。
 *
 * 白名单标签集合**不在本文件重抄**(§0.6 单一真相源),从 `@ihui/shared/chat` 取。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { RICH_ANCHOR_TAGS } from '@ihui/shared/chat'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..', '..', '..')
const MESSAGES_ROOT = join(REPO, 'packages', 'i18n', 'messages')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

/** 扫描源码的落点(只扫会被打进界面的端;CLI/server 词包不渲染标签) */
const SOURCE_ROOTS = [
  'apps/web/src',
  'apps/web/app',
  'packages/app/src',
  'packages/ui-react/src',
  'apps/miniapp-taro/src',
  'apps/mobile-rn/src',
].map((p) => join(REPO, p))

const TAG_RE = /<([a-zA-Z][a-zA-Z0-9]*)>/g

function tagMultiset(value: string): string[] {
  const out: string[] = []
  for (const m of value.matchAll(TAG_RE)) {
    const tag = m[1]
    if (tag !== undefined && (RICH_ANCHOR_TAGS as readonly string[]).includes(tag)) out.push(tag)
  }
  return out.sort()
}

function flatten(obj: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  if (typeof obj === 'string') {
    if (prefix) out[prefix] = obj
    return out
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const np = prefix ? `${prefix}.${k}` : k
      if (typeof v === 'string') out[np] = v
      else if (v && typeof v === 'object') Object.assign(out, flatten(v, np))
    }
  }
  return out
}

interface Carrier {
  /** 词包文件(如 web / shared) */
  pack: string
  /** 完整键路径 */
  key: string
  /** 末段键名(消费点里出现的那一个) */
  leaf: string
  locales: Record<string, string[]>
}

function collectCarriers(): Carrier[] {
  const byKey = new Map<string, Carrier>()
  for (const pack of readdirSync(MESSAGES_ROOT)) {
    const packDir = join(MESSAGES_ROOT, pack)
    if (!statSync(packDir).isDirectory()) continue
    for (const locale of LOCALES) {
      const file = join(packDir, `${locale}.json`)
      let json: Record<string, unknown>
      try {
        json = JSON.parse(readFileSync(file, 'utf8'))
      } catch {
        continue // 该 pack 没有这个语言文件 ⇒ 跳过该 pack
      }
      for (const [key, value] of Object.entries(flatten(json))) {
        const tags = tagMultiset(value)
        if (!tags.length) continue
        const id = `${pack}::${key}`
        const c = byKey.get(id) ?? { pack, key, leaf: key.split('.').pop() as string, locales: {} }
        c.locales[locale] = tags
        byKey.set(id, c)
      }
    }
  }
  return [...byKey.values()]
}

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const e of entries) {
    const p = join(dir, e)
    const st = statSync(p)
    if (st.isDirectory()) {
      // 测试与 e2e 里出现 plain t('key') 不构成"用户可见外露",
      // 它们断的是词包本身;把它们算进射程只会逼人在测试里也套渲染器。
      if (e === '__tests__' || e === 'e2e' || e === 'node_modules' || e === '.next') continue
      listSourceFiles(p, acc)
    } else if (/\.tsx?$/.test(e) && !/\.(test|spec)\.tsx?$/.test(e)) {
      acc.push(p)
    }
  }
  return acc
}

/**
 * 找某个带标签键的**裸消费点**(命名空间感知版)。
 *
 * 为什么不按"末段键名"全仓 grep(上一版的做法):`subtitle` 这类末段名在全仓有数百处
 * `t('subtitle')`,与带标签的那一个键毫无关系 ⇒ 判据会被误报淹没,而误报判据的结局就是
 * 逼人把它关掉(§12e)。正解 = 先用 `useTranslations('<命名空间前缀>')` 把文件收窄到
 * "真的挂在这个键的命名空间下",再按**键后缀**匹配调用点。
 *
 * 合法载体:`t.rich('<同一后缀>')` 或 `<RichAnchorText>`;`t(...)` / `tStream(...)` 为裸消费。
 */
export function findPlainConsumers(
  carrierKey: string,
  sources: { file: string; text: string }[],
): string[] {
  const segs = carrierKey.split('.')
  // 由长到短的所有可能命名空间前缀(useTranslations('wallet.autoTopUp') → 键 target.equivalent.text)
  const prefixes = segs.slice(0, -1).map((_, i) => segs.slice(0, i + 1).join('.'))
  const suffixes = segs.map((_, i) => segs.slice(i).join('.'))
  const nsRe = new RegExp(
    `(?:useTranslations|getTranslations)\\(\\s*['"\`](${prefixes.map((p) => p.replace(/\./g, '\\.')).join('|')})['"\`]`,
  )
  const hits: string[] = []
  for (const s of sources) {
    if (!nsRe.test(s.text)) continue
    for (const m of s.text.matchAll(/\bt(?:[A-Z][A-Za-z]*)?\(\s*['"`]([^'"`]+)['"`]/g)) {
      const called = m[1]
      if (!called || !suffixes.includes(called)) continue
      // 同一后缀已有 t.rich 载体 ⇒ 不是外露
      const rich = new RegExp(`t\\.rich\\(\\s*['"\`]${called.replace(/\./g, '\\.')}['"\`]`).test(
        s.text,
      )
      if (rich || /RichAnchorText/.test(s.text)) continue
      const line = s.text.slice(0, m.index).split('\n').length
      hits.push(`${s.file}:${line} ${m[0]}`)
    }
  }
  return hits
}

describe('D04 富文本载体', () => {
  const carriers = collectCarriers()

  it('词包里确实存在带白名单标签的键(枚举到 0 个 ⇒ 判死,不记绿)', () => {
    expect(carriers.length).toBeGreaterThan(0)
  })

  it.each(carriers.map((c) => [`${c.pack}::${c.key}`, c] as const))(
    '载体一致性 %s:五语言标签多重集相同(语序可变,标签集不可变)',
    (_id, carrier) => {
      const seen = Object.entries(carrier.locales)
      // 只出现在部分语言 ⇒ 也是不一致(某语言会把标记原样吐给用户或少一层样式)
      expect(seen.map(([l]) => l).sort()).toEqual([...LOCALES].sort())
      const first = seen[0]
      if (!first) throw new Error(`${carrier.pack}::${carrier.key}: 语言读数为空 ⇒ 标签集无从比对`)
      for (const [locale, tags] of seen) {
        expect(tags, `${first[0]} 与 ${locale} 标签集不同`).toEqual(first[1])
      }
    },
  )

  it('无裸消费:带标签的键不得被 plain t()/tStream() 取走', () => {
    const files = SOURCE_ROOTS.filter((d) => {
      try {
        return statSync(d).isDirectory()
      } catch {
        return false
      }
    }).flatMap((d) => listSourceFiles(d))
    expect(files.length).toBeGreaterThan(100)
    const sources = files.map((f) => ({ file: f, text: readFileSync(f, 'utf8') }))
    const offenders: string[] = []
    for (const c of carriers) {
      // 探针键(richAnchorProbe.*)只为 e2e/单测供给语料,没有生产消费点
      if (c.key.startsWith('richAnchorProbe.')) continue
      const hits = findPlainConsumers(c.key, sources)
      if (hits.length) offenders.push(`${c.pack}::${c.key} → ${hits.join(' , ')}`)
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('反向牙:侦测不是空转,也不按末段键名误伤', () => {
    const KEY = 'wallet.autoTopUp.target.equivalent.text'
    const leaky = [
      {
        file: join(REPO, 'a.tsx'),
        text: `const t = useTranslations('wallet.autoTopUp');\nconst s = t('target.equivalent.text', { amount })`,
      },
    ]
    expect(findPlainConsumers(KEY, leaky).length).toBe(1)
    const rich = [
      {
        file: join(REPO, 'b.tsx'),
        text: `const t = useTranslations('wallet.autoTopUp');\n{t.rich('target.equivalent.text', { strong: r })}`,
      },
    ]
    expect(findPlainConsumers(KEY, rich)).toEqual([])
    // 末段同名、命名空间不同 ⇒ 不得算作同一个键(上一版按 leaf 全仓 grep 即被这条淹没)
    const unrelated = [
      {
        file: join(REPO, 'c.tsx'),
        text: `const t = useTranslations('settings.general');\nconst s = t('equivalent.text')`,
      },
    ]
    expect(findPlainConsumers(KEY, unrelated)).toEqual([])
    // 完全没有该命名空间的文件 ⇒ 零命中
    const noNs = [{ file: join(REPO, 'd.tsx'), text: `const s = t('target.equivalent.text')` }]
    expect(findPlainConsumers(KEY, noNs)).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
