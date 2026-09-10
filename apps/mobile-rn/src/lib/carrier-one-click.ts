// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 运营商一键登录连接器(mobile-rn 端)——"搭接 + 可插拔"双路径方案
 *
 * 平台策略(尝试顺序):
 *   ① 原生 turbo 模块 `NativeModules.CarrierOneClickTurboModule`(EEX 闪验/各运营商 SDK,
 *      需出 dev build 后由原生端实现 `.kt`/`.swift` 桥接 — 见 plugins/withCarrier.js)
 *   ② WebView/H5 一键登录(读 app config extra / env `CARRIER_WEB_SDK_URL`,
 *      用 react-native-webview 加载 H5 SDK,真机浏览器无运营商原生 SDK 时的兜底/降级)
 *   ③ 以上均未配置 → throw `CARRIER_NOT_CONFIGURED`(UI 据错误码降级到短信验证码登录)
 *
 * 与 @ihui/api-client 的 `loginByCarrierOneClick({ accessToken, operator })` 契约衔接:
 * 本模块只负责"设备侧拿号/拿 token",换 JWT 的业务调用由 UI 层完成(LoginScreen.handleCarrierOneClickLogin)。
 *
 * 设计原则(对齐 lib/wechat.ts 的"仅 native"判断模式):
 * - 纯 TS 函数,模块加载无任何运行时副作用(无模块级 hydrate / 无顶层调用),便于 tsc 校验。
 * - isCarrierAvailable() 同步判断,供 UI 决定是否渲染"一键登录"按钮;未配置返回 false(隐藏按钮)。
 * - getRecentPhone() 免费自动回填:读本地登录历史(与 web 端同 key `ihui-login-history`)。
 */

import { NativeModules, Platform } from 'react-native'
import { credentialStorage } from './credential-storage'

// =============================================================================
// 错误码(UI 据此决定降级路径)
// =============================================================================

export const CARRIER_ERROR = {
  /** 未配置任一运营商通道 */
  NOT_CONFIGURED: 'CARRIER_NOT_CONFIGURED',
  /** 原生 SDK 调用失败(网络/用户拒绝授权等) */
  LOGIN_FAILED: 'CARRIER_LOGIN_FAILED',
  /** H5 一键登录结果缺失/超时 */
  WEB_TIMEOUT: 'CARRIER_WEB_TIMEOUT',
} as const

export type CarrierErrorCode = (typeof CARRIER_ERROR)[keyof typeof CARRIER_ERROR]

/** 运营商一键登录错误(带错误码,便于上层精确降级) */
export class CarrierOneClickError extends Error {
  readonly code: CarrierErrorCode
  constructor(code: CarrierErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'CarrierOneClickError'
    this.code = code
  }
}

// =============================================================================
// 类型定义(对齐 @ihui/api-client 的 CarrierOperator)
// =============================================================================

/** 运营商(一键登录通道)枚举:flashverify 闪验 / cmcc 移动 / cucc 联通 / ctcc 电信 */
export type CarrierOperator = 'flashverify' | 'cmcc' | 'cucc' | 'ctcc'

/** carrierLogin 返回体:phone 供回填/展示,accessToken+operator 供 loginByCarrierOneClick 换 JWT */
export interface CarrierLoginResult {
  /** 本机手机号(原生/H5 均可能透传;部分原生通道只有 token,此时可能为空串,UI 用 getRecentPhone 兜底) */
  phone: string
  /** 运营商 SDK 校验成功后下发的 accessCode(闪验)或网关 token */
  accessToken?: string
  /** 通道运营商,默认 flashverify(闪验) */
  operator?: CarrierOperator
  /** 本次一键登录使用的路径:'native' | 'web' */
  via?: 'native' | 'web'
}

// =============================================================================
// 配置读取(单一数据源:env 优先,与 withCarrier.js 注入约定一致)
// =============================================================================

/**
 * 闪验(FlashVerify/创蓝闪验)开放平台应用 AppID(EXPO_PUBLIC_CARRIER_APP_ID)。
 * 原生 SDK 初始化必须有 appId;未配置则视为"未接入",UI 隐藏一键登录入口。
 */
export function getCarrierAppId(): string | null {
  const appId = process.env.EXPO_PUBLIC_CARRIER_APP_ID
  return appId && appId.length > 0 ? appId : null
}

