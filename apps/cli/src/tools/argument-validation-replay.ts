// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 工具入参「偏差台账」离线回放 —— A36 三步顺序里第 ① 步的取证出口、第 ② 步的输入。
 *
 * 为什么需要它(而不是"跑真实会话攒影子计数"):
 *   进程内影子计数器(`argument-validation-telemetry.ts`)随进程消失,而"真实会话"是
 *   低频、人工驱动的事件 —— 按那条路径,第②步永远等不到样本。本仓**已经**把每一次工具
 *   调用连同 `input` 落在 `~/.ihui/audit.jsonl`(经 `redactObject` 脱敏),所以偏差样本
 *   早就存在,缺的只是"拿历史调用重放过一遍校验器"这个动作。
 *
 * 与本仓其它"影子/enforce"设计的同一条约束:**台账里不落入参值**。
 *   `ValidationError.actual` 在 `enum_mismatch` 与"args 根本不是对象"两支装的可能是
 *   用户原值(见 `argument-validator.ts:86` 的 `String(args)`),所以本模块**从不**读取
 *   `err.actual`,而是从原始记录自己算一个类型标签(`describeKind`)。
 *   `expected` 一侧取的是 schema 声明(枚举表 / 声明类型),属描述面信息。
 *
 * 刻意不做的事:不改任何 `parameters`、不拦任何调用、不写盘。判据要第②步人读过台账
 * 之后逐条修描述,而不是让一个自动回填程序替模型猜语义。
 */

import type { Tool, ToolParameter, ToolSchema } from './index.js';
import { validateToolArguments, type ValidationError } from './argument-validator.js';

/** 一条来自审计日志的最小视图(与 `AuditEntry` 兼容,但只取回放需要的三字段) */
export interface ReplayRecord {
  tool: string;
  input: unknown;
  timestamp?: string;
}

/** 偏差行:工具 × 字段路径 × 错误类别 × (声明侧, 实得类型侧) */
export interface DeviationRow {
  tool: string;
  field: string;
  reason: ValidationError['reason'] | 'unknown' | 'coerced';
  /** 描述侧声明(类型名或枚举表),修 `parameters` 时要对照的就是它 */
  expected: string;
  /** 实得的**类型标签**,绝不含原值 */
  actualKind: string;
  count: number;
  firstSeen: string | null;
  lastSeen: string | null;
}

export interface ReplayTotals {
  /** 参与回放的记录数 */
  records: number;
  /** 在注册表里找到工具定义的记录数 */
  matched: number;
  /** 找不到工具定义的记录数(这些**不计**偏差:可能是 MCP/插件/已删工具) */
  unknownTool: number;
  /** 校验通过的次数 */
  valid: number;
  /** 至少一条偏差的次数 */
  invalid: number;
  /** 仅发生 coercion('42' → 42)而无错误的次数 —— 描述没写错,但模型发的是字符串 */
  coercionOnly: number;
  /** 校验器自身抛异常的记录数(坏 schema,不能拖垮回放) */
  validatorThrew: number;
  /** 偏差行总数 */
  rows: number;
}

export interface ReplayResult {
  totals: ReplayTotals;
  rows: DeviationRow[];
  /** 被回放过的工具名(排序)—— 用于"覆盖面"读数,别把没跑到的工具算进来 */
  toolsCovered: string[];
}

/**
 * 类型标签。**只做类型判定,不触碰内容**,因此不存在"把用户数据写进台账"的通道。
 * 空串与 null 单列:它们是模型最常见的两类"填了但等于没填",与 undefined 的修法不同。
 */
export function describeKind(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'string') return value.length === 0 ? 'empty-string' : 'string';
  if (typeof value === 'number') return Number.isFinite(value) ? 'number' : 'non-finite-number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'object') return 'object';
  return typeof value;
}

/** 从嵌套字段路径上取实得值(`items[0].name` 这类数组下标由校验器产出) */
function valueAt(root: unknown, fieldPath: string): unknown {
  if (root === null || typeof root !== 'object') return undefined;
  let cur: unknown = root;
  for (const seg of fieldPath.split('.')) {
    const m = /^([^[\]]+)\[(\d+)\]$/.exec(seg);
    const key = m ? m[1]! : seg;
    const idx = m ? Number(m[2]) : null;
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
    if (idx !== null) {
      if (!Array.isArray(cur) || idx >= cur.length) return undefined;
      cur = cur[idx];
    }
  }
  return cur;
}

