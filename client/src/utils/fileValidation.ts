export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function validateFile(
  file: File,
  options?: { allowedTypes?: string[]; maxSize?: number }
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (options?.maxSize && file.size > options.maxSize) {
    errors.push('文件大小超出限制')
  }
  if (options?.allowedTypes && options.allowedTypes.length > 0) {
    if (!options.allowedTypes.includes(file.type)) {
      errors.push('文件类型不允许')
    }
  }
  return { valid: errors.length === 0, errors }
}
