// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 一键切号·携带对话 —— 把号池里任意 Trae 账号写回本机客户端,并把本机此前登录号的
 * 对话记录(正库 + global/workspace state.vscdb + storage.json + conversation-tips)
 * 整体重绑到目标号名下,切完打开客户端即可接着旧号的对话聊(2026-10-30 立)。
 *
 * 与 relay-trae-client-switch.ts 的分工(§0.6):那条链只管登录态信封;
 * 本脚本 = 信封切号 + "对话随行"编排。判据与写盘原语 import:
 *   scripts/lib/trae-client-switch.mjs(信封重建/原子写/找文件)
 *   scripts/lib/trae-sqlcipher.mjs(正库解密/重加密/自证 —— 取证实证见其头注)
 *   scripts/lib/trae-chat-carry.mjs(四处账号绑定面重绑的纯操作)
 * 号池取数/解密沿用 client-switch 的同一段(直连库,只输脱敏面)。
 *
 * 模式:--to <uid|名称> [--dry-run] [--force] [--no-launch] [--json]
 * 退出码:0 成功(dry-run 亦 0)/ 1 业务失败(已尽力回滚,回滚明细在报告里)/ 2 未判定
 * (参数错、本机无客户端、池行解不出、在跑又没 --force)。
 * 安全:任何输出不含凭据明文;正库写回前整文件备份,失败逐件还原。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { config as dotenvConfig } from 'dotenv'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const API_DIR = path.resolve(SCRIPT_DIR, '..')
const ROOT = path.resolve(API_DIR, '..', '..')
dotenvConfig({ path: path.resolve(API_DIR, '.env') })

const sw = await import(
  pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'trae-client-switch.mjs')).href
)
const carry = await import(
  pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'trae-chat-carry.mjs')).href
)
const proc = await import(
  pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'trae-client-process.mjs')).href
)
const ex = await import(
  pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'trae-auth-extract.mjs')).href
)

const { eq } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
const { decryptField } = await import('../src/utils/crypto.js')
const { db } = await import('../src/db/index.js')
const { setTimeout: sleep } = await import('node:timers/promises')

interface Args {
  target: string
  dryRun: boolean
  force: boolean
  noLaunch: boolean
  json: boolean
  help: boolean
  error: string | null
}

function parseArgs(argv: string[]): Args {
  const o: Args = {
    target: '',
    dryRun: false,
    force: false,
    noLaunch: false,
    json: false,
    help: false,
    error: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--to') {
      const v = argv[++i]
      if (!v || v.startsWith('--')) {
        o.error = '--to 需要 <uid 或 名称>'
        break
      }
      o.target = v
    } else if (a === '--dry-run') o.dryRun = true
    else if (a === '--force') o.force = true
    else if (a === '--no-launch') o.noLaunch = true
    else if (a === '--json') o.json = true
    else if (a === '--help' || a === '-h') o.help = true
    else o.error = `未知参数: ${a}`
  }
  if (!o.error && !o.help && !o.target) o.error = '缺少 --to <uid|名称>'
  return o
}

async function pickPoolRow(target: string) {
  const rows = await db
    .select()
    .from(aiRelayAccountPool)
    .where(eq(aiRelayAccountPool.providerCode, 'trae'))
  const t = target.trim()
  let hit = rows.filter((r) => r.uid === t)
  if (hit.length === 0) hit = rows.filter((r) => r.name === t)
  if (hit.length === 0) hit = rows.filter((r) => r.name.includes(t))
  if (hit.length === 0) return { error: `池内没有匹配 "${t}" 的 Trae 账号(--list 查看全部)` }
  const uids = [...new Set(hit.map((r) => r.uid))]
  if (uids.length > 1) return { error: `"${t}" 命中多枚号,请用 uid 精确指定` }
  hit.sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
  return { row: hit[0] }
}

/** 池行 → 切号参数(token/rt/profile/device;与 client-switch 同判据面) */
function decodePoolRow(row: any) {
  let token = ''
  try {
    token = row.tokenEnc ? decryptField(row.tokenEnc) : ''
  } catch {
    token = ''
  }
  if (!token) return { error: `uid=${row.uid} 的 token 密文解不出(密钥轮换/坏档?)` }
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
  return { token, refreshToken, profile, device }
}

