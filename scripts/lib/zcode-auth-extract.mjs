// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ZCode(智谱,Electron 桌面 + TUI 三合一,GLM Coding Plan)本机会话提取器
 * (2026-10-27 装车,补中转号池 zcode 缺口)。
 *
 * 取证链(2026-10-27 本机实证,§0.9 判据现读,不猜;探查只打印键名与值类型,零值回显):
 *   - 数据根 = ~/.zcode/(v2/、cli/、workspace/、backup/);Electron 侧另有
 *     %APPDATA%\ZCode\(rum-electron-store\ZGVmYXVsdA.json、session/)——已探查,
 *     无凭据形状(仅 UI 偏好/内核缓存),不纳入提取面。
 *   - 凭据文件 = ~/.zcode/v2/credentials.json,扁平 map。
 *     **2026-10-27 源码级重大实证:值并非明文,而是 `enc:v1:` 前缀的 AES-256-GCM 密文**
 *     (app.asar 取证:TA="enc:v1:",fK="aes-256-gcm",iv=12,tag=16;
 *      key = sha256(env.ZCODE_CREDENTIAL_SECRET ?? `zcode-credential-fallback:${platform()}:${homedir()}:${username()}`);
 *      编码 = enc:v1: + b64url(iv) + "." + b64url(tag) + "." + b64url(ciphertext);无前缀 = 明文直通):
 *       · oauth:bigmodel:access_token(密文 494 → 明文 335)· zcodejwttoken(密文 319 → 明文 204)
 *       · oauth:bigmodel:user_info / oauth:login_attribution / oauth:active_provider
 *       · project-key-location:v1:<URI 编码数组> ×2(项目级 API Key,同加密体制)
 *     解密配方已实弹闭环:明文 zcodejwttoken 打
 *     https://zcode.z.ai/api/v1/zcode-plan/billing/balance → 200 + plans[](见 zcode-adapter)。
 *     此前「opaque 明文直通」的旧口径系误判(密文被当 token 发 ⇒ 401,已纠正)。
 *   - **2026-11-17 二次加密升级**:ZCode 3.17.2 起 `credentials.json` 的值外层仍 `enc:v1:`,
 *     但解出来是 `enc:v2:{os|env}:<fp>:<iv.tag.ct>` —— v2 用 32 字节系统钥匙串密钥
 *     (Windows Credential Manager,service=`ZCode Credential Encryption`;或 env
 *     `ZCODE_CREDENTIAL_SECRET` / `ZCODE_CREDENTIAL_SECRET_FILE`),AES-256-GCM 同样 12/16 分段。
 *     只解 v1 会把 v2 密文当令牌回灌 ⇒ 号池 health=down(`billing/balance HTTP 401`)。
 *     本模块现按 v2 的 source/fp 现取钥匙并真正解密;取不到钥匙**显式抛未判定**,
 *     绝不把密文静默透传成可用凭据。
 *   - region 判定:project-key-location 键名里的 host ⇒ bigmodel.cn→'cn'、z.ai→'global'
 *     (本机只见 bigmodel.cn;z.ai 形未实证,按 ZCode 双站文档语义探测,不冒绿)。
 *
 * §0.6 单一真相源:credentials.json 整图保留,但**值为解密后明文**(raw 密文整图附在
 * rawCredentials 字段溯源);归一与凭证拆分(token 用哪枚、project key 进哪档)全交服务端
 * mapZcodeImport(主会话集成)。
 *
 * 安全:令牌零回显 —— meta 摘要只有 sha256 前 12 位指纹/长度/键有无布尔;
 * project-key 的解码只碰**键名**(存储键非密文),值不读不改。
 *
 * 退出语义(§0.3):取不到 = throw(带 code),由编排器落 exit 2「未判定」并点名原因。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** 凭据文件相对路径(本机实证活跃:2026-10-25 写过) */
const CREDENTIALS_REL = path.join('v2', 'credentials.json')

/** project-key 存储键前缀(值可直连 bigmodel/z.ai 的 paas/v4) */
export const PROJECT_KEY_PREFIX = 'project-key-location:v1:'

