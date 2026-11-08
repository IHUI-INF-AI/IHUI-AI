// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useImeCompositionGuard } from '../use-ime-composition-guard'

afterEach(cleanup)

function Probe({ onEnter, onComma }: { onEnter: () => void; onComma: () => void }) {
  useImeCompositionGuard()
  return (
    <input
      aria-label="probe"
      onKeyDown={(e) => {
        if (e.key === 'Enter') onEnter()
        if (e.key === ',') onComma()
      }}
    />
  )
}

describe('同型根因 S-02:组合态 Enter/逗号全局拦截', () => {
  it('组合态 Enter/逗号不触发业务提交,普通 Enter/逗号正常触发', () => {
    const onEnter = vi.fn()
    const onComma = vi.fn()
    render(<Probe onEnter={onEnter} onComma={onComma} />)
    const input = screen.getByLabelText('probe')

    // 输入法候选词上屏:isComposing + keyCode 229
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, isComposing: true })
    fireEvent.keyDown(input, { key: ',', keyCode: 229, isComposing: true })
    expect(onEnter).not.toHaveBeenCalled()
    expect(onComma).not.toHaveBeenCalled()

    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 })
    fireEvent.keyDown(input, { key: ',', keyCode: 188 })
    expect(onEnter).toHaveBeenCalledTimes(1)
    expect(onComma).toHaveBeenCalledTimes(1)
  })

  it('isComposing=true 但 keyCode 非 229 同样拦截', () => {
    const onEnter = vi.fn()
    render(<Probe onEnter={onEnter} onComma={() => {}} />)
    const input = screen.getByLabelText('probe')
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13, isComposing: true })
    expect(onEnter).not.toHaveBeenCalled()
  })
})
