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
 * 2026-11-06 起,"目标串 → 池行候选"的解析判据(pickPoolCandidates / narrowByCurrentAccount /
 * ambiguousOwnerNotice)也住这里 —— 两腿(client-switch 与 chat-switch)共用同一枚实现,
 * 因为号池去重键是 (owner_user_id, provider_code, uid) 三元组,同 uid 双持有者是合法形态,
 * 谁都不许在自己那份代码里再"挑最近更新的一枚"。
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
import { listProductPids } from './trae-client-process.mjs'
// 归属掩码走单源出口(scripts/lib/pool-owner.mjs);本层不重写第二份 slice(§0.6)
import { maskPoolOwner } from './pool-owner.mjs'

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

/** 运营池在 --owner 选择器里的具名写法(= owner_user_id IS NULL 那一侧) */
export const OPS_OWNER_SELECTOR = 'ops'
/** --owner 的前缀下限:8 位 = 仓内归属脱敏口径的输出面长度(再短就可能同时命中多个持有者) */
export const OWNER_PREFIX_MIN = 8
/** --owner 用法行(错误面与下一步命令共用这一句措辞,禁止两处各写一遍) */
export const OWNER_SELECTOR_USAGE = `--owner 需要 <${OPS_OWNER_SELECTOR} 或 owner 前缀(≥${OWNER_PREFIX_MIN} 位)>`

/** 号池目标解析档位(两腿共用词汇;新增档位必须同批改两腿的输出面) */
export const POOL_PICK_DECISIONS = Object.freeze([
  'unique',
  'not-found',
  'ambiguous-uid',
  'ambiguous-owner',
  'bad-owner-selector',
])

/** 候选唯一后再按本机当前在用的那枚收窄出的档位 */
export const POOL_NARROW_DECISIONS = Object.freeze(['same-account', 'switch'])

/** 池行的持有者归属真值(只在内存里比,绝不进输出面;运营池 = null) */
function ownerKeyOf(row) {
  const v = row?.ownerUserId
  return v === null || v === undefined || v === '' ? null : String(v)
}

/**
 * --owner 选择器解析(纯函数):`ops` ⇒ 只看运营池;`<前缀>` ⇒ 只看 ownerUserId 以前缀开头的持有者。
 * 前缀短于 8 位一律拒(不猜);认不出的一律具名拒绝,绝不静默当成"没给"。
 */
export function parseOwnerSelector(raw) {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (!s) return { ok: true, kind: 'any' }
  if (s === OPS_OWNER_SELECTOR) return { ok: true, kind: 'ops' }
  if (s.length < OWNER_PREFIX_MIN) {
    return {
      ok: false,
      error: `--owner 前缀太短(${s.length} 位,需 ≥${OWNER_PREFIX_MIN} 位):${OWNER_SELECTOR_USAGE}`,
    }
  }
  return { ok: true, kind: 'prefix', prefix: s }
}

/**
 * 从「按 provider 取回的池行」里解析 --to 目标(纯函数,零库零 IO;两腿共用唯一判据)。
 *
 * 立因(2026-11-06):号池去重键是 (owner_user_id, provider_code, uid) 三元组,库里两条 partial
 * unique 允许同一 uid **合法**存在两行(运营池一枚 + 个人池一枚;`check-pool-isolation.mjs` 的
 * D3 sameUidMultiRow 把这型登记为 info 并明说"别把两个持有者当成一枚号")。
 * 此前的两腿都按 uid 去重后取 updatedAt 最新的一枚 —— 那一步把"不知道该切哪个持有者"洗成
 * "已切 / 本来就是这号(unchanged)",是 §0.10 禁止的失效方向(该多要一次定向说明,绝不能多放一次
 * 跳门),也是 §0.3 的"取不到输入必须显式点名"没做到。现在:多持有者一律具名歧义,由 `--owner` 定向。
 *
 * @param {Array<Record<string, unknown>>} rows 同 provider 的全部池行(需含 uid/name/ownerUserId)
 * @param {string} target --to 的值(uid 精确 > 名称精确 > 名称包含,与此前口径一致)
 * @param {{owner?: string}} [opts] --owner 定向(缺省 = 不筛归属,因而可能命中多持有者)
 * @returns {{decision: string, row: object|null, candidates: object[], holders: number, error?: string}}
 */
