// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具入参「影子校验」遥测(A31 第①步:只记账,不拦截)。
 *
 * 为什么需要这一层(而不是直接把校验接上):
 *   `argument-validator.ts` 的 `validateToolArguments()` 自落地起**生产面零调用方** —— 参数描述
 *   从未被执行过,准确度从未被检验过。直接打开拦截的表现就是"昨天能跑今天全被拒"的运行时事故。
 *   所以这里只加一个默认关掉的影子档:跑校验、把结果累进进程内计数器,但
 *   **不改 args、不改返回值、不拦任何一次调用**(第②③步才谈拦截)。
 *
 * env `IHUI_TOOL_ARG_VALIDATION` 三档(本票实现前两档):
 *   off      默认。校验器一次都不被调用,计数器恒为 0 —— 由单测①钉住"默认零副作用"。
 *   shadow   调用校验器,只累加计数。返回值与不加这段代码时逐字相同(单测②)。
 *   enforce  **未实现**(第②③步的活,见 PROJECT_PLAN 第八波登记)。这里只如实报一行,
 *            然后按原路径继续执行:绝不返回拒绝、绝不改写参数。半途实现的 enforce 比没有
 *            enforce 更危险 —— 它会让人以为已经收紧了。
 *
 * 隐私口径(强制,不是洁癖):计数器**只记字段名与计数**,绝不写入参的值。
 *   `ValidationError.actual` 在 `enum_mismatch` 那一支装的就是用户传进来的原值
 *   (见 `argument-validator.ts` 的 `checkEnum`: `actual: value`),记下来等于把用户数据
 *   塞进遥测出口。`expected` 同理(枚举值表虽来自 schema,但不值得赌)。
 *   本模块只持久化:工具名 / 错误类别 / 首个字段名 / 各类计数。
 */

import type { Tool, ToolParameter, ToolSchema } from './index.js';
import { validateToolArguments, type ValidationError } from './argument-validator.js';

// ==================== 档位 ====================

export const TOOL_ARG_VALIDATION_ENV = 'IHUI_TOOL_ARG_VALIDATION';

export const TOOL_ARG_VALIDATION_MODES = ['off', 'shadow', 'enforce'] as const;

export type ToolArgValidationMode = (typeof TOOL_ARG_VALIDATION_MODES)[number];

/**
 * 默认档位。守门 `check-tool-arg-validation-wired.mjs` 直接读**这一行**判"默认不是 enforce" ——
 * 改默认值等于改行为契约,必须与第②③步的票一起走,不得顺手翻。
 */
export const DEFAULT_TOOL_ARG_VALIDATION_MODE: ToolArgValidationMode = 'off';

export const ENFORCE_NOT_IMPLEMENTED_NOTICE =
  `[IHUI CLI] ${TOOL_ARG_VALIDATION_ENV}=enforce 尚未实现(影子校验的第②③步),本次调用按 shadow 记账后原样执行`;

function isToolArgValidationMode(v: string): v is ToolArgValidationMode {
  return (TOOL_ARG_VALIDATION_MODES as readonly string[]).includes(v);
}

/** 一个进程内只喊一次的记号(未知档位 / enforce 请求),免得高频工具调用把终端刷满。 */
let announcedUnknownMode = false;
let announcedEnforce = false;

/** 解析当前档位。取值非法时不静默吞掉:报一行,再退回默认档(未知开关静默落默认分支是本仓踩过的坑)。 */
export function resolveToolArgValidationMode(
  env: Record<string, string | undefined> = process.env,
): ToolArgValidationMode {
  const raw = env[TOOL_ARG_VALIDATION_ENV];
  if (raw === undefined || raw.trim() === '') return DEFAULT_TOOL_ARG_VALIDATION_MODE;
  const lowered = raw.trim().toLowerCase();
  if (isToolArgValidationMode(lowered)) return lowered;
  if (!announcedUnknownMode) {
    announcedUnknownMode = true;
    console.warn(
      `[IHUI CLI] ${TOOL_ARG_VALIDATION_ENV}="${raw}" 不是 ${TOOL_ARG_VALIDATION_MODES.join('/')} 之一,按默认档 "${DEFAULT_TOOL_ARG_VALIDATION_MODE}" 处理(每进程只报一次)`,
    );
  }
  unknownModeValues.add(raw.trim());
  return DEFAULT_TOOL_ARG_VALIDATION_MODE;
}

// ==================== 计数器 ====================

/** 单工具累计。字段名全部是**描述面**信息,没有任何入参值(见文件头隐私口径)。 */
export interface ToolArgShadowStats {
  tool: string;
  /** shadow 档实际跑了多少次校验 */
  shadowRuns: number;
  /** 其中判定为不通过(有 ≥1 条错误)的次数 */
  invalidRuns: number;
  /** 错误条数总和(一次调用可多条) */
  errorCount: number;
  /** 按校验器错误类别分桶 */
  byReason: Record<string, number>;
  /** 该工具第一次出现的错误字段名(只记字段名) */
  firstErrorField: string | null;
  /** 因工具描述缺 required(非数组)而无法判定"必填是否满足"的次数 —— 这些样本不得当作准确度证据 */
  undeterminedRequired: number;
  /** 校验器自身抛异常的次数(坏描述不能拖垮调用,单测③) */
  validatorThrew: number;
  /** 影子档"若真拦就会改写 args"的次数 —— enforce 那一票的爆炸半径预估值 */
  coercedRuns: number;
}