/** host → region(ZCode 双站;bigmodel.cn 本机实证,z.ai 为文档语义预期) */
const HOST_REGION = { 'bigmodel.cn': 'cn', 'z.ai': 'global' }

function fingerprintOf(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex').slice(0, 12)
}

function cstr(v) {
  return typeof v === 'string' ? v.trim() : ''
}

// —— 凭据解密(2026-10-27 app.asar 源码级配方 + 本机实弹闭环)——
const ENC_PREFIX = 'enc:v1:'
const CIPHER = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16
const SECRET_ENV = 'ZCODE_CREDENTIAL_SECRET'
/** ZCode 3.17+ 二次加密层:enc:v2:{os|env}:<24hex fp>:<b64url(iv).b64url(tag).b64url(ct)> */
const V2_PREFIX = 'enc:v2:'
const V2_KEYRING_SERVICE = 'ZCode Credential Encryption'
const V2_KEY_FILE_ENV = 'ZCODE_CREDENTIAL_SECRET_FILE'
const V2_MODULE_ENV = 'ZCODE_KEYRING_MODULE'
const V2_INSTALL_ENV = 'ZCODE_INSTALL_DIR'
const V2_FP_RE = /^[a-f0-9]{24}$/

/**
 * 派生密钥:sha256(secret);secret = env.ZCODE_CREDENTIAL_SECRET ??
 * fallback(platform:homedir:username)。
 *
 * 2026-10-28 修正:fallback 的 homedir/username 改为「按传入 env 现读」——
 * 服务身份(LocalSystem)下 os.homedir() 是 systemprofile、os.userInfo() 是机器账户,
 * 与用户桌面端派生出的密钥必然不同,解密必失败。登录本机会把真实用户家目录派生的
 * env 传进来;家目录与 os.homedir() 一致(普通桌面进程)时回退到 os.userInfo(),
 * 派生串与旧实现逐字节相同。
 */
export function deriveCipherKey(env = process.env, osApi = os) {
  let osUser = ''
  try {
    osUser = cstr(osApi.userInfo().username)
  } catch {
    osUser = ''
  }
  const osHome = cstr(osApi.homedir())
  const envHome = cstr(env?.USERPROFILE) || cstr(env?.HOME)
  const home = envHome || osHome
  const normalize = (s) => s.replace(/\//g, '\\').toLowerCase().replace(/\\+$/, '')
  const sameHome = home !== '' && normalize(home) === normalize(osHome)
  const user = sameHome ? osUser || cstr(env?.USERNAME) : cstr(env?.USERNAME) || path.basename(home)
  const secret =
    cstr(env?.[SECRET_ENV]) || `zcode-credential-fallback:${osApi.platform()}:${home}:${user}`
  return crypto.createHash('sha256').update(secret).digest()
}

/** v2 密钥指纹 = sha256(32B key) 的前 24 位十六进制(与客户端 Lr() 同口径) */
function v2KeyFingerprint(key) {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 24)
}

/** 常见的 ZCode 安装根:env 显式 > 常规盘符/Program Files(只读探测,不猜凭据内容) */
function candidateKeyringModules() {
  const roots = [
    cstr(process.env[V2_INSTALL_ENV]),
    path.join('G:', 'ZCode'),
    path.join('C:', 'Program Files', 'ZCode'),
    path.join('C:', 'Program Files (x86)', 'ZCode'),
    path.join('D:', 'ZCode'),
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'ZCode'),
  ].filter(Boolean)
  const out = []
  for (const root of roots) {
    const napiRoot = path.join(root, 'resources', 'app.asar.unpacked', 'node_modules', '@napi-rs')
    let families
    try {
      families = fs.readdirSync(napiRoot).filter((d) => d.startsWith('keyring-'))
    } catch {
      continue
    }
    for (const family of families) {
      const dir = path.join(napiRoot, family)
      try {
        for (const f of fs.readdirSync(dir)) {
          if (f.endsWith('.node')) out.push(path.join(dir, f))
        }
      } catch {
        /* 单平台包不可读就跳,不中断 */
      }
    }
  }
  return [...new Set(out)]
}

