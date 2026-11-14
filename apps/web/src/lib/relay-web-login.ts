// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池「网页一键重登」平台能力注册表(2026-10-27 立,单一源)。
 *
 * ## 立因
 * 号池账号凭据死了,旧出路只有两条:管理员手头有导出 JSON 走后台导入,或回各平台
 * 客户端重新登录靠客户端回灌 —— 前者要人备料、后者要人记得开客户端。桌面端早已有
 * 「停靠浏览器网页登录 → cookie 换票 → 自动入库」的闭环(checkin_trae_web_login.rs,
 * 签到个人池在用);本注册表把这条能力**按平台登记**,供号池管理页「一键重登」复用:
 * 有链的平台点按钮直达,没链的平台明示未判定并点名当下真出路
 * (§0.3 取不到输入不猜;§0.8 不指跑不通的路)。
 *
 * ## 为什么其余平台有/没有链(取证事实,不是没写完)
 * - trae:GetUserToken 是官方 web 端纯 Cookie 换 JWT 的实证端点 ⇒ 有链。
 * - workbuddy:曾有链(O69 增补 2026-10-29,网页 Cookie 串直投号池),2026-11-12 F-060
 *   拆除:会话 Cookie 已从 probe 回包剥离(凭据不出 Rust,签到侧由 Rust 现读直投后端),
 *   号池需要的 token=Cookie 串在 JS 侧再无来源 ⇒ 一键重登链断,降回 none 并明示出路
 *   (半截链不许冒认,§0.3/§0.8)。若日后号池侧改走 Rust 直投入库,恢复该项为有链即可。
 * - qoder:登录态在客户端 auth.v1.dat,无网页 cookie 换票端点实证 ⇒ 不装。
 * - codearts:STS 凭据必须回华为云控制台取,本产品无法代取 ⇒ 不装。
 * 任何一格取证到落点后,把该项 kind 从 'none' 换成对应链并登记 URL/桥接即完成接入。
 */

import {
  TRAE_WEB_LOGIN_URL,
  checkinTraeWebLoginProbe,
  type TraeWebLoginProbe,
} from '@/lib/tauri-bridge'

/** 号池认的平台(与 api RELAY_PROVIDERS 同集;web 无 api 依赖,此处登记并锁形状) */
export const RELAY_WEB_LOGIN_PROVIDERS = ['trae', 'workbuddy', 'qoder', 'codearts'] as const
export type RelayWebLoginProvider = (typeof RELAY_WEB_LOGIN_PROVIDERS)[number]

/** 归一后的探测结果(号池页只认这三态,不直接吃各平台 probe 形状) */
export type RelayWebLoginProbe =
  | { status: 'ok'; account: RelayWebLoginAccount }
  | {
      status: 'waiting'
      /** 原始 no_window:见过窗口之后又没了 = 用户关了登录窗 */ windowGone?: boolean
    }
  | { status: 'error'; message: string }

export interface RelayWebLoginAccount {
  providerCode: RelayWebLoginProvider
  uid: string
  name: string
  /** 重登换到的凭据(trae=JWT);导入必须配 preserveMissingRefresh,否则毁旧 refreshToken */
  token: string
  /** token 到期 epoch 秒;上游没给则 null */
  expiresAt: number | null
  /**
   * 网页 Cookie 会话凭据投影(与 token 同值 ⇒ 额外落 cookies[] 进导入载荷、服务端存
   * cookiesEnc)。当前无生产方:唯一来源 workbuddy 已随 F-060 降 none(见文件头注),
   * 字段与投影保留为导入契约的一部分(仍由测试钉形状)。
   */
  webCookie?: string
}

interface WebLoginCapable {
  /** ipc-trae = 内嵌浏览器 → Cookie 换 JWT */
  kind: 'ipc-trae'
  /** 导入走的平台(号池页从此取值,不再硬编码 'trae') */
  providerCode: RelayWebLoginProvider
  /** 停靠浏览器打开的登录页 */
  loginUrl: string
  /** 停靠 Tab 标题 */
  tabTitle: string
  /** 平台专属探测 + 注册表内归一(号池页只吃 RelayWebLoginProbe 三态) */
  probe: () => Promise<RelayWebLoginProbe>
}

