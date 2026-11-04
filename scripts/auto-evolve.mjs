// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * auto-evolve — AI 自进化调度器(四期系列总纲 O65 · 第 0 期,2026-10-25 立)。
 *
 * 单轮职责:取票 → 闸 → 派发 → 记账 → 逃生邮件。守护(git-guardian)只守不开发,
 * 本器补"发起权"那一层:没人开会话也能按节律从派单面取真工作并派给执行端。
 *
 * 判据纪律(违反任何一条 = 本器自己变成它要防的事故):
 *  - 取票唯一入口 = `plan-tasks.mjs --open --dispatchable --exclude-inflight`(§1 派单口径),
 *    本器不自带第二份"什么算可派"的判据;取不到派单面 ⇒ exit 2 显式「未判定」,不猜。
 *  - 台账只记真工作:本器只记账、不登记(登记属第 1 期 auto-triage,且必须走 live-doc-edit)。
 *  - 闸门配置形状坏 ⇒ exit 2 未判定,绝不回落默认放行(§0.3:没判绝不写成判过)。
 *  - 起会话通路配置化(sessionCommandTemplate):模板为空 ⇒ dry-run,只取票记账,
 *    按同一纪律绝不冒充"执行过"。
 *  - 逃生邮件只走 notify-deploy-failure 唯一出口(§5e / 守门 81 硬拦自拼 SMTP),
 *    60 分钟节流;收件人现值 = apps/api/.env 的 ALERT_EMAIL_TO(git-guardian 同源解析)。
 *  - 预算闸 = 派发轮数 + token 双闸(第 3 期④接入:起会话 CLI `--json` 终态行 usage 计量后
 *    记账,单会话闸 + 近 24 小时闸;量不到 token 的轮只记墙钟并如实告警,不冒充量到)。
 *  - 会话后落账(2026-11-01 立):自治会话结构上没有提交权(dangerous 档不放宽),所以"干完活
 *    落不了账"必须由本器补 —— 但只认会话自己写的产物清单,且路径安全/真有改动/整批放行三道判据
 *    都住 lib/ticket-artifacts.mjs;任一档判不过就不提交,记 artifact-* 台账(§0.3 fail-closed)。
 *
 * 用法:
 *   node scripts/auto-evolve.mjs --once        # 真单轮(需 enabled=true)
 *   node scripts/auto-evolve.mjs --dry-run     # 全流程巡检,不派发、不发信
 *   node scripts/auto-evolve.mjs --status      # 现读闸门与台账,打印当前状态
 *   node scripts/auto-evolve.mjs --install-task # 打印 pwsh 计划任务注册命令(本机 schtasks.exe 在程序黑名单)
 *   node scripts/auto-evolve.mjs --self-test   # 内置断言
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, openSync, closeSync, unlinkSync, statSync, utimesSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHmac, randomUUID } from 'node:crypto'
import { loadCaps, parseLedger, evaluate, chargeLine } from './cost-breaker.mjs'
import { loadHumanGates, summarize as summarizeHumanGates } from './human-gates.mjs'
import { loadPolicy, decide, POLICY_PATH } from './autonomy-decision.mjs'
// 票键唯一实现(§0.6 单一真相源):本器不再自持一份,改从 lib 收口处取,转出保持既有导出面不变。
import { ticketKeyOf } from './lib/ticket-key.mjs'
export { ticketKeyOf }
// 发起腿的「执行体存续」判据单源(2026-11-01 立):盘符归一 + 派发前核验 + 失败分型。
// 本层零复算判据(§0.6),只做接线。
import { preflightSessionRunner, resolveSessionCommand, classifySessionFailure, isNonTicketFailure } from './lib/autonomy-runner.mjs'
export { preflightSessionRunner, resolveSessionCommand, classifySessionFailure, isNonTicketFailure }
import { gateTicketByHumanValve, VALVE_MODES } from './lib/autonomy-runner.mjs'
export { gateTicketByHumanValve }
// 会话后落账腿的判据单源(2026-11-01 立):清单解析/路径安全/真有改动三问都住 lib,本器只做 IO 与编排。
import { parseArtifactManifest, sanitizeArtifactPaths, selectDirtyPaths, manifestPathOf } from './lib/ticket-artifacts.mjs'
export { parseArtifactManifest, sanitizeArtifactPaths, selectDirtyPaths, manifestPathOf }
// 第 4 格·会话全文落盘腿:命名 / 脱敏 / 截断 / 轮转判据全在 lib(单一真相源,§0.6),本处只负责"读盘调用"。
import { buildTranscript, capTranscript, transcriptRelPathOf, isTranscriptName, decideRetention } from './lib/session-transcript.mjs'
import { attemptsSinceProgress, decideNonProgress, breakdownNonProgress, lastNonProgressHoldAt } from './lib/autonomy-nonprogress.mjs'
// 判据面(受保护面)的匹配判据单源在护栏纯函数层;本器只调用,不重抄任何匹配规则(§0.6)。
import { parseGuardList, matchProtected } from './lib/immutable-guard.mjs'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/** 调度器接线的锚点(guardian 派发层 import 同一组路径,不另拼第二份 —— §0.6 单一真相源) */
export const GATES_JSON = join(ROOT, 'scripts', 'data', 'auto-evolve-gates.json')
/** 人工阀分类语料(判据实现住在 lib/human-valve.mjs,这里只取它的语料文件)。
 *  必须排在 ROOT 之后:const 声明有 TDZ,放在上面会让本器一被 import 就 ReferenceError。 */
export const VALVE_LIST_JSON = join(ROOT, 'scripts', 'data', 'human-valve-list.json')
/** O6504 人工阀清单 / O6502 成本熔断(调度层读同一份真源,不另写第二份判据) */
const HUMAN_GATES_JSON = join(ROOT, 'scripts', 'data', 'human-gates.json')
const COST_CAPS_JSON = join(ROOT, 'scripts', 'data', 'cost-caps.json')
export const COST_LEDGER = join(ROOT, '.ihui-agent', 'state', 'cost-ledger.jsonl')
export const LEDGER = join(ROOT, '.ihui-agent', 'state', 'auto-evolve-ledger.jsonl')
export const LOCK_FILE = join(ROOT, '.ihui-agent', 'state', 'auto-evolve.lock')
const ESCAPE_TICK = join(ROOT, '.ihui-agent', 'state', 'auto-evolve-escape-tick.json')
const TMP_DIR = join(ROOT, '.ihui-agent', 'tmp', 'auto-evolve')
export const PLAN_TASKS = join(ROOT, 'scripts', 'plan-tasks.mjs')
/** 自治决策候选评估(第 2 期接线):id = ticketKey,由 scripts/autonomy-candidates.mjs 按
 *  **结构性证据**生成(每因子带 evidence,可复核);本器不替 AI 编语义因子。
 *  2026-11-01 前这个文件全仓只有本行一处定义、零写入方 ⇒ 第 2 期整期不生效(排期恒走台账序)。 */
const AUTONOMY_CANDIDATES = join(ROOT, '.ihui-agent', 'state', 'autonomy-candidates.json')
const AUTONOMY_CANDIDATES_SCRIPT = join(ROOT, 'scripts', 'autonomy-candidates.mjs')
/** 候选刷新节流:生成器实测 84s(要跑 plan-tasks + 台账聚合),不能每轮都跑。
 *  6h 一刷 —— 票面结构在小时级尺度上变化很慢,而调度器轮次远密于此。 */
