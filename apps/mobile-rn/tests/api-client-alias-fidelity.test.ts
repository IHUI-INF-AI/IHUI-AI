// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 常驻锁:`@ihui/api-client` 的 vitest 别名必须直指真实源码,替身不得再自述
 * (2026-09-29,同一族第三格;范本 = tests/shared-auth-alias-fidelity.test.ts)
 *
 * 立票事实(每一条都是本文件现读的判据,不是转述):
 * `vitest.config.ts` 曾把 `@ihui/api-client` 指到 `tests/__mocks__/ihui-api-client.ts`,
 * 那份替身只给 14 个名字,而消费面(apps/mobile-rn 全部具名取用,现读)有 250 个,
 * 差集含运行时符号 `fetchApi` / `setUnauthorizedHandler` / `streamChat` /
 * `refreshAccessTokenOnce` —— 凡走别名且不自带 `vi.mock` 的用例,证明的都是虚构 API。
 * 替身还自述了真实包不存在的 `BranchConversationResult` / `BranchConversationApiResult`,
 * 并手抄了一份与真实 `ws-client.ts` 不同形的 `WebSocketClient`(无 isConnected / 无心跳 /
 * 无 generation 防重连风暴 / 不收 messageGuard,而端内 src/lib/ws/chat-client.ts 恰恰按
 * 真实契约传 messageGuard —— 替身把它静默吞掉)。
 * 真实包框架无关(全 src 唯一外部导入 @ihui/types 且实测全部 type-only;平台边界本来就走
 * setTransport / webSocketFactory / setTokenProvider 注入口),所以它不需要替身。
 *
 * 判五件事,任何一条不成立即红(空扫描一律判"判据失明",不读成通过):
 *   A1 别名面:`@ihui/api-client` 与 `@ihui/api-client/endpoints` 两条别名都必须解析到
 *      `packages/api-client/src/` 下的真实文件/目录(本票的收口形态就是"直指真实源码",
 *      判得比范本更严:指回 __mocks__ 即红,哪怕那份替身当下是纯转发 —— 转发层是上一格
 *      历史的墓碑,不是被允许的取径),且子路径别名排在父别名之前
 *      (Vite 别名按插入顺序做前缀匹配,父路径排前面会把子路径吞成 <index.ts>/endpoints/…)。
 *   A2 替身面:`tests/__mocks__/ihui-api-client.ts` 的导出名 ⊆ 真实 barrel 导出名,且
 *      **只许转发**(无自述声明、无缺 from 的 export {})。判据对象含当前无人引用的死替身
 *      —— 带着虚构 API 的死替身躺在原地,等着被顺手接回去,这正是本票的成因。
 *   A3 真实面平台无关(排除按设计拆出的 *.taro.* 深路径实现):A2 的"只许转发"以此为前提,
 *      A3 红则 A2 的结论作废。
 *   A4 消费方名字:本端 + packages/app 每个从 `@ihui/api-client…` 的具名 import/export,
 *      名字必须在被引 specifier 对应的真实模块导出集里;default/namespace 导入直接红
 *      (真实包无 default 导出;namespace 会让名字判据整体失明)。
 *   A5 运行时:通过别名拿到的是实现本身 —— 旧替身给不出的符号必须真在位,且行为是真实的
 *      (信封映射、X-Requested-With 注入、心跳、isConnected、子路径解析)。
 *
 * 失效方向:红着逼人回来改。把替身改回一份自述实现、把别名指回 __mocks__、或给真实面
 * 掺进平台 API,本文件必红。
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync, type Dirent } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url))
const RN_DIR = path.resolve(TESTS_DIR, '..')
const REPO_ROOT = path.resolve(RN_DIR, '..', '..')
const API_CLIENT_SRC = path.join(REPO_ROOT, 'packages', 'api-client', 'src')
const REAL_INDEX = path.join(API_CLIENT_SRC, 'index.ts')
const MOCKS_DIR = path.join(TESTS_DIR, '__mocks__')
const STUB_FILE = path.join(MOCKS_DIR, 'ihui-api-client.ts')
const CONFIG_FILE = path.join(RN_DIR, 'vitest.config.ts')
const SELF_FILE = path.join(TESTS_DIR, 'api-client-alias-fidelity.test.ts')
const ROOT_SPEC = '@ihui/api-client'
const ENDPOINTS_SPEC = '@ihui/api-client/endpoints'

