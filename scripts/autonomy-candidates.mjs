#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具:预览就是产物,依据必须打到终端 */

/**
 * autonomy-candidates — 自治决策候选评估文件的**唯一写侧**(第 2 期断点,2026-11-01 立)。
 *
 * 断点现场:`.ihui-agent/state/autonomy-candidates.json` 在全仓只有 auto-evolve.mjs:62
 * 一处**定义**、零写入方 ⇒ 该文件永远不会出现 ⇒ `rankTicketRows()` 恒走"无候选评估文件"
 * 分支 ⇒ 第 2 期(自治决策排序)整期不生效,策略文件里的权重与阈值写得再细也没人消费。
 *
 * 本器只做一件事:把派单面上每张票的**结构性证据**翻成决策模型要的九个因子并落盘。
 *
 * 判据纪律(违反任何一条 = 本器变成"替 AI 编因子"的第二张嘴):
 *  - 不编语义:每个因子只从可观测证据推 —— 票面命中了哪个词、点名了哪条路径、
 *    台账里是多少小时;并且逐条写进 `evidence`。"为什么是这一档"必须能被人照着复核,
 *    所以这里不接受"综合判断""看起来重要"这类无法复算的理由。
 *  - 口径不复制(§0.6/§22c):取票唯一入口 = plan-tasks + DISPATCH_ARGS(import 自
 *    auto-evolve.mjs),输出解析 = parseTicketRows,票键 = lib/ticket-key.mjs,
 *    策略加载 = autonomy-decision.loadPolicy,排序 = autonomy-decision.decide。
 *    本文件里没有第二份"什么算可派"、也没有第二份权重表。
 *  - 取不到派单面 / 策略形状坏 / 自身产出过不了决策器的形状锁 ⇒ exit 2「未判定」,
 *    不写文件、不猜绿(§0.3:没判绝不写成判过)。
 *  - 默认只预览,`--apply` 才落盘:状态文件是全仓共享面,看一眼和写进去必须显式分开。
 *
 * 用法:
 *   node scripts/autonomy-candidates.mjs             # 预览:摘要 + 每票每因子依据(不写盘)
 *   node scripts/autonomy-candidates.mjs --apply     # 落盘 autonomy-candidates.json
 *   node scripts/autonomy-candidates.mjs --json      # 机器可读(含模型裁决摘要)
 *   node scripts/autonomy-candidates.mjs --self-test # 内置断言
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

// 口径全部从既有实现 import —— 本文件不拼第二份旗标、不写第二份解析器、不算第二份票键。
import { ROOT, PLAN_TASKS, DISPATCH_ARGS, LEDGER, parseTicketRows, quarantinedUntilOf, rankTicketRows } from './auto-evolve.mjs'
import { ticketKeyOf } from './lib/ticket-key.mjs'
import { loadPolicy, POLICY_PATH, FACTOR_KEYS, validateCandidates, decide } from './autonomy-decision.mjs'

/** 落盘位置(与 auto-evolve.mjs 的 AUTONOMY_CANDIDATES 同一路径;那边未导出,故此处按仓根归一拼一次) */
export const CANDIDATES_PATH = join(ROOT, '.ihui-agent', 'state', 'autonomy-candidates.json')
/** 活文档原文:只用来给"票面是否被截断"当对照面(派单面输出是硬切,文本上认不出截断)。 */
export const PLAN_MD = join(ROOT, 'PROJECT_PLAN.md')

/**
 * 读活文档的物理行(按行号索引即 line-1)。
 * 读不到 ⇒ 返回 null,由 isTicketTruncated 判成"按截断处理"(保守),绝不猜"没截断"。
 * 行号在并发写台账时会漂移,所以这里只做长度对照,不做内容断言 —— 漂移的后果是
 * 少数票被多算一次保守下限,方向安全。
 */
export function readPlanLines(path = PLAN_MD) {
  try {
    return readFileSync(path, 'utf8').split(/\r?\n/)
  } catch {
    return null
  }
}
export const SCHEMA_VERSION = 1

/**
 * 台账里算"本票被认领过/动过"的动作档(用于认领牌年龄;其他动作与租约无关,不参与)
 * `session-no-write` 必须在册(2026-11-04):它是"派了会话但整班零写盘"的结果档 —— 班次确实被这张票
 * 吃掉了。漏认它会把刚派过班的票读成"没人动过",认领牌年龄与紧迫度都算错方向。
 */
const ACTIVITY_ACTIONS = new Set(['dispatched', 'session-ok', 'session-no-write', 'session-failed', 'session-timeout'])

// ───────────────────────── 证据词表(全部是"命中即见"的硬词,不收泛词) ─────────────────────────

/** 高影响词:命中即牵动生产面(与票面同语言,不依赖模型理解) */
const IMPACT_TERMS = ['安全', '鉴权', '认证', '凭据', '密钥', '口令', '数据', '迁移', '部署', '生产', '守门', '判据', '回滚', '支付', '隐私']

