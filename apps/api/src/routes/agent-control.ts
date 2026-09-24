// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 自动控制路由(2026-07-22 立,跨端:ai-service ↔ api ↔ extension/desktop/web)
 *
 * 设计:
 *  - extension/desktop/web 启动时上报能力(POST /capability)
 *  - ai-service MCP tool 调用 POST /execute,api 通过 WebSocket 推送给对应端
 *  - extension/desktop/web 执行后通过 POST /result 回传结果
 *  - api 用 pending Map 等待结果,超时 30s
 *
 * category 与执行端一一对应(见 CATEGORY_ENDPOINT):
 *  - browser  → extension(外部网页 DOM 操作 + 截图)
 *  - computer → desktop(操作系统级鼠标键盘/剪贴板)
 *  - ext_ui   → extension(2026-09-21 立,扩展自有界面 sidepanel/popup:与 web 同七动词,
 *               靠同源 DOM 定位;与 browser 同 endpoint 但不同 category,互不抢指令)
 *  - ui       → web(2026-09-20 立,只操控自家应用页面:站内导航 / 按钮点击 / 表单填写 /
 *               命令面板调用。目标靠前端的 web_ui_describe 返回的 actionId 定位,而非任意
 *               CSS 选择器或系统级输入,因此无需 OS 权限也不触及第三方站点)
 *
 * 端点:
 *  - POST   /capability   上报端能力(extension/desktop/web 启动时调用)
 *  - POST   /execute      执行控制指令(ai-service 调用)
 *  - POST   /result       回传执行结果(extension/desktop/web 调用)
 *  - GET    /status       查询已注册的端(管理/调试用)
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { timingSafeEqual } from 'node:crypto'
import type { AgentActionRequest, AgentActionResponse, AgentControlCapability } from '@ihui/types'
import { authenticate, checkAuth, checkAuthOrInternalService } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { toUserFriendlyMessage } from '@ihui/shared'

/**
 * 校验 Authorization: Bearer 是否等于内部服务密钥(时序安全比较)。
 * 长度不一致直接 false(避免 timingSafeEqual 抛错)。
 */
function isInternalSecret(authHeader: string | undefined): boolean {
  const internalSecret = process.env.AGENT_CONTROL_INTERNAL_SECRET ?? ''
  if (!internalSecret || !authHeader?.startsWith('Bearer ')) return false
  const bearer = authHeader.slice(7).trim()
  if (bearer.length === 0 || bearer.length !== internalSecret.length) return false
  return timingSafeEqual(Buffer.from(bearer, 'utf-8'), Buffer.from(internalSecret, 'utf-8'))
}

// ---------------------------------------------------------------------------
// 状态:已注册的端 + pending requests
// ---------------------------------------------------------------------------

// 导出供下方 __test__ 断言用(tsc declaration 阶段要求公共签名可命名)
interface RegisteredEndpoint {
  capability: AgentControlCapability
  userId: string
  lastSeen: number
}

/** instanceId → RegisteredEndpoint */
const _endpoints = new Map<string, RegisteredEndpoint>()

export interface PendingRequest {
  resolve: (response: AgentActionResponse) => void
  reject: (err: Error) => void
  timer: NodeJS.Timeout
  startedAt: number
}

/** requestId → PendingRequest */
const _pending = new Map<string, PendingRequest>()

/** 清理超过 5 分钟未上报的端 */
const ENDPOINT_TTL_MS = 5 * 60 * 1000

/**
 * 钉定实例的"活性容差":前端每 60s 保活上报一次,落后超过一个周期即视为该页面
 * 已被重载/关闭留下(注册表要到 5min TTL 才清,中间这段时间它仍然"存在")。
 */
const PIN_STALE_GAP_MS = 60 * 1000

