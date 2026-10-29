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

const { and, eq, isNull } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
const { encryptField, decryptField } = await import('../src/utils/crypto.js')
const { db } = await import('../src/db/index.js')

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
  const [row] = await db
    .select()
    .from(aiRelayAccountPool)
    .where(
      and(
        eq(aiRelayAccountPool.providerCode, 'workbuddy'),
        eq(aiRelayAccountPool.uid, tpl.uid),
        isNull(aiRelayAccountPool.ownerUserId),
      ),
    )
    .limit(1)
  if (!row) {
    throw new UndeterminedError(`池内没有该 workbuddy 号 uid=${tpl.uid}(未导入?不建行、不写库)`)
  }
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
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aiRelayAccountPool.providerCode, 'workbuddy'),
        eq(aiRelayAccountPool.uid, tpl.uid),
        isNull(aiRelayAccountPool.ownerUserId),
      ),
    )
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

export const __test__ = { parseArgs, parseSealedPaths, mergeWorkbuddyTemplate }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
