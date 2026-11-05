// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-autonomy-leg-health — 自开发/自修复「发起腿」健康尺(2026-11-01 立)。
 *
 * 为什么需要它:auto-evolve 的发起腿在本机死了 6 天(台账 53 行现读 = dispatch 48 轮里
 * session-ok 仅 1),期间没有任何一把尺子在量"这条腿还活着吗"。失败被记成票面失败并封票,
 * 于是**真因(执行体路径钉死别机盘符)被账面的"票失败"完全遮住** —— 典型的安静失效型。
 *
 * 判据一律 import,零复算(§0.6):
 *   - preflight/分型 = scripts/lib/autonomy-runner.mjs(与派发那一刻用的是同一实现);
 *   - 封票/连败判据 = scripts/auto-evolve.mjs 的 quarantinedUntilOf/failureStreakOf;
 *   - 取票口径 = scripts/plan-tasks.mjs(经 auto-evolve 的 pickTickets 唯一入口,不自拼旗标)。
 *
 * 档位:**判机器状态 ⇒ 刻意不进提交链**(§12e 恒红门禁令:提交者结构上满足不了"这台机的
 * 执行体在位");调度 = git-guardian 巡检轮,判红经到人通道按稳定身份去重(§5e-3)。
 *
 * A11-closure-output(2026-11-04 立):A1-A10 全族问的是"工序在不在位、腿有没有动",
 * 没有一条问"腿动了之后闭环有没有产出"。实测 deploy-outcome-intake 的派发戳每 20min
 * 照刷、A8 判绿,而 incident-signals.jsonl 静默 6 天(根因:action 闭集漏 swap-fail,
 * 一行未知 action 让整趟摄入零产出)。这一维直接复用摄入器生产判据 planIntake() 做
 * **只读对账**:决策账里"该产而信号账里没有"的条数 >0 ⇒ drift。它不是"没事故就报红"
 * 的恒红门 —— 全 pass 的决策账待产恒 0 ⇒ ok,量的是可整改的漏产(重跑摄入器即清)。
 *
 * A14-executor-face-stall(2026-11-05 立):A13 说"从未入库",但**为什么这一轮次根本没跑判据**没人问。
 * 自我面闸把"盘上缺被审面已有锚点"判成停派(方向对),两档都带 informational ⇒ 不计连败也不计空转(也对),
 * 于是"一直停"在账面是安静的;而当次实测被执行的那份正是缺锚点的那份(盘上缺 7/7 条、mtime 8.54h,
 * 派发节拍中位 0.64h ⇒ 一停就是十几个班次),而它自己不含那道闸 ⇒ 台账里连 `runner-face-*` 都不会写。
 * 本维不要时间阈值(§"阈值必须量出来"的反面就是别拍数):缺锚点数 > 0 是二值事实 —— 跑的代码 ≠ 被判的代码。
 * mtime 只进读数当旁证。判据与锚点表零复算:走门 299 的 parseInvariants。
 *
 * A13-artifact-landing(2026-11-05 立,/goal 收尾审计):A11 对账的是"事故摄入腿",
 * 而**自主环自己有没有把产物送进 HEAD 从来没被量过**。当次现读:台账 248 行跨 10 天,
 * session-ok 9 枚 / artifact-manifest-missing 9 枚 / **artifact-committed 0 枚**,
 * 而 A1-A12 全绿 ⇒ "跑了十天、一枚没落"在账面不可见(§0.9:判据不在真跑它的那一刻成立=没有)。
 * 落地档/拒绝档都从 lib/autonomy-nonprogress.mjs 的两张表按 `artifact-` 前缀派生(§0.6 零复算),
 * 会话结果档射程走 sessionResultActionsOf(被审面) 那一份解析。三态见 judgeArtifactLanding 头注。
 *
 * A12-leg-output-reconciliation(2026-11-04 立,/goal R3):A11 只给一条腿做产出对账,
 * 其余 11 腿仍只有 A8 的戳龄。实测 dep-radar 戳照刷、A1-A11 全绿,而产出账停在 10-30、
 * 守护日志连续 5 天自报「未判定」(pnpm audit 继承守护进程失效代理 ⇒ stdout 空)。
 * 这一维按登记表 outputKind 三分类对账全部 12 腿:always 静默超窗 ⇒ drift;
 * conditional 静默超窗且**该腿最近一条日志**自报未判定 ⇒ unjudged(点名输入面);
 * 静默但无自报 ⇒ ok(合法静默,不许做成恒红门);none / coveredBy ⇒ n/a。
 * 判据单一真源 scripts/lib/autonomy-leg-output.mjs,本层只搬运输入:登记表按被审面取,
 * 产出台账/派发戳/守护日志是运行态只读盘上真值,日志 20MiB+ 只 tail 最近 4MiB。
 *
 * 用法:node scripts/check-autonomy-leg-health.mjs [--json] [--self-test] [--repo-root <path>]
 *      [--api-base <url>] [--ai-base <url>] [--staged|--worktree]
 * 判定面纪律(§0.4):闸门配置按被审面取 —— 默认 HEAD blob,`--staged` 判索引,
 *   `--worktree` 只给人工现场诊断;取不到 ⇒ exit 2 未判定,**不回落另一个面**。
 * 退出码:0=ok / 1=drift(点名可整改项)/ 2=unjudged(取不到输入,不记绿也不冒红)
 */
import {
  readFileSync,
  existsSync,
  readdirSync,
  statSync,
  openSync,
  readSync,
  closeSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  preflightSessionRunner,
  classifySessionFailure,
  resolveSessionCommand,
} from './lib/autonomy-runner.mjs'
import {
  quarantinedUntilOf,
  LEDGER,
  DISPATCH_ARGS,
  parseTicketRows,
  PLAN_TASKS,
} from './auto-evolve.mjs'
import { ticketKeyOf } from './lib/ticket-key.mjs'
import { classifyLegs, actionableRows } from './lib/autonomy-leg-liveness.mjs'
// A12 全腿产出对账(2026-11-04 /goal R3):判据独立成库,本层只搬运输入 + 包成维度。
import { classifyLegOutputs } from './lib/autonomy-leg-output.mjs'
// A13 的 artifact 词汇零复算(§0.6):落地档/拒绝档都从阶梯那张表按前缀派生
import { PROGRESS_ACTIONS, NON_PROGRESS_ACTIONS } from './lib/autonomy-nonprogress.mjs'
import { UNKNOWN_RULE_ID, classifyAction, parseValveList, BUCKETS } from './lib/human-valve.mjs'
import { judgeCarrierParity, judgeRoadmapClaims } from './lib/guardian-carrier-parity.mjs'
// A14 的锚点表与解析器零复算(§0.6):"什么算一条判据锚点、怎么算命中"只住在门 299 那一份里。
import { __test__ as INV_GATE } from './check-autonomy-invariants.mjs'
// A11 判据零复算(§0.6):闭环有没有产出,由摄入器自己的 planIntake() 说了算,
// 本尺不自造第二份"该产几条"的算法。装饰性依赖之外全是纯函数,import 不触发写盘。
import { deployDecisionsFace } from './lib/deploy-decisions-face.mjs'
import {
  readDecisionText,
  parseExistingSignals,
  planIntake,
  DEFAULT_MINUTES,
} from './deploy-outcome-intake.mjs'
import { loadContract } from './lib/incident-cluster.mjs'
// 取材面纪律(§0.4 / 守门 118):闸门配置是**仓库内容**,一律按被审面取,不回落磁盘。
// 共享工作树常年滞后 HEAD ⇒ 按磁盘读会在"恒红"与"假绿"之间来回跳,正是这一型。
import { Undetermined, catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// git spec 一律正斜杠:join() 在 Windows 上产出 `scripts\data\...`,git 认不出这个 pathspec
// (实测:同一枚文件用反斜杠 spec 恒"取不到",会被误读成未判定)。
const GATES_REL = 'scripts/data/auto-evolve-gates.json'
const ARGS = process.argv.slice(2)
const FACE_SEL = selectFace({
  staged: ARGS.includes('--staged'),
  worktree: ARGS.includes('--worktree'),
  def: 'head',
})
const FACE_TXT = {
  head: 'HEAD blob(全量档)',
  staged: '索引 blob(本次提交会带走的那一份)',
  worktree: '工作树(人工逃生舱,提交链不走这档)',
}

/** 按被审面取任意仓库内文件(与 readGatesFace 同一口径,不另写第二份取面逻辑)。 */
export function readFaceText(rel, face = FACE_SEL.face, root = ROOT) {
  if (face === 'worktree') {
    const t = readWorktreeFile(root, rel)
    if (t === null || t === undefined) throw new Undetermined(`工作树(逃生舱)取不到 ${rel}`)
    return t
  }
  const spec = (face === 'staged' ? ':' : 'HEAD:') + rel
  const got = catBatch(root, [spec], { maxBuffer: 1 << 26 })
  const t = got.get(spec)
  if (t === null || t === undefined)
    throw new Undetermined(`${face === 'staged' ? '索引' : 'HEAD'} 取不到 ${rel}`)
  return t
}

/** 按被审面取闸门配置;取不到抛 Undetermined,由调用方折成 exit 2 —— 不回落另一个面。 */
export function readGatesFace(face = FACE_SEL.face, root = ROOT) {
  if (face === 'worktree') {
    const t = readWorktreeFile(root, GATES_REL)
    if (t === null || t === undefined) throw new Undetermined(`工作树(逃生舱)取不到 ${GATES_REL}`)
    return t
  }
  const spec = (face === 'staged' ? ':' : 'HEAD:') + GATES_REL
  const got = catBatch(root, [spec], { maxBuffer: 1 << 26 })
  const t = got.get(spec)
  if (t === null || t === undefined)
    throw new Undetermined(`${face === 'staged' ? '索引' : 'HEAD'} 取不到 ${GATES_REL}`)
  return t
}

/** 读台账(缺文件 ⇒ 空集,但由调用方如实标 unjudged,不用 0 冒充"没失败过")。
 *  默认全量读:`limit` 截断会把超窗历史行挤出被审面,判据就会随台账增长悄悄变绿/变红(§12e)。 */
export function readLedgerEvents(limit = Infinity) {
  if (!existsSync(LEDGER)) return { ok: false, events: [], why: `台账不在位:${LEDGER}` }
  const raw = readFileSync(LEDGER, 'utf8').trim()
  if (!raw) return { ok: true, events: [], why: '台账空' }
  const events = raw
    .split('\n')
    .slice(Number.isFinite(limit) ? -limit : 0)
    .map((l) => {
      try {
        return JSON.parse(l)
      } catch {
        return null
      }
    })
    .filter(Boolean)
  return { ok: true, events, why: '' }
}

/**
 * A1 发起腿存续:拿当次仓根去问盘。
 * 这一维是"今天能不能起会话"的直接凭据,不是配置文本的间接推断。
 */
export function judgePreflight(template, repoRoot) {
  const pf = preflightSessionRunner(template, repoRoot)
  if (pf.state === 'ready')
    return {
      dim: 'A1-preflight',
      state: 'ok',
      readout: `在位核验 ${pf.checked.length} 枚全通过`,
      next: '',
    }
  if (pf.state === 'template-empty')
    return {
      dim: 'A1-preflight',
      state: 'unjudged',
      readout: '模板空 = dry-run 档',
      next: '要真派就得配 sessionCommandTemplate(仓根写 ${REPO_ROOT})',
    }
  return {
    dim: 'A1-preflight',
    state: pf.state === 'missing' ? 'drift' : 'unjudged',
    readout: pf.why,
    next: `出路:核 ${GATES_REL} 的 sessionCommandTemplate 与执行体产物;不在位清单=${(pf.missing ?? []).join(' , ') || '(未枚举到路径 token)'}`,
  }
}

/**
 * A2 分型诚实性:有没有"执行体级失败"被记成票面失败并计入连败/封票。
 * 病灶形态正是本仓最容易复发的类型 —— 调度器自伤,债摊给真工作。
 */
export function judgeMisattribution(events) {
  const envFailed = events.filter(
    (e) =>
      e.action === 'session-failed' &&
      classifySessionFailure({ status: e.exitCode, stderr: e.why, error: '' }).kind ===
        'environment',
  )
  const envKeys = new Set(envFailed.map((e) => e.ticketKey).filter(Boolean))
  const live = Date.now()
  const wronglyQuarantined = events.filter(
    (e) =>
      e.action === 'quarantined' &&
      envKeys.has(e.ticketKey) &&
      new Date(e.until ?? 0).getTime() > live,
  )
  if (wronglyQuarantined.length > 0) {
    return {
      dim: 'A2-attribution',
      state: 'drift',
      readout: `此刻仍被冤封的票 ${wronglyQuarantined.length} 枚(历史执行体级失败 ${envFailed.length} 轮仅作报数)`,
      next: wronglyQuarantined
        .map(
          (q) =>
            `冤封:${q.ticketKey} :: ${String(q.ticketLine).slice(0, 80)}(至 ${q.until})⇒ 摘对应 quarantined 行,该票即可重派`,
        )
        .join('\n'),
    }
  }
  // 历史失败行不永久顶红(§12e:与"当下能否整改"无关的判据 = 恒红门);只在"新式分型根本没接住"时报数。
  return {
    dim: 'A2-attribution',
    state: 'ok',
    readout: `无冤封在册;近 ${events.length} 轮执行体级失败 ${envFailed.length} 轮${envFailed.length ? '(已由 runner-unavailable 分型接住)' : ''}`,
    next: '',
  }
}

/** A3 射程:封禁中的票占派单面多少 —— 自开发被自己的故障锁死到什么程度。
 *  票键必须按 ticketKeyOf(行文本) 现算:parseTicketRows 只给 {text,line},
 *  拿不存在的 t.key 去比集合会恒 miss ⇒ 把"整面被封"读成"封禁中 0 行"的假绿(§0.3 禁以 0 冒充没有)。
 *
 *  档位(2026-11-01 收,治本维恒红):封禁行是**当前机器状态**,不是"本次改动带进来的"。
 *  合理封禁(票自身失败,由 A2 判定不是冤封)是台账该记的真工作,不是尺子该报的故障 ——
 *  原判据"有 1 行封禁即 drift"在现网 1/21(4.8%)时天天顶红,正是 §12e 恒红门的形状:
 *  提交者结构上整改不了(那是别人在飞的票),只能学会忽略报警。
 *  故只在**封禁吃掉过半射程**时报 drift —— 过半 = 派单面大半票结构上派不出去,
 *  "自开发"名存实亡,这一档才配叫人。其余一律 ok 报数。
 */
const STRUCTURAL_LOCK_RATIO = 0.5

export function judgeRange(events, ticketRows) {
  if (!ticketRows || ticketRows.length === 0)
    return {
      dim: 'A3-range',
      state: 'unjudged',
      readout: '派单面取不到 ⇒ 射程判不出',
      next: '先修 plan-tasks 取票口',
    }
  const ledger = events
  const live = Date.now()
  const blockedRows = ticketRows.filter((t) => {
    const key = ticketKeyOf(String(t.text ?? ''))
    const until = quarantinedUntilOf(ledger, key)
    return until && new Date(until).getTime() > live
  })
  const pct = ((blockedRows.length / ticketRows.length) * 100).toFixed(1)
  const locked = blockedRows.length / ticketRows.length > STRUCTURAL_LOCK_RATIO
  return {
    dim: 'A3-range',
    state: locked ? 'drift' : 'ok',
    readout: `派单面 ${ticketRows.length} 行,其中封禁中 ${blockedRows.length} 行(${pct}%)${locked ? '' : `,未达结构性锁死线(${STRUCTURAL_LOCK_RATIO * 100}%)⇒ 只报数不顶红`}`,
    next: locked
      ? `出路:封禁已吃掉过半射程 —— 逐行确认封禁是否源自调度器自身故障(A2 已点名 ${blockedRows
          .slice(0, 3)
          .map((r) => String(r.text).slice(0, 40))
          .join(' / ')});是则摘 quarantined 行,不得靠延长 quarantine 兜`
      : '',
  }
}

/** A4 白名单命中率:自开发射程有多宽(实测 25 轮 no-whitelist-hit 的对应维)。 */
export function judgeWhitelist(events, whitelist) {
  const hits = events.filter((e) => e.action === 'no-whitelist-hit').length
  // "真派发"按 `session-` 前缀认,不按枚举个数(2026-11-04):调度器新增 `session-no-write`(exit 0 但整班
  // 零写盘)之后,枚举个数的写法会把"跑了会话"读成"一次都没派"⇒ 本维由 ok 翻假红。前缀认法的失效方向
  // 是"多算一次派发",与 §0.10"宁可多要一次说明"同向;真需要区分档位的是 A7,不是这里。
  const dispatched = events.filter((e) => String(e.action ?? '').startsWith('session-')).length
  if (whitelist.length === 0)
    return {
      dim: 'A4-whitelist',
      state: 'drift',
      readout: '白名单空 ⇒ 结构上无票可派',
      next: '登记票类或显式置 dry-run',
    }
  return {
    dim: 'A4-whitelist',
    state: hits > 0 && dispatched === 0 ? 'drift' : 'ok',
    readout: `近 ${events.length} 轮:未命中白名单 ${hits} 轮 / 真派发 ${dispatched} 轮 / 白名单 ${whitelist.length} 档`,
    next:
      hits > 0 && dispatched === 0
        ? '出路:白名单与派单面题型不匹配 ⇒ 按证据扩档(每扩一档都得有对应的失败分型/预算闸兜着),不得借道 --no-verify 式绕行'
        : '',
  }
}

/**
 * A8-leg-liveness —— 各自治腿"按不按自己的节律在动"(判据零复算,全 import
 * `scripts/lib/autonomy-leg-liveness.mjs` 的 classifyLegs/actionableRows)。
 *
 * 这一维补的是 A1-A7 整族的口径缺口:那七条问的是"工序在不在位、有没有被走到",
 * 没有一条问"这台机器多久没动了"。实测同一天两格都是这么漏掉的 ——
 * 号池哨兵盲 146 轮(19h)与部署反馈腿静默 36h,A 面当时一律报 OK=7 DRIFT=0。
 * @param {ReturnType<typeof classifyLegs>|null} res 取不到 ⇒ unjudged,不读成"没有黑腿"
 */
export function judgeLegLiveness(res) {
  if (!res || typeof res.state !== 'string') {
    return {
      dim: 'A8-leg-liveness',
      state: 'unjudged',
      readout: '派发戳/登记表取不到 ⇒ 静默时长没量',
      next: '先让量的人拿得到输入(§0.3)',
    }
  }
  const bad = actionableRows(res)
  const names = bad
    .slice(0, 4)
    .map(
      (r) =>
        `${r.id.replace(/-dispatch-last\.json$/, '')}(${r.state}${typeof r.silentMin === 'number' ? ` 静默${r.silentMin}min` : ''})`,
    )
  return {
    dim: 'A8-leg-liveness',
    state: res.state,
    readout: `${res.summary}${names.length ? ` ｜ ${names.join(' / ')}${bad.length > 4 ? ` …共 ${bad.length} 枚` : ''}` : ''}`,
    next:
      res.state === 'drift'
        ? `出路(逐条,不得整片放宽判据):① 归属函数还在否(${bad[0]?.owner || '见登记表 owner'})→ 它的 env 开关是否被机器级关掉、器物是否在位;② 守护这一趟是否根本没走到该派发点;③ 这条腿确实该退役 ⇒ 摘条目并摘器物,别把清单留着腐烂。登记表 = scripts/data/autonomy-leg-liveness.json`
        : res.state === 'unjudged'
          ? '有条目判不出:先把输入取到(戳可读/attemptAt 可解析/时钟不失步)再谈放量'
          : '',
  }
}

/**
 * A8 的取料(两种来源必须分开,不能混成一个面):
 *   · 登记表 = 仓内文件 ⇒ 按被审面取(§0.4 取材面纪律,与 gates/A6 的 auto-evolve.mjs 同规);
 *     取不到 ⇒ 整维 unjudged,**绝不读成"登记表空 = 没有黑腿"**。
 *   · 派发戳 = `.ihui-agent/state/` 运行态(gitignored)⇒ 只能读盘上真值,读它的工作树副本才是对的。
 * 覆盖面自证在判据器里(classifyLegs 拿 disk 全集与登记表做双向对账),本层只搬运输入。
 */
export const LIVENESS_REGISTRY_REL = 'scripts/data/autonomy-leg-liveness.json'
export const LIVENESS_STATE_DIR_REL = join('.ihui-agent', 'state')

export function judgeLivenessFace({ face = FACE_SEL.face, root = ROOT, now = Date.now() } = {}) {
  let legs
  try {
    const reg = JSON.parse(readFaceText(LIVENESS_REGISTRY_REL, face, root))
    if (!Array.isArray(reg.legs)) throw new Error('登记表没有 legs 数组 ⇒ 形状坏')
    legs = reg.legs
  } catch (e) {
    return judgeLegLiveness({
      state: 'unjudged',
      rows: [],
      summary: `登记表取不到/形状坏(${String(e?.message ?? e).slice(0, 90)})⇒ 不判`,
    })
  }
  const dir = join(root, LIVENESS_STATE_DIR_REL)
  let onDisk = []
  try {
    onDisk = readdirSync(dir).filter((f) => f.endsWith('-dispatch-last.json'))
  } catch (e) {
    return judgeLegLiveness({
      state: 'unjudged',
      rows: [],
      summary: `派发戳目录读不到(${String(e?.code ?? e).slice(0, 40)})⇒ 静默时长量不出`,
    })
  }
  const stamps = {}
  for (const f of onDisk) {
    try {
      const j = JSON.parse(readFileSync(join(dir, f), 'utf8'))
      const at = Date.parse(String(j.attemptAt ?? '').trim())
      stamps[f] = Number.isFinite(at) ? { readable: true, attemptAtMs: at } : { readable: false }
    } catch {
      stamps[f] = { readable: false }
    }
  }
  return judgeLegLiveness(classifyLegs({ legs, stamps, stampFilesOnDisk: onDisk, now }))
}

/**
 * A9-carrier-parity —— 有多少自治腿**根本不在常驻承载面上**(判据零复算,
 * 全 import `scripts/lib/guardian-carrier-parity.mjs`)。
 * 被审面 = 本次判定面的 git-guardian.mjs 源(§0.4:与 A6 取 auto-evolve.mjs 同规)。
 */
export function judgeCarrierParityFace({ face = FACE_SEL.face, root = ROOT } = {}) {
  let src = null
  try {
    src = readFaceText('scripts/git-guardian.mjs', face, root)
  } catch {
    src = null
  }
  // 豁免清单同样按被审面取(与判据本体同面);取不到 ⇒ 空集 ⇒ 不摘任何一条,
  // 失效方向恒为"多判一条黑",绝不因为台账读不到就放开(§0.10)。
  let exemptions = []
  try {
    const parsed = JSON.parse(
      readFaceText('scripts/data/guardian-carrier-parity-exemptions.json', face, root),
    )
    if (Array.isArray(parsed.exemptions)) exemptions = parsed.exemptions
  } catch {
    exemptions = []
  }
  const r = judgeCarrierParity({ source: src ?? '', exemptions, now: Date.now() })
  const names = r.dark.slice(0, 6).join(', ')
  return {
    dim: 'A9-carrier-parity',
    state: r.state,
    readout:
      r.state === 'unjudged'
        ? r.why
        : `${r.why}${r.dark.length ? ` ｜ 例:${names}${r.dark.length > 6 ? ` …共 ${r.dark.length} 条` : ''}` : ''}`,
    next:
      r.state === 'drift'
        ? '这些腿只挂在一次性 main() 里,而常驻 daemon 全程持轮级锁 ⇒ main 每趟都让路,它们结构上跑不到。出路 = 逐条裁决:该上常驻面的把调用点补进 startDaemon 的 tick(每条都得自证有节流),确实只能一次性跑的进具名豁免清单带理由与到期。清单见 scripts/lib/guardian-carrier-parity.mjs 头注。'
        : r.state === 'unjudged'
          ? '先把被审面取到(HEAD/索引任一可读)再谈判定'
          : '',
  }
}

/**
 * A10-roadmap-claims —— 路线图中"§7 装车状态"那张**人手抄的表**与机器事实对账
 * (判据零复算,全 import `scripts/lib/guardian-carrier-parity.mjs` 的 judgeRoadmapClaims)。
 * 装这张表的必要性:A9 量出 46 条只挂 main 的那天,那张表自己正写着"只挂 main 等于永不执行"。
 * 声明与事实并存却无人对账 ⇒ 这正是"文档说装好了"这类失效得以长期存在的结构原因。
 */
// 被审面走 `git show HEAD:<rel>`,pathspec 必须用正斜杠 —— 这里绝不能用 join(),
// Windows 上它会给出 `docs\self-evolution-roadmap.md`,git 直接报"路径不存在"⇒ 整维假未判定。
export const ROADMAP_DOC_REL = 'docs/self-evolution-roadmap.md'

export function judgeRoadmapClaimsFace({ face = FACE_SEL.face, root = ROOT } = {}) {
  let guardian = null
  let roadmap = null
  try {
    guardian = readFaceText('scripts/git-guardian.mjs', face, root)
  } catch {
    guardian = null
  }
  try {
    roadmap = readFaceText(ROADMAP_DOC_REL, face, root)
  } catch {
    roadmap = null
  }
  const r = judgeRoadmapClaims({ guardianSource: guardian ?? '', roadmapText: roadmap ?? '' })
  const bad = (r.rows ?? []).filter((x) => x.state !== 'ok')
  return {
    dim: 'A10-roadmap-claims',
    state: r.state,
    readout:
      r.state === 'unjudged'
        ? r.why
        : `${r.why}${bad.length ? '' : `(已对账 ${(r.rows ?? []).length} 条声称)`}`,
    next:
      r.state === 'drift'
        ? `出路:逐条要么把挂点真接进 startDaemon 的 tick(接完必须有节流戳,否则 A9 会把这枚列回黑腿),要么把表里那一行改成它的真载体 —— 不许只改表来对账,那是把声明降级去迁就已坏的事实(§12f)。`
        : r.state === 'unjudged'
          ? '先把两个被审面取到(守护源 + 路线图文档),再谈放量'
          : '',
  }
}

/**
 * A11-closure-output —— 腿在跑,闭环到底有没有产出(2026-11-04 立)。
 *
 * 立因见文件头注:派发戳照刷 + A8 全绿,而下游事故信号静默 6 天。A8 量的是"戳有没有
 * 更新",量不到"戳更新了却什么都没产"。这一维改成**对账**:把决策账与已有信号账喂给
 * 摄入器自己的 `planIntake()`,算出"此刻本该产出但信号账里没有"的条数。
 *   · >0 ⇒ drift(漏产,可整改:重跑摄入器 / 修守护派发 / 修 action 映射漂移);
 *   · =0 ⇒ ok(**不要求有事故**:全 pass 的决策账待产恒 0,不许做成"没信号就报红"的恒红门);
 *   · 取料不全 / 有形状坏行 ⇒ unjudged(§0.3:不拿"没判"冒充"判过")。
 * 派发戳只记 `attemptAt`,不记判定结果 ⇒ 它只进 readout 作旁证,绝不参与三态判定。
 */
export const CLOSURE_SIGNALS_REL = join('.ihui-agent', 'state', 'incident-signals.jsonl')
export const CLOSURE_STAMP_REL = join(
  '.ihui-agent',
  'state',
  'deploy-outcome-intake-dispatch-last.json',
)

function closureStampReadout(dispatchAt, now) {
  if (!dispatchAt) return '取不到(A8 管腿存活)'
  const t = Date.parse(dispatchAt)
  if (!Number.isFinite(t)) return '不可解析'
  return `${Math.round((now - t) / 60_000)}min 前`
}

export function judgeClosureOutput(input) {
  const dim = 'A11-closure-output'
  if (!input || input.inputsOk !== true) {
    return {
      dim,
      state: 'unjudged',
      readout: `闭环取料不全(${input?.why ?? '无输入'})⇒ 不冒充"有产出"`,
      next: '先让判据拿得到决策账 / 信号账 / 信号契约(§0.3);决策面两候选都不在时不得当空集',
    }
  }
  const {
    badRows = 0,
    torn = 0,
    pending = 0,
    pendingRows = [],
    decisions = 0,
    existingCount = 0,
    latestSignalAt,
    dispatchAt,
    now = Date.now(),
    minutes = DEFAULT_MINUTES,
  } = input
  const stamp = closureStampReadout(dispatchAt, now)
  if (badRows > 0) {
    return {
      dim,
      state: 'unjudged',
      readout: `摄入面有 ${badRows} 行形状坏 ⇒ 摄入器会落未判定,产出与否判不出(另有 ${torn} 行并发撕裂已剔除)`,
      next: '逐行修坏行;撕裂行是并发追加的半条记录,不算未判定,不得靠删输入把读数抹绿',
    }
  }
  if (pending > 0) {
    const by = {}
    for (const s of pendingRows)
      by[s.route ?? '(无 route)'] = (by[s.route ?? '(无 route)'] ?? 0) + 1
    const dist = Object.entries(by)
      .map(([k, v]) => `${k}×${v}`)
      .join(' ')
    return {
      dim,
      state: 'drift',
      readout: `腿在跑但闭环漏产 ${pending} 条:决策 ${decisions} 行 / 信号账 ${existingCount} 条 / 待产 ${pending} 条(${dist}) / 去重窗 ${minutes}min / 派发戳 ${stamp}`,
      next:
        '出路:① 确认守护派发点真跑到 deploy-outcome-intake 且写盘成功(戳只记 attemptAt,不记判定结果,故戳新不等于产出);' +
        '② 手工 `node scripts/deploy-outcome-intake.mjs` 补齐,并复查第二趟 signals=0(幂等);' +
        '③ 持续复发明查 action 闭集与信号映射是否漂移(scripts/lib/deploy-decision-actions.mjs 的三面同源锁)。' +
        '不得靠删决策行或调大去重窗把读数抹绿',
    }
  }
  return {
    dim,
    state: 'ok',
    readout: `闭环有产出:决策 ${decisions} 行 / 信号 ${existingCount} 条 / 待产 0 / 最近产出 ${latestSignalAt ?? '(尚无)'} / 派发戳 ${stamp}`,
    next: '',
  }
}

/**
 * A11 取料(与 A8 同规):决策账 / 信号账 / 派发戳全是**运行态**(gitignored),
 * 只能读盘上真值,不按 git 被审面取;按 git 面取会把"此刻漏产"读成"仓库里写了什么"。
 * 决策面走唯一出口 deployDecisionsFace()(生产 checkout 优先,回落主仓影子),
 * 取不到两候选 ⇒ unjudged,绝不拿主仓那本影子账当全量(立因见 lib 头注)。
 * 全程只读:只调 planIntake() 复算,**绝不 appendSignals**,尺子不改被量的东西。
 */
export function judgeClosureOutputFace({
  root = ROOT,
  now = Date.now(),
  minutes = DEFAULT_MINUTES,
  faceResolver = deployDecisionsFace,
} = {}) {
  const unjudged = (why) => judgeClosureOutput({ inputsOk: false, why })
  let face
  try {
    face = faceResolver({ repoRoot: root })
  } catch (e) {
    return unjudged(`决策面取面抛错(${String(e?.message ?? e).slice(0, 90)})`)
  }
  if (!face || !face.found) {
    return unjudged(
      `决策面两候选都不在(${face?.candidates?.map((c) => c.kind).join(',') ?? '无候选'})`,
    )
  }
  let decisionsText
  try {
    decisionsText = readFileSync(face.path, 'utf8')
  } catch (e) {
    return unjudged(`决策账读不到(${e?.code ?? e?.message ?? e})`)
  }
  let signalsText = ''
  try {
    signalsText = readFileSync(join(root, CLOSURE_SIGNALS_REL), 'utf8')
  } catch (e) {
    // 信号账不存在 = 一次都没产过,是合法输入(可能就是漏产),不是未判定。
    if (e?.code !== 'ENOENT') return unjudged(`信号账读不到(${e?.code ?? e?.message ?? e})`)
  }
  let stamp = null
  try {
    stamp = JSON.parse(readFileSync(join(root, CLOSURE_STAMP_REL), 'utf8'))
  } catch {
    stamp = null
  }
  const parsed = readDecisionText(decisionsText)
  const existing = parseExistingSignals(signalsText)
  let contract
  try {
    contract = loadContract()
  } catch (e) {
    return unjudged(`信号契约读不到(${String(e?.message ?? e).slice(0, 90)})`)
  }
  let plan
  try {
    plan = planIntake({ decisions: parsed.rows, contract, minutes, existing: existing.signals })
  } catch (e) {
    return unjudged(`摄入判据抛错(${String(e?.message ?? e).slice(0, 90)})`)
  }
  let latestMs = 0
  for (const s of existing.signals) {
    const t = Date.parse(s?.at)
    if (Number.isFinite(t) && t > latestMs) latestMs = t
  }
  return judgeClosureOutput({
    inputsOk: true,
    badRows: parsed.bad.length + plan.bad.length + existing.bad.length,
    torn: parsed.torn.length,
    pending: plan.signals.length,
    pendingRows: plan.signals.map((s) => ({ route: s.route, at: s.at })),
    decisions: parsed.rows.length,
    existingCount: existing.signals.length,
    latestSignalAt: latestMs ? new Date(latestMs).toISOString() : null,
    dispatchAt: typeof stamp?.attemptAt === 'string' ? stamp.attemptAt : null,
    now,
    minutes,
  })
}

/**
 * A12-leg-output-reconciliation —— 全 12 条自治腿「戳刷了,到底有没有产出」(2026-11-04 /goal R3)。
 *
 * 立因:A11 只给 deploy-outcome-intake 一条腿做精确对账,其余 11 腿仍只有 A8 的戳龄。
 * 实测 dep-radar 戳照刷、A1-A11 全绿,而产出账停在 10-30、守护日志连续 5 天自报
 * 「未判定」(pnpm audit 继承守护进程失效代理 ⇒ stdout 空)。这一维把产出对账泛化。
 *
 * 取材面纪律(同 A8/A11):登记表 = 仓内文件 ⇒ 按被审面 readFaceText 取,取不到整维
 * unjudged;产出台账 / 派发戳 / 守护日志 = 运行态(gitignored)⇒ 只读盘上真值,不按 git 面取。
 * 全程只读,绝不 append、绝不重跑器物改被量的东西。日志 20MiB+ ⇒ 只 tail 最近一段。
 */
export const GUARDIAN_LOG_REL = join('.ihui-agent', 'state', 'git-guardian.log')
export const LOG_TAIL_BYTES = 4 << 20

/** 只读尾部:全量 readFileSync 20MiB+ 日志会把 30min 巡检轮拖进长尾。 */
export function readGuardianLogTail(path) {
  const { size } = statSync(path)
  const len = Math.min(size, LOG_TAIL_BYTES)
  if (len <= 0) return ''
  const fd = openSync(path, 'r')
  try {
    const buf = Buffer.alloc(len)
    readSync(fd, buf, 0, len, size - len)
    return buf.toString('utf8')
  } finally {
    closeSync(fd)
  }
}

/**
 * 守护日志里「整条腿没判出来」的稳定措辞 ⇒ 近窗自报。
 * 只认登记表 selfReportToken 显式配了的腿:auto-triage 的「未判定 2 处」是两个数据源的
 * 局部缺口、整腿仍有结论,配进来就会造恒红门,故刻意不配。
 *
 * 量的是**该腿最近一条日志**的状态,不是「近窗内有没有过一条红的」:后者会让一条
 * 陈年失败行把已修好的腿继续顶红整整一个窗口(48h),等于用红字惩罚修复。成功行
 * (`✅ 依赖安全通告轮:...`)一出现即自愈,这才是可闭环的量具。
 */
export function selfReportsFromLog(text, legs, now = Date.now()) {
  const wanted = (Array.isArray(legs) ? legs : []).filter(
    (l) =>
      typeof l?.selfReportToken === 'string' &&
      l.selfReportToken.length > 0 &&
      typeof l?.stamp === 'string',
  )
  if (!wanted.length) return {}
  const last = Object.fromEntries(
    wanted.map((l) => [l.stamp, { t: 0, failed: false, seen: false }]),
  )
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = /^\[(\d{4}-\d{2}-\d{2}T[^\]]+Z)\]/.exec(line)
    if (!m) continue
    const t = Date.parse(m[1])
    if (!Number.isFinite(t) || t > now) continue
    for (const l of wanted) {
      const prefix =
        typeof l.logLegPrefix === 'string' && l.logLegPrefix ? l.logLegPrefix : l.selfReportToken
      if (!line.includes(prefix)) continue
      const s = last[l.stamp]
      if (!s.seen || t >= s.t) {
        s.t = t
        s.seen = true
        // 「结论不可解析」是同族失败措辞,与 selfReportToken 并列(派发器两种失败出口)。
        s.failed = line.includes(l.selfReportToken) || line.includes('结论不可解析')
      }
    }
  }
  return Object.fromEntries(
    wanted.map((l) => {
      const s = last[l.stamp]
      const ceiling =
        Number.isInteger(l.silenceCeilingMs) && l.silenceCeilingMs > 0
          ? l.silenceCeilingMs
          : 24 * 3600_000
      return [l.stamp, s.seen && s.failed && now - s.t <= ceiling]
    }),
  )
}

