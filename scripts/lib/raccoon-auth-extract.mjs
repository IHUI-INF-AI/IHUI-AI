// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 商汤小浣熊（Raccoon Work）本机登录态提取器(2026-11-11 立)。
 *
 * 取证链(全部本机实测,详见 docs/raccoon-relay-api.md):
 * - 凭据落点(旧/便携/类 Unix):~/.office-raccoon/agent/config/auth.json
 * - 凭据落点(现装 2026-11-11 重装搬 D 盘):%APPDATA%/office-raccoon 是 junction →
 *   D:\SOFTWARE\商汤小浣熊\_data\office-raccoon,但**实际凭据在同级 box-agent**:
 *   D:\SOFTWARE\商汤小浣熊\_data\box-agent\config\auth.json
 *   (box-agent = 小浣熊桌面启动器,凭据落它名下,而非 office-raccoon)。
 *   提取器经 candidateAuthFiles() 自动跟 junction 取 dataRoot,不再写死单一路径。
 *   { access_token: JWT(HS256, iss=xiaohuanxiong.com/iam, sub=pu-<uuid>, 30 天),
 *     office_identity: "personal"(个人版身份标记,非 owner_id——owner_id 由 balance 接口给) }
 * - auth.json 无 refresh_token ⇒ 提取载荷不带 refreshToken 字段(续期腿待取证,勿冒充)。
 * - 全号手机号从 GET /api/web/auth/v1/user_info 取(实证返回未脱敏 `phone`,2026-11-11);
 *   IAM /api/iam/v1/account 只给掩码(`199****5160`)⇒ 降为兜底且不当全号用。
 *   两处都取不到不阻塞,名称退化点名(§0.3:没判的不写成判过)。
 *
 * 输出形状与 relay-account-pool --file 通道一致:
 *   { providerCode:'raccoon', accounts:[{ name, phone?, token, uid, expiresAt?, meta }], meta }
 * 退出码:0 成功 / 1 本机无登录态 / 2 参数或环境未判定。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const AUTH_REL = path.join('.office-raccoon', 'agent', 'config', 'auth.json')
const API_BASE = 'https://xiaohuanxiong.com'

/** JWT 段解码(只解 payload 元数据,失败返回 null ⇒ 调用方如实标未判定) */
export function decodeJwtPayload(token) {
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

/** auth.json 形状校验:两键都得是规范字符串,否则整条不成立 */
export function parseAuthJson(raw) {
  let obj
  try {
    obj = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'auth.json 不是合法 JSON' }
  }
  if (!obj || typeof obj !== 'object') return { ok: false, reason: 'auth.json 顶层不是对象' }
  const token = typeof obj.access_token === 'string' ? obj.access_token.trim() : ''
  if (!token) return { ok: false, reason: 'auth.json 缺 access_token' }
  const identity = typeof obj.office_identity === 'string' ? obj.office_identity.trim() : ''
  return { ok: true, token, identity }
}

/** 候选 profile 根:当前用户 + (默认)本机其他用户目录;IHUI_RACCOON_SCAN_USERS=0 关扫描档 */
export function candidateHomes() {
  const homes = [os.homedir()]
  if (process.env.IHUI_RACCOON_SCAN_USERS === '0') return homes
  const usersRoot = process.platform === 'win32' ? 'C:\\Users' : '/home'
  try {
    for (const name of fs.readdirSync(usersRoot)) {
      const p = path.join(usersRoot, name)
      try {
        if (fs.statSync(p).isDirectory() && !homes.includes(p)) homes.push(p)
      } catch {}
    }
  } catch {}
  return homes
}

