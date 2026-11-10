// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 共享屏「只声明组件」派生声明的类型取用锁(承 AGENTS §4 单一口径 / TS2305 事故型)
//
// 现机制(现读,不是猜):
// ① apps/miniapp-taro/types/rn-shells.generated.d.ts 是**生成物**:头注明写由
//    scripts/gen-rn-shell-types.mjs 派生、"手改一律算违规(门 251 C9 判红)"。它现在只声明
//    `@rn-shells/*`(现读为 200 条,数量不写死),每条 declare module 里只有
//    `ComponentType<Record<string, unknown>>` 的值导出,**不透传任何类型**(无 export type/interface)。
// ② 主线 e4951cabd2 之后,端内共享屏改为直载 `@ihui/rn-app/...` 源码模块
//    (如 src/pkg-about/about/help.tsx),声明档里已完全没有 `@ihui/rn-app` 字样。旧锁把射程
//    与阳性对照基线钉在 `@ihui/rn-app/features/help/HelpScreen` 的声明上,该声明消失后旧锁
//    只能对着不存在的对象报绿 —— 判据失效的表现永远是安静,所以射程必须现读、且必须非空。
// ③ 为什么"不得从生成物取类型":该档给的 props 是 Record<string, unknown> 的弱契约,取到的
//    "类型"只是生成物近似;[重新生成]会覆写甚至丢弃手加的 export type,而手改生成物本身违规。
//    生成物只保证"模块存在且导出组件",类型必须回真相源取(@ihui/types 等)。
//
// 本锁口径:射程 = 从声明档现读的 `declare module '@rn-shells/...'` 集合(不手抄、不许为空),
// 任何文件从这些模块取**类型**判红;help.tsx 的 HelpListItem 仍须来自 @ihui/types 单源链。
// 阳性对照:对一枚真实消费者的真实字节做 in-memory 变异(同一条 import 里加 `type X`),断言同一
// 把尺子点名它、对真实字节判 0,并断言把该模块从射程里摘掉后不再命中(证明判据吃的是现读射程)。

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../..')
const DECL_REL = 'apps/miniapp-taro/types/rn-shells.generated.d.ts'
const HELP_REL = 'apps/miniapp-taro/src/pkg-about/about/help.tsx'
const TYPES_APP_PROFILE_REL = 'packages/types/src/app-profile.ts'
const TYPES_APP_REL = 'packages/types/src/app.ts'
const TYPES_INDEX_REL = 'packages/types/src/index.ts'
/** 射程模块名前缀:声明档只照顾这一族(旧的 @ihui/rn-app 声明已整体消失) */
const DECL_PREFIX = '@rn-shells/'
/** 阳性对照的探针类型名:真实字节里一旦出现就说明基线被污染 */
const PROBE_TYPE = '__RnShellTypeLeakProbe'
const IDENT = '[A-Za-z_$][\\w$]*'

/** 被扫描的代码面(与 tsconfig include 的 app 侧一致) */
const SCAN_DIRS = ['apps/miniapp-taro/src', 'apps/miniapp-taro/tests']
const CODE_EXT = ['.ts', '.tsx']

const fileCache = new Map<string, string>()

function read(rel: string): string {
  const cached = fileCache.get(rel)
  if (cached !== undefined) return cached
  // 取不到 ⇒ 直接判死:静默跳过会让这把锁对着空集合报绿(§0.3)
  try {
    const src = readFileSync(join(ROOT, rel), 'utf8')
    fileCache.set(rel, src)
    return src
  } catch (e) {
    throw new Error(`反证锁取不到 ${rel}(不据此报绿):${String(e)}`)
  }
}

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 剥注释:声明档/源码里的示例与横幅不是发射点(与 check-i18n-keys 同口径) */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

/** 声明档自己列出的模块名 —— 射程的唯一来源(不手抄清单,§0.6 单一真相源) */
function declaredModules(declSrc: string): string[] {
  const out: string[] = []
  const re = /^declare\s+module\s+'([^']+)'/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(declSrc)) !== null) {
    if (m[1]) out.push(m[1])
  }
  return out
}

/** 取某条 declare module 的声明块(按花括号配平);取不到返回 '' */
function moduleBlock(declSrc: string, spec: string): string {
  const start = declSrc.indexOf(`declare module '${spec}'`)
  if (start < 0) return ''
  let depth = 0
  for (let i = declSrc.indexOf('{', start); i < declSrc.length; i++) {
    if (declSrc[i] === '{') depth++
    else if (declSrc[i] === '}') {
      depth--
      if (depth === 0) return declSrc.slice(start, i + 1)
    }
  }
  return ''
}

/** 该声明块是否透传类型(export type / export interface)⇒ 「只声明组件」前提是否还成立 */
function blockLeaksTypes(declSrc: string, spec: string): boolean {
  return /\bexport\s+(type|interface)\b/.test(stripComments(moduleBlock(declSrc, spec)))
}

