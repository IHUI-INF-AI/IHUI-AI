// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WATERMARK-PLACEHOLDER(本行由 scripts/watermark.mjs inject 替换为横幅)
 */

/**
 * G3 Beyond-Coding 泛化(2026-10-30 立):统一 Artifact 交付物类型层。
 *
 * 定位:对话产物从"只有代码/文本"泛化为可交付 html_report | slides | sheet |
 * doc | video_ref 五类交付物,带版本与源转录锚点(turn_anchor),可导出。
 * 本模块是**纯类型 + zod 校验 + 纯函数渲染**(零 DOM / 零平台 API),
 * ai-service(经工具面)、apps/api(经导出端点)、web/移动端(经产物中心 UI)
 * 共用同一份定义,禁止各端另抄一份。
 *
 * 命名说明:kind 联合类型取名 `DeliverableKind` 而非 `ArtifactKind` —— 后者已被
 * `chat/artifact-turn.ts`(D76 产物归属 turn 派生层,文件扩展名分型)占用并从
 * 包根导出;两者语义不同族(那是渲染分型,这是交付物种类),各自唯一,不互相覆盖。
 */

import { z } from 'zod'

// ------------------------------------------------------------------ kind ----

/** 交付物五型(与 apps/ai-service create_artifact 工具白名单逐字一致)。 */
export const DELIVERABLE_ARTIFACT_KINDS = [
  'html_report',
  'slides',
  'sheet',
  'doc',
  'video_ref',
] as const

export type DeliverableKind = (typeof DELIVERABLE_ARTIFACT_KINDS)[number]

/** 产物状态:草稿 / 定稿(更新即 version+1,旧版 payload 保留)。 */
export const ARTIFACT_STATUSES = ['draft', 'final'] as const

export type ArtifactStatus = (typeof ARTIFACT_STATUSES)[number]

/** kind → payload 落盘扩展名(与 ai-service 工具面同一张表,改动必须两侧同步)。 */
export const ARTIFACT_EXT_BY_KIND: Readonly<Record<DeliverableKind, string>> = {
  html_report: 'html',
  slides: 'json',
  sheet: 'json',
  doc: 'md',
  video_ref: 'json',
}

/** kind → MIME(下载端点 Content-Type 与元数据 mime 字段的唯一词表)。 */
export const ARTIFACT_MIME_BY_KIND: Readonly<Record<DeliverableKind, string>> = {
  html_report: 'text/html; charset=utf-8',
  slides: 'application/json',
  sheet: 'application/json',
  doc: 'text/markdown; charset=utf-8',
  video_ref: 'application/json',
}

// ----------------------------------------------------------- payload 结构 ----

/** slides 演示稿:deck JSON(slides:[{title,bullets[],notes?}])。 */
export const slidesDeckSchema = z.object({
  slides: z
    .array(
      z.object({
        title: z.string(),
        bullets: z.array(z.string()),
        notes: z.string().optional(),
      }),
    )
    .min(1, 'slides 至少一页'),
})
export type SlidesDeck = z.infer<typeof slidesDeckSchema>

/** sheet 单元格:字符串 / 数字 / 空。 */
export const sheetCellSchema = z.union([z.string(), z.number(), z.null()])
export type SheetCell = z.infer<typeof sheetCellSchema>

/** sheet 电子表格:列名 + 行数组(每行长度应与 columns 一致,渲染层按列名对齐)。 */
export const sheetPayloadSchema = z.object({
  columns: z.array(z.string()).min(1, 'columns 至少一列'),
  rows: z.array(z.array(sheetCellSchema)),
})
export type SheetPayload = z.infer<typeof sheetPayloadSchema>

/** html_report:自包含 HTML 字符串(非引用;引用关系由 payload_ref 承担)。 */
export const htmlReportPayloadSchema = z.string().min(1)

/** doc:Markdown 正文。 */
export const docPayloadSchema = z.string().min(1)

/** video_ref:视频外链引用(产物只存指针,不存视频本体)。 */
export const videoRefPayloadSchema = z.object({
  url: z.string().min(1),
  provider: z.string().optional(),
})
export type VideoRefPayload = z.infer<typeof videoRefPayloadSchema>

/** kind → payload zod schema 查表(未知 kind 返回 None 语义 ⇒ undefined,调用方拒收)。 */
export function deliverablePayloadSchemaOf(kind: DeliverableKind) {
  switch (kind) {
    case 'slides':
      return slidesDeckSchema
    case 'sheet':
      return sheetPayloadSchema
    case 'html_report':
      return htmlReportPayloadSchema
    case 'doc':
      return docPayloadSchema
    case 'video_ref':
      return videoRefPayloadSchema
  }
}

// -------------------------------------------------------------- Artifact ----

/** 源转录锚点:产物挂在会话哪条消息(必填)、可选该消息内的序号。 */
export const turnAnchorSchema = z.object({
  message_id: z.string().min(1, 'turn_anchor.message_id 必填(源转录锚点)'),
  index: z.number().int().min(0).optional(),
})
export type TurnAnchor = z.infer<typeof turnAnchorSchema>

/** 统一 Artifact 元数据记录(结构化 JSON 附件形态挂接既有会话附件机制)。 */
export const artifactSchema = z.object({
  id: z.uuid(),
  kind: z.enum(DELIVERABLE_ARTIFACT_KINDS),
  title: z.string().min(1),
  version: z.number().int().min(1),
  session_id: z.string().min(1),
  turn_anchor: turnAnchorSchema,
  /** payload 相对路径(相对仓库根,如 tmp/artifacts/<id>/v1.html;posix 分隔)。 */
  payload_ref: z.string().min(1),
  mime: z.string().min(1),
  size_bytes: z.number().int().min(0),
  /** payload 字节 sha256(小写十六进制),下载端点出口前复验。 */
  checksum: z
    .string()
    .regex(/^[0-9a-f]{64}$/, 'checksum 必须是 64 位小写十六进制 sha256'),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  status: z.enum(ARTIFACT_STATUSES),
})
export type Artifact = z.infer<typeof artifactSchema>

/** 已取回 payload 的 Artifact(渲染/导出的输入形态;payload 已按 kind 校验)。 */
export interface ArtifactWithPayload extends Artifact {
  readonly payload: SlidesDeck | SheetPayload | VideoRefPayload | string
}

export const artifactWithPayloadSchema: z.ZodType<ArtifactWithPayload> =
  artifactSchema.extend({ payload: z.unknown() }) as unknown as z.ZodType<ArtifactWithPayload>
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
