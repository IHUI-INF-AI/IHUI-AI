// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 86D「证据流水的保留策略与墓碑」— 审计证据链表(audit_logs_chain)的保留期清理任务。
// B04(2026-10-27):同文件加挂 ledger 档 —— tool_invocation_ledger 原文 30 天清除
// (O5 purgeExpiredLlmCallLogRawText 同族;dry-run/apply env 闸/规模闸/永不删行
// 逐字照抄本文件纪律;落位理由见「ledger 档」节头注)。
//
// 用户已拍板(2026-09-27)的两级口径:
//  - 结构行保留 180 天;入参/出参原文保留 0 天。
//  语义沿用仓内既有档 `llm_call_logs` 原文留存治理(audit-log-service.ts O5 段,
//  约 :577-:658):到期只清原文字段、置 rawRetained=false / rawPurgedAt,**整行保留**
//  (设 0 即"到期后不留原文")。
//
// ── 墓碑方案(先读清哈希输入集再选路,任务书要求)──────────────────────────────
// `current_hash = HMAC-SHA256(secret, canonicalJSON([prev_hash, timestamp, user_id,
//   action, resource_type, resource_id, result, metadata]))`
// (computeAuditHash,audit-log-service.ts :131-:154 —— **metadata 在哈希输入集内**;
//  ip / user_agent 两列不在。)
//
// 由此两条路的取舍被源码锁死:
//  ① "擦 metadata 原文但 current_hash 不动" —— 不可行:verifyAuditLogIntegrity(:394-:440)
//     的第 2 项检查会对**擦除后的 metadata** 重算哈希,与存量 current_hash 必不匹配,
//     合规清理会被判成 "current_hash 不匹配" 的篡改 ⇒ 清理与篡改不可分辨,正是本票禁止的形态。
//  ② 采用:按链的既有做法把该行**重哈希并留下前后锚点** —— 擦除原文后重算本行
//     current_hash,并把其后所有行的 prev_hash/current_hash 顺次重算(否则下一条行的
//     链式关系立即断裂);墓碑里写下擦除前的 current_hash(`prevCurrentHash`,前锚点),
//     擦后哈希即"后锚点"(存于 current_hash 列)。整个重算在一个事务内完成,并持有与
//     唯一写入器 recordAuditLog **同一把** `pg_advisory_xact_lock('audit_log_chain')`,
//     与在线写入串行,链对外从不存在半改写状态。
//
// ── 180 天整行删除:本票否证,不做(需要改链校验语义,另计一票)──────────────────
// 证据链(现读 audit-log-service.ts):
//  1. verifyAuditLogIntegrity :401-:414 对相邻行做 `log.prevHash !== expectedPrev` 判定,
//     **没有任何"合法空洞"概念**,也没有行数/段锚点台账;
//  2. 删除第 i 行 ⇒ 第 i+1 行 prev_hash 与第 i 行 current_hash 不再相接 ⇒ 判 "prev_hash 链断裂";
//     即"被合规删除"与"被人删了"在读端完全同形,违背本票立论(墓碑可分辨);
//  3. 若想删得安全,必须让 verifier 能核对"少了几行、少的是哪些"(段封缄 / 计数锚点 /
//     删除登记账),那是**改链校验语义**的独立工程,不在"沿用既有语义"的本票范围;
//  4. 仓内唯一既有归档器 apps/api/src/utils/audit-archive.ts 只服务非链式表 `audit_logs`
//     (其 :84-:98 读/删的都是 auditLogs),对 audit_logs_chain 零覆盖,不存在可复用的
//     链式表删行出口。
// 故本任务对 180 天档**只现读报数**(structExpiredRows),不产生任何 DELETE;
// `grep 'DELETE FROM audit_logs_chain' 在本文件应为 0 处` 由镜像测试反向钉住。
//
// ── 规模闸(删除类操作红线,参照 check-watermark-coverage ">200 拒绝自动回写")──────
// apply 档下,原文到期候选行数 > AUDIT_EVIDENCE_MAX_PURGE(默认 200)即**整轮拒跑**并
// 打印实数 —— 首次上线积压可能是全链,必须人看一眼数、确认后再分批放行,不许静默大改写。
//
// ── 默认形态 ────────────────────────────────────────────────────────────────
// 默认 dry-run(零写入);真正执行需显式 apply:true。调度器每天 04:45 先跑 dry-run 报数;
// 只有 `AUDIT_EVIDENCE_RETENTION_APPLY=true` 才在调度中携带 apply(改写哈希属高危,
// 先核对 dry-run 数字再开)。env 口径照抄 pii-retention-cleanup 的 retentionOf 风格,
// 不新造第二套配置法。
//
// 测试隔离(§5 铁律):判据可在不触库下全量验(planEvidenceRechain /
// auditEvidenceIntegrityReport 均为纯函数);runAuditEvidenceRetention 的 db 走注入,
// 单测喂内存行,绝不连 8810/8811。