export function judgeLegOutputs(res) {
  const dim = 'A12-leg-output-reconciliation'
  if (!res || typeof res.state !== 'string') {
    return {
      dim,
      state: 'unjudged',
      readout: '全腿产出对账判据取不到输入 ⇒ 不冒充判过',
      next: '先让量的人拿得到登记表与运行态台账(§0.3)',
    }
  }
  const named = res.rows.filter((r) => r.state === 'drift' || r.state === 'unjudged')
  const points = named
    .slice(0, 4)
    .map((r) => `${r.id.replace(/-dispatch-last\.json$/, '')}(${r.state}:${r.why})`)
  // 全绿时也要把「哪几条是条件产腿的合法静默」写进读数:否则运维分不清
  // "真有产出" 与 "本来就不该产",下一次就会被诱导去整片放宽判据。
  const silentOk = res.rows.filter((r) => r.state === 'ok' && /合法静默/.test(r.why)).length
  const silentTail =
    res.state === 'ok' && silentOk > 0 ? ` ｜ 条件产腿合法静默 ${silentOk} 条(不顶红)` : ''
  return {
    dim,
    state: res.state,
    readout: `${res.summary}${silentTail}${points.length ? ` ｜ ${points.join(' / ')}${named.length > 4 ? ` …共 ${named.length} 条` : ''}` : ''}`,
    next:
      res.state === 'ok'
        ? ''
        : res.state === 'drift'
          ? '出路:① always 腿每轮必写却零产出 ⇒ 查器物写盘分支/守护派发点是否真跑到;② 与 A8 戳龄对照(戳新账静默 = 写入面断,戳也停 = 腿整体停摆);③ 不得删台账或调大 silenceCeilingMs 抹绿。登记表 = scripts/data/autonomy-leg-liveness.json'
          : '出路:条件产腿「静默 + 近窗自报未判定」= 采集输入面断了,不是合法静默 ⇒ 先让器物拿得到输入(如 pnpm audit 被继承代理掐断 ⇒ 显式注入干净 env),再看下一轮自报是否消失;登记表字段腐烂/坏行则先修形状。不得删台账或整片放宽判据。',
  }
}

