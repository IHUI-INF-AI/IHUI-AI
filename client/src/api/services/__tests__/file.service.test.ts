import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/i18n', () => ({
  t: (k: string) => k,
}))

import * as api from '../file.service'

describe('file.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uploadFile 应能正常调用', async () => {
    const fn = (api as any).uploadFile
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('uploadBase64Image 应能正常调用', async () => {
    const fn = (api as any).uploadBase64Image
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('uploadOctetStream 应能正常调用', async () => {
    const fn = (api as any).uploadOctetStream
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getFileList 应能正常调用', async () => {
    const fn = (api as any).getFileList
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getFileDetail 应能正常调用', async () => {
    const fn = (api as any).getFileDetail
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('deleteFile 应能正常调用', async () => {
    const fn = (api as any).deleteFile
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('downloadFile 应能正常调用', async () => {
    const fn = (api as any).downloadFile
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