/**
 * 候选 auth.json 落点清单(自动发现,不写死单一路径):
 *   0) IHUI_RACCOON_AUTH_FILE 显式覆盖(运维排障用)
 *   1) 旧文档/便携/类 Unix:~/.office-raccoon/agent/config/auth.json
 *   2) 现装(Windows 2026-11-11 搬 D 盘):%APPDATA%/office-raccoon 是 junction →
 *      D:\SOFTWARE\商汤小浣熊\_data\office-raccoon;**实际凭据在同级 box-agent**:
 *      D:\SOFTWARE\商汤小浣熊\_data\box-agent\config\auth.json
 *      (junction 跟随后取 dataRoot,再落 box-agent 优先、office-raccoon 兜底)
 *   3) 硬编码实测主落点 D:\SOFTWARE\商汤小浣熊\_data(防 junction 被移除/重装漂移)。
 * 返回 [{ file, home }];home 用于出错点名,不进入凭据本身。
 */
export function candidateAuthFiles() {
  const out = []
  const seen = new Set()
  const push = (file, home) => {
    let norm
    try {
      norm = path.resolve(file)
    } catch {
      norm = file
    }
    if (seen.has(norm)) return
    seen.add(norm)
    out.push({ file: norm, home: home ?? path.dirname(norm) })
  }

  if (process.env.IHUI_RACCOON_AUTH_FILE) {
    push(process.env.IHUI_RACCOON_AUTH_FILE, 'IHUI_RACCOON_AUTH_FILE')
  }
  for (const home of candidateHomes()) {
    push(path.join(home, AUTH_REL), home)
  }
  const dataRoots = new Set()
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
    const officeDir = path.join(appData, 'office-raccoon')
    if (fs.existsSync(officeDir)) {
      try {
        dataRoots.add(path.dirname(fs.realpathSync(officeDir)))
      } catch {}
    }
  }
  dataRoots.add(path.join('D:', 'SOFTWARE', '商汤小浣熊', '_data'))
  for (const root of dataRoots) {
    push(path.join(root, 'box-agent', 'config', 'auth.json'), root)
    push(path.join(root, 'office-raccoon', 'agent', 'config', 'auth.json'), root)
  }
  return out
}

/** 找出全部有效登录态(多 profile / 多落点时逐枚列,调用方决定取哪枚) */
export function findAuthFiles() {
  const found = []
  for (const { file, home } of candidateAuthFiles()) {
    if (!fs.existsSync(file)) continue
    let raw
    try {
      raw = fs.readFileSync(file, 'utf8')
    } catch (e) {
      found.push({ file, home, ok: false, reason: `读取失败:${e.code}` })
      continue
    }
    const parsed = parseAuthJson(raw)
    found.push({ file, home, ...parsed })
  }
  return found
}

/**
 * 客户端账户面取全号手机号(可选;失败返回 null 不抛——提取主链路不依赖网络)。
 *
 * 2026-11-11 15:2x 实证:`GET /api/web/auth/v1/user_info` 返回 **未脱敏** `phone`
 * (`19944895160`)与 `id`/`uuid`/`name`;而 IAM `/api/iam/v1/account` 只给掩码
 * (`199****5160`)。号池统一名要的是全号 ⇒ 这里才是正确取材面,IAM 降为兜底。
 */
export async function fetchUserInfo(token, fetchImpl = globalThis.fetch) {
  try {
    const r = await fetchImpl(`${API_BASE}/api/web/auth/v1/user_info`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'X-Client-Platform': 'desktop-windows',
        'User-Agent': 'ihui-relay-extract/1.0',
        connection: 'close',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) return null
    const j = await r.json()
    const d = j?.data
    return d && typeof d === 'object' ? d : null
  } catch {
    return null
  }
}

/** IAM 取账户(可选;失败返回 null 不抛——提取主链路不依赖网络) */
export async function fetchIamAccount(token, fetchImpl = globalThis.fetch) {
  try {
    const r = await fetchImpl(`${API_BASE}/api/iam/v1/account`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'User-Agent': 'ihui-relay-extract/1.0',
        connection: 'close',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) return null
    const j = await r.json()
    const u = j?.data?.user
    return u && typeof u === 'object' ? u : null
  } catch {
    return null
  }
}

