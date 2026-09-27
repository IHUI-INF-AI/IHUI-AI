// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SIEM 导出器 — 将链式审计日志格式化为 SIEM 平台兼容格式。
 *
 * 支持三种格式:
 * - CEF  (Common Event Format, ArcSight):  CEF:0|IHUI|API|1.0|Name|Severity|Extension
 * - LEEF (Log Event Extended Format, QRadar): LEEF:1.0|IHUI|API|EventClassID|Severity|key=val\t...
 * - JSON (结构化,默认)
 *
 * 流式导出 streamExport:分页拉取 + AsyncGenerator 逐行 yield,
 * 避免一次性加载全量日志导致内存爆炸。
 *
 * 86C 追加:buildSignedAuditExport / verifySignedAuditExport —— 导出信封的非对称
 * 签名与离线验签(见文件末尾"86C"一节)。交付字节与签名对象都做键序归一的确定性
 * 序列化,收件方只需公钥即可自验,不需要持任何对称密钥。
 */
import { createHash, createSign, createVerify } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { env } from 'node:process'
import type { AuditLogChainRow, AuditLogFilters } from '../db/audit-queries.js'
import { selectAuditLogs } from '../db/audit-queries.js'
// 86G-2:按 kid 查表的登记表与它的装载/解析出口。kid 的推导算法也住在那边 —— 签名侧与
// 验签侧各写一遍必然漂移(本仓记过最多次的失败型),所以这里只 import,不再抄一份。
import {
  AUDIT_EXPORT_KEY_REGISTRY,
  buildAuditExportKeyTable,
  deriveAuditExportKeyId,
  readEnvironmentCurrentKey,
  resolveAuditExportKeyForKid,
  type AuditExportKeyEntry,
  type AuditExportKeyStatus,
  type AuditExportKeyTable,
} from './audit-export-key-registry.js'

export type SiemFormat = 'json' | 'cef' | 'leef'

const VENDOR = 'IHUI'
const PRODUCT = 'API'
const VERSION = '1.0'

/** action → CEF Name / LEEF EventClassID 映射。 */
function eventName(action: string): string {
  switch (action) {
    case 'auth.login':
      return 'UserLogin'
    case 'auth.logout':
      return 'UserLogout'
    case 'user.create':
      return 'UserCreate'
    case 'user.update':
      return 'UserUpdate'
    case 'user.delete':
      return 'UserDelete'
    case 'data.read':
      return 'DataAccess'
    case 'data.write':
      return 'DataWrite'
    case 'admin.op':
      return 'AdminOperation'
    default:
      return action || 'Unknown'
  }
}

/** action + result → CEF Severity (0-10,ArcSight 标准)。 */
function severityOf(log: AuditLogChainRow): number {
  if (log.result === 'failure' || log.result === 'denied') {
    // 失败的认证/鉴权是高优先级(可能是攻击)
    if (log.action === 'auth.login' || log.action === 'admin.op') return 8
    return 6
  }
  switch (log.action) {
    case 'auth.login':
      return 3
    case 'auth.logout':
      return 2
    case 'admin.op':
      return 6
    case 'user.create':
    case 'user.update':
    case 'user.delete':
      return 5
    case 'data.write':
      return 4
    case 'data.read':
      return 2
    default:
      return 3
  }
}

/** CEF Extension 字段:act/dst/duser/suser/msg/proto/rt 等标准 key。 */
function cefExtension(log: AuditLogChainRow): string {
  const parts = [
    `act=${log.action}`,
    `rt=${log.timestamp}`,
    `dst=${log.ip ?? '0.0.0.0'}`,
    log.userId ? `suser=${log.userId}` : '',
    log.resourceType ? `cs1=${log.resourceType}` : '',
    log.resourceId ? `cs2=${log.resourceId}` : '',
    log.result ? `outcome=${log.result}` : '',
    log.userAgent ? `requestContext=${cefEscape(log.userAgent)}` : '',
  ]
  return parts.filter(Boolean).join(' ')
}

/** CEF 值转义:管道/反斜杠/等号/换行需转义。 */
function cefEscape(v: string): string {
  return v.replace(/[\\|=]/g, '\\$&').replace(/[\r\n]/g, ' ')
}

