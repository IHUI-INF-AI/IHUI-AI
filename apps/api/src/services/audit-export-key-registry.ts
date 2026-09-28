// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 86G-2:审计导出**验签公钥登记表**(kid → 公钥,按 kid 索引,受版本控制)。
 *
 * 立票要消灭的那一格:`verifySignedAuditExport` 过去只认"配置里当前那一把"公钥,对信封里的
 * `kid` 不匹配**直接判拒绝** ⇒ 一旦轮换密钥,**旧信封永久验不过** —— 而旧信封恰恰是最需要能
 * 验的(证据的时间跨度天然长于密钥寿命)。三条设计前提不得在后续改动里被磨掉:
 *
 * ① **`retired` 的键必须仍可验**(本模块存在的全部理由):查表**不看** `status`;而
 *    `notBefore` / `notAfter` 是**保留期账目,不是验签闸门** —— 拿 `notAfter` 去拦一次验签,
 *    等于把本票要修的 bug 换个字段名再写一遍。
 * ② **"没登记"与"签名被改"必须是两个结论**(`unknown_key` / `signature_invalid` / `verified`)。
 *    运维拿到一句"验不过"无法决定下一步是"去补登记表"还是"去查谁改了文件",两者处置相反。
 *    信封声称的 `kid` 原样点名;不得回落成"用当前那把试试"(那等于把表当摆设)。
 * ③ **表自身要防腐烂**(取向同守门 108/107),两个方向各一条:把 `retired` 行删掉(可验证据
 *    被判死)判红;行还挂着而它覆盖的时间窗早已越过信封保留期(没有任何信封再需要它)也判红。
 *    后者就是票面"登记了却没有任何信封用过"的**可机器判定形式** —— 本票不连库、也不建"谁用过
 *    哪个 kid"的运行态台账(那张必然腐烂),用「退役时刻 × 信封保留期」算,不用"有没有人记得"算。
 *
 * 分工:kid 推导算法住在本模块(`deriveAuditExportKeyId`),签名侧与验签侧共用一份(两处各写
 * 一遍必漂移);私钥材料永不进本表、进仓、进日志 —— 对私钥 PEM 的处置是"抛错并点名"。表以 TS
 * 源模块形态受版本控制而非 `config/*.json`:`apps/api` 以 `rootDir: ./src` 编译,仓根 `config/**`
 * 既不产进 `dist` 也不在 `copy-assets.mjs` 清单里 ⇒ 运行时解析不到路径的登记表表现为"表恒为空",
 * 比没有表更糟(同仓先例:`capability-catalog.ts`,由守门 51 对账)。
 *
 * 手动问责入口(**本模块未接任何提交链**,是否立门由主会话决定):
 *   node apps/api/src/services/audit-export-key-registry.ts --check [--json]
 *   node apps/api/tests/audit-export-key-registry.selftest.ts --self-test(构造面成对正反例)
 */
import { createHash, createPublicKey } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// =============================================================================
// 类型与常量
// =============================================================================

/** 三档语义封闭集;新增一档必须同时改下面的判据与自检用例。 */
export const AUDIT_EXPORT_KEY_STATUSES = ['active', 'retired', 'bootstrap'] as const

export type AuditExportKeyStatus = (typeof AUDIT_EXPORT_KEY_STATUSES)[number]

/** 登记表的一项。公钥是**公开材料**,可入库;私钥一律拒收。 */
export interface AuditExportKeyEntry {
  kid: string
  /** SPKI PEM 原文,或 base64(DER/SPKI)—— 装载时归一成 PEM。 */
  publicKey: string
  status: AuditExportKeyStatus
  /** 为什么有这一行。`retired` 行缺它,后来人就会当垃圾删掉 —— 那正是本票要防的事。 */
  reason: string
  /** 出生日(YYYY-MM-DD)。`bootstrap` 行由环境变量派生,允许空串。 */
  addedAt: string
  /** 退役日。`retired` 行必须给(`addedAt` 不能代替:那会把保留期算早)。 */
  retiredAt?: string
  notBefore?: string
  /** 覆盖窗终点。它**不拦验签**,只参与腐烂判据。 */
  notAfter?: string
}

