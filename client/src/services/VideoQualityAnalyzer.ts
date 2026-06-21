import { t } from '@/utils/i18n'

/**
 * 视频质量分析服务
 * 
 * 功能：
 * 1. 视频帧采样和分析
 * 2. 清晰度、流畅度、色彩质量评估
 * 3. 问题检测和修复建议
 * 4. 人物一致性检测
 * 
 * @module services/VideoQualityAnalyzer
 * @version 1.0.0
 */

import { ref, type Ref } from 'vue'
import { logger } from '@/utils/logger'
import type {
  VideoAnalysisResult,
  FrameAnalysis,
  QualityIssue,
  QualityReport,
} from '@/types/ai-platform.types'

// ============================================================================
// 类型定义
// ============================================================================

/** 分析配置 */
interface AnalysisConfig {
  /** 采样率（每秒采样帧数） */
  samplingRate: number
  /** 最大采样帧数 */
  maxFrames: number
  /** 分析超时时间（毫秒） */
  timeout: number
  /** 是否检测运动模糊 */
  detectMotionBlur: boolean
  /** 最小清晰度分数 */
  minClarityScore: number
}

/** 帧数据 */
interface FrameData {
  index: number
  timestamp: number
  imageData: ImageData
  width: number
  height: number
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: AnalysisConfig = {
  samplingRate: 2,
  maxFrames: 30,
  timeout: 60000,
  detectMotionBlur: true,
  minClarityScore: 60,
}

// ============================================================================
// 图像分析工具函数
// ============================================================================

/**
 * 计算图像清晰度（使用拉普拉斯算子）
 */
const calculateClarity = (imageData: ImageData): number => {
  const data = imageData.data
  const width = imageData.width
  const height = imageData.height
  
  // 转换为灰度图
  const grayscale: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    grayscale.push(gray)
  }
  
  // 应用拉普拉斯算子
  let variance = 0
  let count = 0
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const laplacian = 
        -grayscale[idx - width - 1] - grayscale[idx - width] - grayscale[idx - width + 1]
        - grayscale[idx - 1] + 8 * grayscale[idx] - grayscale[idx + 1]
        - grayscale[idx + width - 1] - grayscale[idx + width] - grayscale[idx + width + 1]
      
      variance += laplacian * laplacian
      count++
    }
  }
  
  // 计算方差并归一化到0-100
  const avgVariance = variance / count
  const score = Math.min(100, Math.sqrt(avgVariance) / 2)
  
  return score
}

/**
 * 计算图像亮度
 */
const calculateBrightness = (imageData: ImageData): number => {
  const data = imageData.data
  let sum = 0
  
  for (let i = 0; i < data.length; i += 4) {
    // 计算亮度 (0.299R + 0.587G + 0.114B)
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  
  const avgBrightness = sum / (data.length / 4)
  
  // 归一化到0-100
  return (avgBrightness / 255) * 100
}

/**
 * 计算图像对比度
 */
const calculateContrast = (imageData: ImageData): number => {
  const data = imageData.data
  let min = 255
  let max = 0
  
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    min = Math.min(min, gray)
    max = Math.max(max, gray)
  }
  
  // 归一化到0-100
  return ((max - min) / 255) * 100
}

/**
 * 计算图像色彩丰富度
 */
const calculateColorfulness = (imageData: ImageData): number => {
  const data = imageData.data
  let rg = 0
  let yb = 0
  let count = 0
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    
    rg += Math.abs(r - g)
    yb += Math.abs(0.5 * (r + g) - b)
    count++
  }
  
  const avgRG = rg / count
  const avgYB = yb / count
  const colorfulness = Math.sqrt(avgRG * avgRG + avgYB * avgYB) + 0.3 * Math.sqrt(avgRG + avgYB)
  
  // 归一化到0-100
  return Math.min(100, colorfulness / 1.5)
}

/**
 * 检测运动模糊
 */
const detectMotionBlur = (
  currentFrame: ImageData,
  previousFrame: ImageData | null
): number => {
  if (!previousFrame) return 0
  
  const currData = currentFrame.data
  const prevData = previousFrame.data
  
  let diff = 0
  const sampleStep = 4 * 10 // 每10个像素采样一次
  
  for (let i = 0; i < currData.length; i += sampleStep) {
    diff += Math.abs(currData[i] - prevData[i]) +
            Math.abs(currData[i + 1] - prevData[i + 1]) +
            Math.abs(currData[i + 2] - prevData[i + 2])
  }
  
  const avgDiff = diff / (currData.length / sampleStep)
  
  // 归一化到0-100（差异越大可能表示运动模糊）
  return Math.min(100, avgDiff / 2)
}

