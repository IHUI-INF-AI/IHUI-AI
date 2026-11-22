// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 常驻锁:@ihui/shared/auth* 的 vitest 替身不得比真实模块多名字(2026-09-28,任务 #32)
 *
 * 立票事实(以下每一条都是本文件现读到的判据,不是转述):
 * `vitest.config.ts` 曾把 `@ihui/shared/auth/sso-core` 指到
 * `tests/__mocks__/ihui-shared-auth-sso-core.ts`,而那份替身自述的
 * `startSSOFlow` / `parseSSOResponse` / `SsoCoreOptions` 在真实
 * `packages/shared/src/auth/sso-core.ts` 里一个都不存在,`SsoTokenData` 的字段还写成
 * `token`(真实是 `accessToken`);`@ihui/shared/auth` 的替身同理(同步版
 * `createInMemoryTokenStore` 吞掉全部持久化回调、缺 `setCachedWithoutPersist`、
 * 类型名 `TokenStoreConfig` 而真实是 `InMemoryTokenStoreOptions`)。
 * 本端真实消费方 `src/lib/sso.ts` / `src/lib/token.ts` 引的名字替身一个都没导出 ⇒
 * 在 vitest 下那些符号是 undefined,而"看起来覆盖了 SSO/凭据路径"的用例证明的是 mock。
 *
 * 判五件事,任何一条不成立即红(空扫描一律判"判据失明",不读成通过):
 *   L1 别名面:两个 subject 的别名都必须解析到 `packages/shared/src/auth/` 下的真实文件,
 *      或解析到一份通过 L2 的本端替身;并且子路径别名必须排在父路径别名之前
 *      (Vite 别名按插入顺序做前缀匹配,父路径排前面会把子路径吞成 `<index.ts>/sso-core`)。
 *   L2 替身面:替身导出名 ⊆ 真实模块导出名,且替身**只许转发**(每条 export 都带 `from`)。
 *      判据对象**包含当前无人引用的死替身**(按文件名 `ihui-shared-auth*` 认)——
 *      一份带着虚构 API 的死替身躺在原地等着被顺手接回去,正是本票的成因。
 *   L3 真实面平台无关:L2 的"只许转发"以此为前提;L3 红则 L2 的结论作废。
 *   L4 消费方名字:本端每个从 `@ihui/shared/auth…` 的具名 import/export,名字必须在真实模块里。
 *   L5 运行时:通过别名拿到的是实现本身(函数在位、`extractSsoCode` 真取得到 code、
 *      `setToken` 返回 Promise、换取结果带 `accessToken`)。
 *
 * 失效方向:红着逼人回来改。给任一本端替身加一个真实模块没有的名字,本文件必红。
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync, type Dirent } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url))
const RN_DIR = path.resolve(TESTS_DIR, '..')
const REPO_ROOT = path.resolve(RN_DIR, '..', '..')
const AUTH_REAL_DIR = path.join(REPO_ROOT, 'packages', 'shared', 'src', 'auth')
const MOCKS_DIR = path.join(TESTS_DIR, '__mocks__')
const CONFIG_FILE = path.join(RN_DIR, 'vitest.config.ts')
const SELF_FILE = path.join(TESTS_DIR, 'shared-auth-alias-fidelity.test.ts')
const AUTH_PREFIX = '@ihui/shared/auth'

/** 本票射程内的两个 specifier:别名、替身、真实面都必须被判定到,缺一不可 */
const SUBJECTS = [AUTH_PREFIX, `${AUTH_PREFIX}/sso-core`] as const

