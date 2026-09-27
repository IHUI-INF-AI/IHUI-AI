// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 对象空间落地 plumbing 的唯一实现(2026-09-27 立,工程工具收口票)。
 *
 * 成因(票面要求写进头注,这里只放共用层这份,各工具头注再放各自那半):
 * 主会话一轮交付 8 枚票,"对象空间落地"(临时 GIT_INDEX_FILE + hash-object + update-index +
 * write-tree + commit-tree + CAS update-ref)必须在共享工作区里做 —— 工作树副本常年滞后 HEAD,
 * 按 pathspec 交工作树就把别人已入库的行整批写回旧态(AGENTS §12 记过一夜三次自伤)。
 * 于是同一会话手写了 6 份近乎同形的落地脚本(land-r24 / reconcile-index / insert-live-doc /
 * append-eof / fix-runner-block / wire-gate-r24),全躺在 .ihui-agent/tmp/ 不受版本控制,
 * 且已经漂了三处(本票立项实测):
 *  ① 索引对齐判据:land-r24 判"索引==落地前 HEAD blob",reconcile-index 判"索引==父提交 blob" —— 同一条规矩两份实现;
 *  ② 零损失判据:wire-gate 用重复行计数当判据,把块内合法复用的 `  },` / 空串行误判成"凭空多出 1322 条",
 *     整块一次都没落地成功过,直到换成**结构等值**(new == 前缀 ⊕ 本块 ⊕ 后缀)才通过;
 *  ③ 字符串风格:wire-gate 用 JSON.stringify 生成块 ⇒ `id: "134"` 对一切按 `id: '(\d+)'` 解析注册表的判据
 *     (含守门 89 的撞号检测、也包括它自己的取号逻辑)隐身 —— 取号必须同时认单/双引号两种形态,产出一律单引号。
 * 这些工具不在仓里 = 下次会话要么带着同一个 bug 重新手写一遍,要么直接按 pathspec 交旧工作树。
 *
 * 本层只装 plumbing(派生传输 + blob 取数 + 临时索引提交 + CAS + 一份索引对齐判据);
 * 各工具自己的判据(锚点唯一性、取号规则、结构组装)刻意留在工具内 —— 不为了 DRY 把决策揉在一起。
 *
 * 纪律(与本仓既有共用层同规):
 *  - git 一律**绝对路径**候选解析(AGENTS §5b"git 调用不得依赖环境";复用 scripts/lib/gitdir.mjs 的 resolveGitBin,
 *    与 scripts/lib/face-reader.mjs 同一条兜底链,不再抄第三份候选表)。
 *  - 每次派生带 `-c safe.directory=*` + windowsHide:true + 数字 timeout + 64MB maxBuffer(守门 52 / 80 的口径)。
 *  - `git()` 默认剥 GIT_INDEX_FILE —— 临时索引只许调用方显式经 opts.env 挂入,绝不允许从 caller shell 漏进来
 *    (漏进来就会把"对齐共享主索引"写成别人的临时索引,或反之)。
 *  - 临时索引/临时内容文件一律落 scripts/lib/scratch-dir.mjs(§26 唯一夹具落点),不写 os.tmpdir()、不落仓库树内。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { resolveGitBin } from './gitdir.mjs'
import { mkScratch, rmScratch } from './scratch-dir.mjs'

const GIT_BIN = resolveGitBin() || 'git'
const DEFAULT_TIMEOUT_MS = 180_000
const GIT_MAX_BUFFER = 64 << 20
export const ABSENT = 'ABSENT'
export const UNKNOWN = 'UNKNOWN'

/** 把 execFileSync 失败压成一行可读文本(取第一行;不吞整个对象)。 */
function gitErrText(e) {
  const raw = e?.stderr ?? e?.message ?? String(e)
  return String(raw).split(/\r?\n/)[0]
}

/**
 * 统一 git 派生。opts:
 *  - root:工作树根(必传;本层不猜"调用方站在哪")
 *  - env:追加环境变量(如 GIT_INDEX_FILE;默认环境里 GIT_INDEX_FILE 已被剥掉)
 *  - allowFail:失败返回 null 而非抛(用于"取不到"分支)
 *  - raw:true ⇒ 不 trim(取 blob 正文时必须,否则吃掉文末换行)
 */
