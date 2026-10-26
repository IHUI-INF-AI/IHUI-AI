// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Predictive Edit(独立编辑意图预测,V3 #82)web 侧唯一请求出口。
 *
 * 后端契约(HEAD 现读):
 *   POST /api/llm/fim/edit-intent  (ai-service 8803,`routers/fim.py::fim_predict_edit`)
 *   请求体 {content: 全文, cursor: 绝对偏移, language: 文件类型, path?, model?,
 *           max_tokens?, budget_ms?, owner_uuid?}
 *   响应体 {code:0, message, data:{disposition, undetermined, reason, actions[],
 *           dropped_actions[], document_length, model, latency_ms, budget_ms, stub}}
 *
 * 反代:web `next.config.ts` 的 `/api/llm/:path*` → ai-service 同路径(保留 /api 前缀),
 * 故浏览器同源直接打 `/api/llm/fim/edit-intent` 即可,不经 apps/api 网关、不新造请求层。
 * 本文件只做三件事:① 走 `fetchApi`(api-client 既有出口,自带 token/超时/信封解包);
 * ② 把后端**三态原样保留**给调用方(undetermined 绝不折叠成 no_action);
 * ③ 失败一律静默(`failed`,只留一次 console.debug),绝不抛给发送链路。
 *
 * 降级纪律(票面硬约束):预测是**建议**不是前置条件 —— 请求失败/后端未启/超时
 * 只影响"这次没有建议",不得弹错、不得阻塞用户输入或发送。
 */

import { fetchApi } from '@ihui/api-client'

/** ai-service 端点(web 同源反代;后端路径为 /api/llm/fim/edit-intent)。 */
export const PREDICTIVE_EDIT_ENDPOINT = '/api/llm/fim/edit-intent'

/** 对话输入区草稿的文件类型线索(后端只把它当语言提示,不参与区间坐标系)。 */
export const PREDICTIVE_EDIT_LANGUAGE = 'markdown'

/**
 * 本次预测预算(ms)。后端 `resolve_budget_ms` 必有界(默认 1500 / 封顶 4000),
 * 这里给 2000:允许一次正常往返,又不会在网关退化时把输入区挂住。
 */
const PREDICTIVE_EDIT_TIMEOUT_MS = 2_000

/** 编辑动作种类(与后端 `EDIT_ACTION_KINDS` 同一封闭集)。 */
type PredictiveEditActionKind = 'insert' | 'replace' | 'delete'

/** 一条可执行动作;start/end 是**被审草稿**的绝对字符偏移(0 基,end 不含)。 */
export interface PredictiveEditAction {
  kind: PredictiveEditActionKind
  start: number
  end: number
  text: string
  anchor?: string | null
}

/** 后端 undetermined 的原因码(封闭集,逐项可分辨)。 */
type PredictiveEditUndeterminedReason =
  | 'no_credentials'
  | 'model_unavailable'
  | 'model_timeout'
  | 'parse_failed'
  | 'all_actions_rejected'
  | 'insufficient_context'

/**
 * 预测结果三态 + 传输失败档。
 *
 * `failed` 与 `undetermined` **刻意分开**:前者是"这次请求根本没拿到结论"
 * (网络/后端未启/超时),后者是后端**明确判定"判不出来"**并给出原因码。
 * 两者都不得折算成 `no_action`(模型明说没有编辑意图)—— 本仓最高频失效型。
 */
export type PredictiveEditOutcome =
  | { status: 'suggested'; actions: PredictiveEditAction[] }
  | { status: 'no_action' }
  | { status: 'undetermined'; reason: PredictiveEditUndeterminedReason }
  | { status: 'failed'; reason: string }

/** 请求入参(只暴露 web 输入区真正会用到的字段,其余走服务端默认)。 */
export interface PredictiveEditRequest {
  content: string
  cursor: number
  language?: string
  path?: string
  budget_ms?: number
}

export interface PredictiveEditRequestOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

/** ai-service 响应 data 段(只声明本前端消费的字段,其余忽略)。 */
interface PredictiveEditResponseData {
  disposition?: string
  reason?: string | null
  actions?: unknown
}

const ACTION_KINDS: readonly PredictiveEditActionKind[] = ['insert', 'replace', 'delete']

function isActionKind(value: unknown): value is PredictiveEditActionKind {
  return typeof value === 'string' && (ACTION_KINDS as readonly string[]).includes(value)
}

/** 逐条筛掉形状不对的动作(后端已校验;这里只防响应漂移,不静默改区间)。 */
function isPredictiveEditAction(value: unknown): value is PredictiveEditAction {
  if (value === null || typeof value !== 'object') return false
  const action = value as Record<string, unknown>
  if (!isActionKind(action.kind)) return false
  if (!Number.isInteger(action.start) || !Number.isInteger(action.end)) return false
  if (typeof action.text !== 'string') return false
  if (action.anchor !== undefined && action.anchor !== null && typeof action.anchor !== 'string') {
    return false
  }
  return true
}