function realFileFor(spec: string): string {
  const sub = spec.slice(AUTH_PREFIX.length).replace(/^\//, '')
  return path.join(AUTH_REAL_DIR, sub === '' ? 'index.ts' : `${sub}.ts`)
}

function stubFileFor(spec: string): string | null {
  const sub = spec.slice(AUTH_PREFIX.length).replace(/^\//, '')
  const stem = sub === '' ? 'ihui-shared-auth' : `ihui-shared-auth-${sub}`
  const f = path.join(MOCKS_DIR, `${stem}.ts`)
  return existsSync(f) ? f : null
}

/**
 * 只剥注释,保留字符串与行号。
 * 需要它是因为本锁两面都要读:从 vitest.config.ts 认 `'@ihui/shared/auth'` 这类**字符串里的**
 * 说明符,同时不能被替身/消费方的说明文字(它们逐字提到旧替身那几个假名字)骗成违规。
 * 两层遮噪方向不同这件事,守门 118 / 131 / 135 各记过一次。
 */
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
  /** 该文件对外提供的名字(含转发) */
  names: Set<string>
  /** 自己声明的导出名 —— 对替身而言必须为空 */
  selfDeclared: string[]
  /** 不带模块说明符的 export { … } 里的名字 —— 对替身同样算自述 */
  localExportNames: string[]
  /** 带模块说明符的转发目标(真实面递归取名时用;替身面判"只许转发"后不再需要) */
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

  // 真实面的 `export * from './x'` / `export { Y } from './x'` 要把 x 的名字并进来;
  // 外部说明符(@ihui/…、裸包名)不追 —— 它们不是"本模块提供的名字"的来源。
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
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]
  for (const c of candidates) {
    // 必须是**文件**:`export * from '…/src/auth'` 这种目录说明符先命中 base,
    // 只判 existsSync 会把目录交给 readFileSync ⇒ EISDIR(本锁第一次自跑就咬到了这条)。
    try {
      if (statSync(c).isFile() && !c.endsWith('.d.ts')) return c
    } catch {
      continue
    }
  }
  return null
}

/**
 * 从 vitest.config.ts 的 alias 字面量按**源序**取 `key → 相对 __dirname 的目标`。
 * 必须同时吃单行与多行两种书写,并且吃下尾随逗号 —— sso-core 那条就是多行 + `,` 收尾,
 * 只认单行的解析会把整条别名看成不存在,而"没扫到"在本锁里必须判红而不是判绿。
 */
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

function aliasTargetFor(spec: string): { abs: string; entry: { key: string; target: string } } | null {
  const entry = ALIAS_ENTRIES.find((e) => e.key === spec)
  if (!entry) return null
  return { abs: path.resolve(RN_DIR, entry.target), entry }
}

describe('L1 · 别名面:@ihui/shared/auth* 必须解析到真实源码或同形替身', () => {
  it('别名表非空扫描,且每个 subject 都有条目、目标文件存在', () => {
    expect(ALIAS_ENTRIES.length, 'vitest.config.ts 里没解析出任何别名条目 ⇒ 判据失明').toBeGreaterThan(0)
    for (const spec of SUBJECTS) {
      const hit = aliasTargetFor(spec)
      expect(hit, `别名表缺少 ${spec}(注意:多行 + 尾随逗号的写法也必须被认出来)`).toBeTruthy()
      expect(existsSync(hit!.abs), `${spec} 的别名目标不存在:${hit!.abs}`).toBe(true)
    }
  })

  it('目标在 packages/shared/src/auth/ 下,或是一份通过 L2 的替身', () => {
    for (const spec of SUBJECTS) {
      const hit = aliasTargetFor(spec)
      expect(hit, `别名表缺少 ${spec}`).toBeTruthy()
      const abs = hit!.abs
      const toReal = isUnder(abs, AUTH_REAL_DIR)
      const toStub = isUnder(abs, MOCKS_DIR)
      expect(toReal || toStub, `${spec} 的别名指向了既非真实面也非本端替身的文件:${abs}`).toBe(true)
      if (!toStub) continue
      const stub = parseExports(abs)
      const real = parseExports(realFileFor(spec))
      expect(real.names.size, `真实模块 ${spec} 一个导出都没解析到 ⇒ 判据失明`).toBeGreaterThan(0)
      const extra = [...stub.names].filter((n) => !real.names.has(n))
      expect(extra, `替身 ${path.basename(abs)} 导出真实模块没有的名字:${extra.join(', ')}`).toEqual([])
    }
  })

  it('子路径别名排在父路径别名之前(Vite 按插入顺序做前缀匹配)', () => {
    for (const spec of SUBJECTS) {
      const idx = ALIAS_ENTRIES.findIndex((e) => e.key === spec)
      expect(idx, `别名表缺少 ${spec}`).toBeGreaterThanOrEqual(0)
      const swallowedBy = ALIAS_ENTRIES.map((e, i) => ({ ...e, i }))
        .filter(({ key, i }) => i < idx && key !== spec && (spec === key || spec.startsWith(`${key}/`)))
        .map(({ key }) => key)
      expect(swallowedBy, `${spec} 会被更早出现的别名 ${swallowedBy.join(', ')} 吞掉 ⇒ 顺序必须往下挪`).toEqual([])
    }
  })
})

