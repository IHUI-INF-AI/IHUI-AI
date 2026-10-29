// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * push-divergence-watch.mjs —— 「本地与 origin/main 的分叉是否已经不该继续沉默」的唯一判据。
 *
 * 立因(2026-10-26 实测):守护 `scripts/git-guardian.mjs` 对推送分叉**零覆盖** —— 现读
 * `git rev-list --left-right --count HEAD...origin/main` = `120 326`(本地积压 120 枚、远端
 * 领先 326 枚),而守护日志与邮件通道里没有任何一行提到过这件事;当天人肉跑
 * `node scripts/git-push-converge.mjs` 才看得见。现读 `scripts/git-guardian.mjs` 里
 * `notifyGuardRed('…push…|…推送…|…分叉…)` 零命中 ⇒ 这一格从来没有腿。失效方向是安静(§12f)。
 *
 * 纪律(全部按仓内现行口径来,不新造一份):
 *  - **只读**:不写盘、不 fetch、不 push、不改任何 ref;唯一 IO 是读 push-state 与派生只读 git。
 *  - 派生 git 一律走 `face-reader.mjs` 的 `gitRaw()`(§12g:显式 stdio + windowsHide + 数字 timeout),
 *    本模块**不得**出现不经它的裸派生(Node 的 exec/spawn 家族一个都不许)。
 *  - push-state 的字段面(`{status,headSha,ts,pid,kind,reason,nextCommand}`,
 *    status ∈ running|done|failed|diverged)现读自 `scripts/git-push-guard.mjs:364-373`;
 *    「这条读数关于哪枚提交、多旧、算不算当下量的」一律 import
 *    `push-attempt-triage.mjs` 的 `pushStateProvenance()` + `PUSH_STATE_FRESH_MS`,不在这里重算(§0.6)。
 *  - 去重形状照 `git-guardian.mjs` 的跨端三条腿(头注 :3829-3838、窗口常量 :3839
 *    `CROSS_END_UNDET_HORIZON_MS` = 3h、`noteCrossEndUndetermined` :3846 / `settleCrossEndLeg` :3866):
 *    **身份稳定 + 持续档折档**,实现件用 `lib/git-guardian-pure.mjs`(它是库;git-guardian 是 daemon,不 import)。
 *  - 判机器状态 ⇒ **绝不进提交链**(§12e);本模块只产结论,寄信由调用方(guardian 巡检轮)交给
 *    `notifyGuardRed`(§5e 邮件单通道;§5e-3 的发信台账也在发信层,不在这里)。
 *
 * 「推送状态陈旧」归哪一档(任务点名要回答的问题)—— 结论:**既不记 breach,也不因它 unjudged**。
 * 依据是 `pushStateProvenance()` 自己的措辞(push-attempt-triage.mjs:456-468):读数过期或
 * headSha 不是当前 HEAD ⇒ `state='stale-record'`、label「历史残留/未现推」,并明写
 * 「**不得读成当下故障**」。所以陈旧只作废"推送通道状态"这一路输入(它不再能证明通道是坏的),
 * 而分叉本身由 `rev-list` 的左右计数独立可判 ⇒ 分类照旧走几何事实,只有在 `provenance.state`
 * 为 `absent`/`malformed` 时把这条"证据缺一角"如实写进 notes。真正 unjudged 的只有:
 * 没有 origin 远端 / 远端跟踪 ref 取不到 sha / rev-list 跑不动或解不出两数 / HEAD 取不到。
 *
 * 三态(§0.3「没判绝不写成判过」):
 *   ok        —— 分叉在可接受范围内(或已同步);
 *   breach    —— 该喊人,结论体自带 `nextCommand`(§5e-1 可整改性:收信人拿到信必须能动手);
 *   unjudged  —— 取不到输入,逐条点名缺了哪一路,不报警也不记绿。
 *
 * CLI(只读出口,§22d 用 pathToFileURL 判直执行):
 *   node scripts/lib/push-divergence-watch.mjs --status
 * 退出码:0=ok / 1=breach / 2=unjudged(与仓内三态约定同形)。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitRaw } from './face-reader.mjs'
