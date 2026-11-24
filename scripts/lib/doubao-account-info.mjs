// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 豆包账号信息上游读取(2026-11-17 实证)。
 *
 * 取证结论(同一枚真票,web/desktop/android/ios 四种 device_platform 全量对照):
 * - `POST /alice/user/get_account_info` 是桌面端账号面板自己的取数口,返回
 *   `data.base_account_info.mobile`,形如 `+86 157******40`;
 * - `GET /passport/account/info/v2/` 的 `data.mobile` 同样是掩码;
 * - 换 aid(497858/582478)、换 device_platform、换宿主(www/accounts)都不放全号
 *   ⇒ 豆包上游**只回掩码**,全号只能靠号池侧「前3后2唯一命中」归位(见
 *   service `matchPhoneCandidates` / 本模块 fetch 结果直接落 `phone` 掩码)。
 *
 * 本模块仍按「上游若放全号就直取全号」实现:normalize 同时接受全号与掩码,
 * 上层用 isFullPhone 区分。网络失败/形状不符一律返回 null(取不到 ≠ 失效)。
 */

const DOUBAO_ACCOUNT_INFO_URL = 'https://www.doubao.com/alice/user/get_account_info'
const DOUBAO_ACCOUNT_AID = '582478'
const DOUBAO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'DoubaoDesktop/2.32.6 Chrome/147.0.7727.149 Safari/537.36'

/** 与 doubao-adapter.isHeaderSafeToken 同源判据:不能进 HTTP 头的垃圾 cookie 一律剔除 */
function isHeaderSafeToken(s) {
  if (s === '') return false
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp > 0xff) return false
    if (cp <= 0x1f || cp === 0x7f) return false
    if (ch === ';' || ch === ',' || ch === ' ' || ch === '"' || ch === '\\') return false
  }
  return true
}

/** 出具可进头的 Cookie 头;cookies 支持 {name|key,value} 两种形状 */
function cookieHeaderFromCookies(cookies) {
  const pairs = []
  for (const c of Array.isArray(cookies) ? cookies : []) {
    if (!c || typeof c !== 'object') continue
    const name = typeof c.name === 'string' ? c.name : typeof c.key === 'string' ? c.key : ''
    const value = c.value
    if (!name || typeof value !== 'string' || value === '') continue
    if (!isHeaderSafeToken(name) || !isHeaderSafeToken(value)) continue
    pairs.push(`${name}=${value}`)
  }
  return pairs.join('; ')
}

/**
 * 上游 mobile → 统一号码形态:去掉 `+86`/空格/连字符。
 * 全号(`1[3-9]` + 9 位)与掩码(前3 + 星号 + 后2~4)都接受;其余返回 null。
 */
export function normalizeDoubaoMobile(raw) {
  if (typeof raw !== 'string') return null
  const s = raw.replace(/[\s-]/g, '').replace(/^\+?86/, '')
  if (/^1[3-9]\d{9}$/.test(s)) return s
  if (/^1\d{2}\*{2,8}\d{2,4}$/.test(s)) return s
  return null
}

/**
 * 读取豆包账号手机号(全号或掩码)。返回 null = 上游未给出可解析的号码。
 * @param {Array<Record<string, unknown>>} cookies 豆包整包 cookies
 * @param {{fetchImpl?: typeof fetch, timeoutMs?: number, deviceId?: string}} [opts]
 * @returns {Promise<string | null>}
 */
export async function fetchDoubaoAccountPhone(cookies, opts = {}) {
  const cookieHeader = cookieHeaderFromCookies(cookies)
  if (!cookieHeader) return null
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 6000)
  try {
    const qs = new URLSearchParams({
      language: 'zh',
      device_platform: 'web',
      doubao_device_platform: 'desktop',
      aid: DOUBAO_ACCOUNT_AID,
      real_aid: DOUBAO_ACCOUNT_AID,
      pkg_type: 'release_version',
      version_code: '20800',
      pc_version: '3.46.0',
      'use-olympus-account': '1',
      ...(opts.deviceId ? { device_id: opts.deviceId } : {}),
    }).toString()
    const res = await fetchImpl(`${DOUBAO_ACCOUNT_INFO_URL}?${qs}`, {
      method: 'POST',
      headers: {
        cookie: cookieHeader,
        'content-type': 'application/json',
        accept: 'application/json, text/plain, */*',
        referer: 'https://www.doubao.com/chat/',
        origin: 'https://www.doubao.com',
        'user-agent': DOUBAO_UA,
      },
      body: '{}',
      signal: controller.signal,
    })
    if (!res.ok) return null
    const json = await res.json()
    if (!json || (typeof json.code === 'number' && json.code !== 0)) return null
    const info = json?.data?.base_account_info ?? {}
    return normalizeDoubaoMobile(info.mobile ?? info.mobile_number ?? info.phone ?? null)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
