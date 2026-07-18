/**
 * 图片加水印工具。
 *
 * 基于 sharp 实现文字水印(SVG 叠加)与图片水印(透明度合成)。
 */
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'

import type { WatermarkPosition } from './video-watermark-util'

export interface ImageWatermarkOptions {
  inputPath: string
  outputPath: string
  watermarkText?: string
  watermarkImage?: string
  position?: WatermarkPosition
  /** 0-1,默认 0.8 */
  opacity?: number
  /** 文字水印字号,默认 32 */
  fontSize?: number
}

export interface ImageWatermarkResult {
  success: boolean
  outputPath: string
  width: number
  height: number
}

function computePosition(
  pos: WatermarkPosition,
  baseW: number,
  baseH: number,
  wmW: number,
  wmH: number,
  margin = 10,
): { left: number; top: number } {
  switch (pos) {
    case 'top-left':
      return { left: margin, top: margin }
    case 'top-right':
      return { left: baseW - wmW - margin, top: margin }
    case 'bottom-left':
      return { left: margin, top: baseH - wmH - margin }
    case 'bottom-right':
      return { left: baseW - wmW - margin, top: baseH - wmH - margin }
    case 'center':
      return { left: Math.round((baseW - wmW) / 2), top: Math.round((baseH - wmH) / 2) }
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function addImageWatermark(
  opts: ImageWatermarkOptions,
): Promise<ImageWatermarkResult> {
  const {
    inputPath,
    outputPath,
    watermarkText,
    watermarkImage,
    position = 'bottom-right',
    opacity = 0.8,
    fontSize = 32,
  } = opts

  if (!watermarkText && !watermarkImage) {
    throw new Error('必须提供 watermarkText 或 watermarkImage 之一')
  }

  const meta = await sharp(inputPath).metadata()
  const baseW = meta.width ?? 0
  const baseH = meta.height ?? 0
  if (baseW === 0 || baseH === 0) {
    throw new Error(`无法读取图片尺寸: ${inputPath}`)
  }

  const alpha = Math.max(0, Math.min(1, opacity))
  let overlay: Buffer
  let wmW: number
  let wmH: number

  if (watermarkImage) {
    const wmBuffer = await readFile(watermarkImage)
    const wmMeta = await sharp(wmBuffer).metadata()
    wmW = wmMeta.width ?? 0
    wmH = wmMeta.height ?? 0
    if (wmW === 0 || wmH === 0) {
      throw new Error(`无法读取水印图片尺寸: ${watermarkImage}`)
    }
    // 用 dest-in 混合模式将水印整体透明度乘以 alpha
    const opacityMask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${wmW}" height="${wmH}"><rect width="100%" height="100%" fill="rgba(255,255,255,${alpha})"/></svg>`,
    )
    overlay = await sharp(wmBuffer)
      .ensureAlpha()
      .composite([{ input: opacityMask, blend: 'dest-in' }])
      .toBuffer()
  } else {
    const text = watermarkText ?? ''
    const lines = text.split('\n')
    const maxLineLen = lines.length > 0 ? Math.max(...lines.map((l) => l.length)) : 0
    wmW = Math.ceil(maxLineLen * fontSize * 0.7) + 24
    wmH = Math.ceil(lines.length * fontSize * 1.3) + 16
    const textBlocks = lines
      .map(
        (line, i) =>
          `<text x="12" y="${(i + 1) * fontSize}" font-size="${fontSize}" font-family="sans-serif" fill="rgba(255,255,255,${alpha})">${escapeXml(line)}</text>`,
      )
      .join('')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${wmW}" height="${wmH}" viewBox="0 0 ${wmW} ${wmH}"><rect x="0" y="0" width="${wmW}" height="${wmH}" rx="6" fill="rgba(0,0,0,${alpha * 0.5})"/>${textBlocks}</svg>`
    overlay = Buffer.from(svg)
  }

  const { left, top } = computePosition(position, baseW, baseH, wmW, wmH)
  const info = await sharp(inputPath)
    .composite([{ input: overlay, left, top }])
    .toFile(outputPath)

  return { success: true, outputPath, width: info.width, height: info.height }
}
