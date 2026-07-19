import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { I18nProvider } from '../src/i18n'

const mocks = vi.hoisted(() => ({
  adminGetConfig: vi.fn(),
  adminUpdateConfig: vi.fn(),
  listSystemOperationLogs: vi.fn(),
}))

vi.mock('@ihui/api-client', () => ({
  adminGetConfig: mocks.adminGetConfig,
  adminUpdateConfig: mocks.adminUpdateConfig,
  listSystemOperationLogs: mocks.listSystemOperationLogs,
}))

vi.mock('../src/components/admin/ConfigRowDialog', () => ({
  ConfigRowDialog: ({
    open,
    onSubmit,
    onClose,
  }: {
    open: boolean
    onSubmit: (v: { key: string; value: string }) => void
    onClose: () => void
  }) => {
    if (!open) return null
    return createElement(
      'div',
      { 'data-testid': 'config-row-dialog-stub' },
      createElement(
        'button',
        { 'data-testid': 'config-row-dialog-stub-submit', onClick: () => onSubmit({ key: 'site.title', value: 'New Title' }) },
        'submit',
      ),
      createElement('button', { 'data-testid': 'config-row-dialog-stub-close', onClick: onClose }, 'close'),
    )
  },
}))

import AdminSettings from '../src/pages/admin/AdminSettings'

function wrap(ui: ReactNode) {
  return createElement(I18nProvider, null, ui)
}

const SAMPLE_CONFIG = {
  'site.title': 'IHUI AI',
  'site.theme': 'dark',
  'maintenance': false,
}

const SAMPLE_LOGS = {
  list: [
    { id: '1', action: 'login', userNickname: 'Alice', resource: 'auth', createdAt: '2026-01-01T00:00:00Z' },
  ],
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mocks.adminGetConfig.mockResolvedValue({ success: true, data: SAMPLE_CONFIG })
  mocks.listSystemOperationLogs.mockResolvedValue({ success: true, data: SAMPLE_LOGS })
  mocks.adminUpdateConfig.mockResolvedValue({ success: true, data: SAMPLE_CONFIG })
})

describe('AdminSettings', () => {
  it('renders config table with rows', async () => {
    render(wrap(createElement(AdminSettings)))
    await waitFor(() => expect(screen.getByTestId('admin-settings')).toBeTruthy())
    expect(screen.getByText('site.title')).toBeTruthy()
    expect(screen.getByText('IHUI AI')).toBeTruthy()
    expect(screen.getByText('site.theme')).toBeTruthy()
  })

  it('opens the add config dialog when add is clicked', async () => {
    render(wrap(createElement(AdminSettings)))
    await waitFor(() => expect(screen.getByTestId('admin-settings')).toBeTruthy())
    fireEvent.click(screen.getByTestId('admin-config-add'))
    expect(screen.getByTestId('config-row-dialog-stub')).toBeTruthy()
  })

  it('adds a new row on dialog submit and saves to backend', async () => {
    render(wrap(createElement(AdminSettings)))
    await waitFor(() => expect(screen.getByTestId('admin-settings')).toBeTruthy())
    fireEvent.click(screen.getByTestId('admin-config-add'))
    fireEvent.click(screen.getByTestId('config-row-dialog-stub-submit'))
    await waitFor(() => expect(screen.getByText('site.title').isConnected).toBe(true))
    expect(screen.getAllByText('site.title').length).toBeGreaterThanOrEqual(1)
    fireEvent.click(screen.getByTestId('admin-config-save'))
    await waitFor(() =>
      expect(mocks.adminUpdateConfig).toHaveBeenCalledWith(
        expect.objectContaining({ 'site.title': expect.anything() }),
      ),
    )
  })

  it('opens edit dialog when row edit is clicked', async () => {
    render(wrap(createElement(AdminSettings)))
    await waitFor(() => expect(screen.getByTestId('admin-settings')).toBeTruthy())
    const editBtn = screen.getByTestId('admin-config-edit-site.title-0')
    fireEvent.click(editBtn)
    expect(screen.getByTestId('config-row-dialog-stub')).toBeTruthy()
  })

  it('removes a row when delete is confirmed', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(wrap(createElement(AdminSettings)))
    await waitFor(() => expect(screen.getByTestId('admin-settings')).toBeTruthy())
    fireEvent.click(screen.getByTestId('admin-config-remove-site.title-0'))
    await waitFor(() => expect(screen.queryByText('IHUI AI')).toBeNull())
    confirmSpy.mockRestore()
  })

  it('does not remove a row when confirm is cancelled', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(wrap(createElement(AdminSettings)))
    await waitFor(() => expect(screen.getByTestId('admin-settings')).toBeTruthy())
    fireEvent.click(screen.getByTestId('admin-config-remove-site.title-0'))
    expect(screen.getByText('IHUI AI')).toBeTruthy()
    confirmSpy.mockRestore()
  })

  it('shows success message after save', async () => {
    render(wrap(createElement(AdminSettings)))
    await waitFor(() => expect(screen.getByTestId('admin-settings')).toBeTruthy())
    fireEvent.click(screen.getByTestId('admin-config-save'))
    await waitFor(() => expect(screen.getByTestId('admin-config-message').textContent).toBeTruthy())
  })

  it('shows error message when save fails', async () => {
    mocks.adminUpdateConfig.mockResolvedValueOnce({ success: false, error: '保存失败' })
    render(wrap(createElement(AdminSettings)))
    await waitFor(() => expect(screen.getByTestId('admin-settings')).toBeTruthy())
    fireEvent.click(screen.getByTestId('admin-config-save'))
    await waitFor(() => expect(screen.getByTestId('admin-config-message').textContent).toContain('保存失败'))
  })
})