export interface ToolArgShadowSnapshot {
  /** 读快照时的档位(与计数器无关,只为报表有一行现值) */
  mode: ToolArgValidationMode;
  totalShadowRuns: number;
  totalToolsWithErrors: number;
  /** 请求过 enforce 的次数(本票不实现拒绝,只数它被要求过) */
  enforceRequested: number;
  /** 出现过的非法档位取值(不记 env 全文,只记 trim 后的值) */
  unknownModeValues: string[];
  tools: ToolArgShadowStats[];
}

const buckets = new Map<string, ToolArgShadowStats>();
let enforceRequested = 0;
const unknownModeValues = new Set<string>();

function bucketFor(toolName: string): ToolArgShadowStats {
  const existing = buckets.get(toolName);
  if (existing) return existing;
  const fresh: ToolArgShadowStats = {
    tool: toolName,
    shadowRuns: 0,
    invalidRuns: 0,
    errorCount: 0,
    byReason: {},
    firstErrorField: null,
    undeterminedRequired: 0,
    validatorThrew: 0,
    coercedRuns: 0,
  };
  buckets.set(toolName, fresh);
  return fresh;
}

/**
 * 影子校验入口 —— **必须在任何可能拒绝的分支之前**被调用,且自身永不抛、永不改入参。
 *
 * 与"批准 = 执行"链路的关系:`executeToolCall` 把同一个 `call.arguments` 引用一路传到
 * `tool.execute()`,本函数只读它、绝不写它,也不返回任何东西给调用链。
 */
export function shadowValidateToolArguments(
  tool: Tool,
  args: Record<string, unknown>,
): void {
  const mode = resolveToolArgValidationMode();
  // off 是缺省:一次都不调用校验器,也不动任何计数器。
  if (mode === 'off') return;
  if (mode === 'enforce') {
    enforceRequested += 1;
    if (!announcedEnforce) {
      announcedEnforce = true;
      console.warn(`${ENFORCE_NOT_IMPLEMENTED_NOTICE}(每进程只报一次)`);
    }
    // 刻意不 return 一个拒绝结果,也不落进下面的记账:enforce 的账要在第②③步单独立。
    return;
  }

  const b = bucketFor(tool.name);
  b.shadowRuns += 1;
  try {
    const schema = buildShadowSchema(tool);
    const result = validateToolArguments(args, schema);
    if (!Array.isArray(tool.required)) b.undeterminedRequired += 1;
    if (!result.valid) {
      b.invalidRuns += 1;
      b.errorCount += result.errors.length;
      for (const err of result.errors) bumpReason(b, err);
      if (b.firstErrorField === null) b.firstErrorField = fieldOf(result.errors[0]);
    }
    if (result.coercedFields.length > 0) b.coercedRuns += 1;
  } catch {
    // 坏描述(schema 自身有毒)绝不能拖垮工具执行:这里必须吞掉,并把它记成一条可数的账。
    b.validatorThrew += 1;
  }
}

/** 只取字段名与错误类别 —— 不取 expected/actual(后者可能含入参原值)。 */
function bumpReason(b: ToolArgShadowStats, err: ValidationError): void {
  const key = typeof err?.reason === 'string' ? err.reason : 'unknown';
  b.byReason[key] = (b.byReason[key] ?? 0) + 1;
}

function fieldOf(err: ValidationError | undefined): string | null {
  if (!err) return null;
  return typeof err.field === 'string' ? err.field : null;
}

/**
 * 把 Tool 的扁平形状(`parameters: Record<…>` + 顶层 `required`)拼成校验器要的 ToolSchema。
 * 只做防御性归一,不做推断:类型不对就交给上面的 try/catch 记成 validatorThrew。
 */
function buildShadowSchema(tool: Tool): ToolSchema {
  const rawParams = tool.parameters as unknown;
  const properties: Record<string, ToolParameter> =
    rawParams !== null && typeof rawParams === 'object' && !Array.isArray(rawParams)
      ? (rawParams as Record<string, ToolParameter>)
      : {};
  const required = Array.isArray(tool.required) ? tool.required : [];
  return {
    name: tool.name,
    description: typeof tool.description === 'string' ? tool.description : '',
    parameters: { type: 'object', properties, required },
  };
}

// ==================== 读出接口(供守护/报表) ====================

/** 进程内快照:深拷贝,调用方改动不会污染计数器。 */
export function snapshotToolArgShadow(
  env: Record<string, string | undefined> = process.env,
): ToolArgShadowSnapshot {
  const tools: ToolArgShadowStats[] = [];
  let totalShadowRuns = 0;
  let totalToolsWithErrors = 0;
  for (const name of [...buckets.keys()].sort()) {
    const b = buckets.get(name)!;
    const copy: ToolArgShadowStats = {
      ...b,
      byReason: { ...b.byReason },
    };
    tools.push(copy);
    totalShadowRuns += b.shadowRuns;
    if (b.errorCount > 0 || b.validatorThrew > 0) totalToolsWithErrors += 1;
  }
  return {
    mode: resolveToolArgValidationMode(env),
    totalShadowRuns,
    totalToolsWithErrors,
    enforceRequested,
    unknownModeValues: [...unknownModeValues].sort(),
    tools,
  };
}

/** 只问"影子跑过没有" —— 单测①用它证明默认档一次都没调用校验器。 */
export function totalToolArgShadowRuns(): number {
  let n = 0;
  for (const b of buckets.values()) n += b.shadowRuns + b.validatorThrew;
  return n;
}

/** 测试/巡检用:清零并允许重新播报一次性提示。 */
export function resetToolArgShadowTelemetry(): void {
  buckets.clear();
  unknownModeValues.clear();
  enforceRequested = 0;
  announcedUnknownMode = false;
  announcedEnforce = false;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
