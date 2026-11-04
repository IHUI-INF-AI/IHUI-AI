#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * isolated-git.mjs — 单次提交 = 一份私有 GIT_INDEX_FILE,退出即清理(AGENTS §12i)。
 *
 * ## 治什么
 *
 * 多会话共用同一工作树时,`.git/index` 是唯一一份共享暂存区:`safe-commit.mjs` 的
 * Step 1 `git reset HEAD` 会清掉别人刚 staged 的路径;`git commit --only` 期间父 git
 * 持 `.git/index.lock`,而 lint-staged 的 `git add` / `git restore --worktree` 要写
 * 真实索引 ⇒ exit 128 互堵(本仓反复实测)。
 *
 * 本脚本把 `GIT_INDEX_FILE` 指到**本次进程独占**的索引:read-tree HEAD → add 声明集 →
 * commit。共享 `.git/index` 从头到尾不被读成写面,`index.lock` 也不再是跨会话争用的锁。
 *
 * ## 落点与清理
 *
 * 索引落 `<gitdir>/ihui-isolated-index/<pid>-<ms>-<rand>.idx` —— git 元数据目录内,
 * 不写 `$env:TEMP`(本机 TEMP 解析到 D:\DevEnv\Temp,那是生产盘),不进工作树。
 * 正常/报错/捕获信号都在 `finally` 与 `exit` 钩子里删除 `<idx>` 与 `<idx>.lock`;
 * 硬杀(taskkill / 断电)来不及跑钩子,残留由**下次启动的 sweep**按「宿主 pid 已死」清掉。
 * sweep 只认本目录下自己命名的文件,**永不触碰任何 `index.lock`**。
 *
 * ## 不改变提交语义
 *
 * - 仍由 git 原生 `git commit` 落地,pre-commit / commit-msg / post-commit 全部照常执行;
 * - `IHUI_GATE_FAST` 等既有开关一字未动;拒绝 `--no-verify` / `-n` / `HUSKY=0`;
 * - 只提交 `--` 之后声明的路径:索引以 HEAD 为基,`git diff --cached` 里出现声明集之外的
 *   条目即中止(不把别席的在飞件交出去)。
 * - **共享索引不与之争写**:提交时不读不写共享 `.git/index`;提交成功后,仅当它「提交前
 *   本来就干净 + 全程字节哈希未变 + `.git/index.lock` 拿得到」时,才用锁文件 CAS 把它推进
 *   到新 HEAD。这个条件在多会话下基本不成立(别人总有 staged),所以再补一条**路径级**推进
 *   (`advanceSharedIndexPaths`):持同一把锁、以共享索引现读字节为基,只把**本次声明路径**
 *   写成新提交树里的条目 —— 别人的 staged 一个字节不改,同时不给下一条提交留 MM/AD 反向暂存。
 *   连锁都拿不到就原样不动,留给 `safe-commit`(§12 Step 1)自愈。
 *
 * 用法:
 *   node scripts/isolated-git.mjs commit -m "<提交标题>" -- <路径...>
 *   node scripts/isolated-git.mjs -C <仓库目录> commit -m "<标题>" -- <路径...>
 *   node scripts/isolated-git.mjs --help
 *
 * 退出码: 0 成功 / 1 git 拒绝或事后核验失败 / 2 脚本自身异常或用法错误。
 */

import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gitBinary } from './lib/face-reader.mjs'
import derivedArtifacts from './lib/derived-artifacts.js'

/** 仓根由脚本自身位置推导,禁 `process.cwd()` 定根(AGENTS §15)。 */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const INDEX_DIR_NAME = 'ihui-isolated-index'
/** 内容快照后缀:与索引同名前缀,随 `disposeIndex`/sweep 一起清掉。 */
export const SNAPSHOT_SUFFIX = '.snap'
/** 派生腿产物申报文件后缀(2026-11-04 立,见 scripts/lib/derived-artifacts.js)。 */
export const DERIVED_SUFFIX = '.derived.json'
export const MAX_ATTEMPTS = 5
/** 残留判定:pid 已死,或存活但文件超过 24h(防 pid 复用把旧文件永久留下)。 */
export const STALE_AGE_MS = 24 * 60 * 60 * 1000
const INDEX_NAME_RE = /^(\d+)-(\d+)-([0-9a-f]{8})\.idx(\.lock|\.snap|\.derived\.json)?$/
const LOCK_BUSY_RE = /cannot lock ref|Unable to create|index\.lock|Another git process/i
const FORBIDDEN_COMMIT_ARGS = [
  '--no-verify',
  '-n',
  '--only',
  '-o',
  '--include',
  '-i',
  '--amend',
  '--all',
  '-a',
]