import cron, { type ScheduledTask } from 'node-cron'
import { sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'
import {
  computeAuditHash,
  recordAuditLog,
  verifyAuditLogIntegrity,
  DEFAULT_RAW_RETENTION_DAYS,
  type IntegrityVerificationResult,
  type RecordAuditLogParams,
} from '../services/audit-log-service.js'
// B04 ledger 档:原文留存天数的 env 键名唯一真相在写侧 service(此处引用不重抄字面量)。
import { TOOL_LEDGER_RAW_RETENTION_ENV } from '../services/tool-invocation-ledger-service.js'
// 86G-2:结构行保留天数是"验签公钥登记表判轮换期"的同一份策略 ⇒ 变量名与默认值只允许有一处
// 真相(此前本文件硬编码 180 + 变量名字面量,登记表只能"声称同源"而无法被机器核对)。
import {
  AUDIT_ENVELOPE_RETENTION_DAYS_DEFAULT,
  ENVELOPE_RETENTION_ENV,
} from '../services/audit-export-key-registry.js'
import type { AuditLogChainRow } from '../db/audit-queries.js'

// =============================================================================
// 保留策略(env 解析)
// =============================================================================

/** 表名只出现在这一处,SQL 全部走 sql.raw 引用它,防手滑写错表。 */
const CHAIN_TABLE = sql.raw('audit_logs_chain')

/**
 * 审计证据链 metadata 里承载"入参/出参原文"的字段族(2026-09-28 现读 producers):
 * - `body`  —— 站内改造前的请求体原文(plugins/audit-logger.ts 注释"不再写 body",
 *   但**历史行仍在**,这正是 0 天档要治理的存量);
 * - `params` —— 站内(/api)请求参数:先过 sanitizeData 脱敏,但 rawValues=true 时
 *   保留脱敏后的原值(开放面才是纯形状摘要);
 * - `query` —— URL query 摘要,站内同 params 带原值。
 * 新链式写入器 86A(tool.invoke)刻意不落 args 原文(audit-log-service.ts :249-:251),
 * 其 metadata 没有这三族键 ⇒ 天然不是候选。不得在本文件之外再抄一份字段名单。
 */
export const RAW_EVIDENCE_METADATA_FIELDS = ['body', 'params', 'query'] as const

/** 生效的审计证据保留策略(已由 env 解析、钳制)。 */
export interface AuditEvidencePolicy {
  /** 原文保留天数(>=0;0 = 到期即清,与拍板口径一致)。 */
  rawDays: number
  /** 结构行保留天数(本票只报数不删,见文件头否证)。 */
  structDays: number
  /** 单轮最多清除的候选行数(分批上限)。 */
  batch: number
  /** 规模闸:候选总数超过该值即整轮拒跑。 */
  maxPurge: number
}

/** 解析一个非负整数 env 值;非法/缺失回落 fallback(同 audit-log-service 的钳制口径, 0 合法)。 */
function parseNonNegativeInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.floor(n)
}

/** 从环境变量解析保留策略(纯函数;口径照抄 pii-retention-cleanup.ts retentionOf 的 env 形态)。 */
export function resolveAuditEvidencePolicy(
  env: NodeJS.ProcessEnv = process.env,
): AuditEvidencePolicy {
  return {
    rawDays: parseNonNegativeInt(env.AUDIT_EVIDENCE_RAW_RETENTION_DAYS, 0),
    structDays: parseNonNegativeInt(
      env[ENVELOPE_RETENTION_ENV],
      AUDIT_ENVELOPE_RETENTION_DAYS_DEFAULT,
    ),
    batch: parseNonNegativeInt(env.AUDIT_EVIDENCE_PURGE_BATCH, 50),
    maxPurge: parseNonNegativeInt(env.AUDIT_EVIDENCE_MAX_PURGE, 200),
  }
}

// =============================================================================
// 墓碑(tombstone)结构与判定
// =============================================================================

/** 落在 metadata.purge 的合规清理墓碑。`prevCurrentHash` 是"前锚点"(擦除前的 current_hash)。 */
export interface EvidencePurgeTombstone {
  purged: true
  purgedAt: string
  reason: string
  removedFields: string[]
  prevCurrentHash: string
}

/** metadata 里现存的原文字段键(键存在即算,值不论形状)。 */
export function collectRawEvidenceKeys(
  metadata: Record<string, unknown> | null | undefined,
): string[] {
  if (!metadata || typeof metadata !== 'object') return []
  return RAW_EVIDENCE_METADATA_FIELDS.filter((k) =>
    Object.prototype.hasOwnProperty.call(metadata, k),
  )
}

/** 构造擦除后的 metadata:剥掉原文三族键,写 rawRetained=false / rawPurgedAt / purge 墓碑。 */
export function buildPurgedEvidenceMetadata(
  metadata: Record<string, unknown> | null | undefined,
  opts: {
    purgedAt: string
    reason: string
    removedFields: string[]
    prevCurrentHash: string
  },
): Record<string, unknown> {
  const src = metadata && typeof metadata === 'object' ? metadata : {}
  const rest: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(src)) {
    if ((RAW_EVIDENCE_METADATA_FIELDS as readonly string[]).includes(k)) continue
    rest[k] = v
  }
  const purge: EvidencePurgeTombstone = {
    purged: true,
    purgedAt: opts.purgedAt,
    reason: opts.reason,
    removedFields: [...opts.removedFields],
    prevCurrentHash: opts.prevCurrentHash,
  }
  // rawRetained / rawPurgedAt 沿用 llm_call_logs 档的既有语义键名(拍板要求"沿用仓内既有语义")。
  return { ...rest, rawRetained: false, rawPurgedAt: opts.purgedAt, purge }
}