export async function main(argv: string[]): Promise<number> {
  const o = parseArgs(argv)
  if (o.error) {
    process.stderr.write(`❌ ${o.error}\n`)
    return 2
  }
  if (o.help) {
    process.stdout.write(
      '用法: pnpm trae:chat-switch --to <uid|名称> [--dry-run] [--force] [--no-launch] [--json]\n' +
        '把池号写回本机 Trae 登录态,并把旧登录号的对话记录重绑到该号(切号携带对话)。\n',
    )
    return 0
  }

  const picked = await pickPoolRow(o.target)
  if (picked.error) {
    process.stderr.write(`❌ ${picked.error}\n`)
    return 1
  }
  const row = picked.row!
  const dec = decodePoolRow(row)
  if (dec.error) {
    process.stderr.write(`❌ ${dec.error}\n`)
    return 1
  }

  const storageFile = sw.findStorageFile()
  if (!storageFile) {
    process.stderr.write('❌ 本机未找到 Trae storage.json(未判定)\n')
    return 2
  }
  const userDataDir = path.dirname(path.dirname(path.dirname(storageFile))) // ...\Trae CN
  const newUid = String(row.uid)

  // 旧登录号:读当前信封(只取 uid,不输其他)
  let oldUid: string | null = null
  try {
    const beforeTxt = fs.readFileSync(storageFile, 'utf8')
    const before = JSON.parse(beforeTxt)
    oldUid = carry.userIdFromUserInfo(
      JSON.parse(ex.decryptEnvelope(String(before[sw.AUTH_KEY] ?? ''))),
    )
  } catch {
    oldUid = null
  }

  const steps: string[] = []
  const report: Record<string, unknown> = {
    target: { uid: newUid, name: row.name },
    oldUid,
    dryRun: o.dryRun,
    steps,
  }

  if (oldUid && oldUid === newUid) {
    // 本机已经登着目标号:对话本来就在名下,无事可做(不重加密、不折腾文件)
    steps.push('noop-same-account')
    report.outcome = 'unchanged'
    process.stdout.write(`${JSON.stringify(report)}\n`)
    return 0
  }

  if (!oldUid) {
    steps.push('warn-no-local-uid(读不到当前信封 ⇒ 只切登录态,不做对话重绑)')
  }

  if (o.dryRun) {
    report.plan = {
      rebindingFrom: oldUid ?? null,
      rebindingTo: newUid,
      userDataDir,
      agentDb: carry.locateAgentDatabase(userDataDir),
      willCloseClient: !o.noLaunch,
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    return 0
  }

  if (sw.isTraeRunning() && !o.force) {
    process.stderr.write('❌ Trae 正在运行 —— 先完全退出,或 --force 由本器代关(按 pid 逐个关)。\n')
    return 2
  }

  const backups: string[] = []
  const restored: string[] = []
  const fail = async (msg: string, code = 1): Promise<number> => {
    process.stderr.write(`❌ ${msg}(备份文件 ${backups.length} 份,尝试还原…)\n`)
    for (const bak of backups) {
      const target = bak.replace(/\.(pre-carry|pre-switch)\.bak$/, '')
      try {
        fs.copyFileSync(bak, target)
        restored.push(target)
      } catch {
        /* 单个还原失败继续下一个 */
      }
    }
    report.rollback = { backups, restored }
    report.outcome = 'failed-rolled-back'
    process.stdout.write(`${JSON.stringify(report)}\n`)
    return code
  }

  // ① 关端(在跑且 --force)
  if (sw.isTraeRunning()) {
    sw.killTrae()
    await sleep(2000)
    steps.push('client-closed')
  }

  // ② 切登录信封(先做,失败面小;原子写自带 .pre-switch.bak)
  let store: Record<string, unknown>
  try {
    store = JSON.parse(fs.readFileSync(storageFile, 'utf8'))
    backups.push(`${storageFile}.pre-switch.bak`)
  } catch (e) {
    return fail(`读 storage.json 失败: ${String(e)}`, 2)
  }
  let userInfo: Record<string, unknown>
  try {
    userInfo = sw.buildClientUserInfo({
      uid: newUid,
      token: dec.token,
      refreshToken: dec.refreshToken,
      tokenExpiresAt: row.tokenExpiresAt,
      refreshExpiresAt: row.refreshExpiresAt,
      name: row.name,
      profile: dec.profile,
      lastRefreshAt: row.lastRefreshAt,
      updatedAt: row.updatedAt,
    })
  } catch (e) {
    return fail(`重建客户端 userInfo 失败: ${String(e)}`)
  }
  const patch = sw.buildStoragePatch(store, { userInfo, device: dec.device })

  // ③ 对话重绑(仅在拿得到 oldUid 时):先做 vscdb/tips(可单件回滚),再做正库(最重的一步)
  if (oldUid) {
    const gs = path.join(userDataDir, 'User', 'globalStorage')
    const ws = path.join(userDataDir, 'User', 'workspaceStorage')
    try {
      const g = carry.rebindVscdb(path.join(gs, 'state.vscdb'), oldUid, newUid)
      const w = fs.existsSync(ws)
        ? fs
            .readdirSync(ws)
            .map((d) => path.join(ws, d, 'state.vscdb'))
            .filter((f) => fs.existsSync(f))
            .map((f) => carry.rebindVscdb(f, oldUid, newUid))
            .reduce(
              (a, b) => ({
                renamed: a.renamed + b.renamed,
                collisions: a.collisions + b.collisions,
              }),
              { renamed: 0, collisions: 0 },
            )
        : { renamed: 0, collisions: 0 }
      report.vscdb = { global: g, workspace: w }
      steps.push('rebind-vscdb')

      const tips = carry.planTipsRenames(userDataDir, oldUid, newUid)
      for (const { from, to } of tips) {
        const bak = `${from}.pre-carry.bak`
        fs.copyFileSync(from, bak)
        backups.push(bak)
        fs.renameSync(from, to)
      }
      report.tipsRenamed = tips.length

      const patched = carry.rebindStorageJson(patch.next as Record<string, unknown>, oldUid, newUid)
      for (const a of patched.actions)
        if (a.kind === 'envelope-uid-rebind') steps.push('rebind-envelope-uid')
      Object.assign(patch.next, patched.next)
    } catch (e) {
      return fail(`状态重绑失败: ${String(e)}`)
    }
  }

  // ④ 正库(SQLCipher):解密 → 重绑 → 重加密 → 自证 → 原子写回(全链走 lib 单源)
  const dbFile = carry.locateAgentDatabase(userDataDir)
  if (dbFile && oldUid) {
    steps.push('agent-db-found')
    try {
      const exe = proc.resolveProductExe(path.basename(userDataDir))
      const exePath = typeof exe === 'string' ? exe : ((exe as { path?: string })?.path ?? '')
      const dllCandidates = [
        exePath
          ? path.join(
              path.dirname(exePath),
              'resources',
              'app',
              'modules',
              'ai-agent',
              'ai_agent.dll',
            )
          : '',
        path.join(
          process.env.LOCALAPPDATA ?? '',
          'Programs',
          path.basename(userDataDir),
          'resources',
          'app',
          'modules',
          'ai-agent',
          'ai_agent.dll',
        ),
      ]
      const dllPath = dllCandidates.find((f) => f && fs.existsSync(f)) ?? ''
      const res = await carry.rebindAgentDbFile(dbFile, {
        oldUid,
        newUid,
        dllPath,
        write: true,
        backupDir: path.join(
          path.dirname(storageFile),
          '..',
          '..',
          'carry-backups',
          String(Date.now()),
        ),
      })
      report.agentDb = res
      steps.push('rebind-agent-db:selfcheck-pass')
    } catch (e) {
      return fail(`正库迁移失败: ${String(e)}`)
    }
  } else if (!dbFile) {
    steps.push('warn-no-agent-db(本机没装过对话?跳过正库)')
  }

  // ⑤ 信封落盘(所有自证过了才写)
  const backup = sw.writeStorageAtomic(storageFile, patch.next as Record<string, unknown>)
  report.storageBackup = backup
  try {
    const after = JSON.parse(fs.readFileSync(storageFile, 'utf8'))
    const back = JSON.parse(ex.decryptEnvelope(after[sw.AUTH_KEY]))
    if (String(back?.userId) !== newUid) return fail('写后回读:信封 userId 与目标号不符')
    steps.push('storage-verified')
  } catch (e) {
    return fail(`写后回读校验失败: ${String(e)}(备份 ${backup})`)
  }

  // ⑥ 拉起客户端
  report.outcome = 'carried'
  if (!o.noLaunch) {
    const exe = proc.resolveProductExe(path.basename(userDataDir))
    const exePath = typeof exe === 'string' ? exe : (exe?.path ?? '')
    const launched = exePath
      ? proc.launchProduct(exePath, { product: path.basename(userDataDir) })
      : { launched: false, error: '无 exe 路径' }
    report.launch = launched
    steps.push(launched.launched ? 'client-relaunched' : 'launch-failed')
  }
  process.stdout.write(`${JSON.stringify(report)}\n`)
  process.stderr.write(
    `✅ 已切号并携带对话: 旧 uid=${oldUid ?? '未读到'} → 新 uid=${newUid} 名称=${row.name}\n`,
  )
  if (!o.noLaunch && !(report.launch as any)?.launched) {
    process.stderr.write('   ⚠️ 客户端没能自动拉起,手工打开 Trae 即生效。\n')
  }
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(
        `❌ ${e instanceof Error ? e.message : String(e)}\n${e instanceof Error ? e.stack : ''}`,
      )
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
