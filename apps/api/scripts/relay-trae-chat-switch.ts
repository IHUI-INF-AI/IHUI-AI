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
 * 模式:--to <uid|名称> [--owner <ops|前缀≥8位>] [--product <Trae CN|TRAE SOLO CN|Trae>]
 *       [--dry-run] [--force] [--no-launch] [--json]
 * 退出码:0 成功(dry-run 亦 0)/ 1 业务失败(无匹配、目标串命中多枚号、同 uid 多持有者未定向、
 * 已尽力回滚 —— 回滚明细在报告里)/ 2 未判定
 * (参数错、本机无客户端、池行解不出、在跑又没 --force)。
 * 多持有者(同 uid 的运营池行 + 个人池行,号池去重键允许并存)**不给结论只给定向**,判据在
 * scripts/lib/trae-client-switch.mjs 的 pickPoolCandidates(与 client-switch 腿同一枚实现)。
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
  owner: string
  product: string
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
    owner: '',
    product: '',
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
    } else if (a === '--owner') {
      // 定向开关:同 uid 多持有者(运营池 + 个人池并存)时指明切哪一池;判据在 lib,本层不重抄
      const v = argv[++i]
      if (!v || v.startsWith('--')) {
        o.error = String(sw.OWNER_SELECTOR_USAGE)
        break
      }
      o.owner = v
    } else if (a === '--product') {
      const v = argv[++i]
      if (!v || v.startsWith('--')) {
        o.error = '--product 需要 <Trae CN | TRAE SOLO CN | Trae>(缺省 = 自动定位现役那份)'
        break
      }
      const known = (proc.TRAE_PRODUCTS as readonly string[]).find(
        (p) => p.toLowerCase() === v.trim().toLowerCase(),
      )
      if (!known) {
        o.error = `--product 不认识:${v}(可用:${proc.TRAE_PRODUCTS.join(' / ')})`
        break
      }
      o.product = known
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

/**
 * 目标串 → 池行候选(判据单源 = sw.pickPoolCandidates;本层只负责取数,不再自己挑一枚)。
 * 号池去重键是 (owner_user_id, provider_code, uid),同 uid 双持有者合法并存 ⇒ 命中 >1 行
 * 一律返回具名歧义,由调用方打印"这一 uid 有两个持有者"与定向后的下一步命令。
 */
async function pickPoolRow(target: string, owner: string) {
  const rows = await db
    .select()
    .from(aiRelayAccountPool)
    .where(eq(aiRelayAccountPool.providerCode, 'trae'))
  return sw.pickPoolCandidates(rows, target, { owner })
}

/** 多持有者歧义的具名结论:人类面逐行 stderr,机读面报告由调用方写 stdout(判据与措辞单源在 lib) */
function ambiguityOutput(picked: { candidates: Array<Record<string, unknown>> }, target: string) {
  const notice = sw.ambiguousOwnerNotice(target, picked.candidates, {
    entry: 'node scripts/switch-trae-client-with-chat.mjs',
  })
  for (const line of notice.printLines) process.stderr.write(`${line}\n`)
  return {
    outcome: 'ambiguous-owner',
    matched: String(target),
    holderCount: picked.candidates.length,
    holders: notice.holders,
    nextCommands: notice.commands,
    steps: ['abort-ambiguous-owner'],
  }
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
  // 会话模板(采集时的整份 userInfo 去凭证):profile 缺失时写回端的账号档案基底(2026-11-11 立)
  const sessionTemplate =
    secrets?.sessionTemplate &&
    typeof secrets.sessionTemplate === 'object' &&
    !Array.isArray(secrets.sessionTemplate)
      ? (secrets.sessionTemplate as Record<string, unknown>)
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
      '用法: pnpm tsx apps/api/scripts/relay-trae-chat-switch.ts --to <uid|名称> [--owner <ops|owner 前缀≥8位>] [--product <Trae CN|TRAE SOLO CN|Trae>] [--dry-run] [--force] [--no-launch] [--json]\n' +
        '把池号写回本机客户端登录态,并把旧登录号(该产品面)的对话记录重绑到该号(切号携带对话;日常入口 = node scripts/switch-trae-client-with-chat.mjs)。\n' +
        '  --owner  同一 uid 在池里有两个合法持有者(运营池 + 个人池)时定向用;不定向 ⇒ 具名歧义、不写任何文件。\n',
    )
    return 0
  }

  const picked = await pickPoolRow(o.target, o.owner)
  if (picked.decision === 'bad-owner-selector') {
    // 参数面错误与 --to 缺参同档(未判定 = 2),绝不"当作没给定向"继续跑
    process.stderr.write(`❌ ${picked.error}\n`)
    return 2
  }
  if (picked.decision === 'not-found') {
    process.stderr.write(
      `❌ 池内没有匹配 "${o.target.trim()}" 的 Trae 账号${picked.scopeNote ?? ''}(--list 查看全部)\n`,
    )
    return 1
  }
  if (picked.decision === 'ambiguous-uid') {
    process.stderr.write(`❌ "${o.target.trim()}" 命中多枚号,请用 uid 精确指定:\n`)
    for (const r of picked.candidates) process.stderr.write(`  ${sw.describePoolCandidate(r)}\n`)
    return 1
  }
  if (picked.decision === 'ambiguous-owner') {
    // 同 uid 双持有者:给"多要一次定向说明",不是给一个看起来已经办成的结论
    process.stdout.write(`${JSON.stringify(ambiguityOutput(picked, o.target))}\n`)
    return 1
  }
  const row = picked.row
  const dec = decodePoolRow(row)
  if (dec.error) {
    process.stderr.write(`❌ ${dec.error}\n`)
    return 1
  }

  const storageFile = o.product ? sw.findStorageFileForProduct(o.product) : sw.findStorageFile()
  if (!storageFile) {
    process.stderr.write('❌ 本机未找到 Trae storage.json(未判定)\n')
    return 2
  }
  const userDataDir = path.dirname(path.dirname(path.dirname(storageFile)))
  const product =
    o.product || proc.productOfDir(path.basename(userDataDir)) || path.basename(userDataDir)
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
    // holder 一栏 = 这一枚池行的持有者(脱敏);候选唯一才走到这里,见 pickPoolRow
    target: { uid: newUid, name: row.name, holder: sw.describePoolOwner(row) },
    holderCount: picked.candidates.length,
    oldUid,
    dryRun: o.dryRun,
    steps,
  }

  const planBlock = {
    product,
    rebindingFrom: oldUid ?? null,
    rebindingTo: newUid,
    userDataDir,
    agentDb: carry.locateAgentDatabase(userDataDir),
    storageFile,
    willCloseClient: !o.noLaunch,
  }

  // noop 的合法含义 = 候选唯一 ∧ 确为当前在用那枚(判据单源 = sw.narrowByCurrentAccount)
  const decided = sw.narrowByCurrentAccount(picked, oldUid)
  if (decided.decision === 'same-account') {
    // 该客户端已登着目标号:对话本来就在名下,无事可做(不重加密、不折腾文件)
    // 注:产品面是 per-client 的 —— SOLO 与 Trae CN 各自判各自的登录态,互不顶替。
    steps.push('noop-same-account')
    report.outcome = 'unchanged'
    report.plan = planBlock
    process.stdout.write(`${JSON.stringify(report)}\n`)
    return 0
  }

  if (!oldUid) {
    steps.push('warn-no-local-uid(读不到当前信封 ⇒ 只切登录态,不做对话重绑)')
  }

  if (o.dryRun) {
    report.plan = planBlock
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    return 0
  }

  const runningPids = sw.isProductRunning(product)
  if (runningPids === null) {
    process.stderr.write(
      `❌ 查不到 ${product} 的进程面(tasklist 失败)⇒ 未判定;不能确认客户端是否正在跑,拒绝写回(它退出时会用内存态覆盖)\n`,
    )
    return 2
  }
  if (runningPids.length > 0 && !o.force) {
    process.stderr.write(
      `❌ ${product} 正在运行(${runningPids.length} 个进程)—— 先完全退出,或 --force 由本器代关(按 pid 逐个关)。\n`,
    )
    return 2
  }

  /**
   * 备份日志(2026-11-10 修缺陷 1/2/4):每轮一个 `carry-backups/<runId>/` 目录。
   * 与老固定后缀的区别:
   *   - vscdb / 正库 / storage.json / tips 全部在**写前**入账 ⇒ 写坏了能整组还原
   *     (老代码只把 storage.json 与 database.db 塞进 backups[],vscdb 纯裸写);
   *   - runId 隔离 ⇒ 第二轮失败不会覆盖第一轮的"切前态"(老 .pre-carry.bak 会被下一轮顶掉);
   *   - SQLite 伴生 -wal/-shm 同进同出 ⇒ 不会出现"还原主库 + 留一截新 WAL"的坏库。
   */
  const journal = carry.createCarryJournal({
    backupRoot: path.join(userDataDir, 'carry-backups'),
    root: userDataDir,
  })
  report.runId = journal.runId
  report.backupDir = journal.dir
  const fail = async (msg: string, code = 1): Promise<number> => {
    process.stderr.write(`❌ ${msg}(备份 ${journal.count()} 份,尝试还原…)\n`)
    const res = journal.restore()
    // backups/restored 的字段形状保持不变(数组元素仍是路径字符串);新增项都是可加字段
    report.rollback = {
      backups: journal.backupPaths(),
      restored: res.restored,
      removed: res.removed,
      failedRestores: res.failed,
      renames: journal.renames(),
      runId: journal.runId,
    }
    report.outcome = 'failed-rolled-back'
    process.stdout.write(`${JSON.stringify(report)}\n`)
    return code
  }

  /**
   * 关端前先抓 exe 路径并缓存:客户端一关,resolveProductExe 就查不到进程路径了
   * (它靠 CIM 读运行中进程的 ExecutablePath)。而正库段的 dll 定位需要它做首选候选。
   * 这一步零成本,却是本机 `no-dll` 的根治点之一。
   */
  let preCloseExePath = ''
  try {
    const probe = proc.resolveProductExe(product)
    preCloseExePath = typeof probe === 'string' ? probe : ((probe as { path?: string })?.path ?? '')
  } catch {
    preCloseExePath = ''
  }

  // ① 关端(在跑且 --force)
  if (runningPids.length > 0) {
    const closed = proc.closeProduct(product, { pids: runningPids })
    if (!closed.closed)
      return fail(`代关 ${product} 未成功:${JSON.stringify(closed).slice(0, 160)}`, 2)
    await sleep(2000)
    steps.push('client-closed')
  }

  // ② 切登录信封(先做,失败面小;原子写自带 .pre-switch.bak,我们另在写前把原件入账)
  let store: Record<string, unknown>
  try {
    store = JSON.parse(fs.readFileSync(storageFile, 'utf8'))
    journal.backup(storageFile)
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
      sessionTemplate: dec.sessionTemplate,
      lastRefreshAt: row.lastRefreshAt,
      updatedAt: row.updatedAt,
    })
  } catch (e) {
    return fail(`重建客户端 userInfo 失败: ${String(e)}`)
  }
  const patch = sw.buildStoragePatch(store, { userInfo, device: dec.device })

  // ③ 对话重绑(仅在拿得到 oldUid 时):先做 vscdb/tips(可单件回滚),再做正库(最重的一步)
  const vscdbLeftover = { files: 0, leftoverOldKeys: 0 }
  if (oldUid) {
    const gs = path.join(userDataDir, 'User', 'globalStorage')
    const ws = path.join(userDataDir, 'User', 'workspaceStorage')
    try {
      // 缺陷 1:vscdb 此前是"原地写、无备份",写坏只能靠外部手拍 —— 现在每个文件写前入账
      // (文件不存在时 backup 只记一笔"回滚要删",免得 DatabaseSync 顺手造出的空库留下来)
      const gsFile = path.join(gs, 'state.vscdb')
      journal.backup(gsFile)
      const g = carry.rebindVscdb(gsFile, oldUid, newUid)
      const wsFiles = fs.existsSync(ws)
        ? fs
            .readdirSync(ws)
            .map((d) => path.join(ws, d, 'state.vscdb'))
            .filter((f) => fs.existsSync(f))
        : []
      const wsResults = wsFiles.map((f) => {
        journal.backup(f)
        return carry.rebindVscdb(f, oldUid, newUid)
      })
      const w = wsResults.reduce(
        (a, b) => ({
          renamed: a.renamed + b.renamed,
          collisions: a.collisions + b.collisions,
        }),
        { renamed: 0, collisions: 0 },
      )
      vscdbLeftover.files = 1 + wsFiles.length
      vscdbLeftover.leftoverOldKeys =
        Number(g.leftoverOldKeys ?? 0) + wsResults.reduce((a, b) => a + Number(b.leftoverOldKeys ?? 0), 0)
      report.vscdb = { global: g, workspace: w, leftoverOldKeys: vscdbLeftover.leftoverOldKeys }
      steps.push('rebind-vscdb')

      const tips = carry.planTipsRenames(userDataDir, oldUid, newUid)
      let tipsRenamed = 0
      for (const { from, to } of tips) {
        if (from === to) continue
        journal.backup(from)
        // 新名切前就在 ⇒ 也得留一份,回滚时还原它而不是删它(缺陷 3 的边界)
        const preExisted = fs.existsSync(to)
        if (preExisted) journal.backup(to)
        journal.recordRename(from, to, { preExisted })
        fs.renameSync(from, to)
        tipsRenamed += 1
      }
      report.tipsRenamed = tipsRenamed

      const patched = carry.rebindStorageJson(patch.next as Record<string, unknown>, oldUid, newUid)
      for (const a of patched.actions)
        if (a.kind === 'envelope-uid-rebind') steps.push('rebind-envelope-uid')
      Object.assign(patch.next, patched.next)
    } catch (e) {
      // 缺陷 5 的显式档:vscdb 改完仍有旧 uid 键 ⇒ 具名 leftover-uid 并进 fail 流程
      if ((e as { code?: string })?.code === 'leftover-uid') {
        steps.push('abort-leftover-uid')
        return fail(`leftover-uid 断言失败: ${String(e)}`)
      }
      return fail(`状态重绑失败: ${String(e)}`)
    }
  }

  // ④ 正库(SQLCipher):解密 → 重绑 → 重加密 → 自证 → 原子写回(全链走 lib 单源)
  const dbFile = carry.locateAgentDatabase(userDataDir)
  if (dbFile && oldUid) {
    steps.push('agent-db-found')
    try {
      const exe = preCloseExePath
      const exePath = exe
      /**
       * 2026-11-10 修:不能再只靠 exe 目录推 dll —— 正库段在客户端**已关闭之后**才跑,
       * 那时 resolveProductExe 查不到进程路径(本机装在 G:\Trae CN,返回 '')⇒ no-dll ⇒ 整链回滚。
       * 改走 `locateAgentDll`:从 userDataDir 逐级向上反推安装根,与进程无关。
       * exePath 只在前置缓存命中时才有值(关端前抓的),仍作首选。
       */
      const dllPath = carry.locateAgentDll({
        product,
        userDataDir,
        exePath,
        env: process.env,
      })
      if (!dllPath) {
        return fail(
          `找不到 ai_agent.dll(正库密钥材料):userDataDir=${userDataDir} / exe=${exePath || '(空)'}。` +
            '请确认客户端安装完整(resources/app/modules/ai-agent/ai_agent.dll 存在)',
        )
      }
      steps.push('agent-dll-found')
      const res = await carry.rebindAgentDbFile(dbFile, {
        oldUid,
        newUid,
        dllPath,
        write: true,
        // 缺陷 4:正库原件与伴生 -wal/-shm 在写前进同一本日志 ⇒ 失败时与 storage.json/vscdb 一起还原
        journal,
      })
      report.agentDb = res
      report.serverHistoryInfoUserId = res.serverHistoryInfo
      report.leftoverCheck = {
        db: res.leftovers?.checked ?? [],
        dbLeftovers: res.leftovers?.leftovers ?? [],
        vscdb: vscdbLeftover,
        // uidCols 之外仍带旧号的表只报不改(model_config_cache 这类"缓存"面,不属对话正文)
        otherUidTables: res.otherUidTables ?? [],
      }
      steps.push('rebind-agent-db:selfcheck-pass')
      steps.push('assert-no-leftover-uid')
      if (res.serverHistoryInfo?.decision === 'left-untouched') {
        // 判据:该列客户端从不填、也不据此过滤本地历史 ⇒ 全 NULL 保持原样,不做 NULL 归并
        steps.push('skip-server-history-user-null(客户端不据此过滤)')
      } else if (res.rebound?.['server_history_info:null-merge']) {
        steps.push('rebind-server-history-null-merge')
      }
    } catch (e) {
      if ((e as { code?: string })?.code === 'leftover-uid') {
        steps.push('abort-leftover-uid')
        return fail(`leftover-uid 断言失败: ${String(e)}`)
      }
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
    const exe = proc.resolveProductExe(product)
    const exePath = typeof exe === 'string' ? exe : (exe?.path ?? '')
    const launched = exePath
      ? proc.launchProduct(exePath, { product })
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