const ACTIVE_INDEXES = new Set()

/** 所有 git 子进程显式接管 stdio(AGENTS §12g:不写稳定 EBUSY)。 */
function rawGit(args, { gitCwd, env, allowFail = false } = {}) {
  const res = spawnSync(gitBinary(), args, {
    cwd: gitCwd,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  if (res.error) throw res.error
  if (!allowFail && res.status !== 0) {
    const detail = String(res.stderr || res.stdout || '').trim()
    throw new Error(`git ${args.join(' ')} 失败(exit ${res.status}): ${detail}`)
  }
  return res
}

function gitOut(args, ctx) {
  return String(rawGit(args, ctx).stdout || '').trim()
}

/** 子进程 env:剥掉 IDE 注入的 GIT_DIR/GIT_WORK_TREE(判据同 scripts/lib/hook-git-env.js)。 */
export function childEnv(indexFile, baseEnv = process.env) {
  const env = { ...baseEnv, GIT_INDEX_FILE: indexFile }
  delete env.GIT_DIR
  delete env.GIT_WORK_TREE
  delete env.GIT_OBJECT_DIRECTORY
  delete env.GIT_ALTERNATE_OBJECT_DIRECTORIES
  delete env.GIT_QUARANTINE_PATH
  return env
}

/** 操作"共享索引"时把 GIT_INDEX_FILE 也剥掉,确保读/写的是仓库默认索引。 */
export function cleanGitEnv(baseEnv = process.env) {
  const env = childEnv('', baseEnv)
  delete env.GIT_INDEX_FILE
  return env
}

export function gitDirOf(gitCwd, env = childEnv('')) {
  return gitOut(['rev-parse', '--absolute-git-dir'], { gitCwd, env })
}

/** 唯一命名源:`<pid>-<ms>-<8 hex>.idx`,sweep 只按同一正则识别。 */
export function indexPathFor(
  gitDir,
  { pid = process.pid, now = Date.now(), rand = randomBytes(4).toString('hex') } = {},
) {
  return join(gitDir, INDEX_DIR_NAME, `${pid}-${now}-${rand}.idx`)
}

export function isPidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e?.code === 'EPERM'
  }
}

/**
 * 清理本目录下「宿主已死 / 超龄」的私有索引。只认 INDEX_NAME_RE,
 * 目录里不可能有共享 `.git/index`(它在上一级),`index.lock` 也不会被本函数看到。
 */
export function sweepStale(indexDir, { isAlive = isPidAlive, now = Date.now() } = {}) {
  const removed = []
  let names = []
  try {
    names = readdirSync(indexDir)
  } catch {
    return removed
  }
  for (const name of names) {
    const m = INDEX_NAME_RE.exec(name)
    if (!m) continue
    const pid = Number(m[1])
    const mtimeMs = Number(m[2])
    if (isAlive(pid) && now - mtimeMs < STALE_AGE_MS) continue
    try {
      rmSync(join(indexDir, name), { force: true })
      removed.push(name)
    } catch {
      /* 别人正删/权限抖动:下次再来,绝不升级成阻断 */
    }
  }
  return removed
}

/** 删掉本进程的索引、它自己的 `.lock`/内容快照/派生申报;目录空了就顺手收掉(不递归、不碰别的东西)。 */
export function disposeIndex(indexFile) {
  ACTIVE_INDEXES.delete(indexFile)
  for (const f of [
    indexFile,
    `${indexFile}.lock`,
    `${indexFile}${SNAPSHOT_SUFFIX}`,
    `${indexFile}${DERIVED_SUFFIX}`,
  ]) {
    try {
      rmSync(f, { force: true })
    } catch {
      /* 清理失败不覆盖原结论 */
    }
  }
  try {
    rmdirSync(dirname(indexFile))
  } catch {
    /* 目录非空 = 别的进程正在用,保留 */
  }
}

/** 解析前导 `-C <dir>`(与 git 同义),其余参数原样返回。 */
export function parseLeadingC(argv, defaultCwd = ROOT) {
  const args = [...argv]
  let gitCwd = defaultCwd
  while (args[0] === '-C' && args.length >= 2) {
    gitCwd = resolve(gitCwd, args[1])
    args.splice(0, 2)
  }
  return { gitCwd, args }
}