// ============================================================================
// 视频分析服务类
// ============================================================================

export class VideoQualityAnalyzer {
  private config: AnalysisConfig
  private video: HTMLVideoElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  
  constructor(config: Partial<AnalysisConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  /**
   * 分析视频质量
   */
  async analyzeVideo(videoUrl: string): Promise<VideoAnalysisResult> {
    try {
      // 创建视频元素
      this.video = document.createElement('video')
      this.video.crossOrigin = 'anonymous'
      this.video.muted = true
      this.video.src = videoUrl
      
      // 等待视频加载
      await this.waitForVideoLoad()
      
      const duration = this.video.duration
      const fps = 30 // 假设30fps，实际可能需要从视频元数据获取
      const frameCount = Math.floor(duration * fps)
      const resolution = {
        width: this.video.videoWidth,
        height: this.video.videoHeight,
      }
      
      // 创建Canvas
      this.canvas = document.createElement('canvas')
      this.canvas.width = resolution.width
      this.canvas.height = resolution.height
      this.ctx = this.canvas.getContext('2d')!
      
      // 采样帧
      const frames = await this.sampleFrames(duration)
      
      // 分析每一帧
      const frameAnalyses: FrameAnalysis[] = []
      let previousFrameData: ImageData | null = null
      
      for (const frame of frames) {
        const analysis = this.analyzeFrame(frame, previousFrameData)
        frameAnalyses.push(analysis)
        previousFrameData = frame.imageData
      }
      
      // 计算整体分数
      const clarityScore = this.average(frameAnalyses.map(f => f.clarity))
      const colorScore = this.average(frameAnalyses.map(f => f.colorfulness))
      const motionScore = 100 - this.average(frameAnalyses.map(f => f.motionBlur))
      
      // 检测问题帧
      const problematicFrames = frameAnalyses.filter(f => f.issues.length > 0)
      
      // 选择关键帧
      const keyFrames = this.selectKeyFrames(frameAnalyses)
      
      // 收集所有问题
      const allIssues = this.collectIssues(frameAnalyses)
      
      // 生成建议
      const recommendations = this.generateRecommendations(frameAnalyses, allIssues)
      
      // 计算一致性分数（基于帧间差异）
      const consistencyScore = this.calculateConsistencyScore(frameAnalyses)
      
      // 计算总分
      const overallScore = Math.round(
        clarityScore * 0.3 +
        motionScore * 0.25 +
        colorScore * 0.2 +
        consistencyScore * 0.25
      )
      
      return {
        videoUrl,
        duration,
        frameCount,
        fps,
        resolution,
        overallScore,
        clarityScore: Math.round(clarityScore),
        motionScore: Math.round(motionScore),
        colorScore: Math.round(colorScore),
        consistencyScore: Math.round(consistencyScore),
        keyFrames,
        problematicFrames,
        issues: allIssues,
        recommendations,
        analyzedAt: new Date().toISOString(),
      }
      
    } catch (error) {
      logger.error('Video analysis failed:', error)
      throw error
    } finally {
      this.cleanup()
    }
  }
  
  /**
   * 快速质量检测（只分析少量关键帧）
   */
  async quickCheck(videoUrl: string): Promise<QualityReport> {
    const originalConfig = { ...this.config }
    
    try {
      // 使用更少的采样帧
      this.config.samplingRate = 0.5
      this.config.maxFrames = 5
      
      const result = await this.analyzeVideo(videoUrl)
      
      return {
        overallScore: result.overallScore,
        clarity: result.clarityScore,
        colorSaturation: result.colorScore,
        motionSmoothness: result.motionScore,
        characterConsistency: result.consistencyScore,
        issues: result.issues,
        recommendations: result.recommendations,
        analyzedAt: result.analyzedAt,
      }

    } catch (e) { console.error(e); throw e } finally {
      this.config = originalConfig
    }
  }
  
  /**
   * 提取最后一帧
   */
  async extractLastFrame(videoUrl: string): Promise<string> {
    try {
      this.video = document.createElement('video')
      this.video.crossOrigin = 'anonymous'
      this.video.muted = true
      this.video.src = videoUrl
      
      await this.waitForVideoLoad()
      
      // 跳转到最后一帧
      this.video.currentTime = this.video.duration - 0.1
      await this.waitForSeek()
      
      // 创建Canvas并提取
      this.canvas = document.createElement('canvas')
      this.canvas.width = this.video.videoWidth
      this.canvas.height = this.video.videoHeight
      this.ctx = this.canvas.getContext('2d')!
      
      this.ctx.drawImage(this.video, 0, 0)
      
      return this.canvas.toDataURL('image/png')
      
    } finally {
      this.cleanup()
    }
  }
  
  /**
   * 提取指定时间点的帧
   */
  async extractFrameAt(videoUrl: string, time: number): Promise<string> {
    try {
      this.video = document.createElement('video')
      this.video.crossOrigin = 'anonymous'
      this.video.muted = true
      this.video.src = videoUrl
      
      await this.waitForVideoLoad()
      
      this.video.currentTime = Math.min(time, this.video.duration - 0.01)
      await this.waitForSeek()
      
      this.canvas = document.createElement('canvas')
      this.canvas.width = this.video.videoWidth
      this.canvas.height = this.video.videoHeight
      this.ctx = this.canvas.getContext('2d')!
      
      this.ctx.drawImage(this.video, 0, 0)
      
      return this.canvas.toDataURL('image/png')
      
    } finally {
      this.cleanup()
    }
  }
  
  // ==========================================================================
  // 内部方法
  // ==========================================================================
  
  private async waitForVideoLoad(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('视频加载超时'))
      }, this.config.timeout)
      
      this.video!.onloadedmetadata = () => {
        clearTimeout(timeout)
        resolve()
      }
      
      this.video!.onerror = () => {
        clearTimeout(timeout)
        reject(new Error('视频加载失败'))
      }
      
      this.video!.load()
    })
  }
  
  private async waitForSeek(): Promise<void> {
    return new Promise((resolve) => {
      this.video!.onseeked = () => resolve()
    })
  }
  
  private async sampleFrames(duration: number): Promise<FrameData[]> {
    const frames: FrameData[] = []
    const interval = 1 / this.config.samplingRate
    const maxTime = duration - 0.1
    
    let time = 0
    let index = 0
    
    while (time < maxTime && frames.length < this.config.maxFrames) {
      this.video!.currentTime = time
      await this.waitForSeek()
      
      this.ctx!.drawImage(this.video!, 0, 0)
      const imageData = this.ctx!.getImageData(0, 0, this.canvas!.width, this.canvas!.height)
      
      frames.push({
        index,
        timestamp: time,
        imageData,
        width: this.canvas!.width,
        height: this.canvas!.height,
      })
      
      time += interval
      index++
    }
    
    return frames
  }
  
  private analyzeFrame(frame: FrameData, previousFrame: ImageData | null): FrameAnalysis {
    const clarity = calculateClarity(frame.imageData)
    const brightness = calculateBrightness(frame.imageData)
    const contrast = calculateContrast(frame.imageData)
    const colorfulness = calculateColorfulness(frame.imageData)
    const motionBlur = this.config.detectMotionBlur
      ? detectMotionBlur(frame.imageData, previousFrame)
      : 0
    
    const issues: QualityIssue[] = []
    
    // 检测问题
    if (clarity < this.config.minClarityScore) {
      issues.push({
        type: 'blur',
        severity: clarity < 40 ? 'high' : 'medium',
        description: `帧${frame.index}清晰度过低 (${clarity.toFixed(1)})`,
        suggestion: '检查视频生成参数或重新生成',
        timestamp: frame.timestamp,
        frameIndex: frame.index,
      })
    }
    
    if (brightness < 20 || brightness > 90) {
      issues.push({
        type: 'color',
        severity: 'medium',
        description: brightness < 20 ? '画面过暗' : '画面过亮',
        suggestion: '调整提示词中的光线描述',
        timestamp: frame.timestamp,
        frameIndex: frame.index,
      })
    }
    
    if (motionBlur > 60) {
      issues.push({
        type: 'stutter',
        severity: motionBlur > 80 ? 'high' : 'medium',
        description: t('text.video_quality_analyzer.检测到明显运动模'),
        suggestion: '减少画面中的快速运动或使用更高帧率',
        timestamp: frame.timestamp,
        frameIndex: frame.index,
      })
    }
    
    return {
      frameIndex: frame.index,
      timestamp: frame.timestamp,
      clarity,
      brightness,
      contrast,
      colorfulness,
      motionBlur,
      issues,
    }
  }
  
  private selectKeyFrames(analyses: FrameAnalysis[]): FrameAnalysis[] {
    // 选择第一帧、最后一帧和中间的最佳帧
    if (analyses.length <= 3) {
      return analyses
    }
    
    const sorted = [...analyses].sort((a, b) => b.clarity - a.clarity)
    const best = sorted.slice(0, 3)
    
    // 确保包含第一帧和最后一帧
    const result = [analyses[0]]
    
    best.forEach(frame => {
      if (!result.find(f => f.frameIndex === frame.frameIndex)) {
        result.push(frame)
      }
    })
    
    result.push(analyses[analyses.length - 1])
    
    return result.slice(0, 5).sort((a, b) => a.frameIndex - b.frameIndex)
  }
  
  private collectIssues(analyses: FrameAnalysis[]): QualityIssue[] {
    const allIssues: QualityIssue[] = []
    const issueCount: Record<string, number> = {}
    
    analyses.forEach(analysis => {
      analysis.issues.forEach(issue => {
        const key = `${issue.type}-${issue.severity}`
        issueCount[key] = (issueCount[key] || 0) + 1
        
        // 只添加代表性问题
        if (issueCount[key] <= 3) {
          allIssues.push(issue)
        }
      })
    })
    
    return allIssues
  }
  
  private generateRecommendations(
    analyses: FrameAnalysis[],
    issues: QualityIssue[]
  ): string[] {
    const recommendations: string[] = []
    
    const avgClarity = this.average(analyses.map(f => f.clarity))
    const avgBrightness = this.average(analyses.map(f => f.brightness))
    const avgColorfulness = this.average(analyses.map(f => f.colorfulness))
    
    if (avgClarity < 60) {
      recommendations.push('建议在提示词中添加"高清"、"清晰"等质量关键词')
    }
    
    if (avgBrightness < 30) {
      recommendations.push('画面整体偏暗，建议添加"明亮"、"光线充足"等描述')
    } else if (avgBrightness > 80) {
      recommendations.push('画面整体过亮，建议添加"柔和光线"等描述')
    }
    
    if (avgColorfulness < 30) {
      recommendations.push('色彩较为单调，可以考虑添加"色彩丰富"、"鲜艳"等描述')
    }
    
    const blurCount = issues.filter(i => i.type === 'blur').length
    if (blurCount > analyses.length * 0.3) {
      recommendations.push('多个帧存在模糊问题，建议检查视频生成参数或使用更稳定的场景描述')
    }
    
    if (recommendations.length === 0) {
      recommendations.push('视频质量良好，无需特别优化')
    }
    
    return recommendations
  }
  
  private calculateConsistencyScore(analyses: FrameAnalysis[]): number {
    if (analyses.length < 2) return 100
    
    // 计算相邻帧之间的差异
    let totalDiff = 0
    
    for (let i = 1; i < analyses.length; i++) {
      const prev = analyses[i - 1]
      const curr = analyses[i]
      
      const clarityDiff = Math.abs(curr.clarity - prev.clarity)
      const brightnessDiff = Math.abs(curr.brightness - prev.brightness)
      const colorDiff = Math.abs(curr.colorfulness - prev.colorfulness)
      
      totalDiff += (clarityDiff + brightnessDiff + colorDiff) / 3
    }
    
    const avgDiff = totalDiff / (analyses.length - 1)
    
    // 差异越小，一致性越高
    return Math.max(0, 100 - avgDiff * 2)
  }
  
  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0
    return numbers.reduce((a, b) => a + b, 0) / numbers.length
  }
  
  private cleanup(): void {
    if (this.video) {
      this.video.src = ''
      this.video = null
    }
    this.canvas = null
    this.ctx = null
  }
}