const AUTONOMY_CANDIDATES_REFRESH_MS = 6 * 3600_000
const MAIL_SCRIPT = join(ROOT, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts')
const TSX_ENTRY = join(ROOT, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs')
const API_ENV = join(ROOT, 'apps', 'api', '.env')
/** 会话产物清单目录(会话写、本器读):路径口径住 lib/ticket-artifacts.mjs,这里只补仓根 */
export const ARTIFACT_MANIFEST_DIR = join(ROOT, '.ihui-agent', 'state', 'ticket-artifacts')
/** 代提交唯一出口:safe-commit 五步法(本器不自己拼 git add/commit —— 那会把共享索引里别人的改动打包) */
const SAFE_COMMIT = join(ROOT, 'scripts', 'safe-commit.mjs')
/**
 * 判据面(受保护面)清单的相对路径 —— 只是**指针**,匹配规则一律走 lib/immutable-guard.mjs。
 * 这里写成字面正斜杠而不是 join('scripts','data',…):Windows 下 join 出反斜杠,而护栏与 git 认的都是
 * 正斜杠相对路径,拿反斜杠去比会把每一枚判据面都读成"不在清单上"(同一格 A10 曾踩过的形态)。
 */
const GUARD_LIST_REL = 'scripts/data/immutable-guard.json'
/** ihui-cli 登录态(settings.json 的 apiKey 字段;login 同源存放处,同信任级) */
const CLI_SETTINGS = join(process.env.USERPROFILE ?? '', '.ihui', 'settings.json')
/** JWT secret 探测序(机器事实按当次实测取值:运行面部署副本优先,回落仓内副本) */
const JWT_ENV_CANDIDATES = ['D:/DevEnv/ihui-prod/apps/api/.env', API_ENV]
const JWT_TTL_SECONDS = 8 * 3600
/** 取票参数形状(唯一入口,镜像测试钉死此处;第二份拼装即 §22c 反面) */
export const DISPATCH_ARGS = ['--open', '--dispatchable', '--exclude-inflight']
const ESCAPE_MAIL_THROTTLE_MS = 60 * 60 * 1000

export class GateShapeError extends Error {}

/**
 * 闸门配置加载 + 形状锁。形状坏抛 GateShapeError ⇒ main 落 exit 2「未判定」,
 * 绝不回落默认值放行(§0.3)。
 */
export function loadGates(readFile = (p) => readFileSync(p, 'utf8')) {
  let raw
  try {
    raw = readFile(GATES_JSON)
  } catch (e) {
    throw new GateShapeError(`闸门配置读不到(${GATES_JSON}):${e?.message ?? e}`)
  }
  let g
  try {
    g = JSON.parse(raw)
  } catch (e) {
    throw new GateShapeError(`闸门配置不是合法 JSON:${e?.message ?? e}`)
  }
  const needBool = ['enabled']
  const needPosInt = ['dailyDispatchBudget', 'failureStreakLimit', 'quarantineHours', 'maxSessionMinutes']
  for (const k of needBool) {
    if (typeof g[k] !== 'boolean') throw new GateShapeError(`闸门形状坏:${k} 必须是 boolean`)
  }
  for (const k of needPosInt) {
    if (!Number.isInteger(g[k]) || g[k] <= 0) throw new GateShapeError(`闸门形状坏:${k} 必须是正整数`)
  }
  if (g.failureStreakLimit < 2) throw new GateShapeError('闸门形状坏:failureStreakLimit 至少为 2(=1 时首败即封票,误伤面过大)')
  if (!Array.isArray(g.ticketWhitelist) || g.ticketWhitelist.length === 0) {
    throw new GateShapeError('闸门形状坏:ticketWhitelist 必须是非空数组(第一期靠白名单兜底,不许全放行)')
  }
  for (const p of g.ticketWhitelist) {
    if (typeof p !== 'string' || !p.trim()) throw new GateShapeError('闸门形状坏:ticketWhitelist 出现非字符串/空白项')
  }
  if (typeof g.sessionCommandTemplate !== 'string') {
    throw new GateShapeError('闸门形状坏:sessionCommandTemplate 必须是字符串(空串 = dry-run 档)')
  }
  // 人工阀档:缺字段 = observe(记账不拦)。缺省绝不等于放开 —— 但也绝不因为"没登记"就
  // 一刀切停派,那是把刚修活的发起腿再锁死。enforce 的前置条件由尺子 A6 维量(见 check-autonomy-leg-health)。
  if (g.humanValveMode !== undefined && !VALVE_MODES.includes(g.humanValveMode)) {
    throw new GateShapeError(`闸门形状坏:humanValveMode 只能是 ${VALVE_MODES.join('|')} 之一(现值 ${JSON.stringify(g.humanValveMode)})`)
  }
  if (g.humanValveMode === undefined) g.humanValveMode = 'observe'
  // 空转记忆档(2026-11-04 立):缺字段 = 用保守缺省,绝不因"没登记"就退回"无限重试同一枚"。
  // 递增不变量交给判据器 decideNonProgress 复核(单源,本处不重抄判据),这里只补值。
  if (g.rotateAfterAttempts === undefined) g.rotateAfterAttempts = 4
  if (g.parkAfterAttempts === undefined) g.parkAfterAttempts = 8
  if (g.parkHardLimit === undefined) g.parkHardLimit = 24
  if (g.parkCooldownHours === undefined) g.parkCooldownHours = 24
  for (const k of ['rotateAfterAttempts', 'parkAfterAttempts', 'parkHardLimit']) {
    if (!Number.isInteger(g[k]) || g[k] <= 0) throw new GateShapeError(`闸门形状坏:${k} 必须是正整数(现值 ${String(g[k])})`)
  }
  if (!Number.isInteger(g.parkCooldownHours) || g.parkCooldownHours <= 0) {
    throw new GateShapeError(`闸门形状坏:parkCooldownHours 必须是正整数(现值 ${String(g.parkCooldownHours)})`)
  }
  return g
}

/**
 * 票键 = 去登记前缀/注记/租约牌后的标题指纹(同票跨会话识别;不按行号,行号一次 append 就挪位)。
 * 租约牌只剥「进行中@」形态(claimMarkOf 同族口径),标题内部普通括号不剥;
 * 误差方向刻意设计成"两形态算两票"(多派一次有白名单/预算兜着)而不是"两票合一"(漏派)。
 *
 * ⚠ 实现已收口到 `scripts/lib/ticket-key.mjs`(票键在全仓被三处台账取,各算一次就会变成三个键
 *   ⇒ "票→提交环"永远串不上)。本处只做转出,不再拄第二份。
 */

/**
 * 白名单判定:只匹配**标题区**(第一个 `**…**` 加粗段;无加粗段 ⇒ 行首前 60 字),
 * 不匹配全文 —— 实测(2026-10-25 --once 真派)第 3 期票的**正文**含"依赖升级"就命中了,
 * 而它的标题"第 3 期·进化回流"根本不是白名单票类。宽匹配 = 大工程票被误派。
 */
export function matchWhitelist(rowText, patterns) {
  const m = /\*\*([^*]+)\*\*/.exec(String(rowText))
  const hay = (m ? m[1] : String(rowText).slice(0, 60)).toLowerCase()
  return patterns.some((p) => hay.includes(String(p).toLowerCase()))
}

/**
 * 解析 plan-tasks 派单面输出:只认「判定面」标记之后的 `  L<行号>  - [ ] …` 登记行,
 * 元信息行(--exclude-inflight 摘除/惰判/剔除统计)一律忽略。
 */
export function parseTicketRows(stdout) {
  const text = String(stdout ?? '')
  const marker = text.lastIndexOf('判定面')
  const face = marker >= 0 ? text.slice(marker) : text
  const rows = []
  for (const line of face.split(/\r?\n/)) {
    const m = /^\s*L(\d+)\s+- \[ \](.*)$/.exec(line)
    if (m) rows.push({ line: Number(m[1]), text: m[2].trim() })
  }
  return rows
}

/**
 * 自治决策排序(第 2 期接线):候选评估文件由 AI 会话写(见 AUTONOMY_CANDIDATES),
 * 本器只按模型排期,不替 AI 编因子 —— "没评估"就是没评估,不补默认值。
 * 有文件 ⇒ 只放行模型判为可排期的票;压后/未收录的票本轮不派(逐条点名原因)。
 * 无文件 ⇒ 保持现值行为:台账序 + 白名单闸。
 */
/**
 * 决策候选刷新腿(2026-11-01 补,治"第 2 期整期不生效")。
 * 只在文件缺失或超过节流窗口时才真调生成器;生成失败**不阻断派发** ——
 * "没有候选评估"本来就是这套设计的合法起点(落回台账序),不能让它升级成"本轮不派"。
 * dry-run 不写盘 ⇒ 也就没有新候选可读,如实返回未判定而不是假装刷新过。
 */
export function refreshAutonomyCandidates({ now = Date.now(), dryRun = false, scriptFile = AUTONOMY_CANDIDATES_SCRIPT, candidatesFile = AUTONOMY_CANDIDATES, runner = null } = {}) {
  if (!existsSync(scriptFile)) return { state: 'undetermined', why: '生成器物不在位(scripts/autonomy-candidates.mjs)' }
  try {
    const st = statSync(candidatesFile)
    const ageMs = now - st.mtimeMs
    // 允许 ageMs 为小负值:文件刚写完时 mtime 可能比 now 晚几毫秒(写入顺序/文件系统精度),
    // 卡 `>= 0` 会让"刚生成"被判成不新鲜 ⇒ 每轮都重刷 84s 的器物(S11a 实测抓到)。
    // 时钟回拨也落进同一侧:宁可少刷一次(下一轮自然补),不要每轮白等。
    if (Number.isFinite(ageMs) && ageMs < AUTONOMY_CANDIDATES_REFRESH_MS) {
      return { state: 'ok', why: `候选文件新鲜(${Math.round(ageMs / 60_000)}min < ${AUTONOMY_CANDIDATES_REFRESH_MS / 3_600_000}h),不重跑` }
    }
  } catch {
    /* 没生成过 ⇒ 继续往下刷 */
  }
  if (dryRun) return { state: 'undetermined', why: 'dry-run 不写盘 ⇒ 候选不刷新(决策将按台账序)' }
  const r =
    typeof runner === 'function'
      ? { status: 0, stdout: String(runner() ?? ''), stderr: '' }
      : spawnSync(process.execPath, [scriptFile, '--apply'], { cwd: ROOT, windowsHide: true, encoding: 'utf8', timeout: 180_000 })
  if (r.error) return { state: 'undetermined', why: `生成器起不来:${r.error.message}` }
  if (r.status !== 0) return { state: 'undetermined', why: `生成器 exit=${r.status} ${String(r.stderr ?? '').slice(-160)}` }
  return { state: 'ok', why: '已按结构性证据刷新' }
}

export function rankTicketRows(rows, { policyText, candidatesText, keyOf = ticketKeyOf } = {}) {
  if (typeof candidatesText !== 'string' || candidatesText.trim() === '') {
    return { rows, mode: 'ledger-order', why: '无候选评估文件', ranked: [], skipped: [] }
  }
  let input
  try {
    input = JSON.parse(candidatesText)
  } catch (e) {
    throw new Error(`自治决策候选不是合法 JSON:${e?.message ?? e}`)
  }
  const policy = loadPolicy(policyText)
  const result = decide({ policy, candidates: Array.isArray(input) ? input : input?.candidates })
  const deferredById = new Map(result.deferred.map((d) => [d.id, d.reason]))
  const byKey = new Map(rows.map((r) => [keyOf(r.text), r]))
  const ranked = []
  const used = new Set()
  for (const item of result.ranked) {
    const row = byKey.get(item.id)
    if (!row) continue // 模型排了台账里没有的票:不凭空造行
    used.add(item.id)
    ranked.push({ ...row, decision: { rank: item.rank, score: item.score, reason: item.reason } })
  }
  const skipped = []
  for (const r of rows) {
    const key = keyOf(r.text)
    if (used.has(key)) continue
    skipped.push({ line: r.line, key, reason: deferredById.get(key) ?? '未评估(候选文件未收录本票)' })
  }
  return {
    rows: ranked,
    mode: 'decision',
    why: `模型 ${result.state}:可排期 ${ranked.length} / 压后 ${result.deferred.length}`,
    ranked,
    skipped,
  }
}

/** {promptFile}/{ticketLine}/{ticketKey} 占位填充;未知占位原样保留(不猜) */
export function fillTemplate(tpl, { promptFile, ticketLine, ticketKey }) {
  return String(tpl)
    .replaceAll('{promptFile}', promptFile ?? '')
    .replaceAll('{ticketLine}', ticketLine ?? '')
    .replaceAll('{ticketKey}', ticketKey ?? '')
}

/**
 * 起会话 token 计量(第 3 期④):唯一可信取数口 = CLI `--json` 事件流的终态行
 * `{"type":"complete",…,"usage":{promptTokens,completionTokens,totalTokens,estimatedCostUsd}}`
 * (会话文件不落 usage,文本模式只有人读排版)。
 * 取最后一个 complete 行;没读到 / 字段坏 ⇒ measured:false —— 不把"量不到"读成 0。
 */
export function parseSessionUsage(stdout) {
  const lines = String(stdout ?? '').split(/\r?\n/)
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trim()
    if (!t.startsWith('{')) continue
    let e
    try {
      e = JSON.parse(t)
    } catch {
      continue
    }
    if (e?.type !== 'complete') continue
    const total = Number(e?.usage?.totalTokens)
    if (!Number.isFinite(total) || total < 0) return { tokens: 0, costUsd: 0, measured: false, stopReason: null }
    const cost = Number(e?.usage?.estimatedCostUsd)
    return {
      tokens: Math.floor(total),
      costUsd: Number.isFinite(cost) && cost > 0 ? cost : 0,
      measured: true,
      // 终态理由是会话自己给的字面值(no_progress / max_iterations / complete …)。它必须进台账:
      // "会话失败"与"会话读完材料就没力气了"是同一种失败分型下的两件完全不同的事,
      // 只记 exit 码就永远看不出该改提示词还是该改运行器。
      stopReason: typeof e?.stopReason === 'string' ? e.stopReason : null,
    }
  }
  return { tokens: 0, costUsd: 0, measured: false, stopReason: null }
}

export function todayKey(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function readLedger() {
  try {
    return readFileSync(LEDGER, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

function record(entry) {
  mkdirSync(dirname(LEDGER), { recursive: true })
  appendFileSync(LEDGER, `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`, 'utf8')
}

/**
 * 会话全文落盘(第 4 格·观测腿,2026-11-01 立)。
 *
 * 立因:台账原先只记 `exitCode / durationMs / tokens` 三枚读数,会话**调了哪些工具、为什么零推进**
 * 一个字不留。两枚 session-ok 各自 3.4s / 23s 就 end_turn、票行零推进,事故报告只能写"核该会话末轮
 * 实际动作" —— 可动作在哪没人知道。本函数把"那一轮到底发生了什么"落盘,给 A7 维的每一条 drift
 * 一个可归因的证据面(§0.3:猜等于没判)。
 *
 * 四条约束(逐条对应 lib 头部):
 *  ① 脱敏在 buildTranscript 内(best-effort,命中数进头部);
 *  ② 截断在 capTranscript 内(超限必留"中略"痕,绝不静默丢);
 *  ③ 轮转在 git-guardian 的 decideRetention 内(最新一份永久豁免);
 *  ④ **写盘失败不打断派发**:返回 null 并大声告警,绝不记成"已落盘"(否则 A7 会把"丢日志"
 *     读成"会话没产出",与"会话真没产出"同罪,事故就被盖住了)。
 *
 * 落盘目录 `.ihui-agent/state/session-transcripts` 已被 .gitignore 忽略,证据不进版本库。
 */
function persistTranscript({ mode, ticketKey, ticketLine, cmd, action, exitCode, durationMs, timedOut = false, signal = null, prompt = '', stdout = '', stderr = '', notes = '', at = new Date() }) {
  try {
    const body = buildTranscript({ at, mode, ticketKey, ticketLine, cmd, action, exitCode, durationMs, timedOut, signal, prompt, stdout, stderr, notes })
    const capped = capTranscript(body)
    const rel = transcriptRelPathOf({ at, ticketKey, mode, action })
    const abs = join(ROOT, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, capped.text, 'utf8')
    return rel
  } catch (e) {
    console.error(`⚠ 会话全文落盘失败(transcript-write-failed,本轮照常收尾):${e.message}`)
    return null
  }
}

/** 同票连败计数:该 key 最近连续的 session-failed/session-timeout 条数(遇到任何其他 action 打断) */
export function failureStreakOf(ledger, key) {
  let n = 0
  for (let i = ledger.length - 1; i >= 0; i--) {
    const e = ledger[i]
    if (e.ticketKey !== key) continue
    if (e.action === 'session-failed' || e.action === 'session-timeout') n++
    else break
  }
  return n
}

/** 封票到期时刻(未封 = null):该 key 最近一条 quarantined 的 until */
export function quarantinedUntilOf(ledger, key, now = Date.now()) {
  for (let i = ledger.length - 1; i >= 0; i--) {
    const e = ledger[i]
    if (e.ticketKey === key && e.action === 'quarantined') {
      const until = Date.parse(e.until)
      if (Number.isFinite(until) && until > now) return until
      return null
    }
  }
  return null
}

export function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e?.code === 'EPERM'
  }
}

/**
 * 手写 HS256 JWT(零依赖;与 packages/auth/src/jwt.ts 同形:sub=userId、iss/aud、HS256)。
 * 关键判据(实测 2026-10-25):verifyAccessToken 强制要求 **sub** claim(缺 ⇒ 401 且文案被
 * 错误目录吞成"提交的信息有误"),签发侧 setSubject(userId) 这一步不能少。
 * roleId 恒 0(最小权限;校验只认 sub,角色 claim 只是 RBAC 装饰)。
 */
export function signSessionJwt(secret, { userId, ttlSeconds = JWT_TTL_SECONDS, now = Math.floor(Date.now() / 1000) }) {
  const b64u = (b) => Buffer.from(b).toString('base64url')
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64u(
    JSON.stringify({ sub: userId, userId, phone: '', familyId: randomUUID(), roleId: 0, iat: now, iss: 'ihui-ai', aud: 'ihui-ai-users', exp: now + ttlSeconds })
  )
  const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

function resolveJwtSecret() {
  for (const p of JWT_ENV_CANDIDATES) {
    try {
      const m = /^JWT_SECRET=(.+)$/m.exec(readFileSync(p, 'utf8'))
      if (m && m[1].trim().length >= 32) return { secret: m[1].trim(), from: p }
    } catch {
      /* 候选不在位 ⇒ 试下一个 */
    }
  }
  return null
}

/**
 * 派发前供值:现签短命 JWT 写进 ihui-cli 登录态(settings.json 的 apiKey 字段,
 * login 同源存放处)。凭据全程只在内存与该机器态文件,终端零输出(不入聊天不入日志)。
 * secret 探测不到 ⇒ 返回 { ok:false },调用方落「未判定」不派发。
 */
export async function mintSessionCredential({ userId, writeSettings = (jwt) => writeCliSettingsJwt(jwt) } = {}) {
  const found = resolveJwtSecret()
  if (!found) return { ok: false, why: 'JWT_SECRET 探测不到(候选 .env 均缺或强度不足)' }
  const uid = userId ?? (await resolveMachineUserId())
  if (!uid) return { ok: false, why: '机器账号 userId 取不到(库查不到或连接失败)' }
  writeSettings(signSessionJwt(found.secret, { userId: uid }))
  return { ok: true, from: found.from }
}

/**
 * 把新签的 JWT 写进 CLI 登录态(settings.json 的 apiKey 字段,与 `ihui login` 同一存放处)。
 *
 * 2026-11-01 修(实测病灶):原实现直接 `readFileSync(CLI_SETTINGS)` 再写回,文件不存在就抛
 * `ENOENT: C:\windows\system32\config\systemprofile\.ihui\settings.json` 并**打断整轮派发** ——
 * 因为调度器是由计划任务/服务身份起的,USERPROFILE 指向服务账户目录,那里没有机主的登录态。
 * 一次 ENOENT 就把本轮变成"没派任何票",而账面只看到异常栈,票面连败计数却被记上(§0.3 归因失真)。
 * 现在:文件不存在 ⇒ 建最小结构(只含 apiKey)继续;目录不存在 ⇒ 一并建。
 * 边界:服务身份与机主身份读的是各自 HOME 下的 settings,互不覆盖 —— 这是"两个身份各自登录"
 * 的机器事实,不是本函数的缺陷。
 */
function writeCliSettingsJwt(jwt) {
  let s = {}
  try {
    s = JSON.parse(readFileSync(CLI_SETTINGS, 'utf8'))
  } catch {
    /* 首次 / 服务身份无登录态 ⇒ 建最小结构,不抛 */
  }
  s.apiKey = jwt
  try {
    mkdirSync(dirname(CLI_SETTINGS), { recursive: true })
    writeFileSync(CLI_SETTINGS, JSON.stringify(s, null, 2), 'utf8')
  } catch (e) {
    // 写不进去也不该把整轮打死:调用方会把"凭据未写入"记成未判定,而不是票面失败。
    console.error(`⚠ CLI 登录态写入失败(${String(e?.message ?? e).slice(0, 120)})⇒ 本轮会话可能以未登录退出,按未判定记账`)
  }
}

/**
 * 机器账号 userId 现读:users 表 role 最高的首个账号(只读 SELECT,每轮现读不缓存)。
 * 连接串走候选 .env 同源;查不到 ⇒ null(调用方落未判定)。
 */
async function resolveMachineUserId() {
  for (const envPath of JWT_ENV_CANDIDATES) {
    try {
      const m = /^DATABASE_URL=(.+)$/m.exec(readFileSync(envPath, 'utf8'))
      if (!m) continue
      const { createRequire } = await import('node:module')
      const postgres = createRequire(join(ROOT, 'apps', 'api', 'package.json'))('postgres')
      const sql = postgres(m[1].trim())
      try {
        const rows = await sql.unsafe('SELECT id FROM users ORDER BY role_id DESC, created_at ASC LIMIT 1')
        const id = rows[0]?.id
        if (typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id)) return id
        return null
      } finally {
        await sql.end({ timeout: 5 })
      }
    } catch {
      /* 该候选连接失败 ⇒ 试下一个;都失败落 null */
    }
  }
  return null
}

/** 收件人现值 = apps/api/.env 的 ALERT_EMAIL_TO(git-guardian 同源;缺键 ⇒ 告警链不判死,只不发) */
function resolveMailTo(envFile = API_ENV) {
  const fromEnv = String(process.env.ALERT_EMAIL_TO || '').trim()
  if (fromEnv) return fromEnv
  try {
    const m = /^\s*ALERT_EMAIL_TO\s*=\s*(.+?)\s*$/.exec(readFileSync(envFile, 'utf8'))
    return m ? m[1].trim() : ''
  } catch {
    return ''
  }
}

function escapeThrottled(now = Date.now()) {
  try {
    const last = JSON.parse(readFileSync(ESCAPE_TICK, 'utf8')).at
    return now - Number(last) < ESCAPE_MAIL_THROTTLE_MS
  } catch {
    return false
  }
}

function markEscape(now = Date.now()) {
  mkdirSync(dirname(ESCAPE_TICK), { recursive: true })
  writeFileSync(ESCAPE_TICK, JSON.stringify({ at: now }), 'utf8')
}

/**
 * 逃生邮件:只经 notify-deploy-failure 唯一出口(守门 81);出口不在位/无收件人 ⇒ 打印并
 * 落「未判定」返回 false,绝不冒充已发(§0.3)。
 */
function sendEscapeMail(gates, alertId, title, bodyText) {
  const to = resolveMailTo()
  if (!to) {
    console.error('⚠️ 逃生邮件未判定:apps/api/.env 缺 ALERT_EMAIL_TO(§5e 告警链排除),现场已落台账')
    return false
  }
  if (!existsSync(TSX_ENTRY) || !existsSync(MAIL_SCRIPT)) {
    console.error(`⚠️ 逃生邮件未判定:出口不在位(tsx=${existsSync(TSX_ENTRY)} script=${existsSync(MAIL_SCRIPT)})`)
    return false
  }
  mkdirSync(TMP_DIR, { recursive: true })
  const msgFile = join(TMP_DIR, `escape-${Date.now()}.md`)
  writeFileSync(msgFile, bodyText, 'utf8')
  const r = spawnSync(
    process.execPath,
    [
      TSX_ENTRY,
      MAIL_SCRIPT,
      '--to',
      to,
      '--title',
      title,
      '--severity',
      'warning',
      '--source',
      'auto-evolve',
      '--alert-id',
      alertId,
      '--message-file',
      msgFile,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], cwd: ROOT, windowsHide: true, timeout: 60_000, encoding: 'utf8' }
  )
  try {
    unlinkSync(msgFile)
  } catch {
    /* 用完即删,删不掉不遮蔽主流程 */
  }
  if (r.status !== 0) {
    console.error(`⚠️ 逃生邮件投递失败(status=${r.status}):${String(r.stderr ?? '').slice(-200)}`)
    return false
  }
  return true
}

function acquireLock() {
  mkdirSync(dirname(LOCK_FILE), { recursive: true })
  let fd
  try {
    fd = openSync(LOCK_FILE, 'wx')
  } catch {
    // 锁在:判持锁 pid 是否还活着;死锁(进程不在)才抢占,活锁让路
    try {
      const { pid } = JSON.parse(readFileSync(LOCK_FILE, 'utf8'))
      if (isPidAlive(pid)) return { held: true, pid }
    } catch {
      /* 锁文件坏 = 无有效持有者,抢 */
    }
    try {
      unlinkSync(LOCK_FILE)
    } catch {
      /* 抢不掉就当让路 */
      return { held: true, pid: null }
    }
    return acquireLock()
  }
  writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }), 'utf8')
  closeSync(fd)
  return { held: false }
}