/** 该声明块是否确实导出了值(组件) */
function blockDeclaresValue(declSrc: string, spec: string): boolean {
  return /\bexport\s+(const|default)\b/.test(stripComments(moduleBlock(declSrc, spec)))
}

type ImportStatement = {
  file: string
  spec: string
  kind: 'import' | 'export'
  /** 该语句里被当成「类型」绑定的名字(整条 import type / 行内 type 标记) */
  typeBindings: string[]
  index: number
}

/** 解析 `{ a, type b as c }` 这类具名绑定串,挑出类型侧的名字 */
function splitBindings(body: string, wholeIsType: boolean): string[] {
  const out: string[] = []
  for (const piece of body.split(',')) {
    const text = piece.trim().replace(new RegExp(`\\s+as\\s+${IDENT}$`), '')
    if (!text) continue
    const inline = new RegExp(`^type\\s+(${IDENT})`).exec(text)
    if (inline?.[1]) out.push(inline[1])
    else if (wholeIsType) {
      const only = new RegExp(`^(${IDENT})`).exec(text)
      if (only?.[1]) out.push(only[1])
    }
  }
  return [...new Set(out)].sort()
}

/** 从句子里挑出类型绑定:整条 `import type` 的默认/命名空间绑定也算类型 */
function typeBindingsOfClause(clause: string): string[] {
  const trimmed = clause.trim()
  const wholeIsType = /^type\s+/.test(trimmed)
  const rest = wholeIsType ? trimmed.replace(/^type\s+/, '') : trimmed
  const braces = /\{([\s\S]*?)\}/.exec(rest)
  if (braces) {
    const named = splitBindings(braces[1] ?? '', wholeIsType)
    if (!wholeIsType) return named
    const def = new RegExp(`^(${IDENT})\\b`).exec(rest)
    return def?.[1] ? [...new Set([...named, def[1]])].sort() : named
  }
  if (!wholeIsType) return []
  const def = new RegExp(`^(${IDENT})\\b`).exec(rest)
  if (def?.[1]) return [def[1]]
  const ns = new RegExp(`^\\*\\s+as\\s+(${IDENT})`).exec(rest)
  return ns?.[1] ? [ns[1]] : []
}

/**
 * 解析文件里的静态 import/export ... from 语句(先剥注释)。
 * 三种形态:单行、多行具名(可带整条 type)、多行「默认 + 具名」。
 */
