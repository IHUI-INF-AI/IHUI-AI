// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Desktop(Tauri)refresh token 保险库 —— SaaS 模式下跨域认证的核心存储。
 *
 * 背景(2026-09-02 桌面端 SaaS 化):
 * 桌面端生产包 origin = http://tauri.localhost,访问 https://aizhs.top 属跨站请求,
 * 后端 httpOnly refresh_token cookie(SameSite=Lax)不会随跨站 fetch 发送,
 * 因此 /auth/refresh 无法靠 cookie 静默续期(每 15 分钟强制登出)。
 * 方案:登录/刷新时把 refreshToken 显式落 Tauri store(auth.json),
 * 刷新请求改走 body 模式(后端 /auth/refresh 已支持 bodyToken || cookieToken,body 优先)。
 *
 * 浏览器模式:isDesktopEnv() 为 false,全部方法为空操作,行为零变化(cookie 链路不动)。
 * 平台特有:依赖 Tauri plugin-store(window.__TAURI_INTERNALS__),不适合放共享层。
 *
 * D48(G-56)B 层(2026-09-24):auth.json 里的 refresh_token 改为 AES-256-GCM 信封落盘
 * (密钥与算法通道见 lib/local-vault.ts)。对外 API 签名一字未改,调用方(api.ts / stores/auth.ts)
 * 无感。存量明文照旧可读,并在下一次 token 轮转时自动改写为密文;密钥通道不可用时退回明文
 * —— 等价改造前行为,绝不因"加密没成"而登出或抛错。
 */

import { openVaultText, readVaultEntry, sealVaultText, writeVaultEntry } from './local-vault'

/** Tauri v2 运行时探测 —— 定义已收敛到 lib/local-vault.ts(单一事实源),此处保持原导出路径不变 */
export { isDesktopEnv } from './local-vault'

/** store 文件名(落在系统应用数据目录,非 webview localStorage,可被 Rust 侧同读) */
const STORE_FILE = 'auth.json'
const REFRESH_TOKEN_KEY = 'refresh_token'

/**
 * 读取持久化 refreshToken;非 Tauri 或读失败返回 null(不抛错,不阻塞登录)。
 * 密文解不开同样返回 null —— 调用方据此退回 cookie 链路,而不是崩在鉴权层后面。
 */
export async function getDesktopRefreshToken(): Promise<string | null> {
  const stored = await readVaultEntry(STORE_FILE, REFRESH_TOKEN_KEY)
  if (stored.status !== 'ok' || stored.value === null) return null
  const opened = await openVaultText('refresh-token', stored.value)
  if (opened.kind === 'unreadable') return null
  // D48′ 读时即封(2026-09-24):原本要等下一次 token 轮转才把明文改写成密文,而轮转最长
  // 15 分钟一次、且要求页面真的跑过新代码 —— 盘上那颗能解出手机号的裸 JWT 就多活多久。
  // 这条读取路径在桌面端每次启动的 bootstrap 刷新里必然走到,于是"读到 = 已封好"。
  // 判据取**层数**而非"是否存在密文"(同 chat-persist-crypto:只判存在会把已封的再包一层);
  // seal 或写回失败一律保持原值可用 —— 绝不为"加密上了"而把登录态弄丢。
  if (opened.kind === 'plain' || opened.layers !== 1) {
    const sealed = await sealVaultText('refresh-token', opened.text)
    if (sealed !== null) await writeVaultEntry(STORE_FILE, REFRESH_TOKEN_KEY, sealed)
  }
  return opened.text
}

/** 写入(null = 删除)refreshToken;非 Tauri 为空操作;值以信封形态落盘 */
export async function setDesktopRefreshToken(token: string | null): Promise<void> {
  if (token === null) {
    await writeVaultEntry(STORE_FILE, REFRESH_TOKEN_KEY, null)
    return
  }
  // seal 返回 null = 本会话拿不到可用密钥 ⇒ 写明文(等价改造前),下次轮转再补加密
  const sealed = await sealVaultText('refresh-token', token)
  await writeVaultEntry(STORE_FILE, REFRESH_TOKEN_KEY, sealed ?? token)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