describe('L2 · 替身面:只许转发、不得多名字(含当前无人引用的死替身)', () => {
  const candidates = SUBJECTS.map((spec) => ({ spec, file: stubFileFor(spec) })).filter(
    (c): c is { spec: (typeof SUBJECTS)[number]; file: string } => c.file !== null,
  )

  it('每个 subject 都被判定到:要么有替身可审,要么别名直指真实面', () => {
    for (const spec of SUBJECTS) {
      const stub = stubFileFor(spec)
      const hit = aliasTargetFor(spec)
      const judged = stub !== null || (hit !== null && isUnder(hit.abs, AUTH_REAL_DIR))
      expect(
        judged,
        `${spec} 既没有可审的替身文件,别名也没直指真实面 ⇒ 本条判据对它完全失明`,
      ).toBe(true)
    }
  })

  for (const { spec, file } of candidates) {
    const base = path.basename(file)
    it(`${base} 的导出集合 ⊆ 真实模块(${spec})`, () => {
      const real = parseExports(realFileFor(spec))
      expect(real.names.size, `真实模块 ${spec} 一个导出都没解析到 ⇒ 判据失明`).toBeGreaterThan(0)
      const stub = parseExports(file)
      const extra = [...stub.names].filter((n) => !real.names.has(n))
      expect(
        extra,
        `替身导出真实模块里不存在的名字:${extra.join(', ')} —— 这就是"看着覆盖了 SSO,实则测虚构 API"那一型`,
      ).toEqual([])
    })

    it(`${base} 只许转发(不得自己声明导出,也不得出现无 from 的 export {})`, () => {
      const stub = parseExports(file)
      expect(
        stub.selfDeclared,
        `替身自己声明了 ${stub.selfDeclared.join(', ')} ⇒ 那是第二份实现/第二份形状,不是转发`,
      ).toEqual([])
      expect(stub.localExportNames, `替身里出现不带模块说明符的 export { … } ⇒ 同上`).toEqual([])
    })
  }
})

