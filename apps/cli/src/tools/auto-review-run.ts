// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 自动复审的**真实执行腿** —— 把诊断工具的输出接进 judgeReview。
 *
 * ## 为什么单独一个文件
 *
 * `auto-review.ts` 是纯判据(零 IO,可单测穷尽);本文件做 IO(起 tsc/eslint)。
 * 分开的理由:判据要能被穷尽测试,而 IO 部分慢且环境依赖。
 *
 * ## 复用而不是重写
 *
 * 诊断逻辑只有一份:`tools/diagnostics.ts` 的 `get_diagnostics`。
 * 本文件只做**适配**:把它的输出解析成 `DiagnosticIssue[]`,再交给 `judgeReview`。
 * 若另写一份 tsc 调用,两边规则必然漂移。
 *
 * ## 关键设计:基线快照
 *
 * 「只报新增」需要基线。基线从哪来?两种:
 *   · 显式传入(调用方在改动前先跑一次,存下来);
 *   · 落盘缓存(跨回合复用,避免每次都全量跑)。
 *
 * 本文件提供落盘缓存:基线存在 `.ihui/auto-review-baseline.json`,
 * 首次跑时若是空基线,则**本次结果全部记为存量**(不误报)。
 */
import fs from 'node:fs';
import path from 'node:path';

import { judgeReview, issueKey, type DiagnosticIssue, type ReviewVerdict } from './auto-review.js';

/** 诊断原始条目(与 tools/diagnostics.ts 的 Diagnostic 同形)。 */
export interface RawDiagnostic {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly ruleId?: string;
}

/**
 * 把诊断条目转成带稳定 key 的 issue。
 *
 * key 的口径:**文件 + 规则 + 消息的前 60 字**。
 * 不含行号 —— 否则行号漂移会把老问题误判成新增(这正是要避免的)。
 * 含消息而不只含规则:同一条规则在同一文件可能命中多处不同问题。
 */
export function toIssues(diags: readonly RawDiagnostic[], workspaceRoot: string): DiagnosticIssue[] {
  return diags.map((d) => {
    const rel = path.relative(workspaceRoot, d.file).replace(/\\/g, '/');
    const symbol = d.message.slice(0, 60);
    return {
      file: rel,
      key: issueKey(rel, d.ruleId ?? d.severity, symbol),
      message: d.message,
      severity: d.severity,
    };
  });
}

/** 基线文件的默认落点。 */
export function baselinePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.ihui', 'auto-review-baseline.json');
}

interface BaselineFile {
  readonly version: 1;
  readonly savedAt: number;
  readonly issues: readonly DiagnosticIssue[];
}

/** 读基线。不存在或损坏 ⇒ null(调用方按"无基线"处理,不静默当成空基线)。 */
export function loadBaseline(workspaceRoot: string): DiagnosticIssue[] | null {
  const p = baselinePath(workspaceRoot);
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw) as BaselineFile;
    if (parsed.version !== 1 || !Array.isArray(parsed.issues)) return null;
    return parsed.issues;
  } catch {
    return null;
  }
}

/** 存基线(原子写:先临时文件再 rename)。 */
export function saveBaseline(workspaceRoot: string, issues: readonly DiagnosticIssue[]): void {
  const p = baselinePath(workspaceRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
  const payload: BaselineFile = { version: 1, savedAt: Date.now(), issues };
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmp, p);
}

export interface ReviewAgainstBaselineResult {
  readonly verdict: ReviewVerdict;
  /** 基线是否存在。首次跑时 false —— 此时所有问题都算存量。 */
  readonly hadBaseline: boolean;
  /** 本次诊断总数(便于判断"到底有没有跑成功")。 */
  readonly total: number;
}

/**
 * 拿本次诊断和基线对比。
 *
 * **首次无基线时**:把本次结果全部视为存量(不误报为新增),
 * 并建议调用方保存基线。这是"第一次跑不该报红"的正确行为 ——
 * 否则任何人第一次开启 auto-review 都会看到满屏"新增问题"。
 */
export function reviewAgainstBaseline(
  workspaceRoot: string,
  diags: readonly RawDiagnostic[],
  options: { readonly saveBaselineAfter?: boolean } = {},
): ReviewAgainstBaselineResult {
  const current = toIssues(diags, workspaceRoot);
  const baseline = loadBaseline(workspaceRoot);

  if (baseline === null) {
    // 无基线:全部算存量
    if (options.saveBaselineAfter !== false) saveBaseline(workspaceRoot, current);
    return {
      verdict: {
        regressed: false,
        introduced: [],
        preexistingCount: current.length,
        resolvedCount: 0,
      },
      hadBaseline: false,
      total: current.length,
    };
  }

  const verdict = judgeReview(baseline, current);
  if (options.saveBaselineAfter === true) saveBaseline(workspaceRoot, current);
  return { verdict, hadBaseline: true, total: current.length };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
