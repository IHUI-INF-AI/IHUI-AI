// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 常驻清单(**不是卡口**):`apps/mobile-rn/vitest.config.ts` 的 alias → 落点映射。
 *
 * 为什么有这一份(G-364 一族的余量,2026-10-15 现读,不转述):
 * 那条 alias 表把 `@ihui/shared` 家族里若干说明符指到 `tests/__mocks__/` 下的手写文件。
 * 既有的三份 `-alias-fidelity` 兄弟锁各自只钉**一个** subject(auth / api-client / constants),
 * 其余几条无人扫 —— 换个人再来加一条指向替身的别名,没有任何常驻物会报名。
 * 本票把整张表做成机器可见的观测清单:先把这一族从"没人看守"变成"看得见";
 * 逐格要不要转指真实现另计(那是产品/端 owner 的裁决,本票不代裁、不为它改判据)。
 *
 * 语义是**观测**:
 *   - 每一行只做"报名"(打印 + 进 ROWS),**没有任何一种命中会红**;
 *   - 这是 §12e/§12f 恒红门禁令的直接后果 —— 判机器态/判历史存量的门做成 blocking
 *     只能逼人 `--no-verify`,连带废掉全部守门。
 *
 * 唯一会红的方向是**这把扫描自己瞎了**:别名表解析出 0 条、落点文件不存在、
 * 清单行数与机器重算不一致 —— 那些是"清单不见了",必须红。
 *
 * 四列读数:
 *   C1 pkg    : 从说明符按 scope 规则取包名(`@scope/name` 取两段,裸名取一段)。
 *   C2 exports: 该包名在 workspace(`packages/*`、`apps/*` 的 package.json `name`)
 *              或 node_modules 里是否存在、是否带 exports 表,并报覆盖本说明符的那个 key。
 *              `'./utils'` 与 `'./utils/*'` 是两件事 —— "能不能转指真实现"靠这一格读出来。
 *   C3 target : 落点是否真在 __mocks__ 目录下且文件在位。
 *   C4 头注理由: 二分。**粗糙机读,负号不等于人读也没有**(会有假阴性那一型),
 *              所以头注首行随賃打印给人复核:
 *              · headNamesReal —— 头注有没有点名被替换的真实源(`packages/<包>/src/` 形态);
 *              · headWhy —— 头注里有没有"为什么不能指真"的 blocker 措辞(词表见 WHY_MARKERS);
 *              · reasonElsewhere —— 头注没写、但文件别处的注释写了(理由写在后面的那一档)。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url))
const RN_DIR = path.resolve(TESTS_DIR, '..')
const REPO_ROOT = path.resolve(RN_DIR, '..', '..')
const CONFIG_FILE = path.join(RN_DIR, 'vitest.config.ts')

/** "为什么不能指真"的机读 blocker 措辞登记处。加词 = 放宽机器那一档,必须在提交消息里写明放宽了哪一格。 */
const WHY_MARKERS = [
  // 工具链/解析器层
  'esbuild',
  'SyntaxError',
  'typeof',
  'MODULE_NOT_FOUND',
  'EISDIR',
  '解析失败',
  '无法解析',
  '解不了',
  'Flow 源码',
  // 原生/平台依赖层
  '原生依赖',
  '原生模块',
  'expo-modules-core',
  // 结构层
  'transitively imports',
  '循环依赖',
  'circular',
  // 显式自述"这是替身/不能指真"那一类
  'Replaces the real',
  '不能指真',
  '不可指真',
  '测替身',
  '测的是 mock',
  '测的就是 mock',
]

/** `packages/<包>/src/` 形态 —— 替身点名了它所替换的那份真实源码 */
const RE_REAL_SOURCE = /packages\/[A-Za-z0-9_.-]+\/src\//

/**
 * 从 vitest.config.ts 的 alias 字面量按**源序**取 `key → 相对 __dirname 的目标`。
 * 必须同时吃单行与多行两种书写、吃下尾随逗号,也要吃 **不带引号的键** —— `nativewind:` 就是裸键,
 * 只认引号的解析会把整条别名看成不存在,而"没扫到"在本族必须判红而不是判绿。
 */