/** LEEF 值转义:管道需转义为 \|,等号在 value 中需转义。 */
function leefEscape(v: string): string {
  return v.replace(/[\\|]/g, '\\$&').replace(/[\r\n]/g, ' ')
}

/** 格式化为 CEF 单行。 */
export function formatCEF(log: AuditLogChainRow): string {
  const name = eventName(log.action)
  const sev = severityOf(log)
  const ext = cefExtension(log)
  return `CEF:0|${VENDOR}|${PRODUCT}|${VERSION}|${name}|${sev}|${ext}`
}

/** 格式化为 LEEF 单行。 */
export function formatLEEF(log: AuditLogChainRow): string {
  const eventClass = eventName(log.action)
  const sev = severityOf(log)
  const kvs = [
    `act=${leefEscape(log.action)}`,
    `rt=${log.timestamp}`,
    `src=${leefEscape(log.ip ?? '')}`,
    log.userId ? `usr=${leefEscape(log.userId)}` : '',
    log.resourceType ? `resource=${leefEscape(log.resourceType)}` : '',
    log.resourceId ? `rid=${leefEscape(log.resourceId)}` : '',
    log.result ? `result=${leefEscape(log.result)}` : '',
    log.userAgent ? `ua=${leefEscape(log.userAgent)}` : '',
    // metadata 走 canonicalStringify 而不是 JSON.stringify:JSONB 读出来的 key 顺序
    // 不保证稳定,同一份内容两次导出会产出不同字节 —— 那会让"证据文件可复现"落空。
    log.metadata ? `meta=${leefEscape(canonicalStringify(log.metadata))}` : '',
  ].filter(Boolean)
  return `LEEF:1.0|${VENDOR}|${PRODUCT}|${eventClass}|${sev}|${kvs.join('\t')}`
}

/** 格式化为 JSON 单行(JSON Lines,每行一个独立 JSON 对象)。 */
export function formatJSON(log: AuditLogChainRow): string {
  // 用 canonicalStringify(递归排序 key)而不是 JSON.stringify:
  // 交付字节必须只由内容决定,否则同一份审计日志两次导出会得到不同的行文本。
  return canonicalStringify({
    id: log.id,
    timestamp: log.timestamp,
    userId: log.userId,
    action: log.action,
    resourceType: log.resourceType,
    resourceId: log.resourceId,
    ip: log.ip,
    userAgent: log.userAgent,
    result: log.result,
    metadata: log.metadata,
    prevHash: log.prevHash,
    currentHash: log.currentHash,
  })
}

/** 按格式分发格式化函数。 */
export function formatLog(log: AuditLogChainRow, format: SiemFormat): string {
  switch (format) {
    case 'cef':
      return formatCEF(log)
    case 'leef':
      return formatLEEF(log)
    case 'json':
    default:
      return formatJSON(log)
  }
}

/** 流式导出格式化头部(部分格式有 header 行)。 */
export function formatHeader(format: SiemFormat): string {
  // CEF/LEEF/JSON Lines 均无独立 header;预留扩展点。
  return format === 'json' ? '' : ''
}

/**
 * 流式导出审计日志。
 *
 * 分页拉取(每页 PAGE_SIZE 条),逐条 yield 格式化后的行。
 * 受 maxItems 上限保护(默认 10000,防止超大导出拖垮内存)。
 *
 * 用法:
 *   for await (const line of streamExport(filters, 'cef')) {
 *     reply.raw.write(line + '\n')
 *   }
 */
export async function* streamExport(
  filters: AuditLogFilters,
  format: SiemFormat,
  maxItems = 10000,
): AsyncGenerator<string> {
  const PAGE_SIZE = 500
  let page = 1
  let emitted = 0

  while (emitted < maxItems) {
    const need = Math.min(PAGE_SIZE, maxItems - emitted)
    const { list } = await selectAuditLogs(filters, page, need)
    if (list.length === 0) break
    for (const row of list) {
      if (emitted >= maxItems) break
      yield formatLog(row, format)
      emitted++
    }
    if (list.length < need) break // 已到末页
    page++
  }
}

