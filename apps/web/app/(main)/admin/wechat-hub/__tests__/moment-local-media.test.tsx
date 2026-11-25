// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 朋友圈本地媒体面板：只在点击后拉列表/图片；图片 Blob 转对象 URL；
 * 不把文件名伪装成可预览资源，也不在未点击时请求全部动态。
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MomentLocalMedia from '../MomentLocalMedia'
import { wechatHubApi } from '../wechat-hub-api'

vi.mock('../wechat-hub-api', () => ({
  wechatHubApi: {
    fetchMomentMediaList: vi.fn(),
    fetchMomentMediaBlob: vi.fn(),
  },
}))

const createObjectURL = vi.fn(() => 'blob:local-media')
const revokeObjectURL = vi.fn()

beforeEach(() => {
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
  vi.mocked(wechatHubApi.fetchMomentMediaList).mockReset()
  vi.mocked(wechatHubApi.fetchMomentMediaBlob).mockReset()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('MomentLocalMedia', () => {
  it('点击后才拉取列表和图片，并渲染对象 URL', async () => {
    vi.mocked(wechatHubApi.fetchMomentMediaList).mockResolvedValue([
      { name: 'a.jpg', size: 4, contentType: 'image/jpeg' },
    ])
    vi.mocked(wechatHubApi.fetchMomentMediaBlob).mockResolvedValue(
      new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
    )

    render(<MomentLocalMedia accountId="account-1" momentId="m-1" />)
    expect(wechatHubApi.fetchMomentMediaList).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('本地媒体'))
    await waitFor(() => expect(screen.getByAltText('a.jpg')).toBeTruthy())
    expect(wechatHubApi.fetchMomentMediaList).toHaveBeenCalledWith('account-1', 'm-1')
    expect(wechatHubApi.fetchMomentMediaBlob).toHaveBeenCalledWith('account-1', 'm-1', 'a.jpg')
    expect(screen.getByAltText('a.jpg').getAttribute('src')).toBe('blob:local-media')
  })
})
