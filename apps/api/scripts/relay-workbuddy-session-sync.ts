// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 会话模板回灌落库(2026-10-28 立)—— 「登录本机」重封配方的写入端。
 *
 * 立因:WorkBuddy 本机登录态是明文 JSON + 字段级 $wbEncrypted 信封(AES-256-GCM),密钥只能
 * 从运行中的主进程(9229 inspector)现取、跨重启稳定 ⇒ 一键切号必须拿"整份会话树(凭证剔除)
 * + 密封字段路径 + edition"在本机重封。号池只有票 ⇒ 本脚本把本机当前登录号的模板回灌进
 * 池内对应行的 secretsEnc,供 relay-local-login.ts 组装 payload。
 *
 * 与 relay-trae-session-sync.ts 的三点不同:
 * 1. 本脚本自取数(动态 import scripts/lib/workbuddy-auth-extract.mjs),没有 stdin 编排上游;
 * 2. **只合并写 secretsEnc 的 sessionTemplate/sealedPaths/edition 三键**,不动
 *    token/refreshToken/credVersion(WorkBuddy 的票以池内为准,客户端票不回灌);
 * 3. 池内没有该 uid ⇒ 不建行(切号只对已导入的号有意义,建行会灌进无票幽灵号)。
 *    目标行选择(2026-11-01 根治):候选按 (provider, uid) 不带 owner 过滤拉齐,交
 *    `chooseSyncTargetRow` 判 —— 运营池优先、运营池无行而个人池恰一行则写该行、多行拒写点名。
 *    此前只查运营池行 ⇒ 本机号落在个人池时恒"池内没有该 uid",模板永不回灌。
 *
 * 本机重登后回灌新会话模板的同时把异常行复位到 unknown(判据单源在
 * `relay-credential-revival.ts` 的 `healthRevivalPatchOf`,并清掉 extra_metadata 里的判死
 * 留痕键)。**本腿不带 `credVersion + 1`,也不写 token/到期时刻**:新证据是「本机重登后的
 * 会话模板」而非新票,靠解摘闸门的既有语义(本机已有新证据)+ 清留痕后 lastErrorMessage
 * 复位,绝不谎称凭证版本前进。这不会造成「拿死票空撞上游」:复位只在真的写入本机新模板
 * 那一次才发生,且单源对过期票返回 null ⇒ 死票既不会被复活,也不会被反复推去撞上游。
 *
 * 退出码:0 写入(或 dry-run 判定可写)/ 1 DB 失败 / 2 未判定(无客户端/进程歧义/无模板/池内无行)。
 * 任何输出面零凭据:只报 uid/edition/键计数/文件路径。
 */
import { resolve as resolvePath, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const API_DIR = resolvePath(SCRIPT_DIR, '..')
const REPO_ROOT = resolvePath(API_DIR, '..', '..')

// .env 必须早于服务模块导入(它们在建连/加密时读环境)
import { config } from 'dotenv'
config({ path: resolvePath(API_DIR, '.env') })

const { and, eq, sql } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
const { encryptField, decryptField } = await import('../src/utils/crypto.js')
const { db } = await import('../src/db/index.js')
// 目标行选择判据单源(与 trae/qoder 腿共用):运营池优先,运营池无行时认个人池唯一行
const { chooseSyncTargetRow } = await import('../src/services/relay-session-sync-target.js')
// 即时复活 + 清判死留痕的判据单源(§0.6):本腿只调用,不在 scripts 里再写一份判据。
const { healthRevivalPatchOf, stripTerminalVerdict, TERMINAL_VERDICT_KEY } =
  await import('../src/services/relay-credential-revival.js')

/** 未判定:环境/数据没就绪 ⇒ 不写库、不算失败(退出码 2) */
export class UndeterminedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UndeterminedError'
  }
}

export interface WorkbuddyTemplatePayload {
  uid: string
  edition: string
  sessionTemplate: Record<string, unknown>
  sealedPaths: string[]
  authFile: string
}

export interface WorkbuddySyncSummary {
  ok: boolean
  dryRun: boolean
  providerCode: 'workbuddy'
  uid: string
  edition: string
  templateKeys: number
  sealedPaths: number
  authFile: string
  applied: boolean
  error?: string
}

