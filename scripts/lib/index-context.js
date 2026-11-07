// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * index-context.js — pre-commit 钩子的「索引上下文」唯一实现(2026-11-04 立)
 *
 * 治什么(两处独立丢失点,必须同时封住):
 *  ① `.husky/pre-commit` / sanitizeGitEnv 在 GIT_INDEX_FILE 为空或文件不存在时会清掉指针。
 *     这本是正确判据(陈旧指针会让 git 把它读成空索引),但调用方**声明过**私有索引时,
 *     清掉就等于让整条钩子链落到共享索引上。故新增 `IHUI_EXPECTED_PRIVATE_INDEX` 声明:
 *     声明在场而指针不符/缺失 ⇒ 这里 fail-closed(报「索引上下文丢失」并拒绝提交)。
 *  ② lint-staged 17.3.0 的 gitWorkflow.js:403-421:activeIndexFile 以 `.lock` 结尾时,
 *     它会**额外**对默认索引(`<gitdir>/index.lock`)再跑一次 `git add`(tinyexec 会
 *     `{...process.env, ...env}` 合并,显式覆盖 GIT_INDEX_FILE)。实测:8 个路径的整份索引
 *     被写进 `.git/index.lock`,父 git 收尾时落成共享索引 ⇒ `MM` 反向暂存残留。
 *     修法不是禁用上游逻辑,而是**让 activeIndexFile 不再是 `.lock`**:把父 git 交来的
 *     `next-index-<pid>.lock` 原样复制成 `<gitdir>/ihui-isolated-index/<pid>-<ms>-<rand>.idx`,
 *     钩子链全程只认这份副本;退出时(且仅当钩子整体成功)再把副本字节回写原 `.lock`,
 *     父 git 读到的仍是它自己那一份(含派生产物与暂存区复原)。
 *
 * 同时给两层校验:
 *  - `assertIndexContext`:指针必须仍指向本次那份副本且非空(子进程间不丢);
 *  - `captureSharedView` / `assertSharedViewUnchanged`:共享索引(以及若存在的 index.lock)
 *    里**本次声明路径**的条目必须前后逐条一致 —— 任何写共享索引的行为当场判红。
 *
 * 判据只写这一份(AGENTS §0.6):hook 侧 require 本模块,不另行复制。
 */

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')

const LOST_PREFIX = '索引上下文丢失'
const ACTIVE_DIR_NAME = 'ihui-isolated-index'
const LOCK_SUFFIX = '.lock'

let CURRENT = null

function lost(message) {
  throw new Error(`${LOST_PREFIX}:${message}`)
}

const toPosix = (p) => String(p || '').replace(/\\/g, '/')

function samePath(a, b) {
  const na = toPosix(path.resolve(String(a || '')))
  const nb = toPosix(path.resolve(String(b || '')))
  return process.platform === 'win32' ? na.toLowerCase() === nb.toLowerCase() : na === nb
}

/** 取仓库真实 gitdir 与共享索引绝对路径;取不到就退回指针所在目录(不猜第二份根)。 */
function resolveGitPaths(cwd, entry) {
  const env = { ...process.env }
  for (const k of ['GIT_INDEX_FILE', 'GIT_DIR', 'GIT_WORK_TREE']) delete env[k]
  const r = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-path', 'index'], {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const sharedIndex = String(r.stdout || '').trim()
  if (r.status === 0 && sharedIndex) return { gitDir: path.dirname(sharedIndex), sharedIndex }
  const fallback = path.dirname(path.resolve(entry))
  return { gitDir: fallback, sharedIndex: path.join(fallback, 'index') }
}

function fileUsable(file) {
  try {
    const st = fs.statSync(file)
    return st.isFile() && st.size > 0
  } catch {
    return false
  }
}

function runGitLs(cwd, env, args) {
  const r = spawnSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  return r.status === 0
    ? String(r.stdout || '')
    : `!!exit=${r.status}:${String(r.stderr || '').trim()}`
}

/**
 * 建立本次钩子的索引上下文(幂等)。
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{cwd?: string}} [options]
 * @returns {{mode:'shared'|'private', declared:string|null, entry:string|null,
 *   active:string|null, created:string|null, gitDir:string|null, sharedIndex:string|null, cwd:string}}
 */