/**
 * 拆 `commit [opts] -- <paths>`:路径必须显式声明,且禁止一切"少跑门"的开关。
 * 返回的 commitOpts 不含 pathspec —— 路径由本脚本先灌进私有索引。
 */
export function splitCommitArgs(args) {
  const sep = args.indexOf('--')
  if (sep < 0) throw new Error('必须用 `-- <路径...>` 声明本次提交的路径(只交声明集)')
  const commitOpts = args.slice(0, sep)
  const paths = args
    .slice(sep + 1)
    .map((s) => String(s).trim())
    .filter(Boolean)
  if (!paths.length) throw new Error('`--` 之后至少要有一个路径')
  for (const a of commitOpts) {
    if (FORBIDDEN_COMMIT_ARGS.includes(a) || String(a).startsWith('--no-verify')) {
      throw new Error(`禁止参数 ${a}:本通道只走原生 git commit,不得绕过或改变门的语义`)
    }
  }
  const hasMessage = commitOpts.some(
    (a) => ['-m', '--message', '-F', '--file'].includes(a) || String(a).startsWith('--message='),
  )
  if (!hasMessage)
    throw new Error('必须显式给 `-m/--message`(禁交互式编辑器,共享工作区下开编辑器会卡住全会话)')
  return { commitOpts, paths }
}

/** 拒绝一切"关钩子"的环境;已有可用 GIT_INDEX_FILE 时也拒绝(避免嵌套两层隔离)。 */
export function assertNoBypass(env = process.env) {
  if (String(env.HUSKY || '') === '0')
    throw new Error('拒绝执行:HUSKY=0 会关掉全部钩子,本通道不允许绕门')
  const pointer = env.GIT_INDEX_FILE
  if (pointer && existsSync(pointer)) {
    throw new Error(
      `拒绝执行:已在另一份隔离索引内(GIT_INDEX_FILE=${pointer});嵌套隔离只会让清理归谁变得含糊`,
    )
  }
}

/** 声明路径 → git 输出面的相对路径(统一 `/`)。 */
export function normalizePath(gitCwd, p) {
  return relative(gitCwd, resolve(gitCwd, p)).split(sep).join('/')
}

