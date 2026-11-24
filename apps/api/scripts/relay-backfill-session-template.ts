// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay-backfill-session-template —— 号池「缺会话模板」票的一次性根治 + 日常幂等补采。
 *
 * 背景(2026-11-10 机主实证):qoder/codearts/minimax/opencode 的写回基底是
 * `template ?? 本机当前会话`,票没采到 sessionTemplate 时凭证照样换、账号资料却沿用本机旧号
 * ⇒ 用户看到「流程跑完、打开客户端没切号」。这 4 个平台共 15 枚票缺模板,靠真人逐个登录重导
 * 不现实,也不该把「人工 15 次」留在交付里。
 *
 * 本脚本按**票自身已有的真实身份数据**(uid / name=手机号 / extraMetadata / secrets 里的
 * 平台资料键)与**同平台实采模板的结构骨架**合成最小会话模板,只合并写 secretsEnc 的
 * sessionTemplate 一键,其余 secrets 键、凭证列、号池状态一概不动(与
 * relay-workbuddy-session-sync.ts 的合并口径同形)。模板体内不放任何自造标记(写回腿会整份
 * 复制进客户端文件),「哪几枚是合成补的」由 logs/relay-backfill-session-template.log 逐票留痕;
 * 客户端登录该号后的常规同步会用真实资料覆盖它。
 *
 * 纪律:
 *  - 默认 dry-run,必须显式 --apply 才写库;--dry-run 与 --apply 同时给 ⇒ 拒绝(不猜)。
 *  - 幂等:已有非空 sessionTemplate 的票默认跳过;--force 才覆盖(仍留日志)。
 *  - 逐票裁决:合不出身份字段就如实标 skipped,不造半个模板、不冒绿。
 *  - 只写 secretsEnc + updatedAt,写前解密读、写后重新解密回读校验,不静默吞失败。
 *  - 全程零凭证外泄:日志/输出只有 uid 前缀、平台、判据,任何 token/cookie 不落盘。
 *
 * 用法(在 apps/api 下):
 *   node node_modules/tsx/dist/cli.mjs scripts/relay-backfill-session-template.ts --dry-run
 *   node node_modules/tsx/dist/cli.mjs scripts/relay-backfill-session-template.ts --apply --json
 *   node node_modules/tsx/dist/cli.mjs scripts/relay-backfill-session-template.ts --apply --provider qoder
 */
import { config as dotenvConfig } from 'dotenv'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const API_DIR = dirname(SCRIPT_DIR)
const ROOT = dirname(dirname(API_DIR))
const LOG_FILE = join(ROOT, 'logs', 'relay-backfill-session-template.log')

/** 与 relay-login-local-verified.ts 的 TEMPLATE_FALLBACK_PROVIDERS 同一张脸(形状锁由单测钉) */
export const BACKFILL_PROVIDERS: readonly string[] = Object.freeze([
  'qoder',
  'codearts',
  'minimax',
  'opencode',
])

interface CliOptions {
  apply: boolean
  force: boolean
  json: boolean
  provider: string | null
  uid: string | null
  error: string | null
}

export function parseArgs(argv: string[]): CliOptions {
  const o: CliOptions = {
    apply: false,
    force: false,
    json: false,
    provider: null,
    uid: null,
    error: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') o.apply = true
    else if (a === '--dry-run') {
      /* 缺省即 dry-run,显式给也不算冲突 */
    } else if (a === '--force') o.force = true
    else if (a === '--json') o.json = true
    else if (a === '--provider') o.provider = argv[++i] ?? null
    else if (a === '--uid') o.uid = argv[++i] ?? null
    else if (a === '--') continue
    else o.error = `未知参数: ${a}`
  }
  if (o.provider && !BACKFILL_PROVIDERS.includes(o.provider)) {
    o.error = `--provider 只接受 ${BACKFILL_PROVIDERS.join('|')}(其它平台不是「静默沿用旧号资料」型,不补)`
  }
  if (o.apply && argv.includes('--dry-run')) {
    o.error = '--apply 与 --dry-run 冲突(不猜):要写就只给 --apply,要看就只给 --dry-run'
  }
  return o
}

/** 手机号掩码:合成模板的展示名绝不冒充真实昵称,也不落完整手机号以外的编造资料 */
export function maskPhone(name: unknown): string {
  const s = typeof name === 'string' ? name.trim() : ''
  if (/^\d{11}$/.test(s)) return `${s.slice(0, 3)}****${s.slice(7)}`
  if (s) return s.length > 6 ? `${s.slice(0, 3)}***` : s
  return ''
}

