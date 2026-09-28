// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 工具入参校验的「台账 → 可排期清单」聚合出口(G-240 第②步的尺子,2026-09-27 立)。
 *
 * 它补的是哪一格(不是"再写一份校验"):
 *   `argument-validation-telemetry.ts` 的影子/enforce 计数**只进进程内快照** ——
 *   `snapshotToolArgShadow()` 随进程死,而且按工具粒度只留 `byReason` 与 `firstErrorField`。
 *   于是"哪个工具的**哪条字段**常被拒"今天没有答案,第②步(用影子数据修描述)就无从排期。
 *   本模块把"一次拒判"降成一条只含**描述面信息 + 形态类别**的记录,按
 *   `{工具, 字段路径, 期望形态}` 聚合成 top-N,并对每行给一句"描述可能根本写错了"的线索。
 *
 * 三条不可动摇的口径:
 *   ① **不落任何入参原值**(沿用 telemetry 文件头既有隐私口径,不是新发明):
 *      `ValidationError.actual` 在 `enum_mismatch` 那一支装的是模型/用户自报的原值串,
 *      `expected` 那一支装整张枚举表。两者都不得进台账 —— 落 `observed`(形态类别)与
 *      `expected`(枚举表折成 `enum(count=N)`)。这不是洁癖:台账是要被复制进 issue/邮件的
 *      东西,而"把用户数据写进诊断出口"在本仓已被记成缺陷型(守门 67/115 同族)。
 *   ② **默认零副作用**:落盘只在显式设了 env `IHUI_TOOL_ARG_VALIDATION_LEDGER` 时发生;
 *      校验档位默认仍是 `off`(那行在 telemetry 里,本票一个字不动 —— 翻默认是第③步)。
 *   ③ **判不出的必须报名**:样本不足、路径解析不到、必填判定本身不成立
 *      (`undeterminedRequired`)、描述有毒(`validatorThrew`)的字段一律落 `undetermined`
 *      并逐条点名,绝不静默折进"看起来没问题"的行(本仓最高频失效型是"把没判写成判过了")。
 *
 * 用法:
 *   pnpm report:tool-arg-rejections                      # 读默认台账,聚合 top-N
 *   pnpm report:tool-arg-rejections --ledger <path>      # 指定 JSONL 台账
 *   pnpm report:tool-arg-rejections --snapshot <file>    # 读一份 dump 的进程内快照(粗粒度)
 *   pnpm report:tool-arg-rejections --json / --top N / --self-test
 * 退出码:0 报告已出(含"样本不足以排期"这一有效结论)/ 2 输入取不到 = 无法判定。
 *
 * 输出面一律 ASCII(含中文串会让守门 70 把本文件判成"新增硬编码中文",它不在基线里)。
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

import type { ValidationError, ValidationResult } from './argument-validator.js';
import type { ToolParameter, ToolSchema } from './index.js';

// ==================== 常量 ====================

/** 台账落点开关。**未设即一次都不写盘** —— 影子档跑在生产会话里,默认必须零副作用。 */
export const TOOL_ARG_LEDGER_ENV = 'IHUI_TOOL_ARG_VALIDATION_LEDGER';

/** 默认台账相对路径(仓库内,§15b);调用方没给 `--ledger` 也没设 env 时用它。 */
export const DEFAULT_LEDGER_RELATIVE_PATH = '.ihui-agent/tmp/tool-arg-shadow.jsonl';

/**
 * 一行候选要进"可排期"判定所需的最少样本数。取 3:少于 3 时"单一形态"可能只是
 * 同一次会话里的重复,不构成描述面证据。
 */
export const MIN_FIELD_SAMPLES_FOR_VERDICT = 3;

/**
 * 总样本少于此 ⇒ 整份报告**不足以排期**,必须明写,而不是给一张空 top-N 让人读成"没有债"。
 * 取 10:再少连"哪个工具最常被判"都排不出稳定次序(并列会淹掉信号)。
 */
export const MIN_SAMPLES_FOR_SCHEDULING = 10;

/** 单一形态占比判据:≥80% 视为"系统性不符"(所有人都在发同一个东西)。 */
const DOMINANT_SHARE_FOR_SUSPECT = 0.8;

// ==================== 记录形态 ====================

/** 错误类别与校验器同源(不另立第二套名字)。 */
export type ArgRejectionReason = ValidationError['reason'];

const REASONS: readonly ArgRejectionReason[] = [
  'missing_required',
  'type_mismatch',
  'enum_mismatch',
  'unknown_field',
  'array_item_type_mismatch',
  'object_missing_required',
];

function isArgRejectionReason(v: string): v is ArgRejectionReason {
  return (REASONS as readonly string[]).includes(v);
}

