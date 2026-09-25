// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 判定面取材的共用底层(2026-09-25 立)。
 *
 * 为什么要有这一层:守门 70/77/83/91/94/98/100/101 全都收敛到同一口径 ——
 * 「全量判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 只作人工逃生舱」。
 * 但实现此前一人一份(94 / 101 / 91 各写过一个 `makeFaceReader`),而**易错的部分恰好是同一批**:
 *
 *   1. git 二进制必须是**绝对路径**。GUI 宿主 / LocalSystem 服务账户的 PATH 与交互终端不通
 *      (AGENTS §5b"git 调用不得依赖环境")。实测三格里只有一格当初写对了,
 *      守门 80 只查 `timeout` 不查裸 `'git'`,所以这条**没有任何门会红** —— 只能靠单一实现兜住。
 *   2. `cat-file --batch` 的 `stdio[0]` 必须是 `pipe`。设成 `'ignore'` 会让 git 读到空输入,
 *      于是每个 rev 都"取不到"—— 一个环境问题伪装成业务结论(守门 101 真仓自验时踩过)。
 *   3. 逐文件派生 git 在真仓是上千次进程创建(§5b fork 风暴同型),所以必须**一次 batch 读完一批**,
 *      且 `read()` 遇到未预取的路径要**抛**而不是偷偷补一次派生 —— 否则退化被掩盖成正常。
 *   4. 仓库根比较要先穿 junction。本机 DevEnv 系改道(§26)使同一目录有两个字面写法,
 *      只比 `path.resolve` 会把正常仓判成"基准错位"。
 *   5. `maxBuffer` 必须给足:真仓语言包单文件已实测 1,080,001 字节,默认 1MB 会被截成"读不出/仓库坏了"。
 *
 * 本层**只提供原语**,不规定各门的对外 API(94 要 `{relPath,lang}`、101 要 `has/listDir`、
 * 91 要 `.tsx` 枚举)—— 强行统一对外形状会让三门的镜像测试一起改语义,那是重构事故不是收口。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'

import { resolveGitBin } from './gitdir.mjs'

export const FACES = ['staged', 'head', 'worktree']

export const FACE_LABEL = {
  staged: '索引 blob(git show :<path>)',
  head: 'HEAD blob(git show HEAD:<path>)',
  worktree: '工作树(磁盘)',
}

/** 各面的"为什么"。写进结论行,免得下一个人把某一面当成偷懒。 */
export const FACE_NOTE = {
  staged: '盘上随后改对不算修好:提交进去的仍是索引这一份',
  head: '不判滞后的共享工作树(与守门 70/77/83/98 同口径)',
  worktree: '人工排查逃生舱:盘上内容可能属于并行会话的半编辑态,不得作为提交门禁',
}

/** 判据取不到输入时抛它 —— 调用方折成 exit 2「无法判定」,既不冒红也绝不记绿。 */
export class Undetermined extends Error {}

const GIT = resolveGitBin() || 'git'
const GIT_TIMEOUT = 60000
const BATCH_TIMEOUT = 120000
/** 64MB:真仓单文件最大已实测 >1MB,默认 1MB 会把大 blob 截成"取不到" */
const GIT_MAX_BUFFER = 64 << 20
const HASH_RE = /^([0-9a-f]{40}) blob (\d+)$/

export function gitBinary() {
  return GIT
}

/**
 * 统一 git 派生:绝对路径 + safe.directory + quotepath(中文路径)+ windowsHide + 数字 timeout
 * + **显式 stdio**。
 *
 * ⚠️ stdio 必须显式接管:`execFileSync` 默认把子进程 stderr **直接透到父进程 stderr**
 * (实测:空仓里 `rev-parse --verify HEAD` 漏出 32 字节 `fatal: Needed a single revision`)。
 * 守门靠 stdout/stderr 做逐字基线比对与归因取证,漏一行就把"取数失败"混进判定输出里 ——
 * 而错误文本本来已在 `e.stderr` 内、由 gitErrText 收进 Undetermined 消息,不需要它再漏一遍。
 */
export function gitRaw(args, root, opts = {}) {
  // stdio[0] 分两态:不带 input 时 'ignore'(继承会挂),带 input 时**必须** 'pipe' ——
  // 这正是 `cat-file --batch` / `hash-object --stdin-paths` 那一族的老陷阱:stdio[0] 设成
  // 'ignore' 时喂进去的清单被丢弃,而 git 不报错,只是"每个对象都取不到"。
  // 两态都写死,不给调用方留"顺手删掉 stdio"的空间。
  const stdio = opts.input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe']
  try {
    return execFileSync(
      GIT,
      ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', root, ...args],
      {
        cwd: root,
        encoding: opts.binary ? 'buffer' : 'utf8',
        windowsHide: true,
        timeout: opts.timeout ?? GIT_TIMEOUT,
        maxBuffer: opts.maxBuffer ?? GIT_MAX_BUFFER,
        stdio,
        ...(opts.input === undefined ? {} : { input: opts.input }),
      },
    )
  } catch (e) {
    const err = new Undetermined(`git ${args[0]} 失败: ${gitErrText(e)}`)
    // **退出码必须带上来**:`git grep` 无命中、`git diff --quiet` 无差异这类是 git 的正常非零结论,
    // 调用方要能区分"git 说没有"与"git 没跑成"。只给一句错误文本会逼调用方去 parse 自己的异常消息
    // (把结论建立在字符串上),而 e.status 是 Node 直接给的机器事实。
    if (typeof e?.status === 'number') err.status = e.status
    throw err
  }
}