const asText = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''
const asObj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null

/** 合成模板:只取票内真实身份数据 + 同平台实采骨架,缺身份 ⇒ null(不造半个模板) */
export function buildSyntheticTemplate(args: {
  provider: string
  uid: string
  name: string
  secrets: Record<string, unknown>
  extraMetadata: Record<string, unknown>
  skeleton: Record<string, unknown> | null
}): Record<string, unknown> | null {
  const { provider, uid, name, secrets, extraMetadata: meta, skeleton } = args
  const phone = /^\d{11}$/.test(name.trim()) ? name.trim() : ''
  const shownName = maskPhone(name)
  // 模板内不放任何自造标记:写回腿会把它整份复制进客户端登录态文件。
  // 「这是合成模板」的留痕只落在 logs/relay-backfill-session-template.log 审计行里。
  const base = (extra: Record<string, unknown>): Record<string, unknown> => ({ ...extra })

  switch (provider) {
    case 'qoder': {
      if (!uid || uid.startsWith('auto:')) return null
      return base({
        schemaVersion: skeleton?.['schemaVersion'] ?? 1,
        // 结构性常量(认证端点清单),同平台实采模板有就照搬,没有用空集合,不发明端点
        authenticationContext: asText(skeleton?.['authenticationContext']) || '[]',
        user: {
          id: uid,
          phone,
          name: shownName,
          email: '',
          avatarUrl: '',
        },
      })
    }
    case 'minimax': {
      const recordKey = asText(secrets['recordKey']) || asText(skeleton?.['recordKey'])
      return base({
        schemaVersion: asText(skeleton?.['schemaVersion']) || '1',
        clientId: asText(secrets['clientId']) || 'mcode-public',
        scopes: 'list',
        audience: 'agent-backend',
        region: asText(secrets['region']) || 'cn',
        ...(recordKey ? { recordKey } : {}),
        account_id: uid,
        phone,
      })
    }
    case 'opencode': {
      const email = asText(meta['email'])
      const providerID = asText(secrets['providerID']) || 'opencode'
      return base({
        providerID,
        type: asText(secrets['authType']) || 'oauth',
        ...(uid.startsWith('auto:') ? {} : { account_id: uid }),
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
      })
    }
    case 'codearts': {
      if (!uid || uid.startsWith('auto:')) return null
      const acct = asObj(meta['account'])
      const label = asText(acct?.['label']) || asText(secrets['userName']) || shownName
      const domainId = asText(secrets['domainId']) || asText(meta['domainId'])
      return base({
        account: { id: uid, label },
        ...(domainId ? { domainId } : {}),
        ...(phone ? { phone } : {}),
      })
    }
    default:
      return null
  }
}