function releaseLock() {
  try {
    unlinkSync(LOCK_FILE)
  } catch {
    /* 已被下一轮抢占清理 */
  }
}

/**
 * 派发结算(2026-11-01 立):把"CLI 退出码 0"翻译成"这张票到底推进了没有"。
 * 立因:台账里唯一一枚 session-ok 对一张大工程票只跑了 45.5s 就 exit 0 ——
 * 调度器把"会话结束了"读成"这轮干成了",于是账面永远不会出现"派了但没动"这一档。
 * 而 AGENTS §10/§20 要求的是交付与产出一致、完成只认远端落地,所以这一档必须被量出来。
 * 四态不并桶:
 *  - line-gone     派单面上已无此票(结清摘行或被别的席位摘出)⇒ 算推进
 *  - line-changed  该行前缀与派发时记录的不再逐字相等 ⇒ 算推进(注记/改写)
 *  - no-progress   该行原样躺在派单面上 ⇒ 零推进,逐条点名
 *  - unjudged      派单面取不到 ⇒ 不猜(§0.3)
 * 比较口径刻意取"前 200 字逐字相等"(与记账时同一截法):票行只在 200 字之后被改的会被读成
 * no-progress —— 失效方向是多要一次定向说明,绝不是多放一次"算它干成了"(§0.10)。
 *
 * 窗口口径(2026-11-01 收,治"悬案永久化"):默认 **windowHours = Infinity**,即结清台账里
 * 所有未结算的 session-ok,不只近 48h。原默认 48h 的结构性后果是:一枚成功一旦滑出窗口,
 * 结算腿结构上再也不会碰它 ⇒ 那笔账永久悬着,而尺子 A7 的"超窗未结算"判据因此恒红
 * (§12e 恒红门)。实测病灶就是台账里唯一那枚 2026-10-25 的成功:不限窗口去问,结论是
 * line-gone(票早已摘行 = 真推进了),而 48h 窗口让它连被问一次的机会都没有。
 * 窗口参数保留(测试与调用方仍可显式收窄),只是不再是默认值。
 */
export function settlePriorDispatches({ ledger = [], currentRows = null, windowHours = Infinity, now = Date.now(), recordedPrefix = 200, sameRowPrefix = 60 } = {}) {
  const cutoff = now - windowHours * 3600_000
  const settledOf = new Set(ledger.filter((e) => e.action === 'dispatch-settled').map((e) => String(e.sourceTs ?? '')))
  const outs = []
  for (const e of ledger) {
    if (e.action !== 'session-ok' || !e.ticketKey) continue
    const at = Date.parse(String(e.ts ?? ''))
    if (!Number.isFinite(at) || at < cutoff) continue
    if (settledOf.has(String(e.ts))) continue
    const thenPrefix = String(e.ticketLine ?? '').slice(0, recordedPrefix)
    if (!Array.isArray(currentRows)) {
      outs.push({ ticketKey: e.ticketKey, ticketLine: thenPrefix, sourceTs: e.ts, state: 'unjudged', why: '派单面取不到 ⇒ 无法判这张票是否推进' })
      continue
    }
    const faceRow = currentRows.find((r) => ticketKeyOf(String(r.text ?? '')) === e.ticketKey)
    if (faceRow) {
      const nowPrefix = String(faceRow.text ?? '').slice(0, recordedPrefix)
      outs.push(
        nowPrefix === thenPrefix
          ? { ticketKey: e.ticketKey, ticketLine: thenPrefix, sourceTs: e.ts, state: 'no-progress', why: `会话报成功但票行逐字未变(L${faceRow.line})` }
          : { ticketKey: e.ticketKey, ticketLine: thenPrefix, sourceTs: e.ts, state: 'line-changed', why: `票行已改写(L${faceRow.line})` }
      )
      continue
    }
    // 票键没命中 ⇒ 再问一次"还是不是那一行"。ticketKeyOf 对尾部注记不稳定(实测同一张票
    // 追加"—— 已追加进展注记"后 key 会变,而追加"（进行中@…）"认领牌 key 不变),
    // 只按 key 找行会把最常见的"只写了注记"掉进 line-gone,而那与"整票结清"是两回事(§10)。
    const headKey = thenPrefix.slice(0, Math.min(sameRowPrefix, thenPrefix.length))
    const sameRow = headKey ? currentRows.find((r) => String(r.text ?? '').startsWith(headKey)) : null
    if (sameRow) {
      outs.push({ ticketKey: e.ticketKey, ticketLine: thenPrefix, sourceTs: e.ts, state: 'line-changed', why: `票键随注记漂移但行首同源 ⇒ 同一张票被改写(L${sameRow.line}),不得记成结清摘行` })
      continue
    }
    outs.push({ ticketKey: e.ticketKey, ticketLine: thenPrefix, sourceTs: e.ts, state: 'line-gone', why: '派单面上既无同票键也无同前缀行 ⇒ 已摘行或摘出在飞' })
  }
  return outs
}

function pickTickets() {
  const r = spawnSync(process.execPath, [PLAN_TASKS, ...DISPATCH_ARGS], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    windowsHide: true,
    timeout: 120_000,
    encoding: 'utf8',
  })
  if (r.error) throw new Error(`派单面取不到:${r.error.message}`)
  const rows = parseTicketRows(r.stdout)
  if (rows.length === 0 && r.status !== 0) {
    throw new Error(`派单面未判定(status=${r.status}):${String(r.stderr ?? r.stdout ?? '').slice(-300)}`)
  }
  return rows
}

/** 失败文本取证:两流各取自己的头尾并标来源,不先拼再截(拼起来截尾会把先拼的那条整段挤掉)。 */
export function excerptBothEnds(stderr, stdout, max = 150) {
  const one = (label, raw) => {
    const s = String(raw ?? '').replace(/\s+/g, ' ').trim()
    if (!s) return null
    return s.length <= max * 2 ? `${label}=${s}` : `${label}=${s.slice(0, max)} …〔中略 ${s.length - max * 2} 字〕… ${s.slice(-max)}`
  }
  const parts = [one('stderr', stderr), one('stdout', stdout)].filter(Boolean)
  return parts.length ? parts.join(' | ') : '(两流皆空)'
}

/**
 * 阀结论 → 派发路由(2026-11-03 改档,用户授权)。
 *
 * 改什么:observe 档命中停机类(`observe-stop`)原先只记台账就**照派**,台账里 20 条
 * 阀判"停机等人"的票仍然被派出去白烧会话额度。现在 observe-stop = 单票停机不派,
 * 台账动作名仍保留 `valve-observe-stop`(既有统计不失效)+ 新字段 `dispatched:false`。
 *
 * 不改什么:阀判据本体(lib/human-valve.mjs / lib/autonomy-runner.mjs)、档位取值、
 * enforce 的 block 单票跳 / unjudged 整轮停、allow 照派、unjudged+observe 照派。
 *
 * 返回 { route, ledger },route 四档:
 *   `block`            单票不派(enforce 命中停机类)
 *   `stop-round`       整轮停(enforce 档 unjudged,fail-closed)
 *   `skip-observe-stop` 单票不派(observe 命中停机类;本条即本次语义变更)
 *   `dispatch`         照派(allow,以及 unjudged 在非 enforce 档的既有行为)
 */
export function decideValveDispatch(valve, mode, { ticketKey = '', ticketLine = '' } = {}) {
  const ledger = {
    action: `valve-${valve?.action}`,
    ticketKey,
    ticketLine,
    ruleId: valve?.ruleId,
    why: valve?.reason,
  }
  if (valve?.action === 'observe-stop') {
    // 只在这一档加"未派"标记:修订不动 block / unjudged / allow 行既有的字段形状。
    return { route: 'skip-observe-stop', ledger: { ...ledger, dispatched: false } }
  }
  if (valve?.action === 'block') return { route: 'block', ledger }
  if (valve?.action === 'unjudged' && mode === 'enforce') return { route: 'stop-round', ledger }
  return { route: 'dispatch', ledger }
}

