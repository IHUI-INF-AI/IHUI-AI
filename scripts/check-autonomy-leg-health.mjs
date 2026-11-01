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
 * 用法:node scripts/check-autonomy-leg-health.mjs [--json] [--self-test] [--repo-root <path>]
 *      [--api-base <url>] [--ai-base <url>] [--staged|--worktree]
 * 判定面纪律(§0.4):闸门配置按被审面取 —— 默认 HEAD blob,`--staged` 判索引,
 *   `--worktree` 只给人工现场诊断;取不到 ⇒ exit 2 未判定,**不回落另一个面**。
 * 退出码:0=ok / 1=drift(点名可整改项)/ 2=unjudged(取不到输入,不记绿也不冒红)
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { preflightSessionRunner, classifySessionFailure, resolveSessionCommand } from './lib/autonomy-runner.mjs'
import { quarantinedUntilOf, LEDGER, DISPATCH_ARGS, parseTicketRows, PLAN_TASKS } from './auto-evolve.mjs'
import { ticketKeyOf } from './lib/ticket-key.mjs'
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
  if (t === null || t === undefined) throw new Undetermined(`${face === 'staged' ? '索引' : 'HEAD'} 取不到 ${rel}`)
  return t
}

/** 闸门配置(仓库内容,按被审面取)。 */
export function readGatesFace(face = FACE_SEL.face, root = ROOT) {
  return readFaceText(GATES_REL, face, root)
}

/** 读台账(缺文件 ⇒ 空集,但由调用方如实标 unjudged,不用 0 冒充"没失败过")。 */
export function readLedgerEvents(limit = 400) {
  if (!existsSync(LEDGER)) return { ok: false, events: [], why: `台账不在位:${LEDGER}` }
  const raw = readFileSync(LEDGER, 'utf8').trim()
  if (!raw) return { ok: true, events: [], why: '台账空' }
  const events = raw
    .split('\n')
    .slice(-limit)
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
  if (pf.state === 'ready') return { dim: 'A1-preflight', state: 'ok', readout: `在位核验 ${pf.checked.length} 枚全通过`, next: '' }
  if (pf.state === 'template-empty') return { dim: 'A1-preflight', state: 'unjudged', readout: '模板空 = dry-run 档', next: '要真派就得配 sessionCommandTemplate(仓根写 ${REPO_ROOT})' }
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
  const envFailed = events.filter((e) => e.action === 'session-failed' && classifySessionFailure({ status: e.exitCode, stderr: e.why, error: '' }).kind === 'environment')
  const envKeys = new Set(envFailed.map((e) => e.ticketKey).filter(Boolean))
  const live = Date.now()
  const wronglyQuarantined = events.filter((e) => e.action === 'quarantined' && envKeys.has(e.ticketKey) && new Date(e.until ?? 0).getTime() > live)
  if (wronglyQuarantined.length > 0) {
    return {
      dim: 'A2-attribution',
      state: 'drift',
      readout: `此刻仍被冤封的票 ${wronglyQuarantined.length} 枚(历史执行体级失败 ${envFailed.length} 轮仅作报数)`,
      next: wronglyQuarantined.map((q) => `冤封:${q.ticketKey} :: ${String(q.ticketLine).slice(0, 80)}(至 ${q.until})⇒ 摘对应 quarantined 行,该票即可重派`).join('\n'),
    }
  }
  // 历史失败行不永久顶红(§12e:与"当下能否整改"无关的判据 = 恒红门);只在"新式分型根本没接住"时报数。
  return { dim: 'A2-attribution', state: 'ok', readout: `无冤封在册;近 ${events.length} 轮执行体级失败 ${envFailed.length} 轮${envFailed.length ? '(已由 runner-unavailable 分型接住)' : ''}`, next: '' }
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
  if (!ticketRows || ticketRows.length === 0) return { dim: 'A3-range', state: 'unjudged', readout: '派单面取不到 ⇒ 射程判不出', next: '先修 plan-tasks 取票口' }
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
      ? `出路:封禁已吃掉过半射程 —— 逐行确认封禁是否源自调度器自身故障(A2 已点名 ${blockedRows.slice(0, 3).map((r) => String(r.text).slice(0, 40)).join(' / ')});是则摘 quarantined 行,不得靠延长 quarantine 兜`
      : '',
  }
}