/** 判据身份。`code` 稳定,文案可以改而判据不改。 */
export type AuditExportKeyIssueCode =
  | 'R1_DUPLICATE_KID'
  | 'R2_MISSING_REASON'
  | 'R3_UNKNOWN_STATUS'
  | 'R4_RETIRED_ROW_DELETED'
  | 'R5_ENTRY_PAST_RETENTION'
  | 'R6_RETIRED_WITHOUT_DEATH'
  | 'R7_UNUSABLE_KEY_MATERIAL'
  | 'R8_KID_NOT_DERIVABLE'
  | 'R10_MULTIPLE_ACTIVE'
  | 'R11_SIGNING_KEY_NOT_IN_TABLE'

export interface AuditExportKeyIssue {
  code: AuditExportKeyIssueCode
  kid: string
  message: string
}

export interface AuditExportKeyRegistryReport {
  issues: AuditExportKeyIssue[]
  /** 判不动的东西必须响亮登记,不得静默算通过(本仓最高频失效型是"把没判写成判过了")。 */
  undetermined: string[]
  /** 不算红但必须让拿报告的人看见的事实(例如"表为空 ⇒ 轮换能力未启用")。 */
  notices: string[]
}

export interface AuditExportKeyRegistryContext {
  /** 今天(YYYY-MM-DD)。由调用方给 ⇒ 时间维可用构造面证明,而不是依赖此刻时钟。 */
  today: string
  /** 信封保留期(天)。公钥行必须至少覆盖到"最老信封的到期日",所以分母来自 86D。 */
  envelopeRetentionDays?: number
  /**
   * 上一次被审判的面上登记表的样子(通常是 HEAD 那份)。给 `null`/不给 ⇒ R4 判不了 ⇒ 落
   * `undetermined`,**不得**当成"没人删过行"。
   */
  previousEntries?: readonly AuditExportKeyEntry[] | null
  /** 签名侧当前在用的 kid(环境变量派生)。不给 ⇒ R11 不判(还没配密钥)。 */
  signingKid?: string | null
}

/** 86D 拍板值:证据结构行保留 180 天。 */
export const AUDIT_ENVELOPE_RETENTION_DAYS_DEFAULT = 180

/**
 * 与保留作业(`jobs/audit-evidence-retention.ts`)读同一个变量名 ⇒ env 真值只有一份。
 * 不是注释上的约定:该作业 `import` 的就是这两个常量(默认值 + 变量名),机器可核。
 * 镜像测试 `scripts/tests/audit-export-key-registry.test.mjs` T11 锁住这条引用 —— 改回
 * 字面量 `180` / 硬编码变量名即红(同源关系一旦断开,轮换期的"能不能删行"判定就各说各话)。
 */
export const ENVELOPE_RETENTION_ENV = 'AUDIT_EVIDENCE_STRUCT_RETENTION_DAYS'

export const ENV_PUBLIC_KEY_INLINE = 'AUDIT_EXPORT_SIGN_PUBLIC_KEY'
export const ENV_PUBLIC_KEY_PATH = 'AUDIT_EXPORT_SIGN_PUBLIC_KEY_PATH'
export const ENV_KEY_ID_OVERRIDE = 'AUDIT_EXPORT_SIGN_KEY_ID'

/**
 * 登记表本体 —— **受版本控制的唯一清单**。
 *
 * 现读事实(落地当轮):`apps/api/.env` 里 `AUDIT_EXPORT_SIGN` 命中 **0** 次 ⇒ 本仓尚未配置
 * 任何签名密钥,因此本表**起始为空**,而不是先塞一行占位(给一把不存在的钥匙登记行 = 伪造证据)。
 * 空表不等于"已收口":`--check` 报 notice"轮换能力未启用",而不是"0 违规 ⇒ 通过"。
 *
 * 轮换时照此顺序(一行一步):
 *   1. 生成新密钥对 —— 私钥只进 §5d 的权威凭据目录 / 环境变量,不进仓、不进日志;
 *   2. 把**旧**那行 `status` 改成 `retired`,补 `retiredAt` 与 `reason`(它为什么还留着);
 *   3. 追加新公钥一行(`status: 'active'`,kid 必须等于 `deriveAuditExportKeyId(公钥 PEM)` ——
 *      手写一个对不上的 kid 会被 R8 判红,因为收件方按同一算法自算 kid);
 *   4. 跑一次 `--check`,确认旧那行仍在且无新红;
 *   5. 只有当 R5 主动喊"这行的覆盖窗早已越过信封保留期"时才允许删它 —— 删除是**判据要求的**
 *      动作,不是"看着像垃圾"的动作。
 */
