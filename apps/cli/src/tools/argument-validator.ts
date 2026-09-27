// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Tool 调用入参校验器(P48-1)。
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
 * 内容级相等判定(仅用于"重建过的值是否真的变了")。
 *
 * 用 JSON 序列化比对而不是手写深比较:校验器面对的输入来自模型输出的 JSON,
 * 本就无函数 / 无循环;而比较失败(意外形态)一律返回 false,
 * 让调用方按"确实发生了转换"处理 —— 宁可多记一条,也不要把真转换漏成没转。
 */
function sameContent(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

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
  return runValidation(args, schema);
}

/**
 * 判定本体的**唯一**实现。为什么不是 `validateToolArguments` 本身:
 * 守门 115 的镜像测试钉"定义文件不贡献 `validateToolArguments(` 调用行"(防头注解释文字骗绿),
 * 而 `normalizeToolArguments` 与公开入口同住在定义文件里、必须复用同一判据 —— 拆出私有核,
 * 两个公开出口(`validateToolArguments` / `normalizeToolArguments`)都投影到它,判据仍只有一份。
 */
function runValidation(
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
    // 与 checkObject 同一条规则:非 required 的顶层属性传 null 等同缺席(见 checkObject 注释)
    if (value === null && !schema.parameters.required.includes(key)) continue;
    const coercedValue = coerceAndCheck(key, value, paramSchema, errors);
    coerced[key] = coercedValue;
    // 判"是否发生转换"不能只看引用:checkArray 只要带 items 约束就**必然**返回新数组
    // (它逐项重建;实测 checkObject 在无改动时原样返回同一引用,所以这一型只有数组)。
    // 于是每个带 items 的 array 字段每次调用都被记成一次 coercion,而内容逐字没变。
    // 这个假阳性会同时灌满两处读数:影子遥测的 coercedRuns(它是第③步 enforce
    // 爆炸半径的预估依据)与离线偏差台账。改判内容:内容相同 ⇒ 没转换;
    // 比较本身失败(意外形态)⇒ 按"转换了"算,宁可多记一条也不漏。
    if (coercedValue !== value && !sameContent(coercedValue, value)) coercedFields.push(key);
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
      // 可选属性上的显式 `null` = "这一项不适用",与缺席同义。
      // 实测依据(A36 第①步离线台账):851 条历史工具调用里唯一的偏差就是
      // `todo_write.todos[].summary` 被填成 null —— 那个字段本就写着"(可选)"。
      // 模型用 null 表达"没有",校验器若判它违规,第③步 enforce 一开就会拒绝掉
      // 一批完全正当的调用(与本仓"运行时版恒红"那条禁令同型)。
      // 只豁免**不在本层 required 里**的属性;required 属性传 null 照旧违规。
      if (obj[k] === null && !(param.required ?? []).includes(k)) continue;
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

// ==================== enforce 档:schema-aware 单次容错解析 ====================
//
// 为什么 enforce 必须带这一半,而不是只做严格拒绝:真实模型经常把 object/array 型参数
// **整体 stringify**(该传 {"a":1} 却传了字符串 '{"a":1}')。只做拒绝的症状是
// "昨天能跑今天全被拒" —— 那是制造事故,不是收紧安全(守门 115 头注同一条理由)。
// 三条不可动摇的判序(与本仓"参数描述准确度未知"的前提配套):
//   ① **原值先过校验就绝不 re-parse** —— 合法 string 值与 union 里的 string 分支
//     (`string | null` 传 "42")必须原样通过,不得被 parse 成别的类型;
//   ② 只有"原值不过 ∧ 该位置 schema 期望 object/array ∧ 实得是 string"才做**一次**
//     JSON.parse 复验;parse 结果形状不符(object 档 parse 出数组/标量、array 档 parse 出
//     对象)视同 parse 失败,不复验;
//   ③ parse 后**再校验一次**,不过即**维持原判**(报原树的错误,不改原参数)——
//     容错的出口只有"复验通过"这一条,不存在"parse 出来就放行"。
// 归一树**保留全部原键**(浅拷贝逐层重建),不得用 `ValidationResult.coerced` 顶替 ——
// coerced 只含声明过的字段,拿它替换会把 schema 外的在途字段静默丢掉。

/** 复递归下降深度上限:超过即不再下探(描述面再深也不值得无界递归,宁可不修)。 */
const NORMALIZE_MAX_DEPTH = 16;

/** normalizeToolArguments 的返回。 */
export interface ArgumentNormalization {
  /** 判定所依据的参数树:未触发容错 / 复验不过 ⇒ 与入参同一引用(原样) */
  args: unknown;
  /** 被成功解开并复验通过的完整路径('payload' / 'payload.filters' / '(root)');空数组 = 未发生容错 */
  normalizedFields: string[];
  /** 对返回树生效的校验结果(pass 时为原树或复验通过的结果;reject 时为**原判**) */
  result: ValidationResult;
}

/** 该位置的 schema 是否"期望容器而实得字符串"—— 容错解析唯一的准入条件。 */
function isStringifiedContainer(param: ToolParameter, value: unknown): boolean {
  return typeof value === 'string' && (param.type === 'object' || param.type === 'array');
}

/** 一次 JSON.parse;形状不符(或缺失)返回 undefined,绝不二次猜测。 */
function parseContainer(text: string, want: 'object' | 'array'): unknown | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (want === 'array') return Array.isArray(parsed) ? parsed : undefined;
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
}