/** 只保留非空字符串路径(提取器契约:sealedPaths = 原文件里 $wbEncrypted 字段路径) */
export function parseSealedPaths(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((p): p is string => typeof p === 'string' && p !== '')
    : []
}

/** 合并语义:base=既有解密对象(坏密文→{} 以本次重建),只覆盖模板三键,其余键原样保留 */
export function mergeWorkbuddyTemplate(
  base: Record<string, unknown>,
  tpl: WorkbuddyTemplatePayload,
): Record<string, unknown> {
  return {
    ...base,
    sessionTemplate: tpl.sessionTemplate,
    sealedPaths: tpl.sealedPaths,
    edition: tpl.edition,
  }
}

/**
 * 写模板分支的「即时复活 + 清判死留痕」补丁(纯函数,测试锁)。判据住在
 * `relay-credential-revival.ts`(`healthRevivalPatchOf` / `stripTerminalVerdict`),本函数只
 * 组装 `.set()` 形状,不复算任何判据 —— 不在本腿再长一份「过期 / healthy / broken」。
 *
 * 本腿不写 token / 到期时刻 / `credVersion + 1`,没有客户端票到期时刻可传 ⇒ 不传
 * clientExpiresAt(调用方已确认「本轮真的写入了本机重登后的新模板」这份新证据,按单源语义
 * 处理);本腿原本不写 extra_metadata ⇒ 用 drizzle `sql` 原子删键
 * `coalesce(extra_metadata,'{}'::jsonb) - 'terminalVerdict'`,绝不整对象覆盖成 `{}`
 * (并发会丢 keepAliveForever / sessionTemplate 等既有键)。
 */
export function buildRevivalSetPatch(
  row: { healthStatus?: unknown; refreshFailureCount?: unknown; tempUnschedulable?: unknown },
  clientExpiresAt?: Date | null,
  extraMetadataOverride?: Record<string, unknown> | null,
) {
  const rowLike = {
    healthStatus: row.healthStatus,
    refreshFailureCount: row.refreshFailureCount,
    tempUnschedulable: row.tempUnschedulable,
  }
  const stripped = extraMetadataOverride ? stripTerminalVerdict(extraMetadataOverride) : null
  return {
    ...(healthRevivalPatchOf(rowLike, clientExpiresAt ? { clientExpiresAt } : {}) ?? {}),
    extraMetadata:
      stripped && Object.keys(stripped).length > 0
        ? stripped
        : sql`coalesce(${aiRelayAccountPool.extraMetadata}, '{}'::jsonb) - '${sql.raw(TERMINAL_VERDICT_KEY)}'`,
  }
}

/** 提取本机登录号模板;提取器抛错(未运行/进程歧义/会话缺失等)一律转未判定 */
async function collectTemplate(): Promise<WorkbuddyTemplatePayload> {
  const extractorPath = resolvePath(REPO_ROOT, 'scripts', 'lib', 'workbuddy-auth-extract.mjs')
  let extracted: { meta?: Record<string, unknown> }
  try {
    const mod = (await import(pathToFileURL(extractorPath).href)) as {
      extractWorkbuddyAccount: () => Promise<{ meta?: Record<string, unknown> }>
    }
    extracted = await mod.extractWorkbuddyAccount()
  } catch (e) {
    throw new UndeterminedError(
      `提取本机 WorkBuddy 会话失败(未判定):${e instanceof Error ? e.message : String(e)}`,
    )
  }
  const meta = extracted?.meta ?? {}
  const uid = typeof meta.templateUid === 'string' ? meta.templateUid.trim() : ''
  if (!uid) throw new UndeterminedError('提取器未回报 meta.templateUid(未判定)')
  const stored = meta.sessionTemplate
  const sessionTemplate =
    stored && typeof stored === 'object' && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : null
  const sealedPaths = parseSealedPaths(meta.sealedPaths)
  if (!sessionTemplate || Object.keys(sessionTemplate).length === 0 || sealedPaths.length === 0) {
    throw new UndeterminedError('本机会话里没有可回灌的模板/密封字段路径(未判定)')
  }
  const edition =
    typeof meta.edition === 'string' && meta.edition.trim() ? meta.edition.trim() : 'workbuddy'
  return {
    uid,
    edition,
    sessionTemplate,
    sealedPaths,
    authFile: typeof meta.authFile === 'string' ? meta.authFile : '',
  }
}

