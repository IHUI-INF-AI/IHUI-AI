// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 启动画像的 span 树(2026-11-23 立 B4-08)。
 *
 * 来由(五程序原生取证 B4-08):取证件(Qoder)的启动画像是一棵 span 树 —— 段可嵌套、
 * 可并发、可在目标达成后停采。本仓 `profile.ts` 只有扁平里程碑(entry/commandParsed/exit),
 * 三处缺口:
 *   ① 没有父子关系 ⇒ 看不出"哪一段吃掉了启动预算";
 *   ② 同父下并发开两段时,扁平模型只能二选一(先到者占名)⇒ 后到那段耗时**凭空消失**;
 *   ③ 没有停采点 ⇒ 启动完成后仍在打点的路径继续计,把稳态耗时算进启动。
 *
 * 三态判据(§0.3,与 `profile.ts` 同族):
 *   - `measured`   :必需 span 齐、无并发覆盖、无违序、全闭合;
 *   - `overlapped` :同父下曾并发开同名 span(计时被覆盖,不可当 measured 用)—— 点名首条;
 *   - `unjudged`   :无 span / span 未闭合 / 时钟违序 / 缺必需 span —— 取不到就不冒 measured。
 *
 * 纪律三条:① **零缺省** —— 未调用 `open()` 的路径不产生任何额外开销、不写盘、不输出;
 * ② 停采(`stopAt`)只停"新增",已开段照常闭合;③ 不联网、不依赖外部包、时钟由调用方注入。
 */
import { formatMs } from './profile.js';

export const SPAN_STATE_MEASURED = 'measured';
export const SPAN_STATE_OVERLAPPED = 'overlapped';
export const SPAN_STATE_UNJUDGED = 'unjudged';

export type SpanState =
  | typeof SPAN_STATE_MEASURED
  | typeof SPAN_STATE_OVERLAPPED
  | typeof SPAN_STATE_UNJUDGED;

export interface SpanHandle {
  /** 闭合本段;重复调用幂等(第二次起无副作用)。 */
  close(): void;
}

export interface SpanSlowest {
  name: string;
  ms: number;
}

export type SpanReading =
  | {
      state: typeof SPAN_STATE_MEASURED;
      spanCount: number;
      roots: string[];
      maxDepth: number;
      totalMs: number;
      slowest: SpanSlowest;
    }
  | {
      state: typeof SPAN_STATE_OVERLAPPED;
      overlapCount: number;
      first: { parent: string | null; name: string };
    }
  | {
      state: typeof SPAN_STATE_UNJUDGED;
      reason: string;
      detail: string;
    };

export interface SpanTreeOptions {
  /** 必需 span(按名字比对,不看深度);缺任意一个 ⇒ unjudged 点名。 */
  required?: readonly string[];
  /** 该 span 首次闭合后停止采集:后续 `open()` 记一次 stopped 计数并返回空句柄。 */
  stopAt?: string;
}

export interface SpanTree {
  open(name: string): SpanHandle;
  reading(): SpanReading;
  /** `stopAt` 是否已达成(未配 `stopAt` 恒 false)。 */
  stopped(): boolean;
  /** 停采后仍被 `open()` 调用的次数(停采生效的可见证据)。 */
  stoppedOpenCount(): number;
}

interface SpanNode {
  name: string;
  parentIndex: number;
  startedAtMs: number;
  endedAtMs: number | null;
}

const NOOP_HANDLE: SpanHandle = { close(): void {} };

