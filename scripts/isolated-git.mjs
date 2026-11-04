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
 * - **共享索引一个字节都不写**:提交后共享 `.git/index` 相对新 HEAD 会"落后一版"(表现为
 *   `git status` 把这些路径显示为待提交的回退)。这是刻意的——写它就得跟别的会话抢
 *   `index.lock` 并可能清掉别人 staged 的路径;下一条 `safe-commit`(§12 Step 1 `reset HEAD`)
 *   会自愈。别在本通道之后再裸 `git commit`。
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
import { existsSync, mkdirSync, readdirSync, rmSync, rmdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** 仓根由脚本自身位置推导,禁 `process.cwd()` 定根(AGENTS §15)。 */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const INDEX_DIR_NAME = 'ihui-isolated-index'
export const MAX_ATTEMPTS = 5
/** 残留判定:pid 已死,或存活但文件超过 24h(防 pid 复用把旧文件永久留下)。 */
export const STALE_AGE_MS = 24 * 60 * 60 * 1000
const INDEX_NAME_RE = /^(\d+)-(\d+)-([0-9a-f]{8})\.idx(\.lock)?$/
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
  const res = spawnSync('git', args, {
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

/** 删掉本进程的索引与它自己的 `.lock`;目录空了就顺手收掉(不递归、不碰别的东西)。 */
export function disposeIndex(indexFile) {
  ACTIVE_INDEXES.delete(indexFile)
  for (const f of [indexFile, `${indexFile}.lock`]) {
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

/**
 * 核心提交:每一轮都「重新 read-tree 当时 HEAD → add 声明集 → 查无外来件 → 发令」。
 * 这样即便别的会话在上一轮把 HEAD 推前了,也不会拿旧索引去建一枚把别人改动退回去的提交
 * (2026-09-26 bf286534bd 同型事故;native `--only` 也有同一个理论窗口,这里事后还核验一次)。
 */
export function commitWithIndex({ gitCwd, env, commitOpts, paths, log = console }) {
  const ctx = { gitCwd, env }
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
    const res = rawGit(['commit', ...commitOpts], { ...ctx, allowFail: true })
    if (res.status === 0) {
      verifyLanded({ ctx, base, declared, stdout: res.stdout, log })
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

/** 提交落地后的只读核验:父提交仍是本轮基线、载荷仍等于声明集。 */
export function verifyLanded({ ctx, base, declared, stdout, log = console }) {
  const fromStdout = String(stdout || '').match(/\[[^\]]*\s([0-9a-f]{7,40})\]/)?.[1]
  const sha = fromStdout || gitOut(['rev-parse', 'HEAD'], ctx)
  const parents = gitOut(['show', '--no-patch', '--format=%P', sha], ctx)
    .split(/\s+/)
    .filter(Boolean)
  const changed = gitOut(['-c', 'core.quotepath=false', 'diff', '--name-only', base, sha], ctx)
    .split(/\r?\n/)
    .filter(Boolean)
  const extra = changed.filter((p) => !declared.has(p))
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
}

const USAGE = `usage:
  node scripts/isolated-git.mjs commit -m "<提交标题>" -- <路径...>
  node scripts/isolated-git.mjs -C <仓库目录> commit -m "<标题>" -- <路径...>
说明:一次调用 = 一份私有 GIT_INDEX_FILE;pre-commit/commit-msg 照常跑,只交声明集。`

export function main(argv = process.argv.slice(2)) {
  const { gitCwd, args } = parseLeadingC(argv)
  if (args[0] === '--help' || args[0] === '-h') {
    console.info(USAGE)
    return 0
  }
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
  const indexDir = join(gitDirOf(gitCwd), INDEX_DIR_NAME)
  mkdirSync(indexDir, { recursive: true })
  const swept = sweepStale(indexDir)
  if (swept.length) console.warn(`🧹 已清理 ${swept.length} 份死进程残留索引:${swept.join(', ')}`)
  const indexFile = indexPathFor(dirname(indexDir))
  ACTIVE_INDEXES.add(indexFile)
  try {
    return commitWithIndex({
      gitCwd,
      env: childEnv(indexFile),
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
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
