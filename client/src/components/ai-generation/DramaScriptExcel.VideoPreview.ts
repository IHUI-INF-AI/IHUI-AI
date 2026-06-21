/**
 * 视频预览与编辑增强模块
 * 
 * 功能：
 * 1. 视频实时预览优化
 * 2. 帧级编辑（截取指定帧、调整时间点）
 * 3. 转场效果预览
 * 4. 视频合并预览
 */

import { logger } from '@/utils/logger'

// ========== 类型定义 ==========

export interface VideoFrame {
  timestamp: number  // 时间戳（秒）
  imageDataUrl: string  // Base64图片数据
  width: number
  height: number
}

export interface VideoClip {
  id: string
  videoUrl: string
  startTime: number  // 开始时间（秒）
  endTime: number  // 结束时间（秒）
  duration: number  // 时长（秒）
}

export interface TransitionEffect {
  type: 'none' | 'fade' | 'dissolve' | 'wipe' | 'slide'
  duration: number  // 转场时长（秒）
  direction?: 'left' | 'right' | 'up' | 'down'
}

export interface PreviewTimeline {
  clips: VideoClip[]
  transitions: TransitionEffect[]
  totalDuration: number
}

export interface FrameExtractionOptions {
  count?: number  // 提取帧数
  interval?: number  // 提取间隔（秒）
  quality?: number  // 图片质量（0-1）
  format?: 'image/jpeg' | 'image/png' | 'image/webp'
}

// ========== 帧提取功能 ==========

/**
 * 从视频中提取指定时间点的帧
 */
export async function extractFrameAtTime(
  videoUrl: string,
  timestamp: number,
  quality: number = 0.92
): Promise<VideoFrame | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.src = videoUrl
    video.muted = true
    video.preload = 'metadata'

    let resolved = false

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onMetadata)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
      video.src = ''
      video.load()
    }

    const onError = () => {
      if (!resolved) {
        resolved = true
        cleanup()
        resolve(null)
      }
    }

    const onMetadata = () => {
      // 确保时间戳在有效范围内
      const targetTime = Math.min(Math.max(0, timestamp), video.duration)
      video.currentTime = targetTime
    }

    const onSeeked = () => {
      if (resolved) return
      resolved = true

      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          cleanup()
          resolve(null)
          return
        }
        
        ctx.drawImage(video, 0, 0)
        const imageDataUrl = canvas.toDataURL('image/jpeg', quality)
        
        cleanup()
        resolve({
          timestamp: video.currentTime,
          imageDataUrl,
          width: video.videoWidth,
          height: video.videoHeight,
        })
      } catch (error) {
        logger.error('Failed to extract frame:', error)
        cleanup()
        resolve(null)
      }
    }

    video.addEventListener('loadedmetadata', onMetadata)
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('error', onError)

    // 超时处理
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        cleanup()
        resolve(null)
      }
    }, 10000)

    video.load()
  })
}

/**
 * 从视频中提取多个帧
 */
export async function extractMultipleFrames(
  videoUrl: string,
  options: FrameExtractionOptions = {}
): Promise<VideoFrame[]> {
  const {
    count = 5,
    interval,
    quality = 0.92,
  } = options

  const frames: VideoFrame[] = []

  // 获取视频时长
  const duration = await getVideoDuration(videoUrl)
  if (duration <= 0) {
    return frames
  }

  // 计算提取时间点
  const timestamps: number[] = []
  
  if (interval && interval > 0) {
    // 按间隔提取
    for (let t = 0; t < duration; t += interval) {
      timestamps.push(t)
    }
  } else {
    // 平均分布提取
    const step = duration / (count + 1)
    for (let i = 1; i <= count; i++) {
      timestamps.push(step * i)
    }
  }

  // 提取帧
  for (const timestamp of timestamps) {
    const frame = await extractFrameAtTime(videoUrl, timestamp, quality)
    if (frame) {
      frames.push(frame)
    }
  }

  return frames
}

/**
 * 获取视频时长
 */
