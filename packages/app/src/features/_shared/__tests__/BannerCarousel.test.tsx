// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BannerCarousel } from '../BannerCarousel'

afterEach(cleanup)

describe('BannerCarousel', () => {
  it('images 为空数组时返回 null（不摆空占位）', () => {
    const { container } = render(<BannerCarousel images={[]} />)
    expect(container.childElementCount).toBe(0)
  })

  it('注入后渲染每张图与指示器', () => {
    render(
      <BannerCarousel images={[{ uri: 'https://cdn/a.jpg' }, { uri: 'https://cdn/b.jpg' }]} />,
    )
    expect(screen.getByLabelText('轮播图')).toBeTruthy()
    expect(screen.getAllByLabelText(/轮播图 \d/)).toHaveLength(2)
  })
})
