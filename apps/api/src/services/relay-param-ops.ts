/**
 * New API 独有差异化护城河:JSON DSL 级参数覆盖系统。
 *
 * 在请求转发前对 request body 做声明式参数改写:
 * - 15 种操作 mode(set/delete/move/append/prepend/copy/trim_prefix/trim_suffix/
 *   ensure_prefix/ensure_suffix/trim_space/to_lower/to_upper/replace/regex_replace)
 * - 条件判断(full/prefix/suffix/contains/gt/gte/lt/lte + invert + 多条件 AND/OR)
 * - JSON 路径语法(messages.0.role = messages[0].role)
 * - 内置变量(${model}/${upstream_model}/${original_model})
 *
 * 纯函数:深拷贝输入,不修改原对象;无效 op 静默跳过 + warn 日志,不阻塞主流程。
 *
 * 调用方:relay-channel-router.ts 在选定 key 后、转发前调用 applyParamOps。
 */
import { logger } from '../utils/logger.js'

// ============================================================================
// 类型定义
// ============================================================================

/** 条件匹配类型。 */
export type MatchType = 'full' | 'prefix' | 'suffix' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte'

/** 多条件逻辑运算。 */
export type ConditionLogic = 'and' | 'or'

/** 单个条件。 */
export interface ParamCondition {
  /** 目标路径(点分,如 model / messages.0.role)。 */
  path: string
  /** 匹配类型。 */
  match: MatchType
  /** 比较值(数值比较类用 number,其余用 string)。 */
  value?: unknown
  /** 条件取反(默认 false)。 */
  invert?: boolean
  /** path 不存在时是否通过(默认 false)。 */
  pass_missing_key?: boolean
}

/** 操作类型(15 种)。 */
export type OpType =
  | 'set'
  | 'delete'
  | 'move'
  | 'append'
  | 'prepend'
  | 'copy'
  | 'trim_prefix'
  | 'trim_suffix'
  | 'ensure_prefix'
  | 'ensure_suffix'
  | 'trim_space'
  | 'to_lower'
  | 'to_upper'
  | 'replace'
  | 'regex_replace'

/** 内置变量上下文。 */
export interface OpContext {
  /** 当前请求模型名。 */
  model?: string
  /** 映射后的上游模型名。 */
  upstream_model?: string
  /** 原始模型名(映射前)。 */
  original_model?: string
}

/** 单条参数操作。 */
export interface ParamOp {
  op: OpType
  /** 目标路径(move/copy 为目标路径)。 */
  path: string
  /** set/append/prepend 用值(支持 ${var} 变量替换)。 */
  value?: unknown
  /** move/copy 源路径。 */
  from?: string
  /** replace 查找子串。 */
  find?: string
  /** replace/regex_replace 替换字符串(支持 ${var})。 */
  replacement?: string
  /** regex_replace 正则模式(字符串形式)。 */
  pattern?: string
  /** regex_replace 正则 flags(默认 '')。 */
  flags?: string
  /** trim_prefix/ensure_prefix 前缀。 */
  prefix?: string
  /** trim_suffix/ensure_suffix 后缀。 */
  suffix?: string
  /** 条件列表。 */
  conditions?: ParamCondition[]
  /** 多条件逻辑(默认 and)。 */
  condition_logic?: ConditionLogic
}

/** applyParamOps 返回值。 */
export interface ApplyResult {
  modified: boolean
  request: Record<string, unknown>
}

/** validateParamOps 返回值。 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

// ============================================================================
// 常量
// ============================================================================

const VALID_OPS: ReadonlySet<string> = new Set<string>([
  'set',
  'delete',
  'move',
  'append',
  'prepend',
  'copy',
  'trim_prefix',
  'trim_suffix',
  'ensure_prefix',
  'ensure_suffix',
  'trim_space',
  'to_lower',
  'to_upper',
  'replace',
  'regex_replace',
])

const VALID_MATCHES: ReadonlySet<string> = new Set<string>([
  'full',
  'prefix',
  'suffix',
  'contains',
  'gt',
  'gte',
  'lt',
  'lte',
])

const NUMERIC_MATCHES: ReadonlySet<string> = new Set<string>(['gt', 'gte', 'lt', 'lte'])

// ============================================================================
// 类型守卫
// ============================================================================

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isContainer(v: unknown): v is Record<string, unknown> | unknown[] {
  return isPlainObject(v) || Array.isArray(v)
}

/**
 * 返回一个符合期望类型(数组/对象)的容器:
 * - existing 已是期望类型 → 原样复用(保留数据)
 * - 类型不符 / 不存在 → 新建空容器(类型冲突时丢弃旧值)
 */