function aliasEntriesFromConfig(): Array<{ key: string; target: string }> {
  const src = readFileSync(CONFIG_FILE, 'utf8')
  const re =
    /("(?:[^"]+)"|'(?:[^']+)'|[A-Za-z@][A-Za-z0-9@._/-]*)\s*:\s*resolve\(\s*__dirname\s*,\s*'([^']+)'\s*,?\s*\)/g
  const entries: Array<{ key: string; target: string }> = []
  for (const m of src.matchAll(re)) {
    const rawKey = m[1] as string
    const quoted = rawKey.startsWith("'") || rawKey.startsWith('"')
    entries.push({ key: quoted ? rawKey.slice(1, -1) : rawKey, target: m[2] as string })
  }
  return entries
}

const ALIAS_ENTRIES = aliasEntriesFromConfig()

/** 落点在不在 __mocks__ 目录下 —— 本清单的定义面(判据是目录段,不是 glob 匹配) */
function isMockTarget(target: string): boolean {
  return target.split('/').includes('__mocks__')
}

const MOCK_ENTRIES = ALIAS_ENTRIES.filter((e) => isMockTarget(e.target))

function packageNameOf(key: string): string {
  const seg = key.split('/')
  return key.startsWith('@') ? seg.slice(0, 2).join('/') : (seg[0] as string)
}

function subpathOf(key: string): string | null {
  const pkg = packageNameOf(key)
  return key === pkg ? null : key.slice(pkg.length + 1)
}

/** workspace 包名 → 目录。以各 package.json 的 `name` 字段为唯一真相源,不手抄名单。 */
function workspaceRegistry(): Map<string, string> {
  const out = new Map<string, string>()
  for (const root of [path.join(REPO_ROOT, 'packages'), path.join(REPO_ROOT, 'apps')]) {
    let dirs
    try {
      dirs = readdirSync(root, { withFileTypes: true })
    } catch {
      continue
    }
    for (const d of dirs) {
      if (!d.isDirectory()) continue
      const pj = path.join(root, d.name, 'package.json')
      if (!existsSync(pj)) continue
      try {
        const pkg = JSON.parse(readFileSync(pj, 'utf8')) as { name?: unknown }
        if (typeof pkg.name === 'string') out.set(pkg.name, path.join(root, d.name))
      } catch {
        continue
      }
    }
  }
  return out
}

const WORKSPACE = workspaceRegistry()

function resolvePackageDir(pkg: string): { dir: string | null; registry: string } {
  const ws = WORKSPACE.get(pkg)
  if (ws) return { dir: ws, registry: 'workspace' }
  for (const base of [path.join(REPO_ROOT, 'node_modules'), path.join(RN_DIR, 'node_modules')]) {
    const cand = path.join(base, pkg, 'package.json')
    if (existsSync(cand)) return { dir: path.join(base, pkg), registry: 'node_modules' }
  }
  return { dir: null, registry: '未解析' }
}

/**
 * 覆盖本说明符的那个 exports key。三态必须可分辨:字面子路径 / 通配 / 不覆盖 ——
 * 含糊成一档就丢了"这一格能不能直指真实现"的全部信息。
 */
function exportsKeyFor(exportsField: unknown, subpath: string | null): string {
  if (!exportsField || typeof exportsField !== 'object' || Array.isArray(exportsField)) {
    return '(无 exports 表)'
  }
  const keys = Object.keys(exportsField as Record<string, unknown>)
  if (subpath === null) return keys.includes('.') ? '.' : '(缺 "." 根导出)'
  const want = `./${subpath}`
  if (keys.includes(want)) return want
  const wild = keys.filter((k) => k.endsWith('/*') && `${want}/`.startsWith(k.slice(0, -1)))
  if (wild.length > 0) return wild.join(' | ')
  return '(exports 表不覆盖)'
}

/**
 * 取注释文本。两个结果:`head` = 第一条代码语句之前的头注,`all` = 全文注释。
 * 两个都要是因为"头注写了没有"与"文件里别处写了没有"是两种不同的备案强度,合并成一句会丢信息。
 * 不处理模板串里的 `${}` 续接(本族替身没有这种写法,真遇上会被当成代码提前截断)。
 */