// ============================================================================
// Vue Composable
// ============================================================================

// 单例实例
let instance: VideoQualityAnalyzer | null = null

/**
 * 使用视频质量分析器
 */
export function useVideoQualityAnalyzer(config?: Partial<AnalysisConfig>) {
  if (!instance) {
    instance = new VideoQualityAnalyzer(config)
  }
  
  const isAnalyzing: Ref<boolean> = ref(false)
  const lastResult: Ref<VideoAnalysisResult | null> = ref(null)
  const lastReport: Ref<QualityReport | null> = ref(null)
  
  const analyze = async (videoUrl: string): Promise<VideoAnalysisResult> => {
    isAnalyzing.value = true
    try {
      const result = await instance!.analyzeVideo(videoUrl)
      lastResult.value = result
      return result
    } catch (e) { console.error(e); throw e } finally {
      isAnalyzing.value = false
    }
  }

  const quickCheck = async (videoUrl: string): Promise<QualityReport> => {
    isAnalyzing.value = true
    try {
      const report = await instance!.quickCheck(videoUrl)
      lastReport.value = report
      return report
    } catch (e) { console.error(e); throw e } finally {
      isAnalyzing.value = false
    }
  }

  return {
    // 服务实例
    service: instance,
    
    // 状态
    isAnalyzing,
    lastResult,
    lastReport,
    
    // 方法
    analyze,
    quickCheck,
    extractLastFrame: instance.extractLastFrame.bind(instance),
    extractFrameAt: instance.extractFrameAt.bind(instance),
  }
}

// 默认导出
export default VideoQualityAnalyzer
