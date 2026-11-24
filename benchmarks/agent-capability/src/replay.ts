// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 录制回放 provider —— 把"模型不确定性"钉死在这一层。
 *
 * 评测测的是 **agent runtime 的行为**（工具选择/参数校验/压缩保真/续跑一致/错误恢复），
 * 不是模型本身的生成质量。因此每次模型调用都由一份录制好的 OpenAI 兼容 SSE 帧序列
 * 逐条回放，并且：
 *  - 只接受指向 `providerBaseUrl`（eval-replay.local）的请求，其它 host 一律抛错
 *    → 结构上不可能打到真实付费接口；
 *  - 录制调用次数必须被恰好消费完（多调一次/少调一次都红）
 *    → 运行时循环行为（重试/续写/压缩多一轮）的变化无法被静默吞掉；
 *  - 回放是纯函数（同一个录制 → 同一串帧），不含随机、时间、环境分支。
 */
import { createHash } from 'node:crypto'

export const EVAL_BASE_URL = 'http://eval-replay.local/v1'

/** 一次模型调用 = 一串 OpenAI 兼容 SSE chunk 对象（按到达顺序逐条回放） */
export interface ReplaySseCall {
  /** 调用标签，用于报告与断言（例如 'turn1:read_file'） */
  label: string
  /** SSE chunk 原文对象序列（不做任何改写，原样 JSON 序列化后下发） */
  frames: Array<Record<string, unknown>>
  /** 可选 provider usage 帧（与真实 provider 上报同形） */
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens?: number }
}

export interface ReplayRecording {
  schemaVersion: 1
  /** 录制对应的模型标识（仅用于报告，不参与断言） */
  model: string
  calls: ReplaySseCall[]
}

export interface ReplayFetch {
  fetchImpl: (input: unknown, init?: { body?: string }) => Promise<unknown>
  /** 按顺序记录到的调用标签 */
  served: string[]
  /** 每次调用发出去的请求体（已 JSON.parse），供断言 messages/tools 演化 */
  requests: Array<Record<string, unknown>>
  /** 断言录制被恰好消费完 */
  assertFullyConsumed: () => void
}

export function validateRecording(value: unknown, source: string): ReplayRecording {
  const rec = value as Partial<ReplayRecording> | null
  if (!rec || typeof rec !== 'object') throw new Error(`${source}: 录制不是对象`)
  if (rec.schemaVersion !== 1) throw new Error(`${source}: schemaVersion 必须为 1`)
  if (typeof rec.model !== 'string' || !rec.model) throw new Error(`${source}: model 缺失`)
  if (!Array.isArray(rec.calls) || rec.calls.length === 0)
    throw new Error(`${source}: calls 不能为空`)
  for (const [i, call] of rec.calls.entries()) {
    if (!call || typeof call !== 'object') throw new Error(`${source}: calls[${i}] 不是对象`)
    if (typeof call.label !== 'string' || !call.label)
      throw new Error(`${source}: calls[${i}].label 缺失`)
    if (!Array.isArray(call.frames) || call.frames.length === 0) {
      throw new Error(`${source}: calls[${i}].frames 不能为空`)
    }
  }
  return rec as ReplayRecording
}

function sseResponse(call: ReplaySseCall): unknown {
  const encoder = new TextEncoder()
  const lines: string[] = []
  for (const frame of call.frames) lines.push(`data: ${JSON.stringify(frame)}\n\n`)
  if (call.usage) lines.push(`data: ${JSON.stringify({ choices: [], usage: call.usage })}\n\n`)
  lines.push('data: [DONE]\n\n')
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'text/event-stream' },
    text: async () => lines.join(''),
    body: {
      getReader: () => {
        let index = 0
        return {
          read: async () => {
            if (index >= lines.length) return { value: undefined, done: true }
            const line = lines[index]
            index += 1
            return { value: encoder.encode(line), done: false }
          },
        }
      },
    },
  }
}

export function createReplayFetch(calls: ReplaySseCall[]): ReplayFetch {
  let index = 0
  const served: string[] = []
  const requests: Array<Record<string, unknown>> = []

  const fetchImpl = async (input: unknown, init?: { body?: string }): Promise<unknown> => {
    const url = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? '')
    if (!url.startsWith(EVAL_BASE_URL)) {
      throw new Error(`评测禁止访问外网/真实接口：收到非回放地址请求 ${url}`)
    }
    if (index >= calls.length) {
      throw new Error(
        `回放录制已耗尽：模型被多调用了一次（第 ${index + 1} 次），实际动作集合与基线不一致`,
      )
    }
    const call = calls[index]!
    index += 1
    served.push(call.label)
    requests.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>)
    return sseResponse(call)
  }

  return {
    fetchImpl,
    served,
    requests,
    assertFullyConsumed: () => {
      if (index !== calls.length) {
        const remaining = calls.slice(index).map((c) => c.label)
        throw new Error(
          `回放录制未被消费完：剩余 ${remaining.length} 次未发生（${remaining.join(', ')}）`,
        )
      }
    },
  }
}

/** 录音指纹：把录制规范化后哈希，作为夹具版本标识写进快照 */
export function hashRecording(rec: ReplayRecording): string {
  return createHash('sha256').update(stableStringify(rec)).digest('hex')
}

/** 稳定序列化：对象键排序，保证跨平台/跨进程字节一致 */
export function stableStringify(value: unknown): string {
  const normalize = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(normalize)
    if (v && typeof v === 'object') {
      const obj = v as Record<string, unknown>
      const out: Record<string, unknown> = {}
      for (const key of Object.keys(obj).sort()) out[key] = normalize(obj[key])
      return out
    }
    return v
  }
  return JSON.stringify(normalize(value))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