/**
 * 合规清理墓碑的形状判定。**刻意不把"有标记"当充分条件** ——
 * 它只回答"这一行的形态是一次登记过的清理";行内容是否真没被事后改动,
 * 由 verifyAuditLogIntegrity 的哈希重算那一条独立回答(见 auditEvidenceIntegrityReport
 * 的结论优先级:valid=false 永远压过墓碑 ⇒ 伪造墓碑不能洗白篡改)。
 */
export function isCompliantEvidenceTombstone(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  if (!metadata || typeof metadata !== 'object') return false
  if (metadata['rawRetained'] !== false) return false
  if (typeof metadata['rawPurgedAt'] !== 'string' || metadata['rawPurgedAt'] === '') return false
  if (collectRawEvidenceKeys(metadata).length > 0) return false
  const purge = metadata['purge']
  if (!purge || typeof purge !== 'object') return false
  const p = purge as Record<string, unknown>
  if (p['purged'] !== true) return false
  if (typeof p['purgedAt'] !== 'string' || p['purgedAt'] === '') return false
  if (typeof p['reason'] !== 'string' || p['reason'] === '') return false
  if (!Array.isArray(p['removedFields']) || p['removedFields'].length === 0) return false
  if (typeof p['prevCurrentHash'] !== 'string' || !/^[0-9a-f]{64}$/.test(p['prevCurrentHash']))
    return false
  return true
}

// =============================================================================
// 重哈希 + 前向重算链(纯函数,零 DB)
// =============================================================================

/** 计划/落库共用的链行(与 AuditLogChainRow 同形,单测直接喂内存行)。 */
export type EvidenceChainRow = AuditLogChainRow

/** 单行改写:prev/current 哈希必写;metadata 仅在被擦除行携带(JSON 串,交 ::jsonb)。 */
export interface EvidenceRechainUpdate {
  id: string
  prevHash: string
  currentHash: string
  metadataJson?: string
  /** 本行是否为一次原文清理(携带墓碑) */
  purged: boolean
}

/** planEvidenceRechain 的结论:要么给出改写集,要么给出拒跑原因(两者互斥)。 */
export interface EvidenceRechainPlan {
  blockedReason?: string
  updates: EvidenceRechainUpdate[]
  purgedCount: number
}

/** 把行字段投影成 computeAuditHash 的输入形状(哈希输入集与写入器逐字同形,不得增删列)。 */
function hashInputOf(row: EvidenceChainRow, metadata: Record<string, unknown> | null) {
  return {
    timestamp: row.timestamp,
    userId: row.userId,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    result: row.result,
    metadata,
  }
}

/**
 * 核心规划器(纯函数):输入按 (timestamp, id) 升序、从**首个待清理行**起直至链尾的连续切片,
 * 输出"清理 + 前向重算"所需的最小改写集。
 *
 * 安全性质(全部由单测钉死):
 *  - 切片内相邻行 prev 连续性若不成立 ⇒ 判定"本轮开始前链已断/已被篡改",**拒跑不改写**
 *    —— 本函数绝不顺手把别人的断裂点重链"修好"(那等于洗掉篡改现场);
 *  - 首行的 prevHash 原样保留(它之前的链不在本轮射程,也不去验证它);
 *  - 已带墓碑的行不在 purgeIds 里 ⇒ 其内容不变,只在被前驱改写时顺移哈希(改写仍只动哈希列);
 *  - 输出不含任何 DELETE —— 行永不删除(180 天档另计票)。
 */
export function planEvidenceRechain(
  rows: EvidenceChainRow[],
  opts: { purgeIds: ReadonlySet<string>; purgedAt: string; reason: string },
): EvidenceRechainPlan {
  const updates: EvidenceRechainUpdate[] = []
  let purgedCount = 0
  // 两条"前驱哈希"必须分开走:
  //  - origPrevExpect = 前驱行的**原存** current_hash —— 只用来核验"本轮开始前链是完好的";
  //  - carryPrev     = 前驱行的**新** current_hash —— 作为本行重算的 prev_hash 输入。
  // 拿 carryPrev 去核验原始链,会把"刚清理过的上一行"判成断链(第一刀即死,恒阻断)。
  let origPrevExpect: string | null = null
  let carryPrev: string | null = null

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as EvidenceChainRow
    const storedPrev = row.prevHash
    if (i === 0) {
      // 切片首行:保留其入链关系,不重算 prev。下一行应接上"本行的原存 current_hash"。
      origPrevExpect = row.currentHash
      carryPrev = storedPrev
    } else {
      if (storedPrev !== origPrevExpect) {
        return {
          blockedReason: `第 ${i} 行(${row.id})prev_hash 与前行不接:本轮开始前链已断或被篡改,拒绝重链洗现场`,
          updates: [],
          purgedCount: 0,
        }
      }
      origPrevExpect = row.currentHash // 下一行应接上"本行的原存哈希"(核验用),而非新算值
    }

    let metadata = row.metadata
    let purged = false
    if (opts.purgeIds.has(row.id)) {
      const removedFields = collectRawEvidenceKeys(row.metadata)
      if (removedFields.length === 0) {
        // 候选已被别轮清过(SQL 谓词与本判据间的竞态窗口)—— 不重复擦、不伪造墓碑。
        metadata = row.metadata
      } else {
        metadata = buildPurgedEvidenceMetadata(row.metadata, {
          purgedAt: opts.purgedAt,
          reason: opts.reason,
          removedFields,
          prevCurrentHash: row.currentHash,
        })
        purged = true
        purgedCount += 1
      }
    }

    const newPrev = carryPrev as string
    const newHash = computeAuditHash(newPrev, hashInputOf(row, metadata ?? null))
    if (newPrev !== storedPrev || newHash !== row.currentHash) {
      updates.push({
        id: row.id,
        prevHash: newPrev,
        currentHash: newHash,
        metadataJson: purged ? JSON.stringify(metadata) : undefined,
        purged,
      })
    }
    carryPrev = newHash
  }

  return { updates, purgedCount }
}

