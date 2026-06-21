const FILE_SIGNATURES: Record<string, { signature: number[]; offset: number }> = {
  'image/jpeg': { signature: [0xFF, 0xD8, 0xFF], offset: 0 },
  'image/png': { signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0 },
  'image/gif': { signature: [0x47, 0x49, 0x46, 0x38], offset: 0 },
  'image/webp': { signature: [0x52, 0x49, 0x46, 0x46], offset: 0 },
  'image/bmp': { signature: [0x42, 0x4D], offset: 0 },
  'application/pdf': { signature: [0x25, 0x50, 0x44, 0x46], offset: 0 },
  'application/zip': { signature: [0x50, 0x4B, 0x03, 0x04], offset: 0 },
  'application/x-rar-compressed': { signature: [0x52, 0x61, 0x72, 0x21], offset: 0 },
  'application/x-7z-compressed': { signature: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], offset: 0 },
  'video/mp4': { signature: [0x00, 0x00, 0x00], offset: 0 },
  'video/webm': { signature: [0x1A, 0x45, 0xDF, 0xA3], offset: 0 },
  'audio/mpeg': { signature: [0xFF, 0xFB], offset: 0 },
  'audio/wav': { signature: [0x52, 0x49, 0x46, 0x46], offset: 0 },
  'application/msword': { signature: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], offset: 0 },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { signature: [0x50, 0x4B, 0x03, 0x04], offset: 0 },
}

const DANGEROUS_EXTENSIONS = [
  '.exe', '.dll', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
  '.msi', '.sh', '.bash', '.ps1', '.ps2', '.psm1', '.psd1', '.app', '.deb', '.rpm',
  '.dmg', '.pkg', '.run', '.bin', '.script', '.command'
]

const MIME_TO_EXTENSION: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg', '.jpe', '.jfif'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/bmp': ['.bmp', '.dib'],
  'image/svg+xml': ['.svg', '.svgz'],
  'image/tiff': ['.tiff', '.tif'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'video/mp4': ['.mp4', '.m4v', '.m4p'],
  'video/webm': ['.webm'],
  'video/quicktime': ['.mov'],
  'video/x-msvideo': ['.avi'],
  'video/x-matroska': ['.mkv'],
  'audio/mpeg': ['.mp3', '.mpga'],
  'audio/wav': ['.wav'],
  'audio/ogg': ['.ogg', '.oga'],
  'audio/webm': ['.weba'],
  'text/plain': ['.txt', '.log', '.md', '.markdown'],
  'text/html': ['.html', '.htm'],
  'text/css': ['.css'],
  'text/javascript': ['.js', '.mjs'],
  'application/json': ['.json'],
  'application/xml': ['.xml'],
  'application/zip': ['.zip'],
  'application/x-rar-compressed': ['.rar'],
  'application/x-7z-compressed': ['.7z'],
  'application/x-tar': ['.tar'],
  'application/gzip': ['.gz', '.gzip'],
}

export interface FileValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  detectedType?: string
  extensionMatch: boolean
}

export interface FileValidationOptions {
  maxSize?: number
  allowedTypes?: string[]
  allowedExtensions?: string[]
  checkSignature?: boolean
  allowDangerousExtensions?: boolean
}

export function validateFile(
  file: File,
  options: FileValidationOptions = {}
): FileValidationResult {
  const {
    maxSize = 100 * 1024 * 1024,
    allowedTypes = [],
    allowedExtensions = [],
    checkSignature: _checkSignature = true,
    allowDangerousExtensions = false
  } = options

  const errors: string[] = []
  const warnings: string[] = []
  let detectedType: string | undefined
  let extensionMatch = true

  if (file.size > maxSize) {
    errors.push(`文件大小超过限制 (${formatFileSize(maxSize)})`)
  }

  const extension = '.' + file.name.split('.').pop()?.toLowerCase()

  if (!allowDangerousExtensions && DANGEROUS_EXTENSIONS.includes(extension)) {
    errors.push(`不允许上传可执行文件: ${extension}`)
  }

  if (allowedExtensions.length > 0 && !allowedExtensions.map(e => e.toLowerCase()).includes(extension)) {
    errors.push(`不支持的文件扩展名: ${extension}`)
  }

  if (allowedTypes.length > 0) {
    const isTypeAllowed = allowedTypes.some(type => {
      if (type.includes('*')) {
        return file.type.startsWith(type.replace('*', ''))
      }
      return file.type === type
    })
    if (!isTypeAllowed) {
      errors.push(`不支持的文件类型: ${file.type || '未知'}`)
    }
  }

  const expectedTypes = Object.entries(MIME_TO_EXTENSION)
    .filter(([_, exts]) => exts.includes(extension))
    .map(([type]) => type)

  if (expectedTypes.length > 0 && file.type && !expectedTypes.includes(file.type)) {
    extensionMatch = false
    warnings.push(`文件扩展名与内容类型不匹配`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    detectedType,
    extensionMatch
  }
}

export async function validateFileSignature(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer
      if (!buffer) {
        resolve(null)
        return
      }

      const uint8Array = new Uint8Array(buffer)
      
      for (const [mimeType, { signature, offset }] of Object.entries(FILE_SIGNATURES)) {
        let match = true
        for (let i = 0; i < signature.length; i++) {
          if (uint8Array[offset + i] !== signature[i]) {
            match = false
            break
          }
        }
        if (match) {
          resolve(mimeType)
          return
        }
      }
      
      resolve(null)
    }
    reader.onerror = () => resolve(null)
    reader.readAsArrayBuffer(file.slice(0, 16))
  })
}

export async function validateFileAsync(
  file: File,
  options: FileValidationOptions = {}
): Promise<FileValidationResult> {
  const result = validateFile(file, options)
  
  if (options.checkSignature !== false && file.size > 0) {
    const detectedType = await validateFileSignature(file)
    if (detectedType && file.type && detectedType !== file.type) {
      result.warnings.push(`文件实际类型与声明类型不符`)
    }
    result.detectedType = detectedType || undefined
  }
  
  return result
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

export function getMimeTypeFromExtension(extension: string): string {
  const ext = extension.startsWith('.') ? extension.toLowerCase() : '.' + extension.toLowerCase()
  for (const [mimeType, extensions] of Object.entries(MIME_TO_EXTENSION)) {
    if (extensions.includes(ext)) {
      return mimeType
    }
  }
  return 'application/octet-stream'
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

export function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/')
}

export function isDocumentFile(file: File): boolean {
  const docTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/rtf'
  ]
  return docTypes.includes(file.type)
}

export function isArchiveFile(file: File): boolean {
  const archiveTypes = [
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/x-tar',
    'application/gzip'
  ]
  return archiveTypes.includes(file.type)
}

export function generateSafeFilename(filename: string): string {
  const sanitized = filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255)
  
  const timestamp = Date.now()
  const ext = getFileExtension(filename)
  const name = sanitized.replace(new RegExp(`\\.${ext}$`), '')
  
  return `${name}_${timestamp}.${ext}`
}
