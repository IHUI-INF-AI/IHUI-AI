// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// A36 第②步「影子台账 → 可排期清单」单测(G-240)。
//
// 钉五件事,每件都是"没有它就会静默失效"的那一型:
//  ① 隐私:含唯一 nonce 的入参原值与整张枚举表都不得出现在记录/序列化结果里
//     (positive control —— 只测"看起来没打印"等于没测);
//  ② 默认零副作用:env 未设 ⇒ 台账一次都不写(与影子档"默认 off"是同一条纪律);
//  ③ 判据三态各有正反例:单一形态 ⇒ description-suspect、混杂 ⇒ caller-error、
//     样本不足/被剔证 ⇒ undetermined 且**必须报名**;
//  ④ "文件不存在"读成未判定而不是"样本为 0"—— 把没判写成判过了是本仓最高频失效型;
//  ⑤ 粗粒度快照投影永远产不出可排期行(它是"数据源缺席"这句话的出处,不是结论)。
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_LEDGER_RELATIVE_PATH,
  MIN_FIELD_SAMPLES_FOR_VERDICT,
  MIN_SAMPLES_FOR_SCHEDULING,
  TOOL_ARG_LEDGER_ENV,
  aggregateArgRejections,
  appendArgRejectionLedger,
  expectedShapeOf,
  formatArgRejectionReport,
  observedShapeOf,
  readArgLedger,
  recordsForValidation,
  recordsFromSnapshot,
  repoRootOf,
  resolveLedgerPath,
  runSelfTest,
  type ArgRejectionRecord,
} from '../src/tools/argument-validation-report.js';
import type { ValidationResult } from '../src/tools/argument-validator.js';
import type { ToolSchema } from '../src/tools/index.js';

const NONCE = 'NONCE-7f3a9c-user-raw-value';

/** 临时夹具落仓库内 gitignored 的 .ihui-agent/tmp(§15/§26:不往家目录与盘根随手写)。 */
const SCRATCH_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../.ihui-agent/tmp/tool-arg-report-tests');