// =============================================================================
// 可分辨性报告:三种面必须给三种结论(本票核心判据 3)
// =============================================================================

/** 链的合规性三态结论:intact(原封) / compliant-purged(有登记过的清理) / tampered(篡改或删行)。 */
export type AuditEvidenceConclusion = 'intact' | 'compliant-purged' | 'tampered'

export interface AuditEvidenceIntegrityReport extends IntegrityVerificationResult {
  /** 带合规墓碑的行数(形状判定)。 */
  tombstonedRows: number
  /** 仍携原文的行数(到期即应是清理候选)。 */
  rawRetainedRows: number
  conclusion: AuditEvidenceConclusion
}

/**
 * 把"哈希校验结论"与"墓碑形状统计"合成一个可分辨结论。
 * **优先级是判据的一部分**:valid=false 一律判 tampered —— 篡改者即使补上像模像样的
 * 墓碑字段,只要没有(且不可能有,除非持有 HMAC secret)一致的链哈希,结论就是红色。
 */
export function auditEvidenceIntegrityReport(
  logs: AuditLogChainRow[],
): AuditEvidenceIntegrityReport {
  const verify = verifyAuditLogIntegrity(logs)
  const tombstonedRows = logs.filter((r) => isCompliantEvidenceTombstone(r.metadata)).length
  const rawRetainedRows = logs.filter((r) => collectRawEvidenceKeys(r.metadata).length > 0).length
  const conclusion: AuditEvidenceConclusion = !verify.valid
    ? 'tampered'
    : tombstonedRows > 0
      ? 'compliant-purged'
      : 'intact'
  return { ...verify, tombstonedRows, rawRetainedRows, conclusion }
}

/** 把规划结果回填进内存链(纯函数;单测与 dry-run 报告共用"改后长什么样"的尺子)。 */
export function applyEvidenceUpdatesToRows(
  rows: EvidenceChainRow[],
  updates: EvidenceRechainUpdate[],
): EvidenceChainRow[] {
  const byId = new Map(updates.map((u) => [u.id, u]))
  return rows.map((r) => {
    const u = byId.get(r.id)
    if (!u) return r
    return {
      ...r,
      prevHash: u.prevHash,
      currentHash: u.currentHash,
      metadata:
        u.metadataJson !== undefined
          ? (JSON.parse(u.metadataJson) as Record<string, unknown>)
          : r.metadata,
    }
  })
}

// =============================================================================
// 执行器(db 走注入;SQL 形态由镜像测试钉)
// =============================================================================

/** 运行结果。status 六态,拒跑/阻断都带实数与原因,不静默。 */
export interface AuditEvidenceRetentionResult {
  mode: 'dry-run' | 'apply'
  policy: AuditEvidencePolicy
  /** 结构行超期数(180 天档,只报数)。 */
  structExpiredRows: number
  /** 原文到期候选总数(规模闸的输入)。 */
  rawCandidates: number
  /** 本轮(将)清理的行数。 */
  rawPurged: number
  /** 本轮(将)改写哈希的行数(= 清理行 + 其后全部前向重算行)。 */
  rechainUpdates: number
  status: 'ok' | 'no-candidates' | 'refused-mass' | 'blocked-chain-broken' | 'error'
  reason?: string
}

/** 事务句柄的最小投影(drizzle tx 结构兼容;单测喂假实现)。 */
export interface EvidenceTx {
  execute(query: SQL): Promise<unknown>
}

/** 可注入出口:默认全部走真 db / recordAuditLog;单测一律注入,零真实库(§5 铁律)。 */
export interface AuditEvidenceRetentionDeps {
  transaction: <T>(fn: (tx: EvidenceTx) => Promise<T>) => Promise<T>
  auditWrite?: (params: RecordAuditLogParams) => Promise<string | undefined>
}

const DEFAULT_DEPS: AuditEvidenceRetentionDeps = {
  transaction: (fn) => db.transaction(fn),
  auditWrite: recordAuditLog,
}

function toRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[]
  if (raw && typeof raw === 'object' && Array.isArray((raw as { rows?: unknown }).rows)) {
    return (raw as { rows: Record<string, unknown>[] }).rows
  }
  return []
}

function isoOf(v: unknown): string {
  return v instanceof Date ? v.toISOString() : String(v ?? '')
}

function nullableStr(v: unknown): string | null {
  return v === null || v === undefined ? null : String(v)
}

function mapEvidenceRow(r: Record<string, unknown>): EvidenceChainRow {
  const meta = r['metadata']
  return {
    id: String(r['id']),
    timestamp: isoOf(r['timestamp']),
    userId: nullableStr(r['user_id']),
    action: String(r['action']),
    resourceType: nullableStr(r['resource_type']),
    resourceId: nullableStr(r['resource_id']),
    ip: nullableStr(r['ip']),
    userAgent: nullableStr(r['user_agent']),
    result: nullableStr(r['result']),
    metadata: meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : null,
    prevHash: String(r['prev_hash']),
    currentHash: String(r['current_hash']),
  }
}