function parseImports(fileRel: string, src: string): ImportStatement[] {
  const code = stripComments(src)
  const out: ImportStatement[] = []
  const seen = new Set<number>()
  const add = (
    index: number,
    kind: ImportStatement['kind'],
    spec: string,
    typeBindings: string[],
  ) => {
    if (seen.has(index) || !spec) return
    seen.add(index)
    out.push({ file: fileRel, spec, kind, typeBindings, index })
  }

  let m: RegExpExecArray | null
  const single = /^[ \t]*(import|export)\b([^\n]*?)\bfrom\s*['"]([^'"]+)['"]/gm
  while ((m = single.exec(code)) !== null) {
    const clause = m[2] ?? ''
    // import('x') / import.meta / import x = require(…) 不进本判据
    if (/^\s*[=(.]/.test(clause)) continue
    add(
      m.index,
      (m[1] ?? 'import') as ImportStatement['kind'],
      m[3] ?? '',
      typeBindingsOfClause(clause),
    )
  }
  const named = /^[ \t]*(import|export)\s+(type\s+)?\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/gm
  while ((m = named.exec(code)) !== null) {
    add(
      m.index,
      (m[1] ?? 'import') as ImportStatement['kind'],
      m[4] ?? '',
      splitBindings(m[3] ?? '', Boolean(m[2])),
    )
  }
  const defaultNamed = new RegExp(
    `^[ \\t]*(import|export)\\s+(${IDENT})\\s*,\\s*\\{([\\s\\S]*?)\\}\\s*from\\s*['"]([^'"]+)['"]`,
    'gm',
  )
  while ((m = defaultNamed.exec(code)) !== null) {
    add(
      m.index,
      (m[1] ?? 'import') as ImportStatement['kind'],
      m[4] ?? '',
      splitBindings(m[3] ?? '', false),
    )
  }
  return out
}

type Violation = { file: string; module: string; bindings: string[] }

/** 找出「从声明档射程内的模块取类型」的写法(整条 import type / 行内 type 标记 / 默认类型) */
function typeImportsFromDeclared(fileRel: string, src: string, declared: Set<string>): Violation[] {
  return parseImports(fileRel, src)
    .filter((stmt) => declared.has(stmt.spec) && stmt.typeBindings.length > 0)
    .map((stmt) => ({ file: fileRel, module: stmt.spec, bindings: stmt.typeBindings }))
}

function listCodeFiles(relDir: string): string[] {
  const abs = join(ROOT, relDir)
  const out: string[] = []
  for (const name of readdirSync(abs)) {
    const childRel = `${relDir}/${name}`
    const childAbs = join(abs, name)
    const st = statSync(childAbs)
    if (st.isDirectory()) out.push(...listCodeFiles(childRel))
    else if (CODE_EXT.some((ext) => name.endsWith(ext))) out.push(childRel)
  }
  return out.sort()
}

/** 真从声明档模块取值的端内文件(静态 import 或动态 import)—— 取值侧非空证明 */
function valueConsumers(declared: Set<string>, dirs: string[]): string[] {
  const out = new Set<string>()
  for (const dir of dirs) {
    for (const rel of listCodeFiles(dir)) {
      const src = read(rel)
      const viaStatic = parseImports(rel, src).some(
        (stmt) =>
          stmt.kind === 'import' && stmt.typeBindings.length === 0 && declared.has(stmt.spec),
      )
      // 别名/动态 import 形态也要算消费者,否则"值侧非空"会被形式误判
      const viaDynamic = [...src.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].some((hit) =>
        declared.has(hit[1] ?? ''),
      )
      if (viaStatic || viaDynamic) out.add(rel)
    }
  }
  return [...out].sort()
}

type Probe = { rel: string; spec: string; statement: RegExpExecArray }

/** 在真实消费者里挑一枚「单行具名 import」形态作为 L3 变异夹具;找不到返回 null */
function findProbe(consumers: string[], declared: Set<string>): Probe | null {
  const specs = [...declared].sort()
  for (const rel of consumers) {
    const src = read(rel)
    for (const spec of specs) {
      const statement = new RegExp(
        `^[ \\t]*import\\s*\\{([^}\\n]*)\\}\\s*from\\s*['"]${escapeRe(spec)}['"]`,
        'm',
      ).exec(src)
      if (statement?.[1]?.trim()) return { rel, spec, statement }
    }
  }
  return null
}

/** 全端扫描:返回所有「从声明档取类型」的违规(空集 = 当前绿) */
function scanRepoForViolations(declared: Set<string>): Violation[] {
  const found: Violation[] = []
  for (const dir of SCAN_DIRS) {
    for (const rel of listCodeFiles(dir)) {
      found.push(...typeImportsFromDeclared(rel, read(rel), declared))
    }
  }
  return found
}

describe('共享屏派生声明:类型必须从单源取(禁从生成物取)', () => {
  const declSrc = read(DECL_REL)
  const declaredList = declaredModules(declSrc)
  const declared = new Set(declaredList)

  it('L0 射程非空且逐条「只声明组件」:零候选、零取值都不许当"已覆盖"', () => {
    expect(declSrc, '读到的不是生成物(头注缺 derived 标记)⇒ 射程来源可疑').toContain(
      'rn-shell-types:derived:begin',
    )
    expect(
      declaredList.length,
      `${DECL_REL} 里一条 declare module 都没扫到 ⇒ 本锁成空锁`,
    ).toBeGreaterThan(0)
    expect(declared.size, 'declare module 名重复 ⇒ 射程集合被吞,判据失真').toBe(declaredList.length)

    // 射程只应是 @rn-shells/*:旧 @ihui/rn-app 声明若回来,说明机制又变了
    const outsiders = declaredList.filter((spec) => !spec.startsWith(DECL_PREFIX))
    expect(
      outsiders,
      `声明档出现非 ${DECL_PREFIX}* 的模块(旧 @ihui/rn-app 声明回来了?)⇒ 机制变了,射程须重估`,
    ).toEqual([])

    // 逐条确认「只声明组件」:不得透传类型,且必须真的有值导出
    const typeLeaks = declaredList.filter((spec) => blockLeaksTypes(declSrc, spec))
    expect(
      typeLeaks,
      '这些 declare module 已开始透传类型 ⇒ 「只声明组件」前提破,本锁需重估',
    ).toEqual([])
    const nonComponents = declaredList.filter((spec) => !blockDeclaresValue(declSrc, spec))
    expect(nonComponents, '这些 declare module 没有任何值导出 ⇒ 声明档形态变了').toEqual([])

    // 取值侧非空:必须真有文件从这些模块取值,否则判据对着空集合报绿
    const consumers = valueConsumers(declared, SCAN_DIRS)
    expect(consumers.length, '全端无一文件从声明档模块取值 ⇒ 判据在空转').toBeGreaterThan(0)
    expect(
      valueConsumers(declared, ['apps/miniapp-taro/src']).length,
      '端内页面一例都没有从声明档取值 ⇒ 射程与真实用法脱节',
    ).toBeGreaterThan(0)
  })

  it('L1 help.tsx 不从声明档取类型,HelpListItem 取自 @ihui/types 单源链', () => {
    const src = read(HELP_REL)
    expect(
      typeImportsFromDeclared(HELP_REL, src, declared),
      `${HELP_REL} 从「只声明组件」的生成物取类型 ⇒ 生成物一重新生成就断`,
    ).toEqual([])

    const listItemImports = parseImports(HELP_REL, src).filter((stmt) =>
      stmt.typeBindings.includes('HelpListItem'),
    )
    expect(
      listItemImports.length,
      'help.tsx 没有以 HelpListItem 名义取类型 ⇒ 本对照基线变了',
    ).toBeGreaterThan(0)
    expect(
      listItemImports.map((stmt) => stmt.spec),
      'HelpListItem 必须整条来自 @ihui/types',
    ).toEqual(['@ihui/types'])
    expect(declared.has('@ihui/types'), '@ihui/types 落进声明档射程 ⇒ 机制变了').toBe(false)

    // 单源三跳必须现读成立(防止"从一份副本取"被当成合规)
    expect(
      /export\s+interface\s+HelpListItem\b/.test(read(TYPES_APP_PROFILE_REL)),
      'packages/types/src/app-profile.ts 已不再声明 HelpListItem ⇒ 单源搬家,本锁需重估',
    ).toBe(true)
    expect(
      /export\s+\*\s+from\s+'\.\/app-profile\.js'/.test(read(TYPES_APP_REL)),
      'app.ts 不再透传 app-profile ⇒ @ihui/types 取不到 HelpListItem',
    ).toBe(true)
    expect(
      /export\s+\*\s+from\s+'\.\/app\.js'/.test(read(TYPES_INDEX_REL)),
      'index.ts 不再透传 app ⇒ @ihui/types 取不到 HelpListItem',
    ).toBe(true)
  })

  it('L2 全端零违规:任何文件都不得从声明档模块取类型', () => {
    const files = SCAN_DIRS.flatMap((dir) => listCodeFiles(dir))
    expect(files.length, '扫描面为空 ⇒ 本判据在空转').toBeGreaterThan(0)
    expect(scanRepoForViolations(declared), '出现「从只声明组件的生成物取类型」的写法').toEqual([])
  })

  it('L3 阳性对照:真实消费者字节被塞一枚类型必须被抓到,摘掉射程即失效', () => {
    const srcConsumers = valueConsumers(declared, ['apps/miniapp-taro/src'])
    expect(
      srcConsumers.length,
      '找不到任何端内消费者 ⇒ 阳性对照无从成立,直接判死而不是伪造通过',
    ).toBeGreaterThan(0)

    const probe = findProbe(srcConsumers, declared)
    expect(probe, '消费者里没有单行具名 import 形态 ⇒ 夹具需重估(不得静默空转)').not.toBeNull()
    if (!probe) throw new Error('L3 夹具缺失')
    const { rel, spec, statement } = probe

    const real = read(rel)
    expect(real.includes(PROBE_TYPE), '真实字节里已有探针名 ⇒ 对照基线被污染').toBe(false)

    // 变异 = 对真实字节的同一条 import 追加 `type <探针>`(in-memory,不落盘)
    const open = statement[0].indexOf('{')
    const close = statement[0].lastIndexOf('}')
    const bindings = statement[0].slice(open + 1, close).replace(/[\s,]+$/, '')
    const mutatedStatement = `${statement[0].slice(0, open + 1)}${bindings}, type ${PROBE_TYPE}${statement[0].slice(close)}`
    const mutated = `${real.slice(0, statement.index)}${mutatedStatement}${real.slice(
      statement.index + statement[0].length,
    )}`
    expect(mutated, '变异臂没改动任何字节 ⇒ 夹具失效,本对照无牙').not.toBe(real)

    // 成对:同一把尺子对真实字节判 0、对伪造字节必须点名
    expect(typeImportsFromDeclared(rel, real, declared)).toEqual([])
    const hits = typeImportsFromDeclared(rel, mutated, declared)
    expect(hits.length, '真实消费者被塞了类型却没被抓到 ⇒ 判据失效').toBeGreaterThan(0)
    expect(
      hits.some((hit) => hit.module === spec && hit.bindings.includes(PROBE_TYPE)),
      '命中的模块或类型名不对 ⇒ 判据没在看这条 import',
    ).toBe(true)

    // 判据吃的必须是现读射程:把该模块摘掉后,同一变异不得再命中
    const weakened = new Set([...declared].filter((item) => item !== spec))
    expect(
      typeImportsFromDeclared(rel, mutated, weakened),
      '射程摘掉该模块后仍命中 ⇒ 判据并没在看现读射程',
    ).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
