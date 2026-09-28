// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 86D「证据流水的保留策略与墓碑」— 审计证据链表(audit_logs_chain)的保留期清理任务。
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
  type IntegrityVerificationResult,
  type RecordAuditLogParams,
} from '../services/audit-log-service.js'
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

/** 原文仍留存的 SQL 谓词 —— 与 collectRawEvidenceKeys 逐字同集(两半各写一遍必漂移)。 */
function rawHeldCond(): SQL {
  return sql`jsonb_typeof(metadata) = 'object'
    AND COALESCE(metadata->>'rawRetained', 'true') <> 'false'
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
          await tx.execute(sql`
            UPDATE ${CHAIN_TABLE}
               SET prev_hash = ${u.prevHash}, current_hash = ${u.currentHash}
                 ${u.metadataJson !== undefined ? sql`, metadata = ${u.metadataJson}::jsonb` : sql``}
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
// 调度器(形态逐字照抄 pii-retention-cleanup.ts;挂点在 index.ts 一行)
// =============================================================================

let scheduledTask: ScheduledTask | null = null

export function startAuditEvidenceRetentionScheduler(): void {
  if (scheduledTask) return
  // 每天 04:45 (Asia/Shanghai):错开 llm-call-log-purge(04:15)/ pii-retention(03:30)/
  // data-archive(04:30)。默认只 dry-run 报数;真正执行需显式
  // AUDIT_EVIDENCE_RETENTION_APPLY=true(改写哈希属高危,先核对 dry-run 数字)。
  scheduledTask = cron.schedule(
    '45 4 * * *',
    async () => {
      try {
        const apply = process.env.AUDIT_EVIDENCE_RETENTION_APPLY === 'true'
        await runAuditEvidenceRetention({ apply })
      } catch (err) {
        logger.error('[audit-evidence-retention] fatal:', { error: err })
      }
    },
    { timezone: 'Asia/Shanghai' },
  )
  logger.info(
    '[audit-evidence-retention] scheduler started (cron: "45 4 * * *" Asia/Shanghai, apply=' +
      String(process.env.AUDIT_EVIDENCE_RETENTION_APPLY === 'true') +
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
