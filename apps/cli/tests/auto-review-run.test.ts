// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 自动复审的真实执行腿(auto-review-run)。
 *
 * 钉四件事:
 *   ① 首次无基线时**全部算存量**,不误报"新增"(否则第一次开启就满屏红的);
 *   ② 有基线后只报新增;
 *   ③ key 不含行号 —— 否则行号漂移会把老问题误判成新增;
 *   ④ 基线损坏 ⇒ 按"无基线"处理,不静默当成空基线。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  baselinePath,
  loadBaseline,
  reviewAgainstBaseline,
  saveBaseline,
  toIssues,
  type RawDiagnostic,
} from '../src/tools/auto-review-run.js';

let dir = '';

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-review-run-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const diag = (file: string, line: number, msg: string, rule = 'no-any'): RawDiagnostic => ({
  file: path.join(dir, file),
  line,
  column: 1,
  severity: 'error',
  message: msg,
  ruleId: rule,
});

describe('toIssues', () => {
  it('文件路径转相对、反斜杠归一', () => {
    const [i] = toIssues([diag('a/b.ts', 1, 'x')], dir);
    expect(i!.file).toBe('a/b.ts');
    expect(i!.file).not.toContain('\\');
  });

  it('key 不含行号(行号漂移不算新问题)', () => {
    const k1 = toIssues([diag('a.ts', 10, 'same message')], dir)[0]!.key;
    const k2 = toIssues([diag('a.ts', 99, 'same message')], dir)[0]!.key;
    expect(k1).toBe(k2);
  });

  it('不同消息产生不同 key(同规则同文件多处问题要能区分)', () => {
    const k1 = toIssues([diag('a.ts', 1, 'msg one')], dir)[0]!.key;
    const k2 = toIssues([diag('a.ts', 1, 'msg two')], dir)[0]!.key;
    expect(k1).not.toBe(k2);
  });
});

describe('reviewAgainstBaseline', () => {
  it('首次无基线 ⇒ 全部算存量,regressed=false', () => {
    const r = reviewAgainstBaseline(dir, [diag('a.ts', 1, 'e1'), diag('b.ts', 2, 'e2')]);
    expect(r.hadBaseline).toBe(false);
    expect(r.verdict.regressed).toBe(false);
    expect(r.verdict.introduced).toHaveLength(0);
    expect(r.verdict.preexistingCount).toBe(2);
    expect(r.total).toBe(2);
  });

  it('首次跑会落盘基线(供下次比对)', () => {
    reviewAgainstBaseline(dir, [diag('a.ts', 1, 'e1')]);
    expect(fs.existsSync(baselinePath(dir))).toBe(true);
    expect(loadBaseline(dir)).toHaveLength(1);
  });

  it('有基线后只报新增', () => {
    saveBaseline(dir, toIssues([diag('a.ts', 1, 'old')], dir));
    const r = reviewAgainstBaseline(dir, [diag('a.ts', 1, 'old'), diag('b.ts', 5, 'new')]);
    expect(r.hadBaseline).toBe(true);
    expect(r.verdict.introduced).toHaveLength(1);
    expect(r.verdict.introduced[0]!.file).toBe('b.ts');
    expect(r.verdict.regressed).toBe(true);
    expect(r.verdict.preexistingCount).toBe(1);
  });

  it('行号漂移 + 有基线 ⇒ 不算新增', () => {
    saveBaseline(dir, toIssues([diag('a.ts', 10, 'same')], dir));
    const r = reviewAgainstBaseline(dir, [diag('a.ts', 77, 'same')]);
    expect(r.verdict.introduced).toHaveLength(0);
    expect(r.verdict.regressed).toBe(false);
  });

  it('问题消失 ⇒ resolvedCount 增加', () => {
    saveBaseline(dir, toIssues([diag('a.ts', 1, 'x'), diag('b.ts', 2, 'y')], dir));
    const r = reviewAgainstBaseline(dir, [diag('a.ts', 1, 'x')]);
    expect(r.verdict.resolvedCount).toBe(1);
  });

  it('基线损坏 ⇒ 按无基线处理(不静默当空基线)', () => {
    fs.mkdirSync(path.dirname(baselinePath(dir)), { recursive: true });
    fs.writeFileSync(baselinePath(dir), '{not json', 'utf8');
    expect(loadBaseline(dir)).toBeNull();
    const r = reviewAgainstBaseline(dir, [diag('a.ts', 1, 'x')]);
    expect(r.hadBaseline).toBe(false); // 不误报新增
    expect(r.verdict.regressed).toBe(false);
  });

  it('saveBaselineAfter=true 时用本次结果覆盖基线', () => {
    saveBaseline(dir, toIssues([diag('a.ts', 1, 'old')], dir));
    reviewAgainstBaseline(dir, [diag('a.ts', 1, 'old'), diag('b.ts', 2, 'new')], {
      saveBaselineAfter: true,
    });
    expect(loadBaseline(dir)).toHaveLength(2); // 基线已更新为 2 条
  });

  it('空诊断 ⇒ 无新增无存量', () => {
    const r = reviewAgainstBaseline(dir, []);
    expect(r.total).toBe(0);
    expect(r.verdict.preexistingCount).toBe(0);
    expect(r.verdict.regressed).toBe(false);
  });
});

describe('基线文件', () => {
  it('原子写不留临时文件', () => {
    saveBaseline(dir, toIssues([diag('a.ts', 1, 'x')], dir));
    const files = fs.readdirSync(path.join(dir, '.ihui'));
    expect(files.filter((f) => f.includes('.tmp-'))).toHaveLength(0);
  });

  it('loadBaseline 对不存在返回 null', () => {
    expect(loadBaseline(dir)).toBeNull();
  });
});
