// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 共享屏「只声明组件」环境声明的类型取用锁(承 AGENTS §4 单一口径 / TS2305 事故型)
//
// 机制(现读,不是猜):apps/miniapp-taro/types/rn-shells.generated.d.ts 为每一枚被壳承载的
// 共享屏写了 `declare module '<spec>' { export const <Screen>: ComponentType<…> }`,
// **只声明组件、不透传类型**。TS 的环境声明会遮蔽同名的源码解析:从该模块名再写
// `import { HelpScreen, type HelpListItem } from '@ihui/rn-app/features/help/HelpScreen'`
// 会报 TS2305(module has no exported member)——HEAD 面的 help.tsx 就是这一型红。
// 既定口径(端内已有先例 src/pages/member/benefits.tsx):**类型必须从单源取**
// (@ihui/types 或真正的源模块),不得从「只声明组件」的声明档取。
//
// 本锁把这格钉在测试面:射程 = 声明档自己列出的模块名(不手抄清单,§0.6 单一真相源),
// 任何从这些模块取**类型**的写法判红。
//
// 阳性对照(证明本判据真的会红):对 help.tsx 的**真实字节**做 in-memory 变异,把类型改回
// 从声明模块取那种写法,断言同一把尺子点名它 —— 只有"当前绿"而没有"错了会红"的断言,
// 与本仓记过多次的"判据失效的表现永远是安静"是同一种缺陷。

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../..')
const DECL_REL = 'apps/miniapp-taro/types/rn-shells.generated.d.ts'
const HELP_REL = 'apps/miniapp-taro/src/pkg-about/about/help.tsx'
const TYPES_APP_PROFILE_REL = 'packages/types/src/app-profile.ts'
const TYPES_APP_REL = 'packages/types/src/app.ts'
const TYPES_INDEX_REL = 'packages/types/src/index.ts'
/** 本票点名的那枚声明模块(壳承载 help 屏的取值入口) */
const HELP_SPEC = '@ihui/rn-app/features/help/HelpScreen'

/** 被扫描的代码面(与 tsconfig include 的 app 侧一致) */
const SCAN_DIRS = ['apps/miniapp-taro/src', 'apps/miniapp-taro/tests']
const CODE_EXT = ['.ts', '.tsx']

function read(rel: string): string {
  // 取不到 ⇒ 直接判死:静默跳过会让这把锁对着空集合报绿(§0.3)
  try {
    return readFileSync(join(ROOT, rel), 'utf8')
  } catch (e) {
    throw new Error(`反证锁取不到 ${rel}(不据此报绿):${String(e)}`)
  }
}

/** 剥注释:声明档/源码里的示例与横幅不是发射点(与 check-i18n-keys 同口径) */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

/** 声明档里被「只声明组件」的模块名集合 —— 射程的唯一来源 */
function declaredModules(declSrc: string): Set<string> {
  const out = new Set<string>()
  const re = /^declare\s+module\s+'([^']+)'/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(declSrc)) !== null) {
    const spec = m[1]
    if (spec) out.add(spec)
  }
  return out
}

/** 该模块的声明块是否只导出了值(组件)而没有 export type/interface ⇒ 「只声明组件」成立 */
function declarationCarriesNoTypes(declSrc: string, spec: string): boolean {
  const start = declSrc.indexOf(`declare module '${spec}'`)
  if (start < 0) return false
  let depth = 0
  let end = -1
  for (let i = declSrc.indexOf('{', start); i < declSrc.length; i++) {
    const ch = declSrc[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end < 0) return false
  const block = declSrc.slice(start, end + 1)
  return !/\bexport\s+(type|interface)\b/.test(block)
}

type Violation = { file: string; module: string; bindings: string[] }

/** 找出「从声明档射程内的模块取类型」的写法(A:整条 import type;B:行内 type 标记) */
function typeImportsFromDeclared(fileRel: string, src: string, declared: Set<string>): Violation[] {
  const code = stripComments(src)
  const out: Violation[] = []
  const re = /import\s+(type\s+)?\{([\s\S]*?)\}\s*from\s*'([^']+)'/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) {
    const wholeIsType = Boolean(m[1])
    const bindingsRaw = m[2] ?? ''
    const spec = m[3] ?? ''
    if (!declared.has(spec)) continue
    const named: string[] = []
    for (const piece of bindingsRaw.split(',')) {
      const trimmed = piece.trim()
      if (!trimmed) continue
      const inlineType = /^type\s+([A-Za-z_$][\w$]*)/.exec(trimmed)
      if (inlineType?.[1]) named.push(inlineType[1])
      else if (wholeIsType) {
        const only = /^([A-Za-z_$][\w$]*)/.exec(trimmed)
        if (only?.[1]) named.push(only[1])
      }
    }
    if (named.length > 0) out.push({ file: fileRel, module: spec, bindings: named.sort() })
  }
  return out
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