function isLockBusy(text) {
  return LOCK_BUSY_RE.test(String(text || ''))
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** `git ls-files -s -z` 的逐条解析:`<mode> <blob> <stage>\t<path>\0`。 */
export function parseLsFilesZ(text) {
  const out = []
  for (const rec of String(text ?? '').split('\u0000')) {
    if (!rec) continue
    const tab = rec.indexOf('\t')
    if (tab < 0) continue
    const meta = rec.slice(0, tab).trim().split(/\s+/)
    if (meta.length < 3) continue
    out.push({ mode: meta[0], blob: meta[1], stage: Number(meta[2]), path: rec.slice(tab + 1) })
  }
  return out
}

function lsEntries(ctx, paths) {
  // 空路径集必须直接返回空,不能落成 `git ls-files -s -z --`:git 的空 pathspec 会列举
  // **整个索引**。本仓索引 18,972 条 / 1,872,503 字节,spawnSync 默认 maxBuffer 1MiB
  // 触发 ENOBUFS,于是"没有派生产物要核验"的每次提交都在派生命中/复原臂被误判失败
  // (2026-11-04 实测)。空集语义 = 没有需要核验的条目,不是核验整个索引。
  if (!paths.length) return []
  return parseLsFilesZ(
    String(
      rawGit(['-c', 'core.quotepath=false', 'ls-files', '-s', '-z', '--', ...paths], ctx).stdout ??
        '',
    ),
  )
}

/**
 * 内容快照:声明路径在**钩子运行前**的索引条目(mode + blob + stage)。
 * 路径集合校验(`diff --cached --name-only`)看不见"同路径内容被整份替换",
 * 所以这里把每条声明路径的 blob 号钉住,由 `restore-index` 在钩子跑完后逐条比对。
 */
export function takeIndexSnapshot({ gitCwd, env, paths }) {
  const ctx = { gitCwd, env }
  const declared = [...new Set(paths.map((p) => normalizePath(gitCwd, p)))]
  return { version: 1, paths: declared, entries: lsEntries(ctx, declared) }
}

function entriesDiffer(expected, actual) {
  return (
    !actual ||
    !expected ||
    expected.mode !== actual.mode ||
    expected.blob !== actual.blob ||
    expected.stage !== actual.stage
  )
}

function nameOnlyZ(ctx) {
  const text = String(
    rawGit(['-c', 'core.quotepath=false', 'diff', '--cached', '--name-only', '-z'], ctx).stdout ??
      '',
  )
  return text.split('\u0000').filter(Boolean)
}

/**
 * 钩子跑完后的内容级护栏(由 pre-commit 钩子在 exit 阶段调起,见
 * `scripts/lib/pre-commit-hook.js` 的 `IHUI_ISOLATED_INDEX_SNAPSHOT` 段):
 *
 *   ① 声明集 ∪ **派生申报集**之外出现任何条目 ⇒ 记入 `extras`(调用方据此拒绝提交,
 *      不替钩子"擦屁股");申报只放行**逐条列名且带 blob 内容钉**的产物,不是"什么都放行";
 *   ② 申报的产物必须真的在索引里、且 blob/mode 与申报一致 ⇒ 否则记入 `derivedViolations`;
 *   ③ 声明路径的 (mode, blob, stage) 与快照不等 ⇒ 用 `git update-index --cacheinfo`
 *      逐条精确复原(不 `checkout`/`reset`/`restore`,一个字节都不碰工作树);
 *   ④ 复原后再读一次索引复核,仍不等 ⇒ 记入 `still`,调用方 exit 非 0。
 *
 * 正常情况(钩子没动内容)零写入:不满足 ③ 时一条 `update-index` 都不发。
 */
export function restoreIndexFromSnapshot({ gitCwd, env, snapshot, derived = [], log = console }) {
  const ctx = { gitCwd, env }
  const declared = new Set(snapshot.paths)
  // 作者已声明的路径以快照为准(复原语义优先),派生申报只补声明集之外的产物。
  const derivedEntries = derived.filter((d) => d && d.path && !declared.has(d.path))
  const allowed = new Set([...declared, ...derivedEntries.map((d) => d.path)])
  const expected = new Map(snapshot.entries.map((e) => [e.path, e]))
  const extras = nameOnlyZ(ctx).filter((p) => !allowed.has(p))

  const before = new Map(lsEntries(ctx, snapshot.paths).map((e) => [e.path, e]))
  const drift = []
  for (const [p, exp] of expected) {
    const cur = before.get(p)
    if (entriesDiffer(exp, cur)) drift.push({ path: p, expected: exp, actual: cur ?? null })
  }
  for (const [p, cur] of before) {
    if (!expected.has(p)) drift.push({ path: p, expected: null, actual: cur })
  }

  if (drift.length) {
    log.error?.('⚠️ 私有索引内容护栏:钩子改动了声明路径的索引内容,按快照逐条复原(工作树未动):')
    for (const d of drift) {
      log.error?.(
        `  ${d.path}: 快照 ${d.expected?.blob ?? '(无条目)'} → 钩子后 ${d.actual?.blob ?? '(无条目)'}`,
      )
      if (d.expected) {
        rawGit(
          [
            'update-index',
            '--add',
            '--cacheinfo',
            `${d.expected.mode},${d.expected.blob},${d.path}`,
          ],
          ctx,
        )
      } else {
        rawGit(['update-index', '--force-remove', '--', d.path], ctx)
      }
    }
  }

  // 复核:复原后必须与快照逐条相等;不等就交给调用方拒绝提交。
  const after = new Map(lsEntries(ctx, snapshot.paths).map((e) => [e.path, e]))
  const still = []
  for (const [p, exp] of expected) {
    const cur = after.get(p)
    if (entriesDiffer(exp, cur)) still.push({ path: p, expected: exp, actual: cur ?? null })
  }
  for (const [p, cur] of after) {
    if (!expected.has(p)) still.push({ path: p, expected: null, actual: cur })
  }
  const extrasAfter = nameOnlyZ(ctx).filter((p) => !allowed.has(p))

  // 申报产物的内容钉核验:索引里必须真有这一条,且 mode/stage/blob 与申报一致。
  const afterDerived = new Map(
    lsEntries(
      ctx,
      derivedEntries.map((d) => d.path),
    ).map((e) => [e.path, e]),
  )
  const derivedViolations = []
  for (const d of derivedEntries) {
    const cur = afterDerived.get(d.path)
    if (!cur) {
      derivedViolations.push(`${d.path}:申报了但索引里没有该条目`)
      continue
    }
    if (cur.stage !== 0) {
      derivedViolations.push(`${d.path}:索引 stage=${cur.stage}(非 0)`)
      continue
    }
    if (!/^100(644|755)$/.test(cur.mode)) {
      derivedViolations.push(`${d.path}:索引 mode=${cur.mode}(非普通文件)`)
      continue
    }
    if (!d.blob || cur.blob !== d.blob) {
      derivedViolations.push(`${d.path}:索引 blob ${cur.blob} ≠ 申报 blob ${d.blob ?? '(缺失)'}`)
    }
  }

  return {
    restored: drift.length,
    extras: [...new Set([...extras, ...extrasAfter])],
    still,
    derivedViolations,
  }
}

/**
 * 核心提交:每一轮都「重新 read-tree 当时 HEAD → add 声明集 → 查无外来件 → 发令」。
 * 这样即便别的会话在上一轮把 HEAD 推前了,也不会拿旧索引去建一枚把别人改动退回去的提交
 * (2026-09-26 bf286534bd 同型事故;native `--only` 也有同一个理论窗口,这里事后还核验一次)。
 */
export function commitWithIndex({ gitCwd, env, gitDir, commitOpts, paths, log = console }) {
  const ctx = { gitCwd, env }
  const indexFile = env.GIT_INDEX_FILE
  const declared = new Set(paths.map((p) => normalizePath(gitCwd, p)))
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const base = gitOut(['rev-parse', 'HEAD'], ctx)
    rawGit(['read-tree', 'HEAD'], ctx)
    rawGit(['add', '--', ...paths], ctx)
    const staged = gitOut(['-c', 'core.quotepath=false', 'diff', '--cached', '--name-only'], ctx)
      .split(/\r?\n/)
      .filter(Boolean)
    const extra = staged.filter((p) => !declared.has(p))
    if (extra.length) {
      throw new Error(
        `私有索引里出现声明集之外的条目,中止提交(这些会被误提交/误回退):\n  ${extra.join('\n  ')}`,
      )
    }
    if (gitOut(['rev-parse', 'HEAD'], ctx) !== base) {
      log.warn?.(`⟳ 第 ${attempt} 轮:HEAD 在灌索引期间被并发推进,重新基于新 HEAD 再来`)
      continue
    }
    // 内容级护栏的"钩子前"一侧:把声明路径的索引 blob 记成快照,并把路径交给 pre-commit
    // 钩子(它退出前调 restore-index 逐条比对+复原)。没有这份快照,路径集合校验对
    // "同路径内容整份替换"完全无感。
    const snapshot = takeIndexSnapshot({ gitCwd, env, paths })
    const snapshotFile = `${indexFile}${SNAPSHOT_SUFFIX}`
    writeFileSync(snapshotFile, JSON.stringify(snapshot))
    // 派生腿产物申报(2026-11-04 立):每轮重置,钩子里的派生腿在 `git add` 前把
    // 「将写出的产物路径 + 工作树 blob」写进这份文件;restore-index 据此并入允许集。
    const derivedFile = `${indexFile}${DERIVED_SUFFIX}`
    try {
      unlinkSync(derivedFile)
    } catch {
      /* 不存在 = 正常 */
    }
    const hookedEnv = {
      ...env,
      IHUI_ISOLATED_INDEX_SNAPSHOT: snapshotFile,
      IHUI_ISOLATED_INDEX_DERIVED_MANIFEST: derivedFile,
      // 声明给 .husky/pre-commit 与 sanitizeGitEnv:本次提交的私有索引必须一字不差地传下去,
      // 丢了就 fail-closed,绝不静默落回共享索引。
      IHUI_EXPECTED_PRIVATE_INDEX: indexFile,
    }
    const res = rawGit(['commit', ...commitOpts], { gitCwd, env: hookedEnv, allowFail: true })
    if (res.status === 0) {
      // 成功路径默认吞掉 git 的 stderr;护栏复原留痕必须让作者看见(其余钩子输出不放大)。
      if (/私有索引内容护栏/.test(String(res.stderr || ''))) log.warn?.(String(res.stderr).trim())
      const derived = derivedArtifacts.readDerivedManifest(derivedFile)
      const sha = verifyLanded({
        ctx,
        base,
        declared,
        extraAllowed: derived.map((d) => d.path).filter(Boolean),
        stdout: res.stdout,
        log,
      })
      const refreshed = refreshSharedIndex({
        gitCwd,
        gitDir,
        indexFile,
        base,
        committedSha: sha,
        log,
      })
      // 共享索引里还有别人的 staged(常态)⇒ 整份 CAS 会放弃;此时只把**本次声明路径**
      // 推进到新提交树,避免留下 MM/AD 反向暂存(见 advanceSharedIndexPaths 头注)。
      if (!refreshed) {
        advanceSharedIndexPaths({
          gitCwd,
          gitDir,
          committedSha: sha,
          paths: [...declared],
          log,
        })
      }
      return 0
    }
    if (isLockBusy(res.stderr) && attempt < MAX_ATTEMPTS) {
      log.warn?.(`⟳ 第 ${attempt} 轮:git 写锁被占,2s 后重试(私有索引不碰共享 index.lock)`)
      sleepMs(2000)
      continue
    }
    const detail = String(res.stderr || res.stdout || '').trim()
    console.error(detail)
    return res.status || 1
  }
  throw new Error(`${MAX_ATTEMPTS} 轮都没抢到写面,停手(未产生提交)`)
}