/** @napi-rs/keyring 原生模块只加载一次;findCredentials 是同步 API */
let keyringApiCache
function loadKeyringApi() {
  if (keyringApiCache !== undefined) return keyringApiCache
  keyringApiCache = null
  const explicit = cstr(process.env[V2_MODULE_ENV])
  const candidates = explicit ? [explicit] : candidateKeyringModules()
  for (const file of candidates) {
    try {
      const mod = { exports: {} }
      process.dlopen(mod, file)
      const api = mod.exports
      if (
        api &&
        (typeof api.findCredentials === 'function' || typeof api.AsyncEntry === 'function')
      ) {
        keyringApiCache = api
        break
      }
    } catch {
      /* 平台包不匹配/凭据库不可读 ⇒ 继续找下一个,最终显式报未判定 */
    }
  }
  return keyringApiCache
}

/** 按 v2 的 source 现取候选密钥;给 fp 时只留指纹匹配的,避免在多个 ZCode 配置间瞎试 */
function v2KeyCandidates(source, fp) {
  const out = []
  const envSecret = cstr(process.env[SECRET_ENV])
  if (envSecret) out.push(crypto.createHash('sha256').update(envSecret).digest())
  const keyFile = cstr(process.env[V2_KEY_FILE_ENV])
  if (keyFile) {
    try {
      const text = fs.readFileSync(keyFile, 'utf8')
      if (Buffer.byteLength(text, 'utf8') >= 32 && Buffer.byteLength(text, 'utf8') <= 4096) {
        out.push(crypto.createHash('sha256').update(text).digest())
      }
    } catch {
      /* 文件读不到就是没有这把钥匙 */
    }
  }
  if (source === 'os') {
    const api = loadKeyringApi()
    if (typeof api?.findCredentials === 'function') {
      let entries
      try {
        entries = api.findCredentials(V2_KEYRING_SERVICE)
      } catch {
        entries = null
      }
      for (const e of Array.isArray(entries) ? entries : []) {
        const k = Buffer.from(cstr(e?.password), 'base64url')
        if (k.length === 32) out.push(k)
      }
    }
  }
  return out.filter((k) => !fp || v2KeyFingerprint(k) === fp)
}

/** 解 `enc:v2:`;v1 的密钥派生不复用(源不同),取不到钥匙一律显式未判定 */
function decryptV2Value(value) {
  const body = value.slice(V2_PREFIX.length)
  const parts = body.split(':')
  if (parts.length !== 3 || !['os', 'env'].includes(parts[0]) || !V2_FP_RE.test(parts[1])) {
    throw Object.assign(new Error('ZCode v2 凭据密文格式非法'), { code: 'ZCODE_CIPHER_MALFORMED' })
  }
  const [source, fp, payload] = parts
  const seg = payload.split('.')
  if (seg.length !== 3 || seg.some((s) => !/^[A-Za-z0-9_-]*$/.test(s))) {
    throw Object.assign(new Error('ZCode v2 凭据密文格式非法'), { code: 'ZCODE_CIPHER_MALFORMED' })
  }
  const [iv, tag, ct] = seg.map((s) => Buffer.from(s, 'base64url'))
  if (!iv.length || !ct.length || iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw Object.assign(new Error('ZCode v2 IV/TAG 长度非法'), { code: 'ZCODE_CIPHER_MALFORMED' })
  }
  const keys = v2KeyCandidates(source, fp)
  for (const key of keys) {
    try {
      const d = crypto.createDecipheriv(CIPHER, key, iv)
      d.setAuthTag(tag)
      return Buffer.concat([d.update(ct), d.final()]).toString('utf8')
    } catch {
      /* 指纹相同但 AUTH 不过 ⇒ 换下一把;全不过在下方显式未判定 */
    }
  }
  throw Object.assign(
    new Error(
      `ZCode v2 凭据解密失败(source=${source}, fp=${fp.slice(0, 8)};系统钥匙串/托管密钥不可用)`,
    ),
    { code: 'ZCODE_CIPHER_KEY_UNAVAILABLE' },
  )
}

/**
 * 解密单值:`enc:v2:`(3.17+ 二次加密)或 `enc:v1:`(旧版)→ 明文;
 * 无前缀 = 明文直通。任一密文解不开都 throw 带 code 的未判定,绝不把密文当令牌回灌。
 */