function prepareIndexContext(env = process.env, options = {}) {
  if (CURRENT) return CURRENT
  const cwd = options.cwd || process.cwd()
  const pointer = env.GIT_INDEX_FILE ? path.resolve(cwd, env.GIT_INDEX_FILE) : ''
  const declared = env.IHUI_EXPECTED_PRIVATE_INDEX
    ? path.resolve(cwd, env.IHUI_EXPECTED_PRIVATE_INDEX)
    : ''

  if (declared) {
    if (!pointer)
      lost(`调用方声明了私有索引(${toPosix(declared)}),但钩子进程的 GIT_INDEX_FILE 为空`)
    if (!samePath(pointer, declared))
      lost(`声明索引 ${toPosix(declared)} 与实际 GIT_INDEX_FILE ${toPosix(pointer)} 不一致`)
  }

  if (!pointer) {
    CURRENT = {
      mode: 'shared',
      declared: null,
      entry: null,
      active: null,
      created: null,
      gitDir: null,
      sharedIndex: null,
      cwd,
    }
    return CURRENT
  }

  if (!fileUsable(pointer)) lost(`GIT_INDEX_FILE 指向的文件不存在或为空:${toPosix(pointer)}`)

  const { gitDir, sharedIndex } = resolveGitPaths(cwd, pointer)
  let active = pointer
  let created = null
  // 只有父 git 的临时索引(next-index-*.lock)需要换名:上游 lint-staged 的
  // “activeIndexFile.endsWith('.lock') ⇒ 再写默认索引”分支据此触发,换名后结构上不可达。
  if (pointer.endsWith(LOCK_SUFFIX)) {
    const dir = path.join(gitDir, ACTIVE_DIR_NAME)
    fs.mkdirSync(dir, { recursive: true })
    const name = `${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.idx`
    active = path.join(dir, name)
    fs.copyFileSync(pointer, active)
    created = active
    env.GIT_INDEX_FILE = active
  }

  CURRENT = {
    mode: 'private',
    declared: declared || pointer,
    entry: pointer,
    active,
    created,
    gitDir,
    sharedIndex,
    cwd,
  }
  return CURRENT
}

/**
 * 子进程/后续步骤开工前的指针校验:必须仍是本次那份私有索引,且非空。
 * @param {ReturnType<typeof prepareIndexContext>} ctx
 */
function assertIndexContext(ctx) {
  if (!ctx || ctx.mode !== 'private') return
  const cur = process.env.GIT_INDEX_FILE
  if (!cur) lost(`钩子进程的 GIT_INDEX_FILE 被清空(应为 ${toPosix(ctx.active)})`)
  if (!samePath(cur, ctx.active))
    lost(`GIT_INDEX_FILE 被改成 ${toPosix(cur)}(应为 ${toPosix(ctx.active)})`)
  if (!fileUsable(ctx.active)) lost(`私有索引文件不再可用:${toPosix(ctx.active)}`)
}

/**
 * 共享索引视图(本次声明路径)的指纹:共享 index + 若存在的 index.lock 各取一次 ls-files -s。
 * 只取**本次路径**,不被别的会话正常的 staged 变化误伤。
 */
function captureSharedView(ctx, paths) {
  if (!ctx || ctx.mode !== 'private') return ''
  const clean = { ...process.env }
  delete clean.GIT_INDEX_FILE
  const lock = path.join(ctx.gitDir, 'index.lock')
  const parts = [
    `index:${runGitLs(ctx.cwd, clean, ['ls-files', '-s', '--', ...paths])}`,
    fs.existsSync(lock)
      ? `lock:${runGitLs(ctx.cwd, { ...clean, GIT_INDEX_FILE: lock }, ['ls-files', '-s', '--', ...paths])}`
      : 'lock:absent',
  ]
  return parts.join('\n')
}

/** 前后比对;不一致 = 有东西(典型是 lint-staged)把本次路径写进了共享索引视图。 */
function assertSharedViewUnchanged(ctx, paths, before) {
  if (!ctx || ctx.mode !== 'private') return { ok: true }
  const after = captureSharedView(ctx, paths)
  if (after === before) return { ok: true }
  return {
    ok: false,
    detail: `${LOST_PREFIX}:本次声明路径的条目出现在共享索引/index.lock 里(共享索引被写入)`,
    before,
    after,
  }
}

/** 给 lint-staged 子进程的 env:显式传指针 + 预载校验开关(NODE_OPTIONS 注入)。 */
function lintStagedEnv(ctx) {
  if (!ctx || ctx.mode !== 'private') return { ...process.env }
  const preload = toPosix(path.join(__dirname, 'index-context-preload.js'))
  const nodeOptions = [process.env.NODE_OPTIONS, `--require=${preload}`].filter(Boolean).join(' ')
  return {
    ...process.env,
    GIT_INDEX_FILE: ctx.active,
    IHUI_REQUIRE_PRIVATE_INDEX: '1',
    IHUI_EXPECTED_GIT_INDEX_FILE: ctx.active,
    NODE_OPTIONS: nodeOptions,
  }
}

/**
 * exit 阶段收尾:把副本回写父 git 的 `.lock`,再删副本。
 * 只在钩子整体成功(exitCode 为 0/未设置)时回写 —— 失败时父 git 会丢弃自己那份临时索引。
 */
function finalizeIndexContext(ctx, exitCode = process.exitCode) {
  if (!ctx || !ctx.created) return
  const okExit = exitCode === 0 || exitCode === undefined || exitCode === null
  try {
    if (okExit && fileUsable(ctx.active)) fs.copyFileSync(ctx.active, ctx.entry)
  } finally {
    try {
      fs.unlinkSync(ctx.active)
    } catch {
      /* 已被清理 */
    }
  }
}

/** 仅供测试:清掉模块级单例。 */
function resetIndexContextForTest() {
  CURRENT = null
}

module.exports = {
  LOST_PREFIX,
  ACTIVE_DIR_NAME,
  prepareIndexContext,
  assertIndexContext,
  captureSharedView,
  assertSharedViewUnchanged,
  lintStagedEnv,
  finalizeIndexContext,
  resetIndexContextForTest,
}
