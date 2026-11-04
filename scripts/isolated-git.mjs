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
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// git-lock 只经 §22c 的 __test__ 出口暴露 acquire/release(唯一实现,不在本文件抄第二份判据)。
import { __test__ as gitLock } from './git-lock.mjs'
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
/**
 * 私有提交上下文目录后缀(2026-11-04 立)。`.git/COMMIT_EDITMSG` 是全仓唯一一份,
 * 并发提交时 git 在 pre-commit 之后写、commit-msg 之后**再读回** —— 两次写之间
 * 只要别席也提交,这边就会把别人的消息读成自己的(native `-m`/`-F` 都挡不住,
 * 因为 git 根本不看 `-F` 指向哪)。根治办法:每次提交给子 git 一份**私有 GIT_DIR**
 * (同目录下 `commondir` 指回真实 gitdir,只隔离 per-worktree 元数据),
 * 让 git 把 COMMIT_EDITMSG 写进本席目录,别人够不到。
 */
export const PRIVATE_GITDIR_SUFFIX = '.gitdir'
const INDEX_NAME_RE = /^(\d+)-(\d+)-([0-9a-f]{8})(\.idx(\.lock|\.snap|\.derived\.json)?|\.gitdir)$/
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
/** 本次运行的 git 写锁单元(与 safe-commit 同一把锁;post-commit 见到该 env 不再嵌套加锁)。 */
const LOCK_UNIT = `isolated-git-${process.pid}-${Date.now()}`
/** acquire 的等待预算(原值 900_000ms 一字未动,只是提成常量,供观测行回填同一数字)。 */
const LOCK_TIMEOUT_MS = 900_000
/**
 * 本次 acquire 覆盖的阶段(仅用于可 grep 的观测行,**不参与任何判据**)。
 * 2026-11-04 起 `verifyLanded` 与共享索引推进已挪到放锁之后 ⇒ 锁只覆盖提交内核
 * (read-tree / add / native commit 及其钩子),不再覆盖事后只读核验与索引推进。
 */
const LOCK_SCOPE = 'commit-core'

/**
 * 一行机器可解析的观测输出(如 `[ihui-lock] result=ok waited_ms=1234 ...`)。
 * 只打印事实,**绝不参与锁语义**:不放宽超时、不改轮询间隔、不加退避。
 */
function traceLine(tag, fields) {
  const body = Object.entries(fields)
    .map(([k, v]) => `${k}=${String(v ?? '').replace(/\s+/g, '_')}`)
    .join(' ')
  const line = `[${tag}] ${body}`
  try {
    writeSync(1, `${line}\n`)
  } catch {
    console.info(line)
  }
}

/** 读锁的 meta(只读快照;读不到 ⇒ null,绝不因此改变 acquire/release 判据)。 */
function readLockMeta(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'))
  } catch {
    return null
  }
}

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
      rmSync(join(indexDir, name), { recursive: true, force: true })
      removed.push(name)
    } catch {
      /* 别人正删/权限抖动:下次再来,绝不升级成阻断 */
    }
  }
  return removed
}

