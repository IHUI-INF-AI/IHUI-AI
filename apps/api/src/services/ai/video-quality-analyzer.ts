/**
 * 视频质量分析服务。
 *
 * 分析生成视频的质量指标：
 * - 技术指标：分辨率/帧率/码率/时长
 * - 视觉指标：清晰度（SSIM 近似）/色彩饱和度/运动幅度
 * - 内容指标：场景切换次数/黑帧检测
 *
 * 设计：本服务接收视频元数据（不直接解码视频流），
 * 适合作为生成任务的后处理步骤，将分析结果回写到任务记录。
 */

export interface VideoMeta {
  videoId: string
  width: number
  height: number
  fps: number
  bitrate: number // kbps
  durationSec: number
  codec: string
  sizeBytes: number
}

export interface VideoFrameStats {
  avgBrightness: number // 0~255
  avgSaturation: number // 0~1
  contrast: number // 0~1
  sceneChanges: number
  blackFrames: number
}

export interface QualityReport {
  videoId: string
  score: number // 0~100
  dimensions: {
    resolution: 'low' | 'sd' | 'hd' | 'fhd' | 'qhd' | 'uhd'
    aspectRatio: string
  }
  technical: {
    bitrateScore: number
    fpsScore: number
    durationScore: number
  }
  visual: {
    clarityScore: number
    colorScore: number
    motionScore: number
  }
  issues: string[]
  recommendation: 'publish' | 'review' | 'reject'
}

/** 分析视频质量，输出综合报告。 */
export function analyzeQuality(meta: VideoMeta, frameStats?: VideoFrameStats): QualityReport {
  const issues: string[] = []
  const resolution = classifyResolution(meta.width, meta.height)
  const aspectRatio = simplifyAspectRatio(meta.width, meta.height)

  // 技术评分
  const bitrateScore = scoreBitrate(meta.bitrate, meta.width * meta.height)
  if (bitrateScore < 60) issues.push(`码率偏低（${meta.bitrate} kbps）可能导致画面模糊`)

  const fpsScore = scoreFps(meta.fps)
  if (meta.fps < 24) issues.push(`帧率 ${meta.fps} 低于 24，画面可能不流畅`)

  const durationScore = scoreDuration(meta.durationSec)
  if (meta.durationSec < 5) issues.push('时长过短（< 5s）')
  if (meta.durationSec > 600) issues.push('时长过长（> 10min）')

  // 视觉评分（无 frameStats 时给中性分）
  const clarityScore = frameStats ? scoreClarity(frameStats.contrast) : 75
  const colorScore = frameStats ? scoreColor(frameStats.avgSaturation) : 75
  const motionScore = frameStats ? scoreMotion(frameStats.sceneChanges, meta.durationSec) : 75

  if (frameStats) {
    if (frameStats.blackFrames > 2) {
      issues.push(`检测到 ${frameStats.blackFrames} 个黑帧，可能存在画面异常`)
    }
    if (frameStats.avgBrightness < 30) issues.push('画面整体过暗')
    if (frameStats.avgBrightness > 230) issues.push('画面整体过亮，可能过曝')
  }

  // 综合评分
  const technicalAvg = (bitrateScore + fpsScore + durationScore) / 3
  const visualAvg = (clarityScore + colorScore + motionScore) / 3
  const score = Math.round(technicalAvg * 0.6 + visualAvg * 0.4)

  let recommendation: QualityReport['recommendation'] = 'publish'
  if (score < 50 || issues.some((i) => i.includes('黑帧'))) recommendation = 'reject'
  else if (score < 75 || issues.length >= 2) recommendation = 'review'

  return {
    videoId: meta.videoId,
    score,
    dimensions: { resolution, aspectRatio },
    technical: { bitrateScore, fpsScore, durationScore },
    visual: { clarityScore, colorScore, motionScore },
    issues,
    recommendation,
  }
}

function classifyResolution(w: number, h: number): QualityReport['dimensions']['resolution'] {
  const min = Math.min(w, h)
  if (min >= 2160) return 'uhd'
  if (min >= 1440) return 'qhd'
  if (min >= 1080) return 'fhd'
  if (min >= 720) return 'hd'
  if (min >= 480) return 'sd'
  return 'low'
}

function simplifyAspectRatio(w: number, h: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const d = gcd(w, h)
  return `${w / d}:${h / d}`
}

function scoreBitrate(bitrate: number, pixels: number): number {
  // 期望码率 ≈ 像素数 / 1000 (kbps)
  const expected = pixels / 1000
  const ratio = bitrate / expected
  if (ratio >= 1) return 100
  if (ratio >= 0.7) return 80
  if (ratio >= 0.5) return 60
  return 30
}

function scoreFps(fps: number): number {
  if (fps >= 60) return 100
  if (fps >= 30) return 90
  if (fps >= 24) return 75
  if (fps >= 15) return 50
  return 20
}

function scoreDuration(sec: number): number {
  if (sec >= 10 && sec <= 300) return 100
  if (sec >= 5 && sec <= 600) return 80
  if (sec >= 1) return 50
  return 10
}

function scoreClarity(contrast: number): number {
  if (contrast > 0.5) return 100
  if (contrast > 0.3) return 80
  if (contrast > 0.15) return 60
  return 30
}

function scoreColor(saturation: number): number {
  if (saturation > 0.4 && saturation < 0.7) return 100
  if (saturation > 0.2 && saturation < 0.85) return 80
  return 50
}

function scoreMotion(sceneChanges: number, durationSec: number): number {
  // 每分钟场景切换 3~8 次为佳
  const cpm = (sceneChanges / Math.max(durationSec, 1)) * 60
  if (cpm >= 3 && cpm <= 8) return 100
  if (cpm >= 1 && cpm <= 15) return 75
  if (cpm === 0) return 40
  return 50
}

/** 批量分析。 */
export function analyzeBatch(
  items: Array<{ meta: VideoMeta; frameStats?: VideoFrameStats }>,
): QualityReport[] {
  return items.map((i) => analyzeQuality(i.meta, i.frameStats))
}
