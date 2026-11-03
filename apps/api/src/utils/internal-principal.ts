// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 内部主体解析出口(唯一实现,#23 控制面断点修复)。
 *
 * 回答 CSRF 钩子与路由侧共同的问题:「这是一个**已通过内部密钥自证**的机器调用吗?」
 * 两处(CSRF onRequest 钩子 / 路由 handler)必须走同一份实现 —— 密钥比较在仓库里
 * 只允许一处落地(`plugins/internal-service-token.ts` 的 `secretsEqual`:先 SHA-256
 * 定长再 `timingSafeEqual`,既有长度泄漏也没有前缀计时分叉;由镜像测试
 * internal-service-token-constant-time.test.ts 钉住,不得另抄第二份)。
 *
 * 两族内部凭据(来源与消费点):
 *  - `X-Internal-Service-Token` == `config.AI_CALLBACK_SECRET`
 *    (消费方:plugins/internal-service-token.ts 的 checkInternalServiceToken,
 *     ai-service 等内部服务调 /api/memory 一类端点;路由侧还会继续校验 X-User-Id 与
 *     用户状态 —— 本出口只回答"密钥是否自证通过",不做用户校验,也不注入 request.userId)
 *  - `Authorization: Bearer <AGENT_CONTROL_INTERNAL_SECRET>`
 *    (消费方:routes/agent-control.ts 的 /execute;这把密钥是**裸密钥**,非三段 JWT、
 *     非 `ihui_` 前缀 ⇒ 不满足 csrf 的 isPlausibleBearerCredential 形态豁免,
 *     旧现场即:CSRF 钩子(onRequest,csrf.ts:204)抢在 handler 内的密钥校验之前 403,
 *     合法内部调用永远走不到自己的鉴权分支。)
 *
 * fail-closed 是判据的一半:密钥未配置 / 凭据缺失 / 比较实现不可达 ⇒ 一律 false
 * (拒绝),绝不因为"看起来像内部端点"而放行。豁免的根据是**密钥验真**,不是路径、
 * 不是头名在场(旧 CSRF 写法 `if (request.headers['x-internal-service-token']) return`
 * 就是"豁免即放行",本文件同时收口那一格)。
 */
import type { FastifyRequest } from 'fastify'
import { config } from '../config/index.js'
import { normalizeHeader } from './http-normalize.js'

/** 与 plugins/internal-service-token.ts / plugins/principal.ts 同一头名(值同步由用例钉住)。 */
const INTERNAL_SERVICE_TOKEN_HEADER = 'x-internal-service-token'
/** 控制面密钥:沿用 agent-control.ts 旧实现的读取源(process.env,调用时现读,不改配置面)。 */
const AGENT_CONTROL_INTERNAL_SECRET_ENV = 'AGENT_CONTROL_INTERNAL_SECRET'

/**
 * 缓存式动态加载 `secretsEqual`(唯一比较实现)。
 * 用动态 import 而非静态:internal-service-token.ts 静态依赖 db 链路
 * (`../db/index.js` → config/database 池),CSRF 插件被 server.ts 在主作用域注册,
 * 不该为一次形态判断把 DB 依赖拉进插件加载图(先例:auth.ts 的
 * checkAuthOrInternalService 对同一模块也是延迟导入,注释理由相同)。
 * 取不到实现 ⇒ false(fail-closed:比较实现不可达时拒绝,而不是放行)。
 */
let secretsEqualLoader: Promise<(a: string, b: string) => boolean> | null = null
async function constantTimeEquals(a: string, b: string): Promise<boolean> {
  try {
    if (!secretsEqualLoader) {
      secretsEqualLoader = import('../plugins/internal-service-token.js').then(
        (m) => m.secretsEqual,
      )
    }
    return (await secretsEqualLoader)(a, b)
  } catch {
    return false
  }
}

/** `Authorization: Bearer <非空 token>` 的 token 段;形态不成立返回 undefined。 */
function bearerCredential(request: FastifyRequest): string | undefined {
  const header = normalizeHeader(request.headers.authorization)
  if (!header || !header.startsWith('Bearer ')) return undefined
  const token = header.slice('Bearer '.length).trim()
  return token.length > 0 ? token : undefined
}

/**
 * X-Internal-Service-Token 是否与服务密钥验真相符。
 * (路由侧的 checkInternalServiceToken 会在此之外继续做 X-User-Id/用户状态校验;
 * 本函数只回答密钥维度,供 CSRF 钩子判定"这是机器调用"。)
 */
export async function isVerifiedInternalServiceCall(request: FastifyRequest): Promise<boolean> {
  const token = normalizeHeader(request.headers[INTERNAL_SERVICE_TOKEN_HEADER])
  if (!token) return false
  const secret = config.AI_CALLBACK_SECRET
  if (!secret) return false // fail-closed:未配置时拒绝(与 checkInternalServiceToken 的 401 同向)
  return constantTimeEquals(token, secret)
}

/**
 * Authorization: Bearer 是否与 AGENT_CONTROL_INTERNAL_SECRET 验真相符。
 * 语义与 agent-control.ts 旧本地实现逐项一致(fail-closed 空密钥 / 严格 `Bearer ` 前缀 /
 * 非空 token),仅把比较从"等长 timingSafeEqual"升级为共用的 secretsEqual(定长散列后
 * timingSafeEqual —— 不等长也常数时间,且不泄漏长度)。
 */
export async function isVerifiedAgentControlInternalCall(
  request: FastifyRequest,
): Promise<boolean> {
  const bearer = bearerCredential(request)
  if (!bearer) return false
  const secret = process.env[AGENT_CONTROL_INTERNAL_SECRET_ENV] ?? ''
  if (!secret) return false // fail-closed:api 侧未配置密钥时此凭据族一律不自证(ai-service 侧同样 fail-closed)
  return constantTimeEquals(bearer, secret)
}

/** 任一内部凭据族验真通过 ⇒ 这是机器自证调用(CSRF 钩子的豁免判据)。 */
export async function isVerifiedInternalMachineCall(request: FastifyRequest): Promise<boolean> {
  if (await isVerifiedInternalServiceCall(request)) return true
  return isVerifiedAgentControlInternalCall(request)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
