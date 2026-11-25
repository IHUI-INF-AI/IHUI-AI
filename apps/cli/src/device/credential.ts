// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 设备执行器本地凭据(G2,2026-11-25)。
 *
 * 与 `~/.ihui/settings.json` 分开存:settings 是"用户偏好",本文件是"这台机器被授予的
 * 执行身份"(设备令牌 + 指纹 + 工作区白名单)。两者生命周期不同 —— unpair 只该抹掉后者,
 * 不能连用户登录态一起删。
 *
 * 卫生:0600 + 目录 0700;写盘走 临时文件 + rename 原子替换;坏文件不静默修,
 * 改名成 `.bad-<ts>` 后当作未配对(用户重新 pair 即可,旧文件留给取证)。
 */
import { randomBytes } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'

/** 凭据版本:字段变更时 +1,读到旧版本按未配对处理(不猜字段语义) */
export const DEVICE_CREDENTIAL_VERSION = 1

export interface StoredDeviceCredential {
  version: typeof DEVICE_CREDENTIAL_VERSION
  apiUrl: string
  deviceId: string
  deviceToken: string
  /** 配对时绑定的执行体指纹;此后每个设备请求必须带同一值 */
  fingerprint: string
  name: string
  /**
   * 工作区白名单:名字 → 绝对路径。
   * 任务载荷里的 `workspace` 只能取这里的**名字**,服务端不决定执行目录 ——
   * 设备端解析不到就拒绝执行,防"手机上写个路径就让我在任意盘跑命令"。
   */
  workspaces: Record<string, string>
  pairedAt: string
}

export function cliConfigDir(): string {
  return join(process.env.HOME || process.env.USERPROFILE || homedir(), '.ihui')
}

export function deviceCredentialPath(): string {
  return join(cliConfigDir(), 'device.json')
}

export function devicePidPath(): string {
  return join(cliConfigDir(), 'device.pid')
}

export function deviceLogPath(): string {
  return join(cliConfigDir(), 'device.log')
}

function ensureConfigDir(): void {
  const dir = cliConfigDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 })
}

/** 读凭据;不存在/形状坏 → null(坏文件改名留证,不覆盖用户现场) */
export function readDeviceCredential(): StoredDeviceCredential | null {
  const path = deviceCredentialPath()
  if (!existsSync(path)) return null
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    quarantine(path)
    return null
  }
  if (typeof raw !== 'object' || raw === null) {
    quarantine(path)
    return null
  }
  const c = raw as Record<string, unknown>
  if (c.version !== DEVICE_CREDENTIAL_VERSION) {
    quarantine(path)
    return null
  }
  const apiUrl = typeof c.apiUrl === 'string' ? c.apiUrl.trim() : ''
  const deviceId = typeof c.deviceId === 'string' ? c.deviceId.trim() : ''
  const deviceToken = typeof c.deviceToken === 'string' ? c.deviceToken.trim() : ''
  const fingerprint = typeof c.fingerprint === 'string' ? c.fingerprint.trim() : ''
  const name = typeof c.name === 'string' ? c.name.trim() : ''
  if (!apiUrl || !deviceId || !deviceToken || !fingerprint || !name) {
    quarantine(path)
    return null
  }
  const workspacesRaw = c.workspaces
  if (typeof workspacesRaw !== 'object' || workspacesRaw === null) {
    quarantine(path)
    return null
  }
  const workspaces: Record<string, string> = {}
  for (const [key, value] of Object.entries(workspacesRaw as Record<string, unknown>)) {
    if (typeof value !== 'string' || !value.trim() || !isAbsolute(value)) {
      quarantine(path)
      return null
    }
    workspaces[key] = value
  }
  if (Object.keys(workspaces).length === 0) {
    quarantine(path)
    return null
  }
  return {
    version: DEVICE_CREDENTIAL_VERSION,
    apiUrl,
    deviceId,
    deviceToken,
    fingerprint,
    name,
    workspaces,
    pairedAt: typeof c.pairedAt === 'string' ? c.pairedAt : new Date().toISOString(),
  }
}

function quarantine(path: string): void {
  try {
    renameSync(path, `${path}.bad-${Date.now()}`)
  } catch {
    /* 改名失败只影响取证,不阻断用户重新配对 */
  }
}

/** 写凭据:原子替换 + 0600。失败抛错(配对成功却落不了盘 = 下次启动变未配对) */
export function writeDeviceCredential(cred: StoredDeviceCredential): void {
  ensureConfigDir()
  const path = deviceCredentialPath()
  const tmp = `${path}.tmp-${randomBytes(6).toString('hex')}`
  writeFileSync(tmp, JSON.stringify(cred, null, 2), { encoding: 'utf8', mode: 0o600 })
  try {
    chmodSync(tmp, 0o600)
  } catch {
    /* Windows 上 chmod 语义有限,失败不阻断 */
  }
  renameSync(tmp, path)
}

export function clearDeviceCredential(): boolean {
  const path = deviceCredentialPath()
  if (!existsSync(path)) return false
  unlinkSync(path)
  return true
}

/**
 * 白名单解析:只按**名字**查表,接受相对名字或绝对路径等值匹配。
 * 传了不在表里的名字 → 抛错(fail-closed),绝不回落到 cwd ——
 * 回落意味着"手机上写错一个名字"就能在我任意目录跑命令。
 */
export function resolveWorkspacePath(
  cred: Pick<StoredDeviceCredential, 'workspaces'>,
  requested?: string | null,
): string {
  const names = Object.keys(cred.workspaces)
  if (requested && requested.trim()) {
    const key = requested.trim()
    const byName = cred.workspaces[key]
    if (byName) return byName
    const byPath = names.find((n) => cred.workspaces[n] === key)
    if (byPath) return cred.workspaces[byPath]!
    throw new Error(`工作区 ${key} 不在本机白名单(${names.join(', ')})`)
  }
  const first = names[0]
  if (!first) throw new Error('本机未配置任何工作区白名单')
  return cred.workspaces[first]!
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
