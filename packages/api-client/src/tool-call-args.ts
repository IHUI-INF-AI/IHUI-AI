// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具调用入参解析（逆向-复现-超越，AGENTS §0.12；接 `json-repair` 的修复/流式能力）
 *
 * 对标：Qoder / Trae 把 `jsonrepair` 用在工具调用入参上——LLM 产出的 `arguments` 常常残缺
 *       （流截断、裸键名、单引号…），直接 `JSON.parse` 会崩卡片。
 * 复现：`normalizeToolCallArgs` 把任意上游 args 形态（已是对象 / 字符串 / 残缺字符串）统一收敛为对象，
 *       字符串走 `repairJson` 修复解析，避免各端各自 `typeof==='string'?JSON.parse:…` 漂开。
 * 超越：`ToolCallArgsStreamer` 支持 OpenAI 风格 `function.arguments` **字符串分片**的增量解析——
 *       每个分片到达即给出当前最好部分 args（partial=true），流闭合即 complete，使 ToolCallCard
 *       在流未结束时就能渐进渲染入参（jsonrepair 只能吃完整串，做不到）。
 *
 * 红线：自研；不粘贴对照程序专有源码；不引入第三方 jsonrepair 包。
 */

import { createStreamingJsonRepair, repairJson } from './json-repair.js'

/** 单次工具调用入参的解析态。 */
export interface ToolCallArgsState {
  /** 原始分片已能解析为完整 JSON 对象（无需修复即 parse 通过） */
  complete: boolean
  /** 流未闭合但已尽力抽到可用部分对象 */
  partial: boolean
  /** 当前可用对象（complete 或 partial 时存在） */
  args: Record<string, unknown> | undefined
}

/** 把「值」收敛为普通对象（剔除 null / 数组 / 原始类型）。 */
function asObjectRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

/**
 * 入参归一化单一出口：
 * - 已是对象（非数组、非 null）→ 原样返回（引用不变，既有的 deep-equal 对账不受影响）
 * - 字符串 → `repairJson` 尽力修复后解析为对象；修复失败 → undefined
 * - 其余（null / 数组 / 原始类型）→ undefined
 * 用于 SSE 解析器在 `tool-call-start` / `tool-result` 处把上游 args 收口为对象，
 * 覆盖「上游把 args 当 JSON 字符串下发」或「略带残缺」的情形。
 */
export function normalizeToolCallArgs(raw: unknown): Record<string, unknown> | undefined {
  if (raw === null || raw === undefined) return undefined
  if (typeof raw === 'object') return asObjectRecord(raw)
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed === '') return undefined
    const r = repairJson(trimmed)
    return r.ok ? asObjectRecord(r.value) : undefined
  }
  return undefined
}

/**
 * 增量工具调用入参流：喂入 OpenAI 风格 `function.arguments` 字符串分片，逐片产出可用 args。
 * 流未闭合时即可拿到部分对象（partial），闭合后 complete。无分片时 args 为 undefined。
 */
export class ToolCallArgsStreamer {
  private readonly repair = createStreamingJsonRepair()

  push(fragment: string): ToolCallArgsState {
    const snap = this.repair.push(fragment)
    return {
      complete: snap.complete,
      partial: snap.partial,
      args: asObjectRecord(snap.value),
    }
  }

  /** 流是否已解析出完整 args（之后喂入的分片不会改变「已完成」这一事实）。 */
  get isComplete(): boolean {
    return this.repair.isComplete
  }
}

/** 工厂：创建一个增量工具调用入参流。 */
export function createToolCallArgsStreamer(): ToolCallArgsStreamer {
  return new ToolCallArgsStreamer()
}
