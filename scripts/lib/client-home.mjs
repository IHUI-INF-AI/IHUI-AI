// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 客户端「用户家目录」解析(2026-10-28 立,补本机登录态落点在服务身份下全部指错的缺口)。
 *
 * 立因(本机实证,2026-10-27 生产日志/服务配置):
 *   IHUI-API / IHUI-WEB / IHUI-DEPLOYLOOP 均以 LocalSystem 启动 ⇒ 进程里的
 *   %USERPROFILE% = C:\Windows\system32\config\systemprofile,%APPDATA% 同理。
 *   codex/opencode/minimax/zcode/qoder 的落点全都由这些环境变量解析,于是「登录本机」
 *   在服务里永远找不到真实用户(Administrator)的客户端数据;CodeArts/Qoder 的
 *   DPAPI 主密钥又绑用户,连解都解不开。trae/codearts 的提取器自带跨用户扫描,
 *   不受此限 —— 所以此前只有 trae 看起来"能用"。
 *
 * 本模块只做一件事:从**进程环境**推出真实用户家目录候选,并派生该家目录等价的环境
 * (USERPROFILE/HOME/APPDATA/LOCALAPPDATA/USERNAME),供各提取器原样使用。
 * 判据优先级(§0.9 现读,不猜):
 *   1. IHUI_CLIENT_HOME 显式指定(运维兜底,写错也认,便于他机复用);
 *   2. 进程 USERPROFILE(非服务身份);
 *   3. 进程 HOME(非服务身份);
 *   4. os.homedir()(非服务身份);
 *   5. 仅当前四者都指向服务身份时,才扫 <SystemDrive>\Users\*(按客户端落点新鲜度降序)
 *      —— 服务身份下这是唯一能取到真实客户端数据的路。
 *
 * 安全:只做路径推导与 mtime 探测,不读任何文件内容;重定向相关环境(XDG_DATA_HOME/
 * CODEX_HOME)若指向别处会在派生 env 里剔除,免得把落点又带回系统账户。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function cstr(v) {
  return typeof v === 'string' ? v.trim() : ''
}

/** 服务身份家目录:systemprofile / ServiceProfiles\(LocalService/NetworkService/…) */
export function isServiceProfileHome(home) {
  const h = cstr(home).replace(/\//g, '\\').toLowerCase()
  if (!h) return false
  return /\\systemprofile(\\|$)/.test(h) || /\\serviceprofiles(\\|$)/.test(h)
}

/** 家目录 → 用户名(末段);解析不出 ⇒ '' */
export function usernameOfHome(home) {
  const h = cstr(home).replace(/[\\/]+$/, '')
  if (!h) return ''
  const base = path.basename(h)
  return base && base !== h ? base : ''
}

/**
 * 派生「某个家目录」等价的环境(不修改入参)。
 *  - USERPROFILE/HOME/USERNAME/APPDATA/LOCALAPPDATA/HOMEDRIVE/HOMEPATH 全部改写成该家目录;
 *  - XDG_DATA_HOME/CODEX_HOME 若指向别处则剔除(否则会把落点又带回系统账户);
 *  - 平台相关无关变量原样保留。
 */
export function envForClientHome(home, base = process.env) {
  const h = cstr(home)
  if (!h) return { ...base }
  const env = { ...base }
  const root = path.parse(h).root || (process.platform === 'win32' ? 'C:\\' : '/')
  env.USERPROFILE = h
  env.HOME = h
  const user = usernameOfHome(h)
  if (user) env.USERNAME = user
  env.APPDATA = path.join(h, 'AppData', 'Roaming')
  env.LOCALAPPDATA = path.join(h, 'AppData', 'Local')
  env.HOMEDRIVE = root.replace(/[\\/]+$/, '') || root
  env.HOMEPATH = root === '/' ? h : h.slice(root.length - 1)
  if (isServiceProfileHome(env.XDG_DATA_HOME)) delete env.XDG_DATA_HOME
  if (isServiceProfileHome(env.CODEX_HOME)) delete env.CODEX_HOME
  return env
}

/** 客户端落点探测表(相对家目录);存在即用 mtime 参与新鲜度排序 */
const FRESHNESS_PROBES = [
  ['AppData', 'Roaming', 'Trae CN', 'User', 'globalStorage', 'storage.json'],
  ['AppData', 'Roaming', 'Trae CN'],
  ['.codex', 'auth.json'],
  ['.local', 'share', 'opencode', 'auth.json'],
  ['.minimax'],
  ['.zcode', 'v2', 'credentials.json'],
  ['AppData', 'Roaming', 'codearts-agent'],
]

function qoderFreshness(roaming) {
  let max = -1
  let entries
  try {
    entries = fs.readdirSync(roaming, { withFileTypes: true })
  } catch {
    return -1
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue
    if (!/^com\.qoder(cn)?\.app\./i.test(e.name)) continue
    try {
      max = Math.max(max, fs.statSync(path.join(roaming, e.name, 'auth.v1.dat')).mtimeMs)
    } catch {
      /* 该目录没有 auth.v1.dat,不参与 */
    }
  }
  return max
}

/** 家目录的「客户端新鲜度」:各落点 mtime 最大值;一个都没有 ⇒ -1(排序时垫底) */
export function homeFreshness(home) {
  let max = -1
  for (const rel of FRESHNESS_PROBES) {
    try {
      const m = fs.statSync(path.join(home, ...rel)).mtimeMs
      if (m > max) max = m
    } catch {
      /* 该落点不存在 */
    }
  }
  const q = qoderFreshness(path.join(home, 'AppData', 'Roaming'))
  if (q > max) max = q
  return max
}

/** 扫描用户根下的真实 profile(排除 Public/Default/服务账户;只认有 AppData 的完整 profile) */
function scanUserHomes(usersRoot, skip) {
  let entries
  try {
    entries = fs.readdirSync(usersRoot, { withFileTypes: true })
  } catch {
    return []
  }
  const found = []
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const name = e.name
    const lower = name.toLowerCase()
    if (skip.has(lower)) continue
    if (isServiceProfileHome(name)) continue
    const home = path.join(usersRoot, name)
    if (!fs.existsSync(path.join(home, 'AppData'))) continue
    found.push({ home, mtime: homeFreshness(home) })
  }
  return found
}

