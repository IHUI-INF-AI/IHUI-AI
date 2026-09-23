// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node
/**
 * developer/api-docs + models/api-docs 两页硬编码中文取词契约(第五轮 E 组收尾)
 *
 * 判据源优先级(刻意与 tests/family-i18n-contract.test.ts 同一套哲学,但多一层回落):
 *  ① 已提交的语言包 packages/i18n/messages/web/*.json —— 合并后这是唯一真相;
 *  ② 仅当 ① 里还没有本批新键时,回落读 .ihui-agent/tmp/i18n/batch-devdocs.json
 *     (gitignored 的合并前临时清单)。回落是**增量填充**,不覆盖 ① 已有值,
 *     所以"主 agent 合并完成 + 临时清单被删"之后本测试依旧全绿(干净检出必绿);
 *     而"语言包只合了一半"会被 ①+② 的逐语言解析直接照出来。
 *  ③ 守门 70 的命中数一律 execFileSync 调权威脚本,不在测试里复刻行分类逻辑(§22c 同形病)。
 *
 * 与 HEAD 的逐字符对账是**条件断言**:HEAD 还是改前版本时才跑;一旦本批改动作进入 HEAD,
 * 该断言自动跳过(否则它会随每次提交变成时间炸弹)。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = (() => {
  for (const c of [process.cwd(), path.resolve(process.cwd(), 'apps/web')]) {
    if (existsSync(path.join(c, 'app/(main)/developer/api-docs/page.tsx'))) return c
  }
  throw new Error(`未能从 cwd=${process.cwd()} 定位 apps/web 根`)
})()
const REPO_ROOT = path.resolve(WEB_ROOT, '../..')
const MESSAGES = path.join(REPO_ROOT, 'packages/i18n/messages/web')
const BATCH = path.join(REPO_ROOT, '.ihui-agent/tmp/i18n/batch-devdocs.json')

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
type Locale = (typeof LOCALES)[number]

/** 页面在本批新引入的嵌套分组(孤儿判定与族内 parity 只对这几个分组生效) */
interface PageContract {
  /** 相对 apps/web 的源码路径 */
  source: string
  /** 相对仓库根的源码路径(守门 70 输出用它做 key) */
  fromRoot: string
  /** useTranslations/getTranslations 的字面量命名空间 */
  nsLiteral: string
  /** 语言包里的命名空间路径 */
  nsPath: string[]
  /** 本批新增的顶层分组(models 页只新增一个叶子,放在 leafKeys 里) */
  groups: string[]
  /** 本批新增的单个叶子键(全键路径) */
  leafKeys: string[]
  /** 源码里出现的取词键下限,防"改动整体丢失 ⇒ 判据空转" */
  minReferenced: number
  /** 改前 HEAD 里的硬编码锚点串(用于判断 HEAD 是否仍是改前版本) */
  headAnchor: string
}

const PAGES: PageContract[] = [
  {
    source: 'app/(main)/developer/api-docs/page.tsx',
    fromRoot: 'apps/web/app/(main)/developer/api-docs/page.tsx',
    nsLiteral: 'developerApiDocsPage',
    nsPath: ['developerApiDocsPage'],
    groups: ['endpoints', 'sections', 'steps', 'auth', 'rateLimit', 'billing'],
    leafKeys: [],
    minReferenced: 60,
    headAnchor: "desc: 'OpenAI 兼容对话'",
  },
  {
    source: 'app/(main)/models/api-docs/page.tsx',
    fromRoot: 'apps/web/app/(main)/models/api-docs/page.tsx',
    nsLiteral: 'models',
    nsPath: ['models'],
    groups: [],
    leafKeys: ['apiDocs.auth.headerFormat'],
    minReferenced: 15,
    headAnchor: '# Header 格式',
  },
]

type Pack = Record<string, unknown>

function readJson(file: string): Pack {
  return JSON.parse(readFileSync(file, 'utf8')) as Pack
}

const packCache = new Map<Locale, Pack>()
/** ① 已提交语言包 */
function committedPack(loc: Locale): Pack {
  const hit = packCache.get(loc)
  if (hit) return hit
  const p = readJson(path.join(MESSAGES, `${loc}.json`))
  packCache.set(loc, p)
  return p
}

let batchCache: Record<string, Pack> | null | undefined
/** ② 合并前临时清单(不存在=已合并完成,返回 null 而不是报错) */
function batchPack(): Record<string, Pack> | null {
  if (batchCache !== undefined) return batchCache
  batchCache = existsSync(BATCH) ? (readJson(BATCH) as Record<string, Pack>) : null
  return batchCache
}

