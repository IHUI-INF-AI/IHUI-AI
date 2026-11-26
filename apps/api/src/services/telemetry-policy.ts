// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { z } from 'zod'
import { SECRET_RULES, redactEmails, redactIps, redactSecrets, redactUrl } from '@ihui/shared/utils/redact'

/**
 * RP-20 / L10 遥测本地默认与命令原文零外发。
 *
 * 判据（docs/benchmark-evidence/2026-11/wave2-ihui-landing-v2-2026-11-26.md L10）:
 *   默认本地 OTLP collector、远端需显式开关;PII/凭据/命令行参数白名单过滤;
 *   敏感命令只打类型与规则命中不写原文;采样率可配。
 *
 * 设计纪律:
 *   1. 端点默认 127.0.0.1:4318;远端只有 `ZCODE_TELEMETRY_REMOTE=true` 且 endpoint
 *      是合法 http(s) URL 才生效;任何非回环的本地 endpoint 一律拒绝并回退本地默认
 *      —— 不因配置错误把遥测端口推到公网;
 *   2. 凭据正则直接复用 `@ihui/shared/utils/redact` 的 SECRET_RULES,不在端内另造第二套;
 *   3. 命令类事件的出仓面只有 commandType + matchedRules(source 名) + argCount,
 *      原文、argv、prompt 一律不进输出;
 *   4. 非命令类事件按白名单键过滤后递归脱敏,未知键整键丢弃;
 *   5. 采样率非法(非数/越界)整份回退到 1(全采),不静默取一个偏小的数。
 *
 * 与 §5e 邮件单通道口径不冲突:本模块只决定遥测 endpoint 与事件内容,不发邮件。
 */

export const DEFAULT_OTLP_ENDPOINT = 'http://127.0.0.1:4318'
export const TELEMETRY_PROP_ALLOWLIST = [
  'durationMs',
  'status',
  'errorCode',
  'model',
  'toolName',
  'eventType',
  'version',
  'platform',
  'commandType',
  'matchedRules',
  'argCount',
  'count',
] as const

const allowedPropSet: ReadonlySet<string> = new Set(TELEMETRY_PROP_ALLOWLIST)
const COMMAND_KEY = /(command|argv|cmd|shell|exec|prompt|args)/i

const sampleRateSchema = z.number().min(0).max(1)
const endpointSchema = z.string().url().refine((v) => /^https?:\/\//i.test(v), '仅支持 http(s) OTLP endpoint')

export interface TelemetryPolicy {
  localEndpoint: string
  remoteEnabled: boolean
  remoteEndpoint: string | null
  sampleRate: number
  allowedProps: readonly string[]
}

export interface TelemetryResolution {
  policy: TelemetryPolicy
  violations: string[]
}

export interface TelemetryEnv {
  ZCODE_TELEMETRY_REMOTE?: string
  ZCODE_TELEMETRY_REMOTE_ENDPOINT?: string
  ZCODE_TELEMETRY_LOCAL_ENDPOINT?: string
  ZCODE_TELEMETRY_SAMPLE_RATE?: string
  ZCODE_TELEMETRY_ALLOWED_ARGS?: string
}

export const DEFAULT_TELEMETRY_POLICY: Readonly<TelemetryPolicy> = Object.freeze({
  localEndpoint: DEFAULT_OTLP_ENDPOINT,
  remoteEnabled: false,
  remoteEndpoint: null,
  sampleRate: 1,
  allowedProps: TELEMETRY_PROP_ALLOWLIST,
})

function isLoopbackEndpoint(value: string): boolean {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    return host === '127.0.0.1' || host === 'localhost' || host === '::1'
  } catch {
    return false
  }
}