/**
 * 原文仍留存的 SQL 谓词 —— 与 collectRawEvidenceKeys 逐字同集(两半各写一遍必漂移)。
 *
 * G-790 登记(**待迁移**,本票不建列):`audit_logs_chain` 只有 `metadata` 一份载体,
 * 没有 `raw_retained` 那样的独立判别列(`llm_call_logs` 有,见
 * `services/audit-log-service.ts` 里 `eq(llmCallLogs.rawRetained, true)` 那一处 —— 那里是
 * "判别列进谓词"的正例)。所以本谓词目前只能按 JSON 内容判:今天写 `rawRetained` 键的
 * 唯一去处是本任务的擦除器,新增别的写入者时这一条不会替我们拦住无关行。
 * 收口 = 给 `audit_logs_chain` 加 boolean 判别列并回填,属迁移票(严格规程),不在本票范围。
 * 清单见 `apps/api/src/routes/__tests__/README-g790-json-filter-inventory.md`。
 */
function rawHeldCond(): SQL {
  // G-790 A5(2026-10-18):"原文是否仍在表内"改走判别列。旧形态
  //   COALESCE(metadata->>'rawRetained','true') <> 'false'
  // 的正确性依赖"只有本 job 的擦除步骤写这个键"这一巧合;同表 user_agent/result 已在哈希输入之外,
  // 证明确定性:computeHash 只吃 prev_hash + AuditEntry 字段(utils/audit-chain.ts:51)。
  // 第一与第三子句刻意留着:`jsonb_typeof` 是 `?` 运算符的前提,而"三个原文键还在不在"
  // 问的是**内容存在性**,不是按内容判类别 —— 那一维没有列可走,硬造一个就是把没坏的改坏。
  return sql`jsonb_typeof(metadata) = 'object'
    AND ${CHAIN_TABLE}.raw_retained
    AND (${CHAIN_TABLE}.metadata ? 'body' OR ${CHAIN_TABLE}.metadata ? 'params' OR ${CHAIN_TABLE}.metadata ? 'query')`
}

function expiredCond(days: number): SQL {
  return sql`${CHAIN_TABLE}.timestamp < now() - ${days}::int * interval '1 day'`
}

/**
 * 单轮保留清理(dry-run 默认)。事务序列:
 * advisory lock(与 recordAuditLog 同键)→ 报数(结构超期 / 原文候选)→ 规模闸 →
 * 取首批候选 (id,timestamp) → 从首个候选读到链尾(FOR UPDATE 仅 apply)→ 纯函数规划 →
 * 逐行 UPDATE(只 UPDATE,永不 DELETE)。
 */
