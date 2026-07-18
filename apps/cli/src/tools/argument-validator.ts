/**
 * Tool 调用入参校验器(P48-1)。
 *
 * 灵感来源:参考 cli-shell/src/session/parsers/tool_call_parser.rs
 * 的 schema validation 阶段(在 parse_arguments 后做类型/必填/枚举校验,
 * 失败时返回详细错误供 LLM 重试)。
 *
 * 简化策略(做减法):
 *   - 零新依赖(无 zod / ajv 等 npm 包,纯 TypeScript 类型守卫)
 *   - 不做完整 JSON Schema 草案支持,只覆盖 IHUI 内置 5 种 type + enum + required
 *   - 校验失败返回详细 ValidationError[],便于 LLM 一次性修正
 *   - 校验通过时返回 coerced 参数(number 字符串自动转 number 等)
 *
 * 设计原则:
 *   - 纯函数:不抛异常,所有错误以 ValidationError 形式返回
 *   - 容错优先:coercion 优先(LLM 经常 number 传成 string,自动转)
 *   - 早失败:required 缺失/类型不匹配 → valid=false,不让坏参数穿透到工具执行
 *
 * 使用场景:
 *   - parseToolCalls 后做 args 校验(LLM 输出坏 JSON 修复后,再校验参数)
 *   - executeToolCall 早期 fail-fast(避免在工具内部才发现参数错)
 *   - 错误反馈:formatValidationErrors() 生成 LLM 可读的提示文本
 */

import type { ToolParameter, ToolSchema } from './index.js';

// ==================== 类型定义 ====================

/** 校验错误。 */
export interface ValidationError {
  /** 字段路径(支持嵌套如 'config.timeout') */
  field: string;
  /** 错误原因分类 */
  reason:
    | 'missing_required'
    | 'type_mismatch'
    | 'enum_mismatch'
    | 'unknown_field'
    | 'array_item_type_mismatch'
    | 'object_missing_required';
  /** 期望类型/值的描述 */
  expected: string;
  /** 实际收到的值描述(类型/字面值) */
  actual: string;
}

/** 校验结果。 */
export interface ValidationResult {
  /** 是否全部通过 */
  valid: boolean;
  /** 校验后的参数(已做 coercion,如 '42' → 42) */
  coerced: Record<string, unknown>;
  /** 错误列表(valid=true 时为空) */
  errors: ValidationError[];
  /** Coercion 应用情况(给埋点用):key 列表 */
  coercedFields: string[];
}

// ==================== 主入口 ====================

/**
 * 校验 tool call 入参。
 *
 * @param args LLM 输出的原始入参(可能含有 string 数字 / null 等)
 * @param schema 工具定义的参数 schema
 * @returns 校验结果(valid + coerced + errors)
 */
export function validateToolArguments(
  args: unknown,
  schema: ToolSchema,
): ValidationResult {
  const errors: ValidationError[] = [];
  const coerced: Record<string, unknown> = {};
  const coercedFields: string[] = [];

  // args 必须为对象
  if (args === null || args === undefined) {
    return {
      valid: false,
      coerced: {},
      errors: [
        {
          field: '(root)',
          reason: 'type_mismatch',
          expected: 'object',
          actual: String(args),
        },
      ],
      coercedFields: [],
    };
  }
  if (typeof args !== 'object' || Array.isArray(args)) {
    return {
      valid: false,
      coerced: {},
      errors: [
        {
          field: '(root)',
          reason: 'type_mismatch',
          expected: 'object',
          actual: Array.isArray(args) ? 'array' : typeof args,
        },
      ],
      coercedFields: [],
    };
  }

  const argObj = args as Record<string, unknown>;

  // 1. 检查 required 字段缺失
  //    ToolSchema 的 required 嵌套在 parameters 内(schema.parameters.required)
  for (const req of schema.parameters.required) {
    if (!(req in argObj) || argObj[req] === undefined) {
      errors.push({
        field: req,
        reason: 'missing_required',
        expected: schema.parameters.properties[req]?.type ?? 'any',
        actual: 'undefined',
      });
    }
  }

  // 2. 校验每个声明的字段
  //    ToolSchema 的 properties 嵌套在 parameters 内(schema.parameters.properties)
  for (const [key, paramSchema] of Object.entries(schema.parameters.properties)) {
    if (!(key in argObj)) continue; // 缺失已在上一步报告
    const value = argObj[key];
    if (value === undefined) continue; // 显式 undefined 等同缺失
    const coercedValue = coerceAndCheck(key, value, paramSchema, errors);
    coerced[key] = coercedValue;
    if (coercedValue !== value) coercedFields.push(key);
  }

  // 3. 报告未知字段(可选严格模式,默认不报错,只 warn)
  //    不加入 errors,避免 LLM 因多打一个字段导致整个调用失败
  //    如需严格模式,可由调用方基于 schema.additionalProperties === false 检查

  return {
    valid: errors.length === 0,
    coerced,
    errors,
    coercedFields,
  };
}

// ==================== Coercion + 类型校验 ====================

/**
 * 对单个字段做 coercion + 类型校验。
 * 失败时把错误 push 到 errors[],返回最终 coerced 值。
 */
