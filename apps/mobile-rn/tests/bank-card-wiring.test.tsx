// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 壳 BankCardScreen 写端点接线夹具（2026-11-27）。
 *
 * 共享屏只负责交互外观；真正打到后端的 method/path/body 由壳决定。
 * 判据：新增 POST /wallet/bank-cards、删除 DELETE /wallet/bank-cards/:id、
 * 设默认 PATCH /wallet/bank-cards/:id/default，且每次成功写后重新 GET 合并列表。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { createElement } from 'react'

const { fetchApi, stableT } = vi.hoisted(() => ({
  fetchApi: vi.fn(),
  stableT: (key: string) => key,
}))

vi.mock('@ihui/api-client', () => ({ fetchApi }))
vi.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: vi.fn() }) }))
vi.mock('../src/context/ThemeContext', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('../src/i18n', () => ({ useI18n: () => ({ t: stableT }) }))

vi.mock('@ihui/rn-app', () => ({
  BankCardScreen: (props: {
    onAddCard?: (input: {
      number: string
      holder: string
      bankName: string
      isDefault: boolean
    }) => Promise<void>
    onDeleteCard?: (id: string) => Promise<void>
    onSetDefaultCard?: (id: string) => Promise<void>
  }) =>
    createElement(
      'div',
      null,
      createElement('button', {
        'data-testid': 'wired-add',
        onClick: () =>
          void props.onAddCard?.({
            number: '4111111111111111',
            holder: '张三',
            bankName: '招商银行',
            isDefault: true,
          }),
      }),
      createElement('button', {
        'data-testid': 'wired-delete',
        onClick: () => void props.onDeleteCard?.('card-1'),
      }),
      createElement('button', {
        'data-testid': 'wired-default',
        onClick: () => void props.onSetDefaultCard?.('card-1'),
      }),
    ),
}))

import { BankCardScreen } from '../src/screens/BankCardScreen'

describe('BankCardScreen RN 壳写端点', () => {
  beforeEach(() => {
    fetchApi.mockReset()
    fetchApi.mockResolvedValue({ success: true, data: [] })
  })

  it('新增/删除/设默认分别打到 POST/DELETE/PATCH，并在写后重载列表', async () => {
    render(createElement(BankCardScreen))

    await waitFor(() => expect(fetchApi).toHaveBeenCalledWith('/wallet/bank-cards'))

    fireEvent.click(screen.getByTestId('wired-add'))
    await waitFor(() =>
      expect(fetchApi).toHaveBeenCalledWith('/wallet/bank-cards', {
        method: 'POST',
        body: JSON.stringify({
          number: '4111111111111111',
          holder: '张三',
          bankName: '招商银行',
          isDefault: true,
        }),
      }),
    )
    await waitFor(() => expect(fetchApi).toHaveBeenCalledTimes(3))

    fireEvent.click(screen.getByTestId('wired-delete'))
    await waitFor(() =>
      expect(fetchApi).toHaveBeenCalledWith('/wallet/bank-cards/card-1', {
        method: 'DELETE',
      }),
    )
    await waitFor(() => expect(fetchApi).toHaveBeenCalledTimes(5))

    fireEvent.click(screen.getByTestId('wired-default'))
    await waitFor(() =>
      expect(fetchApi).toHaveBeenCalledWith('/wallet/bank-cards/card-1/default', {
        method: 'PATCH',
      }),
    )
    await waitFor(() => expect(fetchApi).toHaveBeenCalledTimes(7))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