export const AUDIT_EXPORT_KEY_REGISTRY: readonly AuditExportKeyEntry[] = []

// =============================================================================
// 密钥材料:归一 / 自算 kid / 装载校验
// =============================================================================

/** 装载期错误:表坏了要报成一次显式失败,而不是当成"空表"(那等于关掉整张表)。 */
export class AuditExportKeyRegistryError extends Error {
  readonly code: 'private_key_material_forbidden' | 'unusable_public_key_material'

  constructor(code: AuditExportKeyRegistryError['code'], message: string) {
    super(message)
    this.name = 'AuditExportKeyRegistryError'
    this.code = code
  }
}

/**
 * 公钥材料归一:PEM(SPKI)与 base64(DER/SPKI)都收,统一成 PEM 再参与 kid 推导。
 * 必须归一:同一条公钥的两种形态若算出两个 kid,就会出现"表里明明有这一把却查不到",
 * 把一次正常验签报成"未知密钥"。私钥材料直接抛错 —— 本表按设计只放公开材料。
 */
export function normalizeAuditExportPublicKey(raw: string): string {
  const text = raw.trim()
  if (text.length === 0) {
    throw new AuditExportKeyRegistryError('unusable_public_key_material', '公钥材料为空')
  }
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) {
    throw new AuditExportKeyRegistryError(
      'private_key_material_forbidden',
      '公钥表/环境变量里出现私钥材料:私钥必须移出仓与日志,本表只接受 PUBLIC KEY',
    )
  }
  try {
    const key = text.startsWith('-----BEGIN PUBLIC KEY-----')
      ? createPublicKey({ key: text, format: 'pem', type: 'spki' })
      : createPublicKey({
          key: Buffer.from(text.replace(/\s+/g, ''), 'base64'),
          format: 'der',
          type: 'spki',
        })
    return key.export({ type: 'spki', format: 'pem' }).toString()
  } catch (e) {
    throw new AuditExportKeyRegistryError(
      'unusable_public_key_material',
      `公钥材料不可解析:${(e as Error).message}`,
    )
  }
}

/**
 * kid = `ihui-audit-export-` + sha256(公钥 PEM) 前 16 位。
 *
 * 收件方拿同一把公钥能自算出同一个值 ⇒ kid 是**标识**不是凭据;也因此"换钥匙 ⇒ kid 自己变",
 * 不依赖人记得同步改一张表。签名侧与验签侧共用本函数。
 */
export function deriveAuditExportKeyId(publicKeyPem: string): string {
  return `ihui-audit-export-${createHash('sha256').update(publicKeyPem, 'utf8').digest('hex').slice(0, 16)}`
}

/**
 * 单行装载校验:结构 + 材料 + status 值域。返回问题串而不是抛错 —— 一行坏不得把整张表
 * 变成"什么都读不出来"(那等于替所有人关掉这一端)。
 */