function coerceAndCheck(
  field: string,
  value: unknown,
  param: ToolParameter,
  errors: ValidationError[],
): unknown {
  switch (param.type) {
    case 'string':
      return checkString(field, value, param, errors);
    case 'number':
      return checkNumber(field, value, param, errors);
    case 'boolean':
      return checkBoolean(field, value, param, errors);
    case 'array':
      return checkArray(field, value, param, errors);
    case 'object':
      return checkObject(field, value, param, errors);
    default:
      // 未知类型:原样返回(不抛错)
      return value;
  }
}

function checkString(
  field: string,
  value: unknown,
  param: ToolParameter,
  errors: ValidationError[],
): string {
  if (typeof value === 'string') {
    return checkEnum(field, value, param, errors);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return checkEnum(field, String(value), param, errors);
  }
  if (typeof value === 'boolean') {
    return checkEnum(field, String(value), param, errors);
  }
  errors.push({
    field,
    reason: 'type_mismatch',
    expected: 'string',
    actual: describeType(value),
  });
  return value as string; // 保留原值,即便无效
}

function checkNumber(
  field: string,
  value: unknown,
  _param: ToolParameter,
  errors: ValidationError[],
): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    // 严格解析:拒绝 '1.5abc' 这种半数字
    const n = Number(value);
    if (Number.isFinite(n) && String(n) === value.trim()) return n;
    // 容错:LLM 经常 '42' 直接当 number(trim 后)
    if (value.trim() !== '' && Number.isFinite(Number(value.trim()))) {
      return Number(value.trim());
    }
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  errors.push({
    field,
    reason: 'type_mismatch',
    expected: 'number',
    actual: describeType(value),
  });
  return value as number;
}

function checkBoolean(
  field: string,
  value: unknown,
  _param: ToolParameter,
  errors: ValidationError[],
): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
  }
  if (typeof value === 'number') return value !== 0;
  errors.push({
    field,
    reason: 'type_mismatch',
    expected: 'boolean',
    actual: describeType(value),
  });
  return value as boolean;
}

function checkArray(
  field: string,
  value: unknown,
  param: ToolParameter,
  errors: ValidationError[],
): unknown[] {
  if (!Array.isArray(value)) {
    errors.push({
      field,
      reason: 'type_mismatch',
      expected: 'array',
      actual: describeType(value),
    });
    return value as unknown[];
  }
  if (!param.items) return value; // 无 items 约束,放行
  // 校验每个 item 类型
  const result: unknown[] = [];
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    const coercedItem = coerceAndCheck(`${field}[${i}]`, item, param.items, errors);
    result.push(coercedItem);
  }
  return result;
}

function checkObject(
  field: string,
  value: unknown,
  param: ToolParameter,
  errors: ValidationError[],
): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    errors.push({
      field,
      reason: 'type_mismatch',
      expected: 'object',
      actual: describeType(value),
    });
    return value as Record<string, unknown>;
  }
  const obj = value as Record<string, unknown>;
  // 检查 object 内部 required
  if (param.required) {
    for (const req of param.required) {
      if (!(req in obj) || obj[req] === undefined) {
        errors.push({
          field: `${field}.${req}`,
          reason: 'object_missing_required',
          expected: param.properties?.[req]?.type ?? 'any',
          actual: 'undefined',
        });
      }
    }
  }
  // 校验每个属性
  if (param.properties) {
    for (const [k, subSchema] of Object.entries(param.properties)) {
      if (!(k in obj) || obj[k] === undefined) continue;
      obj[k] = coerceAndCheck(`${field}.${k}`, obj[k], subSchema, errors);
    }
  }
  return obj;
}

function checkEnum(
  field: string,
  value: string,
  param: ToolParameter,
  errors: ValidationError[],
): string {
  if (!param.enum) return value;
  if (!param.enum.includes(value)) {
    errors.push({
      field,
      reason: 'enum_mismatch',
      expected: `enum(${param.enum.join('|')})`,
      actual: value,
    });
  }
  return value;
}

// ==================== 工具函数 ====================

/** 简短类型描述,用于错误信息。 */
function describeType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isNaN(value)) return 'NaN';
  return typeof value;
}

/**
 * 格式化 ValidationError[] 为 LLM 可读文本。
 * 用于在 tool_result 错误回传时给 LLM 一次性修正所有问题。
 *
 * @example
 *   formatValidationErrors([
 *     { field: 'path', reason: 'missing_required', expected: 'string', actual: 'undefined' },
 *     { field: 'timeout', reason: 'type_mismatch', expected: 'number', actual: 'string' },
 *   ])
 *   // → "参数校验失败:\n- 字段 'path' 缺失(期望 string)\n- 字段 'timeout' 类型不匹配(期望 number,实际 string)"
 */
export function formatValidationErrors(errors: readonly ValidationError[]): string {
  if (errors.length === 0) return '';
  const lines: string[] = [];
  lines.push('参数校验失败:');
  for (const e of errors) {
    const reasonText = REASON_TEXT[e.reason] ?? e.reason;
    lines.push(`- 字段 '${e.field}' ${reasonText}(期望 ${e.expected},实际 ${e.actual})`);
  }
  return lines.join('\n');
}

const REASON_TEXT: Record<ValidationError['reason'], string> = {
  missing_required: '缺失',
  type_mismatch: '类型不匹配',
  enum_mismatch: '枚举值不匹配',
  unknown_field: '未知字段',
  array_item_type_mismatch: '数组元素类型不匹配',
  object_missing_required: '对象必填字段缺失',
};
