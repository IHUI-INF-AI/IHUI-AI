// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OpenCode(sst/opencode)本机会话提取器(2026-10-27 装车,补 FROM_PROVIDERS.opencode=null 的缺口)。
 *
 * 取证事实(2026-10-27,§0.9 判据现读,不猜):
 *   - 会话缓存于 `%USERPROFILE%\.local\share\opencode\auth.json`(XDG 惯例,0600 权限),
 *     结构 `{ "<providerID>": { type: "oauth" | "api", key / access / refresh / expires /
 *     accountId / enterpriseUrl … } }`;每个 provider 键 = 一个账号(数组形态导出);
 *   - 本机实测 provider 键 `opencode` → { type, key };OAuth 形态含 access/refresh/
 *     expires/accountId/enterpriseUrl 字段;
 *   - 支持 OPENCODE_AUTH_CONTENT 环境变量整段注入 auth JSON(优先级高于文件);
 *   - 国际产品,无国内/国际分线(导入面无需区分站点点位)。
 *
 * §0.6 单一真相源:零映射 —— 每个 provider 键下的 auth 对象 **raw 直通**,type/key/access
 * 的拆分与归一全交服务端导入映射层(主会话集成)完成;本模块只加 providerID/来源标记/指纹。
 *
 * 安全:令牌零回显 —— meta 摘要只有 type/有无布尔/指纹;错误信息不含凭据明文。
 *
 * 退出语义(§0.3):取不到输入 = throw(带 code),由编排器落 exit 2「未判定」并点名原因。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** 错误码一览(编排器按 code 落「未判定」并点名):
 *  - OPENCODE_NO_SESSION    无可提取会话(env 未注入且 auth.json 缺失/为空)
 *  - OPENCODE_BAD_AUTH_JSON 注入内容或 auth.json 解析失败/顶层形状不符 ⇒ 未判定(不猜字段)
 */
const AUTH_FILE_REL = path.join('.local', 'share', 'opencode', 'auth.json')

function cstr(v) {
  return typeof v === 'string' ? v.trim() : ''
}

function fingerprintOf(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex').slice(0, 12)
}

/**
 * auth.json 候选数据目录(按序取第一个存在的):
 * XDG_DATA_HOME(官方 XDG 支持)> %USERPROFILE% > $HOME。opts.dataDir 显式指定时只用它。
 */
export function candidateDataDirs(env = process.env) {
  const bases = []
  if (cstr(env.XDG_DATA_HOME)) bases.push(cstr(env.XDG_DATA_HOME))
  if (cstr(env.USERPROFILE)) bases.push(cstr(env.USERPROFILE))
  if (cstr(env.HOME)) bases.push(cstr(env.HOME))
  return [...new Set(bases)].map((b) => path.join(b, '.local', 'share', 'opencode'))
}

/**
 * 单账号 stderr 摘要(零凭据明文;只报 type/有无布尔/指纹)。
 * token 取值仅用于指纹:优先 access(OAuth),其次 accessToken/key —— 这是摘要取材,
 * 不是映射;哪个字段当 token 由服务端映射层按 auth.type 决定(§0.6)。
 */
export function summarizeProvider(providerID, auth) {
  const rec = auth && typeof auth === 'object' ? auth : {}
  const pick = ['access', 'accessToken', 'key'].map((k) => cstr(rec[k])).find((s) => s !== '')
  return {
    providerID,
    type: cstr(rec.type) || '(缺)',
    hasKey: cstr(rec.key) !== '',
    hasAccess: cstr(rec.access) !== '' || cstr(rec.accessToken) !== '',
    hasRefresh: cstr(rec.refresh) !== '' || cstr(rec.refreshToken) !== '',
    expiresAt: cstr(rec.expires) !== '' ? cstr(rec.expires) : cstr(rec.expiresAt) || '-',
    tokenFingerprint: pick ? fingerprintOf(pick) : '-',
  }
}