/** 删掉本进程的索引、它自己的 `.lock`/内容快照/派生申报(只删自己的文件,不碰别席)。 */
export function disposeIndex(indexFile) {
  ACTIVE_INDEXES.delete(indexFile)
  for (const f of [
    indexFile,
    `${indexFile}.lock`,
    `${indexFile}${SNAPSHOT_SUFFIX}`,
    `${indexFile}${DERIVED_SUFFIX}`,
    `${indexFile}${PRIVATE_GITDIR_SUFFIX}`,
  ]) {
    try {
      rmSync(f, { recursive: true, force: true })
    } catch {
      /* 清理失败不覆盖原结论 */
    }
  }
  // ⚠️ 2026-11-04 起**不再 rmdir 目录**(原"空了就顺手收掉")。锁外核验把 dispose 挪到了
  // release 之后,别的席位此时已经在"mkdir 目录 → git 建 <idx>.lock"之间:一次 rmdir 若
  // 恰好插进这两步,对方 git 就报 `Unable to create '<idx>.lock': No such file or directory`
  // (20 轮重叠夹具实测 2/20)。空目录留在 `.git/ihui-isolated-index` 无害,残留文件由
  // `sweepStale` 按宿主 pid 清掉;目录本身不参与任何判据。
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
 * 从 commitOpts 里剥离一切消息来源(`-m/--message/-F/--file`),统一改写成本席私有
 * 临时消息文件。调用方给 `-F .git/COMMIT_EDITMSG` 或 `-m` 都不会让本通道碰到共享消息文件。
 */
export function extractCommitMessage(commitOpts, { baseCwd = process.cwd(), gitDir = null } = {}) {
  const rest = []
  const messages = []
  let file = null
  for (let i = 0; i < commitOpts.length; i += 1) {
    const arg = commitOpts[i]
    if (arg === '-m' || arg === '--message') {
      if (i + 1 >= commitOpts.length) throw new Error(`${arg} 缺少消息内容`)
      messages.push(commitOpts[i + 1])
      i += 1
      continue
    }
    if (String(arg).startsWith('--message=')) {
      messages.push(String(arg).slice('--message='.length))
      continue
    }
    if (arg === '-F' || arg === '--file') {
      if (i + 1 >= commitOpts.length) throw new Error(`${arg} 缺少文件路径`)
      if (file) throw new Error('只允许一个 -F/--file')
      file = commitOpts[i + 1]
      i += 1
      continue
    }
    if (String(arg).startsWith('--file=')) {
      if (file) throw new Error('只允许一个 -F/--file')
      file = String(arg).slice('--file='.length)
      continue
    }
    rest.push(arg)
  }
  if (file && messages.length) throw new Error('不得同时给 -m 与 -F')
  let text
  if (file) {
    // 相对路径按调用方 git 的工作目录解析(与 native `git commit -F` 同义)。
    const abs = resolve(baseCwd, file)
    // 硬线:任何站点都不许把共享 `.git/COMMIT_EDITMSG` 当成消息源(并发下它就是别人的消息)。
    if (gitDir && abs === resolve(gitDir, 'COMMIT_EDITMSG')) {
      throw new Error(
        '禁止复用共享 .git/COMMIT_EDITMSG 作为提交消息源:请改用 -m 或本席私有临时文件',
      )
    }
    text = readFileSync(abs, 'utf8')
  } else {
    text = messages.join('\n\n')
  }
  if (!text.trim()) throw new Error('提交消息为空')
  return { rest, text, sourceFile: file }
}

/** `%s` 语义:第一段逐行 trim 后以单空格连接(git format_subject 同形;跳过注释行)。 */
export function subjectFromMessage(text) {
  const out = []
  for (const line of String(text).replace(/\r\n/g, '\n').split('\n')) {
    const t = line.trim()
    if (!t) {
      if (out.length) break
      continue
    }
    if (t.startsWith('#')) continue
    out.push(t)
  }
  return out.join(' ')
}

/**
 * 为本轮提交建「私有 GIT_DIR 叠层 + 私有消息文件」。
 * 私有 gitdir 只承载 per-worktree 元数据(HEAD/COMMIT_EDITMSG),`commondir` 指回真实
 * gitdir ⇒ refs/objects/config 仍是同一仓。子 git 的 COMMIT_EDITMSG 因此只写本席目录,
 * 并发会话再也覆盖不到;`-F` 也只是本席临时文件,不再指向共享路径。
 */
export function preparePrivateCommitContext({ gitCwd, gitDir, indexFile, commitOpts }) {
  const { rest, text } = extractCommitMessage(commitOpts, { baseCwd: gitCwd, gitDir })
  const baseName = basename(indexFile).replace(/\.idx$/, '')
  const privDir = join(dirname(indexFile), `${baseName}${PRIVATE_GITDIR_SUFFIX}`)
  rmSync(privDir, { recursive: true, force: true })
  mkdirSync(privDir, { recursive: true })
  // HEAD 原样复制(可能是符号引用) ⇒ 提交仍落在同一条分支上。
  writeFileSync(join(privDir, 'HEAD'), readFileSync(join(gitDir, 'HEAD'), 'utf8'))
  writeFileSync(join(privDir, 'commondir'), `${gitDir}\n`)
  const messageFile = join(privDir, 'message.txt')
  writeFileSync(messageFile, text.endsWith('\n') ? text : `${text}\n`)
  return {
    commitOpts: [...rest, '-F', messageFile],
    expectedSubject: subjectFromMessage(text),
    env: { GIT_DIR: privDir, GIT_WORK_TREE: gitCwd },
    dispose() {
      try {
        rmSync(privDir, { recursive: true, force: true })
      } catch {
        /* 清理失败不覆盖原结论;下次 sweep 按宿主 pid/超龄清 */
      }
    },
  }
}

/**
 * 核心提交:每一轮都「重新 read-tree 当时 HEAD → add 声明集 → 查无外来件 → 发令」。
 * 这样即便别的会话在上一轮把 HEAD 推前了,也不会拿旧索引去建一枚把别人改动退回去的提交
 * (2026-09-26 bf286534bd 同型事故;native `--only` 也有同一个理论窗口,这里事后还核验一次)。
 * 每轮同时建一份私有 GIT_DIR 叠层 + 私有消息文件,提交后回读 `%s` 与本席写入逐字比对。
 */
export function commitWithIndex({ gitCwd, env, gitDir, commitOpts, paths, log = console }) {
  const ctx = { gitCwd, env }
  const indexFile = env.GIT_INDEX_FILE
  const declared = new Set(paths.map((p) => normalizePath(gitCwd, p)))
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    // 目录可能在本进程排队等写锁期间被别席的 disposeIndex 收掉(它只在本进程索引文件
    // 尚未出现时才能 rmdir 成功)⇒ 每轮开跑前重新确保目录在,否则 git 建 .idx.lock
    // 会以 "No such file or directory" 直接失败(2026-11-04 并发夹具实测)。
    mkdirSync(dirname(indexFile), { recursive: true })
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
    // 私有 GIT_DIR 叠层 + 私有消息文件:git 的 COMMIT_EDITMSG 只写本席目录,
    // 并发会话的提交消息再也覆盖不到这里。失败/成功都立即回收本席目录。
    const privateCommit = preparePrivateCommitContext({ gitCwd, gitDir, indexFile, commitOpts })
    let res
    try {
      // 受保护面申报预检(2026-11-05 立):同一份判据(`check-immutable-guard --staged --message-file`),
      // 只是从 `.husky/commit-msg` 那一层挪到**做决定的这一层**。立因不是设计错了,是可见性错了:
      // 当次实测 03:54:33 那道预警**确实响了并点名了缺什么**,但 `hook-run-hidden.vbs …  || true`
      // 让它的 rc 被吞,输出只以"末 8 行"回流,而调用方(我本人)截尾读了 `tail -6` ⇒ 带着
      // `code=undeclared` 的提交照样落地,事后只能由持钥方追认(而本机没有追认钥 ⇒ 无人能清)。
      // 失效方向刻意是"多要一次定向说明":rc=1(未申报)与 rc=2(未判定)都在提交前拒,rc=0 静默放行。
      const msgIdx = privateCommit.commitOpts.indexOf('-F')
      const msgFile = msgIdx >= 0 ? privateCommit.commitOpts[msgIdx + 1] : null
      let denial = null
      if (msgFile) {
        const g = spawnSync(
          process.execPath,
          [
            join(ROOT, 'scripts', 'check-immutable-guard.mjs'),
            '--staged',
            '--message-file',
            msgFile,
          ],
          {
            cwd: gitCwd,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            encoding: 'utf8',
            maxBuffer: 32 * 1024 * 1024,
            timeout: 300_000,
            env: { ...hookedEnv, ...privateCommit.env },
          },
        )
        const gOut = `${String(g.stdout ?? '')}${String(g.stderr ?? '')}`
        if (g.status === 1 || g.status === 2) {
          denial = {
            status: 1,
            stdout: '',
            stderr:
              `受保护面申报预检不过(判据 = check-immutable-guard,与 commit-msg 同一份;rc=${g.status})⇒ 本枚不提交\n` +
              gOut.trimEnd() +
              '\n出路:在提交信息里补一行 `immutable-exempt: <≥10 字理由>`(需要签名时先 `--sign-staged` 再原样带上),' +
              'rc=2 则先修清单/索引面取不到的那一项 —— 不许用跳门变量绕过。',
          }
        }
      }
      res =
        denial ??
        rawGit(['commit', ...privateCommit.commitOpts], {
          gitCwd,
          env: { ...hookedEnv, ...privateCommit.env },
          allowFail: true,
        })
    } finally {
      privateCommit.dispose()
    }
    if (res.status === 0) {
      // 成功路径默认吞掉 git 的 stderr;护栏复原留痕必须让作者看见(其余钩子输出不放大)。
      if (/私有索引内容护栏/.test(String(res.stderr || ''))) log.warn?.(String(res.stderr).trim())
      const derived = derivedArtifacts.readDerivedManifest(derivedFile)
      // 2026-11-04:事后核验与共享索引推进都**不需要仓级写锁** —— `verifyLanded` 按已落地的
      // sha 只读;`advanceSharedIndexPaths` 自带 `.git/index.lock` + 现读字节基线。这里只把
      // 「落地事实」交回给 main,由它在 release 之后再跑(锁内时长因此缩短,锁语义不变)。
      return {
        code: 0,
        landed: {
          ctx,
          gitDir,
          indexFile,
          base,
          declared,
          extraAllowed: derived.map((d) => d.path).filter(Boolean),
          stdout: res.stdout,
          expectedSubject: privateCommit.expectedSubject,
        },
      }
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

/** 提交落地后的只读核验:subject 逐字自证、父提交仍是本轮基线、载荷仍等于声明集(∪ 派生申报集)。 */
export function verifyLanded({
  ctx,
  base,
  declared,
  extraAllowed = [],
  stdout,
  expectedSubject = null,
  log = console,
}) {
  const fromStdout = String(stdout || '').match(/\[[^\]]*\s([0-9a-f]{7,40})\]/)?.[1]
  const sha = fromStdout
    ? gitOut(['rev-parse', fromStdout], ctx)
    : gitOut(['rev-parse', 'HEAD'], ctx)
  // 串号自证:git 在 commit-msg 之后会**再读一次** $GIT_DIR/COMMIT_EDITMSG。即便用 -m/-F
  // 写私有消息文件,只要共享 .git/COMMIT_EDITMSG 被别人覆盖,提交就可能拿到别人的标题。
  // 这里回读 %s 与本席写入逐字比对;不一致 ⇒ 立即上报,绝不 amend(多席在途时改写会丢别人的工作)。
  if (expectedSubject !== null) {
    const got = gitOut(['log', '-1', '--format=%s', sha], ctx)
    if (got !== expectedSubject) {
      console.error(
        `❗ 提交 ${sha.slice(0, 12)} 已落地,但 subject 与本席写入不一致(疑似 COMMIT_EDITMSG 并发串号):`,
      )
      console.error(`  want=${JSON.stringify(expectedSubject)}`)
      console.error(`  got =${JSON.stringify(got)}`)
      console.error('  按硬线停止:不改写、不 amend;请登记勘误台账后上报。')
      throw new Error('提交 subject 自证失败(疑似并发串号)')
    }
    log.info?.(`✅ subject 回读一致:${got}`)
  }
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
export function advanceSharedIndexPaths({
  gitCwd,
  gitDir,
  committedSha,
  paths,
  repoLock = 'unknown',
  log = console,
}) {
  const sharedIndex = join(gitDir, 'index')
  const lock = join(gitDir, 'index.lock')
  const declared = [...new Set((paths || []).map((p) => normalizePath(gitCwd, p)))]
  // 观测行:让"跳过不覆盖"可被 grep 计数(result=ok|skipped + reason)。判据面一字不动。
  const report = (result, reason) =>
    traceLine('ihui-shared-index', {
      op: 'advance',
      result,
      reason,
      paths: declared.length,
      sha: String(committedSha || '').slice(0, 7),
      repo_lock: repoLock,
    })
  if (!declared.length) {
    report('skipped', 'empty')
    return false
  }
  let staging = null
  let fd
  try {
    fd = openSync(lock, 'wx')
  } catch {
    report('skipped', 'index-lock-held')
    return false
  }
  try {
    closeSync(fd)
    staging = `${sharedIndex}.${process.pid}-${randomBytes(4).toString('hex')}.tmp`
    writeFileSync(staging, readFileSync(sharedIndex))
    const tree = String(
      rawGit(
        [
          '-c',
          'core.quotepath=false',
          'ls-tree',
          '-r',
          '-z',
          '--full-tree',
          committedSha,
          '--',
          ...declared,
        ],
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
    if (!recs.length) {
      report('skipped', 'no-entries')
      return false
    }
    const stageEnv = { ...cleanGitEnv(), GIT_INDEX_FILE: staging }
    for (const r of recs) {
      rawGit(['update-index', '--add', '--cacheinfo', `${r.mode},${r.blob},${r.path}`], {
        gitCwd,
        env: stageEnv,
      })
    }
    renameSync(staging, sharedIndex)
    report('ok', 'done')
    return true
  } catch (e) {
    log.warn?.(`共享索引路径级推进失败(不影响本次提交): ${e?.message ?? e}`)
    report('skipped', 'error')
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

export async function main(argv = process.argv.slice(2)) {
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
  // 全仓 git 写锁:提交(含数分钟钩子)期间禁止别的会话推进 HEAD。否则本席索引仍是旧基线,
  // 而提交父变成新 HEAD ⇒ 树里没有对方改动,等于把别人的文件回退(2026-11-04 夹具实测)。
  const lockDirPath = join(gitDir, 'ihui-git-write.lock')
  // 排队读数:抢到锁之后 meta 已经是自己的,所以"我等的是谁"只能在**进 acquire 之前**
  // 取一份只读快照(进锁时无人持锁 ⇒ none;锁在但读不到 meta ⇒ unknown;绝不因此改锁判据)。
  // ⚠️ waited_ms 是**字面值**(从调用 acquire 到返回的真实毫秒),含 git-lock 首次写 meta 时
  // 的进程身份探针开销(本机实测约 1.2s,每个新进程一次);因此"零竞争"也会看到 1.2s 左右,
  // 判断是否真排队请看 holder_unit 与 hold_ms。
  const priorHolder = readLockMeta(lockDirPath)
  const acquireT0 = Date.now()
  let waitedMs = 0
  try {
    await gitLock.acquire({
      unitId: LOCK_UNIT,
      timeoutMs: LOCK_TIMEOUT_MS,
      dir: lockDirPath,
      cleanIndexLocks: false,
      log: () => {},
    })
    waitedMs = Date.now() - acquireT0
    traceLine('ihui-lock', {
      result: 'ok',
      waited_ms: waitedMs,
      holder_unit: priorHolder ? priorHolder.unitId || 'unknown' : 'none',
      lock_scope: LOCK_SCOPE,
      unit: LOCK_UNIT,
      pid: process.pid,
    })
  } catch (e) {
    waitedMs = Date.now() - acquireT0
    traceLine('ihui-lock', {
      result: 'timeout',
      waited_ms: waitedMs,
      timeout_ms: LOCK_TIMEOUT_MS,
      holder_unit: readLockMeta(lockDirPath)?.unitId || 'unknown',
      lock_scope: LOCK_SCOPE,
      unit: LOCK_UNIT,
      pid: process.pid,
    })
    console.error(`❌ 抢 git 写锁失败,拒绝在无人看守的共享树上提交:${e?.message ?? e}`)
    disposeIndex(indexFile)
    return 1
  }
  const holdT0 = Date.now()
  ACTIVE_LOCKS.add(lockDirPath)
  // 让 post-commit 认出本席已持锁,避免它再抢同一把锁(同 unitId 可重入)。
  process.env.IHUI_GIT_LOCK_UNIT = LOCK_UNIT
  let outcome
  try {
    outcome = commitWithIndex({
      gitCwd,
      env: childEnv(indexFile),
      gitDir,
      commitOpts: parsed.commitOpts,
      paths: parsed.paths,
    })
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}`)
    outcome = { code: 2 }
  } finally {
    ACTIVE_LOCKS.delete(lockDirPath)
    const rel = gitLock.release({ unitId: LOCK_UNIT, dir: lockDirPath, log: () => {} })
    traceLine('ihui-lock', {
      result: 'release',
      waited_ms: waitedMs,
      hold_ms: Date.now() - holdT0,
      holder_unit: LOCK_UNIT,
      lock_scope: LOCK_SCOPE,
      released: rel.released ? 1 : 0,
    })
    if (!rel.released) {
      console.error(`⚠️ git 写锁释放失败(下次 acquire 会按 stale/身份判据回收):${rel.why ?? ''}`)
    }
  }
  // —— 放锁之后的两件只读/自锁事务(2026-11-04 挪出):都不需要仓级写锁,搬出去只为缩短
  // 「锁内时长」。`verifyLanded` 按已落地 sha 只读;`advanceSharedIndexPaths` 自带
  // `.git/index.lock` + 现读字节基线,拿不到就"跳过不覆盖"(不会静默改回别人的条目)。
  try {
    if (outcome && outcome.landed) {
      const l = outcome.landed
      const sha = verifyLanded({
        ctx: l.ctx,
        base: l.base,
        declared: l.declared,
        extraAllowed: l.extraAllowed,
        stdout: l.stdout,
        expectedSubject: l.expectedSubject,
      })
      const refreshed = refreshSharedIndex({
        gitCwd,
        gitDir: l.gitDir,
        indexFile: l.indexFile,
        base: l.base,
        committedSha: sha,
      })
      // 共享索引里还有别人的 staged(常态)⇒ 整份 CAS 会放弃;此时只把**本次声明路径**
      // 推进到新提交树,避免留下 MM/AD 反向暂存(见 advanceSharedIndexPaths 头注)。
      if (!refreshed) {
        advanceSharedIndexPaths({
          gitCwd,
          gitDir: l.gitDir,
          committedSha: sha,
          paths: [...l.declared],
          repoLock: 'released',
        })
      }
      return 0
    }
    return typeof outcome === 'number' ? outcome : (outcome?.code ?? 2)
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}`)
    return 2
  } finally {
    // 私有索引必须等共享索引推进读完才回收(refreshSharedIndex 直接读它的字节)。
    disposeIndex(indexFile)
  }
}

const ACTIVE_LOCKS = new Set()

function cleanupAll() {
  for (const f of [...ACTIVE_INDEXES]) disposeIndex(f)
  for (const dir of [...ACTIVE_LOCKS]) {
    try {
      gitLock.release({ unitId: LOCK_UNIT, dir, log: () => {} })
    } catch {
      /* 忽略 */
    }
  }
  ACTIVE_LOCKS.clear()
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
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}`)
      process.exitCode = 2
    })
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