/** 只剥注释,保留字符串与行号(范本同一条:说明性文字不得被判成违规,别名说明符必须看得见)。 */
function maskComments(source: string): string {
  let out = ''
  let state: 'code' | 'line' | 'block' | 'sq' | 'dq' | 'tpl' = 'code'
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i] as string
    const nx = source[i + 1]
    if (state === 'code') {
      if (ch === '/' && nx === '/') {
        out += '  '
        state = 'line'
        i += 1
      } else if (ch === '/' && nx === '*') {
        out += '  '
        state = 'block'
        i += 1
      } else {
        if (ch === "'") state = 'sq'
        else if (ch === '"') state = 'dq'
        else if (ch === '`') state = 'tpl'
        out += ch
      }
      continue
    }
    if (state === 'line') {
      if (ch === '\n') {
        out += ch
        state = 'code'
      } else out += ' '
      continue
    }
    if (state === 'block') {
      if (ch === '*' && nx === '/') {
        out += '  '
        state = 'code'
        i += 1
      } else out += ch === '\n' ? ch : ' '
      continue
    }
    out += ch
    if (ch === '\\') {
      out += nx ?? ''
      i += 1
      continue
    }
    if ((state === 'sq' && ch === "'") || (state === 'dq' && ch === '"') || (state === 'tpl' && ch === '`')) {
      state = 'code'
    }
  }
  return out
}

function readCode(file: string): string {
  return maskComments(readFileSync(file, 'utf8'))
}

const RE_DECL =
  /export\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:function|const|let|var|class|interface|enum)\s+([A-Za-z0-9_$]+)/g
const RE_TYPE_DECL = /export\s+type\s+([A-Za-z0-9_$]+)\s*(?:<[^=]*>)?\s*=/g
const RE_STAR = /export\s+\*\s+(?:as\s+([A-Za-z0-9_$]+)\s+)?from\s+['"]([^'"]+)['"]/g
const RE_NAMED = /export\s+(?:type\s+)?\{([^}]*)\}(\s*from\s+['"]([^'"]+)['"])?/g
const RE_DEFAULT = /export\s+default\b/

type ExportSet = {
  names: Set<string>
  selfDeclared: string[]
  localExportNames: string[]
  forwards: string[]
}

function parseExports(file: string, seen: Set<string> = new Set()): ExportSet {
  const abs = path.resolve(file)
  const names = new Set<string>()
  const selfDeclared: string[] = []
  const localExportNames: string[] = []
  const forwards: string[] = []
  if (seen.has(abs)) return { names, selfDeclared, localExportNames, forwards }
  seen.add(abs)
  const code = readCode(abs)

  for (const m of code.matchAll(RE_DECL)) {
    const n = m[1] as string
    names.add(n)
    selfDeclared.push(n)
  }
  for (const m of code.matchAll(RE_TYPE_DECL)) {
    const n = m[1] as string
    names.add(n)
    selfDeclared.push(n)
  }
  if (RE_DEFAULT.test(code)) {
    names.add('default')
    selfDeclared.push('default')
  }

  for (const m of code.matchAll(RE_STAR)) {
    const alias = m[1]
    if (alias) names.add(alias)
    else if (m[2]) forwards.push(m[2])
  }
  for (const m of code.matchAll(RE_NAMED)) {
    const spec = m[3]
    for (const rawEntry of (m[1] as string).split(',')) {
      const entry = rawEntry.trim().replace(/^type\s+/, '')
      if (!entry) continue
      const parts = entry.split(/\s+as\s+/)
      const local = (parts[0] ?? '').trim()
      const exported = (parts.length > 1 ? (parts[1] ?? '') : (parts[0] ?? '')).trim()
      if (!exported || exported === '*') continue
      names.add(exported)
      if (spec) forwards.push(spec)
      else {
        localExportNames.push(local)
        selfDeclared.push(local)
      }
    }
  }

  // 真实面的 `export * from './endpoints/x'` 必须把 x 的名字并进来(barrel 九成靠它);
  // 外部说明符(@ihui/types 等)不追 —— 它们不是"本模块提供的名字"的来源。
  for (const spec of forwards) {
    if (!spec.startsWith('.')) continue
    const target = resolveRelative(path.dirname(abs), spec)
    if (!target) continue
    for (const n of parseExports(target, seen).names) names.add(n)
  }
  return { names, selfDeclared, localExportNames, forwards }
}

