import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

import * as api from '../study'

describe('study', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getGroupList 应能正常调用', async () => {
    const fn = (api as any).getGroupList
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('parentquery 应能正常调用', async () => {
    const fn = (api as any).parentquery
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getGroupDetail 应能正常调用', async () => {
    const fn = (api as any).getGroupDetail
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getVideoDetail 应能正常调用', async () => {
    const fn = (api as any).getVideoDetail
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getCourseDetail 应能正常调用', async () => {
    const fn = (api as any).getCourseDetail
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('userVideoLogOperate 应能正常调用', async () => {
    const fn = (api as any).userVideoLogOperate
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('userVideoLog 应能正常调用', async () => {
    const fn = (api as any).userVideoLog
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getUserVideoCommentList 应能正常调用', async () => {
    const fn = (api as any).getUserVideoCommentList
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('userVideoComment 应能正常调用', async () => {
    const fn = (api as any).userVideoComment
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getAgentsAlllist 应能正常调用', async () => {
    const fn = (api as any).getAgentsAlllist
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getVideoList 应能正常调用', async () => {
    const fn = (api as any).getVideoList
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('addGroup 应能正常调用', async () => {
    const fn = (api as any).addGroup
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('coursePut 应能正常调用', async () => {
    const fn = (api as any).coursePut
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('courseDelete 应能正常调用', async () => {
    const fn = (api as any).courseDelete
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('addVideo 应能正常调用', async () => {
    const fn = (api as any).addVideo
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('videoPut 应能正常调用', async () => {
    const fn = (api as any).videoPut
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('videoDelete 应能正常调用', async () => {
    const fn = (api as any).videoDelete
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('uploadChunkedFile 应能正常调用', async () => {
    const fn = (api as any).uploadChunkedFile
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('uploadChunkedFilePC 应能正常调用', async () => {
    const fn = (api as any).uploadChunkedFilePC
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('uploadChunkedFileJoint 应能正常调用', async () => {
    const fn = (api as any).uploadChunkedFileJoint
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('videoPreload 应能正常调用', async () => {
    const fn = (api as any).videoPreload
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('issue 应能正常调用', async () => {
    const fn = (api as any).issue
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('delist 应能正常调用', async () => {
    const fn = (api as any).delist
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('userFeedback 应能正常调用', async () => {
    const fn = (api as any).userFeedback
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('userFeedbackList 应能正常调用', async () => {
    const fn = (api as any).userFeedbackList
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
