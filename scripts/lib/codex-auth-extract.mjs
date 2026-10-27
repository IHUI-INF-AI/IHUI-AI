// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Codex(OpenAI Codex CLI)本机会话提取器(2026-10-27 装车,补 FROM_PROVIDERS.codex=null 的缺口)。
 *
 * 取证事实(2026-10-27,§0.9 判据现读,不猜):
 *   - ChatGPT 登录态缓存于 `%USERPROFILE%\.codex\auth.json` 纯文本 JSON:
 *     { auth_mode: "chatgpt", tokens: { id_token, access_token, refresh_token, account_id },
 *       last_refresh: ISO 时间戳 };access token 90 天,到期前 CLI 自动刷新;
 *   - 根目录可由 CODEX_HOME 环境变量覆盖(官方支持),默认 %USERPROFILE%\.codex;
 *   - config.toml `cli_auth_credentials_store = "file" | "keyring" | "auto"`:
 *     keyring 模式(Windows = 凭据管理器)令牌**不落盘**,本提取器读不到 ⇒ 未判定并给真实出路;
 *   - 本机实测:%USERPROFILE%\.codex 存在(config.toml/AGENTS.md 等)但**无 auth.json**
 *     (= 未登录 ChatGPT 或当前走 keyring),故本模块路径判定以「文件缺失」为主路径。
 *
 * §0.6 单一真相源:零映射 —— auth.json 的 tokens 对象 **raw 直通**,access/refresh/
 * account_id 的拆分与归一全交服务端导入映射层(主会话集成)完成;本模块只加来源标记
 * 与指纹,绝不猜字段、绝不静默冒绿(§0.3)。
 *
 * 安全:令牌零回显 —— meta 摘要只有有无布尔/长度/sha256 前 12 位指纹;
 * 错误信息不含凭据明文。
 *
 * 退出语义(§0.3):取不到输入 = throw(带 code),由编排器落 exit 2「未判定」并点名原因。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** 错误码一览(编排器按 code 落「未判定」并点名):
 *  - CODEX_NO_SESSION    无可提取会话(目录/auth.json 缺失、keyring 模式、非 ChatGPT 登录)
 *  - CODEX_BAD_AUTH_JSON auth.json 存在但解析失败/形状不符 ⇒ 未判定(不猜字段)
 *  - CODEX_HOME_MISSING  解析不出 Codex 根目录(无 CODEX_HOME/USERPROFILE/HOME)
 */
function cstr(v) {
  return typeof v === 'string' ? v.trim() : ''
}

function fingerprintOf(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex').slice(0, 12)
}

/** 解析 Codex 根目录:CODEX_HOME 优先,兜底 %USERPROFILE%\.codex(再兜 $HOME/.codex)。 */
export function resolveCodexHome(env = process.env) {
  if (cstr(env.CODEX_HOME)) return path.resolve(cstr(env.CODEX_HOME))
  if (cstr(env.USERPROFILE)) return path.join(cstr(env.USERPROFILE), '.codex')
  if (cstr(env.HOME)) return path.join(cstr(env.HOME), '.codex')
  return null
}

/**
 * 读 config.toml 的 cli_auth_credentials_store 值("file" | "keyring" | "auto" | null)。
 * 只做单键子串匹配(TOML 全量解析引入依赖不值当);注释行不剔除 —— 本值极少写在注释里,
 * 误判 keyring 只会导致多给一条真实出路文案,方向安全。
 */
export function readCredentialStoreMode(codexHome) {
  const tomlPath = path.join(codexHome, 'config.toml')
  if (!fs.existsSync(tomlPath)) return null
  const m = fs.readFileSync(tomlPath, 'utf8').match(/cli_auth_credentials_store\s*=\s*"([^"]+)"/)
  return m ? m[1] : null
}

/** 构造 CODEX_NO_SESSION:按当场取到的证据点名原因 + 真实出路(§0.8 不指跑不通的路)。 */
function buildNoSessionError({ authMissing, storeMode, codexHome }) {
  if (authMissing && storeMode === 'keyring') {
    return Object.assign(
      new Error(
        'config.toml 配置 cli_auth_credentials_store="keyring"(Windows 凭据管理器),令牌不落盘,' +
          'auth.json 不存在 ⇒ 未判定。真实出路:① 改 config.toml 为 cli_auth_credentials_store = "file" ' +
          `后在本机重新 \`codex login\`(ChatGPT 登录),让令牌写回 ${codexHome}\\auth.json;` +
          '② 或用 --file 导入手工导出的 auth.json JSON',
      ),
      { code: 'CODEX_NO_SESSION' },
    )
  }
  if (authMissing) {
    return Object.assign(
      new Error(
        `${codexHome}\\auth.json 不存在(未登录 ChatGPT,或令牌在 OS keyring 中)⇒ 未判定。` +
          '真实出路:在本机执行 `codex login` 完成 ChatGPT 登录后重试;' +
          '若 CLI 配置了 keyring 模式,须先改回 file/auto 或用 --file 导入导出的 JSON',
      ),
      { code: 'CODEX_NO_SESSION' },
    )
  }
  return Object.assign(new Error('无可提取的 Codex 会话 ⇒ 未判定'), { code: 'CODEX_NO_SESSION' })
}

