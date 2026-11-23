// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Worker 行协议（B3-08）：主通道 NDJSON 编解码 + ready/exit/error 子通道契约。
 *
 * 口径（对照 Qoder worker runtime 的字符串级取证）：
 *   - 主通道每条消息 = `JSON.stringify(message) + '\n'`，stdin 按行解析；
 *   - `ready` 回执带 pid，`exit` 回执带 exitCode/signal，未起任务回 `error`；
 *   - 畸形 JSON / 非对象 / 空行一律丢弃，不让半截帧污染结果；
 *   - 编码端永远单行 + 尾换行，调用方不需要自己拼协议细节。
 *
 * 边界：本层只做帧编解码，不启动进程、不读 stdin、不写 stdout。
 */

import { isRecord, tryParseJson } from '../util/json.js';

export type WorkerReadyEvent = {
  type: 'ready';
  pid: number;
};

export type WorkerExitEvent = {
  type: 'exit';
  exitCode: number | null;
  signal?: string | null;
};

export type WorkerErrorEvent = {
  type: 'error';
  message?: string;
  code?: string;
  exitCode?: number;
};

export type WorkerMessageDeltaEvent = {
  type: 'message_delta';
  text?: string;
  message?: string;
  payload?: string;
};

export type WorkerCompleteEvent = {
  type: 'complete';
  stopReason?: string;
  iterations?: number;
};

export type WorkerProtocolEvent =
  | WorkerReadyEvent
  | WorkerExitEvent
  | WorkerErrorEvent
  | WorkerMessageDeltaEvent
  | WorkerCompleteEvent;

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function optionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * 编码一条 worker 行。对象无法序列化时抛 TypeError，**不**返回半截字符串。
 */
export function encodeWorkerLine(event: WorkerProtocolEvent): string {
  let json: string | undefined;
  try {
    json = JSON.stringify(event);
  } catch (err) {
    throw new TypeError(`worker 行协议序列化失败: ${(err as Error).message}`);
  }
  if (typeof json !== 'string') {
    throw new TypeError('worker 行协议序列化结果不是字符串');
  }
  return `${json}\n`;
}

/**
 * 解码一行 worker 输出。无法识别时返回 null，由调用方跳过该行。
 * 只认五类协议事件；runAgent 的其它 NDJSON 事件不在这里冒充。
 */
export function decodeWorkerLine(line: string): WorkerProtocolEvent | null {
  const trimmed = typeof line === 'string' ? line.trim() : '';
  if (!trimmed) return null;
  const parsed = tryParseJson(trimmed);
  if (!isRecord(parsed) || typeof parsed.type !== 'string') return null;

  switch (parsed.type) {
    case 'ready': {
      const pid = optionalFiniteNumber(parsed.pid);
      if (pid === undefined || pid <= 0) return null;
      return { type: 'ready', pid };
    }
    case 'exit': {
      const exitCode =
        parsed.exitCode === null
          ? null
          : optionalFiniteNumber(parsed.exitCode);
      if (exitCode === undefined) return null;
      const signal =
        parsed.signal === null ? null : optionalString(parsed.signal);
      return signal === undefined
        ? { type: 'exit', exitCode }
        : { type: 'exit', exitCode, signal };
    }
    case 'error': {
      return {
        type: 'error',
        ...(optionalString(parsed.message) !== undefined
          ? { message: optionalString(parsed.message) }
          : {}),
        ...(optionalString(parsed.code) !== undefined
          ? { code: optionalString(parsed.code) }
          : {}),
        ...(optionalFiniteNumber(parsed.exitCode) !== undefined
          ? { exitCode: optionalFiniteNumber(parsed.exitCode) }
          : {}),
      };
    }
    case 'message_delta': {
      const text = optionalString(parsed.text);
      const message = optionalString(parsed.message);
      const payload = optionalString(parsed.payload);
      if (text === undefined && message === undefined && payload === undefined) {
        return null;
      }
      return {
        type: 'message_delta',
        ...(text !== undefined ? { text } : {}),
        ...(message !== undefined ? { message } : {}),
        ...(payload !== undefined ? { payload } : {}),
      };
    }
    case 'complete': {
      const stopReason = optionalString(parsed.stopReason);
      const iterations = optionalFiniteNumber(parsed.iterations);
      return {
        type: 'complete',
        ...(stopReason !== undefined ? { stopReason } : {}),
        ...(iterations !== undefined ? { iterations } : {}),
      };
    }
    default:
      return null;
  }
}

/** 把多行输出拆成事件；畸形行跳过，不产出占位事件。 */
export function decodeWorkerLines(text: string): WorkerProtocolEvent[] {
  if (typeof text !== 'string' || !text) return [];
  const events: WorkerProtocolEvent[] = [];
  for (const line of text.split(/\r?\n/)) {
    const event = decodeWorkerLine(line);
    if (event) events.push(event);
  }
  return events;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