/** A4 白名单命中率:自开发射程有多宽(实测 25 轮 no-whitelist-hit 的对应维)。 */
export function judgeWhitelist(events, whitelist) {
  const hits = events.filter((e) => e.action === 'no-whitelist-hit').length
  const dispatched = events.filter((e) => e.action === 'session-ok' || e.action === 'session-failed').length
  if (whitelist.length === 0) return { dim: 'A4-whitelist', state: 'drift', readout: '白名单空 ⇒ 结构上无票可派', next: '登记票类或显式置 dry-run' }
  return {
    dim: 'A4-whitelist',
    state: hits > 0 && dispatched === 0 ? 'drift' : 'ok',
    readout: `近 ${events.length} 轮:未命中白名单 ${hits} 轮 / 真派发 ${dispatched} 轮 / 白名单 ${whitelist.length} 档`,
    next: hits > 0 && dispatched === 0 ? '出路:白名单与派单面题型不匹配 ⇒ 按证据扩档(每扩一档都得有对应的失败分型/预算闸兜着),不得借道 --no-verify 式绕行' : '',
  }
}

export function evaluateAll({ repoRoot = ROOT, gatesText, events, ticketRows, transit, valve, closure } = {}) {
  const dims = []
  let gates
  try {
    gates = JSON.parse(gatesText)
  } catch (e) {
    return { state: 'unjudged', dims: [{ dim: 'A0-gates', state: 'unjudged', readout: `配置读不到/形状坏:${e.message}`, next: '先修 JSON' }], summary: 'UNJUDGED A0-gates' }
  }
  dims.push(judgePreflight(gates.sessionCommandTemplate, repoRoot))
  if (transit) dims.push(transit)
  if (valve) dims.push(valve)
  if (closure) dims.push(closure)
  if (!events.ok) { /* 台账缺失只影响 A2/A3/A4 */
    dims.push({ dim: 'A2-attribution', state: 'unjudged', readout: events.why, next: '台账取不到 ⇒ 不冒充"没失败过"' })
    dims.push({ dim: 'A3-range', state: 'unjudged', readout: '无台账输入 ⇒ 封票数判不出', next: '' })
  } else {
    dims.push(judgeMisattribution(events.events))
    dims.push(judgeRange(events.events, ticketRows))
    dims.push(judgeWhitelist(events.events, gates.ticketWhitelist ?? []))
  }
  const drift = dims.filter((d) => d.state === 'drift')
  const unjudged = dims.filter((d) => d.state === 'unjudged')
  const state = drift.length ? 'drift' : unjudged.length ? 'unjudged' : 'ok'
  return { state, dims, summary: `OK=${dims.length - drift.length - unjudged.length} DRIFT=${drift.length} UNJUDGED=${unjudged.length}` }
}

/** 稳定语义身份(§5e-1/5e-3:类别+计数,不掺时刻/sha/异常原文)。 */
export function alertIdentity(result) {
  const driftKeys = result.dims.filter((d) => d.state === 'drift').map((d) => d.dim).sort()
  return `autonomy-leg:${result.state}:${driftKeys.join('+') || 'none'}:${result.dims.filter((d) => d.state === 'drift').length}`
}

/**
 * A5 后端通路(2026-11-01 实测补):发起腿是四层链 —— 配置 → 执行体 → 本地服务 → 上游模型。
 * probe 把前三层穿通后卡在第三层(api 侧 "AI service unreachable: fetch failed"),
 * 而调度器对服务面一维**从来没有判据** —— 腿断在第三层时,账面读起来仍像"票不行"。
 * 双臂各自量 /health,绝不并桶;凭据一律不进这一维(只问存续,不发真请求)。
 */
