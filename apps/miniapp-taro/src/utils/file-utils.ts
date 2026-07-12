import Taro from '@tarojs/taro'

export function readFileToBase64(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fsm = Taro.getFileSystemManager()
    fsm.readFile({
      filePath,
      encoding: 'base64',
      success: (res) => resolve(res.data as string),
      fail: (err) => reject(err),
    })
  })
}

export function writeFileFromBase64(base64Data: string, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const fsm = Taro.getFileSystemManager()
    fsm.writeFile({
      filePath,
      data: base64Data,
      encoding: 'base64',
      success: () => resolve(),
      fail: (err) => reject(err),
    })
  })
}

export interface CanvasToTempFilePathOptions {
  canvasId?: string
  x?: number
  y?: number
  width?: number
  height?: number
  destWidth?: number
  destHeight?: number
  fileType?: 'jpg' | 'png'
  quality?: number
}

export function canvasToTempFilePath(options: CanvasToTempFilePathOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    Taro.canvasToTempFilePath({
      ...options,
      success: (res) => resolve(res.tempFilePath),
      fail: (err) => reject(err),
    })
  })
}

export { readFileToBase64 as readFileAsBase64 }
