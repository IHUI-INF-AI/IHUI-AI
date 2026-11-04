// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 门 285 B 组:BackChevron.color 由「仅小程序声明」收口为两端真实现。
// 本测试直连 packages/app 真身(测试别名把 @ihui/rn-app 指到替身,测替身等于测假),
// 断言传入的 color 真的落到矢量字形 stroke 上,不传时仍走主题档。
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BackChevron } from '../../../packages/app/src/components/BackChevron'

describe('BackChevron color 真消费', () => {
  it('传入 color 时字形 stroke 用该值', () => {
    const { container } = render(<BackChevron colorScheme="light" color="#123456" label="返回" />)
    const svg = container.querySelector('svg')
    expect(svg, '返回键未渲染矢量字形').not.toBeNull()
    expect(svg?.getAttribute('stroke')).toBe('#123456')
  })

  it('不传 color 时回退主题墨迹档', () => {
    const { container } = render(<BackChevron colorScheme="light" label="返回" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('stroke')).not.toBe('#123456')
  })
})
