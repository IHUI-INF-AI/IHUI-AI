// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 耗时样本 → llm_call_logs 落库形态的唯一适配器。
 *
 * 这是 `apps/api/src/routes/admin/relay-channels.ts` 测试探测分支(该文件内注释标为
 * "格②(2026-09-26)",位于 `latencyMs: result.latencyMs ?? 0` 与
 * `metadata.latencyTrusted` 那几行)已定约定的唯一实现:`latency_ms` 列非空
 * (`packages/database/src/schema/llm-call-logs.ts` 的 `integer('latency_ms').default(0).notNull()`),
 * 所以不可信样本(=null)落 0 属"列形态兜底"而非展示兜底,真相随行写入 `metadata.latencyTrusted`,
 * 统计/展示要排除这一型时按该标记过滤;响应面仍原样透出 null。
 *
 * 直方图类消费者不得用它(那种形态是跳过上报,见 `services/clawdbot/analytics.ts` 按
 * `latencyTrusted` 过滤后再算 avg/p95);本出口只服务"必须写进非空列"的落库面。
 */
import type { ElapsedSample } from './elapsed-ms.js'

export interface PersistableLatency {
  /** 可信 ⇒ elapsedMs 取整;不可信 ⇒ 0(列非空兜底,按 latencyTrusted 过滤掉) */
  readonly latencyMs: number
  /** 随行落进 metadata.latencyTrusted 的真相旗 */
  readonly latencyTrusted: boolean
}

/**
 * 把经交叉校验的耗时样本投影成可落库的一对值。
 *
 * 判不可信时除 `trustworthy` 外还查 `Number.isFinite`:假时钟/上游异常可产出 NaN,
 * 而 `trustworthy` 的判据是 `|perf − wall| > 容差`,NaN 比较恒 false 会被读成"可信",
 * 把 NaN 写进 integer 列即落库失败。真实双钟不会走到这一支。
 */
export function persistableLatency(sample: ElapsedSample): PersistableLatency {
  if (sample.elapsedMs === null || !sample.trustworthy || !Number.isFinite(sample.elapsedMs)) {
    return { latencyMs: 0, latencyTrusted: false }
  }
  return { latencyMs: Math.round(sample.elapsedMs), latencyTrusted: true }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