// =============================================================================
// 86C:导出信封的非对称签名与离线验签
// =============================================================================
//
// 为什么必须另封一层非对称,而不是复用链里的 HMAC:
// `audit-log-service.ts` 的 prevHash/currentHash 用 HMAC-SHA256(对称密钥),
// 任何能**验证**该链的一方都持有同一把密钥,因而也能**伪造**一条合法的链。
// 把同一把对称密钥拿去给导出文件签名,等于把"自签能力"交给收件方 —— 那份导出
// 就不再是证据。所以本层的唯一出口是非对称签名(RSA-SHA256,私钥只在我方),
// 收件方拿公钥即可离线验签,"这份导出没被改过、且确实出自我们"两件事同时成立,
// 而**不需要持任何对称密钥**。
//
// 复用的仓内形态(不新造加密方案、不引新依赖):
// - 签名/验签: `createSign('RSA-SHA256')` / `createVerify('RSA-SHA256')`
//   (同 `apps/api/src/services/wechat-pay.ts`)
// - RSA 密钥 PEM 形态: PKCS8 私钥 / SPKI 公钥(同 `apps/api/src/routes/oauth-keys.ts`)
// - 密钥材料只从环境变量或环境变量指向的文件读取(同 wechat-pay 的
//   `WX_PAY_PRIVATE_KEY` / `WX_PAY_PRIVATE_KEY_PATH` 双通道),**私钥永不入库、
//   永不出现在任何响应体或日志里**。
//
// 签名的对象是**确定性序列化**后的载荷(见 canonicalStringify:递归排序对象 key)。
// 不这么做的话,同一份内容两次导出会因 key 顺序不同而产出不同的签名字节,
// 收件方无法判断"变的是内容还是序列化" —— 那正是"看起来可验证、实际不可复现"那一型。

/** 签名算法固定一档:收件方无需读本文件即可自验。要扩算法必须同时改验签侧。 */
export const AUDIT_EXPORT_SIGNATURE_ALGORITHM = 'RSA-SHA256' as const

export type AuditExportSignatureAlgorithm = typeof AUDIT_EXPORT_SIGNATURE_ALGORITHM

/** 载荷里锁定的过滤条件快照(六维全部落字段,未设置的落空串)。 */
export interface AuditExportFilterSnapshot {
  userId: string
  action: string
  resourceType: string
  startDate: string
  endDate: string
}

/**
 * 被签名的导出载荷。
 *
 * 逐字段都是判据:`lines` 是数据体本身,`dataDigest`/`rowCount` 是它的自证,
 * `filters` 锁住"这份信封声称导出的是哪一个查询范围"(不锁的话,一份"全量"签名
 * 可以被裁剪成任意子集而签名依旧成立 —— 少送证据这一型就此隐身)。
 */
export interface AuditExportPayload {
  algorithm: AuditExportSignatureAlgorithm
  /** 密钥标识(kid):让收件方知道该用哪把公钥,且换钥即换号。 */
  keyId: string
  format: SiemFormat
  /** 导出时刻(ISO 8601);由签名锁定,不是响应头的 Date。 */
  exportedAt: string
  rowCount: number
  /** 数据体确定性序列化的 sha256(hex),供收件方做廉价的先验自检。 */
  dataDigest: string
  filters: AuditExportFilterSnapshot
  lines: string[]
}

/** 导出信封 = 数据体 + 签名(基 64)。验签只需 `payload` + `signature` + 公钥。 */
export interface SignedAuditExport {
  payload: AuditExportPayload
  signature: string
}

/** 验签结论分类 —— 三态必须可分辨,"没登记"与"签名被改"的处置动作相反(86G-2)。 */
export type AuditExportVerifyStatus =
  'verified' | 'malformed_envelope' | 'content_inconsistent' | 'unknown_key' | 'signature_invalid'

