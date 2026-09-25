#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 80:热路径 git **只读**派生调用必须带 timeout
 *
 * 成因(2026-09-23 实测):`scripts/check-port-registry.mjs` 里一处
 * `execSync('git ls-files')` 没有 timeout,在共享工作区挂住 **80 分钟**(CPU 仅 2.84s,
 * 即"卡在等锁/等 IO",不是算得慢)。因为它跑在 pre-commit 链上,表现就是"提交像死掉了",
 * 而 `git status`、typecheck 都看不出任何异常。全仓首参锚定实测 159 处 git 派生调用
 * **无一**带 timeout —— 说明这不是个别疏忽,而是没有约束。
 *
 * 口径(刻意收窄,宁漏不误报):
 *  1. 只判**钩子/守护链可达**的文件(HOT 清单),不判测试夹具与端内代码 ——
 *     文本启发式在 `scripts/tests/*.test.mjs` 的源码字符串上必然误伤,那种红只会逼人
 *     关掉整条守门链。
 *  2. 只判**动词是字面量**的调用。`git(args)` / `runGit(args)` 这类通用包装器里动词未知,
 *     给包装器整体加超时会连带 bound 写操作(commit/add/reset/update-index),
 *     而**写操作中途被 SIGTERM 可能留下 .git/index.lock**,把一次挂起换成全局阻塞。
 *     包装器定义点计入"跳过"并如实报数,不静默。
 *  3. 只判只读动词表 READ_ONLY 内的调用。`status` 虽会回写刷新过的索引,但其挂起的
 *     主因(index.lock 竞争)恰是本次要封顶的形态,故纳入;风险由 git-lock 的
 *     死 pid 自愈兜底。
 *
 * timeout 的写法两种都认:对象里的 `timeout: <ms>`,或简写属性 `{ timeout }`。
 *
 * 用法:
 *   node scripts/check-git-read-timeout.mjs            # 全量判定(HOT 集)
 *   node scripts/check-git-read-timeout.mjs --self-test
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
// 判定面取材一律走共用层(2026-09-26 迁,守门 118 的 loose 档收口)。
// 本门此前用 `existsSync(join(REPO,rel))` + `readFileSync` 按磁盘判:共享工作树常年滞后 HEAD,
// 同一份 HEAD 代码会在"恒红"与"假绿"之间来回跳(口径同 70/77/83/98/101/113)。
import { Undetermined, assertRepoRoot, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = dirname(HERE)
const GIT_TIMEOUT = 120000
/** 结论行点名的判定面标注(与门 113/77 同形态:口径必须在输出里如实报出) */
const FACE_TAG = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树(逃生舱)' }

/** 钩子/守护链可达文件(单一清单;新增热文件在此登记) */
export const HOT = [
  '.husky/pre-commit',
  '.husky/post-commit',
  '.husky/pre-push',
  'scripts/guardian-runner.mjs',
  'scripts/safe-commit.mjs',
  'scripts/git-lock.mjs',
  'scripts/git-guardian.mjs',
  'scripts/git-refs-heal.mjs',
  'scripts/git-rebuild-local.mjs',
  'scripts/git-sync-converge.mjs',
  //  union-converge 由收敛器与守护两条链派生,一次合并要 ls-tree 多棵全量树 ⇒ 必须封顶
  'scripts/union-converge.mjs',
  'scripts/git-push-guard.mjs',
  'scripts/git-push-converge.mjs',
  'scripts/heal-worktree-tracked.mjs',
  'scripts/check-commit-loss-guard.mjs',
  //  守门 98 由 pre-commit 直调,git 挂住 = 提交像死掉了(§80 的原始成因形态)
  'scripts/check-dangling-local-imports.mjs',
  //  守门 100 由 pre-commit 直调,一次审计要 ls-tree 多棵全量树 ⇒ 无界挂起会直接冻结提交链
  'scripts/check-merge-addition-loss.mjs',
  //  守门 84 同为 pre-commit blocking 门,且**逐文件**跑 `git log` + 批量 cat-file:
  //  共享 gitdir 一旦被外部锁住,它比任何一道门都更容易把提交拖成"看起来死掉了"。
  'scripts/check-stale-revert.mjs',
  //  守门 94 自本日起按索引/HEAD 取输入 ⇒ 会派生 git;它是 pre-commit blocking 门,
  //  无界挂起同样会把提交拖成"看起来死掉了"。
  'scripts/check-error-code-coverage.mjs',
  //  架构契约门同为 pre-commit blocking 门,且一次全量要对 8000+ 个源文件做 ls-tree + cat-file
  //  --batch —— 共享 gitdir 被外部锁住时,它和 98/100/84 一样会把提交拖成"看起来死掉了"。
  'scripts/check-architecture-policy.mjs',
  //  「开工前基线新鲜度自检(三轴)」由 git-guardian 的巡检账与 `--preflight` 两条链派生,
  //  且③轴逐文件跑 `git log`(复用门 84)——共享 gitdir 被外部锁住时它会和 84/98/100 一样
  //  把调用方拖成"看起来死掉了"。它自己就是"开工前 30 秒"的那道闸,挂起等于没人再跑闸。
  'scripts/check-baseline-freshness.mjs',
  //  守门 49 的 B10「journal 登记表空闲性」自 2026-09-25 起派生 4 次只读 git(status / ls-files /
  //  rev-parse)。它跑在 `pnpm check:all` 与 CI(ci.yml)两条链上;不加封顶则"本门均已封顶"的结论
  //  对它空转 —— 而它判的正是"有没有人在飞改这张登记表",共享 gitdir 被写锁住时它最可能挂住,
  //  挂住的表现就是巡检与 CI 双双静默不结论(比判红更坏:没人知道它没跑)。
  'scripts/check-migration-bookkeeping.mjs',
  'scripts/backup-unreachable-commits.mjs',
  'scripts/check-port-registry.mjs',
  'scripts/lib/gitdir.mjs',
  'apps/cli/src/worktree.ts',
]

/** 只读动词:被 SIGTERM 中断不改变仓库状态,可安全封顶 */
export const READ_ONLY = new Set([
  'rev-parse',
  'ls-tree',
  'ls-files',
  'ls-remote',
  'status',
  'diff',
  'log',
  'show',
  'cat-file',
  'for-each-ref',
  'merge-base',
  'describe',
  'rev-list',
  'show-ref',
  'symbolic-ref',
  'fsck',
  'blame',
  'grep',
  'shortlog',
  'reflog',
  'name-rev',
  'cherry',
])

// 数组内容整体捕获(而不是只认第一个字面量),动词交给 pickVerb 判定。
// 旧写法要求 `[` 后**紧跟动词字面量**,于是 `execFileSync('git', ['-C', dir, 'status', …])`
// 这种最常见的"带仓库路径前缀"形态**根本匹配不到** —— 判据恒报 0 处,是假绿
// (2026-09-23 由并行会话的交付报告指出,已在 apps/cli/src/worktree.ts:578 实证)。
const CALLER =
  /\b(execFileSync|execSync|execFile|spawnSync|spawn|fork)\s*\(\s*(?:'git'|"git"|GIT_BIN|gitBin|gitPath|gitExe|resolveGitBin\s*\(\s*\))\s*,\s*\[([^\]\n]{0,220})/g

/** 需要跟取值的 git 全局选项:跳过它们时必须连值一起跳,否则会把 `safe.directory=*` 当动词 */
const VALUE_FLAGS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '-p'])