function resolveRelative(dir: string, spec: string): string | null {
  const base = path.resolve(dir, spec)
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ]
  // api-client 全族走 NodeNext 风格的 `from './x.js'`(真实文件是 .ts)——
  // 范本(shared-auth 锁)的说明符都无扩展名,照抄会让这里的递归九成落空:
  // 每个 export * 都指向 …​.js,解析不到 ⇒ 端点名整批"消失",A2/A4 会拿空集当基准。
  if (/\.js$/.test(base)) {
    candidates.unshift(base.replace(/\.js$/, '.ts'), base.replace(/\.js$/, '.tsx'))
  }
  for (const c of candidates) {
    try {
      if (statSync(c).isFile() && !c.endsWith('.d.ts')) return c
    } catch {
      continue
    }
  }
  return null
}

/** specifier → 真实模块文件:'@ihui/api-client' → src/index.ts;'…/endpoints/course' → src/endpoints/course.ts */
function realFileFor(spec: string): string {
  const sub = spec.slice(ROOT_SPEC.length).replace(/^\//, '')
  return path.join(API_CLIENT_SRC, sub === '' ? 'index.ts' : `${sub}.ts`)
}

/** 从 vitest.config.ts 的 alias 字面量按源序取 key→绝对路径(单行与多行+尾逗号都要认,范本同一条)。 */
function aliasEntriesFromConfig(): Array<{ key: string; target: string }> {
  const code = readCode(CONFIG_FILE)
  const re = /'([^']+)'\s*:\s*resolve\(\s*__dirname\s*,\s*'([^']+)'\s*,?\s*\)/g
  const entries: Array<{ key: string; target: string }> = []
  for (const m of code.matchAll(re)) entries.push({ key: m[1] as string, target: m[2] as string })
  return entries
}

const ALIAS_ENTRIES = aliasEntriesFromConfig()