/** 验签结论:`ok=false` 时 `reason` 必非空(不得给一个没有原因的"不通过")。 */
export interface AuditExportVerifyResult {
  ok: boolean
  /**
   * 分类结论。`unknown_key`(登记表里没这一把)与 `signature_invalid`(有这一把、签名不对)
   * **不得同形**:前者要人去补登记,后者要人去查谁改了文件。合并成一个"验不过"就是把
   * 两种相反的处置动作压成一条没人能执行的告警。
   */
  status: AuditExportVerifyStatus
  reason?: string
  /** 信封声称的 kid(结构合法即给出,便于运维照它去补登记)。 */
  kid?: string
  /** 命中的登记表项状态(`active` / `retired` / `bootstrap`);未命中时不给。 */
  keyStatus?: AuditExportKeyStatus
}

/** 失败原因分类 —— 为了"可归因",而不是把四类压成一句"签名失败"。 */
export type AuditExportSignatureFailureReason =
  | 'private_key_unavailable'
  | 'public_key_unavailable'
  | 'sign_operation_failed'
  | 'verify_operation_failed'

/**
 * 签名/验签机制自身不可用时抛出。
 *
 * 刻意**不用返回值表示"没签成功"**:调用方一旦忘记判返回值,未签名的导出就会
 * 照常发给收件方,而账面一切正常。抛错让"跳过签名"在类型层就不可能顺手发生
 * (§5e "失败必须响"同一条禁令)。
 */
export class AuditExportSignatureError extends Error {
  readonly reason: AuditExportSignatureFailureReason

  constructor(reason: AuditExportSignatureFailureReason, message: string) {
    super(message)
    this.name = 'AuditExportSignatureError'
    this.reason = reason
  }
}

const PRIVATE_KEY_INLINE_ENV = 'AUDIT_EXPORT_SIGN_PRIVATE_KEY'
const PRIVATE_KEY_PATH_ENV = 'AUDIT_EXPORT_SIGN_PRIVATE_KEY_PATH'
const PUBLIC_KEY_INLINE_ENV = 'AUDIT_EXPORT_SIGN_PUBLIC_KEY'
const PUBLIC_KEY_PATH_ENV = 'AUDIT_EXPORT_SIGN_PUBLIC_KEY_PATH'
const KEY_ID_ENV = 'AUDIT_EXPORT_SIGN_KEY_ID'

/**
 * 递归排序 key 的 JSON 序列化。
 *
 * 注:`audit-log-service.ts` 里有一份同义私有实现,本层**不能**复用它(它未 export,
 * 而该文件属 86A 在飞区、本票禁改)。两处实现必漂移是本仓记过最多次的失败型,
 * 所以这里把"收口成一份"如实登记为待办(见交付报告残余清单),而不是假装没有第二份。
 */
function canonicalStringify(value: unknown): string {
  if (value === undefined || value === null) return 'null'
  if (Array.isArray(value)) {
    return '[' + value.map((item) => canonicalStringify(item)).join(',') + ']'
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort()
    return (
      '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(obj[k])).join(',') + '}'
    )
  }
  return JSON.stringify(value)
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** 从"内联 / 指向文件"双通道取 PEM。取不到返回空串,由调用方按语义决定如何报错。 */
function readPemFromEnv(
  inlineName: string,
  pathName: string,
  missingFileReason: AuditExportSignatureFailureReason,
): string {
  const inline = env[inlineName]
  if (inline && inline.trim().length > 0) return inline
  const keyPath = env[pathName]
  if (keyPath && keyPath.trim().length > 0) {
    if (!existsSync(keyPath)) {
      // 配了路径却取不到文件 ≠ 未配置:处置动作是"把文件放回去/改路径",
      // 混成一句会让运维照着"去配 env"的提示改半天而问题原地不动。
      throw new AuditExportSignatureError(
        missingFileReason,
        `${pathName} 指向的密钥文件不存在:${keyPath}(该变量已配置,请先确认文件在位)`,
      )
    }
    return readFileSync(keyPath, 'utf-8')
  }
  return ''
}