export async function runSync(dryRun: boolean): Promise<WorkbuddySyncSummary> {
  const tpl = await collectTemplate()
  // 候选不带 owner 过滤:本机号可能已归属某个用户个人池(2026-11-01 实测本机 uid 只有
  // 个人池一行)。仍沿用"池内没有就报未判定、不建行"的口径 —— 建行会灌进无票幽灵号。
  const candidates = await db
    .select()
    .from(aiRelayAccountPool)
    .where(
      and(eq(aiRelayAccountPool.providerCode, 'workbuddy'), eq(aiRelayAccountPool.uid, tpl.uid)),
    )
  const target = chooseSyncTargetRow(candidates)
  if (target.kind === 'ambiguous') {
    throw new UndeterminedError(
      `该 workbuddy 号同 uid ${target.count} 行且无运营池行(归属未判定,拒写不猜)`,
    )
  }
  if (target.kind === 'none') {
    throw new UndeterminedError(`池内没有该 workbuddy 号 uid=${tpl.uid}(未导入?不建行、不写库)`)
  }
  const row = target.row
  let base: Record<string, unknown> = {}
  if (row.secretsEnc) {
    try {
      const parsed = JSON.parse(decryptField(row.secretsEnc))
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        base = parsed as Record<string, unknown>
      }
    } catch {
      /* 坏密文/密钥轮换 ⇒ 以本次重建 */
    }
  }
  const secrets = mergeWorkbuddyTemplate(base, tpl)
  const summary: WorkbuddySyncSummary = {
    ok: true,
    dryRun,
    providerCode: 'workbuddy',
    uid: tpl.uid,
    edition: tpl.edition,
    templateKeys: Object.keys(tpl.sessionTemplate).length,
    sealedPaths: tpl.sealedPaths.length,
    authFile: tpl.authFile,
    applied: false,
  }
  if (dryRun) {
    summary.error = 'dry-run 未写'
    return summary
  }
  await db
    .update(aiRelayAccountPool)
    .set({
      secretsEnc: encryptField(JSON.stringify(secrets)),
      // 判据单源:本机重登后的新模板是「新证据」,只在真的写入这一次复位异常行 +
      // 清判死留痕;本腿不写 token / credVersion,见文件头注。
      ...buildRevivalSetPatch(row),
      updatedAt: new Date(),
    })
    .where(eq(aiRelayAccountPool.id, row.id))
  summary.applied = true
  return summary
}

function parseArgs(argv: string[]): { dryRun: boolean; json: boolean; error: string | null } {
  const options = { dryRun: false, json: false, error: null as string | null }
  for (const a of argv) {
    if (a === '--dry-run') options.dryRun = true
    else if (a === '--json') options.json = true
    else if (a === '--')
      continue // pnpm 透传的裸分隔符,不是参数
    else options.error = `未知参数: ${a}`
  }
  return options
}

export async function main(argv: string[]): Promise<number> {
  const options = parseArgs(argv)
  if (options.error) {
    process.stderr.write(`❌ ${options.error}\n`)
    return 2
  }
  let summary: WorkbuddySyncSummary
  try {
    summary = await runSync(options.dryRun)
  } catch (e) {
    if (e instanceof UndeterminedError) {
      process.stderr.write(`❌ ${e.message}\n`)
      return 2
    }
    process.stderr.write(`❌ 落库失败:${e instanceof Error ? e.message : String(e)}\n`)
    return 1
  }
  if (options.json) {
    process.stdout.write(`${JSON.stringify(summary)}\n`)
  } else {
    process.stderr.write(
      `回灌完成: uid=${summary.uid} edition=${summary.edition} templateKeys=${summary.templateKeys} sealedPaths=${summary.sealedPaths}${summary.applied ? ' ✓已写' : ''}${summary.dryRun ? '(dry-run 未写)' : ''}\n`,
    )
  }
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
      process.exit(2)
    })
}

export const __test__ = { parseArgs, parseSealedPaths, mergeWorkbuddyTemplate, buildRevivalSetPatch }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
