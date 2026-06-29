import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * uploadSinglePicture 单元测试
 *
 * 测试范围：
 * 1. 空路径抛错
 * 2. 正确路径上传成功返回 {url}
 * 3. uploadBybase64 未返回 url 时抛错
 * 4. readFileToBase64 失败时抛错传递
 *
 * Mock 策略：
 * - mock @/utils/readFileToBase64.js 的 readFileToBase64
 * - mock @/service/businessCard.js 的 uploadBybase64（动态 import）
 */

// mock readFileToBase64（uploadImage.js 顶层 import）
vi.mock('@/utils/readFileToBase64.js', () => ({
  readFileToBase64: vi.fn(),
}))

// mock businessCard.js（uploadImage.js 动态 import）
vi.mock('@/service/businessCard.js', () => ({
  uploadBybase64: vi.fn(),
}))

// 导入被测模块（在 mock 之后）
import { uploadSinglePicture } from '../uploadImage.js'
import { readFileToBase64 } from '@/utils/readFileToBase64.js'
import { uploadBybase64 } from '@/service/businessCard.js'

describe('uploadSinglePicture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('空路径应抛错', async () => {
    await expect(uploadSinglePicture('')).rejects.toThrow('filePath 不能为空')
    await expect(uploadSinglePicture(null)).rejects.toThrow('filePath 不能为空')
    await expect(uploadSinglePicture(undefined)).rejects.toThrow('filePath 不能为空')
    // 空路径不应调用 readFileToBase64
    expect(readFileToBase64).not.toHaveBeenCalled()
  })

  it('正确路径上传成功应返回 {url}', async () => {
    readFileToBase64.mockResolvedValue('mockBase64Data')
    uploadBybase64.mockResolvedValue({ url: 'https://example.com/test.jpg' })

    const result = await uploadSinglePicture('/tmp/test.jpg')

    expect(result).toEqual({ url: 'https://example.com/test.jpg' })
    expect(readFileToBase64).toHaveBeenCalledWith('/tmp/test.jpg')
    expect(uploadBybase64).toHaveBeenCalledWith('mockBase64Data', expect.stringMatching(/^wx_\d+_[a-z0-9]+\.jpg$/))
  })

  it('uploadBybase64 未返回 url 时应抛错', async () => {
    readFileToBase64.mockResolvedValue('mockBase64Data')
    uploadBybase64.mockResolvedValue({}) // 无 url 字段

    await expect(uploadSinglePicture('/tmp/test.jpg')).rejects.toThrow('上传成功但未返回 url')
  })

  it('uploadBybase64 返回空 url 时应抛错', async () => {
    readFileToBase64.mockResolvedValue('mockBase64Data')
    uploadBybase64.mockResolvedValue({ url: '' })

    await expect(uploadSinglePicture('/tmp/test.jpg')).rejects.toThrow('上传成功但未返回 url')
  })

  it('readFileToBase64 失败时应传递错误', async () => {
    readFileToBase64.mockRejectedValue(new Error('文件读取失败'))

    await expect(uploadSinglePicture('/tmp/test.jpg')).rejects.toThrow('文件读取失败')
    // readFileToBase64 失败时不应调用 uploadBybase64
    expect(uploadBybase64).not.toHaveBeenCalled()
  })

  it('uploadBybase64 失败时应传递错误', async () => {
    readFileToBase64.mockResolvedValue('mockBase64Data')
    uploadBybase64.mockRejectedValue(new Error('上传服务不可用'))

    await expect(uploadSinglePicture('/tmp/test.jpg')).rejects.toThrow('上传服务不可用')
  })

  it('文件名应正确提取扩展名', async () => {
    readFileToBase64.mockResolvedValue('mockBase64Data')
    uploadBybase64.mockResolvedValue({ url: 'https://example.com/test.png' })

    await uploadSinglePicture('/tmp/avatar.PNG')

    // 扩展名应转为小写
    expect(uploadBybase64).toHaveBeenCalledWith('mockBase64Data', expect.stringMatching(/\.png$/))
  })

  it('无扩展名文件应默认 jpg', async () => {
    readFileToBase64.mockResolvedValue('mockBase64Data')
    uploadBybase64.mockResolvedValue({ url: 'https://example.com/test.jpg' })

    await uploadSinglePicture('/tmp/noextension')

    expect(uploadBybase64).toHaveBeenCalledWith('mockBase64Data', expect.stringMatching(/\.jpg$/))
  })
})
