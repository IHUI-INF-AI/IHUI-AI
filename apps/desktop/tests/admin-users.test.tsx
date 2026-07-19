import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { I18nProvider } from '../src/i18n'

const mocks = vi.hoisted(() => ({
  listAdminUsers: vi.fn(),
  addAdminUser: vi.fn(),
  updateAdminUser: vi.fn(),
  delAdminUser: vi.fn(),
}))

vi.mock('@ihui/api-client', () => ({
  listAdminUsers: mocks.listAdminUsers,
  addAdminUser: mocks.addAdminUser,
  updateAdminUser: mocks.updateAdminUser,
  delAdminUser: mocks.delAdminUser,
}))

vi.mock('../src/components/admin/UserDialog', () => ({
  UserDialog: ({
    open,
    onSubmit,
    onClose,
  }: {
    open: boolean
    onSubmit: (v: { nickname: string; phone: string; email: string; password: string; roleId: number; status: number; level: number }) => void
    onClose: () => void
  }) => {
    if (!open) return null
    return createElement(
      'div',
      { 'data-testid': 'user-dialog-stub' },
      createElement(
        'button',
        {
          'data-testid': 'user-dialog-stub-submit',
          onClick: () =>
            onSubmit({
              nickname: 'Stub',
              phone: '',
              email: '',
              password: 'secret',
              roleId: 0,
              status: 1,
              level: 0,
            }),
        },
        'submit',
      ),
      createElement('button', { 'data-testid': 'user-dialog-stub-close', onClick: onClose }, 'close'),
    )
  },
}))

import AdminUsers from '../src/pages/admin/AdminUsers'

function wrap(ui: ReactNode) {
  return createElement(I18nProvider, null, ui)
}

const SAMPLE_USERS = [
  {
    id: 'u-1',
    nickname: 'Alice',
    phone: '13800000000',
    email: null,
    username: 'alice',
    roleId: 0,
    isSystemAdmin: false,
    status: 1,
    level: 1,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'u-2',
    nickname: 'Bob',
    phone: null,
    email: 'bob@example.com',
    username: 'bob',
    roleId: 1,
    isSystemAdmin: false,
    status: 0,
    level: 5,
    createdAt: '2026-02-01T00:00:00Z',
  },
]

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mocks.listAdminUsers.mockResolvedValue({
    success: true,
    data: { list: SAMPLE_USERS, total: SAMPLE_USERS.length },
  })
})

describe('AdminUsers', () => {
  it('renders loading then list rows', async () => {
    render(wrap(createElement(AdminUsers)))
    await waitFor(() => expect(screen.getByTestId('admin-users')).toBeTruthy())
    expect(screen.getByText('Alice')).toBeTruthy()
    expect(screen.getByText('Bob')).toBeTruthy()
    expect(mocks.listAdminUsers).toHaveBeenCalled()
  })

  it('opens the user dialog on Create click', async () => {
    render(wrap(createElement(AdminUsers)))
    await waitFor(() => expect(screen.getByTestId('admin-users')).toBeTruthy())
    fireEvent.click(screen.getByTestId('admin-users-create'))
    expect(screen.getByTestId('user-dialog-stub')).toBeTruthy()
  })

  it('submits addAdminUser and reloads', async () => {
    mocks.addAdminUser.mockResolvedValue({ success: true, data: { user: SAMPLE_USERS[0] } })
    render(wrap(createElement(AdminUsers)))
    await waitFor(() => expect(screen.getByTestId('admin-users')).toBeTruthy())
    fireEvent.click(screen.getByTestId('admin-users-create'))
    await waitFor(() => expect(screen.getByTestId('user-dialog-stub')).toBeTruthy())
    fireEvent.click(screen.getByTestId('user-dialog-stub-submit'))
    await waitFor(() => expect(mocks.addAdminUser).toHaveBeenCalled(), { timeout: 2000 })
    expect(mocks.addAdminUser).toHaveBeenCalledWith(
      expect.objectContaining({ nickname: 'Stub', password: 'secret' }),
    )
    await waitFor(() => expect(mocks.listAdminUsers.mock.calls.length).toBeGreaterThanOrEqual(2))
  })

  it('opens edit dialog when clicking edit on a row', async () => {
    render(wrap(createElement(AdminUsers)))
    await waitFor(() => expect(screen.getByTestId('admin-users-row-u-1')).toBeTruthy())
    fireEvent.click(screen.getByTestId('admin-users-edit-u-1'))
    expect(screen.getByTestId('user-dialog-stub')).toBeTruthy()
  })

  it('confirms and deletes user when clicking delete', async () => {
    mocks.delAdminUser.mockResolvedValue({ success: true, data: { user: SAMPLE_USERS[0] } })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(wrap(createElement(AdminUsers)))
    await waitFor(() => expect(screen.getByTestId('admin-users-row-u-1')).toBeTruthy())
    fireEvent.click(screen.getByTestId('admin-users-delete-u-1'))
    await waitFor(() => expect(mocks.delAdminUser).toHaveBeenCalledWith('u-1'))
    confirmSpy.mockRestore()
  })

  it('does not call delAdminUser when user cancels the confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(wrap(createElement(AdminUsers)))
    await waitFor(() => expect(screen.getByTestId('admin-users-row-u-1')).toBeTruthy())
    fireEvent.click(screen.getByTestId('admin-users-delete-u-1'))
    expect(mocks.delAdminUser).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})