export function pickPoolCandidates(rows, target, { owner = '' } = {}) {
  const list = Array.isArray(rows) ? rows : []
  const sel = parseOwnerSelector(owner)
  if (!sel.ok) {
    return {
      decision: 'bad-owner-selector',
      row: null,
      candidates: [],
      holders: 0,
      error: sel.error,
    }
  }
  const scope =
    sel.kind === 'ops'
      ? list.filter((r) => ownerKeyOf(r) === null)
      : sel.kind === 'prefix'
        ? list.filter((r) => (ownerKeyOf(r) ?? '').toLowerCase().startsWith(sel.prefix))
        : list
  const t = String(target ?? '').trim()
  let hit = scope.filter((r) => String(r.uid) === t)
  if (hit.length === 0) hit = scope.filter((r) => String(r.name ?? '') === t)
  if (hit.length === 0) hit = scope.filter((r) => String(r.name ?? '').includes(t))
  if (hit.length === 0) {
    return {
      decision: 'not-found',
      row: null,
      candidates: [],
      holders: 0,
      scopeNote:
        sel.kind === 'any' ? '' : `(已按 --owner ${String(owner)} 收窄,该归属范围内没有这枚号)`,
    }
  }
  const uids = [...new Set(hit.map((r) => String(r.uid)))]
  if (uids.length > 1)
    return { decision: 'ambiguous-uid', row: null, candidates: hit, holders: uids.length }
  if (hit.length > 1) {
    // uid 唯一而行数 >1 ⇒ 同题多持有者(或同归属重复行的账面异常):一律不替调用方挑一枚
    return { decision: 'ambiguous-owner', row: null, candidates: hit, holders: hit.length }
  }
  return { decision: 'unique', row: hit[0], candidates: hit, holders: 1 }
}

/**
 * 候选唯一之后,再拿"本机当前在用那枚"收窄一次:
 * `same-account` 的合法含义 = **候选唯一 ∧ 确为当前在用那枚**(此前只看 uid 相等,
 * 于是在多持有者形态上把"没定向"说成"无需动作")。非 unique 的入参原样透传档位。
 */
export function narrowByCurrentAccount(picked, currentUid) {
  const decision = picked?.decision
  if (decision !== 'unique') return { decision: decision ?? 'not-found', row: null }
  const cur = currentUid === null || currentUid === undefined ? '' : String(currentUid).trim()
  if (cur && String(picked.row?.uid) === cur) {
    return { decision: 'same-account', row: picked.row }
  }
  return { decision: 'switch', row: picked.row }
}

/** 池行归属的人读脱敏形态:运营池 / 个人池(owner=1f2e3d4c***)。owner 全值绝不出现在输出面。 */
export function describePoolOwner(row) {
  const o = ownerKeyOf(row)
  return o === null ? '运营池' : `个人池(owner=${maskPoolOwner(o)})`
}

/** 单枚候选的一行点名(零凭据;字段集与 --list 的展示面同形) */
export function describePoolCandidate(row) {
  const raw = row?.updatedAt
  const upd = raw instanceof Date ? raw.toISOString() : String(raw ?? '-')
  return (
    `uid=${row?.uid} 名称=${row?.name ?? '-'} 归属=${describePoolOwner(row)}` +
    ` 摘除=${row?.tempUnschedulable ? '是' : '否'} 更新=${upd}`
  )
}

/** 单枚候选的机读摘要(脱敏、零凭据;两腿的报告面共用这一份形状) */
export function summarizePoolCandidate(row) {
  return {
    uid: String(row?.uid ?? ''),
    name: String(row?.name ?? ''),
    owner: describePoolOwner(row),
    tempUnschedulable: Boolean(row?.tempUnschedulable),
    updatedAt: iso(row?.updatedAt),
  }
}

/**
 * 多持有者歧义的具名结论:人类可读行 + 可直接复制的下一步命令(§0.8 出路必须真跑得通)。
 * 命令里的 owner 位用与账面同一口径的 8 位前缀(全值不外流,又不至于给人一条跑不通的命令)。
 * @param {string} target --to 的原始值
 * @param {object[]} candidates 命中的多枚池行
 * @param {{entry: string}} opts 调用方那一条日常入口(逐条点名,不给默认值 ⇒ 不会印出错命令)
 */