const SKIP_USER_DIRS = new Set([
  'public',
  'default',
  'default user',
  'defaultuser0',
  'all users',
  'systemprofile',
  'wdagutilityaccount',
])

/**
 * 真实用户家目录候选(按优先级)。
 * @param {object} [env] 进程环境(测试注入)
 * @param {{usersRoots?: string[], osHomedir?: string, forceScan?: boolean}} [opts] 仅供测试注入
 * @returns {{home: string, source: string}[]}
 */
export function candidateClientHomes(env = process.env, opts = {}) {
  const out = []
  const seen = new Set()
  const push = (raw, source) => {
    const h = cstr(raw)
    if (!h) return
    const resolved = path.resolve(h)
    const key = resolved.toLowerCase().replace(/[\\/]+$/, '')
    if (seen.has(key)) return
    seen.add(key)
    out.push({ home: resolved, source })
  }

  if (cstr(env.IHUI_CLIENT_HOME)) {
    push(env.IHUI_CLIENT_HOME, 'env:IHUI_CLIENT_HOME')
    return out
  }

  const up = cstr(env.USERPROFILE)
  if (up && !isServiceProfileHome(up)) push(up, 'env:USERPROFILE')
  const home = cstr(env.HOME)
  if (home && !isServiceProfileHome(home)) push(home, 'env:HOME')
  const osHome = cstr(opts.osHomedir ?? os.homedir())
  if (osHome && !isServiceProfileHome(osHome)) push(osHome, 'os.homedir')

  if (out.length > 0 && opts.forceScan !== true) return out

  const roots = Array.isArray(opts.usersRoots) && opts.usersRoots.length > 0
    ? opts.usersRoots
    : [path.join(`${cstr(env.SystemDrive) || 'C:'}\\`, 'Users')]
  const scanned = []
  for (const root of roots) {
    for (const hit of scanUserHomes(root, SKIP_USER_DIRS)) scanned.push(hit)
  }
  scanned.sort((a, b) => b.mtime - a.mtime)
  for (const hit of scanned) push(hit.home, 'users-scan')
  return out
}

/**
 * 逐家目录派生环境(顺序即优先级)。没有任何候选时退回原 env,保持旧行为。
 * @returns {object[]}
 */
export function clientHomeEnvs(env = process.env, opts = {}) {
  const homes = candidateClientHomes(env, opts)
  if (homes.length === 0) return [{ ...env }]
  return homes.map((h) => envForClientHome(h.home, env))
}

/** 是否以服务身份运行(用于决定是否必须换用户执行 DPAPI 平台) */
export function isServiceIdentity(env = process.env) {
  if (isServiceProfileHome(env.USERPROFILE)) return true
  if (isServiceProfileHome(env.HOME)) return true
  const user = cstr(env.USERNAME).toLowerCase()
  if (user && (user.endsWith('$') || user === 'system' || user === 'local service' || user === 'network service')) {
    return true
  }
  try {
    const info = os.userInfo()
    if (info.username.toLowerCase().endsWith('$')) return true
  } catch {
    /* 取不到身份信息,按非服务处理 */
  }
  return false
}

export const __test__ = {
  isServiceProfileHome,
  usernameOfHome,
  envForClientHome,
  homeFreshness,
  isServiceIdentity,
  FRESHNESS_PROBES,
  SKIP_USER_DIRS,
}