/** WebView/H5 一键登录地址(未配置返回 null) */
export function getCarrierWebUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_CARRIER_WEB_SDK_URL
  return url && url.length > 0 ? url : null
}

// =============================================================================
// 原生模块检测(仅 native)
// =============================================================================

/**
 * 原生一键登录桥接模块契约(原生桥接由 plugins/withCarrier.js 生成,
 * 见同目录 CarrierOneClickModule.java / CarrierOneClickTurboModule.swift):
 *   initialize(appId): Promise<boolean> 初始化闪验 SDK(code 1022 为成功)
 *   oneClickLogin(): Promise<{ phone?; accessToken?; code?; operator? }>
 *     拉起授权页并回调换取 token;code 1000 成功,result 为 {"token":"..."}。
 * 桥接用反射加载闪验 SDK,未打 aar/pod 时调用会返回失败(模块虽存在但登录报错,
 * UI 据错误码降级到短信验证码)。web 平台恒为 null。
 */
interface CarrierOneClickNative {
  initialize: (appId: string) => Promise<boolean>
  oneClickLogin: () => Promise<{
    phone?: string
    accessToken?: string
    code?: string
    operator?: CarrierOperator
  }>
}

const NATIVE_MODULE_NAME = 'CarrierOneClickTurboModule'

function getNativeModule(): CarrierOneClickNative | null {
  if (Platform.OS === 'web') return null
  const native = NativeModules as Record<string, CarrierOneClickNative | undefined>
  const mod = native?.[NATIVE_MODULE_NAME]
  return mod && typeof mod.initialize === 'function' && typeof mod.oneClickLogin === 'function'
    ? mod
    : null
}

/** 是否已装入原生桥接模块(仅 native,同步判断;不含 appId 校验) */
export function isCarrierNativeAvailable(): boolean {
  return getNativeModule() !== null
}

/**
 * 惰性初始化闪验 SDK(整个 App 生命周期只初始化一次,成功即缓存)。
 * 失败(未打 aar/pod、签名/包名不匹配、网络等)时清空缓存允许重试并返回 false。
 */
let initPromise: Promise<boolean> | null = null

export async function ensureCarrierInitialized(): Promise<boolean> {
  const native = getNativeModule()
  const appId = getCarrierAppId()
  if (!native || !appId) return false
  if (initPromise === null) {
    initPromise = native.initialize(appId).then(
      (ok) => {
        if (!ok) initPromise = null // 允许下次重试
        return ok
      },
      (err) => {
        initPromise = null
        throw err
      },
    )
  }
  return initPromise
}

// =============================================================================
// WebView/H5 一键登录 —— "可插拔"hock:carrierLogin 在 web 分支挂起等待,
// UI 层用 react-native-webview 加载 getCarrierWebUrl() 并把 onMessage 结果喂给 resolveCarrierWebResult。
// =============================================================================

let webResolve: ((r: CarrierLoginResult) => void) | null = null
let webReject: ((e: Error) => void) | null = null

/**
 * WebView onMessage 投递的一键登录结果。
 * 约定 H5 页面通过 `window.ReactNativeWebView.postMessage(JSON.stringify({ phone, accessToken, operator }))`
 * 回传;UI 侧 WebView 的 onMessage 解析后调用本函数,carrierLogin 挂起的 Promise 随即 resolve。
 */
export function resolveCarrierWebResult(input: string | CarrierLoginResult): void {
  const data = typeof input === 'string' ? safeParseResult(input) : input
  if (!data?.phone && !data?.accessToken) {
    webReject?.(
      new CarrierOneClickError(CARRIER_ERROR.LOGIN_FAILED, 'H5 一键登录未返回有效手机号/token'),
    )
    webResolve = null
    webReject = null
    return
  }
  webResolve?.({
    phone: data.phone,
    accessToken: data.accessToken,
    operator: data.operator ?? 'flashverify',
    via: 'web',
  })
  webResolve = null
  webReject = null
}

function safeParseResult(raw: string): { phone: string; accessToken?: string; operator?: CarrierOperator } | null {
  try {
    const obj = JSON.parse(raw) as {
      phone?: string
      accessToken?: string
      token?: string
      operator?: CarrierOperator
    }
    return {
      phone: obj.phone ?? '',
      accessToken: obj.accessToken ?? obj.token,
      operator: obj.operator,
    }
  } catch {
    // 非 JSON(H5 可能只回普通字符串手机号)
    const digits = raw.replace(/\D/g, '')
    return digits.length >= 11 ? { phone: raw, accessToken: undefined } : null
  }
}

