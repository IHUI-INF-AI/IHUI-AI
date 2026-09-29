// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { SYNTAX_TABLE } from './syntax-table.js';
import { isFileRedirectTarget, tokenizeCommand, type ArgToken, type TokenizedSegment } from './tokenizer.js';
import type { CommandAssessment, CommandEffect, CommandFinding, CommandSpec, OptionSpec, SubcommandSpec, SyntaxVerdict } from './types.js';

/**
 * 三态求值器 —— 默认态是 unknown,只有语法表明确登记的"命令 + 子命令 + 选项组合"才允许 read-only。
 *
 * 判据顺序(每一步都只往更保守的方向走):
 *   1. 分词产物里出现无法静态确定语义的构造(命令名是变量、命令替换、子 shell、heredoc、引号未闭合)
 *      → 该段直接判不出,只读资格清零(危险面仍照常继续判定,见 evaluateCommand)。
 *   2. basename 不在语法表 → unknown。
 *   3. 结构化的命令族(git/docker/kubectl/cargo/npm/pnpm/gh)按子命令取基线效果;
 *      子命令未登记 → unknown(而不是"当作只读")。
 *   4. 逐个解析选项(短选项簇 / `--opt=value` / `--` 终止符),未登记的选项 → 判不出。
 *   5. 效果集合 ⊄ {read} → mutating;效果 ⊆ {read} 且第 1/4 步无命中 → read-only;否则 unknown。
 *
 * 复合命令(`a && b`、`a | b`)按段求值后取**最劣**结论;两段都只读也只给 mutating ——
 * 段间可能互相引用(管道下游消费上游输出、后者改写前者产物),"每段各自可接受"不等于整体可免确认。
 */

const UNKNOWN_ISSUES = new Set([
  'command-substitution',
  'process-substitution',
  'variable-command',
  'subshell',
  'brace-group',
  'heredoc',
  'unterminated-quote',
  'unterminated-substitution',
  'dollar-quote',
]);

const READ_ONLY: CommandEffect = 'read';