import { pidAlive } from './home-heal-lock.mjs'
import {
  NOTIFY_DEFAULT_FAIL_COOLDOWN_MS,
  NOTIFY_DEFAULT_WINDOW_MS,
  alertHeldTier,
  shouldAlert,
  stableAlertFingerprint,
} from './git-guardian-pure.mjs'
import {
  CONVERGE_COMMAND,
  PUSH_STATE_FRESH_MS,
  pushStateProvenance,
} from './push-attempt-triage.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const envNum = (name, dflt) => {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n >= 0 ? n : dflt
}

/** 被盯的分支(本仓单分支纪律 §9b:除 main 外不新建分支 ⇒ 默认只盯 main)。 */
export const WATCH_BRANCH = String(process.env.IHUI_PUSH_WATCH_BRANCH || 'main').trim() || 'main'
/** 远端名(§16b:仓库只有 origin 一个远端;镜像远端 2026-10-23 已整体弃用)。 */
export const WATCH_REMOTE =
  String(process.env.IHUI_PUSH_WATCH_REMOTE || 'origin').trim() || 'origin'

/**
 * 本地积压(HEAD 有、远端没有)到人门槛。**取数依据(不是拍的)**:
 *  ① 仓内记录的最小真实事故量级 = 7 枚:`check-husky-hook-form.mjs:240` 记 2026-10-21 那次
 *     `core.hooksPath` 指向不存在目录 ⇒ post-commit 自动推送整链停摆两天,「本地积压 7 枚提交
 *     后才在手工收敛时暴露」。门槛必须 **< 7** 才能在那一型上喊出来。
 *  ② 现读提交节奏 `git rev-list --count --since=30.days HEAD` = 21,228 ⇒ ≈700 枚/天 ≈ 30 枚/小时,
 *     异步 worker 的正常在途积压是**秒级到一两枚**;5 枚已明显越过"刚提交还没推完"。
 *  ③ `PUSH_STATE_STALE_MS`(git-push-guard.mjs:375)= 5 min,与"5 枚"同量级(≈10 分钟节奏)。
 *  ⇒ 定 5;可用 `IHUI_PUSH_WATCH_LOCAL_AHEAD_MIN` 现调(调档不改判据形状)。
 */
export const LOCAL_AHEAD_BREACH_MIN = envNum('IHUI_PUSH_WATCH_LOCAL_AHEAD_MIN', 5)
/**
 * 纯落后(远端有、本地没有)到人门槛。依据:本仓多会话并发,落后 1-3 枚是常态(别人刚推完),
 * 而 2026-10-26 实测那场停摆里远端领先从 393 涨到 461 —— 门槛要能区分"刚落后一枚"和
 * "部署链已经在看旧代码"。取 50(≈1.5 小时节奏),明显低于事故读数,且出路是一条 ff-only 合并。
 */
export const REMOTE_AHEAD_BREACH_MIN = envNum('IHUI_PUSH_WATCH_REMOTE_AHEAD_MIN', 50)
/** 真分叉(两侧同时非零)门槛:1 枚即分叉,它不会因为"只有一枚"而变安全(推不出去,也没人会自动合)。 */
export const BOTH_AHEAD_BREACH_MIN = envNum('IHUI_PUSH_WATCH_BOTH_AHEAD_MIN', 1)

/** 同一分叉重报窗口:默认与守护邮件窗口同值(§5e-1「只按身份去重,禁止每日总量上限」)。 */
export const BREACH_WINDOW_MS = envNum('IHUI_PUSH_WATCH_WINDOW_MS', NOTIFY_DEFAULT_WINDOW_MS)
/** 上次没送达时的退避(反 spam,不是配额闸:只推迟下一封,永不封死)。 */
export const BREACH_FAIL_COOLDOWN_MS = envNum(
  'IHUI_PUSH_WATCH_FAIL_COOLDOWN_MS',
  NOTIFY_DEFAULT_FAIL_COOLDOWN_MS,
)
/** 未判定连击门槛:形状抄 `git-guardian.mjs:3839` 的 `CROSS_END_UNDET_HORIZON_MS`(3h ≈ 守护 90 趟)。 */
export const UNDET_HORIZON_MS = envNum('IHUI_PUSH_WATCH_UNDET_HORIZON_MS', 3 * 60 * 60 * 1000)

