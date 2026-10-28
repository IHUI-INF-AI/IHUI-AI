// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 一键切号 —— 号池取数 + 本机 Trae 客户端登录态写回(2026-10-28 立)。
 *
 * 机主诉求:本机 Trae 登录的号必须在池里保活,且随时能把池里任意一枚号写回客户端。
 * 保活端(worker sweep 每 5 分钟 client-first 兜底续期 + trae-session-sync 每 10 分钟
 * 回灌)已在跑;本脚本补写回端:解密池行 → 用回灌时存的档案快照(secretsEnc.profile)
 * 重建客户端信封 → 原子写 storage.json(写前备份、写后回读校验)。
 *
 * 分工(§0.6):信封重建/进程检查/原子写等本机操作全在 scripts/lib/trae-client-switch.mjs,
 * 本文件只做连库取数、解密与编排。判据(参数面)也 import 自该 lib,不复制第二份。
 *
 * 模式:--list | --current | --to <uid|名称> [--dry-run] [--force] [--json]
 * 退出码:0 成功(含 dry-run)/ 1 业务失败(无匹配、歧义、客户端在跑、校验不过)/ 2 未判定
 * (参数错、本机无 storage.json、本机客户端会话取不到)。
 * 任何输出面不含凭据明文(只给 uid/名称/健康态/到期时刻/文件路径)。
 */