describe('L3 · 真实面平台无关(它一红,L2 的"只许转发"就不再成立)', () => {
  const PLATFORM_PATTERNS: Array<[string, RegExp]> = [
    ['react-native', /['"]react-native['"]/],
    ['expo', /['"]expo[-/]/],
    ['@tarojs', /['"]@tarojs\//],
    ['AsyncStorage', /\bAsyncStorage\b/],
    ['SecureStore', /\bSecureStore\b/],
    ['window.', /\bwindow\s*\./],
    ['document.', /\bdocument\s*\./],
    ['localStorage', /\blocalStorage\b/],
    ['chrome.storage', /\bchrome\.storage\b/],
  ]

  it('packages/shared/src/auth/** 不出现平台 API', () => {
    const files = ['index.ts', 'sso-core.ts', 'token-store.ts', 'auto-refresh.ts', 'auth-utils.ts']
      .map((f) => path.join(AUTH_REAL_DIR, f))
      .filter((f) => existsSync(f))
    expect(files.length, '真实 auth 目录取不到文件 ⇒ 判据失明').toBeGreaterThan(0)
    const offenders: string[] = []
    for (const f of files) {
      const code = readCode(f)
      for (const [name, re] of PLATFORM_PATTERNS) {
        if (re.test(code)) offenders.push(`${path.basename(f)} → ${name}`)
      }
    }
    expect(
      offenders,
      `真实面出现平台 API(${offenders.join(', ')})⇒ "替身只许转发"的前提不再成立,` +
        '需要为那一格单独论证,不得顺手放宽本锁',
    ).toEqual([])
  })
})

describe('L4 · 消费方引的名字必须在真实模块里', () => {
  it('本端每个 @ihui/shared/auth* 的具名 import/export 都取得到真实名字', () => {
    const consumerFiles = collectSources()
    expect(consumerFiles.length, '一个源文件都没扫到 ⇒ 判据失明').toBeGreaterThan(0)

    const reNamed =
      /(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s+['"](@ihui\/shared\/auth(?:\/[A-Za-z0-9_-]+)?)['"]/g
    const reDefault = /import\s+([A-Za-z0-9_$]+)\s+from\s+['"](@ihui\/shared\/auth(?:\/[A-Za-z0-9_-]+)?)['"]/g

    const found: Array<{ spec: string; name: string; file: string }> = []
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
        // 真实面没有 default 导出:出现 default import 就该红,而不是放过。
        found.push({ spec: m[2] as string, name: m[1] as string, file: f })
      }
    }

    expect(found.length, '没扫到任何 @ihui/shared/auth* 的具名消费点 ⇒ 本条判据看不见任何东西').toBeGreaterThan(0)

    const cache = new Map<string, Set<string>>()
    const missing: string[] = []
    for (const { spec, name, file } of found) {
      if (!cache.has(spec)) cache.set(spec, parseExports(realFileFor(spec)).names)
      if (!cache.get(spec)?.has(name)) missing.push(`${path.relative(RN_DIR, file)} → ${name} @ ${spec}`)
    }
    expect(missing, `消费方引了真实模块里不存在的名字:${missing.join(' | ')}`).toEqual([])
  })
})

// 真实 token-store.ts 从 @ihui/api-client 只取 setTokenProvider;本锁不审 api-client 的替身
// (那是另一族,见交付报告"仍未收口的格子")。这里只为把真实 barrel 装起来而提供它。
vi.mock('@ihui/api-client', () => ({ setTokenProvider: vi.fn() }))

describe('L5 · 运行时:别名拿到的是实现本身,不是 undefined', () => {
  it('@ihui/shared/auth/sso-core 解析出真实函数并有真实行为', async () => {
    const mod = (await import('@ihui/shared/auth/sso-core')) as Record<string, unknown>
    for (const n of ['exchangeSsoCode', 'extractSsoCode', 'buildSsoLoginUrl', 'buildSsoRedirectUrl', 'validateToken', 'ssoLogout']) {
      expect(typeof mod[n], `${n} 应为函数;拿到 undefined 就说明别名被指回了虚构替身`).toBe('function')
    }
    const endpoints = mod['SSO_ENDPOINTS'] as Record<string, string> | undefined
    expect(endpoints, 'SSO_ENDPOINTS 缺失').toBeTruthy()
    expect(endpoints?.exchange).toBe('/api/auth/sso/exchange')

    // 虚构替身那个"parseSSOResponse 恒返回 null"永远给不出 code;真实实现给得出。
    const extract = mod['extractSsoCode'] as (u: string) => string | null
    expect(extract('ihui://sso/callback?sso_code=abc123')).toBe('abc123')
    const build = mod['buildSsoLoginUrl'] as (w: string, r: string, c: string) => string
    expect(build('https://web.example', 'ihui://sso/callback', 'cid')).toContain('/sso/login?redirect=')
  })

  it('@ihui/shared/auth 解析出真实工厂(含旧替身缺的 setCachedWithoutPersist)', async () => {
    const mod = (await import('@ihui/shared/auth')) as Record<string, unknown>
    expect(typeof mod['createInMemoryTokenStore'], 'createInMemoryTokenStore 应为函数').toBe('function')
    expect(typeof mod['bindTokenStoreToApiClient'], 'bindTokenStoreToApiClient 应为函数').toBe('function')

    const store = (mod['createInMemoryTokenStore'] as () => Record<string, unknown>)()
    expect(
      typeof store['setCachedWithoutPersist'],
      '旧替身没有这个方法(initApi 的 hydrate 路径会 TypeError);拿到它才说明走的是真实工厂',
    ).toBe('function')

    // 真实工厂的 setToken 是 async;旧替身是同步版并吞掉持久化回调。
    const setToken = store['setToken'] as (t: string | null) => unknown
    expect(setToken('t')).toBeInstanceOf(Promise)
    await setToken('t')
    expect((store['getToken'] as () => string | null)()).toBe('t')
  })

  it('exchangeSsoCode 返回真实形状(accessToken,不是替身的 token)', async () => {
    const payload = {
      code: 0,
      message: 'ok',
      data: {
        accessToken: 'AT',
        refreshToken: 'RT',
        expiresIn: 3600,
        refreshExpiresIn: 7200,
        user: { id: 'u1', phone: '', email: '', nickname: 'n', avatar: '', roleId: 2, status: 1 },
      },
    }
    const fetchMock = vi.fn(async (_input: string | URL, _init?: unknown) => {
      void _input
      void _init
      return { ok: true, status: 200, json: async () => payload } as unknown as Response
    })
    vi.stubGlobal('fetch', fetchMock)
    try {
      const mod = (await import('@ihui/shared/auth/sso-core')) as Record<string, unknown>
      const exchange = mod['exchangeSsoCode'] as (apiBase: string, code: string, clientId: string) => Promise<Record<string, unknown> | null>
      const got = await exchange('http://localhost:8802', 'code-xyz', 'client-1')
      expect(got, '真实实现应返回 data 段').toBeTruthy()
      expect(got?.accessToken, '虚构替身的形状是 token,真实是 accessToken').toBe('AT')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/auth/sso/exchange')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

/** 本端源文件:src/** + tests/**(排除 __mocks__ 与本锁自己)+ App.tsx */
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
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