const takenDirs: string[] = [];
afterEach(() => {
  while (takenDirs.length > 0) {
    const d = takenDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

let seq = 0;
function scratchDir(): string {
  seq += 1;
  const dir = join(SCRATCH_ROOT, `run-${process.pid}-${seq}`);
  mkdirSync(dir, { recursive: true });
  takenDirs.push(dir);
  return dir;
}

const schema: ToolSchema = {
  name: 'demo_tool',
  description: '',
  parameters: {
    type: 'object',
    properties: {
      mode: { type: 'string', description: '', enum: ['alpha', 'beta'] },
      count: { type: 'number', description: '' },
      nested: {
        type: 'object',
        description: '',
        properties: { title: { type: 'string', description: '', enum: ['x'] } },
        required: [],
      },
    },
    required: ['mode'],
  },
};

function invalid(errors: ValidationResult['errors']): ValidationResult {
  return { valid: false, coerced: {}, errors, coercedFields: [] };
}

function rec(
  tool: string,
  field: string,
  reason: ArgRejectionRecord['reason'],
  expected: string,
  observed: string,
): ArgRejectionRecord {
  return { tool, field, reason, expected, observed };
}

describe('observedShapeOf / expectedShapeOf:只出类别', () => {
  it('string 值只得到类别名,内容不外泄', () => {
    expect(observedShapeOf(NONCE)).toBe('string');
    expect(observedShapeOf([1, 2])).toBe('array');
    expect(observedShapeOf(null)).toBe('null');
    expect(observedShapeOf(NaN)).toBe('NaN');
    expect(observedShapeOf(undefined)).toBe('undefined');
  });

  it('枚举表折成条数,表内容不进记录', () => {
    expect(expectedShapeOf('enum(alpha|beta)')).toBe('enum(count=2)');
    expect(expectedShapeOf('enum(alpha|beta)')).not.toContain('alpha');
    expect(expectedShapeOf('number')).toBe('number');
    expect(expectedShapeOf(undefined)).toBe('any');
  });
});

describe('recordsForValidation:隐私与形状', () => {
  it('enum_mismatch 的原值与枚举表都不出现在序列化结果里(阳性对照)', () => {
    const records = recordsForValidation(
      schema,
      { mode: NONCE, nested: { title: NONCE } },
      invalid([
        { field: 'mode', reason: 'enum_mismatch', expected: 'enum(alpha|beta)', actual: NONCE },
        { field: 'nested.title', reason: 'enum_mismatch', expected: 'enum(x)', actual: NONCE },
      ]),
    );
    const dumped = JSON.stringify(records);
    expect(dumped).not.toContain(NONCE);
    expect(dumped).not.toContain('alpha');
    expect(dumped).not.toContain('enum(x)');
    expect(records[0]).toMatchObject({
      tool: 'demo_tool',
      field: 'mode',
      expected: 'enum(count=2)',
      observed: 'string',
    });
    expect(records[1]?.field).toBe('nested.title');
    expect(records[1]?.observed).toBe('string');
  });

  it('路径解析不到 ⇒ unresolved,而不是把"没有这个字段"读成 undefined 形态', () => {
    const records = recordsForValidation(
      schema,
      { mode: 'ok' },
      invalid([{ field: 'ghost.deep', reason: 'enum_mismatch', expected: 'enum(a|b)', actual: NONCE }]),
    );
    expect(records[0]?.observed).toBe('unresolved');
    expect(JSON.stringify(records)).not.toContain(NONCE);
  });

  it('非 enum 分支沿用 actual 里已有的形态类', () => {
    const records = recordsForValidation(
      schema,
      { count: '42' },
      invalid([{ field: 'count', reason: 'type_mismatch', expected: 'number', actual: 'string' }]),
    );
    expect(records[0]?.observed).toBe('string');
    expect(records[0]?.expected).toBe('number');
  });

  it('通过的样本不产生任何记录', () => {
    expect(
      recordsForValidation(schema, { mode: 'alpha' }, { valid: true, coerced: {}, errors: [], coercedFields: [] }),
    ).toEqual([]);
  });
});

describe('appendArgRejectionLedger:默认零副作用,显式才落盘', () => {
  const oneError = () =>
    invalid([{ field: 'mode', reason: 'enum_mismatch', expected: 'enum(alpha|beta)', actual: NONCE }]);

  it('env 未设 ⇒ 一个文件都不创建,并点名原因', () => {
    const target = join(scratchDir(), 'ledger.jsonl');
    const out = appendArgRejectionLedger(schema, { mode: NONCE }, oneError(), {});
    expect(out).toEqual({ appended: 0, skippedReason: `${TOOL_ARG_LEDGER_ENV} not set` });
    expect(existsSync(target)).toBe(false);
  });

  it('env 设了 ⇒ 落 JSONL,且落盘内容里没有原值', () => {
    const target = join(scratchDir(), 'sub', 'ledger.jsonl');
    const out = appendArgRejectionLedger(schema, { mode: NONCE }, oneError(), {
      [TOOL_ARG_LEDGER_ENV]: target,
    });
    expect(out.appended).toBe(1);
    const text = readFileSync(target, 'utf-8');
    expect(text).not.toContain(NONCE);
    expect(text).not.toContain('alpha');
    const read = readArgLedger(target);
    expect(read.records).toHaveLength(1);
    expect(read.malformedLines).toBe(0);
  });

  it('坏行只计数不猜内容', () => {
    const target = join(scratchDir(), 'ledger.jsonl');
    appendArgRejectionLedger(schema, { mode: NONCE }, oneError(), { [TOOL_ARG_LEDGER_ENV]: target });
    appendFileSync(target, 'not-json\n{"tool":"x"}\n', 'utf-8');
    const read = readArgLedger(target);
    expect(read.records).toHaveLength(1);
    expect(read.malformedLines).toBe(2);
  });

  it('文件不存在读成 missing(未判定),不是"样本 0 条"', () => {
    const read = readArgLedger(join(scratchDir(), 'nope.jsonl'));
    expect(read.missing).toBe(true);
    expect(read.records).toHaveLength(0);
  });
});

describe('aggregateArgRejections:三态判据各有正反例', () => {
  it('单一形态 ≥ 样本下限 ⇒ description-suspect,线索点名要核 handler', () => {
    const records = Array.from({ length: MIN_FIELD_SAMPLES_FOR_VERDICT }, () =>
      rec('agent_run', 'taskId', 'missing_required', 'string', 'undefined'),
    );
    const agg = aggregateArgRejections(records, {});
    expect(agg.rows).toHaveLength(1);
    expect(agg.rows[0]?.verdict).toBe('description-suspect');
    expect(agg.rows[0]?.clue).toMatch(/HANDLER/);
  });

  it('混杂形态 ⇒ caller-error(不是描述债)', () => {
    const agg = aggregateArgRejections(
      [
        rec('demo_tool', 'count', 'type_mismatch', 'number', 'string'),
        rec('demo_tool', 'count', 'type_mismatch', 'number', 'object'),
        rec('demo_tool', 'count', 'type_mismatch', 'number', 'null'),
      ],
      {},
    );
    expect(agg.rows[0]?.verdict).toBe('caller-error');
    expect(agg.rows[0]?.dominantShare).toBeLessThan(0.8);
  });

  it('样本不足 ⇒ 不进 top-N,但必须报名', () => {
    const agg = aggregateArgRejections([rec('demo_tool', 'count', 'type_mismatch', 'number', 'string')], {});
    expect(agg.rows).toHaveLength(0);
    expect(agg.undetermined).toHaveLength(1);
    expect(agg.undetermined[0]).toContain('demo_tool#count');
  });

  it('被 telemetry 剔证的工具落 undetermined,不冒充结论', () => {
    const records = Array.from({ length: MIN_FIELD_SAMPLES_FOR_VERDICT }, () =>
      rec('poisoned', 'x', 'type_mismatch', 'string', 'number'),
    );
    const agg = aggregateArgRejections(records, { excludedTools: ['poisoned'] });
    expect(agg.rows).toHaveLength(0);
    expect(agg.undetermined[0]).toMatch(/non-evidence/);
  });

  it('同一字段的两种"期望"必须分成两行(合成一行会把两种修法混成一笔账)', () => {
    const agg = aggregateArgRejections(
      [
        ...Array.from({ length: 3 }, () => rec('demo_tool', 'mode', 'enum_mismatch', 'enum(count=3)', 'string')),
        rec('demo_tool', 'mode', 'missing_required', 'string', 'undefined'),
      ],
      {},
    );
    expect(agg.rows).toHaveLength(1);
    expect(agg.rows[0]).toMatchObject({ field: 'mode', expected: 'enum(count=3)', rejections: 3 });
    // 必填那一笔样本不足 ⇒ 落未判定并报名,不被并入 enum 那行的计数里
    expect(agg.undetermined.some((u) => u.includes('demo_tool#mode'))).toBe(true);
    expect(agg.sampleCount).toBe(4);
  });

  it('总样本低于排期门槛 ⇒ schedulable false 且明写"不是没有债"', () => {
    const few = Array.from({ length: MIN_SAMPLES_FOR_SCHEDULING - 1 }, (_, i) =>
      rec(`tool_${i}`, 'f', 'type_mismatch', 'string', 'number'),
    );
    const agg = aggregateArgRejections(few, {});
    expect(agg.schedulable).toBe(false);
    expect(agg.schedulingNote).toMatch(/NOT schedulable/);
    expect(formatArgRejectionReport(agg, 'unit')).toMatch(/scheduling: NO/);
  });

  it('top-N 按样本数降序并受 topN 限制(并列按工具名稳定次序)', () => {
    const records = [
      ...Array.from({ length: 5 }, () => rec('hot', 'a', 'type_mismatch', 'string', 'number')),
      ...Array.from({ length: 3 }, () => rec('warm', 'b', 'type_mismatch', 'string', 'number')),
      ...Array.from({ length: 3 }, () => rec('cold', 'c', 'type_mismatch', 'string', 'number')),
    ];
    const agg = aggregateArgRejections(records, { topN: 2 });
    expect(agg.rows.map((r) => r.tool)).toEqual(['hot', 'cold']);
  });
});

describe('快照投影:只当出处,不当结论', () => {
  it('粗粒度投影永远产不出可排期行', () => {
    const p = recordsFromSnapshot({
      tools: [
        {
          tool: 'x',
          invalidRuns: 4,
          firstErrorField: 'f',
          byReason: { type_mismatch: 4 },
          validatorThrew: 0,
          undeterminedRequired: 0,
        },
      ],
    });
    expect(p.records).toHaveLength(1);
    const agg = aggregateArgRejections(p.records, { coarse: true });
    expect(agg.rows).toHaveLength(0);
    expect(agg.undetermined[0]).toMatch(/coarse/);
  });

  it('validatorThrew / undeterminedRequired 使该工具整体被剔证', () => {
    const p = recordsFromSnapshot({
      tools: [
        {
          tool: 'x',
          invalidRuns: 4,
          firstErrorField: 'f',
          byReason: { type_mismatch: 4 },
          validatorThrew: 1,
          undeterminedRequired: 0,
        },
      ],
    });
    expect(p.excludedTools).toEqual(['x']);
  });

  it('不是快照的输入 ⇒ malformed(而不是空记录冒充"没问题")', () => {
    expect(recordsFromSnapshot({}).malformed).toBe(true);
    expect(recordsFromSnapshot(null).malformed).toBe(true);
  });
});

describe('入口与装配', () => {
  it('台账路径优先级:--ledger > env > 仓库内默认', () => {
    expect(resolveLedgerPath('/explicit.jsonl', { [TOOL_ARG_LEDGER_ENV]: '/env.jsonl' }, '/repo')).toContain(
      'explicit.jsonl',
    );
    expect(resolveLedgerPath(null, { [TOOL_ARG_LEDGER_ENV]: '/env.jsonl' }, '/repo')).toContain('env.jsonl');
    // 默认档只断"落点在仓库根内 + 文件名",不锁分隔符形态(Windows 下 resolve 会换成反斜杠,
    // 按分隔符断言的用例会在换平台上假红 —— 那是判据过窄,不是仓库有问题)。
    const fallback = resolveLedgerPath(null, {}, '/repo');
    expect(fallback.startsWith(resolve('/repo'))).toBe(true);
    expect(fallback.endsWith('tool-arg-shadow.jsonl')).toBe(true);
    expect(fallback).toContain(DEFAULT_LEDGER_RELATIVE_PATH.split('/')[1]);
  });

  it('默认落点锚在仓库根,不靠 process.cwd(pnpm --filter 会把子进程 cwd 设成包目录)', () => {
    const root = repoRootOf(new URL('../src/tools/argument-validation-report.ts', import.meta.url).href);
    expect(existsSync(join(root, 'pnpm-workspace.yaml'))).toBe(true);
    const p = resolveLedgerPath(null, {}, root);
    expect(p.startsWith(root)).toBe(true);
    expect(p).not.toContain(join('apps', 'cli', '.ihui-agent'));
  });

  it('自带的 --self-test 必须全绿(它是"判据有牙"的最低门槛)', () => {
    expect(runSelfTest()).toBe(0);
  });

  it('报告含行目与结论,且不含任何原值', () => {
    const agg = aggregateArgRejections(
      Array.from({ length: 4 }, () => rec('demo_tool', 'mode', 'enum_mismatch', 'enum(count=2)', 'string')),
      {},
    );
    const text = formatArgRejectionReport(agg, 'unit');
    expect(text).not.toContain(NONCE);
    expect(text).toContain('demo_tool#mode');
    expect(text).toContain('verdict=description-suspect');
  });
});