export async function runAuditEvidenceRetention(
  opts: {
    apply?: boolean
    policy?: AuditEvidencePolicy
    env?: NodeJS.ProcessEnv
    deps?: AuditEvidenceRetentionDeps
  } = {},
): Promise<AuditEvidenceRetentionResult> {
  const apply = opts.apply === true
  const mode: 'dry-run' | 'apply' = apply ? 'apply' : 'dry-run'
  const policy = opts.policy ?? resolveAuditEvidencePolicy(opts.env ?? process.env)
  const deps = opts.deps ?? DEFAULT_DEPS
  const zero: AuditEvidenceRetentionResult = {
    mode,
    policy,
    structExpiredRows: 0,
    rawCandidates: 0,
    rawPurged: 0,
    rechainUpdates: 0,
    status: 'ok',
  }

  try {
    const outcome = await deps.transaction(async (tx) => {
      // 与唯一写入器同一把锁:审计链写入与本任务全序,链不会在改写中途被追加而分叉。
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('audit_log_chain'))`)

      const structRaw = await tx.execute(sql`
        SELECT COUNT(*)::int AS cnt FROM ${CHAIN_TABLE} WHERE ${expiredCond(policy.structDays)}
      `)
      const structExpiredRows = Number(toRows(structRaw)[0]?.['cnt'] ?? 0)

      const candRaw = await tx.execute(sql`
        SELECT COUNT(*)::int AS cnt FROM ${CHAIN_TABLE}
        WHERE ${expiredCond(policy.rawDays)} AND ${rawHeldCond()}
      `)
      const rawCandidates = Number(toRows(candRaw)[0]?.['cnt'] ?? 0)

      if (rawCandidates === 0)
        return { kind: 'no-candidates' as const, structExpiredRows, rawCandidates }
      // 规模闸:积压超阈值 ⇒ 整轮拒跑并打印实数(首跑常是全链,必须人确认后再分批)。
      if (apply && rawCandidates > policy.maxPurge)
        return { kind: 'refused-mass' as const, structExpiredRows, rawCandidates }

      const targetRaw = await tx.execute(sql`
        SELECT id, timestamp FROM ${CHAIN_TABLE}
        WHERE ${expiredCond(policy.rawDays)} AND ${rawHeldCond()}
        ORDER BY timestamp ASC, id ASC
        LIMIT ${policy.batch}
      `)
      const targets = toRows(targetRaw).map((r) => ({
        id: String(r['id']),
        tsIso: isoOf(r['timestamp']),
      }))
      const first = targets[0]
      if (!first) return { kind: 'no-candidates' as const, structExpiredRows, rawCandidates }

      const sliceRaw = await tx.execute(sql`
        SELECT id, timestamp, user_id, action, resource_type, resource_id,
               ip, user_agent, result, metadata, prev_hash, current_hash
        FROM ${CHAIN_TABLE}
        WHERE timestamp >= ${new Date(first.tsIso)}
        ORDER BY timestamp ASC, id ASC
        ${apply ? sql`FOR UPDATE` : sql``}
      `)
      const slice = toRows(sliceRaw).map(mapEvidenceRow)

      const plan = planEvidenceRechain(slice, {
        purgeIds: new Set(targets.map((t) => t.id)),
        purgedAt: new Date().toISOString(),
        reason: `retention-${policy.rawDays}d`,
      })
      if (plan.blockedReason)
        return {
          kind: 'blocked-chain-broken' as const,
          structExpiredRows,
          rawCandidates,
          reason: plan.blockedReason,
        }

      if (apply) {
        for (const u of plan.updates) {
          // 永不 DELETE:结构行 180 天档在本票只报数(文件头否证);这里只 UPDATE。
          // 擦除原文的行**同批落判别列** raw_retained:只写 metadata 不写列 = 列与内容分叉,
          // 读面会一辈子把已清除的行当"原文仍在"候选(每次重扫、永不命中也永不报)。
          const purgeSet =
            u.metadataJson === undefined
              ? sql``
              : sql`, metadata = ${u.metadataJson}::jsonb, raw_retained = false`
          await tx.execute(sql`
            UPDATE ${CHAIN_TABLE}
               SET prev_hash = ${u.prevHash}, current_hash = ${u.currentHash}${purgeSet}
             WHERE id = ${u.id}::uuid
          `)
        }
      }
      return {
        kind: 'ok' as const,
        structExpiredRows,
        rawCandidates,
        rawPurged: plan.purgedCount,
        rechainUpdates: plan.updates.length,
      }
    })

    const result: AuditEvidenceRetentionResult = {
      ...zero,
      structExpiredRows: outcome.structExpiredRows,
      rawCandidates: outcome.rawCandidates,
      rawPurged: outcome.kind === 'ok' ? outcome.rawPurged : 0,
      rechainUpdates: outcome.kind === 'ok' ? outcome.rechainUpdates : 0,
      status: outcome.kind,
      reason: outcome.kind === 'blocked-chain-broken' ? outcome.reason : undefined,
    }

    if (result.status === 'refused-mass') {
      result.reason = `原文到期候选 ${result.rawCandidates} 行 > 单次上限 ${policy.maxPurge},整轮拒跑(实数已打印,分批放行后再开)`
      logger.warn(`[audit-evidence-retention] 拒跑:${result.reason}`)
      return result
    }
    if (result.status === 'blocked-chain-broken') {
      logger.warn(`[audit-evidence-retention] 阻断:${result.reason}`)
      return result
    }
    if (apply && result.status === 'ok' && result.rawPurged > 0) {
      // 自审:清理动作本身必须进链(经唯一写入器,不绕链)。放在事务提交后,
      // 新行接在本轮重算后的链尾,天然一致。
      await (deps.auditWrite ?? recordAuditLog)({
        action: 'audit.evidence.retention',
        resourceType: 'audit_logs_chain',
        result: 'success',
        metadata: {
          mode: 'apply',
          rawPurged: result.rawPurged,
          rechainUpdates: result.rechainUpdates,
          rawCandidates: result.rawCandidates,
          structExpiredRows: result.structExpiredRows,
          policy,
        },
      })
    }
    logger.info(
      `[audit-evidence-retention] ${mode}: 结构超期 ${result.structExpiredRows}(只报数,删行另计票)/ ` +
        `原文候选 ${result.rawCandidates} / 本轮清理 ${result.rawPurged} / 重算 ${result.rechainUpdates} 行 (status=${result.status})`,
    )
    return result
  } catch (e) {
    // 表未建 / 迁移未跑 / DB 异常:与 recordAuditLog 同口径降级告警,不打断调度。
    logger.warn('[audit-evidence-retention] failed (degraded)', { error: (e as Error).message })
    return { ...zero, status: 'error', reason: (e as Error).message }
  }
}

// =============================================================================
// B04 ledger 档 — tool_invocation_ledger 原文清除(O5 purgeExpiredLlmCallLogRawText 同族)
// =============================================================================
//
// 为什么落在本文件而非新文件(§0.6 单一真相源,读码后择一):
//  - 清除对象是账表自身的 raw_input / raw_output 两列(现读 schema :98-:103 与迁移
//    20261024020000 :58-:59 确认原文本体在表上;链行 metadata 只带摘要 digest 不带原文,
//    故与上方 86D 链档的重哈希机制**零重叠**,不需要也不得顺手重哈希);
//  - 机制形状 = O5(UPDATE 置空原文两列 + raw_retained=false + raw_purged_at=now(),
//    行级 raw_retention_days COALESCE 全局默认,永不 DELETE,幂等);
//    纪律形状 = 本文件 86D(每日调度先 dry-run 报数;env 显式 apply 闸才真清;
//    候选 > 规模闸整轮拒跑交人;测试注入 tx 喂内存行不触库)。新文件要把这套骨架
//    与 parseNonNegativeInt/toRows 再抄第二份,正是 §0.6 禁止的形态;
//  - 调度复用同一每日 04:45 面(下方回调两档顺序跑、各带各的 apply 开关),
//    不在 index.ts 新增第二张调度登记面。
//
// 保留策略(机主拍板 2026-10-23,代裁依据在迁移头注):
//  - 原文保留 30 天:全局默认 env TOOL_LEDGER_RAW_RETENTION_DAYS(键名 import 自写侧
//    service,兜底天数 import DEFAULT_RAW_RETENTION_DAYS —— 30 字面量不在此重写);
//    0 = 不留存原文;行级 raw_retention_days 覆盖全局默认(COALESCE 谓词,同 O5);
//  - 真清需显式 TOOL_LEDGER_RAW_PURGE_APPLY=true(照抄 AUDIT_EVIDENCE_RETENTION_APPLY
//    风格;仓内 .env.example 无留存开关注册先例 —— 86D/O5 的闸同样只落在注释,此处对齐);
//  - 到期候选 > TOOL_LEDGER_RAW_PURGE_MAX(默认 200,照抄 AUDIT_EVIDENCE_MAX_PURGE 档)
//    ⇒ apply 档整轮拒跑并打印实数,首批积压必须人看数确认后分批放行;
//  - **账行永不 DELETE**:只置空原文列,摘要/决策/结果档等全部留存;行级留痕即
//    raw_purged_at 列本身(O5 同形,不另起第二份审计面)。
//  - 0 天档边界同 O5 注:同事务刚插入的行(created_at = now())本轮不命中,下一轮清除。

/** 账表名只出现在这一处,SQL 全走 sql.raw 引用它(与 CHAIN_TABLE 同纪律)。 */
const LEDGER_TABLE = sql.raw('tool_invocation_ledger')

/** B04 ledger 档生效策略(已由 env 解析、钳制)。 */
export interface ToolLedgerRawPurgePolicy {
  /** 全局默认留存天数(>=0;行级 raw_retention_days 优先;0 = 不留存原文)。 */
  defaultDays: number
  /** 单轮最多清除的候选行数(分批上限)。 */
  batch: number
  /** 规模闸:到期候选总数超过该值即整轮拒跑。 */
  maxPurge: number
}

/** 从环境变量解析 ledger 档策略(纯函数;env 形态照抄本文件 resolveAuditEvidencePolicy)。 */
export function resolveToolLedgerRawPurgePolicy(
  env: NodeJS.ProcessEnv = process.env,
): ToolLedgerRawPurgePolicy {
  return {
    defaultDays: parseNonNegativeInt(
      env[TOOL_LEDGER_RAW_RETENTION_ENV],
      DEFAULT_RAW_RETENTION_DAYS,
    ),
    batch: parseNonNegativeInt(env.TOOL_LEDGER_RAW_PURGE_BATCH, 50),
    maxPurge: parseNonNegativeInt(env.TOOL_LEDGER_RAW_PURGE_MAX, 200),
  }
}

/** ledger 档运行结果。拒跑/降级都带实数与原因,不静默(86D 同型)。 */
export interface ToolLedgerRawPurgeResult {
  mode: 'dry-run' | 'apply'
  policy: ToolLedgerRawPurgePolicy
  /** 到期候选总数(规模闸的输入)。 */
  candidates: number
  /** 本轮(将)清除原文的行数。 */
  purged: number
  status: 'ok' | 'no-candidates' | 'refused-mass' | 'error'
  reason?: string
}

/** 可注入出口:默认走真 db;单测一律注入喂内存行,零真实库(§5 铁律,同 86D)。 */
export interface ToolLedgerRawPurgeDeps {
  transaction: <T>(fn: (tx: EvidenceTx) => Promise<T>) => Promise<T>
}

const LEDGER_DEFAULT_DEPS: ToolLedgerRawPurgeDeps = {
  transaction: (fn) => db.transaction(fn),
}

/**
 * 到期 + 原文仍在的谓词(单一判据,COUNT/取批/UPDATE 子查询三处共用,防漂移)。
 * 行级覆盖 > 全局默认的形状逐字沿用 O5:
 *   `created_at < now() - COALESCE(raw_retention_days, <defaultDays>)::int * interval '1 day'`
 */
function ledgerExpiredCond(defaultDays: number): SQL {
  return sql`raw_retained = true AND created_at < now() - COALESCE(raw_retention_days, ${defaultDays})::int * interval '1 day'`
}

/**
 * 单轮 ledger 原文清除(dry-run 默认)。序列:
 * COUNT 候选 → 无候选即报 → (仅 apply)规模闸 → 取首批 id(dry-run 报"将清"数)
 * → (仅 apply)UPDATE 置空原文 + 置位,RETURNING id 实数。
 * 全函数**不出现 DELETE** —— 账行永不删(由镜像测试反向钉住)。
 */
export async function runToolLedgerRawPurge(
  opts: {
    apply?: boolean
    policy?: ToolLedgerRawPurgePolicy
    env?: NodeJS.ProcessEnv
    deps?: ToolLedgerRawPurgeDeps
  } = {},
): Promise<ToolLedgerRawPurgeResult> {
  const apply = opts.apply === true
  const mode: 'dry-run' | 'apply' = apply ? 'apply' : 'dry-run'
  const policy = opts.policy ?? resolveToolLedgerRawPurgePolicy(opts.env ?? process.env)
  const deps = opts.deps ?? LEDGER_DEFAULT_DEPS
  const zero: ToolLedgerRawPurgeResult = { mode, policy, candidates: 0, purged: 0, status: 'ok' }

  try {
    const outcome = await deps.transaction(async (tx) => {
      const candRaw = await tx.execute(sql`
        SELECT COUNT(*)::int AS cnt FROM ${LEDGER_TABLE}
        WHERE ${ledgerExpiredCond(policy.defaultDays)}
      `)
      const candidates = Number(toRows(candRaw)[0]?.['cnt'] ?? 0)
      if (candidates === 0) return { kind: 'no-candidates' as const, candidates, purged: 0 }
      // 规模闸只在 apply 档拦:干跑永远报数,人先看实数再决定放行(86D 同型)。
      if (apply && candidates > policy.maxPurge)
        return { kind: 'refused-mass' as const, candidates, purged: 0 }

      const targetRaw = await tx.execute(sql`
        SELECT id FROM ${LEDGER_TABLE}
        WHERE ${ledgerExpiredCond(policy.defaultDays)}
        ORDER BY created_at ASC, id ASC
        LIMIT ${policy.batch}
      `)
      const planned = toRows(targetRaw).length
      if (!apply) return { kind: 'ok' as const, candidates, purged: planned }

      // 永不 DELETE:只置空原文两列并置位,其余列(摘要/决策/结果档)原样留存。
      // FOR UPDATE SKIP LOCKED 逐字沿用 O5:与在线摄入互不阻塞,谓词复核防竞态。
      const updRaw = await tx.execute(sql`
        UPDATE ${LEDGER_TABLE}
           SET raw_input = NULL, raw_output = NULL, raw_retained = false, raw_purged_at = now()
         WHERE id IN (
           SELECT id FROM ${LEDGER_TABLE}
            WHERE ${ledgerExpiredCond(policy.defaultDays)}
            ORDER BY created_at ASC, id ASC
            LIMIT ${policy.batch}
            FOR UPDATE SKIP LOCKED
         )
        RETURNING id
      `)
      return { kind: 'ok' as const, candidates, purged: toRows(updRaw).length }
    })

    const result: ToolLedgerRawPurgeResult = {
      ...zero,
      candidates: outcome.candidates,
      purged: outcome.purged,
      status: outcome.kind,
    }
    if (result.status === 'refused-mass') {
      result.reason = `明细账原文到期候选 ${result.candidates} 行 > 单次上限 ${policy.maxPurge},整轮拒跑(实数已打印,分批放行后再开)`
      logger.warn(`[tool-ledger-raw-purge] 拒跑:${result.reason}`)
      return result
    }
    logger.info(
      `[tool-ledger-raw-purge] ${mode}: 到期候选 ${result.candidates} / 本轮清除 ${result.purged} ` +
        `(status=${result.status}, defaultDays=${policy.defaultDays}, batch=${policy.batch})`,
    )
    return result
  } catch (e) {
    // 表未建 / 迁移未跑 / DB 异常:与 86D 同口径降级告警,不打断调度。
    logger.warn('[tool-ledger-raw-purge] failed (degraded)', { error: (e as Error).message })
    return { ...zero, status: 'error', reason: (e as Error).message }
  }
}

// =============================================================================
// 调度器(形态逐字照抄 pii-retention-cleanup.ts;挂点在 index.ts 一行)
// =============================================================================

let scheduledTask: ScheduledTask | null = null

export function startAuditEvidenceRetentionScheduler(): void {
  if (scheduledTask) return
  // 每天 04:45 (Asia/Shanghai):错开 llm-call-log-purge(04:15)/ pii-retention(03:30)/
  // data-archive(04:30)。默认只 dry-run 报数;真正执行需显式
  // AUDIT_EVIDENCE_RETENTION_APPLY=true(改写哈希属高危,先核对 dry-run 数字)。
  // B04 ledger 档挂同一张日批面:顺序跑、各带各的 apply 开关
  // (TOOL_LEDGER_RAW_PURGE_APPLY=true 才真清;两档互不吞异常)。
  scheduledTask = cron.schedule(
    '45 4 * * *',
    async () => {
      try {
        const apply = process.env.AUDIT_EVIDENCE_RETENTION_APPLY === 'true'
        await runAuditEvidenceRetention({ apply })
      } catch (err) {
        logger.error('[audit-evidence-retention] fatal:', { error: err })
      }
      try {
        const ledgerApply = process.env.TOOL_LEDGER_RAW_PURGE_APPLY === 'true'
        await runToolLedgerRawPurge({ apply: ledgerApply })
      } catch (err) {
        logger.error('[tool-ledger-raw-purge] fatal:', { error: err })
      }
    },
    { timezone: 'Asia/Shanghai' },
  )
  logger.info(
    '[audit-evidence-retention] scheduler started (cron: "45 4 * * *" Asia/Shanghai, apply=' +
      String(process.env.AUDIT_EVIDENCE_RETENTION_APPLY === 'true') +
      ', ledger-raw-purge apply=' +
      String(process.env.TOOL_LEDGER_RAW_PURGE_APPLY === 'true') +
      ')',
  )
}

export function stopAuditEvidenceRetentionScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
