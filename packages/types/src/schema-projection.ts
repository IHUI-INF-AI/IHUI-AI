// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 运行时校验器 → provider 可见 JSON Schema 的单点投影(A13 第一阶段,2026-09-25 立)。
//
// 目的(上游这条纪律值得照抄):**让"运行时怎么校验"与"模型被告知怎么填"不可能分叉**。
// 此前本仓发给 provider 的 function parameters 由 apps/cli/src/tools/index.ts 的
// `toJsonProperty` 手搓,而校验由 apps/cli/src/tools/argument-validator.ts 读同一份描述,
// 两处各写一遍 ⇒ 只能靠人记得两边都改。本文件把产出模型可见面这件事收成一处:
// 调用方不得再手搓 `parameters` 的 JSON Schema 形态。
//
// 零新依赖:AGENTS §12e 与守门 78 记的代价是"加依赖会把约 110 道门换成静默失效",
// 而本项目只需要覆盖四类归一化动作(见 `normalizeProviderSchema`),手写窄归一化器即可。
//
// 等价性约束(硬门槛):投影结果与今日 provider 已接受的形态必须逐工具键集合相等 ——
// 不得新增/删除/改名任何 property,不得改动 required 集合。回归表现为"模型突然不会填参数"
// (不报错,只会填错),所以证明只能是**同瞬间 A/B**,不是"跑绿了"。

import type { ProviderJsonSchema, ToolShapeDescriptor } from './tool-contract.js'

/** 归一化过程中"引用类"记账键:它们只服务于解析器,provider 侧无意义。 */
const REFERENCE_BOOKKEEPING_KEYS = [
  '$schema',
  '$id',
  '$anchor',
  '$comment',
  '$defs',
  'definitions',
] as const

/** 引用类关键字中需要解析才能保留语义的那一个:剥它必须有 resolver,否则只能如实报数。 */
const REFERENCE_POINTER_KEY = '$ref'

/**
 * 发射子集 == 校验子集 的单一词汇表(b76-05 票2,2026-09-30 立)。
 *
 * 上游教训原文:"另建一个平行的检查器,等于开始维护第二份真相——而两份真相分歧的
 * 那天,只会在某个 run 的 Results 面板上显示成一个 `{}`"。本表因此是**唯一一份**:
 * 描述符侧(发射器输入)允许出现的键与投影输出侧(校验器/provider 消费)允许出现的键
 * 都以它为准 —— 分成两张表的那天,就会出现"校验器读不懂而模型被告知了"的键。
 *
 * 刻意**不含** `anyOf`/`oneOf`/`$ref`/`$defs` 等:它们只允许出现在
 * `normalizeProviderSchema` 的**任意来源**入口(那里有折叠/解析/记账语义),
 * 不得出现在手写描述符与投影输出上 —— 严格投影(`projectToolInputSchemaStrict`)
 * 遇到词汇表外的键一律抛 `ToolSchemaProjectionError`(带 `$.properties.x` 路径),
 * **拒绝 + 定位**,不做静默归一化。
 */
export const SCHEMA_PROJECTION_VOCABULARY = [
  'type',
  'description',
  'enum',
  'items',
  'properties',
  'required',
  'additionalProperties',
  'minimum',
  'maximum',
  'minLength',
  'maxLength',
  'pattern',
] as const

export type SchemaProjectionVocabularyKey = (typeof SCHEMA_PROJECTION_VOCABULARY)[number]

const VOCABULARY_SET: ReadonlySet<string> = new Set<string>(SCHEMA_PROJECTION_VOCABULARY)

/** 字段级 typed fault 的稳定码:判定侧只认这个字符串,不认 message 文本。 */
export const TOOL_SCHEMA_PROJECTION_FAULT_CODE = 'fault.toolSchema.projectionRejected' as const

/** 一次投影拒绝:JSON 路径(`$.properties.x` 形式)+ 稳定码 + 一行原因。 */
export interface SchemaRejection {
  readonly path: string
  readonly code: typeof TOOL_SCHEMA_PROJECTION_FAULT_CODE
  readonly reason: string
}

/**
 * 严格投影的拒绝通道(b76-05 票2):描述符携带投影器无法解释的构造时,
 * **定位到路径**抛出,而不是静默归一化 —— "尽力归一化"遇到的每个不认识的构造,
 * 都是一次"两份真相开始分叉"的现场。
 */
