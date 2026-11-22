// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文档解析结构化信封。
 *
 * 三个设计决策：
 *   ① previewEngine 自描述：结果标注产出引擎（如 previewEngine:"docx-preview"），
 *      使降级可溯源、可观测、可调试，而非只有一段裸字符串。
 *   ② previewFallback 结构化降级：{category, code, detail, resourceId, title}，
 *      taxonomy 为 category ∈ {codec,font,object,resource}
 *      × code ∈ {pptx-image-omitted, pptx-image-unsupported,
 *                pptx-smartart-unavailable, pptx-ole-unavailable, ...}。
 *   ③ 部件模型：每个部件独立携带 contentType(+data+partId)，格式信息随部件走。
 *
 * IHUI 实现：把上面 ①② 落成一个纯 TS 信封，复用现有 anydoc / unpdf / mammoth /
 *   xlsx-parser 引擎。旧的 parseDocument（返回 string）原样保留，5 个调用方零改动；
 *   新增 parseDocumentWithEnvelope 返回带 previewEngine + fallback[] 的结构化结果。
 *
 * 相对外部方案的增强：
 *   - fallback 分类统计暴露给调用方，而不只停留在渲染器内部；
 *     我们把 taxonomy 做成可枚举常量 + classify() 单源映射，调用方可据此路由
 *     (如 resource-too-large → 引导压缩，needs-ocr → 引导 OCR)。
 *   - 信封附 elapsedMs + engine 逐次记录，便于对比 anydoc/unpdf/mammoth 真实耗时。
 */

/** 预览/解析引擎标识(取值自描述)。 */
export type PreviewEngine =
  'anydoc' | 'unpdf' | 'mammoth' | 'exceljs' | 'xlsx-legacy' | 'csv' | 'html-text' | 'raw-text'

/** 降级类别 taxonomy。 */
export const FALLBACK_CATEGORY = {
  /** 编解码器不支持(如某图片 codec、某模型 3D) */
  Codec: 'codec',
  /** 字体缺失/替换 */
  Font: 'font',
  /** 嵌入对象不可预览(如 OLE、SmartArt) */
  Object: 'object',
  /** 资源过大或缺失 */
  Resource: 'resource',
  /** 结构损坏 / 不完整 */
  Malformed: 'malformed',
  /** 需要 OCR(扫描件无文字层) */
  NeedsOcr: 'needs-ocr',
  /** 内容加密 */
  Encrypted: 'encrypted',
  /** 引擎安全资源限制 */
  ResourceLimit: 'resource-limit',
} as const

export type FallbackCategory = (typeof FALLBACK_CATEGORY)[keyof typeof FALLBACK_CATEGORY]

/** 降级码 taxonomy(前缀表明格式族)。 */
export const FALLBACK_CODE = {
  // —— office 渲染族 ——
  ImageBytesOmitted: 'pptx-image-omitted',
  ImageCodecUnsupported: 'pptx-image-unsupported',
  ImageRasterizationRequired: 'pptx-image-rasterization-required',
  Model3dUnavailable: 'pptx-model3d-unavailable',
  OleUnavailable: 'pptx-ole-unavailable',
  SmartartUnavailable: 'pptx-smartart-unavailable',
  ResourceTooLarge: 'pptx-resource-too-large',
  // —— IHUI 解析族(对齐 anydoc 错误码)——
  Malformed: 'doc-malformed',
  Encrypted: 'doc-encrypted',
  MissingPart: 'doc-missing-part',
  NeedsOcr: 'doc-needs-ocr',
  ResourceLimit: 'doc-resource-limit',
  IoError: 'doc-io-error',
  EmptyOutput: 'doc-empty-output',
} as const

export type FallbackCode = (typeof FALLBACK_CODE)[keyof typeof FALLBACK_CODE]

/** 一条结构化降级。 */
export interface PreviewFallback {
  category: FallbackCategory
  code: FallbackCode
  /** 面向调试/日志的细节(不直接展示给终端用户)。 */
  detail?: string
  /** 出问题的内部部件标识(如 OLE 对象 / 图片关系 id)。 */
  resourceId?: string
  /** 面向用户的简短标题。 */
  title?: string
}

/** 结构化解析结果信封:文本 + 引擎自描述 + 降级清单 + 耗时。 */
export interface ParseEnvelope {
  /** 归一化文本(GFM Markdown 或纯文本),供 RAG 切片。 */
  text: string
  /** 实际产出文本的引擎(降级后为最终生效的那个)。 */
  previewEngine: PreviewEngine
  /** 解析过程中的降级记录(空数组 = 一次到位)。 */
  fallbacks: PreviewFallback[]
  /** 主路径耗时(毫秒,仅主引擎,不含降级链)。 */
  elapsedMs: number
}

/** 把 anydoc 错误码映射到结构化 fallback(单源,替代散落的 switch 文案)。 */
export function classifyAnydocError(
  code: string | undefined,
  detail: string,
): PreviewFallback | null {
  switch (code) {
    case 'needsOcr':
      return {
        category: FALLBACK_CATEGORY.NeedsOcr,
        code: FALLBACK_CODE.NeedsOcr,
        detail,
        title: '扫描件无文字层',
      }
    case 'malformed':
      return {
        category: FALLBACK_CATEGORY.Malformed,
        code: FALLBACK_CODE.Malformed,
        detail,
        title: '文件结构损坏',
      }
    case 'encrypted':
      return {
        category: FALLBACK_CATEGORY.Encrypted,
        code: FALLBACK_CODE.Encrypted,
        detail,
        title: '文件已加密',
      }
    case 'resourceLimit':
      return {
        category: FALLBACK_CATEGORY.ResourceLimit,
        code: FALLBACK_CODE.ResourceLimit,
        detail,
        title: '超出解析引擎安全限制',
      }
    case 'missingPart':
      return {
        category: FALLBACK_CATEGORY.Malformed,
        code: FALLBACK_CODE.MissingPart,
        detail,
        title: '归档不完整',
      }
    case 'io':
      return {
        category: FALLBACK_CATEGORY.Malformed,
        code: FALLBACK_CODE.IoError,
        detail,
        title: '文件读取失败',
      }
    default:
      return null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
