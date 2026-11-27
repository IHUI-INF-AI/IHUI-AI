// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全格式预览判型(2026-11-26 立)。
 *
 * 单一真相源:文档中心 / AI 面板 / 工作区项目文件都从这里拿"这个后缀该用哪个渲染器",
 * 调用侧不得再写第二张支持表。判型只按扩展名(不嗅内容):文件名不可信时,
 * 渲染器自身仍会做类型校验与失败卡,这里是**选路**不是**担保**。
 *
 * 与后端的对应关系:
 *  - apps/api/src/utils/file-type-validator.ts EXT_MIME_MAP 是上传准入表(image/audio/video);
 *  - apps/web/src/components/media/office-preview.tsx SUPPORTED_EXTS 是办公档真渲染表;
 *  - apps/web/src/components/media/FilePreview.tsx GALLERY_VIDEO_EXTENSIONS 是视频真播表。
 * 本表只做"档 → 渲染器"分流,不复制它们的判断。
 */

export type PreviewKind =
  'image' | 'video' | 'audio' | 'pdf' | 'office' | 'delimited' | 'text' | 'three' | 'download'

/** 图片档(与 EXT_MIME_MAP 的 image/* 登记面对齐;svg 只用于渲染,不在上传白名单)。 */
const IMAGE_EXTS: ReadonlySet<string> = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'svg',
  'avif',
])
/** 视频档(与 FilePreview 的 GALLERY_VIDEO_EXTENSIONS 同集,新增档两处必须同改)。 */
const VIDEO_EXTS: ReadonlySet<string> = new Set(['mp4', 'webm', 'ogg', 'mov', 'm4v'])
/** 音频档(与 EXT_MIME_MAP 的 audio/* 登记面对齐)。 */
const AUDIO_EXTS: ReadonlySet<string> = new Set(['mp3', 'm4a', 'wav', 'aac', 'flac'])
/** Office 族(含老格式与 ODF/RTF/EPUB;能不能真渲染由 office-preview 的 SUPPORTED_EXTS 再判)。 */
const OFFICE_EXTS: ReadonlySet<string> = new Set([
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'odt',
  'ods',
  'odp',
  'rtf',
  'epub',
])
/** 3D 档(与 FilePreview 的 ThreeDViewer 分支同集)。 */
const THREE_EXTS: ReadonlySet<string> = new Set(['glb', 'gltf', 'obj', 'stl'])
/** 文本档(含代码与网页源码;html 只按源码读,不当 HTML 执行)。 */
const TEXT_EXTS: ReadonlySet<string> = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'jsonl',
  'log',
  'yaml',
  'yml',
  'toml',
  'ini',
  'cfg',
  'conf',
  'xml',
  'html',
  'htm',
  'css',
  'scss',
  'less',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'py',
  'go',
  'rs',
  'java',
  'kt',
  'c',
  'cpp',
  'h',
  'hpp',
  'cs',
  'php',
  'rb',
  'swift',
  'sh',
  'bash',
  'sql',
  'diff',
  'patch',
  'env',
])

/** 从地址取扩展名(去 query/hash,小写无点;无扩展名返回空串)。 */
export function previewExtOf(src: string): string {
  const tail = src.split('?')[0]?.split('#')[0] ?? ''
  const seg = tail.split('/').pop() ?? ''
  const dot = seg.lastIndexOf('.')
  return dot > 0 ? seg.slice(dot + 1).toLowerCase() : ''
}

/** 判型(封闭集;未知档一律落 download,由渲染器给"不支持预览 + 下载"出口)。 */
export function previewKindOf(ext: string): PreviewKind {
  const normalized = ext.replace(/^\./, '').toLowerCase()
  if (IMAGE_EXTS.has(normalized)) return 'image'
  if (VIDEO_EXTS.has(normalized)) return 'video'
  if (AUDIO_EXTS.has(normalized)) return 'audio'
  if (normalized === 'pdf') return 'pdf'
  if (OFFICE_EXTS.has(normalized)) return 'office'
  if (normalized === 'csv' || normalized === 'tsv') return 'delimited'
  if (THREE_EXTS.has(normalized)) return 'three'
  if (TEXT_EXTS.has(normalized)) return 'text'
  return 'download'
}

/**
 * 该档是否应该交给"文件查看器"打开(IDE 文件树、工作区文件列表用)。
 * 文本/代码档仍进编辑器;未知无扩展名档也保持编辑器(可能是无后缀的文本);
 * 只有明确判为媒体/文档/表格/3D 或 zip 归档案才换查看器。
 */
export function needsFileViewer(ext: string): boolean {
  const normalized = ext.replace(/^\./, '').toLowerCase()
  if (normalized === 'zip') return true
  return previewKindOf(normalized) !== 'text' && previewKindOf(normalized) !== 'download'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
