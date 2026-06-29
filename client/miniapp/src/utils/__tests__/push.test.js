import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * push.js 单元测试
 *
 * 测试范围：
 * 1. getUniCloudSpaceInfo：无 uniCloud / 有 uniCloud / uniCloud 异常
 * 2. getPushClientId：隐私政策未同意时返回 null（隐私保护逻辑）
 *
 * 注意：push.js 大量使用 uni-app 条件编译（// #ifdef APP-PLUS），
 * 在 vitest 环境中这些注释无效，所有分支都会执行。
 * 因此仅测试在测试环境下行为可预测的函数。
 */

import { getUniCloudSpaceInfo, getPushClientId } from '../push.js'

describe('getUniCloudSpaceInfo', () => {
  const originalUniCloud = globalThis.uniCloud

  afterEach(() => {
    // 恢复原始环境
    if (originalUniCloud === undefined) {
      delete globalThis.uniCloud
    } else {
      globalThis.uniCloud = originalUniCloud
    }
  })

  it('无 uniCloud 时应返回"未找到"', () => {
    delete globalThis.uniCloud

    const result = getUniCloudSpaceInfo()

    expect(result).toEqual({
      spaceId: '未找到',
      provider: '未找到',
      spaceName: '未找到',
    })
  })

  it('有 uniCloud 时应返回配置信息', () => {
    globalThis.uniCloud = {
      config: {
        spaceId: 'test-space-id',
        provider: 'aliyun',
        spaceName: '测试空间',
      },
    }

    const result = getUniCloudSpaceInfo()

    expect(result).toEqual({
      spaceId: 'test-space-id',
      provider: 'aliyun',
      spaceName: '测试空间',
    })
  })

  it('uniCloud 无 config 时应返回"未获取到"', () => {
    globalThis.uniCloud = {}

    const result = getUniCloudSpaceInfo()

    expect(result).toEqual({
      spaceId: '未获取到',
      provider: '未获取到',
      spaceName: '未获取到',
    })
  })

  it('uniCloud.config 部分缺失时应返回"未获取到"填充', () => {
    globalThis.uniCloud = {
      config: {
        spaceId: 'partial-id',
      },
    }

    const result = getUniCloudSpaceInfo()

    expect(result).toEqual({
      spaceId: 'partial-id',
      provider: '未获取到',
      spaceName: '未获取到',
    })
  })

  it('uniCloud 访问异常时应返回"获取失败"', () => {
    Object.defineProperty(globalThis, 'uniCloud', {
      get() {
        throw new Error('访问被拒绝')
      },
      configurable: true,
    })

    const result = getUniCloudSpaceInfo()

    expect(result.spaceId).toBe('获取失败')
    expect(result.provider).toBe('获取失败')
    expect(result.spaceName).toBe('获取失败')
    expect(result.error).toBe('访问被拒绝')
  })
})

describe('getPushClientId 隐私保护逻辑', () => {
  const originalUni = globalThis.uni

  beforeEach(() => {
    // mock uni 全局对象
    globalThis.uni = {
      getStorageSync: vi.fn(),
      getPushClientId: vi.fn(),
    }
  })

  afterEach(() => {
    // 恢复原始 uni
    if (originalUni === undefined) {
      delete globalThis.uni
    } else {
      globalThis.uni = originalUni
    }
  })

  it('用户未同意隐私政策时应返回 null（不读取设备信息）', async () => {
    globalThis.uni.getStorageSync.mockReturnValue(false)

    const result = await getPushClientId()

    expect(result).toBeNull()
    // 不应调用 getPushClientId（避免读取 OAID 等设备信息）
    expect(globalThis.uni.getPushClientId).not.toHaveBeenCalled()
  })

  it('用户未同意隐私政策（storage 为空字符串）时应返回 null', async () => {
    globalThis.uni.getStorageSync.mockReturnValue('')

    const result = await getPushClientId()

    expect(result).toBeNull()
    expect(globalThis.uni.getPushClientId).not.toHaveBeenCalled()
  })
})