/**
 * 把 `Tool` 的扁平形状拼成校验器要的 `ToolSchema`。
 * 与 `argument-validation-telemetry.ts` 的 `buildShadowSchema` **同形**是刻意的:
 * 两条路径必须看到同一份描述,否则影子档与离线台账会各自报出不同的偏差集。
 */
function toSchema(tool: Tool): ToolSchema {
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

/**
 * 沿字段路径取**声明侧**的类型名(`todos[0].summary` → `todos.items.properties.summary.type`)。
 * 只用于 coercion 行 —— 那一类没有校验器给的 `expected`,而"声明是什么"正是修法要对照的那一半。
 */
export function declaredTypeOf(tool: Tool, fieldPath: string): string {
  let node: ToolParameter | undefined;
  for (const seg of fieldPath.split('.')) {
    const m = /^([^[\]]+)(\[(\d+)\])?$/.exec(seg);
    const key = m ? m[1]! : seg;
    const container = node ? node.properties : (tool.parameters as Record<string, ToolParameter> | undefined);
    if (!container || typeof container !== 'object') return 'any';
    node = container[key];
    if (!node) return 'any';
    if (m && m[3] !== undefined) node = node.items;
    if (!node) return 'any';
  }
  return node?.type ?? 'any';
}

/**
 * 回放:把历史调用逐条喂给校验器,聚合成偏差台账。
 *
 * 纯函数 —— `getTool` 由调用方注入(生产面注入注册表,测试注入夹具),
 * 因此这条判据不依赖任何机器状态:审计日志在不在、有多少条,都不改变判定本身。
 */
export function replayArgumentDeviations(
  records: readonly ReplayRecord[],
  getTool: (name: string) => Tool | undefined,
): ReplayResult {
  const totals: ReplayTotals = {
    records: records.length,
    matched: 0,
    unknownTool: 0,
    valid: 0,
    invalid: 0,
    coercionOnly: 0,
    validatorThrew: 0,
    rows: 0,
  };
  const agg = new Map<string, DeviationRow>();
  const covered = new Set<string>();

  /** 同一 (工具, 字段, 类别) 只占一行,累计次数与首末时间 */
  function bump(key: string, row: DeviationRow, rec: ReplayRecord): void {
    const existing = agg.get(key);
    if (!existing) {
      agg.set(key, row);
      return;
    }
    existing.count += 1;
    if (!rec.timestamp) return;
    if (existing.firstSeen === null || existing.firstSeen > rec.timestamp) existing.firstSeen = rec.timestamp;
    if (existing.lastSeen === null || existing.lastSeen < rec.timestamp) existing.lastSeen = rec.timestamp;
  }

  for (const rec of records) {
    const tool = getTool(rec.tool);
    if (!tool) {
      totals.unknownTool += 1;
      continue;
    }
    totals.matched += 1;
    covered.add(tool.name);
    let result;
    try {
      result = validateToolArguments(rec.input, toSchema(tool));
    } catch {
      totals.validatorThrew += 1;
      continue;
    }
    if (result.valid) {
      totals.valid += 1;
      if (result.coercedFields.length > 0) totals.coercionOnly += 1;
      // coercion 也是描述面的偏差:声明是 number 而模型发的是 "42",今天被
      // `Number(value)` 兜住了,但"模型为什么会发字符串"正是第②步要读的账。
      // 刻意排在 errors 之后:同一字段若已判错,以错误行为准,不重复记两行。
      for (const field of result.coercedFields) {
        bump(
          `${tool.name}::${field}::coerced`,
          {
            tool: tool.name,
            field,
            reason: 'coerced',
            expected: declaredTypeOf(tool, field),
            actualKind: describeKind(valueAt(rec.input, field)),
            count: 1,
            firstSeen: rec.timestamp ?? null,
            lastSeen: rec.timestamp ?? null,
          },
          rec,
        );
      }
      continue;
    }
    totals.invalid += 1;
    for (const err of result.errors) {
      const field = typeof err.field === 'string' && err.field.length > 0 ? err.field : '<root>';
      const reason = typeof err.reason === 'string' ? err.reason : 'unknown';
      bump(
        `${tool.name}::${field}::${reason}`,
        {
          tool: tool.name,
          field,
          reason,
          expected: String(err.expected ?? ''),
          actualKind: describeKind(valueAt(rec.input, field)),
          count: 1,
          firstSeen: rec.timestamp ?? null,
          lastSeen: rec.timestamp ?? null,
        },
        rec,
      );
    }
  }

  const rows = [...agg.values()].sort((a, b) => b.count - a.count || a.tool.localeCompare(b.tool) || a.field.localeCompare(b.field));
  totals.rows = rows.length;
  return { totals, rows, toolsCovered: [...covered].sort() };
}
