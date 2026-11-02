// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 宿主能力端口运行时闸(M4 T1,2026-11-02 立)。
 *
 * 共享屏只声明"我需要哪条腿",由宿主壳注入。缺腿必须当场可见,不能静默降级:
 * - 必填端口:`assertRequiredPort` —— dev 直接 throw `[host-port] missing <name>`;
 *   prod 返回错误态标记并 console.error 一次(同名单次进程只报一次)。
 * - 可选端口:`resolveOptionalPort` —— 缺省返回显式 `capability-off` 哨兵,
 *   绝不返回 noop(noop 会把"能力缺失"伪装成"调用成功")。
 *
 * 本文件只做类型与运行时闸,不接任何屏;T3 起由各宿主壳按屏接线。
 */

import type {
  ListPort,
  MediaPort,
  NavParams,
  OnNavigate,
  OnToast,
  PayResult,
  ScreenParams,
  SessionPort,
  UiPort,
  KvPort,
} from '@ihui/types'

export type {
  ListPort,
  MediaPort,
  NavParams,
  OnNavigate,
  OnToast,
  PayResult,
  ScreenParams,
  SessionPort,
  UiPort,
  KvPort,
}

/** 可选端口缺省时唯一合法取值:能力关(调用方必须显式分支)。 */
export const CAPABILITY_OFF = 'capability-off' as const
export type CapabilityOff = typeof CAPABILITY_OFF

/** prod 下必填端口缺失时返回的错误态标记(与正常端口值可判别)。 */
export interface PortErrorState {
  readonly __hostPortError: true
  readonly name: string
  readonly message: string
}

export function isPortErrorState(value: unknown): value is PortErrorState {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { __hostPortError?: unknown }).__hostPortError === true
  )
}

export function isCapabilityOff(value: unknown): value is CapabilityOff {
  return value === CAPABILITY_OFF
}

/**
 * dev 判定不直接写 `process.env` 标识符:共享包同时被 RN / 小程序 / web 消费,
 * 三端 env 注入方式不同,`__DEV__` 优先、`process.env.NODE_ENV` 兜底;
 * 取不到 NODE_ENV 时按 dev 处理(宁可早抛,不可把缺腿静默带进产物)。
 */
function isDevBuild(): boolean {
  const g = globalThis as {
    __DEV__?: unknown
    process?: { env?: { NODE_ENV?: string } }
  }
  if (typeof g.__DEV__ === 'boolean') return g.__DEV__
  return g.process?.env?.NODE_ENV !== 'production'
}

const reported = new Set<string>()

/**
 * 已知空实现黑名单:`() => {}` / `() => undefined` 这类函数在运行时"有值",
 * 但整条能力会被静默吞掉 —— 这是端口层最常见的假绿形态。
 * 只按函数来源文本精确匹配匿名空实现;绑定函数 / native code 的 toString 不可判定,
 * 不做猜测(静态无法判断时至少拦住前两种)。
 */
const KNOWN_EMPTY_IMPLEMENTATIONS = new Set([
  '()=>{}',
  '()=>undefined',
  '()=>void0',
  '()=>{return}',
  '()=>{returnundefined}',
  '()=>{returnvoid0}',
  'function(){}',
  'function(){return}',
  'function(){returnundefined}',
  'function(){returnvoid0}',
])

export function isKnownEmptyImplementation(value: unknown): boolean {
  if (typeof value !== 'function') return false
  const source = Function.prototype.toString.call(value).replace(/\s+/g, '')
  return KNOWN_EMPTY_IMPLEMENTATIONS.has(source)
}

/**
 * 必填端口运行时闸。
 * - 有值 ⇒ 原样返回(含 falsy 以外的合法对象/函数)。
 * - 已知空实现 ⇒ 与缺腿同判:dev throw / prod 错误态(绝不把 noop 当端口)。
 * - dev 缺失 ⇒ `throw new Error('[host-port] missing <name>')`。
 * - prod 缺失 ⇒ 返回 `PortErrorState` 并 console.error 一次(同名进程内仅一次)。
 */
export function assertRequiredPort<T>(
  name: string,
  value: T | null | undefined,
): T | PortErrorState {
  if (value !== null && value !== undefined && !isKnownEmptyImplementation(value)) return value

  const message =
    value === null || value === undefined
      ? `[host-port] missing ${name}`
      : `[host-port] empty implementation ${name}`
  if (isDevBuild()) throw new Error(message)

  if (!reported.has(name)) {
    reported.add(name)
    console.error(message)
  }
  return { __hostPortError: true, name, message }
}

/**
 * 可选端口归一:有值原样返回,缺省落 `capability-off`。
 * 不吞错、不造 noop,调用方必须显式判断 `isCapabilityOff` 后再决定降级形态。
 */
export function resolveOptionalPort<T>(value: T | null | undefined): T | CapabilityOff {
  if (value !== null && value !== undefined) return value
  return CAPABILITY_OFF
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