export function getVideoDuration(videoUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.src = videoUrl
    video.preload = 'metadata'

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onMetadata)
      video.removeEventListener('error', onError)
      video.src = ''
    }

    const onMetadata = () => {
      const duration = video.duration
      cleanup()
      resolve(isNaN(duration) ? 0 : duration)
    }

    const onError = () => {
      cleanup()
      resolve(0)
    }

    video.addEventListener('loadedmetadata', onMetadata)
    video.addEventListener('error', onError)

    setTimeout(() => {
      cleanup()
      resolve(0)
    }, 5000)

    video.load()
  })
}

/**
 * 获取视频元数据
 */
export async function getVideoMetadata(videoUrl: string): Promise<{
  duration: number
  width: number
  height: number
  aspectRatio: number
} | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.src = videoUrl
    video.preload = 'metadata'

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onMetadata)
      video.removeEventListener('error', onError)
      video.src = ''
    }

    const onMetadata = () => {
      const result = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        aspectRatio: video.videoWidth / video.videoHeight,
      }
      cleanup()
      resolve(result)
    }

    const onError = () => {
      cleanup()
      resolve(null)
    }

    video.addEventListener('loadedmetadata', onMetadata)
    video.addEventListener('error', onError)

    setTimeout(() => {
      cleanup()
      resolve(null)
    }, 5000)

    video.load()
  })
}

// ========== 视频预览控制 ==========

/**
 * 视频预览控制器
 */
export class VideoPreviewController {
  private videoElement: HTMLVideoElement | null = null
  private isPlaying: boolean = false
  private playbackRate: number = 1
  private loop: boolean = false
  private onTimeUpdateCallback: ((time: number) => void) | null = null
  private onEndedCallback: (() => void) | null = null

  constructor(videoElement?: HTMLVideoElement) {
    if (videoElement) {
      this.attach(videoElement)
    }
  }

  /**
   * 附加到视频元素
   */
  attach(videoElement: HTMLVideoElement): void {
    this.detach()
    this.videoElement = videoElement
    
    videoElement.addEventListener('timeupdate', this.handleTimeUpdate)
    videoElement.addEventListener('ended', this.handleEnded)
    videoElement.addEventListener('play', this.handlePlay)
    videoElement.addEventListener('pause', this.handlePause)
  }

  /**
   * 从视频元素分离
   */
  detach(): void {
    if (this.videoElement) {
      this.videoElement.removeEventListener('timeupdate', this.handleTimeUpdate)
      this.videoElement.removeEventListener('ended', this.handleEnded)
      this.videoElement.removeEventListener('play', this.handlePlay)
      this.videoElement.removeEventListener('pause', this.handlePause)
      this.videoElement = null
    }
  }

  private handleTimeUpdate = (): void => {
    if (this.videoElement && this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(this.videoElement.currentTime)
    }
  }

  private handleEnded = (): void => {
    this.isPlaying = false
    if (this.loop && this.videoElement) {
      this.videoElement.currentTime = 0
      void this.play()
    } else if (this.onEndedCallback) {
      this.onEndedCallback()
    }
  }

  private handlePlay = (): void => {
    this.isPlaying = true
  }

  private handlePause = (): void => {
    this.isPlaying = false
  }

  /**
   * 播放
   */
  async play(): Promise<void> {
    if (this.videoElement) {
      try {
        await this.videoElement.play()
        this.isPlaying = true
      } catch (error) {
        logger.error('Playback failed:', error)
      }
    }
  }

  /**
   * 暂停
   */
  pause(): void {
    if (this.videoElement) {
      this.videoElement.pause()
      this.isPlaying = false
    }
  }

  /**
   * 停止
   */
  stop(): void {
    if (this.videoElement) {
      this.videoElement.pause()
      this.videoElement.currentTime = 0
      this.isPlaying = false
    }
  }

  /**
   * 跳转到指定时间
   */
  seekTo(time: number): void {
    if (this.videoElement) {
      this.videoElement.currentTime = Math.max(0, Math.min(time, this.videoElement.duration || 0))
    }
  }

  /**
   * 设置播放速度
   */
  setPlaybackRate(rate: number): void {
    this.playbackRate = rate
    if (this.videoElement) {
      this.videoElement.playbackRate = rate
    }
  }