/** 提交落地后的只读核验:父提交仍是本轮基线、载荷仍等于声明集(∪ 派生申报集)。 */
export function verifyLanded({ ctx, base, declared, extraAllowed = [], stdout, log = console }) {
  const fromStdout = String(stdout || '').match(/\[[^\]]*\s([0-9a-f]{7,40})\]/)?.[1]
  const sha = fromStdout
    ? gitOut(['rev-parse', fromStdout], ctx)
    : gitOut(['rev-parse', 'HEAD'], ctx)
  const parents = gitOut(['show', '--no-patch', '--format=%P', sha], ctx)
    .split(/\s+/)
    .filter(Boolean)
  const changed = gitOut(['-c', 'core.quotepath=false', 'diff', '--name-only', base, sha], ctx)
    .split(/\r?\n/)
    .filter(Boolean)
  const allowed = new Set([...declared, ...extraAllowed.filter(Boolean)])
  const extra = changed.filter((p) => !allowed.has(p))
  if (extra.length) {
    console.error(
      `❗ 提交 ${sha.slice(0, 12)} 已落地,但载荷含声明集之外的路径 —— 不要推送,先人工核验:`,
    )
    console.error(`  ${extra.join('\n  ')}`)
    throw new Error('事后核验失败:提交载荷 ≠ 声明集')
  }
  if (parents[0] !== base) {
    log.warn?.(
      `⚠️ 提交 ${sha.slice(0, 12)} 的父提交是本轮基线之后的 ${parents[0]?.slice(0, 12)}(钩子运行期间 HEAD 被推进);载荷已核验只含声明集`,
    )
  }
  console.info(`✅ 已提交 ${sha.slice(0, 7)} (私有索引 ${INDEX_DIR_NAME})`)
  return sha
}

