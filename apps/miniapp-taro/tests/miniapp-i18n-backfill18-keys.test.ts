// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 小程序「tt(key,'中文兜底') 未进包」键集结构锁 —— 本批 18 枚补齐后的守门(形态照 packages/i18n/tests/miniapp-edu-attendance-keys.test.ts)。
//
// 立因:下列六枚页面里有一批 `tt(key,'中文兜底')` 取值**从未进过任何一份语言包**。
// loader 取不到键时回落到调用点第二参,于是中文正常、其余四语在屏上直接读出中文兜底。
// 2026-11-06 把这 18 枚补进五语包,本锁把这格钉住:防止被摘掉、防止只补四语、防止同族造第二套说法。
//
// 为什么提交链上的门拦不住它(实测,不是猜):`check-i18n-keys.mjs` 的「端内引用键缺失」
// 判据要 `--target=miniapp-taro` 才成立,而 scripts/guardian-runner.mjs 里这道门共登记 5 条
// —— [] (=web)、--target=extension、--target=shared、--parity-only、
// --target=mobile-rn --parity-only —— **零条指向 miniapp-taro**;根 package.json
// `check:i18n-keys` 无参 ⇒ web;CI i18n-check.yml 只跑那一条。所以这一族在提交链与 CI
// 都是零覆盖,本测试把它补在测试面,与门无关地先响起来。
//
// 取材面(与参照件不同,是刻意的):五语包一律读 **HEAD blob**。
// 理由:packages/i18n/messages/miniapp-taro/ko.json 的工作树副本由别席持有(在飞),本票只能把
// ko 以 blob 形式交回、由主会话与四语同批落地;读工作树会把「别人的副本还没并进来」误判成
// 「本批内容丢了」。读 HEAD 判的才是已提交的真值(口径同 AGENTS.md §0.4 全量档判 HEAD blob)。
// 取不到 HEAD blob ⇒ 直接判死,绝不据此报绿(§0.3)。
//
// 射程边界(不得读成「端内引用全覆盖」):
//   B1 只判**带中文兜底字面量**的静态引用 tt('a.b','中文'):与 check-i18n-keys 缺失键口径一致。
//      无兜底的 `t('TagInput.p1')`(apps/miniapp-taro/src/components/TagInput.tsx:19)实测五语皆无,
//      既不属本批 18 枚、也不在门与 CI 的射程里 ⇒ 本锁不覆盖它,盲区在此点名不静默。
//   B2 不判「zh-CN 取值必须逐字等于调用点兜底」:实测本批 18 枚满足,但同六页里有 4 枚早于本批
//      就不满足(pay.wechat/pay.alipay/pay.balance 的兜底是单字「微/支/余」,词包是「微信支付/支付宝/
//      余额」;pay.configNotReady 兜底「支付宝支付配置未就绪」,词包「支付配置未就绪,请联系管理员」)。
//      照抄成绝对判据即恒红锁(§12e),该族另票清偿。
//   B3 不判「同义异键必须同值」:实测 index.toast.loginRequired ↔ ai.aiAssistant.pleaseLogin
//      的 zh 同值而 en/ko 异值,同样早于本批存在 ⇒ 不写进本锁的判据。

import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..')
const MESSAGES_ROOT = 'packages/i18n/messages/miniapp-taro'
const SHARED_ROOT = 'packages/i18n/messages/shared'
const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const
type Locale = (typeof LOCALES)[number]

/** 被钉页面(键清单逐枚从源码现读 ⇒ 不写死键表,新增引用自动进射程) */
const PAGE_SOURCES = [
  'apps/miniapp-taro/src/components/BottomActionBar.tsx',
  'apps/miniapp-taro/src/components/LevelBadge.tsx',
  'apps/miniapp-taro/src/components/LoginPopUp.tsx',
  'apps/miniapp-taro/src/components/TagInput.tsx',
  'apps/miniapp-taro/src/pages/index/index.tsx',
  'apps/miniapp-taro/src/pkg-shop/pay/index.tsx',
] as const

/** 本票触及的命名空间族(L2 逐族判五语键集一致) */
const TICKET_NAMESPACES = [
  'BottomActionBar',
  'level',
  'TagInput',
  'login',
  'user',
  'index.toast',
  'pay',
] as const

/** L3 的族按「命名空间 + 键名前缀」声明,成员从词包现读,不抄键名表 */
const DISTINCT_FAMILIES: { ns: string; prefix: string }[] = [
  { ns: 'level', prefix: '' }, // 八个段位
  { ns: 'index.toast', prefix: 'compact' }, // 四条压缩提示
  { ns: 'BottomActionBar', prefix: 'compact' }, // 按钮态 vs 进行中态
]