export function parseAuditExportKeyEntry(
  raw: unknown,
): { ok: true; entry: AuditExportKeyEntry } | { ok: false; problem: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, problem: '表项不是对象' }
  }
  const row = raw as Record<string, unknown>
  const kid = typeof row['kid'] === 'string' ? row['kid'].trim() : ''
  if (kid.length === 0) return { ok: false, problem: 'kid 缺失或为空' }
  const status = row['status']
  if (typeof status !== 'string' || !isAuditExportKeyStatus(status)) {
    return { ok: false, problem: `status 不在封闭集内:${String(status)}` }
  }
  let normalized: string
  try {
    normalized = normalizeAuditExportPublicKey(
      typeof row['publicKey'] === 'string' ? row['publicKey'] : '',
    )
  } catch (e) {
    return { ok: false, problem: (e as Error).message }
  }
  const optional = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined
  return {
    ok: true,
    entry: {
      kid,
      publicKey: normalized,
      status,
      reason: typeof row['reason'] === 'string' ? row['reason'].trim() : '',
      addedAt: optional(row['addedAt']) ?? '',
      retiredAt: optional(row['retiredAt']),
      notBefore: optional(row['notBefore']),
      notAfter: optional(row['notAfter']),
    },
  }
}

function isAuditExportKeyStatus(value: string): value is AuditExportKeyStatus {
  return (AUDIT_EXPORT_KEY_STATUSES as readonly string[]).includes(value)
}

/** 环境变量里"当前那一把"派生的行:状态 `bootstrap`,不是登记项,所以不吃 R2/R8。 */
export function bootstrapAuditExportKeyEntry(
  kid: string,
  publicKeyPem: string,
): AuditExportKeyEntry {
  return {
    kid,
    publicKey: normalizeAuditExportPublicKey(publicKeyPem),
    status: 'bootstrap',
    reason: '来自环境变量 AUDIT_EXPORT_SIGN_PUBLIC_KEY(_PATH) 的当前公钥,尚未登记进版本控制表',
    addedAt: '',
  }
}

export interface AuditExportKeyTable {
  entries: AuditExportKeyEntry[]
  /** 装载坏掉的行:逐条打印,不得静默丢掉(丢掉 = 那一行永久无人看守)。 */
  problems: string[]
}

/**
 * 生效表 = 登记行 ⊕ 环境变量当前公钥(按 kid 去重,登记行优先)。
 *
 * 为什么 env 那把也要进来:今天所有部署实例只有 env 一把钥匙。要求它们先登记进表才能继续
 * 验签,会让本票在上线那一刻把**全部现存信封**判成"未知密钥" —— 那是换一个 bug 上去。
 * bootstrap 行因此存在,并被 `--check` 点名催登记(它是有寿命的过渡形态,不是永久出口)。
 */
export function buildAuditExportKeyTable(
  registry: readonly AuditExportKeyEntry[],
  envCurrent: { kid: string; publicKey: string } | null,
): AuditExportKeyTable {
  const entries: AuditExportKeyEntry[] = []
  const problems: string[] = []
  for (const row of registry) {
    const parsed = parseAuditExportKeyEntry(row)
    if (parsed.ok) entries.push(parsed.entry)
    else problems.push(`登记表项 kid=${row.kid || '(缺失)'}:${parsed.problem}`)
  }
  if (envCurrent) {
    try {
      const bootstrapped = bootstrapAuditExportKeyEntry(envCurrent.kid, envCurrent.publicKey)
      const hit = entries.find((item) => item.kid === bootstrapped.kid)
      // 同 kid 两把不同材料 ⇒ 必有一个是错的。报出来,不猜哪个对。
      if (!hit) entries.push(bootstrapped)
      else if (hit.publicKey !== bootstrapped.publicKey) {
        problems.push(`kid=${bootstrapped.kid} 的登记表材料与环境变量公钥不一致(同 kid 两份真相)`)
      }
    } catch (e) {
      problems.push(`环境变量公钥不可用:${(e as Error).message}`)
    }
  }
  return { entries, problems }
}

export type AuditExportKeyLookup =
  { found: true; entry: AuditExportKeyEntry } | { found: false; kid: string }

/**
 * 按 kid 查表。**不看 status** —— "退而不删"是本模块的立论前提,在这里过滤掉 `retired`
 * 就等于把 86G-2 撤销掉(这条由 `--self-test` 与 vitest 各钉一次)。
 */
export function resolveAuditExportKeyForKid(
  kid: string,
  entries: readonly AuditExportKeyEntry[],
): AuditExportKeyLookup {
  const hit = entries.find((entry) => entry.kid === kid)
  return hit ? { found: true, entry: hit } : { found: false, kid }
}

