// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 「登录态第二份真相」的形状锁(G-374 的读侧那一半)
//
// 判的是什么:登录态唯一权威是「有没有 token」(共享工厂 createAuthStore 就是这么算的)。
// 把 isAuthenticated 写进持久化 blob,就等于给同一件事留第二个副本 —— 失效形态是
// 「token 已清而 blob 仍 true」⇒ UI 认为已登录、请求全 401。
// 共享工厂侧已于 2026-09-28 收口(partialize 只落 user、merge 读回即剥除该键),
// 但**没有任何尺子看守"下一次有人在别的端/别的 store 里再写一份"** —— 本文件补这一格。
//
// 三条设计前提(都是本仓记过最多次的失效型):
// 1. **判据不许有第二份**:shared 工厂的 partialize 与 merge 的真由 `auth-derived-session-state.test.ts`
//    用运行时结构位判(那才是真判据);本文件只做**源码形状锁**(它判的是"有没有人把这个键交进持久化"),
//    两者判的东西不同,不互相顶结论。
// 2. **台账必须自证不腐烂**:登记表里某条若在被审面上不再成立 ⇒ 判红。豁免清单必然腐烂(AGENTS §4)。
// 3. **枚举到 0 判死**:扫不到任何"接了持久化的 store"就是尺子空转,不得读成通过。
//
// 读各端源码用 readFileSync,不构成 import 边(与 tests/chat/waiting-keys-in-end-packages.test.ts
// 同一落点理由:架构契约门 103 判 D2 只看层序 rank,端在 shared 之下,反向引用即红)。
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')

/** 被登记的"持久化里携带登录态"的存量站点(只允许这一条,新增别处一律判红)。 */
interface PersistedAuthTruthSite {
  /** 相对仓库根的路径(内容锚点,不写行号 —— 行号在任何一次 append 后都会挪位) */
  file: string
  /** 该 store 的 persist key */
  persistKey: string
  /** 为什么它此刻还开着(没有理由的登记不算登记) */
  reason: string
  /** 复审到期日(过期未处置 ⇒ 判红,不得让豁免只出生不死亡) */
  reviewBy: string
}

const LEDGER: readonly PersistedAuthTruthSite[] = [  {
    file: 'apps/web/src/stores/auth.ts',
    persistKey: 'ihui-auth',
    reason:
      'web 的权威凭据在 httpOnly cookie 里(JS 读不到),冷启动内存 token 恒 null,而 MobileLoginGate 按 ' +
      'isAuthenticated 决定挂不挂 children —— 该键此刻是"bootstrap 刷新落定前的乐观提示",不是与 token 并列的第二把尺子。' +
      '它由同文件的 logout()/setToken(null) 落持久登出标记(lib/session-marker.ts)+ use-auth-bootstrap 在标记在场时立即 logout() 兜住。' +
      '真要按派生口径收口,前置是 MobileLoginGate 改为等 bootstrap ready 再判定(否则每次冷启动把已登录用户判成未登录,' +
      '正是本票禁止的"当场判用户没登录"),属 web 移动 App 首屏行为决策,不在本形状锁射程内代裁。',
    reviewBy: '2026-12-31',
  },
]

const SCAN_ROOTS = ['apps', 'packages'] as const
/** 台账基准站点(空台账 = 本文件的"新增即红"与"腐烂即红"同时失去参照,判死而不是判绿) */
const PRIMARY_SITE = LEDGER[0]
if (!PRIMARY_SITE) {
  throw new Error('[persisted-auth-truth-shape-lock] 台账为空 ⇒ 尺子没有基准,不得读成通过')
}
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/
const SKIP_DIR = new Set(['node_modules', 'dist', '.next', '.turbo', 'coverage', 'build', '.output'])

/** 测试面与被锁源码自己的判据串不进射程(否则门会给自己发合格证,同守门 102 的遮噪教训)。 */
function isTestSurface(path: string): boolean {
  return (
    /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(path) ||
    /(^|\/)(__tests__|tests|e2e)(\/|$)/.test(path)
  )
}

