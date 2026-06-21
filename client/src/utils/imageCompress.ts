interface CompressOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  mimeType?: string
}

interface CompressResult {
  blob: Blob
  dataUrl: string
  width: number
  height: number
  originalSize: number
  compressedSize: number
  compressionRatio: number
}

const DEFAULT_OPTIONS: Required<CompressOptions> = {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 0.8,
  mimeType: 'image/jpeg'
}

async function loadImage(src: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    
    if (src instanceof Blob) {
      img.src = URL.createObjectURL(src)
    } else {
      img.src = src
    }
  })
}

export async function compressImage(
  file: File | Blob,
  options: CompressOptions = {}
): Promise<CompressResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const originalSize = file.size

  const img = await loadImage(file)
  
  let { width, height } = img
  
  if (width > opts.maxWidth || height > opts.maxHeight) {
    const ratio = Math.min(opts.maxWidth / width, opts.maxHeight / height)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  ctx.drawImage(img, 0, 0, width, height)

  const dataUrl = canvas.toDataURL(opts.mimeType, opts.quality)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to create blob'))
        }
      },
      opts.mimeType,
      opts.quality
    )
  })

  const compressedSize = blob.size
  const compressionRatio = originalSize > 0 
    ? Math.round((1 - compressedSize / originalSize) * 100) 
    : 0

  return {
    blob,
    dataUrl,
    width,
    height,
    originalSize,
    compressedSize,
    compressionRatio
  }
}

export async function createThumbnail(
  file: File | Blob,
  size: number = 200
): Promise<string> {
  const img = await loadImage(file)

  let { width, height } = img
  const ratio = Math.min(size / width, size / height)
  width = Math.round(width * ratio)
  height = Math.round(height * ratio)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  ctx.drawImage(img, 0, 0, width, height)

  return canvas.toDataURL('image/jpeg', 0.7)
}

export async function getImageDimensions(
  file: File | Blob
): Promise<{ width: number; height: number }> {
  const img = await loadImage(file)
  return { width: img.naturalWidth, height: img.naturalHeight }
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

export function formatImageSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export async function rotateImage(
  file: File | Blob,
  degrees: number
): Promise<Blob> {
  const img = await loadImage(file)

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  if (degrees === 90 || degrees === 270) {
    canvas.width = img.naturalHeight
    canvas.height = img.naturalWidth
  } else {
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
  }

  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((degrees * Math.PI) / 180)
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to rotate image'))
      },
      'image/jpeg',
      0.9
    )
  })
}

export async function cropImage(
  file: File | Blob,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<Blob> {
  const img = await loadImage(file)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  ctx.drawImage(img, x, y, width, height, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to crop image'))
      },
      'image/jpeg',
      0.9
    )
  })
}

export function useImageCompress() {
  return {
    compress: compressImage,
    createThumbnail,
    getImageDimensions,
    isImageFile,
    formatImageSize,
    rotateImage,
    cropImage
  }
}