function dispatchSession(gates, ticket, dryRun) {
  const key = ticketKeyOf(ticket.text)
  if (!gates.sessionCommandTemplate.trim()) {
    return { action: 'template-empty', why: 'sessionCommandTemplate 未配置 ⇒ 本轮只取票记账,不冒充执行(§0.3)' }
  }
  if (dryRun) return { action: 'dryrun-ticket', why: 'dry-run 不真派' }
  // 命令行一律经当次仓根归一(§0:盘符是现读机器事实)。取不到仓根 ⇒ 判未判定,
  // 绝不把原模板(可能钉着别机盘符)直接交给 cmd.exe 去撞运气。
  const resolved = resolveSessionCommand(gates.sessionCommandTemplate, ROOT)
  if (resolved === null) {
    return { action: 'runner-undetermined', why: '当次仓根取不到 ⇒ 命令行无法归一,本轮不派(§0.3)' }
  }
  mkdirSync(TMP_DIR, { recursive: true })
  // 清单目录必须由调度器预建:会话侧写文件是普通能力,但"目录不存在时要不要自己建"不是契约的一部分 ——
  // 让落账腿依赖会话的建目录习惯,等于把成功率押在一个没人保证的行为上。
  mkdirSync(ARTIFACT_MANIFEST_DIR, { recursive: true })
  const promptFile = join(TMP_DIR, `prompt-${key}-${Date.now()}.md`)
  const promptText = [
    `# 派发票(auto-evolve 单轮)`,
    ``,
    `- 票面:${ticket.text}`,
    `- 台账行:L${ticket.line}(PROJECT_PLAN.md,行号会漂移,以题面定位)`,
    ``,
    `按 AGENTS.md 全部强制条款执行本票;只改本任务文件。`,
    `**取材纪律(2026-11-04 立,有实测依据)**:禁止整份读取 \`PROJECT_PLAN.md\` / \`AGENTS.md\`(本仓现读`,
    `台账数万行、规则正文近 9.6 万字节 —— 一次全文读就把本会话的上下文吃光,实测到的一轮是`,
    `promptTokens≈12.6 万而 completionTokens 只有 22,终态 \`no_progress\`,等于白烧一个班次)。`,
    `要看规则或台账:用带行区间/grep 的取段方式,单次只取与本品直接相关的片段;`,
    `票面里已有的信息不要再回台账找一遍。动手前先读**目标文件本身**,不是读它的登记行。`,
    `**判据面(受保护面)不许动**:清单 = \`scripts/data/immutable-guard.json\` 的 \`path\` 字段(现读,勿凭记忆),`,
    `命中即落账腿整批拒收(自治会话没有豁免签名权,补理由放行=替自己发豁免)。本票若非动那些面不可,`,
    `**不要动**:保持票未勾,走 live-doc-edit 在票行追加进展注记,写明「本票需先动判据面 <路径> <为什么必须动>」后正常退出(这是合法完成)。`,
    `提交不在你的权限内:自动会话对 dangerous 档一律不放宽(permissions.ts),git_commit 与`,
    `run_command 都过不去 —— 不要试,也不要绕。改完把产物写进下面的清单,由调度器会话后代提交。`,
    `验证齐绿(typecheck/test/守门末行现读)后才可声明完成;完成即翻勾。`,
    ``,
    `## 落账清单(硬性,调度器只认这一份)`,
    `- 路径:${manifestPathOf(key)}(相对仓根,不存在就创建目录)`,
    `- 格式:{"ticketKey":"${key}","files":["相对仓根的路径"],"note":"可选"}`,
    `- 只许列本票**真正改过**的文件;没改任何文件就不要写清单。`,
    `- 清单里不许出现:PROJECT_PLAN.md(活文档)、绝对路径/盘符、带 .. 的路径、.git/.env 一类敏感面。`,
    `- 调度器会逐个核对 git status:无改动的文件被剔除并点名;全部被剔除 ⇒ 本轮记 stale,不提交。`,
    `- 整批里有一条不合规 ⇒ 整批不提交(不做部分提交)。`,
    ``,
    `完成判定(硬性,防半成品):`,
    `- 要么完成整票(验证齐绿 + 翻勾 + 写清单,提交由调度器代劳),要么保持未勾并走 live-doc-edit 在票行追加进展注记,禁止"写完了你看下"式半成品提交。`,
    `- 若判定本票工作量超出单会话预算(maxSessionMinutes=${gates.maxSessionMinutes} 分钟),立即停下:不写任何代码,只在票行追加工作量评估注记后正常退出(这是合法完成,不算失败)。`,
  ].join('\n')
  writeFileSync(promptFile, promptText, 'utf8')
  const cmd = fillTemplate(resolved, { promptFile, ticketLine: ticket.text, ticketKey: key })
  const t0 = Date.now()
  // windowsVerbatimArguments 必带(同 probe:node 对 cmd.exe 的默认引用改写会毁模板内引号)
  const r = spawnSync('cmd.exe', ['/d', '/s', '/c', cmd], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    windowsHide: true,
    windowsVerbatimArguments: true,
    timeout: gates.maxSessionMinutes * 60_000,
    encoding: 'utf8',
  })
  try {
    unlinkSync(promptFile)
  } catch {
    /* 用完即删 */
  }
  const durationMs = Date.now() - t0
  // 第 3 期④:token 计量与成败判定分开取 —— 失败/超时的轮也可能有过 usage,能记就记。
  const meter = parseSessionUsage(r.stdout)
  const tokens = meter.measured ? meter.tokens : null
  const tokensMeasured = meter.measured
  const costUsd = meter.costUsd
  const stdout = r.stdout ?? ''
  const stderr = r.stderr ?? ''
  const signal = r.signal ?? null
  // 第 4 格·会话全文落盘:成败都落盘(否则 A7 的每一条 drift 只能靠猜,§0.3)。
  // 先算 action,再一次性落盘 + 返回,避免四条分支各写一遍(分支越多越容易漏 transcript)。
  let action, failureKind = 'ok', exitCode = 0, why = '', timedOut = false
  if (r.error?.killed || (signal === 'SIGTERM' && durationMs >= gates.maxSessionMinutes * 60_000 - 5_000)) {
    action = 'session-timeout'
    exitCode = null
    timedOut = true
    why = `超过 maxSessionMinutes=${gates.maxSessionMinutes}`
  } else if (r.error) {
    const kind = classifySessionFailure({ status: null, stderr: '', error: r.error.message })
    action = 'session-failed'
    failureKind = kind.kind
    exitCode = null
    why = r.error.message
  } else if (r.status !== 0) {
    // 真因常在头部(ERR_MODULE_NOT_FOUND 的前两行),只截尾会把 "der:639:32" 这类
    // 中段残渣当成原因寄出去 —— 比没有原因更贵。各取头尾并标来源。
    const errText = excerptBothEnds(stderr, stdout)
    const kind = classifySessionFailure({ status: r.status, stderr: `${stderr}\n${stdout}` })
    action = 'session-failed'
    failureKind = kind.kind
    exitCode = r.status
    why = `exit=${r.status} ${errText}`
  } else {
    action = 'session-ok'
  }
  const transcript = persistTranscript({
    mode: 'dispatch',
    ticketKey: key,
    ticketLine: ticket.text,
    cmd,
    action,
    exitCode,
    durationMs,
    timedOut,
    signal,
    prompt: promptText,
    stdout,
    stderr,
    at: t0,
  })
  return {
    action,
    failureKind,
    exitCode,
    durationMs,
    why,
    tokens,
    tokensMeasured,
    costUsd,
    transcript,
    // 会话自己给的终态理由(no_progress / max_iterations / …)。它和 exit 码是两个问题:
    // 本次实测到的形状是 exit=3 + `stopReason=no_progress` + 12.6 万 prompt token 而 completion 只有 22 token
    // ⇒ 会话把预算花在读台账/规则全文上、没力气动手。只记 exit 就永远分不出"该改提示词"还是"该改运行器"。
    stopReason: meter.stopReason ?? null,
  }
}

/**
 * 代提交消息前缀:只按票面自述分档,不猜工作内容。
 * 会话改了什么本器不知道(它只交清单),所以前缀取"票面在说修东西还是写东西"——
 * 猜错只影响 changelog 归类,不影响判据;而猜工作内容则会造假账。
 */
export function commitPrefixOf(ticketText) {
  const t = String(ticketText ?? '')
  if (/(修复|修好|缺陷|报错|故障|回归|超时|fix|bug|broken|hotfix|regress)/i.test(t)) return 'fix'
  if (/(文档|注释|readme|chore|清理|重命名|归档|排版|doc)/i.test(t)) return 'chore'
  return 'feat'
}

/** 代提交消息:正文点名票键与票面(决策链审计靠这两项把提交接回本票)。 */
export function buildArtifactCommitMessage({ ticketKey, ticketText }) {
  const face = String(ticketText ?? '').replace(/\s+/g, ' ').trim()
  return [
    `${commitPrefixOf(ticketText)}: ${face.slice(0, 80)}`,
    '',
    `票键:${ticketKey}`,
    `票面:${face}`,
    `落账:auto-evolve 会话后按 ${manifestPathOf(ticketKey)} 代提交(会话侧无提交权)`,
  ].join('\n')
}

/**
 * 会话后落账腿(2026-11-01 立)。
 *
 * 立因:派发票要求会话自己提交,而会话侧 dangerous 档结构上不放宽 ⇒ 自治会话改得动文件却落不了账。
 * 本函数把"退出码 0"之外的第二问补上:这一轮到底产出了什么、能不能代它落账。
 *
 * 四档 fail-closed,判据全部来自 lib/ticket-artifacts.mjs(本处零复算):
 *  - artifact-manifest-missing  会话没写清单 ⇒ 不提交(合法结果:会话可能只写了注记)
 *  - artifact-manifest-invalid  清单坏/票键不符/空清单/路径不过安全校验 ⇒ 不提交
 *  - artifact-manifest-stale    清单里没有一个文件真有改动 ⇒ 不提交
 *  - artifact-committed         至少一枚真有改动 ⇒ 调 safe-commit 代提交(带票键与席位)
 * dry-run 只出预览(`artifact-preview`),绝不冒充已提交。
 *
 * IO 全部注入:自检要在不碰真 git / 真索引的前提下反向验证每一档。
 */
/**
 * 把一批待落账文件按「是否落在判据面(受保护面)上」分成两堆,并对清单本身的可读性负责。
 *
 * 三态绝不并桶(§0.3):
 *  - clean        一枚都不在判据面上 ⇒ 允许代提交;
 *  - blocked      至少一枚命中 ⇒ 整批不落,逐条点名(不做部分提交,与路径安全那一档同判序);
 *  - undetermined 清单读不到 / JSON 坏 / entries 空 ⇒ **同样整批不落**。"拿不到尺子"不能读成"没有尺子拦我"。
 * 到期条目(reviewBy 已过)仍算判据面:护栏对到期是"把动它的那枚提交判红",不是"把该面解禁"。
 *
 * @param {string[]} files 相对仓根路径
 * @param {string|null} guardListText 清单原文(null ⇒ undetermined)
 */
export function partitionProtectedFaces(files, guardListText) {
  let parsed
  try {
    parsed = parseGuardList(guardListText)
  } catch (e) {
    return { state: 'undetermined', landable: [], protectedHits: [], problems: [{ code: 'parse-throw', message: String(e?.message ?? e) }] }
  }
  const problems = parsed.problems ?? []
  if (problems.length > 0 || !Array.isArray(parsed.entries) || parsed.entries.length === 0) {
    return { state: 'undetermined', landable: [], protectedHits: [], problems }
  }
  const landable = []
  const protectedHits = []
  for (const f of files) {
    const hit = matchProtected(f, parsed.entries)
    if (hit) protectedHits.push({ file: f, path: hit.path, kind: hit.kind ?? '' })
    else landable.push(f)
  }
  return { state: protectedHits.length > 0 ? 'blocked' : 'clean', landable, protectedHits, problems: [] }
}

/** 真出口:清单按当次仓根现读(§0 盘符是现读机器事实)。读失败 ⇒ null ⇒ 上层判未判定。 */
function readGuardListText() {
  try {
    return readFileSync(join(ROOT, GUARD_LIST_REL), 'utf8')
  } catch {
    return null
  }
}

export function landTicketArtifacts({
  ticketKey,
  ticketText,
  manifestText,
  statusFn,
  commitFn,
  dryRun = false,
  protectedFaceOf = (files) => partitionProtectedFaces(files, readGuardListText()),
}) {
  const parsed = parseArtifactManifest(manifestText, ticketKey)
  if (parsed.state !== 'ok') {
    return { action: `artifact-manifest-${parsed.state}`, files: [], dropped: [], why: parsed.why }
  }
  const safe = sanitizeArtifactPaths(parsed.files)
  if (!safe.ok) {
    // 整批不提交:清单自述里出现逃逸/活文档/敏感面 ⇒ 这份自述不可信,不做部分提交。
    return {
      action: 'artifact-manifest-invalid',
      files: [],
      dropped: safe.rejected.map((r) => r.path),
      why: `路径安全校验不过,整批不提交:${safe.rejected.map((r) => `${r.path}(${r.why})`).join('; ')}`,
    }
  }
  const { dirty, stale } = selectDirtyPaths(safe.accepted, statusFn)
  const dropped = stale.map((s) => s.path)
  if (dirty.length === 0) {
    return {
      action: 'artifact-manifest-stale',
      files: [],
      dropped,
      why: `清单里的文件在本工作区都没有改动,不提交:${stale.map((s) => `${s.path}(${s.why})`).join('; ')}`,
    }
  }
  // 判据面闸排在 dry-run **之前**:预演档报的必须就是真跑会走的那一支 —— 否则 dry-run 说"会提交"
  // 而真跑拒落,读数自相矛盾(§0.9 判据要在真跑它的那一刻成立,预演也不许演一支假的)。
  const faces = protectedFaceOf(dirty)
  if (dryRun && faces.state === 'clean') {
    return {
      action: 'artifact-preview',
      files: dirty,
      dropped,
      why: `dry-run 不提交;真跑会调 safe-commit 提交 ${dirty.length} 枚(票键 ${ticketKey}${dropped.length ? `,剔除 ${dropped.length} 枚无改动` : ''})`,
    }
  }
  if (faces.state !== 'clean') {
    // 方向恒定:自治会话手里没有豁免签名权(清单现读 signatureRequiredFrom),替它自己补一行
    // immutable-exempt 理由 = 自己给自己发豁免 ⇒ 唯一合法出路是拦下来点名交人工,绝不是放行。
    return {
      action: 'artifact-protected-face',
      files: dirty,
      dropped,
      protectedHits: faces.protectedHits,
      why:
        faces.state === 'undetermined'
          ? `判据面清单取不到或形状坏(${(faces.problems ?? []).map((p) => p.code).join(',') || 'empty'})⇒ 无法证明本批不碰判据面,整批不落(§0.3)`
          : `本批 ${faces.protectedHits.length} 枚落在判据面上,自治环没有豁免签名权 ⇒ 整批不落,逐条交人工:${faces.protectedHits.map((h) => `${h.file}〔${h.path}〕`).join('; ')}`,
    }
  }
  const env = {
    IHUI_TICKET_KEY: String(ticketKey),
    IHUI_TICKET_LINE: String(ticketText ?? '').slice(0, 120),
    // 席位短名进 AI 归属 notes;缺它 safe-commit 会把本枚判成"无归属",审计链断在这里。
    IHUI_AGENT_SESSION_ID: 'auto-evolve',
  }
  let r
  try {
    r = commitFn({ files: dirty, message: buildArtifactCommitMessage({ ticketKey, ticketText }), env })
  } catch (e) {
    // 并发索引锁/进程起不来都不许把整轮打崩:落 failed 台账,下一轮照常。
    return { action: 'artifact-commit-failed', files: dirty, dropped, why: `代提交抛错(不牵连本轮):${e?.message ?? e}` }
  }
  if (!r || r.ok !== true) {
    return {
      action: 'artifact-commit-failed',
      files: dirty,
      dropped,
      why: `safe-commit 未落地(status=${r?.status ?? '?'}):${String(r?.stderr ?? '').slice(-300) || '(无输出)'}`,
    }
  }
  return { action: 'artifact-committed', files: dirty, dropped, why: `safe-commit 已落地(status=0,票键 ${ticketKey})` }
}

/** 清单现读:读不到(不存在/读失败)一律 null ⇒ 上层落 missing,不猜内容。 */
function readArtifactManifest(ticketKey) {
  try {
    return readFileSync(join(ROOT, manifestPathOf(ticketKey)), 'utf8')
  } catch {
    return null
  }
}

/** 单文件改动现读。抛错上抛给 selectDirtyPaths 判 stale —— 取不到不许读成"有改动"。 */
function gitPorcelainOf(file) {
  const r = spawnSync('git', ['status', '--porcelain', '--', file], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    windowsHide: true,
    timeout: 60_000,
    encoding: 'utf8',
  })
  if (r.error) throw new Error(r.error.message)
  if (r.status !== 0) throw new Error(`git status 退出码 ${r.status}:${String(r.stderr ?? '').slice(-160)}`)
  return String(r.stdout ?? '')
}