function getPrivateKeyPem(): string {
  const pem = readPemFromEnv(
    PRIVATE_KEY_INLINE_ENV,
    PRIVATE_KEY_PATH_ENV,
    'private_key_unavailable',
  )
  if (pem.trim().length === 0) {
    throw new AuditExportSignatureError(
      'private_key_unavailable',
      `未配置审计导出签名私钥:请设置 ${PRIVATE_KEY_INLINE_ENV}(PEM 正文)或 ${PRIVATE_KEY_PATH_ENV}(PEM 文件路径)。` +
        '签名机制不可用时导出**不会**降级为"未签名照发"。',
    )
  }
  return pem
}

function getPublicKeyPem(): string {
  const pem = readPemFromEnv(PUBLIC_KEY_INLINE_ENV, PUBLIC_KEY_PATH_ENV, 'public_key_unavailable')
  if (pem.trim().length === 0) {
    throw new AuditExportSignatureError(
      'public_key_unavailable',
      `未配置审计导出验签公钥:请设置 ${PUBLIC_KEY_INLINE_ENV}(PEM 正文)或 ${PUBLIC_KEY_PATH_ENV}(PEM 文件路径)。` +
        '"没有公钥"不等于"验签通过",它是一次未完成的验证。',
    )
  }
  return pem
}

/**
 * kid:显式配置优先,否则取公钥 PEM 的 sha256 前 16 位(算法在登记表那一份实现里)。
 *
 * 由公钥推导意味着"换钥匙 ⇒ kid 自己变",不需要人记得同步改一张表;收件方拿到同一把公钥
 * 也能算出同一个值(所以 kid 不是凭据,是标识)。**登记表里的行必须能被同一个函数查到** ——
 * 两侧共用这一份推导,否则会出现"签出去的信封写着 A,表里登记的是 B"这种永久验不过。
 */
function keyIdForPublicKey(publicKeyPem: string): string {
  const configured = env[KEY_ID_ENV]
  if (configured && configured.trim().length > 0) return configured.trim()
  return deriveAuditExportKeyId(publicKeyPem)
}

/**
 * 生效公钥表 = 登记行 ⊕ 环境变量当前公钥(86G-2)。
 *
 * 环境变量取不到不抛(表可能就是空),取到坏材料才抛 —— 抛错语义由调用方翻译成
 * "验签机制不可用",绝不翻译成"验不过"(那是把没判写成判过了)。
 */
function currentKeyTable(): AuditExportKeyTable {
  let envCurrent: { kid: string; publicKey: string } | null
  try {
    envCurrent = readEnvironmentCurrentKey()
  } catch (e) {
    throw new AuditExportSignatureError('public_key_unavailable', (e as Error).message)
  }
  return buildAuditExportKeyTable(AUDIT_EXPORT_KEY_REGISTRY, envCurrent)
}

/** 公钥发布出口:路由的 `GET /public-key` 只走这里,私钥在本函数作用域内不可达。 */
export function getAuditExportPublicKeyInfo(): {
  keyId: string
  algorithm: AuditExportSignatureAlgorithm
  publicKey: string
} {
  const publicKey = getPublicKeyPem()
  return {
    keyId: keyIdForPublicKey(publicKey),
    algorithm: AUDIT_EXPORT_SIGNATURE_ALGORITHM,
    publicKey,
  }
}

/** 六维过滤条件归一成快照(未设置的落空串,避免 undefined 在 JSON 里"整键消失")。 */
function snapshotFilters(filters: AuditLogFilters): AuditExportFilterSnapshot {
  return {
    userId: filters.userId ?? '',
    action: filters.action ?? '',
    resourceType: filters.resourceType ?? '',
    startDate: filters.startDate ?? '',
    endDate: filters.endDate ?? '',
  }
}

/** 签名字节 = 载荷的确定性序列化。签名与验签两侧必须走同一个函数,否则永远对不上。 */
function canonicalPayloadBytes(payload: AuditExportPayload): string {
  return canonicalStringify(payload)
}

function rsaSign(canonical: string, privateKeyPem: string): string {
  try {
    const signer = createSign(AUDIT_EXPORT_SIGNATURE_ALGORITHM)
    signer.update(canonical, 'utf8')
    return signer.sign(privateKeyPem, 'base64')
  } catch (e) {
    // 不把底层 OpenSSL 文案原样抛给调用方拼进响应:它可能带文件路径等实现细节
    throw new AuditExportSignatureError(
      'sign_operation_failed',
      `RSA-SHA256 签名运算失败:${(e as Error).message}`,
    )
  }
}