/** 一条拒判记录:只有描述面信息 + 形态类别,**没有任何入参值**。 */
export interface ArgRejectionRecord {
  /** 工具名(描述面) */
  tool: string;
  /** 字段路径,与校验器拼法同形(对象 `a.b`,数组元素 `a[0]`) */
  field: string;
  reason: ArgRejectionReason;
  /** 期望形态:类型名,或 `enum(count=N)` */
  expected: string;
  /** 实得形态类别(见 OBSERVED_SHAPES);路径解析不到 ⇒ `unresolved` */
  observed: string;
}

/**
 * `observed` 的闭集。列出来是为了让"清单腐烂"可被机器发现:出现集外的值就说明
 * 有分支把原值往这里塞(那正是本模块存在的理由所要防的事)。
 */
export const OBSERVED_SHAPES = [
  'undefined',
  'null',
  'boolean',
  'number',
  'NaN',
  'string',
  'array',
  'object',
  'function',
  'symbol',
  'bigint',
  'unresolved',
] as const;

export type ObservedShape = (typeof OBSERVED_SHAPES)[number];

const OBSERVED_SET: ReadonlySet<string> = new Set<string>(OBSERVED_SHAPES);

/** 值 → 形态类别:只看 typeof / Array.isArray / NaN,不返回内容,也不返回长度。 */
export function observedShapeOf(value: unknown): ObservedShape {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isNaN(value) ? 'NaN' : 'number';
  const t = typeof value;
  return OBSERVED_SET.has(t) ? (t as ObservedShape) : 'object';
}

/**
 * 声明 → 期望形态。`enum(a|b|c)` 折成 `enum(count=3)`:条数足以判断"枚举表是不是漏了一档",
 * 而表内容不进台账(沿用既有隐私口径 —— 表虽来自描述面,"值得赌"这件事不由聚合器决定)。
 */
export function expectedShapeOf(declared: string | undefined): string {
  if (declared === undefined || declared.trim() === '') return 'any';
  const text = declared.trim();
  if (text.startsWith('enum(') && text.endsWith(')')) {
    const inner = text.slice('enum('.length, -1);
    const count = inner.trim() === '' ? 0 : inner.split('|').length;
    return `enum(count=${count})`;
  }
  return text;
}

/** 取字段路径上的值(`a.b` / `a[0].b`)。解析不到 ⇒ `found:false`,不把"没有"读成 undefined。 */
function valueAtPath(root: unknown, path: string): { found: boolean; value: unknown } {
  let cursor: unknown = root;
  for (const seg of path.split('.')) {
    const m = /^([^[\]]+)\[(\d+)\]$/.exec(seg);
    const key = m?.[1] ?? seg;
    if (key === '' || cursor === null || typeof cursor !== 'object') {
      return { found: false, value: undefined };
    }
    if (m) {
      if (!Array.isArray(cursor)) return { found: false, value: undefined };
      const idx = Number(m?.[2] ?? -1);
      // 越界算"路径解析得到而值缺席"(与 missing_required 同视),不是解析失败。
      cursor = idx < cursor.length ? cursor[idx] : undefined;
      continue;
    }
    const bag = cursor as Record<string, unknown>;
    if (!(key in bag)) return { found: false, value: undefined };
    cursor = bag[key];
  }
  return { found: true, value: cursor };
}

/** 该字段在 schema 里的声明类型(给 `expected` 兜一个描述面真值,深层取不到即 undefined)。 */
function declaredTypeOf(schema: ToolSchema, field: string): string | undefined {
  const parts = field.replace(/\[\d+\]/g, '').split('.').filter((p) => p !== '');
  if (parts.length === 0) return undefined;
  const first = parts[0];
  let param: ToolParameter | undefined = first === undefined ? undefined : schema.parameters.properties[first];
  for (const seg of parts.slice(1)) {
    if (!param?.properties) return undefined;
    param = param.properties[seg];
  }
  return param?.type;
}

/**
 * 把一次判定降成记录数组 —— **唯一**的生成入口(不得在别处再抄一份拼装逻辑,两处算同一件事必漂移)。
 *
 * 通过样本不进台账:本台账回答的是"哪些描述在实战里被判错",通过数由 telemetry 的
 * `shadowRuns` / `enforce.runs` 兜着,两条账不串。
 */
export function recordsForValidation(
  schema: ToolSchema,
  args: unknown,
  result: ValidationResult,
): ArgRejectionRecord[] {
  if (result.valid || result.errors.length === 0) return [];
  return result.errors.map((err) => recordOne(schema, args, err));
}

function recordOne(schema: ToolSchema, args: unknown, err: ValidationError): ArgRejectionRecord {
  let observed: string;
  if (err.reason === 'enum_mismatch') {
    // 这一支的 err.actual 就是原值 ⇒ 一律不看它,从参数树取形态。
    const hit = valueAtPath(args, err.field);
    observed = hit.found ? observedShapeOf(hit.value) : 'unresolved';
  } else {
    // 其余分支的 actual 已是形态类(describeType / 'undefined');集外值再过一次形态函数。
    observed = OBSERVED_SET.has(err.actual) ? err.actual : observedShapeOf(err.actual);
  }
  const declared = err.expected !== '' ? err.expected : declaredTypeOf(schema, err.field);
  return {
    tool: schema.name,
    field: err.field,
    reason: err.reason,
    expected: expectedShapeOf(declared),
    observed,
  };
}

