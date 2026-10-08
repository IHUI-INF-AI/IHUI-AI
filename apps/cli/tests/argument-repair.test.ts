// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-711 成对测试:typed 结果提交的回喂通道(argument-repair-loop)。
 *
 * 票面验收夹具(逐条对应):
 *   ① "payload 是被引号包的 JSON 字符串" —— 原值是 string、一次 JSON.parse 后合格,
 *      判定走解析后对象,accepted 返回解析后的参数树;
 *   ② "解析后仍不过 ⇒ 上报解析后路径" —— 违规清单是**解码后对象**上的路径级违规
 *      (missing_required @ name),绝不是原串上的 "(root) type_mismatch"。
 *
 * 预算时序判据:REPAIR/NUDGE 两条**独立**预算;每条终态帧(reject/nudge/exhausted)
 * 落地前都先 await cancelAsk —— 用调用日志按序钉死;accepted 帧不触发 cancelAsk。
 */

import { describe, expect, it } from 'vitest';

import type { ToolSchema } from '../src/tools/index.js';
import {
  createArgumentRepairSession,
  NUDGE_ATTEMPTS,
  normalizeSubmit,
  REPAIR_ATTEMPTS,
} from '../src/tools/argument-repair-loop.js';

const FIXTURE_SCHEMA: ToolSchema = {
  name: 'fixture_tool',
  description: '',
  parameters: {
    type: 'object',
    properties: { name: { type: 'string', description: '' } },
    required: ['name'],
  },
};

describe('G-711 双预算常量', () => {
  it('REPAIR_ATTEMPTS=3 与 NUDGE_ATTEMPTS=1 独立成两条预算', () => {
    expect(REPAIR_ATTEMPTS).toBe(3);
    expect(NUDGE_ATTEMPTS).toBe(1);
  });
});

describe('normalizeSubmit 判序(票面两条夹具)', () => {
  it('夹具① payload 是被引号包的 JSON 字符串 ⇒ 一次 parse 后按解析后对象判定合格', () => {
    const raw = '{"name":"alpha"}';
    const out = normalizeSubmit(raw, FIXTURE_SCHEMA);
    expect(out.valid).toBe(true);
    expect(out.reparsed).toBe(true);
    expect(out.candidate).toEqual({ name: 'alpha' });
    expect(out.violations).toEqual([]);
  });

  it('夹具② 解析后仍不过 ⇒ 上报解析后对象上的路径级违规(不是原串的 (root) type_mismatch)', () => {
    const raw = JSON.stringify({ other: 1 });
    const out = normalizeSubmit(raw, FIXTURE_SCHEMA);
    expect(out.valid).toBe(false);
    expect(out.reparsed).toBe(true);
    expect(out.candidate).toEqual({ other: 1 });
    expect(out.violations).toHaveLength(1);
    expect(out.violations[0].field).toBe('name');
    expect(out.violations[0].reason).toBe('missing_required');
  });

  it('原值本身合格(非 string)⇒ 原样通过、不 reparsed', () => {
    const out = normalizeSubmit({ name: 'direct' }, FIXTURE_SCHEMA);
    expect(out.valid).toBe(true);
    expect(out.reparsed).toBe(false);
    expect(out.candidate).toEqual({ name: 'direct' });
  });

  it('原值不过且非 string ⇒ 不做 parse,违规即原值上的', () => {
    const out = normalizeSubmit({ other: 1 }, FIXTURE_SCHEMA);
    expect(out.valid).toBe(false);
    expect(out.reparsed).toBe(false);
    expect(out.violations[0].field).toBe('name');
    expect(out.violations[0].reason).toBe('missing_required');
  });

  it('原值是 string 但解析失败 ⇒ 一次 parse 即止,报原值上的违规', () => {
    const out = normalizeSubmit('not-json-at-all', FIXTURE_SCHEMA);
    expect(out.valid).toBe(false);
    expect(out.reparsed).toBe(false);
    expect(out.candidate).toBe('not-json-at-all');
    expect(out.violations[0].field).toBe('(root)');
  });
});

