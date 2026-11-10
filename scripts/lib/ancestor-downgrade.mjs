// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/lib/ancestor-downgrade.mjs —— 「旧 blob 回写」判据的单一实现(2026-11-03 立)。
 *
 * 为什么要有这一层:同一个病理今天有两处要用 ——
 *   ① 提交链守门 298(`check-staged-downgrade.mjs`):暂存 blob 逐字等于该路径某个祖先 blob,
 *      而 HEAD 已有更新版本 ⇒ 幻影回写,拦提交;
 *   ② 写盘器 `gen-ui-mirror.mjs`:派生结果若逐字等于祖先 blob ⇒ 拒绝写盘(写手根治)。
 * 两处各写一遍必漂移(§0.6/§22c),所以判定、取材、留痕解析全在这一层,调用方只喂面。
 *
 * 判据(整 blob 逐字比较,不掺行级推断):
 *   staged/candidate blob oid ∈ {HEAD 的历史提交里同路径的 blob} 且 ≠ HEAD 现读 blob
 *   ⇒ 内容比 HEAD 旧,是把旧检出档搬回来了。相等即命中,不做相似度。
 *
 * 与门 84(`check-stale-revert.mjs`)的分工:84 判"整 blob 等于**任意历史**、且行级混合体";
 * 本层只判"**更旧**且 HEAD 更新"这一格 —— 30c 只认 merge-base 之前的基线祖先,84 的 R1
 * 对近期祖先回写也只在行级报数,两者都漏"回退到父提交/近几枚提交旧档"这一型(实测:
 * 4 个组件被 guardian 的 ui-mirror 写盘腿按 RN 旧类名回写,30c/84-R1 均未拦成整 blob)。
 *
 * 取材纪律(门 118):本层**不读工作区**,只按调用方给的 root 跑只读 git;所有子进程经
 * `face-reader` 的 `gitRaw` / `catBatchOids`(stdio、timeout、batch 三件统一在层内)。
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { catBatch, catBatchOids, catBatchSizes, gitRaw } from './face-reader.mjs'
import { resolveGitBin } from './gitdir.mjs'

/** 祖先窗口:每路径回看多少枚"改过该路径"的提交。现读最深命中 = 19 枚前,80 留余量。 */
export const ANCESTOR_WINDOW_DEFAULT = 80

/** 合法回滚的唯一声明标记(提交正文,行首,大小写不敏感)。 */
export const REVERT_MARKER = 'intentional-revert'

/** 声明必须带依据:去空白后至少这么多字符,空口"有意回退"不算。 */
export const REVERT_MIN_RATIONALE = 8

/**
 * 文本 → git blob oid(与 `git hash-object <file>` 同一把尺:sha1("blob <len>\0"+bytes))。
 * 用于写盘前预判"这一份文本写下去会不会变成某枚祖先 blob",不落对象库、零副作用。
 */
export function gitBlobOidOfText(text) {
  const buf = Buffer.from(String(text ?? ''), 'utf8')
  return createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex')
}

/**
 * 提交正文里的合法回滚声明。返回 { ok, rationale }:
 *   ok  ⇔ 存在行首 `intentional-revert:` 且依据去空白后 ≥ REVERT_MIN_RATIONALE。
 * 只认行首(注释前缀 `#` 之后不算 —— 那是模板说明,不是本次提交的声明)。
 */
export function intentionalRevertOf(message, { min = REVERT_MIN_RATIONALE } = {}) {
  const text = String(message ?? '')
  for (const raw of text.split(/\r?\n/)) {
    const m = new RegExp(`^\\s*${REVERT_MARKER}\\s*[:：]\\s*(.*)$`, 'i').exec(raw)
    if (!m) continue
    const rationale = m[1].trim()
    if (rationale.length >= min) return { ok: true, rationale }
  }
  return { ok: false, rationale: '' }
}

/**
 * HEAD 上该路径的 blob oid,三态(§0.3:缺席与取不到不是同一件事):
 *   { judged:true,  oid:'<40hex>', missing:false } —— 在位
 *   { judged:true,  oid:null,      missing:true  } —— HEAD 可解析,但该路径**确实不在**
 *   { judged:false, oid:null,      missing:false, why } —— HEAD/该路径取不到(不冒充"没有")
 * 立因(2026-11-04 复核):写盘闸曾把"git 报错"与"新增文件"折成同一条 allow ⇒ 一过性
 * git 失败会让祖先旧档**静默写盘**。故先验 HEAD 可解析,再用 `--quiet` 区分"缺席(exit 1)"
 * 与"取不到(其他非零/超时)"。
 */
