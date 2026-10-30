// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 悬空 commit 自动保活腿(2026-10-30 立,goal-b35 g35-s1)。
 *
 * ## 立因(本会话三次实测到的结构性缺口)
 * 守门 30a(`scripts/check-commit-loss-guard.mjs`,blocking)的「悬空 commit 30 天窗」维会**反复红**:
 * 手工打 10 枚 `lost-commit/<name>` tag 把它修绿,几十分钟后又冒出 2 枚新的未备份 ⇒ 每次都要人(或 agent)
 * 手工 `git tag`。手工是一次性止痛,不是一修 —— 没有任何自动腿在悬空 commit 出现的当下给它保活,
 * 而它是 blocking ⇒ 这台机器会周期性重新制造「所有人被迫 `--no-verify`」那一型(AGENTS §12e)。
 * §22 早已写明出路是 `git tag lost-commit/<name> <hash>`,§29 写明「检出的悬空 commit 一律备份为
 * lost-commit/<name> tag 再继续」—— 这条动作是唯一没人自动做的半格。
 *
 * ## 判据零复算(§0.6 / §22c)
 * 「哪些悬空 commit 属于**窗内且无备份**」这一整条判据链(fsck → stash-like 过滤 → 备份 hash/tree
 * 等价 → 同内容副本白名单 → 30 天窗 + 时刻读不到保守算窗内)**不在本器重写**。本器直接调 30a 自己
 * 为处置动作造的机读出口:
 *     node scripts/check-commit-loss-guard.mjs --filter-stash --list-unbacked [--list-out-of-window]
 * 那两个旗的头注写明加它们的理由正是「处置动作需要清单……想照 §22 逐枚 tag 的人只能改脚本或重写
 * 一遍判据链(而重写的那份必然与源漂开)」⇒ 本器就是那个"喂给 git tag 的清单"的**消费者**。
 * 窗宽、环境变量名、清单旗标、无 ANSI 的 oid 行形态全部 import 门 30a 的 `__test__` 常量,不抄字面量。
 *
 * ## 三条硬要求(机主令)
 * ① **绝不删 tag、绝不 GC**:本器只做 `git tag`(加法)。AGENTS §29 把 GC 归人工,超窗存量在本器里
 *    只是"报数"(由 30a 的 `--list-out-of-window` 给出枚数),一条也不动。
 * ② **取不到输入 ⇒ 未判定,不记绿**(§0.3):30a 自己 exit 2(fsck 判据面取不到)、结论行取不到、
 *    oid 清单与计数对不上 ⇒ `state=undetermined`,进程 exit 2,一个 tag 也不打。
 * ③ **空转零写零推**(§5e-1):窗内未备份 0 枚 ⇒ 不建留痕、不派推送、不打日志;只在真加了 tag
 *    (或真撞名/失败)时落一行留痕并派 `sync-lost-commit-tags.mjs --auto-push`。
 *
 * ## 单轮上限
 * `--filter-stash` 后的未备份清单在本仓量级可达数千枚(§22 头注实测 9809)。逐枚打 tag 会把近万枚
 * 引用原子推给 origin,而 §29 写明那种存量属人工 GC 范围 ⇒ 单轮最多打 `MAX_PER_ROUND` 枚,其余记
 * `deferred=` 交下一轮(15 分钟节流),绝不一次吞下整批。
 *
 * 结论行(机读,派发层按它分档,不靠中文文案猜):
 *   `AUTOTAG-RESULT state=clean|pending|tagged|conflict|refused|undetermined tagged=N unbacked=U
 *    out_of_window=O already=A conflicts=C deferred=D push=ok|skip|failed|skip-backlog`
 *
 * 用法:
 *   node scripts/lib/dangling-commit-autotag.mjs                 # 只读预演(零写盘零打 tag)
 *   node scripts/lib/dangling-commit-autotag.mjs --apply         # 真打 tag + 派推送 + 落留痕
 *   node scripts/lib/dangling-commit-autotag.mjs --apply --json  # 末行附机读 JSON(派发层消费)
 * 派发面:`scripts/git-guardian.mjs` 的 `sweepDanglingCommitAutotag()`(15 分钟节流;判机器状态 ⇒
 * 刻意不进提交链,§12e)。
 */
