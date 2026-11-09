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
import { gitRaw } from './lib/face-reader.mjs'
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  appendFileSync,
  openSync,
  closeSync,
  unlinkSync,
  statSync,
  utimesSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHmac, randomUUID } from 'node:crypto'
import { loadCaps, parseLedger, evaluate, chargeLine } from './cost-breaker.mjs'
import { loadHumanGates, summarize as summarizeHumanGates } from './human-gates.mjs'
import { loadPolicy, decide, POLICY_PATH } from './autonomy-decision.mjs'
// 票键唯一实现(§0.6 单一真相源):本器不再自持一份,改从 lib 收口处取,转出保持既有导出面不变。
import { ticketKeyOf } from './lib/ticket-key.mjs'
// 自我面核验复用门 299 的清单解析器(§0.6:锚点表与"锚点怎么算命中"只有一份实现)
import { __test__ as INV_SELF } from './check-autonomy-invariants.mjs'
const invParse = INV_SELF.parseInvariants
export { ticketKeyOf }
// 发起腿的「执行体存续」判据单源(2026-11-01 立):盘符归一 + 派发前核验 + 失败分型。
// 本层零复算判据(§0.6),只做接线。
import {
  preflightSessionRunner,
  resolveSessionCommand,
  classifySessionFailure,
  isNonTicketFailure,
} from './lib/autonomy-runner.mjs'
export { preflightSessionRunner, resolveSessionCommand, classifySessionFailure, isNonTicketFailure }
import { gateTicketByHumanValve, VALVE_MODES, VALVE_ACTIONS } from './lib/autonomy-runner.mjs'
export { gateTicketByHumanValve }
// 会话后落账腿的判据单源(2026-11-01 立):清单解析/路径安全/真有改动三问都住 lib,本器只做 IO 与编排。
import {
  parseArtifactManifest,
  sanitizeArtifactPaths,
  selectDirtyPaths,
  manifestPathOf,
} from './lib/ticket-artifacts.mjs'
// 提交后两腿与 safe-commit 用**同一份实现**(§0.6):正证留痕 + AI 归属 notes。换私有索引通道
// 不等于放弃这两张证 —— 少了它们,读侧尺子会把每一枚自主提交都读成"没人跑过门/无归属"。
import { recordGatesThenCommit } from './lib/commit-attestation.mjs'
import { recordForCommit, normalizeRepoPath } from './lib/ai-authorship-notes.mjs'
export { parseArtifactManifest, sanitizeArtifactPaths, selectDirtyPaths, manifestPathOf }
// 第 4 格·会话全文落盘腿:命名 / 脱敏 / 截断 / 轮转判据全在 lib(单一真相源,§0.6),本处只负责"读盘调用"。
import {
  buildTranscript,
  capTranscript,
  transcriptRelPathOf,
  isTranscriptName,
  decideRetention,
} from './lib/session-transcript.mjs'
import {
  attemptsSinceProgress,
  decideNonProgress,
  breakdownNonProgress,
  lastNonProgressHoldAt,
  faceRoundStreak,
  parkedRoundAlreadyAnnounced,
  decideSupplyStall,
} from './lib/autonomy-nonprogress.mjs'
// 判据面(受保护面)的匹配判据单源在护栏纯函数层;本器只调用,不重抄任何匹配规则(§0.6)。
import { parseGuardList, matchProtected } from './lib/immutable-guard.mjs'
// 票面指纹与生成器同一把尺(§0.6):比对双方都走 autonomy-candidates 的那一个实现
import { planFaceDigestFromHead } from './lib/plan-face-digest.mjs'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/** 调度器接线的锚点(guardian 派发层 import 同一组路径,不另拼第二份 —— §0.6 单一真相源) */
export const GATES_JSON = join(ROOT, 'scripts', 'data', 'auto-evolve-gates.json')
/** 人工阀分类语料(判据实现住在 lib/human-valve.mjs,这里只取它的语料文件)。
 *  必须排在 ROOT 之后:const 声明有 TDZ,放在上面会让本器一被 import 就 ReferenceError。 */
export const VALVE_LIST_JSON = join(ROOT, 'scripts', 'data', 'human-valve-list.json')
/**
 * 账面挂账搁置清单(2026-11-06 立,`supply-hold-skip` 的唯一数据面)。
 * 每行一枚具名条目:{key | head, ticket, reason, owner, expires}。
 * 与人工阀清单分开是有意的:阀答"这个动作需不需要人",这一本答"这张票已被别人做了、只是账面没跟上"。
 */
export const SUPPLY_HOLDS_JSON = join(ROOT, 'scripts', 'data', 'auto-evolve-supply-holds.jsonl')
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
/**
 * 代提交唯一出口 = **私有索引提交通道** `scripts/isolated-git.mjs`(§12i,2026-11-04 换)。
 * 为什么不是 safe-commit:它的 Step 1 是 `git reset HEAD`(自述"清空暂存区(无论谁 staged 的)"),
 * 而本仓是多会话共树 —— 实测当次共享索引里就有 12 枚他人暂存(含 2 枚他人**暂存删除**,
 * 那个 `D ` 标记本身就是"这行是我摘的"的保护凭据)。自主环每小时都可能落一次账 ⇒
 * 用 safe-commit 等于把"清别人现场"这个实害按小时放大;safe-commit 自己也把这型写成两次实害
 * (c8f2750a5c / 56227f8b33)。isolated-git 用私有 GIT_INDEX_FILE、禁 --no-verify、
 * 且钩子若往声明集之外塞条目就当场拒收 —— 既跑门也不动别人。
 * 代价是它的提交后两腿(正证留痕 + AI 归属 notes)原本只住在 safe-commit 里,所以本函数
 * import **同一份** lib 把两腿接上(§0.6 不复算判据);接不上就如实出声,不静默少一张证。
 */