// ==================== 台账读写(默认不写)====================

/**
 * 影子/enforce 判定点调它:env 未设 ⇒ 一次都不碰文件系统。
 * 返回值供测试断言"默认零副作用"。**任何 IO 失败都不冒泡** —— 诊断出口不得把工具执行拖下水
 * (telemetry 影子档吞掉校验器异常是同一条理由)。
 */
export function appendArgRejectionLedger(
  schema: ToolSchema,
  args: unknown,
  result: ValidationResult,
  env: Record<string, string | undefined> = process.env,
): { appended: number; skippedReason: string | null } {
  const target = env[TOOL_ARG_LEDGER_ENV];
  if (target === undefined || target.trim() === '') {
    return { appended: 0, skippedReason: `${TOOL_ARG_LEDGER_ENV} not set` };
  }
  const records = recordsForValidation(schema, args, result);
  if (records.length === 0) return { appended: 0, skippedReason: 'no rejection to record' };
  try {
    // 相对路径一律锚在**仓库根**(与 `resolveLedgerPath` 同一条规则)。锚在 cwd 的话,
    // `pnpm --filter exec` 会把 cwd 设成包目录 ⇒ 写在 `apps/cli/.ihui-agent/…`,
    // 而报告按仓库根去找 ⇒ 表现为"记了却说没台账"(实测踩过一次,故由判据而非文档兜)。
    const file = resolve(repoRootOf(import.meta.url), target.trim());
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${records.map((r) => JSON.stringify(r)).join('\n')}\n`, 'utf-8');
    return { appended: records.length, skippedReason: null };
  } catch {
    return { appended: 0, skippedReason: 'io-failed (swallowed: diagnostics must not break execution)' };
  }
}

export interface LedgerRead {
  records: ArgRejectionRecord[];
  /** 解析不了 / 形态不对的行数 —— 必须打印,不得静默当成"没有记录" */
  malformedLines: number;
  /** 文件不存在 ⇒ true:那是"无法判定",不是"样本为 0"(两者处置动作不同) */
  missing: boolean;
  path: string;
  totalLines: number;
}

/** 读 JSONL 台账。坏行计入 malformedLines 并跳过(不猜内容)。 */
export function readArgLedger(path: string): LedgerRead {
  const base: LedgerRead = { records: [], malformedLines: 0, missing: false, path, totalLines: 0 };
  if (!existsSync(path)) return { ...base, missing: true };
  let text = '';
  try {
    text = readFileSync(path, 'utf-8');
  } catch {
    return { ...base, missing: true };
  }
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  const records: ArgRejectionRecord[] = [];
  let malformed = 0;
  for (const line of lines) {
    const parsed = parseRecordLine(line);
    if (parsed) records.push(parsed);
    else malformed += 1;
  }
  return { records, malformedLines: malformed, missing: false, path, totalLines: lines.length };
}

function parseRecordLine(line: string): ArgRejectionRecord | null {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
  const tool = str(o.tool);
  const field = str(o.field);
  const reason = str(o.reason);
  const expected = str(o.expected);
  const observed = str(o.observed);
  if (!tool || !field || !reason || !expected || !observed) return null;
  if (!isArgRejectionReason(reason)) return null;
  return { tool, field, reason, expected, observed };
}

// ==================== 聚合 ====================

/** 结论闭集:不存在"看起来没问题"的第四态 —— 判不了就是 undetermined 且必须报名。 */
export type ArgRejectionVerdict = 'description-suspect' | 'caller-error' | 'undetermined';

export interface ArgRejectionRow {
  tool: string;
  field: string;
  expected: string;
  /** 该 `{工具,字段}` 的拒判总数 */
  rejections: number;
  /** 实得形态类别计数 */
  observed: Record<string, number>;
  /** 错误类别计数 */
  reasons: Record<string, number>;
  dominantShape: string | null;
  dominantShare: number;
  verdict: ArgRejectionVerdict;
  /** 为什么给这个结论(一句线索,不得留空) */
  clue: string;
  /** 来自粗粒度快照投影 ⇒ 字段路径不可逐条核对 */
  coarse: boolean;
}

export interface AggregateResult {
  rows: ArgRejectionRow[];
  /** 未判定/被剔证的行逐条点名 */
  undetermined: string[];
  sampleCount: number;
  toolsSeen: number;
  /** 总样本不足以排期 ⇒ false,并在 schedulingNote 写清为什么 */
  schedulable: boolean;
  schedulingNote: string;
}

interface Bucket {
  tool: string;
  field: string;
  expected: Set<string>;
  rejections: number;
  observed: Record<string, number>;
  reasons: Record<string, number>;
  coarse: boolean;
}

/**
 * 按 `{工具, 字段路径, 期望形态}` 聚合出 top-N。
 *
 * `excludedTools` 来自 telemetry 的"这些工具的样本不作证据"(`undeterminedRequired > 0` ⇒
 * 必填判定本身不成立;`validatorThrew > 0` ⇒ 描述有毒)。传进来是为了让它们落 `undetermined`,
 * 而不是混进 top-N 冒充结论。
 */
export function aggregateArgRejections(
  records: readonly ArgRejectionRecord[],
  opts: { topN?: number; excludedTools?: Iterable<string>; coarse?: boolean } = {},
): AggregateResult {
  const topN = opts.topN ?? 10;
  const excluded = new Set<string>(opts.excludedTools ?? []);
  const buckets = new Map<string, Bucket>();

  for (const r of records) {
    // 主键含 expected(票面口径 {tool, field path, expected shape}):同一字段的两种期望必须分成两行,
    // 否则 dominant 占比会把「必填缺失」混进「枚举不符」里,而这两型的修法完全不同。
    const key = `${r.tool}\u0000${r.field}\u0000${r.expected}`;
    let b = buckets.get(key);
    if (!b) {
      b = {
        tool: r.tool,
        field: r.field,
        expected: new Set<string>([r.expected]),
        rejections: 0,
        observed: {},
        reasons: {},
        coarse: opts.coarse === true,
      };
      buckets.set(key, b);
    }
    b.expected.add(r.expected);
    b.rejections += 1;
    b.observed[r.observed] = (b.observed[r.observed] ?? 0) + 1;
    b.reasons[r.reason] = (b.reasons[r.reason] ?? 0) + 1;
  }

  const all = [...buckets.values()].map((b) => toRow(b, excluded));
  const undetermined: string[] = [];
  for (const row of all) {
    if (row.verdict === 'undetermined') undetermined.push(`${row.tool}#${row.field}: ${row.clue}`);
  }
  const rows = all
    .filter((r) => r.verdict !== 'undetermined')
    .sort(
      (a, b) =>
        b.rejections - a.rejections ||
        a.tool.localeCompare(b.tool) ||
        a.field.localeCompare(b.field),
    )
    .slice(0, topN);

  const sampleCount = records.length;
  const schedulable = sampleCount >= MIN_SAMPLES_FOR_SCHEDULING;
  return {
    rows,
    undetermined,
    sampleCount,
    toolsSeen: new Set(records.map((r) => r.tool)).size,
    schedulable,
    schedulingNote: schedulable
      ? `${sampleCount} samples >= ${MIN_SAMPLES_FOR_SCHEDULING}: top-${rows.length} usable for scheduling (still verify per handler)`
      : `${sampleCount} samples < ${MIN_SAMPLES_FOR_SCHEDULING}: NOT schedulable - this means "evidence not yet accumulated", not "no debt"`,
  };
}

