// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 工具入参校验的「影子档 + enforce 档」接线层(A31 第①步 / A36 第③步)。
 *
 * 为什么需要这一层(而不是直接把校验接上):
 *   `argument-validator.ts` 的 `validateToolArguments()` 自落地起**生产面零调用方** —— 参数描述
 *   从未被执行过,准确度从未被检验过。直接打开拦截的表现就是"昨天能跑今天全被拒"的运行时事故。
 *   所以落地顺序是三步:① 默认关掉的影子档(只记账)→ ② 用影子/离线台账修描述 →
 *   ③ enforce 档(本文件,须显式设 env 才生效)。
 *
 * env `IHUI_TOOL_ARG_VALIDATION` 三档:
 *   off      默认。校验器一次都不被调用,两条计数器恒为 0 —— 由单测钉住"默认零副作用"。
 *   shadow   调用校验器,只累加计数。返回值与不加这段代码时逐字相同。
 *   enforce  schema-aware 容错解析(`normalizeToolArguments`)后判定:
 *            违规调用被拒,错误里带回**单行**违规清单供模型修复;修复回喂按工具名计
 *            连续窗、上限 `TOOL_ARG_REPAIR_MAX_ATTEMPTS` 次,超限即硬失败并保留最后一次
 *            违规清单 —— repair 不得变成无限自投(与 doom-loop 检测共存的那一半)。
 *            校验器自身抛异常(坏描述)⇒ fail-open 放行并计数,绝不因描述有毒而砖化执行。
 *
 * 隐私口径(强制,不是洁癖):两条计数器都**只记字段名与计数**,绝不写入参的值。
 *   `ValidationError.actual` 在 `enum_mismatch` 那一支装的就是用户传进来的原值
 *   (见 `argument-validator.ts` 的 `checkEnum`: `actual: value`),记下来等于把用户数据
 *   塞进遥测出口。`expected` 同理(枚举值表虽来自 schema,但不值得赌)。
 *   本模块只持久化:工具名 / 错误类别 / 首个字段名 / 各类计数。
 *   (enforce 的**拒绝文案**里确实带 actual,但那是回灌给发起这轮调用的模型自己,
 *    属对话面而非遥测面,与计数器是两条通道,互不借道。)
 */

import type { Tool, ToolParameter, ToolSchema } from './index.js';
import {
  normalizeToolArguments,
  validateToolArguments,
  type ValidationError,
} from './argument-validator.js';

// ==================== 档位 ====================

export const TOOL_ARG_VALIDATION_ENV = 'IHUI_TOOL_ARG_VALIDATION';

export const TOOL_ARG_VALIDATION_MODES = ['off', 'shadow', 'enforce'] as const;

export type ToolArgValidationMode = (typeof TOOL_ARG_VALIDATION_MODES)[number];

/**
 * 默认档位。守门 `check-tool-arg-validation-wired.mjs` 直接读**这一行**判"默认不是 enforce" ——
 * 改默认值等于改行为契约:那些 `parameters` 描述至今只有影子/离线台账的读数背书,
 * 翻默认档会让所有调用方一夜之间开始收到拒绝,与"运行时版恒红"是同一种事故。不得顺手翻。
 */
export const DEFAULT_TOOL_ARG_VALIDATION_MODE: ToolArgValidationMode = 'off';

/**
 * enforce 档修复回喂的连续上限(按工具名的连续拒绝窗,出现一次判定通过即清零)。
 * 3 次的依据:doom-loop 侧对"连续相同错误签名"的阈值同为个位数量
 * (`packages/shared/src/agent/doom-loop-detector.ts` 的 STUCK_CONSECUTIVE_THRESHOLD),
 * 本窗兜的是"模型每轮换着写法继续填错"那一型 —— 签名不同也照样封顶,否则换写法就是逃逸口。
 */
export const TOOL_ARG_REPAIR_MAX_ATTEMPTS = 3;

/** enforce 档生效的每进程一次性播报(ASCII:播报走 console,判据/基线不掺中文)。 */
export const ENFORCE_MODE_ACTIVE_NOTICE =
  `[IHUI CLI] ${TOOL_ARG_VALIDATION_ENV}=enforce active: invalid tool arguments are rejected after schema-aware normalization; ` +
  `repair feedback is capped at ${TOOL_ARG_REPAIR_MAX_ATTEMPTS} consecutive rejections per tool, then the call hard-fails with the last violation list`;

function isToolArgValidationMode(v: string): v is ToolArgValidationMode {
  return (TOOL_ARG_VALIDATION_MODES as readonly string[]).includes(v);
}

/** 只喊一次的记号(未知档位 / enforce 请求),免得高频工具调用把终端刷满。 */
let announcedUnknownMode = false;
let announcedEnforce = false;

function announceEnforceOnce(): void {
  if (announcedEnforce) return;
  announcedEnforce = true;
  console.warn(`${ENFORCE_MODE_ACTIVE_NOTICE}(每进程只报一次)`);
}

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
  /** enforce 判定被跑过的次数(enforce 档生效以来逐次累加;与 shadowRuns 互斥不串账) */
  enforceRequested: number;
  /** enforce 档自己的账(结构上与影子计数器分家) */
  enforce: ToolArgEnforceStats;
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
    announceEnforceOnce();
    // 刻意不落进下面的影子记账:enforce 的账在 `enforceValidateToolArguments` 单独立。
    // executor 边界在 enforce 档根本不会调到这里(它走 enforce 出口);这一支只兜
    // 直接调用本函数的旧路径,行为与"影子档缺席"一致:不拒、不改、只报一行。
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