function gitShowHead(relPath: string): string {
  const r = spawnSync('git', ['show', `HEAD:${relPath}`], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (r.status !== 0 || typeof r.stdout !== 'string') {
    throw new Error(
      `取不到 HEAD blob ${relPath}(不据此报绿;status=${r.status} stderr=${String(r.stderr ?? '').trim()})`,
    )
  }
  return r.stdout
}

type Pack = Record<string, unknown>

const packCache = new Map<string, Pack>()

function readPack(locale: Locale): Pack {
  const rel = `${MESSAGES_ROOT}/${locale}.json`
  const cached = packCache.get(rel)
  if (cached) return cached
  const parsed = JSON.parse(gitShowHead(rel)) as Pack
  packCache.set(rel, parsed)
  return parsed
}

function readShared(locale: Locale): Pack {
  const rel = `${SHARED_ROOT}/${locale}.json`
  const cached = packCache.get(rel)
  if (cached) return cached
  const parsed = JSON.parse(gitShowHead(rel)) as Pack
  packCache.set(rel, parsed)
  return parsed
}

function getByPath(root: unknown, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((acc, seg) => {
    if (acc && typeof acc === 'object' && !Array.isArray(acc)) {
      return (acc as Record<string, unknown>)[seg]
    }
    return undefined
  }, root)
}

/** 词包或 shared 基础包,取其一(口径同参照件) */
function resolveValue(locale: Locale, key: string): unknown {
  return getByPath(readPack(locale), key) ?? getByPath(readShared(locale), key)
}

/** 与 check-i18n-keys.mjs 同口径的剥注释(注释里的示例不是发射点) */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

/** 带中文兜底字面量的静态引用:`tt('a.b', '中文')` / `t("a.b", "中文")`(见 B1) */
function fallbackRefsOf(src: string): string[] {
  const code = stripComments(src)
  const out = new Set<string>()
  const re = /\b(?:t|tt)\(\s*['"]([A-Za-z][\w]*(?:\.[\w]+)+)['"]\s*,\s*['"][^'"]*['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) out.add(m[1]!)
  return [...out].sort()
}

function consumedRefs(): { file: string; key: string }[] {
  const rows: { file: string; key: string }[] = []
  for (const rel of PAGE_SOURCES) {
    let src: string
    try {
      src = gitShowHead(rel)
    } catch (e) {
      throw new Error(`反证锁取不到页面源 ${rel}(不据此报绿):${String(e)}`)
    }
    for (const key of fallbackRefsOf(src)) rows.push({ file: rel, key })
  }
  return rows
}

function placeholdersOf(value: string): string[] {
  return [...value.matchAll(/\{\{?(\w+)\}?\}/g)].map((m) => m[1]!).sort()
}

function nodeOf(pack: Pack, ns: string): Pack | undefined {
  const node = getByPath(pack, ns)
  return node && typeof node === 'object' && !Array.isArray(node) ? (node as Pack) : undefined
}

/** 族成员:命名空间 ns 下键名以 prefix 起头的全部取值(词包现读,不是抄来的清单) */
function familyValues(
  locale: Locale,
  ns: string,
  prefix: string,
): { key: string; value: string }[] {
  const node = nodeOf(readPack(locale), ns)
  if (!node) return []
  return Object.entries(node)
    .filter(([k]) => k.startsWith(prefix))
    .map(([k, v]) => ({ key: `${ns}.${k}`, value: String(v) }))
}

describe('miniapp tt 兜底键五语补齐结构锁(本批 18 枚)', () => {
  const refs = consumedRefs()

  it('L0 射程非空:六枚页面各自都贡献了带兜底的取词引用(0 候选不许当"已覆盖")', () => {
    expect(refs.length, '带兜底的静态取词引用总数').toBeGreaterThan(0)
    for (const rel of PAGE_SOURCES) {
      expect(
        refs.some((r) => r.file === rel),
        `${rel} 一枚带兜底引用都没扫到 ⇒ 取词形态被改写或整页被摘,本锁已成空锁`,
      ).toBe(true)
    }
    for (const ns of TICKET_NAMESPACES) {
      expect(
        refs.some((r) => r.key.startsWith(`${ns}.`)),
        `页面引用集里没有 ${ns}.* ⇒ 命名空间改名或整族被摘,本锁这一族已空转`,
      ).toBe(true)
    }
  })

  it('L1 页面里每一枚带兜底的键在五语都有非空字符串取值(缺=该语言在屏上读中文兜底)', () => {
    for (const { file, key } of refs) {
      for (const lang of LOCALES) {
        const value = resolveValue(lang, key)
        expect(
          value,
          `${file} 引用 ${key},但 miniapp-taro/${lang}(含 shared)取不到 ⇒ 该语言回落中文兜底`,
        ).toBeTypeOf('string')
        expect(
          (value as string).trim().length,
          `${file} 引用 ${key},但 ${lang} 取值是空串(空串=另一种用户可见缺陷)`,
        ).toBeGreaterThan(0)
        expect(value, `${lang}: ${key} 的取值等于键名本身(=把"没翻译"写成了文案)`).not.toBe(key)
      }
    }
  })

  it('L2 本票触及的命名空间在五语键集完全一致(补齐不许只落四语)', () => {
    for (const ns of TICKET_NAMESPACES) {
      const sets = LOCALES.map((lang) => {
        const node = nodeOf(readPack(lang), ns)
        expect(node, `miniapp-taro/${lang}.json 缺 ${ns} 命名空间`).toBeDefined()
        return Object.keys(node as Pack)
          .sort()
          .join(',')
      })
      for (let i = 1; i < LOCALES.length; i++) {
        expect(sets[i], `${ns}: ${LOCALES[i]} 键集与 ${LOCALES[0]} 不一致`).toBe(sets[0])
      }
    }
  })

  it('L3 段位族与压缩提示族在同语言内不得同字(同值=把两种状态渲染成同一张脸)', () => {
    for (const fam of DISTINCT_FAMILIES) {
      const members = familyValues('zh-CN', fam.ns, fam.prefix)
      expect(
        members.length,
        `族 ${fam.ns}.${fam.prefix}* 在 zh-CN 少于 2 枚 ⇒ 本判据空转(不得读成通过)`,
      ).toBeGreaterThan(1)
    }
    for (const lang of LOCALES) {
      for (const fam of DISTINCT_FAMILIES) {
        const got = familyValues(lang, fam.ns, fam.prefix)
        expect(got.length, `${lang}: 族 ${fam.ns}.${fam.prefix}* 成员数与 zh-CN 不一致`).toBe(
          familyValues('zh-CN', fam.ns, fam.prefix).length,
        )
        const dup = got.filter((row, i) => got.findIndex((o) => o.value === row.value) !== i)
        expect(
          dup.map((d) => `${d.key}="${d.value}"`),
          `${lang}: ${fam.ns}.${fam.prefix}* 族内取值重复`,
        ).toHaveLength(0)
      }
    }
  })

  it('L4 中文不同 ⇒ 外语不得同值(同一语言里不许把两种说法翻成同一句)', () => {
    const rows = refs
      .map((r) => r.key)
      .filter((key, i, arr) => arr.indexOf(key) === i)
      .map((key) => ({ key, zh: resolveValue('zh-CN', key) }))
      .filter((r): r is { key: string; zh: string } => typeof r.zh === 'string')
    expect(rows.length, '可比对的行数 0 ⇒ 本判据空转').toBeGreaterThan(0)
    for (const lang of LOCALES) {
      if (lang === 'zh-CN') continue
      const collisions: string[] = []
      for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
          const a = rows[i]!,
            b = rows[j]!
          if (a.zh === b.zh) continue
          const va = resolveValue(lang, a.key)
          const vb = resolveValue(lang, b.key)
          if (typeof va === 'string' && va === vb)
            collisions.push(`${lang}: ${a.key} / ${b.key} 同为 "${va}"`)
        }
      }
      expect(collisions, `${lang} 出现"中文不同而译文同值"`).toHaveLength(0)
    }
  })

  it('L5 带插值的键在五语用的是同一组占位符名(少一个=渲染成 "已选模型: ")', () => {
    const interpolated = refs
      .map((r) => r.key)
      .filter((key, i, arr) => arr.indexOf(key) === i)
      .filter((key) => {
        const v = resolveValue('zh-CN', key)
        return typeof v === 'string' && placeholdersOf(v).length > 0
      })
    expect(
      interpolated.length,
      '射程内一枚带占位符的键都没有 ⇒ 本判据在空转(不得读成通过)',
    ).toBeGreaterThan(0)
    for (const key of interpolated) {
      const base = placeholdersOf(String(resolveValue('zh-CN', key)))
      for (const lang of LOCALES) {
        if (lang === 'zh-CN') continue
        const got = resolveValue(lang, key)
        if (typeof got !== 'string') continue
        expect(placeholdersOf(got), `${key}: ${lang} 的占位符集与 zh-CN 不一致`).toStrictEqual(base)
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