function toRow(b: Bucket, excluded: ReadonlySet<string>): ArgRejectionRow {
  const observed = { ...b.observed };
  const reasons = { ...b.reasons };
  const entries = Object.entries(observed).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
  const dominantShape = entries[0]?.[0] ?? null;
  const dominantCount = entries[0]?.[1] ?? 0;
  const dominantShare = b.rejections === 0 ? 0 : dominantCount / b.rejections;
  const expectedList = [...b.expected].sort();

  const base = {
    tool: b.tool,
    field: b.field,
    expected: expectedList[0] ?? 'any',
    rejections: b.rejections,
    observed,
    reasons,
    dominantShape,
    dominantShare,
    coarse: b.coarse,
  };

  if (excluded.has(b.tool)) {
    return {
      ...base,
      verdict: 'undetermined',
      clue: 'tool flagged as non-evidence by telemetry (missing required array, or validator threw) - never use to edit descriptions',
    };
  }
  if (b.coarse) {
    return {
      ...base,
      verdict: 'undetermined',
      clue: 'coarse projection of an in-process snapshot (byReason + firstErrorField only): field path not verifiable',
    };
  }
  if (dominantShape === null) {
    return { ...base, verdict: 'undetermined', clue: 'no observable shape recorded' };
  }
  if (dominantShape === 'unresolved') {
    return {
      ...base,
      verdict: 'undetermined',
      clue: `${pct(dominantShare)} of records have an unresolvable field path - the aggregator cannot see the shape, so it does not judge`,
    };
  }
  if (b.rejections < MIN_FIELD_SAMPLES_FOR_VERDICT) {
    return {
      ...base,
      verdict: 'undetermined',
      clue: `${b.rejections} samples < ${MIN_FIELD_SAMPLES_FOR_VERDICT}: a single shape may just be one session repeating itself`,
    };
  }
  if (dominantShare < DOMINANT_SHARE_FOR_SUSPECT) {
    const mix = entries
      .slice(0, 3)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');
    return {
      ...base,
      verdict: 'caller-error',
      clue: `mixed observed shapes (${mix}) - the description is probably right and individual callers filled wrong`,
    };
  }
  return { ...base, verdict: 'description-suspect', clue: suspectClue(b, dominantShape) };
}