export function headBlobOf(rel, { root } = {}) {
  try {
    const head = String(gitRaw(['rev-parse', '--verify', 'HEAD'], root)).trim()
    if (!/^[0-9a-f]{40}$/i.test(head)) {
      return { judged: false, oid: null, missing: false, why: 'HEAD 取不到 oid' }
    }
  } catch (e) {
    return {
      judged: false,
      oid: null,
      missing: false,
      why: `HEAD 取不到:${String(e?.message ?? e).split('\n')[0]}`,
    }
  }
  try {
    const out = String(gitRaw(['rev-parse', '--verify', '--quiet', `HEAD:${rel}`], root)).trim()
    if (!/^[0-9a-f]{40}$/i.test(out)) {
      return { judged: false, oid: null, missing: false, why: `HEAD:${rel} 输出非 oid` }
    }
    return { judged: true, oid: out.toLowerCase(), missing: false, why: null }
  } catch (e) {
    // `--quiet` 下"路径不在 HEAD"是 exit 1 且无 stderr;其余非零 = 真取不到,不折成缺席。
    if (e?.status === 1) return { judged: true, oid: null, missing: true, why: null }
    return {
      judged: false,
      oid: null,
      missing: false,
      why: `HEAD:${rel} 取不到:${String(e?.message ?? e).split('\n')[0]}`,
    }
  }
}

/**
 * 进程内「祖先清单」记忆(2026-11-10 提速;判据一字未改,只去掉重复取材)。
 *
 * 立因(实测):同一路径在同一轮里被问**两次** —— 索引臂先问 `ancestorBlobOf`(逐字档),
 * 未命中后再问 `ancestorContentMatch`(归一化 / 标识符集合两档),两者各自跑一遍
 * `git rev-list --max-count=80 HEAD -- <rel>`。这趟在深历史路径上是整门最贵的一步
 * (本仓单条实测 2.5~3.4s;提交链 8 门并行时 ×4,门 298 的 126s 主要就是它)。
 *
 * 三条不许漂的写法:
 * ① 键里带 `HEAD oid + 窗口大小 + 路径` 与 root ⇒ HEAD 一变(新提交)、窗口一变即重新取材,
 *    不存在拿旧读数判新面;
 * ② `judged:false`(**没判成**)一律不进记忆 —— 下一问必须重试,绝不把失败当结论复用;
 * ③ 只记忆"祖先清单"这一层取材,判定仍在各档里逐次做(命中逻辑不共享状态)。
 */
const ANCESTOR_LIST_MEMO = new Map()
const ANCESTOR_LIST_MEMO_MAX = 2000

/** 写记忆的唯一出口(容量上限的清理规则只此一处,预热与顺序取材共用)。 */
function memoSetAncestorList(key, value) {
  if (ANCESTOR_LIST_MEMO.size >= ANCESTOR_LIST_MEMO_MAX) ANCESTOR_LIST_MEMO.clear()
  ANCESTOR_LIST_MEMO.set(key, value)
}

/**
 * 该路径在 HEAD 之前的祖先提交清单(逐字档与归一化档共用,不再各取一遍)。
 * 三态:HEAD 取不到 / rev-list 取不到 ⇒ judged:false(§0.3,不折成"没有祖先")。
 */
export function ancestorCommitList(rel, { root, windowSize = ANCESTOR_WINDOW_DEFAULT } = {}) {
  const win = Number(windowSize) || ANCESTOR_WINDOW_DEFAULT
  let head = ''
  try {
    head = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
  } catch {
    return { judged: false, list: [], scanned: 0, why: '祖先面取不到:HEAD 不可解析' }
  }
  const key = `${root}\0${head}\0${win}\0${rel}`
  const memo = ANCESTOR_LIST_MEMO.get(key)
  if (memo) return memo
  try {
    const list = String(gitRaw(['rev-list', `--max-count=${win}`, 'HEAD', '--', rel], root))
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      // HEAD 自身不是祖先:HEAD 触及该路径时 rev-list 会把它排在首位,那一条要摘掉。
      .filter((c) => c !== head)
    const out = { judged: true, list, scanned: list.length, why: null }
    memoSetAncestorList(key, out)
    return out
  } catch (e) {
    return { judged: false, list: [], scanned: 0, why: `祖先面取不到:${String(e?.message ?? e).split('\n')[0]}` }
  }
}