/**
 * 一次 `cat-file --batch-check` 问一批对象的存在性(只回 sha/type/size,不回内容)。
 * 与 `catBatch` 同族的陷阱,所以在同一处收口:rev 清单靠 `stdio[0]='pipe'` 喂进去、
 * maxBuffer 给足、windowsHide、数字 timeout。
 * @returns {{missing:Set<string>, total:number}} 读不到的行一律不计 missing(宁漏不误伤推送)
 */
export function catBatchCheck(root, oids) {
  const list = [...new Set(oids)].filter((s) => /^[0-9a-f]{7,40}$/i.test(s))
  if (list.length === 0) return { missing: new Set(), total: 0 }
  let out
  try {
    out = execFileSync(GIT, ['-c', 'safe.directory=*', '-C', root, 'cat-file', '--batch-check'], {
      input: Buffer.from(list.join('\n') + '\n', 'utf8'),
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: GIT_MAX_BUFFER,
      timeout: BATCH_TIMEOUT,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (e) {
    throw new Undetermined(
      `git cat-file --batch-check 失败(${list.length} 个对象): ${gitErrText(e)}`,
    )
  }
  const missing = new Set()
  for (const line of String(out).split(/\r?\n/)) {
    if (!/\bmissing\b/.test(line)) continue
    const head = line.split(' ')[0]
    if (head) missing.add(head)
  }
  return { missing, total: list.length }
}

/**
 * 一次 `cat-file --batch-check` 把一批**任意对象规格**解成 oid(不是内容)。
 * 与 `catBatchCheck` 的分工:那个只答"哪些不存在"(给推送前的存活预检用),本出口答
 * "`<rev>:<path>` / `<oid>^{tree}` 各是什么 oid"(比较 blob sha 的判据要用,如守门 84)。
 * 所以本出口**不做** hex-only 过滤 —— 那会把 `<oid>^{tree}` 这类合法规格整型丢掉。
 *
 * 输出与输入**按行对齐**,所以直接按索引回填;`missing` 与空行都归 null(交调用方判"取不到")。
 * @returns {Map<string, string|null>}
 */
export function catBatchOids(root, specs, opts = {}) {
  const map = new Map()
  const list = [...specs]
  if (list.length === 0) return map
  let out
  try {
    out = execFileSync(GIT, ['-c', 'safe.directory=*', '-C', root, 'cat-file', '--batch-check'], {
      cwd: root,
      input: Buffer.from(list.join('\n') + '\n', 'utf8'),
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: opts.maxBuffer ?? GIT_MAX_BUFFER,
      timeout: opts.timeout ?? BATCH_TIMEOUT,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (e) {
    throw new Undetermined(
      `git cat-file --batch-check 失败(${list.length} 个规格),${root} 的判定面无法取材: ${gitErrText(e)}`,
    )
  }
  const lines = String(out).split('\n')
  list.forEach((spec, i) => {
    const line = (lines[i] || '').trim()
    // `--batch-check` 对**不存在**的规格回的是 `<原规格> missing`(整行只写 missing 的是裸 oid 形态),
    // 所以两种都要归 null。只判 `=== 'missing'` 会把规格原文当成 oid 返回 —— 那是一个
    // "看起来有值、永远不相等"的第三种状态,守门 84 的旧实现正好一直处在这一状态(它比较的是
    // sha,取到规格串与取到 null 结果相同,故实测无行为差;新出口按正确的判序写)。
    if (!line || line === 'missing' || /\smissing$/.test(line)) {
      map.set(spec, null)
      return
    }
    map.set(spec, line.split(' ')[0])
  })
  return map
}

export function gitErrText(e) {
  const raw = e?.stderr ?? e?.stdout ?? e?.message ?? String(e)
  const text = String(typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8')).trim()
  return text.split(/\r?\n/)[0] || '(git 无输出)'
}

/**
 * 一次 `cat-file --batch` 读完一批对象。返回 `Map<rev, text|null>`;
 * missing / unmerged / 非 blob 一律 null,由调用方判"取不到"(本层不代替业务结论)。
 *
 * `opts.maxBuffer` 是给"整仓 HEAD blob 一次读完"那类门留的口子:默认 64MB 够绝大多数,
 * 但门 98/103 一次要读 8000+ 源文件 ≈ 85-89MB。缺口不设口子时,超限的表现是
 * **整批改写成"每个 rev 都取不到"** —— 那会被下游读成"没有违规",是一道假绿。
 * 所以超限必须抛(下面的 Undetermined),不能静默降级。
 */
/**
 * `cat-file --batch` 的头解析(纯函数,与派生分开,这样"截断"那条分支能被构造出来测)。
 * 抽出来之前它埋在 `catBatch` 里,而截断需要"git 少写字节但不报错"这种真实管道事故才能触发 ——
 * 于是这条分支从来没有被证明过有牙。判据分支不可构造 = 判据未被验证。
 * @returns {Map<string,string|null>}
 */
export function parseBatch(out, revs) {
  const map = new Map()
  let pos = 0
  for (let i = 0; i < revs.length; i++) {
    const rev = revs[i]
    const nl = out.indexOf(0x0a, pos)
    if (nl < 0) {
      // **输出被截断 ≠ 对象不存在**。git 对每一条输入都会写一条头,所以在读完 revs 之前
      // 拿不到下一行,只可能是管道断了(maxBuffer 命中 / Windows 侧写失败)。
      // 旧写法 `set(rev,null) + break` 有两个后果:① 当前这条被当成"取不到";② **后面的 rev 根本没进 Map**,
      // 于是调用方 `.get()` 拿到 `undefined`,凡是"取不到就 continue"的判据都从此**静默少扫** ——
      // 少扫不红,是一道假绿。守门 93 早就在自己那份实现里修过这件事(注释还在),
      // 而收口成一层之后,这个正确行为必须由层统一提供,否则每道门各修一遍、各漏一遍。
      for (let k = i; k < revs.length; k++) map.set(revs[k], null)
      throw new Undetermined(
        `cat-file --batch 输出在第 ${i}/${revs.length} 个对象处截断 ⇒ 无法判定(不是"没有违规",是"没看完")`,
      )
    }
    const header = out.subarray(pos, nl).toString('utf8')
    pos = nl + 1
    const m = HASH_RE.exec(header)
    if (!m) {
      map.set(rev, null) // "<rev>:<path> missing" / "fatal: ... is unmerged"
      continue
    }
    const size = Number(m[2])
    map.set(rev, out.subarray(pos, pos + size).toString('utf8'))
    pos += size + 1
  }
  return map
}

export function catBatch(root, revs, opts = {}) {
  if (revs.length === 0) return new Map()
  let out
  try {
    out = execFileSync(GIT, ['-c', 'safe.directory=*', '-C', root, 'cat-file', '--batch'], {
      cwd: root,
      input: Buffer.from(revs.join('\n') + '\n', 'utf8'),
      windowsHide: true,
      maxBuffer: opts.maxBuffer ?? GIT_MAX_BUFFER,
      timeout: opts.timeout ?? BATCH_TIMEOUT,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (e) {
    throw new Undetermined(`git cat-file --batch 失败,${root} 的判定面无法取材: ${gitErrText(e)}`)
  }
  return parseBatch(out, revs)
}

/**
 * 同一个目录吗 —— 先各自 realpath 穿过 junction / 符号链接,再按平台大小写敏感性比。
 * §26 的改道机制使 `D:\DevEnv\...` 与 junction 旧路径指向同一实体,只比字面路径会误判。
 */
export function sameDir(a, b) {
  const norm = (p) => {
    let real = p
    try {
      real = realpathSync(p)
    } catch {
      /* 目标不存在时退回原路径,让调用方去点名它 */
    }
    const resolved = path.resolve(real)
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved
  }
  return norm(a) === norm(b)
}

/**
 * 判定面的相对基准必须是仓库根。root 若是仓库**子目录**,`ls-tree` 的路径与 `join(root, rel)`
 * 就会错位 —— 那正好产出门最不该产出的东西:看起来自洽、实则混面的绿。故判死,不静默容忍。
 */
export function assertRepoRoot(root, label) {
  const top = gitRaw(['rev-parse', '--show-toplevel'], root).trim()
  if (top && !sameDir(top, root)) {
    throw new Undetermined(`${label} 的 ROOT(${root})不是仓库根(${top}),两基准会错位`)
  }
  return top
}

/**
 * 从 argv 选面。三门共用这一条,免得某道门悄悄少一个面。
 * 两个面旗同给 = 自相矛盾,返回 error 让调用方判死(取哪一面都会让另一面成为假绿)。
 * @returns {{face:string, error:string|null}}
 */
export function selectFace({ staged, worktree, def = 'head' }) {
  if (staged && worktree) {
    return { face: null, error: '--staged 与 --worktree 不得同用(两个判定面互斥)' }
  }
  if (staged) return { face: 'staged', error: null }
  if (worktree) return { face: 'worktree', error: null }
  return { face: def, error: null }
}

/**
 * 磁盘面读单文件。目录里不存在 → null(由调用方决定"少扫一个"算不算红);
 * 读失败**原样抛** —— 一个编码/权限错误不得伪装成"该文件不存在"的业务结论。
 */
export function readWorktreeFile(root, rel) {
  const abs = path.join(root, rel)
  if (!existsSync(abs)) return null
  let text
  try {
    text = readFileSync(abs, 'utf8')
  } catch (e) {
    throw new Undetermined(`${FACE_LABEL.worktree} 取不到 ${rel}: ${e.message}`)
  }
  return text.includes('\u0000') ? null : text
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