/**
 * category → 执行端映射(穷举 Record,新增 category 必须同步登记,
 * 否则 tsc 直接报错)。此前是 `category === 'browser' ? 'extension' : 'desktop'`
 * 三元硬编码,加入第三种 category='ui' 后会把 web 指令误配到 desktop。
 */
const CATEGORY_ENDPOINT: Record<
  AgentActionRequest['category'],
  AgentControlCapability['endpoint']
> = {
  browser: 'extension',
  computer: 'desktop',
  ui: 'web',
  app_ui: 'rn',
  // 扩展自有界面:与 browser 共用 endpoint='extension',但 category 必须分开
  // (同一 endpoint 上两类执行面 —— 外部网页 DOM 与扩展面板 DOM —— 若同类就会互抢指令)
  ext_ui: 'extension',
  miniapp_ui: 'miniapp',
}

/** TARGET_NOT_CONNECTED 回执文案按 category 取(同样避免三元硬编码) */
const CATEGORY_LABEL: Record<AgentActionRequest['category'], string> = {
  browser: '浏览器扩展',
  computer: '桌面端',
  ui: 'Web 前端',
  app_ui: '移动端',
  miniapp_ui: '小程序端',
  ext_ui: '扩展面板',
}

function cleanupStaleEndpoints(): void {
  const now = Date.now()
  for (const [id, ep] of _endpoints) {
    if (now - ep.lastSeen > ENDPOINT_TTL_MS) {
      _endpoints.delete(id)
    }
  }
}