function rsaVerify(canonical: string, signatureB64: string, publicKeyPem: string): boolean {
  try {
    const verifier = createVerify(AUDIT_EXPORT_SIGNATURE_ALGORITHM)
    verifier.update(canonical, 'utf8')
    return verifier.verify(publicKeyPem, signatureB64, 'base64')
  } catch (e) {
    throw new AuditExportSignatureError(
      'verify_operation_failed',
      `RSA-SHA256 验签运算失败:${(e as Error).message}`,
    )
  }
}

/**
 * 生成**已签名**的审计导出信封。
 *
 * @param exportedAt 覆盖导出时刻(仅供单测做"同一内容两次导出签名字节全等"的判据;
 *                   生产调用方不传,取当前时间)
 * @throws AuditExportSignatureError 私钥不可用 / 签名运算失败 —— 绝不返回未签名信封
 */
export async function buildSignedAuditExport(
  filters: AuditLogFilters,
  format: SiemFormat,
  maxItems = 10000,
  exportedAt?: string,
): Promise<SignedAuditExport> {
  const lines: string[] = []
  for await (const line of streamExport(filters, format, maxItems)) {
    lines.push(line)
  }

  const payload: AuditExportPayload = {
    algorithm: AUDIT_EXPORT_SIGNATURE_ALGORITHM,
    // kid 由公钥推导 ⇒ 签出去的信封自证"该用哪把公钥验我"
    keyId: keyIdForPublicKey(getPublicKeyPem()),
    format,
    exportedAt: exportedAt ?? new Date().toISOString(),
    rowCount: lines.length,
    dataDigest: sha256Hex(canonicalStringify(lines)),
    filters: snapshotFilters(filters),
    lines,
  }

  const signature = rsaSign(canonicalPayloadBytes(payload), getPrivateKeyPem())
  return { payload, signature }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

/** 外部文件反序列化出来的是 unknown ⇒ 必须先做结构判定,不得当已验内容用。 */
function parseEnvelope(raw: unknown): SignedAuditExport | string {
  if (!isRecord(raw)) return '信封不是 JSON 对象'
  const p = raw['payload']
  const signature = raw['signature']
  if (!isRecord(p)) return '信封缺少 payload 对象'
  if (typeof signature !== 'string' || signature.length === 0) return 'signature 缺失或为空'
  if (p['algorithm'] !== AUDIT_EXPORT_SIGNATURE_ALGORITHM) {
    return `签名算法不受支持:${String(p['algorithm'])}`
  }
  if (typeof p['keyId'] !== 'string') return 'payload.keyId 不是字符串'
  if (typeof p['format'] !== 'string') return 'payload.format 不是字符串'
  if (typeof p['exportedAt'] !== 'string') return 'payload.exportedAt 不是字符串'
  if (typeof p['rowCount'] !== 'number') return 'payload.rowCount 不是数字'
  if (typeof p['dataDigest'] !== 'string') return 'payload.dataDigest 不是字符串'
  if (!isStringArray(p['lines'])) return 'payload.lines 不是字符串数组'
  if (!isRecord(p['filters'])) return 'payload.filters 不是对象'
  return { payload: p as unknown as AuditExportPayload, signature }
}

/**
 * 用公钥离线验签一份导出信封。**不需要任何对称密钥**。
 *
 * 三态分开、不并桶(86G-2 把"只认当前那一把"换成了"按信封自带的 kid 查登记表"):
 * - `status:'verified'`            —— kid 在表里(可以是已退役的旧钥)、自证一致、签名验过
 * - `status:'content_inconsistent'`/ `'malformed_envelope'` / `'signature_invalid'` —— 内容被改过 / 结构不合法
 * - `status:'unknown_key'`         —— **登记表里没有这一把 kid**:既不是"通过"也不是"签名被改",
 *   它说的是"我们没登记这把公钥",处置动作是去补表(或把旧钥登记为 retired),不是去查篡改者
 * - **throw** AuditExportSignatureError —— 一把公钥都没有 / 验签运算本身失败:"没能完成验证",
 *   绝不能被读成"验证不通过"(更不能被读成通过)
 *
 * 判定顺序刻意是"先自证、后查表、再验签":摘要/行数不一致时直接判不通过,不给篡改者
 * 用"签名反正会红"来掩盖"数据被删了几行"的机会。
 *
 * ⚠️ 查表**不得**按 `status` 过滤:`retired` 的旧信封正是本票存在的理由。时间窗
 * (`notAfter`)只进腐烂判据(`audit-export-key-registry.ts`),不进验签路径。
 */
export function verifySignedAuditExport(envelope: unknown): AuditExportVerifyResult {
  return verifySignedAuditExportWithKeys(envelope, currentKeyTable().entries)
}

/**
 * 上一节的**唯一实现**;`verifySignedAuditExport` 只是"用当前生效表"的那一层薄壳。
 *
 * 分成两层不是为了给测试开后门:外部审计方拿到的是**离线公钥表**(登记表文件本身),而不是
 * 我们的环境变量 —— 所以"按一张给定的表验签"本身就是生产语义。测试与非生产消费者共用这条
 * 出口,两侧判据因此不会漂移(另写一份"能注入表"的验签 = 第二份真相)。
 */
export function verifySignedAuditExportWithKeys(
  envelope: unknown,
  entries: readonly AuditExportKeyEntry[],
): AuditExportVerifyResult {
  const parsed = parseEnvelope(envelope)
  if (typeof parsed === 'string') return { ok: false, status: 'malformed_envelope', reason: parsed }
  const { payload, signature } = parsed
  const kid = payload.keyId

  if (payload.rowCount !== payload.lines.length) {
    return {
      ok: false,
      status: 'content_inconsistent',
      kid,
      reason: `行数不自洽:声明 ${String(payload.rowCount)},实际 ${String(payload.lines.length)}`,
    }
  }
  if (payload.dataDigest !== sha256Hex(canonicalStringify(payload.lines))) {
    return {
      ok: false,
      status: 'content_inconsistent',
      kid,
      reason: '数据体摘要不匹配:导出内容在签名后被改动过',
    }
  }

  if (entries.length === 0) {
    throw new AuditExportSignatureError(
      'public_key_unavailable',
      `没有任何可用公钥:登记表(${String(AUDIT_EXPORT_KEY_REGISTRY.length)} 行)与环境变量都取不到公钥。` +
        `请设置 ${PUBLIC_KEY_INLINE_ENV}(PEM 正文)或 ${PUBLIC_KEY_PATH_ENV}(PEM 文件路径),` +
        '或把该信封的公钥登记进 services/audit-export-key-registry.ts。' +
        '"没有公钥"不等于"验签通过",它是一次未完成的验证。',
    )
  }
  const resolved = resolveAuditExportKeyForKid(kid, entries)
  if (!resolved.found) {
    // 未知 kid ≠ 签名无效:报"未知密钥"并把 kid 点名,同时列出表里都有谁 —— 运维据此一眼看出
    // 是"没登记"还是"表被人删了一行"。绝不回落成"用当前那把试试"(那等于把登记表当摆设)。
    const known = entries.map((entry) => `${entry.kid}(${entry.status})`).join(', ')
    return {
      ok: false,
      status: 'unknown_key',
      kid,
      reason:
        `未知密钥:信封 kid=${kid} 不在验签公钥登记表里;当前可用的是 [${known}]。` +
        '这不是签名被篡改 —— 处置动作是把这把公钥登记为 retired(旧信封才能验),而不是去找篡改者。',
    }
  }

  const verified = rsaVerify(canonicalPayloadBytes(payload), signature, resolved.entry.publicKey)
  if (!verified) {
    return {
      ok: false,
      status: 'signature_invalid',
      kid,
      keyStatus: resolved.entry.status,
      reason: 'RSA-SHA256 验签未通过:信封被篡改,或签名并非该 kid 对应的私钥产出',
    }
  }
  return { ok: true, status: 'verified', kid, keyStatus: resolved.entry.status }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
