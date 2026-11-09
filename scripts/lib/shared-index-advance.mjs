// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 私有索引提交的**唯一后置步骤**:把本次声明路径在共享索引里推进到新提交树。
 *
 * 病灶(2026-11-04 实测):裸 `GIT_INDEX_FILE=<私有索引> git commit` 只推进 HEAD,不推进
 * 仓库默认索引 ⇒ 提交后本席路径在共享索引里停在父树,`git status` 呈 `MM`;谁下一条裸
 * `git commit` 就会把这些旧 blob 带回去(本仓「已删件复活 / 半成品被夹带回滚」的同一个根)。
 * `isolated-git.mjs` 的 `advanceSharedIndexPaths` 早已有这条后置动作,但**只有它自己有**:
 * 其它私有索引通道(`commit-with-private-index.mjs`、`git-private-index-commit.sh`)都没有,
 * 于是同一坑在别的通道上原样存在。本模块把该后置动作抽成唯一实现,供全部通道调用。
 *
 * 三个硬约束(与 `isolated-git.mjs` 的实现同口径,红线 C):
 *   ① 只推进 `paths`(本席声明集);别的条目一个字节不改 —— 做法是**复制**共享索引到临时
 *      文件,只在副本上 `update-index`,再原子 rename 回去;
 *   ② 拿不到 `.git/index.lock`(`openSync(lock,'wx')` 抛 EEXIST)⇒ **原样不动**并如实报
 *      "锁被占",绝不硬闯别人正在写的窗口;
 *   ③ 同一路径若在他席窗口内已被改过(调用方给了 `expectBefore` 且现值与它不符)⇒ 跳过并
 *      报数,不覆盖别人的条目。
 *
 * 失败方向:任何一步失败 ⇒ 共享索引原样不动、返回 `ok:false`,由下一条 `safe-commit` 自愈
 * (绝不因为"后置步骤失败"把已落地的提交判红)。
 */
import { randomBytes } from 'node:crypto'
import { closeSync, existsSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { batchExecFileSync, gitBinary } from './face-reader.mjs'

/** 仓根由脚本自身位置推导,禁 `process.cwd()` 定根(AGENTS §15)。 */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * 派生 env 分两态(2026-11-04 修):
 *   - **共享索引**那几次(`rev-parse`/`ls-tree`/只读检查)必须剥掉 `GIT_INDEX_FILE`,
 *     否则若调用方自己正处在私有索引里,读到的就不是共享面;
 *   - **私有索引**那几次(`ls-files` 读副本、`update-index` 写副本)必须**显式带上**
 *     `GIT_INDEX_FILE`,否则 `update-index` 会直接写进共享索引 —— 绕开"复制→改副本→
 *     rename"整个结构(这条是首版实现里的真错,已由下面的 `stageEnv` 显式构造纠正)。
 */
export function cleanGitEnv(baseEnv = process.env) {
  const e = { ...baseEnv }
  delete e.GIT_INDEX_FILE
  delete e.GIT_DIR
  delete e.GIT_WORK_TREE
  delete e.GIT_OBJECT_DIRECTORY
  delete e.GIT_ALTERNATE_OBJECT_DIRECTORIES
  delete e.GIT_QUARANTINE_PATH
  return e
}

/** 一次派生 git:显式接管 stdio(不写则本机 spawnSync EBUSY),失败折成 {status,stderr}。
 *  缺省 env = **剥掉 GIT_INDEX_FILE 的那一份** —— 本模块的缺省对象是共享索引;私有索引的
 *  那几次由调用点显式传 `env`(见 `stageEnv` / `readIndexSignatures`)。 */
function git(args, { cwd = ROOT, env = cleanGitEnv() } = {}) {
  const argv = ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', cwd, ...args]
  try {
    const out = batchExecFileSync(gitBinary() || 'git', argv, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 300_000,
      maxBuffer: 1 << 28,
      ...(env ? { env } : {}),
    })
    return { status: 0, stdout: String(out ?? ''), stderr: '' }
  } catch (e) {
    return {
      status: typeof e?.status === 'number' ? e.status : 1,
      stdout: String(e?.stdout ?? ''),
      stderr: String(e?.stderr ?? e?.message ?? e),
    }
  }
}