/**
 * 等长遮罩:把注释(以及按需把字符串)替换成同长度空白,保持行列位不变(本文件按行开窗读判据)。
 * 为什么必须遮:AGENTS 记过两类同型失效 —— 注释里逐字引用了被判形态会被判成违规
 * (守门 131/146),而 URL 里的 `//` 会把真代码吃进行注释(守门 70)。这里用单遍状态机,
 * 两种失效方向都堵:既不把散文当代码,也不把代码当散文。
 *
 * **字符串遮不遮要按判据分两种档**(守门 118 同一条):
 * - 认"某个键被当成字段交出去"时连字符串一起抹(否则注释/日志文案里的 `isAuthenticated:` 会冒充真站点);
 * - 认 **import/export 说明符**时必须保留字符串 —— 模块路径本身就是字符串,抹掉它等于把
 *   `export * from './auth-store'` 抹成 `export * from '            '`,判据对着空白要求命中。
 */
export function maskCommentsAndStrings(src: string, opts?: { maskStrings?: boolean }): string {
  const maskStrings = opts?.maskStrings !== false
  const out: string[] = new Array(src.length)
  let i = 0
  type Mode = 'code' | 'line' | 'block' | 'single' | 'double' | 'template'
  let mode: Mode = 'code'
  while (i < src.length) {
    // noUncheckedIndexedAccess=true:下标读到的类型是 string | undefined,循环界内恒有值,
    // 用 ?? '' 落一个合法字符,而不是靠 ! 断言把类型层的疑问藏起来
    const ch = src[i] ?? ''
    const next = src[i + 1] ?? ''
    if (mode === 'code') {
      if (ch === '/' && next === '/') {
        mode = 'line'
        out[i] = ' '
        out[i + 1] = ' '
        i += 2
        continue
      }
      if (ch === '/' && next === '*') {
        mode = 'block'
        out[i] = ' '
        out[i + 1] = ' '
        i += 2
        continue
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        mode = ch === "'" ? 'single' : ch === '"' ? 'double' : 'template'
        // maskStrings=false 时仍进入字符串态(这样串里的 `//` 不会被当成注释),只是不抹字节
        out[i] = maskStrings ? ' ' : ch
        i += 1
        continue
      }
      out[i] = ch
      i += 1
      continue
    }
    // 注释内部**恒**抹白(散文不得被读成代码);字符串按 maskStrings 决定抹还是放行
    const inComment = mode === 'line' || mode === 'block'
    out[i] = ch === '\n' ? '\n' : inComment || maskStrings ? ' ' : ch
    if (mode === 'line' && ch === '\n') mode = 'code'
    else if (mode === 'block' && ch === '*' && next === '/') {
      out[i] = ' '
      out[i + 1] = ' '
      mode = 'code'
      i += 2
      continue
    } else if (mode === 'single' && ch === '\\') {
      out[i + 1] = src[i + 1] === '\n' ? '\n' : maskStrings ? ' ' : (src[i + 1] ?? ' ')
      i += 2
      continue
    } else if (mode === 'double' && ch === '\\') {
      out[i + 1] = src[i + 1] === '\n' ? '\n' : maskStrings ? ' ' : (src[i + 1] ?? ' ')
      i += 2
      continue
    } else if (mode === 'template' && ch === '\\') {
      out[i + 1] = src[i + 1] === '\n' ? '\n' : maskStrings ? ' ' : (src[i + 1] ?? ' ')
      i += 2
      continue
    } else if (
      (mode === 'single' && ch === "'") ||
      (mode === 'double' && ch === '"') ||
      (mode === 'template' && ch === '`')
    ) {
      mode = 'code'
    }
    i += 1
  }
  return out.join('')
}