/**
 * `{code,message,data}` 信封由 fetchApi 解包后,把 data 映射成三态。
 *
 * `suggested` 但动作数组为空 / 结构不认识 ⇒ `failed(invalid_payload)`:
 * 这是"响应不符合契约",不是"没有建议",不得混进 no_action。
 */
function mapResponseData(data: PredictiveEditResponseData | undefined): PredictiveEditOutcome {
  if (!data || typeof data !== 'object') {
    return { status: 'failed', reason: 'invalid_payload' }
  }
  if (data.disposition === 'suggested') {
    const actions = Array.isArray(data.actions) ? data.actions.filter(isPredictiveEditAction) : []
    if (actions.length === 0) return { status: 'failed', reason: 'invalid_payload' }
    return { status: 'suggested', actions }
  }
  if (data.disposition === 'no_action') return { status: 'no_action' }
  if (data.disposition === 'undetermined') {
    return {
      status: 'undetermined',
      reason:
        (data.reason as PredictiveEditUndeterminedReason | null | undefined) ?? 'parse_failed',
    }
  }
  return { status: 'failed', reason: 'invalid_payload' }
}

/** 失败痕迹只留一次,且**绝不**打扰用户(不 toast、不 throw)。 */
function debugSilently(message: string, detail: unknown): void {
  // eslint-disable-next-line no-console -- 票面要求失败静默:只留一条调试痕迹,不弹错、不上屏
  console.debug(`[predictive-edit] ${message}`, detail)
}

/**
 * 调一次编辑意图预测。
 *
 * @returns 永不 reject:成功三态原样返回;任何传输/契约失败返回 `failed`。
 */
export async function fetchPredictiveEdit(
  request: PredictiveEditRequest,
  options: PredictiveEditRequestOptions = {},
): Promise<PredictiveEditOutcome> {
  const body = {
    content: request.content,
    cursor: request.cursor,
    language: request.language ?? PREDICTIVE_EDIT_LANGUAGE,
    ...(request.path !== undefined ? { path: request.path } : {}),
    ...(request.budget_ms !== undefined ? { budget_ms: request.budget_ms } : {}),
  }
  try {
    const result = await fetchApi<PredictiveEditResponseData>(PREDICTIVE_EDIT_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(body),
      signal: options.signal,
      timeoutMs: options.timeoutMs ?? PREDICTIVE_EDIT_TIMEOUT_MS,
    })
    if (!result.success) {
      // 调用方主动取消(换词/清空)是预期行为,不留调试噪声。
      if (options.signal?.aborted) return { status: 'failed', reason: 'aborted' }
      debugSilently('请求失败', result.error)
      return { status: 'failed', reason: result.error }
    }
    return mapResponseData(result.data)
  } catch (error) {
    if (options.signal?.aborted) return { status: 'failed', reason: 'aborted' }
    debugSilently('调用异常', error)
    return { status: 'failed', reason: error instanceof Error ? error.message : 'unknown' }
  }
}

/**
 * 把动作落到草稿上(纯函数,UI 与用例共用同一份判据)。
 *
 * 区间是**整篇草稿的绝对偏移**,动作之间按后端契约互不相交;从后往前应用
 * (`start` 降序)保证前面的偏移不被后面的编辑推移。任何一条越界/倒序/重叠/
 * 锚点不符 ⇒ 整体返回 `null`(不部分应用:半套编辑比不改更危险)。
 */
export function applyPredictedEditActions(
  text: string,
  actions: readonly PredictiveEditAction[],
): string | null {
  if (!Array.isArray(actions) || actions.length === 0) return null
  const ordered = [...actions].sort((a, b) => b.start - a.start || b.end - a.end)
  let result = text
  let previousStart = Number.POSITIVE_INFINITY
  for (const action of ordered) {
    if (!Number.isInteger(action.start) || !Number.isInteger(action.end)) return null
    if (action.start < 0 || action.end < action.start || action.end > text.length) return null
    if (action.end > previousStart) return null
    if (action.kind === 'insert') {
      if (action.start !== action.end) return null
    } else if (action.anchor !== undefined && action.anchor !== null) {
      const actual = text.slice(action.start, action.end)
      if (actual !== action.anchor) return null
    }
    if (action.kind === 'insert') {
      result = result.slice(0, action.start) + action.text + result.slice(action.start)
    } else if (action.kind === 'replace') {
      result = result.slice(0, action.start) + action.text + result.slice(action.end)
    } else {
      result = result.slice(0, action.start) + result.slice(action.end)
    }
    previousStart = action.start
  }
  return result
}
