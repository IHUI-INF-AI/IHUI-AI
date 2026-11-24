// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B3-08 worker 行协议契约。
 *
 * ① 编码永远单行 + 尾换行；解码只认五类协议事件；
 * ② 畸形 JSON / 非对象 / 空行 / 非法字段一律丢弃；
 * ③ `ready` / `exit` / `error` 子通道字段齐全；
 * ④ 生产 stdout 解析真的走这条协议（不是另写一份 JSON.parse）。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  decodeWorkerLine,
  decodeWorkerLines,
  encodeWorkerLine,
} from '../src/subagents/worker-protocol.js';
import { parseWorkerStdout } from '../src/subagents/worker-pool.js';

const POOL_SRC = readFileSync(
  path.resolve(__dirname, '../src/subagents/worker-pool.ts'),
  'utf8',
);

describe('A 编码面', () => {
  it('编码永远单行 + 尾换行', () => {
    const line = encodeWorkerLine({ type: 'ready', pid: 123 });
    expect(line.endsWith('\n')).toBe(true);
    expect(line.trimEnd().split('\n')).toHaveLength(1);
  });

  it('编码后可原样解码', () => {
    const event = { type: 'message_delta' as const, text: '你好' };
    expect(decodeWorkerLine(encodeWorkerLine(event))).toEqual(event);
  });
});

describe('B 解码面', () => {
  it('ready 必须带正 pid', () => {
    expect(decodeWorkerLine('{"type":"ready","pid":42}')).toEqual({ type: 'ready', pid: 42 });
    expect(decodeWorkerLine('{"type":"ready"}')).toBeNull();
    expect(decodeWorkerLine('{"type":"ready","pid":0}')).toBeNull();
    expect(decodeWorkerLine('{"type":"ready","pid":"42"}')).toBeNull();
  });

  it('exit 接受数字与 null,保留 signal', () => {
    expect(decodeWorkerLine('{"type":"exit","exitCode":0,"signal":null}')).toEqual({
      type: 'exit',
      exitCode: 0,
      signal: null,
    });
    expect(decodeWorkerLine('{"type":"exit","exitCode":null}')).toEqual({
      type: 'exit',
      exitCode: null,
    });
    expect(decodeWorkerLine('{"type":"exit"}')).toBeNull();
  });

  it('error 只保留已知字段', () => {
    expect(
      decodeWorkerLine('{"type":"error","code":"OOM","message":"超限","exitCode":3,"extra":1}'),
    ).toEqual({ type: 'error', code: 'OOM', message: '超限', exitCode: 3 });
  });

  it('message_delta 至少带一个文本字段,否则丢弃', () => {
    expect(decodeWorkerLine('{"type":"message_delta","text":"a"}')).toEqual({
      type: 'message_delta',
      text: 'a',
    });
    expect(decodeWorkerLine('{"type":"message_delta"}')).toBeNull();
  });

  it('complete 保留 stopReason / iterations', () => {
    expect(
      decodeWorkerLine('{"type":"complete","stopReason":"stop","iterations":3}'),
    ).toEqual({ type: 'complete', stopReason: 'stop', iterations: 3 });
  });

  it('畸形 JSON / 非对象 / 空行 / 未知事件一律 null', () => {
    expect(decodeWorkerLine('')).toBeNull();
    expect(decodeWorkerLine('   ')).toBeNull();
    expect(decodeWorkerLine('{bad json')).toBeNull();
    expect(decodeWorkerLine('null')).toBeNull();
    expect(decodeWorkerLine('[]')).toBeNull();
    expect(decodeWorkerLine('"text"')).toBeNull();
    expect(decodeWorkerLine('{"type":"tool_call"}')).toBeNull();
  });

  it('CRLF 与前后空白不影响解码', () => {
    expect(decodeWorkerLine('  {"type":"ready","pid":7}\r\n')).toEqual({
      type: 'ready',
      pid: 7,
    });
  });
});

describe('C 多行与生产接线', () => {
  it('多行解码跳过畸形行,保留合法事件', () => {
    const events = decodeWorkerLines(
      '{"type":"ready","pid":1}\nnot-json\n{"type":"message_delta","text":"x"}\n',
    );
    expect(events).toEqual([
      { type: 'ready', pid: 1 },
      { type: 'message_delta', text: 'x' },
    ]);
  });

  it('生产 stdout 解析走 decodeWorkerLines(源码面无第二份 JSON.parse)', () => {
    expect(POOL_SRC).toContain("from './worker-protocol.js'");
    expect(POOL_SRC).toContain('decodeWorkerLines(stdout)');
  });

  it('message_delta 拼接、complete 取字段、error 进正文', () => {
    const stdout = [
      '{"type":"ready","pid":9}',
      '{"type":"message_delta","text":"第一段"}',
      '{"type":"message_delta","message":"第二段"}',
      '{"type":"complete","stopReason":"stop","iterations":4}',
      '',
    ].join('\n');
    expect(parseWorkerStdout(stdout)).toEqual({
      assistantText: '第一段第二段',
      stopReason: 'stop',
      iterations: 4,
    });
    expect(parseWorkerStdout('{"type":"error","message":"炸了"}').assistantText).toBe('炸了');
  });

  it('生产解析对畸形行不抛错', () => {
    expect(() => parseWorkerStdout('not-json\n{"type":"complete"}')).not.toThrow();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