function ensureContainer(
  existing: unknown,
  wantArray: boolean,
): Record<string, unknown> | unknown[] {
  if (wantArray) {
    return Array.isArray(existing) ? existing : []
  }
  return isPlainObject(existing) ? existing : {}
}

function isParamOp(v: unknown): v is ParamOp {
  if (!isPlainObject(v)) return false
  const o = v
  if (typeof o.op !== 'string' || !VALID_OPS.has(o.op)) return false
  if (typeof o.path !== 'string' || o.path === '') return false
  if (o.conditions !== undefined && !Array.isArray(o.conditions)) return false
  if (
    o.condition_logic !== undefined &&
    o.condition_logic !== 'and' &&
    o.condition_logic !== 'or'
  ) {
    return false
  }
  return true
}

// ============================================================================
// 内置变量替换
// ============================================================================

/**
 * 替换字符串中的内置变量 ${model}/${upstream_model}/${original_model}。
 * 仅对字符串值生效;非字符串原样返回。
 */
function substituteVars(val: unknown, ctx: OpContext): unknown {
  if (typeof val !== 'string') return val
  return val
    .replaceAll('${model}', ctx.model ?? '')
    .replaceAll('${upstream_model}', ctx.upstream_model ?? '')
    .replaceAll('${original_model}', ctx.original_model ?? '')
}

// ============================================================================
// JSON 路径工具(点分路径,数字段为数组索引)
// ============================================================================

/** 解析点分路径为段数组。messages.0.role -> ['messages', '0', 'role']。 */
function parsePath(path: string): string[] {
  if (path === '') return []
  return path.split('.')
}

/** 判断路径段是否为数组索引(纯非负整数)。 */
function isArrayIndex(seg: string): boolean {
  return /^\d+$/.test(seg)
}

/**
 * 按路径取值。
 * @returns found=false 表示路径不存在(中间节点类型不符或叶子 undefined)。
 */
function getPath(obj: unknown, path: string): { found: boolean; value: unknown } {
  const segs = parsePath(path)
  if (segs.length === 0) return { found: true, value: obj }
  let cur: unknown = obj
  for (const seg of segs) {
    if (cur === null || cur === undefined) return { found: false, value: undefined }
    if (isArrayIndex(seg)) {
      if (!Array.isArray(cur)) return { found: false, value: undefined }
      const idx = Number(seg)
      const v = cur[idx]
      if (v === undefined) return { found: false, value: undefined }
      cur = v
    } else {
      if (!isPlainObject(cur)) return { found: false, value: undefined }
      const v = cur[seg]
      if (v === undefined) return { found: false, value: undefined }
      cur = v
    }
  }
  return { found: true, value: cur }
}

/**
 * 按路径设值(自动创建中间对象/数组)。
 * 路径段为数字时按数组索引处理,自动填充占位 null 扩展数组。
 * @returns true 若成功设置;false 若路径中间节点类型不可恢复。
 */