/** 信封保留期下限:与 86D 同读一个环境变量,且只允许向上 —— 公钥窗口不得短于信封窗口。 */
export function envelopeRetentionDays(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env[ENVELOPE_RETENTION_ENV]
  const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10)
  const configured =
    Number.isFinite(parsed) && parsed >= 0 ? parsed : AUDIT_ENVELOPE_RETENTION_DAYS_DEFAULT
  return Math.max(AUDIT_ENVELOPE_RETENTION_DAYS_DEFAULT, configured)
}

const DAY_MS = 86_400_000

function toMs(value: string | undefined): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

/**
 * 表自证(纯函数:不读时钟、不读环境、不写盘)。三条"不得":`previousEntries` 缺失 ⇒ R4
 * 未判定;空表 ⇒ notice 而非通过;任何一条判据被放宽都必须让对应自检用例翻红(成对正反例)。
 */
export function auditExportKeyRegistryIssues(
  entries: readonly AuditExportKeyEntry[],
  ctx: AuditExportKeyRegistryContext,
): AuditExportKeyRegistryReport {
  const issues: AuditExportKeyIssue[] = []
  const undetermined: string[] = []
  const notices: string[] = []
  const todayMs = toMs(ctx.today)
  if (todayMs === null) {
    return {
      issues,
      undetermined: [`ctx.today 不可解析(${ctx.today})⇒ 时间维 R4/R5 全部未判定`],
      notices,
    }
  }
  const retentionDays = ctx.envelopeRetentionDays ?? envelopeRetentionDays()
  const registered = entries.filter((entry) => entry.status !== 'bootstrap')

  if (entries.length === 0) {
    notices.push('登记表与环境变量都没有任何公钥 ⇒ 验签机制当前不可用(这不是"已收口")')
  } else if (registered.length === 0) {
    notices.push(
      '登记表为空、只有环境变量那一把 bootstrap 公钥 ⇒ **轮换能力未启用**:换钥前必须先把当时公钥登记为 active,否则轮换即让旧信封永久验不过',
    )
  }

  // R1:kid 必须唯一。两行同 kid 时查表只命中第一条,另一行成为"看着在、其实永不生效"的死行。
  const seen = new Set<string>()
  const duplicated = new Set<string>()
  for (const entry of entries) {
    if (seen.has(entry.kid)) duplicated.add(entry.kid)
    seen.add(entry.kid)
  }
  for (const kid of duplicated) {
    issues.push({
      code: 'R1_DUPLICATE_KID',
      kid,
      message: '同一 kid 登记了多行(查表只命中第一行,其余是永不生效的死行)',
    })
  }

  let activeCount = 0
  for (const entry of entries) {
    if (!isAuditExportKeyStatus(entry.status)) {
      issues.push({
        code: 'R3_UNKNOWN_STATUS',
        kid: entry.kid,
        message: `status=${entry.status} 不在封闭集 ${AUDIT_EXPORT_KEY_STATUSES.join('|')} 内`,
      })
    }
    if (entry.status === 'active') activeCount += 1
    // R2:只有 bootstrap 免 reason(那句理由由代码给)。登记行缺 reason = 给后来人递删除凭据。
    if (entry.status !== 'bootstrap' && entry.reason.length === 0) {
      issues.push({
        code: 'R2_MISSING_REASON',
        kid: entry.kid,
        message:
          '缺少 reason:没写"为什么留着这一行"的登记项会被当垃圾删,而删掉 retired 行等于判死可验证据',
      })
    }
    // R7/R8:材料不可解析 ⇒ 这行永远验不过任何信封;kid 与材料分叉 ⇒ 收件方自算的 kid 查不到这行。
    let normalized = ''
    try {
      normalized = normalizeAuditExportPublicKey(entry.publicKey)
    } catch (e) {
      issues.push({
        code: 'R7_UNUSABLE_KEY_MATERIAL',
        kid: entry.kid,
        message: (e as Error).message,
      })
    }
    if (normalized !== '' && entry.status !== 'bootstrap') {
      const derived = deriveAuditExportKeyId(normalized)
      if (derived !== entry.kid) {
        issues.push({
          code: 'R8_KID_NOT_DERIVABLE',
          kid: entry.kid,
          message: `kid 与公钥自算值不符(应为 ${derived}):收件方按同一算法推 kid,对不上就永远查不到这一行`,
        })
      }
    }
    if (entry.status === 'retired') {
      const deathMs = toMs(entry.notAfter) ?? toMs(entry.retiredAt)
      if (deathMs === null) {
        issues.push({
          code: 'R6_RETIRED_WITHOUT_DEATH',
          kid: entry.kid,
          message:
            'retired 行既无 retiredAt 也无 notAfter ⇒ 只有出生没有死亡:没人答得上它该留多久,也没人敢删',
        })
      } else {
        const coveredUntilMs = deathMs + retentionDays * DAY_MS
        if (coveredUntilMs < todayMs) {
          issues.push({
            code: 'R5_ENTRY_PAST_RETENTION',
            kid: entry.kid,
            message: `覆盖窗(${entry.notAfter ?? entry.retiredAt})+ 信封保留期 ${retentionDays} 天早已过去 ⇒ 没有任何仍存活的信封还需要这把公钥,该行属清单腐烂,应删除`,
          })
        } else {
          notices.push(
            `kid=${entry.kid} 仍在保留期内(还覆盖约 ${Math.ceil((coveredUntilMs - todayMs) / DAY_MS)} 天)⇒ **不得删除**`,
          )
        }
      }
    }
  }

  if (activeCount > 1) {
    issues.push({
      code: 'R10_MULTIPLE_ACTIVE',
      kid: entries
        .filter((entry) => entry.status === 'active')
        .map((entry) => entry.kid)
        .join(','),
      message: `active 有 ${activeCount} 行 ⇒ "当前该用哪把签名"变成二义`,
    })
  }

  // R4:上一面上是 retired、这一面上消失 ⇒ 把可验证据判死。判不动时必须喊"未判定"。
  if (ctx.previousEntries === undefined || ctx.previousEntries === null) {
    undetermined.push('R4(退而被删)未判定:没有上一面登记表快照 ⇒ 无从知道有没有人删过 retired 行')
  } else {
    const currentKids = new Set(entries.map((entry) => entry.kid))
    for (const previous of ctx.previousEntries) {
      if (previous.status !== 'retired' || currentKids.has(previous.kid)) continue
      issues.push({
        code: 'R4_RETIRED_ROW_DELETED',
        kid: previous.kid,
        message: `retired 行被删除(上一面还在)⇒ 该钥签出的旧信封永久验不过。原理由:${previous.reason || '(当时就没写理由)'}`,
      })
    }
  }

  // R11:表里有 active 行、却不含签名侧在用的 kid ⇒ 表与在用钥匙分叉,轮换账目就此失真。
  if (ctx.signingKid) {
    const hasActive = registered.some((entry) => entry.status === 'active')
    const matched = entries.some(
      (entry) => entry.status === 'active' && entry.kid === ctx.signingKid,
    )
    if (hasActive && !matched) {
      issues.push({
        code: 'R11_SIGNING_KEY_NOT_IN_TABLE',
        kid: ctx.signingKid,
        message: '签名侧在用的 kid 不是登记表里的 active 行 ⇒ 部署用的钥匙与登记的不是同一把',
      })
    }
  }
  return { issues, undetermined, notices }
}