export function judgeLegOutputsFace({ face = FACE_SEL.face, root = ROOT, now = Date.now() } = {}) {
  let legs
  try {
    const reg = JSON.parse(readFaceText(LIVENESS_REGISTRY_REL, face, root))
    if (!Array.isArray(reg.legs)) throw new Error('登记表没有 legs 数组 ⇒ 形状坏')
    legs = reg.legs
  } catch (e) {
    return judgeLegOutputs({
      state: 'unjudged',
      rows: [],
      summary: `登记表取不到/形状坏(${String(e?.message ?? e).slice(0, 90)})⇒ 产出对账没量`,
    })
  }
  const dir = join(root, LIVENESS_STATE_DIR_REL)
  const ledgers = {}
  for (const rel of new Set(
    legs.map((l) => l?.outputRel).filter((r) => typeof r === 'string' && r.length > 0),
  )) {
    try {
      ledgers[rel] = readFileSync(join(dir, rel), 'utf8')
    } catch (e) {
      // ENOENT = 一次都没产过,是合法输入(可能正是漏产);其它读失败才判未判定。
      ledgers[rel] = e?.code === 'ENOENT' ? '' : null
    }
  }
  const stamps = {}
  for (const l of legs) {
    if (typeof l?.stamp !== 'string') continue
    try {
      const j = JSON.parse(readFileSync(join(dir, l.stamp), 'utf8'))
      const at = Date.parse(String(j.attemptAt ?? '').trim())
      stamps[l.stamp] = Number.isFinite(at) ? { attemptAtMs: at } : {}
    } catch {
      stamps[l.stamp] = {}
    }
  }
  let logText = ''
  try {
    logText = readGuardianLogTail(join(root, GUARDIAN_LOG_REL))
  } catch {
    logText = ''
  }
  return judgeLegOutputs(
    classifyLegOutputs({
      legs,
      ledgers,
      stamps,
      selfReports: selfReportsFromLog(logText, legs, now),
      now,
    }),
  )
}

export function evaluateAll({
  repoRoot = ROOT,
  gatesText,
  events,
  ticketRows,
  transit,
  valve,
  closure,
  landing,
  faceStall,
  liveness,
  parity,
  claims,
  output,
  outputAll,
} = {}) {
  const dims = []
  let gates
  try {
    gates = JSON.parse(gatesText)
  } catch (e) {
    return {
      state: 'unjudged',
      dims: [
        {
          dim: 'A0-gates',
          state: 'unjudged',
          readout: `配置读不到/形状坏:${e.message}`,
          next: '先修 JSON',
        },
      ],
      summary: 'UNJUDGED A0-gates',
    }
  }
  dims.push(judgePreflight(gates.sessionCommandTemplate, repoRoot))
  if (transit) dims.push(transit)
  if (valve) dims.push(valve)
  if (closure) dims.push(closure)
  // A13 挨着 A7 放:A7 问"票动没动",A13 问"东西进没进仓"。两问必须并排看得见 ——
  // 分开摆正是这十天里"A7 绿而落地为零"没人撞上的原因。
  if (landing) dims.push(landing)
  // A14 挨着 A13:A13 说"从未入库",A14 说"为什么这轮次根本没人跑过判据"。两问分开,谁都别替谁圆场。
  if (faceStall) dims.push(faceStall)
  if (liveness) dims.push(liveness)
  if (parity) dims.push(parity)
  if (claims) dims.push(claims)
  if (output) dims.push(output)
  if (outputAll) dims.push(outputAll)
  if (!events.ok) {
    /* 台账缺失只影响 A2/A3/A4 */
    dims.push({
      dim: 'A2-attribution',
      state: 'unjudged',
      readout: events.why,
      next: '台账取不到 ⇒ 不冒充"没失败过"',
    })
    dims.push({
      dim: 'A3-range',
      state: 'unjudged',
      readout: '无台账输入 ⇒ 封票数判不出',
      next: '',
    })
  } else {
    dims.push(judgeMisattribution(events.events))
    dims.push(judgeRange(events.events, ticketRows))
    dims.push(judgeWhitelist(events.events, gates.ticketWhitelist ?? []))
  }
  const drift = dims.filter((d) => d.state === 'drift')
  const unjudged = dims.filter((d) => d.state === 'unjudged')
  const state = drift.length ? 'drift' : unjudged.length ? 'unjudged' : 'ok'
  return {
    state,
    dims,
    summary: `OK=${dims.length - drift.length - unjudged.length} DRIFT=${drift.length} UNJUDGED=${unjudged.length}`,
  }
}

/** 稳定语义身份(§5e-1/5e-3:类别+计数,不掺时刻/sha/异常原文)。 */
export function alertIdentity(result) {
  const driftKeys = result.dims
    .filter((d) => d.state === 'drift')
    .map((d) => d.dim)
    .sort()
  return `autonomy-leg:${result.state}:${driftKeys.join('+') || 'none'}:${result.dims.filter((d) => d.state === 'drift').length}`
}

/**
 * A5 后端通路(2026-11-01 实测补):发起腿是四层链 —— 配置 → 执行体 → 本地服务 → 上游模型。
 * probe 把前三层穿通后卡在第三层(api 侧 "AI service unreachable: fetch failed"),
 * 而调度器对服务面一维**从来没有判据** —— 腿断在第三层时,账面读起来仍像"票不行"。
 * 双臂各自量 /health,绝不并桶;凭据一律不进这一维(只问存续,不发真请求)。
 */
export function judgeBackendTransit({
  apiBase,
  aiBase,
  probeMs = 6000,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiBase || !aiBase) {
    return {
      dim: 'A5-backend-transit',
      state: 'unjudged',
      readout: `服务面地址取不到(api=${apiBase ?? '∅'} ai=${aiBase ?? '∅'})⇒ 不冒充通路健康`,
      next: '核 apps/api/.env 的 AI_SERVICE_URL 与 api 端口',
    }
  }
  const one = async (base) => {
    try {
      const r = await fetchImpl(`${base.replace(/\/$/, '')}/health`, {
        signal: AbortSignal.timeout(probeMs),
      })
      return { base, code: r.status, ok: r.status >= 200 && r.status < 300 }
    } catch (e) {
      return { base, code: null, ok: false, err: e.cause?.code || e.name }
    }
  }
  return (async () => {
    const [a, b] = [await one(apiBase), await one(aiBase)]
    const down = [a, b].filter((x) => !x.ok)
    if (down.length === 0)
      return {
        dim: 'A5-backend-transit',
        state: 'ok',
        readout: `api=${a.code} ai-service=${b.code} 双臂应答`,
        next: '',
      }
    return {
      dim: 'A5-backend-transit',
      state: 'drift',
      readout: down.map((d) => `${d.base}=${d.code ?? '∅'}(${d.err ?? '非 2xx'})`).join(' '),
      next: '出路:起对应服务或修其监听;服务存续由 check-service-binary-paths.mjs 出全维读数。两腿各自都通而真请求仍失败时,断点在 api→ai-service 的调用本身,须另放双臂探针,不得归因成"票失败"',
    }
  })()
}

/** 服务地址是机器事实(§0 现读七类之一):一律 --api-base/--ai-base 注入,
 *  默认给本仓端口登记档;刻意不读 apps/api/.env —— 那文件 gitignored、含凭据,
 *  而且"从仓根拼一个 gitignored 路径去 readFileSync"正是守门 118 判的反面形态。 */
export function resolveTransitBases({ apiBase, aiBase } = {}) {
  return {
    apiBase: apiBase || process.env.IHUI_AUTONOMY_API_BASE || 'http://127.0.0.1:8802',
    aiBase: aiBase || process.env.IHUI_AUTONOMY_AI_BASE || 'http://127.0.0.1:8803',
  }
}

/**
 * 按**当前规则表**复算历史票面,得到覆盖率现值(2026-11-04 立)。
 * 为什么必须有这一层:台账里的 `ruleId` 是"当时那一版分类器"的结论。匹配器今天改过
 * (名词形态工程票 + 机器注记剥离),而 A6 原先直接把历史 ruleId 分布当现值报 ——
 * 于是 25 条 `unknown-fail-closed`(全是 `[deploy-feedback]` 那一族,今天已能具名成
 * `production-deploy`)会永远挂在读数上,更要紧的是 **切 enforce 的前置条件"unknown 归零"
 * 按历史计数就永远不可能满足**:尺子把已经修好的盲区报成未修,同时也把"已经全覆盖"报成永远不会发生。
 * 判据一律走 `lib/human-valve.mjs` 的 `classifyAction`(§0.6 零复算)。
 *
 * 状态四档不并桶:`ok` 复算成功 / `absent` 没给规则表(调用方刻意不测这一维) /
 * `bad` 规则表取不到或分类器抛错(⇒ 覆盖率**未判定**,既不冒"全覆盖"也不冒"有盲区") /
 * `no-face` 台账里没有任何票面可复算。
 */
export function recomputeValveCoverage(events, { valveListText, now = new Date() } = {}) {
  if (valveListText === undefined) return { status: 'absent' }
  if (typeof valveListText !== 'string')
    return { status: 'bad', why: '规则表不是字符串(取不到即未判定,不猜覆盖)' }
  let parsed
  try {
    parsed = parseValveList(valveListText)
  } catch (e) {
    return { status: 'bad', why: `规则表解析抛错:${String(e?.message ?? e).slice(0, 120)}` }
  }
  const problems = parsed.problems ?? []
  if (problems.length > 0)
    return {
      status: 'bad',
      why: `规则表形状坏:${problems
        .slice(0, 2)
        .map((p) => p.message ?? p)
        .join('；')
        .slice(0, 160)}`,
    }
  if (!Array.isArray(parsed.rules) || parsed.rules.length === 0)
    return { status: 'bad', why: '规则表枚举到 0 条规则 ⇒ 覆盖率判不出(不用 0 冒充"全归人")' }
  const faces = [
    ...new Set(
      (Array.isArray(events) ? events : [])
        .map((e) => String(e?.ticketLine ?? '').trim())
        .filter((s) => s !== ''),
    ),
  ]
  if (faces.length === 0) return { status: 'no-face', rules: parsed.rules.length }
  let selfServe = 0
  let namedStop = 0
  let stillUnknown = 0
  const samples = []
  for (const f of faces) {
    let v
    try {
      v = classifyAction(f, { rules: parsed.rules, now })
    } catch (e) {
      return { status: 'bad', why: `classifyAction 抛错:${String(e?.message ?? e).slice(0, 120)}` }
    }
    if (v.ruleId === UNKNOWN_RULE_ID) {
      stillUnknown += 1
      if (samples.length < 3) samples.push(f.slice(0, 88))
    } else if (v.bucket === BUCKETS.SELF_SERVE) selfServe += 1
    else namedStop += 1
  }
  return {
    status: 'ok',
    faces: faces.length,
    rules: parsed.rules.length,
    selfServe,
    namedStop,
    stillUnknown,
    samples,
  }
}

/**
 * A6 人工阀闸是否真在派发路径上被问(2026-11-01 立)。
 * 立因(回源实测):`human-gates.mjs` 的 classify 与 `lib/human-valve.mjs` 的 classifyAction
 * 在派发路径上原本**零调用** —— 调度层只打印"自决 4 / 停机等人 7"这句计数,
 * 7 条停机条款既没进票 prompt 也没在任何动作前被问。闸住在被约束者手里 = 没有闸。
 * 所以这一维量的不是"配置对不对",而是"有没有人真去问过它":
 *  - 有派发尝试而零 valve-* 留痕 ⇒ 哑闸 ⇒ drift;
 *  - observe 档 ⇒ 报命中分布,并给"切 enforce 的前置条件"(未判定必须为 0、命中族必须见过);
 *  - 档位取值非法 ⇒ drift(不猜档)。
 * 2026-11-04 追加:历史 ruleId 分布只作历史,能不能 enforce 由**当前规则表复算**的覆盖率决定
 * (见 `recomputeValveCoverage` 头注)。
 */