/** 单会话 stderr 摘要(零凭据明文;token 只报有无布尔/长度/指纹)。 */
export function summarizeSession(auth) {
  const rec = auth ?? {}
  const tokens = rec.tokens && typeof rec.tokens === 'object' ? rec.tokens : {}
  const access = cstr(tokens.access_token)
  return {
    authMode: cstr(rec.auth_mode) || '(缺)',
    hasAccessToken: access !== '',
    hasRefreshToken: cstr(tokens.refresh_token) !== '',
    accountId: cstr(tokens.account_id) || '(缺)',
    tokenFingerprint: access ? fingerprintOf(access) : '-',
    tokenLength: access.length,
    lastRefresh: cstr(rec.last_refresh) || '-',
  }
}

/**
 * 提取本机 Codex 会话 → 编排器 payload。任何一步取不到都 throw 带 code,绝不静默返回空。
 * 返回形状与 codearts 提取器一致:{ providerCode, accounts, meta }。
 * accounts[0].tokens 为 auth.json tokens 对象 raw 直通(§0.6 零映射)。
 * @param {{codexHome?: string, env?: object}} [opts] 仅供测试注入
 */
export async function extractCodexAccounts(opts = {}) {
  const codexHome = opts.codexHome ?? resolveCodexHome(opts.env)
  if (!codexHome) {
    throw Object.assign(
      new Error('解析不出 Codex 根目录(无 CODEX_HOME/USERPROFILE/HOME)⇒ 未判定'),
      { code: 'CODEX_HOME_MISSING' },
    )
  }
  if (!fs.existsSync(codexHome)) {
    throw buildNoSessionError({ authMissing: true, storeMode: null, codexHome })
  }
  const storeMode = readCredentialStoreMode(codexHome)
  const authPath = path.join(codexHome, 'auth.json')
  if (!fs.existsSync(authPath)) {
    throw buildNoSessionError({ authMissing: true, storeMode, codexHome })
  }
  let auth
  try {
    auth = JSON.parse(fs.readFileSync(authPath, 'utf8'))
  } catch (e) {
    throw Object.assign(
      new Error(`auth.json 解析失败(${e instanceof Error ? e.message : String(e)})⇒ 未判定`),
      { code: 'CODEX_BAD_AUTH_JSON' },
    )
  }
  if (!auth || typeof auth !== 'object' || Array.isArray(auth)) {
    throw Object.assign(new Error('auth.json 顶层非 JSON 对象 ⇒ 未判定'), {
      code: 'CODEX_BAD_AUTH_JSON',
    })
  }
  const tokens = auth.tokens && typeof auth.tokens === 'object' ? auth.tokens : {}
  const access = cstr(tokens.access_token)
  if (cstr(auth.auth_mode) && auth.auth_mode !== 'chatgpt') {
    throw Object.assign(
      new Error(
        `auth_mode="${auth.auth_mode}"(非 ChatGPT OAuth 登录)⇒ 无可提取会话。` +
          '真实出路:在本机执行 `codex login` 走 ChatGPT 登录后重试',
      ),
      { code: 'CODEX_NO_SESSION' },
    )
  }
  if (!access) {
    throw Object.assign(
      new Error('auth.json 缺 tokens.access_token(形状不符)⇒ 未判定(不猜字段)'),
      { code: 'CODEX_BAD_AUTH_JSON' },
    )
  }
  return {
    providerCode: 'codex',
    accounts: [
      {
        source: 'codex',
        // raw 直通(§0.6):auth.json 顶层与 tokens 对象原样交服务端映射层,零拆分零改名
        authMode: cstr(auth.auth_mode) || null,
        tokens,
        lastRefresh: cstr(auth.last_refresh) || null,
        fingerprint: fingerprintOf(access),
      },
    ],
    meta: {
      sourceDir: codexHome,
      credentialStore: storeMode,
      count: 1,
      sessions: [summarizeSession(auth)],
    },
  }
}

export const __test__ = {
  resolveCodexHome,
  readCredentialStoreMode,
  summarizeSession,
  fingerprintOf,
}
