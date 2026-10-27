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
 *   - 凭据文件 = ~/.zcode/v2/credentials.json,**扁平 map,值全部为 opaque 明文串**
 *     (实测 7 键,均非 JSON、非 JWT 头形):
 *       · oauth:bigmodel:access_token(494 字符)  · zcodejwttoken(319)
 *       · oauth:bigmodel:user_info(299,opaque 非 JSON)
 *       · oauth:login_attribution / oauth:active_provider
 *       · project-key-location:v1:<URI 编码数组> ×2 —— 键名解码后为
 *         ["https://bigmodel.cn","bigmodel","<projectId>",null,1,"non-team"],
 *         值(254 字符)为项目级 API Key(可直连 paas/v4)。
 *   - region 判定:project-key-location 键名里的 host ⇒ bigmodel.cn→'cn'、z.ai→'global'
 *     (本机只见 bigmodel.cn;z.ai 形未实证,按 ZCode 双站文档语义探测,不冒绿)。
 *
 * §0.6 单一真相源:credentials.json 整图**逐字直通**(键值原样),仅附 region/溯源字段;
 * 归一与凭证拆分(token 用哪枚、project key 进哪档)全交服务端 mapZcodeImport(主会话集成)。
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
    const regions = collectRegions(credMap)
    if (!hasUsableCredential(credMap)) continue
    // §0.6 raw 直通:credentials.json 整图逐字保留,仅附 region/溯源字段
    accounts.push({
      ...credMap,
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
    meta: { roots: rootNotes, count: accounts.length, sessions: accounts.map((a) => summarizeCredentials(a, a.regions)) },
  }
}

export const __test__ = {
  candidateRoots,
  parseProjectKeyStorageKey,
  collectRegions,
  hasUsableCredential,
  summarizeCredentials,
  CREDENTIALS_REL,
}
