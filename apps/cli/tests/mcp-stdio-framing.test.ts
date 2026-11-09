// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  createStdioFrameDecoder,
  encodeContentLength,
  encodeNdjson,
} from '../src/tools/mcp-stdio-framing.js';

describe('mcp stdio framing', () => {
it('ndjson 一行一个，空行跳过，坏行不打断后面的好行', () => {
  const decoder = createStdioFrameDecoder();
  const raw = `${encodeNdjson({ id: 1 })}\nnot-json\n${encodeNdjson({ id: 2 })}`;
  assert.deepEqual(decoder.push(raw), [{ id: 1 }, { id: 2 }]);
});

it('两帧一次 push', () => {
  const decoder = createStdioFrameDecoder();
  const raw = encodeNdjson({ a: 1 }) + encodeNdjson({ b: 2 });
  assert.deepEqual(decoder.push(raw), [{ a: 1 }, { b: 2 }]);
});

it('content-length 按 UTF-8 字节计，中文不会被截断', () => {
  const decoder = createStdioFrameDecoder();
  const value = { text: '复现' };
  const frame = encodeContentLength(value);
  assert.equal(frame.includes('Content-Length: '), true);
  assert.deepEqual(decoder.push(frame), [value]);
});

it('content-length 帧体以 \\r\\n 收尾（REA 6.4.0 解析器硬要求）', () => {
  const frame = encodeContentLength({ jsonrpc: '2.0', id: 1 });
  assert.equal(frame.endsWith('\r\n'), true);
  assert.equal(frame.includes('\r\n\r\n'), true);
  const body = frame.slice(frame.indexOf('\r\n\r\n') + 4, -2);
  assert.equal(Buffer.byteLength(body, 'utf8'), Number(/Content-Length: (\d+)/.exec(frame)![1]));
});

it('content-length 拆成多次 push 仍能拼回', () => {
  const decoder = createStdioFrameDecoder();
  const frame = encodeContentLength({ ok: true });
  const cut = 8;
  assert.deepEqual(decoder.push(frame.slice(0, cut)), []);
  assert.deepEqual(decoder.push(frame.slice(cut)), [{ ok: true }]);
});

it('坏的 content-length body 抛错', () => {
  const decoder = createStdioFrameDecoder();
  const body = '{';
  const frame = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
  assert.throws(() => decoder.push(frame), /invalid content-length body/);
});

it('两种帧可以接在同一段缓冲里', () => {
  const decoder = createStdioFrameDecoder();
  const raw = encodeContentLength({ n: 1 }) + encodeNdjson({ n: 2 });
  assert.deepEqual(decoder.push(raw), [{ n: 1 }, { n: 2 }]);
});

it('F-103:行内非 UTF-8 字节不能吃掉紧随其后的合法帧(必须按字节切行)', () => {
  const decoder = createStdioFrameDecoder();
  // 0xff 不是合法 UTF-8:旧实现先 `buffer.toString('utf8')` 把它变成 1 个 U+FFFD
  // (3 字节),再按"解码后文本的字节数"反推这一行占多少字节,就多算 2 字节;
  // 多吃的这 2 字节会把下一行合法 JSON 切坏,导致整帧被静默丢弃(等 10s 超时)。
  const raw = Buffer.concat([
    Buffer.from([0xff]),
    Buffer.from('\n', 'utf8'),
    Buffer.from(encodeNdjson({ ok: true }), 'utf8'),
  ]);
  // 坏行本身按既有约定跳过(不抛),但后面的好行必须照常送达。
  assert.deepEqual(decoder.push(raw), [{ ok: true }]);
});
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
