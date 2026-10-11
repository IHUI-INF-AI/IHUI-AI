#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-1118436:HEAD 面(已入库代码)能否类型检查的**主动**出口。
 *
 * 为什么要有它:提交链上的两把尺子(check-staged-typecheck / check-typecheck)都以"这次改了什么"
 * 为输入,所以"没人碰的那个端今天本来就编译不过"没有任何一处会喊;而部署环只在**失败之后**才归因
 * (巡检 P5b)。本工具不问"这次改了什么",逐端跑各端自己的 tsc,把报错喂给 P5b 那一条**已接线的**
 * 归因判据,只回答一句:"已入库代码红不红"。
 *
 * 三条不可漂的写法:
 *  ① **归因判据不得有第二份实现** —— 三态裁定只由 `check-ops-patrol.mjs` 的 `attribBuildFailures` 给,
 *     本文件只做"跑 + 取日志 + 读它的结论"。取材装配(`makeHeadFaceDeps`)按该判据自己的文档归调用方,
 *     但它带**阳性对照**(S17):HEAD 里真存在的文件必须读得到,读不到就不给它发合格证。
 *  ② **净面方案已实测否证**(2026-10-11):git archive 在 MSYS 下解压不完整;换成 worktree 净面并把
 *     node_modules 全部 junction 回真仓,cli 端一次 tsc 仍报 210 处 TS2307(workspace 包的类型来自
 *     各自构建产物)⇒ "跑不动"不等于"没有错"。所以本工具**跑在真仓工作树上**,靠归因把在飞污染摘出去。
 *  ③ **未跑到 ≠ 通过**:超预算 / tsc 起不来 / 端没有 tsconfig 都各自落未判定并点名原因。
 *
 * 定级:**手动问责档 / 巡检候选,刻意不在提交链**。它判的是仓库整体状态而非本次改动 ⇒ 挂 blocking
 * 就是每台每次被逼 --no-verify、连带该枚提交上全部守门作废(AGENTS §12e 同型)。
 * 尚未接入 git-guardian 巡检轮 —— 原因是 check-ops-patrol.mjs 与 git-guardian.mjs 此刻均被他席在飞
 * 改动持有(AGENTS §12 只报不动);接线由该两文件的持有者收尾时做,或等其干净后由主会话单写者落。
 *
 * 用法:node scripts/check-head-typecheck.mjs [--ends=apps/web,apps/api] [--timeout-ms=240000]
 *       [--budget-ms=600000] [--json] [--self-test]
 * 退出码:0 = 无"已入库红"(含只有未判定的情形,末行会喊);1 = 至少一端红在已入库代码;
 *         2 = 一把都没跑到(脚本自身或环境失效,不得读成"没问题")。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { attribBuildFailures } from './check-ops-patrol.mjs'
import { gitRaw } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 端清单**现读**得到,不维护手工名单(名单必然腐烂 —— §4 对 RN_ONLY_BRAND_KEYS 记过同一条教训)。 */
export function discoverEnds(root = ROOT) {
  const out = []
  for (const group of ['apps', 'packages']) {
    const base = join(root, group)
    if (!existsSync(base)) continue
    for (const d of readdirSync(base)) {
      const rel = `${group}/${d}`
      const tsconfig = join(root, rel, 'tsconfig.json')
      if (!existsSync(tsconfig)) continue
      // Python 端与纯配置包没有 tsc 口径:按各端 package.json 有没有 typecheck 脚本判,不猜
      let hasScript = false
      try {
        hasScript = !!JSON.parse(readFileSync(join(root, rel, 'package.json'), 'utf8')).scripts?.typecheck
      } catch {
        hasScript = false
      }
      if (hasScript) out.push(rel)
    }
  }
  return out.sort()
}

const TS_ERR_RE = /error TS\d+/