function parseLsFilesZ(text) {
  const map = new Map()
  for (const rec of String(text ?? '').split('\u0000')) {
    if (!rec) continue
    const tab = rec.indexOf('\t')
    if (tab < 0) continue
    const meta = rec.slice(0, tab).trim().split(/\s+/)
    if (meta.length < 3) continue
    map.set(rec.slice(tab + 1).replace(/\\/g, '/'), `${meta[0]} ${meta[1]} ${meta[2]}`)
  }
  return map
}

/**
 * 读**某份索引**(由 caller 指定)里声明路径的签名。
 * ⚠️ 空路径集必须直接返回空,不能落成 `git ls-files -s -z --`:git 的空 pathspec 会列举
 * **整个索引**(本仓 18,983 条 / 1.87MB,默认 maxBuffer 贴线 —— 与 isolated-git 同一坑)。
 */
function readIndexSignatures({ gitCwd, indexPath, paths }) {
  if (!paths.length) return new Map()
  const env = { ...cleanGitEnv(), GIT_INDEX_FILE: indexPath }
  const r = git(['ls-files', '-s', '-z', '--'].concat(paths), { cwd: gitCwd, env })
  if (r.status !== 0) throw new Error((r.stderr || 'ls-files 失败').trim())
  return parseLsFilesZ(r.stdout)
}

/** 签名归一:允许调用方直接塞 `git ls-files -s` 的整行(`${mode} ${blob} ${stage}\t${path}`)。 */
function normSig(v) {
  const t = String(v ?? '').split('\t')[0].trim().split(/\s+/)
  return t.length >= 3 ? `${t[0]} ${t[1]} ${t[2]}` : ''
}

/**
 * 某枚提交里声明路径的签名表(`<mode> <blob> 0`),供调用方作 `expectBefore`。
 *
 * 语义要点(**红线 C 的正确基线**):期望值取自**父提交的树**,不是"提交那一刻共享索引的现值"。
 * 后者有一个致命洞:别席若在我提交前就已 staged 同一路径,他的条目会成为我的"期望值",
 * 后置推进于是把**他的暂存内容**当成"没动过"直接覆盖掉。以父树为基线时,凡是与父树不一致的
 * 共享索引条目(无论是谁暂存的)一律判冲突 ⇒ 只报数不覆盖。
 */
export function treeSignatures({ gitCwd = ROOT, sha, paths } = {}) {
  const declared = [...new Set((paths || []).map((p) => String(p).replace(/\\/g, '/').trim()).filter(Boolean))]
  if (!declared.length || !sha) return new Map()
  const r = git(['ls-tree', '-r', '-z', '--full-tree', sha, '--'].concat(declared), { cwd: gitCwd })
  if (r.status !== 0) return new Map()
  const out = new Map()
  for (const rec of String(r.stdout || '').split('\u0000')) {
    if (!rec) continue
    const tab = rec.indexOf('\t')
    if (tab < 0) continue
    const meta = rec.slice(0, tab).trim().split(/\s+/)
    if (meta.length < 3 || meta[1] !== 'blob') continue
    out.set(rec.slice(tab + 1).replace(/\\/g, '/'), `${meta[0]} ${meta[2]} 0`)
  }
  return out
}

/**
 * @param {object} o
 * @param {string} o.committedSha  已落地的新提交
 * @param {string[]} o.paths       本席声明路径(只有这些会被推进)
 * @param {string} [o.gitCwd]      仓库工作树根(默认脚本自身推导的仓根)
 * @param {string} [o.gitDir]      gitdir(默认 `rev-parse --absolute-git-dir`)
 * @param {Map<string,string>} [o.expectBefore] 提交前共享索引里这些路径的签名;
 *        给了就按红线 C 判"他席是否在我窗口内动过同一路径"
 * @returns {{ok:boolean, advanced:string[], removed:string[], skipped:string[], reason?:string}}
 */
