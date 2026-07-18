/**
 * stream_chunk — UTF-8 安全的 partial-result 帧分割。
 *
 * 灵感来源:参考行业 Agent 框架 streaming.rs 的 stream_chunk 算法
 *  (单调 total + tail 缓冲 + last_total delta + UTF-8 边界回退 + gap 标记)。
 *
 * 解决了什么问题:
 *   SSE / WebSocket 流式 chunk 在多字节字符(中文/emoji)中间被切分时,
 *   TextDecoder 解码会变成 U+FFFD,UI 显示乱码。本模块:
 *     1. 永不切到多字节字符中间
 *     2. 单 tick burst 超过 tail buffer 时不"假装没丢"也不"重发",
 *        只标记 gap=true 让上层决定是否请求重传
 *     3. cap < 单字符时按字节步进找到第一个完整字符,永不 stall
 *
 * 设计原则:
 *   - 纯函数,无副作用,无外部依赖
 *   - 与 AbortController / Web Streams / Node.js Stream 都解耦
 *   - 单一 API:streamChunk(spec, state, newBytes) -> ChunkResult | null
 *   - null 表示"本 tick 无新数据"或"已 stalled,等待更多字节"
 *
 * 用法:
 *   import { createStreamChunker, type StreamChunker } from './stream-chunk.js';
 *   const chunker = createStreamChunker({ maxDeltaBytes: 4096 });
 *   const out = chunker.push(newBytesFromNetwork);
 *   if (out) {
 *     state.append(out.delta);     // 一定是合法 UTF-8
 *     if (out.gap) state.markGap(); // 通知上层中间缺数据
 *   }
 */

export interface StreamChunkSpec {
  /** 单次 emit 的最大 delta 字节数。 */
  readonly maxDeltaBytes: number;
}

/** 一次 emit 的结果。 */
export interface ChunkResult {
  /** 合法 UTF-8 字符串(可能为空,例如 cap=0 但有 1 字节输入 → 返回 0 字节,需继续等)。 */
  readonly delta: string;
  /** emit 后 total 累加器的新值。 */
  readonly totalBytes: number;
  /** 是否标记了 gap(中间跳过了不可恢复的字节)。 */
  readonly gap: boolean;
  /** 末尾是否截断(decoder 还在等更多字节才能组成完整字符)。 */
  readonly truncated: boolean;
}

/** chunker 状态 — 调用方持有,跨 tick 持久化。 */
export interface ChunkerState {
  /** 累计已见字节数(单调)。 */
  total: number;
  /** 上次成功 emit 时的 total(用于计算 delta)。 */
  lastEmittedTotal: number;
  /** 末尾未完成字符的字节缓冲(可能不完整 UTF-8)。 */
  tail: Uint8Array;
  /** 是否曾标记 gap。 */
  gap: boolean;
}

export function createChunkerState(): ChunkerState {
  return {
    total: 0,
    lastEmittedTotal: 0,
    tail: new Uint8Array(0),
    gap: false,
  };
}

/**
 * 推入新字节,可能返回 0 个或 1 个 ChunkResult。
 * 调用方循环调用直到返回 null。
 */
export function streamChunk(
  spec: StreamChunkSpec,
  state: ChunkerState,
  newBytes: Uint8Array,
): ChunkResult | null {
  if (newBytes.length === 0) return null;
  if (spec.maxDeltaBytes <= 0) {
    throw new Error('streamChunk: maxDeltaBytes must be > 0');
  }

  // 1) tail 拼接新字节
  const combined = concatBytes(state.tail, newBytes);
  state.tail = combined;
  state.total += newBytes.length;

  // 2) 是否有可 emit 的 delta?
  //    newBytes 数 = state.total - state.lastEmittedTotal
  //    但 tail 里可能含上次未完整字符,所以真正可 emit < combined.length
  const newByteCount = state.total - state.lastEmittedTotal;
  if (newByteCount === 0) return null;

  // 3) 路径 A: newByteCount <= tail.length
  //    全部可 emit,但需从尾部回退到合法 UTF-8 边界
  if (newByteCount <= combined.length) {
    // 取 combined 末尾 newByteCount 字节
    const candidate = combined.subarray(combined.length - newByteCount);
    const { safe, truncated } = utf8SafeTail(candidate, spec.maxDeltaBytes);
    if (safe.length === 0 && truncated) {
      // 全部字节都是不完整字符的尾,等更多字节
      return null;
    }
    const deltaText = new TextDecoder('utf-8', { fatal: false }).decode(safe);
    state.tail = truncated
      ? combined.subarray(combined.length - candidate.length)
      : new Uint8Array(0);
    state.lastEmittedTotal = state.total;
    return {
      delta: deltaText,
      totalBytes: state.total,
      gap: state.gap,
      truncated,
    };
  }

  // 4) 路径 B: newByteCount > tail.length
  //    tail 全部 emit,但需要标记 gap=true(中间有跳过的字节)
  const safeAll = utf8SafeHead(combined);
  if (safeAll.length === 0) {
    // combined 全是不完整字符 → 全部累计到 tail,返回 null
    return null;
  }
  const deltaText = new TextDecoder('utf-8', { fatal: false }).decode(safeAll);
  // tail 保留剩余未消费字节(应该为空,因 combined 全部 consumed)
  state.tail = combined.subarray(safeAll.length);
  state.lastEmittedTotal = state.total;
  state.gap = true;
  return {
    delta: deltaText,
    totalBytes: state.total,
    gap: true,
    truncated: state.tail.length > 0,
  };
}