export class ToolSchemaProjectionError extends Error {
  readonly path: string
  readonly code: typeof TOOL_SCHEMA_PROJECTION_FAULT_CODE
  readonly reason: string

  constructor(rejection: SchemaRejection) {
    super(`[tool-schema-projection] ${rejection.path}: ${rejection.reason}`)
    this.name = 'ToolSchemaProjectionError'
    this.path = rejection.path
    this.code = rejection.code
    this.reason = rejection.reason
  }
}

/**
 * 确定性序列化(b76-05 票2 (c)):键序按字典序递归排序,同一结构永远逐字节同串。
 *
 * 为什么住在投影器同一文件:工具块是 prompt-cache 前缀的第一段
 * (ai-service anthropic_provider.py 的 cache_control 挂在 last_tool 上),
 * 前缀稳定性要求"同一个工具描述符永远产出同一段字节",而 `Object.keys` 的
 * 插入顺序或宿主差异都可能让前缀漂移。全仓另有 run-idempotency.ts /
 * knowledge-team-service.ts 两处**私有**同型实现,消费场景不同暂不合并;
 * 工具 schema 域内只认这一份,不得在别处再抄第三个。
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
    .join(',')}}`
}

/** 按约束反推 type 的依据:出现这些关键字 ⇒ 该节点必然是这一族。 */
const OBJECT_ONLY_KEYS = [
  'properties',
  'required',
  'additionalProperties',
  'patternProperties',
] as const
const ARRAY_ONLY_KEYS = ['items', 'prefixItems', 'contains'] as const
const STRING_ONLY_KEYS = ['minLength', 'maxLength', 'pattern', 'format'] as const
const NUMBER_ONLY_KEYS = [
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
] as const

/** 投影过程的可观测账本:任何"判不出/折不动"都必须在这里留下数字,不得静默。 */
export interface ProjectionAccount {
  /** 剥掉的引用记账键数($schema/$defs/definitions 等) */
  bookkeepingRefs: number
  /** 出现 `$ref` 但没有 resolver 可解析的节点数(形状被放宽,调用方必须知情) */
  unresolvedRefs: number
  /** 成功折成单一形态的 anyOf/oneOf 数 */
  foldedCombinators: number
  /** 折不动(成员类型不一致且非 nullable)的组合器数:原样保留并如实报数 */
  unfoldedCombinators: number
  /** 按约束反推出 type 的节点数 */
  inferredTypes: number
  /** 给"任意键值的对象"补上值类型(`additionalProperties` 缺 `type`)的次数 */
  keyTypesAdded: number
  /** 形状描述符声明为 `unknown` 因而**不**写出 type 键的节点数 */
  typelessNodes: number
}

