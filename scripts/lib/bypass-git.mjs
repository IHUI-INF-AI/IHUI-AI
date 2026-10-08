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
 * G-816708(2026-10-05)起本层再装**第二条落地契约**:`landsLedger()` / `rerunLedgerHeal()` ——
 * 旁路落地(`commit-tree` + CAS)结构上不跑任何钩子,所以挂在 `.husky/post-commit` 第 6 节的
 * 守门 71 台账自愈对旁路落地**结构性失明**(台账被滞后副本写回时,门的全量档点名已入库的红,
 * 而同一分钟的自愈日志写着"无缺失,无需回捞")。判据必须在真跑它的那一刻才成立,否则等于没有
 * (§1 为 `git-sync-converge` 补"落合并提交后就地补跑一次自愈"是同一原则),所以每一台旁路落地器
 * 都要在 CAS 成功出口自己补跑一次。补跑的派生/措辞只在 `lib/post-merge-ledger-sync.mjs` 那一份,
 * 本层加的只是"这次落地是否含台账"那条触发条件与大声点名 —— 两台落地器各写一份条件必然漂开
 * (本文件头注那三条漂移实例之一正是"同一规矩两份实现")。
 *
 * 纪律(与本仓既有共用层同规):
 *  - git 一律**绝对路径**候选解析(AGENTS §5b"git 调用不得依赖环境";复用 scripts/lib/gitdir.mjs 的 resolveGitBin,
 *    与 scripts/lib/face-reader.mjs 同一条兜底链,不再抄第三份候选表)。
 *  - 每次派生带 `-c safe.directory=*` + windowsHide:true + 数字 timeout + 64MB maxBuffer(守门 52 / 80 的口径)。
 *  - `git()` 默认剥 GIT_INDEX_FILE —— 临时索引只许调用方显式经 opts.env 挂入,绝不允许从 caller shell 漏进来
 *    (漏进来就会把"对齐共享主索引"写成别人的临时索引,或反之)。
 *  - 临时索引/临时内容文件一律落 scripts/lib/scratch-dir.mjs(§26 唯一夹具落点),不写 os.tmpdir()、不落仓库树内。
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { resolveGitBin } from './gitdir.mjs'
import { mkScratch, rmScratch } from './scratch-dir.mjs'
// G-816708:旁路落地后补跑台账自愈的**唯一派生出口**(命令行形状、派生参数、失败臂措辞都在那一份里,
// 与 git-sync-converge / union-converge 用的是同一个器物 —— 不另发明第二套调用协议)。
import { postMergeLedgerSync } from './post-merge-ledger-sync.mjs'

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

/**
 * 祖先判定:a 是否被 b 包含(a === b 也算)。返回 true / false / null。
 *
 * 为什么要单列一个出口,而不是让调用方各自 `git merge-base --is-ancestor` 看退出码:
 * execFileSync 对**非零退出**一律抛错,而这条判据的三种结果各有各的含义 ——
 * 0 = 是祖先;1 = git 明确说不是;128 及其它 = 对象根本取不到(未判定)。
 * 用 allowFail 的二值通道会把"未判定"折叠成"不是祖先",于是"我推的那枚没上远端"
 * 与"仓库处于半恢复态、对象读不到"在账面上长得一模一样。null 一律交调用方明写。
 * 只读判据,不产生任何写操作。
 */
