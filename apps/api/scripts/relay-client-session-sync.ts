// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 客户端会话回灌落库(通用,2026-11-12 立)—— 覆盖 loomy / zcode / raccoon 三条
 * 「无刷新端点、客户端为主」回灌腿的写入端。
 *
 * 立因:这三条平台的适配器刻意不实现 refreshToken(刷新端点无公开文档 / 为空壳),
 * keepAliveForever 旗标无法让调度器自动续票;唯一彻底保活路径 = 每 10 分钟把本机客户端
 * 重新捞取的凭据推回号池 —— 与 trae / qoder / minimax 同族的客户端会话回灌(§0.6 判据单源复用)。
 *
 * 与 qoder / trae 腿同构:只动凭证三列(token / refreshToken / expiresAt)+ credVersion + 1,
 * **绝不碰** healthStatus / tempUnschedulable / refreshFailureCount / lastErrorMessage。
 * 目标行选择(chooseSyncTargetRow)、写入判据(decideSync)、心跳(touchClientHeartbeat)、
 * 自动入池(importAccounts)、uid 推导(resolveImportAccountUid)、凭据槽位
 * (resolveRelayCredentialSlots)全部复用既有单源,本文件零复算。
 *
 * 编排上游 = scripts/sync-{loomy,zcode,raccoon}-client-session.mjs(提取本机凭据 → stdin)。
 * 退出码:0 全部处理完(含 skip)/ 1 有行写入失败 / 2 参数·输入·环境未判定。
 * 任何输出面不得含凭据明文。
 */