/** 线索按错误类别分开写,因为三种"系统性单一形态"的修法根本不同。 */
function suspectClue(b: Bucket, dominantShape: string): string {
  const reason = Object.keys(b.reasons).sort(
    (x, y) => (b.reasons[y] ?? 0) - (b.reasons[x] ?? 0),
  )[0];
  if (reason === 'missing_required' || reason === 'object_missing_required') {
    return `all ${b.rejections} records say "never filled" (observed always ${dominantShape}) - either the required flag is wrong or the description gives the model nothing to fill from; CHECK WHETHER THE HANDLER READS THIS FIELD BEFORE EDITING EITHER SIDE`;
  }
  if (reason === 'enum_mismatch') {
    return `observed shape is single (${dominantShape}) while the enum table rejects it - the enum list is likely missing this value or diverges from what callers actually send; fix by editing the description, NOT by loosening validation`;
  }
  if (reason === 'unknown_field') {
    return `the same unknown field keeps appearing - model fills a name the description never declares (prompt face and description face diverged)`;
  }
  const declared = [...b.expected].sort()[0] ?? 'any';
  return `observed shape ${dominantShape} systematically mismatches declared ${declared} (${b.rejections} same-shape records) - the type annotation is likely too narrow or wrong`;
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

// ==================== 快照投影(粗粒度,如实标注)====================

/**
 * 把 `snapshotToolArgShadow()` 的 JSON 投影成记录。
 *
 * 粒度只有 `firstErrorField` + `byReason`,所以每工具最多一条、字段路径不可核对 ⇒
 * 打上 coarse,聚合里落 `undetermined`。为什么仍要这条通道:今天磁盘上没有台账,而快照是
 * 唯一已存在的数据形态;接进同一份判据是为了让"样本不足"这句话**有出处**,
 * 不是为了产出一张看起来能排期的表。
 */
export function recordsFromSnapshot(snapshot: unknown): {
  records: ArgRejectionRecord[];
  excludedTools: string[];
  malformed: boolean;
} {
  if (snapshot === null || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return { records: [], excludedTools: [], malformed: true };
  }
  const o = snapshot as Record<string, unknown>;
  const tools = Array.isArray(o.tools) ? o.tools : null;
  if (!tools) return { records: [], excludedTools: [], malformed: true };
  const records: ArgRejectionRecord[] = [];
  const excludedTools: string[] = [];
  for (const raw of tools) {
    if (raw === null || typeof raw !== 'object') continue;
    const t = raw as Record<string, unknown>;
    const name = typeof t.tool === 'string' ? t.tool : null;
    if (!name) continue;
    if (num(t.validatorThrew) + num(t.undeterminedRequired) > 0) excludedTools.push(name);
    const invalid = num(t.invalidRuns);
    if (invalid <= 0) continue;
    const field =
      typeof t.firstErrorField === 'string' && t.firstErrorField !== '' ? t.firstErrorField : '(unknown)';
    const byReason = t.byReason;
    const reasons =
      byReason !== null && typeof byReason === 'object' && !Array.isArray(byReason)
        ? Object.entries(byReason as Record<string, unknown>)
            .filter((x): x is [string, number] => typeof x[1] === 'number')
            .sort((x, y) => y[1] - x[1])
        : [];
    const topReason = reasons[0]?.[0] ?? 'type_mismatch';
    records.push({
      tool: name,
      field,
      reason: isArgRejectionReason(topReason) ? topReason : 'type_mismatch',
      expected: 'unknown(coarse)',
      observed: 'unresolved',
    });
  }
  return { records, excludedTools, malformed: false };
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

// ==================== 人读输出 ====================

export function formatArgRejectionReport(a: AggregateResult, source: string): string {
  const lines: string[] = [];
  lines.push(`source: ${source}`);
  lines.push(`samples: ${a.sampleCount} (tools seen: ${a.toolsSeen})`);
  // 计数语义必须写在报告里,不能让 `invalid=N` 被读成"N 次调用被拒":enforce 路径下
  // 被容错解析救回的样本也计入(N 是"判为不通过"的次数)。硬拒另有 telemetry.enforce.rejected。
  lines.push('note: "invalid" = samples the validator rejected (includes enforce-path rescues via normalizeToolArguments)');
  lines.push(`scheduling: ${a.schedulable ? 'YES' : 'NO'} - ${a.schedulingNote}`);
  if (a.rows.length === 0) {
    lines.push('top-N: (empty) - no row cleared the evidence bar; see undetermined list');
  } else {
    lines.push(`top-${a.rows.length} (by invalid samples):`);
    for (const [i, r] of a.rows.entries()) {
      lines.push(
        `  ${i + 1}. ${r.tool}#${r.field}  expected=${r.expected}  invalid=${r.rejections}` +
          `  dominant=${r.dominantShape ?? '-'}/${pct(r.dominantShare)}  verdict=${r.verdict}`,
      );
      lines.push(`     clue: ${r.clue}`);
    }
  }
  if (a.undetermined.length > 0) {
    lines.push(`undetermined (${a.undetermined.length}, named - not silently dropped):`);
    for (const u of a.undetermined) lines.push(`  - ${u}`);
  }
  return lines.join('\n');
}

// ==================== CLI 入口 ====================

interface CliOptions {
  ledger: string | null;
  snapshots: string[];
  topN: number;
  json: boolean;
  selfTest: boolean;
}

type ParseOutcome = CliOptions | string;

function parseArgs(argv: readonly string[]): ParseOutcome {
  const opts: CliOptions = { ledger: null, snapshots: [], topN: 10, json: false, selfTest: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--ledger' || a === '--snapshot') {
      const v = argv[i + 1];
      if (typeof v !== 'string' || v.startsWith('--')) return `${a} needs a path`;
      if (a === '--ledger') opts.ledger = v;
      else opts.snapshots.push(v);
      i += 1;
      continue;
    }
    if (a === '--top') {
      const v = Number(argv[i + 1]);
      if (!Number.isInteger(v) || v <= 0) return '--top needs a positive integer';
      opts.topN = v;
      i += 1;
      continue;
    }
    if (a === '--json') {
      opts.json = true;
      continue;
    }
    if (a === '--self-test') {
      opts.selfTest = true;
      continue;
    }
    if (a === '--help' || a === '-h') return 'help';
    return `unknown argument: ${a}`;
  }
  return opts;
}

export const USAGE = `usage: ihui tool-arg-report [--ledger <jsonl>] [--snapshot <file>]... [--top N] [--json] [--self-test]

Aggregates tool-argument rejections into a schedulable list of {tool, field path, expected shape}.
Never prints any argument value - only shape classes and counts (see file header).
Set ${TOOL_ARG_LEDGER_ENV}=<path> to make the shadow/enforce path record rejections at all.`;

/** 台账路径解析优先级:`--ledger` > env > 仓库内默认。纯函数,便于测试钉住优先级。 */
export function resolveLedgerPath(
  explicit: string | null,
  env: Record<string, string | undefined>,
  repoRoot: string,
): string {
  if (explicit !== null && explicit.trim() !== '') return resolve(repoRoot, explicit.trim());
  const fromEnv = env[TOOL_ARG_LEDGER_ENV];
  if (fromEnv !== undefined && fromEnv.trim() !== '') return resolve(repoRoot, fromEnv.trim());
  return resolve(repoRoot, DEFAULT_LEDGER_RELATIVE_PATH);
}

/**
 * 仓库根:**从本模块自身位置向上找** `pnpm-workspace.yaml`,而不是信 `process.cwd()`。
 *
 * 为什么不是 cwd:`pnpm --filter @ihui/cli exec …` 会把子进程 cwd 设成**包目录**,
 * 于是按 cwd 拼默认路径会指到 `apps/cli/.ihui-agent/tmp/` 这种根本不存在的位置,
 * 表现为"报告说台账找不到"而找不到原因是查法错了(§守门 70 的"靠 cwd 定位"同型失效)。
 * 找不到标记文件才退回 cwd(非 workspace 场景 / 单文件拷贝运行)。
 */
export function repoRootOf(moduleUrl: string): string {
  return findRepoRoot(dirname(fileURLToPath(moduleUrl)));
}

export function findRepoRoot(fromDir: string): string {
  let dir = resolve(fromDir);
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(fromDir);
}

function main(argv: readonly string[]): number {
  const parsed = parseArgs(argv);
  if (typeof parsed === 'string') {
    if (parsed === 'help') {
      console.log(USAGE);
      return 0;
    }
    console.error(`error: ${parsed}`);
    console.error(USAGE);
    return 2;
  }
  if (parsed.selfTest) return runSelfTest();

  const records: ArgRejectionRecord[] = [];
  const excluded = new Set<string>();
  const notes: string[] = [];
  const unreadable: string[] = [];
  let sawAnySource = false;

  if (parsed.snapshots.length > 0) {
    for (const f of parsed.snapshots) {
      // 相对输入一律锚在仓库根(与台账同一条规则):pnpm --filter exec 会把子进程 cwd 设成
      // 包目录,锚 cwd 的表现就是报告说自己刚写出的文件读不到。
      const file = resolve(repoRootOf(import.meta.url), f);
      let text: string;
      try {
        text = readFileSync(file, 'utf-8');
      } catch (e) {
        unreadable.push(`${file} (${e instanceof Error ? e.message : 'unreadable'})`);
        continue;
      }
      let snap: unknown;
      try {
        snap = JSON.parse(text);
      } catch {
        unreadable.push(`${file} (not valid JSON)`);
        continue;
      }
      const p = recordsFromSnapshot(snap);
      if (p.malformed) {
        unreadable.push(`${file} (no "tools" array - not a snapshotToolArgShadow() dump)`);
        continue;
      }
      sawAnySource = true;
      records.push(...p.records);
      for (const t of p.excludedTools) excluded.add(t);
      notes.push(`snapshot ${file}: coarse projection (byReason/firstErrorField only)`);
    }
  } else {
    const ledger = resolveLedgerPath(parsed.ledger, process.env, repoRootOf(import.meta.url));
    const read = readArgLedger(ledger);
    if (read.missing) {
      unreadable.push(`ledger ${ledger}: not found (UNDETERMINED, not "zero samples")`);
    } else {
      sawAnySource = true;
      records.push(...read.records);
      notes.push(
        `ledger ${ledger}: ${read.records.length} records / ${read.totalLines} lines / ${read.malformedLines} malformed skipped`,
      );
    }
  }

  // 取不到任何输入 = 无法判定,不得出一份看起来像结论的报告(本仓"把没判写成判过了"那一型)。
  if (!sawAnySource) {
    console.error('undetermined: no ledger/snapshot could be read.');
    for (const u of unreadable) console.error(`  - ${u}`);
    console.error(`hint: run the CLI with ${TOOL_ARG_LEDGER_ENV}=<path> in shadow mode, then re-run this report.`);
    return 2;
  }

  const agg = aggregateArgRejections(records, { topN: parsed.topN, excludedTools: excluded });
  for (const u of unreadable) agg.undetermined.push(`input unreadable: ${u}`);
  const source = notes.length > 0 ? notes.join('; ') : 'no source';
  if (parsed.json) {
    console.log(JSON.stringify({ source, unreadable, ...agg }, null, 2));
  } else {
    console.log(formatArgRejectionReport(agg, source));
    if (unreadable.length > 0) {
      console.log('unreadable inputs (named, not silently dropped):');
      for (const u of unreadable) console.log(`  - ${u}`);
    }
  }
  return 0;
}

/**
 * 逻辑自检:构造面正反成对,零副作用(不碰任何真实台账、不派生进程)。
 * 判据写完必须拿"它应当红的构造面"和"它应当绿的当前面"各喂一次,而不是只看它此刻的颜色。
 */
export function runSelfTest(): number {
  let pass = 0;
  let fail = 0;
  const t = (name: string, ok: boolean): void => {
    if (ok) pass += 1;
    else {
      fail += 1;
      console.error(`FAIL ${name}`);
    }
  };
  const rec = (
    tool: string,
    field: string,
    reason: ArgRejectionReason,
    expected: string,
    observed: string,
  ): ArgRejectionRecord => ({ tool, field, reason, expected, observed });

  t('shape: a string yields a class, never content', observedShapeOf('anything') === 'string');
  t(
    'shape: array / null / NaN each get their own class',
    observedShapeOf([1]) === 'array' && observedShapeOf(null) === 'null' && observedShapeOf(NaN) === 'NaN',
  );
  t('expected: enum table collapses to a count', expectedShapeOf('enum(a|b|c)') === 'enum(count=3)');
  t('expected: plain types pass through', expectedShapeOf('number') === 'number');
  t('expected: missing declaration reads as any', expectedShapeOf(undefined) === 'any');

  const same = [1, 2, 3].map(() => rec('file_edit', 'content', 'type_mismatch', 'string', 'number'));
  const aggSame = aggregateArgRejections(same, {});
  t(
    'aggregate: single dominant shape => description-suspect',
    aggSame.rows[0]?.verdict === 'description-suspect' && aggSame.rows[0]?.rejections === 3,
  );

  const mixed = (['number', 'object', 'array'] as const).map((s) =>
    rec('file_edit', 'content', 'type_mismatch', 'string', s),
  );
  t(
    'aggregate: mixed shapes => caller-error',
    aggregateArgRejections(mixed, {}).rows[0]?.verdict === 'caller-error',
  );

  const thin = aggregateArgRejections([rec('file_edit', 'content', 'type_mismatch', 'string', 'number')], {});
  t('aggregate: below sample bar => undetermined + named', thin.rows.length === 0 && thin.undetermined.length === 1);

  const missing = [1, 2, 3].map(() => rec('agent_run', 'taskId', 'missing_required', 'string', 'undefined'));
  const aggMissing = aggregateArgRejections(missing, {});
  t(
    'aggregate: never-filled required => suspect with a handler-check hint',
    aggMissing.rows[0]?.verdict === 'description-suspect' &&
      /HANDLER/.test(aggMissing.rows[0]?.clue ?? ''),
  );

  const excludedAgg = aggregateArgRejections(same, { excludedTools: ['file_edit'] });
  // 主键粒度:同一字段的两种期望必须分成两行(合成一行 = 把两种修法混成一笔账)。
  const twoExpectations = [
    ...Array.from({ length: 3 }, () => rec('demo', 'mode', 'enum_mismatch', 'enum(count=3)', 'string')),
    rec('demo', 'mode', 'missing_required', 'string', 'undefined'),
  ];
  const aggTwo = aggregateArgRejections(twoExpectations, {});
  t('aggregate: expected is part of the primary key (two expectations => two rows)',
    aggTwo.rows.length === 1 &&
      aggTwo.rows[0]?.expected === 'enum(count=3)' &&
      aggTwo.rows[0]?.rejections === 3 &&
      aggTwo.undetermined.length === 1 &&
      aggTwo.sampleCount === 4);

  t('aggregate: excluded tool falls out of top-N into undetermined', excludedAgg.rows.length === 0);

  const few = Array.from({ length: MIN_SAMPLES_FOR_SCHEDULING - 1 }, (_, i) =>
    rec(`t${i}`, 'f', 'type_mismatch', 'string', 'number'),
  );
  const many = Array.from({ length: MIN_SAMPLES_FOR_SCHEDULING }, (_, i) =>
    rec(`t${i}`, 'f', 'type_mismatch', 'string', 'number'),
  );
  t('aggregate: below scheduling bar => schedulable false', aggregateArgRejections(few, {}).schedulable === false);
  t('aggregate: at scheduling bar => schedulable true', aggregateArgRejections(many, {}).schedulable === true);

  // 隐私判据的**正向证明**:含唯一 nonce 的原值绝不出现在序列化结果里。
  const nonce = 'NONCE-7f3a9c-unique-user-value';
  const schema: ToolSchema = {
    name: 'demo',
    description: '',
    parameters: {
      type: 'object',
      properties: {
        mode: { type: 'string', description: '', enum: ['a', 'b'] },
        nested: {
          type: 'object',
          description: '',
          properties: { title: { type: 'string', description: '', enum: ['x'] } },
          required: [],
        },
      },
      required: [],
    },
  };
  const errs: ValidationError[] = [
    { field: 'mode', reason: 'enum_mismatch', expected: 'enum(a|b)', actual: nonce },
    { field: 'nested.title', reason: 'enum_mismatch', expected: 'enum(x)', actual: nonce },
  ];
  const rejectedResult: ValidationResult = { valid: false, coerced: {}, errors: errs, coercedFields: [] };
  const projected = recordsForValidation(schema, { mode: nonce, nested: { title: nonce } }, rejectedResult);
  const dumped = JSON.stringify(projected);
  t('privacy: enum actual value never reaches a record', !dumped.includes(nonce));
  t('privacy: enum table content never reaches a record', !dumped.includes('a|b') && !dumped.includes('enum(x)'));
  t(
    'privacy: nested path resolves to a shape class',
    projected[1]?.observed === 'string' && projected[1]?.field === 'nested.title',
  );
  t('privacy: expected reduced to a count', projected[0]?.expected === 'enum(count=2)');

  const passed = recordsForValidation(schema, { mode: 'a' }, {
    valid: true,
    coerced: {},
    errors: [],
    coercedFields: [],
  });
  t('records: a passing validation contributes nothing', passed.length === 0);

  const noEnv = appendArgRejectionLedger(schema, { mode: nonce }, rejectedResult, {});
  t(
    'ledger: env unset => zero writes and the reason is named',
    noEnv.appended === 0 && noEnv.skippedReason === `${TOOL_ARG_LEDGER_ENV} not set`,
  );

  const absent = readArgLedger(resolve('__definitely-not-a-real-ledger-7f3a9c.jsonl'));
  t('ledger: a missing file reads as missing (not "0 samples")', absent.missing === true && absent.records.length === 0);

  const snap = recordsFromSnapshot({
    tools: [
      {
        tool: 'x',
        invalidRuns: 2,
        firstErrorField: 'f',
        byReason: { type_mismatch: 2 },
        validatorThrew: 0,
        undeterminedRequired: 1,
      },
    ],
  });
  t(
    'snapshot: a tool with undetermined required is excluded from evidence',
    snap.excludedTools.includes('x') && snap.records.length === 1 && snap.records[0]?.observed === 'unresolved',
  );
  const coarseAgg = aggregateArgRejections(snap.records, { excludedTools: snap.excludedTools, coarse: true });
  t('snapshot: coarse projection never yields a schedulable row', coarseAgg.rows.length === 0);

  t('ledger path: explicit --ledger beats env and default', resolveLedgerPath('/tmp/a.jsonl', { [TOOL_ARG_LEDGER_ENV]: '/tmp/b.jsonl' }, '/repo') === resolve('/tmp/a.jsonl'));
  t('ledger path: env is used when --ledger is absent', resolveLedgerPath(null, { [TOOL_ARG_LEDGER_ENV]: '/tmp/b.jsonl' }, '/repo') === resolve('/tmp/b.jsonl'));

  console.log(`self-test: ${pass} passed, ${fail} failed`);
  return fail === 0 ? 0 : 1;
}

const isDirectRun = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  const here = pathToFileURL(entry).href;
  return import.meta.url === here || import.meta.url.replace(/\.ts$/, '.js') === here;
})();

if (isDirectRun) {
  let code = 2;
  try {
    code = main(process.argv.slice(2));
  } catch (e) {
    console.error(`report failed: ${e instanceof Error ? e.message : String(e)}`);
    code = 2;
  }
  process.exit(code);
}