function isUnder(child: string, parent: string): boolean {
  const rel = path.relative(parent, child)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

function aliasTargetFor(spec: string): { abs: string; index: number } | null {
  const index = ALIAS_ENTRIES.findIndex((e) => e.key === spec)
  if (index < 0) return null
  return { abs: path.resolve(RN_DIR, ALIAS_ENTRIES[index]!.target), index }
}

describe('A1 · 别名面:@ihui/api-client* 必须直指 packages/api-client/src 真实源码', () => {
  it('别名表非空扫描(解析不到任何别名 = 判据失明)', () => {
    expect(ALIAS_ENTRIES.length, 'vitest.config.ts 里没解析出任何别名条目 ⇒ 判据失明').toBeGreaterThan(0)
  })

  it(`'${ROOT_SPEC}' 直指真实 barrel(指回 __mocks__ 即红)`, () => {
    const hit = aliasTargetFor(ROOT_SPEC)
    expect(hit, `别名表缺少 ${ROOT_SPEC}(多行 + 尾随逗号的写法也必须被认出来)`).toBeTruthy()
    const abs = hit!.abs
    expect(isUnder(abs, MOCKS_DIR), `${ROOT_SPEC} 被指回 __mocks__ 替身:${abs}`).toBe(false)
    expect(isUnder(abs, API_CLIENT_SRC), `${ROOT_SPEC} 必须直指真实源码:${abs}`).toBe(true)
    try {
      expect(statSync(abs).isFile(), `${ROOT_SPEC} 的别名目标不是文件:${abs}`).toBe(true)
    } catch {
      expect(false, `${ROOT_SPEC} 的别名目标不存在:${abs}`).toBe(true)
    }
  })

  it(`'${ENDPOINTS_SPEC}' 直指真实 endpoints 目录,且排在父别名之前`, () => {
    const hit = aliasTargetFor(ENDPOINTS_SPEC)
    expect(hit, `别名表缺少 ${ENDPOINTS_SPEC}(子路径被父别名吞掉 = 深路径导入解析失败)`).toBeTruthy()
    const abs = hit!.abs
    expect(isUnder(abs, API_CLIENT_SRC), `${ENDPOINTS_SPEC} 必须直指真实源码:${abs}`).toBe(true)
    try {
      expect(statSync(abs).isDirectory(), `${ENDPOINTS_SPEC} 的别名目标不是目录:${abs}`).toBe(true)
    } catch {
      expect(false, `${ENDPOINTS_SPEC} 的别名目标不存在:${abs}`).toBe(true)
    }
    const parent = aliasTargetFor(ROOT_SPEC)
    expect(parent).toBeTruthy()
    expect(hit!.index, `${ENDPOINTS_SPEC} 必须排在 ${ROOT_SPEC} 之前(前缀匹配按插入顺序)`).toBeLessThan(parent!.index)
  })

  it('父别名不吃子路径:任何更早出现的 key 都不得是 @ihui/api-client 的前缀', () => {
    for (const spec of [ROOT_SPEC, ENDPOINTS_SPEC]) {
      const hit = aliasTargetFor(spec)
      expect(hit, `别名表缺少 ${spec}`).toBeTruthy()
      const swallowedBy = ALIAS_ENTRIES.filter((e, i) => i < hit!.index && (spec === e.key || spec.startsWith(`${e.key}/`))).map((e) => e.key)
      expect(swallowedBy, `${spec} 会被更早出现的别名 ${swallowedBy.join(', ')} 吞掉`).toEqual([])
    }
  })
})

describe('A2 · 替身面:死替身只许转发、不得多名字', () => {
  it('替身文件仍在原位(本票禁止 git 写操作,墓碑按范本保留;若被物理删除,此条红提醒回来销案)', () => {
    expect(existsSync(STUB_FILE), `替身文件不在:${STUB_FILE}`).toBe(true)
  })

  it('真实 barrel 非空扫描(判据的基准面先自证可见)', () => {
    const real = parseExports(REAL_INDEX)
    expect(real.names.size, 'packages/api-client/src/index.ts 一个导出都没解析到 ⇒ 判据失明').toBeGreaterThan(50)
  })

  it('替身的导出集合 ⊆ 真实 barrel', () => {
    const real = parseExports(REAL_INDEX)
    const stub = parseExports(STUB_FILE)
    const extra = [...stub.names].filter((n) => !real.names.has(n))
    expect(extra, `替身导出真实包不存在的名字:${extra.join(', ')} —— 这就是"看着覆盖了 API,实则测虚构 API"那一型`).toEqual([])
  })

  it('替身只许转发(不得自己声明导出,也不得出现无 from 的 export {})', () => {
    const stub = parseExports(STUB_FILE)
    expect(stub.selfDeclared, `替身自己声明了 ${stub.selfDeclared.join(', ')} ⇒ 那是第二份实现,不是转发`).toEqual([])
    expect(stub.localExportNames, '替身里出现不带模块说明符的 export { … } ⇒ 同上').toEqual([])
  })
})

describe('A3 · 真实面在测试宿主里可装载(A2 的"只许转发"以此为前提,它红则 A2 作废)', () => {
  /**
   * 名单只收"**在 jsdom/Node 测试宿主里结构上跑不动**"的耦合:
   * ① 裸平台包 import(react-native/expo/@tarojs)—— vitest 下解析不到,收集期即炸,
   *    别名直指真实面就成了自毁装置;
   * ② jsdom 里不存在的全局(AsyncStorage / SecureStore / chrome.storage)。
   * 刻意**不收** window./document./localStorage —— 它们由 jsdom 提供,判它们红不证明任何
   * "跑不动"(上一稿收了 window. 就撞上 endpoints/browser-hub.ts:那是 SSR/dev 三元之后的
   * 惰性函数体访问,import 不触发,且该端点服务桌面 Browser Hub、RN 面无人接线)。
   * "模块能被真实装载"的最终证据在 A5:整个 barrel + 子路径都被 import 并跑出了真实行为。
   */
  const PLATFORM_PATTERNS: Array<[string, RegExp]> = [
    ['react-native', /['"]react-native['"]/],
    ['expo', /['"]expo[-/]/],
    ['@tarojs', /['"]@tarojs\//],
    ['AsyncStorage', /\bAsyncStorage\b/],
    ['SecureStore', /\bSecureStore\b/],
    ['chrome.storage', /\bchrome\.storage\b/],
  ]

  function collectRealFiles(dir: string, out: string[] = []): string[] {
    let entries: Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return out
    }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) collectRealFiles(full, out)
      else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.test.ts') && !/\.taro\.tsx?$/.test(e.name)) out.push(full)
    }
    return out
  }

  it('packages/api-client/src/**(排除按设计拆出的 *.taro.* 深路径)不出现平台 API', () => {
    const files = collectRealFiles(API_CLIENT_SRC)
    expect(files.length, '真实面包一个文件都没扫到 ⇒ 判据失明').toBeGreaterThan(20)
    const offenders: string[] = []
    for (const f of files) {
      const code = readCode(f)
      for (const [name, re] of PLATFORM_PATTERNS) {
        if (re.test(code)) offenders.push(`${path.relative(REPO_ROOT, f)} → ${name}`)
      }
    }
    expect(
      offenders,
      `真实面出现平台 API(${offenders.join(', ')})⇒ "替身只许转发"的前提不再成立,` +
        '需要为那一格单独论证,不得顺手放宽本锁',
    ).toEqual([])
  })

  it('barrel 不引用 .taro 专用实现(Taro 拆分是"平台边界另开文件"的设计,不是替身理由)', () => {
    const code = readCode(REAL_INDEX)
    expect(code.includes('.taro'), 'index.ts 的代码面引用了 *.taro.* ⇒ 平台实现渗进了共享 barrel').toBe(false)
  })
})

describe('A4 · 消费方引的名字必须在真实模块里', () => {
  function collectSources(): string[] {
    const out: string[] = []
    const walk = (dir: string) => {
      let entries: Dirent[]
      try {
        entries = readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const d of entries) {
        const full = path.join(dir, d.name)
        if (d.isDirectory()) {
          if (d.name === '__mocks__' || d.name === 'node_modules' || d.name === 'dist' || d.name === '.expo') continue
          walk(full)
          continue
        }
        if (!/\.(ts|tsx)$/.test(d.name)) continue
        if (path.resolve(full) === path.resolve(SELF_FILE)) continue
        out.push(full)
      }
    }
    walk(path.join(RN_DIR, 'src'))
    walk(TESTS_DIR)
    const app = path.join(RN_DIR, 'App.tsx')
    if (existsSync(app)) out.push(app)
    walk(path.join(REPO_ROOT, 'packages', 'app', 'src'))
    return out
  }

  it('每个具名取用的名字都在对应真实模块的导出集里;default/namespace 导入直接红', () => {
    const consumerFiles = collectSources()
    expect(consumerFiles.length, '一个源文件都没扫到 ⇒ 判据失明').toBeGreaterThan(0)

    const reNamed =
      /(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"](@ihui\/api-client(?:\/[A-Za-z0-9_./-]*)?)['"]/g
    const reDefault =
      /import\s+([A-Za-z0-9_$]+)\s*(?:,\s*\{[^}]*\})?\s*from\s*['"]@ihui\/api-client(?:\/[A-Za-z0-9_./-]*)?['"]/g
    const reNamespace =
      /import\s+\*\s+as\s+[A-Za-z0-9_$]+\s+from\s*['"]@ihui\/api-client(?:\/[A-Za-z0-9_./-]*)?['"]/g

    const found: Array<{ spec: string; name: string; file: string }> = []
    const banned: string[] = []
    for (const f of consumerFiles) {
      const code = readCode(f)
      for (const m of code.matchAll(reNamed)) {
        const spec = m[2] as string
        for (const rawEntry of (m[1] as string).split(',')) {
          const entry = rawEntry.trim().replace(/^type\s+/, '')
          if (!entry) continue
          const imported = (entry.split(/\s+as\s+/)[0] ?? '').trim()
          if (imported) found.push({ spec, name: imported, file: f })
        }
      }
      for (const m of code.matchAll(reDefault)) {
        // 真实包没有 default 导出:出现 default import 就该红,而不是放过。
        banned.push(`${path.relative(REPO_ROOT, f)} → default import "${m[1]}"`)
      }
      for (const m of code.matchAll(reNamespace)) {
        banned.push(`${path.relative(REPO_ROOT, f)} → namespace import(${m[0].trim()})会让名字判据整体失明`)
      }
    }

    expect(found.length, '没扫到任何 @ihui/api-client* 的具名消费点 ⇒ 本条判据看不见任何东西').toBeGreaterThan(100)
    expect(banned, `出现被禁止的导入形态:${banned.join(' | ')}`).toEqual([])

    const cache = new Map<string, Set<string>>()
    const missing: string[] = []
    for (const { spec, name, file } of found) {
      if (!cache.has(spec)) {
        const set = parseExports(realFileFor(spec)).names
        expect(set.size, `真实模块 ${spec} 一个导出都没解析到 ⇒ 判据失明(${path.relative(REPO_ROOT, realFileFor(spec))})`).toBeGreaterThan(0)
        cache.set(spec, set)
      }
      if (!cache.get(spec)?.has(name)) missing.push(`${path.relative(REPO_ROOT, file)} → ${name} @ ${spec}`)
    }
    expect(missing, `消费方引了真实模块里不存在的名字:${missing.join(' | ')}`).toEqual([])
  })
})

describe('A5 · 运行时:别名拿到的是实现本身,不是 undefined,也不是替身的手抄件', () => {
  /**
   * 冷装载预算:真实 barrel ~90 个端点文件 / 1300+ 出口,本机繁忙时第一次 import
   * 可越过全局 10s testTimeout(与 chat-client.test.ts 的 beforeAll 同一理由)。
   * 把冷装载收进带 120s 预算的 beforeAll,各 it 断言的语义与预算都不受影响。
   */
  beforeAll(async () => {
    await import('@ihui/api-client')
    await import('@ihui/api-client/endpoints/course')
  }, 120_000)

  it('旧替身给不出的运行时符号必须全部在位', async () => {
    const mod = (await import('@ihui/api-client')) as Record<string, unknown>
    for (const n of [
      'fetchApi',
      'setUnauthorizedHandler',
      'getUnauthorizedHandler',
      'refreshAccessTokenOnce',
      'streamChat',
      'setTransport',
      'getTransport',
      'getModelContextCapacity',
      'branchConversation',
      'WebSocketClient',
      'ApiError',
    ]) {
      expect(mod[n], `${n} 拿到 undefined ⇒ 别名被指回了只给 14 个名字的虚构替身`).toBeTruthy()
      expect(typeof mod[n], `${n} 应为可调用/可构造的真实符号`).toBe('function')
    }
    // isConnected 只在真实 WebSocketClient 的实例原型上;替身手抄件没有这条。
    // (注意 Object.getPrototypeOf(类) 拿到的是 Function.prototype —— 判实例成员必须走 .prototype)
    const wscProto = (mod['WebSocketClient'] as { prototype?: Record<string, unknown> }).prototype
    expect(wscProto && 'isConnected' in wscProto, 'WebSocketClient 缺 isConnected ⇒ 拿到的是替身手抄件').toBe(true)
  })

  it('fetchApi 走真实信封映射:200 + code!==0 ⇒ success:false 且 errorCode 原样带出', async () => {
    const { fetchApi } = (await import('@ihui/api-client')) as {
      fetchApi: (url: string, options?: Record<string, unknown>) => Promise<Record<string, unknown>>
    }
    const fetchMock = vi.fn(async (_input: string | URL, _init?: unknown) => {
      void _input
      void _init
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ code: 4001, message: 'boom', errorCode: 'BIZ_4001' }),
      } as unknown as Response
    })
    vi.stubGlobal('fetch', fetchMock)
    try {
      const res = await fetchApi('/anything')
      expect(res.success).toBe(false)
      expect(res.error).toBe('boom')
      expect(res.errorCode).toBe('BIZ_4001')
      expect(res.status).toBe(200)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('branchConversation 是真实 fetchApi 装配的:CSRF 头在位、URL/方法/请求体逐字对得上', async () => {
    const { branchConversation } = (await import('@ihui/api-client')) as {
      branchConversation: (c: string, m: string) => Promise<Record<string, unknown>>
    }
    const fetchMock = vi.fn(async (_input: string | URL, init?: unknown) => {
      void _input
      void init
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ code: 0, message: 'ok', data: { conversation: { id: 'srv-9' } } }),
      } as unknown as Response
    })
    vi.stubGlobal('fetch', fetchMock)
    try {
      const res = await branchConversation('c-1', 'm-2')
      expect(res.success).toBe(true)
      const [, init] = fetchMock.mock.calls[0] ?? []
      const headers = (init as { headers?: Record<string, string> } | undefined)?.headers ?? {}
      // X-Requested-With 由真实 client.ts 统一注入 —— 替身手抄的 branchConversation 给不出它。
      expect(headers['X-Requested-With']).toBe('XMLHttpRequest')
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/chat/conversations/c-1/branch')
      expect(String((init as { method?: string } | undefined)?.method)).toBe('POST')
      expect(JSON.parse(String((init as { body?: string } | undefined)?.body))).toMatchObject({ messageId: 'm-2' })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('WebSocketClient 是真实类:注入工厂建连、isConnected 跟随 open、心跳按档发 ping', async () => {
    vi.useFakeTimers()
    try {
      const { WebSocketClient } = (await import('@ihui/api-client')) as unknown as {
        WebSocketClient: new (
          options: Record<string, unknown>,
          handlers?: Record<string, unknown>,
        ) => { connect: () => void; disconnect: () => void; isConnected: boolean }
      }
      class FakeSocket {
        readyState = 0
        url: string
        sent: string[] = []
        onopen: (() => void) | null = null
        onmessage: ((event: { data: unknown }) => void) | null = null
        onclose: (() => void) | null = null
        onerror: ((err: unknown) => void) | null = null
        constructor(url: string) {
          this.url = url
        }
        send(data: string): void {
          this.sent.push(data)
        }
        close(): void {
          this.readyState = 3
          this.onclose?.()
        }
      }
      const sockets: FakeSocket[] = []
      const client = new WebSocketClient(
        {
          urlBuilder: (token: string) => `ws://example.test/ws?token=${token}`,
          tokenProvider: () => 'tk',
          messageGuard: () => true,
          webSocketFactory: (url: string) => {
            const socket = new FakeSocket(url)
            sockets.push(socket)
            return socket
          },
        },
        {},
      )
      client.connect()
      await vi.advanceTimersByTimeAsync(0)
      expect(sockets.length, '注入的 webSocketFactory 没被调用 ⇒ 不是真实建连路径').toBe(1)
      const ws = sockets[0]!
      expect(ws.readyState).toBe(0)
      expect(client.isConnected).toBe(false)
      ws.readyState = 1
      ws.onopen?.()
      expect(client.isConnected).toBe(true)
      await vi.advanceTimersByTimeAsync(30_000)
      // 心跳是真实类的行为;替身手抄件没有心跳。
      expect(ws.sent).toContain('ping')
      client.disconnect()
    } finally {
      vi.useRealTimers()
    }
  })

  it('子路径 @ihui/api-client/endpoints/course 经别名解析到真实端点文件(barrel 同名出口一致)', async () => {
    const sub = (await import('@ihui/api-client/endpoints/course')) as Record<string, unknown>
    expect(typeof sub['getCourseById'], '深路径导入解析失败或函数缺失 ⇒ endpoints 别名被父别名吞了').toBe('function')
    const barrel = (await import('@ihui/api-client')) as Record<string, unknown>
    expect(barrel['getCourseById']).toBe(sub['getCourseById'])
  })
})