export function createProjectionAccount(): ProjectionAccount {
  return {
    bookkeepingRefs: 0,
    unresolvedRefs: 0,
    foldedCombinators: 0,
    unfoldedCombinators: 0,
    inferredTypes: 0,
    keyTypesAdded: 0,
    typelessNodes: 0,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** anyOf / oneOf 的成员里是否只有 `{type:'null'}` 这一档"可空"表达。 */
function isNullOnlyMember(member: unknown): boolean {
  return isRecord(member) && member.type === 'null' && Object.keys(member).length === 1
}

/** 成员是否除 type 外只有 enum(同型 + enum 并集 ⇒ 可折)。 */
function isTypeAndEnumOnly(member: unknown): member is { type: unknown; enum: unknown } {
  return isRecord(member) && typeof member.type === 'string' && 'enum' in member
}

/**
 * 归一化:把任意来源的 JSON Schema 节点收成 provider 能接受的单一形态。
 *
 * 覆盖且只覆盖四类动作(票面口径):
 * 1. 剥引用类关键字 —— 记账键直接删;`$ref` 有 resolver 才解析,没有则**放宽并计入账本**。
 * 2. 把"任一选一"(anyOf/oneOf)折成单一形态 —— 只折两种机械可证的情形:
 *    成员同 `type`(enum 取并集)、以及 Zod 式可空(`X | null`,唯一非 null 成员即答案)。
 *    其余一律原样保留并计入 `unfoldedCombinators`(宁可不折,绝不猜一个成员代表全体)。
 * 3. 按约束反推缺失的 `type`(properties/required ⇒ object,items ⇒ array,minLength/pattern ⇒ string,
 *    minimum/multipleOf ⇒ number;enum 全体同型也可推)。
 * 4. 给"任意键值的对象"补键类型:`additionalProperties` 是对象却缺 `type` ⇒ 值类型按 `string` 补
 *    (provider 要求键类型可枚举;真实约束更宽时由调用方显式声明,不靠本函数猜)。
 */
export function normalizeProviderSchema(
  node: unknown,
  account: ProjectionAccount = createProjectionAccount(),
  resolveRef?: (ref: string) => unknown,
): Record<string, unknown> {
  if (Array.isArray(node)) {
    return Object.fromEntries(
      node.map((item, i) => [String(i), normalizeProviderSchema(item, account, resolveRef)]),
    )
  }
  if (!isRecord(node)) return {}

  // —— 第 1 步:引用类关键字 ————————————————————————————————
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node)) {
    if ((REFERENCE_BOOKKEEPING_KEYS as readonly string[]).includes(key)) {
      account.bookkeepingRefs += 1
      continue
    }
    if (key === REFERENCE_POINTER_KEY) {
      const resolved = typeof value === 'string' && resolveRef ? resolveRef(value) : undefined
      if (resolved === undefined) {
        account.unresolvedRefs += 1 // 形状被放宽:账本里可见,不静默
        continue
      }
      Object.assign(out, normalizeProviderSchema(resolved, account, resolveRef))
      continue
    }
    out[key] = value
  }

  // —— 第 2 步:任一选一折成单一形态 ——————————————————————————
  for (const combinator of ['anyOf', 'oneOf'] as const) {
    const members = out[combinator]
    if (!Array.isArray(members)) continue
    delete out[combinator]
    const nonNull = members.filter((m) => !isNullOnlyMember(m))
    if (nonNull.length === 1 && isRecord(nonNull[0])) {
      // 可空折叠只补本节点没有的键:已有 `type` 时不得被成员反向覆盖
      const folded = normalizeProviderSchema(nonNull[0], account, resolveRef)
      for (const [k, v] of Object.entries(folded)) if (!(k in out)) out[k] = v
      account.foldedCombinators += 1
      continue
    }
    const types = new Set(
      nonNull.map((m) => (isRecord(m) ? m.type : undefined)).filter((t) => typeof t === 'string'),
    )
    if (nonNull.length >= 2 && types.size === 1 && nonNull.every(isTypeAndEnumOnly)) {
      const merged: unknown[] = []
      for (const m of nonNull) merged.push(...((m as { enum: unknown }).enum as unknown[]))
      if (typeof out.type !== 'string') out.type = [...types][0]
      out.enum = [...new Set(merged)]
      account.foldedCombinators += 1
      continue
    }
    account.unfoldedCombinators += 1
    out[combinator] = members.map((m) => normalizeProviderSchema(m, account, resolveRef))
  }

  // 递归进子节点(properties / items / additionalProperties / patternProperties)
  if (isRecord(out.properties)) {
    const props: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(out.properties))
      props[k] = normalizeProviderSchema(v, account, resolveRef)
    out.properties = props
  }
  if (isRecord(out.items)) out.items = normalizeProviderSchema(out.items, account, resolveRef)
  if (isRecord(out.additionalProperties)) {
    const before = Object.keys(out.additionalProperties).length
    const ap = normalizeProviderSchema(out.additionalProperties, account, resolveRef)
    // —— 第 4 步:任意键值的对象补键类型(空对象 = 值未约束)——————
    if (before > 0 && Object.keys(ap).length === 0) {
      ap.type = 'string'
      account.keyTypesAdded += 1
    }
    out.additionalProperties = ap
  }
  if (
    out.type === 'object' &&
    isRecord(out.additionalProperties) &&
    !('type' in out.additionalProperties)
  ) {
    out.additionalProperties = { ...out.additionalProperties, type: 'string' }
    account.keyTypesAdded += 1
  }

  // —— 第 3 步:按约束反推缺失 type ————————————————————————————
  if (typeof out.type !== 'string') {
    const has = (group: readonly string[]) => group.some((k) => k in out)
    let inferred: string | null = null
    if (has(OBJECT_ONLY_KEYS)) inferred = 'object'
    else if (has(ARRAY_ONLY_KEYS)) inferred = 'array'
    else if (has(STRING_ONLY_KEYS)) inferred = 'string'
    else if (has(NUMBER_ONLY_KEYS)) inferred = 'number'
    else if (Array.isArray(out.enum) && out.enum.length > 0) {
      const memberTypes = new Set(out.enum.map((v) => (v === null ? 'null' : typeof v)))
      if (memberTypes.size === 1) inferred = [...memberTypes][0] as string
    }
    if (inferred) {
      out.type = inferred
      account.inferredTypes += 1
    }
  }

  return out
}

