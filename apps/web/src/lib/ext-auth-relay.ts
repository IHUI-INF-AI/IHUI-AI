// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-66 web 侧发送端(2026-11-11 立):第三方登录成功后把 token 送回已安装的扩展。
 *
 * 接收端在 apps/extension:manifest `externally_connectable`(白名单 localhost:8802/8803
 * 与 *.aizhs.top)+ background `chrome.runtime.onMessageExternal`;判据与消息形状的唯一
 * 权威定义在 apps/extension/lib/external-auth.ts(type 字面量 'ihui.ext_auth.token',
 * accessToken 必填非空,refreshToken/expiresIn 可选)。两 app 不共享 workspace 包,
 * 这里的类型字面量是 wire 契约的手抄副本 —— 改任何一侧必须同步另一侧,否则
 * 接收端判据整块拒收、发送端静默空转。
 *
 * extensionId 获取途径(票面:不得臆造固定 ID ⇒ 仓内无既有约定,做成构建期可配置):
 *   - 商店发布版:Chrome Web Store 详情页 URL `.../detail/<id>` 里的 32 位小写字母 ID;
 *   - 解包开发版:chrome://extensions 显示的 ID(由安装路径派生,每台机器不同 ⇒
 *     按环境配置,绝不能把某台机器的 ID 写死进代码)。
 * 两者都经环境变量 NEXT_PUBLIC_IHUI_EXTENSION_ID 注入;未配置 ⇒ 不发送(静默降级)。
 *
 * 降级契约(票面:失败不得影响 web 登录本身):本模块所有入口永不抛错 ——
 * 扩展未装(页面拿不到 chrome.runtime.sendMessage)、ID 未配置、发送被拒
 * (ID 不存在 / 来源不在 externally_connectable 白名单)一律静默吞掉。
 */

/** wire 契约 type 字面量 —— 唯一权威定义在 apps/extension/lib/external-auth.ts */
const EXTERNAL_AUTH_MESSAGE_TYPE = 'ihui.ext_auth.token'

/** 与接收端 parseExternalAuthTokenMessage 的入参形状对齐(未知类型在此收敛) */
export interface ExtAuthTokenPayload {
  accessToken?: unknown
  refreshToken?: unknown
  expiresIn?: unknown
}

/** 接收端同款归一:只认非空字符串,trim 后为空按缺省处理 */
function normalizeText(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined
}

/**
 * 页面侧能拿到的最小 chrome.runtime 形状。apps/web 不依赖 @types/chrome
 * (web 端此前零 chrome.runtime 消费,本票是第一个),故本地声明、结构匹配即可。
 */
interface ExtensionRuntimeLike {
  sendMessage?: (extensionId: string, message: Record<string, unknown>) => unknown
}

/**
 * extensionId 读取口。构建期 env 注入(见文件头注释的获取途径);
 * 每次调用现读,测试可在同进程内逐档配置。
 */
export function resolveExtensionId(): string {
  return normalizeText(process.env.NEXT_PUBLIC_IHUI_EXTENSION_ID) ?? ''
}

/**
 * 登录成功后向扩展发送 token。返回是否真的派发了一次 sendMessage(供测试断言);
 * 任何不满足发送条件或失败的路径都静默返回 false/true,永不抛错。
 */
export function notifyExtensionAuth(payload: ExtAuthTokenPayload): boolean {
  try {
    if (typeof window === 'undefined') return false
    // 扩展安装态判据(票面):chrome.runtime 只在「已安装且本页命中
    // externally_connectable 白名单的扩展」存在时才注入到普通网页。
    const runtime = (window as { chrome?: { runtime?: ExtensionRuntimeLike } }).chrome?.runtime
    const sendMessage = runtime?.sendMessage
    if (typeof sendMessage !== 'function') return false
    const extensionId = resolveExtensionId()
    if (!extensionId) return false
    const accessToken = normalizeText(payload.accessToken)
    if (!accessToken) return false
    // 可选字段按接收端同款归一后「缺省即不发」,不带上 undefined 键
    const message: Record<string, unknown> = { type: EXTERNAL_AUTH_MESSAGE_TYPE, accessToken }
    const refreshToken = normalizeText(payload.refreshToken)
    if (refreshToken) message.refreshToken = refreshToken
    if (typeof payload.expiresIn === 'number' && Number.isFinite(payload.expiresIn) && payload.expiresIn > 0) {
      message.expiresIn = payload.expiresIn
    }
    // MV3 页面侧 sendMessage 返回 Promise;"Extension not found"(ID 错/未装)、
    // 来源不在白名单等只出现在 rejection ⇒ 吞掉,绝不让它冒泡进登录链路。
    const ret = sendMessage.call(runtime, extensionId, message)
    if (ret && typeof (ret as Promise<unknown>).catch === 'function') {
      void (ret as Promise<unknown>).catch(() => {})
    }
    return true
  } catch {
    return false
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