export function decryptZcodeValue(value, key = deriveCipherKey()) {
  const v = typeof value === 'string' ? value : ''
  if (v.startsWith(V2_PREFIX)) return decryptV2Value(v)
  if (!v.startsWith(ENC_PREFIX)) return v
  const parts = v.slice(ENC_PREFIX.length).split('.')
  if (parts.length !== 3) {
    throw Object.assign(new Error('ZCode 凭据密文格式非法(段数!=3)'), {
      code: 'ZCODE_CIPHER_MALFORMED',
    })
  }
  try {
    const iv = Buffer.from(parts[0], 'base64url')
    const tag = Buffer.from(parts[1], 'base64url')
    const ct = Buffer.from(parts[2], 'base64url')
    if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
      throw new Error(`IV/TAG 长度非法(${iv.length}/${tag.length})`)
    }
    const d = crypto.createDecipheriv(CIPHER, key, iv)
    d.setAuthTag(tag)
    return Buffer.concat([d.update(ct), d.final()]).toString('utf8')
  } catch (e) {
    throw Object.assign(
      new Error(
        `ZCode 凭据解密失败(AES-256-GCM AUTH 不过;密钥派生环境不匹配?): ${e instanceof Error ? e.message : String(e)}`,
      ),
      { code: 'ZCODE_CIPHER_DECRYPT_FAIL' },
    )
  }
}

/** 整图解密:逐键 decryptZcodeValue;返回 { plainMap, decryptErrors } */
export function decryptCredentialMap(credMap, key = deriveCipherKey()) {
  const plainMap = {}
  const decryptErrors = []
  for (const [k, v] of Object.entries(credMap)) {
    try {
      plainMap[k] = decryptZcodeValue(v, key)
    } catch (e) {
      decryptErrors.push({ key: k.slice(0, 60), code: e.code ?? 'ZCODE_CIPHER_DECRYPT_FAIL' })
      plainMap[k] = ''
    }
  }
  return { plainMap, decryptErrors }
}

/**
 * 候选数据根:~/.zcode(本机实证);opts.roots 仅供测试注入。
 * opts.env 供服务身份(LocalSystem)下改指真实用户家目录(os.homedir() 会落到 systemprofile)。
 */
export function candidateRoots(opts = {}) {
  const raw =
    Array.isArray(opts.roots) && opts.roots.length > 0
      ? opts.roots
      : (() => {
          const env = opts.env ?? process.env
          const home = cstr(env.USERPROFILE) || cstr(env.HOME) || os.homedir()
          return [path.join(home, '.zcode')]
        })()
  return [...new Set(raw)].filter((d) => fs.existsSync(d))
}