// ==================== enforce 档(A36 第③步:容错复验 → 拒绝 → 有界 repair)====================

/** enforce 档进程内计数(与影子账分家;同样**不落任何入参值**)。 */
export interface ToolArgEnforceStats {
  /** enforce 判定实际跑了多少次 */
  runs: number;
  /** 原值即过(一次 parse 都没做) */
  passedPlain: number;
  /** 靠容错解析复验通过 */
  passedNormalized: number;
  /** 判违规(交给 repair 窗决定回喂还是硬失败) */
  rejected: number;
  /** 校验器自身抛异常 ⇒ fail-open 放行并计数(坏描述不能砖化执行,影子档③同一条规矩) */
  validatorThrew: number;
  /** 工具描述缺 required(非数组)的次数 —— 这些样本不得当作准确度证据 */
  undeterminedRequired: number;
  /** 被 repair 窗记下的连续拒绝次数总和 */
  repairRejections: number;
  /** 其中超出回喂上限、以硬失败收场的次数 */
  repairExhausted: number;
}

const enforceStats: ToolArgEnforceStats = {
  runs: 0,
  passedPlain: 0,
  passedNormalized: 0,
  rejected: 0,
  validatorThrew: 0,
  undeterminedRequired: 0,
  repairRejections: 0,
  repairExhausted: 0,
};

/**
 * 按工具名的**连续**拒绝窗:判定通过即清零(见 enforceValidateToolArguments 的两条 pass 支)。
 * 刻意按"连续"而非"累计" —— 模型中途把别的工具做对了、或本工具修好了,都不该背着旧账。
 */
const repairStreaks = new Map<string, number>();

export interface ToolArgEnforceDecision {
  /**
   * pass             原值即过 ⇒ 参数与返回值逐字不动;
   * pass-normalized  容错解析复验通过 ⇒ 调用方**必须**用 `args`(归一树,原键全保留);
   * reject           违规 ⇒ 由 executor 交 repair 窗定夺(回喂或硬失败),不得执行;
   * undetermined     校验器抛异常 ⇒ fail-open 放行(只记账)。
   */
  status: 'pass' | 'pass-normalized' | 'reject' | 'undetermined';
  args: Record<string, unknown>;
  errors: ValidationError[];
  normalizedFields: string[];
}

/**
 * enforce 判定唯一入口。**必须在任何可能执行/批准的分支之前**被调用。
 *
 * 与"批准 = 执行"链路的关系:拒绝路径根本不进权限/批准弹窗(一条参数就不合法的调用
 * 没有可批准的事);通过路径与影子档一样,绝不触碰 `call.arguments` 的引用,
 * 只有 pass-normalized 才把归一树交回调用方替换。
 */
export function enforceValidateToolArguments(
  tool: Tool,
  args: Record<string, unknown>,
): ToolArgEnforceDecision {
  enforceStats.runs += 1;
  enforceRequested += 1;
  announceEnforceOnce();
  try {
    const schema = buildShadowSchema(tool);
    if (!Array.isArray(tool.required)) enforceStats.undeterminedRequired += 1;
    const norm = normalizeToolArguments(args, schema);
    if (norm.result.valid) {
      repairStreaks.delete(tool.name);
      if (norm.normalizedFields.length > 0) {
        enforceStats.passedNormalized += 1;
        return {
          status: 'pass-normalized',
          args: norm.args as Record<string, unknown>,
          errors: [],
          normalizedFields: norm.normalizedFields,
        };
      }
      enforceStats.passedPlain += 1;
      return { status: 'pass', args, errors: [], normalizedFields: [] };
    }
    enforceStats.rejected += 1;
    return { status: 'reject', args, errors: norm.result.errors, normalizedFields: [] };
  } catch {
    enforceStats.validatorThrew += 1;
    return { status: 'undetermined', args, errors: [], normalizedFields: [] };
  }
}

/** repair 窗记账:每次拒绝 +1;超过上限即"硬失败"档(第 max+1 次连续违规起)。 */
export function noteEnforceRepairRejection(
  toolName: string,
): { attempt: number; max: number; exhausted: boolean } {
  const next = (repairStreaks.get(toolName) ?? 0) + 1;
  repairStreaks.set(toolName, next);
  enforceStats.repairRejections += 1;
  const exhausted = next > TOOL_ARG_REPAIR_MAX_ATTEMPTS;
  if (exhausted) enforceStats.repairExhausted += 1;
  return { attempt: next, max: TOOL_ARG_REPAIR_MAX_ATTEMPTS, exhausted };
}

/** 读出某工具当前连续拒绝数(报表/测试用,不改状态)。 */
export function enforceRepairStreak(toolName: string): number {
  return repairStreaks.get(toolName) ?? 0;
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
    enforce: { ...enforceStats },
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

/** 测试/巡检用:清零两条计数器与 repair 窗,并允许重新播报一次性提示。 */
export function resetToolArgShadowTelemetry(): void {
  buckets.clear();
  unknownModeValues.clear();
  enforceRequested = 0;
  for (const key of Object.keys(enforceStats)) {
    enforceStats[key as keyof ToolArgEnforceStats] = 0;
  }
  repairStreaks.clear();
  announcedUnknownMode = false;
  announcedEnforce = false;
}