export function advanceSharedIndexPaths({
  gitCwd = ROOT,
  gitDir,
  committedSha,
  paths,
  expectBefore,
  log = console,
} = {}) {
  const declared = [...new Set((paths || []).map((p) => String(p).replace(/\\/g, '/').trim()).filter(Boolean))]
  if (!declared.length || !committedSha) return { ok: false, advanced: [], removed: [], skipped: [], reason: 'empty' }
  const expect = expectBefore
    ? new Map(
        [...expectBefore]
          .map(([k, v]) => [String(k).replace(/\\/g, '/').trim(), normSig(v)])
          .filter(([, v]) => v),
      )
    : null

  if (!gitDir) {
    const r = git(['rev-parse', '--absolute-git-dir'], { cwd: gitCwd })
    if (r.status !== 0) return { ok: false, advanced: [], removed: [], skipped: [], reason: 'no-gitdir' }
    gitDir = String(r.stdout || '').trim()
  }
  const sharedIndex = join(gitDir, 'index')
  if (!existsSync(sharedIndex)) return { ok: false, advanced: [], removed: [], skipped: [], reason: 'no-index' }

  const lock = join(gitDir, 'index.lock')
  let fd
  try {
    fd = openSync(lock, 'wx')
  } catch (e) {
    // 红线 C:别人正在写 ⇒ 只报数不覆盖,绝不清别人的 lock
    log.warn?.(`共享索引推进跳过:index.lock 被占用(${e?.code ?? e}) —— 只报数,不覆盖他席条目`)
    return { ok: false, advanced: [], removed: [], skipped: declared, reason: 'locked' }
  }

  let staging = null
  try {
    closeSync(fd)
    // 复制后**只改副本**:共享索引本身直到 rename 那一刻一个字节未动
    staging = `${sharedIndex}.${process.pid}-${randomBytes(4).toString('hex')}.tmp`
    writeFileSync(staging, readFileSync(sharedIndex))

    // 新提交树里声明路径的条目(删除的路径不会有条目 ⇒ 走 force-remove)
    const tree = git(['ls-tree', '-r', '-z', '--full-tree', committedSha, '--'].concat(declared), { cwd: gitCwd })
    if (tree.status !== 0) throw new Error((tree.stderr || 'ls-tree 失败').trim())
    const recs = new Map()
    for (const rec of String(tree.stdout || '').split('\u0000')) {
      if (!rec) continue
      const tab = rec.indexOf('\t')
      if (tab < 0) continue
      const meta = rec.slice(0, tab).trim().split(/\s+/)
      if (meta.length < 3 || meta[1] !== 'blob') continue
      recs.set(rec.slice(tab + 1).replace(/\\/g, '/'), { mode: meta[0], blob: meta[2] })
    }

    // 副本当前面(声明集 + 新树里声明目录展开出的文件,不是整个索引)
    const targets = [...new Set([...declared, ...recs.keys()])]
    const now = readIndexSignatures({ gitCwd, indexPath: staging, paths: targets })
    const stageEnv = { ...cleanGitEnv(), GIT_INDEX_FILE: staging }

    const advanced = []
    const removed = []
    const skipped = []
    const conflicted = (p, rec) => {
      if (!expect) return false
      const want = expect.get(p)
      // ① 父树里有这条 ⇒ 共享索引必须还停在父树版本;动过(不管是谁动的)就跳过
      if (want !== undefined) return now.get(p) !== want
      // ② 父树里没有(本席新增)⇒ 只要共享索引里那条**不是**我要落的版本,就当别人占着
      const cur = now.get(p)
      return !!cur && !!rec && cur !== `${rec.mode} ${rec.blob} 0`
    }

    for (const p of targets) {
      const rec = recs.get(p)
      if (!rec) {
        // 本次是删除:只有副本里确实还有这条才需要清,否则是无操作
        if (!now.has(p)) continue
        if (conflicted(p, null)) {
          skipped.push(p)
          continue
        }
        const up = git(['update-index', '--force-remove', '--', p], { cwd: gitCwd, env: stageEnv })
        if (up.status !== 0) throw new Error((up.stderr || 'update-index --force-remove 失败').trim())
        removed.push(p)
        continue
      }
      if (now.get(p) === `${rec.mode} ${rec.blob} 0`) continue // 已是新 blob,零写入
      if (conflicted(p, rec)) {
        skipped.push(p)
        continue
      }
      const up = git(['update-index', '--add', '--cacheinfo', `${rec.mode},${rec.blob},${p}`], {
        cwd: gitCwd,
        env: stageEnv,
      })
      if (up.status !== 0) throw new Error((up.stderr || 'update-index --cacheinfo 失败').trim())
      advanced.push(p)
    }

    if (skipped.length) {
      log.warn?.(`共享索引推进:${skipped.length} 条路径被他席在窗口内改动,已跳过不覆盖:${skipped.join(', ')}`)
    }
    if (!advanced.length && !removed.length) {
      return { ok: false, advanced, removed, skipped, reason: skipped.length ? 'all-skipped' : 'no-tree-entry' }
    }
    renameSync(staging, sharedIndex)
    staging = null
    return { ok: true, advanced, removed, skipped }
  } catch (e) {
    log.warn?.(`共享索引推进失败(不影响本次提交): ${e?.message ?? e}`)
    return { ok: false, advanced: [], removed: [], skipped: declared, reason: 'error' }
  } finally {
    try {
      unlinkSync(lock)
    } catch {
      /* rename 成功后 lock 已不存在 */
    }
    if (staging) {
      try {
        if (statSync(staging).isFile()) unlinkSync(staging)
      } catch {
        /* ignore */
      }
    }
  }
}

