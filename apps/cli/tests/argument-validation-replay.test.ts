// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * A36 第①步离线回放器的判据测试。
 *
 * 全部用**构造记录**,不读 `~/.ihui/audit.jsonl` —— 审计日志是机器状态,
 * 拿它当断言输入会得到一台"在别人机器上红、在我机器上绿"的尺子(§26 同型)。
 * 真仓读数是手动取证:`ihui audit tool-args`(现值按当次实测,不入本文件)。
 */

import { describe, it, expect } from 'vitest';
import type { Tool } from '../src/tools/index.js';
import {
  replayArgumentDeviations,
  describeKind,
  declaredTypeOf,
  type ReplayRecord,
} from '../src/tools/argument-validation-replay.js';

function tool(over: Partial<Tool> = {}): Tool {
  return {
    name: 'demo',
    description: 'demo tool',
    parameters: {
      q: { type: 'string', description: '查询串' },
      n: { type: 'number', description: '次数' },
      todos: {
        type: 'array',
        description: '任务数组',
        items: {
          type: 'object',
          description: '单个任务',
          properties: { content: { type: 'string', description: '' }, summary: { type: 'string', description: '' } },
          required: ['content'],
        },
      },
    },
    required: ['q'],
    async execute() {
      return { success: true, output: '' };
    },
    ...over,
  } as Tool;
}

const registry = (t: Tool) => (name: string) => (name === t.name ? t : undefined);

describe('① describeKind 只报类型、绝不带值', () => {
  it('七类形态各有标签,空串与 null 单列', () => {
    expect(describeKind(undefined)).toBe('undefined');
    expect(describeKind(null)).toBe('null');
    expect(describeKind('')).toBe('empty-string');
    expect(describeKind('SECRET-VALUE')).toBe('string');
    expect(describeKind(7)).toBe('number');
    expect(describeKind(NaN)).toBe('non-finite-number');
    expect(describeKind(true)).toBe('boolean');
    expect(describeKind([1])).toBe('array');
    expect(describeKind({})).toBe('object');
  });

  it('台账任何字段都不得出现入参原值(隐私口径的机器锁)', () => {
    const secret = 'sk-DO-NOT-LEAK-9f3a';
    // 构造一条**必然产生偏差行**且行内装着原值的输入:n 声明为 number 而实得是字符串
    const recs: ReplayRecord[] = [{ tool: 'demo', input: { q: 'ok', n: secret } }];
    const { rows } = replayArgumentDeviations(recs, registry(tool()));
    const row = rows.find((r) => r.field === 'n');
    expect(row?.reason).toBe('type_mismatch');
    expect(row?.actualKind).toBe('string');
    // 整张表序列化后不得含任何入参值(expected 是声明侧,field 是路径,都不该有值)
    expect(JSON.stringify(rows)).not.toContain(secret);
  });
});

describe('② 偏差行的聚合', () => {
  it('同一 (工具,字段,类别) 合成一行并累计次数,时间取首末', () => {
    const recs: ReplayRecord[] = [
      { tool: 'demo', input: {}, timestamp: '2026-09-03T00:00:00.000Z' },
      { tool: 'demo', input: {}, timestamp: '2026-09-01T00:00:00.000Z' },
    ];
    const { rows, totals } = replayArgumentDeviations(recs, registry(tool()));
    const miss = rows.find((r) => r.reason === 'missing_required' && r.field === 'q');
    expect(miss?.count).toBe(2);
    expect(miss?.firstSeen).toBe('2026-09-01T00:00:00.000Z');
    expect(miss?.lastSeen).toBe('2026-09-03T00:00:00.000Z');
    expect(totals.invalid).toBe(2);
  });

  it('嵌套路径按校验器的写法落账(todos[0].summary 这类)', () => {
    const recs: ReplayRecord[] = [{ tool: 'demo', input: { q: 'ok', todos: [{ content: 'a', summary: {} }] } }];
    const { rows } = replayArgumentDeviations(recs, registry(tool()));
    const row = rows.find((r) => r.field === 'todos[0].summary');
    expect(row?.reason).toBe('type_mismatch');
    expect(row?.actualKind).toBe('object');
  });

  it('注册表里没有的工具计入 unknownTool,不产出偏差行', () => {
    const recs: ReplayRecord[] = [{ tool: 'mcp_remote', input: { anything: 1 } }];
    const { totals, rows } = replayArgumentDeviations(recs, registry(tool()));
    expect(totals.unknownTool).toBe(1);
    expect(totals.matched).toBe(0);
    expect(rows).toEqual([]);
  });

  it('合法调用零偏差(反向对照:上面几组不是因为"什么都判违规"才红的)', () => {
    const recs: ReplayRecord[] = [{ tool: 'demo', input: { q: 'hi', n: 3, todos: [{ content: 'a' }] } }];
    const { totals, rows } = replayArgumentDeviations(recs, registry(tool()));
    expect(totals.valid).toBe(1);
    expect(totals.invalid).toBe(0);
    expect(rows).toEqual([]);
  });

  it('coercion 只在内容真变了才落行,且 expected 取声明侧类型', () => {
    const recs: ReplayRecord[] = [
      { tool: 'demo', input: { q: 'ok', n: '42' } },
      { tool: 'demo', input: { q: 'ok', n: 42 } },
    ];
    const { rows, totals } = replayArgumentDeviations(recs, registry(tool()));
    const coerced = rows.filter((r) => r.reason === 'coerced');
    expect(coerced.length).toBe(1);
    expect(coerced[0].field).toBe('n');
    expect(coerced[0].expected).toBe('number');
    expect(coerced[0].actualKind).toBe('string');
    expect(totals.coercionOnly).toBe(1);
  });

  it('空记录必须如实报 0,不得凭"没有红"就算通过', () => {
    const { totals } = replayArgumentDeviations([], registry(tool()));
    expect(totals).toMatchObject({ records: 0, matched: 0, valid: 0, invalid: 0, rows: 0 });
  });
});

describe('③ declaredTypeOf 沿路径取声明侧', () => {
  it('嵌套数组元素的属性名要能解析出来', () => {
    const t = tool();
    expect(declaredTypeOf(t, 'todos')).toBe('array');
    expect(declaredTypeOf(t, 'todos[0].summary')).toBe('string');
    expect(declaredTypeOf(t, 'n')).toBe('number');
  });

  it('解析不到时返回 any,不抛(取不到 ≠ 判据失败)', () => {
    expect(declaredTypeOf(tool(), 'nope.deep.path')).toBe('any');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
