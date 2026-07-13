import { describe, it, expect } from 'vitest'
import { analyzeQuality, analyzeBatch } from '../src/services/ai/video-quality-analyzer.js'
import type { VideoMeta, VideoFrameStats } from '../src/services/ai/video-quality-analyzer.js'

const baseMeta: VideoMeta = {
  videoId: 'vid-1',
  width: 1920,
  height: 1080,
  fps: 30,
  bitrate: 2000,
  durationSec: 60,
  codec: 'h264',
  sizeBytes: 15_000_000,
}

describe('video-quality-analyzer 视频质量分析', () => {
  describe('analyzeQuality 分辨率分类', () => {
    it('2160p 分类为 uhd', () => {
      const r = analyzeQuality({ ...baseMeta, width: 3840, height: 2160 })
      expect(r.dimensions.resolution).toBe('uhd')
    })

    it('1440p 分类为 qhd', () => {
      const r = analyzeQuality({ ...baseMeta, width: 2560, height: 1440 })
      expect(r.dimensions.resolution).toBe('qhd')
    })

    it('1080p 分类为 fhd', () => {
      const r = analyzeQuality({ ...baseMeta, width: 1920, height: 1080 })
      expect(r.dimensions.resolution).toBe('fhd')
    })

    it('720p 分类为 hd', () => {
      const r = analyzeQuality({ ...baseMeta, width: 1280, height: 720 })
      expect(r.dimensions.resolution).toBe('hd')
    })

    it('480p 分类为 sd', () => {
      const r = analyzeQuality({ ...baseMeta, width: 854, height: 480 })
      expect(r.dimensions.resolution).toBe('sd')
    })

    it('360p 分类为 low', () => {
      const r = analyzeQuality({ ...baseMeta, width: 640, height: 360 })
      expect(r.dimensions.resolution).toBe('low')
    })

    it('宽高比简化', () => {
      const r = analyzeQuality({ ...baseMeta, width: 1920, height: 1080 })
      expect(r.dimensions.aspectRatio).toBe('16:9')
    })

    it('正方形宽高比', () => {
      const r = analyzeQuality({ ...baseMeta, width: 1080, height: 1080 })
      expect(r.dimensions.aspectRatio).toBe('1:1')
    })
  })

  describe('analyzeQuality 技术评分', () => {
    it('高码率得满分', () => {
      const r = analyzeQuality({ ...baseMeta, bitrate: 10000 })
      expect(r.technical.bitrateScore).toBe(100)
    })

    it('低码率得低分并产生 issue', () => {
      const r = analyzeQuality({ ...baseMeta, bitrate: 100 })
      expect(r.technical.bitrateScore).toBeLessThan(60)
      expect(r.issues.some((i) => i.includes('码率偏低'))).toBe(true)
    })

    it('60fps 得满分', () => {
      const r = analyzeQuality({ ...baseMeta, fps: 60 })
      expect(r.technical.fpsScore).toBe(100)
    })

    it('低于 24fps 产生 issue', () => {
      const r = analyzeQuality({ ...baseMeta, fps: 15 })
      expect(r.technical.fpsScore).toBe(50)
      expect(r.issues.some((i) => i.includes('帧率'))).toBe(true)
    })

    it('10~300 秒时长得满分', () => {
      const r = analyzeQuality({ ...baseMeta, durationSec: 60 })
      expect(r.technical.durationScore).toBe(100)
    })

    it('过短时长产生 issue', () => {
      const r = analyzeQuality({ ...baseMeta, durationSec: 3 })
      expect(r.issues.some((i) => i.includes('时长过短'))).toBe(true)
    })

    it('过长时长产生 issue', () => {
      const r = analyzeQuality({ ...baseMeta, durationSec: 700 })
      expect(r.issues.some((i) => i.includes('时长过长'))).toBe(true)
    })
  })

  describe('analyzeQuality 视觉评分（无 frameStats 时给中性分 75）', () => {
    it('无 frameStats 时视觉分全 75', () => {
      const r = analyzeQuality(baseMeta)
      expect(r.visual.clarityScore).toBe(75)
      expect(r.visual.colorScore).toBe(75)
      expect(r.visual.motionScore).toBe(75)
    })
  })

  describe('analyzeQuality 视觉评分（有 frameStats）', () => {
    it('高对比度得高清晰度分', () => {
      const stats: VideoFrameStats = {
        avgBrightness: 128,
        avgSaturation: 0.5,
        contrast: 0.6,
        sceneChanges: 5,
        blackFrames: 0,
      }
      const r = analyzeQuality(baseMeta, stats)
      expect(r.visual.clarityScore).toBe(100)
    })

    it('适中饱和度得满分', () => {
      const r = analyzeQuality(baseMeta, {
        avgBrightness: 128,
        avgSaturation: 0.5,
        contrast: 0.4,
        sceneChanges: 5,
        blackFrames: 0,
      })
      expect(r.visual.colorScore).toBe(100)
    })

    it('每分钟 3~8 次场景切换得满分', () => {
      const r = analyzeQuality(baseMeta, {
        avgBrightness: 128,
        avgSaturation: 0.5,
        contrast: 0.4,
        sceneChanges: 5,
        blackFrames: 0,
      })
      expect(r.visual.motionScore).toBe(100)
    })

    it('黑帧超过 2 产生 issue', () => {
      const r = analyzeQuality(baseMeta, {
        avgBrightness: 128,
        avgSaturation: 0.5,
        contrast: 0.4,
        sceneChanges: 5,
        blackFrames: 3,
      })
      expect(r.issues.some((i) => i.includes('黑帧'))).toBe(true)
    })

    it('画面过暗产生 issue', () => {
      const r = analyzeQuality(baseMeta, {
        avgBrightness: 20,
        avgSaturation: 0.5,
        contrast: 0.4,
        sceneChanges: 5,
        blackFrames: 0,
      })
      expect(r.issues.some((i) => i.includes('过暗'))).toBe(true)
    })

    it('画面过亮产生 issue', () => {
      const r = analyzeQuality(baseMeta, {
        avgBrightness: 235,
        avgSaturation: 0.5,
        contrast: 0.4,
        sceneChanges: 5,
        blackFrames: 0,
      })
      expect(r.issues.some((i) => i.includes('过亮'))).toBe(true)
    })
  })

  describe('analyzeQuality 推荐等级', () => {
    it('高质量视频推荐 publish', () => {
      const r = analyzeQuality({
        ...baseMeta,
        bitrate: 5000,
        fps: 60,
        durationSec: 60,
      })
      expect(r.recommendation).toBe('publish')
    })

    it('黑帧视频推荐 reject', () => {
      const r = analyzeQuality(baseMeta, {
        avgBrightness: 128,
        avgSaturation: 0.5,
        contrast: 0.4,
        sceneChanges: 5,
        blackFrames: 5,
      })
      expect(r.recommendation).toBe('reject')
    })

    it('低分视频推荐 review', () => {
      const r = analyzeQuality({
        ...baseMeta,
        bitrate: 500,
        fps: 15,
        durationSec: 3,
      })
      expect(['review', 'reject']).toContain(r.recommendation)
    })

    it('综合评分 = 技术 60% + 视觉 40%', () => {
      const r = analyzeQuality({ ...baseMeta, bitrate: 5000, fps: 60 })
      const expected = Math.round(((100 + 100 + 100) / 3) * 0.6 + ((75 + 75 + 75) / 3) * 0.4)
      expect(r.score).toBe(expected)
    })
  })

  describe('analyzeBatch 批量分析', () => {
    it('批量分析返回对应数量的报告', () => {
      const items = [
        { meta: { ...baseMeta, videoId: 'v1' } },
        { meta: { ...baseMeta, videoId: 'v2' } },
        { meta: { ...baseMeta, videoId: 'v3' } },
      ]
      const reports = analyzeBatch(items)
      expect(reports.length).toBe(3)
      expect(reports.map((r) => r.videoId)).toEqual(['v1', 'v2', 'v3'])
    })

    it('空数组返回空数组', () => {
      expect(analyzeBatch([])).toEqual([])
    })
  })
})