// ─── CLI(sh / ps1 站点的后置步骤)──────────────────────────────────────────────
// 用法:`node scripts/lib/shared-index-advance.mjs --sha <commit> --paths <a,b,c> [--cwd <仓库>] [--git-dir <dir>]`
// 供结构性走不了 isolated-git 的 shell 通道在 CAS 成功后调用。输出单行 JSON。
// 退出码:0 = 已推进 / 锁被占(只报数)/ 全部被他席跳过;1 = 其它失败(调用方据此留痕,但
// 不得把**已落地**的提交判红)。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2)
  const opt = (name, fallback = '') => {
    const i = argv.indexOf(`--${name}`)
    return i >= 0 ? argv[i + 1] : fallback
  }
  const sha = opt('sha')
  const gitCwd = opt('cwd') || ROOT
  const paths = opt('paths')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  // 缺省以**父提交树**为期望基线(红线 C):凡是共享索引里与父树不一致的条目一律判"别人占着",
  // 只报数不覆盖。root 提交(无父)则退化为不判窗口 —— caller 可用 --expect-sha 显式指定。
  let expectBefore
  const base = opt('expect-sha')
  const pr = base ? { status: 0, stdout: base } : git(['rev-parse', '--verify', `${sha}^`], { cwd: gitCwd })
  if (pr.status === 0) expectBefore = treeSignatures({ gitCwd, sha: String(pr.stdout).trim(), paths })
  const res = advanceSharedIndexPaths({
    gitCwd,
    committedSha: sha,
    paths,
    expectBefore,
    gitDir: opt('git-dir') || undefined,
    log: { warn: (s) => console.error(s) },
  })
  console.log(JSON.stringify(res))
  const soft = ['locked', 'all-skipped']
  process.exit(res.ok || soft.includes(res.reason) ? 0 : 1)
}