import fs from 'node:fs'
import { resolve as resolvePath, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const API_DIR = resolvePath(SCRIPT_DIR, '..')
const ROOT = resolvePath(API_DIR, '..', '..')

// .env 必须早于服务模块导入(它们在建连/加密时读环境)
import { config } from 'dotenv'
config({ path: resolvePath(API_DIR, '.env') })

const { and, eq } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
const { decryptField } = await import('../src/utils/crypto.js')
const { db } = await import('../src/db/index.js')
const { setTimeout: sleep } = await import('node:timers/promises')

const sw = await import(pathToFileURL(join(ROOT, 'scripts', 'lib', 'trae-client-switch.mjs')).href)
const ex = await import(pathToFileURL(join(ROOT, 'scripts', 'lib', 'trae-auth-extract.mjs')).href)

/** 展示/校验用的安全列(绝不含密文列) */
const SAFE_COLUMNS = {
  uid: aiRelayAccountPool.uid,
  name: aiRelayAccountPool.name,
  healthStatus: aiRelayAccountPool.healthStatus,
  isEnabled: aiRelayAccountPool.isEnabled,
  tempUnschedulable: aiRelayAccountPool.tempUnschedulable,
  tokenExpiresAt: aiRelayAccountPool.tokenExpiresAt,
  refreshExpiresAt: aiRelayAccountPool.refreshExpiresAt,
  credVersion: aiRelayAccountPool.credVersion,
  ownerUserId: aiRelayAccountPool.ownerUserId,
  deviceId: aiRelayAccountPool.deviceId,
  lastRefreshAt: aiRelayAccountPool.lastRefreshAt,
  updatedAt: aiRelayAccountPool.updatedAt,
}

interface SafeRow {
  uid: string
  name: string
  healthStatus: string
  isEnabled: boolean
  tempUnschedulable: boolean
  tokenExpiresAt: Date | null
  refreshExpiresAt: Date | null
  credVersion: number
  ownerUserId: string | null
  deviceId: string | null
  lastRefreshAt: Date | null
  updatedAt: Date | null
}

function fmt(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString() : '-'
}

function rowLine(r: SafeRow): string {
  return (
    `  uid=${r.uid} 名称=${r.name} 健康=${r.healthStatus} 启用=${r.isEnabled ? '是' : '否'}` +
    ` 摘除=${r.tempUnschedulable ? '是' : '否'} token到期=${fmt(r.tokenExpiresAt)}` +
    ` rt到期=${fmt(r.refreshExpiresAt)} cred=v${r.credVersion}` +
    ` 设备=${r.deviceId ? '有' : '无'} 归属=${r.ownerUserId ?? '运营池'}`
  )
}

async function runList(json: boolean): Promise<number> {
  const rows = await db
    .select(SAFE_COLUMNS)
    .from(aiRelayAccountPool)
    .where(eq(aiRelayAccountPool.providerCode, 'trae'))
    .orderBy(aiRelayAccountPool.uid)
  if (json) {
    process.stdout.write(
      `${JSON.stringify({ providerCode: 'trae', total: rows.length, accounts: rows })}\n`,
    )
    return 0
  }
  process.stderr.write(`号池 Trae 账号(共 ${rows.length} 枚):\n`)
  for (const r of rows) process.stderr.write(`${rowLine(r)}\n`)
  return 0
}

async function runCurrent(json: boolean): Promise<number> {
  let extracted: { meta: { uid: string; name: string } }
  try {
    extracted = ex.extractTraeAccount()
  } catch (e) {
    process.stderr.write(
      `❌ 本机 Trae 客户端会话取不到(未判定): ${e instanceof Error ? e.message : String(e)}\n`,
    )
    return 2
  }
  const uid = String(extracted.meta.uid)
  const [row] = await db
    .select(SAFE_COLUMNS)
    .from(aiRelayAccountPool)
    .where(and(eq(aiRelayAccountPool.providerCode, 'trae'), eq(aiRelayAccountPool.uid, uid)))
  if (json) {
    process.stdout.write(`${JSON.stringify({ localUid: uid, inPool: !!row, pool: row ?? null })}\n`)
    return row ? 0 : 1
  }
  if (!row) {
    process.stderr.write(`❌ 本机登录 uid=${uid} 不在号池(未导入?)\n`)
    return 1
  }
  process.stderr.write(`本机 Trae 登录号在池:\n${rowLine(row)}\n`)
  return 0
}

async function runSwitch(options: {
  target: string
  dryRun: boolean
  force: boolean
  json: boolean
}): Promise<number> {
  const rows = await db
    .select()
    .from(aiRelayAccountPool)
    .where(eq(aiRelayAccountPool.providerCode, 'trae'))
  const t = options.target.trim()
  let hit = rows.filter((r) => r.uid === t)
  if (hit.length === 0) hit = rows.filter((r) => r.name === t)
  if (hit.length === 0) hit = rows.filter((r) => r.name.includes(t))
  if (hit.length === 0) {
    process.stderr.write(`❌ 池内没有匹配 "${t}" 的 Trae 账号(--list 查看全部)\n`)
    return 1
  }
  const uids = [...new Set(hit.map((r) => r.uid))]
  if (uids.length > 1) {
    process.stderr.write(`❌ "${t}" 命中多枚号,请用 uid 精确指定:\n`)
    for (const r of hit) process.stderr.write(`  uid=${r.uid} 名称=${r.name}\n`)
    return 1
  }
  // 同 uid 多归属行(运营池/个人池并存)取最近更新的一枚
  hit.sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
  const row = hit[0]
  if (!row) {
    process.stderr.write(`❌ 匹配集为空(未判定)\n`)
    return 2
  }

  let token = ''
  try {
    token = row.tokenEnc ? decryptField(row.tokenEnc) : ''
  } catch {
    token = ''
  }
  if (!token) {
    process.stderr.write(`❌ uid=${row.uid} 的 token 密文解不出(密钥轮换/坏档?),切不了\n`)
    return 1
  }
  let refreshToken: string | null = null
  try {
    if (row.refreshTokenEnc) refreshToken = decryptField(row.refreshTokenEnc)
  } catch {
    refreshToken = null
  }
  let secrets: Record<string, unknown> | null = null
  try {
    if (row.secretsEnc) {
      const parsed = JSON.parse(decryptField(row.secretsEnc))
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) secrets = parsed
    }
  } catch {
    secrets = null
  }
  const profile =
    secrets?.profile && typeof secrets.profile === 'object' && !Array.isArray(secrets.profile)
      ? (secrets.profile as Record<string, unknown>)
      : null
  const deviceKeyPem = typeof secrets?.deviceKeyPem === 'string' ? secrets.deviceKeyPem : ''
  const devicePubPem = typeof secrets?.devicePubPem === 'string' ? secrets.devicePubPem : ''
  const device =
    row.deviceId && deviceKeyPem && devicePubPem
      ? { deviceId: row.deviceId, deviceKeyPem, devicePubPem }
      : null

  const userInfo = sw.buildClientUserInfo({
    uid: row.uid,
    token,
    refreshToken,
    tokenExpiresAt: row.tokenExpiresAt,
    refreshExpiresAt: row.refreshExpiresAt,
    name: row.name,
    lastRefreshAt: row.lastRefreshAt,
    updatedAt: row.updatedAt,
    profile,
  })

  const storageFile = sw.findStorageFile()
  if (!storageFile) {
    process.stderr.write('❌ 本机未找到 Trae storage.json(客户端没装/没登录过?未判定)\n')
    return 2
  }
  const warn: string[] = []
  if (!profile) warn.push('无档案快照 ⇒ host/区域等用兜底值,客户端首刷后自动回灌真档案')
  if (!device) warn.push('无设备材料 ⇒ 不写 icube-dc 键,沿用现机设备档(池侧续期走旧通道)')

  if (options.dryRun) {
    process.stderr.write(
      `[dry-run] 计划写回: uid=${row.uid} 名称=${row.name} 健康=${row.healthStatus}` +
        ` token到期=${fmt(row.tokenExpiresAt)} rt到期=${fmt(row.refreshExpiresAt)}` +
        ` 设备=${device ? '有' : '无'} 档案=${profile ? '有' : '无'} 目标=${storageFile}\n`,
    )
    for (const w of warn) process.stderr.write(`  ⚠️ ${w}\n`)
    return 0
  }

  if (sw.isTraeRunning() && !options.force) {
    process.stderr.write(
      '❌ Trae 客户端正在运行 —— 它退出时会用内存态覆盖 storage.json,先完全退出 Trae 再切;\n' +
        '   或加 --force 由脚本强杀(taskkill /IM "Trae CN.exe" /F /T)后写回。\n',
    )
    return 1
  }
  if (sw.isTraeRunning()) {
    sw.killTrae()
    await sleep(1500) // 等落盘静默,避免退出竞态覆盖
  }

  let store: Record<string, unknown>
  try {
    store = JSON.parse(fs.readFileSync(storageFile, 'utf8'))
  } catch (e) {
    process.stderr.write(
      `❌ 读 storage.json 失败(未判定): ${e instanceof Error ? e.message : String(e)}\n`,
    )
    return 2
  }
  const { next, changed } = sw.buildStoragePatch(store, { userInfo, device })
  const backup = sw.writeStorageAtomic(storageFile, next)

  // 写后回读自证:信封能解开、token/userId 与池行一致才算成功
  let verified = false
  try {
    const after = JSON.parse(fs.readFileSync(storageFile, 'utf8'))
    const back = JSON.parse(ex.decryptEnvelope(after[sw.AUTH_KEY]))
    verified = back?.token === token && String(back?.userId) === String(row.uid)
  } catch {
    verified = false
  }
  if (!verified) {
    process.stderr.write(`❌ 写后回读校验失败(备份在 ${backup},可手工还原)\n`)
    return 1
  }
  if (options.json) {
    process.stdout.write(
      `${JSON.stringify({ ok: true, uid: row.uid, name: row.name, storageFile, backup, changedKeys: changed })}\n`,
    )
    return 0
  }
  process.stderr.write(
    `✅ 已切号: uid=${row.uid} 名称=${row.name} token到期=${fmt(row.tokenExpiresAt)} 备份=${backup}\n`,
  )
  for (const w of warn) process.stderr.write(`  ⚠️ ${w}\n`)
  process.stderr.write(
    '   重启 Trae 即以该号登录;离机的原登录号由号池 client-first 兜底保活(每 5 分钟扫,过期自动续)。\n' +
      '   本机新会话票每 10 分钟由 worker 自动回灌进池(sync-trae-client-session)。\n',
  )
  return 0
}

export async function main(argv: string[]): Promise<number> {
  const options = sw.parseArgs(argv)
  if (options.error) {
    process.stderr.write(`❌ ${options.error}\n`)
    return 2
  }
  if (options.help) {
    process.stdout.write(
      '用法: pnpm tsx apps/api/scripts/relay-trae-client-switch.ts --list|--current|--to <uid|名称> [--dry-run] [--force] [--json]\n' +
        '把号池里的 Trae 账号写回本机 Trae 客户端登录态(一键切号;日常入口 = node scripts/switch-trae-client-account.mjs)。\n',
    )
    return 0
  }
  try {
    if (options.mode === 'list') return await runList(options.json)
    if (options.mode === 'current') return await runCurrent(options.json)
    return await runSwitch(options)
  } catch (e) {
    process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
    return 1
  }
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