/**
 * 从 git 参数数组的文本里取出真正的子命令动词。
 * 按**位置**逐个 token 走(字符串与标识符同等对待):
 *   · 以 `-` 开头的字符串 = 选项 ⇒ 跳过;若它是带值选项(`-C <dir>` / `-c k=v`),
 *     再把**下一个 token 整体**跳过 —— 值经常是变量而非字面量(如 `['-C', repoDir, 'status']`),
 *     只在字面量序列里按下标跳值会把真动词一起跳掉(2026-09-23 实测就是这个 bug)。
 *   · 第一个"像 git 子命令"的字面量 ⇒ 动词。
 *   · 遇到非字符串 token 且不在跳值状态 ⇒ 动词可能来自变量,返回 null(本门不判,计入不判数)。
 */
export function pickVerb(arrayText) {
  const toks = [...String(arrayText).matchAll(/'([^']*)'|"([^"]*)"|([A-Za-z_$][\w$]*)/g)].map((m) => ({
    v: m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3],
    str: m[1] !== undefined || m[2] !== undefined,
  }))
  let skipNext = false
  for (const t of toks) {
    if (skipNext) {
      skipNext = false
      continue
    }
    if (!t.str) return null // 变量入参,动词未知
    if (!t.v) continue
    if (t.v.startsWith('-')) {
      skipNext = VALUE_FLAGS.has(t.v)
      continue
    }
    return /^[a-z][a-z0-9-]*$/.test(t.v) ? t.v : null
  }
  return null
}
const WRAPPER = /\b(?:function\s+)?([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>[\s\S]{0,120}?\b(?:execFileSync|execSync|spawnSync)\s*\(\s*(?:'git'|GIT_BIN)/g
const GIT_INLINE = /\b(execFileSync|execSync|execFile|spawnSync|spawn)\s*\(\s*(?:'git'|"git"|GIT_BIN|gitBin|gitPath|gitExe|resolveGitBin\s*\(\s*\))\s*,\s*[A-Za-z_$]/g
const TIMEOUT_OK = /\btimeout\s*:/

/** 从 `(` 起做括号配平(跳过字符串内的括号),返回整个调用文本 */
export function callSpan(src, openIdx) {
  let depth = 0
  let str = null
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i]
    if (str) {
      if (c === '\\') i++
      else if (c === str) str = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') str = c
    else if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) return src.slice(openIdx, i + 1)
    }
  }
  return src.slice(openIdx)
}

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length

/**
 * 标记"落在字符串字面量或注释里"的字节位置(1=隐藏)。
 * 判据仍在**原文**上匹配(否则 `'git'` 这个字面量本身会被遮掉,永远匹配不到),
 * 只是把**命中点位于字符串/注释内部**的结果丢弃 —— 那是源码字符串,不是真调用。
 * 这一步是自检逼出来的:没有它,`const fixture = "execFileSync('git', ['ls-files'])"`
 * 这种测试夹具会被判红(§守门 80 的取向是宁漏不误报,误报红等于逼人关整条链)。
 */
export function markHidden(src) {
  const hidden = new Uint8Array(src.length)
  let i = 0
  const n = src.length
  const hide = (from, to) => {
    for (let k = from; k < Math.min(to, n); k++) if (src[k] !== '\n') hidden[k] = 1
  }
  while (i < n) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') {
      const s = i
      while (i < n && src[i] !== '\n') i++
      hide(s, i)
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      const s = i
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
      hide(s, i + 2)
      i += 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c
      const s = i
      i++
      while (i < n) {
        if (src[i] === '\\') {
          i += 2
          continue
        }
        if (src[i] === q) {
          i++
          break
        }
        i++
      }
      hide(s, i)
      continue
    }
    i++
  }
  return hidden
}