/** 真出口:safe-commit 五步法。环境变量只叠加不覆盖,票键/席位显式传入。 */
function runSafeCommit({ files, message, env }) {
  const r = spawnSync(process.execPath, [SAFE_COMMIT, '-m', message, '--', ...files], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    windowsHide: true,
    timeout: 15 * 60_000,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
  return { ok: r.status === 0, status: r.status ?? null, stderr: `${String(r.stderr ?? '')}\n${String(r.stdout ?? '')}` }
}

async function runOnce({ dryRun = false, noDecide = false } = {}) {
  let gates
  try {
    gates = loadGates()
  } catch (e) {
    console.error(`❌ 未判定:${e.message}`)
    process.exitCode = 2
    return
  }
  if (!gates.enabled && !dryRun) {
    console.log('⏸ 调度未启用(gates.enabled=false);观察期请用 --dry-run 巡检。不派发、不记派发账。')
    return
  }
  // ---- O6504 人工阀清单前置读 + O6502 成本熔断前置闸(2026-10-25 立,二者均 fail-closed)----
  // 清单读不到/形状坏 ⇒ exit 2 未判定,绝不回落成"没有人工阀"(§0.3)。
  let humanGates
  let costCaps
  try {
    humanGates = loadHumanGates(readFileSync(HUMAN_GATES_JSON, 'utf8'))
    costCaps = loadCaps(readFileSync(COST_CAPS_JSON, 'utf8'))
  } catch (e) {
    console.error(`❌ 未判定:人工阀/成本配置读不到或形状坏(${e.message})⇒ 本轮不派发`)
    process.exitCode = 2
    return
  }
  if (!dryRun) {
    const costEvents = existsSync(COST_LEDGER) ? parseLedger(readFileSync(COST_LEDGER, 'utf8')) : []
    let cost
    try {
      cost = evaluate({ caps: costCaps, events: costEvents, kind: 'session' })
    } catch (e) {
      console.error(`❌ 未判定:成本熔断判不了(${e.message})⇒ 本轮不派发`)
      process.exitCode = 2
      return
    }
    if (!cost.allowed) {
      const summary = `sessions 近1h=${cost.used.hour} 近24h=${cost.used.day} 墙钟=${cost.used.minutesDay.toFixed(1)}min tokens 近1h=${cost.used.tokensHour} 近24h=${cost.used.tokensDay} 单会话峰值=${cost.used.maxTokens}`
      record({ mode: 'dispatch', action: 'budget-exhausted', note: summary })
      console.log(`⏸ 成本熔断:${cost.breaches.join(';')} ⇒ 本轮停转(软停机)`)
      if (!escapeThrottled()) {
        markEscape()
        sendEscapeMail(gates, 'auto-evolve:cost', '[auto-evolve] 成本熔断停转', `调度层会话额度越限:${cost.breaches.join(';')}(${summary})。停派至窗口回落;放量属人工阀 budget-cap-change,须人改 scripts/data/cost-caps.json。`)
      }
      return
    }
  }
  const gateCounts = summarizeHumanGates(humanGates).counts
  console.log(`🛡 人工阀清单:自决 ${gateCounts.autonomous} 条 / 停机等人 ${gateCounts.gates} 条(命中即安全停机,不重试不绕行)`)
  const lock = acquireLock()
  if (lock.held) {
    console.log(`⏭ 上一轮仍在跑(pid=${lock.pid ?? '?'})⇒ 本轮让路(单实例闸)`)
    return
  }
  try {
    // ---- 派发前闸(2026-11-01 立):执行体不在位 ⇒ 整轮不派,不拿真票去撞 ----
    // 病灶:这条腿 2026-10-25 起在本机死了 6 天(48 轮仅 1 成功),而台账里每一枚失败
    // 都被记成「票失败」并计入连败,3 次即封票 48h —— 调度器自伤却把债摊派给真工作。
    const pf = preflightSessionRunner(gates.sessionCommandTemplate, ROOT)
    if (!dryRun && pf.state !== 'ready' && pf.state !== 'template-empty') {
      record({ mode: 'dispatch', action: `runner-preflight-${pf.state}`, why: pf.why, missing: pf.missing ?? [] })
      console.error(`⛔ 派发前闸未过(state=${pf.state}):${pf.why}${pf.missing?.length ? `｜不在位:${pf.missing.join(', ')}` : ''}`)
      if (!escapeThrottled()) {
        markEscape()
        sendEscapeMail(
          gates,
          'auto-evolve:runner-preflight',
          '[auto-evolve] 自开发发起腿不可用(派发前闸拦停)',
          `判据:scripts/lib/autonomy-runner.mjs preflightSessionRunner\nstate=${pf.state}｜${pf.why}\n逐枚核验:${(pf.checked ?? []).map((c) => `${c.inPlace ? '✓' : '✗'} ${c.token}`).join('\n')}\n出路:改 scripts/data/auto-evolve-gates.json 的 sessionCommandTemplate(仓根写 \${REPO_ROOT} 令牌,别钉盘符),或补齐缺失产物。本轮未派任何票,票面连败计数未受影响。`
        )
      }
      process.exitCode = 2
      return
    }
    const allRows = pickTickets()
    let rows = allRows
    let decisionReadout = '台账序(无候选评估文件)'
    if (!noDecide) {
      const gen = refreshAutonomyCandidates({ dryRun })
      console.log(gen.state === 'ok' ? `🗳 自治决策候选:${gen.why}` : `⏭ 自治决策候选未刷新(${gen.why})⇒ 本轮按台账序`)
    }
    if (!noDecide && existsSync(AUTONOMY_CANDIDATES)) {
      try {
        const ranked = rankTicketRows(allRows, {
          policyText: readFileSync(POLICY_PATH, 'utf8'),
          candidatesText: readFileSync(AUTONOMY_CANDIDATES, 'utf8'),
        })
        rows = ranked.rows
        decisionReadout = `自治决策(${ranked.why})`
        for (const s of ranked.skipped.slice(0, 8)) console.log(`⏭ L${s.line} 不入本轮:${s.reason}`)
        if (ranked.skipped.length > 8) console.log(`⏭ 另有 ${ranked.skipped.length - 8} 枚压后/未评估(见候选文件)`)
      } catch (e) {
        record({
          mode: dryRun ? 'dryrun' : 'dispatch',
          action: 'decision-undetermined',
          why: `自治决策排序不可用:${String(e?.message ?? e).slice(0, 220)}`,
        })
        console.error(`❌ 未判定:自治决策排序不可用(${e?.message ?? e}) ⇒ 本轮不派(不回落成台账序冒充已评估)`)
        process.exitCode = 2
        return
      }
    }
    const ledger = readLedger()
    // ---- 先结算上一轮的"成功",再决定本轮派谁 ----
    // 没有这一环,session-ok 永远只是"会话结束了"而不是"票推进了"(§10 交付一致性)。
    const settled = settlePriorDispatches({ ledger, currentRows: allRows })
    for (const s of settled) {
      record({ mode: 'dispatch', action: 'dispatch-settled', ticketKey: s.ticketKey, ticketLine: s.ticketLine, sourceTs: s.sourceTs, settled: s.state, why: s.why })
      if (s.state === 'no-progress') {
        console.log(`⚠ 结算:票 ${s.ticketKey} 会话自称成功但票行零推进 —— ${s.why}`)
        if (!escapeThrottled()) {
          markEscape()
          sendEscapeMail(gates, 'auto-evolve:no-progress', '[auto-evolve] 有票派出去但零推进(会话"成功"不可信)', `票键:${s.ticketKey}\n票面:${s.ticketLine}\n判据:${s.why}\n这条不是"票失败"(不计连败、不封票),而是"成功判定过松"的凭据。\n出路:核该会话末轮实际做了什么(日志 .ihui-agent/state/auto-evolve-run.log);若它结构上交付不了(自动会话无提交权),这一族就得改判据 —— 派发的合格线要绑"票行推进 + 绑定票键的提交",而不是 CLI 退出码。`)
        }
      }
    }
    // ---- 空转记忆闸(2026-11-04 立;判据单源 scripts/lib/autonomy-nonprogress.mjs,本层零复算 §0.6)----
    // 立因:票 B53 三天吃掉 209 轮台账里的 127 行,session-failed 与 runner-unavailable 交替
    // ⇒ failureStreakOf 的"遇其他 action 即断"每轮把连败清零 ⇒ 封票阈值 3 结构上永远够不着
    // ⇒ 候选序又是固定的 ⇒ 每小时同一枚顶格票重新顶到队首,其余可排期候选零班次。
    // 封票那条轴保留(它管"这张票坏不坏");本轴管"这枚票已经吞了多少班次",两条不互相替换。
    const npHeld = []
    const npLive = []
    for (const ticket of rows) {
      const npKey = ticketKeyOf(ticket.text)
      const attempts = attemptsSinceProgress(ledger, npKey)
      const np = decideNonProgress({
        attempts,
        rotateAt: gates.rotateAfterAttempts,
        parkAt: gates.parkAfterAttempts,
        hardAt: gates.parkHardLimit,
        cooldownHours: gates.parkCooldownHours,
        lastStoodAt: lastNonProgressHoldAt(ledger, npKey),
      })
      if (np.route === 'unjudged') {
        record({ mode: dryRun ? 'dryrun' : 'dispatch', action: 'nonprogress-unjudged', ticketKey: npKey, why: np.why })
        console.error(`❓ 空转记忆未判定(${np.why})⇒ 本轮把这枚挪到队尾,不冒充已判(§0.3)`)
      }
      if (np.route === 'cooldown' || np.route === 'park') npHeld.push({ ticket, key: npKey, np })
      else npLive.push({ ticket, key: npKey, np })
    }
    // 让位 = 空转少的先派(稳定排序,同次数保持决策序);被扣住的整枚出本轮候选面。
    npLive.sort((a, b) => a.np.attempts - b.np.attempts)
    rows = npLive.map((x) => x.ticket)
    for (const { ticket, key, np } of npHeld) {
      const detail = breakdownNonProgress(ledger, key)
        .map((d) => `${d.action}×${d.count}`)
        .join(' ')
      const lastHold = [...ledger].reverse().find((e) => e.ticketKey === key && (e.action === 'non-progress-hold' || e.action === 'non-progress-parked'))
      const isNewEpisode = !lastHold || lastHold.attempts !== np.attempts || lastHold.route !== np.route
      if (isNewEpisode) {
        record({
          mode: 'dispatch',
          action: np.route === 'park' ? 'non-progress-parked' : 'non-progress-hold',
          route: np.route,
          ticketKey: key,
          ticketLine: ticket.text.slice(0, 200),
          attempts: np.attempts,
          detail,
          why: np.why,
        })
        console.log(`⛔ L${ticket.line} ${np.why} ｜ 空转明细:${detail || '(读不到)'}`)
        if (!escapeThrottled()) {
          markEscape()
          sendEscapeMail(
            gates,
            `auto-evolve:nonprogress-${np.route}:${key.slice(0, 8)}`,
            `[auto-evolve] 一枚票连续空转已${np.route === 'park' ? '终局停派' : '进冷却'}`,
            `票:L${ticket.line} ${ticket.text.slice(0, 140)}\n${np.why}\n空转明细(按 action,不含成功):${detail || '(读不到)'}\n` +
              `这不是"再试一轮"能救的:同一枚票已累计 ${np.attempts} 次占班次零推进。出路二选一 ——\n` +
              `  ① 修发起/落账腿(近因见 ${LEDGER} 里该键最后一条 runner-*/session-*/artifact-* 的 why);\n` +
              `  ② 这票本就该人做 ⇒ 把它摘出自动派单面(改标题使白名单不命中,或按「完成即删」结清摘行)。\n` +
              `判据单源 = scripts/lib/autonomy-nonprogress.mjs;档位 = auto-evolve-gates.json 的 rotateAfterAttempts/parkAfterAttempts/parkHardLimit/parkCooldownHours。`,
          )
        }
      }
    }
    let dispatched = 0
    for (const e of ledger) {
      if (e.action === 'dispatched' && String(e.ts ?? '').startsWith(todayKey())) dispatched++
    }
    const summary = `派单面现读 ${allRows.length} 行 / 判期 ${decisionReadout} / 本轮候选 ${rows.length} 行(空转扣住 ${npHeld.length} 行)/ 今日已派 ${dispatched}/${gates.dailyDispatchBudget} 轮`
    if (rows.length === 0) {
      record({ mode: dryRun ? 'dryrun' : 'dispatch', action: npHeld.length ? 'all-held-nonprogress' : 'no-ticket', note: summary })
      console.log(`✅ ${summary} ⇒ ${npHeld.length ? `候选全被空转记忆扣住(非"无票"),本轮结束` : '无票可派,本轮结束'}`)
      return
    }
    if (dispatched >= gates.dailyDispatchBudget) {
      record({ mode: dryRun ? 'dryrun' : 'dispatch', action: 'budget-exhausted', note: summary })
      console.log(`⏸ ${summary} ⇒ 预算耗尽,停派`)
      if (!dryRun && !escapeThrottled()) {
        markEscape()
        sendEscapeMail(gates, 'auto-evolve:budget', '[auto-evolve] 每日派发预算耗尽', `今日已派 ${dispatched} 轮达上限 ${gates.dailyDispatchBudget}。调度器自动停派至明日;若需放量改 auto-evolve-gates.json 的 dailyDispatchBudget。`)
      }
      return
    }
    for (const ticket of rows) {
      const key = ticketKeyOf(ticket.text)
      const qUntil = quarantinedUntilOf(ledger, key)
      if (qUntil) {
        console.log(`⏭ L${ticket.line} 封禁中(至 ${new Date(qUntil).toISOString()})⇒ 跳过`)
        continue
      }
      if (!matchWhitelist(ticket.text, gates.ticketWhitelist)) {
        console.log(`⏭ L${ticket.line} 未命中票类白名单 ⇒ 跳过(第一期保守起步)`)
        continue
      }
      // 人工阀前置闸(2026-11-01 接线)。白名单回答的是"这类票允许自动派吗",
      // 阀清单回答的是"这张票要做的动作需不需要人"。此前第二问结构上不存在 ——
      // classifyAction 在派发路径上零调用,7 条"停机等人"全靠被派起的会话自觉。
      let valveText = ''
      try {
        valveText = readFileSync(VALVE_LIST_JSON, 'utf8')
      } catch {
        valveText = ''
      }
      const valve = gateTicketByHumanValve({ ticketText: ticket.text, mode: gates.humanValveMode, valveListText: valveText })
      const valveRoute = decideValveDispatch(valve, gates.humanValveMode, { ticketKey: key, ticketLine: ticket.text.slice(0, 160) })
      record({ mode: dryRun ? 'dryrun' : 'dispatch', ...valveRoute.ledger })
      if (valveRoute.route === 'block') {
        console.log(`⛔ L${ticket.line} 命中人工阀「${valve.ruleId}」⇒ enforce 档不派(不重试、不绕行)`)
        if (!escapeThrottled()) {
          markEscape()
          sendEscapeMail(gates, `auto-evolve:valve:${valve.ruleId}`, '[auto-evolve] 有票命中人工阀,已停派等人', `票:L${ticket.line} ${ticket.text.slice(0, 140)}\n命中规则:${valve.ruleId}\n判据:${valve.reason}\n出路:这一条按清单归机主面(scripts/data/human-valve-list.json),由人执行;或由人把它摘出自动派单面。`)
        }
        continue
      }
      if (valveRoute.route === 'stop-round') {
        record({ mode: 'dispatch', action: 'valve-unjudged-block', ticketKey: key, why: valve.reason })
        console.error(`❌ 未判定:${valve.reason} ⇒ enforce 档 fail-closed,本轮停派`)
        process.exitCode = 2
        return
      }
      if (valveRoute.route === 'skip-observe-stop') {
        // 2026-11-03 改档(用户授权):这条原先是"只记账、仍照派",现在停机不派。
        // 台账动作名保持 valve-observe-stop,并带 dispatched:false 区分"阀判停机但其实派出去了"的旧行。
        console.log(`👁 L${ticket.line} valve-observe-stop(skip) 命中停机类「${valve.ruleId}」⇒ observe 档停机不派(不再照派白烧会话额度)`)
        continue
      }
      if (dispatched >= gates.dailyDispatchBudget) {
        console.log(`⏸ 预算耗尽(本轮中)⇒ 停派`)
        break
      }
      console.log(`→ L${ticket.line} 命中白名单,进入派发闸`)
      if (!dryRun) {
        const mint = await mintSessionCredential()
        if (!mint.ok) {
          record({ mode: 'dispatch', action: 'mint-failed', ticketKey: key, ticketLine: ticket.text.slice(0, 200), why: mint.why })
          console.error(`❌ 未判定:${mint.why} ⇒ 本轮不派发(凭据供值失败,不冒充执行)`)
          process.exitCode = 2
          return
        }
      }
      const res = dispatchSession(gates, ticket, dryRun)
      record({ mode: dryRun ? 'dryrun' : 'dispatch', action: res.action, ticketKey: key, ticketLine: ticket.text.slice(0, 200), exitCode: res.exitCode ?? null, stopReason: res.stopReason ?? null, durationMs: res.durationMs ?? null, tokens: res.tokens ?? null, tokensMeasured: res.tokensMeasured === true, costUsd: res.costUsd ?? null, transcript: res.transcript ?? null, why: res.why ?? '' })
      // O6502 记账腿:只有真派(非 dry-run)且拿到墙钟才进账;记不进去就如实告警,不冒充"额度还够"。
      // 第 3 期④:量到 token 就一并记账(单会话闸 + 24 小时闸的取数口);量不到只记墙钟并留响声。
      if (!dryRun && Number.isFinite(res.durationMs) && res.durationMs > 0) {
        try {
          mkdirSync(dirname(COST_LEDGER), { recursive: true })
          appendFileSync(
            COST_LEDGER,
            chargeLine({
              kind: 'session',
              minutes: Number((res.durationMs / 60000).toFixed(2)),
              tokens: res.tokensMeasured === true ? res.tokens : undefined,
              note: `auto-evolve ${res.action}`,
            }),
            'utf8'
          )
        } catch (e) {
          console.error(`⚠ 成本记账失败(本轮照常收尾,但下一轮判据可能偏松):${e.message}`)
        }
        if (res.tokensMeasured !== true) {
          console.error('⚠ token 计量未判定(终态行无 usage:超时/被杀/非 json 通路)⇒ 本轮只记墙钟,不虚记 token 额度')
        }
      }
      if (res.action === 'template-empty') {
        console.log(`ℹ ${res.why}`)
        return
      }
      if (dryRun) {
        // dry-run 不派会话,但落账腿仍要"演练一遍":有残留清单就现读并打印会提交什么,
        // 让巡检能提前看见"真跑会不会提交/会不会被判 stale",而不是等真跑才发现清单写歪了。
        const preview = landTicketArtifacts({
          ticketKey: key,
          ticketText: ticket.text,
          manifestText: readArtifactManifest(key),
          statusFn: gitPorcelainOf,
          commitFn: runSafeCommit,
          dryRun: true,
        })
        record({ mode: 'dryrun', action: preview.action, ticketKey: key, files: preview.files, dropped: preview.dropped, why: preview.why })
        console.log(`🧪 dry-run 落账预览(${preview.action}):${preview.why}`)
        if (preview.files.length) console.log(`   会提交:${preview.files.join(', ')}`)
        console.log(`✅ dry-run 记账完成(不真派)`)
        return
      }
      dispatched++
      // ---- 故障分型(2026-11-01 立):发起腿级失败 ≠ 票面失败 ----
      // 环境级(ERR_MODULE_NOT_FOUND/ENOENT/路径不存在)是调度器自己的腿断了:
      // 计进票连败 = 每换一次机就把整张派单面逐枚封禁 48h,而真因一行也没被点名。
      if (isNonTicketFailure(res.failureKind) || res.action === 'runner-undetermined') {
        record({ mode: 'dispatch', action: 'runner-unavailable', ticketKey: key, ticketLine: ticket.text.slice(0, 200), why: res.why })
        console.error(`⛔ 发起腿故障(分型=${res.failureKind ?? res.action},不计票连败、不封票):${res.why}`)
        if (!escapeThrottled()) {
          markEscape()
          sendEscapeMail(gates, `auto-evolve:runner-${res.failureKind ?? 'undetermined'}`, `[auto-evolve] 起会话失败已分型为调度器侧(${res.failureKind ?? res.action}),已停派本轮`, `票面(未被计入连败):L${ticket.line} ${ticket.text.slice(0, 120)}\n分型:${res.failureKind ?? res.action}｜${res.why}\n出路:核 scripts/data/auto-evolve-gates.json 的 sessionCommandTemplate 与 CLI 产物是否在位;本器判据 = scripts/lib/autonomy-runner.mjs。`)
        }
        process.exitCode = 2
        return
      }
      if (res.action === 'session-failed' || res.action === 'session-timeout') {
        const streak = failureStreakOf(readLedger(), key)
        if (streak >= gates.failureStreakLimit) {
          const until = new Date(Date.now() + gates.quarantineHours * 3600_000).toISOString()
          record({ mode: 'dispatch', action: 'quarantined', ticketKey: key, ticketLine: ticket.text.slice(0, 200), until, why: `连败 ${streak} 次(阈值 ${gates.failureStreakLimit})` })
          console.log(`⛔ 同票连败 ${streak} 次 ⇒ 封禁至 ${until}`)
          if (!escapeThrottled()) {
            markEscape()
            sendEscapeMail(gates, `auto-evolve:quarantine:${key.slice(0, 8)}`, '[auto-evolve] 票被自动封禁', `票:L${ticket.line} ${ticket.text.slice(0, 120)}\n连败 ${streak} 次(阈值 ${gates.failureStreakLimit}),自动封禁至 ${until}。封禁明细与连败原因见 ${LEDGER};解封等 until 到期或人工摘除 quarantined 行。`)
          }
        }
        return
      }
      console.log(`✅ 派发完成(action=${res.action},耗时 ${(res.durationMs / 1000).toFixed(1)}s)`)
      // ---- 会话后落账腿(2026-11-01 立)----
      // 会话退出码 0 只说明"它结束了";能不能落账要看它自己写的清单。这一步失败不许把整轮打崩:
      // 并发索引锁是常态,记 artifact-commit-failed 就够,下一轮还会再来。
      const landed = landTicketArtifacts({
        ticketKey: key,
        ticketText: ticket.text,
        manifestText: readArtifactManifest(key),
        statusFn: gitPorcelainOf,
        commitFn: runSafeCommit,
        dryRun: false,
      })
      record({ mode: 'dispatch', action: landed.action, ticketKey: key, ticketLine: ticket.text.slice(0, 200), files: landed.files, dropped: landed.dropped, why: landed.why })
      if (landed.action === 'artifact-committed') {
        console.log(`✅ 落账:代提交 ${landed.files.length} 枚 —— ${landed.files.join(', ')}${landed.dropped.length ? `(剔除无改动 ${landed.dropped.length} 枚)` : ''}`)
      } else if (landed.action === 'artifact-commit-failed') {
        console.error(`⚠ 落账未落地(${landed.action}):${landed.why} ⇒ 本轮照常收尾,下一轮重试`)
      } else {
        console.log(`ℹ 落账:${landed.action} —— ${landed.why}`)
      }
      return
    }
    console.log('ℹ 候选行全部未命中白名单或在封 ⇒ 本轮无派发')
    record({ mode: dryRun ? 'dryrun' : 'dispatch', action: 'no-whitelist-hit', note: summary })
  } finally {
    releaseLock()
  }
}

/**
 * 通路自检(--probe):不经取票,起一个只读会话跑内置自检并要求原样报告末行。
 * 判据 = CLI stdout 含 `"stopReason":"end_turn"`(事件流终态),不猜、不把超时/报错读成通过。
 * 这是调度器的健康信号:enabled=true 后每轮派发前置一个 probe,probe 不过 ⇒ 不派真票。
 */
async function probeSession({ gates, dryRun = false } = {}) {
  const lock = acquireLock()
  if (lock.held) {
    console.log(`⏭ 上一轮仍在跑(pid=${lock.pid ?? '?'})⇒ probe 让路`)
    return
  }
  try {
    const mint = dryRun ? { ok: true } : await mintSessionCredential()
    if (!mint.ok) {
      record({ mode: 'probe', action: 'probe-fail', why: `凭据供值失败:${mint.why}` })
      console.error(`❌ 未判定:${mint.why}`)
      process.exitCode = 2
      return
    }
    mkdirSync(TMP_DIR, { recursive: true })
    const promptFile = join(TMP_DIR, `probe-${Date.now()}.md`)
    const promptText = [
      '只读自检任务(禁止创建或修改任何文件;禁止运行任何命令——本会话无审批人,run_command 等需确认的操作会被拒绝,被拒也不要重试):',
      '',
      '用 read_file 读取 scripts/lib/session-transcript.mjs 的第 1~30 行,',
      '然后原样报告其中以 `export const TRANSCRIPT_DIR` 开头的那一行(逐字,不要改写)。',
    ].join('\n')
    writeFileSync(promptFile, promptText, 'utf8')
    const resolvedProbe = resolveSessionCommand(gates.sessionCommandTemplate, ROOT)
    if (resolvedProbe === null) {
      record({ mode: 'probe', action: 'probe-undetermined', why: '当次仓根取不到 ⇒ 模板无法归一,不冒充已探测' })
      console.error('❌ 未判定:当次仓根取不到 ⇒ probe 不做(不回落原模板)')
      process.exitCode = 2
      return
    }
    const cmd = fillTemplate(resolvedProbe, { promptFile, ticketLine: 'probe 自检', ticketKey: 'probe' })
    const t0 = Date.now()
    // windowsVerbatimArguments 必带:node 对 cmd.exe 有默认引用改写,会把模板里的引号拼进
    // 模块路径(实测 'D:\IHUI-AI\"D:\...\"' 型报错);verbatim + 模板零内嵌引号 = 双保险
    const r = spawnSync('cmd.exe', ['/d', '/s', '/c', cmd], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: ROOT,
      windowsHide: true,
      windowsVerbatimArguments: true,
      timeout: gates.maxSessionMinutes * 60_000,
      encoding: 'utf8',
    })
    try {
      unlinkSync(promptFile)
    } catch {
      /* 用完即删 */
    }
    const durationMs = Date.now() - t0
    // 2026-11-01 改判:旧 probe 派「跑 --self-test」,但 run_command 对任意 node 脚本判
    // autoApprovable:false,headless(无审批人)被正确拒签 ⇒ 模型空手重试 3 次 ⇒ DOOM_LOOP 击杀
    // (transcript 20261101T151837251-probe-probe-probe-fail 实证)。probe 的职责是验「起会话通路」,
    // 不是验「能跑危险命令」——后者是自动会话的结构性边界(A7 维已登记)。改为确定性只读校验:
    // read_file 在 headless 下自动放行,回显行是机器可判的固定标记,弱模型也无发挥空间。
    const passed = r.status === 0 && String(r.stdout ?? '').includes('"stopReason":"end_turn"') && String(r.stdout ?? '').includes('export const TRANSCRIPT_DIR')
    // 第 4 格·会话全文落盘:probe 同样要留证据(它跑通说明通路健康,跑挂说明哪一步断)。
    const transcript = persistTranscript({
      mode: 'probe',
      ticketKey: 'probe',
      ticketLine: 'probe 自检',
      cmd,
      action: passed ? 'probe-ok' : 'probe-fail',
      exitCode: r.status ?? null,
      durationMs,
      prompt: promptText,
      stdout: r.stdout ?? '',
      stderr: r.stderr ?? '',
      at: t0,
    })
    record({ mode: 'probe', action: passed ? 'probe-ok' : 'probe-fail', exitCode: r.status ?? null, durationMs, transcript, why: passed ? '' : `status=${r.status} stdout 尾部=${String(r.stdout ?? '').slice(-160)}` })
    console.log(passed ? `✅ probe 通过(${(durationMs / 1000).toFixed(1)}s)⇒ 起会话通路健康` : `❌ probe 未通过(status=${r.status})⇒ 记台账 probe-fail`)
    if (!passed) process.exitCode = 1
  } finally {
    releaseLock()
  }
}