function at(obj: unknown, p: string[]): unknown {
  let cur = obj
  for (const seg of p) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

/** 把命名空间子树摊平成 "a.b" → 字符串值 */
function flatLeaves(obj: unknown, prefix = ''): Record<string, string> {
  if (obj === null || obj === undefined) return {}
  if (typeof obj !== 'object') return prefix ? { [prefix]: String(obj) } : {}
  const acc: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    Object.assign(acc, flatLeaves(v, prefix ? `${prefix}.${k}` : k))
  }
  return acc
}

/**
 * ①+② 解析:语言包优先,缺失键用临时清单增量填充。
 * 返回"该命名空间下的全键值表" + 该键值表是否仍有键拿不到。
 */
function resolveLeaves(page: PageContract, loc: Locale): Record<string, string> {
  const fromPack = flatLeaves(at(committedPack(loc), page.nsPath))
  const batch = batchPack()
  if (!batch) return fromPack
  const fromBatch = flatLeaves(at(batch[loc] as Pack | undefined, page.nsPath))
  return { ...fromBatch, ...fromPack }
}

/** 本批新增键(分组子树 + 单叶子)的全键路径 */
function newKeys(page: PageContract): string[] {
  const all = Object.keys(resolveLeaves(page, 'zh-CN'))
  const inGroups = all.filter((k) => page.groups.some((g) => k === g || k.startsWith(`${g}.`)))
  return [...inGroups, ...page.leafKeys].sort()
}

/**
 * 精确抽键:`const t = useTranslations('ns')` / `getTranslations('ns')` 绑定的变量实参,
 * 加上非组件常量表里的 `*Key: '...'` 字面量(descKey 这类渲染处 t(x.key) 取词的形态)。
 * 与 family 契约同一思路,但这里允许点号路径(endpoints.chatCompletions 这种嵌套写法)。
 */
function referencedKeys(src: string, nsLiteral: string): Set<string> {
  const varToNs = new Map<string, string>()
  for (const m of src.matchAll(
    /const\s+(\w+)\s*=\s*(?:await\s+)?(?:use|get)Translations\(\s*'([^']+)'\s*\)/g,
  )) {
    varToNs.set(m[1] as string, m[2] as string)
  }
  const keys = new Set<string>()
  for (const [v, ns] of varToNs) {
    if (ns !== nsLiteral) continue
    for (const m of src.matchAll(new RegExp(`\\b${v}\\(\\s*'([A-Za-z0-9_.]+)'`, 'g'))) {
      keys.add(m[1] as string)
    }
  }
  for (const m of src.matchAll(/\b\w*[Kk]ey:\s*'([A-Za-z0-9_.]+)'/g)) keys.add(m[1] as string)
  return keys
}

const HAN = /[一-鿿]/
const ph = (s: string): string => (s.match(/\{[A-Za-z0-9_]+\}/g) ?? []).sort().join(',')

/** 递归找"键名本身含点号"的条目(next-intl 字面含点键永不渲染) */
function dottedKeyNames(obj: unknown, p: string[] = []): string[] {
  if (!obj || typeof obj !== 'object') return []
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    k.includes('.') ? [[...p, k].join('.')] : dottedKeyNames(v, [...p, k]),
  )
}

/** 权威调用守门 70(不复刻判据),返回 file → 命中数 */
function gate70Counts(): Map<string, number> {
  const out = path.join(REPO_ROOT, '.ihui-agent/tmp/vitest-devdocs-zh-scan.json')
  execFileSync(process.execPath, ['scripts/scan-hardcoded-zh.mjs', '--json', out], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'ignore'],
    maxBuffer: 64 * 1024 * 1024,
  })
  const parsed = JSON.parse(readFileSync(out, 'utf8')) as {
    files?: Array<{ file: string; count: number }>
  }
  const map = new Map<string, number>()
  for (const row of parsed.files ?? []) map.set(row.file, row.count)
  return map
}

function gitShowHead(relFromRoot: string): string {
  return execFileSync('git', ['-c', 'safe.directory=*', 'show', `HEAD:${relFromRoot}`], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  })
}

const norm = (s: string): string => s.replace(/\s+/g, ' ')