// =============================================================================
// 生效表读取 + 一次完整体检(--check 与镜像测试跑同一份判据)
// =============================================================================

/**
 * 读环境变量里的"当前公钥"。内联优先,其次路径指向的文件;两者都没配 ⇒ null。
 * 配了路径却取不到文件 ⇒ 抛错(那一次不是"没登记",是"登记材料丢了")。
 */
export function readEnvironmentCurrentKey(
  env: Record<string, string | undefined> = process.env,
): { kid: string; publicKey: string } | null {
  const configuredKid = env[ENV_KEY_ID_OVERRIDE]?.trim() ?? ''
  const inline = env[ENV_PUBLIC_KEY_INLINE]
  if (inline && inline.trim().length > 0) {
    const pem = normalizeAuditExportPublicKey(inline)
    return {
      kid: configuredKid.length > 0 ? configuredKid : deriveAuditExportKeyId(pem),
      publicKey: pem,
    }
  }
  const keyPath = env[ENV_PUBLIC_KEY_PATH]
  if (keyPath && keyPath.trim().length > 0) {
    if (!existsSync(keyPath)) {
      throw new AuditExportKeyRegistryError(
        'unusable_public_key_material',
        `${ENV_PUBLIC_KEY_PATH} 指向的公钥文件不存在:${keyPath}(该变量已配置,请先确认文件在位)`,
      )
    }
    const pem = normalizeAuditExportPublicKey(readFileSync(keyPath, 'utf-8'))
    return {
      kid: configuredKid.length > 0 ? configuredKid : deriveAuditExportKeyId(pem),
      publicKey: pem,
    }
  }
  return null
}

