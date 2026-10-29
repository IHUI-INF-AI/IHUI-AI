// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 一键切号 —— 把号池里任意 Trae 账号写回本机 Trae 客户端的登录态(纯本机操作面)。
 *
 * 立因(2026-10-28):机主要求"随时保活 + 一键切号"——本机 Trae 登的号必须在池里活着,
 * 且能把池里任意一枚号原样写回客户端。保活链路(worker sweep + trae-session-sync 回灌)
 * 已在跑,本模块只补"写回"这一端:用回灌时存进 secretsEnc 的档案快照(profile)重建
 * `iCubeAuthInfo://icube.cloudide` 信封,原子写进 storage.json。
 *
 * 分工(§0.6 单一判据源):本文件只做纯函数 + 本机文件/进程操作,不连库不发网络;
 * 号池取数与解密在 apps/api/scripts/relay-trae-client-switch.ts(tsx)。
 *
 * 客户端进程纪律:"Trae CN.exe" 退出时会用内存态覆盖 storage.json ⇒
 * 写回前必须先杀掉客户端(脚本默认拒绝在客户端运行时写,--force 才代杀)。
 *
 * 安全:任何返回值/错误信息不含凭据明文;写前留 `.pre-switch.bak` 备份。
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync, spawnSync } from 'node:child_process'
import { encryptEnvelope, traeUserDataDirs } from './trae-auth-extract.mjs'
// 路径归一的唯一出口(§0.6):本仓"按可执行路径划归属"那把尺住在 desktop-victims.mjs,
// 这里只复用它的 normalizeWinPath,不在第二处再写一遍分隔符/大小写规矩。
import { normalizeWinPath } from './desktop-victims.mjs'

/** storage.json 里 IDE 会话凭据键(与 trae-auth-extract 的 pickAuthEnvelopeKeys 同键面) */
export const AUTH_KEY = 'iCubeAuthInfo://icube.cloudide'
/** 设备证明键前缀:完整键 = 前缀 + deviceId,信封内是 {privateKeyPEM, publicKeyPEM} */
export const DC_KEY_PREFIX = 'iCubeAuthInfo://icube-dc:'
/** 本机 Trae 客户端进程名(Windows,实测 tasklist 口径) */
export const TRAE_PROCESS = 'Trae CN.exe'

export class SwitchError extends Error {
  constructor(message, code = 'switch-failed') {
    super(message)
    this.name = 'SwitchError'
    this.code = code
  }
}

/**
 * 参数面(入口 mjs 与 ts 侧共用这一份,判据不复制第二遍):
 * 模式三选一 --list / --current / --to <uid|名称>;修饰 --dry-run --force --json;--help 短路。
 */
export function parseArgs(argv) {
  const options = {
    mode: null,
    target: '',
    dryRun: false,
    force: false,
    json: false,
    help: false,
    error: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--list' || a === '--current' || a === '--to') {
      const mode = a.slice(2)
      if (options.mode) {
        options.error = `模式互斥:已指定 --${options.mode},又给了 ${a}`
        break
      }
      options.mode = mode
      if (mode === 'to') {
        const v = argv[++i]
        if (!v || v.startsWith('--')) {
          options.error = '--to 需要 <uid 或 名称> 参数'
          break
        }
        options.target = v
      }
    } else if (a === '--dry-run') options.dryRun = true
    else if (a === '--force') options.force = true
    else if (a === '--json') options.json = true
    else if (a === '--help' || a === '-h') options.help = true
    else options.error = `未知参数: ${a}`
  }
  if (!options.error && !options.help && !options.mode) {
    options.error = '缺少模式:--list | --current | --to <uid|名称>'
  }
  return options
}