function scanComments(src: string): { head: string; all: string } {
  let head = ''
  let all = ''
  let headDone = false
  let state: 'code' | 'line' | 'block' | "'" | '"' | '`' = 'code'
  let i = 0
  while (i < src.length) {
    const ch = src[i] as string
    const nx = src[i + 1]
    if (state === 'code') {
      if (ch === '/' && nx === '/') {
        state = 'line'
        i += 2
        continue
      }
      if (ch === '/' && nx === '*') {
        state = 'block'
        i += 2
        continue
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        headDone = true
        state = ch
        i += 1
        continue
      }
      if (ch !== ' ' && ch !== '\n' && ch !== '\r' && ch !== '\t') headDone = true
      i += 1
      continue
    }
    if (state === 'line') {
      if (ch === '\n') {
        state = 'code'
        head += '\n'
        all += '\n'
        i += 1
        continue
      }
      all += ch
      if (!headDone) head += ch
      i += 1
      continue
    }
    if (state === 'block') {
      if (ch === '*' && nx === '/') {
        state = 'code'
        i += 2
        all += ' '
        if (!headDone) head += ' '
        continue
      }
      const plain = ch === '\n' ? '\n' : ch
      all += plain
      if (!headDone) head += plain
      i += 1
      continue
    }
    if (ch === '\\') {
      i += 2
      continue
    }
    if (state === ch) {
      state = 'code'
      i += 1
      continue
    }
    i += 1
  }
  return { head, all }
}

function hitMarkers(text: string): string[] {
  const lower = text.toLowerCase()
  return WHY_MARKERS.filter((w) => lower.includes(w.toLowerCase()))
}

type Row = {
  alias: string
  pkg: string
  subpath: string | null
  registry: string
  exportsKey: string
  target: string
  targetExists: boolean
  headFirstLine: string
  headNamesReal: boolean
  headWhy: string[]
  reasonElsewhere: boolean
}

function buildRow(entry: { key: string; target: string }): Row {
  const pkg = packageNameOf(entry.key)
  const subpath = subpathOf(entry.key)
  const { dir, registry } = resolvePackageDir(pkg)
  let exportsKey = '(未解析)'
  if (dir !== null) {
    try {
      const pkgJson = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
        exports?: unknown
      }
      exportsKey = exportsKeyFor(pkgJson.exports, subpath)
    } catch {
      exportsKey = '(package.json 不可读)'
    }
  }
  const targetAbs = path.resolve(RN_DIR, entry.target)
  let head = ''
  let all = ''
  if (existsSync(targetAbs)) {
    const got = scanComments(readFileSync(targetAbs, 'utf8'))
    head = got.head
    all = got.all
  }
  const headWhy = hitMarkers(head)
  const headFirst =
    head
      .split('\n')
      .map((l) => l.trim())
      .find(
        (l) =>
          l.length > 0 &&
          !l.includes('IHUI-AI-PROVENANCE') &&
          !l.includes('Provenance-watermarked') &&
          !l.includes('2026 IHUI AI'),
      ) ?? '(无头注)'
  return {
    alias: entry.key,
    pkg,
    subpath,
    registry,
    exportsKey,
    target: entry.target,
    targetExists: existsSync(targetAbs),
    headFirstLine: headFirst.slice(0, 90),
    headNamesReal: RE_REAL_SOURCE.test(head),
    headWhy,
    reasonElsewhere: hitMarkers(all).filter((w) => !headWhy.includes(w)).length > 0,
  }
}

const ROWS: Row[] = MOCK_ENTRIES.map(buildRow)

function renderRow(r: Row): string {
  return [
    `alias=${r.alias}`,
    `pkg=${r.pkg}${r.subpath === null ? '' : ` (sub=${r.subpath})`}`,
    `registry=${r.registry}`,
    `exportsKey=${r.exportsKey}`,
    `target=${r.target}${r.targetExists ? '' : ' [文件缺失]'}`,
    `headNamesReal=${r.headNamesReal}`,
    `headWhy=${r.headWhy.length === 0 ? '(未命中)' : r.headWhy.join(',')}`,
    `reasonElsewhere=${r.reasonElsewhere}`,
    `head=${r.headFirstLine}`,
  ].join(' | ')
}