/** 与旧实现同义的可执行文件名归一:去路径、去 Windows 后缀、转小写。 */
export function normalizeProgram(raw: string): string {
  const unquoted = raw.replace(/^(['"])([\s\S]*)\1$/, '$2');
  const base = unquoted.split(/[/\\]/).pop() ?? unquoted;
  return base.replace(/\.(exe|cmd|bat|com)$/i, '').toLowerCase();
}

function indexOptions(specs: readonly OptionSpec[]): Map<string, OptionSpec> {
  const map = new Map<string, OptionSpec>();
  for (const s of specs) map.set(s.name, s);
  return map;
}

function readGuardSatisfied(sub: SubcommandSpec, options: Set<string>, operands: readonly ArgToken[]): boolean {
  const guards = sub.readGuardOptions;
  if (!guards || guards.length === 0) return true;
  const operandNames = operands.map((t) => t.value.toLowerCase());
  return guards.some((g) => options.has(g) || operandNames.includes(g.toLowerCase()));
}

interface RawSegmentVerdict {
  effects: Set<CommandEffect>;
  dangerous: boolean;
  destructive: boolean;
  alwaysConfirm: boolean;
  unknownReasons: string[];
  readBlocked: boolean;
  rule?: string;
  reason: string;
  basename: string;
  subcommand?: string;
}

/** 文件系统根级别的删除/递归目标:这些位置的递归操作不可恢复,任何档位下都必须确认。 */
function isRootLevelTarget(raw: string): boolean {
  const value = raw.replace(/^(['"])([\s\S]*)\1$/, '$2').replace(/["']/g, '');
  if (!value) return false;
  return (
    value === '/' || value === '/*' || value === '\\' || value === '\\*' || value === '~' || value === '$HOME' || value === '*' ||
    /^[A-Za-z]:[\\/]?$/.test(value) ||
    /^\/(?:bin|boot|dev|etc|lib|lib64|opt|proc|root|sbin|srv|sys|usr|var)$/.test(value)
  );
}

/** 少量"结论取决于操作数内容"的守卫,数据表里表达不了的部分集中在这里。 */
function applyOperandGuards(spec: CommandSpec, operands: readonly ArgToken[], out: RawSegmentVerdict): void {
  for (const guard of spec.operandGuards ?? []) {
    for (const token of operands) {
      const value = token.value;
      if (guard.kind === 'permission-mode') {
        // 八进制位模式(777/755/0644)或含 `+s`(setuid/setgid)才危险;`+x` 不算
        if (token.expanded) {
          out.dangerous = true;
          out.rule ??= `${out.basename} <模式参数含变量,值不可静态确定>`;
          out.readBlocked = true;
          continue;
        }
        if (/^[0-7]{3,4}$/.test(value) || /\+\s*s/.test(value) || /[ugoa]*\+s/.test(value)) {
          out.dangerous = true;
          out.effects.add('system');
          out.rule ??= `${out.basename} ${value}`;
        }
      } else if (guard.kind === 'write-to-device') {
        if (/^of=\/dev\//i.test(value) || (token.expanded && /^of=/i.test(value))) {
          out.dangerous = true;
          out.alwaysConfirm = true;
          out.effects.add('destructive');
          out.rule ??= 'dd of=/dev/…';
        }
      } else if (guard.kind === 'root-target') {
        if (isRootLevelTarget(value)) {
          out.alwaysConfirm = true;
          out.effects.add('destructive');
          out.readBlocked = true;
          out.rule ??= `${out.basename} 目标是文件系统根`;
        }
      }
    }
  }
}

function evaluateSegment(segment: TokenizedSegment, blocked: boolean): RawSegmentVerdict {
  const argv = segment.argv;
  const rawCommand = argv[0]?.value ?? '';
  const basename = normalizeProgram(rawCommand);
  const out: RawSegmentVerdict = {
    effects: new Set<CommandEffect>(),
    dangerous: false,
    destructive: false,
    alwaysConfirm: false,
    unknownReasons: [],
    readBlocked: false,
    reason: '',
    basename,
  };

  if (blocked) out.unknownReasons.push('无法静态确定语义的 shell 构造');
  if (argv.length === 0) {
    out.unknownReasons.push('空命令');
    out.reason = 'empty-command';
    return out;
  }
  if (argv[0]!.expanded) out.unknownReasons.push('命令名来自变量展开或命令替换');
  if (!basename) {
    out.unknownReasons.push('命令名为空');
    return out;
  }

  const spec = SYNTAX_TABLE[basename];
  if (!spec) {
    out.unknownReasons.push(`未登记命令 ${basename}`);
    out.reason = 'unregistered-command';
    return out;
  }

  // ---- 词法切分:选项 / 操作数 / `--` 终止符 ----
  const optionNames = new Set<string>();
  const unknownOptions: string[] = [];
  const operands: ArgToken[] = [];

  const specOptions = indexOptions([...(spec.globalOptions ?? []), ...(spec.options ?? [])]);
  let subSpec: SubcommandSpec | undefined;
  let subOptions: Map<string, OptionSpec> = specOptions;
  let seenDoubleDash = false;
  /** 子命令只认"第一个操作数";选项的取值不得被当成子命令 */
  let awaitingSubcommand = spec.structured === true;

  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i]!;
    const value = token.value;
    if (token.expanded) out.unknownReasons.push('操作数含变量展开或命令替换');

    if (seenDoubleDash) {
      operands.push(token);
      continue;
    }
    if (value === '--') {
      seenDoubleDash = true;
      continue;
    }

    const isLong = value.startsWith('--') && value.length > 2;
    const isShort = value.startsWith('-') && !isLong && value.length > 1 && value !== '-';

    if (!isLong && !isShort) {
      operands.push(token);
      if (awaitingSubcommand) {
        subSpec = spec.subcommands?.[value.toLowerCase()];
        out.subcommand = value.toLowerCase();
        if (!subSpec) {
          out.unknownReasons.push(`未登记子命令 ${value}`);
        } else {
          subOptions = indexOptions([...(spec.globalOptions ?? []), ...(spec.options ?? []), ...(subSpec.options ?? [])]);
        }
        awaitingSubcommand = false;
      }
      continue;
    }

    // 短选项大小写敏感(`-d` 只删已合并分支、`-D` 强删),长选项大小写不敏感
    const cluster = isShort ? value.slice(1) : '';
    const names = isLong
      ? [value.slice(2).split('=')[0]!.toLowerCase()]
      : cluster.length > 1 && subOptions.has(cluster)
        ? [cluster]
        : [...cluster];
    for (let n = 0; n < names.length; n += 1) {
      const name = names[n]!;
      const option = subOptions.get(name);
      if (!option) {
        unknownOptions.push(isLong ? `--${name}` : `-${name}`);
        // 长选项无法解析时其 "=value" 也一并作废;短选项簇继续解析其余字符
        if (isLong) break;
        continue;
      }
      optionNames.add(option.name.toLowerCase());
      for (const effect of option.effects ?? []) out.effects.add(effect);
      if (option.breaksReadonly) out.readBlocked = true;
      if (option.danger) {
        out.dangerous = true;
        out.rule ??= option.rule ?? `${basename} ${value}`;
      }
      if (option.alwaysConfirm) out.alwaysConfirm = true;
      if (option.arity === 'required') {
        const hasInlineValue = isLong
          ? value.length > name.length + 2 && value[name.length + 2] === '='
          : value.length > n + 2; // `-n10`:`-` + 1 字符之后还有字符
        if (!hasInlineValue) i += 1; // 值落在下一个 token 上
      }
      if (!isLong && option.arity !== 'none') break; // 短选项带值时簇在此终止,余下字符是值不是选项
    }
  }

  if (unknownOptions.length > 0) {
    out.readBlocked = true;
    out.unknownReasons.push(`未登记选项 ${unknownOptions.join(' ')}`);
  }

  // ---- 基线效果 ----
  if (spec.structured && !subSpec) {
    if (!out.subcommand) out.unknownReasons.push('缺少子命令');
  }
  const guardSatisfied = subSpec ? readGuardSatisfied(subSpec, optionNames, operands) : true;
  // 带"读取形态守卫"的子命令(config/stash/build/test/rollout…):守卫满足即按只读起算,
  // 否则按写语义起算。旧实现用两词白名单表达同一件事(`config --get`、`build --dry-run`)。
  const guardGrantsRead = Boolean(subSpec?.readGuardOptions?.length && guardSatisfied);
  // 结构化命令族里"未登记的子命令"不给任何基线效果:它到底做什么我们确实不知道 → unknown
  const unresolvedSubcommand = spec.structured === true && !subSpec;
  const baseEffects: readonly CommandEffect[] = unresolvedSubcommand
    ? []
    : guardGrantsRead
      ? ['read']
      : (subSpec?.effects ?? (spec.effect === 'requires-subcommand' ? (['write'] as readonly CommandEffect[]) : [spec.effect]));
  for (const effect of baseEffects) out.effects.add(effect);
  if (subSpec?.danger) {
    out.dangerous = true;
    out.rule ??= `${basename} ${out.subcommand ?? ''}`.trim();
  }
  if (spec.danger) {
    out.dangerous = true;
    out.rule ??= spec.rule ?? basename;
  }
  if (subSpec?.alwaysConfirm || spec.alwaysConfirm) out.alwaysConfirm = true;

  if (subSpec?.readGuardOptions?.length && !guardSatisfied) {
    out.readBlocked = true;
    out.unknownReasons.push(`需要读取形态之一: ${subSpec.readGuardOptions.join('/')}`);
  }
  if (subSpec?.mutatingOperands?.some((m) => operands.some((o) => o.value.toLowerCase() === m.toLowerCase()))) {
    out.readBlocked = true;
    out.effects.add('write');
  }
  if (spec.opaqueOperands && operands.length > 0) out.unknownReasons.push('脚本体操作数无法静态分析');
  if (spec.operandsBreakReadonly && operands.length > 0) {
    out.readBlocked = true;
    out.effects.add('write');
  }
  if (spec.outputOperandIndex !== undefined && operands.length > spec.outputOperandIndex) {
    out.readBlocked = true;
    out.effects.add('write');
  }

  applyOperandGuards(spec, operands, out);

  // ---- 重定向:`>` 到文件即写副作用 ----
  for (const target of segment.writesTo) {
    if (isFileRedirectTarget(target.value)) {
      out.effects.add('write');
      out.readBlocked = true;
      out.rule ??= `重定向写入 ${target.value}`;
    }
  }
  out.destructive = out.effects.has('destructive');
  out.reason = out.dangerous ? (out.rule ?? 'danger') : out.unknownReasons[0] ?? '';
  return out;
}

function toFinding(v: RawSegmentVerdict): CommandFinding {
  const effects = [...v.effects];
  const hasMutation = effects.some((e) => e !== READ_ONLY);
  let verdict: SyntaxVerdict;
  if (hasMutation) verdict = 'mutating';
  else if (v.readBlocked || v.unknownReasons.length > 0 || v.effects.size === 0) verdict = 'unknown';
  else verdict = 'read-only';
  return {
    verdict,
    effects,
    dangerous: v.dangerous,
    destructive: v.destructive,
    alwaysConfirm: v.alwaysConfirm,
    reason: v.reason || verdict,
    rule: v.rule,
    basename: v.basename,
    subcommand: v.subcommand,
  };
}

const VERDICT_SEVERITY: Record<SyntaxVerdict, number> = { 'read-only': 0, mutating: 1, unknown: 2 };

/**
 * argv 入口 —— 调用方已经拿到参数数组时直接用(不经分词,无 shell 构造问题)。
 */
export function evaluateArgv(argv: readonly string[]): CommandFinding {
  return toFinding(evaluateSegment({ argv: argv.map((value): ArgToken => ({ value, expanded: false })), writesTo: [], readsFrom: [] }, false));
}

function assess(input: string, depth: number): CommandAssessment {
  const { segments, issues, substitutions } = tokenizeCommand(input);
  const blocked = issues.some((issue) => UNKNOWN_ISSUES.has(issue.kind));

  if (segments.length === 0) {
    return { ...toFinding({ effects: new Set(), dangerous: false, destructive: false, alwaysConfirm: false, unknownReasons: ['空命令'], readBlocked: true, reason: '', basename: '' }), segments: [] };
  }

  const findings = segments.map((segment) => toFinding(evaluateSegment(segment, blocked)));

  let dangerous = findings.some((f) => f.dangerous);
  let alwaysConfirm = findings.some((f) => f.alwaysConfirm);
  const effects = new Set<CommandEffect>();
  for (const f of findings) {
    for (const e of f.effects) effects.add(e);
  }

  // 命令替换里的内容照样求值,但只用于危险面:它的结果会喂给外层命令,
  // 因此绝不允许把外层结论推向 read-only。
  let substitutionDanger = false;
  if (depth < 3) {
    for (const inner of substitutions) {
      if (!inner.trim()) continue;
      const nested = assess(inner, depth + 1);
      dangerous ||= nested.dangerous;
      alwaysConfirm ||= nested.alwaysConfirm;
      if (nested.dangerous || nested.destructive) substitutionDanger = true;
      for (const e of nested.effects) if (e !== READ_ONLY) effects.add(e);
    }
  }

  const worst = findings.reduce<SyntaxVerdict>((acc, f) => (VERDICT_SEVERITY[f.verdict] > VERDICT_SEVERITY[acc] ? f.verdict : acc), 'read-only');
  let verdict = worst;
  let reason = blocked ? '存在无法静态确定语义的构造' : (findings.find((f) => f.verdict === worst)?.reason ?? worst);
  if (substitutionDanger && verdict === 'read-only') verdict = 'unknown';
  if (segments.length > 1 && verdict === 'read-only') {
    // 复合命令即使每段都只读也不免确认(见文件头判据说明)
    verdict = 'mutating';
    reason = 'compound-not-auto-approvable';
  }
  if (blocked) verdict = 'unknown';

  return {
    verdict,
    effects: [...effects],
    dangerous,
    destructive: effects.has('destructive'),
    alwaysConfirm,
    reason,
    segments: findings,
    basename: findings[0]?.basename,
    rule: findings.find((f) => f.rule)?.rule,
  };
}

/** 字符串入口:分词 + 逐段求值 + 聚合。 */
export function evaluateCommand(input: string): CommandAssessment {
  return assess(input ?? '', 0);
}

/** 该命令是否属于"永远需要确认"的破坏性子集(逃生舱也不应静默放行)。 */
export function isAlwaysConfirmCommand(input: string): boolean {
  return evaluateCommand(input).alwaysConfirm;
}

/**
 * 免确认判定:`yolo` 为真时,除"永远需要确认"子集外一律放行。
 * 旧调用方只有 `isReadonlyCommand` 一个口子,无法表达"逃生舱仍保留底线"这一档,
 * 故单独导出该函数供调用方后续接入(不改变现有调用方行为)。
 */
export function isAutoApprovableCommand(input: string, options: { yolo?: boolean } = {}): boolean {
  const assessment = evaluateCommand(input);
  if (assessment.alwaysConfirm) return false;
  if (options.yolo) return true;
  return assessment.verdict === 'read-only';
}

// ==================== 权限规则稳定前缀建议(G-937955)====================

/**
 * 从命令提炼"下次别再问"的建议规则,并给出规则命中判定(机制对齐 ZCode 的
 * bash-command-permission-policy / bash-command-rule-evaluator):
 *   - 静态可解析、非危险、登记在语法表的命令 → 提炼**稳定动作前缀**,建议 `前缀:*`
 *     (`pnpm run lint` ⇒ `pnpm run lint:*`);保存后同前缀的新命令直接命中;
 *   - 危险/破坏性/判不出语义的命令(rm -rf、heredoc、变量命令名、复合命令)→ 退回
 *     **整命令精确**规则,绝不带 :* —— 精确规则只放行逐字相同的命令;
 *   - 命中判定吃 **raw subject + 稳定前缀双 subject**:`pnpm -C dir run lint` 的 raw
 *     不以 `pnpm run lint` 开头,但同一 resolver 得出的稳定前缀是 —— 双轨使
 *     "UI 明明保存了建议规则,下一轮却命不中"那一类事故在机制上不可能发生。
 */

const RUN_SCRIPT_PROGRAMS = new Set(['npm', 'pnpm', 'yarn', 'bun']);
const RUN_SCRIPT_ACTIONS = new Set(['run', 'run-script']);

export interface CommandRuleSuggestion {
  /** 'prefix' = `前缀:*`(同前缀新命令命中);'exact' = 整命令精确规则 */
  kind: 'prefix' | 'exact';
  /** 规则正文:prefix 形如 `pnpm run lint:*`;exact 为 trim 后的整命令 */
  rule: string;
}

/** 稳定动作 token:非选项、非变量展开、无空白、不是路径/URL。 */
function isStableActionToken(token: ArgToken): boolean {
  return (
    !token.expanded &&
    token.value.length > 0 &&
    !token.value.startsWith('-') &&
    !/\s/.test(token.value) &&
    !looksLikePathOrUrl(token.value)
  );
}

function looksLikePathOrUrl(token: string): boolean {
  return (
    token.includes('://') ||
    token.startsWith('./') ||
    token.startsWith('../') ||
    token.startsWith('/') ||
    token.startsWith('~') ||
    /^[A-Za-z]:[\\/]/.test(token)
  );
}

/** 单段命令的 argv(复合命令 / 含判不出语义的构造 ⇒ undefined)。 */
function singleSegmentArgv(command: string): readonly ArgToken[] | undefined {
  const { segments, issues } = tokenizeCommand(command);
  if (segments.length !== 1) return undefined;
  if (issues.some((issue) => issue.kind !== 'empty-command')) return undefined;
  const segment = segments[0]!;
  if (segment.writesTo.length > 0) return undefined; // 重定向 = 写副作用,前缀不担保
  return segment.argv;
}

/**
 * 稳定前缀解析(resolveStableCommandPrefix 语义的本地化):能被登记语法表 + 登记子命令
 * 静态担保的最长动作前缀。`pnpm run lint --fix` ⇒ `pnpm run lint`、`git status` ⇒
 * `git status`、`pnpm -C dir run lint` ⇒ `pnpm run lint`(登记的全局选项连值一起跳过)。
 * 判不出/不可担保(未登记命令、未登记子命令、危险面、变量展开、复合、重定向、`--`)⇒ null。
 */
export function resolveStableCommandPrefix(command: string): string | null {
  const input = (command ?? '').trim();
  if (!input) return null;
  const argv = singleSegmentArgv(input);
  if (!argv || argv.length === 0) return null;
  if (argv.some((t) => t.expanded)) return null; // 有变量展开 = 动态语义,不担保
  const basename = normalizeProgram(argv[0]!.value);
  if (!basename) return null;
  const spec = SYNTAX_TABLE[basename];
  if (!spec) return null;
  // 危险面一票否决:dangerous / destructive / alwaysConfirm 命中的命令绝不给前缀
  // (rm -rf 绝不能建议出 `rm:*`),退回整命令精确规则。
  const verdict = evaluateSegment({ argv: [...argv], writesTo: [], readsFrom: [] }, false);
  if (verdict.dangerous || verdict.destructive || verdict.alwaysConfirm) return null;
  if (!spec.structured) return null; // 非结构化命令没有可担保的"动作"位
  // 走过登记选项(含取值),第一个操作数 = 子命令
  const knownOptions = indexOptions([...(spec.globalOptions ?? []), ...(spec.options ?? [])]);
  let index = 1;
  while (index < argv.length) {
    const token = argv[index]!;
    const value = token.value;
    if (value === '--') return null; // 终止符之后按字面量,前缀语义不可靠
    if (!value.startsWith('-') || value.length <= 1) break;
    const name = (value.startsWith('--') ? value.slice(2) : value.slice(1)).split('=')[0]!.toLowerCase();
    const option = knownOptions.get(name);
    if (!option) return null; // 未登记选项 ⇒ 语义判不出
    if (option.arity === 'required' && !value.includes('=')) index += 2;
    else index += 1;
  }
  const subToken = argv[index];
  if (!subToken || subToken.expanded) return null;
  const subName = subToken.value.toLowerCase();
  if (!spec.subcommands?.[subName]) return null; // 未登记子命令 ⇒ unknown ⇒ 不担保
  const prefix = [basename, subName];
  // run 脚本族:动作 = 紧随 run 的脚本名(`pnpm run lint` ⇒ `pnpm run lint`)
  if (RUN_SCRIPT_PROGRAMS.has(basename) && RUN_SCRIPT_ACTIONS.has(subName)) {
    const script = argv[index + 1];
    if (script && isStableActionToken(script)) prefix.push(script.value);
  }
  if (prefix.some((part) => part.length === 0)) return null;
  return prefix.join(' ');
}

/**
 * 建议规则生成:`pnpm run lint` ⇒ `pnpm run lint:*`;`rm -rf x` ⇒ 精确规则 `rm -rf x`。
 * 空命令 ⇒ null(没有值得建议的东西)。
 */
export function suggestCommandPermissionRule(command: string): CommandRuleSuggestion | null {
  const raw = (command ?? '').trim();
  if (!raw) return null;
  const prefix = resolveStableCommandPrefix(raw);
  if (prefix) return { kind: 'prefix', rule: `${prefix}:*` };
  return { kind: 'exact', rule: raw };
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * 规则命中判定(评估器对 `prefix:*` 的支持):规则 `前缀:*` 对 raw subject 与稳定前缀
 * 双 subject 求命中(等于前缀,或以前缀+空格开头 —— `pnpm run linter` **不**命中
 * `pnpm run lint:*`);非 `:*` 规则按精确匹配(空白归一后逐字相等)。其余通配形态
 * 不在担保范围,一律不命中(fail-closed)。
 */
export function commandMatchesPermissionRule(command: string, rule: string): boolean {
  const subject = collapseWhitespace(command ?? '');
  const pattern = collapseWhitespace(rule ?? '');
  if (!subject || !pattern) return false;
  if (pattern.endsWith(':*')) {
    const prefix = pattern.slice(0, -2);
    if (!prefix) return false;
    if (subject === prefix || subject.startsWith(`${prefix} `)) return true;
    const stable = resolveStableCommandPrefix(command);
    return stable !== null && (stable === prefix || stable.startsWith(`${prefix} `));
  }
  if (pattern.includes('*')) return false; // 只登记 :* 前缀与精确两种,其余通配不担保
  return subject === pattern;
}

export type { CommandAssessment, CommandEffect, CommandFinding, CommandSpec, OptionSpec, SubcommandSpec, SyntaxVerdict };
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