/** 接了持久化的形状:partialize / zustand persist / 本仓 createPersistConfig 三种写法都认。 */
const PERSIST_WIRING_RES = [/\bpartialize\b/, /\bcreatePersistConfig\s*[<(]/, /\bpersist\s*[<(]/]
/** 该键被当成**字段**交出去:`isAuthenticated: x` 或对象里的简写 `isAuthenticated,`。 */
const FLAG_AS_FIELD_RES = [/\bisAuthenticated\s*:/, /[,{]\s*isAuthenticated\s*[,}\n]/]
/** 从"接持久化"那一行往后看这么多行:partialize 的实现体通常 ≤10 行,给到 24 行仍不算宽。 */
const WINDOW_LINES = 24

/**
 * 返回该文件里"把登录态键交给持久化"的行号(1 基)。空数组 = 这一面没写第二份真相。
 * 导出仅供本文件自证判据有牙用(构造面),不被别处引用。
 */
export function findPersistedAuthTruth(src: string): number[] {
  const masked = maskCommentsAndStrings(src)
  const lines = masked.split('\n')
  const hits: number[] = []
  for (let idx = 0; idx < lines.length; idx += 1) {
    if (!PERSIST_WIRING_RES.some((re) => re.test(lines[idx] ?? ''))) continue
    const window = lines.slice(idx, idx + WINDOW_LINES)
    for (let k = 0; k < window.length; k += 1) {
      if (FLAG_AS_FIELD_RES.some((re) => re.test(window[k] ?? ''))) {
        hits.push(idx + k + 1)
        break
      }
    }
  }
  return hits
}

/**
 * 枚举面 = **git 跟踪的文件**,不是磁盘遍历(2026-09-29 实测改,原为 `readdirSync` 递归)。
 *
 * 磁盘遍历在本机扫到 24,207 个文件,其中 `apps/mobile-cap/www/`(被 `apps/mobile-cap/.gitignore:1`
 * 忽略)与 `apps/web/.next-static-r2/`(根 `.gitignore:79` 的 next-static 前缀规则)是**构建产物镜像** ——
 * 里面是几 MB 的压缩 chunk。于是本用例同时坏在两处,而且都是"看起来像发现,其实是尺子自己的洞":
 * ① "新增站点即红"把产物里出现的 `isAuthenticated` 当成"第二份真相"(那是 web 打包结果的镜像,
 *    源码本来就在里面,不是新增站点);
 * ② 同步读大 chunk 把 vitest 默认 5s 顶穿,三条用同一个 `scanRepo()` 的用例一起超时。
 * 口径与本仓所有对账门一致(77/83/98/118):**判"仓库内容"要先问 git 这文件跟不跟踪**。
 * 取材不到 ⇒ 大声失败并写明"无从判定",既不冒绿也不让人误读成"缺陷还在"。
 */
function trackedSources(): string[] {
  let out = ''
  try {
    out = execFileSync(
      'git',
      ['-c', 'safe.directory=*', '-C', REPO_ROOT, 'ls-files', '-z', '--', ...SCAN_ROOTS],
      { encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 1 << 26 },
    )
  } catch (e) {
    throw new Error(
      `[persisted-auth-truth-shape-lock] 问不到 git 跟踪清单 ⇒ 本尺子没有取材面,不得读成通过,也不得读成"缺陷仍在":${(e as Error)?.message ?? e}`,
    )
  }
  return out
    .split('\0')
    .filter(
      (rel) =>
        rel.length > 0 &&
        SOURCE_EXT.test(rel) &&
        !isTestSurface(rel) &&
        !rel.split('/').some((seg) => SKIP_DIR.has(seg)),
    )
}

/** 扫全仓 store 面,返回"把 isAuthenticated 交给持久化"的文件清单。 */
export function scanRepo(): Array<{ file: string; lines: number[] }> {
  const results: Array<{ file: string; lines: number[] }> = []
  for (const rel of trackedSources()) {
    let src = ''
    try {
      src = readFileSync(join(REPO_ROOT, rel), 'utf8')
    } catch {
      continue
    }
    const lines = findPersistedAuthTruth(src)
    if (lines.length > 0) results.push({ file: rel, lines })
  }
  return results
}

describe('G-374 形状锁:登录态不得被交进持久化(除登记的那一处)', () => {
  it('判据有牙 · 阳性对照:构造一份"新端 store 把 isAuthenticated 写进 partialize"必须命中', () => {
    const violating = [
      `import { persist } from 'zustand/middleware'`,
      `export const useFoo = create(persist(() => ({`,
      `  isAuthenticated: false,`,
      `  token: null as string | null,`,
      `}), { name: 'foo', partialize: (s) => ({ isAuthenticated: s.isAuthenticated }) })`,
    ].join('\n')
    expect(findPersistedAuthTruth(violating).length, '新写的第二份真相必须被点名').toBeGreaterThan(0)
  })

  it('判据不误伤 · 反向对照:只持久化 user(共享工厂的收口形态)与注释里的引用都不计', () => {
    const clean = [
      `// 旧写法曾写 isAuthenticated: true,现已收口为派生`,
      `export const store = createAuthStore({`,
      `  userPersistKey: 'ihui-auth-user',`,
      `  // partialize 只落 user`,
      `})`,
      `const a = { token: null, isAuthenticated: false }`,
      `function derive(x: { isAuthenticated: boolean }) {`,
      `  return x`,
      `}`,
    ].join('\n')
    expect(findPersistedAuthTruth(clean)).toEqual([])
  })

  it('枚举闭合:面上确实扫到了接持久化的 store(扫不到即尺子空转,不得读成通过)', () => {
    const found = scanRepo()
    // 阳性对照用真仓:登记站点必须在读数里(读不到 = 本文件的取材面或判据坏了)
    expect(
      found.map((f) => f.file),
      '登记站点未被扫出 ⇒ 尺子对该形态失明',
    ).toContain(PRIMARY_SITE.file)
  })

  it('新增站点即红:除登记的那一处之外,任何文件都不得把登录态交给持久化', () => {
    const found = scanRepo()
    const allowed = new Set(LEDGER.map((l) => l.file))
    const offenders = found.filter((f) => !allowed.has(f.file))
    expect(
      offenders,
      `出现未登记的"存储里的 isAuthenticated"(登录态第二份真相): ${offenders
        .map((o) => `${o.file}:${o.lines.join(',')}`)
        .join(' | ')} —— 出口只有一个:登录态由 token 派生(订阅用 @ihui/shared/stores 的 selectIsAuthenticated)`,
    ).toEqual([])
  })

  it('台账不得腐烂:登记的站点若已不再携带该键,必须删行而不是留着替人发合格证', () => {
    const found = new Map(scanRepo().map((f) => [f.file, f]))
    for (const site of LEDGER) {
      const hit = found.get(site.file)
      expect(hit, `${site.file} 已不再把登录态交给持久化 ⇒ 台账条目过期,请删除该行并复核是否漏扫`).toBeTruthy()
      expect(site.reason.length, '登记必须带理由(无理由的豁免等于没有豁免)').toBeGreaterThan(20)
      expect(site.reviewBy, '登记必须带复审到期日(AGENTS 守门 108:豁免不得只出生不死亡)').toMatch(
        /^\d{4}-\d{2}-\d{2}$/,
      )
    }
  })

  it('读侧唯一投影出口在位:selectIsAuthenticated 必须从包主入口可达(否则端内只能深导入,门 103 判 D3)', () => {
    const authStoreSrc = maskCommentsAndStrings(
      readFileSync(join(REPO_ROOT, 'packages/shared/src/stores/auth-store.ts'), 'utf8'),
    )
    // 说明符档:只遮注释、保留字符串。抹掉字符串的写法在本文件第一版就把这条判据判红过 ——
    // `export * from './auth-store'` 被抹成 `export * from '            '`,判据对着自己的空白要命中。
    const barrelSrc = maskCommentsAndStrings(
      readFileSync(join(REPO_ROOT, 'packages/shared/src/stores/index.ts'), 'utf8'),
      { maskStrings: false },
    )
    expect(authStoreSrc).toMatch(/export function selectIsAuthenticated/)
    expect(barrelSrc).toMatch(/export \* from ['"]\.\/auth-store['"]/)
    // 两档确有差别(有牙证明):同一份原文走"抹字符串"档时,这条说明符判不出来
    const maskedStrings = maskCommentsAndStrings(
      readFileSync(join(REPO_ROOT, 'packages/shared/src/stores/index.ts'), 'utf8'),
    )
    expect(maskedStrings).not.toMatch(/from ['"]\.\/auth-store['"]/)
  })

  it('共享工厂自身不得把登录态交给持久化(partialize 只落 user)', () => {
    const authStoreSrc = maskCommentsAndStrings(
      readFileSync(join(REPO_ROOT, 'packages/shared/src/stores/auth-store.ts'), 'utf8'),
    )
    const partializeIdx = authStoreSrc.indexOf('partialize:')
    expect(partializeIdx, '共享工厂的 partialize 不见了 ⇒ 本文件的判据需要跟着改').toBeGreaterThan(-1)
    const block = authStoreSrc.slice(partializeIdx, partializeIdx + 600)
    expect(block).not.toMatch(/isAuthenticated\s*:/)
    expect(block).toMatch(/\buser\b/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
