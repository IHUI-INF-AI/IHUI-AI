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
import { execFileSync } from 'node:child_process'
import { encryptEnvelope, traeUserDataDirs } from './trae-auth-extract.mjs'

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

/**
 * 列出本机 Trae 实例。`exePath` 为空 = 问不到路径(权限不足或进程正在退出)。
 * 走 CIM 而非 tasklist:后者只给映像名,拿不到可执行路径就没法区分"哪一份"。
 */
export function listTraeProcesses(lister = defaultProcessLister) {
  return lister()
}

function defaultProcessLister() {
  const out = execFileSync(
    'pwsh.exe',
    [
      '-NoProfile',
      '-Command',
      `Get-CimInstance Win32_Process -Filter "Name='${TRAE_PROCESS}'" | Select-Object ProcessId,ExecutablePath | ConvertTo-Json -Compress`,
    ],
    { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 20_000 },
  )
  const text = String(out ?? '').trim()
  if (!text) return []
  const parsed = JSON.parse(text)
  const rows = Array.isArray(parsed) ? parsed : [parsed]
  return rows
    .map((r) => ({ pid: Number(r?.ProcessId) || 0, exePath: String(r?.ExecutablePath ?? '').trim() }))
    .filter((r) => r.pid > 0)
}

function defaultKiller(pid) {
  execFileSync('taskkill', ['/PID', String(pid), '/F', '/T'], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 20_000,
  })
}

/**
 * 强杀客户端(含子进程树);调用方负责等落盘静默。
 *
 * **不用 `taskkill /IM <名字>`**:那个开关只接受裸文件名,杀的是全机所有同名进程
 * (门 52 N1 一律拦)。改按 pid 逐个杀,并且**问不到可执行路径就一个都不杀** ——
 * 切号失败可以重来,误杀用户的另一份客户端不可撤销。
 */
export function killTrae({ lister = defaultProcessLister, kill = defaultKiller } = {}) {
  const procs = listTraeProcesses(lister)
  if (!procs.length) return { killed: [], reason: 'not-running' }
  const unknown = procs.filter((p) => !p.exePath)
  if (unknown.length) {
    throw new SwitchError(
      `有 ${unknown.length} 个 Trae 进程取不到可执行路径(权限不足或正在退出)⇒ 拒绝按名字盲杀,请手工关闭客户端后重试`,
      'kill-refused',
    )
  }
  const failed = []
  for (const p of procs) {
    try {
      kill(p.pid)
    } catch (e) {
      failed.push(`${p.pid}:${String(e?.message ?? e).slice(0, 80)}`)
    }
  }
  if (failed.length) {
    throw new SwitchError(`有 ${failed.length} 个 Trae 进程停不掉: ${failed.join('; ')}`, 'kill-partial')
  }
  return { killed: procs.map((p) => p.pid), reason: 'killed' }
}

export const __test__ = {
  parseArgs,
  iso,
  buildClientUserInfo,
  buildStoragePatch,
  findStorageFile,
  writeStorageAtomic,
  isTraeRunning,
  listTraeProcesses,
  killTrae,
  SwitchError,
  AUTH_KEY,
  DC_KEY_PREFIX,
  TRAE_PROCESS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