/** 全端扫描:返回所有「从声明档取类型」的违规(空集 = 当前绿) */
function scanRepoForViolations(declared: Set<string>): Violation[] {
  const found: Violation[] = []
  for (const dir of SCAN_DIRS) {
    for (const rel of listCodeFiles(dir)) {
      found.push(...typeImportsFromDeclared(rel, readFileSync(join(ROOT, rel), 'utf8'), declared))
    }
  }
  return found
}

describe('共享屏环境声明:类型必须从单源取(禁从声明档取)', () => {
  const declSrc = read(DECL_REL)
  const declared = declaredModules(declSrc)

  it('L0 射程非空:声明档确实声明了模块且确实「只声明组件」(0 候选不许当"已覆盖")', () => {
    expect(
      declared.size,
      `${DECL_REL} 里一条 declare module 都没扫到 ⇒ 本锁成空锁`,
    ).toBeGreaterThan(0)
    const helpSpec = HELP_SPEC
    expect(declared.has(helpSpec), `声明档已不再声明 ${helpSpec} ⇒ 机制变了,本锁射程须重估`).toBe(
      true,
    )
    expect(
      declarationCarriesNoTypes(declSrc, helpSpec),
      `${helpSpec} 的声明块已能透传类型 ⇒ 遮蔽不再成立,本锁口径需重估(不得静默空转)`,
    ).toBe(true)
    // 必须真有文件从这些模块取值,否则判据对着空集合报绿
    const consumers = SCAN_DIRS.flatMap((d) =>
      listCodeFiles(d).filter((rel) => {
        const code = stripComments(read(rel))
        return [...declared].some((spec) => code.includes(`from '${spec}'`))
      }),
    )
    expect(consumers.length, '全端无一文件引用声明档模块 ⇒ 判据在空转').toBeGreaterThan(0)
  })

  it('L1 help.tsx 不再从声明档取类型,且 HelpListItem 取自单源 @ihui/types', () => {
    const src = read(HELP_REL)
    expect(
      typeImportsFromDeclared(HELP_REL, src, declared),
      `${HELP_REL} 仍从「只声明组件」的环境声明模块取类型 ⇒ TS2305 回潮`,
    ).toEqual([])
    expect(
      /import\s+type\s*\{[^}]*\bHelpListItem\b[^}]*\}\s*from\s*'@ihui\/types'/.test(src),
      'help.tsx 的 HelpListItem 没有从 @ihui/types 取',
    ).toBe(true)
    // 单源必须真的存在这条链(防止"从一份副本取"被当成合规)
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

  it('L2 全端零违规:任何文件都不得从声明档取类型', () => {
    expect(scanRepoForViolations(declared), '出现「从只声明组件的模块取类型」的写法').toEqual([])
  })

  it('L3 阳性对照:把 help.tsx 伪造成"从声明档取类型"必须被同一把尺子抓到', () => {
    const real = read(HELP_REL)
    // 变异 = HEAD 面那次的真实写法(组件与类型同一条 import,类型指向声明档模块)。
    // 模块名走常量插值:夹具文本自身不得成为判据的命中点(否则 L2 会被这把锁自己弄红)。
    const valueImport = `import { HelpScreen } from '${HELP_SPEC}'`
    const badImport = `import { HelpScreen, type HelpListItem } from '${HELP_SPEC}'`
    const typeImport = `import type { HelpListItem } from '@ihui/types'`
    expect(real, 'help.tsx 的取值写法变了 ⇒ 本对照的基线需重估(不得静默空转)').toContain(
      valueImport,
    )
    expect(real, 'help.tsx 的类型 import 变了 ⇒ 本对照的基线需重估(不得静默空转)').toContain(
      typeImport,
    )
    const mutated = real.replace(valueImport, badImport).replace(`${typeImport}\n`, '')
    expect(mutated, '变异臂没改动任何字节 ⇒ 夹具失效,本对照无牙').not.toBe(real)
    // 成对:同一把尺子对真实字节判 0、对伪造字节必须点名
    expect(typeImportsFromDeclared(HELP_REL, real, declared)).toEqual([])
    const hits = typeImportsFromDeclared(HELP_REL, mutated, declared)
    expect(hits, '伪造的"从声明档取类型"没被抓到 ⇒ 判据失效').toHaveLength(1)
    expect(hits[0]?.module).toBe(HELP_SPEC)
    expect(hits[0]?.bindings).toEqual(['HelpListItem'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