interface WebLoginUnavailable {
  kind: 'none'
  /** 明示未判定 + 当下真跑得通的出路(§0.3/§0.8) */
  reason: string
}

export const RELAY_WEB_LOGIN: Record<RelayWebLoginProvider, WebLoginCapable | WebLoginUnavailable> =
  {
    trae: {
      kind: 'ipc-trae',
      providerCode: 'trae',
      loginUrl: TRAE_WEB_LOGIN_URL,
      tabTitle: 'Trae 网页登录(号池重登)',
      probe: async () => normalizeTraeProbe(await checkinTraeWebLoginProbe()),
    },
    workbuddy: {
      kind: 'none',
      reason:
        'WorkBuddy 网页登录回包已剥离会话 Cookie(F-060:凭据不出 Rust),号池所需的 token=Cookie 串在 JS 侧无源 ⇒ 一键重登链断(2026-11-12 降 none,不冒认半截链)。' +
        '当下真出路:后台「导入账号」粘/拖导出 JSON,或 node scripts/relay-account-pool.mjs --file <json> --provider workbuddy(本机 WorkBuddy 桌面版在跑且已登录可用 --from workbuddy 取号)',
    },
    qoder: {
      kind: 'none',
      reason:
        'Qoder 登录态在客户端 auth.v1.dat,无网页 cookie 换票端点实证(未判定,不猜)。' +
        '当下真出路:后台「导入账号」粘/拖导出 JSON,或 node scripts/relay-account-pool.mjs --file <json> --provider qoder',
    },
    codearts: {
      kind: 'none',
      reason:
        'CodeArts 是华为云 STS 凭据,必须回华为云控制台重新取(本产品无法代取;网页换票端点未判定,不猜)。' +
        '当下真出路:取到新 STS 凭据后走后台导入账号 JSON;该平台无签到引擎,只做转发',
    },
  }

/** probe 归一(trae):no_window/no_cookie/not_logged_in 都是「还没登完」(waiting);ok 才出货。 */
export function normalizeTraeProbe(probe: TraeWebLoginProbe): RelayWebLoginProbe {
  if (probe.status === 'ok') {
    return {
      status: 'ok',
      account: {
        providerCode: 'trae',
        uid: probe.uid,
        name: probe.nickname || probe.uid,
        token: probe.token,
        expiresAt: probe.expires_at ?? null,
      },
    }
  }
  if (probe.status === 'error') return { status: 'error', message: probe.message }
  return { status: 'waiting', ...(probe.status === 'no_window' ? { windowGone: true } : {}) }
}

/**
 * probe 归一(workbuddy)已随 F-060(2026-11-12)删除:probe 回包剥离会话 Cookie 后,
 * 「token=Cookie 串」在 JS 侧无源,该归一只能产出空 token 的坏行 ⇒ 注册表同步降 none。
 */

/**
 * "k1=v1; k2=v2" → Chrome 导出口径的 cookies 条目({name,value})。
 * 非 name=value 形态的段直接丢(服务端校验对缺 name/value 的条目只告警并忽略,
 * 与其落一条被忽略的坏形,不如不落);不伪造 domain/expires_utc。
 */
export function webCookieHeaderToEntries(header: string): Array<{ name: string; value: string }> {
  const out: Array<{ name: string; value: string }> = []
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    const name = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (!name || !value) continue
    out.push({ name, value })
  }
  return out
}

/**
 * 归一账号 → 号池导入 payload(走同一条 /admin/relay/accounts/import 通道,不另起导入判据)。
 * 刻意不带 refreshToken:重登只换得到 access;调用方必须带 preserveMissingRefresh=true,
 * 否则导入服务按存量语义把库内旧票写 NULL(把能自续的号抹成待重登死号)。
 * webCookie(workbuddy 网页会话)额外投影 cookies[] ⇒ 服务端落 cookiesEnc。
 */
export function relayWebLoginAccountToImport(
  account: RelayWebLoginAccount,
): Record<string, unknown> {
  return {
    name: account.name,
    token: account.token,
    uid: account.uid,
    enabled: true,
    ...(account.webCookie ? { cookies: webCookieHeaderToEntries(account.webCookie) } : {}),
    ...(account.expiresAt !== null
      ? { expiresAt: new Date(account.expiresAt * 1000).toISOString() }
      : {}),
  }
}
