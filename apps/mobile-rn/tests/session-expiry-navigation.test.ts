// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 锁 A —— 会话失效的落点:`Login` 必须**在 RootNavigator 的两个分支里都注册着**。
 *
 * 立因(真机量出来的,不是假想需求):RN 的 401 出口 `setUnauthorizedHandler` 里做的是
 * `navigateTo('Login')`,而 `Login` 此前**只存在于未登录分支** —— 带着 token 时
 * `navigate('Login')` 是个空操作(导航树里根本没有这个 screen)。症状是"会话死了、
 * 屏幕上什么都没有、日志里每 60s 重复一次 Invalid or expired token"。
 *
 * 这条不变量此前无人看守:`pnpm typecheck` / eslint / 单测对"少注册一个 screen"全部无声
 * (本仓最高频的失效型 —— 判据失效的表现永远是安静)。守门 148 管的是"这一端注册了
 * setUnauthorizedHandler 没有",它结构上看不见注册之后**跳到哪儿**,这里补的是它下面那一格。
 *
 * 判据按**结构**读,不数全文出现次数:
 *   定位 `<RootStack.Navigator>` 的子节点 → 找 `{token ? ( … ) : ( … )}` 三元
 *   → 分别取两个分支里 brace 深度 0 的 `<X.Screen name="Y">` 声明。
 * 计数式判据(`name="Login"` 出现 2 次)会在两种情形下给出错误答案:注释里提一句就 +1,
 * 将来加第三个分支(如 `pendingToken`)就把"两边都注册"这句承诺稀释成没人看守。
 * 这里只认**元素位置**:JSX 注释是"花括号包起来的块注释",其内容处在 brace 深度 > 0
 * ⇒ 不进射程,由「构造对照 B」把它钉成判据(把真声明原地换成注释里的同一段 JSX ⇒ 必须判红)。
 *
 * 取材口径:判仓库内容 ⇒ **HEAD blob**(`git show HEAD:<path>`),不按磁盘工作树判 ——
 * 共享工作区常年滞后 HEAD,按磁盘读会把别人未提交的半编辑态当本仓事实(守门 77/83 同取向)。
 * 阳性对照读 `e0efe41cfd^`(修好之前的那一版)。git 派生一律带 timeout + windowsHide。
 *
 * 已知边界(如实登记,不等于"没有"):
 *  1. 只认 `<RootStack.Navigator …>{token ? (A) : (B)}</…>` 这一种形态;改成 `&&` 短路、
 *     拆成两个 Navigator、或把条件改名 ⇒ 判「无法判定」并点名,不会静默通过。
 *  2. 模板串里的 `${ … }` 不展开;若某分支的属性写成含裸 `{`/`}` 的模板串,深度会失配 ⇒
 *     表现是解析失败(红),不是误判成"已注册"。
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..', '..', '..')
const NAV_REL = 'apps/mobile-rn/src/navigation/RootNavigator.tsx'
/** 阳性对照出处:这一枚提交把 `Login` 补进已登录分支;它的父版本只在未登录分支注册。 */
const FIX_SHA = 'e0efe41cfd'