describe('C0 · 这把扫描自己不能瞎(唯一会红的方向)', () => {
  it('别名表解析出条目,且至少有一条落点在 __mocks__ 下', () => {
    expect(
      ALIAS_ENTRIES.length,
      'vitest.config.ts 里没解析出任何别名条目 => 判据失明',
    ).toBeGreaterThan(0)
    expect(
      MOCK_ENTRIES.length,
      '一条落向 __mocks__ 的别名都没扫到 => 本清单没东西可报名',
    ).toBeGreaterThan(0)
  })

  it('每个 alias 的落点文件都在位', () => {
    const missing = ROWS.filter((r) => !r.targetExists).map((r) => `${r.alias} -> ${r.target}`)
    expect(missing, `落点文件缺失:${missing.join(' | ')}`).toEqual([])
  })

  it('包名与 exports key 能独立重算出同一批行', () => {
    const again = MOCK_ENTRIES.map(buildRow)
    expect(again.length).toBe(ROWS.length)
    for (let i = 0; i < ROWS.length; i += 1) {
      expect(again[i]?.alias).toBe(ROWS[i]?.alias)
      expect(again[i]?.pkg).toBe(ROWS[i]?.pkg)
      expect(again[i]?.exportsKey).toBe(ROWS[i]?.exportsKey)
    }
  })
})

describe('C1 · 报名读数(本文件在这里只报名,永不因命中而红)', () => {
  it('打印 apps/mobile-rn vitest alias -> __mocks__ 落点清单', () => {
    const table = ROWS.map(renderRow).join('\n')
    console.info(`\n[vitest-alias-stub-manifest] 共 ${ROWS.length} 行(只读,不判红)\n${table}\n`)
    const summary = {
      rows: ROWS.length,
      registryResolved: ROWS.filter((r) => r.registry !== '未解析').length,
      exportsCovered: ROWS.filter((r) => !r.exportsKey.startsWith('(')).length,
      headWhyWritten: ROWS.filter((r) => r.headWhy.length > 0).length,
      headNamesReal: ROWS.filter((r) => r.headNamesReal).length,
    }
    console.info(`[vitest-alias-stub-manifest] summary ${JSON.stringify(summary)}\n`)
    expect(summary.rows).toBe(MOCK_ENTRIES.length)
  })
})

describe('C2 · 有牙:四列的计算对合成输入给出正确答案(不是恒真/恒假)', () => {
  it('包名两件:workspace 命中 / 不存在的包 => 未解析', () => {
    expect(resolvePackageDir('@ihui/shared').registry).toBe('workspace')
    expect(packageNameOf('@ihui/shared/utils/date-utils')).toBe('@ihui/shared')
    expect(packageNameOf('react-native')).toBe('react-native')
    expect(resolvePackageDir('@ihui/definitely-not-real').registry).toBe('未解析')
  })

  it('exports key:字面子路径 / 通配 / 不覆盖三态可分辨', () => {
    const table = { '.': 1, './utils': 1, './hooks/*': 1 }
    expect(exportsKeyFor(table, null)).toBe('.')
    expect(exportsKeyFor(table, 'utils')).toBe('./utils')
    expect(exportsKeyFor(table, 'hooks/use-auth')).toBe('./hooks/*')
    expect(exportsKeyFor(table, 'nope')).toBe('(exports 表不覆盖)')
    expect(exportsKeyFor({ './utils': 1 }, null)).toBe('(缺 "." 根导出)')
  })

  it('理由列:写了 blocker 措辞给得出,没写给不出,且能识破"提到了但不在头注"', () => {
    const withWhy = scanComments(
      [
        '// Stub for @ihui/whatever',
        '// 真包带 typeof 类型语法,esbuild 解不了,故不可指真',
        'export const a = 1',
      ].join('\n'),
    )
    expect(hitMarkers(withWhy.head)).toContain('esbuild')
    expect(RE_REAL_SOURCE.test(withWhy.head)).toBe(false)

    const pointsReal = scanComments(
      ['// 对齐 packages/shared/src/hooks/use-auth.ts 的公共签名', 'export const b = 1'].join('\n'),
    )
    expect(RE_REAL_SOURCE.test(pointsReal.head)).toBe(true)
    expect(hitMarkers(pointsReal.head)).toEqual([])

    const elsewhere = scanComments(
      [
        '// Stub for @ihui/whatever',
        'export const c = 1',
        '// 这一段在代码之后:esbuild 解不了 typeof 语法',
      ].join('\n'),
    )
    expect(hitMarkers(elsewhere.head)).toEqual([])
    expect(hitMarkers(elsewhere.all)).toContain('esbuild')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