export function git(args, opts = {}) {
  const { root, env = {}, timeout = DEFAULT_TIMEOUT_MS, allowFail = false, raw = false } = opts
  if (!root) throw new Error('git() 必须显式传 root(不猜调用方位置)')
  const baseEnv = { ...process.env }
  delete baseEnv.GIT_INDEX_FILE
  const full = ['-c', 'safe.directory=*']
  if (process.platform === 'win32') full.push('-c', 'core.protectNTFS=false')
  full.push('-C', root, ...args)
  try {
    const out = execFileSync(GIT_BIN, full, {
      encoding: 'utf8',
      windowsHide: true,
      timeout,
      maxBuffer: GIT_MAX_BUFFER,
      env: { ...baseEnv, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return raw ? out : out.trim()
  } catch (e) {
    if (allowFail) return null
    throw new Error(`git ${args.join(' ')} 失败: ${gitErrText(e)}`)
  }
}

/** 某 ref 下路径的 blob oid;取不到(路径不在该提交/该提交不存在)= ABSENT。 */
export function headBlobOf(ref, path, { root }) {
  const out = git(['rev-parse', '--verify', '--quiet', `${ref}:${path}`], { root, allowFail: true })
  return out === null ? ABSENT : out
}

/** 共享主索引里路径的 blob;索引里没有 = ABSENT;git 问不到 = UNKNOWN(不冒充 ABSENT)。 */
export function indexBlobOf(path, { root }) {
  const line = git(['ls-files', '-s', '--', path], { root, allowFail: true })
  if (line === null) return UNKNOWN
  if (line === '') return ABSENT
  const oid = line.split(' ')[1]
  return oid || UNKNOWN
}

/** 把文本写成 blob(hash-object -w,经临时夹具文件),返回 oid。 */
export function writeBlob(text, { root }) {
  const dir = mkScratch('bypass-blob-')
  try {
    const f = join(dir, 'content')
    writeFileSync(f, text, { encoding: 'utf8' })
    return git(['hash-object', '-w', f], { root })
  } finally {
    rmScratch(dir)
  }
}

/** 把工作树某路径的当前字节写成 blob(落地器"以盘上内容为准"的那条通道)。 */
export function writeBlobOfWorktree(path, { root }) {
  return git(['hash-object', '-w', '--', path], { root })
}

/**
 * 临时索引提交:read-tree <baseRef> → 逐条 update-index --cacheinfo → write-tree → commit-tree。
 * 全程不触碰共享主索引、不触碰工作树(GIT_INDEX_FILE 只挂在本函数派生上)。
 * entries:[{path, blob}] 或 [{path, text}](text 走 writeBlob);也兼容单路径 {treePath, text|blob}。
 * 返回 { tree, commit, entries:[{path,blob}] }。
 */
export function commitTreeWithIndex({ root, parent, message, entries, treePath, text, blob, baseRef = 'HEAD', mode = '100644' }) {
  const list = entries
    ? entries.map((e) => ({ path: e.path, blob: e.blob ?? writeBlob(e.text, { root }), mode: e.mode ?? mode }))
    : [{ path: treePath, blob: blob ?? writeBlob(text, { root }), mode }]
  const dir = mkScratch('bypass-idx-')
  try {
    const idx = join(dir, 'index')
    const env = { GIT_INDEX_FILE: idx }
    git(['read-tree', baseRef], { root, env })
    for (const e of list) {
      git(['update-index', '--add', '--cacheinfo', `${e.mode},${e.blob},${e.path}`], { root, env })
    }
    const tree = git(['write-tree'], { root, env })
    const commit = git(['commit-tree', tree, '-p', parent, '-m', message], { root, env })
    return { tree, commit, entries: list.map((e) => ({ path: e.path, blob: e.blob })) }
  } finally {
    rmScratch(dir)
  }
}

/** HEAD 指向的完整 ref 名(detached ⇒ null;测试临时仓里分支名不固定,故现读而非写死 refs/heads/main)。 */
export function resolveHeadRef({ root }) {
  return git(['symbolic-ref', '-q', 'HEAD'], { root, allowFail: true })
}

/**
 * CAS update-ref:new 落盘且 old 仍是当前值 ⇒ true;old 已被别人推进 ⇒ false(调用方重读 HEAD 重试);
 * 其余失败(锁住 gitdir / ref 非法)照抛 —— 那是"跑不动",不是"抢输了"。
 */
export function casUpdateRef(newSha, oldSha, { root, ref }) {
  const target = ref ?? resolveHeadRef({ root })
  if (!target) throw new Error('HEAD 处于 detached 状态 ⇒ 无法 CAS,拒绝盲写')
  try {
    git(['update-ref', target, newSha, oldSha], { root })
    return true
  } catch (e) {
    const t = gitErrText(e)
    if (/cannot lock ref|old value|but expected|was no longer expected/i.test(t)) return false
    throw e
  }
}

/** 行级结构等值(零损失判据的原子比较)。 */
export function sameLines(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((l, i) => l === b[i])
}

/** 同步等待(不派生控制台程序;reconcile-index 旧版用 cmd timeout 等待,在守门 52 的射程里)。 */
export function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function indexLockPath({ root }) {
  const gd = git(['rev-parse', '--git-dir'], { root })
  return join(resolve(root, gd), 'index.lock')
}

/**
 * 把共享主索引逐路径对齐到新 blob。**只有一条实现**(land-r24 与 reconcile-index 曾各写一份并漂开):
 * 动某路径 ⇔ 索引里没有它,或索引 blob == **父提交**(= 本次 CAS 的旧值那一枚提交)在该路径的 blob。
 * 两者都不成立 ⇒ 别人已真暂存 ⇒ 一律不动并点名"归属他人"。锁在位时按轮等待;锁龄超上限不代删。
 * 返回 { moved, already, skipped:[{path,reason}], undetermined:[{path,reason}], lockAbandoned, failed }。
 */
export function alignSharedIndex({
  root,
  paths,
  parentRef,
  rounds = 20,
  waitMs = 6_000,
  lockMaxAgeMs = 120_000,
}) {
  const lock = indexLockPath({ root })
  for (let round = 1; round <= rounds; round++) {
    if (existsSync(lock)) {
      let age = 0
      try {
        age = Date.now() - statSync(lock).mtimeMs
      } catch {
        /* 锁刚被释放,下一轮重判 */
      }
      if (age > lockMaxAgeMs) {
        return { moved: 0, already: 0, skipped: [], undetermined: [], lockAbandoned: true, failed: false }
      }
      sleepMs(waitMs)
      continue
    }
    const moved = []
    const already = []
    const skipped = []
    const undetermined = []
    try {
      for (const p of paths) {
        const want = headBlobOf('HEAD', p, { root })
        if (want === ABSENT) {
          undetermined.push({ path: p, reason: 'HEAD 里没有这条 ⇒ 无法对齐,先核对提交面' })
          continue
        }
        const cur = indexBlobOf(p, { root })
        if (cur === UNKNOWN) {
          undetermined.push({ path: p, reason: '索引问不到(git 不可达)' })
          continue
        }
        if (cur === want) {
          already.push(p)
          continue
        }
        const parentBlob = headBlobOf(parentRef, p, { root })
        if (cur === ABSENT || cur === parentBlob) {
          git(['update-index', '--add', '--cacheinfo', `100644,${want},${p}`], { root })
          moved.push(p)
        } else {
          skipped.push({
            path: p,
            reason: `索引=${String(cur).slice(0, 9)} ≠ 父提交态 ⇒ 别人已暂存,归属他人,不动`,
          })
        }
      }
      return { moved, already, skipped, undetermined, lockAbandoned: false, failed: false }
    } catch (e) {
      if (round === rounds) {
        return {
          moved: [], already: [], skipped: [], undetermined: [],
          lockAbandoned: false, failed: true, error: gitErrText(e),
        }
      }
      sleepMs(waitMs)
    }
  }
  return { moved: 0, already: 0, skipped: [], undetermined: [], lockAbandoned: false, failed: true, error: '轮次耗尽' }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
