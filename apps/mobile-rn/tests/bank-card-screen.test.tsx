// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * BankCardScreen 写闭环交互夹具（2026-11-27）。
 *
 * 判据：新增表单把带空格卡号归一化后交给注入的 onAddCard；编辑卡可设默认/二次确认删除；
 * 历史提现投影卡(readOnly)不出现任何写按钮。列表渲染走共享 react-native mock 的真 FlatList。
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { createElement } from 'react'

vi.mock('lucide-react-native', () => ({
  ChevronLeft: () => createElement('i', null),
}))

import { BankCardScreen } from '../../../packages/app/src/features/bank-card/BankCardScreen'
import type { BankCardInput, BankCardItem } from '../../../packages/app/src/types'

const t = (key: string) => key

const items: BankCardItem[] = [
  {
    id: 'a',
    number: '**** **** **** 1111',
    holder: '张三',
    bankName: '招商银行',
    isDefault: true,
  },
  {
    id: 'b',
    number: '**** **** **** 2222',
    holder: '李四',
    bankName: '工商银行',
    isDefault: false,
  },
  {
    id: 'history',
    number: '**** **** **** 3333',
    holder: '王五',
    bankName: '历史提现卡',
    isDefault: false,
    readOnly: true,
  },
]

function baseProps() {
  return {
    t,
    items,
    loading: false,
    refreshing: false,
    error: '',
    onRefresh: vi.fn(),
    onBack: vi.fn(),
    colorScheme: 'light' as const,
  }
}

describe('BankCardScreen 写闭环', () => {
  it('新增：空格卡号归一化、默认开关透传，成功后收起表单', async () => {
    cleanup()
    const onAddCard = vi.fn(async (_input: BankCardInput) => {})
    expect(typeof BankCardScreen).toBe('function')
    render(<BankCardScreen {...baseProps()} onAddCard={onAddCard} />)

    fireEvent.click(screen.getByTestId('bank-card-add'))
    fireEvent.change(screen.getByPlaceholderText('bankCard.bankNamePlaceholder'), {
      target: { value: '招商银行' },
    })
    fireEvent.change(screen.getByPlaceholderText('bankCard.holderPlaceholder'), {
      target: { value: '张三' },
    })
    fireEvent.change(screen.getByPlaceholderText('bankCard.numberPlaceholder'), {
      target: { value: '4111 1111 1111 1111' },
    })
    fireEvent.click(screen.getByText('bankCard.formDefault'))
    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(onAddCard).toHaveBeenCalledWith({
        number: '4111111111111111',
        holder: '张三',
        bankName: '招商银行',
        isDefault: true,
      })
    })
    await waitFor(() => {
      expect(screen.queryByText('bankCard.formDefault')).toBeNull()
    })
  })

  it('编辑卡可设默认/二次确认删除，投影卡不暴露写按钮', async () => {
    cleanup()
    const onSetDefaultCard = vi.fn(async (_id: string) => {})
    const onDeleteCard = vi.fn(async (_id: string) => {})
    render(
      <BankCardScreen
        {...baseProps()}
        onSetDefaultCard={onSetDefaultCard}
        onDeleteCard={onDeleteCard}
      />,
    )

    expect(screen.queryByTestId('bank-card-delete-history')).toBeNull()
    expect(screen.queryByTestId('bank-card-default-history')).toBeNull()

    fireEvent.click(screen.getByTestId('bank-card-default-b'))
    await waitFor(() => expect(onSetDefaultCard).toHaveBeenCalledWith('b'))

    fireEvent.click(screen.getByTestId('bank-card-delete-b'))
    expect(screen.getByText('bankCard.deleteConfirm')).not.toBeNull()
    fireEvent.click(screen.getByTestId('bank-card-delete-confirm-b'))
    await waitFor(() => expect(onDeleteCard).toHaveBeenCalledWith('b'))
  })

  it('新增失败时显示错误且不收起表单', async () => {
    cleanup()
    const onAddCard = vi.fn(async (_input: BankCardInput) => {
      throw new Error('duplicate')
    })
    render(<BankCardScreen {...baseProps()} onAddCard={onAddCard} />)

    fireEvent.click(screen.getByTestId('bank-card-add'))
    fireEvent.change(screen.getByPlaceholderText('bankCard.bankNamePlaceholder'), {
      target: { value: '招商银行' },
    })
    fireEvent.change(screen.getByPlaceholderText('bankCard.holderPlaceholder'), {
      target: { value: '张三' },
    })
    fireEvent.change(screen.getByPlaceholderText('bankCard.numberPlaceholder'), {
      target: { value: '4111111111111111' },
    })
    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => expect(screen.getByText('bankCard.addFailed')).not.toBeNull())
    expect(screen.getByText('bankCard.formDefault')).not.toBeNull()
  })
})