export function createSpanTree(
  clock: () => number,
  options: SpanTreeOptions = {},
): SpanTree {
  const nodes: SpanNode[] = [];
  /** 打开中的节点下标(栈序;支持乱序闭合,闭合时按下标移除)。 */
  const frames: number[] = [];
  const overlaps: Array<{ parentIndex: number; name: string }> = [];
  const required: readonly string[] = options.required ?? [];
  const stopAt = options.stopAt ?? null;
  let stopped = false;
  let stoppedOpenCount = 0;

  const depthOf = (index: number): number => {
    let depth = 1;
    let cursor = nodes[index]!.parentIndex;
    while (cursor >= 0) {
      depth += 1;
      cursor = nodes[cursor]!.parentIndex;
    }
    return depth;
  };

  const closeNode = (index: number): void => {
    const node = nodes[index]!;
    if (node.endedAtMs !== null) return;
    node.endedAtMs = clock();
    const frameAt = frames.indexOf(index);
    if (frameAt >= 0) frames.splice(frameAt, 1);
    if (stopAt !== null && !stopped && node.name === stopAt) stopped = true;
  };

  return {
    open(name: string): SpanHandle {
      if (stopped) {
        stoppedOpenCount += 1;
        return NOOP_HANDLE;
      }
      const parentIndex = frames.length > 0 ? frames[frames.length - 1]! : -1;
      // 同名段语义互斥:并发开同名段(兄弟或嵌套)时后到那段与先到那段共用同一个名字,
      // 读数无法区分谁是谁 ⇒ 记覆盖。这里只认"名字 + 仍打开",不认血缘 ——
      // 不同父同名但**不在同一时刻打开**的两段不构成覆盖(见不同父用例)。
      for (const openIndex of frames) {
        const openNode = nodes[openIndex]!;
        if (openNode.name === name) {
          overlaps.push({ parentIndex: openNode.parentIndex, name });
          break;
        }
      }
      const index = nodes.length;
      nodes.push({ name, parentIndex, startedAtMs: clock(), endedAtMs: null });
      frames.push(index);
      const handle: SpanHandle = {
        close: (): void => {
          closeNode(index);
        },
      };
      return handle;
    },

    reading(): SpanReading {
      if (nodes.length === 0) {
        return { state: SPAN_STATE_UNJUDGED, reason: 'no-spans', detail: 'no span was opened' };
      }
      const unclosed = nodes.filter((n) => n.endedAtMs === null);
      if (unclosed.length > 0) {
        return {
          state: SPAN_STATE_UNJUDGED,
          reason: 'span-unclosed',
          detail: unclosed.map((n) => n.name).join(','),
        };
      }
      // 违序:自身时长为负,或子段跑到父段开合区间之外。
      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i]!;
        const end = node.endedAtMs as number;
        if (end < node.startedAtMs) {
          return { state: SPAN_STATE_UNJUDGED, reason: 'non-monotonic', detail: node.name };
        }
        if (node.parentIndex >= 0) {
          const parent = nodes[node.parentIndex]!;
          const parentEnd = parent.endedAtMs as number;
          if (node.startedAtMs < parent.startedAtMs || end > parentEnd) {
            return { state: SPAN_STATE_UNJUDGED, reason: 'non-monotonic', detail: node.name };
          }
        }
      }
      const missing = required.filter((name) => !nodes.some((n) => n.name === name));
      if (missing.length > 0) {
        return {
          state: SPAN_STATE_UNJUDGED,
          reason: 'missing-required',
          detail: missing.join(','),
        };
      }
      if (overlaps.length > 0) {
        const first = overlaps[0]!;
        const parentName = first.parentIndex >= 0 ? nodes[first.parentIndex]!.name : null;
        return {
          state: SPAN_STATE_OVERLAPPED,
          overlapCount: overlaps.length,
          first: { parent: parentName, name: first.name },
        };
      }
      let maxDepth = 0;
      const roots: string[] = [];
      let slowest: SpanSlowest = { name: nodes[0]!.name, ms: -1 };
      let totalMs = 0;
      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i]!;
        const depth = depthOf(i);
        if (depth > maxDepth) maxDepth = depth;
        const end = node.endedAtMs as number;
        const ms = end - node.startedAtMs;
        if (node.parentIndex < 0) {
          roots.push(node.name);
          if (ms > totalMs) totalMs = ms;
        }
        if (ms > slowest.ms) slowest = { name: node.name, ms };
      }
      return {
        state: SPAN_STATE_MEASURED,
        spanCount: nodes.length,
        roots,
        maxDepth,
        totalMs,
        slowest,
      };
    },

    stopped(): boolean {
      return stopped;
    },

    stoppedOpenCount(): number {
      return stoppedOpenCount;
    },
  };
}

/**
 * 渲染一行 ASCII 读数(不折行)。unjudged / overlapped 行**不含任何 `<数字>ms` 读数** ——
 * 不可信的计时不得被账面化成耗时(同 `profile.ts` 的 0ms 禁令)。
 */
export function renderSpanLine(reading: SpanReading): string {
  if (reading.state === SPAN_STATE_UNJUDGED) {
    return `[spans] state=unjudged reason=${reading.reason} detail=${reading.detail} (an unjudged span tree is never reported as a measurement)`;
  }
  if (reading.state === SPAN_STATE_OVERLAPPED) {
    const parent = reading.first.parent ?? 'root';
    return `[spans] state=overlapped overlaps=${reading.overlapCount} first=${parent}/${reading.first.name} (concurrent same-name spans make elapsed time unreliable)`;
  }
  return `[spans] state=measured count=${reading.spanCount} roots=${reading.roots.join(',')} maxDepth=${reading.maxDepth} total=${formatMs(reading.totalMs)} slowest=${reading.slowest.name}@${formatMs(reading.slowest.ms)}`;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