/** 解析 project-key-location 存储键名 → { host, region };解不动 ⇒ null(未判定,不猜) */
export function parseProjectKeyStorageKey(storageKey) {
  if (!String(storageKey ?? '').startsWith(PROJECT_KEY_PREFIX)) return null
  try {
    const arr = JSON.parse(decodeURIComponent(String(storageKey).slice(PROJECT_KEY_PREFIX.length)))
    if (!Array.isArray(arr)) return null
    const host = cstr(arr[0]).replace(/^https?:\/\//, '')
    const region = HOST_REGION[host] ?? null
    return { host, region }
  } catch {
    return null
  }
}

/** 从整图收集 region 集合(project-key 键名判定;值为空的键不算真键,跳过);一个都没有 ⇒ [](未判定) */
export function collectRegions(credMap) {
  const regions = new Set()
  for (const key of Object.keys(credMap)) {
    if (cstr(credMap[key]) === '') continue
    const parsed = parseProjectKeyStorageKey(key)
    if (parsed?.region) regions.add(parsed.region)
  }
  return [...regions]
}

/** 可导入判据:oauth access_token / zcodejwttoken / 任一 project key 三者至少其一 */
export function hasUsableCredential(credMap) {
  return (
    cstr(credMap['oauth:bigmodel:access_token']) !== '' ||
    cstr(credMap['zcodejwttoken']) !== '' ||
    Object.keys(credMap).some((k) => k.startsWith(PROJECT_KEY_PREFIX) && cstr(credMap[k]) !== '')
  )
}

/** 单账号摘要(零凭据明文) */
export function summarizeCredentials(credMap, regions) {
  const projectKeys = Object.keys(credMap).filter((k) => k.startsWith(PROJECT_KEY_PREFIX))
  const oauth = cstr(credMap['oauth:bigmodel:access_token'])
  return {
    regions,
    region: regions.length === 1 ? regions[0] : regions.length === 0 ? '(未判定)' : 'mixed',
    hasOauthAccessToken: oauth !== '',
    hasZcodeJwtToken: cstr(credMap['zcodejwttoken']) !== '',
    hasUserInfo: cstr(credMap['oauth:bigmodel:user_info']) !== '',
    projectKeyCount: projectKeys.filter((k) => cstr(credMap[k]) !== '').length,
    oauthFingerprint: oauth ? fingerprintOf(oauth) : '-',
    oauthLength: oauth.length,
  }
}

/**
 * 提取本机 ZCode 会话 → 编排器 payload。任何一步取不到都 throw 带 code,绝不静默返回空。
 * @param {{roots?: string[]}} [opts] 仅供测试注入
 */
export async function extractZcodeAccounts(opts = {}) {
  const roots = candidateRoots(opts)
  if (roots.length === 0) {
    throw Object.assign(
      new Error(
        '未找到 ZCode 数据目录(~/.zcode 不存在);请先在本机 ZCode 桌面端/TUI 走 ' +
          'BigModel/Z.ai 账号连接登录',
      ),
      { code: 'ZCODE_DIR_MISSING' },
    )
  }
  const accounts = []
  const rootNotes = []
  for (const root of roots) {
    const credPath = path.join(root, CREDENTIALS_REL)
    let credMap
    try {
      credMap = JSON.parse(fs.readFileSync(credPath, 'utf8'))
    } catch (e) {
      throw Object.assign(
        new Error(`凭据文件读取失败(${credPath}): ${e instanceof Error ? e.message : String(e)}`),
        { code: 'ZCODE_CREDENTIALS_UNREADABLE' },
      )
    }
    if (!credMap || typeof credMap !== 'object' || Array.isArray(credMap)) continue
    rootNotes.push({ root, credentialsPath: credPath, keyCount: Object.keys(credMap).length })
    // 2026-10-27 起值为 enc:v1: 密文 ⇒ 整图解密为明文(失败键落 '' 并记 decryptErrors,不冒绿)
    const { plainMap, decryptErrors } = decryptCredentialMap(credMap)
    rootNotes[rootNotes.length - 1].decryptErrorCount = decryptErrors.length
    const regions = collectRegions(plainMap)
    if (!hasUsableCredential(plainMap)) continue
    // §0.6:值为解密后明文直通;raw 密文整图附 rawCredentials 溯源(零回显纪律仍由编排层保证)
    accounts.push({
      ...plainMap,
      rawCredentials: credMap,
      // region:单区域 ⇒ 该值;多区域并存 ⇒ 'mixed'(明细看 regions);判不出 ⇒ null 未判定
      region: regions.length === 1 ? regions[0] : regions.length === 0 ? null : 'mixed',
      regions,
      sourceRoot: root,
      sourcePath: credPath,
    })
  }
  if (accounts.length === 0) {
    throw Object.assign(
      new Error(
        `探到 ${rootNotes.length} 个 ZCode 数据根但 0 个含可用凭据(oauth token / jwt / project key 全缺)` +
          ' ⇒ 未判定',
      ),
      { code: 'ZCODE_NO_SESSION' },
    )
  }
  return {
    providerCode: 'zcode',
    accounts,
    meta: {
      roots: rootNotes,
      count: accounts.length,
      sessions: accounts.map((a) => summarizeCredentials(a, a.regions)),
    },
  }
}

export const __test__ = {
  candidateRoots,
  parseProjectKeyStorageKey,
  collectRegions,
  hasUsableCredential,
  summarizeCredentials,
  deriveCipherKey,
  decryptZcodeValue,
  decryptCredentialMap,
  decryptV2Value,
  v2KeyCandidates,
  CREDENTIALS_REL,
  ENC_PREFIX,
  V2_PREFIX,
  CIPHER,
  SECRET_ENV,
}