export function judgeValveGate(events, { mode, headSource, valveListText, now = new Date() } = {}) {
  if (headSource === null || headSource === undefined) {
    return {
      dim: 'A6-human-valve-gate',
      state: 'unjudged',
      readout: '派发器源码在被审面取不到 ⇒ 接线与否判不出(不用"取不到"冒充"没接线")',
      next: '核 scripts/auto-evolve.mjs 是否在被审面上',
    }
  }
  // 同 A4:`session-` 前缀认派发尝试。这里若漏认新档,`attempted` 会掉到 0 ⇒ 下面那条
  // "有派发尝试而零 valve 留痕 ⇒ 哑闸"的判据**结构上永远不触发** —— 那是把最危险的失效(假绿)留给尺子。
  const attempted = events.filter(
    (e) => String(e.action ?? '').startsWith('session-') || e.action === 'runner-unavailable',
  ).length
  const valveRows = events.filter((e) => String(e.action ?? '').startsWith('valve-'))
  const stopRows = valveRows.filter(
    (e) => e.action === 'valve-observe-stop' || e.action === 'valve-block',
  )
  const unjudged = valveRows.filter(
    (e) => e.action === 'valve-unjudged' || e.action === 'valve-unjudged-block',
  )
  const wired = typeof headSource === 'string' && headSource.includes('gateTicketByHumanValve({')
  if (!wired) {
    return {
      dim: 'A6-human-valve-gate',
      state: 'drift',
      readout: '派发路径上没有闸的调用点(classifyAction 从未被问)⇒ 停机条款只是打印出来的装饰',
      next: '在真派之前对票面调 gateTicketByHumanValve,并把结论记进台账',
    }
  }
  if (mode !== 'observe' && mode !== 'enforce') {
    return {
      dim: 'A6-human-valve-gate',
      state: 'drift',
      readout: `humanValveMode 取值非法(${JSON.stringify(mode)})⇒ 不猜档`,
      next: '改成 observe 或 enforce 之一',
    }
  }
  if (attempted > 0 && valveRows.length === 0) {
    return {
      dim: 'A6-human-valve-gate',
      state: 'drift',
      readout: `有 ${attempted} 轮真派发尝试却零 valve-* 留痕 ⇒ 闸是哑的(代码在而没被走到)`,
      next: '核派发循环里闸的调用点是否在白名单判定之后、真派之前',
    }
  }
  const byRule = {}
  for (const r of stopRows) byRule[r.ruleId ?? '(无 id)'] = (byRule[r.ruleId ?? '(无 id)'] ?? 0) + 1
  const dist =
    Object.entries(byRule)
      .map(([k, v]) => `${k}×${v}`)
      .join(' ') || '(尚无命中)'
  // "拦对了"与"没规则可判"必须分开报:两者的出路完全相反。
  // 具名命中 = 这一类本就归人(如回滚生产、换 key)⇒ 正确出口是**把该类票摘出自动派单面**;
  // unknown-fail-closed = 分类器缺匹配器 ⇒ 正确出口是**补匹配器**(2026-11-04 那一枚就把
  // 12 枚候选里 11 枚的 unknown 降到 5,靠的是给名词形态工程票与两条漏判的危险语序补规则)。
  // 混在一个数里报,就会既有人拿"阀在拦"当成绩、也有人拿"unknown 很多"去拆 fail-closed 默认。
  const unknownStops = byRule[UNKNOWN_RULE_ID] ?? 0
  const namedStops = stopRows.length - unknownStops
  const cov = recomputeValveCoverage(events, { valveListText, now })
  const covText =
    cov.status === 'ok'
      ? ` / 覆盖率复算(当前规则表 ${cov.rules} 条,判 ${cov.faces} 枚票面):具名自决 ${cov.selfServe} · 具名停机 ${cov.namedStop} · 仍无规则 ${cov.stillUnknown}`
      : cov.status === 'bad'
        ? ` / 覆盖率复算:❌ 未判定(${cov.why})`
        : cov.status === 'no-face'
          ? ' / 覆盖率复算:台账内无可复算票面 ⇒ 未判定(不冒"全覆盖")'
          : ' / 覆盖率复算:本轮未测(调用方没给规则表)'
  const covBlind = cov.status === 'ok' && cov.stillUnknown > 0
  if (mode === 'observe') {
    const covState =
      unjudged.length > 0 || covBlind ? 'drift' : cov.status === 'bad' ? 'unjudged' : 'ok'
    return {
      dim: 'A6-human-valve-gate',
      state: covState,
      readout:
        `observe 档:派发尝试 ${attempted} 轮 / 闸留痕 ${valveRows.length} 条 / 记为"会拦" ${stopRows.length} 条(历史 ruleId 分布,只作历史)` +
        `【具名 ${namedStops} + 无规则可判 ${unknownStops}】(${dist})/ 未判定 ${unjudged.length} 条${covText}`,
      next:
        unjudged.length > 0
          ? `未判定 ${unjudged.length} 条必须先归零(清单坏/取不到),否则切 enforce 就是把票无限期停派;切 enforce 的前置:observe 覆盖完整流量周期 ∧ 未判定=0`
          : covBlind
            ? `按**当前规则表**复算仍有 ${cov.stillUnknown} 枚票面落 unknown ⇒ 分类器有盲区(出路=给 lib/human-valve.mjs 的 MATCHERS 补形态);样例:${cov.samples.join(' ｜ ')}`
            : unknownStops > 0 && cov.status === 'ok'
              ? `历史 unknown ${unknownStops} 条按当前规则表复算已全部能具名 ⇒ 那是**旧版分类器**的账,别再当现值(更别拿它当"不能切 enforce"的理由);` +
                `注意区分两种"拦":具名停机是这一类本就归人(出路=把该类票摘出自动派单面),具名自决才可自办。`
              : unknownStops > 0
                ? `注意区分两种"拦":具名 ${namedStops} 条是这一类本就归人(出路=把该类票摘出自动派单面,不是修阀);` +
                  `unknown ${unknownStops} 条是分类器缺匹配器(出路=给 lib/human-valve.mjs 的 MATCHERS 补形态)。` +
                  `拿 unknown 当"阀在起作用"会把天花板藏起来,反过来为了数字好看把 unknown 翻成 self-serve 则是拆 fail-closed 默认,两向都不许。`
                : cov.status === 'no-face'
                  ? '覆盖率复算:台账内无可复算票面 ⇒ 这一格未判定;切 enforce 的前置是"复算仍无规则=0",不是"历史 unknown=0"'
                  : '放量到 enforce 前,先确认 observe 覆盖了一个完整流量周期',
    }
  }
  return {
    dim: 'A6-human-valve-gate',
    state: unjudged.length > 0 ? 'drift' : 'ok',
    readout: `enforce 档:尝试 ${attempted} / 拦下 ${stopRows.filter((e) => e.action === 'valve-block').length} / 未判定 ${unjudged.length}`,
    next: unjudged.length > 0 ? 'enforce 档下的未判定 = fail-closed 停派,须先修清单可读性' : '',
  }
}

/**
 * 从**被审面**的派发器源码里取"哪些 action 欠着一个结算答案"(2026-11-04 立)。
 * 为什么不 import `SESSION_RESULT_ACTIONS`:本尺判的是 HEAD/索引那一面,而 import 读的是**盘上那份**
 * (§0.4 同面同轮);共享工作树里盘上那份常年落后 HEAD,拿它判 = 用别人的旧口径量我的新账。
 * 解析不到 ⇒ null ⇒ 上层落未判定 —— 不回落"就只认 session-ok",那种默认会把新增的成功档
 * 静默漏出射程(而"漏档"表现的正是 A7 要抓的那个洞)。
 */
export function sessionResultActionsOf(schedulerSource) {
  const m = /SESSION_RESULT_ACTIONS\s*=\s*Object\.freeze\(\[([^\]]*)\]\)/.exec(
    String(schedulerSource ?? ''),
  )
  if (!m) return null
  const list = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
  return list.length ? list : null
}

/**
 * A13-artifact-landing —— 落账腿到底有没有把产物送进过 HEAD(2026-11-05 立)。
 *
 * 立因(当次现读,不是猜):台账 248 行跨 10 天,`session-ok` 9 枚、`dispatch-settled` 9 枚、
 * `artifact-manifest-missing` 9 枚,而 **`artifact-committed` = 0**。A7 当时的读数却是
 * "已结算 9 条,零'报成功而零推进'"—— 因为它问的是"有没有结算行",而结算行本身只回答
 * "票行动了/没动",从不回答"东西进没进仓"。整条链上没有任何一维量"产出入库",
 * 于是"自治环跑了十天、一枚没落"这件事在 12 维全绿的账面里是**不可见**的(§0.9 的同类:
 * 判据不在真跑它的那一刻成立 = 没有)。
 *
 * 词汇零复算(§0.6):落地档与拒绝档都从 `lib/autonomy-nonprogress.mjs` 的两张表按
 * `artifact-` 前缀派生 —— 新增一枚 artifact 动作若不进那张表,
 * `scripts/tests/autonomy-action-coverage.test.mjs` 先红,本维自动跟上。
 * 会话结果档不自己拼字面量:走 `sessionResultActionsOf(被审面)` 那一份解析(取不到 ⇒ 未判定)。
 *
 * 三态(不并桶):
 *   · drift  有会话结果档,而落地档 = 0(从未入库);或最近一次会话结果档之后落账腿没答话。
 *   · ok     落地档 ≥ 1;或本轮窗内压根没有会话结果档(落账腿没有输入可答 —— 读数照实报零,
 *            不冒充"有产出",也不冒充"坏了")。
 *   · unjudged 台账取不到 / 射程解析不到 / 落地档与拒绝档都派生为空(词汇表被改坏)。
 */
export const ARTIFACT_LANDED_ACTIONS = PROGRESS_ACTIONS.filter((a) =>
  String(a).startsWith('artifact-'),
)
export const ARTIFACT_REJECT_ACTIONS = NON_PROGRESS_ACTIONS.filter((a) =>
  String(a).startsWith('artifact-'),
)

export function judgeArtifactLanding(
  events,
  {
    sessionResultActions = null,
    landedActions = ARTIFACT_LANDED_ACTIONS,
    rejectActions = ARTIFACT_REJECT_ACTIONS,
  } = {},
) {
  const dim = 'A13-artifact-landing'
  if (!Array.isArray(events)) {
    return {
      dim,
      state: 'unjudged',
      readout: `台账取不到 ⇒ 落账与否判不出`,
      next: '先修取材面(events 传入非数组)',
    }
  }
  if (!Array.isArray(sessionResultActions) || sessionResultActions.length === 0) {
    return {
      dim,
      state: 'unjudged',
      readout: '会话结果档射程解析不到 ⇒ 不知道哪些行算"会话判成功",落账与否判不出',
      next: '核 auto-evolve.mjs 的 SESSION_RESULT_ACTIONS 是否仍以 `Object.freeze([...])` 直写字面量',
    }
  }
  if (landedActions.length === 0 || rejectActions.length === 0) {
    return {
      dim,
      state: 'unjudged',
      readout: `artifact 词汇派生为空(落地档 ${landedActions.length} / 拒绝档 ${rejectActions.length})⇒ 分档表被改坏,本维拒绝猜`,
      next: '核 lib/autonomy-nonprogress.mjs 两张表里是否还有 artifact-* 动作',
    }
  }
  const sessions = events.filter((e) => sessionResultActions.includes(e.action))
  const landed = events.filter((e) => landedActions.includes(e.action))
  const rejected = events.filter((e) => rejectActions.includes(e.action))
  if (sessions.length === 0) {
    return {
      dim,
      state: 'ok',
      readout: `窗内会话结果档 0 枚 ⇒ 落账腿没有输入可答(落地累计 ${landed.length} 枚 / 拒绝累计 ${rejected.length} 枚,照实报数不冒充产出)`,
      next: '',
    }
  }
  const dist = Object.entries(
    rejected.reduce((m, e) => {
      m[e.action] = (m[e.action] ?? 0) + 1
      return m
    }, {}),
  )
    .map(([k, v]) => `${k}×${v}`)
    .join(' ')
  const lastSession = sessions[sessions.length - 1]
  const lastArtifact = [...landed, ...rejected]
    .sort((a, b) => String(a.ts ?? '').localeCompare(String(b.ts ?? '')))
    .pop()
  if (landed.length === 0) {
    return {
      dim,
      state: 'drift',
      readout: `自治环从未把产物送进 HEAD:会话结果档 ${sessions.length} 枚 / 落地档 0 枚 / 拒绝档 ${rejected.length} 枚(${dist || '无'})`,
      next:
        '出路(按序,不许跳):① 现读 `.ihui-agent/state/ticket-artifacts/` 是否为空目录 —— 空 ⇒ 会话压根没写清单,问题在派发票与权限档,不在落账腿;' +
        '② 有清单而整批被拒 ⇒ 逐枚看 why 里的档位(manifest-missing / invalid / stale / protected-face),每一档都得有自己的器物;' +
        '③ 拿 `session-no-write` 与 `session-ok` 的比值判"会话是否真写了盘"(写工具命中为 0 的成功已被单列,别把它当成功);' +
        '④ 不得靠"把 artifact-committed 加进豁免表"抹绿 —— 那正是 §0.7 禁的没验过就免。',
    }
  }
  if (lastArtifact && String(lastSession.ts ?? '') > String(lastArtifact.ts ?? '')) {
    return {
      dim,
      state: 'drift',
      readout: `最近一次会话结果档(${String(lastSession.ts ?? '?')} · ${lastSession.action})之后落账腿没答话(最后一条落账行 ${String(lastArtifact.ts ?? '?')})⇒ 会话判成功而落账环节静默`,
      next: '核 landTicketArtifacts 是否在 dispatchSession 返回后被调用、是否中途 return(静默中断就是这条判据要抓的形态)',
    }
  }
  return {
    dim,
    state: 'ok',
    readout: `落账腿在答题:落地 ${landed.length} 枚 / 拒绝 ${rejected.length} 枚(${dist || '无'})/ 最近落地 ${String(landed[landed.length - 1].ts ?? '?')}`,
    next: '',
  }
}

/**
 * A14-executor-face-stall —— 自主环"被长期停放"必须是**响的**,不是安静的(2026-11-05 立)。
 *
 * 立因是今天自己造出来的一个死角:自我面闸(调度器派发前核验盘上那份)把"盘上缺被审面已有锚点"
 * 判成停派 —— 方向完全对(不拿半成品当执行体)。但它落的那两档都带 `informational:true`
 * ⇒ 既不计连败也不计空转(同样正确:共树盘脏是环境常态)⇒ **没有任何一维问"这样停了多久、会不会一直停"**。
 * 更糟的是这维度在台账里读不到:被执行的那份盘上副本正是缺锚点的那份,它自己不含这道闸
 * ⇒ 一条 `runner-face-*` 都不会写。当次实测:盘上那份缺被审面 7/7 条锚点、mtime 8.54h 未更新,
 * 而派发节拍中位数只有 0.64h(10 枚 `dispatched` 现读)—— 也就是说这一停就是十几个班次,账面全绿。
 *
 * 判据不需要时间阈值(§"安静检测器的阈值必须量出来"反面就是"别拍个数"):
 * **缺锚点数 > 0 本身就是二值事实** —— 跑的那份代码不等于被判的那份代码,与停了多久无关。
 * mtime/节拍只进读数当旁证,绝不参与判定;取不到 mtime 也不把"不知道多久"折成"刚停"或"停很久"。
 *
 * 三面同问不是违反取材面纪律(§0.4 禁的是"同一个判定悄悄换面"):这里**两个面就是同一个判定的两个输入**
 * —— 被审面(H/索引,按 --staged 切换)与盘上实跑面。取不到任一面 ⇒ 未判定。
 */
export const EXECUTOR_SCHED_REL = 'scripts/auto-evolve.mjs'

export function judgeExecutorFaceStall({
  listText = null,
  auditedText = null,
  diskText = null,
  mtimeMs = null,
  now = Date.now(),
  schedRel = EXECUTOR_SCHED_REL,
} = {}) {
  const dim = 'A14-executor-face-stall'
  if (
    typeof listText !== 'string' ||
    typeof auditedText !== 'string' ||
    typeof diskText !== 'string'
  ) {
    return {
      dim,
      state: 'unjudged',
      readout: '锚点清单 / 被审面调度器 / 盘上调度器 三面之一取不到 ⇒ 停放与否判不出',
      next: '先修取材面(门 299 的清单与被审面本器都要读得到)',
    }
  }
  let parsed
  try {
    parsed = INV_GATE.parseInvariants(listText)
  } catch (e) {
    return {
      dim,
      state: 'unjudged',
      readout: `锚点清单解析抛错:${String(e?.message ?? e).slice(0, 120)}`,
      next: '核门 299 的 parseInvariants',
    }
  }
  if (parsed.problems.length) {
    return {
      dim,
      state: 'unjudged',
      readout: `锚点清单有 ${parsed.problems.length} 处问题(${parsed.problems[0].message})⇒ 不拿坏台账冒充判过`,
      next: '先修清单门 299',
    }
  }
  const me = parsed.entries.find((e) => e.path === schedRel)
  if (!me) {
    return {
      dim,
      state: 'unjudged',
      readout: `清单里没有 ${schedRel} 这一条 ⇒ 判不出盘上是否落后(枚举到 0 判死不记绿)`,
      next: '在 scripts/data/autonomy-invariants.json 给调度器补锚点条目',
    }
  }
  const missing = me.anchors.filter((a) => auditedText.includes(a) && !diskText.includes(a))
  const ageTxt =
    typeof mtimeMs === 'number' && Number.isFinite(mtimeMs)
      ? `盘上这份已 ${((now - mtimeMs) / 3600_000).toFixed(2)}h 未更新(现读旁证,不参与判定)`
      : '盘上 mtime 取不到 ⇒ 停放时长不判'
  if (missing.length === 0) {
    return {
      dim,
      state: 'ok',
      readout: `盘上这份未落后被审面(${me.anchors.length} 条锚点齐备)⇒ 自我面闸不会停派;${ageTxt}`,
      next: '',
    }
  }
  return {
    dim,
    state: 'drift',
    readout: `自主环跑的不是被判的那份代码:盘上这份缺被审面 ${missing.length}/${me.anchors.length} 条判据锚点 ⇒ 自我面闸每轮停派,而这停放不带连败也不带空转 ⇒ 不会自己结束;${ageTxt}`,
    next:
      '出路只有把盘上那份了结,没有第二条:' +
      `① 归属席位把 ${schedRel} 的在飞改动落地(合并今天的判据再提交,门 299 会拦整片回写);` +
      '② 若那一席已不存在,按 §12 走 worktree/heal 收口,不许由尺子代裁覆盖别人现场;' +
      '③ 不许为了变绿去放宽锚点表或把自我面闸改成"照派"—— 那正是本维要拦的方向。',
  }
}

