export type FileCategory = 
  | 'pdf' 
  | 'document' 
  | 'spreadsheet' 
  | 'presentation' 
  | 'image' 
  | 'video' 
  | 'audio' 
  | 'code' 
  | 'markdown' 
  | 'text' 
  | 'archive'
  | 'model3d'
  | 'cad'
  | 'unknown'

export interface FileTypeConfig {
  extension: string
  category: FileCategory
  mimeType: string
  icon: string
  viewer: string
  downloadable: boolean
  previewable: boolean
}

export const FILE_TYPE_CONFIGS: FileTypeConfig[] = [
  { extension: 'pdf', category: 'pdf', mimeType: 'application/pdf', icon: '📄', viewer: 'pdf', downloadable: true, previewable: true },
  
  { extension: 'doc', category: 'document', mimeType: 'application/msword', icon: '📝', viewer: 'office', downloadable: true, previewable: true },
  { extension: 'docx', category: 'document', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', icon: '📝', viewer: 'office', downloadable: true, previewable: true },
  { extension: 'rtf', category: 'document', mimeType: 'application/rtf', icon: '📝', viewer: 'text', downloadable: true, previewable: true },
  { extension: 'odt', category: 'document', mimeType: 'application/vnd.oasis.opendocument.text', icon: '📝', viewer: 'office', downloadable: true, previewable: true },
  
  { extension: 'xls', category: 'spreadsheet', mimeType: 'application/vnd.ms-excel', icon: '📊', viewer: 'office', downloadable: true, previewable: true },
  { extension: 'xlsx', category: 'spreadsheet', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', icon: '📊', viewer: 'office', downloadable: true, previewable: true },
  { extension: 'csv', category: 'spreadsheet', mimeType: 'text/csv', icon: '📊', viewer: 'csv', downloadable: true, previewable: true },
  { extension: 'ods', category: 'spreadsheet', mimeType: 'application/vnd.oasis.opendocument.spreadsheet', icon: '📊', viewer: 'office', downloadable: true, previewable: true },
  
  { extension: 'ppt', category: 'presentation', mimeType: 'application/vnd.ms-powerpoint', icon: '📽️', viewer: 'office', downloadable: true, previewable: true },
  { extension: 'pptx', category: 'presentation', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', icon: '📽️', viewer: 'office', downloadable: true, previewable: true },
  { extension: 'odp', category: 'presentation', mimeType: 'application/vnd.oasis.opendocument.presentation', icon: '📽️', viewer: 'office', downloadable: true, previewable: true },
  
  { extension: 'jpg', category: 'image', mimeType: 'image/jpeg', icon: '🖼️', viewer: 'image', downloadable: true, previewable: true },
  { extension: 'jpeg', category: 'image', mimeType: 'image/jpeg', icon: '🖼️', viewer: 'image', downloadable: true, previewable: true },
  { extension: 'png', category: 'image', mimeType: 'image/png', icon: '🖼️', viewer: 'image', downloadable: true, previewable: true },
  { extension: 'gif', category: 'image', mimeType: 'image/gif', icon: '🖼️', viewer: 'image', downloadable: true, previewable: true },
  { extension: 'webp', category: 'image', mimeType: 'image/webp', icon: '🖼️', viewer: 'image', downloadable: true, previewable: true },
  { extension: 'svg', category: 'image', mimeType: 'image/svg+xml', icon: '🖼️', viewer: 'image', downloadable: true, previewable: true },
  { extension: 'bmp', category: 'image', mimeType: 'image/bmp', icon: '🖼️', viewer: 'image', downloadable: true, previewable: true },
  { extension: 'ico', category: 'image', mimeType: 'image/x-icon', icon: '🖼️', viewer: 'image', downloadable: true, previewable: true },
  { extension: 'tiff', category: 'image', mimeType: 'image/tiff', icon: '🖼️', viewer: 'image', downloadable: true, previewable: true },
  { extension: 'tif', category: 'image', mimeType: 'image/tiff', icon: '🖼️', viewer: 'image', downloadable: true, previewable: true },
  
  { extension: 'mp4', category: 'video', mimeType: 'video/mp4', icon: '🎬', viewer: 'video', downloadable: true, previewable: true },
  { extension: 'webm', category: 'video', mimeType: 'video/webm', icon: '🎬', viewer: 'video', downloadable: true, previewable: true },
  { extension: 'avi', category: 'video', mimeType: 'video/x-msvideo', icon: '🎬', viewer: 'video', downloadable: true, previewable: true },
  { extension: 'mov', category: 'video', mimeType: 'video/quicktime', icon: '🎬', viewer: 'video', downloadable: true, previewable: true },
  { extension: 'mkv', category: 'video', mimeType: 'video/x-matroska', icon: '🎬', viewer: 'video', downloadable: true, previewable: true },
  { extension: 'wmv', category: 'video', mimeType: 'video/x-ms-wmv', icon: '🎬', viewer: 'video', downloadable: true, previewable: true },
  { extension: 'flv', category: 'video', mimeType: 'video/x-flv', icon: '🎬', viewer: 'video', downloadable: true, previewable: true },
  { extension: 'm4v', category: 'video', mimeType: 'video/x-m4v', icon: '🎬', viewer: 'video', downloadable: true, previewable: true },
  
  { extension: 'mp3', category: 'audio', mimeType: 'audio/mpeg', icon: '🎵', viewer: 'audio', downloadable: true, previewable: true },
  { extension: 'wav', category: 'audio', mimeType: 'audio/wav', icon: '🎵', viewer: 'audio', downloadable: true, previewable: true },
  { extension: 'ogg', category: 'audio', mimeType: 'audio/ogg', icon: '🎵', viewer: 'audio', downloadable: true, previewable: true },
  { extension: 'flac', category: 'audio', mimeType: 'audio/flac', icon: '🎵', viewer: 'audio', downloadable: true, previewable: true },
  { extension: 'aac', category: 'audio', mimeType: 'audio/aac', icon: '🎵', viewer: 'audio', downloadable: true, previewable: true },
  { extension: 'm4a', category: 'audio', mimeType: 'audio/mp4', icon: '🎵', viewer: 'audio', downloadable: true, previewable: true },
  { extension: 'wma', category: 'audio', mimeType: 'audio/x-ms-wma', icon: '🎵', viewer: 'audio', downloadable: true, previewable: true },
  
  { extension: 'js', category: 'code', mimeType: 'text/javascript', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'ts', category: 'code', mimeType: 'text/typescript', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'jsx', category: 'code', mimeType: 'text/javascript', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'tsx', category: 'code', mimeType: 'text/typescript', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'vue', category: 'code', mimeType: 'text/vue', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'py', category: 'code', mimeType: 'text/x-python', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'java', category: 'code', mimeType: 'text/x-java', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'c', category: 'code', mimeType: 'text/x-c', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'cpp', category: 'code', mimeType: 'text/x-c++', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'h', category: 'code', mimeType: 'text/x-c', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'hpp', category: 'code', mimeType: 'text/x-c++', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'cs', category: 'code', mimeType: 'text/x-csharp', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'go', category: 'code', mimeType: 'text/x-go', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'rs', category: 'code', mimeType: 'text/x-rust', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'rb', category: 'code', mimeType: 'text/x-ruby', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'php', category: 'code', mimeType: 'text/x-php', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'swift', category: 'code', mimeType: 'text/x-swift', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'kt', category: 'code', mimeType: 'text/x-kotlin', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'scala', category: 'code', mimeType: 'text/x-scala', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'r', category: 'code', mimeType: 'text/x-r', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'sql', category: 'code', mimeType: 'text/x-sql', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'sh', category: 'code', mimeType: 'text/x-sh', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'bash', category: 'code', mimeType: 'text/x-bash', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'ps1', category: 'code', mimeType: 'text/x-powershell', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'json', category: 'code', mimeType: 'application/json', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'xml', category: 'code', mimeType: 'text/xml', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'yaml', category: 'code', mimeType: 'text/yaml', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'yml', category: 'code', mimeType: 'text/yaml', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'toml', category: 'code', mimeType: 'text/x-toml', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'ini', category: 'code', mimeType: 'text/x-ini', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'css', category: 'code', mimeType: 'text/css', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'scss', category: 'code', mimeType: 'text/x-scss', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'less', category: 'code', mimeType: 'text/x-less', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'html', category: 'code', mimeType: 'text/html', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  { extension: 'htm', category: 'code', mimeType: 'text/html', icon: '📜', viewer: 'code', downloadable: true, previewable: true },
  
  { extension: 'md', category: 'markdown', mimeType: 'text/markdown', icon: '📑', viewer: 'markdown', downloadable: true, previewable: true },
  { extension: 'markdown', category: 'markdown', mimeType: 'text/markdown', icon: '📑', viewer: 'markdown', downloadable: true, previewable: true },
  { extension: 'mdown', category: 'markdown', mimeType: 'text/markdown', icon: '📑', viewer: 'markdown', downloadable: true, previewable: true },
  
  { extension: 'txt', category: 'text', mimeType: 'text/plain', icon: '📃', viewer: 'text', downloadable: true, previewable: true },
  { extension: 'log', category: 'text', mimeType: 'text/plain', icon: '📃', viewer: 'text', downloadable: true, previewable: true },
  { extension: 'conf', category: 'text', mimeType: 'text/plain', icon: '📃', viewer: 'text', downloadable: true, previewable: true },
  { extension: 'cfg', category: 'text', mimeType: 'text/plain', icon: '📃', viewer: 'text', downloadable: true, previewable: true },
  
  { extension: 'zip', category: 'archive', mimeType: 'application/zip', icon: '📦', viewer: 'archive', downloadable: true, previewable: true },
  { extension: 'rar', category: 'archive', mimeType: 'application/x-rar-compressed', icon: '📦', viewer: 'archive', downloadable: true, previewable: true },
  { extension: '7z', category: 'archive', mimeType: 'application/x-7z-compressed', icon: '📦', viewer: 'archive', downloadable: true, previewable: true },
  { extension: 'tar', category: 'archive', mimeType: 'application/x-tar', icon: '📦', viewer: 'archive', downloadable: true, previewable: true },
  { extension: 'gz', category: 'archive', mimeType: 'application/gzip', icon: '📦', viewer: 'archive', downloadable: true, previewable: true },
  { extension: 'bz2', category: 'archive', mimeType: 'application/x-bzip2', icon: '📦', viewer: 'archive', downloadable: true, previewable: true },
  
  { extension: 'gltf', category: 'model3d', mimeType: 'model/gltf+json', icon: '🎮', viewer: 'model3d', downloadable: true, previewable: true },
  { extension: 'glb', category: 'model3d', mimeType: 'model/gltf-binary', icon: '🎮', viewer: 'model3d', downloadable: true, previewable: true },
  { extension: 'obj', category: 'model3d', mimeType: 'model/obj', icon: '🎮', viewer: 'model3d', downloadable: true, previewable: true },
  { extension: 'stl', category: 'model3d', mimeType: 'model/stl', icon: '🎮', viewer: 'model3d', downloadable: true, previewable: true },
  { extension: 'fbx', category: 'model3d', mimeType: 'model/fbx', icon: '🎮', viewer: 'model3d', downloadable: true, previewable: true },
  { extension: '3ds', category: 'model3d', mimeType: 'model/3ds', icon: '🎮', viewer: 'model3d', downloadable: true, previewable: true },
  { extension: 'dae', category: 'model3d', mimeType: 'model/collada+xml', icon: '🎮', viewer: 'model3d', downloadable: true, previewable: true },
  
  { extension: 'dwg', category: 'cad', mimeType: 'image/vnd.dwg', icon: '📐', viewer: 'cad', downloadable: true, previewable: true },
  { extension: 'dxf', category: 'cad', mimeType: 'image/vnd.dxf', icon: '📐', viewer: 'cad', downloadable: true, previewable: true },
  { extension: 'step', category: 'cad', mimeType: 'model/step', icon: '📐', viewer: 'cad', downloadable: true, previewable: true },
  { extension: 'stp', category: 'cad', mimeType: 'model/step', icon: '📐', viewer: 'cad', downloadable: true, previewable: true },
  { extension: 'iges', category: 'cad', mimeType: 'model/iges', icon: '📐', viewer: 'cad', downloadable: true, previewable: true },
  { extension: 'igs', category: 'cad', mimeType: 'model/iges', icon: '📐', viewer: 'cad', downloadable: true, previewable: true },
]

const extensionMap = new Map<string, FileTypeConfig>()
FILE_TYPE_CONFIGS.forEach(config => {
  extensionMap.set(config.extension.toLowerCase(), config)
})

const DEFAULT_UNKNOWN_FILE_TYPE: FileTypeConfig = {
  extension: '',
  category: 'unknown',
  mimeType: 'application/octet-stream',
  icon: '📄',
  viewer: 'unknown',
  downloadable: true,
  previewable: false
}

export function getFileType(filename: string | undefined | null): FileTypeConfig {
  const safe = (filename ?? '').toString().trim()
  if (!safe) return DEFAULT_UNKNOWN_FILE_TYPE
  const ext = safe.split('.').pop()?.toLowerCase() || ''
  return extensionMap.get(ext) || {
    extension: ext,
    category: 'unknown',
    mimeType: 'application/octet-stream',
    icon: '📄',
    viewer: 'unknown',
    downloadable: true,
    previewable: false
  }
}

export function getFileTypeFromUrl(url: string): FileTypeConfig {
  const pathname = url.split('?')[0].split('#')[0]
  const filename = pathname.split('/').pop() || ''
  return getFileType(filename)
}

export function getFileTypeFromMime(mimeType: string): FileTypeConfig {
  const config = FILE_TYPE_CONFIGS.find(c => c.mimeType === mimeType)
  if (config) return config
  
  const baseType = mimeType.split('/')[0]
  switch (baseType) {
    case 'image': return { extension: '', category: 'image', mimeType, icon: '🖼️', viewer: 'image', downloadable: true, previewable: true }
    case 'video': return { extension: '', category: 'video', mimeType, icon: '🎬', viewer: 'video', downloadable: true, previewable: true }
    case 'audio': return { extension: '', category: 'audio', mimeType, icon: '🎵', viewer: 'audio', downloadable: true, previewable: true }
    case 'text': return { extension: '', category: 'text', mimeType, icon: '📃', viewer: 'text', downloadable: true, previewable: true }
    default: return { extension: '', category: 'unknown', mimeType, icon: '📄', viewer: 'unknown', downloadable: true, previewable: false }
  }
}

export function isImageFile(filename: string): boolean {
  return getFileType(filename).category === 'image'
}

export function isVideoFile(filename: string): boolean {
  return getFileType(filename).category === 'video'
}

export function isAudioFile(filename: string): boolean {
  return getFileType(filename).category === 'audio'
}

export function isCodeFile(filename: string): boolean {
  return getFileType(filename).category === 'code'
}

export function isMarkdownFile(filename: string): boolean {
  return getFileType(filename).category === 'markdown'
}

export function isDocumentFile(filename: string): boolean {
  const category = getFileType(filename).category
  return category === 'document' || category === 'spreadsheet' || category === 'presentation'
}

export function isArchiveFile(filename: string): boolean {
  return getFileType(filename).category === 'archive'
}

export function isPreviewable(filename: string): boolean {
  return getFileType(filename).previewable
}

export const CODE_LANGUAGES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  vue: 'vue',
  py: 'python',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  go: 'go',
  rs: 'rust',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  r: 'r',
  sql: 'sql',
  sh: 'bash',
  bash: 'bash',
  ps1: 'powershell',
  json: 'json',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  htm: 'html',
  md: 'markdown',
  markdown: 'markdown',
}

export function getCodeLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return CODE_LANGUAGES[ext] || 'plaintext'
}
