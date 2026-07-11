// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => React.createElement('img', { src, alt }),
}))

import { FilePreview } from '../FilePreview'

describe('TextPreview AbortController 竞态修复', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi
      .fn()
      .mockImplementation(() => new Promise(() => {})) as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('url 变化时取消之前的请求(调用 abort)', () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>

    const { rerender } = render(<FilePreview url="https://example.com/a.txt" type="text" />)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const firstSignal = fetchMock.mock.calls[0]![1].signal as AbortSignal
    expect(firstSignal.aborted).toBe(false)

    rerender(<FilePreview url="https://example.com/b.txt" type="text" />)

    expect(firstSignal.aborted).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('卸载时取消请求(调用 abort)', () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>

    const { unmount } = render(<FilePreview url="https://example.com/a.txt" type="text" />)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const signal = fetchMock.mock.calls[0]![1].signal as AbortSignal
    expect(signal.aborted).toBe(false)

    unmount()

    expect(signal.aborted).toBe(true)
  })
})
