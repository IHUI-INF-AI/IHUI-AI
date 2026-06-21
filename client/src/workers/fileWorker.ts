import { createThumbnail, compressImage } from '../utils/imageCompress'

interface WorkerMessage {
  type: 'compress' | 'thumbnail' | 'hash' | 'chunk'
  id: string
  data: {
    file?: File
    options?: { quality?: number; maxWidth?: number; maxHeight?: number }
    size?: number
    chunkSize?: number
  }
}

interface WorkerResponse {
  type: string
  id: string
  result?: any
  error?: string
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type, id, data } = e.data
  
  try {
    let result: any
    
    switch (type) {
      case 'compress':
        result = await handleCompress(data)
        break
      case 'thumbnail':
        result = await handleThumbnail(data)
        break
      case 'hash':
        result = await handleHash(data)
        break
      case 'chunk':
        result = await handleChunk(data)
        break
      default:
        throw new Error(`Unknown message type: ${type}`)
    }
    
    const response: WorkerResponse = { type, id, result }
    self.postMessage(response)
  } catch (error) {
    const response: WorkerResponse = { 
      type, 
      id, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
    self.postMessage(response)
  }
}

async function handleCompress(data: { file?: File; options?: { quality?: number; maxWidth?: number; maxHeight?: number } }): Promise<Blob> {
  const { file, options } = data
  if (!file) throw new Error('No file provided')
  const result = await compressImage(file, options || {})
  return result.blob
}

async function handleThumbnail(data: { file?: File; size?: number }): Promise<string> {
  const { file, size } = data
  if (!file) throw new Error('No file provided')
  return createThumbnail(file, size || 200)
}

async function handleHash(data: { file?: File }): Promise<string> {
  const { file } = data
  if (!file) throw new Error('No file provided')
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function handleChunk(data: { file?: File; chunkSize?: number }): Promise<ArrayBuffer[]> {
  const { file, chunkSize } = data
  if (!file || !chunkSize) throw new Error('No file or chunkSize provided')
  const chunks: ArrayBuffer[] = []
  let offset = 0
  
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + chunkSize)
    chunks.push(await chunk.arrayBuffer())
    offset += chunkSize
    
    self.postMessage({
      type: 'chunk-progress',
      progress: Math.min(100, Math.round((offset / file.size) * 100))
    })
  }
  
  return chunks
}

export {}