function setPath(
  container: Record<string, unknown> | unknown[],
  segs: string[],
  value: unknown,
): boolean {
  if (segs.length === 0) return false
  const seg = segs[0]
  if (seg === undefined) return false
  const rest = segs.slice(1)

  if (rest.length === 0) {
    // 叶子节点
    if (isArrayIndex(seg)) {
      if (!Array.isArray(container)) return false
      const idx = Number(seg)
      while (container.length <= idx) container.push(null)
      container[idx] = value
      return true
    }
    if (!isPlainObject(container)) return false
    container[seg] = value
    return true
  }

  // 中间节点:根据下一段决定创建数组还是对象
  const nextSeg = rest[0]
  if (nextSeg === undefined) return false
  const wantArray = isArrayIndex(nextSeg)

  if (isArrayIndex(seg)) {
    if (!Array.isArray(container)) return false
    const idx = Number(seg)
    while (container.length <= idx) container.push({})
    const child = ensureContainer(container[idx], wantArray)
    container[idx] = child
    return setPath(child, rest, value)
  }

  if (!isPlainObject(container)) return false
  const child = ensureContainer(container[seg], wantArray)
  container[seg] = child
  return setPath(child, rest, value)
}

/**
 * 按路径删除节点。
 * - 对象键:delete key
 * - 数组索引:splice 移除元素并重排后续索引
 * @returns true 若实际删除了节点。
 */
function deletePath(container: Record<string, unknown> | unknown[], segs: string[]): boolean {
  if (segs.length === 0) return false
  const seg = segs[0]
  if (seg === undefined) return false
  const rest = segs.slice(1)

  if (rest.length === 0) {
    if (isArrayIndex(seg)) {
      if (!Array.isArray(container)) return false
      const idx = Number(seg)
      if (idx < container.length) {
        container.splice(idx, 1)
        return true
      }
      return false
    }
    if (!isPlainObject(container)) return false
    if (Object.prototype.hasOwnProperty.call(container, seg)) {
      delete container[seg]
      return true
    }
    return false
  }

  if (isArrayIndex(seg)) {
    if (!Array.isArray(container)) return false
    const idx = Number(seg)
    const child = container[idx]
    if (child === undefined || !isContainer(child)) return false
    return deletePath(child, rest)
  }
  if (!isPlainObject(container)) return false
  const child = container[seg]
  if (child === undefined || !isContainer(child)) return false
  return deletePath(child, rest)
}

// ============================================================================
// 条件求值
// ============================================================================

/** 单条件求值。 */
function evalCondition(cond: ParamCondition, obj: unknown): boolean {
  const { found, value } = getPath(obj, cond.path)
  if (!found) {
    return cond.pass_missing_key === true
  }

  const match = cond.match
  let result: boolean

  if (NUMERIC_MATCHES.has(match)) {
    const target = typeof cond.value === 'number' ? cond.value : Number(cond.value)
    const actual = typeof value === 'number' ? value : Number(value)
    if (Number.isNaN(target) || Number.isNaN(actual)) {
      result = false
    } else {
      switch (match) {
        case 'gt':
          result = actual > target
          break
        case 'gte':
          result = actual >= target
          break
        case 'lt':
          result = actual < target
          break
        case 'lte':
          result = actual <= target
          break
        default:
          result = false
      }
    }
  } else {
    const actualStr = typeof value === 'string' ? value : String(value)
    const expected = typeof cond.value === 'string' ? cond.value : String(cond.value)
    switch (match) {
      case 'full':
        result = actualStr === expected
        break
      case 'prefix':
        result = actualStr.startsWith(expected)
        break
      case 'suffix':
        result = actualStr.endsWith(expected)
        break
      case 'contains':
        result = actualStr.includes(expected)
        break
      default:
        result = false
    }
  }

  return cond.invert === true ? !result : result
}

/** 多条件求值(AND/OR),无条件时通过。 */
function evalConditions(op: ParamOp, obj: unknown): boolean {
  const conds = op.conditions
  if (!conds || conds.length === 0) return true
  const logic: ConditionLogic = op.condition_logic === 'or' ? 'or' : 'and'
  if (logic === 'or') {
    return conds.some((c) => evalCondition(c, obj))
  }
  return conds.every((c) => evalCondition(c, obj))
}

// ============================================================================
// 单 op 执行
// ============================================================================

/** 对字符串字段执行转换并写回。返回是否修改。 */
function mutateStringField(
  target: Record<string, unknown>,
  op: ParamOp,
  transform: (s: string) => string,
): boolean {
  const { found, value } = getPath(target, op.path)
  if (!found || typeof value !== 'string') return false
  const newVal = transform(value)
  if (newVal === value) return false
  return setPath(target, parsePath(op.path), newVal)
}