function printStatus() {
  let gates
  try {
    gates = loadGates()
  } catch (e) {
    console.error(`❌ 未判定:${e.message}`)
    process.exitCode = 2
    return
  }
  const ledger = readLedger()
  const today = todayKey()
  const dispatched = ledger.filter((e) => e.action === 'dispatched' && String(e.ts ?? '').startsWith(today)).length
  const quarantined = []
  for (const e of ledger) {
    if (e.action !== 'quarantined') continue
    const until = Date.parse(e.until)
    if (Number.isFinite(until) && until > Date.now()) quarantined.push({ key: e.ticketKey, until: e.until, line: e.ticketLine })
  }
  console.log(`闸门:enabled=${gates.enabled} 预算 ${dispatched}/${gates.dailyDispatchBudget} 轮(今日) 连败阈值 ${gates.failureStreakLimit} 封禁 ${gates.quarantineHours}h 会话上限 ${gates.maxSessionMinutes}min`)
  const pfStatus = preflightSessionRunner(gates.sessionCommandTemplate, ROOT)
  const pfReadout =
    pfStatus.state === 'ready'
      ? `在位核验 ${pfStatus.checked.length} 枚全通过 ⇒ 可派`
      : pfStatus.state === 'template-empty'
        ? '未配置(空 ⇒ 只 dry-run,不冒充执行)'
        : `state=${pfStatus.state}:${pfStatus.why}${pfStatus.missing?.length ? `｜不在位 ${pfStatus.missing.join(', ')}` : ''} ⇒ 本轮会被派发前闸拦停`
  console.log(`起会话通路:${gates.sessionCommandTemplate.trim() ? '已配置;' : ''}${pfReadout}`)
  console.log(`白名单(${gates.ticketWhitelist.length}):${gates.ticketWhitelist.join(' / ')}`)
  // O6504 / O6502 现读:调度层真的把这两份清单读进来了,而不是只写在文档里。
  try {
    const hg = summarizeHumanGates(loadHumanGates(readFileSync(HUMAN_GATES_JSON, 'utf8')))
    console.log(`人工阀:自决 ${hg.counts.autonomous} 条 / 停机等人 ${hg.counts.gates} 条(${hg.gates.map((g) => g.id).join(' / ')})`)
  } catch (e) {
    console.log(`人工阀:❌ 未判定(${e.message})`)
  }
  try {
    const caps = loadCaps(readFileSync(COST_CAPS_JSON, 'utf8'))
    const events = existsSync(COST_LEDGER) ? parseLedger(readFileSync(COST_LEDGER, 'utf8')) : []
    const c = evaluate({ caps, events, kind: 'session' })
    console.log(`成本熔断(session):近1h ${c.used.hour}/${c.caps.perHour ?? '-'} 次 近24h ${c.used.day}/${c.caps.perDay ?? '-'} 次 墙钟 ${c.used.minutesDay.toFixed(1)}/${c.caps.minutesPerDay ?? '-'} 分钟 tokens 近1h ${c.used.tokensHour}/${c.caps.tokensPerHour ?? '-'} 近24h ${c.used.tokensDay}/${c.caps.tokensPerDay ?? '-'} 单会话峰值 ${c.used.maxTokens}/${c.caps.tokensPerSession ?? '-'} ⇒ ${c.allowed ? '放行' : '停转'}`)
  } catch (e) {
    console.log(`成本熔断:❌ 未判定(${e.message})`)
  }
  console.log(`当前封票:${quarantined.length === 0 ? '无' : ''}`)
  for (const q of quarantined) console.log(`  - ${q.key} 至 ${q.until} :: ${q.line}`)
  console.log(`台账最近 5 条:`)
  for (const e of ledger.slice(-5)) console.log(`  ${e.ts} ${e.mode}/${e.action}${e.why ? ` :: ${e.why}` : ''}`)
}