/**
 * 形状描述符 → provider 可见 JSON Schema(单向,唯一出口)。
 *
 * 输出的键序与今日 `toJsonProperty` 一致(type → description → enum → items → properties → required),
 * 以便 A/B 时除"值缺席"外无字节漂移;`description` 缺席时不写该键(今日写 `undefined`,
 * 经 JSON 序列化后两者在**线字节**上完全相同,故不构成 provider 可见形态变更)。
 */
export function projectShapeDescriptor(
  descriptor: ToolShapeDescriptor,
  account: ProjectionAccount = createProjectionAccount(),
): ProviderJsonSchema {
  const out: Record<string, unknown> = {}
  if (descriptor.type === 'unknown') {
    account.typelessNodes += 1 // 不做类型断言:写出 type:'unknown' 会被 provider 拒
  } else {
    out.type = descriptor.type
  }
  if (descriptor.description !== undefined) out.description = descriptor.description
  if (descriptor.enum) out.enum = [...descriptor.enum]
  if (descriptor.items) out.items = projectShapeDescriptor(descriptor.items, account)
  if (descriptor.properties) {
    const props: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(descriptor.properties)) {
      props[key] = projectShapeDescriptor(child, account)
    }
    out.properties = props
  }
  if (descriptor.required) out.required = [...descriptor.required]
  if (descriptor.additionalProperties !== undefined) {
    out.additionalProperties =
      descriptor.additionalProperties === true || descriptor.additionalProperties === false
        ? descriptor.additionalProperties
        : projectShapeDescriptor(descriptor.additionalProperties, account)
  }
  for (const key of ['minimum', 'maximum', 'minLength', 'maxLength', 'pattern'] as const) {
    const value = descriptor[key]
    if (value !== undefined) out[key] = value
  }
  return normalizeProviderSchema(out, account)
}

/**
 * 一份工具入参描述(`parameters` 映射 + `required` 清单)→ provider 可见的 object schema。
 *
 * 这是"模型被告知怎么填"的唯一出口:与校验面读同一份描述,因此两侧不可能分叉。
 * 属性名集合与 `required` 集合按构造等于输入(`Object.keys` 原样搬),
 * 任何不等都意味着调用方在投影之外改了对象 —— 由守门与 A/B 脚本拦。
 */
export function projectToolInputSchema(
  parameters: Record<string, ToolShapeDescriptor>,
  required: readonly string[],
  account: ProjectionAccount = createProjectionAccount(),
): { type: 'object'; properties: Record<string, ProviderJsonSchema>; required: string[] } {
  const properties: Record<string, ProviderJsonSchema> = {}
  for (const [name, descriptor] of Object.entries(parameters)) {
    properties[name] = projectShapeDescriptor(descriptor, account)
  }
  return { type: 'object', properties, required: [...required] }
}

// ============================================================================
// 严格投影(拒绝 + 定位通道)与 canonical 形态(b76-05 票2)
// ============================================================================

/** 词汇表审计:描述符(或其任意子节点)出现词汇表外的键 ⇒ 带 JSON 路径抛出。 */
function assertVocabulary(descriptor: ToolShapeDescriptor, path: string): void {
  for (const key of Object.keys(descriptor)) {
    if (!VOCABULARY_SET.has(key)) {
      throw new ToolSchemaProjectionError({
        path,
        code: TOOL_SCHEMA_PROJECTION_FAULT_CODE,
        reason:
          `unrecognized keyword '${key}' — 投影器无法解释该构造,宁拒不做静默归一化` +
          (`$ref` === key ? '(依赖 $ref 而无 resolver 的描述符必须先内联展开或补 resolver)' : ''),
      })
    }
  }
  if (descriptor.items) assertVocabulary(descriptor.items, `${path}.items`)
  if (descriptor.properties) {
    for (const [name, child] of Object.entries(descriptor.properties)) {
      assertVocabulary(child, `${path}.properties.${name}`)
    }
  }
  const ap = descriptor.additionalProperties
  if (ap !== undefined && typeof ap === 'object') {
    assertVocabulary(ap, `${path}.additionalProperties`)
  }
}

