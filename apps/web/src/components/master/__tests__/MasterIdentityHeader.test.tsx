// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MasterIdentityHeader } from '../MasterIdentityHeader'

afterEach(cleanup)

function renderHeader(overrides: Partial<Parameters<typeof MasterIdentityHeader>[0]> = {}) {
  const onRename = vi.fn().mockResolvedValue(undefined)
  const onReset = vi.fn().mockResolvedValue(undefined)
  render(
    <MasterIdentityHeader
      name="总管"
      definitionCount={2}
      approvalCount={1}
      onRename={onRename}
      onReset={onReset}
      onToggleCreate={vi.fn()}
      {...overrides}
    />,
  )
  return { onRename, onReset }
}

describe('MasterIdentityHeader', () => {
  it('显示默认名和注册表/审批统计', () => {
    renderHeader()
    expect(screen.getByRole('heading', { name: '总管' })).toBeTruthy()
    expect(screen.getByText('注册表')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('待审批')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
  })

  it('改名保存后回调真实名字，失败不伪装成功', async () => {
    const { onRename } = renderHeader()
    fireEvent.click(screen.getByRole('button', { name: '重命名' }))
    const input = screen.getByLabelText('总智能体名字')
    fireEvent.change(input, { target: { value: '小度' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(onRename).toHaveBeenCalledWith('小度'))
    expect(screen.queryByLabelText('总智能体名字')).toBeNull()
  })

  it('回调失败时保留编辑态并显示错误', async () => {
    const onRename = vi.fn().mockRejectedValue(new Error('名字只能包含中英文'))
    renderHeader({ onRename })
    fireEvent.click(screen.getByRole('button', { name: '重命名' }))
    fireEvent.change(screen.getByLabelText('总智能体名字'), { target: { value: '小度' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await screen.findByText('名字只能包含中英文')
    expect(screen.getByLabelText('总智能体名字')).toBeTruthy()
  })
})