const LAND_COMMIT = join(ROOT, 'scripts', 'isolated-git.mjs')
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
  const needPosInt = [
    'dailyDispatchBudget',
    'failureStreakLimit',
    'quarantineHours',
    'maxSessionMinutes',
  ]
  for (const k of needBool) {
    if (typeof g[k] !== 'boolean') throw new GateShapeError(`闸门形状坏:${k} 必须是 boolean`)
  }
  for (const k of needPosInt) {
    if (!Number.isInteger(g[k]) || g[k] <= 0)
      throw new GateShapeError(`闸门形状坏:${k} 必须是正整数`)
  }
  if (g.failureStreakLimit < 2)
    throw new GateShapeError('闸门形状坏:failureStreakLimit 至少为 2(=1 时首败即封票,误伤面过大)')
  if (!Array.isArray(g.ticketWhitelist) || g.ticketWhitelist.length === 0) {
    throw new GateShapeError(
      '闸门形状坏:ticketWhitelist 必须是非空数组(第一期靠白名单兜底,不许全放行)',
    )
  }
  for (const p of g.ticketWhitelist) {
    if (typeof p !== 'string' || !p.trim())
      throw new GateShapeError('闸门形状坏:ticketWhitelist 出现非字符串/空白项')
  }
  if (typeof g.sessionCommandTemplate !== 'string') {
    throw new GateShapeError('闸门形状坏:sessionCommandTemplate 必须是字符串(空串 = dry-run 档)')
  }
  // 模板引用了 {sessionModel}/{sessionApiUrl} 而闸门没给值 ⇒ 当场形状报错(既有终局档,
  // 不新增动作)。方向是"多要一次定向说明"(§0.10):宁可本轮不派,也不把空串塞进
  // `--model ""` 让会话以一个没人认得的模型名起跑。
  for (const [ph, key] of [
    ['{sessionModel}', 'sessionModel'],
    ['{sessionApiUrl}', 'sessionApiUrl'],
  ]) {
    if (!g.sessionCommandTemplate.includes(ph)) continue
    if (typeof g[key] !== 'string' || !g[key].trim())
      throw new GateShapeError(
        `闸门形状坏:sessionCommandTemplate 用了 ${ph} 而 ${key} 未配置(非空字符串)`,
      )
  }
  // 人工阀档:缺字段 = observe(记账不拦)。缺省绝不等于放开 —— 但也绝不因为"没登记"就
  // 一刀切停派,那是把刚修活的发起腿再锁死。enforce 的前置条件由尺子 A6 维量(见 check-autonomy-leg-health)。
  if (g.humanValveMode !== undefined && !VALVE_MODES.includes(g.humanValveMode)) {
    throw new GateShapeError(
      `闸门形状坏:humanValveMode 只能是 ${VALVE_MODES.join('|')} 之一(现值 ${JSON.stringify(g.humanValveMode)})`,
    )
  }
  if (g.humanValveMode === undefined) g.humanValveMode = 'observe'
  // 空转记忆档(2026-11-04 立):缺字段 = 用保守缺省,绝不因"没登记"就退回"无限重试同一枚"。
  // 递增不变量交给判据器 decideNonProgress 复核(单源,本处不重抄判据),这里只补值。
  if (g.rotateAfterAttempts === undefined) g.rotateAfterAttempts = 4
  if (g.parkAfterAttempts === undefined) g.parkAfterAttempts = 8
  if (g.parkHardLimit === undefined) g.parkHardLimit = 24
  if (g.parkCooldownHours === undefined) g.parkCooldownHours = 24
  // 轮级自我面终局档的门限(RP-66,2026-11-06 立)。缺省 3 是量出来的,不是拍的:
  // 现读 11 条 dispatched 的轮间隔 0.5/0.9/4.7/5.8/8.8/10.7/12.5/42.9/48.9/322.1 分钟,
  // 中位 10.7 ⇒ 3 轮 ≈ 半小时无人喊地撞同一道面闸,已经足够判"这不是抖一下"。
  if (g.parkedRoundStreak === undefined) g.parkedRoundStreak = 3
  // 供给断档门限(2026-11-06 立)。6 轮是按现读调度节拍(约 1 轮/小时)取的"六小时无人管即响":
  // 短于一天的正常空窗(夜里没人补票是常态)不该喊,长于一天的断档就是"票供给"这件事本身没人负责。
  if (g.supplyStallRounds === undefined) g.supplyStallRounds = 6
  for (const k of [
    'rotateAfterAttempts',
    'parkAfterAttempts',
    'parkHardLimit',
    'parkedRoundStreak',
    'supplyStallRounds',
  ]) {
    if (!Number.isInteger(g[k]) || g[k] <= 0)
      throw new GateShapeError(`闸门形状坏:${k} 必须是正整数(现值 ${String(g[k])})`)
  }
  if (!Number.isInteger(g.parkCooldownHours) || g.parkCooldownHours <= 0) {
    throw new GateShapeError(
      `闸门形状坏:parkCooldownHours 必须是正整数(现值 ${String(g.parkCooldownHours)})`,
    )
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
 * 取票腿失败后的**可证复用**(2026-11-06 立)。现读依据:`plan-tasks --open --dispatchable
 * --exclude-inflight` 这次**成功**返回 36 行,但耗时 **425.8s**,而取票口阈值是 300s
 * —— 即票面没坏、命令没坏,坏在并发席把通道挤慢(同轮 `git-lock scan`:47 个 git.exe、
 * 锁等待 P95=33.5s)。此前实测过的一型正是:阈值一被击穿,环整天拿不到票池。
 *
 * 与"把超时再抬一层"的区别:这里要**三条同时成立**才敢复用,任一条不成立 ⇒ null ⇒ 照旧
 * "未判定不派"(§0.3 的失效方向是多要一次说明,不是放行)。
 *  ① 缓存自述的票面指纹与当次 HEAD 面逐字相等(票面没变 ⇒ 行集同源可证);
 *  ② 每条候选还原成的行,其票键与候选自述 `id` 逐字相等(算不出同一把键 = 口径变了,不猜);
 *  ③ 还原出的行非空。
 * 方向性也如实说:候选面是派单面的**子集**(缓存由同一条命令生成),所以复用只会少派不会多派。
 * 复用这件事本身进本轮的 `summary` 文本(它会被写进后续台账行的 note),不新增 action 字面量 ——
 * 独立档 `pool-face-reused` 是更完整的形态,但它要同时过覆盖面豁免表与健康尺 A15 认领表,
 * 那是另一枚票,不在这里悄悄加发射点。
 */
export function poolFaceFromCache({ cacheText, digestNow } = {}) {
  const no = (why) => ({ rows: null, why })
  if (!digestNow) return no('当次 HEAD 面的票面指纹取不到(不猜同一面)')
  if (!cacheText) return no('候选缓存取不到(文件不存在或读失败)')
  let j
  try {
    j = JSON.parse(cacheText)
  } catch {
    return no('缓存不是合法 JSON')
  }
  const cached = j?.source?.planDigest
  if (!cached) return no('缓存没有自述票面指纹(旧档或写读不同源)')
  if (cached !== digestNow) return no(`票面指纹不一致(缓存 ${cached} ≠ 当次 ${digestNow})`)
  const list = Array.isArray(j?.candidates) ? j.candidates : []
  if (list.length === 0) return no('缓存候选面为空')
  const rows = []
  for (const c of list) {
    const text = String(c?.title ?? '').trim()
    const line = Number(c?.line)
    if (!text) return no('某条候选没有题面,还原不出派单行')
    if (!Number.isInteger(line) || line <= 0) return no(`某条候选缺可行号(${String(c?.id ?? '?')})`)
    if (String(c?.id ?? '') !== ticketKeyOf(text)) {
      return no(`票键不同源:候选自述 ${String(c?.id ?? '')} ≠ 由题面算出的 ${ticketKeyOf(text)}`)
    }
    rows.push({ line, text })
  }
  return { rows, why: `指纹逐字相等,还原 ${rows.length} 行` }
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
export function refreshAutonomyCandidates({
  now = Date.now(),
  dryRun = false,
  scriptFile = AUTONOMY_CANDIDATES_SCRIPT,
  candidatesFile = AUTONOMY_CANDIDATES,
  runner = null,
} = {}) {
  if (!existsSync(scriptFile))
    return { state: 'undetermined', why: '生成器物不在位(scripts/autonomy-candidates.mjs)' }
  try {
    const st = statSync(candidatesFile)
    const ageMs = now - st.mtimeMs
    // 允许 ageMs 为小负值:文件刚写完时 mtime 可能比 now 晚几毫秒(写入顺序/文件系统精度),
    // 卡 `>= 0` 会让"刚生成"被判成不新鲜 ⇒ 每轮都重刷 84s 的器物(S11a 实测抓到)。
    // 时钟回拨也落进同一侧:宁可少刷一次(下一轮自然补),不要每轮白等。
    if (Number.isFinite(ageMs) && ageMs < AUTONOMY_CANDIDATES_REFRESH_MS) {
      // 钟表新鲜还不够:就地改写票面后,旧候选文件里没有那张改写后的票,
      // 于是环会在 6 小时里一直报"未评估(候选文件未收录本票)"(2026-11-05 实测挡了 227 分钟)。
      // 票面指纹变了 ⇒ 视为过期,走下面的重跑;老缓存文件没有这一格 ⇒ 同样重跑一次把指纹写进去(自愈,此后改票立即失效不等钟表) 84s)。
      let cached = null
      try {
        cached = JSON.parse(readFileSync(candidatesFile, 'utf8'))?.source?.planDigest ?? null
      } catch {
        cached = null
      }
      // 取**被审面**(HEAD blob)的票面指纹:读工作树会被别席滞后副本骗过(见 lib 头注)。
      const nowDigest = planFaceDigestFromHead(ROOT)
      if (!nowDigest)
        console.warn('↻ 票面指纹取不到(HEAD 面读失败)⇒ 不冒充"一样",本轮按未判定处理并重算候选')
      if (cached && nowDigest && cached === nowDigest) {
        return {
          state: 'ok',
          why: `候选文件新鲜(${Math.round(ageMs / 60_000)}min < ${AUTONOMY_CANDIDATES_REFRESH_MS / 3_600_000}h),不重跑`,
        }
      }
      console.warn(
        cached
          ? `↻ 票面已变(候选指纹 ${cached.slice(0, 8)}… → ${String(nowDigest).slice(0, 8)}…)⇒ 重算候选,不让改写后的票看不见`
          : '↻ 候选文件没有票面指纹(本维上线前的旧档)⇒ 重算一次把指纹写进去;此后改票即失效,不再等 6h 钟表',
      )
    }
  } catch {
    /* 没生成过 ⇒ 继续往下刷 */
  }
  if (dryRun) return { state: 'undetermined', why: 'dry-run 不写盘 ⇒ 候选不刷新(决策将按台账序)' }
  const r =
    typeof runner === 'function'
      ? { status: 0, stdout: String(runner() ?? ''), stderr: '' }
      : spawnSync(process.execPath, [scriptFile, '--apply'], {
          cwd: ROOT,
          windowsHide: true,
          encoding: 'utf8',
          timeout: 180_000,
        })
  if (r.error) return { state: 'undetermined', why: `生成器起不来:${r.error.message}` }
  if (r.status !== 0)
    return {
      state: 'undetermined',
      why: `生成器 exit=${r.status} ${String(r.stderr ?? '').slice(-160)}`,
    }
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
    skipped.push({
      line: r.line,
      key,
      reason: deferredById.get(key) ?? '未评估(候选文件未收录本票)',
    })
  }
  return {
    rows: ranked,
    mode: 'decision',
    why: `模型 ${result.state}:可排期 ${ranked.length} / 压后 ${result.deferred.length}`,
    ranked,
    skipped,
  }
}

/**
 * {promptFile}/{ticketLine}/{ticketKey}/{sessionModel}/{sessionApiUrl} 占位填充;
 * 未知占位原样保留(不猜)。
 * 后两枚是 2026-11-05 补的:派发子进程跑在 SYSTEM 账户 HOME 下,那里那份 `.ihui/settings.json`
 * 只有 apiKey、没有 defaultModel/apiUrl ⇒ CLI 落回缺省 `'default'`,而 ai-service 的网关只把
 * `"auto"`/空串归一,`default` 被当真实模型名走末位兜底 ⇒ 实际打到 api.openai.com ⇒ 404。
 * 也就是"这一班用的是哪个模型"取决于进程继承到哪个 HOME —— 那是别人的文件,随时会被改写。
 * 模型与入口一律由本仓闸门声明,不再靠继承运气。
 */
export function fillTemplate(
  tpl,
  { promptFile, ticketLine, ticketKey, sessionModel, sessionApiUrl },
) {
  return String(tpl)
    .replaceAll('{promptFile}', promptFile ?? '')
    .replaceAll('{ticketLine}', ticketLine ?? '')
    .replaceAll('{ticketKey}', ticketKey ?? '')
    .replaceAll('{sessionModel}', sessionModel ?? '')
    .replaceAll('{sessionApiUrl}', sessionApiUrl ?? '')
}

/**
 * 起会话 token 计量(第 3 期④):唯一可信取数口 = CLI `--json` 事件流的终态行
 * `{"type":"complete",…,"usage":{promptTokens,completionTokens,totalTokens,estimatedCostUsd}}`
 * (会话文件不落 usage,文本模式只有人读排版)。
 * 取最后一个 complete 行;没读到 / 字段坏 ⇒ measured:false —— 不把"量不到"读成 0。
 */
/**
 * 会话可执行文件的运行时归一(2026-11-05 立)。
 * 立因(台账原样,不是推测):16:09 那一轮 `session-failed exit=1`,stderr 按 GBK 码页解出来是
 * 「'node' 不是内部或外部命令,也不是可运行的程序或批处理文件」—— 模板第一个 token 是裸 `node`,
 * 而派发方是 nssm 服务身份的守护进程,**服务身份读的是机器级 PATH(实测那是个死目录)**,
 * 用户级 PATH 里的 node 根本不在其中 ⇒ 会话从来没起来过,而 `preflightSessionRunner` 放行了它:
 * 它核验的是模板里的**绝对路径 token**(tsx/cli.mjs、apps/cli/src/index.ts),那些全在;
 * 可执行文件本身能不能解析,这一格当时不在射程内 ⇒ "器物在库、核验在跑、依然零产出"的同型缺口
 * (§0.9:判不到就是没有判)。
 * 正解不是往机器级 PATH 里塞 node(那是改机器事实,换机即复犯),而是**用派发进程自己的运行时**:
 * 它就是 node,子会话必然该用同一个可执行文件。路径当次取,不写死盘符(§0)。
 * 失效方向:取不到 execPath / 首 token 不是裸 node ⇒ 原样返回且 `replaced:false`,
 * 绝不猜一个路径出来(§0.3),也不静默改写非 node 的模板(自定义 runner 必须照原样跑)。
 * @param {string} cmdText 模板填充后的完整命令
 * @param {string} [execPath] 当前进程可执行文件(测试注入用)
 * @returns {{cmd:string, replaced:boolean, why:string}}
 */
export function normalizeSessionRuntime(cmdText, execPath = process.execPath) {
  const t = String(cmdText ?? '')
  const m = /^(\s*)(?:node|node\.exe)(\s)/i.exec(t)
  if (!m)
    return { cmd: t, replaced: false, why: '首 token 不是裸 node ⇒ 不动(自定义 runner 照原样)' }
  const exe = String(execPath ?? '')
  if (!exe || !/[\\/]/.test(exe))
    return {
      cmd: t,
      replaced: false,
      why: `当前进程可执行路径取不到(${JSON.stringify(exe).slice(0, 24)})⇒ 不猜,原样执行`,
    }
  // cmd.exe 下带空格的路径必须引号包住;模板本身刻意零内嵌引号(见下方 windowsVerbatimArguments 注),
  // 这里加的那一对是唯一被许可的引号。
  const quoted = /[\s"]/.test(exe) ? `"${exe}"` : exe
  return {
    cmd: m[1] + quoted + m[2] + t.slice(m[0].length),
    replaced: true,
    why: `模板首 token 是裸 node ⇒ 换成当前进程运行时(${exe})`,
  }
}

/**
 * 自我面核验(2026-11-05 立):本器**从盘上被 spawn 运行**,而多会话共树时盘上那份
 * 可能是某席从旧基线改的半成品 —— 今天实测到的正是这一形:工作树 2851 行 vs HEAD 2263 行,
 * 且缺当天全部 7 条判据锚点。那种时刻照派 = 拿半成品当执行体,烧掉一个班次还会把票记成"会话成功";
 * 但也不能要求"盘必须干净"——共树常年脏,那等于把自主环饿死。
 * 所以判据只看方向:**只在"盘上缺 HEAD 已有的锚点"(回潮)时停派**;盘上是超集(新增未提交)照派。
 * 锚点表与门 299 同一份(§0.6 不复算):`scripts/data/autonomy-invariants.json`。
 * 任一面取不到 ⇒ 未判定 ⇒ 不派也不谎报(§0.3)。
 * @param {{invariantsText?:string|null, headText?:string|null, diskText?:string|null, selfRel:string}} p
 * @param {string|null} p.invariantsText 锚点表原文(`scripts/data/autonomy-invariants.json`,null ⇒ undetermined)
 */
export function judgeSelfFace({
  invariantsText = null,
  headText = null,
  diskText = null,
  selfRel,
}) {
  if (
    typeof invariantsText !== 'string' ||
    typeof headText !== 'string' ||
    typeof diskText !== 'string'
  ) {
    return {
      state: 'undetermined',
      missing: [],
      why: '锚点表 / HEAD 面 / 盘上三份之一取不到 ⇒ 不猜',
    }
  }
  const parsed = parseInvariantsForSelf(invariantsText)
  if (parsed.problems.length)
    return {
      state: 'undetermined',
      missing: [],
      why: `锚点清单有问题:${parsed.problems[0].message}`,
    }
  const me = parsed.entries.find((e) => e.path === selfRel)
  if (!me)
    return {
      state: 'undetermined',
      missing: [],
      why: `清单里没有 ${selfRel} 这一条 ⇒ 无从判盘上是否落后`,
    }
  const missing = me.anchors.filter((a) => headText.includes(a) && !diskText.includes(a))
  if (missing.length) {
    return {
      state: 'stale-disk',
      missing,
      why: `盘上这份缺 HEAD 已有的 ${missing.length}/${me.anchors.length} 条判据(有席正从旧基线改调度器,此刻派发=跑半成品)`,
    }
  }
  return { state: 'ok', missing: [], why: `盘上这份未落后 HEAD(${me.anchors.length} 条锚点齐备)` }
}

/** 只借门 299 那一份清单解析器;取不到/坏都由上层落未判定。 */
function parseInvariantsForSelf(text) {
  try {
    return invParse(text)
  } catch (e) {
    return { entries: [], problems: [{ code: 'parse-throw', message: String(e?.message ?? e) }] }
  }
}

const SELF_REL = 'scripts/auto-evolve.mjs'

/**
 * 真出口:三面现读(清单 / HEAD 面本器 / 盘上本器)。任一取不到 ⇒ 交给上层落未判定。
 * 盘上那份**必须**按路径读本器自己(`SELF_REL`),不能拿 `import.meta.url` 推 —— 被 tsx/spawn 包装时
 * 两者可能不同(§15 的 ROOT 纪律说的正是这件事)。
 */
function readSelfFace() {
  const g = (args) => {
    try {
      return String(
        gitRaw(args, ROOT, {
          timeout: 60_000,
          maxBuffer: 64 * 1024 * 1024,
        }) ?? '',
      )
    } catch {
      return null
    }
  }
  // 接线修复(2026-11-05 实测):这里过去读的是受保护面清单 `immutable-guard.json`,
  // 而锚点在 `autonomy-invariants.json`(门 299 同一份,§0.6 不另声明第二个路径)。
  // 清单那份的条目全无 anchors ⇒ `parseInvariants` 必报 list-bad ⇒ 本闸**每轮都以"锚点缺失"停派**,
  // 而镜像夹具喂的本来就在正确的表形态上 ⇒ 锁全绿、真跑永不派发(尺子 A14 还报 OK:它读的是对的那份)。
  const invariantsText = g(['show', `HEAD:${INV_SELF.DATA_REL}`])
  const headText = g(['show', `HEAD:${SELF_REL}`])
  let diskText = null
  try {
    diskText = readFileSync(join(ROOT, SELF_REL), 'utf8')
  } catch {
    diskText = null
  }
  return judgeSelfFace({ invariantsText, headText, diskText, selfRel: SELF_REL })
}

/**
 * 轮级终局档的判定(RP-66,2026-11-06 立)。纯函数、零 IO:喂台账行 + 门限,出该不该落、
 * 落什么、按哪枚 since 去重、邮件正文长什么样。
 *
 * 为什么必须抽出来:发信与落账那两行住在派发循环深处(要真 git + 真凭据 + 真子会话才到得了),
 * 而这一串的判据是"尾部连续几轮撞同一道面闸"—— 那是纯行序算术,留在循环里就只能靠端到端摸,
 * 摸不到就等于没锁(§0.9)。
 */
export function decideParkedRound({
  rows,
  streakN,
  faceState,
  faceAction,
  faceWhy,
  terminalActions,
} = {}) {
  const list = Array.isArray(rows) ? rows : []
  const streak = faceRoundStreak(list, { terminalActions })
  // 只认 number 形态的正整数:loadGates 那把尺对 JSON 里的 "3" 当场 GateShapeError,这里必须同口径,
  // 否则"字符串门限"在两条路上一个响一个不响(§0.6 同一判据两处不同形 = 其中一处是假的)。
  const n = streakN
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0)
    return {
      emit: false,
      reason: `parkedRoundStreak 不是正整数(现值 ${String(streakN)})`,
      streak,
    }
  const reached = streak.count >= n
  const already = reached && parkedRoundAlreadyAnnounced(list, streak.sinceTs)
  if (!reached || already)
    return {
      emit: false,
      reason: !reached
        ? `连续 ${streak.count} 轮 < 门限 ${n}`
        : `这一串已在 ${String(streak.sinceTs)} 喊过`,
      streak,
    }
  return {
    emit: true,
    reason: '',
    streak,
    alertId: `auto-evolve:runner-face-parked-round:${String(streak.sinceTs)}`,
    row: {
      mode: 'dispatch',
      action: 'runner-face-parked-round',
      // 刻意不带 ticketKey:这是"这一串轮"的结论,不属于任何一枚票。带票头就是把轮级账塞进票级阶梯。
      faceState,
      faceAction,
      streakRounds: streak.count,
      streakSince: streak.sinceTs,
      streakLast: streak.lastTs,
      why: `连续 ${streak.count} 轮终止在自我面闸(≥${n})⇒ 轮级终局,已喊 critical 一次`,
    },
    mailTitle: `[auto-evolve] 自开发环连续 ${streak.count} 轮撞自我面闸停摆`,
    mailBody: [
      `形态:${String(faceAction)}(自我面=${String(faceState)}),连续 ${streak.count} 轮只在派发前撞闸后 return。`,
      `起止:${String(streak.sinceTs)} → ${String(streak.lastTs)}(单位是轮,不是墙钟:现读轮间隔双峰,中位约 10.7 分钟)。`,
      `成因逐字:${String(faceWhy)}`,
      '',
      '收信人能做的两件事(二选一,都不是"再等一轮"):',
      '  ① 让占着盘上副本的那一席把它的改动落账(判据:HEAD blob 与 disk 逐字节相等),环下一轮自动续派;',
      '  ② 认定这是常态噪声 ⇒ 调 scripts/data/auto-evolve-gates.json 的 parkedRoundStreak(只放宽"喊人",不放宽"停派")。',
      '读数面:`node scripts/check-autonomy-leg-health.mjs` 的 A14 维;台账 action=runner-face-parked-round。',
    ].join('\n'),
  }
}

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
    if (!Number.isFinite(total) || total < 0)
      return { tokens: 0, costUsd: 0, measured: false, stopReason: null }
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

/**
 * 会往工作树写文件的工具名(按 CLI 各 Tool 声明的 `dangerLevel:'write'` 取,不是按名字猜)。
 * `delete_file`/`batch_undo` 虽也改盘,但属 dangerous 档 ⇒ acceptEdits 下结构上不可用,不列。
 * 形状锁在 scripts/tests/auto-evolve.test.mjs:每个名字必须在 CLI 源码里注册且档位为 'write'
 * (清单腐烂与改名都会当场翻红,不用第二份散文说明)。
 */
export const WRITE_TOOL_NAMES = Object.freeze(['write_file', 'edit_file', 'batch_edit'])

/**
 * 从会话 stdout 的事件流里取**最后一条** `{"type":"error","message":…}`(2026-11-05 立)。
 * 立因:今日 6 枚 `session-failed` 的台账 `why` 全被同一行 stderr 警告
 * (`[skills] conservative load: archify …`)占住,真死因(出站零宽 400 / 模型腿 404 / 裸 node)
 * 只在转录里 ⇒ 任何读台账的人都会被归因带错方向。到人通道的审计输出必须把当时用到的判别码
 * 打进同一行,所以这一格单独成字段,而不是去改 `why` 的既有前缀形态。
 * 取"最后一条"而不是第一条:CLI 内部会重试,首条常是被重试掉的那一次。
 */
export function lastProviderError(stdout) {
  let found = null
  for (const raw of String(stdout ?? '').split(/\r?\n/)) {
    const t = raw.trim()
    if (!t.startsWith('{')) continue
    let e
    try {
      e = JSON.parse(t)
    } catch {
      continue
    }
    if (e && e.type === 'error' && typeof e.message === 'string' && e.message.trim())
      found = e.message.trim()
  }
  return found
}

/**
 * 让位失效判据(2026-11-05 立,单源;派发侧只调它,不复算)。
 * 立因:实测今日 10 个班次全部落到同一枚票 —— 白名单这一档只剩它一个命中,而 `rotate` 只做重排序,
 * "让位给空转更少的候选"在无处可让时退化成"每轮照吞一份日预算",要一路吞到 `parkAt` 才冷却。
 * 判据取二值事实:这一枚的 `attempts` 已经是活池里的最小值 ⇒ 池内没有空转更少的候选。
 * 只收 `route==='rotate'` 的档;`ok` 档(未达 `rotateAt`)永不进这一格,所以池子新鲜时照派不误。
 */
export function splitRotateStandoff(live) {
  if (!Array.isArray(live) || live.length === 0) return []
  const attemptsOf = (x) => (Number.isInteger(x?.np?.attempts) ? x.np.attempts : 0)
  const min = Math.min(...live.map(attemptsOf))
  return live.filter((x) => x?.np?.route === 'rotate' && attemptsOf(x) <= min)
}

/**
 * 会话到底有没有动过盘(2026-11-04 立)。
 * 立因(回源实测):台账 220 轮里 9 次 `session-ok`,而 `artifact-committed` = 0、
 * `artifact-manifest-missing` = 9;逐份 transcript 数写类工具命中 = 0 —— 会话把整班预算花在
 * read/grep 上就 `end_turn`,而调度器把"退出码 0"记成"成功" ⇒ 尺子在这一格是说谎的。
 * 为什么它不动手(不是偷懒):`--permission-mode acceptEdits` 只放宽 `dangerLevel:'write'`,
 * `run_command` 属 dangerous ⇒ 会话没有执行能力(apps/cli/src/tools/danger-gate.ts 无 prompt ⇒ denied);
 * 而旧 prompt 一边写"run_command 过不去",一边又硬要求"验证齐绿后才可声明完成"、
 * "走 live-doc-edit 追加注记"(那也是命令)—— 两条指令互斥,会话的合理反应就是继续检索到耗尽。
 * 所以这一档必须量"有没有写",并且把"没动手"与"动了手但没交清单"分成两档:
 * 前者的出路是改指令与权限,后者的出路才是催清单 —— 混在一个 `artifact-manifest-missing` 里,
 * 两边都修不动。
 *
 * 计数口径:`tool_call` 行只有 name+arguments,成败在配对的 `tool_result.success`
 * (apps/cli/src/headless-format.ts 的 HeadlessEvent 联合)⇒ 按 tool_result 认成功写。
 * `known=false` ⇒ 输出形状不认识(非 json 通路/被杀/事件格式变了),一律沿用原判定,
 * 绝不用"取不到"冒充"没写"(§0.3)。
 */
export function classifySessionWrites(stdout) {
  const lines = String(stdout ?? '').split(/\r?\n/)
  let known = false
  let writeOk = 0
  let writeTried = 0
  let toolResults = 0
  for (const raw of lines) {
    const t = raw.trim()
    if (!t.startsWith('{')) continue
    let e
    try {
      e = JSON.parse(t)
    } catch {
      continue
    }
    if (!e || typeof e.type !== 'string') continue
    if (e.type === 'complete' || e.type === 'tool_result' || e.type === 'tool_call') known = true
    if (e.type === 'tool_call' && WRITE_TOOL_NAMES.includes(e.name)) writeTried++
    if (e.type === 'tool_result') {
      toolResults++
      if (e.success === true && WRITE_TOOL_NAMES.includes(e.name)) writeOk++
    }
  }
  return { known, writeOk, writeTried, toolResults }
}

export function todayKey(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 台账 `ts`(UTC ISO)→ **本地**日键,与 `todayKey` 同口径;不可解析 ⇒ null(不冒充"同一天")。
 *
 * 立因(2026-11-06 现读实锤):日上限计数一直拿**本地**日键去 `startsWith` 一条 **UTC** 时间戳
 * ⇒ 本地 00:00–08:00(UTC+8)这段窗口里两者永不相等 ⇒ `dispatched` 恒 0。今晚的现场:
 * 00:07–00:31 连开六班,每班都记 `真派第 1 次(预算 10/日)`,`--status` 也报"预算 0/10",
 * 而成本熔断那侧现读近 24h 会话 20/24 —— 日上限在这 8 小时里**结构性不生效**,
 * 只剩小时/日熔断兜着。修法不是把日键改成 UTC(那是悄悄把"每日"的边界挪到本地 08:00),
 * 而是把两侧统一到同一口径:行侧换算成本地日再比。
 */
export function localDayOf(ts) {
  if (!ts) return null
  const d = new Date(String(ts))
  return Number.isNaN(d.getTime()) ? null : todayKey(d)
}

/** 「这条台账行属于今天(本地)」——两处计数共用同一个谓词,不再各写一遍 startsWith。 */
export function isDispatchedToday(entry, now = new Date()) {
  return (
    !!entry &&
    entry.action === 'dispatched' &&
    localDayOf(entry.ts) !== null &&
    localDayOf(entry.ts) === todayKey(now)
  )
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
function persistTranscript({
  mode,
  ticketKey,
  ticketLine,
  cmd,
  action,
  exitCode,
  durationMs,
  timedOut = false,
  signal = null,
  prompt = '',
  stdout = '',
  stderr = '',
  notes = '',
  at = new Date(),
}) {
  try {
    const body = buildTranscript({
      at,
      mode,
      ticketKey,
      ticketLine,
      cmd,
      action,
      exitCode,
      durationMs,
      timedOut,
      signal,
      prompt,
      stdout,
      stderr,
      notes,
    })
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
export function signSessionJwt(
  secret,
  { userId, ttlSeconds = JWT_TTL_SECONDS, now = Math.floor(Date.now() / 1000) },
) {
  const b64u = (b) => Buffer.from(b).toString('base64url')
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64u(
    JSON.stringify({
      sub: userId,
      userId,
      phone: '',
      familyId: randomUUID(),
      roleId: 0,
      iat: now,
      iss: 'ihui-ai',
      aud: 'ihui-ai-users',
      exp: now + ttlSeconds,
    }),
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
export async function mintSessionCredential({
  userId,
  writeSettings = (jwt) => writeCliSettingsJwt(jwt),
} = {}) {
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
    console.error(
      `⚠ CLI 登录态写入失败(${String(e?.message ?? e).slice(0, 120)})⇒ 本轮会话可能以未登录退出,按未判定记账`,
    )
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
        const rows = await sql.unsafe(
          'SELECT id FROM users ORDER BY role_id DESC, created_at ASC LIMIT 1',
        )
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

/**
 * 收件人现值 = apps/api/.env 的 ALERT_EMAIL_TO(git-guardian 同源;取不到 ⇒ 告警链不判死,只不发)。
 *
 * 2026-11-06 修一型静默死锁:旧正则**没有 `m` 档**,`^…$` 因此钉的是整个字符串的首尾 ⇒
 * 只有当 `ALERT_EMAIL_TO` 恰好是**文件最后一行**时才命中。现读真值在第 260 行(全文 392 行)
 * ⇒ 旧式命中 null ⇒ 本环每一封逃生邮件都走"未判定"分支,**一封也没发过**,而打出来的话是
 * "缺 ALERT_EMAIL_TO"(键明明在)。这既断了 §5e 的唯一到人通道,又把"我读不到"写成"它没有"
 * (§0.3 禁止的那一型)。配对实测:同一样输入,加 `m` 档即命中。
 * 逐行档的空白类只用 `[ \t]`(不用 `\s`:`\s` 会跨行,把下一行当成值吃掉)。
 */
export function resolveMailTo(envFile = API_ENV) {
  const fromEnv = String(process.env.ALERT_EMAIL_TO || '').trim()
  if (fromEnv) return fromEnv
  let src
  try {
    src = readFileSync(envFile, 'utf8')
  } catch {
    return ''
  }
  const m = /^[ \t]*ALERT_EMAIL_TO[ \t]*=[ \t]*(.+?)[ \t]*$/m.exec(src)
  if (!m) return ''
  const raw = m[1].trim()
  const quoted = /^"(.*)"$/s.exec(raw) || /^'(.*)'$/s.exec(raw)
  return (quoted ? quoted[1] : raw).trim()
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
function sendEscapeMail(gates, alertId, title, bodyText, severity = 'warning') {
  // severity 只加一个可选形参,缺省 'warning' ⇒ 本枚之前那 9 处调用逐字节不变(不趁修 A 改 B)。
  // 取值不在这层再校一遍:白名单在唯一出口 normalizeSeverity 里(§0.6),越界它自己降级。
  const to = resolveMailTo()
  if (!to) {
    // 措辞必须与量到的那件事同形:旧文案断言"缺 ALERT_EMAIL_TO",而真值就在 .env 第 260 行,
    // 读不到的是**我的正则**(无 m 档)。指控一个不存在的缺失,会把排查带去 .env 回填那一侧。
    console.error(
      `⚠️ 逃生邮件未判定:ALERT_EMAIL_TO 取不到(键缺失或值为空;判定面=${API_ENV} 现读,路径与键名逐字核对过才改这一行)`,
    )
    return false
  }
  if (!existsSync(TSX_ENTRY) || !existsSync(MAIL_SCRIPT)) {
    console.error(
      `⚠️ 逃生邮件未判定:出口不在位(tsx=${existsSync(TSX_ENTRY)} script=${existsSync(MAIL_SCRIPT)})`,
    )
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
      severity,
      '--source',
      'auto-evolve',
      '--alert-id',
      alertId,
      '--message-file',
      msgFile,
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: ROOT,
      windowsHide: true,
      timeout: 60_000,
      encoding: 'utf8',
    },
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
  writeFileSync(
    LOCK_FILE,
    JSON.stringify({ pid: process.pid, at: new Date().toISOString() }),
    'utf8',
  )
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
/**
 * 会话结果档(2026-11-04 立):这些 action 的每一行都欠着一个答案 —— "这张票到底推进了没有"。
 * `session-no-write` 必须一起扫:它是 exit 0 的另一支,漏进扫描集就等于给它开了"永不结算"的悬档
 * (尺子 A7 的"超窗未结算"会因此恒红 = §12e 恒红门)。
 */
export const SESSION_RESULT_ACTIONS = Object.freeze(['session-ok', 'session-no-write'])

export function settlePriorDispatches({
  ledger = [],
  currentRows = null,
  windowHours = Infinity,
  now = Date.now(),
  recordedPrefix = 200,
  sameRowPrefix = 60,
} = {}) {
  const cutoff = now - windowHours * 3600_000
  const settledOf = new Set(
    ledger.filter((e) => e.action === 'dispatch-settled').map((e) => String(e.sourceTs ?? '')),
  )
  const outs = []
  for (const e of ledger) {
    if (!SESSION_RESULT_ACTIONS.includes(e.action) || !e.ticketKey) continue
    const at = Date.parse(String(e.ts ?? ''))
    if (!Number.isFinite(at) || at < cutoff) continue
    if (settledOf.has(String(e.ts))) continue
    const thenPrefix = String(e.ticketLine ?? '').slice(0, recordedPrefix)
    if (!Array.isArray(currentRows)) {
      outs.push({
        ticketKey: e.ticketKey,
        ticketLine: thenPrefix,
        sourceTs: e.ts,
        state: 'unjudged',
        why: '派单面取不到 ⇒ 无法判这张票是否推进',
      })
      continue
    }
    const faceRow = currentRows.find((r) => ticketKeyOf(String(r.text ?? '')) === e.ticketKey)
    if (faceRow) {
      const nowPrefix = String(faceRow.text ?? '').slice(0, recordedPrefix)
      outs.push(
        nowPrefix === thenPrefix
          ? {
              ticketKey: e.ticketKey,
              ticketLine: thenPrefix,
              sourceTs: e.ts,
              state: 'no-progress',
              why: `${e.action === 'session-no-write' ? '会话零写入且' : '会话报成功但'}票行逐字未变(L${faceRow.line})`,
            }
          : {
              ticketKey: e.ticketKey,
              ticketLine: thenPrefix,
              sourceTs: e.ts,
              state: 'line-changed',
              why: `票行已改写(L${faceRow.line})`,
            },
      )
      continue
    }
    // 票键没命中 ⇒ 再问一次"还是不是那一行"。ticketKeyOf 对尾部注记不稳定(实测同一张票
    // 追加"—— 已追加进展注记"后 key 会变,而追加"（进行中@…）"认领牌 key 不变),
    // 只按 key 找行会把最常见的"只写了注记"掉进 line-gone,而那与"整票结清"是两回事(§10)。
    const headKey = thenPrefix.slice(0, Math.min(sameRowPrefix, thenPrefix.length))
    const sameRow = headKey
      ? currentRows.find((r) => String(r.text ?? '').startsWith(headKey))
      : null
    if (sameRow) {
      outs.push({
        ticketKey: e.ticketKey,
        ticketLine: thenPrefix,
        sourceTs: e.ts,
        state: 'line-changed',
        why: `票键随注记漂移但行首同源 ⇒ 同一张票被改写(L${sameRow.line}),不得记成结清摘行`,
      })
      continue
    }
    outs.push({
      ticketKey: e.ticketKey,
      ticketLine: thenPrefix,
      sourceTs: e.ts,
      state: 'line-gone',
      why: '派单面上既无同票键也无同前缀行 ⇒ 已摘行或摘出在飞',
    })
  }
  return outs
}

function pickTickets() {
  const r = spawnSync(process.execPath, [PLAN_TASKS, ...DISPATCH_ARGS], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    windowsHide: true,
    // 超时按当次实测抬到 300s(2026-11-05 现读:`plan-tasks --open` 112s;+`--dispatchable` 97s;
    // +`--exclude-inflight` 79s;机器忙时冲到 170s)。旧值 120s 在多席共树的忙时段**必然被击穿**,
    // 表现就是 `pickTickets ETIMEDOUT` ⇒ 环整天拿不到票池(这是 `artifact-committed=0` 的第一因)。
    // 这一档的失效方向仍是"取不到 ⇒ 未判定不派"(不会因抬额度而误派),所以抬是安全的;
    // 治本在取票口自身提速(已登记台账单),不是把超时再叠一层。
    timeout: 300_000,
    encoding: 'utf8',
  })
  if (r.error) throw new Error(`派单面取不到:${r.error.message}`)
  const rows = parseTicketRows(r.stdout)
  if (rows.length === 0 && r.status !== 0) {
    throw new Error(
      `派单面未判定(status=${r.status}):${String(r.stderr ?? r.stdout ?? '').slice(-300)}`,
    )
  }
  return rows
}

/** 失败文本取证:两流各取自己的头尾并标来源,不先拼再截(拼起来截尾会把先拼的那条整段挤掉)。 */
export function excerptBothEnds(stderr, stdout, max = 150) {
  const one = (label, raw) => {
    const s = String(raw ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!s) return null
    return s.length <= max * 2
      ? `${label}=${s}`
      : `${label}=${s.slice(0, max)} …〔中略 ${s.length - max * 2} 字〕… ${s.slice(-max)}`
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
    // 结构上不许发出 `valve-undefined`:调用方没给判定结果时那本身就是"没判",归 unjudged 档
    // (它已在阶梯的豁免表里带理由登记),而不是造一枚没人分档的新串把覆盖锁绕过去。
    action: `valve-${VALVE_ACTIONS.includes(valve?.action) ? valve.action : 'unjudged'}`,
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

/**
 * 票面范围预解析(2026-11-05 立)。把票文里反引号圈出的**代码标识符 / 路径**在 HEAD 面现查一遍,
 * 把命中文件写进派发 prompt,并把"这一枚可能已经实现"这件事讲明白。
 *
 * 立因(不是推断,是量出来的):68 份派发转录写类工具命中 **0 次**;今天这班(票 eb2ab5be4ad486ee,
 * 174.5 秒 / 432,746 tokens / exit 0)被记 `session-no-write`,它的最后一句是「找到目标文件了。
 * 现在读取关键部分……」——一路读到 end_turn 也没动笔。而它被派去"新增"的 `compute_simhash`
 * 在 HEAD 面**已经存在**(`git grep` 现读命中 `apps/ai-service/app/services/rename_detect.py` 等)。
 * 会话缺的不是权限,是"该往哪儿写 / 是否已经写过"这一格事实 —— 那格事实调度侧查得到,而且更便宜。
 *
 * 失效方向(§0.3):查不到 ⇒ 如实写"未命中",**不拦派发**(拦了就是把环饿死);取数口抛错 ⇒
 * 整块落 `undetermined` 并在 prompt 里报名,绝不拿"没查到"冒充"不存在"。
 * 排除 `*.md`:散文里提一句不等于实现存在(台账行自己就会命中,那是循环引用)。
 */
export function extractTicketScopeHints(text, { maxIdents = 6, maxPaths = 6 } = {}) {
  const idents = []
  const paths = []
  for (const m of String(text ?? '').matchAll(/`([^`\n]{2,120})`/g)) {
    const s = m[1].trim()
    if (!s) continue
    // 路径形态:含斜杠且带扩展名(`apps/x/y.py`、`scripts/lib/a.mjs`)
    if (/^[A-Za-z0-9_.\-/]+\/[A-Za-z0-9_.\-/]+\.[A-Za-z0-9]{1,6}$/.test(s)) {
      if (!paths.includes(s) && paths.length < maxPaths) paths.push(s)
      continue
    }
    // 点号成员引用(`ignore_rules.filter_paths`、`a.b.c`)—— 2026-11-05 实测漏判补上:
    // P84 那行只带这一种标识符,旧提取器两类都不认 ⇒ 被读成"无从预检",
    // 而它的实现其实在位、判据实跑 5/5 绿。盲点不补,同类票明天照样漏。
    // 只认**尾段够具体**(≥6 字符)的:查询打的是尾段名,尾段太短(`a.b.c` 的 `c`、
    // `id.other` 的 `other`)会把一片无关文件捞成"已命中",那是假阳,比漏判更坏。
    if (
      /^[A-Za-z_][A-Za-z0-9_]{1,}(?:\.[A-Za-z_][A-Za-z0-9_]{1,}){1,3}$/.test(s) &&
      (s.split('.').pop().length ?? 0) >= 6
    ) {
      if (!idents.includes(s) && idents.length < maxIdents) idents.push(s)
      continue
    }
    // 裸点文件(`.gitignore`、`.dockerignore`):按存在性核,不当标识符
    if (/^\.[A-Za-z0-9_][A-Za-z0-9_.-]{1,40}$/.test(s)) {
      if (!paths.includes(s) && paths.length < maxPaths) paths.push(s)
      continue
    }
    // 标识符形态:纯代码名,≥4 字符(滤掉 `id`/`api` 这类噪声与整段中文)
    if (/^[A-Za-z_][A-Za-z0-9_]{3,60}$/.test(s)) {
      if (!idents.includes(s) && idents.length < maxIdents) idents.push(s)
    }
  }
  return { idents, paths }
}

/**
 * 用注入的取数口算范围表(纯逻辑,可在测试里成对造命中/未命中/取不到三态)。
 * `grepFn(ident)` ⇒ `HEAD:<path>` 逐行文本或 null(取不到);
 * `existsFn(path)` ⇒ true/false/null(取不到,不等于不存在)。
 */
export function buildTicketScope(
  text,
  {
    rev = 'HEAD',
    grepFn,
    existsFn,
    maxIdents = 4,
    maxFilesPerIdent = 6,
    budgetMs = 30_000,
    now = () => Date.now(),
  } = {},
) {
  const { idents, paths } = extractTicketScopeHints(text, { maxIdents })
  const out = {
    rev,
    hits: [],
    absentPaths: [],
    presentPaths: [],
    unresolved: [],
    undetermined: [],
    identCount: idents.length,
    pathCount: paths.length,
  }
  const t0 = now()
  for (const ident of idents) {
    // 预算闸:实测单枚 git grep 在本仓约 6 秒(多席共树时更慢),取票口已经在 79–170 秒档上,
    // 再叠 4 枚是环的第三瓶颈。越过预算 ⇒ 余下逐枚点名"未判定"(§0.3:没查完就说没查完)。
    if (now() - t0 > budgetMs) {
      out.undetermined.push(`${ident}(未判定:预算 ${Math.round(budgetMs / 1000)}s 已用尽,未查)`)
      continue
    }
    let raw = null
    // 点号引用按**末段**去查(代码里 import 的是末段名,全串 `a.b` 反而搜不到);
    // 标签仍保留点号全称,并在文案里注明"按末段核"—— 换了查询体就得换了说法(§0.3)。
    const key = ident.includes('.') ? ident.split('.').pop() : ident
    try {
      raw = grepFn ? grepFn(key) : null
    } catch {
      raw = null
    }
    if (raw === null || raw === undefined) {
      out.unresolved.push(ident)
      out.undetermined.push(`${ident}(未判定:取数口没答)`)
      continue
    }
    const files = raw
      .split(/\r?\n/)
      .map((l) => l.replace(/^[^:]+:/, '').trim())
      // 排除的是"不可能算实现"的面:散文(*.md)、机读台账(*.jsonl)、逆向取证件(.archify/)
      .filter(
        (p) => p && !/\.md$/i.test(p) && !/\.(jsonl|json)$/i.test(p) && !p.startsWith('.archify/'),
      )
      .slice(0, maxFilesPerIdent)
    if (!files.length) {
      out.unresolved.push(ident)
      continue
    }
    out.hits.push({ ident, files, via: ident.includes('.') ? 'tail' : 'exact' })
  }
  for (const p of paths) {
    let exists = null
    try {
      exists = existsFn ? existsFn(p) : null
    } catch {
      exists = null
    }
    if (exists === null || exists === undefined) out.undetermined.push(`${p}(未判定:存在性取不到)`)
    else if (exists) out.presentPaths.push(p)
    else out.absentPaths.push(p)
  }
  return out
}

/** 范围表 → prompt 段落(空表也要出一段,写明"没查到"不等于"不存在")。 */
export function renderTicketScope(s) {
  const L = []
  L.push(`## 范围预解析(调度侧在 ${s.rev} 面现查,排除 *.md;这是事实不是建议)`)
  if (s.hits.length) {
    for (const h of s.hits)
      L.push(
        `- 标识符 \`${h.ident}\` 已命中${h.via === 'tail' ? '(点号引用按末段核)' : ''}:${h.files.join('、')}`,
      )
    L.push(`- **先读这些命中文件再决定动不动笔**:若本票要造的东西已经在里面,本票就是**已被实现**——`)
    L.push(
      `  不要再写第二份、不要改名重嵌,回答里点名「已实现于 <文件> <证据>」并保持票未勾正常退出。`,
    )
    L.push(
      `  这一档不会被记成完成(自治会话没有翻勾能力),但它是**有效结论**:比零写盘的"我再读一遍"值钱。`,
    )
  } else if (s.identCount === 0) {
    L.push(`- 票面没抽到可查的代码标识符 ⇒ 本表**无结论**(这不等于"目标不存在",按票面自行定位)。`)
  } else if (s.undetermined.length) {
    L.push(`- 本表**没答全**(见下"未判定")⇒ 不作"存在/不存在"任何结论,按只读手段自行定位。`)
  } else {
    L.push(`- 标识符层被权威回"没有"(git grep 退出码 1)⇒ 目标确实尚不存在,按票面新建。`)
  }
  if (s.unresolved.length)
    L.push(`- 没查到的标识符:${s.unresolved.map((x) => `\`${x}\``).join('、')}`)
  if (s.presentPaths.length)
    L.push(`- 票面路径已存在:${s.presentPaths.map((x) => `\`${x}\``).join('、')}`)
  if (s.absentPaths.length)
    L.push(`- 票面路径不存在(需新建):${s.absentPaths.map((x) => `\`${x}\``).join('、')}`)
  if (s.undetermined.length) {
    L.push(`- **未判定**(取数口没答,不等于"没有"):${s.undetermined.join('、')}`)
  }
  return L.join('\n')
}

/**
 * 停派那一刻回答"池里到底还剩几张**打得赢**的票"(2026-11-05 立)。
 *
 * 立因(手搓预演量出来的,环自己看不见):某轮现读派单面 21 行、白名单命中 **2** 行,
 * 其中一枚的全部 4 个标识符在 HEAD 面**已命中既有实现**(就是那张被派过 15 次的 P85),
 * 另一枚"无标识符可核"。⇒ 那一刻即便额度未满,也几乎无活可派。
 * 但这种读数此前只能靠人手跑一遍范围解析才看得到,明天它会再次隐形,
 * 于是"环零产出"会被继续读成"模型偷懒"。把这一格装进环自己,判据复用派发侧那一份
 * `buildTicketScope`(§0.6 不另造尺),只在**本轮不派**的两种出口上算,免得给正常轮加时间。
 * 成本闸:最多核 3 张(实测单枚 `git grep` 本仓约 6 秒,3 枚 + 30s 预算封顶),
 * 超出的一律如实记 `未核 N` —— 没核完就说没核完,不拿前 3 张冒充整池(§0.3)。
 */
export function readPoolWinnability(rows, { rev, grepFn, existsFn, max = 3 } = {}) {
  const list = Array.isArray(rows) ? rows : []
  const t = { 可新建: 0, 疑已实现: 0, 无从预检: 0, 未判定: 0, 未核: 0 }
  for (let i = 0; i < list.length; i++) {
    if (i >= max) {
      t.未核++
      continue
    }
    const s = buildTicketScope(String(list[i]?.text ?? ''), { rev, grepFn, existsFn })
    if (s.identCount === 0) t.无从预检++
    else if (s.hits.length) t.疑已实现++
    else if (s.undetermined.length) t.未判定++
    else t.可新建++
  }
  return t
}

function poolWinnabilityNote(rows) {
  const rev = headShaOf() || 'HEAD'
  try {
    const t = readPoolWinnability(rows, {
      rev,
      grepFn: (i) => {
        const p = gitProbe(['grep', '-l', '-i', '-F', '-e', i, rev])
        return p === null || p.status >= 2 ? null : p.stdout
      },
      existsFn: (p) => {
        const r = gitProbe(['cat-file', '-e', `${rev}:${p}`])
        if (!r || r.status >= 2) return null
        return r.status === 0
      },
    })
    return `池可赢性(核 ${Math.min(rows.length, 3)}/${rows.length} 枚,判据同派发侧)可新建${t.可新建} 疑已实现${t.疑已实现} 无从预检${t.无从预检} 未判定${t.未判定} 未核${t.未核}`
  } catch (e) {
    return `池可赢性 未判定(${String(e?.message ?? e)
      .split(/\r?\n/)[0]
      .slice(0, 80)})`
  }
}

/**
 * 一班会话是不是"被环自己的上限掐掉的"(RP-74 相关,2026-11-06 抽成纯出口)。
 *
 * 为什么要抽出来:这一段原本内联在 `dispatchSession` 里,而那个函数真派子进程,
 * 测试够不到 ⇒ "超时那一支把 failureKind 落在哪" 这条判据只能靠端到端摸(§0.9:摸不到=没锁)。
 * 现读依据:台账里 `session-timeout` **历史上 0 行**、107 条会话行最长 28.5 分钟、
 * `maxSessionMinutes` 现读 45 ⇒ 这一支从没在真跑里落过地,而它的缺省 `failureKind='ok'`
 * 一旦被触发就会把"被掐死"读成"成功"。趁它还没咬人先把归类钉对。
 *
 * 判序两条都保留(与改前逐字同条件),只把结论抽成机读:
 *  ① `error.killed` —— Node 自己报被杀;
 *  ② SIGTERM 且耗时已顶到上限(留 5s 抖动余量)—— Windows 上超时常表现为信号而无 killed 标记。
 * 时长取不到 ⇒ 不判超时(不把"量不动"读成"被掐死",也不读成"正常结束")。
 */
export function classifyTimedOutRound({
  killed = false,
  signal = null,
  durationMs = null,
  maxSessionMinutes = null,
} = {}) {
  if (killed === true)
    return {
      timedOut: true,
      failureKind: 'cancelled',
      exitCode: null,
      why: `子进程被杀(error.killed)⇒ 本轮按取消判,不计该票连败${signal ? `(信号=${signal})` : ''}`,
    }
  const cap = Number(maxSessionMinutes)
  const dur = Number(durationMs)
  // 上限或耗时取不到 ⇒ 不判超时。这不是"第三种结局":loadGates 已把 maxSessionMinutes 校成
  // 正整数,而 NaN 参与比较的旧行为本来就是 false —— 这里只是把那条恒假写得可见。
  if (!Number.isFinite(cap) || cap <= 0 || !Number.isFinite(dur) || dur < 0)
    return { timedOut: false, failureKind: null, exitCode: null, why: '' }
  if (signal === 'SIGTERM' && dur >= cap * 60_000 - 5_000)
    return {
      timedOut: true,
      failureKind: 'cancelled',
      exitCode: null,
      why: `超过 maxSessionMinutes=${cap}(SIGTERM,实测 ${Math.round(dur / 1000)}s)⇒ 本轮按取消判,不计该票连败`,
    }
  return { timedOut: false, failureKind: null, exitCode: null, why: '' }
}

function dispatchSession(gates, ticket, dryRun) {
  const key = ticketKeyOf(ticket.text)
  if (!gates.sessionCommandTemplate.trim()) {
    return {
      action: 'template-empty',
      why: 'sessionCommandTemplate 未配置 ⇒ 本轮只取票记账,不冒充执行(§0.3)',
    }
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
  // 范围表在**派发那一刻**算(不在票池生成时算:票池可能几轮前生成,期间别席已实现)。
  const revForScope = headShaOf() || 'HEAD'
  const scope = buildTicketScope(ticket.text, {
    rev: revForScope,
    grepFn: (ident) => {
      const p = gitProbe(['grep', '-l', '-i', '-F', '-e', ident, revForScope])
      // 退出码 1 是 git 自己说的"确实没有" ⇒ 交回空串(算查到没有),>=2 / 派生失败 ⇒ null 不猜
      return p === null || p.status >= 2 ? null : p.stdout
    },
    existsFn: (p) => {
      const r = gitProbe(['cat-file', '-e', `${revForScope}:${p}`])
      if (!r || r.status >= 2) return null
      return r.status === 0
    },
  })
  const promptText = [
    `# 派发票(auto-evolve 单轮)`,
    ``,
    `- 票面:${ticket.text}`,
    `- 台账行:L${ticket.line}(PROJECT_PLAN.md,行号会漂移,以题面定位)`,
    ``,
    `**仓根唯一取值(调度侧现读)= \`${ROOT}\`**。转录实测到有会话拿 \`G:/IHUI-AI\` 拼路径`,
    `(那是另一台机器的历史登记,不是本机事实)⇒ 本会话一切相对路径都以这一行为准。`,
    ``,
    renderTicketScope(scope),
    ``,
    `按 AGENTS.md 全部强制条款执行本票;只改本任务文件。`,
    `**取材纪律(2026-11-04 立,有实测依据)**:禁止整份读取 \`PROJECT_PLAN.md\` / \`AGENTS.md\`(本仓现读`,
    `台账数万行、规则正文近 9.6 万字节 —— 一次全文读就把本会话的上下文吃光,实测到的一轮是`,
    `promptTokens≈12.6 万而 completionTokens 只有 22,终态 \`no_progress\`,等于白烧一个班次)。`,
    `要看规则或台账:用带行区间/grep 的取段方式,单次只取与本品直接相关的片段;`,
    `票面里已有的信息不要再回台账找一遍。动手前先读**目标文件本身**,不是读它的登记行。`,
    `**判据面(受保护面)不许动**:清单 = \`scripts/data/immutable-guard.json\` 的 \`path\` 字段(现读,勿凭记忆),`,
    `命中即落账腿整批拒收(自治会话没有豁免签名权,补理由放行=替自己发豁免)。本票若非动那些面不可,`,
    `**不要动**:保持票未勾,正常退出并在回答里写明「本票需先动判据面 <路径> <为什么必须动>」—— 票行的推进由调度侧做(见下"你的交付边界")。`,
    ``,
    `## 你的权限是硬的(2026-11-04 定,照它规划、别试别绕)`,
    `本会话跑在 \`--permission-mode acceptEdits\`:只有 \`dangerLevel:'write'\` 的工具放行`,
    `(\`write_file\` / \`edit_file\` / \`batch_edit\`),读类(\`read_file\`/\`grep\`/\`glob\`/\`list_dir\`/\`lsp_*\`/\`get_diagnostics\`)放行,`,
    `而 dangerous 档一律被拒(实现 = \`apps/cli/src/tools/danger-gate.ts\`:无头会话没有审批人 ⇒ denied)。`,
    `因此以下动作你**做不成**,试了只白烧一次往返:\`run_command\`、\`run_tests\`、\`git_commit\`、\`delete_file\`、\`batch_undo\`,`,
    `以及任何"跑一条命令看看"的念头。`,
    `为什么这一格必须写清:实测 9 次"退出码 0"的会话没有一次写过文件 —— 它们想先把"验证齐绿"做到而没有执行手段。`,
    `验证与提交是调度器的活,不是你的。`,
    ``,
    `## 你的交付边界`,
    `- 你交付的只有两样:**改过的文件** + **下面那份落账清单**。提交、跑测试、跑守门、翻勾、写台账都由调度侧在你之后做。`,
    `- 因此**禁止**给出"已跑 typecheck / 已跑测试 / 守门全绿"这类你不可能持有的证据;`,
    `  自检只用只读手段(\`get_diagnostics\` 看本文件、\`read_file\` 回读改动),并如实写"仅静态自检,未执行验证"。`,
    `- \`PROJECT_PLAN.md\` 既不在你能力内(live-doc-edit 是命令)也不在落账允许集内(活文档):**不要碰它、不要写进清单**。`,
    ``,
    `## 工序(硬性顺序,治"整班只读")`,
    `0. **第 1 轮就要发出工具调用本身**,不要在正文里写"我打算调用 read_file" —— 实测到过一种班次:`,
    `   七轮里全是文字叙述 + 描述性计划、零次真实工具调用而 exit=0,那种班对票面推进等于没上。`,
    `1. 只读与本品直接相关的目标文件(带行区间/grep 取段,禁止整份读大文件)。`,
    `2. **读完目标文件后,下一次工具调用就必须是 \`write_file\`/\`edit_file\` 动笔** —— 不是继续检索。`,
    `   实测到的失效形态:19 轮 grep/read/list_dir 零写入,班次白烧到 end_turn。`,
    `   还需要上下文时,先把已经能确定的一部分改动写下去,再针对那一处补读。`,
    `3. 收尾前最后一步写落账清单(见下)。整票做不完就保持未改并如实说明(账面会如实记为没动手,`,
    `   下一轮还会再来),禁止"写完了你看下"式半成品。`,
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
    `- 完成整票 = 文件已改 + 清单已写(验证与提交由调度器代劳)。做不到就保持未改并如实说明,禁止半成品。`,
    `- 若判定本票工作量超出单会话预算(maxSessionMinutes=${gates.maxSessionMinutes} 分钟),立即停下:不写任何代码,`,
    `  在回答里给出工作量评估后正常退出(这是合法退出,但账面仍记为本轮未动手 —— 不会冒充成功)。`,
  ].join('\n')
  writeFileSync(promptFile, promptText, 'utf8')
  const filled = fillTemplate(resolved, {
    promptFile,
    ticketLine: ticket.text,
    ticketKey: key,
    sessionModel: gates.sessionModel,
    sessionApiUrl: gates.sessionApiUrl,
  })
  const rt = normalizeSessionRuntime(filled)
  const cmd = rt.cmd
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
  let action,
    failureKind = 'ok',
    exitCode = 0,
    why = '',
    timedOut = false,
    writes = null
  const roundCut = classifyTimedOutRound({
    killed: r.error?.killed === true,
    signal,
    durationMs,
    maxSessionMinutes: gates.maxSessionMinutes,
  })
  if (roundCut.timedOut) {
    action = 'session-timeout'
    exitCode = roundCut.exitCode
    timedOut = true
    failureKind = roundCut.failureKind
    why = roundCut.why
    // 归类理由(为何不再是 'ok')见 classifyTimedOutRound 头注与 ⓪ 那段现读依据。
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
    const kind = classifySessionFailure({
      status: r.status,
      stderr: `${stderr}\n${stdout}`,
      signal,
    })
    // 2026-11-05:退出码含义排在文本签名之前。exit=3 是 CLI 自己的 `no_progress` 终态
    // (整班无工具调用 + 空正文),把它记成 session-failed 会走连败封票,记成
    // runner-unavailable 又成了"我的腿断了"的借口 —— 两向都是错的归因。
    action = kind.kind === 'no-progress' ? 'session-no-progress' : 'session-failed'
    failureKind = kind.kind
    exitCode = r.status
    why = `exit=${r.status} ${errText}`
  } else {
    action = 'session-ok'
    const w = classifySessionWrites(stdout)
    writes = w
    if (w.known && w.writeOk === 0) {
      // "结束了"不等于"干成了",而"干成了却没交清单"与"整班没动手"是该往两个方向修的两件事。
      action = 'session-no-write'
      why =
        w.writeTried > 0
          ? `exit=0 但 ${w.writeTried} 次写类工具调用无一成功(成功写 0 / 工具结果 ${w.toolResults} 条)⇒ 本轮工作树零改动`
          : `exit=0 但全程只读未写(写类 0 次 / 工具结果 ${w.toolResults} 条)⇒ 结构上产不出落账清单,别把这一档当"成功"`
    }
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
    // 写盘读数(仅 exit 0 那支持有值):台账里 `session-ok` 与 `session-no-write` 的分界就是它,
    // 也是"清单缺失该催会话还是该改指令"的取数口。未取到 ⇒ null,不用 0 冒充"没写"。
    // 判别码单独成字段(2026-11-05 立):`why` 由 stderr 头部拼成,实测今日 6/6 枚失败行都被
    // 一行与死因无关的 `[skills] conservative load…` 警告占住 ⇒ 读台账的人必然归因错。
    providerError: lastProviderError(stdout),
    writeOk: writes ? writes.writeOk : null,
    writeTried: writes ? writes.writeTried : null,
    // 运行时是否被归一(裸 node ⇒ 当前进程可执行文件)。不记这一格,下次换机/换服务身份时
    // "会话根本没起来"又会只留下一个 exit=1 的 session-failed,没人看得见是 PATH 的哪一层。
    runtimeNormalized: rt.replaced,
    runtimeWhy: rt.why,
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
  const face = String(ticketText ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return [
    `${commitPrefixOf(ticketText)}: ${face.slice(0, 80)}`,
    '',
    `票键:${ticketKey}`,
    `票面:${face}`,
    `落账:auto-evolve 会话后按 ${manifestPathOf(ticketKey)} 代提交(会话侧无提交权)`,
  ].join('\n')
}

/**
 * 派发前闸「瞬时不在位」的复核计划(纯判据,零 IO ⇒ 可锁)。
 *
 * 立因(台账现读,不是推测):18:45:09 与 19:00:01 两轮停在
 * `runner-preflight-missing`,`missing` 字段逐枚点名的都是同一枚
 * `D:\IHUI-AI/apps/cli/node_modules/tsx/dist/cli.mjs`;而我 19:50 手工复核它**在位**,
 * mtime 还是 11-03 ⇒ 它是被别席 `pnpm install` **瞬时移走/重挂**的,不是产物真的没了。
 * 一轮停派 = 一次日预算与一整班等待白费,而它自愈只要几秒。
 *
 * 口径:只对 `missing` 复核(其他状态如 `undetermined`/`template-empty` 是"判不出/没配",
 * 重试不会改变输入,不许拿来当兜底);复核次数与间隔都是常量级、有上界,不引入无界等待。
 */
export function preflightRecheckPlan(state, attempt, { maxRechecks = 2, delayMs = 4000 } = {}) {
  const a = Number(attempt)
  const max = Number(maxRechecks)
  if (!Number.isFinite(a) || !Number.isFinite(max)) return { recheck: false, delayMs: 0 }
  if (state !== 'missing') return { recheck: false, delayMs: 0 }
  // attempt 从 1 起(首次核验),复核第 N 次对应 attempt = N+1
  if (a < 1 || a > max + 1) return { recheck: false, delayMs: 0 }
  return { recheck: a <= max, delayMs: a <= max ? Math.max(0, Number(delayMs) || 0) : 0 }
}

/**
 * 「未取号占位行」判据(2026-11-06 立,现读依据:`PROJECT_PLAN.md` 面上仍有 1 行
 * `- [ ] {{NEXT_ID:docs-207}} …`,而它正被当成真票送进判期与风险阀,还计入白名单命中)。
 *
 * 为什么必须**显式跳过**而不是让它流过去:
 *  - 这种行的编号还没分配,任何"认领/翻勾/摘行"都无处落笔 ⇒ 会话做完也结不清,票面永远挂着;
 *  - 它会被模型判期打风险分(今夜实测:`L31450 不入本轮:风险硬阻断:触碰铁律=3`)⇒ 白占一轮判定,
 *    并把"命中白名单却全被拦"的账面弄成看起来像白名单问题(实际是台账卫生问题)。
 * 失效方向照 §0.3:只认这一种确定形态(花括号里是 `NEXT_ID`),不做模糊匹配、不顺手摘别人的行。
 */
export function isPlaceholderTicketRow(text) {
  return /\{\{\s*NEXT_ID(?:[:\s][^}]*)?\}\}/.test(String(text ?? ''))
}

/**
 * 「这张票的产物是否已被本环落进 HEAD」——派单前的重派排除(2026-11-05 立)。
 *
 * 立因:落账腿成功后,票行仍是 `- [ ]`(结清属活文档写口,本器不登记,见文件头第 14 行),
 * 而选择路径上**没有任何一格**认得"这枚已经做过了"⇒ 同一张票在下一班、明日、甚至当天就会被
 * 再派一次;重复派发的产物不是"再来一遍就好",而是**第二份近似测试文件**(同端点、不同文件名),
 * 那种残骸只能人肉剔。今天的实测形态:票 B71 当天被真派到第 10 次,全靠封禁/预算扣住。
 *
 * 判据取向:不查台账尾窗(台账只载最近若干行,落地枚一过期就查不到 ⇒ 把"已做过"读成"没做过"),
 * 直接问 git —— 落地代提交的信息里恒有 `票键:<key>` 那一行(`buildArtifactCommitMessage` 唯一出口),
 * 提交面是持久事实,票面被改写则键随之改变 ⇒ 改写后的新射程仍会被正常派发(这是对的语义)。
 *
 * 失效方向(§0.3,与 `buildTicketScope` 的"不拦派发"同条纪律):派生失败/超时/取不到 ⇒ 返回 null
 * ⇒ **不拦**。把"我量不动"写成"已落地"会整面饿死,而这里要的恰恰是反过来。
 *
 * `gitLogFn` 注入 = 与 `selectDirtyPaths` 的 `statusFn` 同款:判据只住这一处,测试不抄第二份。
 */
export function landedCommitOfTicket(key, { gitLogFn } = {}) {
  const needle = `票键:${key}`
  if (!key) return null
  try {
    const out = gitLogFn
      ? gitLogFn(needle)
      : gitRead(['log', '--fixed-strings', `--grep=${needle}`, '--format=%H', '-n', '1'])
    if (out === null || out === undefined) return null
    const sha = String(out).trim().split(/\r?\n/)[0] ?? ''
    return /^[0-9a-f]{7,40}$/i.test(sha) ? sha : null
  } catch {
    return null
  }
}

/**
 * 账面挂账搁置台账的解析(纯函数,零 IO)。三态绝不并桶(§0.3):
 *  - ok          台账在场且逐行形状成立 ⇒ held 里每一枚都带归属/原因/到期;
 *  - absent      台账**不存在**(ENOENT)⇒ 零搁置,但读数必须写成"没这本账",不得写成"查过且无需搁";
 *  - undetermined 读了但取不到内容 / JSON 坏 / 行形状不成立 ⇒ **一条都不搁**并逐条点名坏行。
 *    "拿不到尺子"不能读成"没有票要搁",也不能读成"所有票都搁"——两个方向都放行错的那一半。
 *
 * 到期(expires < now)不是豁免的延续:该枚进 `expired` 并从 held 剔除 ⇒ **自动回到派单面**。
 * 这一格是有意的终态:本仓被"永久豁免制造死角"咬过(§豁免必须会到期)。
 * 匹配键两型二选一:`key`(票键指纹,票面改写即失配 ⇒ 新射程照派,这是对的语义)或
 * `head`(标题片段,用于别席已入库但正文没带票键的那两枚:`landedCommitOfTicket` 结构上认不出它们)。
 */
export function parseSupplyHolds(text, { now = Date.now(), absentOk = false } = {}) {
  if (text === null || text === undefined) {
    return absentOk
      ? {
          state: 'absent',
          why: '搁置台账不存在(ENOENT)⇒ 本轮零搁置;这是"没这本账",不是"查过且无需搁"',
          held: [],
          expired: [],
          problems: [],
        }
      : {
          state: 'undetermined',
          why: '搁置台账取不到 ⇒ 一条都不搁(不把"量不动"读成"要搁"或"无需搁")',
          held: [],
          expired: [],
          problems: [],
        }
  }
  const held = []
  const expired = []
  const problems = []
  const lines = String(text).split(/\r?\n/)
  lines.forEach((line, i) => {
    const t = line.trim()
    if (!t) return
    let e
    try {
      e = JSON.parse(t)
    } catch (err) {
      problems.push({ line: i + 1, why: `JSON 坏:${String(err?.message ?? err).slice(0, 80)}` })
      return
    }
    if (!e || typeof e !== 'object' || Array.isArray(e)) {
      problems.push({ line: i + 1, why: '不是对象行' })
      return
    }
    const key = typeof e.key === 'string' ? e.key.trim() : ''
    const head = typeof e.head === 'string' ? e.head.trim() : ''
    const owner = typeof e.owner === 'string' ? e.owner.trim() : ''
    const reason = typeof e.reason === 'string' ? e.reason.trim() : ''
    const expires = typeof e.expires === 'string' ? e.expires.trim() : ''
    const miss = []
    if (!key && !head) miss.push('key/head 至少一枚(两枚皆空 = 谁也匹配不上的死条目)')
    if (!owner) miss.push('owner 必填(没有归属的搁置 = 无人负责的停派)')
    if (reason.length < 10) miss.push('reason 需 ≥10 字(与人工阀/豁免同一道门槛)')
    const expMs = /^\d{4}-\d{2}-\d{2}$/.test(expires) ? Date.parse(`${expires}T23:59:59Z`) : NaN
    if (!Number.isFinite(expMs)) miss.push(`expires 需 YYYY-MM-DD(现值 ${JSON.stringify(expires)})`)
    if (miss.length) {
      problems.push({ line: i + 1, why: miss.join(' / ') })
      return
    }
    const entry = { key, head, owner, reason, expires, ticket: String(e.ticket ?? '') }
    if (expMs < now) {
      expired.push(entry)
      return
    }
    held.push(entry)
  })
  if (problems.length)
    return {
      state: 'undetermined',
      why: `${problems.length} 行形状不成立 ⇒ 整本账不作数(逐条点名见 problems),一条都不搁`,
      held: [],
      expired,
      problems,
    }
  if (expired.length)
    return {
      state: 'ok',
      why: `其中 ${expired.length} 枚已到期 ⇒ 已回到派单面(搁置不是一纸长期豁免)`,
      held,
      expired,
      problems: [],
    }
  return { state: 'ok', why: '', held, expired, problems: [] }
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
 *  - artifact-committed         至少一枚真有改动 ⇒ 调私有索引通道(isolated-git)代提交并自证落地
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
    return {
      state: 'undetermined',
      landable: [],
      protectedHits: [],
      problems: [{ code: 'parse-throw', message: String(e?.message ?? e) }],
    }
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
  return {
    state: protectedHits.length > 0 ? 'blocked' : 'clean',
    landable,
    protectedHits,
    problems: [],
  }
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
      why: `dry-run 不提交;真跑会调 isolated-git 提交 ${dirty.length} 枚(票键 ${ticketKey}${dropped.length ? `,剔除 ${dropped.length} 枚无改动` : ''})`,
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
    // 席位短名进 AI 归属 notes;缺它 notes 那一腿只能记未判定,审计链断在这里。
    IHUI_AGENT_SESSION_ID: 'auto-evolve',
  }
  let r
  try {
    r = commitFn({
      files: dirty,
      message: buildArtifactCommitMessage({ ticketKey, ticketText }),
      env,
    })
  } catch (e) {
    // 并发索引锁/进程起不来都不许把整轮打崩:落 failed 台账,下一轮照常。
    return {
      action: 'artifact-commit-failed',
      files: dirty,
      dropped,
      why: `代提交抛错(不牵连本轮):${e?.message ?? e}`,
    }
  }
  if (!r || r.ok !== true) {
    return {
      action: 'artifact-commit-failed',
      files: dirty,
      dropped,
      why: `代提交未落地或未自证通过(status=${r?.status ?? '?'}):${String(r?.stderr ?? '').slice(-300) || '(无输出)'}`,
    }
  }
  return {
    action: 'artifact-committed',
    files: dirty,
    dropped,
    why: `isolated-git 已落地并自证通过(票键 ${ticketKey},sha ${(r?.landedSha ?? '').slice(0, 12)})`,
  }
}

/** 清单现读:读不到(不存在/读失败)一律 null ⇒ 上层落 missing,不猜内容。 */
function readArtifactManifest(ticketKey) {
  try {
    return readFileSync(join(ROOT, manifestPathOf(ticketKey)), 'utf8')
  } catch {
    return null
  }
}

/**
 * 单文件改动现读。抛错上抛给 selectDirtyPaths 判 stale —— 取不到不许读成"有改动"。
 * maxBuffer 必给(2026-11-04 立):默认 1MiB,而本仓工作树面实测会让 `git status` 输出超阈值 ⇒
 * `spawnSync git ENOBUFS`。这条不是假设:同一天 CLI 侧 security-scan 已因同型问题永久未判定
 * (`missing=untracked-files-over-cap…;git-diff-HEAD-unavailable: spawnSync git ENOBUFS`)。
 * 更要紧的是归因:这里抛出的串直接进 stale 的 why,而 why 的措辞是"没有一个文件真有改动"——
 * 缓冲区不足被那样说出来,会把"我量不动"写成"它没改"(§0.3 的反面),所以把 ENOBUFS 点名出来。
 */
function gitPorcelainOf(file) {
  let out
  try {
    out = gitRaw(['status', '--porcelain', '--', file], ROOT, {
      timeout: 60_000,
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch (e) {
    if (e?.code === 'ENOBUFS') throw new Error('ENOBUFS(输出超缓冲区,不是"没有改动")')
    if (typeof e?.status === 'number')
      throw new Error(`git status 退出码 ${e.status}:${String(e.stderr ?? '').slice(-160)}`)
    throw new Error(String(e?.message ?? e))
  }
  return String(out ?? '')
}

/** 仓内 git 只读取数:显式 stdio(§12g)+ 大 maxBuffer(ENOBUFS 实测会吞掉整段输出),取不到一律 null 不猜。 */
function gitRead(args) {
  try {
    return String(gitRaw(args, ROOT, { timeout: 60_000, maxBuffer: 64 * 1024 * 1024 }) ?? '').trim()
  } catch {
    return null
  }
}

/**
 * 带**退出码**的 git 只读探针(2026-11-05 立,给范围预解析用)。
 * 为什么不能再借 `gitRead`:它把"非 0"一律折成 null,而 `git grep`/`cat-file -e` 的
 * 退出码 1 是一句**可信的否定**("确实没有")—— 折成 null 就等于把"没有"说成"没判",
 * 环会因此永远拿不到"该新建"这个结论。形状:`{status, stdout}`;派生失败 ⇒ null。
 */
function gitProbe(args) {
  try {
    return {
      status: 0,
      stdout: String(gitRaw(args, ROOT, { timeout: 60_000, maxBuffer: 16 * 1024 * 1024 }) ?? '').trim(),
    }
  } catch (e) {
    if (typeof e?.status !== 'number') return null
    return { status: e.status, stdout: String(e.stdout ?? '').trim() }
  }
}

function headShaOf() {
  return gitRead(['rev-parse', 'HEAD']) || null
}

function commitsBetween(fromSha, toSha) {
  const n = gitRead(['rev-list', '--count', `${fromSha}..${toSha}`])
  if (n === null || !/^\d+$/.test(n)) return null
  return Number(n)
}

/** 一枚提交实际带进来的路径集(取不到 ⇒ null;rename 双路径只会让集合变大,不影响"声明集⊆提交集"这一问)。 */
function committedPathsOf(sha) {
  const out = gitRead(['show', '--name-only', '--format=', sha])
  if (out === null) return null
  const list = out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  return new Set(list.map((p) => normalizeRepoPath(p)))
}

/**
 * 落地自证(纯判据,零 IO):私有索引通道退出码 0 **不足以**记 `artifact-committed`。
 * 五问缺一律 ok:false —— 失效方向恒为"少记一次成功,下一轮重来",绝不是"先把成功记上"。
 *  1 提交后 HEAD 取不到 / 2 提交前取不到(无从比推进)/ 3 HEAD 原地未动 /
 *  4 一次推进 >1 枚(顶上那枚可能是别人的 —— 多会话共树的日常形态)/
 *  5 声明集里有路径不在该提交的改动集内(钩子拒收、部分落地、路径口径漂移都落这一格)。
 * @param {{beforeSha?:string|null, afterSha?:string|null, advanced?:number|null,
 *          declaredPaths?:string[], committedPaths?:Set<string>|null}} p
 */
export function judgeLandingProof({
  beforeSha = null,
  afterSha = null,
  advanced = null,
  declaredPaths = [],
  committedPaths = null,
} = {}) {
  const short = (s) => String(s ?? '').slice(0, 12)
  if (!afterSha) return { ok: false, why: '提交后 HEAD 取不到 ⇒ 不记已落地(未判定不冒绿)' }
  if (!beforeSha)
    return { ok: false, why: `提交前 HEAD 取不到 ⇒ 无法证明 ${short(afterSha)} 确由本轮推进` }
  if (afterSha === beforeSha)
    return { ok: false, why: `HEAD 未推进(${short(afterSha)} 原地)⇒ 这枚没落地` }
  if (advanced === null)
    return {
      ok: false,
      why: `HEAD 推进枚数取不到(${short(beforeSha)}→${short(afterSha)})⇒ 未判定,不记已落地`,
    }
  if (!Number.isFinite(advanced) || advanced < 1)
    return { ok: false, why: `推进枚数读数非法(${advanced})⇒ 未判定,不记已落地` }
  if (advanced > 1)
    return {
      ok: false,
      why: `HEAD 一次推进 ${advanced} 枚 ⇒ 顶上那枚无法确认是本票的(并发日常态,下一轮重来)`,
    }
  if (!committedPaths)
    return { ok: false, why: `提交 ${short(afterSha)} 的改动集取不到 ⇒ 未判定,不记已落地` }
  const absent = declaredPaths.filter((p) => !committedPaths.has(p))
  if (absent.length)
    return {
      ok: false,
      why: `提交 ${short(afterSha)} 里缺声明集 ${absent.length} 枚:${absent.slice(0, 4).join(', ')} ⇒ 不记已落地`,
    }
  return { ok: true, landedSha: afterSha, why: `已落地并五问自证通过(${short(afterSha)})` }
}

/**
 * 真出口:私有索引提交 + **落地自证** + 提交后两腿(§12i / §10)。
 * 每一格"没确认"都返回 ok:false 并点名原因 ⇒ 上层记 artifact-commit-failed 下一轮重来;
 * 宁可少落一枚,也不许把"顶上那枚可能是别人的"记成 artifact-committed(§0.3 + §10 交付一致)。
 * 两腿 fail-open:写不进证不推翻已落地事实,但必须出声(静默少一张证 = 读侧尺子把它算成 unknown)。
 */
export function runLandCommit({ files, message, env = {} }) {
  const beforeSha = headShaOf()
  const r = spawnSync(process.execPath, [LAND_COMMIT, 'commit', '-m', message, '--', ...files], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    windowsHide: true,
    timeout: 15 * 60_000,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...env },
  })
  const tail = excerptBothEnds(String(r.stderr ?? ''), String(r.stdout ?? ''))
  if (r.status !== 0)
    return {
      ok: false,
      status: r.status ?? null,
      stderr: `isolated-git 退出码 ${r.status}｜${tail}`,
    }
  const afterSha = headShaOf()
  const declared = files.map((f) => normalizeRepoPath(f))
  const committed = afterSha ? committedPathsOf(afterSha) : null
  const proof = judgeLandingProof({
    beforeSha,
    afterSha,
    advanced:
      beforeSha && afterSha && afterSha !== beforeSha ? commitsBetween(beforeSha, afterSha) : null,
    declaredPaths: declared,
    committedPaths: committed,
  })
  if (!proof.ok) return { ok: false, status: r.status, stderr: `${proof.why}｜${tail}` }
  const landedSha = proof.landedSha
  try {
    const w = recordGatesThenCommit({
      root: ROOT,
      landedSha,
      headBefore: beforeSha,
      commitFiles: committed ? [...committed] : declared,
      declaredFiles: declared,
      // isolated-git 禁 --no-verify 与一切关钩参数,且钩子往声明集之外塞条目即当场拒 ⇒ gatesRan 恒真
      gatesRan: true,
      hookSkipped: false,
      hookSkipReason: '',
      ticketKey: String(env.IHUI_TICKET_KEY ?? ''),
      ticketLine: String(env.IHUI_TICKET_LINE ?? ''),
    })
    if (!w.ok) console.error(`⚠ 正证留痕未写入(不影响本枚落地):${w.why}`)
  } catch (e) {
    console.error(`⚠ 正证留痕未写入(不影响本枚落地):${String(e?.message ?? e).slice(0, 160)}`)
  }
  const session = String(env.IHUI_AGENT_SESSION_ID ?? '')
  if (session) {
    try {
      const note = recordForCommit({
        repoDir: ROOT,
        commit: landedSha,
        session,
        declaredPaths: declared,
        model: String(env.IHUI_AI_MODEL ?? ''),
        tool: 'auto-evolve',
      })
      if (note && note.state !== 'recorded')
        console.error(`⚠ AI 归属 notes 未判定:${(note?.reasons ?? []).join(',')}`)
    } catch (e) {
      console.error(
        `⚠ AI 归属 notes 未写入(不影响本枚落地):${String(e?.message ?? e).slice(0, 160)}`,
      )
    }
  } else {
    console.error(
      '⚠ AI 归属 notes 未落笔:env.IHUI_AGENT_SESSION_ID 缺失 ⇒ 本枚无归属记录,读侧尺子会记 unjudged,不得读成"人类写的"',
    )
  }
  return { ok: true, status: 0, stderr: proof.why, landedSha }
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
    let blocked
    try {
      cost = evaluate({ caps: costCaps, events: costEvents, kind: 'session' })
      // 腿断桶自己有闸(2026-11-05):改桶不是给断腿发自由票 —— 越限同样停转并喊人,
      // 但喊的是"派发通路在坏"(取证指向 A14/A2),不是"活儿太多"。
      blocked = evaluate({ caps: costCaps, events: costEvents, kind: 'session-blocked' })
    } catch (e) {
      console.error(`❌ 未判定:成本熔断判不了(${e.message})⇒ 本轮不派发`)
      process.exitCode = 2
      return
    }
    if (!blocked.allowed) {
      const s = `blocked 近1h=${blocked.used.hour} 近24h=${blocked.used.day} 墙钟=${blocked.used.minutesDay.toFixed(1)}min`
      record({ mode: 'dispatch', action: 'runner-budget-exhausted', note: s })
      console.log(
        `⏸ 发起腿额度熔断(与生产班次额度不同一桶):${blocked.breaches.join(';')} ⇒ 本轮停转并喊人`,
      )
      if (!escapeThrottled()) {
        markEscape()
        sendEscapeMail(
          gates,
          'auto-evolve:cost-blocked',
          '[auto-evolve] 发起腿额度熔断停转(调度器自己的腿在坏)',
          `腿断桶越限:${blocked.breaches.join(';')}(${s})。含义与 session 越限**不同**:这说明派发通路持续失败,不是活儿太多。\n取证:node scripts/check-autonomy-leg-health.mjs(看 A14-executor-face-stall 与 A2-attribution)与台账末行 runner-unavailable 的 why。`,
        )
      }
      return
    }
    if (!cost.allowed) {
      const summary = `sessions 近1h=${cost.used.hour} 近24h=${cost.used.day} 墙钟=${cost.used.minutesDay.toFixed(1)}min tokens 近1h=${cost.used.tokensHour} 近24h=${cost.used.tokensDay} 单会话峰值=${cost.used.maxTokens}`
      // 单行发射:收割器(C4)只认单行 `record({... action: 'x' ...})` 形态,被 prettier 折成多行
      // 就会"豁免表里有、源码里收不到"⇒ 判红的是我这次的写法,不是判据太严。
      const costNote = `${cost.breaches.join(';')} | ${summary}`
      record({ mode: 'dispatch', action: 'cost-breaker-stop', note: costNote })
      console.log(`⏸ 成本熔断:${cost.breaches.join(';')} ⇒ 本轮停转(软停机)`)
      if (!escapeThrottled()) {
        markEscape()
        sendEscapeMail(
          gates,
          'auto-evolve:cost',
          '[auto-evolve] 成本熔断停转',
          `调度层会话额度越限:${cost.breaches.join(';')}(${summary})。停派至窗口回落;放量属人工阀 budget-cap-change,须人改 scripts/data/cost-caps.json。`,
        )
      }
      return
    }
  }
  const gateCounts = summarizeHumanGates(humanGates).counts
  console.log(
    `🛡 人工阀清单:自决 ${gateCounts.autonomous} 条 / 停机等人 ${gateCounts.gates} 条(命中即安全停机,不重试不绕行)`,
  )
  const lock = acquireLock()
  if (lock.held) {
    console.log(`⏭ 上一轮仍在跑(pid=${lock.pid ?? '?'})⇒ 本轮让路(单实例闸)`)
    return
  }
  try {
    // ---- 派发前闸(2026-11-01 立):执行体不在位 ⇒ 整轮不派,不拿真票去撞 ----
    // 病灶:这条腿 2026-10-25 起在本机死了 6 天(48 轮仅 1 成功),而台账里每一枚失败
    // 都被记成「票失败」并计入连败,3 次即封票 48h —— 调度器自伤却把债摊派给真工作。
    let pf = preflightSessionRunner(gates.sessionCommandTemplate, ROOT)
    // 瞬时不在位(别席 install 正把 tsx 重挂)先复核再停派——判据单源见 `preflightRecheckPlan`。
    for (let attempt = 1; attempt <= 3; attempt++) {
      const plan = preflightRecheckPlan(pf.state, attempt)
      if (!plan.recheck) break
      // 同步等:本器整轮就是同步流程(取票/起会话都阻塞),异步等待不会让任何人受益。
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, plan.delayMs)
      const again = preflightSessionRunner(gates.sessionCommandTemplate, ROOT)
      console.error(
        `♻ 派发前闸复核 ${attempt}/${plan.recheck ? 2 : 0}:${pf.why} → ${again.why}(state=${again.state})`,
      )
      pf = again
    }
    if (!dryRun && pf.state !== 'ready' && pf.state !== 'template-empty') {
      record({
        mode: 'dispatch',
        action: `runner-preflight-${pf.state}`,
        why: pf.why,
        missing: pf.missing ?? [],
      })
      console.error(
        `⛔ 派发前闸未过(state=${pf.state}):${pf.why}${pf.missing?.length ? `｜不在位:${pf.missing.join(', ')}` : ''}`,
      )
      if (!escapeThrottled()) {
        markEscape()
        sendEscapeMail(
          gates,
          'auto-evolve:runner-preflight',
          '[auto-evolve] 自开发发起腿不可用(派发前闸拦停)',
          `判据:scripts/lib/autonomy-runner.mjs preflightSessionRunner\nstate=${pf.state}｜${pf.why}\n逐枚核验:${(pf.checked ?? []).map((c) => `${c.inPlace ? '✓' : '✗'} ${c.token}`).join('\n')}\n出路:改 scripts/data/auto-evolve-gates.json 的 sessionCommandTemplate(仓根写 \${REPO_ROOT} 令牌,别钉盘符),或补齐缺失产物。本轮未派任何票,票面连败计数未受影响。`,
        )
      }
      process.exitCode = 2
      return
    }
    let allRows
    let faceNote = ''
    try {
      allRows = pickTickets()
    } catch (e) {
      // 可证复用只在指纹逐字相等且票键可还原时成立;不成立 ⇒ 原样上抛,保持"未判定不派"。
      let cacheText = null
      try {
        cacheText = readFileSync(AUTONOMY_CANDIDATES, 'utf8')
      } catch {
        cacheText = null
      }
      const reuse = poolFaceFromCache({ cacheText, digestNow: planFaceDigestFromHead(ROOT) })
      if (!reuse.rows || reuse.rows.length === 0) {
        // 拒绝复用必须说清是哪一条安全条件不成立(§0.10:失效方向是多要一次说明,不是沉默上抛)
        console.error(`⏭ 票面缓存不可复用:${reuse.why} ⇒ 本轮维持"未判定不派"`)
        throw e
      }
      allRows = reuse.rows
      faceNote = ` / 票面来源=缓存复用(实时面取不到:${String(e.message ?? e).slice(0, 64)};${reuse.why},候选面⊆派单面 ⇒ 只会少派)`
      console.log(`♻ ${faceNote.trim()}`)
    }
    let rows = allRows
    let decisionReadout = '台账序(无候选评估文件)'
    if (!noDecide) {
      const gen = refreshAutonomyCandidates({ dryRun })
      console.log(
        gen.state === 'ok'
          ? `🗳 自治决策候选:${gen.why}`
          : `⏭ 自治决策候选未刷新(${gen.why})⇒ 本轮按台账序`,
      )
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
        if (ranked.skipped.length > 8)
          console.log(`⏭ 另有 ${ranked.skipped.length - 8} 枚压后/未评估(见候选文件)`)
      } catch (e) {
        record({
          mode: dryRun ? 'dryrun' : 'dispatch',
          action: 'decision-undetermined',
          why: `自治决策排序不可用:${String(e?.message ?? e).slice(0, 220)}`,
        })
        console.error(
          `❌ 未判定:自治决策排序不可用(${e?.message ?? e}) ⇒ 本轮不派(不回落成台账序冒充已评估)`,
        )
        process.exitCode = 2
        return
      }
    }
    const ledger = readLedger()
    // ---- 先结算上一轮的"成功",再决定本轮派谁 ----
    // 没有这一环,session-ok 永远只是"会话结束了"而不是"票推进了"(§10 交付一致性)。
    const settled = settlePriorDispatches({ ledger, currentRows: allRows })
    for (const s of settled) {
      record({
        mode: 'dispatch',
        action: 'dispatch-settled',
        ticketKey: s.ticketKey,
        ticketLine: s.ticketLine,
        sourceTs: s.sourceTs,
        settled: s.state,
        why: s.why,
      })
      if (s.state === 'no-progress') {
        console.log(`⚠ 结算:票 ${s.ticketKey} 会话自称成功但票行零推进 —— ${s.why}`)
        if (!escapeThrottled()) {
          markEscape()
          sendEscapeMail(
            gates,
            'auto-evolve:no-progress',
            '[auto-evolve] 有票派出去但零推进(会话"成功"不可信)',
            `票键:${s.ticketKey}\n票面:${s.ticketLine}\n判据:${s.why}\n这条不是"票失败"(不计连败、不封票),而是"成功判定过松"的凭据。\n出路:核该会话末轮实际做了什么(日志 .ihui-agent/state/auto-evolve-run.log);若它结构上交付不了(自动会话无提交权),这一族就得改判据 —— 派发的合格线要绑"票行推进 + 绑定票键的提交",而不是 CLI 退出码。`,
          )
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
        record({
          mode: dryRun ? 'dryrun' : 'dispatch',
          action: 'nonprogress-unjudged',
          ticketKey: npKey,
          why: np.why,
        })
        console.error(`❓ 空转记忆未判定(${np.why})⇒ 本轮把这枚挪到队尾,不冒充已判(§0.3)`)
      }
      if (np.route === 'cooldown' || np.route === 'park') npHeld.push({ ticket, key: npKey, np })
      else npLive.push({ ticket, key: npKey, np })
    }
    // 让位失效形状(2026-11-05 立):`rotate` 只是重排序,而实测今日 10 个班次全部落到同一枚票
    // (白名单这一档只剩它一个命中)⇒ "让位给空转更少的候选"永远让不出去,每轮照吞一份日预算,
    // 要一路吞到 attempts=8 才轮到冷却。队首已经是池内空转最少的那一枚时,让位等于无处可让 ⇒
    // 这一枚本轮不派,记 `non-progress-hold`(route 写 standoff,复用既有的 hold/邮件腿,不新增动作名)。
    npLive.sort((a, b) => a.np.attempts - b.np.attempts)
    const standoffs = splitRotateStandoff(npLive)
    for (const s of standoffs) {
      npHeld.push({
        ...s,
        np: { ...s.np, route: 'standoff', why: `${s.np.why}(池内无空转更少的候选 ⇒ 无处可让)` },
      })
    }
    const heldKeys = new Set(npHeld.map((x) => x.key))
    rows = npLive.filter((x) => !heldKeys.has(x.key)).map((x) => x.ticket)
    for (const { ticket, key, np } of npHeld) {
      const detail = breakdownNonProgress(ledger, key)
        .map((d) => `${d.action}×${d.count}`)
        .join(' ')
      const lastHold = [...ledger]
        .reverse()
        .find(
          (e) =>
            e.ticketKey === key &&
            (e.action === 'non-progress-hold' || e.action === 'non-progress-parked'),
        )
      const isNewEpisode =
        !lastHold || lastHold.attempts !== np.attempts || lastHold.route !== np.route
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
      if (isDispatchedToday(e)) dispatched++
    }
    // 池可赢性只在"本轮不派"的两种出口上算 —— 正常派发轮不背这笔 grep 时间。
    const willNotDispatch = rows.length === 0 || dispatched >= gates.dailyDispatchBudget
    const summary =
      `派单面现读 ${allRows.length} 行 / 判期 ${decisionReadout} / 本轮候选 ${rows.length} 行(空转扣住 ${npHeld.length} 行)/ 今日已派 ${dispatched}/${gates.dailyDispatchBudget} 轮` +
      faceNote +
      (willNotDispatch
        ? ` / ${poolWinnabilityNote(rows.filter((t) => matchWhitelist(t.text, gates.ticketWhitelist)))}`
        : '')
    if (rows.length === 0) {
      record({
        mode: dryRun ? 'dryrun' : 'dispatch',
        action: npHeld.length ? 'all-held-nonprogress' : 'no-ticket',
        note: summary,
      })
      console.log(
        `✅ ${summary} ⇒ ${npHeld.length ? `候选全被空转记忆扣住(非"无票"),本轮结束` : '无票可派,本轮结束'}`,
      )
      return
    }
    if (dispatched >= gates.dailyDispatchBudget) {
      record({ mode: dryRun ? 'dryrun' : 'dispatch', action: 'budget-exhausted', note: summary })
      console.log(`⏸ ${summary} ⇒ 预算耗尽,停派`)
      if (!dryRun && !escapeThrottled()) {
        markEscape()
        sendEscapeMail(
          gates,
          'auto-evolve:budget',
          '[auto-evolve] 每日派发预算耗尽',
          `今日已派 ${dispatched} 轮达上限 ${gates.dailyDispatchBudget}。调度器自动停派至明日;若需放量改 auto-evolve-gates.json 的 dailyDispatchBudget。`,
        )
      }
      return
    }
    let landedSkipped = 0
    let supplyHoldSkipped = 0
    let placeholderSkipped = 0
    for (const ticket of rows) {
      const key = ticketKeyOf(ticket.text)
      // 未取号占位行排在白名单判定**之前**:否则它会算进"命中白名单"里,
      // 把"池里没活可派"错报成"白名单太窄"(今夜实测就被它骗过一次方向)。
      if (isPlaceholderTicketRow(ticket.text)) {
        placeholderSkipped++
        console.log(`⏭ L${ticket.line} 未取号占位行({{NEXT_ID}})⇒ 跳过:它无法被认领,也结不了清`)
        continue
      }
      const qUntil = quarantinedUntilOf(ledger, key)
      if (qUntil) {
        console.log(`⏭ L${ticket.line} 封禁中(至 ${new Date(qUntil).toISOString()})⇒ 跳过`)
        continue
      }
      if (!matchWhitelist(ticket.text, gates.ticketWhitelist)) {
        console.log(`⏭ L${ticket.line} 未命中票类白名单 ⇒ 跳过(第一期保守起步)`)
        continue
      }
      // 本环已把这张票的产物落进 HEAD 而票行还没结清 ⇒ 不再重派(判据单源见
      // `landedCommitOfTicket` 头注;取不到不拦,与"advisory 不饿死环"同一条失效方向)。
      const alreadyLanded = landedCommitOfTicket(key)
      if (alreadyLanded) {
        landedSkipped++
        console.log(
          `⏭ L${ticket.line} 产物已落地(${alreadyLanded.slice(0, 12)})而票行未结清 ⇒ 跳过重派`,
        )
        continue
      }
      // 账面挂账搁置(2026-11-06 立,席位分工回执里的实事那一半)。
      // 立因:`landedCommitOfTicket` 只认得"提交信息带 `票键:` 那一行"的已落地票;实现由**别席**入库、
      // 正文没带票键时(Y-13/Y-91 实测:代码在 38542c0d15,结清卡在侧车),本器结构上看不出这票做过,
      // 于是每轮照派、每轮重跑"给既有实现再造一份测试" —— 重复派发的产物是第二份近似测试文件,
      // 那种残骸只能人肉剔。正解不是口头约定"你先别派",而是一条**具名、带归属、带终态**的搁置台账:
      // 到期即回到派单面(§豁免必须"验过才免"且会到期);台账取不到 ⇒ 一条不搁(未判定不猜)。
      let holdsText = null
      let holdsMissing = false
      try {
        holdsText = readFileSync(SUPPLY_HOLDS_JSON, 'utf8')
      } catch (e) {
        holdsMissing = String(e?.code ?? '') === 'ENOENT'
      }
      const supplyHolds = parseSupplyHolds(holdsText, { now: Date.now(), absentOk: holdsMissing })
      if (supplyHolds.state === 'ok') {
        const held = supplyHolds.held.find(
          (h) => h.key === key || (h.head && ticket.text.includes(h.head)),
        )
        if (held) {
          supplyHoldSkipped++
          record({
            mode: dryRun ? 'dryrun' : 'dispatch',
            action: 'supply-hold-skip',
            ticketKey: key,
            ticketLine: ticket.text.slice(0, 200),
            holdOwner: held.owner,
            holdUntil: held.expires,
            why: held.reason,
          })
          console.log(
            `⏸ L${ticket.line} 账面挂账(归属 ${held.owner}｜到期 ${held.expires}｜原因 ${held.reason})⇒ 本轮不派;到期自动回派单面`,
          )
          continue
        }
      } else if (supplyHolds.state === 'undetermined') {
        // 只有"读了但判不出"才每轮出声;台账本就不在场是常态(第一期没人挂账),不该天天刷噪声。
        console.log(`⚠️ 账面挂账台账未判定:${supplyHolds.why} ⇒ 本枚不搁任何票,照正常面判`)
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
      const valve = gateTicketByHumanValve({
        ticketText: ticket.text,
        mode: gates.humanValveMode,
        valveListText: valveText,
      })
      const valveRoute = decideValveDispatch(valve, gates.humanValveMode, {
        ticketKey: key,
        ticketLine: ticket.text.slice(0, 160),
      })
      record({ mode: dryRun ? 'dryrun' : 'dispatch', ...valveRoute.ledger })
      if (valveRoute.route === 'block') {
        console.log(
          `⛔ L${ticket.line} 命中人工阀「${valve.ruleId}」⇒ enforce 档不派(不重试、不绕行)`,
        )
        if (!escapeThrottled()) {
          markEscape()
          sendEscapeMail(
            gates,
            `auto-evolve:valve:${valve.ruleId}`,
            '[auto-evolve] 有票命中人工阀,已停派等人',
            `票:L${ticket.line} ${ticket.text.slice(0, 140)}\n命中规则:${valve.ruleId}\n判据:${valve.reason}\n出路:这一条按清单归机主面(scripts/data/human-valve-list.json),由人执行;或由人把它摘出自动派单面。`,
          )
        }
        continue
      }
      if (valveRoute.route === 'stop-round') {
        record({
          mode: 'dispatch',
          action: 'valve-unjudged-block',
          ticketKey: key,
          why: valve.reason,
        })
        console.error(`❌ 未判定:${valve.reason} ⇒ enforce 档 fail-closed,本轮停派`)
        process.exitCode = 2
        return
      }
      if (valveRoute.route === 'skip-observe-stop') {
        // 2026-11-03 改档(用户授权):这条原先是"只记账、仍照派",现在停机不派。
        // 台账动作名保持 valve-observe-stop,并带 dispatched:false 区分"阀判停机但其实派出去了"的旧行。
        console.log(
          `👁 L${ticket.line} valve-observe-stop(skip) 命中停机类「${valve.ruleId}」⇒ observe 档停机不派(不再照派白烧会话额度)`,
        )
        continue
      }
      if (dispatched >= gates.dailyDispatchBudget) {
        console.log(`⏸ 预算耗尽(本轮中)⇒ 停派`)
        break
      }
      console.log(`→ L${ticket.line} 命中白名单,进入派发闸`)
      // 自我面闸(排在铸凭据之前:既然决定不派,就不该再消耗一次凭据供值)
      const selfFace = readSelfFace()
      if (selfFace.state !== 'ok') {
        // informational ⇒ 不进空转阶梯:这是"本器跑的盘被他人旧基线占了"的环境级形态,
        // 记进票头会把每张票都推向 park(而盘常年脏)——与 runner-unavailable 同一分型纪律。
        const faceAction =
          selfFace.state === 'stale-disk' ? 'runner-face-stale-disk' : 'runner-face-undetermined'
        record({
          mode: 'dispatch',
          action: faceAction,
          ticketKey: key,
          ticketLine: ticket.text.slice(0, 200),
          informational: true,
          why: `${selfFace.why}｜停派本轮,不冒充执行`,
        })
        console.error(`⚠ 自我面不是当前这份:${selfFace.why} ⇒ 本轮不派(不拿半成品当执行体)`)
        // ---- 轮级终局档(RP-66,2026-11-06)----
        // 上面那行 informational 被票级阶梯**正确地**豁免了,代价是豁免之后没人替它说话:
        // 环可以连续几十轮只撞这道面闸,阶梯读数恒 0、尺子按信息项放行 ⇒ 一个谁都不喊的稳态停摆。
        // 计数单位是「轮」不是「小时」:现读轮间隔双峰(中位 10.7 分钟 / 最长 322 分钟),
        // 墙钟阈值两头都判错。终局只做三件事:落一枚**不带 ticketKey** 的轮级档、按串去重喊一次
        // critical、不摘任何豁免(摘了会把每张票推向 park = §12e 反向)。
        const parked = decideParkedRound({
          rows: readLedger(),
          streakN: gates.parkedRoundStreak,
          faceState: selfFace.state,
          faceAction,
          faceWhy: selfFace.why,
        })
        if (parked.emit) {
          record(parked.row)
          console.error(
            `⛔ 轮级终局:连续 ${parked.streak.count} 轮撞在自我面闸(自 ${String(parked.streak.sinceTs)})⇒ 落 runner-face-parked-round 并喊人`,
          )
          sendEscapeMail(gates, parked.alertId, parked.mailTitle, parked.mailBody, 'critical')
        } else {
          console.log(`ℹ 轮级终局档未触发:${parked.reason}(计数单位=轮)`)
        }
        process.exitCode = 2
        return
      }
      if (!dryRun) {
        const mint = await mintSessionCredential()
        if (!mint.ok) {
          record({
            mode: 'dispatch',
            action: 'mint-failed',
            ticketKey: key,
            ticketLine: ticket.text.slice(0, 200),
            why: mint.why,
          })
          console.error(`❌ 未判定:${mint.why} ⇒ 本轮不派发(凭据供值失败,不冒充执行)`)
          process.exitCode = 2
          return
        }
      }
      const res = dispatchSession(gates, ticket, dryRun)
      record({
        mode: dryRun ? 'dryrun' : 'dispatch',
        action: res.action,
        ticketKey: key,
        ticketLine: ticket.text.slice(0, 200),
        exitCode: res.exitCode ?? null,
        stopReason: res.stopReason ?? null,
        durationMs: res.durationMs ?? null,
        tokens: res.tokens ?? null,
        tokensMeasured: res.tokensMeasured === true,
        costUsd: res.costUsd ?? null,
        transcript: res.transcript ?? null,
        writeOk: res.writeOk ?? null,
        writeTried: res.writeTried ?? null,
        runtimeNormalized: res.runtimeNormalized ?? null,
        failureKind: res.failureKind ?? null,
        providerError: res.providerError ?? null,
        why: res.why ?? '',
      })
      // O6502 记账腿:只有真派(非 dry-run)且拿到墙钟才进账;记不进去就如实告警,不冒充"额度还够"。
      // 第 3 期④:量到 token 就一并记账(单会话闸 + 24 小时闸的取数口);量不到只记墙钟并留响声。
      // 分桶改判(2026-11-05 立,现读实测):近 24h 24 次记账里 21 次是 `session-failed` ——
      // **调度器自己腿断的班次**与真跑完的班次过去进同一个 `session` 计数器 ⇒ 环境故障吃光一天
      // 生产额度,环自我饿死(手工触发也被"近24h 24 次 ≥ 上限 24"挡住)。腿断仍有自己的闸
      // (cost-caps.json 的 `session-blocked`),不是自由票。
      if (!dryRun && Number.isFinite(res.durationMs) && res.durationMs > 0) {
        const blocked = isNonTicketFailure(res.failureKind)
        try {
          mkdirSync(dirname(COST_LEDGER), { recursive: true })
          appendFileSync(
            COST_LEDGER,
            chargeLine({
              kind: blocked ? 'session-blocked' : 'session',
              minutes: Number((res.durationMs / 60000).toFixed(2)),
              tokens: res.tokensMeasured === true ? res.tokens : undefined,
              note: `auto-evolve ${res.action}${blocked ? ` failureKind=${res.failureKind}` : ''}`,
            }),
            'utf8',
          )
        } catch (e) {
          console.error(`⚠ 成本记账失败(本轮照常收尾,但下一轮判据可能偏松):${e.message}`)
        }
        if (res.tokensMeasured !== true) {
          console.error(
            '⚠ token 计量未判定(终态行无 usage:超时/被杀/非 json 通路)⇒ 本轮只记墙钟,不虚记 token 额度',
          )
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
          commitFn: runLandCommit,
          dryRun: true,
        })
        record({
          mode: 'dryrun',
          action: preview.action,
          ticketKey: key,
          files: preview.files,
          dropped: preview.dropped,
          why: preview.why,
        })
        console.log(`🧪 dry-run 落账预览(${preview.action}):${preview.why}`)
        if (preview.files.length) console.log(`   会提交:${preview.files.join(', ')}`)
        console.log(`✅ dry-run 记账完成(不真派)`)
        return
      }
      dispatched++
      // 日预算的**跨轮**计数读的就是这一行(2026-11-04 实测:调度器重构后再没人发射过 `dispatched`,而
      // 两处计数器仍按 action==='dispatched' 数 ⇒ 每轮都读成"今日已派 0/6",日预算只剩轮内那一半)。
      record({
        mode: 'dispatch',
        action: 'dispatched',
        ticketKey: key,
        ticketLine: ticket.text.slice(0, 200),
        why: `真派第 ${dispatched} 次(预算 ${gates.dailyDispatchBudget}/日)`,
      })
      // ---- 故障分型(2026-11-01 立):发起腿级失败 ≠ 票面失败 ----
      // 环境级(ERR_MODULE_NOT_FOUND/ENOENT/路径不存在)是调度器自己的腿断了:
      // 计进票连败 = 每换一次机就把整张派单面逐枚封禁 48h,而真因一行也没被点名。
      if (isNonTicketFailure(res.failureKind) || res.action === 'runner-undetermined') {
        record({
          mode: 'dispatch',
          action: 'runner-unavailable',
          ticketKey: key,
          ticketLine: ticket.text.slice(0, 200),
          why: res.why,
        })
        console.error(
          `⛔ 发起腿故障(分型=${res.failureKind ?? res.action},provider-error=${res.providerError ?? '无'},不计票连败、不封票):${res.why}`,
        )
        if (!escapeThrottled()) {
          markEscape()
          sendEscapeMail(
            gates,
            `auto-evolve:runner-${res.failureKind ?? 'undetermined'}`,
            `[auto-evolve] 起会话失败已分型为调度器侧(${res.failureKind ?? res.action}),已停派本轮`,
            `票面(未被计入连败):L${ticket.line} ${ticket.text.slice(0, 120)}\n分型:${res.failureKind ?? res.action}｜provider-error=${res.providerError ?? '无'}｜${res.why}\n出路:核 scripts/data/auto-evolve-gates.json 的 sessionCommandTemplate 与 CLI 产物是否在位;本器判据 = scripts/lib/autonomy-runner.mjs。`,
          )
        }
        process.exitCode = 2
        return
      }
      if (res.action === 'session-no-progress') {
        // 零推进 ≠ 腿故障 ≠ 票坏:它由空转阶梯(rotate/park)负责,不走连败封票,也不进落账腿
        // (会话一个文件都没动,落账腿只能再记一行 manifest-missing ⇒ 同一件事双记账)。
        console.log(
          `⚠ 整班零推进(exit=3 no_progress,票键 ${key})⇒ 不计连败、不封票、跳过落账腿;阶梯负责这一族`,
        )
        return
      }
      if (res.action === 'session-failed' || res.action === 'session-timeout') {
        const streak = failureStreakOf(readLedger(), key)
        if (streak >= gates.failureStreakLimit) {
          const until = new Date(Date.now() + gates.quarantineHours * 3600_000).toISOString()
          record({
            mode: 'dispatch',
            action: 'quarantined',
            ticketKey: key,
            ticketLine: ticket.text.slice(0, 200),
            until,
            why: `连败 ${streak} 次(阈值 ${gates.failureStreakLimit})`,
          })
          console.log(`⛔ 同票连败 ${streak} 次 ⇒ 封禁至 ${until}`)
          if (!escapeThrottled()) {
            markEscape()
            sendEscapeMail(
              gates,
              `auto-evolve:quarantine:${key.slice(0, 8)}`,
              '[auto-evolve] 票被自动封禁',
              `票:L${ticket.line} ${ticket.text.slice(0, 120)}\n连败 ${streak} 次(阈值 ${gates.failureStreakLimit}),自动封禁至 ${until}。封禁明细与连败原因见 ${LEDGER};解封等 until 到期或人工摘除 quarantined 行。`,
            )
          }
        }
        return
      }
      // 整班没动手 ⇒ 落账腿必然只能报 manifest-missing,而那是同一件事的第二行账(阶梯会双倍计数)。
      // 所以这里就地收口:一行 `session-no-write` 说清"零改动",残留清单交给每轮的 dry-run 预览腿看见。
      if (res.action === 'session-no-write') {
        console.log(`⚠ ${res.why}(票键 ${key};已跳过落账腿,避免同轮双记非推进)`)
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
        commitFn: runLandCommit,
        dryRun: false,
      })
      record({
        mode: 'dispatch',
        action: landed.action,
        ticketKey: key,
        ticketLine: ticket.text.slice(0, 200),
        files: landed.files,
        dropped: landed.dropped,
        why: landed.why,
      })
      if (landed.action === 'artifact-committed') {
        console.log(
          `✅ 落账:代提交 ${landed.files.length} 枚 —— ${landed.files.join(', ')}${landed.dropped.length ? `(剔除无改动 ${landed.dropped.length} 枚)` : ''}`,
        )
      } else if (landed.action === 'artifact-commit-failed') {
        console.error(`⚠ 落账未落地(${landed.action}):${landed.why} ⇒ 本轮照常收尾,下一轮重试`)
      } else {
        console.log(`ℹ 落账:${landed.action} —— ${landed.why}`)
      }
      return
    }
    // 收尾措辞必须与真实原因同形:这一行过去只会说"未命中白名单或在封",而本环刚装上
    // "已落地不重派"那一档 ⇒ 全部因已落地而跳过的轮次会被记成 whitelist 问题,
    // 读台账的人下一步就是去扩白名单(§0.3 的反面:把量到的那件事写成另一件事)。
    // 供给断档 census(2026-11-06 立):这一行过去只说"本轮无派发",但**为什么**无派发有两种相反成因,
    // 现读实证:派单面 8 行、白名单 16 档**逐档命中全 0**(而面上躺着"灰度槽位从未拿到产物""消息级版本
    // 切换"这种正是自部署/自更新本体的票)。把"面空了"和"政策面窄"写成同一个读数,下一步一定是有人
    // 去扩白名单或去删票 —— 所以这里必须把两型分开,并且把逐档分布一起记下来,别让下一个人手工重算。
    const openFaceCount = Array.isArray(rows) ? rows.length : 0
    const whitelistCensus = (gates.ticketWhitelist || []).map((p) => ({
      pattern: String(p),
      hits: (rows || []).filter((tk) => matchWhitelist(String(tk?.text ?? ''), [p])).length,
    }))
    const stall = decideSupplyStall(readLedger(), {
      streakN: gates.supplyStallRounds,
      now: Date.now(),
    })
    console.log(
      `ℹ 本轮无派发(未命中白名单或在封;其中已落地待结清 ${landedSkipped} 枚 ⇒ 不再重派、账面挂账 ${supplyHoldSkipped} 枚 ⇒ 等归属方结清、未取号占位 ${placeholderSkipped} 枚 ⇒ 需先取号)｜派单面 ${openFaceCount} 行,逐档命中 ${whitelistCensus.filter((c) => c.hits > 0).length}/${whitelistCensus.length} 档`,
    )
    record({
      mode: dryRun ? 'dryrun' : 'dispatch',
      action: openFaceCount === 0 ? 'no-open-tickets' : 'no-whitelist-hit',
      openFaceCount,
      whitelistPatterns: whitelistCensus.length,
      whitelistHitPatterns: whitelistCensus.filter((c) => c.hits > 0).length,
      // 只带非零命中档与" stranded 前两行"的短标题,防把整段票面塞进台账(§5e-3 不许把抖动明细写进身份)
      whitelistTop: whitelistCensus
        .filter((c) => c.hits > 0)
        .map((c) => `${c.pattern}=${c.hits}`)
        .join(','),
      stranded: (rows || []).slice(0, 3).map((tk) =>
        String(tk?.text ?? '')
          .replace(/^-\s*\[[ x]\]\s*/, '')
          .slice(0, 60),
      ),
      note: `${summary} / 已落地待结清跳过 ${landedSkipped} 枚 / 账面挂账跳过 ${supplyHoldSkipped} 枚 / 未取号占位跳过 ${placeholderSkipped} 枚`,
    })
    // 轮级终局:同型连续 N 轮(缺省 6 轮;现读调度节拍约每小时一轮 ⇒ 6 小时无人管即响)。
    // 与 runner-face-parked-round 同一条纪律:去重按**串首**、邮件不带 ticketKey、不摘任何豁免。
    const stallNow = decideSupplyStall(
      [...readLedger()], // 含刚记下的这一行
      { streakN: gates.supplyStallRounds, now: Date.now() },
    )
    if (stallNow.emit) {
      record({
        mode: dryRun ? 'dryrun' : 'dispatch',
        action: 'supply-stall-round',
        stallKind: stallNow.kind,
        streakRounds: stallNow.count,
        streakSince: stallNow.sinceTs,
        streakLast: stallNow.lastTs,
        openFaceCount,
        why: `连续 ${stallNow.count} 轮同型供给断档(${stallNow.kind},门限 ${gates.supplyStallRounds})⇒ 轮级终局,已喊一次`,
      })
      console.error(
        `⛔ 供给断档终局:连续 ${stallNow.count} 轮 ${stallNow.kind} ⇒ 落 supply-stall-round 并喊人`,
      )
      sendEscapeMail(
        gates,
        `auto-evolve:supply-stall-round:${stallNow.kind}:${String(stallNow.sinceTs)}`,
        `[auto-evolve] 供给断档:连续 ${stallNow.count} 轮 ${stallNow.kind}`,
        [
          `型:${stallNow.kind}(门限 ${gates.supplyStallRounds} 轮;现读调度节拍约 1 轮/小时 ⇒ 约 ${stallNow.count} 小时无票可派)。`,
          `起止:${String(stallNow.sinceTs)} → ${String(stallNow.lastTs)}(计数单位=轮)。`,
          `本轮派单面行数=${openFaceCount};白名单 ${whitelistCensus.length} 档中命中 ${whitelistCensus.filter((c) => c.hits > 0).length} 档。`,
          `逐档命中:${whitelistCensus.map((c) => `${c.pattern}=${c.hits}`).join(' ')}`,
          ...(stallNow.kind === 'supply-mismatch'
            ? [
                '',
                `这一型是**政策面比票窄**:面上有行,但没有一档白名单认得它们。头 ${Math.min(3, openFaceCount)} 行原文:`,
                ...(rows || [])
                  .slice(0, 3)
                  .map((tk) => '  · ' + String(tk?.text ?? '').slice(0, 120)),
                '出路(二选一,都由台账席定):① 把这些票改写成能命中既有档的表述;② 在 auto-evolve-gates.json 的 ticketWhitelist 增加档 —— 加档前必须先问人工阀清单会不会把危险动作一起放进自动派发(阀在 observe 档只记账不拦)。',
              ]
            : [
                '',
                '这一型是**派单面真的空了**:台账里没有可派单行(结清即删的正常结果)。',
                '出路:台账席补登下一批真工作;若确实见底,这不是故障。',
              ]),
          '读数面:node scripts/check-autonomy-leg-health.mjs 的 A13/A15 维;台账 action=supply-stall-round。',
        ].join('\n'),
        'critical',
      )
    } else if (stall.count > 0) {
      console.log(`ℹ 供给断档未到门限:${stall.reason}`)
    }
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
      record({
        mode: 'probe',
        action: 'probe-undetermined',
        why: '当次仓根取不到 ⇒ 模板无法归一,不冒充已探测',
      })
      console.error('❌ 未判定:当次仓根取不到 ⇒ probe 不做(不回落原模板)')
      process.exitCode = 2
      return
    }
    const filledProbe = fillTemplate(resolvedProbe, {
      promptFile,
      ticketLine: 'probe 自检',
      ticketKey: 'probe',
      sessionModel: gates.sessionModel,
      sessionApiUrl: gates.sessionApiUrl,
    })
    const cmd = normalizeSessionRuntime(filledProbe).cmd
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
    const passed =
      r.status === 0 &&
      String(r.stdout ?? '').includes('"stopReason":"end_turn"') &&
      String(r.stdout ?? '').includes('export const TRANSCRIPT_DIR')
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
    record({
      mode: 'probe',
      action: passed ? 'probe-ok' : 'probe-fail',
      exitCode: r.status ?? null,
      durationMs,
      transcript,
      why: passed ? '' : `status=${r.status} stdout 尾部=${String(r.stdout ?? '').slice(-160)}`,
    })
    console.log(
      passed
        ? `✅ probe 通过(${(durationMs / 1000).toFixed(1)}s)⇒ 起会话通路健康`
        : `❌ probe 未通过(status=${r.status})⇒ 记台账 probe-fail`,
    )
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
  const dispatched = ledger.filter((e) => isDispatchedToday(e)).length
  const quarantined = []
  for (const e of ledger) {
    if (e.action !== 'quarantined') continue
    const until = Date.parse(e.until)
    if (Number.isFinite(until) && until > Date.now())
      quarantined.push({ key: e.ticketKey, until: e.until, line: e.ticketLine })
  }
  console.log(
    `闸门:enabled=${gates.enabled} 预算 ${dispatched}/${gates.dailyDispatchBudget} 轮(今日) 连败阈值 ${gates.failureStreakLimit} 封禁 ${gates.quarantineHours}h 会话上限 ${gates.maxSessionMinutes}min`,
  )
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
    console.log(
      `人工阀:自决 ${hg.counts.autonomous} 条 / 停机等人 ${hg.counts.gates} 条(${hg.gates.map((g) => g.id).join(' / ')})`,
    )
  } catch (e) {
    console.log(`人工阀:❌ 未判定(${e.message})`)
  }
  try {
    const caps = loadCaps(readFileSync(COST_CAPS_JSON, 'utf8'))
    const events = existsSync(COST_LEDGER) ? parseLedger(readFileSync(COST_LEDGER, 'utf8')) : []
    const c = evaluate({ caps, events, kind: 'session' })
    console.log(
      `成本熔断(session):近1h ${c.used.hour}/${c.caps.perHour ?? '-'} 次 近24h ${c.used.day}/${c.caps.perDay ?? '-'} 次 墙钟 ${c.used.minutesDay.toFixed(1)}/${c.caps.minutesPerDay ?? '-'} 分钟 tokens 近1h ${c.used.tokensHour}/${c.caps.tokensPerHour ?? '-'} 近24h ${c.used.tokensDay}/${c.caps.tokensPerDay ?? '-'} 单会话峰值 ${c.used.maxTokens}/${c.caps.tokensPerSession ?? '-'} ⇒ ${c.allowed ? '放行' : '停转'}`,
    )
  } catch (e) {
    console.log(`成本熔断:❌ 未判定(${e.message})`)
  }
  console.log(`当前封票:${quarantined.length === 0 ? '无' : ''}`)
  for (const q of quarantined) console.log(`  - ${q.key} 至 ${q.until} :: ${q.line}`)
  console.log(`台账最近 5 条:`)
  for (const e of ledger.slice(-5))
    console.log(`  ${e.ts} ${e.mode}/${e.action}${e.why ? ` :: ${e.why}` : ''}`)
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
  const r = spawnSync(
    PS51,
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ps1],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: ROOT,
      windowsHide: true,
      timeout: 90_000,
      encoding: 'utf8',
    },
  )
  const out = String(r.stdout ?? '')
  if (r.status === 0 && /STATE=3\s+INTERVAL=PT1H/.test(out)) {
    console.log(`✅ 计划任务已注册(IHUI-AI auto-evolve,每小时,InteractiveToken):${out.trim()}`)
    record({ mode: 'install', action: 'task-registered', why: out.trim() })
  } else {
    console.error(
      `❌ 注册未判定(status=${r.status}):${String(r.stderr ?? '').slice(-200) || out.slice(-200)}`,
    )
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
  ok(
    'S1a 形状锁:合法配置通过',
    (() => {
      try {
        return (
          loadGates(() =>
            JSON.stringify({
              enabled: false,
              dailyDispatchBudget: 6,
              failureStreakLimit: 3,
              quarantineHours: 48,
              maxSessionMinutes: 45,
              sessionCommandTemplate: '',
              ticketWhitelist: ['readme'],
            }),
          ).enabled === false
        )
      } catch {
        return false
      }
    })(),
  )
  ok(
    'S1b 形状锁:缺白名单抛 GateShapeError',
    (() => {
      try {
        loadGates(() => '{}')
        return false
      } catch (e) {
        return e instanceof GateShapeError
      }
    })(),
  )
  ok(
    'S1c 形状锁:非法 JSON 抛 GateShapeError',
    (() => {
      try {
        loadGates(() => 'not-json')
        return false
      } catch (e) {
        return e instanceof GateShapeError
      }
    })(),
  )
  ok(
    'S1d 形状锁:failureStreakLimit=1 拒(首败即封误伤)',
    (() => {
      try {
        loadGates(() =>
          JSON.stringify({
            enabled: true,
            dailyDispatchBudget: 1,
            failureStreakLimit: 1,
            quarantineHours: 1,
            maxSessionMinutes: 1,
            sessionCommandTemplate: '',
            ticketWhitelist: ['x'],
          }),
        )
        return false
      } catch {
        return true
      }
    })(),
  )
  // S2 白名单
  ok('S2a 白名单命中(标题区)', matchWhitelist('**README 数字收尾** 同步四语', ['readme']) === true)
  ok(
    'S2b 白名单不命中(标题无关)',
    matchWhitelist('**重构鉴权中间件** 参考 readme 格式', ['readme', '文档']) === false,
  )
  ok(
    'S2c 白名单只看标题不进正文(实测缺口回归)',
    matchWhitelist('**第 3 期·进化回流**:失败票归因沉淀;pnpm 依赖升级自动生成票', ['依赖升级']) ===
      false,
  )
  ok(
    'S2d 无加粗段回落前 60 字',
    matchWhitelist('- [ ] 补 README 数字对齐说明,其余正文很长很长很长很长很长很长', ['readme']) ===
      true,
  )
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
  ok(
    'S3c 封票未到期判出',
    (() => {
      const until = new Date(Date.now() + 3600_000).toISOString()
      return quarantinedUntilOf([{ ticketKey: 'k', action: 'quarantined', until }], 'k') !== null
    })(),
  )
  ok(
    'S3d 封票已到期不拦',
    quarantinedUntilOf(
      [{ ticketKey: 'k', action: 'quarantined', until: new Date(Date.now() - 1000).toISOString() }],
      'k',
    ) === null,
  )
  // S4 模板
  ok(
    'S4 模板填充',
    fillTemplate('run --prompt {promptFile} --ticket {ticketKey}', {
      promptFile: 'a.md',
      ticketKey: 'kk',
    }) === 'run --prompt a.md --ticket kk',
  )
  // S5 派单面解析(元信息行忽略)
  const sample = [
    '── 剔除统计 ──',
    '  --exclude-inflight:暂移 7 行 ⇒ 出单 2 行 —— L7616 / L7644',
    '── 7 行(判定面:HEAD blob)──',
    '  L7626  - [ ] 补号',
    '  L7643  - [ ] `--allow-dangerous` 确认旁路仍在调用方。',
  ].join('\n')
  const parsed = parseTicketRows(sample)
  ok(
    'S5 解析器:只取判定面 L 行',
    parsed.length === 2 && parsed[0].line === 7626 && parsed[1].text.includes('allow-dangerous'),
  )
  // S6 锁判活
  ok(
    'S6 pid 判活:自身活 / 不存在者死',
    isPidAlive(process.pid) === true && isPidAlive(999999999) === false,
  )
  // S7 取票唯一入口形状(源码级:第二份拼装即 §22c 反面)
  ok(
    'S7 取票唯一入口 = plan-tasks + 三旗',
    PLAN_TASKS.endsWith('plan-tasks.mjs') &&
      DISPATCH_ARGS.join(' ') === '--open --dispatchable --exclude-inflight',
  )
  // S8 token 计量取数(第 3 期④):终态 complete 行的 usage 是唯一取数口,缺失/形状坏一律未判定
  const complete =
    '{"type":"complete","stopReason":"end_turn","usage":{"promptTokens":900,"completionTokens":100,"totalTokens":1000,"estimatedCostUsd":0.12}}'
  const u1 = parseSessionUsage(`{"type":"start","prompt":"x"}\n${complete}\n`)
  ok(
    'S8a complete 行 usage → tokens/成本',
    u1.measured === true && u1.tokens === 1000 && u1.costUsd === 0.12,
  )
  ok(
    'S8b 无 complete 行(超时/被杀)→ 未计量',
    parseSessionUsage('{"type":"message_delta","text":"x"}').measured === false,
  )
  ok(
    'S9a 结算:票已从派单面消失 ⇒ line-gone(结清摘行算推进)',
    (() => {
      const led = [
        {
          action: 'session-ok',
          ticketKey: 'kk',
          ts: '2026-10-31T05:00:00.000Z',
          ticketLine: 'B1 原文',
        },
      ]
      const r = settlePriorDispatches({
        ledger: led,
        currentRows: [],
        now: Date.parse('2026-11-01T05:00:00.000Z'),
      })
      return r.length === 1 && r[0].state === 'line-gone'
    })(),
  )
  ok(
    'S9b 结算:票行逐字未变 ⇒ no-progress(会话自称成功也不算推进)',
    (() => {
      const text = 'B2 **同一张票** 一字未动'
      const led = [
        {
          action: 'session-ok',
          ticketKey: ticketKeyOf(text),
          ts: '2026-10-31T05:00:00.000Z',
          ticketLine: text,
        },
      ]
      const r = settlePriorDispatches({
        ledger: led,
        currentRows: [{ text, line: 9 }],
        now: Date.parse('2026-11-01T05:00:00.000Z'),
      })
      return r.length === 1 && r[0].state === 'no-progress'
    })(),
  )
  ok(
    'S9c 结算:票行被改写(加注记/翻勾)⇒ line-changed',
    (() => {
      const then = 'B3 **原票面** 前缀一致的部分'
      const now2 = 'B3 **原票面** 前缀一致的部分 —— 已追加进展注记'
      const led = [
        {
          action: 'session-ok',
          ticketKey: ticketKeyOf(then),
          ts: '2026-10-31T05:00:00.000Z',
          ticketLine: then,
        },
      ]
      const r = settlePriorDispatches({
        ledger: led,
        currentRows: [{ text: now2, line: 3 }],
        now: Date.parse('2026-11-01T05:00:00.000Z'),
      })
      return r.length === 1 && r[0].state === 'line-changed'
    })(),
  )
  ok(
    'S9d 派单面取不到 ⇒ unjudged,不猜成"没推进"也不猜成"推进了"',
    (() => {
      const led = [
        { action: 'session-ok', ticketKey: 'k4', ts: '2026-10-31T05:00:00.000Z', ticketLine: 'B4' },
      ]
      const r = settlePriorDispatches({
        ledger: led,
        currentRows: null,
        now: Date.parse('2026-11-01T05:00:00.000Z'),
      })
      return r.length === 1 && r[0].state === 'unjudged'
    })(),
  )
  ok(
    'S9e 已结算的成功不重复结算(结算腿每轮都跑也不该把同一枚记两次)',
    (() => {
      const led = [
        { action: 'session-ok', ticketKey: 'k5', ts: '2026-10-31T05:00:00.000Z', ticketLine: 'B5' },
        {
          action: 'dispatch-settled',
          ticketKey: 'k5',
          sourceTs: '2026-10-31T05:00:00.000Z',
          settled: 'line-gone',
        },
      ]
      return (
        settlePriorDispatches({
          ledger: led,
          currentRows: [],
          now: Date.parse('2026-11-01T05:00:00.000Z'),
        }).length === 0
      )
    })(),
  )
  ok(
    'S9g 反向锁:票键随尾部注记漂移但行首同源 ⇒ line-changed(不得冒充"结清摘行")',
    (() => {
      const then = 'B12 **注记漂移试验** 原文'
      const now2 = then + ' —— 会话只追加了一句进展'
      const led = [
        {
          action: 'session-ok',
          ticketKey: ticketKeyOf(then),
          ts: '2026-10-31T05:00:00.000Z',
          ticketLine: then,
        },
      ]
      const r = settlePriorDispatches({
        ledger: led,
        currentRows: [{ text: now2, line: 12 }],
        now: Date.parse('2026-11-01T05:00:00.000Z'),
      })
      return (
        ticketKeyOf(then) !== ticketKeyOf(now2) && r.length === 1 && r[0].state === 'line-changed'
      )
    })(),
  )
  ok(
    'S9f 窗口语义仍可用:显式传 windowHours 时超窗的成功不进结算',
    (() => {
      const led = [
        { action: 'session-ok', ticketKey: 'k6', ts: '2026-10-01T05:00:00.000Z', ticketLine: 'B6' },
      ]
      return (
        settlePriorDispatches({
          ledger: led,
          currentRows: [],
          windowHours: 48,
          now: Date.parse('2026-11-01T05:00:00.000Z'),
        }).length === 0
      )
    })(),
  )
  ok(
    'S9h 默认不限窗口 ⇒ 超窗的成功也结清(否则悬案永久化,尺子 A7 结构上恒红)',
    (() => {
      const led = [
        { action: 'session-ok', ticketKey: 'k6', ts: '2026-10-01T05:00:00.000Z', ticketLine: 'B6' },
      ]
      return (
        settlePriorDispatches({
          ledger: led,
          currentRows: [],
          now: Date.parse('2026-11-01T05:00:00.000Z'),
        }).length === 1
      )
    })(),
  )
  ok(
    'S8c usage 形状坏 → 未计量(不读成 0 tokens 放行)',
    parseSessionUsage('{"type":"complete","usage":{"totalTokens":"NaN"}}').measured === false,
  )
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
  ok(
    'S10a 清单缺失 ⇒ missing 档,一次提交都不调',
    (() => {
      const spy = commitSpy()
      const r = landTicketArtifacts({
        ticketKey: 'k10',
        ticketText: '某票',
        manifestText: null,
        statusFn: () => ' M x',
        commitFn: spy.fn,
      })
      return r.action === 'artifact-manifest-missing' && spy.calls.length === 0
    })(),
  )
  ok(
    'S10b 清单 JSON 坏 ⇒ invalid,不提交',
    (() => {
      const spy = commitSpy()
      const r = landTicketArtifacts({
        ticketKey: 'k10',
        ticketText: '某票',
        manifestText: '{"ticketKey":"k10",',
        statusFn: () => ' M x',
        commitFn: spy.fn,
      })
      return r.action === 'artifact-manifest-invalid' && spy.calls.length === 0
    })(),
  )
  ok(
    'S10c 清单票键不匹配 ⇒ invalid(上一轮的清单不许记到这张票头上)',
    (() => {
      const spy = commitSpy()
      const r = landTicketArtifacts({
        ticketKey: 'k10',
        ticketText: '某票',
        manifestText: manifestOf(['scripts/a.mjs'], 'other'),
        statusFn: () => ' M x',
        commitFn: spy.fn,
      })
      return r.action === 'artifact-manifest-invalid' && spy.calls.length === 0
    })(),
  )
  ok(
    'S10d files 空数组 ⇒ invalid(写了空清单也算 invalid,不读成"没改")',
    (() => {
      const spy = commitSpy()
      const r = landTicketArtifacts({
        ticketKey: 'k10',
        ticketText: '某票',
        manifestText: manifestOf([]),
        statusFn: () => ' M x',
        commitFn: spy.fn,
      })
      return r.action === 'artifact-manifest-invalid' && spy.calls.length === 0
    })(),
  )
  ok(
    'S10e 路径逃逸(../x、D:/x、/abs/x)⇒ 整批拒绝,不做部分提交',
    (() => {
      const spy = commitSpy()
      const r = landTicketArtifacts({
        ticketKey: 'k10',
        ticketText: '某票',
        manifestText: manifestOf(['scripts/a.mjs', '../x', 'D:/x', '/abs/x']),
        statusFn: () => ' M x',
        commitFn: spy.fn,
      })
      return (
        r.action === 'artifact-manifest-invalid' && spy.calls.length === 0 && r.dropped.length === 3
      )
    })(),
  )
  ok(
    'S10f 清单含 PROJECT_PLAN.md ⇒ 整批拒绝(活文档并发冲突)',
    (() => {
      const spy = commitSpy()
      const r = landTicketArtifacts({
        ticketKey: 'k10',
        ticketText: '某票',
        manifestText: manifestOf(['scripts/a.mjs', 'PROJECT_PLAN.md']),
        statusFn: () => ' M x',
        commitFn: spy.fn,
      })
      return (
        r.action === 'artifact-manifest-invalid' &&
        spy.calls.length === 0 &&
        r.dropped.includes('PROJECT_PLAN.md')
      )
    })(),
  )
  ok(
    'S10g 清单文件全无改动 ⇒ stale,不提交',
    (() => {
      const spy = commitSpy()
      const r = landTicketArtifacts({
        ticketKey: 'k10',
        ticketText: '某票',
        manifestText: manifestOf(['scripts/a.mjs']),
        statusFn: () => '',
        commitFn: spy.fn,
      })
      return (
        r.action === 'artifact-manifest-stale' &&
        spy.calls.length === 0 &&
        r.dropped[0] === 'scripts/a.mjs'
      )
    })(),
  )
  ok(
    'S10h 有效清单 ⇒ 调提交且 env 带票键/席位,消息点名票键与票面',
    (() => {
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
    })(),
  )
  ok(
    'S10i 提交抛错(并发索引锁)⇒ artifact-commit-failed,不把整轮打崩',
    (() => {
      const r = landTicketArtifacts({
        ticketKey: 'k10',
        ticketText: '某票',
        manifestText: manifestOf(['scripts/a.mjs']),
        statusFn: () => ' M scripts/a.mjs',
        commitFn: () => {
          throw new Error('index.lock: File exists')
        },
      })
      return (
        r.action === 'artifact-commit-failed' &&
        r.files.length === 1 &&
        r.why.includes('index.lock')
      )
    })(),
  )
  ok(
    'S10j dry-run ⇒ 只出预览,不调提交',
    (() => {
      const spy = commitSpy()
      const r = landTicketArtifacts({
        ticketKey: 'k10',
        ticketText: '某票',
        manifestText: manifestOf(['scripts/a.mjs']),
        statusFn: () => ' M scripts/a.mjs',
        commitFn: spy.fn,
        dryRun: true,
      })
      return r.action === 'artifact-preview' && r.files.length === 1 && spy.calls.length === 0
    })(),
  )
  // S11:决策候选刷新腿(第 2 期写侧的接线锁)。每条都钉一个具体失效方向。
  const s11Dir = join(TMP_DIR, 'selftest-s11')
  const s11Script = join(ROOT, 'scripts', 'autonomy-candidates.mjs')
  ok(
    'S11a 候选文件新鲜 ⇒ 不重跑生成器(84s 的器物不能每轮都调)',
    (() => {
      mkdirSync(s11Dir, { recursive: true })
      const cand = join(s11Dir, 'fresh.json')
      // 指纹档才算"新鲜":没有指纹的旧档必须被重刷一次(自愈),所以这里给出当下票面指纹。
      writeFileSync(
        cand,
        JSON.stringify({
          source: {
            planDigest: planFaceDigest(
              readFileSync(join(ROOT, 'PROJECT_PLAN.md'), 'utf8').split(/\r?\n/),
            ),
          },
        }),
        'utf8',
      )
      let called = 0
      const r = refreshAutonomyCandidates({
        now: Date.now(),
        scriptFile: s11Script,
        candidatesFile: cand,
        runner: () => {
          called++
          return ''
        },
      })
      return r.state === 'ok' && called === 0 && String(r.why).includes('新鲜')
    })(),
  )
  ok(
    'S11b 候选文件过期 ⇒ 真调生成器一次(节流不等于永不刷新)',
    (() => {
      mkdirSync(s11Dir, { recursive: true })
      const cand = join(s11Dir, 'stale.json')
      writeFileSync(cand, '{}', 'utf8')
      const old = new Date(Date.now() - 7 * 3600_000)
      utimesSync(cand, old, old)
      let called = 0
      const r = refreshAutonomyCandidates({
        now: Date.now(),
        scriptFile: s11Script,
        candidatesFile: cand,
        runner: () => {
          called++
          return ''
        },
      })
      return r.state === 'ok' && called === 1 && String(r.why).includes('刷新')
    })(),
  )
  ok(
    'S11c dry-run ⇒ 不刷新且如实说"决策将按台账序",不假装刷过',
    (() => {
      const r = refreshAutonomyCandidates({
        dryRun: true,
        scriptFile: s11Script,
        candidatesFile: join(s11Dir, 'never-exists.json'),
        runner: () => {
          throw new Error('dry-run 不该调生成器')
        },
      })
      return r.state === 'undetermined' && String(r.why).includes('dry-run')
    })(),
  )
  ok(
    'S11d 器物不在位 ⇒ 未判定并点名路径(不把"没装"读成"没有候选"的合法态)',
    (() => {
      const r = refreshAutonomyCandidates({
        scriptFile: join(s11Dir, 'nope.mjs'),
        candidatesFile: join(s11Dir, 'x.json'),
        runner: () => {
          throw new Error('不该调')
        },
      })
      return r.state === 'undetermined' && String(r.why).includes('不在位')
    })(),
  )
  ok(
    'S11e 接线锁:刷新腿真在派发主循环里(没有这一行,第 2 期永远不生效)',
    (() => {
      const src = readFileSync(join(ROOT, 'scripts', 'auto-evolve.mjs'), 'utf8')
      return /if \(!noDecide\) \{\s*\r?\n\s*const gen = refreshAutonomyCandidates\(\{ dryRun \}\)/.test(
        src,
      )
    })(),
  )
  // S12 会话全文落盘腿(第 4 格·观测腿,2026-11-01 立):命名/脱敏/截断/轮转判据 + 接线锁。
  // 判据全部 import 自 lib/session-transcript.mjs(单一真相源),本处只验"编排有没有按契约处置"。
  ok(
    'S12a 正文三段齐备(PROMPT/STDOUT/STDERR 横幅)',
    (() => {
      const t = buildTranscript({ ticketKey: 'k12', prompt: 'P', stdout: 'O', stderr: 'E' })
      return (
        t.includes('===== PROMPT(会话被交代了什么) =====') &&
        t.includes('===== STDOUT(事件流原样) =====') &&
        t.includes('===== STDERR =====')
      )
    })(),
  )
  ok(
    'S12b 脱敏:Bearer 令牌被替换,头部记命中次数',
    (() => {
      const t = buildTranscript({ prompt: 'Authorization: Bearer eyJabc.def.ghi token' })
      return t.includes('«REDACTED:bearer»') && /redacted:.*bearer/.test(t)
    })(),
  )
  ok(
    'S12c 脱敏:私钥块整段被替换(原文不残留)',
    (() => {
      const block = '-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----'
      const t = buildTranscript({ prompt: block })
      return t.includes('«REDACTED:private-key»') && !t.includes('MIIabc')
    })(),
  )
  ok(
    'S12d 截断留痕:超限时正文含"中略"且头尾保留,头部 redacted 行仍在',
    (() => {
      const big = 'x'.repeat(5 * 1024 * 1024)
      const t = buildTranscript({ prompt: big })
      const capped = capTranscript(t)
      return (
        capped.truncated === true &&
        capped.text.includes('中略') &&
        capped.text.startsWith('# session transcript')
      )
    })(),
  )
  ok(
    'S12e 不截断:未超限逐字不变',
    (() => {
      const t = buildTranscript({ prompt: '短文本' })
      const capped = capTranscript(t)
      return capped.truncated === false && capped.text === t
    })(),
  )
  ok(
    'S12f 命名:transcriptRelPathOf 产物过 isTranscriptName 且含票键',
    (() => {
      const rel = transcriptRelPathOf({
        at: new Date(),
        ticketKey: 'deadbeef12345678',
        mode: 'dispatch',
        action: 'session-ok',
      })
      return isTranscriptName(rel) && rel.includes('deadbeef12345678')
    })(),
  )
  ok(
    'S12g 轮转:最新一份无论多老都保留(失效方向=多留证据)',
    (() => {
      const now = Date.now()
      const oldest = now - 365 * 86_400_000
      const newer = now - 100 * 86_400_000 // 也超 14 天,但比 oldest 新 ⇒ 仍豁免保留
      const r = decideRetention(
        [
          { rel: 'oldest.log', mtimeMs: oldest },
          { rel: 'newer.log', mtimeMs: newer },
        ],
        { now, keepDays: 14, keepMax: 500 },
      )
      return (
        r.keep.length === 1 &&
        r.keep[0] === 'newer.log' &&
        r.drop.length === 1 &&
        r.drop[0].rel === 'oldest.log'
      )
    })(),
  )
  ok(
    'S12h 轮转:非最新的过期件被删(带 why)',
    (() => {
      const now = Date.now()
      const old = now - 365 * 86_400_000
      const mid = now - 86_400_000
      const r = decideRetention(
        [
          { rel: 'a.log', mtimeMs: old },
          { rel: 'b.log', mtimeMs: mid },
          { rel: 'c.log', mtimeMs: now },
        ],
        { now, keepDays: 14, keepMax: 500 },
      )
      return r.keep.length === 2 && r.drop.some((d) => d.rel === 'a.log' && /天前/.test(d.why))
    })(),
  )
  ok(
    'S12i 轮转:mtime 取不到 ⇒ 不删(未判定不猜,§0.3)',
    (() => {
      const r = decideRetention([{ rel: 'a.log', mtimeMs: NaN }], {
        now: Date.now(),
        keepDays: 14,
        keepMax: 500,
      })
      return r.undetermined.length === 1 && r.drop.length === 0
    })(),
  )
  ok(
    'S12j 接线锁:dispatchSession / probeSession 都调 persistTranscript 并把 transcript 带进台账',
    (() => {
      const src = readFileSync(join(ROOT, 'scripts', 'auto-evolve.mjs'), 'utf8')
      const dispatchWired = /const transcript = persistTranscript\(\{[\s\S]*?mode: 'dispatch'/.test(
        src,
      )
      const probeWired = /const transcript = persistTranscript\(\{[\s\S]*?mode: 'probe'/.test(src)
      const ledgerWired =
        /transcript: res\.transcript \?\? null/.test(src) &&
        /record\(\{ mode: 'probe'[\s\S]*?transcript,/.test(src)
      return dispatchWired && probeWired && ledgerWired
    })(),
  )
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

/**
 * 本器认识的旗标(唯一清单)。
 *
 * 立因①(2026-11-05 实测):本文件原先**没有 --help 档** —— 敲 `node scripts/auto-evolve.mjs --help`
 * 想读用法,未知旗标被静默忽略,于是**真的跑完一整轮自主轮**(读人工阀、跑分诊轮、写台账、
 * 占当日派发额度)。对照组 `scripts/live-doc-edit.mjs` 缺必需 env 时是 `⇒ 拒绝执行`。
 * §0.10:失效方向必须是"多要一次定向说明",绝不能是"多放一次跳门"。
 *
 * 立因②(同一枚实测,差点自伤):守护侧真跑的 argv 是 `--once --no-triage`
 * (`scripts/git-guardian.mjs:14373`),而计划任务模板(`scripts/auto-evolve.mjs:2643`)传 `--once`
 * —— **`--once` 从来没被本器认识过**,一直靠"静默忽略"活着。若照字面做"未知旗标即拒绝",
 * 这一改会当场把生产派发腿冻住(每轮 exit 2)。所以清单必须先收发射点真传的每一枚,
 * 并由镜像测试 `发射侧 argv ⊆ 本清单` 钉住:加旗标的人不同时更新清单 ⇒ 红在加的人那一枚。
 *
 * 形态纪律:必须用**函数声明**(提升)而不是 `export const` —— 本文件的 isDirectRun 调用点
 * 在源码里早于模块底部常量初始化,const 版实测报 `Cannot access 'KNOWN_FLAGS' before initialization`。
 */
export function knownFlags() {
  return [
    '--once', // 发射侧与计划任务在用:每次调用本就跑一轮(语义 = 默认档,收进清单只为"未知即拒绝"不冻腿)
    '--status',
    '--probe',
    '--dry-run',
    '--self-test',
    '--install-task',
    '--apply',
    '--no-decide',
    '--no-triage',
    '--no-retro',
    '--help',
    '-h',
  ]
}

function usageText() {
  return [
    'usage: node scripts/auto-evolve.mjs [档] [修饰旗标]',
    '  (无旗标 / --once)        真跑一轮:取票 → 人工阀 → 派班 → 落账 → 提交',
    '  --status                 只读:今日额度/最近班次/封票清单(不派生会话)',
    '  --probe [--dry-run]      单发一次会话探测;--dry-run 只取票不派',
    '  --dry-run [--no-decide]  整轮预演:走到派发闸前停住',
    '  --self-test              内建自检档',
    '  --install-task [--apply] 打印/落盘计划任务注册命令',
    '  修饰旗标:--no-triage --no-retro --no-decide',
    '  认识的全部旗标:' + knownFlags().join(' '),
    '注:未知旗标一律拒绝(exit 2)—— 静默忽略会让一次手滑就烧掉一整轮额度。',
  ].join('\n')
}

async function main(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usageText())
    process.exitCode = 0
    return
  }
  const known = knownFlags()
  const unknown = args.filter((a) => a.startsWith('-') && !known.includes(a))
  if (unknown.length) {
    console.error(`❌ 未判定:不认识旗标 ${unknown.join(' ')} ⇒ 不跑任何动作(§0.10 不多放一次跳门)`)
    console.error(usageText())
    process.exitCode = 2
    return
  }
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
  if (args.includes('--dry-run'))
    return runOnce({ dryRun: true, noDecide: args.includes('--no-decide') })
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
      console.log(
        `── 进化回流写回轮 ──\nℹ 跳过:部署决策台账尚未产生(${decisionsPath}),无可提炼的失败桶`,
      )
    } else {
      const rr = spawnSync(
        process.execPath,
        [join(ROOT, 'scripts', 'evolution-retro.mjs'), '--apply'],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: ROOT,
          windowsHide: true,
          timeout: 120_000,
          encoding: 'utf8',
        },
      )
      const rOut = String(rr.stdout ?? '').trim()
      if (rOut) console.log(`── 进化回流写回轮 ──\n${rOut}`)
      if (rr.status !== 0) {
        console.error(
          `⚠ 进化回流写回未判定(rc=${rr.status ?? '?'}):${String(rr.stderr ?? '')
            .trim()
            .slice(-300)}`,
        )
      }
    }
  }
  return out
}

export const __test__ = {
  loadGates,
  judgeSelfFace,
  knownFlags,
  extractTicketScopeHints,
  buildTicketScope,
  readPoolWinnability,
  renderTicketScope,
  normalizeSessionRuntime,
  classifySessionWrites,
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