export function ambiguousOwnerNotice(target, candidates, { entry = '' } = {}) {
  const list = Array.isArray(candidates) ? candidates : []
  const uid = String(list[0]?.uid ?? String(target ?? ''))
  const summary =
    `uid=${uid} 在池里有 ${list.length} 个持有者(同一 uid 的运营池行与个人池行是合法并存形态)` +
    ` ⇒ 本器不替你选,请定向后再切(拿不到定向绝不是"本来就是这号")`
  const lines = list.map((r) => `  · ${describePoolCandidate(r)}`)
  const commands = entry
    ? list.map((r) => {
        const o = ownerKeyOf(r)
        const selector = o === null ? OPS_OWNER_SELECTOR : o.slice(0, OWNER_PREFIX_MIN)
        return `${entry} --to ${String(r.uid)} --owner ${selector}`
      })
    : []
  const hint = '   定向后再切(命令可直接复制;摘除=是 的那枚即使切了也不会被调度):'
  // printLines = 人类面整段(措辞只这一份;两腿各自只管逐行 stderr.write,不再自己拼句子)
  const printLines = [`❌ ${summary}`, ...lines, hint, ...commands.map((c) => `     ${c}`)]
  return {
    summary,
    lines,
    commands,
    hint,
    printLines,
    uid,
    holders: list.map((r) => summarizePoolCandidate(r)),
  }
}

/**
 * 参数面(入口 mjs 与 ts 侧共用这一份,判据不复制第二遍):
 * 模式三选一 --list / --current / --to <uid|名称>;修饰 --dry-run --force --json;--help 短路。
 * --owner <ops|前缀≥8 位> = 同 uid 多持有者时的定向开关(2026-11-06 立,见 pickPoolCandidates 头注)。
 */
export function parseArgs(argv) {
  const options = {
    mode: null,
    target: '',
    owner: '',
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
    } else if (a === '--owner') {
      const v = argv[++i]
      if (!v || v.startsWith('--')) {
        options.error = OWNER_SELECTOR_USAGE
        break
      }
      options.owner = v
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

/**
 * 按产品指定的 storage.json 落点(2026-10-30 立,SOLO 携对话切号):
 * 目录名(大小写不敏感)命中 product 且 storage.json 存在;多 profile 命中 ⇒ 取候选序第一个
 * (traeUserDataDirs 的次序 = 显式覆盖 > 当前用户 > 跨 profile,优先级不在这里复写第二份)。
 * 无命中 ⇒ null(未判定,绝不回落到"别的产品的那份")。
 */
export function findStorageFileForProduct(product, env = process.env, homedir = os.homedir()) {
  const want = String(product ?? '').trim().toLowerCase()
  if (!want) return null
  for (const dir of traeUserDataDirs(env, homedir)) {
    if (path.basename(dir).toLowerCase() !== want) continue
    const file = path.join(dir, 'User', 'globalStorage', 'storage.json')
    if (fs.existsSync(file)) return file
  }
  return null
}

/**
 * 某产品在跑吗(产品名 → `<product>.exe`;查询失败按 null=未知返回,调用方不得当成"没在跑")。
 * 判据住 trae-client-process.listProductPids(§0.6 单一真相源,本模块 import 它不重写 tasklist 解析)。
 */
export function isProductRunning(product, env = process.env) {
  return listProductPids(String(product ?? '').trim(), env)
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
  parseOwnerSelector,
  pickPoolCandidates,
  narrowByCurrentAccount,
  describePoolOwner,
  describePoolCandidate,
  summarizePoolCandidate,
  ambiguousOwnerNotice,
  iso,
  buildClientUserInfo,
  buildStoragePatch,
  findStorageFile,
  findStorageFileForProduct,
  isProductRunning,
  writeStorageAtomic,
  isTraeRunning,
  listTraeProcesses,
  killTrae,
  SwitchError,
  AUTH_KEY,
  DC_KEY_PREFIX,
  TRAE_PROCESS,
  OPS_OWNER_SELECTOR,
  OWNER_PREFIX_MIN,
  OWNER_SELECTOR_USAGE,
  POOL_PICK_DECISIONS,
  POOL_NARROW_DECISIONS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