/* eslint-disable no-console -- 保活器为 CLI 工具,结论行(AUTOTAG-RESULT)与点名行必须由 console 打到 stdout 给派发层读 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitRaw, Undetermined } from './face-reader.mjs'
// 判据单源(§22c):档位旗标/窗宽常量/oid 行形态全部取门 30a 的 __test__ 出口。
// 该文件自 §22d 起带 isDirectRun 守卫 ⇒ import 它不会把整道门跑一遍。
import { __test__ as lossGuard } from '../check-commit-loss-guard.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15:禁 process.cwd() 定根,共享工作区 cwd 不可靠)。 */
export const ROOT = resolve(HERE, '..', '..')
export const GUARD_SCRIPT = join(ROOT, 'scripts', 'check-commit-loss-guard.mjs')
export const PUSH_SCRIPT = join(ROOT, 'scripts', 'sync-lost-commit-tags.mjs')
export const SEAT = 'dangling-commit-autotag'
export const LEDGER_REL = join('.ihui-agent', 'state', 'dangling-commit-autotag.jsonl')
/** tag 命名:additive-only 前缀,人工打的 `lost-commit/<name>` 与本器互不遮蔽。 */
export const TAG_PREFIX = 'lost-commit/auto-'
/** tag 名里带 sha 前 7 位(与 §12h `lost-commit/worktree-<名>-<sha7>` 同族写法)。 */
export const TAG_SHA_LEN = 7
/** 单轮上限:见头注「单轮上限」。 */
export const MAX_PER_ROUND = Number(process.env.IHUI_DANGLING_AUTOTAG_MAX || 200)
/** 30a 全量一轮(18k 悬空 + 24k tag 的派生)实测到分钟级;给足 20 分钟,取不到就落未判定。 */
export const GUARD_TIMEOUT_MS = Number(
  process.env.IHUI_DANGLING_AUTOTAG_GUARD_TIMEOUT_MS || 20 * 60_000,
)
export const PUSH_TIMEOUT_MS = Number(
  process.env.IHUI_DANGLING_AUTOTAG_PUSH_TIMEOUT_MS || 10 * 60_000,
)
/** 状态集:派发层按名分档,镜像测试钉"没判"与"判绿"必须是两个名。 */
export const STATES = Object.freeze([
  'clean',
  'pending',
  'tagged',
  'conflict',
  'refused',
  'undetermined',
])

