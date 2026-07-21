import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { VoiceService, getVoiceService } from '../src/services/clawdbot/voice.js'

describe('clawdbot VoiceService 语音服务', () => {
  let svc: VoiceService

  beforeEach(() => {
    svc = new VoiceService()
  })

  describe('asr 语音识别', () => {
    it('返回简化结果（空 text + language 默认 zh）', async () => {
      const r = await svc.asr({ audio: Buffer.from('x'), format: 'wav' })
      expect(r.text).toBe('')
      expect(r.confidence).toBe(0)
      expect(r.language).toBe('zh')
      expect(r.duration).toBe(0)
    })

    it('指定 language', async () => {
      const r = await svc.asr({ audio: Buffer.from('x'), format: 'mp3', language: 'en' })
      expect(r.language).toBe('en')
    })

    it('触发 asrRequested 事件', async () => {
      const handler = vi.fn()
      svc.on('asrRequested', handler)
      await svc.asr({ audio: Buffer.from('x'), format: 'wav' })
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('tts 语音合成', () => {
    it('返回空 Buffer 与默认 wav 格式', async () => {
      const r = await svc.tts({ text: 'hello' })
      expect(r.audio).toBeInstanceOf(Buffer)
      expect(r.audio.length).toBe(0)
      expect(r.format).toBe('wav')
      expect(r.duration).toBe(0)
    })

    it('指定 format', async () => {
      const r = await svc.tts({ text: 'hi', format: 'mp3' })
      expect(r.format).toBe('mp3')
    })

    it('触发 ttsRequested 事件', async () => {
      const handler = vi.fn()
      svc.on('ttsRequested', handler)
      await svc.tts({ text: 'hi' })
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('enrollVoiceprint 声纹注册', () => {
    it('创建声纹并存储', async () => {
      const v = await svc.enrollVoiceprint('u1', Buffer.from('x'))
      expect(v.id).toMatch(/^vp_[a-z0-9]+$/)
      expect(v.userId).toBe('u1')
      expect(v.embedding).toEqual([])
      expect(v.createdAt).toBeGreaterThan(0)
    })

    it('触发 voiceprintEnrolled 事件', async () => {
      const handler = vi.fn()
      svc.on('voiceprintEnrolled', handler)
      await svc.enrollVoiceprint('u1', Buffer.from('x'))
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('verifyVoiceprint 声纹验证', () => {
    it('用户无声纹返回 matched=false', async () => {
      const r = await svc.verifyVoiceprint('u1', Buffer.from('x'))
      expect(r.matched).toBe(false)
      expect(r.confidence).toBe(0)
      expect(r.voiceprintId).toBeUndefined()
    })

    it('用户有声纹返回 matched=true', async () => {
      await svc.enrollVoiceprint('u1', Buffer.from('x'))
      const r = await svc.verifyVoiceprint('u1', Buffer.from('x'))
      expect(r.matched).toBe(true)
      expect(r.confidence).toBeGreaterThan(0)
      expect(r.voiceprintId).toBeDefined()
    })
  })

  describe('listVoiceprints 列表', () => {
    it('返回全部声纹', async () => {
      await svc.enrollVoiceprint('u1', Buffer.from('x'))
      await svc.enrollVoiceprint('u2', Buffer.from('x'))
      expect(svc.listVoiceprints()).toHaveLength(2)
    })

    it('按 userId 过滤', async () => {
      await svc.enrollVoiceprint('u1', Buffer.from('x'))
      await svc.enrollVoiceprint('u1', Buffer.from('x'))
      await svc.enrollVoiceprint('u2', Buffer.from('x'))
      expect(svc.listVoiceprints('u1')).toHaveLength(2)
    })
  })

  describe('deleteVoiceprint 删除', () => {
    it('删除存在声纹返回 true', async () => {
      const v = await svc.enrollVoiceprint('u1', Buffer.from('x'))
      expect(svc.deleteVoiceprint(v.id)).toBe(true)
      expect(svc.listVoiceprints()).toHaveLength(0)
    })

    it('删除不存在返回 false', () => {
      expect(svc.deleteVoiceprint('not_exist')).toBe(false)
    })
  })

  describe('getStats 统计', () => {
    it('返回声纹数与唯一用户数', async () => {
      await svc.enrollVoiceprint('u1', Buffer.from('x'))
      await svc.enrollVoiceprint('u1', Buffer.from('x'))
      await svc.enrollVoiceprint('u2', Buffer.from('x'))
      const s = svc.getStats()
      expect(s.voiceprints).toBe(3)
      expect(s.uniqueUsers).toBe(2)
    })
  })

  describe('单例', () => {
    it('getVoiceService 返回同一实例', () => {
      expect(getVoiceService()).toBe(getVoiceService())
    })
  })
})
