// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「冷启动要不要静默登回」的唯一决策出口(跨端共享,零平台依赖)。
 *
 * 立因:这条判据最早只落在 RN 一端(`apps/mobile-rn/src/lib/auto-login-policy.ts`),
 * 而 web 与小程序有同一型缺陷 —— 用户按了「退出登录」,下一次冷启动应用自己登回去。
 * 三端各写一份同形逻辑正是本仓最高频的失效型:改判据只会改一处,另两处静默留在旧行为上。
 * 所以判据住在这里,各端只注入自己的 storage adapter(读写方式不同,结论必须相同)。
 *
 * 为什么"登出标记"必须优先且必须持久:
 * 各端清的都是**凭据**(token / cookie),而"自动登录开关"与"记住的账密"这两份勾选状态
 * 从来不被登出路径清掉(RN 的唯一清除点是"取消记住密码"那个勾选动作)。所以只看后两者,
 * 登出后的冷启动必然满足静默重登条件。标记活得比凭据久,才压得住历史勾选。
 *
 * 纯度:本文件是纯函数 + 一个常量,不 import 任何 `node:` 内建、不触 DOM/RN/Taro API
 * (守门 126:packages/shared 的非 Node 宿主可达闭包内禁止出现 node: 内建)。
 * 落盘的读写一律在端内,由调用方以 thunk 注入。
 */

/**
 * 三端同名的持久登出标记 storage key(RN AsyncStorage / web localStorage / Taro storage)。
 *
 * 值本身不重要(各端落的是"会话结束时的代次/时间戳",判据只看**存在性**),
 * 名字必须同源:一份 key 名在端间漂移,就等于三端各有各的标记。
 * RN 侧现值住在 `apps/mobile-rn/src/lib/token.ts` 的 `SESSION_LOGGED_OUT_KEY`,与此同值。
 */
export const SESSION_LOGGED_OUT_STORAGE_KEY = 'ihui-session-logged-out'

/** 静默重登的全部输入,一律以 thunk 注入(判据不主动读盘,读盘失败由端自己决定失效方向)。 */
export interface SilentReloginDeps {
  /** 本机是否处于"已显式登出 / 会话失效"状态(持久标记,活得比凭据久) */
  sessionLoggedOut: () => boolean
  /**
   * 该端在"登出标记之外"还要求成立的条件,全部成立才登回。
   *
   * 省略或空数组 = 这一端除了登出标记没有别的准入条件(例:小程序的 wx/支付宝静默登录
   * 凭的是平台 code,不是盘上账密,也没有用户勾选位)。**不得**为了凑三键形状把
   * 不存在的条件写成 `() => true` —— 那是给判据造假输入,而不是复用判据。
   */
  gates?: readonly (() => boolean)[]
}

/**
 * 核心判据:登出标记优先,其余条件缺一不可。
 *
 * 三个输入分别住在三个地方,而它决定的是"用户按了退出之后,应用会不会自己登回去" ——
 * 一句话可判、必须可测,所以单独成函数而不是并进某个 UI 的挂载 effect 里。
 */
export function canSilentlyReLogin(deps: SilentReloginDeps): boolean {
  // 登出标记排在最前:"用户刚刚主动退出"必须压过任何历史勾选。
  if (deps.sessionLoggedOut()) return false
  return (deps.gates ?? []).every((gate) => gate())
}

/** 账密静默重登的勾选位(登录页那两个 checkbox)。 */
export interface AutoLoginDeps {
  /** 本机是否处于"已显式登出 / 会话失效"状态(持久标记,活得比凭据久) */
  sessionLoggedOut: () => boolean
  /** 用户是否勾选过"自动登录" */
  hasAutoLoginFlag: () => boolean
  /** 盘上是否还留着可用凭据 */
  hasRememberedCredentials: () => boolean
}

/**
 * 「进登录页要不要用记住的账密静默重登」——`canSilentlyReLogin` 的账密形状投影。
 *
 * 两个勾选位缺一不可:只勾了自动登录但没记住密码(或反之)都不构成静默重登的条件。
 * RN 与 web 的账密自动登录走这一支;小程序的静默登录没有勾选位,走 `canSilentlyReLogin`。
 */
export function shouldAttemptAutoLogin(deps: AutoLoginDeps): boolean {
  return canSilentlyReLogin({
    sessionLoggedOut: deps.sessionLoggedOut,
    gates: [deps.hasAutoLoginFlag, deps.hasRememberedCredentials],
  })
}

/**
 * 静默刷新失败的性质 —— 决定「这次失败要不要升级成持久登出标记」的唯一输入。
 *
 * - `rejected`:服务端**明确拒绝了凭据**(refresh 端点返回 401/403)。token 真死了,
 *   落标记与现状语义一致(「会话失效」本就属于标记覆盖范围)。
 * - `transient`:瞬时不可用 —— 网络错误、超时、api 服务重启中、5xx。凭据没有被否定,
 *   只是此刻问不出答案;下一次冷启动带着同一份 httpOnly cookie 重试即可恢复。
 * - `null`:性质未知(刷新结果被 CAS 丢弃 / 未注入续期实现 / 记录不可得)。
 */
export type RefreshFailureKind = 'rejected' | 'transient'

/**
 * HTTP 状态码 → 刷新失败性质。仅 401/403 算「凭据被明确拒绝」;
 * 其余(5xx、0、undefined=网络错误/超时)一律瞬时。
 */
export function classifyRefreshFailureStatus(status: number | undefined): RefreshFailureKind {
  return status === 401 || status === 403 ? 'rejected' : 'transient'
}

/**
 * 冷启动静默刷新失败后,**要不要写持久登出标记**(即要不要从此永久压制自动登录)。
 *
 * 2026-10-09 根治「自动登录总被清掉」:此前 bootstrap 把**任何**刷新失败(含 api 重启/
 * 网络抖动导致的瞬时失败)都当凭据失效走 `logout()` → 落标记 → 即使 30 天 refresh
 * cookie 仍有效,冷启动也再不去用它,用户被迫反复手动登录。现在只有 `rejected`
 * (服务端明确说"这个 token 不行")才允许写标记。
 *
 * 失效方向与 session-marker 同形:`null`(未知)一律**不写** —— 抑制自动登录是改变
 * 用户可见行为的动作,不能由一次未知失败触发;瞬时失败后保持现状,下一次冷启动自然重试。
 */
export function shouldMarkSessionLoggedOut(failure: RefreshFailureKind | null): boolean {
  return failure === 'rejected'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
