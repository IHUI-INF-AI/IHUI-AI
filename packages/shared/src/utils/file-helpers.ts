/**
 * 文件扩展名与 MIME 类型工具(跨端统一:miniapp-taro/upload-image + web/lib/file-utils 共用)。
 */

/**
 * 从文件路径/URL 提取扩展名(小写,无点)。
 * 例:'/a/b.jpg?x=1' -> 'jpg', 'file.png' -> 'png', 'noext' -> 'jpg'(默认)
 */
export function getExt(filePath: string): string {
  const parts = filePath.substring(filePath.lastIndexOf('/') + 1).split('?')
  const baseName = parts[0] || ''
  const dotIdx = baseName.lastIndexOf('.')
  return dotIdx > -1 ? baseName.substring(dotIdx + 1).toLowerCase() : 'jpg'
}

/**
 * 根据扩展名获取 MIME 类型。
 * 支持:png/gif/webp/jpeg(默认)。
 */
export function getMimeType(ext: string): string {
  if (ext === 'png') return 'image/png'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  return 'image/jpeg'
}
