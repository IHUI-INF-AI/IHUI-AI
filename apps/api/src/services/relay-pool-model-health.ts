// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池模型级连通健康(2026-11-11 立,对标 ai-service/app/services/model_health.py 的模型级口径)。
 *
 * 背景:对话模型选择器 = 平台模型(ai-service /llm/models,已有模型级连通过滤)
 * + 号池模型(GET /api/account-pool/models → listUserPoolModels,此前零过滤)。
 * 本模块补号池腿:上游 404「模型不存在」的号池模型不再进选择器。
 *
 * 设计要点(与 ai-service model_health 的注释风格对齐,只读参照、不修改它):
 * - **被动信号,零新增探测请求**:状态只由转发器真实流量的 404/成功喂出
 *   (recordModelNotFound / recordModelSuccess),本模块自身不发任何上游请求。
 * - 首版纯内存 Map,不接 Redis:信号来自请求路径,单实例的结论过滤本实例的清单
 *   已足够;多实例部署时各自独立积累信号,互不共享(可接受 —— 判据 fail-open,
 *   最坏退化为"这一轮没结论、照旧显示",与平台腿"PENDING 保留"同构)。
 * - 键 = providerCode + NUL(U+0000) + 归一上游模型名(去 `<平台>/` 前缀后小写比对)。
 *   404「模型不存在」是平台级事实(与哪个用户看到无关),故键不含 userId。
 *   归一函数 normalizePoolUpstreamModelId 与 listUserPoolModels 的交集比对共用,
 *   避免"裸名(trae 系登记行)vs `<平台>/` 前缀名"两套形态互判不存在而误杀。
 * - 连续 2 次 404 才置 down(对齐 model_health 的 MAX_CONSECUTIVE_FAILURES=2 口径,
 *   防上游 404 抖动误杀);账户级失败(auth/credit/risk/rate)由调用方负责不喂进来。
 * - down 结论 TTL = 清单缓存 10 分钟 x 2 轮(两轮):超期视为无结论(fail-open),
 *   避免一次偶发把模型永久隐藏 —— 号池腿没有主动复测循环,过期即还给用户。
 */

/** 与 ai-service model_health.MAX_CONSECUTIVE_FAILURES 同口径:连续 2 次才隐藏 */
const MAX_CONSECUTIVE_NOT_FOUND = 2
/** down 结论有效期:清单缓存周期 10min x 2 轮(与 relay-account-pool-service 的 POOL_MODEL_CACHE_TTL_MS 同值,两处独立声明避免反向依赖) */
const MODEL_DOWN_TTL_MS = 2 * 10 * 60 * 1000
/** 键分隔符 NUL:模型名可含冒号/斜杠,用不可见控制符保证键空间不碰撞 */
const KEY_SEP = String.fromCharCode(0)

interface PoolModelState {
  /** 连续 404 次数(任一成功即整键清除) */
  consecutiveNotFound: number
  /** 连续 404 达阈值后置 true;isModelDown 只认这个 */
  down: boolean
  /** 最近一次 404 时刻(TTL 从它起算) */
  checkedAt: number
}

const states = new Map<string, PoolModelState>()

/**
 * 上游模型名归一:剥 `<providerCode>/` 前缀(登记行裸名不带前缀,原样保留)→ trim → 小写。
 * listUserPoolModels 的交集比对与本模块的状态键共用此函数(判据单源,§0.6)。
 */
export function normalizePoolUpstreamModelId(providerCode: string, modelId: string): string {
  const raw = (modelId ?? '').trim()
  const prefix = providerCode + '/'
  const bare = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw
  return bare.trim().toLowerCase()
}

function stateKey(providerCode: string, modelId: string): string {
  return providerCode + KEY_SEP + normalizePoolUpstreamModelId(providerCode, modelId)
}

/**
 * 上游 404「模型不存在」信号(转发器失败分类分支调用)。
 * 连续 2 次才置 down:单次 404 多半是上游抖动,不能误杀活模型。
 */
export function recordModelNotFound(providerCode: string, upstreamModelId: string): void {
  const key = stateKey(providerCode, upstreamModelId)
  const prev = states.get(key)
  const consecutiveNotFound = (prev?.consecutiveNotFound ?? 0) + 1
  states.set(key, {
    consecutiveNotFound,
    down: consecutiveNotFound >= MAX_CONSECUTIVE_NOT_FOUND,
    checkedAt: Date.now(),
  })
}

/** 调用成功:模型明确可用,整键清除(连击计数与 down 结论一并作废) */
export function recordModelSuccess(providerCode: string, upstreamModelId: string): void {
  states.delete(stateKey(providerCode, upstreamModelId))
}

/**
 * 模型当前是否「确认死亡」:仅 status==down 且未超 TTL 才 true。
 * 超期视为无结论(fail-open)——号池腿没有主动复测循环,不能靠一次抖动永久隐藏。
 */
export function isModelDown(providerCode: string, upstreamModelId: string): boolean {
  const key = stateKey(providerCode, upstreamModelId)
  const state = states.get(key)
  if (!state || !state.down) return false
  if (Date.now() - state.checkedAt >= MODEL_DOWN_TTL_MS) {
    states.delete(key)
    return false
  }
  return true
}

/** 测试专用:清空全部状态(vitest 用例间必须互不带结论) */
export function resetPoolModelHealthForTest(): void {
  states.clear()
}