async function carrierLoginViaWeb(url: string): Promise<CarrierLoginResult> {
  // url 为 H5 一键登录地址(UI 侧用 getCarrierWebUrl() 加载同一地址渲染 WebView);
  // 双保险:即便调用时地址为空,也明确落回"未配置"而不是永久等待。
  if (!url) {
    throw new CarrierOneClickError(CARRIER_ERROR.NOT_CONFIGURED, '未配置运营商一键登录 H5 地址')
  }
  return new Promise<CarrierLoginResult>((resolve, reject) => {
    webResolve = resolve
    webReject = reject
    // UI 侧已用 getCarrierWebUrl() 检测到该地址并渲染 WebView。
    // 兜底:若 UI 未挂载 WebView,30s 后超时落回失败(避免永久等待)。
    setTimeout(() => {
      webReject?.(
        new CarrierOneClickError(CARRIER_ERROR.WEB_TIMEOUT, 'H5 一键登录超时,请重试'),
      )
      webResolve = null
      webReject = null
    }, 30_000)
  })
}

// =============================================================================
// 主入口
// =============================================================================

/**
 * 运营商一键登录。尝试顺序:① 原生桥接模块(初始化→拉起授权页) → ② WebView/H5 → ③ throw CARRIER_NOT_CONFIGURED。
 * 返回:本机手机号 + 运营商 token(供 loginByCarrierOneClick 使用)。
 */
export async function carrierLogin(): Promise<CarrierLoginResult> {
  // ① 原生桥接模块(需出 dev build 打闪验 aar/pod;反射未命中时登录报错降级)
  const native = getNativeModule()
  if (native) {
    const ok = await ensureCarrierInitialized()
    if (!ok) {
      throw new CarrierOneClickError(CARRIER_ERROR.LOGIN_FAILED, '运营商一键登录初始化失败')
    }
    const res = await native.oneClickLogin()
    return {
      phone: res.phone ?? '',
      accessToken: res.accessToken ?? res.code,
      operator: res.operator ?? 'flashverify',
      via: 'native',
    }
  }

  // ② WebView/H5 一键登录(读 app config extra / env CARRIER_WEB_SDK_URL)
  const webUrl = getCarrierWebUrl()
  if (webUrl) {
    return await carrierLoginViaWeb(webUrl)
  }

  // ③ 未配置任一通道
  throw new CarrierOneClickError(CARRIER_ERROR.NOT_CONFIGURED, '未配置运营商一键登录通道')
}

/**
 * 当前环境是否已接入运营商一键登录(原生桥接 + appId,或 H5 地址)。
 * UI 据此决定是否渲染"一键登录"按钮;false 时隐藏该按钮(降级到短信验证码 + 免费自动回填)。
 * 原生通道要求 appId 已配置(build 期 EXPO_PUBLIC_CARRIER_APP_ID),否则视为未接入。
 */
export function isCarrierAvailable(): boolean {
  const nativeReady = isCarrierNativeAvailable() && getCarrierAppId() !== null
  return nativeReady || getCarrierWebUrl() !== null
}

/** 当前生效的通道类型(供 UI 决定开 WebView 还是走原生),未接入返回 null */
export function getCarrierChannel(): 'native' | 'web' | null {
  if (isCarrierNativeAvailable() && getCarrierAppId() !== null) return 'native'
  if (getCarrierWebUrl()) return 'web'
  return null
}

// =============================================================================
// 免费自动回填:最近一次登录手机号(与 web 端同存储 key 'ihui-login-history')
// =============================================================================

/**
 * 读取最近一次登录手机号,用于手机号 tab 默认回填(对齐 web 端已实现行为)。
 * 数据源:本地登录历史 `ihui-login-history`(credential-storage 已维护同名 key,
 * 首个条目为最近登录账号)。未登录过返回 null。
 */
export function getRecentPhone(): string | null {
  const history = credentialStorage.loadLoginHistory()
  // 取第一条作为最近登录账号;仅当它是纯数字手机号才回填
  const recent = history?.[0]
  if (!recent) return null
  if (!/^\d{7,11}$/.test(recent)) return null
  return recent
}
// ⁠​‌​​‌​​‌
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