export interface AuditExportKeyCheckResult {
  exitCode: 0 | 1
  issues: AuditExportKeyIssue[]
  undetermined: string[]
  notices: string[]
  problems: string[]
  tableSize: number
  today: string
  retentionDays: number
  previousFace: 'read' | 'unavailable'
}

/** 一次体检。`previousEntries` 默认读 HEAD(取不到 ⇒ null ⇒ R4 未判定,不冒绿)。 */
export function checkAuditExportKeyRegistry(
  env: Record<string, string | undefined> = process.env,
  today: string = new Date().toISOString().slice(0, 10),
  previousEntries: readonly AuditExportKeyEntry[] | null = readPreviousFaceEntries(),
): AuditExportKeyCheckResult {
  const envCurrent = readEnvironmentCurrentKey(env)
  const table = buildAuditExportKeyTable(AUDIT_EXPORT_KEY_REGISTRY, envCurrent)
  const retentionDays = envelopeRetentionDays(env)
  const report = auditExportKeyRegistryIssues(table.entries, {
    today,
    envelopeRetentionDays: retentionDays,
    previousEntries,
    // "签名侧在用的 kid":有 env 公钥时就是它的 kid;否则 R11 不判。
    signingKid: envCurrent?.kid ?? null,
  })
  const loadIssues: AuditExportKeyIssue[] = table.problems.map((message) => ({
    code: 'R7_UNUSABLE_KEY_MATERIAL',
    kid: '(装载期)',
    message,
  }))
  const issues = [...report.issues, ...loadIssues]
  return {
    exitCode: issues.length > 0 ? 1 : 0,
    issues,
    undetermined: report.undetermined,
    notices: report.notices,
    problems: table.problems,
    tableSize: table.entries.length,
    today,
    retentionDays,
    previousFace: previousEntries === null ? 'unavailable' : 'read',
  }
}

// =============================================================================
// 上一面(HEAD)的表:只读 git;取不到 ⇒ 未判定(不得静默放行)
// =============================================================================

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
export const REGISTRY_PATH_FROM_ROOT = 'apps/api/src/services/audit-export-key-registry.ts'

/**
 * 只抠登记数组那一段(不抠判据里的 `kid:` 字面量)。括号配平;找不到声明 ⇒ 空串,
 * 由调用方报"未判定"而不是"表为空"。
 *
 * ⚠️ 锚点必须走"名字 → 赋值号 → 第一个左方括号"三步,不能直接找名字后的第一个 `[`:
 * 声明本身写着 `readonly AuditExportKeyEntry[] = [`,那个 `[` 属于**类型标注** —— 从它开始
 * 配平会拿到 `[]` 并让抽取器对整张表永久失明(含真实表情的自检用例抓到过一次)。
 */