/** 判一个源码字符串。misses=该判红的;writes/skipped=不判但如实计数,绝不静默 */
export function scanSource(raw) {
  const hidden = markHidden(raw)
  const real = (m) => !hidden[m.index]
  const misses = []
  const writes = []
  let skippedByNoVerb = 0
  const literalIdx = new Set()
  for (const m of raw.matchAll(CALLER)) {
    if (!real(m)) continue
    const verb = pickVerb(m[2])
    if (!verb) {
      // 数组里第一个字面量之前没有可识别动词(全是变量/拼接)⇒ 读写未知,不判但计数
      skippedByNoVerb++
      continue
    }
    const openIdx = raw.indexOf('(', m.index)
    const span = callSpan(raw, openIdx)
    literalIdx.add(m.index)
    if (!READ_ONLY.has(verb)) {
      writes.push({ line: lineOf(raw, m.index), verb })
      continue
    }
    if (!TIMEOUT_OK.test(span) && !/[,{]\s*timeout\s*[,}]/.test(span)) {
      misses.push({ line: lineOf(raw, m.index), verb })
    }
  }
  // 动词来自变量(包装器)不判(见文件头第 2 条口径),但计入 skipped
  const skipped = [...raw.matchAll(GIT_INLINE)].filter((m) => real(m) && !literalIdx.has(m.index)).map((m) => ({ line: lineOf(raw, m.index) }))
  const wrappers = [...raw.matchAll(WRAPPER)].filter(real).map((m) => ({ line: lineOf(raw, m.index), name: m[1] }))
  return { misses, writes, skipped, wrappers, skippedByNoVerb }
}