function gitShow(rev: string, rel: string): string {
  return execFileSync(
    'git',
    ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', 'show', `${rev}:${rel}`],
    {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
}

// ─────────────────────────────────── 结构解析(纯函数:正/反对照直接喂文本)

export type NavParse = {
  /** 'undetermined' = 结构判不出(改名/换形态/配平失配),**绝不**当成"没问题" */
  status: 'ok' | 'undetermined'
  why: string[]
  /** status==='ok' 时:[0] = token 为真的分支,[1] = token 为假的分支 */
  branches: { kind: 'true' | 'false'; from: number; to: number }[]
  screens: string[][]
}

const EMPTY: NavParse = { status: 'undetermined', why: [], branches: [], screens: [] }

function undetermined(why: string): NavParse {
  return { status: 'undetermined', why: [why], branches: [], screens: [] }
}

function isWs(c: string | undefined): boolean {
  return c === ' ' || c === '\t' || c === '\n' || c === '\r'
}

function skipWs(s: string, i: number): number {
  let j = i
  while (j < s.length && isWs(s[j])) j++
  return j
}

/** i 指向开引号 ⇒ 返回闭引号之后一位。单/双引号遇换行即散(与 `lib/code-mask.mjs` 同一条
 *  防"整片被吞"的规矩:注释里一个孤立撇号不该把后半棵树抹掉)。 */
function skipString(s: string, i: number): number {
  const q = s[i]
  let j = i + 1
  while (j < s.length) {
    if (s[j] === '\\') {
      j += 2
      continue
    }
    if (s[j] === q) return j + 1
    if (s[j] === '\n' && q !== '`') return j
    j++
  }
  return s.length
}

/** i 指向 `{` ⇒ 返回配对 `}` 之后一位;失配返回 -1。内部字符串按字符串跳过。 */
function skipBraces(s: string, i: number): number {
  let depth = 0
  for (let j = i; j < s.length; j++) {
    const c = s[j]
    if (c === "'" || c === '"' || c === '`') {
      j = skipString(s, j) - 1
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return j + 1
    }
  }
  return -1
}

/** [from,to) 每字符是否处在 brace 深度 0;串内一律 false ⇒ JSX 注释不进射程。 */
function depthZeroFlags(s: string, from: number, to: number): boolean[] {
  const flags = new Array<boolean>(Math.max(0, to - from)).fill(false)
  let depth = 0
  for (let i = from; i < to; i++) {
    const c = s[i]
    if (c === "'" || c === '"' || c === '`') {
      const end = Math.min(skipString(s, i), to)
      for (let k = i; k < end; k++) flags[k - from] = false
      i = end - 1
      continue
    }
    if (c === '{') {
      flags[i - from] = depth === 0
      depth++
      continue
    }
    if (c === '}') {
      if (depth > 0) depth--
      flags[i - from] = depth === 0
      continue
    }
    flags[i - from] = depth === 0
  }
  return flags
}

/** i 指向 `(` ⇒ 配对 `)` 下标。跳过 `{…}` 与字符串,故 JSX 注释里的括号不计数。 */
function matchParen(s: string, i: number): number {
  let depth = 0
  for (let j = i; j < s.length; j++) {
    const c = s[j]
    if (c === "'" || c === '"' || c === '`') {
      j = skipString(s, j) - 1
      continue
    }
    if (c === '{') {
      const end = skipBraces(s, j)
      if (end > 0) j = end - 1
      continue
    }
    if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) return j
    }
  }
  return -1
}

/** `<Tag …>` / `<Tag … />` 的那个 `>` 下标(跳过 `{…}` 与字符串)。 */
function endOfOpenTag(s: string, lt: number): number {
  for (let j = lt + 1; j < s.length; j++) {
    const c = s[j]
    if (c === "'" || c === '"' || c === '`') {
      j = skipString(s, j) - 1
      continue
    }
    if (c === '{') {
      const end = skipBraces(s, j)
      if (end > 0) j = end - 1
      continue
    }
    if (c === '>') return j
  }
  return -1
}

/** 一段 JSX 内 brace 深度 0 的 `<X.Screen … name="Y">` 所登记的 screen 名(按出现顺序)。 */
function screensIn(s: string, from: number, to: number): string[] {
  const flags = depthZeroFlags(s, from, to)
  const out: string[] = []
  for (let i = from; i < to; i++) {
    if (!flags[i - from] || s[i] !== '<') continue
    const tagMatch = /^<([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/.exec(s.slice(i, to))
    const tag = tagMatch?.[1] ?? ''
    if (!tag) continue
    const gt = endOfOpenTag(s, i)
    if (gt < 0) continue
    if (/\.Screen$/.test(tag)) {
      const attrs = s.slice(i + tag.length + 1, gt)
      const nm = /\bname\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\})/.exec(attrs)
      const screenName = nm ? (nm[1] ?? nm[2] ?? nm[3] ?? '') : ''
      if (screenName) out.push(screenName)
    }
    i = gt
  }
  return out
}