export function registryArrayText(source: string): string {
  const declared = source.indexOf('AUDIT_EXPORT_KEY_REGISTRY: readonly AuditExportKeyEntry[]')
  if (declared < 0) return ''
  const assigned = source.indexOf('=', declared)
  if (assigned < 0) return ''
  const open = source.indexOf('[', assigned)
  if (open < 0) return ''
  let depth = 0
  for (let i = open; i < source.length; i++) {
    const ch = source[i]
    if (ch === '[') depth += 1
    else if (ch === ']') {
      depth -= 1
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  return source.slice(open)
}

/** 按对象块抠 `kid` + `status`(找不到块不算通过)。 */
export function extractRegistryBlocks(source: string): Array<{ kid: string; status: string }> {
  const text = registryArrayText(source)
  if (text.length === 0) return []
  const blocks: Array<{ kid: string; status: string }> = []
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue
    let depth = 0
    let end = i
    for (let j = i; j < text.length; j++) {
      const ch = text[j]
      if (ch === '{') depth += 1
      else if (ch === '}') {
        depth -= 1
        if (depth === 0) {
          end = j
          break
        }
      }
    }
    const block = text.slice(i, end + 1)
    const kid = /kid:\s*'([^']*)'/.exec(block)?.[1]
    const status = /status:\s*'([^']*)'/.exec(block)?.[1]
    if (kid && status) blocks.push({ kid, status })
    i = end
  }
  return blocks
}

/**
 * 上一面(HEAD)里的 retired 行;取不到 ⇒ `null`(R4 走未判定)。
 * 只问"哪些 kid 当时是 retired"—— 材料不参与这一维比对:把材料也比,一次无关的格式改动
 * 就会被读成"删了一行"。
 */
function readPreviousFaceEntries(): readonly AuditExportKeyEntry[] | null {
  const text = readHeadFileText(REGISTRY_PATH_FROM_ROOT)
  if (text === null) return null
  return extractRegistryBlocks(text)
    .filter((block) => block.status === 'retired')
    .map((block) => ({
      kid: block.kid,
      publicKey: '',
      status: 'retired' as const,
      reason: '上一面(HEAD)的登记行(理由文本不参与本维比对)',
      addedAt: '',
    }))
}

/** git 只读调用:绝对路径候选 + 必带 timeout + windowsHide(§5b);取不到 ⇒ null,不猜。 */
function readHeadFileText(pathFromRoot: string): string | null {
  const candidates = [process.env['GIT_BIN'], 'git'].filter((v): v is string =>
    Boolean(v && v.length > 0),
  )
  for (const bin of candidates) {
    try {
      return execFileSync(bin, ['-c', 'safe.directory=*', 'show', `HEAD:${pathFromRoot}`], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
        timeout: 20_000,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    } catch {
      // 试下一个候选;全失败 ⇒ 上层报未判定
    }
  }
  return null
}

function runCheck(asJson: boolean): number {
  const result = checkAuditExportKeyRegistry()
  const undetermined =
    result.previousFace === 'unavailable'
      ? [...result.undetermined, '上一面(HEAD)登记表取不到 ⇒ R4(退而被删)这一维未判定']
      : result.undetermined
  if (asJson) {
    console.log(JSON.stringify({ ...result, undetermined }, null, 2))
    return result.exitCode
  }
  console.log(
    `[audit-export-key-registry] 今日=${result.today} 生效公钥=${String(result.tableSize)} 项 信封保留期=${String(result.retentionDays)} 天 上一面=${result.previousFace}`,
  )
  for (const issue of result.issues)
    console.log(`  ❌ ${issue.code} kid=${issue.kid}:${issue.message}`)
  for (const line of undetermined) console.log(`  ⚠️ 未判定:${line}`)
  for (const line of result.notices) console.log(`  ℹ️ ${line}`)
  if (result.issues.length === 0 && undetermined.length === 0) {
    console.log('  ✅ 登记表自洽(表为空时这句只代表"无事可判",不代表"轮换已备好")')
  }
  return result.exitCode
}

// =============================================================================
// CLI(§22d:被 import 时不得触发副作用)
// =============================================================================

function main(): number {
  const args = process.argv.slice(2)
  if (args.includes('--check')) return runCheck(args.includes('--json'))
  console.log('用法:--self-test | --check [--json](本模块未接提交链)')
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main()
  } catch (e) {
    console.error(`audit-export-key-registry 自身异常:${(e as Error).message}`)
    process.exitCode = 2
  }
}