export function judgeBackendTransit({ apiBase, aiBase, probeMs = 6000, fetchImpl = globalThis.fetch } = {}) {
  if (!apiBase || !aiBase) {
    return { dim: 'A5-backend-transit', state: 'unjudged', readout: `服务面地址取不到(api=${apiBase ?? '∅'} ai=${aiBase ?? '∅'})⇒ 不冒充通路健康`, next: '核 apps/api/.env 的 AI_SERVICE_URL 与 api 端口' }
  }
  const one = async (base) => {
    try {
      const r = await fetchImpl(`${base.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(probeMs) })
      return { base, code: r.status, ok: r.status >= 200 && r.status < 300 }
    } catch (e) {
      return { base, code: null, ok: false, err: e.cause?.code || e.name }
    }
  }
  return (async () => {
    const [a, b] = [await one(apiBase), await one(aiBase)]
    const down = [a, b].filter((x) => !x.ok)
    if (down.length === 0) return { dim: 'A5-backend-transit', state: 'ok', readout: `api=${a.code} ai-service=${b.code} 双臂应答`, next: '' }
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
 * A6 人工阀闸是否真在派发路径上被问(2026-11-01 立)。
 * 立因(回源实测):`human-gates.mjs` 的 classify 与 `lib/human-valve.mjs` 的 classifyAction
 * 在派发路径上原本**零调用** —— 调度层只打印"自决 4 / 停机等人 7"这句计数,
 * 7 条停机条款既没进票 prompt 也没在任何动作前被问。闸住在被约束者手里 = 没有闸。
 * 所以这一维量的不是"配置对不对",而是"有没有人真去问过它":
 *  - 有派发尝试而零 valve-* 留痕 ⇒ 哑闸 ⇒ drift;
 *  - observe 档 ⇒ 报命中分布,并给"切 enforce 的前置条件"(未判定必须为 0、命中族必须见过);
 *  - 档位取值非法 ⇒ drift(不猜档)。
 */
export function judgeValveGate(events, { mode, headSource } = {}) {
  if (headSource === null || headSource === undefined) {
    return { dim: 'A6-human-valve-gate', state: 'unjudged', readout: '派发器源码在被审面取不到 ⇒ 接线与否判不出(不用"取不到"冒充"没接线")', next: '核 scripts/auto-evolve.mjs 是否在被审面上' }
  }
  const attempted = events.filter((e) => ['session-ok', 'session-failed', 'runner-unavailable', 'session-timeout'].includes(e.action)).length
  const valveRows = events.filter((e) => String(e.action ?? '').startsWith('valve-'))
  const stopRows = valveRows.filter((e) => e.action === 'valve-observe-stop' || e.action === 'valve-block')
  const unjudged = valveRows.filter((e) => e.action === 'valve-unjudged' || e.action === 'valve-unjudged-block')
  const wired = typeof headSource === 'string' && headSource.includes('gateTicketByHumanValve({')
  if (!wired) {
    return { dim: 'A6-human-valve-gate', state: 'drift', readout: '派发路径上没有闸的调用点(classifyAction 从未被问)⇒ 停机条款只是打印出来的装饰', next: '在真派之前对票面调 gateTicketByHumanValve,并把结论记进台账' }
  }
  if (mode !== 'observe' && mode !== 'enforce') {
    return { dim: 'A6-human-valve-gate', state: 'drift', readout: `humanValveMode 取值非法(${JSON.stringify(mode)})⇒ 不猜档`, next: '改成 observe 或 enforce 之一' }
  }
  if (attempted > 0 && valveRows.length === 0) {
    return { dim: 'A6-human-valve-gate', state: 'drift', readout: `有 ${attempted} 轮真派发尝试却零 valve-* 留痕 ⇒ 闸是哑的(代码在而没被走到)`, next: '核派发循环里闸的调用点是否在白名单判定之后、真派之前' }
  }
  const byRule = {}
  for (const r of stopRows) byRule[r.ruleId ?? '(无 id)'] = (byRule[r.ruleId ?? '(无 id)'] ?? 0) + 1
  const dist = Object.entries(byRule).map(([k, v]) => `${k}×${v}`).join(' ') || '(尚无命中)'
  if (mode === 'observe') {
    return {
      dim: 'A6-human-valve-gate',
      state: unjudged.length > 0 ? 'drift' : 'ok',
      readout: `observe 档:派发尝试 ${attempted} 轮 / 闸留痕 ${valveRows.length} 条 / 记为"会拦" ${stopRows.length} 条(${dist})/ 未判定 ${unjudged.length} 条`,
      next: unjudged.length > 0 ? `未判定 ${unjudged.length} 条必须先归零(清单坏/取不到),否则切 enforce 就是把票无限期停派;切 enforce 的前置:observe 覆盖完整流量周期 ∧ 未判定=0` : '放量到 enforce 前,先确认 observe 覆盖了一个完整流量周期',
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
 * A7 派发闭环:session-ok 到底等不等于"票推进了"(2026-11-01 立)。
 * 立因:台账里唯一一枚 session-ok 对一张大工程票只跑 45.5s 就 exit 0 —— 调度器原先把
 * "会话结束了"当成"这轮干成了"。AGENTS §10 要的是交付与产出一致,所以必须有第二问:
 * 票行到底动了没有。四档不并桶,且"没结算的成功"要单独点名(结算腿漏覆盖 = 尺子盲区)。
 */
export function judgeDispatchClosure(events, { schedulerSource, windowHours = 48, now = Date.now() } = {}) {
  if (schedulerSource === null || schedulerSource === undefined) {
    return { dim: 'A7-dispatch-closure', state: 'unjudged', readout: '派发器源码在被审面取不到 ⇒ 闭环与否判不出', next: '核 scripts/auto-evolve.mjs 是否在被审面上' }
  }
  if (!schedulerSource.includes('settlePriorDispatches({')) {
    return { dim: 'A7-dispatch-closure', state: 'drift', readout: '派发器里没有结算调用 ⇒ 成功判定仍等于 CLI 退出码', next: '取票后先结算上一轮的 session-ok,把 settled 记进台账' }
  }
  const okRows = events.filter((e) => e.action === 'session-ok' && e.ticketKey)
  const settledRows = events.filter((e) => e.action === 'dispatch-settled')
  const noProgress = settledRows.filter((e) => e.settled === 'no-progress')
  const unjudgedS = settledRows.filter((e) => e.settled === 'unjudged')
  const advanced = settledRows.filter((e) => e.settled === 'line-gone' || e.settled === 'line-changed')
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
  const dangling = legInstalledAfterWindow ? unsettled.filter((e) => Date.parse(String(e.ts ?? '')) >= firstSettledAt) : unsettled
  const legacy = unsettled.length - dangling.length
  if (noProgress.length > 0) {
    return {
      dim: 'A7-dispatch-closure',
      state: 'drift',
      readout: `结算已跑,但 ${noProgress.length} 枚"会话报成功而票行零推进"(已推进 ${advanced.length} 枚)`,
      next: noProgress.map((s) => `${s.ticketKey} :: ${String(s.ticketLine).slice(0, 60)}`).join('\n') + '\n出路:核该会话末轮实际动作;若结构上交付不了(自动会话无提交权),合格线就得改绑"票行推进 + 绑票键的提交",不得只改判据措辞',
    }
  }
  if (dangling.length > 0) {
    return { dim: 'A7-dispatch-closure', state: 'drift', readout: `${dangling.length} 枚超 ${windowHours}h 的 session-ok 在结算腿生效后仍无结算行 ⇒ 结算腿覆盖不全(尺子盲区)${legacy ? `;另有 ${legacy} 枚结算腿生效前的历史成功,只报数` : ''}`, next: '核结算循环是否每轮都跑、窗口取值是否小于调度存活期' }
  }
  if (unjudgedS.length > 0) {
    return { dim: 'A7-dispatch-closure', state: 'unjudged', readout: `结算跑了但 ${unjudgedS.length} 枚落未判定(派单面当时取不到)⇒ 不冒充"推进了"`, next: '先修取票口(见 A3)' }
  }
  return { dim: 'A7-dispatch-closure', state: 'ok', readout: `session-ok ${okRows.length} 枚 / 已结算 ${settledRows.length} 条,零"报成功而零推进"${legacy ? `;历史未结算存量 ${legacy} 枚(结算腿生效前的成功,只报数不顶红)` : ''}`, next: '' }
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
  ok('H1 现读活配置给三态之一(不猜)', (() => {
    const r = judgePreflight(`node \${REPO_ROOT}/apps/cli/dist/index.js`, root)
    return ['ok', 'drift', 'unjudged'].includes(r.state)
  })())
  ok('H2 执行体不在位 ⇒ drift 且点名缺哪枚', (() => {
    const r = judgePreflight('node D:/Nope-Repo-ZZZ/apps/cli/dist/index.js', root)
    return r.state === 'drift' && r.next.includes('Nope-Repo-ZZZ')
  })())
  ok('H3 空模板 ⇒ unjudged(不冒充"健康")', judgePreflight('  ', root).state === 'unjudged')
  ok('H4 冤封识别:ERR_MODULE_NOT_FOUND 的失败 + 同键 quarantined ⇒ drift', (() => {
    const ev = [
      { action: 'session-failed', ticketKey: 'k1', exitCode: 1, why: "Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'G:/x'" },
      { action: 'quarantined', ticketKey: 'k1', until: '2026-11-03T00:00:00.000Z', ticketLine: 'X-1 某票' },
    ]
    const r = judgeMisattribution(ev)
    return r.state === 'drift' && r.readout.includes('1')
  })())
  ok('H5 变异:真·会话失败的封票不算冤(分型不得把票的失败也免掉)', (() => {
    const ev = [
      { action: 'session-failed', ticketKey: 'k2', exitCode: 1, why: 'typecheck failed' },
      { action: 'quarantined', ticketKey: 'k2', until: '2026-11-03T00:00:00.000Z', ticketLine: 'X-2' },
    ]
    return judgeMisattribution(ev).state === 'ok'
  })())
  ok('H6 台账取不到 ⇒ unjudged,不用 0 冒充"没失败过"', (() => {
    const r = evaluateAll({ repoRoot: root, gatesText: JSON.stringify({ sessionCommandTemplate: 'x', ticketWhitelist: ['a'] }), events: { ok: false, events: [], why: 'no file' }, ticketRows: [] })
    return r.dims.some((d) => d.state === 'unjudged')
  })())
  ok('H7 白名单空 ⇒ drift(结构上无票可派必须喊)', judgeWhitelist([], []).state === 'drift')
  ok('H8 只未命中零派发 ⇒ drift;有派发 ⇒ 不喊', judgeWhitelist([{ action: 'no-whitelist-hit' }], ['a']).state === 'drift' && judgeWhitelist([{ action: 'session-ok' }], ['a']).state === 'ok')
  ok('H9 身份稳定:同型不同明细同键(§5e-3 不掺时刻/sha)', (() => {
    const mk = (until) => ({ state: 'drift', dims: [{ dim: 'A2-attribution', state: 'drift', until }] })
    return alertIdentity(mk('x')) === alertIdentity(mk('y'))
  })())
  ok('H10 变异:三态不得并桶 —— 全 ok 与有 unjudged 的 state 不同', (() => {
    const g = JSON.stringify({ sessionCommandTemplate: `node \${REPO_ROOT}/apps/cli/dist/index.js`, ticketWhitelist: ['a'] })
    const allOk = evaluateAll({ repoRoot: root, gatesText: g, events: { ok: true, events: [{ action: 'session-ok', ticketKey: 'k' }] }, ticketRows: [{ key: 'k', text: 'a' }] })
    const withUnjudged = evaluateAll({ repoRoot: root, gatesText: g, events: { ok: true, events: [{ action: 'session-ok', ticketKey: 'k' }] }, ticketRows: [] })
    return allOk.state === 'ok' && withUnjudged.state === 'unjudged' && allOk.summary !== withUnjudged.summary
  })())
  ok('H11 封票射程:封禁中的票真被计入 blocked(键按行文本现算)', (() => {
    const future = new Date(Date.now() + 3600_000).toISOString()
    const row = { text: 'X-9 **某张被冤封的票**', line: 7 }
    const ev = [{ action: 'quarantined', ticketKey: ticketKeyOf(row.text), until: future }]
    const r = judgeRange(ev, [row])
    return r.state === 'drift' && r.readout.includes('封禁中 1 行')
  })())
  ok('H11b 变异:若按不存在的 t.key 比集合就会读成 0(本尺的假绿形态必须被钉住)', (() => {
    const row = { text: 'X-10 另一张票', line: 8 }
    const ev = [{ action: 'quarantined', ticketKey: ticketKeyOf(row.text), until: new Date(Date.now() + 3600_000).toISOString() }]
    const naiveBlocked = [{ action: 'quarantined', ticketKey: ticketKeyOf(row.text) }].filter((e) => e.ticketKey === row.key).length
    return naiveBlocked === 0 && judgeRange(ev, [row]).readout.includes('封禁中 1 行')
  })())
  ok('H12 取票口径不自行拼装(§0.6 单源):DISPATCH_ARGS 三旗齐', DISPATCH_ARGS.join(' ') === '--open --dispatchable --exclude-inflight')
  ok('H13 resolveSessionCommand 与 preflight 用的是同一仓根口径', (() => {
    const cmd = resolveSessionCommand(`node \${REPO_ROOT}/a.js -w D:/Nope-Repo`, root)
    return cmd.includes(`${root}\\a.js`) || cmd.includes('D:/Nope-Repo')
  })())
  // A5 的夹具走注入档(验证器不复用被测的那条真 fetch,否则量的是网络不是判据)
  const fakeFetch = (statuses, errors = {}) => async (url) => {
    if (errors[url]) throw Object.assign(new Error(errors[url]), { cause: { code: errors[url] } })
    return { status: statuses[url] ?? 500 }
  }
  const h15 = await judgeBackendTransit({ apiBase: 'http://api.test', aiBase: 'http://ai.test', fetchImpl: fakeFetch({ 'http://api.test/health': 200, 'http://ai.test/health': 200 }) })
  ok('H15 A5 双臂都应答 ⇒ ok', h15.state === 'ok' && h15.readout.includes('200'))
  const h16 = await judgeBackendTransit({ apiBase: 'http://api.test', aiBase: 'http://ai.test', fetchImpl: fakeFetch({ 'http://api.test/health': 200 }, { 'http://ai.test/health': 'ECONNREFUSED' }) })
  ok('H16 变异:一臂拒连 ⇒ drift 且点名是哪条臂(两臂不并桶)', h16.state === 'drift' && h16.readout.includes('ai.test') && !h16.readout.includes('api.test'))
  const h17 = await judgeBackendTransit({ apiBase: 'http://api.test', aiBase: null })
  ok('H17 aiBase 取不到 ⇒ unjudged,不用"api 通"冒充整链通', h17.state === 'unjudged')
  const h18 = evaluateAll({ repoRoot: root, gatesText: JSON.stringify({ sessionCommandTemplate: `node \${REPO_ROOT}/apps/cli/dist/index.js`, ticketWhitelist: ['a'] }), events: { ok: true, events: [{ action: 'session-ok', ticketKey: 'k' }] }, ticketRows: [{ key: 'k', text: 'a' }], transit: h16 })
  ok('H18 A5 的 drift 必须顶起整尺 drift(否则服务断了尺子还报绿)', h18.state === 'drift' && h18.dims.some((d) => d.dim === 'A5-backend-transit'))
  ok('H19 取材面纪律:被审面取不到 ⇒ 抛 Undetermined,绝不回落磁盘那一份(§0.3/守门 118)', (() => {
    try {
      readGatesFace('head', join(ROOT, '..'))
      return false
    } catch (e) {
      return e instanceof Undetermined
    }
  })())
  ok('H20 同一份配置在 HEAD 与索引可各自取到(清单与内容同面同轮)', (() => {
    try {
      return String(readGatesFace('head', ROOT)).includes('sessionCommandTemplate')
    } catch {
      return false
    }
  })())
  const wiredSrc = 'function runOnce(){ const valve = gateTicketByHumanValve({ ticketText, mode, valveListText }) }'
  ok('H21 派发路径没有调用点 ⇒ drift(闸只是装饰,这正是 2026-11-01 之前的实测形态)', judgeValveGate([], { mode: 'observe', headSource: 'function runOnce(){ dispatchSession(gates, ticket) }' }).state === 'drift')
  ok('H22 被审面取不到 ⇒ unjudged,不用"取不到"冒充"没接线"', judgeValveGate([], { mode: 'observe', headSource: null }).state === 'unjudged')
  ok('H23 有真派发尝试而零 valve 留痕 ⇒ drift(代码在却没被走到)', judgeValveGate([{ action: 'session-ok', ticketKey: 'k' }], { mode: 'observe', headSource: wiredSrc }).state === 'drift')
  ok('H24 observe 档有留痕 ⇒ ok 且报命中分布与切 enforce 的前置', (() => {
    const ev = [
      { action: 'session-ok', ticketKey: 'k' },
      { action: 'valve-observe-stop', ticketKey: 'k', ruleId: 'production-deploy' },
      { action: 'valve-allow', ticketKey: 'k2', ruleId: 'code-and-docs' },
    ]
    const r = judgeValveGate(ev, { mode: 'observe', headSource: wiredSrc })
    return r.state === 'ok' && r.readout.includes('production-deploy×1') && r.next.includes('完整流量周期')
  })())
  ok('H25 变异:observe 期出现未判定 ⇒ drift(enforce 前置未满足,不能放量)', judgeValveGate([{ action: 'session-failed', ticketKey: 'k' }, { action: 'valve-unjudged', ticketKey: 'k' }], { mode: 'observe', headSource: wiredSrc }).state === 'drift')
  ok('H26 档位取值非法 ⇒ drift(不猜档)', judgeValveGate([], { mode: 'yolo', headSource: wiredSrc }).state === 'drift')
  ok('H27 A6 的 drift 必须顶起整尺(闸哑了尺子不能报绿)', (() => {
    const g = JSON.stringify({ sessionCommandTemplate: `node \${REPO_ROOT}/apps/cli/dist/index.js`, ticketWhitelist: ['a'], humanValveMode: 'observe' })
    const r = evaluateAll({ repoRoot: root, gatesText: g, events: { ok: true, events: [{ action: 'session-ok', ticketKey: 'k' }] }, ticketRows: [{ text: 'a', line: 1 }], valve: judgeValveGate([{ action: 'session-ok', ticketKey: 'k' }], { mode: 'observe', headSource: wiredSrc }) })
    return r.state === 'drift' && r.dims.some((d) => d.dim === 'A6-human-valve-gate')
  })())
  const closureSrc = 'function runOnce(){ const settled = settlePriorDispatches({ ledger, currentRows: allRows }) }'
  ok('H28 派发器里没有结算调用 ⇒ drift(成功判定仍等于退出码)', judgeDispatchClosure([], { schedulerSource: 'function runOnce(){ dispatchSession(gates, ticket) }' }).state === 'drift')
  ok('H29 被审面取不到 ⇒ unjudged,不冒充"闭环健康"', judgeDispatchClosure([], { schedulerSource: null }).state === 'unjudged')
  ok('H30 结算判出"报成功而票行零推进" ⇒ drift 并点名票面', (() => {
    const ev = [
      { action: 'session-ok', ticketKey: 'k1', ts: '2026-10-31T05:00:00.000Z', ticketLine: 'B9 **某票** 原文' },
      { action: 'dispatch-settled', ticketKey: 'k1', sourceTs: '2026-10-31T05:00:00.000Z', settled: 'no-progress', ticketLine: 'B9 **某票** 原文' },
    ]
    const r = judgeDispatchClosure(ev, { schedulerSource: closureSrc, now: Date.parse('2026-11-01T05:00:00.000Z') })
    return r.state === 'drift' && r.readout.includes('1 枚') && r.next.includes('B9')
  })())
  ok('H31 有推进(line-changed)⇒ ok,不得把动过的票也算成零推进', (() => {
    const ev = [
      { action: 'session-ok', ticketKey: 'k2', ts: '2026-10-31T05:00:00.000Z', ticketLine: 'B10 旧文本' },
      { action: 'dispatch-settled', ticketKey: 'k2', sourceTs: '2026-10-31T05:00:00.000Z', settled: 'line-changed' },
    ]
    return judgeDispatchClosure(ev, { schedulerSource: closureSrc, now: Date.parse('2026-11-01T05:00:00.000Z') }).state === 'ok'
  })())
  ok('H32 变异:超窗却没结算行 ⇒ drift(结算腿覆盖不全=尺子盲区)', (() => {
    const ev = [{ action: 'session-ok', ticketKey: 'k3', ts: '2026-10-20T05:00:00.000Z', ticketLine: 'B11 陈旧的成功' }]
    return judgeDispatchClosure(ev, { schedulerSource: closureSrc, now: Date.parse('2026-11-01T05:00:00.000Z') }).state === 'drift'
  })())
  ok('H33 A7 的 drift 必须顶起整尺', (() => {
    const g = JSON.stringify({ sessionCommandTemplate: `node \${REPO_ROOT}/apps/cli/dist/index.js`, ticketWhitelist: ['a'], humanValveMode: 'observe' })
    const r = evaluateAll({ repoRoot: root, gatesText: g, events: { ok: true, events: [] }, ticketRows: [{ text: 'a', line: 1 }], closure: judgeDispatchClosure([], { schedulerSource: 'no settle here' }) })
    return r.state === 'drift' && r.dims.some((d) => d.dim === 'A7-dispatch-closure')
  })())
  ok('H34 A3 少量封禁(未过半)⇒ ok 且报数,不顶红(§12e:封禁是机器状态,不是本次改动带进来的)', (() => {
    const future = new Date(Date.now() + 3600_000).toISOString()
    const rows = Array.from({ length: 20 }, (_, i) => ({ text: `X-${i} 票${i}`, line: i + 1 }))
    const ev = [{ action: 'quarantined', ticketKey: ticketKeyOf(rows[0].text), until: future }]
    const r = judgeRange(ev, rows)
    return r.state === 'ok' && r.readout.includes('封禁中 1 行') && r.readout.includes('只报数')
  })())
  ok('H35 A3 变异:封禁过半 ⇒ drift(结构性锁死才配叫人,不得靠调阈值把整面被封也放过)', (() => {
    const future = new Date(Date.now() + 3600_000).toISOString()
    const rows = Array.from({ length: 10 }, (_, i) => ({ text: `Y-${i} 票${i}`, line: i + 1 }))
    const ev = rows.slice(0, 6).map((r) => ({ action: 'quarantined', ticketKey: ticketKeyOf(r.text), until: future }))
    const r = judgeRange(ev, rows)
    return r.state === 'drift' && r.readout.includes('封禁中 6 行')
  })())
  ok('H36 结算腿生效前的历史成功 ⇒ ok 只报数(不要求一门今天装的车去结算它出生前的账)', (() => {
    const ev = [
      { action: 'session-ok', ticketKey: 'k7', ts: '2026-10-20T05:00:00.000Z', ticketLine: 'B13 陈旧的成功' },
      { action: 'dispatch-settled', ticketKey: 'k8', sourceTs: '2026-11-01T00:00:00.000Z', settled: 'line-gone', ts: '2026-11-01T00:00:05.000Z' },
    ]
    const r = judgeDispatchClosure(ev, { schedulerSource: closureSrc, now: Date.parse('2026-11-01T05:00:00.000Z') })
    return r.state === 'ok' && r.readout.includes('历史未结算存量 1 枚')
  })())
  ok('H37 变异:结算腿生效后仍超窗未结算 ⇒ 照样 drift(修正不得顺手放过真缺口)', (() => {
    const ev = [
      { action: 'session-ok', ticketKey: 'k9', ts: '2026-10-30T04:00:00.000Z', ticketLine: 'B14 生效后的成功' },
      { action: 'dispatch-settled', ticketKey: 'k10', sourceTs: '2026-10-25T00:00:00.000Z', settled: 'line-gone', ts: '2026-10-25T00:00:05.000Z' },
    ]
    const r = judgeDispatchClosure(ev, { schedulerSource: closureSrc, now: Date.parse('2026-11-01T05:00:00.000Z') })
    return r.state === 'drift' && r.readout.includes('结算腿生效后仍无结算行')
  })())
  console.log(fail === 0 ? `autonomy-leg-health self-test: ${pass} 例全绿` : `autonomy-leg-health self-test: ${pass} 绿 / ${fail} 红`)
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
    console.error(`❌ 未判定:${e instanceof Undetermined ? e.message : String(e?.message ?? e)}(判定面=${FACE_TXT[FACE_SEL.face] ?? FACE_SEL.face})`)
    process.exitCode = 2
    return
  }
  const events = readLedgerEvents()
  let ticketRows = null
  try {
    const r = spawnSync(process.execPath, [PLAN_TASKS, ...DISPATCH_ARGS], { stdio: ['ignore', 'pipe', 'pipe'], cwd: repoRoot, windowsHide: true, timeout: 180_000, encoding: 'utf8' })
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
  const valve = gatesObj ? judgeValveGate(events.ok ? events.events : [], { mode: gatesObj.humanValveMode, headSource: valveSource }) : null
  const closure = judgeDispatchClosure(events.ok ? events.events : [], { schedulerSource: valveSource })
  const result = evaluateAll({ repoRoot, gatesText, events, ticketRows: ticketRows ?? [], transit, valve, closure })
  if (asJson) {
    console.log(JSON.stringify({ verdict: result.state, face: FACE_SEL.face, ...result, identity: alertIdentity(result) }, null, 1))
  } else {
    console.log(`判定面=${FACE_TXT[FACE_SEL.face] ?? FACE_SEL.face}`)
    for (const d of result.dims) console.log(`  [${d.state.toUpperCase()}] ${d.dim} :: ${d.readout}${d.next ? `\n      ↳ ${d.next}` : ''}`)
    console.log(`AUTONOMY-LEG state=${result.state} ${result.summary} identity=${alertIdentity(result)}`)
  }
  process.exitCode = result.state === 'ok' ? 0 : result.state === 'drift' ? 1 : 2
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

export const __test__ = { judgePreflight, judgeMisattribution, judgeRange, judgeWhitelist, judgeBackendTransit, judgeValveGate, judgeDispatchClosure, resolveTransitBases, readGatesFace, readFaceText, evaluateAll, alertIdentity, readLedgerEvents }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
