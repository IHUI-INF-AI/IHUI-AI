// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * sso-redirect-guard 测试(2026-09-22 立)。
 *
 * 这个模块守的是"点了按钮没反应"的真实故障:守卫把受保护目标 307 打回 /sso/login 后,
 * 两个按钮(授权并跳转 / 关闭)的落点都变成"回到本页",用户感知为按钮失灵。
 *
 * 判定逻辑必须确定性、可证伪,故这里把四件事钉死:
 *  1. 同源相对路径的识别边界(跨源、协议相对、自定义协议深链都不该被当成受保护目标);
 *  2. 探测只认 opaqueredirect,**任何异常都不得判成"被拦"**(误拦会破坏正常跳转);
 *  3. 只有"被拦"才触发续期,且续期后再复测一次;
 *  4. 续期失败不向上抛(是否放行由复测决定,不由异常决定)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const refreshMock = vi.hoisted(() => vi.fn<() => Promise<string | null>>())

vi.mock('@ihui/api-client', () => ({ refreshAccessTokenOnce: refreshMock }))

import {
  isSameOriginRelative,
  isBlockedByAuthGuard,
  syncAuthCookie,
  ensureSsoRedirectAllowed,
} from '../sso-redirect-guard'

/** 构造探测响应:本模块只消费 type 字段 */
function probeResponse(type: ResponseType): Response {
  return { type, status: type === 'opaqueredirect' ? 0 : 200 } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  refreshMock.mockReset()
  refreshMock.mockResolvedValue('fresh-token')
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isSameOriginRelative', () => {
  it('相对路径视为受守卫约束', () => {
    expect(isSameOriginRelative('/edu/edu-management/study-plan')).toBe(true)
    expect(isSameOriginRelative('/')).toBe(true)
  })

  it('协议相对 //host 不算同源相对', () => {
    expect(isSameOriginRelative('//evil.example.com/x')).toBe(false)
  })

  it('绝对 URL 与自定义协议深链不算同源相对', () => {
    expect(isSameOriginRelative('https://sub.example.com/cb')).toBe(false)
    expect(isSameOriginRelative('ihui://sso')).toBe(false)
  })
})

describe('isBlockedByAuthGuard - 探测口径', () => {
  it('opaqueredirect 判为被拦', async () => {
    fetchMock.mockResolvedValue(probeResponse('opaqueredirect'))
    await expect(isBlockedByAuthGuard('/admin')).resolves.toBe(true)
  })

  it('正常响应判为放行', async () => {
    fetchMock.mockResolvedValue(probeResponse('basic'))
    await expect(isBlockedByAuthGuard('/admin')).resolves.toBe(false)
  })

  it('探测自身抛错时判为放行(绝不误拦)', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    await expect(isBlockedByAuthGuard('/admin')).resolves.toBe(false)
  })

  it('用 HEAD + redirect:manual 探测(零跟随、无副作用)', async () => {
    fetchMock.mockResolvedValue(probeResponse('basic'))
    await isBlockedByAuthGuard('/admin')
    expect(fetchMock).toHaveBeenCalledWith('/admin', {
      method: 'HEAD',
      redirect: 'manual',
      credentials: 'include',
    })
  })
})

describe('syncAuthCookie', () => {
  it('续期失败不向上抛', async () => {
    refreshMock.mockRejectedValue(new Error('refresh token revoked'))
    await expect(syncAuthCookie()).resolves.toBeUndefined()
  })

  it('续期被调用一次', async () => {
    await syncAuthCookie()
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })
})

describe('ensureSsoRedirectAllowed - 决策链', () => {
  it('非同源相对目标直接放行,不探测不续期', async () => {
    await expect(ensureSsoRedirectAllowed('https://sub.example.com/cb')).resolves.toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('首次探测即放行时不做多余续期', async () => {
    fetchMock.mockResolvedValue(probeResponse('basic'))
    await expect(ensureSsoRedirectAllowed('/edu/a')).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('被拦 → 续期 → 复测放行(本次故障的修复路径)', async () => {
    fetchMock
      .mockResolvedValueOnce(probeResponse('opaqueredirect'))
      .mockResolvedValueOnce(probeResponse('basic'))
    await expect(ensureSsoRedirectAllowed('/edu/edu-management/study-plan')).resolves.toBe(true)
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('被拦 → 续期 → 仍被拦,返回 false(由调用方明示,不再静默循环)', async () => {
    fetchMock.mockResolvedValue(probeResponse('opaqueredirect'))
    await expect(ensureSsoRedirectAllowed('/edu/edu-management/study-plan')).resolves.toBe(false)
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('续期抛错时按同一路径复测,不因异常短路', async () => {
    refreshMock.mockRejectedValue(new Error('401'))
    fetchMock.mockResolvedValue(probeResponse('opaqueredirect'))
    await expect(ensureSsoRedirectAllowed('/admin')).resolves.toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