/** push-state 里"通道被策略/竞态挡着"这一族:积压不是任何人的疏忽,但出路在机主侧(§5e-1 白名单档)。 */
const POLICY_BLOCKED_KINDS = new Set(['protected-branch', 'remote-ref-race'])

/** 通道类积压的第一步(自述现读 git-push-guard.mjs:它先现读远端 tip 再推,幂等)。 */
export const PUSH_GUARD_COMMAND = 'node scripts/git-push-guard.mjs'

const SHA_RE = /^[0-9a-f]{7,64}$/i

/** `.ihui-agent/state/push-state.json` 的默认落点(§15:根由脚本自身位置推导,不信 cwd)。 */
export const DEFAULT_PUSH_STATE_FILE = resolve(ROOT, '.ihui-agent', 'state', 'push-state.json')

/** push-state 读取(只读;读不到一律返回 null,由分类层记成"证据缺一角",不冒充 failed)。 */
export function readPushState({ file = DEFAULT_PUSH_STATE_FILE } = {}) {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** `git rev-list --left-right --count` 的输出 → 左右计数(纯函数;解不出就是解不出,不补 0)。 */
export function parseRevListCount(raw) {
  const parts = String(raw ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length < 2)
    return {
      ok: false,
      why: `rev-list 输出不是"左 右"两列:${JSON.stringify(String(raw ?? '').slice(0, 40))}`,
    }
  const localAhead = Number(parts[0])
  const remoteAhead = Number(parts[1])
  if (
    !Number.isInteger(localAhead) ||
    !Number.isInteger(remoteAhead) ||
    localAhead < 0 ||
    remoteAhead < 0
  ) {
    return { ok: false, why: `rev-list 两列解出非负整数之外的值:[${parts[0]}, ${parts[1]}]` }
  }
  return { ok: true, localAhead, remoteAhead }
}

/**
 * 分类(纯函数,零 IO)。入参:
 * @param {{localAhead?:number|null, remoteAhead?:number|null, localHead?:string, remoteSha?:string,
 *          pushState?:object|null, remoteIsAncestorOfHead?:boolean|null, pidAliveFn?:(pid:number)=>boolean,
 *          now?:number, thresholds?:{local:number, remote:number, both:number}}}
 */
export function classifyDivergence(input = {}) {
  const {
    localHead = '',
    remoteSha = '',
    pushState = null,
    remoteIsAncestorOfHead = null,
    pidAliveFn = pidAlive,
    now = Date.now(),
    thresholds = {},
  } = input
  const localMin = Number.isFinite(thresholds.local) ? thresholds.local : LOCAL_AHEAD_BREACH_MIN
  const remoteMin = Number.isFinite(thresholds.remote) ? thresholds.remote : REMOTE_AHEAD_BREACH_MIN
  const bothMin = Number.isFinite(thresholds.both) ? thresholds.both : BOTH_AHEAD_BREACH_MIN

  // ── 先问输入够不够(§0.3:取不到 ⇒ 显式未判定,既不记绿也不冒红) ──
  const missing = []
  const localOk = typeof localHead === 'string' && SHA_RE.test(localHead.trim())
  const remoteOk = typeof remoteSha === 'string' && SHA_RE.test(remoteSha.trim())
  const counts = parseRevListCount(
    Number.isInteger(input.localAhead) && Number.isInteger(input.remoteAhead)
      ? `${input.localAhead} ${input.remoteAhead}`
      : '',
  )
  if (!counts.ok) missing.push({ key: 'rev-list', why: counts.why })
  if (!localOk)
    missing.push({
      key: 'localHead',
      why: `本地 HEAD sha 取不到或形态不像 sha:${JSON.stringify(String(localHead).slice(0, 12))}`,
    })
  if (!remoteOk)
    missing.push({
      key: 'remoteSha',
      why: `远端跟踪 ref(${WATCH_REMOTE}/${WATCH_BRANCH})取不到 sha ⇒ 分叉无从算;出路:git fetch ${WATCH_REMOTE} ${WATCH_BRANCH}`,
    })
  if (input.originRemotePresent === false)
    missing.push({
      key: 'originRemote',
      why: `仓库没有名为 ${WATCH_REMOTE} 的远端 ⇒ 谈不上"与远端分叉"`,
    })
  if (missing.length > 0) {
    return {
      state: 'unjudged',
      band: 'input-missing',
      severity: 'none',
      counts: { localAhead: input.localAhead ?? null, remoteAhead: input.remoteAhead ?? null },
      missing,
      notes: [],
      nextCommand: null,
      localHead,
      remoteSha,
      text: `未判定:${missing.map((m) => m.key).join(' / ')} 取不到 ⇒ 本轮不报分叉、也不签发"已同步"(起点门槛 ${Math.round(UNDET_HORIZON_MS / 60000)}min 连击才按"这一格瞎了"升级到人)。`,
    }
  }

  const localAhead = counts.localAhead
  const remoteAhead = counts.remoteAhead
  const provenance = pushStateProvenance({
    pushState,
    localHead,
    now,
    freshMs: PUSH_STATE_FRESH_MS,
  })
  const notes = []
  if (provenance.state === 'absent' || provenance.state === 'malformed') {
    notes.push(`推送通道状态这一路证据缺位(${provenance.label})⇒ 结论只建立在计数与几何关系上`)
  }
  const sameTip = localHead.trim().toLowerCase() === remoteSha.trim().toLowerCase()
  const kind = typeof pushState?.kind === 'string' ? pushState.kind : ''
  const status = typeof pushState?.status === 'string' ? pushState.status : ''
  const inFlight =
    status === 'running' && provenance.state === 'current' && pidAliveFn(Number(pushState?.pid))

  const base = {
    localHead,
    remoteSha,
    counts: { localAhead, remoteAhead },
    provenance,
    notes,
    kind,
    status,
  }

  // ── 两侧都零:唯一能叫"已同步"的形态,且必须 sha 也对得上 ──
  if (localAhead === 0 && remoteAhead === 0) {
    if (sameTip) {
      return {
        ...base,
        state: 'ok',
        band: 'synced',
        severity: 'none',
        nextCommand: null,
        missing: [],
        text: `已同步:${WATCH_REMOTE}/${WATCH_BRANCH} == HEAD(${localHead.slice(0, 7)})。`,
      }
    }
    // git-push-guard.mjs:802 记过这一型:"HEAD 不同但无 ahead/behind commit"(shallow/残值)。
    // 说"已同步"是假绿,说"分叉"是没证据 ⇒ 如实 unjudged。
    return {
      ...base,
      state: 'unjudged',
      band: 'ref-anomaly',
      severity: 'none',
      nextCommand: null,
      missing: [
        {
          key: 'geometry',
          why: `左右计数均为 0 但 ${WATCH_REMOTE}/${WATCH_BRANCH}(${remoteSha.slice(0, 7)})≠HEAD(${localHead.slice(0, 7)})⇒ 读数自相矛盾(shallow/残值)`,
        },
      ],
      text: '未判定:计数说"不偏不倚",sha 说"两边不是同一枚"⇒ 不猜哪句是真的(出路:git fetch 后重读)。',
    }
  }

  // ── 两侧同时非零:真分叉。推不出去、也不会自愈,唯一出路是收敛器 ──
  if (localAhead >= bothMin && remoteAhead >= bothMin) {
    const remedy =
      typeof pushState?.nextCommand === 'string' && pushState.nextCommand.trim()
        ? pushState.nextCommand.trim()
        : CONVERGE_COMMAND
    if (inFlight)
      notes.push('push-state 显示有 worker 正在推(running/pid 存活);真分叉不是推能解决的,故仍到人')
    return {
      ...base,
      state: 'breach',
      band: 'true-divergence',
      severity: 'critical',
      nextCommand: remedy,
      missing: [],
      text:
        `真分叉:本地独有 ${localAhead} 枚、${WATCH_REMOTE}/${WATCH_BRANCH} 独有 ${remoteAhead} 枚 ⇒ 普通 push 一定被 non-fast-forward 拒收,` +
        `而守护与 post-commit 都不会自动合它(§16b:遇 non-FF 只能走收敛器)。下一步:${remedy}`,
    }
  }

  // ── 只有本地有:积压未推。worker 在途(新鲜 running 且 pid 活)才是"还没来得及推" ──
  if (localAhead > 0 && remoteAhead === 0) {
    if (inFlight) {
      return {
        ...base,
        state: 'ok',
        band: 'push-in-flight',
        severity: 'none',
        nextCommand: null,
        missing: [],
        text: `本地独有 ${localAhead} 枚,后台推送在途(running,pid ${pushState?.pid} 存活)⇒ 不喊人。`,
      }
    }
    if (localAhead < localMin) {
      return {
        ...base,
        state: 'ok',
        band: 'within-backlog-budget',
        severity: 'none',
        nextCommand: null,
        missing: [],
        text: `本地独有 ${localAhead} 枚 < 门槛 ${localMin} ⇒ 属异步推送的正常在途量,不喊人。`,
      }
    }
    const blockedByPolicy = POLICY_BLOCKED_KINDS.has(kind) && remoteIsAncestorOfHead === true
    return {
      ...base,
      state: 'breach',
      band: blockedByPolicy ? 'local-backlog-policy' : 'local-backlog',
      severity: 'warning',
      // nextCommand 一律是**可直接照抄执行**的那一条(不加说明性后缀,否则"出路"本身跑不通 = §0.8);
      // 说理与第二步写在 text / remedyNote 里。
      nextCommand: PUSH_GUARD_COMMAND,
      missing: [],
      remedyNote: blockedByPolicy
        ? `推送被远端策略/竞态挡住(kind=${kind})且远端 tip 已在本地祖先线内 ⇒ 积压不是任何人的疏忽,真正要改的是仓库设置:Settings→Branches 放开直推,或整仓改走 PR(归机主侧)`
        : `先复现真因(它现读远端 tip 再推,幂等);若回显 non-fast-forward ⇒ ${CONVERGE_COMMAND}`,
      text:
        `本地积压 ${localAhead} 枚未推(≥门槛 ${localMin};${provenance.label},读数距今 ${provenance.ageText ?? '未知'})。` +
        (blockedByPolicy ? '真解在机主侧,见 remedyNote。' : '') +
        `不得把 "git log ${WATCH_REMOTE}/${WATCH_BRANCH}..HEAD" 的枚数读成"已推送"(git-push-guard.mjs:1106)。` +
        `下一步:${PUSH_GUARD_COMMAND};${blockedByPolicy ? '' : CONVERGE_COMMAND + ' 作第二步'}`,
    }
  }

  // ── 只有远端有:本地落后。快进合并即可,长期不合 = 部署链在看旧代码 ──
  if (remoteAhead > 0 && localAhead === 0) {
    if (remoteAhead < remoteMin) {
      return {
        ...base,
        state: 'ok',
        band: 'behind-normal',
        severity: 'none',
        nextCommand: null,
        missing: [],
        text: `落后 ${remoteAhead} 枚 < 门槛 ${remoteMin} ⇒ 多会话并发的常态,不喊人。`,
      }
    }
    return {
      ...base,
      state: 'breach',
      band: 'remote-ahead-stale',
      severity: 'warning',
      nextCommand: `git fetch ${WATCH_REMOTE} ${WATCH_BRANCH} && git merge --ff-only FETCH_HEAD`,
      missing: [],
      text: `本地落后 ${WATCH_REMOTE}/${WATCH_BRANCH} ${remoteAhead} 枚(≥门槛 ${remoteMin})⇒ 工作副本长期在看旧代码,后续 push 也会撞上分叉。下一步:git fetch ${WATCH_REMOTE} ${WATCH_BRANCH} && git merge --ff-only FETCH_HEAD(同步一律 fetch + ff-only,§16 禁 rebase,已有 pre-rebase 钩子硬拦)`,
    }
  }

  // 兜底:两侧都非零但都没过各自门槛(单侧 0 的分支上面已穷尽)⇒ 只可能是 bothMin 被人为调到 >1
  return {
    ...base,
    state: 'ok',
    band: 'within-budget',
    severity: 'none',
    nextCommand: null,
    missing: [],
    text: `本地独有 ${localAhead} / 远端独有 ${remoteAhead},未越过任一分档门槛 ⇒ 本轮不喊人(门槛现读:${Math.round(localMin)}/${Math.round(remoteMin)}/${Math.round(bothMin)})。`,
  }
}

/**
 * 报警身份(§5e-1:去重按**稳定语义身份**,不把 sha/时刻/原始计数塞进去重键 ——
 * 守门 224 `check-alert-identity-volatility` 拦的正是那一型)。
 * 身份只由「分档名 band」+「(可选)持续档」构成:同一场分叉里计数从 120 抖到 121、
 * sha 从 A 换到 B,都仍是同一枚身份 ⇒ 4h 窗口内压住;跨持续档(6h/24h/72h)才是新身份,
 * 越拖越响(git-guardian.mjs:1796 的 held= 用法同型)。
 */
export function buildAlertIdentity(verdict, { heldFirstMs = null, now = Date.now() } = {}) {
  const band = String(verdict?.band ?? 'unknown')
  const held = heldFirstMs === null ? { tier: 'none' } : alertHeldTier(heldFirstMs, now)
  const dedupKey = `push-divergence;band=${band};held=${held.tier}`
  const name = `本地与 ${WATCH_REMOTE}/${WATCH_BRANCH} 分叉(${band})`
  const fp = stableAlertFingerprint(name, dedupKey)
  const lines = []
  if (verdict?.counts)
    lines.push(
      `现读:本地独有 ${verdict.counts.localAhead} 枚 / ${WATCH_REMOTE}/${WATCH_BRANCH} 独有 ${verdict.counts.remoteAhead} 枚`,
    )
  if (verdict?.provenance?.text) lines.push(verdict.provenance.text)
  lines.push(verdict?.text ?? '')
  if (Array.isArray(verdict?.notes) && verdict.notes.length)
    lines.push(`注:${verdict.notes.join(';')}`)
  if (verdict?.nextCommand) lines.push(`出路(§5e-1 可整改性):${verdict.nextCommand}`)
  if (typeof verdict?.remedyNote === 'string' && verdict.remedyNote)
    lines.push(`第二步/真解:${verdict.remedyNote}`)
  return {
    name,
    dedupKey,
    fingerprint: fp,
    severity: verdict?.severity ?? 'warning',
    detail: lines.filter(Boolean).join('\n'),
  }
}

/**
 * 「这一轮的 breach 到底寄不寄」—— 纯函数,零 IO:调用方把自己那份 notify-state 传进来
 * (与 `notifyGuardRed` 用的 `{fp,ts,delivered}` 表同形),判据不复制第二份。
 */
export function shouldReportBreach({
  notifyState = {},
  verdict,
  now = Date.now(),
  windowMs = BREACH_WINDOW_MS,
  failCooldownMs = BREACH_FAIL_COOLDOWN_MS,
  heldFirstMs = null,
} = {}) {
  if (!verdict || verdict.state !== 'breach')
    return {
      report: false,
      why: `本轮结论=${verdict?.state ?? '(无)'} ⇒ 不派人(§5e:只有 breach 才到人)`,
    }
  const id = buildAlertIdentity(verdict, { heldFirstMs, now })
  const key = id.dedupKey
  const pass = shouldAlert(notifyState, key, id.fingerprint, now, { windowMs, failCooldownMs })
  return {
    report: pass,
    identity: id,
    key,
    why: pass ? '新身份或窗口已过' : '同一身份窗口内已通报,本轮压住',
  }
}

// ─── 只读取材(默认实现;测试一律注入 run,不去碰真 git/真状态件) ───────────────────
function defaultGitRun(args, { root = ROOT } = {}) {
  return gitRaw(args, root)
}

/**
 * 把分类需要的输入取齐(全程只读)。任何一路取不到 ⇒ 记进 `unresolved` 并留 null,
 * 由 classifyDivergence 落 unjudged —— 这里绝不"补一个 0"或"当成没分叉"。
 */
export function readDivergenceInput({
  root = ROOT,
  run = defaultGitRun,
  pushState = undefined,
  now = Date.now(),
  pushStateFile,
} = {}) {
  const unresolved = []
  const ref = `${WATCH_REMOTE}/${WATCH_BRANCH}`
  const sha = (v) => String(v ?? '').trim()

  let originPresent = true
  try {
    run(['remote', 'get-url', WATCH_REMOTE], { root })
  } catch (e) {
    originPresent = false
    unresolved.push({ key: 'originRemote', why: String(e?.message ?? e).slice(0, 120) })
  }

  let localHead = ''
  try {
    localHead = sha(run(['rev-parse', 'HEAD'], { root }))
  } catch (e) {
    unresolved.push({ key: 'localHead', why: String(e?.message ?? e).slice(0, 120) })
  }

  let remoteSha = ''
  try {
    remoteSha = sha(run(['rev-parse', '--verify', '-q', `refs/remotes/${ref}`], { root }))
  } catch (e) {
    unresolved.push({
      key: 'remoteSha',
      why: `跟踪 ref 取不到:${String(e?.message ?? e).slice(0, 110)}`,
    })
  }

  let localAhead = null
  let remoteAhead = null
  if (localHead && remoteSha) {
    try {
      const parsed = parseRevListCount(
        run(['rev-list', '--left-right', '--count', `${localHead}...${remoteSha}`], { root }),
      )
      if (parsed.ok) {
        localAhead = parsed.localAhead
        remoteAhead = parsed.remoteAhead
      } else unresolved.push({ key: 'rev-list', why: parsed.why })
    } catch (e) {
      unresolved.push({ key: 'rev-list', why: String(e?.message ?? e).slice(0, 120) })
    }
  } else {
    unresolved.push({ key: 'rev-list', why: 'HEAD 或远端 tip 取不到 ⇒ 无从算左右计数' })
  }

  // 祖先关系只服务于"策略挡住"那一档的措辞;取不到一律 null(不猜)
  let remoteIsAncestorOfHead = null
  if (localHead && remoteSha) {
    try {
      run(['merge-base', '--is-ancestor', remoteSha, localHead], { root })
      remoteIsAncestorOfHead = true
    } catch (e) {
      remoteIsAncestorOfHead = Number(e?.status) === 1 ? false : null
      if (remoteIsAncestorOfHead === null)
        unresolved.push({ key: 'ancestor', why: `祖先关系取不到(不影响主判据,只影响"策略档"措辞)` })
    }
  }

  return {
    root,
    now,
    originRemotePresent: originPresent,
    localHead,
    remoteSha,
    localAhead,
    remoteAhead,
    remoteIsAncestorOfHead,
    pushState:
      pushState === undefined
        ? readPushState(pushStateFile ? { file: pushStateFile } : {})
        : pushState,
    unresolved,
  }
}

/** 一步到位:取材 + 分类(调用方拿到 verdict;要不要寄信交给 shouldReportBreach)。 */
export function watchPushDivergence(opts = {}) {
  const input = readDivergenceInput(opts)
  const verdict = classifyDivergence(input)
  return { input, verdict }
}

export const __test__ = {
  classifyDivergence,
  buildAlertIdentity,
  shouldReportBreach,
  parseRevListCount,
  readPushState,
  readDivergenceInput,
  watchPushDivergence,
  PROVENANCE_STATES: ['current', 'stale-record', 'absent', 'malformed'],
  POLICY_BLOCKED_KINDS,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const arg = process.argv.slice(2)
  if (arg.includes('--status')) {
    const { verdict } = watchPushDivergence()
    console.log(verdict.text)
    if (verdict.state === 'unjudged') {
      for (const m of verdict.missing) console.log(`  · 未判定来源 ${m.key}:${m.why}`)
    }
    if (verdict.state === 'breach')
      console.log(`  · 报警身份:${buildAlertIdentity(verdict).dedupKey}`)
    process.exit(verdict.state === 'ok' ? 0 : verdict.state === 'breach' ? 1 : 2)
  }
  console.log(
    '用法:node scripts/lib/push-divergence-watch.mjs --status(只读;0=ok / 1=breach / 2=unjudged)',
  )
}

export { CONVERGE_COMMAND, PUSH_STATE_FRESH_MS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