/** Date/ISO 字符串 → ISO 字符串;解析不出 ⇒ null(写回时"有才写键",不造伪值) */
export function iso(value) {
  if (value === null || value === undefined || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * 池行(已解密)→ 客户端 userInfo 明文。
 * 字段形状 = 客户端自己写进信封的那套(host/userRegion/tokenReleaseAt/account 等),
 * 优先用回灌时存的档案快照 profile;没有快照才走兜底值(切过去的号客户端
 * 首刷后会重新回灌真档案,兜底形状只保证"能登录",不保证区域参数)。
 */
export function buildClientUserInfo(input) {
  const token = typeof input?.token === 'string' ? input.token : ''
  const uid = input?.uid === undefined || input?.uid === null ? '' : String(input.uid)
  if (!token) throw new SwitchError('池内该号缺 access token(密文解不出?)', 'no-token')
  if (!uid) throw new SwitchError('池内该号缺 uid', 'no-uid')
  const p = input.profile && typeof input.profile === 'object' ? input.profile : {}
  const name = typeof input.name === 'string' ? input.name : ''
  const userInfo = {
    token,
    userId: uid,
    host: typeof p.host === 'string' && p.host ? p.host : 'https://api.trae.cn',
    account:
      p.account && typeof p.account === 'object'
        ? p.account
        : { username: name || `trae-${uid.slice(0, 8)}` },
  }
  const refreshToken = typeof input.refreshToken === 'string' ? input.refreshToken : ''
  if (refreshToken) userInfo.refreshToken = refreshToken
  const expiredAt = iso(input.tokenExpiresAt)
  if (expiredAt) userInfo.expiredAt = expiredAt
  const refreshExpiredAt = iso(input.refreshExpiresAt)
  if (refreshExpiredAt) userInfo.refreshExpiredAt = refreshExpiredAt
  if (typeof p.userRegion === 'string' && p.userRegion) userInfo.userRegion = p.userRegion
  const release =
    (typeof p.tokenReleaseAt === 'string' && p.tokenReleaseAt) ||
    iso(input.lastRefreshAt) ||
    iso(input.updatedAt)
  if (release) userInfo.tokenReleaseAt = release
  return userInfo
}

/**
 * storage.json 补丁(纯函数,不改入参):写 AUTH 信封 + 设备齐时写 dc 信封,其余键原样。
 * device = {deviceId, deviceKeyPem, devicePubPem};缺任一项 ⇒ 不动 dc 键(客户端沿用现机设备档)。
 */
export function buildStoragePatch(store, { userInfo, device }) {
  const next = { ...(store || {}) }
  const changed = []
  next[AUTH_KEY] = encryptEnvelope(JSON.stringify(userInfo))
  changed.push(AUTH_KEY)
  if (
    device &&
    typeof device.deviceId === 'string' &&
    device.deviceId &&
    typeof device.deviceKeyPem === 'string' &&
    device.deviceKeyPem &&
    typeof device.devicePubPem === 'string' &&
    device.devicePubPem
  ) {
    const key = DC_KEY_PREFIX + device.deviceId
    next[key] = encryptEnvelope(
      JSON.stringify({ privateKeyPEM: device.deviceKeyPem, publicKeyPEM: device.devicePubPem }),
    )
    changed.push(key)
  }
  return { next, changed }
}

/** 本机 storage.json 落点:traeUserDataDirs 候选序里第一个存在的文件;全无 ⇒ null */
export function findStorageFile(env = process.env, homedir = os.homedir()) {
  for (const dir of traeUserDataDirs(env, homedir)) {
    const file = path.join(dir, 'User', 'globalStorage', 'storage.json')
    if (fs.existsSync(file)) return file
  }
  return null
}

/** 原子写:先备份 .pre-switch.bak,再写临时文件 rename 覆盖;返回备份路径 */
export function writeStorageAtomic(file, store) {
  const bak = `${file}.pre-switch.bak`
  fs.copyFileSync(file, bak)
  const tmp = `${file}.switch-tmp`
  fs.writeFileSync(tmp, JSON.stringify(store), 'utf8')
  fs.renameSync(tmp, file)
  return bak
}

/** 客户端在跑吗(tasklist 按映像名过滤;查询失败按"没在跑"处理,写回前有 existsSync 兜底) */
export function isTraeRunning() {
  try {
    const out = execFileSync('tasklist', ['/FI', `IMAGENAME eq ${TRAE_PROCESS}`, '/NH'], {
      encoding: 'utf8',
      windowsHide: true,
    })
    return out.includes(TRAE_PROCESS)
  } catch {
    return false
  }
}

/** PowerShell 取数腿宿主(与 scripts/desktop-dev-saas.mjs 那条同形;System32 那份恒在) */
const PS_BIN = fs.existsSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe')
  ? 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'
  : 'powershell'

/**
 * 可停实例的归属根 = 本机 Trae 客户端的**安装根**(实测本机存在
 * `C:/Users/<user>/AppData/Local/Programs/Trae CN`,而 `PROGRAMFILES/Trae CN` 不存在 ⇒ 取存在者)。
 * 按可执行路径划归属,而不是按映像名:`taskkill /IM <裸文件名>` 只接受裸文件名 ⇒ 会连全机同名进程
 * 一起杀(§5e-2 删除类动作必须有归属面;本仓为这一型记过误杀事故)。
 */
export function traeInstallRoots(env = process.env, exists = fs.existsSync) {
  const out = []
  for (const base of [env.LOCALAPPDATA, env.PROGRAMFILES, env['PROGRAMFILES(X86)']]) {
    if (!base) continue
    const p = path.join(base, 'Trae CN')
    if (exists(p)) out.push(path.resolve(p))
  }
  return out
}

/**
 * 枚举同名实例的 `pid|ExecutablePath`。
 * 取不到(宿主不可用 / 非 0 退出)⇒ 返回 null,由调用方按"未判定"处理并**一个都不杀**;
 * 绝不把"问不到"折成"没在跑"或"可以放心杀"(§0.3)。
 */
export function listTraeProcessRows(spawn = spawnSync, psBin = PS_BIN) {
  const script =
    `Get-CimInstance Win32_Process -Filter "Name='${TRAE_PROCESS}'" | ` +
    `ForEach-Object { '{0}|{1}' -f $_.ProcessId, $_.ExecutablePath }`
  const r = spawn(psBin, ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 40000,
    stdio: ['ignore', 'pipe', 'pipe'], // §12g:不吃的子进程必须显式 stdio,否则本机 spawnSync EBUSY
  })
  if (!r || r.status !== 0) return null
  return String(r.stdout || '')
}

/**
 * 归属判定:pid 的 ExecutablePath 必须落在某个安装根**之下**(带分隔符,`…/Trae CN2/…` 只是字符串前缀相似,
 * 不算)才可停;路径问不到的一律归 foreign 并报名 —— 失效方向刻意是"少停"。
 */
export function selectTraeVictims(rawStdout, roots = []) {
  const normRoots = (roots || []).map((r) => normalizeWinPath(r))
  const mine = []
  const foreign = []
  for (const row of String(rawStdout ?? '').split(/\r?\n/)) {
    const i = row.indexOf('|')
    if (i < 0) continue // 表头/空行/被截断的行
    const pid = row.slice(0, i).trim()
    const exe = row.slice(i + 1).trim()
    if (!/^\d+$/.test(pid)) continue
    if (!exe) {
      foreign.push(`${pid}(路径问不到)`)
      continue
    }
    const n = normalizeWinPath(exe)
    if (normRoots.some((r) => n.startsWith(`${r}/`))) mine.push(pid)
    else foreign.push(`${pid}(${exe})`)
  }
  return { mine, foreign }
}

/**
 * 强杀客户端(含子进程树);调用方负责等落盘静默。
 *
 * 筛不出归属 ⇒ **一个都不杀并抛 SwitchError**,而不是静默继续:客户端还活着就让调用方去写
 * storage.json,它退出时会用内存态把刚写的覆盖回去 —— 那正是 isTraeRunning 这道闸要防的事,
 * 所以"杀不动"必须显式失败让人决定,不能悄悄走过去。
 */
export function killTrae({
  rows,
  roots = traeInstallRoots(),
  spawn,
  psBin,
  killer,
  logger = () => {},
} = {}) {
  const raw = rows === undefined ? listTraeProcessRows(spawn, psBin) : rows
  if (raw === null) {
    throw new SwitchError(
      '枚举 Trae 实例的可执行路径失败(PowerShell 不可用或非 0 退出)⇒ 按规则一个都不杀;请完全退出 Trae 后再切',
      'TRAE_ENUM_FAILED',
    )
  }
  const { mine, foreign } = selectTraeVictims(raw, roots)
  if (foreign.length) {
    logger(`⚠️ ${foreign.length} 个同名实例路径不在已登记安装根之下,按规则不动它们:${foreign.join(' | ')}`)
  }
  if (mine.length === 0) {
    const seen = String(raw)
      .split(/\r?\n/)
      .filter((l) => l.includes('|')).length
    throw new SwitchError(
      `按可执行路径筛不出可停的 Trae 实例(枚举到 ${seen} 行 / 安装根 ${roots.length} 个 / 非归属 ${foreign.length} 个)` +
        ' ⇒ 一个都不杀。旧写法是按映像名杀全机同名进程,那会连不属于本工具管理的实例一起带走;' +
        '现在少停的代价由调用方决定(让人手工退出 Trae,或补 IHUI 侧安装根登记)',
      'TRAE_NOT_OWNED',
    )
  }
  const kill =
    killer ||
    ((pid) =>
      execFileSync('taskkill', ['/PID', String(pid), '/F', '/T'], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
      }))
  for (const pid of mine) kill(pid)
  return { killed: mine, foreign }
}

export const __test__ = {
  parseArgs,
  iso,
  buildClientUserInfo,
  buildStoragePatch,
  findStorageFile,
  writeStorageAtomic,
  isTraeRunning,
  traeInstallRoots,
  listTraeProcessRows,
  selectTraeVictims,
  killTrae,
  SwitchError,
  AUTH_KEY,
  DC_KEY_PREFIX,
  TRAE_PROCESS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