/** 投影输出反查:输出侧不得出现词汇表之外的键(发射子集 == 校验子集的运行时证明)。
 * 注意 `properties` / `patternProperties` 是"属性名 → 子 schema"的映射:映射的键是
 * **属性名**而不是 schema 关键字,不得对它做词汇表检查,只递归进它的值。 */
function assertOutputVocabulary(node: unknown, path: string): void {
  if (Array.isArray(node)) {
    node.forEach((item, i) => assertOutputVocabulary(item, `${path}[${i}]`))
    return
  }
  if (!isRecord(node)) return
  for (const [key, value] of Object.entries(node)) {
    if (key === 'properties' || key === 'patternProperties') {
      if (isRecord(value)) {
        for (const [name, child] of Object.entries(value)) {
          assertOutputVocabulary(child, `${path}.${key}.${name}`)
        }
        continue
      }
    }
    if (!VOCABULARY_SET.has(key)) {
      throw new ToolSchemaProjectionError({
        path: `${path}.${key}`,
        code: TOOL_SCHEMA_PROJECTION_FAULT_CODE,
        reason: `projected output carries key '${key}' outside the emit/validate vocabulary`,
      })
    }
    assertOutputVocabulary(value, `${path}.${key}`)
  }
}

/**
 * 严格投影单个描述符:先词汇表审计(拒绝 + 定位),再走**同一个**发射器
 * `projectShapeDescriptor`(刻意不另建第二份发射器 —— 那等于开始维护第二份真相),
 * 最后对输出做词汇表反查。任何一环无法解释 ⇒ `ToolSchemaProjectionError`。
 */
export function projectShapeDescriptorStrict(
  descriptor: ToolShapeDescriptor,
  account: ProjectionAccount = createProjectionAccount(),
): ProviderJsonSchema {
  assertVocabulary(descriptor, '$')
  const projected = projectShapeDescriptor(descriptor, account)
  assertOutputVocabulary(projected, '$')
  return projected
}

/**
 * 严格投影一份工具入参描述(与 `projectToolInputSchema` 同源,多两道闸):
 * 输入侧逐节点词汇表审计(`$.properties.x` 路径直达违规键)+ 输出侧反查。
 * `$ref` 依赖 resolver 的描述符在这里**如实报数**(抛错并列路径),无处可查的旧状不再存在。
 */
export function projectToolInputSchemaStrict(
  parameters: Record<string, ToolShapeDescriptor>,
  required: readonly string[],
  account: ProjectionAccount = createProjectionAccount(),
): { type: 'object'; properties: Record<string, ProviderJsonSchema>; required: string[] } {
  for (const [name, descriptor] of Object.entries(parameters)) {
    assertVocabulary(descriptor, `$.properties.${name}`)
  }
  const projected = projectToolInputSchema(parameters, required, account)
  for (const [name, node] of Object.entries(projected.properties)) {
    assertOutputVocabulary(node, `$.properties.${name}`)
  }
  return projected
}

/**
 * canonical 形态:严格投影后把键序**递归排成字典序**。
 *
 * 与 `projectToolInputSchema`(生产出口)刻意分开:生产出口的键序与今日 provider
 * 已接受形态逐字节兼容(a13 等价性测试钉着线字节),canonical 形态服务
 * prompt-cache 前缀稳定性 —— 两者键集合相等,只有键序不同;接缓存前缀的那一票
 * 切换出口时只需换调本函数,判据已在守门里跑通。
 */
export function projectToolInputSchemaCanonical(
  parameters: Record<string, ToolShapeDescriptor>,
  required: readonly string[],
  account: ProjectionAccount = createProjectionAccount(),
): { type: 'object'; properties: Record<string, ProviderJsonSchema>; required: string[] } {
  const projected = projectToolInputSchemaStrict(parameters, required, account)
  return JSON.parse(canonicalJson(projected)) as typeof projected
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