/**
 * 把 tsc 输出的相对路径**补成仓内路径**。
 * 归因判据 `attribBuildFailures` 自己只做一件事:`src/…` → `apps/web/src/…`(它的立因场景是
 * 部署环在 `apps\web` 目录下构建)。本工具逐端跑时 cwd 是各自的端目录,直接把 `src/a.ts` 交给它,
 * `packages/shared` 的报错就会被当成 `apps/web/src/a.ts` 去比对 —— 要么落"路径映射失败"的未判定,
 * 更坏的是**恰好撞上 web 里同名文件而行内容巧合一致** ⇒ 发出一张错路口的合格证。
 * 所以路径归一是调用方的义务,不是第二份归因判据:归因三态仍只由那一份实现裁定。
 */
export function rebaseErrorPaths(text, rel) {
  const prefix = `${rel}/`
  return String(text ?? '')
    .split('\n')
    .map((line) => {
      const m = line.match(/^(\s*)((?:[A-Za-z0-9_.\-/\\][^(]*)\((\d+),(\d+)\)):\s*(error|warning)\s+TS\d+/)
      if (!m) return line
      const filePart = m[2].replace(/\\/g, '/')
      // 已经是仓内路径 / 绝对路径 / web 那种已带前缀的 ⇒ 不动(幂等:重复跑不产生 `apps/web/apps/web/…`)
      if (filePart.startsWith(prefix) || /^([A-Za-z]:[\\/]|[./])/.test(filePart) || /^(apps|packages|deploy|scripts|sdks)\//.test(filePart)) {
        return line
      }
      return line.replace(m[2], prefix + filePart)
    })
    .join('\n')
}

/** tsc 可执行入口:用真仓锁定的那份,不依赖 PATH(服务/CI 下 PATH 不通,§5b 同一条纪律)。 */
export function tscEntry(root = ROOT) {
  const p = join(root, 'node_modules/typescript/bin/tsc')
  return existsSync(p) ? p : null
}

/**
 * 归因判据的**取材装配**(不是判据本身 —— `attribBuildFailures` 是纯函数,文档明写"生产装配在
 * 调用方做";本文件与 patrol 主流程各装配各的,判定只那一份)。
 *
 * 为什么不用 `makeBuildAttributionDeps`:2026-10-11 实测它**结构性失明** ——
 * 它调 `catBatch(root, ['HEAD'])` 并把返回的 `Map<rev, 内容>` 当成 `Map<路径, 内容>` 用,
 * 于是 `readHeadLine` 恒为 null,任何报错都落"无法确认"(该文件此刻由他席在飞持有,按 §12 只报不动,
 * 已另计票)。本装配按 `git show HEAD:<path>` 逐路径取,并带**阳性对照**(S17):
 * 取不到就是取不到,但"真的在 HEAD 里的文件必须取到"这条不成立时,整面结论一律作废而不是冒绿。
 */
export function makeHeadFaceDeps({ root = ROOT, git = gitRaw } = {}) {
  const linesCache = new Map()
  let dirtySet = null
  let dirtyError = null
  const readLines = (repoPath) => {
    if (linesCache.has(repoPath)) return linesCache.get(repoPath)
    let val = null
    try {
      val = git(['show', `HEAD:${repoPath}`], root).split(/\r?\n/)
    } catch {
      val = null
    }
    linesCache.set(repoPath, val)
    return val
  }
  const dirty = () => {
    if (dirtySet !== null) return dirtySet
    try {
      // **必须按行切**:git 回的是文本,`[...tracked]` 会把字符串展开成**单个字符**,
      // 于是 `has(全路径)` 恒 false ⇒ 每个报错都被读成"文件与 HEAD 无差"⇒ 把在飞的红洗成已入库的红。
      // 本仓第一次真跑就被镜像测试 T3 的 b 臂抓到这一格(2026-10-11)。
      const tracked = git(['diff', '--name-only', 'HEAD'], root).split(/\r?\n/)
      const untracked = git(['ls-files', '--others', '--exclude-standard'], root).split(/\r?\n/)
      dirtySet = new Set([...tracked, ...untracked].filter(Boolean).map((p) => p.replace(/\\/g, '/')))
    } catch (e) {
      dirtyError = e?.message || 'git 不可问'
      dirtySet = new Set()
    }
    return dirtySet
  }
  return {
    readHeadLine(repoPath, n) {
      const lines = readLines(repoPath)
      if (!lines) return null
      return n >= 1 && n <= lines.length ? lines[n - 1] : null
    },
    isDirty(repoPath) {
      // git 问不到时**不得**当作"不干净"也不当作"干净":交给 readHeadLine 那一侧的 null ⇒ 整条落未判定。
      if (dirtyError) return false
      return dirty().has(repoPath)
    },
    _probe: () => ({ dirtyError, cached: linesCache.size }),
    /** 在飞改动数;git 问不到 ⇒ -1(调用方必须把它读成"不知道",不得读成 0) */
    countDirty: () => (dirtyError ? -1 : dirty().size),
  }
}

/**
 * 把一端的 tsc 输出处置成三态之一。
 * 状态词逐字取自归因判据自己的产出(见 parseAttribution 的耦合锁),本文件不重算归因。
 * 交给判据之前先把相对路径补成仓内路径(见 rebaseErrorPaths)—— 判据的 `src/` 前缀只认 web 那一种构建根。
 */
export function judgeOneEnd({ rel, run, attribution, deps }) {
  if (!run || run.error) return { end: rel, state: 'undetermined', detail: `tsc 派生失败:${run?.error?.message || 'unknown'}`, ms: 0 }
  const text = rebaseErrorPaths(`${run.stdout || ''}\n${run.stderr || ''}`, rel)
  const errs = text.split('\n').filter((l) => TS_ERR_RE.test(l))
  const base = { end: rel, file: `${rel}/tsconfig.json`, errCount: errs.length, ms: run.ms ?? 0 }
  if (run.status !== 0 && errs.length === 0) {
    return { ...base, state: 'undetermined', detail: `tsc 退出码 ${run.status} 但解不出"文件(行,列): error TS"形态 ⇒ 没看清,不读成通过` }
  }
  if (errs.length === 0) return { ...base, state: 'ok', detail: '0 处类型错误' }
  const verdict = attribution(text, deps)
  const state = parseAttribution(verdict)
  return { ...base, state, detail: `${errs.length} 处报错 ⇒ ${state === 'landed' ? '红在已入库代码' : state === 'in-flight' ? '疑似在飞(等其修法入库,禁止代改)' : '无法确认'} —— ${verdict}` }
}

/**
 * 只认归因判据产出的**三个桶标签**(`已入库 N(` / `疑似在飞 N(` / `无法确认 N(`)。
 * 它是耦合锁不是第二份判据:标签漂了本函数返回 undetermined ⇒ 镜像测试立刻红,
 * 而不是悄悄把已入库的红读成没红。优先级刻意是"最坏先认"(同时出现 ⇒ landed)。
 */
export function parseAttribution(verdict) {
  const v = String(verdict ?? '')
  if (/已入库\s+\d+/.test(v)) return 'landed'
  if (/疑似在飞\s+\d+/.test(v)) return 'in-flight'
  if (/无法确认\s+\d+/.test(v)) return 'undetermined'
  return 'undetermined'
}

export function summarize(rows, { budgetMs, spentMs, skipped = [], dirtyCount = 0, requireClean = false } = {}) {
  const c = { ok: 0, landed: 0, 'in-flight': 0, undetermined: 0 }
  for (const r of rows) c[r.state] = (c[r.state] ?? 0) + 1
  const judged = rows.length
  // **脏树告示(2026-10-11 由本工具第一次真跑逼出)**:归因判据按"报错那个文件是否与 HEAD 无差"定 landed,
  // 而它看不见**依赖面** —— 实测 apps/mobile-rn 的 TS2305 落在一个干净文件上,真因却是他席未提交的
  // `packages/app/src/index.ts` 删掉了对应的 `export type`。那一格被读成"已入库代码红"是**误报**。
  // 所以工作树不干净时,landed 只能是"候选",不能是结论;要结论就得在净面复跑(`--require-clean`)。
  const caveat =
    c.landed > 0 && dirtyCount > 0
      ? `⚠️ 共享工作树有 ${dirtyCount} 个在飞改动 ⇒ "已入库红"是**候选**而非结论:报错文件干净不等于它依赖的文件干净(实测误报型:他席删掉 barrel 导出)。要定论用 --require-clean 在净面复跑。`
      : ''
  const rc = c.landed > 0 ? (requireClean && dirtyCount > 0 ? 2 : 1) : judged === 0 && skipped.length > 0 ? 2 : 0
  const head = `判定=${c.landed > 0 ? (requireClean && dirtyCount > 0 ? '已入库红(候选,脏树不可定论)' : '已入库代码红') : c['in-flight'] > 0 ? '疑似在飞(不定论)' : c.ok > 0 && c.undetermined === 0 ? '净' : '未判定'}`
  const line = `${head} | 端 ${judged}(通过 ${c.ok} / 已入库红 ${c.landed} / 疑似在飞 ${c['in-flight']} / 未判定 ${c.undetermined})| 在飞改动 ${dirtyCount} | 耗时 ${(spentMs / 1000).toFixed(1)}s / 预算 ${(budgetMs / 1000).toFixed(0)}s | 未跑到 ${skipped.length}`
  const warn = skipped.length
    ? `⚠️ 有 ${skipped.length} 个端因预算/环境没跑到(${skipped.map((s) => s.end + ':' + s.why).join('; ')})⇒ 上面那句**不是**"全仓干净"`
    : ''
  return { rows, counts: c, rc, line, warn, caveat }
}

/** 主流程:逐端跑,超预算即停并把余下端列为未跑到(不得静默少跑)。 */
export function runPatrolOnce({ root = ROOT, ends = null, timeoutMs = 240000, budgetMs = 600000, requireClean = false, spawn = spawnSync } = {}) {
  const tsc = tscEntry(root)
  const list = ends && ends.length ? ends : discoverEnds(root)
  const deps = makeHeadFaceDeps({ root })
  const attribution = (text) => attribBuildFailures(text, deps)
  const rows = []
  const skipped = []
  const t0 = Date.now()
  const dirtyCount = deps.countDirty()
  if (!tsc) {
    return { ...summarize(rows, { budgetMs, spentMs: 0, skipped: list.map((e) => ({ end: e, why: '找不到仓内 tsc 入口' })), dirtyCount: Math.max(0, dirtyCount), requireClean }), list }
  }
  for (const rel of list) {
    if (Date.now() - t0 > budgetMs) {
      skipped.push({ end: rel, why: '超总预算,未起跑' })
      continue
    }
    const tEnd = Date.now()
    const r = spawn(process.execPath, [tsc, '--noEmit', '-p', join(root, rel, 'tsconfig.json')], {
      cwd: join(root, rel),
      encoding: 'utf8',
      maxBuffer: 1 << 26,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs,
    })
    const endMs = Date.now() - tEnd
    if (r.signal || r.error?.code === 'ETIMEDOUT') {
      skipped.push({ end: rel, why: `单端超时/被终止(signal=${r.signal ?? 'n/a'})` })
      rows.push({ end: rel, state: 'undetermined', detail: '单端未跑完 ⇒ 不读成通过', ms: endMs })
      continue
    }
    rows.push(judgeOneEnd({ rel, run: { ...r, ms: endMs }, attribution, deps }))
  }
  return { ...summarize(rows, { budgetMs, spentMs: Date.now() - t0, skipped, dirtyCount: Math.max(0, dirtyCount), requireClean }), list, dirtyCount }
}

// ── 自检:不派生 tsc,全部走注入(真派生的那一维由镜像测试在临时仓里端到端跑) ──
/**
 * 自检 harness 的唯一实现。
 * §22c/门 150 那条实测教训:cond 写成箭头函数时 `!!cond` 恒真 ⇒ 断言从未求值而账面记绿。
 * 所以这里**主动**把函数形态记红并写明原因,而不是让它悄悄恒绿;S13 钉这一格有牙。
 */
export function makeHarness() {
  const outs = []
  const t = (name, cond) =>
    outs.push([
      typeof cond === 'function' ? `${name} ⇒ cond 是函数,断言从未求值(应写成 (() => {...})())` : name,
      typeof cond === 'function' ? false : cond === true,
    ])
  return { outs, t }
}

export function selfTest() {
  const { outs, t } = makeHarness()
  const fake = (stdout, status = 2, ms = 12) => ({ stdout, stderr: '', status, ms })
  const deps = { readHeadLine: () => null, isDirty: () => false }
  const attributionOf = (kind) => () =>
    kind === 'landed'
      ? ';失败定性(1 条报错,三态不并桶):已入库 1(等别人提交不会自愈,需人工修或找出处提交持有人;apps/x/src/a.ts:3 TS6133(该文件与 HEAD 无差 ⇒ 这就是对已入库代码的红))'
      : kind === 'flight'
        ? ';失败定性(1 条报错,三态不并桶):疑似在飞 1(先等在飞修法入库,禁止代改;apps/x/src/a.ts:3 TS18047(HEAD 同行找不到「y」且该文件工作树有未提交改动 ⇒ 红很可能来自在飞副本))'
        : ';失败定性(1 条报错,三态不并桶):无法确认 1(以第 1 条为例:apps/x/src/a.ts:3 TS2307 —— HEAD 里取不到该文件;要定论需在净面跑一次 typecheck)'

  t('S1 零报错 ⇒ ok 且计数为 0', (() => {
    const r = judgeOneEnd({ rel: 'apps/x', run: fake('nothing here', 0), attribution: attributionOf('landed'), deps })
    return r.state === 'ok' && r.errCount === 0
  })())
  t('S2 有报错且归因说已入库 ⇒ landed', (() => {
    const r = judgeOneEnd({
      rel: 'apps/x',
      run: fake('src/a.ts(3,5): error TS6133: X declared but never used'),
      attribution: attributionOf('landed'),
      deps,
    })
    return r.state === 'landed' && r.errCount === 1
  })())
  t('S3 归因说疑似在飞 ⇒ 不冒充已入库、也不冒充通过', (() => {
    const r = judgeOneEnd({
      rel: 'apps/x',
      run: fake('src/a.ts(3,5): error TS18047: y is possibly null'),
      attribution: attributionOf('flight'),
      deps,
    })
    return r.state === 'in-flight'
  })())
  t('S4 非零退出但解不出报错行 ⇒ 未判定(不得读成通过)', (() => {
    const r = judgeOneEnd({ rel: 'apps/x', run: fake('bash: tsc: command not found', 127), attribution: attributionOf('landed'), deps })
    return r.state === 'undetermined'
  })())
  t('S5 派生失败 ⇒ 未判定并带原因', (() => {
    const r = judgeOneEnd({ rel: 'apps/x', run: { error: new Error('ENOENT') }, attribution: attributionOf('landed'), deps })
    return r.state === 'undetermined' && r.detail.includes('ENOENT')
  })())
  t('S6 未跑到的端必须点名且不得被读成"净"', (() => {
    const s = summarize([{ end: 'apps/a', state: 'ok', detail: '', ms: 1 }], { budgetMs: 1000, spentMs: 10, skipped: [{ end: 'apps/b', why: '超总预算' }] })
    return s.rc === 0 && s.warn.includes('apps/b') && s.line.includes('未跑到 1') && !s.line.includes('| 判定=净 | ')
  })())
  t('S7 一把都没跑到 ⇒ rc=2(失效方向是"报不出",不是"通过")', (() => {
    const s = summarize([], { budgetMs: 1000, spentMs: 0, skipped: [{ end: 'apps/b', why: '缺 tsc' }] })
    return s.rc === 2
  })())
  t('S8 有一端 landed ⇒ rc=1', (() => summarize([{ end: 'a', state: 'landed', detail: '', ms: 1 }], { budgetMs: 1, spentMs: 1 }).rc === 1)())
  t('S9 只有未判定 ⇒ rc=0 但判定词是"未判定"', (() => {
    const s = summarize([{ end: 'a', state: 'undetermined', detail: '', ms: 1 }], { budgetMs: 1, spentMs: 1 })
    return s.rc === 0 && s.line.includes('判定=未判定')
  })())
  t('S10 端清单现读且不含没有 typecheck 的包', (() => {
    const list = discoverEnds()
    return list.length > 3 && list.every((x) => /^(apps|packages)\//.test(x)) && !list.includes('packages/eslint-config')
  })())
  t('S11 归因措辞漂移 ⇒ 读成未判定而不是读成通过', (() => parseAttribution('未来某天改成别的说法') === 'undetermined')())
  t('S13 harness 有牙:把函数当 cond 传进去必须记红(否则一条恒绿断言会替人做出"已看过"的判断)', (() => {
    const probe = makeHarness()
    probe.t('故意喂函数', () => true)
    const [name, ok] = probe.outs[0]
    return ok === false && name.includes('cond 是函数')
  })())
  t('S12 与真归因判据的耦合仍在位:干净文件 + HEAD 取得到 ⇒ 真判据产出本工具认得的 landed', (() => {
    const v = attribBuildFailures('src/a.ts(1,1): error TS2307: Cannot find module \'/x\'', {
      readHeadLine: () => `import { y } from '/x'`,
      isDirty: () => false,
    })
    return parseAttribution(v) === 'landed'
  })())
  t('S14 非 web 端的相对路径必须先补成仓内路径(否则判据的 src/→apps/web/ 映射会把 packages/shared 的报错比到 web 文件上)', (() => {
    const out = rebaseErrorPaths('src/a.ts(3,5): error TS6133: X declared but never used', 'packages/shared')
    return out.startsWith('packages/shared/src/a.ts(3,5)') && !out.includes('apps/web')
  })())
  t('S14b rebase 幂等:已带端前缀 / 绝对路径 / 仓内路径都不得再加前缀', (() => {
    const a = rebaseErrorPaths('apps/web/src/a.ts(1,1): error TS1: x', 'apps/web')
    const b = rebaseErrorPaths('C:\\repo\\src\\a.ts(1,1): error TS1: x', 'apps/web')
    return a === 'apps/web/src/a.ts(1,1): error TS1: x' && b.startsWith('C:')
  })())
  t('S15 走真判据:一端报错文件在 HEAD 且不脏 ⇒ landed(注入 deps,不碰真仓)', (() => {
    const r = judgeOneEnd({
      rel: 'packages/x',
      run: fake('src/a.ts(2,1): error TS2322: Type \'/missing\' is not assignable'),
      attribution: (text, d) => attribBuildFailures(text, d),
      deps: { readHeadLine: (p, n) => (p === 'packages/x/src/a.ts' && n === 2 ? `const t: '/missing' = 1` : null), isDirty: () => false },
    })
    return r.state === 'landed' && r.errCount === 1
  })())
  t('S15b 文件不在 HEAD(别人在飞的新文件)⇒ 未判定,绝不读成已入库的红也不读成通过', (() => {
    const r = judgeOneEnd({
      rel: 'apps/web',
      run: fake('src/a.ts(2,1): error TS2322: Type \'/missing\' is not assignable'),
      attribution: (text, d) => attribBuildFailures(text, d),
      deps: { readHeadLine: () => null, isDirty: () => false },
    })
    return r.state === 'undetermined'
  })())
  t('S16 文件带在飞改动而 HEAD 同行找不到标识符 ⇒ in-flight(不代改、不定论)', (() => {
    const r = judgeOneEnd({
      rel: 'apps/web',
      run: fake('src/a.ts(2,1): error TS2322: Type \'/missing\' is not assignable'),
      attribution: (text, d) => attribBuildFailures(text, d),
      deps: { readHeadLine: () => 'const ok = 1', isDirty: () => true },
    })
    return r.state === 'in-flight'
  })())
  t('S17 装配的阳性对照:HEAD 里真存在的文件必须读得到(读不到=尺子失明,整面结论不得发合格证)', (() => {
    const d = makeHeadFaceDeps({})
    const line = d.readHeadLine('package.json', 1)
    return typeof line === 'string' && line.trim() === '{'
  })())
  t('S17b 装配的阴性对照:HEAD 里没有的路径必须给 null(不许"大概就是它")', (() => {
    const d = makeHeadFaceDeps({})
    return d.readHeadLine('apps/web/__no_such_file_for_sure__.ts', 1) === null
  })())
  t('S18 脏树上的 landed 必须挂候选告示(实测误报型:他席删 barrel 导出,报错文件本身是干净的)', (() => {
    const s = summarize([{ end: 'apps/mobile-rn', state: 'landed', detail: '', ms: 1 }], { budgetMs: 1, spentMs: 1, dirtyCount: 363 })
    return s.caveat.includes('候选') && s.line.includes('在飞改动 363')
  })())
  t('S18b 净面(在飞改动 0)时不得挂候选告示 —— 否则这条告示会因为常亮而失去意义', (() => {
    const s = summarize([{ end: 'a', state: 'landed', detail: '', ms: 1 }], { budgetMs: 1, spentMs: 1, dirtyCount: 0 })
    return s.caveat === '' && s.rc === 1
  })())
  t('S19 --require-clean 且树脏 ⇒ rc=2(不可定论,而不是把候选当结论交出去)', (() => {
    const s = summarize([{ end: 'a', state: 'landed', detail: '', ms: 1 }], { budgetMs: 1, spentMs: 1, dirtyCount: 5, requireClean: true })
    return s.rc === 2 && s.line.includes('候选')
  })())
  return outs
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    const outs = selfTest()
    let fail = 0
    for (const [n, ok] of outs) {
      if (!ok) fail++
      console.log(`${ok ? '✅' : '❌'} ${n}`)
    }
    console.log(`自检:${outs.length - fail}/${outs.length} 通过`)
    process.exit(fail ? 1 : 0)
  }
  const arg = (k, d) => {
    const m = argv.find((a) => a.startsWith(`--${k}=`))
    return m ? m.split('=').slice(1).join('=') : d
  }
  const ends = arg('ends', '') ? arg('ends', '').split(',').map((s) => s.trim()) : null
  const r = runPatrolOnce({
    ends,
    timeoutMs: Number(arg('timeout-ms', 240000)),
    budgetMs: Number(arg('budget-ms', 600000)),
    requireClean: argv.includes('--require-clean'),
  })
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ list: r.list, rows: r.rows, counts: r.counts, warn: r.warn, caveat: r.caveat, dirtyCount: r.dirtyCount }, null, 1))
  } else {
    for (const row of r.rows) console.log(`${row.state === 'ok' ? '✅' : row.state === 'landed' ? '❌' : '⚠️'} ${row.end} · ${(row.ms / 1000).toFixed(1)}s · ${row.detail}`)
    if (r.caveat) console.log(r.caveat)
    if (r.warn) console.log(r.warn)
    console.log(r.line)
  }
  process.exit(r.rc)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  discoverEnds,
  tscEntry,
  makeHeadFaceDeps,
  rebaseErrorPaths,
  judgeOneEnd,
  parseAttribution,
  summarize,
  runPatrolOnce,
  makeHarness,
  selfTest,
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