/** A14 取料:清单与被审面按本轮 --staged/HEAD 档走,盘上那份只走 worktree 出口(§15 根由脚本自身推)。 */
export function judgeExecutorFaceStallFace({ face, root, now = Date.now() } = {}) {
  const schedRel = EXECUTOR_SCHED_REL
  let listText = null
  let auditedText = null
  let diskText = null
  let mtimeMs = null
  try {
    listText = readFaceText(INV_GATE.DATA_REL, face, root)
  } catch {
    listText = null
  }
  try {
    auditedText = readFaceText(schedRel, face, root)
  } catch {
    auditedText = null
  }
  try {
    diskText = readWorktreeFile(root, schedRel)
    mtimeMs = statSync(join(root, schedRel)).mtimeMs
  } catch {
    diskText = null
  }
  return judgeExecutorFaceStall({ listText, auditedText, diskText, mtimeMs, now })
}

/**
 * A7 派发闭环:session-ok 到底等不等于"票推进了"(2026-11-01 立)。
 * 立因:台账里唯一一枚 session-ok 对一张大工程票只跑 45.5s 就 exit 0 —— 调度器原先把
 * "会话结束了"当成"这轮干成了"。AGENTS §10 要的是交付与产出一致,所以必须有第二问:
 * 票行到底动了没有。四档不并桶,且"没结算的成功"要单独点名(结算腿漏覆盖 = 尺子盲区)。
 */
export function judgeDispatchClosure(
  events,
  { schedulerSource, windowHours = 48, now = Date.now(), activeTicketKeys = null } = {},
) {
  if (schedulerSource === null || schedulerSource === undefined) {
    return {
      dim: 'A7-dispatch-closure',
      state: 'unjudged',
      readout: '派发器源码在被审面取不到 ⇒ 闭环与否判不出',
      next: '核 scripts/auto-evolve.mjs 是否在被审面上',
    }
  }
  if (!schedulerSource.includes('settlePriorDispatches({')) {
    return {
      dim: 'A7-dispatch-closure',
      state: 'drift',
      readout: '派发器里没有结算调用 ⇒ 成功判定仍等于 CLI 退出码',
      next: '取票后先结算上一轮的 session-ok,把 settled 记进台账',
    }
  }
  const results = sessionResultActionsOf(schedulerSource)
  if (!results) {
    return {
      dim: 'A7-dispatch-closure',
      state: 'unjudged',
      readout:
        '被审面里解析不到 SESSION_RESULT_ACTIONS ⇒ 哪些成功档欠着结算答案判不出(不回落"只认 session-ok")',
      next: '核 scripts/auto-evolve.mjs 的 SESSION_RESULT_ACTIONS 是否仍以 `Object.freeze([...])` 直写字面量形态声明',
    }
  }
  const okRows = events.filter((e) => results.includes(e.action) && e.ticketKey)
  const settledRows = events.filter((e) => e.action === 'dispatch-settled')
  // 按票收敛(2026-11-03 收,治"A7 次生缺陷:历史行永久顶红"):
  // no-progress 只在**该票仍在册**时才算"现在还在零推进"。票已从派单面摘除(作废/删除/结清),
  // 它的历史 no-progress 就不再代表当前闭环失效 —— 否则一张出册票的 7 条历史行会永远把尺子钉红,
  // 逼人学会忽略报警(§12e)。缺省 null = 旧行为(全量算),既有自测不受影响。
  // 注意:这不是按时间窗抹历史 —— 仍在册的票,哪怕 no-progress 是几个月前,照旧顶红。
  const noProgressAll = settledRows.filter(
    (e) => e.settled === 'no-progress' && (!activeTicketKeys || activeTicketKeys.has(e.ticketKey)),
  )
  // 合格线改绑"票行推进 ∪ 绑票键的提交"(2026-11-05,本维出路文案自己点名的那一刀)。
  // 立因:无头会话**结构上没有提交权**(acceptEdits 只放宽写类工具,`git_commit` 属 dangerous ⇒ denied,
  // apps/cli/src/tools/danger-gate.ts),落账由调度侧代做(`artifact-committed` 那一档自带落地自证)。
  // 于是"票行逐字未变"有两种完全不同的成因:① 这轮真的什么都没落地;② 东西已经进仓,
  // 是**结清/推进腿**没跟上。把它们都说成"会话报成功而零推进",下一个人就会去改提示词,
  // 而该修的是记账腿 —— 判据没错,归因错了同样修不动(§0.3 三态不并桶)。
  // 配对纪律(2026-11-05 补,治上一刀的过宽):提交证据必须**属于那一轮** —— 同票键 ∧ 时刻不早于该轮
  // 会话结果档。取全台账无窗口的旧写法会让"一次历史/人工提交"长期豁免此后每一次零推进(审计席点名)。
  // 时刻配不上(取不到 ts)⇒ 一律不算已落账,落回 bare 档:失效方向恒为"多要一次说明",不是"多放一次"。
  const commitEvents = events.filter(
    (e) => String(e.action ?? '') === 'artifact-committed' && e.ticketKey,
  )
  const hasBoundCommitForRound = (s) => {
    const at = Date.parse(String(s.sourceTs ?? s.ts ?? ''))
    if (!Number.isFinite(at)) return false
    return commitEvents.some((c) => {
      if (String(c.ticketKey) !== String(s.ticketKey)) return false
      const ct = Date.parse(String(c.ts ?? ''))
      return Number.isFinite(ct) && ct >= at
    })
  }
  const noProgress = []
  const landedButUnadvanced = []
  for (const s of noProgressAll) {
    if (hasBoundCommitForRound(s)) landedButUnadvanced.push(s)
    else noProgress.push(s)
  }
  const unjudgedS = settledRows.filter((e) => e.settled === 'unjudged')
  const advanced = settledRows.filter(
    (e) => e.settled === 'line-gone' || e.settled === 'line-changed',
  )
  const cutoff = now - windowHours * 3600_000
  // 结算腿只能对**它存在之后**的成功负责(2026-11-01 收,治本维恒红):
  // 第一条 dispatch-settled 的 ts 即结算腿生效时刻。生效之前的 session-ok 结构上不可能有
  // 结算行 —— 把它们算成"覆盖不全",等于要求一门今天才装的车去结算它出生前的账,本维会永久
  // drift(§12e 恒红门:与本次改动无关的红门,唯一结局是逼人学会忽略报警)。
  // 反过来,**台账里一条 settled 都没有**仍是真信号:代码在而腿没跑(下面 accountableFrom 落回
  // cutoff,超窗成功全部计入 dangling)⇒ 该红就红,不因这条修正被放过。
  const firstSettledAt = settledRows
    .map((s) => Date.parse(String(s.ts ?? '')))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)[0]
  const unsettled = okRows.filter((e) => {
    const at = Date.parse(String(e.ts ?? ''))
    return Number.isFinite(at) && at < cutoff && !settledRows.some((s) => s.sourceTs === e.ts)
  })
  // 只有"结算腿是窗口之后才装上的"这一种情形才豁免历史;腿早就在跑(firstSettledAt ≤ cutoff)
  // 时所有超窗未结算一律算缺口 —— 否则修正常态化会顺手把真缺口也放过(失效方向必须朝向多报)。
  const legInstalledAfterWindow = Number.isFinite(firstSettledAt) && firstSettledAt > cutoff
  const dangling = legInstalledAfterWindow
    ? unsettled.filter((e) => Date.parse(String(e.ts ?? '')) >= firstSettledAt)
    : unsettled
  const legacy = unsettled.length - dangling.length
  if (noProgress.length > 0) {
    return {
      dim: 'A7-dispatch-closure',
      state: 'drift',
      readout: `结算已跑,但 ${noProgress.length} 枚"会话报成功而票行零推进,且该票没有任何绑票键的提交"(已推进 ${advanced.length} 枚${landedButUnadvanced.length ? `;另有 ${landedButUnadvanced.length} 枚已落账未推进,见下一档` : ''})`,
      next:
        noProgress.map((s) => `${s.ticketKey} :: ${String(s.ticketLine).slice(0, 60)}`).join('\n') +
        '\n出路:这一档里 `artifact-committed` 一枚都没有 ⇒ 工作没进仓。先核该会话末轮实际动作与派发票的权限档(不是改判据措辞);落账腿自己的读数见 A13。',
    }
  }
  if (landedButUnadvanced.length > 0) {
    return {
      dim: 'A7-dispatch-closure',
      state: 'drift',
      readout: `${landedButUnadvanced.length} 枚会话结果档已有**绑票键的提交**(${[...new Set(landedButUnadvanced.map((s) => String(s.ticketKey)))].join(',')})但票行未推进 ⇒ 活干完了、账没结清,缺口在调度侧的结清/推进腿,不在会话`,
      next:
        landedButUnadvanced
          .map((s) => `${s.ticketKey} :: ${String(s.ticketLine).slice(0, 60)}`)
          .join('\n') +
        '\n出路:核 `settlePriorDispatches` 之后那一腿有没有把已落账的票交还给台账写入口(live-doc-edit 的翻勾/摘行),以及有没有被活文档归并按"对侧还留着旧行"顶回;会话侧无需再动。',
    }
  }
  if (dangling.length > 0) {
    return {
      dim: 'A7-dispatch-closure',
      state: 'drift',
      readout: `${dangling.length} 枚超 ${windowHours}h 的会话结果档(${results.join('|')})在结算腿生效后仍无结算行 ⇒ 结算腿覆盖不全(尺子盲区)${legacy ? `;另有 ${legacy} 枚结算腿生效前的历史成功,只报数` : ''}`,
      next: '核结算循环是否每轮都跑、窗口取值是否小于调度存活期',
    }
  }
  if (unjudgedS.length > 0) {
    return {
      dim: 'A7-dispatch-closure',
      state: 'unjudged',
      readout: `结算跑了但 ${unjudgedS.length} 枚落未判定(派单面当时取不到)⇒ 不冒充"推进了"`,
      next: '先修取票口(见 A3)',
    }
  }
  return {
    dim: 'A7-dispatch-closure',
    state: 'ok',
    readout: `会话结果档 ${okRows.length} 枚(射程=${results.join('|')})/ 已结算 ${settledRows.length} 条,零"报成功而零推进"${legacy ? `;历史未结算存量 ${legacy} 枚(结算腿生效前的成功,只报数不顶红)` : ''}`,
    next: '',
  }
}