/**
 * 预热子进程(经 `node -e` 传入,不进本仓模块图)。
 * 纪律:git 走 `resolveGitBin()` 给的绝对路径 + `safe.directory=*` + `core.quotepath=false`
 * + `windowsHide` + 数字 `timeout` + 显式 stdio(与 `face-reader.gitRaw` 同一组护栏);
 * 命令形态与 `ancestorCommitList` **逐字相同**(`rev-list --max-count=<win> HEAD -- <rel>`),
 * 只把串行改成并发 —— 一旦改命令,等价性就不再成立。
 */
const PREWARM_WORKER_CODE = String.raw`
const { execFile } = require('node:child_process')
const fs = require('node:fs')
const payload = JSON.parse(fs.readFileSync(0, 'utf8'))
const { git, root, win, rels, concurrency } = payload
const base = ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', root]
const guards = { cwd: root, windowsHide: true, timeout: 120000, maxBuffer: 16 << 20, stdio: ['ignore', 'pipe', 'pipe'] }
const rows = new Array(rels.length)
let next = 0
let running = 0
let done = 0
function finish() {
  execFile(git, [...base, 'rev-parse', 'HEAD'], { ...guards, maxBuffer: 1 << 20 }, (err, stdout) => {
    const head = err ? '' : String(stdout).trim()
    process.stdout.write(JSON.stringify({ head, rows }))
  })
}
function run() {
  while (running < concurrency && next < rels.length) {
    const i = next
    next += 1
    running += 1
    const args = [...base, 'rev-list', '--max-count=' + win, 'HEAD', '--', rels[i]]
    execFile(git, args, guards, (err, stdout, stderr) => {
      running -= 1
      done += 1
      if (err) rows[i] = { ok: false, why: String(stderr || err.message).split('\n')[0] }
      else rows[i] = { ok: true, list: String(stdout).split(/\r?\n/).map((s) => s.trim()).filter(Boolean) }
      if (done === rels.length) finish()
      else run()
    })
  }
}
run()
`

/**
 * 并行走查预热(2026-11-10 提速;判据一字未改,只把 N 条串行取材改成 N 条并发取材)。
 *
 * 立因(实测):`ancestorCommitList` 每路径一趟 `git rev-list --max-count=80 HEAD -- <rel>`,
 * 本仓深历史路径单条 2.5~3.4s;一轮判 N 条路径 = N × 单条。探针实测(同命令/同窗口/同 HEAD,
 * 只改并发):空载 15.80s → 5.78s(2.7x),模拟 6 枚 `rev-list --all` 负载下 22.66s → 10.90s(2.1x),
 * **15/15 条路径结果逐枚一致**。这是"多路径合并成一次 `git log`"被实测证伪(合并桶丢祖先 2 枚)
 * 之后唯一可证等价的提速方向 —— 所以只许改并发,**不许改命令形态**。
 *
 * 为什么另起子进程:本层与调用方都是同步接口(`gitRaw`/`catBatch` 皆 sync),进程内做不了并发;
 * 子进程里 `execFile` 并发跑**同一条** `rev-list`,回传清单。子进程代码用模板字符串传 `-e`
 * (不新增文件、不 import 本仓模块,不存在守门递归入口)。
 *
 * 三条失效方向(全部落回"顺序走查",结论不变):
 *   ① 候选 < 2 条 ⇒ 不预热(另起派生比顺序跑还贵);
 *   ② 子进程没跑成 / 输出不可解析 / 任一条路径失败 ⇒ 那几条不进记忆,调用方顺序走查时会重新取材;
 *   ③ 子进程读到的 HEAD 与父进程不一致(预热期间有新提交)⇒ **整批作废**,一条都不写记忆。
 *
 * @returns {{warmed:number, total:number, why:string|null}} warmed = 成功写进记忆的路径数
 */
