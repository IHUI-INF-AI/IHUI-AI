// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 常驻锁:@ihui/shared/constants 的 vitest 别名与端内替身不得比真实常量表少名字/改值
 *
 * 立票事实(每一条都是本文件现读到的判据,不是转述):
 * `vitest.config.ts` 曾把 `'@ihui/shared/constants'` 指到 `tests/__mocks__/ihui-shared.ts`,
 * 而那份替身把真实表的两个成员**刻意清空**(`FALLBACK_MODELS = []`、`SSO_CLIENT_IDS = {}`),
 * 另外四个成员是手抄的字面量。本端真实消费方经这两个入口取用:
 * `src/screens/ChatScreen.tsx` 读 `FALLBACK_MODELS[0]!.id`、
 * `src/screens/AiAssistantN8nScreen.tsx` 读 `FALLBACK_MODELS[0]?.value`、
 * `src/lib/config.ts` 读 `SSO_CLIENT_IDS.MOBILE_RN` ⇒ 在 vitest 下这些位置拿到的是
 * undefined / 空表,凡是走这条路又没有自带 `vi.mock` 的用例,断言的是虚构数据而不是实现。
 * 同族前两格已按同一写法收口(见 shared-auth-alias-fidelity.test.ts /
 * api-client-alias-fidelity.test.ts),本文件钉第三格。
 *
 * 判四件事,任何一条不成立即红(空扫描一律判"判据失明",不读成通过):
 *   K1 别名面:`@ihui/shared/constants` 与其 storage-keys 子路径都必须在别名表里、
 *      目标文件必须存在、且都解析到 `packages/shared/src/constants/` 下的真实源码;
 *      子路径必须排在父路径之前(Vite 别名按插入顺序做前缀匹配,父路径排前面会把子路径
 *      吞成 `<index.ts>/storage-keys` 而解析失败)。
 *   K2 真实面平台无关:K3 的"只许转发"以此为前提;K2 红则 K3 的结论作废。
 *   K3 替身面:那六个常量名在替身里**必须是带 from 的转发**,不得自述(自述 = 第二份真相,
 *      清空 = 虚构数据,两者本锁都判红)。
 *   K4 运行时:经 `@ihui/shared/constants`(别名直连真实面)与经 `@ihui/shared`(替身转发)
 *      拿到的必须是**同一个对象引用**,且取值非空非 undefined —— 拿到空表就说明别名被指回了替身。
 *
 * 失效方向:红着逼人回来改。给替身再抄一个字面量、或把别名指回替身,本文件必红。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync, type Dirent } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url))
const RN_DIR = path.resolve(TESTS_DIR, '..')
const REPO_ROOT = path.resolve(RN_DIR, '..', '..')
const CONST_REAL_DIR = path.join(REPO_ROOT, 'packages', 'shared', 'src', 'constants')
const MOCKS_DIR = path.join(TESTS_DIR, '__mocks__')
const CONFIG_FILE = path.join(RN_DIR, 'vitest.config.ts')

const BARREL_SPEC = '@ihui/shared/constants'
const SUBPATH_SPEC = '@ihui/shared/constants/storage-keys'
const SUBJECTS = [SUBPATH_SPEC, BARREL_SPEC] as const

/**
 * 替身必须"只许转发"的六个名字(票 #27 之前它们要么被清空、要么是手抄字面量)。
 * 名单从替身与真实面两侧各读一次再核对本锁才成立 —— 只列一侧就会把"漏了名字"读成"没问题"。
 */
const FORWARDED_NAMES = [
  'FALLBACK_MODELS',
  'SSO_CLIENT_IDS',
  'LOCALE_STORAGE_KEY',
  'TOKEN_STORAGE_KEY',
  'REFRESH_TOKEN_STORAGE_KEY',
  'DEFAULT_AVATAR_URL',
] as const

/** 只剥注释,保留字符串与行号(别名说明符住在字符串里,而替身的说明文字逐字提到旧写法)。 */
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
    if (
      (state === 'sq' && ch === "'") ||
      (state === 'dq' && ch === '"') ||
      (state === 'tpl' && ch === '`')
    ) {
      state = 'code'
    }
  }
  return out
}

function readCode(file: string): string {
  return maskComments(readFileSync(file, 'utf8'))
}

