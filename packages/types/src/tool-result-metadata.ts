// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 落库工具结果元数据的版本化契约面(G-719,2026-10-03 立)。
 *
 * 防的形态(上游 contracts/src/tools/tool-result-metadata.ts:18-44,204-222,295-334):
 *   落库 payload 没有版本标签 ⇒ 任何字段撤回只能靠"旧数据恰好还能 parse"活着;
 *   内层不 strict ⇒ 多一键整块进来;外层不 passthrough ⇒ 新增顶层字段旧客户端直接炸。
 *
 * 三件必须一起抄(上游同款,缺一即退化):
 *   ① `schemaVersion: z.literal(1)` —— 版本号必须有消费者:唯一水合入口
 *      (apps/cli 的 tool-part-hydration)按它分账,未知版本按"旧客户端口径"剥
 *      display 保外层,不是"有版本没人判"的空支票;
 *   ② 内层 display payload `.strict()` / 最外层 `.passthrough()` —— 新增顶层字段
 *      旧客户端可忽略,内层多一键整块拒(形状是契约);
 *   ③ 已撤销字段在唯一卡点读前剥离(`scrubToolDisplayRevokedKeys`,判据与
 *      api-contracts.scrubRevokedKeys 同一份语义:只改在场的键、不给缺席字段凭空补
 *      `undefined`),scrub 之后才进 strict,两步成对。
 *
 * 家法同 `api-contracts.ts` 的跨边界载荷节:本文件对"纯类型无运行时"的显式豁免同款 ——
 * 判据必须单点(schema 即唯一真相)。
 */
import { z } from 'zod'
import { scrubRevokedKeys, type RevokedKeysByKind } from './api-contracts.js'

/** 当前落库版本。只增不改;历史 payload 靠 literal 校验 + 水合入口分账兜住。 */
export const TOOL_RESULT_METADATA_SCHEMA_VERSION = 1

/**
 * display payload 的 kind 词表(内层判别键)。新增 kind 只许追加,不许改写既有取值 ——
 * 严格校验下改写等于把历史 payload 整块判死。
 */
export const TOOL_DISPLAY_KINDS = ['text', 'rows'] as const

/**
 * 内层 display payload:`.strict()` —— 内层多一键整块拒。
 * 新增字段一律 optional(历史载荷继续可读)。
 */
export const ToolResultDisplayPayloadSchema = z.strictObject({
  kind: z.enum(TOOL_DISPLAY_KINDS),
  text: z.string().optional(),
  rows: z.array(z.record(z.string(), z.unknown())).optional(),
})

export type ToolResultDisplayPayload = z.infer<typeof ToolResultDisplayPayloadSchema>

/**
 * 最外层元数据:`.passthrough()` —— 新增顶层字段旧客户端可忽略。
 * `schemaVersion` 是 literal:版本消费者(唯一水合入口)据此分账。
 */
export const ToolResultMetadataSchema = z
  .object({
    schemaVersion: z.literal(TOOL_RESULT_METADATA_SCHEMA_VERSION),
    toolCallId: z.string().min(1),
    toolName: z.string().min(1),
    display: ToolResultDisplayPayloadSchema,
  })
  .passthrough()

export type ToolResultMetadata = z.infer<typeof ToolResultMetadataSchema>

/**
 * 已撤销 display 字段注册表(kind → 该 kind 下历史载荷可能还带着的键)。
 * 刻意从空表起步:本仓尚无历史 display payload,第一条撤销登记发生在第一次真的
 * 撤字段时 —— 预填一条没人写过的键才是"凭空造债"。
 */
export const TOOL_RESULT_DISPLAY_REVOKED_KEYS: RevokedKeysByKind = {}

/**
 * 唯一剥离卡点:display 的已撤销键在**解析前**剥(只改在场的键,缺席键绝不补
 * `undefined` —— 不给缺席的字段凭空造一个 undefined,注释与上游逐字同义)。
 * 入参会被就地修改;scrub 之后才进 strict,两步成对。
 * `revokedByKind` 是测试注入缝(缺省 = 生产注册表;镜像测试注入临时登记,
 * 不得在测试里抄第二份剥除判据 —— §22c)。
 */
export function scrubToolDisplayRevokedKeys(
  input: Record<string, unknown>,
  revokedByKind: RevokedKeysByKind = TOOL_RESULT_DISPLAY_REVOKED_KEYS,
): Record<string, unknown> {
  const kind = input['kind']
  if (typeof kind !== 'string') return input
  return scrubRevokedKeys(input, 'kind', revokedByKind)
}

export type ToolResultMetadataParseResult =
  { success: true; data: ToolResultMetadata } | { success: false; issues: readonly string[] }

function metadataIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`)
}

/**
 * 包络 safeParse:唯一入口 —— 先剥(display 卡点)再 strict/literal;不抛错,
 * 把逐条判据交回调用方裁决。内层多一键 ⇒ issues 点名该路径(整块拒);
 * 顶层多一键 ⇒ passthrough 保留(出现在 data 里)。
 */
export function safeParseToolResultMetadata(input: unknown): ToolResultMetadataParseResult {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { success: false, issues: [`载荷不是对象: ${typeof input}`] }
  }
  const display = (input as Record<string, unknown>)['display']
  if (display !== null && typeof display === 'object' && !Array.isArray(display)) {
    scrubToolDisplayRevokedKeys(display as Record<string, unknown>)
  }
  const result = ToolResultMetadataSchema.safeParse(input)
  if (result.success) return { success: true, data: result.data }
  return { success: false, issues: metadataIssues(result.error) }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