export function prewarmAncestorLists(
  rels,
  { root, windowSize = ANCESTOR_WINDOW_DEFAULT, concurrency = 8, timeout = 150000 } = {},
) {
  const list = [
    ...new Set(
      (Array.isArray(rels) ? rels : []).map((s) => String(s ?? '').trim()).filter(Boolean),
    ),
  ]
  if (list.length < 2) return { warmed: 0, total: list.length, why: '候选路径少于 2 条 ⇒ 不另起派生' }
  const win = Number(windowSize) || ANCESTOR_WINDOW_DEFAULT
  let head = ''
  try {
    head = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
  } catch (e) {
    return { warmed: 0, total: list.length, why: `HEAD 取不到:${String(e?.message ?? e).split('\n')[0]}` }
  }
  if (!/^[0-9a-f]{40}$/i.test(head)) return { warmed: 0, total: list.length, why: 'HEAD 取不到 oid ⇒ 不预热' }
  const payload = JSON.stringify({
    git: resolveGitBin() || 'git',
    root: root ? resolve(root) : process.cwd(),
    win,
    rels: list,
    concurrency: Math.max(1, Math.min(list.length, Number(concurrency) || 8)),
  })
  let res
  try {
    res = spawnSync(process.execPath, ['-e', PREWARM_WORKER_CODE], {
      input: payload,
      encoding: 'utf8',
      windowsHide: true,
      timeout: Number(timeout) > 0 ? Number(timeout) : 150000,
      maxBuffer: 8 << 20,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (e) {
    return { warmed: 0, total: list.length, why: `预热派生失败:${String(e?.message ?? e).split('\n')[0]}` }
  }
  if (res?.error || res?.status !== 0) {
    const why = res?.error
      ? String(res.error.message ?? res.error).split('\n')[0]
      : `退出码 ${String(res?.status)}:${String(res?.stderr ?? '').split('\n')[0]}`
    return { warmed: 0, total: list.length, why: `预热派生未跑成:${why}` }
  }
  let parsed
  try {
    parsed = JSON.parse(String(res.stdout ?? ''))
  } catch {
    return { warmed: 0, total: list.length, why: '预热输出不可解析 ⇒ 回落顺序走查' }
  }
  if (String(parsed?.head ?? '') !== head)
    return { warmed: 0, total: list.length, why: '预热期间 HEAD 变了 ⇒ 整批作废' }
  const rows = Array.isArray(parsed?.rows) ? parsed.rows : []
  let warmed = 0
  list.forEach((rel, i) => {
    const row = rows[i]
    if (!row?.ok || !Array.isArray(row.list)) return
    // HEAD 自身不是祖先(与 ancestorCommitList 同一过滤口径,过滤只此一处语义)
    const commits = row.list.map((c) => String(c).trim()).filter((c) => c && c !== head)
    memoSetAncestorList(`${root}\0${head}\0${win}\0${rel}`, {
      judged: true,
      list: commits,
      scanned: commits.length,
      why: null,
    })
    warmed += 1
  })
  return { warmed, total: list.length, why: null }
}

/**
 * 该 blobOid 是不是 rel 在 HEAD 某个**祖先提交**里的原样?
 * 返回三态(§0.3,调用方不得把 judged:false 折成"没命中"):
 *   { judged:true, match:null, scanned:N }            —— 判过,不是祖先回写
 *   { judged:true, match:{commit,blobOid}, scanned:N } —— 命中(commit = 最近的命中祖先)
 *   { judged:false, why }                              —— 该跑没跑成
 */
export function ancestorBlobOf(rel, blobOid, { root, windowSize = ANCESTOR_WINDOW_DEFAULT } = {}) {
  const oid = String(blobOid ?? '').trim().toLowerCase()
  if (!/^[0-9a-f]{40}$/.test(oid)) return { judged: false, why: `blob oid 非法:${blobOid}` }
  const q = ancestorCommitList(rel, { root, windowSize })
  if (!q.judged) return { judged: false, why: q.why }
  if (q.list.length === 0) return { judged: true, match: null, scanned: 0 }
  try {
    const specs = q.list.map((c) => `${c}:${rel}`)
    const map = catBatchOids(root, specs)
    for (const c of q.list) {
      const got = map.get(`${c}:${rel}`)
      // 该祖先里这条路径可能已被删掉(cat-file 报 null)—— 与原逐字档口径一致:跳过,不折成"取不到"
      if (got && got.toLowerCase() === oid) {
        return { judged: true, match: { commit: c, blobOid: got.toLowerCase() }, scanned: q.scanned }
      }
    }
    return { judged: true, match: null, scanned: q.scanned }
  } catch (e) {
    return { judged: false, why: `祖先面取不到:${String(e?.message ?? e).split('\n')[0]}` }
  }
}

/**
 * 去空白归一化(§12i 第二臂的等值尺):**只**抹掉空白类字符,不折叠大小写、不剥注释、不动字符串体。
 * 为什么是这个口径:实测回写件的形态是"旧内容 + prettier/编辑器重排",逐字 oid 因此错开;
 * 而归一化流相等 ⇔ 两份内容在非空白字符层面逐字同形,不需要相似度阈值,也不引入新的判断面。
 */
export function normalizeContentStream(text) {
  return String(text ?? '').replace(/\s+/g, '')
}

/** 原始字节与去空白流的比例容差:重排只动空白,体积差应远小于这个带;超带宽直接不进比较 */
export const NORMALIZED_SIZE_TOLERANCE = 0.25

/**
 * 标识符集等值档的最小缺口:本档要求"本面比 HEAD 至少少这么多标识符"才算回退。
 * 立因:只看集合等值会误伤正当改动(换一个字符串字面量/删一个未用符号都可能让集合与某祖先相同);
 * 当天实测两件旧档相对 HEAD 分别缺 30 / 13 个 ⇒ 3 是既不误伤又抓得住的下限。
 */
export const MIN_HEAD_IDENTIFIER_GAP = 3

/** 标识符尺(全仓一条正则,镜像测试 import 它,不再各写一份) */
export const IDENTIFIER_RE = /[A-Za-z_$][A-Za-z0-9_$]{2,}/g

export function identifierSetOf(text) {
  return new Set(String(text ?? '').match(IDENTIFIER_RE) || [])
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}

/** a 是否 b 的真子集,且 b 至少多出 minGap 个 */
function isStrictSubset(a, b, minGap = 1) {
  if (b.size - a.size < minGap) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}

/**
 * **内容级**祖先等值(2026-11-05 立,补逐字 oid 档的实测盲区),一次走祖先、按两档命中:
 *   · `kind:'normalized'` —— 去掉全部空白后与某祖先逐字等值(纯空白重排);
 *   · `kind:'identifier-set'` —— 标识符**集合**与某祖先相等,而相对 HEAD 少 ≥MIN_HEAD_IDENTIFIER_GAP 个。
 *     这一档是实测逼出来的:prettier 不只动空白,它还增删分号/逗号/括号 —— 当天 guardian-runner 那枚
 *     11-03 旧档把 80 枚祖先逐个比完,逐字档与归一化档**都不命中**,只有集合档抓到(缺 30 个标识符)。
 * 判序:先按原始体积(±25%)筛候选再读正文,不逐祖先读全档;与 HEAD 归一化等值 ⇒ 纯格式噪声不算回退。
 * 返回三态(§0.3):任何一档取不到 ⇒ `judged:false`,绝不折成"没命中"。
 */
export function ancestorContentMatch(
  rel,
  faceText,
  {
    root,
    windowSize = ANCESTOR_WINDOW_DEFAULT,
    tolerance = NORMALIZED_SIZE_TOLERANCE,
    minGap = MIN_HEAD_IDENTIFIER_GAP,
  } = {},
) {
  if (typeof faceText !== 'string' || faceText === '')
    return { judged: false, match: null, why: '正文取不到(空文本不判,§0.3)' }
  const q = ancestorCommitList(rel, { root, windowSize })
  if (!q.judged) return { judged: false, match: null, why: q.why }
  try {
    const faceNorm = normalizeContentStream(faceText)
    const faceLen = Buffer.byteLength(faceText, 'utf8')
    const faceIds = identifierSetOf(faceText)
    // 与 HEAD 归一化等值 ⇒ 纯格式差异,不是回写;这一步不依赖祖先清单,排在扫祖先之前。
    // HEAD 正文取不到 ⇒ 未判定(不折成"不等值⇒可判")。
    const headText = catBatch(root, [`HEAD:${rel}`]).get(`HEAD:${rel}`)
    if (headText === undefined)
      return { judged: false, match: null, why: `HEAD:${rel} 取不到(键缺失,不折成"没有")` }
    if (headText === null)
      return {
        judged: true,
        match: null,
        scanned: q.scanned,
        compared: 0,
        notApplicable: 'HEAD 面无该路径 ⇒ 不构成"HEAD 已有更新档"这一格',
      }
    if (normalizeContentStream(headText) === faceNorm)
      return { judged: true, match: null, scanned: q.scanned, compared: 0, normalizedEqualHead: true }
    const headIds = identifierSetOf(headText)
    // 顺带把疑退形态量出来(同一份正文,不再二次取面):门用它只报数、不判红
    const deficit = identifierDeficit(headText, faceText)
    // 集合档前置:本面必须是 HEAD 的真子集(与 HEAD 等集或超集都不算"更旧")
    const subsetOfHead = isStrictSubset(faceIds, headIds, minGap)
    if (q.list.length === 0) return { judged: true, match: null, scanned: 0, compared: 0, deficit }
    const specs = q.list.map((c) => `${c}:${rel}`)
    const sizes = catBatchSizes(root, specs)
    const lo = faceLen * (1 - tolerance)
    const hi = faceLen * (1 + tolerance)
    const candidates = []
    for (const c of q.list) {
      const sz = sizes.get(`${c}:${rel}`)
      if (sz === undefined)
        return { judged: false, match: null, why: `祖先体积读数键缺失 ${c.slice(0, 10)}:${rel}` }
      if (sz === null || sz === 0) continue // null = 该祖先里没有这条路径;0 = 空档,不可能等于非空正文
      if (sz >= lo && sz <= hi) candidates.push(c)
    }
    if (candidates.length === 0) return { judged: true, match: null, scanned: q.scanned, compared: 0, deficit }
    const bodies = catBatch(root, candidates.map((c) => `${c}:${rel}`))
    const hit = (c, kind) => {
      const oids = catBatchOids(root, [`${c}:${rel}`])
      return {
        judged: true,
        match: {
          commit: c,
          blobOid: String(oids.get(`${c}:${rel}`) ?? '').toLowerCase(),
          kind,
          normalized: kind === 'normalized',
        },
        scanned: q.scanned,
        compared: candidates.length,
      }
    }
    let setHit = null
    for (const c of candidates) {
      const body = bodies.get(`${c}:${rel}`)
      if (body === undefined)
        return { judged: false, match: null, why: `祖先正文键缺失 ${c.slice(0, 10)}:${rel}` }
      if (body === null) continue // 装箱后仍取不到具体档:该祖先无此路径(与 sizes 的 null 同义)
      if (normalizeContentStream(body) === faceNorm) return hit(c, 'normalized') // 强档先出声
      if (!setHit && subsetOfHead && setsEqual(identifierSetOf(body), faceIds)) setHit = c
    }
    if (setHit) return hit(setHit, 'identifier-set')
    return { judged: true, match: null, scanned: q.scanned, compared: candidates.length, deficit }
  } catch (e) {
    return { judged: false, match: null, why: `内容档取不到:${String(e?.message ?? e).split('\n')[0]}` }
  }
}

/**
 * 疑退(advisory)两档阈值(单源,门与报表共用):
 *   `missing ≥ STALE_SUSPECT_MIN` 且 `missing ≥ STALE_SUSPECT_RATIO × extra` 且 `extra ≥ 1`。
 * 立因(2026-11-05 实测):当天 guardian-runner 那枚旧档相对 HEAD **缺 30 个**标识符、却又带
 * **9 个** HEAD 已退役的 —— 三档 blob 等值判据都抓不住它(它既不是任何 80 枚祖先的等值形态,
 * 又不是 HEAD 的真子集)。而这个形态与"正当清死代码"(knip 一次摘 18 件)在 blob 层面**不可分辨**
 * ⇒ 只能报数不能判红(§12e:拿不准的判据升 blocking = 逼人跳门,废掉全部守门)。
 * 要求 `extra ≥ 1` 就是把"纯删码"排除出去:纯删无新增符号,不构成疑退形态。
 */
export const STALE_SUSPECT_MIN = 10
export const STALE_SUSPECT_RATIO = 2

/** 本面相对 HEAD 的标识符缺口(只量数,不下红判);取不到正文的一侧按空集,由调用方判未判定。 */
export function identifierDeficit(headText, faceText) {
  const a = identifierSetOf(faceText)
  const b = identifierSetOf(headText)
  let missing = 0
  for (const x of b) if (!a.has(x)) missing += 1
  let extra = 0
  for (const x of a) if (!b.has(x)) extra += 1
  const suspect =
    extra >= 1 && missing >= STALE_SUSPECT_MIN && missing >= STALE_SUSPECT_RATIO * extra
  return { missing, extra, suspect }
}

/** 一处命中 → 一行可读点位(门与写盘器共用文案,不各写一份)。 */
export function describeMatch(rel, match) {
  const sha = String(match?.commit ?? '').slice(0, 10)
  const kindTxt =
    match?.kind === 'identifier-set'
      ? ' 标识符集合等值(旧内容+改标点)'
      : match?.kind === 'normalized' || match?.normalized
        ? ' 归一化等值(旧内容+改格式)'
        : ''
  return `${rel}(=祖先 ${sha}${kindTxt})`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