/**
 * 计划任务注册(--install-task [--apply])。
 *
 * 本机实测四条通道的结论(2026-10-25,全部现跑取值):
 *  ① schtasks.exe 在 ZCode 宿主程序黑名单(spawn 它会带走本进程)——死路;
 *  ② ScheduledTasks cmdlet 模块本机整体缺失(System32\Modules 与 pwsh7\Modules 均无)——死路;
 *  ③ Schedule.Service COM + **S4U LogonType(5)**:pwsh7 与 5.1 同报 "(49,4):Task:"(80041318),
 *     UserId 换 SID / DOMAIN\user 两形态都一样 ⇒ S4U 在本机 COM 通道死路;
 *  ④ Schedule.Service COM + **InteractiveToken(3)**:✅ 成功(STATE=3 READY 回读验证)。
 * 差异只有 LogonType ⇒ 器物定档 InteractiveToken:任务跑在交互会话(用户不登录则不跑,
 * 本机为常登工作站可接受),窗口风险由派生进程 windowsHide 全覆盖顶住。
 * 差异化教训:别把"S4U 是 guardian 的正确形态"当成"本机 S4U 可用"——同一 COM 接口,
 * LogonType 一格之差就是成与败,凡机器事实按当次实测取值(§0)。
 * 幂等:RegisterTaskDefinition flag 6 = TASK_CREATE_OR_UPDATE,重复执行安全。
 */
function buildInstallTaskPs1() {
  const BS = String.fromCharCode(92)
  return [
    '$ErrorActionPreference = "Stop"',
    '$svc = New-Object -ComObject Schedule.Service',
    '$svc.Connect()',
    '$folder = $svc.GetFolder("\\")',
    '$def = $svc.NewTask(0)',
    '$trig = $def.Triggers.Create(9)',
    '$trig.StartBoundary = (Get-Date).AddMinutes(10).ToString("yyyy-MM-ddTHH:mm:ss")',
    '$trig.Repetition.Interval = "PT1H"',
    '$trig.Repetition.Duration = "P3650D"',
    '$trig.Enabled = $true',
    '$act = $def.Actions.Create(0)',
    `$act.Path = "node.exe"`,
    `$act.Arguments = "scripts/auto-evolve.mjs --once"`,
    `$act.WorkingDirectory = "${ROOT.replace(/\//g, BS)}"`,
    `$def.Principal.UserId = "${[process.env.USERDOMAIN ?? '', process.env.USERNAME ?? ''].join(BS)}"`,
    '$def.Principal.LogonType = 3',
    '$folder.RegisterTaskDefinition("IHUI-AI auto-evolve", $def, 6, $null, $null, 3) | Out-Null',
    '$t = $folder.GetTask("IHUI-AI auto-evolve")',
    'Write-Output ("STATE=" + $t.State + " INTERVAL=" + $t.Definition.Triggers.Item(1).Repetition.Interval + " CMD=" + $t.Definition.Actions.Item(1).Arguments)',
  ].join('\r\n')
}

function installTask({ apply = false } = {}) {
  mkdirSync(TMP_DIR, { recursive: true })
  const ps1 = join(TMP_DIR, 'register-auto-evolve-task.ps1')
  writeFileSync(ps1, buildInstallTaskPs1(), 'utf8')
  if (!apply) {
    console.log(`注册脚本已生成:${ps1}(InteractiveToken 档,每小时;--apply 执行真注册)`)
    return
  }
  const PS51 = 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'
  if (!existsSync(PS51)) {
    console.error('❌ 未判定:Windows PowerShell 5.1 不在位(注册通道的唯一可用宿主)')
    process.exitCode = 2
    return
  }
  const r = spawnSync(PS51, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ps1], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    windowsHide: true,
    timeout: 90_000,
    encoding: 'utf8',
  })
  const out = String(r.stdout ?? '')
  if (r.status === 0 && /STATE=3\s+INTERVAL=PT1H/.test(out)) {
    console.log(`✅ 计划任务已注册(IHUI-AI auto-evolve,每小时,InteractiveToken):${out.trim()}`)
    record({ mode: 'install', action: 'task-registered', why: out.trim() })
  } else {
    console.error(`❌ 注册未判定(status=${r.status}):${(String(r.stderr ?? '')).slice(-200) || out.slice(-200)}`)
    process.exitCode = 2
  }
}