export function isAncestor(a, b, { root }) {
  if (!root) throw new Error('isAncestor() 必须显式传 root(不猜调用方位置)')
  if (!a || !b) return null
  const full = ['-c', 'safe.directory=*']
  if (process.platform === 'win32') full.push('-c', 'core.protectNTFS=false')
  let r
  try {
    r = spawnSync(GIT_BIN, [...full, '-C', root, 'merge-base', '--is-ancestor', a, b], {
      windowsHide: true,
      timeout: DEFAULT_TIMEOUT_MS,
      stdio: 'ignore',
      encoding: 'utf8',
    })
  } catch {
    return null
  }
  if (r.error || r.signal) return null
  if (r.status === 0) return true
  if (r.status === 1) return false
  return null
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
 * 提交身份随调用一起给,不依赖"当前环境配过 identity"。
 *
 * 实测两处同型故障:① union-converge 头注记的那一次 —— 收敛器由 IHUI-DEPLOYLOOP 以服务身份
 * (LocalSystem)后台发起,而 user.name/user.email 只配在交互账户的 .gitconfig 里,于是
 * `commit-tree` 直接 `fatal: unable to auto-detect email address`,收敛一次都没成功过;
 * ② 本层的镜像测试 T5/T6/T8/T10 在**没有 global identity 的干净 shell**里恒红
 * (`Author identity unknown`)—— 与 ① 同一个成因,只是发生在测试面,长期被读成"环境不好"。
 * 取值与本仓既有三处字面量同源(`scripts/git-rebuild-local.mjs` 的 init 配置、
 * `scripts/git-sync-converge.mjs` 与 `scripts/union-converge.mjs` 各自的 GIT_IDENTITY);
 * 那三处是本票之前各写各的存量,**迁移到本出口**属另一票(动别人的热路径文件要与其持有者错开)。
 */
export const REPO_GIT_IDENTITY_ARGS = ['-c', 'user.name=智汇AGI社区', '-c', 'user.email=ok502319984@gmail.com']

/**
 * 临时索引提交:read-tree <baseRef> → 逐条 update-index --cacheinfo → write-tree → commit-tree。
 * 全程不触碰共享主索引、不触碰工作树(GIT_INDEX_FILE 只挂在本函数派生上)。
 * entries:[{path, blob}] 或 [{path, text}](text 走 writeBlob);也兼容单路径 {treePath, text|blob}。
 * 返回 { tree, commit, entries:[{path,blob}] };传 onTree 时另可返回 { rejected }。
 *
 * onTree(tree) ⇒ 在 commit-tree **之前**拿树做校验的钩子(G-815985)。返回非空字符串即放弃提交,
 *   返回 { tree, commit: '', entries, rejected: <该字符串> }。放这里的理由是硬性的:
 *   若先 commit-tree 再校验,被拒的那枚就成了 unreachable commit —— 守门 30a 只看
 *   `git fsck --unreachable` 里的 `unreachable commit` 行,于是"一次被拦的落地"会给全仓
 *   埋一颗"下次提交必须先把这枚悬空 commit 备份成 tag"的地雷。树/blob 不在它的判据面内。
 */
export function commitTreeWithIndex({ root, parent, message, entries, treePath, text, blob, baseRef = 'HEAD', mode = '100644', onTree }) {
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
    if (typeof onTree === 'function') {
      const rejected = onTree(tree)
      if (typeof rejected === 'string' && rejected !== '') {
        // 只留下 unreachable tree/blob(30a 不判这两类),不产生任何 commit 对象。
        return { tree, commit: '', entries: list.map((e) => ({ path: e.path, blob: e.blob })), rejected }
      }
    }
    const commit = git([...REPO_GIT_IDENTITY_ARGS, 'commit-tree', tree, '-p', parent, '-m', message], { root, env })
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
 * **删除与改动同判据**:新 HEAD 里没有这条路径时,"索引==父提交态"就清掉索引里的残留(不留 `D ` 幽灵,
 * 否则任何人一次不带 pathspec 的提交会把刚删的文件加回 HEAD —— 本仓一枚孤儿组件因此连着复活四次);
 * "索引里没有"算已就位;"索引≠父提交态"仍归他人不动。
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
        const cur = indexBlobOf(p, { root })
        if (want === ABSENT) {
          // 本次提交把这条路径**删掉**了 ⇒ 索引里也不该再留着它。
          // 判据与"改动"档同形,不是另立一套:索引没有 ⇒ 已就位;索引==父提交态 ⇒ 是本次删除的残留,清掉;
          // 否则别人真暂存过 ⇒ 归属他人,一律不动。
          // 为什么不能像旧版那样一句"HEAD 里没有这条 ⇒ 无法对齐"就放过:那会让索引留着旧 blob、
          // `git status` 显一条 `D `,此后任何人一次不带 pathspec 的普通提交就把刚删的死文件**加回 HEAD**
          // —— 本仓一枚孤儿组件被这样连着复活四次(2026-09-27 至 09-28),而每次复活都让引用它的
          // 语言包判据红在干净 HEAD 上(恒红门 ⇒ 各会话被逼跳门 ⇒ 全部守门作废)。
          if (cur === UNKNOWN) {
            undetermined.push({ path: p, reason: '索引问不到(git 不可达) ⇒ 删除残留无从判定' })
            continue
          }
          if (cur === ABSENT) {
            already.push(p)
            continue
          }
          const parentBlobForDelete = headBlobOf(parentRef, p, { root })
          if (cur === parentBlobForDelete) {
            git(['update-index', '--force-remove', '--', p], { root })
            moved.push(p)
          } else {
            skipped.push({
              path: p,
              reason: `索引=${String(cur).slice(0, 9)} ≠ 父提交态 ⇒ 别人已暂存,归属他人,不代删`,
            })
          }
          continue
        }
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

/**
 * 台账的仓库相对路径(逐字比较)。git 的 pathspec 是大小写敏感的规范名,落地器声明的也是它,
 * 所以这里不做大小写折叠 —— 折叠会把 `project_plan.md`(另一个仓里的同名文件)也算成台账。
 */
export const LEDGER_DOC = 'PROJECT_PLAN.md'

/**
 * 这次落地的路径里有没有台账?只判**声明的落地面**,不判"消息里提到了它"(LAND_MSG / LIVE_MSG 是
 * 提交信息文本,不是路径 —— 本仓为这一格踩过取证坑)。分隔符与 `./` 前缀归一是唯一的形态处理。
 */
export function landsLedger(paths) {
  const norm = (p) =>
    String(p ?? '')
      .replace(/\\/g, '/')
      .replace(/^\.\//, '')
  return (Array.isArray(paths) ? paths : []).some((p) => norm(p) === LEDGER_DOC)
}

/**
 * G-816708:旁路落地器在 CAS 成功出口**就地补跑一次台账自愈**。
 *
 * 为什么必须由落地器自己跑:钩子对 `commit-tree` 那一族结构性不跑 ⇒ 自愈挂在 `.husky/post-commit`
 * 就等于对旁路落地永不触发;而"账面读起来像每轮都跑过、什么都没缺"正是本票的成因。
 *
 * 用**提交档**(`--heal --commit`)而不是报告档,一行理由:这一跑是**钩子的替身**,替身必须与原件
 * 同形 —— 原件(`.husky/post-commit` 第 6 节)跑的就是 `--heal --commit`,只给报告档等于把
 * "回补"留给下一个人(plan-union-merge 那条先例写的就是这句),而旁路落地缺的恰恰是已入库那一档。
 *
 * **不成环**(票面硬要求,三条都是既有事实而不是新造的旗):
 *  ① 恢复提交由 `commit-tree` + `update-ref` 产生 ⇒ 钩子结构性不跑 ⇒ 永远不会回调本落地器;
 *  ② 幂等判据已在生产侧:该档只在 HEAD 真的缺登记行时才建提交,补完后再扫一次即
 *     "无缺失,无需回捞"(`heal()` 的 `headMissing.length === 0` 那一支),故严格收敛、不会自激;
 *  ③ 规模安全闸(>40% 判基线异常)拒绝写盘并返回 1 ⇒ 异常形态只会喊,不会连着产提交。
 * 紧急旗沿用**既有**那一个:`HUSKY_SKIP_PLAN_HEAL=1` 由 `.husky/post-commit` 读;本器刻意**不**读它 ——
 *  给落地器同一个逃生舱等于把本票要闭的那个洞重新开一条(旁路落地不跑钩子,那面旗在钩子里才有意义)。
 *
 * 谁在调用本出口(逐台点名,少一台就是该型缺陷没兜住):
 *  · 已接:`object-space-land.mjs`(本票) · `live-doc-edit.mjs`(本票)
 *  · 早已接(先例,走的是同一个器物):`git-sync-converge.mjs` / `union-converge.mjs`
 *  · **未接,本票动不了**:`scripts/plan-tasks-merge.mjs` —— 它是第四台旁路落地器
 *    (`--heal --commit` / `--fold-twins --commit` 都走 commit-tree + CAS,同样不跑钩子,
 *    而它落的内容正是台账行)。它同样必须自带补跑,否则本票的洞在它那一台上原地复活。
 *    未做的原因是硬约束而不是遗漏:该文件本票开工时是 ` M`(他人持有),票面明令禁止改动;
 *    镜像测试 `post-merge-ledger-sync.test.mjs` 的 L2 装车锁目前只钉两台收敛器,把它扩到
 *    落地器三台(object-space-land / live-doc-edit / plan-tasks-merge)是那一票的收口动作。
 *
 * 失败一律**大声点名且不改变落地成败**(与 lib/post-merge-ledger-sync.mjs 第 2 条同规:零丢失自证
 * 已经通过的落地,不该被一次补跑没跑成判成失败;但"没跑成"必须被喊出来,静默的自愈等于没有自愈)。
 *
 * @param {{root:string, paths:string[], log?:Function, loud?:Function}} a
 * @returns {{triggered:boolean, ran:boolean, ok:boolean, why:string}}
 */
export function rerunLedgerHeal({
  root,
  paths,
  log = (s) => console.log(s),
  loud = (s) => console.error(s),
} = {}) {
  if (!landsLedger(paths)) return { triggered: false, ran: false, ok: true, why: '' }
  log(
    `🩹 [G-816708] 本次落地声明含 ${LEDGER_DOC} ⇒ 就地补跑守门 71 台账自愈` +
      `(` +
      '`node scripts/check-plan-line-loss.mjs --heal --commit`' +
      `;旁路落地不跑钩子,这一跑就是 post-commit 第 6 节的替身)`,
  )
  const r = postMergeLedgerSync({ root, log })
  if (!r.ran)
    loud(
      `❌ [G-816708] 台账自愈**未派生成功**(这不等"跑过且没问题"):${r.why}\n` +
        `   本轮台账的登记行缺失此刻无人核过 ⇒ 请手工补跑:node scripts/check-plan-line-loss.mjs --heal --commit`,
    )
  else if (!r.ok)
    loud(
      `❌ [G-816708] 台账自愈**跑而未成**(rc≠0/超时):${r.why}\n` +
        `   这一轮的"缺不缺登记行"没有任何一面得出过结论 ⇒ 不得当成"什么都没缺";手工补跑:node scripts/check-plan-line-loss.mjs --heal --commit`,
    )
  return { triggered: true, ran: r.ran, ok: r.ok, why: r.why }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