/** 用户可见面:落点路径 + 路由字面(API 端点也是用户面) */
const USER_SURFACES = [
  { name: 'web', label: 'apps/web', re: /apps\/web(?![\w-])/ },
  { name: 'mobile', label: 'apps/mobile', re: /apps\/mobile(?![\w-])/ },
  { name: 'api-route', label: 'apps/api 路由面', re: /apps\/api\/(?:src\/)?routes?\// },
]
/** 路由字面 = 端点(如 `GET /api/app-version/latest`);前置断言挡住 `apps/api/...` 这类文件路径 */
const ROUTE_LITERAL_RE = /(?<![\w/])\/api\/[A-Za-z0-9\-_/:.]*/g

/** 不可逆操作族:按族计数(同族多词只算一族,避免"删除"写两遍就跳档) */
const IRREVERSIBLE_FAMILIES = [
  { name: '数据迁移', terms: ['迁移', 'migrate', 'migration'] },
  { name: '删除/清空', terms: ['删除', '清空', 'purge', 'DROP TABLE', 'rm -rf'] },
  { name: '凭据轮换', terms: ['轮换', 'rotate', '重置口令', '重置密钥'] },
]
/** 显式不可逆表述:只有票面自己说"不可逆",才允许顶到最高档(硬阻断阈值) */
const IRREVERSIBLE_EXPLICIT = ['不可逆', '不可恢复', '永久删除', '物理删除', 'DROP TABLE']

/** 外部依赖族:机主审批 / 第三方控制台 / 外部服务 */
const EXTERNAL_FAMILIES = [
  { name: '机主审批', terms: ['机主', '拍板', '审批', '人工阀', '等人', '等条件'] },
  { name: '第三方控制台', terms: ['控制台', '阿里云', '腾讯云', '微信公众平台', '域名', 'DNS', '备案'] },
  { name: '外部服务', terms: ['外部服务', '第三方', '上游', 'GitHub App', '短信', 'OSS', 'CDN', '隧道', 'webhook'] },
]

/** 规则面落点:点名到规则文件本身 = 改判据,属人工阀面;只提"判据"二字算中档 */
const RULE_FILE_RE = /(?:^|[\s`"'(\[（【、,，:：;；])(AGENTS\.md|scripts\/check-[A-Za-z0-9\-_]+\.mjs|scripts\/lib\/[A-Za-z0-9\-_]+\.mjs)/
const RULE_TERMS = ['守门', '判据', '铁律']

/** 票面点名的路径(落点计数用)。只认仓内可辨路径,不认 URL/域名/纯词。 */
const PATH_TOKEN_RE =
  /(?:^|[\s`"'(\[（【、,，:：;；|>])((?:apps|packages|scripts|deploy|docs|prisma|infra|tools|\.github|\.ihui-agent)\/[A-Za-z0-9_.\-*/[\]]*[A-Za-z0-9_\-*\]]|[A-Za-z0-9_.\-]+\.(?:mjs|cjs|ts|tsx|jsx|js|json|md|sql|ps1|ya?ml|toml))/g

/** 验收面:点名测试文件 = 最便宜;只提"自检/验收" = 中档;什么都没有 = 按参照满额 */
const TEST_FILE_RE = /scripts\/tests\/[A-Za-z0-9\-_.]+\.mjs/g
const VERIFY_TERMS = ['--self-test', '自检', '测试', '回归', '验收', '复量']

const clamp = (n, max) => Math.max(0, Math.min(max, n))
const r2 = (n) => Math.round(n * 100) / 100

/** 正则按次新建:带 g 的 RegExp 有 lastIndex 状态,复用会让第二次调用读到空结果 */
const eachMatch = (text, re) => [...String(text).matchAll(new RegExp(re.source, 'g'))]

/** 票面点名的路径去重(剥尾部的句读与斜杠:`deploy/**` 与 `apps/web/` 都归一) */
export function pathsOf(text) {
  const out = new Set()
  for (const m of eachMatch(text, PATH_TOKEN_RE)) {
    const p = String(m[1]).replace(/[.,;:，、；：]+$/, '').replace(/\/+$/, '')
    if (!p || p.includes('://')) continue
    out.add(p)
  }
  return [...out]
}

// ───────────────────────── 九个因子(每个都返回 { 值, evidence }) ─────────────────────────

/** 影响面:高影响词命中枚数,0/1/2/≥3 ⇒ 0/1/2/3 */
export function factorImpact(text, max) {
  const hit = IMPACT_TERMS.filter((t) => text.includes(t))
  return {
    level: clamp(hit.length, max),
    evidence: hit.length
      ? `命中高影响词 ${hit.length} 枚:${hit.join('、')}`
      : '未命中高影响词(安全/数据/迁移/部署/凭据/守门/判据 等)',
  }
}

/** 用户价值:落点是否在用户可见面。0 面 ⇒ 0;1 面 ⇒ 2;≥2 面 ⇒ 3;只点名 apps/api 非路由 ⇒ 1 */
export function factorUserValue(text, max) {
  const hit = new Map()
  for (const s of USER_SURFACES) if (s.re.test(text)) hit.set(s.name, s.label)
  const routes = [...new Set(text.match(new RegExp(ROUTE_LITERAL_RE.source, 'g')) ?? [])]
  if (routes.length && !hit.has('api-route')) hit.set('api-route', `路由字面 ${routes.slice(0, 2).join('、')}`)
  if (hit.size === 0) {
    const apiOnly = /apps\/api\//.test(text)
    return {
      level: apiOnly ? clamp(1, max) : 0,
      evidence: apiOnly ? '仅点名 apps/api 非路由文件(轻量用户面)' : '未点名 apps/web / apps/mobile / apps/api 路由面',
    }
  }
  return {
    level: clamp(hit.size === 1 ? 2 : 3, max),
    evidence: `命中用户可见面 ${hit.size} 个:${[...hit.values()].join(';')}`,
  }
}

/** 不可逆:按族计数封顶 2 档;只有票面显式说"不可逆/物理删除"才顶到最高档 */
export function factorIrreversible(text, max) {
  const families = IRREVERSIBLE_FAMILIES.map((f) => ({ name: f.name, hit: f.terms.filter((t) => text.includes(t)) })).filter((f) => f.hit.length)
  const explicit = IRREVERSIBLE_EXPLICIT.filter((t) => text.includes(t))
  if (explicit.length) {
    return {
      level: clamp(3, max),
      evidence: `显式不可逆表述「${explicit[0]}」${families.length ? `;同票还命中族:${families.map((f) => `${f.name}(${f.hit.join('/')})`).join('、')}` : ''}`,
    }
  }
  return {
    // 封顶 2 档:最高档(3)是策略里的硬阻断阈值,只留给票面**自己说不可逆**的那一族;
    // 靠词族堆叠就把票推进人工阀面,等于把"描述得详细"读成"不可逆"。
    level: clamp(Math.min(families.length, 2), max),
    evidence: families.length
      ? `命中不可逆操作族 ${families.length} 个:${families.map((f) => `${f.name}(${f.hit.join('/')})`).join('、')}`
      : '未命中数据迁移/删除清空/凭据轮换',
  }
}

/** 外部依赖:机主审批 / 第三方控制台 / 外部服务,按族计数 */
export function factorExternal(text, max) {
  const families = EXTERNAL_FAMILIES.map((f) => ({ name: f.name, hit: f.terms.filter((t) => text.includes(t)) })).filter((f) => f.hit.length)
  return {
    level: clamp(families.length, max),
    evidence: families.length
      ? `命中外部依赖族 ${families.length} 个:${families.map((f) => `${f.name}(${f.hit.join('/')})`).join('、')}`
      : '未提到机主审批/第三方控制台/外部服务',
  }
}

/** 触碰铁律:点名规则文件本身 ⇒ 3;只提守门/判据 ⇒ 2;只提铁律/规则 ⇒ 1 */
export function factorRuleTouch(text, max) {
  const file = RULE_FILE_RE.exec(text)
  if (file) return { level: clamp(3, max), evidence: `落点点名规则文件 ${file[1]}(改判据属人工阀面)` }
  const terms = RULE_TERMS.filter((t) => text.includes(t))
  const door = /门\s?\d{1,3}/.exec(text)
  if (terms.length || door) {
    return {
      level: clamp(2, max),
      evidence: `提到规则面:${[...terms, ...(door ? [door[0]] : [])].join('、')}(未点名规则文件本体)`,
    }
  }
  if (/规则/.test(text)) return { level: clamp(1, max), evidence: '仅提到「规则」,无守门/判据/铁律落点' }
  return { level: 0, evidence: '未提到 AGENTS.md/守门/判据/铁律' }
}

/** 改动面:票面点名路径条数,0/1/2-3/≥4 ⇒ 0/1/2/3 */
export function factorChangeSurface(text, max) {
  const paths = pathsOf(text)
  const level = paths.length === 0 ? 0 : paths.length === 1 ? 1 : paths.length <= 3 ? 2 : 3
  return {
    level: clamp(level, max),
    evidence: paths.length
      ? `点名路径 ${paths.length} 条:${paths.slice(0, 4).join('、')}${paths.length > 4 ? ' …' : ''}`
      : '票面未点名任何仓内路径(改动面无法从票面估)',
  }
}

/**
 * 验证时长:模型口径是**分钟**(cost.verifyMinutes,参照 scales.verifyMinutesRef),
 * 不是 0-3 档 —— 这一格填 0-3 会让所有票的验证成本都读成接近零。故按"有没有验收面"折算分钟。
 */
export function factorVerifyMinutes(text, policy) {
  const ref = policy.scales.verifyMinutesRef
  const tests = [...new Set(eachMatch(text, TEST_FILE_RE).map((m) => m[0]))]
  if (tests.length) return { minutes: Math.round(ref / 4), evidence: `点名测试面 ${tests.slice(0, 2).join('、')} ⇒ ${Math.round(ref / 4)}min(参照 ${ref}min)` }
  const terms = VERIFY_TERMS.filter((t) => text.includes(t))
  if (terms.length) return { minutes: Math.round(ref / 2), evidence: `提到验收手段「${terms.join('、')}」但未点名测试文件 ⇒ ${Math.round(ref / 2)}min(参照 ${ref}min)` }
  return { minutes: ref, evidence: `票面未点名测试面/验收件 ⇒ 按参照 ${ref}min 计(零余量,不假装便宜)` }
}

/**
 * 租约:模型口径是"**剩余**小时"(1 - min(raw/参照,1):越临近到期越紧急),
 * 所以字段里写剩余,牌龄写进 evidence —— 把牌龄直接写进字段会把"挂了 100 小时的陈牌"
 * 读成最不紧急,方向是反的。无牌 = 0 档(模型口径的 null ⇒ 紧迫度 0),不写 0 小时
 * (0 小时在模型里等于"刚到期 = 最紧急")。
 */
export function factorLease(text, key, ctx) {
  const ref = ctx.policy.scales.leaseHoursRef
  const starts = []
  const marker = /（进行中@(\d{4}-\d{2}-\d{2})[^）]*）/.exec(text)
  if (marker) {
    const at = Date.parse(marker[1])
    if (Number.isFinite(at)) starts.push({ at, src: `票面认领牌「进行中@${marker[1]}」` })
  }
  const ledgerAt = ctx.lastActivityAt.get(key)
  if (Number.isFinite(ledgerAt)) starts.push({ at: ledgerAt, src: `台账本票最近动作 ${new Date(ledgerAt).toISOString()}` })
  if (starts.length === 0) {
    return { hours: null, evidence: '无认领牌(票面无「进行中@」且台账无本票动作)⇒ null,模型口径"无租约"紧迫度 0' }
  }
  const start = Math.min(...starts.map((s) => s.at))
  const ageHours = Math.max(0, (ctx.now - start) / 3_600_000)
  const remain = Math.max(0, ref - ageHours)
  return {
    hours: r2(remain),
    evidence: `牌龄 ${ageHours.toFixed(1)}h(${starts.map((s) => s.src).join(';')})⇒ 剩余 ${r2(remain)}h / 参照 ${ref}h`,
  }
}

/** 阻塞他人:点名"挡住/卡住谁" ⇒ 3;只说"阻塞" ⇒ 2;只提到被阻塞/等待 ⇒ 1 */
export function factorBlocking(text, max) {
  const blocks = ['阻塞他人', '挡住', '卡住', '堵住', '卡着', '阻塞别'].filter((t) => text.includes(t))
  if (blocks.length) return { level: clamp(3, max), evidence: `点名阻塞他人:${blocks.join('、')}` }
  if (text.includes('阻塞')) return { level: clamp(2, max), evidence: '提到「阻塞」但未点名对象/方向 ⇒ 记 2 档' }
  const waiting = ['被阻塞', '等条件', '等人', '等待', '待上游', '未落地'].filter((t) => text.includes(t))
  if (waiting.length) return { level: clamp(1, max), evidence: `只提到被他人阻塞/等待:${waiting.join('、')}` }
  return { level: 0, evidence: '未提到阻塞他人或被阻塞' }
}

/**
 * 单票评估:票行 → 决策模型候选(九因子 + 逐因子 evidence)。
 * id 必须 = ticketKeyOf(票面):rankTicketRows 就是按这个键把模型排期接回派单面行。
 */
/**
 * 票面是否被派单面截断(2026-11-01 补,治"失效方向错误")。
 *
 * 立因:`plan-tasks` 把票行硬切到约 106 字,**截断处没有省略号**,文本上完全认不出来。
 * 落在截断之后的落点路径与关键词因此全部读不到 ⇒ 风险因子读 0。而"风险读 0"的方向是
 * **把高风险票排到前面**,与 AGENTS §0.10「失效方向必须朝向多报」正好相反 —— 收益类读 0
 * 只是保守压后(安全),风险类读 0 是危险。
 * 判据:拿行号回原文比长度;原文取不到(行号漂移/越界)一律按截断处理(fail-safe,不猜)。
 */
export function isTicketTruncated(row, { planLines = null } = {}) {
  const text = String(row?.text ?? '')
  const line = Number(row?.line)
  if (!Array.isArray(planLines) || !Number.isFinite(line) || line <= 0) return true
  const raw = String(planLines[line - 1] ?? '')
  if (!raw) return true
  // 容差 8:派单面会剥掉前缀标记与行尾空白,正常差值很小;超过这个量级只能是截断。
  return raw.length > text.length + 8
}

export function evaluateTicket(row, ctx) {
  const text = String(row?.text ?? '')
  const max = ctx.policy.scales.levelMax
  const key = ticketKeyOf(text)
  const impact = factorImpact(text, max)
  const userValue = factorUserValue(text, max)
  const irreversible = factorIrreversible(text, max)
  const external = factorExternal(text, max)
  const ruleTouch = factorRuleTouch(text, max)
  const surface = factorChangeSurface(text, max)
  const verify = factorVerifyMinutes(text, ctx.policy)
  const lease = factorLease(text, key, ctx)
  const blocking = factorBlocking(text, max)
  const quarantinedUntil = quarantinedUntilOf(ctx.ledger ?? [], key, ctx.now)
  // 截断时风险三因子抬到保守下限 1(立因见 isTicketTruncated):风险读 0 会把高风险票排前面。
  const truncated = isTicketTruncated(row, ctx)
  const riskFloor = (f) =>
    truncated && f.level === 0
      ? { level: 1, evidence: `${f.evidence}｜票面被派单面截断 ⇒ 风险按保守下限 1 计,不读成 0` }
      : f
  const irr = riskFloor(irreversible)
  const ext = riskFloor(external)
  const rule = riskFloor(ruleTouch)
  return {
    id: key,
    title: text.slice(0, 120),
    benefit: { impact: impact.level, userValue: userValue.level },
    risk: { irreversible: irr.level, externalDependency: ext.level, ruleTouch: rule.level },
    cost: { changeSurface: surface.level, verifyMinutes: verify.minutes },
    urgency: { leaseHours: lease.hours, blockingOthers: blocking.level },
    // 审计面:每个因子的依据。决策器会剥掉这些字段(不参与计分),但人要能照着复核。
    evidence: {
      impact: impact.evidence,
      userValue: userValue.evidence,
      irreversible: irr.evidence,
      externalDependency: ext.evidence,
      ruleTouch: rule.evidence,
      changeSurface: surface.evidence,
      verifyMinutes: verify.evidence,
      leaseHours: lease.evidence,
      blockingOthers: blocking.evidence,
    },
    line: row?.line ?? null,
    notes: quarantinedUntil ? [`台账封禁至 ${new Date(quarantinedUntil).toISOString()}(派发闸另拦,本文件照评)`] : [],
  }
}

/** 台账 → 本票最近一次"被派/起过会话"的时刻(认领牌年龄的第二个证据源) */
export function activityMapOf(ledger) {
  const map = new Map()
  for (const e of ledger) {
    if (!e || !e.ticketKey || !ACTIVITY_ACTIONS.has(e.action)) continue
    const at = Date.parse(String(e.ts ?? ''))
    if (!Number.isFinite(at)) continue
    const prev = map.get(e.ticketKey)
    if (prev === undefined || at > prev) map.set(e.ticketKey, at)
  }
  return map
}

/**
 * 派单面 → 候选列表。同票键重复的行只留第一条(决策器遇重复 id 会判形状坏 ⇒ 整轮未判定,
 * 而"派单面上同一张票登记两次"是台账事实,不该把整轮打红);重复事实逐条点名。
 */
export function buildCandidates({ rows, policy, ledger = [], now = Date.now(), planLines = null }) {
  const ctx = { policy, ledger, now, lastActivityAt: activityMapOf(ledger), planLines }
  const seen = new Map()
  const duplicates = []
  const candidates = []
  for (const row of rows) {
    const text = String(row?.text ?? '')
    if (!text.trim()) continue
    const c = evaluateTicket(row, ctx)
    if (seen.has(c.id)) {
      duplicates.push({ id: c.id, keptLine: seen.get(c.id), droppedLine: row.line })
      continue
    }
    seen.set(c.id, row.line)
    candidates.push(c)
  }
  return { candidates, duplicates, generatedAt: new Date(now).toISOString() }
}

/** 落盘文档:rankTicketRows 认 `{ candidates: [...] }`,元信息只做审计用 */
export function buildDocument({ candidates, generatedAt, policy, rowCount }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    source: {
      face: `node scripts/plan-tasks.mjs ${DISPATCH_ARGS.join(' ')}`,
      rows: rowCount,
      ledger: LEDGER,
    },
    policy: {
      version: policy.version,
      levelMax: policy.scales.levelMax,
      verifyMinutesRef: policy.scales.verifyMinutesRef,
      leaseHoursRef: policy.scales.leaseHoursRef,
    },
    candidates,
  }
}

// ───────────────────────── IO 腿 ─────────────────────────

/**
 * 取派单面:唯一入口 = plan-tasks + DISPATCH_ARGS(旗标不在此处拼),解析用 parseTicketRows。
 * 取不到 ⇒ 抛(调用方落 exit 2);取到 0 行且 status=0 ⇒ 空面(合法事实,不是未判定)。
 */
export function pickFace() {
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

/** 台账现读:坏行跳过(台账是追加写的,一行半截不该让整轮未判定) */
export function readLedger(path = LEDGER) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
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
}

// ───────────────────────── 渲染 ─────────────────────────

const FACTOR_ORDER = Object.entries(FACTOR_KEYS).flatMap(([dim, keys]) => keys.map((k) => [dim, k]))

function renderFactorLines(c) {
  const lines = []
  for (const [dim, key] of FACTOR_ORDER) {
    const value = dim === 'cost' && key === 'verifyMinutes' ? `${c.cost.verifyMinutes}min` : String(c[dim][key])
    lines.push(`    ${`${dim}.${key}`.padEnd(26)} = ${value.padEnd(6)} :: ${c.evidence[key]}`)
  }
  if (c.notes.length) lines.push(`    notes: ${c.notes.join(';')}`)
  return lines
}

export function renderPreview(doc, decision, { written = false } = {}) {
  const out = [
    `自治候选评估 · ${written ? '已落盘' : '预览(不写盘;加 --apply 才落盘)'}`,
    `派单面:${doc.source.rows} 行 · 来源 ${doc.source.face}`,
    `策略:v${doc.policy.version} levelMax=${doc.policy.levelMax} verifyMinutesRef=${doc.policy.verifyMinutesRef}min leaseHoursRef=${doc.policy.leaseHoursRef}h`,
    `目标文件:${CANDIDATES_PATH}`,
    '',
  ]
  for (const c of doc.candidates) {
    out.push(`L${c.line} [${c.id}] ${c.title}`)
    out.push(...renderFactorLines(c))
  }
  if (decision) {
    out.push('', '── 模型裁决(直接调 autonomy-decision.decide,不另写第二份排序)──')
    out.push(`可排期 ${decision.counts.ranked} / 压后 ${decision.counts.deferred}(候选 ${decision.counts.input} 枚)`)
    for (const item of decision.ranked) {
      out.push(`#${item.rank} [${item.score}] ${item.id} ${item.title.slice(0, 60)}`)
    }
    if (decision.deferred.length) {
      out.push('压后:')
      for (const item of decision.deferred) out.push(`- [${item.score}] ${item.id} ${item.code}:${item.reason}`)
    }
  }
  return out.join('\n')
}

/** 机器可读面:候选文件内容 + 裁决摘要(不复制贡献明细,审计需要时用 autonomy-decision --json) */
export function toJsonDoc({ doc, decision, mode, written, duplicates }) {
  return {
    mode,
    written,
    path: CANDIDATES_PATH,
    generatedAt: doc.generatedAt,
    face: doc.source,
    policy: doc.policy,
    duplicates,
    candidates: doc.candidates,
    decision: decision
      ? {
          state: decision.state,
          counts: decision.counts,
          ranked: decision.ranked.map((x) => ({ rank: x.rank, id: x.id, score: x.score, riskLevel: x.riskLevel, reason: x.reason })),
          deferred: decision.deferred.map((x) => ({ id: x.id, score: x.score, code: x.code, reason: x.reason })),
        }
      : null,
  }
}

// ───────────────────────── 自检 ─────────────────────────

function selfTest() {
  let cases = 0
  const assert = (ok, message) => {
    cases += 1
    if (!ok) throw new Error(`self-test 失败:${message}`)
  }
  const policy = loadPolicy(readFileSync(POLICY_PATH, 'utf8'))
  const max = policy.scales.levelMax
  const now = Date.parse('2026-11-01T12:00:00.000Z')
  const ctx = { policy, ledger: [], now, lastActivityAt: new Map() }

  // S1 因子键集与策略逐键对上(多一个少一个都是形状坏)
  const mine = Object.keys(evaluateTicket({ line: 1, text: '空票面占位' }, ctx).evidence).sort()
  const want = Object.values(FACTOR_KEYS).flat().sort()
  assert(mine.length === want.length && mine.every((k, i) => k === want[i]), `因子键集必须恰为 ${want.join('/')},现为 ${mine.join('/')}`)

  // S2 影响面:按命中枚数分档
  assert(factorImpact('无关键词的一句话', max).level === 0, '零命中应为 0 档')
  assert(factorImpact('部署', max).level === 1, '命中 1 词应为 1 档')
  assert(factorImpact('部署 守门 判据 凭据', max).level === 3, '≥3 词应封顶 3 档')
  assert(factorImpact('部署', max).evidence.includes('部署'), 'evidence 必须点名命中的词')

  // S3 用户价值:落点面数
  assert(factorUserValue('改 apps/web/src/app/page.tsx', max).level === 2, '单个用户面应 2 档')
  assert(factorUserValue('改 apps/web 与 apps/mobile 两端', max).level === 3, '两个用户面应 3 档')
  assert(factorUserValue('改 apps/api/src/db/schema.ts', max).level === 1, '只点名 api 非路由文件应 1 档')
  assert(factorUserValue('改 scripts/plan-tasks.mjs', max).level === 0, '无用户面应 0 档')
  assert(factorUserValue('GET /api/app-version/latest 返 404', max).level === 2, '路由字面也算用户面')

  // S4 不可逆:族计数封顶 2,显式表述才顶 3
  assert(factorIrreversible('做一次数据迁移', max).level === 1, '单族应 1 档')
  assert(factorIrreversible('迁移并删除旧表,再轮换口令', max).level === 2, '多族封顶 2 档')
  assert(factorIrreversible('物理删除历史数据', max).level === 3, '显式不可逆表述应顶 3 档')

  // S5 外部依赖:按族计数
  assert(factorExternal('等机主拍板', max).level === 1, '单族应 1 档')
  assert(factorExternal('机主审批后去第三方控制台配域名', max).level === 3, '三族应 3 档')
  assert(factorExternal('改本地脚本', max).level === 0, '无外部依赖应 0 档')

  // S6 触碰铁律:点名规则文件才 3 档
  assert(factorRuleTouch('补 AGENTS.md 的判据段', max).level === 3, '点名 AGENTS.md 应 3 档')
  assert(factorRuleTouch('修 scripts/check-plan-fields.mjs 的判据', max).level === 3, '点名守门脚本应 3 档')
  assert(factorRuleTouch('按守门判据补一段说明', max).level === 2, '只提守门/判据应 2 档')
  assert(factorRuleTouch('照规则补注释', max).level === 1, '只提规则应 1 档')

  // S7 改动面:路径条数分档
  assert(pathsOf('改 apps/web/a.tsx 一处').length === 1, '应只认出 1 条路径')
  assert(factorChangeSurface('改 apps/web/a.tsx', max).level === 1, '1 条应 1 档')
  assert(factorChangeSurface('改 apps/web/a.tsx 与 scripts/b.mjs', max).level === 2, '2 条应 2 档')
  assert(factorChangeSurface('a.mjs b.ts c.json d.sql 四处', max).level === 3, '≥4 条应 3 档')

  // S8 验证时长:模型口径是分钟,不是 0-3
  const ref = policy.scales.verifyMinutesRef
  assert(factorVerifyMinutes('补 scripts/tests/x.test.mjs', policy).minutes === Math.round(ref / 4), '点名测试文件应最便宜')
  assert(factorVerifyMinutes('跑自检后再报', policy).minutes === Math.round(ref / 2), '只提验收手段应中档')
  assert(factorVerifyMinutes('改一句文案', policy).minutes === ref, '无验收面应按参照满额')

  // S9 租约:字段写剩余小时(模型方向),牌龄进 evidence;无牌 = null
  assert(factorLease('普通票面', 'k', ctx).hours === null, '无牌必须给 null,不写 0 小时')
  const aged = { ...ctx, lastActivityAt: new Map([['k', now - 100 * 3_600_000]]) }
  const agedOut = factorLease('普通票面', 'k', aged)
  assert(agedOut.hours === 0 && agedOut.evidence.includes('100.0h'), '超参照牌龄剩余应为 0,且 evidence 点名牌龄')
  const fresh = { ...ctx, lastActivityAt: new Map([['k', now - 2 * 3_600_000]]) }
  assert(factorLease('普通票面', 'k', fresh).hours === policy.scales.leaseHoursRef - 2, '新牌剩余 = 参照 - 牌龄')

  // S10 阻塞他人
  assert(factorBlocking('这张票挡住另外两张', max).level === 3, '点名阻塞他人应 3 档')
  assert(factorBlocking('存在阻塞', max).level === 2, '只说阻塞应 2 档')
  assert(factorBlocking('在等上游未落地', max).level === 1, '只提到被阻塞应 1 档')

  // S11 票键与决策器契约:产出必须过 validateCandidates,且 id 能接回派单面行
  const rows = [
    { line: 11, text: '**改 apps/web/src/app/page.tsx 文案** 顺手补测试 scripts/tests/x.test.mjs' },
    { line: 12, text: '**改 AGENTS.md 的判据段** 并动 scripts/check-plan-fields.mjs' },
  ]
  const built = buildCandidates({ rows, policy, ledger: [], now })
  assert(built.candidates.length === 2, '两行应出两枚候选')
  assert(built.candidates[0].id === ticketKeyOf(rows[0].text), 'id 必须等于 ticketKeyOf(票面)')
  const normalized = validateCandidates(built.candidates, policy)
  assert(normalized.length === 2, '产出必须过决策器形状锁')

  // S12 端到端:rankTicketRows 必须能消费本文件内容(真消费者,不是自证)
  const doc = buildDocument({ candidates: built.candidates, generatedAt: built.generatedAt, policy, rowCount: rows.length })
  const ranked = rankTicketRows(rows, { policyText: readFileSync(POLICY_PATH, 'utf8'), candidatesText: JSON.stringify(doc) })
  assert(ranked.mode === 'decision', `rankTicketRows 应进入 decision 模式,现为 ${ranked.mode}`)
  assert(ranked.ranked.length >= 1 && typeof ranked.ranked[0].decision.score === 'number', '应至少排出一枚并带分数')
  assert(ranked.skipped.some((s) => s.line === 12), '改判据的票应被压后并逐条点名')

  // S13 确定性:同一输入两次产出逐字相同(排期可复核的前提)
  const again = buildCandidates({ rows, policy, ledger: [], now })
  assert(JSON.stringify(again.candidates) === JSON.stringify(built.candidates), '同一输入两次产出必须逐字相同')

  // S14 重复票键只留一枚(决策器遇重复 id 会整轮判形状坏)
  const dup = buildCandidates({ rows: [rows[0], { line: 99, text: rows[0].text }], policy, ledger: [], now })
  assert(dup.candidates.length === 1 && dup.duplicates.length === 1, '同票键重复行应只留一条并点名')

  // S15 策略形状坏必须抛(调用方据此 exit 2)
  let threw = null
  try {
    loadPolicy('{"version":1}')
  } catch (e) {
    threw = e
  }
  assert(threw !== null && /dimensions/.test(threw.message), '缺维度的策略必须判形状坏')

  // S16 封禁事实照评但不改分,只在 notes 里点名
  const q = buildCandidates({
    rows: [rows[0]],
    policy,
    ledger: [{ ticketKey: ticketKeyOf(rows[0].text), action: 'quarantined', until: '2026-11-02T00:00:00.000Z' }],
    now,
  })
  assert(q.candidates[0].notes.length === 1 && q.candidates[0].notes[0].includes('封禁'), '封禁票应带 notes 点名')

  // S17 票面截断 ⇒ 风险三因子抬到保守下限(治"风险读 0 把高风险票排前面"这一失效方向错误)
  const longRaw = 'X-77 票面'.padEnd(200, '填')
  const shortText = 'X-77 票面'
  const planLines17 = [null, null, null, null, longRaw]
  assert(isTicketTruncated({ line: 5, text: shortText }, { planLines: planLines17 }) === true, '原文明显更长必须判截断')
  const truncBuilt = buildCandidates({ rows: [{ line: 5, text: shortText }], policy, ledger: [], now, planLines: planLines17 })
  const tc = truncBuilt.candidates[0]
  assert(tc.risk.irreversible >= 1 && tc.risk.externalDependency >= 1 && tc.risk.ruleTouch >= 1, '截断时风险三因子不得读 0')
  assert(/截断/.test(tc.evidence.irreversible), '截断必须在 evidence 里说清,不静默抬值')
  // 反向锁:原文等长 ⇒ 不抬。否则"所有票一律加风险"会把整面压后,等于另一种失效。
  const notTrunc = buildCandidates({ rows: [{ line: 2, text: 'X-78 完整票面' }], policy, ledger: [], now, planLines: [null, 'X-78 完整票面'] })
  assert(notTrunc.candidates[0].risk.irreversible === 0, '未截断且无风险词时必须读 0')
  // 取不到原文 ⇒ 按截断处理(fail-safe:不猜"没截断")
  assert(isTicketTruncated({ line: 5, text: shortText }, { planLines: null }) === true, '取不到原文必须按截断处理')

  console.log(`self-test: 全绿(${cases} 组断言)`)
}

// ───────────────────────── 入口 ─────────────────────────

function undetermined(message) {
  console.error(`❌ 未判定:${message} ⇒ 不写文件、不猜绿(exit 2)`)
  process.exitCode = 2
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const apply = argv.includes('--apply')
  const asJson = argv.includes('--json')

  let policy
  try {
    policy = loadPolicy(readFileSync(POLICY_PATH, 'utf8'))
  } catch (e) {
    return undetermined(`策略读不到或形状坏(${POLICY_PATH}):${e?.message ?? e}`)
  }

  let rows
  try {
    rows = pickFace()
  } catch (e) {
    return undetermined(e?.message ?? e)
  }

  const ledger = readLedger()
  const built = buildCandidates({ rows, policy, ledger, planLines: readPlanLines() })
  const doc = buildDocument({ candidates: built.candidates, generatedAt: built.generatedAt, policy, rowCount: rows.length })

  // 空面:合法事实,但空候选文件会让决策器判"候选为空 ⇒ 未判定",故不落盘(保留上一轮文件)。
  if (rows.length === 0) {
    const empty = toJsonDoc({ doc, decision: null, mode: apply ? 'apply' : 'preview', written: false, duplicates: built.duplicates })
    if (asJson) console.log(JSON.stringify(empty, null, 2))
    else console.log(`派单面现读 0 行 ⇒ 无票可评,不写 ${CANDIDATES_PATH}(空候选会被决策器判未判定,不冒充已评估)`)
    return
  }

  // 写盘前先过决策器自己的形状锁 + 排一遍:产出不合法就不写(§0.3 不猜绿)
  let decision
  try {
    validateCandidates(doc.candidates, policy)
    decision = decide({ policy, candidates: doc.candidates })
  } catch (e) {
    return undetermined(`本器产出的候选过不了决策器形状锁(${e?.message ?? e})`)
  }

  let written = false
  if (apply) {
    mkdirSync(dirname(CANDIDATES_PATH), { recursive: true })
    writeFileSync(CANDIDATES_PATH, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
    written = true
  }

  if (asJson) {
    console.log(JSON.stringify(toJsonDoc({ doc, decision, mode: apply ? 'apply' : 'preview', written, duplicates: built.duplicates }), null, 2))
    return
  }
  console.log(renderPreview(doc, decision, { written }))
  if (written) console.log(`\n✅ 已写入 ${CANDIDATES_PATH}(${doc.candidates.length} 枚候选)`)
  else console.log('\nℹ 预览模式未写盘;确认无误后加 --apply 落盘')
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    main(process.argv.slice(2))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  CANDIDATES_PATH,
  SCHEMA_VERSION,
  IMPACT_TERMS,
  pathsOf,
  factorImpact,
  factorUserValue,
  factorIrreversible,
  factorExternal,
  factorRuleTouch,
  factorChangeSurface,
  factorVerifyMinutes,
  factorLease,
  factorBlocking,
  evaluateTicket,
  activityMapOf,
  buildCandidates,
  buildDocument,
  renderPreview,
  toJsonDoc,
  pickFace,
  readLedger,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
