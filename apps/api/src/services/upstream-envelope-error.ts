// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 流内信封错误判据(2026-11-17 立)。
 *
 * 立因:对标 qoder2api-hub 的「双层瞬时故障重试」—— 它明确区分两类故障:
 *   ① 连接层(建连/读头阶段抛错);
 *   ② **流内信封层** —— 上游已经回 200、SSE 流已经开着,但第一帧信封里投的是
 *      `{"statusCodeValue":418,...}` 这类故障。此时只要**还没向客户端写出任何字节**,
 *      就该重开上游重试,客户端全程无感。
 *
 * 本仓此前只认 `json.error` 字段(F-337),`statusCodeValue` / 顶层 `code` 这两种桥形态
 * 一概看不见 —— 418 会被当成空 chunk 吞掉。本模块把「这段信封算不算故障、算不算可重试」
 * 抽成纯判据,`pipeChannelStream` 与调用方共用同一把尺。
 *
 * 三条纪律:
 * - **判不出状态码就不重试**:上游只说"出错了"但没说是什么错时,重试只会把 4 秒白等掉;
 *   额度耗尽 / 模型不存在这类 4xx 重试也永远不会成功。
 * - **只有瞬时档可重试**:408 / 418(上游过载惯用码) / 425 / 429 / 5xx。401/403/404/400 永不重试。
 * - **不猜字段语义**:`code` 只在明确是 3 位 HTTP 语义码(>=400)时才采信,业务码(如 1001)不算。
 */

/** 信封错误判定结果;null = 这一帧是正常数据帧或者根本不是信封。 */
export interface EnvelopeError {
  /** 上游在信封里声明的状态码;判不出时 null */
  status: number | null
  /** 是否属于"重开上游可能成功"的瞬时档 */
  retryable: boolean
  /** 给日志/失败原因用的说明 */
  detail: string
  /** 从哪个字段判出来的(排障用) */
  source: 'error_field' | 'status_code_value' | 'code_field'
}

/** 瞬时档状态码:值得重开上游再试一次的那些。 */
const RETRYABLE_STATUS = new Set([408, 418, 425, 429])

/** HTTP 语义码判定:3 位且 >= 400。业务码(1001/40401 等)一律不算。 */
function asHttpStatus(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 400 && raw <= 599) return raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!/^\d{3}$/.test(trimmed)) return null
    const n = Number(trimmed)
    return n >= 400 && n <= 599 ? n : null
  }
  return null
}

/** 状态码是否属于瞬时重试档。 */
export function isRetryableEnvelopeStatus(status: number | null): boolean {
  if (status === null) return false
  if (RETRYABLE_STATUS.has(status)) return true
  return status >= 500 && status <= 599
}

/** 把 code 归一成可直接比较的终态;只在明确 HTTP 语义时返回数字。 */
function codeAsHttp(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw >= 400 && raw <= 599 ? raw : null
  }
  if (typeof raw === 'string' && /^\d{3}$/.test(raw.trim())) {
    const n = Number(raw.trim())
    return n >= 400 && n <= 599 ? n : null
  }
  return null
}

/** 从任意字段取一段可读说明。 */
function detailOf(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 200)
  if (value && typeof value === 'object') {
    const message = (value as Record<string, unknown>)['message']
    if (typeof message === 'string' && message) return message.slice(0, 200)
  }
  return 'upstream envelope error'
}

/**
 * 判定一帧 SSE 信封是不是错误帧。
 *
 * 认三种形态(与对照站桥实测一致):
 * ① `{"error": {...}}` —— OpenAI 官方错误信封;
 * ② `{"statusCodeValue": 418, ...}` —— qoder 桥把上游状态码放在信封顶层;
 * ③ `{"code": 429, "message": "..."}` —— 部分兼容实现用 code 表达状态。
 */
export function detectEnvelopeError(json: unknown): EnvelopeError | null {
  if (!json || typeof json !== 'object') return null
  const obj = json as Record<string, unknown>

  // ② 桥形态:statusCodeValue 优先,因为它本身就是上游状态码
  const statusRaw = obj['statusCodeValue'] ?? obj['statusCode']
  const status = asHttpStatus(statusRaw)
  if (status !== null) {
    // 有状态码就够了:这时信封里通常还带 message/errorMessage
    return {
      status,
      retryable: isRetryableEnvelopeStatus(status),
      detail: detailOf(obj['errorMessage'] ?? obj['message'] ?? obj['error']),
      source: 'status_code_value',
    }
  }

  // ③ code 形态
  const code = codeAsHttp(obj['code'])
  if (code !== null && (obj['message'] !== undefined || obj['error'] !== undefined)) {
    return {
      status: code,
      retryable: isRetryableEnvelopeStatus(code),
      detail: detailOf(obj['message'] ?? obj['error']),
      source: 'code_field',
    }
  }

  // ① 官方错误信封:error 字段在,但信封里没给状态码 ⇒ 判不出档位,不重试
  const errFrame = obj['error']
  if (errFrame !== undefined && errFrame !== null) {
    const hinted = asHttpStatus(
      (errFrame as Record<string, unknown> | null) &&
        typeof errFrame === 'object' &&
        'status' in (errFrame as Record<string, unknown>)
        ? (errFrame as Record<string, unknown>)['status']
        : undefined,
    )
    return {
      status: hinted,
      retryable: isRetryableEnvelopeStatus(hinted),
      detail: detailOf(errFrame),
      source: 'error_field',
    }
  }

  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