/**
 * 提交后把**共享索引**推进到新 HEAD —— 只在"共享索引此刻恰好等于本提交的父树"时做:
 * 说明里面没有任何人 staged 的内容,推进只是把陈旧的一版追上,不会丢别人东西。
 * 先抢 `.git/index.lock` 再复核(拿到锁后别的写者进不来),条件不成立立即放锁原样不动,
 * 留给下一条 `safe-commit`(§12 Step 1)自愈。
 */
export function refreshSharedIndex({
  gitCwd,
  gitDir,
  indexFile,
  base,
  committedSha,
  log = console,
}) {
  if (gitOut(['rev-parse', 'HEAD'], { gitCwd, env: cleanGitEnv() }) !== committedSha) return false
  const sharedIndex = join(gitDir, 'index')
  const lock = join(gitDir, 'index.lock')
  let fd
  try {
    fd = openSync(lock, 'wx')
  } catch {
    return false
  }
  try {
    closeSync(fd)
    const stillOurs = gitOut(['rev-parse', 'HEAD'], { gitCwd, env: cleanGitEnv() }) === committedSha
    const indexIsParent =
      rawGit(['diff-index', '--cached', '--quiet', base], {
        gitCwd,
        env: cleanGitEnv(),
        allowFail: true,
      }).status === 0
    if (!stillOurs || !indexIsParent) return false
    writeFileSync(lock, readFileSync(indexFile))
    renameSync(lock, sharedIndex)
    return true
  } catch (e) {
    log.warn?.(`共享索引 CAS 刷新失败(不影响本次提交): ${e?.message ?? e}`)
    return false
  } finally {
    try {
      unlinkSync(lock)
    } catch {
      /* rename 成功后 lock 已不存在 */
    }
  }
}