export function parseNavigator(src: string): NavParse {
  const open = src.indexOf('<RootStack.Navigator')
  if (open < 0) return undetermined('找不到 <RootStack.Navigator 开标签')
  if (src.indexOf('<RootStack.Navigator', open + 1) >= 0)
    return undetermined('出现多个 <RootStack.Navigator,本判据只认单导航树')
  const tagEnd = endOfOpenTag(src, open)
  const close = tagEnd < 0 ? -1 : src.indexOf('</RootStack.Navigator>', tagEnd)
  if (tagEnd < 0 || close < 0) return undetermined('Navigator 标签配对失败(结构改形或解析失配)')

  const c0 = tagEnd + 1
  const flags = depthZeroFlags(src, c0, close)
  for (let i = c0; i < close; i++) {
    if (!flags[i - c0] || src[i] !== '{') continue
    const after = skipWs(src, i + 1)
    if (!/^token\s*\?/.test(src.slice(after, close))) continue
    const tOpen = src.indexOf('(', after)
    const tEnd = tOpen < 0 ? -1 : matchParen(src, tOpen)
    if (tEnd < 0) return undetermined('token 三元真分支括号配平失败')
    const colon = skipWs(src, tEnd + 1)
    if (src[colon] !== ':') return undetermined('token 三元没有 `:` 分支(改成了 && 短路等别的形态)')
    const fOpen = skipWs(src, colon + 1)
    if (src[fOpen] !== '(')
      return undetermined('假分支不是 `( … )` 形态,判据跟不上新写法(请连同判据一起改)')
    const fEnd = matchParen(src, fOpen)
    if (fEnd < 0) return undetermined('token 三元假分支括号配平失败')
    return {
      status: 'ok',
      why: [],
      branches: [
        { kind: 'true', from: tOpen + 1, to: tEnd },
        { kind: 'false', from: fOpen + 1, to: fEnd },
      ],
      screens: [screensIn(src, tOpen + 1, tEnd), screensIn(src, fOpen + 1, fEnd)],
    }
  }
  return { ...EMPTY, why: ['Navigator 子节点里找不到 `{token ? ( … ) : ( … )}` 条件分支'] }
}

export type NavJudgement = {
  status: 'ok' | 'undetermined'
  loggedInScreens: string[]
  loggedOutScreens: string[]
  failures: string[]
}

/** 本锁的唯一命题:两个分支各自都**恰好一次**注册 `Login`。 */
export function judgeLoginRegistration(src: string): NavJudgement {
  const p = parseNavigator(src)
  if (p.status !== 'ok')
    return {
      status: 'undetermined',
      loggedInScreens: [],
      loggedOutScreens: [],
      failures: [`无法判定:${p.why.join(' / ')}`],
    }
  const loggedIn = p.screens[0] ?? []
  const loggedOut = p.screens[1] ?? []
  const failures: string[] = []
  for (const [label, list] of [
    ['已登录(token 为真)', loggedIn],
    ['未登录(token 为假)', loggedOut],
  ] as const) {
    const n = list.filter((x) => x === 'Login').length
    if (n === 0) failures.push(`${label} 分支没有注册 Login —— 该态下 navigate('Login') 是空操作`)
    if (n > 1)
      failures.push(`${label} 分支重复注册 Login ${n} 次 —— 同名 screen 只保留一个,登记意图已失真`)
  }
  return { status: 'ok', loggedInScreens: loggedIn, loggedOutScreens: loggedOut, failures }
}

// ─────────────────────────────────── 用例

const HEAD_SRC = gitShow('HEAD', NAV_REL)
// 阳性对照取材改为仓内夹具:`e0efe41cfd^` 的历史 blob 已在 CI 浅克隆(fetch-depth=1)里不存在
// (PR#65 run 36347067341 红于 "fatal: invalid object name 'e0efe41cfd^'")。
// 夹具 = 该 blob 逐字节副本(sha 08d65c91f0bbd9965aa8ada3054797848dd7cbdf),判据解析行为不变。
const PARENT_SRC = readFileSync(path.join(HERE, '__fixtures__', 'rootnavigator-parent-e0efe41cfd.txt'), 'utf8')