function parseAuthJson(text, label) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    throw Object.assign(
      new Error(`${label} 解析失败(${e instanceof Error ? e.message : String(e)})⇒ 未判定`),
      { code: 'OPENCODE_BAD_AUTH_JSON' },
    )
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw Object.assign(new Error(`${label} 顶层非 JSON 对象 ⇒ 未判定`), {
      code: 'OPENCODE_BAD_AUTH_JSON',
    })
  }
  return parsed
}

/**
 * 提取本机 OpenCode 会话 → 编排器 payload。任何一步取不到都 throw 带 code,绝不静默返回空。
 * 返回形状与 codearts 提取器一致:{ providerCode, accounts, meta }。
 * accounts[i].auth 为该 provider 键下的 auth 对象 raw 直通(§0.6 零映射)。
 * 读取优先级:opts.authContent(测试注入)> OPENCODE_AUTH_CONTENT 环境变量 > auth.json 文件。
 * @param {{authContent?: string, dataDir?: string, env?: object}} [opts] 仅供测试注入
 */
export async function extractOpencodeAccounts(opts = {}) {
  const env = opts.env ?? process.env
  let raw = null
  let label = ''
  let sourceFile = null
  if (cstr(opts.authContent) || cstr(env.OPENCODE_AUTH_CONTENT)) {
    raw = cstr(opts.authContent) || cstr(env.OPENCODE_AUTH_CONTENT)
    label = 'OPENCODE_AUTH_CONTENT 注入内容'
  } else {
    const dirs = opts.dataDir ? [opts.dataDir] : candidateDataDirs(env)
    for (const dir of dirs) {
      const p = path.join(dir, 'auth.json')
      if (fs.existsSync(p)) {
        raw = fs.readFileSync(p, 'utf8')
        label = `${p}`
        sourceFile = p
        break
      }
    }
    if (raw === null) {
      throw Object.assign(
        new Error(
          '未找到 opencode auth.json(已试 ' +
            dirs.map((d) => `${d}${path.sep}auth.json`).join(' / ') +
            ')且未设置 OPENCODE_AUTH_CONTENT ⇒ 未判定。真实出路:在本机 `opencode auth login` ' +
            '登录任一 provider 后重试,或用 OPENCODE_AUTH_CONTENT 注入 auth JSON',
        ),
        { code: 'OPENCODE_NO_SESSION' },
      )
    }
  }
  const auth = parseAuthJson(raw, label)
  const entries = Object.entries(auth)
  if (entries.length === 0) {
    throw Object.assign(
      new Error(`${label} 为空对象(未登录任何 provider)⇒ 未判定`),
      { code: 'OPENCODE_NO_SESSION' },
    )
  }
  const accounts = []
  let skipped = 0
  for (const [providerID, value] of entries) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      skipped++ // 非对象值:形状不符,点名跳过,不猜字段
      continue
    }
    accounts.push({
      source: 'opencode',
      providerID,
      auth: value, // raw 直通(§0.6):键名零改动,零拆分
      fingerprint: summarizeProvider(providerID, value).tokenFingerprint,
    })
  }
  if (accounts.length === 0) {
    throw Object.assign(
      new Error(`auth 里 ${entries.length} 个键全部形状不符(非对象)⇒ 未判定(不猜字段)`),
      { code: 'OPENCODE_BAD_AUTH_JSON' },
    )
  }
  return {
    providerCode: 'opencode',
    accounts,
    meta: {
      sourceFile: sourceFile ?? '(OPENCODE_AUTH_CONTENT 注入)',
      count: accounts.length,
      skipped,
      providers: accounts.map((a) => summarizeProvider(a.providerID, a.auth)),
    },
  }
}

export const __test__ = {
  candidateDataDirs,
  summarizeProvider,
  parseAuthJson,
  fingerprintOf,
  AUTH_FILE_REL,
}