describe('createArgumentRepairSession 预算时序', () => {
  it('accepted 帧(含容错解析救回的)不触发 cancelAsk', async () => {
    const calls: string[] = [];
    const session = createArgumentRepairSession('fixture_tool', {
      schema: FIXTURE_SCHEMA,
      cancelAsk: () => {
        calls.push('cancelAsk');
      },
    });
    const ok = await session.submit('{"name":"alpha"}');
    expect(ok.kind).toBe('accepted');
    if (ok.kind === 'accepted') expect(ok.args).toEqual({ name: 'alpha' });
    expect(calls).toEqual([]);
    expect(session.repairsRemaining).toBe(REPAIR_ATTEMPTS);
    expect(session.nudgesRemaining).toBe(NUDGE_ATTEMPTS);
  });

  it('3 次 reject → 1 次 nudge → exhausted;每条终态帧都先 cancelAsk 再落地', async () => {
    const calls: string[] = [];
    const session = createArgumentRepairSession('fixture_tool', {
      schema: FIXTURE_SCHEMA,
      cancelAsk: async () => {
        calls.push('cancelAsk');
      },
    });
    const bad = JSON.stringify({ other: 1 });

    for (let i = 0; i < REPAIR_ATTEMPTS; i++) {
      const outcome = await session.submit(bad);
      calls.push(`outcome:${outcome.kind}`);
      expect(outcome.kind).toBe('reject');
      if (outcome.kind === 'reject') {
        expect(outcome.violations[0].field).toBe('name');
        expect(typeof outcome.violationsLine).toBe('string');
        expect(outcome.violationsLine.length).toBeGreaterThan(0);
        expect(outcome.repairsRemaining).toBe(REPAIR_ATTEMPTS - 1 - i);
        expect(outcome.nudgesRemaining).toBe(NUDGE_ATTEMPTS);
      }
    }
    expect(session.repairsRemaining).toBe(0);

    const nudge = await session.submit(bad);
    calls.push(`outcome:${nudge.kind}`);
    expect(nudge.kind).toBe('nudge');
    if (nudge.kind === 'nudge') {
      expect(nudge.nudgesRemaining).toBe(0);
      expect(typeof nudge.message).toBe('string');
      expect(nudge.message.length).toBeGreaterThan(0);
    }
    expect(session.nudgesRemaining).toBe(0);

    const final = await session.submit(bad);
    calls.push(`outcome:${final.kind}`);
    expect(final.kind).toBe('exhausted');
    if (final.kind === 'exhausted') {
      expect(final.violations[0].field).toBe('name');
      expect(final.violationsLine.length).toBeGreaterThan(0);
    }

    // 时序钉死:每个终态帧(reject×3 / nudge / exhausted)之前都恰好一次 cancelAsk
    expect(calls).toEqual([
      'cancelAsk',
      'outcome:reject',
      'cancelAsk',
      'outcome:reject',
      'cancelAsk',
      'outcome:reject',
      'cancelAsk',
      'outcome:nudge',
      'cancelAsk',
      'outcome:exhausted',
    ]);
  });

  it('不注入 cancelAsk(缺省 no-op)时同样跑通全预算', async () => {
    const session = createArgumentRepairSession('fixture_tool', { schema: FIXTURE_SCHEMA });
    for (let i = 0; i < REPAIR_ATTEMPTS; i++) {
      const outcome = await session.submit(JSON.stringify({ other: 1 }));
      expect(outcome.kind).toBe('reject');
    }
    expect((await session.submit(JSON.stringify({ other: 1 }))).kind).toBe('nudge');
    expect((await session.submit(JSON.stringify({ other: 1 }))).kind).toBe('exhausted');
  });

  it('中途一次合格提交即 accepted,不再继续消耗预算', async () => {
    const session = createArgumentRepairSession('fixture_tool', { schema: FIXTURE_SCHEMA });
    expect((await session.submit(JSON.stringify({ other: 1 }))).kind).toBe('reject');
    const ok = await session.submit('{"name":"recovered"}');
    expect(ok.kind).toBe('accepted');
    expect(session.repairsRemaining).toBe(REPAIR_ATTEMPTS - 1);
    expect(session.nudgesRemaining).toBe(NUDGE_ATTEMPTS);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