describe.each(PAGES)('两页取词契约 $nsLiteral', (page: PageContract) => {
  const src = readFileSync(path.join(WEB_ROOT, page.source), 'utf8')
  const referenced = referencedKeys(src, page.nsLiteral)
  const owned = newKeys(page)
  const zhLeaves = resolveLeaves(page, 'zh-CN')

  it('哨兵:源码解析到的取词键达到下限(整体改动丢失时这里先红)', () => {
    expect(
      referenced.size,
      `${page.nsLiteral} 只解析到 ${referenced.size} 个取词键`,
    ).toBeGreaterThanOrEqual(page.minReferenced)
    expect(owned.length, `${page.nsLiteral} 本批新增键数量异常`).toBeGreaterThanOrEqual(
      page.leafKeys.length,
    )
  })

  it('本批新增键五语言都有非空值', () => {
    const missing = LOCALES.flatMap((loc) => {
      const leaves = resolveLeaves(page, loc)
      return owned
        .filter((k) => typeof leaves[k] !== 'string' || leaves[k] === '')
        .map((k) => `${loc}.${page.nsLiteral}.${k}`)
    })
    expect(missing, `缺键/空值 ${missing.slice(0, 8).join(', ')}`).toEqual([])
  })

  it('源码引用的每个键都能解析到非空值(含改前已取词的旧键)', () => {
    const bad = LOCALES.flatMap((loc) => {
      const leaves = resolveLeaves(page, loc)
      return [...referenced]
        .filter((k) => typeof leaves[k] !== 'string' || leaves[k] === '')
        .map((k) => `${loc}.${page.nsLiteral}.${k}`)
    })
    expect(bad, `引用了取不到值的键 ${bad.slice(0, 8).join(', ')}`).toEqual([])
  })

  it('本批新增键集合五语言完全一致', () => {
    const base = owned
    for (const loc of LOCALES) {
      const leaves = Object.keys(resolveLeaves(page, loc)).filter((k) => {
        return (
          page.groups.some((g) => k === g || k.startsWith(`${g}.`)) || page.leafKeys.includes(k)
        )
      })
      expect([...leaves].sort(), `${loc} 本批分组键集合漂移`).toEqual(base)
    }
  })

  it('键名不含点号(next-intl 字面含点键永不渲染)', () => {
    const bad: string[] = []
    for (const loc of LOCALES) {
      for (const pack of [committedPack(loc), batchPack()?.[loc]]) {
        if (!pack) continue
        bad.push(...dottedKeyNames(at(pack, page.nsPath), page.nsPath).map((k) => `${loc}.${k}`))
      }
    }
    expect(bad, `${page.nsLiteral} 出现含点键名`).toEqual([])
  })

  it('ko/en 新增值无汉字,且 ICU 占位符各语言逐一保留', () => {
    for (const loc of ['ko', 'en'] as Locale[]) {
      const leaves = resolveLeaves(page, loc)
      for (const k of owned) {
        expect(HAN.test(leaves[k] ?? ''), `${loc}.${k} 含汉字: ${leaves[k]}`).toBe(false)
      }
    }
    for (const loc of LOCALES) {
      const leaves = resolveLeaves(page, loc)
      for (const k of owned) {
        expect(ph(leaves[k] ?? ''), `${loc}.${k} 占位符漂移`).toBe(ph(zhLeaves[k] ?? ''))
      }
    }
  })

  it('本批分组内不存在"语言包有、源码不引用"的孤儿键', () => {
    const unused = owned.filter((k) => !referenced.has(k)).sort()
    expect(unused, `${page.nsLiteral} 孤儿键 ${unused.join(', ')}`).toEqual([])
  })

  it('zh-CN 新增值与 HEAD 原文逐字符一致(HEAD 仍是改前版本时才跑)', () => {
    const head = norm(gitShowHead(page.fromRoot))
    if (!head.includes(page.headAnchor)) {
      // HEAD 已包含本次取词改动 ⇒ 原文锚点不存在,对账基准失效,跳过而不是假绿
      expect(head.includes(page.headAnchor), 'HEAD 已合入取词改动,逐字符对账自动跳过').toBe(false)
      return
    }
    const drift = owned.filter((k) => !head.includes(norm(zhLeaves[k] ?? '')))
    expect(drift, `以下 zh-CN 值在 HEAD 原文里找不到逐字符对应:${drift.join(', ')}`).toEqual([])
  })
})

describe('守门 70 实测:两页硬编码中文命中归零', () => {
  const counts = gate70Counts()
  for (const page of PAGES) {
    it(`${page.fromRoot} 命中 0 处`, () => {
      expect(counts.get(page.fromRoot) ?? 0, '仍有硬编码中文').toBe(0)
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