/** 与校验器同一套路径拼法:对象属性用 `a.b`,数组元素用 `a[0]`(见 checkArray/checkObject)。 */
function childPath(parent: string, key: string): string {
  return parent === '' ? key : `${parent}.${key}`;
}

function repairValue(
  value: unknown,
  param: ToolParameter,
  path: string,
  touched: string[],
  depth: number,
): unknown {
  let current = value;
  if (isStringifiedContainer(param, current)) {
    const parsed = parseContainer(current as string, param.type === 'array' ? 'array' : 'object');
    if (parsed !== undefined) {
      touched.push(path === '' ? '(root)' : path);
      current = parsed;
    }
  }
  if (depth >= NORMALIZE_MAX_DEPTH) return current;
  if (
    param.type === 'object' &&
    param.properties &&
    current !== null &&
    typeof current === 'object' &&
    !Array.isArray(current)
  ) {
    const out: Record<string, unknown> = { ...(current as Record<string, unknown>) };
    for (const [k, sub] of Object.entries(param.properties)) {
      if (!(k in out) || out[k] === undefined) continue;
      out[k] = repairValue(out[k], sub, childPath(path, k), touched, depth + 1);
    }
    return out;
  }
  if (param.type === 'array' && param.items && Array.isArray(current)) {
    const items = param.items;
    return current.map((item, i) =>
      item === undefined ? item : repairValue(item, items, `${path === '' ? '' : path}[${i}]`, touched, depth + 1),
    );
  }
  return current;
}

/**
 * schema-aware 单次容错解析 + 复验(enforce 档的唯一判定入口)。
 *
 * 与 validateToolArguments 的关系:这是它**外面**的一层,不是第二份校验实现 ——
 * 判定本体仍是 validateToolArguments,parse 只在原判不过时对容器位发生一次,再喂回同一判据。
 */
export function normalizeToolArguments(args: unknown, schema: ToolSchema): ArgumentNormalization {
  const first = runValidation(args, schema);
  // 判序①:原值过了就到此为止,一次 parse 都不做。
  if (first.valid) return { args, normalizedFields: [], result: first };
  const touched: string[] = [];
  // 根位置按 object 档处理:`ToolSchema.parameters` 与 `ToolParameter` 只差一个
  // `description` 字段(根没有描述面),这里就地补空串,**不**新增第二种 schema 形状。
  const rootParam: ToolParameter = {
    type: 'object',
    description: '',
    properties: schema.parameters.properties,
    required: schema.parameters.required,
  };
  const repaired = repairValue(args, rootParam, '', touched, 0);
  if (touched.length === 0) return { args, normalizedFields: [], result: first };
  const second = runValidation(repaired, schema);
  // 判序③:复验不过 ⇒ 维持原判(错误与参数树都回到原值)。
  if (!second.valid) return { args, normalizedFields: [], result: first };
  return { args: repaired, normalizedFields: touched, result: second };
}

// ==================== 单行违规清单(进 tool_result 的那一形态)====================

/** 单行清单最多展开的违规条数,超出折叠为 `(+N more)` —— 违规行本身不能变成第二个大结果。 */
export const VALIDATION_LINE_MAX_ERRORS = 12;
/** 单段(expected/actual/field)的字符上限;actual 在 enum_mismatch 分支装的是模型自报原值,回灌给模型无隐私问题,但必须限界。 */
export const VALIDATION_LINE_MAX_SEGMENT_CHARS = 80;

/** 把任意描述压成行内安全片段:折行/制表归一为空格,超长截断。保证结果里绝不出现换行。 */
function toLineSegment(text: string): string {
  const flat = text.replace(/[\r\n\t]+/g, ' ').trim();
  if (flat.length <= VALIDATION_LINE_MAX_SEGMENT_CHARS) return flat;
  return `${flat.slice(0, VALIDATION_LINE_MAX_SEGMENT_CHARS - 3)}...`;
}

/**
 * ValidationError[] → **单行** ASCII 清单(tool_result 的 error 字段不能带换行;
 * 多行版 formatValidationErrors 保留给人读,两者是同一份 errors 的两个投影)。
 *
 * 例:`arg_validation_failed: payload=type_mismatch(expected=object; got=string) | todos[0].summary=enum_mismatch(expected=enum(a|b); got=x)`
 */
export function formatValidationErrorsLine(errors: readonly ValidationError[]): string {
  if (errors.length === 0) return 'arg_validation_failed';
  const shown = errors.slice(0, VALIDATION_LINE_MAX_ERRORS);
  const parts = shown.map(
    (e) =>
      `${toLineSegment(e.field)}=${e.reason}(expected=${toLineSegment(e.expected)}; got=${toLineSegment(String(e.actual))})`,
  );
  const tail = errors.length > shown.length ? ` (+${errors.length - shown.length} more)` : '';
  return `arg_validation_failed: ${parts.join(' | ')}${tail}`;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