/**
 * 从 vitest.config.ts 的 alias 字面量按**源序**取 `key → 相对 __dirname 的目标`。
 * 必须同时吃单行与多行两种书写并吃下尾随逗号:只认单行的解析会把多行别名看成不存在,
 * 而"没扫到"在本锁里必须判红而不是判绿(shared-auth-alias-fidelity 同一课)。
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

function aliasTargetFor(spec: string): { abs: string; index: number } | null {
  const index = ALIAS_ENTRIES.findIndex((e) => e.key === spec)
  if (index < 0) return null
  const entry = ALIAS_ENTRIES[index] as { key: string; target: string }
  return { abs: path.resolve(RN_DIR, entry.target), index }
}

/** 真实常量目录下的源文件(排除 `__tests__` 与本锁不审的 .d.ts)。 */
function realConstantFiles(): string[] {
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
        if (d.name === '__tests__' || d.name === 'node_modules') continue
        walk(full)
        continue
      }
      if (!d.name.endsWith('.ts') || d.name.endsWith('.d.ts')) continue
      try {
        if (statSync(full).isFile()) out.push(full)
      } catch {
        continue
      }
    }
  }
  walk(CONST_REAL_DIR)
  return out
}

const STUB_FILE = path.join(MOCKS_DIR, 'ihui-shared.ts')

describe('K1 · 别名面:@ihui/shared/constants* 必须解析到真实源码,且子路径在前', () => {
  it('别名表非空扫描,且两个 subject 都有条目、目标文件存在', () => {
    expect(
      ALIAS_ENTRIES.length,
      'vitest.config.ts 里没解析出任何别名条目 ⇒ 判据失明',
    ).toBeGreaterThan(0)
    for (const spec of SUBJECTS) {
      const hit = aliasTargetFor(spec)
      expect(hit, `别名表缺少 ${spec}(多行 + 尾随逗号的写法也必须被认出来)`).toBeTruthy()
      expect(existsSync(hit!.abs), `${spec} 的别名目标不存在:${hit!.abs}`).toBe(true)
    }
  })

  it('两个 subject 都解析到 packages/shared/src/constants/ 下(不得再指回端内替身)', () => {
    for (const spec of SUBJECTS) {
      const hit = aliasTargetFor(spec)
      expect(hit, `别名表缺少 ${spec}`).toBeTruthy()
      expect(
        isUnder(hit!.abs, CONST_REAL_DIR) || hit!.abs === path.join(CONST_REAL_DIR, 'index.ts'),
        `${spec} 的别名没有指向真实常量面:${hit!.abs} —— 指回 tests/__mocks__ 就是"测替身"那一型`,
      ).toBe(true)
    }
  })

  it('子路径别名排在父路径别名之前(Vite 按插入顺序做前缀匹配)', () => {
    const sub = aliasTargetFor(SUBPATH_SPEC)
    const parent = aliasTargetFor(BARREL_SPEC)
    expect(sub, `别名表缺少 ${SUBPATH_SPEC}`).toBeTruthy()
    expect(parent, `别名表缺少 ${BARREL_SPEC}`).toBeTruthy()
    const swallowedBy = ALIAS_ENTRIES.map((e, i) => ({ ...e, i }))
      .filter(
        ({ key, i }) =>
          i < sub!.index && key !== SUBPATH_SPEC && SUBPATH_SPEC.startsWith(`${key}/`),
      )
      .map(({ key }) => key)
    expect(
      swallowedBy,
      `${SUBPATH_SPEC} 会被更早出现的别名 ${swallowedBy.join(', ')} 吞掉 ⇒ 顺序必须往下挪`,
    ).toEqual([])
    expect(sub!.index, '子路径别名必须在父路径之前').toBeLessThan(parent!.index)
  })
})

describe('K2 · 真实面平台无关(它一红,K3 的"只许转发"就不再成立)', () => {
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

  it('constants 目录取到文件(空枚举判红,不读成通过)', () => {
    expect(
      realConstantFiles().length,
      `${CONST_REAL_DIR} 下一个 .ts 都没扫到 ⇒ 判据失明`,
    ).toBeGreaterThan(0)
  })

  it('真实常量面不出现平台 API,也不出现必须经打包器解析的裸包说明符', () => {
    const files = realConstantFiles()
    const offenders: string[] = []
    for (const f of files) {
      const code = readCode(f)
      for (const [name, re] of PLATFORM_PATTERNS) {
        if (re.test(code)) offenders.push(`${path.basename(f)} → ${name}`)
      }
      // 非相对、非 type-only 的外部运行时依赖 ⇒ vitest 下要靠别的别名才活得下来,
      // 那就不是"纯常量面",K3 的转发前提随之失效。`import type { … } from '@ihui/types'` 是
      // 编译期擦除的,不算。
      const reRuntimeImport =
        /(?:^|\n)\s*import\s+(?!type\s)[^;\n]*?from\s+['"]([^./'"][^'"]*)['"]/g
      for (const m of code.matchAll(reRuntimeImport)) {
        offenders.push(`${path.basename(f)} → 运行时裸包 import:${m[1]}`)
      }
    }
    expect(
      offenders,
      `真实常量面出现 ${offenders.join(' | ')} ⇒ "替身只许转发"的前提不再成立,` +
        '需要为那一格单独论证,不得顺手放宽本锁',
    ).toEqual([])
  })
})