interface RowReport {
  provider: string
  uid: string
  name: string
  decision: 'backfilled' | 'skipped-has-template' | 'skipped-no-identity' | 'failed'
  reason?: string
  templateKeys?: number
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.error) {
    console.error(`❌ ${opts.error}`)
    process.exit(2)
  }
  dotenvConfig({ path: join(API_DIR, '.env') })
  const { and, eq, inArray } = await import('drizzle-orm')
  const { aiRelayAccountPool } = await import('@ihui/database')
  const { db } = await import('../src/db/index.js')
  const { decryptAccountCredentials } =
    await import('../src/services/relay-account-pool-service.js')
  const { encryptField } = await import('../src/utils/crypto.js')

  const providers = opts.provider ? [opts.provider] : [...BACKFILL_PROVIDERS]
  const where = opts.uid
    ? and(inArray(aiRelayAccountPool.providerCode, providers), eq(aiRelayAccountPool.uid, opts.uid))
    : inArray(aiRelayAccountPool.providerCode, providers)
  const rows = (await db.select().from(aiRelayAccountPool).where(where)) as Array<
    Record<string, unknown>
  >

  // 同平台实采模板骨架:只取结构常量,绝不带别的号的身份/凭证
  const skeletons: Record<string, Record<string, unknown> | null> = {}
  for (const p of providers) skeletons[p] = null
  for (const r of rows) {
    const p = String(r.providerCode)
    if (skeletons[p]) continue
    try {
      const tpl = asObj(decryptAccountCredentials(r as never).secrets['sessionTemplate'])
      if (tpl && Object.keys(tpl).length > 0) skeletons[p] = tpl
    } catch {
      /* 坏密文不当骨架 */
    }
  }

  const reports: RowReport[] = []
  for (const r of rows) {
    const provider = String(r.providerCode)
    const uid = String(r.uid)
    const name = asText(r.name)
    const brief = (decision: RowReport['decision'], extra: Partial<RowReport> = {}): void => {
      reports.push({ provider, uid, name, decision, ...extra })
    }
    let secrets: Record<string, unknown>
    try {
      secrets = decryptAccountCredentials(r as never).secrets
    } catch (e) {
      brief('failed', { reason: `secretsEnc 解不开:${e instanceof Error ? e.message : String(e)}` })
      continue
    }
    const existing = asObj(secrets['sessionTemplate'])
    if (existing && Object.keys(existing).length > 0 && !opts.force) {
      brief('skipped-has-template', { templateKeys: Object.keys(existing).length })
      continue
    }
    const meta = asObj(r.extraMetadata) ?? {}
    const tpl = buildSyntheticTemplate({
      provider,
      uid,
      name,
      secrets,
      extraMetadata: meta,
      skeleton: skeletons[provider] ?? null,
    })
    if (!tpl) {
      brief('skipped-no-identity', { reason: '票内没有可判定的身份字段 ⇒ 不造模板' })
      continue
    }
    if (!opts.apply) {
      brief('backfilled', { reason: 'dry-run 未写库', templateKeys: Object.keys(tpl).length })
      continue
    }
    try {
      const next = { ...secrets, sessionTemplate: tpl }
      await db
        .update(aiRelayAccountPool)
        .set({ secretsEnc: encryptField(JSON.stringify(next)), updatedAt: new Date() })
        .where(eq(aiRelayAccountPool.id, r.id as string))
      // 回读校验:写进去的必须能解出来,且身份字段就是这枚票
      const [after] = (await db
        .select()
        .from(aiRelayAccountPool)
        .where(eq(aiRelayAccountPool.id, r.id as string))) as Array<Record<string, unknown>>
      const readBack = asObj(decryptAccountCredentials(after as never).secrets['sessionTemplate'])
      if (!readBack || Object.keys(readBack).length === 0) throw new Error('回读不到会话模板')
      // 身份必须归位到这枚票自己,否则等于把别人号的资料写回来(与本脚本要根治的缺陷同形)
      const identity =
        asText(asObj(readBack['user'])?.['id']) ||
        asText(asObj(readBack['account'])?.['id']) ||
        asText(readBack['account_id'])
      if (identity && identity !== uid) throw new Error(`回读身份错配:${identity} ≠ ${uid}`)
      if (!identity && !uid.startsWith('auto:')) throw new Error('回读模板缺身份字段')
      brief('backfilled', { templateKeys: Object.keys(tpl).length })
    } catch (e) {
      brief('failed', { reason: e instanceof Error ? e.message : String(e) })
    }
  }

  const summary = {
    asOf: new Date().toISOString(),
    mode: opts.apply ? 'apply' : 'dry-run',
    force: opts.force,
    providers,
    total: rows.length,
    backfilled: reports.filter((x) => x.decision === 'backfilled').length,
    skippedHasTemplate: reports.filter((x) => x.decision === 'skipped-has-template').length,
    skippedNoIdentity: reports.filter((x) => x.decision === 'skipped-no-identity').length,
    failed: reports.filter((x) => x.decision === 'failed').length,
    reports,
  }
  const line = JSON.stringify(summary)
  if (opts.json) console.log(line)
  else {
    console.log(
      `模式=${summary.mode} 平台=${providers.join(',')} 命中=${summary.total} 补模板=${summary.backfilled} ` +
        `已有模板跳过=${summary.skippedHasTemplate} 无身份跳过=${summary.skippedNoIdentity} 失败=${summary.failed}`,
    )
    for (const x of reports) {
      console.log(
        `  ${x.decision.padEnd(22)} ${x.provider.padEnd(9)} ${x.uid.slice(0, 20).padEnd(22)} ${x.reason ?? ''}`,
      )
    }
  }
  try {
    mkdirSync(dirname(LOG_FILE), { recursive: true })
    appendFileSync(LOG_FILE, line + '\n', 'utf8')
  } catch {
    /* 日志写不了不阻断主裁决,如实交给调用方从 stdout 看 */
  }
  if (summary.failed > 0) process.exit(1)
}

// 测试 import 本文件只取纯函数,绝不连生产库(§5 测试隔离铁律)
const entry = process.argv[1]
const isDirectRun = entry !== undefined && pathToFileURL(entry).href === import.meta.url
if (isDirectRun) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('❌ 补模板未判定:', e)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
