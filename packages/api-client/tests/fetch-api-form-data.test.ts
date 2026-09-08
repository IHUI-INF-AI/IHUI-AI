// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchApi } from '../src/client.js'
import { setTransport, type Transport } from '../src/transport.js'

describe('fetchApi FormData', () => {
  afterEach(() => {
    setTransport(undefined as unknown as Transport)
  })

  it('原样透传 FormData 且不覆盖 multipart Content-Type', async () => {
    const formData = new FormData()
    formData.append('file', new Blob(['ihui']), 'test.txt')
    const transport = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => '',
      json: async () => ({ code: 0, data: { id: 'file-1' } }),
    })) as unknown as Transport
    setTransport(transport)

    const result = await fetchApi<{ id: string }>('/files/upload/form', {
      method: 'POST',
      body: formData,
    })

    expect(result.success).toBe(true)
    expect(result.data?.id).toBe('file-1')
    const init = transport.mock.calls[0]?.[1] as {
      body?: unknown
      headers?: Record<string, string>
    }
    expect(init.body).toBe(formData)
    expect(init.headers?.['Content-Type']).toBeUndefined()
  })
})