/** 配置解析:任何非法项都记 violation 并回退默认,不让半份配置生效。 */
export function resolveTelemetryPolicy(env: TelemetryEnv = {}): TelemetryResolution {
  const violations: string[] = []
  let localEndpoint = DEFAULT_OTLP_ENDPOINT
  if (env.ZCODE_TELEMETRY_LOCAL_ENDPOINT !== undefined) {
    const candidate = env.ZCODE_TELEMETRY_LOCAL_ENDPOINT.trim()
    if (!endpointSchema.safeParse(candidate).success || !isLoopbackEndpoint(candidate)) {
      violations.push('ZCODE_TELEMETRY_LOCAL_ENDPOINT 必须是 http(s) 回环地址')
    } else {
      localEndpoint = candidate
    }
  }

  const remoteRequested = env.ZCODE_TELEMETRY_REMOTE?.trim() === 'true'
  let remoteEndpoint: string | null = null
  if (remoteRequested) {
    const candidate = env.ZCODE_TELEMETRY_REMOTE_ENDPOINT?.trim() ?? ''
    if (!endpointSchema.safeParse(candidate).success || isLoopbackEndpoint(candidate)) {
      violations.push('远端开关已开但 ZCODE_TELEMETRY_REMOTE_ENDPOINT 不是合法非回环 http(s) URL')
    } else {
      remoteEndpoint = candidate
    }
  }

  let sampleRate = 1
  const rawRate = env.ZCODE_TELEMETRY_SAMPLE_RATE?.trim()
  if (rawRate !== undefined && rawRate !== '') {
    const parsed = sampleRateSchema.safeParse(Number(rawRate))
    if (!parsed.success || rawRate === '' || Number.isNaN(Number(rawRate))) {
      violations.push('ZCODE_TELEMETRY_SAMPLE_RATE 必须是 0..1 的数值')
    } else {
      sampleRate = parsed.data
    }
  }

  const allowedProps: string[] = [...TELEMETRY_PROP_ALLOWLIST]
  const rawArgs = env.ZCODE_TELEMETRY_ALLOWED_ARGS?.trim()
  if (rawArgs) {
    const candidates = rawArgs
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
    const invalid = candidates.filter((v) => !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v))
    if (invalid.length) {
      violations.push(`ZCODE_TELEMETRY_ALLOWED_ARGS 含非法参数名: ${invalid.join(',')}`)
    } else {
      allowedProps.push(...candidates.filter((v) => !allowedPropSet.has(v)))
    }
  }

  return {
    policy: {
      localEndpoint,
      remoteEnabled: remoteEndpoint !== null,
      remoteEndpoint,
      sampleRate,
      allowedProps,
    },
    violations,
  }
}

/** 远端默认不开:只有显式开关 + 合法 endpoint 才返回远端地址。 */
export function selectOtlpEndpoint(policy: TelemetryPolicy): string {
  return policy.remoteEnabled && policy.remoteEndpoint ? policy.remoteEndpoint : policy.localEndpoint
}

export function shouldSample(policy: TelemetryPolicy, random: () => number = Math.random): boolean {
  if (policy.sampleRate <= 0) return false
  if (policy.sampleRate >= 1) return true
  const value = random()
  return Number.isFinite(value) && value >= 0 && value < 1 && value < policy.sampleRate
}

export interface TelemetryEventInput {
  name: string
  timestamp: number
  props?: Record<string, unknown>
}

export interface SanitizedTelemetryEvent {
  name: string
  timestamp: number
  category: 'command' | 'metric'
  props: Record<string, unknown>
}

function cleanText(value: string): string {
  return redactUrl(redactIps(redactEmails(redactSecrets(value))))
}

function isCommandEvent(event: TelemetryEventInput): boolean {
  if (COMMAND_KEY.test(event.name)) return true
  return Object.keys(event.props ?? {}).some((key) => COMMAND_KEY.test(key))
}

function matchedSecretSources(value: unknown): string[] {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '')
  const hits = new Set<string>()
  for (const rule of SECRET_RULES) {
    // 清掉 g 标志再 test,避免全局正则 lastIndex 在多条事件之间串味。
    const detector = new RegExp(rule.pattern.source, rule.pattern.flags.replace('g', ''))
    if (detector.test(text)) hits.add(rule.source)
  }
  return [...hits].sort()
}

function cleanValue(value: unknown, depth: number): unknown {
  if (depth > 3) return undefined
  if (typeof value === 'string') return cleanText(value)
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => cleanValue(item, depth + 1)).filter((v) => v !== undefined)
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value)) {
      if (!allowedPropSet.has(key)) continue
      const cleaned = cleanValue(nested, depth + 1)
      if (cleaned !== undefined) result[key] = cleaned
    }
    return result
  }
  return value
}

/**
 * 出仓前最后一道脱敏:命令类事件只留类型/规则命中/参数个数,
 * 其余事件按白名单键过滤后递归脱敏,原文与凭据不入 props。
 */
export function sanitizeTelemetryEvent(
  event: TelemetryEventInput,
  policy: TelemetryPolicy,
): SanitizedTelemetryEvent {
  const props = event.props ?? {}
  const name = cleanText(event.name).slice(0, 64)
  if (isCommandEvent(event)) {
    const argValue = props.argv ?? props.args ?? props.command ?? props.cmd
    const argCount = Array.isArray(argValue)
      ? argValue.length
      : typeof argValue === 'string'
        ? argValue.trim().split(/\s+/).filter(Boolean).length
        : 0
    const commandType = typeof props.commandType === 'string'
      ? cleanText(props.commandType)
      : name
    return {
      name,
      timestamp: event.timestamp,
      category: 'command',
      props: {
        commandType: commandType.slice(0, 64),
        matchedRules: matchedSecretSources(argValue ?? props),
        argCount,
      },
    }
  }
  const cleaned: Record<string, unknown> = {}
  for (const key of Object.keys(props)) {
    if (!policy.allowedProps.includes(key) && !allowedPropSet.has(key)) continue
    const value = cleanValue(props[key], 0)
    if (value !== undefined) cleaned[key] = value
  }
  return { name, timestamp: event.timestamp, category: 'metric', props: cleaned }
}