/** 工具:拼接两个 Uint8Array。 */
function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/**
 * 取 candidate 末尾一段(<= maxBytes),保证 UTF-8 边界。
 * 返回 { safe: 合法 UTF-8 字节, truncated: 末尾是否还有未完整字符 }
 */
function utf8SafeTail(
  candidate: Uint8Array,
  maxBytes: number,
): { safe: Uint8Array; truncated: boolean } {
  const cap = Math.min(maxBytes, candidate.length);
  if (cap === 0) return { safe: new Uint8Array(0), truncated: candidate.length > 0 };

  // 起点: candidate.length - cap
  // 终点: candidate.length
  // 从终点向起点回退,直到起点处的字节是合法 UTF-8 字符的开始
  const end = candidate.length;
  // 先检查尾部有多少不完整字节
  const tailBack = utf8BacktrackBytes(candidate, end);
  // tailBack 表示末尾 1-3 字节是不完整字符尾(0 表示末尾是完整字符)
  if (tailBack > 0 && tailBack >= end) {
    // 整个 candidate 都是不完整字符
    return { safe: new Uint8Array(0), truncated: true };
  }
  // 有效终点 = end - tailBack
  const validEnd = end - tailBack;
  // 检查起点是否在 UTF-8 字符中间
  // 从 validEnd 往回 cap 字节,但起点要保证是字符首字节
  let start = Math.max(0, validEnd - cap);
  // 如果 start 落在多字节字符中间,前进到下一个字符首字节
  if (start > 0) {
    const back = utf8BacktrackBytes(candidate, start);
    if (back > 0 && back >= start) {
      // 起点之前全是不完整字符,放弃
      start = validEnd; // 退化为不 emit
    } else {
      start -= back;
    }
  }
  return {
    safe: candidate.subarray(start, validEnd),
    truncated: tailBack > 0,
  };
}

/**
 * 取 combined 前面一段,保证 UTF-8 边界(用于路径 B 全 emit)。
 * 返回合法 UTF-8 字节(末尾不完整字符会被保留在 tail)。
 */
function utf8SafeHead(combined: Uint8Array): Uint8Array {
  if (combined.length === 0) return combined;
  // 从尾向前 backtrack,找到最后一个完整字符边界
  const tailBack = utf8BacktrackBytes(combined, combined.length);
  if (tailBack >= combined.length) return new Uint8Array(0);
  return combined.subarray(0, combined.length - tailBack);
}

/**
 * 给定位置 pos,回溯 pos 之前最近一个字符首字节的偏移量。
 * 返回 0 表示 pos 正好是字符首字节(无需回溯);
 * 返回 1-3 表示 pos 在多字节字符中(UTF-8 字符最多 4 字节)。
 *
 * 策略:看 pos - 1 字节的高位模式判断字符长度。
 *  - 0xxxxxxx (0x00-0x7F): 单字节字符,pos-1 是字符首字节,pos 是下一字符首字节 → 返回 0
 *  - 10xxxxxx (0x80-0xBF): 续字节,需要继续向前
 *  - 110xxxxx (0xC0-0xDF): 双字节首字节,pos-1 是首字节,pos 在字符中 → 返回 1
 *  - 1110xxxx (0xE0-0xEF): 三字节首字节 → 返回 1(从字符首字节起还需要 2 字节)
 *  - 11110xxx (0xF0-0xF7): 四字节首字节 → 返回 1
 *
 * 病态处理:pos 越界或字符长度无效 → 返回保守的 0(让上层按完整字符处理)。
 */
function utf8BacktrackBytes(buf: Uint8Array, pos: number): number {
  if (pos <= 0) return 0;
  if (pos > buf.length) return 0;
  // 看 pos 之前最多 3 字节,确定 pos 是否在字符中
  const lookback = Math.min(3, pos);
  for (let i = 1; i <= lookback; i++) {
    const b = buf[pos - i]!;
    if ((b & 0xC0) === 0xC0) {
      // 首字节:字符长度由高位的 1 数量决定
      let charLen: number;
      if ((b & 0x80) === 0) charLen = 1;
      else if ((b & 0xE0) === 0xC0) charLen = 2;
      else if ((b & 0xF0) === 0xE0) charLen = 3;
      else if ((b & 0xF8) === 0xF0) charLen = 4;
      else return 0; // 无效首字节
      // 字符完整结束位置 = (pos - i) + charLen
      // pos 在字符中 ⟺ pos < (pos - i) + charLen
      const charEnd = pos - i + charLen;
      if (pos < charEnd) {
        return i; // pos 在字符中间,需要回溯 i 字节
      }
      return 0; // pos 正好是字符首字节
    }
  }
  return 0; // 没找到首字节,默认不 backtrack
}

/**
 * 便捷工厂:返回绑定了 spec 的 push 函数。
 */
export function createStreamChunker(
  spec: StreamChunkSpec,
): (state: ChunkerState, bytes: Uint8Array) => ChunkResult | null {
  return (state, bytes) => streamChunk(spec, state, bytes);
}