/**
 * 共享索引的**路径级**推进(2026-11-04 立)。
 *
 * `refreshSharedIndex` 只在共享索引恰好等于父树时整份追上;多会话下这几乎从不成立
 * (别人总有 staged),于是本单路径在共享索引里停在父树 —— 提交落地后它们以
 * `MM`/`AD` 形态"反向暂存":谁下一条裸 `git commit` 就会把本次提交改回去
 * (本仓历史上「已删件复活」的同一个根)。
 *
 * 这里只动**本次声明路径**:持 `.git/index.lock`(拿不到就放弃,不硬闯别人正在写的窗口),
 * 以持锁后现读的共享索引字节为基复制一份(别人的条目一个字节不改),只把声明路径的条目
 * 写成新提交树里的 blob/mode,再原子 rename 回去。拿不到锁或任何一步失败 ⇒ 原样不动,
 * 留给下一条 `safe-commit`(AGENTS §12 Step 1)自愈。
 */
export function advanceSharedIndexPaths({ gitCwd, gitDir, committedSha, paths, log = console }) {
  const sharedIndex = join(gitDir, 'index')
  const lock = join(gitDir, 'index.lock')
  const declared = [...new Set((paths || []).map((p) => normalizePath(gitCwd, p)))]
  if (!declared.length) return false
  let staging = null
  let fd
  try {
    fd = openSync(lock, 'wx')
  } catch {
    return false
  }
  try {
    closeSync(fd)
    staging = `${sharedIndex}.${process.pid}-${randomBytes(4).toString('hex')}.tmp`
    writeFileSync(staging, readFileSync(sharedIndex))
    const tree = String(
      rawGit(
        ['-c', 'core.quotepath=false', 'ls-tree', '-r', '-z', '--full-tree', committedSha, '--', ...declared],
        { gitCwd, env: cleanGitEnv() },
      ).stdout || '',
    )
    const recs = []
    for (const rec of tree.split('\u0000')) {
      if (!rec) continue
      const tab = rec.indexOf('\t')
      if (tab < 0) continue
      const meta = rec.slice(0, tab).trim().split(/\s+/)
      if (meta.length < 3 || meta[1] !== 'blob') continue
      recs.push({ mode: meta[0], blob: meta[2], path: rec.slice(tab + 1) })
    }
    if (!recs.length) return false
    const stageEnv = { ...cleanGitEnv(), GIT_INDEX_FILE: staging }
    for (const r of recs) {
      rawGit(['update-index', '--add', '--cacheinfo', `${r.mode},${r.blob},${r.path}`], {
        gitCwd,
        env: stageEnv,
      })
    }
    renameSync(staging, sharedIndex)
    return true
  } catch (e) {
    log.warn?.(`共享索引路径级推进失败(不影响本次提交): ${e?.message ?? e}`)
    return false
  } finally {
    try {
      unlinkSync(lock)
    } catch {
      /* rename 成功后 lock 已不存在 */
    }
    if (staging) {
      try {
        unlinkSync(staging)
      } catch {
        /* 已被 rename */
      }
    }
  }
}

const USAGE = `usage:
  node scripts/isolated-git.mjs commit -m "<提交标题>" -- <路径...>
  node scripts/isolated-git.mjs -C <仓库目录> commit -m "<标题>" -- <路径...>
说明:一次调用 = 一份私有 GIT_INDEX_FILE;pre-commit/commit-msg 照常跑,只交声明集。
      (restore-index 是 pre-commit 钩子内部使用的私有子命令,不面向人工调用。)`

/** `restore-index --snapshot <文件>`:只给钩子内部用,故不校验 assertNoBypass。 */
export function parseRestoreArgs(args) {
  const rest = [...args]
  let snapshot = ''
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === '--snapshot') {
      snapshot = String(rest[i + 1] ?? '')
      i += 1
    } else {
      throw new Error(`restore-index 不认识的参数:${rest[i]}`)
    }
  }
  if (!snapshot) throw new Error('restore-index 必须给 --snapshot <文件>')
  return snapshot
}

/**
 * 钩子退出阶段 `console.error` 走异步 pipe,进程一退出就可能丢行;护栏的复原/拒绝
 * 必须让用户与后续排查看得见,所以直接 `writeSync(2, ...)`。
 */
function stderrLine(line) {
  try {
    writeSync(2, `${line}\n`)
  } catch {
    console.error(line)
  }
}