  /**
   * 设置循环播放
   */
  setLoop(loop: boolean): void {
    this.loop = loop
    if (this.videoElement) {
      this.videoElement.loop = loop
    }
  }

  /**
   * 设置时间更新回调
   */
  onTimeUpdate(callback: (time: number) => void): void {
    this.onTimeUpdateCallback = callback
  }

  /**
   * 设置播放结束回调
   */
  onEnded(callback: () => void): void {
    this.onEndedCallback = callback
  }

  /**
   * 获取当前时间
   */
  getCurrentTime(): number {
    return this.videoElement?.currentTime || 0
  }

  /**
   * 获取总时长
   */
  getDuration(): number {
    return this.videoElement?.duration || 0
  }

  /**
   * 获取播放状态
   */
  getIsPlaying(): boolean {
    return this.isPlaying
  }

  /**
   * 截取当前帧
   */
  captureCurrentFrame(quality: number = 0.92): string | null {
    if (!this.videoElement) return null

    try {
      const canvas = document.createElement('canvas')
      canvas.width = this.videoElement.videoWidth
      canvas.height = this.videoElement.videoHeight
      
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      
      ctx.drawImage(this.videoElement, 0, 0)
      return canvas.toDataURL('image/jpeg', quality)
    } catch (error) {
      logger.error('Failed to capture frame:', error)
      return null
    }
  }
}

// ========== 转场效果预览 ==========

/**
 * 获取预设转场效果
 */
export function getTransitionPresets(): TransitionEffect[] {
  return [
    { type: 'none', duration: 0 },
    { type: 'fade', duration: 0.5 },
    { type: 'fade', duration: 1 },
    { type: 'dissolve', duration: 0.5 },
    { type: 'dissolve', duration: 1 },
    { type: 'wipe', duration: 0.5, direction: 'left' },
    { type: 'wipe', duration: 0.5, direction: 'right' },
    { type: 'slide', duration: 0.5, direction: 'left' },
    { type: 'slide', duration: 0.5, direction: 'up' },
  ]
}

/**
 * 获取转场效果名称
 */
export function getTransitionName(effect: TransitionEffect): string {
  const names: Record<string, string> = {
    'none': '无转场',
    'fade': '淡入淡出',
    'dissolve': '溶解',
    'wipe': '擦除',
    'slide': '滑动',
  }
  
  let name = names[effect.type] || effect.type
  
  if (effect.direction) {
    const directions: Record<string, string> = {
      'left': '向左',
      'right': '向右',
      'up': '向上',
      'down': '向下',
    }
    name += ` (${directions[effect.direction] || effect.direction})`
  }
  
  if (effect.duration > 0) {
    name += ` ${effect.duration}s`
  }
  
  return name
}

/**
 * 生成转场CSS动画
 */
export function generateTransitionCSS(effect: TransitionEffect): string {
  const duration = effect.duration || 0.5
  
  switch (effect.type) {
    case 'fade':
      return `
        @keyframes fadeTransition {
          0% { opacity: 1; }
          50% { opacity: 0; }
          100% { opacity: 1; }
        }
        .transition-active {
          animation: fadeTransition ${duration * 2}s ease-in-out;
        }
      `
    
    case 'dissolve':
      return `
        @keyframes dissolveTransition {
          0% { opacity: 1; filter: blur(0px); }
          50% { opacity: 0.5; filter: blur(4px); }
          100% { opacity: 1; filter: blur(0px); }
        }
        .transition-active {
          animation: dissolveTransition ${duration * 2}s ease-in-out;
        }
      `
    
    case 'wipe': {
      const wipeDirection = effect.direction || 'left'
      const clipPath = {
        'left': 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)',
        'right': 'polygon(0 0, 0 0, 0 100%, 0 100%)',
        'up': 'polygon(0 100%, 100% 100%, 100% 100%, 0 100%)',
        'down': 'polygon(0 0, 100% 0, 100% 0, 0 0)',
      }[wipeDirection]
      
      return `
        @keyframes wipeTransition {
          0% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
          50% { clip-path: ${clipPath}; }
          100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
        }
        .transition-active {
          animation: wipeTransition ${duration * 2}s ease-in-out;
        }
      `
    }
    
    case 'slide': {
      const slideDirection = effect.direction || 'left'
      const transform = {
        'left': 'translateX(-100%)',
        'right': 'translateX(100%)',
        'up': 'translateY(-100%)',
        'down': 'translateY(100%)',
      }[slideDirection]
      
      return `
        @keyframes slideTransition {
          0% { transform: translateX(0) translateY(0); }
          50% { transform: ${transform}; }
          100% { transform: translateX(0) translateY(0); }
        }
        .transition-active {
          animation: slideTransition ${duration * 2}s ease-in-out;
        }
      `
    }
    
    default:
      return ''
  }
}