/**
 * 提取本机小浣熊登录态。
 * @param {{verify?:boolean, fetchImpl?:typeof fetch, home?:string, pick?:'newest'|'error'}} [opts]
 *   verify=打 IAM 取全号(**默认开**:号池统一名 = 官方绑定手机号是既有纪律;
 *   IAM 取不到时如实退化为 uid 名,不阻塞提取);显式传 false 或 CLI `--no-verify` 关闭。
 *   home=指定 profile 根;pick=newest 按 auth.json mtime 取最新一枚
 *   (调度/多 profile 场景,选择依据随结果回显;默认 error=多枚时如实拒绝,不猜)
 */
export async function extractRaccoonAccounts(opts = {}) {
  if (opts.home) {
    // 指定 profile 根:既试旧文档路径,也试现装 box-agent 同级(落点随版本漂移,不赌单一形态)
    const cands = [
      path.join(opts.home, AUTH_REL),
      path.join(opts.home, 'box-agent', 'config', 'auth.json'),
      path.join(opts.home, 'office-raccoon', 'agent', 'config', 'auth.json'),
    ].filter((p) => fs.existsSync(p))
    const file = cands[0]
    if (!file) {
      return {
        ok: false,
        exitCode: 1,
        reason: `指定 profile 根下没有小浣熊登录态(试过:${cands.length ? cands.join(', ') : `${opts.home}/${AUTH_REL} 等`})`,
      }
    }
    const parsed = parseAuthJson(fs.readFileSync(file, 'utf8'))
    if (!parsed.ok) return { ok: false, exitCode: 1, reason: `${file}:${parsed.reason}` }
    opts = { ...opts, _forced: [{ file, home: opts.home, ...parsed }] }
  }
  const found = opts._forced ?? findAuthFiles()
  const usable = found.filter((f) => f.ok)
  if (usable.length === 0) {
    const detail = found.length
      ? found.map((f) => `${f.file}(${f.reason})`).join('; ')
      : `未找到任何 ${AUTH_REL}(候选 profile:${candidateHomes().join(', ')})`
    return { ok: false, exitCode: 1, reason: `本机没有小浣熊登录态:${detail}` }
  }
  let picked = usable[0]
  let pickBasis = 'single'
  if (usable.length > 1) {
    if (opts.pick === 'newest') {
      let best = null
      let bestM = -1
      for (const u of usable) {
        let m = 0
        try {
          m = fs.statSync(u.file).mtimeMs
        } catch {}
        if (m > bestM) {
          bestM = m
          best = u
        }
      }
      picked = best
      pickBasis = `newest(mtime=${new Date(bestM).toISOString()})`
    } else {
      return {
        ok: false,
        exitCode: 1,
        reason:
          `发现 ${usable.length} 枚小浣熊登录态(${usable.map((u) => u.file).join(', ')}),` +
          '不确定取哪一枚;请只保留一个在用登录态、删掉其余 profile 的 auth.json、或显式 --pick newest / --home <profile>',
      }
    }
  }
  const entry = picked
  const payload = decodeJwtPayload(entry.token)
  const uid = payload && typeof payload.sub === 'string' ? payload.sub : null
  const expiresAt = payload && typeof payload.exp === 'number' ? new Date(payload.exp * 1000).toISOString() : null

  let phone = null
  let phoneSource = null
  let accountName = null
  if (opts.verify !== false) {
    // 首选客户端账户面(全号);取不到再退 IAM(掩码 ⇒ 只当昵称源,不当手机号)
    const info = await fetchUserInfo(entry.token, opts.fetchImpl)
    if (info) {
      const rawPhone = typeof info.phone === 'string' ? info.phone.replace(/\s/g, '') : ''
      if (/^1[3-9]\d{9}$/.test(rawPhone)) {
        phone = rawPhone
        phoneSource = 'user_info'
      }
      accountName = typeof info.name === 'string' ? info.name.trim() : null
    }
    if (!phone) {
      const user = await fetchIamAccount(entry.token, opts.fetchImpl)
      if (user) {
        const rawPhone = typeof user.phone === 'string' ? user.phone.replace(/\s/g, '') : ''
        // 掩码形态不当全号用,如实退化(§0.3:没判的不写成判过)
        if (/^1[3-9]\d{9}$/.test(rawPhone)) {
          phone = rawPhone
          phoneSource = 'iam'
        }
        accountName = accountName || (typeof user.name === 'string' ? user.name.trim() : null)
      }
    }
  }

  const name = phone || accountName || (uid ? `raccoon-${uid.slice(0, 14)}` : `raccoon-${entry.identity || 'unknown'}`)
  const account = {
    name,
    token: entry.token,
    enabled: true,
    ...(phone ? { phone } : {}),
    ...(uid ? { uid } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    meta: { officeIdentity: entry.identity || null, sourceFile: entry.file, extractedAt: new Date().toISOString() },
  }
  return {
    ok: true,
    providerCode: 'raccoon',
    accounts: [account],
    meta: {
      hasRefreshToken: false,
      refreshNote: 'auth.json 无 refresh_token;续期端点形状未实证 ⇒ 号池侧不得对本平台开续期腿',
      iamVerified: opts.verify !== false,
      phoneSource,
      pickBasis,
      candidates: found.map((f) => `${f.file}${f.ok ? '' : ' (无效)'}`),
    },
  }
}

async function main() {
  const args = process.argv.slice(2)
  // verify 默认开(号池统一名 = 手机号);--no-verify 显式关闭,--verify 保留为可读的显式写法
  const verify = !args.includes('--no-verify')
  const json = args.includes('--json')
  const pickIdx = args.indexOf('--pick')
  const pick = pickIdx >= 0 ? args[pickIdx + 1] : undefined
  const homeIdx = args.indexOf('--home')
  const home = homeIdx >= 0 ? args[homeIdx + 1] : undefined
  if (args.includes('--help')) {
    console.log('用法:node scripts/lib/raccoon-auth-extract.mjs [--no-verify] [--json] [--pick newest] [--home <profile>]')
    console.log('  --no-verify    跳过 IAM 取全号(默认会打 /api/iam/v1/account 用手机号当统一名)')
    console.log('  --json         机器可读输出(默认人读)')
    console.log('  --pick newest  多 profile 时按 auth.json mtime 取最新一枚(调度场景;默认多枚即拒)')
    console.log('  --home <dir>   指定 profile 根(其下 .office-raccoon/agent/config/auth.json)')
    return 0
  }
  const result = await extractRaccoonAccounts({ verify, pick, home })
  if (!result.ok) {
    console.error(`❌ ${result.reason}`)
    return result.exitCode ?? 1
  }
  if (json) {
    // 令牌只走 stdout 管道给下游(号池导入器),不落任何日志
    process.stdout.write(JSON.stringify(result))
    return 0
  }
  const a = result.accounts[0]
  console.log(`✅ 已提取本机小浣熊登录态(令牌内容不回显)`)
  console.log(`   名称:${a.name}`)
  console.log(`   uid :${a.uid ?? '(JWT 未解出 ⇒ 未判定)'}`)
  console.log(`   到期:${a.expiresAt ?? '(未判定)'}`)
  console.log(`   业务身份 office_identity:${a.meta.officeIdentity ?? '(空)'}`)
  console.log(`   来源:${a.meta.sourceFile}`)
  console.log(`   入池:node scripts/relay-account-pool.mjs --from raccoon`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => {
      process.exitCode = code ?? 0
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}`)
      process.exitCode = 2
    })
}

export const __test__ = {
  decodeJwtPayload,
  parseAuthJson,
  candidateHomes,
  candidateAuthFiles,
  findAuthFiles,
  fetchUserInfo,
  fetchIamAccount,
  extractRaccoonAccounts,
  AUTH_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