function selfTest() {
  let failed = 0
  const ok = (name, cond) => {
    if (cond) console.log(`  ✅ ${name}`)
    else {
      console.error(`  ❌ ${name}`)
      failed++
    }
  }
  console.log('self-test:')
  // S1 形状锁(成对:好配置过 / 坏配置抛)
  ok('S1a 形状锁:合法配置通过', (() => { try { return loadGates(() => JSON.stringify({ enabled: false, dailyDispatchBudget: 6, failureStreakLimit: 3, quarantineHours: 48, maxSessionMinutes: 45, sessionCommandTemplate: '', ticketWhitelist: ['readme'] })).enabled === false } catch { return false } })())
  ok('S1b 形状锁:缺白名单抛 GateShapeError', (() => { try { loadGates(() => '{}'); return false } catch (e) { return e instanceof GateShapeError } })())
  ok('S1c 形状锁:非法 JSON 抛 GateShapeError', (() => { try { loadGates(() => 'not-json'); return false } catch (e) { return e instanceof GateShapeError } })())
  ok('S1d 形状锁:failureStreakLimit=1 拒(首败即封误伤)', (() => { try { loadGates(() => JSON.stringify({ enabled: true, dailyDispatchBudget: 1, failureStreakLimit: 1, quarantineHours: 1, maxSessionMinutes: 1, sessionCommandTemplate: '', ticketWhitelist: ['x'] })); return false } catch { return true } })())
  // S2 白名单
  ok('S2a 白名单命中(标题区)', matchWhitelist('**README 数字收尾** 同步四语', ['readme']) === true)
  ok('S2b 白名单不命中(标题无关)', matchWhitelist('**重构鉴权中间件** 参考 readme 格式', ['readme', '文档']) === false, )
  ok('S2c 白名单只看标题不进正文(实测缺口回归)', matchWhitelist('**第 3 期·进化回流**:失败票归因沉淀;pnpm 依赖升级自动生成票', ['依赖升级']) === false)
  ok('S2d 无加粗段回落前 60 字', matchWhitelist('- [ ] 补 README 数字对齐说明,其余正文很长很长很长很长很长很长', ['readme']) === true)
  // S3 票键与连败
  const k1 = ticketKeyOf('- [ ] 修 README 数字 〔注记〕')
  const k2 = ticketKeyOf('修 README 数字')
  ok('S3a 票键跨前缀/注记等值', k1 === k2 && k1.length === 16)
  const streakLedger = [
    { ticketKey: 'k', action: 'dispatched' },
    { ticketKey: 'k', action: 'session-failed' },
    { ticketKey: 'other', action: 'session-failed' },
    { ticketKey: 'k', action: 'session-failed' },
  ]
  ok('S3b 连败计数(其他票不打断, dispatched 打断)', failureStreakOf(streakLedger, 'k') === 2)
  ok('S3c 封票未到期判出', (() => { const until = new Date(Date.now() + 3600_000).toISOString(); return quarantinedUntilOf([{ ticketKey: 'k', action: 'quarantined', until }], 'k') !== null })())
  ok('S3d 封票已到期不拦', quarantinedUntilOf([{ ticketKey: 'k', action: 'quarantined', until: new Date(Date.now() - 1000).toISOString() }], 'k') === null)
  // S4 模板
  ok('S4 模板填充', fillTemplate('run --prompt {promptFile} --ticket {ticketKey}', { promptFile: 'a.md', ticketKey: 'kk' }) === 'run --prompt a.md --ticket kk')
  // S5 派单面解析(元信息行忽略)
  const sample = ['── 剔除统计 ──', '  --exclude-inflight:暂移 7 行 ⇒ 出单 2 行 —— L7616 / L7644', '── 7 行(判定面:HEAD blob)──', '  L7626  - [ ] 补号', '  L7643  - [ ] `--allow-dangerous` 确认旁路仍在调用方。'].join('\n')
  const parsed = parseTicketRows(sample)
  ok('S5 解析器:只取判定面 L 行', parsed.length === 2 && parsed[0].line === 7626 && parsed[1].text.includes('allow-dangerous'))
  // S6 锁判活
  ok('S6 pid 判活:自身活 / 不存在者死', isPidAlive(process.pid) === true && isPidAlive(999999999) === false)
  // S7 取票唯一入口形状(源码级:第二份拼装即 §22c 反面)
  ok('S7 取票唯一入口 = plan-tasks + 三旗', PLAN_TASKS.endsWith('plan-tasks.mjs') && DISPATCH_ARGS.join(' ') === '--open --dispatchable --exclude-inflight')
  // S8 token 计量取数(第 3 期④):终态 complete 行的 usage 是唯一取数口,缺失/形状坏一律未判定
  const complete = '{"type":"complete","stopReason":"end_turn","usage":{"promptTokens":900,"completionTokens":100,"totalTokens":1000,"estimatedCostUsd":0.12}}'
  const u1 = parseSessionUsage(`{"type":"start","prompt":"x"}\n${complete}\n`)
  ok('S8a complete 行 usage → tokens/成本', u1.measured === true && u1.tokens === 1000 && u1.costUsd === 0.12)
  ok('S8b 无 complete 行(超时/被杀)→ 未计量', parseSessionUsage('{"type":"message_delta","text":"x"}').measured === false)
  ok('S9a 结算:票已从派单面消失 ⇒ line-gone(结清摘行算推进)', (() => {
    const led = [{ action: 'session-ok', ticketKey: 'kk', ts: '2026-10-31T05:00:00.000Z', ticketLine: 'B1 原文' }]
    const r = settlePriorDispatches({ ledger: led, currentRows: [], now: Date.parse('2026-11-01T05:00:00.000Z') })
    return r.length === 1 && r[0].state === 'line-gone'
  })())
  ok('S9b 结算:票行逐字未变 ⇒ no-progress(会话自称成功也不算推进)', (() => {
    const text = 'B2 **同一张票** 一字未动'
    const led = [{ action: 'session-ok', ticketKey: ticketKeyOf(text), ts: '2026-10-31T05:00:00.000Z', ticketLine: text }]
    const r = settlePriorDispatches({ ledger: led, currentRows: [{ text, line: 9 }], now: Date.parse('2026-11-01T05:00:00.000Z') })
    return r.length === 1 && r[0].state === 'no-progress'
  })())
  ok('S9c 结算:票行被改写(加注记/翻勾)⇒ line-changed', (() => {
    const then = 'B3 **原票面** 前缀一致的部分'
    const now2 = 'B3 **原票面** 前缀一致的部分 —— 已追加进展注记'
    const led = [{ action: 'session-ok', ticketKey: ticketKeyOf(then), ts: '2026-10-31T05:00:00.000Z', ticketLine: then }]
    const r = settlePriorDispatches({ ledger: led, currentRows: [{ text: now2, line: 3 }], now: Date.parse('2026-11-01T05:00:00.000Z') })
    return r.length === 1 && r[0].state === 'line-changed'
  })())
  ok('S9d 派单面取不到 ⇒ unjudged,不猜成"没推进"也不猜成"推进了"', (() => {
    const led = [{ action: 'session-ok', ticketKey: 'k4', ts: '2026-10-31T05:00:00.000Z', ticketLine: 'B4' }]
    const r = settlePriorDispatches({ ledger: led, currentRows: null, now: Date.parse('2026-11-01T05:00:00.000Z') })
    return r.length === 1 && r[0].state === 'unjudged'
  })())
  ok('S9e 已结算的成功不重复结算(结算腿每轮都跑也不该把同一枚记两次)', (() => {
    const led = [
      { action: 'session-ok', ticketKey: 'k5', ts: '2026-10-31T05:00:00.000Z', ticketLine: 'B5' },
      { action: 'dispatch-settled', ticketKey: 'k5', sourceTs: '2026-10-31T05:00:00.000Z', settled: 'line-gone' },
    ]
    return settlePriorDispatches({ ledger: led, currentRows: [], now: Date.parse('2026-11-01T05:00:00.000Z') }).length === 0
  })())
  ok('S9g 反向锁:票键随尾部注记漂移但行首同源 ⇒ line-changed(不得冒充"结清摘行")', (() => {
    const then = 'B12 **注记漂移试验** 原文'
    const now2 = then + ' —— 会话只追加了一句进展'
    const led = [{ action: 'session-ok', ticketKey: ticketKeyOf(then), ts: '2026-10-31T05:00:00.000Z', ticketLine: then }]
    const r = settlePriorDispatches({ ledger: led, currentRows: [{ text: now2, line: 12 }], now: Date.parse('2026-11-01T05:00:00.000Z') })
    return ticketKeyOf(then) !== ticketKeyOf(now2) && r.length === 1 && r[0].state === 'line-changed'
  })())
  ok('S9f 窗口语义仍可用:显式传 windowHours 时超窗的成功不进结算', (() => {
    const led = [{ action: 'session-ok', ticketKey: 'k6', ts: '2026-10-01T05:00:00.000Z', ticketLine: 'B6' }]
    return settlePriorDispatches({ ledger: led, currentRows: [], windowHours: 48, now: Date.parse('2026-11-01T05:00:00.000Z') }).length === 0
  })())
  ok('S9h 默认不限窗口 ⇒ 超窗的成功也结清(否则悬案永久化,尺子 A7 结构上恒红)', (() => {
    const led = [{ action: 'session-ok', ticketKey: 'k6', ts: '2026-10-01T05:00:00.000Z', ticketLine: 'B6' }]
    return settlePriorDispatches({ ledger: led, currentRows: [], now: Date.parse('2026-11-01T05:00:00.000Z') }).length === 1
  })())
  ok('S8c usage 形状坏 → 未计量(不读成 0 tokens 放行)', parseSessionUsage('{"type":"complete","usage":{"totalTokens":"NaN"}}').measured === false)
  // S10 会话后落账腿(2026-11-01 立):四档 fail-closed + 代提交带票键。
  // 判据全部 import 自 lib/ticket-artifacts.mjs,本处只验"编排有没有按档处置"。
  const commitSpy = () => {
    const calls = []
    return {
      calls,
      fn: (arg) => {
        calls.push(arg)
        return { ok: true, status: 0, stderr: '' }
      },
    }
  }
  const manifestOf = (files, key = 'k10') => JSON.stringify({ ticketKey: key, files })
  ok('S10a 清单缺失 ⇒ missing 档,一次提交都不调', (() => {
    const spy = commitSpy()
    const r = landTicketArtifacts({ ticketKey: 'k10', ticketText: '某票', manifestText: null, statusFn: () => ' M x', commitFn: spy.fn })
    return r.action === 'artifact-manifest-missing' && spy.calls.length === 0
  })())
  ok('S10b 清单 JSON 坏 ⇒ invalid,不提交', (() => {
    const spy = commitSpy()
    const r = landTicketArtifacts({ ticketKey: 'k10', ticketText: '某票', manifestText: '{"ticketKey":"k10",', statusFn: () => ' M x', commitFn: spy.fn })
    return r.action === 'artifact-manifest-invalid' && spy.calls.length === 0
  })())
  ok('S10c 清单票键不匹配 ⇒ invalid(上一轮的清单不许记到这张票头上)', (() => {
    const spy = commitSpy()
    const r = landTicketArtifacts({ ticketKey: 'k10', ticketText: '某票', manifestText: manifestOf(['scripts/a.mjs'], 'other'), statusFn: () => ' M x', commitFn: spy.fn })
    return r.action === 'artifact-manifest-invalid' && spy.calls.length === 0
  })())
  ok('S10d files 空数组 ⇒ invalid(写了空清单也算 invalid,不读成"没改")', (() => {
    const spy = commitSpy()
    const r = landTicketArtifacts({ ticketKey: 'k10', ticketText: '某票', manifestText: manifestOf([]), statusFn: () => ' M x', commitFn: spy.fn })
    return r.action === 'artifact-manifest-invalid' && spy.calls.length === 0
  })())
  ok('S10e 路径逃逸(../x、D:/x、/abs/x)⇒ 整批拒绝,不做部分提交', (() => {
    const spy = commitSpy()
    const r = landTicketArtifacts({ ticketKey: 'k10', ticketText: '某票', manifestText: manifestOf(['scripts/a.mjs', '../x', 'D:/x', '/abs/x']), statusFn: () => ' M x', commitFn: spy.fn })
    return r.action === 'artifact-manifest-invalid' && spy.calls.length === 0 && r.dropped.length === 3
  })())
  ok('S10f 清单含 PROJECT_PLAN.md ⇒ 整批拒绝(活文档并发冲突)', (() => {
    const spy = commitSpy()
    const r = landTicketArtifacts({ ticketKey: 'k10', ticketText: '某票', manifestText: manifestOf(['scripts/a.mjs', 'PROJECT_PLAN.md']), statusFn: () => ' M x', commitFn: spy.fn })
    return r.action === 'artifact-manifest-invalid' && spy.calls.length === 0 && r.dropped.includes('PROJECT_PLAN.md')
  })())
  ok('S10g 清单文件全无改动 ⇒ stale,不提交', (() => {
    const spy = commitSpy()
    const r = landTicketArtifacts({ ticketKey: 'k10', ticketText: '某票', manifestText: manifestOf(['scripts/a.mjs']), statusFn: () => '', commitFn: spy.fn })
    return r.action === 'artifact-manifest-stale' && spy.calls.length === 0 && r.dropped[0] === 'scripts/a.mjs'
  })())
  ok('S10h 有效清单 ⇒ 调提交且 env 带票键/席位,消息点名票键与票面', (() => {
    const spy = commitSpy()
    const face = '修复 **落账腿** 结构断点'
    const r = landTicketArtifacts({
      ticketKey: 'k10',
      ticketText: face,
      manifestText: manifestOf(['scripts/a.mjs', 'scripts/b.mjs']),
      statusFn: (p) => (p === 'scripts/a.mjs' ? ' M scripts/a.mjs' : ''),
      commitFn: spy.fn,
    })
    const call = spy.calls[0] ?? {}
    return (
      r.action === 'artifact-committed' &&
      r.files.length === 1 &&
      r.dropped.length === 1 &&
      call.env?.IHUI_TICKET_KEY === 'k10' &&
      call.env?.IHUI_AGENT_SESSION_ID === 'auto-evolve' &&
      /^(feat|fix|chore): /.test(String(call.message ?? '')) &&
      String(call.message ?? '').includes('k10') &&
      String(call.message ?? '').includes(face)
    )
  })())
  ok('S10i 提交抛错(并发索引锁)⇒ artifact-commit-failed,不把整轮打崩', (() => {
    const r = landTicketArtifacts({
      ticketKey: 'k10',
      ticketText: '某票',
      manifestText: manifestOf(['scripts/a.mjs']),
      statusFn: () => ' M scripts/a.mjs',
      commitFn: () => {
        throw new Error('index.lock: File exists')
      },
    })
    return r.action === 'artifact-commit-failed' && r.files.length === 1 && r.why.includes('index.lock')
  })())
  ok('S10j dry-run ⇒ 只出预览,不调提交', (() => {
    const spy = commitSpy()
    const r = landTicketArtifacts({ ticketKey: 'k10', ticketText: '某票', manifestText: manifestOf(['scripts/a.mjs']), statusFn: () => ' M scripts/a.mjs', commitFn: spy.fn, dryRun: true })
    return r.action === 'artifact-preview' && r.files.length === 1 && spy.calls.length === 0
  })())
  // S11:决策候选刷新腿(第 2 期写侧的接线锁)。每条都钉一个具体失效方向。
  const s11Dir = join(TMP_DIR, 'selftest-s11')
  const s11Script = join(ROOT, 'scripts', 'autonomy-candidates.mjs')
  ok('S11a 候选文件新鲜 ⇒ 不重跑生成器(84s 的器物不能每轮都调)', (() => {
    mkdirSync(s11Dir, { recursive: true })
    const cand = join(s11Dir, 'fresh.json')
    writeFileSync(cand, '{}', 'utf8')
    let called = 0
    const r = refreshAutonomyCandidates({ now: Date.now(), scriptFile: s11Script, candidatesFile: cand, runner: () => { called++; return '' } })
    return r.state === 'ok' && called === 0 && String(r.why).includes('新鲜')
  })())
  ok('S11b 候选文件过期 ⇒ 真调生成器一次(节流不等于永不刷新)', (() => {
    mkdirSync(s11Dir, { recursive: true })
    const cand = join(s11Dir, 'stale.json')
    writeFileSync(cand, '{}', 'utf8')
    const old = new Date(Date.now() - 7 * 3600_000)
    utimesSync(cand, old, old)
    let called = 0
    const r = refreshAutonomyCandidates({ now: Date.now(), scriptFile: s11Script, candidatesFile: cand, runner: () => { called++; return '' } })
    return r.state === 'ok' && called === 1 && String(r.why).includes('刷新')
  })())
  ok('S11c dry-run ⇒ 不刷新且如实说"决策将按台账序",不假装刷过', (() => {
    const r = refreshAutonomyCandidates({ dryRun: true, scriptFile: s11Script, candidatesFile: join(s11Dir, 'never-exists.json'), runner: () => { throw new Error('dry-run 不该调生成器') } })
    return r.state === 'undetermined' && String(r.why).includes('dry-run')
  })())
  ok('S11d 器物不在位 ⇒ 未判定并点名路径(不把"没装"读成"没有候选"的合法态)', (() => {
    const r = refreshAutonomyCandidates({ scriptFile: join(s11Dir, 'nope.mjs'), candidatesFile: join(s11Dir, 'x.json'), runner: () => { throw new Error('不该调') } })
    return r.state === 'undetermined' && String(r.why).includes('不在位')
  })())
  ok('S11e 接线锁:刷新腿真在派发主循环里(没有这一行,第 2 期永远不生效)', (() => {
    const src = readFileSync(join(ROOT, 'scripts', 'auto-evolve.mjs'), 'utf8')
    return /if \(!noDecide\) \{\s*\r?\n\s*const gen = refreshAutonomyCandidates\(\{ dryRun \}\)/.test(src)
  })())
  // S12 会话全文落盘腿(第 4 格·观测腿,2026-11-01 立):命名/脱敏/截断/轮转判据 + 接线锁。
  // 判据全部 import 自 lib/session-transcript.mjs(单一真相源),本处只验"编排有没有按契约处置"。
  ok('S12a 正文三段齐备(PROMPT/STDOUT/STDERR 横幅)', (() => {
    const t = buildTranscript({ ticketKey: 'k12', prompt: 'P', stdout: 'O', stderr: 'E' })
    return t.includes('===== PROMPT(会话被交代了什么) =====') && t.includes('===== STDOUT(事件流原样) =====') && t.includes('===== STDERR =====')
  })())
  ok('S12b 脱敏:Bearer 令牌被替换,头部记命中次数', (() => {
    const t = buildTranscript({ prompt: 'Authorization: Bearer eyJabc.def.ghi token' })
    return t.includes('«REDACTED:bearer»') && /redacted:.*bearer/.test(t)
  })())
  ok('S12c 脱敏:私钥块整段被替换(原文不残留)', (() => {
    const block = '-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----'
    const t = buildTranscript({ prompt: block })
    return t.includes('«REDACTED:private-key»') && !t.includes('MIIabc')
  })())
  ok('S12d 截断留痕:超限时正文含"中略"且头尾保留,头部 redacted 行仍在', (() => {
    const big = 'x'.repeat(5 * 1024 * 1024)
    const t = buildTranscript({ prompt: big })
    const capped = capTranscript(t)
    return capped.truncated === true && capped.text.includes('中略') && capped.text.startsWith('# session transcript')
  })())
  ok('S12e 不截断:未超限逐字不变', (() => {
    const t = buildTranscript({ prompt: '短文本' })
    const capped = capTranscript(t)
    return capped.truncated === false && capped.text === t
  })())
  ok('S12f 命名:transcriptRelPathOf 产物过 isTranscriptName 且含票键', (() => {
    const rel = transcriptRelPathOf({ at: new Date(), ticketKey: 'deadbeef12345678', mode: 'dispatch', action: 'session-ok' })
    return isTranscriptName(rel) && rel.includes('deadbeef12345678')
  })())
  ok('S12g 轮转:最新一份无论多老都保留(失效方向=多留证据)', (() => {
    const now = Date.now()
    const oldest = now - 365 * 86_400_000
    const newer = now - 100 * 86_400_000 // 也超 14 天,但比 oldest 新 ⇒ 仍豁免保留
    const r = decideRetention([{ rel: 'oldest.log', mtimeMs: oldest }, { rel: 'newer.log', mtimeMs: newer }], { now, keepDays: 14, keepMax: 500 })
    return r.keep.length === 1 && r.keep[0] === 'newer.log' && r.drop.length === 1 && r.drop[0].rel === 'oldest.log'
  })())
  ok('S12h 轮转:非最新的过期件被删(带 why)', (() => {
    const now = Date.now()
    const old = now - 365 * 86_400_000
    const mid = now - 86_400_000
    const r = decideRetention([{ rel: 'a.log', mtimeMs: old }, { rel: 'b.log', mtimeMs: mid }, { rel: 'c.log', mtimeMs: now }], { now, keepDays: 14, keepMax: 500 })
    return r.keep.length === 2 && r.drop.some((d) => d.rel === 'a.log' && /天前/.test(d.why))
  })())
  ok('S12i 轮转:mtime 取不到 ⇒ 不删(未判定不猜,§0.3)', (() => {
    const r = decideRetention([{ rel: 'a.log', mtimeMs: NaN }], { now: Date.now(), keepDays: 14, keepMax: 500 })
    return r.undetermined.length === 1 && r.drop.length === 0
  })())
  ok('S12j 接线锁:dispatchSession / probeSession 都调 persistTranscript 并把 transcript 带进台账', (() => {
    const src = readFileSync(join(ROOT, 'scripts', 'auto-evolve.mjs'), 'utf8')
    const dispatchWired = /const transcript = persistTranscript\(\{[\s\S]*?mode: 'dispatch'/.test(src)
    const probeWired = /const transcript = persistTranscript\(\{[\s\S]*?mode: 'probe'/.test(src)
    const ledgerWired = /transcript: res\.transcript \?\? null/.test(src) && /record\(\{ mode: 'probe'[\s\S]*?transcript,/.test(src)
    return dispatchWired && probeWired && ledgerWired
  })())
  if (failed > 0) {
    console.error(`self-test: ${failed} 例红`)
    process.exitCode = 1
  } else {
    console.log('self-test: 全绿')
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const args = process.argv.slice(2)
  main(args).catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

async function main(args) {
  if (args.includes('--self-test')) return selfTest()
  if (args.includes('--status')) return printStatus()
  if (args.includes('--install-task')) return installTask({ apply: args.includes('--apply') })
  if (args.includes('--probe')) {
    let gates
    try {
      gates = loadGates()
    } catch (e) {
      console.error(`❌ 未判定:${e.message}`)
      process.exitCode = 2
      return
    }
    return probeSession({ gates, dryRun: args.includes('--dry-run') })
  }
  if (args.includes('--dry-run')) return runOnce({ dryRun: true, noDecide: args.includes('--no-decide') })
  const out = await runOnce({ dryRun: false, noDecide: args.includes('--no-decide') })
  // 感知层顺带轮(第 1 期 auto-triage):派发轮完成后独立进程跑一次分诊;
  // 它的失败不顶红派发轮(未判定记它自己的台账),产出受它自己的每日配额约束。
  if (!args.includes('--no-triage')) {
    const tr = spawnSync(process.execPath, [join(ROOT, 'scripts', 'auto-triage.mjs'), '--once'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: ROOT,
      windowsHide: true,
      timeout: 180_000,
      encoding: 'utf8',
    })
    const tOut = String(tr.stdout ?? '').trim()
    if (tOut) console.log(`── 感知层分诊轮 ──\n${tOut}`)
  }
  // 进化回流写回轮(第 3 期):把部署环反复出现的失败桶提炼成教训并落 lessons.jsonl。
  // 台账尚未产生过决策时 retro 按设计判「未判定」;这里显式跳过并点名原因,不把"还没部署过"读成故障,
  // 也不让 missing 台账每小时刷一条假红。台单一就位,本腿即自动生效。
  if (!args.includes('--no-retro')) {
    const decisionsPath = join(ROOT, '.ihui-agent', 'deploy-decisions.jsonl')
    if (!existsSync(decisionsPath)) {
      console.log(`── 进化回流写回轮 ──\nℹ 跳过:部署决策台账尚未产生(${decisionsPath}),无可提炼的失败桶`)
    } else {
      const rr = spawnSync(process.execPath, [join(ROOT, 'scripts', 'evolution-retro.mjs'), '--apply'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: ROOT,
        windowsHide: true,
        timeout: 120_000,
        encoding: 'utf8',
      })
      const rOut = String(rr.stdout ?? '').trim()
      if (rOut) console.log(`── 进化回流写回轮 ──\n${rOut}`)
      if (rr.status !== 0) {
        console.error(`⚠ 进化回流写回未判定(rc=${rr.status ?? '?'}):${String(rr.stderr ?? '').trim().slice(-300)}`)
      }
    }
  }
  return out
}

export const __test__ = {
  loadGates,
  GateShapeError,
  ticketKeyOf,
  matchWhitelist,
  parseTicketRows,
  rankTicketRows,
  fillTemplate,
  parseSessionUsage,
  failureStreakOf,
  quarantinedUntilOf,
  isPidAlive,
  signSessionJwt,
  decideValveDispatch,
  DISPATCH_ARGS,
  PLAN_TASKS,
  GATES_JSON,
  LEDGER,
  todayKey,
  landTicketArtifacts,
  partitionProtectedFaces,
  buildArtifactCommitMessage,
  commitPrefixOf,
  ARTIFACT_MANIFEST_DIR,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
