// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { Buffer } from 'node:buffer';

/**
 * MCP stdio 分帧。NDJSON 是本仓原有假服务器和历史登记的形态；
 * Content-Length 是官方 MCP stdio（REA 的 `mcp` 子命令走这一档）。
 * 两种帧可以出现在同一条字节流里。长度按 UTF-8 字节计，不按码元。
 */

const HEADER_RE = /^content-length:\s*(\d+)\s*$/i;

export function encodeNdjson(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

export function encodeContentLength(value: unknown): string {
  const body = JSON.stringify(value);
  const length = Buffer.byteLength(body, 'utf8');
  // 尾随 \r\n 是 REA 6.4.0 stdio 解析器的硬要求:没有它帧会永远停在缓冲里不触发。
  // 官方 SDK 解析器把帧间空行当噪声跳过,对其他 content-length 服务器无副作用。
  return `Content-Length: ${length}\r\n\r\n${body}\r\n`;
}

export interface StdioFrameDecoder {
  push(chunk: Buffer | string): unknown[];
  reset(): void;
}

export function createStdioFrameDecoder(): StdioFrameDecoder {
  let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);

  const take = (n: number): Buffer => {
    const out = buffer.subarray(0, n);
    buffer = buffer.subarray(n);
    return out;
  };

  function pushContentLength(messages: unknown[]): boolean {
    const text = buffer.toString('utf8');
    if (!text.toLowerCase().startsWith('content-length:')) return false;
    const sep = text.indexOf('\r\n\r\n');
    if (sep < 0) return true;
    const header = text.slice(0, sep);
    const match = HEADER_RE.exec(header.split('\r\n')[0] ?? '');
    if (!match) {
      throw new Error(`invalid content-length header: ${header.split('\r\n')[0] ?? ''}`);
    }
    const length = Number(match[1]);
    const headerBytes = Buffer.byteLength(text.slice(0, sep + 4), 'utf8');
    if (buffer.length < headerBytes + length) return true;
    take(headerBytes);
    const body = take(length).toString('utf8');
    try {
      messages.push(JSON.parse(body));
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`invalid content-length body: ${detail}`);
    }
    return true;
  }

  function pushNdjson(messages: unknown[]): void {
    // 必须按**字节**找换行再解码:先 `buffer.toString('utf8')` 会把被 chunk 边界切开的
    // 多字节字符(典型是中文)变成 U+FFFD 替换符,再按"解码后文本长度"反推字节数就会
    // 切错帧 —— 大结果/中文结果整段丢失或串行,正是 F-103 的现场。
    const nl = buffer.indexOf(0x0a);
    if (nl < 0) return;
    const line = take(nl + 1).toString('utf8').replace(/\r?\n$/, '').trim();
    if (line.length === 0) return;
    try {
      messages.push(JSON.parse(line));
    } catch {
      // 与原 NDJSON 分派器一致：坏行跳过，不打断后续帧。
    }
  }

  return {
    reset(): void {
      buffer = Buffer.alloc(0);
    },
    push(chunk: Buffer | string): unknown[] {
      const next = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
      buffer = buffer.length === 0 ? next : Buffer.concat([buffer, next]);
      const messages: unknown[] = [];
      while (buffer.length > 0) {
        const head = buffer.toString('utf8');
        if (head.toLowerCase().startsWith('content-length:')) {
          const held = buffer.length;
          const consumed = pushContentLength(messages);
          if (!consumed) break;
          if (buffer.length === held) break;
          continue;
        }
        if (!head.includes('\n')) break;
        const before = buffer.length;
        pushNdjson(messages);
        if (buffer.length === before) break;
      }
      return messages;
    },
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