const OID_RE = /^[0-9a-f]{40}$/
/** ANSI 转义剔除:结论清单要能机读,而 30a 的横幅带色码(oid 行本身不带)。 */
const stripAnsi = (s) => String(s ?? '').replace(/\x1b\[[0-9;]*m/g, '')

/** 悬空 commit → 本器专用 tag 短名(纯函数,判据唯一定名处)。 */
export function tagNameFor(sha) {
  return `${TAG_PREFIX}${String(sha).slice(0, TAG_SHA_LEN)}`
}

/**
 * 30a 的 stdout → 「窗内未备份」与「超窗只报数」两串完整 oid(纯函数,零派生)。
 *
 * 两族清单各由一行横幅引出(`--list-unbacked:N 枚…` / `--list-out-of-window:N 枚…`),
 * 横幅之后紧跟每行一枚 40 位 oid。这里只认这两段 ⇒ 门里其它 12 位短 hash 展示行
 * (`↳ 未备份:<12>`)天然不匹配 OID_RE,不会被误收。
 * 横幅旗标名取 `lossGuard.FLAGS`(**不写字面量**):旗标改名时这里读不到横幅 ⇒
 * 由 `sectionsSeen=false` 落未判定,而不是把"没读到"折成"没有悬空"(§0.3)。
 */
export function parseGuardOutput(stdout) {
  const lines = stripAnsi(stdout).split(/\r?\n/)
  const reUnbacked = new RegExp(`${escapeRe(lossGuard.FLAGS.listUnbacked)}:\\s*(\\d+)`)
  const reOutOfWeek = new RegExp(`${escapeRe(lossGuard.FLAGS.listOutOfWindow)}:\\s*(\\d+)`)
  let section = null
  let unbackedBanner = null
  let outOfWeekBanner = null
  const unbacked = []
  const outOfWeek = []
  let greenSeen = false
  let fullyBackedSeen = false
  for (const line of lines) {
    const mU = reUnbacked.exec(line)
    if (mU) {
      section = 'unbacked'
      unbackedBanner = Number(mU[1])
      continue
    }
    const mO = reOutOfWeek.exec(line)
    if (mO) {
      section = 'outOfWeek'
      outOfWeekBanner = Number(mO[1])
      continue
    }
    const t = line.trim()
    // 门的两枚 GREEN_MARKERS 都算"判完了、没债"(常量 import 自门,不抄字面量):
    //  · noUnreachable = fsck 一个悬空都没读到;
    //  · noRisk = **确有悬空但后备援集为空**(全已 tag / 树等价 / 同内容副本白名单命中)那一型 ——
    //    门在这种情况下**一句清单横幅都不打**(横幅与"已全部 tag 备份"都在 `unbacked.length>0` 支里),
    //    只打这句终态。2026-10-30 真跑实测到的正是这一型:认不得它就把"门判完了、没债"读成
    //    "门没判成"(未判定),而那才是本器最不该有的失效方向(§0.3 是双向的:没判不得记绿,
    //    判完了也不得记成没判)。
    if (
      (lossGuard.GREEN_MARKERS.noUnreachable &&
        line.includes(lossGuard.GREEN_MARKERS.noUnreachable)) ||
      (lossGuard.GREEN_MARKERS.noRisk && line.includes(lossGuard.GREEN_MARKERS.noRisk))
    )
      greenSeen = true
    // "悬空 commit 已全部 tag 备份"这一档:未备份集为空,但 unreachable>0 ⇒ 门不打印任何横幅。
    // 这是**展示文案依赖**(门体没把这句挪进 GREEN_MARKERS),故由镜像测试逐字钉住在源文件里
    // 仍在位(漂移即测试红,而不是本器静默读成"没判成")。
    if (/已全部\s*tag\s*备份/.test(line)) fullyBackedSeen = true
    if (section && OID_RE.test(t)) (section === 'unbacked' ? unbacked : outOfWeek).push(t)
  }
  const sectionsSeen = unbackedBanner !== null || outOfWeekBanner !== null
  // 横幅在位时:自报枚数必须与实收 oid 行数逐段对上(对不上 = 清单被截/被改 => 未判定);
  // 一段横幅都没出现时:只认门自己那两句"无事"结论(见上),两句都不在 => 未判定。
  const countsMatch =
    (unbackedBanner === null || unbackedBanner === unbacked.length) &&
    (outOfWeekBanner === null || outOfWeekBanner === outOfWeek.length)
  const judged = sectionsSeen ? countsMatch : greenSeen || fullyBackedSeen
  return {
    unbacked,
    outOfWeek,
    greenSeen,
    fullyBackedSeen,
    sectionsSeen,
    declaredUnbacked: unbackedBanner,
    judged,
    why: judged
      ? ''
      : `门 30a 的机读清单取不到/与自报枚数对不上(横幅=${String(unbackedBanner)},实收=${unbacked.length};` +
        `超窗横幅=${String(outOfWeekBanner)},实收=${outOfWeek.length})⇒ 未判定,不得读成"没有悬空待备份"`,
  }
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 未备份清单 + 现有 lost-commit/<name> tag 名集 → 本轮动作计划(纯函数,零派生)。
 * 三条方向锁:
 *  ① 同名 tag 已存在且指向**同一枚** ⇒ already(幂等:第二次零动作);
 *  ② 同名 tag 已存在而指向别的对象 ⇒ conflicts,**绝不覆盖**(§0.10 失效方向是多要一次定向说明,
 *     绝不是多放一次跳门:覆盖别人那枚 tag = 把已保活的对象洗掉);
 *  ③ 超出单轮上限 ⇒ deferred(下一轮再来),绝不静默截断。
 */
export function planAutotags({
  unbacked = [],
  existingTagNames = new Set(),
  cap = MAX_PER_ROUND,
} = {}) {
  const create = []
  const already = []
  const conflicts = []
  const deferred = []
  const seen = new Set()
  for (const sha of unbacked) {
    if (!OID_RE.test(String(sha))) continue
    if (seen.has(sha)) continue
    seen.add(sha)
    const tag = tagNameFor(sha)
    if (existingTagNames.has(tag)) {
      // 名字在场 ⇒ 交 applyAutotags 那侧现读它指向谁(already 与 conflict 的分别是量出来的,不猜)
      conflicts.push({ tag, sha, pending: true })
      continue
    }
    if (create.length >= cap) {
      deferred.push({ tag, sha })
      continue
    }
    create.push({ tag, sha })
  }
  return { create, already, conflicts, deferred, considered: seen.size }
}

/**
 * 把 conflicts 里"名字在场"的两态分开(纯函数):
 * tag 现指向该 sha ⇒ already(已保活,幂等);指向别的对象 ⇒ conflict(点名不覆盖)。
 */
export function classifyNameHits(conflicts = [], targetOf = () => '') {
  const already = []
  const colliding = []
  for (const c of conflicts) {
    const holds = targetOf(c.tag)
    if (holds === c.sha) already.push({ tag: c.tag, sha: c.sha })
    else colliding.push({ tag: c.tag, sha: c.sha, holds })
  }
  return { already, colliding }
}

// ────────────────────────── IO 层(全部可注入,镜像测试零真派生) ──────────────────────────

/** 默认:派生门 30a 取机读清单(带 input 的派生不给 stdin,故 stdio[0]='ignore',§12g)。 */
export function defaultRunGuard({ root, timeoutMs = GUARD_TIMEOUT_MS, listOutOfWindow = true }) {
  const args = [GUARD_SCRIPT, lossGuard.FLAGS.filterStash, lossGuard.FLAGS.listUnbacked]
  if (listOutOfWindow) args.push(lossGuard.FLAGS.listOutOfWindow)
  try {
    const stdout = execFileSync(process.execPath, args, {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 1 << 26,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { rc: 0, stdout: String(stdout ?? ''), stderr: '' }
  } catch (e) {
    // 30a 的退出码约定(0 判绿 / 1 判红 / 2 未判定):本器不带 --blocking,正常恒 0;
    // 取不到输出 ⇒ rc=null ⇒ 上层落未判定。
    return {
      rc: typeof e?.status === 'number' ? e.status : null,
      stdout: String(e?.stdout ?? ''),
      stderr: String(e?.stderr ?? e?.message ?? e),
    }
  }
}

/** 默认:现读 lost-commit/<name> 的 tag 名集(判据 import 门 30a 的 for-each-ref 解析,零复算)。 */
export function defaultTagFace({ root = ROOT } = {}) {
  const out = gitRaw(
    [
      'for-each-ref',
      '--format=%(refname:short)%09%(objectname)%09%(*objectname)',
      'refs/tags/lost-commit',
    ],
    root,
    { timeout: 60_000, maxBuffer: 1 << 26 },
  )
  const info = lossGuard.parseForEachRefTagInfo(out)
  const names = new Set()
  for (const [name] of info) names.add(name)
  return {
    names,
    targetOf: (name) => {
      const i = info.get(name)
      if (!i) return ''
      return i.peeled || i.obj || ''
    },
  }
}

/** 默认:单枚 `git tag`(只加不减;失败不抛,由调用方记 failed)。 */
export function defaultCreateTag({ root = ROOT }) {
  return ({ tag, sha }) => {
    try {
      gitRaw(['tag', tag, sha], root, { timeout: 30_000 })
      const holds = gitRaw(['rev-parse', '--verify', '--quiet', `${tag}^{commit}`], root, {
        timeout: 30_000,
      }).trim()
      return holds === sha ? { ok: true } : { ok: false, why: `回读指向 ${holds || '(空)'}` }
    } catch (e) {
      return { ok: false, why: String(gitRawErrorText(e)).slice(0, 160) }
    }
  }
}

function gitRawErrorText(e) {
  return (e && (e.stderr || e.message)) || e
}

/** 默认:复用现成出口推 tag(空壳 tag 连累整块的既有解法 = IHUI_TAG_ONLY 精确投递)。 */
export function defaultPush({ root = ROOT, timeoutMs = PUSH_TIMEOUT_MS } = {}) {
  return (tags) => {
    if (!tags.length) return { status: 'skip', detail: '本轮零新增,不派推送(空转零推)' }
    try {
      const out = execFileSync(process.execPath, [PUSH_SCRIPT, '--auto-push'], {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
        timeout: timeoutMs,
        maxBuffer: 1 << 26,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, IHUI_TAG_ONLY: tags.join(',') },
      })
      const text = String(out ?? '')
      // 既有语义:积压超阈值/限流中 ⇒ 脚本自己按 0 退出并"只记录不推" ⇒ 不得记成 ok。
      if (/跳过|限流/.test(text))
        return { status: 'skip-backlog', detail: text.split('\n').filter(Boolean).slice(-1)[0] }
      if (/无需 push|全部.*已存在/.test(text)) return { status: 'skip', detail: '远端已在册' }
      return { status: 'ok', detail: '' }
    } catch (e) {
      return {
        status: 'failed',
        detail: `${String(e?.stderr || e?.message || e)
          .split('\n')[0]
          .slice(0, 160)}(rc=${String(e?.status)})`,
      }
    }
  }
}

/** 默认留痕:一动作一行,追加式 JSONL(§5e-3 同族纪律:失败也记,取不到输入不记绿)。 */
export function defaultLedgerAppend({ root = ROOT } = {}) {
  return (obj) => {
    const abs = join(root, LEDGER_REL)
    mkdirSync(dirname(abs), { recursive: true })
    appendFileSync(abs, JSON.stringify(obj) + '\n', 'utf8')
    return abs
  }
}

/**
 * 一轮保活。`apply=false` 恒为只读预演(一个 tag 也不打、一行留痕也不写、一次推送也不派)。
 * 依赖全部可注入 ⇒ 镜像测试用构造面钉五型行为,不必依赖仓库此刻的悬空存量。
 */
export function autotagOnce(opts = {}) {
  const {
    apply = false,
    root = ROOT,
    cap = MAX_PER_ROUND,
    runGuard = defaultRunGuard,
    tagFace = defaultTagFace,
    createTag = defaultCreateTag,
    push = defaultPush,
    ledgerAppend = defaultLedgerAppend,
    logger = console.log,
    nowIso = () => new Date().toISOString(),
    listOutOfWindow = true,
  } = opts

  const finish = (r) => {
    const kv = [
      `state=${r.state}`,
      `tagged=${r.tagged}`,
      `unbacked=${r.unbacked}`,
      `out_of_window=${r.outOfWeek}`,
      `already=${r.already}`,
      `conflicts=${r.conflicts}`,
      `deferred=${r.deferred}`,
      `failed=${r.failed}`,
      `push=${r.push}`,
    ]
    logger(`AUTOTAG-RESULT ${kv.join(' ')}`)
    return r
  }
  const base = {
    state: 'undetermined',
    tagged: 0,
    unbacked: 0,
    outOfWeek: 0,
    already: 0,
    conflicts: 0,
    deferred: 0,
    failed: 0,
    push: 'skip',
    why: '',
    tags: [],
    colliding: [],
  }

  // ① 判据面:门 30a 自己的机读清单(零复算)
  let guard
  try {
    guard = runGuard({ root, timeoutMs: GUARD_TIMEOUT_MS, listOutOfWindow })
  } catch (e) {
    return finish({ ...base, why: `门 30a 派生异常:${String(e?.message ?? e).slice(0, 160)}` })
  }
  if (guard && guard.rc === 2) {
    // 门 30a 明写:2 = 「没判完」,不是「判完判红」⇒ 本器同样不记绿、不动作(§0.3)
    return finish({
      ...base,
      why: `门 30a 未判定(fsck 判定面取不到):${String(guard.stderr).split('\n')[0].slice(0, 160)}`,
    })
  }
  if (guard && typeof guard.rc === 'number' && guard.rc !== 0 && guard.rc !== 1) {
    return finish({ ...base, why: `门 30a 退出码 ${guard.rc} 不在约定形态(0/1/2)⇒ 未判定` })
  }
  const parsed = parseGuardOutput(guard ? guard.stdout : '')
  if (!parsed.judged) return finish({ ...base, why: parsed.why })

  base.unbacked = parsed.unbacked.length
  base.outOfWeek = parsed.outOfWeek.length
  if (parsed.unbacked.length === 0) {
    // 空转:窗内未备份 0 枚 ⇒ 零写盘、零推送、不喊人(§5e-1 / 硬要求③)
    return finish({ ...base, state: 'clean' })
  }

  // ② 名字面:现读 lost-commit/<name> tag 名集与指向
  let face
  try {
    face = tagFace({ root })
  } catch (e) {
    return finish({
      ...base,
      why: `lost-commit/<name> tag 面取不到:${String(e?.message ?? e).slice(0, 160)}`,
    })
  }
  const plan = planAutotags({ unbacked: parsed.unbacked, existingTagNames: face.names, cap })
  const hits = classifyNameHits(plan.conflicts, face.targetOf)
  base.already = hits.already.length
  base.conflicts = hits.colliding.length
  base.deferred = plan.deferred.length
  base.colliding = hits.colliding
  if (hits.colliding.length)
    logger(
      `⚠️ tag 名已被别的对象占用 ⇒ 不覆盖(交人工改名/处置):` +
        hits.colliding
          .slice(0, 5)
          .map((c) => `${c.tag}→${String(c.holds).slice(0, 12) || '(空)'}`)
          .join(' ') +
        (hits.colliding.length > 5 ? ` … 另有 ${hits.colliding.length - 5} 枚` : ''),
    )
  if (plan.deferred.length)
    logger(
      `ℹ️ 单轮上限 ${cap} 枚已到,另 ${plan.deferred.length} 枚记 deferred 交下一轮(不静默截断)`,
    )

  if (!apply) {
    return finish({ ...base, state: 'pending', tagged: 0, unbacked: parsed.unbacked.length })
  }
  if (plan.create.length === 0) {
    // 全是 already/conflict ⇒ 没有可加的东西;conflict 是真失败(那一枚仍未保活),其余算 clean
    return finish({ ...base, state: base.conflicts > 0 ? 'conflict' : 'clean' })
  }

  // ③ 打标(只加不减)
  const made = []
  const failedList = []
  const tagger = typeof createTag === 'function' ? createTag({ root }) : createTag
  for (const item of plan.create) {
    const r = tagger(item)
    if (r && r.ok) made.push(item.tag)
    else failedList.push({ ...item, why: (r && r.why) || '未知失败' })
  }
  base.tagged = made.length
  base.failed = failedList.length

  // ④ 留痕 + 推送**排在打标成功之后**(先写后落会把"面上还在"说成"已保活")
  let pushRes = { status: 'skip', detail: '本轮零成功新增,不派推送' }
  if (made.length) {
    const pusher = typeof push === 'function' ? push({ root }) : push
    pushRes = pusher(made) || { status: 'failed', detail: '推送出口无返回值' }
    try {
      const append = typeof ledgerAppend === 'function' ? ledgerAppend({ root }) : ledgerAppend
      append({
        at: nowIso(),
        seat: SEAT,
        kind: 'dangling-autotag',
        applied: true,
        tags: made,
        push: pushRes.status,
        pushDetail: pushRes.detail || '',
        unbacked: base.unbacked,
        outOfWeek: base.outOfWeek,
        already: base.already,
        conflicts: base.conflicts,
        deferred: base.deferred,
        failed: failedList.map((f) => `${f.tag}:${f.why}`),
      })
    } catch (e) {
      // 留痕写不进 ⇒ 大声明(可追责性缺口),但已打上的 tag 不回滚(加法动作,回滚才是破坏性)
      logger(
        `⚠️ 保活留痕写入失败(${String(e?.message ?? e).slice(0, 120)})⇒ 本轮动作不可事后问责,请人工补记`,
      )
    }
    if (failedList.length)
      logger(
        `❌ ${failedList.length} 枚 tag 打不上:${failedList
          .slice(0, 3)
          .map((f) => `${f.tag}(${f.why})`)
          .join(' ')}`,
      )
  }
  base.push = pushRes.status
  // 一枚也没打上 ⇒ 保活没做成,按可整改性分档(conflict=撞名交人工,refused=其余真失败,要响);
  // 打上过 ⇒ tagged(计数即凭据,失败枚数与推送结果在 kv 里可见,派发层按 push=failed 喊人)
  return finish({
    ...base,
    state: base.tagged > 0 ? 'tagged' : base.conflicts > 0 ? 'conflict' : 'refused',
  })
}

function main() {
  const argv = process.argv.slice(2)
  const known = new Set(['--apply', '--json', '--dry-run'])
  const unknown = argv.filter((a) => a.startsWith('-') && !known.has(a))
  if (unknown.length) {
    console.error(`❌ 不认识的旗标:${unknown.join(' ')} —— 本器只认 --apply / --dry-run / --json`)
    process.exit(2)
  }
  const apply = argv.includes('--apply')
  const res = autotagOnce({ apply, listOutOfWindow: true })
  if (argv.includes('--json')) console.log(JSON.stringify(res))
  if (res.state === 'undetermined') process.exit(2)
  if (res.state === 'refused' || res.state === 'conflict') process.exit(1)
  process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`❌ 无法判定(不是"没有悬空待备份",是"没判成"): ${e.message}`)
      process.exit(2)
    }
    console.error(`❌ 脚本执行异常: ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  ROOT,
  SEAT,
  LEDGER_REL,
  TAG_PREFIX,
  TAG_SHA_LEN,
  MAX_PER_ROUND,
  STATES,
  OID_RE,
  tagNameFor,
  parseGuardOutput,
  planAutotags,
  classifyNameHits,
  stripAnsi,
  autotagOnce,
  defaultRunGuard,
  defaultTagFace,
  defaultCreateTag,
  defaultPush,
  defaultLedgerAppend,
  // 门 30a 出口常量(测试据此证明"窗维/旗标不是本器自造")
  lossGuard,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
