/**
 * 视频加水印工具。
 *
 * 通过 child_process spawn 调用 ffmpeg,支持文字水印与图片水印。
 * ffmpeg 不可用时抛出明确错误,不静默失败。
 */
import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'

export type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'

export interface VideoWatermarkOptions {
  inputPath: string
  outputPath: string
  watermarkText?: string
  watermarkImage?: string
  position?: WatermarkPosition
  /** 0-1,默认 0.8 */
  opacity?: number
}

export interface VideoWatermarkResult {
  success: boolean
  outputPath: string
  durationMs: number
}

/** 检查 ffmpeg 是否可用 */
async function checkFfmpeg(): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-version'])
    proc.on('error', () => reject(new Error('ffmpeg 不可用,请先安装 ffmpeg 并加入 PATH')))
    proc.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg 版本检查失败,退出码 ${code}`))
    })
  })
}

async function assertFile(p: string): Promise<void> {
  try {
    await access(p)
  } catch {
    throw new Error(`文件不存在或不可访问: ${p}`)
  }
}

/** overlay 滤镜坐标(用于图片水印) */
function overlayPos(pos: WatermarkPosition): { x: string; y: string } {
  switch (pos) {
    case 'top-left':
      return { x: '10', y: '10' }
    case 'top-right':
      return { x: 'main_w-overlay_w-10', y: '10' }
    case 'bottom-left':
      return { x: '10', y: 'main_h-overlay_h-10' }
    case 'bottom-right':
      return { x: 'main_w-overlay_w-10', y: 'main_h-overlay_h-10' }
    case 'center':
      return { x: '(main_w-overlay_w)/2', y: '(main_h-overlay_h)/2' }
  }
}

/** drawtext 滤镜坐标(用于文字水印) */
function drawtextPos(pos: WatermarkPosition): { x: string; y: string } {
  switch (pos) {
    case 'top-left':
      return { x: '10', y: '10' }
    case 'top-right':
      return { x: 'main_w-text_w-10', y: '10' }
    case 'bottom-left':
      return { x: '10', y: 'main_h-text_h-10' }
    case 'bottom-right':
      return { x: 'main_w-text_w-10', y: 'main_h-text_h-10' }
    case 'center':
      return { x: '(main_w-text_w)/2', y: '(main_h-text_h)/2' }
  }
}

/** drawtext 文本转义(过滤 ffmpeg 滤镜语法字符) */
function escapeDrawtext(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:')
}

export async function addVideoWatermark(
  opts: VideoWatermarkOptions,
): Promise<VideoWatermarkResult> {
  const {
    inputPath,
    outputPath,
    watermarkText,
    watermarkImage,
    position = 'bottom-right',
    opacity = 0.8,
  } = opts

  if (!watermarkText && !watermarkImage) {
    throw new Error('必须提供 watermarkText 或 watermarkImage 之一')
  }
  await assertFile(inputPath)
  await checkFfmpeg()

  const start = Date.now()
  const alpha = Math.max(0, Math.min(1, opacity))

  let filter: string
  if (watermarkImage) {
    await assertFile(watermarkImage)
    const { x, y } = overlayPos(position)
    // 图片水印:[1]=水印图,先调透明度再 overlay 到主视频 [0]
    filter = `[1]format=rgba,colorchannelmixer=aa=${alpha}[wm];[0][wm]overlay=${x}:${y}`
  } else {
    const { x, y } = drawtextPos(position)
    const text = escapeDrawtext(watermarkText ?? '')
    filter = `drawtext=text='${text}':x=${x}:y=${y}:fontsize=28:fontcolor=white@${alpha}:box=1:boxcolor=black@${alpha * 0.5}:boxborderw=8`
  }

  const args = ['-y', '-i', inputPath]
  if (watermarkImage) args.push('-i', watermarkImage)
  args.push('-filter_complex', filter, '-c:a', 'copy', outputPath)

  await new Promise<void>((resolve, reject) => {
    const proc = spawn('ffmpeg', args)
    let stderr = ''
    if (proc.stderr) {
      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })
    }
    proc.on('error', (err) => reject(new Error(`ffmpeg 启动失败: ${err.message}`)))
    proc.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg 执行失败(退出码 ${code}): ${stderr.slice(-500)}`))
    })
  })

  return { success: true, outputPath, durationMs: Date.now() - start }
}