import { resolve as resolvePath, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const API_DIR = resolvePath(SCRIPT_DIR, '..')

// .env 必须早于服务模块导入(它们在建连/加密时读环境)
import { config } from 'dotenv'
config({ path: resolvePath(API_DIR, '.env') })

const { and, eq, sql, inArray } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
const { encryptField, decryptField } = await import('../src/utils/crypto.js')
const { db } = await import('../src/db/index.js')
// 目标行选择判据单源:运营池优先,运营池无行时认个人池唯一行(与 trae/qoder 腿共用)
const { chooseSyncTargetRow } = await import('../src/services/relay-session-sync-target.js')
// uid 推导单源 = 导入服务(与 --from 落库口径逐字同一枚键,保证回灌命中同一行)
const { resolveImportAccountUid, importAccounts } =
  await import('../src/services/relay-account-pool-service.js')
// 凭据槽位单源 = 格式层(loomy→value / raccoon→token / zcode→oauth:bigmodel:access_token 等)
const { resolveRelayCredentialSlots } = await import('../src/services/relay-account-format.js')
// 写入判据 / 心跳 / 日期解析 单源 = Trae 腿(四条同型腿共用一份,§0.6)
const traeSync = await import('./relay-trae-session-sync.js')
const decideSync = traeSync.__test__.decideSync
const parseIso = traeSync.__test__.parseIso
const touchClientHeartbeat = traeSync.touchClientHeartbeat
const { describeAutoImportOwner, resolveAutoImportOwner } =
  await import('./relay-session-autoimport-owner.js')
import type { ImportAccountInput } from '../src/services/relay-account-pool-service.js'
import type { RelayProviderCode } from '../src/services/relay-account-format.js'
import type { AutoImportOwnerDecision } from './relay-session-autoimport-owner.js'

interface RowOutcome {
  uid: string
  decision: string
  applied: boolean
  error?: string
}

export interface ClientSyncSummary {
  ok: boolean
  dryRun: boolean
  providerCode: RelayProviderCode
  total: number
  applied: number
  skipped: number
  missing: number
  failed: number
  /** 本机新登录账号自动入池数(池内无行 → 走 importAccounts 建行;dry-run 只报不写) */
  imported: number
  /** 本轮写入的客户端心跳行数(永久保活档的让位依据;dry-run 按候选计数不落库) */
  heartbeat?: number
  rows: RowOutcome[]
}

/** 从账号对象取明文凭据(零复算:复用格式层槽位单源);取不到 ⇒ 空串 */
function clientTokenOf(account: Record<string, unknown>, providerCode: RelayProviderCode): string {
  const { hits } = resolveRelayCredentialSlots(account, providerCode)
  for (const h of hits) {
    if (h && typeof h.value === 'string' && h.value.trim() !== '') return h.value
  }
  return ''
}

export async function runSync(
  providerCode: RelayProviderCode,
  payloadText: string,
  dryRun: boolean,
): Promise<ClientSyncSummary> {
  let payload: { accounts?: unknown; clientActiveAt?: string | null; providerCode?: string }
  try {
    payload = JSON.parse(payloadText) as typeof payload
  } catch {
    throw new Error('stdin 不是合法 JSON(未判定)')
  }
  if (!Array.isArray(payload.accounts)) {
    throw new Error('accounts 必须是数组(未判定)')
  }

  const summary: ClientSyncSummary = {
    ok: true,
    dryRun,
    providerCode,
    total: payload.accounts.length,
    applied: 0,
    skipped: 0,
    missing: 0,
    failed: 0,
    imported: 0,
    rows: [],
  }

  // uid 推导走导入服务单源:与 --from 落库口径同一枚键,保证回灌命中同一行(§0.6)
  const candidateUids = (payload.accounts as unknown[])
    .map((a) => resolveImportAccountUid(providerCode, a as ImportAccountInput))
    .filter((u): u is string => typeof u === 'string' && u !== '')
  const candidateRows =
    candidateUids.length > 0
      ? await db
          .select()
          .from(aiRelayAccountPool)
          .where(
            and(
              eq(aiRelayAccountPool.providerCode, providerCode),
              inArray(aiRelayAccountPool.uid, candidateUids),
            ),
          )
      : []
  const rowsByUid = new Map<string, typeof candidateRows>()
  for (const r of candidateRows) {
    const list = rowsByUid.get(r.uid) ?? []
    list.push(r)
    rowsByUid.set(r.uid, list)
  }
  const targetOf = (uid: string) => chooseSyncTargetRow(rowsByUid.get(uid) ?? [])

  // 心跳先落,再判票:same-token 是常态,那一支本来一行凭证都不写 —— 心跳若挂在票写分支上
  // 就永远不达标,池会把「客户端正在续期」误读成「客户端已静默」⇒ 永久保活号被池接管续期
  // ⇒ 当场把正在用的客户端顶下线(与 Trae/Qoder 腿同一型事故)。
  summary.heartbeat = await touchClientHeartbeat(
    candidateUids.flatMap((uid) => {
      const t = targetOf(uid)
      return t.kind === 'row' ? [t.row.id] : []
    }),
    payload.clientActiveAt ?? null,
    dryRun,
  )

  for (const acc of payload.accounts as unknown[]) {
    const account = (
      acc && typeof acc === 'object' ? (acc as Record<string, unknown>) : {}
    ) as Record<string, unknown>
    const uid = resolveImportAccountUid(providerCode, account as ImportAccountInput)
    try {
      if (!uid) {
        summary.failed++
        summary.rows.push({
          uid: '(unknown)',
          decision: 'apply',
          applied: false,
          error: '凭据形状认不出 / 无明文(token 槽为空)',
        })
        continue
      }
      const token = clientTokenOf(account, providerCode)
      if (!token) {
        summary.failed++
        summary.rows.push({
          uid,
          decision: 'apply',
          applied: false,
          error: '取不到明文凭据(槽位单源未命中)',
        })
        continue
      }
      // loomy/zcode 无显式 expiry;raccoon 的 access_token 含 JWT exp ⇒ 取 expiresAt 字段
      const expiresAt = parseIso(
        typeof account.expiresAt === 'string' ? account.expiresAt : undefined,
      )
      const target = targetOf(uid)
      if (target.kind === 'ambiguous') {
        // 同 uid 多行且无运营池行:挑一行写就是写穿他人副本,拒写并点名(不猜)
        summary.failed++
        summary.rows.push({
          uid,
          decision: 'apply',
          applied: false,
          error: `同 uid 有 ${target.count} 行且无运营池行,归属未判定(不猜)`,
        })
        continue
      }
      if (target.kind === 'none') {
        // 缺行 ⇒ 自动入池:与 trae/qoder 腿同型,复用 importAccounts 同一落库出口;
        // 归属走 pool-owner 单源,取不到就如实拒(绝不静默落运营池)。
        let autoOwner: AutoImportOwnerDecision
        try {
          autoOwner = resolveAutoImportOwner()
        } catch (e) {
          summary.failed++
          summary.rows.push({
            uid,
            decision: 'auto-import',
            applied: false,
            error: `归属判据装载失败(未判定): ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`,
          })
          continue
        }
        if (dryRun) {
          summary.imported++
          summary.rows.push({
            uid,
            decision: 'auto-import',
            applied: false,
            error: `dry-run 未写(将落:${describeAutoImportOwner(autoOwner)})`,
          })
          continue
        }
        const res = await importAccounts(
          providerCode,
          [account as ImportAccountInput],
          autoOwner.ownerUserId,
        )
        const item = res.items[0]
        if (item && (item.status === 'imported' || item.status === 'updated')) {
          summary.imported++
          summary.rows.push({ uid, decision: 'auto-import', applied: true })
        } else {
          summary.failed++
          summary.rows.push({
            uid,
            decision: 'auto-import',
            applied: false,
            error: (item?.reason ?? '导入未回报条目').slice(0, 200),
          })
        }
        continue
      }
      const row = target.row
      // 池内明文解不出(密钥轮换/坏密文)时当作"票不同"走 apply,让客户端票覆盖坏密文
      let poolPlain: string | null = null
      try {
        poolPlain = row.tokenEnc ? decryptField(row.tokenEnc) : null
      } catch {
        poolPlain = null
      }
      const final = decideSync({
        poolToken: poolPlain,
        poolTokenExpiresAt: row.tokenExpiresAt,
        poolRefreshExpiresAt: row.refreshExpiresAt,
        clientToken: token,
        // 这三条平台均无 refresh 端点 ⇒ refreshToken 恒 null,池内该列保持不动
        clientRefreshToken: null,
        clientExpiresAt: expiresAt,
        clientRefreshExpiresAt: null,
      })
      if (!final.apply) {
        summary.skipped++
        summary.rows.push({ uid, decision: final.reason, applied: false })
        continue
      }
      if (dryRun) {
        summary.applied++
        summary.rows.push({ uid, decision: final.reason, applied: false, error: 'dry-run 未写' })
        continue
      }
      await db
        .update(aiRelayAccountPool)
        .set({
          tokenEnc: encryptField(final.next.token),
          tokenExpiresAt: final.next.tokenExpiresAt,
          // 客户端没给 refresh ⇒ 沿用池内既有 refreshExpiresAt(保留不动)
          refreshExpiresAt: final.next.refreshExpiresAt,
          // 签到侧按 cred_version 防降级:不涨版本,新票永远推不过去
          credVersion: sql`${aiRelayAccountPool.credVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(aiRelayAccountPool.id, row.id))
      summary.applied++
      summary.rows.push({ uid, decision: final.reason, applied: true })
    } catch (e) {
      summary.failed++
      summary.rows.push({
        uid: uid ?? '(unknown)',
        decision: 'apply',
        applied: false,
        error: (e instanceof Error ? e.message : String(e)).slice(0, 200),
      })
    }
  }
  if (summary.failed > 0) summary.ok = false
  return summary
}

function parseArgs(argv: string[]): {
  provider?: string
  stdin: boolean
  dryRun: boolean
  json: boolean
  error: string | null
} {
  const options = {
    provider: undefined as string | undefined,
    stdin: false,
    dryRun: false,
    json: false,
    error: null as string | null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a.startsWith('--provider=')) options.provider = a.slice('--provider='.length).trim()
    else if (a === '--provider') {
      // 空格形态 --provider loomy(壳以空格传参,tsx 会原样透传):取下一个 argv
      options.provider = (argv[i + 1] ?? '').trim()
      i++
    } else if (a === '--stdin') options.stdin = true
    else if (a === '--dry-run') options.dryRun = true
    else if (a === '--json') options.json = true
    else if (a === '--')
      continue // pnpm 透传的裸分隔符,不是参数
    else options.error = `未知参数: ${a}`
  }
  if (!options.provider) options.error = '必须 --provider <loomy|zcode|raccoon>'
  if (!options.stdin && !options.error) options.error = '必须 --stdin(凭据经标准输入,不落盘)'
  return options
}

export async function main(argv: string[]): Promise<number> {
  const options = parseArgs(argv)
  if (options.error) {
    process.stderr.write(`❌ ${options.error}\n`)
    return 2
  }
  const providerCode = options.provider as RelayProviderCode
  let payloadText: string
  try {
    payloadText = await readStdin()
  } catch (e) {
    process.stderr.write(
      `❌ 读 stdin 失败(未判定): ${e instanceof Error ? e.message : String(e)}\n`,
    )
    return 2
  }
  if (payloadText.trim() === '') {
    process.stderr.write('❌ stdin 为空(未判定)\n')
    return 2
  }
  let summary: ClientSyncSummary
  try {
    summary = await runSync(providerCode, payloadText, options.dryRun)
  } catch (e) {
    process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
    return 2
  }
  if (options.json) {
    process.stdout.write(`${JSON.stringify(summary)}\n`)
  } else {
    process.stderr.write(
      `回灌完成: 平台=${summary.providerCode} applied=${summary.applied} skipped=${summary.skipped} ` +
        `missing=${summary.missing} imported=${summary.imported} 心跳=${summary.heartbeat ?? 0} ` +
        `failed=${summary.failed}${summary.dryRun ? '(dry-run 未写)' : ''}\n`,
    )
    for (const r of summary.rows) {
      process.stderr.write(
        `  ${r.uid} ${r.decision}${r.applied ? ' ✓已写' : ''}${r.error ? ` (${r.error})` : ''}\n`,
      )
    }
  }
  return summary.ok ? 0 : 1
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
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

export const __test__ = { clientTokenOf, parseArgs }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