// ========== 时间线预览 ==========

/**
 * 创建预览时间线
 */
export function createPreviewTimeline(
  clips: VideoClip[],
  defaultTransition: TransitionEffect = { type: 'fade', duration: 0.5 }
): PreviewTimeline {
  const transitions: TransitionEffect[] = []
  let totalDuration = 0

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]
    totalDuration += clip.duration

    // 在片段之间添加转场
    if (i < clips.length - 1) {
      transitions.push({ ...defaultTransition })
      // 转场时间会覆盖一部分，但为简化计算，暂不扣除
    }
  }

  return {
    clips,
    transitions,
    totalDuration,
  }
}

/**
 * 计算时间线中的当前片段
 */
export function getClipAtTime(
  timeline: PreviewTimeline,
  time: number
): { clipIndex: number; clipTime: number } | null {
  let accumulatedTime = 0

  for (let i = 0; i < timeline.clips.length; i++) {
    const clip = timeline.clips[i]
    const clipEnd = accumulatedTime + clip.duration

    if (time >= accumulatedTime && time < clipEnd) {
      return {
        clipIndex: i,
        clipTime: time - accumulatedTime + clip.startTime,
      }
    }

    accumulatedTime = clipEnd
  }

  return null
}

/**
 * 生成预览缩略图
 */
export async function generateTimelineThumbnails(
  timeline: PreviewTimeline,
  thumbnailCount: number = 10
): Promise<Array<{ time: number; imageUrl: string }>> {
  const thumbnails: Array<{ time: number; imageUrl: string }> = []
  const interval = timeline.totalDuration / thumbnailCount

  for (let i = 0; i < thumbnailCount; i++) {
    const time = i * interval
    const clipInfo = getClipAtTime(timeline, time)

    if (clipInfo) {
      const clip = timeline.clips[clipInfo.clipIndex]
      const frame = await extractFrameAtTime(clip.videoUrl, clipInfo.clipTime)

      if (frame) {
        thumbnails.push({
          time,
          imageUrl: frame.imageDataUrl,
        })
      }
    }
  }

  return thumbnails
}

// ========== 视频剪辑辅助 ==========

/**
 * 计算视频片段信息
 */
export async function analyzeVideoClip(videoUrl: string): Promise<VideoClip | null> {
  const metadata = await getVideoMetadata(videoUrl)
  if (!metadata) return null

  return {
    id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    videoUrl,
    startTime: 0,
    endTime: metadata.duration,
    duration: metadata.duration,
  }
}

/**
 * 裁剪视频片段（仅更新元数据，实际裁剪需要后端支持）
 */
export function trimClip(
  clip: VideoClip,
  startTime: number,
  endTime: number
): VideoClip {
  const newStartTime = Math.max(0, Math.min(startTime, clip.endTime))
  const newEndTime = Math.max(newStartTime, Math.min(endTime, clip.endTime))

  return {
    ...clip,
    startTime: newStartTime,
    endTime: newEndTime,
    duration: newEndTime - newStartTime,
  }
}

/**
 * 合并多个片段的预览信息
 */
export function mergeClipsInfo(clips: VideoClip[]): {
  totalDuration: number
  clipCount: number
  averageDuration: number
} {
  const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0)
  
  return {
    totalDuration,
    clipCount: clips.length,
    averageDuration: clips.length > 0 ? totalDuration / clips.length : 0,
  }
}