describe('K3 · 替身面:六个常量名只许转发、不得自述', () => {
  it('替身文件在位', () => {
    expect(existsSync(STUB_FILE), `替身文件不在位:${STUB_FILE} ⇒ 本条判据失明`).toBe(true)
  })

  it('六个名字都是带 from 的转发,且没有任何一处自述字面量', () => {
    const code = readCode(STUB_FILE)
    const selfDeclared: string[] = []
    const notForwarded: string[] = []
    for (const name of FORWARDED_NAMES) {
      const reDecl = new RegExp(`export\\s+(?:const|let|var|function|class)\\s+${name}\\b`)
      if (reDecl.test(code)) selfDeclared.push(name)
      // 转发形态两种都认:`export { NAME } from '…'` 与多行 `export {\n A,\n B,\n} from '…'`。
      const reNamed = new RegExp(
        `export\\s+(?:type\\s+)?\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]`,
      )
      const reStar = /export\s+\*\s+from\s+['"][^'"]+['"]/
      if (!reNamed.test(code) && !reStar.test(code)) notForwarded.push(name)
    }
    expect(selfDeclared, `替身自述了 ${selfDeclared.join(', ')} ⇒ 那是第二份真相,不是转发`).toEqual(
      [],
    )
    expect(notForwarded, `替身里 ${notForwarded.join(', ')} 取不到转发形态`).toEqual([])
  })

  it('转发目标逐个可解析(路径写歪会让替身拿到 undefined 而账面仍是"转发了")', () => {
    const code = readCode(STUB_FILE)
    const reNamed = /export\s+(?:type\s+)?\{([^}]*)\}\s*from\s+['"]([^'"]+)['"]/g
    const reached = new Set<string>()
    const missingFile: string[] = []
    for (const m of code.matchAll(reNamed)) {
      const spec = m[2] as string
      if (!spec.startsWith('.')) continue
      const abs = path.resolve(path.dirname(STUB_FILE), spec)
      const candidates = [abs, `${abs}.ts`, `${abs}.tsx`, path.join(abs, 'index.ts')]
      if (!candidates.some((c) => existsSync(c) && statSync(c).isFile())) {
        missingFile.push(spec)
        continue
      }
      for (const raw of (m[1] as string).split(',')) {
        const entry = raw.trim().replace(/^type\s+/, '')
        const exported = (entry.split(/\s+as\s+/)[1] ?? entry).trim()
        if (exported) reached.add(exported)
      }
    }
    expect(missingFile, `替身转发到取不到的文件:${missingFile.join(', ')}`).toEqual([])
    const absent = FORWARDED_NAMES.filter((n) => !reached.has(n))
    expect(absent, `替身没有把 ${absent.join(', ')} 转发进来`).toEqual([])
  })
})

describe('K4 · 运行时:别名拿到的是真实常量表本身,不是空表', () => {
  it('经 @ihui/shared/constants 与经 @ihui/shared 拿到同一引用,且值非虚构', async () => {
    const viaAlias = (await import('@ihui/shared/constants')) as Record<string, unknown>
    const viaStub = (await import('@ihui/shared')) as Record<string, unknown>

    const sso = viaAlias.SSO_CLIENT_IDS as Record<string, string> | undefined
    expect(sso, 'SSO_CLIENT_IDS 取不到 ⇒ 别名被指回了清空它的替身').toBeTruthy()
    // 真实值 'mobile-rn';替身旧写法给的是 {} ⇒ 这一条就是"测替身"与"测实现"的分界。
    expect(sso?.MOBILE_RN, `SSO_CLIENT_IDS.MOBILE_RN 实得 ${String(sso?.MOBILE_RN)}`).toBe(
      'mobile-rn',
    )

    const models = viaAlias.FALLBACK_MODELS as ReadonlyArray<Record<string, unknown>> | undefined
    expect(Array.isArray(models), 'FALLBACK_MODELS 应为数组').toBe(true)
    expect(
      models?.length ?? 0,
      'FALLBACK_MODELS 是空表 ⇒ 拿到的是替身虚构的降级模型列表',
    ).toBeGreaterThan(0)
    expect(typeof (models?.[0] as Record<string, unknown>)?.value, '首项必须有 value').toBe(
      'string',
    )

    // 两条入口必须汇到同一个模块实例 —— 若替身自己再抄一份,这里就会分叉。
    expect(viaStub.SSO_CLIENT_IDS, '@ihui/shared 面上的 SSO_CLIENT_IDS 缺失').toBe(sso)
    expect(viaStub.FALLBACK_MODELS, '@ihui/shared 面上的 FALLBACK_MODELS 缺失').toBe(models)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
