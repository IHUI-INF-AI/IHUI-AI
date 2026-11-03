// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 自由文本里的凭据打码 —— **日志面唯一出口**(叶子模块,零本地依赖)。
 *
 * 原先这道出口住在 `plugins/log-sanitizer.ts` 里,而那个模块引 `response-sanitizer`
 * → `utils/crypto` → `config` → `utils/logger`。把出口接到根 logger 上就会构成
 * 4 跳 ESM 环(表现为某个模块加载期拿到 undefined)。规则本身从来只有一份
 * (`@ihui/shared/utils/redact` 的 `redactUrl` + `SECRET_RULES`),这里只是**组合**;
 * 组合既然要能被最底层的落盘点用到,就只能住在叶子上。
 */
import { redactUrl, SECRET_RULES } from '@ihui/shared/utils/redact'

export function redactCredentialText(text: string): string {
  let out = redactUrl(text)
  for (const rule of SECRET_RULES) out = out.replace(rule.pattern, rule.replacement)
  return out
}

/**
 * pino `redact.paths` —— 结构化字段的**字段名**脱敏清单(与自由文本打码互补)。
 *
 * 为什么清单要住在叶子模块:它被 `server.ts` 的 loggerConfig 消费,而那份配置同时
 * 服务"errorHandler 的独立 pino 实例"和"Fastify 的 server logger"两处。测试必须能
 * 拿到**同一份**清单去构造真 pino 实例验证,否则就是复制判据(§0.6)——复制出来的
 * 第二份必然在某次改动后与线上那份漂开,而漂开的那天没有任何东西会红。
 *
 * 覆盖面与边界:
 * - 只认字段名,管不了 message 里内嵌的凭据串 —— 那一半归 redactCredentialText;
 * - 通配符按层展开(`*` 匹配一级),所以分列一层与两层两档;更深的路径靠显式列出;
 * - 命中即整体替换为 ***,不做部分保留 —— 凭据类字段没有"保留后四位"的业务需求。
 */
export const LOG_REDACT_PATHS: readonly string[] = [
  // 请求头:最常见的落点,显式列出不依赖通配
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["x-internal-auth"]',
  'req.headers["x-ihui-principal"]',
  // 一层通配:覆盖 { err: { apiKey } } / { body: { token } } 这类形状
  '*.password',
  '*.passwd',
  '*.secret',
  '*.token',
  '*.apikey',
  '*.apiKey',
  '*.api_key',
  '*.authorization',
  '*.cookie',
  '*.dsn',
  '*.credential',
  '*.privateKey',
  '*.private_key',
  '*.accessToken',
  '*.refreshToken',
  // 两层通配:覆盖 { err: { config: { headers: { authorization } } } } 这类上游 SDK 错误
  '*.*.password',
  '*.*.secret',
  '*.*.token',
  '*.*.apiKey',
  '*.*.api_key',
  '*.*.authorization',
  '*.*.credential',
  // 三层通配:上游 SDK 的错误体最常见就是 err.config.headers.authorization(三层)。
  // 这一档是被测试逼出来的 —— 起初只写到两层,`{err:{config:{headers:{authorization}}}}`
  // 原样落盘,用例当场翻红。pino 的 `*` 只匹配一级,不写就真的够不着。
  '*.*.*.authorization',
  '*.*.*.apiKey',
  '*.*.*.api_key',
  '*.*.*.secret',
  '*.*.*.token',
  '*.*.*.credential',
]

/** 命中 LOG_REDACT_PATHS 时写入的占位串。 */
export const LOG_REDACT_CENSOR = '***'

/**
 * 递归打码字符串叶子;对象/数组形状保持不变。
 *
 * **只进普通对象与数组**,其余对象(尤其 Error)原样返回:调用方常见的写法是
 * `logger.error(msg, { err })`,pino 对 `err` 键自带标准错误序列化,把它 walk 成
 * 普通对象会得到 `{}`(Error 的 name/message/stack 都是非枚举自有属性)——那不是
 * 脱敏,那是把日志现场毁掉。
 */
export function redactCredentialStrings(value: unknown): unknown {
  if (typeof value === 'string') return redactCredentialText(value)
  if (Array.isArray(value)) return value.map(redactCredentialStrings)
  if (value && typeof value === 'object' && isPlainObject(value)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactCredentialStrings(v)
    }
    return out
  }
  return value
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value) as object | null
  return proto === Object.prototype || proto === null
}

/**
 * 造一个"落盘用"的 Error 影子:message / stack 打码,其余形状逐字保留。
 *
 * 为什么需要它(2026-11-01):`redactCredentialStrings` 刻意**不 walk Error**
 * (见上),所以 `logger.error({ err })` 这条最常见的写法,凭据藏在 message 里就
 * 直接落盘。实测形态是上游 fetch 失败时 message 里带着
 * `https://upstream/v1?api_key=sk-...`。而 `loggerConfig.redact` 只按字段名匹配,
 * 管不了字符串内容 —— 两道闸都够不着的地方就是这一格。
 *
 * 为什么不能就地改 `error.message`:调用方紧接着还要用同一个 error 生成响应体
 * (4xx 分支会把 message 回给客户端),就地改会连带改掉对外文案。
 *
 * 保留原型的意义:pino 的 stdSerializers.err 用 `err.constructor.name` 填 `type`,
 * 原型不动 ⇒ 日志里的错误类型名(如 AppError)不变,既有告警规则与检索口径不动。
 */
export function redactErrorForLog<T extends Error>(error: T): T {
  const shadow = Object.create(Object.getPrototypeOf(error)) as T
  const define = (key: string, value: unknown) => {
    Object.defineProperty(shadow, key, {
      value,
      writable: true,
      enumerable: false,
      configurable: true,
    })
  }
  define('message', redactCredentialText(error.message ?? ''))
  if (error.stack) define('stack', redactCredentialText(error.stack))
  define('name', error.name)
  const source = error as unknown as Record<string, unknown>
  const target = shadow as unknown as Record<string, unknown>
  for (const key of Object.keys(source)) target[key] = source[key]
  return shadow
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