async function selfTest() {
  let pass = 0
  let fail = 0
  const ok = (n, c) => {
    if (c) pass++
    else {
      fail++
      console.log(`  ❌ ${n}`)
    }
  }
  const root = 'D:\\IHUI-AI'
  ok(
    'H1 现读活配置给三态之一(不猜)',
    (() => {
      const r = judgePreflight(`node \${REPO_ROOT}/apps/cli/dist/index.js`, root)
      return ['ok', 'drift', 'unjudged'].includes(r.state)
    })(),
  )
  ok(
    'H2 执行体不在位 ⇒ drift 且点名缺哪枚',
    (() => {
      const r = judgePreflight('node D:/Nope-Repo-ZZZ/apps/cli/dist/index.js', root)
      return r.state === 'drift' && r.next.includes('Nope-Repo-ZZZ')
    })(),
  )
  ok('H3 空模板 ⇒ unjudged(不冒充"健康")', judgePreflight('  ', root).state === 'unjudged')
  // 封票夹具必须用相对时间:绝对时刻一过期,判据就必然落到"已解封"分支,用例永久红(H4)
  // 或空转假绿(H5)。语义是"此刻仍在封禁中",故取 now+1h。
  ok(
    'H4 冤封识别:ERR_MODULE_NOT_FOUND 的失败 + 同键 quarantined ⇒ drift',
    (() => {
      const future = new Date(Date.now() + 3600_000).toISOString()
      const ev = [
        {
          action: 'session-failed',
          ticketKey: 'k1',
          exitCode: 1,
          why: "Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'G:/x'",
        },
        { action: 'quarantined', ticketKey: 'k1', until: future, ticketLine: 'X-1 某票' },
      ]
      const r = judgeMisattribution(ev)
      return r.state === 'drift' && r.readout.includes('1')
    })(),
  )
  ok(
    'H5 变异:真·会话失败的封票不算冤(分型不得把票的失败也免掉)',
    (() => {
      const future = new Date(Date.now() + 3600_000).toISOString()
      const ev = [
        { action: 'session-failed', ticketKey: 'k2', exitCode: 1, why: 'typecheck failed' },
        { action: 'quarantined', ticketKey: 'k2', until: future, ticketLine: 'X-2' },
      ]
      return judgeMisattribution(ev).state === 'ok'
    })(),
  )
  ok(
    'H6 台账取不到 ⇒ unjudged,不用 0 冒充"没失败过"',
    (() => {
      const r = evaluateAll({
        repoRoot: root,
        gatesText: JSON.stringify({ sessionCommandTemplate: 'x', ticketWhitelist: ['a'] }),
        events: { ok: false, events: [], why: 'no file' },
        ticketRows: [],
      })
      return r.dims.some((d) => d.state === 'unjudged')
    })(),
  )
  ok('H7 白名单空 ⇒ drift(结构上无票可派必须喊)', judgeWhitelist([], []).state === 'drift')
  ok(
    'H8b 零写盘班次也算"派过" ⇒ 新档不得被读成一次都没派(那样本维会假红,§12e)',
    judgeWhitelist([{ action: 'no-whitelist-hit' }, { action: 'session-no-write' }], ['a'])
      .state === 'ok',
  )
  ok(
    'H8 只未命中零派发 ⇒ drift;有派发 ⇒ 不喊',
    judgeWhitelist([{ action: 'no-whitelist-hit' }], ['a']).state === 'drift' &&
      judgeWhitelist([{ action: 'session-ok' }], ['a']).state === 'ok',
  )
  ok(
    'H9 身份稳定:同型不同明细同键(§5e-3 不掺时刻/sha)',
    (() => {
      const mk = (until) => ({
        state: 'drift',
        dims: [{ dim: 'A2-attribution', state: 'drift', until }],
      })
      return alertIdentity(mk('x')) === alertIdentity(mk('y'))
    })(),
  )
  ok(
    'H10 变异:三态不得并桶 —— 全 ok 与有 unjudged 的 state 不同',
    (() => {
      const g = JSON.stringify({
        sessionCommandTemplate: `node \${REPO_ROOT}/apps/cli/dist/index.js`,
        ticketWhitelist: ['a'],
      })
      const allOk = evaluateAll({
        repoRoot: root,
        gatesText: g,
        events: { ok: true, events: [{ action: 'session-ok', ticketKey: 'k' }] },
        ticketRows: [{ key: 'k', text: 'a' }],
      })
      const withUnjudged = evaluateAll({
        repoRoot: root,
        gatesText: g,
        events: { ok: true, events: [{ action: 'session-ok', ticketKey: 'k' }] },
        ticketRows: [],
      })
      return (
        allOk.state === 'ok' &&
        withUnjudged.state === 'unjudged' &&
        allOk.summary !== withUnjudged.summary
      )
    })(),
  )
  ok(
    'H11 封票射程:封禁中的票真被计入 blocked(键按行文本现算)',
    (() => {
      const future = new Date(Date.now() + 3600_000).toISOString()
      const row = { text: 'X-9 **某张被冤封的票**', line: 7 }
      const ev = [{ action: 'quarantined', ticketKey: ticketKeyOf(row.text), until: future }]
      const r = judgeRange(ev, [row])
      return r.state === 'drift' && r.readout.includes('封禁中 1 行')
    })(),
  )
  ok(
    'H11b 变异:若按不存在的 t.key 比集合就会读成 0(本尺的假绿形态必须被钉住)',
    (() => {
      const row = { text: 'X-10 另一张票', line: 8 }
      const ev = [
        {
          action: 'quarantined',
          ticketKey: ticketKeyOf(row.text),
          until: new Date(Date.now() + 3600_000).toISOString(),
        },
      ]
      const naiveBlocked = [{ action: 'quarantined', ticketKey: ticketKeyOf(row.text) }].filter(
        (e) => e.ticketKey === row.key,
      ).length
      return naiveBlocked === 0 && judgeRange(ev, [row]).readout.includes('封禁中 1 行')
    })(),
  )
  ok(
    'H12 取票口径不自行拼装(§0.6 单源):DISPATCH_ARGS 三旗齐',
    DISPATCH_ARGS.join(' ') === '--open --dispatchable --exclude-inflight',
  )
  ok(
    'H13 resolveSessionCommand 与 preflight 用的是同一仓根口径',
    (() => {
      const cmd = resolveSessionCommand(`node \${REPO_ROOT}/a.js -w D:/Nope-Repo`, root)
      return cmd.includes(`${root}\\a.js`) || cmd.includes('D:/Nope-Repo')
    })(),
  )
  // A5 的夹具走注入档(验证器不复用被测的那条真 fetch,否则量的是网络不是判据)
  const fakeFetch =
    (statuses, errors = {}) =>
    async (url) => {
      if (errors[url]) throw Object.assign(new Error(errors[url]), { cause: { code: errors[url] } })
      return { status: statuses[url] ?? 500 }
    }
  const h15 = await judgeBackendTransit({
    apiBase: 'http://api.test',
    aiBase: 'http://ai.test',
    fetchImpl: fakeFetch({ 'http://api.test/health': 200, 'http://ai.test/health': 200 }),
  })
  ok('H15 A5 双臂都应答 ⇒ ok', h15.state === 'ok' && h15.readout.includes('200'))
  const h16 = await judgeBackendTransit({
    apiBase: 'http://api.test',
    aiBase: 'http://ai.test',
    fetchImpl: fakeFetch(
      { 'http://api.test/health': 200 },
      { 'http://ai.test/health': 'ECONNREFUSED' },
    ),
  })
  ok(
    'H16 变异:一臂拒连 ⇒ drift 且点名是哪条臂(两臂不并桶)',
    h16.state === 'drift' && h16.readout.includes('ai.test') && !h16.readout.includes('api.test'),
  )
  const h17 = await judgeBackendTransit({ apiBase: 'http://api.test', aiBase: null })
  ok('H17 aiBase 取不到 ⇒ unjudged,不用"api 通"冒充整链通', h17.state === 'unjudged')
  const h18 = evaluateAll({
    repoRoot: root,
    gatesText: JSON.stringify({
      sessionCommandTemplate: `node \${REPO_ROOT}/apps/cli/dist/index.js`,
      ticketWhitelist: ['a'],
    }),
    events: { ok: true, events: [{ action: 'session-ok', ticketKey: 'k' }] },
    ticketRows: [{ key: 'k', text: 'a' }],
    transit: h16,
  })
  ok(
    'H18 A5 的 drift 必须顶起整尺 drift(否则服务断了尺子还报绿)',
    h18.state === 'drift' && h18.dims.some((d) => d.dim === 'A5-backend-transit'),
  )
  ok(
    'H19 取材面纪律:被审面取不到 ⇒ 抛 Undetermined,绝不回落磁盘那一份(§0.3/守门 118)',
    (() => {
      try {
        readGatesFace('head', join(ROOT, '..'))
        return false
      } catch (e) {
        return e instanceof Undetermined
      }
    })(),
  )
  ok(
    'H20 同一份配置在 HEAD 与索引可各自取到(清单与内容同面同轮)',
    (() => {
      try {
        return String(readGatesFace('head', ROOT)).includes('sessionCommandTemplate')
      } catch {
        return false
      }
    })(),
  )
  ok(
    'H19b 不传 face ⇒ 默认取 FACE_SEL.face,而不是整个选面对象',
    (() => {
      // 默认值是对象时 `face === 'staged'/'worktree'` 全落空 ⇒ 一律静默按 HEAD 读;
      // 本机 --self-test 的 FACE_SEL.face 恰好也是 head,行为上看不出差别,故同时钉默认表达式本身
      // (写死断言,不读环境变量;回归到对象写法即红)。
      const defaultExpr = /face\s*=\s*FACE_SEL\.face\s*(?:,|\))/.test(readGatesFace.toString())
      return (
        defaultExpr &&
        typeof FACE_SEL.face === 'string' &&
        readGatesFace(undefined, ROOT) === readGatesFace(FACE_SEL.face, ROOT)
      )
    })(),
  )
  const wiredSrc =
    'function runOnce(){ const valve = gateTicketByHumanValve({ ticketText, mode, valveListText }) }'
  ok(
    'H21 派发路径没有调用点 ⇒ drift(闸只是装饰,这正是 2026-11-01 之前的实测形态)',
    judgeValveGate([], {
      mode: 'observe',
      headSource: 'function runOnce(){ dispatchSession(gates, ticket) }',
    }).state === 'drift',
  )
  ok(
    'H22 被审面取不到 ⇒ unjudged,不用"取不到"冒充"没接线"',
    judgeValveGate([], { mode: 'observe', headSource: null }).state === 'unjudged',
  )
  ok(
    'H23 有真派发尝试而零 valve 留痕 ⇒ drift(代码在却没被走到)',
    judgeValveGate([{ action: 'session-ok', ticketKey: 'k' }], {
      mode: 'observe',
      headSource: wiredSrc,
    }).state === 'drift',
  )
  ok(
    'H24 observe 档有留痕 ⇒ ok 且报命中分布与切 enforce 的前置',
    (() => {
      const ev = [
        { action: 'session-ok', ticketKey: 'k' },
        { action: 'valve-observe-stop', ticketKey: 'k', ruleId: 'production-deploy' },
        { action: 'valve-allow', ticketKey: 'k2', ruleId: 'code-and-docs' },
      ]
      const r = judgeValveGate(ev, { mode: 'observe', headSource: wiredSrc })
      return (
        r.state === 'ok' &&
        r.readout.includes('production-deploy×1') &&
        r.next.includes('完整流量周期')
      )
    })(),
  )
  ok(
    'H25 变异:observe 期出现未判定 ⇒ drift(enforce 前置未满足,不能放量)',
    judgeValveGate(
      [
        { action: 'session-failed', ticketKey: 'k' },
        { action: 'valve-unjudged', ticketKey: 'k' },
      ],
      { mode: 'observe', headSource: wiredSrc },
    ).state === 'drift',
  )
  ok(
    'H26 档位取值非法 ⇒ drift(不猜档)',
    judgeValveGate([], { mode: 'yolo', headSource: wiredSrc }).state === 'drift',
  )
  // H27-H28:"拦对了"与"没规则可判"必须分开报(2026-11-04 实测 12 枚候选里 11 枚落 unknown,
  // 混在一个数里报就会有人拿"阀在拦"当成绩、也有人拿"unknown 多"去拆 fail-closed 默认)。
  ok(
    'H27 unknown 与具名停机分档读数,且出路文案各指一边',
    (() => {
      const ev = [
        { action: 'session-failed', ticketKey: 'k' },
        { action: 'valve-observe-stop', ticketKey: 'k', ruleId: 'unknown-fail-closed' },
        { action: 'valve-observe-stop', ticketKey: 'k', ruleId: 'unknown-fail-closed' },
        { action: 'valve-observe-stop', ticketKey: 'k', ruleId: 'production-deploy' },
      ]
      const r = judgeValveGate(ev, { mode: 'observe', headSource: wiredSrc })
      return (
        r.state === 'ok' &&
        r.readout.includes('具名 1') &&
        r.readout.includes('无规则可判 2') &&
        r.next.includes('摘出自动派单面') &&
        r.next.includes('MATCHERS')
      )
    })(),
  )
  ok(
    'H28 全部具名命中时不得再喊"补匹配器"(反向档:文案不能常驻吓人)',
    (() => {
      const r = judgeValveGate(
        [
          { action: 'session-failed', ticketKey: 'k' },
          { action: 'valve-observe-stop', ticketKey: 'k', ruleId: 'api-key-change' },
        ],
        { mode: 'observe', headSource: wiredSrc },
      )
      return r.state === 'ok' && r.next.includes('完整流量周期') && !r.next.includes('MATCHERS')
    })(),
  )
  // H41–H43 覆盖率复算(2026-11-04 立):能不能切 enforce 由**当前规则表**复算决定,不由历史 ruleId 决定。
  // 夹具的"已被覆盖票面"直接从清单自己的 examples 里取(V1 那条锁已经保证 examples 必被具名命中),
  // 不写死句子 —— 写死就等于把测试钉在某一刻的规则文本上,清单一改就假红。
  const valveListSelf = readFileSync(join(root, 'scripts', 'data', 'human-valve-list.json'), 'utf8')
  const coveredFaceSelf = (() => {
    const l = parseValveList(valveListSelf)
    for (const r of l.rules ?? []) {
      if (!Array.isArray(r.examples) || r.examples.length === 0) continue
      const v = classifyAction(r.examples[0], { rules: l.rules, now: new Date() })
      if (v.ruleId === r.id) return String(r.examples[0])
    }
    return ''
  })()
  ok(
    'H41 夹具自检:清单 examples 里至少有一枚能被自己的规则具名(否则下面的成对档全是空转)',
    coveredFaceSelf !== '' && coveredFaceSelf.length > 4,
    `covered=${coveredFaceSelf.slice(0, 60)}`,
  )
  ok(
    'H41a 历史 25 条 unknown + 当前规则表已能具名 ⇒ 仍 ok,并明说那是旧版的账(历史不得钉住 enforce 前置)',
    (() => {
      const ev = [
        { action: 'session-failed', ticketKey: 'k' },
        {
          action: 'valve-observe-stop',
          ticketKey: 'k',
          ruleId: UNKNOWN_RULE_ID,
          ticketLine: coveredFaceSelf,
        },
        {
          action: 'valve-observe-stop',
          ticketKey: 'k2',
          ruleId: UNKNOWN_RULE_ID,
          ticketLine: coveredFaceSelf,
        },
      ]
      const r = judgeValveGate(ev, {
        mode: 'observe',
        headSource: wiredSrc,
        valveListText: valveListSelf,
      })
      return (
        r.state === 'ok' &&
        r.readout.includes('仍无规则 0') &&
        r.next.includes('旧版分类器') &&
        !r.next.includes('MATCHERS 补形态')
      )
    })(),
  )
  ok(
    'H41b 变异:摘掉 valveListText(不测覆盖)⇒ 历史 unknown 会把人引去"补匹配器" —— 这正是旧读数的形态',
    (() => {
      const ev = [
        { action: 'session-failed', ticketKey: 'k' },
        {
          action: 'valve-observe-stop',
          ticketKey: 'k',
          ruleId: UNKNOWN_RULE_ID,
          ticketLine: coveredFaceSelf,
        },
      ]
      const r = judgeValveGate(ev, { mode: 'observe', headSource: wiredSrc })
      return r.state === 'ok' && r.next.includes('MATCHERS 补形态')
    })(),
  )
  ok(
    'H42 真盲区:当前规则表也判不出的票面 ⇒ drift,并把样例票面原样带出去(出路=补形态,不是摘票)',
    (() => {
      const blind = 'zzz-清单里从没人写过的动作-9f3c 校准仪表'
      const ev = [
        { action: 'session-failed', ticketKey: 'k' },
        {
          action: 'valve-observe-stop',
          ticketKey: 'k',
          ruleId: UNKNOWN_RULE_ID,
          ticketLine: blind,
        },
      ]
      const r = judgeValveGate(ev, {
        mode: 'observe',
        headSource: wiredSrc,
        valveListText: valveListSelf,
      })
      return (
        r.state === 'drift' &&
        r.readout.includes('仍无规则 1') &&
        r.next.includes('MATCHERS 补形态') &&
        r.next.includes('zzz-清单里从没人写过的动作')
      )
    })(),
  )
  ok(
    'H43 规则表取不到/坏 ⇒ 覆盖率**未判定**(既不冒"全覆盖"也不冒"有盲区")',
    (() => {
      const ev = [
        { action: 'session-failed', ticketKey: 'k' },
        {
          action: 'valve-observe-stop',
          ticketKey: 'k',
          ruleId: 'api-key-change',
          ticketLine: coveredFaceSelf,
        },
      ]
      const bad = judgeValveGate(ev, {
        mode: 'observe',
        headSource: wiredSrc,
        valveListText: '{ 不是合法 JSON',
      })
      const none = judgeValveGate([], {
        mode: 'observe',
        headSource: wiredSrc,
        valveListText: null,
      })
      return (
        bad.state === 'unjudged' &&
        bad.readout.includes('覆盖率复算:❌ 未判定') &&
        none.state === 'unjudged'
      )
    })(),
  )
  ok(
    'H27 A6 的 drift 必须顶起整尺(闸哑了尺子不能报绿)',
    (() => {
      const g = JSON.stringify({
        sessionCommandTemplate: `node \${REPO_ROOT}/apps/cli/dist/index.js`,
        ticketWhitelist: ['a'],
        humanValveMode: 'observe',
      })
      const r = evaluateAll({
        repoRoot: root,
        gatesText: g,
        events: { ok: true, events: [{ action: 'session-ok', ticketKey: 'k' }] },
        ticketRows: [{ text: 'a', line: 1 }],
        valve: judgeValveGate([{ action: 'session-ok', ticketKey: 'k' }], {
          mode: 'observe',
          headSource: wiredSrc,
        }),
      })
      return r.state === 'drift' && r.dims.some((d) => d.dim === 'A6-human-valve-gate')
    })(),
  )
  const closureSrc =
    "export const SESSION_RESULT_ACTIONS = Object.freeze(['session-ok', 'session-no-write'])\nfunction runOnce(){ const settled = settlePriorDispatches({ ledger, currentRows: allRows }) }"
  ok(
    'H28 派发器里没有结算调用 ⇒ drift(成功判定仍等于退出码)',
    judgeDispatchClosure([], {
      schedulerSource: 'function runOnce(){ dispatchSession(gates, ticket) }',
    }).state === 'drift',
  )
  ok(
    'H29 被审面取不到 ⇒ unjudged,不冒充"闭环健康"',
    judgeDispatchClosure([], { schedulerSource: null }).state === 'unjudged',
  )
  ok(
    'H29b 被审面有源码但解析不到 SESSION_RESULT_ACTIONS ⇒ unjudged,绝不回落"只认 session-ok"',
    judgeDispatchClosure([], { schedulerSource: 'function runOnce(){ settlePriorDispatches({}) }' })
      .state === 'unjudged',
  )
  ok(
    'H29c 新增成功档(session-no-write)必须落进结算射程:它有行无结算 ⇒ 仍按"结算腿覆盖不全"翻红',
    (() => {
      const ev = [
        {
          action: 'session-no-write',
          ticketKey: 'kw',
          ts: '2026-10-29T04:00:00.000Z',
          ticketLine: 'B7 原样',
        },
      ]
      const r = judgeDispatchClosure(ev, {
        schedulerSource: closureSrc,
        now: Date.parse('2026-11-01T05:00:00.000Z'),
      })
      return r.state === 'drift' && String(r.readout).includes('session-no-write')
    })(),
  )
  ok(
    'H30 结算判出"报成功而票行零推进" ⇒ drift 并点名票面',
    (() => {
      const ev = [
        {
          action: 'session-ok',
          ticketKey: 'k1',
          ts: '2026-10-31T05:00:00.000Z',
          ticketLine: 'B9 **某票** 原文',
        },
        {
          action: 'dispatch-settled',
          ticketKey: 'k1',
          sourceTs: '2026-10-31T05:00:00.000Z',
          settled: 'no-progress',
          ticketLine: 'B9 **某票** 原文',
        },
      ]
      const r = judgeDispatchClosure(ev, {
        schedulerSource: closureSrc,
        now: Date.parse('2026-11-01T05:00:00.000Z'),
      })
      return r.state === 'drift' && r.readout.includes('1 枚') && r.next.includes('B9')
    })(),
  )
  // H30b–H30d 合格线改绑"票行推进 ∪ 绑票键的提交"的成对锁(2026-11-05)。
  // 三档各 directional:① 已落账未推进 ⇒ 归因必须换到结清/推进腿;② 什么都没落账 ⇒ 仍按"活没进仓"红;
  // ③ 提交行不带票键 ⇒ 不得据此把任何票洗白(防"全场只有一条 artifact-committed 就全体免")。
  const noProgressEv = (extra) => [
    {
      action: 'session-ok',
      ticketKey: 'k1',
      ts: '2026-10-31T05:00:00.000Z',
      ticketLine: 'B9 **某票** 原文',
    },
    {
      action: 'dispatch-settled',
      ticketKey: 'k1',
      sourceTs: '2026-10-31T05:00:00.000Z',
      settled: 'no-progress',
      ticketLine: 'B9 **某票** 原文',
    },
    ...(extra ?? []),
  ]
  const closureNow = { now: Date.parse('2026-11-01T05:00:00.000Z') }
  ok(
    'H30b 同一票已有 artifact-committed 而票行未动 ⇒ drift 且归因换成结清/推进腿(不许再说活没进仓)',
    (() => {
      const r = judgeDispatchClosure(
        noProgressEv([
          {
            action: 'artifact-committed',
            ticketKey: 'k1',
            ts: '2026-10-31T05:30:00.000Z',
            files: ['a.ts'],
          },
        ]),
        { schedulerSource: closureSrc, ...closureNow },
      )
      return (
        r.state === 'drift' &&
        r.readout.includes('绑票键的提交') &&
        r.readout.includes('k1') &&
        !r.readout.includes('且该票没有任何绑票键的提交')
      )
    })(),
  )
  ok(
    'H30c 反向:没有任何绑票键提交 ⇒ 仍按"活没进仓"翻红(合格线不因新档而放宽)',
    (() => {
      const r = judgeDispatchClosure(noProgressEv([]), {
        schedulerSource: closureSrc,
        ...closureNow,
      })
      return r.state === 'drift' && r.readout.includes('没有任何绑票键的提交')
    })(),
  )
  ok(
    'H30d 提交行不带票键 ⇒ 不构成"该票已落账",不得据此洗白任何票',
    (() => {
      const r = judgeDispatchClosure(
        noProgressEv([
          { action: 'artifact-committed', ts: '2026-10-31T05:30:00.000Z', files: ['a.ts'] },
        ]),
        { schedulerSource: closureSrc, ...closureNow },
      )
      return r.state === 'drift' && r.readout.includes('没有任何绑票键的提交')
    })(),
  )
  ok(
    'H30e 配对锁:提交时刻**早于**该轮会话 ⇒ 不算本轮落账(一次历史提交不得长期豁免此后每次零推进)',
    (() => {
      const r = judgeDispatchClosure(
        noProgressEv([
          {
            action: 'artifact-committed',
            ticketKey: 'k1',
            ts: '2026-10-30T05:00:00.000Z',
            files: ['a.ts'],
          },
        ]),
        { schedulerSource: closureSrc, ...closureNow },
      )
      return r.state === 'drift' && r.readout.includes('没有任何绑票键的提交')
    })(),
  )
  ok(
    'H30f 配对锁:同票但取不到时刻(settled 无 sourceTs/ts)⇒ 落回 bare,绝不因"配不上"而免(失效方向朝多报)',
    (() => {
      const ev = [
        {
          action: 'session-ok',
          ticketKey: 'k1',
          ts: '2026-10-31T05:00:00.000Z',
          ticketLine: 'B9 **某票** 原文',
        },
        {
          action: 'dispatch-settled',
          ticketKey: 'k1',
          settled: 'no-progress',
          ticketLine: 'B9 **某票** 原文',
        },
        {
          action: 'artifact-committed',
          ticketKey: 'k1',
          ts: '2026-11-01T04:00:00.000Z',
          files: ['a.ts'],
        },
      ]
      const r = judgeDispatchClosure(ev, { schedulerSource: closureSrc, ...closureNow })
      return r.state === 'drift' && r.readout.includes('没有任何绑票键的提交')
    })(),
  )
  ok(
    'H31 有推进(line-changed)⇒ ok,不得把动过的票也算成零推进',
    (() => {
      const ev = [
        {
          action: 'session-ok',
          ticketKey: 'k2',
          ts: '2026-10-31T05:00:00.000Z',
          ticketLine: 'B10 旧文本',
        },
        {
          action: 'dispatch-settled',
          ticketKey: 'k2',
          sourceTs: '2026-10-31T05:00:00.000Z',
          settled: 'line-changed',
        },
      ]
      return (
        judgeDispatchClosure(ev, {
          schedulerSource: closureSrc,
          now: Date.parse('2026-11-01T05:00:00.000Z'),
        }).state === 'ok'
      )
    })(),
  )
  ok(
    'H32 变异:超窗却没结算行 ⇒ drift(结算腿覆盖不全=尺子盲区)',
    (() => {
      const ev = [
        {
          action: 'session-ok',
          ticketKey: 'k3',
          ts: '2026-10-20T05:00:00.000Z',
          ticketLine: 'B11 陈旧的成功',
        },
      ]
      return (
        judgeDispatchClosure(ev, {
          schedulerSource: closureSrc,
          now: Date.parse('2026-11-01T05:00:00.000Z'),
        }).state === 'drift'
      )
    })(),
  )
  ok(
    'H33 A7 的 drift 必须顶起整尺',
    (() => {
      const g = JSON.stringify({
        sessionCommandTemplate: `node \${REPO_ROOT}/apps/cli/dist/index.js`,
        ticketWhitelist: ['a'],
        humanValveMode: 'observe',
      })
      const r = evaluateAll({
        repoRoot: root,
        gatesText: g,
        events: { ok: true, events: [] },
        ticketRows: [{ text: 'a', line: 1 }],
        closure: judgeDispatchClosure([], { schedulerSource: 'no settle here' }),
      })
      return r.state === 'drift' && r.dims.some((d) => d.dim === 'A7-dispatch-closure')
    })(),
  )
  ok(
    'H34 A3 少量封禁(未过半)⇒ ok 且报数,不顶红(§12e:封禁是机器状态,不是本次改动带进来的)',
    (() => {
      const future = new Date(Date.now() + 3600_000).toISOString()
      const rows = Array.from({ length: 20 }, (_, i) => ({ text: `X-${i} 票${i}`, line: i + 1 }))
      const ev = [{ action: 'quarantined', ticketKey: ticketKeyOf(rows[0].text), until: future }]
      const r = judgeRange(ev, rows)
      return r.state === 'ok' && r.readout.includes('封禁中 1 行') && r.readout.includes('只报数')
    })(),
  )
  ok(
    'H35 A3 变异:封禁过半 ⇒ drift(结构性锁死才配叫人,不得靠调阈值把整面被封也放过)',
    (() => {
      const future = new Date(Date.now() + 3600_000).toISOString()
      const rows = Array.from({ length: 10 }, (_, i) => ({ text: `Y-${i} 票${i}`, line: i + 1 }))
      const ev = rows
        .slice(0, 6)
        .map((r) => ({ action: 'quarantined', ticketKey: ticketKeyOf(r.text), until: future }))
      const r = judgeRange(ev, rows)
      return r.state === 'drift' && r.readout.includes('封禁中 6 行')
    })(),
  )
  ok(
    'H36 结算腿生效前的历史成功 ⇒ ok 只报数(不要求一门今天装的车去结算它出生前的账)',
    (() => {
      const ev = [
        {
          action: 'session-ok',
          ticketKey: 'k7',
          ts: '2026-10-20T05:00:00.000Z',
          ticketLine: 'B13 陈旧的成功',
        },
        {
          action: 'dispatch-settled',
          ticketKey: 'k8',
          sourceTs: '2026-11-01T00:00:00.000Z',
          settled: 'line-gone',
          ts: '2026-11-01T00:00:05.000Z',
        },
      ]
      const r = judgeDispatchClosure(ev, {
        schedulerSource: closureSrc,
        now: Date.parse('2026-11-01T05:00:00.000Z'),
      })
      return r.state === 'ok' && r.readout.includes('历史未结算存量 1 枚')
    })(),
  )
  ok(
    'H37 变异:结算腿生效后仍超窗未结算 ⇒ 照样 drift(修正不得顺手放过真缺口)',
    (() => {
      const ev = [
        {
          action: 'session-ok',
          ticketKey: 'k9',
          ts: '2026-10-30T04:00:00.000Z',
          ticketLine: 'B14 生效后的成功',
        },
        {
          action: 'dispatch-settled',
          ticketKey: 'k10',
          sourceTs: '2026-10-25T00:00:00.000Z',
          settled: 'line-gone',
          ts: '2026-10-25T00:00:05.000Z',
        },
      ]
      const r = judgeDispatchClosure(ev, {
        schedulerSource: closureSrc,
        now: Date.parse('2026-11-01T05:00:00.000Z'),
      })
      return r.state === 'drift' && r.readout.includes('结算腿生效后仍无结算行')
    })(),
  )
  ok(
    'H38 票仍在册 + no-progress ⇒ 仍 drift(按票收敛不得假绿放走真事故)',
    (() => {
      const ev = [
        {
          action: 'session-ok',
          ticketKey: 'k1',
          ts: '2026-10-31T05:00:00.000Z',
          ticketLine: 'B9 **某票** 原文',
        },
        {
          action: 'dispatch-settled',
          ticketKey: 'k1',
          sourceTs: '2026-10-31T05:00:00.000Z',
          settled: 'no-progress',
          ticketLine: 'B9 **某票** 原文',
        },
      ]
      const r = judgeDispatchClosure(ev, {
        schedulerSource: closureSrc,
        now: Date.parse('2026-11-01T05:00:00.000Z'),
        activeTicketKeys: new Set(['k1']),
      })
      return r.state === 'drift' && r.readout.includes('1 枚') && r.next.includes('B9')
    })(),
  )
  ok(
    'H39 票已从在册面摘除 ⇒ 该票历史 no-progress 不再顶红(按票收敛,不按时间窗抹历史)',
    (() => {
      const ev = [
        {
          action: 'session-ok',
          ticketKey: 'k1',
          ts: '2026-10-31T05:00:00.000Z',
          ticketLine: 'B9 **某票** 原文',
        },
        {
          action: 'dispatch-settled',
          ticketKey: 'k1',
          sourceTs: '2026-10-31T05:00:00.000Z',
          settled: 'no-progress',
          ticketLine: 'B9 **某票** 原文',
        },
      ]
      const r = judgeDispatchClosure(ev, {
        schedulerSource: closureSrc,
        now: Date.parse('2026-11-01T05:00:00.000Z'),
        activeTicketKeys: new Set(['k-other']),
      })
      return r.state === 'ok' && r.readout.includes('已结算 1 条')
    })(),
  )
  ok(
    'H40 activeTicketKeys 缺省 ⇒ 旧行为不变(历史 no-progress 照旧顶红)',
    (() => {
      const ev = [
        {
          action: 'session-ok',
          ticketKey: 'k1',
          ts: '2026-10-31T05:00:00.000Z',
          ticketLine: 'B9 **某票** 原文',
        },
        {
          action: 'dispatch-settled',
          ticketKey: 'k1',
          sourceTs: '2026-10-31T05:00:00.000Z',
          settled: 'no-progress',
          ticketLine: 'B9 **某票** 原文',
        },
      ]
      return (
        judgeDispatchClosure(ev, {
          schedulerSource: closureSrc,
          now: Date.parse('2026-11-01T05:00:00.000Z'),
        }).state === 'drift'
      )
    })(),
  )
  // —— A11 产出型维度(2026-11-04 立):腿在跑但闭环零产出必须被量出来 ——
  const a11Ok = judgeClosureOutput({
    inputsOk: true,
    decisions: 294,
    existingCount: 18,
    pending: 0,
    latestSignalAt: '2026-11-04T11:08:05.659Z',
    dispatchAt: '2026-11-04T11:30:00.000Z',
    now: Date.parse('2026-11-04T11:40:00.000Z'),
  })
  ok(
    'H44 待产 0 ⇒ ok 且读数带决策/信号/派发戳新鲜度',
    a11Ok.state === 'ok' && a11Ok.readout.includes('待产 0') && a11Ok.readout.includes('10min 前'),
  )
  const a11Drift = judgeClosureOutput({
    inputsOk: true,
    decisions: 294,
    existingCount: 6,
    pending: 2,
    pendingRows: [{ route: 'deploy/swap-fail' }, { route: 'deploy/build-fail' }],
    dispatchAt: '2026-11-04T11:30:00.000Z',
    now: Date.parse('2026-11-04T11:40:00.000Z'),
  })
  ok(
    'H45 变异:待产 2 ⇒ drift 且按 route 点名(漏产必须可整改)',
    a11Drift.state === 'drift' &&
      a11Drift.readout.includes('deploy/swap-fail×1') &&
      a11Drift.next.includes('deploy-outcome-intake'),
  )
  ok(
    'H46 取料不全 ⇒ unjudged,不冒充"有产出"',
    judgeClosureOutput({ inputsOk: false, why: '两候选都不在' }).state === 'unjudged',
  )
  ok(
    'H47 形状坏行 ⇒ unjudged(摄入器会落未判定,尺子不替它判)',
    judgeClosureOutput({ inputsOk: true, badRows: 1, pending: 0 }).state === 'unjudged',
  )
  ok(
    'H48 恒红门反向锁:全 pass 决策账 + 空信号账 + 陈旧派发戳 ⇒ 仍 ok(不许"没事故就报红")',
    (() => {
      const r = judgeClosureOutput({
        inputsOk: true,
        decisions: 12,
        existingCount: 0,
        pending: 0,
        latestSignalAt: null,
        dispatchAt: '2026-10-01T00:00:00.000Z',
        now: Date.parse('2026-11-04T11:40:00.000Z'),
      })
      return r.state === 'ok' && r.readout.includes('(尚无)')
    })(),
  )
  ok(
    'H49 A11 的 drift 必须顶起整尺',
    (() => {
      const g = JSON.stringify({
        sessionCommandTemplate: `node \${REPO_ROOT}/apps/cli/dist/index.js`,
        ticketWhitelist: ['a'],
      })
      const r = evaluateAll({
        repoRoot: root,
        gatesText: g,
        events: { ok: true, events: [] },
        ticketRows: [{ text: 'a', line: 1 }],
        output: a11Drift,
      })
      return r.state === 'drift' && r.dims.some((d) => d.dim === 'A11-closure-output')
    })(),
  )
  ok(
    'H50 戳只作旁证:戳缺失+待产0 ⇒ ok;戳很新+待产>0 ⇒ 仍 drift',
    (() => {
      const noStamp = judgeClosureOutput({ inputsOk: true, pending: 0 })
      const freshButLeaking = judgeClosureOutput({
        inputsOk: true,
        pending: 1,
        pendingRows: [{ route: 'deploy/swap-fail' }],
        dispatchAt: '2026-11-04T11:39:00.000Z',
        now: Date.parse('2026-11-04T11:40:00.000Z'),
      })
      return (
        noStamp.state === 'ok' &&
        noStamp.readout.includes('取不到(A8') &&
        freshButLeaking.state === 'drift'
      )
    })(),
  )
  ok(
    'H51 取料层真跑给三态之一(装车自证,不硬判绿)',
    (() => {
      const r = judgeClosureOutputFace({ root: ROOT })
      return ['ok', 'drift', 'unjudged'].includes(r.state) && r.dim === 'A11-closure-output'
    })(),
  )
  const healthSrc = readFileSync(join(ROOT, 'scripts', 'check-autonomy-leg-health.mjs'), 'utf8')
  ok(
    'H52 A11 已装进 main 与 evaluateAll(有定义无接线 = 判据没装车)',
    healthSrc.includes('const output = judgeClosureOutputFace({ root: repoRoot })') &&
      /if \(output\) dims\.push\(output\)/.test(healthSrc),
  )
  // —— A12 全腿产出对账(2026-11-04 /goal R3):戳刷但账不产必须被量出来 ——
  const N12 = Date.parse('2026-11-04T15:00:00.000Z')
  // 覆盖面锁读工作树登记表:落地前 HEAD 面还是旧表,用被审面会把「刚装的新字段」判成腐烂。
  const REG12 = () => JSON.parse(readFileSync(join(ROOT, LIVENESS_REGISTRY_REL), 'utf8'))
  const L12 = (o = {}) => ({
    stamp: 'x-dispatch-last.json',
    outputKind: 'conditional',
    outputRel: 'x.jsonl',
    outputTimeField: 'ts',
    silenceCeilingMs: 24 * 3600_000,
    ...o,
  })
  const R12 = (ts, extra = {}) => JSON.stringify({ ts, ...extra }) + '\n'
  const dep12 = L12({
    stamp: 'dep-radar-dispatch-last.json',
    outputRel: 'dep-advisory-ledger.jsonl',
    silenceCeilingMs: 48 * 3600_000,
  })
  const depLedger12 = { 'dep-advisory-ledger.jsonl': R12('2026-10-30T01:04:21.776Z') }
  const a12Unjudged = judgeLegOutputs(
    classifyLegOutputs({
      legs: [dep12],
      ledgers: depLedger12,
      selfReports: { 'dep-radar-dispatch-last.json': true },
      now: N12,
    }),
  )
  ok(
    'H53 dep-radar 真况回放:静默 + 自报未判定 ⇒ A12 unjudged 点名输入面',
    (() => {
      return (
        a12Unjudged.dim === 'A12-leg-output-reconciliation' &&
        a12Unjudged.state === 'unjudged' &&
        a12Unjudged.readout.includes('dep-radar') &&
        a12Unjudged.readout.includes('采集输入面断链') &&
        a12Unjudged.next.includes('干净 env')
      )
    })(),
  )
  const a12Drift = judgeLegOutputs(
    classifyLegOutputs({
      legs: [L12({ outputKind: 'always', silenceCeilingMs: 6 * 3600_000 })],
      ledgers: { 'x.jsonl': R12('2026-10-01T00:00:00.000Z') },
      now: N12,
    }),
  )
  ok(
    'H54 变异:always 腿零产出 ⇒ A12 drift 且顶起整尺',
    (() => {
      const g = JSON.stringify({
        sessionCommandTemplate: `node \${REPO_ROOT}/apps/cli/dist/index.js`,
        ticketWhitelist: ['a'],
      })
      const r = evaluateAll({
        repoRoot: root,
        gatesText: g,
        events: { ok: true, events: [] },
        ticketRows: [{ text: 'a', line: 1 }],
        outputAll: a12Drift,
      })
      return (
        a12Drift.state === 'drift' &&
        r.state === 'drift' &&
        r.dims.some((d) => d.dim === 'A12-leg-output-reconciliation')
      )
    })(),
  )
  ok(
    'H55 恒红门反向锁:条件产腿合法静默 ⇒ A12 ok 且不顶红',
    (() => {
      const a12Ok = judgeLegOutputs(
        classifyLegOutputs({
          legs: [dep12],
          ledgers: depLedger12,
          selfReports: {},
          now: N12,
        }),
      )
      const g = JSON.stringify({
        sessionCommandTemplate: `node \${REPO_ROOT}/apps/cli/dist/index.js`,
        ticketWhitelist: ['a'],
      })
      const r = evaluateAll({
        repoRoot: root,
        gatesText: g,
        events: { ok: true, events: [] },
        ticketRows: [{ text: 'a', line: 1 }],
        outputAll: a12Ok,
      })
      return a12Ok.state === 'ok' && a12Ok.readout.includes('合法静默') && r.state !== 'drift'
    })(),
  )
  ok(
    'H56 登记表字段腐烂 / 账读不到 ⇒ unjudged,不冒充绿',
    (() => {
      const bad = judgeLegOutputs(
        classifyLegOutputs({ legs: [L12({ outputRel: '' })], ledgers: {}, now: N12 }),
      )
      const missing = judgeLegOutputs(
        classifyLegOutputs({ legs: [L12()], ledgers: { 'x.jsonl': null }, now: N12 }),
      )
      return bad.state === 'unjudged' && missing.state === 'unjudged'
    })(),
  )
  ok(
    'H57 日志自报:近窗命中 / 过期不计 / 无关腿不误配 / 修好后成功行立即自愈',
    (() => {
      const K = 'dep-radar-dispatch-last.json'
      const legs12 = [
        L12({
          stamp: K,
          selfReportToken: '依赖安全通告轮:未判定',
          logLegPrefix: '依赖安全通告轮:',
          silenceCeilingMs: 48 * 3600_000,
        }),
      ]
      const fresh = `[2026-11-04T01:38:21.893Z] ❓ 依赖安全通告轮:未判定 —— x\n`
      const old = `[2026-10-30T01:04:21.776Z] ❓ 依赖安全通告轮:未判定 —— x\n`
      const unrelated = `[2026-11-04T01:38:21.893Z] ✅ 感知层分诊轮:登记 0 枚 / 未判定 2 处\n`
      const recovered =
        fresh +
        `[2026-11-04T14:00:00.000Z] ✅ 依赖安全通告轮:通告 100 条 / 可修候选 42 枚 / 本轮票 3 枚\n`
      const a = selfReportsFromLog(fresh, legs12, N12)
      const b = selfReportsFromLog(old, legs12, N12)
      const c = selfReportsFromLog(unrelated, legs12, N12)
      const d = selfReportsFromLog(recovered, legs12, N12)
      return a[K] === true && b[K] === false && c[K] === false && d[K] === false
    })(),
  )
  ok(
    'H58 日志 tail 真跑:读得到 UTC 行且有字节上限',
    (() => {
      const p = join(ROOT, GUARDIAN_LOG_REL)
      if (!existsSync(p)) return false
      const t = readGuardianLogTail(p)
      return t.length > 0 && t.length <= LOG_TAIL_BYTES && /\[\d{4}-\d{2}-\d{2}T[^\]]+Z\]/.test(t)
    })(),
  )
  ok(
    'H59 A12 取料层真跑给三态之一且覆盖全 12 腿(装车自证)',
    (() => {
      const r = judgeLegOutputsFace({ root: ROOT, now: N12 })
      return (
        ['ok', 'drift', 'unjudged'].includes(r.state) &&
        r.dim === 'A12-leg-output-reconciliation' &&
        classifyLegOutputs({ legs: REG12().legs, ledgers: {}, now: N12 }).rows.length === 12
      )
    })(),
  )
  ok(
    'H60 A12 已装进 main 与 evaluateAll(有定义无接线 = 判据没装车)',
    healthSrc.includes(
      'const outputAll = judgeLegOutputsFace({ face: FACE_SEL.face, root: repoRoot })',
    ) && /if \(outputAll\) dims\.push\(outputAll\)/.test(healthSrc),
  )
  ok(
    'H61 登记表 12 腿全覆盖且产出字段齐备(A12 覆盖面锁)',
    (() => {
      const reg = REG12()
      return (
        reg.legs.length === 12 &&
        new Set(reg.legs.map((l) => l.stamp)).size === 12 &&
        reg.legs.every(
          (l) =>
            ['always', 'conditional', 'none'].includes(l.outputKind) &&
            Number.isInteger(l.silenceCeilingMs),
        )
      )
    })(),
  )
  // —— A13 落账入库维度(2026-11-05 立):"跑了十天、一枚没落"必须在账面可见 ——
  const S13 = ['session-ok', 'session-no-write']
  const a13Never = judgeArtifactLanding(
    [
      { action: 'session-ok', ticketKey: 'k1', ts: '2026-11-04T07:00:00.000Z' },
      { action: 'artifact-manifest-missing', ticketKey: 'k1', ts: '2026-11-04T07:00:05.000Z' },
      { action: 'session-ok', ticketKey: 'k2', ts: '2026-11-04T08:00:00.000Z' },
      { action: 'artifact-manifest-missing', ticketKey: 'k2', ts: '2026-11-04T08:00:05.000Z' },
    ],
    { sessionResultActions: S13 },
  )
  ok(
    'H62 真况回放:有会话结果档而落地档为 0 ⇒ drift,读数报出拒绝分布与"从未"',
    (() => {
      return (
        a13Never.dim === 'A13-artifact-landing' &&
        a13Never.state === 'drift' &&
        a13Never.readout.includes('从未把产物送进 HEAD') &&
        a13Never.readout.includes('artifact-manifest-missing×2') &&
        a13Never.next.includes('ticket-artifacts')
      )
    })(),
  )
  ok(
    'H63 变异:摘掉落地档词汇(把 artifact-committed 从表里当没看见)⇒ 同一份输入照旧 drift',
    (() => {
      const withLanded = judgeArtifactLanding(
        [
          { action: 'session-ok', ticketKey: 'k1', ts: '2026-11-04T07:00:00.000Z' },
          { action: 'artifact-committed', ticketKey: 'k1', ts: '2026-11-04T07:10:00.000Z' },
        ],
        { sessionResultActions: S13 },
      )
      const blind = judgeArtifactLanding(
        [
          { action: 'session-ok', ticketKey: 'k1', ts: '2026-11-04T07:00:00.000Z' },
          { action: 'artifact-committed', ticketKey: 'k1', ts: '2026-11-04T07:10:00.000Z' },
        ],
        { sessionResultActions: S13, landedActions: [] },
      )
      return withLanded.state === 'ok' && blind.state === 'unjudged'
    })(),
  )
  ok(
    'H64 会话结果档 0 枚 ⇒ ok 且读数照实报零(不许冒充"有产出",也不许冒充"坏了")',
    (() => {
      const r = judgeArtifactLanding([{ action: 'no-ticket', ts: '2026-11-04T07:00:00.000Z' }], {
        sessionResultActions: S13,
      })
      return (
        r.state === 'ok' &&
        r.readout.includes('会话结果档 0 枚') &&
        r.readout.includes('不冒充产出')
      )
    })(),
  )
  ok(
    'H65 射程解析不到 ⇒ unjudged(不回落"只认 session-ok")',
    judgeArtifactLanding([], { sessionResultActions: null }).state === 'unjudged',
  )
  ok(
    'H66 会话判成功而落账腿没答话 ⇒ drift(静默中断正是这条判据要抓的形态)',
    (() => {
      const r = judgeArtifactLanding(
        [
          { action: 'artifact-committed', ticketKey: 'k1', ts: '2026-11-04T07:00:00.000Z' },
          { action: 'session-ok', ticketKey: 'k2', ts: '2026-11-04T09:00:00.000Z' },
        ],
        { sessionResultActions: S13 },
      )
      return (
        r.state === 'drift' &&
        r.readout.includes('落账腿没答话') &&
        r.next.includes('landTicketArtifacts')
      )
    })(),
  )
  ok(
    'H67 A13 的 drift 必须顶起整尺',
    (() => {
      const g = JSON.stringify({
        sessionCommandTemplate: `node \${REPO_ROOT}/apps/cli/dist/index.js`,
        ticketWhitelist: ['a'],
      })
      const r = evaluateAll({
        repoRoot: root,
        gatesText: g,
        events: { ok: true, events: [] },
        ticketRows: [{ text: 'a', line: 1 }],
        landing: a13Never,
      })
      return r.state === 'drift' && r.dims.some((d) => d.dim === 'A13-artifact-landing')
    })(),
  )
  ok(
    'H68 A13 已装进 main 与 evaluateAll(有定义无接线 = 判据没装车,§0.9)',
    healthSrc.includes('const landing = judgeArtifactLanding(events.ok ? events.events : [], {') &&
      /if \(landing\) dims\.push\(landing\)/.test(healthSrc),
  )
  ok(
    'H69 词汇零复算:A13 的落地/拒绝档必须从阶梯那张表派生(不在本器里拼第二份名单)',
    (() => {
      // 断言按"语义形状"写而不是"某一行原文":格式化器会把长表达式折行,逐行字面锁只会把自己咬红
      // (本枚第一版正是这么红的)。这条锁要判的是"有没有第二份名单",不是"换行换在哪"。
      return (
        /ARTIFACT_LANDED_ACTIONS[\s\S]{0,200}PROGRESS_ACTIONS\.filter\([\s\S]{0,200}startsWith\('artifact-'\)/.test(
          healthSrc,
        ) &&
        /ARTIFACT_REJECT_ACTIONS[\s\S]{0,200}NON_PROGRESS_ACTIONS\.filter\([\s\S]{0,200}startsWith\('artifact-'\)/.test(
          healthSrc,
        ) &&
        !/ARTIFACT_LANDED_ACTIONS\s*=\s*\[/.test(healthSrc)
      )
    })(),
  )
  // —— A14 执行体面停放维度(2026-11-05 立):停派不等于停完 —— 一直停必须一直响 ——
  const L14 = JSON.stringify({
    entries: [
      {
        path: 'scripts/auto-evolve.mjs',
        anchors: ['锚A', '锚B', '锚C'],
        why: '调度器的判据锚点:这条不变量消失了就是有人从旧基线整片回写',
      },
      {
        path: 'scripts/lib/autonomy-nonprogress.mjs',
        anchors: ['锚D'],
        why: '阶梯分档表:新终态漏登记等于该档永远不计空转',
      },
    ],
  })
  ok(
    'H70 真况回放:盘上缺被审面已有锚点 ⇒ drift,读数点名缺几条与停放时长,出路点名归属席位',
    (() => {
      const r = judgeExecutorFaceStall({
        listText: L14,
        auditedText: '锚A 锚B 锚C',
        diskText: '锚A',
        mtimeMs: Date.parse('2026-11-04T10:00:00.000Z'),
        now: Date.parse('2026-11-04T19:00:00.000Z'),
      })
      return (
        r.dim === 'A14-executor-face-stall' &&
        r.state === 'drift' &&
        r.readout.includes('2/3 条判据锚点') &&
        r.readout.includes('9.00h') &&
        r.next.includes('归属席位')
      )
    })(),
  )
  ok(
    'H71 成对正向:盘上是超集(自己加了东西还没提交)⇒ ok —— 共树盘脏是常态,不许做成恒红门',
    (() => {
      const r = judgeExecutorFaceStall({
        listText: L14,
        auditedText: '锚A 锚B',
        diskText: '锚A 锚B 锚新',
      })
      return r.state === 'ok' && r.readout.includes('3 条锚点齐备')
    })(),
  )
  ok(
    'H72 三态不并桶:任一面取不到 ⇒ unjudged;清单里没有本器这一条 ⇒ unjudged(枚举到 0 判死不记绿)',
    (() => {
      const a = judgeExecutorFaceStall({ listText: L14, auditedText: null, diskText: 'x' })
      const b = judgeExecutorFaceStall({
        listText: JSON.stringify({
          entries: [
            { path: 'scripts/other.mjs', anchors: ['q'], why: '别的门的锚点,不是调度器的锚点' },
          ],
        }),
        auditedText: 'q',
        diskText: '',
      })
      return (
        a.state === 'unjudged' &&
        b.state === 'unjudged' &&
        b.readout.includes('scripts/auto-evolve.mjs')
      )
    })(),
  )
  ok(
    'H76 清单本身坏(缺 why)⇒ unjudged 并点名问题,不拿坏台账冒充"判过且没问题"',
    (() => {
      const r = judgeExecutorFaceStall({
        listText: JSON.stringify({
          entries: [{ path: 'scripts/auto-evolve.mjs', anchors: ['q'] }],
        }),
        auditedText: 'q',
        diskText: '',
      })
      return r.state === 'unjudged' && r.readout.includes('问题')
    })(),
  )
  ok(
    'H73 时长只作旁证:mtime 取不到时不编造小时数,判定仍只看缺几条锚点',
    (() => {
      const r = judgeExecutorFaceStall({
        listText: L14,
        auditedText: '锚A 锚B',
        diskText: '锚A',
        mtimeMs: null,
      })
      return (
        r.state === 'drift' && r.readout.includes('mtime 取不到') && !r.readout.includes('.00h')
      )
    })(),
  )
  ok(
    'H74 A14 已装进 main 与 evaluateAll(有定义无接线 = 判据没装车,§0.9)',
    (() => {
      return (
        healthSrc.includes(
          'const faceStall = judgeExecutorFaceStallFace({ face: FACE_SEL.face, root: repoRoot })',
        ) && /if \(faceStall\) dims\.push\(faceStall\)/.test(healthSrc)
      )
    })(),
  )
  ok(
    'H75 零复算:A14 的锚点命中必须走门 299 那一份 parseInvariants(不在本器拼第二份)',
    (() => {
      return (
        /INV_GATE\.parseInvariants/.test(healthSrc) &&
        /judgeExecutorFaceStallFace[\s\S]{0,600}readFaceText\(INV_GATE\.DATA_REL/.test(healthSrc)
      )
    })(),
  )
  console.log(
    fail === 0
      ? `autonomy-leg-health self-test: ${pass} 例全绿`
      : `autonomy-leg-health self-test: ${pass} 绿 / ${fail} 红`,
  )
  return fail === 0 ? 0 : 1
}

async function main() {
  if (FACE_SEL.error) {
    console.error(`❌ ${FACE_SEL.error}`)
    process.exitCode = 2
    return
  }
  if (ARGS.includes('--self-test')) {
    process.exitCode = await selfTest()
    return
  }
  const asJson = ARGS.includes('--json')
  const rootIdx = ARGS.indexOf('--repo-root')
  const repoRoot = rootIdx >= 0 ? ARGS[rootIdx + 1] : ROOT
  let gatesText = null
  try {
    gatesText = readGatesFace(FACE_SEL.face, repoRoot)
  } catch (e) {
    // 取不到就是未判定(§0.3),绝不回落到磁盘那一份 —— 回落就是把"没判"写成"判过了"。
    console.error(
      `❌ 未判定:${e instanceof Undetermined ? e.message : String(e?.message ?? e)}(判定面=${FACE_TXT[FACE_SEL.face] ?? FACE_SEL.face})`,
    )
    process.exitCode = 2
    return
  }
  const events = readLedgerEvents()
  let ticketRows = null
  try {
    const r = spawnSync(process.execPath, [PLAN_TASKS, ...DISPATCH_ARGS], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: repoRoot,
      windowsHide: true,
      timeout: 180_000,
      encoding: 'utf8',
    })
    ticketRows = r.status === 0 || r.stdout ? parseTicketRows(r.stdout) : null
  } catch {
    ticketRows = null
  }
  const bases = resolveTransitBases({
    apiBase: ARGS.includes('--api-base') ? ARGS[ARGS.indexOf('--api-base') + 1] : undefined,
    aiBase: ARGS.includes('--ai-base') ? ARGS[ARGS.indexOf('--ai-base') + 1] : undefined,
  })
  const transit = await judgeBackendTransit(bases)
  let gatesObj = null
  try {
    gatesObj = JSON.parse(gatesText)
  } catch {
    gatesObj = null
  }
  let valveSource = null
  try {
    valveSource = readFaceText('scripts/auto-evolve.mjs', FACE_SEL.face, repoRoot)
  } catch {
    valveSource = null
  }
  let valveListText
  try {
    valveListText = readFaceText('scripts/data/human-valve-list.json', FACE_SEL.face, repoRoot)
  } catch {
    valveListText = null
  }
  const valve = gatesObj
    ? judgeValveGate(events.ok ? events.events : [], {
        mode: gatesObj.humanValveMode,
        headSource: valveSource,
        valveListText,
      })
    : null
  const closure = judgeDispatchClosure(events.ok ? events.events : [], {
    schedulerSource: valveSource,
    // 在册面 = 本次派单面(与 A3 同一份 parseTicketRows 取票口径);取不到(空)⇒ null 保持旧行为
    activeTicketKeys:
      ticketRows && ticketRows.length ? new Set(ticketRows.map((r) => ticketKeyOf(r.text))) : null,
  })
  const liveness = judgeLivenessFace({ face: FACE_SEL.face, repoRoot, root: repoRoot })
  const parity = judgeCarrierParityFace({ face: FACE_SEL.face, root: repoRoot })
  const claims = judgeRoadmapClaimsFace({ face: FACE_SEL.face, root: repoRoot })
  const output = judgeClosureOutputFace({ root: repoRoot })
  const outputAll = judgeLegOutputsFace({ face: FACE_SEL.face, root: repoRoot })
  // A13 与 A7 同源取材:会话结果档的射程同样只认被审面上那一份 SESSION_RESULT_ACTIONS 解析。
  const landing = judgeArtifactLanding(events.ok ? events.events : [], {
    sessionResultActions: sessionResultActionsOf(valveSource),
  })
  const faceStall = judgeExecutorFaceStallFace({ face: FACE_SEL.face, root: repoRoot })
  // output 必须留在末位:A11 的镜像接线锁是字面串锁(/claims, output })/),插队会把它判成"判据没装车"。
  const result = evaluateAll({
    repoRoot,
    gatesText,
    events,
    ticketRows: ticketRows ?? [],
    transit,
    valve,
    closure,
    landing,
    faceStall,
    liveness,
    parity,
    outputAll,
    claims,
    output,
  })
  if (asJson) {
    console.log(
      JSON.stringify(
        { verdict: result.state, face: FACE_SEL.face, ...result, identity: alertIdentity(result) },
        null,
        1,
      ),
    )
  } else {
    console.log(`判定面=${FACE_TXT[FACE_SEL.face] ?? FACE_SEL.face}`)
    for (const d of result.dims)
      console.log(
        `  [${d.state.toUpperCase()}] ${d.dim} :: ${d.readout}${d.next ? `\n      ↳ ${d.next}` : ''}`,
      )
    console.log(
      `AUTONOMY-LEG state=${result.state} ${result.summary} identity=${alertIdentity(result)}`,
    )
  }
  process.exitCode = result.state === 'ok' ? 0 : result.state === 'drift' ? 1 : 2
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

export const __test__ = {
  judgePreflight,
  judgeMisattribution,
  judgeRange,
  judgeWhitelist,
  judgeBackendTransit,
  judgeValveGate,
  judgeDispatchClosure,
  sessionResultActionsOf,
  judgeArtifactLanding,
  ARTIFACT_LANDED_ACTIONS,
  ARTIFACT_REJECT_ACTIONS,
  judgeExecutorFaceStall,
  judgeExecutorFaceStallFace,
  EXECUTOR_SCHED_REL,
  resolveTransitBases,
  readGatesFace,
  readFaceText,
  evaluateAll,
  alertIdentity,
  readLedgerEvents,
  judgeClosureOutput,
  judgeClosureOutputFace,
  CLOSURE_SIGNALS_REL,
  CLOSURE_STAMP_REL,
  judgeLegOutputs,
  judgeLegOutputsFace,
  selfReportsFromLog,
  readGuardianLogTail,
  GUARDIAN_LOG_REL,
  LOG_TAIL_BYTES,
  classifyLegOutputs,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