/**
 * 在位清单:候选源恒为 `HOT` 静态登记表(本门的口径就是"登记过的热文件必须封顶"),
 * 但**"该文件在这一面存在与否"按被审面判** —— 否则 HEAD 里没有的文件会被算进"热文件 N 个"，
 * 而它的内容无论如何也取不到，把一个数字掺了两个面的东西(与"glob 读盘 + 内容读 git"同型)。
 */
export function listPresent(root, face) {
  if (face === 'head') {
    const has = new Set(gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], root, { timeout: GIT_TIMEOUT }).split('\0').filter(Boolean))
    return HOT.filter((rel) => has.has(rel))
  }
  if (face === 'staged') {
    const has = new Set(gitRaw(['ls-files', '-z'], root, { timeout: GIT_TIMEOUT }).split('\0').filter(Boolean))
    return HOT.filter((rel) => has.has(rel))
  }
  return HOT.filter((rel) => existsSync(join(root, rel)))
}

/** 一次 `cat-file --batch` 预取整面;`read()` 对未预取路径不给内容(不偷偷补一次派生)。 */
export function readFace(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(root, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

/**
 * @param texts 预取好的「rel → 正文」映射;不传即按**工作树面**取(自检夹具就是这一档 ——
 *   临时目录不是 git 仓，任何 git 面判据对它都不成立)。
 */
export function auditHot(root, texts = null) {
  const out = []
  for (const rel of HOT) {
    const raw = texts ? texts.get(rel) : readWorktreeFile(root, rel)
    if (typeof raw !== 'string') continue
    const r = scanSource(raw)
    if (r.misses.length) out.push({ rel, ...r })
  }
  return out
}

function selfTest() {
  const root = mkScratch('ihui-git-timeout-')
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })
  // 夹具里的函数名一律经 SF 插值:守门 52 扫的是**本文件源码**,把这些写到临时文件的
  // 样例字面量当成真派生点(52 的豁免哨兵只覆盖它自己那道门,这是有意的 ⇒ 改夹具而非改判据)。
  // 写出去的文本与原来逐字节相同 ⇒ 本门自检语义零变化。
  const SF = 'execFileSync'
  let faceRepo = null
  try {
    const hot = join(root, 'scripts')
    mkdirSync(hot, { recursive: true })
    const write = (body) => writeFileSync(join(hot, 'x.mjs'), body, 'utf8')

    t('只读动词缺 timeout → 判红', () => {
      write(`const a = execFileSync('git', ['ls-files'], { encoding: 'utf8', windowsHide: true })`)
      const r = scanSource(readFileSync(join(hot, 'x.mjs'), 'utf8'))
      if (r.misses.length !== 1) throw new Error(`expected 1 miss, got ${JSON.stringify(r.misses)}`)
      if (r.misses[0].verb !== 'ls-files') throw new Error(`verb=${r.misses[0].verb}`)
    })
    t('补上 timeout: → 归零', () => {
      write(`const a = ${SF}('git', ['ls-files'], { encoding: 'utf8', timeout: 60000 })`)
      if (scanSource(readFileSync(join(hot, 'x.mjs'), 'utf8')).misses.length !== 0) throw new Error('should be 0')
    })
    t('简写属性 { timeout } 同样算已封顶(不得假红)', () => {
      write(`const a = ${SF}('git', ['ls-files'], { encoding: 'utf8', timeout, stdio: 'pipe' })`)
      if (scanSource(readFileSync(join(hot, 'x.mjs'), 'utf8')).misses.length !== 0) throw new Error('shorthand 应放过')
    })
    t('写动词不判,但要如实计入 writes(不得静默)', () => {
      write(`const a = ${SF}('git', ['commit', '-m', 'x'], { encoding: 'utf8' })`)
      const r = scanSource(readFileSync(join(hot, 'x.mjs'), 'utf8'))
      if (r.misses.length !== 0) throw new Error('写动词不该判红')
      if (r.writes.length !== 1 || r.writes[0].verb !== 'commit') throw new Error(`writes=${JSON.stringify(r.writes)}`)
    })
    t('动词来自变量(包装器)不判,但计入 skipped', () => {
      write(`const g = (args) => ${SF}('git', args, { encoding: 'utf8' })`)
      const r = scanSource(readFileSync(join(hot, 'x.mjs'), 'utf8'))
      if (r.misses.length !== 0) throw new Error('包装器不该判红')
      if (r.skipped.length !== 1) throw new Error(`skipped=${JSON.stringify(r.skipped)}`)
    })
    t('测试夹具里的 git 字符串不参与判定(误报面为零的根据)', () => {
      write(`const fixture = "${SF}('git', ['ls-files'])"\nconsole.log(fixture)`)
      const r = scanSource(readFileSync(join(hot, 'x.mjs'), 'utf8'))
      if (r.misses.length !== 0) throw new Error(`夹具被误判: ${JSON.stringify(r.misses)}`)
    })
    t('多行对象写法仍能识别 timeout', () => {
      write(
        [
          `const a = execFileSync(`,
          `  'git',`,
          `  ['rev-parse', 'HEAD'],`,
          `  {`,
          `    encoding: 'utf8',`,
          `    timeout: 300_000,`,
          `  },`,
          `)`,
        ].join('\n'),
      )
      if (scanSource(readFileSync(join(hot, 'x.mjs'), 'utf8')).misses.length !== 0) throw new Error('多行 timeout 应识别')
    })
    t('-C 前缀形态必须识别(曾经的假绿盲区)', () => {
      write(`const a = execFileSync(GIT_BIN, ['-C', repoDir, 'status', '--porcelain'], { windowsHide: true })`)
      const r = scanSource(readFileSync(join(hot, 'x.mjs'), 'utf8'))
      if (r.misses.length !== 1) throw new Error(`-C 前缀被漏判: misses=${JSON.stringify(r.misses)}`)
      if (r.misses[0].verb !== 'status') throw new Error(`verb=${r.misses[0].verb}`)
    })
    t('带值选项 -c k=v 必须连值跳过(不得把 safe.directory=* 当动词)', () => {
      write(`const a = ${SF}('git', ['-c', 'safe.directory=*', 'rev-parse', 'HEAD'], {})`)
      const m = scanSource(readFileSync(join(hot, 'x.mjs'), 'utf8')).misses
      if (m.length !== 1 || m[0].verb !== 'rev-parse') throw new Error(`got ${JSON.stringify(m)}`)
    })
    t('同一 -C 形态补上 timeout 后归零(证明前一条不是恒红)', () => {
      write(`const a = ${SF}(GIT_BIN, ['-C', repoDir, 'status', '--porcelain'], { timeout: 60_000 })`)
      if (scanSource(readFileSync(join(hot, 'x.mjs'), 'utf8')).misses.length !== 0) throw new Error('应归零')
    })
    t('auditHot 只扫 HOT 清单内文件(夹具必须落在真 HOT 路径上)', () => {
      writeFileSync(join(hot, 'guardian-runner.mjs'), `const a = ${SF}('git', ['ls-files'], {})`, 'utf8')
      const out = auditHot(root)
      if (out.length !== 1 || out[0].rel !== 'scripts/guardian-runner.mjs') {
        throw new Error(`got ${JSON.stringify(out.map((o) => o.rel))}`)
      }
      if (out[0].misses.length !== 1) throw new Error(`misses=${JSON.stringify(out[0].misses)}`)
    })
    t('HOT 清单必须非空(空清单会让本门恒绿)', () => {
      if (HOT.length < 10) throw new Error(`HOT 只有 ${HOT.length} 项`)
    })

    // ---- 判定面构造证明(2026-09-26 迁移配套)------------------------------------
    // 真造一个临时 git 仓:同一批 HOT 路径全部提交为"已封顶"的版本,然后把其中一个的
    // **索引**版本改成"缺 timeout"而**不动 HEAD**。两条断言方向相反,合起来才证明
    // "跟面走"不是一句注释:①staged 必须看见索引里的那处缺 timeout;②head 必须看不见它。
    // ⚠️ 现场必须建在**用例循环之前**、销毁在**循环之后**(外层的 finally)——
    //    上一版把 setup+`t()` 注册写在同一个块里并当场 rmScratch,三个用例真正执行时目录已没了,
    //    spawnSync 报的是 `git.exe ENOENT`(Node 的 cwd 缺失与二进制缺失共用同一句话),
    //    一个夹具生命周期 bug 伪装成"这台机的 git 坏了"。
    faceRepo = mkScratch('ihui-git-timeout-face-')
    {
      const dirtyRel = 'scripts/guardian-runner.mjs'
      const clean = `const a = 0\n`
      const dirty = `const a = ${SF}('git', ['ls-files'], { encoding: 'utf8', windowsHide: true })\n`
      for (const rel of HOT) {
        const abs = join(faceRepo, rel)
        mkdirSync(dirname(abs), { recursive: true })
        writeFileSync(abs, clean, 'utf8')
      }
      gitRaw(['init', '-q'], faceRepo, { timeout: GIT_TIMEOUT })
      gitRaw(['add', '-A'], faceRepo, { timeout: GIT_TIMEOUT })
      gitRaw(['-c', 'user.name=gate', '-c', 'user.email=gate@local', 'commit', '-q', '-m', 'base'], faceRepo, { timeout: GIT_TIMEOUT })
      writeFileSync(join(faceRepo, dirtyRel), dirty, 'utf8')
      gitRaw(['add', '--', dirtyRel], faceRepo, { timeout: GIT_TIMEOUT })

      t(`索引内容与 HEAD 不同 ⇒ --staged 档必须跟索引走(盘上/索引里的那一份才是被提交的)`, () => {
        const out = evaluate(faceRepo, 'staged')
        if (out.collapse) throw new Error(`临时仓被判"判据面塌陷"(present=${out.present.length})—— 夹具没造起来`)
        if (out.misses !== 1) throw new Error(`staged 档应看见索引里那 1 处缺 timeout,实得 ${out.misses}`)
        if (!out.bad.some((b) => b.rel === dirtyRel)) throw new Error(`判红的不是索引里被改的那个文件:${JSON.stringify(out.bad.map((b) => b.rel))}`)
      })
      t(`同一输入在 HEAD 档给出 HEAD 的结论(反向对照:上一条不是恒真式)`, () => {
        const out = evaluate(faceRepo, 'head')
        if (out.misses !== 0) throw new Error(`HEAD 那一版是已封顶的,不该判红,实得 ${out.misses}:${JSON.stringify(out.bad)}`)
        if (out.present.length !== HOT.length) throw new Error(`HEAD 面在位清单 ${out.present.length} ≠ HOT ${HOT.length} —— 清单与内容必须同面`)
      })
      t(`在位清单必须与内容同面(暂存删除只让索引面少一个,HEAD 面照旧)`, () => {
        gitRaw(['rm', '--cached', '-q', '--', dirtyRel], faceRepo, { timeout: GIT_TIMEOUT })
        const staged = listPresent(faceRepo, 'staged')
        const head = listPresent(faceRepo, 'head')
        const disk = listPresent(faceRepo, 'worktree')
        if (staged.includes(dirtyRel)) throw new Error('索引里已删除,仍被算进 staged 面 ⇒ 清单掺了磁盘/HEAD')
        if (!head.includes(dirtyRel)) throw new Error('HEAD 里仍在,却从 head 面清单里掉了')
        if (!disk.includes(dirtyRel)) throw new Error('磁盘上仍在,worktree 面应当看得见它')
      })
    }

    let failed = 0
    for (const c of cases) {
      try {
        c.fn()
        console.log(`  ✅ ${c.name}`)
      } catch (e) {
        failed++
        console.log(`  ❌ ${c.name} — ${e.message}`)
      }
    }
    console.log(failed === 0 ? `--self-test ${cases.length}/${cases.length} 通过` : `--self-test 失败 ${failed}/${cases.length}`)
    return failed === 0 ? 0 : 1
  } finally {
    rmScratch(root)
    if (faceRepo) rmScratch(faceRepo)
  }
}