/** 执行单条 op(已通过条件检查)。返回是否产生修改。 */
function applyOp(target: Record<string, unknown>, op: ParamOp, ctx: OpContext): boolean {
  switch (op.op) {
    case 'set':
      return setPath(target, parsePath(op.path), substituteVars(op.value, ctx))

    case 'delete':
      return deletePath(target, parsePath(op.path))

    case 'move': {
      const src = op.from ?? ''
      const { found, value } = getPath(target, src)
      if (!found) return false
      if (!setPath(target, parsePath(op.path), value)) return false
      deletePath(target, parsePath(src))
      return true
    }

    case 'copy': {
      const src = op.from ?? ''
      const { found, value } = getPath(target, src)
      if (!found) return false
      return setPath(target, parsePath(op.path), value)
    }

    case 'append': {
      const { found, value: arr } = getPath(target, op.path)
      if (!found || !Array.isArray(arr)) return false
      arr.push(substituteVars(op.value, ctx))
      return true
    }

    case 'prepend': {
      const { found, value: arr } = getPath(target, op.path)
      if (!found || !Array.isArray(arr)) return false
      arr.unshift(substituteVars(op.value, ctx))
      return true
    }

    case 'trim_prefix':
      return mutateStringField(target, op, (s) => {
        const p = op.prefix ?? ''
        return p && s.startsWith(p) ? s.slice(p.length) : s
      })

    case 'trim_suffix':
      return mutateStringField(target, op, (s) => {
        const suf = op.suffix ?? ''
        return suf && s.endsWith(suf) ? s.slice(0, -suf.length) : s
      })

    case 'ensure_prefix':
      return mutateStringField(target, op, (s) => {
        const p = op.prefix ?? ''
        return p && !s.startsWith(p) ? p + s : s
      })

    case 'ensure_suffix':
      return mutateStringField(target, op, (s) => {
        const suf = op.suffix ?? ''
        return suf && !s.endsWith(suf) ? s + suf : s
      })

    case 'trim_space':
      return mutateStringField(target, op, (s) => s.trim())

    case 'to_lower':
      return mutateStringField(target, op, (s) => s.toLowerCase())

    case 'to_upper':
      return mutateStringField(target, op, (s) => s.toUpperCase())

    case 'replace':
      return mutateStringField(target, op, (s) => {
        const find = op.find ?? ''
        if (find === '') return s
        return s.replaceAll(find, op.replacement ?? '')
      })

    case 'regex_replace':
      return mutateStringField(target, op, (s) => {
        const pattern = op.pattern ?? ''
        const flags = op.flags ?? ''
        try {
          const re = new RegExp(pattern, flags)
          return s.replace(re, op.replacement ?? '')
        } catch {
          logger.warn('relay-param-ops: invalid regex pattern', {
            op: 'regex_replace',
            path: op.path,
            pattern,
          })
          return s
        }
      })

    default:
      return false
  }
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 对 request 应用一组参数操作。
 *
 * 深拷贝输入后逐条执行 op;无效 op 静默跳过 + warn 日志,不阻塞主流程。
 * 任一 op 执行抛错被捕获并 warn,继续后续 op。
 *
 * @param request 原始请求体(不会被修改)
 * @param ops 参数操作列表
 * @param context 内置变量上下文
 * @returns { modified, request }(request 为修改后的新对象)
 */
export function applyParamOps(
  request: Record<string, unknown>,
  ops: ParamOp[],
  context: OpContext,
): ApplyResult {
  const target: Record<string, unknown> = structuredClone(request)
  let modified = false

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]
    if (op === undefined) continue
    if (!isParamOp(op)) {
      logger.warn('relay-param-ops: invalid op shape, skipped', { index: i })
      continue
    }
    try {
      if (!evalConditions(op, target)) continue
      if (applyOp(target, op, context)) modified = true
    } catch (e) {
      logger.warn('relay-param-ops: op execution error, skipped', {
        index: i,
        op: op.op,
        path: op.path,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return { modified, request: target }
}

/**
 * 校验 ops 配置(不执行)。
 *
 * 检查项:数组结构、op 合法性、必填字段(move/copy 的 from、replace 的 find、
 * regex_replace 的 pattern 及可编译性、trim/ensure 的 prefix/suffix)、
 * conditions 结构与 match 合法性、condition_logic 合法性。
 *
 * @param ops 任意输入(通常是 DB/JSON 解析结果)
 * @returns { valid, errors }(valid=true 时 errors 为空)
 */
export function validateParamOps(ops: unknown): ValidationResult {
  const errors: string[] = []

  if (!Array.isArray(ops)) {
    return { valid: false, errors: ['ops must be an array'] }
  }

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]
    const at = `ops[${i}]`
    if (!isPlainObject(op)) {
      errors.push(`${at}: must be an object`)
      continue
    }
    const o = op

    if (typeof o.op !== 'string') {
      errors.push(`${at}: op must be a string`)
      continue
    }
    if (!VALID_OPS.has(o.op)) {
      errors.push(`${at}: unknown op "${o.op}"`)
      continue
    }
    if (typeof o.path !== 'string' || o.path === '') {
      errors.push(`${at}: path must be a non-empty string`)
    }

    // move/copy 需要 from
    if ((o.op === 'move' || o.op === 'copy') && (typeof o.from !== 'string' || o.from === '')) {
      errors.push(`${at}: ${o.op} requires non-empty "from"`)
    }

    // replace 需要 find
    if (o.op === 'replace' && typeof o.find !== 'string') {
      errors.push(`${at}: replace requires "find" string`)
    }

    // trim_prefix/ensure_prefix 需要 prefix
    if ((o.op === 'trim_prefix' || o.op === 'ensure_prefix') && typeof o.prefix !== 'string') {
      errors.push(`${at}: ${o.op} requires "prefix" string`)
    }

    // trim_suffix/ensure_suffix 需要 suffix
    if ((o.op === 'trim_suffix' || o.op === 'ensure_suffix') && typeof o.suffix !== 'string') {
      errors.push(`${at}: ${o.op} requires "suffix" string`)
    }

    // regex_replace 需要 pattern 且可编译
    if (o.op === 'regex_replace') {
      if (typeof o.pattern !== 'string') {
        errors.push(`${at}: regex_replace requires "pattern" string`)
      } else {
        const flags = typeof o.flags === 'string' ? o.flags : ''
        try {
          new RegExp(o.pattern, flags)
        } catch (e) {
          errors.push(
            `${at}: invalid regex pattern "${o.pattern}": ${e instanceof Error ? e.message : String(e)}`,
          )
        }
      }
    }

    // condition_logic
    if (
      o.condition_logic !== undefined &&
      o.condition_logic !== 'and' &&
      o.condition_logic !== 'or'
    ) {
      errors.push(`${at}: condition_logic must be "and" or "or"`)
    }

    // conditions 结构
    if (o.conditions !== undefined) {
      if (!Array.isArray(o.conditions)) {
        errors.push(`${at}: conditions must be an array`)
      } else {
        for (let ci = 0; ci < o.conditions.length; ci++) {
          const c = o.conditions[ci]
          const cat = `${at}.conditions[${ci}]`
          if (!isPlainObject(c)) {
            errors.push(`${cat}: must be an object`)
            continue
          }
          if (typeof c.path !== 'string' || c.path === '') {
            errors.push(`${cat}: path must be a non-empty string`)
          }
          if (typeof c.match !== 'string' || !VALID_MATCHES.has(c.match)) {
            errors.push(`${cat}: invalid match "${String(c.match)}"`)
          }
          if (c.invert !== undefined && typeof c.invert !== 'boolean') {
            errors.push(`${cat}: invert must be boolean`)
          }
          if (c.pass_missing_key !== undefined && typeof c.pass_missing_key !== 'boolean') {
            errors.push(`${cat}: pass_missing_key must be boolean`)
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