function runRestoreIndex(gitCwd, args) {
  let snapshotFile
  try {
    snapshotFile = parseRestoreArgs(args)
  } catch (e) {
    stderrLine(`❌ ${e?.message ?? e}`)
    return 2
  }
  let snapshot
  try {
    snapshot = JSON.parse(readFileSync(snapshotFile, 'utf8'))
    if (!snapshot || !Array.isArray(snapshot.paths) || !Array.isArray(snapshot.entries)) {
      throw new Error(`快照形状坏:${snapshotFile}`)
    }
  } catch (e) {
    stderrLine(`❌ 私有索引内容护栏取不到快照(${snapshotFile}):${e?.message ?? e}`)
    return 1
  }
  let derived = []
  const derivedFile = process.env.IHUI_ISOLATED_INDEX_DERIVED_MANIFEST
  if (derivedFile) {
    try {
      derived = derivedArtifacts.readDerivedManifest(derivedFile)
    } catch (e) {
      stderrLine(`❌ 私有索引内容护栏读不到派生申报(${derivedFile}):${e?.message ?? e}`)
      return 1
    }
  }
  let result
  try {
    result = restoreIndexFromSnapshot({
      gitCwd,
      env: childEnv(process.env.GIT_INDEX_FILE),
      snapshot,
      derived,
      log: { error: stderrLine },
    })
  } catch (e) {
    stderrLine(`❌ 私有索引内容护栏复原失败:${e?.message ?? e}`)
    return 1
  }
  if (result.still.length) {
    stderrLine('❌ 私有索引内容护栏:复原后索引仍与快照不一致,拒绝提交:')
    for (const d of result.still) {
      stderrLine(
        `  ${d.path}: 快照 ${d.expected?.blob ?? '(无条目)'} → 复原后 ${d.actual?.blob ?? '(无条目)'}`,
      )
    }
    return 1
  }
  if (result.derivedViolations.length) {
    stderrLine('❌ 私有索引内容护栏:派生产物申报与索引实际内容不符,拒绝提交:')
    for (const d of result.derivedViolations) stderrLine(`  ${d}`)
    return 1
  }
  if (result.extras.length) {
    stderrLine('❌ 私有索引内容护栏:钩子在声明集(含派生申报集)之外塞入了索引条目,拒绝提交:')
    for (const p of result.extras) stderrLine(`  ${p}`)
    return 1
  }
  return 0
}

export function main(argv = process.argv.slice(2)) {
  const { gitCwd, args } = parseLeadingC(argv)
  if (args[0] === '--help' || args[0] === '-h') {
    console.info(USAGE)
    return 0
  }
  if (args[0] === 'restore-index') return runRestoreIndex(gitCwd, args.slice(1))
  if (args[0] !== 'commit') {
    console.error(`❌ 只支持 commit 子命令(收到:${args[0] ?? '空'})`)
    console.error(USAGE)
    return 2
  }
  let parsed
  try {
    assertNoBypass()
    parsed = splitCommitArgs(args.slice(1))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}`)
    return 2
  }
  const gitDir = gitDirOf(gitCwd)
  const indexDir = join(gitDir, INDEX_DIR_NAME)
  mkdirSync(indexDir, { recursive: true })
  const swept = sweepStale(indexDir)
  if (swept.length) console.warn(`🧹 已清理 ${swept.length} 份死进程残留索引:${swept.join(', ')}`)
  const indexFile = indexPathFor(gitDir)
  ACTIVE_INDEXES.add(indexFile)
  try {
    return commitWithIndex({
      gitCwd,
      env: childEnv(indexFile),
      gitDir,
      commitOpts: parsed.commitOpts,
      paths: parsed.paths,
    })
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}`)
    return 2
  } finally {
    disposeIndex(indexFile)
  }
}

function cleanupAll() {
  for (const f of [...ACTIVE_INDEXES]) disposeIndex(f)
}

/** 信号路径:`exit` 不覆盖 SIGINT/SIGTERM,显式补(硬杀由下次 sweep 兜底)。 */
export function installExitHooks() {
  process.on('exit', cleanupAll)
  for (const [sig, code] of [
    ['SIGINT', 130],
    ['SIGTERM', 143],
    ['SIGHUP', 129],
  ]) {
    process.on(sig, () => {
      cleanupAll()
      process.exit(code)
    })
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  installExitHooks()
  process.exitCode = main()
}

export const __test__ = {
  INDEX_NAME_RE,
  splitCommitArgs,
  parseLeadingC,
  normalizePath,
  childEnv,
  isPidAlive,
  sweepStale,
  indexPathFor,
  gitDirOf,
  isLockBusy,
  parseLsFilesZ,
  lsEntries,
  parseRestoreArgs,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