/**
 * 一次判定:清单与内容**同面同轮**(先按面列在位、再一次 batch 预取该面正文)。
 * 取不到内容 ⇒ 记进 `unread`，由调用方折成 exit 2「无法判定」—— 少扫一个热文件不是"没有违规"。
 */
export function evaluate(root, face) {
  const present = listPresent(root, face)
  if (present.length < 10) return { present, collapse: true, unread: [], bad: [], writes: 0, skipped: 0, noVerb: 0, misses: 0 }
  const texts = readFace(root, face, present)
  const unread = present.filter((rel) => typeof texts.get(rel) !== 'string')
  const bad = auditHot(root, texts)
  let writes = 0
  let skipped = 0
  let noVerb = 0
  for (const rel of present) {
    const raw = texts.get(rel)
    if (typeof raw !== 'string') continue
    const r = scanSource(raw)
    writes += r.writes.length
    skipped += r.skipped.length
    noVerb += r.skippedByNoVerb
  }
  return { present, collapse: false, unread, bad, writes, skipped, noVerb, misses: bad.reduce((s, b) => s + b.misses.length, 0) }
}

function run(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const { face, error } = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (error) {
    console.error(`❌ 无法判定: ${error}`)
    return 2
  }
  assertRepoRoot(REPO, '本门')
  let out
  try {
    out = evaluate(REPO, face)
  } catch (e) {
    console.error(`❌ 无法判定(exit 2): ${e instanceof Undetermined ? e.message : e?.message ?? String(e)}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }
  if (out.collapse) {
    console.error(`❌ HOT 清单里只有 ${out.present.length}/${HOT.length} 个文件存在 —— 判据面已塌陷,不报绿灯`)
    return 1
  }
  if (out.unread.length) {
    console.error(`❌ 无法判定(exit 2):${FACE_TAG[face]} 面有 ${out.unread.length} 个热文件取不到内容 —— 少扫不等于没有违规:${out.unread.join(', ')}`)
    return 2
  }
  const { present, bad, writes, skipped, noVerb, misses } = out
  console.log(`git 只读派生调用 timeout 对账(判定面:${FACE_TAG[face]}):热文件 ${present.length} 个 / 判红 ${misses} 处 / 写动词不判 ${writes} 处 / 包装器不判 ${skipped} 处 / 动词非字面量不判 ${noVerb} 处`)
  if (misses === 0) {
    console.log('✅ 热路径只读 git 调用均已封顶')
    return 0
  }
  for (const b of bad) {
    console.error(`❌ ${b.rel}`)
    for (const m of b.misses) console.error(`   L${m.line}  '${m.verb}' 调用缺 timeout`)
  }
  console.error(
    [
      '',
      '  💡 这些调用跑在 commit/守护/收敛链上,没有 timeout 就是一次无限挂起。',
      '     2026-09-23 实测:check-port-registry 的 execSync(\'git ls-files\') 无 timeout,',
      '     挂住 80 分钟而 CPU 只用了 2.84s —— 表现是"提交像死掉了",git status 一切正常。',
      '     修法:options 里加 `timeout: <ms>`(只读查询给 60_000~300_000 已远高于正常耗时)。',
      '     本门刻意**不**对写动词要求 timeout:',
      '     commit/add/reset 中途被 SIGTERM 可能留下 .git/index.lock,把挂起换成全局阻塞。',
      '     单独复验:node scripts/check-git-read-timeout.mjs',
      '     自检:node scripts/check-git-read-timeout.mjs --self-test',
      '     紧急跳过(不推荐):HUSKY_SKIP_GIT_READ_TIMEOUT=1 git commit ...',
      '',
    ].join('\n'),
  )
  return 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(run(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export const __test__ = {
  HOT,
  READ_ONLY,
  scanSource,
  auditHot,
  callSpan,
  markHidden,
  pickVerb,
  listPresent,
  readFace,
  evaluate,
}