describe('锁 A:Login 在 RootNavigator 两个分支都注册(判 HEAD blob)', () => {
  it('HEAD:两分支各恰好一次,且判据真的解析出了结构(不是"没看见所以通过")', () => {
    const j = judgeLoginRegistration(HEAD_SRC)
    expect(j.status, `未判定:${j.failures.join(';')}`).toBe('ok')
    expect(j.failures).toEqual([])
    expect(j.loggedInScreens.length, '已登录分支解析到 0 个 Screen ⇒ 判据失明').toBeGreaterThan(0)
    expect(j.loggedOutScreens.length, '未登录分支解析到 0 个 Screen ⇒ 判据失明').toBeGreaterThan(0)
    expect(j.loggedInScreens.filter((x) => x === 'Login')).toHaveLength(1)
    expect(j.loggedOutScreens.filter((x) => x === 'Login')).toHaveLength(1)
  })

  it(`阳性对照:${FIX_SHA} 的父版本(只在未登录分支注册)喂同一判据 ⇒ 必须判红`, () => {
    const j = judgeLoginRegistration(PARENT_SRC)
    console.info(`[锁 A 阳性对照 ${FIX_SHA}^] ${j.status} / 判红 ${j.failures.length} 条`)
    for (const f of j.failures) console.info(`  ✗ ${f}`)
    expect(j.status, `父版本应当仍能解析出结构,实际:${j.failures.join(';')}`).toBe('ok')
    expect(j.failures).toHaveLength(1)
    expect(j.failures[0]).toMatch(/已登录/)
    expect(j.loggedOutScreens).toContain('Login')
  })

  it('构造对照 A:删掉 HEAD 已登录分支那一行 ⇒ 判红(证明判据认的就是那一行)', () => {
    const line = '            <RootStack.Screen name="Login" component={LoginScreen} />\n'
    const at = HEAD_SRC.indexOf(line)
    expect(at, '锚点行不在 HEAD 文本里 ⇒ 本例的构造失效,判据颜色不可信').toBeGreaterThan(-1)
    const j = judgeLoginRegistration(HEAD_SRC.slice(0, at) + HEAD_SRC.slice(at + line.length))
    expect(j.failures).toHaveLength(1)
    expect(j.failures[0]).toMatch(/已登录/)
  })

  it('构造对照 B:把两处真声明原地改成"注释里的同一段 JSX" ⇒ 仍判红(计数式判据在这一格会洗绿)', () => {
    const line = '            <RootStack.Screen name="Login" component={LoginScreen} />\n'
    const comment =
      '            {/* <RootStack.Screen name="Login" component={LoginScreen} /> */}\n'
    expect(HEAD_SRC.split(line).length - 1, 'HEAD 里锚点行应有 2 处,否则本例的构造失效').toBe(2)
    const swapped = HEAD_SRC.split(line).join(comment)
    const naiveCount = swapped.split('name="Login"').length - 1
    const j = judgeLoginRegistration(swapped)
    console.info(
      `[锁 A 计数反证] 全文 name="Login" 出现 ${naiveCount} 次,结构判据仍判红 ${j.failures.length} 条`,
    )
    for (const f of j.failures) console.info(`  ✗ ${f}`)
    expect(naiveCount, '构造后全文仍有 2 处 Login 字样 ⇒ "数出现次数"的判据会当它是好的').toBe(2)
    expect(j.status).toBe('ok')
    expect(j.failures.join('\n')).toMatch(/已登录/)
    expect(j.failures.join('\n')).toMatch(/未登录/)
  })

  it('构造对照 C:结构整体改形 ⇒ 判「无法判定」而不是通过', () => {
    const j = judgeLoginRegistration('export function RootNavigator() {\n  return null\n}\n')
    expect(j.status).toBe('undetermined')
    expect(j.failures.join('')).toMatch(/无法判定/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
