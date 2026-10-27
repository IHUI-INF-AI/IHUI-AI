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

/** 派生密钥:sha256(secret);secret = env.ZCODE_CREDENTIAL_SECRET ?? fallback(platform:homedir:username) */
export function deriveCipherKey(env = process.env, osApi = os) {
  const secret = cstr(env?.[SECRET_ENV]) || `zcode-credential-fallback:${osApi.platform()}:${osApi.homedir()}:${osApi.userInfo().username}`
  return crypto.createHash('sha256').update(secret).digest()
}

/**
 * 解密单值:`enc:v1:` + b64url(iv) + "." + b64url(tag) + "." + b64url(ciphertext) → 明文;
 * 无前缀 = 明文直通(原样返回);解密失败(AUTH 失败/格式非法)⇒ throw 带原指纹的未判定错。
 */
export function decryptZcodeValue(value, key = deriveCipherKey()) {
  const v = typeof value === 'string' ? value : ''
  if (!v.startsWith(ENC_PREFIX)) return v
  const parts = v.slice(ENC_PREFIX.length).split('.')
  if (parts.length !== 3) {
    throw Object.assign(new Error('ZCode 凭据密文格式非法(段数!=3)'), { code: 'ZCODE_CIPHER_MALFORMED' })
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
      new Error(`ZCode 凭据解密失败(AES-256-GCM AUTH 不过;密钥派生环境不匹配?): ${e instanceof Error ? e.message : String(e)}`),
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

/** 候选数据根:~/.zcode(本机实证);opts.roots 仅供测试注入(同样做存在性过滤,缺失根 ⇒ 上层 DIR_MISSING) */
export function candidateRoots(opts = {}) {
  const raw = Array.isArray(opts.roots) && opts.roots.length > 0 ? opts.roots : [path.join(os.homedir(), '.zcode')]
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
  CREDENTIALS_REL,
  ENC_PREFIX,
  CIPHER,
  SECRET_ENV,
}