/** 根据 category 找到最近活跃的端(可选按实例 ID 钉定) */
function findEndpointByCategory(
  category: AgentActionRequest['category'],
  userId?: string,
  targetInstanceId?: string,
): RegisteredEndpoint | null {
  cleanupStaleEndpoints()
  const targetEndpoint = CATEGORY_ENDPOINT[category]
  // 显式钉定实例:describe 与后续动作必须落在同一个页面(元素 id 是该页私有映射)。
  // 钉定失败(该端已断开/不属此用户)时不报错,回落"最近活跃端",由前端回执说明。
  if (targetInstanceId) {
    const pinned = _endpoints.get(targetInstanceId)
    if (
      pinned &&
      pinned.capability.endpoint === targetEndpoint &&
      (!userId || pinned.userId === userId)
    ) {
      // **必须再验活性**:页面重载/关闭后该 instance 不会再来心跳,但注册表按
      // ENDPOINT_TTL_MS(5min) 仍留着它 —— 直接返回 pinned 会把每一条后续动作推到
      // 一条已死的 socket 上,表现为完全看不出根因的 20s TIMEOUT(2026-09-21 真实
      // 聊天 round-trip 复现:describe 53ms 就回,而钉住旧实例的那次 invoke 走了满超时)。
      // 判据用"相对落后量"而非绝对时限:活页面每 60s 保活一次,所以落后不足一个保活周期
      // 就是真活着(多标签页并存时不得降级,否则又回到命令散射的老问题)。
      let newestSeen = pinned.lastSeen
      for (const ep of _endpoints.values()) {
        if (ep.capability.endpoint !== targetEndpoint) continue
        if (userId && ep.userId !== userId) continue
        if (ep.lastSeen > newestSeen) newestSeen = ep.lastSeen
      }
      if (newestSeen - pinned.lastSeen < PIN_STALE_GAP_MS) return pinned
    }
  }
  let best: RegisteredEndpoint | null = null
  for (const ep of _endpoints.values()) {
    if (ep.capability.endpoint !== targetEndpoint) continue
    // 2026-08-16 修复:多用户隔离——指令带 userId 时只匹配该用户的端点,
    // 避免同一 api 实例上 LLM 指令被推送到其他用户的 desktop/extension/web。
    if (userId && ep.userId !== userId) continue
    if (!best || ep.lastSeen > best.lastSeen) {
      best = ep
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const capabilitySchema = z.object({
  endpoint: z.enum(['extension', 'desktop', 'web', 'rn', 'miniapp']),
  instanceId: z.string().min(1).max(100),
  browserActions: z.array(z.string()).max(100).optional(),
  computerActions: z.array(z.string()).max(100).optional(),
  uiActions: z.array(z.string()).max(20).optional(),
  appUiActions: z.array(z.string()).max(10).optional(),
  taroUiActions: z.array(z.string()).max(10).optional(),
  // 上限按 web 同档(20):七动词已用掉 7,留 10 的上限会让下一次扩动词整条上报 400
  extUiActions: z.array(z.string()).max(20).optional(),
  version: z.string().optional(),
  reportedAt: z.string(),
})

const executeSchema = z.object({
  requestId: z.string().min(1).max(100),
  category: z.enum(['browser', 'computer', 'ui', 'app_ui', 'miniapp_ui', 'ext_ui']),
  action: z.string().min(1).max(100),
  params: z.record(z.string(), z.unknown()).default({}),
  toolCallId: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  targetInstanceId: z.string().min(1).max(100).optional(),
  timeout: z.number().int().min(1000).max(120000).default(30000),
})

const resultSchema = z.object({
  requestId: z.string().min(1).max(100),
  success: z.boolean(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  durationMs: z.number(),
  executedBy: z.enum(['extension', 'desktop', 'web', 'rn', 'miniapp', 'unknown']),
})

// ---------------------------------------------------------------------------
// 路由
// ---------------------------------------------------------------------------

export const agentControlRoutes: FastifyPluginAsync = async (server) => {
  // -------------------------------------------------------------------------
  // POST /capability - 上报端能力
  // -------------------------------------------------------------------------
  server.post('/capability', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const result = capabilitySchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send(error(400, '控制指令参数无效'))
    }
    const cap = result.data as AgentControlCapability

    _endpoints.set(cap.instanceId, {
      capability: cap,
      userId,
      lastSeen: Date.now(),
    })

    return reply.send(success({ registered: true, instanceId: cap.instanceId }))
  })

  // -------------------------------------------------------------------------
  // POST /execute - 执行控制指令(ai-service 调用)
  // -------------------------------------------------------------------------
  server.post('/execute', async (request, reply) => {
    // fail-closed 认证(2026-09-01 安全修复):此前 authenticate 失败即放行 +
    // userId 取自请求体,任何可达 8802 的进程可伪造 userId 越权控制已连接端。
    // 现要求:① Authorization: Bearer == AGENT_CONTROL_INTERNAL_SECRET(ai-service
    // 内部调用,ai-service 侧已带该 header);② 或携带合法用户 JWT(兼容历史)。
    // 两者皆无 → 401 拒绝。api 侧未配置密钥时仅 JWT 路径可用。
    let authed = isInternalSecret(request.headers.authorization)
    if (!authed) {
      try {
        await authenticate(request)
        authed = true
      } catch {
        authed = false
      }
    }
    if (!authed) {
      return reply.status(401).send(error(401, '未授权:缺少有效的内部密钥'))
    }

    const result = executeSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send(error(400, '执行参数无效'))
    }
    const req = result.data as AgentActionRequest

    // 找到对应类型的端(带 userId 过滤,2026-08-16 多用户隔离)
    const ep = findEndpointByCategory(req.category, req.userId, req.targetInstanceId)
    if (!ep) {
      const response: AgentActionResponse = {
        requestId: req.requestId,
        success: false,
        error: `${CATEGORY_LABEL[req.category]}未连接`,
        errorCode: 'TARGET_NOT_CONNECTED',
        durationMs: 0,
        executedBy: 'unknown',
      }
      return reply.send(success(response))
    }

    // 通过 WebSocket 推送给端
    const payload = {
      type: 'agent.action',
      request: req,
    }
    try {
      server.pushNotification(ep.userId, payload)
    } catch (err) {
      const response: AgentActionResponse = {
        requestId: req.requestId,
        success: false,
        error: `Failed to push notification: ${toUserFriendlyMessage(err)}`,
        errorCode: 'EXECUTION_FAILED',
        durationMs: 0,
        executedBy: 'unknown',
      }
      return reply.send(success(response))
    }

    // 等待结果(用 pending Map + Promise + 超时)
    const timeoutMs = req.timeout ?? 30000
    const responsePromise = new Promise<AgentActionResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (_pending.has(req.requestId)) {
          _pending.delete(req.requestId)
          resolve({
            requestId: req.requestId,
            success: false,
            error: `执行超时(${timeoutMs} 毫秒)`,
            errorCode: 'TIMEOUT',
            durationMs: timeoutMs,
            executedBy: 'unknown',
          })
        }
      }, timeoutMs)

      _pending.set(req.requestId, {
        resolve,
        reject,
        timer,
        startedAt: Date.now(),
      })
    })

    try {
      const response = await responsePromise
      return reply.send(success(response))
    } catch (err) {
      return reply.status(500).send(error(500, toUserFriendlyMessage(err)))
    }
  })

  // -------------------------------------------------------------------------
  // POST /result - 回传执行结果(extension/desktop/web 调用)
  // -------------------------------------------------------------------------
  server.post('/result', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return

    const result = resultSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send(error(400, 'Invalid result payload'))
    }
    const res = result.data as AgentActionResponse

    const pending = _pending.get(res.requestId)
    if (!pending) {
      // 已经超时或已被处理,静默丢弃
      return reply.send(success({ accepted: false, reason: 'request not found or timed out' }))
    }

    clearTimeout(pending.timer)
    _pending.delete(res.requestId)
    pending.resolve(res)

    return reply.send(success({ accepted: true }))
  })

  // -------------------------------------------------------------------------
  // GET /status - 查询已注册的端(管理/调试用)
  // -------------------------------------------------------------------------
  server.get('/status', async (request, reply) => {
    // 两条凭据都收:①用户 JWT(前端/端侧自查);②内部服务凭据(ai-service 在 tool loop 前
    // 要问"这个用户此刻哪些端在线",据此决定该自主注入哪一族工具 —— 不依赖客户端关键词命中)。
    if (!(await checkAuthOrInternalService(request, reply))) return

    cleanupStaleEndpoints()
    // **按用户过滤**(2026-09-21 修):原先返回全表,等于任何登录用户都能读到别人端点的
    // instanceId / 版本 / 动作数。多用户部署下这是跨租户信息泄漏,与 /execute 早先的
    // userId 越权修复同源,一并收口。
    const endpoints = Array.from(_endpoints.values())
      .filter((ep) => ep.userId === request.userId)
      .map((ep) => ({
        endpoint: ep.capability.endpoint,
        instanceId: ep.capability.instanceId,
        version: ep.capability.version,
        lastSeen: new Date(ep.lastSeen).toISOString(),
        browserActions: ep.capability.browserActions?.length ?? 0,
        computerActions: ep.capability.computerActions?.length ?? 0,
        uiActions: ep.capability.uiActions?.length ?? 0,
        appUiActions: ep.capability.appUiActions?.length ?? 0,
        taroUiActions: ep.capability.taroUiActions?.length ?? 0,
        extUiActions: ep.capability.extUiActions?.length ?? 0,
      }))

    return reply.send(
      success({
        endpoints,
        pendingRequests: _pending.size,
      }),
    )
  })
}

/**
 * 测试面(2026-09-20 立):_endpoints / _pending 是进程内 Map,用例需要
 * ① 每个用例前复位状态,② 直接断言 category → endpoint 命中结果
 * (走 HTTP 只能观测 pushNotification 的 userId,分不清同一用户的多个端)。
 * 只暴露状态引用与纯查询函数,不额外开放写接口。
 */
export const __test__ = {
  endpoints: _endpoints,
  pending: _pending,
  findEndpointByCategory,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
